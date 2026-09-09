import React, { useState, useMemo } from 'react';
import { Product, Category, CafeSettings, User } from '../../types';
import { posStorage } from '../../services/storage';
import { posSound } from '../../services/sound';
import { apiSync } from '../../services/apiSync';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  X,
  Sparkles,
  Layers,
  Coffee,
  CupSoda,
  GlassWater,
  Sandwich,
  Pizza,
  Utensils,
  Cake,
  LayoutGrid,
  List,
  Lock,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw,
  Upload,
  HardDrive,
  RefreshCw,
  Globe,
} from 'lucide-react';

const CATEGORY_ICONS = [
  { name: 'Utensils', label: 'Food / Meals', icon: Utensils },
  { name: 'Coffee', label: 'Coffee', icon: Coffee },
  { name: 'CupSoda', label: 'Tea & Soda', icon: CupSoda },
  { name: 'GlassWater', label: 'Cold Drinks', icon: GlassWater },
  { name: 'Sandwich', label: 'Sandwiches', icon: Sandwich },
  { name: 'Pizza', label: 'Pizza & Savory', icon: Pizza },
  { name: 'Cake', label: 'Desserts', icon: Cake },
  { name: 'Sparkles', label: 'Specials', icon: Sparkles },
  { name: 'LayoutGrid', label: 'General', icon: LayoutGrid },
];

