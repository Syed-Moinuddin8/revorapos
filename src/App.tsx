import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  Category,
  Order,
  Customer,
  HeldOrder,
  User,
  CafeSettings,
  CartItem,
  OrderType,
  PaymentMethod,
  PaymentDetails,
} from './types';
import { posStorage } from './services/storage';
import { posSound } from './services/sound';
import { HeaderNav } from './components/pos/HeaderNav';
import { CategorySidebar } from './components/pos/CategorySidebar';
import { ProductCatalog } from './components/pos/ProductCatalog';
import { CurrentCart } from './components/pos/CurrentCart';
import { CheckoutModal } from './components/pos/CheckoutModal';
import { ReceiptModal } from './components/pos/ReceiptModal';
import { OrderHistoryView } from './components/orders/OrderHistoryView';
import { SalesDashboard } from './components/analytics/SalesDashboard';
import { SalesReportsView } from './components/reports/SalesReportsView';
import { ProductManagementView } from './components/products/ProductManagementView';
import { SettingsView } from './components/settings/SettingsView';
import { HeldOrdersModal } from './components/modals/HeldOrdersModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { PinAuthModal } from './components/modals/PinAuthModal';
import { TableQRModal } from './components/modals/TableQRModal';
import { CustomerOrderView } from './components/customer/CustomerOrderView';
import { KitchenDisplayView } from './components/kitchen/KitchenDisplayView';
import { LoginDashboard } from './components/auth/LoginDashboard';
import { QrCode, ArrowRight, X, CheckCircle2, ShoppingBag } from 'lucide-react';
import { apiSync } from './services/apiSync';

