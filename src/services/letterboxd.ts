import type { LetterboxdRawEntry, MediaItem, UserRatingItem } from '../types/movie';
import { TMDB_READ_ACCESS_TOKEN } from './tmdb';

const CACHE_STORAGE_KEY = 'moviewatcher_lb_tmdb_cache_v1';

// In-memory cache for ultra-fast mapping lookups
const memoryCache = new Map<string, MediaItem | null>();

// Initialize memory cache from localStorage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed).forEach(([key, val]) => {
        memoryCache.set(key, val as MediaItem | null);
      });
    }
  }
} catch (e) {
  console.warn('Failed to load Letterboxd mapping cache from localStorage', e);
}

function persistCache() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: Record<string, MediaItem | null> = {};
      // Save last 500 items to avoid localStorage bloat
      let count = 0;
      for (const [k, v] of memoryCache.entries()) {
        obj[k] = v;
        count++;
        if (count >= 500) break;
      }
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    }
  } catch (e) {
    console.warn('Failed to persist Letterboxd cache', e);
  }
}

/**
 * Robust CSV parser that handles quotes, commas inside fields, and arbitrary line endings.
 */
export function parseCSVLines(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Parses Letterboxd export CSVs (ratings.csv, watched.csv, or watchlist.csv).
 */
export function parseLetterboxdCSV(csvText: string): {
  type: 'ratings' | 'watched' | 'watchlist' | 'generic';
  entries: LetterboxdRawEntry[];
} {
  const rows = parseCSVLines(csvText);
  if (rows.length < 2) {
    return { type: 'generic', entries: [] };
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim().replace(/['"]/g, ''));

  // Find column indices
  const nameIndex = headers.findIndex((h) => h === 'name' || h === 'title' || h === 'film');
  const yearIndex = headers.findIndex((h) => h === 'year' || h === 'release year');
  const ratingIndex = headers.findIndex((h) => h === 'rating' || h === 'your rating');
  const dateIndex = headers.findIndex((h) => h === 'date' || h === 'watched date' || h === 'logged date');
  const uriIndex = headers.findIndex((h) => h === 'letterboxd uri' || h === 'uri' || h === 'url');

  if (nameIndex === -1) {
    throw new Error('Invalid Letterboxd CSV: Missing "Name" or "Title" column in header row.');
  }

  let type: 'ratings' | 'watched' | 'watchlist' | 'generic' = 'generic';
  if (ratingIndex !== -1) {
    type = 'ratings';
  } else if (headers.includes('watchlist') || headers.includes('manage')) {
    type = 'watchlist';
  } else if (headers.includes('letterboxd uri')) {
    type = 'watched';
  }

  const entries: LetterboxdRawEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = row[nameIndex];
    if (!title) continue;

    const rawYear = yearIndex !== -1 ? row[yearIndex] : undefined;
    const year = rawYear ? parseInt(rawYear, 10) : undefined;

    const rawRating = ratingIndex !== -1 ? row[ratingIndex] : undefined;
    const rating = rawRating ? parseFloat(rawRating) : undefined;

    const date = dateIndex !== -1 ? row[dateIndex] : undefined;
    const letterboxdUri = uriIndex !== -1 ? row[uriIndex] : undefined;

    entries.push({
      title,
      year: isNaN(year!) ? undefined : year,
      rating: isNaN(rating!) ? undefined : rating,
      date,
      letterboxdUri,
      isWatchlist: type === 'watchlist',
    });
  }

  return { type, entries };
}

/**
 * Calculates recommendation confidence weights based on Letterboxd rating / action:
 * 5.0★ -> 5.0 (Definite favorite)
 * 4.5★ -> 4.5 (Strong love)
 * 4.0★ -> 4.0 (Recommended like)
 * 3.5★ -> 3.0 (Positive)
 * 3.0★ -> 2.0 (Neutral watch)
 * 2.5★ -> 1.5
 * 2.0★ -> 1.0
 * 0.5 - 1.5★ -> 0.5 (Dislike / negative bias)
 * Unrated watched -> 2.5 (Positive implicit signal)
 * Watchlist -> 1.5 (Interest signal)
 */
export function calculateConfidenceWeight(rating?: number, isWatchlist?: boolean): number {
  if (isWatchlist) return 1.5;
  if (rating === undefined || rating === null || isNaN(rating)) return 2.5;

  if (rating >= 4.75) return 5.0;
  if (rating >= 4.25) return 4.5;
  if (rating >= 3.75) return 4.0;
  if (rating >= 3.25) return 3.0;
  if (rating >= 2.75) return 2.0;
  if (rating >= 2.25) return 1.5;
  if (rating >= 1.75) return 1.0;
  return 0.5;
}

function cleanTitleForSearch(title: string): string {
  return title
    .replace(/[–—]/g, '-')
    .replace(/["']/g, '')
    .trim();
}

/**
 * Maps a single Letterboxd title and year to a verified TMDB MediaItem using TMDB search API.
 * Uses in-memory & localStorage caching to avoid redundant network queries.
 */
export async function mapLetterboxdToTMDB(
  title: string,
  year?: number
): Promise<MediaItem | null> {
  const normTitle = title.toLowerCase().trim();
  const cacheKey = `${normTitle}_${year || 'noyear'}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  const cleaned = cleanTitleForSearch(title);

  // Attempt 1: Search movie with exact year
  try {
    let url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(cleaned)}`;
    if (year) {
      url += `&primary_release_year=${year}`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = formatTmdbMovie(data.results[0]);
        memoryCache.set(cacheKey, item);
        persistCache();
        return item;
      }
    }
  } catch (err) {
    console.warn(`TMDB movie search failed for "${title}" (${year})`, err);
  }

  // Attempt 2: If year was provided, try year +/- 1 (Letterboxd festival vs commercial release difference)
  if (year) {
    try {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(cleaned)}&primary_release_year=${year - 1}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const item = formatTmdbMovie(data.results[0]);
          memoryCache.set(cacheKey, item);
          persistCache();
          return item;
        }
      }
    } catch {}
  }

  // Attempt 3: General search multi (covers documentaries or miniseries on Letterboxd like Chernobyl or Dekalog)
  try {
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(cleaned)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        // Find best match matching title or year
        const match = data.results.find((r: any) => {
          const rTitle = (r.title || r.name || '').toLowerCase();
          const rYear = (r.release_date || r.first_air_date || '').slice(0, 4);
          if (year && rYear && Math.abs(parseInt(rYear, 10) - year) <= 1) {
            return true;
          }
          return rTitle === normTitle;
        }) || data.results[0];

        if (match && (match.media_type === 'movie' || match.media_type === 'tv')) {
          const item = formatTmdbMovie(match);
          memoryCache.set(cacheKey, item);
          persistCache();
          return item;
        }
      }
    }
  } catch (err) {
    console.warn(`TMDB multi search fallback failed for "${title}"`, err);
  }

  // No match found
  memoryCache.set(cacheKey, null);
  return null;
}

