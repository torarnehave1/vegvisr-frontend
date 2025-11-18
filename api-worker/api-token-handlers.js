/**
 * API Token Management Handlers
 * Handles creation, validation, and management of API tokens
 */

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a cryptographically secure API token
 * Format: vv_[env]_[32_random_chars]
 */
function generateAPIToken(environment = 'prod') {
  const randomBytes = new Uint8Array(24) // 24 bytes = 48 hex chars, we'll take 32
  crypto.getRandomValues(randomBytes)
  const randomString = Array.from(randomBytes, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('').substring(0, 32)

  return `vv_${environment}_${randomString}`
}

/**
 * Hash a token for secure storage
 */
async function hashToken(token) {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extract token prefix for display (first 16 chars)
 */
function getTokenPrefix(token) {
  return token.substring(0, Math.min(16, token.length))
}

/**
 * Validate token scopes against available scopes
 */
async function validateScopes(scopes, env) {
  const query = `SELECT scope_name FROM api_scopes WHERE is_active = 1`
  const result = await env.vegvisr_org.prepare(query).all()
  const validScopes = result.results.map(r => r.scope_name)

  const invalidScopes = scopes.filter(scope => !validScopes.includes(scope))
  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`)
  }

  return true
}

/**
 * Verify user owns a token
 */
async function verifyTokenOwnership(tokenId, userId, env) {
  const query = `SELECT user_id FROM api_tokens WHERE id = ?`
  const result = await env.vegvisr_org.prepare(query).bind(tokenId).first()

  if (!result) {
    throw new Error('Token not found')
  }

  if (result.user_id !== userId) {
    throw new Error('Unauthorized: You do not own this token')
  }

  return true
}

// ============================================
// API Token Handlers
// ============================================

/**
 * Create a new API token
 * POST /api/tokens/create
 */
export async function handleCreateAPIToken(request, env) {
  try {
    const { name, scopes = ['ai:chat'], expiresIn = null, rateLimit = 1000 } = await request.json()

    // Get user from emailVerificationToken (for now, until we have session management)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Look up user by emailVerificationToken in config table
    const userQuery = `SELECT email, data FROM config WHERE email IS NOT NULL`
    const allUsers = await env.vegvisr_org.prepare(userQuery).all()

    let user = null
    for (const row of allUsers.results) {
      const data = JSON.parse(row.data || '{}')
      if (data.emailVerificationToken === userToken) {
        user = { email: row.email, emailVerificationToken: userToken }
        break
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Validate scopes
    await validateScopes(scopes, env)

    // Generate token
    const token = generateAPIToken('prod')
    const tokenHash = await hashToken(token)
    const tokenPrefix = getTokenPrefix(token)
    const tokenId = crypto.randomUUID()

    // Calculate expiration
    let expiresAt = null
    if (expiresIn) {
      const expireDate = new Date(Date.now() + expiresIn * 1000)
      expiresAt = expireDate.toISOString()
    }

    // Insert token
    const insertQuery = `
      INSERT INTO api_tokens (
        id, user_id, token, token_name, token_prefix,
        scopes, rate_limit, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `

    await env.vegvisr_org
      .prepare(insertQuery)
      .bind(
        tokenId,
        user.email,  // Use email as user_id
        tokenHash,
        name,
        tokenPrefix,
        JSON.stringify(scopes),
        rateLimit,
        expiresAt
      )
      .run()

    // Return response with FULL token (only time it's shown!)
    return new Response(JSON.stringify({
      success: true,
      token: {
        id: tokenId,
        name,
        token, // Full token - shown only once!
        prefix: tokenPrefix,
        scopes,
        rateLimit,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
      warning: 'Save this token now. You won\'t be able to see it again!',
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error creating API token:', error)
    return new Response(JSON.stringify({
      error: 'Failed to create API token',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

/**
 * List all tokens for a user
 * GET /api/tokens/list
 */
export async function handleListAPITokens(request, env) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Look up user by emailVerificationToken in config table
    const userQuery = `SELECT email, data FROM config WHERE email IS NOT NULL`
    const allUsers = await env.vegvisr_org.prepare(userQuery).all()

    let user = null
    for (const row of allUsers.results) {
      const data = JSON.parse(row.data || '{}')
      if (data.emailVerificationToken === userToken) {
        user = { email: row.email }
        break
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Get tokens with usage counts
    const query = `
      SELECT
        t.id,
        t.token_name as name,
        t.token_prefix as prefix,
        t.scopes,
        t.rate_limit as rateLimit,
        t.is_active as isActive,
        t.last_used_at as lastUsedAt,
        t.expires_at as expiresAt,
        t.created_at as createdAt,
        COUNT(u.id) as usageCount
      FROM api_tokens t
      LEFT JOIN api_token_usage u ON t.id = u.token_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `

    const result = await env.vegvisr_org.prepare(query).bind(user.email).all()

    // Parse JSON fields
    const tokens = result.results.map(token => ({
      ...token,
      scopes: JSON.parse(token.scopes),
      isActive: Boolean(token.isActive),
      usageCount: token.usageCount || 0,
    }))

    return new Response(JSON.stringify({
      success: true,
      tokens,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error listing API tokens:', error)
    return new Response(JSON.stringify({
      error: 'Failed to list API tokens',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

/**
 * Revoke an API token
 * DELETE /api/tokens/:tokenId
 */
export async function handleRevokeAPIToken(request, env, tokenId) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Look up user
    const userQuery = `SELECT user_id FROM users WHERE emailVerificationToken = ?`
    const user = await env.vegvisr_org.prepare(userQuery).bind(userToken).first()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Verify ownership
    await verifyTokenOwnership(tokenId, user.email, env)

    // Delete token
    const deleteQuery = `DELETE FROM api_tokens WHERE id = ?`
    await env.vegvisr_org.prepare(deleteQuery).bind(tokenId).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'Token revoked successfully',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error revoking API token:', error)
    return new Response(JSON.stringify({
      error: 'Failed to revoke API token',
      details: error.message
    }), {
      status: error.message.includes('Unauthorized') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

/**
 * Update an API token
 * PATCH /api/tokens/:tokenId
 */
export async function handleUpdateAPIToken(request, env, tokenId) {
  try {
    const { name, isActive, rateLimit } = await request.json()

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Look up user
    const userQuery = `SELECT user_id FROM users WHERE emailVerificationToken = ?`
    const user = await env.vegvisr_org.prepare(userQuery).bind(userToken).first()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Verify ownership
    await verifyTokenOwnership(tokenId, user.email, env)

    // Build update query
    const updates = []
    const bindings = []

    if (name !== undefined) {
      updates.push('token_name = ?')
      bindings.push(name)
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?')
      bindings.push(isActive ? 1 : 0)
    }
    if (rateLimit !== undefined) {
      updates.push('rate_limit = ?')
      bindings.push(rateLimit)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    bindings.push(tokenId)

    const updateQuery = `
      UPDATE api_tokens
      SET ${updates.join(', ')}
      WHERE id = ?
    `

    await env.vegvisr_org.prepare(updateQuery).bind(...bindings).run()

    // Fetch updated token
    const selectQuery = `SELECT * FROM api_tokens WHERE id = ?`
    const updatedToken = await env.vegvisr_org.prepare(selectQuery).bind(tokenId).first()

    return new Response(JSON.stringify({
      success: true,
      token: {
        ...updatedToken,
        scopes: JSON.parse(updatedToken.scopes),
        isActive: Boolean(updatedToken.is_active),
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error updating API token:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update API token',
      details: error.message
    }), {
      status: error.message.includes('Unauthorized') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

/**
 * Get token usage statistics
 * GET /api/tokens/:tokenId/usage
 */
export async function handleGetTokenUsage(request, env, tokenId) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userToken = authHeader.replace('Bearer ', '')

    // Look up user
    const userQuery = `SELECT user_id FROM users WHERE emailVerificationToken = ?`
    const user = await env.vegvisr_org.prepare(userQuery).bind(userToken).first()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Verify ownership
    await verifyTokenOwnership(tokenId, user.email, env)

    // Get usage stats
    const statsQuery = `
      SELECT
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successfulRequests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failedRequests,
        AVG(response_time_ms) as averageResponseTime,
        endpoint,
        COUNT(*) as count
      FROM api_token_usage
      WHERE token_id = ?
      GROUP BY endpoint
    `

    const stats = await env.vegvisr_org.prepare(statsQuery).bind(tokenId).all()

    // Get recent usage
    const recentQuery = `
      SELECT endpoint, method, status_code as statusCode,
             response_time_ms as responseTime, created_at as timestamp
      FROM api_token_usage
      WHERE token_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `

    const recentUsage = await env.vegvisr_org.prepare(recentQuery).bind(tokenId).all()

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalRequests: stats.results[0]?.totalRequests || 0,
        successfulRequests: stats.results[0]?.successfulRequests || 0,
        failedRequests: stats.results[0]?.failedRequests || 0,
        averageResponseTime: Math.round(stats.results[0]?.averageResponseTime || 0),
        requestsByEndpoint: stats.results.reduce((acc, row) => {
          acc[row.endpoint] = row.count
          return acc
        }, {}),
      },
      recentUsage: recentUsage.results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })

  } catch (error) {
    console.error('Error getting token usage:', error)
    return new Response(JSON.stringify({
      error: 'Failed to get token usage',
      details: error.message
    }), {
      status: error.message.includes('Unauthorized') ? 403 : 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
}

// CORS headers for exports
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
