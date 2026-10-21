import { TMDB } from 'tmdb-ts';
import type { MediaItem, Season, Episode, WatchHistoryItem, UserRatingItem, PersonItem, MultiSearchResult } from '../types/movie';
import { computeUnifiedInteractionMatrix } from './interactionMatrix';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const getPosterUrl = (path: string | null | undefined, size = 'w500'): string => {
  if (!path) return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

export const getBackdropUrl = (path: string | null | undefined, size = 'original'): string => {
  if (!path) return 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=1920&auto=format&fit=crop&q=80';
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

export const getLogoUrl = (path: string | null | undefined, size = 'w500'): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
};

// Pre-resolved high quality English logos for instant zero-delay rendering
const KNOWN_LOGOS: Record<string, string> = {
  'tv-60625': '/wq3wqFLwwqnhG6DxmSji9ehLcx6.png', // Rick and Morty
  'tv-66732': '/e9qFk5zrKZaB2IbbOI9N0W77vlh.svg', // Stranger Things
  'tv-1396': '/chw44B2VnLha8iiTdyZcIW0ZELC.png', // Breaking Bad
  'tv-100088': '/msYtgZbEo8tAOJ37T50kgqulpKf.png', // The Last of Us
  'tv-119051': '/2ns0b8dB0wV6Aebe0wI0LBzkoNN.svg', // Wednesday
  'tv-93405': '/6YFWTX7fiGjWpsnJWLLV4RSbJWd.png', // Squid Game
  'tv-126308': '/eqWtUYYsmW7cPkXzxAF8idOPEX8.png', // Shogun
  'tv-1399': '/6pObznbCoxVpY1lPQwJxETd7Phe.png', // Game of Thrones
  'movie-533535': '/2o48U3kMXGIqRAkKZQ3n5OTWSBy.png', // Deadpool & Wolverine
  'movie-872585': '/b07VisHvZb0WzUpA8VB77wfMXwg.png', // Oppenheimer
  'movie-157336': '/4Hu4w5p0mwL2Wvyk3gqu2JRDGHl.png', // Interstellar
  'movie-27205': '/eS5TjZsO30LTfZISyBbPiXshAKd.png', // Inception
  'movie-155': '/nO5Uix3Qr4WjOyU1BMPv0okyNWm.png', // The Dark Knight
  'movie-569094': '/cmE0j3mQQe6xrzLryxGF9rF2KC8.png', // Spider-Man: Across the Spider-Verse
  'movie-76600': '/r5gjwzikHYWw6MC2Loq77ZDYCeP.png', // Avatar: The Way of Water
  'movie-603': '/xslT5YyQOaqcVKAZxcoq2YbcbEf.svg', // The Matrix
  'movie-1514026': '/wJ3Nfqd0QRHxcXuHQ9i8FEPrjuU.png', // Buddy
};

const LOGO_CACHE_KEY = 'moviewatcher_logos_v2';

const loadLocalLogos = (): Record<string, string | null> => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LOGO_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
};

const localLogos: Record<string, string | null> = loadLocalLogos();

const logoCache = new Map<string, string | null>();

// Initialize in-memory cache with known logos and localStorage logos
Object.entries(KNOWN_LOGOS).forEach(([k, v]) => logoCache.set(k, v));
Object.entries(localLogos).forEach(([k, v]) => {
  if (v) logoCache.set(k, v);
});

// Synchronous lookup for instantaneous zero-delay logo retrieval
export const getCachedLogo = (
  id: number | undefined | null,
  type: 'movie' | 'tv' = 'movie'
): string | null => {
  if (!id) return null;
  const cacheKey = `${type}-${id}`;
  if (KNOWN_LOGOS[cacheKey]) return KNOWN_LOGOS[cacheKey];
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey) || null;
  if (localLogos[cacheKey]) return localLogos[cacheKey];
  return null;
};

export const fetchMediaLogo = async (
  id: number,
  type: 'movie' | 'tv' = 'movie'
): Promise<string | null> => {
  const cacheKey = `${type}-${id}`;
  const cached = getCachedLogo(id, type);
  if (cached) {
    return cached;
  }
  if (logoCache.has(cacheKey) && logoCache.get(cacheKey) === null) {
    return null;
  }

  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/images?include_image_language=en,null`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.logos && data.logos.length > 0) {
        // Prefer English transparent logo, or fallback to first logo
        const enLogo =
          data.logos.find((l: any) => l.iso_639_1 === 'en') || data.logos[0];
        if (enLogo?.file_path) {
          logoCache.set(cacheKey, enLogo.file_path);
          localLogos[cacheKey] = enLogo.file_path;
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(localLogos));
            }
          } catch {}
          return enLogo.file_path;
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch logo for ${type} #${id}`, err);
  }

    logoCache.set(cacheKey, null);
    return null;
  };
  
  const quickInfoCache = new Map<string, { runtime?: number; numberOfSeasons?: number; certification?: string; backdrop_path?: string }>();
  
  export const fetchMediaQuickInfo = async (
    id: number,
    type: 'movie' | 'tv' = 'movie'
  ): Promise<{ runtime?: number; numberOfSeasons?: number; certification?: string; backdrop_path?: string }> => {
    const cacheKey = `${type}-${id}`;
    if (quickInfoCache.has(cacheKey)) {
      return quickInfoCache.get(cacheKey)!;
    }
  
    try {
      const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=release_dates,content_ratings`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        let certification: string | undefined;
  
        if (type === 'movie' && data.release_dates?.results) {
          const us = data.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
          const certObj = us?.release_dates?.find((d: any) => d.certification);
          certification = certObj?.certification;
        } else if (type === 'tv' && data.content_ratings?.results) {
          const us = data.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US');
          certification = us?.rating;
        }
  
        const info = {
          runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || undefined,
          numberOfSeasons: data.number_of_seasons || undefined,
          certification: certification || (type === 'tv' ? 'TV-14' : 'PG-13'),
          backdrop_path: data.backdrop_path || undefined,
        };
        quickInfoCache.set(cacheKey, info);
        return info;
      }
    } catch (err) {
      console.warn(`Quick info fetch failed for ${type} #${id}`, err);
    }
  
    const fallback = {
      runtime: type === 'movie' ? 118 : undefined,
      numberOfSeasons: type === 'tv' ? 1 : undefined,
      certification: type === 'tv' ? 'TV-14' : 'PG-13',
    };
    quickInfoCache.set(cacheKey, fallback);
    return fallback;
  };
  
  const creditsCache = new Map<string, string[]>();

