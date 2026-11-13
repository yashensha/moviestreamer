import {
  create,
  insertMultiple,
  upsert,
  search,
  count,
  type AnyOrama,
} from '@orama/orama';
import type { MediaItem, MediaType } from '../types/movie';
import { ALL_CURATED_MEDIA } from './tmdb';
import { letterboxdTop500List, imdbTop200SeriesList } from './topRatedLists';
import { resolveMovieGenomeSync, onGenomeDatasetLoaded, loadThemesDataset } from './tasteEngine/genome';

export const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

export interface OramaMediaDocument {
  id: string;
  media_id: number;
  title: string;
  original_title: string;
  overview: string;
  genres: string[];
  themes: string[];
  nanogenres: string[];
  media_type: string;
  release_date: string;
  release_year: string;
  vote_average: number;
  vote_count: number;
  poster_path: string;
  backdrop_path: string;
}

let dbInstance: AnyOrama | null = null;
let initPromise: Promise<AnyOrama> | null = null;
const indexedIds = new Set<string>();

/**
 * Maps a generic MediaItem into an OramaMediaDocument with genome enrichment.
 */
function toOramaDoc(item: MediaItem): OramaMediaDocument {
  // Resolve genre names
  const genreNames: string[] = [];
  if (Array.isArray(item.genres) && item.genres.length > 0) {
    for (const g of item.genres) {
      if (g && g.name) genreNames.push(g.name);
    }
  } else if (Array.isArray(item.genre_ids) && item.genre_ids.length > 0) {
    for (const gid of item.genre_ids) {
      const name = TMDB_GENRE_MAP[gid];
      if (name) genreNames.push(name);
    }
  }

  // Resolve thematic genome (themes & nanogenres)
  const mediaType: MediaType = item.media_type || 'movie';
  const genome = resolveMovieGenomeSync(item.id, mediaType, item);

  return {
    id: `${mediaType}_${item.id}`,
    media_id: item.id,
    title: item.title || '',
    original_title: item.original_title || '',
    overview: item.overview || '',
    genres: genreNames,
    themes: genome.themes || [],
    nanogenres: genome.microgenres || [],
    media_type: mediaType,
    release_date: item.release_date || '',
    release_year: item.release_date ? item.release_date.slice(0, 4) : '',
    vote_average: Number(item.vote_average) || 0,
    vote_count: Number(item.vote_count) || 0,
    poster_path: item.poster_path || '',
    backdrop_path: item.backdrop_path || '',
  };
}

/**
 * Maps an OramaMediaDocument back into a standard UI-consumable MediaItem.
 */
function toMediaItem(doc: any): MediaItem {
  return {
    id: doc.media_id,
    title: doc.title,
    original_title: doc.original_title || undefined,
    overview: doc.overview || '',
    poster_path: doc.poster_path || null,
    backdrop_path: doc.backdrop_path || null,
    release_date: doc.release_date || '',
    vote_average: doc.vote_average || 0,
    vote_count: doc.vote_count || 0,
    media_type: (doc.media_type as MediaType) || 'movie',
    genres: (doc.genres || []).map((name: string) => ({ id: 0, name })),
  };
}

/**
 * Initializes and seeds the in-memory Orama database with curated catalogs and top lists.
 */
