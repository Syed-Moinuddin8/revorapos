import React, { useState, useMemo, useEffect } from 'react';
import { Order, CafeSettings, User } from '../../types';
import { posStorage } from '../../services/storage';
import { posSound } from '../../services/sound';
import { posDb } from '../../server/db';
import {
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  Ban,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  User as UserIcon,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  ArrowUpDown,
  FileText,
  X,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../common/CustomDropdown';

interface OrderHistoryViewProps {
  orders: Order[];
  onRefreshOrders: () => void;
  onReprintOrder: (order: Order) => void;
  settings: CafeSettings;
  currentUser: User;
  onOpenPinAuth: (actionDescription: string, onSuccess: () => void) => void;
  onRecallOrder?: (orderOrHeld: any) => void;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders: propsOrders,
  onRefreshOrders,
  onReprintOrder,
  settings,
  currentUser,
  onOpenPinAuth,
  onRecallOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  
  // Fetch orders directly from Neon database (not localStorage)
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const fetchOrdersFromDatabase = async () => {
    setIsLoading(true);
    console.log('[Orders & Bills] Fetching orders directly from Neon...');
    try {
      const dbOrders = await posDb.getAllOrdersAsync();
      console.log('[Orders & Bills] Fetched', dbOrders.length, 'orders from Neon');
      setOrders(dbOrders);
      setLastSync(new Date());
    } catch (error) {
      console.error('[Orders & Bills] Failed to fetch from Neon:', error);
      // Fallback to props if database fails
      setOrders(propsOrders);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch from database on mount and every 3 seconds
  useEffect(() => {
    console.log('[Orders & Bills] Component mounted, starting direct DB sync...');
    fetchOrdersFromDatabase();
    const interval = setInterval(() => {
      fetchOrdersFromDatabase();
    }, 3000); // 3 second refresh
    return () => {
      console.log('[Orders & Bills] Component unmounted, stopping direct DB sync');
      clearInterval(interval);
    };
  }, []);

  // DO NOT sync from props - we query database directly
  // This prevents flickering caused by localStorage sync conflicts

  const statusOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'TABLE_QR', label: 'Table QR Orders', icon: <QrCode className="w-3.5 h-3.5 text-blue-500" /> },
    { value: 'COMPLETED', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
    { value: 'CANCELLED', label: 'Cancelled', icon: <XCircle className="w-3.5 h-3.5 text-rose-500" /> },
    { value: 'REFUNDED', label: 'Refunded', icon: <RotateCcw className="w-3.5 h-3.5 text-amber-500" /> },
  ];

  const paymentOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Payments' },
    { value: 'CASH', label: 'Cash Only', icon: <Banknote className="w-3.5 h-3.5 text-emerald-600" /> },
    { value: 'UPI', label: 'UPI / QR', icon: <QrCode className="w-3.5 h-3.5 text-blue-600" /> },
    { value: 'CARD', label: 'Card', icon: <CreditCard className="w-3.5 h-3.5 text-purple-600" /> },
    { value: 'SPLIT', label: 'Split', icon: <Layers className="w-3.5 h-3.5 text-amber-600" /> },
  ];
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'PARTICULAR_DATE' | 'MONTH_WISE' | 'ALL'>('TODAY');
  const [selectedParticularDate, setSelectedParticularDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelAction, setCancelAction] = useState<'CANCEL' | 'REFUND'>('CANCEL');
  const [cancelReason, setCancelReason] = useState('');

  // Date strings
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  // Filtered orders
  const pendingTableQrOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'PENDING_TABLE_QR' || o.source === 'CUSTOMER_QR').length;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Date filter
      const orderDateStr = ord.date || new Date(ord.timestamp).toISOString().split('T')[0];
      if (dateFilter === 'TODAY' && orderDateStr !== todayStr) return false;
      if (dateFilter === 'YESTERDAY' && orderDateStr !== yesterday) return false;
      if (dateFilter === 'PARTICULAR_DATE' && orderDateStr !== selectedParticularDate) return false;
      if (dateFilter === 'MONTH_WISE' && !orderDateStr.startsWith(selectedMonth)) return false;
      if (dateFilter === 'WEEK' && ord.timestamp < sevenDaysAgo) return false;

      // Status filter
      if (statusFilter === 'TABLE_QR') {
        if (ord.status !== 'PENDING_TABLE_QR' && ord.source !== 'CUSTOMER_QR') return false;
      } else if (statusFilter !== 'ALL' && ord.status !== statusFilter) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'ALL' && ord.paymentMethod !== paymentFilter) return false;

      // Search query (Order #, Items, Cashier)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          ord.orderNumber.toLowerCase().includes(q) ||
          ord.staff.name.toLowerCase().includes(q) ||
          ord.items.some((i) => i.productName.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [orders, dateFilter, selectedParticularDate, selectedMonth, statusFilter, paymentFilter, searchQuery, todayStr, yesterday, sevenDaysAgo]);

  const totalFilteredSales = filteredOrders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((acc, o) => acc + o.grandTotal, 0);

  const handleProcessCancelOrRefund = () => {
    if (!cancelModalOrder) return;
    if (!cancelReason.trim()) {
      alert('Please provide a valid cancellation/refund reason');
      return;
    }

    // Require PIN for Manager/Admin if cashier is logged in
    const executeAction = () => {
      try {
        posStorage.cancelOrRefundOrder(
          cancelModalOrder.id,
          cancelAction,
          cancelReason.trim(),
          currentUser
        );
        posSound.playDelete();
        onRefreshOrders();
        setCancelModalOrder(null);
        setCancelReason('');
        if (selectedOrder?.id === cancelModalOrder.id) {
          const updated = posStorage.getOrderById(cancelModalOrder.id);
          if (updated) setSelectedOrder(updated);
        }
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Action failed');
      }
    };

    if (currentUser?.role === 'STAFF') {
      onOpenPinAuth(
        `Authorize ${cancelAction === 'CANCEL' ? 'Cancellation' : 'Refund'} for ${cancelModalOrder.orderNumber}`,
        executeAction
      );
    } else {
      executeAction();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-105px)] bg-slate-50 overflow-hidden select-none">
      {/* Top Filter Bar */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Order History & Invoice Registry
              </h2>
              <p className="text-xs text-slate-400">
                Showing {filteredOrders.length} orders
                {dateFilter === 'TODAY' && ' (Today)'}
                {dateFilter === 'YESTERDAY' && ' (Yesterday)'}
                {dateFilter === 'PARTICULAR_DATE' && ` (Date: ${selectedParticularDate})`}
                {dateFilter === 'MONTH_WISE' && ` (Month: ${selectedMonth})`}
                {dateFilter === 'WEEK' && ' (Past 7 Days)'}
                {dateFilter === 'ALL' && ' (All Time)'}
                {' '}• Completed Volume:{' '}
                <span className="font-mono font-bold text-blue-700">
                  {settings.currencySymbol}{(Number(totalFilteredSales) || 0).toFixed(2)}
                </span>
              </p>
            </div>
            
            {/* Manual Refresh Button */}
            <button
              onClick={fetchOrdersFromDatabase}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isLoading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active-press'
              }`}
              title={`Last synced: ${lastSync.toLocaleTimeString()}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Quick Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar max-w-full">
              {[
                { id: 'TODAY', label: 'Today' },
                { id: 'YESTERDAY', label: 'Yesterday' },
                { id: 'PARTICULAR_DATE', label: 'Particular Date' },
                { id: 'MONTH_WISE', label: 'Month Wise' },
                { id: 'WEEK', label: '7 Days' },
                { id: 'ALL', label: 'All Time' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id as typeof dateFilter)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap active-press ${
                    dateFilter === d.id
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Particular Date Input */}
            {dateFilter === 'PARTICULAR_DATE' && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl text-xs shadow-2xs animate-in fade-in duration-150">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold text-blue-900 text-[11px]">Date:</span>
                <input
                  type="date"
                  value={selectedParticularDate}
                  onChange={(e) => setSelectedParticularDate(e.target.value)}
                  className="bg-white border border-blue-300 text-slate-800 text-xs rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                />
              </div>
            )}

            {/* Month Wise Input */}
            {dateFilter === 'MONTH_WISE' && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl text-xs shadow-2xs animate-in fade-in duration-150">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-semibold text-indigo-900 text-[11px]">Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border border-indigo-300 text-slate-800 text-xs rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Search & Secondary Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order #, Customer, Phone, Items..."
              className="w-full text-xs pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Quick Table QR Filter Pill */}
          <button
            onClick={() => setStatusFilter(statusFilter === 'TABLE_QR' ? 'ALL' : 'TABLE_QR')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all border ${
              statusFilter === 'TABLE_QR'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : pendingTableQrOrdersCount > 0
                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 animate-pulse'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Table QRs</span>
            {pendingTableQrOrdersCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === 'TABLE_QR' ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
              }`}>
                {pendingTableQrOrdersCount}
              </span>
            )}
          </button>

          {/* Payment Method Dropdown */}
          <CustomDropdown
            id="orders-payment-dropdown"
            value={paymentFilter}
            options={paymentOptions}
            onChange={(val) => setPaymentFilter(val)}
            align="right"
            buttonClassName="bg-slate-50 hover:bg-slate-100 text-xs px-3.5 py-2 rounded-2xl border-slate-200 font-medium"
          />
        </div>
      </div>

      {/* Orders Table & Detail Drawer Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table View */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredOrders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mb-2" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">No Orders Found</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                No orders match your filter criteria. Try adjusting the date range or search query.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[620px]">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Order #</th>
                    <th className="py-3.5 px-3">Date & Time</th>
                    <th className="py-3.5 px-3">Order Type</th>
                    <th className="py-3.5 px-3">Items Summary</th>
                    <th className="py-3.5 px-3 text-right">Total</th>
                    <th className="py-3.5 px-4 text-center">Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((ord) => {
                    const isSelected = selectedOrder?.id === ord.id;
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        {/* Order Number */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {ord.orderNumber}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-3 text-slate-600">
                          <div className="font-medium">{ord.date}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{ord.time}</div>
                        </td>

                        {/* Order Type / Table */}
                        <td className="py-3 px-3">
                          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-[11px] rounded-lg">
                            {ord.orderType}
                            {ord.tableNumber ? ` • Table ${ord.tableNumber}` : ''}
                          </span>
                        </td>

                        {/* Items Preview */}
                        <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate">
                          <span className="font-bold text-slate-900">
                            {ord.itemCount} items:
                          </span>{' '}
                          {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                          {settings.currencySymbol}
                          {(Number(ord.grandTotal) || 0).toFixed(2)}
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.paymentMethod === 'CASH'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : ord.paymentMethod === 'UPI'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : ord.paymentMethod === 'CARD'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ord.paymentMethod}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(ord.status === 'PENDING_TABLE_QR' || (ord.source === 'CUSTOMER_QR' && ord.status !== 'COMPLETED')) && onRecallOrder && (
                              <button
                                onClick={() => onRecallOrder(ord)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs active-press transition-colors"
                                title="Review & Bill in POS"
                              >
                                <span>Review & Bill</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => onReprintOrder(ord)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors active-press"
                              title="Reprint Bill"
                            >
                              <Printer className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors active-press"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Slide-in Order Details Drawer */}
        {selectedOrder && (
          <div
            className="fixed inset-0 z-50 lg:static lg:z-20 bg-slate-900/60 backdrop-blur-xs lg:bg-transparent flex justify-end animate-in fade-in duration-150"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="w-full sm:max-w-md lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl z-20 animate-in slide-in-from-right duration-200"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Order Details
                </span>
                <h3 className="text-base font-bold font-mono text-slate-900">
                  {selectedOrder.orderNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Order Info Banner */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 block font-mono">{selectedOrder.orderNumber}</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedOrder.date} at {selectedOrder.time}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-2xs">
                  {selectedOrder.orderType} {selectedOrder.tableNumber ? `• Table ${selectedOrder.tableNumber}` : ''}
                </span>
              </div>

              {/* Cancellation Reason if cancelled */}
              {selectedOrder.cancelReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs">
                  <span className="font-bold block">Cancellation Reason:</span>
                  <p className="mt-0.5">{selectedOrder.cancelReason}</p>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    By: {selectedOrder.cancelledBy || 'Staff'} at {selectedOrder.cancelledAt}
                  </span>
                </div>
              )}

              {/* Meta Grid */}
              <div className="grid grid-cols-3 gap-2 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Order Type</span>
                  <span className="font-bold text-slate-900">
                    {selectedOrder.orderType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Method</span>
                  <span className="font-bold text-blue-700">{selectedOrder.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Table / Location</span>
                  <span className="font-bold text-slate-900">
                    {selectedOrder.tableNumber || selectedOrder.orderType}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <span className="font-bold uppercase tracking-widest text-slate-400 text-[10px] block mb-2">
                  Purchased Items ({selectedOrder.itemCount})
                </span>
                <div className="space-y-1.5 border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start py-1 border-b border-slate-200/50 last:border-none">
                      <div>
                        <span className="font-bold text-slate-900">{item.quantity}x {item.productName}</span>
                        {item.note && <p className="text-[10px] text-blue-700 italic">* {item.note}</p>}
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {settings.currencySymbol}{(Number(item.totalPrice ?? (item.unitPrice * item.quantity)) || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="p-4 bg-slate-900 text-white rounded-3xl space-y-1.5 font-mono shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 -translate-y-8 translate-x-8 rounded-full pointer-events-none"></div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Subtotal</span>
                  <span>{settings.currencySymbol}{(Number(selectedOrder.subtotal) || 0).toFixed(2)}</span>
                </div>
                {(selectedOrder.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-rose-400 text-xs">
                    <span>Discount ({selectedOrder.discountValue || 0}%)</span>
                    <span>-{settings.currencySymbol}{(Number(selectedOrder.discountAmount) || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Tax ({selectedOrder.taxRate || 0}%)</span>
                  <span>+{settings.currencySymbol}{(Number(selectedOrder.taxAmount) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>GRAND TOTAL</span>
                  <span className="text-white font-bold">{settings.currencySymbol}{(Number(selectedOrder.grandTotal) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              {(selectedOrder.status === 'PENDING_TABLE_QR' || (selectedOrder.source === 'CUSTOMER_QR' && selectedOrder.status !== 'COMPLETED')) && onRecallOrder && (
                <button
                  onClick={() => {
                    onRecallOrder(selectedOrder);
                    posSound.playItemAdd();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-md active-press transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Review & Bill in POS Cart</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => onReprintOrder(selectedOrder)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs shadow-xs active-press transition-colors"
              >
                <Printer className="w-4 h-4 text-blue-200" />
                <span>Reprint Thermal Receipt</span>
              </button>

              {selectedOrder.status === 'COMPLETED' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setCancelModalOrder(selectedOrder);
                      setCancelAction('CANCEL');
                    }}
                    className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs transition-colors"
                  >
                    Void / Cancel
                  </button>
                  <button
                    onClick={() => {
                      setCancelModalOrder(selectedOrder);
                      setCancelAction('REFUND');
                    }}
                    className="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl font-bold text-xs transition-colors"
                  >
                    Refund Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Cancel / Refund Confirmation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {cancelAction === 'CANCEL' ? 'Void / Cancel Order' : 'Issue Order Refund'}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  {cancelModalOrder.orderNumber} • {settings.currencySymbol}{(Number(cancelModalOrder.grandTotal) || 0).toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              This action will mark the bill as <span className="font-bold">{cancelAction.toLowerCase()}ed</span>.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Reason for {cancelAction.toLowerCase()}: <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer changed mind, Kitchen error, Wrong punch..."
                autoFocus
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Go Back
              </button>
              <button
                onClick={handleProcessCancelOrRefund}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
              >
                Confirm {cancelAction === 'CANCEL' ? 'Cancellation' : 'Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
