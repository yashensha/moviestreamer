# Netflix-Style Hierarchical Taste & Unified Match Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely replace legacy recommendation logic with a clean, modular Netflix-style algorithm powered by 4-tier metadata (40% Themes, 30% Microgenres, 20% Keywords, 10% Genres) and a single canonical `% Match` scorer shared identically across all cards and detail pages.

**Architecture:** Build a dedicated `src/services/tasteEngine/` module with distinct units for Genome Resolution, User Taste Profiling, Canonical Match Scoring, and Row Pipeline Harvesting. Integrate the unified match score into `NetflixTallCard`, `NetflixDetailPage`, and `NetflixDetailModal`.

**Tech Stack:** TypeScript, React 19, Vite, TMDB API, Zustand, Local JSON Datasets (`movie_themes.json`, `movie_subgenres.json`, `tv_subgenres.json`).

## Global Constraints
- Themes weight: exactly 0.40 (40%)
- Microgenres / Nanogenres weight: exactly 0.30 (30%)
- Thematic Keywords & Tropes weight: exactly 0.20 (20%)
- Broad Genres weight: exactly 0.10 (10%)
- `% Match` score calculation must be 100% identical between cards and detail pages (single source of truth).
- TypeScript compilation (`npx tsc -b`) must succeed with 0 errors at each task checkpoint.

---

### Task 1: 4-Tier Movie Genome Resolver

**Files:**
- Create: `src/services/tasteEngine/genome.ts`
- Create: `src/services/tasteEngine/types.ts`
- Test: `src/services/tasteEngine/__tests__/genome.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface MovieGenome {
    id: number;
    title: string;
    media_type: 'movie' | 'tv';
    themes: string[];       // Tier 1 (40%)
    microgenres: string[];  // Tier 2 (30%)
    keywords: string[];     // Tier 3 (20%)
    genres: string[];       // Tier 4 (10%)
  }
  export function resolveMovieGenome(id: number, type?: 'movie' | 'tv', itemFallback?: Partial<MediaItem>): Promise<MovieGenome>;
  export function resolveMovieGenomeSync(id: number, type?: 'movie' | 'tv', itemFallback?: Partial<MediaItem>): MovieGenome;
  ```

- [ ] **Step 1: Define types in `src/services/tasteEngine/types.ts`**
  Write definitions for `MovieGenome`, `TasteSignal`, `UserTasteProfile`, `UnifiedMatchResult`, and `RecommendationRowResult`.

- [ ] **Step 2: Implement `src/services/tasteEngine/genome.ts`**
  - Implement dynamic lazy loading for `src/data/movie_themes.json` (Letterboxd themes and nanogenres).
  - Implement fallback to `movie_subgenres.json` and `tv_subgenres.json`.
  - Implement TMDB genre mapping (`GENRE_MAP`).
  - Provide both async `resolveMovieGenome` and synchronous memory-cached `resolveMovieGenomeSync`.

- [ ] **Step 3: Verify genome extraction**
  Run quick node verification script to confirm movies with known themes (e.g. ID `5` Four Rooms) extract themes, nanogenres, and genres.

- [ ] **Step 4: Commit**
  ```powershell
  git add src/services/tasteEngine/types.ts src/services/tasteEngine/genome.ts
  git commit -m "feat(tasteEngine): implement 4-tier movie genome resolver"
  ```

---

### Task 2: User Taste Profile & Interaction Vector

**Files:**
- Create: `src/services/tasteEngine/tasteProfile.ts`

**Interfaces:**
- Consumes: `MovieGenome` from `src/services/tasteEngine/genome.ts`
- Produces:
  ```typescript
  export interface UserTasteProfile {
    totalInteractions: number;
    positiveSeeds: MovieGenome[];
    excludedIds: Set<number>;
    dislikedDirectorNames: Set<string>;
    themeWeights: Map<string, number>;
    microgenreWeights: Map<string, number>;
    keywordWeights: Map<string, number>;
    genreWeights: Map<number, number>;
    temporalDecayFactors: Map<number, number>;
    bm25Dampener: number;
  }
  export function buildUserTasteProfile(
    watchHistory: WatchHistoryItem[],
    likedMedia: MediaItem[],
    userRatings: UserRatingItem[],
    dislikedMedia: MediaItem[],
    watchlist: MediaItem[]
  ): UserTasteProfile;
  ```

- [ ] **Step 1: Implement Interaction Signal weights**
  - Letterboxd 5★ or Heart: 5.0
  - Letterboxd 4.0–4.5★: 4.0
  - Stream Completed (>85% watched): 3.5
  - Letterboxd 3.0–3.5★: 2.5
  - Dwell stream (>10m): 2.0
  - Watchlist: 1.5
  - Rating <= 2★ or Dislike: Hard Negative Exclusion

- [ ] **Step 2: Implement BM25 Dampener & Temporal Decay**
  - Exponential decay based on `interactedAt` timestamp (45-day half-life, 0.4 baseline floor).
  - Library-size dampener: $(k_1 + 1) / (1 + k_1 \cdot (1 - b + b \cdot (L / L_{\text{ref}})))$.

- [ ] **Step 3: Build 4-Tier Weight Maps**
  Populate `themeWeights`, `microgenreWeights`, `keywordWeights`, and `genreWeights` normalized to unit length.

- [ ] **Step 4: Commit**
  ```powershell
  git add src/services/tasteEngine/tasteProfile.ts
  git commit -m "feat(tasteEngine): implement user taste profiling and interaction vectors"
  ```

