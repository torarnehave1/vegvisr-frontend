/**
 * Grok Worker - X.AI API Integration
 * Retrieves encrypted API keys from D1 database using userId
 */

/**
 * Decrypt an API key using AES-256-GCM
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

/**
 * Get user's API key from D1 database
 */
async function getUserApiKey(userId, provider, env) {
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

function buildResponsesInput(messages) {
  const input = []

  for (const message of messages || []) {
    if (!message) continue

    if (message.role === 'tool') {
      if (message.tool_call_id) {
        input.push({
          type: 'function_call_output',
          call_id: message.tool_call_id,
          output: message.content || ''
        })
      }
      continue
    }

    if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        const functionName = toolCall.function?.name || toolCall.name
        const functionArgs = toolCall.function?.arguments || toolCall.arguments || ''
        if (!functionName) continue
        input.push({
          type: 'function_call',
          name: functionName,
          arguments: functionArgs,
          call_id: toolCall.id || toolCall.call_id || `call_${input.length + 1}`
        })
      }
    }

    if (typeof message.content === 'string' && message.content.trim() !== '') {
      input.push({
        role: message.role || 'user',
        content: message.content
      })
    }
  }

  return input
}

function toOpenAIStyleResponse(responsesData) {
  const output = Array.isArray(responsesData.output) ? responsesData.output : []
  const toolCalls = []
  const contentParts = []

  if (typeof responsesData.output_text === 'string') {
    contentParts.push(responsesData.output_text)
  }

  for (const item of output) {
    if (!item) continue

    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const contentItem of item.content) {
        const text = contentItem?.text
        if (contentItem?.type === 'output_text' && typeof text === 'string') {
          contentParts.push(text)
        } else if (contentItem?.type === 'text' && typeof text === 'string') {
          contentParts.push(text)
        }
      }
    }

    if (item.type === 'output_text' && typeof item.text === 'string') {
      contentParts.push(item.text)
    }

    if (item.type === 'function_call') {
      const callId = item.id || item.call_id || `call_${toolCalls.length + 1}`
      const name = item.name || item.function?.name
      let args = item.arguments || item.function?.arguments || ''
      if (args && typeof args !== 'string') {
        args = JSON.stringify(args)
      }
      if (name) {
        toolCalls.push({
          id: callId,
          type: 'function',
          function: {
            name,
            arguments: args || ''
          }
        })
      }
    }
  }

  const content = contentParts.join('') || ''
  const message = {
    role: 'assistant',
    content: content || null
  }
  if (toolCalls.length) {
    message.tool_calls = toolCalls
  }

  return {
    choices: [
      {
        message
      }
    ],
    usage: responsesData.usage || responsesData.usage_info || undefined
  }
}

function extractToolCallsFromText(text, tools) {
  if (!text || !Array.isArray(tools) || tools.length === 0) return []

  const toolNames = tools
    .map((tool) => tool?.function?.name || tool?.name)
    .filter(Boolean)

  if (toolNames.length === 0) return []

  const toolCalls = []
  const escapeNewlinesInStrings = (raw) => {
    let out = ''
    let inString = false
    let escaped = false
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i]
      if (escaped) {
        out += char
        escaped = false
        continue
      }
      if (char === '\\') {
        out += char
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        out += char
        continue
      }
      if (inString && char === '\n') {
        out += '\\n'
        continue
      }
      if (inString && char === '\r') {
        out += '\\r'
        continue
      }
      out += char
    }
    return out
  }
  const safeJsonParse = (raw) => {
    const cleaned = raw
      .replace(/(^|\s)\/\/.*$/gm, '$1')
      .replace(/,\s*([}\]])/g, '$1')
      .trim()
    if (!cleaned) return {}
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) return null
    try {
      return JSON.parse(cleaned)
    } catch (_) {
      try {
        return JSON.parse(escapeNewlinesInStrings(cleaned))
      } catch (_) {
        return null
      }
    }
  }

  for (const name of toolNames) {
    const linePattern = new RegExp(`(^|\\n)\\s*${name}\\s*(?:\\(\\s*\\))?\\s*(?=\\n|$)`, 'g')
    for (const match of text.matchAll(linePattern)) {
      const hasParen = match[0].includes('(')
      if (!hasParen) {
        toolCalls.push({
          id: `call_${toolCalls.length + 1}`,
          type: 'function',
          function: {
            name,
            arguments: ''
          }
        })
      }
    }

    let searchIndex = 0
    while (searchIndex < text.length) {
      const matchIndex = text.indexOf(`${name}(`, searchIndex)
      if (matchIndex === -1) break
      let i = matchIndex + name.length + 1
      let depth = 1
      for (; i < text.length; i += 1) {
        const char = text[i]
        if (char === '(') depth += 1
        if (char === ')') depth -= 1
        if (depth === 0) break
      }
      if (depth !== 0) {
        searchIndex = matchIndex + name.length + 1
        continue
      }
      const rawArgs = text.slice(matchIndex + name.length + 1, i).trim()
      const parsedArgs = rawArgs ? safeJsonParse(rawArgs) : {}
      if (parsedArgs !== null) {
        toolCalls.push({
          id: `call_${toolCalls.length + 1}`,
          type: 'function',
          function: {
            name,
            arguments: rawArgs ? JSON.stringify(parsedArgs) : ''
          }
        })
      }
      searchIndex = i + 1
    }
  }

  return toolCalls
}

