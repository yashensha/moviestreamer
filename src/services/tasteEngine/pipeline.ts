import type { MediaItem, MediaType } from '../../types/movie';
import { TMDB_READ_ACCESS_TOKEN, fetchTrendingMedia } from '../tmdb';
import { calculateUnifiedMatchScore } from './matchScorer';
import { letterboxdTop500List, imdbTop200SeriesList } from '../topRatedLists';
import type { UserTasteProfile, TasteEngineRows } from './types';

interface CandidateEntry {
  item: MediaItem;
  seedTitle?: string;
  matchScore: number;
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

  // Partial match against keywords in map
  for (const [key, val] of Object.entries(themeTitleMap)) {
    if (t.includes(key)) return val;
  }

  // Fallback: title case with clean ampersands
  const formatted = rawTheme
    .replace(/\s+and\s+/gi, ' & ')
    .split(/[\s_-]+/)
    .map((w) => (w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');

  return formatted;
}

/**
 * Maps TMDB raw result to MediaItem
 */
function mapTMDBToMediaItem(raw: any, typeFallback: MediaType = 'movie'): MediaItem {
  const type: MediaType = raw.media_type || (raw.title ? 'movie' : 'tv') || typeFallback;
  return {
    id: raw.id,
    title: raw.title || raw.name || 'Untitled',
    overview: raw.overview || '',
    poster_path: raw.poster_path || null,
    backdrop_path: raw.backdrop_path || null,
    media_type: type,
    release_date: raw.release_date || raw.first_air_date || '',
    vote_average: raw.vote_average || 7.0,
    genre_ids: raw.genre_ids || [],
  };
}

/**
 * Maps high-level themes to natural TMDB genre discovery filters
 */
function getGenreFilterForTheme(themeName: string): string {
  const t = themeName.toLowerCase();
  if (t.includes('superhero') || t.includes('alien') || t.includes('space')) return '28,878';
  if (t.includes('combat') || t.includes('martial arts') || t.includes('action')) return '28,12';
  if (t.includes('horror') || t.includes('haunted') || t.includes('creepy') || t.includes('vampire')) return '27,53';
  if (t.includes('humor') || t.includes('comedy') || t.includes('jokes')) return '35';
  if (t.includes('romance') || t.includes('relationship') || t.includes('charming')) return '10749,18';
  if (t.includes('crime') || t.includes('gangster') || t.includes('noir') || t.includes('heist')) return '80,53';
  if (t.includes('animated') || t.includes('kids') || t.includes('fairy-tale')) return '16,10751';
  if (t.includes('mystery') || t.includes('thriller') || t.includes('psychological')) return '9648,53';
  if (t.includes('war') || t.includes('military') || t.includes('battle')) return '10752,36';
  if (t.includes('western')) return '37';
  if (t.includes('family') || t.includes('heartfelt') || t.includes('sentimental')) return '10751,18';
  return '18'; // Drama baseline
}

/**
 * Helper to fetch TMDB endpoint safely
 */
async function fetchTMDBJson(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/**
 * Executes the Netflix-style taste recommendation pipeline with deep candidate pools
 */
export async function runTasteRecommendationPipeline(
  profile: UserTasteProfile,
  options: { preferredType?: MediaType; limit?: number } = {}
): Promise<TasteEngineRows> {
  const preferredType = options.preferredType;
  const limit = options.limit || 20;

  // Cold Start: Fallback to high-quality trending
  if (profile.totalInteractions === 0) {
    const trending = await fetchTrendingMedia();
    const topPicks = (preferredType ? trending.filter((t) => t.media_type === preferredType) : trending).slice(0, limit);
    return {
      topPicks,
      thematicRows: [],
      totalPoolCount: topPicks.length,
    };
  }

  const candidatePool = new Map<number, CandidateEntry>();
  
  // Strictly filter seeds matching preferredType to prevent cross-contamination
  const matchingTypeSeeds = preferredType
    ? profile.positiveSeeds.filter((s) => s.media_type === preferredType)
    : profile.positiveSeeds;

  const seedsToUse = matchingTypeSeeds.length > 0 ? matchingTypeSeeds.slice(0, 8) : profile.positiveSeeds.slice(0, 8);
  const primarySeed = seedsToUse[0];
  const secondarySeed = seedsToUse[1];
  const seedType = preferredType || primarySeed?.media_type || 'movie';

  const parallelTasks: Promise<void>[] = [];

  // ============================================================================
  // Task 1: Deep Harvesting for Primary Seed ("Because You Watched")
  // Fetch Recommendations (p1 + p2), Similar (p1), and Discover with seed genres
  // ============================================================================
  const seedCandidatesMap = new Map<number, MediaItem>();

  if (primarySeed && (!preferredType || primarySeed.media_type === preferredType)) {
    parallelTasks.push(
      (async () => {
        const [recsP1, recsP2, similarP1] = await Promise.all([
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/recommendations?page=1`),
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/recommendations?page=2`),
          fetchTMDBJson(`https://api.themoviedb.org/3/${primarySeed.media_type}/${primarySeed.id}/similar?page=1`),
        ]);

        const rawList = [...recsP1, ...recsP2, ...similarP1];
        for (const raw of rawList) {
          if (raw.id === primarySeed.id || profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          if (preferredType && item.media_type !== preferredType) continue;
          seedCandidatesMap.set(item.id, item);
        }

        // If still low on candidates, fetch discover by primary seed's genres
        if (seedCandidatesMap.size < 25 && primarySeed.genres.length > 0) {
          const disc = await fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=100&page=1`
          );
          for (const raw of disc) {
            if (raw.id === primarySeed.id || profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
            const item = mapTMDBToMediaItem(raw, seedType);
            if (preferredType && item.media_type !== preferredType) continue;
            seedCandidatesMap.set(item.id, item);
          }
        }
      })()
    );
  }

  // ============================================================================
  // Task 2: Secondary Seed Harvesting ("More Like / Because You Liked Seed 2")
  // ============================================================================
  const secondarySeedCandidatesMap = new Map<number, MediaItem>();

  if (secondarySeed && (!preferredType || secondarySeed.media_type === preferredType)) {
    parallelTasks.push(
      (async () => {
        const [recsP1, similarP1] = await Promise.all([
          fetchTMDBJson(`https://api.themoviedb.org/3/${secondarySeed.media_type}/${secondarySeed.id}/recommendations?page=1`),
          fetchTMDBJson(`https://api.themoviedb.org/3/${secondarySeed.media_type}/${secondarySeed.id}/similar?page=1`),
        ]);

        const rawList = [...recsP1, ...similarP1];
        for (const raw of rawList) {
          if (raw.id === secondarySeed.id || raw.id === primarySeed?.id || profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          if (preferredType && item.media_type !== preferredType) continue;
          secondarySeedCandidatesMap.set(item.id, item);
        }
      })()
    );
  }

  // ============================================================================
  // Task 3: Broad Candidate Harvesting across other favorite seeds (seeds 3..6)
  // ============================================================================
  for (const seed of seedsToUse.slice(2, 6)) {
    if (preferredType && seed.media_type !== preferredType) continue;
    parallelTasks.push(
      (async () => {
        const recs = await fetchTMDBJson(
          `https://api.themoviedb.org/3/${seed.media_type}/${seed.id}/recommendations?page=1`
        );
        for (const raw of recs) {
          if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          if (preferredType && item.media_type !== preferredType) continue;
          if (!candidatePool.has(item.id)) {
            const match = calculateUnifiedMatchScore(item, profile);
            candidatePool.set(item.id, {
              item,
              seedTitle: seed.title,
              matchScore: match.percentage,
            });
          }
        }
      })()
    );
  }

  // ============================================================================
  // Task 4: Thematic Rows Discovery (Top 2-3 Themes)
  // Fetch high-volume discover sets for each theme
  // ============================================================================
  const thematicRowsToHarvest = profile.topThemes.slice(0, 3);
  const themeCandidateBuckets = new Map<string, Map<number, MediaItem>>();

  for (const th of thematicRowsToHarvest) {
    themeCandidateBuckets.set(th.name, new Map());
    const genreFilter = getGenreFilterForTheme(th.name);

    parallelTasks.push(
      (async () => {
        const [p1, p2] = await Promise.all([
          fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?with_genres=${genreFilter}&sort_by=popularity.desc&vote_average.gte=6.6&vote_count.gte=100&page=1`
          ),
          fetchTMDBJson(
            `https://api.themoviedb.org/3/discover/${seedType}?with_genres=${genreFilter}&sort_by=popularity.desc&vote_average.gte=6.4&vote_count.gte=80&page=2`
          ),
        ]);

        const bucket = themeCandidateBuckets.get(th.name)!;
        for (const raw of [...p1, ...p2]) {
          if (profile.excludedIds.has(raw.id) || !raw.poster_path) continue;
          const item = mapTMDBToMediaItem(raw, seedType);
          bucket.set(item.id, item);

          // Also inject into global candidate pool for Top Picks
          if (!candidatePool.has(item.id)) {
            const match = calculateUnifiedMatchScore(item, profile);
            candidatePool.set(item.id, {
              item,
              seedTitle: th.name,
              matchScore: match.percentage,
            });
          }
        }
      })()
    );
  }

  await Promise.allSettled(parallelTasks);

  // Inject primary seed candidates into candidate pool
  for (const item of seedCandidatesMap.values()) {
    if (!candidatePool.has(item.id)) {
      const match = calculateUnifiedMatchScore(item, profile);
      candidatePool.set(item.id, {
        item,
        seedTitle: primarySeed?.title,
        matchScore: match.percentage,
      });
    }
  }

  // Inject secondary seed candidates into candidate pool
  for (const item of secondarySeedCandidatesMap.values()) {
    if (!candidatePool.has(item.id)) {
      const match = calculateUnifiedMatchScore(item, profile);
      candidatePool.set(item.id, {
        item,
        seedTitle: secondarySeed?.title,
        matchScore: match.percentage,
      });
    }
  }

  // ============================================================================
  // Rank and assemble final rows (Netflix standards: 18 - 24 items per row)
  // ============================================================================
  const rankedCandidates = Array.from(candidatePool.values()).sort(
    (a, b) => b.matchScore - a.matchScore
  );

  // Row 1: Top Picks (Top 20 candidates)
  const topPicks = rankedCandidates.slice(0, 20).map((c) => c.item);

  // More Top Matches (candidates 10..35) to allow deduplication with Hero row
  const moreTopMatches = rankedCandidates.slice(10, 35).map((c) => c.item);

  // Row 2: Because You Watched "{primarySeed.title}" (18-20 items)
  let becauseYouWatched: TasteEngineRows['becauseYouWatched'] = undefined;
  if (primarySeed) {
    const scoredSeedCandidates = Array.from(seedCandidatesMap.values())
      .map((item) => ({
        item,
        score: calculateUnifiedMatchScore(item, profile).percentage,
      }))
      .sort((a, b) => b.score - a.score);

    // If seed candidates are plentiful, take top 18-20
    let seedItems = scoredSeedCandidates.map((c) => c.item).slice(0, 20);

    // If still under 14 items, backfill with top picks from similar genres
    if (seedItems.length < 14) {
      const existingIds = new Set(seedItems.map((i) => i.id));
      for (const cand of rankedCandidates) {
        if (!existingIds.has(cand.item.id) && cand.item.id !== primarySeed.id) {
          seedItems.push(cand.item);
          existingIds.add(cand.item.id);
          if (seedItems.length >= 18) break;
        }
      }
    }

    if (seedItems.length >= 6) {
      becauseYouWatched = {
        seedTitle: primarySeed.title,
        items: seedItems,
      };
    }
  }

  // Row 3: Secondary Seed ("More Like Seed 2" or "Because You Liked Seed 2")
  let secondaryBecauseYouWatched: TasteEngineRows['secondaryBecauseYouWatched'] = undefined;
  if (secondarySeed && secondarySeedCandidatesMap.size > 0) {
    const scoredSecCandidates = Array.from(secondarySeedCandidatesMap.values())
      .filter((item) => item.id !== primarySeed?.id && item.id !== secondarySeed.id)
      .map((item) => ({
        item,
        score: calculateUnifiedMatchScore(item, profile).percentage,
      }))
      .sort((a, b) => b.score - a.score);

    let secItems = scoredSecCandidates.map((c) => c.item).slice(0, 20);
    if (secItems.length < 14) {
      const existingIds = new Set(secItems.map((i) => i.id));
      if (primarySeed) existingIds.add(primarySeed.id);
      existingIds.add(secondarySeed.id);
      for (const cand of rankedCandidates) {
        if (!existingIds.has(cand.item.id)) {
          secItems.push(cand.item);
          existingIds.add(cand.item.id);
          if (secItems.length >= 18) break;
        }
      }
    }

    if (secItems.length >= 6) {
      secondaryBecauseYouWatched = {
        seedTitle: secondarySeed.title,
        items: secItems,
      };
    }
  }

  // Row 4: Hidden Gems for Your Taste (High match >= 80%, high rating >= 6.8, not the first 4 mega-blockbusters)
  const hiddenGemsPool = rankedCandidates
    .filter((c) => {
      const vote = c.item.vote_average || 0;
      return c.matchScore >= 80 && vote >= 6.8;
    })
    .slice(4);

  let hiddenGems: TasteEngineRows['hiddenGems'] = undefined;
  if (hiddenGemsPool.length >= 6) {
    hiddenGems = {
      title: 'Hidden Gems for Your Taste',
      items: hiddenGemsPool.slice(0, 20).map((c) => c.item),
    };
  }

  // Row 5+: Thematic Rows with Evocative Titles (18-20 items per row)
  const thematicRows: TasteEngineRows['thematicRows'] = [];

  for (const th of thematicRowsToHarvest) {
    const bucket = themeCandidateBuckets.get(th.name);
    if (!bucket || bucket.size === 0) continue;

    const scoredThemeItems = Array.from(bucket.values())
      .map((item) => ({
        item,
        score: calculateUnifiedMatchScore(item, profile).percentage,
      }))
      .sort((a, b) => b.score - a.score);

    let rowItems = scoredThemeItems.map((c) => c.item).slice(0, 20);

    // If any row is under 14, backfill with high-scoring items from candidate pool
    if (rowItems.length < 14) {
      const existingIds = new Set(rowItems.map((i) => i.id));
      for (const cand of rankedCandidates) {
        if (!existingIds.has(cand.item.id)) {
          rowItems.push(cand.item);
          existingIds.add(cand.item.id);
          if (rowItems.length >= 18) break;
        }
      }
    }

    if (rowItems.length >= 8) {
      thematicRows.push({
        title: formatEvocativeThemeTitle(th.name),
        themeOrGenre: th.name,
        items: rowItems,
      });
    }
  }

  // Row 6: Prestige & Award-Winning Picks tailored to user's taste genome
  let prestigeSource: MediaItem[] = [];
  if (preferredType === 'tv') {
    prestigeSource = imdbTop200SeriesList;
  } else if (preferredType === 'movie') {
    prestigeSource = letterboxdTop500List;
  } else {
    prestigeSource = [...letterboxdTop500List.slice(0, 100), ...imdbTop200SeriesList.slice(0, 80)];
  }

  const scoredPrestige = prestigeSource
    .filter((item) => !profile.excludedIds.has(item.id))
    .map((item) => ({
      item,
      score: calculateUnifiedMatchScore(item, profile).percentage,
    }))
    .filter((c) => c.score >= 82)
    .sort((a, b) => b.score - a.score);

  let prestigePicks: TasteEngineRows['prestigePicks'] = undefined;
  if (scoredPrestige.length >= 6) {
    prestigePicks = {
      title:
        preferredType === 'tv'
          ? 'Critically Acclaimed TV for Your Taste'
          : preferredType === 'movie'
          ? 'Letterboxd Acclaimed for Your Taste'
          : 'Critically Acclaimed for Your Taste',
      items: scoredPrestige.slice(0, 20).map((c) => c.item),
    };
  }

  // Strict media_type validation filter
  let finalTopPicks = topPicks;
  let finalMoreTopMatches = moreTopMatches;
  let finalBecauseYouWatched = becauseYouWatched;
  let finalSecondaryBecauseYouWatched = secondaryBecauseYouWatched;
  let finalHiddenGems = hiddenGems;
  let finalThematicRows = thematicRows;
  let finalPrestigePicks = prestigePicks;

  if (preferredType) {
    finalTopPicks = topPicks.filter((i) => i.media_type === preferredType);
    finalMoreTopMatches = moreTopMatches.filter((i) => i.media_type === preferredType);
    if (finalBecauseYouWatched) {
      finalBecauseYouWatched = {
        ...finalBecauseYouWatched,
        items: finalBecauseYouWatched.items.filter((i) => i.media_type === preferredType),
      };
      if (finalBecauseYouWatched.items.length < 4) finalBecauseYouWatched = undefined;
    }
    if (finalSecondaryBecauseYouWatched) {
      finalSecondaryBecauseYouWatched = {
        ...finalSecondaryBecauseYouWatched,
        items: finalSecondaryBecauseYouWatched.items.filter((i) => i.media_type === preferredType),
      };
      if (finalSecondaryBecauseYouWatched.items.length < 4) finalSecondaryBecauseYouWatched = undefined;
    }
    if (finalHiddenGems) {
      finalHiddenGems = {
        ...finalHiddenGems,
        items: finalHiddenGems.items.filter((i) => i.media_type === preferredType),
      };
      if (finalHiddenGems.items.length < 4) finalHiddenGems = undefined;
    }
    if (finalPrestigePicks) {
      finalPrestigePicks = {
        ...finalPrestigePicks,
        items: finalPrestigePicks.items.filter((i) => i.media_type === preferredType),
      };
      if (finalPrestigePicks.items.length < 4) finalPrestigePicks = undefined;
    }
    finalThematicRows = thematicRows
      .map((row) => ({
        ...row,
        items: row.items.filter((i) => i.media_type === preferredType),
      }))
      .filter((row) => row.items.length >= 4);
  }

  return {
    topPicks: finalTopPicks,
    moreTopMatches: finalMoreTopMatches,
    becauseYouWatched: finalBecauseYouWatched,
    secondaryBecauseYouWatched: finalSecondaryBecauseYouWatched,
    hiddenGems: finalHiddenGems,
    thematicRows: finalThematicRows,
    prestigePicks: finalPrestigePicks,
    totalPoolCount: rankedCandidates.length,
  };
}
