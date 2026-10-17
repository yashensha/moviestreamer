const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const http = require('http');

// TMDB Read Access Token
const TMDB_TOKEN =
  process.env.VITE_TMDB_READ_ACCESS_TOKEN ||
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MjMwZGZkNDdmYmMxMDA5YzU5ZWY4MjA5ZTIxZTIyNyIsIm5iZiI6MTc5MjE1NTY1MC41NDMsInN1YiI6IjZhZDIyMDAyMzlmOTM4ZWY4OGY4MDdhNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VtCzdSniVBzjYY8aoaMrOkzaV2F6V5zmhe6EG9vevcs';

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const TV_OUTPUT_FILE = path.join(DATA_DIR, 'tv_subgenres.json');
const MOVIE_OUTPUT_FILE = path.join(DATA_DIR, 'movie_subgenres.json');
const TAXONOMY_FILE = path.join(DATA_DIR, 'subgenre_taxonomy.json');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : fallback;
};

const TARGET_TYPE = getArg('type', 'tv'); // 'tv', 'movie', or 'all'
const LIMIT = parseInt(getArg('limit', '1000'), 10);
const CONCURRENCY = parseInt(getArg('concurrency', '20'), 10);
const MIN_POP = parseFloat(getArg('min-pop', '2.0'));
const START_YEAR_TV = parseInt(getArg('tv-start-year', '1970'), 10);
const START_YEAR_MOVIE = parseInt(getArg('movie-start-year', '1930'), 10);

console.log('='.repeat(60));
console.log('TMDB MEDIA TAGGER & SUBGENRE EXTRACTOR');
console.log(`Target Type:      ${TARGET_TYPE}`);
console.log(`Processing Limit: ${LIMIT} items`);
console.log(`Concurrency:      ${CONCURRENCY} parallel streams`);
console.log(`Min Popularity:   ${MIN_POP}`);
console.log(`TV Min Year:      ${START_YEAR_TV}`);
console.log(`Movie Min Year:   ${START_YEAR_MOVIE}`);
console.log('='.repeat(60));

// Load taxonomy for cluster tagging
let taxonomy = { clusters: {}, canonicalTags: [] };
try {
  taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, 'utf8'));
} catch (e) {
  console.warn('Could not load taxonomy file, skipping cluster mapping');
}

/**
 * Downloads and parses TMDB Daily Export GZ file
 */
function downloadDailyExport(type = 'tv') {
  return new Promise((resolve, reject) => {
    const pad = (n) => String(n).padStart(2, '0');
    // Try last 3 days
    const tryDates = [];
    for (let i = 0; i < 4; i++) {
      const dt = new Date(Date.now() - i * 86400000);
      tryDates.push(`${pad(dt.getMonth() + 1)}_${pad(dt.getDate())}_${dt.getFullYear()}`);
    }

    const tryNext = (dateIdx) => {
      if (dateIdx >= tryDates.length) {
        return reject(new Error('Failed to find recent TMDB daily export file'));
      }
      const dateStr = tryDates[dateIdx];
      const filename = type === 'tv' ? `tv_series_ids_${dateStr}.json.gz` : `movie_ids_${dateStr}.json.gz`;
      const url = `http://files.tmdb.org/p/exports/${filename}`;

      console.log(`Attempting to stream TMDB export: ${filename}...`);

      http.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return tryNext(dateIdx + 1);
        }

        const gunzip = zlib.createGunzip();
        res.pipe(gunzip);

        const items = [];
        let buffer = '';

        gunzip.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.popularity >= MIN_POP) {
                items.push(parsed);
              }
            } catch (e) {}
          }
        });

        gunzip.on('end', () => {
          console.log(`Loaded ${items.length} ${type} items with popularity >= ${MIN_POP}`);
          resolve(items);
        });

        gunzip.on('error', (err) => {
          tryNext(dateIdx + 1);
        });
      }).on('error', () => tryNext(dateIdx + 1));
    };

    tryNext(0);
  });
}

/**
 * Classifies keywords against universal subgenre taxonomy
 */
function classifySubgenres(keywords) {
  const matchedClusters = new Set();
  const matchedTags = new Set();

  for (const kw of keywords) {
    const lower = kw.toLowerCase().trim();
    if (!lower) continue;

    for (const [clusterName, clusterTags] of Object.entries(taxonomy.clusters || {})) {
      if (clusterTags.some((tag) => lower === tag || lower.includes(tag) || tag.includes(lower))) {
        matchedClusters.add(clusterName);
        matchedTags.add(lower);
      }
    }
  }

  return {
    clusters: Array.from(matchedClusters).slice(0, 4),
    subgenres: Array.from(matchedTags).slice(0, 8),
  };
}