function applyFallbackToolCalls(responsePayload, tools) {
  const message = responsePayload?.choices?.[0]?.message
  if (!message || message.tool_calls || typeof message.content !== 'string') return responsePayload

  const toolCalls = extractToolCallsFromText(message.content, tools)
  if (!toolCalls.length) return responsePayload

  return {
    ...responsePayload,
    choices: [
      {
        ...responsePayload.choices[0],
        message: {
          ...message,
          tool_calls: toolCalls
        }
      }
    ]
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
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    try {
      // GET /api/docs - API Documentation
      if (pathname === '/api/docs' && request.method === 'GET') {
        return handleApiDocs(corsHeaders)
      }

      // POST /chat - Chat completion (handles both user API keys and fallback)
      if (pathname === '/chat' && request.method === 'POST') {
        const body = await request.json()
        const {
          userId,
          messages,
          model = 'grok-3',
          temperature = 0.7,
          max_tokens = 32000,
          stream = false,
          tools = [],
          tool_choice
        } = body

        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: 'Missing or invalid messages array' }), {
            status: 400,
            headers: corsHeaders
          })
        }

        try {
          // Try to get user's API key from database
          let apiKey = null

          if (userId && userId !== 'system') {
            apiKey = await getUserApiKey(userId, 'grok', env)
          }

          // Fallback to environment variable if no user key
          if (!apiKey) {
            apiKey = env.GROK_API_KEY
          }

          if (!apiKey) {
            return new Response(JSON.stringify({
              error: 'Error: X AI API key not configured. Please add your Grok API key.',
              hint: 'Go to User Dashboard → API Keys to add your Grok (X.AI) API key'
            }), {
              status: 401,
              headers: corsHeaders
            })
          }

          const hasTools = Array.isArray(tools) && tools.length > 0
          const hasClientTools = hasTools && tools.some((tool) => {
            const name = tool?.function?.name || tool?.name || ''
            return (
              name.startsWith('graph_template_') ||
              name.startsWith('proff_') ||
              name.startsWith('sources_')
            )
          })
          const toolCapableModels = [
            'grok-4',
            'grok-4-fast',
            'grok-4-fast-non-reasoning',
            'grok-4-1-fast',
            'grok-4-1-fast-non-reasoning'
          ]
          const effectiveModel = hasTools && !toolCapableModels.includes(model)
            ? 'grok-4-1-fast'
            : model
          const useResponsesApi = hasTools && !hasClientTools
          const endpoint = useResponsesApi
            ? 'https://api.x.ai/v1/responses'
            : 'https://api.x.ai/v1/chat/completions'

          const payload = useResponsesApi
            ? {
                model: effectiveModel,
                input: buildResponsesInput(messages),
                tools,
                temperature,
                stream,
                ...(tool_choice ? { tool_choice } : {})
              }
            : {
                model: effectiveModel,
                messages,
                ...(hasTools ? { tools, ...(tool_choice ? { tool_choice } : {}) } : {}),
                temperature,
                max_tokens,
                stream
              }

          // Call X.AI API
          const xaiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          })

          if (!xaiResponse.ok) {
            const errorData = await xaiResponse.json().catch(() => ({}))
            throw new Error(errorData.error?.message || `X.AI API error: ${xaiResponse.status}`)
          }

          const data = await xaiResponse.json()

          const responsePayload = useResponsesApi ? toOpenAIStyleResponse(data) : data
          const finalPayload = hasTools ? applyFallbackToolCalls(responsePayload, tools) : responsePayload
          return new Response(JSON.stringify(finalPayload), {
            headers: corsHeaders
          })

        } catch (error) {
          console.error('Chat error:', error)
          return new Response(JSON.stringify({
            error: error.message
          }), {
            status: 500,
            headers: corsHeaders
          })
        }
      }

      // POST /process-transcript - YouTube transcript to knowledge graph
      if (pathname === '/process-transcript' && request.method === 'POST') {
        return await handleProcessTranscript(request, env, corsHeaders)
      }

      // POST /grok-4-latest - Grok 4 Latest endpoint
      if (pathname === '/grok-4-latest' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-4-latest')
      }

      // POST /grok-3 - Grok 3 endpoint
      if (pathname === '/grok-3' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-3')
      }

      // POST /grok-2-latest - Grok 2 Latest endpoint
      if (pathname === '/grok-2-latest' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-2-latest')
      }

      // POST /grok-2-vision-latest - Grok 2 Vision endpoint
      if (pathname === '/grok-2-vision-latest' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-2-vision-1212')
      }

      // POST /grok-vision-beta - Grok Vision Beta endpoint
      if (pathname === '/grok-vision-beta' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-vision-beta')
      }

      // POST /grok-code-fast-1 - Grok Code Fast endpoint
      if (pathname === '/grok-code-fast-1' && request.method === 'POST') {
        return await handleModelEndpoint(request, env, corsHeaders, 'grok-code-fast-1')
      }

      // POST /images - Image generation endpoint
      if (pathname === '/images' && request.method === 'POST') {
        return await handleImageGeneration(request, env, corsHeaders)
      }

      // GET /image-models - List image generation models
      if (pathname === '/image-models' && request.method === 'GET') {
        return handleImageModels(corsHeaders)
      }

      // GET /models - List models
      if (pathname === '/models' && request.method === 'GET') {
        return handleModels(corsHeaders)
      }

      // GET /health - Health check
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: env.WORKER_NAME || 'grok-worker',
          timestamp: new Date().toISOString()
        }), { headers: corsHeaders })
      }

      // GET /test-db - Test DB connection
      if (pathname === '/test-db' && request.method === 'GET') {
        try {
          const userId = 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b'
          const provider = 'grok'

          // Test basic query
          const basicResult = await env.DB.prepare(`
            SELECT provider, key_name, enabled FROM user_api_keys
            WHERE user_id = ?1 AND provider = ?2
          `).bind(userId, provider).first()

          // Test encrypted_key query
          const encryptedResult = await env.DB.prepare(`
            SELECT encrypted_key FROM user_api_keys
            WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
          `).bind(userId, provider).first()

          // Try to get via function
          const apiKey = await getUserApiKey(userId, provider, env)

          return new Response(JSON.stringify({
            basicQuery: basicResult,
            encryptedQuery: {
              found: !!encryptedResult,
              hasEncryptedKey: !!encryptedResult?.encrypted_key
            },
            getUserApiKeyResult: apiKey ? 'SUCCESS (key hidden)' : 'NULL',
            hasDB: !!env.DB,
            hasEncryptionKey: !!env.ENCRYPTION_MASTER_KEY
          }), { headers: corsHeaders })
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), { headers: corsHeaders })
        }
      }

      return new Response(JSON.stringify({
        error: 'Not found',
        available_endpoints: ['/health', '/models', '/image-models', '/chat', '/images', '/process-transcript', '/grok-4-latest', '/grok-3', '/grok-2-latest', '/grok-2-vision-latest', '/grok-vision-beta', '/grok-code-fast-1', '/api/docs']
      }), { status: 404, headers: corsHeaders })

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), { status: 500, headers: corsHeaders })
    }
  }
}

