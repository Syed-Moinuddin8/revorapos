import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'F1', action: 'Start New Order / Clear Cart', category: 'POS Navigation' },
    { key: 'Ctrl+B', action: 'Open / Close Navigation Bar', category: 'POS Navigation' },
    { key: 'F2', action: 'Focus Product Search Bar', category: 'Catalog' },
    { key: 'F3', action: 'Apply Custom Discount (% or Flat)', category: 'Billing' },
    { key: 'F6', action: 'Open Payment & Checkout Drawer', category: 'Checkout' },
    { key: 'F7', action: 'Print Thermal Receipt (DOM ESC/POS)', category: 'Hardware' },
    { key: 'F8', action: 'View Parked / Held Bills', category: 'Billing' },
    { key: 'Esc', action: 'Close any active modal or drawer', category: 'General' },
    { key: 'Enter', action: 'Confirm payment in checkout modal', category: 'Checkout' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                POS Keyboard Shortcuts Guide
              </h3>
              <p className="text-xs text-slate-500">
                Speed up counter operations with tactile hotkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-5 overflow-y-auto space-y-2">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
            >
              <div>
                <span className="font-semibold text-slate-800 block">{sc.action}</span>
                <span className="text-[10px] text-slate-400">{sc.category}</span>
              </div>
              <kbd className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono font-extrabold text-slate-900 text-xs shadow-2xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl"
          >
            Got It (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
