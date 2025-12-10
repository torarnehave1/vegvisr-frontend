/**
 * Mystmkra Worker - D1 Version
 * Fast, reliable document search using Cloudflare D1
 */

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-email, x-user-role, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const corsHeaders = getCorsHeaders(origin)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    try {
      // Route handling
      if (url.pathname === '/search' && request.method === 'GET') {
        return handleSearch(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname.startsWith('/file/') && request.method === 'GET') {
        return handleGetFile(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname === '/files' && request.method === 'GET') {
        return handleListFiles(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({ success: true, status: 'healthy', database: 'd1' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Request error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  },
}

async function handleSearch(request, db, corsHeaders) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  if (!query) {
    return new Response(
      JSON.stringify({ success: false, error: 'Search query is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (query.trim().length < 2) {
    return new Response(
      JSON.stringify({ success: true, results: [], message: 'Query too short' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    let results

    // Check if query is an ID (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(query.trim())) {
      console.log('ID search:', query)
      const stmt = db.prepare('SELECT * FROM documents WHERE id = ?').bind(query.trim())
      const result = await stmt.first()
      results = result ? [result] : []
    } else if (query.startsWith('#')) {
      // Tag search
      console.log('Tag search:', query)
      const tag = query.trim()
      const stmt = db.prepare(`
        SELECT * FROM documents
        WHERE tags LIKE ?
        ORDER BY updated_at DESC
        LIMIT 50
      `).bind(`%${tag}%`)
      const { results: rows } = await stmt.all()
      results = rows || []
    } else {
      // Full-text search using FTS5
      console.log('FTS search:', query)
      const stmt = db.prepare(`
        SELECT d.* FROM documents_fts fts
        JOIN documents d ON d.rowid = fts.rowid
        WHERE documents_fts MATCH ?
        ORDER BY rank
        LIMIT 50
      `).bind(query)
      const { results: rows } = await stmt.all()
      results = rows || []
    }

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], message: 'No results found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resultsWithAbstracts = results.map(result => {
      const content = result.content || ''
      let plainText = content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/!\[.+?\]\(.+?\)/g, '')
        .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/<[^>]*>/g, '')
        .trim()

      const abstract = plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '')

      return {
        id: result.id,
        _id: result.id,
        title: result.title || 'Untitled',
        abs: abstract,
        tags: result.tags ? JSON.parse(result.tags) : [],
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        published: result.published === 1
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        results: resultsWithAbstracts,
        count: resultsWithAbstracts.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Search error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleGetFile(request, db, corsHeaders) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const fileId = pathParts[2]

  if (!fileId) {
    return new Response(
      JSON.stringify({ success: false, error: 'File ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const stmt = db.prepare('SELECT * FROM documents WHERE id = ?').bind(fileId)
    const result = await stmt.first()

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const file = {
      id: result.id,
      _id: result.id,
      title: result.title,
      content: result.content,
      tags: result.tags ? JSON.parse(result.tags) : [],
      userId: result.user_id,
      published: result.published === 1,
      locked: result.locked === 1,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      publishedAt: result.published_at,
      url: result.url
    }

    return new Response(
      JSON.stringify({ success: true, file }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get file error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleListFiles(request, db, corsHeaders) {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  try {
    const stmt = db.prepare(`
      SELECT id, title, tags, created_at, updated_at, published
      FROM documents
      WHERE locked = 0
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset)

    const { results } = await stmt.all()

    const files = (results || []).map(file => ({
      id: file.id,
      _id: file.id,
      title: file.title || 'Untitled',
      tags: file.tags ? JSON.parse(file.tags) : [],
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      published: file.published === 1
    }))

    return new Response(
      JSON.stringify({
        success: true,
        files,
        count: files.length,
        limit,
        offset
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('List files error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
