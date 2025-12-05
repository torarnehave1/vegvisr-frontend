/**
 * D1 Secrets Manager - User API Keys
 *
 * This module manages user API keys using D1 database storage
 * with double-layer encryption:
 *
 * 1. Application-level encryption (AES-256-GCM) - this module
 * 2. Cloudflare infrastructure encryption - automatic
 *
 * Security: Zero-knowledge storage
 * - User API keys encrypted BEFORE storage in D1
 * - D1 only stores encrypted blobs (never plaintext)
 * - Decryption only happens at runtime for API calls
 * - Plaintext keys never logged or persisted
 *
 * Scalability: Supports millions of users
 * - D1 database scales horizontally
 * - Indexed queries for fast lookups
 * - No per-secret API call overhead
 */

import { encryptApiKey, decryptApiKey } from './encryption.js'

/**
 * Store user API key (encrypted) in D1 database
 *
 * Process:
 * 1. Encrypt API key with ENCRYPTION_MASTER_KEY (AES-256-GCM)
 * 2. Store encrypted blob in D1 user_api_keys table
 * 3. Uses UPSERT pattern (INSERT ... ON CONFLICT DO UPDATE)
 *
 * @param {object} env - Worker environment (DB, ENCRYPTION_MASTER_KEY)
 * @param {string} userId - User ID (from user database)
 * @param {string} provider - Provider name (openai, anthropic, google, etc.)
 * @param {string} plaintextApiKey - User's API key in plaintext
 * @param {object} metadata - Optional metadata (keyName, displayName, etc.)
 * @returns {Promise<{success: boolean, provider: string}>}
 *
 * @example
 * const result = await storeUserApiKey(env, 'user123', 'openai', 'sk-proj-abc...', {keyName: 'My Key'})
 * // Stores encrypted key in D1: user_api_keys table
 */
export async function storeUserApiKey(env, userId, provider, plaintextApiKey, metadata = {}) {
  // Validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!plaintextApiKey || typeof plaintextApiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string')
  }

  if (!env.ENCRYPTION_MASTER_KEY) {
    throw new Error('ENCRYPTION_MASTER_KEY not set in worker environment')
  }

  if (!env.DB) {
    throw new Error('D1 database binding not configured')
  }

  try {
    // STEP 1: ENCRYPT the API key
    console.log(`[SecretsManager] Encrypting API key for ${provider}...`)
    const encryptedApiKey = await encryptApiKey(plaintextApiKey, env.ENCRYPTION_MASTER_KEY)

    // STEP 2: Store ENCRYPTED blob in D1
    console.log(`[SecretsManager] Storing encrypted key in D1 for user ${userId}, provider ${provider}`)
    
    const keyName = metadata.keyName || `${provider} API Key`
    const displayName = metadata.displayName || provider
    
    const result = await env.DB.prepare(`
      INSERT INTO user_api_keys (user_id, provider, encrypted_key, key_name, display_name)
      VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        encrypted_key = excluded.encrypted_key,
        key_name = excluded.key_name,
        display_name = excluded.display_name,
        updated_at = CURRENT_TIMESTAMP
    `).bind(userId, provider, encryptedApiKey, keyName, displayName).run()

    if (!result.success) {
      throw new Error(`D1 error: ${JSON.stringify(result.error)}`)
    }

    console.log(`[SecretsManager] ✅ Encrypted key stored successfully in D1`)

    return { success: true, provider }

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to store secret: ${error.message}`)
    throw new Error(`Failed to store user API key: ${error.message}`)
  }
}

/**
 * Get user API key from D1 database (decrypt)
 *
 * Process:
 * 1. Read encrypted blob from D1 user_api_keys table
 * 2. Decrypt with ENCRYPTION_MASTER_KEY
 * 3. Return plaintext API key (for immediate use only)
 *
 * SECURITY: Plaintext key returned for API call only, never logged or persisted
 *
 * @param {object} env - Worker environment (DB, ENCRYPTION_MASTER_KEY)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<string>} Plaintext API key
 *
 * @example
 * const apiKey = await getUserApiKey(env, 'user123', 'openai')
 * // Use immediately for API call
 * const response = await callOpenAI(apiKey, messages)
 * // apiKey discarded by garbage collector
 */
export async function getUserApiKey(env, userId, provider) {
  // Validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.ENCRYPTION_MASTER_KEY) {
    throw new Error('ENCRYPTION_MASTER_KEY not set in worker environment')
  }

  if (!env.DB) {
    throw new Error('D1 database binding not configured')
  }

  try {
    // STEP 1: Read ENCRYPTED blob from D1
    console.log(`[SecretsManager] Reading encrypted key from D1 for user ${userId}, provider ${provider}`)
    
    const result = await env.DB.prepare(`
      SELECT encrypted_key FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
    `).bind(userId, provider).first()

    if (!result || !result.encrypted_key) {
      throw new Error(`API key not found for provider: ${provider}`)
    }

    // STEP 2: DECRYPT to get plaintext API key
    console.log(`[SecretsManager] Decrypting API key for ${provider}...`)
    const plaintextApiKey = await decryptApiKey(result.encrypted_key, env.ENCRYPTION_MASTER_KEY)

    // STEP 3: Update last_used timestamp
    await env.DB.prepare(`
      UPDATE user_api_keys SET last_used = CURRENT_TIMESTAMP
      WHERE user_id = ?1 AND provider = ?2
    `).bind(userId, provider).run()

    console.log(`[SecretsManager] ✅ API key decrypted successfully`)

    // STEP 4: Return plaintext (for immediate use in API call)
    return plaintextApiKey

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to get API key: ${error.message}`)
    throw new Error(`Failed to retrieve user API key: ${error.message}`)
  }
}

