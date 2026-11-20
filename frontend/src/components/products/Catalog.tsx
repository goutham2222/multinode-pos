import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, TrendingUp, History, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-md ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <Package className="h-5 w-5 text-emerald-400" />
            <span>Product Catalog & Price Audit Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Total Products: <strong className="text-slate-200">{total}</strong> | Node Target: <strong className="text-emerald-400">{targetNode === 'auto' ? 'Auto Failover' : `Node ${targetNode}`}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(0);
                  loadProducts();
                }
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>
          <button
            onClick={() => {
              setPage(0);
              loadProducts();
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition-colors"
          >
            Filter
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs rounded-lg font-semibold flex items-center space-x-1 shadow-md shadow-emerald-500/20 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Product Name</th>
                <th className="px-4 py-3 text-right">Current Price</th>
                <th className="px-4 py-3 text-center">Stock On Hand</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Querying Galera cluster node...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.ProductID} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-400 font-medium">#{p.ProductID}</td>
                    <td className="px-4 py-3 font-medium text-slate-200">{p.Name}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      ${Number(p.CurrentPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleStockDelta(p.ProductID, -1)}
                          title="Reduce stock by 1"
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                        >
                          -1
                        </button>
                        <span className="font-mono font-semibold text-slate-200 px-1">{p.QtyOnHand}</span>
                        <button
                          onClick={() => handleStockDelta(p.ProductID, +5)}
                          title="Add stock (+5)"
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setPriceUpdateValue(p.CurrentPrice.toString());
                          setShowPriceModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs inline-flex items-center space-x-1 transition-colors"
                      >
                        <Edit2 className="h-3 w-3 text-emerald-400" />
                        <span>Edit Price</span>
                      </button>
                      <button
                        onClick={() => handleViewHistory(p)}
                        className="px-2.5 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded font-medium text-xs inline-flex items-center space-x-1 transition-colors"
                      >
                        <History className="h-3 w-3 text-teal-400" />
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
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {products.length > 0 ? page * limit + 1 : 0} - {Math.min((page + 1) * limit, total)} of {total} products
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              <span>Create New Product</span>
            </h3>
            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Executive Desk"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="299.99"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={newProductQty}
                    onChange={(e) => setNewProductQty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded-lg shadow-md shadow-emerald-500/20"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-2 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span>Update Price (Fires Audit Trigger)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Updating price on <strong className="text-emerald-400">{targetNode === 'auto' ? 'Auto-Failover Node' : `Node ${targetNode}`}</strong> will automatically execute trigger <code className="text-emerald-300">trig_ProductPriceAudit</code>, recording the historical old/new price in the <code className="text-emerald-300">PriceHistory</code> table.
            </p>
            <form onSubmit={handleUpdatePrice} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Product</label>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-medium">
                  #{selectedProduct.ProductID} - {selectedProduct.Name}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Old Price</label>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                    ${Number(selectedProduct.CurrentPrice).toFixed(2)}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">New Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={priceUpdateValue}
                    onChange={(e) => setPriceUpdateValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono font-bold text-emerald-400"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPriceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded-lg shadow-md shadow-emerald-500/20"
                >
                  Update & Fire Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Drawer/Modal */}
      {historyProduct && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <History className="h-5 w-5 text-teal-400" />
                <span>PriceHistory Audit Trail</span>
              </h3>
              <button onClick={() => setHistoryProduct(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Audit log generated by <code className="text-teal-300">trig_ProductPriceAudit</code> for #{historyProduct.ProductID} ({historyProduct.Name}).
            </p>

            {loadingHistory ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-400" />
              </div>
            ) : priceHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No price changes recorded yet for this product.</p>
            ) : (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                {priceHistory.map((h) => (
                  <div key={h.ChangeID} className="p-3 bg-slate-950/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-slate-400">Change #{h.ChangeID}</span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(h.ChangeDate).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="text-slate-400 line-through">${Number(h.OldPrice).toFixed(2)}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-emerald-400 font-bold">${Number(h.NewPrice).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setHistoryProduct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
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
