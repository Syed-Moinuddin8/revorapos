import { supabase, isSupabaseConfigured } from '../services/supabase';
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
  provider: 'supabase' | 'in-memory';
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
      provider: isSupabaseConfigured ? 'supabase' : 'in-memory',
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
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (!error && data) {
        return data.map((item) => (item.raw_json ? (item.raw_json as Category) : (item as unknown as Category)));
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
    if (isSupabaseConfigured && supabase) {
      await supabase.from('categories').delete().eq('id', id);
    }
  },

  // ------------------- PRODUCTS -------------------
  async getAllProductsAsync(): Promise<Product[]> {
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
    if (isSupabaseConfigured && supabase) {
      await supabase.from('products').delete().eq('id', id);
    }
  },

  // ------------------- ORDERS -------------------
  async getAllOrdersAsync(): Promise<Order[]> {
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
    if (isSupabaseConfigured && supabase) {
      await supabase.from('orders').delete().or(`id.eq.${id},order_number.eq.${id}`);
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
