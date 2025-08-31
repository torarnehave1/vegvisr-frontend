// Cloudflare Worker to proxy Google Earth images
// This bypasses CORS restrictions for KML images

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }
    
    // Extract the image URL from query parameter
    const imageUrl = url.searchParams.get('url')
    
    if (!imageUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    // Validate it's a Google Earth image URL for security
    if (!imageUrl.includes('earth.usercontent.google.com')) {
      return new Response('Invalid image source', { 
        status: 403,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
    
    try {
      // Fetch the image from Google Earth
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Cloudflare-Worker)',
          'Referer': 'https://earth.google.com/',
        },
      })
      
      if (!response.ok) {
        return new Response('Image not found', { 
          status: 404,
          headers: { 'Access-Control-Allow-Origin': '*' }
        })
      }
      
      // Return the image with CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      })
      
      return newResponse
      
    } catch (error) {
      return new Response('Failed to fetch image', { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
  },
}
