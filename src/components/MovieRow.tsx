import React, { useRef } from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { ChevronLeft, ChevronRight, Play, Star, Heart, Check } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';

interface MovieRowProps {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  isTop10?: boolean;
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  items,
  onSelect,
  isTop10 = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2 md:space-y-3 px-4 md:px-12 my-6">
      {/* Row Header */}
      <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight hover:text-rose-400 transition cursor-pointer inline-flex items-center gap-2">
        <span>{title}</span>
        <span className="text-xs text-rose-500 font-semibold opacity-0 group-hover:opacity-100 transition">Explore All &rsaquo;</span>
      </h2>

      {/* Row Container with Navigation Arrows */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-r"
          aria-label="Scroll Left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrolling Items */}
        <div
          ref={rowRef}
          className="flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-none py-4 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, index) => {
            const poster = getPosterUrl(item.poster_path);
            const year = item.release_date
              ? new Date(item.release_date).getFullYear()
              : '';

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => onSelect(item)}
                className={`relative flex-shrink-0 group/card cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 ${
                  isTop10 ? 'w-48 sm:w-56 md:w-64 flex items-end' : 'w-36 sm:w-44 md:w-52'
                }`}
              >
                {/* Large Top 10 Number ranking if enabled */}
                {isTop10 && (
                  <div className="relative z-10 -mr-4 select-none pointer-events-none">
                    <span
                      className="text-7xl sm:text-8xl md:text-9xl font-black leading-none tracking-tighter"
                      style={{
                        WebkitTextStroke: '4px #595959',
                        color: '#141414',
                      }}
                    >
                      {index + 1}
                    </span>
                  </div>
                )}

                {/* Poster Card */}
                <div className="relative w-full aspect-[2/3] rounded-md overflow-hidden bg-zinc-900 border border-zinc-800/80 shadow-lg shadow-black/60">
                  <img
                    src={poster}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/card:brightness-110"
                  />

                  {/* Watched Badge top-left */}
                  {isWatched(item.id) && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-emerald-600/95 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow backdrop-blur-sm border border-emerald-400/50">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      <span>Watched</span>
                    </div>
                  )}

                  {/* Gradient & Hover Information Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 transition">
                        <Play className="w-4 h-4 fill-black ml-0.5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatched(item);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition border cursor-pointer ${
                            isWatched(item.id)
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                              : 'bg-zinc-800/80 text-zinc-300 border-zinc-600 hover:border-emerald-400 hover:text-emerald-400'
                          }`}
                          title={isWatched(item.id) ? 'Watched! Click to unmark' : 'Mark as Watched'}
                        >
                          <Check className={`w-3.5 h-3.5 stroke-[2.5] ${isWatched(item.id) ? 'text-white' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(item);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition border cursor-pointer ${
                            isLiked(item.id)
                              ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                              : 'bg-zinc-800/80 text-zinc-300 border-zinc-600 hover:border-white hover:text-white'
                          }`}
                          title={isLiked(item.id) ? 'Liked! Click to unlike' : 'Like to train recommendations'}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked(item.id) ? 'fill-white text-white' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-1">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-300 font-semibold">
                      <span>{year}</span>
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star className="w-2.5 h-2.5 fill-amber-400" />
                        {item.vote_average ? item.vote_average.toFixed(1) : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5 text-[9px] uppercase font-bold text-zinc-400">
                      <span className="bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-700">
                        {item.media_type === 'tv' ? 'Series' : 'Film'}
                      </span>
                    </div>
                  </div>

                  {/* Top-right subtle badge */}
                  <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-semibold text-zinc-300 border border-white/10 group-hover/card:hidden">
                    {item.media_type === 'tv' ? 'TV' : 'Movie'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-l"
          aria-label="Scroll Right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
