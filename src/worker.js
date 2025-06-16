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
      url.pathname.startsWith('/deleteknowgraph')
    ) {
      // Proxy API calls to the dev-worker
      targetUrl =
        'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
    } else {
      // Proxy everything else to vegvisr.org
      targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
    }

    // Create headers for the request
    const headers = new Headers(request.headers)

    // Set domain-specific headers for filtering
    if (hostname === 'sweet.norsegong.com') {
      console.log('Setting NORSEGONG and NORSEMYTHOLOGY filter for sweet.norsegong.com')
      headers.set('x-meta-area-filter', 'NORSEGONG,NORSEMYTHOLOGY')
      headers.set('x-custom-meta-area-filter', 'NORSEGONG,NORSEMYTHOLOGY')
    }

    console.log('Headers being sent:', Object.fromEntries(headers.entries()))
    console.log('Target URL:', targetUrl)

    // Make the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    // Create a new response to ensure headers are preserved
    const newResponse = new Response(response.body, response)
    if (headers.has('x-meta-area-filter')) {
      newResponse.headers.set('x-meta-area-filter', headers.get('x-meta-area-filter'))
      newResponse.headers.set('x-custom-meta-area-filter', headers.get('x-custom-meta-area-filter'))
    }

    console.log('Final headers being sent:', Object.fromEntries(newResponse.headers.entries()))

    return newResponse
  },
}
