import React, { useState } from 'react';
import { User } from '../../types';
import { posSound } from '../../services/sound';
import { Lock, ShieldCheck, X, AlertCircle } from 'lucide-react';

interface PinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  actionDescription: string;
  onSuccess: () => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onClose,
  users,
  actionDescription,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');
      posSound.playQtyChange();

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setErrorMsg('');
    posSound.playQtyChange();
  };

  const verifyPin = (pinToVerify: string) => {
    // Check if any admin has this PIN
    const authorizedUser = users.find(
      (u) =>
        u.isActive &&
        u.role === 'ADMIN' &&
        (u.pinCode === pinToVerify || u.pin === pinToVerify)
    );

    if (authorizedUser) {
      posSound.playSuccess();
      onSuccess();
      onClose();
    } else {
      posSound.playError();
      setErrorMsg('Invalid Admin PIN code');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Manager Authorization Required
              </h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                {actionDescription}
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

        {/* PIN Input Dots */}
        <div className="p-5 flex flex-col items-center space-y-4">
          <p className="text-xs text-slate-600 text-center">
            Enter 4-digit Manager / Admin security PIN:
          </p>

          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const hasVal = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold font-mono transition-all ${
                    hasVal
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-slate-300 bg-slate-50 text-slate-400'
                  }`}
                >
                  {hasVal ? '●' : ''}
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Touch Numpad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === 'C') {
                    setPin('');
                    setErrorMsg('');
                  } else if (btn === '⌫') {
                    handleBackspace();
                  } else {
                    handleDigit(btn);
                  }
                }}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-amber-100 text-slate-800 font-extrabold text-base flex items-center justify-center active-press transition-colors"
              >
                {btn}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end items-center text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
