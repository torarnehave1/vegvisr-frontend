/**
 * User App Storage API - D1 JSON storage for AppBuilder apps
 * Provides CRUD operations for Superadmin users to store app data
 */

/**
 * Validate user authentication via X-API-Token header
 * Returns { valid: boolean, userId: string|null, role: string|null, error: string|null }
 */
async function validateAuth(request, env) {
  const apiToken = request.headers.get('X-API-Token')

  if (!apiToken) {
    return { valid: false, userId: null, role: null, error: 'Missing X-API-Token header' }
  }

  try {
    const userRecord = await env.vegvisr_org.prepare(
      'SELECT user_id, Role FROM config WHERE emailVerificationToken = ?'
    ).bind(apiToken).first()

    if (!userRecord) {
      return { valid: false, userId: null, role: null, error: 'Invalid authentication token' }
    }

    return {
      valid: true,
      userId: userRecord.user_id,
      role: userRecord.Role,
      error: null
    }
  } catch (error) {
    return { valid: false, userId: null, role: null, error: 'Authentication error' }
  }
}

/**
 * Set/Update data for an app
 * POST /api/user-app/data/set
 * Body: { userId, appId, key, value }
 */
export async function setData(request, env) {
  try {
    // Validate authentication
    const auth = await validateAuth(request, env)
    if (!auth.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { userId, appId, key, value } = await request.json()

    if (!userId || !appId || !key || value === undefined) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, appId, key, value'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify the authenticated user matches the userId in the request
    if (auth.userId !== userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Cannot modify data for another user'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify user is Superadmin
    if (auth.role !== 'Superadmin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Superadmin role required'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const id = crypto.randomUUID()
    const valueJson = JSON.stringify(value)
    const now = new Date().toISOString()

    // Use INSERT OR REPLACE for upsert behavior
    await env.vegvisr_org.prepare(`
      INSERT INTO user_app_storage (id, user_id, app_id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, app_id, key)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(id, userId, appId, key, valueJson, now, now).run()

    return new Response(JSON.stringify({
      success: true,
      id,
      userId,
      appId,
      key,
      createdAt: now,
      updatedAt: now
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in setData:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Get data for a specific key
 * GET /api/user-app/data/get?userId=X&appId=Y&key=Z
 */
export async function getData(request, env) {
  try {
    // Validate authentication
    const auth = await validateAuth(request, env)
    if (!auth.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const appId = url.searchParams.get('appId')
    const key = url.searchParams.get('key')

    if (!userId || !appId || !key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: userId, appId, key'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify the authenticated user matches the userId in the request
    if (auth.userId !== userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Cannot access data for another user'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const result = await env.vegvisr_org.prepare(`
      SELECT id, user_id, app_id, key, value, created_at, updated_at
      FROM user_app_storage
      WHERE user_id = ? AND app_id = ? AND key = ?
    `).bind(userId, appId, key).first()

    if (!result) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Data not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: result.id,
        userId: result.user_id,
        appId: result.app_id,
        key: result.key,
        value: JSON.parse(result.value),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in getData:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * List all data for an app
 * GET /api/user-app/data/list?userId=X&appId=Y
 */
export async function listData(request, env) {
  try {
    // Validate authentication
    const auth = await validateAuth(request, env)
    if (!auth.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const appId = url.searchParams.get('appId')

    if (!userId || !appId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: userId, appId'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify the authenticated user matches the userId in the request
    if (auth.userId !== userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Cannot access data for another user'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const result = await env.vegvisr_org.prepare(`
      SELECT id, user_id, app_id, key, value, created_at, updated_at
      FROM user_app_storage
      WHERE user_id = ? AND app_id = ?
      ORDER BY key ASC
    `).bind(userId, appId).all()

    const items = result.results.map(row => ({
      id: row.id,
      userId: row.user_id,
      appId: row.app_id,
      key: row.key,
      value: JSON.parse(row.value),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return new Response(JSON.stringify({
      success: true,
      count: items.length,
      data: items
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in listData:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Delete data for a specific key
 * DELETE /api/user-app/data/delete
 * Body: { userId, appId, key }
 */
export async function deleteData(request, env) {
  try {
    // Validate authentication
    const auth = await validateAuth(request, env)
    if (!auth.valid) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }

    const { userId, appId, key } = await request.json()

    if (!userId || !appId || !key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, appId, key'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify the authenticated user matches the userId in the request
    if (auth.userId !== userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Cannot delete data for another user'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    // Verify user is Superadmin
    if (auth.role !== 'Superadmin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Superadmin role required'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const result = await env.vegvisr_org.prepare(`
      DELETE FROM user_app_storage
      WHERE user_id = ? AND app_id = ? AND key = ?
    `).bind(userId, appId, key).run()

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Data not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Data deleted successfully'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in deleteData:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
