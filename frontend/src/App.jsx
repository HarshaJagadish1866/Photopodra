import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  RefreshCw, 
  HardDrive, 
  Search, 
  X, 
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Settings
} from 'lucide-react';
import StickyDateHeader from './components/StickyDateHeader';
import PhotoCard from './components/PhotoCard';
import Lightbox from './components/Lightbox';
import SettingsModal from './components/SettingsModal';
import { buildApiUrl } from './services/serverConfig';

/**
 * Normalizes and groups photos by Year-Month-Day (YYYY-MM-DD).
 */
function groupPhotosByDate(photos) {
  const map = {};
  const groups = [];

  for (const photo of photos) {
    let dateKey = 'Undated';
    if (photo.date_taken) {
      try {
        const d = new Date(photo.date_taken);
        if (!isNaN(d.getTime())) {
          const pad = (n) => String(n).padStart(2, '0');
          dateKey = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        }
      } catch {
        dateKey = 'Undated';
      }
    }

    if (!map[dateKey]) {
      map[dateKey] = [];
      groups.push({
        date: dateKey,
        photos: map[dateKey]
      });
    }
    map[dateKey].push(photo);
  }

  for (const g of groups) {
    g.count = g.photos.length;
  }

  return groups;
}

const QUICK_PROMPTS = [
  { label: 'Golden Gate Sunset', query: 'sunset over a bridge in San Francisco' },
  { label: 'Bamboo Forest', query: 'green bamboo forest' },
  { label: 'Snowy Alps', query: 'snowy mountain peak in the alps' },
  { label: 'Tokyo at Night', query: 'tokyo tower at night cyber city' },
  { label: 'Autumn in Paris', query: 'autumn trees in paris eiffel tower' },
  { label: 'Northern Lights', query: 'northern lights aurora in the night sky' },
  { label: 'Santorini Domes', query: 'santorini caldera blue domes' },
  { label: 'Manhattan Skyline', query: 'manhattan skyline during sunset' }
];

