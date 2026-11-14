import type { MediaItem, MediaType } from '../../types/movie';
import {
  fetchMediaDetailedCredits,
  fetchPersonCombinedCredits,
  fetchRecommendations,
} from '../tmdb';
import { letterboxdTop500List, imdbTop200SeriesList } from '../topRatedLists';
import { resolveMovieGenomeSync } from './genome';
import type { SessionInteraction } from './sessionState';

export type GraphEdgeType =
  | 'director'
  | 'cast'
  | 'trope'
  | 'recommendation'
  | 'collaborator'
  | 'curated_cluster'
  | 'top_rated';

export interface GraphCandidate {
  item: MediaItem;
  hopLevel: 1 | 2;
  primaryEdge: GraphEdgeType;
  edgeEntityName?: string;
  graphProximityScore: number; // 0.0 - 1.0
}

export interface GraphTraversalOptions {
  preferredType?: MediaType;
  excludedIds?: Set<number>;
  maxHop1Candidates?: number;
  maxHop2Candidates?: number;
}

/**
 * Executes a 2-hop entity graph traversal anchored to the active session seed.
 * 
 * Hop 1: Direct Director, Top Cast, and TMDB/Trope Recommendations
 * Hop 2: Collaborator filmographies and topologically adjacent thematic clusters
 */
