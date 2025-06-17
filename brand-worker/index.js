export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Check if request is to the root path
    if (url.pathname === '/' || url.pathname === '') {
      // Get the hostname
      const hostname = url.hostname
      // Check KV for site configuration
      const kvKey = `site-config:${hostname}`
      console.log(`Checking KV store for key: ${kvKey}`)
      try {
        const siteConfigJson = await env.SITE_CONFIGS.get(kvKey)
        console.log(
          `KV store response for ${kvKey}: ${siteConfigJson ? 'Config found' : 'No config found'}`,
        )
        if (siteConfigJson) {
          const siteConfig = JSON.parse(siteConfigJson)
          console.log(`Site config for ${hostname}:`, JSON.stringify(siteConfig, null, 2))
          if (siteConfig.branding && siteConfig.branding.mySiteFrontPage) {
            // Normalize front page path if it's just a Graph ID
            let frontPagePath = siteConfig.branding.mySiteFrontPage
            console.log(`Original front page path: ${frontPagePath}`)
            if (!frontPagePath.includes('/') && !frontPagePath.includes('?')) {
              frontPagePath = `/graph-viewer?graphId=${frontPagePath}&template=Frontpage`
              console.log(`Normalized front page path to: ${frontPagePath}`)
            }
            // Redirect to the custom front page
            console.log(`Redirecting to custom front page: ${frontPagePath}`)
            return Response.redirect(`https://${hostname}${frontPagePath}`, 302)
          } else {
            console.log(`No mySiteFrontPage defined in branding for ${hostname}`)
          }
        }
      } catch (error) {
        console.error(`Error checking KV for front page: ${error.message}`)
        // Continue with default routing if error occurs
      }
    }

    // Proxy all other requests
    try {
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
      headers.set('x-original-hostname', url.hostname)

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
        redirect: 'follow',
      })

      // Clone the response so we can read the body
      const responseClone = response.clone()

      // Try to parse as JSON
      try {
        const jsonData = await responseClone.json()
        return new Response(JSON.stringify(jsonData), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (e) {
        // If not JSON, return the original response
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers),
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    } catch (error) {
      // Return a JSON error response
      return new Response(
        JSON.stringify({
          error: true,
          message: error.message || 'Internal Server Error',
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
  },
}
