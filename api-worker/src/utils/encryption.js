/**
 * User API Key Encryption/Decryption Utilities
 *
 * Security: AES-256-GCM encryption with PBKDF2 key derivation
 * - Master key: ENCRYPTION_MASTER_KEY from Cloudflare Secrets
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key derivation: PBKDF2 with 100,000 iterations
 * - IV: Random 12 bytes per encryption
 * - Output: Base64-encoded (IV + encrypted data)
 *
 * This creates a defense-in-depth approach:
 * Layer 1: Application-level encryption (this code)
 * Layer 2: Cloudflare infrastructure encryption
 *
 * Result: Zero-knowledge storage - Cloudflare only sees encrypted blobs
 */

/**
 * Encrypt user API key with AES-256-GCM
 *
 * @param {string} apiKey - Plaintext API key (e.g., "sk-proj-...")
 * @param {string} masterKey - ENCRYPTION_MASTER_KEY from env.ENCRYPTION_MASTER_KEY
 * @returns {Promise<string>} Base64-encoded encrypted blob (safe for text storage)
 *
 * @example
 * const encrypted = await encryptApiKey("sk-proj-abc123", env.ENCRYPTION_MASTER_KEY)
 * // Returns: "7x9mK3pQ8vL2jN4..." (base64)
 */
export async function encryptApiKey(apiKey, masterKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key: must be a non-empty string')
  }

  if (!masterKey || typeof masterKey !== 'string') {
    throw new Error('Invalid master key: ENCRYPTION_MASTER_KEY not set')
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)

  try {
    // Derive encryption key from master key using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('vegvisr-user-api-keys'), // Static salt (consistent for same master key)
        iterations: 100000, // 100k iterations (OWASP recommendation)
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )

    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encrypt with AES-256-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    // Combine IV + encrypted data for storage
    // Format: [IV (12 bytes)][Encrypted Data (variable)]
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)

    // Convert to base64 for text-safe storage
    return btoa(String.fromCharCode(...combined))

  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`)
  }
}

/**
 * Decrypt user API key from encrypted blob
 *
 * @param {string} encryptedBase64 - Base64-encoded encrypted blob from storage
 * @param {string} masterKey - ENCRYPTION_MASTER_KEY from env.ENCRYPTION_MASTER_KEY
 * @returns {Promise<string>} Plaintext API key
 *
 * @example
 * const plaintext = await decryptApiKey("7x9mK3pQ8vL2jN4...", env.ENCRYPTION_MASTER_KEY)
 * // Returns: "sk-proj-abc123"
 */
export async function decryptApiKey(encryptedBase64, masterKey) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
    throw new Error('Invalid encrypted data: must be a non-empty string')
  }

  if (!masterKey || typeof masterKey !== 'string') {
    throw new Error('Invalid master key: ENCRYPTION_MASTER_KEY not set')
  }

  try {
    // Decode base64 to binary
    const combined = new Uint8Array(
      atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    )

    // Extract IV and encrypted data
    // Format: [IV (12 bytes)][Encrypted Data (variable)]
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)

    const encoder = new TextEncoder()

    // Derive the same encryption key from master key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('vegvisr-user-api-keys'), // Same static salt as encryption
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )

    // Decrypt with AES-256-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    // Convert decrypted bytes to string
    return new TextDecoder().decode(decrypted)

  } catch (error) {
    // Decryption can fail if:
    // - Wrong master key
    // - Corrupted encrypted data
    // - Tampered data (GCM authentication fails)
    throw new Error(`Decryption failed: ${error.message}`)
  }
}

/**
 * Verify encryption/decryption works correctly
 * Used for testing and validation
 *
 * @param {string} masterKey - ENCRYPTION_MASTER_KEY to test with
 * @returns {Promise<{success: boolean, error?: string}>}
 *
 * @example
 * const result = await verifyEncryption(env.ENCRYPTION_MASTER_KEY)
 * if (result.success) console.log("Encryption working!")
 */
export async function verifyEncryption(masterKey) {
  try {
    const testKey = 'sk-test-1234567890abcdef'

    // Encrypt
    const encrypted = await encryptApiKey(testKey, masterKey)

    // Decrypt
    const decrypted = await decryptApiKey(encrypted, masterKey)

    // Verify
    if (decrypted === testKey) {
      return { success: true }
    } else {
      return { success: false, error: 'Decrypted value does not match original' }
    }

  } catch (error) {
    return { success: false, error: error.message }
  }
}
