from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.query_service import query_service

router = APIRouter(prefix="/orders", tags=["Orders & Historical Transactions"])


@router.get("", response_model=Dict[str, Any])
def list_orders(
    customer_id: Optional[int] = Query(None, description="Filter by customer ID"),
    customer_name: Optional[str] = Query(None, description="Search by customer name"),
    status: Optional[str] = Query(None, description="'shipped' or 'processing'"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD start date"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD end date"),
    zip_code: Optional[str] = Query(None, description="Filter by customer Zip"),
    min_total: Optional[float] = Query(None, description="Minimum order total"),
    max_total: Optional[float] = Query(None, description="Maximum order total"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    target_node: Optional[str] = Query("auto", description="1, 2, 3, or auto")
):
    """
    Retrieves historical orders using parameterized SQL query builder.
    """
    return query_service.filter_orders(
        customer_id=customer_id,
        customer_name=customer_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
        zip_code=zip_code,
        min_total=min_total,
        max_total=max_total,
        limit=limit,
        offset=offset,
        target_node=target_node
    )


@router.get("/{order_id}", response_model=Dict[str, Any])
def get_order_details(
    order_id: int,
    target_node: Optional[str] = Query("auto")
):
    return query_service.get_order_details(order_id, target_node)
