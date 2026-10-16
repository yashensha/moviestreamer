import React from 'react';
import { useStreamStore } from '../store/useStreamStore';
import { getPosterUrl } from '../services/tmdb';
import { Play, X } from 'lucide-react';
import type { WatchHistoryItem } from '../types/movie';

interface ContinueWatchingRowProps {
  onResume: (item: WatchHistoryItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({ onResume }) => {
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);

  if (!watchHistory || watchHistory.length === 0) return null;

  return (
    <div className="space-y-3 px-4 md:px-12 my-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Continue Watching</span>
        
        </h2>
      </div>

      <div
        className="flex items-center gap-3.5 md:gap-4 overflow-x-auto scrollbar-none py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {watchHistory.map((item) => {
          const poster = getPosterUrl(item.poster_path);

          return (
            <div
              key={`${item.type}-${item.id}`}
              className="relative flex-shrink-0 w-44 sm:w-52 md:w-60 bg-[#181818] rounded-md overflow-hidden border border-zinc-800 shadow-lg group transition-all duration-200 hover:scale-105"
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
                  <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(item.id);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/70 hover:bg-rose-600 text-zinc-300 hover:text-white transition opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Remove from Continue Watching"
                >
                  <X className="w-3.5 h-3.5" />
                </button>


              </div>

              {/* Title & Episode info */}
              <div className="p-3 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">
                    {item.type === 'tv'
                      ? `S${item.season || 1}:E${item.episode || 1} • Next Episode`
                      : 'Resume Movie'}
                  </p>
                </div>

                <button
                  onClick={() => onResume(item)}
                  className="p-2 rounded-full bg-zinc-800 hover:bg-white hover:text-black text-white transition flex-shrink-0 cursor-pointer"
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
