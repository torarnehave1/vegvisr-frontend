export default {
  async fetch(request) {
    const url = new URL(request.url)
    const hostname = url.hostname
    console.log('Incoming request hostname:', hostname)

    // Determine the target URL based on the path
    let targetUrl
    if (
      url.pathname.startsWith('/getknowgraphsummaries') ||
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

    // Set original hostname for KV-based filtering (no hardcoded filtering)
    headers.set('x-original-hostname', hostname)

    console.log('Headers being sent:', Object.fromEntries(headers.entries()))
    console.log('Target URL:', targetUrl)

    // Make the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    // Return the response as-is (filtering handled by KV store)
    return response
  },
}
