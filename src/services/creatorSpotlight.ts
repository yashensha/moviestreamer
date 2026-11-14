import type { MediaItem, WatchHistoryItem, UserRatingItem } from '../types/movie';
import { extractEntitiesFromTitleSync } from './subgenreService';
import { TMDB_API_KEY, fetchMediaDetailedCredits } from './tmdb';

export interface SignatureWork {
  id: number;
  title: string;
  year: string;
  rating: number;
  mediaType: 'movie' | 'tv';
  posterPath?: string;
}

export interface IconicCreator {
  id: number;
  name: string;
  department: string;
  profilePath: string;
  signatureWorks: SignatureWork[];
  userLikedCount?: number;
}

export const ICONIC_DIRECTORS: IconicCreator[] = [
  {
    id: 525,
    name: 'Christopher Nolan',
    department: 'Directing',
    profilePath: '/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg',
    signatureWorks: [
      { id: 872585, title: 'Oppenheimer', year: '2023', rating: 8.9, mediaType: 'movie', posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' },
      { id: 157336, title: 'Interstellar', year: '2014', rating: 8.5, mediaType: 'movie', posterPath: '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg' },
      { id: 27205, title: 'Inception', year: '2010', rating: 8.4, mediaType: 'movie', posterPath: '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg' },
    ],
  },
  {
    id: 137427,
    name: 'Denis Villeneuve',
    department: 'Directing',
    profilePath: '/xzQYqb4nR8xT7Zdw5itbEL9K3fd.jpg',
    signatureWorks: [
      { id: 693134, title: 'Dune: Part Two', year: '2024', rating: 8.2, mediaType: 'movie', posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg' },
      { id: 335984, title: 'Blade Runner 2049', year: '2017', rating: 8.0, mediaType: 'movie', posterPath: '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg' },
      { id: 329865, title: 'Arrival', year: '2016', rating: 7.9, mediaType: 'movie', posterPath: '/x2OAHu2TsbD35kbtF2T2P9yT5P.jpg' },
    ],
  },
  {
    id: 1032,
    name: 'Martin Scorsese',
    department: 'Directing',
    profilePath: '/g3DjfKsgZQWZiw30I20hZVk1oMX.jpg',
    signatureWorks: [
      { id: 769, title: 'GoodFellas', year: '1990', rating: 8.5, mediaType: 'movie', posterPath: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg' },
      { id: 466420, title: 'Killers of the Flower Moon', year: '2023', rating: 7.5, mediaType: 'movie', posterPath: '/dB6Krk806zeqd0Y5W48JuAdfUCv.jpg' },
      { id: 103, title: 'Taxi Driver', year: '1976', rating: 8.2, mediaType: 'movie', posterPath: '/ekstpH694DaJUV7haTY13B8afA.jpg' },
    ],
  },
  {
    id: 138,
    name: 'Quentin Tarantino',
    department: 'Directing & Writing',
    profilePath: '/1gjcpAa99FAOWGnrUvHEXXsRs7o.jpg',
    signatureWorks: [
      { id: 680, title: 'Pulp Fiction', year: '1994', rating: 8.5, mediaType: 'movie', posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
      { id: 68718, title: 'Django Unchained', year: '2012', rating: 8.2, mediaType: 'movie', posterPath: '/7oWY8vd27zAUaewDiA78diJz0vW.jpg' },
      { id: 16869, title: 'Inglourious Basterds', year: '2009', rating: 8.2, mediaType: 'movie', posterPath: '/7sfbEnaARXDDhKm0CZ7D7uc2sbo.jpg' },
    ],
  },
  {
    id: 2037,
    name: 'Cillian Murphy',
    department: 'Acting',
    profilePath: '/2lKs67r7FI4bPu0AXxMUJZxmUXn.jpg',
    signatureWorks: [
      { id: 872585, title: 'Oppenheimer', year: '2023', rating: 8.9, mediaType: 'movie', posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' },
      { id: 60574, title: 'Peaky Blinders', year: '2013', rating: 8.5, mediaType: 'tv', posterPath: '/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg' },
      { id: 170, title: '28 Days Later', year: '2002', rating: 7.2, mediaType: 'movie', posterPath: '/sQ5b6i7A0hP5w0x04k4X2y8F9Y7.jpg' },
    ],
  },
  {
    id: 947,
    name: 'Hans Zimmer',
    department: 'Composer',
    profilePath: '/tpQnDeHY15szIXvpnhlprufz4d.jpg',
    signatureWorks: [
      { id: 157336, title: 'Interstellar', year: '2014', rating: 8.5, mediaType: 'movie', posterPath: '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg' },
      { id: 27205, title: 'Inception', year: '2010', rating: 8.4, mediaType: 'movie', posterPath: '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg' },
      { id: 98, title: 'Gladiator', year: '2000', rating: 8.2, mediaType: 'movie', posterPath: '/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg' },
    ],
  },
];

// In-memory cache for resolved creators to guarantee 0ms latency on repeated menu openings
const resolvedCreatorCache = new Map<string, IconicCreator>();

// Initialize cache with iconic creators
ICONIC_DIRECTORS.forEach((d) => {
  resolvedCreatorCache.set(d.name.toLowerCase().trim(), d);
});

export interface CreatorScoreEntry {
  name: string;
  score: number;
  likedWorks: MediaItem[];
  department?: string;
  personId?: number;
  profilePath?: string;
}

/**
 * Computes creator affinity ranking based on user interactions:
 * - Liked / Hearted titles: 5.0 points per title
 * - High ratings (>= 4.0 stars): 4.0 - 5.0 points
 * - Completed watch history: 3.0 points
 */
export async function computeTopCreatorsFromLikes(
  likedMedia: MediaItem[] = [],
  userRatings: UserRatingItem[] = [],
  watchHistory: WatchHistoryItem[] = []
): Promise<CreatorScoreEntry[]> {
  const creatorMap = new Map<string, CreatorScoreEntry>();

  const registerCreatorSignal = (
    name: string,
    points: number,
    work: MediaItem,
    department: string = 'Directing',
    personId?: number,
    profilePath?: string
  ) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();

    let entry = creatorMap.get(key);
    if (!entry) {
      entry = {
        name: cleanName,
        score: 0,
        likedWorks: [],
        department,
        personId,
        profilePath,
      };
      creatorMap.set(key, entry);
    }

    entry.score += points;
    if (personId && !entry.personId) entry.personId = personId;
    if (profilePath && !entry.profilePath) entry.profilePath = profilePath;
    if (department && !entry.department) entry.department = department;

    // Deduplicate works under same creator
    if (!entry.likedWorks.some((w) => w.id === work.id)) {
      entry.likedWorks.push(work);
    }
  };

  // 1. Process Liked Media (Weight 5.0)
  for (const item of likedMedia) {
    if (!item?.id) continue;
    const mediaType = (item.media_type as 'movie' | 'tv') || 'movie';
    const entities = extractEntitiesFromTitleSync(item.id, mediaType);

    let hasDirector = false;
    if (entities.directors && entities.directors.length > 0) {
      hasDirector = true;
      for (const dir of entities.directors) {
        registerCreatorSignal(dir, 5.0, item, 'Directing');
      }
    }

    // If local dataset did not contain directors for this title, check TMDB credits cache or API
    if (!hasDirector) {
      try {
        const detailed = await fetchMediaDetailedCredits(item.id, mediaType);
        if (detailed.director?.name) {
          hasDirector = true;
          registerCreatorSignal(
            detailed.director.name,
            5.0,
            item,
            'Directing',
            detailed.director.id
          );
        }
      } catch {
        // Continue gracefully
      }
    }

    // Also register top lead cast (Weight 2.5)
    if (entities.cast && entities.cast.length > 0) {
      for (const act of entities.cast.slice(0, 3)) {
        registerCreatorSignal(act, 2.5, item, 'Acting');
      }
    }
  }

  // 2. Process High User Ratings (>= 4.0 stars)
  for (const r of userRatings) {
    if (!r?.id || typeof r.rating !== 'number') continue;
    if (r.rating < 4.0) continue;
    const points = r.rating >= 4.5 ? 5.0 : 4.0;
    const mediaType = (r.type as 'movie' | 'tv') || 'movie';
    const entities = extractEntitiesFromTitleSync(r.id, mediaType);

    const syntheticItem: MediaItem = {
      id: r.id,
      title: r.title,
      media_type: mediaType,
      poster_path: r.poster_path || null,
      vote_average: r.vote_average || 8.0,
      release_date: r.release_date || '',
    };

    if (entities.directors && entities.directors.length > 0) {
      for (const dir of entities.directors) {
        registerCreatorSignal(dir, points, syntheticItem, 'Directing');
      }
    } else if (entities.cast && entities.cast.length > 0) {
      for (const act of entities.cast.slice(0, 2)) {
        registerCreatorSignal(act, points * 0.5, syntheticItem, 'Acting');
      }
    }
  }

  // 3. Process Completed Watch History (Weight 3.0)
  for (const w of watchHistory) {
    if (!w?.id) continue;
    const duration = w.durationSeconds || 1;
    const seconds = w.progressSeconds || w.progress || 0;
    const progressRatio = duration > 1 ? seconds / duration : 0;
    if (progressRatio < 0.8) continue;

    const mediaType = (w.type as 'movie' | 'tv') || 'movie';
    const entities = extractEntitiesFromTitleSync(w.id, mediaType);

    const syntheticItem: MediaItem = {
      id: w.id,
      title: w.title,
      media_type: mediaType,
      poster_path: w.poster_path || null,
      vote_average: 8.0,
      release_date: '',
    };

    if (entities.directors && entities.directors.length > 0) {
      for (const dir of entities.directors) {
        registerCreatorSignal(dir, 3.0, syntheticItem, 'Directing');
      }
    }
  }

  // Sort by engagement score descending -> creator they like most is at index 0!
  return Array.from(creatorMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * Resolves full IconicCreator card details (profile image, signature works prioritizing liked works)
 */
export async function resolveCreatorCard(
  entry: CreatorScoreEntry
): Promise<IconicCreator> {
  const cacheKey = entry.name.toLowerCase().trim();
  const cached = resolvedCreatorCache.get(cacheKey);

  // If already known in local iconic list or cached previously
  if (cached) {
    const likedIds = new Set(entry.likedWorks.map((w) => w.id));
    const mergedWorks: SignatureWork[] = [];

    // 1. Prioritize user's liked works by this creator
    for (const w of entry.likedWorks) {
      mergedWorks.push({
        id: w.id,
        title: w.title,
        year: w.release_date ? w.release_date.slice(0, 4) : '',
        rating: w.vote_average || 8.0,
        mediaType: (w.media_type as 'movie' | 'tv') || 'movie',
        posterPath: w.poster_path || undefined,
      });
    }

    // 2. Pad with signature works up to 3
    for (const sw of cached.signatureWorks) {
      if (!likedIds.has(sw.id) && mergedWorks.length < 3) {
        mergedWorks.push(sw);
      }
    }

    return {
      ...cached,
      signatureWorks: mergedWorks.slice(0, 3),
      userLikedCount: entry.likedWorks.length,
    };
  }

  // If not cached, fetch from TMDB search/person
  try {
    const url = `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(entry.name)}&api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const person = data.results?.[0];
      if (person) {
        const likedIds = new Set(entry.likedWorks.map((w) => w.id));
        const mergedWorks: SignatureWork[] = [];

        // 1. Put user's liked works first
        for (const w of entry.likedWorks) {
          mergedWorks.push({
            id: w.id,
            title: w.title,
            year: w.release_date ? w.release_date.slice(0, 4) : '',
            rating: w.vote_average || 8.0,
            mediaType: (w.media_type as 'movie' | 'tv') || 'movie',
            posterPath: w.poster_path || undefined,
          });
        }

        // 2. Pad with known_for works
        if (Array.isArray(person.known_for)) {
          for (const k of person.known_for) {
            if (!likedIds.has(k.id) && (k.poster_path || k.backdrop_path) && mergedWorks.length < 3) {
              mergedWorks.push({
                id: k.id,
                title: k.title || k.name || 'Untitled',
                year: (k.release_date || k.first_air_date || '').slice(0, 4),
                rating: k.vote_average || 7.5,
                mediaType: (k.media_type as 'movie' | 'tv') || 'movie',
                posterPath: k.poster_path || undefined,
              });
            }
          }
        }

        const creator: IconicCreator = {
          id: person.id,
          name: person.name,
          department: person.known_for_department || entry.department || 'Directing',
          profilePath: person.profile_path || '',
          signatureWorks: mergedWorks.slice(0, 3),
          userLikedCount: entry.likedWorks.length,
        };

        resolvedCreatorCache.set(cacheKey, creator);
        return creator;
      }
    }
  } catch (err) {
    console.warn('Failed to resolve person from TMDB for', entry.name, err);
  }

  // Resilient fallback card if search failed or offline
  const fallbackCreator: IconicCreator = {
    id: entry.personId || Math.abs(entry.name.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)),
    name: entry.name,
    department: entry.department || 'Creator',
    profilePath: entry.profilePath || '',
    signatureWorks: entry.likedWorks.slice(0, 3).map((w) => ({
      id: w.id,
      title: w.title,
      year: w.release_date ? w.release_date.slice(0, 4) : '',
      rating: w.vote_average || 8.0,
      mediaType: (w.media_type as 'movie' | 'tv') || 'movie',
      posterPath: w.poster_path || undefined,
    })),
    userLikedCount: entry.likedWorks.length,
  };

  resolvedCreatorCache.set(cacheKey, fallbackCreator);
  return fallbackCreator;
}

/**
 * Returns the final personalized list of Spotlight Creators:
 * - If user has likes: creator they like most appears at index 0, followed by subsequent liked creators.
 * - Fills remaining slots up to 4-5 from curated iconic creators so palette is always rich.
 * - If user has no likes yet: returns default curated iconic creators.
 */
export async function getPersonalizedSpotlightCreators(
  likedMedia: MediaItem[] = [],
  userRatings: UserRatingItem[] = [],
  watchHistory: WatchHistoryItem[] = []
): Promise<{ creators: IconicCreator[]; isPersonalized: boolean }> {
  // If no user likes/ratings/history, immediately return static iconic creators
  if (likedMedia.length === 0 && userRatings.length === 0 && watchHistory.length === 0) {
    return { creators: ICONIC_DIRECTORS, isPersonalized: false };
  }

  const scoredEntries = await computeTopCreatorsFromLikes(likedMedia, userRatings, watchHistory);

  if (scoredEntries.length === 0) {
    return { creators: ICONIC_DIRECTORS, isPersonalized: false };
  }

  // Resolve top 4 creators from user likes
  const topPersonalizedEntries = scoredEntries.slice(0, 4);
  const personalizedCreators = await Promise.all(
    topPersonalizedEntries.map((entry) => resolveCreatorCard(entry))
  );

  const seenNames = new Set(personalizedCreators.map((c) => c.name.toLowerCase().trim()));
  const mergedCreators: IconicCreator[] = [...personalizedCreators];

  // Fill up to 5 total cards with curated iconic creators to ensure a complete shelf
  for (const iconic of ICONIC_DIRECTORS) {
    if (mergedCreators.length >= 5) break;
    const iconicKey = iconic.name.toLowerCase().trim();
    if (!seenNames.has(iconicKey)) {
      seenNames.add(iconicKey);
      mergedCreators.push(iconic);
    }
  }

  return { creators: mergedCreators, isPersonalized: true };
}

