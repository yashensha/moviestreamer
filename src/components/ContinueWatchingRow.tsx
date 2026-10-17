import React from 'react';
import { useStreamStore } from '../store/useStreamStore';
import { getPosterUrl } from '../services/tmdb';
import { Play, X, Check } from 'lucide-react';
import type { WatchHistoryItem, MediaItem } from '../types/movie';

interface ContinueWatchingRowProps {
  onResume: (item: WatchHistoryItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({ onResume }) => {
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);
  const markAsWatched = useStreamStore((state) => state.markAsWatched);
  const isWatched = useStreamStore((state) => state.isWatched);

  const activeItems = (watchHistory || []).filter((item) => !isWatched(item.id));
  if (!activeItems || activeItems.length === 0) return null;

  const handleMarkAsWatched = (item: WatchHistoryItem) => {
    const mediaItem: MediaItem = {
      id: item.id,
      title: item.title,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      overview: item.overview || '',
      media_type: item.type,
      release_date: item.release_date || '',
      vote_average: item.vote_average ?? 8.0,
      number_of_seasons: item.number_of_seasons,
    };
    markAsWatched(mediaItem);
  };

  return (
    <div className="space-y-3 px-4 md:px-12 my-6">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Continue Watching</span>
          <span className="text-xs text-zinc-500 font-normal">({activeItems.length})</span>
        </h2>
      </div>

      <div
        className="flex items-center gap-3.5 md:gap-4 overflow-x-auto scrollbar-none py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {activeItems.map((item) => {
          const poster = getPosterUrl(item.poster_path);

          return (
            <div
              key={`${item.type}-${item.id}`}
              className="relative flex-shrink-0 w-48 sm:w-56 md:w-64 bg-[#181818] rounded-none overflow-hidden border border-zinc-800 shadow-lg group transition-all duration-200 hover:scale-[1.03]"
            >
              {/* Image Preview with Play Overlay */}
              <div
                onClick={() => onResume(item)}
                className="relative aspect-video w-full bg-zinc-900 cursor-pointer overflow-hidden"
              >
                <img
                  src={poster}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-none bg-white text-black flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>

                {/* Series Episode Badge */}
                {item.type === 'tv' && (
                  <div className="absolute bottom-2 left-2 z-10 bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded-none text-[10px] font-mono text-zinc-300 border border-white/10">
                    <span>S{item.season || 1}:E{item.episode || 1}</span>
                  </div>
                )}

                {/* Quick Actions: Mark as Watched & Remove */}
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsWatched(item);
                    }}
                    className="px-2 py-1 rounded-none bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition shadow cursor-pointer border border-emerald-400/50"
                    title="Mark as Watched & Remove from Continue Watching"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Watched</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.id);
                    }}
                    className="p-1 rounded-none bg-black/70 hover:bg-rose-600 text-zinc-300 hover:text-white transition opacity-0 group-hover:opacity-100 cursor-pointer border border-white/10"
                    title="Remove from Continue Watching"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-3 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={item.title}>
                    {item.title}
                  </h4>
                  <div className="text-[11px] text-zinc-400 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
                    {item.type === 'tv' ? (
                      <span>S{item.season || 1}:E{item.episode || 1}</span>
                    ) : (
                      <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold">Movie</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onResume(item)}
                  className="p-2 rounded-none bg-zinc-800 hover:bg-white hover:text-black text-white transition flex-shrink-0 cursor-pointer"
                  title="Resume Watching"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
