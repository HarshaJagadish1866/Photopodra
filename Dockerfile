# ==========================================
# Stage 1: Build Frontend Production Assets
# ==========================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install dependencies for building frontend
RUN npm ci

# Copy frontend source and compile static production bundle
COPY frontend ./frontend
RUN npm run build --workspace=frontend

# ==========================================
# Stage 2: Production Backend Runtime
# ==========================================
FROM node:20-bookworm-slim AS runner

# Install native compilation dependencies for better-sqlite3 and sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev

# Copy backend source code
COPY backend ./backend

# Copy compiled frontend from Stage 1 into the location backend serves from
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistent storage directories
RUN mkdir -p /app/media /app/data /app/thumbnails/256 /app/thumbnails/1024 /app/data/.cache

# Runtime environment configuration
ENV PORT=3001 \
    NODE_ENV=production \
    MEDIA_DIR=/app/media \
    DATA_DIR=/app/data \
    THUMBNAILS_DIR=/app/thumbnails \
    DB_PATH=/app/data/photos.db \
    TRANSFORMERS_CACHE=/app/data/.cache/transformers \
    ALLOWED_ORIGINS=*

# Pre-cache the local CLIP ONNX model so container boots instantly even without internet access
RUN node -e " \
  const { AutoTokenizer, AutoProcessor, CLIPVisionModelWithProjection, CLIPTextModelWithProjection } = require('@xenova/transformers'); \
  const MODEL = 'Xenova/clip-vit-base-patch32'; \
  console.log('[Build] Pre-caching CLIP model: ' + MODEL); \
  Promise.all([ \
    AutoTokenizer.from_pretrained(MODEL), \
    AutoProcessor.from_pretrained(MODEL), \
    CLIPVisionModelWithProjection.from_pretrained(MODEL), \
    CLIPTextModelWithProjection.from_pretrained(MODEL) \
  ]).then(() => { \
    console.log('[Build] CLIP model successfully pre-cached.'); \
    process.exit(0); \
  }).catch((err) => { \
    console.warn('[Build] CLIP pre-caching failed (will download on first run):', err.message); \
    process.exit(0); \
  }); \
"

# Expose backend service port
EXPOSE 3001

# Health check to ensure Express API is healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Persistent volumes for photos, SQLite database, and generated thumbnails
VOLUME ["/app/media", "/app/data", "/app/thumbnails"]

CMD ["node", "backend/src/index.js"]
