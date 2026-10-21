import type { MediaItem } from '../types/movie';
import rawData from '../data/curated_top_lists.json';

export interface TopRankedMediaItem extends MediaItem {
  rank: number;
  letterboxd_slug?: string;
  letterboxd_url?: string;
  imdb_id?: string;
  imdb_rating?: number;
}

interface CuratedTopListsData {
  generatedAt: string;
  letterboxdTop500: TopRankedMediaItem[];
  imdbTop200Series: TopRankedMediaItem[];
}

const data = rawData as CuratedTopListsData;

export const letterboxdTop500List: TopRankedMediaItem[] = (data.letterboxdTop500 || []).map((m, index) => ({
  ...m,
  rank: m.rank || index + 1,
  media_type: 'movie',
}));

export const imdbTop200SeriesList: TopRankedMediaItem[] = (data.imdbTop200Series || []).map((s, index) => ({
  ...s,
  rank: s.rank || index + 1,
  media_type: 'tv',
}));

export function getLetterboxdTop500(limit?: number): TopRankedMediaItem[] {
  if (typeof limit === 'number' && limit > 0) {
    return letterboxdTop500List.slice(0, limit);
  }
  return letterboxdTop500List;
}

export function getImdbTop200Series(limit?: number): TopRankedMediaItem[] {
  if (typeof limit === 'number' && limit > 0) {
    return imdbTop200SeriesList.slice(0, limit);
  }
  return imdbTop200SeriesList;
}
