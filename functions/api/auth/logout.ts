// ==============================================================================
// Cloudflare Pages Function: POST /api/auth/logout
// Clears active session token from Cloudflare D1
// ==============================================================================

import { Env, getDb, jsonResponse } from './_utils';

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const db = getDb(env);

    if (!db) {
      return jsonResponse({ success: true });
    }

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (token) {
      await db.prepare('DELETE FROM sessions WHERE token = ?1').bind(token).run();
    }

    return jsonResponse({ success: true, message: 'Logged out successfully.' });
  } catch (error: any) {
    return jsonResponse({ error: error.message || 'Logout error' }, 500);
  }
};
