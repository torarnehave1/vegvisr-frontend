/**
 * Perplexity Worker - Clean Perplexity API Integration
 *
 * Provides direct access to Perplexity AI models
 * Supports sonar models with real-time web search
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

    // CORS headers
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

      // POST /sonar - Sonar model (real-time web search)
      if (pathname === '/sonar' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'sonar')
      }

      // POST /sonar-pro - Sonar Pro model
      if (pathname === '/sonar-pro' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'sonar-pro')
      }

      // POST /sonar-reasoning - Sonar Reasoning model
      if (pathname === '/sonar-reasoning' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'sonar-reasoning')
      }

      // GET /models - List available models
      if (pathname === '/models' && request.method === 'GET') {
        return handleModels(corsHeaders)
      }

      // GET /health - Health check
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: 'perplexity-worker',
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders })
      }

      return new Response(JSON.stringify({
        error: 'Not found',
        available_endpoints: ['/chat', '/sonar', '/sonar-pro', '/sonar-reasoning', '/models', '/health']
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
    model = 'sonar',
    max_tokens = 4096,
    temperature = 0.2,
    top_p = 0.9,
    search_domain_filter = [],
    return_images = false,
    return_related_questions = false,
    search_recency_filter = 'month',
    top_k = 0,
    stream = false,
    presence_penalty = 0,
    frequency_penalty = 1,
    userId
  } = body

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({
      error: 'Messages array is required'
    }), {
      status: 400,
      headers: corsHeaders
    })
  }

  // Get API key from D1 database or fall back to system key
  const userKey = await getUserApiKey(env, userId, 'perplexity')
  const PERPLEXITY_API_KEY = userKey || env.PERPLEXITY_API_KEY

  if (!PERPLEXITY_API_KEY) {
    return new Response(JSON.stringify({
      error: `Perplexity API key not configured for user${userId ? ` "${userId}"` : ''}. Add your Perplexity API key in user settings.`
    }), {
      status: 403,
      headers: corsHeaders
    })
  }

  try {
    // Build request body
    const requestBody = {
      model,
      messages,
      max_tokens,
      temperature,
      top_p,
      stream,
      presence_penalty,
      frequency_penalty
    }

    // Add optional parameters
    if (top_k > 0) requestBody.top_k = top_k
    if (search_domain_filter.length > 0) requestBody.search_domain_filter = search_domain_filter
    if (return_images) requestBody.return_images = return_images
    if (return_related_questions) requestBody.return_related_questions = return_related_questions
    if (search_recency_filter) requestBody.search_recency_filter = search_recency_filter

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    // Safe response parsing — Perplexity may return HTML on auth errors
    const contentType = response.headers.get('content-type') || ''
    const responseText = await response.text()

    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        error: `Perplexity API returned non-JSON response (${response.status}). Check that your API key is valid.`,
        status: response.status,
        contentType
      }), {
        status: 502,
        headers: corsHeaders
      })
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      return new Response(JSON.stringify({
        error: `Failed to parse Perplexity response (${response.status}): ${responseText.substring(0, 200)}`
      }), {
        status: 502,
        headers: corsHeaders
      })
    }

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: data.error?.message || 'Perplexity API error',
        details: data
      }), {
        status: response.status,
        headers: corsHeaders
      })
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders })

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

/**
 * Handle specific model endpoint
 */
async function handleModelEndpoint(request, env, corsHeaders, modelName) {
  const body = await request.json()
  const {
    messages,
    max_tokens = 4096,
    temperature = 0.2,
    userId,
    ...otherParams
  } = body

  // Reconstruct request with specified model
  const modifiedBody = {
    ...body,
    model: modelName,
    messages,
    max_tokens,
    temperature,
    userId,
    ...otherParams
  }

  // Create new request with modified body
  const modifiedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(modifiedBody)
  })

  return handleChat(modifiedRequest, env, corsHeaders)
}

/**
 * List available models
 */
function handleModels(corsHeaders) {
  const models = [
    {
      id: 'sonar',
      name: 'Sonar',
      description: 'Fast, real-time AI search with citations',
      context_length: 127072,
      features: ['real-time search', 'citations', 'fast']
    },
    {
      id: 'sonar-pro',
      name: 'Sonar Pro',
      description: 'Advanced reasoning with deep web search',
      context_length: 127072,
      features: ['deep search', 'advanced reasoning', 'citations']
    },
    {
      id: 'sonar-reasoning',
      name: 'Sonar Reasoning',
      description: 'Complex problem solving with step-by-step reasoning',
      context_length: 127072,
      features: ['reasoning', 'problem solving', 'citations']
    }
  ]

  return new Response(JSON.stringify({
    models,
    count: models.length
  }), { headers: corsHeaders })
}

