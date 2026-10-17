import type { MediaItem, MediaType, UserRatingItem, WatchHistoryItem } from '../types/movie';
import { GENRE_MAP } from './tmdb';
import {
  computeUnifiedInteractionMatrix,
  type TasteMatrixProfile,
} from './interactionMatrix';
import {
  generateContentGraphCandidates,
  type ContentGraphResult,
} from './contentGraphGenerator';
import {
  STOPWORDS,
  NARRATIVE_MOOD_KEYWORDS,
  NARRATIVE_PLOT_TROPES,
  CANONICAL_TAGS,
  getKnownTitleTags,
} from './subgenreService';

export interface ScoredRecommendationItem {
  item: MediaItem;
  hybridScore: number;
  contentGraphScore: number;
  latentSimilarityScore: number;
  temporalDecayFactor: number;
  seedTitle?: string;
  matchReason: string;
  attributionTags: string[];
  matchedSubgenres?: string[];
  matchedCluster?: string;
}

export interface CuratedRecommendationRows {
  topPicks: ScoredRecommendationItem[];
  becauseYouWatched?: {
    seedTitle: string;
    items: ScoredRecommendationItem[];
  };
  hiddenGems?: {
    genreName: string;
    genreId: number;
    items: ScoredRecommendationItem[];
  };
  dominantGenres: string[];
  totalCandidatePoolCount: number;
  modelTimestamp: number;
}

/**
 * Step 4: Narrative & Trope Latent Semantic Vector
 * Constructs a 256-dimensional feature vector prioritizing:
 * - Subgenres & Taxonomy Clusters (weight: 5.0)
 * - Thematic Keywords & Plot Tropes (weight: 3.5)
 * - Narrative Mood words (dark, tense, satirical, surreal, etc.) (weight: 3.5)
 * - Stopword-filtered synopsis content (weight: 1.0)
 */
function createLatentSemanticVector(
  title: string,
  overview: string = '',
  tags: string[] = []
): Map<number, number> {
  const vector = new Map<number, number>();

  const addHashedToken = (token: string, weight: number) => {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const dim = Math.abs(hash) % 256;
    vector.set(dim, (vector.get(dim) || 0) + weight);
  };

  // 1. Tags & Subgenres (highest priority: 5.0)
  for (const tag of tags) {
    const cleanTag = tag.toLowerCase().trim();
    if (!cleanTag) continue;
    addHashedToken(cleanTag, 5.0);

    // If tag contains multiple words, also hash individual words
    const subWords = cleanTag.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
    subWords.forEach((w) => addHashedToken(w, 2.5));
  }

  // 2. Overview / Synopsis Tokens with Stopword removal and Trope / Mood boosting
  const overviewWords = overview
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  for (const word of overviewWords) {
    let weight = 1.0;
    if (NARRATIVE_MOOD_KEYWORDS.has(word)) {
      weight = 3.5;
    } else if (NARRATIVE_PLOT_TROPES.has(word)) {
      weight = 3.5;
    } else if (CANONICAL_TAGS.has(word)) {
      weight = 4.0;
    }
    addHashedToken(word, weight);
  }

  // 3. Title keywords
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  for (const word of titleWords) {
    addHashedToken(word, 2.0);
  }

  // Normalize vector to unit length
  let norm = 0;
  for (const val of vector.values()) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (const [k, v] of vector.entries()) {
      vector.set(k, v / norm);
    }
  }

  return vector;
}

/**
 * Computes cosine dot-product similarity between two latent vectors
 */
