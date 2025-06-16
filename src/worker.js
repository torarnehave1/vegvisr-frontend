export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const hostname = url.hostname

    // Proxy all requests to vegvisr.org
    const targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search

    // Add domain-specific headers for filtering
    const headers = new Headers(request.headers)

    // Add domain-specific meta area filter
    if (hostname === 'sweet.norsegong.com') {
      headers.set('x-meta-area-filter', 'Sweet') // Replace 'Sweet' with your desired meta area
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    // Create a new response to ensure headers are preserved
    const newHeaders = new Headers(response.headers)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  },
}
