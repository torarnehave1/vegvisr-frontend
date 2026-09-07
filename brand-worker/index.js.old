export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Log the request for debugging
    console.log(`🌐 Brand worker handling request: ${url.pathname} for ${url.hostname}`)

    // Proxy all other requests
    try {
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
