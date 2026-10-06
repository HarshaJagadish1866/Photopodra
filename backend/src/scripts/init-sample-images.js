const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const piexif = require('piexifjs');
const { MEDIA_DIR } = require('../config');
const { processImage } = require('../services/scanner');
const db = require('../db');

function createExifBinary(opts) {
  const zeroth = {};
  const exif = {};
  const gps = {};

  if (opts.make) zeroth[piexif.ImageIFD.Make] = opts.make;
  if (opts.model) zeroth[piexif.ImageIFD.Model] = opts.model;
  if (opts.software) zeroth[piexif.ImageIFD.Software] = opts.software || 'Photopodra Ingest';

  if (opts.dateTaken) {
    const d = new Date(opts.dateTaken);
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${d.getUTCFullYear()}:${pad(d.getUTCMonth() + 1)}:${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    exif[piexif.ExifIFD.DateTimeOriginal] = formatted;
    exif[piexif.ExifIFD.DateTimeDigitized] = formatted;
  }

  if (opts.lensModel) exif[piexif.ExifIFD.LensModel] = opts.lensModel;
  if (opts.focalLength) exif[piexif.ExifIFD.FocalLength] = [Math.round(opts.focalLength * 10), 10];
  if (opts.fNumber) exif[piexif.ExifIFD.FNumber] = [Math.round(opts.fNumber * 10), 10];
  if (opts.iso) exif[piexif.ExifIFD.ISOSpeedRatings] = opts.iso;
  if (opts.exposureTimeSeconds) {
    exif[piexif.ExifIFD.ExposureTime] = [1, Math.round(1 / opts.exposureTimeSeconds)];
  }

  if (opts.latitude !== undefined && opts.longitude !== undefined) {
    const latRef = opts.latitude >= 0 ? 'N' : 'S';
    const absLat = Math.abs(opts.latitude);
    const latDeg = Math.floor(absLat);
    const latMinVal = (absLat - latDeg) * 60;
    const latMin = Math.floor(latMinVal);
    const latSec = Math.round((latMinVal - latMin) * 60 * 100);

    const lonRef = opts.longitude >= 0 ? 'E' : 'W';
    const absLon = Math.abs(opts.longitude);
    const lonDeg = Math.floor(absLon);
    const lonMinVal = (absLon - lonDeg) * 60;
    const lonMin = Math.floor(lonMinVal);
    const lonSec = Math.round((lonMinVal - lonMin) * 60 * 100);

    gps[piexif.GPSIFD.GPSLatitudeRef] = latRef;
    gps[piexif.GPSIFD.GPSLatitude] = [[latDeg, 1], [latMin, 1], [latSec, 100]];
    gps[piexif.GPSIFD.GPSLongitudeRef] = lonRef;
    gps[piexif.GPSIFD.GPSLongitude] = [[lonDeg, 1], [lonMin, 1], [lonSec, 100]];

    if (opts.altitude !== undefined) {
      gps[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(opts.altitude) * 10), 10];
      gps[piexif.GPSIFD.GPSAltitudeRef] = opts.altitude >= 0 ? 0 : 1;
    }
  }

  return piexif.dump({ '0th': zeroth, 'Exif': exif, 'GPS': gps });
}

