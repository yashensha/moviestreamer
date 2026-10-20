import type { MediaItem, WatchHistoryItem, UserRatingItem } from '../../types/movie';
import { GENRE_MAP } from '../tmdb';
import { resolveMovieGenomeSync } from './genome';
import type { MovieGenome, UserTasteProfile } from './types';

export interface BM25Config {
  refLength?: number; // Reference average interaction count (default 40)
  b?: number;         // Length penalty factor (default 0.75)
  k1?: number;        // Saturation factor (default 1.2)
}

/**
 * Calculates BM25 normalization dampening factor:
 * scale(L) = (k1 + 1) / (1 + k1 * (1 - b + b * (L / L_ref)))
 */
export function calculateBM25Dampener(count: number, config: BM25Config = {}): number {
  if (count <= 0) return 1.0;
  const refLength = config.refLength ?? 40;
  const b = config.b ?? 0.75;
  const k1 = config.k1 ?? 1.2;

  const lengthRatio = count / refLength;
  const denominator = 1 + k1 * (1 - b + b * lengthRatio);
  return (k1 + 1) / denominator;
}

/**
 * Exponential decay function giving higher weight to recently interacted titles (45-day half-life).
 * Baseline floor is 0.4 so older favorites are preserved.
 */
export function calculateTemporalDecay(timestamp?: number): number {
  if (!timestamp) return 0.75;
  const now = Date.now();
  const diffDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
  const decay = Math.exp(-diffDays / 45) * 0.6 + 0.4;
  return Math.min(1.0, Math.max(0.4, decay));
}

/**
 * Builds the user's high-dimensional taste profile across all 4 tiers
 */
