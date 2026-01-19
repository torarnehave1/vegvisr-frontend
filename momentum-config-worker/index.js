const CONFIG_KEY = 'momentum-config'
const DEFAULT_CONFIG = {
  videoId: 'LbeFGLfFygs',
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (origin === 'https://vegvisr.org') return true
  return origin.endsWith('.vegvisr.org')
}

function withCors(request, response) {
  const origin = request.headers.get('Origin') || ''
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')
  return response
}

async function getConfig(env) {
  const stored = await env.MOMENTUM_CONFIG.get(CONFIG_KEY, { type: 'json' })
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_CONFIG }
  }
  return {
    ...DEFAULT_CONFIG,
    ...stored,
  }
}

async function saveConfig(env, nextConfig) {
  await env.MOMENTUM_CONFIG.put(CONFIG_KEY, JSON.stringify(nextConfig))
}

async function fetchSession(request, env) {
  const cookie = request.headers.get('cookie') || ''
  if (!cookie) return null
  const response = await env.AUTH_WORKER.fetch('https://auth.vegvisr.org/auth/openauth/session', {
    method: 'GET',
    headers: {
      cookie,
    },
  })
  if (!response.ok) return null
  const data = await response.json()
  if (!data?.success || !data?.subject) return null
  return data.subject
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return withCors(request, new Response(null, { status: 204 }))
    }

    if (pathname === '/config' && request.method === 'GET') {
      const config = await getConfig(env)
      return withCors(request, jsonResponse({ success: true, config }))
    }

    if (pathname === '/health' && request.method === 'GET') {
      return withCors(
        request,
        jsonResponse({
          ok: true,
          service: 'momentum-config-worker',
          timestamp: new Date().toISOString(),
        }),
      )
    }

    if (pathname === '/config' && request.method === 'POST') {
      const session = await fetchSession(request, env)
      if (!session || session.role !== 'Superadmin') {
        return withCors(request, jsonResponse({ success: false, error: 'Unauthorized' }, 401))
      }

      let payload = null
      try {
        payload = await request.json()
      } catch {
        return withCors(request, jsonResponse({ success: false, error: 'Invalid JSON' }, 400))
      }

      const videoId = typeof payload?.videoId === 'string' ? payload.videoId.trim() : ''
      if (!videoId) {
        return withCors(request, jsonResponse({ success: false, error: 'videoId is required' }, 400))
      }

      const nextConfig = {
        videoId,
        updatedAt: new Date().toISOString(),
      }

      await saveConfig(env, nextConfig)
      return withCors(request, jsonResponse({ success: true, config: nextConfig }))
    }

    return withCors(request, jsonResponse({ success: false, error: 'Not found' }, 404))
  },
}
