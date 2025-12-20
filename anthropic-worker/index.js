/**
 * Anthropic Worker - Clean Anthropic API Integration
 *
 * Provides direct access to Anthropic Claude models
 * No complexity, just clean API calls
 */

/**
 * ENCRYPTION/DECRYPTION UTILITIES
 * Get user API key from D1 database
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

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

async function getUserApiKey(env, userId, provider) {
  if (!userId) return null
  if (!env.DB) return null
  if (!env.ENCRYPTION_MASTER_KEY) return null

  try {
    const result = await env.DB.prepare(`
      SELECT encrypted_key FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
    `).bind(userId, provider).first()

    if (!result || !result.encrypted_key) {
      return null
    }

    const plaintextApiKey = await decryptApiKey(result.encrypted_key, env.ENCRYPTION_MASTER_KEY)

    // Update last_used timestamp
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // CORS headers (matching api-worker configuration)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
      'Content-Type': 'application/json'
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // GET /api/docs - API Documentation
      if (pathname === '/api/docs' && request.method === 'GET') {
        return handleApiDocs(corsHeaders)
      }

      // POST /chat - Chat completion
      if (pathname === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, corsHeaders)
      }

      // POST /message - Single message
      if (pathname === '/message' && request.method === 'POST') {
        return await handleMessage(request, env, corsHeaders)
      }

      // POST /claude-sonnet-4.5 - Claude Sonnet 4.5
      if (pathname === '/claude-sonnet-4.5' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'claude-sonnet-4-5-20250929')
      }

      // POST /claude-haiku-4.5 - Claude Haiku 4.5
      if (pathname === '/claude-haiku-4.5' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'claude-haiku-4-5-20251001')
      }

      // POST /claude-opus-4.5 - Claude Opus 4.5
      if (pathname === '/claude-opus-4.5' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'claude-opus-4-5-20251101')
      }

      // GET /models - List available models
      if (pathname === '/models' && request.method === 'GET') {
        return handleModels(corsHeaders)
      }

      // GET /health - Health check
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: 'anthropic-worker',
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders })
      }

      return new Response(JSON.stringify({
        error: 'Not found',
        available_endpoints: ['/chat', '/message', '/claude-sonnet-4.5', '/claude-haiku-4.5', '/claude-opus-4.5', '/models', '/health']
      }), {
        status: 404,
        headers: corsHeaders
      })

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: corsHeaders
      })
    }
  }
}

/**
 * Handle chat completion with conversation history
 */
async function handleChat(request, env, corsHeaders) {
  const body = await request.json()
  const {
    messages,
    model = 'claude-sonnet-4-20250514',
    max_tokens = 8192,
    temperature = 1,
    system = null,
    userId,
    tools,         // Function calling tools (OpenAI format, will be converted)
    tool_choice    // Function calling mode
  } = body

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({
      error: 'messages array is required'
    }), {
      status: 400,
      headers: corsHeaders
    })
  }

  // Get API key from D1 database or fall back to system key
  const userKey = await getUserApiKey(env, userId, 'anthropic')
  const ANTHROPIC_API_KEY = userKey || env.ANTHROPIC_API_KEY

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY not configured'
    }), {
      status: 401,
      headers: corsHeaders
    })
  }

  try {
    const requestBody = {
      model,
      max_tokens,
      temperature,
      messages
    }

    if (system) {
      requestBody.system = system
    }

    // Convert OpenAI-style tools to Anthropic format
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools.map(tool => {
        if (tool.type === 'function' && tool.function) {
          return {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters
          }
        }
        return tool
      })
    }
    
    // Convert tool_choice to Anthropic format
    if (tool_choice !== undefined) {
      if (tool_choice === 'auto' || (typeof tool_choice === 'object' && tool_choice.type === 'auto')) {
        requestBody.tool_choice = { type: 'auto' }
      } else if (tool_choice === 'none') {
        // Claude doesn't have 'none', just don't send tools
        delete requestBody.tools
      } else if (typeof tool_choice === 'object' && tool_choice.function) {
        requestBody.tool_choice = { type: 'tool', name: tool_choice.function.name }
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: data.error || 'Anthropic API error',
        status: response.status
      }), {
        status: response.status,
        headers: corsHeaders
      })
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

/**
 * Handle single message (simplified interface)
 */
async function handleMessage(request, env, corsHeaders) {
  const body = await request.json()
  const {
    message,
    model = 'claude-sonnet-4-20250514',
    max_tokens = 8192,
    temperature = 1,
    system = null,
    userId
  } = body

  if (!message) {
    return new Response(JSON.stringify({
      error: 'message is required'
    }), {
      status: 400,
      headers: corsHeaders
    })
  }

  // Convert single message to messages array
  const messages = [{ role: 'user', content: message }]

  // Reuse chat handler
  const chatRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      messages,
      model,
      max_tokens,
      temperature,
      system,
      userId
    })
  })

  return await handleChat(chatRequest, env, corsHeaders)
}

/**
 * Handle model-specific endpoint
 */
async function handleModelEndpoint(request, env, corsHeaders, modelId) {
  const body = await request.json()
  const {
    message,
    messages,
    max_tokens = 8192,
    temperature = 1,
    system = null,
    userId
  } = body

  // If messages array provided, use chat
  if (messages) {
    const chatRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        messages,
        model: modelId,
        max_tokens,
        temperature,
        system,
        userId
      })
    })
    return await handleChat(chatRequest, env, corsHeaders)
  }

  // If message string provided, use message handler
  if (message) {
    const messageRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        message,
        model: modelId,
        max_tokens,
        temperature,
        system,
        userId
      })
    })
    return await handleMessage(messageRequest, env, corsHeaders)
  }

  return new Response(JSON.stringify({
    error: 'Either "message" or "messages" is required'
  }), {
    status: 400,
    headers: corsHeaders
  })
}

