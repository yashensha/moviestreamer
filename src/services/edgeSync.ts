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

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('moviewatcher_auth_token');
};

let syncTimeout: any = null;

/**
 * Syncs the current watch history and liked titles to the Cloudflare D1 / dev database.
 * Debounced to prevent excessive network requests.
 */
export const syncToEdge = (
  watchHistory: WatchHistoryItem[],
  likedMedia: MediaItem[],
  userRatings: any[] = []
) => {
  if (typeof window === 'undefined') return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    try {
      const userId = getUserId();
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch('/api/user/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          watchHistory,
          likedMedia,
          userRatings,
        }),
      });
    } catch {
      // Silently ignore if offline
    }
  }, 1000);
};

/**
 * Immediate sync without debounce (used when user navigates or completes an action).
 */
export const syncToEdgeImmediately = async (
  watchHistory: WatchHistoryItem[],
  likedMedia: MediaItem[],
  userRatings: any[] = []
): Promise<void> => {
  if (typeof window === 'undefined') return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  try {
    const userId = getUserId();
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/user/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        watchHistory,
        likedMedia,
        userRatings,
      }),
    });
  } catch {
    // Silently ignore if offline
  }
};

/**
 * Reliable exit synchronization using sendBeacon or keepalive fetch.
 * Runs on window beforeunload, pagehide, or when exiting the player.
 */
export const syncOnExit = (
  watchHistory: WatchHistoryItem[],
  likedMedia: MediaItem[],
  userRatings: any[] = []
): void => {
  if (typeof window === 'undefined') return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }

  try {
    const userId = getUserId();
    const token = getAuthToken();
    const payload = JSON.stringify({
      userId,
      watchHistory,
      likedMedia,
      userRatings,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/user/sync', blob);
    } else {
      fetch('/api/user/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently ignore
  }
};

/**
 * Fetches the user's stored model and preferences from Cloudflare D1.
 */
export const fetchEdgeModel = async () => {
  try {
    const userId = getUserId();
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/user/model?userId=${encodeURIComponent(userId)}`, {
      headers,
    });
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
  } catch {
    // Silently ignore
  }
  return null;
};

/**
 * Initializes auto-synchronization:
 * Listens to Zustand store changes and automatically updates the database for the active user.
 */
export const initEdgeSync = () => {
  if (typeof window === 'undefined') return;

  // Subscribe to reactive store changes
  useStreamStore.subscribe((state) => {
    syncToEdge(state.watchHistory, state.likedMedia, state.userRatings);
  });
};
