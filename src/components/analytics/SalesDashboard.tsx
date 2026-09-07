import React, { useState, useMemo } from 'react';
import { Order, Product, Category, CafeSettings } from '../../types';
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Calendar,
  Layers,
  PieChart as PieIcon,
  BarChart3,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface SalesDashboardProps {
  orders: Order[];
  products: Product[];
  categories: Category[];
  settings: CafeSettings;
  onNavigateToTab: (tab: string) => void;
}

export const SalesDashboard: React.FC<SalesDashboardProps> = ({
  orders = [],
  products = [],
  categories = [],
  settings,
  onNavigateToTab,
}) => {
  const [timeRange, setTimeRange] = useState<'TODAY' | 'PARTICULAR_DATE' | 'MONTH_WISE' | '7DAYS' | 'ALL'>('TODAY');
  const [selectedParticularDate, setSelectedParticularDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  // Filter orders by selected timeframe
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDateStr = o.date || new Date(o.timestamp).toISOString().split('T')[0];
      if (timeRange === 'TODAY') return orderDateStr === todayStr;
      if (timeRange === 'PARTICULAR_DATE') return orderDateStr === selectedParticularDate;
      if (timeRange === 'MONTH_WISE') return orderDateStr.startsWith(selectedMonth);
      if (timeRange === '7DAYS') return o.timestamp >= sevenDaysAgo;
      return true;
    });
  }, [orders, timeRange, selectedParticularDate, selectedMonth, todayStr, sevenDaysAgo]);

  const completedOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'COMPLETED');
  }, [filteredOrders]);

  // Aggregate Metrics
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalSubtotal = completedOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalDiscount = completedOrders.reduce((sum, o) => sum + o.discountAmount, 0);
  const totalTax = completedOrders.reduce((sum, o) => sum + o.taxAmount, 0);
  const totalItemsSold = completedOrders.reduce((sum, o) => sum + o.itemCount, 0);

  // Payment Breakdown
  const cashSales = completedOrders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + o.grandTotal, 0);
  const upiSales = completedOrders.filter((o) => o.paymentMethod === 'UPI').reduce((s, o) => s + o.grandTotal, 0);
  const cardSales = completedOrders.filter((o) => o.paymentMethod === 'CARD').reduce((s, o) => s + o.grandTotal, 0);
  const splitSales = completedOrders.filter((o) => o.paymentMethod === 'SPLIT').reduce((s, o) => s + o.grandTotal, 0);

  const paymentPieData = [
    { name: 'Cash', value: Number((cashSales || 0).toFixed(2)), color: '#10B981' },
    { name: 'UPI / QR', value: Number((upiSales || 0).toFixed(2)), color: '#3B82F6' },
    { name: 'Card', value: Number((cardSales || 0).toFixed(2)), color: '#8B5CF6' },
    { name: 'Split', value: Number((splitSales || 0).toFixed(2)), color: '#F59E0B' },
  ].filter((p) => p.value > 0);

  // Hourly / Daily Trend Data
  const trendChartData = useMemo(() => {
    if (timeRange === 'TODAY' || timeRange === 'PARTICULAR_DATE') {
      // Group by hours 8 AM to 10 PM
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
      return hours.map((hr) => {
        const hrNum = parseInt(hr.split(':')[0], 10);
        const matching = completedOrders.filter((o) => {
          const ordHr = parseInt((o.time || '').split(':')[0], 10);
          return ordHr >= hrNum && ordHr < hrNum + 2;
        });
        const rev = matching.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0);
        return {
          label: hr,
          revenue: Number((rev || 0).toFixed(2)),
          orders: matching.length,
        };
      });
    } else {
      // Group by day
      const dayMap: Record<string, { revenue: number; orders: number }> = {};
      completedOrders.forEach((o) => {
        const dStr = o.date || new Date(o.timestamp).toISOString().split('T')[0];
        if (!dayMap[dStr]) dayMap[dStr] = { revenue: 0, orders: 0 };
        dayMap[dStr].revenue += Number(o.grandTotal) || 0;
        dayMap[dStr].orders += 1;
      });
      return Object.keys(dayMap).sort().map((d) => ({
        label: timeRange === 'MONTH_WISE' ? `Day ${parseInt(d.slice(8), 10) || d.slice(5)}` : d.slice(5),
        revenue: Number((dayMap[d].revenue || 0).toFixed(2)),
        orders: dayMap[d].orders,
      }));
    }
  }, [completedOrders, timeRange]);

  // Product Performance (Top 5 items)
  const productSalesMap = useMemo(() => {
    const map: Record<string, { name: string; quantity: number; revenue: number }> = {};
    completedOrders.forEach((o) => {
      o.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        map[item.productId].quantity += item.quantity;
        map[item.productId].revenue += item.totalPrice;
      });
    });
    return Object.values(map).sort((a, b) => b.quantity - a.quantity);
  }, [completedOrders]);

  const topSellingProducts = productSalesMap.slice(0, 5);

  // Category Breakdown
  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    completedOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = categories.find((c) => c.id === prod?.categoryId);
        const catName = cat ? cat.name : 'Other';
        catMap[catName] = (catMap[catName] || 0) + (Number(item.totalPrice ?? (item.unitPrice * item.quantity)) || 0);
      });
    });
    return Object.keys(catMap).map((catName) => ({
      category: catName,
      revenue: Number((catMap[catName] || 0).toFixed(2)),
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [completedOrders, products, categories]);

  return (
    <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-slate-50 space-y-4 sm:space-y-6 select-none">
      {/* Header Bar - Geometric Balance style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Sales & Billing Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {timeRange === 'TODAY' && "Viewing today's performance."}
            {timeRange === 'PARTICULAR_DATE' && `Viewing metrics for ${selectedParticularDate}.`}
            {timeRange === 'MONTH_WISE' && `Viewing metrics for ${selectedMonth}.`}
            {timeRange === '7DAYS' && 'Viewing last 7 days velocity.'}
            {timeRange === 'ALL' && 'Viewing all-time sales metrics.'}
            {' '}Real-time velocity, revenue metrics, and operational performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Time range selector */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-xs text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'PARTICULAR_DATE', label: 'Particular Date' },
              { id: 'MONTH_WISE', label: 'Month Wise' },
              { id: '7DAYS', label: '7 Days' },
              { id: 'ALL', label: 'All History' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeRange(t.id as typeof timeRange)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl transition-all whitespace-nowrap active-press ${
                  timeRange === t.id
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Particular Date Input */}
          {timeRange === 'PARTICULAR_DATE' && (
            <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-2xl shadow-2xs animate-in fade-in duration-150">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-blue-900 font-bold">Select Date:</span>
              <input
                type="date"
                value={selectedParticularDate}
                onChange={(e) => setSelectedParticularDate(e.target.value)}
                className="bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}

          {/* Month Wise Input */}
          {timeRange === 'MONTH_WISE' && (
            <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-2xl shadow-2xs animate-in fade-in duration-150">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-900 font-bold">Select Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          )}

          <button
            onClick={() => onNavigateToTab('reports')}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors active-press shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Full Reports</span>
          </button>
        </div>
      </div>

      {/* Top KPI Cards Grid - Geometric Balance archetypes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Revenue - Archetype with Quarter Circle */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-60 pointer-events-none"></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Total Revenue
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {settings.currencySymbol}{(Number(totalRevenue) || 0).toFixed(2)}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold mt-4">
            <ArrowUpRight className="w-4 h-4" />
            <span>{completedOrders.length} completed transactions</span>
          </div>
        </div>

        {/* Items Sold Card */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs border-l-4 border-l-blue-600 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Total Items Sold
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {totalItemsSold}
            </h3>
          </div>
          <div className="text-xs text-blue-600 font-bold mt-4">
            Total items ordered & fulfilled
          </div>
        </div>

        {/* Menu & Products Card */}
        <div
          onClick={() => onNavigateToTab('products')}
          className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:border-slate-300"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Active Menu Catalog
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {products.length} Products
            </h3>
          </div>
          <div className="text-xs text-blue-600 font-bold underline mt-4">
            Manage Menu Catalog →
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Cash Sales</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {settings.currencySymbol}{(Number(cashSales) || 0).toFixed(2)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">UPI / QR Sales</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {settings.currencySymbol}{(Number(upiSales) || 0).toFixed(2)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Card Sales</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {settings.currencySymbol}{(Number(cardSales) || 0).toFixed(2)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total GST / Tax</span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {settings.currencySymbol}{(Number(totalTax) || 0).toFixed(2)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Tag className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Charts Row: Revenue Area Chart & Payment Mode Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Velocity Chart (8 Cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Revenue Velocity & Volume</h3>
              <p className="text-xs text-slate-400">
                {timeRange === 'TODAY' ? 'Hourly revenue progression throughout shift' : 'Daily sales totals across billing cycle'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
              {completedOrders.length} Orders
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  formatter={(val: any) => [`${settings.currencySymbol}${(Number(val) || 0).toFixed(2)}`, 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevBlue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Donut Chart (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Payment Breakdown</h3>
            <p className="text-xs text-slate-400">Distribution across settlement channels</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center my-2">
            {paymentPieData.length === 0 ? (
              <span className="text-xs text-slate-400">No completed sales</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${settings.currencySymbol}${(Number(val) || 0).toFixed(2)}`, 'Sales']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
            {paymentPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-600 font-medium">{item.name}:</span>
                <span className="font-mono font-bold text-slate-900 ml-auto">
                  {(((Number(item.value) || 0) / (Number(totalRevenue) || 1)) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 5 Products & Category Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Best Selling Items */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-blue-600" />
              Top Best-Selling Menu Items
            </h3>
            <span className="text-xs text-slate-400">By quantity sold</span>
          </div>

          <div className="space-y-3">
            {topSellingProducts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No product sales yet</div>
            ) : (
              topSellingProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center justify-between text-xs p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 truncate max-w-[240px]">
                    <span className="w-6 h-6 rounded-xl bg-blue-50 text-blue-700 font-mono font-bold flex items-center justify-center text-[11px] shrink-0 border border-blue-100">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 font-mono">
                    <span className="text-slate-400 font-medium">{p.quantity} sold</span>
                    <span className="font-extrabold text-slate-900">
                      {settings.currencySymbol}{(Number(p.revenue) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Share Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Category Revenue Share
            </h3>
            <span className="text-xs text-slate-400">Top Categories</span>
          </div>

          <div className="h-56 w-full">
            {categoryChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No category data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#334155' }} width={90} />
                  <Tooltip formatter={(val: any) => [`${settings.currencySymbol}${(Number(val) || 0).toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#2563EB" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
