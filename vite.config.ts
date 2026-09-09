import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

const DB_FILE = path.resolve(__dirname, 'server_store.json');

function loadStore() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveStore(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

function expressSyncPlugin(): Plugin {
  return {
    name: 'express-sync-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        let body: any = null;
        if (req.method === 'POST' || req.method === 'PUT') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf8');
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }

        const store = loadStore() || { products: [], categories: [], settings: null, orders: [], heldOrders: [] };

        if (req.url === '/api/sync' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(store));
        }

        if (req.url?.startsWith('/api/products')) {
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(store.products || []));
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            if (Array.isArray(body)) {
              store.products = body;
            } else if (body && body.items) {
              store.products = body.items;
            } else if (body && body.id) {
              const idx = (store.products || []).findIndex((p: any) => p.id === body.id);
              if (idx >= 0) store.products[idx] = body;
              else (store.products = store.products || []).push(body);
            }
            saveStore(store);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, products: store.products }));
          }
        }

        if (req.url?.startsWith('/api/categories')) {
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(store.categories || []));
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            if (Array.isArray(body)) {
              store.categories = body;
            } else if (body && body.items) {
              store.categories = body.items;
            } else if (body && body.id) {
              const idx = (store.categories || []).findIndex((c: any) => c.id === body.id);
              if (idx >= 0) store.categories[idx] = body;
              else (store.categories = store.categories || []).push(body);
            }
            saveStore(store);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, categories: store.categories }));
          }
        }

        if (req.url?.startsWith('/api/settings')) {
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(store.settings || {}));
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            store.settings = body;
            saveStore(store);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, settings: store.settings }));
          }
        }

        if (req.url?.startsWith('/api/orders') || req.url?.startsWith('/api/held-orders')) {
          if (req.method === 'GET') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ orders: store.orders || [], heldOrders: store.heldOrders || [] }));
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            if (body && body.orders) store.orders = body.orders;
            if (body && body.heldOrders) store.heldOrders = body.heldOrders;
            if (body && body.id && !body.orders) {
              if (req.url.includes('held')) {
                const idx = (store.heldOrders || []).findIndex((h: any) => h.id === body.id);
                if (idx >= 0) store.heldOrders[idx] = body;
                else (store.heldOrders = store.heldOrders || []).push(body);
              } else {
                const idx = (store.orders || []).findIndex((o: any) => o.id === body.id);
                if (idx >= 0) store.orders[idx] = body;
                else (store.orders = store.orders || []).push(body);
              }
            }
            saveStore(store);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true, orders: store.orders, heldOrders: store.heldOrders }));
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = process.env;
  
  return {
    plugins: [react(), tailwindcss(), expressSyncPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      // Explicitly define the database URL for the browser
      'import.meta.env.VITE_DATABASE_URL': JSON.stringify(env.VITE_DATABASE_URL || env.DATABASE_URL || ''),
      'import.meta.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL || ''),
    },
    envPrefix: ['VITE_', 'DATABASE_'], // Allow both VITE_ and DATABASE_ prefixes
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 2000,
    },
    server: {
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