/**
 * Node type descriptions for Advanced Mode
 */
const NODE_TYPE_DESCRIPTIONS = {
  'fulltext': 'Rich text content with formatting support, sections, and citations. Use for detailed articles, biographies, or long-form explanations.',
  'title': 'Section heading or graph title. Use for organizing graph content with concise titles.',
  'notes': 'Concise note or insight with optional bibliography. Use for short, focused content with sources.',
  'info': 'Brief information card with key details. Use for quick reference information or summaries.',
  'worknote': 'Research notes or work-in-progress observations. Use for capturing ongoing thoughts or collaborative annotations.',
  'action_test': 'API integration node for dynamic content (Grok/AI calls). Use for nodes that require real-time answers or knowledge retrieval.',
  'map': 'Geographic visualization with KML support. Use for spatial context, mapping, or location-based insights.',
  'youtube': 'Embedded video content. Use for video references or multimedia content.',
  'portfolio-image': 'Image display for galleries. Use for visual showcases or image collections.',
  'mermaid-diagram': 'Charts, flowcharts, or diagrams using Mermaid syntax. Use for process visualization or system flows.',
  'bubblechart': 'Bubble chart for multi-dimensional data. Use for comparative and statistical insights.',
  'linechart': 'Line chart for trend visualization. Use for time-series data or trends.',
  'multilinechart': 'Multiple line series chart. Use for comparing multiple data series over time.'
}

