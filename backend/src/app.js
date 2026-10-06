const express = require('express');
const cors = require('cors');
const path = require('path');
const { MEDIA_DIR, THUMBNAILS_DIR } = require('./config');
const photosRouter = require('./routes/photos');
const mediaRouter = require('./routes/media');
const searchRouter = require('./routes/search');
const frontendRouter = require('./routes/frontend');
const db = require('./db');
const { scanDirectory } = require('./services/scanner');

const app = express();

// Comprehensive CORS configuration supporting web, native apps, local network, and custom domains
const nativeOrigins = [
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'ionic://localhost'
];

const envAllowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  // Allow requests with no origin (e.g., native mobile apps, curl, server-to-server)
  if (!origin) return true;

  // Native app schemas
  if (nativeOrigins.includes(origin)) return true;
  if (/^(capacitor|tauri|ionic):\/\//i.test(origin)) return true;

  // Custom configured origins from environment variables
  if (envAllowed.includes(origin) || envAllowed.includes('*')) return true;

  // Localhost and loopback on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;

  // Private local area network IPs (e.g. Android device connecting to PC host on WiFi: 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/i.test(origin)) {
    return true;
  }

  // Allow all in development mode
  if (process.env.NODE_ENV !== 'production') return true;

  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type']
}));

app.use(express.json());

// Serve static thumbnails and original media paths
app.use('/thumbnails', express.static(THUMBNAILS_DIR));
app.use('/media', express.static(MEDIA_DIR));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'photopodra-backend', timestamp: new Date().toISOString() });
});

// Library statistics
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger directory rescan
app.post('/api/scan', async (req, res) => {
  try {
    const results = await scanDirectory(MEDIA_DIR);
    res.json({ success: true, results, stats: db.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Phase 2: Photos API - chronologically ordered, grouped by Year-Month-Day, with pagination
app.use('/api/photos', photosRouter);

// Phase 2: Media streaming API - streams thumb_sm, thumb_lg, or original
app.use('/api/media', mediaRouter);

// Phase 4: Local AI Semantic Search API - text description to image vector similarity
app.use('/api/search', searchRouter);

// Frontend router - serves frontend static build with SPA fallback
app.use(frontendRouter);

module.exports = app;
