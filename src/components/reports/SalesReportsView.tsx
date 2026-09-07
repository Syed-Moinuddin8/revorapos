import React, { useState, useMemo } from 'react';
import { Order, CafeSettings, User } from '../../types';
import { posSound } from '../../services/sound';
import { posStorage } from '../../services/storage';
import { apiSync } from '../../services/apiSync';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  DollarSign,
  Receipt,
  Percent,
  TrendingUp,
  User as UserIcon,
  Trash2,
  AlertTriangle,
  Check,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';

interface SalesReportsViewProps {
  orders: Order[];
  settings: CafeSettings;
  users: User[];
  onRefreshOrders?: () => void;
  currentUser?: User | null;
}

export const SalesReportsView: React.FC<SalesReportsViewProps> = ({
  orders,
  settings,
  users,
  onRefreshOrders,
  currentUser,
}) => {
  const [dateRangeType, setDateRangeType] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'PARTICULAR_DATE' | 'MONTH_WISE' | 'CUSTOM'>('TODAY');
  const [selectedParticularDate, setSelectedParticularDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // Multi-select & Deletion state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    mode: 'SINGLE' | 'SELECTED' | 'FILTERED_ALL';
    order?: Order;
    count?: number;
    totalAmount?: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Date filter
      const orderDateStr = o.date || new Date(o.timestamp).toISOString().split('T')[0];
      if (dateRangeType === 'TODAY' && orderDateStr !== todayStr) return false;
      if (dateRangeType === 'YESTERDAY' && orderDateStr !== yesterdayStr) return false;
      if (dateRangeType === 'PARTICULAR_DATE' && orderDateStr !== selectedParticularDate) return false;
      if (dateRangeType === 'MONTH_WISE' && !orderDateStr.startsWith(selectedMonth)) return false;
      if (dateRangeType === 'WEEK' && o.timestamp < sevenDaysAgo) return false;
      if (dateRangeType === 'CUSTOM') {
        if (orderDateStr < customStartDate || orderDateStr > customEndDate) return false;
      }

      // Payment filter
      if (paymentFilter !== 'ALL' && o.paymentMethod !== paymentFilter) return false;

      return true;
    });
  }, [orders, dateRangeType, selectedParticularDate, selectedMonth, customStartDate, customEndDate, paymentFilter, todayStr, yesterdayStr, sevenDaysAgo]);

  // Aggregate Metrics
  const grossSales = filteredOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const totalDiscounts = filteredOrders.reduce((sum, o) => sum + o.discountAmount, 0);
  const totalTaxes = filteredOrders.reduce((sum, o) => sum + o.taxAmount, 0);
  const netSales = filteredOrders.reduce((sum, o) => sum + o.grandTotal, 0);

  const completedOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'COMPLETED'), [filteredOrders]);
  const cancelledOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REFUNDED'), [filteredOrders]);

  const cashRevenue = useMemo(
    () => completedOrders.filter((o) => o.paymentMethod === 'CASH').reduce((s, o) => s + o.grandTotal, 0),
    [completedOrders]
  );
  const upiRevenue = useMemo(
    () => completedOrders.filter((o) => o.paymentMethod === 'UPI').reduce((s, o) => s + o.grandTotal, 0),
    [completedOrders]
  );
  const cardRevenue = useMemo(
    () => completedOrders.filter((o) => o.paymentMethod === 'CARD').reduce((s, o) => s + o.grandTotal, 0),
    [completedOrders]
  );
  const splitRevenue = useMemo(
    () => completedOrders.filter((o) => o.paymentMethod === 'SPLIT').reduce((s, o) => s + o.grandTotal, 0),
    [completedOrders]
  );

  const getReportPeriodLabel = () => {
    switch (dateRangeType) {
      case 'TODAY':
        return `Daily_${todayStr}`;
      case 'YESTERDAY':
        return `Daily_${yesterdayStr}`;
      case 'PARTICULAR_DATE':
        return `Date_${selectedParticularDate}`;
      case 'MONTH_WISE':
        return `Month_${selectedMonth}`;
      case 'WEEK':
        return `Past_7_Days_${todayStr}`;
      case 'CUSTOM':
        return `Custom_${customStartDate}_to_${customEndDate}`;
      default:
        return todayStr;
    }
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    posSound.playSuccess();
  };

  // 1. Export Detailed Transactions CSV for Bookkeeping
  const exportDetailedCSV = () => {
    const headers = [
      'Invoice / Order #',
      'Date',
      'Time',
      'Order Type',
      'Table / Area',
      'Items Breakdown',
      'Total Items',
      'Gross Subtotal',
      'Discount',
      'Tax / GST',
      'Net Grand Total',
      'Payment Mode',
    ];

    const rows = filteredOrders.map((o) => {
      const itemsSummary = (o.items || [])
        .map((i: any) => {
          const pName = String(i.productName || i.name || 'Item').replace(/"/g, '""');
          const variant = i.selectedVariant ? ` (${i.selectedVariant.name || i.selectedVariant})` : '';
          return `${i.quantity || 1}x ${pName}${variant}`;
        })
        .join('; ');

      return [
        `"${o.orderNumber || ''}"`,
        `"${o.date || ''}"`,
        `"${o.time || ''}"`,
        `"${o.orderType || ''}"`,
        `"${o.tableNumber || '-'}"`,
        `"${itemsSummary}"`,
        o.itemCount || 0,
        (Number(o.subtotal) || 0).toFixed(2),
        (Number(o.discountAmount) || 0).toFixed(2),
        (Number(o.taxAmount) || 0).toFixed(2),
        (Number(o.grandTotal) || 0).toFixed(2),
        `"${o.paymentMethod || ''}"`,
      ];
    });

    // Bookkeeping & Reconciliation Audit Block
    const auditSummaryRows = [
      [],
      ['--- FINANCIAL BOOKKEEPING SUMMARY & RECONCILIATION ---'],
      ['Cafe / Business', `"${String(settings?.cafeName || 'Cafe POS').replace(/"/g, '""')}"`],
      ['Reporting Period', `"${String(getReportPeriodLabel() || '').replace(/_/g, ' ')}"`],
      ['Generated On', `"${new Date().toLocaleString()}"`],
      ['Currency', `"${settings?.currencySymbol || '$'} (${settings?.currency || 'USD'})"`],
      ['Total Completed Invoices', completedOrders.length],
      ['Gross Subtotal', (Number(grossSales) || 0).toFixed(2)],
      ['Total Discounts Given', (Number(totalDiscounts) || 0).toFixed(2)],
      ['Total GST / Tax Collected', (Number(totalTaxes) || 0).toFixed(2)],
      ['Net Total Revenue', (Number(netSales) || 0).toFixed(2)],
      ['Cash Collections', (Number(cashRevenue) || 0).toFixed(2)],
      ['UPI / QR Collections', (Number(upiRevenue) || 0).toFixed(2)],
      ['Card Collections', (Number(cardRevenue) || 0).toFixed(2)],
      ['Split Payment Collections', (Number(splitRevenue) || 0).toFixed(2)],
      ['Voided / Cancelled Orders', cancelledOrders.length],
      ['Voided Revenue', (Number(cancelledOrders.reduce((s, o) => s + o.grandTotal, 0)) || 0).toFixed(2)],
    ];

    const allLines = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      ...auditSummaryRows.map((r) => r.join(',')),
    ];

    downloadCSV(allLines.join('\n'), `SalesReport_Detailed_${getReportPeriodLabel()}.csv`);
  };

  // 2. Export Daily / Monthly Summary CSV (Day-by-Day ledger for Bookkeepers/Accountants)
  const exportDailySummaryCSV = () => {
    const dailyMap: Record<
      string,
      {
        date: string;
        ordersCount: number;
        gross: number;
        discount: number;
        tax: number;
        net: number;
        cash: number;
        upi: number;
        card: number;
        split: number;
        cancelledCount: number;
        cancelledValue: number;
      }
    > = {};

    filteredOrders.forEach((o) => {
      const d = o.date || new Date(o.timestamp).toISOString().split('T')[0];
      if (!dailyMap[d]) {
        dailyMap[d] = {
          date: d,
          ordersCount: 0,
          gross: 0,
          discount: 0,
          tax: 0,
          net: 0,
          cash: 0,
          upi: 0,
          card: 0,
          split: 0,
          cancelledCount: 0,
          cancelledValue: 0,
        };
      }

      if (o.status === 'COMPLETED') {
        dailyMap[d].ordersCount += 1;
        dailyMap[d].gross += Number(o.subtotal) || 0;
        dailyMap[d].discount += Number(o.discountAmount) || 0;
        dailyMap[d].tax += Number(o.taxAmount) || 0;
        dailyMap[d].net += Number(o.grandTotal) || 0;
        if (o.paymentMethod === 'CASH') dailyMap[d].cash += Number(o.grandTotal) || 0;
        else if (o.paymentMethod === 'UPI') dailyMap[d].upi += Number(o.grandTotal) || 0;
        else if (o.paymentMethod === 'CARD') dailyMap[d].card += Number(o.grandTotal) || 0;
        else if (o.paymentMethod === 'SPLIT') dailyMap[d].split += Number(o.grandTotal) || 0;
      } else {
        dailyMap[d].cancelledCount += 1;
        dailyMap[d].cancelledValue += Number(o.grandTotal) || 0;
      }
    });

    const headers = [
      'Date',
      'Day of Week',
      'Completed Orders',
      'Gross Sales',
      'Discounts',
      'GST / Tax Collected',
      'Net Revenue',
      'Cash Collections',
      'UPI Collections',
      'Card Collections',
      'Split Collections',
      'Cancelled / Refunded Count',
      'Cancelled Value',
    ];

    const sortedDates = Object.keys(dailyMap).sort();
    const rows = sortedDates.map((dStr) => {
      const d = dailyMap[dStr];
      const dayName = new Date(dStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      return [
        `"${d.date}"`,
        `"${dayName}"`,
        d.ordersCount,
        d.gross.toFixed(2),
        d.discount.toFixed(2),
        d.tax.toFixed(2),
        d.net.toFixed(2),
        d.cash.toFixed(2),
        d.upi.toFixed(2),
        d.card.toFixed(2),
        d.split.toFixed(2),
        d.cancelledCount,
        d.cancelledValue.toFixed(2),
      ];
    });

    // Total reconciliation row
    const totalRow = [
      '"TOTAL / SUMMARY"',
      '""',
      completedOrders.length,
      grossSales.toFixed(2),
      totalDiscounts.toFixed(2),
      totalTaxes.toFixed(2),
      netSales.toFixed(2),
      cashRevenue.toFixed(2),
      upiRevenue.toFixed(2),
      cardRevenue.toFixed(2),
      splitRevenue.toFixed(2),
      cancelledOrders.length,
      cancelledOrders.reduce((s, o) => s + o.grandTotal, 0).toFixed(2),
    ];

    const allLines = [headers.join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')];
    downloadCSV(allLines.join('\n'), `SalesSummary_Daily_${getReportPeriodLabel()}.csv`);
  };

  // Multi-selection calculations
  const allFilteredSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedOrderIds.includes(o.id));
  const someFilteredSelected = filteredOrders.some((o) =>
    selectedOrderIds.includes(o.id)
  );

  const selectedOrdersList = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.id)),
    [orders, selectedOrderIds]
  );

  const selectedTotalAmount = useMemo(
    () => selectedOrdersList.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0),
    [selectedOrdersList]
  );

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Unselect filtered items
      setSelectedOrderIds((prev) =>
        prev.filter((id) => !filteredOrders.some((o) => o.id === id))
      );
    } else {
      // Select all filtered items
      const currentIds = filteredOrders.map((o) => o.id);
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);

    try {
      if (deleteModal.mode === 'SINGLE' && deleteModal.order) {
        const orderId = deleteModal.order.id;
        posStorage.deleteOrder(orderId);
        await apiSync.deleteOrderFromServer(orderId);
        setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
        setFeedbackToast(`Deleted invoice #${deleteModal.order.orderNumber}`);
      } else if (deleteModal.mode === 'SELECTED') {
        const idsToDelete = [...selectedOrderIds];
        posStorage.deleteOrders(idsToDelete);
        await apiSync.deleteOrdersFromServer(idsToDelete);
        setSelectedOrderIds([]);
        setFeedbackToast(`Successfully deleted ${idsToDelete.length} invoice record(s)`);
      } else if (deleteModal.mode === 'FILTERED_ALL') {
        const idsToDelete = filteredOrders.map((o) => o.id);
        posStorage.deleteOrders(idsToDelete);
        await apiSync.deleteOrdersFromServer(idsToDelete);
        setSelectedOrderIds((prev) =>
          prev.filter((id) => !idsToDelete.includes(id))
        );
        setFeedbackToast(`Cleared ${idsToDelete.length} invoice record(s) from current report`);
      }

      posSound.playDelete();
      onRefreshOrders?.();
    } catch (err) {
      console.error('Failed to delete report data:', err);
      setFeedbackToast('Error deleting records. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteModal(null);
      setTimeout(() => setFeedbackToast(null), 4000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-3 sm:space-y-5 select-none">
      {/* Toast Feedback Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {deleteModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {deleteModal.mode === 'SINGLE'
                    ? `Delete Invoice #${deleteModal.order?.orderNumber}?`
                    : deleteModal.mode === 'SELECTED'
                    ? `Delete ${deleteModal.count} Selected Invoices?`
                    : `Delete All ${deleteModal.count} Filtered Invoices?`}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {deleteModal.mode === 'SINGLE' ? (
                    <>
                      Are you sure you want to permanently delete invoice{' '}
                      <span className="font-bold text-slate-800">
                        #{deleteModal.order?.orderNumber}
                      </span>{' '}
                      ({settings.currencySymbol}
                      {(Number(deleteModal.order?.grandTotal) || 0).toFixed(2)})?
                    </>
                  ) : (
                    <>
                      Are you sure you want to permanently delete{' '}
                      <span className="font-bold text-slate-800">{deleteModal.count}</span>{' '}
                      invoice records totaling{' '}
                      <span className="font-bold text-slate-800">
                        {settings.currencySymbol}
                        {(Number(deleteModal.totalAmount) || 0).toFixed(2)}
                      </span>
                      ?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-[11px] text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Irreversible Database Action
              </p>
              <p className="text-rose-700">
                This record will be permanently deleted from the SQLite database, sales reports, and revenue ledgers.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Export Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 leading-tight">
            Financial & Sales Reports Generator
          </h2>
          <p className="text-xs text-slate-500">
            Export daily/monthly sales reports, tax audits, and revenue reconciliations for external bookkeeping
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Export to CSV */}
          <button
            onClick={exportDetailedCSV}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors active-press"
            title="Download detailed transaction ledger CSV for bookkeeping"
          >
            <Download className="w-4 h-4" />
            <span>Export to CSV</span>
          </button>

          {/* Daily / Bookkeeping Summary CSV */}
          <button
            onClick={exportDailySummaryCSV}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors active-press"
            title="Download day-by-day aggregated ledger CSV for external accountants"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Daily Bookkeeping (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Parameters Section */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Range Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'PARTICULAR_DATE', label: 'Particular Date' },
              { id: 'MONTH_WISE', label: 'Month Wise' },
              { id: 'WEEK', label: 'This Week' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateRangeType(d.id as typeof dateRangeType)}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap active-press ${
                  dateRangeType === d.id
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Particular Date Input */}
          {dateRangeType === 'PARTICULAR_DATE' && (
            <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl shadow-2xs animate-in fade-in duration-150">
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
          {dateRangeType === 'MONTH_WISE' && (
            <div className="flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl shadow-2xs animate-in fade-in duration-150">
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

          {/* Custom Date Inputs */}
          {dateRangeType === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Secondary Selectors */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="w-full sm:w-72">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Payment Method</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium outline-none focus:border-blue-600"
            >
              <option value="ALL">All Payment Types</option>
              <option value="CASH">Cash Only</option>
              <option value="UPI">UPI / QR Only</option>
              <option value="CARD">Card Only</option>
              <option value="SPLIT">Split Payments</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Financial Breakdown Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Sales</span>
          <span className="font-mono font-extrabold text-slate-900 text-base">
            {settings.currencySymbol}{(Number(grossSales) || 0).toFixed(2)}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Discounts</span>
          <span className="font-mono font-extrabold text-rose-600 text-base">
            -{settings.currencySymbol}{(Number(totalDiscounts) || 0).toFixed(2)}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">GST Collected</span>
          <span className="font-mono font-extrabold text-amber-700 text-base">
            +{settings.currencySymbol}{(Number(totalTaxes) || 0).toFixed(2)}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Collected</span>
          <span className="font-mono font-extrabold text-emerald-700 text-base">
            {settings.currencySymbol}{(Number(netSales) || 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Itemized Order Registry */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Bulk Selection Notification Bar */}
        {selectedOrderIds.length > 0 && (
          <div className="bg-rose-50/90 border-b border-rose-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <span>{selectedOrderIds.length} invoice(s) selected</span>
              <span className="text-rose-700 font-mono font-medium">
                (Total: {settings.currencySymbol}{selectedTotalAmount.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedOrderIds([])}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Deselect All
              </button>
              <button
                onClick={() =>
                  setDeleteModal({
                    isOpen: true,
                    mode: 'SELECTED',
                    count: selectedOrderIds.length,
                    totalAmount: selectedTotalAmount,
                  })
                }
                className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer active-press"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedOrderIds.length})</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Filtered Sales Ledger ({filteredOrders.length} Records)
            </h3>
            <p className="text-[11px] text-slate-400">
              Complete invoice records with financial breakdown for the selected period
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportDetailedCSV}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer active-press"
              title="Download CSV report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export to CSV</span>
            </button>
            <button
              onClick={() =>
                setDeleteModal({
                  isOpen: true,
                  mode: 'FILTERED_ALL',
                  count: filteredOrders.length,
                  totalAmount: netSales,
                })
              }
              disabled={filteredOrders.length === 0}
              className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer active-press disabled:opacity-40 disabled:pointer-events-none"
              title="Permanently delete all records in this filtered report"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Filtered Records</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = !allFilteredSelected && someFilteredSelected;
                      }
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                    title="Select all filtered invoices"
                  />
                </th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Order Type</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">Discount</th>
                <th className="py-3 px-3 text-right">Tax</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 text-center">Payment</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 font-sans">
                    No sales invoice records found for this period.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isSelected = selectedOrderIds.includes(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(o.id)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{o.orderNumber}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600">
                        {o.date} {o.time}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-800 font-bold">
                        {o.orderType}{' '}
                        {o.tableNumber ? (
                          <span className="text-slate-500 font-normal text-[10px]">
                            ({o.tableNumber})
                          </span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {settings.currencySymbol}
                        {(Number(o.subtotal) || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600">
                        {(Number(o.discountAmount) || 0) > 0
                          ? `-${settings.currencySymbol}${(Number(o.discountAmount) || 0).toFixed(2)}`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        {settings.currencySymbol}
                        {(Number(o.taxAmount) || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {settings.currencySymbol}
                        {(Number(o.grandTotal) || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                          {o.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() =>
                            setDeleteModal({
                              isOpen: true,
                              mode: 'SINGLE',
                              order: o,
                              count: 1,
                              totalAmount: Number(o.grandTotal) || 0,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={`Delete invoice #${o.orderNumber}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
