import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Query, HTTPException
from app.db.pool import db_pool

router = APIRouter(prefix="/analytics", tags=["NoSQL Analytics & Document Views"])


@router.get("/documents/orders", response_model=Dict[str, Any])
def get_order_documents(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    target_node: Optional[str] = Query("auto")
):
    """
    Retrieves hierarchical JSON order documents from the `v_Document_Orders` view.
    Demonstrates MariaDB JSON_OBJECT and JSON_ARRAYAGG denormalization for NoSQL document stores.
    """
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM `v_Document_Orders`")
            total = cur.fetchone()["total"]

            cur.execute(
                "SELECT document_json FROM `v_Document_Orders` ORDER BY order_id DESC LIMIT %s OFFSET %s",
                (limit, offset)
            )
            rows = [json.loads(r["document_json"]) for r in cur.fetchall()]

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "documents": rows,
                "node_executed": node_meta
            }


@router.get("/documents/customers", response_model=Dict[str, Any])
def get_customer_documents(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    target_node: Optional[str] = Query("auto")
):
    """
    Retrieves customer profile documents with embedded lifetime metrics from `v_Document_Customers`.
    """
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM `v_Document_Customers`")
            total = cur.fetchone()["total"]

            cur.execute(
                "SELECT document_json FROM `v_Document_Customers` ORDER BY customer_id ASC LIMIT %s OFFSET %s",
                (limit, offset)
            )
            rows = [json.loads(r["document_json"]) for r in cur.fetchall()]

            return {
                "total": total,
                "limit": limit,
                "offset": offset,
                "documents": rows,
                "node_executed": node_meta
            }


@router.get("/clv-tiers", response_model=Dict[str, Any])
def get_clv_tiers_summary(target_node: Optional[str] = Query("auto")):
    """
    Computes Customer Lifetime Value (CLV) tier segmentation across the entire customer base.
    """
    with db_pool.connection(target_node) as (conn, node_meta):
        with conn.cursor() as cur:
            query = """
            SELECT 
              CASE 
                WHEN spend >= 10000 THEN 'Tier 1: VIP ($10k+)'
                WHEN spend >= 5000 THEN 'Tier 2: Loyal ($5k-$10k)'
                ELSE 'Tier 3: Standard (<$5k)'
              END AS tier,
              COUNT(*) AS customer_count,
              ROUND(SUM(spend), 2) AS total_revenue,
              ROUND(AVG(spend), 2) AS avg_spend,
              ROUND(AVG(order_count), 2) AS avg_orders
            FROM (
              SELECT 
                c.CustomerID,
                COUNT(o.OrderID) AS order_count,
                COALESCE(SUM(o.OrderTotal), 0.00) AS spend
              FROM Customer c
              LEFT JOIN `Order` o ON c.CustomerID = o.CustomerID
              GROUP BY c.CustomerID
            ) customer_spend
            GROUP BY tier
            ORDER BY total_revenue DESC;
            """
            cur.execute(query)
            tiers = list(cur.fetchall())
            return {
                "tiers": tiers,
                "node_executed": node_meta
            }
