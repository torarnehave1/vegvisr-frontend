export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    try {
      // Proxy all requests
      const url = new URL(request.url)
      const hostname = url.hostname

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
      headers.set('x-original-hostname', hostname)

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
      } catch (e) {
        // If not JSON, return the original response
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers),
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