---

### Task 3: Canonical Unified Match Scorer (Single Source of Truth)

**Files:**
- Create: `src/services/tasteEngine/matchScorer.ts`

**Interfaces:**
- Consumes: `MovieGenome`, `UserTasteProfile`
- Produces:
  ```typescript
  export interface UnifiedMatchResult {
    percentage: number; // integer 75..99
    label: string;      // "${percentage}% Match"
    isPersonalized: boolean;
  }
  export function calculateUnifiedMatchScore(
    item: MediaItem,
    profile?: UserTasteProfile | null
  ): UnifiedMatchResult;
  ```

- [ ] **Step 1: Implement Multi-Tier Cosine Affinity**
  ```typescript
  // 40% Themes + 30% Microgenres + 20% Keywords + 10% Genres
  const affinity =
    0.40 * themeScore +
    0.30 * microgenreScore +
    0.20 * keywordScore +
    0.10 * genreScore;
  ```

- [ ] **Step 2: Calibrate Netflix-Style Percentage Scaling**
  - If affinity $\ge 0.70$: map to 95%–99% Match.
  - If affinity $0.40 \dots 0.69$: map to 88%–94% Match.
  - If affinity $0.15 \dots 0.39$: map to 80%–87% Match.
  - If cold start: calculate Bayesian rating match:
    $85 + (\text{vote\_average} - 6.5) \cdot 3.0$, clamped to 75%–95%.

- [ ] **Step 3: Commit**
  ```powershell
  git add src/services/tasteEngine/matchScorer.ts
  git commit -m "feat(tasteEngine): implement canonical unified match scorer"
  ```

---

### Task 4: Candidate Harvesting & Row Synthesis Pipeline

**Files:**
- Create: `src/services/tasteEngine/pipeline.ts`
- Create: `src/services/tasteEngine/index.ts` (export barrel)

**Interfaces:**
- Produces:
  ```typescript
  export interface TasteEngineRows {
    topPicks: MediaItem[];
    becauseYouWatched?: {
      seedTitle: string;
      items: MediaItem[];
    };
    thematicRows: Array<{
      title: string;
      themeOrGenre: string;
      items: MediaItem[];
    }>;
  }
  export function runTasteRecommendationPipeline(
    profile: UserTasteProfile,
    options?: { preferredType?: 'movie' | 'tv' }
  ): Promise<TasteEngineRows>;
  ```

- [ ] **Step 1: Multi-Seed TMDB Graph Fetching**
  Query TMDB recommendations and genre/theme discover endpoints for the user's top positive seeds.

- [ ] **Step 2: Negative Filtering & Candidate Deduplication**
  Exclude all items in `profile.excludedIds` and titles featuring `profile.dislikedDirectorNames`.

- [ ] **Step 3: Rank Candidates via `calculateUnifiedMatchScore`**
  Rank pool by unified match percentage and synthesize "Top Picks" and "Because You Watched" rows.

- [ ] **Step 4: Export clean public API in `src/services/tasteEngine/index.ts`**

- [ ] **Step 5: Commit**
  ```powershell
  git add src/services/tasteEngine/pipeline.ts src/services/tasteEngine/index.ts
  git commit -m "feat(tasteEngine): implement candidate harvesting and row synthesis"
  ```

---

### Task 5: Component Unification & % Match Parity

**Files:**
- Modify: `src/components/NetflixTallCard.tsx`
- Modify: `src/components/NetflixDetailPage.tsx`
- Modify: `src/components/NetflixDetailModal.tsx`
- Modify: `src/components/TailoredRecommendationsRow.tsx`

- [ ] **Step 1: Connect `NetflixTallCard.tsx` to `calculateUnifiedMatchScore`**
  Replace ad-hoc `raw = item.vote_average * 10 + 6` with `calculateUnifiedMatchScore(item, activeTasteProfile)`.

- [ ] **Step 2: Connect `NetflixDetailPage.tsx` to `calculateUnifiedMatchScore`**
  Replace `matchPercentage = Math.round(voteAvg * 10)` with `calculateUnifiedMatchScore(details || media, activeTasteProfile).percentage`.

- [ ] **Step 3: Connect `NetflixDetailModal.tsx` to `calculateUnifiedMatchScore`**
  Replace `matchPercentage = Math.round(voteAvg * 10)` with `calculateUnifiedMatchScore(details || media, activeTasteProfile).percentage`.

- [ ] **Step 4: Connect `TailoredRecommendationsRow.tsx` to the new `tasteEngine`**
  Use `runTasteRecommendationPipeline` and `buildUserTasteProfile`.

- [ ] **Step 5: Commit**
  ```powershell
  git add src/components/NetflixTallCard.tsx src/components/NetflixDetailPage.tsx src/components/NetflixDetailModal.tsx src/components/TailoredRecommendationsRow.tsx
  git commit -m "feat(ui): unify % match calculation across cards, modal and detail page"
  ```

---

### Task 6: TypeScript Validation & Parity Verification

**Files:**
- Test / Verify all touched components

- [ ] **Step 1: Run `npx tsc -b`**
  Verify 0 TypeScript compilation errors.

- [ ] **Step 2: Verify match percentage parity**
  Ensure identical values are returned for the same title in card view vs detail view.

- [ ] **Step 3: Commit and finalize**
  ```powershell
  git commit -am "chore: complete taste engine overhaul and % match unification"
  ```