export const fetchCredits = async (
  id: number,
  type: 'movie' | 'tv' = 'tv'
): Promise<string[]> => {
  const cacheKey = `${type}-${id}`;
  if (creditsCache.has(cacheKey)) {
    return creditsCache.get(cacheKey) || [];
  }

  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/credits`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.cast && data.cast.length > 0) {
        const castNames = data.cast.slice(0, 5).map((c: any) => c.name);
        creditsCache.set(cacheKey, castNames);
        return castNames;
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch credits for ${type} #${id}`, err);
  }

  creditsCache.set(cacheKey, []);
  return [];
};

const recommendationsCache = new Map<string, MediaItem[]>();

export const fetchRecommendations = async (
  id: number,
  type: 'movie' | 'tv' = 'movie'
): Promise<MediaItem[]> => {
  const cacheKey = `${type}-${id}`;
  if (recommendationsCache.has(cacheKey)) {
    return recommendationsCache.get(cacheKey) || [];
  }

  const mapResult = (item: any): MediaItem => ({
    id: item.id,
    title: item.title || item.name || 'Untitled',
    original_title: item.original_title || item.original_name,
    overview: item.overview || '',
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    release_date: item.release_date || item.first_air_date || '',
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    media_type: (item.media_type as 'movie' | 'tv') || type,
    genre_ids: item.genre_ids || [],
  });

  // 1. Try recommendations endpoint
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/recommendations`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const valid = data.results
          .filter((item: any) => item.poster_path && item.id !== id)
          .map(mapResult);
        if (valid.length > 0) {
          recommendationsCache.set(cacheKey, valid.slice(0, 12));
          return valid.slice(0, 12);
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch recommendations for ${type} #${id}`, err);
  }

  // 2. Fallback to similar endpoint
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/similar`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const valid = data.results
          .filter((item: any) => item.poster_path && item.id !== id)
          .map(mapResult);
        if (valid.length > 0) {
          recommendationsCache.set(cacheKey, valid.slice(0, 12));
          return valid.slice(0, 12);
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch similar for ${type} #${id}`, err);
  }

  // 3. Fallback with API key query param
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const valid = data.results
          .filter((item: any) => item.poster_path && item.id !== id)
          .map(mapResult);
        if (valid.length > 0) {
          recommendationsCache.set(cacheKey, valid.slice(0, 12));
          return valid.slice(0, 12);
        }
      }
    }
  } catch (err) {
    console.warn(`Fallback fetch recommendations failed for ${type} #${id}`, err);
  }

  // 4. Default fallback: genre/type-matched curated items
  const fallback = ALL_CURATED_MEDIA.filter(
    (m) => m.id !== id && m.media_type === type
  );
  const result = (fallback.length >= 4 ? fallback : ALL_CURATED_MEDIA.filter((m) => m.id !== id)).slice(0, 12);
  recommendationsCache.set(cacheKey, result);
  return result;
};