export async function traverseEntityGraph(
  activeSeed: SessionInteraction | null,
  options: GraphTraversalOptions = {}
): Promise<GraphCandidate[]> {
  const {
    preferredType,
    excludedIds = new Set<number>(),
    maxHop1Candidates = 28,
    maxHop2Candidates = 16,
  } = options;

  const candidateMap = new Map<number, GraphCandidate>();

  const registerCandidate = (
    item: MediaItem,
    hopLevel: 1 | 2,
    primaryEdge: GraphEdgeType,
    edgeEntityName: string | undefined,
    baseProximity: number
  ) => {
    if (!item || !item.id) return;
    if (excludedIds.has(item.id)) return;
    if (!item.poster_path && !item.backdrop_path) return;
    if (preferredType && item.media_type && item.media_type !== preferredType) return;

    // Quality prior based on vote average
    const vote = item.vote_average || 6.8;
    const qualityMultiplier = Math.min(1.15, Math.max(0.85, vote / 7.5));
    const proximityScore = Math.min(1.0, baseProximity * qualityMultiplier);

    const existing = candidateMap.get(item.id);
    if (!existing || existing.graphProximityScore < proximityScore) {
      candidateMap.set(item.id, {
        item,
        hopLevel,
        primaryEdge,
        edgeEntityName,
        graphProximityScore: proximityScore,
      });
    }
  };

  // 1. Hop 1: Direct Entity Traversal from Active Seed
  if (activeSeed && activeSeed.id) {
    excludedIds.add(activeSeed.id);
    const seedType = activeSeed.media_type || 'movie';

    // Parallel fetch: credits (director + cast) and TMDB recommendations
    const [detailedCredits, directRecs] = await Promise.all([
      fetchMediaDetailedCredits(activeSeed.id, seedType).catch(() => ({ cast: [] })),
      fetchRecommendations(activeSeed.id, seedType).catch(() => []),
    ]);

    // 1a. Director Edge (Auteur Rabbit Hole: Proximity 1.0)
    let directorCreditsPromise: Promise<MediaItem[]> = Promise.resolve([]);
    if (detailedCredits.director?.id) {
      directorCreditsPromise = fetchPersonCombinedCredits(detailedCredits.director.id).catch(() => []);
    }

    // 1b. Lead Cast Edges (Actor Rabbit Hole: Proximity 0.85)
    const topCast = (detailedCredits.cast || []).slice(0, 2);
    const castCreditsPromises = topCast.map((actor) =>
      fetchPersonCombinedCredits(actor.id).catch(() => [])
    );

    const [directorWorks, ...castWorksArrays] = await Promise.all([
      directorCreditsPromise,
      ...castCreditsPromises,
    ]);

    // Ingest Director Titles
    if (detailedCredits.director && Array.isArray(directorWorks)) {
      directorWorks.slice(0, 8).forEach((media) => {
        registerCandidate(
          media,
          1,
          'director',
          `Directed by ${detailedCredits.director!.name}`,
          1.0
        );
      });
    }

    // Ingest Lead Cast Titles
    castWorksArrays.forEach((works, idx) => {
      const actor = topCast[idx];
      if (actor && Array.isArray(works)) {
        works.slice(0, 5).forEach((media) => {
          registerCandidate(
            media,
            1,
            'cast',
            `Starring ${actor.name}`,
            0.85
          );
        });
      }
    });

    // 1c. Direct Recommendations Edge (Proximity 0.80)
    if (Array.isArray(directRecs)) {
      directRecs.slice(0, 10).forEach((media) => {
        registerCandidate(
          media,
          1,
          'recommendation',
          `Because you watched ${activeSeed.title}`,
          0.80
        );
      });
    }

    // 1d. Narrative Trope & Theme Edge (Letterboxd Genome)
    const seedGenome = resolveMovieGenomeSync(activeSeed.id, seedType);
    if (seedGenome.themes.length > 0 || seedGenome.microgenres.length > 0) {
      const targetPool =
        seedType === 'tv'
          ? (imdbTop200SeriesList as MediaItem[])
          : (letterboxdTop500List as MediaItem[]);

      for (const candidate of targetPool) {
        if (candidateMap.size >= maxHop1Candidates * 2) break;
        const cGenome = resolveMovieGenomeSync(
          candidate.id,
          (candidate.media_type as any) || seedType,
          candidate
        );
        const sharedTheme = cGenome.themes.find((t) => seedGenome.themes.includes(t));
        const sharedMicro = cGenome.microgenres.find((m) => seedGenome.microgenres.includes(m));

        if (sharedTheme) {
          registerCandidate(
            candidate,
            1,
            'trope',
            `Theme: ${sharedTheme}`,
            0.75
          );
        } else if (sharedMicro) {
          registerCandidate(
            candidate,
            1,
            'trope',
            `Microgenre: ${sharedMicro}`,
            0.70
          );
        }
      }
    }
  }

  // 2. Hop 2: Serendipitous Neighbor Expansion (Filter Bubble Breakers)
  // Take top Hop-1 candidates and expand 1 further hop to their key collaborators
  const topHop1Items = Array.from(candidateMap.values())
    .filter((c) => c.hopLevel === 1)
    .sort((a, b) => b.graphProximityScore - a.graphProximityScore)
    .slice(0, 3);

  if (topHop1Items.length > 0 && candidateMap.size < maxHop1Candidates + maxHop2Candidates) {
    const hop2RecsPromises = topHop1Items.map((c) =>
      fetchRecommendations(c.item.id, (c.item.media_type as any) || 'movie').catch(() => [])
    );
    const hop2Results = await Promise.all(hop2RecsPromises);

    hop2Results.forEach((recs, idx) => {
      const parent = topHop1Items[idx];
      if (Array.isArray(recs)) {
        recs.slice(0, 4).forEach((media) => {
          registerCandidate(
            media,
            2,
            'collaborator',
            `Related to ${parent.item.title}`,
            0.62
          );
        });
      }
    });
  }

  // 3. Fallback / Quality Floor: Enrich with Letterboxd Top 500 & IMDb Top 200
  const baselineList =
    preferredType === 'tv' ? imdbTop200SeriesList : letterboxdTop500List;

  for (const media of baselineList) {
    if (candidateMap.size >= 48) break;
    registerCandidate(
      media,
      2,
      'top_rated',
      'Critically Acclaimed Masterpiece',
      0.55
    );
  }

  return Array.from(candidateMap.values()).sort(
    (a, b) => b.graphProximityScore - a.graphProximityScore
  );
}
