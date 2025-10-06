// @name proff-api-worker
// @description A Cloudflare Worker script to handle professional API endpoints
// @version 1.0
// @author Tor Arne Håve
// @license MIT

 

// Utility functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
}

// Create a standardized error response
const createErrorResponse = (message, status = 500) => {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

// Create a standardized success response
const createSuccessResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

// Handle CORS preflight requests
const handleOptions = () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

// Health check endpoint
const handleHealthCheck = () => {
  return createSuccessResponse({
    status: 'healthy',
    service: 'proff-api-worker',
    timestamp: new Date().toISOString(),
    version: '1.0',
  })
}

// Main worker export
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions()
    }

    try {
      const url = new URL(request.url)
      const pathname = url.pathname

      console.log(`🚀 [Proff API Worker] ${request.method} ${pathname}`)

      // Health check endpoint
      if (pathname === '/health' && request.method === 'GET') {
        return handleHealthCheck()
      }

      // Root endpoint - basic info
      if (pathname === '/' && request.method === 'GET') {
        return createSuccessResponse({
          service: 'proff-api-worker',
          description: 'Professional API Worker for specialized services',
          version: '1.0',
          endpoints: [
            { path: '/health', method: 'GET', description: 'Health check' },
            { path: '/', method: 'GET', description: 'Service information' },
          ],
          timestamp: new Date().toISOString(),
        })
      }

      // Fallback - log unmatched routes
      console.log('❌ No route matched, returning 404:', {
        pathname: pathname,
        method: request.method,
        availableRoutes: [
          '/health',
          '/',
        ],
      })
      return createErrorResponse('Not Found', 404)
    } catch (error) {
      console.error('❌ [Proff API Worker] Unhandled error:', error)
      return createErrorResponse('Internal Server Error', 500)
    }
  },
}