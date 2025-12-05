/**
 * R2 Metadata Storage - User API Keys Metadata
 *
 * This module stores METADATA ONLY for user API keys in R2.
 * NEVER stores actual API keys - only metadata like:
 * - Provider name (openai, anthropic, etc.)
 * - Display name
 * - When added/last used
 * - Which models are available
 * - Enabled/disabled status
 *
 * Actual API keys are stored encrypted in Cloudflare Secrets.
 */

/**
 * Save user's API key metadata to R2
 *
 * Storage path: user-api-keys-metadata/{userId}.json
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @param {object} metadata - Key metadata (NOT the actual API key)
 * @returns {Promise<object>} Saved metadata
 *
 * @example
 * await saveUserKeyMetadata(env, 'user123', 'openai', {
 *   keyName: 'My GPT-4 Key',
 *   models: ['gpt-4', 'gpt-4-vision-preview'],
 *   enabled: true
 * })
 */
export async function saveUserKeyMetadata(env, userId, provider, metadata) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.USER_SECRETS) {
    throw new Error('USER_SECRETS R2 binding not configured')
  }

  const path = `user-api-keys-metadata/${userId}.json`

  try {
    // Read existing metadata
    let userMetadata = { userId, keys: [] }
    const existing = await env.USER_SECRETS.get(path)
    if (existing) {
      userMetadata = await existing.json()
    }

    // Find or create key entry
    const keyIndex = userMetadata.keys.findIndex(k => k.provider === provider)
    const now = new Date().toISOString()

    const keyMetadata = {
      provider,
      secretName: `USER_${userId}_${provider}_KEY`,
      keyName: metadata.keyName || `${provider} API Key`,
      displayName: metadata.displayName || provider,
      enabled: metadata.enabled !== false,
      models: metadata.models || [],
      createdAt: keyIndex >= 0 ? userMetadata.keys[keyIndex].createdAt : now,
      updatedAt: now,
      lastUsed: metadata.lastUsed || null,
      isActive: true
    }

    // Update or add
    if (keyIndex >= 0) {
      userMetadata.keys[keyIndex] = keyMetadata
    } else {
      userMetadata.keys.push(keyMetadata)
    }

    // Save to R2
    await env.USER_SECRETS.put(path, JSON.stringify(userMetadata, null, 2))

    console.log(`[R2Metadata] ✅ Saved metadata for ${provider}`)

    return keyMetadata

  } catch (error) {
    console.error(`[R2Metadata] ❌ Failed to save metadata: ${error.message}`)
    throw new Error(`Failed to save key metadata: ${error.message}`)
  }
}

/**
 * Get all API key metadata for a user
 * Returns metadata only, never actual API keys
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @returns {Promise<{userId: string, keys: Array}>} User's key metadata
 *
 * @example
 * const metadata = await getUserKeyMetadata(env, 'user123')
 * // Returns: {userId: 'user123', keys: [{provider: 'openai', ...}, ...]}
 */
export async function getUserKeyMetadata(env, userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!env.USER_SECRETS) {
    throw new Error('USER_SECRETS R2 binding not configured')
  }

  const path = `user-api-keys-metadata/${userId}.json`

  try {
    const object = await env.USER_SECRETS.get(path)

    if (!object) {
      return { userId, keys: [] }
    }

    return await object.json()

  } catch (error) {
    console.error(`[R2Metadata] ❌ Failed to get metadata: ${error.message}`)
    throw new Error(`Failed to get key metadata: ${error.message}`)
  }
}

/**
 * Delete API key metadata for a specific provider
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<{success: boolean}>}
 *
 * @example
 * await deleteUserKeyMetadata(env, 'user123', 'openai')
 */
export async function deleteUserKeyMetadata(env, userId, provider) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.USER_SECRETS) {
    throw new Error('USER_SECRETS R2 binding not configured')
  }

  const path = `user-api-keys-metadata/${userId}.json`

  try {
    const existing = await env.USER_SECRETS.get(path)

    if (!existing) {
      return { success: true }
    }

    const userMetadata = await existing.json()
    userMetadata.keys = userMetadata.keys.filter(k => k.provider !== provider)

    await env.USER_SECRETS.put(path, JSON.stringify(userMetadata, null, 2))

    console.log(`[R2Metadata] ✅ Deleted metadata for ${provider}`)

    return { success: true }

  } catch (error) {
    console.error(`[R2Metadata] ❌ Failed to delete metadata: ${error.message}`)
    throw new Error(`Failed to delete key metadata: ${error.message}`)
  }
}

/**
 * Update last used timestamp for a provider's API key
 * Called after each successful API call
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<{success: boolean}>}
 *
 * @example
 * await updateKeyLastUsed(env, 'user123', 'openai')
 */
export async function updateKeyLastUsed(env, userId, provider) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string')
  }

  if (!provider || typeof provider !== 'string') {
    throw new Error('Invalid provider: must be a non-empty string')
  }

  if (!env.USER_SECRETS) {
    throw new Error('USER_SECRETS R2 binding not configured')
  }

  const path = `user-api-keys-metadata/${userId}.json`

  try {
    const existing = await env.USER_SECRETS.get(path)

    if (!existing) {
      console.warn(`[R2Metadata] No metadata found for user ${userId}`)
      return { success: false }
    }

    const userMetadata = await existing.json()
    const keyIndex = userMetadata.keys.findIndex(k => k.provider === provider)

    if (keyIndex >= 0) {
      userMetadata.keys[keyIndex].lastUsed = new Date().toISOString()
      await env.USER_SECRETS.put(path, JSON.stringify(userMetadata, null, 2))
      console.log(`[R2Metadata] ✅ Updated lastUsed for ${provider}`)
      return { success: true }
    }

    return { success: false }

  } catch (error) {
    console.error(`[R2Metadata] ❌ Failed to update lastUsed: ${error.message}`)
    // Don't throw - this is non-critical
    return { success: false }
  }
}

/**
 * Get metadata for a specific provider
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<object|null>} Key metadata or null if not found
 *
 * @example
 * const metadata = await getProviderKeyMetadata(env, 'user123', 'openai')
 */
export async function getProviderKeyMetadata(env, userId, provider) {
  const userMetadata = await getUserKeyMetadata(env, userId)
  return userMetadata.keys.find(k => k.provider === provider) || null
}

/**
 * Check if user has API key configured for a provider
 *
 * @param {object} env - Worker environment (USER_SECRETS R2 binding)
 * @param {string} userId - User ID
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>}
 *
 * @example
 * if (await hasProviderKey(env, 'user123', 'openai')) {
 *   // User has OpenAI key configured
 * }
 */
export async function hasProviderKey(env, userId, provider) {
  const metadata = await getProviderKeyMetadata(env, userId, provider)
  return metadata !== null && metadata.isActive && metadata.enabled
}
