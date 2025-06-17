export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
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
      url.pathname.startsWith('/saveGraphWithHistory') // ADDED - Critical for saving graphs
    ) {
      // Knowledge graph operations → specialized worker
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
      // API operations → api worker
      targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
      console.log('Routing to api.vegvisr.org:', targetUrl)
    } else {
      // Everything else → main vegvisr.org
      targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
      console.log('Routing to www.vegvisr.org:', targetUrl)
    }

    // Create headers for the request
    const headers = new Headers(request.headers)

    // IMPORTANT: Pass the original hostname to the target
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
