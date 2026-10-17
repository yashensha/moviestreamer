import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SeriesProgress, WatchHistoryItem, MediaItem } from '../types/movie';

interface StreamState {
  // Map of seriesId -> last streamed season & episode info
  seriesProgress: Record<number, SeriesProgress>;

  // List of all items currently being watched (Continue Watching)
  watchHistory: WatchHistoryItem[];

  // List of liked/favorited media items for taste personalization
  likedMedia: MediaItem[];

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
}

export const useStreamStore = create<StreamState>()(
  persist(
    (set, get) => ({
      seriesProgress: {},
      watchHistory: [],
      likedMedia: [],

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
        set({ seriesProgress: {}, watchHistory: [], likedMedia: [] });
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
    }),
    {
      name: 'moviewatcher_stream_store',
    }
  )
);
