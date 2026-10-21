import type { MediaItem } from '../../types/movie';
import { resolveMovieGenomeSync } from './genome';
import type { MovieGenome, UserTasteProfile, UnifiedMatchResult } from './types';

/**
 * Calculates overlap between an item's tags and the user's weighted profile.
 * Measures tag strength relative to the user's TOP-TIER favorites (benchmark weight)
 * so that a user's core loves generate 90%+, while casual or accidental tags stay modest (60%-75%).
 */
function calculateTierAffinity(
  itemTags: string[],
  userWeights: Map<string, number>,
  benchmarkWeight: number = 10.0
): number {
  if (itemTags.length === 0 || userWeights.size === 0 || benchmarkWeight <= 0) return 0;
  let totalScore = 0;

  for (const tag of itemTags) {
    const w = userWeights.get(tag);
    if (w && w > 0) {
      // Relative score: How significant is this tag compared to the user's favorite top tags?
      const relativeStrength = Math.min(1.0, w / benchmarkWeight);
      totalScore += relativeStrength;
    }
  }

  if (totalScore <= 0) return 0;

  // Saturation curve:
  // 1 strong matching tag (~1.0 strength) = ~0.50
  // 2 strong matching tags (~2.0 strength) = ~0.75
  // 3+ strong matching tags = ~0.90+
  const normalized = 1 - Math.exp(-totalScore * 0.7);
  return Math.min(1.0, Math.max(0, normalized));
}

/**
 * Calculates broad genre affinity relative to top genre benchmarks
 */
function calculateGenreAffinity(
  genreIds: number[],
  userGenreWeights: Map<number, number>,
  benchmarkWeight: number = 10.0
): number {
  if (genreIds.length === 0 || userGenreWeights.size === 0 || benchmarkWeight <= 0) return 0;
  let totalScore = 0;

  for (const gid of genreIds) {
    const w = userGenreWeights.get(gid);
    if (w && w > 0) {
      totalScore += Math.min(1.0, w / benchmarkWeight);
    }
  }

  if (totalScore <= 0) return 0;
  const normalized = 1 - Math.exp(-totalScore * 0.6);
  return Math.min(1.0, Math.max(0, normalized));
}

/**
 * Single Canonical Source of Truth for "% Match" across cards, modals, and detail views.
 * 
 * Hierarchy:
 * - 40% Themes (Letterboxd narrative & emotional themes)
 * - 30% Microgenres (Letterboxd nanogenres & curated subgenres)
 * - 20% Thematic Keywords (TMDB & MovieLens plot tropes)
 * - 10% Broad Genres (TMDB classification)
 */
export function calculateUnifiedMatchScore(
  item: MediaItem,
  profile?: UserTasteProfile | null
): UnifiedMatchResult {
  const voteAvg = item.vote_average || 7.0;

  // Cold Start: When user has no interactions yet
  if (!profile || profile.totalInteractions === 0) {
    // Bayesian prior centered around 82%
    const coldScore = Math.min(94, Math.max(72, Math.round(82 + (voteAvg - 6.5) * 3.0)));
    return {
      percentage: coldScore,
      label: `${coldScore}% Match`,
      isPersonalized: false,
    };
  }

  const genome: MovieGenome = resolveMovieGenomeSync(
    item.id,
    (item.media_type as any) || 'movie',
    item
  );

  // Dynamic Benchmark Weights (average of user's top 3-5 favorites in each tier)
  const themeBenchmark =
    profile.topThemes.slice(0, 5).reduce((acc, t) => acc + t.score, 0) /
      Math.max(1, Math.min(5, profile.topThemes.length)) || 10.0;

  const microgenreBenchmark =
    profile.topMicrogenres.slice(0, 5).reduce((acc, m) => acc + m.score, 0) /
      Math.max(1, Math.min(5, profile.topMicrogenres.length)) || 10.0;

  const keywordBenchmark = Math.max(5.0, themeBenchmark * 0.4);

  const genreBenchmark =
    profile.topGenres.slice(0, 3).reduce((acc, g) => acc + g.score, 0) /
      Math.max(1, Math.min(3, profile.topGenres.length)) || 10.0;

  // 1. Compute 4-tier affinities relative to user benchmarks
  const themeAffinity = calculateTierAffinity(genome.themes, profile.themeWeights, themeBenchmark);
  const microgenreAffinity = calculateTierAffinity(genome.microgenres, profile.microgenreWeights, microgenreBenchmark);
  const keywordAffinity = calculateTierAffinity(genome.keywords, profile.keywordWeights, keywordBenchmark);
  const genreAffinity = calculateGenreAffinity(item.genre_ids || [], profile.genreWeights, genreBenchmark);

  // Check if title is an explicit favorite (Heart / 5★ rating)
  const isDirectFavorite = profile.positiveSeeds.some((s) => s.id === item.id);

  // 2. Multi-tier composite affinity
  const rawAffinity =
    0.40 * themeAffinity +
    0.30 * microgenreAffinity +
    0.20 * keywordAffinity +
    0.10 * genreAffinity;

  // Track matched themes and microgenres for explanation badges
  const matchedThemes = genome.themes.filter((t) => profile.themeWeights.has(t));
  const matchedMicrogenres = genome.microgenres.filter((m) => profile.microgenreWeights.has(m));

  let finalPercentage: number;

  if (isDirectFavorite) {
    finalPercentage = 98;
  } else if (rawAffinity >= 0.70) {
    // Top-tier match (Elite favorite alignment): 93% - 97%
    finalPercentage = Math.round(93 + ((rawAffinity - 0.70) / 0.30) * 4);
  } else if (rawAffinity >= 0.45) {
    // Strong match: 86% - 92%
    finalPercentage = Math.round(86 + ((rawAffinity - 0.45) / 0.25) * 6);
  } else if (rawAffinity >= 0.25) {
    // Good match: 78% - 85%
    finalPercentage = Math.round(78 + ((rawAffinity - 0.25) / 0.20) * 7);
  } else if (rawAffinity >= 0.10) {
    // Moderate / Occasional match: 68% - 77%
    finalPercentage = Math.round(68 + ((rawAffinity - 0.10) / 0.15) * 9);
  } else if (rawAffinity > 0.0) {
    // Minor / Tangential match: 58% - 67%
    finalPercentage = Math.round(58 + (rawAffinity / 0.10) * 9);
  } else {
    // Unmatched / Out-of-taste baseline fallback: 50% - 58%
    finalPercentage = Math.min(58, Math.max(50, Math.round(50 + (voteAvg - 5.0) * 2.0)));
  }

  finalPercentage = Math.min(98, Math.max(50, finalPercentage));

  return {
    percentage: finalPercentage,
    label: `${finalPercentage}% Match`,
    isPersonalized: true,
    affinityBreakdown: {
      themeAffinity,
      microgenreAffinity,
      keywordAffinity,
      genreAffinity,
    },
    matchedThemes,
    matchedMicrogenres,
  };
}
