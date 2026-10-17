import type { MediaItem, WatchHistoryItem, UserRatingItem, MediaType } from '../types/movie';
import { GENRE_MAP } from './tmdb';

export type InteractionSignalType =
  | 'heart'            // In-app Heart / Like (5.0)
  | 'letterboxd_5'     // Letterboxd 5★ (5.0)
  | 'letterboxd_4'     // Letterboxd 4★–4.5★ (4.0)
  | 'completed'        // In-App Completed Episode/Movie (3.5)
  | 'letterboxd_3'     // Letterboxd 2.5★–3.5★ / 3★ (2.5)
  | 'dwell_stream'     // Started Streaming >10m dwell (2.0)
  | 'watchlist'        // Letterboxd Watchlist (1.5)
  | 'streaming_short'  // Started Streaming <10m dwell (1.0)
  | 'hard_filter';     // Letterboxd 1★–2★ (0.0 / Negative Hard Filter)

export interface UnifiedInteractionItem {
  id: number;
  type: MediaType;
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids: number[];
  rawWeight: number;
  normalizedWeight: number;
  signals: InteractionSignalType[];
  primarySignal: InteractionSignalType;
  isHardFiltered: boolean;
  userRating?: number;
  lastInteractedAt: number;
}

export interface TasteMatrixProfile {
  interactions: UnifiedInteractionItem[];
  itemCount: number;
  bm25Dampener: number;
  positiveSeeds: UnifiedInteractionItem[];
  hardFilteredIds: number[];
  genreWeights: Record<number, number>;
  topGenres: Array<{ id: number; name: string; score: number }>;
  signalsCount: Record<InteractionSignalType, number>;
  generatedAt: number;
}

export interface BM25Config {
  refLength?: number; // L_ref: reference average library length (default 50)
  b?: number;         // Length penalty factor (default 0.75)
  k1?: number;        // Term frequency / scale parameter (default 1.2)
}

/**
 * Calculates the BM25 library length normalization dampening factor:
 * scale(L) = (k1 + 1) / (1 + k1 * (1 - b + b * (L / L_ref)))
 * 
 * - For L = 50: scale = 1.0 (neutral baseline)
 * - For casual viewers (e.g. L = 10): scale ≈ 1.48 (boosts sparse signals)
 * - For power viewers with 1,000+ imported movies: scale ≈ 0.11 (smoothly dampens aggregate skew)
 */
export function calculateBM25Dampener(
  itemCount: number,
  config: BM25Config = {}
): number {
  if (itemCount <= 0) return 1.0;

  const refLength = config.refLength ?? 50;
  const b = config.b ?? 0.75;
  const k1 = config.k1 ?? 1.2;

  const lengthRatio = itemCount / refLength;
  const denominator = 1 + k1 * (1 - b + b * lengthRatio);
  const scale = (k1 + 1) / denominator;

  // Round to 4 decimal places for numerical stability
  return Math.round(scale * 10000) / 10000;
}

/**
 * Computes the Unified Interaction Matrix fusing:
 * 1. Letterboxd ratings & watchlists
 * 2. In-app hearts / likes
 * 3. In-app streaming dwell and completions
 * 
 * Weights Formula:
 * - Letterboxd 5★ or In-App Heart: 5.0
 * - Letterboxd 4★–4.5★: 4.0
 * - In-App Completed Episode/Movie: 3.5
 * - Letterboxd 3★: 2.5
 * - Started Streaming (>10m dwell): 2.0
 * - Letterboxd Watchlist: 1.5
 * - Letterboxd 1★–2★: 0.0 / Hard Filter
 */
