import React, { useState, useMemo } from 'react';
import {
  CartItem,
  OrderType,
  PaymentMethod,
  PaymentDetails,
  CafeSettings,
  User,
} from '../../types';
import { posSound } from '../../services/sound';
import {
  X,
  Banknote,
  Smartphone,
  CreditCard,
  ArrowRight,
  Receipt,
  RotateCcw,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  orderType: OrderType;
  tableNumber: string;
  subtotal: number;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  taxAmount: number;
  grandTotal: number;
  settings: CafeSettings;
  currentUser: User;
  onConfirmPayment: (paymentMethod: PaymentMethod, paymentDetails: PaymentDetails, customerData?: { name: string; phone: string; email?: string }, notes?: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  orderType,
  tableNumber,
  subtotal,
  discountType,
  discountValue,
  discountAmount,
  taxAmount,
  grandTotal,
  settings,
  currentUser,
  onConfirmPayment,
}) => {
  if (!isOpen) return null;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [upiRef, setUpiRef] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');

  const handleComplete = () => {
    if (paymentMethod === 'CASH') {
      onConfirmPayment(
        'CASH',
        {
          method: 'CASH',
          amountReceived: grandTotal,
          changeGiven: 0,
        },
        undefined,
        orderNotes
      );
    } else if (paymentMethod === 'UPI') {
      onConfirmPayment(
        'UPI',
        {
          method: 'UPI',
          upiReference: upiRef.trim() || `UPI-TXN-${Date.now().toString().slice(-6)}`,
        },
        undefined,
        orderNotes
      );
    } else if (paymentMethod === 'CARD') {
      onConfirmPayment(
        'CARD',
        {
          method: 'CARD',
          cardLast4: 'TERMINAL',
        },
        undefined,
        orderNotes
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Complete Payment & Settlement
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Order Type: <span className="font-bold text-blue-700">{orderType}</span> {tableNumber ? `• Table ${tableNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: Order Review (5 Cols) */}
          <div className="md:col-span-5 p-3.5 sm:p-6 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 sm:mb-3">
                Order Summary ({cartItems.reduce((a, b) => a + b.quantity, 0)} Items)
              </h3>

              {/* Items List */}
              <div className="space-y-1.5 max-h-36 sm:max-h-48 overflow-y-auto pr-1">
                {cartItems.map((ci) => (
                  <div
                    key={ci.product.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/60"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold text-slate-900 w-5">
                        {ci.quantity}x
                      </span>
                      <span className="truncate text-slate-800 font-medium">
                        {ci.product.name}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 shrink-0 ml-2">
                      {settings.currencySymbol}
                      {(Number((ci.unitPrice || 0) * (ci.quantity || 0)) || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="mt-3 sm:mt-4 pt-3 border-t border-slate-200 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-slate-900">{settings.currencySymbol}{(Number(subtotal) || 0).toFixed(2)}</span>
                </div>
                {(Number(discountAmount) || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Discount</span>
                    <span className="font-mono">-{settings.currencySymbol}{(Number(discountAmount) || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST / Tax ({settings.taxRate}%)</span>
                  <span className="font-mono font-semibold text-slate-900">+{settings.currencySymbol}{(Number(taxAmount) || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Geometric Balance Total Card */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 -translate-y-12 translate-x-10 rounded-full pointer-events-none"></div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-widest">
                Total Settlement Due
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight mt-1">
                {settings.currencySymbol}
                {(Number(grandTotal) || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Right Column: Payment Method Selection & Inputs (7 Cols) */}
          <div className="md:col-span-7 p-3.5 sm:p-6 space-y-4">
            {/* Payment Method Tabs */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-2">
                Select Settlement Mode
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[
                  { id: 'CASH', label: 'Cash', icon: Banknote },
                  { id: 'UPI', label: 'UPI', icon: Smartphone },
                  { id: 'CARD', label: 'Card / POS', icon: CreditCard },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = paymentMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setPaymentMethod(item.id as PaymentMethod);
                        posSound.playItemAdd();
                      }}
                      className={`flex flex-col items-center justify-center p-2.5 sm:p-3.5 rounded-2xl border transition-all active-press ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-1.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode-Specific Input Area */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              {/* CASH PAYMENT */}
              {paymentMethod === 'CASH' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold block text-sm">Cash Payment</span>
                    <span className="text-slate-600 text-xs">Collect exact cash from customer</span>
                  </div>
                  <span className="font-mono font-bold text-lg text-emerald-800">
                    {settings.currencySymbol}{(Number(grandTotal) || 0).toFixed(2)}
                  </span>
                </div>
              )}

              {/* UPI PAYMENT */}
              {paymentMethod === 'UPI' && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block text-sm">UPI Payment</span>
                      <span className="text-slate-600 text-xs">
                        {settings.upiId ? `Payee VPA: ${settings.upiId}` : 'Collect via UPI App / Soundbox'}
                      </span>
                    </div>
                    <span className="font-mono text-blue-900 text-lg font-bold">
                      {settings.currencySymbol}{(Number(grandTotal) || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      UPI Reference / UTR Number (Optional):
                    </label>
                    <input
                      type="text"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      placeholder="e.g. 423598129034"
                      className="w-full text-xs font-mono px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* CARD PAYMENT */}
              {paymentMethod === 'CARD' && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-900 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold block text-sm">Swipe / Tap on POS EDC Terminal</span>
                    <span className="text-slate-600 text-xs">Ready for card insertion, swipe, or contactless tap</span>
                  </div>
                  <span className="font-mono font-bold text-lg text-indigo-900">
                    {settings.currencySymbol}{(Number(grandTotal) || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Order Note */}
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1">
                Bill Notes (Optional):
              </label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Corporate billing, Special discount approved, VIP table..."
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors text-center"
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 active-press transition-all"
              >
                <span>Confirm Payment & Print [F6]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
