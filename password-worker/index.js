/**
 * Password Worker - Knowledge Graph Password Protection
 * @description Handles password protection for Knowledge Graphs
 * @version 1.0.0
 * @author Vegvisr Team
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

// Helper function to create response with CORS
function createResponse(body, status = 200, additionalHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders
    }
  })
}

// Helper function to create error response
function createErrorResponse(message, status = 500) {
  console.error('Error:', message)
  return createResponse(JSON.stringify({
    success: false,
    error: message
  }), status)
}

// Generate session token
function generateSessionToken(graphId) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2)
  return btoa(`${graphId}:${timestamp}:${randomStr}:verified`)
}

// Validate session token
function validateSessionToken(token, graphId) {
  try {
    const decoded = atob(token)
    const parts = decoded.split(':')
    if (parts.length === 4 && parts[0] === graphId && parts[3] === 'verified') {
      const timestamp = parseInt(parts[1])
      const now = Date.now()
      // Token valid for 24 hours
      return (now - timestamp) < (24 * 60 * 60 * 1000)
    }
    return false
  } catch {
    return false
  }
}

// Simple password hashing using Web Crypto API (available in Cloudflare Workers)
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'vegvisr_salt_2024') // Add salt
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Verify password against hash
async function verifyPassword(password, hash) {
  const inputHash = await hashPassword(password)
  return inputHash === hash
}

// Check if graph requires password protection
async function handleCheckPassword(request, env) {
  const url = new URL(request.url)
  const graphId = url.searchParams.get('id')

  if (!graphId) {
    return createErrorResponse('Graph ID required', 400)
  }

  try {
    // Check if graph has password protection
    // For now, we'll use D1 database to store password info
    const query = `SELECT password_hash FROM graph_passwords WHERE graph_id = ?`
    const result = await env.DB.prepare(query).bind(graphId).first()

    const passwordRequired = result && result.password_hash ? true : false

    return createResponse(JSON.stringify({
      passwordRequired,
      graphId
    }))
  } catch (error) {
    console.error('Database error checking password:', error)
    // Fallback: check hardcoded protected graphs for demo
    const protectedGraphs = ['demo-protected', 'private-graph-123']
    const passwordRequired = protectedGraphs.includes(graphId)

    return createResponse(JSON.stringify({
      passwordRequired,
      graphId
    }))
  }
}

// Verify password for a graph
async function handleVerifyPassword(request, env) {
  try {
    const { graphId, password } = await request.json()

    if (!graphId || !password) {
      return createErrorResponse('Graph ID and password required', 400)
    }

    // Get stored password hash from database
    let storedHash = null
    try {
      const query = `SELECT password_hash FROM graph_passwords WHERE graph_id = ?`
      const result = await env.DB.prepare(query).bind(graphId).first()
      storedHash = result?.password_hash
    } catch (dbError) {
      console.error('Database error:', dbError)
      // Fallback to hardcoded hashes for demo
      const demoHashes = {
        'demo-protected': '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiS.lCc56.8O', // "demo123"
        'private-graph-123': '$2a$12$8K9PoLnF5q2HwQTzK6VQ6eaFvWwWR8YW3VtKj7fJ9mJxV8dT3pQ.e' // "secret456"
      }
      storedHash = demoHashes[graphId]
    }

    if (!storedHash) {
      return createResponse(JSON.stringify({
        verified: false,
        message: 'Graph not found or not password protected'
      }))
    }

    // Verify password using Web Crypto API
    const verified = await verifyPassword(password, storedHash)

    if (verified) {
      const token = generateSessionToken(graphId)

      return createResponse(JSON.stringify({
        verified: true,
        token,
        message: 'Access granted',
        expiresIn: '24 hours'
      }))
    } else {
      return createResponse(JSON.stringify({
        verified: false,
        message: 'Incorrect password'
      }))
    }
  } catch (error) {
    console.error('Password verification error:', error)
    return createErrorResponse('Password verification failed', 500)
  }
}

// Set password for a graph (admin only)
async function handleSetPassword(request, env) {
  try {
    const { graphId, password, adminKey } = await request.json()

    // Verify admin access
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return createErrorResponse('Unauthorized: Invalid admin key', 401)
    }

    if (!graphId || !password) {
      return createErrorResponse('Graph ID and password required', 400)
    }

    if (password.length < 6) {
      return createErrorResponse('Password must be at least 6 characters long', 400)
    }

    // Hash the password using Web Crypto API
    const hashedPassword = await hashPassword(password)

    try {
      // Store in database
      const query = `INSERT OR REPLACE INTO graph_passwords (graph_id, password_hash, created_at, updated_at)
                     VALUES (?, ?, datetime('now'), datetime('now'))`
      await env.DB.prepare(query).bind(graphId, hashedPassword).run()

      return createResponse(JSON.stringify({
        success: true,
        message: 'Password set successfully',
        graphId
      }))
    } catch (dbError) {
      console.error('Database error setting password:', dbError)
      return createErrorResponse('Failed to store password', 500)
    }
  } catch (error) {
    console.error('Set password error:', error)
    return createErrorResponse('Failed to set password', 500)
  }
}

// Remove password protection from a graph (admin only)
async function handleRemovePassword(request, env) {
  try {
    const { graphId, adminKey } = await request.json()

    // Verify admin access
    if (!adminKey || adminKey !== env.ADMIN_KEY) {
      return createErrorResponse('Unauthorized: Invalid admin key', 401)
    }

    if (!graphId) {
      return createErrorResponse('Graph ID required', 400)
    }

    try {
      // Remove from database
      const query = `DELETE FROM graph_passwords WHERE graph_id = ?`
      const result = await env.DB.prepare(query).bind(graphId).run()

      return createResponse(JSON.stringify({
        success: true,
        message: 'Password protection removed',
        graphId,
        deleted: result.changes > 0
      }))
    } catch (dbError) {
      console.error('Database error removing password:', dbError)
      return createErrorResponse('Failed to remove password protection', 500)
    }
  } catch (error) {
    console.error('Remove password error:', error)
    return createErrorResponse('Failed to remove password protection', 500)
  }
}

// Validate session token endpoint
async function handleValidateToken(request) {
  try {
    const { token, graphId } = await request.json()

    if (!token || !graphId) {
      return createErrorResponse('Token and graph ID required', 400)
    }

    const valid = validateSessionToken(token, graphId)

    return createResponse(JSON.stringify({
      valid,
      message: valid ? 'Token is valid' : 'Token is invalid or expired'
    }))
  } catch (error) {
    console.error('Token validation error:', error)
    return createErrorResponse('Token validation failed', 500)
  }
}

// List all protected graphs (admin only)
async function handleListProtectedGraphs(request, env) {
  const url = new URL(request.url)
  const adminKey = url.searchParams.get('adminKey')

  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return createErrorResponse('Unauthorized: Invalid admin key', 401)
  }

  try {
    const query = `SELECT graph_id, created_at, updated_at FROM graph_passwords ORDER BY updated_at DESC`
    const result = await env.DB.prepare(query).all()

    return createResponse(JSON.stringify({
      success: true,
      protectedGraphs: result.results || [],
      count: result.results?.length || 0
    }))
  } catch (dbError) {
    console.error('Database error listing graphs:', dbError)
    return createErrorResponse('Failed to list protected graphs', 500)
  }
}

// Main worker handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      })
    }

    try {
      // Route requests based on path
      switch (path) {
        case '/checkpassword':
          if (request.method === 'GET') {
            return await handleCheckPassword(request, env)
          }
          break

        case '/verifypassword':
          if (request.method === 'POST') {
            return await handleVerifyPassword(request, env)
          }
          break

        case '/setpassword':
          if (request.method === 'POST') {
            return await handleSetPassword(request, env)
          }
          break

        case '/removepassword':
          if (request.method === 'POST') {
            return await handleRemovePassword(request, env)
          }
          break

        case '/validatetoken':
          if (request.method === 'POST') {
            return await handleValidateToken(request, env)
          }
          break

        case '/listprotected':
          if (request.method === 'GET') {
            return await handleListProtectedGraphs(request, env)
          }
          break

        case '/health':
          return createResponse(JSON.stringify({
            status: 'healthy',
            service: 'password-worker',
            version: '1.0.0',
            timestamp: new Date().toISOString()
          }))

        default:
          return createErrorResponse('Endpoint not found', 404)
      }

      return createErrorResponse('Method not allowed', 405)

    } catch (error) {
      console.error('Worker error:', error)
      return createErrorResponse('Internal server error', 500)
    }
  }
}