export default function App() {
  const [allPhotos, setAllPhotos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [scanning, setScanning] = useState(false);
  
  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAiQuery, setActiveAiQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState(null);

  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const sentinelRef = useRef(null);
  const PAGE_SIZE = 10;

  // Fetch initial batch of photos and stats
  const fetchInitialData = async () => {
    try {
      setLoadingInitial(true);
      setError(null);
      const [photosRes, statsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/photos?page=1&limit=${PAGE_SIZE}`)),
        fetch(buildApiUrl('/api/stats'))
      ]);

      if (!photosRes.ok || !statsRes.ok) {
        throw new Error('Failed to connect to Photopodra backend');
      }

      const photosData = await photosRes.json();
      const statsData = await statsRes.json();

      setAllPhotos(photosData.photos || []);
      setPage(1);
      setHasMore(photosData.pagination ? photosData.pagination.hasNextPage : false);
      setStats(statsData.stats || null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Fetch next page of photos for infinite scrolling
  const loadMorePhotos = useCallback(async () => {
    // Disable pagination during active semantic search
    if (loadingMore || !hasMore || aiSearchResults !== null) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await fetch(buildApiUrl(`/api/photos?page=${nextPage}&limit=${PAGE_SIZE}`));
      if (!res.ok) throw new Error('Failed to load more photos');

      const data = await res.json();
      const newPhotos = data.photos || [];

      setAllPhotos((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueNew = newPhotos.filter((p) => !existingIds.has(p.id));
        return [...prev, ...uniqueNew];
      });

      setPage(nextPage);
      setHasMore(data.pagination ? data.pagination.hasNextPage : false);
    } catch (err) {
      console.error('Failed to load more photos:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, aiSearchResults]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Infinite Scrolling via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loadingMore && !loadingInitial && aiSearchResults === null) {
          loadMorePhotos();
        }
      },
      {
        root: null,
        rootMargin: '300px',
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingInitial, loadMorePhotos, aiSearchResults]);

  // Execute Phase 4 Local AI Semantic Search
  const executeSemanticSearch = async (queryText) => {
    const q = (queryText || searchQuery).trim();
    if (!q) return;

    try {
      setIsAiSearching(true);
      setError(null);
      setActiveAiQuery(q);

      const res = await fetch(buildApiUrl(`/api/search?q=${encodeURIComponent(q)}&limit=20&threshold=0.15`));
      if (!res.ok) {
        throw new Error('Local AI search failed');
      }

      const data = await res.json();
      setAiSearchResults(data.results || []);
    } catch (err) {
      console.error('Semantic search error:', err);
      setError(`AI Search Error: ${err.message}`);
    } finally {
      setIsAiSearching(false);
    }
  };

  // Clear search and return to timeline
  const clearSearch = () => {
    setSearchQuery('');
    setActiveAiQuery('');
    setAiSearchResults(null);
  };

  // Trigger manual rescan of ./media
  const handleRescan = async () => {
    try {
      setScanning(true);
      const res = await fetch(buildApiUrl('/api/scan'), { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchInitialData();
        if (activeAiQuery) {
          await executeSemanticSearch(activeAiQuery);
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setScanning(false);
    }
  };

  // Determine which photos to display:
  // If AI search is active, use aiSearchResults; otherwise filter chronological allPhotos
  const displayedPhotos = aiSearchResults !== null
    ? aiSearchResults
    : allPhotos.filter((photo) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          photo.file_name.toLowerCase().includes(q) ||
          (photo.camera_model && photo.camera_model.toLowerCase().includes(q)) ||
          (photo.camera_make && photo.camera_make.toLowerCase().includes(q)) ||
          (photo.date_taken && photo.date_taken.toLowerCase().includes(q))
        );
      });

  // Group photos by date for Sticky Date Headers
  const groupedPhotos = groupPhotosByDate(displayedPhotos);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 p-0.5 shadow-lg shadow-rose-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Photopodra
              </h1>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-rose-400" />
                Local AI Search
              </span>
            </div>
            <p className="text-xs text-slate-400">Google Photos clone with local CLIP vector search</p>
          </div>
        </div>

        {/* AI Semantic Search Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeSemanticSearch(searchQuery);
          }}
          className="flex-1 max-w-lg relative hidden sm:block"
        >
          <div className="relative flex items-center">
            <Sparkles className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search with local AI (e.g., 'sunset over bridge', 'snowy peak')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-full pl-10 pr-24 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20 transition-all"
            />
            <div className="absolute right-1.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={isAiSearching || !searchQuery.trim()}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white transition-all cursor-pointer shadow-sm shadow-rose-600/30"
              >
                {isAiSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Stats & Scan Action */}
        <div className="flex items-center gap-3">
          {stats && (
            <div className="hidden xl:flex items-center gap-3.5 text-xs text-slate-400 bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-full">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <ImageIcon className="w-3.5 h-3.5 text-rose-400" />
                {stats.total_photos} photos
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                {(stats.total_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                {stats.unique_cameras} cameras
              </span>
            </div>
          )}

          <button
            onClick={handleRescan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-rose-400' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Rescan Media'}</span>
          </button>

          {/* Server Connection Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-all cursor-pointer shadow-sm"
            title="Server Connection Settings"
            aria-label="Server Connection Settings"
          >
            <Settings className="w-4 h-4 text-slate-300 hover:text-rose-400 transition-colors" />
          </button>
        </div>
      </header>

      {/* Suggested Quick Prompts Bar */}
      <div className="bg-slate-950/60 border-b border-slate-900 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
        <span className="text-slate-500 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-rose-400" />
          Try AI Search:
        </span>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setSearchQuery(p.query);
              executeSemanticSearch(p.query);
            }}
            className="shrink-0 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer text-[11px]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Active AI Search Banner */}
      {activeAiQuery && (
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-rose-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">
                  Semantic results for <span className="text-white font-semibold">"{activeAiQuery}"</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {displayedPhotos.length} match{displayedPhotos.length === 1 ? '' : 'es'} ranked by local CLIP vector similarity
                </p>
              </div>
            </div>
            <button
              onClick={clearSearch}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            >
              Reset to Timeline
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchInitialData} className="underline text-red-300 hover:text-white ml-4">
              Retry
            </button>
          </div>
        )}

        {loadingInitial ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
            <p className="text-sm font-medium">Loading Google Photos timeline...</p>
          </div>
        ) : isAiSearching ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-rose-500" />
            <p className="text-sm font-medium">Generating CLIP embedding & ranking vectors in SQLite...</p>
          </div>
        ) : displayedPhotos.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Sparkles className="w-8 h-8 text-rose-400 opacity-60" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-1">No matching photos found</h3>
            <p className="text-sm max-w-sm mx-auto mb-6 text-slate-400">
              {activeAiQuery
                ? `No images matched the description "${activeAiQuery}". Try terms like 'sunset', 'mountain', 'bridge', or 'night'.`
                : 'Your media folder is currently empty.'}
            </p>
            {activeAiQuery ? (
              <button
                onClick={clearSearch}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                View all photos
              </button>
            ) : (
              <button
                onClick={handleRescan}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Scan ./media directory
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Grouped Sections with Google Photos Sticky Date Headers */}
            {groupedPhotos.map((group) => (
              <section key={group.date} className="relative">
                {/* Sticky Date Header: e.g. "October 4, 2026" */}
                <StickyDateHeader
                  dateStr={group.date}
                  count={group.photos.length}
                />

                {/* Responsive Image Grid using Tailwind CSS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 px-2 sm:px-0">
                  {group.photos.map((photo) => {
                    const globalIndex = displayedPhotos.findIndex((p) => p.id === photo.id);
                    const isFirstPhoto = globalIndex === 0;

                    return (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        isLcp={isFirstPhoto}
                        onClick={() => setSelectedPhotoIndex(globalIndex)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}

            {/* Infinite Scroll Sentinel and Status (active in timeline view) */}
            {aiSearchResults === null && (
              <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center text-xs text-slate-500">
                {loadingMore && (
                  <div className="flex items-center gap-2 py-4 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                    <span className="font-medium">Loading more photos...</span>
                  </div>
                )}

                {!hasMore && allPhotos.length > 0 && !searchQuery && (
                  <div className="flex items-center gap-2 text-slate-500 py-6 border-t border-slate-900 w-full justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>You're all caught up • {allPhotos.length} photos indexed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fullscreen Lightbox Component */}
      {selectedPhotoIndex !== null && (
        <Lightbox
          photos={displayedPhotos}
          currentIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
          onNavigate={(newIndex) => setSelectedPhotoIndex(newIndex)}
        />
      )}

      {/* Server Connection Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onServerUrlSaved={() => {
          fetchInitialData();
        }}
      />
    </div>
  );
}
