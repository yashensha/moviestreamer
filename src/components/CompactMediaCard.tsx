import React, { useState } from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { Film } from 'lucide-react';

export interface CompactMediaCardProps {
  item: MediaItem;
  role?: string;
  subtitle?: string;
  size?: 'sm' | 'md';
  showRating?: boolean;
  onClick?: (item: MediaItem) => void;
  className?: string;
}

export const CompactMediaCard: React.FC<CompactMediaCardProps> = ({
  item,
  role,
  subtitle,
  size = 'md',
  showRating = false,
  onClick,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const posterPath = item.poster_path || item.backdrop_path;
  const posterUrl = posterPath ? getPosterUrl(posterPath, 'w185') : null;
  const year = item.release_date ? item.release_date.slice(0, 4) : '';
  const displayRole = role || subtitle;

  const isSmall = size === 'sm';

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(item);
    }
  };

  return (
    <div
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.stopPropagation();
          onClick(item);
        }
      }}
      className={`group/card relative bg-black border-0 rounded-none overflow-hidden transition-all duration-200 hover:bg-zinc-900/60 cursor-pointer select-none text-left ${
        isSmall ? 'p-1.5' : 'p-3'
      } ${className}`}
    >
      <div className={`flex items-center ${isSmall ? 'gap-2.5' : 'gap-3'}`}>
        {/* Thumbnail Artwork: Pure black, sharp 0px radius, no border */}
        <div
          className={`relative rounded-none overflow-hidden bg-black flex-shrink-0 border-0 flex items-center justify-center ${
            isSmall ? 'w-10 h-14' : 'w-14 h-20'
          }`}
        >
          {posterUrl && !imageError ? (
            <img
              src={posterUrl}
              alt={item.title}
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover rounded-none transition-transform duration-200 group-hover/card:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-zinc-600">
              <Film className={isSmall ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>
          )}
        </div>

        {/* Title, Year & Specific Role */}
        <div className="min-w-0 flex-1 space-y-0.5">
          {(year || (showRating && item.vote_average > 0)) && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
              {year && <span>{year}</span>}
              {showRating && item.vote_average > 0 && (
                <>
                  {year && <span>•</span>}
                  <span className="text-zinc-400 font-medium">
                    {item.vote_average.toFixed(1)}
                  </span>
                </>
              )}
            </div>
          )}

          <h3
            className={`font-bold text-white group-hover/card:text-zinc-200 transition truncate ${
              isSmall ? 'text-xs' : 'text-sm'
            }`}
          >
            {item.title}
          </h3>

          {displayRole && (
            <p
              className={`text-zinc-400 font-normal truncate ${
                isSmall ? 'text-[11px]' : 'text-xs'
              }`}
              title={displayRole}
            >
              {displayRole}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
