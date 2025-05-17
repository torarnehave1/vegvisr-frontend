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
  'Access-Control-Allow-Headers': 'Content-Type',
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

// Validate analysis results with SlowYou context
const validateAnalysisResults = (results) => {
  if (!results.summary || typeof results.summary !== 'string') {
    return 'Invalid or missing summary'
  }
  if (!Array.isArray(results.insights) || results.insights.length === 0) {
    return 'Insights must be a non-empty array'
  }
  if (!results.reflections || typeof results.reflections !== 'string') {
    return 'Invalid or missing reflections'
  }
  if (!Array.isArray(results.themes) || results.themes.length === 0) {
    return 'Themes must be a non-empty array'
  }
  if (!Array.isArray(results.slowYouApplications) || results.slowYouApplications.length === 0) {
    return 'SlowYou applications must be a non-empty array'
  }
  // Ensure at least one SlowYou principle and exercise are mentioned
  const principles = [
    'Kroppens Visdom',
    'Hjertets Sentralitet',
    'Grunning og Flyt',
    'Balanse og Harmoni',
    'Universalitet og Inklusivitet',
    'Helhetlig Tilnærming',
    'Naturlige Skjelvinger',
    'Divine Feminine',
  ]
  const exercises = [
    'Standing and sensing self',
    'Golf ball foot massage',
    'Basic grounding exercise',
    'Hip movement',
    'Balancing exercises',
    'Bending forward',
    'Face and jaw massage',
    'Twisting arms',
    'Swinging arms',
    'Coordination exercise',
    'Deep breathing',
    'Foam roller breathing',
    'Butterfly legs',
    'Gong playing',
  ]
  const hasPrinciple =
    results.summary.includes('SlowYou') ||
    results.insights.some((i) => principles.some((p) => i.significance.includes(p))) ||
    results.themes.some((t) => principles.some((p) => t.description.includes(p)))
  const hasExercise = results.slowYouApplications.some((app) =>
    exercises.some((ex) => app.includes(ex)),
  )
  if (!hasPrinciple) {
    return 'Analysis must reference at least one SlowYou principle'
  }
  if (!hasExercise) {
    return 'Analysis must recommend at least one SlowYou exercise'
  }
  return null
}

// Validate graph data for Vegvisr/Cytoscape with SlowYou context
const validateGraphData = (data) => {
  if (!data.layout || !['landing', 'blog', 'academic', 'portfolio', null].includes(data.layout)) {
    return 'Invalid or missing layout'
  }
  if (!Array.isArray(data.nodes) || data.nodes.length < 7) {
    return 'Nodes array must contain at least 7 nodes'
  }
  if (!Array.isArray(data.edges) || data.edges.length < 5) {
    return 'Edges array must contain at least 5 edges'
  }

  const nodeIds = new Set()
  for (const node of data.nodes) {
    if (!node.id || typeof node.id !== 'string' || nodeIds.has(node.id)) {
      return `Invalid or duplicate node ID: ${node.id}`
    }
    // Ensure node ID is descriptive and not a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.id)) {
      return `Node ID must be descriptive, not a UUID: ${node.id}`
    }
    nodeIds.add(node.id)
    if (!node.label || typeof node.label !== 'string') {
      return `Invalid label for node ${node.id}`
    }
    if (!node.color || typeof node.color !== 'string') {
      return `Invalid color for node ${node.id}`
    }
    if (!['background', 'fulltext', 'notes', 'quote', 'info', 'REG', null].includes(node.type)) {
      return `Invalid type for node ${node.id}: ${node.type}`
    }
    if (node.bibl && !Array.isArray(node.bibl)) {
      return `Invalid bibl for node ${node.id}`
    }
    if (node.visible !== undefined && typeof node.visible !== 'boolean') {
      return `Invalid visible field for node ${node.id}`
    }
  }

  const edgeIds = new Set()
  for (const edge of data.edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      return `Invalid edge ID: ${edge.id}`
    }
    // Ensure edge ID is in sourcename_targetname format
    if (edge.id !== `${edge.source}_${edge.target}`) {
      return `Edge ID must be in sourcename_targetname format: ${edge.id}`
    }
    if (edgeIds.has(edge.id)) {
      return `Duplicate edge ID: ${edge.id}`
    }
    edgeIds.add(edge.id)
    if (!edge.source || !edge.target || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return `Invalid source or target for edge ${edge.id}`
    }
    if (edge.type !== 'info') {
      return `Invalid type for edge ${edge.id}`
    }
  }

  // SlowYou-specific validations
  if (data.nodes[0].type !== 'background' || !data.nodes[0].label.startsWith('/images/SlowYou_')) {
    return 'First node must be of type background with SlowYou-themed image'
  }
  if (data.nodes[1].type !== 'fulltext' || !data.nodes[1].info.includes('pexels.com')) {
    return 'Second node must be of type fulltext with a Pexels image'
  }
  if (!data.nodes[1].bibl.some((ref) => ref.includes('Håve, T. A. (2025)'))) {
    return "Fulltext node must include Håve's research notes in bibl"
  }
  if (!data.nodes.some((node) => node.info && node.info.includes('SlowYou'))) {
    return 'At least one node must reference SlowYou principles or exercises'
  }

  return null
}

