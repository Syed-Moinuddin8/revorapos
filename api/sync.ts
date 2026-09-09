import type { IncomingMessage, ServerResponse } from 'http';

const BASE_URL = 'https://kvdb.io/revorapos_cafe_v1';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  try {
    const [ordersRes, heldRes, prodsRes, catsRes, settingsRes] = await Promise.all([
      fetch(`${BASE_URL}/orders`),
      fetch(`${BASE_URL}/held_orders`),
      fetch(`${BASE_URL}/products`),
      fetch(`${BASE_URL}/categories`),
      fetch(`${BASE_URL}/settings`),
    ]);

    const orders = ordersRes.ok ? await ordersRes.json() : [];
    const heldOrders = heldRes.ok ? await heldRes.json() : [];
    const products = prodsRes.ok ? await prodsRes.json() : [];
    const categories = catsRes.ok ? await catsRes.json() : [];
    const settings = settingsRes.ok ? await settingsRes.json() : null;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        orders: Array.isArray(orders) ? orders : [],
        heldOrders: Array.isArray(heldOrders) ? heldOrders : [],
        products: Array.isArray(products) ? products : [],
        categories: Array.isArray(categories) ? categories : [],
        settings: settings || null,
        timestamp: Date.now(),
      })
    );
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: err.message }));
  }
}
