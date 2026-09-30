// Vercel function: GET /api/ranking (top 100), POST /api/ranking?action=start
// (run token), POST /api/ranking (submit). Logic lives in ../lib.js.
import { handle, upstash } from '../lib.js';

export default async function handler(req, res) {
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress || '';
    const result = await handle(
      { method: req.method, query: req.query ?? {}, body: req.body && typeof req.body === 'object' ? req.body : {}, headers: req.headers, ip },
      { run: upstash(process.env), env: process.env },
    );
    res.setHeader('Cache-Control', req.method === 'GET' ? 's-maxage=10, stale-while-revalidate=30' : 'no-store');
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('ranking:', err);
    const message = err instanceof Error && err.message.startsWith('redis not configured') ? err.message : 'server error';
    res.status(500).json({ error: message });
  }
}
