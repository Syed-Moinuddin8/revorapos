import React, { useState } from 'react';
import { CafeSettings, User } from '../../types';
import { posStorage } from '../../services/storage';
import { posSound } from '../../services/sound';
import { processToThermalLogo } from '../../utils/thermalLogoProcessor';
import {
  Store,
  Receipt,
  FileCheck,
  Volume2,
  VolumeX,
  Printer,
  Download,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  Sliders,
  DollarSign,
  QrCode,
  Image as ImageIcon,
  Trash2,
  Link,
  Sparkles,
  Coffee,
  ImagePlus,
  Zap,
  Smartphone,
  Globe,
  AlertTriangle,
} from 'lucide-react';

interface SettingsViewProps {
  settings: CafeSettings;
  currentUser: User;
  onRefreshSettings: () => void;
  onResetAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  currentUser,
  onRefreshSettings,
  onResetAllData,
}) => {
  const [formData, setFormData] = useState<CafeSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    // Check file size (max 3.5MB)
    if (file.size > 3.5 * 1024 * 1024) {
      setLogoUploadError('Logo image size must be under 3.5MB.');
      return;
    }

    setLogoUploadError(null);
    setIsProcessingLogo(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        try {
          // Process to thermal print graphic: knocks out background box and renders high-contrast monochrome ink
          const thermalReady = await processToThermalLogo(dataUrl);
          setFormData((prev) => ({ ...prev, logoUrl: thermalReady }));
          posSound.playItemAdd();
        } catch (err) {
          setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
        } finally {
          setIsProcessingLogo(false);
        }
      }
    };
    reader.onerror = () => {
      setIsProcessingLogo(false);
      setLogoUploadError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleOptimizeCurrentLogo = async () => {
    if (!formData.logoUrl) return;
    setIsProcessingLogo(true);
    try {
      const thermalReady = await processToThermalLogo(formData.logoUrl);
      setFormData((prev) => ({ ...prev, logoUrl: thermalReady }));
      posSound.playSuccess();
    } catch (err) {
      console.warn('Thermal conversion error:', err);
    } finally {
      setIsProcessingLogo(false);
    }
  };

  const handleClearLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }));
    setLogoUploadError(null);
    posSound.playDelete();
  };

  const handleSave = () => {
    posStorage.saveSettings(formData);
    onRefreshSettings();
    posSound.playSuccess();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const backup = posStorage.exportFullBackup();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(backup);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `CafePOS_FullBackup_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    posSound.playItemAdd();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        posStorage.importFullBackup(jsonStr);
        posSound.playSuccess();
        alert('Backup successfully imported! Reloading system.');
        window.location.reload();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Invalid backup JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-4 sm:space-y-5 select-none">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            Store & POS Hardware Settings
          </h2>
          <p className="text-xs text-slate-400">
            Configure thermal receipt printers, GST compliance, UPI IDs, and store branding
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              Saved Successfully!
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-all active-press"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Column: Cafe Branding & Tax Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Cafe Logo & Brand Visual Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Store Logo & Visual Brand
              </h3>
              {formData.logoUrl ? (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Custom Logo Active
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Using Default Icon
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Logo Preview Avatar */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden shadow-2xs transition-all p-2">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Store Logo Preview"
                      className="max-h-full max-w-full object-contain mix-blend-multiply contrast-200 grayscale filter"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                      <Coffee className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mb-1" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Default</span>
                    </div>
                  )}
                </div>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleClearLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Remove custom logo"
                    aria-label="Remove custom logo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                <div className="mt-1 text-center">
                  <span className="text-[9px] font-mono text-slate-400">Thermal Output</span>
                </div>
              </div>

              {/* Upload Controls & URL Input */}
              <div className="flex-1 space-y-2.5 w-full min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer active-press transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingLogo ? 'Optimizing...' : 'Upload Logo Image'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      disabled={isProcessingLogo}
                      className="hidden"
                    />
                  </label>

                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleOptimizeCurrentLogo}
                      disabled={isProcessingLogo}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold rounded-xl transition-colors active-press cursor-pointer"
                      title="Convert into 1-bit thermal print monochrome graphic without background box"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Optimize for Thermal Print</span>
                    </button>
                  )}

                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={handleClearLogo}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 font-semibold rounded-xl transition-colors active-press cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {logoUploadError && (
                  <p className="text-[11px] text-rose-600 font-medium">
                    {logoUploadError}
                  </p>
                )}

                {/* Direct Image URL input */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                    Or Enter Image / SVG URL:
                  </label>
                  <div className="relative">
                    <Link className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="url"
                      value={formData.logoUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, logoUrl: e.target.value });
                        setLogoUploadError(null);
                      }}
                      placeholder="https://example.com/logo.png or paste image data URL..."
                      className="w-full text-xs pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets for instant thermal testing */}
                <div className="pt-1 flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Thermal Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        logoUrl:
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 36h52v26a26 26 0 0 1-26 26h0a26 26 0 0 1-26-26V36z"/><path d="M70 44h10a10 10 0 0 1 10 10v2a10 10 0 0 1-10 10H70"/><path d="M12 88h64"/><path d="M32 20c0-6 4-6 4-12"/><path d="M44 20c0-6 4-6 4-12"/><path d="M56 20c0-6 4-6 4-12"/></svg>',
                      });
                      posSound.playItemAdd();
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors border border-slate-200 cursor-pointer"
                  >
                    ☕ Coffee Stamp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        logoUrl:
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="42" r="28"/><path d="M36 70h28"/><path d="M40 78h20"/><path d="M44 86h12"/><path d="M42 42h16"/><path d="M50 34v16"/></svg>',
                      });
                      posSound.playItemAdd();
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors border border-slate-200 cursor-pointer"
                  >
                    💡 Idea Bulb Seal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        logoUrl:
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M30 18v24a10 10 0 0 0 10 10v30"/><path d="M30 18v16"/><path d="M40 18v16"/><path d="M50 18v16"/><path d="M70 18v64"/><path d="M70 18c-12 8-12 24 0 34"/></svg>',
                      });
                      posSound.playItemAdd();
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-medium transition-colors border border-slate-200 cursor-pointer"
                  >
                    🍴 Bistro Cutlery
                  </button>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Thermal Printer Optimization Active</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Logos are rendered as 1-bit monochrome graphics. Any colored or light photo background card is automatically knocked out to 100% transparent so your logo prints directly on the thermal receipt paper without an image box border.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cafe Info Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-4 h-4 text-blue-600" />
              Café Identity & Store Profile
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">Café Name *</label>
                <input
                  type="text"
                  value={formData.cafeName}
                  onChange={(e) => setFormData({ ...formData, cafeName: e.target.value })}
                  className="w-full text-xs font-semibold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">Tagline / Slogan</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">Store Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono focus:border-blue-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-900 block mb-1">Email</label>
                <input
                  type="text"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-900 block mb-1">Website</label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Tax & Financial Compliance */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileCheck className="w-4 h-4 text-blue-600" />
              Tax, Currency & Compliance Setup
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full text-xs font-mono font-bold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">FSSAI License No.</label>
                <input
                  type="text"
                  value={formData.fssaiNumber}
                  onChange={(e) => setFormData({ ...formData, fssaiNumber: e.target.value })}
                  placeholder="10020043000123"
                  className="w-full text-xs font-mono px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-900 block mb-1">Default Tax Rate (%)</label>
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                  className="w-full text-xs font-mono font-bold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full text-xs font-mono font-bold px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-900 block mb-1">UPI VPA ID for QR</label>
                <input
                  type="text"
                  value={formData.upiId}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  placeholder="name@upi"
                  className="w-full text-xs font-mono px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableSound}
                  onChange={(e) => setFormData({ ...formData, enableSound: e.target.checked })}
                  className="rounded text-blue-600 w-4 h-4"
                />
                <span className="font-semibold text-slate-700">
                  Enable tactile POS audio feedback (beeps, success chimes)
                </span>
              </label>
            </div>
          </div>

          {/* Customer Self-Ordering & Table QR Domain Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Customer Self-Ordering & Table QR Domain
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Mobile Access
              </span>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed">
              Configure the public web address encoded into Table QR code standees.
            </p>

            {/* If currently in ais-dev-, explain why mobile gets 403 */}
            {typeof window !== 'undefined' && window.location.origin.includes('ais-dev-') && !formData.customerMenuBaseUrl?.includes('ais-pre-') && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Fixing Mobile Phone 403 Forbidden Errors:</span>
                </div>
                <p className="text-amber-800 leading-normal">
                  The Google AI Studio development URL (<code>ais-dev-...</code>) is private to your developer session. External mobile phones that scan this QR code will receive a <strong>403 Forbidden</strong> error.
                </p>
                <p className="text-amber-800">
                  To allow customers to scan freely, click <strong>&quot;Share&quot;</strong> in the top-right of AI Studio to deploy the public version, and click the button below to use the public shared domain (<code>ais-pre-...</code>).
                </p>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-900 block mb-1">
                Table QR Base URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.customerMenuBaseUrl || ''}
                  onChange={(e) => setFormData({ ...formData, customerMenuBaseUrl: e.target.value })}
                  placeholder={
                    typeof window !== 'undefined'
                      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
                      : 'https://order.mycafe.com'
                  }
                  className="flex-1 text-xs font-mono px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Leave empty to automatically use the public preview domain, or enter your custom domain.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {typeof window !== 'undefined' && window.location.origin.includes('ais-dev-') && (
                <button
                  type="button"
                  onClick={() => {
                    const publicUrl = window.location.origin.replace('ais-dev-', 'ais-pre-');
                    setFormData({ ...formData, customerMenuBaseUrl: publicUrl });
                    posSound.playItemAdd();
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Set to Public Shared URL (Fix 403)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    setFormData({ ...formData, customerMenuBaseUrl: window.location.origin });
                    posSound.playItemAdd();
                  }
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-slate-600" />
                <span>Use Current Browser URL</span>
              </button>
            </div>
          </div>

          {/* Backup & System Reset Card */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Data Management & Backups
            </h3>
            <p className="text-slate-400">
              Export an encrypted local database snapshot or restore from a previous JSON backup.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-colors active-press"
              >
                <Download className="w-4 h-4" />
                <span>Export System JSON Backup</span>
              </button>

              <label className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-colors cursor-pointer active-press">
                <Upload className="w-4 h-4" />
                <span>Import Backup</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-2xl transition-colors ml-0 sm:ml-auto cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Demo Factory Seed</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Thermal Receipt Formatting & Simulator (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Printer className="w-4 h-4 text-blue-600" />
              Thermal Bill Customization
            </h3>

            {/* Paper Width Selector */}
            <div>
              <label className="font-bold text-slate-900 block mb-1.5">Printer Roll Width:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, receiptWidth: '58mm' })}
                  className={`py-2.5 px-3.5 rounded-2xl border text-xs font-bold transition-colors ${
                    formData.receiptWidth === '58mm'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  58mm (2-inch standard)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, receiptWidth: '80mm' })}
                  className={`py-2.5 px-3.5 rounded-2xl border text-xs font-bold transition-colors ${
                    formData.receiptWidth === '80mm'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  80mm (3-inch wide)
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">Receipt Top Header Title</label>
              <input
                type="text"
                value={formData.receiptHeader}
                onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">Receipt Footer Greeting</label>
              <textarea
                rows={2}
                value={formData.receiptFooter}
                onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-1">Terms & Policy Text</label>
              <textarea
                rows={2}
                value={formData.receiptTerms}
                onChange={(e) => setFormData({ ...formData, receiptTerms: e.target.value })}
                className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Live Mini Thermal Preview */}
          <div className="bg-slate-100 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Live Thermal Print Preview ({formData.receiptWidth})
            </span>

            <div
              className={`bg-white shadow-md p-4 text-slate-900 font-mono-receipt rounded-2xl border-t-4 border-blue-600 ${
                formData.receiptWidth === '58mm' ? 'w-[230px] text-[10px]' : 'w-[280px] text-[11px]'
              }`}
            >
              <div className="text-center pb-1 border-b border-dashed border-slate-300">
                {formData.logoUrl && (
                  <div className="flex justify-center pb-2">
                    <img
                      src={formData.logoUrl}
                      alt="Receipt Logo"
                      className="max-h-20 max-w-[170px] sm:max-h-24 sm:max-w-[200px] object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <p className="font-bold uppercase">{formData.cafeName}</p>
                <p className="text-[9px] text-slate-500">{formData.tagline}</p>
                <p className="text-[9px] text-slate-500">{formData.phone}</p>
                {formData.gstNumber && <p className="text-[9px] font-bold">GSTIN: {formData.gstNumber}</p>}
              </div>

              <div className="text-center py-1 font-bold text-[10px] uppercase border-b border-dashed border-slate-300">
                {formData.receiptHeader}
              </div>

              <div className="py-1 border-b border-dashed border-slate-300 space-y-0.5 text-[9px]">
                <div className="flex justify-between">
                  <span>1x Cappuccino</span>
                  <span>{formData.currencySymbol}140.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Croissant</span>
                  <span>{formData.currencySymbol}110.00</span>
                </div>
              </div>

              <div className="py-1 space-y-0.5 text-[9px] font-bold border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>TOTAL:</span>
                  <span>{formData.currencySymbol}250.00</span>
                </div>
              </div>

              <div className="pt-2 text-center text-[8px] text-slate-500 whitespace-pre-line">
                {formData.receiptFooter}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Factory Seed Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Reset Factory Demo Data?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  WARNING: This will reset all orders, inventory, sales, and transactions back to the initial demo state.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetAllData();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer active-press"
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
