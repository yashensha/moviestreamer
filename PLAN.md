# Orama Instant Search Integration Plan

## Objective
Implement an in-memory, ultra-fast (<2ms), typo-tolerant search engine using Orama that searches movies, TV shows, genres, and themes with graceful fallback to TMDB for unindexed items.

---

## Tasks

- [x] **Task 1: Install Orama dependencies**
  - Install `@orama/orama` package.
  - Verify package installation and lockfile integrity.

- [x] **Task 2: Build Orama search service (`src/services/oramaSearch.ts`)**
  - Define Orama database schema (id, title, original_title, overview, genres, themes, nanogenres, media_type, poster_path, vote_average, popularity).
  - Implement asynchronous lazy initialization and index caching (IndexedDB/in-memory).
  - Seed index using curated lists, popular titles, and rich theme data.
  - Export fast search function supporting typo tolerance, exact matching, and theme filters.

- [x] **Task 3: Integrate Orama with search pipeline & TMDB fallback**
  - Update `multiSearchWithTMDB` in `src/services/tmdb.ts` (or unify search service) to query Orama first.
  - Return instant Orama hits when available (>= 4 matches).
  - Transparently fall back to TMDB API if query yields insufficient local matches.

- [x] **Task 4: Typecheck, Lint, and End-to-End Verification**
  - Run `oxlint` and `tsc --noEmit`.
  - Validate search responsiveness and typo handling.
