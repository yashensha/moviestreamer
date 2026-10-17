import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SeriesProgress, WatchHistoryItem, MediaItem, UserRatingItem } from '../types/movie';
import { computeUnifiedInteractionMatrix } from '../services/interactionMatrix';

interface StreamState {
  // Map of seriesId -> last streamed season & episode info
  seriesProgress: Record<number, SeriesProgress>;

  // List of all items currently being watched (Continue Watching)
  watchHistory: WatchHistoryItem[];

  // List of liked/favorited media items for taste personalization
  likedMedia: MediaItem[];

  // Explicit & imported Letterboxd ratings with confidence weights
  userRatings: UserRatingItem[];

  // Actions
  saveSeriesEpisode: (
    seriesId: number,
    season: number,
    episode: number,
    meta?: {
      title?: string;
      overview?: string;
      poster_path?: string | null;
      backdrop_path?: string | null;
      release_date?: string;
      vote_average?: number;
      number_of_seasons?: number;
      genre_ids?: number[];
      genres?: { id: number; name: string }[];
    }
  ) => void;

  getSeriesLastEpisode: (
    seriesId: number
  ) => { season: number; episode: number } | undefined;

  saveMovieToHistory: (movie: MediaItem) => void;

  removeFromHistory: (id: number) => void;

  clearHistory: () => void;

  toggleLike: (item: MediaItem) => void;

  isLiked: (id: number) => boolean;

  addUserRating: (rating: UserRatingItem) => void;

  bulkAddRatings: (ratings: UserRatingItem[], syncToHistoryAndLikes?: boolean) => void;

  removeUserRating: (mediaId: number) => void;

  getUserRating: (mediaId: number) => UserRatingItem | undefined;

  getTasteMatrix: () => import('../services/interactionMatrix').TasteMatrixProfile;

  updatePlaybackProgress: (
    id: number,
    type: 'movie' | 'tv',
    seconds: number,
    duration?: number,
    season?: number,
    episode?: number
  ) => void;

  getPlaybackProgress: (
    id: number,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
  ) => number | undefined;
}

