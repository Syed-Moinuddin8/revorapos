import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HeldOrder, CafeSettings, User, CartItem } from '../../types';
import { posStorage } from '../../services/storage';
import { apiSync } from '../../services/apiSync';
import { posSound } from '../../services/sound';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Flame,
  Bell,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Search,
  Printer,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Check,
  QrCode,
  AlertTriangle,
  Utensils,
  Receipt,
  Eye,
  Filter,
  ArrowUpDown,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../common/CustomDropdown';

interface KitchenDisplayViewProps {
  heldOrders: HeldOrder[];
  settings: CafeSettings;
  currentUser: User;
  onRecallOrder?: (order: HeldOrder) => void;
  onSwitchTab?: (tab: string) => void;
}

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  heldOrders,
  settings,
  currentUser,
  onRecallOrder,
  onSwitchTab,
}) => {
  // Filter states
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PREPARING' | 'READY' | 'SERVED'>('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'DINE_IN' | 'TAKEAWAY'>('ALL');
  const [sortOrder, setSortOrder] = useState<'OLDEST_FIRST' | 'NEWEST_FIRST'>('OLDEST_FIRST');

  const orderTypeOptions: DropdownOption<'ALL' | 'DINE_IN' | 'TAKEAWAY'>[] = [
    { value: 'ALL', label: 'All Types', icon: <Utensils className="w-3.5 h-3.5 text-slate-400" /> },
    { value: 'DINE_IN', label: 'Dine-In', icon: <Utensils className="w-3.5 h-3.5 text-blue-500" /> },
    { value: 'TAKEAWAY', label: 'Takeaway', icon: <Receipt className="w-3.5 h-3.5 text-amber-500" /> },
  ];
  const [searchQuery, setSearchQuery] = useState('');
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());
  const [selectedTicketForKot, setSelectedTicketForKot] = useState<HeldOrder | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live timer tick every second for elapsed time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Active queue metrics & wait time tracker
  const queueStats = useMemo(() => {
    const preparingTickets = heldOrders.filter(
      (o) => (o.kitchenStatus || 'PREPARING') === 'PREPARING'
    );
    if (preparingTickets.length === 0) {
      return { count: 0, longestWaitMins: 0, longestWaitFormatted: '0m 00s', urgentCount: 0 };
    }
    const oldestTimestamp = Math.min(...preparingTickets.map((o) => o.createdAt || nowTimestamp));
    const maxDiffMs = Math.max(0, nowTimestamp - oldestTimestamp);
    const maxMins = Math.floor(maxDiffMs / 60000);
    const maxSecs = Math.floor((maxDiffMs % 60000) / 1000);

    const urgentCount = preparingTickets.filter((o) => {
      const waitMins = Math.floor(Math.max(0, nowTimestamp - (o.createdAt || nowTimestamp)) / 60000);
      return waitMins >= 10;
    }).length;

    return {
      count: preparingTickets.length,
      longestWaitMins: maxMins,
      longestWaitFormatted: `${maxMins}m ${String(maxSecs).padStart(2, '0')}s`,
      urgentCount,
    };
  }, [heldOrders, nowTimestamp]);

  // Fullscreen toggle: only make the kitchen display screen fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        } else {
          // Fallback if browser/iframe does not support or allow requestFullscreen
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        } else {
          setIsFullscreen(false);
        }
      }
    } catch {
      // In case iframe restricts fullscreen permission, toggle UI fullscreen state
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement && document.fullscreenElement === containerRef.current;
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(isNowFullscreen);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle ESC key to exit fullscreen even when in overlay mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Filtered orders (strictly held orders)
  const filteredOrders = useMemo(() => {
    return heldOrders
      .filter((ord) => {
        const orderStatus = ord.kitchenStatus || 'PREPARING';
        if (statusFilter !== 'ALL' && orderStatus !== statusFilter) return false;
        if (orderTypeFilter !== 'ALL' && ord.orderType !== orderTypeFilter) return false;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchTable = (ord.tableNumber || '').toLowerCase().includes(query);
          const matchCust = (ord.customerName || ord.customer?.name || '').toLowerCase().includes(query);
          const matchNotes = (ord.notes || '').toLowerCase().includes(query);
          const rawItems = ord.cartItems || ord.items || [];
          const matchItem = rawItems.some((it) =>
            (it.product?.name || (it as any).productName || '').toLowerCase().includes(query)
          );
          if (!matchTable && !matchCust && !matchNotes && !matchItem) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Priority: PREPARING first, then READY, then SERVED.
        const statusWeight: Record<string, number> = { PREPARING: 1, READY: 2, SERVED: 3 };
        const statusA = statusWeight[a.kitchenStatus || 'PREPARING'] || 1;
        const statusB = statusWeight[b.kitchenStatus || 'PREPARING'] || 1;
        if (statusA !== statusB) return statusA - statusB;

        // Within same status, sort by wait time to prioritize older orders
        if (sortOrder === 'NEWEST_FIRST') {
          return (b.createdAt || 0) - (a.createdAt || 0);
        }
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }, [heldOrders, statusFilter, orderTypeFilter, searchQuery, sortOrder]);

  // Counts by status
  const counts = useMemo(() => {
    let preparing = 0;
    let ready = 0;
    let served = 0;
    heldOrders.forEach((o) => {
      const st = o.kitchenStatus || 'PREPARING';
      if (st === 'PREPARING') preparing++;
      else if (st === 'READY') ready++;
      else if (st === 'SERVED') served++;
    });
    return {
      all: heldOrders.length,
      preparing,
      ready,
      served,
    };
  }, [heldOrders]);

  // Update kitchen status
  const handleUpdateStatus = (heldId: string, nextStatus: 'PREPARING' | 'READY' | 'SERVED') => {
    const updated = posStorage.updateHeldOrderKitchenStatus(heldId, nextStatus);
    if (updated) {
      apiSync.syncHeldOrderToServer(updated);
      if (soundAlerts) {
        if (nextStatus === 'READY') {
          posSound.playBell();
        } else if (nextStatus === 'SERVED') {
          posSound.playSuccess();
        } else {
          posSound.playItemAdd();
        }
      }
    }
  };

  // Toggle item completion strike-through
  const handleToggleItem = (heldId: string, itemIdx: number) => {
    const updated = posStorage.toggleHeldOrderItemCompletion(heldId, itemIdx);
    if (updated) {
      apiSync.syncHeldOrderToServer(updated);
      if (soundAlerts) posSound.playItemAdd();
    }
  };

  // Format elapsed time
  const formatElapsed = (createdAt: number) => {
    const diffMs = Math.max(0, nowTimestamp - createdAt);
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  // Comprehensive elapsed & priority calculation to prioritize older orders
  const getElapsedUrgencyInfo = (createdAt: number, status: string) => {
    const diffMs = Math.max(0, nowTimestamp - (createdAt || nowTimestamp));
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    let formattedTime = `${mins}m ${String(secs).padStart(2, '0')}s`;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      formattedTime = `${hrs}h ${remainingMins}m`;
    }

    if (status === 'SERVED') {
      return {
        diffMs,
        mins,
        secs,
        formattedTime,
        priorityLabel: 'Served',
        priorityTag: 'bg-slate-100 text-slate-600 border-slate-200',
        bannerClass: 'bg-slate-50 border-slate-200 text-slate-600',
        cardBorderClass: 'border-t-4 border-t-slate-300 border-slate-200 opacity-90',
        iconBgClass: 'bg-slate-200 text-slate-600',
        isCritical: false,
        isUrgent: false,
      };
    }

    if (status === 'READY') {
      return {
        diffMs,
        mins,
        secs,
        formattedTime,
        priorityLabel: 'Ready for Pickup',
        priorityTag: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold',
        bannerClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
        cardBorderClass: 'border-t-4 border-t-emerald-500 border-slate-200 shadow-2xs',
        iconBgClass: 'bg-emerald-100 text-emerald-800',
        isCritical: false,
        isUrgent: false,
      };
    }

    // Status is PREPARING (active ticket)
    if (mins >= 15) {
      return {
        diffMs,
        mins,
        secs,
        formattedTime,
        priorityLabel: 'Urgent (>15m)',
        priorityTag: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        bannerClass: 'bg-rose-50/60 border-rose-100 text-rose-950',
        cardBorderClass: 'border-t-4 border-t-rose-500 border-slate-200 shadow-2xs',
        iconBgClass: 'bg-rose-100 text-rose-700',
        isCritical: true,
        isUrgent: true,
      };
    }

    if (mins >= 10) {
      return {
        diffMs,
        mins,
        secs,
        formattedTime,
        priorityLabel: 'High (10m+)',
        priorityTag: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
        bannerClass: 'bg-amber-50/60 border-amber-100 text-amber-950',
        cardBorderClass: 'border-t-4 border-t-amber-500 border-slate-200 shadow-2xs',
        iconBgClass: 'bg-amber-100 text-amber-800',
        isCritical: false,
        isUrgent: true,
      };
    }

    if (mins >= 5) {
      return {
        diffMs,
        mins,
        secs,
        formattedTime,
        priorityLabel: 'In Prep (5m+)',
        priorityTag: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        bannerClass: 'bg-amber-50/40 border-amber-100/70 text-amber-900',
        cardBorderClass: 'border-t-4 border-t-amber-400 border-slate-200 shadow-2xs',
        iconBgClass: 'bg-amber-100 text-amber-800',
        isCritical: false,
        isUrgent: false,
      };
    }

    return {
      diffMs,
      mins,
      secs,
      formattedTime,
      priorityLabel: 'On Track',
      priorityTag: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium',
      bannerClass: 'bg-slate-50/70 border-slate-100 text-slate-800',
      cardBorderClass: 'border-t-4 border-t-blue-500 border-slate-200 shadow-2xs',
      iconBgClass: 'bg-blue-100 text-blue-800',
      isCritical: false,
      isUrgent: false,
    };
  };

  // Color-coded elapsed badge
  const getElapsedBadgeClass = (createdAt: number, status: string) => {
    if (status === 'SERVED') {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    if (status === 'READY') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
    }
    const diffMs = nowTimestamp - createdAt;
    const mins = diffMs / 60000;
    if (mins > 12) {
      return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold animate-pulse';
    }
    if (mins > 6) {
      return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
    }
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-medium';
  };

  // Print Kitchen Order Ticket (KOT)
  const handlePrintKot = (ticket: HeldOrder) => {
    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) return;

    const rawItems = ticket.cartItems || ticket.items || [];
    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>KOT - ${ticket.tableNumber || 'Order'}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 76mm;
              margin: 0 auto;
              padding: 10px;
              color: #000;
              background: #fff;
              font-size: 13px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .table-header {
              font-size: 20px;
              font-weight: 900;
              margin: 4px 0;
              border: 2px solid #000;
              padding: 4px;
              text-align: center;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 14px;
            }
            .item-qty {
              font-size: 16px;
              font-weight: 900;
              margin-right: 8px;
            }
            .notes-box {
              border: 1px solid #000;
              padding: 5px;
              margin: 6px 0;
              font-weight: bold;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="text-center font-bold" style="font-size: 16px;">*** KITCHEN ORDER TICKET (KOT) ***</div>
          <div class="text-center" style="font-size: 11px;">${settings.cafeName || 'ARTISAN CAFE'}</div>
          
          <div class="table-header">
            ${ticket.tableNumber ? `TABLE: ${ticket.tableNumber}` : `TYPE: ${ticket.orderType}`}
          </div>

          <div style="font-size: 11px; margin-top: 4px;">
            <div>Hold Ticket: #${ticket.holdNumber}</div>
            <div>Time Sent: ${ticket.heldAt || new Date(ticket.createdAt).toLocaleTimeString()}</div>
            <div>Source: ${ticket.source === 'CUSTOMER_QR' ? 'Customer Table QR' : 'POS Cashier'}</div>
          </div>

          <div class="divider"></div>

          ${ticket.notes ? `<div class="notes-box">SPECIAL INSTRUCTIONS:<br/>${ticket.notes}</div>` : ''}

          <div class="font-bold" style="margin-bottom: 4px;">ITEMS TO PREPARE:</div>
          <div>
            ${rawItems.map((it: any) => `
              <div class="item-row">
                <div>
                  <span class="item-qty">[ ${it.quantity}x ]</span>
                  <span class="font-bold">${it.product?.name || it.productName || 'Item'}</span>
                  ${it.note ? `<div style="font-size: 11px; margin-left: 36px; font-style: italic;">* ${it.note}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="divider"></div>
          <div class="text-center" style="font-size: 11px; margin-top: 8px;">
            Expedite with care • Kitchen KDS
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-50 text-slate-800 select-none ${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen overflow-hidden'
          : 'flex-1 h-full overflow-hidden'
      }`}
    >
      {/* KDS TOP CONTROL HEADER */}
      {/* TOP KDS HEADER */}
      <header className="bg-white border-b border-slate-200 px-3.5 sm:px-5 py-3 shadow-2xs flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Branding & Status Mode */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
              <ChefHat className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate">
                  Kitchen Display (KDS)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                  Held Orders
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Sync
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 font-medium truncate mt-0.5">
                Food & drink prep queue • Separated from cashier order-taking
              </p>
            </div>
          </div>

          {/* Right: Controls & Shortcuts */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Queue Wait-Time Tracker (Desktop) */}
            {queueStats.count > 0 && (
              <div className="hidden xl:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${queueStats.longestWaitMins >= 10 ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`} />
                  <span className="text-slate-500 font-medium">Longest Wait:</span>
                  <span className={`font-mono font-black ${queueStats.longestWaitMins >= 15 ? 'text-rose-700 font-extrabold' : queueStats.longestWaitMins >= 10 ? 'text-amber-700 font-bold' : 'text-slate-900'}`}>
                    {queueStats.longestWaitFormatted}
                  </span>
                </div>
                {queueStats.urgentCount > 0 && (
                  <>
                    <div className="w-px h-3.5 bg-slate-200" />
                    <span className="inline-flex items-center gap-1 font-extrabold text-rose-700 text-[11px] bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                      {queueStats.urgentCount} Delayed
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Sound alerts toggle */}
            <button
              onClick={() => {
                setSoundAlerts(!soundAlerts);
                posSound.playItemAdd();
              }}
              className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold transition-all border active-press ${
                soundAlerts
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
              }`}
              title="Toggle Kitchen Alert Chimes"
            >
              {soundAlerts ? <Volume2 className="w-4 h-4 text-amber-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span className="hidden md:inline">{soundAlerts ? 'Chimes On' : 'Muted'}</span>
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors active-press"
              title="Fullscreen Display Mode"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden md:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            {/* Back to POS billing (Desktop only) */}
            {onSwitchTab && (
              <button
                onClick={() => onSwitchTab('pos')}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-colors active-press"
              >
                <span>POS Billing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* KDS FILTER & SEARCH TOOLBAR */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs with counts */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 text-xs font-semibold overflow-x-auto no-scrollbar scroll-smooth">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 active-press ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>All Orders</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                  statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('PREPARING')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 active-press ${
                statusFilter === 'PREPARING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Preparing</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                  statusFilter === 'PREPARING' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {counts.preparing}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('READY')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 active-press ${
                statusFilter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100/70'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="sm:hidden">Ready</span>
              <span className="hidden sm:inline">Ready for Service</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                  statusFilter === 'READY' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {counts.ready}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('SERVED')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 active-press ${
                statusFilter === 'SERVED'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-800 hover:bg-indigo-100/70'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Served</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                  statusFilter === 'SERVED' ? 'bg-white text-indigo-800' : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {counts.served}
              </span>
            </button>
          </div>

          {/* Search, Type filter, and Queue Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search table, guest, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Toggle (Wait Time vs Newest) */}
              <button
                onClick={() => setSortOrder(sortOrder === 'OLDEST_FIRST' ? 'NEWEST_FIRST' : 'OLDEST_FIRST')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200/90 transition-colors shadow-2xs whitespace-nowrap active-press"
                title="Toggle queue sorting order"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="sm:hidden">{sortOrder === 'OLDEST_FIRST' ? 'Oldest First' : 'Newest First'}</span>
                <span className="hidden sm:inline">{sortOrder === 'OLDEST_FIRST' ? 'Wait Time: Oldest First' : 'Newest First'}</span>
              </button>

              <CustomDropdown
                id="kds-order-type-dropdown"
                value={orderTypeFilter}
                options={orderTypeOptions}
                onChange={(val) => setOrderTypeFilter(val)}
                align="right"
                buttonClassName="bg-slate-50 hover:bg-slate-100 text-xs px-3 py-2 rounded-xl border-slate-200/90 font-semibold shrink-0"
              />
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50">
        {filteredOrders.length === 0 ? (
          /* EMPTY STATE */
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
              <ChefHat className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {statusFilter === 'ALL'
                ? 'Kitchen Queue is Clear!'
                : `No ${statusFilter.toLowerCase()} tickets`}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              {statusFilter === 'ALL'
                ? 'No held orders waiting for preparation. New orders parked from POS billing or placed by customers via Table QR will automatically pop up here with alert chimes.'
                : `There are currently no orders in the '${statusFilter}' state. Switch filter to 'All Orders' or wait for new tickets.`}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {statusFilter !== 'ALL' && (
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
                >
                  View All Orders
                </button>
              )}
              {onSwitchTab && (
                <button
                  onClick={() => onSwitchTab('pos')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  Open POS to Park a Bill [F8]
                </button>
              )}
            </div>
          </div>
        ) : (
          /* TICKET CARDS GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((ticket) => {
              const rawItems = ticket.cartItems || ticket.items || [];
              const status = ticket.kitchenStatus || 'PREPARING';
              const completedIndices = ticket.completedItemIndices || [];
              const completedCount = completedIndices.length;
              const totalItemsCount = rawItems.length;
              const isAllItemsCompleted = totalItemsCount > 0 && completedCount >= totalItemsCount;
              const urgency = getElapsedUrgencyInfo(ticket.createdAt, status);

              return (
                <div
                  key={ticket.id}
                  className={`flex flex-col bg-white rounded-2xl border transition-all shadow-2xs hover:shadow-xs overflow-hidden ${urgency.cardBorderClass}`}
                >
                  {/* TICKET HEADER */}
                  <div
                    className={`p-3.5 border-b flex items-start justify-between gap-2.5 ${
                      status === 'PREPARING'
                        ? 'bg-amber-50/40 border-amber-100'
                        : status === 'READY'
                        ? 'bg-emerald-50/40 border-emerald-100'
                        : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <div className="min-w-0">
                      {/* Table / Order Type Title */}
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900 tracking-tight">
                          {ticket.tableNumber ? `Table ${ticket.tableNumber}` : ticket.orderType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            status === 'PREPARING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : status === 'READY'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Hold & Time meta */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
                        <span className="font-mono font-bold text-slate-700">
                          #HOLD-{String(ticket.holdNumber).padStart(2, '0')}
                        </span>
                        <span>•</span>
                        <span>{ticket.heldAt || new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {ticket.source === 'CUSTOMER_QR' && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-blue-600 font-bold">
                              <QrCode className="w-3 h-3" /> QR
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Order Grand Total */}
                    <div className="flex flex-col items-end text-right shrink-0">
                      <span className="text-xs text-slate-900 font-mono font-bold">
                        {settings.currencySymbol}{(Number(ticket.grandTotal) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* PROMINENT TIME ELAPSED INDICATOR BANNER */}
                  <div
                    className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 text-xs font-semibold ${urgency.bannerClass}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-2xs ${urgency.iconBgClass}`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 leading-none">
                          Elapsed
                        </span>
                        <span className="font-mono font-bold text-sm tracking-tight leading-none text-slate-900 mt-0.5">
                          {urgency.formattedTime}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap shadow-2xs ${urgency.priorityTag}`}
                    >
                      {urgency.priorityLabel}
                    </span>
                  </div>

                  {/* TIME ELAPSED BENCHMARK METER (for active orders) */}
                  {status === 'PREPARING' && (
                    <div className="px-3.5 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            urgency.isCritical
                              ? 'bg-rose-500'
                              : urgency.isUrgent
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(8, (urgency.mins / 15) * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-500 whitespace-nowrap">
                        {urgency.mins >= 15 ? '15m+ Wait' : `${15 - urgency.mins}m to 15m Target`}
                      </span>
                    </div>
                  )}

                  {/* SPECIAL INSTRUCTIONS CALLOUT */}
                  {ticket.notes && (
                    <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-bold uppercase text-[10px] tracking-wider text-amber-700 block">
                          Cooking Instructions:
                        </span>
                        <span className="font-medium text-amber-900">{ticket.notes}</span>
                      </div>
                    </div>
                  )}

                  {/* ITEM PREPARATION CHECKLIST */}
                  <div className="flex-1 p-3.5 space-y-2 overflow-y-auto max-h-72">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider pb-1.5 border-b border-slate-100">
                      <span>Items ({rawItems.length})</span>
                      <span>
                        {completedCount}/{totalItemsCount} Done
                      </span>
                    </div>

                    {rawItems.map((item: any, idx: number) => {
                      const isCompleted = completedIndices.includes(idx);
                      const productName = item.product?.name || item.productName || 'Item';
                      const isVeg = item.product?.isVeg ?? item.isVeg ?? true;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleItem(ticket.id, idx)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border min-h-[44px] ${
                            isCompleted
                              ? 'bg-slate-50 border-slate-200/80 opacity-60'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs active-press'
                          }`}
                        >
                          {/* Checkbox button */}
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors border ${
                              isCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white hover:border-blue-500'
                            }`}
                          >
                            {isCompleted && <Check className="w-3.5 h-3.5" />}
                          </div>

                          {/* Item Quantity Pill */}
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-xs font-bold flex-shrink-0 ${
                              isCompleted
                                ? 'bg-slate-100 text-slate-400'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {item.quantity}x
                          </span>

                          {/* Item Name & Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-semibold leading-tight truncate ${
                                  isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                                }`}
                              >
                                {productName}
                              </span>
                            </div>

                            {/* Item customized note */}
                            {item.note && (
                              <p className="text-[11px] text-amber-800 font-medium italic mt-0.5">
                                • {item.note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="px-3.5 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isAllItemsCompleted
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${totalItemsCount > 0 ? (completedCount / totalItemsCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      {totalItemsCount > 0 ? Math.round((completedCount / totalItemsCount) * 100) : 0}%
                    </span>
                  </div>

                  {/* STATUS ACTION FOOTER */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-100 space-y-2">
                    {/* Primary Status Transition */}
                    {status === 'PREPARING' && (
                      <button
                        onClick={() => handleUpdateStatus(ticket.id, 'READY')}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all active-press"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Mark Ready for Pickup</span>
                      </button>
                    )}

                    {status === 'READY' && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'SERVED')}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs shadow-xs transition-all active-press"
                        >
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          <span>Mark as Served to Table</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(ticket.id, 'PREPARING')}
                          className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Back to Preparing</span>
                        </button>
                      </div>
                    )}

                    {status === 'SERVED' && (
                      <div className="space-y-1.5">
                        {onRecallOrder && (
                          <button
                            onClick={() => onRecallOrder(ticket)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all active-press"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>Recall to Register / Bill [F8]</span>
                          </button>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Dispatched
                          </span>
                          <button
                            onClick={() => handleUpdateStatus(ticket.id, 'PREPARING')}
                            className="text-slate-500 hover:text-slate-800 font-medium underline text-[10px]"
                          >
                            Re-open
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ticket tools: Print KOT & Table total */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-700 font-mono font-bold">
                        {settings.currencySymbol}{(Number(ticket.grandTotal) || 0).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handlePrintKot(ticket)}
                        className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold transition-colors active-press py-0.5 px-2 rounded-lg hover:bg-slate-200"
                        title="Print Kitchen Order Ticket (KOT)"
                      >
                        <Printer className="w-3 h-3 text-slate-500" />
                        <span>Print KOT</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
