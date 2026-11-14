import type { MediaType } from '../../types/movie';

export interface SessionInteraction {
  id: number;
  title: string;
  media_type: MediaType;
  action: 'complete' | 'rate' | 'heart' | 'progress' | 'dwell';
  weight: number; // 1.0 = completed watch, 0.9 = rating >=4/heart, 0.7 = progress >10m, 0.35 = dwell
  timestamp: number;
  director?: string;
  cast?: string[];
  genre_ids?: number[];
}

export interface ActiveSessionState {
  interactions: SessionInteraction[];
  lastActivityTimestamp: number;
  activeSeed: SessionInteraction | null;
}

export const SESSION_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
export const MAX_SESSION_WINDOW = 3;

/**
 * Standard decay weights for the sliding window:
 * Item 0 (most recent seed): 1.0
 * Item 1: 0.50
 * Item 2: 0.25
 */
export const SESSION_WINDOW_WEIGHTS = [1.0, 0.5, 0.25];

export function getInitialSessionState(): ActiveSessionState {
  return {
    interactions: [],
    lastActivityTimestamp: 0,
    activeSeed: null,
  };
}

/**
 * Checks whether the session is currently active and unexpired
 */
export function isSessionActive(state?: ActiveSessionState | null): boolean {
  if (!state || !state.lastActivityTimestamp || state.interactions.length === 0) {
    return false;
  }
  const elapsed = Date.now() - state.lastActivityTimestamp;
  return elapsed >= 0 && elapsed <= SESSION_TIMEOUT_MS;
}

/**
 * Calculates dynamic intent fusion weight alpha:
 * alpha(0) = 0.75 (strong immediate rabbit-hole priming)
 * alpha decays over a 2-hour half-life toward a floor of 0.20
 * When expired, alpha = 0.0 (pure long-term profile)
 */
export function computeSessionAlpha(lastActivityTimestamp?: number): number {
  if (!lastActivityTimestamp) return 0.0;
  const elapsed = Date.now() - lastActivityTimestamp;
  if (elapsed < 0 || elapsed > SESSION_TIMEOUT_MS) return 0.0;

  const halfLifeMs = 2 * 60 * 60 * 1000; // 2 hours
  const decayFactor = Math.exp(-elapsed / halfLifeMs);
  const alpha = 0.20 + 0.55 * decayFactor;
  return Math.min(0.75, Math.max(0.20, alpha));
}

/**
 * Ingests an interaction event into the sliding window.
 * Drops expired sessions, deduplicates by media ID, and updates the active seed.
 */
export function addSessionInteraction(
  current: ActiveSessionState | undefined | null,
  event: Omit<SessionInteraction, 'timestamp'>
): ActiveSessionState {
  const now = Date.now();
  let baseInteractions: SessionInteraction[] = [];

  if (current && isSessionActive(current)) {
    // Keep unexpired interactions, excluding duplicate of this ID
    baseInteractions = current.interactions.filter((i) => i.id !== event.id);
  }

  const newEntry: SessionInteraction = {
    ...event,
    timestamp: now,
  };

  const updatedInteractions = [newEntry, ...baseInteractions].slice(0, MAX_SESSION_WINDOW);

  // Active seed is the most recent qualifying item (weight >= 0.7) or simply the top item
  const activeSeed =
    updatedInteractions.find((i) => i.weight >= 0.7) || updatedInteractions[0] || null;

  return {
    interactions: updatedInteractions,
    lastActivityTimestamp: now,
    activeSeed,
  };
}

