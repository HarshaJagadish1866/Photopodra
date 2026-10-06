const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const { MEDIA_DIR, THUMBNAILS_DIR, SUPPORTED_EXTENSIONS } = require('../config');
const { extractMetadata } = require('./exif');
const { generateThumbnails } = require('./thumbnail');
const { generateImageEmbedding } = require('./ai');
const db = require('../db');

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.heif': 'image/heif'
  };
  return map[ext] || 'application/octet-stream';
}

function computeFileHash(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Ingests a single image: extracts EXIF, creates thumbnails, stores in SQLite,
 * and generates a 512-dim vector embedding for local AI semantic search.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - Force re-processing even if hash matches
 */
async function processImage(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return { skipped: true, reason: 'unsupported_extension' };
  }

  const stat = fs.statSync(filePath);
  const fileHash = computeFileHash(filePath);

  // Check if file is already processed with the exact same hash
  const existing = db.getPhotoByPath(filePath);
  if (existing && existing.file_hash === fileHash && !options.force) {
    // Check if embedding exists
    const hasEmbedding = db.getEmbedding(existing.id);
    if (!hasEmbedding) {
      try {
        const embedding = await generateImageEmbedding(filePath);
        db.saveEmbedding(existing.id, embedding.model, embedding.dimensions, embedding.buffer);
      } catch (embErr) {
        console.warn(`[Scanner] Warning creating missing embedding for ${filePath}:`, embErr.message);
      }
    }
    return { skipped: true, reason: 'already_indexed', id: existing.id };
  }

  // 1. Extract metadata and EXIF
  const meta = await extractMetadata(filePath);

  // 2. Generate 256px and 1024px WebP thumbnails
  const thumbnails = await generateThumbnails(filePath, fileHash.substring(0, 16));

  // 3. Fallback date if EXIF has no date
  const dateTaken = meta.dateTaken || stat.birthtime?.toISOString() || stat.mtime?.toISOString() || new Date().toISOString();

  // 4. Prepare database record
  const photoRecord = {
    file_path: filePath,
    file_name: path.basename(filePath),
    file_size: stat.size,
    file_hash: fileHash,
    mime_type: getMimeType(filePath),
    width: meta.width,
    height: meta.height,
    thumbnail_256_path: thumbnails.thumbnail256,
    thumbnail_1024_path: thumbnails.thumbnail1024,
    date_taken: dateTaken,
    camera_make: meta.cameraMake,
    camera_model: meta.cameraModel,
    lens_model: meta.lensModel,
    focal_length: meta.focalLength,
    f_number: meta.fNumber,
    iso: meta.iso,
    exposure_time: meta.exposureTime,
    latitude: meta.latitude,
    longitude: meta.longitude,
    altitude: meta.altitude,
    raw_exif_json: meta.rawExifJson
  };

  const result = db.upsertPhoto(photoRecord);

  // 5. Generate and store vector embedding for local semantic search (Phase 4)
  try {
    const embedding = await generateImageEmbedding(filePath);
    db.saveEmbedding(result.id, embedding.model, embedding.dimensions, embedding.buffer);
  } catch (aiErr) {
    console.warn(`[Scanner] Warning generating embedding for ${filePath}:`, aiErr.message);
  }

  return {
    success: true,
    action: result.action,
    id: result.id,
    record: photoRecord
  };
}

/**
 * Backfills embeddings for any photos currently stored in SQLite lacking vector embeddings.
 */
async function backfillEmbeddings() {
  const pending = db.getPhotosWithoutEmbeddings();
  if (pending.length === 0) return { processed: 0 };

  console.log(`[AI Backfill] Found ${pending.length} photos without vector embeddings. Generating...`);
  let processed = 0;
  for (const photo of pending) {
    try {
      const embedding = await generateImageEmbedding(photo.file_path);
      db.saveEmbedding(photo.id, embedding.model, embedding.dimensions, embedding.buffer);
      processed++;
    } catch (err) {
      console.error(`[AI Backfill] Error embedding ${photo.file_name}:`, err.message);
    }
  }
  console.log(`[AI Backfill] Completed generating ${processed} vector embeddings.`);
  return { processed };
}

/**
 * Recursively scans directory for photos and processes each.
 * @param {string} [dir=MEDIA_DIR]
 * @returns {Promise<{ totalFound: number, processed: number, skipped: number, errors: Array }>}
 */
async function scanDirectory(dir = MEDIA_DIR) {
  const results = {
    totalFound: 0,
    processed: 0,
    skipped: 0,
    errors: []
  };

  function findFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    let fileList = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        fileList = fileList.concat(findFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }
    return fileList;
  }

  const files = findFiles(dir);
  results.totalFound = files.length;

  for (const file of files) {
    try {
      const res = await processImage(file);
      if (res.skipped) {
        results.skipped++;
      } else {
        results.processed++;
      }
    } catch (err) {
      console.error(`[Scanner] Error processing ${file}:`, err.message);
      results.errors.push({ file, error: err.message });
    }
  }

  // Ensure all photos have vector embeddings
  await backfillEmbeddings();

  return results;
}

/**
 * Starts a Chokidar file watcher on the media directory.
 * Automatically ingests newly added or modified photos and handles deletions.
 * @param {string} [dir=MEDIA_DIR]
 * @param {Object} [callbacks]
 */
function startWatcher(dir = MEDIA_DIR, callbacks = {}) {
  console.log(`[Watcher] Starting watcher on: ${dir}`);

  const watcher = chokidar.watch(dir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 800,
      pollInterval: 100
    }
  });

  watcher
    .on('add', async (filePath) => {
      console.log(`[Watcher] New file detected: ${filePath}`);
      try {
        const res = await processImage(filePath);
        if (callbacks.onAdd) callbacks.onAdd(res);
      } catch (err) {
        console.error(`[Watcher] Failed to process added file ${filePath}:`, err.message);
      }
    })
    .on('change', async (filePath) => {
      console.log(`[Watcher] File modified: ${filePath}`);
      try {
        const res = await processImage(filePath, { force: true });
        if (callbacks.onChange) callbacks.onChange(res);
      } catch (err) {
        console.error(`[Watcher] Failed to process changed file ${filePath}:`, err.message);
      }
    })
    .on('unlink', (filePath) => {
      console.log(`[Watcher] File deleted: ${filePath}`);
      try {
        const photo = db.getPhotoByPath(filePath);
        if (photo) {
          if (photo.thumbnail_256_path) {
            const p256 = path.join(THUMBNAILS_DIR, photo.thumbnail_256_path);
            if (fs.existsSync(p256)) fs.unlinkSync(p256);
          }
          if (photo.thumbnail_1024_path) {
            const p1024 = path.join(THUMBNAILS_DIR, photo.thumbnail_1024_path);
            if (fs.existsSync(p1024)) fs.unlinkSync(p1024);
          }
          db.deletePhotoByPath(filePath);
          console.log(`[Watcher] Cleaned up DB record for deleted file: ${filePath}`);
          if (callbacks.onDelete) callbacks.onDelete({ filePath, photoId: photo.id });
        }
      } catch (err) {
        console.error(`[Watcher] Error handling unlink for ${filePath}:`, err.message);
      }
    })
    .on('error', (err) => console.error(`[Watcher] Watcher error:`, err));

  return watcher;
}

module.exports = {
  processImage,
  scanDirectory,
  startWatcher,
  backfillEmbeddings,
  computeFileHash
};
