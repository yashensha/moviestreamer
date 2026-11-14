# Implementation Plan: Movie Card Design System Alignment

## Objective
Unify the movie card visual language across the application by canonicalizing the horizontal compact card design (from `PersonDetailPage`'s "Known For" shelf) into a reusable `CompactMediaCard` component, and integrating it into `CommandMenu` and other surfaces to enforce consistent styling.

---

## Execution Protocol
- **Single Active Task**: Execute ONLY the active marked task `[ ] -> [x]`.
- **Stop and Check-In**: Halt after every task, present verification proof (3 sentences), and wait for user confirmation.
- **Verification Gate**: Every task must pass `npx tsc --noEmit`.

---

## Tasks

- [x] **Task 1: Canonical `CompactMediaCard` Component (`src/components/CompactMediaCard.tsx`)**
  - Extract the horizontal card design from `PersonDetailPage.tsx` into a reusable component.
  - Implement size variants: `size="md"` (standard 14x20 thumbnail) and `size="sm"` (compact 10x14 thumbnail for CMD-K).
  - Add resilient image loading with error fallback and emerald rating badge formatting (`★ 8.4`).
  - *Verification*: `npx tsc --noEmit`.

- [x] **Task 2: Refactor `PersonDetailPage.tsx` to use `CompactMediaCard`**
  - Replace hardcoded card implementation in `careerHighlights` ("Known For") with `CompactMediaCard`.
  - Maintain character role resolution logic (`as {character}` or job title).
  - *Verification*: `npx tsc --noEmit` and visual consistency check.

- [x] **Task 3: Integrate `CompactMediaCard` into `CommandMenu.tsx`**
  - Replace disparate inline movie pills in the celebrity items with `<CompactMediaCard size="sm" />`.
  - Update both live celebrity search results and spotlight creators to use the unified card design.
  - *Verification*: `npx tsc --noEmit` and keyboard/click navigation check.

- [x] **Task 4: Card Design Token Audit Across `MediaCard`, `NetflixTallCard`, & `NetflixBackdropCard`**
  - Verify and align all card primitives to the design system: `rounded-[4px]`, `border-zinc-800`, `text-emerald-400` rating badges, and zero CLS.
  - *Verification*: `npx tsc --noEmit` and `npx oxlint`.