export const GENRE_MAP: Record<number, string> = {
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

export interface TailoredSuggestionsResult {
  items: MediaItem[];
  reason: string;
  sourceTitles: string[];
  topGenres: string[];
}

export const fetchTailoredSuggestions = async (
  likedMedia: MediaItem[],
  watchHistory: WatchHistoryItem[],
  preferredType?: 'movie' | 'tv',
  userRatings?: UserRatingItem[]
): Promise<TailoredSuggestionsResult> => {
  // Compute Unified Interaction Matrix across Letterboxd ratings, in-app hearts, and streaming dwell
  const matrix = computeUnifiedInteractionMatrix(watchHistory, likedMedia, userRatings);

  // If no user signals exist yet
  if (matrix.itemCount === 0) {
    return {
      items: [],
      reason: 'Like titles, rate films, or stream to train your personalized taste matrix in real time.',
      sourceTitles: [],
      topGenres: [],
    };
  }

  // 1. Gather all excluded IDs:
  // - Already watched or liked items
  // - Hard-filtered titles (Letterboxd 1★–2★ ratings: 0.0 weight / negative filter)
  const excludedIds = new Set<number>([
    ...(likedMedia || []).map((m) => m.id),
    ...(watchHistory || []).map((w) => w.id),
    ...(userRatings || []).map((r) => r.id),
    ...matrix.hardFilteredIds,
  ]);

  // 2. Select priority seeds from positiveSeeds (sorted by normalizedWeight: 5.0, 4.0, 3.5...)
  const seeds: { id: number; type: 'movie' | 'tv'; title: string; weight: number; signal: string }[] = [];
  const seedIds = new Set<number>();

  for (const item of matrix.positiveSeeds) {
    if (!seedIds.has(item.id) && seeds.length < 4) {
      seeds.push({
        id: item.id,
        type: item.type,
        title: item.title,
        weight: item.normalizedWeight,
        signal: item.primarySignal,
      });
      seedIds.add(item.id);
    }
  }

  // Fallback to any positive interaction if positiveSeeds is small
  if (seeds.length < 3) {
    for (const item of matrix.interactions) {
      if (!item.isHardFiltered && !seedIds.has(item.id) && seeds.length < 3) {
        seeds.push({
          id: item.id,
          type: item.type,
          title: item.title,
          weight: item.normalizedWeight,
          signal: item.primarySignal,
        });
        seedIds.add(item.id);
      }
    }
  }

  const topGenreNames = matrix.topGenres.map((g) => g.name);

  // 3. Query TMDB recommendations for all seeds in parallel
  const recsPromises = seeds.map((s) => fetchRecommendations(s.id, s.type));
  const recsResults = await Promise.allSettled(recsPromises);

  const candidateMap = new Map<number, { item: MediaItem; score: number }>();

  recsResults.forEach((res, index) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      const seed = seeds[index];
      // Seed weight scaled by BM25 normalized affinity
      const seedWeight = seed ? Math.max(1, Math.min(seed.weight, 5)) : 2;

      res.value.forEach((media, rank) => {
        // Enforce hard-filter exclusion: never recommend movies the user disliked (1-2★)
        if (!excludedIds.has(media.id) && media.poster_path) {
          // Calculate BM25 genre affinity boost for candidate
          const genreBoost = (media.genre_ids || []).reduce((acc, gid) => {
            return acc + (matrix.genreWeights[gid] || 0) * 0.15;
          }, 0);

          const rankScore = (14 - rank) * seedWeight + (media.vote_average || 7.0) + genreBoost;
          const existing = candidateMap.get(media.id);
          if (existing) {
            existing.score += rankScore;
          } else {
            candidateMap.set(media.id, { item: media, score: rankScore });
          }
        }
      });
    }
  });

  let candidates = Array.from(candidateMap.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => c.item);

  if (preferredType) {
    const matched = candidates.filter((item) => item.media_type === preferredType);
    if (matched.length >= 6) {
      candidates = matched;
    } else {
      candidates = [...matched, ...candidates.filter((item) => item.media_type !== preferredType)];
    }
  }

  const sortedItems = candidates.slice(0, 18);

  // 4. Construct a natural human-friendly explanation reflecting the weighted matrix
  let reason = '';
  const sourceTitles = seeds.map((s) => s.title);

  if (seeds.length > 0) {
    const topSeed = seeds[0];
    if (topSeed.signal === 'letterboxd_5' || topSeed.signal === 'letterboxd_4') {
      reason = `Based on your top-rated Letterboxd film "${topSeed.title}"`;
    } else if (topSeed.signal === 'heart') {
      reason = `Because you loved "${topSeed.title}"`;
    } else if (topSeed.signal === 'completed') {
      reason = `Because you watched "${topSeed.title}"`;
    } else {
      reason = `Based on "${topSeed.title}"`;
    }

    if (seeds.length > 1 && !reason.includes('and')) {
      reason += ` & "${seeds[1].title}"`;
    }
  }

  if (topGenreNames.length > 0) {
    if (reason) {
      reason += ` · Tailored to your taste in ${topGenreNames.slice(0, 2).join(' & ')}`;
    } else {
      reason = `Curated for your top affinities in ${topGenreNames.slice(0, 3).join(', ')}`;
    }
  }

  return {
    items: sortedItems,
    reason: reason.trim() || 'Curated by your Unified Taste Matrix',
    sourceTitles,
    topGenres: topGenreNames,
  };
};

// Hardcoded TMDB Credentials
export const TMDB_READ_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MjMwZGZkNDdmYmMxMDA5YzU5ZWY4MjA5ZTIxZTIyNyIsIm5iZiI6MTc5MjE1NTY1MC41NDMsInN1YiI6IjZhZDIyMDAyMzlmOTM4ZWY4OGY4MDdhNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VtCzdSniVBzjYY8aoaMrOkzaV2F6V5zmhe6EG9vevcs';

export const TMDB_API_KEY = '7230dfd47fbc1009c59ef8209e21e227';

export const getStoredTmdbKey = (): string => {
  return TMDB_READ_ACCESS_TOKEN;
};

export const setStoredTmdbKey = (key: string) => {
  if (key.trim()) {
    localStorage.setItem('tmdb_api_key', key.trim());
  } else {
    localStorage.removeItem('tmdb_api_key');
  }
};

// Clear any stale local keys that might disrupt API calls
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('tmdb_api_key');
    if (stored && (!stored.startsWith('ey') || stored.length < 50)) {
      localStorage.removeItem('tmdb_api_key');
    }
  } catch (e) {
    // ignore
  }
}

const defaultTmdbClient = new TMDB(TMDB_READ_ACCESS_TOKEN);

export const getTmdbClient = (): TMDB => {
  return defaultTmdbClient;
};

