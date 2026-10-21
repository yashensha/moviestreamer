import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useStreamStore } from './useStreamStore';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  isLoading: boolean;
  error: string | null;

  // Modal controls
  openLoginModal: () => void;
  openRegisterModal: () => void;
  closeAuthModal: () => void;
  clearError: () => void;

  // Auth actions
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

// Helper for safely parsing JSON without throwing 'Unexpected end of JSON input'
async function safeParseResponse(res: Response): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthModalOpen: false,
      authModalMode: 'login',
      isLoading: false,
      error: null,

      openLoginModal: () => {
        set({ isAuthModalOpen: true, authModalMode: 'login', error: null });
      },

      openRegisterModal: () => {
        set({ isAuthModalOpen: true, authModalMode: 'register', error: null });
      },

      closeAuthModal: () => {
        set({ isAuthModalOpen: false, error: null });
      },

      clearError: () => {
        set({ error: null });
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          const { ok, status, data } = await safeParseResponse(res);

          if (!ok || !data?.success) {
            const msg = data?.error || (status === 404
              ? 'Account not found. Please click "Sign up now" below to create an account.'
              : 'Failed to sign in. Please verify your credentials.');
            set({ isLoading: false, error: msg });
            return { success: false, error: msg };
          }

          const { token, user, watchHistory = [], likedMedia = [], ratings = [], watchlist = [] } = data;

          // Save token & user id in localStorage
          localStorage.setItem('moviewatcher_auth_token', token);
          localStorage.setItem('moviewatcher_user_id', user.id);

          set({
            user,
            token,
            isLoading: false,
            isAuthModalOpen: false,
            error: null,
          });

          // Merge guest/local items with DB items on login so nothing is lost
          const currentStore = useStreamStore.getState();

          const mergedLikesMap = new Map<number, any>();
          likedMedia.forEach((m: any) => {
            if (m?.id) mergedLikesMap.set(Number(m.id), m);
          });
          (currentStore.likedMedia || []).forEach((m: any) => {
            if (m?.id && !mergedLikesMap.has(Number(m.id))) {
              mergedLikesMap.set(Number(m.id), m);
            }
          });
          const finalLikes = Array.from(mergedLikesMap.values());

          const mergedWatchlistMap = new Map<number, any>();
          watchlist.forEach((m: any) => {
            if (m?.id) mergedWatchlistMap.set(Number(m.id), m);
          });
          (currentStore.watchlist || []).forEach((m: any) => {
            if (m?.id && !mergedWatchlistMap.has(Number(m.id))) {
              mergedWatchlistMap.set(Number(m.id), m);
            }
          });
          const finalWatchlist = Array.from(mergedWatchlistMap.values());

          const finalHistory = watchHistory.length > 0 ? watchHistory : currentStore.watchHistory;
          const finalRatings = ratings.length > 0 ? ratings : currentStore.userRatings;

          useStreamStore.setState({
            watchHistory: finalHistory,
            likedMedia: finalLikes,
            userRatings: finalRatings,
            watchlist: finalWatchlist,
          });

          // Sync merged state immediately to server
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdgeImmediately(finalHistory, finalLikes, finalRatings, finalWatchlist);
            })
            .catch(() => {});

          return { success: true };
        } catch (err: any) {
          const msg = err?.message || 'Connection error while signing in.';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name }),
          });

          const { ok, data } = await safeParseResponse(res);

          if (!ok || !data?.success) {
            const msg = data?.error || 'Registration failed. Please try again.';
            set({ isLoading: false, error: msg });
            return { success: false, error: msg };
          }

          const { token, user } = data;

          localStorage.setItem('moviewatcher_auth_token', token);
          localStorage.setItem('moviewatcher_user_id', user.id);

          set({
            user,
            token,
            isLoading: false,
            isAuthModalOpen: false,
            error: null,
          });

          // New user starts with clean state
          useStreamStore.setState({
            watchHistory: [],
            likedMedia: [],
            userRatings: [],
            seriesProgress: {},
          });

          return { success: true };
        } catch (err: any) {
          const msg = err?.message || 'Connection error while creating account.';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }
      },

      logout: async () => {
        const token = get().token;
        if (token) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });
          } catch {
            // Ignore failure
          }
        }

        localStorage.removeItem('moviewatcher_auth_token');
        localStorage.removeItem('moviewatcher_user_id');

        // Clear user data from screen/state
        useStreamStore.getState().clearHistory();

        set({
          user: null,
          token: null,
          error: null,
        });
      },

      checkSession: async () => {
        const token = get().token || localStorage.getItem('moviewatcher_auth_token');
        if (!token) return;

        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const { ok, status, data } = await safeParseResponse(res);

          if (!ok) {
            if (status === 401) {
              localStorage.removeItem('moviewatcher_auth_token');
              localStorage.removeItem('moviewatcher_user_id');
              useStreamStore.getState().clearHistory();
              set({ user: null, token: null });
            }
            return;
          }

          if (data?.success && data.user) {
            set({ user: data.user, token });
            localStorage.setItem('moviewatcher_user_id', data.user.id);

            // Filter out any records that were explicitly deleted from watched
            const deletedSet = new Set((useStreamStore.getState().deletedWatchedIds || []).map(Number));
            const filterOutDeleted = (list: any[]) =>
              (list || []).filter((item: any) => !deletedSet.has(Number(item.id || item.media_id || item.mediaId)));

            const filteredHistory = filterOutDeleted(data.watchHistory);
            const filteredLikes = filterOutDeleted(data.likedMedia);
            const filteredRatings = filterOutDeleted(data.ratings);
            const filteredWatchlist = filterOutDeleted(data.watchlist);

            // SMART MERGE: Never clobber local likes or watchlist if local has items that haven't synced yet
            const currentStore = useStreamStore.getState();

            // 1. Merge Liked Media (preserving local additions)
            const localLikes = (currentStore.likedMedia || []).filter((item: any) => !deletedSet.has(Number(item.id)));
            const mergedLikesMap = new Map<number, any>();
            filteredLikes.forEach((item: any) => {
              if (item?.id) mergedLikesMap.set(Number(item.id), item);
            });
            localLikes.forEach((item: any) => {
              if (item?.id && !mergedLikesMap.has(Number(item.id))) {
                mergedLikesMap.set(Number(item.id), item);
              }
            });
            const mergedLikes = Array.from(mergedLikesMap.values());

            // 2. Merge Watchlist (preserving local additions)
            const localWatchlist = (currentStore.watchlist || []).filter((item: any) => !deletedSet.has(Number(item.id)));
            const mergedWatchlistMap = new Map<number, any>();
            filteredWatchlist.forEach((item: any) => {
              if (item?.id) mergedWatchlistMap.set(Number(item.id), item);
            });
            localWatchlist.forEach((item: any) => {
              if (item?.id && !mergedWatchlistMap.has(Number(item.id))) {
                mergedWatchlistMap.set(Number(item.id), item);
              }
            });
            const mergedWatchlist = Array.from(mergedWatchlistMap.values());

            // 3. Merge Watch History
            const localHistory = (currentStore.watchHistory || []).filter((item: any) => !deletedSet.has(Number(item.id)));
            const mergedHistoryMap = new Map<string, any>();
            filteredHistory.forEach((item: any) => {
              if (item?.id) mergedHistoryMap.set(`${item.type || 'movie'}:${item.id}`, item);
            });
            localHistory.forEach((item: any) => {
              const key = `${item.type || 'movie'}:${item.id}`;
              const existing = mergedHistoryMap.get(key);
              if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
                mergedHistoryMap.set(key, item);
              }
            });
            const mergedHistory = Array.from(mergedHistoryMap.values());

            // 4. Merge User Ratings
            const localRatings = (currentStore.userRatings || []).filter((item: any) => !deletedSet.has(Number(item.id)));
            const mergedRatingsMap = new Map<string, any>();
            filteredRatings.forEach((item: any) => {
              if (item?.id) mergedRatingsMap.set(`${item.type || 'movie'}:${item.id}`, item);
            });
            localRatings.forEach((item: any) => {
              const key = `${item.type || 'movie'}:${item.id}`;
              if (!mergedRatingsMap.has(key)) {
                mergedRatingsMap.set(key, item);
              }
            });
            const mergedRatings = Array.from(mergedRatingsMap.values());

            useStreamStore.setState({
              watchHistory: mergedHistory,
              likedMedia: mergedLikes,
              userRatings: mergedRatings,
              watchlist: mergedWatchlist,
            });

            // If local state had additions that the server didn't have, or items were deleted, sync back immediately
            const hadLocalAdditions =
              mergedLikes.length !== filteredLikes.length ||
              mergedWatchlist.length !== filteredWatchlist.length ||
              mergedHistory.length !== filteredHistory.length ||
              deletedSet.size > 0;

            if (hadLocalAdditions) {
              import('../services/edgeSync')
                .then((m) => {
                  m.syncToEdgeImmediately(mergedHistory, mergedLikes, mergedRatings, mergedWatchlist);
                })
                .catch(() => {});
            }
          }
        } catch {
          // Keep offline state
        }
      },
    }),
    {
      name: 'moviewatcher_auth_storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
