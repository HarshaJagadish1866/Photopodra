const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateTextEmbedding } = require('../services/ai');

/**
 * GET /api/search?q=...&limit=20&threshold=0.15
 * Local AI semantic search powered by local CLIP model.
 * Matches natural language descriptions against image vector embeddings.
 */
router.get('/', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required (e.g. /api/search?q=sunset+over+bridge)'
      });
    }

    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const threshold = parseFloat(req.query.threshold) || 0.15;

    // 1. Generate text embedding vector using local CLIP
    const textEmbedding = await generateTextEmbedding(query);

    // 2. Query SQLite using native cosine similarity function
    const results = db.searchByVector(textEmbedding.buffer, {
      limit,
      minSimilarity: threshold
    });

    res.json({
      success: true,
      query,
      count: results.length,
      threshold,
      model: textEmbedding.model,
      results
    });
  } catch (err) {
    console.error('[Search API] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
