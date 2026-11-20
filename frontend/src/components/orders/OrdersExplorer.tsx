import React, { useState, useEffect } from 'react';
import { FileText, Eye, Loader2, Code2 } from 'lucide-react';
import { Order } from '../../types';
import { api } from '../../services/api';

interface OrdersExplorerProps {
  targetNode: string;
}

export const OrdersExplorer: React.FC<OrdersExplorerProps> = ({ targetNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 15;
  const [loading, setLoading] = useState(false);

  // Filters
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Parameterized Query Debug State
  const [executedSql, setExecutedSql] = useState('');
  const [boundParams, setBoundParams] = useState<any[]>([]);

  // Selected Order Drawer
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [page, targetNode]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await api.getOrders({
        customerName: customerName || undefined,
        status: status || undefined,
        zipCode: zipCode || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit,
        offset: page * limit,
        targetNode
      });
      setOrders(res.rows);
      setTotal(res.total);
      setExecutedSql(res.parameterized_sql || '');
      setBoundParams(res.bound_params || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadOrders();
  };

  const handleResetFilters = () => {
    setCustomerName('');
    setStatus('');
    setZipCode('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
    setTimeout(loadOrders, 0);
  };

  const handleOpenDetails = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setLoadingDetails(true);
    try {
      const res = await api.getOrderDetails(orderId, targetNode);
      setOrderDetails(res.order);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Filter Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            <span>Parameterized Order Filter & Analytics Explorer</span>
          </h3>
          <span className="text-xs text-slate-400">
            Total Orders Matching: <strong className="text-emerald-400">{total}</strong>
          </span>
        </div>

        <form onSubmit={handleApplyFilter} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="e.g. Wilson"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Shipped">Shipped</option>
              <option value="Processing">Processing / Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Customer Zip Code</label>
            <input
              type="text"
              placeholder="e.g. 40475"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Placed From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Placed To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-5 flex justify-end space-x-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
            >
              Reset Filters
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg text-xs font-semibold shadow-md shadow-emerald-500/20"
            >
              Apply Filter
            </button>
          </div>
        </form>

        {/* Prepared Query Inspector Strip */}
        {executedSql && (
          <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
            <div className="flex items-center space-x-2 text-slate-400 mb-1">
              <Code2 className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Parameterized Prepared Query</span>
            </div>
            <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap line-clamp-2">
              {executedSql.trim()}
            </pre>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-slate-400">
              <span className="text-slate-500 font-semibold">Bound Parameters:</span>
              {boundParams.map((param, i) => (
                <span key={i} className="bg-slate-800 px-1.5 py-0.2 rounded font-mono text-emerald-300">
                  ${i + 1}: {String(param)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 text-left">Order ID</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-center">Zip</th>
                <th className="px-4 py-3 text-center">Date Placed</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Sales Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Querying orders on Galera cluster...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No orders found matching the filter parameters.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.OrderID} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-200">#{o.OrderID}</td>
                    <td className="px-4 py-3 font-medium text-slate-300">
                      {o.CustomerName}
                      <span className="text-[10px] text-slate-500 block">ID: {o.CustomerID}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-400">{(o as any).Zip || '-'}</td>
                    <td className="px-4 py-3 text-center text-slate-300 font-mono">
                      {new Date(o.datePlaced).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          o.OrderStatus === 'Shipped'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {o.OrderStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      ${Number(o.OrderSubtotal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      ${Number(o.SalesTax).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      ${Number(o.OrderTotal).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenDetails(o.OrderID)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs inline-flex items-center space-x-1"
                      >
                        <Eye className="h-3.5 w-3.5 text-emerald-400" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {orders.length > 0 ? page * limit + 1 : 0} - {Math.min((page + 1) * limit, total)} of {total} orders
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200 font-medium"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-emerald-400" />
                  <span>Order Details #{selectedOrderId}</span>
                </h3>
                {orderDetails && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Placed: {new Date(orderDetails.datePlaced).toLocaleDateString()} | Customer: {orderDetails.CustomerName} ({orderDetails.CityName}, {orderDetails.State} {orderDetails.Zip})
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setOrderDetails(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {loadingDetails || !orderDetails ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-400 mb-2" />
                Fetching order line items...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Lines Table */}
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-800">
                    <thead className="bg-slate-950/60 text-slate-400 font-semibold text-[11px]">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-center">Quantity</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {orderDetails.Lines?.map((l: any) => (
                        <tr key={l.ProductID}>
                          <td className="px-3 py-2 text-slate-200">
                            #{l.ProductID} - {l.ProductName}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-slate-300">{l.Quantity}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300">${Number(l.UnitPrice).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-400">${Number(l.LineTotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Order Subtotal:</span>
                    <span className="font-mono text-slate-200">${Number(orderDetails.OrderSubtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sales Tax (Zip {orderDetails.Zip}):</span>
                    <span className="font-mono text-slate-200">${Number(orderDetails.SalesTax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-100 pt-1.5 border-t border-slate-800">
                    <span>Final Order Total:</span>
                    <span className="font-mono text-emerald-400">${Number(orderDetails.OrderTotal).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setSelectedOrderId(null);
                      setOrderDetails(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
