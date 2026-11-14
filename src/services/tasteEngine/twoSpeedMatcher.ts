import type { MediaItem } from '../../types/movie';
import type { GraphCandidate } from './graphTraversal';
import { calculateUnifiedMatchScore } from './matchScorer';
import {
  computeSessionAlpha,
  isSessionActive,
  type ActiveSessionState,
} from './sessionState';
import type { UserTasteProfile } from './types';

export interface ScoredTwoSpeedCandidate {
  item: MediaItem;
  finalScore: number;        // Normalized 0.0 - 1.0 for precise ranking
  matchPercentage: number;   // Calibrated 75% - 99%
  label: string;             // e.g. "96% Match"
  attributionReason: string; // e.g. "Directed by Christopher Nolan", "Shared Theme: Mind-Bending Sci-Fi"
  hopLevel: 1 | 2;
  primaryEdge: string;
  isPersonalized: boolean;
}

/**
 * Two-Speed Gated Fusion Matcher
 * 
 * Fuses immediate session graph proximity with all-time taste profile:
 * FinalScore = alpha * SessionScore + (1 - alpha) * BaseScore
 * 
 * Where alpha in [0.20, 0.75] dynamically decays based on session recency.
 */
export function scoreTwoSpeedCandidate(
  candidate: GraphCandidate,
  sessionState?: ActiveSessionState | null,
  baseProfile?: UserTasteProfile | null
): ScoredTwoSpeedCandidate {
  const item = candidate.item;
  const baseResult = calculateUnifiedMatchScore(item, baseProfile);
  const baseScore = baseResult.percentage / 100; // 0.50 - 0.98

  let finalScore = baseScore;
  let isPersonalized = baseResult.isPersonalized;
  let attributionReason = candidate.edgeEntityName || '';

  if (sessionState && isSessionActive(sessionState) && sessionState.activeSeed) {
    const alpha = computeSessionAlpha(sessionState.lastActivityTimestamp);

    // Graph proximity is already weighted: Director=1.0, Cast=0.85, Trope=0.75, Hop2=0.62
    let sessionScore = candidate.graphProximityScore;

    // Check sliding window coherence: bonus if candidate also matches secondary session items
    const secondaryItems = sessionState.interactions.slice(1);
    for (let i = 0; i < secondaryItems.length; i++) {
      const sec = secondaryItems[i];
      if (sec.genre_ids && item.genre_ids) {
        const hasGenreOverlap = sec.genre_ids.some((gid) => item.genre_ids?.includes(gid));
        if (hasGenreOverlap) {
          // Add small trajectory continuity boost (0.05 for item 1, 0.025 for item 2)
          sessionScore += (0.05 / (i + 1));
        }
      }
    }
    sessionScore = Math.min(1.0, sessionScore);

    // Gated Two-Speed Fusion
    finalScore = alpha * sessionScore + (1 - alpha) * baseScore;
    isPersonalized = true;

    // Build intelligent attribution reason
    if (!attributionReason) {
      if (candidate.primaryEdge === 'director') {
        attributionReason = 'Directed by your active session auteur';
      } else if (candidate.primaryEdge === 'cast') {
        attributionReason = 'Starring familiar ensemble cast';
      } else if (candidate.primaryEdge === 'recommendation') {
        attributionReason = `Because you watched ${sessionState.activeSeed.title}`;
      } else if (baseResult.matchedThemes && baseResult.matchedThemes.length > 0) {
        attributionReason = `Shared Theme: ${baseResult.matchedThemes[0]}`;
      } else {
        attributionReason = `Tailored to your current viewing momentum`;
      }
    }
  } else {
    // Session is inactive or expired: base profile dominates
    if (!attributionReason) {
      if (baseResult.matchedThemes && baseResult.matchedThemes.length > 0) {
        attributionReason = `Shared Theme: ${baseResult.matchedThemes[0]}`;
      } else if (baseProfile?.topThemes && baseProfile.topThemes.length > 0) {
        attributionReason = `Curated for your love of ${baseProfile.topThemes[0].name}`;
      } else if (baseProfile?.topGenres && baseProfile.topGenres.length > 0) {
        attributionReason = `Top pick in ${baseProfile.topGenres[0].name}`;
      } else {
        attributionReason = 'Recommended for you';
      }
    }
  }

  // Calibrate final match percentage to the 75% - 99% range
  // Minimum quality floor is 75%, top-tier hits reach 97-99%
  const matchPercentage = Math.min(
    99,
    Math.max(75, Math.round(75 + finalScore * 24))
  );

  return {
    item,
    finalScore,
    matchPercentage,
    label: `${matchPercentage}% Match`,
    attributionReason,
    hopLevel: candidate.hopLevel,
    primaryEdge: candidate.primaryEdge,
    isPersonalized,
  };
}

