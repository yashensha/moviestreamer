import React from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { Play, Star, Heart, Check, Bookmark } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  isLiked?: boolean;
  onToggleLike?: (e: React.MouseEvent) => void;
  isWatched?: boolean;
  onToggleWatched?: (e: React.MouseEvent) => void;
  isInWatchlist?: boolean;
  onToggleWatchlist?: (e: React.MouseEvent) => void;
  userRating?: number;
  onOpenRatingModal?: (item: MediaItem) => void;
  scoreBadge?: string;
  className?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onSelect,
  isLiked = false,
  onToggleLike,
  isWatched = false,
  onToggleWatched,
  isInWatchlist = false,
  onToggleWatchlist,
  userRating,
  onOpenRatingModal,
  scoreBadge,
  className = 'w-36 sm:w-44 md:w-52',
}) => {
  const poster = getPosterUrl(item.poster_path);
  const year = item.release_date ? new Date(item.release_date).getFullYear() : '';

  return (
    <div
      onClick={() => onSelect(item)}
      className={`relative flex-shrink-0 group/card cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 ${className}`}
    >
      <div className="relative aspect-[2/3] w-full bg-zinc-900 rounded-none overflow-hidden shadow-lg group-hover/card:shadow-2xl border border-zinc-800 group-hover/card:border-zinc-500">
        <img
          src={poster}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover rounded-none transition-transform duration-500 group-hover/card:brightness-110"
        />

        {/* Center Hover Play Button */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-none bg-white text-black flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </div>

        {/* Top-Left Lifecycle Badges */}
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start">
          {isWatched && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm flex items-center gap-1 border border-emerald-400/50">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              <span>Watched</span>
            </span>
          )}
          {isInWatchlist && !isWatched && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-amber-600 text-white px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm flex items-center gap-1 border border-amber-400/50">
              <Bookmark className="w-2.5 h-2.5 fill-white stroke-[2.5]" />
              <span>Watchlist</span>
            </span>
          )}
          {userRating && (
            <span className="text-[9px] font-black bg-[#00E054] text-black px-1.5 py-0.5 rounded-none shadow backdrop-blur-sm flex items-center gap-0.5 border border-[#00E054]">
              <Star className="w-2.5 h-2.5 fill-black" />
              <span>{userRating}★</span>
            </span>
          )}
          {scoreBadge && (
            <span className="text-[9px] font-bold uppercase tracking-wider bg-zinc-900/90 text-emerald-400 px-1.5 py-0.5 rounded-none border border-emerald-500/40 font-mono">
              {scoreBadge}
            </span>
          )}
        </div>

        {/* Top-Right Quick Action Buttons on Hover */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
          {onOpenRatingModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenRatingModal(item);
              }}
              className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                userRating
                  ? 'bg-[#00E054] text-black border-[#00E054] shadow-md shadow-emerald-950/40'
                  : 'bg-black/70 text-zinc-300 hover:text-white hover:bg-black/90'
              } backdrop-blur-sm border border-white/20`}
              title={userRating ? `Rated ${userRating}★. Click to change` : 'Rate with Letterboxd 5-Stars'}
            >
              <Star className={`w-3.5 h-3.5 ${userRating ? 'fill-black' : ''}`} />
            </button>
          )}

          {onToggleWatchlist && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchlist(e);
              }}
              className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                isInWatchlist
                  ? 'bg-amber-600 text-white border-amber-400'
                  : 'bg-black/70 text-zinc-300 hover:text-white hover:bg-black/90'
              } backdrop-blur-sm border border-white/20`}
              title={isInWatchlist ? 'In Watchlist! Click to remove' : 'Add to Watchlist'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isInWatchlist ? 'fill-white stroke-[2.5]' : ''}`} />
            </button>
          )}

          {onToggleWatched && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatched(e);
              }}
              className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                isWatched
                  ? 'bg-emerald-600 text-white border-emerald-400'
                  : 'bg-black/70 text-zinc-300 hover:text-white hover:bg-black/90'
              } backdrop-blur-sm border border-white/20`}
              title={isWatched ? 'Watched! Click to unmark' : 'Mark as watched'}
            >
              <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isWatched ? 'text-white' : ''}`} />
            </button>
          )}

          {onToggleLike && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(e);
              }}
              className={`w-7 h-7 rounded-none flex items-center justify-center transition-all cursor-pointer ${
                isLiked
                  ? 'bg-rose-600 text-white'
                  : 'bg-black/70 text-zinc-300 hover:text-white hover:bg-black/90'
              } backdrop-blur-sm border border-white/20`}
              title={isLiked ? 'Unlike' : 'Like this title'}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-white' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Card Footer */}
      <div className="pt-2 px-0.5">
        <h4
          className="font-bold text-xs md:text-sm text-zinc-200 truncate group-hover/card:text-white"
          title={item.title}
        >
          {item.title}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1 flex-wrap gap-1">
          <span className="flex items-center gap-1 text-amber-400 font-semibold">
            <Star className="w-3 h-3 fill-amber-400" />
            {item.vote_average ? item.vote_average.toFixed(1) : '8.0'}
          </span>
          <span className="uppercase text-[10px] font-semibold text-zinc-500">
            {item.media_type === 'tv' ? 'TV' : 'Movie'}
          </span>
          {year && <span>{year}</span>}
        </div>
      </div>
    </div>
  );
};
