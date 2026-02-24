// Lightweight in-memory rate limiter for Vercel serverless functions.
// Each warm function instance maintains its own window — resets on cold start.
// This prevents burst abuse without needing a database table.

const stores = new Map();       // key → Map<ip, { count, resetAt }>

/**
 * Check and consume a rate-limit token for a given IP + endpoint key.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 * @param {object}  opts
 * @param {string}  opts.key        - Unique endpoint key (e.g. 'identify')
 * @param {number}  opts.limit      - Max requests per window (default 20)
 * @param {number}  opts.windowMs   - Window size in ms (default 60 000 = 1 min)
 * @returns {boolean} true if the request is allowed, false if rate-limited (429 already sent)
 */
export function rateLimit(req, res, { key = 'default', limit = 20, windowMs = 60_000 } = {}) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!stores.has(key)) stores.set(key, new Map());
  const store = stores.get(key);

  const now = Date.now();
  let entry = store.get(ip);

  // Expired or missing — create fresh window
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(ip, entry);
  }

  entry.count++;

  // Set standard rate-limit headers
  const remaining = Math.max(0, limit - entry.count);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
    return false;
  }

  // Periodically prune expired entries (every 100 requests)
  if (entry.count % 100 === 0) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  return true;
}
