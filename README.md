# Revora POS & Real-Time Billing System

A high-performance Café Point-of-Sale (POS), Table QR Code Self-Ordering, Kitchen Display System (KDS), and Billing platform powered by **Vercel** and **Supabase**.

## 🚀 Key Features

- **Point of Sale (POS)**: Fast barcode/SKU scanning, visual product catalog, cart management, instant discounts, split bills, and thermal receipt printing.
- **Table QR Self-Ordering**: Customers scan dynamic table QR codes on their mobile phones to browse the menu and place live orders.
- **Centralized Cloud Database**: Single Supabase PostgreSQL database accessible from any device - desktop, mobile, tablet.
- **Multi-Device Sync**: Real-time synchronization across all POS terminals, kitchen displays, and customer devices.
- **Vercel Hosted**: High-speed static SPA frontend with serverless deployment.
- **Offline-Resilient**: Automatically caches state locally using `localStorage` and falls back gracefully during network blips.

---

## 🛠️ Quick Setup (Centralized Database)

### 1. Database Setup (Supabase - One-Time Setup)
1. Go to [Supabase Dashboard](https://app.supabase.com) and create a **new project**.
2. Wait for the project to be provisioned (2-3 minutes).
3. Go to **Project Settings** > **API** and copy:
   - `Project URL` (looks like: `https://xxxxx.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)
4. Open the **SQL Editor** in Supabase.
5. Copy and paste the entire contents of `supabase_schema.sql` from this repository.
6. Click **Run** to create all tables and indexes.
7. **Important**: Go to **Database** > **Publications** and ensure `supabase_realtime` includes all tables for real-time sync.

### 2. Environment Configuration (All Devices)
1. Create a `.env` file in the project root (copy from `.env.example`):
```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```
2. Replace the placeholder values with your actual Supabase credentials from Step 1.
3. **Same credentials work on all devices** - desktop POS, mobile tablets, kitchen displays, etc.

### 3. Install & Run (Each Device)
```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Or build for production
npm run build
npm run preview
```

### 4. Deploy to Vercel (Optional - for cloud access)
1. Push this repository to GitHub.
2. Import into [Vercel](https://vercel.com).
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
4. Deploy - now accessible from any device via the Vercel URL.

---

## 🌐 Multi-Device Access

### Option A: Local Network Access
1. Run `npm run dev` on one computer.
2. Note the local IP (e.g., `http://192.168.1.100:3000`).
3. Access from any device on the same WiFi network using that IP.
4. All devices share the same Supabase database in real-time.

### Option B: Cloud Access (Vercel)
1. Deploy to Vercel (see step 4 above).
2. Access from anywhere using the Vercel URL (e.g., `https://yourapp.vercel.app`).
3. Works on any device with internet - no local network required.

---

## 🔄 Real-Time Synchronization

The system uses Supabase's real-time features to sync data across all devices:
- **Orders**: New orders appear instantly on all POS terminals and kitchen displays
- **Products**: Inventory changes sync immediately
- **Held Orders**: Orders held on one device are visible on all devices
- **Settings**: Configuration changes apply to all connected devices

No manual syncing required - everything happens automatically!

---

## 📱 Supported Devices

- **Desktop POS**: Windows, Mac, Linux
- **Tablet POS**: iPad, Android tablets
- **Kitchen Display**: Any device with a web browser
- **Customer QR Ordering**: Any smartphone
- **Admin Panel**: Any device with a web browser

All devices connect to the same centralized Supabase database.

---

## 🔧 Troubleshooting

### Database not syncing?
1. Check your `.env` file has correct Supabase credentials
2. Verify the `supabase_schema.sql` was run successfully
3. Check Supabase Dashboard > Database > Tables exist
4. Ensure Row Level Security policies are set (run the SQL schema again)

### Can't access from other devices?
- **Local network**: Make sure all devices are on the same WiFi
- **Firewall**: Check firewall allows port 3000
- **Cloud**: Deploy to Vercel for universal access

### Changes not appearing in real-time?
1. Go to Supabase Dashboard > Database > Replication
2. Ensure all tables are added to `supabase_realtime` publication
3. Check browser console for connection errors

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start dev server (accessible on local network)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint
```

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Real-time Subscriptions](https://supabase.com/docs/guides/realtime)
