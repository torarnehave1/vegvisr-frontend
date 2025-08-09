// @name advertisement-worker
// @description A Cloudflare Worker script to handle advertisement management for VEGVISR
// @version 1.0
// @author Tor Arne Håve
// @license MIT

// Utility functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
}

// Generate UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Validate knowledge graph ID exists
async function validateKnowledgeGraph(db, knowledgeGraphId) {
  try {
    const result = await db
      .prepare('SELECT id FROM knowledge_graphs WHERE id = ?')
      .bind(knowledgeGraphId)
      .first()

    return !!result
  } catch (error) {
    console.error('Error validating knowledge graph:', error)
    return false
  }
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    try {
      // Health check endpoint
      if (pathname === '/health') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            service: 'advertisement-worker',
            timestamp: new Date().toISOString(),
            database: env.DB ? 'connected' : 'not connected',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      // API Routes
      if (pathname.startsWith('/api/')) {
        return await handleApiRequest(request, env, pathname)
      }

      // Default response
      return new Response('VEGVISR Advertisement Worker v1.0', {
        headers: corsHeaders,
      })
    } catch (error) {
      console.error('Advertisement Worker Error:', error)
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  },
}

// Handle API requests
async function handleApiRequest(request, env, pathname) {
  const method = request.method
  const url = new URL(request.url)

  // GET /api/advertisements - List advertisements (optionally filtered by knowledge_graph_id)
  if (pathname === '/api/advertisements' && method === 'GET') {
    const knowledgeGraphId = url.searchParams.get('knowledge_graph_id')
    return await getAdvertisements(env.DB, knowledgeGraphId)
  }

  // POST /api/advertisements - Create new advertisement
  if (pathname === '/api/advertisements' && method === 'POST') {
    const data = await request.json()
    return await createAdvertisement(env.DB, data)
  }

  // GET /api/advertisements/:id - Get specific advertisement
  if (pathname.startsWith('/api/advertisements/') && method === 'GET') {
    const id = pathname.split('/').pop()
    return await getAdvertisement(env.DB, id)
  }

  // PUT /api/advertisements/:id - Update advertisement
  if (pathname.startsWith('/api/advertisements/') && method === 'PUT') {
    const id = pathname.split('/').pop()
    const data = await request.json()
    return await updateAdvertisement(env.DB, id, data)
  }

  // DELETE /api/advertisements/:id - Delete advertisement
  if (pathname.startsWith('/api/advertisements/') && method === 'DELETE') {
    const id = pathname.split('/').pop()
    return await deleteAdvertisement(env.DB, id)
  }

  // GET /api/knowledge-graphs/:id/advertisements - Get advertisements for specific knowledge graph
  if (pathname.match(/^\/api\/knowledge-graphs\/[^\/]+\/advertisements$/) && method === 'GET') {
    const knowledgeGraphId = pathname.split('/')[3]
    return await getAdvertisements(env.DB, knowledgeGraphId)
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Get advertisements (optionally filtered by knowledge_graph_id)
async function getAdvertisements(db, knowledgeGraphId = null) {
  try {
    let query = 'SELECT * FROM advertisements'
    let params = []

    if (knowledgeGraphId) {
      query += ' WHERE knowledge_graph_id = ?'
      params.push(knowledgeGraphId)
    }

    query += ' ORDER BY created_at DESC'

    const results = await db
      .prepare(query)
      .bind(...params)
      .all()

    return new Response(
      JSON.stringify({
        success: true,
        data: results.results || [],
        count: results.results?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error fetching advertisements:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch advertisements',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Create new advertisement
async function createAdvertisement(db, data) {
  try {
    // Validate required fields
    if (!data.knowledge_graph_id || !data.title || !data.content) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields',
          required: ['knowledge_graph_id', 'title', 'content'],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate knowledge graph exists
    const isValidKG = await validateKnowledgeGraph(db, data.knowledge_graph_id)
    if (!isValidKG) {
      return new Response(
        JSON.stringify({
          error: 'Invalid knowledge_graph_id',
          message: 'The specified knowledge graph does not exist',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const advertisementId = generateUUID()
    const now = new Date().toISOString()

    const result = await db
      .prepare(
        `
      INSERT INTO advertisements (
        id, knowledge_graph_id, title, content,
        target_audience, campaign_name, budget, status,
        created_at, updated_at, aspect_ratio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        advertisementId,
        data.knowledge_graph_id,
        data.title,
        data.content,
        data.target_audience || null,
        data.campaign_name || null,
        data.budget || null,
        data.status || 'draft',
        now,
        now,
        data.aspect_ratio || 'default',
      )
      .run()

    if (result.success) {
      // Fetch the created advertisement
      const created = await db
        .prepare('SELECT * FROM advertisements WHERE id = ?')
        .bind(advertisementId)
        .first()

      return new Response(
        JSON.stringify({
          success: true,
          data: created,
          message: 'Advertisement created successfully',
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else {
      throw new Error('Failed to create advertisement')
    }
  } catch (error) {
    console.error('Error creating advertisement:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create advertisement',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Get specific advertisement
async function getAdvertisement(db, id) {
  try {
    const result = await db.prepare('SELECT * FROM advertisements WHERE id = ?').bind(id).first()

    if (!result) {
      return new Response(
        JSON.stringify({
          error: 'Advertisement not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error fetching advertisement:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch advertisement',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Update advertisement
async function updateAdvertisement(db, id, data) {
  try {
    // Check if advertisement exists
    const existing = await db.prepare('SELECT * FROM advertisements WHERE id = ?').bind(id).first()

    if (!existing) {
      return new Response(
        JSON.stringify({
          error: 'Advertisement not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate knowledge graph if being changed
    if (data.knowledge_graph_id && data.knowledge_graph_id !== existing.knowledge_graph_id) {
      const isValidKG = await validateKnowledgeGraph(db, data.knowledge_graph_id)
      if (!isValidKG) {
        return new Response(
          JSON.stringify({
            error: 'Invalid knowledge_graph_id',
            message: 'The specified knowledge graph does not exist',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    const now = new Date().toISOString()

    const result = await db
      .prepare(
        `
      UPDATE advertisements SET
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        target_audience = COALESCE(?, target_audience),
        campaign_name = COALESCE(?, campaign_name),
        budget = COALESCE(?, budget),
        status = COALESCE(?, status),
        aspect_ratio = COALESCE(?, aspect_ratio),
        updated_at = ?
      WHERE id = ?
    `,
      )
      .bind(
        data.title || null,
        data.content || null,
        data.target_audience || null,
        data.campaign_name || null,
        data.budget || null,
        data.status || null,
        data.aspect_ratio || null,
        now,
        id,
      )
      .run()

    if (result.success) {
      // Fetch updated advertisement
      const updated = await db.prepare('SELECT * FROM advertisements WHERE id = ?').bind(id).first()

      return new Response(
        JSON.stringify({
          success: true,
          data: updated,
          message: 'Advertisement updated successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else {
      throw new Error('Failed to update advertisement')
    }
  } catch (error) {
    console.error('Error updating advertisement:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to update advertisement',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Delete advertisement
async function deleteAdvertisement(db, id) {
  try {
    // Check if advertisement exists
    const existing = await db.prepare('SELECT * FROM advertisements WHERE id = ?').bind(id).first()

    if (!existing) {
      return new Response(
        JSON.stringify({
          error: 'Advertisement not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const result = await db.prepare('DELETE FROM advertisements WHERE id = ?').bind(id).run()

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Advertisement deleted successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } else {
      throw new Error('Failed to delete advertisement')
    }
  } catch (error) {
    console.error('Error deleting advertisement:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to delete advertisement',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}
