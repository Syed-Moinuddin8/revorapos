import { Order, HeldOrder, CartItem, Product, Category, CafeSettings } from '../types';
import { posStorage } from './storage';
import { posDb } from '../server/db';
import { sql, isNeonConfigured } from './neon';
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

    // 3. Save directly to database if configured
    if (isNeonConfigured) {
      try {
        await posDb.upsertHeldOrder(localHeld);
        await posDb.upsertOrder(localOrder);
        console.log('[QR Order] Successfully saved to database:', localOrder.id);
        
        // Trigger immediate sync on all listening devices
        if (typeof window !== 'undefined') {
          // Dispatch custom event to force refresh
          window.dispatchEvent(new CustomEvent('pos_order_held'));
          window.dispatchEvent(new CustomEvent('pos_held_order_updated'));
        }
      } catch (err) {
        console.error('[QR Order] Failed to push order to database:', err);
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
   * Sync full state from Neon, Supabase or Cloud REST Database
   */
  public async syncState(): Promise<{
    orders: Order[];
    heldOrders: HeldOrder[];
    products?: Product[];
    categories?: Category[];
    settings?: CafeSettings;
  } | null> {
    // 1. Try Neon first if configured (PRIMARY GLOBAL CLOUD DB)
    if (isNeonConfigured && sql) {
      try {
        console.log('[Sync] Attempting Neon sync...');
        // Load data from Neon PostgreSQL
        const remoteOrders = await posDb.getAllOrdersAsync();
        const remoteHeldOrders = await posDb.getAllHeldOrdersAsync();
        const remoteProducts = await posDb.getAllProductsAsync();
        const remoteCategories = await posDb.getAllCategoriesAsync();
        const remoteSettings = await posDb.getSettingsAsync();

        let menuUpdated = false;
        if (remoteProducts && remoteProducts.length > 0) {
          try {
            const validRemote = remoteProducts.filter((p) => p && p.id);
            localStorage.setItem('cafe_pos_products_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
          // If Neon is empty, push local data TO Neon
          console.log('[Sync] Neon database is empty, pushing local products...');
          try {
            const localProducts = posStorage.getProducts();
            if (localProducts && localProducts.length > 0) {
              for (const p of localProducts) {
                await posDb.upsertProduct(p);
              }
              console.log(`[Sync] Pushed ${localProducts.length} products to Neon`);
            }
          } catch (err) {
            console.error('[Sync] Failed to push products to Neon:', err);
          }
        }

        if (remoteCategories && remoteCategories.length > 0) {
          try {
            const validRemote = remoteCategories.filter((c) => c && c.id);
            localStorage.setItem('cafe_pos_categories_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
          // If Neon is empty, push local data TO Neon
          console.log('[Sync] Neon database is empty, pushing local categories...');
          try {
            const localCategories = posStorage.getCategories();
            if (localCategories && localCategories.length > 0) {
              for (const c of localCategories) {
                await posDb.upsertCategory(c);
              }
              console.log(`[Sync] Pushed ${localCategories.length} categories to Neon`);
            }
          } catch (err) {
            console.error('[Sync] Failed to push categories to Neon:', err);
          }
        }

        if (remoteSettings && remoteSettings.cafeName) {
          try {
            localStorage.setItem('cafe_pos_settings_v1', JSON.stringify(remoteSettings));
            menuUpdated = true;
          } catch {}
        } else {
          // If Neon has no settings, push local settings TO Neon
          console.log('[Sync] Neon database has no settings, pushing local settings...');
          try {
            const localSettings = posStorage.getSettings();
            if (localSettings && localSettings.cafeName) {
              await posDb.saveSettings(localSettings);
              console.log('[Sync] Pushed settings to Neon');
            }
          } catch (err) {
            console.error('[Sync] Failed to push settings to Neon:', err);
          }
        }

        if (menuUpdated && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos_menu_updated'));
        }

        if (remoteOrders || remoteHeldOrders) {
          posStorage.syncFromServer(remoteOrders || [], remoteHeldOrders || []);
        }

        console.log('[Sync] Neon sync successful');
        return {
          orders: posStorage.getOrders(),
          heldOrders: posStorage.getHeldOrders(),
          products: posStorage.getProducts(),
          categories: posStorage.getCategories(),
          settings: posStorage.getSettings(),
        };
      } catch (err) {
        console.warn('[Sync] Neon sync failed, trying Supabase fallback:', err);
      }
    }

    // 2. Try Supabase if configured (SECONDARY FALLBACK)
    if (false) {
      try {
        console.log('[Sync] Attempting Supabase sync...');
        const remoteOrders = await posDb.getAllOrdersAsync();
        const remoteHeldOrders = await posDb.getAllHeldOrdersAsync();
        const remoteProducts = await posDb.getAllProductsAsync();
        const remoteCategories = await posDb.getAllCategoriesAsync();
        const remoteSettings = await posDb.getSettingsAsync();

        let menuUpdated = false;
        if (remoteProducts && remoteProducts.length > 0) {
          try {
            const validRemote = remoteProducts.filter((p) => p && p.id);
            localStorage.setItem('cafe_pos_products_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
          try {
            const localProducts = posStorage.getProducts();
            for (const p of localProducts) {
              await posDb.upsertProduct(p);
            }
          } catch {}
        }

        if (remoteCategories && remoteCategories.length > 0) {
          try {
            const validRemote = remoteCategories.filter((c) => c && c.id);
            localStorage.setItem('cafe_pos_categories_v2', JSON.stringify(validRemote));
            menuUpdated = true;
          } catch {}
        } else {
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

        if (remoteOrders || remoteHeldOrders) {
          posStorage.syncFromServer(remoteOrders || [], remoteHeldOrders || []);
          // Push any merged local orders/held orders to Supabase so all devices get the full unified list
          const allOrders = posStorage.getOrders();
          const allHeld = posStorage.getHeldOrders();
          for (const o of allOrders) {
            posDb.upsertOrder(o).catch(() => {});
          }
          for (const h of allHeld) {
            posDb.upsertHeldOrder(h).catch(() => {});
          }
        }

        console.log('[Sync] Supabase sync successful');
        return {
          orders: posStorage.getOrders(),
          heldOrders: posStorage.getHeldOrders(),
          products: posStorage.getProducts(),
          categories: posStorage.getCategories(),
          settings: posStorage.getSettings(),
        };
      } catch (err) {
        console.warn('[Sync] Supabase sync failed:', err);
      }
    }

    // 3. Try local Express / Vite API backend (/api/sync) - Last resort (optional)
    try {
      const res = await fetch('/api/sync').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        let menuUpdated = false;

        if (Array.isArray(data.products) && data.products.length > 0) {
          const currentStr = localStorage.getItem('cafe_pos_products_v2') || '';
          const newStr = JSON.stringify(data.products);
          if (currentStr !== newStr) {
            localStorage.setItem('cafe_pos_products_v2', newStr);
            menuUpdated = true;
          }
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          const currentStr = localStorage.getItem('cafe_pos_categories_v2') || '';
          const newStr = JSON.stringify(data.categories);
          if (currentStr !== newStr) {
            localStorage.setItem('cafe_pos_categories_v2', newStr);
            menuUpdated = true;
          }
        }
        if (data.settings && data.settings.cafeName) {
          const currentStr = localStorage.getItem('cafe_pos_settings_v1') || '';
          const newStr = JSON.stringify(data.settings);
          if (currentStr !== newStr) {
            localStorage.setItem('cafe_pos_settings_v1', newStr);
            menuUpdated = true;
          }
        }
        if (Array.isArray(data.orders) || Array.isArray(data.heldOrders)) {
          posStorage.syncFromServer(data.orders || [], data.heldOrders || []);
        }

        if (menuUpdated && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos_menu_updated'));
        }

        console.log('[Sync] Local API sync successful');
        return {
          orders: posStorage.getOrders(),
          heldOrders: posStorage.getHeldOrders(),
          products: posStorage.getProducts(),
          categories: posStorage.getCategories(),
          settings: posStorage.getSettings(),
        };
      }
    } catch (err) {
      // Silently ignore if local API not available
    }

    // 4. No cloud database configured - use localStorage only
    if (!isNeonConfigured) {
      console.log('[Sync] No database configured, using localStorage only');
    }
    return {
      orders: posStorage.getOrders(),
      heldOrders: posStorage.getHeldOrders(),
      products: posStorage.getProducts(),
      categories: posStorage.getCategories(),
      settings: posStorage.getSettings(),
    };
  }

  /**
   * Sync an order completion/update to database
   */
  public async syncOrderToServer(order: Order): Promise<void> {
    // Try Neon first, then Supabase
    if (isNeonConfigured) {
      await posDb.upsertOrder(order);
    }
    // Optionally sync to local Express API (if available)
    try {
      const allOrders = posStorage.getOrders();
      const allHeld = posStorage.getHeldOrders();
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: allOrders, heldOrders: allHeld }),
      }).catch(() => {});
    } catch {}
  }

  /**
   * Sync a held order status/update to database
   */
  public async syncHeldOrderToServer(heldOrder: HeldOrder): Promise<void> {
    if (isNeonConfigured) {
      await posDb.upsertHeldOrder(heldOrder);
    }
    try {
      const allOrders = posStorage.getOrders();
      const allHeld = posStorage.getHeldOrders();
      await fetch('/api/held-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: allOrders, heldOrders: allHeld }),
      }).catch(() => {});
    } catch {}
  }

  /**
   * Clear or recall held order from database
   */
  public async deleteHeldOrderFromServer(id: string): Promise<void> {
    if (isNeonConfigured) {
      await posDb.deleteHeldOrder(id);
    }
    try {
      const allOrders = posStorage.getOrders();
      const allHeld = posStorage.getHeldOrders();
      await fetch('/api/held-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: allOrders, heldOrders: allHeld }),
      }).catch(() => {});
    } catch {}
  }

  /**
   * Delete order from database
   */
  public async deleteOrderFromServer(orderId: string): Promise<boolean> {
    if (isNeonConfigured) {
      await posDb.deleteOrder(orderId);
    }
    try {
      const allOrders = posStorage.getOrders();
      const allHeld = posStorage.getHeldOrders();
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: allOrders, heldOrders: allHeld }),
      }).catch(() => {});
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Bulk delete orders from database
   */
  public async deleteOrdersFromServer(orderIds: string[]): Promise<boolean> {
    if (isNeonConfigured) {
      await posDb.deleteOrders(orderIds);
    }
    try {
      const allOrders = posStorage.getOrders();
      const allHeld = posStorage.getHeldOrders();
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: allOrders, heldOrders: allHeld }),
      }).catch(() => {});
      return true;
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
    if (false) {
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

    // SSE fallback for local node backend - DISABLED (using Neon PostgreSQL directly)
    // EventSource connection not needed when using cloud database
    // Polling below handles all sync needs

    // Polling interval fallback every 2 seconds for instant cross-device updates
    this.pollInterval = setInterval(async () => {
      const prevProdsJson = localStorage.getItem('cafe_pos_products_v2') || '';
      const prevCatsJson = localStorage.getItem('cafe_pos_categories_v2') || '';
      const prevSettingsJson = localStorage.getItem('cafe_pos_settings_v1') || '';
      const prevOrdersJson = localStorage.getItem('cafe_pos_orders_v1') || '';
      const prevHeldJson = localStorage.getItem('cafe_pos_held_orders_v1') || '';

      const state = await this.syncState();
      if (state) {
        const newProdsJson = localStorage.getItem('cafe_pos_products_v2') || '';
        const newCatsJson = localStorage.getItem('cafe_pos_categories_v2') || '';
        const newSettingsJson = localStorage.getItem('cafe_pos_settings_v1') || '';
        const newOrdersJson = localStorage.getItem('cafe_pos_orders_v1') || '';
        const newHeldJson = localStorage.getItem('cafe_pos_held_orders_v1') || '';

        if (
          prevProdsJson !== newProdsJson ||
          prevCatsJson !== newCatsJson ||
          prevSettingsJson !== newSettingsJson
        ) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('pos_menu_updated'));
          }
        }

        if (prevOrdersJson !== newOrdersJson || prevHeldJson !== newHeldJson) {
          onStateUpdated(state.orders, state.heldOrders);
        }
      }
    }, 2000);
  }

  public stopListening() {
    this.isListening = false;
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
    // For logo/branding images, store as base64 directly in settings
    // This works perfectly in browser and doesn't need server endpoint
    if (folder === 'branding' || folder === 'uploads') {
      if (
        dataUrl &&
        (dataUrl.startsWith('data:image/') ||
          dataUrl.startsWith('http://') ||
          dataUrl.startsWith('https://') ||
          dataUrl.startsWith('/'))
      ) {
        return { success: true, url: dataUrl };
      }
    }

    // For product images, also use base64 for simplicity
    if (
      dataUrl &&
      (dataUrl.startsWith('data:image/') ||
        dataUrl.startsWith('http://') ||
        dataUrl.startsWith('https://') ||
        dataUrl.startsWith('/'))
    ) {
      return { success: true, url: dataUrl };
    }

    return { success: false, error: 'Invalid image data' };
  }

  public async syncProductToServer(product: any): Promise<void> {
    // Save directly to Neon/Supabase database
    if (isNeonConfigured) {
      await posDb.upsertProduct(product);
    }
    // External API calls removed - using Neon PostgreSQL for all data storage
  }

  public async deleteProductFromServer(id: string): Promise<void> {
    // Delete from Neon/Supabase database
    if (isNeonConfigured) {
      await posDb.deleteProduct(id);
    }
    // External API calls removed - using Neon PostgreSQL for all data storage
  }

  public async syncCategoryToServer(category: any): Promise<void> {
    // Save directly to Neon/Supabase database
    if (isNeonConfigured) {
      await posDb.upsertCategory(category);
    }
    // External API calls removed - using Neon PostgreSQL for all data storage
  }

  public async deleteCategoryFromServer(id: string): Promise<void> {
    // Delete from Neon/Supabase database
    if (isNeonConfigured) {
      await posDb.deleteCategory(id);
    }
    // External API calls removed - using Neon PostgreSQL for all data storage
  }

  public async syncSettingsToServer(settings: any): Promise<void> {
    // Save directly to Neon/Supabase database
    if (isNeonConfigured) {
      await posDb.saveSettings(settings);
    }
    // External API calls removed - using Neon PostgreSQL for all data storage
  }
}

export const apiSync = new ApiSyncService();
