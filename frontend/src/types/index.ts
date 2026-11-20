export interface Product {
  ProductID: number;
  Name: string;
  CurrentPrice: number;
  QtyOnHand: number;
}

export interface PriceHistoryItem {
  ChangeID: number;
  ProductID: number;
  OldPrice: number;
  NewPrice: number;
  ChangeDate: string;
}

export interface Customer {
  CustomerID: number;
  FirstName: string;
  LastName: string;
  Email: string;
  Address?: string;
  Zip: string;
  CityName?: string;
  State?: string;
  TaxRate?: number;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export interface OrderLine {
  OrderID: number;
  ProductID: number;
  ProductName?: string;
  Quantity: number;
  UnitPrice: number;
  LineTotal: number;
}

export interface Order {
  OrderID: number;
  CustomerID: number;
  CustomerName: string;
  datePlaced: string;
  dateShipped?: string;
  OrderStatus: string;
  OrderSubtotal: number;
  SalesTax: number;
  OrderTotal: number;
  Lines?: OrderLine[];
}

export interface NodeStatus {
  id: number;
  name: string;
  host: string;
  online: boolean;
  cluster_size?: number;
  cluster_status?: string;
  local_state?: string;
  sync_wait?: number;
  ping_ms?: number;
  error?: string;
}

export interface ClusterStatus {
  nodes: NodeStatus[];
  quorum_healthy: boolean;
  cap_mode: string;
  sync_guarantee: string;
}

export interface SqlDemoResult {
  safe_mode: boolean;
  query_template: string;
  bound_parameters?: any[];
  executed_sql: string;
  row_count: number;
  sample_results: any[];
  defense_summary: string;
}
