const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LINKS_PATH = path.join(__dirname, '..', 'training', 'links.csv');
const MOVIES_PATH = path.join(__dirname, '..', 'training', 'movies.csv');
const TAGS_PATH = path.join(__dirname, '..', 'training', 'tags.csv');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'movie_subgenres.json');
const TAXONOMY_FILE = path.join(OUTPUT_DIR, 'subgenre_taxonomy.json');

// Blacklist of noisy / subjective / non-thematic tags
const STOP_TAGS = new Set([
  'seen', 'watched', 'dvd', 'bluray', 'blu-ray', 'own', 'owned', 'netflix', 'amazon',
  'favorite', 'favourites', 'favorites', 'good', 'bad', 'great', 'boring', 'classic',
  'cinematography', 'nudity', 'r', 'pg-13', 'pg', 'movielens', 'imdb', 'criterion',
  'in collection', 'queue', 'library', 'top 10', 'overrated', 'underrated', 'recommend',
  'bought', 'to watch', 'seen more than once', 'seen in 2018', 'seen in 2019', 'seen in 2020',
  'seen in 2021', 'seen in 2022', 'seen in 2023', 'seen in 2024', 'seen in theaters', 'seen at cinema'
]);

async function run() {
  console.log('🚀 Starting MovieLens to TMDB Subgenre Processor...');

  // 1. Read links.csv: movieId -> tmdbId
  console.log('📂 Step 1: Mapping movieId -> tmdbId from links.csv...');
  const movieToTmdb = new Map();
  const tmdbToMovie = new Map();

  const linksRl = readline.createInterface({
    input: fs.createReadStream(LINKS_PATH),
    crlfDelay: Infinity,
  });

  let linksCount = 0;
  for await (const line of linksRl) {
    if (linksCount++ === 0) continue; // skip header
    const parts = line.split(',');
    if (parts.length >= 3) {
      const movieId = parseInt(parts[0], 10);
      const tmdbId = parseInt(parts[2], 10);
      if (!isNaN(movieId) && !isNaN(tmdbId) && tmdbId > 0) {
        movieToTmdb.set(movieId, tmdbId);
        tmdbToMovie.set(tmdbId, movieId);
      }
    }
  }
  console.log(`✅ Loaded ${movieToTmdb.size.toLocaleString()} movieId -> tmdbId mappings.`);

  // 2. Read movies.csv: movieId -> genres
  console.log('📂 Step 2: Reading titles and base genres from movies.csv...');
  const movieGenres = new Map();
  const moviesRl = readline.createInterface({
    input: fs.createReadStream(MOVIES_PATH),
    crlfDelay: Infinity,
  });

  let moviesCount = 0;
  for await (const line of moviesRl) {
    if (moviesCount++ === 0) continue; // skip header
    const match = line.match(/^(\d+),(".*?"|[^,]+),(.*)$/);
    if (match) {
      const movieId = parseInt(match[1], 10);
      const rawGenres = match[3] || '';
      const genresList = rawGenres.split('|').filter((g) => g && g !== '(no genres listed)');
      movieGenres.set(movieId, genresList);
    }
  }
  console.log(`✅ Loaded genres for ${movieGenres.size.toLocaleString()} movies.`);

  // 3. Stream tags.csv: count frequencies of clean tags per movieId
  console.log('📂 Step 3: Streaming 2,000,000+ tags from tags.csv...');
  const movieTagCounts = new Map(); // movieId -> Map<tag, count>
  const globalTagFrequency = new Map(); // tag -> total occurrences across all movies

  const tagsRl = readline.createInterface({
    input: fs.createReadStream(TAGS_PATH),
    crlfDelay: Infinity,
  });

  let totalTagRows = 0;
  for await (const line of tagsRl) {
    if (totalTagRows++ === 0) continue; // skip header

    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;
    const secondComma = line.indexOf(',', firstComma + 1);
    if (secondComma === -1) continue;
    const lastComma = line.lastIndexOf(',');
    if (lastComma <= secondComma) continue;

    const movieIdStr = line.substring(firstComma + 1, secondComma);
    const movieId = parseInt(movieIdStr, 10);
    if (isNaN(movieId) || !movieToTmdb.has(movieId)) continue;

    let tag = line.substring(secondComma + 1, lastComma).trim().toLowerCase();
    if (tag.startsWith('"') && tag.endsWith('"')) {
      tag = tag.substring(1, tag.length - 1).trim();
    }

    if (!tag || tag.length < 3 || tag.length > 35) continue;
    if (STOP_TAGS.has(tag)) continue;
    if (/^\d{4}$/.test(tag) || /^\d+$/.test(tag)) continue;

    let tagMap = movieTagCounts.get(movieId);
    if (!tagMap) {
      tagMap = new Map();
      movieTagCounts.set(movieId, tagMap);
    }
    tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    globalTagFrequency.set(tag, (globalTagFrequency.get(tag) || 0) + 1);

    if (totalTagRows % 500000 === 0) {
      console.log(`   Processed ${totalTagRows.toLocaleString()} rows...`);
    }
  }
  console.log(`✅ Processed all ${totalTagRows.toLocaleString()} tags across ${movieTagCounts.size.toLocaleString()} movies.`);

  // 4. Construct compact TMDB Subgenres index
  console.log('📂 Step 4: Condensing into compact TMDB Subgenre dictionary...');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Key: tmdbId -> Array of top subgenre tags
  const tmdbSubgenres = {};
  let totalIndexedMovies = 0;

  for (const [movieId, tagMap] of movieTagCounts.entries()) {
    const tmdbId = movieToTmdb.get(movieId);
    if (!tmdbId) continue;

    // Sort tags by frequency (descending)
    const sortedTags = Array.from(tagMap.entries())
      .filter(([tag]) => {
        return (globalTagFrequency.get(tag) || 0) >= 2;
      })
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 6); // keep top 6 highest-confidence subgenre tags

    if (sortedTags.length > 0) {
      tmdbSubgenres[tmdbId] = sortedTags;
      totalIndexedMovies++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tmdbSubgenres));
  const fileSizeMb = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`💾 Saved ${totalIndexedMovies.toLocaleString()} movies to ${OUTPUT_FILE} (${fileSizeMb} MB).`);

  // 5. Construct Canonical Universal Subgenre Taxonomy
  console.log('📂 Step 5: Generating Universal Subgenre Taxonomy for Movies & Series...');
  const topThematicTags = Array.from(globalTagFrequency.entries())
    .filter(([tag, count]) => {
      if (STOP_TAGS.has(tag)) return false;
      return count >= 12;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
    .map(([tag, count]) => ({ tag, count }));

  // Master subgenre clusters
  const clusters = {
    'Cyberpunk & Tech Dystopia': ['cyberpunk', 'artificial intelligence', 'ai', 'virtual reality', 'dystopia', 'dystopian', 'hacker', 'android', 'cyborg', 'futuristic', 'transhumanism'],
    'Psychological & Mind-Bending': ['mindfuck', 'mind-bending', 'psychological', 'psychological thriller', 'unreliable narrator', 'paranoia', 'memory loss', 'dream', 'hallucinations', 'multiple personalities'],
    'Time & Dimensional Sci-Fi': ['time travel', 'alternate reality', 'parallel universe', 'multiverse', 'time loop', 'wormhole', 'space travel', 'space opera', 'alien', 'aliens'],
    'Neo-Noir & Crime Underworld': ['neo-noir', 'noir', 'investigation', 'detective', 'murder mystery', 'whodunit', 'corrupt cop', 'gangster', 'mob', 'organized crime', 'heist'],
    'Dark Satire & Absurdist': ['dark comedy', 'black comedy', 'satire', 'satirical', 'cynical', 'absurd', 'ironic', 'parody'],
    'Survival & High Tension': ['survival', 'claustrophobic', 'post-apocalyptic', 'isolation', 'kidnapping', 'hostage', 'suspense', 'revenge', 'cat and mouse'],
    'Spooky & Supernatural Horror': ['supernatural', 'haunted house', 'demon', 'ghost', 'cult', 'folk horror', 'slasher', 'creature feature', 'monster', 'zombie', 'zombies', 'body horror'],
    'Coming of Age & Intimate Drama': ['coming of age', 'adolescence', 'high school', 'friendship', 'bittersweet', 'philosophical', 'existential', 'melancholy', 'heartwarming']
  };

  const taxonomyData = {
    generatedAt: new Date().toISOString(),
    totalCanonicalTags: topThematicTags.length,
    clusters,
    topThematicTags: topThematicTags.slice(0, 150),
  };

  fs.writeFileSync(TAXONOMY_FILE, JSON.stringify(taxonomyData, null, 2));
  console.log(`💾 Saved Canonical Subgenre Taxonomy to ${TAXONOMY_FILE}`);
  console.log('🎉 Subgenre processing successfully complete!');
}

run().catch((err) => {
  console.error('❌ Processing failed:', err);
  process.exit(1);
});
