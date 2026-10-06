const express = require('express');
const router = express.Router();
const db = require('../db');
const { scanDirectory } = require('../services/scanner');
const { MEDIA_DIR } = require('../config');

/**
 * Extracts normalized Year-Month-Day (YYYY-MM-DD) from date string or Date object.
 * @param {string|Date} dateVal
 * @returns {string}
 */
function getYearMonthDay(dateVal) {
  if (!dateVal) return 'Undated';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) {
      const match = String(dateVal).match(/^(\d{4})[-:](\d{2})[-:](\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : 'Undated';
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  } catch {
    return 'Undated';
  }
}

/**
 * Groups an array of photos by their Year-Month-Day.
 * Preserves the chronological order of photos in the returned groups array.
 * @param {Array<Object>} photos
 * @returns {{ groups: Array<{ date: string, count: number, photos: Array<Object> }>, groupedByDate: Record<string, Array<Object>> }}
 */
function groupByYearMonthDay(photos) {
  const groupedByDate = {};
  const groups = [];

  for (const photo of photos) {
    const dateKey = getYearMonthDay(photo.date_taken);
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
      groups.push({
        date: dateKey,
        photos: groupedByDate[dateKey]
      });
    }
    groupedByDate[dateKey].push(photo);
  }

  // Attach count for each date group
  for (const group of groups) {
    group.count = group.photos.length;
  }

  return {
    groups,
    groupedByDate
  };
}

/**
 * GET /api/photos
 * Query parameters:
 *  - page: Page number (default: 1)
 *  - limit: Number of photos per page (default: 50, max: 200)
 *  - order: Sort order 'DESC' (default) or 'ASC' by date_taken
 *  - all: If 'true', disables pagination and returns all photos
 */
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 50, order = 'DESC', all } = req.query;

    let photos;
    let paginationInfo;

    if (String(all).toLowerCase() === 'true') {
      photos = db.getAllPhotos();
      paginationInfo = {
        page: 1,
        limit: photos.length,
        total: photos.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      };
    } else {
      const paginatedResult = db.getPhotosPaginated({ page, limit, order });
      photos = paginatedResult.photos;
      paginationInfo = paginatedResult.pagination;
    }

    const { groups, groupedByDate } = groupByYearMonthDay(photos);

    res.json({
      success: true,
      pagination: paginationInfo,
      count: photos.length,
      groups,
      groupedByDate,
      photos
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/photos/stats - Get library statistics
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/photos/:id - Get single photo details
router.get('/:id', (req, res) => {
  try {
    const photo = db.getPhotoById(req.params.id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }
    res.json({ success: true, photo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/photos/scan - Trigger manual directory rescan
router.post('/scan', async (req, res) => {
  try {
    const results = await scanDirectory(MEDIA_DIR);
    res.json({
      success: true,
      results,
      stats: db.getStats()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
