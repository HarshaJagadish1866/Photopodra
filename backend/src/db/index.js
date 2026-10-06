const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('../config');

// Open SQLite database with WAL mode for performance and concurrent readers
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Register vector cosine similarity function inside SQLite
// Calculates dot product of unit-normalized Float32Array vector blobs in C/V8
db.function('cosine_similarity', { deterministic: true }, (blobA, blobB) => {
  if (!blobA || !blobB) return 0;
  const vecA = new Float32Array(blobA.buffer, blobA.byteOffset, blobA.byteLength / 4);
  const vecB = new Float32Array(blobB.buffer, blobB.byteOffset, blobB.byteLength / 4);
  let dot = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
});

// Initialize schema
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schemaSql);

// Prepared statements for high performance
const statements = {
  getPhotoByPath: db.prepare('SELECT * FROM photos WHERE file_path = ?'),
  getPhotoById: db.prepare('SELECT * FROM photos WHERE id = ?'),
  getAllPhotos: db.prepare('SELECT * FROM photos ORDER BY date_taken DESC, id DESC'),
  getPhotosCount: db.prepare('SELECT COUNT(*) AS total FROM photos'),
  getPhotosPaginatedDesc: db.prepare('SELECT * FROM photos ORDER BY date_taken DESC, id DESC LIMIT ? OFFSET ?'),
  getPhotosPaginatedAsc: db.prepare('SELECT * FROM photos ORDER BY date_taken ASC, id ASC LIMIT ? OFFSET ?'),
  insertPhoto: db.prepare(`
    INSERT INTO photos (
      file_path, file_name, file_size, file_hash, mime_type,
      width, height, thumbnail_256_path, thumbnail_1024_path,
      date_taken, camera_make, camera_model, lens_model,
      focal_length, f_number, iso, exposure_time,
      latitude, longitude, altitude, raw_exif_json, updated_at
    ) VALUES (
      @file_path, @file_name, @file_size, @file_hash, @mime_type,
      @width, @height, @thumbnail_256_path, @thumbnail_1024_path,
      @date_taken, @camera_make, @camera_model, @lens_model,
      @focal_length, @f_number, @iso, @exposure_time,
      @latitude, @longitude, @altitude, @raw_exif_json, datetime('now')
    )
  `),
  updatePhoto: db.prepare(`
    UPDATE photos SET
      file_name = @file_name,
      file_size = @file_size,
      file_hash = @file_hash,
      mime_type = @mime_type,
      width = @width,
      height = @height,
      thumbnail_256_path = @thumbnail_256_path,
      thumbnail_1024_path = @thumbnail_1024_path,
      date_taken = @date_taken,
      camera_make = @camera_make,
      camera_model = @camera_model,
      lens_model = @lens_model,
      focal_length = @focal_length,
      f_number = @f_number,
      iso = @iso,
      exposure_time = @exposure_time,
      latitude = @latitude,
      longitude = @longitude,
      altitude = @altitude,
      raw_exif_json = @raw_exif_json,
      updated_at = datetime('now')
    WHERE file_path = @file_path
  `),
  deletePhotoByPath: db.prepare('DELETE FROM photos WHERE file_path = ?'),
  getStats: db.prepare(`
    SELECT
      COUNT(*) AS total_photos,
      COALESCE(SUM(file_size), 0) AS total_bytes,
      COUNT(DISTINCT camera_model) AS unique_cameras,
      MIN(date_taken) AS earliest_date,
      MAX(date_taken) AS latest_date
    FROM photos
  `),
  // Phase 4: Vector Embedding Prepared Statements
  savePhotoEmbedding: db.prepare(`
    INSERT INTO photo_embeddings (photo_id, model_name, dimensions, embedding_blob, created_at)
    VALUES (@photo_id, @model_name, @dimensions, @embedding_blob, datetime('now'))
    ON CONFLICT(photo_id) DO UPDATE SET
      model_name = excluded.model_name,
      dimensions = excluded.dimensions,
      embedding_blob = excluded.embedding_blob,
      created_at = datetime('now')
  `),
  getPhotoEmbedding: db.prepare('SELECT * FROM photo_embeddings WHERE photo_id = ?'),
  getPhotosWithoutEmbeddings: db.prepare(`
    SELECT p.* FROM photos p
    LEFT JOIN photo_embeddings e ON p.id = e.photo_id
    WHERE e.photo_id IS NULL
  `),
  searchPhotosByVector: db.prepare(`
    SELECT
      p.*,
      ROUND(cosine_similarity(e.embedding_blob, @queryBlob), 4) AS similarity_score
    FROM photos p
    JOIN photo_embeddings e ON p.id = e.photo_id
    WHERE similarity_score >= @minSimilarity
    ORDER BY similarity_score DESC
    LIMIT @limit
  `)
};

function upsertPhoto(photoData) {
  const existing = statements.getPhotoByPath.get(photoData.file_path);
  if (existing) {
    statements.updatePhoto.run(photoData);
    return { action: 'updated', id: existing.id };
  } else {
    const result = statements.insertPhoto.run(photoData);
    return { action: 'inserted', id: result.lastInsertRowid };
  }
}

function getPhotoByPath(filePath) {
  return statements.getPhotoByPath.get(filePath);
}

function getPhotoById(id) {
  return statements.getPhotoById.get(id);
}

function getAllPhotos() {
  return statements.getAllPhotos.all();
}

function getPhotosPaginated({ page = 1, limit = 50, order = 'DESC' } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const total = statements.getPhotosCount.get().total;
  const isAsc = String(order).toUpperCase() === 'ASC';
  const photos = isAsc
    ? statements.getPhotosPaginatedAsc.all(safeLimit, offset)
    : statements.getPhotosPaginatedDesc.all(safeLimit, offset);

  const totalPages = Math.ceil(total / safeLimit) || 1;

  return {
    photos,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1
    }
  };
}

function deletePhotoByPath(filePath) {
  return statements.deletePhotoByPath.run(filePath);
}

function getStats() {
  return statements.getStats.get();
}

// Phase 4 Vector Embeddings DB Functions
function saveEmbedding(photoId, modelName, dimensions, embeddingBlob) {
  return statements.savePhotoEmbedding.run({
    photo_id: photoId,
    model_name: modelName,
    dimensions: dimensions,
    embedding_blob: embeddingBlob
  });
}

function getEmbedding(photoId) {
  return statements.getPhotoEmbedding.get(photoId);
}

function getPhotosWithoutEmbeddings() {
  return statements.getPhotosWithoutEmbeddings.all();
}

function searchByVector(queryBlob, { limit = 20, minSimilarity = 0.15 } = {}) {
  return statements.searchPhotosByVector.all({
    queryBlob,
    limit,
    minSimilarity
  });
}

module.exports = {
  db,
  upsertPhoto,
  getPhotoByPath,
  getPhotoById,
  getAllPhotos,
  getPhotosPaginated,
  deletePhotoByPath,
  getStats,
  saveEmbedding,
  getEmbedding,
  getPhotosWithoutEmbeddings,
  searchByVector
};
