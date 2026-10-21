/** Small in-memory limiter for the planning route. No extra dependency. */
export function createRateLimit({ windowMs, max, now = Date.now }) {
  const hits = new Map();
  return function rateLimit(req, res, next) {
    const key = req.ip || 'unknown';
    const time = now();
    const recent = (hits.get(key) ?? []).filter((stamp) => time - stamp < windowMs);
    if (recent.length >= max) {
      res.status(429).json({
        error: 'Too many planning requests. Please wait and try again.',
        code: 'rate_limited',
      });
      return;
    }
    recent.push(time);
    hits.set(key, recent);
    next();
  };
}
