import time
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
import pymysql

from app.db.pool import db_pool
from app.models.schemas import (
    CheckoutRequest, CheckoutSuccessResponse, OrderResponse, OrderLineResponse,
    ProductCreate, ProductResponse, PriceHistoryItem
)


class PosService:
    @staticmethod
    def checkout(request: CheckoutRequest) -> CheckoutSuccessResponse:
        """
        Executes an atomic multi-item POS checkout transaction across MariaDB Galera.
        Enforces inventory constraints via database triggers; rolls back cleanly if out of stock.
        """
        with db_pool.connection(request.TargetNode) as (conn, node_meta):
            try:
                with conn.cursor() as cur:
                    # 1. Verify customer exists
                    cur.execute(
                        "SELECT CustomerID, FirstName, LastName, Zip FROM Customer WHERE CustomerID = %s",
                        (request.CustomerID,)
                    )
                    customer = cur.fetchone()
                    if not customer:
                        raise HTTPException(status_code=404, detail=f"Customer ID {request.CustomerID} does not exist.")

                    # 2. Generate unique order ID
                    cur.execute("SELECT COALESCE(MAX(OrderID), 0) AS max_id FROM `Order`")
                    max_id = cur.fetchone()["max_id"]
                    # Generate safe monotonic ID
                    order_id = max_id + 1

                    # 3. Insert Order header
                    cur.execute(
                        """
                        INSERT INTO `Order` (`OrderID`, `datePlaced`, `CustomerID`, `OrderSubtotal`, `SalesTax`)
                        VALUES (%s, CURRENT_DATE(), %s, 0.00, 0.00)
                        """,
                        (order_id, request.CustomerID)
                    )

                    # 4. Insert each line item (Triggers will validate inventory, default UnitPrice, compute LineTotal and update Subtotal/Tax)
                    for item in request.Items:
                        if item.Quantity <= 0:
                            raise HTTPException(status_code=400, detail="Item quantity must be greater than zero.")

                        cur.execute(
                            """
                            INSERT INTO `OrderLine` (`OrderID`, `ProductID`, `Quantity`, `UnitPrice`)
                            VALUES (%s, %s, %s, NULL)
                            """,
                            (order_id, item.ProductID, item.Quantity)
                        )

                    # 5. Fetch calculated Order summary
                    cur.execute(
                        """
                        SELECT o.OrderID, o.CustomerID, CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
                               o.datePlaced, o.dateShipped, 
                               COALESCE(o.OrderSubtotal, 0.00) AS OrderSubtotal,
                               COALESCE(o.SalesTax, 0.00) AS SalesTax,
                               COALESCE(o.OrderTotal, 0.00) AS OrderTotal
                        FROM `Order` o
                        JOIN `Customer` c ON o.CustomerID = c.CustomerID
                        WHERE o.OrderID = %s
                        """,
                        (order_id,)
                    )
                    order_header = cur.fetchone()

                    # 6. Fetch Order lines
                    cur.execute(
                        """
                        SELECT ol.OrderID, ol.ProductID, p.Name AS ProductName,
                               ol.Quantity, ol.UnitPrice, ol.LineTotal
                        FROM `OrderLine` ol
                        JOIN `Product` p ON ol.ProductID = p.ProductID
                        WHERE ol.OrderID = %s
                        """,
                        (order_id,)
                    )
                    line_rows = cur.fetchall()

                    # Commit the ACID transaction
                    conn.commit()

                    order_resp = OrderResponse(
                        OrderID=order_header["OrderID"],
                        CustomerID=order_header["CustomerID"],
                        CustomerName=order_header["CustomerName"],
                        DatePlaced=datetime.combine(order_header["datePlaced"], datetime.min.time()) if isinstance(order_header["datePlaced"], date) and not isinstance(order_header["datePlaced"], datetime) else order_header["datePlaced"],
                        DateShipped=order_header["dateShipped"],
                        OrderStatus="Shipped" if order_header["dateShipped"] else "Completed",
                        OrderSubtotal=float(order_header["OrderSubtotal"]),
                        SalesTax=float(order_header["SalesTax"]),
                        OrderTotal=float(order_header["OrderTotal"]),
                        Lines=[
                            OrderLineResponse(
                                OrderID=l["OrderID"],
                                ProductID=l["ProductID"],
                                ProductName=l["ProductName"],
                                Quantity=l["Quantity"],
                                UnitPrice=float(l["UnitPrice"]),
                                LineTotal=float(l["LineTotal"])
                            ) for l in line_rows
                        ]
                    )

                    return CheckoutSuccessResponse(
                        success=True,
                        order=order_resp,
                        node_executed=node_meta,
                        message=f"Order #{order_id} committed successfully on {node_meta['name']} with synchronous Galera replication."
                    )

            except (pymysql.err.OperationalError, pymysql.err.InternalError, pymysql.err.DatabaseError) as db_err:
                conn.rollback()
                # Check for MariaDB trigger abort (SQLSTATE 45000 / code 1644)
                err_msg = str(db_err)
                if "Transaction Aborted" in err_msg or "exceeds Product.QtyOnHand" in err_msg or "45000" in err_msg:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": "INSUFFICIENT_INVENTORY",
                            "message": err_msg,
                            "action": "TRANSACTION_ROLLED_BACK",
                            "node": node_meta
                        }
                    )
                raise HTTPException(status_code=500, detail=f"Database operational error: {err_msg}")
            except HTTPException:
                conn.rollback()
                raise
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=f"Checkout failed and rolled back: {str(e)}")

    @staticmethod
    def update_price(product_id: int, new_price: float, target_node: Optional[str] = "auto") -> Dict[str, Any]:
        """
        Updates product price and triggers the database audit trigger `trig_ProductPriceAudit`.
        """
        with db_pool.connection(target_node) as (conn, node_meta):
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT ProductID, Name, CurrentPrice, QtyOnHand FROM Product WHERE ProductID = %s", (product_id,))
                    prod = cur.fetchone()
                    if not prod:
                        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

                    old_price = float(prod["CurrentPrice"])
                    if round(new_price, 2) == round(old_price, 2):
                        raise HTTPException(
                            status_code=400,
                            detail=f"New price (${new_price:.2f}) is identical to current price. Price audit requires a price change."
                        )

                    cur.execute(
                        "UPDATE Product SET CurrentPrice = %s WHERE ProductID = %s",
                        (new_price, product_id)
                    )
                    conn.commit()

                    # Fetch updated product & latest audit log
                    cur.execute(
                        "SELECT ChangeID, ProductID, OldPrice, NewPrice, TS AS ChangeDate FROM PriceHistory WHERE ProductID = %s ORDER BY ChangeID DESC LIMIT 1",
                        (product_id,)
                    )
                    audit = cur.fetchone()

                    return {
                        "success": True,
                        "product_id": product_id,
                        "old_price": old_price,
                        "new_price": new_price,
                        "audit_logged": audit is not None,
                        "audit_record": audit,
                        "node_executed": node_meta
                    }
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=str(e))

    @staticmethod
    def update_stock(product_id: int, qty_delta: int, target_node: Optional[str] = "auto") -> Dict[str, Any]:
        """
        Adjusts product stock directly.
        """
        with db_pool.connection(target_node) as (conn, node_meta):
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT ProductID, Name, QtyOnHand FROM Product WHERE ProductID = %s", (product_id,))
                    prod = cur.fetchone()
                    if not prod:
                        raise HTTPException(status_code=404, detail=f"Product {product_id} not found.")

                    old_stock = int(prod["QtyOnHand"])
                    new_stock = old_stock + qty_delta
                    if new_stock < 0:
                        raise HTTPException(status_code=400, detail=f"Cannot reduce stock below 0. Current stock is {old_stock}.")

                    cur.execute(
                        "UPDATE Product SET QtyOnHand = %s WHERE ProductID = %s",
                        (new_stock, product_id)
                    )
                    conn.commit()

                    return {
                        "success": True,
                        "product_id": product_id,
                        "old_stock": old_stock,
                        "new_stock": new_stock,
                        "delta": qty_delta,
                        "node_executed": node_meta
                    }
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=str(e))

    @staticmethod
    def create_product(product: ProductCreate, target_node: Optional[str] = "auto") -> Dict[str, Any]:
        with db_pool.connection(target_node) as (conn, node_meta):
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT COALESCE(MAX(ProductID), 0) + 1 AS next_id FROM Product")
                    next_id = cur.fetchone()["next_id"]
                    cur.execute(
                        "INSERT INTO Product (ProductID, Name, CurrentPrice, QtyOnHand) VALUES (%s, %s, %s, %s)",
                        (next_id, product.Name, product.CurrentPrice, product.QtyOnHand)
                    )
                    conn.commit()
                    return {
                        "success": True,
                        "product": {
                            "ProductID": next_id,
                            "Name": product.Name,
                            "CurrentPrice": product.CurrentPrice,
                            "QtyOnHand": product.QtyOnHand
                        },
                        "node_executed": node_meta
                    }
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=str(e))


pos_service = PosService()
