import type { MediaItem, MediaType } from '../../types/movie';

/**
 * 4-Tier Movie/TV Genome
 * Weights:
 * - Themes: 40% (Letterboxd Narrative & Emotional Themes)
 * - Microgenres: 30% (Letterboxd Nanogenres & Curated Subgenres)
 * - Keywords: 20% (TMDB & MovieLens Specific Plot Tropes)
 * - Genres: 10% (TMDB Broad Classification)
 */
export interface MovieGenome {
  id: number;
  title: string;
  media_type: MediaType;
  themes: string[];       // Tier 1 (40%)
  microgenres: string[];  // Tier 2 (30%)
  keywords: string[];     // Tier 3 (20%)
  genres: string[];       // Tier 4 (10%)
  director?: string;
  cast?: string[];
}

export interface UserTasteProfile {
  totalInteractions: number;
  positiveSeeds: MovieGenome[];
  excludedIds: Set<number>;
  dislikedDirectorNames: Set<string>;
  
  // Normalized 4-tier vector weights
  themeWeights: Map<string, number>;
  microgenreWeights: Map<string, number>;
  keywordWeights: Map<string, number>;
  genreWeights: Map<number, number>;

  // Attributed top favorites for explaining matches
  topThemes: Array<{ name: string; score: number }>;
  topMicrogenres: Array<{ name: string; score: number }>;
  topGenres: Array<{ id: number; name: string; score: number }>;
  topDirectors: Array<{ name: string; score: number }>;

  temporalDecayFactors: Map<number, number>;
  bm25Dampener: number;
  generatedAt: number;
}

export interface UnifiedMatchResult {
  percentage: number;       // Integer clamped to 75..99
  label: string;            // "${percentage}% Match"
  isPersonalized: boolean;  // True if user taste profile was applied
  affinityBreakdown?: {
    themeAffinity: number;
    microgenreAffinity: number;
    keywordAffinity: number;
    genreAffinity: number;
  };
  matchedThemes?: string[];
  matchedMicrogenres?: string[];
}

export interface TasteEngineRows {
  topPicks: MediaItem[];
  becauseYouWatched?: {
    seedTitle: string;
    items: MediaItem[];
  };
  thematicRows: Array<{
    title: string;
    themeOrGenre: string;
    items: MediaItem[];
  }>;
  totalPoolCount: number;
}
