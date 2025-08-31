export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" parameter', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Validate the target URL
      const target = new URL(targetUrl);

      // Security: Only allow Google Earth and related Google image domains
      const allowedHosts = [
        'www.google.com',
        'google.com',
        'earth.google.com',
        'earth.usercontent.google.com', // This was missing!
        'kh.google.com',
        'kh.googleusercontent.com',
        'lh3.googleusercontent.com',
        'lh4.googleusercontent.com',
        'lh5.googleusercontent.com',
        'lh6.googleusercontent.com',
        'lh7.googleusercontent.com',
        'usercontent.google.com', // General Google user content
        'googleusercontent.com'  // General Google user content
      ];

      if (!allowedHosts.includes(target.hostname)) {
        return new Response('URL not allowed', {
          status: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Fetch the image
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://earth.google.com/',
        },
      });

      if (!response.ok) {
        return new Response(`Failed to fetch image: ${response.status}`, {
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Get the content type
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';

      // Create a new response with CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Content-Type': contentType,
          'Cache-Control': `public, max-age=${env.CACHE_TTL || 86400}`,
        },
      });

      return newResponse;

    } catch (error) {
      console.error('Error proxying image:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
