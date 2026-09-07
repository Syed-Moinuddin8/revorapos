import React from 'react';
import { HeldOrder, CafeSettings } from '../../types';
import { posSound } from '../../services/sound';
import { Clock, Trash2, ArrowRight, X, AlertCircle, QrCode, FileText, ChefHat, Flame, Bell, Sparkles } from 'lucide-react';

interface HeldOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldOrders: HeldOrder[];
  settings: CafeSettings;
  onRecallOrder: (heldOrder: HeldOrder) => void;
  onDeleteHeldOrder: (heldOrderId: string) => void;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({
  isOpen,
  onClose,
  heldOrders = [],
  settings,
  onRecallOrder,
  onDeleteHeldOrder,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Held & Table Orders Queue ({heldOrders.length})
              </h3>
              <p className="text-xs text-slate-500">
                Review and recall customer QR table orders or parked cashier carts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
          {heldOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No Held or Pending Table Orders</p>
              <p className="text-xs text-slate-400">
                When customers scan their table QR code or cashier holds a bill, orders will queue here for staff review.
              </p>
            </div>
          ) : (
            heldOrders.map((ho) => {
              const isQrOrder = ho.source === 'CUSTOMER_QR' || (ho.notes && ho.notes.includes('QR'));
              return (
                <div
                  key={ho.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isQrOrder
                      ? 'border-blue-300 bg-blue-50/40 hover:bg-blue-50/80 shadow-2xs'
                      : 'border-slate-200 bg-slate-50 hover:bg-amber-50/50'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900 text-sm">
                        Hold Ticket #{ho.holdNumber || ho.id.slice(-4)}
                      </span>

                      {isQrOrder && (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <QrCode className="w-3 h-3" />
                          <span>Table QR Order</span>
                        </span>
                      )}

                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isQrOrder ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {ho.orderType} {ho.tableNumber ? `• ${ho.tableNumber}` : ''}
                      </span>

                      {/* Kitchen Prep Status Indicator */}
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          ho.kitchenStatus === 'READY'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                            : ho.kitchenStatus === 'SERVED'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {ho.kitchenStatus === 'READY' ? (
                          <>
                            <Bell className="w-3 h-3 text-emerald-600" />
                            <span>Kitchen: Ready</span>
                          </>
                        ) : ho.kitchenStatus === 'SERVED' ? (
                          <>
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Kitchen: Served</span>
                          </>
                        ) : (
                          <>
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>Kitchen: Preparing</span>
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 truncate">
                      {(ho.items || ho.cartItems || []).map((i) => `${i.quantity}x ${i.product?.name || 'Item'}`).join(', ')}
                    </p>

                    {ho.notes && (
                      <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 inline-flex items-center gap-1.5 max-w-full truncate">
                        <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{String(ho.notes || '').replace(/^\[.*?\]\s*/, '')}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono pt-0.5">
                      <span>Held: {ho.heldAt || 'Recently'}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-800">
                        Total: {settings.currencySymbol}{(Number(ho.grandTotal) || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => {
                        onRecallOrder(ho);
                        posSound.playItemAdd();
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-white text-xs font-bold rounded-xl shadow-xs active-press transition-colors bg-blue-600 hover:bg-blue-700"
                    >
                      <span>Review & Bill [F8]</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        onDeleteHeldOrder(ho.id);
                        posSound.playDelete();
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Discard Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
