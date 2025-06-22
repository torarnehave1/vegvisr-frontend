// @name api-worker
// @description A Cloudflare Worker script to handle various API endpoints for a blog application.
// @version 1.0
// @author Tor Arne Håve
// @license MIT

import { marked } from 'marked'
import { OpenAI } from 'openai'

// Utility functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, x-user-role, X-API-Token, x-user-email',
}

// Domain to Zone ID mapping configuration
const DOMAIN_ZONE_MAPPING = {
  'norsegong.com': 'e577205b812b49d012af046535369808',
  'xyzvibe.com': '602067f0cf860426a35860a8ab179a47',
  'vegvisr.org': '9178eccd3a7e3d71d8ae09defb09422a', // vegvisr.org zone ID
  'slowyou.training': '1417691852abd0e8220f60184b7f4eca', // vegvisr.org zone ID
}

// Protected subdomains configuration - SECURITY CRITICAL
const PROTECTED_SUBDOMAINS = {
  'vegvisr.org': [
    'api', // API Worker - CRITICAL
    'www', // Main website
    'admin', // Admin interface
    'mail', // Email services
    'blog', // Blog subdomain
    'knowledge', // Knowledge worker
    'auth', // Auth worker
    'brand', // Brand worker
    'dash', // Dashboard worker
    'dev', // Development
    'test', // Testing
    'staging', // Staging environment
    'cdn', // CDN
    'static', // Static assets
  ],
  'norsegong.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'xyzvibe.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
  'slowyou.training': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
}

// Security validation function for protected subdomains
function isProtectedSubdomain(subdomain, rootDomain) {
  const protectedList = PROTECTED_SUBDOMAINS[rootDomain]
  return protectedList && protectedList.includes(subdomain.toLowerCase())
}

// Helper function to determine Zone ID from domain
function getZoneIdForDomain(domain) {
  // Extract the root domain from subdomains
  const domainParts = domain.split('.')
  if (domainParts.length >= 2) {
    const rootDomain = domainParts.slice(-2).join('.')
    return DOMAIN_ZONE_MAPPING[rootDomain]
  }
  return null
}

const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

const createErrorResponse = (message, status) => {
  console.error(message)
  return createResponse(JSON.stringify({ error: message }), status)
}

// Endpoint handlers
const handleCreateKnowledgeGraph = async (request, env) => {
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')

  if (!subject) {
    return createErrorResponse('Subject is missing in the prompt', 400)
  }

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: API key missing', 500)
  }

  const prompt = `
Generate a JSON string representing a knowledge graph compatible with Cytoscape, based on the subject: "${subject}". The output must be a valid JSON object with two main keys: "nodes" and "edges". Follow this structure exactly:

    - "nodes": An array of objects, EACH representing a concept related to "${subject}", with:
      - id: A unique string identifier (e.g., "node1")
      - label: A display name for the node relevant to the subject
      - color: A valid CSS color (e.g., "red", "redorange", use natural language)
      - type: Always "info"
      - info: A string with a brief description or null
      - bibl: An array of strings (can be empty)

    - "edges": An array of objects, EACH representing a relationship between concepts related to "${subject}", with:
      - id: A unique UUID string
      - source: The id of the source node
      - target: The id of the target node
      - label: A string describing the relationship or null
      - type: Always "info"
      - info: A string with relationship details or null

    Ensure the JSON is properly formatted, with no trailing commas, and is ready to be parsed by Cytoscape. Create at least 10 nodes and 5 edges relevant to "${subject}". Return only the JSON string, with no additional text or explanations.

`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      temperature: 1,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `You are a precise JSON generator for Cytoscape graphs and an expert in the subject mentioned in "${subject}", and keep the creation of the nodes specific to the subject. Return only valid JSON with no additional text.`,
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const graphData = data.choices[0].message.content.trim()

  // Log the raw JSON response for debugging
  console.log('Raw JSON response from OpenAI:', graphData)

  try {
    const parsedData = JSON.parse(graphData)
    const isValid =
      parsedData.nodes.every((node) => node.type === 'info') &&
      parsedData.edges.every((edge) => edge.type === 'info')
    if (!isValid) {
      throw new Error('Invalid type field in graph data')
    }
    return createResponse(graphData)
  } catch {
    console.error('Error parsing JSON or validating graph data:')
    // Return raw JSON response even if it is not correctly formatted
    return createResponse(graphData, 200)
  }
}

const handleSave = async (request, env) => {
  const { id, markdown, isVisible, email } = await request.json()

  if (!markdown || !email) {
    return createErrorResponse('Markdown content or email is missing', 400)
  }

  const newPrefix = isVisible ? 'vis:' : 'hid:'
  const blogId = id || crypto.randomUUID()
  const newKey =
    id && id.includes(`:${email}`) ? `${newPrefix}${id}` : `${newPrefix}${blogId}:${email}`

  if (id) {
    await Promise.all([env.BINDING_NAME.delete(`vis:${id}`), env.BINDING_NAME.delete(`hid:${id}`)])
  }

  await env.BINDING_NAME.put(newKey, markdown, { metadata: { encoding: 'utf-8' } })
  const shareableLink = `https://api.vegvisr.org/view/${blogId}`

  return createResponse(JSON.stringify({ link: shareableLink }))
}

const handleView = async (request, env) => {
  const url = new URL(request.url)
  const id = url.pathname.split('/').pop()
  const raw = url.searchParams.get('raw') === 'true'

  const keys = await env.BINDING_NAME.list()
  const matchingKey = keys.keys.find(
    (key) => key.name.includes(id) && (key.name.startsWith('vis:') || key.name.startsWith('hid:')),
  )

  if (!matchingKey) {
    return createErrorResponse('Not Found', 404)
  }

  const markdown = await env.BINDING_NAME.get(matchingKey.name)
  if (!markdown) {
    return createErrorResponse('Not Found', 404)
  }

  if (raw) {
    return createResponse(markdown, 200, { 'Content-Type': 'text/plain' })
  }

  const fullUrl = `https://api.vegvisr.org/view/${id}`
  const htmlContent = marked.parse(markdown)
  const shareButton = `     <div style="text-align: center; margin-top: 20px;">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
เว้นวรรคShare on Facebook
      </a>
    </div>
  `
  const finalHtml = `     <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>View Markdown</title>
      <style>
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>
      ${htmlContent}
      ${shareButton}
    </body>
    </html>
  `

  return createResponse(finalHtml, 200, { 'Content-Type': 'text/html' })
}

const handleBlogPosts = async (request, env, showHidden = false) => {
  const url = new URL(request.url)
  const showHiddenParam = url.searchParams.get('hidden') === 'true'
  const prefix = showHidden || showHiddenParam ? 'hid:' : 'vis:'

  const keys = await env.BINDING_NAME.list()
  const posts = []

  for (const key of keys.keys) {
    if (!key.name.startsWith(prefix)) continue

    const markdown = await env.BINDING_NAME.get(key.name)
    if (markdown) {
      const lines = markdown.split('\n')
      const titleLine = lines.find((line) => line.startsWith('#') && !line.includes('!['))
      const title = titleLine ? titleLine.replace(/^#\s*/, '') : 'Untitled'

      const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
      const imageUrl = imageMatch ? imageMatch[1] : 'https://via.placeholder.com/150'

      const abstractLine = lines.find(
        (line) => line.trim() && !line.startsWith('#') && !line.includes('!['),
      )
      const abstract = abstractLine ? abstractLine.slice(0, 100) + '...' : ''

      posts.push({
        id: key.name.replace(/^(vis:|hid:)/, ''),
        title,
        snippet: lines.slice(1, 3).join(' '),
        abstract,
        image: imageUrl,
      })
    }
  }

  return createResponse(JSON.stringify(posts))
}

const handleBlogPostDelete = async (request, env) => {
  const id = request.url.split('/').pop()

  if (!id) {
    return createErrorResponse('Blog post ID is required', 400)
  }

  const keys = await env.BINDING_NAME.list()
  const matchingKey = keys.keys.find(
    (key) => key.name.includes(id) && (key.name.startsWith('vis:') || key.name.startsWith('hid:')),
  )

  if (!matchingKey) {
    return createErrorResponse('Not Found', 404)
  }

  await env.BINDING_NAME.delete(matchingKey.name)
  return createResponse('Blog post deleted successfully')
}

const handleSnippetAdd = async (request, env) => {
  const { id, content } = await request.json()

  if (!id || !content) {
    return createErrorResponse('ID and content are required', 400)
  }

  await env.snippets.put(id, content)
  return createResponse('Snippet added successfully')
}

const handleSnippetGet = async (request, env) => {
  const id = request.url.split('/').pop()
  const snippet = await env.snippets.get(id)

  if (!snippet) {
    return createErrorResponse('Snippet not found', 404)
  }

  return createResponse(JSON.stringify({ id, content: snippet }))
}

const handleSnippetDelete = async (request, env) => {
  const id = request.url.split('/').pop()
  await env.snippets.delete(id)
  return createResponse('Snippet deleted successfully')
}

const handleSnippetList = async (request, env) => {
  const keys = await env.snippets.list()
  return createResponse(JSON.stringify({ keys: keys.keys || [] }))
}

const handleUpload = async (request, env) => {
  const { MY_R2_BUCKET } = env
  const formData = await request.formData()
  const file = formData.get('file')

  if (!file) {
    return createErrorResponse('Missing file', 400)
  }

  const fileExtension = file.name ? file.name.split('.').pop() : ''
  if (!fileExtension) {
    return createErrorResponse('Invalid file name or extension', 400)
  }

  const fileName = `${Date.now()}.${fileExtension}`
  const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

  await MY_R2_BUCKET.put(fileName, file.stream(), {
    httpMetadata: { contentType },
  })

  const fileUrl = `https://blog.vegvisr.org/${fileName}`
  return createResponse(JSON.stringify({ url: fileUrl }))
}

const handleSearch = async (request, env) => {
  const query = new URL(request.url).searchParams.get('query')?.toLowerCase()

  if (!query) {
    return createErrorResponse('Search query is missing', 400)
  }

  const keys = await env.BINDING_NAME.list()
  const results = []

  for (const key of keys.keys) {
    const markdown = await env.BINDING_NAME.get(key.name)
    if (markdown && markdown.toLowerCase().includes(query)) {
      const lines = markdown.split('\n')
      const titleLine = lines.find((line) => line.startsWith('#') && !line.includes('!['))
      const title = titleLine ? titleLine.replace(/^#\s\*/, '') : 'Untitled'

      const imageMatch = markdown.match(/!\[.*?\]\((.*?)\)/)
      const imageUrl = imageMatch ? imageMatch[1] : 'https://via.placeholder.com/150'

      const abstractLine = lines.find(
        (line) => line.trim() && !line.startsWith('#') && !line.includes('!['),
      )
      const abstract = abstractLine ? abstractLine.slice(0, 100) + '...' : ''

      results.push({
        id: key.name.replace(/^(vis:|hid:)/, ''),
        title,
        snippet: lines.slice(1, 3).join(' '),
        abstract,
        image: imageUrl,
      })
    }
  }

  return createResponse(JSON.stringify(results))
}

const handleToggleVisibility = async (request, env) => {
  const { id, isVisible } = await request.json()

  if (!id) {
    return createErrorResponse('Blog post ID is missing', 400)
  }

  const currentKey = isVisible ? `hid:${id}` : `vis:${id}`
  const newKey = isVisible ? `vis:${id}` : `hid:${id}`

  const markdown = await env.BINDING_NAME.get(currentKey)
  if (!markdown) {
    return createErrorResponse('Blog post not found or already in the desired state', 404)
  }

  await env.BINDING_NAME.delete(currentKey)
  await env.BINDING_NAME.put(newKey, markdown, { metadata: { encoding: 'utf-8' } })

  return createResponse('Blog post visibility toggled successfully')
}

const handleGetImage = async (request, env) => {
  const url = new URL(request.url)
  const imageName = url.searchParams.get('name')

  if (!imageName) {
    return createErrorResponse('Image name is missing', 400)
  }

  const image = await env.MY_R2_BUCKET.get(imageName)

  if (!image) {
    return createErrorResponse('Image not found', 404)
  }

  const headers = {
    'Content-Type': image.httpMetadata?.contentType || 'application/octet-stream',
    ...corsHeaders,
  }

  return new Response(image.body, { status: 200, headers })
}

const handleGetImageFromR2 = async (request, env) => {
  const url = new URL(request.url)
  const fileName = url.searchParams.get('name')

  if (!fileName) {
    return createErrorResponse('Image file name is missing', 400)
  }

  const image = await env.MY_R2_BUCKET.get(fileName)

  if (!image) {
    return createErrorResponse('Image not found', 404)
  }

  const headers = {
    'Content-Type': image.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Timing-Allow-Origin': '_',
    'Access-Control-Allow-Origin': '_',
    'X-Content-Type-Options': 'nosniff',
  }

  return new Response(image.body, { status: 200, headers })
}

const handleGetImageHeaders = async (request, env) => {
  const url = new URL(request.url)
  const fileName = url.searchParams.get('name')

  if (!fileName) {
    return createErrorResponse('Image file name is missing', 400)
  }

  const image = await env.MY_R2_BUCKET.get(fileName)

  if (!image) {
    return createErrorResponse('Image not found', 404)
  }

  const headers = {
    'Content-Type': image.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Timing-Allow-Origin': '_',
    'Access-Control-Allow-Origin': '_',
    'X-Content-Type-Options': 'nosniff',
    'Last-Modified': image.httpMetadata?.lastModified || new Date().toUTCString(),
    'Content-Length': image.size, // Add content-length
  }

  return new Response(null, { status: 200, headers }) // No body, only headers
}

const handleSummarize = async (request, env) => {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { text } = body
  if (!text || typeof text !== 'string') {
    return createErrorResponse('Text input is missing or invalid', 400)
  }

  const prompt = `     Summarize the following text into a concise paragraph suitable for a fulltext node:
    ${text}
  `

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: 'You are a summarization assistant. Generate concise summaries.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return createErrorResponse(`OpenAI API error: ${response.status} - ${errorText}`, 500)
  }

  const data = await response.json()
  const summary = data.choices[0].message.content.trim()

  return createResponse(
    JSON.stringify({
      id: `fulltext_${Date.now()}`,
      label: 'Summary',
      type: 'fulltext',
      info: summary,
      color: '#f9f9f9',
    }),
    200,
  )
}

const handleGrokTest = async (request, env) => {
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { prompt } = body
  if (!prompt || typeof prompt !== 'string') {
    return createErrorResponse('Prompt input is missing or invalid', 400)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    // Generate main content
    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: 'You are a philosophical AI providing deep insights.' },
        { role: 'user', content: prompt },
      ],
    })

    const responseText = completion.choices[0].message.content.trim()
    if (!responseText) {
      return createErrorResponse('Empty summary response', 500)
    }

    // Generate bibliographic references in APA format
    const biblCompletion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'You are a scholarly AI. Return only 2-3 bibliographic references in APA format (e.g., "Author, A. A. (Year). Title of work. Publisher."), one per line, with no explanations, headings, or additional text.',
        },
        { role: 'user', content: `Generate references for the topic: ${prompt}` },
      ],
    })

    const biblText = biblCompletion.choices[0].message.content.trim()
    // Split references by newline, filter out empty lines
    const biblReferences = biblText
      .split('\n')
      .filter((ref) => ref.trim())
      .map((ref) => ref.trim())

    return new Response(
      JSON.stringify({
        id: `fulltext_${Date.now()}`,
        label: 'Summary',
        type: 'fulltext',
        info: responseText,
        color: '#f9f9f9',
        bibl: biblReferences,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch {
    return createErrorResponse(`Grok API error:`, 500)
  }
}

const handleGeminiTest = async (request, env) => {
  const apiKey = env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: Google Gemini API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { text, prompt } = body
  const inputText = text || prompt // Accept both 'text' and 'prompt' for compatibility
  if (!inputText || typeof inputText !== 'string') {
    return createErrorResponse('Text or prompt input is missing or invalid', 400)
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: inputText,
                },
              ],
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      return createErrorResponse(`Gemini API error: ${response.status} - ${errorText}`, 500)
    }

    const data = await response.json()

    // Extract the generated text from Gemini's response format
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'

    return createResponse(
      JSON.stringify({
        id: `gemini_${Date.now()}`,
        label: 'Gemini Response',
        type: 'fulltext',
        info: generatedText,
        color: '#e8f4fd',
        model: 'gemini-2.0-flash',
        prompt: inputText,
      }),
    )
  } catch (error) {
    return createErrorResponse(`Gemini API error: ${error.message}`, 500)
  }
}
// Updated endpoint for versatile AI action with response format
const handleAIAction = async (request, env) => {
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const {
    prompt,
    instructions,
    baseURL,
    model,
    temperature,
    max_tokens,
    apiProvider,
    response_format,
  } = body
  if (
    !prompt ||
    !instructions ||
    !baseURL ||
    !model ||
    !temperature ||
    !max_tokens ||
    !apiProvider ||
    !response_format
  ) {
    return createErrorResponse('Missing required parameters', 400)
  }

  let apiKey
  switch (apiProvider.toLowerCase()) {
    case 'xai':
      apiKey = env.XAI_API_KEY
      break
    case 'openai':
      apiKey = env.OPENAI_API_KEY
      break
    case 'google':
      apiKey = env.GOOGLE_API_KEY
      break
    default:
      return createErrorResponse('Unsupported API provider', 400)
  }

  if (!apiKey) {
    return createErrorResponse(`Internal Server Error: ${apiProvider} API key missing`, 500)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  })

  try {
    const completion = await client.chat.completions.create({
      model: model,
      temperature: temperature,
      max_tokens: max_tokens,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: prompt },
      ],
    })

    const responseText = completion.choices[0].message.content
    return createResponse(
      JSON.stringify({
        id: `node_${Date.now()}`,
        label: response_format.label || 'Response',
        type: response_format.type || 'fulltext',
        info: responseText,
        color: response_format.color || '#f9f9f9',
        ...response_format.additional_fields,
      }),
      200,
    )
  } catch {
    return createErrorResponse(`AI API error:`, 500)
  }
}

