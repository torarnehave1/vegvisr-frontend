export default {
  async fetch(request, env, ctx) {
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

    const url = new URL(request.url)

    // Handle custom domain creation
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

        const results = {
          dns: null,
          worker: null,
        }

        // STEP 1: Create DNS record
        try {
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
                name: `${subdomain}`,
                content: 'brand-worker.torarnehave.workers.dev',
                proxied: true,
              }),
            },
          )

          const dnsResult = await dnsResponse.json()
          results.dns = {
            success: dnsResult.success,
            errors: dnsResult.errors,
          }
        } catch (error) {
          results.dns = {
            success: false,
            errors: [{ message: `DNS Error: ${error.message}` }],
          }
        }

        // STEP 2: Add Worker Route (use /workers/routes for Free/Pro)
        try {
          const routePattern = `${subdomain}.norsegong.com/*`
          const workerResponse = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/workers/routes`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${env.CF_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                pattern: routePattern,
                script: 'brand-worker',
              }),
            },
          )

          const workerResult = await workerResponse.json()
          results.worker = {
            success: workerResult.success,
            errors: workerResult.errors,
          }
        } catch (error) {
          results.worker = {
            success: false,
            errors: [{ message: `Worker Route Error: ${error.message}` }],
          }
        }

        // Return detailed results
        return new Response(
          JSON.stringify({
            dnsSetup: results.dns,
            workerSetup: results.worker,
            overallSuccess: results.dns?.success && results.worker?.success,
          }),
          {
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
            details: 'Error in domain setup process',
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

    // Proxy all other requests
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

    return new Response(response.body, response)
  },
}
