// ==============================================================================
// Cloudflare Pages Function: POST /api/auth/register
// User registration with email and password
// ==============================================================================

import { Env, getDb, hashPassword, generateToken, jsonResponse } from './_utils';

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
      name?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim() || email?.split('@')[0] || 'Movie Fan';

    if (!email || !email.includes('@') || !email.includes('.')) {
      return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters long.' }, 400);
    }

    // 1. Check if user already exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE email = ?1')
      .bind(email)
      .first();

    if (existing) {
      return jsonResponse({ error: 'An account with this email already exists.' }, 409);
    }

    // 2. Hash password & insert user
    const now = Date.now();
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
    const passwordHash = await hashPassword(password);

    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at, last_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(userId, email, passwordHash, name, now, now)
      .run();

    // 3. Initialize default algorithm model row
    await db
      .prepare(
        `INSERT INTO user_algorithm_model (user_id, model_version, genre_weights, actor_weights, director_weights, feature_vector, recommendation_cache, updated_at)
         VALUES (?1, 'v1-session-affinity', '{}', '{}', '{}', '[]', '[]', ?2)`
      )
      .bind(userId, now)
      .run();

    // 4. Generate persistent session token (valid for 30 days)
    const token = generateToken();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

    await db
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES (?1, ?2, ?3, ?4)`
      )
      .bind(token, userId, now, expiresAt)
      .run();

    return jsonResponse({
      success: true,
      token,
      user: {
        id: userId,
        email,
        name,
      },
    }, 201);
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Registration failed.' }, 500);
  }
};
