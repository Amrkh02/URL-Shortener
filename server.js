const express = require('express');
const path = require('path');
const { customAlphabet } = require('nanoid');
const cors = require('cors');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);
const RESERVED_ALIASES = new Set(['api', 'info', 'analytics', 'generate', 'resolve', 'favicon.ico']);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || (req.get('authorization') && req.get('authorization').split(' ')[1]);
  if (!ADMIN_TOKEN) return res.status(403).json({ error: 'Admin token not configured' });
  if (!token || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Validate URL helper
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function extractShortId(input) {
  if (!input) return null;
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const u = new URL(input);
      return u.pathname.replace(/^\//, '');
    } catch (_) { return null; }
  }
  return input.replace(/^\//, '');
}

// POST /api/shorten { url, custom }
app.post('/api/shorten', async (req, res) => {
  const { url, custom } = req.body;
  if (!url || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Include http:// or https:// prefix.' });
  }

  // If custom alias provided, validate
  if (custom) {
    if (typeof custom !== 'string' || !/^[A-Za-z0-9\-_]{3,64}$/.test(custom) || RESERVED_ALIASES.has(custom.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid custom alias. Use 3-64 characters: letters, numbers, - or _.' });
    }

    // Check if alias exists
    try {
      const existingAlias = await db.get('SELECT short_id, long_url FROM urls WHERE short_id = ?', [custom]);
      if (existingAlias) {
        if (existingAlias.long_url === url) {
          return res.json({ shortId: existingAlias.short_id, shortUrl: `${BASE_URL}/${existingAlias.short_id}`, longUrl: existingAlias.long_url });
        }
        return res.status(409).json({ error: 'Custom alias already in use' });
      }

      await db.run('INSERT INTO urls (short_id, long_url) VALUES (?, ?)', [custom, url]);
      return res.json({ shortId: custom, shortUrl: `${BASE_URL}/${custom}`, longUrl: url });
    } catch (err) {
      return res.status(500).json({ error: 'Database error while creating custom alias' });
    }
  }

  // If long_url exists, return existing short mapping
  try {
    const existing = await db.get('SELECT short_id, long_url, clicks, created_at FROM urls WHERE long_url = ?', [url]);
    if (existing) {
      return res.json({ shortId: existing.short_id, shortUrl: `${BASE_URL}/${existing.short_id}`, longUrl: existing.long_url, clicks: existing.clicks, createdAt: existing.created_at });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }

  // Insert new entry with generated short id; ensure uniqueness (retry on collision)
  let shortId;
  for (let i = 0; i < 5; i++) {
    shortId = nanoid();
    try {
      await db.run('INSERT INTO urls (short_id, long_url) VALUES (?, ?)', [shortId, url]);
      break;
    } catch (err) {
      if (!err || !/UNIQUE constraint/.test(err.message)) {
        return res.status(500).json({ error: 'Database error while creating short URL.' });
      }
      // otherwise collision — try next
    }
  }

  if (!shortId) return res.status(500).json({ error: 'Could not generate short ID. Try again.' });

  return res.json({ shortId, shortUrl: `${BASE_URL}/${shortId}`, longUrl: url });
});

// GET info for short id
app.get('/api/info/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const row = await db.get('SELECT short_id, long_url, clicks, created_at FROM urls WHERE short_id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Generator endpoint: GET /api/generate
app.get('/api/generate', async (req, res) => {
  try {
    let id;
    for (let i = 0; i < 10; i++) {
      id = nanoid();
      const exists = await db.get('SELECT 1 FROM urls WHERE short_id = ?', [id]);
      if (!exists) return res.json({ shortId: id, shortUrl: `${BASE_URL}/${id}` });
    }
    return res.status(500).json({ error: 'Could not generate unique id' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Resolve (get original without redirect)
app.post('/api/resolve', async (req, res) => {
  const { short } = req.body;
  const id = extractShortId(short);
  if (!id) return res.status(400).json({ error: 'Invalid short id or URL' });
  try {
    const row = await db.get('SELECT short_id, long_url, clicks, created_at FROM urls WHERE short_id = ?', [id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Analytics: GET /api/analytics/:id (protected)
app.get('/api/analytics/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const urlRow = await db.get('SELECT short_id, long_url, clicks, created_at FROM urls WHERE short_id = ?', [id]);
    if (!urlRow) return res.status(404).json({ error: 'Not found' });

    const byCountry = await db.all('SELECT country, COUNT(*) as cnt FROM analytics WHERE short_id = ? GROUP BY country ORDER BY cnt DESC LIMIT 10', [id]);
    const byDevice = await db.all('SELECT device, COUNT(*) as cnt FROM analytics WHERE short_id = ? GROUP BY device ORDER BY cnt DESC', [id]);
    const byReferrer = await db.all('SELECT referrer, COUNT(*) as cnt FROM analytics WHERE short_id = ? AND referrer IS NOT NULL GROUP BY referrer ORDER BY cnt DESC LIMIT 10', [id]);
    const recent = await db.all('SELECT ip, country, device, browser, referrer, created_at FROM analytics WHERE short_id = ? ORDER BY created_at DESC LIMIT 100', [id]);

    res.json({ info: urlRow, byCountry, byDevice, byReferrer, recent });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Redirect endpoint (logs analytics)
app.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const row = await db.get('SELECT long_url, clicks FROM urls WHERE short_id = ?', [id]);
    if (!row) return res.status(404).send('Short URL not found');

    await db.run('UPDATE urls SET clicks = clicks + 1 WHERE short_id = ?', [id]);

    // Log analytics
    try {
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
      const geo = geoip.lookup(ip) || {};
      const ua = req.get('user-agent') || '';
      const parser = new UAParser(ua);
      const device = parser.getDevice().type || 'desktop';
      const browser = parser.getBrowser().name || '';
      const referrer = req.get('referer') || req.get('referrer') || null;

      await db.run('INSERT INTO analytics (short_id, ip, country, user_agent, device, browser, referrer) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, ip, geo.country || null, ua, device, browser, referrer]);
    } catch (err) {
      console.error('Analytics logging failed', err);
    }

    res.redirect(301, row.long_url);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`URL shortener running at ${BASE_URL}`);
  });
}

module.exports = app;