/**
 * Delete user API key from D1 database
 *
 * @param {object} env - Worker environment (DB)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<{success: boolean}>}
 *
 * @example
 * await deleteUserApiKey(env, 'user123', 'openai')
 * // Encrypted key deleted from D1 user_api_keys table
 */
export async function deleteUserApiKey(env, userId, provider) {
  // Validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.DB) {
    throw new Error('D1 database binding not configured')
  }

  try {
    console.log(`[SecretsManager] Deleting key from D1 for user ${userId}, provider ${provider}`)
    
    await env.DB.prepare(`
      DELETE FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2
    `).bind(userId, provider).run()

    console.log(`[SecretsManager] ✅ Key deleted successfully from D1`)

    return { success: true }

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to delete key: ${error.message}`)
    throw new Error(`Failed to delete user API key: ${error.message}`)
  }
}

/**
 * List all user API keys for a user (metadata only)
 * Returns metadata from D1, never returns actual decrypted keys
 *
 * @param {object} env - Worker environment (DB)
 * @param {string} userId - User ID
 * @returns {Promise<Array<{provider: string, keyName: string, createdAt: string, updatedAt: string, lastUsed: string, enabled: boolean}>>}
 *
 * @example
 * const keys = await listUserApiKeys(env, 'user123')
 * // Returns: [{provider: 'openai', keyName: 'My Key', createdAt: '...', ...}, ...]
 */
export async function listUserApiKeys(env, userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!env.DB) {
    throw new Error('D1 database binding not configured')
  }

  try {
    console.log(`[SecretsManager] Listing keys from D1 for user ${userId}`)
    
    const result = await env.DB.prepare(`
      SELECT 
        user_id, provider, key_name, display_name, enabled,
        created_at, updated_at, last_used
      FROM user_api_keys
      WHERE user_id = ?1
      ORDER BY created_at DESC
    `).bind(userId).all()

    const keys = result.results || []

    console.log(`[SecretsManager] Found ${keys.length} keys for user ${userId}`)

    return keys.map(row => ({
      provider: row.provider,
      keyName: row.key_name,
      displayName: row.display_name,
      enabled: Boolean(row.enabled),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsed: row.last_used,
      isActive: Boolean(row.enabled)
    }))

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to list keys: ${error.message}`)
    throw new Error(`Failed to list user API keys: ${error.message}`)
  }
}