const handleGetGoogleApiKey = async (request, env) => {
  const apiKey = env.GOOGLE_API_KEY
  const url = new URL(request.url)
  const int_token = url.searchParams.get('key')

  if (!int_token || int_token !== env.INT_TOKEN) {
    return createErrorResponse({ int_token }, 401)
  }

  if (!apiKey) {
    return createErrorResponse('Internal Server Error: Google API key missing', 500)
  }

  return createResponse(JSON.stringify({ apiKey }), 200)
}

const handleUpdateKml = async (request, env) => {
  // --- Authorization ---
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token !== env.INT_TOKEN) {
    return createErrorResponse('Unauthorized: Invalid token', 401)
  }

  // --- Parse Request Body ---
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  // --- Extract Fields with Defaults ---
  const {
    id,
    name,
    description = '',
    longitude,
    latitude,
    altitude = 0,
    styleUrl,
    lookAt = {},
  } = body
  if (!name || longitude === undefined || latitude === undefined) {
    return createErrorResponse('Missing required marker fields', 400)
  }

  // --- Fetch or Initialize KML ---
  const kmlObject = await env.KLM_BUCKET.get('Vegvisr.org.kml')
  let kmlText = ''
  if (kmlObject) {
    kmlText = await kmlObject.text()
  } else {
    kmlText = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n  </Document>\n</kml>`
  }

  // --- Build LookAt Block (if provided) ---
  let lookAtBlock = ''
  if (Object.keys(lookAt).length > 0) {
    lookAtBlock = `\n    <LookAt>\n      <longitude>${lookAt.longitude ?? longitude}</longitude>\n      <latitude>${lookAt.latitude ?? latitude}</latitude>\n      <altitude>${lookAt.altitude ?? altitude}</altitude>\n      <heading>${lookAt.heading ?? 0}</heading>\n      <tilt>${lookAt.tilt ?? 0}</tilt>\n      <gx:fovy>${lookAt.fovy ?? 35}</gx:fovy>\n      <range>${lookAt.range ?? 1000}</range>\n      <altitudeMode>${lookAt.altitudeMode ?? 'absolute'}</altitudeMode>\n    </LookAt>`
  }

  // --- Build styleUrl Block (if provided) ---
  let styleUrlBlock = styleUrl ? `\n    <styleUrl>${styleUrl}</styleUrl>` : ''

  // --- Build id Attribute (if provided) ---
  let idAttr = id ? ` id="${id}"` : ''

  // --- Build Placemark ---
  const placemark = `\n  <Placemark${idAttr}>\n    <name>${name}</name>\n    <description>${description}</description>${lookAtBlock}${styleUrlBlock}\n    <Point>\n      <coordinates>${longitude},${latitude},${altitude}</coordinates>\n    </Point>\n  </Placemark>\n`

  // --- Insert Placemark Before </Document> ---
  kmlText = kmlText.replace(/<\/Document>/, `${placemark}\n</Document>`)

  // --- Save Updated KML ---
  await env.KLM_BUCKET.put('Vegvisr.org.kml', kmlText, {
    httpMetadata: { contentType: 'application/vnd.google-earth.kml+xml' },
  })

  return createResponse(JSON.stringify({ success: true, message: 'KML updated' }))
}

const handleSuggestTitle = async (request, env) => {
  console.log('Handling title suggestion request')
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    console.error('XAI API key missing')
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
    console.log('Request body:', JSON.stringify(body))
  } catch {
    console.error('Invalid JSON body:')
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { nodes, edges } = body
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error('Invalid graph data:', { nodes, edges })
    return createErrorResponse('Invalid graph data', 400)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    // Extract content from node.info fields, filtering out empty or null values
    const nodeContents = nodes
      .map((n) => n.info)
      .filter((info) => info && typeof info === 'string' && info.trim().length > 0)
      .join('\n')

    const prompt = `Generate a concise, descriptive title (max 10 words) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The title should reflect the main theme or subject matter of the content, not the structure of the graph.
    Return only the title, no additional text or explanations.`

    console.log('Sending prompt to Grok:', prompt)

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content:
            'You are a title generator for knowledge graphs. Focus on the content and main themes, not the graph structure. Return only the title.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const title = completion.choices[0].message.content.trim()
    console.log('Generated title:', title)
    return createResponse(JSON.stringify({ title }))
  } catch {
    console.error('Grok API error:')
    return createErrorResponse(`Grok API error:`, 500)
  }
}

const handleSuggestDescription = async (request, env) => {
  console.log('Handling description suggestion request')
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    console.error('XAI API key missing')
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
    console.log('Request body:', JSON.stringify(body))
  } catch {
    console.error('Invalid JSON body:')
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { nodes, edges } = body
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error('Invalid graph data:', { nodes, edges })
    return createErrorResponse('Invalid graph data', 400)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    // Extract content from node.info fields, filtering out empty or null values
    const nodeContents = nodes
      .map((n) => n.info)
      .filter((info) => info && typeof info === 'string' && info.trim().length > 0)
      .join('\n')

    const prompt = `Generate a concise description (2-3 sentences) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The description should summarize the main themes, insights, and connections present in the content.
    Focus on the actual content and its meaning, not the graph structure.
    Return only the description, no additional text or explanations.`

    console.log('Sending prompt to Grok:', prompt)

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content:
            'You are a description generator for knowledge graphs. Focus on summarizing the content themes and insights, not the graph structure. Return only the description.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const description = completion.choices[0].message.content.trim()
    console.log('Generated description:', description)
    return createResponse(JSON.stringify({ description }))
  } catch {
    console.error('Grok API error:')
    return createErrorResponse(`Grok API error:`, 500)
  }
}

const handleSuggestCategories = async (request, env) => {
  console.log('Handling categories suggestion request')
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    console.error('XAI API key missing')
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
    console.log('Request body:', JSON.stringify(body))
  } catch {
    console.error('Invalid JSON body:')
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { nodes, edges } = body
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    console.error('Invalid graph data:', { nodes, edges })
    return createErrorResponse('Invalid graph data', 400)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    // Extract content from node.info fields, filtering out empty or null values
    const nodeContents = nodes
      .map((n) => n.info)
      .filter((info) => info && typeof info === 'string' && info.trim().length > 0)
      .join('\n')

    const prompt = `Generate 3-5 relevant categories (as hashtags) for a knowledge graph based on the following content:

    Content:
    ${nodeContents}

    The categories should reflect the main themes, topics, or subject areas present in the content.
    Return only the categories as hashtags separated by spaces, no additional text or explanations.
    Example format: #Category1 #Category2 #Category3`

    console.log('Sending prompt to Grok:', prompt)

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You are a category generator for knowledge graphs. Focus on the content themes and topics, not the graph structure. Return only hashtag categories.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const categories = completion.choices[0].message.content.trim()
    console.log('Generated categories:', categories)
    return createResponse(JSON.stringify({ categories }))
  } catch {
    console.error('Grok API error:')
    return createErrorResponse(`Grok API error:`, 500)
  }
}

const handleGrokIssueDescription = async (request, env) => {
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { title, description, body: bodyText, labels, mode } = body

  // Validate mode
  if (
    !mode ||
    !['title_to_description', 'description_to_title', 'expand_description'].includes(mode)
  ) {
    return createErrorResponse(
      'Invalid mode. Must be one of: title_to_description, description_to_title, expand_description',
      400,
    )
  }

  // Use either description or body field
  const descriptionText = description || bodyText

  // Validate required fields based on mode
  if (mode === 'title_to_description' && (!title || typeof title !== 'string')) {
    return createErrorResponse('Title is required for title_to_description mode', 400)
  }
  if (
    (mode === 'description_to_title' || mode === 'expand_description') &&
    (!descriptionText || typeof descriptionText !== 'string')
  ) {
    return createErrorResponse(
      'Description is required for description_to_title and expand_description modes',
      400,
    )
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    let labelText = ''
    if (Array.isArray(labels) && labels.length > 0) {
      labelText = `Labels: ${labels.join(', ')}.`
    }

    let prompt, systemContent, maxTokens
    switch (mode) {
      case 'title_to_description':
        prompt = `Generate a concise, clear, and helpful description for a GitHub issue, feature, or enhancement.\nTitle: ${title}\n${labelText}\nThe description should explain the context, the problem or feature, and what a good solution or outcome would look like. Return only the description, no extra text.`
        systemContent =
          'You are an expert at writing clear, concise, and actionable GitHub issue descriptions. Return only the description.'
        maxTokens = 500
        break
      case 'description_to_title':
        prompt = `Generate a clear and concise title for a GitHub issue based on this description:\n${descriptionText}\n${labelText}\nThe title should be specific and descriptive. Return only the title, no extra text.`
        systemContent =
          'You are an expert at writing clear and concise GitHub issue titles. Return only the title.'
        maxTokens = 50
        break
      case 'expand_description':
        prompt = `Expand and enhance this GitHub issue description while maintaining its core message:\n${descriptionText}\n${labelText}\n\nPlease enhance the description by:\n1. Adding more technical context and details\n2. Including relevant background information\n3. Structuring the content with clear sections\n4. Adding specific examples or use cases\n5. Clarifying any ambiguous points\n6. Suggesting potential solutions or approaches\n\nMaintain the original tone and intent while making the description more comprehensive and actionable. Return only the expanded description, no extra text.`
        systemContent =
          'You are an expert at expanding and enhancing GitHub issue descriptions. Focus on adding value through technical details, context, and structure while maintaining the original message. Return only the expanded description.'
        maxTokens = 1000
        break
    }

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
    })

    const result = completion.choices[0].message.content.trim()
    return createResponse(
      JSON.stringify(mode === 'description_to_title' ? { title: result } : { description: result }),
    )
  } catch {
    return createErrorResponse('Grok API error', 500)
  }
}