function getNodeTypeDescription(type) {
  return NODE_TYPE_DESCRIPTIONS[type] || 'Custom node type'
}

function buildAdvancedModeConstraint(allowedNodeTypes) {
  if (!allowedNodeTypes || allowedNodeTypes.length === 0) {
    return ''
  }

  const typeDescriptions = allowedNodeTypes
    .map(type => `- ${type}: ${getNodeTypeDescription(type)}`)
    .join('\n')

  return `

IMPORTANT CONSTRAINT - ALLOWED NODE TYPES ONLY:
You may ONLY use these node types in your response: ${allowedNodeTypes.join(', ')}

Available node type descriptions:
${typeDescriptions}

CRITICAL: Every node you create MUST have a "type" field matching one of the allowed types above. Do not use any other node types.`
}

/**
 * Handle YouTube transcript processing to knowledge graph
 */
async function handleProcessTranscript(request, env, corsHeaders) {
  try {
    console.log('=== handleProcessTranscript called ===')

    const body = await request.json()
    console.log('Request body keys:', Object.keys(body))

    const { transcript, sourceLanguage, targetLanguage, userId, mode, allowedNodeTypes } = body

    if (!transcript) {
      console.error('Missing transcript text in request')
      return new Response(JSON.stringify({
        error: 'Missing transcript text'
      }), { status: 400, headers: corsHeaders })
    }

    console.log('=== Processing Transcript ===')
    console.log('Transcript length:', transcript.length)
    console.log('Source language:', sourceLanguage)
    console.log('Target language:', targetLanguage)
    console.log('User ID:', userId)
    console.log('Mode:', mode || 'basic')
    console.log('Allowed Node Types:', allowedNodeTypes ? allowedNodeTypes.join(', ') : 'all')

    // Get user's API key from D1 if userId provided
    let apiKey = null
    if (userId) {
      apiKey = await getUserApiKey(userId, 'grok', env)
    }

    // Fallback to environment Grok API key
    if (!apiKey) {
      apiKey = env.GROK_API_KEY || env.XAI_API_KEY
    }

    if (!apiKey) {
      console.error('Grok API key not found')
      return new Response(JSON.stringify({
        error: 'Grok API key not configured. Please add your Grok API key.'
      }), { status: 401, headers: corsHeaders })
    }
    console.log('Grok API key found:', apiKey.substring(0, 10) + '...')

    // Check transcript length and handle accordingly
    const transcriptWords = transcript.split(/\s+/).length
    console.log('Transcript word count:', transcriptWords)

    let prompt
    let maxTokens = 32000 // Grok-3 max context: 131,072 tokens (prompt + response)

    if (targetLanguage === 'original') {
      // --- PROMPT FOR ORIGINAL LANGUAGE ---
      console.log('Processing in original language.')
      maxTokens = 48000

      prompt = `Transform this transcript into a rich, emotionally engaging knowledge graph in its ORIGINAL language. DO NOT TRANSLATE. Create 8-15 detailed chapters as nodes.

SOURCE LANGUAGE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET LANGUAGE: Original (No Translation)

STYLE & TONE:
- Preserve the NATURAL DIALOGUE and conversational flow from the video
- Capture EMOTIONAL TONE, enthusiasm, humor, emphasis, and personality
- Include direct quotes with their emotional context (excitement, concern, passion, etc.)
- Show connections between ideas as they naturally flow in conversation
- Use expressive language that reflects how things were actually said
- Include timestamps where relevant to show progression

STRUCTURE:
1. DO NOT TRANSLATE the content. Keep it in the original language.
2. Create nodes with structure: {"id": "chapter_X", "label": "CHAPTER X: [Engaging Chapter Title]", "color": "#f9f9f9", "type": "fulltext", "info": "rich content with dialogue, emotion, and context", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}
3. Organize into thematic chapters that follow the natural flow of conversation
4. Use rich markdown with:
   - **Bold** for emphasis and key points
   - *Italics* for emotional tone, thoughts, or reflection
   - > Blockquotes for important direct quotes
   - Bullet lists for related ideas
   - Headers (###) for subsections within chapters
5. Include extensive dialogue and examples from the transcript
6. Show HOW ideas connect and build on each other
7. Add timestamps [00:00] where helpful for context
8. DO NOT include word counts in the output
9. Be generous with content - capture the richness of the conversation${mode === 'advanced' && allowedNodeTypes ? buildAdvancedModeConstraint(allowedNodeTypes) : ''}

TRANSCRIPT (full content):
${transcript}

Return ONLY valid JSON: {"nodes": [...], "edges": []}`
    } else {
      // --- PROMPT FOR NORWEGIAN TRANSLATION (Existing Logic) ---
      if (transcriptWords > 3000) {
        // For very long transcripts, use comprehensive processing
        console.log(
          'Large transcript detected, using comprehensive processing for Norwegian translation',
        )
        maxTokens = 48000 // Grok-3 has 131K total context (prompt + response)

        prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph. Create 8-15 detailed thematic sections as nodes.

SOURCE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET: Norwegian

RULES:
1. Translate EVERYTHING to Norwegian with high quality
2. Create nodes with structure: {"id": "del_X", "label": "DEL X: [Descriptive Title]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive content", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}
3. Split into logical thematic sections - be thorough, don't skip content
4. Use rich markdown formatting in "info" field with headers, lists, emphasis
5. Each node should contain substantial, detailed content.
6. Include key quotes, important details, and context
7. Create a comprehensive knowledge graph that captures the full essence${mode === 'advanced' && allowedNodeTypes ? buildAdvancedModeConstraint(allowedNodeTypes) : ''}

TRANSCRIPT (full content):
${transcript}

Return JSON: {"nodes": [...], "edges": []}`
      } else {
        // For shorter transcripts, use detailed processing
        console.log(
          'Standard transcript length, using detailed processing for Norwegian translation',
        )

        prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph JSON.

SOURCE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET: Norwegian

Create nodes with this structure:
{"id": "del_X", "label": "DEL X: [Descriptive Title]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive Norwegian content", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}

Rules:
- Translate ALL content to Norwegian with exceptional quality
- Split into 6-12 comprehensive thematic sections
- Use rich markdown formatting in "info" field
- Preserve cultural context and nuanced meaning
- Each node should be substantial and detailed.
- Include important quotes, examples, and detailed explanations
- Don't summarize - be comprehensive and detailed${mode === 'advanced' && allowedNodeTypes ? buildAdvancedModeConstraint(allowedNodeTypes) : ''}

TRANSCRIPT:
${transcript}

Return only JSON: {"nodes": [...], "edges": []}`
      }
    }

    console.log('Calling Grok AI API...')

    // Call X.AI API directly
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert Norwegian translator and knowledge graph creator specializing in comprehensive content generation. Transform content into detailed Norwegian knowledge graphs with substantial, well-structured content. Create thorough translations that preserve all important information, cultural context, and nuanced meaning. Always generate multiple detailed nodes with rich markdown formatting. Return only valid JSON in the specified format.',
          },
          { role: 'user', content: prompt },
        ],
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Grok API error:', errorData)
      return new Response(JSON.stringify({
        error: 'Grok API error',
        details: errorData
      }), { status: response.status, headers: corsHeaders })
    }

    const data = await response.json()
    console.log('Grok AI API response received successfully')
    const knowledgeGraphData = data.choices[0].message.content.trim()

    console.log('Generated knowledge graph length:', knowledgeGraphData.length)

    // Parse and validate the JSON
    try {
      const parsedGraph = JSON.parse(knowledgeGraphData)

      // Validate structure
      if (!parsedGraph.nodes || !Array.isArray(parsedGraph.nodes)) {
        throw new Error('Invalid knowledge graph structure: missing nodes array')
      }

      // Add timestamps to node IDs if missing
      parsedGraph.nodes = parsedGraph.nodes.map((node) => ({
        ...node,
        id: node.id || `fulltext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        visible: true,
        path: null,
      }))

      console.log('Successfully generated', parsedGraph.nodes.length, 'nodes')

      return new Response(JSON.stringify({
        knowledgeGraph: parsedGraph,
        stats: {
          totalNodes: parsedGraph.nodes.length,
          processingTime: Date.now(),
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          modelUsed: 'grok-3',
          transcriptWords: transcriptWords,
        },
      }), { status: 200, headers: corsHeaders })
    } catch (parseError) {
      console.error('Error parsing generated JSON:', parseError)
      console.log('Raw response:', knowledgeGraphData)

      // Return raw response for debugging
      return new Response(JSON.stringify({
        knowledgeGraph: { nodes: [], edges: [] },
        error: 'Failed to parse generated JSON',
        rawResponse: knowledgeGraphData,
      }), { status: 500, headers: corsHeaders })
    }
  } catch (error) {
    console.error('Error in handleProcessTranscript:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), { status: 500, headers: corsHeaders })
  }
}

/**
 * Handle chat completions
 */
async function handleChat(request, env, corsHeaders) {
  try {
    const body = await request.json()
    const { userId, messages, model = 'grok-4-latest', temperature = 0, max_tokens, stream = false } = body

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'userId is required'
      }), { status: 400, headers: corsHeaders })
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({
        error: 'messages array is required'
      }), { status: 400, headers: corsHeaders })
    }

    // Get user's API key from D1
    const userApiKey = await getUserApiKey(userId, 'grok', env)
    const apiKey = userApiKey || env.GROK_API_KEY

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'X.AI API key not configured. Please add your Grok API key.'
      }), { status: 401, headers: corsHeaders })
    }

    // Build request body
    const requestBody = {
      model,
      messages,
      temperature,
      stream
    }

    if (max_tokens) {
      requestBody.max_tokens = max_tokens
    }

    // Call X.AI API
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: 'X.AI API error',
        details: data
      }), { status: response.status, headers: corsHeaders })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500, headers: corsHeaders })
  }
}

/**
 * Handle model-specific endpoints
 */
async function handleModelEndpoint(request, env, corsHeaders, modelId) {
  try {
    const body = await request.json()
    const { userId, message, messages, temperature = 0, max_tokens } = body

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'userId is required'
      }), { status: 400, headers: corsHeaders })
    }

    // Convert single message to messages array if needed
    let messageArray = messages
    if (!messageArray && message) {
      messageArray = [{ role: 'user', content: message }]
    }

    if (!messageArray || !Array.isArray(messageArray)) {
      return new Response(JSON.stringify({
        error: 'messages array or message string is required'
      }), { status: 400, headers: corsHeaders })
    }

    // Create a modified request with the messages array
    const modifiedBody = {
      userId,
      messages: messageArray,
      model: modelId,
      temperature,
      stream: false
    }

    if (max_tokens) {
      modifiedBody.max_tokens = max_tokens
    }

    const modifiedRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(modifiedBody)
    })

    return handleChat(modifiedRequest, env, corsHeaders)
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500, headers: corsHeaders })
  }
}

/**
 * Handle image generation requests
 */
async function handleImageGeneration(request, env, corsHeaders) {
  try {
    const body = await request.json()
    const {
      userId,
      prompt,
      model = 'grok-2-image',
      size = '1024x1024',
      n = 1,
      response_format = 'url'
    } = body

    if (!prompt) {
      return new Response(JSON.stringify({
        error: 'prompt is required'
      }), { status: 400, headers: corsHeaders })
    }

    // Get user's API key from D1 or fallback to env
    let apiKey = null
    if (userId && userId !== 'system') {
      apiKey = await getUserApiKey(userId, 'grok', env)
    }
    if (!apiKey) {
      apiKey = env.GROK_API_KEY
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'X.AI API key not configured. Please add your Grok API key.',
        hint: 'Go to User Dashboard → API Keys to add your Grok (X.AI) API key'
      }), { status: 401, headers: corsHeaders })
    }

    // Build request body (X.AI doesn't support size parameter yet)
    const requestBody = {
      model,
      prompt,
      n,
      response_format
    }

    // Call X.AI Image Generation API
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: 'X.AI Image API error',
        details: data
      }), { status: response.status, headers: corsHeaders })
    }

    return new Response(JSON.stringify(data), {
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Image generation error:', error)
    return new Response(JSON.stringify({
      error: error.message
    }), { status: 500, headers: corsHeaders })
  }
}

/**
 * List available image generation models
 */
function handleImageModels(corsHeaders) {
  const models = [
    {
      id: 'grok-2-image-beta',
      name: 'Grok 2 Image Beta',
      description: 'Beta image generation model by X.AI',
      supported_sizes: ['1024x1024', '1024x1792', '1792x1024'],
      max_images: 1,
      features: ['text-to-image', 'high-quality']
    }
  ]

  return new Response(JSON.stringify({
    models,
    count: models.length
  }), { headers: corsHeaders })
}

/**
 * List available models
 */
function handleModels(corsHeaders) {
  const models = [
    {
      id: 'grok-4-latest',
      name: 'Grok 4 Latest',
      description: 'Most capable Grok model with advanced reasoning',
      context_length: 131072,
      features: ['chat', 'reasoning', 'code']
    },
    {
      id: 'grok-3',
      name: 'Grok 3',
      description: 'Third generation Grok model',
      context_length: 131072,
      features: ['chat', 'reasoning', 'code']
    },
    {
      id: 'grok-2-latest',
      name: 'Grok 2 Latest',
      description: 'Previous generation Grok model',
      context_length: 131072,
      features: ['chat', 'reasoning', 'code']
    },
    {
      id: 'grok-2-vision-1212',
      name: 'Grok 2 Vision',
      description: 'Grok 2 with vision capabilities for image understanding',
      context_length: 8192,
      features: ['chat', 'vision', 'image-understanding']
    },
    {
      id: 'grok-vision-beta',
      name: 'Grok Vision Beta',
      description: 'Beta vision model for experimental image analysis',
      context_length: 8192,
      features: ['chat', 'vision', 'experimental']
    },
    {
      id: 'grok-code-fast-1',
      name: 'Grok Code Fast 1',
      description: 'Fast code generation and understanding model',
      context_length: 131072,
      features: ['chat', 'code', 'fast']
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
      title: 'Grok Worker API Documentation',
      version: '1.0.0',
      description: 'Complete X.AI Grok API integration with 4 models: Grok 4 Latest, Grok 2 Latest, Grok 2 Vision, Grok Vision Beta. Features userId-based encrypted key retrieval from D1 database.',
      contact: {
        name: 'Vegvisr Platform',
        url: 'https://grok.vegvisr.org'
      }
    },
    servers: [
      {
        url: 'https://grok.vegvisr.org',
        description: 'Grok Worker (Production)'
      }
    ],
    tags: [
      { name: 'Chat', description: 'Chat completion endpoints for Grok models' },
      { name: 'Images', description: 'Image generation endpoints using Grok models' },
      { name: 'Transcripts', description: 'YouTube transcript processing to knowledge graphs' },
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
                      worker: { type: 'string', example: 'grok-worker' },
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
          summary: 'List all available Grok models',
          description: 'Get complete list of 3 Grok models with capabilities and features',
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
      '/image-models': {
        get: {
          tags: ['Images'],
          summary: 'List available image generation models',
          description: 'Get list of image generation models with supported sizes and features',
          responses: {
            200: {
              description: 'Image models list',
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
                            supported_sizes: { type: 'array', items: { type: 'string' } },
                            max_images: { type: 'integer' },
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
      '/images': {
        post: {
          tags: ['Images'],
          summary: 'Generate images using Grok',
          description: 'Generate images from text prompts using X.AI image generation models. API key retrieved from D1 using userId.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['prompt'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for D1 key lookup (optional, falls back to env key)' },
                    prompt: { type: 'string', description: 'Text description of the image to generate' },
                    model: { type: 'string', default: 'grok-2-image-beta', description: 'Image model to use' },
                    size: {
                      type: 'string',
                      default: '1024x1024',
                      enum: ['1024x1024', '1024x1792', '1792x1024'],
                      description: 'Size of the generated image'
                    },
                    n: { type: 'integer', default: 1, minimum: 1, maximum: 1, description: 'Number of images to generate' },
                    response_format: { type: 'string', enum: ['url', 'b64_json'], default: 'url', description: 'Format of the response' }
                  }
                },
                examples: {
                  'basic-image': {
                    summary: 'Basic image generation',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      prompt: 'A serene mountain landscape at sunset with a lake reflection',
                      size: '1024x1024'
                    }
                  },
                  'portrait-image': {
                    summary: 'Portrait format image',
                    value: {
                      prompt: 'A futuristic city with flying cars and neon lights',
                      size: '1024x1792',
                      model: 'grok-2-image-beta'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Image generation response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      created: { type: 'integer', description: 'Unix timestamp of when images were created' },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            url: { type: 'string', description: 'URL of the generated image' },
                            b64_json: { type: 'string', description: 'Base64 encoded image (if response_format is b64_json)' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: { description: 'Bad request - missing prompt' },
            401: { description: 'Unauthorized - API key not configured' },
            500: { description: 'Server error' }
          }
        }
      },
      '/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Chat completions (all models)',
          description: 'Generic chat endpoint supporting all 3 Grok models. API key retrieved from D1 using userId.',
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
                    model: { type: 'string', default: 'grok-4-latest', enum: ['grok-4-latest', 'grok-2-latest', 'grok-2-vision-1212', 'grok-vision-beta'] },
                    max_tokens: { type: 'integer', description: 'Maximum tokens in response' },
                    temperature: { type: 'number', minimum: 0, maximum: 2, default: 0 },
                    stream: { type: 'boolean', default: false }
                  }
                },
                examples: {
                  'grok-4': {
                    summary: 'Grok 4 Latest example',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'grok-4-latest',
                      messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: 'Explain quantum computing in simple terms' }
                      ],
                      temperature: 0
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
                      object: { type: 'string' },
                      created: { type: 'integer' },
                      model: { type: 'string' },
                      choices: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            index: { type: 'integer' },
                            message: {
                              type: 'object',
                              properties: {
                                role: { type: 'string' },
                                content: { type: 'string' }
                              }
                            },
                            finish_reason: { type: 'string' }
                          }
                        }
                      },
                      usage: {
                        type: 'object',
                        properties: {
                          prompt_tokens: { type: 'integer' },
                          completion_tokens: { type: 'integer' },
                          total_tokens: { type: 'integer' }
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
      '/process-transcript': {
        post: {
          tags: ['Transcripts'],
          summary: 'Process YouTube transcript to knowledge graph',
          description: 'Transform YouTube transcript into a structured knowledge graph with Norwegian translation or original language. Uses Grok-3 model for comprehensive content generation.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['transcript'],
                  properties: {
                    transcript: {
                      type: 'string',
                      description: 'Full transcript text from YouTube video'
                    },
                    sourceLanguage: {
                      type: 'string',
                      default: 'auto',
                      description: 'Source language of transcript (e.g., "en", "no", "auto")'
                    },
                    targetLanguage: {
                      type: 'string',
                      default: 'norwegian',
                      description: 'Target language for translation. Use "original" to keep source language, or "norwegian" for Norwegian translation'
                    },
                    userId: {
                      type: 'string',
                      description: 'Optional user ID for D1 key lookup. Falls back to env.GROK_API_KEY if not provided'
                    }
                  }
                },
                examples: {
                  'norwegian-translation': {
                    summary: 'Translate to Norwegian',
                    value: {
                      transcript: 'This is a sample YouTube transcript about quantum physics...',
                      sourceLanguage: 'en',
                      targetLanguage: 'norwegian',
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b'
                    }
                  },
                  'original-language': {
                    summary: 'Keep original language',
                    value: {
                      transcript: 'This is a sample YouTube transcript...',
                      sourceLanguage: 'en',
                      targetLanguage: 'original'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Knowledge graph generated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      knowledgeGraph: {
                        type: 'object',
                        properties: {
                          nodes: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                label: { type: 'string' },
                                color: { type: 'string' },
                                type: { type: 'string' },
                                info: { type: 'string', description: 'Rich markdown content' },
                                bibl: { type: 'array' },
                                imageWidth: { type: 'string' },
                                imageHeight: { type: 'string' },
                                visible: { type: 'boolean' },
                                path: { type: 'string', nullable: true }
                              }
                            }
                          },
                          edges: {
                            type: 'array',
                            items: { type: 'object' }
                          }
                        }
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          totalNodes: { type: 'integer' },
                          processingTime: { type: 'integer' },
                          sourceLanguage: { type: 'string' },
                          targetLanguage: { type: 'string' },
                          modelUsed: { type: 'string' },
                          transcriptWords: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: {
              description: 'Bad request - missing transcript',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' }
                    }
                  }
                }
              }
            },
            401: {
              description: 'Unauthorized - API key not configured',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/grok-4-latest': {
        post: {
          tags: ['Chat'],
          summary: 'Grok 4 Latest endpoint',
          description: 'Direct endpoint for Grok 4 Latest - most capable model with 131K context',
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
                    temperature: { type: 'number', default: 0 },
                    max_tokens: { type: 'integer' }
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
      '/grok-2-latest': {
        post: {
          tags: ['Chat'],
          summary: 'Grok 2 Latest endpoint',
          description: 'Direct endpoint for Grok 2 Latest - previous generation model with 131K context',
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
                    temperature: { type: 'number', default: 0 },
                    max_tokens: { type: 'integer' }
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
      '/grok-2-vision-latest': {
        post: {
          tags: ['Chat'],
          summary: 'Grok 2 Vision endpoint',
          description: 'Direct endpoint for Grok 2 Vision - image understanding capabilities',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string' },
                    message: { type: 'string' },
                    messages: { type: 'array', description: 'Can include image URLs in content' },
                    temperature: { type: 'number', default: 0 }
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
      '/grok-vision-beta': {
        post: {
          tags: ['Chat'],
          summary: 'Grok Vision Beta endpoint',
          description: 'Direct endpoint for Grok Vision Beta - experimental vision model',
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
                    temperature: { type: 'number', default: 0 }
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
          description: 'User ID used to retrieve encrypted Grok API key from D1 database (vegvisr_org.user_api_keys). Key is decrypted using ENCRYPTION_MASTER_KEY and used for X.AI API calls. Falls back to env.GROK_API_KEY if user has no key stored.'
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
