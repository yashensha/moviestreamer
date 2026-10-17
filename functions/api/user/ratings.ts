// ==============================================================================
// Cloudflare Pages Function: /api/user/ratings
// GET: Fetch user ratings and Letterboxd seeds
// POST: Upsert ratings and sync to taste matrix in Cloudflare D1
// ==============================================================================

interface Env {
  DB?: any;
  moviewatcher_db?: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: true, ratings: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    let userId = url.searchParams.get('userId');

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const session = await db
        .prepare('SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > ?2')
        .bind(token, Date.now())
        .first<{ user_id: string }>();
      if (session?.user_id) {
        userId = session.user_id;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId or authorization token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await db
      .prepare(
        `SELECT media_id as id, media_type as type, title, rating, confidence_weight as confidenceWeight,
                source, poster_path, backdrop_path, release_date, vote_average, genre_ids, rated_at as ratedAt
         FROM user_ratings WHERE user_id = ?1 ORDER BY rated_at DESC LIMIT 500`
      )
      .bind(userId)
      .all();

    const ratings = (rows.results || []).map((r: any) => ({
      ...r,
      genre_ids: r.genre_ids ? JSON.parse(r.genre_ids) : [],
    }));

    return new Response(JSON.stringify({ success: true, ratings }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: true, message: 'D1 binding not detected; running in mock mode.' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json()) as {
      userId?: string;
      ratings: any[];
      syncToHistory?: boolean;
    };

    const { ratings = [], syncToHistory = true } = body;
    let targetUserId = body.userId;

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const session = await db
        .prepare('SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > ?2')
        .bind(token, Date.now())
        .first<{ user_id: string }>();
      if (session?.user_id) {
        targetUserId = session.user_id;
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing user authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();

    // Batch upsert ratings into user_ratings
    for (const r of ratings) {
      const id = `${targetUserId}:${r.type || 'movie'}:${r.id}`;
      const genreIdsJson = JSON.stringify(r.genre_ids || []);
      const ratedAt = r.ratedAt || now;

      await db
        .prepare(
          `INSERT INTO user_ratings (
            id, user_id, media_id, media_type, title, rating, confidence_weight, source,
            poster_path, backdrop_path, release_date, vote_average, genre_ids, rated_at, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
          ON CONFLICT(id) DO UPDATE SET
            rating = excluded.rating,
            confidence_weight = excluded.confidence_weight,
            rated_at = excluded.rated_at`
        )
        .bind(
          id,
          targetUserId,
          r.id,
          r.type || 'movie',
          r.title,
          r.rating ?? null,
          r.confidenceWeight ?? 1.0,
          r.source || 'letterboxd',
          r.poster_path ?? null,
          r.backdrop_path ?? null,
          r.release_date ?? null,
          r.vote_average ?? null,
          genreIdsJson,
          ratedAt,
          now
        )
        .run();

      // If syncToHistory is true, also register in watch_history
      if (syncToHistory) {
        const historyId = `${targetUserId}:${r.type || 'movie'}:${r.id}`;
        await db
          .prepare(
            `INSERT INTO watch_history (
              id, user_id, media_id, media_type, title, poster_path, backdrop_path,
              release_date, vote_average, progress_seconds, duration_seconds, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 7200, 7200, ?10)
            ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
          )
          .bind(
            historyId,
            targetUserId,
            r.id,
            r.type || 'movie',
            r.title,
            r.poster_path ?? null,
            r.backdrop_path ?? null,
            r.release_date ?? null,
            r.vote_average ?? null,
            ratedAt
          )
          .run();

        // If highly rated (>= 4.0), also add to liked_titles
        if (r.rating && r.rating >= 4.0) {
          const likeId = `${targetUserId}:${r.id}`;
          await db
            .prepare(
              `INSERT INTO liked_titles (
                id, user_id, media_id, media_type, title, poster_path, backdrop_path,
                genre_ids, vote_average, liked_at
              ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
              ON CONFLICT(id) DO UPDATE SET liked_at = excluded.liked_at`
            )
            .bind(
              likeId,
              targetUserId,
              r.id,
              r.type || 'movie',
              r.title,
              r.poster_path ?? null,
              r.backdrop_path ?? null,
              genreIdsJson,
              r.vote_average ?? null,
              ratedAt
            )
            .run();
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: ratings.length,
        message: `Successfully processed ${ratings.length} ratings.`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