const handleGenerateMetaAreas = async (request, env) => {
  // --- Authorization ---
  const userRole = request.headers.get('x-user-role') || ''
  if (userRole !== 'Superadmin') {
    return createErrorResponse('Forbidden: Superadmin role required', 403)
  }

  // 1. Fetch all knowledge graphs
  console.log('Fetching all knowledge graphs...')
  const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
  console.log('getknowgraphs response status:', response.status)
  if (!response.ok) {
    const text = await response.text()
    console.log('getknowgraphs response body:', text)
    return createErrorResponse('Failed to fetch graphs', 500)
  }
  const data = await response.json()
  if (!data.results) return createErrorResponse('No graphs found', 404)

  // 2. For each graph, fetch full data and generate a meta area tag if missing
  for (const graph of data.results) {
    const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`)
    if (!graphResponse.ok) continue
    const graphData = await graphResponse.json()

    // Skip if metaArea already exists and is a non-empty string
    const meta = graphData.metadata?.metaArea
    if (typeof meta === 'string' && meta.trim().length > 0) {
      console.log(`Skipping graph ${graph.id} (already has metaArea: '${meta}')`)
      continue
    }

    // Compose prompt for GROK AI
    const prompt = `\nGiven the following knowledge graph content, generate a single, specific, community-relevant Meta Area tag (all capital letters, no spaces, no special characters) that best summarizes the main theme. \n- The tag should be a proper noun or a well-known field of study, tradition, technology, or cultural topic (e.g., NORSE MYTHOLOGY, AI GROK TECH, ETYMOLOGY, HERMETICISM, HINDUISM, CLOUD COMPUTING, ASTROLOGY, SYMBOLISM, PSYCHOLOGY, TECHNOLOGY, SHIVA, SHAKTI, NARASIMHA, etc.).\n- Avoid generic words like FATE, SPIRITUALITY, MINDFULNESS, WISDOM, BREATH, AWAKENING, INTERDISCIPLINARY, TEST, TRANSFORMATION, SACREDNESS, PLAYGROUND, or similar.\n- Only return the tag, in ALL CAPITAL LETTERS.\n\nContent:\n${graphData.metadata?.title || ''}\n${graphData.metadata?.description || ''}\n${graphData.metadata?.category || ''}\n${graphData.nodes?.map((n) => n.label + ' ' + (n.info || '')).join(' ')}\n`

    // Call GROK AI
    let metaArea = ''
    try {
      const client = new OpenAI({
        apiKey: env.XAI_API_KEY,
        baseURL: 'https://api.x.ai/v1',
      })
      const completion = await client.chat.completions.create({
        model: 'grok-3-beta',
        temperature: 0.7,
        max_tokens: 20,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at summarizing knowledge graphs. Return only a single, specific, community-relevant, ALL CAPS, proper-noun tag. Avoid generic words.',
          },
          { role: 'user', content: prompt },
        ],
      })
      metaArea = completion.choices[0].message.content.trim().split(/\s+/)[0].toUpperCase()
      // Filter out banned tags
      const bannedTags = [
        'FATE',
        'SPIRITUALITY',
        'MINDFULNESS',
        'WISDOM',
        'BREATH',
        'AWAKENING',
        'INTERDISCIPLINARY',
        'TEST',
        'TRANSFORMATION',
        'SACREDNESS',
        'PLAYGROUND',
      ]
      if (bannedTags.includes(metaArea)) {
        console.log(
          `Banned metaArea '${metaArea}' generated for graph ${graph.id}, skipping update.`,
        )
        continue
      }
    } catch {
      continue // Skip on error
    }

    // 3. Update the graph with the new meta area
    await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: graph.id,
        graphData: {
          ...graphData,
          metadata: {
            ...graphData.metadata,
            metaArea,
          },
        },
      }),
    })
  }

  return createResponse(JSON.stringify({ success: true }))
}

// --- GROK Ask Endpoint ---
const handleGrokAsk = async (request, env) => {
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  let { context, question } = body
  if (!context || typeof context !== 'string') {
    return createErrorResponse('Context is required and must be a string', 400)
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    return createErrorResponse('Question is required and must be a non-empty string', 400)
  }

  // Strip markdown/HTML from context using marked
  let plainContext = ''
  try {
    // marked.parse returns HTML, so strip HTML tags
    const html = marked.parse(context)
    plainContext = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    plainContext = context
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  const prompt = `Given the following context, answer the user's question in detail.\n\nContext:\n${plainContext}\n\nQuestion: ${question}`
  const systemContent =
    "You are an expert assistant. Use the provided context to answer the user's question in detail."

  try {
    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
    })
    const result = completion.choices[0].message.content.trim()
    return createResponse(JSON.stringify({ result }), 200)
  } catch {
    return createErrorResponse('Grok ask error', 500)
  }
}

// --- Generate Header Image Endpoint ---
const handleGenerateHeaderImage = async (request, env) => {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: OpenAI API key missing', 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  let { prompt } = body
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return createErrorResponse('Prompt is required and must be a non-empty string', 400)
  }
  // Add horizontal/landscape hint
  prompt = prompt + ', horizontal, wide, landscape, header image'

  // 1. Call OpenAI DALL-E 3
  let imageUrl
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024', // Updated to supported size for horizontal images
        response_format: 'url',
      }),
    })
    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return createErrorResponse('OpenAI error: ' + err, 500)
    }
    const openaiData = await openaiRes.json()
    imageUrl = openaiData.data[0].url
  } catch {
    return createErrorResponse('Failed to generate image', 500)
  }

  // 2. Download the image
  let imageBuffer
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('Failed to download image')
    imageBuffer = await imgRes.arrayBuffer()
  } catch {
    return createErrorResponse('Failed to download image', 500)
  }

  // 3. Upload to R2
  const imageId = Date.now() + '-' + Math.random().toString(36).slice(2, 10)
  const fileName = `${imageId}.png`
  try {
    await env.MY_R2_BUCKET.put(fileName, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
    })
  } catch {
    return createErrorResponse('Failed to upload image to R2', 500)
  }

  // 4. Return the markdown string
  const publicUrl = `https://vegvisr.imgix.net/${fileName}`
  const markdown = `![Header|width: 100%; height: 200px; object-fit: cover; object-position: center](${publicUrl})`
  return createResponse(JSON.stringify({ markdown, url: publicUrl }), 200)
}

// --- Generate Image Prompt Endpoint ---
const handleGenerateImagePrompt = async (request, env) => {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: OpenAI API key missing', 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const { context } = body
  if (!context || typeof context !== 'string' || !context.trim()) {
    return createErrorResponse('Context is required and must be a non-empty string', 400)
  }

  // Compose the system and user prompt
  const systemPrompt = `You are an expert at creating visually descriptive prompts for AI image generation. Your job is to turn a text context into a concise, creative, and visually rich prompt for DALL-E 3. Always make the image horizontal, wide, and suitable as a website header. Do not mention text, captions, or watermarks. Do not include people unless the context requires it. Focus on landscape, atmosphere, and mood.`
  const userPrompt = `Context: ${context}\n\nGenerate a single, creative, visually descriptive prompt for DALL-E 3 to create a horizontal header image. Do not include any explanations or extra text.`

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 100,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      return createErrorResponse('OpenAI error: ' + err, 500)
    }
    const openaiData = await openaiRes.json()
    let prompt = openaiData.choices[0].message.content.trim()
    // Remove any extra text or explanations
    if (prompt.startsWith('"') && prompt.endsWith('"')) prompt = prompt.slice(1, -1)
    return createResponse(JSON.stringify({ prompt }), 200)
  } catch {
    return createErrorResponse('Failed to generate image prompt', 500)
  }
}

const handleListR2Images = async (request, env) => {
  const list = await env.MY_R2_BUCKET.list()
  // Only include common image extensions
  const images = list.objects
    .filter((obj) => /\.(png|jpe?g|gif|webp)$/i.test(obj.key))
    .map((obj) => ({
      key: obj.key,
      url: `https://vegvisr.imgix.net/${obj.key}`,
    }))
  return createResponse(JSON.stringify({ images }), 200)
}

