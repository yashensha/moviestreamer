import type { MediaItem } from '../../types/movie';
import { resolveMovieGenomeSync } from './genome';
import type { MovieGenome, UserTasteProfile, UnifiedMatchResult } from './types';

/**
 * Calculates dot-product overlap between an item's tags and the user's weighted profile
 */
function calculateTierAffinity(itemTags: string[], userWeights: Map<string, number>): number {
  if (itemTags.length === 0 || userWeights.size === 0) return 0;
  let totalScore = 0;
  let maxWeight = 0;

  for (const weight of userWeights.values()) {
    if (weight > maxWeight) maxWeight = weight;
  }
  if (maxWeight <= 0) return 0;

  for (const tag of itemTags) {
    const w = userWeights.get(tag);
    if (w) {
      totalScore += w / maxWeight; // normalized 0..1 per tag
    }
  }

  // Diminishing returns scaling: 1 match = ~0.6, 2 matches = ~0.85, 3+ matches = 1.0
  const normalized = 1 - Math.exp(-totalScore * 0.9);
  return Math.min(1.0, Math.max(0, normalized));
}

/**
 * Calculates broad genre affinity
 */
function calculateGenreAffinity(genreIds: number[], userGenreWeights: Map<number, number>): number {
  if (genreIds.length === 0 || userGenreWeights.size === 0) return 0;
  let totalScore = 0;
  let maxWeight = 0;

  for (const weight of userGenreWeights.values()) {
    if (weight > maxWeight) maxWeight = weight;
  }
  if (maxWeight <= 0) return 0;

  for (const gid of genreIds) {
    const w = userGenreWeights.get(gid);
    if (w) totalScore += w / maxWeight;
  }

  const normalized = 1 - Math.exp(-totalScore * 0.8);
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
    // Bayesian prior centered around 86%
    const coldScore = Math.min(96, Math.max(76, Math.round(85 + (voteAvg - 6.5) * 3.2)));
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

  // 1. Compute 4-tier affinities
  const themeAffinity = calculateTierAffinity(genome.themes, profile.themeWeights);
  const microgenreAffinity = calculateTierAffinity(genome.microgenres, profile.microgenreWeights);
  const keywordAffinity = calculateTierAffinity(genome.keywords, profile.keywordWeights);
  const genreAffinity = calculateGenreAffinity(item.genre_ids || [], profile.genreWeights);

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
  } else if (rawAffinity >= 0.65) {
    // Top-tier match: 94% - 99%
    finalPercentage = Math.round(94 + ((rawAffinity - 0.65) / 0.35) * 5);
  } else if (rawAffinity >= 0.35) {
    // Strong match: 88% - 93%
    finalPercentage = Math.round(88 + ((rawAffinity - 0.35) / 0.30) * 5);
  } else if (rawAffinity >= 0.10) {
    // Moderate match: 80% - 87%
    finalPercentage = Math.round(80 + ((rawAffinity - 0.10) / 0.25) * 7);
  } else {
    // Baseline quality match: 75% - 79%
    finalPercentage = Math.min(79, Math.max(75, Math.round(74 + (voteAvg - 5.0))));
  }

  finalPercentage = Math.min(99, Math.max(75, finalPercentage));

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
