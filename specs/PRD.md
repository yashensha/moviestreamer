# Product Requirements Document (PRD): Session-Seeded Graph Recommender

## 1. Executive Summary & Problem Statement
The current recommendation engine treats a viewer's historical engagement as an unweighted, static aggregate of genres and tags. This static design fails to capture:
1. **The Rabbit Hole Effect (Woolley & Sharif, 2021):** Watching and enjoying a film elevates the immediate cognitive accessibility of closely adjacent titles (same director, shared cast, exact thematic tropes).
2. **Session Intent & Sequential Momentum (Oh et al., 2024; Kim et al., 2021):** Next-item selection is an evolving state transition, not an independent draw from a historical bag of tags.
3. **Dual Psychological Drivers (Immersion vs. Fatigue):** Early/mid-session calls for deep-cut rabbit holes (mood maintenance), whereas extended sessions call for low-friction comfort reconsumption (Shackleford et al., 2025).

The goal is to replace the static recommender with a **Session-Seeded Graph Traversal Recommender** using a **Two-Speed Architecture** (Long-Term Taste Profile bent by an Active Session Vector) and **2-Hop Entity Graph Traversal**.

---

## 2. Customer Zero & 5-Second "Time to Aha"
* **Customer Zero:** A film lover who finishes an intense movie (e.g., Denis Villeneuve's *Arrival*) and navigates back to browse.
* **5-Second "Time to Aha":** The top row instantly morphs to feature titles directly connected to the film just watched—curating Villeneuve's filmography, films starring Amy Adams, and adjacent high-concept sci-fi thrillers—with clear badges explaining *why* each title was selected.

---

## 3. MVP Scope vs. Anti-Goals

### Core MVP Features
1. **Active Session State Tracker (`src/services/tasteEngine/sessionState.ts`):**
   - Sliding window of the last $N = 3$ interactions ($w_0 = 1.0, w_1 = 0.5, w_2 = 0.25$).
   - 4-hour inactivity timeout to cleanly expire the session back to baseline.
   - Signal ingestion: stream completion (1.0), high star rating (0.9), mid-stream (0.7), modal dwell (0.35), dislike/low rating (negative filter).
2. **2-Hop Entity Graph Traversal (`src/services/tasteEngine/graphTraversal.ts`):**
   - **Hop 1 (Core Rabbit Hole):** Director filmography, Lead Cast hits, exact Letterboxd themes/nanogenres.
   - **Hop 2 (Filter Bubble Breakers):** Frequent collaborators and topologically adjacent trope clusters.
3. **Two-Speed Gated Fusion Scorer (`src/services/tasteEngine/twoSpeedMatcher.ts`):**
   - $\text{FinalScore} = \alpha \cdot \text{Score}_{\text{session}} + (1 - \alpha) \cdot \text{Score}_{\text{base}}$.
   - Adaptive $\alpha \in [0.20, 0.75]$ decaying over time.
   - Calibrated 75%–99% match score with explicit attribution badges.
4. **Netflix-Style Browse Row Partitioning (`src/services/tasteEngine/pipeline.ts`):**
   - *"Because You Watched [Seed Title]"* (Tight Hop 1).
   - *"Top Picks for You"* ($\alpha$-fused balance).
   - *"Deep Dive: [Thematic Cluster]"* (e.g., Neo-Noir & Atmospheric Thrillers).
   - *"Classics & Comfort Picks"* (High-certainty fatigue mitigators).

### Anti-Goals (What Deliberately NOT to Build)
- **No Manual Mood Toggles:** Research proves intent should be implicitly inferred from sequential actions, not manual buttons.
- **No Heavy Neural / Cloud Vector Databases:** No Pinecone, Milvus, or Python microservices. Must run deterministically client-side in sub-100ms.
- **No Global Collaborative Matrix Factorization:** Recommendations remain strictly content-graph grounded and personalized to the active user.

---

## 4. Architectural Specifications & Formulas

### A. Session Decay
Given session items $[s_0, s_1, s_2]$:
$$w_k = 0.5^k \quad \text{for } k \in \{0, 1, 2\}$$
If $\Delta t = (t_{\text{now}} - t_{\text{last}}) > 4 \text{ hours}$, $S = \emptyset$.

### B. Two-Speed Fusion
$$\text{FinalScore}(c) = \alpha \cdot \text{Score}_{\text{session}}(c, S) + (1 - \alpha) \cdot \text{Score}_{\text{base}}(c, P_{\text{long}})$$
$$\alpha(\Delta t) = 0.20 + 0.55 \cdot e^{-\Delta t / 2\text{h}}$$

### C. Match Attribution
Every scored recommendation returns:
- `matchScore`: number (75–99)
- `attributionReason`: string (e.g., *"Directed by Christopher Nolan"*, *"Shared Theme: Heist & Suspense"*)
- `hopLevel`: 1 | 2

---

## 5. Decision Log
1. **Session Window ($N=3$):** Captures multi-item trajectory without accumulating stale bias.
2. **2-Hop Maximum:** Balances rabbit-hole immersion with serendipity while maintaining sub-100ms compute.
3. **Client-Side Nearest-Neighbor & Graph Traversal:** Supported by Latifi et al. (2021) showing non-neural methods outperform complex neural pipelines in session recommendation.