// --- YouTube Search Endpoint ---
const handleYouTubeSearch = async (request, env) => {
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: YouTube API key missing', 500)
  }

  const url = new URL(request.url)
  const query = url.searchParams.get('q')

  if (!query) {
    return createErrorResponse('Search query parameter "q" is required', 400)
  }

  console.log('🔍 YouTube Search Request:', { query })

  try {
    // Build URL with parameters
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'id,snippet')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('maxResults', '10')
    searchUrl.searchParams.set('key', apiKey)
    searchUrl.searchParams.set('type', 'video')

    console.log('📡 Calling YouTube API:', searchUrl.toString())

    const apiResponse = await fetch(searchUrl.toString())

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('❌ YouTube API Error:', errorText)
      return createErrorResponse(
        `YouTube API error: ${apiResponse.status} - ${errorText}`,
        apiResponse.status,
      )
    }

    const data = await apiResponse.json()
    console.log('✅ YouTube Search Results:', { count: data.items?.length || 0 })

    // Get full descriptions for all videoIds
    const videoIds = data.items.map((item) => item.id.videoId).join(',')
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds}&key=${apiKey}`
    const detailsResponse = await fetch(detailsUrl)
    const detailsData = await detailsResponse.json()
    const detailsMap = {}
    if (detailsData.items) {
      for (const item of detailsData.items) {
        detailsMap[item.id] = item.snippet?.description || ''
      }
    }

    // Transform the data to match our expected format, using the full description if available
    const results =
      data.items?.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: detailsMap[item.id.videoId] || item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnails: item.snippet.thumbnails,
      })) || []

    return createResponse(
      JSON.stringify({
        success: true,
        query: query,
        results: results,
        totalResults: results.length,
      }),
    )
  } catch (error) {
    console.error('❌ YouTube Search Error:', error)
    return createErrorResponse('Failed to search YouTube videos: ' + error.message, 500)
  }
}

// --- YouTube Transcript IO Endpoint ---
const handleYouTubeTranscriptIO = async (request, env) => {
  const url = new URL(request.url)
  const videoId = url.pathname.split('/').pop()

  if (!videoId) {
    return createErrorResponse('Video ID is required', 400)
  }

  const apiToken = env.YOUTUBE_TRANSCRIPT_IO_TOKEN
  if (!apiToken) {
    return createErrorResponse(
      'Internal Server Error: YouTube Transcript IO API token missing',
      500,
    )
  }

  console.log('📺 YouTube Transcript IO Request:', { videoId })

  try {
    // Call the YouTube Transcript IO API exactly as documented
    const response = await fetch('https://www.youtube-transcript.io/api/transcripts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: [videoId],
      }),
    })

    console.log('📡 YouTube Transcript IO API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ YouTube Transcript IO API Error:', errorText)
      return createErrorResponse(
        `YouTube Transcript IO API error: ${response.status} - ${errorText}`,
        response.status,
      )
    }

    const data = await response.json()
    console.log('✅ YouTube Transcript IO Results:', { videoId, hasData: !!data })

    return createResponse(
      JSON.stringify({
        success: true,
        videoId: videoId,
        transcript: data,
      }),
    )
  } catch (error) {
    console.error('❌ YouTube Transcript IO Error:', error)
    return createErrorResponse('Failed to get YouTube transcript: ' + error.message, 500)
  }
}

// --- DOWNSUB URL Transcript Endpoint (for non-YouTube URLs) ---
const handleDownsubUrlTranscript = async (request, env) => {
  const apiToken = env.DOWNDUB_API_TOKEN
  if (!apiToken) {
    return createErrorResponse('Internal Server Error: DOWNSUB API token missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { url } = body
  if (!url) {
    return createErrorResponse('URL is required', 400)
  }

  console.log('🔽 DOWNSUB URL Request:', { url })

  try {
    // Call the DOWNSUB API with the provided URL
    const response = await fetch('https://api.downsub.com/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
      }),
    })

    console.log('📡 DOWNSUB API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ DOWNSUB API Error:', errorText)
      return createErrorResponse(
        `DOWNSUB API error: ${response.status} - ${errorText}`,
        response.status,
      )
    }

    const data = await response.json()
    console.log('✅ DOWNSUB URL Results:', { url, hasData: !!data })

    return createResponse(
      JSON.stringify({
        success: true,
        originalUrl: url,
        transcript: data,
      }),
    )
  } catch (error) {
    console.error('❌ DOWNSUB URL Error:', error)
    return createErrorResponse('Failed to get DOWNSUB transcript: ' + error.message, 500)
  }
}

// --- DOWNSUB Transcript Endpoint ---
const handleDownsubTranscript = async (request, env) => {
  const url = new URL(request.url)
  const videoId = url.pathname.split('/').pop()

  if (!videoId) {
    return createErrorResponse('Video ID is required', 400)
  }

  const apiToken = env.DOWNDUB_API_TOKEN
  if (!apiToken) {
    return createErrorResponse('Internal Server Error: DOWNSUB API token missing', 500)
  }

  // Construct full YouTube URL from video ID
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

  console.log('🔽 DOWNSUB Request:', { videoId, youtubeUrl })

  try {
    // Call the DOWNSUB API exactly as documented
    const response = await fetch('https://api.downsub.com/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: youtubeUrl,
      }),
    })

    console.log('📡 DOWNSUB API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ DOWNSUB API Error:', errorText)
      return createErrorResponse(
        `DOWNSUB API error: ${response.status} - ${errorText}`,
        response.status,
      )
    }

    const data = await response.json()
    console.log('✅ DOWNSUB Results:', { videoId, hasData: !!data })

    return createResponse(
      JSON.stringify({
        success: true,
        videoId: videoId,
        youtubeUrl: youtubeUrl,
        transcript: data,
      }),
    )
  } catch (error) {
    console.error('❌ DOWNSUB Error:', error)
    return createErrorResponse('Failed to get DOWNSUB transcript: ' + error.message, 500)
  }
}

// Add new route handler for Mystmkra.io proxy
async function handleMystmkraProxy(request) {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) {
    return new Response(JSON.stringify({ error: 'Missing API token' }), {
      status: 401,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    })
  }

  try {
    const body = await request.json()
    const response = await fetch('https://mystmkra.io/dropbox/api/markdown/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiToken,
      },
      body: JSON.stringify(body),
    })

    let result
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      result = await response.json()
    } else {
      const text = await response.text()
      console.log('Mystmkra.io raw response:', text)
      result = { error: 'Mystmkra.io did not return JSON', status: response.status, raw: text }
    }

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to proxy request to Mystmkra.io' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    })
  }
}

// --- GPT-4 Vision Image Generation Endpoint ---
const handleGPT4VisionImage = async (request, env) => {
  if (!env.OPENAI_API_KEY) {
    return createErrorResponse('OpenAI API key not configured', 500)
  }

  try {
    const body = await request.json()
    let { prompt, model = 'dall-e-2', size = '1024x1024' } = body

    console.log('=== GPT4 Vision Image Generation Request ===')
    console.log('Model from request body:', model)
    console.log('Size from request body:', size)
    console.log('Prompt length:', prompt?.length || 0)
    console.log('Prompt preview:', prompt?.substring(0, 100) + '...')

    if (!prompt) {
      return createErrorResponse('Prompt is required', 400)
    }

    // Parse model, size, and quality from prompt if provided (overrides request body)
    let quality = 'auto' // Default quality
    if (prompt.includes('|')) {
      const parts = prompt.split('|')
      const modelPart = parts.find((p) => p.startsWith('model:'))
      const sizePart = parts.find((p) => p.startsWith('size:'))
      const qualityPart = parts.find((p) => p.startsWith('quality:'))

      if (modelPart) {
        const promptModel = modelPart.replace('model:', '').trim()
        console.log('🔍 Model found in prompt:', promptModel)
        model = promptModel
      }

      if (sizePart) {
        const promptSize = sizePart.replace('size:', '').trim()
        console.log('🔍 Size found in prompt:', promptSize)
        size = promptSize
      }

      if (qualityPart) {
        const promptQuality = qualityPart.replace('quality:', '').trim()
        console.log('🔍 Quality found in prompt:', promptQuality)
        quality = promptQuality
      }
    }

    // Set model-specific quality defaults and validate
    if (quality === 'auto') {
      if (model === 'gpt-image-1') {
        quality = 'auto' // gpt-image-1 supports auto
      } else if (model === 'dall-e-3') {
        quality = 'standard' // dall-e-3 default
      } else if (model === 'dall-e-2') {
        quality = 'standard' // dall-e-2 only supports standard
      }
    }

    // Validate quality for each model
    const qualityValidation = {
      'gpt-image-1': ['auto', 'high', 'medium', 'low'],
      'dall-e-3': ['hd', 'standard'],
      'dall-e-2': ['standard'],
    }

    if (!qualityValidation[model].includes(quality)) {
      console.error('❌ Invalid quality for model:', {
        model,
        quality,
        valid: qualityValidation[model],
      })
      return createErrorResponse(
        `Invalid quality '${quality}' for model '${model}'. Valid options: ${qualityValidation[model].join(', ')}`,
        400,
      )
    }

    console.log('📋 Final model to use:', model)
    console.log('📋 Final size to use:', size)
    console.log('📋 Final quality to use:', quality)

    // Validate model
    const validModels = ['dall-e-2', 'dall-e-3', 'gpt-image-1']
    if (!validModels.includes(model)) {
      console.error('❌ Invalid model requested:', model)
      return createErrorResponse('Invalid model. Must be one of: ' + validModels.join(', '), 400)
    }

    console.log('✅ Model validation passed for:', model)

    // Validate size based on model
    const validSizes = {
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
      'dall-e-3': ['1024x1024', '1024x1792', '1792x1024'],
      'gpt-image-1': ['1024x1024', '1024x1536', '1536x1024', 'auto'],
    }

    if (!validSizes[model].includes(size)) {
      return createErrorResponse(
        `Invalid size for model ${model}. Must be one of: ${validSizes[model].join(', ')}`,
        400,
      )
    }

    // Prepare request body based on model
    const requestBody = {
      model,
      prompt,
      size,
      n: 1,
    }

    // Add quality parameter only for models that support it
    if (model === 'dall-e-3' || model === 'gpt-image-1') {
      requestBody.quality = quality
      console.log('📊 Including quality parameter:', quality)
    } else {
      console.log('📊 Omitting quality parameter for', model, '(not supported)')
    }

    // Add response_format only for DALL-E models
    if (model.startsWith('dall-e')) {
      requestBody.response_format = 'url'
      console.log('🎨 Using DALL-E model with URL response format')
    } else {
      console.log('🤖 Using GPT-Image model with base64 response format')
    }

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2))

    // Generate image using OpenAI
    console.log('🚀 Calling OpenAI Image Generation API...')
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    console.log('📥 OpenAI API Response Status:', response.status, response.statusText)

    if (!response.ok) {
      const error = await response.json()
      return createErrorResponse(
        error.error?.message || 'Failed to generate image',
        response.status,
      )
    }

    const data = await response.json()
    console.log('📊 API Response keys:', Object.keys(data))
    console.log('📊 Data array length:', data.data?.length || 0)
    if (data.data?.[0]) {
      console.log('📊 First data item keys:', Object.keys(data.data[0]))
    }

    // Parse additional parameters from prompt if they exist
    let imageType = 'header'
    let finalPrompt = prompt

    // Check if prompt contains structured format
    if (prompt.includes('|')) {
      const parts = prompt.split('|')
      const promptPart = parts.find((p) => p.startsWith('prompt:'))
      const typePart = parts.find((p) => p.startsWith('type:'))

      if (promptPart) {
        finalPrompt = promptPart.replace('prompt:', '')
      }
      if (typePart) {
        imageType = typePart.replace('type:', '')
      }
    }

    // Handle different response formats
    if (model.startsWith('dall-e')) {
      console.log('🎨 Processing DALL-E response (URL format)')
      const imageUrl = data.data[0].url
      console.log('🔗 Image URL received:', imageUrl?.substring(0, 50) + '...')

      // Return preview data WITHOUT saving to R2
      return createResponse(
        JSON.stringify({
          id: `generated_image_${Date.now()}`,
          label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
          type: 'fulltext',
          info: null, // Will be populated after approval
          color: '#e8f4fd',
          bibl: [`Generated using ${model} (${quality} quality) with prompt: "${finalPrompt}"`],
          imageWidth: '100%',
          imageHeight: '100%',
          metadata: {
            previewImageUrl: imageUrl, // Original OpenAI URL for preview
            originalPrompt: finalPrompt,
            imageType: imageType,
            model: model,
            size: size,
            quality: quality,
            needsApproval: true, // Flag indicating this image needs approval before saving
          },
        }),
      )
    } else {
      console.log('🤖 Processing GPT-Image response (base64 format)')
      const base64Data = data.data[0].b64_json
      console.log('📏 Base64 data length:', base64Data?.length || 0)

      if (!base64Data) {
        console.error('❌ No base64 image data received from API')
        return createErrorResponse('No image data received from API', 500)
      }

      // Convert base64 to data URL for preview
      const previewDataUrl = `data:image/png;base64,${base64Data}`

      // Return preview data WITHOUT saving to R2
      return createResponse(
        JSON.stringify({
          id: `generated_image_${Date.now()}`,
          label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
          type: 'fulltext',
          info: null, // Will be populated after approval
          color: '#e8f4fd',
          bibl: [`Generated using ${model} (${quality} quality) with prompt: "${finalPrompt}"`],
          imageWidth: '100%',
          imageHeight: '100%',
          metadata: {
            previewImageUrl: previewDataUrl, // Base64 data URL for preview
            base64Data: base64Data, // Store base64 data for later upload
            originalPrompt: finalPrompt,
            imageType: imageType,
            model: model,
            size: size,
            quality: quality,
            needsApproval: true, // Flag indicating this image needs approval before saving
          },
        }),
      )
    }
  } catch (error) {
    console.error('Error in handleGPT4VisionImage:', error)
    return createErrorResponse('Failed to generate image', 500)
  }
}

// --- Save Approved AI Image Endpoint ---
const handleSaveApprovedImage = async (request, env) => {
  if (!env.MY_R2_BUCKET) {
    return createErrorResponse('R2 bucket not configured', 500)
  }

  try {
    const body = await request.json()
    const { imageData } = body

    if (!imageData || !imageData.metadata) {
      return createErrorResponse('Invalid image data provided', 400)
    }

    const { previewImageUrl, base64Data, originalPrompt, imageType, model, size, quality } =
      imageData.metadata

    console.log('=== Saving Approved AI Image ===')
    console.log('Model:', model)
    console.log('Image Type:', imageType)
    console.log('Size:', size)

    let imageBuffer
    let contentType = 'image/png'

    // Handle different image sources
    if (base64Data) {
      // For GPT-Image models with base64 data
      console.log('🔄 Processing base64 image data...')
      const binaryData = atob(base64Data)
      const bytes = new Uint8Array(binaryData.length)
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i)
      }
      imageBuffer = bytes
      console.log('✅ Base64 conversion complete, size:', bytes.length, 'bytes')
    } else if (previewImageUrl && previewImageUrl.startsWith('http')) {
      // For DALL-E models with URL
      console.log('⬇️ Downloading image from URL...')
      const response = await fetch(previewImageUrl)
      if (!response.ok) {
        throw new Error('Failed to download image from preview URL')
      }
      const arrayBuffer = await response.arrayBuffer()
      imageBuffer = new Uint8Array(arrayBuffer)
      console.log('✅ Image download complete, size:', imageBuffer.length, 'bytes')
    } else {
      throw new Error('No valid image source found')
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `ai-generated/${timestamp}-${Math.random().toString(36).substring(2, 15)}.png`
    console.log('📁 Generated filename:', filename)

    // Upload to R2
    console.log('⬆️ Uploading to R2 bucket...')
    await env.MY_R2_BUCKET.put(filename, imageBuffer, {
      httpMetadata: {
        contentType: contentType,
      },
    })
    console.log('✅ R2 upload complete')

    // Generate appropriate markdown based on image type
    const finalImageUrl = `https://vegvisr.imgix.net/${filename}`
    let imageMarkdown = ''

    switch (imageType.toLowerCase()) {
      case 'header':
        imageMarkdown = `![Header|width: 100%; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`
        break
      case 'leftside':
        imageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`
        break
      case 'rightside':
        imageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${finalImageUrl})`
        break
      default:
        imageMarkdown = `![Generated Image|width: 300px; height: auto; object-fit: 'cover'](${finalImageUrl})`
    }

    console.log('🎉 Approved image saved successfully!')
    console.log('📄 Final image URL:', finalImageUrl)

    // Return the final node data
    return createResponse(
      JSON.stringify({
        id: `approved_image_${Date.now()}`,
        label: `Generated ${imageType.charAt(0).toUpperCase() + imageType.slice(1)} Image`,
        type: 'fulltext',
        info: imageMarkdown,
        color: '#e8f4fd',
        bibl: [`Generated using ${model} (${quality} quality) with prompt: "${originalPrompt}"`],
        imageWidth: '100%',
        imageHeight: '100%',
        metadata: {
          generatedImageUrl: finalImageUrl,
          originalPrompt: originalPrompt,
          imageType: imageType,
          model: model,
          size: size,
          quality: quality,
          approved: true,
          savedAt: new Date().toISOString(),
        },
      }),
    )
  } catch (error) {
    console.error('Error in handleSaveApprovedImage:', error)
    return createErrorResponse('Failed to save approved image: ' + error.message, 500)
  }
}

