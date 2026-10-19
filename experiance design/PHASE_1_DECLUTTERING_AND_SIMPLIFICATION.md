# 🧹 Phase 1: Feature De-Cluttering & Codebase Simplification

> **Status:** Specification Complete — Ready for Review & Approval  
> **Rule:** Zero code deletion until base UI component standardization is finalized.

---

## 1. Audit of Unused & Orphaned Files (Targeted for Pruning)

Our architectural audit identified 6 obsolete files that are no longer referenced in `src/App.tsx` or any active user flow:

| File Path | Original Purpose | Replacement / Why It Is Dead | Action |
| :--- | :--- | :--- | :--- |
| `src/components/Navbar.tsx` | Legacy top navigation bar with manual API key input button | Superseded by `NetflixNavbar.tsx` with dynamic scroll, search expansion, and auth avatar. | **Delete file** |
| `src/components/HeroBanner.tsx` | Static single-movie hero banner | Superseded by `NetflixHero.tsx` with billboard auto-advance carousel, transparent PNG logos, and continue-watching integration. | **Delete file** |
| `src/components/MovieCard.tsx` | Minimalist movie poster card | Superseded by `MediaCard.tsx` with hover preview, quick playback badge, and rating pills. | **Delete file** |
| `src/components/VideoPlayerModal.tsx` | Floating popup modal with an iframe embed | Obsolete; streaming has moved entirely to the dedicated theater route (`/movie/:id`, `/tv/:id`) in `InnerDetailPage.tsx`. | **Delete file** |
| `src/components/QuickStreamModal.tsx` | Alternate popup player modal | Redundant duplicate of `VideoPlayerModal.tsx`. | **Delete file** |
| `src/components/ApiKeyModal.tsx` | Modal prompting users for TMDB API key | Obsolete; API key is securely embedded in build config/environment variables. Only imported by the dead `Navbar.tsx`. | **Delete file** |

### Net Code Reduction:
- **~1,200 lines of dead code removed.**
- Eliminates developer confusion regarding which navbar, hero, or card component to import.

---

## 2. Retiring the Raw Developer Math Dashboard in `ProfilePage.tsx`

### The Problem
`ProfilePage.tsx` currently spans **1,487 lines (77KB)**. A substantial portion of this weight comes from the `'matrix'` tab and developer diagnostic views (lines 1205–1457):

```tsx
// Current Debugger Exposed to Viewers:
<div className="text-zinc-500 text-[10px]">// Okapi BM25 Document Length Scaling Formula:</div>
<div className="text-rose-400">
  Scale(L) = (k₁ + 1) / (1 + k₁ · (1 - b + b · (L / L_ref)))
</div>
<div className="text-zinc-400 text-[10px]">
  Active: ({1.2 + 1}) / (1 + 1.2 · (0.25 + 0.75 · ({tasteMatrix.itemCount} / 50))) = 
  <strong>{tasteMatrix.bm25Dampener.toFixed(3)}</strong>
</div>
```

Exposing raw information-retrieval formulas, latent semantic space dimensional stats (`"128-D Latent Semantic Space Active"`), and document length dampener fractions directly to general streaming users:
1. Breaks immersion and makes the product feel like a computer science thesis instead of an entertainment app.
2. Clutters the profile tabs with 6 options (`all`, `watched`, `watchlist`, `liked`, `history`, `matrix`).
3. Dilutes the value of the actual movies and watch history.

### The Refinement Strategy
1. **Decouple Backend Computation from UI Exposure:**
   - Keep `services/interactionMatrix.ts` and `services/subgenreService.ts` completely intact. They are crucial for ranking `TailoredRecommendationsRow.tsx`.
   - Remove the `activeTab === 'matrix'` tab button and its mathematical table views from `ProfilePage.tsx`.
2. **Channel Raw Data into "Taste DNA" (Phase 3):**
   - Instead of showing dampener formulas and point score tables, transform the positive seeds and subgenre weights into an emotional, human summary (e.g. *Your Top Narrative Tropes: #Cyberpunk, #TimeLoop* and *Viewing Archetype: "The Midnight Sci-Fi Voyager"*).

---

## 3. Cleansing Counterfeit & Legacy UI Patterns

### A. The Mock Netflix Support Footer
- **Current state in `App.tsx`:**
  ```html
  Questions? Call 1-800-019-8877
  FAQ | Help Center | Account | Media Center | Terms of Use | Privacy
  ```
- **Refinement:**
  Replace with an authentic, clean MovieWatcher footer:
  - Concise brand statement: *"MovieWatcher — Stream cinematic titles and curate your personal taste profile."*
  - Legitimate utility links: TMDB Attribution, Letterboxd CSV guidelines, GitHub repository, and keyboard shortcuts guide.

### B. Full-Page Neon Letterboxd Overlay
- **Current state:** Dragging a file anywhere on `ProfilePage.tsx` triggers a massive neon-green full-page modal takeover that locks interaction.
- **Refinement:** Replace with an integrated, calm drop-zone card within the Library tab with subtle micro-interaction feedback.

---

## 4. Phase 1 Verification Checklist

- [ ] All 6 dead files removed from `src/components/`.
- [ ] No broken imports in `src/App.tsx`, `src/components/`, or `src/services/`.
- [ ] `ProfilePage.tsx` tab bar reduced from 6 tabs to 3 clean sections:
  - `Continue Watching`
  - `My Library` (Watched, Watchlist, Liked)
  - `Taste DNA` (Phase 3 preview)
- [ ] Math formulas and vector debug blocks completely stripped from consumer views.
- [ ] Application compiles cleanly with `npm run build` and zero dead exports.
