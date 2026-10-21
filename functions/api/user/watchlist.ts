// ==============================================================================
// Cloudflare Pages Function: /api/user/watchlist
// GET: Fetch user's saved watchlist from Cloudflare D1
// POST: Upsert items to user's saved watchlist in Cloudflare D1
// DELETE: Remove item(s) from user's watchlist in Cloudflare D1
// ==============================================================================

interface Env {
  DB?: any;
  moviewatcher_db?: any;
}

const ensureTableExists = async (db: any) => {
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
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON user_watchlist(user_id, added_at DESC);`
  ).run();
};

const getTargetUserId = async (request: Request, db: any): Promise<string | null> => {
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

  return userId;
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: true, watchlist: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await ensureTableExists(db);
    const userId = await getTargetUserId(request, db);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId or authorization token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await db
      .prepare(
        `SELECT media_id as id, media_type, title, overview, poster_path, backdrop_path,
                release_date, vote_average, genre_ids, number_of_seasons, added_at
         FROM user_watchlist WHERE user_id = ?1 ORDER BY added_at DESC LIMIT 500`
      )
      .bind(userId)
      .all();

    const watchlist = (rows.results || []).map((r: any) => ({
      ...r,
      genre_ids: r.genre_ids ? JSON.parse(r.genre_ids) : [],
    }));

    return new Response(JSON.stringify({ success: true, watchlist }), {
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

    await ensureTableExists(db);

    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      item?: any;
      items?: any[];
      watchlist?: any[];
    };

    let targetUserId = await getTargetUserId(request, db) || body.userId;
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing authorization token or userId' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const itemsToSave: any[] = [];
    if (body.item) itemsToSave.push(body.item);
    if (Array.isArray(body.items)) itemsToSave.push(...body.items);
    if (Array.isArray(body.watchlist)) itemsToSave.push(...body.watchlist);

    if (itemsToSave.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure user row exists in users table
    await db.prepare(
      `INSERT INTO users (id, created_at, last_active)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET last_active = ?3`
    ).bind(targetUserId, now, now).run();

    for (const item of itemsToSave) {
      const mediaId = Number(item.id);
      if (!mediaId) continue;
      const mediaType = item.media_type || 'movie';
      const recordId = `${targetUserId}:${mediaType}:${mediaId}`;
      const gids = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);

      await db.prepare(
        `INSERT INTO user_watchlist (
          id, user_id, media_id, media_type, title, overview,
          poster_path, backdrop_path, release_date, vote_average,
          genre_ids, number_of_seasons, added_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(id) DO UPDATE SET
          title = ?5,
          overview = ?6,
          poster_path = ?7,
          backdrop_path = ?8,
          release_date = ?9,
          vote_average = ?10,
          genre_ids = ?11,
          added_at = ?13`
      ).bind(
        recordId,
        targetUserId,
        mediaId,
        mediaType,
        item.title || 'Untitled',
        item.overview || '',
        item.poster_path || null,
        item.backdrop_path || null,
        item.release_date || '',
        item.vote_average || 8.0,
        JSON.stringify(gids),
        item.number_of_seasons || 1,
        item.added_at || now
      ).run();
    }

    return new Response(JSON.stringify({ success: true, count: itemsToSave.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestDelete = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = env.moviewatcher_db || env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await ensureTableExists(db);
    const userId = await getTargetUserId(request, db);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const mediaId = url.searchParams.get('mediaId');
    const clearAll = url.searchParams.get('clear') === 'true';

    if (clearAll) {
      await db.prepare('DELETE FROM user_watchlist WHERE user_id = ?1').bind(userId).run();
    } else if (mediaId) {
      await db.prepare('DELETE FROM user_watchlist WHERE user_id = ?1 AND media_id = ?2').bind(userId, Number(mediaId)).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
