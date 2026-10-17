import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SeriesProgress,
  WatchHistoryItem,
  MediaItem,
  Season,
  UserRatingItem,
  MediaStatus,
} from '../types/movie';
import { computeUnifiedInteractionMatrix } from '../services/interactionMatrix';
import { calculateConfidenceWeight } from '../services/letterboxd';

interface StreamState {
  // Map of seriesId -> last streamed season & episode info
  seriesProgress: Record<number, SeriesProgress>;

  // List of all items currently being watched (Continue Watching)
  watchHistory: WatchHistoryItem[];

  // Dedicated list of completed/watched movies & shows
  watchedList: MediaItem[];

  // Saved planned watchlist items
  watchlist: MediaItem[];

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
      genre_ids?: number[];
      episode_run_time?: number[];
      vote_average?: number;
      number_of_seasons?: number;
      seasons?: Season[];
      progressSeconds?: number;
      durationSeconds?: number;
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

  markAsWatched: (item: MediaItem) => void;

  toggleWatched: (item: MediaItem) => void;

  isWatched: (id: number) => boolean;

  // Watchlist Actions
  toggleWatchlist: (item: MediaItem) => void;

  isInWatchlist: (id: number) => boolean;

  removeFromWatchlist: (id: number) => void;

  // Unified Media Lifecycle Status ('watched' | 'watching' | 'watchlist' | 'none')
  getMediaStatus: (id: number) => MediaStatus;

  setMediaStatus: (item: MediaItem, status: MediaStatus) => void;

  // Letterboxd-Style 5-Star Ratings
  rateMedia: (item: MediaItem, rating: number) => void;

