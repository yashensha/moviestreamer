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
import { CURATED_SERIES } from '../services/tmdb';

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

  // List of disliked media items for negative taste learning and hard-filtering
  dislikedMedia: MediaItem[];

  // Explicit & imported Letterboxd ratings with confidence weights
  userRatings: UserRatingItem[];

  // IDs explicitly removed from Continue Watching by the user
  dismissedHistoryIds: number[];

  // IDs explicitly deleted from Watched library by the user (persisted to prevent rehydration)
  deletedWatchedIds: number[];

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

  toggleDislike: (item: MediaItem) => void;

  isDisliked: (id: number) => boolean;

  markAsWatched: (item: MediaItem) => void;

  toggleWatched: (item: MediaItem) => void;

  removeFromWatched: (id: number) => void;

  isWatched: (id: number) => boolean;

  // Watchlist Actions
  toggleWatchlist: (item: MediaItem) => void;

  isInWatchlist: (id: number) => boolean;

  removeFromWatchlist: (id: number) => void;

  bulkAddToWatchlist: (items: MediaItem[]) => void;

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
      dislikedMedia: [],
      userRatings: [],
      dismissedHistoryIds: [],
      deletedWatchedIds: [],

      saveSeriesEpisode: (seriesId, season, episode, meta = {}) => {
        const now = Date.now();
        const curated = CURATED_SERIES.find((c) => c.id === seriesId);
        const title = meta.title || curated?.title || `Series #${seriesId}`;
        const posterPath = meta.poster_path ?? curated?.poster_path ?? null;
        const backdropPath = meta.backdrop_path ?? curated?.backdrop_path ?? null;
        const overview = meta.overview || curated?.overview || '';
        const releaseDate = meta.release_date || curated?.release_date;
        const seasons = meta.seasons || curated?.seasons;
        const numberOfSeasons = meta.number_of_seasons || curated?.number_of_seasons;
        const episodeRunTime = meta.episode_run_time || curated?.episode_run_time;
        const dur = meta.durationSeconds ?? (episodeRunTime && episodeRunTime.length > 0 ? episodeRunTime[0] * 60 : 45 * 60);
        const sec = meta.progressSeconds ?? 0;
        const progressPercent = dur > 0 && sec > 5 ? Math.min(95, Math.max(5, Math.round((sec / dur) * 100))) : 0;

        set((state) => {
          const updatedSeries = {
            ...state.seriesProgress,
            [seriesId]: {
              seriesId,
              season,
              episode,
              title,
              overview,
              poster_path: posterPath,
              backdrop_path: backdropPath,
              release_date: releaseDate,
              genre_ids: meta.genre_ids,
              episode_run_time: episodeRunTime,
              seasons,
              progressSeconds: sec,
              durationSeconds: dur,
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
            overview,
            poster_path: posterPath,
            backdrop_path: backdropPath,
            release_date: releaseDate,
            episode_run_time: episodeRunTime,
            vote_average: meta.vote_average || curated?.vote_average,
            number_of_seasons: numberOfSeasons,
            seasons,
            season,
            episode,
            progressSeconds: sec,
            durationSeconds: dur,
            progress: progressPercent,
            updatedAt: now,
          };

          return {
            seriesProgress: updatedSeries,
            watchHistory: [newHistoryItem, ...filteredHistory].slice(0, 30),
            dismissedHistoryIds: (state.dismissedHistoryIds || []).filter((dId) => dId !== seriesId),
          };
        });

        // Immediately sync to edge so Continue Watching is persistent
        try {
          const state = get();
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, state.watchlist);
            })
            .catch(() => {});
        } catch {}
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
            dismissedHistoryIds: (state.dismissedHistoryIds || []).filter((dId) => dId !== movie.id),
          };
        });

        try {
          const state = get();
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, state.watchlist);
            })
            .catch(() => {});
        } catch {}
      },

      removeFromHistory: (id) => {
        // Clean localStorage keys
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem(`moviewatcher_playback_movie_${id}`);
            localStorage.removeItem(`moviewatcher_playback_tv_${id}`);
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (
                key &&
                (key.startsWith(`moviewatcher_playback_tv_${id}_`) ||
                  key === `moviewatcher_playback_tv_${id}` ||
                  key === `moviewatcher_playback_movie_${id}`)
              ) {
                localStorage.removeItem(key);
              }
            }
          }
        } catch {}

        set((state) => {
          const updatedSeries = { ...state.seriesProgress };
          delete updatedSeries[id];
          const updatedDismissed = Array.from(new Set([...(state.dismissedHistoryIds || []), id]));
          const updatedHistory = (state.watchHistory || []).filter((item) => item.id !== id);

          return {
            watchHistory: updatedHistory,
            seriesProgress: updatedSeries,
            dismissedHistoryIds: updatedDismissed,
          };
        });

        try {
          const state = get();
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, state.watchlist);
            })
            .catch(() => {});
        } catch {}
      },

      clearHistory: () => {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && key.startsWith('moviewatcher_playback_')) {
                localStorage.removeItem(key);
              }
            }
          }
        } catch {}

        set({
          seriesProgress: {},
          watchHistory: [],
          watchedList: [],
          watchlist: [],
          likedMedia: [],
          dislikedMedia: [],
          userRatings: [],
          dismissedHistoryIds: [],
          deletedWatchedIds: [],
        });
      },

      toggleLike: (item) => {
        let nextLiked: MediaItem[] = [];
        let nextDisliked: MediaItem[] = [];
        set((state) => {
          const numId = Number(item.id);
          const exists = state.likedMedia.some((m) => Number(m.id) === numId);
          if (exists) {
            nextLiked = state.likedMedia.filter((m) => Number(m.id) !== numId);
            nextDisliked = state.dislikedMedia || [];
            return {
              likedMedia: nextLiked,
            };
          }
          nextLiked = [item, ...state.likedMedia.filter((m) => Number(m.id) !== numId)];
          // Mutually exclusive: un-dislike if previously disliked
          nextDisliked = (state.dislikedMedia || []).filter((m) => Number(m.id) !== numId);
          return {
            likedMedia: nextLiked,
            dislikedMedia: nextDisliked,
          };
        });

        // Immediately sync to edge and dev server so like changes are never reverted
        const state = get();
        import('../services/edgeSync')
          .then((m) => {
            m.syncToEdgeImmediately(state.watchHistory, nextLiked, state.userRatings, state.watchlist);
          })
          .catch(() => {});
      },

      isLiked: (id) => {
        const numId = Number(id);
        return get().likedMedia.some((m) => Number(m.id) === numId);
      },

      toggleDislike: (item) => {
        let updatedLiked: MediaItem[] = [];
        let updatedWatchlist: MediaItem[] = [];
        let updatedRatings: UserRatingItem[] = [];
        let updatedDisliked: MediaItem[] = [];

        set((state) => {
          const numId = Number(item.id);
          const isCurrentlyDisliked = (state.dislikedMedia || []).some((m) => Number(m.id) === numId);
          if (isCurrentlyDisliked) {
            updatedDisliked = (state.dislikedMedia || []).filter((m) => Number(m.id) !== numId);
            updatedRatings = state.userRatings.filter(
              (r) => Number(r.id) !== numId || r.source !== 'in_app' || (r.rating !== undefined && r.rating > 1.5)
            );
            return {
              dislikedMedia: updatedDisliked,
              userRatings: updatedRatings,
            };
          }

          // Add to dislikedMedia
          updatedDisliked = [item, ...(state.dislikedMedia || []).filter((m) => Number(m.id) !== numId)];
          // Mutually exclusive: remove from likedMedia
          updatedLiked = state.likedMedia.filter((m) => Number(m.id) !== numId);
          // Remove from watchlist if present
          updatedWatchlist = state.watchlist.filter((m) => Number(m.id) !== numId);

          // Add explicit negative rating signal into userRatings for recommendation matrix
          const negativeRating: UserRatingItem = {
            id: numId,
            type: item.media_type || 'movie',
            title: item.title,
            rating: 1.0,
            confidenceWeight: 1.0,
            source: 'in_app',
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            release_date: item.release_date,
            vote_average: item.vote_average,
            genre_ids: item.genre_ids || (item.genres ? item.genres.map((g) => g.id) : []),
            ratedAt: Date.now(),
          };

          updatedRatings = [
            negativeRating,
            ...state.userRatings.filter((r) => Number(r.id) !== numId),
          ];

          return {
            dislikedMedia: updatedDisliked,
            likedMedia: updatedLiked,
            watchlist: updatedWatchlist,
            userRatings: updatedRatings,
          };
        });

        const state = get();
        import('../services/edgeSync')
          .then((m) => {
            m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, state.watchlist);
          })
          .catch(() => {});
      },

      isDisliked: (id) => {
        const numId = Number(id);
        return Boolean(get().dislikedMedia && get().dislikedMedia.some((m) => Number(m.id) === numId));
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

        set((state) => {
          const updatedSeries = { ...state.seriesProgress };
          delete updatedSeries[id];
          return {
            watchedList: [newWatchedItem, ...(state.watchedList || []).filter((w) => w.id !== id)],
            userRatings: state.userRatings.some((r) => r.id === id)
              ? state.userRatings
              : [newRatingItem, ...state.userRatings],
            // Remove marked item from Continue Watching (both movies & series)
            watchHistory: (state.watchHistory || []).filter((w) => Number(w.id) !== Number(id)),
            // Remove from Watchlist since it is now watched
            watchlist: (state.watchlist || []).filter((w) => Number(w.id) !== Number(id)),
            // If it was previously in deletedWatchedIds, un-delete it
            deletedWatchedIds: (state.deletedWatchedIds || []).filter((d) => Number(d) !== Number(id)),
            seriesProgress: updatedSeries,
          };
        });
      },

      toggleWatched: (item) => {
        const id = item.id;
        const currentIsWatched = get().isWatched(id);

        if (currentIsWatched) {
          get().removeFromWatched(id);
        } else {
          get().markAsWatched(item);
        }
      },

      removeFromWatched: (id) => {
        const numId = Number(id);
        let nextHistory: any[] = [];
        let nextLikes: any[] = [];
        let nextRatings: any[] = [];

        set((state) => {
          const updatedDeleted = Array.from(new Set([...(state.deletedWatchedIds || []), numId]));
          const updatedSeries = { ...(state.seriesProgress || {}) };
          delete updatedSeries[numId];

          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.includes(`_${numId}_`) || key.endsWith(`_${numId}`))) {
                  localStorage.removeItem(key);
                }
              }
            }
          } catch {}

          const nextWatched = (state.watchedList || []).filter((w) => Number(w.id) !== numId);
          nextRatings = (state.userRatings || []).filter((r) => Number(r.id) !== numId);
          nextHistory = (state.watchHistory || []).filter((h) => Number(h.id) !== numId);
          nextLikes = (state.likedMedia || []).filter((l) => Number(l.id) !== numId);
          const nextDislikes = (state.dislikedMedia || []).filter((d) => Number(d.id) !== numId);

          return {
            deletedWatchedIds: updatedDeleted,
            watchedList: nextWatched,
            userRatings: nextRatings,
            watchHistory: nextHistory,
            likedMedia: nextLikes,
            dislikedMedia: nextDislikes,
            seriesProgress: updatedSeries,
          };
        });

        // Immediately sync removal to edge and dev server
        try {
          const state = get();
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdgeImmediately(nextHistory, nextLikes, nextRatings, state.watchlist);
            })
            .catch(() => {});
        } catch {}
      },

      isWatched: (id) => {
        const state = get();
        const numId = Number(id);
        if ((state.deletedWatchedIds || []).some((d) => Number(d) === numId)) return false;
        const inWatchlist = (state.watchlist || []).some((w) => Number(w.id) === numId);
        if (inWatchlist) return false;
        return Boolean(
          (state.watchedList && state.watchedList.some((w) => Number(w.id) === numId)) ||
          (state.userRatings && state.userRatings.some((r) => Number(r.id) === numId))
        );
      },

      // Watchlist Implementation
      toggleWatchlist: (item) => {
        let nextWatchlist: MediaItem[] = [];
        set((state) => {
          const exists = state.watchlist.some((m) => Number(m.id) === Number(item.id));
          if (exists) {
            nextWatchlist = state.watchlist.filter((m) => Number(m.id) !== Number(item.id));
            return {
              watchlist: nextWatchlist,
            };
          }
          nextWatchlist = [item, ...state.watchlist.filter((m) => Number(m.id) !== Number(item.id))];
          return {
            watchlist: nextWatchlist,
          };
        });
        const state = get();
        import('../services/edgeSync').then((m) => {
          m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, nextWatchlist);
        }).catch(() => {});
      },

      isInWatchlist: (id) => {
        return get().watchlist.some((m) => Number(m.id) === Number(id));
      },

      removeFromWatchlist: (id) => {
        let nextWatchlist: MediaItem[] = [];
        set((state) => {
          nextWatchlist = state.watchlist.filter((m) => Number(m.id) !== Number(id));
          return {
            watchlist: nextWatchlist,
          };
        });
        const state = get();
        import('../services/edgeSync').then((m) => {
          m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, nextWatchlist);
        }).catch(() => {});
      },

      bulkAddToWatchlist: (items) => {
        let updatedWatchlist: MediaItem[] = [];
        set((state) => {
          const map = new Map((state.watchlist || []).map((m) => [Number(m.id), m]));
          for (const item of items) {
            const numId = Number(item.id);
            if (!numId) continue;
            if (!map.has(numId)) {
              map.set(numId, {
                id: numId,
                title: item.title,
                overview: item.overview || '',
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path ?? null,
                media_type: item.media_type || 'movie',
                release_date: item.release_date || '',
                vote_average: item.vote_average ?? 8.0,
                genre_ids: item.genre_ids || [],
                number_of_seasons: item.number_of_seasons,
              });
            }
          }
          updatedWatchlist = Array.from(map.values());
          return {
            watchlist: updatedWatchlist,
          };
        });

        const state = get();
        import('../services/edgeSync').then((m) => {
          m.syncToEdgeImmediately(state.watchHistory, state.likedMedia, state.userRatings, updatedWatchlist);
        }).catch(() => {});
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
          const newIds = new Set(newRatings.map((r) => Number(r.id)));
          const updatedDeleted = (state.deletedWatchedIds || []).filter((d) => !newIds.has(Number(d)));

          // Merge userRatings
          const ratingMap = new Map();
          for (const r of state.userRatings) {
            ratingMap.set(`${r.type}:${r.id}`, r);
          }
          for (const r of newRatings) {
            ratingMap.set(`${r.type}:${r.id}`, r);
          }
          const updatedRatings = Array.from(ratingMap.values());

          // Populate watchedList with all rated items (ratings imply watched for both movies & series)
          const watchedMap = new Map((state.watchedList || []).map((w) => [w.id, w]));
          for (const r of newRatings) {
            if (!watchedMap.has(r.id)) {
              watchedMap.set(r.id, {
                id: r.id,
                title: r.title,
                overview: '',
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path ?? null,
                release_date: r.release_date || '',
                vote_average: r.vote_average || 8.0,
                media_type: r.type || 'movie',
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

          let updatedLikes = state.likedMedia || [];
          let updatedDislikes = state.dislikedMedia || [];

          if (syncToHistoryAndLikes) {
            const likesMap = new Map((state.likedMedia || []).map((l) => [l.id, l]));
            const dislikesMap = new Map((state.dislikedMedia || []).map((d) => [d.id, d]));

            for (const r of newRatings) {
              const ratingVal = r.rating;
              if (ratingVal !== undefined && ratingVal !== null && !isNaN(ratingVal)) {
                if (ratingVal >= 4.0) {
                  // 4 star and above: automatically converted to Liked
                  dislikesMap.delete(r.id);
                  if (!likesMap.has(r.id)) {
                    likesMap.set(r.id, {
                      id: r.id,
                      title: r.title,
                      poster_path: r.poster_path ?? null,
                      backdrop_path: r.backdrop_path ?? null,
                      release_date: r.release_date || '',
                      vote_average: r.vote_average || 0,
                      media_type: r.type,
                      genre_ids: r.genre_ids || [],
                      overview: '',
                    });
                  }
                } else if (ratingVal < 3.0) {
                  // below 3 stars: automatically converted to Disliked
                  likesMap.delete(r.id);
                  if (!dislikesMap.has(r.id)) {
                    dislikesMap.set(r.id, {
                      id: r.id,
                      title: r.title,
                      poster_path: r.poster_path ?? null,
                      backdrop_path: r.backdrop_path ?? null,
                      release_date: r.release_date || '',
                      vote_average: r.vote_average || 0,
                      media_type: r.type,
                      genre_ids: r.genre_ids || [],
                      overview: '',
                    });
                  }
                } else {
                  // 3 star to 4 star (3.0 <= rating < 4.0): neutral
                  // Remove from dislikes if present, but NEVER delete explicit user likes!
                  dislikesMap.delete(r.id);
                }
              }
            }
            updatedLikes = Array.from(likesMap.values());
            updatedDislikes = Array.from(dislikesMap.values());
          }

          return {
            userRatings: updatedRatings,
            watchedList: updatedWatchedList,
            watchHistory: updatedHistory,
            likedMedia: updatedLikes,
            dislikedMedia: updatedDislikes,
            deletedWatchedIds: updatedDeleted,
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
          state.userRatings,
          state.dislikedMedia
        );
      },

      updatePlaybackProgress: (id, type, seconds, duration, season, episode) => {
        const now = Date.now();
        set((state) => {
          // If this item was explicitly dismissed/removed by the user, ignore background ticker updates
          if (state.dismissedHistoryIds && state.dismissedHistoryIds.includes(id)) {
            return {};
          }

          let itemFound = false;
          const updatedHistory = state.watchHistory.map((item) => {
            if (item.id === id && item.type === type) {
              itemFound = true;
              const dur = duration ? Math.floor(duration) : item.durationSeconds || (type === 'tv' ? 45 * 60 : 110 * 60);
              const percent = dur && dur > 0 ? Math.min(100, Math.max(1, Math.round((seconds / dur) * 100))) : item.progress;

              // If it's a TV show and season/episode was provided, update it to the active episode
              if (type === 'tv' && season && episode) {
                return {
                  ...item,
                  season,
                  episode,
                  progressSeconds: Math.floor(seconds),
                  durationSeconds: dur,
                  progress: percent,
                  updatedAt: now,
                };
              }

              return {
                ...item,
                progressSeconds: Math.floor(seconds),
                durationSeconds: dur,
                progress: percent,
                updatedAt: now,
              };
            }
            return item;
          });

          // If item wasn't in history yet, add a minimal record so progress is immediately saved
          let finalHistory = updatedHistory;
          if (!itemFound) {
            const curated = type === 'tv' ? CURATED_SERIES.find((c) => c.id === id) : undefined;
            const dur = duration ? Math.floor(duration) : (type === 'tv' ? 45 * 60 : 110 * 60);
            const percent = dur && dur > 0 ? Math.min(100, Math.max(1, Math.round((seconds / dur) * 100))) : 5;
            const newItem: WatchHistoryItem = {
              id,
              type,
              title: type === 'tv' ? (curated?.title || `Series #${id}`) : `Movie #${id}`,
              overview: curated?.overview || '',
              poster_path: curated?.poster_path ?? null,
              backdrop_path: curated?.backdrop_path ?? null,
              season: season || (type === 'tv' ? 1 : undefined),
              episode: episode || (type === 'tv' ? 1 : undefined),
              progressSeconds: Math.floor(seconds),
              durationSeconds: dur,
              progress: percent,
              updatedAt: now,
            };
            finalHistory = [newItem, ...updatedHistory].slice(0, 30);
          }

          const updatedSeries = { ...state.seriesProgress };
          if (type === 'tv') {
            const existingSp = updatedSeries[id];
            const curated = CURATED_SERIES.find((c) => c.id === id);
            updatedSeries[id] = {
              seriesId: id,
              title: existingSp?.title && !existingSp.title.startsWith('Series #') ? existingSp.title : (curated?.title || existingSp?.title || `Series #${id}`),
              season: season || existingSp?.season || 1,
              episode: episode || existingSp?.episode || 1,
              overview: existingSp?.overview || curated?.overview || '',
              poster_path: existingSp?.poster_path ?? curated?.poster_path ?? null,
              backdrop_path: existingSp?.backdrop_path ?? curated?.backdrop_path ?? null,
              release_date: existingSp?.release_date || curated?.release_date,
              progressSeconds: Math.floor(seconds),
              durationSeconds: duration ? Math.floor(duration) : existingSp?.durationSeconds || 45 * 60,
              updatedAt: now,
            };
          }

          return {
            watchHistory: finalHistory,
            seriesProgress: updatedSeries,
            // If active TV show playback, ensure it is not blocked by watchedList
            watchedList: type === 'tv' ? (state.watchedList || []).filter((w) => w.id !== id) : state.watchedList,
          };
        });

        try {
          const state = get();
          import('../services/edgeSync')
            .then((m) => {
              m.syncToEdge(state.watchHistory, state.likedMedia, state.userRatings, state.watchlist);
            })
            .catch(() => {});
        } catch {}
      },

      getPlaybackProgress: (id, type, season, episode) => {
        const state = get();
        if (type === 'tv') {
          // If specific episode requested, strictly return progress for THAT episode only
          if (season && episode) {
            const match = state.watchHistory.find(
              (m) => m.id === id && m.type === 'tv' && m.season === season && m.episode === episode
            );
            if (match?.progressSeconds && match.progressSeconds > 5) return match.progressSeconds;

            const sp = state.seriesProgress[id];
            if (sp && sp.season === season && sp.episode === episode && sp.progressSeconds && sp.progressSeconds > 5) {
              return sp.progressSeconds;
            }

            // New/unwatched episode must start from 0, never bleed from another episode
            return undefined;
          }

          // Otherwise return progress for the active/latest episode
          const sp = state.seriesProgress[id];
          if (sp?.progressSeconds && sp.progressSeconds > 5) return sp.progressSeconds;

          const item = state.watchHistory.find((m) => m.id === id && m.type === 'tv');
          return item?.progressSeconds && item.progressSeconds > 5 ? item.progressSeconds : undefined;
        }

        const item = state.watchHistory.find((m) => m.id === id && m.type === 'movie');
        return item?.progressSeconds;
      },
    }),
    {
      name: 'moviewatcher_stream_store',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Ensure watchedList exists
        const deletedIds = new Set((state.deletedWatchedIds || []).map(Number));
        const dismissedIds = new Set(state.dismissedHistoryIds || []);
        state.watchedList = (state.watchedList || []).filter((w) => !deletedIds.has(Number(w.id)));
        state.userRatings = (state.userRatings || []).filter((r) => !deletedIds.has(Number(r.id)));
        state.watchHistory = (state.watchHistory || []).filter((h) => !deletedIds.has(Number(h.id)));
        state.likedMedia = (state.likedMedia || []).filter((l) => !deletedIds.has(Number(l.id)));
        state.dislikedMedia = (state.dislikedMedia || []).filter((d) => !deletedIds.has(Number(d.id)));
        const watchedIds = new Set(state.watchedList.map((w) => Number(w.id)));

        // Scan localStorage for any saved TV playback records
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('moviewatcher_playback_tv_')) {
                const parts = key.replace('moviewatcher_playback_tv_', '').split('_');
                const tvId = parseInt(parts[0], 10);
                if (tvId && !isNaN(tvId)) {
                  // If user dismissed this title, marked it as watched, or deleted it, do NOT restore
                  if (dismissedIds.has(tvId) || watchedIds.has(tvId) || deletedIds.has(tvId)) {
                    localStorage.removeItem(key);
                    continue;
                  }

                  let sNum = 1;
                  let eNum = 1;
                  if (parts[1] && parts[1].startsWith('s')) sNum = parseInt(parts[1].slice(1), 10) || 1;
                  if (parts[2] && parts[2].startsWith('e')) eNum = parseInt(parts[2].slice(1), 10) || 1;

                  const rawData = localStorage.getItem(key);
                  const parsed = rawData ? JSON.parse(rawData) : null;
                  const sec = parsed?.seconds || 0;
                  const dur = parsed?.duration || 45 * 60;
                  const seasonVal = parsed?.season || sNum;
                  const episodeVal = parsed?.episode || eNum;

                  if (sec > 5) {
                    if (!state.seriesProgress) state.seriesProgress = {};
                    if (!state.seriesProgress[tvId]) {
                      const curated = CURATED_SERIES.find((c) => c.id === tvId);
                      state.seriesProgress[tvId] = {
                        seriesId: tvId,
                        season: seasonVal,
                        episode: episodeVal,
                        title: curated?.title || `Series #${tvId}`,
                        overview: curated?.overview || '',
                        poster_path: curated?.poster_path ?? null,
                        backdrop_path: curated?.backdrop_path ?? null,
                        release_date: curated?.release_date || '',
                        progressSeconds: sec,
                        durationSeconds: dur,
                        updatedAt: parsed?.updatedAt || Date.now(),
                      };
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn('Playback localStorage scan error:', e);
        }

        // Restore seriesProgress into watchHistory if missing from watchHistory
        if (state.seriesProgress) {
          const currentHistIds = new Set((state.watchHistory || []).map((h) => Number(h.id)));
          for (const sId in state.seriesProgress) {
            const numId = Number(sId);
            // If user explicitly dismissed, marked as watched, or deleted this item, remove from seriesProgress and do NOT restore
            if (dismissedIds.has(numId) || watchedIds.has(numId) || deletedIds.has(numId)) {
              delete state.seriesProgress[numId];
              continue;
            }

            const sp = state.seriesProgress[sId];
            if (!currentHistIds.has(numId) && sp.progressSeconds && sp.progressSeconds > 5) {
              const curated = CURATED_SERIES.find((c) => c.id === numId);
              state.watchHistory.unshift({
                id: numId,
                type: 'tv',
                title: sp.title && !sp.title.startsWith('Series #') ? sp.title : (curated?.title || sp.title || `Series #${numId}`),
                overview: sp.overview || curated?.overview,
                poster_path: sp.poster_path ?? curated?.poster_path ?? null,
                backdrop_path: sp.backdrop_path ?? curated?.backdrop_path ?? null,
                release_date: sp.release_date || curated?.release_date,
                season: sp.season || 1,
                episode: sp.episode || 1,
                seasons: sp.seasons || curated?.seasons,
                episode_run_time: sp.episode_run_time || curated?.episode_run_time,
                progressSeconds: sp.progressSeconds,
                durationSeconds: sp.durationSeconds,
                updatedAt: sp.updatedAt || Date.now(),
              });
            }
          }
        }

        // Ensure watchedList is populated with all rated/liked/history entries (everything other than watchlist is watched)
        const watchedMap = new Map((state.watchedList || []).map((w) => [Number(w.id), w]));

        // 1. From userRatings (Letterboxd imports and in-app ratings)
        if (state.userRatings && state.userRatings.length > 0) {
          for (const r of state.userRatings) {
            const numId = Number(r.id);
            if (numId && !deletedIds.has(numId) && !watchedMap.has(numId)) {
              watchedMap.set(numId, {
                id: numId,
                title: r.title,
                overview: '',
                poster_path: r.poster_path,
                backdrop_path: r.backdrop_path ?? null,
                release_date: r.release_date || '',
                vote_average: r.vote_average || 8.0,
                media_type: r.type || 'movie',
                genre_ids: r.genre_ids || [],
              });
            }
          }
        }

        const syncedWatchedList = Array.from(watchedMap.values());
        const watchedIdsSet = new Set(syncedWatchedList.map((w) => Number(w.id)));

        // Clean watchHistory: strictly exclude dismissed items and explicitly completed/watched items
        state.watchedList = syncedWatchedList;
        state.dislikedMedia = state.dislikedMedia || [];
        state.watchlist = state.watchlist || [];
        state.likedMedia = state.likedMedia || [];
        state.watchHistory = (state.watchHistory || []).filter(
          (h) => !dismissedIds.has(h.id) && !watchedIdsSet.has(Number(h.id)) && ((h.progressSeconds && h.progressSeconds > 5) || (h.progress && h.progress > 0))
        );

        // Synchronize ratings into likes/dislikes on rehydrate
        if (state.userRatings && state.userRatings.length > 0) {
          const likesMap = new Map((state.likedMedia || []).map((l) => [Number(l.id), l]));
          const dislikesMap = new Map((state.dislikedMedia || []).map((d) => [Number(d.id), d]));

          for (const r of state.userRatings) {
            const numId = Number(r.id);
            const val = r.rating;
            if (val !== undefined && val !== null && !isNaN(val)) {
              if (val >= 4.0) {
                dislikesMap.delete(numId);
                if (!likesMap.has(numId)) {
                  likesMap.set(numId, {
                    id: numId,
                    title: r.title,
                    poster_path: r.poster_path ?? null,
                    backdrop_path: r.backdrop_path ?? null,
                    release_date: r.release_date || '',
                    vote_average: r.vote_average || 0,
                    media_type: r.type,
                    genre_ids: r.genre_ids || [],
                    overview: '',
                  });
                }
              } else if (val < 2.5) {
                // Low ratings (< 2.5) qualify as disliked only if not explicitly liked
                if (!likesMap.has(numId)) {
                  if (!dislikesMap.has(numId)) {
                    dislikesMap.set(numId, {
                      id: numId,
                      title: r.title,
                      poster_path: r.poster_path ?? null,
                      backdrop_path: r.backdrop_path ?? null,
                      release_date: r.release_date || '',
                      vote_average: r.vote_average || 0,
                      media_type: r.type,
                      genre_ids: r.genre_ids || [],
                      overview: '',
                    });
                  }
                }
              } else {
                // Neutral ratings (2.5 to 3.5 stars): remove only from dislikes, NEVER delete explicit user likes!
                dislikesMap.delete(numId);
              }
            }
          }
          state.likedMedia = Array.from(likesMap.values());
          state.dislikedMedia = Array.from(dislikesMap.values());
        }
      },
    }
  )
);
