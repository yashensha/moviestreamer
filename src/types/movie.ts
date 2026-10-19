export type MediaType = 'movie' | 'tv';

export interface Episode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime?: number;
  vote_average?: number;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episode_count: number;
  episodes?: Episode[];
}

export interface MediaItem {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  logo_path?: string | null;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  media_type: MediaType;
  genres?: { id: number; name: string }[];
  genre_ids?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Season[];
  season?: number;
  episode?: number;
  runtime?: number;
  certification?: string;
  episode_run_time?: number[];
  tagline?: string;
}

// Kept for backward compatibility
export type Movie = MediaItem;

export interface StreamItem {
  type: MediaType;
  tmdbId: string | number;
  season?: number;
  episode?: number;
  title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
}

export interface SeriesProgress {
  seriesId: number;
  season: number;
  episode: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
  episode_run_time?: number[];
  progressSeconds?: number;
  durationSeconds?: number;
  updatedAt: number;
  seasons?: Season[];
}

export type MediaStatus = 'watched' | 'watching' | 'watchlist' | 'none';

export interface WatchHistoryItem {
  id: number;
  type: MediaType;
  title: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  season?: number;
  episode?: number;
  vote_average?: number;
  number_of_seasons?: number;
  seasons?: Season[];
  episode_run_time?: number[];
  progressSeconds?: number;
  durationSeconds?: number;
  progress?: number;
  updatedAt: number;
}

export interface UserRatingItem {
  id: number;
  type: MediaType;
  title: string;
  rating?: number; // Letterboxd 0.5 to 5.0 scale
  confidenceWeight: number; // 0.5 to 5.0 confidence weight for recommendation models
  source: 'letterboxd' | 'manual' | 'stream' | 'in_app';
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  ratedAt: number;
}

export interface LetterboxdRawEntry {
  title: string;
  year?: number;
  rating?: number;
  date?: string;
  letterboxdUri?: string;
  isWatchlist?: boolean;
}

export interface PersonItem {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  known_for?: MediaItem[];
}

export interface MultiSearchResult {
  media: MediaItem[];
  people: PersonItem[];
}

