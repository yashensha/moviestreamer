import type { MediaItem, MediaType } from '../types/movie';
import { TMDB_READ_ACCESS_TOKEN, GENRE_MAP } from './tmdb';
import type { TasteMatrixProfile, UnifiedInteractionItem } from './interactionMatrix';
import { extractSubgenresForTitle } from './subgenreService';

export interface CastMember {
  id: number;
  name: string;
  character?: string;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
}

export interface ThematicKeyword {
  id: number;
  name: string;
}

export interface TitleMetadataGraph {
  id: number;
  type: MediaType;
  title: string;
  genreIds: number[];
  topCast: CastMember[];      // Top 3 billed actors
  director?: CrewMember;      // Extracted Director (or Showrunner for TV)
  keywords: ThematicKeyword[]; // Specific thematic tags (e.g. "time travel", "cyberpunk", "heist")
  subgenres: string[];        // Crowd-sourced & taxonomy-validated subgenres
  clusters: string[];         // Canonical taxonomy clusters (e.g. "Cyberpunk & Tech Dystopia")
  fetchedAt: number;
}

export interface ContentGraphCandidate {
  item: MediaItem;
  graphScore: number;
  sourceSeedTitle: string;
  sourceSeedWeight: number;
  matchedDirectRec: boolean;
  matchedDirector?: string;
  matchedCast: string[];
  matchedKeywords: string[];
  matchedGenres: string[];
  matchedSubgenres: string[];
  matchedClusters: string[];
  matchExplanations: string[];
}

export interface ContentGraphResult {
  candidates: ContentGraphCandidate[];
  totalCandidatePoolSize: number;
  seedsUsed: Array<{ id: number; title: string; weight: number }>;
  negativeGraphEntities: {
    dislikedDirectorIds: Set<number>;
    dislikedCastIds: Set<number>;
    dislikedDirectorNames: string[];
  };
  generatedAt: number;
}

// Local cache keys
const GRAPH_CACHE_KEY = 'moviewatcher_content_graph_cache_v2';

// In-memory cache for fast lookups
const memoryGraphCache = new Map<string, TitleMetadataGraph>();

// Load persistent cache from localStorage
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(GRAPH_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, TitleMetadataGraph>;
      Object.entries(parsed).forEach(([k, v]) => memoryGraphCache.set(k, v));
    }
  } catch (e) {
    console.warn('Failed to load content graph cache from storage', e);
  }
}

const persistGraphCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, TitleMetadataGraph> = {};
    // Store up to 250 items to keep storage lightweight
    let count = 0;
    for (const [k, v] of memoryGraphCache.entries()) {
      if (count++ > 250) break;
      obj[k] = v;
    }
    localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    // Ignore quota errors
  }
};

/**
 * Extracts Credits (Top 3 cast + Director/Creator), Thematic Keywords, and Subgenres
 */
export async function fetchTitleMetadataGraph(
  id: number,
  type: MediaType = 'movie',
  title = ''
): Promise<TitleMetadataGraph> {
  const cacheKey = `${type}-${id}`;
  if (memoryGraphCache.has(cacheKey)) {
    return memoryGraphCache.get(cacheKey)!;
  }

  let topCast: CastMember[] = [];
  let director: CrewMember | undefined = undefined;
  let keywords: ThematicKeyword[] = [];
  let genreIds: number[] = [];

  const headers = {
    Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  };

  // 1. Fetch Credits (/movie/{id}/credits or /tv/{id}/credits)
  try {
    const creditsUrl = `https://api.themoviedb.org/3/${type}/${id}/credits`;
    const res = await fetch(creditsUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      // Extract top 3 billed actors
      if (Array.isArray(data.cast)) {
        topCast = data.cast.slice(0, 3).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
        }));
      }
      // Extract Movie Director strictly by job === 'Director'
      if (type === 'movie' && Array.isArray(data.crew)) {
        const foundDirector = data.crew.find((cr: any) => cr.job === 'Director');
        if (foundDirector) {
          director = {
            id: foundDirector.id,
            name: foundDirector.name,
            job: 'Director',
            department: 'Directing',
          };
        }
      }
    }
  } catch (err) {
    console.warn(`Credits fetch failed for graph #${id}`, err);
  }

  // 2. Fetch Keywords (/movie/{id}/keywords or /tv/{id}/keywords)
  try {
    const keywordsUrl = `https://api.themoviedb.org/3/${type}/${id}/keywords`;
    const res = await fetch(keywordsUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      const rawKeywords = type === 'tv' ? data.results : data.keywords;
      if (Array.isArray(rawKeywords)) {
        keywords = rawKeywords.slice(0, 10).map((k: any) => ({
          id: k.id,
          name: k.name,
        }));
      }
    }
  } catch (err) {
    console.warn(`Keywords fetch failed for graph #${id}`, err);
  }

  // 3. Fetch Title Details (for TV creator / showrunner and genre IDs)
  try {
    const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}`;
    const res = await fetch(detailsUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.genres)) {
        genreIds = data.genres.map((g: any) => g.id);
      }
      if (!title && (data.title || data.name)) {
        title = data.title || data.name;
      }
      // For TV series: extract actual showrunner / creator (e.g. Vince Gilligan, Sam Esmail)
      if (type === 'tv' && Array.isArray(data.created_by) && data.created_by.length > 0) {
        const creator = data.created_by[0];
        director = {
          id: creator.id,
          name: creator.name,
          job: 'Creator',
          department: 'Writing',
        };
      }
    }
  } catch (err) {
    // details fallback optional
  }

  // 4. Extract Universal Subgenres & Taxonomy Clusters (MovieLens + TMDB Keywords)
  let subgenres: string[] = [];
  let clusters: string[] = [];
  try {
    const subgenreInfo = await extractSubgenresForTitle(id, type, keywords);
    subgenres = subgenreInfo.subgenres;
    clusters = subgenreInfo.clusters;
  } catch (e) {
    console.warn(`Subgenre extraction failed for #${id}`, e);
  }

  const graphItem: TitleMetadataGraph = {
    id,
    type,
    title,
    genreIds,
    topCast,
    director,
    keywords,
    subgenres,
    clusters,
    fetchedAt: Date.now(),
  };

  memoryGraphCache.set(cacheKey, graphItem);
  persistGraphCache();

  return graphItem;
}

