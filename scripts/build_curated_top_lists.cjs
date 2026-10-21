const fs = require('fs');
const path = require('path');

const TMDB_READ_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3MjMwZGZkNDdmYmMxMDA5YzU5ZWY4MjA5ZTIxZTIyNyIsIm5iZiI6MTc5MjE1NTY1MC41NDMsInN1YiI6IjZhZDIyMDAyMzlmOTM4ZWY4OGY4MDdhNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VtCzdSniVBzjYY8aoaMrOkzaV2F6V5zmhe6EG9vevcs';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'curated_top_lists.json');

// Concurrency helper
async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        console.error(`Error processing item ${i}:`, err.message);
        results[i] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      if (res.status === 429) {
        // Rate limited, wait 1 sec
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

async function resolveTmdbTv(imdbItem) {
  // Try finding via imdb_id
  if (imdbItem.id) {
    const findUrl = `https://api.themoviedb.org/3/find/${imdbItem.id}?external_source=imdb_id`;
    const findData = await fetchWithRetry(findUrl, {
      headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
    });
    const tvResult = findData?.tv_results?.[0];
    if (tvResult) {
      return {
        id: tvResult.id,
        title: tvResult.name || imdbItem.title,
        original_title: tvResult.original_name,
        overview: tvResult.overview || '',
        poster_path: tvResult.poster_path,
        backdrop_path: tvResult.backdrop_path,
        release_date: tvResult.first_air_date || `${imdbItem.year}-01-01`,
        vote_average: imdbItem.rating || tvResult.vote_average || 8.5,
        vote_count: imdbItem.votes || tvResult.vote_count || 1000,
        media_type: 'tv',
        genre_ids: tvResult.genre_ids || [],
        rank: imdbItem.rank,
        imdb_id: imdbItem.id,
        imdb_rating: imdbItem.rating,
      };
    }
  }

  // Fallback to search tv
  const cleanTitle = encodeURIComponent(imdbItem.title.replace(/[^\w\s]/gi, ' '));
  const searchUrl = `https://api.themoviedb.org/3/search/tv?query=${cleanTitle}&first_air_date_year=${imdbItem.year}`;
  const searchData = await fetchWithRetry(searchUrl, {
    headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
  });
  const res0 = searchData?.results?.[0];
  if (res0) {
    return {
      id: res0.id,
      title: res0.name || imdbItem.title,
      original_title: res0.original_name,
      overview: res0.overview || '',
      poster_path: res0.poster_path,
      backdrop_path: res0.backdrop_path,
      release_date: res0.first_air_date || `${imdbItem.year}-01-01`,
      vote_average: imdbItem.rating || res0.vote_average || 8.5,
      vote_count: imdbItem.votes || res0.vote_count || 1000,
      media_type: 'tv',
      genre_ids: res0.genre_ids || [],
      rank: imdbItem.rank,
      imdb_id: imdbItem.id,
      imdb_rating: imdbItem.rating,
    };
  }

  return null;
}

async function resolveTmdbMovie(lbItem) {
  // Search movie with query and primary_release_year
  const cleanTitle = encodeURIComponent(lbItem.title.replace(/[^\w\s]/gi, ' '));
  let searchUrl = `https://api.themoviedb.org/3/search/movie?query=${cleanTitle}&year=${lbItem.year}`;
  let data = await fetchWithRetry(searchUrl, {
    headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
  });

  if (!data?.results?.length) {
    // Retry without year constraint
    searchUrl = `https://api.themoviedb.org/3/search/movie?query=${cleanTitle}`;
    data = await fetchWithRetry(searchUrl, {
      headers: { Authorization: `Bearer ${TMDB_READ_ACCESS_TOKEN}` },
    });
  }

  const res0 = data?.results?.[0];
  if (res0) {
    return {
      id: res0.id,
      title: res0.title || lbItem.title,
      original_title: res0.original_title,
      overview: res0.overview || '',
      poster_path: res0.poster_path,
      backdrop_path: res0.backdrop_path,
      release_date: res0.release_date || `${lbItem.year}-01-01`,
      vote_average: res0.vote_average || 8.0,
      vote_count: res0.vote_count || 1000,
      media_type: 'movie',
      genre_ids: res0.genre_ids || [],
      rank: lbItem.rank,
      letterboxd_slug: lbItem.slug,
      letterboxd_url: lbItem.url,
    };
  }

  return null;
}

async function main() {
  console.log('--- 1. Fetching Letterboxd Top 500 ---');
  const lbResp = await fetchWithRetry('https://letterboxd-top500.mmdju.workers.dev/top500');
  const lbFilms = lbResp?.data || [];
  console.log(`Fetched ${lbFilms.length} Letterboxd raw items.`);

  console.log('--- 2. Fetching IMDb Top TV Shows ---');
  const imdbResp = await fetchWithRetry('https://imdb-top250.mmdju.workers.dev/toptv?limit=200');
  const imdbShows = (imdbResp?.data || []).slice(0, 200);
  console.log(`Fetched ${imdbShows.length} IMDb TV items.`);

  console.log('--- 3. Resolving TMDB metadata for Letterboxd Top 500 (concurrency: 12) ---');
  const resolvedMovies = (await mapConcurrent(lbFilms, 12, async (item, i) => {
    if (i % 50 === 0) console.log(`Processed ${i}/${lbFilms.length} movies...`);
    return await resolveTmdbMovie(item);
  })).filter(Boolean);
  console.log(`Successfully resolved ${resolvedMovies.length}/${lbFilms.length} Letterboxd movies!`);

  console.log('--- 4. Resolving TMDB metadata for IMDb Top 200 TV (concurrency: 10) ---');
  const resolvedSeries = (await mapConcurrent(imdbShows, 10, async (item, i) => {
    if (i % 25 === 0) console.log(`Processed ${i}/${imdbShows.length} TV series...`);
    return await resolveTmdbTv(item);
  })).filter(Boolean);
  console.log(`Successfully resolved ${resolvedSeries.length}/${imdbShows.length} IMDb series!`);

  const outputData = {
    generatedAt: new Date().toISOString(),
    letterboxdTop500: resolvedMovies,
    imdbTop200Series: resolvedSeries,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`Saved curated lists to ${OUTPUT_PATH} (${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
