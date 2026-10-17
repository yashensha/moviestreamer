import React, { useState } from 'react';
import type { MediaItem } from '../types/movie';
import { getPosterUrl } from '../services/tmdb';
import { Play, Star, Film, Tv, Heart } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';

interface SearchResultsProps {
  query: string;
  results: MediaItem[];
  loading: boolean;
  onSelect: (item: MediaItem) => void;
  onClear: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  results,
  loading,
  onSelect,
  onClear,
}) => {
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);

  const filteredResults = results.filter((item) => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-12 pt-28 pb-20 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Search results for <span className="text-rose-500 font-extrabold">"{query}"</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            {loading ? 'Searching titles...' : `Found ${filteredResults.length} matching titles`}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
              filter === 'all'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            All ({results.length})
          </button>
          <button
            onClick={() => setFilter('movie')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
              filter === 'movie'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            <Film className="w-3 h-3" /> Movies
          </button>
          <button
            onClick={() => setFilter('tv')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
              filter === 'tv'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            <Tv className="w-3 h-3" /> Series
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400">Searching titles...</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-base text-zinc-300">
            No matching titles found for <span className="font-semibold text-white">"{query}"</span>.
          </p>
          <p className="text-xs text-zinc-500">
            Try searching with movie or series names, e.g. "Dune", "Stranger Things", "Oppenheimer".
          </p>
          <button
            onClick={onClear}
            className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            Back to Browse
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredResults.map((item) => {
            const poster = getPosterUrl(item.poster_path);
            const year = item.release_date
              ? new Date(item.release_date).getFullYear()
              : '';

            return (
              <div
                key={`${item.media_type}-${item.id}`}
                onClick={() => onSelect(item)}
                className="group relative bg-[#181818] rounded-md overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all duration-300 hover:scale-105 cursor-pointer shadow-lg"
              >
                <div className="relative aspect-[2/3] w-full bg-zinc-900">
                  <img
                    src={poster}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition duration-300 group-hover:brightness-110"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </div>
                  </div>
                  {/* Like button on search card */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(item);
                    }}
                    className={`absolute top-2 left-2 z-20 w-7 h-7 rounded-none flex items-center justify-center transition-all ${
                      isLiked(item.id)
                        ? 'bg-rose-600 text-white'
                        : 'bg-black/60 text-zinc-300 hover:text-white hover:bg-black/90'
                    } backdrop-blur-sm border border-white/20 cursor-pointer`}
                    title={isLiked(item.id) ? 'Liked! Click to unlike' : 'Like title to train recommendations'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isLiked(item.id) ? 'fill-white' : ''}`} />
                  </button>

                  <div className="absolute top-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-semibold text-zinc-300 border border-white/10 uppercase">
                    {item.media_type === 'tv' ? 'TV' : 'Movie'}
                  </div>
                </div>

                <div className="p-3">
                  <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-rose-400 transition-colors">
                    {item.title}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                    <span>{year || '2024'}</span>
                    <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      {item.vote_average ? item.vote_average.toFixed(1) : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
