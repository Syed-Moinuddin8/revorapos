import React, { useState } from 'react';
import { CartItem, Customer, OrderType, CafeSettings, User } from '../../types';
import { posSound } from '../../services/sound';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MessageSquare,
  Tag,
  Percent,
  Receipt,
  PauseCircle,
  RotateCcw,
  UtensilsCrossed,
  ShoppingBag as BagIcon,
  Bike,
  X,
  Check,
  Edit2,
  QrCode,
  ArrowLeft,
} from 'lucide-react';

interface CurrentCartProps {
  cartItems: CartItem[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tableNumber: string;
  setTableNumber: (table: string) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onUpdateNote: (productId: string, note: string) => void;
  onClearCart: () => void;
  discountType: 'PERCENT' | 'FIXED';
  setDiscountType: (type: 'PERCENT' | 'FIXED') => void;
  discountValue: number;
  setDiscountValue: (val: number) => void;
  discountReason: string;
  setDiscountReason: (reason: string) => void;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  onHoldOrder: () => void;
  onProceedToCheckout: () => void;
  settings: CafeSettings;
  currentUser: User;
  onOpenTableQR?: (table?: string) => void;
  onCloseMobileCart?: () => void;
}

export const CurrentCart: React.FC<CurrentCartProps> = ({
  cartItems,
  orderType,
  setOrderType,
  tableNumber,
  setTableNumber,
  selectedCustomer,
  onOpenCustomerModal,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNote,
  onClearCart,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  discountReason,
  setDiscountReason,
  subtotal,
  discountAmount,
  taxAmount,
  grandTotal,
  onHoldOrder,
  onProceedToCheckout,
  settings,
  onOpenTableQR,
  onCloseMobileCart,
}) => {
  const [editingNoteForId, setEditingNoteForId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const totalItemCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);

  const handleOpenNote = (item: CartItem) => {
    setEditingNoteForId(item.product.id);
    setNoteText(item.note || '');
  };

  const handleSaveNote = () => {
    if (editingNoteForId) {
      onUpdateNote(editingNoteForId, noteText.trim());
      setEditingNoteForId(null);
      setNoteText('');
      posSound.playItemAdd();
    }
  };

  return (
    <aside className="w-full lg:w-88 xl:w-96 shrink-0 bg-white lg:border-l border-slate-200 flex flex-col h-full lg:h-[calc(100vh-105px)] shadow-xs select-none">
      {/* Mobile Top Header - visible when mobile drawer is open */}
      {onCloseMobileCart && (
        <div className="lg:hidden px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-2xs">
          <button
            onClick={onCloseMobileCart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl active-press transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">Current Order ({totalItemCount})</span>
          </div>
          {cartItems.length > 0 && (
            <button
              id="btn-mobile-clear-cart"
              onClick={() => {
                onClearCart();
                posSound.playDelete();
              }}
              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors active-press cursor-pointer"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {/* Order Header / Mode Selector */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
        {/* Order Type Tabs - Geometric Segmented Container */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-2xl">
          <button
            id="btn-order-type-dinein"
            onClick={() => {
              setOrderType('DINE_IN');
              posSound.playItemAdd();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active-press ${
              orderType === 'DINE_IN'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-blue-600" />
            <span>Dine-In</span>
          </button>
          <button
            id="btn-order-type-takeaway"
            onClick={() => {
              setOrderType('TAKEAWAY');
              posSound.playItemAdd();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active-press ${
              orderType === 'TAKEAWAY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BagIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Takeaway</span>
          </button>
          <button
            id="btn-order-type-delivery"
            onClick={() => {
              setOrderType('DELIVERY');
              posSound.playItemAdd();
            }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active-press ${
              orderType === 'DELIVERY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bike className="w-3.5 h-3.5 text-blue-600" />
            <span>Delivery</span>
          </button>
        </div>

        {/* Table Designation for Dine-In Only */}
        {orderType === 'DINE_IN' && (
          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-2xs">
            <span className="text-xs font-semibold text-slate-700">Table Designation</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-24">
                <input
                  id="input-cart-table-number"
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Table #"
                  className="w-full text-xs font-bold text-center px-2 py-1.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl outline-none transition-colors"
                />
              </div>
              {onOpenTableQR && (
                <button
                  id="btn-cart-table-qr"
                  type="button"
                  onClick={() => onOpenTableQR(tableNumber)}
                  className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-200 rounded-xl transition-colors shadow-2xs"
                  title="View & print Table QR Code"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 mb-1">Current Bill is Empty</h4>
            <p className="text-xs text-slate-400 max-w-[200px]">
              Click on menu items to add items to bill.
            </p>
          </div>
        ) : (
          cartItems.map((item) => {
            const lineTotal = item.unitPrice * item.quantity;
            return (
              <div
                key={item.product.id}
                className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  {/* Thumbnail */}
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-11 h-11 rounded-xl object-cover bg-slate-100 shrink-0 border border-slate-100"
                  />

                  {/* Title & Unit Price */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">
                        {item.product.name}
                      </h4>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 font-medium">
                      {settings.currencySymbol}
                      {(Number(item.unitPrice) || 0).toFixed(2)}
                    </div>

                    {/* Note badge */}
                    {item.note && (
                      <div className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full mt-1.5 inline-flex items-center gap-1 font-medium">
                        <MessageSquare className="w-2.5 h-2.5 text-blue-600" />
                        <span className="truncate max-w-[140px]">{item.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Line Total */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {settings.currencySymbol}
                      {(Number(lineTotal) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Stepper & Note Button Row */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenNote(item)}
                    className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                    title="Add special instructions for kitchen"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{item.note ? 'Edit Note' : '+ Note'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Stepper */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      <button
                        onClick={() => {
                          onUpdateQuantity(item.product.id, -1);
                          posSound.playQtyChange();
                        }}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs active-press"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold text-xs text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => {
                          onUpdateQuantity(item.product.id, 1);
                          posSound.playQtyChange();
                        }}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shadow-2xs active-press"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Delete Item */}
                    <button
                      onClick={() => {
                        onRemoveItem(item.product.id);
                        posSound.playDelete();
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active-press"
                      title="Remove item from bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Note Editing Popover */}
      {editingNoteForId && (
        <div className="p-3 bg-blue-50 border-t border-b border-blue-200 animate-in fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              Kitchen Instructions / Notes
            </span>
            <button
              onClick={() => setEditingNoteForId(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
            placeholder="e.g. Extra hot, Less sugar, No onion, Oat milk..."
            autoFocus
            className="w-full text-xs px-3 py-2 bg-white border border-blue-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 mb-2"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {['Less sugar', 'Extra hot', 'No ice', 'Mild spice'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setNoteText(preset)}
                  className="text-[10px] bg-white border border-blue-200 text-blue-900 px-2 py-0.5 rounded-full hover:bg-blue-100 font-medium"
                >
                  {preset}
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveNote}
              className="px-3 py-1 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Discount Configuration Modal */}
      {showDiscountModal && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              Apply Order Discount
            </span>
            <button
              onClick={() => setShowDiscountModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-200 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setDiscountType('PERCENT')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  discountType === 'PERCENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                % Percent
              </button>
              <button
                onClick={() => setDiscountType('FIXED')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  discountType === 'FIXED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                ₹ Flat Amount
              </button>
            </div>
            <input
              type="number"
              min="0"
              max={discountType === 'PERCENT' ? 100 : subtotal}
              value={discountValue || ''}
              onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
              placeholder={discountType === 'PERCENT' ? '10%' : '50'}
              className="flex-1 text-xs font-mono font-bold px-3 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600"
            />
          </div>

          <input
            type="text"
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            placeholder="Reason (e.g. Regular customer, Promo code, Staff)"
            className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none"
          />

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                setDiscountValue(0);
                setDiscountReason('');
                setShowDiscountModal(false);
              }}
              className="text-[11px] text-rose-600 hover:underline font-medium"
            >
              Remove Discount
            </button>
            <button
              onClick={() => setShowDiscountModal(false)}
              className="px-3.5 py-1 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Bill Calculation Summary */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-2">
        {/* Subtotal */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Subtotal ({totalItemCount} items)</span>
          <span className="font-mono font-semibold text-slate-900">
            {settings.currencySymbol}
            {(Number(subtotal) || 0).toFixed(2)}
          </span>
        </div>

        {/* Discount Row */}
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => setShowDiscountModal(true)}
            className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <Tag className="w-3 h-3" />
            <span>
              {(Number(discountAmount) || 0) > 0
                ? `Discount (${discountType === 'PERCENT' ? discountValue + '%' : 'Flat'})`
                : '+ Add Discount'}
            </span>
          </button>
          <span className={`font-mono font-semibold ${(Number(discountAmount) || 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {(Number(discountAmount) || 0) > 0 ? `-${settings.currencySymbol}${(Number(discountAmount) || 0).toFixed(2)}` : '₹0.00'}
          </span>
        </div>

        {/* Tax Row */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <span>GST / Tax ({settings.taxRate}%)</span>
            <span className="text-[10px] text-slate-400">
              {settings.isTaxInclusive ? '(Incl.)' : '(Excl.)'}
            </span>
          </span>
          <span className="font-mono font-semibold text-slate-900">
            +{settings.currencySymbol}
            {(Number(taxAmount) || 0).toFixed(2)}
          </span>
        </div>

        {/* Geometric Balance Grand Total Container */}
        <div className="mt-2 bg-slate-900 text-white p-4 rounded-3xl shadow-xl relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 -translate-y-12 translate-x-10 rounded-full pointer-events-none"></div>
          <div className="relative z-10">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-bold">
              Grand Total
            </span>
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {settings.currencySymbol}
              {(Number(grandTotal) || 0).toFixed(2)}
            </span>
          </div>
          <span className="relative z-10 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono font-bold text-slate-300">
            {totalItemCount} Items
          </span>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Hold Order Button */}
          <button
            id="btn-hold-cart"
            disabled={cartItems.length === 0}
            onClick={onHoldOrder}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold border transition-colors active-press ${
              cartItems.length === 0
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
            }`}
            title="Park order (F3)"
          >
            <PauseCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Hold [F3]</span>
          </button>

          {/* Clear Cart Button */}
          <button
            id="btn-clear-cart"
            disabled={cartItems.length === 0}
            onClick={() => {
              if (cartItems.length > 0) {
                onClearCart();
                posSound.playDelete();
              }
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold border transition-colors active-press ${
              cartItems.length === 0
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border-slate-200 hover:border-rose-300 cursor-pointer'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Primary Checkout Button */}
        <button
          id="btn-pay-print"
          disabled={cartItems.length === 0}
          onClick={() => {
            if (cartItems.length > 0) {
              onProceedToCheckout();
              posSound.playCashDrawer();
            }
          }}
          className={`w-full flex items-center justify-between py-3.5 px-5 rounded-2xl text-sm font-bold shadow-md transition-all active-press ${
            cartItems.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <span>PAY & PRINT [F6]</span>
          </div>
          <span className="font-mono bg-black/20 px-2.5 py-0.5 rounded-lg text-xs font-bold">
            {settings.currencySymbol}
            {(Number(grandTotal) || 0).toFixed(2)}
          </span>
        </button>
      </div>
    </aside>
  );
};