interface ProductManagementViewProps {
  products: Product[];
  categories: Category[];
  settings: CafeSettings;
  currentUser?: User;
  onRefreshProducts: () => void;
}

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products = [],
  categories = [],
  settings,
  currentUser,
  onRefreshProducts,
}) => {
  const isAdmin = (currentUser?.role || posStorage.getCurrentUser()?.role) === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'>('name-asc');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    iconName: 'Utensils',
  });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    categoryId: 'cat_coffee',
    description: '',
    sellingPrice: 150,
    costPrice: 50,
    taxRate: 5,
    imageUrl: '/images/items/cappuccino.jpg',
    stock: 50,
    minStock: 10,
    unit: 'cup',
    isVeg: true,
    isAvailable: true,
    isFeatured: false,
  });

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose a valid image file (PNG, JPG, WebP)');
      return;
    }

    setIsUploadingImage(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const res = await apiSync.uploadImage(dataUrl, file.name, 'items');
        if (res.success && res.url) {
          setFormData((prev) => ({ ...prev, imageUrl: res.url }));
          posSound.playSuccess();
        } else {
          setUploadError(res.error || 'Upload failed');
        }
        setIsUploadingImage(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read local file');
        setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file');
      setIsUploadingImage(false);
    }
  };

  // Calculate quick metrics
  const activeCategories = useMemo(
    () => categories.filter((c) => c.id !== 'cat_all'),
    [categories]
  );

  const avgPrice = useMemo(() => {
    if (!products.length) return '0.00';
    const sum = products.reduce((acc, p) => acc + (Number(p.sellingPrice) || 0), 0);
    return (sum / products.length).toFixed(0);
  }, [products]);

  const vegCount = useMemo(
    () => products.filter((p) => p.isVeg).length,
    [products]
  );

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      if (selectedCat !== 'ALL' && p.categoryId !== selectedCat) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'price-asc') return (Number(a.sellingPrice) || 0) - (Number(b.sellingPrice) || 0);
      if (sortBy === 'price-desc') return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
      return 0;
    });
  }, [products, selectedCat, searchQuery, sortBy]);

  // Category Icon & Tag styling helper
  const getCatIcon = (cat?: Category) => {
    if (!cat) return Utensils;
    const item = CATEGORY_ICONS.find((ci) => ci.name === cat.iconName);
    return item ? item.icon : Utensils;
  };

  const getCategoryColor = (name: string = '') => {
    const s = name.toLowerCase();
    if (s.includes('coffee')) return 'bg-amber-50 text-amber-900 border-amber-200/80';
    if (s.includes('tea')) return 'bg-emerald-50 text-emerald-900 border-emerald-200/80';
    if (s.includes('cold') || s.includes('shake') || s.includes('soda')) return 'bg-sky-50 text-sky-900 border-sky-200/80';
    if (s.includes('burger') || s.includes('sandwich')) return 'bg-orange-50 text-orange-900 border-orange-200/80';
    if (s.includes('pizza') || s.includes('savory')) return 'bg-rose-50 text-rose-900 border-rose-200/80';
    if (s.includes('dessert') || s.includes('cake')) return 'bg-purple-50 text-purple-900 border-purple-200/80';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const handleOpenNew = () => {
    if (!isAdmin) return;
    const randomSku = `CAF-ITM-${Math.floor(100 + Math.random() * 900)}`;
    const randomBarcode = `890100${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      name: '',
      sku: randomSku,
      barcode: randomBarcode,
      categoryId: categories[1]?.id || 'cat_coffee',
      description: '',
      sellingPrice: 150,
      costPrice: 50,
      taxRate: settings.taxRate || 5,
      imageUrl: '/images/items/cappuccino.jpg',
      stock: 50,
      minStock: 10,
      unit: 'cup',
      isVeg: true,
      isAvailable: true,
      isFeatured: false,
    });
    setEditingProduct(null);
    setIsNewModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    if (!isAdmin) return;
    setFormData({ ...p });
    setEditingProduct(p);
    setIsNewModalOpen(true);
  };

  const handleDuplicate = (p: Product) => {
    if (!isAdmin) return;
    const copy: Product = {
      ...p,
      id: `prod_${Date.now()}`,
      name: `${p.name} (Copy)`,
      sku: `CAF-CPY-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `890100${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    posStorage.saveProduct(copy);
    apiSync.syncProductToServer(copy);
    onRefreshProducts();
    posSound.playItemAdd();
  };

  const handleDelete = (p: Product) => {
    if (!isAdmin) return;
    setProductToDelete(p);
  };

  const confirmDeleteProduct = () => {
    if (!isAdmin) return;
    if (productToDelete) {
      posStorage.deleteProduct(productToDelete.id);
      apiSync.deleteProductFromServer(productToDelete.id);
      onRefreshProducts();
      posSound.playDelete();
      setProductToDelete(null);
    }
  };

  const confirmDeleteCategory = () => {
    if (!isAdmin || !categoryToDelete) return;

    // Check if products belong to this category and reassign to fallback category
    const affectedProducts = products.filter((p) => p.categoryId === categoryToDelete.id);
    const fallbackCategory = categories.find(
      (c) => c.id !== 'cat_all' && c.id !== categoryToDelete.id
    );

    if (fallbackCategory && affectedProducts.length > 0) {
      affectedProducts.forEach((p) => {
        const updated = { ...p, categoryId: fallbackCategory.id };
        posStorage.saveProduct(updated);
        apiSync.syncProductToServer(updated);
      });
    }

    posStorage.deleteCategory(categoryToDelete.id);
    apiSync.deleteCategoryFromServer(categoryToDelete.id);
    if (selectedCat === categoryToDelete.id) {
      setSelectedCat('ALL');
    }
    onRefreshProducts();
    posSound.playDelete();
    setCategoryToDelete(null);
  };

  const handleSave = () => {
    if (!isAdmin) return;
    if (!formData.name?.trim()) {
      alert('Product name is required');
      return;
    }
    if ((formData.sellingPrice || 0) < 0) {
      alert('Selling price cannot be negative');
      return;
    }

    const prodToSave: Product = {
      id: editingProduct ? editingProduct.id : `prod_${Date.now()}`,
      name: formData.name!.trim(),
      sku: formData.sku?.trim() || `CAF-GEN-${Date.now().toString().slice(-4)}`,
      barcode: formData.barcode?.trim() || '8901000000',
      categoryId: formData.categoryId || 'cat_coffee',
      description: formData.description || '',
      sellingPrice: Number(formData.sellingPrice || 0),
      costPrice: Number(formData.costPrice || 0),
      taxRate: Number(settings.taxRate ?? 5),
      imageUrl: formData.imageUrl || '/images/items/cappuccino.jpg',
      stock: Number(formData.stock || 0),
      minStock: Number(formData.minStock || 5),
      unit: formData.unit || 'portion',
      isVeg: formData.isVeg !== undefined ? formData.isVeg : true,
      isAvailable: formData.isAvailable !== undefined ? formData.isAvailable : true,
      isFeatured: formData.isFeatured || false,
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString().split('T')[0],
    };

    posStorage.saveProduct(prodToSave);
    apiSync.syncProductToServer(prodToSave);
    onRefreshProducts();
    setIsNewModalOpen(false);
    posSound.playSuccess();
  };

  const handleSaveCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    if (!categoryFormData.name.trim()) {
      alert('Category name is required');
      return;
    }

    const trimmedName = categoryFormData.name.trim();
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: trimmedName,
      slug: slug || `cat-${Date.now()}`,
      iconName: categoryFormData.iconName || 'Utensils',
      sortOrder: categories.length,
      isActive: true,
    };

    posStorage.saveCategory(newCategory);
    apiSync.syncCategoryToServer(newCategory);
    onRefreshProducts();
    posSound.playSuccess();

    // If product modal is open, auto-select this newly created category
    if (isNewModalOpen) {
      setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
    }

    setCategoryFormData({ name: '', iconName: 'Utensils' });
    setIsCategoryModalOpen(false);
  };

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);

  const handleSyncAllToCloud = async () => {
    setIsSyncingCloud(true);
    setCloudSyncMessage(null);
    try {
      const allProds = posStorage.getProducts();
      const allCats = posStorage.getCategories();
      const allSettings = posStorage.getSettings();

      for (const p of allProds) {
        await apiSync.syncProductToServer(p);
      }
      for (const c of allCats) {
        await apiSync.syncCategoryToServer(c);
      }
      await apiSync.syncSettingsToServer(allSettings);

      posSound.playSuccess();
      setCloudSyncMessage('All catalog items & prices synced across all devices!');
      setTimeout(() => setCloudSyncMessage(null), 4000);
    } catch (err: any) {
      alert('Sync failed: ' + (err.message || err));
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-3 sm:space-y-4 select-none">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Menu & Catalog Management
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {products.length} Items
              </span>
            </div>
            {/* Quick Metrics Bar */}
            <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {activeCategories.length} Categories
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-600">
                Avg. Price: <span className="font-mono font-semibold text-slate-800">{settings.currencySymbol}{avgPrice}</span>
              </span>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            {cloudSyncMessage && (
              <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {cloudSyncMessage}
              </span>
            )}
            <button
              onClick={handleSyncAllToCloud}
              disabled={isSyncingCloud}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-200 shadow-2xs transition-colors cursor-pointer active-press disabled:opacity-50"
              title="Sync all current menu items, pricing & photos across all mobile QR devices and tablets"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-700 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingCloud ? 'Syncing...' : 'Sync Menu to All Devices'}</span>
            </button>
            <button
              onClick={() => {
                setCategoryFormData({ name: '', iconName: 'Utensils' });
                setIsCategoryModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer active-press"
            >
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Add Category</span>
            </button>
            <button
              onClick={handleOpenNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer active-press"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add New Product</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl border border-slate-200/90 shadow-2xs shrink-0 self-start lg:self-auto">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Staff Terminal • View-Only Menu (Admin PIN required to edit)</span>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar (Dual-Tier) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        {/* Tier 1: Search, Sort & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${products.length} items by title, SKU, ingredients...`}
              className="w-full text-xs pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all shadow-2xs placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort & View Toggle Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Sort Selector */}
            <div className="relative flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-700 font-semibold cursor-pointer hover:bg-slate-100 transition-colors appearance-none"
              >
                <option value="name-asc">Name: A to Z</option>
                <option value="name-desc">Name: Z to A</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            </div>

            {/* View Mode Toggle: Table / Grid */}
            <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Visual Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Category Filter Tabs Rail with Count Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5 border-t border-slate-100">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCat === 'ALL'
                ? 'bg-slate-900 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-transparent'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 opacity-80" />
            <span>All Items</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
              selectedCat === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {products.length}
            </span>
          </button>

          {activeCategories.map((c) => {
            const isSelected = selectedCat === c.id;
            const CatIcon = getCatIcon(c);
            const countInCat = products.filter((p) => p.categoryId === c.id).length;

            return (
              <div
                key={c.id}
                className={`inline-flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-slate-900 text-white font-bold shadow-xs border-slate-900'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200/90'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCat(c.id)}
                  className={`flex items-center gap-1.5 pl-3 ${isAdmin ? 'pr-1.5' : 'pr-3'} py-1.5 cursor-pointer`}
                >
                  <CatIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span>{c.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {countInCat}
                  </span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(c);
                    }}
                    title={`Delete category "${c.name}"`}
                    className={`p-1 mr-1 rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'hover:bg-rose-500 text-slate-300 hover:text-white'
                        : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {isAdmin && selectedCat !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                const activeCat = categories.find((c) => c.id === selectedCat);
                if (activeCat) setCategoryToDelete(activeCat);
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ml-1 shadow-2xs"
              title="Delete active category"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Table View or Visual Grid View */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">No menu items found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No products match "${searchQuery}". Check your spelling or try another keyword.`
                : 'No items exist in this category yet.'}
            </p>
          </div>
          {(searchQuery || selectedCat !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCat('ALL');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Search & Filters</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Rich & Balanced Table View */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="bg-slate-50/90 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 w-[46%]">Item & Details</th>
                  <th className="py-3.5 px-4 w-[24%]">Category</th>
                  <th className="py-3.5 px-4 w-[16%] text-right">Selling Price</th>
                  <th className="py-3.5 px-4 w-[14%] text-right">{isAdmin ? 'Actions' : 'Terminal Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  const CatIcon = getCatIcon(cat);
                  const catBadgeStyle = getCategoryColor(cat?.name || '');

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Item Info with Thumbnail, SKU & Description */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3.5">
                          <div className="relative shrink-0">
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200/80 shadow-2xs"
                            />
                            {p.isFeatured && (
                              <span
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] shadow-xs"
                                title="Featured Item"
                              >
                                ★
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                {p.name}
                              </span>
                              {p.sku && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium text-slate-400 bg-slate-100">
                                  #{p.sku.split('-').pop()}
                                </span>
                              )}
                            </div>
                            {p.description ? (
                              <p className="text-[11px] text-slate-500 truncate max-w-sm mt-0.5">
                                {p.description}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic mt-0.5">Freshly prepared order</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Tag with Icon */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catBadgeStyle}`}>
                          <CatIcon className="w-3.5 h-3.5 opacity-70" />
                          <span>{cat?.name || p.categoryId}</span>
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-extrabold text-slate-900 text-sm">
                          {settings.currencySymbol}{(Number(p.sellingPrice) || 0).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          +{p.taxRate || settings.taxPercentage || 5}% GST
                        </div>
                      </td>

                      {/* Actions (Admin) or Terminal Status (Staff) */}
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Product"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(p)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Product"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Available</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Visual Menu Card Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredProducts.map((p) => {
            const cat = categories.find((c) => c.id === p.categoryId);
            const CatIcon = getCatIcon(cat);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col group"
              >
                {/* Photo & Overlays */}
                <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />

                  {/* Price pill top-right */}
                  <div className="absolute top-2.5 right-2.5 bg-slate-900/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold shadow-sm">
                    {settings.currencySymbol}{(Number(p.sellingPrice) || 0).toFixed(2)}
                  </div>

                  {p.isFeatured && (
                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold shadow-xs">
                      ★ Chef Special
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mb-1">
                      <CatIcon className="w-3.5 h-3.5 opacity-70" />
                      <span>{cat?.name || p.categoryId}</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                      {p.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {p.description || 'Prepared fresh with premium ingredients.'}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-400 text-[10px]">
                      {p.sku ? `#${p.sku}` : ''}
                    </span>

                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1 text-slate-400 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(p)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        In Menu
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAdmin && isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[92vh] animate-in zoom-in-95">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                {editingProduct ? `Edit "${editingProduct.name}"` : 'Add New Menu Product'}
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Image Preview, Upload & URL */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-slate-300 bg-white">
                  <img
                    src={formData.imageUrl || '/images/items/cappuccino.jpg'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/items/espresso.jpg';
                    }}
                  />
                  {formData.imageUrl?.startsWith('/images/') && (
                    <span
                      className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[8px] font-bold text-center py-0.5"
                      title="Stored as local file in source code"
                    >
                      LOCAL FILE
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="font-bold text-slate-700 block">Product Image:</label>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-2xs transition-colors">
                      <Upload className="w-3 h-3" />
                      <span>{isUploadingImage ? 'Saving...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={formData.imageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="/images/items/cappuccino.jpg or http://..."
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 font-mono"
                  />

                  {uploadError && (
                    <p className="text-[11px] text-rose-600 font-medium">{uploadError}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] text-slate-500 font-medium">Local Presets:</span>
                    {[
                      { name: 'Coffee', url: '/images/items/cappuccino.jpg' },
                      { name: 'Tea', url: '/images/items/masala_chai.jpg' },
                      { name: 'Burger', url: '/images/items/veg_burger.jpg' },
                      { name: 'Pizza', url: '/images/items/margherita_pizza.jpg' },
                      { name: 'Brownie', url: '/images/items/sizzling_brownie.jpg' },
                      { name: 'Fries', url: '/images/items/peri_peri_fries.jpg' },
                    ].map((pre) => (
                      <button
                        key={pre.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: pre.url })}
                        className="text-[10px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded hover:bg-amber-50 hover:text-amber-800"
                      >
                        {pre.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Vanilla Iced Latte"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">Category *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFormData({ name: '', iconName: 'Utensils' });
                        setIsCategoryModalOpen(true);
                      }}
                      className="text-[11px] text-amber-700 hover:text-amber-800 font-bold flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add Category
                    </button>
                  </div>
                  <select
                    value={formData.categoryId || ''}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 font-semibold"
                  >
                    {categories.filter((c) => c.id !== 'cat_all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                <label className="font-bold text-slate-700 block mb-1">
                  Selling Price ({settings.currencySymbol || '₹'}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-sm">
                    {settings.currencySymbol || '₹'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={formData.sellingPrice || ''}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full text-sm font-bold font-mono pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-600"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ingredients, tasting notes, allergens..."
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg outline-none"
                />
              </div>

              {/* Switch: Chef's Special */}
              <div className="pt-1">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="rounded text-amber-600 w-4 h-4"
                  />
                  <span className="font-bold text-slate-700">Chef's Special / Featured Item ★</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs active-press"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAdmin && isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Add New Category</h3>
                  <p className="text-[11px] text-slate-500">Create a category to group your menu items</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  autoFocus
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g. Pasta & Noodles, Beverages, Breakfast..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-2">Category Icon</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORY_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = categoryFormData.iconName === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCategoryFormData({ ...categoryFormData, iconName: item.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <IconComp className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="text-[10px] leading-tight line-clamp-1">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs active-press"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {isAdmin && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Delete Product?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">"{productToDelete.name}"</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer active-press"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {isAdmin && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Delete Category?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete category <span className="font-semibold text-slate-800">"{categoryToDelete.name}"</span>?
                </p>
                {products.filter((p) => p.categoryId === categoryToDelete.id).length > 0 && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 mt-2">
                    Notice: {products.filter((p) => p.categoryId === categoryToDelete.id).length} product(s) currently in this category will be reassigned to another available category.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer active-press"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
