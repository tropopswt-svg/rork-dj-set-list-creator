// API route: GET /api/deezer-preview?artist=X&title=Y
// Server-side proxy for Deezer search to avoid CORS issues on web
import { searchDeezerPreview } from './_lib/deezer-core.js';

// Simple in-memory rate-limit guard (Deezer allows 50 req / 5 seconds)
const requestLog = [];
const WINDOW_MS = 5000;
const MAX_REQUESTS = 50;

function isRateLimited() {
  const now = Date.now();
  // Prune old entries
  while (requestLog.length > 0 && requestLog[0] < now - WINDOW_MS) {
    requestLog.shift();
  }
  return requestLog.length >= MAX_REQUESTS;
}

function recordRequest() {
  requestLog.push(Date.now());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { artist, title } = req.query;

  if (!artist || !title) {
    return res.status(400).json({ error: 'artist and title query params are required' });
  }

  if (isRateLimited()) {
    return res.status(429).json({ error: 'Rate limited — try again shortly' });
  }

  recordRequest();

  try {
    const result = await searchDeezerPreview(artist, title);
    return res.status(200).json({
      success: true,
      previewUrl: result?.previewUrl || null,
      deezerTrackId: result?.deezerTrackId || null,
    });
  } catch (error) {
    console.error('Deezer preview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