// Curated Movies catalog for instant baseline
export const CURATED_MOVIES: MediaItem[] = [
  {
    id: 1007757,
    title: 'Parthenope',
    overview: 'The journey of Parthenope, from her birth in the waters of Naples in 1950 through the seasons of her youth, love, and life in a city both seductive and tragic.',
    poster_path: '/7Xg7u1aYhQ6gT3n7Nq00P9z03j9.jpg',
    backdrop_path: '/b08b5383569d6b2c2194a2faadfa0c7e.jpg',
    release_date: '2024-10-24',
    vote_average: 7.2,
    vote_count: 340,
    media_type: 'movie',
    runtime: 136,
    certification: 'TV-MA',
    tagline: 'See Naples and then live.',
    genres: [{ id: 18, name: 'Drama' }, { id: 14, name: 'Fantasy' }],
  },
  {
    id: 693134,
    title: 'Dune: Part Two',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdrop_path: '/xOMo8BRK7PfcJv9JCnx7s520QIq.jpg',
    release_date: '2024-02-27',
    vote_average: 8.2,
    vote_count: 5420,
    media_type: 'movie',
    runtime: 166,
    certification: 'PG-13',
    tagline: 'Long live the fighters.',
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 12, name: 'Adventure' }],
  },
  {
    id: 533535,
    title: 'Deadpool & Wolverine',
    overview: 'A listless Wade Wilson toils away in civilian life with his days as Deadpool behind him. But when his homeworld faces an existential threat, he reluctantly suits up again with a defeated Wolverine.',
    poster_path: '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdrop_path: '/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    release_date: '2024-07-24',
    vote_average: 7.7,
    vote_count: 6100,
    media_type: 'movie',
    runtime: 128,
    certification: 'R',
    tagline: 'Come together.',
    genres: [{ id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }],
  },
  {
    id: 872585,
    title: 'Oppenheimer',
    overview: 'The story of J. Robert Oppenheimer’s role in the development of the atomic bomb during World War II and the intense political fallout that followed.',
    poster_path: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdrop_path: '/rLb2cwF3Pazuxaj0sytQukGLYoc.jpg',
    release_date: '2023-07-19',
    vote_average: 8.1,
    vote_count: 9200,
    media_type: 'movie',
    runtime: 180,
    certification: 'R',
    tagline: 'The world forever changes.',
    genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' }],
  },
  {
    id: 157336,
    title: 'Interstellar',
    overview: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival beyond a dying Earth.',
    poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_path: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    release_date: '2014-11-05',
    vote_average: 8.4,
    vote_count: 35400,
    media_type: 'movie',
    runtime: 169,
    certification: 'PG-13',
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    genres: [{ id: 12, name: 'Adventure' }, { id: 878, name: 'Sci-Fi' }],
  },
  {
    id: 27205,
    title: 'Inception',
    overview: 'A skilled thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
    poster_path: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
    backdrop_path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    release_date: '2010-07-15',
    vote_average: 8.4,
    vote_count: 36700,
    media_type: 'movie',
    runtime: 148,
    certification: 'PG-13',
    tagline: 'Your mind is the scene of the crime.',
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }],
  },
  {
    id: 155,
    title: 'The Dark Knight',
    overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdrop_path: '/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg',
    release_date: '2008-07-16',
    vote_average: 8.5,
    vote_count: 33100,
    media_type: 'movie',
    runtime: 152,
    certification: 'PG-13',
    tagline: 'Welcome to a world without rules.',
    genres: [{ id: 18, name: 'Drama' }, { id: 28, name: 'Action' }],
  },
  {
    id: 569094,
    title: 'Spider-Man: Across the Spider-Verse',
    overview: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.',
    poster_path: '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdrop_path: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',
    release_date: '2023-05-31',
    vote_average: 8.4,
    vote_count: 7100,
    media_type: 'movie',
    runtime: 140,
    certification: 'PG',
    tagline: 'It\'s how you wear the mask that matters.',
    genres: [{ id: 16, name: 'Animation' }, { id: 28, name: 'Action' }],
  },
  {
    id: 76600,
    title: 'Avatar: The Way of Water',
    overview: 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora. Once a familiar threat returns to finish what was previously started, Jake must work with Neytiri and the army of the Na\'vi to protect their home.',
    poster_path: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    backdrop_path: '/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg',
    release_date: '2022-12-14',
    vote_average: 7.6,
    vote_count: 11400,
    media_type: 'movie',
    runtime: 192,
    certification: 'PG-13',
    tagline: 'Return to Pandora.',
    genres: [{ id: 878, name: 'Sci-Fi' }, { id: 12, name: 'Adventure' }],
  },
  {
    id: 603,
    title: 'The Matrix',
    overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    backdrop_path: '/l4QHerTSbflqI0iQv4r1Z4Y2Z9W.jpg',
    release_date: '1999-03-30',
    vote_average: 8.2,
    vote_count: 25600,
    media_type: 'movie',
    runtime: 136,
    certification: 'R',
    tagline: 'Welcome to the Real World.',
    genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Sci-Fi' }],
  }
];

