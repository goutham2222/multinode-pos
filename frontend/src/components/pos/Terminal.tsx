import React, { useState, useEffect } from 'react';
import { ShoppingCart, User, Plus, Minus, Trash2, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Search, MapPin } from 'lucide-react';
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

  useEffect(() => {
    loadProducts();
    loadCustomers(false);
  }, [targetNode]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await api.getProducts({
        search: productSearch,
        limit: 18,
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

  const loadCustomers = async (autoSelect = false) => {
    try {
      const res = await api.getCustomers(customerSearch, 20, targetNode);
      setCustomers(res.rows);
      if (res.rows.length > 0 && (autoSelect || !selectedCustomer)) {
        await handleSelectCustomer(res.rows[0].CustomerID);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSelectCustomer = async (customerId: number) => {
    try {
      const fullCust = await api.getCustomer(customerId, targetNode);
      const cust = fullCust.customer;
      cust.TaxRate = parseFloat(cust.TaxRate as any) || 0.06;
      setSelectedCustomer(cust);
    } catch {
      const found = customers.find(c => c.CustomerID === customerId);
      if (found) {
        setSelectedCustomer({
          ...found,
          TaxRate: parseFloat(found.TaxRate as any) || 0.06
        });
      }
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

  const subtotal = cart.reduce((sum, item) => sum + item.product.CurrentPrice * item.quantity, 0);
  const taxRate = selectedCustomer?.TaxRate ? Number(selectedCustomer.TaxRate) : 0.06;
  const estimatedTax = Math.round(subtotal * taxRate * 100) / 100;
  const total = subtotal + estimatedTax;

  // Ensure selectedCustomer is included in the dropdown options
  const displayedCustomers = [...customers];
  if (selectedCustomer && !displayedCustomers.some(c => c.CustomerID === selectedCustomer.CustomerID)) {
    displayedCustomers.unshift(selectedCustomer);
  }

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
      setCart([]);
      loadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Success Notification Alert */}
      {checkoutResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm flex items-start space-x-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-emerald-900">
              ACID Transaction Committed: Order #{checkoutResult.order?.OrderID}
            </h4>
            <p className="text-sm text-emerald-700 mt-1">{checkoutResult.message}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="bg-white px-3 py-1 rounded-lg border border-emerald-200 text-slate-700 font-semibold shadow-xs">
                Subtotal: ${checkoutResult.order?.OrderSubtotal.toFixed(2)}
              </span>
              <span className="bg-white px-3 py-1 rounded-lg border border-emerald-200 text-slate-700 font-semibold shadow-xs">
                Sales Tax: ${checkoutResult.order?.SalesTax.toFixed(2)}
              </span>
              <span className="bg-emerald-600 px-3 py-1 rounded-lg text-white font-bold shadow-xs">
                Order Total: ${checkoutResult.order?.OrderTotal.toFixed(2)}
              </span>
              <span className="bg-white px-3 py-1 rounded-lg border border-emerald-200 text-emerald-800 font-bold shadow-xs">
                Executed on: {checkoutResult.node?.name} ({checkoutResult.node?.host})
              </span>
            </div>
          </div>
          <button
            onClick={() => setCheckoutResult(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error / Rollback Alert */}
      {checkoutError && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm flex items-start space-x-4">
          <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-base text-rose-900">Transaction Aborted & Rolled Back</h4>
            <p className="text-sm text-rose-700 mt-1">{checkoutError}</p>
            <p className="text-xs text-rose-600 mt-2 font-medium">
              Database trigger <code>trig_OrderLineInventoryInsert</code> aborted the execution due to stock constraint. Rollback complete with 0 orphan records.
            </p>
          </div>
          <button
            onClick={() => setCheckoutError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Two Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Customer Selector & Products Grid */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Customer & Tax Rate</h3>
                  <p className="text-xs text-slate-500">Automatic municipal tax calculation from customer ZIP</p>
                </div>
              </div>
            </div>

            {/* Clean Dropdown Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Customer</label>
                <select
                  value={selectedCustomer?.CustomerID !== undefined ? selectedCustomer.CustomerID : ''}
                  onChange={(e) => handleSelectCustomer(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  {displayedCustomers.map((c) => (
                    <option key={c.CustomerID} value={c.CustomerID}>
                      {c.FirstName} {c.LastName} — {c.Email} (ZIP {c.Zip})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Search Customer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search name..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCustomers(true)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => loadCustomers(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
                  >
                    Find
                  </button>
                  {customerSearch && (
                    <button
                      onClick={() => {
                        setCustomerSearch('');
                        setTimeout(() => loadCustomers(false), 0);
                      }}
                      className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors"
                      title="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Customer Info Strip */}
            {selectedCustomer && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>
                    <strong>{selectedCustomer.FirstName} {selectedCustomer.LastName}</strong> — {selectedCustomer.Address || 'No Address'}, {selectedCustomer.CityName}, {selectedCustomer.State} {selectedCustomer.Zip}
                  </span>
                </div>
                <div className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
                  Tax Rate: {((selectedCustomer.TaxRate ?? 0.06) * 100).toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          {/* Product Catalog Grid */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Product Catalog</h3>
                <p className="text-xs text-slate-500">Live inventory synchronized across Galera cluster</p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
                    className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-56"
                  />
                </div>
                <button
                  onClick={loadProducts}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Filter
                </button>
              </div>
            </div>

            {loadingProducts ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-center py-12 text-sm text-slate-400">No products found matching search.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {products.map((p) => (
                  <div
                    key={p.ProductID}
                    className="p-4 bg-white border border-slate-200/80 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono text-slate-400">#{p.ProductID}</span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            p.QtyOnHand > 10
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}
                        >
                          {p.QtyOnHand} in stock
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-sm line-clamp-2">{p.Name}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-extrabold text-base text-emerald-600 font-mono">
                        ${Number(p.CurrentPrice).toFixed(2)}
                      </span>
                      <button
                        onClick={() => addToCart(p)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1 transition-all shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Clean Modern Receipt Cart */}
        <div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs sticky top-24">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Current Cart</h3>
              </div>
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} items
              </span>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto my-4 pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  Cart is empty. Select products from the catalog to build an order.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.ProductID} className="py-3 flex items-center justify-between text-sm">
                    <div className="flex-1 pr-3">
                      <div className="font-semibold text-slate-800 line-clamp-1">{item.product.Name}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        ${Number(item.product.CurrentPrice).toFixed(2)} / unit
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                        <button
                          onClick={() => updateQuantity(item.product.ProductID, item.quantity - 1)}
                          className="px-2 py-1 text-slate-600 hover:text-slate-900 font-bold"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-mono text-xs font-bold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.ProductID, item.quantity + 1)}
                          className="px-2 py-1 text-slate-600 hover:text-slate-900 font-bold"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <span className="font-mono font-bold text-slate-900 w-18 text-right">
                        ${(item.product.CurrentPrice * item.quantity).toFixed(2)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.ProductID)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2.5 pt-4 border-t border-slate-100 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Sales Tax ({(taxRate * 100).toFixed(2)}%)</span>
                <span className="font-mono font-semibold text-slate-800">${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-slate-900 pt-3 border-t border-slate-100">
                <span>Total Due</span>
                <span className="font-mono text-emerald-600 text-xl font-bold">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Transaction Button */}
            <button
              onClick={handleCheckout}
              disabled={submitting || cart.length === 0}
              className={`w-full mt-6 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                submitting || cart.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99]'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Committing Transaction...</span>
                </>
              ) : (
                <>
                  <span>Process Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700">Target Execution:</div>
              <p>
                Query targets <strong className="text-emerald-700">{targetNode === 'auto' ? 'Auto-Failover Node' : `Node ${targetNode}`}</strong>. Triggers manage stock controls and subtotal sync automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
