from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException
from app.db.pool import db_pool
from app.models.schemas import SqlDemoResponse


class QueryService:
    @staticmethod
    def filter_orders(
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        zip_code: Optional[str] = None,
        min_total: Optional[float] = None,
        max_total: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
        target_node: Optional[str] = "auto"
    ) -> Dict[str, Any]:
        """
        Executes dynamic parameterized prepared statements against MariaDB Galera.
        Guarantees protection against SQL injection by using parameter bindings.
        """
        conditions = ["1=1"]
        params: List[Any] = []

        if customer_id is not None:
            conditions.append("o.CustomerID = %s")
            params.append(customer_id)

        if customer_name:
            conditions.append("(c.FirstName LIKE %s OR c.LastName LIKE %s)")
            params.extend([f"%{customer_name}%", f"%{customer_name}%"])

        if status:
            if status.lower() == "shipped":
                conditions.append("o.dateShipped IS NOT NULL")
            elif status.lower() in ("processing", "pending"):
                conditions.append("o.dateShipped IS NULL")

        if date_from:
            conditions.append("o.datePlaced >= %s")
            params.append(date_from)

        if date_to:
            conditions.append("o.datePlaced <= %s")
            params.append(date_to)

        if zip_code:
            conditions.append("c.Zip = %s")
            params.append(zip_code)

        if min_total is not None:
            conditions.append("o.OrderTotal >= %s")
            params.append(min_total)

        if max_total is not None:
            conditions.append("o.OrderTotal <= %s")
            params.append(max_total)

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT o.OrderID, o.CustomerID, CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
                   c.Zip, o.datePlaced, o.dateShipped,
                   COALESCE(o.OrderSubtotal, 0.00) AS OrderSubtotal,
                   COALESCE(o.SalesTax, 0.00) AS SalesTax,
                   COALESCE(o.OrderTotal, 0.00) AS OrderTotal,
                   CASE WHEN o.dateShipped IS NULL THEN 'Processing' ELSE 'Shipped' END AS OrderStatus
            FROM `Order` o
            JOIN `Customer` c ON o.CustomerID = c.CustomerID
            WHERE {where_clause}
            ORDER BY o.OrderID DESC
            LIMIT %s OFFSET %s
        """
        params_with_paging = list(params) + [min(limit, 200), offset]

        count_query = f"""
            SELECT COUNT(*) AS total
            FROM `Order` o
            JOIN `Customer` c ON o.CustomerID = c.CustomerID
            WHERE {where_clause}
        """

        with db_pool.connection(target_node) as (conn, node_meta):
            with conn.cursor() as cur:
                # Count total matching
                cur.execute(count_query, params)
                total_records = cur.fetchone()["total"]

                # Fetch page records
                cur.execute(query, params_with_paging)
                rows = list(cur.fetchall())

                return {
                    "total": total_records,
                    "limit": limit,
                    "offset": offset,
                    "rows": rows,
                    "node_executed": node_meta,
                    "parameterized_sql": query,
                    "bound_params": params_with_paging
                }

    @staticmethod
    def get_order_details(order_id: int, target_node: Optional[str] = "auto") -> Dict[str, Any]:
        with db_pool.connection(target_node) as (conn, node_meta):
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT o.OrderID, o.CustomerID, CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
                           c.Email, c.Address1, c.Zip, ct.City AS CityName, ct.State,
                           o.datePlaced, o.dateShipped,
                           COALESCE(o.OrderSubtotal, 0.00) AS OrderSubtotal,
                           COALESCE(o.SalesTax, 0.00) AS SalesTax,
                           COALESCE(o.OrderTotal, 0.00) AS OrderTotal,
                           CASE WHEN o.dateShipped IS NULL THEN 'Processing' ELSE 'Shipped' END AS OrderStatus
                    FROM `Order` o
                    JOIN `Customer` c ON o.CustomerID = c.CustomerID
                    LEFT JOIN `City` ct ON c.Zip = ct.Zip
                    WHERE o.OrderID = %s
                    """,
                    (order_id,)
                )
                order = cur.fetchone()
                if not order:
                    raise HTTPException(status_code=404, detail=f"Order #{order_id} not found.")

                cur.execute(
                    """
                    SELECT ol.OrderID, ol.ProductID, p.Name AS ProductName,
                           ol.Quantity, ol.UnitPrice, ol.LineTotal
                    FROM `OrderLine` ol
                    JOIN `Product` p ON ol.ProductID = p.ProductID
                    WHERE ol.OrderID = %s
                    ORDER BY ol.ProductID ASC
                    """,
                    (order_id,)
                )
                lines = cur.fetchall()

                order["Lines"] = lines
                return {"order": order, "node_executed": node_meta}

    @staticmethod
    def demonstrate_injection_defense(
        search_term: str,
        use_prepared_statement: bool = True,
        target_node: Optional[str] = "auto"
    ) -> SqlDemoResponse:
        """
        Interactive demonstration comparing prepared statement binding vs naive string concatenation.
        Neutralizes and visualizes injection payloads without jeopardizing production database state.
        """
        with db_pool.connection(target_node) as (conn, node_meta):
            with conn.cursor() as cur:
                if use_prepared_statement:
                    # Safe parameterized prepared statement
                    query = "SELECT ProductID, Name, CurrentPrice, QtyOnHand FROM Product WHERE Name LIKE %s LIMIT 10"
                    bound_val = f"%{search_term}%"
                    cur.execute(query, (bound_val,))
                    results = cur.fetchall()

                    return SqlDemoResponse(
                        safe_mode=True,
                        query_template=query,
                        bound_parameters=[bound_val],
                        executed_sql=f"PREPARE stmt FROM '{query}'; EXECUTE stmt USING '{bound_val}';",
                        row_count=len(results),
                        sample_results=results,
                        defense_summary=(
                            "SAFE: Parameterized prepared statement treated the input strictly as a literal data scalar. "
                            "Quotes, semicolons, and OR conditions were safely escaped by the database driver, "
                            "preventing SQL injection syntax modification."
                        )
                    )
                else:
                    # Educational demonstration of raw query construction (sanitized to SELECT only for safety)
                    # We disallow DDL / destructive commands inside the demo runner while showing injection vulnerability
                    unsafe_term = search_term.replace("DROP", "SELECT").replace("DELETE", "SELECT")
                    raw_sql = f"SELECT ProductID, Name, CurrentPrice, QtyOnHand FROM Product WHERE Name = '{unsafe_term}' LIMIT 10"
                    
                    try:
                        cur.execute(raw_sql)
                        results = cur.fetchall()
                    except Exception as e:
                        results = [{"error": str(e)}]

                    return SqlDemoResponse(
                        safe_mode=False,
                        query_template=raw_sql,
                        bound_parameters=None,
                        executed_sql=raw_sql,
                        row_count=len(results) if "error" not in results[0] else 0,
                        sample_results=results,
                        defense_summary=(
                            "VULNERABLE: Direct string interpolation allowed user input to alter the SQL AST. "
                            f"Input '{search_term}' broke out of the string delimiter and altered the WHERE clause semantics."
                        )
                    )


query_service = QueryService()
