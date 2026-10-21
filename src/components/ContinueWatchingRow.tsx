import React, { useRef } from 'react';
import { useStreamStore } from '../store/useStreamStore';
import { NetflixTallCard } from './NetflixTallCard';
import { getSavedPlaybackTime } from '../services/playbackStorage';
import type { MediaItem } from '../types/movie';

interface ContinueWatchingRowProps {
  onSelect: (item: MediaItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({ onSelect }) => {
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const removeFromHistory = useStreamStore((state) => state.removeFromHistory);
  const isWatched = useStreamStore((state) => state.isWatched);
  const dismissedHistoryIds = useStreamStore((state) => state.dismissedHistoryIds) || [];
  const rowRef = useRef<HTMLDivElement>(null);

  const dismissedSet = new Set(dismissedHistoryIds);
  const activeItems = (watchHistory || []).filter((item) => {
    if (dismissedSet.has(item.id)) return false;
    if (isWatched(item.id)) return false;
    
    // Check for actual playback progress
    const savedRec = getSavedPlaybackTime(item.id, item.type, item.season, item.episode);
    const seconds = savedRec?.seconds ?? item.progressSeconds ?? 0;
    return seconds > 5;
  });
  if (!activeItems || activeItems.length === 0) return null;

  return (
    <div className="space-y-1.5 md:space-y-2 px-4 md:px-12 my-6">
      {/* Row Header matching Popular on Netflix */}
      <h2 className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight hover:text-zinc-300 transition cursor-pointer inline-flex items-center gap-2">
        <span>Continue Watching</span>
      </h2>

      {/* Row Container matching other Netflix rows */}
      <div className="relative">
        <div
          ref={rowRef}
          className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-none py-10 sm:py-12 px-3 sm:px-6 -my-6 sm:-my-8 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {activeItems.map((histItem) => {
            const mediaItem: MediaItem = {
              id: histItem.id,
              title: histItem.title,
              poster_path: histItem.poster_path,
              backdrop_path: histItem.backdrop_path,
              overview: histItem.overview || '',
              media_type: histItem.type,
              release_date: histItem.release_date || '',
              vote_average: histItem.vote_average ?? 8.0,
              season: histItem.season,
              episode: histItem.episode,
              number_of_seasons: histItem.number_of_seasons,
            };

            const episodeBadge =
              histItem.type === 'tv'
                ? `S${histItem.season || 1}:E${histItem.episode || 1}`
                : undefined;

            const savedRec = getSavedPlaybackTime(histItem.id, histItem.type, histItem.season, histItem.episode);
            const seconds = savedRec?.seconds ?? histItem.progressSeconds ?? 0;
            const duration = savedRec?.duration || histItem.durationSeconds || (histItem.type === 'tv' ? 45 * 60 : 110 * 60);
            const progress =
              duration > 0 && seconds > 0
                ? Math.min(95, Math.max(5, Math.round((seconds / duration) * 100)))
                : 0;

            const episodeBadgeNode = episodeBadge ? (
              <span className="bg-black/75 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 border border-white/10">
                {episodeBadge}
              </span>
            ) : undefined;

            return (
              <NetflixTallCard
                key={`continue-${histItem.type}-${histItem.id}`}
                item={mediaItem}
                imageType="backdrop"
                onSelect={onSelect}
                progress={progress}
                badge={episodeBadgeNode}
                onRemove={() => removeFromHistory(histItem.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
