import React, { useState, useMemo } from 'react';
import { Customer } from '../../types';
import { posSound } from '../../services/sound';
import { Search, UserPlus, Phone, UserCheck, X, Check } from 'lucide-react';

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onAddNewCustomer: (name: string, phone: string) => void;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onAddNewCustomer,
}) => {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase().trim();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  const handleCreateAndSelect = () => {
    if (!newName.trim() || !newPhone.trim()) {
      alert('Name and Phone are required');
      return;
    }
    onAddNewCustomer(newName.trim(), newPhone.trim());
    setIsAddingNew(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-extrabold text-slate-900">
            Select or Add Customer [F4]
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 space-y-3 flex-1 overflow-y-auto">
          {!isAddingNew ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    autoFocus
                    className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 active-press transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>

              {/* Walk-in Option */}
              <button
                onClick={() => {
                  onSelectCustomer(null);
                  posSound.playItemAdd();
                  onClose();
                }}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  selectedCustomer === null
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">Walk-in Customer</span>
                  <span className="text-[10px] text-slate-400">Default generic billing</span>
                </div>
                {selectedCustomer === null && <Check className="w-4 h-4 text-blue-600" />}
              </button>

              {/* Customers List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {filtered.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelectCustomer(c);
                        posSound.playItemAdd();
                        onClose();
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{c.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">{c.phone}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Quick Add Customer Form */
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vikram Sethi"
                  autoFocus
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Back to List
                </button>
                <button
                  type="button"
                  onClick={handleCreateAndSelect}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg active-press transition-colors"
                >
                  Add & Attach
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
