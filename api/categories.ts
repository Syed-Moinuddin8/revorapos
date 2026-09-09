import type { IncomingMessage, ServerResponse } from 'http';

const CLOUD_URL = 'https://kvdb.io/revorapos_cafe_v1/categories';

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method === 'GET') {
    try {
      const response = await fetch(CLOUD_URL);
      if (response.ok) {
        const data = await response.json();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }
    } catch {}
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify([]));
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      await fetch(CLOUD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true }));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
}
