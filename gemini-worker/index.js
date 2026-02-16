// Gemini Worker - Google Gemini API Integration
// Converts OpenAI-style chat payloads into Gemini generateContent requests

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'
const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
]

/**
 * ENCRYPTION/DECRYPTION UTILITIES
 */
async function decryptApiKey(encryptedBase64, masterKey) {
  const encoder = new TextEncoder()
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

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
      salt: encoder.encode('vegvisr-user-api-keys'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  return new TextDecoder().decode(decrypted)
}

async function getUserApiKey(env, userId, provider) {
  if (!userId || !env.DB || !env.ENCRYPTION_MASTER_KEY) return null

  try {
    const result = await env.DB.prepare(`
      SELECT encrypted_key FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
    `).bind(userId, provider).first()

    if (!result?.encrypted_key) {
      return null
    }

    const plaintextApiKey = await decryptApiKey(result.encrypted_key, env.ENCRYPTION_MASTER_KEY)

    await env.DB.prepare(`
      UPDATE user_api_keys SET last_used = CURRENT_TIMESTAMP
      WHERE user_id = ?1 AND provider = ?2
    `).bind(userId, provider).run()

    return plaintextApiKey
  } catch (error) {
    console.error(`Failed to get user API key: ${error.message}`)
    return null
  }
}

async function getGeminiApiKeyForUser(env, userId) {
  const geminiKey = await getUserApiKey(env, userId, 'gemini')
  if (geminiKey) return geminiKey
  return await getUserApiKey(env, userId, 'google')
}

function resolveUserId(rawUserId, env) {
  const cleaned = typeof rawUserId === 'string' ? rawUserId.trim() : rawUserId
  if (cleaned) {
    return cleaned
  }
  if (env?.DEFAULT_USER_ID) {
    return env.DEFAULT_USER_ID
  }
  return null
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email'
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: env.WORKER_NAME || 'gemini-worker',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (pathname === '/api/docs' && request.method === 'GET') {
        return handleApiDocs(corsHeaders)
      }

      if (pathname === '/models' && request.method === 'GET') {
        return handleModels(corsHeaders)
      }

      if (pathname === '/image-models' && request.method === 'GET') {
        return handleImageModels(corsHeaders)
      }

      if (pathname === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, corsHeaders)
      }

      if (pathname === '/images' && request.method === 'POST') {
        return await handleImageGeneration(request, env, corsHeaders)
      }

      if (pathname.match(/^\/gemini-(?:[\w.-]+)$/) && request.method === 'POST') {
        const model = pathname.substring(1)
        return await handleModelEndpoint(request, env, corsHeaders, model)
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error('Gemini worker error:', error)
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}

async function handleChat(request, env, corsHeaders) {
  try {
    const body = await request.json()
    return await processGeminiChat(body, env, corsHeaders)
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleModelEndpoint(request, env, corsHeaders, modelName) {
  try {
    const body = await request.json()
    body.model = modelName
    return await processGeminiChat(body, env, corsHeaders)
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function processGeminiChat(body, env, corsHeaders) {
  const {
    messages,
    model = 'gemini-2.5-flash',
    temperature = 0.7,
    top_p = 0.95,
    top_k,
    max_tokens,
    max_completion_tokens,
    stream = false,
    userId,
    safetySettings,
    generationConfig = {}
  } = body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (stream) {
    return new Response(JSON.stringify({ error: 'Streaming responses are not supported yet.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const resolvedUserId = resolveUserId(userId, env)
  if (!resolvedUserId) {
    return new Response(JSON.stringify({
      error: 'userId is required to retrieve your Gemini API key and no DEFAULT_USER_ID fallback is configured'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const geminiKey = await getGeminiApiKeyForUser(env, resolvedUserId)

  if (!geminiKey) {
    return new Response(JSON.stringify({
      error: 'Google Gemini API key not configured for this user. Please add a Gemini/Google key.'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { contents, systemInstruction } = convertMessagesForGemini(messages)
  if (!contents.length) {
    return new Response(JSON.stringify({ error: 'At least one non-system message is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const maxOutputTokens = max_completion_tokens ?? max_tokens ?? generationConfig.maxOutputTokens ?? 4096
  const requestBody = {
    contents,
    generationConfig: {
      temperature,
      topK: top_k ?? generationConfig.topK ?? 32,
      topP: top_p ?? generationConfig.topP ?? 0.95,
      maxOutputTokens: Math.min(maxOutputTokens, 32768),
      ...generationConfig
    },
    safetySettings: safetySettings || DEFAULT_SAFETY_SETTINGS
  }

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction
  }

  const geminiResponse = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  const result = await geminiResponse.json()

  if (!geminiResponse.ok) {
    return new Response(JSON.stringify({ error: result.error || result }), {
      status: geminiResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const formatted = mapGeminiResponseToOpenAI(model, result)
  return new Response(JSON.stringify(formatted), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleImageGeneration(request, env, corsHeaders) {
  try {
    const body = await request.json()
    const {
      userId,
      prompt,
      model = DEFAULT_IMAGE_MODEL,
      response_format = 'b64_json',
      n = 1,
      temperature = 0.8,
      safetySettings,
      generationConfig = {}
    } = body || {}

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (n !== 1) {
      return new Response(JSON.stringify({ error: 'Only n=1 is supported for Gemini image generation.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const resolvedUserId = resolveUserId(userId, env)
    if (!resolvedUserId) {
      return new Response(JSON.stringify({
        error: 'userId is required to retrieve your Gemini API key and no DEFAULT_USER_ID fallback is configured'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const geminiKey = await getGeminiApiKeyForUser(env, resolvedUserId)
    if (!geminiKey) {
      return new Response(JSON.stringify({
        error: 'Google Gemini API key not configured for this user. Please add a Gemini/Google key.'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt.trim() }] }],
      generationConfig: {
        temperature,
        responseModalities: ['TEXT', 'IMAGE'],
        ...generationConfig
      },
      safetySettings: safetySettings || DEFAULT_SAFETY_SETTINGS
    }

    const geminiResponse = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    const result = await geminiResponse.json()
    if (!geminiResponse.ok) {
      return new Response(JSON.stringify({ error: result.error || result }), {
        status: geminiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const parts = result?.candidates?.[0]?.content?.parts || []
    const imageParts = parts.filter((part) => {
      const mimeType = part?.inlineData?.mimeType || ''
      return Boolean(part?.inlineData?.data) && mimeType.toLowerCase().startsWith('image/')
    })
    const textParts = parts.map((part) => part?.text).filter(Boolean)

    if (!imageParts.length) {
      return new Response(JSON.stringify({
        error: 'Gemini response did not include image data.',
        details: textParts.join('\n') || null
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const firstImage = imageParts[0]
    const mimeType = firstImage.inlineData.mimeType || 'image/png'
    const b64 = firstImage.inlineData.data
    const dataUrl = `data:${mimeType};base64,${b64}`

    const payload = {
      created: Math.floor(Date.now() / 1000),
      model,
      data: [{
        b64_json: b64,
        mime_type: mimeType,
        ...(response_format === 'url' ? { url: dataUrl } : {})
      }],
      text: textParts.join('\n') || null
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

function convertMessagesForGemini(messages) {
  const contents = []
  let systemInstruction = null

  for (const message of messages) {
    if (!message || !message.role) continue

    if (message.role === 'system') {
      const parts = normalizeGeminiParts(message.content)
      if (parts.length) {
        systemInstruction = { role: 'system', parts }
      }
      continue
    }

    const role = message.role === 'assistant' ? 'model' : 'user'
    const parts = normalizeGeminiParts(message.content)
    if (!parts.length) continue

    contents.push({ role, parts })
  }

  return { contents, systemInstruction }
}

function normalizeGeminiParts(content) {
  if (content === undefined || content === null) return []

  if (typeof content === 'string') {
    return [{ text: content }]
  }

  if (Array.isArray(content)) {
    const parts = content
      .map(convertPartObject)
      .filter(Boolean)
    return parts.length ? parts : []
  }

  if (typeof content === 'object') {
    const converted = convertPartObject(content)
    return converted ? [converted] : []
  }

  return [{ text: String(content) }]
}

function convertPartObject(part) {
  if (!part) return null

  if (typeof part === 'string') {
    return { text: part }
  }

  if (part.text) {
    return { text: part.text }
  }

  if (part.type === 'text' && part.text) {
    return { text: part.text }
  }

  if (part.type === 'image' && part.source?.data) {
    return {
      inlineData: {
        data: part.source.data,
        mimeType: part.source.media_type || 'image/png'
      }
    }
  }

  if (part.type === 'image_url' && part.image_url?.url) {
    return { text: `[Image: ${part.image_url.url}]` }
  }

  if (part.type === 'tool_result' && typeof part.content === 'string') {
    return { text: part.content }
  }

  if (typeof part === 'object') {
    const serialized = JSON.stringify(part)
    return serialized ? { text: serialized } : null
  }

  return null
}

function mapGeminiResponseToOpenAI(model, result) {
  const candidate = result.candidates?.[0]
  const text = candidate?.content?.parts?.map(part => part.text).filter(Boolean).join('\n') || ''
  const finishReason = candidate?.finishReason?.toLowerCase() || 'stop'
  const usage = result.usageMetadata || {}

  return {
    id: result.responseId || `gemini-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: finishReason
      }
    ],
    usage: {
      prompt_tokens: usage.promptTokenCount ?? null,
      completion_tokens: usage.candidatesTokenCount ?? usage.totalTokenCount ?? null,
      total_tokens: usage.totalTokenCount ?? null
    }
  }
}

function handleModels(corsHeaders) {
  const models = {
    chat: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        context_length: 1048576,
        max_output_tokens: 65536,
        features: ['chat', 'code', 'multimodal', 'vision', 'thinking'],
        description: 'Latest mid-size multimodal model (June 2025) with 1M token context and fast responses'
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        context_length: 1048576,
        max_output_tokens: 65536,
        features: ['advanced reasoning', 'multimodal', 'vision', 'thinking'],
        description: 'Stable flagship reasoning model released June 2025'
      },
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Experimental',
        context_length: 1048576,
        max_output_tokens: 8192,
        features: ['experimental', 'fast iterative testing'],
        description: 'Experimental Flash variant for early feature access'
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro (Legacy)',
        context_length: 2000000,
        max_output_tokens: 32768,
        features: ['chat', 'code', 'multimodal', 'vision'],
        description: 'Legacy reasoning model retained for backward compatibility'
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash (Legacy)',
        context_length: 1000000,
        max_output_tokens: 16384,
        features: ['fast responses', 'multimodal'],
        description: 'Legacy speed-focused model retained for compatibility'
      }
    ],
    image: [
      {
        id: DEFAULT_IMAGE_MODEL,
        name: 'Gemini 2.5 Flash Image',
        max_images: 1,
        features: ['text-to-image', 'inline image output'],
        description: 'Gemini native image generation via generateContent responseModalities=[TEXT, IMAGE]'
      }
    ]
  }

  return new Response(JSON.stringify({
    models,
    count: { chat: models.chat.length, image: models.image.length, total: models.chat.length + models.image.length }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function handleImageModels(corsHeaders) {
  const models = [
    {
      id: DEFAULT_IMAGE_MODEL,
      name: 'Gemini 2.5 Flash Image',
      max_images: 1,
      response_formats: ['b64_json', 'url'],
      features: ['text-to-image', 'inline image output']
    }
  ]

  return new Response(JSON.stringify({ models, count: models.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function handleApiDocs(corsHeaders) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Gemini Worker API',
      version: '1.0.0',
      description: 'Google Gemini wrapper that accepts OpenAI-style payloads.'
    },
    servers: [{ url: 'https://gemini.vegvisr.org', description: 'Production' }],
    paths: {
      '/chat': {
        post: {
          summary: 'Chat completions via Gemini',
          description: 'Send OpenAI-style messages to Gemini models.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string', description: 'User ID for decrypting the Gemini API key from D1 (falls back to DEFAULT_USER_ID when configured)' },
                    model: { type: 'string', default: 'gemini-2.5-flash' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    temperature: { type: 'number', default: 0.7 },
                    max_tokens: { type: 'integer' }
                  },
                  required: ['userId', 'messages']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Gemini response in OpenAI format'
            }
          }
        }
      },
      '/images': {
        post: {
          summary: 'Generate images via Gemini',
          description: 'Uses encrypted Gemini API key from D1 for the provided userId.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    prompt: { type: 'string' },
                    model: { type: 'string', default: DEFAULT_IMAGE_MODEL },
                    response_format: { type: 'string', enum: ['b64_json', 'url'], default: 'b64_json' },
                    n: { type: 'integer', default: 1 }
                  },
                  required: ['userId', 'prompt']
                }
              }
            }
          },
          responses: {
            200: { description: 'Gemini image response with base64 data' }
          }
        }
      },
      '/image-models': {
        get: {
          summary: 'List Gemini image models',
          responses: { 200: { description: 'Image model list' } }
        }
      }
    },
    components: {
      schemas: {
        Message: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { type: 'string', enum: ['system', 'user', 'assistant'] },
            content: { oneOf: [{ type: 'string' }, { type: 'array' }, { type: 'object' }] }
          }
        }
      }
    }
  }

  return new Response(JSON.stringify(spec, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