/**
 * Fetches full metadata (keywords, credits, creators) for a TV show or Movie
 */
async function fetchItemDetails(id, type = 'tv') {
  const url = `https://api.themoviedb.org/3/${type}/${id}?append_to_response=keywords,credits`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
    },
  });

  if (res.status === 429) {
    // Rate limited - wait 1 second and retry
    await new Promise((r) => setTimeout(r, 1200));
    return fetchItemDetails(id, type);
  }

  if (!res.ok) return null;
  return await res.json();
}

/**
 * Extracts unified tags for a TV show (as a single series entry)
 */
function extractTVTags(data) {
  if (!data) return null;

  const firstAirYear = data.first_air_date ? parseInt(data.first_air_date.slice(0, 4), 10) : 0;
  if (firstAirYear > 0 && firstAirYear < START_YEAR_TV) {
    return null; // Skip if prior to specified start year
  }

  // 1. Keywords
  const rawKeywords = Array.isArray(data.keywords?.results)
    ? data.keywords.results.map((k) => k.name.toLowerCase().trim())
    : [];

  // 2. Creators & Showrunners (created_by)
  const creators = Array.isArray(data.created_by)
    ? data.created_by.map((c) => c.name)
    : [];

  // 3. Top Cast (Top 4 actors)
  const cast = Array.isArray(data.credits?.cast)
    ? data.credits.cast.slice(0, 4).map((c) => c.name)
    : [];

  // 4. Directors & Writers from crew
  const directors = [];
  const writers = [];
  const producers = [];

  if (Array.isArray(data.credits?.crew)) {
    for (const member of data.credits.crew) {
      if (member.job === 'Director' && !directors.includes(member.name)) {
        directors.push(member.name);
      } else if (member.department === 'Writing' && !writers.includes(member.name)) {
        writers.push(member.name);
      } else if ((member.job === 'Executive Producer' || member.job === 'Producer') && !producers.includes(member.name)) {
        if (producers.length < 3) producers.push(member.name);
      }
    }
  }

  // 5. Subgenres and Clusters
  const { clusters, subgenres } = classifySubgenres(rawKeywords);

  // Unified tag list combining keywords, subgenres, creators, and actors
  const cleanTags = Array.from(
    new Set([
      ...subgenres,
      ...rawKeywords.slice(0, 6),
      ...creators.map((c) => c.toLowerCase()),
      ...directors.slice(0, 2).map((d) => d.toLowerCase()),
      ...cast.slice(0, 3).map((a) => a.toLowerCase()),
    ])
  ).slice(0, 10);

  return {
    id: data.id,
    title: data.name || data.original_name,
    year: firstAirYear,
    popularity: data.popularity,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    creators,
    directors: directors.slice(0, 3),
    writers: writers.slice(0, 3),
    producers,
    cast,
    keywords: rawKeywords.slice(0, 8),
    clusters,
    subgenres,
    tags: cleanTags,
  };
}

/**
 * Extracts unified tags for a Movie
 */
function extractMovieTags(data) {
  if (!data) return null;

  const releaseYear = data.release_date ? parseInt(data.release_date.slice(0, 4), 10) : 0;
  if (releaseYear > 0 && releaseYear < START_YEAR_MOVIE) {
    return null; // Skip if prior to specified start year
  }

  // 1. Keywords
  const rawKeywords = Array.isArray(data.keywords?.keywords)
    ? data.keywords.keywords.map((k) => k.name.toLowerCase().trim())
    : [];

  // 2. Top Cast (Top 4 actors)
  const cast = Array.isArray(data.credits?.cast)
    ? data.credits.cast.slice(0, 4).map((c) => c.name)
    : [];

  // 3. Director, Writers, Producers
  const directors = [];
  const writers = [];
  const producers = [];

  if (Array.isArray(data.credits?.crew)) {
    for (const member of data.credits.crew) {
      if (member.job === 'Director' && !directors.includes(member.name)) {
        directors.push(member.name);
      } else if (member.department === 'Writing' && !writers.includes(member.name)) {
        writers.push(member.name);
      } else if ((member.job === 'Producer' || member.job === 'Executive Producer') && !producers.includes(member.name)) {
        if (producers.length < 3) producers.push(member.name);
      }
    }
  }

  const { clusters, subgenres } = classifySubgenres(rawKeywords);

  const cleanTags = Array.from(
    new Set([
      ...subgenres,
      ...rawKeywords.slice(0, 6),
      ...directors.slice(0, 2).map((d) => d.toLowerCase()),
      ...cast.slice(0, 3).map((a) => a.toLowerCase()),
    ])
  ).slice(0, 10);

  return {
    id: data.id,
    title: data.title || data.original_title,
    year: releaseYear,
    popularity: data.popularity,
    vote_average: data.vote_average,
    vote_count: data.vote_count,
    directors: directors.slice(0, 3),
    writers: writers.slice(0, 3),
    producers,
    cast,
    keywords: rawKeywords.slice(0, 8),
    clusters,
    subgenres,
    tags: cleanTags,
  };
}

