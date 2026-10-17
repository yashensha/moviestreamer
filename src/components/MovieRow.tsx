import React, { useRef, useState } from 'react';
import type { MediaItem } from '../types/movie';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStreamStore } from '../store/useStreamStore';
import { MediaCard } from './MediaCard';
import { StarRatingModal } from './StarRatingModal';

interface MovieRowProps {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  items,
  onSelect,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);
  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const isInWatchlist = useStreamStore((state) => state.isInWatchlist);
  const getMediaRating = useStreamStore((state) => state.getMediaRating);

  const [ratingModalMedia, setRatingModalMedia] = useState<MediaItem | null>(null);

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
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight hover:text-rose-400 transition cursor-pointer flex items-center gap-2">
          <span>{title}</span>
        </h2>
      </div>

      {/* Row Container with Navigation Arrows */}
      <div className="relative group">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-r"
          aria-label="Scroll Left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrolling Items */}
        <div
          ref={rowRef}
          className="flex items-center gap-3 md:gap-4 overflow-x-auto scrollbar-none py-3 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, index) => (
            <MediaCard
              key={`${item.id}-${index}`}
              item={item}
              onSelect={onSelect}
              isLiked={isLiked(item.id)}
              onToggleLike={() => toggleLike(item)}
              isWatched={isWatched(item.id)}
              onToggleWatched={() => toggleWatched(item)}
              isInWatchlist={isInWatchlist(item.id)}
              onToggleWatchlist={() => toggleWatchlist(item)}
              userRating={getMediaRating(item.id)}
              onOpenRatingModal={setRatingModalMedia}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer rounded-l"
          aria-label="Scroll Right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* 5-Star Letterboxd Rating Modal */}
      <StarRatingModal
        isOpen={!!ratingModalMedia}
        onClose={() => setRatingModalMedia(null)}
        media={ratingModalMedia}
      />
    </div>
  );
};