function computeCosineSimilarity(
  vecA: Map<number, number>,
  vecB: Map<number, number>
): number {
  let dotProduct = 0;
  for (const [dim, valA] of vecA.entries()) {
    const valB = vecB.get(dim);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }
  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Step 5: Temporal Decay Calculation
 * Applies exponential decay giving higher relevance to items interacted with this week vs 6 months ago.
 * Formula: decay(dt) = exp(-dt / halfLifeDays) * 0.6 + 0.4 (floor at 0.4)
 */
export function calculateTemporalDecay(interactedAtTimestamp: number): number {
  if (!interactedAtTimestamp) return 0.7;
  const now = Date.now();
  const diffDays = Math.max(0, (now - interactedAtTimestamp) / (1000 * 60 * 60 * 24));
  // 45 day half-life with a 0.4 baseline floor so classics aren't completely erased
  const decay = Math.exp(-diffDays / 45) * 0.6 + 0.4;
  return Math.min(1.0, Math.max(0.4, decay));
}

/**
 * Orchestrates Steps 3, 4, 5:
 * Content Graph Generation -> Latent Semantic Similarity -> Negative Filtering & Temporal Decay -> Re-Ranking into Categorized Rows
 */
export async function generateFullRecommendationPipeline(
  watchHistory: WatchHistoryItem[],
  likedMedia: MediaItem[],
  userRatings: UserRatingItem[] = [],
  options?: {
    preferredType?: MediaType;
  }
): Promise<CuratedRecommendationRows> {
  // Step 2: Compute Unified Taste Matrix
  const matrix: TasteMatrixProfile = computeUnifiedInteractionMatrix(
    watchHistory,
    likedMedia,
    userRatings
  );

  // If cold-start (no interactions yet), return empty sets
  if (matrix.itemCount === 0) {
    return {
      topPicks: [],
      dominantGenres: [],
      totalCandidatePoolCount: 0,
      modelTimestamp: Date.now(),
    };
  }

  // Build exclusion set: all watched, liked, and rated items
  const completedIds = new Set<number>();
  watchHistory.forEach((w) => completedIds.add(w.id));
  likedMedia.forEach((l) => completedIds.add(l.id));
  userRatings.forEach((r) => completedIds.add(r.id));
  matrix.hardFilteredIds.forEach((h) => completedIds.add(h));

  // Step 3: Run Content-Based Graph Generator (yields ~100-150 fresh candidates)
  const graphResult: ContentGraphResult = await generateContentGraphCandidates(matrix, {
    preferredType: options?.preferredType,
    limit: 140,
    excludedIds: completedIds,
  });

  // Step 4: Construct User Latent Taste Profile Vector
  // Fuse composite text (title + synopsis + subgenres + keywords) from top positive seed items
  const userLatentProfile = new Map<number, number>();
  let totalUserWeight = 0;

  for (const seed of matrix.positiveSeeds.slice(0, 8)) {
    const decay = calculateTemporalDecay(seed.lastInteractedAt);
    const weight = seed.normalizedWeight * decay;
    totalUserWeight += weight;

    const genreText = (seed.genre_ids || []).map((id) => GENRE_MAP[id] || '').filter(Boolean);
    const seedTags = [...(seed.subgenres || []), ...(seed.clusters || []), ...genreText];
    const seedVector = createLatentSemanticVector(seed.title, seed.overview || '', seedTags);

    for (const [dim, val] of seedVector.entries()) {
      userLatentProfile.set(dim, (userLatentProfile.get(dim) || 0) + val * weight);
    }
  }

  // Normalize user profile vector
  if (totalUserWeight > 0) {
    for (const [dim, val] of userLatentProfile.entries()) {
      userLatentProfile.set(dim, val / totalUserWeight);
    }
  }

  // Step 5: Re-Ranking Layer, Negative Filtering & Diversity Balancing
  const scoredPool: ScoredRecommendationItem[] = [];

  const { dislikedDirectorNames } =
    graphResult.negativeGraphEntities;

  for (const candidate of graphResult.candidates) {
    const item = candidate.item;

    // Rule 1: Strict Deduplication (Skip if already completed)
    if (completedIds.has(item.id)) continue;

    // Rule 2: Negative Filtering: Filter out candidates sharing disliked directors or cast
    if (candidate.matchedDirector && dislikedDirectorNames.includes(candidate.matchedDirector)) {
      continue;
    }

    // Temporal decay associated with the seed that spawned this candidate
    const seedItem = matrix.interactions.find((i) => i.title === candidate.sourceSeedTitle);
    const temporalDecay = seedItem
      ? calculateTemporalDecay(seedItem.lastInteractedAt)
      : 0.85;

    // Enrich candidate with our 60,919 pre-trained title dataset
    const knownData = await getKnownTitleTags(item.id, item.media_type || 'movie');
    const enrichedSubgenres = Array.from(new Set([...(candidate.matchedSubgenres || []), ...(knownData.subgenres || [])]));
    const enrichedClusters = Array.from(new Set([...(candidate.matchedClusters || []), ...(knownData.clusters || [])]));
    const enrichedTags = Array.from(new Set([...(candidate.matchedKeywords || []), ...(knownData.tags || [])]));

    // Step 4 Latent Narrative Similarity: Compute dot product against candidate vector
    const candidateTags = [
      ...enrichedSubgenres,
      ...enrichedClusters,
      ...enrichedTags,
      ...(candidate.matchedGenres || []),
    ];
    const candidateVector = createLatentSemanticVector(item.title, item.overview || '', candidateTags);
    const latentSim = computeCosineSimilarity(userLatentProfile, candidateVector);

    // Hybrid Scoring Formula:
    // 45% Content Graph Score + 35% Latent Narrative Similarity + 20% TMDB Quality/Popularity
    const normalizedGraphScore = Math.min(25, candidate.graphScore) / 25; // [0, 1]
    const ratingScore = Math.min(10, Math.max(0, item.vote_average || 7.0)) / 10; // [0, 1]

    const hybridScore =
      (normalizedGraphScore * 0.45 + latentSim * 0.35 + ratingScore * 0.2) *
      temporalDecay;

    // Build human-explainable attribution tags
    const tags: string[] = [];
    if (enrichedSubgenres.length > 0) {
      tags.push(enrichedSubgenres[0]);
    }
    if (enrichedClusters.length > 0 && tags.length < 3) {
      tags.push(enrichedClusters[0]);
    }
    const resolvedDirector = candidate.matchedDirector || knownData.director;
    if (resolvedDirector) tags.push(`Dir. ${resolvedDirector}`);
    if (candidate.matchedDirectRec && tags.length < 3) tags.push('Direct Match');
    if (enrichedTags.length > 0 && tags.length < 3) {
      tags.push(enrichedTags[0]);
    }
    if (candidate.matchedGenres.length > 0 && tags.length < 3) {
      tags.push(candidate.matchedGenres[0]);
    }

    scoredPool.push({
      item,
      hybridScore,
      contentGraphScore: candidate.graphScore,
      latentSimilarityScore: latentSim,
      temporalDecayFactor: temporalDecay,
      seedTitle: candidate.sourceSeedTitle,
      matchReason: candidate.matchExplanations[0] || `Recommended for you`,
      attributionTags: tags.slice(0, 3),
      matchedSubgenres: enrichedSubgenres,
      matchedCluster: enrichedClusters[0],
    });
  }

  // Sort candidate pool by final hybrid score
  scoredPool.sort((a, b) => b.hybridScore - a.hybridScore);

  // Step 5 Rule 4: Category Grouping
  // 1. "Top Picks for You" (highest overall hybrid score)
  const topPicks = scoredPool.slice(0, 20);

  // 2. "Because You Watched [Title]" (highest single-seed similarity for top seed)
  let becauseYouWatched: { seedTitle: string; items: ScoredRecommendationItem[] } | undefined =
    undefined;

  if (matrix.positiveSeeds.length > 0) {
    const primarySeed = matrix.positiveSeeds[0];
    const seedCandidates = scoredPool
      .filter((s) => s.seedTitle === primarySeed.title)
      .slice(0, 14);

    if (seedCandidates.length >= 4) {
      becauseYouWatched = {
        seedTitle: primarySeed.title,
        items: seedCandidates,
      };
    } else {
      // Fallback: any seed with >= 4 matched candidates
      const seedGroups = new Map<string, ScoredRecommendationItem[]>();
      for (const item of scoredPool) {
        if (item.seedTitle) {
          const list = seedGroups.get(item.seedTitle) || [];
          list.push(item);
          seedGroups.set(item.seedTitle, list);
        }
      }
      for (const [title, list] of seedGroups.entries()) {
        if (list.length >= 4) {
          becauseYouWatched = {
            seedTitle: title,
            items: list.slice(0, 14),
          };
          break;
        }
      }
    }
  }

  // 3. "Hidden Gems in [Your #1 Genre]" (high vote average, moderate popularity)
  let hiddenGems: { genreName: string; genreId: number; items: ScoredRecommendationItem[] } | undefined =
    undefined;

  if (matrix.topGenres.length > 0) {
    const topGenre = matrix.topGenres[0];
    const gemCandidates = scoredPool
      .filter((s) => {
        const item = s.item;
        const hasGenre = item.genre_ids && item.genre_ids.includes(topGenre.id);
        const isHighRated = (item.vote_average || 0) >= 7.2;
        const isModeratePop = (item.vote_count || 0) < 4500;
        return hasGenre && isHighRated && isModeratePop;
      })
      .slice(0, 14);

    if (gemCandidates.length >= 3) {
      hiddenGems = {
        genreName: topGenre.name,
        genreId: topGenre.id,
        items: gemCandidates,
      };
    }
  }

  return {
    topPicks,
    becauseYouWatched,
    hiddenGems,
    dominantGenres: matrix.topGenres.slice(0, 4).map((g) => g.name),
    totalCandidatePoolCount: scoredPool.length,
    modelTimestamp: Date.now(),
  };
}
