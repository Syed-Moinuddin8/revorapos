# Quick Start - Centralized Multi-Device Database

This is a **5-minute setup** to get your POS system running with a single centralized database accessible from all devices.

---

## ✅ What You're Setting Up

After this setup, you'll have:
- ✅ One cloud database (Supabase) that works across ALL devices
- ✅ Real-time sync between POS terminals, tablets, phones, kitchen displays
- ✅ No need to manually transfer or sync data
- ✅ Access from anywhere with internet

---

## 🚀 Setup Steps (5 minutes)

### 1. Create Supabase Account & Database (2 minutes)

1. Go to: **https://app.supabase.com**
2. Click **"Sign Up"** (use GitHub/Google for faster signup)
3. Click **"New Project"**
4. Fill in:
   - Name: `cafe-pos` (or anything you like)
   - Database Password: **Create a strong password and SAVE IT**
   - Region: Choose closest to your location
5. Click **"Create new project"**
6. Wait 2-3 minutes for setup to complete

### 2. Create Database Tables (1 minute)

1. In Supabase, click **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase_schema.sql` from this project
4. Copy ALL the contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. You should see: "Success. No rows returned"

### 3. Get Your Database Credentials (1 minute)

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (very long string starting with `eyJ...`)

### 4. Configure Your Application (1 minute)

1. In your project folder, find `.env.example`
2. Make a copy and rename it to `.env`
3. Open `.env` and replace with your actual values:

```env
VITE_SUPABASE_URL="https://your-actual-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-actual-anon-key-here"
```

4. Save the file

### 5. Install & Run

```bash
npm install
npm run dev
```

Open browser: `http://localhost:3000`

---

## ✅ Verify It's Working

1. Open the POS application
2. Create a test order
3. Go to your Supabase Dashboard → **Table Editor** → **orders**
4. You should see your test order there!

**That's it!** Your database is now in the cloud and accessible from any device.

---

## 🔄 Connect Additional Devices

### Option A: Same WiFi Network

Perfect for devices in the same café:

1. On your main computer, find your IP address:
   - **Windows**: Run `ipconfig` in Command Prompt, look for IPv4 Address
   - **Mac**: Run `ifconfig` in Terminal, look for inet under en0
   - (Usually looks like: `192.168.1.xxx`)

2. On any other device (tablet, phone, another computer):
   - Connect to the SAME WiFi
   - Open browser
   - Go to: `http://YOUR-IP-ADDRESS:3000`
   - Example: `http://192.168.1.105:3000`

3. Both devices now share the same cloud database!

### Option B: Internet Access (Works Anywhere)

Perfect for remote locations or devices outside your network:

1. **Deploy to Vercel** (FREE):
   - Push your code to GitHub
   - Go to **vercel.com** and sign in with GitHub
   - Click **"Import Project"**
   - Select your repository
   - Add environment variables:
     - `VITE_SUPABASE_URL`: (your Supabase URL)
     - `VITE_SUPABASE_ANON_KEY`: (your Supabase key)
   - Click **"Deploy"**

2. **Access from any device**:
   - Vercel gives you a URL like: `https://your-app.vercel.app`
   - Open this URL on ANY device with internet
   - All devices share the same database!

---

## 🧪 Test Multi-Device Sync

1. Open POS on Device 1
2. Open POS on Device 2 (different device or browser tab)
3. Create an order on Device 1
4. Within 1-2 seconds, it appears on Device 2 automatically!

---

## 🛟 Troubleshooting

### "Can't connect to database"
- Check your `.env` file has correct Supabase URL and key (no extra spaces/quotes)
- Verify internet connection
- Go to Supabase Dashboard and confirm project is active (not paused)

### "Changes not appearing on other devices"
- Hard refresh browsers: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- Check all devices have internet
- Verify all devices are using the same `.env` credentials

### "Can't access from other devices on WiFi"
- Ensure all devices on same WiFi network
- On Windows, allow port 3000 through firewall:
  ```bash
  netsh advfirewall firewall add rule name="Node.js" dir=in action=allow protocol=TCP localport=3000
  ```

### "Supabase says database paused"
- Free tier pauses after 7 days of inactivity
- Go to Supabase Dashboard → click **"Restore"**
- Or upgrade to Pro tier ($25/month) for always-on database

---

## 📚 Additional Help

- **Full Setup Guide**: See `SETUP_GUIDE.md` for detailed instructions
- **Supabase Docs**: https://supabase.com/docs
- **Deployment Guide**: See `README.md` for Vercel deployment

---

## 🎉 You're Done!

Your POS system now has:
- ✅ One centralized cloud database
- ✅ Accessible from unlimited devices
- ✅ Real-time sync across all devices
- ✅ No manual data transfer needed

**Test it**: Create orders on different devices and watch them sync in real-time!
