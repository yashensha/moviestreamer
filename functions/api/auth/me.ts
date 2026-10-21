// ==============================================================================
// Cloudflare Pages Function: GET /api/auth/me
// Validates current session token and returns user profile & synced state
// ==============================================================================

import { Env, getDb, jsonResponse } from './_utils';

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = getDb(env);

    if (!db) {
      return jsonResponse({ error: 'Database binding not configured.' }, 503);
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return jsonResponse({ error: 'No authorization token provided.' }, 401);
    }

    const now = Date.now();

    // 1. Look up session
    const session = await db
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?1')
      .bind(token)
      .first<{ user_id: string; expires_at: number }>();

    if (!session || session.expires_at < now) {
      if (session) {
        await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
      }
      return jsonResponse({ error: 'Session expired or invalid.' }, 401);
    }

    // 2. Fetch user
    const user = await db
      .prepare('SELECT id, email, name, created_at, last_active FROM users WHERE id = ?1')
      .bind(session.user_id)
      .first<{ id: string; email: string; name: string; created_at: number; last_active: number }>();

    if (!user) {
      return jsonResponse({ error: 'User not found.' }, 404);
    }

    // 3. Fetch cloud history and likes
    const historyResult = await db
      .prepare(
        `SELECT media_id as id, media_type as type, title, overview, poster_path, backdrop_path, release_date, season, episode, vote_average, number_of_seasons, updated_at as updatedAt
         FROM watch_history
         WHERE user_id = ?1
         ORDER BY updated_at DESC
         LIMIT 50`
      )
      .bind(user.id)
      .all();

    const likesResult = await db
      .prepare(
        `SELECT media_id as id, media_type, title, poster_path, backdrop_path, genre_ids, vote_average, liked_at
         FROM liked_titles
         WHERE user_id = ?1
         ORDER BY liked_at DESC
         LIMIT 100`
      )
      .bind(user.id)
      .all();

    const likedMedia = (likesResult.results || []).map((row: any) => ({
      ...row,
      genre_ids: row.genre_ids ? JSON.parse(row.genre_ids) : [],
    }));

    const ratingsResult = await db
      .prepare(
        `SELECT media_id as id, media_type as type, title, rating, confidence_weight as confidenceWeight,
                source, poster_path, backdrop_path, release_date, vote_average, genre_ids, rated_at as ratedAt
         FROM user_ratings WHERE user_id = ?1 ORDER BY rated_at DESC LIMIT 500`
      )
      .bind(user.id)
      .all();

    const ratings = (ratingsResult.results || []).map((row: any) => ({
      ...row,
      genre_ids: row.genre_ids ? JSON.parse(row.genre_ids) : [],
    }));

    // Ensure user_watchlist exists before querying
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS user_watchlist (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        media_id INTEGER NOT NULL,
        media_type TEXT NOT NULL DEFAULT 'movie',
        title TEXT NOT NULL,
        overview TEXT,
        poster_path TEXT,
        backdrop_path TEXT,
        release_date TEXT,
        vote_average REAL,
        genre_ids TEXT,
        number_of_seasons INTEGER,
        added_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );`
    ).run();

    const watchlistResult = await db
      .prepare(
        `SELECT media_id as id, media_type, title, overview, poster_path, backdrop_path,
                release_date, vote_average, genre_ids, number_of_seasons, added_at
         FROM user_watchlist WHERE user_id = ?1 ORDER BY added_at DESC LIMIT 500`
      )
      .bind(user.id)
      .all();

    const watchlist = (watchlistResult.results || []).map((row: any) => ({
      ...row,
      genre_ids: row.genre_ids ? JSON.parse(row.genre_ids) : [],
    }));

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email?.split('@')[0] || 'User',
      },
      watchHistory: historyResult.results || [],
      likedMedia,
      ratings,
      watchlist,
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Session validation failed.' }, 500);
  }
};
