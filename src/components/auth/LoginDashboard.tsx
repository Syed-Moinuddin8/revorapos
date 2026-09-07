import React, { useState, useEffect, useRef } from 'react';
import { User, CafeSettings } from '../../types';
import { posSound } from '../../services/sound';
import {
  Coffee,
  ShieldCheck,
  UserCheck,
  Lock,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface LoginDashboardProps {
  users: User[];
  settings: CafeSettings;
  onLoginSuccess: (user: User) => void;
}

const ADMIN_PASSWORD = 'Bharath@650';
const STAFF_PASSWORD = 'Staff@87';

export const LoginDashboard: React.FC<LoginDashboardProps> = ({
  users,
  settings,
  onLoginSuccess,
}) => {
  const activeUsers = users.filter((u) => u.isActive && (u.role === 'ADMIN' || u.role === 'STAFF'));
  const adminUser = activeUsers.find((u) => u.role === 'ADMIN') || {
    id: 'usr_admin',
    name: 'Admin',
    username: 'admin',
    email: 'admin@artisancafe.com',
    role: 'ADMIN' as const,
    pinCode: ADMIN_PASSWORD,
    avatar: '/images/avatars/priya.jpg',
    isActive: true,
    createdAt: '2026-01-01',
  };

  const staffUser = activeUsers.find((u) => u.role === 'STAFF') || {
    id: 'usr_stf1',
    name: 'Staff',
    username: 'staff',
    email: 'staff@artisancafe.com',
    role: 'STAFF' as const,
    pinCode: STAFF_PASSWORD,
    avatar: '/images/avatars/rahul.jpg',
    isActive: true,
    createdAt: '2026-04-10',
  };

  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'STAFF'>('ADMIN');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUser = selectedRole === 'ADMIN' ? adminUser : staffUser;
  const currentExpectedPassword = selectedRole === 'ADMIN' ? ADMIN_PASSWORD : STAFF_PASSWORD;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Automatically focus password text box on mount and when role changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedRole]);

  const handleSelectRole = (role: 'ADMIN' | 'STAFF') => {
    setSelectedRole(role);
    setPassword('');
    setErrorMsg('');
    posSound.playQtyChange();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!password.trim()) {
      setErrorMsg(`Please enter the password for ${selectedRole === 'ADMIN' ? 'Admin' : 'Staff'}.`);
      inputRef.current?.focus();
      return;
    }

    // Check against configured password (Bharath@650 for Admin, Staff@87 for Staff)
    const valid =
      password === currentExpectedPassword ||
      (selectedUser.pinCode && password === selectedUser.pinCode);

    if (valid) {
      posSound.playSuccess();
      const authenticatedUser: User = {
        ...selectedUser,
        name: selectedRole === 'ADMIN' ? 'Admin' : 'Staff',
        pinCode: currentExpectedPassword,
      };
      onLoginSuccess(authenticatedUser);
    } else {
      posSound.playError();
      setErrorMsg(
        `Incorrect password for ${selectedRole === 'ADMIN' ? 'Admin' : 'Staff'}. Please try again.`
      );
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      id="login-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto select-none font-sans animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={(e) => {
        // Enforce unclosable window: clicking outside does NOT dismiss it
        e.stopPropagation();
      }}
    >
      {/* Modal Dialog Window matching the website theme */}
      <div
        id="login-modal-window"
        className={`w-full max-w-md bg-white border border-stone-200/90 rounded-3xl shadow-2xl overflow-hidden relative my-auto animate-in zoom-in-95 duration-150 ${
          isShaking ? 'animate-shake' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header matching website brand */}
        <div className="px-6 py-4 bg-stone-50/90 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs ring-1 ring-blue-700/20 overflow-hidden">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.cafeName || 'Café Logo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Coffee className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-stone-900 leading-none">
                {settings.cafeName || 'ARTISAN CAFÉ & ROASTERY'}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-medium mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>POS-TERM-01</span>
                <span>•</span>
                <span className="font-mono text-stone-600 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-stone-400" />
                  {currentTime || '00:00:00'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3 text-amber-600" />
            <span>Terminal Locked</span>
          </div>
        </div>

        {/* Modal Main Form */}
        <div className="p-6 space-y-5">
          {/* Headline & Explanation */}
          <div className="text-center space-y-1">
            <h2 id="login-modal-title" className="text-xl font-extrabold text-stone-900 tracking-tight">
              Sign In to Terminal
            </h2>
            <p className="text-xs text-stone-500">
              Select your user account and enter your password to unlock the POS system.
            </p>
          </div>

          {/* Account Role Selector Cards - Only Admin and Staff, no individual person names */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">Select Account</label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Admin Card */}
              <button
                id="btn-select-admin-role"
                type="button"
                onClick={() => handleSelectRole('ADMIN')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRole === 'ADMIN'
                    ? 'bg-blue-50/70 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-stone-50/80 border-stone-200 hover:border-stone-300 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <img
                    src={adminUser.avatar}
                    alt="Admin"
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-stone-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-stone-900 leading-tight">Admin</div>
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase tracking-wider">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Admin
                  </span>
                </div>
              </button>

              {/* Staff Card */}
              <button
                id="btn-select-staff-role"
                type="button"
                onClick={() => handleSelectRole('STAFF')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedRole === 'STAFF'
                    ? 'bg-emerald-50/70 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-stone-50/80 border-stone-200 hover:border-stone-300 hover:bg-stone-100/60'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <img
                    src={staffUser.avatar}
                    alt="Staff"
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-stone-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-stone-900 leading-tight">Staff</div>
                  </div>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase tracking-wider">
                    <UserCheck className="w-2.5 h-2.5" />
                    Staff
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Password Input Form */}
          <form onSubmit={handleVerify} className="space-y-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="input-login-password"
                className="block text-xs font-semibold text-stone-700"
              >
                Password for{' '}
                <span
                  className={
                    selectedRole === 'ADMIN' ? 'text-blue-700 font-bold' : 'text-emerald-700 font-bold'
                  }
                >
                  {selectedRole === 'ADMIN' ? 'Admin' : 'Staff'}
                </span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  ref={inputRef}
                  id="input-login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Enter password..."
                  autoComplete="current-password"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit / Unlock Button */}
            <button
              id="btn-login-submit"
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm transition-colors shadow-xs active-press flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Unlock & Open POS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Unclosable Security Notice */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-1.5 text-[11px] text-stone-400 text-center">
            <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span>Window remains locked until verified authentication is completed.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
