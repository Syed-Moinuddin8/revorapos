import { sql, isNeonConfigured, executeQuery, executeQueryOne } from '../services/neon';
import {
  Product,
  Category,
  Order,
  HeldOrder,
  User,
  Customer,
  CafeSettings,
} from '../types';
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_SETTINGS,
} from '../data/initialData';

export interface DbStatus {
  connected: boolean;
  provider: 'neon' | 'supabase' | 'in-memory';
  tableCounts: {
    products: number;
    categories: number;
    orders: number;
    heldOrders: number;
    users: number;
    customers: number;
    settings: number;
  };
}

// Memory fallback store for when Supabase keys are not set
const memoryStore = {
  categories: [...INITIAL_CATEGORIES] as Category[],
  products: [...INITIAL_PRODUCTS] as Product[],
  orders: [...INITIAL_ORDERS] as Order[],
  heldOrders: [] as HeldOrder[],
  users: [...INITIAL_USERS] as User[],
  customers: [...INITIAL_CUSTOMERS] as Customer[],
  settings: { ...INITIAL_SETTINGS } as CafeSettings,
};

export const posDb = {
  getStatus(): DbStatus {
    return {
      connected: true,
      provider: isNeonConfigured ? 'neon' : 'in-memory',
      tableCounts: {
        products: memoryStore.products.length,
        categories: memoryStore.categories.length,
        orders: memoryStore.orders.length,
        heldOrders: memoryStore.heldOrders.length,
        users: memoryStore.users.length,
        customers: memoryStore.customers.length,
        settings: 1,
      },
    };
  },

  // ------------------- CATEGORIES -------------------
  async getAllCategoriesAsync(): Promise<Category[]> {
    // Try Neon first (priority)
    if (isNeonConfigured && sql) {
      try {
        const rows = await executeQuery<any>(`
          SELECT id, name, slug, icon_name, sort_order, is_active, raw_json, created_at, updated_at
          FROM categories
          ORDER BY sort_order ASC
        `);
        if (rows && rows.length > 0) {
          return rows.map(row => row.raw_json || row);
        }
      } catch (error) {
        console.warn('Neon query failed:', error);
      }
    }

    return memoryStore.categories;
  },

  getAllCategories(): Category[] {
    return memoryStore.categories;
  },

  async upsertCategory(cat: Category): Promise<void> {
    const idx = memoryStore.categories.findIndex((c) => c.id === cat.id);
    if (idx >= 0) memoryStore.categories[idx] = cat;
    else memoryStore.categories.push(cat);

    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        await executeQuery(`
          INSERT INTO categories (id, name, slug, icon_name, sort_order, is_active, raw_json, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = $2,
            slug = $3,
            icon_name = $4,
            sort_order = $5,
            is_active = $6,
            raw_json = $7,
            updated_at = NOW()
        `, [
          cat.id,
          cat.name,
          cat.slug || '',
          cat.iconName || '',
          cat.sortOrder || 0,
          cat.isActive ?? true,
          JSON.stringify(cat)
        ]);
        return;
      } catch (error) {
        console.warn('Neon upsert failed, trying Supabase fallback:', error);
      }
    }

    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('categories').upsert({
        id: cat.id,
        name: cat.name,
        slug: cat.slug || '',
        icon_name: cat.iconName || '',
        sort_order: cat.sortOrder || 0,
        is_active: cat.isActive ?? true,
        raw_json: cat,
      });
    }
  },

  async deleteCategory(id: string): Promise<void> {
    memoryStore.categories = memoryStore.categories.filter((c) => c.id !== id);
    
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        await executeQuery(`DELETE FROM categories WHERE id = $1`, [id]);
        return;
      } catch (error) {
        console.warn('Neon delete failed, trying Supabase fallback:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('categories').delete().eq('id', id);
    }
  },

  // ------------------- PRODUCTS -------------------
  async getAllProductsAsync(): Promise<Product[]> {
    // Try Neon first (priority)
    if (isNeonConfigured && sql) {
      try {
        const rows = await executeQuery<any>(`
          SELECT id, name, sku, barcode, category_id, description, selling_price, cost_price, 
                 tax_rate, image_url, stock, min_stock, unit, is_veg, is_available, is_featured, 
                 raw_json, created_at, updated_at
          FROM products
          ORDER BY name ASC
        `);
        if (rows && rows.length > 0) {
          return rows.map(row => row.raw_json || row);
        }
      } catch (error) {
        console.warn('Neon query failed, trying Supabase fallback:', error);
      }
    }

    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as Product) : (item as unknown as Product)));
      }
    }
    return memoryStore.products;
  },

  getAllProducts(): Product[] {
    return memoryStore.products;
  },

  async upsertProduct(prod: Product): Promise<void> {
    const idx = memoryStore.products.findIndex((p) => p.id === prod.id);
    if (idx >= 0) memoryStore.products[idx] = prod;
    else memoryStore.products.push(prod);

    console.log('[DB] upsertProduct called for:', prod.name, 'isNeonConfigured:', isNeonConfigured);

    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        console.log('[DB] Saving product to Neon:', prod.id);
        await executeQuery(`
          INSERT INTO products (id, name, sku, barcode, category_id, description, selling_price, cost_price,
                               tax_rate, image_url, stock, min_stock, unit, is_veg, is_available, is_featured,
                               raw_json, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = $2,
            sku = $3,
            barcode = $4,
            category_id = $5,
            description = $6,
            selling_price = $7,
            cost_price = $8,
            tax_rate = $9,
            image_url = $10,
            stock = $11,
            min_stock = $12,
            unit = $13,
            is_veg = $14,
            is_available = $15,
            is_featured = $16,
            raw_json = $17,
            updated_at = NOW()
        `, [
          prod.id,
          prod.name,
          prod.sku || '',
          prod.barcode || '',
          prod.categoryId,
          prod.description || '',
          prod.sellingPrice || 0,
          prod.costPrice || 0,
          prod.taxRate || 5,
          prod.imageUrl || '',
          prod.stock ?? 0,
          prod.minStock ?? 0,
          prod.unit || 'pcs',
          prod.isVeg ?? true,
          prod.isAvailable ?? true,
          prod.isFeatured ?? false,
          JSON.stringify(prod)
        ]);
        console.log('[DB] Product saved to Neon successfully:', prod.id);
        return;
      } catch (error) {
        console.error('[DB] Neon upsert failed:', error);
      }
    } else {
      console.warn('[DB] Neon not configured, sql:', !!sql);
    }

    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('products').upsert({
        id: prod.id,
        name: prod.name,
        sku: prod.sku || '',
        barcode: prod.barcode || '',
        category_id: prod.categoryId,
        description: prod.description || '',
        selling_price: prod.sellingPrice || 0,
        cost_price: prod.costPrice || 0,
        tax_rate: prod.taxRate || 5,
        image_url: prod.imageUrl || '',
        stock: prod.stock ?? 0,
        min_stock: prod.minStock ?? 0,
        unit: prod.unit || 'pcs',
        is_veg: prod.isVeg ?? true,
        is_available: prod.isAvailable ?? true,
        is_featured: prod.isFeatured ?? false,
        created_at: prod.createdAt || new Date().toISOString(),
        raw_json: prod,
      });
    }
  },

  async deleteProduct(id: string): Promise<void> {
    memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
    
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        await executeQuery(`DELETE FROM products WHERE id = $1`, [id]);
        return;
      } catch (error) {
        console.warn('Neon delete failed, trying Supabase fallback:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('products').delete().eq('id', id);
    }
  },

  // ------------------- ORDERS -------------------
  async getAllOrdersAsync(): Promise<Order[]> {
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        const rows = await executeQuery<any>(`
          SELECT id, order_number, date, time, timestamp, order_type, table_number, item_count,
                 subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
                 grand_total, payment_method, status, customer_name, customer_phone, staff_name,
                 source, held_order_id, raw_json, created_at, updated_at
          FROM orders
          ORDER BY timestamp DESC
        `);
        if (rows && rows.length > 0) {
          return rows.map(row => row.raw_json || row);
        }
      } catch (error) {
        console.warn('Neon query failed, trying Supabase fallback:', error);
      }
    }

    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as Order) : (item as unknown as Order)));
      }
    }
    return memoryStore.orders;
  },

  getAllOrders(): Order[] {
    return memoryStore.orders;
  },

  getOrderById(id: string): Order | null {
    return memoryStore.orders.find((o) => o.id === id || o.orderNumber === id) || null;
  },

  async upsertOrder(order: Order): Promise<void> {
    const idx = memoryStore.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) memoryStore.orders[idx] = order;
    else memoryStore.orders.unshift(order);

    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        await executeQuery(`
          INSERT INTO orders (id, order_number, date, time, timestamp, order_type, table_number, item_count,
                             subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
                             grand_total, payment_method, status, customer_name, customer_phone, staff_name,
                             source, held_order_id, raw_json, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            order_number = $2, date = $3, time = $4, timestamp = $5, order_type = $6, table_number = $7,
            item_count = $8, subtotal = $9, tax_rate = $10, tax_amount = $11, discount_type = $12,
            discount_value = $13, discount_amount = $14, grand_total = $15, payment_method = $16,
            status = $17, customer_name = $18, customer_phone = $19, staff_name = $20, source = $21,
            held_order_id = $22, raw_json = $23, updated_at = NOW()
        `, [
          order.id,
          order.orderNumber,
          order.date,
          order.time,
          order.timestamp || Date.now(),
          order.orderType,
          order.tableNumber || '',
          order.itemCount || (order.items ? order.items.reduce((s, i) => s + (i.quantity || 1), 0) : 1),
          order.subtotal || 0,
          order.taxRate || 5,
          order.taxAmount || 0,
          order.discountType || 'PERCENT',
          order.discountValue || 0,
          order.discountAmount || 0,
          order.grandTotal || 0,
          order.paymentMethod || 'CASH',
          order.status || 'COMPLETED',
          order.customer?.name || '',
          order.customer?.phone || '',
          order.staff?.name || '',
          order.source || 'STAFF',
          order.heldOrderId || '',
          JSON.stringify(order)
        ]);
        return;
      } catch (error) {
        console.warn('Neon upsert order failed, trying Supabase fallback:', error);
      }
    }

    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('orders').upsert({
        id: order.id,
        order_number: order.orderNumber,
        date: order.date,
        time: order.time,
        timestamp: order.timestamp || Date.now(),
        order_type: order.orderType,
        table_number: order.tableNumber || '',
        item_count: order.itemCount || (order.items ? order.items.reduce((s, i) => s + (i.quantity || 1), 0) : 1),
        subtotal: order.subtotal || 0,
        tax_rate: order.taxRate || 5,
        tax_amount: order.taxAmount || 0,
        discount_type: order.discountType || 'PERCENT',
        discount_value: order.discountValue || 0,
        discount_amount: order.discountAmount || 0,
        grand_total: order.grandTotal || 0,
        payment_method: order.paymentMethod || 'CASH',
        status: order.status || 'COMPLETED',
        customer_name: order.customer?.name || '',
        customer_phone: order.customer?.phone || '',
        staff_name: order.staff?.name || '',
        source: order.source || 'STAFF',
        held_order_id: order.heldOrderId || '',
        raw_json: order,
      });
    }
  },

  async deleteOrder(id: string): Promise<boolean> {
    const initLen = memoryStore.orders.length;
    memoryStore.orders = memoryStore.orders.filter((o) => o.id !== id && o.orderNumber !== id);
    
    console.log('[DB] deleteOrder called for:', id, 'isNeonConfigured:', isNeonConfigured);
    
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        console.log('[DB] Deleting order from Neon:', id);
        const result = await executeQuery(`
          DELETE FROM orders 
          WHERE id = $1 OR order_number = $1
        `, [id]);
        console.log('[DB] Order deleted from Neon successfully:', id);
        return true;
      } catch (error) {
        console.error('[DB] Neon delete order failed:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('orders').delete().or(`id.eq.${id},order_number.eq.${id}`);
      return true;
    }
    
    return memoryStore.orders.length < initLen;
  },

  async deleteOrders(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      const deleted = await this.deleteOrder(id);
      if (deleted) count++;
    }
    return count;
  },

  // ------------------- HELD ORDERS -------------------
  async getAllHeldOrdersAsync(): Promise<HeldOrder[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('held_orders').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as HeldOrder) : (item as unknown as HeldOrder)));
      }
    }
    return memoryStore.heldOrders;
  },

  getAllHeldOrders(): HeldOrder[] {
    return memoryStore.heldOrders;
  },

  async upsertHeldOrder(h: HeldOrder): Promise<void> {
    const idx = memoryStore.heldOrders.findIndex((item) => item.id === h.id);
    if (idx >= 0) memoryStore.heldOrders[idx] = h;
    else memoryStore.heldOrders.unshift(h);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('held_orders').upsert({
        id: h.id,
        hold_number: h.holdNumber || 1,
        created_at: h.createdAt || Date.now(),
        held_at: h.heldAt || '',
        order_type: h.orderType,
        table_number: h.tableNumber || '',
        subtotal: h.subtotal || 0,
        tax_amount: h.grandTotal ? h.grandTotal - h.subtotal : 0,
        grand_total: h.grandTotal || 0,
        customer_name: h.customer?.name || h.customerName || '',
        customer_phone: h.customer?.phone || '',
        notes: h.notes || '',
        source: h.source || 'STAFF',
        kitchen_status: h.kitchenStatus || 'PREPARING',
        raw_json: h,
      });
    }
  },

  async deleteHeldOrder(id: string): Promise<void> {
    memoryStore.heldOrders = memoryStore.heldOrders.filter((h) => h.id !== id);
    
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        await executeQuery(`DELETE FROM held_orders WHERE id = $1`, [id]);
        console.log('[DB] Held order deleted from Neon:', id);
        return;
      } catch (error) {
        console.error('[DB] Neon delete held order failed:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('held_orders').delete().eq('id', id);
    }
  },

  // ------------------- USERS -------------------
  async getAllUsersAsync(): Promise<User[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as User) : (item as unknown as User)));
      }
    }
    return memoryStore.users;
  },

  getAllUsers(): User[] {
    return memoryStore.users;
  },

  async upsertUser(u: User): Promise<void> {
    const idx = memoryStore.users.findIndex((item) => item.id === u.id);
    if (idx >= 0) memoryStore.users[idx] = u;
    else memoryStore.users.push(u);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('users').upsert({
        id: u.id,
        name: u.name,
        username: u.username || '',
        email: u.email || '',
        role: u.role,
        pin_code: u.pinCode || u.pin || '1234',
        avatar: u.avatar || '',
        is_active: u.isActive ?? true,
        created_at: u.createdAt || new Date().toISOString(),
        raw_json: u,
      });
    }
  },

  async deleteUser(id: string): Promise<void> {
    memoryStore.users = memoryStore.users.filter((u) => u.id !== id);
    if (isSupabaseConfigured && supabase) {
      await supabase.from('users').delete().eq('id', id);
    }
  },

  // ------------------- CUSTOMERS -------------------
  async getAllCustomersAsync(): Promise<Customer[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as Customer) : (item as unknown as Customer)));
      }
    }
    return memoryStore.customers;
  },

  getAllCustomers(): Customer[] {
    return memoryStore.customers;
  },

  async upsertCustomer(c: Customer): Promise<void> {
    const idx = memoryStore.customers.findIndex((item) => item.id === c.id);
    if (idx >= 0) memoryStore.customers[idx] = c;
    else memoryStore.customers.push(c);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('customers').upsert({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        total_orders: c.totalOrders || 0,
        total_spent: c.totalSpent || 0,
        created_at: c.createdAt || new Date().toISOString(),
        raw_json: c,
      });
    }
  },

  // ------------------- SETTINGS -------------------
  async getSettingsAsync(): Promise<CafeSettings> {
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        const rows = await executeQuery<any>(`
          SELECT key, value_json, created_at, updated_at
          FROM settings
          WHERE key = $1
        `, ['cafe_settings']);
        if (rows && rows.length > 0 && rows[0].value_json) {
          return rows[0].value_json as CafeSettings;
        }
      } catch (error) {
        console.warn('Neon getSettings failed, trying Supabase fallback:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('settings').select('*').eq('key', 'cafe_settings').single();
      if (data && data.value_json) {
        return data.value_json as CafeSettings;
      }
    }
    return memoryStore.settings;
  },

  getSettings(): CafeSettings {
    return memoryStore.settings;
  },

  async saveSettings(settings: CafeSettings): Promise<void> {
    memoryStore.settings = settings;
    
    console.log('[DB] saveSettings called, isNeonConfigured:', isNeonConfigured);
    
    // Try Neon first
    if (isNeonConfigured && sql) {
      try {
        console.log('[DB] Saving settings to Neon...');
        await executeQuery(`
          INSERT INTO settings (key, value_json, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT (key) DO UPDATE SET
            value_json = $2,
            updated_at = NOW()
        `, ['cafe_settings', JSON.stringify(settings)]);
        console.log('[DB] Settings saved to Neon successfully');
        return;
      } catch (error) {
        console.error('[DB] Neon save settings failed:', error);
      }
    }
    
    // Fallback to Supabase
    if (isSupabaseConfigured && supabase) {
      await supabase.from('settings').upsert({
        key: 'cafe_settings',
        value_json: settings,
      });
    }
  },

  // ------------------- FULL SYNC -------------------
  async syncAll(payload: {
    products?: Product[];
    categories?: Category[];
    orders?: Order[];
    heldOrders?: HeldOrder[];
    users?: User[];
    customers?: Customer[];
    settings?: CafeSettings;
  }): Promise<void> {
    if (payload.categories) {
      for (const c of payload.categories) await this.upsertCategory(c);
    }
    if (payload.products) {
      for (const p of payload.products) await this.upsertProduct(p);
    }
    if (payload.orders) {
      for (const o of payload.orders) await this.upsertOrder(o);
    }
    if (payload.heldOrders) {
      for (const h of payload.heldOrders) await this.upsertHeldOrder(h);
    }
    if (payload.users) {
      for (const u of payload.users) await this.upsertUser(u);
    }
    if (payload.customers) {
      for (const c of payload.customers) await this.upsertCustomer(c);
    }
    if (payload.settings) {
      await this.saveSettings(payload.settings);
    }
  },

  exportDump() {
    return {
      status: this.getStatus(),
      categories: memoryStore.categories,
      products: memoryStore.products,
      orders: memoryStore.orders,
      heldOrders: memoryStore.heldOrders,
      users: memoryStore.users,
      customers: memoryStore.customers,
      settings: memoryStore.settings,
    };
  },
};