// Curated Netflix TV Series catalog
export const CURATED_SERIES: MediaItem[] = [
  {
    id: 60625,
    title: 'Rick and Morty',
    overview: 'Rick is a mentally-unbalanced but scientifically gifted old man who has recently reconnected with his family. He spends most of his time involving his young grandson Morty in dangerous, outlandish adventures throughout space and alternate universes.',
    poster_path: '/gdIrmAy2zjhOd6ucBhWiK29xHQQ.jpg',
    backdrop_path: '/uWVkLj94zFvhxS4e1wom2rBvlN9.jpg',
    release_date: '2013-12-02',
    vote_average: 8.7,
    vote_count: 9800,
    media_type: 'tv',
    number_of_seasons: 7,
    number_of_episodes: 71,
    certification: 'TV-MA',
    tagline: 'Science makes sense, family doesn\'t.',
    genres: [{ id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' }, { id: 10765, name: 'Sci-Fi & Fantasy' }],
  },
  {
    id: 66732,
    title: 'Stranger Things',
    overview: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    poster_path: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdrop_path: '/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    release_date: '2016-07-15',
    vote_average: 8.6,
    vote_count: 17200,
    media_type: 'tv',
    number_of_seasons: 4,
    number_of_episodes: 34,
    certification: 'TV-14',
    tagline: 'Every ending has a beginning.',
    genres: [{ id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }, { id: 10765, name: 'Sci-Fi & Fantasy' }],
  },
  {
    id: 1396,
    title: 'Breaking Bad',
    overview: 'Walter White, a New Mexico chemistry teacher diagnosed with terminal lung cancer, teams up with a former student to manufacture and sell methamphetamine.',
    poster_path: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    release_date: '2008-01-20',
    vote_average: 8.9,
    vote_count: 14500,
    media_type: 'tv',
    number_of_seasons: 5,
    number_of_episodes: 62,
    certification: 'TV-MA',
    tagline: 'Remember my name.',
    genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
  },
  {
    id: 100088,
    title: 'The Last of Us',
    overview: 'Twenty years after a fungal outbreak ravages the planet, survivors Joel and Ellie must navigate a brutal, post-apocalyptic United States.',
    poster_path: '/uKvVjHNqB5VmOrdxqAt2V7JMrRI.jpg',
    backdrop_path: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    release_date: '2023-01-15',
    vote_average: 8.6,
    vote_count: 5300,
    media_type: 'tv',
    number_of_seasons: 1,
    number_of_episodes: 9,
    certification: 'TV-MA',
    tagline: 'When you\'re lost in the darkness, look for the light.',
    genres: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Action & Adventure' }],
  },
  {
    id: 119051,
    title: 'Wednesday',
    overview: 'Wednesday Addams misadventures as a student at Nevermore Academy: a very unique boarding school where she attempts to master her emerging psychic ability.',
    poster_path: '/9PFonBhy4cQy7Jz20NpMygczOkv.jpg',
    backdrop_path: '/iHSwvFe7FdFFRmEN09y979W0Z0E.jpg',
    release_date: '2022-11-23',
    vote_average: 8.4,
    vote_count: 8400,
    media_type: 'tv',
    number_of_seasons: 1,
    number_of_episodes: 8,
    certification: 'TV-14',
    tagline: 'Smart, sarcastic and a little dead inside.',
    genres: [{ id: 35, name: 'Comedy' }, { id: 9648, name: 'Mystery' }],
  },
  {
    id: 93405,
    title: 'Squid Game',
    overview: 'Hundreds of cash-strapped players accept a strange invitation to compete in children\'s games. Inside, a tempting prize awaits with deadly high stakes.',
    poster_path: '/dDlGKaq6b6H4zC8R1Gq8cOaH647.jpg',
    backdrop_path: '/top42385108035181050215801.jpg',
    release_date: '2021-09-17',
    vote_average: 7.8,
    vote_count: 14200,
    media_type: 'tv',
    number_of_seasons: 2,
    number_of_episodes: 9,
    certification: 'TV-MA',
    tagline: '45.6 Billion Won is Child\'s Play.',
    genres: [{ id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }],
  },
  {
    id: 126308,
    title: 'Shōgun',
    overview: 'In 1600 Japan, Lord Yoshii Toranaga is fighting for his life as his enemies on the Council of Regents unite against him, when a mysterious European ship is found marooned.',
    poster_path: '/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
    backdrop_path: '/5zmiBoMzeWKVv005aqq79x18kmV.jpg',
    release_date: '2024-02-27',
    vote_average: 8.5,
    vote_count: 1200,
    media_type: 'tv',
    number_of_seasons: 1,
    number_of_episodes: 10,
    certification: 'TV-MA',
    tagline: 'Duty. Honor. Destiny.',
    genres: [{ id: 18, name: 'Drama' }, { id: 10768, name: 'War & Politics' }],
  }
];

export const ALL_CURATED_MEDIA = [...CURATED_MOVIES, ...CURATED_SERIES];

// Global Multi-Entity Search (Movies, TV Shows & People / Cast / Directors)
export const multiSearchWithTMDB = async (query: string): Promise<MultiSearchResult> => {
  const clean = query.trim();
  if (!clean) return { media: [], people: [] };

  const parseMediaItem = (item: any): MediaItem => ({
    id: item.id,
    title: item.title || item.name || 'Untitled',
    original_title: item.original_title || item.original_name,
    overview: item.overview || '',
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    release_date: item.release_date || item.first_air_date || '',
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    media_type: (item.media_type as 'movie' | 'tv') || 'movie',
    genre_ids: item.genre_ids || [],
  });

  const parsePersonItem = (item: any): PersonItem => ({
    id: item.id,
    name: item.name || 'Unknown',
    profile_path: item.profile_path ?? null,
    known_for_department: item.known_for_department || 'Acting',
    known_for: (item.known_for || [])
      .filter((k: any) => (k.media_type === 'movie' || k.media_type === 'tv') && (k.poster_path || k.backdrop_path))
      .map(parseMediaItem),
  });

  const finalizeResults = (rawMedia: any[], rawPeople: any[]): MultiSearchResult => {
    const qLower = clean.toLowerCase();

    // 1. Filter out items without posters or backdrops
    let media = rawMedia
      .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && (item.poster_path || item.backdrop_path))
      .map(parseMediaItem);

    // 2. Sort by relevance: Exact matches first, then popularity / vote_count
    media.sort((a, b) => {
      const aExact = a.title.toLowerCase() === qLower ? 2 : a.title.toLowerCase().startsWith(qLower) ? 1 : 0;
      const bExact = b.title.toLowerCase() === qLower ? 2 : b.title.toLowerCase().startsWith(qLower) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return (b.vote_count || 0) - (a.vote_count || 0);
    });

    const people = rawPeople
      .filter((item: any) => item.media_type === 'person')
      .map(parsePersonItem);

    // 3. Merge matching local curated items at the top if title matches
    const localMatches = ALL_CURATED_MEDIA.filter((m) =>
      m.title.toLowerCase().includes(qLower)
    );

    const seen = new Set<number>();
    const mergedMedia: MediaItem[] = [];

    // Prioritize exact curated match if any
    for (const item of [...localMatches, ...media]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        mergedMedia.push(item);
      }
    }

    // 4. If search query matches an actor or director with known works and few media results, add their known works
    if (mergedMedia.length < 4 && people.length > 0) {
      for (const p of people) {
        if (p.known_for) {
          for (const k of p.known_for) {
            if (!seen.has(k.id)) {
              seen.add(k.id);
              mergedMedia.push(k);
            }
          }
        }
      }
    }

    return { media: mergedMedia, people };
  };

  // Method 1: Use tmdb-ts client with the Read Access Token
  try {
    const client = getTmdbClient();
    const res = await client.search.multi({ query: clean });
    if (res && res.results && res.results.length > 0) {
      const result = finalizeResults(res.results, res.results);
      if (result.media.length > 0 || result.people.length > 0) {
        return result;
      }
    }
  } catch (err) {
    console.warn('tmdb-ts multi search encountered an issue, attempting direct fetch:', err);
  }

  // Method 2: Direct fetch to TMDB API with API Key
  try {
    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(clean)}&api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return finalizeResults(data.results, data.results);
      }
    }
  } catch (err) {
    console.error('Direct TMDB API search failed:', err);
  }

  // Method 3: Search within local catalog fallback
  const q = clean.toLowerCase();
  const localMedia = ALL_CURATED_MEDIA.filter(
    (m) =>
      m.title.toLowerCase().includes(q) ||
      (m.overview && m.overview.toLowerCase().includes(q))
  );
  return { media: localMedia, people: [] };
};

