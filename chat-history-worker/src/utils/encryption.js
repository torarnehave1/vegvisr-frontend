const encoder = new TextEncoder()
const decoder = new TextDecoder()

const ITERATIONS = 100000
const KEY_LENGTH = 256
const SALT_BYTES = 16
const IV_BYTES = 12

async function deriveKey(masterKey, saltBytes) {
  if (!masterKey) {
    throw new Error('Missing ENCRYPTION_MASTER_KEY')
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptText(plaintext, masterKey) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string')
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(masterKey, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt)
  }
}

export async function decryptText(payload, masterKey) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.salt) {
    throw new Error('Invalid encrypted payload')
  }

  const saltBytes = base64ToBuffer(payload.salt)
  const ivBytes = base64ToBuffer(payload.iv)
  const dataBytes = base64ToBuffer(payload.ciphertext)
  const key = await deriveKey(masterKey, saltBytes)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    dataBytes
  )

  return decoder.decode(decrypted)
}

export function bufferToBase64(data) {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
}

export function base64ToBuffer(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
