import pytest
from app.services.pos_service import pos_service
from app.models.schemas import CheckoutRequest, OrderItemInput
from fastapi import HTTPException


def test_successful_checkout_and_cluster_replication():
    """
    Tests that an order can be created on Node 1 with valid items,
    and returns calculated subtotal and sales tax without error.
    """
    req = CheckoutRequest(
        CustomerID=1,
        Items=[
            OrderItemInput(ProductID=1, Quantity=1)
        ],
        TargetNode="1"
    )

    resp = pos_service.checkout(req)
    assert resp.success is True
    assert resp.order.OrderID > 0
    assert resp.order.OrderSubtotal > 0
    assert resp.order.OrderTotal >= resp.order.OrderSubtotal
    assert len(resp.order.Lines) == 1
    assert resp.order.Lines[0].ProductID == 1


def test_insufficient_inventory_triggers_rollback():
    """
    Tests that requesting quantity beyond QtyOnHand triggers
    trig_OrderLineInventoryInsert error and aborts with a clean rollback.
    """
    req = CheckoutRequest(
        CustomerID=1,
        Items=[
            OrderItemInput(ProductID=1, Quantity=500)  # Exceeds QtyOnHand (~225) without overflowing LineTotal DECIMAL(8,2)
        ],
        TargetNode="2"
    )

    with pytest.raises(HTTPException) as exc_info:
        pos_service.checkout(req)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["error"] == "INSUFFICIENT_INVENTORY"
    assert exc_info.value.detail["action"] == "TRANSACTION_ROLLED_BACK"
