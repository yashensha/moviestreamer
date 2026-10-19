// ==============================================================================
// Playback Storage & State Persistence Service
// Manages local storage persistence and DB sync on exit for continue playback
// ==============================================================================

import { useStreamStore } from '../store/useStreamStore';
import { syncOnExit, syncToEdgeImmediately } from './edgeSync';

export interface PlaybackRecord {
  seconds: number;
  duration?: number;
  season?: number;
  episode?: number;
  updatedAt: number;
}

const getStorageKey = (
  mediaId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): string => {
  if (type === 'tv' && season && episode) {
    return `moviewatcher_playback_tv_${mediaId}_s${season}_e${episode}`;
  }
  return `moviewatcher_playback_${type}_${mediaId}`;
};

/**
 * Saves current playback position to localStorage and updates Zustand store.
 */
let lastStoreUpdateMs = 0;

export const savePlaybackTime = (
  mediaId: number,
  type: 'movie' | 'tv',
  seconds: number,
  duration?: number,
  season?: number,
  episode?: number,
  forceStoreUpdate = false
): void => {
  if (typeof window === 'undefined' || !mediaId || seconds < 0) return;

  const validSeconds = Math.floor(seconds);
  const validDuration = duration && duration > 0 ? Math.floor(duration) : undefined;
  const now = Date.now();

  const record: PlaybackRecord = {
    seconds: validSeconds,
    duration: validDuration,
    season,
    episode,
    updatedAt: now,
  };

  try {
    // 1. Save general media key
    const generalKey = `moviewatcher_playback_${type}_${mediaId}`;
    localStorage.setItem(generalKey, JSON.stringify(record));

    // 2. If TV series with season/episode, also save specific episode key
    if (type === 'tv' && season && episode) {
      const episodeKey = getStorageKey(mediaId, 'tv', season, episode);
      localStorage.setItem(episodeKey, JSON.stringify(record));
    }
  } catch (err) {
    console.warn('[playbackStorage] Error saving to localStorage:', err);
  }

  // 3. Update Zustand stream store (throttled to at most once per 10s during playback, or immediate on exit/force)
  if (forceStoreUpdate || now - lastStoreUpdateMs >= 10000) {
    lastStoreUpdateMs = now;
    useStreamStore.getState().updatePlaybackProgress(
      mediaId,
      type,
      validSeconds,
      validDuration,
      season,
      episode
    );
  }
};

/**
 * Retrieves the saved playback position from localStorage or store.
 */
export const getSavedPlaybackTime = (
  mediaId: number,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): PlaybackRecord | null => {
  if (typeof window === 'undefined' || !mediaId) return null;

  try {
    // 1. If TV and season/episode specified, check episode-specific key only
    if (type === 'tv' && season && episode) {
      const epKey = getStorageKey(mediaId, 'tv', season, episode);
      const raw = localStorage.getItem(epKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.seconds === 'number' && parsed.seconds > 5) {
          if (
            (parsed.season === undefined || parsed.season === season) &&
            (parsed.episode === undefined || parsed.episode === episode)
          ) {
            return parsed;
          }
        }
      }

      // Check Zustand store specifically for this episode
      const storeSeconds = useStreamStore.getState().getPlaybackProgress(mediaId, type, season, episode);
      if (typeof storeSeconds === 'number' && storeSeconds > 5) {
        return {
          seconds: Math.floor(storeSeconds),
          season,
          episode,
          updatedAt: Date.now(),
        };
      }

      // STRICT: A specific TV episode must NEVER fall back to another episode or general show progress!
      return null;
    }

    // 2. Check general media key (only for movies, or TV when NO season/episode is specified)
    const generalKey = `moviewatcher_playback_${type}_${mediaId}`;
    const raw = localStorage.getItem(generalKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.seconds === 'number' && parsed.seconds > 5) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[playbackStorage] Error reading from localStorage:', err);
  }

  // 3. Fallback to Zustand store
  const storeSeconds = useStreamStore.getState().getPlaybackProgress(mediaId, type, season, episode);
  if (typeof storeSeconds === 'number' && storeSeconds > 5) {
    return {
      seconds: Math.floor(storeSeconds),
      season,
      episode,
      updatedAt: Date.now(),
    };
  }

  return null;
};

/**
 * Synchronizes playback position and watch history to the database immediately on exit.
 */
export const syncPlaybackToDbOnExit = (): void => {
  const store = useStreamStore.getState();
  syncOnExit(store.watchHistory, store.likedMedia, store.userRatings);
};

/**
 * Flush sync to edge database (used on component unmount within app).
 */
export const flushPlaybackSync = async (): Promise<void> => {
  const store = useStreamStore.getState();
  await syncToEdgeImmediately(store.watchHistory, store.likedMedia, store.userRatings);
};
