# Revora Café - POS & Billing System

Modern, cloud-based Point of Sale system for cafés with multi-location support and real-time sync.

## 🎯 Features

- **Multi-Location Sync** - Real-time data sync across all locations
- **Cloud Database** - Neon PostgreSQL (10 GB FREE)
- **Product Management** - Full menu and inventory control
- **Order Management** - Dine-in, Takeaway, Delivery orders
- **Analytics Dashboard** - Sales reports and insights
- **Thermal Printing** - Receipt printing support
- **User Management** - Role-based access control
- **Offline Support** - Works without internet, syncs when back online

## 🚀 Quick Start

### Prerequisites
- Node.js 22+ installed
- Neon PostgreSQL account (free at [neon.tech](https://neon.tech))

### Installation

1. **Clone & Install**
```bash
git clone https://github.com/Syed-Moinuddin8/revorapos.git
cd revorapos
npm install
```

2. **Setup Database**
   - Create account at [neon.tech](https://neon.tech)
   - Create new project
   - Run `neon_schema.sql` in Neon SQL Editor
   - Copy connection string

3. **Configure Environment**
```bash
# Create .env file
cp .env.example .env

# Add your Neon connection string
DATABASE_URL="postgresql://your-connection-string"
VITE_DATABASE_URL="postgresql://your-connection-string"
```

4. **Start Development Server**
```bash
npm run dev
```

Open http://localhost:5173

### Verify Setup
```bash
node verify-neon-connection.js
```

## 📖 Documentation

- **[Neon Setup Guide](NEON_SETUP_GUIDE.md)** - Complete database setup instructions

## 🏗️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Database:** Neon PostgreSQL (Serverless)
- **Build Tool:** Vite
- **State Management:** React Context + localStorage
- **UI Components:** Lucide Icons, Recharts

## 📦 Project Structure

```
revorapos/
├── src/
│   ├── components/     # React components
│   ├── services/       # API and sync services
│   ├── server/         # Database layer
│   ├── data/          # Initial data
│   └── types/         # TypeScript types
├── public/            # Static assets
├── neon_schema.sql    # Database schema
└── neon.ts           # Neon configuration
```

## 🔐 Default Login

**Admin Account:**
- Username: `admin`
- PIN: `1234`

**Staff Account:**
- Username: `staff`
- PIN: `1234`

⚠️ Change these credentials in Settings after first login!

## 🌐 Multi-Location Setup

Your POS is already configured for multi-location use with Neon PostgreSQL:

1. **Same Network:** Access via local IP
   - http://192.168.x.x:5173

2. **Different Locations:** Deploy to Vercel
   - Push to GitHub
   - Import on [vercel.com](https://vercel.com)
   - Add environment variables
   - Deploy!

All locations will share the same database and sync in real-time.

## 📝 License

MIT License - feel free to use for your café!

## 🤝 Support

For issues or questions:
- GitHub Issues: [github.com/Syed-Moinuddin8/revorapos/issues](https://github.com/Syed-Moinuddin8/revorapos/issues)
- Email: smoinuddin283@gmail.com

## 🎉 Credits

Built with ❤️ for Revora Café

---

**Made in India 🇮🇳**
