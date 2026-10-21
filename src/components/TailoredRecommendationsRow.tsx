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
  heroItemIds?: Set<number> | number[];
}

export const TailoredRecommendationsRow: React.FC<TailoredRecommendationsRowProps> = ({
  onSelect,
  onPlay,
  mediaType,
  title,
  cardVariant = 'tall',
  heroItemIds,
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

  const heroSet = useMemo(() => {
    if (!heroItemIds) return new Set<number>();
    if (heroItemIds instanceof Set) return heroItemIds;
    return new Set(heroItemIds);
  }, [heroItemIds]);

  const defaultTitle =
    title ||
    (mediaType === 'tv'
      ? 'Top Series Tailored for You'
      : mediaType === 'movie'
      ? 'Top Movies Tailored for You'
      : heroSet.size > 0
      ? 'Recommended for You Today'
      : 'Top Picks for You');

  // Row 1: Top Picks (Combining top picks and more matches, strictly excluding items shown in hero row)
  const filteredTopPicks = useMemo(() => {
    const pool = [...pipelineData.topPicks, ...(pipelineData.moreTopMatches || [])];
    const seen = new Set<number>();
    const res: MediaItem[] = [];

    for (const item of pool) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (isWatched(item.id)) continue;
      if (heroSet.has(item.id)) continue;
      res.push(item);
      if (res.length >= 24) break;
    }
    return res;
  }, [pipelineData.topPicks, pipelineData.moreTopMatches, isWatched, heroSet]);

  // Row 2: Seed 1 - "Because You Watched [Title]"
  const filteredBecauseYouWatched = useMemo(() => {
    if (!pipelineData.becauseYouWatched) return null;
    const unhit = pipelineData.becauseYouWatched.items.filter(
      (item) => !isWatched(item.id) && !heroSet.has(item.id)
    );
    if (unhit.length < 5) return null;
    return {
      ...pipelineData.becauseYouWatched,
      items: unhit,
    };
  }, [pipelineData.becauseYouWatched, isWatched, heroSet]);

  // Row 3: Seed 2 - "More Like [Title]"
  const filteredSecondaryBecauseYouWatched = useMemo(() => {
    if (!pipelineData.secondaryBecauseYouWatched) return null;
    const unhit = pipelineData.secondaryBecauseYouWatched.items.filter(
      (item) => !isWatched(item.id) && !heroSet.has(item.id)
    );
    if (unhit.length < 5) return null;
    return {
      ...pipelineData.secondaryBecauseYouWatched,
      items: unhit,
    };
  }, [pipelineData.secondaryBecauseYouWatched, isWatched, heroSet]);

  // Row 4: "Hidden Gems for Your Taste"
  const filteredHiddenGems = useMemo(() => {
    if (!pipelineData.hiddenGems) return null;
    const topPickIds = new Set(filteredTopPicks.slice(0, 10).map((i) => i.id));
    const unhit = pipelineData.hiddenGems.items.filter(
      (item) => !isWatched(item.id) && !heroSet.has(item.id) && !topPickIds.has(item.id)
    );
    if (unhit.length < 5) return null;
    return {
      ...pipelineData.hiddenGems,
      items: unhit,
    };
  }, [pipelineData.hiddenGems, filteredTopPicks, isWatched, heroSet]);

  // Row 6: "Critically Acclaimed for Your Taste"
  const filteredPrestigePicks = useMemo(() => {
    if (!pipelineData.prestigePicks) return null;
    const unhit = pipelineData.prestigePicks.items.filter(
      (item) => !isWatched(item.id) && !heroSet.has(item.id)
    );
    if (unhit.length < 5) return null;
    return {
      ...pipelineData.prestigePicks,
      items: unhit,
    };
  }, [pipelineData.prestigePicks, isWatched, heroSet]);

  return (
    <div className="space-y-6">
      {/* Row 1: Top Picks / Recommended for You Today (Fresh, zero duplicates with Hero) */}
      {filteredTopPicks.length > 0 && (
        <PopularOnNetflixRow
          title={defaultTitle}
          items={filteredTopPicks}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
          imageType="backdrop"
        />
      )}

      {/* Row 2: Because You Watched [Seed 1] */}
      {filteredBecauseYouWatched && (
        <PopularOnNetflixRow
          title={`Because You Watched "${filteredBecauseYouWatched.seedTitle}"`}
          items={filteredBecauseYouWatched.items}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
          imageType="backdrop"
        />
      )}

      {/* Row 3: More Like [Seed 2] */}
      {filteredSecondaryBecauseYouWatched && (
        <PopularOnNetflixRow
          title={`More Like "${filteredSecondaryBecauseYouWatched.seedTitle}"`}
          items={filteredSecondaryBecauseYouWatched.items}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
          imageType="backdrop"
        />
      )}

      {/* Row 4: Hidden Gems for Your Taste */}
      {filteredHiddenGems && (
        <PopularOnNetflixRow
          title={filteredHiddenGems.title}
          items={filteredHiddenGems.items}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
          imageType="backdrop"
        />
      )}

      {/* Row 5: Evocative Thematic / Microgenre Rows */}
      {pipelineData.thematicRows.map((row, idx) => {
        const unhit = row.items.filter(
          (item) => !isWatched(item.id) && !heroSet.has(item.id)
        );
        if (unhit.length < 5) return null;
        return (
          <PopularOnNetflixRow
            key={`thematic-row-${idx}`}
            title={row.title}
            items={unhit}
            onSelect={onSelect}
            onPlay={onPlay}
            variant={cardVariant}
            imageType="backdrop"
          />
        );
      })}

      {/* Row 6: Critically Acclaimed / Prestige Picks Tailored to You */}
      {filteredPrestigePicks && (
        <PopularOnNetflixRow
          title={filteredPrestigePicks.title}
          items={filteredPrestigePicks.items}
          onSelect={onSelect}
          onPlay={onPlay}
          variant={cardVariant}
          imageType="backdrop"
        />
      )}
    </div>
  );
};
