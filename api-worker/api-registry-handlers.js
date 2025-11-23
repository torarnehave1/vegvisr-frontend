/**
 * API Registry Handlers - Manage available APIs for AppBuilder
 * Allows dynamic API management via database
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token'
}

function createResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function createErrorResponse(message, status = 400) {
  return createResponse(JSON.stringify({ success: false, error: message }), status)
}

/**
 * List all APIs (optionally filtered by category or status)
 * GET /api/apis/list?category=images&status=active
 */
export async function listAPIs(request, env) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const status = url.searchParams.get('status') || 'active'

    let query = 'SELECT * FROM apiForApps WHERE status = ?'
    let params = [status]

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    query += ' ORDER BY category, name'

    const result = await env.vegvisr_org.prepare(query).bind(...params).all()

    // Group by category
    const groupedAPIs = {}
    result.results.forEach(api => {
      if (!groupedAPIs[api.category]) {
        groupedAPIs[api.category] = []
      }
      groupedAPIs[api.category].push(api)
    })

    return createResponse(JSON.stringify({
      success: true,
      apis: groupedAPIs,
      total: result.results.length
    }))

  } catch (error) {
    console.error('List APIs error:', error)
    return createErrorResponse(`Failed to list APIs: ${error.message}`, 500)
  }
}

/**
 * Get single API by slug
 * GET /api/apis/:slug
 */
export async function getAPI(request, env, slug) {
  try {
    const api = await env.vegvisr_org.prepare(
      'SELECT * FROM apiForApps WHERE slug = ?'
    ).bind(slug).first()

    if (!api) {
      return createErrorResponse('API not found', 404)
    }

    return createResponse(JSON.stringify({
      success: true,
      api
    }))

  } catch (error) {
    console.error('Get API error:', error)
    return createErrorResponse(`Failed to get API: ${error.message}`, 500)
  }
}

/**
 * Create new API (Superadmin only)
 * POST /api/apis/create
 */
export async function createAPI(request, env) {
  try {
    const body = await request.json()
    const {
      name, slug, category, description, icon, color,
      function_name, function_signature, function_code,
      endpoint_url, docs_url, example_code, rate_limit,
      status, is_enabled_by_default, is_always_on, requires_auth
    } = body

    // Validate required fields
    if (!name || !slug || !category || !description || !function_name || !function_signature || !function_code) {
      return createErrorResponse('Missing required fields', 400)
    }

    // Check if slug already exists
    const existing = await env.vegvisr_org.prepare(
      'SELECT id FROM apiForApps WHERE slug = ?'
    ).bind(slug).first()

    if (existing) {
      return createErrorResponse('API with this slug already exists', 400)
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.vegvisr_org.prepare(`
      INSERT INTO apiForApps (
        id, name, slug, category, description, icon, color,
        function_name, function_signature, function_code,
        endpoint_url, docs_url, example_code, rate_limit,
        status, is_enabled_by_default, is_always_on, requires_auth,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, name, slug, category, description, icon || '🔌', color || '#667eea',
      function_name, function_signature, function_code,
      endpoint_url || null, docs_url || null, example_code || null, rate_limit || null,
      status || 'active', is_enabled_by_default || false, is_always_on || false, requires_auth || false,
      now, now
    ).run()

    return createResponse(JSON.stringify({
      success: true,
      id,
      message: `API "${name}" created successfully`
    }))

  } catch (error) {
    console.error('Create API error:', error)
    return createErrorResponse(`Failed to create API: ${error.message}`, 500)
  }
}

/**
 * Update API (Superadmin only)
 * PUT /api/apis/:id
 */
export async function updateAPI(request, env, id) {
  try {
    const body = await request.json()

    // Check if API exists
    const existing = await env.vegvisr_org.prepare(
      'SELECT id FROM apiForApps WHERE id = ?'
    ).bind(id).first()

    if (!existing) {
      return createErrorResponse('API not found', 404)
    }

    const updates = []
    const params = []

    // Build dynamic update query
    const allowedFields = [
      'name', 'description', 'icon', 'color', 'function_name', 'function_signature',
      'function_code', 'endpoint_url', 'docs_url', 'example_code', 'rate_limit',
      'status', 'is_enabled_by_default', 'is_always_on', 'requires_auth'
    ]

    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        params.push(body[field])
      }
    })

    if (updates.length === 0) {
      return createErrorResponse('No fields to update', 400)
    }

    updates.push('updated_at = ?')
    params.push(new Date().toISOString())
    params.push(id)

    await env.vegvisr_org.prepare(
      `UPDATE apiForApps SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run()

    return createResponse(JSON.stringify({
      success: true,
      message: 'API updated successfully'
    }))

  } catch (error) {
    console.error('Update API error:', error)
    return createErrorResponse(`Failed to update API: ${error.message}`, 500)
  }
}

/**
 * Delete API (Superadmin only)
 * DELETE /api/apis/:id
 */
export async function deleteAPI(request, env, id) {
  try {
    // Check if API exists
    const existing = await env.vegvisr_org.prepare(
      'SELECT name, is_always_on FROM apiForApps WHERE id = ?'
    ).bind(id).first()

    if (!existing) {
      return createErrorResponse('API not found', 404)
    }

    if (existing.is_always_on) {
      return createErrorResponse('Cannot delete always-on APIs', 400)
    }

    await env.vegvisr_org.prepare(
      'DELETE FROM apiForApps WHERE id = ?'
    ).bind(id).run()

    return createResponse(JSON.stringify({
      success: true,
      message: `API "${existing.name}" deleted successfully`
    }))

  } catch (error) {
    console.error('Delete API error:', error)
    return createErrorResponse(`Failed to delete API: ${error.message}`, 500)
  }
}

/**
 * Track API usage (automatic, called during app generation)
 * POST /api/apis/:slug/track-usage
 */
export async function trackAPIUsage(request, env, slug) {
  try {
    const now = new Date().toISOString()

    await env.vegvisr_org.prepare(`
      UPDATE apiForApps
      SET usage_count = usage_count + 1, last_used_at = ?
      WHERE slug = ?
    `).bind(now, slug).run()

    return createResponse(JSON.stringify({
      success: true
    }))

  } catch (error) {
    console.error('Track API usage error:', error)
    // Don't fail the request if tracking fails
    return createResponse(JSON.stringify({
      success: false,
      error: error.message
    }))
  }
}

/**
 * Get enabled APIs for code generation
 * POST /api/apis/get-enabled
 * Body: { enabledAPIs: ['pexels', 'ai-chat', 'cloud-storage'] }
 */
export async function getEnabledAPIs(request, env) {
  try {
    const { enabledAPIs } = await request.json()

    if (!Array.isArray(enabledAPIs) || enabledAPIs.length === 0) {
      return createErrorResponse('enabledAPIs must be a non-empty array', 400)
    }

    const placeholders = enabledAPIs.map(() => '?').join(',')
    const query = `SELECT * FROM apiForApps WHERE slug IN (${placeholders}) AND status = 'active'`

    const result = await env.vegvisr_org.prepare(query).bind(...enabledAPIs).all()

    return createResponse(JSON.stringify({
      success: true,
      apis: result.results
    }))

  } catch (error) {
    console.error('Get enabled APIs error:', error)
    return createErrorResponse(`Failed to get enabled APIs: ${error.message}`, 500)
  }
}