// --- Process Transcript to Knowledge Graph Endpoint ---
const handleProcessTranscript = async (request, env) => {
  try {
    console.log('=== handleProcessTranscript called ===')

    const body = await request.json()
    console.log('Request body keys:', Object.keys(body))

    const { transcript, sourceLanguage, targetLanguage } = body

    if (!transcript) {
      console.error('Missing transcript text in request')
      return createErrorResponse('Missing transcript text', 400)
    }

    console.log('=== Processing Transcript ===')
    console.log('Transcript length:', transcript.length)
    console.log('Source language:', sourceLanguage)
    console.log('Target language:', targetLanguage)

    // Check if Grok API key is available
    const apiKey = env.XAI_API_KEY
    if (!apiKey) {
      console.error('Grok API key not found in environment')
      return createErrorResponse('Grok API key not configured', 500)
    }
    console.log('Grok API key found:', apiKey.substring(0, 10) + '...')

    // Check transcript length and handle accordingly
    const transcriptWords = transcript.split(/\s+/).length
    console.log('Transcript word count:', transcriptWords)

    let prompt
    let maxTokens = 12000 // Grok has larger context window

    if (transcriptWords > 3000) {
      // For very long transcripts, use comprehensive processing
      console.log('Large transcript detected, using comprehensive processing')
      maxTokens = 16000 // Use Grok's full capacity for large transcripts

      prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph. Create 8-15 detailed thematic sections as nodes.

SOURCE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET: Norwegian

RULES:
1. Translate EVERYTHING to Norwegian with high quality
2. Create nodes with structure: {"id": "del_X", "label": "DEL X: [Descriptive Title]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive content", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}
3. Split into logical thematic sections - be thorough, don't skip content
4. Use rich markdown formatting in "info" field with headers, lists, emphasis
5. Each node should contain substantial content (200-800 words)
6. Include key quotes, important details, and context
7. Create a comprehensive knowledge graph that captures the full essence

TRANSCRIPT (full content):
${transcript}

Return JSON: {"nodes": [...], "edges": []}`
    } else {
      // For shorter transcripts, use detailed processing
      console.log('Standard transcript length, using detailed processing')

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
- Each node should be substantial (150-600 words)
- Include important quotes, examples, and detailed explanations
- Don't summarize - be comprehensive and detailed

TRANSCRIPT:
${transcript}

Return only JSON: {"nodes": [...], "edges": []}`
    }

    console.log('Calling Grok AI API...')

    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
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

    console.log('Grok AI API response received successfully')
    const knowledgeGraphData = completion.choices[0].message.content.trim()

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

      return createResponse(
        JSON.stringify({
          knowledgeGraph: parsedGraph,
          stats: {
            totalNodes: parsedGraph.nodes.length,
            processingTime: Date.now(),
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            modelUsed: 'grok-3-beta',
            transcriptWords: transcriptWords,
          },
        }),
      )
    } catch (parseError) {
      console.error('Error parsing generated JSON:', parseError)
      console.log('Raw response:', knowledgeGraphData)

      // Return raw response for debugging
      return createResponse(
        JSON.stringify({
          knowledgeGraph: { nodes: [], edges: [] },
          error: 'Failed to parse generated JSON',
          rawResponse: knowledgeGraphData,
        }),
        500,
      )
    }
  } catch (error) {
    console.error('Error in handleProcessTranscript:', error)
    return createErrorResponse(error.message || 'Internal server error', 500)
  }
}

// --- AI Generate Node Endpoint ---
const handleAIGenerateNode = async (request, env) => {
  try {
    const { userRequest, graphId, username, contextType, contextData } = await request.json()

    console.log('=== AI Generate Node Debug ===')
    console.log('userRequest:', userRequest)
    console.log('graphId:', graphId)
    console.log('username:', username)
    console.log('contextType:', contextType)
    console.log('contextData:', JSON.stringify(contextData, null, 2))
    console.log('contextData type:', typeof contextData)
    console.log(
      'contextData length/size:',
      contextData ? Object.keys(contextData).length : 'null/undefined',
    )
    console.log('===============================')

    if (!userRequest) {
      return createErrorResponse('Missing userRequest parameter', 400)
    }

    // Get templates from knowledge worker
    let templates
    try {
      console.log('Attempting to fetch templates using KNOWLEDGE binding...')
      if (!env.KNOWLEDGE) {
        console.error('KNOWLEDGE binding is not available')
        throw new Error('KNOWLEDGE binding is not available')
      }

      const templatesResponse = await env.KNOWLEDGE.fetch(
        'https://knowledge.vegvisr.org/getAITemplates',
      )
      console.log('Templates response status:', templatesResponse.status)

      if (!templatesResponse.ok) {
        const errorText = await templatesResponse.text()
        console.error('Templates response error:', errorText)
        throw new Error(`Failed to fetch templates: ${templatesResponse.status} - ${errorText}`)
      }

      const templatesData = await templatesResponse.json()
      if (!templatesData.results || !Array.isArray(templatesData.results)) {
        throw new Error('Invalid templates data format - missing results array')
      }
      templates = templatesData.results
      console.log('Successfully fetched templates:', templates)
    } catch (error) {
      console.error('Detailed error fetching templates:', error)
      return createErrorResponse(`Failed to fetch templates: ${error.message}`, 500)
    }

    // Get graph context if available
    let graphContext = ''
    if (graphId) {
      try {
        const graphResponse = await env.KNOWLEDGE.fetch(
          `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`,
        )
        if (graphResponse.ok) {
          const graphData = await graphResponse.json()
          if (graphData?.nodes) {
            graphContext = graphData.nodes
              .filter((node) => node.visible !== false)
              .map((node) => `Node: ${node.label}\nType: ${node.type}\nInfo: ${node.info || ''}`)
              .join('\n\n')
          }
        }
      } catch (error) {
        console.error('Error fetching graph context:', error)
      }
    }

    // Process context based on type
    let finalContext = ''
    if (contextType === 'current' && contextData) {
      finalContext = `Current Node Context:\n${JSON.stringify(contextData, null, 2)}`
    } else if (contextType === 'all' && contextData) {
      finalContext = `All Nodes Context:\n${graphContext}`
    }

    // Create the prompt with all context
    const prompt = `Given the following user request and available templates, generate an appropriate node.

User Request: ${userRequest}
${username ? `Username: @${username}` : ''}

Available Templates:
${templates
  .map(
    (t) => `Template: ${t.label}
Type: ${t.type}
Example Node: ${JSON.stringify(t.nodes, null, 2)}
AI Instructions: ${t.ai_instructions || 'No specific instructions provided.'}`,
  )
  .join('\n')}

${finalContext ? `\nContext for generation:\n${finalContext}` : ''}

Based on the user's request, select the most appropriate template and generate content following its structure and instructions.
The generated content must strictly follow the AI Instructions of the selected template.
Return a JSON object with the following structure:
{
"template": "selected_template_id",
"content": "generated_content"
}`

    // Generate content
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at understanding user intent and generating appropriate content for knowledge graphs. You must strictly follow the AI Instructions provided in the template when generating content.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const result = JSON.parse(completion.choices[0].message.content.trim())
    const selectedTemplate = templates.find((t) => t.id === result.template) || templates[0]

    // Create the node using the selected template's structure
    const node = {
      id: crypto.randomUUID(),
      label: selectedTemplate.nodes.label,
      color: selectedTemplate.nodes.color,
      type: selectedTemplate.nodes.type,
      info: result.content,
      bibl: selectedTemplate.nodes.bibl || [],
      imageWidth: selectedTemplate.nodes.imageWidth,
      imageHeight: selectedTemplate.nodes.imageHeight,
      visible: true,
      path: selectedTemplate.nodes.path || '',
    }

    // If the info field is an object, merge its properties with the node
    if (typeof node.info === 'object' && node.info !== null) {
      const infoObj = node.info
      node.info = infoObj.info || ''
      node.label = infoObj.label || node.label
      node.color = infoObj.color || node.color
      node.type = infoObj.type || node.type
      node.bibl = infoObj.bibl || node.bibl
      node.imageWidth = infoObj.imageWidth || node.imageWidth
      node.imageHeight = infoObj.imageHeight || node.imageHeight
      node.path = infoObj.path || node.path
    }

    return createResponse(JSON.stringify({ node }))
  } catch (error) {
    console.error('Error in handleAIGenerateNode:', error)
    return createErrorResponse(error.message || 'Internal server error', 500)
  }
}

// --- Style Templates Handler ---
const handleGetStyleTemplates = async (request) => {
  const url = new URL(request.url)
  const nodeType = url.searchParams.get('nodeType')

  // Built-in style templates - in a real app, these would come from a database
  const allTemplates = [
    {
      id: 'fulltext_complete_enhancer',
      name: 'Complete FullText Enhancer',
      description:
        'Adds FANCY headers, SECTION blocks, QUOTE citations, WNOTE annotations, and contextual images',
      nodeTypes: ['fulltext', 'title'],
      transformationRules: {
        addFancyHeaders: true,
        addSections: true,
        addQuotes: true,
        addWorkNotes: true,
        addHeaderImage: true,
        addSideImages: {
          leftside: true,
          rightside: true,
          contextual: true,
        },
      },
      category: 'comprehensive',
      isActive: true,
    },
    {
      id: 'visual_content_formatter',
      name: 'Visual Content Formatter',
      description:
        'Focus on image positioning with leftside/rightside placement and WNOTE integration',
      nodeTypes: ['fulltext', 'worknote'],
      transformationRules: {
        addHeaderImage: true,
        addSideImages: {
          leftside: true,
          rightside: true,
          contextual: true,
        },
        addWorkNotes: true,
        addSections: true,
      },
      category: 'visual',
      isActive: true,
    },
    {
      id: 'work_note_enhancer',
      name: 'Work Note Enhancer',
      description:
        'Specialized WNOTE formatting with contextual rightside images for technical content',
      nodeTypes: ['fulltext', 'worknote'],
      transformationRules: {
        addWorkNotes: true,
        addSideImages: {
          rightside: true,
          contextual: true,
        },
        addSections: true,
      },
      category: 'technical',
      isActive: true,
    },
    {
      id: 'header_sections_basic',
      name: 'Header + Sections Basic',
      description: 'Basic structure with FANCY headers and SECTION blocks',
      nodeTypes: ['fulltext', 'title', 'worknote'],
      transformationRules: {
        addFancyHeaders: true,
        addSections: true,
        addHeaderImage: true,
      },
      category: 'structure',
      isActive: true,
    },
  ]

  // Filter by node type if specified
  const templates = nodeType
    ? allTemplates.filter((t) => t.nodeTypes.includes(nodeType) && t.isActive)
    : allTemplates.filter((t) => t.isActive)

  return createResponse(JSON.stringify({ templates }))
}

