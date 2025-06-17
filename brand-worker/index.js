export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Handle custom domain creation
    if (url.pathname === '/create-custom-domain' && request.method === 'POST') {
      try {
        const { subdomain } = await request.json()
        if (!subdomain) {
          return new Response(JSON.stringify({ error: 'Subdomain is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
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
        if (!dnsResult.success) {
          throw new Error(`Failed to create DNS record: ${JSON.stringify(dnsResult.errors)}`)
        }

        // Add custom domain to worker
        const workerResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              hostname: `${subdomain}.norsegong.com`,
              service: 'brand-worker',
            }),
          },
        )

        const workerResult = await workerResponse.json()
        if (!workerResult.success) {
          throw new Error(
            `Failed to add custom domain to worker: ${JSON.stringify(workerResult.errors)}`,
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Domain ${subdomain}.norsegong.com has been configured`,
            dns: dnsResult,
            worker: workerResult,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error.message,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
    }

    // Handle existing proxy logic
    const hostname = url.hostname
    console.log('Incoming request hostname:', hostname)

    // Determine the target URL based on the path
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
      console.log('Routing to knowledge-graph-worker:', targetUrl)
    } else if (
      url.pathname.startsWith('/mystmkrasave') ||
      url.pathname.startsWith('/generate-header-image') ||
      url.pathname.startsWith('/grok-ask') ||
      url.pathname.startsWith('/grok-elaborate') ||
      url.pathname.startsWith('/apply-style-template') ||
      url.pathname.startsWith('/getUserData') ||
      url.pathname.startsWith('/updateUserData') ||
      url.pathname.startsWith('/uploadFile')
    ) {
      targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
      console.log('Routing to api.vegvisr.org:', targetUrl)
    } else {
      targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
      console.log('Routing to www.vegvisr.org:', targetUrl)
    }

    // Create headers for the request
    const headers = new Headers(request.headers)
    headers.set('x-original-hostname', hostname)

    console.log('Final target URL:', targetUrl)
    console.log('Original hostname preserved:', hostname)

    // Make the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    return new Response(response.body, response)
  },
}