/**
 * Worker runner with checkpointing and concurrent worker pool
 */
async function run() {
  const startTime = Date.now();

  if (TARGET_TYPE === 'tv' || TARGET_TYPE === 'all') {
    console.log('\n--- Processing TV Shows (After 1970) ---');

    // Load existing TV subgenres if present (resumable)
    let tvMap = {};
    if (fs.existsSync(TV_OUTPUT_FILE)) {
      try {
        tvMap = JSON.parse(fs.readFileSync(TV_OUTPUT_FILE, 'utf8'));
        console.log(`Loaded ${Object.keys(tvMap).length} previously processed TV shows.`);
      } catch (e) {}
    }

    const tvExport = await downloadDailyExport('tv');

    // Sort by popularity descending so the best titles are processed first
    tvExport.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    // Filter out already processed items
    const pendingTV = tvExport.filter((item) => !tvMap[String(item.id)]).slice(0, LIMIT);
    console.log(`Starting fetch for ${pendingTV.length} TV shows (Concurrency: ${CONCURRENCY})...`);

    let completed = 0;
    let savedCount = 0;

    // Concurrency queue
    let idx = 0;
    const workers = Array.from({ length: CONCURRENCY }).map(async () => {
      while (idx < pendingTV.length) {
        const item = pendingTV[idx++];
        try {
          const details = await fetchItemDetails(item.id, 'tv');
          const extracted = extractTVTags(details);
          if (extracted) {
            tvMap[String(item.id)] = extracted;
            savedCount++;
          }
        } catch (e) {
          // ignore error
        }

        completed++;
        if (completed % 50 === 0 || completed === pendingTV.length) {
          process.stdout.write(
            `\rProgress: ${completed}/${pendingTV.length} (${Math.round((completed / pendingTV.length) * 100)}%) | Tagged TV: ${savedCount}`
          );
          // Checkpoint to disk
          fs.writeFileSync(TV_OUTPUT_FILE, JSON.stringify(tvMap));
        }
      }
    });

    await Promise.all(workers);
    fs.writeFileSync(TV_OUTPUT_FILE, JSON.stringify(tvMap, null, 2));
    console.log(`\nFinished TV tagging. Total TV shows in dataset: ${Object.keys(tvMap).length}`);
  }

  if (TARGET_TYPE === 'movie' || TARGET_TYPE === 'all') {
    console.log('\n--- Processing Untagged Movies (After 1930) ---');

    let movieMap = {};
    if (fs.existsSync(MOVIE_OUTPUT_FILE)) {
      try {
        movieMap = JSON.parse(fs.readFileSync(MOVIE_OUTPUT_FILE, 'utf8'));
        console.log(`Loaded ${Object.keys(movieMap).length} current movie subgenre entries.`);
      } catch (e) {}
    }

    const movieExport = await downloadDailyExport('movie');
    movieExport.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    // Find movies not in movieMap
    const pendingMovies = movieExport.filter((item) => !movieMap[String(item.id)]).slice(0, LIMIT);
    console.log(`Starting fetch for ${pendingMovies.length} untagged movies (Concurrency: ${CONCURRENCY})...`);

    let completed = 0;
    let savedCount = 0;

    let idx = 0;
    const workers = Array.from({ length: CONCURRENCY }).map(async () => {
      while (idx < pendingMovies.length) {
        const item = pendingMovies[idx++];
        try {
          const details = await fetchItemDetails(item.id, 'movie');
          const extracted = extractMovieTags(details);
          if (extracted && extracted.tags.length > 0) {
            movieMap[String(item.id)] = extracted.tags;
            savedCount++;
          }
        } catch (e) {
          // ignore
        }

        completed++;
        if (completed % 50 === 0 || completed === pendingMovies.length) {
          process.stdout.write(
            `\rProgress: ${completed}/${pendingMovies.length} (${Math.round((completed / pendingMovies.length) * 100)}%) | Added Movies: ${savedCount}`
          );
          fs.writeFileSync(MOVIE_OUTPUT_FILE, JSON.stringify(movieMap));
        }
      }
    });

    await Promise.all(workers);
    fs.writeFileSync(MOVIE_OUTPUT_FILE, JSON.stringify(movieMap));
    console.log(`\nFinished Movie tagging. Total movies in dataset: ${Object.keys(movieMap).length}`);
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nAll done in ${durationSec}s!`);
}

run().catch((err) => {
  console.error('Fatal error in tagger:', err);
});