// --- Apply Style Template Handler ---
const handleApplyStyleTemplate = async (request, env) => {
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: XAI API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { nodeContent, templateId, nodeType, options = {}, colorTheme = null } = body

  if (!nodeContent || !templateId || !nodeType) {
    return createErrorResponse(
      'Missing required parameters: nodeContent, templateId, nodeType',
      400,
    )
  }

  console.log('=== Apply Style Template ===')
  console.log('Template ID:', templateId)
  console.log('Node Type:', nodeType)
  console.log('Content length:', nodeContent.length)
  console.log('Options:', JSON.stringify(options))
  console.log('Color Theme:', colorTheme ? colorTheme.name : 'Default')

  // Get the template configuration
  const templates = [
    {
      id: 'fulltext_complete_enhancer',
      aiInstructions: `Transform this content into a rich, well-formatted fulltext node with comprehensive styling:

FORMATTING REQUIREMENTS:
1. Add a FANCY header at the top with styling: [FANCY | font-size: 3em; color: #2c3e50; background: linear-gradient(45deg, #f0f8ff, #e6f3ff); text-align: center; padding: 20px; border-radius: 10px]Your Title Here[END FANCY]

2. Structure content into SECTION blocks with different colors:
   [SECTION | background-color: 'lightyellow'; color: 'black'; padding: 15px; border-radius: 8px]
   Main content here
   [END SECTION]

3. Add relevant QUOTE blocks with citations:
   [QUOTE | Cited='Author Name']
   Relevant quote text
   [END QUOTE]

4. Include WNOTE annotations for important points:
   [WNOTE | Cited='Context/Source']
   Important note or annotation
   [END WNOTE]

5. Add contextual images (these will be replaced with real images):
   - Header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
   - Leftside images: ![Leftside-2|width: 200px; height: 200px; object-fit: 'cover'](LEFTSIDE_IMAGE_PLACEHOLDER)
   - Rightside images: ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)

Make the content comprehensive, well-structured, and visually appealing. Preserve the original meaning while enhancing presentation.`,
    },
    {
      id: 'visual_content_formatter',
      aiInstructions: `Transform this content focusing on visual layout with images and work notes:

VISUAL FORMATTING REQUIREMENTS:
1. Add a contextual header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
2. Structure content with strategic leftside and rightside image placement:
   ![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'](LEFTSIDE_IMAGE_PLACEHOLDER)
   ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)
3. Include WNOTE blocks for important annotations
4. Use SECTION blocks to organize content
5. Balance text and visual elements for optimal readability

Focus on creating a visually engaging layout that enhances comprehension.`,
    },
    {
      id: 'work_note_enhancer',
      aiInstructions: `Transform this content with focus on technical work notes and rightside documentation:

WORK NOTE FORMATTING:
1. Add WNOTE blocks for technical annotations and development notes
2. Include rightside images for diagrams, screenshots, or reference materials:
   ![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'](RIGHTSIDE_IMAGE_PLACEHOLDER)
3. Structure content in clear sections
4. Maintain technical accuracy while improving presentation

Perfect for technical documentation and development notes.`,
    },
    {
      id: 'header_sections_basic',
      aiInstructions: `Transform this content with basic structural improvements:

BASIC FORMATTING:
1. Add a FANCY header with attractive styling
2. Organize content into logical SECTION blocks
3. Include a relevant header image: ![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](HEADER_IMAGE_PLACEHOLDER)
4. Maintain clean, professional presentation

Focus on clear structure and readability.`,
    },
  ]

  const template = templates.find((t) => t.id === templateId)
  if (!template) {
    return createErrorResponse('Template not found', 404)
  }

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    // Build color theme instructions
    let colorInstructions = ''
    if (colorTheme) {
      colorInstructions = `
COLOR THEME: "${colorTheme.name}"
Use these specific colors for formatting:
- Primary Color: ${colorTheme.primary}
- Secondary Color: ${colorTheme.secondary}
- Accent Color: ${colorTheme.accent}
- Background Color: ${colorTheme.background}
- Section Colors: ${colorTheme.sections.join(', ')}

Apply these colors to:
- FANCY headers: Use primary color and appropriate background
- SECTION blocks: Use the section colors (${colorTheme.sections.join(', ')}) rotating between them
- Overall theme: Create a harmonious color scheme using these colors
`
    }

    const prompt = `${template.aiInstructions}

${colorInstructions}

ORIGINAL CONTENT TO TRANSFORM:
${nodeContent}

ADDITIONAL OPTIONS: ${JSON.stringify(options)}

Return the transformed content with all the requested formatting applied. Use the placeholder URLs exactly as specified (HEADER_IMAGE_PLACEHOLDER, LEFTSIDE_IMAGE_PLACEHOLDER, RIGHTSIDE_IMAGE_PLACEHOLDER) - these will be replaced with real contextual images. Apply the color theme consistently throughout all formatting elements. Preserve the core meaning while enhancing the presentation with the specified markdown formatting patterns.`

    console.log('Sending prompt to Grok:', prompt)

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert content formatter specializing in rich markdown formatting for knowledge graphs. Apply the requested formatting patterns precisely while preserving content meaning and enhancing readability.',
        },
        { role: 'user', content: prompt },
      ],
    })

    let formattedContent = completion.choices[0].message.content.trim()

    // Now replace placeholder images with real Pexels images
    if (env.PEXELS_API_KEY) {
      console.log('=== Replacing Placeholder Images with Pexels Images ===')
      formattedContent = await replacePlaceholderImages(formattedContent, nodeContent, env)
    } else {
      console.log('Pexels API key not available, using placeholder URLs')
      // Replace placeholders with vegvisr.imgix.net URLs
      formattedContent = formattedContent
        .replace(/HEADER_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/contextual-header.png')
        .replace(/LEFTSIDE_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/leftside-image.png')
        .replace(/RIGHTSIDE_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/rightside-image.png')
    }

    console.log('=== Template Applied Successfully ===')
    console.log('Formatted content length:', formattedContent.length)

    return createResponse(
      JSON.stringify({
        formattedContent,
        templateUsed: templateId,
        success: true,
      }),
    )
  } catch (error) {
    console.error('Error applying style template:', error)
    return createErrorResponse('Failed to apply style template: ' + error.message, 500)
  }
}

// --- Pexels Image Search and Replacement ---
const searchPexelsImages = async (query, env, count = 1) => {
  if (!env.PEXELS_API_KEY) {
    throw new Error('Pexels API key not configured')
  }

  try {
    console.log(`Searching Pexels for: "${query}" (${count} images)`)

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          Authorization: env.PEXELS_API_KEY,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.photos && data.photos.length > 0) {
      return data.photos.map((photo) => ({
        url: photo.src.medium, // Use medium size for performance
        alt: photo.alt || query,
        photographer: photo.photographer,
        id: photo.id,
      }))
    } else {
      console.log('No Pexels images found for query:', query)
      return []
    }
  } catch (error) {
    console.error('Error searching Pexels:', error)
    return []
  }
}

const generateImageSearchQueries = async (content, env) => {
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return ['nature', 'abstract', 'business'] // Fallback queries
  }

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    const prompt = `Analyze this content and generate 3-5 relevant image search keywords that would make good contextual images. Focus on the main themes, concepts, and visual elements that would enhance understanding.

Content: ${content.substring(0, 500)}...

Return only the keywords, separated by commas. Examples: "nature, forest, trees" or "technology, computers, digital" or "business, meeting, office"`

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at analyzing content and suggesting relevant image search terms. Return only comma-separated keywords, no explanations.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const keywords = completion.choices[0].message.content.trim()
    const queries = keywords
      .split(',')
      .map((q) => q.trim())
      .filter((q) => q.length > 0)

    console.log('Generated image search queries:', queries)
    return queries.length > 0 ? queries : ['abstract', 'concept', 'modern']
  } catch (error) {
    console.error('Error generating image queries:', error)
    return ['nature', 'abstract', 'business'] // Fallback queries
  }
}

