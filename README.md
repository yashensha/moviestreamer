# MovieWatcher 🎬 (Netflix Edition)

A Netflix-style movie and TV streaming web platform built with **Vite**, **React 19**, **TypeScript**, **Tailwind CSS**, **tmdb-ts**, and **Zustand**.

Powered by:
- **[The Movie Database (TMDB)](https://developer.themoviedb.org/docs/getting-started)** & **[tmdb-ts](https://www.npmjs.com/package/tmdb-ts)** for search, metadata, posters, ratings, and series episode data.
- **[Vidbolt](https://vidbolt.xyz/)** for streaming video embeds via `iframe`.
- **[Zustand](https://zustand-demo.pmnd.rs/)** with `persist` middleware for saving and resuming your last streamed series episodes and watch history.

---

## 🌟 Key Features

### 1. 🍿 Netflix-Inspired UI & Aesthetics
- **Netflix Dark Aesthetic**: `#141414` deep canvas, Netflix Red `#E50914`, subtle border accents, and high-contrast typography.
- **Cinematic Billboard**: Hero banner with backdrop, age ratings, match percentage, "Play Now" and "More Info" buttons.
- **Horizontal Sliders**: Smooth scrolling carousels for:
  - **Continue Watching** (powered by Zustand store with progress indicators)
  - **Trending Now**
  - **Top 10 Today** (with stylized ranking typography 1-10)
  - **Critically Acclaimed TV Shows & Series**
  - **Blockbuster Movies**
- **Hover Previews**: Quick action controls, match score, maturity tags, and TMDB IDs.

### 2. 📺 Dedicated Inner Page (No Popups)
- Selecting any movie or series transitions smoothly to a **dedicated Inner Page** (`InnerDetailPage`).
- Centered theater-grade **Vidbolt embed player**:
  ```html
  <iframe
    id="vidbolt-player"
    src="https://vidbolt.xyz/movie/1007757"
    width="100%"
    height="100%"
    frameborder="0"
    allowfullscreen
    allow="autoplay; encrypted-media; picture-in-picture"
  ></iframe>
  ```
- **TV Series Episode Hub**:
  - Season dropdown picker.
  - Interactive episode list with episode numbers, thumbnails, synopses, and quick play buttons.
  - "More Like This" recommendation row at the bottom.

### 3. 💾 Zustand Smart Episode Auto-Resume
- Integrated `useStreamStore` with `zustand/middleware/persist` stored in `localStorage`.
- **Automatic Resume**: When you revisit any TV series, it remembers and **automatically loads & plays your last streamed episode** (e.g. Season 2, Episode 4).
- Prominent resume alert notification with an option to restart from Season 1, Episode 1 if desired.
- In-progress items appear in the **"Continue Watching"** row on the homepage.

### 4. 🔍 Live Search with `tmdb-ts`
- Search bar in the top navigation with instant debounce.
- Queries both Movies and TV Shows via `tmdb-ts` with full fallback to curated titles.
- Filter results between All, Movies, and TV Shows.

### 5. ⚡ Quick Stream by TMDB ID
- "Stream ID" button in the navbar allows streaming any custom TMDB Movie or TV ID instantly.

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 TMDB API Key (Optional)
Click the **"TMDB Key"** button in the top navbar to paste your TMDB Read Access Token or v3 API Key, or set:
```env
VITE_TMDB_API_KEY=your_key_here
```
*(The platform also includes a built-in curated catalog of movies and series that works out-of-the-box without requiring an API key).*
