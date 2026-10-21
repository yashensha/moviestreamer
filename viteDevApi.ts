import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface User {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  createdAt: number;
  lastActive: number;
}

interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface DevDatabase {
  users: User[];
  sessions: Session[];
  watchHistory: Record<string, any[]>;
  likedMedia: Record<string, any[]>;
  userRatings: Record<string, any[]>;
  watchlist: Record<string, any[]>;
  tmdbCache: Record<string, any>;
  models: Record<string, any>;
}

const DB_FILE = path.resolve(process.cwd(), '.dev-db.json');

function loadDb(): DevDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        users: parsed.users || [],
        sessions: parsed.sessions || [],
        watchHistory: parsed.watchHistory || {},
        likedMedia: parsed.likedMedia || {},
        userRatings: parsed.userRatings || {},
        watchlist: parsed.watchlist || {},
        tmdbCache: parsed.tmdbCache || {},
        models: parsed.models || {},
      };
    }
  } catch (err) {
    console.warn('[vite-dev-api] Error reading .dev-db.json, reinitializing:', err);
  }

  const initial: DevDatabase = {
    users: [],
    sessions: [],
    watchHistory: {},
    likedMedia: {},
    userRatings: {},
    watchlist: {},
    tmdbCache: {},
    models: {},
  };
  saveDb(initial);
  return initial;
}

function saveDb(db: DevDatabase): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[vite-dev-api] Failed to save database to .dev-db.json:', err);
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, originalHash] = parts;

  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === originalHash;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ServerResponse, data: any, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(data));
}

