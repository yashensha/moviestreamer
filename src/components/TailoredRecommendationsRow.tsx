import React, { useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import {
  generateFullRecommendationPipeline,
  type CuratedRecommendationRows,
} from '../services/recommendationPipeline';
import { PopularOnNetflixRow, type CardVariant } from './PopularOnNetflixRow';

interface TailoredRecommendationsRowProps {
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
  mediaType?: 'movie' | 'tv';
  title?: string;
  cardVariant?: CardVariant;
}

export const TailoredRecommendationsRow: React.FC<TailoredRecommendationsRowProps> = ({
  onSelect,
  onPlay,
  mediaType,
  title,
  cardVariant = 'tall',
}) => {
  const likedMedia = useStreamStore((state) => state.likedMedia);
  const watchHistory = useStreamStore((state) => state.watchHistory);
  const userRatings = useStreamStore((state) => state.userRatings);
  const isWatched = useStreamStore((state) => state.isWatched);
  const dislikedMedia = useStreamStore((state) => state.dislikedMedia);

  const [pipelineData, setPipelineData] = useState<CuratedRecommendationRows>({
    topPicks: [],
    dominantGenres: [],
    totalCandidatePoolCount: 0,
    modelTimestamp: 0,
  });

  useEffect(() => {
    let isMounted = true;

    generateFullRecommendationPipeline(watchHistory, likedMedia, userRatings, dislikedMedia, {
      preferredType: mediaType,
    })
      .then((res) => {
        if (isMounted) {
          setPipelineData(res);
        }
      })
      .catch((err) => {
        console.warn('Recommendation pipeline error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [likedMedia, watchHistory, userRatings, dislikedMedia, mediaType]);

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
    <div className="space-y-6">
      {/* Row 1: Top Picks for You */}
      {filteredTopPicks.length > 0 && (
        <PopularOnNetflixRow
          title={defaultTitle}
          items={filteredTopPicks.map((p) => p.item)}
          onSelect={onSelect}
          onPlay={onPlay}
          variant="backdrop"
        />
      )}

      {/* Row 2: Because You Watched [Title] - Tall Card Variant with Hover Preview */}
      {filteredBecauseYouWatched && (
        <PopularOnNetflixRow
          title={`Because You Watched "${filteredBecauseYouWatched.seedTitle}"`}
          items={filteredBecauseYouWatched.items.map((p) => p.item)}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
        />
      )}

      {/* Row 3: Hidden Gems */}
      {filteredHiddenGems && (
        <PopularOnNetflixRow
          title={`Hidden Gems in ${filteredHiddenGems.genreName}`}
          items={filteredHiddenGems.items.map((p) => p.item)}
          onSelect={onSelect}
          onPlay={onPlay}
          variant="backdrop"
        />
      )}
    </div>
  );
};
