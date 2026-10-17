// ==============================================================================
// Cloudflare Pages Function: POST /api/user/sync
// Syncs User Watch History & Likes to Cloudflare D1 and updates Algorithm Model
// ==============================================================================

interface Env {
  DB?: any;
  moviewatcher_db?: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;

    if (!db) {
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
      userRatings?: any[];
    };

    const { userId, watchHistory = [], likedMedia = [], userRatings = [] } = body;

    let targetUserId = userId;
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
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();

    // 1. Ensure user exists
    await db.prepare(
      `INSERT INTO users (id, created_at, last_active)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET last_active = ?3`
    ).bind(targetUserId, now, now).run();

    // 2. Persist Liked Titles in D1
    for (const item of likedMedia) {
      const gids: number[] = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
      const recordId = `${targetUserId}:${item.id}`;
      await db.prepare(
        `INSERT INTO liked_titles (id, user_id, media_id, media_type, title, poster_path, backdrop_path, genre_ids, vote_average, liked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET liked_at = ?10`
      ).bind(
        recordId,
        targetUserId,
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

    // 3. Persist Watch History in D1
    for (const item of watchHistory) {
      const recordId = `${targetUserId}:${item.type}:${item.id}`;
      await db.prepare(
        `INSERT INTO watch_history (id, user_id, media_id, media_type, title, overview, poster_path, backdrop_path, release_date, season, episode, vote_average, number_of_seasons, progress_seconds, duration_seconds, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
         ON CONFLICT(id) DO UPDATE SET season = ?10, episode = ?11, progress_seconds = ?14, duration_seconds = ?15, updated_at = ?16`
      ).bind(
        recordId,
        targetUserId,
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
        item.progressSeconds || 0,
        item.durationSeconds || 0,
        item.updatedAt || now
      ).run();
    }

    // 4. Compute Unified Interaction Matrix & Weighting Formula
    // Weights:
    // - Letterboxd 5★ or In-App Heart: 5.0
    // - Letterboxd 4★–4.5★: 4.0
    // - In-App Completed Episode/Movie: 3.5
    // - Letterboxd 3★: 2.5
    // - Started Streaming (>10m dwell): 2.0
    // - Letterboxd Watchlist: 1.5
    // - Letterboxd 1★–2★: 0.0 (Hard Filter)
    const itemMap = new Map<number, {
      weights: number[];
      isHardFiltered: boolean;
      genreIds: number[];
      isLiked: boolean;
    }>();

    // In-app Hearts
    for (const item of likedMedia) {
      const gids: number[] = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
      let entry = itemMap.get(item.id);
      if (!entry) {
        entry = { weights: [], isHardFiltered: false, genreIds: gids, isLiked: true };
        itemMap.set(item.id, entry);
      }
      entry.isLiked = true;
      entry.weights.push(5.0);
    }

    // Ratings
    for (const r of userRatings) {
      const gids: number[] = r.genre_ids || [];
      let entry = itemMap.get(r.id);
      if (!entry) {
        entry = { weights: [], isHardFiltered: false, genreIds: gids, isLiked: false };
        itemMap.set(r.id, entry);
      }
      if (entry.genreIds.length === 0 && gids.length > 0) entry.genreIds = gids;

      if (r.rating !== undefined && r.rating !== null && !isNaN(r.rating)) {
        if (r.rating <= 2.0) {
          entry.isHardFiltered = true;
          entry.weights.push(0.0);
        } else if (r.rating >= 4.75) {
          entry.weights.push(5.0);
        } else if (r.rating >= 3.75) {
          entry.weights.push(4.0);
        } else {
          entry.weights.push(2.5);
        }
      } else if (r.confidenceWeight === 1.5) {
        entry.weights.push(1.5);
      } else {
        entry.weights.push(2.5);
      }
    }

    // Watch history
    for (const h of watchHistory) {
      let entry = itemMap.get(h.id);
      if (!entry) {
        entry = { weights: [], isHardFiltered: false, genreIds: [], isLiked: false };
        itemMap.set(h.id, entry);
      }
      const progress = h.progressSeconds || 0;
      const duration = h.durationSeconds || 0;
      const isCompleted = (duration > 0 && progress / duration >= 0.85) || progress >= 7200;

      if (isCompleted) {
        entry.weights.push(3.5);
      } else if (progress >= 600) {
        entry.weights.push(2.0);
      } else {
        entry.weights.push(1.0);
      }
    }

    // 5. BM25 Normalization Calculation
    const totalInteractions = itemMap.size;
    const refLength = 50;
    const b = 0.75;
    const k1 = 1.2;
    const bm25Dampener = totalInteractions > 0
      ? (k1 + 1) / (1 + k1 * (1 - b + b * (totalInteractions / refLength)))
      : 1.0;

    const genreWeights: Record<string, number> = {};
    const hardFilteredIds: number[] = [];
    const topPositiveSeeds: number[] = [];

    for (const [id, entry] of itemMap.entries()) {
      let rawWeight = 0;
      if (entry.isHardFiltered && !entry.isLiked) {
        rawWeight = 0.0;
        hardFilteredIds.push(id);
      } else {
        rawWeight = entry.weights.length > 0 ? Math.max(...entry.weights) : 1.0;
        if (rawWeight >= 3.5) {
          topPositiveSeeds.push(id);
        }
      }

      const normalizedWeight = rawWeight * bm25Dampener;

      if (rawWeight > 0) {
        for (const gid of entry.genreIds) {
          const key = String(gid);
          genreWeights[key] = (genreWeights[key] || 0) + normalizedWeight;
        }
      }
    }

    // 6. Save Unified Algorithm Model in D1
    const featureVectorMeta = JSON.stringify({
      totalInteractions,
      bm25Dampener: Math.round(bm25Dampener * 1000) / 1000,
      topSeeds: topPositiveSeeds.slice(0, 50),
    });

    await db.prepare(
      `INSERT INTO user_algorithm_model (user_id, model_version, genre_weights, actor_weights, director_weights, feature_vector, recommendation_cache, updated_at)
       VALUES (?1, ?2, ?3, '{}', '{}', ?4, ?5, ?6)
       ON CONFLICT(user_id) DO UPDATE SET
         genre_weights = ?3,
         feature_vector = ?4,
         recommendation_cache = ?5,
         updated_at = ?6`
    ).bind(
      targetUserId,
      'v2-bm25-unified-matrix',
      JSON.stringify(genreWeights),
      featureVectorMeta,
      JSON.stringify(hardFilteredIds),
      now
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        model: {
          version: 'v2-bm25-unified-matrix',
          genreWeights,
          bm25Dampener,
          totalInteractions,
          hardFilteredCount: hardFilteredIds.length,
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
