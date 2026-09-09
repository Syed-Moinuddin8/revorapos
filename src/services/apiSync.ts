import { Order, HeldOrder, CartItem, Product, Category, CafeSettings } from '../types';
import { posStorage } from './storage';
import { posDb } from '../server/db';
import { supabase, isSupabaseConfigured } from './supabase';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from '../data/initialData';

export interface TableQrOrderPayload {
  tableNumber: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
}

class ApiSyncService {
  private isListening = false;
  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private supabaseChannel: any = null;

  /**
   * Submit an order placed by customer through Table QR code
   */
  public async submitTableQrOrder(payload: TableQrOrderPayload): Promise<{ order: Order; heldOrder: HeldOrder }> {
    // 1. Try local Express backend if available
    try {
      const res = await fetch('/api/orders/table-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          try {
            const data = JSON.parse(text);
            if (data && data.order && data.heldOrder) {
              posStorage.mergeServerOrder(data.order);
              posStorage.mergeServerHeldOrder(data.heldOrder);
              return { order: data.order, heldOrder: data.heldOrder };
            }
          } catch {}
        }
      }
    } catch {
      // client-side static environment
    }

    // 2. Create held order & order structures
    const localHeld = posStorage.holdOrder({
      orderType: 'DINE_IN',
      tableNumber: payload.tableNumber,
      customer: {
        name: payload.customerName || `Table ${payload.tableNumber} Guest`,
        phone: payload.customerPhone || '',
      },
      notes: payload.notes ? `[Customer QR Table Order] ${payload.notes}` : `[Customer QR Table Order]`,
      cartItems: payload.items,
      items: payload.items,
      subtotal: payload.subtotal,
      taxAmount: payload.taxAmount,
      grandTotal: payload.grandTotal,
      source: 'CUSTOMER_QR',
    });

    const currentSettings = posStorage.getSettings();
    const currentTaxRate = Number(currentSettings?.taxRate) ?? 5;

    const localOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber: `CAF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      timestamp: Date.now(),
      orderType: 'DINE_IN',
      tableNumber: payload.tableNumber,
      items: payload.items.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.name,
        sku: ci.product.sku,
        categoryName: ci.product.categoryId,
        quantity: ci.quantity,
        unitPrice: ci.unitPrice,
        totalPrice: Number((ci.unitPrice * ci.quantity).toFixed(2)),
        costPrice: ci.product.costPrice,
        note: ci.note,
        isVeg: ci.product.isVeg,
      })),
      itemCount: payload.items.reduce((s, i) => s + i.quantity, 0),
      subtotal: payload.subtotal,
      discountType: 'PERCENT',
      discountValue: 0,
      discountAmount: 0,
      taxType: 'EXCLUSIVE',
      taxRate: currentTaxRate,
      taxAmount: payload.taxAmount,
      grandTotal: payload.grandTotal,
      paymentMethod: 'PENDING',
      paymentDetails: { method: 'OTHER' },
      customer: {
        name: payload.customerName || `Table ${payload.tableNumber} Guest`,
        phone: payload.customerPhone || '',
      },
      staff: {
        id: 'u_qr_guest',
        name: `Table ${payload.tableNumber}`,
        role: 'STAFF',
      },
      status: 'PENDING_TABLE_QR',
      notes: payload.notes,
      source: 'CUSTOMER_QR',
      heldOrderId: localHeld.id,
    };

    posStorage.mergeServerOrder(localOrder);

    // 3. Save directly to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await posDb.upsertHeldOrder(localHeld);
        await posDb.upsertOrder(localOrder);
      } catch (err) {
        console.warn('Failed to push QR order to Supabase:', err);
      }
    }

    return { order: localOrder, heldOrder: localHeld };
  }

  private mergeProducts(local: Product[], remote: Product[]): Product[] {
    const deletedIds = new Set(posStorage.getDeletedProductIds());
    const map = new Map<string, Product>();
    // First add remote products
    for (const p of remote || []) {
      if (p && p.id && !deletedIds.has(p.id)) {
        map.set(p.id, p);
      }
    }
    // Merge local products, preferring local updates unless remote is newer
    for (const p of local || []) {
      if (p && p.id && !deletedIds.has(p.id)) {
        const existingRemote = map.get(p.id);
        if (!existingRemote) {
          map.set(p.id, p);
        } else {
          const localTime = (p as any).updatedAt || 0;
          const remoteTime = (existingRemote as any).updatedAt || 0;
          if (localTime >= remoteTime) {
            map.set(p.id, p);
          } else {
            map.set(p.id, existingRemote);
          }
        }
      }
    }
    return Array.from(map.values());
  }

  private mergeCategories(local: Category[], remote: Category[]): Category[] {
    const deletedIds = new Set(posStorage.getDeletedCategoryIds());
    const map = new Map<string, Category>();
    for (const c of remote || []) {
      if (c && c.id && !deletedIds.has(c.id)) {
        map.set(c.id, c);
      }
    }
    for (const c of local || []) {
      if (c && c.id && !deletedIds.has(c.id)) {
        const existingRemote = map.get(c.id);
        if (!existingRemote) {
          map.set(c.id, c);
        } else {
          const localTime = (c as any).updatedAt || 0;
          const remoteTime = (existingRemote as any).updatedAt || 0;
          if (localTime >= remoteTime) {
            map.set(c.id, c);
          } else {
            map.set(c.id, existingRemote);
          }
        }
      }
    }
    return Array.from(map.values());
  }

  private mergeSettings(local: CafeSettings | null, remote: CafeSettings | null): CafeSettings {
    if (!local && !remote) return posStorage.getSettings();
    if (!local) return remote!;
    if (!remote) return local;

    const localTime = (local as any)._lastUpdated || 0;
    const remoteTime = (remote as any)._lastUpdated || 0;

    if (localTime >= remoteTime) {
      return { ...remote, ...local };
    } else {
      return { ...local, ...remote };
    }
  }

  /**
   * Sync full state from Supabase or server
   */
  public async syncState(): Promise<{
    orders: Order[];
    heldOrders: HeldOrder[];
    products?: Product[];
    categories?: Category[];
    settings?: CafeSettings;
  } | null> {
    // Try Supabase first if configured
    if (isSupabaseConfigured) {
      try {
        const remoteOrders = await posDb.getAllOrdersAsync();
        const remoteHeldOrders = await posDb.getAllHeldOrdersAsync();
        const remoteProducts = await posDb.getAllProductsAsync();
        const remoteCategories = await posDb.getAllCategoriesAsync();
        const remoteSettings = await posDb.getSettingsAsync();

        let menuUpdated = false;
        if (remoteProducts && remoteProducts.length > 0) {
          try {
            const deletedIds = new Set(posStorage.getDeletedProductIds());
            const validRemote = remoteProducts.filter((p) => p && p.id && !deletedIds.has(p.id));
            localStorage.setItem('cafe_pos_products_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
          // Seed Supabase database with catalog if empty
          try {
            const localProducts = posStorage.getProducts();
            for (const p of localProducts) {
              await posDb.upsertProduct(p);
            }
          } catch {}
        }

        if (remoteCategories && remoteCategories.length > 0) {
          try {
            const deletedIds = new Set(posStorage.getDeletedCategoryIds());
            const validRemote = remoteCategories.filter((c) => c && c.id && !deletedIds.has(c.id));
            localStorage.setItem('cafe_pos_categories_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
          // Seed Supabase database with categories if empty
          try {
            const localCategories = posStorage.getCategories();
            for (const c of localCategories) {
              await posDb.upsertCategory(c);
            }
          } catch {}
        }

        if (remoteSettings && remoteSettings.cafeName) {
          try {
            localStorage.setItem('cafe_pos_settings_v1', JSON.stringify(remoteSettings));
            menuUpdated = true;
          } catch {}
        } else {
          try {
            const localSettings = posStorage.getSettings();
            await posDb.saveSettings(localSettings);
          } catch {}
        }

        if (menuUpdated && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos_menu_updated'));
        }

        if (remoteOrders && remoteHeldOrders) {
          posStorage.syncFromServer(remoteOrders, remoteHeldOrders);
          return {
            orders: posStorage.getOrders(),
            heldOrders: posStorage.getHeldOrders(),
            products: posStorage.getProducts(),
            categories: posStorage.getCategories(),
            settings: posStorage.getSettings(),
          };
        }
      } catch (err) {
        console.warn('Error syncing state from Supabase:', err);
      }
    }

    // Try Express backend fallback
    try {
      const res = await fetch('/api/sync');
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          try {
            const data = JSON.parse(text);
            let menuUpdated = false;
            if (Array.isArray(data.orders) && Array.isArray(data.heldOrders)) {
              posStorage.syncFromServer(data.orders, data.heldOrders);
            }
            if (Array.isArray(data.products) && data.products.length > 0) {
              try {
                const currentLocal = posStorage.getProducts();
                const mergedProds = this.mergeProducts(currentLocal, data.products);
                localStorage.setItem('cafe_pos_products_v2', JSON.stringify(mergedProds));
                menuUpdated = true;
              } catch {}
            }
            if (Array.isArray(data.categories) && data.categories.length > 0) {
              try {
                const currentLocalCats = posStorage.getCategories();
                const mergedCats = this.mergeCategories(currentLocalCats, data.categories);
                localStorage.setItem('cafe_pos_categories_v2', JSON.stringify(mergedCats));
                menuUpdated = true;
              } catch {}
            }
            if (menuUpdated && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('pos_menu_updated'));
            }
            return {
              orders: posStorage.getOrders(),
              heldOrders: posStorage.getHeldOrders(),
              products: posStorage.getProducts(),
              categories: posStorage.getCategories(),
              settings: posStorage.getSettings(),
            };
          } catch {}
        }
      }
    } catch {
      // silent offline
    }

    return null;
  }

  /**
   * Sync an order completion/update to Supabase / server
   */
  public async syncOrderToServer(order: Order): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.upsertOrder(order);
    }
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
    } catch {}
  }

  /**
   * Sync a held order status/update to Supabase / server
   */
  public async syncHeldOrderToServer(heldOrder: HeldOrder): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.upsertHeldOrder(heldOrder);
    }
    try {
      await fetch('/api/held-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(heldOrder),
      });
    } catch {}
  }

  /**
   * Clear or recall held order from Supabase / server
   */
  public async deleteHeldOrderFromServer(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.deleteHeldOrder(id);
    }
    try {
      await fetch(`/api/held-orders/${id}`, { method: 'DELETE' });
    } catch {}
  }

  /**
   * Delete order from Supabase / server
   */
  public async deleteOrderFromServer(orderId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      await posDb.deleteOrder(orderId);
    }
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return true;
    }
  }

  /**
   * Bulk delete orders from Supabase / server
   */
  public async deleteOrdersFromServer(orderIds: string[]): Promise<boolean> {
    if (isSupabaseConfigured) {
      await posDb.deleteOrders(orderIds);
    }
    try {
      const res = await fetch('/api/orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderIds }),
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  /**
   * Real-time SSE / Supabase listener & polling loop for staff / admin POS and KDS
   */
  public startListening(
    onNewTableOrder: (order: Order, heldOrder: HeldOrder) => void,
    onStateUpdated: (orders: Order[], heldOrders: HeldOrder[]) => void
  ) {
    if (this.isListening) return;
    this.isListening = true;

    // Initial sync
    this.syncState().then((state) => {
      if (state) {
        onStateUpdated(state.orders, state.heldOrders);
      }
    });

    // Supabase Real-time Subscription if configured
    if (isSupabaseConfigured && supabase) {
      try {
        this.supabaseChannel = supabase
          .channel('pos_realtime_changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'held_orders' },
            async (payload) => {
              const state = await this.syncState();
              if (state) {
                onStateUpdated(state.orders, state.heldOrders);
                if (payload.eventType === 'INSERT' && payload.new && payload.new.raw_json) {
                  const newHeld = payload.new.raw_json as HeldOrder;
                  if (newHeld.source === 'CUSTOMER_QR') {
                    onNewTableOrder({} as Order, newHeld);
                  }
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            async () => {
              const state = await this.syncState();
              if (state) {
                onStateUpdated(state.orders, state.heldOrders);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'products' },
            async () => {
              const remoteProducts = await posDb.getAllProductsAsync();
              if (remoteProducts && remoteProducts.length > 0) {
                try {
                  const deletedIds = new Set(posStorage.getDeletedProductIds());
                  const validRemote = remoteProducts.filter((p) => p && p.id && !deletedIds.has(p.id));
                  localStorage.setItem('cafe_pos_products_v2', JSON.stringify(validRemote));
                } catch {}
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pos_menu_updated'));
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'categories' },
            async () => {
              const remoteCategories = await posDb.getAllCategoriesAsync();
              if (remoteCategories && remoteCategories.length > 0) {
                try {
                  const deletedIds = new Set(posStorage.getDeletedCategoryIds());
                  const validRemote = remoteCategories.filter((c) => c && c.id && !deletedIds.has(c.id));
                  localStorage.setItem('cafe_pos_categories_v2', JSON.stringify(validRemote));
                } catch {}
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pos_menu_updated'));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase Realtime subscription error:', err);
      }
    }

    // SSE fallback for local node backend
    try {
      if (typeof window !== 'undefined' && window.EventSource) {
        this.eventSource = new EventSource('/api/events');
        this.eventSource.addEventListener('new_table_order', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.order && data.heldOrder) {
              posStorage.mergeServerOrder(data.order);
              posStorage.mergeServerHeldOrder(data.heldOrder);
              onNewTableOrder(data.order, data.heldOrder);
            }
          } catch (err) {
            console.error('Error parsing SSE new_table_order event:', err);
          }
        });

        this.eventSource.addEventListener('orders_updated', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.orders) {
              posStorage.syncFromServer(data.orders, data.heldOrders || posStorage.getHeldOrders());
              onStateUpdated(posStorage.getOrders(), posStorage.getHeldOrders());
            }
          } catch {}
        });

        this.eventSource.addEventListener('held_orders_updated', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data.heldOrders) {
              posStorage.syncFromServer(posStorage.getOrders(), data.heldOrders);
              onStateUpdated(posStorage.getOrders(), posStorage.getHeldOrders());
            }
          } catch {}
        });
      }
    } catch {}

    // Polling interval fallback every 2.5 seconds
    this.pollInterval = setInterval(async () => {
      const prevHeldCount = posStorage.getHeldOrders().length;
      const prevOrderCount = posStorage.getOrders().length;
      const prevProdCount = posStorage.getProducts().length;
      const prevCatCount = posStorage.getCategories().length;
      const state = await this.syncState();
      if (state) {
        if (state.heldOrders.length !== prevHeldCount || state.orders.length !== prevOrderCount) {
          onStateUpdated(state.orders, state.heldOrders);
        }
        if (
          state.products &&
          (state.products.length !== prevProdCount || (state.categories && state.categories.length !== prevCatCount))
        ) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pos_menu_updated'));
          }
        }
      }
    }, 2500);
  }

  public stopListening() {
    this.isListening = false;
    if (this.supabaseChannel && supabase) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ================= CATALOG MANAGEMENT HELPERS =================

  public async uploadImage(
    dataUrl: string,
    fileName?: string,
    folder: 'items' | 'branding' | 'uploads' = 'uploads'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName, folder }),
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) {
          try {
            const data = JSON.parse(text);
            if (data && data.url) {
              return { success: true, url: data.url };
            }
          } catch {}
        }
      }
    } catch {}

    // Fallback: If server endpoint returns non-JSON or static 404 (e.g. on Vercel deployment),
    // cleanly fall back to using the base64 dataUrl directly so custom images render perfectly!
    if (
      dataUrl &&
      (dataUrl.startsWith('data:image/') ||
        dataUrl.startsWith('http://') ||
        dataUrl.startsWith('https://') ||
        dataUrl.startsWith('/'))
    ) {
      return { success: true, url: dataUrl };
    }

    return { success: false, error: 'Failed to process image file' };
  }

  public async syncProductToServer(product: any): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.upsertProduct(product);
    }
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
    } catch {}
  }

  public async deleteProductFromServer(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.deleteProduct(id);
    }
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
    } catch {}
  }

  public async syncCategoryToServer(category: any): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.upsertCategory(category);
    }
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category),
      });
    } catch {}
  }

  public async deleteCategoryFromServer(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.deleteCategory(id);
    }
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    } catch {}
  }

  public async syncSettingsToServer(settings: any): Promise<void> {
    if (isSupabaseConfigured) {
      await posDb.saveSettings(settings);
    }
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {}
  }
}

export const apiSync = new ApiSyncService();
