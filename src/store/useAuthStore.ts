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

          // Isolate per-user state: load this user's DB records directly
          useStreamStore.setState({
            watchHistory,
            likedMedia,
            userRatings: ratings,
            watchlist,
          });

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
            const filteredWatchlist = data.watchlist || [];

            // Load authenticated user's records from DB into client state
            useStreamStore.setState({
              watchHistory: filteredHistory,
              likedMedia: filteredLikes,
              userRatings: filteredRatings,
              watchlist: filteredWatchlist,
            });

            // If remote DB had items that were locally deleted, push sanitized state back immediately
            if (deletedSet.size > 0) {
              import('../services/edgeSync')
                .then((m) => {
                  m.syncToEdgeImmediately(filteredHistory, filteredLikes, filteredRatings, filteredWatchlist);
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