export function computeUnifiedInteractionMatrix(
  watchHistory: WatchHistoryItem[] = [],
  likedMedia: MediaItem[] = [],
  userRatings: UserRatingItem[] = [],
  bm25Config: BM25Config = {}
): TasteMatrixProfile {
  const itemMap = new Map<number, {
    item: UnifiedInteractionItem;
    signalWeights: number[];
  }>();

  const signalsCount: Record<InteractionSignalType, number> = {
    heart: 0,
    letterboxd_5: 0,
    letterboxd_4: 0,
    completed: 0,
    letterboxd_3: 0,
    dwell_stream: 0,
    watchlist: 0,
    streaming_short: 0,
    hard_filter: 0,
  };

  // Helper to get or initialize an item in the unified map
  const getOrCreate = (
    id: number,
    baseData: {
      type: MediaType;
      title: string;
      poster_path: string | null;
      backdrop_path?: string | null;
      release_date?: string;
      vote_average?: number;
      genre_ids?: number[];
      updatedAt?: number;
    }
  ) => {
    let entry = itemMap.get(id);
    if (!entry) {
      entry = {
        item: {
          id,
          type: baseData.type || 'movie',
          title: baseData.title,
          poster_path: baseData.poster_path ?? null,
          backdrop_path: baseData.backdrop_path ?? null,
          release_date: baseData.release_date,
          vote_average: baseData.vote_average,
          genre_ids: baseData.genre_ids || [],
          rawWeight: 0,
          normalizedWeight: 0,
          signals: [],
          primarySignal: 'dwell_stream',
          isHardFiltered: false,
          lastInteractedAt: baseData.updatedAt || Date.now(),
        },
        signalWeights: [],
      };
      itemMap.set(id, entry);
    } else {
      // Merge genres if previous entry had none
      if ((!entry.item.genre_ids || entry.item.genre_ids.length === 0) && baseData.genre_ids?.length) {
        entry.item.genre_ids = baseData.genre_ids;
      }
      if (!entry.item.poster_path && baseData.poster_path) {
        entry.item.poster_path = baseData.poster_path;
      }
      if (baseData.updatedAt && baseData.updatedAt > entry.item.lastInteractedAt) {
        entry.item.lastInteractedAt = baseData.updatedAt;
      }
    }
    return entry;
  };

  // 1. Process In-App Likes (Heart -> Weight 5.0)
  for (const media of likedMedia) {
    const entry = getOrCreate(media.id, {
      type: media.media_type || 'movie',
      title: media.title,
      poster_path: media.poster_path,
      backdrop_path: media.backdrop_path,
      release_date: media.release_date,
      vote_average: media.vote_average,
      genre_ids: media.genre_ids || (media.genres ? media.genres.map((g) => g.id) : []),
    });

    if (!entry.item.signals.includes('heart')) {
      entry.item.signals.push('heart');
      entry.signalWeights.push(5.0);
      signalsCount.heart++;
    }
  }

  // 2. Process User Ratings (Letterboxd & Manual Ratings)
  for (const rating of userRatings) {
    const entry = getOrCreate(rating.id, {
      type: rating.type || 'movie',
      title: rating.title,
      poster_path: rating.poster_path,
      backdrop_path: rating.backdrop_path,
      release_date: rating.release_date,
      vote_average: rating.vote_average,
      genre_ids: rating.genre_ids,
      updatedAt: rating.ratedAt,
    });

    entry.item.userRating = rating.rating;

    // Evaluate Rating
    if (rating.rating !== undefined && rating.rating !== null && !isNaN(rating.rating)) {
      if (rating.rating <= 2.0) {
        // Hard Filter: 1★–2★ (Weight 0.0)
        if (!entry.item.signals.includes('hard_filter')) {
          entry.item.signals.push('hard_filter');
          entry.signalWeights.push(0.0);
          entry.item.isHardFiltered = true;
          signalsCount.hard_filter++;
        }
      } else if (rating.rating >= 4.75) {
        // Letterboxd 5★ (Weight 5.0)
        if (!entry.item.signals.includes('letterboxd_5')) {
          entry.item.signals.push('letterboxd_5');
          entry.signalWeights.push(5.0);
          signalsCount.letterboxd_5++;
        }
      } else if (rating.rating >= 3.75) {
        // Letterboxd 4★–4.5★ (Weight 4.0)
        if (!entry.item.signals.includes('letterboxd_4')) {
          entry.item.signals.push('letterboxd_4');
          entry.signalWeights.push(4.0);
          signalsCount.letterboxd_4++;
        }
      } else {
        // Letterboxd 2.5★–3.5★ / 3★ (Weight 2.5)
        if (!entry.item.signals.includes('letterboxd_3')) {
          entry.item.signals.push('letterboxd_3');
          entry.signalWeights.push(2.5);
          signalsCount.letterboxd_3++;
        }
      }
    } else if (rating.confidenceWeight === 1.5) {
      // Letterboxd Watchlist item (Weight 1.5)
      if (!entry.item.signals.includes('watchlist')) {
        entry.item.signals.push('watchlist');
        entry.signalWeights.push(1.5);
        signalsCount.watchlist++;
      }
    } else {
      // Watched without explicit star rating (default positive signal 2.5)
      if (!entry.item.signals.includes('letterboxd_3')) {
        entry.item.signals.push('letterboxd_3');
        entry.signalWeights.push(2.5);
        signalsCount.letterboxd_3++;
      }
    }
  }

  // 3. Process Watch History & In-Progress Streaming
  for (const history of watchHistory) {
    const entry = getOrCreate(history.id, {
      type: history.type,
      title: history.title,
      poster_path: history.poster_path,
      backdrop_path: history.backdrop_path,
      release_date: history.release_date,
      vote_average: history.vote_average,
      updatedAt: history.updatedAt,
    });

    const progress = history.progressSeconds || 0;
    const duration = history.durationSeconds || 0;

    const isCompleted =
      (duration > 0 && progress / duration >= 0.85) ||
      progress >= 7200; // >= 2 hours stream indicates full film watched

    if (isCompleted) {
      // In-App Completed Episode/Movie: Weight 3.5
      if (!entry.item.signals.includes('completed')) {
        entry.item.signals.push('completed');
        entry.signalWeights.push(3.5);
        signalsCount.completed++;
      }
    } else if (progress >= 600) {
      // Started Streaming >10m dwell: Weight 2.0
      if (!entry.item.signals.includes('dwell_stream')) {
        entry.item.signals.push('dwell_stream');
        entry.signalWeights.push(2.0);
        signalsCount.dwell_stream++;
      }
    } else if (progress > 30) {
      // Started Streaming <10m: Weight 1.0
      if (!entry.item.signals.includes('streaming_short')) {
        entry.item.signals.push('streaming_short');
        entry.signalWeights.push(1.0);
        signalsCount.streaming_short++;
      }
    } else {
      // Unrecorded dwell watch item
      if (entry.signalWeights.length === 0) {
        entry.item.signals.push('dwell_stream');
        entry.signalWeights.push(2.0);
        signalsCount.dwell_stream++;
      }
    }
  }

  // Calculate BM25 Length Normalization
  const totalItems = itemMap.size;
  const bm25Dampener = calculateBM25Dampener(totalItems, bm25Config);

  const interactions: UnifiedInteractionItem[] = [];
  const hardFilteredIds: number[] = [];
  const genreWeights: Record<number, number> = {};

  // 4. Resolve Final Weights per Item & Apply BM25 Dampener
  for (const { item, signalWeights } of itemMap.values()) {
    // Determine Raw Weight
    if (item.isHardFiltered) {
      // If user explicitly Liked (Hearted) it in-app, the active Heart overrides the negative filter
      if (item.signals.includes('heart')) {
        item.rawWeight = 5.0;
        item.isHardFiltered = false;
        item.primarySignal = 'heart';
      } else {
        item.rawWeight = 0.0;
        item.primarySignal = 'hard_filter';
        hardFilteredIds.push(item.id);
      }
    } else {
      // Maximum signal weight wins
      item.rawWeight = signalWeights.length > 0 ? Math.max(...signalWeights) : 1.0;

      // Determine primary signal for UI explanations
      if (item.signals.includes('heart')) item.primarySignal = 'heart';
      else if (item.signals.includes('letterboxd_5')) item.primarySignal = 'letterboxd_5';
      else if (item.signals.includes('letterboxd_4')) item.primarySignal = 'letterboxd_4';
      else if (item.signals.includes('completed')) item.primarySignal = 'completed';
      else if (item.signals.includes('letterboxd_3')) item.primarySignal = 'letterboxd_3';
      else if (item.signals.includes('dwell_stream')) item.primarySignal = 'dwell_stream';
      else if (item.signals.includes('watchlist')) item.primarySignal = 'watchlist';
      else item.primarySignal = 'streaming_short';
    }

    // Apply BM25 Normalization
    item.normalizedWeight = Math.round(item.rawWeight * bm25Dampener * 100) / 100;

    // Accumulate Genre Affinities (only for non-filtered titles with positive weight)
    if (!item.isHardFiltered && item.normalizedWeight > 0) {
      for (const gid of item.genre_ids) {
        genreWeights[gid] = (genreWeights[gid] || 0) + item.normalizedWeight;
      }
    }

    interactions.push(item);
  }

  // Sort interactions: highest normalized weight first, then most recently interacted
  interactions.sort((a, b) => {
    if (b.normalizedWeight !== a.normalizedWeight) {
      return b.normalizedWeight - a.normalizedWeight;
    }
    return b.lastInteractedAt - a.lastInteractedAt;
  });

  // Extract positive seeds (rawWeight >= 3.5: Hearts, Letterboxd 4-5★, Completed movies)
  const positiveSeeds = interactions.filter(
    (item) => !item.isHardFiltered && item.rawWeight >= 3.5
  );

  // Compute Top Genres
  const topGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([gid, score]) => ({
      id: Number(gid),
      name: GENRE_MAP[Number(gid)] || `Genre #${gid}`,
      score: Math.round(score * 10) / 10,
    }))
    .slice(0, 6);

  return {
    interactions,
    itemCount: totalItems,
    bm25Dampener,
    positiveSeeds,
    hardFilteredIds,
    genreWeights,
    topGenres,
    signalsCount,
    generatedAt: Date.now(),
  };
}