// SlowYou context for system instructions
const slowYouContext = `
SlowYou, developed by Tor Arne Håve, is a bioenergetic approach to personal growth and self-awareness, rooted in bioenergetic analysis. Håve, a certified Bioenergetic Instructor (NIBI, 2023), integrates principles from psychology, physiotherapy, yoga, and trauma work. SlowYou emphasizes connecting body, mind, and soul through the following principles:
- Kroppens Visdom: Presence, self-awareness, and grounding in the body.
- Hjertets Sentralitet: Cultivating love, compassion, and heart-centered wisdom.
- Grunning og Flyt: Grounding and natural movement to connect with gravity.
- Balanse og Harmoni: Harmonizing with nature's cycles and energy flow.
- Universalitet og Inklusivitet: Embracing diverse experiences and simplicity.
- Helhetlig Tilnærming: Integrating body, mind, and soul for holistic well-being.
- Naturlige Skjelvinger: Using body tremors for healing and vitality.
- Divine Feminine and Primordial Void: Embracing receptivity, intuition, and the nurturing source of creation.

SlowYou includes 15 bioenergetic exercises, such as:
- Standing and sensing self (5-10 min, focusing on breathing and relaxation).
- Golf ball foot massage (grounding and body awareness).
- Basic grounding exercise.
- Deep breathing into pelvic area and belly.
- Gong playing for sound healing.

SlowYou's history includes Håve's 5-year bioenergetic training, 4 years of group sessions, and over 50 hours of individual sessions. It is supported by NIBI and AlivenessLAB AS, focusing on vitality, presence, and self-discovery.
`

