# Revora POS & Real-Time Billing System

A high-performance Café Point-of-Sale (POS), Table QR Code Self-Ordering, Kitchen Display System (KDS), and Billing platform powered by **Vercel** and **Supabase**.

## 🚀 Key Features

- **Point of Sale (POS)**: Fast barcode/SKU scanning, visual product catalog, cart management, instant discounts, split bills, and thermal receipt printing.
- **Table QR Self-Ordering**: Customers scan dynamic table QR codes on their mobile phones to browse the menu and place live orders.
- **Supabase Cloud Database**: Stores products, categories, orders, held orders, customers, and café settings in PostgreSQL.
- **Vercel Hosted**: High-speed static SPA frontend with serverless deployment.
- **Offline-Resilient**: Automatically caches state locally using `localStorage` and falls back gracefully during network blips.

---

## 🛠️ Deployment (Vercel + Supabase)

### 1. Database Setup (Supabase)
1. Go to your [Supabase Dashboard](https://app.supabase.com) and create a project.
2. Open the **SQL Editor**.
3. Copy the contents of `supabase_schema.sql` and run it to create tables and indexes.

### 2. Frontend Hosting (Vercel)
1. Import this repository into [Vercel](https://vercel.com).
2. Set Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon API Key
3. Click **Deploy**.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server
npm run dev

# 3. Build for production
npm run build
```