export async function getOramaSearchEngine(): Promise<AnyOrama> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Ensure genome datasets are loaded for rich theme/nanogenre indexing
    await loadThemesDataset().catch(() => {});

    const db = await create({
      schema: {
        id: 'string',
        media_id: 'number',
        title: 'string',
        original_title: 'string',
        overview: 'string',
        genres: 'string[]',
        themes: 'string[]',
        nanogenres: 'string[]',
        media_type: 'string',
        release_date: 'string',
        release_year: 'string',
        vote_average: 'number',
        vote_count: 'number',
        poster_path: 'string',
        backdrop_path: 'string',
      },
    });

    // Collect initial seed items
    const seedMap = new Map<string, MediaItem>();

    // 1. Curated hero/billboard media
    for (const item of ALL_CURATED_MEDIA) {
      if (item && item.id) {
        seedMap.set(`${item.media_type || 'movie'}_${item.id}`, item);
      }
    }

    // 2. Letterboxd Top 500 Films
    for (const item of letterboxdTop500List) {
      if (item && item.id) {
        seedMap.set(`movie_${item.id}`, item);
      }
    }

    // 3. IMDb Top 200 TV Series
    for (const item of imdbTop200SeriesList) {
      if (item && item.id) {
        seedMap.set(`tv_${item.id}`, item);
      }
    }

    const docs: OramaMediaDocument[] = [];
    for (const item of seedMap.values()) {
      const doc = toOramaDoc(item);
      indexedIds.add(doc.id);
      docs.push(doc);
    }

    if (docs.length > 0) {
      await insertMultiple(db, docs);
    }

    dbInstance = db;

    // When background genome datasets finish loading, refresh themes for indexed titles
    onGenomeDatasetLoaded(async () => {
      try {
        const updates: OramaMediaDocument[] = [];
        for (const item of seedMap.values()) {
          updates.push(toOramaDoc(item));
        }
        for (const doc of updates) {
          await upsert(db, doc);
        }
      } catch (err) {
        console.warn('Orama genome re-indexing completed with warning:', err);
      }
    });

    return db;
  })();

  return initPromise;
}

/**
 * Searches the Orama in-memory database with typo-tolerance, prefix matching, and field boosts.
 *
 * @param query Search query string
 * @param options Limit and optional mediaType filter ('movie' | 'tv')
 * @returns Array of matched MediaItems
 */
export async function searchWithOrama(
  query: string,
  options?: { limit?: number; mediaType?: MediaType }
): Promise<MediaItem[]> {
  const clean = query.trim();
  if (!clean) return [];

  const db = await getOramaSearchEngine();
  const limit = options?.limit || 24;

  const buildParams = (tol: number): Parameters<typeof search>[1] => {
    const params: Parameters<typeof search>[1] = {
      term: clean,
      tolerance: tol,
      limit,
      boost: {
        title: 4.0,
        original_title: 3.0,
        genres: 2.0,
        themes: 2.5,
        nanogenres: 2.5,
        overview: 1.0,
      },
    };
    if (options?.mediaType) {
      params.where = { media_type: options.mediaType };
    }
    return params;
  };

  try {
    // First pass: exact or mild typo (0 for <=4 chars, 1 for >4 chars)
    const initialTol = clean.length <= 4 ? 0 : 1;
    let results = await search(db, buildParams(initialTol));

    // Second pass: if no matches and query is long enough, expand typo tolerance
    if ((!results || !results.hits || results.hits.length === 0) && clean.length > 5) {
      const expandedTol = clean.length > 7 ? 3 : 2;
      results = await search(db, buildParams(expandedTol));
    }

    if (!results || !results.hits || results.hits.length === 0) {
      return [];
    }

    const seen = new Set<number>();
    const mediaItems: MediaItem[] = [];

    for (const hit of results.hits) {
      const doc = hit.document as any;
      if (doc && doc.media_id && !seen.has(doc.media_id)) {
        seen.add(doc.media_id);
        mediaItems.push(toMediaItem(doc));
      }
    }

    return mediaItems;
  } catch (err) {
    console.warn('Orama search encountered an error, falling back:', err);
    return [];
  }
}

/**
 * Dynamically adds or updates a media item into the in-memory search index.
 */
export async function indexMediaItem(item: MediaItem): Promise<void> {
  if (!item || !item.id) return;
  try {
    const db = await getOramaSearchEngine();
    const doc = toOramaDoc(item);
    await upsert(db, doc);
    indexedIds.add(doc.id);
  } catch (err) {
    console.warn(`Failed to index media item #${item.id} into Orama:`, err);
  }
}

/**
 * Checks the count of indexed documents in Orama.
 */
export async function getOramaDocumentCount(): Promise<number> {
  const db = await getOramaSearchEngine();
  return count(db);
}

// Background eager initialization when imported in a browser environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    getOramaSearchEngine().catch(() => {});
  }, 100);
}