/**
 * List available Claude models
 */
function handleModels(corsHeaders) {
  const models = [
    {
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      description: 'Most capable model - balanced performance',
      max_tokens: 64000,
      context_window: 200000
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      description: 'Fastest model - optimized for speed',
      max_tokens: 8192,
      context_window: 200000
    },
    {
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      description: 'Most intelligent - maximum capability',
      max_tokens: 16384,
      context_window: 200000
    }
  ]

  return new Response(JSON.stringify({
    models
  }), { headers: corsHeaders })
}

/**
 * API Documentation
 */
function handleApiDocs(corsHeaders) {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Anthropic Worker API Documentation',
      version: '1.0.0',
      description: 'Complete Anthropic Claude API integration with 3 models: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.5. Features userId-based encrypted key retrieval from D1 database.',
      contact: {
        name: 'Vegvisr Platform',
        url: 'https://anthropic.vegvisr.org'
      }
    },
    servers: [
      {
        url: 'https://anthropic.vegvisr.org',
        description: 'Anthropic Worker (Production)'
      }
    ],
    tags: [
      { name: 'Chat', description: 'Chat completion endpoints for Claude models' },
      { name: 'Meta', description: 'Health checks and model listings' }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Meta'],
          summary: 'Health check',
          description: 'Check if worker is running',
          responses: {
            200: {
              description: 'Worker is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      worker: { type: 'string', example: 'anthropic-worker' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/models': {
        get: {
          tags: ['Meta'],
          summary: 'List all available Claude models',
          description: 'Get complete list of 3 Claude models with capabilities and parameters',
          responses: {
            200: {
              description: 'Models list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            max_tokens: { type: 'integer' },
                            context_window: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Chat completions (all models)',
          description: 'Generic chat endpoint supporting all 3 Claude models. API key retrieved from D1 using userId.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for D1 key lookup' },
                    messages: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['role', 'content'],
                        properties: {
                          role: { type: 'string', enum: ['user', 'assistant'] },
                          content: { type: 'string' }
                        }
                      }
                    },
                    model: { type: 'string', default: 'claude-sonnet-4-20250514' },
                    max_tokens: { type: 'integer', default: 8192 },
                    temperature: { type: 'number', minimum: 0, maximum: 1, default: 1 },
                    system: { type: 'string', description: 'System prompt' }
                  }
                },
                examples: {
                  'claude-sonnet': {
                    summary: 'Claude Sonnet 4.5 example',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'claude-sonnet-4-5-20250929',
                      messages: [{ role: 'user', content: 'Explain quantum computing' }],
                      max_tokens: 1024
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Chat completion response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string' },
                      role: { type: 'string' },
                      content: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            text: { type: 'string' }
                          }
                        }
                      },
                      model: { type: 'string' },
                      usage: {
                        type: 'object',
                        properties: {
                          input_tokens: { type: 'integer' },
                          output_tokens: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/message': {
        post: {
          tags: ['Chat'],
          summary: 'Single message (simplified)',
          description: 'Send a single message without conversation history. Automatically converted to messages array.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'message'],
                  properties: {
                    userId: { type: 'string' },
                    message: { type: 'string', description: 'Single message text' },
                    model: { type: 'string', default: 'claude-sonnet-4-20250514' },
                    max_tokens: { type: 'integer', default: 8192 }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success' }
          }
        }
      },
      '/claude-sonnet-4.5': {
        post: {
          tags: ['Chat'],
          summary: 'Claude Sonnet 4.5 endpoint',
          description: 'Direct endpoint for Claude Sonnet 4.5 (most balanced, 200K context)',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string' },
                    message: { type: 'string', description: 'Single message (alternative to messages)' },
                    messages: { type: 'array', description: 'Message array (alternative to message)' },
                    max_tokens: { type: 'integer', default: 8192 }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success' }
          }
        }
      },
      '/claude-haiku-4.5': {
        post: {
          tags: ['Chat'],
          summary: 'Claude Haiku 4.5 endpoint',
          description: 'Direct endpoint for Claude Haiku 4.5 (fastest, 200K context)',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string' },
                    message: { type: 'string' },
                    messages: { type: 'array' },
                    max_tokens: { type: 'integer', default: 8192 }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success' }
          }
        }
      },
      '/claude-opus-4.5': {
        post: {
          tags: ['Chat'],
          summary: 'Claude Opus 4.5 endpoint',
          description: 'Direct endpoint for Claude Opus 4.5 (most intelligent, 200K context)',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string' },
                    message: { type: 'string' },
                    messages: { type: 'array' },
                    max_tokens: { type: 'integer', default: 16384 }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success' }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        D1Database: {
          type: 'apiKey',
          in: 'body',
          name: 'userId',
          description: 'User ID used to retrieve encrypted Anthropic API key from D1 database (vegvisr_org.user_api_keys). Key is decrypted using ENCRYPTION_MASTER_KEY and used for Anthropic API calls. Falls back to env.ANTHROPIC_API_KEY if user has no key stored.'
        }
      }
    }
  };

  return new Response(JSON.stringify(openApiSpec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
