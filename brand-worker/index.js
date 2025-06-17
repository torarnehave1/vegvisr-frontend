export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // 1. Handle CORS preflight for /create-custom-domain
    if (url.pathname === '/create-custom-domain' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // 2. Handle /create-custom-domain POST directly
    if (url.pathname === '/create-custom-domain' && request.method === 'POST') {
      try {
        const { subdomain } = await request.json()
        if (!subdomain) {
          return new Response(JSON.stringify({ error: 'Subdomain is required' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }
        // Create DNS record
        const dnsResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'CNAME',
              name: subdomain,
              content: 'brand-worker.torarnehave.workers.dev',
              proxied: true,
            }),
          },
        )
        const dnsResult = await dnsResponse.json()
        const dnsSetup = {
          success: dnsResult.success,
          errors: dnsResult.errors,
        }
        // Create worker route
        const workerResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/workers/routes`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pattern: `${subdomain}.norsegong.com/*`,
              script: 'brand-worker',
            }),
          },
        )
        const workerResult = await workerResponse.json()
        const workerSetup = {
          success: workerResult.success,
          errors: workerResult.errors,
        }
        return new Response(
          JSON.stringify({
            overallSuccess: dnsSetup.success && workerSetup.success,
            dnsSetup,
            workerSetup,
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
            error: error.message,
            overallSuccess: false,
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

    // 3. Proxy all other requests
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
