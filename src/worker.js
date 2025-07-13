export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const hostname = url.hostname
    console.log('Incoming request hostname:', hostname)

    // Handle API proxy routes first
    if (
      url.pathname.startsWith('/getknowgraphs') ||
      url.pathname.startsWith('/getknowgraph') ||
      url.pathname.startsWith('/saveknowgraph') ||
      url.pathname.startsWith('/updateknowgraph') ||
      url.pathname.startsWith('/deleteknowgraph')
    ) {
      // Proxy API calls to the dev-worker
      const targetUrl =
        'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
      
      const headers = new Headers(request.headers)
      headers.set('x-original-hostname', hostname)
      
      console.log('Headers being sent:', Object.fromEntries(headers.entries()))
      console.log('Target URL:', targetUrl)
      
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow',
      })
      
      return response
    }

    // Handle static file serving for the Vue.js SPA
    try {
      // Handle root path
      if (url.pathname === '/') {
        const asset = await env.ASSETS.fetch(new URL('/index.html', request.url))
        return asset
      }
      
      // Handle static assets (with file extensions)
      if (url.pathname.match(/\.[a-zA-Z0-9]+$/)) {
        const asset = await env.ASSETS.fetch(request)
        return asset
      }
      
      // Handle client-side routing - fallback to index.html
      const asset = await env.ASSETS.fetch(new URL('/index.html', request.url))
      return asset
    } catch (e) {
      console.error('Error serving asset:', e)
      
      // Fallback to index.html for any unmatched routes (SPA routing)
      try {
        const asset = await env.ASSETS.fetch(new URL('/index.html', request.url))
        return asset
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return new Response('Not Found', { status: 404 })
      }
    }
  },
}
