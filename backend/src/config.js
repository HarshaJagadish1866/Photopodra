const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(ROOT_DIR, 'media');
const THUMBNAILS_DIR = process.env.THUMBNAILS_DIR || path.join(ROOT_DIR, 'thumbnails');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'photos.db');
const PORT = process.env.PORT || 3001;

// Ensure necessary directories exist
[MEDIA_DIR, THUMBNAILS_DIR, path.join(THUMBNAILS_DIR, '256'), path.join(THUMBNAILS_DIR, '1024'), DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = {
  ROOT_DIR,
  MEDIA_DIR,
  THUMBNAILS_DIR,
  DATA_DIR,
  DB_PATH,
  PORT,
  SUPPORTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.avif', '.gif', '.heic', '.heif']
};
