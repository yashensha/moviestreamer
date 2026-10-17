// ==============================================================================
// Edge Synchronization Service for Cloudflare Pages & D1 Database
// Connects Zustand client state to Cloudflare D1 edge database
// ==============================================================================

import { useStreamStore } from '../store/useStreamStore';
import type { WatchHistoryItem, MediaItem } from '../types/movie';

const USER_ID_KEY = 'moviewatcher_user_id';

/**
 * Gets or creates a unique persistent user/session identifier.
 * Stored in localStorage so preferences persist across sessions.
 */
export const getUserId = (): string => {
  if (typeof window === 'undefined') return 'server_session';
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

let syncTimeout: any = null;

/**
 * Syncs the current watch history and liked titles to the Cloudflare D1 database.
 * Debounced to prevent excessive network requests.
 */
export const syncToEdge = (
  watchHistory: WatchHistoryItem[],
  likedMedia: MediaItem[]
) => {
  if (typeof window === 'undefined') return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    try {
      const userId = getUserId();
      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          watchHistory,
          likedMedia,
        }),
      });
    } catch {
      // Silently ignore in local dev if D1 functions are not being simulated
    }
  }, 1200);
};

/**
 * Fetches the user's stored model and preferences from Cloudflare D1.
 */
export const fetchEdgeModel = async () => {
  try {
    const userId = getUserId();
    const res = await fetch(`/api/user/model?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Silently ignore
  }
  return null;
};

/**
 * Initializes auto-synchronization:
 * Listens to Zustand store changes and automatically updates the D1 database on the edge.
 */
export const initEdgeSync = () => {
  if (typeof window === 'undefined') return;

  // Initial sync attempt
  const state = useStreamStore.getState();
  if (state.watchHistory.length > 0 || state.likedMedia.length > 0) {
    syncToEdge(state.watchHistory, state.likedMedia);
  }

  // Subscribe to reactive store changes
  useStreamStore.subscribe((state) => {
    syncToEdge(state.watchHistory, state.likedMedia);
  });
};
