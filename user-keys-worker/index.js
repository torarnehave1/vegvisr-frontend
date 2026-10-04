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

import { storeUserApiKey, getUserApiKey, deleteUserApiKey, listUserApiKeys } from './src/utils/secretsManager.js'

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

        // Validate provider.
        //
        // The six names are AI providers, one key each. `imap:<address>` is a second, deliberately
        // narrower shape, added 2026-10-04: a mailbox password for sending a copy of outgoing mail
        // to the sender's own Sent folder. The address is IN the provider string because
        // UNIQUE(user_id, provider) is what keeps one row per credential, and a person can hold
        // several mailboxes.
        //
        // It is kept as a shape rather than a free string because this validation is the only
        // thing stopping arbitrary values from accumulating in the table — and worth saying
        // plainly: an IMAP password is a far more powerful credential than any of the six. Those
        // buy a model call; this one reads and writes every message in a mailbox.
        const validProviders = ['openai', 'anthropic', 'google', 'grok', 'perplexity', 'proff']
        const lowered = provider.toLowerCase()
        const isMailbox = /^imap:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowered)
        if (!validProviders.includes(lowered) && !isMailbox) {
          return jsonResponse({
            error: `Invalid provider. Must be one of: ${validProviders.join(', ')} — or "imap:<address>" for a mailbox password.`
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

      // GET /mailbox-password?address=... - the ONLY route that returns a decrypted secret.
      //
      // Added 2026-10-04 so dev-worker can file a sent copy over IMAP. Deliberately narrow on two
      // axes, because the first attempt was to copy the decryption into dev-worker and give it the
      // master key — which would have let the MCP server decrypt every row in this table, when it
      // needs one mailbox password.
      //
      //   1. Service bindings only. A binding addresses this worker by its BINDING NAME, and that
      //      hostname is not routable from the internet — Cloudflare only delivers public requests
      //      on this worker's own routes, which always carry the public hostname. The signal
      //      cannot be forged from outside. (Same reasoning as dev-worker's validateAuth.)
      //   2. `imap:` providers only. An OpenAI or Anthropic key is not reachable here at any price.
      if (path === '/mailbox-password' && request.method === 'GET') {
        if (new URL(request.url).hostname !== 'user-keys-worker') {
          return jsonResponse({ error: 'This route is reachable only over a service binding.' }, 403)
        }
        const address = (url.searchParams.get('address') || '').trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
          return jsonResponse({ error: 'address must be a mailbox address' }, 400)
        }
        const provider = `imap:${address}`

        // The table is UNIQUE(user_id, provider), so two people could each hold a password for the
        // same mailbox. Refuse rather than guess which one the caller meant.
        const rows = await env.DB
          .prepare('SELECT user_id, key_name FROM user_api_keys WHERE provider = ?1 AND enabled = 1')
          .bind(provider)
          .all()
        const found = rows.results || []
        if (found.length === 0) return jsonResponse({ error: `No mailbox password stored for ${address}` }, 404)
        if (found.length > 1) {
          return jsonResponse({ error: `${found.length} users hold a password for ${address}; pass userId to disambiguate` }, 409)
        }

        const password = await getUserApiKey(env, found[0].user_id, provider)
        const [hostname, port] = String(found[0].key_name || '').split(':')
        return jsonResponse({
          success: true,
          address,
          password,
          hostname: hostname || null,
          port: Number(port) || 993,
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
