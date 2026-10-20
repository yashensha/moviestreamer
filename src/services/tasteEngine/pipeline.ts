import type { MediaItem, MediaType } from '../../types/movie';
import { TMDB_READ_ACCESS_TOKEN, fetchTrendingMedia } from '../tmdb';
import { calculateUnifiedMatchScore } from './matchScorer';
import type { UserTasteProfile, TasteEngineRows } from './types';

interface CandidateEntry {
  item: MediaItem;
  seedTitle?: string;
  matchScore: number;
}

/**
 * Maps TMDB raw result to MediaItem
 */
function mapTMDBToMediaItem(raw: any, typeFallback: MediaType = 'movie'): MediaItem {
  const type: MediaType = raw.media_type || (raw.title ? 'movie' : 'tv') || typeFallback;
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Untitled',
    overview: raw.overview || '',
    poster_path: raw.poster_path || null,
    backdrop_path: raw.backdrop_path || null,
    media_type: type,
    release_date: raw.release_date || raw.first_air_date || '',
    vote_average: raw.vote_average || 7.0,
    genre_ids: raw.genre_ids || [],
  };
}

/**
 * Executes the Netflix-style taste recommendation pipeline
 */
export async function runTasteRecommendationPipeline(
  profile: UserTasteProfile,
  options: { preferredType?: MediaType; limit?: number } = {}
): Promise<TasteEngineRows> {
  const preferredType = options.preferredType;
  const limit = options.limit || 20;

  // Cold Start: Fallback to high-quality trending
  if (profile.totalInteractions === 0) {
    const trending = await fetchTrendingMedia();
    const topPicks = (preferredType ? trending.filter((t) => t.media_type === preferredType) : trending).slice(0, limit);
    return {
      topPicks,
      thematicRows: [],
      totalPoolCount: topPicks.length,
    };
  }

  const headers = {
    Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  };

  const candidatePool = new Map<number, CandidateEntry>();
  const seedsToUse = profile.positiveSeeds.slice(0, 6);

  // 1. Parallel candidate queries across seeds
  const queryPromises: Promise<void>[] = [];

  for (const seed of seedsToUse) {
    const seedType = preferredType || seed.media_type || 'movie';

    // A. Direct TMDB Recommendations
    queryPromises.push(
      (async () => {
        try {
          const url = `https://api.themoviedb.org/3/${seed.media_type}/${seed.id}/recommendations`;
          const res = await fetch(url, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.results)) {
              for (const raw of data.results.slice(0, 15)) {
                if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
                const item = mapTMDBToMediaItem(raw, seedType);
                if (!candidatePool.has(item.id)) {
                  const match = calculateUnifiedMatchScore(item, profile);
                  candidatePool.set(item.id, {
                    item,
                    seedTitle: seed.title,
                    matchScore: match.percentage,
                  });
                }
              }
            }
          }
        } catch {
          // ignore single network error
        }
      })()
    );

    // B. Thematic query matches (using top keywords or genres)
    if (seed.genres.length > 0) {
      queryPromises.push(
        (async () => {
          try {
            const url = `https://api.themoviedb.org/3/discover/${seedType}?sort_by=popularity.desc&vote_average.gte=6.8&vote_count.gte=100`;
            const res = await fetch(url, { headers });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.results)) {
                for (const raw of data.results.slice(0, 10)) {
                  if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
                  const item = mapTMDBToMediaItem(raw, seedType);
                  if (!candidatePool.has(item.id)) {
                    const match = calculateUnifiedMatchScore(item, profile);
                    candidatePool.set(item.id, {
                      item,
                      seedTitle: seed.title,
                      matchScore: match.percentage,
                    });
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        })()
      );
    }
  }

  await Promise.allSettled(queryPromises);

  // 2. Sort candidate pool by Unified Match Score
  const rankedCandidates = Array.from(candidatePool.values()).sort(
    (a, b) => b.matchScore - a.matchScore
  );

  const topPicks = rankedCandidates.slice(0, limit).map((c) => c.item);

  // 3. Synthesize "Because You Watched" row
  let becauseYouWatched: TasteEngineRows['becauseYouWatched'] = undefined;
  if (seedsToUse.length > 0) {
    const primarySeed = seedsToUse[0];
    const related = rankedCandidates
      .filter((c) => c.seedTitle === primarySeed.title && c.item.id !== primarySeed.id)
      .slice(0, 12)
      .map((c) => c.item);

    if (related.length >= 4) {
      becauseYouWatched = {
        seedTitle: primarySeed.title,
        items: related,
      };
    }
  }

  // 4. Synthesize Thematic Rows based on top user themes
  const thematicRows: TasteEngineRows['thematicRows'] = [];
  if (profile.topThemes.length > 0) {
    const primaryTheme = profile.topThemes[0].name;
    const themeMatches = rankedCandidates
      .filter((c) => {
        const match = calculateUnifiedMatchScore(c.item, profile);
        return match.matchedThemes && match.matchedThemes.includes(primaryTheme);
      })
      .slice(0, 12)
      .map((c) => c.item);

    if (themeMatches.length >= 4) {
      thematicRows.push({
        title: primaryTheme,
        themeOrGenre: primaryTheme,
        items: themeMatches,
      });
    }
  }

  return {
    topPicks,
    becauseYouWatched,
    thematicRows,
    totalPoolCount: rankedCandidates.length,
  };
}
