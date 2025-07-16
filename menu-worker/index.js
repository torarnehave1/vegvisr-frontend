// Menu Worker - Cloudflare Worker for Menu Template Management
// Following the same patterns as existing workers in the Vegvisr system

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-user-role, x-api-token, X-API-Token, x-user-email',
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    try {
      // Health check endpoint
      if (path === '/health') {
        return await handleHealthCheck(env, corsHeaders)
      }

      // Menu Template Management Routes
      if (path === '/getMenuTemplates') {
        return await handleGetMenuTemplates(request, env, corsHeaders)
      }

      if (path === '/saveMenuTemplate') {
        return await handleSaveMenuTemplate(request, env, corsHeaders)
      }

      if (path === '/deleteMenuTemplate') {
        return await handleDeleteMenuTemplate(request, env, corsHeaders)
      }

      if (path === '/getMenuByDomain') {
        return await handleGetMenuByDomain(request, env, corsHeaders)
      }

      if (path === '/getMenuById') {
        return await handleGetMenuById(request, env, corsHeaders)
      }

      if (path === '/updateMenuTemplate') {
        return await handleUpdateMenuTemplate(request, env, corsHeaders)
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Endpoint not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } catch (error) {
      console.error('Menu Worker Error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  },
}

// Health check endpoint
async function handleHealthCheck(env, corsHeaders) {
  try {
    // Test database connection
    const db = env.VEGVISR_DB
    const testQuery = await db.prepare('SELECT COUNT(*) as count FROM menuTemplates').first()

    return new Response(
      JSON.stringify({
        success: true,
        service: 'menu-worker',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          menuTemplates: testQuery.count,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        service: 'menu-worker',
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Get menu templates with filtering options
async function handleGetMenuTemplates(request, env, corsHeaders) {
  const url = new URL(request.url)
  const { level, domain, category, access_level } = Object.fromEntries(url.searchParams)

  try {
    console.log('[Menu Worker] Fetching list of menu templates')

    let query =
      'SELECT id, name, menu_data, category, menu_level, access_level, domain, created_by, created_at, updated_at FROM menuTemplates WHERE 1=1'
    const params = []

    if (level) {
      query += ' AND menu_level = ?'
      params.push(level)
    }

    if (domain) {
      query += ' AND (domain = ? OR domain IS NULL)'
      params.push(domain)
    }

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    if (access_level) {
      query += ' AND access_level = ?'
      params.push(access_level)
    }

    query += ' ORDER BY created_at DESC'

    const results = await env.VEGVISR_DB.prepare(query)
      .bind(...params)
      .all()

    // Process results to parse menu_data JSON
    const processedResults = {
      ...results,
      results: results.results.map((row) => ({
        id: row.id,
        name: row.name,
        menu_data: JSON.parse(row.menu_data),
        category: row.category,
        menu_level: row.menu_level,
        access_level: row.access_level,
        domain: row.domain,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    }

    console.log('[Menu Worker] Menu templates fetched successfully')
    return new Response(JSON.stringify(processedResults), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Menu Worker] Error fetching menu templates:', error)
    return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
}

// Save menu template (create or update)
async function handleSaveMenuTemplate(request, env, corsHeaders) {
  try {
    const db = env.VEGVISR_DB
    const body = await request.json()

    // Debug: Log the incoming request
    console.log('=== MENU WORKER DEBUG ===')
    console.log('Received request body:', JSON.stringify(body, null, 2))
    console.log('Body keys:', Object.keys(body))

    const { id, name, menu_data, category, menu_level, access_level, domain, created_by } = body

    // Debug: Log individual field values
    console.log('=== FIELD VALIDATION DEBUG ===')
    console.log('id:', id, '(type:', typeof id, ', truthy:', !!id, ')')
    console.log('name:', name, '(type:', typeof name, ', truthy:', !!name, ')')
    console.log('menu_data:', menu_data, '(type:', typeof menu_data, ', truthy:', !!menu_data, ')')
    console.log('category:', category)
    console.log('menu_level:', menu_level)
    console.log('access_level:', access_level)
    console.log('domain:', domain)
    console.log('created_by:', created_by)

    // Generate ID if not provided (BEFORE validation)
    const templateId = id || `menu-template-${Date.now()}`
    console.log('=== ID GENERATION ===')
    console.log('Original id:', id)
    console.log('Final templateId:', templateId)

    // Validate required fields (id is now generated, so we don't need to check it)
    if (!name || !menu_data) {
      console.log('=== VALIDATION FAILED ===')
      console.log('Missing fields:')
      console.log('- name missing:', !name)
      console.log('- menu_data missing:', !menu_data)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: name, menu_data',
          debug: {
            name: !!name,
            menu_data: !!menu_data,
            receivedFields: Object.keys(body),
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate menu_data is valid JSON
    let menuDataString
    try {
      menuDataString = typeof menu_data === 'string' ? menu_data : JSON.stringify(menu_data)
      JSON.parse(menuDataString) // Validate JSON
      console.log('=== JSON VALIDATION ===')
      console.log('menu_data JSON is valid')
    } catch (jsonError) {
      console.log('=== JSON VALIDATION FAILED ===')
      console.log('JSON Error:', jsonError.message)
      console.log('menu_data type:', typeof menu_data)
      console.log('menu_data value:', menu_data)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid menu_data JSON format',
          debug: {
            jsonError: jsonError.message,
            menu_data_type: typeof menu_data,
            menu_data_value: menu_data,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('=== DATABASE OPERATION ===')
    console.log('Preparing database insert/update for:', templateId)

    const query = `
      INSERT INTO menuTemplates (id, name, menu_data, category, menu_level, access_level, domain, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        menu_data = excluded.menu_data,
        category = excluded.category,
        menu_level = excluded.menu_level,
        access_level = excluded.access_level,
        domain = excluded.domain,
        updated_at = CURRENT_TIMESTAMP
    `

    const result = await db
      .prepare(query)
      .bind(
        templateId,
        name,
        menuDataString,
        category || 'General',
        menu_level || 'graph',
        access_level || 'user',
        domain || null,
        created_by || 'system',
      )
      .run()

    console.log('=== DATABASE SUCCESS ===')
    console.log('Database operation result:', result)

    return new Response(
      JSON.stringify({
        success: true,
        id: templateId,
        message: 'Menu template saved successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('=== WORKER ERROR ===')
    console.error('Error saving menu template:', error)
    console.error('Error stack:', error.stack)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        debug: {
          errorType: error.constructor.name,
          stack: error.stack,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Delete menu template
async function handleDeleteMenuTemplate(request, env, corsHeaders) {
  try {
    const db = env.VEGVISR_DB
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameter: id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const result = await db.prepare('DELETE FROM menuTemplates WHERE id = ?').bind(id).run()

    if (result.changes === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Menu template not found',
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
        message: 'Menu template deleted successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error deleting menu template:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Get menu configuration for a specific domain (branding integration)
async function handleGetMenuByDomain(request, env, corsHeaders) {
  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')

  if (!domain) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing required parameter: domain',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const db = env.VEGVISR_DB

    // Get menus for this specific domain or global menus
    const result = await db
      .prepare(
        `
      SELECT * FROM menuTemplates
      WHERE domain = ? OR domain IS NULL
      ORDER BY domain DESC, created_at DESC
    `,
      )
      .bind(domain)
      .all()

    // Note: Site config integration can be added later if needed

    return new Response(
      JSON.stringify({
        success: true,
        domain: domain,
        menuTemplates: result.results.map((row) => ({
          id: row.id,
          name: row.name,
          menu_data: JSON.parse(row.menu_data),
          category: row.category,
          menu_level: row.menu_level,
          access_level: row.access_level,
          domain: row.domain,
          created_at: row.created_at,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error fetching menu by domain:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Get menu template by ID
async function handleGetMenuById(request, env, corsHeaders) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (!id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing required parameter: id',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const db = env.VEGVISR_DB
    const result = await db.prepare('SELECT * FROM menuTemplates WHERE id = ?').bind(id).first()

    if (!result) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Menu template not found',
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
        result: {
          id: result.id,
          name: result.name,
          menu_data: JSON.parse(result.menu_data),
          category: result.category,
          menu_level: result.menu_level,
          access_level: result.access_level,
          domain: result.domain,
          created_by: result.created_by,
          created_at: result.created_at,
          updated_at: result.updated_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error fetching menu by ID:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}

// Update menu template
async function handleUpdateMenuTemplate(request, env, corsHeaders) {
  try {
    const db = env.VEGVISR_DB
    const body = await request.json()
    const { id, name, menu_data, category, menu_level, access_level, domain } = body

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Check if menu template exists
    const existing = await db.prepare('SELECT id FROM menuTemplates WHERE id = ?').bind(id).first()
    if (!existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Menu template not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Build update query dynamically
    const updates = []
    const params = []

    if (name) {
      updates.push('name = ?')
      params.push(name)
    }

    if (menu_data) {
      updates.push('menu_data = ?')
      const menuDataString = typeof menu_data === 'string' ? menu_data : JSON.stringify(menu_data)
      params.push(menuDataString)
    }

    if (category) {
      updates.push('category = ?')
      params.push(category)
    }

    if (menu_level) {
      updates.push('menu_level = ?')
      params.push(menu_level)
    }

    if (access_level) {
      updates.push('access_level = ?')
      params.push(access_level)
    }

    if (domain !== undefined) {
      updates.push('domain = ?')
      params.push(domain)
    }

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No fields to update',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')
    params.push(id)

    const query = `UPDATE menuTemplates SET ${updates.join(', ')} WHERE id = ?`
    const result = await db
      .prepare(query)
      .bind(...params)
      .run()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Menu template updated successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error updating menu template:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
}
