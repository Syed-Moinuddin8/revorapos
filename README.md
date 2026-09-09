# Revora POS & Real-Time Billing System

A high-performance Café Point-of-Sale (POS), Table QR Code Self-Ordering, Kitchen Display System (KDS), and Billing platform powered by **Neon PostgreSQL** and **Vercel**.

## 🚀 Key Features

- **Point of Sale (POS)**: Fast barcode/SKU scanning, visual product catalog, cart management, instant discounts, split bills, and thermal receipt printing.
- **Table QR Self-Ordering**: Customers scan dynamic table QR codes on their mobile phones to browse the menu and place live orders.
- **Multi-Location Database**: Single Neon PostgreSQL database (10 GB FREE) accessible from any location worldwide.
- **Real-Time Sync**: Automatic synchronization across all devices and locations in 1-2 seconds.
- **Vercel Hosted**: High-speed static SPA frontend with serverless deployment.
- **Offline-Resilient**: Automatically caches state locally using `localStorage` and falls back gracefully during network blips.

---

## 🛠️ Quick Setup (Multi-Location Database)

### 1. Database Setup (Neon PostgreSQL - FREE Forever)
1. Go to [Neon.tech](https://neon.tech) and create a **FREE account** (no credit card required).
2. Create a new project (takes 30 seconds).
3. Copy your connection string from the dashboard.
4. Open **SQL Editor** in Neon.
5. Copy and paste the entire contents of `neon_schema.sql` from this repository.
6. Click **Run** to create all tables and indexes.

**You get:** 10 GB storage (20x more than Supabase), UNLIMITED bandwidth, FREE forever!

### 2. Environment Configuration
1. Create a `.env` file in the project root (copy from `.env.example`):
```env
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
VITE_DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
```
2. Replace with your actual Neon connection string from Step 1.
3. **Same credentials work from ALL locations** - just need internet connection!

### 3. Install & Run
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm run preview
```

### 4. Deploy to Vercel (For Internet Access from Anywhere)
1. Push this repository to GitHub.
2. Import into [Vercel](https://vercel.com).
3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL`: Your Neon connection string
   - `VITE_DATABASE_URL`: Same Neon connection string
4. Deploy - now accessible from any location worldwide via Vercel URL!

---

## 🌐 Multi-Location Access

### Access from ANYWHERE with Internet:
1. Deploy to Vercel (see step 4 above).
2. Access from any device: `https://your-app.vercel.app`
3. Works on:
   - Different cafes (different cities/countries)
   - Mobile data (4G/5G)
   - Any WiFi network
   - Home, office, anywhere!

### All Locations Share Same Database:
- Create order in Location 1 → Appears in Location 2 instantly
- Update product in Location 2 → Reflects in Location 1 immediately
- Real-time sync across ALL locations worldwide

---

## 🔄 Real-Time Synchronization

The system uses PostgreSQL + Server-Sent Events for real-time sync:
- **Orders**: New orders appear instantly across all locations
- **Products**: Inventory changes sync immediately
- **Held Orders**: Visible across all devices and locations
- **Settings**: Configuration changes apply everywhere

No manual syncing required - everything happens automatically!

---

## 📱 Supported Devices & Locations

- **Desktop POS**: Windows, Mac, Linux (any location)
- **Tablet POS**: iPad, Android tablets (any location)
- **Kitchen Display**: Any device with browser (any location)
- **Customer QR Ordering**: Any smartphone (any location)
- **Admin Panel**: Access from anywhere

All devices/locations connect to the same Neon database via internet.

---

## 💰 Cost Comparison

| Solution | Storage | Bandwidth | Cost |
|----------|---------|-----------|------|
| **Neon (Current)** | 10 GB | Unlimited | **$0 forever** ✅ |
| Supabase Free | 500 MB | 2 GB/month | $0 (limited) |
| Supabase Pro | 8 GB | 50 GB/month | $25/month |
| Firebase | 1 GB | 10 GB/month | $25-100/month |

**Neon gives you 20x more storage than Supabase FREE tier!**

---

## 🔧 Troubleshooting

### Database not connecting?
1. Check your `.env` file has correct Neon connection string
2. Verify the `neon_schema.sql` was run successfully in Neon SQL Editor
3. Check Neon Dashboard > Project to ensure it's active
4. Ensure internet connection is working

### Can't access from other locations?
- Ensure you've deployed to Vercel for internet access
- Check firewall/network settings allow HTTPS
- Verify you're using the Vercel URL (not localhost)

### Changes not syncing?
1. Check internet connection on all devices
2. Hard refresh browser: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
3. Check Neon Dashboard to ensure database is active
4. Verify all devices using same connection string

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint
```

---

## 📚 Documentation

- **Quick Start**: See `NEON_SETUP_GUIDE.md` for detailed setup
- **Multi-Location**: See `MULTI_LOCATION_FREE_SOLUTION.md` for alternatives
- **Database Schema**: See `neon_schema.sql` for table structure

---

## 📚 Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**🎉 Enjoy your FREE multi-location POS system with 10 GB database!**