export function buildUserTasteProfile(
  watchHistory: WatchHistoryItem[] = [],
  likedMedia: MediaItem[] = [],
  userRatings: UserRatingItem[] = [],
  dislikedMedia: MediaItem[] = [],
  watchlist: MediaItem[] = []
): UserTasteProfile {
  const excludedIds = new Set<number>();
  const dislikedDirectorNames = new Set<string>();

  // Raw weight accumulators
  const themeAccum = new Map<string, number>();
  const microgenreAccum = new Map<string, number>();
  const keywordAccum = new Map<string, number>();
  const genreAccum = new Map<number, number>();
  const directorAccum = new Map<string, number>();

  const temporalDecayFactors = new Map<number, number>();
  const positiveSeeds: MovieGenome[] = [];

  // 1. Process Negative Feedback (Hard Filters)
  for (const disliked of dislikedMedia) {
    if (disliked?.id) excludedIds.add(disliked.id);
  }

  for (const rating of userRatings) {
    if (rating.rating && rating.rating <= 2.5) {
      excludedIds.add(rating.id);
    }
  }

  // 2. Map positive interaction signals
  interface ScoredSeed {
    id: number;
    title: string;
    media_type: 'movie' | 'tv';
    rawScore: number;
    timestamp: number;
    itemFallback?: Partial<MediaItem>;
  }

  const seedCandidates = new Map<number, ScoredSeed>();

  const registerSignal = (
    id: number,
    score: number,
    timestamp: number,
    title: string,
    media_type: 'movie' | 'tv' = 'movie',
    itemFallback?: Partial<MediaItem>
  ) => {
    if (excludedIds.has(id)) return;
    const existing = seedCandidates.get(id);
    if (existing) {
      existing.rawScore = Math.max(existing.rawScore, score);
      existing.timestamp = Math.max(existing.timestamp, timestamp);
    } else {
      seedCandidates.set(id, {
        id,
        title,
        media_type,
        rawScore: score,
        timestamp,
        itemFallback,
      });
    }
  };

  // Hearts / Liked (5.0)
  for (const item of likedMedia) {
    if (!item?.id) continue;
    registerSignal(item.id, 5.0, Date.now(), item.title, (item.media_type as any) || 'movie', item);
  }

  // Ratings (5.0 for 5★, 4.0 for 4-4.5★, 2.5 for 3-3.5★)
  for (const r of userRatings) {
    if (!r?.id) continue;
    const star = r.rating || 0;
    const timestamp = r.ratedAt || Date.now();
    if (star >= 4.5) {
      registerSignal(r.id, 5.0, timestamp, r.title, r.type || 'movie');
    } else if (star >= 4.0) {
      registerSignal(r.id, 4.0, timestamp, r.title, r.type || 'movie');
    } else if (star >= 3.0) {
      registerSignal(r.id, 2.5, timestamp, r.title, r.type || 'movie');
    }
  }

  // Watch History: Completed = 3.5, Dwell > 10m = 2.0
  for (const w of watchHistory) {
    if (!w?.id) continue;
    excludedIds.add(w.id); // Watched movies shouldn't be recommended again
    const duration = w.durationSeconds || 1;
    const seconds = w.progressSeconds || w.progress || 0;
    const progressRatio = duration > 1 ? seconds / duration : 0;
    const timestamp = w.updatedAt || Date.now();

    if (progressRatio >= 0.85) {
      registerSignal(w.id, 3.5, timestamp, w.title, w.type || 'movie', w);
    } else if (seconds >= 600) {
      registerSignal(w.id, 2.0, timestamp, w.title, w.type || 'movie', w);
    }
  }

  // Watchlist (1.5)
  for (const wl of watchlist) {
    if (!wl?.id) continue;
    registerSignal(wl.id, 1.5, Date.now() - 3600 * 1000 * 24 * 7, wl.title, (wl.media_type as any) || 'movie', wl);
  }

  // 3. Compute BM25 Dampener across all positive interactions
  const totalInteractions = seedCandidates.size;
  const bm25Dampener = calculateBM25Dampener(totalInteractions);

  // 4. Project Seeds into 4-Tier Weight Vectors
  for (const seed of seedCandidates.values()) {
    const genome = resolveMovieGenomeSync(seed.id, seed.media_type, seed.itemFallback);
    const decay = calculateTemporalDecay(seed.timestamp);
    const effectiveWeight = seed.rawScore * decay * bm25Dampener;

    temporalDecayFactors.set(seed.id, decay);
    positiveSeeds.push(genome);

    // Tier 1: Themes (40% base priority)
    for (const theme of genome.themes) {
      themeAccum.set(theme, (themeAccum.get(theme) || 0) + effectiveWeight * 0.40);
    }

    // Tier 2: Microgenres (30% base priority)
    for (const mg of genome.microgenres) {
      microgenreAccum.set(mg, (microgenreAccum.get(mg) || 0) + effectiveWeight * 0.30);
    }

    // Tier 3: Keywords (20% base priority)
    for (const kw of genome.keywords) {
      keywordAccum.set(kw, (keywordAccum.get(kw) || 0) + effectiveWeight * 0.20);
    }

    // Tier 4: Broad Genres (10% base priority)
    const genreIds = seed.itemFallback?.genre_ids || [];
    for (const gid of genreIds) {
      genreAccum.set(gid, (genreAccum.get(gid) || 0) + effectiveWeight * 0.10);
    }
    for (const gName of genome.genres) {
      // Find matching TMDB genre ID
      for (const [idNum, name] of Object.entries(GENRE_MAP)) {
        if (name.toLowerCase() === gName.toLowerCase()) {
          const gid = Number(idNum);
          genreAccum.set(gid, (genreAccum.get(gid) || 0) + effectiveWeight * 0.10);
        }
      }
    }

    if (genome.director) {
      directorAccum.set(genome.director, (directorAccum.get(genome.director) || 0) + effectiveWeight);
    }
  }

  // 5. Extract Ranked Top Features for Human Explanation
  const sortMap = (map: Map<any, number>) =>
    Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

  const topThemes = sortMap(themeAccum).slice(0, 8).map(([name, score]) => ({ name: String(name), score }));
  const topMicrogenres = sortMap(microgenreAccum).slice(0, 8).map(([name, score]) => ({ name: String(name), score }));
  const topGenres = sortMap(genreAccum).slice(0, 5).map(([id, score]) => ({
    id: Number(id),
    name: GENRE_MAP[Number(id)] || 'Genre',
    score,
  }));
  const topDirectors = sortMap(directorAccum).slice(0, 5).map(([name, score]) => ({ name: String(name), score }));

  return {
    totalInteractions,
    positiveSeeds,
    excludedIds,
    dislikedDirectorNames,
    themeWeights: themeAccum,
    microgenreWeights: microgenreAccum,
    keywordWeights: keywordAccum,
    genreWeights: genreAccum,
    topThemes,
    topMicrogenres,
    topGenres,
    topDirectors,
    temporalDecayFactors,
    bm25Dampener,
    generatedAt: Date.now(),
  };
}
