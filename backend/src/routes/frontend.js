const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const FRONTEND_DIST_DIR = path.resolve(__dirname, '../../../frontend/dist');
const FRONTEND_INDEX_HTML = path.join(FRONTEND_DIST_DIR, 'index.html');

/**
 * Express router to serve the frontend application.
 * In production (when frontend/dist exists), serves static files and provides SPA fallback.
 * In development, provides a fallback informative interface.
 */
if (fs.existsSync(FRONTEND_DIST_DIR) && fs.existsSync(FRONTEND_INDEX_HTML)) {
  console.log(`[Frontend Router] Serving static production bundle from: ${FRONTEND_DIST_DIR}`);

  // Serve static assets from frontend/dist
  router.use(express.static(FRONTEND_DIST_DIR, { index: false }));

  // SPA fallback for HTML5 History API (Express 5 compatible handler)
  router.use((req, res, next) => {
    // Only handle GET requests and skip API or media routes
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/thumbnails') || req.path.startsWith('/media')) {
      return next();
    }
    res.sendFile(FRONTEND_INDEX_HTML);
  });
} else {
  // Informational fallback when frontend hasn't been built yet
  router.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/thumbnails') || req.path.startsWith('/media')) {
      return next();
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Photopodra - Local-first Photo Gallery</title>
        <style>
          body { background: #020617; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #0f172a; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 520px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
          h1 { margin-top: 0; font-size: 1.75rem; background: linear-gradient(to right, #fb7185, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }
          .code { background: #1e293b; color: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-family: monospace; font-size: 0.85rem; }
          .btn { display: inline-block; margin-top: 1.25rem; background: #e11d48; color: white; padding: 0.65rem 1.25rem; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 0.85rem; transition: background 0.2s; }
          .btn:hover { background: #f43f5e; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Photopodra Server</h1>
          <p>The backend REST API is running. In development mode, the Vite React frontend is served independently.</p>
          <p>Open <a href="http://localhost:5173" style="color: #38bdf8;">http://localhost:5173</a> or run <span class="code">npm run dev:frontend</span>.</p>
          <p style="font-size: 0.85rem; margin-top: 1rem;">To serve the frontend directly through Express, build it with <span class="code">npm run build</span> in <span class="code">frontend/</span>.</p>
          <a class="btn" href="/api/photos">View /api/photos JSON</a>
        </div>
      </body>
      </html>
    `);
  });
}

module.exports = router;
