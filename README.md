# Café POS & Real-Time Billing System

A high-performance Café Point-of-Sale (POS), Table QR Code Self-Ordering, Kitchen Display System (KDS), and Billing platform with real-time order synchronization.

## 🚀 Key Features

- **Point of Sale (POS)**: Fast barcode/SKU scanning, visual product catalog, cart management, instant discounts, split bills, and thermal receipt printing (80mm format).
- **Table QR Self-Ordering**: Customers scan dynamic table QR codes on their mobile phones to browse the menu and place live orders.
- **Live Order Synchronization**: Real-Time Server-Sent Events (SSE) stream table orders directly to the cashier POS and kitchen screen without delay.
- **Persistent SQLite Database**: Stores products, categories, orders, held orders, customers, and café settings in `data/pos.sqlite`.
- **Offline-Resilient**: Automatically caches state locally using `localStorage` and falls back gracefully during network blips.

---

## 🛠️ Deploying with Live Sync (Option 1: Render / Railway / Fly.io / Cloud Run)

To keep the persistent Express backend, Server-Sent Events, and SQLite database active for live table QR orders across customer phones:

### Deploy to Render (Recommended - Free Tier Available)
1. Push this repository to **GitHub**.
2. Go to [Render.com](https://render.com) and click **New + > Web Service**.
3. Connect your GitHub repository.
4. Set the following build and start configurations:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. (Optional) Under **Disks**, add a persistent disk mounted to `/data` if you want SQLite database files to persist across redeploys.
6. Click **Deploy Web Service**.

### Deploy to Railway
1. Go to [Railway.app](https://railway.app) and select **New Project > Deploy from GitHub repo**.
2. Railway detects the `npm run build` and `npm start` scripts in `package.json` automatically.
3. Add a persistent volume mounted to `/data` for SQLite persistence.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run the development server (bootstraps Express + Vite on port 3000)
npm run dev

# 3. Build for production
npm run build

# 4. Start production server
npm start
```

---

## 📲 How Table QR Ordering Works

1. In the POS, open the **Table QR** modal from the header navigation.
2. Select a table (e.g. `T-01`) or print the full table QR sheet.
3. Customers scan the QR code with their mobile phone camera.
4. The customer browses the menu, adds items, and taps **Place Order**.
5. The order streams instantly into the POS cashier screen and audio chime sounds:
   - Visible under **Held / QR Orders** and real-time pop-up notification.
   - Cashier can click to convert into an active cart, review, apply discounts, and complete billing.
