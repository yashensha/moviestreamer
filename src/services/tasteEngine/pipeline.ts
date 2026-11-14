import type { MediaItem, MediaType } from '../../types/movie';
import { traverseEntityGraph } from './graphTraversal';
import { scoreTwoSpeedCandidate } from './twoSpeedMatcher';
import { resolveMovieGenomeSync } from './genome';
import type { SessionInteraction, ActiveSessionState } from './sessionState';
import type { UserTasteProfile, TasteEngineRows } from './types';

export interface TastePipelineOptions {
  preferredType?: MediaType;
  sessionState?: ActiveSessionState | null;
}

/**
 * Transforms raw theme names into evocative, Netflix-style browse row titles
 */
export function formatEvocativeThemeTitle(rawTheme: string): string {
  if (!rawTheme) return 'Recommended for You';
  const t = rawTheme.toLowerCase().trim();

  const themeTitleMap: Record<string, string> = {
    superhero: 'Superhero Sagas & Comic Universes',
    superheroes: 'Superhero Sagas & Comic Universes',
    alien: 'Cosmic Mysteries & Sci-Fi Encounters',
    space: 'Deep Space & Intergalactic Odysseys',
    'sci-fi': 'Mind-Bending Sci-Fi & Alternate Realities',
    'science fiction': 'Mind-Bending Sci-Fi & Alternate Realities',
    combat: 'High-Octane Combat & Martial Arts',
    action: 'Adrenaline-Fueled Action & Thrillers',
    'martial arts': 'Martial Arts & Elite Hand-to-Hand',
    horror: 'Chilling Supernatural & Psychological Horror',
    haunted: 'Haunted Lore & Dark Mysteries',
    creepy: 'Dark, Unsettling & Creepy Tales',
    vampire: 'Vampire & Gothic Fantasy',
    humor: 'Witty Comedies & Feel-Good Laughs',
    comedy: 'Binge-Worthy Comedies & Parodies',
    jokes: 'Binge-Worthy Comedies & Parodies',
    romance: 'Heartfelt Romances & Emotional Journeys',
    relationship: 'Intimate Dramas & Complex Relationships',
    charming: 'Charming Rom-Coms & Warm Escapes',
    crime: 'Gritty Crime Sagas & Heists',
    gangster: 'Underworld Gangster & Mob Chronicles',
    noir: 'Neo-Noir & Atmospheric Detective Thrillers',
    heist: 'High-Stakes Heists & Masterminds',
    animated: 'Visionary Animation & Legendary Worlds',
    animation: 'Visionary Animation & Legendary Worlds',
    anime: 'Iconic Anime & Shonen Adventures',
    kids: 'Family Favorites & Whimsical Adventures',
    'fairy-tale': 'Mythic Fairy Tales & Enchanted Worlds',
    mystery: 'Edge-of-Your-Seat Whodunits & Mysteries',
    thriller: 'Heart-Pounding Psychological Thrillers',
    psychological: 'Mind-Twisting Psychological Dramas',
    war: 'Epic War Chronicles & Battlegrounds',
    military: 'Tactical Military & Special Ops',
    battle: 'Epic Battles & Historic Warfare',
    western: 'Riveting Westerns & Frontier Tales',
    family: 'Heartwarming Family Stories & Comfort Watches',
    heartfelt: 'Inspiring & Heartfelt Journeys',
    sentimental: 'Nostalgic & Sentimental Favorites',
    dystopia: 'Dystopian Futures & Survival Epics',
    cyberpunk: 'Cyberpunk & High-Tech Noir',
    time_travel: 'Time Travel & Paradoxical Realities',
    fantasy: 'Epic High Fantasy & Mythical Quests',
  };

  if (themeTitleMap[t]) return themeTitleMap[t];

  for (const [key, val] of Object.entries(themeTitleMap)) {
    if (t.includes(key)) return val;
  }

  const formatted = rawTheme
    .replace(/\s+and\s+/gi, ' & ')
    .split(/[\s_-]+/)
    .map((w) => (w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

  return formatted;
}

/**
 * Core Sequential Recommendation Pipeline
 * 
 * 1. Identifies active session seed (or falls back to top user positive seed)
 * 2. Traverses 2-hop entity graph (Director, Cast, Tropes, Recommendations)
 * 3. Scores candidates via Two-Speed Gated Fusion Matcher
 * 4. Partitions results into curated browse rows with explainable attribution
 */
export async function runTasteRecommendationPipeline(
  profile?: UserTasteProfile | null,
  options: TastePipelineOptions = {}
): Promise<TasteEngineRows> {
  const { preferredType, sessionState } = options;

  // Determine active seed: session activeSeed takes precedence
  let activeSeed: SessionInteraction | null = sessionState?.activeSeed || null;

  // If no active session seed exists, derive from user's most recent top favorite
  if (!activeSeed && profile && profile.positiveSeeds && profile.positiveSeeds.length > 0) {
    const topSeed = profile.positiveSeeds[0];
    activeSeed = {
      id: topSeed.id,
      title: topSeed.title,
      media_type: topSeed.media_type,
      action: 'heart',
      weight: 0.9,
      timestamp: Date.now(),
      director: topSeed.director,
      cast: topSeed.cast,
    };
  }

  const excludedIds = new Set<number>(profile?.excludedIds ? Array.from(profile.excludedIds) : []);

  // 1. Traverse 2-Hop Entity Graph
  const graphCandidates = await traverseEntityGraph(activeSeed, {
    preferredType,
    excludedIds,
    maxHop1Candidates: 32,
    maxHop2Candidates: 20,
  });

  // 2. Score with Two-Speed Gated Fusion Matcher
  const scoredCandidates = graphCandidates.map((c) => {
    const scored = scoreTwoSpeedCandidate(c, sessionState, profile);
    const enrichedItem: MediaItem = {
      ...c.item,
      matchScore: scored.matchPercentage,
      matchReason: scored.attributionReason,
    };
    return {
      ...scored,
      item: enrichedItem,
    };
  });

  // Sort overall pool by final score descending
  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

  const totalPoolCount = scoredCandidates.length;

  // 3. Row Partitioning

  // A. "Because You Watched" Row (Hop 1 core rabbit hole)
  let becauseYouWatched: { seedTitle: string; items: MediaItem[] } | undefined;
  const becauseSeen = new Set<number>();

  if (activeSeed && activeSeed.title) {
    const seedAdjacent = scoredCandidates
      .filter((c) => c.hopLevel === 1 || c.primaryEdge === 'director' || c.primaryEdge === 'cast' || c.primaryEdge === 'recommendation')
      .slice(0, 18)
      .map((c) => {
        becauseSeen.add(c.item.id);
        return c.item;
      });

    if (seedAdjacent.length >= 3) {
      becauseYouWatched = {
        seedTitle: activeSeed.title,
        items: seedAdjacent,
      };
    }
  }

  // B. "Top Picks for You" (Balanced Two-Speed Fusion)
  const topPicksSeen = new Set<number>();
  const topPicks: MediaItem[] = [];
  const moreTopMatches: MediaItem[] = [];

  for (const c of scoredCandidates) {
    if (topPicks.length >= 24) {
      if (moreTopMatches.length < 24) {
        moreTopMatches.push(c.item);
      }
      continue;
    }
    // Avoid exact duplicate of the primary item in Because You Watched if pool is rich
    if (becauseSeen.has(c.item.id) && scoredCandidates.length > 30 && topPicks.length < 12) {
      continue;
    }
    if (!topPicksSeen.has(c.item.id)) {
      topPicksSeen.add(c.item.id);
      topPicks.push(c.item);
    }
  }

  // C. Thematic Dives (Cluster exploration)
  const themeBuckets = new Map<string, MediaItem[]>();

  for (const c of scoredCandidates) {
    const genome = resolveMovieGenomeSync(
      c.item.id,
      (c.item.media_type as any) || 'movie',
      c.item
    );
    const mainTheme = genome.themes[0] || genome.microgenres[0];
    if (mainTheme) {
      const cleanTheme = mainTheme.toLowerCase().trim();
      const bucket = themeBuckets.get(cleanTheme) || [];
      if (bucket.length < 16) {
        bucket.push(c.item);
        themeBuckets.set(cleanTheme, bucket);
      }
    }
  }

  // Pick top 2 theme clusters with at least 4 titles
  const thematicRows: Array<{ title: string; themeOrGenre: string; items: MediaItem[] }> = [];
  for (const [rawTheme, items] of themeBuckets.entries()) {
    if (items.length >= 4 && thematicRows.length < 3) {
      thematicRows.push({
        title: formatEvocativeThemeTitle(rawTheme),
        themeOrGenre: rawTheme,
        items,
      });
    }
  }

  // D. "Hidden Gems / Comfort Classics" (Fatigue mitigation)
  const hiddenGemsCandidates = scoredCandidates
    .filter((c) => (c.item.vote_average || 0) >= 7.8 && c.matchPercentage >= 84)
    .slice(0, 18)
    .map((c) => c.item);

  const hiddenGems =
    hiddenGemsCandidates.length >= 4
      ? {
          title: 'Critically Acclaimed & Comfort Favorites',
          items: hiddenGemsCandidates,
        }
      : undefined;

  return {
    topPicks: topPicks.length > 0 ? topPicks : scoredCandidates.slice(0, 24).map((c) => c.item),
    moreTopMatches: moreTopMatches.length > 0 ? moreTopMatches : undefined,
    becauseYouWatched,
    hiddenGems,
    thematicRows,
    totalPoolCount,
  };
}
