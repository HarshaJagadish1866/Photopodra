import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Maximize2,
  ExternalLink,
  Sliders,
  Calendar,
  Camera,
  MapPin,
  Sparkles,
  Download,
  Loader2
} from 'lucide-react';
import { buildMediaUrl } from '../services/serverConfig';

/**
 * Fullscreen Lightbox component inspired by Google Photos.
 * Supports thumb_lg (1024px WebP) / original toggle, keyboard navigation,
 * bottom filmstrip scrubbing, and collapsible EXIF metadata sidebar.
 */
export default function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate
}) {
  const [useOriginal, setUseOriginal] = useState(false);
  const [showExifSidebar, setShowExifSidebar] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const backdropRef = useRef(null);

  const currentPhoto = photos[currentIndex];

  // Reset loading state when photo or quality switches
  useEffect(() => {
    setImageLoading(true);
  }, [currentIndex, useOriginal]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate((currentIndex + 1) % photos.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate((currentIndex - 1 + photos.length) % photos.length);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowExifSidebar((prev) => !prev);
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setUseOriginal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, photos.length, onClose, onNavigate]);

  if (!currentPhoto) return null;

  // Stream URL: either 1024px WebP (thumb_lg) or full uncompressed original
  const imageStreamUrl = buildMediaUrl(
    currentPhoto.id,
    useOriginal ? 'original' : 'thumb_lg'
  );

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo viewer: ${currentPhoto.file_name}`}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col md:flex-row animate-in fade-in duration-200 select-none"
    >
      {/* Main Photo Viewer Area */}
      <div className="relative flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Control Bar */}
        <header className="h-14 px-4 flex items-center justify-between bg-black/60 backdrop-blur-md z-30 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close viewer (Esc)"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              <p className="text-sm font-medium text-white truncate drop-shadow-sm">
                {currentPhoto.file_name}
              </p>
              <p className="text-xs text-slate-400">
                {currentIndex + 1} of {photos.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Resolution Toggle: 1024px WebP vs Original */}
            <button
              onClick={() => setUseOriginal(!useOriginal)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                useOriginal
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white border-white/10'
              }`}
              title="Toggle Resolution Quality (O)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{useOriginal ? 'Original (HQ)' : '1024px WebP'}</span>
            </button>

            {/* Direct file download / open in new tab */}
            <a
              href={buildMediaUrl(currentPhoto.id, 'original')}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-full hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Open full-resolution file"
            >
              <Maximize2 className="w-4 h-4" />
            </a>

            {/* EXIF Inspector Toggle */}
            <button
              onClick={() => setShowExifSidebar(!showExifSidebar)}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                showExifSidebar
                  ? 'bg-rose-600/30 text-rose-300'
                  : 'hover:bg-white/15 text-slate-300 hover:text-white'
              }`}
              title="Toggle EXIF Metadata Panel (I)"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Center Canvas with Next / Previous Controls */}
        <div
          className="relative flex-1 flex items-center justify-center p-4 md:p-6 overflow-hidden"
          onClick={(e) => {
            // Light-dismiss: click outside the image closes lightbox
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          {/* Previous Button */}
          <button
            onClick={() => onNavigate((currentIndex - 1 + photos.length) % photos.length)}
            aria-label="Previous image"
            className="absolute left-4 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xl border border-white/15"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Loading Indicator */}
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="p-4 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-3 text-slate-300 text-sm font-medium">
                <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                <span>Streaming {useOriginal ? 'original...' : '1024px WebP...'}</span>
              </div>
            </div>
          )}

          {/* Main Displayed Image */}
          <img
            key={`${currentPhoto.id}-${useOriginal}`}
            src={imageStreamUrl}
            alt={currentPhoto.file_name}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
            }}
            className={`max-h-[calc(100vh-140px)] max-w-[calc(100vw-40px)] md:max-w-full object-contain rounded-xl shadow-2xl transition-opacity duration-300 ${
              imageLoading ? 'opacity-40' : 'opacity-100'
            }`}
          />

          {/* Next Button */}
          <button
            onClick={() => onNavigate((currentIndex + 1) % photos.length)}
            aria-label="Next image"
            className="absolute right-4 z-20 p-3 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xl border border-white/15"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Bottom Thumbnail Filmstrip */}
        <div className="h-18 bg-black/80 backdrop-blur-md border-t border-white/10 px-4 flex items-center gap-2 overflow-x-auto overflow-y-hidden z-20 scrollbar-thin">
          {photos.map((p, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={p.id}
                onClick={() => onNavigate(idx)}
                className={`relative shrink-0 h-12 w-12 rounded-lg overflow-hidden transition-all cursor-pointer ${
                  isActive
                    ? 'ring-2 ring-rose-500 scale-105 opacity-100'
                    : 'opacity-50 hover:opacity-90'
                }`}
              >
                <img
                  src={buildMediaUrl(p.id, 'thumb_sm')}
                  alt={p.file_name}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* EXIF Inspector Sidebar */}
      {showExifSidebar && (
        <aside className="w-full md:w-80 lg:w-96 bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800 p-6 flex flex-col h-auto md:h-full overflow-y-auto backdrop-blur-xl z-30">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <h3 className="font-semibold text-sm tracking-wide uppercase text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              Photo Details & EXIF
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              ID #{currentPhoto.id}
            </span>
          </div>

          <div className="space-y-6 text-sm">
            {/* Date & Time Taken */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                Date & Time Taken
              </label>
              <div className="flex items-center gap-2 text-slate-200">
                <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {currentPhoto.date_taken
                    ? new Date(currentPhoto.date_taken).toLocaleString(undefined, {
                        dateStyle: 'full',
                        timeStyle: 'medium'
                      })
                    : 'Unknown Date'}
                </span>
              </div>
            </div>

            {/* Camera & Lens */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                Camera & Lens
              </label>
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-medium">
                  <Camera className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{currentPhoto.camera_model || currentPhoto.camera_make || 'Generic Camera'}</span>
                </div>
                {currentPhoto.lens_model && (
                  <p className="text-xs text-slate-400 pl-6">{currentPhoto.lens_model}</p>
                )}
              </div>
            </div>

            {/* Exposure Parameters */}
            {(currentPhoto.f_number || currentPhoto.exposure_time || currentPhoto.iso || currentPhoto.focal_length) && (
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  Shot Settings
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
                  {currentPhoto.focal_length && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Focal Length</span>
                      <span className="font-semibold text-slate-200">{currentPhoto.focal_length} mm</span>
                    </div>
                  )}
                  {currentPhoto.f_number && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Aperture</span>
                      <span className="font-semibold text-slate-200">ƒ/{currentPhoto.f_number}</span>
                    </div>
                  )}
                  {currentPhoto.exposure_time && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Shutter Speed</span>
                      <span className="font-semibold text-slate-200">{currentPhoto.exposure_time}</span>
                    </div>
                  )}
                  {currentPhoto.iso && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">ISO</span>
                      <span className="font-semibold text-slate-200">{currentPhoto.iso}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dimensions & Storage */}
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                File Details
              </label>
              <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span className="text-slate-200 font-medium">
                    {currentPhoto.width} × {currentPhoto.height} px
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>File Size:</span>
                  <span className="text-slate-200 font-medium">
                    {(currentPhoto.file_size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>MIME Type:</span>
                  <span className="text-slate-200 font-mono text-[11px]">{currentPhoto.mime_type}</span>
                </div>
              </div>
            </div>

            {/* GPS Location */}
            {currentPhoto.latitude !== null && currentPhoto.longitude !== null && (
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold block mb-1">
                  GPS Location
                </label>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>
                      {currentPhoto.latitude.toFixed(4)}°, {currentPhoto.longitude.toFixed(4)}°
                    </span>
                  </div>
                  {currentPhoto.altitude !== null && (
                    <p className="text-[11px] text-slate-400 pl-6">
                      Altitude: {currentPhoto.altitude} m
                    </p>
                  )}
                  <a
                    href={`https://www.google.com/maps?q=${currentPhoto.latitude},${currentPhoto.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium pl-6 pt-1 transition-colors"
                  >
                    <span>View on Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
