// Reserve a bounded number of raw body buffers before the parser allocates them.
export function createUploadGate({ maxConcurrent = 4, rateLimit, authorize }) {
  let active = 0;
  return (req, res, next) => {
    if (!authorize(req)) return res.status(401).json({ error: 'unauthorized' });
    if (active >= maxConcurrent || !rateLimit(req.ip || req.socket.remoteAddress)) {
      return res.status(429).json({ error: 'upload_limit_exceeded' });
    }
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    res.once('finish', release);
    res.once('close', release);
    req.once('aborted', release);
    req.setTimeout(30_000, () => req.destroy());
    next();
  };
}
