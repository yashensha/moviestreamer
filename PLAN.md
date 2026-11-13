# Person / Crew Profile Page & Search Modernization Mockup Plan

## Objective
Unslop and modernize the Search and Person experience into a top-tier cinematic interface:
1. Provide a dedicated, shareable route `/person/:id`.
2. Display rich profile hero (portrait, biography, department, career metrics).
3. Showcase filmography with explicit role display ("what they played in that movie", e.g. character name for actors, job title for directors/crew).
4. Upgrade the Search page layout from a plain forum-style list into a modern, cinematic experience.

---

## Tasks

- [x] **Task 1: Add Person Types & TMDB API Endpoints**
  - Define `PersonDetails` and `PersonCreditItem` in `src/types/movie.ts` (including `character`, `job`, `department`).
  - Implement `fetchPersonDetails` and enhance `fetchPersonCredits` in `src/services/tmdb.ts`.

- [x] **Task 2: Build the Cinematic Person Profile Page (`src/components/PersonDetailPage.tsx`)**
  - Create atmospheric hero with high-res portrait, biography, department badges, and career stats.
  - Add department tabs (All, Acting, Directing/Crew) and sorting (Popularity, Year).
  - Render filmography cards displaying character played (*"as [Character]"*) or crew role (*"[Job]"*).

- [x] **Task 3: Wire `/person/:id` Route & Search Navigation**
  - Register `/person/:id` route in `src/App.tsx`.
  - Connect person cards in `SearchResults.tsx` to navigate to `/person/${person.id}`.

- [x] **Task 4: Modernize Search Results UI (`src/components/SearchResults.tsx`)**
  - Replace plain forum pills with modern glass tabs and live counts.
  - Upgrade Cast & Crew spotlight into modern portrait cards with character/department highlights.
  - Ensure 4px geometry and consistent streaming aesthetic.

- [x] **Task 5: Lint, Typecheck, and Verification**
  - Run `oxlint` and `tsc --noEmit`.
