from typing import List, Optional, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field, EmailStr


class ProductBase(BaseModel):
    Name: str = Field(..., max_length=255)
    CurrentPrice: float = Field(..., gt=0)
    QtyOnHand: int = Field(..., ge=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    CurrentPrice: Optional[float] = Field(None, gt=0)
    QtyOnHand: Optional[int] = Field(None, ge=0)


class ProductPriceUpdate(BaseModel):
    CurrentPrice: float = Field(..., gt=0)


class ProductStockUpdate(BaseModel):
    QtyDelta: int = Field(..., description="Positive to add stock, negative to reduce")


class PriceHistoryItem(BaseModel):
    ChangeID: int
    ProductID: int
    OldPrice: float
    NewPrice: float
    ChangeDate: datetime


class ProductResponse(ProductBase):
    ProductID: int


class CustomerBase(BaseModel):
    FirstName: str = Field(..., max_length=50)
    LastName: str = Field(..., max_length=50)
    Email: EmailStr
    Address: Optional[str] = Field(None, max_length=255)
    CityID: Optional[int] = None
    Zip: Optional[str] = Field(None, max_length=10)


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    CustomerID: int
    CityName: Optional[str] = None
    State: Optional[str] = None


class OrderItemInput(BaseModel):
    ProductID: int = Field(..., gt=0)
    Quantity: int = Field(..., gt=0)


class CheckoutRequest(BaseModel):
    CustomerID: int = Field(..., gt=0)
    Items: List[OrderItemInput] = Field(..., min_length=1)
    TargetNode: Optional[str] = Field("auto", description="1, 2, 3, or 'auto'")


class OrderLineResponse(BaseModel):
    OrderID: int
    ProductID: int
    ProductName: Optional[str] = None
    Quantity: int
    UnitPrice: float
    LineTotal: float


class OrderResponse(BaseModel):
    OrderID: int
    CustomerID: int
    CustomerName: Optional[str] = None
    DatePlaced: datetime
    DateShipped: Optional[datetime] = None
    OrderStatus: str
    OrderSubtotal: float
    SalesTax: float
    OrderTotal: float
    Lines: Optional[List[OrderLineResponse]] = None


class CheckoutSuccessResponse(BaseModel):
    success: bool = True
    order: OrderResponse
    node_executed: Dict[str, Any]
    message: str


class NodeStatus(BaseModel):
    id: int
    name: str
    host: str
    online: bool
    cluster_size: Optional[int] = None
    cluster_status: Optional[str] = None
    local_state: Optional[str] = None
    sync_wait: Optional[int] = None
    ping_ms: Optional[float] = None
    error: Optional[str] = None


class ClusterStatusResponse(BaseModel):
    nodes: List[NodeStatus]
    quorum_healthy: bool
    cap_mode: str = "CP (Consistent & Partition Tolerant via Galera wsrep_sync_wait=7)"
    sync_guarantee: str = "Strict causal consistency on all nodes (reads wait for commit queue flush)"


class SqlDemoRequest(BaseModel):
    search_term: str
    use_prepared_statement: bool = True
    target_node: Optional[str] = "auto"


class SqlDemoResponse(BaseModel):
    safe_mode: bool
    query_template: str
    bound_parameters: Optional[List[Any]] = None
    executed_sql: str
    row_count: int
    sample_results: List[Dict[str, Any]]
    defense_summary: str
