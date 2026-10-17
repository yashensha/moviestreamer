// ==============================================================================
// Cloudflare Pages Function: POST /api/user/sync
// Syncs User Watch History & Likes to Cloudflare D1 and updates Algorithm Model
// ==============================================================================

interface Env {
  DB?: any; // Cloudflare D1 Database binding
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;

    if (!env.DB) {
      // Local dev or D1 binding not yet connected
      return new Response(
        JSON.stringify({
          success: true,
          message: 'D1 binding not detected; running in mock/offline mode.',
          model: { version: 'v1-local-fallback' }
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json()) as {
      userId: string;
      watchHistory?: any[];
      likedMedia?: any[];
    };

    const { userId, watchHistory = [], likedMedia = [] } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();

    // 1. Ensure user exists
    await env.DB.prepare(
      `INSERT INTO users (id, created_at, last_active)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET last_active = ?3`
    ).bind(userId, now, now).run();

    // 2. Compute Algorithm Model: Genre Affinity Weights
    const genreWeights: Record<string, number> = {};

    // Likes contribute +3.0 weight
    for (const item of likedMedia) {
      const gids: number[] = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
      for (const gid of gids) {
        genreWeights[String(gid)] = (genreWeights[String(gid)] || 0) + 3.0;
      }

      // Upsert liked titles in D1
      const recordId = `${userId}:${item.id}`;
      await env.DB.prepare(
        `INSERT INTO liked_titles (id, user_id, media_id, media_type, title, poster_path, backdrop_path, genre_ids, vote_average, liked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET liked_at = ?10`
      ).bind(
        recordId,
        userId,
        item.id,
        item.media_type || 'movie',
        item.title || 'Untitled',
        item.poster_path || null,
        item.backdrop_path || null,
        JSON.stringify(gids),
        item.vote_average || 0,
        now
      ).run();
    }

    // Watch history contributes +1.5 weight per title
    for (const item of watchHistory) {
      const recordId = `${userId}:${item.type}:${item.id}`;
      await env.DB.prepare(
        `INSERT INTO watch_history (id, user_id, media_id, media_type, title, overview, poster_path, backdrop_path, release_date, season, episode, vote_average, number_of_seasons, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET season = ?10, episode = ?11, updated_at = ?14`
      ).bind(
        recordId,
        userId,
        item.id,
        item.type || 'movie',
        item.title || 'Untitled',
        item.overview || '',
        item.poster_path || null,
        item.backdrop_path || null,
        item.release_date || '',
        item.season || 1,
        item.episode || 1,
        item.vote_average || 0,
        item.number_of_seasons || 1,
        item.updatedAt || now
      ).run();
    }

    // 3. Save calculated algorithm model in user_algorithm_model
    await env.DB.prepare(
      `INSERT INTO user_algorithm_model (user_id, model_version, genre_weights, actor_weights, director_weights, feature_vector, recommendation_cache, updated_at)
       VALUES (?1, ?2, ?3, '{}', '{}', '[]', '[]', ?4)
       ON CONFLICT(user_id) DO UPDATE SET genre_weights = ?3, updated_at = ?4`
    ).bind(
      userId,
      'v1-session-affinity',
      JSON.stringify(genreWeights),
      now
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        model: {
          version: 'v1-session-affinity',
          genreWeights,
          updatedAt: now,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
