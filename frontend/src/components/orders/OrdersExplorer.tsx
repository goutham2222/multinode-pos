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
  const [boundParamDetails, setBoundParamDetails] = useState<{ field: string; value: any }[]>([]);

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
      setBoundParamDetails(res.bound_param_details || []);
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Filter Card */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <span>Parameterized Order Filter & Analytics</span>
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Total Orders Matching: <strong className="text-emerald-700">{total}</strong>
          </span>
        </div>

        <form onSubmit={handleApplyFilter} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Customer Name</label>
            <input
              type="text"
              placeholder="e.g. Wilson"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Order Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Shipped">Shipped</option>
              <option value="Processing">Processing / Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Customer ZIP Code</label>
            <input
              type="text"
              placeholder="e.g. 40475"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Placed From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-1">Placed To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="md:col-span-5 flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
            >
              Reset Filters
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs"
            >
              Apply Filter
            </button>
          </div>
        </form>

        {/* Prepared Query Inspector Strip */}
        {executedSql && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
              <div className="flex items-center space-x-2">
                <Code2 className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-slate-800">Dynamic Parameterized Query (Prepared Statement)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                %s placeholders map 1-to-1 positionally from left to right
              </span>
            </div>

            <pre className="text-xs text-slate-700 font-mono overflow-x-auto whitespace-pre-wrap max-h-56 overflow-y-auto bg-white p-3.5 rounded-lg border border-slate-200/80 leading-relaxed">
              {executedSql.trim()}
            </pre>

            <div className="pt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-bold text-slate-700">Bound Parameters:</span>
              {boundParamDetails.length > 0
                ? boundParamDetails.map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center space-x-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg font-mono text-xs shadow-2xs"
                    >
                      <span className="text-emerald-700 font-bold">${i + 1}</span>
                      <span className="text-slate-500 text-[11px] font-semibold">[{item.field}]:</span>
                      <span className="text-slate-900 font-bold">"{String(item.value)}"</span>
                    </span>
                  ))
                : boundParams.map((param, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center space-x-1 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-mono text-emerald-800 font-bold shadow-2xs"
                    >
                      <span>${i + 1}:</span>
                      <span>{String(param)}</span>
                    </span>
                  ))}
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-3.5 text-left">Order ID</th>
                <th className="px-6 py-3.5 text-left">Customer</th>
                <th className="px-6 py-3.5 text-center">ZIP</th>
                <th className="px-6 py-3.5 text-center">Date Placed</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Subtotal</th>
                <th className="px-6 py-3.5 text-right">Sales Tax</th>
                <th className="px-6 py-3.5 text-right">Total</th>
                <th className="px-6 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Querying orders on Galera cluster...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    No orders found matching the filter parameters.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.OrderID} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">#{o.OrderID}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {o.CustomerName}
                      <span className="text-xs text-slate-400 block font-normal">Customer ID: {o.CustomerID}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-500">{(o as any).Zip || '-'}</td>
                    <td className="px-6 py-4 text-center text-slate-600 font-mono">
                      {new Date(o.datePlaced).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          o.OrderStatus === 'Shipped'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {o.OrderStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">
                      ${Number(o.OrderSubtotal).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      ${Number(o.SalesTax).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-extrabold text-emerald-700 text-base">
                      ${Number(o.OrderTotal).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDetails(o.OrderID)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs inline-flex items-center space-x-1"
                      >
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
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
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            Showing {orders.length > 0 ? page * limit + 1 : 0} - {Math.min((page + 1) * limit, total)} of {total} orders
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-lg text-slate-700 font-bold shadow-2xs"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded-lg text-slate-700 font-bold shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span>Order Line Items #{selectedOrderId}</span>
                </h3>
                {orderDetails && (
                  <p className="text-xs text-slate-500 mt-1">
                    Placed: {new Date(orderDetails.datePlaced).toLocaleDateString()} | Customer: {orderDetails.CustomerName} ({orderDetails.CityName}, {orderDetails.State} {orderDetails.Zip})
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedOrderId(null);
                  setOrderDetails(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {loadingDetails || !orderDetails ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                Fetching order items...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-center">Quantity</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {orderDetails.Lines?.map((l: any) => (
                        <tr key={l.ProductID}>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            #{l.ProductID} — {l.ProductName}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">{l.Quantity}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">${Number(l.UnitPrice).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">${Number(l.LineTotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Order Subtotal:</span>
                    <span className="font-mono font-bold text-slate-800">${Number(orderDetails.OrderSubtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Sales Tax (ZIP {orderDetails.Zip}):</span>
                    <span className="font-mono font-bold text-slate-800">${Number(orderDetails.SalesTax).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                    <span>Final Order Total:</span>
                    <span className="font-mono text-emerald-700 text-base">${Number(orderDetails.OrderTotal).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setSelectedOrderId(null);
                      setOrderDetails(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
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
