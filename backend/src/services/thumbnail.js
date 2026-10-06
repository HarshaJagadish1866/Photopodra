const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { THUMBNAILS_DIR } = require('../config');

/**
 * Generates 256px and 1024px WebP thumbnails for an image.
 * Uses auto-rotation to respect EXIF orientation.
 *
 * @param {string} sourceFilePath - Absolute path to original image
 * @param {string} [identifier] - Optional unique identifier (e.g. file hash or relative path)
 * @returns {Promise<{ thumbnail256: string, thumbnail1024: string }>} - Relative paths to generated thumbnails
 */
async function generateThumbnails(sourceFilePath, identifier) {
  // Generate a stable hash filename from file path / identifier if not provided
  const id = identifier || crypto.createHash('sha256').update(sourceFilePath).digest('hex').substring(0, 16);
  const fileName256 = `${id}_256.webp`;
  const fileName1024 = `${id}_1024.webp`;

  const dir256 = path.join(THUMBNAILS_DIR, '256');
  const dir1024 = path.join(THUMBNAILS_DIR, '1024');

  if (!fs.existsSync(dir256)) fs.mkdirSync(dir256, { recursive: true });
  if (!fs.existsSync(dir1024)) fs.mkdirSync(dir1024, { recursive: true });

  const dest256Path = path.join(dir256, fileName256);
  const dest1024Path = path.join(dir1024, fileName1024);

  // Generate 256px WebP thumbnail (grid preview)
  await sharp(sourceFilePath)
    .rotate() // auto-orient based on EXIF
    .resize(256, 256, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80, effort: 4 })
    .toFile(dest256Path);

  // Generate 1024px WebP thumbnail (lightbox / preview view)
  await sharp(sourceFilePath)
    .rotate() // auto-orient based on EXIF
    .resize(1024, 1024, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 85, effort: 4 })
    .toFile(dest1024Path);

  // Return relative paths from thumbnails root for portable storage
  return {
    thumbnail256: path.relative(THUMBNAILS_DIR, dest256Path),
    thumbnail1024: path.relative(THUMBNAILS_DIR, dest1024Path)
  };
}

module.exports = {
  generateThumbnails
};
