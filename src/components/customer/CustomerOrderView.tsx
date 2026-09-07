import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Product, Category, CafeSettings, CartItem } from '../../types';
import { posStorage } from '../../services/storage';
import { apiSync } from '../../services/apiSync';
import { posSound } from '../../services/sound';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Phone,
  User,
  FileText,
  AlertCircle,
  Coffee,
  RotateCcw,
  LayoutGrid,
  List,
} from 'lucide-react';

interface CustomerOrderViewProps {
  tableNumber: string;
  categories: Category[];
  products: Product[];
  settings: CafeSettings;
  onBackToStaff?: () => void;
}

export const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({
  tableNumber,
  categories = [],
  products = [],
  settings,
  onBackToStaff,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [cookingNotes, setCookingNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedOrderInfo, setSubmittedOrderInfo] = useState<{
    holdNumber: number;
    heldAt: string;
    items: CartItem[];
    subtotal: number;
    taxAmount: number;
  } | null>(null);

  useEffect(() => {
    // Force sync latest products & categories from Supabase database when customer scans QR code
    apiSync.syncState();
  }, []);

  // Filter products by category and search query
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isAvailable) return false;
      if (selectedCategory !== 'ALL' && p.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice }];
    });
    posSound.playItemAdd();
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
    if (delta > 0) posSound.playQtyChange();
    else posSound.playDelete();
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cartItems]);

  const taxRate = settings.taxRate || 5;
  const taxAmount = useMemo(() => {
    if (settings.isTaxInclusive) {
      return subtotal - subtotal / (1 + taxRate / 100);
    }
    return (subtotal * taxRate) / 100;
  }, [subtotal, taxRate, settings.isTaxInclusive]);

  const grandTotal = useMemo(() => {
    return settings.isTaxInclusive ? subtotal : subtotal + taxAmount;
  }, [subtotal, taxAmount, settings.isTaxInclusive]);

  const totalItemCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Submit order to POS Held Orders queue
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    try {
      const { order, heldOrder: newHeld } = await apiSync.submitTableQrOrder({
        tableNumber: tableNumber || 'T-01',
        customerName: `Table ${tableNumber || 'T-01'}`,
        notes: cookingNotes.trim() ? cookingNotes.trim() : undefined,
        items: cartItems,
        subtotal: subtotal,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
      });

      // Play success audio
      posSound.playSuccess();

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}

      // Store submitted summary for confirmation view
      setSubmittedOrderInfo({
        holdNumber: newHeld.holdNumber,
        heldAt: newHeld.heldAt || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: [...cartItems],
        subtotal,
        taxAmount,
        grandTotal,
      });

      // Clear cart
      setCartItems([]);
      setIsCartDrawerOpen(false);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to submit table order:', err);
      alert('Unable to place order. Please check with cafe staff.');
    }
  };

  // If order was successfully submitted, render Order Confirmation screen
  if (isSubmitted && submittedOrderInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          {/* Top Banner */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-xs rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/30">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-xs text-[11px] font-mono font-bold rounded-full uppercase tracking-wider mb-2">
              TABLE {tableNumber} • DINE-IN
            </span>
            <h2 className="text-xl font-extrabold tracking-tight">
              Order Sent to Staff!
            </h2>
            <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto">
              Your order has arrived in the review queue. Our team is preparing it for your table.
            </p>
          </div>

          {/* Ticket Information */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Held Ticket Ref
                </span>
                <span className="text-base font-mono font-extrabold text-slate-900">
                  #HOLD-{submittedOrderInfo.holdNumber}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Time Sent
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  {submittedOrderInfo.heldAt}
                </span>
              </div>
            </div>

            {/* Ordered Items Summary */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Order Summary
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                {submittedOrderInfo.items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-white">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center">
                        {item.quantity}x
                      </span>
                      <span className="font-medium text-slate-800 truncate max-w-[180px]">
                        {item.product.name}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      {settings.currencySymbol}{(item.unitPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Cost Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-mono">{settings.currencySymbol}{submittedOrderInfo.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST / Tax ({taxRate}%)</span>
                <span className="font-mono">{settings.currencySymbol}{submittedOrderInfo.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-dashed border-slate-200">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-700">
                  {settings.currencySymbol}{submittedOrderInfo.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
              <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Please remain seated at <strong>Table {tableNumber}</strong>. Payment can be settled directly with your server or at the main counter when leaving.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setSubmittedOrderInfo(null);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Order Additional Items</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans select-none pb-28">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.cafeName}
                className="w-9 h-9 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                <Coffee className="w-5 h-5" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
                {settings.cafeName}
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Digital Dine-In Menu</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Table Badge */}
            <div className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-mono font-extrabold tracking-wider shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TABLE {tableNumber}</span>
            </div>

            {onBackToStaff && (
              <button
                type="button"
                onClick={onBackToStaff}
                className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-colors"
                title="Switch back to POS terminal"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Staff POS</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & View Toggle */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coffee, drinks, dishes..."
              className="w-full text-xs pl-9 pr-8 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-blue-600 rounded-xl outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${
                viewMode === 'GRID'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold ${
                viewMode === 'LIST'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Category Pills Scroller */}
        <div className="border-t border-slate-100 bg-white">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Menu Grid / List */}
      <main className="max-w-4xl mx-auto w-full p-4 flex-1">
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No matching items</h3>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your category filter or search keywords.
            </p>
          </div>
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {filteredProducts.map((product) => {
              const inCart = cartItems.find((ci) => ci.product.id === product.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col hover:border-slate-300 transition-all"
                >
                  {/* Item Image */}
                  <div className="relative h-36 bg-slate-100 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />

                    {product.isFeatured && (
                      <span className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                        Chef's Choice
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {product.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {product.description || 'Deliciously handcrafted freshly for you.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
                      <div>
                        <span className="text-sm font-mono font-extrabold text-slate-900">
                          {settings.currencySymbol}{product.sellingPrice.toFixed(2)}
                        </span>
                      </div>

                      {/* Add or Stepper Button */}
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(product)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ADD</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2 py-1 rounded-xl shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, -1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-xs">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, 1)}
                            className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-2.5">
            {filteredProducts.map((product) => {
              const inCart = cartItems.find((ci) => ci.product.id === product.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Thumbnail Image */}
                    <div className="relative w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {product.isFeatured && (
                        <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                          Chef's
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
                            product.isVeg ? 'border-emerald-600 bg-emerald-500' : 'border-rose-600 bg-rose-500'
                          }`}
                          title={product.isVeg ? 'Veg' : 'Non-Veg'}
                        />
                        <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                          {product.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 leading-relaxed">
                        {product.description || 'Deliciously handcrafted freshly for you.'}
                      </p>
                      <div className="mt-1.5">
                        <span className="text-xs font-mono font-extrabold text-slate-900">
                          {settings.currencySymbol}{product.sellingPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Add / Stepper */}
                  <div className="shrink-0">
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2 py-1 rounded-xl shadow-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(product.id, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-xs">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(product.id, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-2xl border border-slate-800 flex items-center justify-between">
              <div
                onClick={() => setIsCartDrawerOpen(true)}
                className="cursor-pointer flex items-center gap-2.5 pl-1"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-mono font-bold text-slate-300 block">
                    {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                  </span>
                  <span className="text-sm font-mono font-extrabold text-white">
                    {settings.currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(true)}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
              >
                <span>Review Order</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer / Slide-over Modal */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 duration-200">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Your Table Order
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Table {tableNumber} • Dine-In
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Selected Items ({totalItemCount})
                </span>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 flex items-center justify-between bg-white text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                        />
                        <div>
                          <h4 className="font-bold text-slate-900">{item.product.name}</h4>
                          <span className="text-[11px] font-mono text-slate-500">
                            {settings.currencySymbol}{item.unitPrice.toFixed(2)} each
                          </span>
                        </div>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Requests Form */}
              <form id="customer-order-form" onSubmit={handleSubmitOrder} className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cooking Instructions / Special Requests</span>
                  </label>
                  <textarea
                    rows={2}
                    value={cookingNotes}
                    onChange={(e) => setCookingNotes(e.target.value)}
                    placeholder="e.g. Less sugar in latte, Extra spicy burger, Serve drinks first..."
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 outline-none resize-none"
                  />
                </div>

                {/* Bill Summary */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs font-medium">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{settings.currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Estimated GST / Tax ({taxRate}%)</span>
                    <span className="font-mono">{settings.currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                    <span>Estimated Total</span>
                    <span className="font-mono text-blue-600">
                      {settings.currencySymbol}{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 flex items-start gap-2 text-[11px] text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Tapping "Send Order" places this directly in the cafe's <strong>Held Orders</strong> queue for the kitchen & cashier to review.
                  </span>
                </div>
              </form>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <button
                type="submit"
                form="customer-order-form"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <span>Send Order to Kitchen (Table {tableNumber})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
