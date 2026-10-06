import React from 'react';
import { Camera, MapPin, ZoomIn, Sparkles } from 'lucide-react';
import LazyImage from './LazyImage';
import { buildMediaUrl } from '../services/serverConfig';

/**
 * Responsive photo thumbnail card within the gallery grid.
 * Displays AI semantic match scores when searching.
 */
export default function PhotoCard({
  photo,
  onClick,
  isLcp = false
}) {
  const matchPercentage = photo.similarity_score !== undefined && photo.similarity_score !== null
    ? Math.round(photo.similarity_score * 100)
    : null;

  return (
    <div
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`View photo ${photo.file_name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 hover:border-slate-500/80 transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl hover:shadow-rose-950/20 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
    >
      {/* 256px WebP Thumbnail with IntersectionObserver Lazy Loading */}
      <LazyImage
        src={buildMediaUrl(photo.id, 'thumb_sm')}
        fallbackSrc={buildMediaUrl(photo.id, 'original')}
        alt={photo.file_name}
        isLcp={isLcp}
        className="group-hover:scale-105"
      />

      {/* Top Floating Badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
        {/* Phase 4: Local AI Semantic Similarity Score Badge */}
        {matchPercentage !== null && (
          <span className="bg-rose-950/85 backdrop-blur-md text-[10px] text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1 border border-rose-500/40 font-semibold shadow-md">
            <Sparkles className="w-2.5 h-2.5 text-rose-400" />
            {matchPercentage}% Match
          </span>
        )}

        {/* GPS Badge */}
        {photo.latitude !== null && photo.longitude !== null && (
          <span className="bg-slate-950/75 backdrop-blur-md text-[10px] text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20 font-medium shadow-sm">
            <MapPin className="w-2.5 h-2.5" />
            GPS
          </span>
        )}
      </div>

      {/* Hover Zoom Indicator */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
        <span className="w-7 h-7 rounded-full bg-slate-950/70 backdrop-blur-md flex items-center justify-center text-white border border-white/10 shadow-lg">
          <ZoomIn className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Bottom Information Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3.5 flex flex-col justify-end pointer-events-none">
        <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
          {photo.file_name}
        </p>
        <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <Camera className="w-3 h-3 text-rose-400 shrink-0" />
            <span className="truncate">{photo.camera_model || 'Unknown Camera'}</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {photo.width}×{photo.height}
          </span>
        </div>
      </div>
    </div>
  );
}
