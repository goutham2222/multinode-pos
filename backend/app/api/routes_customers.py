from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException
from app.db.pool import db_pool
from app.models.schemas import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=Dict[str, Any])
def list_customers(
    search: Optional[str] = Query(None, description="Search by name or email"),
    zip_code: Optional[str] = Query(None, description="Filter by zip code"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    target_node: Optional[str] = Query("auto")
):
    conditions = ["1=1"]
    params: List[Any] = []

    if search:
        conditions.append("(c.FirstName LIKE %s OR c.LastName LIKE %s OR c.Email LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    if zip_code:
        conditions.append("c.Zip = %s")
        params.append(zip_code)

    where_clause = " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS total FROM Customer c WHERE {where_clause}"
    query_sql = f"""
        SELECT c.CustomerID, c.FirstName, c.LastName, c.Email, c.Address1 AS Address, c.Zip,
               ct.City AS CityName, ct.State
        FROM Customer c
        LEFT JOIN City ct ON c.Zip = ct.Zip
        WHERE {where_clause}
        ORDER BY c.CustomerID ASC
        LIMIT %s OFFSET %s
    """
    params_with_paging = list(params) + [limit, offset]

    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute(count_sql, params)
            total = cur.fetchone()["total"]

            cur.execute(query_sql, params_with_paging)
            rows = cur.fetchall()

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "rows": rows,
                "node_executed": node_meta
            }


@router.get("/{customer_id}", response_model=Dict[str, Any])
def get_customer(
    customer_id: int,
    target_node: Optional[str] = Query("auto")
):
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.CustomerID, c.FirstName, c.LastName, c.Email, c.Address1 AS Address, c.Zip,
                       ct.City AS CityName, ct.State,
                       COALESCE(tr.EstimatedCombinedRate, 0.00) AS TaxRate
                FROM Customer c
                LEFT JOIN City ct ON c.Zip = ct.Zip
                LEFT JOIN TaxRates tr ON c.Zip = tr.ZipCode
                WHERE c.CustomerID = %s
                """,
                (customer_id,)
            )
            cust = cur.fetchone()
            if not cust:
                raise HTTPException(status_code=404, detail="Customer not found")

            # Also fetch order count and total spend
            cur.execute(
                """
                SELECT COUNT(*) AS order_count, COALESCE(SUM(OrderTotal), 0.00) AS total_spent
                FROM `Order`
                WHERE CustomerID = %s
                """,
                (customer_id,)
            )
            stats = cur.fetchone()

            return {
                "customer": cust,
                "stats": stats,
                "node_executed": node_meta
            }


@router.post("", response_model=Dict[str, Any])
def create_customer(
    payload: CustomerCreate,
    target_node: Optional[str] = Query("auto")
):
    with db_pool.connection(target_node) as (conn, node_meta):
        try:
            with conn.cursor() as cur:
                # Validate zip exists in City table
                if payload.Zip:
                    cur.execute("SELECT Zip FROM City WHERE Zip = %s", (payload.Zip,))
                    if not cur.fetchone():
                        raise HTTPException(status_code=400, detail=f"ZipCode {payload.Zip} is not a recognized municipality.")

                cur.execute("SELECT COALESCE(MAX(CustomerID), 0) + 1 AS next_id FROM Customer")
                next_id = cur.fetchone()["next_id"]

                cur.execute(
                    """
                    INSERT INTO Customer (CustomerID, FirstName, LastName, Email, Address1, Zip)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (next_id, payload.FirstName, payload.LastName, payload.Email, payload.Address, payload.Zip)
                )
                conn.commit()

                return {
                    "success": True,
                    "customer_id": next_id,
                    "customer": {
                        "CustomerID": next_id,
                        "FirstName": payload.FirstName,
                        "LastName": payload.LastName,
                        "Email": payload.Email,
                        "Zip": payload.Zip
                    },
                    "node_executed": node_meta
                }
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))
