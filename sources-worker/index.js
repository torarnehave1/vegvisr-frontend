/**
 * Sources Worker - Norwegian Government & Research Sources Integration
 * 
 * Aggregates RSS feeds and provides search across Norwegian public sources:
 * - regjeringen.no (Government news, hearings, reports)
 * - stortinget.no (Parliament)
 * - miljodirektoratet.no (Environment Agency)
 * - forskningsradet.no (Research Council)
 * 
 * Endpoints:
 * - GET /feeds - List available RSS feeds
 * - GET /feed/:source - Get parsed RSS feed
 * - GET /search - Search across all sources
 * - GET /hearings - Get open hearings (høringer)
 * - GET /api/tools - AI function calling definitions
 * - GET /health - Health check
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, x-user-email, x-user-id',
  'Content-Type': 'application/json'
}

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders
  })
}

/**
 * Norwegian source definitions with RSS feed URLs
 * Updated December 2025 with verified working feeds
 * Includes SVG logos for visual attribution
 */
const NORWEGIAN_SOURCES = {
  // Regjeringen.no - Norwegian Government (VERIFIED WORKING)
  regjeringen: {
    name: 'Regjeringen',
    shortName: 'REG',
    description: 'Norges regjering - nyheter, høringer, dokumenter',
    baseUrl: 'https://www.regjeringen.no',
    color: '#C8102E', // Norwegian red
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#C8102E"/><path d="M10 12h20v2H10zM10 19h20v2H10zM10 26h14v2H10z" fill="white"/><circle cx="30" cy="27" r="4" fill="white"/></svg>`,
    feeds: {
      news: 'https://www.regjeringen.no/no/rss/Rss/2581966/'
    },
    categories: ['government', 'policy', 'hearings', 'news']
  },
  
  // SSB - Statistics Norway (VERIFIED WORKING)
  ssb: {
    name: 'Statistisk sentralbyrå',
    shortName: 'SSB',
    description: 'Norges statistikkmyndighet - statistikk og data',
    baseUrl: 'https://www.ssb.no',
    color: '#00205B', // SSB blue
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#00205B"/><text x="20" y="26" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">SSB</text></svg>`,
    feeds: {
      news: 'https://www.ssb.no/rss',
      environment: 'https://www.ssb.no/natur-og-miljo/rss',
      economy: 'https://www.ssb.no/nasjonalregnskap-og-konjunkturer/rss',
      population: 'https://www.ssb.no/befolkning/rss'
    },
    categories: ['statistics', 'data', 'research', 'economy']
  },
  
  // NRK - Norwegian Broadcasting (VERIFIED WORKING)
  nrk: {
    name: 'NRK',
    shortName: 'NRK',
    description: 'Norsk rikskringkasting - nyheter og aktualitet',
    baseUrl: 'https://www.nrk.no',
    color: '#26292A', // NRK dark
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#26292A"/><text x="20" y="26" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">NRK</text></svg>`,
    feeds: {
      news: 'https://www.nrk.no/toppsaker.rss',
      science: 'https://www.nrk.no/viten/toppsaker.rss',
      nature: 'https://www.nrk.no/klima/toppsaker.rss'
    },
    categories: ['news', 'science', 'climate']
  },
  
  // Forskning.no - Science news (likely working)
  forskning: {
    name: 'Forskning.no',
    shortName: 'F.no',
    description: 'Norges største nettavis for forskning og vitenskap',
    baseUrl: 'https://forskning.no',
    color: '#E31B23', // Forskning red
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#E31B23"/><circle cx="20" cy="16" r="6" fill="white"/><path d="M17 22h6v10h-6z" fill="white"/><circle cx="14" cy="28" r="3" fill="white"/><circle cx="26" cy="28" r="3" fill="white"/></svg>`,
    feeds: {
      news: 'https://forskning.no/rss',
      environment: 'https://forskning.no/miljo/rss',
      health: 'https://forskning.no/medisin-og-helse/rss'
    },
    categories: ['research', 'science', 'health', 'environment']
  },
  
  // Naturvernforbundet - Nature conservation
  naturvern: {
    name: 'Naturvernforbundet',
    shortName: 'NVF',
    description: 'Norges eldste natur- og miljøvernorganisasjon',
    baseUrl: 'https://naturvernforbundet.no',
    color: '#228B22', // Forest green
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#228B22"/><path d="M20 8l10 14H10L20 8z" fill="white"/><rect x="17" y="22" width="6" height="10" fill="white"/></svg>`,
    feeds: {
      news: 'https://naturvernforbundet.no/feed/'
    },
    categories: ['environment', 'nature', 'activism']
  },
  
  // Sabima - Biodiversity alliance
  sabima: {
    name: 'SABIMA',
    shortName: 'SAB',
    description: 'Samarbeidsrådet for biologisk mangfold',
    baseUrl: 'https://sabima.no',
    color: '#4CAF50', // Green
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#4CAF50"/><circle cx="14" cy="14" r="4" fill="white"/><circle cx="26" cy="14" r="4" fill="white"/><circle cx="20" cy="24" r="5" fill="white"/><circle cx="12" cy="28" r="3" fill="white"/><circle cx="28" cy="28" r="3" fill="white"/></svg>`,
    feeds: {
      news: 'https://sabima.no/feed/'
    },
    categories: ['biodiversity', 'nature', 'policy']
  },
  
  // WWF Norway
  wwf: {
    name: 'WWF Norge',
    shortName: 'WWF',
    description: 'Verdens naturfond - naturvern globalt og lokalt',
    baseUrl: 'https://www.wwf.no',
    color: '#000000', // WWF black
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#000000"/><text x="20" y="26" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">WWF</text></svg>`,
    feeds: {
      news: 'https://www.wwf.no/feed'
    },
    categories: ['environment', 'nature', 'wildlife']
  },
  
  // Bellona - Environmental foundation
  bellona: {
    name: 'Bellona',
    shortName: 'BEL',
    description: 'Miljøstiftelsen Bellona - klima og energi',
    baseUrl: 'https://bellona.no',
    color: '#0066CC', // Bellona blue
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#0066CC"/><circle cx="20" cy="20" r="10" fill="none" stroke="white" stroke-width="2"/><path d="M20 12v8l6 4" stroke="white" stroke-width="2" fill="none"/></svg>`,
    feeds: {
      news: 'https://bellona.no/feed/'
    },
    categories: ['environment', 'climate', 'energy']
  },
  
  // CICERO - Climate research
  cicero: {
    name: 'CICERO',
    shortName: 'CIC',
    description: 'Senter for klimaforskning',
    baseUrl: 'https://cicero.oslo.no',
    color: '#1E3A5F', // Dark blue
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="6" fill="#1E3A5F"/><circle cx="20" cy="20" r="12" fill="none" stroke="white" stroke-width="2"/><path d="M8 20h24M20 8v24M12 12l16 16M28 12l-16 16" stroke="white" stroke-width="1" opacity="0.5"/></svg>`,
    feeds: {
      news: 'https://cicero.oslo.no/no/rss'
    },
    categories: ['climate', 'research', 'science']
  }
}

/**
 * Parse RSS/XML feed to JSON
 */
async function parseRSSFeed(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Vegvisr-Sources-Worker/1.0 (https://vegvisr.org)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`)
    }
    
    const xml = await response.text()
    
    // Parse XML to extract items
    const items = []
    
    // Extract channel title
    const channelTitleMatch = xml.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)
    const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim() : 'Unknown Feed'
    
    // Extract items using regex (works in Workers environment)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    let match
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1]
      
      const title = extractXmlValue(itemXml, 'title')
      const link = extractXmlValue(itemXml, 'link')
      const description = extractXmlValue(itemXml, 'description')
      const pubDate = extractXmlValue(itemXml, 'pubDate')
      const category = extractXmlValue(itemXml, 'category')
      const guid = extractXmlValue(itemXml, 'guid')
      
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description),
        pubDate,
        pubDateParsed: pubDate ? new Date(pubDate).toISOString() : null,
        category: cleanHtml(category),
        guid
      })
    }
    
    return {
      success: true,
      feedTitle: channelTitle,
      feedUrl: url,
      itemCount: items.length,
      items,
      fetchedAt: new Date().toISOString()
    }
    
  } catch (error) {
    console.error(`RSS parse error for ${url}:`, error)
    return {
      success: false,
      feedUrl: url,
      error: error.message,
      items: []
    }
  }
}

