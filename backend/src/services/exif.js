const sharp = require('sharp');
const exifReader = require('exif-reader');

/**
 * Converts Degrees, Minutes, Seconds (DMS) array to Decimal Degrees (DD).
 * @param {Array<number>|number} dms - [degrees, minutes, seconds] or direct decimal
 * @param {string} ref - Hemisphere reference ('N', 'S', 'E', 'W')
 * @returns {number|null}
 */
function convertDMSToDD(dms, ref) {
  if (dms === undefined || dms === null) return null;

  let dd = 0;
  if (Array.isArray(dms)) {
    const [deg = 0, min = 0, sec = 0] = dms;
    dd = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  } else if (typeof dms === 'number') {
    dd = dms;
  } else {
    return null;
  }

  if (isNaN(dd)) return null;

  const normalizedRef = (ref || '').toUpperCase();
  if (normalizedRef === 'S' || normalizedRef === 'W') {
    dd = -dd;
  }

  return Number(dd.toFixed(6));
}

/**
 * Formats exposure time into human readable shutter speed (e.g. 1/250s).
 * @param {number} seconds
 * @returns {string|null}
 */
function formatExposureTime(seconds) {
  if (!seconds || typeof seconds !== 'number' || seconds <= 0) return null;
  if (seconds >= 1) {
    return `${Number(seconds.toFixed(2))}s`;
  }
  const denominator = Math.round(1 / seconds);
  return `1/${denominator}s`;
}

/**
 * Parses date from EXIF string or Date object into ISO string.
 * EXIF dates often come as "YYYY:MM:DD HH:MM:SS" or ISO Date objects.
 * @param {Date|string} dateVal
 * @returns {string|null}
 */
function parseExifDate(dateVal) {
  if (!dateVal) return null;

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal.toISOString();
  }

  if (typeof dateVal === 'string') {
    // Check if it's already an ISO string
    const directDate = new Date(dateVal);
    if (!isNaN(directDate.getTime()) && dateVal.includes('-')) {
      return directDate.toISOString();
    }

    // Match standard EXIF format "YYYY:MM:DD HH:MM:SS"
    const match = dateVal.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      const isoDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
      }
    }
  }

  return null;
}

/**
 * Extracts metadata and EXIF data from an image file using Sharp and exif-reader.
 * @param {string|Buffer} input - File path or buffer
 * @returns {Promise<Object>}
 */
async function extractMetadata(input) {
  try {
    const sharpInstance = sharp(input);
    const metadata = await sharpInstance.metadata();

    let rawExif = null;
    let cameraMake = null;
    let cameraModel = null;
    let lensModel = null;
    let dateTaken = null;
    let focalLength = null;
    let fNumber = null;
    let iso = null;
    let exposureTime = null;
    let latitude = null;
    let longitude = null;
    let altitude = null;

    if (metadata.exif) {
      try {
        rawExif = exifReader(metadata.exif);

        // Normalize section objects (exif-reader outputs capitalised or lower keys)
        const image = rawExif.Image || rawExif.image || {};
        const photo = rawExif.Photo || rawExif.exif || {};
        const gps = rawExif.GPSInfo || rawExif.gps || {};

        // Camera Info
        cameraMake = (image.Make || '').trim() || null;
        cameraModel = (image.Model || '').trim() || null;
        lensModel = (photo.LensModel || image.LensModel || '').trim() || null;

        // Date Taken (DateTimeOriginal -> CreateDate -> ModifyDate)
        dateTaken = parseExifDate(photo.DateTimeOriginal || photo.CreateDate || image.ModifyDate);

        // Photo settings
        focalLength = typeof photo.FocalLength === 'number' ? Number(photo.FocalLength.toFixed(1)) : null;
        fNumber = typeof photo.FNumber === 'number' ? Number(photo.FNumber.toFixed(1)) : null;
        iso = typeof photo.ISOSpeedRatings === 'number' ? photo.ISOSpeedRatings :
              (typeof photo.PhotographicSensitivity === 'number' ? photo.PhotographicSensitivity :
              (typeof photo.ISO === 'number' ? photo.ISO : null));

        if (typeof photo.ExposureTime === 'number') {
          exposureTime = formatExposureTime(photo.ExposureTime);
        }

        // GPS Coordinates
        if (gps.GPSLatitude !== undefined && gps.GPSLongitude !== undefined) {
          latitude = convertDMSToDD(gps.GPSLatitude, gps.GPSLatitudeRef);
          longitude = convertDMSToDD(gps.GPSLongitude, gps.GPSLongitudeRef);
        }

        if (typeof gps.GPSAltitude === 'number') {
          altitude = Number(gps.GPSAltitude.toFixed(1));
          if (gps.GPSAltitudeRef === 1) {
            altitude = -altitude;
          }
        }
      } catch (exifErr) {
        console.warn(`[EXIF Parser] Warning parsing EXIF header:`, exifErr.message);
      }
    }

    return {
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || null,
      orientation: metadata.orientation || 1,
      cameraMake,
      cameraModel,
      lensModel,
      dateTaken,
      focalLength,
      fNumber,
      iso,
      exposureTime,
      latitude,
      longitude,
      altitude,
      rawExifJson: rawExif ? JSON.stringify(rawExif) : null
    };
  } catch (err) {
    throw new Error(`Failed to extract metadata: ${err.message}`);
  }
}

module.exports = {
  extractMetadata,
  convertDMSToDD,
  formatExposureTime,
  parseExifDate
};
