# 🧬 Phase 3: Taste DNA & Next-Gen Search Experience

> **Status:** Specification Complete — Ready for Review & Approval  
> **Benchmark Reference:** [FEATURE_IDEAS.md](file:///d:/CODE/moviewatcher/FEATURE_IDEAS.md) & [docs/ux.md: Lesson #2 & #4](file:///d:/CODE/moviewatcher/docs/ux.md) — *"Shorten the distance between browsing and watching... give users the opportunity to personalize their experience."*

---

## 1. Concept: Transforming Raw Math into "Taste DNA"

In Phase 1, we retired the raw developer BM25 math formula and latent vector logs from the user's profile. In Phase 3, we channel those powerful underlying calculations (`computeUnifiedInteractionMatrix` and `subgenreService`) into an emotionally rewarding, visual **Taste DNA Capsule** ("Spotify Wrapped" for Cinema).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  🧬 YOUR CINEMA TASTE DNA                                     [ 54 Titles • 118 hrs ] │
│                                                                                        │
│  VIEWER ARCHETYPE                                                                      │
│  🌌 The Midnight Sci-Fi Voyager                                                        │
│  "Drawn to deep space existentialism, non-linear time puzzles, and dystopian horizons." │
│                                                                                        │
│  GENRE SPECTRUM                                                                        │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │
│  Sci-Fi (42%)       Thriller (26%)     Anime (18%)        Crime (14%)                  │
│                                                                                        │
│  SIGNATURE NARRATIVE TROPES                                                            │
│  [ #TimeLoop ]  [ #Cyberpunk ]  [ #ArtificialIntelligence ]  [ #NeoNoir ]  [ #Heist ]  │
│                                                                                        │
│  ⭐ TASTE METRICS                                                                      │
│  Avg Letterboxd Rating: 4.1★  •  Completed Series: 8  •  Top Director: Denis Villeneuve│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dynamic Viewer Archetypes:
Our engine classifies viewers into charismatic archetypes based on their dominant weights:
- **"The Midnight Sci-Fi Voyager"**: High affinity for Sci-Fi, Space Exploration, and AI.
- **"The Neo-Noir Sleuth"**: Crime, Mystery, Psychological Thrillers, and Dark Gritty aesthetics.
- **"The Criterion Purist"**: High-rated classic cinema, international films, auteur directors.
- **"The Weekend Binge Commander"**: Multi-season narrative arcs and high completion velocity.
- **"The Anime Marathoner"**: Shonen, Seinen, Studio Ghibli, and animated storytelling.

---

## 2. Next-Gen Search: Multi-Entity Spotlight (`Cmd+K` / `/`)

### The Usability Problem
Traditional streaming search only returns movie/series titles. When a user searches *"Christopher Nolan"*, *"Cillian Murphy"*, or *"Cyberpunk"*, current search either fails or returns clumsy partial title matches.

### The Solution: Global Command Palette (`Cmd+K`)
Pressing `Cmd+K`, `Ctrl+K`, or `/` opens a centered, keyboard-driven Spotlight Search modal with instant multi-entity grouping:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔍  Christopher Nolan                                            [Esc] │
├──────────────────────────────────────────────────────────────────────────┤
│  PEOPLE (1)                                                              │
│  👤 Christopher Nolan — Director & Writer • 12 Films Available          │
│                                                                          │
│  MOVIES & SERIES (4)                                                     │
│  🎬 Oppenheimer (2023) • 8.9★ • Biography, Drama, History               │
│  🎬 Interstellar (2014) • 8.7★ • Sci-Fi, Adventure                      │
│  🎬 Inception (2010) • 8.8★ • Sci-Fi, Action, Mystery                   │
│  🎬 The Dark Knight (2008) • 9.0★ • Action, Crime                       │
│                                                                          │
│  THEMES & SUBGENRES (2)                                                  │
│  🏷️ Mind-Bending Non-Linear Narratives (Jump to Curated Row)            │
│  🏷️ Psychological Thriller (Jump to Genre Explore)                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Multi-Entity Categories:
1. **🎬 Titles (Movies & TV Series):** Direct play button, release year, runtime, and rating.
2. **🌟 People (Directors, Creators, Actors):** Avatar portrait, primary role badge, and link to their dedicated filmography hub (`/person/:id`).
3. **🏷️ Subgenres & Themes:** Instant jump to curated taxonomy collections (e.g. *Cyberpunk*, *Time Travel*, *Heist*).

---

## 3. Dedicated Actor & Director Filmography Pages (`/person/:id`)

When selecting a creator or cast member from search or from the title details page, users navigate to a dedicated filmography hub:

```
[ Person Hero Section ]
┌────────────────────────────────────────────────────────────────────────┐
│  [ High-Res Avatar ]   DENIS VILLENEUVE                                │
│                        Director • Screenwriter • 11 Feature Films      │
│                        "Known for visionary sci-fi and tense drama."  │
│                                                                        │
│  [ Filter: All ] [ Directed ] [ Written ]    [ Sort: Rating ▾ ]       │
└────────────────────────────────────────────────────────────────────────┘

[ Filmography Grid ]
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Dune: Part 2 │  │ Blade Runner │  │ Arrival      │  │ Sicario      │
│ 8.6★ [✓ Seen]│  │ 8.0★ [In List│  │ 7.9★ [4.5★]  │  │ 7.6★         │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Features:
1. **Interactive Filmography Grid:** Filterable by role (Directed, Written, Acted In) and sorted by Release Date or Rating.
2. **Viewing Status Indicators:** Highlights which titles in their catalog the user has already watched, liked, or rated in MovieWatcher.
3. **Frequent Collaborators Pill:** Displays regular actors, cinematographers, or composers they frequently partner with.

---

## 4. Phase 3 Verification Checklist

- [ ] Taste DNA card replaces the raw math section in `ProfilePage.tsx`.
- [ ] Global shortcut (`Cmd+K` / `Ctrl+K` / `/`) activates the Spotlight search palette from any route.
- [ ] Multi-entity search results distinguish between **Titles**, **People**, and **Themes**.
- [ ] Full keyboard navigation implemented (Arrow keys to navigate, Enter to open, Esc to close).
- [ ] Dedicated `/person/:id` route operational with filterable filmography and personal watch indicators.