/**
 * Extract value from XML element
 */
function extractXmlValue(xml, tagName) {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i')
  const cdataMatch = xml.match(cdataRegex)
  if (cdataMatch) return cdataMatch[1].trim()
  
  // Try regular element
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Clean HTML entities and tags from text
 */
function cleanHtml(text) {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * List all available feeds
 */
function handleListFeeds() {
  const feeds = []
  
  for (const [sourceId, source] of Object.entries(NORWEGIAN_SOURCES)) {
    for (const [feedType, feedUrl] of Object.entries(source.feeds)) {
      feeds.push({
        sourceId,
        sourceName: source.name,
        shortName: source.shortName,
        feedType,
        feedUrl,
        description: source.description,
        categories: source.categories,
        color: source.color,
        logo: source.logo
      })
    }
  }
  
  return jsonResponse({
    success: true,
    totalSources: Object.keys(NORWEGIAN_SOURCES).length,
    totalFeeds: feeds.length,
    sources: Object.entries(NORWEGIAN_SOURCES).map(([id, s]) => ({
      id,
      name: s.name,
      shortName: s.shortName,
      description: s.description,
      categories: s.categories,
      feedCount: Object.keys(s.feeds).length,
      color: s.color,
      logo: s.logo,
      baseUrl: s.baseUrl
    })),
    feeds
  })
}

/**
 * Get specific RSS feed
 */
async function handleGetFeed(request) {
  const url = new URL(request.url)
  const sourceId = url.searchParams.get('source')
  const feedType = url.searchParams.get('type') || 'news'
  const limit = parseInt(url.searchParams.get('limit') || '20')
  
  if (!sourceId || !NORWEGIAN_SOURCES[sourceId]) {
    return jsonResponse({
      error: 'Invalid source',
      availableSources: Object.keys(NORWEGIAN_SOURCES)
    }, 400)
  }
  
  const source = NORWEGIAN_SOURCES[sourceId]
  const feedUrl = source.feeds[feedType]
  
  if (!feedUrl) {
    return jsonResponse({
      error: 'Invalid feed type',
      availableTypes: Object.keys(source.feeds)
    }, 400)
  }
  
  console.log(`📰 Fetching ${sourceId}/${feedType}: ${feedUrl}`)
  
  const feed = await parseRSSFeed(feedUrl)
  
  // Limit results
  if (feed.items && feed.items.length > limit) {
    feed.items = feed.items.slice(0, limit)
  }
  
  return jsonResponse({
    ...feed,
    source: {
      id: sourceId,
      name: source.name,
      description: source.description
    },
    feedType
  })
}

/**
 * Search across multiple sources
 */
async function handleSearch(request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query') || url.searchParams.get('q')
  const sources = url.searchParams.get('sources')?.split(',') || Object.keys(NORWEGIAN_SOURCES)
  const category = url.searchParams.get('category')
  const limit = parseInt(url.searchParams.get('limit') || '30')
  const daysBack = parseInt(url.searchParams.get('days') || '30')
  
  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, 400)
  }
  
  console.log(`🔍 Searching sources for: "${query}"`)
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)
  
  // Fetch feeds from requested sources
  const feedPromises = []
  
  for (const sourceId of sources) {
    const source = NORWEGIAN_SOURCES[sourceId]
    if (!source) continue
    
    // Filter by category if specified
    if (category && !source.categories.includes(category)) continue
    
    // Fetch main news feed
    const newsUrl = source.feeds.news || source.feeds.all
    if (newsUrl) {
      feedPromises.push(
        parseRSSFeed(newsUrl).then(feed => ({
          sourceId,
          sourceName: source.name,
          feed
        }))
      )
    }
  }
  
  const feedResults = await Promise.all(feedPromises)
  
  // Search through all items
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/)
  const results = []
  
  for (const { sourceId, sourceName, feed } of feedResults) {
    if (!feed.success) continue
    
    const sourceInfo = NORWEGIAN_SOURCES[sourceId]
    
    for (const item of feed.items) {
      // Check date filter
      if (item.pubDateParsed) {
        const itemDate = new Date(item.pubDateParsed)
        if (itemDate < cutoffDate) continue
      }
      
      // Check if query matches
      const searchText = `${item.title} ${item.description} ${item.category}`.toLowerCase()
      const matches = queryWords.filter(word => searchText.includes(word))
      
      if (matches.length > 0) {
        results.push({
          source: sourceId,
          sourceName,
          sourceShortName: sourceInfo?.shortName || sourceId.toUpperCase(),
          sourceColor: sourceInfo?.color || '#666666',
          sourceLogo: sourceInfo?.logo || null,
          sourceUrl: sourceInfo?.baseUrl || '',
          title: item.title,
          description: item.description,
          link: item.link,
          pubDate: item.pubDate,
          pubDateParsed: item.pubDateParsed,
          category: item.category,
          relevance: matches.length / queryWords.length
        })
      }
    }
  }
  
  // Sort by relevance, then date
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance
    return new Date(b.pubDateParsed || 0) - new Date(a.pubDateParsed || 0)
  })
  
  // Build markdown summary
  let markdownSummary = `## Søkeresultater: "${query}"\n\n`
  markdownSummary += `Fant ${results.length} treff fra ${feedResults.length} kilder (siste ${daysBack} dager)\n\n`
  
  const topResults = results.slice(0, limit)
  if (topResults.length > 0) {
    for (const r of topResults.slice(0, 10)) {
      markdownSummary += `### [${r.title}](${r.link})\n`
      markdownSummary += `*${r.sourceName}* - ${r.pubDate || 'Ukjent dato'}\n\n`
      if (r.description) {
        markdownSummary += `${r.description.substring(0, 200)}${r.description.length > 200 ? '...' : ''}\n\n`
      }
    }
  } else {
    markdownSummary += `Ingen treff funnet. Prøv et annet søkeord.\n`
  }
  
  return jsonResponse({
    success: true,
    query,
    totalResults: results.length,
    sourcesSearched: feedResults.length,
    daysBack,
    results: topResults,
    markdown_summary: markdownSummary
  })
}

