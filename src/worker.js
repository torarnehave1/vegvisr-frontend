import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

const assetManifest = JSON.parse(manifestJSON)

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
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
          mapRequestToAsset: (request) => {
            const url = new URL(request.url)
            
            // Handle root path
            if (url.pathname === '/') {
              return new Request(new URL('/index.html', request.url), request)
            }
            
            // Handle static assets (with file extensions)
            if (url.pathname.match(/\.[a-zA-Z0-9]+$/)) {
              return request
            }
            
            // Handle client-side routing - fallback to index.html
            return new Request(new URL('/index.html', request.url), request)
          },
        }
      )
    } catch (e) {
      console.error('Error serving asset:', e)
      
      // Fallback to index.html for any unmatched routes (SPA routing)
      try {
        return await getAssetFromKV(
          {
            request: new Request(new URL('/index.html', request.url), request),
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
          }
        )
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
        return new Response('Not Found', { status: 404 })
      }
    }
  },
}
