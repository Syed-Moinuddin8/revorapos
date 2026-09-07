import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { CafeSettings } from '../../types';
import { posSound } from '../../services/sound';
import { posStorage } from '../../services/storage';
import {
  QrCode,
  X,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  Smartphone,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  AlertTriangle,
  Globe,
  CheckCircle2,
  ShieldCheck,
  Save,
  HelpCircle,
} from 'lucide-react';

interface TableQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CafeSettings;
  currentTable?: string;
  onOpenCustomerView?: (table: string) => void;
  onUpdateSettings?: (settings: CafeSettings) => void;
}

const DEFAULT_TABLES = [
  'T-01', 'T-02', 'T-03', 'T-04',
  'T-05', 'T-06', 'T-07', 'T-08',
  'T-09', 'T-10', 'T-11', 'T-12',
];

export const TableQRModal: React.FC<TableQRModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentTable = 'T-01',
  onOpenCustomerView,
  onUpdateSettings,
}) => {
  const [tablesList, setTablesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pos_cafe_tables_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TABLES;
  });

  const [selectedTable, setSelectedTable] = useState<string>(currentTable || 'T-01');
  const [customTableInput, setCustomTableInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'ALL_SHEET'>('SINGLE');
  const [allQrs, setAllQrs] = useState<{ table: string; qrUrl: string; url: string }[]>([]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Environment origin detection
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isAisDev = currentOrigin.includes('ais-dev-');
  const aisPreOrigin = isAisDev ? currentOrigin.replace('ais-dev-', 'ais-pre-') : currentOrigin;

  // Selected base URL mode
  const [baseUrlMode, setBaseUrlMode] = useState<'PUBLIC_PREVIEW' | 'CUSTOM' | 'DEV_LOCAL'>(() => {
    if (settings.customerMenuBaseUrl) {
      if (settings.customerMenuBaseUrl.includes('ais-pre-')) return 'PUBLIC_PREVIEW';
      if (settings.customerMenuBaseUrl.includes('ais-dev-')) return 'DEV_LOCAL';
      return 'CUSTOM';
    }
    return isAisDev ? 'PUBLIC_PREVIEW' : 'DEV_LOCAL';
  });

  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    if (
      settings.customerMenuBaseUrl &&
      !settings.customerMenuBaseUrl.includes('ais-dev-') &&
      !settings.customerMenuBaseUrl.includes('ais-pre-')
    ) {
      return settings.customerMenuBaseUrl;
    }
    return '';
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Sync selectedTable when currentTable changes
  useEffect(() => {
    if (currentTable && tablesList.includes(currentTable)) {
      setSelectedTable(currentTable);
    } else if (currentTable) {
      setTablesList((prev) => (prev.includes(currentTable) ? prev : [...prev, currentTable]));
      setSelectedTable(currentTable);
    }
  }, [currentTable]);

  // Compute active base URL
  const activeBaseUrl = (() => {
    if (baseUrlMode === 'PUBLIC_PREVIEW') {
      return isAisDev ? aisPreOrigin : (settings.customerMenuBaseUrl || currentOrigin);
    }
    if (baseUrlMode === 'CUSTOM') {
      return customBaseUrl.trim() || currentOrigin;
    }
    return currentOrigin;
  })();

  // Construct URL for selected table
  const getCustomerUrlForTable = (tbl: string) => {
    if (typeof window === 'undefined') return `/?table=${encodeURIComponent(tbl)}`;
    const base = activeBaseUrl.replace(/\/+$/, '');
    return `${base}/?table=${encodeURIComponent(tbl)}`;
  };

  const handleSaveBaseUrl = (urlToSave: string) => {
    const cleanUrl = urlToSave.trim().replace(/\/+$/, '');
    const updated: CafeSettings = {
      ...settings,
      customerMenuBaseUrl: cleanUrl,
    };
    posStorage.saveSettings(updated);
    if (onUpdateSettings) {
      onUpdateSettings(updated);
    }
    posSound.playSuccess();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const currentUrl = getCustomerUrlForTable(selectedTable);

  // Generate QR Code data URL whenever selected table changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    QRCode.toDataURL(currentUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUrl, isOpen]);

  // Generate all QR codes when switching to ALL_SHEET tab
  useEffect(() => {
    if (activeTab !== 'ALL_SHEET' || !isOpen) return;
    let isMounted = true;
    setIsGeneratingAll(true);

    const generateAll = async () => {
      const results: { table: string; qrUrl: string; url: string }[] = [];
      for (const tbl of tablesList) {
        const url = getCustomerUrlForTable(tbl);
        try {
          const qr = await QRCode.toDataURL(url, {
            width: 300,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          });
          results.push({ table: tbl, qrUrl: qr, url });
        } catch (e) {
          console.error(e);
        }
      }
      if (isMounted) {
        setAllQrs(results);
        setIsGeneratingAll(false);
      }
    };

    generateAll();
    return () => {
      isMounted = false;
    };
  }, [activeTab, tablesList, isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    posSound.playItemAdd();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${String(settings?.cafeName || 'Cafe').replace(/\s+/g, '_')}_Table_${selectedTable}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    posSound.playSuccess();
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTableInput.trim().toUpperCase();
    if (!clean) return;
    if (!tablesList.includes(clean)) {
      const updated = [...tablesList, clean];
      setTablesList(updated);
      try {
        localStorage.setItem('pos_cafe_tables_list', JSON.stringify(updated));
      } catch {}
      setSelectedTable(clean);
      setCustomTableInput('');
      posSound.playItemAdd();
    } else {
      setSelectedTable(clean);
      setCustomTableInput('');
    }
  };

  const handleDeleteTable = (tbl: string) => {
    if (tablesList.length <= 1) return;
    const updated = tablesList.filter((t) => t !== tbl);
    setTablesList(updated);
    try {
      localStorage.setItem('pos_cafe_tables_list', JSON.stringify(updated));
    } catch {}
    if (selectedTable === tbl) {
      setSelectedTable(updated[0]);
    }
    posSound.playDelete();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenCustomerView = () => {
    if (onOpenCustomerView) {
      onClose();
      onOpenCustomerView(selectedTable);
    } else {
      window.open(currentUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  Table QR Code Ordering
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  Self-Order View
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Customers scan this QR code with their phone camera to browse the menu and send orders straight to the Held Bills queue.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {/* Tab switch: Single Table vs All Tables Print Sheet */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('SINGLE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'SINGLE'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single Standee
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ALL_SHEET')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'ALL_SHEET'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Tables Sheet
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors ml-2"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'SINGLE' ? (
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Table Selection Column */}
            <div className="md:col-span-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Select Table Number
                </label>
                <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
                  {tablesList.map((tbl) => {
                    const isSelected = selectedTable === tbl;
                    return (
                      <div key={tbl} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTable(tbl);
                            posSound.playItemAdd();
                          }}
                          className={`w-full py-2 px-1 text-xs font-mono font-bold rounded-xl transition-all border ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-[1.02]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {tbl}
                        </button>
                        {tablesList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTable(tbl);
                            }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full items-center justify-center text-[10px] hidden group-hover:flex shadow-xs"
                            title={`Delete ${tbl}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Table */}
              <form onSubmit={handleAddTable} className="flex gap-2">
                <input
                  type="text"
                  value={customTableInput}
                  onChange={(e) => setCustomTableInput(e.target.value)}
                  placeholder="e.g. T-13, VIP-1, PATIO"
                  className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:border-blue-600 focus:outline-none uppercase font-mono font-bold"
                />
                <button
                  type="submit"
                  disabled={!customTableInput.trim()}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Download Standee QR Image (.png)</span>
                </button>
              </div>
            </div>

            {/* Right: Realistic Table Standee / Tent Preview */}
            <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-100/70 p-6 rounded-3xl border border-slate-200/80">
              <div
                ref={printContainerRef}
                className="w-full max-w-[320px] bg-white rounded-3xl shadow-xl border-2 border-slate-900 p-6 flex flex-col items-center text-center relative overflow-hidden print-area"
              >
                {/* Decorative Top Bar */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600" />

                {/* Cafe Branding */}
                <div className="mt-1 mb-2 flex flex-col items-center">
                  {settings.logoUrl && (
                    <img
                      src={settings.logoUrl}
                      alt={settings.cafeName}
                      className="w-10 h-10 rounded-xl object-contain mb-1.5 shadow-2xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  <h4 className="font-extrabold text-base text-slate-900 tracking-tight">
                    {settings.cafeName}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">{settings.tagline}</p>
                </div>

                {/* Table Highlight Badge */}
                <div className="my-2 px-4 py-1 rounded-full bg-slate-900 text-white text-xs font-mono font-extrabold tracking-widest shadow-xs">
                  TABLE {selectedTable}
                </div>

                {/* QR Target Domain status indicator */}
                <div className="mt-0.5 flex items-center justify-center">
                  {activeBaseUrl.includes('ais-dev-') ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> Dev URL (403 on mobile)
                    </span>
                  ) : activeBaseUrl.includes('ais-pre-') ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Public Mobile Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                      <Globe className="w-2.5 h-2.5 text-blue-600" /> Custom Domain Active
                    </span>
                  )}
                </div>

                {/* QR Code Container */}
                <div className="my-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-inner flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR for Table ${selectedTable}`}
                      className="w-44 h-44 object-contain"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400 font-mono">
                      Generating...
                    </div>
                  )}
                </div>

                {/* Instructional Text */}
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1 text-blue-600 text-xs font-bold">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Scan with Camera to Order</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Browse food & drinks, add items, and your order will go directly to our staff!
                  </p>
                </div>

                {/* Footer Note */}
                <div className="mt-4 pt-3 border-t border-slate-100 w-full flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>Dine-In Self-Order</span>
                  <span>{selectedTable}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* All Tables Sheet Preview */
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Bulk Table QR Sheets ({tablesList.length} Tables)
                </h4>
                <p className="text-xs text-slate-500">
                  Print all table cards at once to cut out and display on dining tables.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print All Standees</span>
              </button>
            </div>

            {isGeneratingAll ? (
              <div className="py-16 text-center text-slate-400 text-xs font-mono">
                Generating QR codes for all tables...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {allQrs.map((item) => (
                  <div
                    key={item.table}
                    className="bg-white border-2 border-slate-900 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm"
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {settings.cafeName}
                    </span>
                    <span className="text-xs font-mono font-extrabold text-white bg-slate-900 px-3 py-0.5 rounded-full my-1.5">
                      TABLE {item.table}
                    </span>
                    <img
                      src={item.qrUrl}
                      alt={`QR ${item.table}`}
                      className="w-28 h-28 object-contain my-1"
                    />
                    <span className="text-[9px] text-slate-500 font-semibold">
                      Scan with Phone to Order
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Customer orders land instantly in POS <strong>Held Orders [F8]</strong> with table number.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