/**
 * Get open hearings (høringer) - searches regjeringen.no and news feeds for hearing-related content
 */
async function handleHearings(request) {
  const url = new URL(request.url)
  const topic = url.searchParams.get('topic')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  
  console.log('📋 Searching for hearing-related news')
  
  // Keywords: høring, høringer, høringsuttalelse, konsultasjon
  const hearingKeywords = ['høring', 'høringsuttalelse', 'konsultasjon', 'innspill']
  
  // Source mapping for logo info
  const sourceMapping = {
    'Regjeringen': 'regjeringen',
    'NRK': 'nrk',
    'Naturvernforbundet': 'naturvern',
    'SABIMA': 'sabima',
    'Bellona': 'bellona'
  }
  
  // Fetch from regjeringen.no (primary source) and environmental orgs
  const feedPromises = [
    parseRSSFeed(NORWEGIAN_SOURCES.regjeringen.feeds.news).then(f => ({ source: 'Regjeringen', sourceId: 'regjeringen', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.nrk.feeds.news).then(f => ({ source: 'NRK', sourceId: 'nrk', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.naturvern.feeds.news).then(f => ({ source: 'Naturvernforbundet', sourceId: 'naturvern', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.sabima.feeds.news).then(f => ({ source: 'SABIMA', sourceId: 'sabima', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.bellona.feeds.news).then(f => ({ source: 'Bellona', sourceId: 'bellona', feed: f }))
  ]
  
  const results = await Promise.all(feedPromises)
  
  // Filter for hearing-related items
  let hearings = []
  for (const { source, sourceId, feed } of results) {
    if (!feed.success || !feed.items) continue
    
    const sourceInfo = NORWEGIAN_SOURCES[sourceId]
    
    for (const item of feed.items) {
      const searchText = `${item.title} ${item.description}`.toLowerCase()
      const isHearing = hearingKeywords.some(kw => searchText.includes(kw))
      const matchesTopic = !topic || searchText.includes(topic.toLowerCase())
      
      if (isHearing && matchesTopic) {
        hearings.push({
          ...item,
          source,
          sourceId,
          sourceShortName: sourceInfo?.shortName || sourceId.toUpperCase(),
          sourceColor: sourceInfo?.color || '#666666',
          sourceLogo: sourceInfo?.logo || null
        })
      }
    }
  }
  
  // Sort by date and limit
  hearings.sort((a, b) => {
    const dateA = a.pubDateParsed ? new Date(a.pubDateParsed) : new Date(0)
    const dateB = b.pubDateParsed ? new Date(b.pubDateParsed) : new Date(0)
    return dateB - dateA
  })
  hearings = hearings.slice(0, limit)
  
  // Build markdown
  let markdown = `## Høringer og konsultasjoner\n\n`
  if (topic) markdown += `Filtrert på: "${topic}"\n\n`
  markdown += `Fant ${hearings.length} relevante saker\n\n`
  
  if (hearings.length === 0) {
    markdown += `Ingen høringer funnet i nyhetsfeedene akkurat nå. For flere høringer, besøk:\n`
    markdown += `- [Regjeringen.no høringer](https://www.regjeringen.no/no/dokument/hoyringar/)\n`
    markdown += `- [Stortinget.no høringer](https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Horingsinnkallinger/)\n\n`
  }
  
  for (const h of hearings) {
    markdown += `### [${h.title}](${h.link})\n`
    markdown += `*${h.source}* - ${h.pubDate || 'Ukjent dato'}\n\n`
    if (h.description) {
      markdown += `${h.description.substring(0, 300)}${h.description.length > 300 ? '...' : ''}\n\n`
    }
    markdown += `---\n\n`
  }
  
  return jsonResponse({
    success: true,
    topic: topic || 'alle',
    totalHearings: hearings.length,
    hearings,
    markdown_summary: markdown
  })
}

/**
 * Get environment/nature news specifically
 */
async function handleEnvironmentNews(request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  
  console.log('🌿 Fetching environment news')
  
  // Fetch from multiple environment-related sources (verified working)
  const feedPromises = [
    parseRSSFeed(NORWEGIAN_SOURCES.regjeringen.feeds.news).then(f => ({ source: 'Regjeringen', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.ssb.feeds.environment).then(f => ({ source: 'SSB - Natur og miljø', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.nrk.feeds.nature).then(f => ({ source: 'NRK - Klima', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.naturvern.feeds.news).then(f => ({ source: 'Naturvernforbundet', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.sabima.feeds.news).then(f => ({ source: 'SABIMA', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.wwf.feeds.news).then(f => ({ source: 'WWF Norge', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.bellona.feeds.news).then(f => ({ source: 'Bellona', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.cicero.feeds.news).then(f => ({ source: 'CICERO', feed: f })),
    parseRSSFeed(NORWEGIAN_SOURCES.forskning.feeds.environment).then(f => ({ source: 'Forskning.no - Miljø', feed: f }))
  ]
  
  const results = await Promise.all(feedPromises)
  
  // Combine and sort by date
  const allItems = []
  for (const { source, feed } of results) {
    if (feed.success && feed.items) {
      for (const item of feed.items) {
        allItems.push({
          ...item,
          source
        })
      }
    }
  }
  
  // Sort by date
  allItems.sort((a, b) => {
    const dateA = a.pubDateParsed ? new Date(a.pubDateParsed) : new Date(0)
    const dateB = b.pubDateParsed ? new Date(b.pubDateParsed) : new Date(0)
    return dateB - dateA
  })
  
  const limitedItems = allItems.slice(0, limit)
  
  // Build markdown
  let markdown = `## Miljø- og naturnyheter\n\n`
  markdown += `Siste ${limitedItems.length} saker fra offentlige kilder:\n\n`
  
  for (const item of limitedItems) {
    markdown += `### [${item.title}](${item.link})\n`
    markdown += `*${item.source}* - ${item.pubDate || 'Ukjent dato'}\n\n`
    if (item.description) {
      markdown += `${item.description.substring(0, 250)}${item.description.length > 250 ? '...' : ''}\n\n`
    }
  }
  
  return jsonResponse({
    success: true,
    totalItems: limitedItems.length,
    sources: results.map(r => r.source),
    items: limitedItems,
    markdown_summary: markdown
  })
}

/**
 * OpenAI Function Calling compatible tool definitions
 */
function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'sources_search',
        description: `Search Norwegian government, news, research, and environmental sources for articles and reports.

Use this when users ask about:
- Norwegian government news and policy
- Environment/nature/climate news
- Research and statistics
- Public hearings (høringer)

Available sources: Regjeringen (government), SSB (statistics), NRK (news), Forskning.no (research), Naturvernforbundet, SABIMA (biodiversity), WWF, Bellona (environment), CICERO (climate)

Returns articles with links to original sources.`,
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query in Norwegian or English (e.g., "naturmangfold", "climate change", "rovdyr", "biologisk mangfold", "høring")'
            },
            sources: {
              type: 'string',
              description: 'Comma-separated source IDs (optional). Available: regjeringen, ssb, nrk, forskning, naturvern, sabima, wwf, bellona, cicero'
            },
            days: {
              type: 'number',
              description: 'How many days back to search (default: 30)'
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'sources_get_hearings',
        description: `Search for public hearings (høringer) from the Norwegian government and news sources.

Searches regjeringen.no and other sources for hearing-related content.

Use when users ask about:
- Public hearings
- Ways to participate in policy
- Current consultations
- Høringer på norsk`,
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Filter by topic (e.g., "naturvern", "klima", "biodiversitet", "mineral")'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'sources_environment_news',
        description: `Get the latest environment and nature news from Norwegian sources.

Aggregates news from: Regjeringen, SSB (statistics), NRK Klima, Naturvernforbundet, SABIMA, WWF, Bellona, CICERO, Forskning.no

Use when users ask about:
- Environment news
- Nature conservation updates
- Climate policy news
- Biodiversity
- Miljønyheter
- Naturvern`,
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of articles (default: 20)'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'sources_list_feeds',
        description: 'List all available Norwegian RSS feeds and sources that can be searched.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
  ]
}

/**
 * Handle tool definitions endpoint
 */
function handleGetTools() {
  return jsonResponse({
    tools: getToolDefinitions(),
    usage: {
      description: 'Search Norwegian government and public sources',
      provider: 'sources',
      baseUrl: 'https://sources-worker.torarnehave.workers.dev'
    },
    availableSources: Object.entries(NORWEGIAN_SOURCES).map(([id, s]) => ({
      id,
      name: s.name,
      description: s.description,
      categories: s.categories
    }))
  })
}

/**
 * Get logo for a specific source as SVG
 */
function handleGetLogo(request) {
  const url = new URL(request.url)
  const sourceId = url.searchParams.get('source')
  
  if (!sourceId || !NORWEGIAN_SOURCES[sourceId]) {
    return jsonResponse({
      error: 'Invalid source',
      availableSources: Object.keys(NORWEGIAN_SOURCES)
    }, 400)
  }
  
  const source = NORWEGIAN_SOURCES[sourceId]
  
  // Return SVG directly
  return new Response(source.logo, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

/**
 * Get all logos as a map
 */
function handleGetAllLogos() {
  const logos = {}
  
  for (const [id, source] of Object.entries(NORWEGIAN_SOURCES)) {
    logos[id] = {
      name: source.name,
      shortName: source.shortName,
      color: source.color,
      logo: source.logo,
      baseUrl: source.baseUrl
    }
  }
  
  return jsonResponse({
    success: true,
    logos
  })
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    try {
      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          worker: 'sources-worker',
          version: '1.1.0',
          availableSources: Object.keys(NORWEGIAN_SOURCES).length,
          timestamp: new Date().toISOString()
        })
      }

      // Tool definitions for AI function calling
      if (pathname === '/api/tools' && request.method === 'GET') {
        return handleGetTools()
      }

      // List all available feeds
      if (pathname === '/feeds' && request.method === 'GET') {
        return handleListFeeds()
      }
      
      // Get logo for a specific source
      if (pathname === '/logo' && request.method === 'GET') {
        return handleGetLogo(request)
      }
      
      // Get all logos
      if (pathname === '/logos' && request.method === 'GET') {
        return handleGetAllLogos()
      }

      // Get specific RSS feed
      if (pathname === '/feed' && request.method === 'GET') {
        return await handleGetFeed(request)
      }

      // Search across sources
      if (pathname === '/search' && request.method === 'GET') {
        return await handleSearch(request)
      }

      // Get hearings
      if (pathname === '/hearings' && request.method === 'GET') {
        return await handleHearings(request)
      }

      // Get environment news
      if (pathname === '/environment' && request.method === 'GET') {
        return await handleEnvironmentNews(request)
      }

      // 404
      return jsonResponse({
        error: 'Not Found',
        path: pathname,
        availableEndpoints: [
          'GET /feeds - List available RSS feeds with logos',
          'GET /feed?source=regjeringen&type=news - Get specific feed',
          'GET /logo?source=ssb - Get SVG logo for a source',
          'GET /logos - Get all logos as JSON',
          'GET /search?query=naturmangfold - Search across sources',
          'GET /hearings?topic=naturvern - Get open hearings',
          'GET /environment - Get environment/nature news',
          'GET /api/tools - AI function calling definitions',
          'GET /health - Health check'
        ]
      }, 404)

    } catch (error) {
      console.error('Worker error:', error)
      return jsonResponse({
        error: 'Internal Server Error',
        message: error.message
      }, 500)
    }
  }
}