export const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('pos');

  // Core Data loaded from storage
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => posStorage.getCurrentUser());
  const [settings, setSettings] = useState<CafeSettings>(() => posStorage.getSettings());

  // Toast feedback state
  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type?: 'success' | 'info';
  } | null>(null);

  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // POS State
  const [isNavOpen, setIsNavOpen] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat_all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState<string>('T-01');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  // Modals State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [isNewReceiptCompletion, setIsNewReceiptCompletion] = useState(false);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [pinAuthModal, setPinAuthModal] = useState<{
    isOpen: boolean;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    description: '',
    onSuccess: () => {},
  });

  // Table QR & Customer Self-Ordering state
  const [customerTable, setCustomerTable] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const tableParam = searchParams.get('table');
    if (tableParam) return tableParam;
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
      return hashParams.get('table');
    }
    return null;
  });
  const [isTableQRModalOpen, setIsTableQRModalOpen] = useState(false);
  const [qrModalTable, setQrModalTable] = useState<string>('T-01');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Real-time table order notification popup banner
  const [activeTableOrderNotification, setActiveTableOrderNotification] = useState<{
    order: Order;
    heldOrder: HeldOrder;
  } | null>(null);

  // Reload data from local storage
  const loadData = useCallback(() => {
    setProducts(posStorage.getProducts());
    setCategories(posStorage.getCategories());
    setOrders(posStorage.getOrders());
    setCustomers(posStorage.getCustomers());
    setHeldOrders(posStorage.getHeldOrders());
    setUsers(posStorage.getUsers());
    const storedSettings = posStorage.getSettings();
    setSettings(storedSettings);
    posSound.setEnabled(storedSettings.enableSound);

    // Retrieve active logged in user from storage if available
    const activeStoredUser = posStorage.getCurrentUser();
    if (activeStoredUser) {
      setCurrentUser(activeStoredUser);
    }
  }, []);

  useEffect(() => {
    loadData();
    apiSync.syncState().then(() => {
      loadData();
    });
  }, [loadData]);

  // Real-time synchronization for customer QR orders across tabs & devices
  useEffect(() => {
    const handleOrderHeld = (e: any) => {
      setHeldOrders(posStorage.getHeldOrders());
      setOrders(posStorage.getOrders());
      posSound.playNotification();
      if (e?.detail && e.detail.source === 'CUSTOMER_QR') {
        setActiveTableOrderNotification({
          order: e.detail,
          heldOrder: e.detail,
        });
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key.includes('held_orders') ||
        e.key.includes('orders')
      ) {
        setHeldOrders(posStorage.getHeldOrders());
        setOrders(posStorage.getOrders());
      }
      if (
        !e.key ||
        e.key.includes('products') ||
        e.key.includes('categories') ||
        e.key.includes('settings')
      ) {
        setProducts(posStorage.getProducts());
        setCategories(posStorage.getCategories());
        setSettings(posStorage.getSettings());
      }
    };

    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tbl = searchParams.get('table');
      setCustomerTable(tbl);
    };

    const handleHeldOrderUpdated = () => {
      setHeldOrders(posStorage.getHeldOrders());
    };

    const handleMenuUpdated = () => {
      setProducts(posStorage.getProducts());
      setCategories(posStorage.getCategories());
      setSettings(posStorage.getSettings());
    };

    window.addEventListener('pos_order_held', handleOrderHeld);
    window.addEventListener('pos_held_order_updated', handleHeldOrderUpdated);
    window.addEventListener('pos_menu_updated', handleMenuUpdated);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('popstate', handlePopState);

    // Server-Sent Events real-time sync across devices
    apiSync.startListening(
      (newOrder, newHeld) => {
        setOrders(posStorage.getOrders());
        setHeldOrders(posStorage.getHeldOrders());
        setActiveTableOrderNotification({ order: newOrder, heldOrder: newHeld });
        posSound.playNotification();
      },
      (syncedOrders, syncedHeldOrders) => {
        setOrders(syncedOrders);
        setHeldOrders(syncedHeldOrders);
        setProducts(posStorage.getProducts());
        setCategories(posStorage.getCategories());
        setSettings(posStorage.getSettings());
      }
    );

    return () => {
      window.removeEventListener('pos_order_held', handleOrderHeld);
      window.removeEventListener('pos_held_order_updated', handleHeldOrderUpdated);
      window.removeEventListener('pos_menu_updated', handleMenuUpdated);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('popstate', handlePopState);
      apiSync.stopListening();
    };
  }, []);

  const pendingTableQrCount = useMemo(() => {
    return heldOrders.filter((h) => h.source === 'CUSTOMER_QR').length;
  }, [heldOrders]);

  useEffect(() => {
    if (currentUser?.role === 'STAFF') {
      const allowedStaffTabs = ['pos', 'kitchen', 'orders', 'products'];
      if (!allowedStaffTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [currentUser?.role, activeTab]);

  // Cart financial computations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if ((Number(discountValue) || 0) <= 0) return 0;
    const sub = Number(subtotal) || 0;
    if (discountType === 'PERCENT') {
      return Number(((sub * (Number(discountValue) || 0)) / 100).toFixed(2));
    }
    return Math.min(sub, Number(discountValue) || 0);
  }, [subtotal, discountType, discountValue]);

  const taxAmount = useMemo(() => {
    if (!settings) return 0;
    const sub = Number(subtotal) || 0;
    const disc = Number(discountAmount) || 0;
    const rate = Number(settings.taxRate) || 0;
    const taxable = Math.max(0, sub - disc);
    return Number(((taxable * rate) / 100).toFixed(2));
  }, [subtotal, discountAmount, settings]);

  const grandTotal = useMemo(() => {
    const sub = Number(subtotal) || 0;
    const disc = Number(discountAmount) || 0;
    const tax = Number(taxAmount) || 0;
    return Math.max(0, Number((sub - disc + tax).toFixed(2)));
  }, [subtotal, discountAmount, taxAmount]);

  // POS Cart Actions
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          unitPrice: product.sellingPrice,
        },
      ];
    });
    posSound.playItemAdd();
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
    if (delta > 0) posSound.playQtyChange();
    else posSound.playDelete();
  };

  const handleUpdateNote = (productId: string, note: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, note } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.product.id !== productId));
    posSound.playDelete();
  };

  const handleClearCart = () => {
    setCartItems([]);
    setDiscountValue(0);
    setDiscountReason('');
    posSound.playDelete();
  };

  const handleApplyDiscount = (type: 'PERCENT' | 'FIXED', value: number, reason: string) => {
    // Check if high discount requires manager approval
    const isHighDiscount = (type === 'PERCENT' && value > 15) || (type === 'FIXED' && value > 150);

    const apply = () => {
      setDiscountType(type);
      setDiscountValue(value);
      setDiscountReason(reason);
      posSound.playItemAdd();
    };

    if (isHighDiscount && currentUser && currentUser.role === 'STAFF') {
      setPinAuthModal({
        isOpen: true,
        description: `Authorize high discount (${value}${type === 'PERCENT' ? '%' : '₹'})`,
        onSuccess: apply,
      });
    } else {
      apply();
    }
  };

  const handleHoldOrder = () => {
    if (cartItems.length === 0) return;
    if (!currentUser) return;

    const savedHeld = posStorage.saveHeldOrder(
      {
        cartItems,
        orderType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : '',
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        discountReason,
        taxAmount,
        grandTotal,
      },
      currentUser
    );

    // Immediately sync held order to backend server so SSE and polling retain it permanently
    if (savedHeld) {
      apiSync.syncHeldOrderToServer(savedHeld);
    }

    // Reset current cart
    setCartItems([]);
    setDiscountValue(0);
    setDiscountReason('');
    loadData();
    posSound.playSuccess();
    setToastNotification({
      message: `Bill #${savedHeld?.holdNumber || ''} parked on hold! Recall anytime from [Held Bills / F8].`,
      type: 'success',
    });
  };

  const handleRecallOrder = (ho: any) => {
    // Check if this is a completed order (not a held order)
    if (ho.orderNumber && ho.status === 'COMPLETED') {
      alert('This order has already been completed and paid. You cannot edit completed orders.');
      return;
    }

    let items: CartItem[] = [];
    if (ho.cartItems && ho.cartItems.length > 0) {
      items = ho.cartItems;
    } else if (ho.items && ho.items.length > 0) {
      items = ho.items.map((it: any) => {
        if (it.product) return it;
        const prod = products.find((p) => p.id === it.productId) || {
          id: it.productId || `prod_${Date.now()}`,
          name: it.productName || 'Item',
          sku: it.sku || 'SKU',
          barcode: '',
          categoryId: it.categoryName || 'all',
          description: '',
          sellingPrice: it.unitPrice || 0,
          costPrice: it.costPrice || 0,
          taxRate: 5,
          imageUrl: '',
          stock: 100,
          minStock: 10,
          unit: 'portion',
          isVeg: it.isVeg ?? true,
          isAvailable: true,
          isFeatured: false,
          createdAt: '',
        };
        return {
          product: prod,
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          note: it.note,
        };
      });
    }

    setCartItems(items);
    setOrderType(ho.orderType || 'DINE_IN');
    setTableNumber(ho.tableNumber || 'T-01');
    setDiscountType(ho.discountType || 'PERCENT');
    setDiscountValue(ho.discountValue || 0);
    setDiscountReason(ho.discountReason || '');

    // Delete recalled order from held list in storage and server
    const heldId = ho.heldOrderId || ho.id;
    if (heldId) {
      console.log('[Recall] Deleting held order:', heldId);
      posStorage.deleteHeldOrder(heldId);
      apiSync.deleteHeldOrderFromServer(heldId);
      console.log('[Recall] Held order deleted from local and server');
    }
    loadData();
    setIsHeldOrdersModalOpen(false);
    setActiveTab('pos');
    posSound.playItemAdd();
  };

  const handleCompletePayment = (
    paymentMethod: PaymentMethod,
    paymentDetails: PaymentDetails,
    customerData?: { name: string; phone: string; email?: string },
    notes?: string
  ) => {
    if (!currentUser || !settings) return;

    try {
      const completedOrder = posStorage.completeOrderTransaction(
        {
          items: cartItems,
          orderType,
          tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          discountReason,
          taxAmount,
          grandTotal,
          paymentMethod,
          paymentDetails,
          customer: undefined,
          notes,
        },
        currentUser,
        settings
      );

      // Real-time server sync
      apiSync.syncOrderToServer(completedOrder);

      // Reset cart and reload storage
      setCartItems([]);
      setDiscountValue(0);
      setDiscountReason('');
      setIsCheckoutModalOpen(false);
      loadData();

      // Open thermal receipt modal with confetti
      setActiveReceiptOrder(completedOrder);
      setIsNewReceiptCompletion(true);
      setIsReceiptModalOpen(true);
    } catch (err: unknown) {
      posSound.playError();
      alert(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const handleReprintOrder = (order: Order) => {
    setActiveReceiptOrder(order);
    setIsNewReceiptCompletion(false);
    setIsReceiptModalOpen(true);
    posSound.playItemAdd();
  };

  const handleResetAllData = () => {
    posStorage.resetToFactorySeed();
    loadData();
    setCartItems([]);
    posSound.playDelete();
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys when terminal is locked by login popup
      if (!currentUser) return;

      // Don't trigger hotkeys when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        setIsCheckoutModalOpen(false);
        setIsReceiptModalOpen(false);
        setIsHeldOrdersModalOpen(false);
        setIsShortcutsModalOpen(false);
        setPinAuthModal((p) => ({ ...p, isOpen: false }));
        return;
      }

      if (isInput) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('pos');
        setCartItems([]);
        setDiscountValue(0);
        posSound.playItemAdd();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsNavOpen((prev) => !prev);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key === 'F6') {
        e.preventDefault();
        if (cartItems.length > 0) {
          setIsCheckoutModalOpen(true);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        const printBtn = document.getElementById('btn-print-thermal-receipt') as HTMLButtonElement;
        if (printBtn) {
          printBtn.click();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsHeldOrdersModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, currentUser]);

  // User Authentication & Session Management
  const handleLoginSuccess = (user: User) => {
    posStorage.setCurrentUser(user);
    setCurrentUser(user);
    if (user.role === 'STAFF') {
      const allowedStaffTabs = ['pos', 'kitchen', 'orders', 'products'];
      if (!allowedStaffTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
    setToastNotification({
      message: `Signed in as ${user.name} (${user.role === 'ADMIN' ? 'Administrator' : 'Staff Terminal'})`,
      type: 'success',
    });
  };

  const handleLogout = () => {
    posStorage.logoutUser();
    setCurrentUser(null);
    setActiveTab('pos');
    setCartItems([]);
    setDiscountValue(0);
    setDiscountReason('');
  };

  // Customer Self-Ordering Mode (e.g. user scanned table QR code: ?table=T-01)
  if (customerTable) {
    return (
      <CustomerOrderView
        tableNumber={customerTable}
        categories={categories}
        products={products}
        settings={settings || posStorage.getSettings()}
        onBackToStaff={() => {
          setCustomerTable(null);
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 select-none antialiased">
      {/* Top Application Header */}
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        onLogout={handleLogout}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          if (user.role === 'STAFF') {
            const allowedStaffTabs = ['pos', 'kitchen', 'orders', 'products'];
            if (!allowedStaffTabs.includes(activeTab)) {
              setActiveTab('pos');
            }
          }
          posSound.playItemAdd();
        }}
        orders={orders}
        heldCount={heldOrders.length}
        heldOrdersCount={heldOrders.length}
        pendingTableQrCount={pendingTableQrCount}
        onOpenHeldOrders={() => setIsHeldOrdersModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenTableQR={() => {
          setQrModalTable(tableNumber || 'T-01');
          setIsTableQRModalOpen(true);
        }}
        onFocusSearch={() => {
          const input = document.getElementById('product-search-input');
          input?.focus();
        }}
        cartCount={cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
        onOpenCart={() => setIsMobileCartOpen(true)}
        settings={settings}
        setSettings={setSettings}
        isNavOpen={isNavOpen}
        onToggleNav={() => setIsNavOpen((prev) => !prev)}
      />

      {/* Real-time Table QR Order Incoming Banner Alert */}
      {activeTableOrderNotification && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-5 py-3 shadow-md flex items-center justify-between animate-in slide-in-from-top-3 duration-200 z-40 border-b border-blue-400/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center animate-bounce">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-100 flex items-center gap-2">
                <span>Incoming Table QR Order</span>
                <span className="bg-white/25 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  Table {activeTableOrderNotification.heldOrder?.tableNumber || 'Dine-In'}
                </span>
              </div>
              <p className="text-sm font-bold text-white">
                {activeTableOrderNotification.heldOrder?.customerName || 'Customer'} placed an order ({activeTableOrderNotification.heldOrder?.items?.length || activeTableOrderNotification.heldOrder?.cartItems?.length || 0} items • {settings?.currencySymbol}{(Number(activeTableOrderNotification.heldOrder?.grandTotal) || 0).toFixed(2)})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleRecallOrder(activeTableOrderNotification.heldOrder);
                setActiveTableOrderNotification(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-extrabold text-xs rounded-xl shadow-xs transition-all active-press"
            >
              <span>Review & Bill Now [F8]</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTableOrderNotification(null)}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className="bg-emerald-600 text-white px-5 py-2.5 shadow-md flex items-center justify-between animate-in slide-in-from-top-2 duration-150 z-40 border-b border-emerald-500">
          <div className="flex items-center gap-2 text-xs font-bold mx-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastNotification.message}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="p-1 text-emerald-200 hover:text-white rounded-md transition-colors"
            title="Dismiss Notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tab Routing */}
      <main className="flex-1 flex overflow-hidden">
        {/* TAB 1: POS BILLING WORKSPACE */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-105px)] overflow-hidden relative">
            {/* Left: Category Filter Sidebar */}
            <CategorySidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              products={products}
              totalProductsCount={products.length}
              isOpen={isNavOpen}
              onClose={() => setIsNavOpen(false)}
              onToggleOpen={() => setIsNavOpen((prev) => !prev)}
            />

            {/* Center: Interactive Product Menu Catalog */}
            <ProductCatalog
              products={products}
              categories={categories}
              selectedCategory={selectedCategory}
              cartItems={cartItems}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddToCart={handleAddToCart}
              settings={settings}
              isNavOpen={isNavOpen}
              onOpenNav={() => setIsNavOpen(true)}
              onToggleNav={() => setIsNavOpen((prev) => !prev)}
            />

            {/* Right: Live Cart & Immediate Billing Panel - Hidden on mobile view */}
            <div className="hidden lg:flex h-full">
              <CurrentCart
                cartItems={cartItems}
                orderType={orderType}
                setOrderType={setOrderType}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onUpdateNote={handleUpdateNote}
                onClearCart={handleClearCart}
                discountType={discountType}
                setDiscountType={setDiscountType}
                discountValue={discountValue}
                setDiscountValue={setDiscountValue}
                discountReason={discountReason}
                setDiscountReason={setDiscountReason}
                subtotal={subtotal}
                discountAmount={discountAmount}
                taxAmount={taxAmount}
                grandTotal={grandTotal}
                onHoldOrder={handleHoldOrder}
                onProceedToCheckout={() => setIsCheckoutModalOpen(true)}
                settings={settings}
                currentUser={currentUser}
                onOpenTableQR={(tbl) => {
                  setQrModalTable(tbl || tableNumber || 'T-01');
                  setIsTableQRModalOpen(true);
                }}
              />
            </div>

            {/* Mobile Bottom Floating Cart Bar */}
            {cartItems.length > 0 && !isMobileCartOpen && (
              <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-30 flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                <div
                  onClick={() => setIsMobileCartOpen(true)}
                  className="flex items-center gap-2.5 cursor-pointer flex-1"
                >
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold relative shadow-xs shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                      {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium leading-none mb-1">
                      Current Order ({cartItems.reduce((acc, ci) => acc + ci.quantity, 0)} items)
                    </div>
                    <div className="text-base font-extrabold font-mono text-slate-900 leading-none">
                      {settings?.currencySymbol || '₹'}{(Number(grandTotal) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setIsCheckoutModalOpen(true);
                      posSound.playCashDrawer();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs active-press transition-colors"
                  >
                    <span>Pay</span>
                  </button>
                  <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs active-press transition-transform"
                  >
                    <span>Cart</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Slide-Up Fullscreen Cart Drawer */}
            {isMobileCartOpen && (
              <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150">
                <div className="bg-white w-full h-[92vh] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
                  <CurrentCart
                    cartItems={cartItems}
                    orderType={orderType}
                    setOrderType={setOrderType}
                    tableNumber={tableNumber}
                    setTableNumber={setTableNumber}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onUpdateNote={handleUpdateNote}
                    onClearCart={handleClearCart}
                    discountType={discountType}
                    setDiscountType={setDiscountType}
                    discountValue={discountValue}
                    setDiscountValue={setDiscountValue}
                    discountReason={discountReason}
                    setDiscountReason={setDiscountReason}
                    subtotal={subtotal}
                    discountAmount={discountAmount}
                    taxAmount={taxAmount}
                    grandTotal={grandTotal}
                    onHoldOrder={() => {
                      handleHoldOrder();
                      setIsMobileCartOpen(false);
                    }}
                    onProceedToCheckout={() => {
                      setIsMobileCartOpen(false);
                      setIsCheckoutModalOpen(true);
                    }}
                    settings={settings}
                    currentUser={currentUser}
                    onOpenTableQR={(tbl) => {
                      setQrModalTable(tbl || tableNumber || 'T-01');
                      setIsTableQRModalOpen(true);
                    }}
                    onCloseMobileCart={() => setIsMobileCartOpen(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1.5: KITCHEN DISPLAY SYSTEM (KDS) */}
        {activeTab === 'kitchen' && (
          <KitchenDisplayView
            heldOrders={heldOrders}
            settings={settings}
            currentUser={currentUser}
            onRecallOrder={handleRecallOrder}
            onSwitchTab={setActiveTab}
          />
        )}

        {/* TAB 2: ORDER HISTORY REGISTRY */}
        {activeTab === 'orders' && (
          <OrderHistoryView
            orders={orders}
            onRefreshOrders={loadData}
            onReprintOrder={handleReprintOrder}
            settings={settings}
            currentUser={currentUser}
            onOpenPinAuth={(desc, onSuccess) =>
              setPinAuthModal({ isOpen: true, description: desc, onSuccess })
            }
            onRecallOrder={handleRecallOrder}
          />
        )}

        {/* TAB 3: SALES & BUSINESS INTELLIGENCE DASHBOARD */}
        {activeTab === 'analytics' && currentUser?.role === 'ADMIN' && (
          <SalesDashboard
            orders={orders}
            products={products}
            categories={categories}
            settings={settings}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* TAB 4: FINANCIAL & TAX REPORTS */}
        {activeTab === 'reports' && currentUser?.role === 'ADMIN' && (
          <SalesReportsView
            orders={orders}
            settings={settings}
            users={users}
            onRefreshOrders={loadData}
            currentUser={currentUser}
          />
        )}

        {/* TAB 5: PRODUCT & MENU MANAGEMENT */}
        {activeTab === 'products' && (
          <ProductManagementView
            products={products}
            categories={categories}
            settings={settings}
            currentUser={currentUser}
            onRefreshProducts={loadData}
          />
        )}

        {/* TAB 6: SETTINGS & HARDWARE CONFIGURATION */}
        {activeTab === 'settings' && currentUser?.role === 'ADMIN' && (
          <SettingsView
            settings={settings}
            currentUser={currentUser}
            onRefreshSettings={loadData}
            onResetAllData={handleResetAllData}
          />
        )}
      </main>

      {/* MODAL 1: CHECKOUT & MULTI-TENDER PAYMENT */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        cartItems={cartItems}
        orderType={orderType}
        tableNumber={orderType === 'DINE_IN' ? tableNumber : ''}
        subtotal={subtotal}
        discountType={discountType}
        discountValue={discountValue}
        discountAmount={discountAmount}
        discountReason={discountReason}
        taxAmount={taxAmount}
        grandTotal={grandTotal}
        settings={settings}
        currentUser={currentUser}
        onConfirmPayment={handleCompletePayment}
      />

      {/* MODAL 2: THERMAL RECEIPT PREVIEW & PRINTER */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        order={activeReceiptOrder}
        settings={settings}
        onClose={() => setIsReceiptModalOpen(false)}
        onNewOrder={() => {
          setIsReceiptModalOpen(false);
          setActiveTab('pos');
          setCartItems([]);
          posSound.playItemAdd();
        }}
        isNewCompletion={isNewReceiptCompletion}
      />

      {/* MODAL 3: HELD ORDERS DRAWER */}
      <HeldOrdersModal
        isOpen={isHeldOrdersModalOpen}
        onClose={() => setIsHeldOrdersModalOpen(false)}
        heldOrders={heldOrders}
        settings={settings}
        onRecallOrder={handleRecallOrder}
        onDeleteHeldOrder={(id) => {
          posStorage.deleteHeldOrder(id);
          apiSync.deleteHeldOrderFromServer(id);
          loadData();
        }}
      />

      {/* MODAL 5: KEYBOARD HOTKEYS GUIDE */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* MODAL 6: MANAGER PIN AUTHORIZATION */}
      <PinAuthModal
        isOpen={pinAuthModal.isOpen}
        onClose={() => setPinAuthModal((p) => ({ ...p, isOpen: false }))}
        users={users}
        actionDescription={pinAuthModal.description}
        onSuccess={pinAuthModal.onSuccess}
      />

      {/* MODAL 7: TABLE QR CODE & STANDEE GENERATOR */}
      <TableQRModal
        isOpen={isTableQRModalOpen}
        onClose={() => setIsTableQRModalOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        currentTable={qrModalTable || tableNumber || 'T-01'}
        onOpenCustomerView={(tbl) => {
          setCustomerTable(tbl);
          window.history.pushState({}, '', `?table=${encodeURIComponent(tbl)}`);
        }}
      />

      {/* UNCLOSABLE LOGIN POP-UP WINDOW (Cannot be closed without valid role authentication) */}
      {!currentUser && (
        <LoginDashboard
          users={users.length > 0 ? users : posStorage.getUsers()}
          settings={settings}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
};

export default App;
