import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

/**
 * LazyImage component using IntersectionObserver for high-performance deferred loading.
 * Provides a skeleton pulse animation and smooth fade-in transition.
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  isLcp = false,
  fallbackSrc,
  aspectRatio = 'square'
}) {
  const [isVisible, setIsVisible] = useState(isLcp);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (isLcp || isVisible) return;

    // Use IntersectionObserver with 200px pre-fetch margin
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px 0px',
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [isLcp, isVisible]);

  return (
    <div
      ref={imgRef}
      className={`relative w-full h-full overflow-hidden bg-slate-900 ${
        aspectRatio === 'square' ? 'aspect-square' : ''
      }`}
    >
      {/* Skeleton Shimmer Loading Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-700">
            <ImageIcon className="w-4 h-4 opacity-40 animate-pulse" />
          </div>
          {/* Subtle gradient shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-800/20 to-transparent" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-600 p-2 text-center">
          <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
          <span className="text-[10px]">Preview unavailable</span>
        </div>
      )}

      {/* Actual Image */}
      {isVisible && !hasError && (
        <img
          src={src}
          alt={alt}
          loading={isLcp ? 'eager' : 'lazy'}
          fetchPriority={isLcp ? 'high' : undefined}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            if (fallbackSrc && src !== fallbackSrc) {
              // Try fallback original source
              src = fallbackSrc;
            } else {
              setHasError(true);
            }
          }}
          className={`${className} w-full h-full object-cover transition-opacity duration-500 ease-out ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}
