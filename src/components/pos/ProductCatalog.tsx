import React, { useState, useMemo } from 'react';
import { Product, CartItem, CafeSettings } from '../../types';
import { posSound } from '../../services/sound';
import {
  Search,
  X,
  Plus,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Sparkles,
  PanelLeftOpen,
  PanelLeftClose,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ArrowDownAZ,
} from 'lucide-react';
import { CustomDropdown, DropdownOption } from '../common/CustomDropdown';

interface ProductCatalogProps {
  products: Product[];
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory?: (categoryId: string) => void;
  cartItems?: CartItem[];
  onAddToCart: (product: Product) => void;
  settings: CafeSettings;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isNavOpen?: boolean;
  onOpenNav?: () => void;
  onToggleNav?: () => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products = [],
  categories = [],
  selectedCategory,
  onSelectCategory,
  cartItems = [],
  onAddToCart,
  settings,
  searchInputRef,
  searchQuery: propSearchQuery,
  onSearchChange,
  isNavOpen = true,
  onOpenNav,
  onToggleNav,
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;
  const [sortBy, setSortBy] = useState<'FEATURED' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME'>('FEATURED');

  const sortOptions: DropdownOption<'FEATURED' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME'>[] = [
    {
      value: 'FEATURED',
      label: 'Featured First',
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      value: 'PRICE_ASC',
      label: 'Price: Low to High',
      icon: <ArrowUpNarrowWide className="w-3.5 h-3.5 text-blue-500" />,
    },
    {
      value: 'PRICE_DESC',
      label: 'Price: High to Low',
      icon: <ArrowDownWideNarrow className="w-3.5 h-3.5 text-blue-500" />,
    },
    {
      value: 'NAME',
      label: 'Name: A to Z',
      icon: <ArrowDownAZ className="w-3.5 h-3.5 text-slate-500" />,
    },
  ];

  // Map of product ID to quantity in current cart
  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems || []) {
      if (item?.product?.id) {
        map[item.product.id] = (map[item.product.id] || 0) + (Number(item.quantity) || 0);
      }
    }
    return map;
  }, [cartItems]);

  // Filter & Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory === 'featured') {
        if (!p.isFeatured) return false;
      } else if (selectedCategory !== 'cat_all') {
        if (p.categoryId !== selectedCategory) return false;
      }

      // Search query (name, sku, barcode, description)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'FEATURED') {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'PRICE_ASC') return a.sellingPrice - b.sellingPrice;
      if (sortBy === 'PRICE_DESC') return b.sellingPrice - a.sellingPrice;
      if (sortBy === 'NAME') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [products, selectedCategory, searchQuery, sortBy]);

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);
  const categoryTitle =
    selectedCategory === 'featured'
      ? "Chef's Specials & Bestsellers"
      : selectedCategory === 'cat_all'
      ? 'Full Menu Catalog'
      : selectedCategoryObj?.name || 'Products';

  return (
    <main className="flex-1 flex flex-col h-full lg:h-[calc(100vh-105px)] bg-slate-50/50 overflow-hidden select-none">
      {/* Search & Filter Header */}
      <div className="p-2 sm:p-4 bg-white border-b border-slate-200 shadow-2xs space-y-1.5 sm:space-y-3">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Categories Sidebar Toggle Button (Inside Catalog Toolbar, away from header/logo) */}
          {(onToggleNav || onOpenNav) && (
            <button
              id="btn-toggle-categories"
              type="button"
              onClick={onToggleNav || onOpenNav}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2.5 font-bold text-xs border rounded-2xl shadow-2xs active-press transition-all shrink-0 ${
                isNavOpen
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
              }`}
              title={isNavOpen ? 'Hide Categories (Ctrl+B)' : 'Show Categories (Ctrl+B)'}
              aria-label={isNavOpen ? 'Hide Categories sidebar' : 'Show Categories sidebar'}
            >
              {isNavOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              )}
              <span className="hidden xs:inline">Categories</span>
            </button>
          )}

          {/* Search Bar - now given full breathing room on mobile */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              id="product-search-input"
              data-testid="pos-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu (Ctrl+K or F2)..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs pl-8 sm:pl-10 pr-8 sm:pr-9 py-1.5 sm:py-2.5 rounded-2xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="shrink-0">
            <CustomDropdown
              id="product-sort-dropdown"
              value={sortBy}
              options={sortOptions}
              onChange={(val) => setSortBy(val)}
              align="right"
              buttonClassName="bg-slate-50 hover:bg-slate-100 text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-2xl border-slate-200"
            />
          </div>
        </div>

        {/* Mobile Horizontal Category Pills Strip */}
        {onSelectCategory && (
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pt-0.5">
            <button
              type="button"
              onClick={() => onSelectCategory('cat_all')}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 active-press ${
                selectedCategory === 'cat_all'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => onSelectCategory('featured')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 active-press ${
                selectedCategory === 'featured'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Specials</span>
            </button>
            {categories
              .filter((c) => c.id !== 'cat_all')
              .map((cat) => {
                const isSel = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 active-press ${
                      isSel
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Catalog Grid Area */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 pb-28 lg:pb-4">
        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
          <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 sm:gap-2">
            {categoryTitle}
            <span className="text-[10px] sm:text-[11px] font-normal text-slate-400 font-mono">
              ({filteredProducts.length} items)
            </span>
          </h2>
          {searchQuery && (
            <span className="text-[10px] sm:text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
              Filtered by "{searchQuery}"
            </span>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">No Menu Items Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mb-3">
              No products match your current search query.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-colors"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5">
            {filteredProducts.map((product) => {
              const inCartQty = cartQtyMap[product.id] || 0;
              const isUnavailable = product.isAvailable === false;

              return (
                <div
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={() => {
                    if (!isUnavailable) {
                      onAddToCart(product);
                    } else {
                      posSound.playError();
                    }
                  }}
                  className={`group relative bg-white rounded-3xl border transition-all duration-150 overflow-hidden flex flex-col shadow-xs ${
                    isUnavailable
                      ? 'opacity-60 border-slate-200 cursor-not-allowed'
                      : 'border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer active-press'
                  }`}
                >
                  {/* Image Container */}
                  <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient shadow for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none"></div>

                    {/* Top Right Badges: In-Cart Count */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                      {inCartQty > 0 && (
                        <span className="flex items-center gap-1 bg-blue-600 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-md animate-in zoom-in-75">
                          <CheckCircle2 className="w-3 h-3" />
                          {inCartQty} in cart
                        </span>
                      )}
                    </div>

                    {/* Unavailable Overlay */}
                    {isUnavailable && (
                      <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest backdrop-blur-[1px]">
                        Unavailable
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 font-normal mb-2">
                        {product.description || ''}
                      </p>
                    </div>

                    {/* Price & Add Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-xs font-mono font-extrabold text-slate-900">
                          {settings.currencySymbol}
                          {(Number(product.sellingPrice) || 0).toFixed(2)}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isUnavailable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isUnavailable) onAddToCart(product);
                        }}
                        className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all active-press ${
                          isUnavailable
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : inCartQty > 0
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{inCartQty > 0 ? '+ Add' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};
