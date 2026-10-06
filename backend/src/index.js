const app = require('./app');
const { PORT, MEDIA_DIR } = require('./config');
const { scanDirectory, startWatcher } = require('./services/scanner');

const server = app.listen(PORT, async () => {
  console.log(`========================================`);
  console.log(`🚀 Photopodra Backend Server running`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Watching media directory: ${MEDIA_DIR}`);
  console.log(`========================================`);

  // Perform initial directory scan on startup
  try {
    console.log(`[Startup] Running initial scan on ${MEDIA_DIR}...`);
    const results = await scanDirectory(MEDIA_DIR);
    console.log(`[Startup] Initial scan complete: found ${results.totalFound}, processed ${results.processed}, skipped ${results.skipped}`);
  } catch (err) {
    console.error(`[Startup] Initial scan encountered error:`, err.message);
  }

  // Start background file watcher
  const watcher = startWatcher(MEDIA_DIR);

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    await watcher.close();
    server.close(() => {
      console.log('[Server] Closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