const mapTMDBResultToMedia = (item: any, defaultType: MediaType): MediaItem => ({
  id: item.id,
  title: item.title || item.name || 'Untitled',
  original_title: item.original_title || item.original_name,
  overview: item.overview || '',
  poster_path: item.poster_path ?? null,
  backdrop_path: item.backdrop_path ?? null,
  release_date: item.release_date || item.first_air_date || '',
  vote_average: item.vote_average || 0,
  vote_count: item.vote_count || 0,
  media_type: (item.media_type as MediaType) || defaultType,
  genre_ids: item.genre_ids || [],
});

/**
 * Step 3: Content-Based Graph Generator
 * Extracts high-precision candidate pools (~100 fresh candidates)
 * via direct TMDB recommendation endpoints + targeted discover queries using
 * director, top 3 cast, and thematic keywords.
 */
export async function generateContentGraphCandidates(
  matrix: TasteMatrixProfile,
  options?: {
    preferredType?: MediaType;
    limit?: number;
    excludedIds?: Set<number>;
  }
): Promise<ContentGraphResult> {
  const targetLimit = options?.limit || 120;
  const preferredType = options?.preferredType;
  const excluded = new Set<number>(options?.excludedIds || []);

  // Add all user interactions to exclusions
  matrix.interactions.forEach((item) => excluded.add(item.id));
  matrix.hardFilteredIds.forEach((id) => excluded.add(id));

  // 1. Extract metadata graph for hard-filtered titles (1★–2★ ratings)
  // to identify negative director & cast entities for negative filtering
  const dislikedDirectorIds = new Set<number>();
  const dislikedCastIds = new Set<number>();
  const dislikedDirectorNames: string[] = [];

  const hardFilteredItems = matrix.interactions.filter((i) => i.isHardFiltered);
  const hardFilterPromises = hardFilteredItems.slice(0, 8).map(async (item) => {
    try {
      const graph = await fetchTitleMetadataGraph(item.id, item.type, item.title);
      if (graph.director) {
        dislikedDirectorIds.add(graph.director.id);
        if (!dislikedDirectorNames.includes(graph.director.name)) {
          dislikedDirectorNames.push(graph.director.name);
        }
      }
      graph.topCast.forEach((actor) => dislikedCastIds.add(actor.id));
    } catch (e) {
      // ignore
    }
  });

  // 2. Select top positive seeds (sorted by BM25 weight: 5.0, 4.0, 3.5...)
  const candidateSeeds = (matrix.positiveSeeds.length > 0 ? matrix.positiveSeeds : matrix.interactions)
    .filter((i) => !i.isHardFiltered)
    .slice(0, 5);

  const seedsUsed = candidateSeeds.map((s) => ({
    id: s.id,
    title: s.title,
    weight: s.normalizedWeight,
  }));

  // Fetch graphs for top positive seeds in parallel
  const seedGraphPromises = candidateSeeds.map((seed) =>
    fetchTitleMetadataGraph(seed.id, seed.type, seed.title)
  );

  // Wait for both positive seed graphs and negative entities
  const [, seedGraphs] = await Promise.all([
    Promise.allSettled(hardFilterPromises),
    Promise.all(seedGraphPromises),
  ]);

  const candidateMap = new Map<number, ContentGraphCandidate>();

  const headers = {
    Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}`,
  };

  // Helper to safely add candidate with attribution
  const registerCandidate = (
    media: MediaItem,
    seed: UnifiedInteractionItem,
    bonus: {
      type: 'rec' | 'director' | 'cast' | 'keyword' | 'genre';
      score: number;
      explanation: string;
      director?: string;
      castName?: string;
      keywordName?: string;
      subgenre?: string;
      cluster?: string;
    }
  ) => {
    // Hard filter: skip if excluded, missing poster, or shares disliked director
    if (excluded.has(media.id) || !media.poster_path) return;

    const existing = candidateMap.get(media.id);
    if (existing) {
      existing.graphScore += bonus.score;
      if (!existing.matchExplanations.includes(bonus.explanation)) {
        existing.matchExplanations.push(bonus.explanation);
      }
      if (bonus.type === 'rec') existing.matchedDirectRec = true;
      if (bonus.director) existing.matchedDirector = bonus.director;
      if (bonus.castName && !existing.matchedCast.includes(bonus.castName)) {
        existing.matchedCast.push(bonus.castName);
      }
      if (bonus.keywordName && !existing.matchedKeywords.includes(bonus.keywordName)) {
        existing.matchedKeywords.push(bonus.keywordName);
      }
      if (bonus.subgenre && !existing.matchedSubgenres.includes(bonus.subgenre)) {
        existing.matchedSubgenres.push(bonus.subgenre);
      }
      if (bonus.cluster && !existing.matchedClusters.includes(bonus.cluster)) {
        existing.matchedClusters.push(bonus.cluster);
      }
    } else {
      const matchGenres = (media.genre_ids || [])
        .map((gid) => GENRE_MAP[gid])
        .filter(Boolean) as string[];

      candidateMap.set(media.id, {
        item: media,
        graphScore: bonus.score + (media.vote_average || 7.0) * 0.5,
        sourceSeedTitle: seed.title,
        sourceSeedWeight: seed.normalizedWeight,
        matchedDirectRec: bonus.type === 'rec',
        matchedDirector: bonus.director,
        matchedCast: bonus.castName ? [bonus.castName] : [],
        matchedKeywords: bonus.keywordName ? [bonus.keywordName] : [],
        matchedGenres: matchGenres,
        matchedSubgenres: bonus.subgenre ? [bonus.subgenre] : [],
        matchedClusters: bonus.cluster ? [bonus.cluster] : [],
        matchExplanations: [bonus.explanation],
      });
    }
  };

  // 3. Parallel Candidate Generation across all seeds:
  // For each seed, run:
  // A) Direct TMDB Recommendations (/movie/{id}/recommendations)
  // B) Targeted Director/Creator Filmography (/person/{id}/combined_credits strictly filtering Director/Creator)
  // C) Targeted Discover by Key Actor (/discover/movie?with_cast=...)
  // D) Targeted Discover by Thematic Keywords & Subgenres
  const queryPromises: Promise<void>[] = [];

  for (let idx = 0; idx < candidateSeeds.length; idx++) {
    const seed = candidateSeeds[idx];
    const graph = seedGraphs[idx];
    const targetType = preferredType || seed.type;
    const seedWeightMultiplier = Math.max(1, Math.min(seed.normalizedWeight, 5.0));

    // A. Direct TMDB Recommendations
    queryPromises.push(
      (async () => {
        try {
          const recUrl = `https://api.themoviedb.org/3/${seed.type}/${seed.id}/recommendations`;
          const res = await fetch(recUrl, { headers });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.results)) {
              data.results.slice(0, 15).forEach((item: any, rank: number) => {
                const media = mapTMDBResultToMedia(item, targetType);
                const score = (15 - rank) * seedWeightMultiplier * 1.5;
                registerCandidate(media, seed, {
                  type: 'rec',
                  score,
                  explanation: `Direct recommendation from "${seed.title}"`,
                  subgenre: graph.subgenres[0],
                  cluster: graph.clusters[0],
                });
              });
            }
          }
        } catch (e) {
          // ignore individual failed queries
        }
      })()
    );

    // B. Targeted Filmography by Exact Director / Creator (/person/{id}/combined_credits)
    if (graph.director && graph.director.id) {
      const directorId = graph.director.id;
      const directorName = graph.director.name;

      // Skip query if director is marked as disliked in user's 1-2★ ratings
      if (!dislikedDirectorIds.has(directorId)) {
        queryPromises.push(
          (async () => {
            try {
              const url = `https://api.themoviedb.org/3/person/${directorId}/combined_credits`;
              const res = await fetch(url, { headers });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.crew)) {
                  // Strictly filter for works where the person was the Director or Creator
                  const directedWorks = data.crew.filter((cr: any) => {
                    const isDirector = cr.job === 'Director';
                    const isCreator = cr.job === 'Creator';
                    const hasVotes = (cr.vote_count || 0) >= 40;
                    const hasDecentScore = (cr.vote_average || 0) >= 6.3;
                    const matchesType = !targetType || cr.media_type === targetType;
                    return (isDirector || isCreator) && hasVotes && hasDecentScore && matchesType;
                  });

                  // Sort by popularity / vote count to get their most celebrated works
                  directedWorks.sort((a: any, b: any) => (b.vote_count || 0) - (a.vote_count || 0));

                  directedWorks.slice(0, 6).forEach((item: any) => {
                    const media = mapTMDBResultToMedia(item, targetType);
                    registerCandidate(media, seed, {
                      type: 'director',
                      score: 16 * seedWeightMultiplier,
                      explanation: `Directed by ${directorName} (Director of "${seed.title}")`,
                      director: directorName,
                      subgenre: graph.subgenres[0],
                      cluster: graph.clusters[0],
                    });
                  });
                }
              }
            } catch (e) {
              // ignore
            }
          })()
        );
      }
    }

    // C. Targeted Discover by Top Billed Actor (/discover/movie?with_cast=...)
    if (graph.topCast.length > 0) {
      const leadActor = graph.topCast[0];
      if (!dislikedCastIds.has(leadActor.id)) {
        queryPromises.push(
          (async () => {
            try {
              const url = `https://api.themoviedb.org/3/discover/${targetType}?with_cast=${leadActor.id}&sort_by=popularity.desc&vote_average.gte=6.5`;
              const res = await fetch(url, { headers });
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.results)) {
                  data.results.slice(0, 8).forEach((item: any) => {
                    const media = mapTMDBResultToMedia(item, targetType);
                    registerCandidate(media, seed, {
                      type: 'cast',
                      score: 8 * seedWeightMultiplier,
                      explanation: `Starring ${leadActor.name} (from "${seed.title}")`,
                      castName: leadActor.name,
                    });
                  });
                }
              }
            } catch (e) {
              // ignore
            }
          })()
        );
      }
    }

    // D. Targeted Discover by Thematic Keywords & Subgenres
    const topKeywordIds = graph.keywords.slice(0, 3).map((k) => k.id).join('|');
    const topSubgenreNames = graph.subgenres.slice(0, 2).join(', ');
    const topKeywordNames = graph.keywords.slice(0, 2).map((k) => k.name).join(', ');
    const primaryGenre = graph.genreIds[0] || (seed.genre_ids && seed.genre_ids[0]);

    if (topKeywordIds) {
      queryPromises.push(
        (async () => {
          try {
            let url = `https://api.themoviedb.org/3/discover/${targetType}?with_keywords=${topKeywordIds}&sort_by=popularity.desc&vote_average.gte=6.8`;
            if (primaryGenre) {
              url += `&with_genres=${primaryGenre}`;
            }
            const res = await fetch(url, { headers });
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.results)) {
                data.results.slice(0, 10).forEach((item: any) => {
                  const media = mapTMDBResultToMedia(item, targetType);
                  const tagLabel = topSubgenreNames || topKeywordNames;
                  registerCandidate(media, seed, {
                    type: 'keyword',
                    score: 10 * seedWeightMultiplier,
                    explanation: `Matches subgenres & themes (${tagLabel}) of "${seed.title}"`,
                    keywordName: tagLabel,
                    subgenre: graph.subgenres[0],
                    cluster: graph.clusters[0],
                  });
                });
              }
            }
          } catch (e) {
            // ignore
          }
        })()
      );
    }
  }

  // Await all parallel graph queries
  await Promise.allSettled(queryPromises);

  // Apply BM25 genre affinity boost across all candidates
  for (const candidate of candidateMap.values()) {
    const genreBoost = (candidate.item.genre_ids || []).reduce((acc, gid) => {
      return acc + (matrix.genreWeights[gid] || 0) * 0.2;
    }, 0);
    candidate.graphScore += genreBoost;
  }

  // Sort candidates by total graph score
  const sortedCandidates = Array.from(candidateMap.values())
    .sort((a, b) => b.graphScore - a.graphScore)
    .slice(0, targetLimit);

  return {
    candidates: sortedCandidates,
    totalCandidatePoolSize: candidateMap.size,
    seedsUsed,
    negativeGraphEntities: {
      dislikedDirectorIds,
      dislikedCastIds,
      dislikedDirectorNames,
    },
    generatedAt: Date.now(),
  };
}