// Legacy single-array wrapper for backward compatibility
export const searchWithTMDB = async (query: string): Promise<MediaItem[]> => {
  const result = await multiSearchWithTMDB(query);
  return result.media;
};

// Fetch person combined credits (filmography for actors & directors)
export const fetchPersonCombinedCredits = async (personId: number): Promise<MediaItem[]> => {
  try {
    const url = `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const combined = [...(data.cast || []), ...(data.crew || [])];
      const seen = new Set<number>();
      return combined
        .filter((item: any) => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return (item.media_type === 'movie' || item.media_type === 'tv') && (item.poster_path || item.backdrop_path);
        })
        .map((item: any) => ({
          id: item.id,
          title: item.title || item.name || 'Untitled',
          original_title: item.original_title || item.original_name,
          overview: item.overview || '',
          poster_path: item.poster_path ?? null,
          backdrop_path: item.backdrop_path ?? null,
          release_date: item.release_date || item.first_air_date || '',
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          media_type: (item.media_type as 'movie' | 'tv') || 'movie',
          genre_ids: item.genre_ids || [],
        }))
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    }
  } catch (err) {
    console.warn(`Failed to fetch credits for person #${personId}`, err);
  }
  return [];
};

// Fetch TV Season details & episodes using tmdb-ts with fallback
export const fetchSeasonEpisodes = async (
  tvId: number,
  seasonNumber: number
): Promise<Episode[]> => {
  // Method 1: tmdb-ts
  try {
    const client = getTmdbClient();
    const seasonData = await client.tvShows.season(tvId, seasonNumber);
    if (seasonData && seasonData.episodes && seasonData.episodes.length > 0) {
      return seasonData.episodes.map((ep: any) => ({
        id: ep.id,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || 'No description available.',
        still_path: ep.still_path ?? null,
        runtime: ep.runtime,
        vote_average: ep.vote_average,
      }));
    }
  } catch (err) {
    console.warn(`tmdb-ts fetch season failed for #${tvId} S${seasonNumber}, trying direct API:`, err);
  }

  // Method 2: Direct API fetch
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.episodes && data.episodes.length > 0) {
        return data.episodes.map((ep: any) => ({
          id: ep.id,
          episode_number: ep.episode_number,
          season_number: ep.season_number,
          name: ep.name || `Episode ${ep.episode_number}`,
          overview: ep.overview || 'No description available.',
          still_path: ep.still_path ?? null,
          runtime: ep.runtime,
          vote_average: ep.vote_average,
        }));
      }
    }
  } catch (err) {
    console.error('Direct TMDB API season fetch failed:', err);
  }

  // Fallback synthetic episodes
  const count = seasonNumber === 1 ? 8 : 10;
  return Array.from({ length: count }, (_, i) => ({
    id: tvId * 1000 + seasonNumber * 100 + (i + 1),
    episode_number: i + 1,
    season_number: seasonNumber,
    name: `Chapter ${i + 1}`,
    overview: `Season ${seasonNumber}, Episode ${i + 1}.`,
    still_path: null,
    runtime: 50,
    vote_average: 8.0,
  }));
};