// 5 Sample Images specifications with rich visuals and authentic EXIF
const SAMPLE_PHOTOS = [
  {
    fileName: 'golden_gate_sunset.jpg',
    title: 'Golden Gate Sunset',
    location: 'San Francisco, USA',
    width: 1920,
    height: 1280,
    svgContent: `
      <svg width="1920" height="1280" viewBox="0 0 1920 1280" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e1035"/>
            <stop offset="30%" stop-color="#792842"/>
            <stop offset="65%" stop-color="#e25822"/>
            <stop offset="100%" stop-color="#ffb834"/>
          </linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ff8c3b"/>
            <stop offset="25%" stop-color="#4a2545"/>
            <stop offset="100%" stop-color="#0b172a"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="850" fill="url(#sky)"/>
        <circle cx="960" cy="720" r="140" fill="#fff5cc" opacity="0.9"/>
        <rect y="850" width="1920" height="430" fill="url(#water)"/>
        <!-- Bridge silhouette -->
        <rect x="580" y="320" width="24" height="600" fill="#c0362c"/>
        <rect x="1320" y="320" width="24" height="600" fill="#c0362c"/>
        <line x1="200" y1="720" x2="1720" y2="720" stroke="#c0362c" stroke-width="14"/>
        <path d="M 200 450 Q 580 720 960 720 Q 1340 720 1720 450" fill="none" stroke="#a0261c" stroke-width="8"/>
        <!-- Text overlay -->
        <text x="960" y="1180" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="4">SAN FRANCISCO • GOLDEN GATE</text>
      </svg>
    `,
    exif: {
      make: 'Sony',
      model: 'ILCE-7RM4',
      lensModel: 'FE 24-70mm F2.8 GM',
      dateTaken: '2025-06-15T19:42:15Z',
      iso: 100,
      fNumber: 4.0,
      focalLength: 35.0,
      exposureTimeSeconds: 0.004, // 1/250s
      latitude: 37.8199,
      longitude: -122.4783,
      altitude: 45.2
    }
  },
  {
    fileName: 'tokyo_tower_night.jpg',
    title: 'Tokyo Tower Cyber City',
    location: 'Tokyo, Japan',
    width: 1440,
    height: 1920,
    svgContent: `
      <svg width="1440" height="1920" viewBox="0 0 1440 1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#050814"/>
            <stop offset="60%" stop-color="#0a122e"/>
            <stop offset="100%" stop-color="#1a1c3d"/>
          </linearGradient>
        </defs>
        <rect width="1440" height="1920" fill="url(#nightSky)"/>
        <!-- Cyber grid skyscrapers -->
        <rect x="80" y="1100" width="240" height="820" fill="#0d1b3a" stroke="#2563eb" stroke-width="2"/>
        <rect x="360" y="1250" width="200" height="670" fill="#09142b" stroke="#3b82f6" stroke-width="2"/>
        <rect x="880" y="1180" width="260" height="740" fill="#0c1733" stroke="#ec4899" stroke-width="2"/>
        <rect x="1180" y="1050" width="200" height="870" fill="#060d1f" stroke="#8b5cf6" stroke-width="2"/>
        <!-- Tokyo Tower Lattice -->
        <polygon points="720,280 620,1650 820,1650" fill="none" stroke="#ff3b30" stroke-width="12"/>
        <line x1="650" y1="900" x2="790" y2="900" stroke="#ff9500" stroke-width="10"/>
        <line x1="630" y1="1300" x2="810" y2="1300" stroke="#ff9500" stroke-width="10"/>
        <circle cx="720" cy="260" r="16" fill="#ff3b30"/>
        <!-- Glowing spire beacon -->
        <line x1="720" y1="120" x2="720" y2="280" stroke="#ffffff" stroke-width="6"/>
        <circle cx="720" cy="120" r="24" fill="#ffffff" opacity="0.9"/>
        <text x="720" y="1820" font-family="system-ui, sans-serif" font-size="38" font-weight="bold" fill="#ff3b30" text-anchor="middle" letter-spacing="6">TOKYO • MINATO NIGHT</text>
      </svg>
    `,
    exif: {
      make: 'Canon',
      model: 'Canon EOS R5',
      lensModel: 'RF 50mm F1.2 L USM',
      dateTaken: '2025-08-20T21:15:30Z',
      iso: 800,
      fNumber: 1.8,
      focalLength: 50.0,
      exposureTimeSeconds: 0.01666, // 1/60s
      latitude: 35.6586,
      longitude: 139.7454,
      altitude: 68.0
    }
  },
  {
    fileName: 'swiss_alps_peak.jpg',
    title: 'Swiss Alps Mountain Summit',
    location: 'Bernese Oberland, Switzerland',
    width: 1920,
    height: 1080,
    svgContent: `
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="alpsSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="50%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#e0f2fe"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#alpsSky)"/>
        <!-- Distant peaks -->
        <polygon points="100,750 480,280 850,750" fill="#94a3b8"/>
        <polygon points="480,280 430,350 480,390 530,340" fill="#ffffff"/>
        <!-- Main Peak -->
        <polygon points="600,850 1150,180 1700,850" fill="#475569"/>
        <polygon points="1150,180 1050,320 1140,360 1200,310 1250,330" fill="#f8fafc"/>
        <!-- Valley & Pine Foregrounds -->
        <polygon points="0,1080 0,720 900,1080" fill="#0f172a"/>
        <polygon points="800,1080 1450,700 1920,950 1920,1080" fill="#1e293b"/>
        <text x="960" y="1020" font-family="system-ui, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="5">SWISS ALPS • JUNGFRAU</text>
      </svg>
    `,
    exif: {
      make: 'Nikon',
      model: 'NIKON Z 7_2',
      lensModel: 'NIKKOR Z 14-30mm f/4 S',
      dateTaken: '2025-09-02T11:08:45Z',
      iso: 64,
      fNumber: 8.0,
      focalLength: 24.0,
      exposureTimeSeconds: 0.002, // 1/500s
      latitude: 46.5590,
      longitude: 7.9854,
      altitude: 3454.0
    }
  },
  {
    fileName: 'eiffel_tower_autumn.jpg',
    title: 'Eiffel Autumn Promenade',
    location: 'Paris, France',
    width: 1440,
    height: 1800,
    svgContent: `
      <svg width="1440" height="1800" viewBox="0 0 1440 1800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="parisSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fef3c7"/>
            <stop offset="40%" stop-color="#fdba74"/>
            <stop offset="100%" stop-color="#fb923c"/>
          </linearGradient>
        </defs>
        <rect width="1440" height="1800" fill="url(#parisSky)"/>
        <!-- Eiffel Tower Silhouette -->
        <polygon points="720,240 540,1400 900,1400" fill="none" stroke="#451a03" stroke-width="14"/>
        <line x1="590" y1="900" x2="850" y2="900" stroke="#78350f" stroke-width="12"/>
        <path d="M 580 1400 Q 720 1200 860 1400" fill="none" stroke="#78350f" stroke-width="16"/>
        <line x1="720" y1="120" x2="720" y2="240" stroke="#451a03" stroke-width="8"/>
        <!-- Autumn Tree Leaves -->
        <circle cx="220" cy="1350" r="260" fill="#b45309" opacity="0.8"/>
        <circle cx="1250" cy="1380" r="280" fill="#dc2626" opacity="0.8"/>
        <rect y="1520" width="1440" height="280" fill="#292524"/>
        <text x="720" y="1720" font-family="system-ui, sans-serif" font-size="38" font-weight="bold" fill="#fef08a" text-anchor="middle" letter-spacing="6">PARIS • CHAMP DE MARS</text>
      </svg>
    `,
    exif: {
      make: 'FUJIFILM',
      model: 'X-T5',
      lensModel: 'XF23mmF1.4 R LM WR',
      dateTaken: '2025-10-12T16:30:10Z',
      iso: 200,
      fNumber: 2.8,
      focalLength: 23.0,
      exposureTimeSeconds: 0.0025, // 1/400s
      latitude: 48.8584,
      longitude: 2.2945,
      altitude: 35.0
    }
  },
  {
    fileName: 'sydney_opera_dawn.jpg',
    title: 'Sydney Harbour Dawn',
    location: 'Sydney, Australia',
    width: 1920,
    height: 1200,
    svgContent: `
      <svg width="1920" height="1200" viewBox="0 0 1920 1200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sydneySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#312e81"/>
            <stop offset="45%" stop-color="#6366f1"/>
            <stop offset="80%" stop-color="#ec4899"/>
            <stop offset="100%" stop-color="#f43f5e"/>
          </linearGradient>
          <linearGradient id="harbour" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e11d48"/>
            <stop offset="35%" stop-color="#4338ca"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="780" fill="url(#sydneySky)"/>
        <rect y="780" width="1920" height="420" fill="url(#harbour)"/>
        <!-- Opera House Shells -->
        <path d="M 680 780 Q 760 520 860 780 Z" fill="#f8fafc"/>
        <path d="M 820 780 Q 940 440 1080 780 Z" fill="#f1f5f9"/>
        <path d="M 1040 780 Q 1180 480 1320 780 Z" fill="#e2e8f0"/>
        <rect x="550" y="775" width="850" height="25" fill="#475569"/>
        <text x="960" y="1120" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="5">SYDNEY • BENNELONG POINT</text>
      </svg>
    `,
    exif: {
      make: 'Apple',
      model: 'iPhone 16 Pro',
      lensModel: 'iPhone 16 Pro back triple camera 24mm f/1.78',
      dateTaken: '2025-11-05T06:12:00Z',
      iso: 50,
      fNumber: 1.8,
      focalLength: 24.0,
      exposureTimeSeconds: 0.00833, // 1/120s
      latitude: -33.8568,
      longitude: 151.2153,
      altitude: 12.0
    }
  },
  {
    fileName: 'kyoto_bamboo_grove.jpg',
    title: 'Kyoto Arashiyama Bamboo Grove',
    location: 'Kyoto, Japan',
    width: 1920,
    height: 1280,
    svgContent: `
      <svg width="1920" height="1280" viewBox="0 0 1920 1280" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bambooSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="60%" stop-color="#047857"/>
            <stop offset="100%" stop-color="#10b981"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1280" fill="url(#bambooSky)"/>
        <!-- Bamboo stalks -->
        <g stroke="#022c22" stroke-width="28" opacity="0.8">
          <line x1="200" y1="0" x2="200" y2="1280"/>
          <line x1="420" y1="0" x2="420" y2="1280"/>
          <line x1="680" y1="0" x2="680" y2="1280"/>
          <line x1="940" y1="0" x2="940" y2="1280"/>
          <line x1="1200" y1="0" x2="1200" y2="1280"/>
          <line x1="1460" y1="0" x2="1460" y2="1280"/>
          <line x1="1720" y1="0" x2="1720" y2="1280"/>
        </g>
        <!-- Bamboo rings -->
        <g fill="#34d399">
          <circle cx="200" cy="350" r="18"/>
          <circle cx="200" cy="750" r="18"/>
          <circle cx="680" cy="400" r="18"/>
          <circle cx="680" cy="820" r="18"/>
          <circle cx="1200" cy="300" r="18"/>
          <circle cx="1200" cy="720" r="18"/>
        </g>
        <text x="960" y="1180" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#ecfdf5" text-anchor="middle" letter-spacing="6">KYOTO • ARASHIYAMA</text>
      </svg>
    `,
    exif: {
      make: 'Sony',
      model: 'ILCE-1 (Alpha 1)',
      lensModel: 'FE 50mm F1.2 GM',
      dateTaken: '2026-10-04T10:15:00Z', // October 4, 2026
      iso: 160,
      fNumber: 1.2,
      focalLength: 50.0,
      exposureTimeSeconds: 0.001, // 1/1000s
      latitude: 35.0164,
      longitude: 135.6713,
      altitude: 80.0
    }
  },
  {
    fileName: 'santorini_blue_domes.jpg',
    title: 'Santorini Caldera Sunset',
    location: 'Oia, Santorini, Greece',
    width: 1920,
    height: 1080,
    svgContent: `
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="aegean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ea580c"/>
            <stop offset="40%" stop-color="#f59e0b"/>
            <stop offset="70%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0c4a6e"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#aegean)"/>
        <!-- White Cliffside Houses -->
        <rect x="200" y="550" width="450" height="400" fill="#f8fafc"/>
        <rect x="700" y="500" width="550" height="450" fill="#ffffff"/>
        <!-- Blue Dome -->
        <path d="M 350 550 A 120 120 0 0 1 590 550 Z" fill="#0284c7"/>
        <path d="M 850 500 A 150 150 0 0 1 1150 500 Z" fill="#0284c7"/>
        <text x="960" y="1020" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="6">SANTORINI • OIA CALDERA</text>
      </svg>
    `,
    exif: {
      make: 'Hasselblad',
      model: 'X2D 100C',
      lensModel: 'XCD 38mm f/2.5 V',
      dateTaken: '2026-10-04T18:40:00Z', // October 4, 2026
      iso: 64,
      fNumber: 5.6,
      focalLength: 38.0,
      exposureTimeSeconds: 0.005, // 1/200s
      latitude: 36.4618,
      longitude: 25.3753,
      altitude: 120.0
    }
  },
  {
    fileName: 'manhattan_golden_hour.jpg',
    title: 'Manhattan Golden Hour',
    location: 'New York City, USA',
    width: 1920,
    height: 1280,
    svgContent: `
      <svg width="1920" height="1280" viewBox="0 0 1920 1280" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="nycSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#431407"/>
            <stop offset="50%" stop-color="#c2410c"/>
            <stop offset="85%" stop-color="#fbbf24"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1280" fill="url(#nycSky)"/>
        <!-- Skylines -->
        <rect x="250" y="450" width="160" height="700" fill="#0f172a"/>
        <rect x="450" y="320" width="180" height="830" fill="#1e293b"/>
        <polygon points="540,150 490,320 590,320" fill="#1e293b"/>
        <rect x="680" y="480" width="220" height="670" fill="#090d16"/>
        <rect x="950" y="380" width="200" height="770" fill="#182234"/>
        <rect x="1200" y="520" width="180" height="630" fill="#0f172a"/>
        <text x="960" y="1200" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="6">NEW YORK • MANHATTAN</text>
      </svg>
    `,
    exif: {
      make: 'Leica',
      model: 'Leica Q3',
      lensModel: 'Summilux 28mm f/1.7 ASPH',
      dateTaken: '2026-09-18T17:50:20Z',
      iso: 100,
      fNumber: 2.8,
      focalLength: 28.0,
      exposureTimeSeconds: 0.003125, // 1/320s
      latitude: 40.7128,
      longitude: -74.0060,
      altitude: 40.0
    }
  },
  {
    fileName: 'aurora_arctic_fjord.jpg',
    title: 'Aurora Borealis Arctic Fjord',
    location: 'Tromso, Norway',
    width: 1920,
    height: 1080,
    svgContent: `
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="auroraSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#020617"/>
            <stop offset="50%" stop-color="#052e16"/>
            <stop offset="80%" stop-color="#14532d"/>
            <stop offset="100%" stop-color="#022c22"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#auroraSky)"/>
        <!-- Green Aurora Ribbon -->
        <path d="M 0 350 Q 450 150 960 400 Q 1470 650 1920 200" fill="none" stroke="#22c55e" stroke-width="120" opacity="0.6"/>
        <path d="M 0 380 Q 480 200 980 430 Q 1480 620 1920 240" fill="none" stroke="#86efac" stroke-width="40" opacity="0.9"/>
        <!-- Dark snowy mountains -->
        <polygon points="0,1080 350,680 850,1080" fill="#0f172a"/>
        <polygon points="750,1080 1250,620 1800,1080" fill="#020617"/>
        <polygon points="1250,620 1200,680 1300,680" fill="#f8fafc"/>
        <text x="960" y="1030" font-family="system-ui, sans-serif" font-size="42" font-weight="bold" fill="#86efac" text-anchor="middle" letter-spacing="6">TROMSO • ARCTIC LIGHTS</text>
      </svg>
    `,
    exif: {
      make: 'Nikon',
      model: 'NIKON Z 8',
      lensModel: 'NIKKOR Z 20mm f/1.8 S',
      dateTaken: '2026-04-12T23:14:00Z',
      iso: 3200,
      fNumber: 1.8,
      focalLength: 20.0,
      exposureTimeSeconds: 4.0, // 4 seconds long exposure
      latitude: 69.6492,
      longitude: 18.9553,
      altitude: 15.0
    }
  }
];

