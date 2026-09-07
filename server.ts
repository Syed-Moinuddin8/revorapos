import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_USERS,
  INITIAL_CUSTOMERS,
  INITIAL_SETTINGS,
} from './src/data/initialData';
import { posDb } from './src/server/db';

// Lazy Gemini API Client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

const PORT = Number(process.env.PORT) || 3000;
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const UPLOADS_DIR = path.join(IMAGES_DIR, 'uploads');
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure image and data storage directories exist
[IMAGES_DIR, UPLOADS_DIR, DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Seed SQLite database on initial start if empty
try {
  const dbStatus = posDb.getStatus();
  if (dbStatus.tableCounts.products === 0) {
    console.log('[SQLite] Initializing empty SQLite database with default catalog and settings...');
    posDb.syncAll({
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      users: INITIAL_USERS,
      customers: INITIAL_CUSTOMERS,
      settings: INITIAL_SETTINGS,
      orders: INITIAL_ORDERS,
    });
    console.log('[SQLite] Seeded successfully:', posDb.getStatus().tableCounts);
  } else {
    console.log('[SQLite] Connected. Current status:', dbStatus.fileSizeFormatted, dbStatus.tableCounts);
  }
} catch (err) {
  console.error('[SQLite] Initialization check failed:', err);
}

// Connected SSE clients for real-time notification push
const sseClients: express.Response[] = [];

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

async function startServer() {
  const app = express();

  // Basic middlewares
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Static serving for local images
  app.use('/images', express.static(IMAGES_DIR));

  // CORS for cross-device & preview access
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ================= API ROUTES =================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      sqliteConnected: true,
      timestamp: Date.now(),
    });
  });

  // Real-time Server-Sent Events (SSE) stream
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // ================= LOCAL IMAGE STORAGE ROUTE =================
  // Stores newly uploaded images directly on the local filesystem in the source code
  app.post('/api/upload-image', (req, res) => {
    try {
      const { dataUrl, fileName, folder = 'uploads' } = req.body;
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid dataUrl' });
      }

      // Parse data URL format: data:image/jpeg;base64,...
      const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid base64 image data URL format' });
      }

      let ext = matches[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      if (ext === 'svg+xml') ext = 'svg';

      const buffer = Buffer.from(matches[2], 'base64');
      const targetDir = path.join(IMAGES_DIR, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const safeBaseName = (fileName || 'img')
        .toLowerCase()
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 30);
      const uniqueFileName = `${safeBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const destPath = path.join(targetDir, uniqueFileName);

      fs.writeFileSync(destPath, buffer);
      const localUrl = `/images/${folder}/${uniqueFileName}`;
      console.log(`[Local Image Stored] ${destPath} -> ${localUrl} (${(buffer.length / 1024).toFixed(1)} KB)`);

      return res.json({
        success: true,
        url: localUrl,
        fileName: uniqueFileName,
        fileSizeBytes: buffer.length,
      });
    } catch (err: any) {
      console.error('Error saving uploaded image to local file:', err);
      return res.status(500).json({ error: err.message || 'Image storage failed' });
    }
  });

  // ================= SQLITE DATABASE STATUS & SYNC ROUTES =================

  // Check SQLite database status and table metrics
  app.get('/api/db/status', (req, res) => {
    try {
      const status = posDb.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct download of the SQLite database file
  app.get('/api/db/download-sqlite', (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), 'data', 'pos.sqlite');
      if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: 'pos.sqlite database file not found' });
      }
      res.download(dbPath, 'cafe_pos.sqlite');
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full SQLite database dump / sync-all
  app.get('/api/db/sync-all', (req, res) => {
    try {
      const dump = posDb.exportDump();
      res.json(dump);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/db/sync-all', (req, res) => {
    try {
      posDb.syncAll(req.body);
      broadcastSSE('sqlite_synced', { timestamp: Date.now() });
      res.json({ success: true, status: posDb.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products CRUD in SQLite
  app.get('/api/products', (req, res) => {
    try {
      const products = posDb.getAllProducts();
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', (req, res) => {
    try {
      const product = req.body;
      if (!product || !product.id) {
        return res.status(400).json({ error: 'Invalid product payload' });
      }
      posDb.upsertProduct(product);
      broadcastSSE('products_updated', { product });
      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      posDb.deleteProduct(req.params.id);
      broadcastSSE('products_updated', { deletedId: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Categories CRUD in SQLite
  app.get('/api/categories', (req, res) => {
    try {
      const categories = posDb.getAllCategories();
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const category = req.body;
      if (!category || !category.id) {
        return res.status(400).json({ error: 'Invalid category payload' });
      }
      posDb.upsertCategory(category);
      broadcastSSE('categories_updated', { category });
      res.json({ success: true, category });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      posDb.deleteCategory(req.params.id);
      broadcastSSE('categories_updated', { deletedId: req.params.id });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings in SQLite
  app.get('/api/settings', (req, res) => {
    try {
      const settings = posDb.getSettings();
      res.json(settings || INITIAL_SETTINGS);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const settings = req.body;
      posDb.saveSettings(settings);
      broadcastSSE('settings_updated', { settings });
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // State synchronization across devices and browser sessions backed by SQLite
  app.get('/api/sync', (req, res) => {
    try {
      const orders = posDb.getAllOrders();
      const heldOrders = posDb.getAllHeldOrders();
      res.json({
        orders,
        heldOrders,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CUSTOMER TABLE QR ORDER SUBMISSION
  // Called when a customer scans a table QR code on any device (phone, laptop, etc.)
  app.post('/api/orders/table-qr', (req, res) => {
    try {
      const {
        tableNumber = 'T-01',
        customerName = '',
        customerPhone = '',
        notes = '',
        items = [],
        subtotal = 0,
        taxAmount = 0,
        grandTotal = 0,
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least 1 item' });
      }

      const allOrders = posDb.getAllOrders();
      const orderSeq = allOrders.length + 101;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];
      const orderNumber = `CAF-${now.getFullYear()}-${String(orderSeq).padStart(6, '0')}`;
      const heldId = `hold_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const customerObj = {
        name: customerName.trim() || `Table ${tableNumber} Guest`,
        phone: customerPhone.trim() || '',
      };

      // 1. Create HeldOrder record in queue
      const heldOrder = {
        id: heldId,
        holdNumber: posDb.getAllHeldOrders().length + 1,
        createdAt: Date.now(),
        heldAt: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orderType: 'DINE_IN' as const,
        tableNumber: tableNumber,
        cartItems: items,
        items: items,
        customer: customerObj,
        customerId: undefined,
        customerName: customerObj.name,
        notes: notes || `[Customer QR Table Order] Table ${tableNumber}`,
        discountType: 'PERCENT' as const,
        discountValue: 0,
        discountAmount: 0,
        subtotal: Number(subtotal) || 0,
        taxAmount: Number(taxAmount) || 0,
        grandTotal: Number(grandTotal) || 0,
        source: 'CUSTOMER_QR' as const,
        kitchenStatus: 'PREPARING' as const,
        kitchenStartedAt: Date.now(),
        completedItemIndices: [],
      };

      // 2. Create Order record in live orders list with status 'PENDING_TABLE_QR'
      const newOrder = {
        id: orderId,
        orderNumber,
        date: dateStr,
        time: timeStr,
        timestamp: Date.now(),
        orderType: 'DINE_IN' as const,
        tableNumber: tableNumber,
        items: items.map((ci: any) => ({
          productId: ci.product?.id || ci.productId,
          productName: ci.product?.name || ci.productName || 'Item',
          sku: ci.product?.sku || ci.sku || 'SKU',
          categoryName: ci.product?.categoryId || 'all',
          quantity: ci.quantity,
          unitPrice: ci.unitPrice,
          totalPrice: Number((ci.unitPrice * ci.quantity).toFixed(2)),
          costPrice: ci.product?.costPrice || 0,
          note: ci.note,
          isVeg: ci.product?.isVeg ?? true,
        })),
        itemCount: items.reduce((acc: number, ci: any) => acc + (ci.quantity || 1), 0),
        subtotal: Number(subtotal) || 0,
        discountType: 'PERCENT' as const,
        discountValue: 0,
        discountAmount: 0,
        taxType: 'EXCLUSIVE' as const,
        taxRate: 5,
        taxAmount: Number(taxAmount) || 0,
        grandTotal: Number(grandTotal) || 0,
        paymentMethod: 'PENDING' as const,
        paymentDetails: {
          method: 'OTHER' as const,
        },
        customer: customerObj,
        staff: {
          id: 'u_qr_guest',
          name: `QR Table ${tableNumber}`,
          role: 'STAFF' as const,
        },
        status: 'PENDING_TABLE_QR' as const,
        notes: notes || `[Customer QR Table Order] Table ${tableNumber}`,
        source: 'CUSTOMER_QR' as const,
        heldOrderId: heldId,
      };

      // Persist directly to SQLite database
      posDb.upsertHeldOrder(heldOrder);
      posDb.upsertOrder(newOrder);

      // Real-time broadcast to all connected devices/POS screens
      broadcastSSE('new_table_order', {
        heldOrder,
        order: newOrder,
        tableNumber,
        customerName: customerObj.name,
        grandTotal,
      });

      console.log(`[SQLite Order Saved] ${orderNumber} for Table ${tableNumber} - ${items.length} items`);

      return res.json({
        success: true,
        order: newOrder,
        heldOrder,
        orderNumber,
      });
    } catch (err: any) {
      console.error('Error handling table QR order:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // Complete / update order in SQLite
  app.post('/api/orders', (req, res) => {
    try {
      const order = req.body;
      if (!order || !order.id) {
        return res.status(400).json({ error: 'Invalid order payload' });
      }

      posDb.upsertOrder(order);

      // If this order corresponds to a held order, clear that held order in SQLite
      if (order.heldOrderId) {
        posDb.deleteHeldOrder(order.heldOrderId);
      }

      const orders = posDb.getAllOrders();
      const heldOrders = posDb.getAllHeldOrders();

      broadcastSSE('orders_updated', { orders, heldOrders });
      res.json({ success: true, order });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a single order from SQLite
  app.delete('/api/orders/:id', (req, res) => {
    try {
      const { id } = req.params;
      const deleted = posDb.deleteOrder(id);
      const orders = posDb.getAllOrders();
      broadcastSSE('orders_updated', { orders, deletedId: id });
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk delete orders from SQLite
  app.post('/api/orders/bulk-delete', (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array required' });
      }
      const count = posDb.deleteOrders(ids);
      const orders = posDb.getAllOrders();
      broadcastSSE('orders_updated', { orders, deletedCount: count });
      res.json({ success: true, count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Hold order in SQLite from POS
  app.post('/api/held-orders', (req, res) => {
    try {
      const heldOrder = req.body;
      if (!heldOrder || !heldOrder.id) {
        return res.status(400).json({ error: 'Invalid held order' });
      }

      posDb.upsertHeldOrder(heldOrder);
      const heldOrders = posDb.getAllHeldOrders();

      broadcastSSE('held_orders_updated', { heldOrders });
      res.json({ success: true, heldOrder });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete/recall held order from SQLite
  app.delete('/api/held-orders/:id', (req, res) => {
    try {
      const { id } = req.params;
      posDb.deleteHeldOrder(id);
      const heldOrders = posDb.getAllHeldOrders();

      broadcastSSE('held_orders_updated', { heldOrders });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
