import React, { useState, useEffect } from 'react';
import type { MediaItem } from '../types/movie';
import { getBackdropUrl, getLogoUrl, fetchMediaLogo, getCachedLogo } from '../services/tmdb';
import { Play, X } from 'lucide-react';

interface NetflixBackdropCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  className?: string;
  progress?: number;
  badge?: string;
  onRemove?: () => void;
}

export const NetflixBackdropCard: React.FC<NetflixBackdropCardProps> = ({
  item,
  onSelect,
  className = 'w-48 sm:w-56 md:w-64 lg:w-72',
  progress,
  badge,
  onRemove,
}) => {
  const backdrop = getBackdropUrl(item.backdrop_path || item.poster_path, 'w780');

  const initialLogo = item.logo_path || getCachedLogo(item.id, item.media_type);
  const [logoPath, setLogoPath] = useState<string | null>(initialLogo);

  useEffect(() => {
    let isMounted = true;
    const cached = item.logo_path || getCachedLogo(item.id, item.media_type);
    if (cached) {
      setLogoPath(cached);
    } else {
      fetchMediaLogo(item.id, item.media_type).then((path) => {
        if (isMounted && path) {
          setLogoPath(path);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.media_type, item.logo_path]);

  return (
    <div
      onClick={() => onSelect(item)}
      className={`relative flex-shrink-0 group/card cursor-pointer select-none transition-all duration-300 hover:scale-105 hover:z-20 ${className}`}
      title={item.title}
    >
      <div className="relative aspect-[16/9] w-full bg-zinc-900 rounded-[3px] overflow-hidden shadow-lg group-hover/card:shadow-2xl transition-all">
        {/* Backdrop Image */}
        <img
          src={backdrop}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover brightness-[0.92] group-hover/card:brightness-105 transition-all duration-500"
        />

        {/* Center Hover Play Icon Indicator */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl transform group-hover/card:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </div>

        {/* Optional Episode Badge (e.g. S1:E2) */}
        {badge && (
          <div className="absolute top-2 left-2 z-10 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold text-zinc-300 border border-white/10 pointer-events-none">
            {badge}
          </div>
        )}

        {/* Optional Remove from Continue Watching Button */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-black/75 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer border border-white/15"
            title="Remove from Continue Watching"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Title Logo treatment overlaid on cover, with text fallback */}
        {logoPath ? (
          <div className="absolute bottom-2.5 left-3 right-3 max-h-10 flex items-end justify-center pointer-events-none">
            <img
              src={getLogoUrl(logoPath, 'w300') || ''}
              alt={item.title}
              className="max-h-9 max-w-[80%] object-contain mx-auto filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
            />
          </div>
        ) : (
          <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none text-center">
            <span className="text-xs sm:text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] line-clamp-1">
              {item.title}
            </span>
          </div>
        )}

        {/* Netflix Red Progress Bar */}
        {typeof progress === 'number' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/80 z-10 pointer-events-none">
            <div
              className="h-full bg-rose-600 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(12, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
