# Implementation Plan: Session-Seeded Graph Recommender

## Objective
Rebuild the core recommendation engine based on sequential media consumption research (Consensus synthesis):
1. Two-Speed Architecture (Long-term profile bent by dynamic session momentum).
2. 2-Hop Entity Graph Traversal (Director/Auteur, Lead Cast, Microgenres, Letterboxd themes/tropes).
3. Netflix-style partitioned rows with explainable attribution badges.

---

## Execution Protocol
- **Single Active Task**: Execute ONLY the active marked task `[ ] -> [x]`.
- **Stop and Check-In**: Halt after every task, present verification proof (3 sentences), and wait for user confirmation.
- **Verification Gate**: Every task must pass `npx tsc --noEmit` and `npx oxlint`.

---

## Tasks

- [x] **Task 1: Session State Tracker (`src/services/tasteEngine/sessionState.ts` & store integration)**
  - Implement $N = 3$ sliding window with exponential decay ($w = [1.0, 0.5, 0.25]$).
  - Implement 4-hour inactivity timeout and session reset logic.
  - Wire watch completion, high ratings, and dwell signals from `useStreamStore`.
  - *Verification*: Unit verification of decay weights, timeout eviction, and `tsc --noEmit`.

- [x] **Task 2: 2-Hop Entity Graph Traversal (`src/services/tasteEngine/graphTraversal.ts`)**
  - Implement Hop 1: Director filmography, Lead Cast hits, and direct trope matches from active seed.
  - Implement Hop 2: Collaborator adjacency and neighboring trope clusters.
  - Integrate hard filtering to strictly eliminate watched, disliked, and $\le 2.5\star$ items.
  - *Verification*: Verification of candidate generation output, deduplication, and `tsc --noEmit`.

- [x] **Task 3: Two-Speed Gated Fusion Matcher (`src/services/tasteEngine/twoSpeedMatcher.ts`)**
  - Implement dynamic $\alpha(\Delta t) = 0.20 + 0.55 \cdot e^{-\Delta t / 2\text{h}}$ fusion formula.
  - Combine session vector similarity with long-term taste profile.
  - Produce calibrated 75%–99% match percentages with explicit human-readable match attributions.
  - *Verification*: Benchmark scoring across sample items and `tsc --noEmit`.

- [x] **Task 4: High-Performance Recommendation Pipeline (`src/services/tasteEngine/pipeline.ts`)**
  - Re-architect `runTasteRecommendationPipeline` to ingest session state and execute 2-hop traversal.
  - Partition candidates into distinct rows: *"Because You Watched [Seed Title]"*, *"Top Picks for You"*, *"Thematic Dive"*, and *"Comfort Classics"*.
  - Export unified types and hooks in `src/services/tasteEngine/index.ts`.
  - *Verification*: Type check and verification in `TailoredRecommendationsRow.tsx`.

- [x] **Task 5: UI Attribution & End-to-End Verification**
  - Update `TailoredRecommendationsRow.tsx` and media cards to display the explainable attribution badges (e.g. *"Directed by [Director]"*, *"Shared Trope"*).
  - Run full test suite: `npx tsc --noEmit` and `npx oxlint`.
  - Final human review.
