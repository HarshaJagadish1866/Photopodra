# Photopodra 📸

A high-performance, local-first photo gallery application inspired by Google Photos.

**Tech Stack**:
- **Backend**: Node.js (Express), SQLite (`better-sqlite3`), `sharp`, `exif-reader`, `chokidar`, `@xenova/transformers` (local CLIP)
- **Frontend**: React (Vite), Tailwind CSS v4, Lucide Icons, `IntersectionObserver`

---

## Workspace Structure

```
Photopodra/
├── backend/
│   ├── src/
│   │   ├── config.js               # Environment & directory configuration
│   │   ├── app.js                  # Express app, static routes, CORS & search route
│   │   ├── index.js                # Server entry & directory watcher initialization
│   │   ├── db/
│   │   │   ├── schema.sql          # SQLite DDL schema with indexes and vector embeddings table
│   │   │   └── index.js            # better-sqlite3 client, cosine similarity function & prepared statements
│   │   ├── services/
│   │   │   ├── ai.js               # Local CLIP AI model (Xenova/clip-vit-base-patch32)
│   │   │   ├── exif.js             # EXIF reader (Camera, Date Taken, GPS DMS->DD)
│   │   │   ├── thumbnail.js        # Sharp 256px & 1024px WebP generator
│   │   │   └── scanner.js          # Directory scanner, watcher, and embedding generator
│   │   ├── routes/
│   │   │   ├── photos.js           # REST API (/api/photos, /api/photos/stats)
│   │   │   ├── media.js            # Media streaming (/api/media/:id?type=thumb_sm|thumb_lg|original)
│   │   │   ├── search.js           # Local AI semantic search (/api/search?q=...)
│   │   │   └── frontend.js         # Production client bundle server with SPA fallback
│   │   └── scripts/
│   │       └── init-sample-images.js # Sample photos generator with embedded EXIF
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LazyImage.jsx        # IntersectionObserver lazy image with skeleton shimmer
│   │   │   ├── StickyDateHeader.jsx # Google Photos style sticky date header
│   │   │   ├── PhotoCard.jsx        # Grid card with hover overlay & AI match percentage badge
│   │   │   └── Lightbox.jsx         # Fullscreen viewer with thumb_lg/original toggle & filmstrip
│   │   ├── App.jsx                  # Google Photos gallery UI with AI search bar & quick prompt chips
│   │   ├── index.css                # Tailwind CSS v4 design system
│   │   └── main.jsx
│   ├── vite.config.js               # Vite config with Tailwind & backend proxy
│   └── package.json
├── media/                           # Local directory watched for photo ingestion
├── thumbnails/                      # Generated WebP thumbnails (256/ and 1024/)
├── data/                            # SQLite database storage (photos.db)
└── package.json                     # Monorepo root scripts
```

---

## Phase Breakdown

### Phase 1: Ingestion & Metadata
- **Monorepo**: Clean separation of `backend/` and `frontend/` with npm workspaces.
- **Directory Watcher**: `chokidar` service watches `./media` for file additions, modifications, and deletions.
- **Sharp WebP Thumbnails**: Generates `256px` grid thumbnails and `1024px` lightbox previews with automatic EXIF rotation.
- **EXIF Extraction**: Extracts Camera Model, Lens, DateTimeOriginal, and converts DMS GPS coordinates to signed Decimal Degrees with hemisphere checks.
- **SQLite Database**: Stores file paths, thumbnails, timestamps, and full EXIF metadata.

### Phase 2: REST API
- **Frontend Router**: Express router serving the built client bundle with an Express 5 compatible SPA fallback.
- **GET `/api/photos`**: Chronological order by `date_taken DESC, id DESC`, grouped by Year-Month-Day (`YYYY-MM-DD`), with pagination.
- **GET `/api/media/:id?type=thumb_sm|thumb_lg|original`**: Streams image files using Node.js read streams with HTTP 206 Partial Content support.
- **CORS Support**: Configured for Vite development servers and production environments.

