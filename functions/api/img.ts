/**
 * Cloudflare Edge Image Proxy & Cache
 * 
 * Proxies TMDB images through Cloudflare CDN:
 * - Caches at edge with 30-day TTL (Cache-Control: public, max-age=2592000, immutable)
 * - Drastically reduces TTFB from ~400ms (TMDB origin) to <20ms (Cloudflare Edge)
 * - Returns proper CORS and content headers
 */

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.searchParams.get('path');
  const size = url.searchParams.get('size') || 'w780';

  if (!path) {
    return new Response('Missing image path query parameter', { status: 400 });
  }

  // Sanitize path (must start with / and only contain valid filename characters)
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!/^\/[a-zA-Z0-9_.-]+$/.test(cleanPath)) {
    return new Response('Invalid image path format', { status: 400 });
  }

  const tmdbUrl = `https://image.tmdb.org/t/p/${size}${cleanPath}`;

  // Check Cloudflare Edge Cache
  const cache = (caches as any).default;
  const cacheKey = new Request(tmdbUrl, context.request);

  try {
    let response = await cache.match(cacheKey);

    if (!response) {
      const upstream = await fetch(tmdbUrl, {
        headers: {
          'User-Agent': 'MovieWatcherEdgeCDN/1.0',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!upstream.ok) {
        return new Response('Failed to fetch upstream image', {
          status: upstream.status,
        });
      }

      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'public, max-age=2592000, immutable');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('X-Edge-Cache', 'MISS');

      response = new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });

      context.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      const headers = new Headers(response.headers);
      headers.set('X-Edge-Cache', 'HIT');
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  } catch (err) {
    // Graceful fallback to direct 302 redirect if edge cache fails
    return Response.redirect(tmdbUrl, 302);
  }
};

