import React, { useEffect, useRef, useState } from 'react';
import { Order, CafeSettings } from '../../types';
import { posPrinter } from '../../services/printer';
import { posSound } from '../../services/sound';
import confetti from 'canvas-confetti';
import {
  Printer,
  Download,
  CheckCircle2,
  X,
  PlusCircle,
  Bluetooth,
  HelpCircle,
  Info,
  Loader2,
} from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  order: Order | null;
  settings: CafeSettings;
  onClose: () => void;
  onNewOrder: () => void;
  isNewCompletion?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  order,
  settings,
  onClose,
  onNewOrder,
  isNewCompletion = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);
  const [showBluetoothHelp, setShowBluetoothHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Always scroll to top so brand header and logo are immediately visible
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      if (isNewCompletion) {
        // Trigger festive confetti
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#D97706', '#EA580C', '#10B981', '#6366F1'],
        });
        posSound.playSuccess();
      }
    }
  }, [isOpen, isNewCompletion]);

  // Keyboard shortcut listener: F7 to print thermal bill, F1 for next bill
  useEffect(() => {
    if (!isOpen || !order) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      } else if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        onNewOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, order, settings, isNewCompletion]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    posSound.playCashDrawer();

    // Directly print via thermal document without opening any Chrome popup or window
    posPrinter.printReceiptDOM(order, settings);

    // Immediately close the bill in the website as requested
    if (isNewCompletion) {
      onNewOrder();
    } else {
      onClose();
    }
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;
    setBluetoothError(null);
    setIsBluetoothPrinting(true);
    posSound.playCashDrawer();

    try {
      const success = await posPrinter.printReceiptBluetooth(order, settings);
      if (success) {
        if (isNewCompletion) {
          onNewOrder();
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      console.warn('Bluetooth print failed, trying Web Serial fallback:', err);
      try {
        const serialSuccess = await posPrinter.printReceiptSerial(order, settings);
        if (serialSuccess) {
          if (isNewCompletion) {
            onNewOrder();
          } else {
            onClose();
          }
          return;
        }
      } catch (serialErr: any) {
        setBluetoothError(err.message || 'Bluetooth printer connection failed. Click Bluetooth Help for setup instructions.');
        setShowBluetoothHelp(true);
      }
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleDownload = () => {
    posPrinter.downloadReceiptFile(order, settings);
    posSound.playItemAdd();
  };

  const is58mm = settings.receiptWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-slate-100 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {isNewCompletion ? 'Order Settled Successfully!' : 'Tax Invoice & Receipt'}
              </h3>
              <span className="text-xs font-mono text-slate-400">{order.orderNumber}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Container Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-100/90"
        >
          {/* Thermal Paper Look */}
          <div
            id="thermal-print-target"
            className={`bg-white shadow-xl p-5 text-slate-900 font-mono-receipt rounded-2xl border-t-4 border-blue-600 my-auto ${
              is58mm ? 'w-[280px] text-[11px]' : 'w-[360px] text-[12px]'
            }`}
          >
            {/* Cafe Branding */}
            <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
              {settings.logoUrl && (
                <div className="flex justify-center pb-2">
                  <img
                    src={settings.logoUrl}
                    alt={settings.cafeName}
                    className="max-h-20 max-w-[200px] object-contain mix-blend-multiply contrast-200 grayscale filter"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h1 className="text-base font-bold uppercase tracking-tight text-slate-900">
                {settings.cafeName}
              </h1>
              {settings.tagline && <p className="text-[10px] text-slate-500">{settings.tagline}</p>}
              <p className="text-[10px] text-slate-600 leading-snug">{settings.address}</p>
              <p className="text-[10px] text-slate-600">Ph: {settings.phone}</p>
              {settings.gstNumber && (
                <p className="text-[10px] text-slate-600 font-bold">GSTIN: {settings.gstNumber}</p>
              )}
            </div>

            {/* Title */}
            <div className="text-center py-1.5 border-b border-dashed border-slate-300 font-bold text-[11px] uppercase tracking-wider text-slate-700">
              {settings.receiptHeader || 'TAX INVOICE'}
            </div>

            {/* Order Details */}
            <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Order No:</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{order.date} {order.time}</span>
              </div>
              <div className="flex justify-between">
                <span>Order Type:</span>
                <span className="font-bold">{order.orderType} {order.tableNumber ? `(${order.tableNumber})` : ''}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-slate-300">
              <div className="grid grid-cols-12 font-bold text-[10px] pb-1 border-b border-slate-200">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-center">QTY</span>
                <span className="col-span-4 text-right">AMT</span>
              </div>

              <div className="divide-y divide-slate-100 py-1 space-y-1">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="pt-1 text-[11px]">
                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-6 font-medium leading-tight">{item.productName}</span>
                      <span className="col-span-2 text-center font-bold">{item.quantity}</span>
                      <span className="col-span-4 text-right font-bold">
                        {settings.currencySymbol}{(Number(item.totalPrice ?? (item.unitPrice * item.quantity)) || 0).toFixed(2)}
                      </span>
                    </div>
                    {item.note && (
                      <div className="text-[9px] text-slate-500 pl-1 italic">
                        * {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{settings.currencySymbol}{(Number(order.subtotal) || 0).toFixed(2)}</span>
              </div>

              {(order.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Discount ({order.discountType === 'PERCENT' ? (order.discountValue || 0) + '%' : 'Flat'}):</span>
                  <span>-{settings.currencySymbol}{(Number(order.discountAmount) || 0).toFixed(2)}</span>
                </div>
              )}

              {(order.taxAmount || 0) > 0 && (
                <>
                  {order.cgstAmount && order.sgstAmount ? (
                    <>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>CGST ({(Number((order.taxRate || 0) / 2) || 0).toFixed(1)}%):</span>
                        <span>+{settings.currencySymbol}{(Number(order.cgstAmount) || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>SGST ({(Number((order.taxRate || 0) / 2) || 0).toFixed(1)}%):</span>
                        <span>+{settings.currencySymbol}{(Number(order.sgstAmount) || 0).toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>GST / Tax ({order.taxRate || 0}%):</span>
                      <span>+{settings.currencySymbol}{(Number(order.taxAmount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Grand Total */}
              <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-slate-300 text-slate-900">
                <span>GRAND TOTAL:</span>
                <span>{settings.currencySymbol}{(Number(order.grandTotal) || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="py-2 text-[10px] space-y-0.5 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold">{order.paymentMethod}</span>
              </div>
              {order.paymentMethod === 'CASH' && order.paymentDetails?.amountReceived != null && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Received:</span>
                    <span>{settings.currencySymbol}{(Number(order.paymentDetails.amountReceived) || 0).toFixed(2)}</span>
                  </div>
                  {order.paymentDetails.changeGiven != null && (
                    <div className="flex justify-between font-bold">
                      <span>Change Returned:</span>
                      <span>{settings.currencySymbol}{(Number(order.paymentDetails.changeGiven) || 0).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {order.paymentMethod === 'UPI' && order.paymentDetails.upiReference && (
                <div className="flex justify-between">
                  <span>UPI Ref ID:</span>
                  <span className="font-mono">{order.paymentDetails.upiReference}</span>
                </div>
              )}
              {order.paymentMethod === 'CARD' && order.paymentDetails.cardLast4 && (
                <div className="flex justify-between">
                  <span>Card Ending:</span>
                  <span>**** {order.paymentDetails.cardLast4}</span>
                </div>
              )}
            </div>

            {/* Barcode Mock & Footer */}
            <div className="pt-3 text-center space-y-2">
              <div className="flex justify-center">
                {/* Mock thermal barcode stripes */}
                <div className="h-7 w-40 bg-slate-900 flex items-center justify-around px-2 rounded-sm">
                  <div className="w-1 h-full bg-white"></div>
                  <div className="w-0.5 h-full bg-white"></div>
                  <div className="w-1.5 h-full bg-white"></div>
                  <div className="w-0.5 h-full bg-white"></div>
                  <div className="w-1 h-full bg-white"></div>
                  <div className="w-2 h-full bg-white"></div>
                  <div className="w-0.5 h-full bg-white"></div>
                  <div className="w-1 h-full bg-white"></div>
                </div>
              </div>
              <p className="text-[9px] font-mono">{order.orderNumber}</p>

              {settings.receiptFooter && (
                <div className="text-[10px] text-slate-700 whitespace-pre-line font-medium leading-tight">
                  {settings.receiptFooter}
                </div>
              )}

              {settings.receiptTerms && (
                <p className="text-[8px] text-slate-500 italic leading-tight">
                  {settings.receiptTerms}
                </p>
              )}

              <p className="text-[9px] font-bold tracking-widest pt-1">*** THANK YOU ***</p>
            </div>
          </div>
        </div>

        {/* Bluetooth Help & Troubleshooting Banner */}
        {showBluetoothHelp && (
          <div className="p-4 bg-amber-50 border-t border-b border-amber-200 text-slate-800 text-xs space-y-2.5 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between font-bold text-amber-900">
              <div className="flex items-center gap-2 text-xs">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Bluetooth Thermal Printer Setup & Troubleshooting</span>
              </div>
              <button
                onClick={() => setShowBluetoothHelp(false)}
                className="text-amber-700 hover:text-amber-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bluetoothError && (
              <p className="p-2 bg-rose-100 border border-rose-200 text-rose-800 rounded-xl font-medium">
                ⚠️ {bluetoothError}
              </p>
            )}

            <div className="space-y-2 text-slate-700 leading-relaxed">
              <p className="font-semibold text-amber-900">
                ❓ Why is my Bluetooth printer missing in the browser tab print list?
              </p>
              <p>
                Standard browser tab print (<kbd className="bg-amber-100 px-1 py-0.5 rounded text-[10px]">F7</kbd>) calls OS Printer Spoolers (Windows Printers). Paired Bluetooth thermal printers do not automatically register as Windows print drivers without manual port mapping.
              </p>

              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-950 space-y-1">
                <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Bluetooth className="w-3.5 h-3.5 text-indigo-600" />
                  Solution 1: Direct Bluetooth Print (Recommended - No Windows Driver Required!)
                </p>
                <p className="text-[11px]">
                  Click the purple <strong>"Print via Bluetooth"</strong> button below. Chrome/Edge will open a Bluetooth device prompt where you select your paired Bluetooth printer (e.g. <code>POS-58</code>, <code>MPT-II</code>, <code>RPP02N</code>) to print directly with 1 click!
                </p>
              </div>

              <div className="p-2.5 bg-white border border-amber-200 rounded-2xl space-y-1">
                <p className="font-bold text-amber-900">
                  Solution 2: Add Printer Driver in Windows (To use Browser Tab Print)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700">
                  <li>In Windows, open <strong>Settings → Bluetooth & devices → Printers & scanners</strong>.</li>
                  <li>Click <strong>Add device</strong> → wait 5 sec → click <strong>Add manually</strong>.</li>
                  <li>Choose <strong>Add a local printer or network printer with manual settings</strong> → Next.</li>
                  <li>Select your Bluetooth COM port (e.g. <code>COM3</code> or <code>COM4</code>).</li>
                  <li>Select Manufacturer: <strong>Generic</strong> → Printer: <strong>Generic / Text Only</strong>.</li>
                  <li>Name it <code>Bluetooth Thermal Printer</code>. It will now appear in your browser tab!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={isBluetoothPrinting}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-xs active-press transition-colors cursor-pointer"
              title="Direct print to Bluetooth thermal printer without opening browser tab"
            >
              {isBluetoothPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Bluetooth className="w-4 h-4 text-indigo-200" />
              )}
              <span>{isBluetoothPrinting ? 'Connecting...' : 'Print via Bluetooth'}</span>
            </button>

            <button
              id="btn-print-thermal-receipt"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-2xl shadow-xs active-press transition-colors cursor-pointer"
              title="Print directly to thermal printer using browser window (F7)"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Browser Print [F7]</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBluetoothHelp(!showBluetoothHelp)}
              className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-2xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-amber-200"
              title="Bluetooth Printer Setup Guide"
            >
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Bluetooth Help</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-colors active-press cursor-pointer"
              title="Download text / ESC-POS receipt file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-next-bill-f1"
              type="button"
              onClick={onNewOrder}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-xs active-press transition-colors cursor-pointer"
              title="Start next billing order (F1)"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Next Bill [F1]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
