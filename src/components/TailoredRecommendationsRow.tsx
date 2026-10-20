import React, { useState, useEffect, useMemo } from 'react';
import type { MediaItem } from '../types/movie';
import { useStreamStore } from '../store/useStreamStore';
import {
  runTasteRecommendationPipeline,
  buildUserTasteProfile,
  type TasteEngineRows,
} from '../services/tasteEngine';
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
  const watchlist = useStreamStore((state) => state.watchlist);

  const [pipelineData, setPipelineData] = useState<TasteEngineRows>({
    topPicks: [],
    thematicRows: [],
    totalPoolCount: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const profile = buildUserTasteProfile(
      watchHistory,
      likedMedia,
      userRatings,
      dislikedMedia,
      watchlist
    );

    runTasteRecommendationPipeline(profile, {
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
  }, [likedMedia, watchHistory, userRatings, dislikedMedia, watchlist, mediaType]);

  const defaultTitle =
    title ||
    (mediaType === 'tv'
      ? 'Top Series Tailored for You'
      : mediaType === 'movie'
      ? 'Top Movies Tailored for You'
      : 'Top Picks for You');

  const filteredTopPicks = useMemo(() => {
    return pipelineData.topPicks.filter((item) => !isWatched(item.id));
  }, [pipelineData.topPicks, isWatched]);

  const filteredBecauseYouWatched = useMemo(() => {
    if (!pipelineData.becauseYouWatched) return null;
    const unhit = pipelineData.becauseYouWatched.items.filter((item) => !isWatched(item.id));
    if (unhit.length === 0) return null;
    return {
      ...pipelineData.becauseYouWatched,
      items: unhit,
    };
  }, [pipelineData.becauseYouWatched, isWatched]);

  return (
    <div className="space-y-6">
      {/* Row 1: Top Picks for You */}
      {filteredTopPicks.length > 0 && (
        <PopularOnNetflixRow
          title={defaultTitle}
          items={filteredTopPicks}
          onSelect={onSelect}
          onPlay={onPlay}
          variant="backdrop"
        />
      )}

      {/* Row 2: Because You Watched [Title] - Card Variant with Hover Preview */}
      {filteredBecauseYouWatched && (
        <PopularOnNetflixRow
          title={`Because You Watched "${filteredBecauseYouWatched.seedTitle}"`}
          items={filteredBecauseYouWatched.items}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
        />
      )}

      {/* Row 3: Thematic Rows */}
      {pipelineData.thematicRows.map((row, idx) => {
        const unhit = row.items.filter((item) => !isWatched(item.id));
        if (unhit.length === 0) return null;
        return (
          <PopularOnNetflixRow
            key={`thematic-row-${idx}`}
            title={row.title}
            items={unhit}
            onSelect={onSelect}
            onPlay={onPlay}
            variant="backdrop"
          />
        );
      })}
    </div>
  );
};
