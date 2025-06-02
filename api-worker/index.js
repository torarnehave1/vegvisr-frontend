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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token',
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
  const shareButton = `
    <div style="text-align: center; margin-top: 20px;">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}" target="_blank" class="btn btn-primary">
เว้นวรรคShare on Facebook
      </a>
    </div>
  `
  const finalHtml = `
    <!DOCTYPE html>
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
      const title = titleLine ? titleLine.replace(/^#\s*/, '') : 'Untitled'

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
    'Timing-Allow-Origin': '*',
    'Access-Control-Allow-Origin': '*',
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
    'Timing-Allow-Origin': '*',
    'Access-Control-Allow-Origin': '*',
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

  const prompt = `
    Summarize the following text into a concise paragraph suitable for a fulltext node:
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
  } catch (error) {
    console.error('Grok API error:', error)
    return createErrorResponse('Grok API error', 500)
  }
}

const handleGenerateMetaAreas = async (request, env) => {
  // --- Authorization ---
  const userRole = request.headers.get('x-user-role') || ''
  if (userRole !== 'Superadmin') {
    return createErrorResponse('Forbidden: Superadmin role required', 403)
  }

  // Helper function to make fetch requests
  const makeRequest = async (url, options = {}) => {
    if (env.KNOWLEDGE) {
      return env.KNOWLEDGE.fetch(url, options)
    } else {
      console.log('Service Binding not available, falling back to direct fetch')
      return fetch(url, options)
    }
  }

  // 1. Fetch all knowledge graphs
  console.log('Fetching all knowledge graphs...')
  const response = await makeRequest('https://knowledge.vegvisr.org/getknowgraphs')
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
    const graphResponse = await makeRequest(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
    )
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
    const apiKey = env.XAI_API_KEY
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.x.ai/v1',
    })
    let metaArea = ''
    try {
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
    await makeRequest('https://knowledge.vegvisr.org/updateknowgraph', {
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
  } catch (error) {
    console.error('Grok ask error:', error)
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
  } catch (err) {
    return createErrorResponse('Failed to generate image: ' + err, 500)
  }

  // 2. Download the image
  let imageBuffer
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('Failed to download image')
    imageBuffer = await imgRes.arrayBuffer()
  } catch (err) {
    return createErrorResponse('Failed to download image: ' + err, 500)
  }

  // 3. Upload to R2
  const imageId = Date.now() + '-' + Math.random().toString(36).slice(2, 10)
  const fileName = `${imageId}.png`
  try {
    await env.MY_R2_BUCKET.put(fileName, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
    })
  } catch (err) {
    return createErrorResponse('Failed to upload image to R2: ' + err, 500)
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
  } catch (err) {
    return createErrorResponse('Failed to generate image prompt: ' + err, 500)
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-role, X-API-Token',
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
    // Fallback
    return createErrorResponse('Not Found', 404)
  },
}
