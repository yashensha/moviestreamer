import type { MediaItem, MediaType } from '../../types/movie';
import { GENRE_MAP } from '../tmdb';
import type { MovieGenome } from './types';

// In-memory cache for resolved genomes
const genomeCache = new Map<string, MovieGenome>();

// Compact data holders
let movieThemeIds: Record<string, { t: number[]; n: number[] }> | null = null;
let tvThemeIds: Record<string, { t: number[]; n: number[] }> | null = null;
let themesById: Record<string, string> | null = null;
let nanosById: Record<string, string> | null = null;

let movieSubgenresData: Record<string, string[]> | null = null;
let tvSubgenresData: Record<string, any> | null = null;

let isThemesLoading = false;
const themeWaiters: Array<() => void> = [];

// Reactive dataset change listeners
let datasetLoadedVersion = 0;
const datasetListeners = new Set<() => void>();

export function onGenomeDatasetLoaded(cb: () => void): () => void {
  datasetListeners.add(cb);
  return () => {
    datasetListeners.delete(cb);
  };
}

export function getGenomeDatasetVersion(): number {
  return datasetLoadedVersion;
}

function notifyLoaded() {
  genomeCache.clear();
  datasetLoadedVersion++;
  datasetListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error('Error in genome dataset listener', e);
    }
  });
}

/**
 * Lazily loads compact themes and nanogenres mappings (< 4MB total vs 36MB)
 */
export async function loadThemesDataset(): Promise<void> {
  if (movieThemeIds && tvThemeIds && themesById && nanosById) return;
  if (isThemesLoading) {
    return new Promise((resolve) => themeWaiters.push(resolve));
  }

  isThemesLoading = true;
  try {
    const [mIdsMod, tvIdsMod, thLookupMod, nanoLookupMod] = await Promise.all([
      import('../../data/movie_theme_ids.json'),
      import('../../data/tv_theme_ids.json').catch(() => ({ default: {} })),
      import('../../data/themes_lookup.json'),
      import('../../data/nanogenres_lookup.json'),
    ]);

    movieThemeIds = (mIdsMod.default || mIdsMod) as any;
    tvThemeIds = (tvIdsMod.default || tvIdsMod) as any;
    themesById = ((thLookupMod.default || thLookupMod) as any).byId || {};
    nanosById = ((nanoLookupMod.default || nanoLookupMod) as any).byId || {};

    notifyLoaded();
  } catch (err) {
    console.warn('Failed to load compact themes datasets', err);
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
  }, 10);
}

/**
 * Resolves 4-tier genome for any movie or TV show.
 */
export async function resolveMovieGenome(
  id: number,
  type: MediaType = 'movie',
  itemFallback?: Partial<MediaItem>
): Promise<MovieGenome> {
  const cacheKey = `${type}_${id}`;
  const cached = genomeCache.get(cacheKey);
  if (cached && (cached.themes.length > 0 || cached.microgenres.length > 0)) return cached;

  await Promise.all([
    loadThemesDataset(),
    type === 'movie' ? loadMovieSubgenresDataset() : loadTVSubgenresDataset(),
  ]);

  return resolveMovieGenomeSync(id, type, itemFallback);
}

/**
 * Synchronous genome resolver for ultra-fast in-memory and UI card lookups.
 * Resolves numeric IDs to theme and nanogenre names via compact O(1) dictionary lookups.
 */
export function resolveMovieGenomeSync(
  id: number,
  type: MediaType = 'movie',
  itemFallback?: Partial<MediaItem>
): MovieGenome {
  const cacheKey = `${type}_${id}`;
  const cached = genomeCache.get(cacheKey);
  if (cached && (cached.themes.length > 0 || cached.microgenres.length > 0)) return cached;

  const idStr = String(id);
  const themes: string[] = [];
  const microgenres: string[] = [];
  const keywords: string[] = [];
  const genres: string[] = [];

  // 1. Resolve Letterboxd Themes and Nanogenres via Compact IDs
  if (themesById && nanosById) {
    const idMap = type === 'tv' ? tvThemeIds : movieThemeIds;
    if (idMap && idMap[idStr]) {
      const entry = idMap[idStr];
      if (Array.isArray(entry.t)) {
        for (const tid of entry.t) {
          const name = themesById[String(tid)];
          if (name) themes.push(name);
        }
      }
      if (Array.isArray(entry.n)) {
        for (const nid of entry.n) {
          const name = nanosById[String(nid)];
          if (name) microgenres.push(name);
        }
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

  // Only cache if datasets are loaded (avoid caching incomplete early renders)
  if (themesById && nanosById) {
    genomeCache.set(cacheKey, genome);
  }

  return genome;
}
