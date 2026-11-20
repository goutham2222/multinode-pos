import React, { useState, useEffect } from 'react';
import { ShoppingCart, User, Plus, Minus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Product, Customer, Order } from '../../types';
import { api } from '../../services/api';

interface TerminalProps {
  targetNode: string;
}

export const Terminal: React.FC<TerminalProps> = ({ targetNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{ success: boolean; order?: Order; message: string; node?: any } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Load initial products and customers
  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [targetNode]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await api.getProducts({
        search: productSearch,
        limit: 24,
        inStockOnly: true,
        targetNode
      });
      setProducts(res.rows);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.getCustomers(customerSearch, 10, targetNode);
      setCustomers(res.rows);
      if (!selectedCustomer && res.rows.length > 0) {
        // Fetch full customer with tax rate
        const fullCust = await api.getCustomer(res.rows[0].CustomerID, targetNode);
        setSelectedCustomer(fullCust.customer);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSelectCustomer = async (cust: Customer) => {
    try {
      const fullCust = await api.getCustomer(cust.CustomerID, targetNode);
      setSelectedCustomer(fullCust.customer);
    } catch {
      setSelectedCustomer(cust);
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.ProductID === product.ProductID);
      if (existing) {
        return prev.map((item) =>
          item.product.ProductID === product.ProductID
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.ProductID === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.ProductID !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.CurrentPrice * item.quantity, 0);
  const taxRate = selectedCustomer?.TaxRate ?? 0.06;
  const estimatedTax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + estimatedTax;

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setCheckoutError('Please select a customer before checking out.');
      return;
    }
    if (cart.length === 0) {
      setCheckoutError('Cart is empty. Add products to proceed.');
      return;
    }

    setSubmitting(true);
    setCheckoutError(null);
    setCheckoutResult(null);

    try {
      const itemsPayload = cart.map((item) => ({
        ProductID: item.product.ProductID,
        Quantity: item.quantity
      }));

      const res = await api.checkout(selectedCustomer.CustomerID, itemsPayload, targetNode);
      setCheckoutResult({
        success: true,
        order: res.order,
        message: res.message,
        node: res.node_executed
      });
      // Clear cart
      setCart([]);
      // Reload products to show updated stock
      loadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Result Alert */}
      {checkoutResult && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start space-x-3 shadow-lg">
          <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-emerald-200">
              ACID Transaction Committed: Order #{checkoutResult.order?.OrderID}
            </h4>
            <p className="text-xs text-emerald-300/90 mt-1">{checkoutResult.message}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                Subtotal: ${checkoutResult.order?.OrderSubtotal.toFixed(2)}
              </span>
              <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                Sales Tax: ${checkoutResult.order?.SalesTax.toFixed(2)}
              </span>
              <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                Order Total: ${checkoutResult.order?.OrderTotal.toFixed(2)}
              </span>
              <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-400">
                Target Node Executed: {checkoutResult.node?.name} ({checkoutResult.node?.host})
              </span>
            </div>
          </div>
          <button
            onClick={() => setCheckoutResult(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {checkoutError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start space-x-3 shadow-lg">
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-rose-200">Transaction Aborted & Rolled Back</h4>
            <p className="text-xs text-rose-300/90 mt-1">{checkoutError}</p>
            <p className="text-[11px] text-rose-400/80 mt-1">
              Trigger <code>trig_OrderLineInventoryInsert</code> aborted the transaction. Database state rolled back with 0 orphan records.
            </p>
          </div>
          <button
            onClick={() => setCheckoutError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer & Product Catalog */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Customer & Location Tax Lookup</h3>
              </div>
              {selectedCustomer && (
                <span className="text-xs text-slate-400">
                  Zip: <strong className="text-slate-200">{selectedCustomer.Zip}</strong> ({selectedCustomer.CityName}, {selectedCustomer.State})
                </span>
              )}
            </div>

            {/* Customer Search Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search customer by name or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={loadCustomers}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition-colors"
              >
                Search
              </button>
            </div>

            {/* Quick Customer Selection Chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {customers.map((c) => (
                <button
                  key={c.CustomerID}
                  onClick={() => handleSelectCustomer(c)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                    selectedCustomer?.CustomerID === c.CustomerID
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-semibold shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {c.FirstName} {c.LastName} ({c.Zip})
                </button>
              ))}
            </div>

            {selectedCustomer && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Active Customer: <strong className="text-slate-200">{selectedCustomer.FirstName} {selectedCustomer.LastName}</strong> ({selectedCustomer.Email})
                </span>
                <span className="text-emerald-400 font-mono">
                  Applied Sales Tax: {((selectedCustomer.TaxRate ?? 0.06) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {/* Product Catalog Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-100 text-sm">Product Inventory Catalog</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={loadProducts}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition-colors"
                >
                  Filter
                </button>
              </div>
            </div>

            {loadingProducts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-500">No products found matching criteria.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {products.map((p) => (
                  <div
                    key={p.ProductID}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] text-slate-500 font-mono">#{p.ProductID}</span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            p.QtyOnHand > 10
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {p.QtyOnHand} in stock
                        </span>
                      </div>
                      <h4 className="font-medium text-slate-200 text-xs mt-1 line-clamp-2">{p.Name}</h4>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span className="font-bold text-sm text-emerald-400 font-mono">
                        ${Number(p.CurrentPrice).toFixed(2)}
                      </span>
                      <button
                        onClick={() => addToCart(p)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold rounded text-xs flex items-center space-x-1 transition-all"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Checkout Cart */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Checkout Order Cart</h3>
              </div>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} items
              </span>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto my-3 pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Cart is empty. Select products from the catalog to begin checkout.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.ProductID} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-slate-200 line-clamp-1">{item.product.Name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        ${Number(item.product.CurrentPrice).toFixed(2)} each
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center border border-slate-800 rounded bg-slate-950">
                        <button
                          onClick={() => updateQuantity(item.product.ProductID, item.quantity - 1)}
                          className="p-1 hover:text-emerald-400"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-mono text-xs text-slate-200">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.ProductID, item.quantity + 1)}
                          className="p-1 hover:text-emerald-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="font-mono font-semibold text-slate-200 w-16 text-right">
                        ${(item.product.CurrentPrice * item.quantity).toFixed(2)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.ProductID)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Summary */}
            <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-200">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Sales Tax ({(taxRate * 100).toFixed(2)}%):</span>
                <span className="font-mono text-slate-200">${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-100 pt-2 border-t border-slate-800">
                <span>Total Amount:</span>
                <span className="font-mono text-emerald-400 text-base">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className={`w-full mt-4 py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-all ${
                submitting || cart.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.99]'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Committing Transaction...</span>
                </>
              ) : (
                <>
                  <span>Process Transactional Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="mt-3 p-2 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1 text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-semibold">ACID Transaction Isolation</span>
              </div>
              <p>
                Target: <strong className="text-slate-200">{targetNode === 'auto' ? 'Auto-Failover' : `Node ${targetNode}`}</strong>. Enforces triggers <code>trig_OrderLineInventory*</code> and <code>trig_OrderLineSyncTotals*</code> with Galera sync.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
