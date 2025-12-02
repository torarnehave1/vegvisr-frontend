/**
 * Cloudflare Secrets Manager - User API Keys
 *
 * This module manages user API keys using Cloudflare Secrets API
 * with double-layer encryption:
 *
 * 1. Application-level encryption (AES-256-GCM) - this module
 * 2. Cloudflare infrastructure encryption - automatic
 *
 * Security: Zero-knowledge storage
 * - User API keys encrypted BEFORE storage
 * - Cloudflare only sees encrypted blobs (never plaintext)
 * - Decryption only happens at runtime for API calls
 * - Plaintext keys never logged or persisted
 */

import { encryptApiKey, decryptApiKey } from './encryption.js'

/**
 * Store user API key (encrypted) as Cloudflare Worker secret
 *
 * Process:
 * 1. Encrypt API key with ENCRYPTION_MASTER_KEY (AES-256-GCM)
 * 2. Store encrypted blob as Cloudflare Worker secret via REST API
 * 3. Secret named: USER_{userId}_{provider}_KEY
 *
 * @param {object} env - Worker environment (CF_API_TOKEN, CF_ACCOUNT_ID, ENCRYPTION_MASTER_KEY)
 * @param {string} userId - User ID (from user database)
 * @param {string} provider - Provider name (openai, anthropic, google, etc.)
 * @param {string} plaintextApiKey - User's API key in plaintext
 * @returns {Promise<{success: boolean, secretName: string}>}
 *
 * @example
 * const result = await storeUserApiKey(env, 'user123', 'openai', 'sk-proj-abc...')
 * // Creates secret: USER_user123_openai_KEY with encrypted value
 */
export async function storeUserApiKey(env, userId, provider, plaintextApiKey) {
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

  if (!env.CF_API_TOKEN) {
    throw new Error('CF_API_TOKEN not set in worker environment')
  }

  if (!env.CF_ACCOUNT_ID) {
    throw new Error('CF_ACCOUNT_ID not set in worker environment')
  }

  const secretName = `USER_${userId}_${provider}_KEY`
  const accountId = env.CF_ACCOUNT_ID
  const apiToken = env.CF_API_TOKEN
  const scriptName = 'vegvisr-api-worker'

  try {
    // STEP 1: ENCRYPT the API key
    console.log(`[SecretsManager] Encrypting API key for ${provider}...`)
    const encryptedApiKey = await encryptApiKey(plaintextApiKey, env.ENCRYPTION_MASTER_KEY)

    // STEP 2: Store ENCRYPTED blob as Cloudflare secret
    console.log(`[SecretsManager] Storing encrypted secret: ${secretName}`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/secrets`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: secretName,
          text: encryptedApiKey,  // ENCRYPTED, not plaintext
          type: 'secret_text'
        })
      }
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(result.errors)}`)
    }

    console.log(`[SecretsManager] ✅ Secret stored successfully: ${secretName}`)

    return { success: true, secretName }

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to store secret: ${error.message}`)
    throw new Error(`Failed to store user API key: ${error.message}`)
  }
}

/**
 * Get user API key from Cloudflare Worker secret (decrypt)
 *
 * Process:
 * 1. Read encrypted blob from worker environment (env[secretName])
 * 2. Decrypt with ENCRYPTION_MASTER_KEY
 * 3. Return plaintext API key (for immediate use only)
 *
 * SECURITY: Plaintext key returned for API call only, never logged or persisted
 *
 * @param {object} env - Worker environment (ENCRYPTION_MASTER_KEY)
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

  const secretName = `USER_${userId}_${provider}_KEY`

  try {
    // STEP 1: Read ENCRYPTED blob from environment
    const encryptedApiKey = env[secretName]

    if (!encryptedApiKey) {
      throw new Error(`API key not found for provider: ${provider}`)
    }

    // STEP 2: DECRYPT to get plaintext API key
    console.log(`[SecretsManager] Decrypting API key for ${provider}...`)
    const plaintextApiKey = await decryptApiKey(encryptedApiKey, env.ENCRYPTION_MASTER_KEY)

    console.log(`[SecretsManager] ✅ API key decrypted successfully`)

    // STEP 3: Return plaintext (for immediate use in API call)
    return plaintextApiKey

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to get API key: ${error.message}`)
    throw new Error(`Failed to retrieve user API key: ${error.message}`)
  }
}

/**
 * Delete user API key secret from Cloudflare
 *
 * @param {object} env - Worker environment (CF_API_TOKEN, CF_ACCOUNT_ID)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<{success: boolean}>}
 *
 * @example
 * await deleteUserApiKey(env, 'user123', 'openai')
 * // Secret USER_user123_openai_KEY deleted from Cloudflare
 */
export async function deleteUserApiKey(env, userId, provider) {
  // Validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.CF_API_TOKEN) {
    throw new Error('CF_API_TOKEN not set in worker environment')
  }

  if (!env.CF_ACCOUNT_ID) {
    throw new Error('CF_ACCOUNT_ID not set in worker environment')
  }

  const secretName = `USER_${userId}_${provider}_KEY`
  const accountId = env.CF_ACCOUNT_ID
  const apiToken = env.CF_API_TOKEN
  const scriptName = 'vegvisr-api-worker'

  try {
    console.log(`[SecretsManager] Deleting secret: ${secretName}`)

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/secrets/${secretName}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      }
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(result.errors)}`)
    }

    console.log(`[SecretsManager] ✅ Secret deleted successfully: ${secretName}`)

    return { success: true }

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to delete secret: ${error.message}`)
    throw new Error(`Failed to delete user API key: ${error.message}`)
  }
}

/**
 * List all user API key secrets for a user
 * Returns only secret names, not the actual encrypted values
 *
 * @param {object} env - Worker environment (CF_API_TOKEN, CF_ACCOUNT_ID)
 * @param {string} userId - User ID
 * @returns {Promise<Array<{provider: string, secretName: string}>>}
 *
 * @example
 * const keys = await listUserApiKeys(env, 'user123')
 * // Returns: [{provider: 'openai', secretName: 'USER_user123_openai_KEY'}, ...]
 */
export async function listUserApiKeys(env, userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!env.CF_API_TOKEN) {
    throw new Error('CF_API_TOKEN not set in worker environment')
  }

  if (!env.CF_ACCOUNT_ID) {
    throw new Error('CF_ACCOUNT_ID not set in worker environment')
  }

  const accountId = env.CF_ACCOUNT_ID
  const apiToken = env.CF_API_TOKEN
  const scriptName = 'vegvisr-api-worker'

  try {
    // Get all secrets for this worker
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/secrets`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      }
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(result.errors)}`)
    }

    // Filter secrets for this user
    const prefix = `USER_${userId}_`
    const userSecrets = result.result
      .filter(secret => secret.name.startsWith(prefix) && secret.name.endsWith('_KEY'))
      .map(secret => {
        // Extract provider from: USER_{userId}_{provider}_KEY
        const provider = secret.name
          .replace(prefix, '')
          .replace('_KEY', '')

        return {
          provider,
          secretName: secret.name
        }
      })

    return userSecrets

  } catch (error) {
    console.error(`[SecretsManager] ❌ Failed to list secrets: ${error.message}`)
    throw new Error(`Failed to list user API keys: ${error.message}`)
  }
}
