-- ==============================================================================
-- Cloudflare D1 Database Schema for MovieWatcher
-- Designed for Edge Workers / Cloudflare Pages Functions
-- ==============================================================================

-- 1. Users table (Supports email/password authentication & guest sessions)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 1b. Sessions table for authentication tokens
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 2. Watch History & In-Progress Streaming
CREATE TABLE IF NOT EXISTS watch_history (
  id TEXT PRIMARY KEY, -- format: {user_id}:{media_type}:{media_id}
  user_id TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  season INTEGER,
  episode INTEGER,
  vote_average REAL,
  number_of_seasons INTEGER,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id, updated_at DESC);

-- 3. Liked / Favorited Titles
CREATE TABLE IF NOT EXISTS liked_titles (
  id TEXT PRIMARY KEY, -- format: {user_id}:{media_id}
  user_id TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  title TEXT NOT NULL,
  poster_path TEXT,
  backdrop_path TEXT,
  genre_ids TEXT, -- JSON array of genre IDs: [878, 16, 28]
  vote_average REAL,
  liked_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_liked_titles_user ON liked_titles(user_id, liked_at DESC);

-- 4. User Algorithm Model & Recommendation Weights
-- Extensible table built to store custom machine learning & recommendation models
CREATE TABLE IF NOT EXISTS user_algorithm_model (
  user_id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL DEFAULT 'v1-session-affinity',
  genre_weights TEXT NOT NULL DEFAULT '{}',       -- JSON: { "878": 4.5, "16": 3.8 }
  actor_weights TEXT NOT NULL DEFAULT '{}',       -- JSON: { "Bryan Cranston": 2.0 }
  director_weights TEXT NOT NULL DEFAULT '{}',    -- JSON: { "Christopher Nolan": 3.0 }
  feature_vector TEXT NOT NULL DEFAULT '[]',      -- JSON float vector for ML embedding models
  recommendation_cache TEXT NOT NULL DEFAULT '[]',-- JSON list of pre-scored TMDB IDs
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_algorithm_model_updated ON user_algorithm_model(updated_at DESC);

-- 5. User Ratings & Letterboxd Imported Seed Matrix
CREATE TABLE IF NOT EXISTS user_ratings (
  id TEXT PRIMARY KEY, -- format: {user_id}:{media_type}:{media_id}
  user_id TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'movie',
  title TEXT NOT NULL,
  rating REAL, -- Letterboxd scale: 0.5 to 5.0
  confidence_weight REAL NOT NULL DEFAULT 1.0, -- Confidence weight: 0.5 to 5.0
  source TEXT NOT NULL DEFAULT 'letterboxd', -- 'letterboxd' | 'manual' | 'stream'
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  vote_average REAL,
  genre_ids TEXT, -- JSON array of genre IDs: [28, 12, 878]
  rated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_ratings_user ON user_ratings(user_id, rated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_ratings_media ON user_ratings(media_id, rating);
