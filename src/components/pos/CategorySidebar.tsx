import React, { useMemo } from 'react';
import { Category, Product } from '../../types';
import { posSound } from '../../services/sound';
import {
  LayoutGrid,
  Coffee,
  CupSoda,
  GlassWater,
  Sandwich,
  Pizza,
  Utensils,
  Cake,
  Flame,
  Sparkles,
  Layers,
  PanelLeftClose,
  X,
} from 'lucide-react';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  categoryItemCounts?: Record<string, number>;
  totalProductsCount?: number;
  products?: Product[];
  isOpen?: boolean;
  onClose?: () => void;
  onToggleOpen?: () => void;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Coffee':
      return <Coffee className="w-4 h-4" />;
    case 'CupSoda':
      return <CupSoda className="w-4 h-4" />;
    case 'GlassWater':
      return <GlassWater className="w-4 h-4" />;
    case 'Sandwich':
      return <Sandwich className="w-4 h-4" />;
    case 'Pizza':
      return <Pizza className="w-4 h-4" />;
    case 'Utensils':
      return <Utensils className="w-4 h-4" />;
    case 'Cake':
      return <Cake className="w-4 h-4" />;
    case 'Sparkles':
      return <Sparkles className="w-4 h-4" />;
    default:
      return <LayoutGrid className="w-4 h-4" />;
  }
};

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories = [],
  selectedCategory,
  onSelectCategory,
  categoryItemCounts,
  totalProductsCount,
  products = [],
  isOpen = true,
  onClose,
}) => {
  const activeCategories = (categories || []).filter((c) => c && c.isActive);

  const countsMap = useMemo(() => {
    if (categoryItemCounts && typeof categoryItemCounts === 'object') {
      return categoryItemCounts;
    }
    const map: Record<string, number> = {};
    if (Array.isArray(products)) {
      for (const p of products) {
        if (p?.categoryId) {
          map[p.categoryId] = (map[p.categoryId] || 0) + 1;
        }
      }
    }
    return map;
  }, [categoryItemCounts, products]);

  const totalCount =
    totalProductsCount !== undefined
      ? Number(totalProductsCount) || 0
      : (products?.length || 0);

  if (!isOpen) {
    return null;
  }

  const handleSelect = (catId: string) => {
    onSelectCategory(catId);
    posSound.playItemAdd();
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Drawer Backdrop when open on mobile screens */}
      <div
        className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      />

      <aside className="fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 lg:w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full lg:h-[calc(100vh-105px)] select-none shadow-xl lg:shadow-none animate-in slide-in-from-left duration-200">
        {/* Sidebar Header with Open/Close Toggle Button */}
        <div className="flex p-3.5 sm:p-4 border-b border-slate-100 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Categories
            </span>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
              {activeCategories.length}
            </span>
          </div>
          {onClose && (
            <button
              id="btn-close-category-nav"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors active-press flex items-center gap-1"
              title="Close navigation bar"
              aria-label="Close navigation bar"
            >
              <PanelLeftClose className="w-4 h-4 hidden sm:block" />
              <X className="w-4 h-4 sm:hidden" />
              <span className="text-[11px] font-bold text-slate-500 hidden xs:inline">Close</span>
            </button>
          )}
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-2 lg:p-3 flex flex-col gap-1.5 no-scrollbar items-stretch">
          {/* Special 'Featured / Popular' filter */}
          <button
            id="cat-btn-featured"
            onClick={() => handleSelect('featured')}
            className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 lg:px-3.5 lg:py-3 rounded-xl lg:rounded-2xl text-xs font-semibold whitespace-nowrap transition-all active-press ${
              selectedCategory === 'featured'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'bg-transparent text-slate-700 hover:bg-blue-50/70 hover:text-blue-900 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={selectedCategory === 'featured' ? 'text-white' : 'text-blue-600'}>
                <Flame className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </span>
              <span>Chef's Specials</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                selectedCategory === 'featured' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              ★
            </span>
          </button>

          {/* Dynamic Categories */}
          {activeCategories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const count =
              category.id === 'cat_all'
                ? totalCount
                : countsMap?.[category.id] || 0;

            return (
              <button
                key={category.id}
                id={`cat-btn-${category.slug}`}
                onClick={() => handleSelect(category.id)}
                className={`shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 lg:px-3.5 lg:py-3 rounded-xl lg:rounded-2xl text-xs font-semibold whitespace-nowrap transition-all active-press ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={isSelected ? 'text-white' : 'text-blue-600'}>
                    {getCategoryIcon(category.iconName)}
                  </span>
                  <span className="truncate">{category.name}</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono shrink-0 font-bold ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Footnote */}
        <div className="flex p-3 sm:p-4 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-400 items-center justify-between">
          <span className="uppercase tracking-wider text-[10px] font-bold">Touch or click</span>
          <span className="font-mono text-[10px] text-slate-400">v2.0</span>
        </div>
      </aside>
    </>
  );
};
