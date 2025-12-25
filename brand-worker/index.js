const DASH_VALIDATE_URL = 'https://dashboard.vegvisr.org/auth/validate-token'
const WCX_ORIGIN = 'https://wcx.vegvisr.org'

const requiresExtractorAuth = (pathname) => {
  return pathname === '/api/extract-content' || pathname.startsWith('/tools/extractor')
}

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    }),
  )
}

const buildWcxTargetUrl = (url) => {
  let path = url.pathname
  if (path.startsWith('/tools/extractor')) {
    path = path.replace(/^\/tools\/extractor/, '') || '/'
  }
  return `${WCX_ORIGIN}${path}${url.search}`
}

const verifyAdminToken = async (request) => {
  const cookies = parseCookies(request.headers.get('Cookie') || '')
  const token = cookies.vegvisr_token
  if (!token) {
    return { ok: false, status: 401 }
  }

  const response = await fetch(DASH_VALIDATE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    return { ok: false, status: response.status }
  }

  const data = await response.json().catch(() => null)
  const role = data?.role || data?.user?.role || ''
  if (data?.valid && (role === 'Superadmin' || role === 'Admin')) {
    return { ok: true, role }
  }

  return { ok: false, status: 403 }
}

const proxyToWcx = async (request, url) => {
  const targetUrl = buildWcxTargetUrl(url)
  const headers = new Headers(request.headers)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'follow',
  })

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    const text = await response.text()
    const rewritten = text.replaceAll('/assets/', '/tools/extractor/assets/')

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('content-length')
    responseHeaders.delete('content-encoding')

    return new Response(rewritten, {
      status: response.status,
      headers: responseHeaders,
    })
  }

  return response
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Log the request for debugging
    console.log(`🌐 Brand worker handling request: ${url.pathname} for ${url.hostname}`)

    // Proxy all other requests
    try {
      if (requiresExtractorAuth(url.pathname)) {
        const auth = await verifyAdminToken(request)
        if (!auth.ok) {
          return new Response('Forbidden', { status: auth.status || 403 })
        }
        return proxyToWcx(request, url)
      }

      let targetUrl
      if (
        url.pathname.startsWith('/getknowgraphs') ||
        url.pathname.startsWith('/getknowgraph') ||
        url.pathname.startsWith('/saveknowgraph') ||
        url.pathname.startsWith('/updateknowgraph') ||
        url.pathname.startsWith('/deleteknowgraph') ||
        url.pathname.startsWith('/saveGraphWithHistory')
      ) {
        targetUrl =
          'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
      } else if (
        url.pathname.startsWith('/mystmkrasave') ||
        url.pathname.startsWith('/generate-header-image') ||
        url.pathname.startsWith('/grok-ask') ||
        url.pathname.startsWith('/grok-elaborate') ||
        url.pathname.startsWith('/apply-style-template')
      ) {
        targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
      } else {
        targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
      }

      const headers = new Headers(request.headers)
      headers.set('x-original-hostname', url.hostname)

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow',
      })

      // Clone the response so we can read the body
      const responseClone = response.clone()

      // Try to parse as JSON
      try {
        const jsonData = await responseClone.json()
        return new Response(JSON.stringify(jsonData), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (jsonError) {
        // If not JSON, return the original response
        console.log('Response is not JSON, returning as-is:', jsonError.message)
        const responseHeaders = Object.fromEntries(response.headers)
        // Remove any existing CORS headers to avoid duplication
        delete responseHeaders['access-control-allow-origin']

        return new Response(response.body, {
          status: response.status,
          headers: {
            ...responseHeaders,
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch (error) {
      // Return a JSON error response
      return new Response(
        JSON.stringify({
          error: true,
          message: error.message || 'Internal Server Error',
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
