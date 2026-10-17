// ==============================================================================
// Authentication Helpers for Cloudflare Pages Functions
// Uses Native Web Crypto API (supported natively in Workers & Browsers)
// ==============================================================================

export interface Env {
  DB?: any;
  moviewatcher_db?: any;
}

export const getDb = (env: Env) => {
  return env.moviewatcher_db || env.DB;
};

/**
 * Hashes a plaintext password with a random 16-byte cryptographic salt.
 * Returns `${saltHex}:${hashHex}`
 */
export async function hashPassword(password: string): Promise<string> {
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

/**
 * Verifies a plaintext password against a stored `${saltHex}:${hashHex}`.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
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

/**
 * Generates a cryptographically secure random session token.
 */
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Standard JSON response helper with CORS headers
 */
export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
