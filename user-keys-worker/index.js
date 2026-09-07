/**
 * User Keys Worker - Centralized User API Key Management
 *
 * This worker is the single source of truth for user API key management.
 * It provides secure storage, retrieval, and management of user-provided
 * API keys using double-layer encryption in D1 database.
 *
 * Features:
 * - Store encrypted user API keys in D1 (scalable to millions of users)
 * - Retrieve and decrypt keys for API provider workers
 * - Manage key metadata in D1
 * - List and delete user keys
 *
 * Endpoints:
 * - PUT /user-api-keys - Store new API key
 * - GET /user-api-keys - List user's API keys metadata
 * - DELETE /user-api-keys/:provider - Delete specific key
 * - GET /health - Health check
 */

import { storeUserApiKey, deleteUserApiKey, listUserApiKeys } from './src/utils/secretsManager.js'

// CORS configuration (matches api-worker and anthropic-worker)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-user-email, x-user-role, X-API-Token',
  'Access-Control-Max-Age': '86400'
}

/**
 * Main worker handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      })
    }

    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({
          status: 'healthy',
          worker: 'user-keys-worker',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        })
      }

      // PUT /user-api-keys - Store new API key
      if (path === '/user-api-keys' && request.method === 'PUT') {
        const body = await request.json()
        const { userId, provider, apiKey, metadata } = body

        // Validation
        if (!userId) {
          return jsonResponse({ error: 'Missing userId' }, 400)
        }
        if (!provider) {
          return jsonResponse({ error: 'Missing provider' }, 400)
        }
        if (!apiKey) {
          return jsonResponse({ error: 'Missing apiKey' }, 400)
        }

        // Validate provider
        const validProviders = ['openai', 'anthropic', 'google', 'grok', 'perplexity', 'proff']
        if (!validProviders.includes(provider.toLowerCase())) {
          return jsonResponse({
            error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
          }, 400)
        }

        // Store encrypted key in D1 (includes metadata)
        await storeUserApiKey(env, userId, provider, apiKey, metadata || {})

        return jsonResponse({
          success: true,
          message: 'API key stored successfully',
          provider
        })
      }

      // GET /user-api-keys - List user's API keys (metadata only)
      if (path === '/user-api-keys' && request.method === 'GET') {
        const userId = url.searchParams.get('userId')

        if (!userId) {
          return jsonResponse({ error: 'Missing userId parameter' }, 400)
        }

        // Get keys from D1
        const keys = await listUserApiKeys(env, userId)

        return jsonResponse({
          userId,
          keys,
          count: keys.length
        })
      }

      // DELETE /user-api-keys/:provider - Delete specific API key
      if (path.startsWith('/user-api-keys/') && request.method === 'DELETE') {
        const provider = path.split('/')[2]
        const userId = url.searchParams.get('userId')

        if (!userId) {
          return jsonResponse({ error: 'Missing userId parameter' }, 400)
        }

        if (!provider) {
          return jsonResponse({ error: 'Missing provider' }, 400)
        }

        // Delete from D1
        await deleteUserApiKey(env, userId, provider)

        return jsonResponse({
          success: true,
          message: 'API key deleted successfully',
          provider
        })
      }

      // 404 - Route not found
      return jsonResponse({
        error: 'Not Found',
        path,
        method: request.method,
        availableEndpoints: [
          'PUT /user-api-keys',
          'GET /user-api-keys?userId=xxx',
          'DELETE /user-api-keys/:provider?userId=xxx',
          'GET /health'
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

/**
 * Helper: Create JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  })
}
