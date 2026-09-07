import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  Product,
  Category,
  Order,
  HeldOrder,
  User,
  Customer,
  CafeSettings,
} from '../types';

export interface DbStatus {
  connected: boolean;
  dbPath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  journalMode: string;
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

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'pos.sqlite');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_FILE);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      icon_name TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      category_id TEXT,
      description TEXT,
      selling_price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 5,
      image_url TEXT,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      is_veg INTEGER DEFAULT 1,
      is_available INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      order_type TEXT NOT NULL,
      table_number TEXT,
      item_count INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      tax_rate REAL DEFAULT 5,
      tax_amount REAL NOT NULL,
      discount_type TEXT DEFAULT 'PERCENT',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      staff_name TEXT,
      source TEXT DEFAULT 'STAFF',
      held_order_id TEXT,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS held_orders (
      id TEXT PRIMARY KEY,
      hold_number INTEGER,
      created_at INTEGER NOT NULL,
      held_at TEXT,
      order_type TEXT NOT NULL,
      table_number TEXT,
      subtotal REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      notes TEXT,
      source TEXT DEFAULT 'STAFF',
      kitchen_status TEXT DEFAULT 'PREPARING',
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT,
      email TEXT,
      role TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp);
    CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  `);
}

export const posDb = {
  getDb,

  getStatus(): DbStatus {
    const db = getDb();
    const stats = fs.statSync(DB_FILE);
    const journalMode = db.pragma('journal_mode', { simple: true }) as string;

    const count = (table: string): number => {
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        return row ? row.count : 0;
      } catch {
        return 0;
      }
    };

    const bytes = stats.size;
    const formatted = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

    return {
      connected: true,
      dbPath: DB_FILE,
      fileSizeBytes: bytes,
      fileSizeFormatted: formatted,
      journalMode: String(journalMode),
      tableCounts: {
        products: count('products'),
        categories: count('categories'),
        orders: count('orders'),
        heldOrders: count('held_orders'),
        users: count('users'),
        customers: count('customers'),
        settings: count('settings'),
      },
    };
  },

  // ------------------- CATEGORIES -------------------
  getAllCategories(): Category[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM categories ORDER BY sort_order ASC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  upsertCategory(cat: Category) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO categories (id, name, slug, icon_name, sort_order, is_active, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        icon_name = excluded.icon_name,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active,
        raw_json = excluded.raw_json
    `);
    stmt.run(
      cat.id,
      cat.name,
      cat.slug || '',
      cat.iconName || '',
      cat.sortOrder || 0,
      cat.isActive ? 1 : 0,
      JSON.stringify(cat)
    );
  },

  deleteCategory(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  // ------------------- PRODUCTS -------------------
  getAllProducts(): Product[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM products ORDER BY name ASC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  upsertProduct(prod: Product) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO products (
        id, name, sku, barcode, category_id, description,
        selling_price, cost_price, tax_rate, image_url,
        stock, min_stock, unit, is_veg, is_available, is_featured, created_at, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sku = excluded.sku,
        barcode = excluded.barcode,
        category_id = excluded.category_id,
        description = excluded.description,
        selling_price = excluded.selling_price,
        cost_price = excluded.cost_price,
        tax_rate = excluded.tax_rate,
        image_url = excluded.image_url,
        stock = excluded.stock,
        min_stock = excluded.min_stock,
        unit = excluded.unit,
        is_veg = excluded.is_veg,
        is_available = excluded.is_available,
        is_featured = excluded.is_featured,
        created_at = excluded.created_at,
        raw_json = excluded.raw_json
    `);
    stmt.run(
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
      prod.isVeg ? 1 : 0,
      prod.isAvailable ? 1 : 0,
      prod.isFeatured ? 1 : 0,
      prod.createdAt || new Date().toISOString(),
      JSON.stringify(prod)
    );
  },

  deleteProduct(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  },

  // ------------------- ORDERS -------------------
  getAllOrders(): Order[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM orders ORDER BY timestamp DESC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  getOrderById(id: string): Order | null {
    const db = getDb();
    const row = db.prepare('SELECT raw_json FROM orders WHERE id = ? OR order_number = ?').get(id, id) as { raw_json: string } | undefined;
    return row ? JSON.parse(row.raw_json) : null;
  },

  upsertOrder(order: Order) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO orders (
        id, order_number, date, time, timestamp, order_type, table_number,
        item_count, subtotal, tax_rate, tax_amount, discount_type,
        discount_value, discount_amount, grand_total, payment_method,
        status, customer_name, customer_phone, staff_name, source,
        held_order_id, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        order_number = excluded.order_number,
        date = excluded.date,
        time = excluded.time,
        timestamp = excluded.timestamp,
        order_type = excluded.order_type,
        table_number = excluded.table_number,
        item_count = excluded.item_count,
        subtotal = excluded.subtotal,
        tax_rate = excluded.tax_rate,
        tax_amount = excluded.tax_amount,
        discount_type = excluded.discount_type,
        discount_value = excluded.discount_value,
        discount_amount = excluded.discount_amount,
        grand_total = excluded.grand_total,
        payment_method = excluded.payment_method,
        status = excluded.status,
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        staff_name = excluded.staff_name,
        source = excluded.source,
        held_order_id = excluded.held_order_id,
        raw_json = excluded.raw_json
    `);
    stmt.run(
      order.id,
      order.orderNumber,
      order.date,
      order.time,
      order.timestamp || Date.now(),
      order.orderType,
      order.tableNumber || '',
      order.itemCount || 0,
      order.subtotal || 0,
      order.taxRate || 5,
      order.taxAmount || 0,
      order.discountType || 'PERCENT',
      order.discountValue || 0,
      order.discountAmount || 0,
      order.grandTotal || 0,
      order.paymentMethod,
      order.status,
      order.customer?.name || '',
      order.customer?.phone || '',
      order.staff?.name || '',
      order.source || 'STAFF',
      order.heldOrderId || '',
      JSON.stringify(order)
    );
  },

  deleteOrder(id: string): boolean {
    const db = getDb();
    const res = db.prepare('DELETE FROM orders WHERE id = ? OR order_number = ?').run(id, id);
    return res.changes > 0;
  },

  deleteOrders(ids: string[]): number {
    const db = getDb();
    let count = 0;
    const stmt = db.prepare('DELETE FROM orders WHERE id = ? OR order_number = ?');
    const deleteMany = db.transaction((idList: string[]) => {
      for (const id of idList) {
        const res = stmt.run(id, id);
        count += res.changes;
      }
    });
    deleteMany(ids);
    return count;
  },

  // ------------------- HELD ORDERS -------------------
  getAllHeldOrders(): HeldOrder[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM held_orders ORDER BY created_at DESC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  upsertHeldOrder(h: HeldOrder) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO held_orders (
        id, hold_number, created_at, held_at, order_type, table_number,
        subtotal, tax_amount, grand_total, customer_name, customer_phone,
        notes, source, kitchen_status, raw_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        hold_number = excluded.hold_number,
        created_at = excluded.created_at,
        held_at = excluded.held_at,
        order_type = excluded.order_type,
        table_number = excluded.table_number,
        subtotal = excluded.subtotal,
        tax_amount = excluded.tax_amount,
        grand_total = excluded.grand_total,
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        notes = excluded.notes,
        source = excluded.source,
        kitchen_status = excluded.kitchen_status,
        raw_json = excluded.raw_json
    `);
    stmt.run(
      h.id,
      h.holdNumber || 1,
      h.createdAt || Date.now(),
      h.heldAt || '',
      h.orderType,
      h.tableNumber || '',
      h.subtotal || 0,
      h.grandTotal ? h.grandTotal - h.subtotal : 0,
      h.grandTotal || 0,
      h.customer?.name || h.customerName || '',
      h.customer?.phone || '',
      h.notes || '',
      h.source || 'STAFF',
      h.kitchenStatus || 'PREPARING',
      JSON.stringify(h)
    );
  },

  deleteHeldOrder(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM held_orders WHERE id = ?').run(id);
  },

  // ------------------- USERS -------------------
  getAllUsers(): User[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM users ORDER BY name ASC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  upsertUser(u: User) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO users (id, name, username, email, role, pin_code, avatar, is_active, created_at, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        username = excluded.username,
        email = excluded.email,
        role = excluded.role,
        pin_code = excluded.pin_code,
        avatar = excluded.avatar,
        is_active = excluded.is_active,
        created_at = excluded.created_at,
        raw_json = excluded.raw_json
    `);
    stmt.run(
      u.id,
      u.name,
      u.username || '',
      u.email || '',
      u.role,
      u.pinCode || u.pin || '1234',
      u.avatar || '',
      u.isActive ? 1 : 0,
      u.createdAt || new Date().toISOString(),
      JSON.stringify(u)
    );
  },

  deleteUser(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  // ------------------- CUSTOMERS -------------------
  getAllCustomers(): Customer[] {
    const db = getDb();
    const rows = db.prepare('SELECT raw_json FROM customers ORDER BY name ASC').all() as { raw_json: string }[];
    return rows.map((r) => JSON.parse(r.raw_json));
  },

  upsertCustomer(c: Customer) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO customers (id, name, phone, email, total_orders, total_spent, created_at, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        total_orders = excluded.total_orders,
        total_spent = excluded.total_spent,
        raw_json = excluded.raw_json
    `);
    stmt.run(
      c.id,
      c.name,
      c.phone,
      c.email || '',
      c.totalOrders || 0,
      c.totalSpent || 0,
      c.createdAt || new Date().toISOString(),
      JSON.stringify(c)
    );
  },

  // ------------------- SETTINGS -------------------
  getSettings(): CafeSettings | null {
    const db = getDb();
    const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('cafe_settings') as { value_json: string } | undefined;
    return row ? JSON.parse(row.value_json) : null;
  },

  saveSettings(settings: CafeSettings) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO settings (key, value_json)
      VALUES ('cafe_settings', ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `);
    stmt.run(JSON.stringify(settings));
  },

  // ------------------- FULL SYNC -------------------
  syncAll(payload: {
    products?: Product[];
    categories?: Category[];
    orders?: Order[];
    heldOrders?: HeldOrder[];
    users?: User[];
    customers?: Customer[];
    settings?: CafeSettings;
  }) {
    const db = getDb();
    const tx = db.transaction(() => {
      if (payload.categories) {
        for (const c of payload.categories) posDb.upsertCategory(c);
      }
      if (payload.products) {
        for (const p of payload.products) posDb.upsertProduct(p);
      }
      if (payload.orders) {
        for (const o of payload.orders) posDb.upsertOrder(o);
      }
      if (payload.heldOrders) {
        for (const h of payload.heldOrders) posDb.upsertHeldOrder(h);
      }
      if (payload.users) {
        for (const u of payload.users) posDb.upsertUser(u);
      }
      if (payload.customers) {
        for (const c of payload.customers) posDb.upsertCustomer(c);
      }
      if (payload.settings) {
        posDb.saveSettings(payload.settings);
      }
    });
    tx();
  },

  exportDump() {
    return {
      status: posDb.getStatus(),
      categories: posDb.getAllCategories(),
      products: posDb.getAllProducts(),
      orders: posDb.getAllOrders(),
      heldOrders: posDb.getAllHeldOrders(),
      users: posDb.getAllUsers(),
      customers: posDb.getAllCustomers(),
      settings: posDb.getSettings(),
    };
  },
};
