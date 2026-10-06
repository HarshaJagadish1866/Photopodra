CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash TEXT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  thumbnail_256_path TEXT,
  thumbnail_1024_path TEXT,
  date_taken TEXT,
  camera_make TEXT,
  camera_model TEXT,
  lens_model TEXT,
  focal_length REAL,
  f_number REAL,
  iso INTEGER,
  exposure_time TEXT,
  latitude REAL,
  longitude REAL,
  altitude REAL,
  raw_exif_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_photos_file_path ON photos(file_path);
CREATE INDEX IF NOT EXISTS idx_photos_date_taken ON photos(date_taken);
CREATE INDEX IF NOT EXISTS idx_photos_camera_model ON photos(camera_model);
CREATE INDEX IF NOT EXISTS idx_photos_coords ON photos(latitude, longitude);

-- Local Vector DB storage for CLIP embeddings (Phase 4: Local AI Search)
CREATE TABLE IF NOT EXISTS photo_embeddings (
  photo_id INTEGER PRIMARY KEY,
  model_name TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  embedding_blob BLOB NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_photo_embeddings_model ON photo_embeddings(model_name);
