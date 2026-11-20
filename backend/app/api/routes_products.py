from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException
from app.db.pool import db_pool
from app.services.pos_service import pos_service
from app.models.schemas import (
    ProductResponse, ProductCreate, ProductPriceUpdate, ProductStockUpdate, PriceHistoryItem
)

router = APIRouter(prefix="/products", tags=["Products & Catalog"])


@router.get("", response_model=Dict[str, Any])
def list_products(
    search: Optional[str] = Query(None, description="Search by product name"),
    min_price: Optional[float] = Query(None, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, description="Maximum price filter"),
    in_stock_only: bool = Query(False, description="Filter products with QtyOnHand > 0"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    target_node: Optional[str] = Query("auto", description="Target node: 1, 2, 3, or auto")
):
    """
    Lists catalog products with prepared-statement search, filtering, and target node selection.
    """
    conditions = ["1=1"]
    params: List[Any] = []

    if search:
        conditions.append("Name LIKE %s")
        params.append(f"%{search}%")

    if min_price is not None:
        conditions.append("CurrentPrice >= %s")
        params.append(min_price)

    if max_price is not None:
        conditions.append("CurrentPrice <= %s")
        params.append(max_price)

    if in_stock_only:
        conditions.append("QtyOnHand > 0")

    where_clause = " AND ".join(conditions)

    count_sql = f"SELECT COUNT(*) AS total FROM Product WHERE {where_clause}"
    query_sql = f"SELECT ProductID, Name, CurrentPrice, QtyOnHand FROM Product WHERE {where_clause} ORDER BY ProductID ASC LIMIT %s OFFSET %s"

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


@router.get("/{product_id}", response_model=Dict[str, Any])
def get_product(
    product_id: int,
    target_node: Optional[str] = Query("auto")
):
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ProductID, Name, CurrentPrice, QtyOnHand FROM Product WHERE ProductID = %s",
                (product_id,)
            )
            prod = cur.fetchone()
            if not prod:
                raise HTTPException(status_code=404, detail="Product not found")

            # Also fetch price history
            cur.execute(
                "SELECT ChangeID, ProductID, OldPrice, NewPrice, TS AS ChangeDate FROM PriceHistory WHERE ProductID = %s ORDER BY ChangeID DESC LIMIT 10",
                (product_id,)
            )
            history = cur.fetchall()

            return {
                "product": prod,
                "price_history": history,
                "node_executed": node_meta
            }


@router.post("", response_model=Dict[str, Any])
def create_product(
    payload: ProductCreate,
    target_node: Optional[str] = Query("auto")
):
    return pos_service.create_product(payload, target_node)


@router.patch("/{product_id}/price", response_model=Dict[str, Any])
def update_product_price(
    product_id: int,
    payload: ProductPriceUpdate,
    target_node: Optional[str] = Query("auto")
):
    """
    Updates product price. MariaDB trigger `trig_ProductPriceAudit` fires synchronously,
    logging the old price and new price to `PriceHistory`.
    """
    return pos_service.update_price(product_id, payload.CurrentPrice, target_node)


@router.patch("/{product_id}/stock", response_model=Dict[str, Any])
def update_product_stock(
    product_id: int,
    payload: ProductStockUpdate,
    target_node: Optional[str] = Query("auto")
):
    return pos_service.update_stock(product_id, payload.QtyDelta, target_node)


@router.get("/{product_id}/price-history", response_model=Dict[str, Any])
def get_product_price_history(
    product_id: int,
    target_node: Optional[str] = Query("auto")
):
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute(
                "SELECT ChangeID, ProductID, OldPrice, NewPrice, TS AS ChangeDate FROM PriceHistory WHERE ProductID = %s ORDER BY ChangeID DESC",
                (product_id,)
            )
            history = cur.fetchall()
            return {"product_id": product_id, "history": history, "node_executed": node_meta}