  getMediaRating: (id: number) => number | undefined;

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
      watchedList: [],
      watchlist: [],
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
              genre_ids: meta.genre_ids,
              episode_run_time: meta.episode_run_time,
              seasons: meta.seasons,
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
            episode_run_time: meta.episode_run_time,
            vote_average: meta.vote_average,
            number_of_seasons: meta.number_of_seasons,
            seasons: meta.seasons,
            season,
            episode,
            updatedAt: now,
          };

          return {
            seriesProgress: updatedSeries,
            watchHistory: [newHistoryItem, ...filteredHistory].slice(0, 30),
            watchlist: state.watchlist.filter((m) => m.id !== seriesId),
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
            watchlist: state.watchlist.filter((m) => m.id !== movie.id),
          };
        });
      },

      removeFromHistory: (id) => {
        set((state) => ({
          watchHistory: state.watchHistory.filter((item) => item.id !== id),
        }));
      },

      clearHistory: () => {
        set({
          seriesProgress: {},
          watchHistory: [],
          watchedList: [],
          watchlist: [],
          likedMedia: [],
          userRatings: [],
        });
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

      markAsWatched: (item) => {
        const id = item.id;
        const type = item.media_type || 'movie';
        const now = Date.now();

        const newWatchedItem: MediaItem = {
          id: item.id,
          title: item.title,
          overview: item.overview || '',
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          media_type: type,
          release_date: item.release_date || '',
          vote_average: item.vote_average ?? 8.0,
          number_of_seasons: item.number_of_seasons,
        };

        const newRatingItem: UserRatingItem = {
          id: item.id,
          type,
          title: item.title,
          rating: item.vote_average
            ? Math.min(5, Math.max(1, Math.round((item.vote_average / 2) * 2) / 2))
            : 4.0,
          confidenceWeight: 3.5, // Step 2 In-App Completed Episode/Movie weight: 3.5
          source: 'in_app',
          poster_path: item.poster_path,
          release_date: item.release_date,
          genre_ids: item.genre_ids,
          ratedAt: now,
        };

        set((state) => ({
          watchedList: [newWatchedItem, ...(state.watchedList || []).filter((w) => w.id !== id)],
          userRatings: state.userRatings.some((r) => r.id === id)
            ? state.userRatings
            : [newRatingItem, ...state.userRatings],
          // Remove from Continue Watching (watchHistory) so it NEVER floods continue watching!
          watchHistory: state.watchHistory.filter((w) => w.id !== id),
          watchlist: state.watchlist.filter((w) => w.id !== id),
        }));
      },

      toggleWatched: (item) => {
        const id = item.id;
        const currentIsWatched = get().isWatched(id);

        if (currentIsWatched) {
          // Remove from watchedList and userRatings
          set((state) => ({
            watchedList: (state.watchedList || []).filter((w) => w.id !== id),
            userRatings: state.userRatings.filter((r) => r.id !== id),
          }));
        } else {
          get().markAsWatched(item);
        }
      },

      isWatched: (id) => {
        const state = get();
        return Boolean(state.watchedList && state.watchedList.some((w) => w.id === id));
      },

      // Watchlist Implementation
      toggleWatchlist: (item) => {
        set((state) => {
          const exists = state.watchlist.some((m) => m.id === item.id);
          if (exists) {
            return {
              watchlist: state.watchlist.filter((m) => m.id !== item.id),
            };
          }
          return {
            watchlist: [item, ...state.watchlist.filter((m) => m.id !== item.id)],
          };
        });
      },

      isInWatchlist: (id) => {
        return get().watchlist.some((m) => m.id === id);
      },

      removeFromWatchlist: (id) => {
        set((state) => ({
          watchlist: state.watchlist.filter((m) => m.id !== id),
        }));
      },

      // Media Lifecycle Status: 'watched' | 'watching' | 'watchlist' | 'none'
      getMediaStatus: (id) => {
        const state = get();
        if (state.isWatched(id)) return 'watched';
        if (state.watchHistory.some((w) => w.id === id)) return 'watching';
        if (state.watchlist.some((w) => w.id === id)) return 'watchlist';
        return 'none';
      },

      setMediaStatus: (item, status) => {
        const state = get();
        if (status === 'watched') {
          if (!state.isWatched(item.id)) {
            state.toggleWatched(item);
          }
          state.removeFromWatchlist(item.id);
        } else if (status === 'watching') {
          state.removeFromWatchlist(item.id);
          if (item.media_type === 'tv') {
            state.saveSeriesEpisode(item.id, 1, 1, {
              title: item.title,
              overview: item.overview,
              poster_path: item.poster_path,
              backdrop_path: item.backdrop_path,
              release_date: item.release_date,
              vote_average: item.vote_average,
              genre_ids: item.genre_ids,
            });
          } else {
            state.saveMovieToHistory(item);
          }
        } else if (status === 'watchlist') {
          // Remove from watching / history if setting to watchlist
          set((s) => ({
            watchHistory: s.watchHistory.filter((w) => w.id !== item.id),
            userRatings: s.userRatings.filter((r) => r.id !== item.id),
          }));
          if (!state.isInWatchlist(item.id)) {
            state.toggleWatchlist(item);
          }
        } else if (status === 'none') {
          state.removeFromWatchlist(item.id);
          set((s) => ({
            watchHistory: s.watchHistory.filter((w) => w.id !== item.id),
            userRatings: s.userRatings.filter((r) => r.id !== item.id),
            likedMedia: s.likedMedia.filter((m) => m.id !== item.id),
          }));
        }
      },

      // Letterboxd 5-Star Rating Implementation
      rateMedia: (item, rating) => {
        const now = Date.now();
        const type = item.media_type || 'movie';
        const confidenceWeight = calculateConfidenceWeight(rating);

        const ratingItem: UserRatingItem = {
          id: item.id,
          type,
          title: item.title,
          rating,
          confidenceWeight,
          source: 'in_app',
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          release_date: item.release_date,
          vote_average: item.vote_average,
          genre_ids: item.genre_ids || (item.genres ? item.genres.map((g) => g.id) : []),
          ratedAt: now,
        };

        get().addUserRating(ratingItem);

        // Rating a title marks it as Watched automatically
        if (!get().isWatched(item.id)) {
          get().toggleWatched(item);
        }
      },

      getMediaRating: (id) => {
        return get().userRatings.find((r) => r.id === id)?.rating;
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

          // Populate watchedList with rated items (ratings imply watched for movies only)
          const watchedMap = new Map((state.watchedList || []).map((w) => [w.id, w]));
          for (const r of newRatings) {
            if (r.type === 'movie' && !watchedMap.has(r.id)) {
              watchedMap.set(r.id, {
                id: r.id,
                title: r.title,
                overview: '',
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path ?? null,
                release_date: r.release_date || '',
                vote_average: r.vote_average || 8.0,
                media_type: r.type,
                genre_ids: r.genre_ids || [],
              });
            }
          }
          const updatedWatchedList = Array.from(watchedMap.values());

          // Watched movies should not flood continue watching; TV shows stay in Continue Watching
          const watchedMovieIds = new Set(
            updatedWatchedList.filter((w) => w.media_type === 'movie').map((w) => w.id)
          );
          const updatedHistory = (state.watchHistory || []).filter((h) => {
            if (h.type === 'movie' && watchedMovieIds.has(h.id)) return false;
            return true;
          });

          let updatedLikes = state.likedMedia;

          if (syncToHistoryAndLikes) {
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
            watchedList: updatedWatchedList,
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
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Ensure watchedList exists
        const watchedList = state.watchedList || [];
        const watchedIds = new Set(watchedList.map((w) => w.id));

        // Restore seriesProgress into watchHistory if missing from watchHistory
        if (state.seriesProgress) {
          const currentHistIds = new Set((state.watchHistory || []).map((h) => h.id));
          for (const sId in state.seriesProgress) {
            const numId = Number(sId);
            const sp = state.seriesProgress[sId];
            if (!currentHistIds.has(numId) && !watchedIds.has(numId)) {
              state.watchHistory.unshift({
                id: numId,
                type: 'tv',
                title: sp.title || `Series #${numId}`,
                overview: sp.overview,
                poster_path: sp.poster_path ?? null,
                backdrop_path: sp.backdrop_path ?? null,
                release_date: sp.release_date,
                season: sp.season,
                episode: sp.episode,
                seasons: sp.seasons,
                episode_run_time: sp.episode_run_time,
                progressSeconds: sp.progressSeconds,
                durationSeconds: sp.durationSeconds,
                updatedAt: sp.updatedAt || Date.now(),
              });
            }
          }
        }

        // Clean watchHistory: remove items that are explicitly in watchedList
        state.watchedList = watchedList;
        state.watchHistory = (state.watchHistory || []).filter((h) => !watchedIds.has(h.id));
      },
    }
  )
);