const replacePlaceholderImages = async (content, originalContent, env) => {
  try {
    // Generate contextual search queries based on content
    const searchQueries = await generateImageSearchQueries(originalContent, env)

    let updatedContent = content

    // Replace header images
    if (content.includes('HEADER_IMAGE_PLACEHOLDER')) {
      console.log('Replacing header image placeholder...')
      const headerImages = await searchPexelsImages(searchQueries[0] || 'abstract header', env, 1)
      if (headerImages.length > 0) {
        updatedContent = updatedContent.replace(/HEADER_IMAGE_PLACEHOLDER/g, headerImages[0].url)
        console.log('Header image replaced with:', headerImages[0].url)
      } else {
        updatedContent = updatedContent.replace(
          /HEADER_IMAGE_PLACEHOLDER/g,
          'https://vegvisr.imgix.net/contextual-header.png',
        )
      }
    }

    // Replace leftside images
    if (content.includes('LEFTSIDE_IMAGE_PLACEHOLDER')) {
      console.log('Replacing leftside image placeholder...')
      const leftsideImages = await searchPexelsImages(
        searchQueries[1] || searchQueries[0] || 'concept',
        env,
        1,
      )
      if (leftsideImages.length > 0) {
        updatedContent = updatedContent.replace(
          /LEFTSIDE_IMAGE_PLACEHOLDER/g,
          leftsideImages[0].url,
        )
        console.log('Leftside image replaced with:', leftsideImages[0].url)
      } else {
        updatedContent = updatedContent.replace(
          /LEFTSIDE_IMAGE_PLACEHOLDER/g,
          'https://vegvisr.imgix.net/leftside-image.png',
        )
      }
    }

    // Replace rightside images
    if (content.includes('RIGHTSIDE_IMAGE_PLACEHOLDER')) {
      console.log('Replacing rightside image placeholder...')
      const rightsideImages = await searchPexelsImages(
        searchQueries[2] || searchQueries[0] || 'modern',
        env,
        1,
      )
      if (rightsideImages.length > 0) {
        updatedContent = updatedContent.replace(
          /RIGHTSIDE_IMAGE_PLACEHOLDER/g,
          rightsideImages[0].url,
        )
        console.log('Rightside image replaced with:', rightsideImages[0].url)
      } else {
        updatedContent = updatedContent.replace(
          /RIGHTSIDE_IMAGE_PLACEHOLDER/g,
          'https://vegvisr.imgix.net/rightside-image.png',
        )
      }
    }

    return updatedContent
  } catch (error) {
    console.error('Error replacing placeholder images:', error)
    // Fallback to vegvisr.imgix.net URLs
    return content
      .replace(/HEADER_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/contextual-header.png')
      .replace(/LEFTSIDE_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/leftside-image.png')
      .replace(/RIGHTSIDE_IMAGE_PLACEHOLDER/g, 'https://vegvisr.imgix.net/rightside-image.png')
  }
}

// --- Pexels Image Search Endpoint ---
const handlePexelsImageSearch = async (request, env) => {
  if (!env.PEXELS_API_KEY) {
    return createErrorResponse('Pexels API key not configured', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { query, count = 10 } = body

  if (!query || typeof query !== 'string') {
    return createErrorResponse('Query parameter is required and must be a string', 400)
  }

  try {
    const images = await searchPexelsImages(query, env, Math.min(count, 20))

    return createResponse(
      JSON.stringify({
        query,
        total: images.length,
        images,
        success: true,
      }),
    )
  } catch (error) {
    console.error('Error in Pexels search endpoint:', error)
    return createErrorResponse('Failed to search Pexels images: ' + error.message, 500)
  }
}

// --- Google Photos OAuth Handlers ---
const handleGoogleOAuthCallback = async () => {
  console.log('🔐 handleGoogleOAuthCallback called')

  const callbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Google Photos Authorization</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 20px;
        box-sizing: border-box;
      }
      .container {
        text-align: center;
        background: rgba(255, 255, 255, 0.1);
        padding: 30px;
        border-radius: 16px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        width: 100%;
      }
      .icon {
        font-size: 48px;
        margin-bottom: 20px;
        animation: spin 2s linear infinite;
      }
      .status {
        font-size: 18px;
        margin-bottom: 15px;
        font-weight: 500;
      }
      .message {
        font-size: 14px;
        opacity: 0.8;
        line-height: 1.4;
      }
      .error {
        color: #ff6b6b;
      }
      .success {
        color: #51cf66;
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
      @keyframes fadeIn {
        0% {
          opacity: 0;
          transform: translateY(20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .container {
        animation: fadeIn 0.5s ease-out;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon" id="statusIcon">🔄</div>
      <div class="status" id="statusText">Processing authorization...</div>
      <div class="message" id="statusMessage">
        Please wait while we complete the authentication.
      </div>
    </div>

    <script>
      console.log('🔐 Google Photos OAuth Callback Page Loaded')

      function updateStatus(icon, text, message, className = '') {
        document.getElementById('statusIcon').textContent = icon
        document.getElementById('statusText').textContent = text
        document.getElementById('statusMessage').textContent = message

        if (className) {
          document.getElementById('statusText').className = \`status \${className}\`
          document.getElementById('statusMessage').className = \`message \${className}\`
        }
      }

      function handleAuthCallback() {
        try {
          // Parse URL parameters
          const urlParams = new URLSearchParams(window.location.search)
          const code = urlParams.get('code')
          const error = urlParams.get('error')
          const errorDescription = urlParams.get('error_description')

          console.log('📋 URL Parameters:', { code: !!code, error, errorDescription })

          if (error) {
            console.error('❌ OAuth Error:', error, errorDescription)

            updateStatus(
              '❌',
              'Authorization Failed',
              errorDescription || error || 'An error occurred during authorization.',
              'error',
            )

            // For redirect-based OAuth, redirect back to the Vue frontend with error
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            const frontendUrl = isLocal
              ? \`http://\${window.location.hostname}:5173/?google_auth_error=\${encodeURIComponent(errorDescription || error || 'Authorization failed')}\`
              : \`https://www.vegvisr.org/?google_auth_error=\${encodeURIComponent(errorDescription || error || 'Authorization failed')}\`

            // Redirect back to the frontend
            window.location.href = frontendUrl
            return
          }

          if (code) {
            console.log('✅ Authorization code received')

            updateStatus(
              '✅',
              'Authorization Successful!',
              'Connecting to your Google Photos... This window will close automatically.',
              'success',
            )

                        // For redirect-based OAuth, redirect back to the Vue frontend with the code
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            const frontendUrl = isLocal
              ? \`http://\${window.location.hostname}:5173/?google_auth_code=\${code}&google_auth_success=true\`
              : \`https://www.vegvisr.org/?google_auth_code=\${code}&google_auth_success=true\`

            // Redirect back to the frontend
            window.location.href = frontendUrl
          } else {
            console.error('❌ No authorization code found in URL')

            updateStatus(
              '❌',
              'No Authorization Code',
              'The authorization process was incomplete. Please try again.',
              'error',
            )

            if (window.opener) {
              window.opener.postMessage(
                {
                  type: 'GOOGLE_AUTH_ERROR',
                  error: 'No authorization code received',
                },
                window.location.origin,
              )
            }

            setTimeout(() => {
              window.close()
            }, 3000)
          }
        } catch (err) {
          console.error('❌ Callback processing error:', err)

          updateStatus(
            '❌',
            'Processing Error',
            'An error occurred while processing the authorization. Please try again.',
            'error',
          )

          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'GOOGLE_AUTH_ERROR',
                error: 'Callback processing error: ' + err.message,
              },
              window.location.origin,
            )
          }

          setTimeout(() => {
            window.close()
          }, 3000)
        }
      }

      // Handle the auth callback when page loads
      document.addEventListener('DOMContentLoaded', handleAuthCallback)

      // Also handle immediately in case DOMContentLoaded already fired
      if (document.readyState === 'loading') {
        // Still loading, wait for DOMContentLoaded
      } else {
        // Already loaded
        handleAuthCallback()
      }

      console.log('🚀 Callback page initialized')
    </script>
  </body>
</html>`

  console.log('✅ Returning OAuth callback HTML, length:', callbackHtml.length)

  return new Response(callbackHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      ...corsHeaders,
    },
  })
}

const handleGooglePhotosAuth = async (request, env) => {
  try {
    const { code } = await request.json()

    if (!code) {
      return createErrorResponse('Authorization code is required', 400)
    }

    console.log('🔐 Exchanging code for Google Photos access token...')

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GOOGLE_PHOTOS_CLIENT_ID,
        client_secret: env.GOOGLE_PHOTOS_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri:
          request.url.includes('localhost') || request.url.includes('127.0.0.1')
            ? request.url.includes('localhost')
              ? 'http://localhost:8789/auth/google/callback.html'
              : 'http://127.0.0.1:8789/auth/google/callback.html'
            : 'https://api.vegvisr.org/auth/google/callback.html',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenData)
      return createErrorResponse(
        tokenData.error_description || 'Failed to exchange authorization code',
        400,
      )
    }

    if (tokenData.access_token) {
      console.log('✅ Google Photos authentication successful')

      return createResponse(
        JSON.stringify({
          success: true,
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
        }),
      )
    } else {
      return createErrorResponse('No access token received', 400)
    }
  } catch (error) {
    console.error('❌ Google Photos auth error:', error)
    return createErrorResponse(error.message, 500)
  }
}

const handleGooglePhotosSearch = async (request) => {
  try {
    const { access_token, searchParams } = await request.json()

    if (!access_token) {
      return createErrorResponse('Access token is required', 401)
    }

    console.log('🔍 Searching Google Photos...')

    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageSize: 20,
        filters: {
          mediaTypeFilter: {
            mediaTypes: ['PHOTO'],
          },
          // Add content filter if search term is provided
          ...(searchParams?.contentCategories && {
            contentFilter: {
              includedContentCategories: searchParams.contentCategories,
            },
          }),
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Google Photos search failed:', data)
      return createErrorResponse(data.error?.message || 'Failed to search Google Photos', 400)
    }

    console.log(`✅ Found ${data.mediaItems?.length || 0} photos`)

    return createResponse(
      JSON.stringify({
        success: true,
        mediaItems: data.mediaItems || [],
        nextPageToken: data.nextPageToken,
      }),
    )
  } catch (error) {
    console.error('❌ Google Photos search error:', error)
    return createErrorResponse(error.message, 500)
  }
}

const handleGooglePhotosRecent = async (request) => {
  try {
    const { access_token } = await request.json()

    if (!access_token) {
      return createErrorResponse('Access token is required', 401)
    }

    console.log('📷 Getting recent Google Photos...')

    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Failed to get recent photos:', data)
      return createErrorResponse(data.error?.message || 'Failed to get recent photos', 400)
    }

    console.log(`✅ Retrieved ${data.mediaItems?.length || 0} recent photos`)

    return createResponse(
      JSON.stringify({
        success: true,
        mediaItems: data.mediaItems || [],
        nextPageToken: data.nextPageToken,
      }),
    )
  } catch (error) {
    console.error('❌ Recent photos error:', error)
    return createErrorResponse(error.message, 500)
  }
}

// === Custom Domain Registration Endpoint ===
async function handleCreateCustomDomain(request, env) {
  console.log('🔧 === Custom Domain Registration Request Started ===')
  console.log('Request method:', request.method)
  console.log('Request URL:', request.url)

  if (request.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request')
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (request.method === 'POST') {
    try {
      console.log('📥 Processing POST request for custom domain creation')

      const requestBody = await request.json()
      console.log('📋 Request body received:', JSON.stringify(requestBody, null, 2))

      const { subdomain, rootDomain, zoneId } = requestBody

      // Determine the domain to work with
      let targetDomain
      let targetZoneId

      console.log('🔍 Input validation:')
      console.log('  - subdomain:', subdomain)
      console.log('  - rootDomain:', rootDomain)
      console.log('  - zoneId:', zoneId)

      if (!subdomain) {
        console.log('❌ Subdomain validation failed - subdomain is required')
        return new Response(
          JSON.stringify({
            error: 'Subdomain is required (e.g., "torarne" for torarne.xyzvibe.com)',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        )
      }

      // Determine root domain - default to norsegong.com for backward compatibility
      const targetRootDomain = rootDomain || 'norsegong.com'
      console.log('🎯 Target root domain determined:', targetRootDomain)

      // SECURITY: Check if subdomain is protected
      if (isProtectedSubdomain(subdomain, targetRootDomain)) {
        console.log(
          `🚨 SECURITY BLOCK: Attempted to create protected subdomain: ${subdomain}.${targetRootDomain}`,
        )
        return new Response(
          JSON.stringify({
            error: `Subdomain '${subdomain}' is protected and cannot be created. Protected subdomains: ${PROTECTED_SUBDOMAINS[targetRootDomain]?.join(', ') || 'none'}`,
            protectedSubdomain: true,
            availableProtectedList: PROTECTED_SUBDOMAINS[targetRootDomain] || [],
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        )
      }

      // Build the full domain
      targetDomain = `${subdomain}.${targetRootDomain}`
      console.log('🌐 Full target domain:', targetDomain)

      // Get Zone ID for the root domain
      targetZoneId = zoneId || DOMAIN_ZONE_MAPPING[targetRootDomain]
      console.log('🔑 Zone ID lookup:')
      console.log('  - Available zone mappings:', JSON.stringify(DOMAIN_ZONE_MAPPING, null, 2))
      console.log('  - Resolved zone ID:', targetZoneId)

      if (!targetZoneId) {
        console.log('❌ Zone ID validation failed - no zone ID found for domain')
        return new Response(
          JSON.stringify({
            error: `No Zone ID found for domain: ${targetDomain}. Supported domains: ${Object.keys(DOMAIN_ZONE_MAPPING).join(', ')}`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        )
      }

      console.log(`✅ Setting up custom domain: ${targetDomain} with Zone ID: ${targetZoneId}`)

      // Check if CF_API_TOKEN is available
      if (!env.CF_API_TOKEN) {
        console.log('❌ CF_API_TOKEN environment variable is missing')
        return new Response(
          JSON.stringify({
            error: 'CF_API_TOKEN environment variable is not configured',
            overallSuccess: false,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          },
        )
      }
      console.log('✅ CF_API_TOKEN is available')

      // Create DNS record
      console.log('🔧 Creating DNS record...')
      const dnsPayload = {
        type: 'CNAME',
        name: targetDomain,
        content: 'brand-worker.torarnehave.workers.dev',
        proxied: true,
      }
      console.log('📤 DNS payload:', JSON.stringify(dnsPayload, null, 2))

      const dnsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dnsPayload),
        },
      )

      console.log('📥 DNS response status:', dnsResponse.status, dnsResponse.statusText)
      const dnsResult = await dnsResponse.json()
      console.log('📋 DNS response body:', JSON.stringify(dnsResult, null, 2))

      const dnsSetup = {
        success: dnsResult.success,
        errors: dnsResult.errors,
        result: dnsResult.result,
      }

      // Create worker route
      console.log('🔧 Creating worker route...')
      const workerPayload = {
        pattern: `${targetDomain}/*`,
        script: 'brand-worker',
      }
      console.log('📤 Worker route payload:', JSON.stringify(workerPayload, null, 2))

      const workerResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(workerPayload),
        },
      )

      console.log(
        '📥 Worker route response status:',
        workerResponse.status,
        workerResponse.statusText,
      )
      const workerResult = await workerResponse.json()
      console.log('📋 Worker route response body:', JSON.stringify(workerResult, null, 2))

      const workerSetup = {
        success: workerResult.success,
        errors: workerResult.errors,
        result: workerResult.result,
      }

      const overallSuccess = dnsSetup.success && workerSetup.success
      console.log('🎯 Overall success:', overallSuccess)
      console.log('  - DNS setup success:', dnsSetup.success)
      console.log('  - Worker setup success:', workerSetup.success)

      const responseData = {
        overallSuccess,
        domain: targetDomain,
        zoneId: targetZoneId,
        dnsSetup,
        workerSetup,
        debug: {
          requestBody,
          targetRootDomain,
          availableDomains: Object.keys(DOMAIN_ZONE_MAPPING),
        },
      }

      console.log('📤 Final response:', JSON.stringify(responseData, null, 2))

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch (error) {
      console.log('❌ Error in handleCreateCustomDomain:', error)
      console.log('❌ Error stack:', error.stack)

      return new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          overallSuccess: false,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }
  }

  // Method not allowed
  console.log('❌ Method not allowed:', request.method)
  return new Response('Method Not Allowed', { status: 405 })
}

// === Custom Domain Deletion Endpoint ===
async function handleDeleteCustomDomain(request, env) {
  console.log('🗑️ handleDeleteCustomDomain called')

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const requestBody = await request.json()
    console.log('📥 Delete request body:', JSON.stringify(requestBody, null, 2))

    const { subdomain, rootDomain } = requestBody

    if (!subdomain || !rootDomain) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: subdomain and rootDomain',
          overallSuccess: false,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    const targetDomain = `${subdomain}.${rootDomain}`
    console.log('🎯 Target domain to delete:', targetDomain)

    // SECURITY: Check if subdomain is protected (prevent deletion of critical infrastructure)
    if (isProtectedSubdomain(subdomain, rootDomain)) {
      console.log(
        `🚨 SECURITY BLOCK: Attempted to delete protected subdomain: ${subdomain}.${rootDomain}`,
      )
      return new Response(
        JSON.stringify({
          error: `Subdomain '${subdomain}' is protected and cannot be deleted. Protected subdomains: ${PROTECTED_SUBDOMAINS[rootDomain]?.join(', ') || 'none'}`,
          protectedSubdomain: true,
          overallSuccess: false,
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    // Get the zone ID for the root domain
    const targetZoneId = getZoneIdForDomain(rootDomain)
    if (!targetZoneId) {
      return new Response(
        JSON.stringify({
          error: `Unsupported root domain: ${rootDomain}. Supported domains: ${Object.keys(DOMAIN_ZONE_MAPPING).join(', ')}`,
          overallSuccess: false,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }

    console.log('🏷️ Using zone ID:', targetZoneId)

    // Step 1: Find and delete DNS record
    console.log('🔍 Finding DNS record for:', targetDomain)

    const dnsListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?name=${targetDomain}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const dnsListResult = await dnsListResponse.json()
    console.log('📋 DNS list response:', JSON.stringify(dnsListResult, null, 2))

    let dnsSetup = { success: true, errors: [], deleted: false }

    if (dnsListResult.result && dnsListResult.result.length > 0) {
      const dnsRecord = dnsListResult.result[0] // Get the first matching record
      console.log('🎯 Found DNS record to delete:', dnsRecord.id)

      const dnsDeleteResponse = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${dnsRecord.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const dnsDeleteResult = await dnsDeleteResponse.json()
      console.log('🗑️ DNS delete response:', JSON.stringify(dnsDeleteResult, null, 2))

      dnsSetup = {
        success: dnsDeleteResult.success,
        errors: dnsDeleteResult.errors || [],
        deleted: dnsDeleteResult.success,
        recordId: dnsRecord.id,
      }
    } else {
      console.log('ℹ️ No DNS record found for domain:', targetDomain)
      dnsSetup.deleted = false
      dnsSetup.message = 'No DNS record found'
    }

    // Step 2: Find and delete worker route
    console.log('🔍 Finding worker route for:', `${targetDomain}/*`)

    const routesListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const routesListResult = await routesListResponse.json()
    console.log('📋 Routes list response:', JSON.stringify(routesListResult, null, 2))

    let workerSetup = { success: true, errors: [], deleted: false }

    if (routesListResult.result && routesListResult.result.length > 0) {
      // Find the route that matches our domain pattern
      const targetRoute = routesListResult.result.find(
        (route) => route.pattern === `${targetDomain}/*`,
      )

      if (targetRoute) {
        console.log('🎯 Found worker route to delete:', targetRoute.id)

        const routeDeleteResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/workers/routes/${targetRoute.id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        )

        const routeDeleteResult = await routeDeleteResponse.json()
        console.log('🗑️ Route delete response:', JSON.stringify(routeDeleteResult, null, 2))

        workerSetup = {
          success: routeDeleteResult.success,
          errors: routeDeleteResult.errors || [],
          deleted: routeDeleteResult.success,
          routeId: targetRoute.id,
        }
      } else {
        console.log('ℹ️ No worker route found for pattern:', `${targetDomain}/*`)
        workerSetup.deleted = false
        workerSetup.message = 'No worker route found'
      }
    } else {
      console.log('ℹ️ No worker routes found in zone')
      workerSetup.deleted = false
      workerSetup.message = 'No worker routes found'
    }

    // Step 3: Delete KV store entry
    console.log('🗑️ Deleting KV store entry for:', `site-config:${targetDomain}`)

    let kvSetup = { success: true, errors: [], deleted: false }

    try {
      if (!env.SITE_CONFIGS) {
        throw new Error('SITE_CONFIGS KV namespace not available')
      }

      await env.SITE_CONFIGS.delete(`site-config:${targetDomain}`)
      kvSetup.deleted = true
      kvSetup.message = 'KV entry deleted successfully'
      console.log('✅ KV entry deleted successfully')
    } catch (kvError) {
      console.error('❌ Error deleting KV entry:', kvError)
      kvSetup.success = false
      kvSetup.errors.push({ message: kvError.message })
      kvSetup.message = 'Failed to delete KV entry'
    }

    const overallSuccess = dnsSetup.success && workerSetup.success && kvSetup.success
    console.log('🎯 Overall deletion success:', overallSuccess)
    console.log('  - DNS deletion success:', dnsSetup.success)
    console.log('  - Worker deletion success:', workerSetup.success)
    console.log('  - KV deletion success:', kvSetup.success)

    const responseData = {
      overallSuccess,
      domain: targetDomain,
      zoneId: targetZoneId,
      dnsSetup,
      workerSetup,
      kvSetup,
      debug: {
        requestBody,
        targetRootDomain: rootDomain,
        availableDomains: Object.keys(DOMAIN_ZONE_MAPPING),
      },
    }

    console.log('📤 Final deletion response:', JSON.stringify(responseData, null, 2))

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.log('❌ Error in handleDeleteCustomDomain:', error)
    console.log('❌ Error stack:', error.stack)

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        overallSuccess: false,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  }
}

// RAG Manager Proxy Handler
const handleRAGProxyRequest = async (request, endpoint, env) => {
  try {
    const ragManagerUrl = `https://rag-manager-worker.torarnehave.workers.dev${endpoint}`

    console.log(`[API Worker] Proxying to RAG Manager: ${ragManagerUrl}`)

    const response = await fetch(ragManagerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })

    return response
  } catch (error) {
    console.error('[API Worker] RAG proxy error:', error)
    return createErrorResponse(`RAG proxy failed: ${error.message}`, 500)
  }
}

// Deploy Sandbox Handler
const handleDeploySandbox = async (request, env) => {
  try {
    const { userToken, code } = await request.json()
    if (!userToken || !code) {
      return createErrorResponse('Missing userToken or code', 400)
    }

    // Create worker name from user token (sanitized and limited to 54 chars)
    const sanitizedToken = userToken.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const workerName = `sandbox-${sanitizedToken}`.substring(0, 54)

    const accountId = env.CF_ACCOUNT_ID
    const apiToken = env.CF_API_TOKEN_SANDBOX
    const workersSubdomain = env.CF_WORKERS_SUBDOMAIN

    // Deploy/update the user's persistent sandbox worker
    console.log(`Deploying persistent sandbox for user: ${workerName}`)
    console.log('Worker code preview:', code.substring(0, 200) + '...')

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/javascript',
        },
        body: code,
      },
    )

    const deployJson = await deployRes.json()
    if (!deployJson.success) {
      return createErrorResponse('Cloudflare API error: ' + JSON.stringify(deployJson.errors), 500)
    }

    const endpoint = `https://${workerName}.${workersSubdomain}.workers.dev`

    // Save sandbox metadata to KV for user management
    const sandboxMetadata = {
      userToken,
      workerName,
      endpoint,
      lastUpdated: new Date().toISOString(),
      codePreview: code.substring(0, 500), // Store preview for debugging
    }

    await env.BINDING_NAME.put(`sandbox:${userToken}`, JSON.stringify(sandboxMetadata))

    return createResponse(
      JSON.stringify({
        success: true,
        endpoint,
        workerName,
        message: 'Persistent sandbox updated successfully',
      }),
      200,
    )
  } catch (e) {
    return createErrorResponse('Deploy error: ' + e.message, 500)
  }
}

// Create Persistent Sandbox Domain Handler
const handleCreateSandboxDomain = async (request, env) => {
  try {
    const { userToken } = await request.json()
    if (!userToken) {
      return createErrorResponse('Missing userToken', 400)
    }

    // Get sandbox metadata from KV
    const sandboxData = await env.BINDING_NAME.get(`sandbox:${userToken}`)
    if (!sandboxData) {
      return createErrorResponse('Sandbox not found. Please deploy your sandbox first.', 404)
    }

    const sandbox = JSON.parse(sandboxData)
    const workerName = sandbox.workerName

    // Create a custom domain based on the worker name
    const customSubdomain = workerName.replace('sandbox-', '') // Remove 'sandbox-' prefix
    const domain = `${customSubdomain}.xyzvibe.com`
    const zoneId = '602067f0cf860426a35860a8ab179a47' // xyzvibe.com zone ID
    const accountId = env.CF_ACCOUNT_ID
    const apiToken = env.CF_API_TOKEN // Use main token for domain operations
    const workersSubdomain = env.CF_WORKERS_SUBDOMAIN

    // 1. Create DNS record
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'CNAME',
        name: domain,
        content: `${workerName}.${workersSubdomain}.workers.dev`,
        proxied: true,
      }),
    })
    const dnsJson = await dnsRes.json()
    if (!dnsJson.success) {
      return createErrorResponse('DNS error: ' + JSON.stringify(dnsJson.errors), 500)
    }

    // 2. Register the custom domain with the worker
    const domainRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hostname: domain,
          service: workerName,
        }),
      },
    )
    const domainJson = await domainRes.json()
    if (!domainJson.success) {
      return createErrorResponse('Domain error: ' + JSON.stringify(domainJson.errors), 500)
    }

    // Update sandbox metadata with custom domain
    sandbox.customDomain = `https://${domain}`
    sandbox.domainCreated = new Date().toISOString()
    await env.BINDING_NAME.put(`sandbox:${userToken}`, JSON.stringify(sandbox))

    return createResponse(
      JSON.stringify({
        success: true,
        url: `https://${domain}`,
        workerUrl: sandbox.endpoint,
        message: 'Custom domain created for persistent sandbox',
      }),
      200,
    )
  } catch (e) {
    return createErrorResponse('Domain creation error: ' + e.message, 500)
  }
}

// Get Sandbox Info Handler
const handleGetSandboxInfo = async (request, env) => {
  try {
    const url = new URL(request.url)
    const userToken = url.searchParams.get('userToken')

    if (!userToken) {
      return createErrorResponse('Missing userToken parameter', 400)
    }

    const sandboxData = await env.BINDING_NAME.get(`sandbox:${userToken}`)
    if (!sandboxData) {
      return createResponse(
        JSON.stringify({
          exists: false,
          message: 'No sandbox found for this user token',
        }),
        200,
      )
    }

    const sandbox = JSON.parse(sandboxData)
    return createResponse(
      JSON.stringify({
        exists: true,
        sandbox: {
          workerName: sandbox.workerName,
          endpoint: sandbox.endpoint,
          customDomain: sandbox.customDomain || null,
          lastUpdated: sandbox.lastUpdated,
          domainCreated: sandbox.domainCreated || null,
        },
      }),
      200,
    )
  } catch (e) {
    return createErrorResponse('Error retrieving sandbox info: ' + e.message, 500)
  }
}

// Removed handleCreateSandboxBrandDomain - using direct API calls instead

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Log all incoming requests for debugging
    console.log('🔍 API Worker Request:', {
      method: request.method,
      pathname: pathname,
      fullUrl: request.url,
      origin: request.headers.get('Origin'),
      userAgent: request.headers.get('User-Agent'),
      timestamp: new Date().toISOString(),
    })

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (pathname === '/createknowledgegraph' && request.method === 'GET') {
      return await handleCreateKnowledgeGraph(request, env)
    }
    if (pathname === '/save' && request.method === 'POST') {
      return await handleSave(request, env)
    }
    if (pathname.startsWith('/view/') && request.method === 'GET') {
      return await handleView(request, env)
    }
    if (pathname === '/blog-posts' && request.method === 'GET') {
      return await handleBlogPosts(request, env)
    }
    if (pathname === '/hidden-blog-posts' && request.method === 'GET') {
      return await handleBlogPosts(request, env, true)
    }
    if (pathname.startsWith('/blogpostdelete/') && request.method === 'DELETE') {
      return await handleBlogPostDelete(request, env)
    }
    if (pathname === '/snippetadd' && request.method === 'POST') {
      return await handleSnippetAdd(request, env)
    }
    if (pathname.startsWith('/snippets/') && request.method === 'GET') {
      return await handleSnippetGet(request, env)
    }
    if (pathname === '/snippetlist' && request.method === 'GET') {
      return await handleSnippetList(request, env)
    }
    if (pathname.startsWith('/snippetdelete') && request.method === 'DELETE') {
      return await handleSnippetDelete(request, env)
    }
    if (pathname === '/upload' && request.method === 'POST') {
      return await handleUpload(request, env)
    }
    if (pathname === '/search' && request.method === 'GET') {
      return await handleSearch(request, env)
    }
    if (pathname === '/hid_vis' && request.method === 'POST') {
      return await handleToggleVisibility(request, env)
    }
    if (pathname === '/getimage' && request.method === 'GET') {
      return await handleGetImage(request, env)
    }
    if (pathname === '/getcorsimage' && request.method === 'GET') {
      return await handleGetImageFromR2(request, env)
    }
    if (pathname === '/getcorsimage' && request.method === 'HEAD') {
      return await handleGetImageHeaders(request, env)
    }
    if (pathname === '/summarize' && request.method === 'POST') {
      return await handleSummarize(request, env)
    }
    if (pathname === '/groktest' && request.method === 'POST') {
      return await handleGrokTest(request, env)
    }
    if (pathname === '/gemini-test' && request.method === 'POST') {
      return await handleGeminiTest(request, env)
    }
    if (pathname === '/aiaction' && request.method === 'POST') {
      return await handleAIAction(request, env)
    }
    if (pathname === '/getGoogleApiKey' && request.method === 'GET') {
      return await handleGetGoogleApiKey(request, env)
    }
    if (pathname === '/updatekml' && request.method === 'POST') {
      return await handleUpdateKml(request, env)
    }
    if (pathname === '/suggest-title' && request.method === 'POST') {
      return await handleSuggestTitle(request, env)
    }
    if (pathname === '/suggest-description' && request.method === 'POST') {
      return await handleSuggestDescription(request, env)
    }
    if (pathname === '/suggest-categories' && request.method === 'POST') {
      return await handleSuggestCategories(request, env)
    }
    if (pathname === '/grok-issue-description' && request.method === 'POST') {
      return await handleGrokIssueDescription(request, env)
    }
    if (pathname === '/generate-meta-areas' && request.method === 'POST') {
      return await handleGenerateMetaAreas(request, env)
    }
    if (pathname === '/grok-ask' && request.method === 'POST') {
      return await handleGrokAsk(request, env)
    }
    if (pathname === '/generate-header-image' && request.method === 'POST') {
      return await handleGenerateHeaderImage(request, env)
    }
    if (pathname === '/generate-image-prompt' && request.method === 'POST') {
      return await handleGenerateImagePrompt(request, env)
    }
    if (pathname === '/list-r2-images' && request.method === 'GET') {
      return await handleListR2Images(request, env)
    }

    if (pathname === '/youtube-search' && request.method === 'GET') {
      return await handleYouTubeSearch(request, env)
    }

    if (pathname.startsWith('/youtube-transcript-io/') && request.method === 'GET') {
      return await handleYouTubeTranscriptIO(request, env)
    }

    if (pathname.startsWith('/downsub-transcript/') && request.method === 'GET') {
      return await handleDownsubTranscript(request, env)
    }

    if (pathname === '/downsub-url-transcript' && request.method === 'POST') {
      return await handleDownsubUrlTranscript(request, env)
    }

    if (pathname === '/mystmkrasave' && request.method === 'POST') {
      return handleMystmkraProxy(request)
    }

    if (pathname === '/gpt4-vision-image' && request.method === 'POST') {
      return await handleGPT4VisionImage(request, env)
    }

    if (pathname === '/save-approved-image' && request.method === 'POST') {
      return await handleSaveApprovedImage(request, env)
    }

    if (pathname === '/ai-generate-node' && request.method === 'POST') {
      return await handleAIGenerateNode(request, env)
    }

    if (pathname === '/process-transcript' && request.method === 'POST') {
      return await handleProcessTranscript(request, env)
    }

    if (pathname === '/apply-style-template' && request.method === 'POST') {
      return await handleApplyStyleTemplate(request, env)
    }

    if (pathname === '/style-templates' && request.method === 'GET') {
      return await handleGetStyleTemplates(request, env)
    }

    if (pathname === '/pexels-search' && request.method === 'POST') {
      return await handlePexelsImageSearch(request, env)
    }

    if (pathname === '/google-photos-auth' && request.method === 'POST') {
      return await handleGooglePhotosAuth(request, env)
    }

    if (pathname === '/google-photos-search' && request.method === 'POST') {
      return await handleGooglePhotosSearch(request)
    }

    if (pathname === '/google-photos-recent' && request.method === 'POST') {
      return await handleGooglePhotosRecent(request)
    }

    if (pathname === '/auth/google/callback.html' && request.method === 'GET') {
      console.log('✅ OAuth Callback Route Matched!', {
        pathname: pathname,
        method: request.method,
        queryParams: url.searchParams.toString(),
      })
      return await handleGoogleOAuthCallback()
    }

    if (url.pathname === '/create-custom-domain') {
      return await handleCreateCustomDomain(request, env)
    }

    if (url.pathname === '/delete-custom-domain') {
      return await handleDeleteCustomDomain(request, env)
    }

    // RAG Manager Proxy Endpoints
    if (pathname === '/rag/analyze-graph' && request.method === 'POST') {
      return await handleRAGProxyRequest(request, '/analyze-graph', env)
    }
    if (pathname === '/rag/create-index' && request.method === 'POST') {
      return await handleRAGProxyRequest(request, '/create-rag-index', env)
    }
    if (pathname === '/rag/create-sandbox' && request.method === 'POST') {
      return await handleRAGProxyRequest(request, '/create-rag-sandbox', env)
    }
    if (pathname === '/rag/list-sandboxes' && request.method === 'GET') {
      return await handleRAGProxyRequest(request, '/list-sandboxes', env)
    }

    if (pathname === '/deploy-sandbox' && request.method === 'POST') {
      return await handleDeploySandbox(request, env)
    }

    if (pathname === '/create-sandbox-domain' && request.method === 'POST') {
      return await handleCreateSandboxDomain(request, env)
    }

    if (pathname === '/get-sandbox-info' && request.method === 'GET') {
      return await handleGetSandboxInfo(request, env)
    }

    // Fallback - log unmatched routes
    console.log('❌ No route matched, returning 404:', {
      pathname: pathname,
      method: request.method,
      availableRoutes: [
        '/auth/google/callback.html',
        '/google-photos-auth',
        '/google-photos-search',
        '/google-photos-recent',
        '/rag/analyze-graph',
        '/rag/create-index',
        '/rag/create-sandbox',
        '/rag/list-sandboxes',
        '/deploy-sandbox',
        '/create-sandbox-domain',
        '/get-sandbox-info',
        // ... other routes
      ],
    })
    return createErrorResponse('Not Found', 404)
  },
}