function formatTmdbMovie(raw: any): MediaItem {
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Untitled',
    original_title: raw.original_title || raw.original_name,
    overview: raw.overview || '',
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    release_date: raw.release_date || raw.first_air_date || '',
    vote_average: raw.vote_average || 0,
    vote_count: raw.vote_count || 0,
    media_type: (raw.media_type as 'movie' | 'tv') || 'movie',
    genre_ids: raw.genre_ids || [],
  };
}

export interface BatchImportProgress {
  processed: number;
  total: number;
  matched: number;
  currentTitle: string;
}

export interface BatchImportResult {
  ratings: UserRatingItem[];
  matchedMedia: MediaItem[];
  unmatchedTitles: string[];
  totalParsed: number;
}

/**
 * Batches Letterboxd entries with controlled concurrency (e.g., 4 at a time)
 * to smoothly map hundreds of movies without triggering 429 rate limits.
 */
export async function batchResolveLetterboxd(
  entries: LetterboxdRawEntry[],
  onProgress?: (progress: BatchImportProgress) => void,
  concurrency = 4
): Promise<BatchImportResult> {
  const ratings: UserRatingItem[] = [];
  const matchedMedia: MediaItem[] = [];
  const unmatchedTitles: string[] = [];

  const total = entries.length;
  let processed = 0;

  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency);

    await Promise.all(
      chunk.map(async (entry) => {
        if (onProgress) {
          onProgress({
            processed,
            total,
            matched: matchedMedia.length,
            currentTitle: entry.title,
          });
        }

        const media = await mapLetterboxdToTMDB(entry.title, entry.year);
        processed++;

        if (media) {
          matchedMedia.push(media);
          const weight = calculateConfidenceWeight(entry.rating, entry.isWatchlist);

          const ratingItem: UserRatingItem = {
            id: media.id,
            type: media.media_type || 'movie',
            title: media.title,
            rating: entry.rating,
            confidenceWeight: weight,
            source: 'letterboxd',
            poster_path: media.poster_path,
            backdrop_path: media.backdrop_path,
            release_date: media.release_date,
            vote_average: media.vote_average,
            genre_ids: media.genre_ids,
            ratedAt: entry.date ? new Date(entry.date).getTime() : Date.now(),
          };

          ratings.push(ratingItem);
        } else {
          unmatchedTitles.push(entry.year ? `${entry.title} (${entry.year})` : entry.title);
        }

        if (onProgress) {
          onProgress({
            processed,
            total,
            matched: matchedMedia.length,
            currentTitle: entry.title,
          });
        }
      })
    );

    // Minor breathing room between concurrency chunks to be gentle on TMDB API
    if (i + concurrency < entries.length) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  return {
    ratings,
    matchedMedia,
    unmatchedTitles,
    totalParsed: total,
  };
}
