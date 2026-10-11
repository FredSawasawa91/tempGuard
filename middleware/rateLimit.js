// Minimal in-memory rate limiter (no dependencies).
// Usage: rateLimit({ windowMs: 15*60*1000, max: 10 }) -> 429 after max hits.
const hits = new Map();

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: message || 'Too many attempts, please try again later',
      });
    }
    next();
  };
}

// Periodic cleanup so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.start > 60 * 60 * 1000) hits.delete(key);
  }
}, 30 * 60 * 1000).unref();

module.exports = rateLimit;
