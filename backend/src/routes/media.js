const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { THUMBNAILS_DIR } = require('../config');

/**
 * GET /api/media/:id?type=thumb_sm|thumb_lg|original
 * Streams the requested image file from the local filesystem to the client.
 */
router.get('/:id', (req, res) => {
  try {
    const photoId = req.params.id;
    const photo = db.getPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const type = (req.query.type || 'original').toLowerCase();
    let filePath;
    let contentType;
    let isImmutable = false;

    if (type === 'thumb_sm') {
      if (!photo.thumbnail_256_path) {
        return res.status(404).json({ success: false, error: 'Thumbnail (256px) path missing in database' });
      }
      filePath = path.join(THUMBNAILS_DIR, photo.thumbnail_256_path);
      contentType = 'image/webp';
      isImmutable = true;
    } else if (type === 'thumb_lg') {
      if (!photo.thumbnail_1024_path) {
        return res.status(404).json({ success: false, error: 'Thumbnail (1024px) path missing in database' });
      }
      filePath = path.join(THUMBNAILS_DIR, photo.thumbnail_1024_path);
      contentType = 'image/webp';
      isImmutable = true;
    } else if (type === 'original') {
      filePath = photo.file_path;
      contentType = photo.mime_type || 'image/jpeg';
      isImmutable = false;
    } else {
      return res.status(400).json({
        success: false,
        error: `Invalid type '${type}'. Allowed types: 'thumb_sm', 'thumb_lg', 'original'.`
      });
    }

    // Verify file exists on local disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `Media file not found on local disk: ${path.basename(filePath)}`
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (isImmutable) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    // HTTP 206 Partial Content support for streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });

      fileStream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      const fileStream = fs.createReadStream(filePath);

      fileStream.on('error', (streamErr) => {
        console.error(`[Media Streaming] Error streaming file ${filePath}:`, streamErr.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to stream media file' });
        }
      });

      fileStream.pipe(res);
    }
  } catch (err) {
    console.error(`[Media API] Error:`, err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

module.exports = router;
