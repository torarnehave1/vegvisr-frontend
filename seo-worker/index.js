/**
 * SEO Worker - Static Page Generator
 *
 * This Cloudflare Worker generates static HTML pages for knowledge graphs
 * with proper Open Graph tags for Facebook sharing and SEO meta tags for Google indexing.
 *
 * Features:
 * - Detects crawlers (Facebook, Google, Twitter, etc.)
 * - Generates SEO-optimized HTML with meta tags
 * - Stores static pages in KV storage
 * - Serves different content to crawlers vs. users
 * - Supports custom domains via branding
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Token, Authorization',
    }

    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      })
    }

    // Route: Generate static page (POST)
    if (pathname === '/generate' && request.method === 'POST') {
      return handleGenerate(request, env, corsHeaders)
    }

    // Route: Serve static page (GET /graph/{slug})
    if (pathname.startsWith('/graph/')) {
      return handleGraphPage(request, env, url, corsHeaders)
    }

    // Route: Album share page (GET /album/{name} or /album?name=)
    if (pathname.startsWith('/album')) {
      return handleAlbumPage(request, env, url, corsHeaders)
    }

    // Route: Health check
    if (pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'seo-worker' }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}

/**
 * Generate and store a static page
 */
async function handleGenerate(request, env, corsHeaders) {
  try {
    const data = await request.json()
    const {
      graphId,
      slug,
      title,
      description,
      ogImage,
      keywords,
      graphData,
      createdByApp,
    } = data

    // Detect origin domain from request headers (for reverse proxy support)
    // Priority: x-forwarded-host > origin header > default
    const requestHeaders = request.headers
    let originDomain = 'www.vegvisr.org' // Default fallback

    const xForwardedHost = requestHeaders.get('x-forwarded-host')
    const originHeader = requestHeaders.get('origin')
    const refererHeader = requestHeaders.get('referer')

    if (xForwardedHost) {
      originDomain = xForwardedHost
      console.log('Using x-forwarded-host for origin:', originDomain)
    } else if (originHeader) {
      try {
        const originUrl = new URL(originHeader)
        originDomain = originUrl.hostname
        console.log('Using origin header for domain:', originDomain)
      } catch (e) {
        console.log('Could not parse origin header:', e)
      }
    } else if (refererHeader) {
      try {
        const refererUrl = new URL(refererHeader)
        originDomain = refererUrl.hostname
        console.log('Using referer header for domain:', originDomain)
      } catch (e) {
        console.log('Could not parse referer header:', e)
      }
    }

    console.log('Detected origin domain:', originDomain)

    // Validate required fields
    if (!graphId || !slug || !title || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Generate the static HTML with dynamic origin domain
    const html = generateStaticHTML({
      graphId,
      slug,
      title,
      description,
      ogImage,
      keywords,
      graphData,
      originDomain, // Pass the detected domain
    })

    // Store in KV (if env.SEO_PAGES is configured)
    console.log('Checking KV binding:', !!env.SEO_PAGES)
    if (env.SEO_PAGES) {
      try {
        const pageData = {
          graphId,
          slug,
          title,
          description,
          ogImage,
          keywords,
          html,
          createdByApp: createdByApp || 'gnew-viewer',
          createdAt: new Date().toISOString(),
        }

        console.log('Storing page data for slug:', slug)
        await env.SEO_PAGES.put(`graph:${slug}`, JSON.stringify(pageData))

        // Also store a mapping from graphId to slug
        console.log('Storing mapping for graphId:', graphId)
        await env.SEO_PAGES.put(`mapping:${graphId}`, slug)

        console.log('Successfully stored data in KV')
      } catch (kvError) {
        console.error('KV storage error:', kvError)
        // Continue execution even if KV fails
      }
    } else {
      console.log('No KV binding available - data not stored')
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: `https://seo.vegvisr.org/graph/${slug}`,
        slug,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error generating static page:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

/**
 * Serve a static page or redirect to Vue app
 * Supports explicit static modes for ingestion tools:
 * - /graph/{slug}?static=1
 * - /graph/{slug}/raw
 */
async function handleGraphPage(request, env, url, corsHeaders) {
  const pathToken = url.pathname.split('/graph/')[1] || ''
  const normalizedPath = pathToken.replace(/^\/+|\/+$/g, '')
  const isRawRoute = normalizedPath.endsWith('/raw')
  const slug = isRawRoute
    ? normalizedPath.slice(0, -4).replace(/\/+$/g, '')
    : normalizedPath

  if (!slug) {
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  }

  // Try to get the page from KV
  let pageData = null
  console.log('Looking for slug:', slug)
  console.log('KV binding available:', !!env.SEO_PAGES)

  if (env.SEO_PAGES) {
    try {
      const stored = await env.SEO_PAGES.get(`graph:${slug}`)
      console.log('KV get result for graph:' + slug + ':', stored ? 'found' : 'not found')
      if (stored) {
        pageData = JSON.parse(stored)
        console.log('Parsed page data:', { title: pageData.title, graphId: pageData.graphId })
      }
    } catch (kvError) {
      console.error('KV retrieval error:', kvError)
    }
  }

  if (!pageData) {
    console.log('No page data found for slug:', slug)
    return new Response('Page not found', { status: 404, headers: corsHeaders })
  }

  const userAgent = request.headers.get('User-Agent') || ''
  console.log('User-Agent:', userAgent)

  // Detect if this is a crawler
  const isCrawler = detectCrawler(userAgent)
  const forceStatic = ['1', 'true', 'yes'].includes((url.searchParams.get('static') || '').toLowerCase())
  const shouldServeStatic = isCrawler || forceStatic || isRawRoute
  console.log('Is crawler:', isCrawler)
  console.log('Force static mode:', forceStatic)
  console.log('Raw route mode:', isRawRoute)

  if (isRawRoute) {
    console.log('Serving raw route with full graph HTML')

    // Regenerate from live graph data so /raw always reflects the latest nodes.
    if (pageData.graphId) {
      try {
        const liveGraphData = await fetchLiveGraphData(pageData.graphId)
        if (liveGraphData) {
          const liveNodeCount = Array.isArray(liveGraphData.nodes) ? liveGraphData.nodes.length : 0
          const rawHtml = generateStaticHTML({
            graphId: pageData.graphId,
            slug: pageData.slug || slug,
            title: pageData.title,
            description: pageData.description,
            ogImage: pageData.ogImage,
            keywords: pageData.keywords,
            graphData: liveGraphData,
            originDomain: url.hostname,
            maxNodes: Number.POSITIVE_INFINITY,
            maxNodeInfoLength: null,
            includeHiddenNodes: true,
          })

          return new Response(rawHtml, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'x-seo-raw-source': 'live-graph',
              'x-seo-raw-node-count': String(liveNodeCount),
            },
          })
        }
      } catch (error) {
        console.error('Failed to regenerate raw HTML from live graph:', error)
      }
    }

    // Fallback to stored static page if live regeneration fails.
    return new Response(pageData.html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'x-seo-raw-source': 'kv-fallback',
      },
    })
  }

  if (shouldServeStatic) {
    console.log('Serving static HTML')
    // Serve the static HTML to crawlers
    return new Response(pageData.html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } else {
    console.log('Redirecting regular user to app')
    // Redirect based on which app created the page
    let redirectUrl
    const createdByApp = pageData.createdByApp || 'gnew-viewer'
    console.log('Page created by:', createdByApp)

    if (createdByApp === 'knowledge-editor') {
      // Knowledge-Editor: redirect to view-only mode
      redirectUrl = `https://editor.vegvisr.org/view?graphId=${pageData.graphId}`
    } else {
      // GNewViewer or other: redirect to GNewViewer
      let appDomain = 'www.vegvisr.org'
      if (url.hostname.includes('universi.no')) {
        appDomain = 'universi.no'
      }
      redirectUrl = `https://${appDomain}/gnew-viewer?graphId=${pageData.graphId}`
    }

    console.log('Redirect URL:', redirectUrl)
    return Response.redirect(redirectUrl, 302)
  }
}

async function fetchLiveGraphData(graphId) {
  const endpoint = `https://knowledge.vegvisr.org/getknowgraph?id=${encodeURIComponent(graphId)}`
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Failed to fetch graph ${graphId}: ${response.status}`)
  }

  const graphData = await response.json()
  return graphData && Array.isArray(graphData.nodes) ? graphData : null
}

async function handleAlbumPage(request, _env, url, corsHeaders) {
  const pathToken = url.pathname.startsWith('/album/')
    ? url.pathname.slice('/album/'.length)
    : ''
  const albumName = decodeURIComponent(url.searchParams.get('name') || '').trim()
  const shareId = decodeURIComponent(pathToken || url.searchParams.get('share') || '').trim()

  if (!albumName && !shareId) {
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  }

  let album = null
  if (_env?.PHOTO_ALBUMS) {
    const list = await _env.PHOTO_ALBUMS.list({ prefix: 'album:' })
    for (const entry of list.keys) {
      const stored = await _env.PHOTO_ALBUMS.get(entry.name)
      if (!stored) continue
      try {
        const parsed = JSON.parse(stored)
        if (shareId && parsed?.shareId === shareId) {
          album = parsed
          break
        }
        if (!shareId && albumName && parsed?.name === albumName) {
          album = parsed
          break
        }
      } catch {
        // ignore
      }
    }
  }

  if (!album) {
    return new Response('Album not found', { status: 404, headers: corsHeaders })
  }

  if (!album?.isShared) {
    return new Response('Album not shared', { status: 404, headers: corsHeaders })
  }
  const images = Array.isArray(album?.images) ? album.images : []
  const coverKey = album?.seoImageKey || images[0] || ''
  const baseUrl = 'https://vegvisr.imgix.net/'
  const coverUrl = coverKey
    ? `${baseUrl}${coverKey}?w=1200&h=630&fit=crop&auto=compress,format&q=80`
    : `${baseUrl}default-og-image.jpg?w=1200&h=630&fit=crop&auto=compress,format&q=80`

  const resolvedName = album?.name || albumName
  const title = album?.seoTitle || `Album: ${resolvedName}`
  const description =
    album?.seoDescription || `${images.length} photo${images.length === 1 ? '' : 's'}`
  const resolvedShareId = shareId || album?.shareId || ''
  const shareUrl = resolvedShareId
    ? `https://seo.vegvisr.org/album/${encodeURIComponent(resolvedShareId)}`
    : `https://seo.vegvisr.org/album/${encodeURIComponent(resolvedName)}`

  const userAgent = request.headers.get('User-Agent') || ''
  const isCrawler = detectCrawler(userAgent)

  if (isCrawler) {
    const html = generateAlbumHTML({
      title,
      description,
      albumName: resolvedName,
      coverUrl,
      shareUrl,
      imageCount: images.length,
    })
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  const redirectUrl = resolvedShareId
    ? `https://photos.vegvisr.org/share/${encodeURIComponent(resolvedShareId)}`
    : `https://photos.vegvisr.org/share/${encodeURIComponent(resolvedName)}`
  return Response.redirect(redirectUrl, 302)
}

/**
 * Detect if the request is from a crawler
 */
function detectCrawler(userAgent) {
  const crawlerPatterns = [
    'NotebookLM',
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Slackbot',
    'WhatsApp',
    'Googlebot',
    'Bingbot',
    'Slurp', // Yahoo
    'DuckDuckBot',
    'Baiduspider',
    'YandexBot',
    'crawler',
    'spider',
    'bot',
  ]

  const lowerUA = userAgent.toLowerCase()
  return crawlerPatterns.some(pattern => lowerUA.includes(pattern.toLowerCase()))
}

/**
 * Generate static HTML with SEO and Open Graph tags
 */
function generateStaticHTML(options) {
  const {
    graphId,
    slug,
    title,
    description,
    ogImage,
    keywords,
    graphData,
    originDomain = 'www.vegvisr.org', // Default fallback
    maxNodes = Number.POSITIVE_INFINITY,
    maxNodeInfoLength = null,
    includeHiddenNodes = false,
  } = options

  // Always use seo.vegvisr.org for the canonical graph URL
  // The originDomain is only used for branding/siteName
  const url = `https://seo.vegvisr.org/graph/${slug}`
  const siteName = originDomain === 'www.universi.no' || originDomain === 'universi.no'
    ? 'Universi'
    : 'Vegvisr Org'
  const defaultImage = 'https://vegvisr.imgix.net/default-og-image.jpg?w=1200&h=630&fit=crop&auto=compress,format'

  // Facebook requires minimum 200x200px, recommends 1200x630px for optimal display

  // Ensure we always have a valid, accessible image URL with proper dimensions for Facebook
  let imageUrl = defaultImage
  if (ogImage && ogImage.startsWith('http')) {
    if (ogImage.includes('vegvisr.imgix.net')) {
      // For imgix URLs, extract the base URL and apply proper OG dimensions
      const baseUrl = ogImage.split('?')[0] // Remove existing parameters
      imageUrl = `${baseUrl}?w=1200&h=630&fit=crop&auto=compress,format&q=80`
    } else {
      // For non-imgix URLs, use as-is but warn that dimensions might not be optimal
      imageUrl = ogImage
    }
  }

  // Extract some content from graph data for the page body
  const nodes = graphData?.nodes || []
  let contentHTML = ''

  // Generate HTML content from nodes
  const nodesToRender = Number.isFinite(maxNodes) ? nodes.slice(0, maxNodes) : nodes
  nodesToRender.forEach(node => {
    if (includeHiddenNodes || node.visible !== false) {
      const nodeTitle = escapeHtml(node.label || '')
      const escapedInfo = escapeHtml(node.info || '')
      const nodeInfo = typeof maxNodeInfoLength === 'number'
        ? escapedInfo.substring(0, maxNodeInfoLength)
        : escapedInfo

      contentHTML += `
        <section class="graph-node">
          <h2>${nodeTitle}</h2>
          <p>${nodeInfo}</p>
        </section>
      `
    }
  })

  const createdBy = graphData?.metadata?.createdBy || 'Unknown'
  const createdDate = graphData?.metadata?.createdAt || new Date().toISOString()

  // JSON-LD structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "image": imageUrl,
    "datePublished": createdDate,
    "author": {
      "@type": "Person",
      "name": createdBy
    },
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.vegvisr.org/favicon.ico"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)} | ${siteName}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  ${keywords ? `<meta name="keywords" content="${escapeHtml(keywords)}">` : ''}
  <meta name="author" content="${escapeHtml(createdBy)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)} - ${siteName}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  <meta property="fb:app_id" content="1234567890123456">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(title)} - ${siteName}">

  <!-- LinkedIn -->

  <!-- Canonical URL -->
  <link rel="canonical" href="${url}">

  <!-- Structured Data -->
  <script type="application/ld+json">
  ${JSON.stringify(structuredData, null, 2)}
  </script>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #2c3e50;
      background: #f8f9fa;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    header {
      border-bottom: 3px solid #667eea;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
      font-weight: 700;
    }

    .meta-info {
      display: flex;
      gap: 1.5rem;
      color: #6c757d;
      font-size: 0.95rem;
    }

    .description {
      font-size: 1.125rem;
      color: #495057;
      line-height: 1.8;
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      border-radius: 6px;
    }

    .graph-content {
      margin-top: 2rem;
    }

    .graph-node {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .graph-node h2 {
      font-size: 1.5rem;
      color: #2c3e50;
      margin-bottom: 1rem;
      font-weight: 600;
    }

    .graph-node p {
      color: #495057;
      line-height: 1.7;
    }

    .cta-section {
      margin-top: 3rem;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      text-align: center;
      color: white;
    }

    .cta-section h3 {
      margin-bottom: 1rem;
      font-size: 1.75rem;
    }

    .cta-button {
      display: inline-block;
      padding: 1rem 2rem;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
      margin-top: 1rem;
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #dee2e6;
      text-align: center;
      color: #6c757d;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      body {
        padding: 1rem 0.5rem;
      }

      .container {
        padding: 1.5rem;
      }

      h1 {
        font-size: 1.75rem;
      }

      .meta-info {
        flex-direction: column;
        gap: 0.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta-info">
        <span>📝 By ${escapeHtml(createdBy)}</span>
        <span>📅 ${formatDate(createdDate)}</span>
        <span>🔗 Knowledge Graph</span>
      </div>
    </header>

    <div class="description">
      ${escapeHtml(description)}
    </div>

    ${contentHTML ? `
    <div class="graph-content">
      <h2 style="margin-bottom: 1.5rem; color: #2c3e50;">Content Overview</h2>
      ${contentHTML}
      ${nodes.length > 5 ? `<p style="color: #6c757d; font-style: italic; margin-top: 1rem;">+ ${nodes.length - 5} more nodes in the interactive version...</p>` : ''}
    </div>
    ` : ''}

    <div class="cta-section">
      <h3>🎯 Explore the Interactive Knowledge Graph</h3>
      <p>This is a static preview for search engines and social media. View the full interactive version with all features, visualizations, and connections.</p>
      <a href="https://${originDomain}/gnew-viewer?graphId=${graphId}" class="cta-button">
        View Interactive Graph →
      </a>
    </div>

    <footer>
      <p>Powered by <strong>${siteName}</strong> - Visual Knowledge Management</p>
      <p style="margin-top: 0.5rem;">
        <a href="https://${originDomain}" style="color: #667eea; text-decoration: none;">Home</a> •
        <a href="https://${originDomain}/about" style="color: #667eea; text-decoration: none;">About</a>
      </p>
    </footer>
  </div>
</body>
</html>`
}

function generateAlbumHTML(options) {
  const {
    title,
    description,
    albumName,
    coverUrl,
    shareUrl,
    imageCount,
  } = options

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Vegvisr Photos</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">

  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${coverUrl}">
  <meta property="og:image:secure_url" content="${coverUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(title)} - Vegvisr Photos">
  <meta property="og:site_name" content="Vegvisr Photos">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${shareUrl}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${coverUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(title)} - Vegvisr Photos">

  <link rel="canonical" href="${shareUrl}">

  <style>
    body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; margin: 0; padding: 24px; background: #0b1220; color: #fff; }
    .wrap { max-width: 960px; margin: 0 auto; background: #111827; padding: 24px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0 0 16px; color: rgba(255,255,255,0.7); }
    img { width: 100%; border-radius: 14px; display: block; }
    .meta { margin-top: 12px; font-size: 14px; color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <img src="${coverUrl}" alt="${escapeHtml(title)} cover">
    <div class="meta">Album: ${escapeHtml(albumName)} · ${imageCount} photos</div>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return 'Unknown date'
  }
}
