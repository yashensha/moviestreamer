# 🎬 Feature Idea: MovieWatcher Time Capsule & Screen Time Analytics

A personalized, "Spotify Wrapped / Time Capsule" style analytics dashboard that tracks user streaming length, weekly rhythm, and genre affinities.

---

## 📌 Concept Overview
Similar to **Spotify Wrapped** or **Apple Screen Time**, MovieWatcher can track active streaming hours per title, aggregating watch statistics across weeks and months to generate an interactive, visual "Capsule Board" for each user.

---

## ⏱️ 1. Tracking Watch Time & Dwell Architecture

### Active Streaming Watchdog
- **Visibility Detection**: Track when the tab is visible and focused using the HTML5 `Page Visibility API` (`document.visibilityState === 'visible'`). If minimized or switched to another tab, the counter pauses.
- **Player PostMessage Bridge**: Listen to `window.addEventListener('message')` from the iframe embed (`vidbolt.xyz` or future players) to capture native `timeupdate`, `duration`, and `ended` events if broadcast.
- **Heartbeat & Session Storage**: Accumulate active viewing seconds locally in state every 5 seconds.
- **Edge Syncing to Cloudflare D1**: On page exit or every 2–3 minutes, persist cumulative `watched_seconds` to the `watch_history` table in Cloudflare D1.

---

## 📊 2. The "Capsule Board" Features

### A. Total Hours & Screen Time Meter
- Total watch hours (Lifetime, Current Month, and This Week).
- Comparison metric: e.g., *"You watched 32.4 hours this week (+14% vs last week)"*.

### B. Genre Capsule Spectrum
- Visual breakdown of time spent by TMDB Genre ID:
  - 🚀 **Sci-Fi**: 42% (13.6 hrs)
  - 🥋 **Animation / Anime**: 26% (8.4 hrs)
  - 🕵️ **Crime & Thriller**: 18% (5.8 hrs)
  - 🍿 **Action / Adventure**: 14% (4.6 hrs)
- Color-coded percentage progress bars and capsule pill indicators.

### C. Weekly Binge Rhythm (Mon – Sun Heatmap / Activity Bars)
- Visual bar chart / dot matrix showing hours streamed each day of the week.
- Highlights peak watch days (e.g. *"Peak Watch Night: Friday 10 PM – 2 AM"*).

### D. "Top Obsession" / Most Binged
- Showcases the specific show or film the user dedicated the most consecutive hours to.
- Example: *"Rick and Morty — 18 episodes, 6.2 hours streamed"*.

### E. Viewer Archetype Badge
A fun, shareable personality classification based on dominant genre and viewing habits:
- **"The Midnight Sci-Fi Voyager"** (Heavy Sci-Fi / Late Night)
- **"Weekend Binge Commander"** (High episodic TV marathon hours)
- **"Cinephile Purist"** (High-rated classic cinema / Director-focused)
- **"Anime Marathoner"** (High animation watch volume)

---

## 🧠 3. Integration with Recommendation Algorithm

Watch time is a vastly superior signal than simple clicks or likes:
1. **Completion Rate Weighting**: If a user finishes a 2-hour movie or 5 episodes of a show, boost the weight of that title's genres, actors, and director by **+5.0**.
2. **Drop-off Penalty**: If a title was opened but abandoned after <3 minutes, down-weight that title to prevent low-quality suggestions.
3. **Time Decay**: Weight hours watched in the last 7 days higher than titles watched 6 months ago.

---

## 🗄️ 4. Proposed Database Schema Extension (Cloudflare D1)

```sql
-- Extend watch_history with duration metrics
ALTER TABLE watch_history ADD COLUMN total_seconds_watched INTEGER DEFAULT 0;
ALTER TABLE watch_history ADD COLUMN completion_percentage REAL DEFAULT 0;
ALTER TABLE watch_history ADD COLUMN completed_count INTEGER DEFAULT 0;

-- Optional dedicated weekly aggregation table
CREATE TABLE IF NOT EXISTS user_weekly_capsule (
  id TEXT PRIMARY KEY, -- {user_id}:{year}:{week_number}
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  genre_breakdown TEXT NOT NULL DEFAULT '{}', -- JSON: { "Sci-Fi": 240, "Action": 120 }
  top_title_id INTEGER,
  top_title_name TEXT,
  top_title_minutes INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_capsule_user_week ON user_weekly_capsule(user_id, year DESC, week_number DESC);
```

---

## 🎨 5. UI Presentation
- Positioned as a dedicated tab or spotlight card within `/profile` ("Your Capsule").
- Sleek dark Bento-grid aesthetic with neon glow borders, animated counters, and an exportable / shareable summary card.
