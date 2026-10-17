import type { MediaType } from '../types/movie';
import taxonomyData from '../data/subgenre_taxonomy.json';

export interface SubgenreClassification {
  subgenres: string[];
  clusters: string[];
}

export interface SubgenreTaxonomyCluster {
  name: string;
  tags: string[];
}

// In-memory cache for dynamic movie_subgenres lookup
let movieSubgenresMap: Record<string, string[]> | null = null;
let isLoadingMovieSubgenres = false;
const loadCallbacks: Array<(map: Record<string, string[]>) => void> = [];

/**
 * Lazily loads the 3MB movie subgenres dataset on demand
 * so initial app load stays instant.
 */
export async function getMovieSubgenresMap(): Promise<Record<string, string[]>> {
  if (movieSubgenresMap) return movieSubgenresMap;

  if (isLoadingMovieSubgenres) {
    return new Promise((resolve) => {
      loadCallbacks.push(resolve);
    });
  }

  isLoadingMovieSubgenres = true;
  try {
    const module = await import('../data/movie_subgenres.json');
    // Vite / ES Module default export
    movieSubgenresMap = (module.default || module) as Record<string, string[]>;
    loadCallbacks.forEach((cb) => cb(movieSubgenresMap!));
    loadCallbacks.length = 0;
    return movieSubgenresMap;
  } catch (err) {
    console.warn('Failed to load movie_subgenres.json', err);
    movieSubgenresMap = {};
    return movieSubgenresMap;
  } finally {
    isLoadingMovieSubgenres = false;
  }
}

/**
 * Canonical cluster mapping from subgenre_taxonomy.json
 */
export const TAXONOMY_CLUSTERS: Record<string, string[]> = taxonomyData.clusters as Record<string, string[]>;
export const CANONICAL_TAGS: Set<string> = new Set(
  (taxonomyData.topThematicTags || []).map((t: any) => t.tag)
);

/**
 * Standard Stopwords to filter out of synopses / overviews
 */
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'film', 'movie', 'series', 'story', 'life', 'one', 'two', 'new',
  'first', 'also', 'many', 'much', 'see', 'find', 'take', 'make', 'get', 'come', 'go', 'give', 'must'
]);

/**
 * Narrative Mood and Trope keywords to boost in synopsis / overview matching
 */
export const NARRATIVE_MOOD_KEYWORDS = new Set([
  'dark', 'gritty', 'dystopian', 'satirical', 'surreal', 'mind-bending', 'tense', 'bleak',
  'claustrophobic', 'poetic', 'atmospheric', 'whimsical', 'existential', 'philosophical',
  'cynical', 'paranoia', 'paragon', 'melancholic', 'heartwarming', 'suspenseful', 'terrifying',
  'grotesque', 'haunting', 'nostalgic', 'epic', 'intimate', 'unsettling', 'chaotic', 'hyper-stylized'
]);

/**
 * High-value Narrative Plot Tropes
 */
export const NARRATIVE_PLOT_TROPES = new Set([
  'conspiracy', 'heist', 'investigation', 'undercover', 'revenge', 'assassin', 'hitman',
  'time travel', 'time loop', 'artificial intelligence', 'hacker', 'corrupt', 'amnesia',
  'memory loss', 'identity', 'clone', 'parallel universe', 'multiverse', 'alien', 'invasion',
  'apocalypse', 'post-apocalyptic', 'serial killer', 'survival', 'hostage', 'secret agent',
  'espionage', 'revolution', 'rebellion', 'organized crime', 'mafia', 'cartel', 'supernatural',
  'cult', 'witchcraft', 'haunted', 'psychopath', 'kidnapping', 'betrayal', 'whodunit'
]);

/**
 * Given raw keywords (from TMDB TV keywords or MovieLens tags),
 * classifies them into Canonical Subgenre Clusters & canonical tags.
 */
export function classifyKeywordsToClusters(keywords: string[]): SubgenreClassification {
  const matchedClusters = new Set<string>();
  const matchedTags = new Set<string>();

  const lowerKeywords = keywords.map((k) => k.toLowerCase().trim());

  for (const kw of lowerKeywords) {
    if (!kw) continue;

    // Direct canonical tag match
    if (CANONICAL_TAGS.has(kw)) {
      matchedTags.add(kw);
    }

    // Match against each cluster's member keywords
    for (const [clusterName, clusterTags] of Object.entries(TAXONOMY_CLUSTERS)) {
      if (clusterTags.some((tag) => kw === tag || kw.includes(tag) || tag.includes(kw))) {
        matchedClusters.add(clusterName);
        matchedTags.add(kw);
      }
    }
  }

  return {
    subgenres: Array.from(matchedTags).slice(0, 8),
    clusters: Array.from(matchedClusters).slice(0, 4),
  };
}

