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

          const data = await res.json();
          if (!res.ok || !data.success) {
            const msg = data.error || 'Failed to sign in. Please verify your credentials.';
            set({ isLoading: false, error: msg });
            return { success: false, error: msg };
          }

          const { token, user, watchHistory = [], likedMedia = [] } = data;

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

          // Sync cloud history & likes into client Zustand store (merge with current)
          const currentStore = useStreamStore.getState();
          
          // Merge watch history without duplicates
          const mergedHistoryMap = new Map();
          for (const item of watchHistory) {
            mergedHistoryMap.set(`${item.type}:${item.id}`, item);
          }
          for (const item of currentStore.watchHistory) {
            if (!mergedHistoryMap.has(`${item.type}:${item.id}`)) {
              mergedHistoryMap.set(`${item.type}:${item.id}`, item);
            }
          }

          // Merge likes without duplicates
          const mergedLikesMap = new Map();
          for (const item of likedMedia) {
            mergedLikesMap.set(item.id, item);
          }
          for (const item of currentStore.likedMedia) {
            if (!mergedLikesMap.has(item.id)) {
              mergedLikesMap.set(item.id, item);
            }
          }

          useStreamStore.setState({
            watchHistory: Array.from(mergedHistoryMap.values()),
            likedMedia: Array.from(mergedLikesMap.values()),
          });

          return { success: true };
        } catch (err: any) {
          const msg = err.message || 'Connection error while signing in.';
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

          const data = await res.json();
          if (!res.ok || !data.success) {
            const msg = data.error || 'Registration failed.';
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

          return { success: true };
        } catch (err: any) {
          const msg = err.message || 'Connection error while creating account.';
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
        // Reset to new guest session
        const newGuestId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('moviewatcher_user_id', newGuestId);

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

          if (!res.ok) {
            // Invalid or expired session
            localStorage.removeItem('moviewatcher_auth_token');
            set({ user: null, token: null });
            return;
          }

          const data = await res.json();
          if (data.success && data.user) {
            set({ user: data.user, token });
            localStorage.setItem('moviewatcher_user_id', data.user.id);

            // Restore cloud history if client history is empty
            const currentHistory = useStreamStore.getState().watchHistory;
            if (currentHistory.length === 0 && data.watchHistory?.length > 0) {
              useStreamStore.setState({
                watchHistory: data.watchHistory,
                likedMedia: data.likedMedia || [],
              });
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