/**
 * API Documentation
 */
function handleApiDocs(corsHeaders) {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Perplexity Worker API Documentation',
      version: '1.0.0',
      description: 'Complete Perplexity AI API integration with 3 models: Sonar, Sonar Pro, Sonar Reasoning. Features real-time web search with citations and userId-based encrypted key retrieval from D1 database.',
      contact: {
        name: 'Vegvisr Platform',
        url: 'https://perplexity.vegvisr.org'
      }
    },
    servers: [
      {
        url: 'https://perplexity.vegvisr.org',
        description: 'Perplexity Worker (Production)'
      }
    ],
    tags: [
      { name: 'Search', description: 'Real-time AI search endpoints with web citations' },
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
                      worker: { type: 'string', example: 'perplexity-worker' },
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
          summary: 'List all available Sonar models',
          description: 'Get complete list of 3 Sonar models with capabilities and features',
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
                            context_length: { type: 'integer' },
                            features: { type: 'array', items: { type: 'string' } }
                          }
                        }
                      },
                      count: { type: 'integer' }
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
          tags: ['Search'],
          summary: 'Chat with real-time search (all models)',
          description: 'Generic chat endpoint supporting all 3 Sonar models with real-time web search. API key retrieved from D1 using userId.',
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
                          role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                          content: { type: 'string' }
                        }
                      }
                    },
                    model: { type: 'string', default: 'sonar', enum: ['sonar', 'sonar-pro', 'sonar-reasoning'] },
                    max_tokens: { type: 'integer', description: 'Maximum tokens in response' },
                    temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.2 },
                    top_p: { type: 'number', minimum: 0, maximum: 1, default: 0.9 },
                    search_recency_filter: { type: 'string', enum: ['month', 'week', 'day', 'hour'], description: 'Limit search to recent content' },
                    return_images: { type: 'boolean', default: false, description: 'Include image URLs in response' },
                    return_related_questions: { type: 'boolean', default: false, description: 'Include related questions' },
                    search_domain_filter: { type: 'array', items: { type: 'string' }, description: 'Limit search to specific domains' }
                  }
                },
                examples: {
                  'sonar-search': {
                    summary: 'Sonar with search filters',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'sonar',
                      messages: [{ role: 'user', content: 'What are the latest AI developments?' }],
                      search_recency_filter: 'week',
                      return_related_questions: true
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Search response with citations',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      model: { type: 'string' },
                      created: { type: 'integer' },
                      usage: {
                        type: 'object',
                        properties: {
                          prompt_tokens: { type: 'integer' },
                          completion_tokens: { type: 'integer' },
                          total_tokens: { type: 'integer' }
                        }
                      },
                      citations: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'URLs of sources cited in response'
                      },
                      choices: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            index: { type: 'integer' },
                            finish_reason: { type: 'string' },
                            message: {
                              type: 'object',
                              properties: {
                                role: { type: 'string' },
                                content: { type: 'string' }
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
          }
        }
      },
      '/sonar': {
        post: {
          tags: ['Search'],
          summary: 'Sonar endpoint (fast search)',
          description: 'Direct endpoint for Sonar model - fast real-time search with citations',
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
                    search_recency_filter: { type: 'string' },
                    return_images: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success with citations' }
          }
        }
      },
      '/sonar-pro': {
        post: {
          tags: ['Search'],
          summary: 'Sonar Pro endpoint (deep search)',
          description: 'Direct endpoint for Sonar Pro - advanced reasoning with deep web search',
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
                    search_domain_filter: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success with citations' }
          }
        }
      },
      '/sonar-reasoning': {
        post: {
          tags: ['Search'],
          summary: 'Sonar Reasoning endpoint',
          description: 'Direct endpoint for Sonar Reasoning - complex problem solving with step-by-step reasoning',
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
                    return_related_questions: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success with reasoning steps and citations' }
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
          description: 'User ID used to retrieve encrypted Perplexity API key from D1 database (vegvisr_org.user_api_keys). Key is decrypted using ENCRYPTION_MASTER_KEY and used for Perplexity API calls. Falls back to env.PERPLEXITY_API_KEY if user has no key stored.'
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
