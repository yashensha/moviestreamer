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
2. **Thematic Vibe & Nanogenre Matching:** Replaces blunt genre labels (*"Action"*, *"Comedy"*) with rich, nuanced cinematic DNA (*"Mind-Bending Dream Heist"*, *"Slow-Burn Gothic Noir"*, *"Neon Cyberpunk Dystopia"*).
3. **Pluggable Player Architecture:** Decouples content discovery from closed distribution networks. Users can connect any stream source or embed provider of their choice (such as Vidbolt or self-hosted media servers).

---

## 👤 Discovery Grounding: Built with Real Cinephiles

Through structured interviews with film enthusiasts and heavy streaming viewers, we identified three core frustrations that direct our product roadmap:

> *"I'm tired of Netflix recommending 5 mediocre originals in a row just because they made them. Show me what film lovers on Letterboxd and IMDb actually consider the greatest of all time."*  
> — **Direct Cinephile User Interview**

### Key Needs Identified:
* **Letterboxd Top 500 & IMDb Top 200 Hubs:** Instant access to community-ranked best pictures and top-rated television series without platform bias.
* **Director & Actor Centric Discovery:** The ability to search a creator (e.g., *Christopher Nolan*, *Denis Villeneuve*, *Bong Joon-ho*, *Anya Taylor-Joy*) and explore their complete chronological filmography across cast and crew credits.
* **Instant, Typo-Tolerant Search:** Search that understands misspellings (*"intrestelar"* $\rightarrow$ *Interstellar*) and thematic vibes (*"rainy vampire mystery"*), returning results in milliseconds.

---

## 🌟 Key Features

### 1. 🏆 Letterboxd Top 500 & IMDb Top 200 Catalogs
* **Curated Top-Rated Hub:** Dedicated views for the **Letterboxd Top 500 Greatest Films of All Time** and **IMDb Top 200 Television Series**.
* **Prestige Badges:** Instant visual indicators showing rank standing, IMDb scores, and Letterboxd accolades on hover cards and detail views.

### 2. ⚡ In-Memory Instant & Typo-Tolerant Search (Powered by Orama)
* **Sub-2ms Keystroke Evaluation:** Uses [@orama/orama](https://github.com/oramasearch/orama) running directly in-memory with zero server bottlenecks.
* **Fuzzy Levenshtein Typo Tolerance:** Automatically resolves misspellings without returning dead-end empty states.
* **Thematic & Vibe Retrieval:** Querying atmospheric descriptors like *"cyberpunk"*, *"space exploration"*, or *"vampire"* surfaces relevant titles based on curated tag metadata.
* **Seamless TMDB Fallback:** Long-tail or obscure queries transparently fall back to TMDB's global multi-search.

### 3. 🎬 Creator & Filmography Exploration
* **Entity-Aware Multi-Search:** Searches across Movies, TV Series, Directors, and Actors simultaneously.
* **Dedicated Person Filmography:** Clicking any cast or crew member opens their complete, chronological portfolio of works, allowing deep director-led marathons.

### 4. 🧬 Personalized Taste DNA Engine
* **Multimodal Affinity Scoring:** Dynamically weights your preferences across genre affinities, Letterboxd CSV star ratings, and watch dwell times.
* **Smart Negative Filtering:** Hard-filters titles you've rated 1★ or 2★ on Letterboxd, ensuring recommendations never push disliked styles.

### 5. 📺 Immersive Netflix-Grade Theater Experience
* **Cinematic Billboard & Carousels:** High-contrast `#141414` canvas, responsive hero banners with clean logos, and smooth horizontal rails.
* **Episode Hub & Auto-Resume:** Tracks your active season/episode progression and automatically loads your last streamed timestamp.

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
- [x] **Phase 2: In-Memory Orama Engine** (Sub-2ms instant typo-tolerant search and thematic vibe filtering).
- [x] **Phase 3: Multi-Entity Filmography Hub** (Actor & director search with dedicated full-credits portfolio views).
- [ ] **Phase 4: Deep Crew & Department Tagging** (Filter films by Cinematographers [e.g. *Roger Deakins*], Composers [e.g. *Hans Zimmer*], and Screenwriters).
- [ ] **Phase 5: Automated Letterboxd Watchlist Sync** (Direct profile scraping or OAuth token sync for live updates).
- [ ] **Phase 6: Personal Cinematic Time Capsule** (Annual & monthly viewing rhythm analytics, genre affinities, and streaming dwell time breakdown).

---

## 📄 License
MIT License. Built with passion for open cinema exploration.
