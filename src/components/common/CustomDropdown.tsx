import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
}

interface CustomDropdownProps<T extends string = string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right' | 'full';
  id?: string;
}

export function CustomDropdown<T extends string = string>({
  value,
  options,
  onChange,
  icon,
  placeholder,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'right',
  id,
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  const isFullWidth = className.includes('w-full');

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullWidth ? 'block w-full' : 'inline-block'} ${className}`}
    >
      {/* Trigger button */}
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-2 sm:py-2.5 rounded-2xl text-xs font-semibold bg-white border border-slate-200/90 hover:border-slate-300 text-slate-800 shadow-2xs hover:shadow-xs transition-all active-press select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
          isFullWidth ? 'w-full' : ''
        } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500 shadow-xs' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          {selectedOption?.icon && (
            <span className="shrink-0">{selectedOption.icon}</span>
          )}
          <span className="truncate text-left font-semibold text-slate-800">
            {selectedOption ? selectedOption.label : placeholder || 'Select option'}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'full'
              ? 'left-0 right-0 w-full'
              : align === 'left'
              ? 'left-0 min-w-[200px] sm:min-w-[220px]'
              : 'right-0 min-w-[200px] sm:min-w-[220px]'
          } mt-1.5 max-h-72 overflow-y-auto bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 ${menuClassName}`}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition-all active-press cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {option.icon && (
                      <span
                        className={`shrink-0 transition-colors ${
                          isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {option.icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.description && (
                        <span className="block text-[10px] text-slate-400 font-normal leading-tight">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                        {option.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
