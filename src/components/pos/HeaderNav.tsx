import React, { useState, useMemo } from 'react';
import { User, CafeSettings, Order } from '../../types';
import { posStorage } from '../../services/storage';
import { posSound } from '../../services/sound';
import {
  Coffee,
  Clock,
  Search,
  PauseCircle,
  Volume2,
  VolumeX,
  Keyboard,
  Receipt,
  RotateCcw,
  ChevronDown,
  QrCode,
  ChefHat,
  Zap,
  BarChart3,
  Settings,
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

interface HeaderNavProps {
  activeTab: string;
  setActiveTab?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  currentUser?: User | null;
  setCurrentUser?: (user: User) => void;
  onSwitchUser?: (user: User) => void;
  users?: User[];
  settings: CafeSettings;
  setSettings?: (settings: CafeSettings) => void;
  heldOrdersCount?: number;
  heldCount?: number;
  pendingTableQrCount?: number;
  orders?: Order[];
  onOpenHeldOrders?: () => void;
  onOpenShortcuts?: () => void;
  onOpenTableQR?: () => void;
  onFocusSearch?: () => void;
  todayOrdersCount?: number;
  todaySalesAmount?: number;
  cartCount?: number;
  onOpenCart?: () => void;
  isNavOpen?: boolean;
  onToggleNav?: () => void;
  onLogout?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeTab,
  setActiveTab,
  onSelectTab,
  currentUser,
  setCurrentUser,
  onSwitchUser,
  users: propUsers,
  settings,
  setSettings,
  heldOrdersCount,
  heldCount,
  pendingTableQrCount = 0,
  orders = [],
  onOpenHeldOrders = () => {},
  onOpenShortcuts = () => {},
  onOpenTableQR,
  onFocusSearch = () => {},
  todayOrdersCount,
  todaySalesAmount,
  cartCount = 0,
  onOpenCart,
  isNavOpen = true,
  onToggleNav,
  onLogout,
}) => {
  const [time, setTime] = useState<string>('');
  const [shortTime, setShortTime] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const rawUsers = propUsers && propUsers.length > 0 ? propUsers : posStorage.getUsers();
  const availableUsers = rawUsers.filter((u) => u.role === 'ADMIN' || u.role === 'STAFF');

  const handleSelectTab = (tab: string) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  const handleSwitchUser = (u: User) => {
    if (onSwitchUser) {
      onSwitchUser(u);
    } else if (setCurrentUser) {
      setCurrentUser(u);
    }
  };

  const effectiveHeldCount = heldCount ?? heldOrdersCount ?? 0;

  // Derive today's metrics safely with zero-error guarantees
  const todayStats = useMemo(() => {
    if (todayOrdersCount !== undefined && todaySalesAmount !== undefined) {
      return {
        count: Number(todayOrdersCount) || 0,
        amount: Number(todaySalesAmount) || 0,
        ordersCount: Number(todayOrdersCount) || 0,
        salesAmount: Number(todaySalesAmount) || 0,
      };
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const completedOrders = (orders || []).filter(
      (o) => o && o.status === 'COMPLETED' && (!o.date || o.date === todayStr)
    );
    const count = todayOrdersCount !== undefined ? todayOrdersCount : completedOrders.length;
    const amount =
      todaySalesAmount !== undefined
        ? todaySalesAmount
        : completedOrders.reduce((acc, o) => acc + (Number(o?.grandTotal) || 0), 0);
    return {
      count: Number(count) || 0,
      amount: Number(amount) || 0,
      ordersCount: Number(count) || 0,
      salesAmount: Number(amount) || 0,
    };
  }, [orders, todayOrdersCount, todaySalesAmount]);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const compactTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setTime(`${dateStr} • ${timeStr}`);
      setShortTime(`${dateStr} • ${compactTime}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !settings.enableSound;
    const updated = { ...settings, enableSound: next };
    posSound.enabled = next;
    posStorage.updateSettings(updated);
    setSettings(updated);
    if (next) posSound.playItemAdd();
  };

  const allNavTabs = [
    { id: 'pos', label: 'POS Billing', icon: Zap, allowedRoles: ['ADMIN', 'STAFF'] },
    { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat, badge: effectiveHeldCount, allowedRoles: ['ADMIN', 'STAFF'] },
    { id: 'orders', label: 'Orders & Bills', icon: Receipt, allowedRoles: ['ADMIN', 'STAFF'] },
    { id: 'products', label: 'Menu & Products', icon: Coffee, allowedRoles: ['ADMIN', 'STAFF'] },
    { id: 'analytics', label: 'Sales & Analytics', icon: BarChart3, allowedRoles: ['ADMIN'] },
    { id: 'reports', label: 'Financial & GST', icon: FileSpreadsheet, allowedRoles: ['ADMIN'] },
    { id: 'settings', label: 'Settings', icon: Settings, allowedRoles: ['ADMIN'] },
  ];

  const userRole = currentUser?.role || 'STAFF';
  const navTabs = allNavTabs.filter((tab) => tab.allowedRoles.includes(userRole));

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30 shadow-2xs select-none">
      {/* Top Bar */}
      <div className="px-2.5 sm:px-5 py-1.5 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand & Shift Info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-2xs ring-1 ring-blue-700/20 shrink-0 overflow-hidden bg-slate-900">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.cafeName || 'Café Logo'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Coffee className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-base font-bold tracking-tight text-stone-900 leading-tight truncate max-w-[125px] xs:max-w-[180px] sm:max-w-none">
                {settings.cafeName || 'ARTISAN CAFÉ'}
              </h1>
              <span className="hidden xs:inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live POS
              </span>
              <span className="xs:hidden w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Live POS" />
            </div>
            {/* Clock & Subtitle: Hidden on mobile to keep header clean and compact */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-400 font-medium mt-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-stone-500 whitespace-nowrap">
                <Clock className="w-3 h-3 text-stone-400 shrink-0" />
                <span>{time}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Shift Counter - Elegant Micro Capsule */}
        <div className="hidden xl:flex items-center divide-x divide-stone-200/80 bg-stone-50/90 border border-stone-200/80 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
          <div className="pr-3 flex items-baseline gap-2">
            <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Today's Orders</span>
            <span className="font-bold text-stone-900 font-mono text-xs">{todayStats.count}</span>
          </div>
          <div className="pl-3 flex items-baseline gap-2">
            <span className="text-stone-400 text-[10px] uppercase font-bold tracking-wider">Today's Revenue</span>
            <span className="font-bold text-stone-900 font-mono text-xs">
              {settings.currencySymbol}{(Number(todayStats.amount) || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile Cart Button */}
          {activeTab === 'pos' && onOpenCart && (
            <button
              id="btn-header-cart"
              type="button"
              onClick={onOpenCart}
              className="lg:hidden relative flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs active-press shrink-0"
              title="Open Current Order Cart"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              <span className="hidden xs:inline text-xs">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-400 text-stone-900 font-bold font-mono text-[9px] shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Search trigger - hidden on mobile since catalog has prominent search right below */}
          <button
            id="btn-global-search"
            onClick={onFocusSearch}
            className="hidden sm:flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100 text-stone-600 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium transition-colors active-press border border-stone-200/80 hover:border-stone-300 shadow-2xs shrink-0"
            title="Search Menu (Ctrl+K or F2)"
          >
            <Search className="w-3.5 h-3.5 text-stone-400" />
            <span className="hidden sm:inline text-stone-600">Search Menu</span>
            <kbd className="hidden md:inline-flex items-center bg-white text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 text-[10px] font-mono leading-none">
              Ctrl+K
            </kbd>
          </button>

          {/* Table QR Codes */}
          {onOpenTableQR && (
            <button
              id="btn-table-qr-codes"
              type="button"
              onClick={onOpenTableQR}
              className="hidden sm:flex items-center gap-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border border-stone-200/80 hover:border-stone-300 active-press shadow-2xs"
              title="Generate Table QR Codes for Customer Self-Ordering"
            >
              <QrCode className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden md:inline">Table QRs</span>
            </button>
          )}

          {/* Incoming Table Orders Alert Badge */}
          {pendingTableQrCount > 0 && (
            <button
              id="btn-incoming-table-orders"
              type="button"
              onClick={onOpenHeldOrders}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs animate-pulse active-press shrink-0"
              title="New Table QR Orders Waiting for Review"
            >
              <QrCode className="w-3.5 h-3.5 text-white" />
              <span>{pendingTableQrCount} <span className="hidden xs:inline">Table Order{pendingTableQrCount > 1 ? 's' : ''}</span></span>
            </button>
          )}

          {/* Kitchen Display Quick Button (Desktop only, mobile has tab right below) */}
          <button
            id="btn-header-kitchen"
            type="button"
            onClick={() => {
              handleSelectTab('kitchen');
              posSound.playItemAdd();
            }}
            className={`hidden sm:flex relative items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border active-press shadow-2xs shrink-0 ${
              activeTab === 'kitchen'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : effectiveHeldCount > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-stone-50 text-stone-700 border-stone-200/80 hover:bg-stone-100'
            }`}
            title="Open Kitchen Display (KDS) for food preparation"
          >
            <ChefHat className={`w-3.5 h-3.5 ${activeTab === 'kitchen' ? 'text-white' : effectiveHeldCount > 0 ? 'text-amber-700' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">Kitchen</span>
            {effectiveHeldCount > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.2 rounded-full font-bold font-mono text-[10px] ${
                activeTab === 'kitchen' ? 'bg-blue-700 text-white ring-1 ring-white/20' : 'bg-amber-500 text-white'
              }`}>
                {effectiveHeldCount}
              </span>
            )}
          </button>

          {/* Held Orders Badge (Desktop only, accessible in tabs/modals) */}
          <button
            id="btn-held-orders"
            onClick={onOpenHeldOrders}
            className={`hidden sm:flex relative items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border active-press shadow-2xs shrink-0 ${
              effectiveHeldCount > 0
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                : 'bg-stone-50 text-stone-700 border-stone-200/80 hover:bg-stone-100'
            }`}
            title="Parked / Held Orders (F4)"
          >
            <PauseCircle className={`w-3.5 h-3.5 ${effectiveHeldCount > 0 ? 'text-amber-300' : 'text-stone-500'}`} />
            <span className="hidden sm:inline">Held Bills</span>
            {effectiveHeldCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-stone-900 font-bold font-mono text-[10px]">
                {effectiveHeldCount}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            className="hidden sm:flex w-8 h-8 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200/80 active-press transition-colors items-center justify-center shadow-2xs shrink-0"
            title={settings.enableSound ? 'Mute Sounds' : 'Enable Audio'}
          >
            {settings.enableSound ? <Volume2 className="w-3.5 h-3.5 text-stone-700" /> : <VolumeX className="w-3.5 h-3.5 text-stone-400" />}
          </button>

          {/* Shortcuts Help */}
          <button
            id="btn-shortcuts-modal"
            onClick={onOpenShortcuts}
            className="hidden md:flex w-8 h-8 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 border border-stone-200/80 active-press transition-colors items-center justify-center shadow-2xs shrink-0"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5 text-stone-600" />
          </button>

          {/* User Profile & Role Info */}
          <div className="relative shrink-0">
            {currentUser ? (
              <button
                id="btn-user-dropdown"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:pl-1.5 sm:pr-2.5 sm:py-1 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/80 transition-colors active-press shadow-2xs cursor-pointer"
                title="View account info"
              >
                <img
                  src={currentUser.avatar || '/images/avatars/priya.jpg'}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-lg object-cover ring-1 ring-stone-200"
                />
                <div className="text-left hidden md:block">
                  <span className="block text-xs font-semibold text-stone-900 leading-none">{currentUser.name}</span>
                  <span className={`text-[9px] font-bold tracking-wider uppercase leading-none mt-0.5 block ${
                    currentUser.role === 'ADMIN' ? 'text-blue-600' : 'text-stone-600'
                  }`}>
                    {currentUser.role === 'ADMIN' ? 'ADMIN PANEL' : 'STAFF PANEL'}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-bold shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Locked Terminal</span>
              </div>
            )}

            {showUserMenu && currentUser && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-stone-200 p-3.5 z-50 animate-in fade-in zoom-in-95 space-y-3">
                <div className="flex items-center gap-3 pb-2.5 border-b border-stone-100">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-xl object-cover ring-2 ring-stone-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">{currentUser.name}</h4>
                    <p className="text-[11px] text-stone-500">@{currentUser.username}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      currentUser.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' : 'bg-stone-100 text-stone-700'
                    }`}>
                      {currentUser.role === 'ADMIN' ? 'Administrator' : 'Staff Terminal'}
                    </span>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl p-2.5 text-[11px] text-stone-600 border border-stone-200/60 space-y-1">
                  <p className="font-semibold text-stone-800">Role Switching Policy</p>
                  <p className="text-[10px] text-stone-500 leading-relaxed">
                    To shift between Admin and Staff roles, please log out and authenticate with your account PIN on the login dashboard.
                  </p>
                </div>

                {onLogout && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200/80 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out to Shift Role</span>
                  </button>
                )}

                <div className="pt-2 border-t border-stone-100">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowResetConfirm(true);
                    }}
                    className="w-full text-left py-1 text-[11px] text-stone-400 hover:text-rose-600 font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default Demo Data
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Logout Button */}
          {onLogout && currentUser && (
            <button
              id="btn-header-logout"
              onClick={() => {
                posSound.playQtyChange();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 hover:text-rose-800 text-xs font-bold border border-rose-200/90 transition-all active-press shadow-2xs shrink-0 cursor-pointer"
              title="Log out and return to Login Dashboard to shift user or lock terminal"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="px-2.5 sm:px-5 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar border-t border-stone-200/80 bg-stone-50/90 py-1 sm:py-2 scroll-smooth">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => {
                handleSelectTab(tab.id);
                posSound.playItemAdd();
              }}
              className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap rounded-xl transition-all active-press shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white/70 border border-slate-200/60'
              }`}
            >
              <TabIcon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono font-bold leading-none ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300/80'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reset Demo Data Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Reset Demo Database?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This will reload the initial demo menu, clear custom modifications, and restore factory sample orders and metrics.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  posStorage.resetToFactoryDemo();
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer active-press"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