export const useStreamStore = create<StreamState>()(
  persist(
    (set, get) => ({
      seriesProgress: {},
      watchHistory: [],
      likedMedia: [],
      userRatings: [],

      saveSeriesEpisode: (seriesId, season, episode, meta = {}) => {
        const now = Date.now();
        const title = meta.title || `Series #${seriesId}`;

        set((state) => {
          const updatedSeries = {
            ...state.seriesProgress,
            [seriesId]: {
              seriesId,
              season,
              episode,
              title,
              overview: meta.overview,
              poster_path: meta.poster_path ?? null,
              backdrop_path: meta.backdrop_path ?? null,
              release_date: meta.release_date,
              updatedAt: now,
            },
          };

          // Filter out duplicate if present
          const filteredHistory = state.watchHistory.filter(
            (item) => !(item.id === seriesId && item.type === 'tv')
          );
          const newHistoryItem: WatchHistoryItem = {
            id: seriesId,
            type: 'tv',
            title,
            overview: meta.overview,
            poster_path: meta.poster_path ?? null,
            backdrop_path: meta.backdrop_path ?? null,
            release_date: meta.release_date,
            vote_average: meta.vote_average,
            number_of_seasons: meta.number_of_seasons,
            season,
            episode,
            updatedAt: now,
          };

          return {
            seriesProgress: updatedSeries,
            watchHistory: [newHistoryItem, ...filteredHistory].slice(0, 30),
          };
        });
      },

      getSeriesLastEpisode: (seriesId) => {
        const progress = get().seriesProgress[seriesId];
        if (progress) {
          return { season: progress.season, episode: progress.episode };
        }
        return undefined;
      },

      saveMovieToHistory: (movie) => {
        const now = Date.now();
        set((state) => {
          const filtered = state.watchHistory.filter(
            (item) => !(item.id === movie.id && item.type === 'movie')
          );
          const newItem: WatchHistoryItem = {
            id: movie.id,
            type: 'movie',
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path,
            backdrop_path: movie.backdrop_path,
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            updatedAt: now,
          };
          return {
            watchHistory: [newItem, ...filtered].slice(0, 30),
          };
        });
      },

      removeFromHistory: (id) => {
        set((state) => ({
          watchHistory: state.watchHistory.filter((item) => item.id !== id),
        }));
      },

      clearHistory: () => {
        set({ seriesProgress: {}, watchHistory: [], likedMedia: [], userRatings: [] });
      },

      toggleLike: (item) => {
        set((state) => {
          const exists = state.likedMedia.some((m) => m.id === item.id);
          if (exists) {
            return {
              likedMedia: state.likedMedia.filter((m) => m.id !== item.id),
            };
          }
          return {
            likedMedia: [item, ...state.likedMedia].slice(0, 50),
          };
        });
      },

      isLiked: (id) => {
        return get().likedMedia.some((m) => m.id === id);
      },

      addUserRating: (rating) => {
        get().bulkAddRatings([rating], true);
      },

      bulkAddRatings: (newRatings, syncToHistoryAndLikes = true) => {
        set((state) => {
          // Merge userRatings
          const ratingMap = new Map();
          for (const r of state.userRatings) {
            ratingMap.set(`${r.type}:${r.id}`, r);
          }
          for (const r of newRatings) {
            ratingMap.set(`${r.type}:${r.id}`, r);
          }
          const updatedRatings = Array.from(ratingMap.values());

          let updatedHistory = state.watchHistory;
          let updatedLikes = state.likedMedia;

          if (syncToHistoryAndLikes) {
            // Merge into watchHistory
            const historyMap = new Map();
            for (const h of state.watchHistory) {
              historyMap.set(`${h.type}:${h.id}`, h);
            }
            for (const r of newRatings) {
              const key = `${r.type}:${r.id}`;
              if (!historyMap.has(key)) {
                historyMap.set(key, {
                  id: r.id,
                  type: r.type,
                  title: r.title,
                  poster_path: r.poster_path,
                  backdrop_path: r.backdrop_path,
                  release_date: r.release_date,
                  vote_average: r.vote_average,
                  progressSeconds: 7200,
                  durationSeconds: 7200,
                  updatedAt: r.ratedAt || Date.now(),
                });
              }
            }
            updatedHistory = Array.from(historyMap.values());

            // Merge 4+ stars into likedMedia
            const likesMap = new Map();
            for (const l of state.likedMedia) {
              likesMap.set(l.id, l);
            }
            for (const r of newRatings) {
              const isHighRating = (r.rating !== undefined && r.rating >= 4.0) || r.confidenceWeight >= 4.0;
              if (isHighRating && !likesMap.has(r.id)) {
                likesMap.set(r.id, {
                  id: r.id,
                  title: r.title,
                  poster_path: r.poster_path,
                  backdrop_path: r.backdrop_path,
                  release_date: r.release_date || '',
                  vote_average: r.vote_average || 0,
                  media_type: r.type,
                  genre_ids: r.genre_ids || [],
                  overview: '',
                });
              }
            }
            updatedLikes = Array.from(likesMap.values());
          }

          return {
            userRatings: updatedRatings,
            watchHistory: updatedHistory,
            likedMedia: updatedLikes,
          };
        });

        // Background sync to backend if user is logged in
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('moviewatcher_auth_token') : null;
          if (token && newRatings.length > 0) {
            fetch('/api/user/ratings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                ratings: newRatings,
                syncToHistory: syncToHistoryAndLikes,
              }),
            }).catch((e) => console.warn('Background sync of ratings failed:', e));
          }
        } catch {}
      },

      removeUserRating: (mediaId) => {
        set((state) => ({
          userRatings: state.userRatings.filter((r) => r.id !== mediaId),
        }));
      },

      getUserRating: (mediaId) => {
        return get().userRatings.find((r) => r.id === mediaId);
      },

      getTasteMatrix: () => {
        const state = get();
        return computeUnifiedInteractionMatrix(
          state.watchHistory,
          state.likedMedia,
          state.userRatings
        );
      },

      updatePlaybackProgress: (id, type, seconds, duration, season, episode) => {
        const now = Date.now();
        set((state) => {
          const updatedHistory = state.watchHistory.map((item) => {
            if (item.id === id && item.type === type) {
              if (type === 'tv' && season && episode && (item.season !== season || item.episode !== episode)) {
                return item;
              }
              return {
                ...item,
                progressSeconds: Math.floor(seconds),
                durationSeconds: duration ? Math.floor(duration) : item.durationSeconds,
                updatedAt: now,
              };
            }
            return item;
          });

          const updatedSeries = { ...state.seriesProgress };
          if (type === 'tv' && updatedSeries[id]) {
            updatedSeries[id] = {
              ...updatedSeries[id],
              progressSeconds: Math.floor(seconds),
              durationSeconds: duration ? Math.floor(duration) : updatedSeries[id].durationSeconds,
              updatedAt: now,
            };
          }

          return {
            watchHistory: updatedHistory,
            seriesProgress: updatedSeries,
          };
        });
      },

      getPlaybackProgress: (id, type, season, episode) => {
        const item = get().watchHistory.find(
          (m) =>
            m.id === id &&
            m.type === type &&
            (type !== 'tv' || !season || !episode || (m.season === season && m.episode === episode))
        );
        return item?.progressSeconds;
      },
    }),
    {
      name: 'moviewatcher_stream_store',
    }
  )
);
