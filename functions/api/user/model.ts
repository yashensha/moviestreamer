// ==============================================================================
// Cloudflare Pages Function: GET /api/user/model?userId=...
// Retrieves stored User Algorithm Model, Liked Titles, and Watch History from D1
// ==============================================================================

interface Env {
  DB?: any;
  moviewatcher_db?: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;
    const url = new URL(request.url);
    let targetUserId = url.searchParams.get('userId');

    if (!targetUserId) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token && db) {
        const session = await db
          .prepare('SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > ?2')
          .bind(token, Date.now())
          .first<{ user_id: string }>();
        if (session?.user_id) {
          targetUserId = session.user_id;
        }
      }
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!db) {
      return new Response(
        JSON.stringify({
          model: null,
          watchHistory: [],
          likedMedia: [],
          offline: true,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch Algorithm Model
    const modelRecord = await db.prepare(
      `SELECT * FROM user_algorithm_model WHERE user_id = ?1`
    ).bind(targetUserId).first();

    // 2. Fetch Watch History
    const historyResults = await db.prepare(
      `SELECT * FROM watch_history WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 30`
    ).bind(targetUserId).all();

    // 3. Fetch Liked Titles
    const likedResults = await db.prepare(
      `SELECT * FROM liked_titles WHERE user_id = ?1 ORDER BY liked_at DESC LIMIT 50`
    ).bind(targetUserId).all();

    return new Response(
      JSON.stringify({
        model: modelRecord ? {
          version: modelRecord.model_version,
          genreWeights: JSON.parse(modelRecord.genre_weights || '{}'),
          actorWeights: JSON.parse(modelRecord.actor_weights || '{}'),
          directorWeights: JSON.parse(modelRecord.director_weights || '{}'),
          featureVector: JSON.parse(modelRecord.feature_vector || '[]'),
          updatedAt: modelRecord.updated_at,
        } : null,
        watchHistory: (historyResults.results || []).map((row: any) => ({
          id: row.media_id,
          type: row.media_type,
          title: row.title,
          overview: row.overview,
          poster_path: row.poster_path,
          backdrop_path: row.backdrop_path,
          release_date: row.release_date,
          season: row.season,
          episode: row.episode,
          vote_average: row.vote_average,
          number_of_seasons: row.number_of_seasons,
          progressSeconds: row.progress_seconds || 0,
          durationSeconds: row.duration_seconds || 0,
          updatedAt: row.updated_at,
        })),
        likedMedia: (likedResults.results || []).map((row: any) => ({
          id: row.media_id,
          media_type: row.media_type,
          title: row.title,
          poster_path: row.poster_path,
          backdrop_path: row.backdrop_path,
          genre_ids: JSON.parse(row.genre_ids || '[]'),
          vote_average: row.vote_average,
        })),
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
