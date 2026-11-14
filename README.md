# MovieWatcher 🎬

> **An honest, cinephile-first media discovery & streaming platform.**  
> Powered by community consensus from **Letterboxd**, deep metadata from **TMDB**, sub-millisecond in-memory search with **Orama**, and an open, pluggable streaming architecture deployed on **Cloudflare**.

---

## 💡 The Problem: The Algorithmic Bias of Modern Streaming

Major streaming platforms (like Netflix, Amazon Prime, and Disney+) optimize their recommendation engines for **corporate retention and profit margins**, not pure artistic taste:

* **Walled-Garden Promotion:** Algorithms disproportionately push in-house original productions—regardless of critical quality—simply to amortize their own production budgets.
* **Algorithmic Homogenization:** Viewers are trapped in repetitive "feedback loops" that promote generic blockbusters while burying cinematic masterpieces, international cinema, and critically acclaimed gems.
* **Opaque Ratings & Locked Catalogs:** True user consensus is obscured behind thumbs-up metrics and proprietary match percentages designed to drive view-counts rather than viewer satisfaction.

---

## 🎯 The Solution: Community-Curated Taste & Open Discovery

**MovieWatcher** fundamentally rethinks media exploration by putting artistic merit and viewer autonomy first:

1. **Unbiased Community Curation:** Directly aggregates data from **Letterboxd** (the world's premier cinephile community) and **TMDB**, giving you access to real human reviews, themes, and curated rankings.
2. **Zero Cold-Start Personalization via Letterboxd CSV:** You don't start from scratch. Upload your exported `ratings.csv` or `watchlist.csv` to instantly calibrate recommendations to your lifetime movie taste.
3. **Thematic Vibe & Nanogenre Matching:** Replaces blunt genre labels (*"Action"*, *"Comedy"*) with rich, nuanced cinematic DNA (*"Mind-Bending Dream Heist"*, *"Slow-Burn Gothic Noir"*, *"Neon Cyberpunk Dystopia"*).
4. **Pluggable Player Architecture:** Decouples content discovery from closed distribution networks. Users can connect any stream source or embed provider of their choice (such as Vidbolt or self-hosted media servers).

---

## 👤 Discovery Grounding: Built with Real Cinephiles

Through structured interviews with film enthusiasts and heavy streaming viewers, we identified four core frustrations that direct our product roadmap:

> *"I'm tired of Netflix recommending 5 mediocre originals in a row just because they made them. Show me what film lovers on Letterboxd and IMDb actually consider the greatest of all time—and let me bring my Letterboxd ratings so the algorithm immediately knows what I love."*  
> — **Direct Cinephile User Interview**

### Key Needs Identified:
* **Letterboxd Ratings & Watchlist Portability:** Ability to import personal Letterboxd CSV exports (`ratings.csv`, `watchlist.csv`) to instantly generate customized recommendations and a playable streaming queue without manual data entry.
* **Letterboxd Top 500 & IMDb Top 200 Hubs:** Instant access to community-ranked best pictures and top-rated television series without platform bias.
* **Director & Actor Centric Discovery:** The ability to search a creator (e.g., *Christopher Nolan*, *Denis Villeneuve*, *Bong Joon-ho*, *Anya Taylor-Joy*) and explore their complete chronological filmography across cast and crew credits.
* **Instant, Typo-Tolerant Search:** Search that understands misspellings (*"intrestelar"* $\rightarrow$ *Interstellar*) and thematic vibes (*"rainy vampire mystery"*), returning results in milliseconds.

---

## 🌟 Key Features

### 1. 📥 Instant Letterboxd CSV Import (Zero Cold-Start Personalization)
* **Drag-and-Drop Portability:** Bring your entire film history with you. Simply export your data from Letterboxd and drop in your `.csv` files:
  * **`ratings.csv` / `watched.csv`**: Ingests hundreds or thousands of your personal ratings. Instantly trains the **Taste DNA Engine**—5★ ratings become heavy affinity seeds, while 1★–2★ ratings act as negative hard-filters that purge disliked tropes from your recommendations.
  * **`watchlist.csv`**: Converts your stagnant Letterboxd queue into an interactive, playable streaming hub complete with posters, backdrops, and progress tracking.
* **Intelligent Title Resolution:** Automatically maps Letterboxd slugs, titles, and release years to verified TMDB IDs with automated batching and fuzzy reconciliation.
* **Persistent Edge Sync:** Persists your imported ratings and watchlist to **Cloudflare D1**, seamlessly syncing across your devices.

### 2. 🏆 Letterboxd Top 500 & IMDb Top 200 Catalogs
* **Curated Top-Rated Hub:** Dedicated views for the **Letterboxd Top 500 Greatest Films of All Time** and **IMDb Top 200 Television Series**.
* **Prestige Badges:** Instant visual indicators showing rank standing, IMDb scores, and Letterboxd accolades on hover cards and detail views.

### 3. ⚡ In-Memory Instant & Typo-Tolerant Search (Powered by Orama)
* **Sub-2ms Keystroke Evaluation:** Uses [@orama/orama](https://github.com/oramasearch/orama) running directly in-memory with zero server bottlenecks.
* **Fuzzy Levenshtein Typo Tolerance:** Automatically resolves misspellings without returning dead-end empty states (*"intrestelar"* $\rightarrow$ *Interstellar*).
* **Thematic & Vibe Retrieval:** Querying atmospheric descriptors like *"cyberpunk"*, *"space exploration"*, or *"vampire"* surfaces relevant titles based on curated tag metadata.
* **Seamless TMDB Fallback:** Long-tail or obscure queries transparently fall back to TMDB's global multi-search.

### 4. 🎬 Creator & Filmography Exploration
* **Entity-Aware Multi-Search:** Searches across Movies, TV Series, Directors, and Actors simultaneously.
* **Dedicated Person Filmography:** Clicking any cast or crew member opens their complete, chronological portfolio of works, allowing deep director-led marathons.

### 5. 🧬 Research-Grounded Two-Speed Recommendation Engine
* **Two-Speed Dynamic Fusion:** Combines an all-time cinephile profile with an exponential-decay session vector ($N=3$) that instantly bends recommendations toward the title just watched.
* **2-Hop Entity Graph Traversal:** Discovers adjacent titles through Director/Auteur filmographies, Lead Cast collaborations, and 56,000+ Letterboxd narrative themes and nanogenres.
* **Explainable Attribution Badges:** Every recommendation features an explicit reason (*"Directed by Denis Villeneuve"*, *"Shared Theme: Mind-Bending Sci-Fi"*, *"Starring Cillian Murphy"*).
* **Smart Negative Filtering:** Strict hard-filtering eliminates titles rated $\le 2.5\star$ or disliked, ensuring disliked tropes never pollute your rows.

### 6. 📺 Immersive Netflix-Grade Theater Experience
* **Cinematic Billboard & Carousels:** High-contrast `#141414` canvas, responsive hero banners with clean logos, and smooth horizontal rails.
* **Episode Hub & Auto-Resume:** Tracks your active season/episode progression and automatically loads your last streamed timestamp.

---

## 🧠 The Recommendation Engine: Research Foundations & Architecture

Rather than relying on proprietary, opaque corporate retention algorithms or static tag averaging, MovieWatcher's recommendation engine is engineered directly from empirical academic research on **sequential media consumption**, **session-aware recommendation**, and **the psychological mechanics of the "rabbit hole" effect**.

```
Session Seed (What was just watched)
         │
         ├──▶ [Hop 1: Rabbit Hole Core]
         │       • Director Filmography (Auteur Continuity: 1.0)
         │       • Lead Cast Collaborations (Actor Continuity: 0.85)
         │       • Letterboxd Narrative Themes & Nanogenres (0.75)
         │
         ├──▶ [Hop 2: Serendipitous Neighbor Expansion]
         │       • Collaborators (Screenwriter / DP) & Adjacent Clusters (0.62)
         │       • Quality Floor: Letterboxd Top 500 & IMDb Top 200
         │
         └──▶ Two-Speed Gated Fusion Matcher
                 • FinalScore = α · SessionScore + (1 - α) · LongTermProfileScore
                 • Dynamic Decay: α(0) = 0.75 ──▶ 2h Half-Life ──▶ 0.20 Floor
```

---

### 1. Empirical Grounding: The 4 Scientific Pillars

| Research Principle | Empirical Driver | Algorithmic Implementation | Core Literature |
| :--- | :--- | :--- | :--- |
| **Algorithmic Steering & Choice Overload** | ~80% of catalog streams are algorithm-surfaced because choice overload induces viewers to defer to system curation. | Automated row partitioning (*Because You Watched*, *Top Picks*, *Thematic Dives*) to eliminate decision fatigue. | Chapman & Abraham (2025); Arokiaraj et al. (2023) |
| **The "Rabbit Hole Effect"** | Experiencing and enjoying media temporarily elevates cognitive accessibility for closely adjacent categories. | Immediate sequential priming anchoring recommendations to the title just watched across Director, Cast, and Tropes. | Woolley & Sharif (2021); Pradeep et al. (2020) |
| **Two-Speed Sequential Momentum** | Combining long-term user preferences with short-term session intent consistently outperforms static profiles. | Linear $\alpha$-gated fusion blending active session momentum ($N=3$) with all-time taste DNA. | Ou et al. (2025); Phuong et al. (2019); Liu et al. (2022) |
| **2-Hop Knowledge Graph Traversal** | 1-hop traversal creates filter bubbles; 3-hop causes topic drift. 2-hop traversal balances rabbit-holing with serendipity. | Bounded 2-hop entity traversal expanding from Director $\rightarrow$ Cast $\rightarrow$ Trope clusters. | Saat et al. (2025); Guo et al. (2020); Latifi et al. (2021) |

---

### 2. Mathematical Scoring & Two-Speed Gated Fusion

Traditional recommenders treat viewing history as an unweighted bag of tags. In contrast, MovieWatcher models recommendations as a **continuous temporal state transition**:

#### A. Sliding Session Window ($N = 3$) with Exponential Decay
The active session tracks the viewer's recent trajectory $[s_0, s_1, s_2]$:
$$w_k = 0.5^k \quad \text{for } k \in \{0, 1, 2\}$$
* **$s_0$ (Primary Seed):** Most recently watched or rated title ($w_0 = 1.0$).
* **$s_1, s_2$ (Secondary Signals):** Preceding session items ($w_1 = 0.50, w_2 = 0.25$).
* **Inactivity Expiration:** A 4-hour inactivity window cleanly resets the active session back to baseline, preventing stale evening moods from polluting the next day's viewing.

#### B. Dynamic Intent Gating ($\alpha$)
The fusion weight $\alpha(\Delta t)$ determines how strongly the immediate session bends the persistent profile:
$$\alpha(\Delta t) = 0.20 + 0.55 \cdot e^{-\Delta t / 2\text{h}}$$
* **$\Delta t = 0$ (Just finished a film):** $\alpha = 0.75$. The session rabbit hole takes priority.
* **$\Delta t > 2\text{h}$:** $\alpha$ relaxes toward $0.20$, allowing the viewer's long-term cinephile identity to take over.
* **Expired / Inactive:** $\alpha = 0.0$. Pure baseline profile scoring.

#### C. Fused Candidate Evaluation
$$\text{FinalScore}(c) = \alpha \cdot \text{Score}_{\text{session}}(c, S) + (1 - \alpha) \cdot \text{Score}_{\text{base}}(c, P_{\text{long}})$$
$$\text{MatchPercentage}(c) = \text{clamp}\big(75, 99, \lfloor 75 + 24 \cdot \text{FinalScore}(c) \rfloor\big)$$

---

### 3. Graph-Hop Entity Traversal & 0ms In-Memory Resolution

Following the rigorous benchmark findings of **Latifi et al. (2021)**—which established that deterministic nearest-neighbor and graph traversal methods match or outperform opaque neural session recommenders—MovieWatcher runs candidate generation directly client-side in sub-millisecond time:

1. **Hop 1 (Direct Adjacency):**
   * **Auteur Edge ($w = 1.0$):** Explores the filmography of the seed's Director. Viewers routinely follow auteur-driven styles to reduce cognitive evaluation costs (Nanda & Banerjee, 2020).
   * **Lead Cast Edge ($w = 0.85$):** Surfaces top-billed ensemble collaborations, satisfying parasocial familiarity heuristics.
   * **Narrative Trope Edge ($w = 0.75$):** Evaluates shared themes and nanogenres against the **56,052 movies** and **4,867 TV shows** pre-compiled in [`movie_theme_ids.json`](file:///d:/CODE/moviewatcher/src/data/movie_theme_ids.json).
2. **Hop 2 (Serendipitous Adjacency):**
   * Surfaces recurring screenwriters, cinematographers, and topologically adjacent trope clusters (Saat et al., 2025).
3. **Hard Negative Filtering:**
   * Titles rated $\le 2.5\star$ or explicitly disliked are strictly purged from all recommendation candidate pools.

---

### 4. Psychological Drivers: Mood Maintenance vs. Fatigue

Sequential media choices are fundamentally governed by emotional regulation (Castro et al., 2019; Shackleford et al., 2025):
* **Immersion & Mood Maintenance (Early/Mid-Session):** Binge viewers prioritize sustaining an existing affective valence. The algorithm responds by deepening the thematic rabbit hole (*"Because You Watched..."*, *"Deep Sci-Fi & Time Paradox Dives"*).
* **Cognitive Depletion & Comfort Anchoring (Extended Session):** As decision fatigue sets in, the threshold for evaluating complex, unfamiliar narratives increases. The engine counters fatigue with the **"Critically Acclaimed & Comfort Favorites"** row—anchored to high-consensus Letterboxd Top 500 and IMDb Top 200 masterpieces with $\ge 7.8$ ratings.

---

### 5. Explainability & Human Trust

Every card surfaced by the recommendation engine features an explicit attribution badge explaining *why* it was selected:
* `Directed by Christopher Nolan` (Auteur Rabbit Hole)
* `Starring Cillian Murphy` (Ensemble Continuity)
* `Shared Theme: Mind-Bending Sci-Fi` (Thematic Trope Overlap)
* `Because you watched Interstellar` (Direct Sequential Transition)

---

### 📚 Academic Citations & References

1. **Arokiaraj, P., Sandeep, D., Vishnu, J., & Muthurasu, N. (2023).** Movie Recommendation System Using Machine Learning. *Advances in Science and Technology*, 124, 398–406. https://doi.org/10.4028/p-g9ekjp
2. **Castro, D., Rigby, J. M., Cabral, D., & Nisi, V. (2019).** The binge-watcher’s journey: Investigating motivations, contexts, and affective states surrounding Netflix viewing. *Convergence: The International Journal of Research into New Media Technologies*, 27(1), 3–20. https://doi.org/10.1177/1354856519890856
3. **Chaitanya, V. S., & Thilagam, S. P. (2025).** PRIDES: A Probabilistic Model for Recurrent User Interest Drift Identification in Session-Based Recommendation. *IEEE Access*, 13, 73498–73519. https://doi.org/10.1109/ACCESS.2025.3564460
4. **Chapman, H. E., & Abraham, A. (2025).** Because You Watched: How Do Streaming Services’ Recommender Systems Influence Aesthetic Choice? *Behavioral Sciences*, 15(11), 1544. https://doi.org/10.3390/bs15111544
5. **García‐Sánchez, P., Vélez-Estévez, A., Merelo, J. J., & Cobo, M. J. (2021).** The Simpsons did it: Exploring the film trope space and its large scale structure. *PLoS ONE*, 16(3), e0248881. https://doi.org/10.1371/journal.pone.0248881
6. **Guo, Q., Zhuang, F., Qin, C., Zhu, H., Xie, X., Xiong, H., & He, Q. (2020).** A Survey on Knowledge Graph-Based Recommender Systems. *IEEE Transactions on Knowledge and Data Engineering*, 34(8), 3549–3568. https://doi.org/10.1109/TKDE.2020.3028705
7. **Jadhav, O. N., & Kb, A. (2022).** Movie Recommendation System Using Machine Learning Algorithms. *Journal of Machine and Computing*, 81–86. https://doi.org/10.53759/7669/jmc202202011
8. **Kim, J., Kim, J., & Choi, J. (2021).** Sequential Movie Genre Prediction Using Average Transition Probability with Clustering. *Applied Sciences*, 11(24), 11841. https://doi.org/10.3390/app112411841
9. **Latifi, S., Mauro, N., & Jannach, D. (2021).** Session-aware recommendation: A surprising quest for the state-of-the-art. *Information Sciences*, 573, 291–315. https://doi.org/10.1016/j.ins.2021.05.048
10. **Liu, H., Xu, Z., Zhang, Q., & Tang, Y. (2022).** Integrating Users’ Long- and Short-Term Preferences for Session-based Recommendation. *IEEE 25th International Conference on Computer Supported Cooperative Work in Design (CSCWD)*, 611–616. https://doi.org/10.1109/CSCWD54268.2022.9776254
11. **Masthoff, J. (2003).** Group Modeling: Selecting a Sequence of Television Items to Suit a Group of Viewers. *User Modeling and User-Adapted Interaction*, 14, 37–85. https://doi.org/10.1023/B:USER.0000010138.79319.fd
12. **Nanda, A. P., & Banerjee, R. (2020).** Binge watching: An exploration of the role of technology. *Psychology and Marketing*, 37(9), 1212–1230. https://doi.org/10.1002/mar.21353
13. **Oh, S., Bhattacharya, M., Feng, Y., & Lamkhede, S. (2024).** IntentRec: Predicting User Session Intent with Hierarchical Multi-Task Learning. *arXiv:2408.05353*. https://doi.org/10.48550/arxiv.2408.05353
14. **Ou, Z., Zhang, X., Zhu, Y., Lyu, S., Liu, J., & Ao, T. (2025).** LS-TGNN: Long and Short-Term Temporal Graph Neural Network for Session-Based Recommendation. *Proceedings of the AAAI Conference on Artificial Intelligence*, 39(12), 12426–12434. https://doi.org/10.1609/aaai.v39i12.33354
15. **Phuong, T. M., Thanh, T. C., & Bach, N. X. (2019).** Neural Session-Aware Recommendation. *IEEE Access*, 7, 86884–86896. https://doi.org/10.1109/ACCESS.2019.2926074
16. **Pradeep, N., Mangalore, K. K. R., Rajpal, B., Prasad, N., & Shastri, R. (2020).** Content based movie recommendation system. *International Journal of Research in Industrial Engineering*, 9(4), 337–348. https://doi.org/10.22105/riej.2020.259302.1156
17. **Saat, N. I. Y., Mohd, M., Noah, S. A. M., & Al-Ghuribi, S. M. (2025).** Beyond Relevance: Enhancing Serendipity in Content-Based Recommendations With Knowledge Graphs. *IEEE Access*, 13, 142980–142989. https://doi.org/10.1109/ACCESS.2025.3598342
18. **Shackleford, K. E., Whiteman, A., Cohen, D. J., Buttafuoco, J. L., & Reed, P. A. (2025).** Choosing to Re‐Experience Movies and TV Episodes: Popularity, Motivations and Benefits of Volitional Reconsumption of Entertainment Media. *Social and Personality Psychology Compass*, 20. https://doi.org/10.1111/spc3.70119
19. **Woolley, K., & Sharif, M. A. (2021).** Down a Rabbit Hole: How Prior Media Consumption Shapes Subsequent Media Consumption. *Journal of Marketing Research*, 59(3), 453–471. https://doi.org/10.1177/00222437211055403

---

## ⚖️ Neutrality, Pluggable Streaming & Legal Disclaimer

MovieWatcher is strictly an **open-source discovery UI, catalog browser, and metadata organization tool**:

* **No Media Hosting:** MovieWatcher does **not** host, store, cache, upload, or scrape video files, audio streams, or copyrighted media of any kind on its servers or databases.
* **Pluggable Architecture:** Streaming embeds (e.g., Vidbolt iframe endpoints) are modular client-side integrations. Users hold full responsibility for the streams, providers, and media sources they configure or access.
* **Anti-Piracy Commitment:** We do not encourage, promote, or endorse unauthorized distribution of copyrighted content.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                         │
│            React 19 + TypeScript + Tailwind CSS             │
│            • In-Memory Orama Engine (<2ms Search)           │
│            • Zustand Store (Episode & Watch History)        │
└───────────────┬───────────────────────────────┬─────────────┘
                │ GET /api/user/*               │ Client queries
                ▼                               ▼
┌──────────────────────────────┐  ┌───────────────────────────┐
│  Cloudflare Pages Functions  │  │  External Metadata APIs   │
│  • Edge Authentication       │  │  • TMDB (The Movie DB)    │
│  • Watchlist & Ratings Sync  │  │  • Letterboxd Taxonomy    │
│  • Cloudflare D1 (SQLite)    │  │  • Pluggable Embed Player │
└──────────────────────────────┘  └───────────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), Netflix Sans Typography |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) with `persist` middleware |
| **Search Engine** | [@orama/orama](https://github.com/oramasearch/orama) (in-memory edge full-text & typo search) |
| **Edge Backend** | [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/) |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless distributed SQLite) |
| **Metadata & Media** | [The Movie Database (TMDB)](https://www.themoviedb.org/) & [tmdb-ts](https://github.com/grantholle/tmdb-ts) |

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+ installed on your machine.
* *(Optional)* A free TMDB Read Access Token or API Key.

### 1. Installation
```bash
git clone https://github.com/yashensha/moviestreamer.git
cd moviestreamer
npm install
```

### 2. Configure Environment
Create a `.env` file from the provided template:
```bash
cp .env.example .env
```
Add your TMDB credentials in `.env`:
```env
VITE_TMDB_READ_ACCESS_TOKEN=your_tmdb_read_access_token_here
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗺️ Product Roadmap

- [x] **Phase 1: Cinema Discovery Foundation** (Curated Letterboxd Top 500, IMDb Top 200, Netflix-style billboard and rails).
- [x] **Phase 2: Letterboxd CSV Importer** (Automated batch resolution of `ratings.csv` and `watchlist.csv` with instant Taste DNA calibration).
- [x] **Phase 3: In-Memory Orama Engine** (Sub-2ms instant typo-tolerant search and thematic vibe filtering).
- [x] **Phase 4: Multi-Entity Filmography Hub** (Actor & director search with dedicated full-credits portfolio views).
- [ ] **Phase 5: Deep Crew & Department Tagging** (Filter films by Cinematographers [e.g. *Roger Deakins*], Composers [e.g. *Hans Zimmer*], and Screenwriters).
- [ ] **Phase 6: Automated Letterboxd Account Sync** (Direct profile scraping or OAuth token sync for live background updates).
- [ ] **Phase 7: Personal Cinematic Time Capsule** (Annual & monthly viewing rhythm analytics, genre affinities, and streaming dwell time breakdown).

---

## 📄 License
MIT License. Built with passion for open cinema exploration.
