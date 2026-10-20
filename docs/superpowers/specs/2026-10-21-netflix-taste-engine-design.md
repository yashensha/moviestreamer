# Netflix-Style Hierarchical Taste & Unified Match Engine Design

## 1. Overview & Objective
This specification defines the new, ground-up architecture for the MovieWatcher Recommendation and Taste Engine. It completely replaces the previous ad-hoc pipeline with a clean, modular, Netflix-inspired algorithm that leverages the newly extracted Letterboxd themes and microgenres alongside TMDB keywords and genres.

Crucially, it establishes a **Single Canonical Source of Truth** for the `% Match` score, ensuring complete consistency across `NetflixTallCard`, `NetflixDetailPage`, and `NetflixDetailModal`.

---

## 2. The 4-Tier Movie Genome

Every movie or TV series is classified across four distinct tiers of granularity:

| Tier | Granularity | Weight | Source | Examples |
|---|---|---|---|---|
| **Tier 1: Themes** | Deepest Signal | **40%** | Letterboxd Themes | "Dreamlike, Quirky, And Surreal Storytelling", "Moral Corruption & Law Enforcement" |
| **Tier 2: Microgenres** | Stylistic Texture | **30%** | Letterboxd Nanogenres & Curated Subgenres | "Neo-Noir, Cyberpunk, Dystopia", "Slapstick, Parody, Riot" |
| **Tier 3: Keywords** | Specific Plot Tropes | **20%** | TMDB & MovieLens Tags | "time travel", "artificial intelligence", "heist", "revenge" |
| **Tier 4: Broad Genres** | Coarse Filtering | **10%** | TMDB Genres | Action (28), Drama (18), Sci-Fi (878), Comedy (35) |

### Genome Data Resolution (`src/services/tasteEngine/genome.ts`)
1. **Letterboxd Themes Dataset (`src/data/movie_themes.json`)**:
   Provides pre-scraped Letterboxd themes, nanogenres, and genres by TMDB ID.
2. **MovieLens & Curated Subgenres (`src/data/movie_subgenres.json` & `tv_subgenres.json`)**:
   Provides crowd-sourced nanogenres and tags for movies and TV series.
3. **TMDB Fallback**:
   For fresh or obscure titles not yet in local datasets, the system extracts TMDB keywords and classifies them into themes and microgenres dynamically.

---

## 3. Unified Match Scorer (Single Source of Truth)

### File: `src/services/tasteEngine/matchScorer.ts`

```typescript
export function calculateUnifiedMatchScore(
  item: MediaItem,
  tasteProfile?: UserTasteProfile | null
): {
  percentage: number;      // e.g. 96
  label: string;           // "96% Match"
  breakdown?: {
    themeAffinity: number;
    microgenreAffinity: number;
    keywordAffinity: number;
    genreAffinity: number;
  };
}
```

### Formula & Scaling
1. **Personalized Match Calculation** (when user has watch history, ratings, or likes):
   - Computes weighted cosine affinity across the 4 tiers:
     $$\text{RawAffinity} = 0.40 \cdot S_{\text{theme}} + 0.30 \cdot S_{\text{microgenre}} + 0.20 \cdot S_{\text{keyword}} + 0.10 \cdot S_{\text{genre}}$$
   - Maps affinity score ($0.0 \dots 1.0$) to the realistic Netflix percentage scale:
     - High affinity ($\ge 0.70$): **95% – 99%**
     - Moderate affinity ($0.40 \dots 0.69$): **88% – 94%**
     - Low affinity ($0.15 \dots 0.39$): **80% – 87%**
     - Baseline floor: **75%**
2. **Cold-Start Calculation** (when user has zero history):
   - Derives a consistent Bayesian quality score from TMDB `vote_average` and `vote_count`:
     $$\text{ColdStart} = \text{clamp}\left(85 + (\text{vote\_average} - 6.5) \cdot 3.5, 75, 95\right)$$
3. **Component Unification**:
   - `NetflixTallCard.tsx`: Calls `calculateUnifiedMatchScore(item, tasteProfile)`.
   - `NetflixDetailPage.tsx`: Calls `calculateUnifiedMatchScore(details || media, tasteProfile)`.
   - `NetflixDetailModal.tsx`: Calls `calculateUnifiedMatchScore(details || media, tasteProfile)`.
   - **Result**: Exactly the same percentage is shown everywhere for any given title.

---

## 4. User Taste Vector & Interaction Matrix

### File: `src/services/tasteEngine/tasteProfile.ts`

1. **Signals & Implicit/Explicit Feedback**:
   - Letterboxd 5★ or In-App Heart: **5.0**
   - Letterboxd 4.0–4.5★: **4.0**
   - Stream Completed (>85% watched): **3.5**
   - Letterboxd 3.0–3.5★: **2.5**
   - Started Streaming (>10m dwell): **2.0**
   - Saved to Watchlist: **1.5**
   - Explicit Dislike or Rating $\le 2$★: **Hard Negative Exclusion** (blacklisted from recommendations, penalizes directors).
2. **BM25 Dampening**:
   Prevents high-volume interaction accounts from saturating popular broad genres.
3. **Temporal Decay**:
   Applies exponential half-life decay (45 days) so recently watched genres and themes rank higher while timeless favorites retain a 0.4 floor.

---

## 5. Candidate Generation & Graph Expansion

### File: `src/services/tasteEngine/pipeline.ts`

1. **Step 1: Multi-Seed Graph Harvesting**:
   - Selects top 8 positive seed titles from the user's taste profile.
   - Concurrently fetches:
     - Direct TMDB recommendations from seeds.
     - Director filmographies for auteur directors.
     - Thematic & microgenre query matches using TMDB Discover.
2. **Step 2: Negative Filtering**:
   - Excludes watched, rated, watchlist, and disliked titles.
   - Filters out candidates featuring disliked directors.
3. **Step 3: Scoring & Re-ranking**:
   - Calculates `UnifiedMatchScore` for every candidate in the pool.
   - Adds temporal freshness and diversity penalty to prevent recommending 5 movies from the same franchise.
4. **Step 4: Categorized Row Synthesis**:
   - **Top Picks For You**: Highest hybrid match scores overall.
   - **Because You Watched [Title]**: High thematic match with the user's most recent top favorite.
   - **Thematic Deep-Dives**: Rows centered around the user's top microgenre or theme (e.g. "Mind-Bending Time Loops", "Stylized Neo-Noir").

---

## 6. Architecture & File Structure

```
src/services/tasteEngine/
├── index.ts              # Public API export
├── genome.ts             # 4-tier metadata resolver (Themes, Microgenres, Keywords, Genres)
├── matchScorer.ts        # Canonical Single Source of Truth for % Match
├── tasteProfile.ts       # Unified user interaction matrix, BM25 weights, negative exclusions
└── pipeline.ts           # Candidate generation, graph retrieval, re-ranking into rows
```

Components consuming `tasteEngine`:
- `src/components/NetflixTallCard.tsx`
- `src/components/NetflixDetailPage.tsx`
- `src/components/NetflixDetailModal.tsx`
- `src/components/TailoredRecommendationsRow.tsx`
- `src/components/ProfilePage.tsx`
