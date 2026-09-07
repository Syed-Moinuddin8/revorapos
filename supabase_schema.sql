-- Supabase SQL Migration Schema for Café POS & Billing System
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  icon_name TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  raw_json JSONB
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id TEXT,
  description TEXT,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 5,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  is_veg BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TEXT,
  raw_json JSONB
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  order_type TEXT NOT NULL,
  table_number TEXT,
  item_count INTEGER NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 5,
  tax_amount NUMERIC NOT NULL,
  discount_type TEXT DEFAULT 'PERCENT',
  discount_value NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  staff_name TEXT,
  source TEXT DEFAULT 'STAFF',
  held_order_id TEXT,
  raw_json JSONB NOT NULL
);

-- 4. Held Orders
CREATE TABLE IF NOT EXISTS held_orders (
  id TEXT PRIMARY KEY,
  hold_number INTEGER,
  created_at BIGINT NOT NULL,
  held_at TEXT,
  order_type TEXT NOT NULL,
  table_number TEXT,
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'STAFF',
  kitchen_status TEXT DEFAULT 'PREPARING',
  raw_json JSONB NOT NULL
);

-- 5. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  email TEXT,
  role TEXT NOT NULL,
  pin_code TEXT NOT NULL,
  avatar TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT,
  raw_json JSONB
);

-- 6. Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TEXT,
  raw_json JSONB
);

-- 7. Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Disable Row Level Security (RLS) for public POS client access (or configure policies as needed)
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE held_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
