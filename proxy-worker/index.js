export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Proxy /proxy-test and all static assets
    if (
      url.pathname === '/proxy-test' ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)
    ) {
      // Build the target URL on vegvisr.org
      const targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
      return fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      })
    }

    // Default response for other paths
    return new Response('Hello World!')
  },
}
