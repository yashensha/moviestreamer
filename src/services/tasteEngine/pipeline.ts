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
 * Maps high-level themes to natural TMDB genre discovery filters
 */
function getGenreFilterForTheme(themeName: string): string {
  const t = themeName.toLowerCase();
  if (t.includes('superhero') || t.includes('alien') || t.includes('space')) return '28,878';
  if (t.includes('combat') || t.includes('martial arts') || t.includes('action')) return '28,12';
  if (t.includes('horror') || t.includes('haunted') || t.includes('creepy') || t.includes('vampire')) return '27,53';
  if (t.includes('humor') || t.includes('comedy') || t.includes('jokes')) return '35';
  if (t.includes('romance') || t.includes('relationship') || t.includes('charming')) return '10749,18';
  if (t.includes('crime') || t.includes('gangster') || t.includes('noir') || t.includes('heist')) return '80,53';
  if (t.includes('animated') || t.includes('kids') || t.includes('fairy-tale')) return '16,10751';
  if (t.includes('mystery') || t.includes('thriller') || t.includes('psychological')) return '9648,53';
  if (t.includes('war') || t.includes('military') || t.includes('battle')) return '10752,36';
  if (t.includes('western')) return '37';
  if (t.includes('family') || t.includes('heartfelt') || t.includes('sentimental')) return '10751,18';
  return '18'; // Drama baseline
}

/**
 * Helper to fetch TMDB endpoint safely
 */