// Endpoint 1: Analyze Transcription with SlowYou Context
const handleAnalyzeTranscription = async (request, env) => {
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  let transcription, analysisPrompt

  try {
    const body = await request.json()
    transcription = body.transcription
    analysisPrompt = body.analysisPrompt
  } catch (e) {
    return createErrorResponse('Invalid JSON body', 400)
  }

  if (!subject) {
    return createErrorResponse('Subject is missing in the query parameters', 400)
  }
  if (!transcription || typeof transcription !== 'string') {
    return createErrorResponse('Transcription text is missing or invalid', 400)
  }
  if (!analysisPrompt || typeof analysisPrompt !== 'string') {
    return createErrorResponse('Analysis prompt is missing or invalid', 400)
  }

  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: API key missing', 500)
  }

  const prompt = `
    Analyze the provided transcription for the subject "${subject}", using the following analysis prompt: "${analysisPrompt}". Generate a JSON object with the following structure, integrating SlowYou's bioenergetic principles and exercises:

    - summary: A string (100-200 words) summarizing the main themes of the conversation, explicitly linking to at least one SlowYou principle (e.g., Kroppens Visdom, Hjertets Sentralitet).
    - insights: An array of at least 2 objects, each with:
      - quote: A string with a key statement from the transcription.
      - significance: A string (50-100 words) explaining its importance, referencing a SlowYou principle.
    - reflections: A string (50-100 words) describing the participant's moments of self-awareness or growth, connected to SlowYou's self-discovery focus.
    - themes: An array of at least 2 objects, each with:
      - name: A string naming the theme (e.g., "Self-Love").
      - description: A string (50-100 words) describing the theme and its relevance to a SlowYou principle.
    - slowYouApplications: An array of at least 2 strings, each describing a specific SlowYou exercise (e.g., grounding, deep breathing) or principle to support the participant's growth, tailored to the transcription.
    - references: An array of APA-formatted strings, including at least "Håve, T. A. (2025). Vegvisr.org Research Notes. Vegvisr.org.".

    **Transcription:**
    ${transcription}

    **SlowYou Context:**
    ${slowYouContext}

    **Guidelines:**
    - Map conversation themes to SlowYou principles and recommend specific exercises from the provided list.
    - Ensure the analysis is specific to "${subject}" and supports personal growth and self-awareness.
    - Include Håve's research notes in the references and summarize their relevance in the summary.
    - Return only the JSON object, with no additional text or explanations.
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
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `You are an expert in "${subject}" and SlowYou's bioenergetic principles, skilled at analyzing transcriptions for personal growth themes. Use the provided SlowYou context to ensure accurate integration of principles and exercises. Return only valid JSON.`,
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
  const analysisData = data.choices[0].message.content.trim()

  console.log('Raw JSON response from OpenAI (analysis):', analysisData)

  try {
    const parsedData = JSON.parse(analysisData)
    const validationError = validateAnalysisResults(parsedData)
    if (validationError) {
      console.error('Validation error:', validationError)
      return createErrorResponse(`Invalid analysis data: ${validationError}`, 400)
    }
    return createResponse(JSON.stringify(parsedData, null, 2))
  } catch (e) {
    console.error('Error parsing JSON or validating analysis data:', e.message)
    return createErrorResponse(`Failed to parse or validate analysis data: ${e.message}`, 400)
  }
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
  } catch (e) {
    console.error('Error parsing JSON or validating graph data:', e.message)
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (error) {
    return createErrorResponse(`Grok API error: ${error.message}`, 500)
  }
}
// Updated endpoint for versatile AI action with response format
const handleAIAction = async (request, env) => {
  let body
  try {
    body = await request.json()
  } catch (e) {
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
  } catch (error) {
    return createErrorResponse(`AI API error: ${error.message}`, 500)
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
  // Check for INT_TOKEN in Authorization header
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token !== env.INT_TOKEN) {
    return createErrorResponse('Unauthorized: Invalid token', 401)
  }

  // Parse the request body (expecting JSON with marker info)
  let body
  try {
    body = await request.json()
  } catch (e) {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { name, description, longitude, latitude } = body
  if (!name || longitude === undefined || latitude === undefined) {
    return createErrorResponse('Missing required marker fields', 400)
  }

  // Fetch the current KML file from R2
  const kmlObject = await env.MY_R2_BUCKET.get('Vegvisr.org.kml')
  let kmlText = ''
  if (kmlObject) {
    kmlText = await kmlObject.text()
  } else {
    // If not found, start a new KML file
    kmlText = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
  </Document>
</kml>`
  }

  // Insert new Placemark before </Document>
  const placemark = `
    <Placemark>
      <name>${name}</name>
      <description>${description || ''}</description>
      <Point>
        <coordinates>${longitude},${latitude},0</coordinates>
      </Point>
    </Placemark>
  `

  // Insert placemark before </Document>
  kmlText = kmlText.replace(/<\/Document>/, `${placemark}\n</Document>`)

  // Save updated KML back to R2
  await env.MY_R2_BUCKET.put('Vegvisr.org.kml', kmlText, {
    httpMetadata: { contentType: 'application/vnd.google-earth.kml+xml' },
  })

  return createResponse(JSON.stringify({ success: true, message: 'KML updated' }))
}

export default {
  async fetch(request, env) {
    console.log('Request received:', { method: request.method, url: request.url })
    const url = new URL(request.url)
    const { pathname } = url

    if (request.method === 'OPTIONS') {
      return createResponse('', 204)
    }

    try {
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
      if (pathname.startsWith('/snippetdelete') && request.method === 'DELETE') {
        return await handleSnippetDelete(request, env)
      }
      if (pathname === '/snippetlist' && request.method === 'GET') {
        return await handleSnippetList(request, env)
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

      if (pathname === '/update-kml' && request.method === 'POST') {
        return await handleUpdateKml(request, env)
      }

      return createErrorResponse('Not Found', 404)
    } catch (error) {
      return createErrorResponse(`Internal Server Error: ${error.message}`, 500)
    }
  },
}
