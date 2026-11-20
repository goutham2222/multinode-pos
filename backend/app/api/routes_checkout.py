from fastapi import APIRouter
from app.services.pos_service import pos_service
from app.models.schemas import CheckoutRequest, CheckoutSuccessResponse

router = APIRouter(prefix="/checkout", tags=["POS Checkout"])


@router.post("", response_model=CheckoutSuccessResponse)
def execute_checkout(payload: CheckoutRequest):
    """
    Executes an atomic multi-item POS transaction.
    - Locks row records for update
    - Enforces inventory checks through `trig_OrderLineInventoryInsert`
    - Automatically rolls back if inventory is depleted, raising HTTP 400
    - If valid, commits order and line items synchronously across MariaDB Galera
    """
    return pos_service.checkout(payload)
