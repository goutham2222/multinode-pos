import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, History, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product, PriceHistoryItem } from '../../types';
import { api } from '../../services/api';

interface CatalogProps {
  targetNode: string;
}

export const Catalog: React.FC<CatalogProps> = ({ targetNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductQty, setNewProductQty] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceUpdateValue, setPriceUpdateValue] = useState('');
  const [showPriceModal, setShowPriceModal] = useState(false);

  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [page, targetNode]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await api.getProducts({
        search,
        limit,
        offset: page * limit,
        targetNode
      });
      setProducts(res.rows);
      setTotal(res.total);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const price = parseFloat(newProductPrice);
      const qty = parseInt(newProductQty, 10);
      if (!newProductName || isNaN(price) || isNaN(qty)) {
        setNotification({ type: 'error', message: 'Please enter valid product details.' });
        return;
      }

      const res = await api.createProduct({ Name: newProductName, CurrentPrice: price, QtyOnHand: qty }, targetNode);
      setNotification({
        type: 'success',
        message: `Created product #${res.product.ProductID} on ${res.node_executed?.name || 'cluster'}. Replicated to all nodes.`
      });
      setShowAddModal(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductQty('');
      loadProducts();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const newPrice = parseFloat(priceUpdateValue);
      if (isNaN(newPrice) || newPrice <= 0) {
        setNotification({ type: 'error', message: 'Invalid price.' });
        return;
      }

      const res = await api.updateProductPrice(selectedProduct.ProductID, newPrice, targetNode);
      setNotification({
        type: 'success',
        message: `Updated Product #${selectedProduct.ProductID} price to $${newPrice.toFixed(2)}. Trigger 'trig_ProductPriceAudit' logged old price $${res.old_price.toFixed(2)} to PriceHistory.`
      });
      setShowPriceModal(false);
      loadProducts();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleStockDelta = async (productId: number, delta: number) => {
    try {
      const res = await api.updateProductStock(productId, delta, targetNode);
      setNotification({
        type: 'success',
        message: `Stock updated for #${productId}: ${res.old_stock} -> ${res.new_stock} (Executed on ${res.node_executed?.name}).`
      });
      loadProducts();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleViewHistory = async (product: Product) => {
    setHistoryProduct(product);
    setLoadingHistory(true);
    try {
      const res = await api.getProduct(product.ProductID, targetNode);
      setPriceHistory(res.price_history || []);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header & Controls Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Package className="h-5 w-5 text-emerald-600" />
            <span>Product Catalog & Price Auditing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Total Items: <strong className="text-slate-800">{total}</strong> | Active Target: <strong className="text-emerald-700">{targetNode === 'auto' ? 'Auto Failover' : `Node ${targetNode}`}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(0);
                  loadProducts();
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>
          <button
            onClick={() => {
              setPage(0);
              loadProducts();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Filter
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-3.5 text-left">ID</th>
                <th className="px-6 py-3.5 text-left">Product Name</th>
                <th className="px-6 py-3.5 text-right">Current Price</th>
                <th className="px-6 py-3.5 text-center">Stock On Hand</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    Querying Galera node...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.ProductID} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400 font-medium">#{p.ProductID}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{p.Name}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 text-base">
                      ${Number(p.CurrentPrice).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center space-x-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
                        <button
                          onClick={() => handleStockDelta(p.ProductID, -1)}
                          title="Reduce stock by 1"
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold shadow-2xs"
                        >
                          -1
                        </button>
                        <span className="font-mono font-bold text-slate-900 px-1">{p.QtyOnHand}</span>
                        <button
                          onClick={() => handleStockDelta(p.ProductID, +5)}
                          title="Add stock (+5)"
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 text-xs font-bold shadow-2xs"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setPriceUpdateValue(p.CurrentPrice.toString());
                          setShowPriceModal(true);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs inline-flex items-center space-x-1.5 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Edit Price</span>
                      </button>
                      <button
                        onClick={() => handleViewHistory(p)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs inline-flex items-center space-x-1.5 transition-colors"
                      >
                        <History className="h-3.5 w-3.5 text-teal-600" />
                        <span>Audit Log</span>
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
            Showing {products.length > 0 ? page * limit + 1 : 0} - {Math.min((page + 1) * limit, total)} of {total} products
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              <span>Create New Product</span>
            </h3>
            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Executive Desk"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="299.99"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={newProductQty}
                    onChange={(e) => setNewProductQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Insert & Replicate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {showPriceModal && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center space-x-2">
              <Edit2 className="h-5 w-5 text-emerald-600" />
              <span>Update Price (Fires Audit Trigger)</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Updating the price on <strong className="text-emerald-700">{targetNode === 'auto' ? 'Auto-Failover Node' : `Node ${targetNode}`}</strong> executes database trigger <code className="text-emerald-800 font-bold">trig_ProductPriceAudit</code>, recording the historical old/new price in the <code className="text-emerald-800 font-bold">PriceHistory</code> table synchronously.
            </p>
            <form onSubmit={handleUpdatePrice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Product</label>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold">
                  #{selectedProduct.ProductID} — {selectedProduct.Name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Current Price</label>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-mono font-bold">
                    ${Number(selectedProduct.CurrentPrice).toFixed(2)}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">New Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={priceUpdateValue}
                    onChange={(e) => setPriceUpdateValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-emerald-700 font-mono font-extrabold text-base focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPriceModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Update & Fire Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {historyProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <History className="h-5 w-5 text-teal-600" />
                <span>PriceHistory Audit Trail</span>
              </h3>
              <button onClick={() => setHistoryProduct(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Historical records generated by <code className="text-teal-700 font-semibold">trig_ProductPriceAudit</code> for #{historyProduct.ProductID} ({historyProduct.Name}).
            </p>

            {loadingHistory ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" />
              </div>
            ) : priceHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center font-medium">No price changes recorded yet for this product.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {priceHistory.map((h) => (
                  <div key={h.ChangeID} className="p-3 bg-slate-50/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-slate-600 font-bold">Change #{h.ChangeID}</span>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(h.ChangeDate).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="text-slate-400 line-through">${Number(h.OldPrice).toFixed(2)}</span>
                      <span className="text-slate-400 font-bold">→</span>
                      <span className="text-emerald-700 font-bold text-sm">${Number(h.NewPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setHistoryProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
