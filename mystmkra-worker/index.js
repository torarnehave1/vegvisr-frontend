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

      if (url.pathname === '/files-with-content' && request.method === 'GET') {
        return handleListFilesWithContent(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname === '/count' && request.method === 'GET') {
        return handleCount(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname === '/delete' && request.method === 'POST') {
        return handleDelete(request, env.MYSTMKRA_DB, corsHeaders)
      }

      if (url.pathname === '/convert-to-graph' && request.method === 'POST') {
        return handleConvertToGraph(request, env.MYSTMKRA_DB, env, corsHeaders)
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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const userId = url.searchParams.get('user_id')

  try {
    let stmt
    if (userId) {
      stmt = db.prepare(`
        SELECT id, title, content, tags, created_at, updated_at, published, user_id
        FROM documents
        WHERE locked = 0 AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(userId, limit, offset)
    } else {
      stmt = db.prepare(`
        SELECT id, title, content, tags, created_at, updated_at, published, user_id
        FROM documents
        WHERE locked = 0
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset)
    }

    const { results } = await stmt.all()

    const files = (results || []).map(file => {
      const content = file.content || ''

      // Extract first heading
      const headingMatch = content.match(/^#{1,6}\s+(.+)$/m)
      const firstHeading = headingMatch ? headingMatch[1].trim() : null

      // Extract first image
      const imageMatch = content.match(/!\[.*?\]\((.*?)\)/)
      const firstImage = imageMatch ? imageMatch[1].trim() : null

      // Extract preview text (first 200 chars, excluding headings and images)
      let preview = content
        .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
        .replace(/^#{1,6}\s+.+$/gm, '') // Remove headings
        .trim()
        .substring(0, 200)
      preview = preview ? preview + '...' : 'No preview available'

      return {
        id: file.id,
        _id: file.id,
        title: file.title || 'Untitled',
        tags: file.tags ? JSON.parse(file.tags) : [],
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        published: file.published === 1,
        userId: file.user_id,
        firstHeading,
        firstImage,
        preview
      }
    })

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

async function handleListFilesWithContent(request, db, corsHeaders) {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const userId = url.searchParams.get('user_id')

  try {
    let stmt
    if (userId) {
      stmt = db.prepare(`
        SELECT id, title, content, tags, created_at, updated_at, published, user_id
        FROM documents
        WHERE locked = 0 AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(userId, limit, offset)
    } else {
      stmt = db.prepare(`
        SELECT id, title, content, tags, created_at, updated_at, published, user_id
        FROM documents
        WHERE locked = 0
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset)
    }

    const { results } = await stmt.all()

    const files = (results || []).map(file => ({
      id: file.id,
      _id: file.id,
      title: file.title || 'Untitled',
      content: file.content || '',
      tags: file.tags ? JSON.parse(file.tags) : [],
      createdAt: file.created_at,
      updatedAt: file.updated_at,
      published: file.published === 1,
      userId: file.user_id
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
    console.error('List files with content error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleCount(request, db, corsHeaders) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id')

  try {
    let stmt
    if (userId) {
      stmt = db.prepare('SELECT COUNT(*) as count FROM documents WHERE locked = 0 AND user_id = ?').bind(userId)
    } else {
      stmt = db.prepare('SELECT COUNT(*) as count FROM documents WHERE locked = 0')
    }

    const result = await stmt.first()

    return new Response(
      JSON.stringify({
        success: true,
        count: result?.count || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Count error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleDelete(request, db, corsHeaders) {
  try {
    const body = await request.json()
    const ids = body.ids

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Document IDs array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete documents by IDs
    const placeholders = ids.map(() => '?').join(',')
    const stmt = db.prepare(`DELETE FROM documents WHERE id IN (${placeholders})`).bind(...ids)
    const result = await stmt.run()

    return new Response(
      JSON.stringify({
        success: true,
        deleted: result.meta.changes || ids.length,
        message: `Successfully deleted ${result.meta.changes || ids.length} document(s)`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Delete error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleConvertToGraph(request, db, env, corsHeaders) {
  try {
    const body = await request.json()
    const { documentId, userEmail, generateAIMetadata = true } = body

    if (!documentId || !userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'documentId and userEmail are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Fetch document from MystMkra DB
    const stmt = db.prepare('SELECT * FROM documents WHERE id = ?').bind(documentId)
    const doc = await stmt.first()

    if (!doc) {
      return new Response(
        JSON.stringify({ success: false, error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Generate AI metadata (title, description, categories)
    let aiMetadata = {
      title: doc.title || 'Untitled from MystMkra',
      description: `Imported from MystMkra document: ${doc.id}`,
      category: ''
    }

    if (generateAIMetadata && doc.content && doc.content.trim().length > 0) {
      try {
        console.log('Generating AI metadata for document:', documentId)
        
        // Call all three AI endpoints in parallel for speed
        const metadataPromises = [
          fetch('https://api.vegvisr.org/suggest-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodes: [{ info: doc.content }],
              edges: []
            })
          }),
          fetch('https://api.vegvisr.org/suggest-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodes: [{ info: doc.content }],
              edges: []
            })
          }),
          fetch('https://api.vegvisr.org/suggest-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodes: [{ info: doc.content }],
              edges: []
            })
          })
        ]

        const [titleRes, descRes, catRes] = await Promise.all(metadataPromises)

        if (titleRes.ok) {
          const data = await titleRes.json()
          aiMetadata.title = data.title
          console.log('AI generated title:', data.title)
        }

        if (descRes.ok) {
          const data = await descRes.json()
          aiMetadata.description = data.description
          console.log('AI generated description:', data.description)
        }

        if (catRes.ok) {
          const data = await catRes.json()
          aiMetadata.category = data.categories
          console.log('AI generated categories:', data.categories)
        }
      } catch (error) {
        console.error('AI metadata generation failed, using defaults:', error)
        // Continue with default metadata (graceful degradation)
      }
    }

    // 3. Create Knowledge Graph structure
    const graphId = crypto.randomUUID()
    const nodeId = crypto.randomUUID()

    const graphData = {
      metadata: {
        title: aiMetadata.title,
        description: aiMetadata.description,
        category: aiMetadata.category,
        createdBy: userEmail,
        version: 0,
        sourceDocument: doc.id,
        sourceSystem: 'mystmkra'
      },
      nodes: [
        {
          id: nodeId,
          label: aiMetadata.title,
          type: 'markdown',
          info: doc.content,
          bibl: doc.tags ? JSON.parse(doc.tags) : [],
          color: '#e3f2fd',
          position: { x: 250, y: 100 },
          visible: true,
          path: null,
          imageWidth: '100%',
          imageHeight: 'auto'
        }
      ],
      edges: []
    }

    // 4. Save to Knowledge Graph via service binding
    console.log('Saving graph to dev-worker:', graphId)
    
    const saveResponse = await env.DEV_WORKER.fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userEmail,
        'Origin': 'https://mystmkra.io'
      },
      body: JSON.stringify({
        id: graphId,
        graphData: graphData,
        override: true
      })
    })

    const saveResult = await saveResponse.json()

    if (!saveResponse.ok) {
      console.error('Failed to save graph:', saveResult)
      return new Response(
        JSON.stringify({ success: false, error: saveResult.error || 'Failed to save graph' }),
        { status: saveResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Graph saved successfully:', graphId)

    return new Response(
      JSON.stringify({
        success: true,
        graphId: graphId,
        documentId: doc.id,
        metadata: aiMetadata,
        viewUrl: `https://knowledge.vegvisr.org/public-graph?id=${graphId}`,
        editUrl: `/gnew-viewer?graphId=${graphId}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Conversion error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