export function viteDevApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api/')) {
          return next();
        }

        const url = new URL(urlStr, 'http://localhost');
        const pathname = url.pathname;
        const method = req.method?.toUpperCase();

        if (method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end();
          return;
        }

        const db = loadDb();

        // 1. POST /api/auth/register
        if (pathname === '/api/auth/register' && method === 'POST') {
          const body = await parseJsonBody(req);
          const email = body.email?.trim().toLowerCase();
          const password = body.password;
          const name = body.name?.trim() || email?.split('@')[0] || 'Movie Fan';

          if (!email || !email.includes('@')) {
            return sendJson(res, { success: false, error: 'Please enter a valid email address.' }, 400);
          }
          if (!password || password.length < 6) {
            return sendJson(res, { success: false, error: 'Password must be at least 6 characters long.' }, 400);
          }

          const existing = db.users.find((u) => u.email === email);
          if (existing) {
            return sendJson(res, { success: false, error: 'An account with this email already exists.' }, 409);
          }

          const userId = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
          const hash = await hashPassword(password);
          const now = Date.now();
          const newUser: User = {
            id: userId,
            email,
            password_hash: hash,
            name,
            createdAt: now,
            lastActive: now,
          };
          db.users.push(newUser);

          const token = generateToken();
          db.sessions.push({
            token,
            userId,
            createdAt: now,
            expiresAt: now + 30 * 24 * 60 * 60 * 1000,
          });

          saveDb(db);
          return sendJson(
            res,
            {
              success: true,
              token,
              user: {
                id: userId,
                email,
                name,
              },
            },
            201
          );
        }

        // 2. POST /api/auth/login
        if (pathname === '/api/auth/login' && method === 'POST') {
          const body = await parseJsonBody(req);
          const email = body.email?.trim().toLowerCase();
          const password = body.password;

          if (!email || !password) {
            return sendJson(res, { success: false, error: 'Please provide both email and password.' }, 400);
          }

          const user = db.users.find((u) => u.email === email);

          // If no user exists, do NOT auto-create! User must sign up!
          if (!user) {
            return sendJson(
              res,
              { success: false, error: 'Account not found. Please click "Sign up now" below to create an account.' },
              404
            );
          }

          const isValid = await verifyPassword(password, user.password_hash);
          if (!isValid) {
            return sendJson(
              res,
              { success: false, error: 'Invalid password. Please check your credentials.' },
              401
            );
          }

          const now = Date.now();
          user.lastActive = now;

          const token = generateToken();
          db.sessions.push({
            token,
            userId: user.id,
            createdAt: now,
            expiresAt: now + 30 * 24 * 60 * 60 * 1000,
          });

          saveDb(db);

          return sendJson(res, {
            success: true,
            token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            watchHistory: db.watchHistory[user.id] || [],
            likedMedia: db.likedMedia[user.id] || [],
            ratings: db.userRatings[user.id] || [],
            watchlist: db.watchlist[user.id] || [],
          });
        }

        // 3. GET /api/auth/me
        if (pathname === '/api/auth/me' && method === 'GET') {
          const authHeader = req.headers.authorization || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();

          if (!token) {
            return sendJson(res, { success: false, error: 'No authorization token provided.' }, 401);
          }

          const now = Date.now();
          const session = db.sessions.find((s) => s.token === token && s.expiresAt > now);
          if (!session) {
            return sendJson(res, { success: false, error: 'Session expired or invalid.' }, 401);
          }

          const user = db.users.find((u) => u.id === session.userId);
          if (!user) {
            return sendJson(res, { success: false, error: 'User not found.' }, 404);
          }

          return sendJson(res, {
            success: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            watchHistory: db.watchHistory[user.id] || [],
            likedMedia: db.likedMedia[user.id] || [],
            ratings: db.userRatings[user.id] || [],
            watchlist: db.watchlist[user.id] || [],
          });
        }

        // 4. POST /api/auth/logout
        if (pathname === '/api/auth/logout' && method === 'POST') {
          const authHeader = req.headers.authorization || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          if (token) {
            db.sessions = db.sessions.filter((s) => s.token !== token);
            saveDb(db);
          }
          return sendJson(res, { success: true });
        }

        // 5. POST /api/user/sync
        if (pathname === '/api/user/sync' && method === 'POST') {
          const body = await parseJsonBody(req);
          const { userId, watchHistory = [], likedMedia = [], userRatings, watchlist } = body;

          const authHeader = req.headers.authorization || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          let targetUserId = userId;
          if (token) {
            const session = db.sessions.find((s) => s.token === token);
            if (session?.userId) {
              targetUserId = session.userId;
            }
          }

          let modelResult = { version: 'v2-bm25-dev', bm25Dampener: 1.0, totalInteractions: 0, genreWeights: {} };

          if (targetUserId) {
            db.watchHistory[targetUserId] = watchHistory;
            if (Array.isArray(likedMedia)) {
              db.likedMedia[targetUserId] = likedMedia;
            }
            if (Array.isArray(userRatings)) {
              db.userRatings[targetUserId] = userRatings;
            }
            if (Array.isArray(watchlist)) {
              db.watchlist[targetUserId] = watchlist;
            }

            // Compute Unified Interaction Matrix & BM25 Weights
            const ratingsList = db.userRatings[targetUserId] || [];
            const itemMap = new Map();

            for (const item of likedMedia) {
              const gids = item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : []);
              itemMap.set(item.id, { weights: [5.0], isHardFiltered: false, genreIds: gids, isLiked: true });
            }

            for (const r of ratingsList) {
              let entry = itemMap.get(r.id);
              if (!entry) {
                entry = { weights: [], isHardFiltered: false, genreIds: r.genre_ids || [], isLiked: false };
                itemMap.set(r.id, entry);
              }
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

            const totalInteractions = itemMap.size;
            const refLength = 50;
            const b = 0.75;
            const k1 = 1.2;
            const bm25Dampener = totalInteractions > 0
              ? (k1 + 1) / (1 + k1 * (1 - b + b * (totalInteractions / refLength)))
              : 1.0;

            const genreWeights: Record<string, number> = {};
            const hardFilteredIds: number[] = [];
            const topSeeds: number[] = [];

            for (const [id, entry] of itemMap.entries()) {
              let rawWeight = 0;
              if (entry.isHardFiltered && !entry.isLiked) {
                rawWeight = 0.0;
                hardFilteredIds.push(id);
              } else {
                rawWeight = entry.weights.length > 0 ? Math.max(...entry.weights) : 1.0;
                if (rawWeight >= 3.5) topSeeds.push(id);
              }
              const normalized = rawWeight * bm25Dampener;
              if (rawWeight > 0) {
                for (const gid of entry.genreIds) {
                  const key = String(gid);
                  genreWeights[key] = (genreWeights[key] || 0) + normalized;
                }
              }
            }

            modelResult = {
              version: 'v2-bm25-unified-matrix',
              bm25Dampener: Math.round(bm25Dampener * 1000) / 1000,
              totalInteractions,
              genreWeights,
            };

            db.models[targetUserId] = {
              ...modelResult,
              hardFilteredIds,
              topSeeds: topSeeds.slice(0, 50),
              updatedAt: Date.now(),
            };

            saveDb(db);
          }

          return sendJson(res, {
            success: true,
            message: 'Synced to local dev database.',
            model: modelResult,
          });
        }

        // 6. GET /api/user/model
        if (pathname === '/api/user/model' && method === 'GET') {
          let targetUserId = url.searchParams.get('userId');
          if (!targetUserId) {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            if (token) {
              const session = db.sessions.find((s) => s.token === token);
              if (session?.userId) {
                targetUserId = session.userId;
              }
            }
          }

          const model = targetUserId && db.models[targetUserId]
            ? db.models[targetUserId]
            : { version: 'v2-bm25-dev', bm25Dampener: 1.0, totalInteractions: 0, genreWeights: {} };

          return sendJson(res, {
            success: true,
            model,
            watchHistory: targetUserId ? db.watchHistory[targetUserId] || [] : [],
            likedMedia: targetUserId ? db.likedMedia[targetUserId] || [] : [],
            userRatings: targetUserId ? db.userRatings[targetUserId] || [] : [],
          });
        }

        // 7. GET /api/user/ratings
        if (pathname === '/api/user/ratings' && method === 'GET') {
          let targetUserId = url.searchParams.get('userId');
          if (!targetUserId) {
            const authHeader = req.headers.authorization || '';
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            if (token) {
              const session = db.sessions.find((s) => s.token === token);
              if (session?.userId) {
                targetUserId = session.userId;
              }
            }
          }

          const ratings = targetUserId ? db.userRatings[targetUserId] || [] : [];
          return sendJson(res, { success: true, ratings });
        }

        // 8. POST /api/user/ratings (Letterboxd import or manual rating)
        if (pathname === '/api/user/ratings' && method === 'POST') {
          const body = await parseJsonBody(req);
          const { ratings = [], syncToHistory = true } = body;

          let targetUserId = body.userId;
          const authHeader = req.headers.authorization || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          if (token) {
            const session = db.sessions.find((s) => s.token === token);
            if (session?.userId) {
              targetUserId = session.userId;
            }
          }

          if (targetUserId) {
            const existingRatings = db.userRatings[targetUserId] || [];
            const ratingMap = new Map();
            for (const r of existingRatings) {
              ratingMap.set(`${r.type || 'movie'}:${r.id}`, r);
            }
            for (const r of ratings) {
              ratingMap.set(`${r.type || 'movie'}:${r.id}`, r);
            }
            db.userRatings[targetUserId] = Array.from(ratingMap.values());

            if (syncToHistory) {
              const existingHistory = db.watchHistory[targetUserId] || [];
              const historyMap = new Map();
              for (const h of existingHistory) {
                historyMap.set(`${h.type || 'movie'}:${h.id}`, h);
              }
              const existingLikes = db.likedMedia[targetUserId] || [];
              const likesMap = new Map();
              for (const l of existingLikes) {
                likesMap.set(l.id, l);
              }

              for (const r of ratings) {
                const historyKey = `${r.type || 'movie'}:${r.id}`;
                if (!historyMap.has(historyKey)) {
                  historyMap.set(historyKey, {
                    id: r.id,
                    type: r.type || 'movie',
                    title: r.title,
                    poster_path: r.poster_path,
                    backdrop_path: r.backdrop_path,
                    release_date: r.release_date,
                    vote_average: r.vote_average,
                    progressSeconds: 7200,
                    durationSeconds: 7200,
                    updatedAt: r.ratedAt || Date.now(),
                  });
                }

                // If rated >= 4.0, also add to liked media
                if (r.rating && r.rating >= 4.0 && !likesMap.has(r.id)) {
                  likesMap.set(r.id, {
                    id: r.id,
                    title: r.title,
                    poster_path: r.poster_path,
                    backdrop_path: r.backdrop_path,
                    release_date: r.release_date,
                    vote_average: r.vote_average,
                    media_type: r.type || 'movie',
                    genre_ids: r.genre_ids || [],
                  });
                }
              }

              db.watchHistory[targetUserId] = Array.from(historyMap.values());
              db.likedMedia[targetUserId] = Array.from(likesMap.values());
            }

            saveDb(db);
          }

          return sendJson(res, {
            success: true,
            count: ratings.length,
            message: `Successfully processed ${ratings.length} ratings.`,
          });
        }

        // 8. /api/user/watchlist (GET, POST, DELETE)
        if (pathname === '/api/user/watchlist') {
          const authHeader = req.headers.authorization || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();
          const parsedUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          let targetUserId = parsedUrl.searchParams.get('userId');

          if (token) {
            const session = db.sessions.find((s) => s.token === token);
            if (session?.userId) {
              targetUserId = session.userId;
            }
          }

          if (method === 'GET') {
            if (!targetUserId) {
              return sendJson(res, { error: 'Unauthorized or missing userId' }, 401);
            }
            return sendJson(res, {
              success: true,
              watchlist: db.watchlist[targetUserId] || [],
            });
          }

          if (method === 'POST') {
            const body = await parseJsonBody(req);
            const userForPost = targetUserId || body.userId;
            if (!userForPost) {
              return sendJson(res, { error: 'Unauthorized' }, 401);
            }

            const itemsToAdd: any[] = [];
            if (body.item) itemsToAdd.push(body.item);
            if (Array.isArray(body.items)) itemsToAdd.push(...body.items);
            if (Array.isArray(body.watchlist)) itemsToAdd.push(...body.watchlist);

            const current = db.watchlist[userForPost] || [];
            const itemMap = new Map(current.map((item: any) => [Number(item.id), item]));
            for (const item of itemsToAdd) {
              itemMap.set(Number(item.id), item);
            }
            db.watchlist[userForPost] = Array.from(itemMap.values());
            saveDb(db);

            return sendJson(res, { success: true, count: itemsToAdd.length });
          }

          if (method === 'DELETE') {
            if (!targetUserId) {
              return sendJson(res, { error: 'Unauthorized' }, 401);
            }
            const mediaId = parsedUrl.searchParams.get('mediaId');
            const clearAll = parsedUrl.searchParams.get('clear') === 'true';

            if (clearAll) {
              db.watchlist[targetUserId] = [];
            } else if (mediaId) {
              db.watchlist[targetUserId] = (db.watchlist[targetUserId] || []).filter(
                (w: any) => Number(w.id) !== Number(mediaId)
              );
            }
            saveDb(db);
            return sendJson(res, { success: true });
          }
        }

        // Unknown /api route
        return sendJson(res, { error: `Endpoint ${pathname} not found.` }, 404);
      });
    },
  };
}
