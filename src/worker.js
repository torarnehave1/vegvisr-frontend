export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const hostname = url.hostname
    console.log('Incoming request from hostname:', hostname)

    // Proxy all requests to vegvisr.org
    const targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search

    // Add domain-specific headers for filtering
    const headers = new Headers(request.headers)

    // Add domain-specific meta area filter
    if (hostname === 'sweet.norsegong.com') {
      console.log('Setting NORSEGONG filter for sweet.norsegong.com')
      headers.set('x-meta-area-filter', 'NORSEGONG')
      console.log('Headers after setting filter:', Object.fromEntries(headers.entries()))
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    // Create a new response to ensure headers are preserved
    const newHeaders = new Headers(response.headers)
    // Copy the meta area filter to the response headers
    if (headers.has('x-meta-area-filter')) {
      newHeaders.set('x-meta-area-filter', headers.get('x-meta-area-filter'))
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}
