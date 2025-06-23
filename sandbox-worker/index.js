export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    try {
      // Debug endpoint - shows available environment variables
      if (pathname === '/debug') {
        return handleDebug(request, env)
      }

      // Pexels search endpoint
      if (pathname === '/' || pathname === '/search') {
        return handlePexelsSearch(request, env)
      }

      // Default response
      return new Response(
        JSON.stringify({
          message: 'Pexels API Worker - FIXED VERSION',
          endpoints: {
            '/': 'Pexels image search',
            '/search': 'Pexels image search',
            '/debug': 'Debug environment variables',
          },
          usage: {
            search: '/?query=nature&per_page=10',
            debug: '/debug',
          },
          status: 'Environment parameter properly passed ✅',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }
  },
}

async function handleDebug(request, env) {
  // CRITICAL: This function now properly receives the env parameter
  const envInfo = {
    pexels_api_key: env.PEXELS_API_KEY ? 'available' : 'missing',
    openai_api_key: env.OPENAI_API_KEY ? 'available' : 'missing',
    gemini_api_key: env.GOOGLE_GEMINI_API_KEY ? 'available' : 'missing',
    youtube_api_key: env.YOUTUBE_API_KEY ? 'available' : 'missing',
    timestamp: new Date().toISOString(),
    environment_keys: Object.keys(env || {}),
    env_object_type: typeof env,
    env_is_defined: env !== undefined,
    fix_status: 'Environment parameter properly passed to all functions ✅',
  }

  return new Response(JSON.stringify(envInfo, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function handlePexelsSearch(request, env) {
  // CRITICAL: This function now properly receives the env parameter
  const url = new URL(request.url)
  const query = url.searchParams.get('query') || url.searchParams.get('q') || 'nature'
  const perPage = url.searchParams.get('per_page') || '10'
  const page = url.searchParams.get('page') || '1'

  // Check if API key is available
  if (!env.PEXELS_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'Pexels API key not configured',
        message: 'PEXELS_API_KEY environment variable is missing',
        debug_info: {
          available_keys: Object.keys(env || {}),
          requested_query: query,
          env_type: typeof env,
          env_defined: env !== undefined,
          fix_applied: 'Environment parameter now properly passed ✅',
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }

  try {
    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`

    const response = await fetch(pexelsUrl, {
      headers: {
        Authorization: env.PEXELS_API_KEY,
      },
    })

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Pexels search failed',
        message: error.message,
        query: query,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
}
