import { Order, HeldOrder, CartItem } from '../types';
import { posStorage } from './storage';

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

  /**
   * Submit an order placed by customer through Table QR code
   */
  public async submitTableQrOrder(payload: TableQrOrderPayload): Promise<{ order: Order; heldOrder: HeldOrder }> {
    try {
      const res = await fetch('/api/orders/table-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.order && data.heldOrder) {
          // Reconcile into client local storage immediately
          posStorage.mergeServerOrder(data.order);
          posStorage.mergeServerHeldOrder(data.heldOrder);
          return { order: data.order, heldOrder: data.heldOrder };
        }
      }
    } catch (err) {
      console.warn('API server submitTableQrOrder offline or error, falling back to local storage:', err);
    }

    // Local fallback if server unreachable
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
      taxRate: 5,
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
    return { order: localOrder, heldOrder: localHeld };
  }

  /**
   * Sync full state from server
   */
  public async syncState(): Promise<{ orders: Order[]; heldOrders: HeldOrder[] } | null> {
    try {
      const res = await fetch('/api/sync');
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data.orders) && Array.isArray(data.heldOrders)) {
        posStorage.syncFromServer(data.orders, data.heldOrders);

        // Auto-heal: If client has any held orders that the server is missing, push them to the server
        const currentHeld = posStorage.getHeldOrders();
        const serverHeldIds = new Set(data.heldOrders.map((h: HeldOrder) => h.id));
        for (const lh of currentHeld) {
          if (!serverHeldIds.has(lh.id)) {
            this.syncHeldOrderToServer(lh);
          }
        }

        return { orders: posStorage.getOrders(), heldOrders: posStorage.getHeldOrders() };
      }
    } catch {
      // offline/silent
    }
    return null;
  }

  /**
   * Sync an order completion/update to server
   */
  public async syncOrderToServer(order: Order): Promise<void> {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
    } catch (err) {
      console.warn('Failed to sync order to server:', err);
    }
  }

  /**
   * Sync a held order status/update to server
   */
  public async syncHeldOrderToServer(heldOrder: HeldOrder): Promise<void> {
    try {
      await fetch('/api/held-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(heldOrder),
      });
    } catch (err) {
      console.warn('Failed to sync held order to server:', err);
    }
  }

  /**
   * Clear or recall held order from server
   */
  public async deleteHeldOrderFromServer(id: string): Promise<void> {
    try {
      await fetch(`/api/held-orders/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Failed to delete held order on server:', err);
    }
  }

  /**
   * Delete order from server
   */
  public async deleteOrderFromServer(orderId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to delete order on server:', err);
      return false;
    }
  }

  /**
   * Bulk delete orders from server
   */
  public async deleteOrdersFromServer(orderIds: string[]): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: orderIds }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Failed to bulk delete orders on server:', err);
      return false;
    }
  }

  /**
   * Start listening for real-time order notifications
   */
  public startListening(
    onNewTableOrder: (order: Order, heldOrder: HeldOrder) => void,
    onStateUpdated: (orders: Order[], heldOrders: HeldOrder[]) => void
  ) {
    if (this.isListening) return;
    this.isListening = true;

    // 1. Initial sync
    this.syncState().then((state) => {
      if (state) {
        onStateUpdated(state.orders, state.heldOrders);
      }
    });

    // 2. Setup SSE connection
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
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
    } catch (err) {
      console.warn('SSE not available, relying on fast polling:', err);
    }

    // 3. Setup fast fallback polling every 2.5 seconds
    this.pollInterval = setInterval(async () => {
      const prevHeldCount = posStorage.getHeldOrders().length;
      const prevOrderCount = posStorage.getOrders().length;
      const state = await this.syncState();
      if (state) {
        // If count changed or new table QR orders exist, update UI
        if (state.heldOrders.length !== prevHeldCount || state.orders.length !== prevOrderCount) {
          onStateUpdated(state.orders, state.heldOrders);
        }
      }
    }, 2500);
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

  // ================= SQLITE DATABASE API HELPERS =================

  /**
   * Fetch current SQLite database status and metrics
   */
  public async getDbStatus(): Promise<any> {
    try {
      const res = await fetch('/api/db/status');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch SQLite status:', err);
    }
    return null;
  }

  /**
   * Trigger download of the pos.sqlite database file
   */
  public downloadSqliteFile(): void {
    const link = document.createElement('a');
    link.href = '/api/db/download-sqlite';
    link.download = 'cafe_pos.sqlite';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Push full application dataset to SQLite
   */
  public async syncAllToSqlite(payload: {
    products?: any[];
    categories?: any[];
    orders?: any[];
    heldOrders?: any[];
    users?: any[];
    customers?: any[];
    settings?: any;
  }): Promise<boolean> {
    try {
      const res = await fetch('/api/db/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error('Error syncing all to SQLite:', err);
      return false;
    }
  }

  /**
   * Load entire SQLite database dump to hydrate client
   */
  public async fetchFullDumpFromSqlite(): Promise<any> {
    try {
      const res = await fetch('/api/db/sync-all');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('Failed to fetch SQLite dump:', err);
    }
    return null;
  }

  // ================= LOCAL IMAGE STORAGE =================

  /**
   * Upload image data URL to be saved as a real local file on the server
   */
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
      const data = await res.json();
      if (res.ok && data.url) {
        return { success: true, url: data.url };
      }
      return { success: false, error: data.error || 'Failed to upload image' };
    } catch (err: any) {
      console.error('Error uploading image to local storage:', err);
      return { success: false, error: err.message || 'Network error uploading image' };
    }
  }

  /**
   * Sync a product upsert to SQLite
   */
  public async syncProductToServer(product: any): Promise<void> {
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
    } catch (err) {
      console.warn('Failed to sync product to server:', err);
    }
  }

  /**
   * Delete product on SQLite server
   */
  public async deleteProductFromServer(id: string): Promise<void> {
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete product on server:', err);
    }
  }

  /**
   * Sync category upsert to SQLite
   */
  public async syncCategoryToServer(category: any): Promise<void> {
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category),
      });
    } catch (err) {
      console.warn('Failed to sync category to server:', err);
    }
  }

  /**
   * Delete category on SQLite server
   */
  public async deleteCategoryFromServer(id: string): Promise<void> {
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete category on server:', err);
    }
  }

  /**
   * Sync settings to SQLite server
   */
  public async syncSettingsToServer(settings: any): Promise<void> {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (err) {
      console.warn('Failed to sync settings to server:', err);
    }
  }
}

export const apiSync = new ApiSyncService();