// Fetch trending media for home rows
export const fetchTrendingMedia = async (): Promise<MediaItem[]> => {
  try {
    const client = getTmdbClient();
    const res = await client.trending.trending('all', 'week');
    if (res && res.results && res.results.length > 0) {
      const items = res.results
        .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
        .map((item: any) => {
          const mType = (item.media_type as 'movie' | 'tv') || 'movie';
          return {
            id: item.id,
            title: item.title || item.name || 'Untitled',
            original_title: item.original_title || item.original_name,
            overview: item.overview || '',
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
            release_date: item.release_date || item.first_air_date || '',
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
            media_type: mType,
            genre_ids: item.genre_ids || [],
            logo_path: getCachedLogo(item.id, mType) || null,
          };
        });

      // Pre-fetch logos for top 8 items concurrently so hero has them instantly
      const heroBatch = items.slice(0, 8);
      await Promise.allSettled(
        heroBatch.map(async (item) => {
          if (!item.logo_path) {
            const logo = await fetchMediaLogo(item.id, item.media_type);
            if (logo) {
              item.logo_path = logo;
            }
          }
          if (item.logo_path && typeof window !== 'undefined') {
            const img = new Image();
            img.src = `${TMDB_IMAGE_BASE}/w500${item.logo_path}`;
          }
        })
      );

      return items;
    }
  } catch (err) {
    console.warn('tmdb-ts trending error, trying direct API:', err);
  }

  // Direct fetch fallback
  try {
    const res = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return data.results
          .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
          .map((item: any) => ({
            id: item.id,
            title: item.title || item.name || 'Untitled',
            original_title: item.original_title || item.original_name,
            overview: item.overview || '',
            poster_path: item.poster_path ?? null,
            backdrop_path: item.backdrop_path ?? null,
            release_date: item.release_date || item.first_air_date || '',
            vote_average: item.vote_average || 0,
            vote_count: item.vote_count || 0,
            media_type: (item.media_type as 'movie' | 'tv') || 'movie',
            genre_ids: item.genre_ids || [],
          }));
      }
    }
  } catch (err) {
    console.error('Direct TMDB API trending fetch failed:', err);
  }

  return CURATED_MOVIES;
};

// Fetch TV Shows row
export const fetchPopularSeries = async (): Promise<MediaItem[]> => {
  try {
    const client = getTmdbClient();
    const res = await client.tvShows.popular();
    if (res && res.results && res.results.length > 0) {
      return res.results.map((item: any) => ({
        id: item.id,
        title: item.name || 'Untitled',
        original_title: item.original_name,
        overview: item.overview || '',
        poster_path: item.poster_path ?? null,
        backdrop_path: item.backdrop_path ?? null,
        release_date: item.first_air_date || '',
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        media_type: 'tv',
        genre_ids: item.genre_ids || [],
      }));
    }
  } catch (err) {
    console.warn('tmdb-ts popular tv error, trying direct API:', err);
  }

  try {
    const res = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return data.results.map((item: any) => ({
          id: item.id,
          title: item.name || 'Untitled',
          original_title: item.original_name,
          overview: item.overview || '',
          poster_path: item.poster_path ?? null,
          backdrop_path: item.backdrop_path ?? null,
          release_date: item.first_air_date || '',
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          media_type: 'tv',
          genre_ids: item.genre_ids || [],
        }));
      }
    }
  } catch (err) {
    console.error('Direct TMDB API popular tv fetch failed:', err);
  }

  return CURATED_SERIES;
};

// Fetch Popular Movies row
export const fetchPopularMovies = async (): Promise<MediaItem[]> => {
  try {
    const client = getTmdbClient();
    const res = await client.movies.popular();
    if (res && res.results && res.results.length > 0) {
      return res.results.map((item: any) => ({
        id: item.id,
        title: item.title || 'Untitled',
        original_title: item.original_title,
        overview: item.overview || '',
        poster_path: item.poster_path ?? null,
        backdrop_path: item.backdrop_path ?? null,
        release_date: item.release_date || '',
        vote_average: item.vote_average || 0,
        vote_count: item.vote_count || 0,
        media_type: 'movie',
        genre_ids: item.genre_ids || [],
      }));
    }
  } catch (err) {
    console.warn('tmdb-ts popular movie error, trying direct API:', err);
  }

  try {
    const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return data.results.map((item: any) => ({
          id: item.id,
          title: item.title || 'Untitled',
          original_title: item.original_title,
          overview: item.overview || '',
          poster_path: item.poster_path ?? null,
          backdrop_path: item.backdrop_path ?? null,
          release_date: item.release_date || '',
          vote_average: item.vote_average || 0,
          vote_count: item.vote_count || 0,
          media_type: 'movie',
          genre_ids: item.genre_ids || [],
        }));
      }
    }
  } catch (err) {
    console.error('Direct TMDB API popular movie fetch failed:', err);
  }

  return CURATED_MOVIES;
};