/**
 * Fast $O(1)$ lookup for a movie in the MovieLens 50,000+ TMDB subgenre map.
 */
let tvSubgenresMap: Record<string, any> | null = null;

/**
 * Lazily loads pre-compiled TV subgenres & creator/cast tags
 */
export async function getTVSubgenresMap(): Promise<Record<string, any>> {
  if (tvSubgenresMap) return tvSubgenresMap;
  try {
    const module = await import('../data/tv_subgenres.json');
    tvSubgenresMap = (module.default || module) as Record<string, any>;
    return tvSubgenresMap;
  } catch (err) {
    tvSubgenresMap = {};
    return tvSubgenresMap;
  }
}

/**
 * Fast $O(1)$ lookup for a movie in the MovieLens 50,000+ TMDB subgenre map.
 */
export async function getMovieCuratedSubgenres(tmdbId: number): Promise<string[]> {
  const map = await getMovieSubgenresMap();
  return map[String(tmdbId)] || [];
}

/**
 * Fast $O(1)$ enriched metadata resolver for any title from our 60,919 dataset.
 * Instantly supplies subgenres, clusters, and creators for candidates.
 */
export async function getKnownTitleTags(
  id: number,
  type: MediaType = 'movie'
): Promise<{ tags: string[]; subgenres: string[]; clusters: string[]; director?: string }> {
  if (type === 'tv') {
    const tvMap = await getTVSubgenresMap();
    const entry = tvMap[String(id)];
    if (entry) {
      return {
        tags: entry.tags || [],
        subgenres: entry.subgenres || [],
        clusters: entry.clusters || [],
        director: entry.creators?.[0] || entry.directors?.[0],
      };
    }
  } else {
    const movieMap = await getMovieSubgenresMap();
    const tags = movieMap[String(id)];
    if (tags && tags.length > 0) {
      const { clusters, subgenres } = classifyKeywordsToClusters(tags);
      return {
        tags,
        subgenres,
        clusters,
      };
    }
  }
  return { tags: [], subgenres: [], clusters: [] };
}

/**
 * Universal Subgenre & Narrative Extractor:
 * Works seamlessly for BOTH Movies and TV Series.
 * - For movies: combines MovieLens crowd-sourced tags with TMDB keywords.
 * - For TV series: checks pre-compiled TV tags dataset, and classifies TMDB TV keywords into canonical clusters and tags.
 */
export async function extractSubgenresForTitle(
  id: number,
  type: MediaType = 'movie',
  tmdbKeywords: Array<{ id: number; name: string }> = []
): Promise<SubgenreClassification> {
  const allKeywords: string[] = tmdbKeywords.map((k) => k.name.toLowerCase().trim());

  // 1. If TV series: check pre-compiled TV tags dataset
  if (type === 'tv') {
    const tvMap = await getTVSubgenresMap();
    const tvEntry = tvMap[String(id)];
    if (tvEntry) {
      if (Array.isArray(tvEntry.subgenres)) {
        for (const sg of tvEntry.subgenres) {
          if (!allKeywords.includes(sg)) allKeywords.unshift(sg);
        }
      }
      if (Array.isArray(tvEntry.tags)) {
        for (const tag of tvEntry.tags) {
          if (!allKeywords.includes(tag)) allKeywords.push(tag);
        }
      }
    }
  }

  // 2. If movie: check MovieLens 32M crowd-sourced subgenres
  if (type === 'movie') {
    const movieLensTags = await getMovieCuratedSubgenres(id);
    for (const tag of movieLensTags) {
      if (!allKeywords.includes(tag)) {
        allKeywords.unshift(tag);
      }
    }
  }

  // Classify into canonical clusters and tags
  const classification = classifyKeywordsToClusters(allKeywords);

  // If tags are still few, fill with top TMDB keywords
  if (classification.subgenres.length < 3 && allKeywords.length > 0) {
    for (const kw of allKeywords) {
      if (!classification.subgenres.includes(kw) && kw.length > 2) {
        classification.subgenres.push(kw);
      }
      if (classification.subgenres.length >= 6) break;
    }
  }

  return classification;
}
