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
 * Syncs the current watch history and liked titles to the Cloudflare D1 database.
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
      const token = getAuthToken();
      // Only sync to database when user is authenticated so guest data does not overwrite user DB
      if (!token) return;

      const userId = getUserId();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

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
    const token = getAuthToken();
    if (token) {
      syncToEdge(state.watchHistory, state.likedMedia, state.userRatings);
    }
  });
};