// Fetch media tags / keywords (for Netflix "This show/movie is: ..." tags)
export const fetchMediaKeywords = async (
  id: number,
  type: 'movie' | 'tv' = 'movie'
): Promise<string[]> => {
  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/keywords?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const list = type === 'tv' ? data.results : data.keywords;
      if (Array.isArray(list) && list.length > 0) {
        return list
          .slice(0, 5)
          .map((k: { name: string }) =>
            k.name
              .split(' ')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          );
      }
    }
  } catch (err) {
    console.warn(`Failed to fetch keywords for ${type} #${id}`, err);
  }
  return [];
};

// Fetch full details of an item (movie or TV) for the Inner Page
export const fetchMediaDetails = async (
  id: number,
  type: 'movie' | 'tv'
): Promise<MediaItem | null> => {
  // Method 1: tmdb-ts
  try {
    const client = getTmdbClient();
    if (type === 'tv') {
      const d = await client.tvShows.details(id);
      if (d) {
        const seasons: Season[] = (d.seasons || [])
          .filter((s: any) => s.season_number > 0) // filter out specials (season 0) if desired, or keep all
          .map((s: any) => ({
            id: s.id,
            season_number: s.season_number,
            name: s.name,
            overview: s.overview || '',
            poster_path: s.poster_path ?? null,
            episode_count: s.episode_count || 8,
          }));

        const episodeRunTime = (d.episode_run_time && d.episode_run_time.length > 0)
          ? d.episode_run_time
          : (d as any).last_episode_to_air?.runtime
          ? [(d as any).last_episode_to_air.runtime]
          : undefined;

        return {
          id: d.id,
          title: d.name || 'Untitled',
          original_title: d.original_name,
          overview: d.overview || '',
          poster_path: d.poster_path ?? null,
          backdrop_path: d.backdrop_path ?? null,
          release_date: d.first_air_date || '',
          vote_average: d.vote_average || 0,
          vote_count: d.vote_count || 0,
          media_type: 'tv',
          genres: d.genres,
          number_of_seasons: d.number_of_seasons || seasons.length,
          number_of_episodes: d.number_of_episodes || 0,
          seasons: seasons.length > 0 ? seasons : undefined,
          episode_run_time: episodeRunTime,
          tagline: d.tagline,
        };
      }
    } else {
      const d = await client.movies.details(id);
      if (d) {
        return {
          id: d.id,
          title: d.title || 'Untitled',
          original_title: d.original_title,
          overview: d.overview || '',
          poster_path: d.poster_path ?? null,
          backdrop_path: d.backdrop_path ?? null,
          release_date: d.release_date || '',
          vote_average: d.vote_average || 0,
          vote_count: d.vote_count || 0,
          media_type: 'movie',
          genres: d.genres,
          tagline: d.tagline,
        };
      }
    }
  } catch (err) {
    console.warn(`tmdb-ts details failed for #${id}, trying direct API:`, err);
  }

  // Method 2: Direct API fetch
  try {
    const endpoint = type === 'tv' ? `tv/${id}` : `movie/${id}`;
    const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_API_KEY}`);
    if (res.ok) {
      const d = await res.json();
      if (type === 'tv') {
        const seasons: Season[] = (d.seasons || [])
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => ({
            id: s.id,
            season_number: s.season_number,
            name: s.name,
            overview: s.overview || '',
            poster_path: s.poster_path ?? null,
            episode_count: s.episode_count || 8,
          }));

        const episodeRunTime = (d.episode_run_time && d.episode_run_time.length > 0)
          ? d.episode_run_time
          : d.last_episode_to_air?.runtime
          ? [d.last_episode_to_air.runtime]
          : undefined;

        return {
          id: d.id,
          title: d.name || 'Untitled',
          original_title: d.original_name,
          overview: d.overview || '',
          poster_path: d.poster_path ?? null,
          backdrop_path: d.backdrop_path ?? null,
          release_date: d.first_air_date || '',
          vote_average: d.vote_average || 0,
          vote_count: d.vote_count || 0,
          media_type: 'tv',
          genres: d.genres,
          number_of_seasons: d.number_of_seasons || seasons.length,
          number_of_episodes: d.number_of_episodes || 0,
          seasons: seasons.length > 0 ? seasons : undefined,
          episode_run_time: episodeRunTime,
          tagline: d.tagline,
        };
      } else {
        return {
          id: d.id,
          title: d.title || 'Untitled',
          original_title: d.original_title,
          overview: d.overview || '',
          poster_path: d.poster_path ?? null,
          backdrop_path: d.backdrop_path ?? null,
          release_date: d.release_date || '',
          vote_average: d.vote_average || 0,
          vote_count: d.vote_count || 0,
          media_type: 'movie',
          genres: d.genres,
          tagline: d.tagline,
        };
      }
    }
  } catch (err) {
    console.error('Direct TMDB API details fetch failed:', err);
  }

  // Method 3: Fallback from curated list
  const fallback = ALL_CURATED_MEDIA.find((m) => m.id === id);
  if (fallback) return fallback;

  return {
    id,
    title: `${type === 'tv' ? 'Series' : 'Movie'} #${id}`,
    overview: 'Stream this title directly using the player.',
    poster_path: null,
    backdrop_path: null,
    release_date: '',
    vote_average: 8.0,
    media_type: type,
  };
};
