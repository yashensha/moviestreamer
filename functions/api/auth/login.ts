// ==============================================================================
// Cloudflare Pages Function: POST /api/auth/login
// User login with email and password
// ==============================================================================

import { Env, getDb, verifyPassword, generateToken, jsonResponse } from './_utils';

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = getDb(env);

    if (!db) {
      return jsonResponse({
        error: 'Database binding not configured on this environment.'
      }, 503);
    }

    const body = await request.json().catch(() => ({})) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return jsonResponse({ error: 'Please provide both email and password.' }, 400);
    }

    // 1. Fetch user by email
    const user = await db
      .prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?1')
      .bind(email)
      .first<{ id: string; email: string; password_hash: string; name: string }>();

    if (!user || !user.password_hash) {
      return jsonResponse({ error: 'Invalid email or password.' }, 401);
    }

    // 2. Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid email or password.' }, 401);
    }

    const now = Date.now();

    // 3. Update last active timestamp
    await db
      .prepare('UPDATE users SET last_active = ?1 WHERE id = ?2')
      .bind(now, user.id)
      .run();

    // 4. Create new 30-day session token
    const token = generateToken();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

    await db
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES (?1, ?2, ?3, ?4)`
      )
      .bind(token, user.id, now, expiresAt)
      .run();

    // 5. Fetch user's saved watch history and likes from D1 to restore their state
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

    return jsonResponse({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
      },
      watchHistory: historyResult.results || [],
      likedMedia,
    });
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Login failed.' }, 500);
  }
};