async function initializeSampleImages() {
  console.log('====================================================');
  console.log('📸 Photopodra - Phase 1 Sample Images Initialization');
  console.log('====================================================');

  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const generatedFiles = [];

  for (const sample of SAMPLE_PHOTOS) {
    const targetFilePath = path.join(MEDIA_DIR, sample.fileName);
    console.log(`\nGenerating sample: ${sample.fileName}...`);

    // 1. Render base JPEG from SVG graphic
    const baseJpegBuffer = await sharp(Buffer.from(sample.svgContent))
      .jpeg({ quality: 95 })
      .toBuffer();

    // 2. Insert EXIF binary tags
    const exifBytes = createExifBinary(sample.exif);
    const jpegWithExif = Buffer.from(
      piexif.insert(exifBytes, baseJpegBuffer.toString('binary')),
      'binary'
    );

    // 3. Save to media directory
    fs.writeFileSync(targetFilePath, jpegWithExif);
    console.log(`✅ Saved: ${targetFilePath} (${(jpegWithExif.length / 1024).toFixed(1)} KB)`);

    // 4. Ingest via scanner service (extract EXIF, generate 256/1024 WebP thumbnails, store in SQLite)
    const result = await processImage(targetFilePath, { force: true });
    console.log(`⚡ Ingested: action=${result.action}, DB ID=${result.id}`);
    generatedFiles.push({ sample, result });
  }

  // 5. Query database and display results table
  console.log('\n====================================================');
  console.log('📊 Verified SQLite Database Contents');
  console.log('====================================================');

  const allPhotos = db.getAllPhotos();
  const summaryTable = allPhotos.map(p => ({
    ID: p.id,
    'File Name': p.file_name,
    'Camera Model': `${p.camera_make || ''} ${p.camera_model || ''}`.trim() || 'Unknown',
    'Date Taken': p.date_taken ? p.date_taken.replace('T', ' ').substring(0, 19) : 'N/A',
    GPS: p.latitude !== null && p.longitude !== null ? `${p.latitude}, ${p.longitude}` : 'No GPS',
    Dimensions: `${p.width}x${p.height}`,
    '256 WebP': p.thumbnail_256_path,
    '1024 WebP': p.thumbnail_1024_path
  }));

  console.table(summaryTable);

  const stats = db.getStats();
  console.log('\n📈 Library Stats:');
  console.log(`Total Photos: ${stats.total_photos}`);
  console.log(`Total Size: ${(stats.total_bytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Unique Cameras: ${stats.unique_cameras}`);
  console.log(`Date Range: ${stats.earliest_date} to ${stats.latest_date}`);
  console.log('====================================================\n');

  return { success: true, count: allPhotos.length, photos: allPhotos };
}

if (require.main === module) {
  initializeSampleImages()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal initialization error:', err);
      process.exit(1);
    });
}

module.exports = {
  initializeSampleImages,
  SAMPLE_PHOTOS
};
