import type { MediaItem, MediaType } from '../../types/movie';
import { GENRE_MAP } from '../tmdb';
import type { MovieGenome } from './types';

// In-memory cache for resolved genomes
const genomeCache = new Map<string, MovieGenome>();

// Lazy data holder references
let movieThemesData: Record<string, { themes?: string[]; nanogenres?: string[]; genres?: string[] }> | null = null;
let movieSubgenresData: Record<string, string[]> | null = null;
let tvSubgenresData: Record<string, any> | null = null;

let isThemesLoading = false;
const themeWaiters: Array<() => void> = [];

/**
 * Lazily loads Letterboxd themes data in the background
 */
export async function loadThemesDataset(): Promise<void> {
  if (movieThemesData) return;
  if (isThemesLoading) {
    return new Promise((resolve) => themeWaiters.push(resolve));
  }

  isThemesLoading = true;
  try {
    const mod = await import('../../data/movie_themes.json');
    movieThemesData = (mod.default || mod) as any;
  } catch (err) {
    console.warn('Failed to load movie_themes.json', err);
    movieThemesData = {};
  } finally {
    isThemesLoading = false;
    themeWaiters.forEach((cb) => cb());
    themeWaiters.length = 0;
  }
}

/**
 * Lazily loads movie subgenres dataset
 */
export async function loadMovieSubgenresDataset(): Promise<void> {
  if (movieSubgenresData) return;
  try {
    const mod = await import('../../data/movie_subgenres.json');
    movieSubgenresData = (mod.default || mod) as any;
  } catch (err) {
    movieSubgenresData = {};
  }
}

/**
 * Lazily loads TV subgenres dataset
 */
export async function loadTVSubgenresDataset(): Promise<void> {
  if (tvSubgenresData) return;
  try {
    const mod = await import('../../data/tv_subgenres.json');
    tvSubgenresData = (mod.default || mod) as any;
  } catch (err) {
    tvSubgenresData = {};
  }
}

// Background eager load in browser environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    loadThemesDataset().catch(() => {});
    loadMovieSubgenresDataset().catch(() => {});
    loadTVSubgenresDataset().catch(() => {});
  }, 20);
}

/**
 * Resolves 4-tier genome for any movie or TV show.
 * - Tier 1: Themes (40%)
 * - Tier 2: Microgenres (30%)
 * - Tier 3: Keywords (20%)
 * - Tier 4: Broad Genres (10%)
 */
export async function resolveMovieGenome(
  id: number,
  type: MediaType = 'movie',
  itemFallback?: Partial<MediaItem>
): Promise<MovieGenome> {
  const cacheKey = `${type}_${id}`;
  const cached = genomeCache.get(cacheKey);
  if (cached) return cached;

  await Promise.all([
    loadThemesDataset(),
    type === 'movie' ? loadMovieSubgenresDataset() : loadTVSubgenresDataset(),
  ]);

  return resolveMovieGenomeSync(id, type, itemFallback);
}

/**
 * Synchronous genome resolver for ultra-fast in-memory and UI card lookups.
 * Checks in-memory datasets and caches results.
 */
export function resolveMovieGenomeSync(
  id: number,
  type: MediaType = 'movie',
  itemFallback?: Partial<MediaItem>
): MovieGenome {
  const cacheKey = `${type}_${id}`;
  const cached = genomeCache.get(cacheKey);
  if (cached) return cached;

  const idStr = String(id);
  const themes: string[] = [];
  const microgenres: string[] = [];
  const keywords: string[] = [];
  const genres: string[] = [];

  // 1. Check Letterboxd themes dataset
  if (movieThemesData && movieThemesData[idStr]) {
    const themeEntry = movieThemesData[idStr];
    if (Array.isArray(themeEntry.themes)) {
      themes.push(...themeEntry.themes);
    }
    if (Array.isArray(themeEntry.nanogenres)) {
      microgenres.push(...themeEntry.nanogenres);
    }
    if (Array.isArray(themeEntry.genres)) {
      for (const g of themeEntry.genres) {
        if (!genres.includes(g)) genres.push(g);
      }
    }
  }

  // 2. Check movie or TV subgenres
  if (type === 'movie' && movieSubgenresData && movieSubgenresData[idStr]) {
    const tags = movieSubgenresData[idStr];
    for (const tag of tags) {
      if (!keywords.includes(tag) && !microgenres.includes(tag)) {
        if (tag.includes(' ') || tag.includes('-')) {
          microgenres.push(tag);
        } else {
          keywords.push(tag);
        }
      }
    }
  } else if (type === 'tv' && tvSubgenresData && tvSubgenresData[idStr]) {
    const tvEntry = tvSubgenresData[idStr];
    if (Array.isArray(tvEntry.subgenres)) {
      microgenres.push(...tvEntry.subgenres);
    }
    if (Array.isArray(tvEntry.tags)) {
      keywords.push(...tvEntry.tags);
    }
  }

  // 3. Fallback to item genre IDs from TMDB
  if (itemFallback?.genre_ids && itemFallback.genre_ids.length > 0) {
    for (const gid of itemFallback.genre_ids) {
      const gName = GENRE_MAP[gid];
      if (gName && !genres.includes(gName)) {
        genres.push(gName);
      }
    }
  }

  // Deduplicate and trim
  const cleanList = (list: string[]) => Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));

  const genome: MovieGenome = {
    id,
    title: itemFallback?.title || '',
    media_type: type,
    themes: cleanList(themes),
    microgenres: cleanList(microgenres),
    keywords: cleanList(keywords),
    genres: cleanList(genres),
  };

  genomeCache.set(cacheKey, genome);
  return genome;
}