async function fetchTMDBJson(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/**
 * Executes the Netflix-style taste recommendation pipeline with deep candidate pools
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

  const candidatePool = new Map<number, CandidateEntry>();
  const seedsToUse = profile.positiveSeeds.slice(0, 8);
  const primarySeed = seedsToUse[0];
  const seedType = preferredType || primarySeed?.media_type || 'movie';

  const parallelTasks: Promise<void>[] = [];

  // ============================================================================
  // Task 1: Deep Harvesting for Primary Seed ("Because You Watched")
  // Fetch Recommendations (p1 + p2), Similar (p1), and Discover with seed genres
  // ============================================================================
  const seedCandidatesMap = new Map<number, MediaItem>();

  if (primarySeed) {
    parallelTasks.push(
      (async () => {
        const [recsP1, recsP2, similarP1] = await Promise.all([
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/recommendations?page=1`),
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/recommendations?page=2`),
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/similar?page=1`),
        ]);

        const rawList = [...recsP1, ...recsP2, ...similarP1];
        for (const raw of rawList) {
          if (raw.id === primarySeed.id || profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          seedCandidatesMap.set(item.id, item);
        }

        // If still low on candidates, fetch discover by primary seed's genres
        if (seedCandidatesMap.size < 25 && primarySeed.genres.length > 0) {
          const disc = await fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=100&page=1`
          );
          for (const raw of disc) {
            if (raw.id === primarySeed.id || profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
            const item = mapTMDBToMediaItem(raw, seedType);
            seedCandidatesMap.set(item.id, item);
          }
        }
      })()
    );
  }

  // ============================================================================
  // Task 2: Broad Candidate Harvesting across user's other favorite seeds
  // ============================================================================
  for (const seed of seedsToUse.slice(1, 6)) {
    parallelTasks.push(
      (async () => {
        const recs = await fetchTMDBJson(
          `https://api.themoviedb.org/3/${seed.media_type}/${seed.id}/recommendations?page=1`
        );
        for (const raw of recs) {
          if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, preferredType || seed.media_type);
          if (!candidatePool.has(item.id)) {
            const match = calculateUnifiedMatchScore(item, profile);
            candidatePool.set(item.id, {
              item,
              seedTitle: seed.title,
              matchScore: match.percentage,
            });
          }
        }
      })()
    );
  }

  // ============================================================================
  // Task 3: Thematic Rows Discovery (Top 2-3 Themes)
  // Fetch high-volume discover sets for each theme
  // ============================================================================
  const thematicRowsToHarvest = profile.topThemes.slice(0, 3);
  const themeCandidateBuckets = new Map<string, Map<number, MediaItem>>();

  for (const th of thematicRowsToHarvest) {
    themeCandidateBuckets.set(th.name, new Map());
    const genreFilter = getGenreFilterForTheme(th.name);

    parallelTasks.push(
      (async () => {
        const [p1, p2] = await Promise.all([
          fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?with_genres=${genreFilter}&sort_by=popularity.desc&vote_average.gte=6.6&vote_count.gte=100&page=1`
          ),
          fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?with_genres=${genreFilter}&sort_by=popularity.desc&vote_average.gte=6.4&vote_count.gte=80&page=2`
          ),
        ]);

        const bucket = themeCandidateBuckets.get(th.name)!;
        for (const raw of [...p1, ...p2]) {
          if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          bucket.set(item.id, item);

          // Also inject into global candidate pool for Top Picks
          if (!candidatePool.has(item.id)) {
            const match = calculateUnifiedMatchScore(item, profile);
            candidatePool.set(item.id, {
              item,
              seedTitle: th.name,
              matchScore: match.percentage,
            });
          }
        }
      })()
    );
  }

  await Promise.allSettled(parallelTasks);

  // Inject seed candidates into candidate pool
  for (const item of seedCandidatesMap.values()) {
    if (!candidatePool.has(item.id)) {
      const match = calculateUnifiedMatchScore(item, profile);
      candidatePool.set(item.id, {
        item,
        seedTitle: primarySeed?.title,
        matchScore: match.percentage,
      });
    }
  }

  // ============================================================================
  // Rank and assemble final rows (Netflix standards: 18 - 24 items per row)
  // ============================================================================
  const rankedCandidates = Array.from(candidatePool.values()).sort(
    (a, b) => b.matchScore - a.matchScore
  );

  // Row 1: Top Picks (Top 20 candidates)
  const topPicks = rankedCandidates.slice(0, 20).map((c) => c.item);

  // Row 2: Because You Watched "{primarySeed.title}" (18-20 items)
  let becauseYouWatched: TasteEngineRows['becauseYouWatched'] = undefined;
  if (primarySeed) {
    const scoredSeedCandidates = Array.from(seedCandidatesMap.values())
      .map((item) => ({
        item,
        score: calculateUnifiedMatchScore(item, profile).percentage,
      }))
      .sort((a, b) => b.score - a.score);

    // If seed candidates are plentiful, take top 18-20
    let seedItems = scoredSeedCandidates.map((c) => c.item).slice(0, 20);

    // If still under 14 items, backfill with top picks from similar genres
    if (seedItems.length < 14) {
      const existingIds = new Set(seedItems.map((i) => i.id));
      for (const cand of rankedCandidates) {
        if (!existingIds.has(cand.item.id) && cand.item.id !== primarySeed.id) {
          seedItems.push(cand.item);
          existingIds.add(cand.item.id);
          if (seedItems.length >= 18) break;
        }
      }
    }

    if (seedItems.length >= 6) {
      becauseYouWatched = {
        seedTitle: primarySeed.title,
        items: seedItems,
      };
    }
  }

  // Row 3+: Thematic Rows (18-20 items per row)
  const thematicRows: TasteEngineRows['thematicRows'] = [];

  for (const th of thematicRowsToHarvest) {
    const bucket = themeCandidateBuckets.get(th.name);
    if (!bucket || bucket.size === 0) continue;

    const scoredThemeItems = Array.from(bucket.values())
      .map((item) => ({
        item,
        score: calculateUnifiedMatchScore(item, profile).percentage,
      }))
      .sort((a, b) => b.score - a.score);

    let rowItems = scoredThemeItems.map((c) => c.item).slice(0, 20);

    // If any row is under 14, backfill with high-scoring items from candidate pool
    if (rowItems.length < 14) {
      const existingIds = new Set(rowItems.map((i) => i.id));
      for (const cand of rankedCandidates) {
        if (!existingIds.has(cand.item.id)) {
          rowItems.push(cand.item);
          existingIds.add(cand.item.id);
          if (rowItems.length >= 18) break;
        }
      }
    }

    if (rowItems.length >= 8) {
      thematicRows.push({
        title: th.name,
        themeOrGenre: th.name,
        items: rowItems,
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
