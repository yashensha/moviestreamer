import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import {
  generateFullRecommendationPipeline,
  type CuratedRecommendationRows,
  type ScoredRecommendationItem,
} from '../services/recommendationPipeline';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { MediaCard } from './MediaCard';
import { StarRatingModal } from './StarRatingModal';

interface TailoredRecommendationsRowProps {
  onSelect: (item: MediaItem) => void;
  mediaType?: 'movie' | 'tv';
  title?: string;
}

// Single Standardized Category Row Component
const StandardizedRecommendationRow: React.FC<{
  title: string;
  items: ScoredRecommendationItem[];
  onSelect: (item: MediaItem) => void;
  isLiked: (id: number) => boolean;
  toggleLike: (item: MediaItem) => void;
  isWatched: (id: number) => boolean;
  toggleWatched: (item: MediaItem) => void;
  isInWatchlist: (id: number) => boolean;
  toggleWatchlist: (item: MediaItem) => void;
  getMediaRating: (id: number) => number | undefined;
  onOpenRatingModal: (item: MediaItem) => void;
}> = ({
  title,
  items,
  onSelect,
  isLiked,
  toggleLike,
  isWatched,
  toggleWatched,
  isInWatchlist,
  toggleWatchlist,
  getMediaRating,
  onOpenRatingModal,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

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
      {/* Standardized Row Header */}
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
          {items.map((scored, index) => {
            const item = scored.item;
            return (
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
                onOpenRatingModal={onOpenRatingModal}
              />
            );
          })}
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
    </div>
  );
};

export const TailoredRecommendationsRow: React.FC<TailoredRecommendationsRowProps> = ({
  onSelect,
  mediaType,
  title,
}) => {
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const userRatings = useStreamStore((state) => state.userRatings);
  const toggleLike = useStreamStore((state) => state.toggleLike);
  const isLiked = useStreamStore((state) => state.isLiked);
  const toggleWatched = useStreamStore((state) => state.toggleWatched);
  const isWatched = useStreamStore((state) => state.isWatched);
  const toggleWatchlist = useStreamStore((state) => state.toggleWatchlist);
  const isInWatchlist = useStreamStore((state) => state.isInWatchlist);
  const getMediaRating = useStreamStore((state) => state.getMediaRating);

  const [ratingModalMedia, setRatingModalMedia] = useState<MediaItem | null>(null);

  const [pipelineData, setPipelineData] = useState<CuratedRecommendationRows>({
    topPicks: [],
    dominantGenres: [],
    totalCandidatePoolCount: 0,
    modelTimestamp: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    generateFullRecommendationPipeline(watchHistory, likedMedia, userRatings, {
      preferredType: mediaType,
    })
      .then((res) => {
        if (isMounted) {
          setPipelineData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Recommendation pipeline error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [likedMedia, watchHistory, userRatings, mediaType]);

  const defaultTitle =
    title ||
    (mediaType === 'tv'
      ? 'Top Series Tailored for You'
      : mediaType === 'movie'
      ? 'Top Movies Tailored for You'
      : 'Top Picks for You');

  const filteredTopPicks = useMemo(() => {
    return pipelineData.topPicks.filter((p) => !isWatched(p.item.id));
  }, [pipelineData.topPicks, isWatched]);

  const filteredBecauseYouWatched = useMemo(() => {
    if (!pipelineData.becauseYouWatched) return null;
    const unhit = pipelineData.becauseYouWatched.items.filter((p) => !isWatched(p.item.id));
    if (unhit.length === 0) return null;
    return {
      ...pipelineData.becauseYouWatched,
      items: unhit,
    };
  }, [pipelineData.becauseYouWatched, isWatched]);

  const filteredHiddenGems = useMemo(() => {
    if (!pipelineData.hiddenGems) return null;
    const unhit = pipelineData.hiddenGems.items.filter((p) => !isWatched(p.item.id));
    if (unhit.length === 0) return null;
    return {
      ...pipelineData.hiddenGems,
      items: unhit,
    };
  }, [pipelineData.hiddenGems, isWatched]);


  return (
    <div className="space-y-4">
      {/* Row 1: Top Picks for You */}
      <StandardizedRecommendationRow
        title={defaultTitle}
        items={filteredTopPicks}
        onSelect={onSelect}
        isLiked={isLiked}
        toggleLike={toggleLike}
        isWatched={isWatched}
        toggleWatched={toggleWatched}
        isInWatchlist={isInWatchlist}
        toggleWatchlist={toggleWatchlist}
        getMediaRating={getMediaRating}
        onOpenRatingModal={setRatingModalMedia}
      />

      {/* Row 2: Because You Watched [Title] - Standardized, no icon/subtitle/badge, dynamic on refresh */}
      {filteredBecauseYouWatched && (
        <StandardizedRecommendationRow
          title={`Because You Watched "${filteredBecauseYouWatched.seedTitle}"`}
          items={filteredBecauseYouWatched.items}
          onSelect={onSelect}
          isLiked={isLiked}
          toggleLike={toggleLike}
          isWatched={isWatched}
          toggleWatched={toggleWatched}
          isInWatchlist={isInWatchlist}
          toggleWatchlist={toggleWatchlist}
          getMediaRating={getMediaRating}
          onOpenRatingModal={setRatingModalMedia}
        />
      )}

      {/* Row 3: Hidden Gems */}
      {filteredHiddenGems && (
        <StandardizedRecommendationRow
          title={`Hidden Gems in ${filteredHiddenGems.genreName}`}
          items={filteredHiddenGems.items}
          onSelect={onSelect}
          isLiked={isLiked}
          toggleLike={toggleLike}
          isWatched={isWatched}
          toggleWatched={toggleWatched}
          isInWatchlist={isInWatchlist}
          toggleWatchlist={toggleWatchlist}
          getMediaRating={getMediaRating}
          onOpenRatingModal={setRatingModalMedia}
        />
      )}

      {/* 5-Star Letterboxd Rating Modal */}
      <StarRatingModal
        isOpen={!!ratingModalMedia}
        onClose={() => setRatingModalMedia(null)}
        media={ratingModalMedia}
      />
    </div>
  );
};