### Phase 3: The Google Photos UI
- **Responsive Masonry Grid**: Tailwind CSS fluid grid (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`).
- **Sticky Date Headers**: `sticky top-[61px] z-20` with frosted glass backdrop, displaying dates like `"October 4, 2026"` and weekday tags.
- **IntersectionObserver Optimization**:
  - Image lazy-loading with skeleton pulse shimmers and 200px pre-fetch margins.
  - Infinite scroll sentinel with automatic pagination and smooth feed merging.
- **Fullscreen Lightbox**:
  - Toggle between `1024px WebP` and `Original (HQ)` resolution.
  - Keyboard navigation (`ArrowRight`, `ArrowLeft`, `Escape`, `I`, `O`).
  - Bottom interactive filmstrip carousel.
  - Detailed EXIF sidebar with GPS map links.

### Phase 4: Local AI Semantic Search
- **Zero Cloud Dependencies**: Runs an ONNX quantized **OpenAI CLIP** model (`Xenova/clip-vit-base-patch32`) locally on CPU via `@xenova/transformers`.
- **In-Database Vector Storage**: Normalized 512-dim float vectors stored as binary `BLOB`s in SQLite (`photo_embeddings`).
- **Native Vector Similarity**: Custom user-defined SQLite function `cosine_similarity(blobA, blobB)` calculating vector dot products at C/V8 speeds directly inside queries.
- **GET `/api/search?q=...`**: Text descriptions (e.g. `"sunset over bridge"`, `"green bamboo forest"`, `"snowy alps"`) mapped to visual image embeddings.
- **AI UI Experience**:
  - Search input with dedicated AI search action and loading spinner.
  - One-click Suggested Quick Prompts.
  - Floating `% Match` similarity badges on search results.
  - "Reset to Timeline" action to return to the chronological feed.

### Phase 5: Decoupled Standalone Client & Multi-Platform Support
- **Dynamic Connection Manager (`services/serverConfig.js`)**:
  - Decoupled from hardcoded `localhost` to allow standalone native builds (Capacitor for Android/iOS, Tauri/Electron for Windows/macOS, or remote web hosting).
  - Defaults to `VITE_API_URL` environment variable, falling back to `window.location.origin`.
  - Persists custom endpoints to `localStorage` (`photopodra_server_url`).
  - Helper functions `buildApiUrl(path)` and `buildMediaUrl(id, type)` format dynamic API and media streaming endpoints.
- **Settings Modal & Connection Tester**:
  - Accessible via the gear icon in the top navigation bar.
  - Allows entering custom endpoints (e.g., `https://photos.mydomain.com`, `http://192.168.1.50:3001`, or `http://10.0.2.2:3001` for Android emulators).
  - Includes an interactive **Test Connection** button that measures real-time roundtrip latency (ms) and queries `/api/health`.
  - Quick-preset chips for 1-click configuration.
- **Cross-Origin & Native CORS**:
  - Backend CORS updated in `backend/src/app.js` to allow native origins: `capacitor://localhost`, `http://localhost`, `https://localhost`, `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`, `ionic://localhost`.
  - Permits private network IP ranges (`192.168.*`, `10.*`, `172.16-31.*`) and custom domains via `process.env.ALLOWED_ORIGINS`.

### Phase 6: Native Mobile Apps (CapacitorJS)
- **Capacitor Integration**: Wraps Vite React frontend in native Android (`frontend/android`) and iOS (`frontend/ios`) containers (`com.photopodra.app`).
- **Cleartext Traffic**: Configured in `capacitor.config.json`, `AndroidManifest.xml` (`usesCleartextTraffic="true"`), and `Info.plist` (`NSAllowsArbitraryLoads`) to allow connecting over local network HTTP (e.g. `http://192.168.x.x:3001` or `http://10.0.2.2:3001`).
- **Synchronized Builds**: `npm run build:mobile` bundles the React client into `dist/` and runs `npx cap sync` to propagate all assets to both mobile platforms.

### Phase 7: Native Desktop Applications (Tauri v2)
- **Lightweight Native Core**: Packages the React frontend with Tauri v2 (`frontend/src-tauri`) using native OS WebViews (WebKit on macOS, WebView2 on Windows) without Chromium bloat.
- **Window Specs (`tauri.conf.json`)**:
  - Native window frames with dark mode title bar (`theme: "Dark"`, `decorations: true`).
  - Window constraints: min 900x600, default 1200x800, centered.
  - Bundle Identifier: `com.photopodra.desktop`, Product Name: `Photopodra`.
  - Frontend dist target: `../dist`, dev server: `http://localhost:5173`.
- **Desktop Bundling**:
  - `npm run build:desktop` compiles the production bundle and generates platform installers (`.dmg`/`.app` on macOS, `.msi`/`.exe` on Windows).
  - `npm run dev:desktop` runs live desktop hot-reloading with Vite.

---

## Desktop Build Prerequisites

### macOS Prerequisites
1. **Xcode Command Line Tools**:
   ```bash
   xcode-select --install
   ```
2. **Rust & Cargo** (via `rustup`):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

### Windows Prerequisites
1. **Microsoft Visual Studio C++ Build Tools**:
   - Download the Visual Studio Installer and select the **"Desktop development with C++"** workload.
   - Includes MSVC v143 toolchain and Windows 10/11 SDK.
2. **Microsoft Edge WebView2**:
   - Preinstalled on Windows 10 (version 1803+) and Windows 11.
   - For older installations: install the WebView2 Evergreen Bootstrapper.
3. **Rust & Cargo** (via `rustup`):
   - Download and run `rustup-init.exe` from [rustup.rs](https://rustup.rs/).
   - Choose default option `1) Proceed with standard installation (default - x86_64-pc-windows-msvc)`.

### Phase 8: Central Server Deployment & Remote Access
- **Docker Compose**: Containerized Express backend with native `sharp`, `better-sqlite3`, and pre-cached CLIP ONNX models. Persistent mounts for `./media`, `./data`, and `./thumbnails`.
- **Systemd & Windows PM2**: Background service auto-start configurations (`photopodra.service`, `ecosystem.config.cjs`, `deploy/setup-windows-pm2.bat`).
- **Free Cloudflare Tunnel**: Zero open router ports, free SSL certificates, and custom domain mapping (`https://photos.yourdomain.com`). See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full setup instructions.

---

## API Summary Table

| Endpoint | Method | Params / Query | Description |
|---|---|---|---|
| `/` | `GET` | — | Serves frontend React SPA |
| `/api/health` | `GET` | — | Health check & service discovery (used by connection tester) |
| `/api/photos` | `GET` | `?page=1&limit=20&order=DESC` | Chronological photo feed grouped by `YYYY-MM-DD` with pagination |
| `/api/photos/:id` | `GET` | — | Single photo metadata and EXIF |
| `/api/media/:id` | `GET` | `?type=thumb_sm\|thumb_lg\|original` | Stream image file with HTTP range support |
| `/api/search` | `GET` | `?q=...&limit=20&threshold=0.15` | Local CLIP AI semantic search matching text descriptions to images |
| `/api/stats` | `GET` | — | Library statistics (total photos, storage, cameras, date range) |
| `/api/scan` | `POST` | — | Trigger manual rescan of `./media` |

---

## Quickstart Commands

```bash
# 1. Generate sample photos with embedded EXIF & CLIP vectors
npm run init:samples

# 2. Start Backend API & Watcher (Port 3001)
npm run dev:backend

# 3. Start Vite React Frontend (Port 5173)
npm run dev:frontend

# 4. Build and sync mobile apps (Android & iOS)
npm run build:mobile
npm run cap:android  # Open in Android Studio
npm run cap:ios      # Open in Xcode

# 5. Build Desktop application (macOS DMG / Windows MSI & EXE)
npm run build:desktop

# 6. Develop Desktop app with hot-reload
npm run dev:desktop

# 7. Run permanent central server via Docker Compose
docker compose up -d --build
```



