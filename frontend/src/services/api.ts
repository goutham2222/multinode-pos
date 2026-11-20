import { ClusterStatus, Product, Customer, Order, SqlDemoResult } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof errorBody.detail === 'object' 
      ? JSON.stringify(errorBody.detail) 
      : errorBody.detail || 'API request failed';
    throw new Error(msg);
  }

  return res.json();
}

export const api = {
  getClusterStatus: async (): Promise<ClusterStatus> => {
    return fetchJson<ClusterStatus>(`${API_BASE}/cluster/status`);
  },

  getProducts: async (params?: {
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    limit?: number;
    offset?: number;
    targetNode?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.minPrice !== undefined) q.set('min_price', params.minPrice.toString());
    if (params?.maxPrice !== undefined) q.set('max_price', params.maxPrice.toString());
    if (params?.inStockOnly) q.set('in_stock_only', 'true');
    if (params?.limit) q.set('limit', params.limit.toString());
    if (params?.offset) q.set('offset', params.offset.toString());
    if (params?.targetNode) q.set('target_node', params.targetNode);

    return fetchJson<{ total: number; rows: Product[]; node_executed: any }>(
      `${API_BASE}/products?${q.toString()}`
    );
  },

  getProduct: async (id: number, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ product: Product; price_history: any[]; node_executed: any }>(
      `${API_BASE}/products/${id}${q}`
    );
  },

  createProduct: async (product: { Name: string; CurrentPrice: number; QtyOnHand: number }, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ success: boolean; product: Product; node_executed: any }>(
      `${API_BASE}/products${q}`,
      {
        method: 'POST',
        body: JSON.stringify(product)
      }
    );
  },

  updateProductPrice: async (id: number, newPrice: number, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ success: boolean; product_id: number; old_price: number; new_price: number; audit_logged: boolean; audit_record: any; node_executed: any }>(
      `${API_BASE}/products/${id}/price${q}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ CurrentPrice: newPrice })
      }
    );
  },

  updateProductStock: async (id: number, delta: number, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ success: boolean; product_id: number; old_stock: number; new_stock: number; delta: number; node_executed: any }>(
      `${API_BASE}/products/${id}/stock${q}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ QtyDelta: delta })
      }
    );
  },

  getCustomers: async (search?: string, limit = 50, targetNode?: string) => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    q.set('limit', limit.toString());
    if (targetNode) q.set('target_node', targetNode);

    return fetchJson<{ total: number; rows: Customer[]; node_executed: any }>(
      `${API_BASE}/customers?${q.toString()}`
    );
  },

  getCustomer: async (id: number, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ customer: Customer; stats: any; node_executed: any }>(
      `${API_BASE}/customers/${id}${q}`
    );
  },

  getOrders: async (params?: {
    customerId?: number;
    customerName?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    zipCode?: string;
    limit?: number;
    offset?: number;
    targetNode?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.customerId) q.set('customer_id', params.customerId.toString());
    if (params?.customerName) q.set('customer_name', params.customerName);
    if (params?.status) q.set('status', params.status);
    if (params?.dateFrom) q.set('date_from', params.dateFrom);
    if (params?.dateTo) q.set('date_to', params.dateTo);
    if (params?.zipCode) q.set('zip_code', params.zipCode);
    if (params?.limit) q.set('limit', params.limit.toString());
    if (params?.offset) q.set('offset', params.offset.toString());
    if (params?.targetNode) q.set('target_node', params.targetNode);

    return fetchJson<{
      total: number;
      rows: Order[];
      node_executed: any;
      parameterized_sql: string;
      bound_params: any[];
      bound_param_details?: { field: string; value: any }[];
    }>(
      `${API_BASE}/orders?${q.toString()}`
    );
  },

  getOrderDetails: async (orderId: number, targetNode?: string) => {
    const q = targetNode ? `?target_node=${targetNode}` : '';
    return fetchJson<{ order: Order; node_executed: any }>(
      `${API_BASE}/orders/${orderId}${q}`
    );
  },

  checkout: async (customerId: number, items: { ProductID: number; Quantity: number }[], targetNode?: string) => {
    return fetchJson<{ success: boolean; order: Order; node_executed: any; message: string }>(
      `${API_BASE}/checkout`,
      {
        method: 'POST',
        body: JSON.stringify({
          CustomerID: customerId,
          Items: items,
          TargetNode: targetNode || 'auto'
        })
      }
    );
  },

  runSqlDemo: async (searchTerm: string, usePrepared: boolean, targetNode?: string) => {
    return fetchJson<SqlDemoResult>(
      `${API_BASE}/sql-demo/execute`,
      {
        method: 'POST',
        body: JSON.stringify({
          search_term: searchTerm,
          use_prepared_statement: usePrepared,
          target_node: targetNode || 'auto'
        })
      }
    );
  }
};
