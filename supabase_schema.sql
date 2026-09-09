-- Revora Café POS & Billing System - Supabase Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon_name TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id TEXT,
  description TEXT,
  selling_price NUMERIC(10,2) DEFAULT 0,
  cost_price NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 5,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  is_veg BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  order_type TEXT NOT NULL,
  table_number TEXT,
  item_count INTEGER DEFAULT 1,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 5,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_type TEXT DEFAULT 'PERCENT',
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  grand_total NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'CASH',
  status TEXT DEFAULT 'COMPLETED',
  customer_name TEXT,
  customer_phone TEXT,
  staff_name TEXT,
  source TEXT DEFAULT 'STAFF',
  held_order_id TEXT,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- =====================================================
-- HELD ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS held_orders (
  id TEXT PRIMARY KEY,
  hold_number INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL,
  held_at TEXT,
  order_type TEXT NOT NULL,
  table_number TEXT,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  grand_total NUMERIC(10,2) DEFAULT 0,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  source TEXT DEFAULT 'STAFF',
  kitchen_status TEXT DEFAULT 'PREPARING',
  raw_json JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_held_orders_created ON held_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_held_orders_kitchen_status ON held_orders(kitchen_status);
CREATE INDEX IF NOT EXISTS idx_held_orders_table ON held_orders(table_number);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  email TEXT,
  role TEXT NOT NULL,
  pin_code TEXT DEFAULT '1234',
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- =====================================================
-- SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_held_orders_updated_at BEFORE UPDATE ON held_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Disabled for Public Access
-- =====================================================
-- For a cafe POS system, we typically want open access from any device
-- If you need authentication, enable RLS and add policies

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE held_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write access (adjust based on your security needs)
CREATE POLICY "Enable all access for anon users on categories"
  ON categories FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on products"
  ON products FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on orders"
  ON orders FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on held_orders"
  ON held_orders FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on users"
  ON users FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on customers"
  ON customers FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable all access for anon users on settings"
  ON settings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- REALTIME PUBLICATION (Enable real-time subscriptions)
-- =====================================================
-- This allows the app to receive live updates across all devices

ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE held_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- =====================================================
-- COMPLETE
-- =====================================================
-- Database schema created successfully!
-- Next steps:
-- 1. Copy your Supabase URL and Anon Key
-- 2. Create a .env file in your project root
-- 3. Add: VITE_SUPABASE_URL=your_url
-- 4. Add: VITE_SUPABASE_ANON_KEY=your_key
-- 5. Deploy to Vercel or run locally with npm run dev
