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
  'movemetime.com': 'abb39e8d56446afe3ac098abd5c21732', // movemetime.com zone ID
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
  'movemetime.com': ['www', 'api', 'mail', 'admin', 'blog', 'cdn', 'static'],
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

  const { prompt, returnType = 'fulltext', graphContext } = body
  if (!prompt || typeof prompt !== 'string') {
    return createErrorResponse('Prompt input is missing or invalid', 400)
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  })

  try {
    // Prepare the user message with optional graph context
    let userMessage = prompt
    if (graphContext && graphContext.trim()) {
      userMessage = `Context from knowledge graph:\n${graphContext}\n\nQuestion: ${prompt}`
    }

    // Generate main content
    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: graphContext
            ? 'You are a philosophical AI providing deep insights. Use the provided knowledge graph context to inform your response when relevant, but focus on answering the specific question asked.'
            : 'You are a philosophical AI providing deep insights.',
        },
        { role: 'user', content: userMessage },
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

    // Handle different return types
    if (returnType === 'action') {
      // Return action_test node
      return new Response(
        JSON.stringify({
          id: `action_${Date.now()}`,
          label: 'https://api.vegvisr.org/groktest',
          type: 'action_test',
          info: responseText,
          color: '#ffe6cc',
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
    } else if (returnType === 'both') {
      // Generate follow-up question
      const followUpCompletion = await client.chat.completions.create({
        model: 'grok-3-beta',
        temperature: 0.8,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'You are a philosophical AI. Based on the previous answer, generate ONE thoughtful follow-up question that would lead to deeper insights. Return ONLY the question, no explanations.',
          },
          {
            role: 'user',
            content: `Previous answer: ${responseText}\n\nGenerate a follow-up question:`,
          },
        ],
      })

      const followUpQuestion = followUpCompletion.choices[0].message.content.trim()

      // Return both fulltext and action nodes
      return new Response(
        JSON.stringify({
          type: 'both',
          fulltext: {
            id: `fulltext_${Date.now()}`,
            label: 'Grok Answer',
            type: 'fulltext',
            info: responseText,
            color: '#f9f9f9',
            bibl: biblReferences,
          },
          action: {
            id: `action_${Date.now() + 1}`,
            label: 'https://api.vegvisr.org/groktest',
            type: 'action_test',
            info: followUpQuestion,
            color: '#ffe6cc',
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    } else {
      // Default: return fulltext node
      return new Response(
        JSON.stringify({
          id: `fulltext_${Date.now()}`,
          label: 'Grok Answer',
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
    }
  } catch (error) {
    console.error('Grok API error details:', error)
    return createErrorResponse(`Grok API error: ${error.message || 'Unknown error'}`, 500)
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

  const { text, prompt, returnType = 'fulltext', graphContext } = body
  const inputText = text || prompt // Accept both 'text' and 'prompt' for compatibility
  if (!inputText || typeof inputText !== 'string') {
    return createErrorResponse('Text or prompt input is missing or invalid', 400)
  }

  try {
    // Prepare the input text with optional graph context
    let finalInputText = inputText
    if (graphContext && graphContext.trim()) {
      finalInputText = `Context from knowledge graph:\n${graphContext}\n\nQuestion: ${inputText}`
    }

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
                  text: finalInputText,
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

    // Handle different return types
    if (returnType === 'action') {
      // Return action_test node
      return createResponse(
        JSON.stringify({
          id: `action_${Date.now()}`,
          label: 'https://api.vegvisr.org/gemini-test',
          type: 'action_test',
          info: generatedText,
          color: '#ffe6cc',
          model: 'gemini-2.0-flash',
          prompt: inputText,
        }),
      )
    } else if (returnType === 'both') {
      // Generate follow-up question
      const followUpResponse = await fetch(
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
                    text: `Based on this answer: "${generatedText}", generate ONE thoughtful follow-up question that would lead to deeper insights. Return ONLY the question, no explanations.`,
                  },
                ],
              },
            ],
          }),
        },
      )

      let followUpQuestion = 'What would you like to explore further?'
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json()
        followUpQuestion =
          followUpData.candidates?.[0]?.content?.parts?.[0]?.text || followUpQuestion
      }

      // Return both fulltext and action nodes
      return createResponse(
        JSON.stringify({
          type: 'both',
          fulltext: {
            id: `fulltext_${Date.now()}`,
            label: 'Gemini Answer',
            type: 'fulltext',
            info: generatedText,
            color: '#e8f4fd',
            model: 'gemini-2.0-flash',
            prompt: inputText,
          },
          action: {
            id: `action_${Date.now() + 1}`,
            label: 'https://api.vegvisr.org/gemini-test',
            type: 'action_test',
            info: followUpQuestion,
            color: '#ffe6cc',
          },
        }),
      )
    } else {
      // Default: return fulltext node
      return createResponse(
        JSON.stringify({
          id: `gemini_${Date.now()}`,
          label: 'Gemini Answer',
          type: 'fulltext',
          info: generatedText,
          color: '#e8f4fd',
          model: 'gemini-2.0-flash',
          prompt: inputText,
        }),
      )
    }
  } catch (error) {
    return createErrorResponse(`Gemini API error: ${error.message}`, 500)
  }
}

const handleClaudeTest = async (request, env) => {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return createErrorResponse('Internal Server Error: Anthropic API key missing', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }

  const { prompt, returnType = 'fulltext', graphContext } = body
  if (!prompt || typeof prompt !== 'string') {
    return createErrorResponse('Prompt input is missing or invalid', 400)
  }

  try {
    // Prepare the message content with optional graph context
    let messageContent = prompt
    if (graphContext && graphContext.trim()) {
      messageContent = `Context from knowledge graph:\n${graphContext}\n\nQuestion: ${prompt}\n\nPlease use the provided context to inform your response when relevant, but focus on answering the specific question asked.`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return createErrorResponse(`Claude API error: ${response.status} - ${errorText}`, 500)
    }

    const data = await response.json()

    // Extract the generated text from Claude's response format
    const generatedText = data.content?.[0]?.text || 'No response generated'

    // Handle different return types
    if (returnType === 'action') {
      // Return action_test node
      return createResponse(
        JSON.stringify({
          id: `action_${Date.now()}`,
          label: 'https://api.vegvisr.org/claude-test',
          type: 'action_test',
          info: generatedText,
          color: '#ffe6cc',
          model: 'claude-3-5-sonnet',
          prompt: prompt,
        }),
      )
    } else if (returnType === 'both') {
      // Generate follow-up question
      const followUpResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Based on this answer: "${generatedText}", generate ONE thoughtful follow-up question that would lead to deeper insights. Return ONLY the question, no explanations.`,
            },
          ],
        }),
      })

      let followUpQuestion = 'What would you like to explore further?'
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json()
        followUpQuestion = followUpData.content?.[0]?.text || followUpQuestion
      }

      // Return both fulltext and action nodes
      return createResponse(
        JSON.stringify({
          type: 'both',
          fulltext: {
            id: `fulltext_${Date.now()}`,
            label: 'Claude Answer',
            type: 'fulltext',
            info: generatedText,
            color: '#f4e5d3',
            model: 'claude-3-5-sonnet',
            prompt: prompt,
          },
          action: {
            id: `action_${Date.now() + 1}`,
            label: 'https://api.vegvisr.org/claude-test',
            type: 'action_test',
            info: followUpQuestion,
            color: '#ffe6cc',
          },
        }),
      )
    } else {
      // Default: return fulltext node
      return createResponse(
        JSON.stringify({
          id: `claude_${Date.now()}`,
          label: 'Claude Answer',
          type: 'fulltext',
          info: generatedText,
          color: '#f4e5d3',
          model: 'claude-3-5-sonnet',
          prompt: prompt,
        }),
      )
    }
  } catch (error) {
    return createErrorResponse(`Claude API error: ${error.message}`, 500)
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
  } catch (error) {
    console.error('AI API error details:', error)
    return createErrorResponse(`AI API error: ${error.message || 'Unknown error'}`, 500)
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

    if (targetLanguage === 'original') {
      // --- PROMPT FOR ORIGINAL LANGUAGE ---
      console.log('Processing in original language.')
      maxTokens = 16000

      prompt = `Transform this transcript into a comprehensive knowledge graph in its ORIGINAL language. DO NOT TRANSLATE. Create 8-15 detailed thematic sections as nodes.

SOURCE LANGUAGE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET LANGUAGE: Original (No Translation)

RULES:
1.  DO NOT TRANSLATE the content. Keep it in the original language.
2.  Create nodes with structure: {"id": "del_X", "label": "PART X: [Descriptive Title in Original Language]", "color": "#f9f9f9", "type": "fulltext", "info": "comprehensive content in original language", "bibl": [], "imageWidth": "100%", "imageHeight": "100%", "visible": true, "path": null}
3.  Split into logical thematic sections. Be thorough.
4.  Use rich markdown formatting in the "info" field with headers, lists, and emphasis.
5.  Each node should contain substantial content (200-800 words).
6.  Include key quotes, important details, and context from the original text.
7.  Create a comprehensive knowledge graph that captures the full essence of the original transcript.

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
- Each node should be substantial (150-600 words)
- Include important quotes, examples, and detailed explanations
- Don't summarize - be comprehensive and detailed

TRANSCRIPT:
${transcript}

Return only JSON: {"nodes": [...], "edges": []}`
      }
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

// --- AI Generate Menu Endpoint ---
const handleAIGenerateMenu = async (request, env) => {
  try {
    const { graphData, userRequest, currentMenuData } = await request.json()

    console.log('=== AI Generate Menu Debug ===')
    console.log('userRequest:', userRequest)
    console.log('graphData nodes:', graphData?.nodes?.length || 0)
    console.log('graphData metadata:', graphData?.metadata || {})
    console.log('currentMenuData:', currentMenuData)
    console.log('===============================')

    if (!graphData || !graphData.nodes || !Array.isArray(graphData.nodes)) {
      return createErrorResponse('Missing or invalid graphData parameter', 400)
    }

    // 1. Fetch available node types from graphTemplates table
    console.log('Fetching available node types from database...')
    const availableNodeTypes = []
    try {
      const templatesQuery = `SELECT id, name, nodes FROM graphTemplates`
      const templatesResult = await env.vegvisr_org.prepare(templatesQuery).all()

      console.log(`Found ${templatesResult.results?.length || 0} templates in database`)

      for (const template of templatesResult.results || []) {
        try {
          const templateNodes = JSON.parse(template.nodes || '[]')
          console.log(`Template ${template.name} has ${templateNodes.length} nodes`)

          if (templateNodes.length > 0) {
            const nodeType = templateNodes[0].type
            console.log(`Template ${template.name} -> nodeType: ${nodeType}`)

            if (nodeType) {
              availableNodeTypes.push({
                nodeType: nodeType,
                name: template.name,
                id: template.id,
              })
            }
          }
        } catch (e) {
          console.warn(`Error parsing template ${template.id}:`, e.message)
        }
      }
    } catch (error) {
      console.error('Error fetching node types:', error)
    }

    console.log('Available node types for template-selector:')
    availableNodeTypes.forEach((t) => {
      console.log(`  - ${t.nodeType} (${t.name})`)
    })

    // 2. Query similar graphs by category and metaArea
    const graphMetadata = graphData.metadata || {}
    const graphNodes = graphData.nodes || []

    const categories = graphMetadata.category
      ? graphMetadata.category
          .split('#')
          .map((c) => c.trim())
          .filter((c) => c)
      : []
    const metaAreas = graphMetadata.metaArea
      ? graphMetadata.metaArea
          .split('#')
          .map((m) => m.trim())
          .filter((m) => m)
      : []

    console.log('Current graph categories:', categories)
    console.log('Current graph metaAreas:', metaAreas)

    // Find similar graphs
    const similarGraphs = []
    if (categories.length > 0 || metaAreas.length > 0) {
      try {
        const graphsQuery = `SELECT id, title, data FROM knowledge_graphs LIMIT 100`
        const graphsResult = await env.vegvisr_org.prepare(graphsQuery).all()

        for (const graph of graphsResult.results || []) {
          try {
            const graphData = JSON.parse(graph.data || '{}')
            const graphMetadata = graphData.metadata || {}

            const graphCategories = graphMetadata.category
              ? graphMetadata.category
                  .split('#')
                  .map((c) => c.trim())
                  .filter((c) => c)
              : []
            const graphMetaAreas = graphMetadata.metaArea
              ? graphMetadata.metaArea
                  .split('#')
                  .map((m) => m.trim())
                  .filter((m) => m)
              : []

            // Check for overlap in categories or metaAreas
            const categoryOverlap = categories.some((cat) =>
              graphCategories.some((gc) => gc.toLowerCase().includes(cat.toLowerCase())),
            )
            const metaAreaOverlap = metaAreas.some((meta) =>
              graphMetaAreas.some((gm) => gm.toLowerCase().includes(meta.toLowerCase())),
            )

            if (categoryOverlap || metaAreaOverlap) {
              similarGraphs.push({
                id: graph.id,
                title: graph.title,
                categories: graphCategories,
                metaAreas: graphMetaAreas,
              })
            }
          } catch (e) {
            console.warn(`Error parsing graph ${graph.id}:`, e.message)
          }
        }
      } catch (error) {
        console.error('Error fetching similar graphs:', error)
      }
    }

    console.log('Found similar graphs:', similarGraphs.length)
    console.log('Similar graphs:', similarGraphs.map((g) => `${g.title} (${g.id})`).join(', '))

    // 3. Extract content themes from current graph
    const contentThemes = graphNodes
      .filter((node) => node.visible !== false && node.info)
      .map((node) => ({
        label: node.label || 'Untitled',
        type: node.type || 'default',
        content: node.info.substring(0, 200) + '...',
        hasContent: !!node.info,
      }))
      .slice(0, 10) // Limit to avoid token limits

    // 4. Define available routes
    const availableRoutes = [
      { path: '/', label: 'Home', icon: '🏠' },
      { path: '/graph-editor', label: 'Editor', icon: '✏️' },
      { path: '/graph-canvas', label: 'Canvas', icon: '🎨' },
      { path: '/graph-portfolio', label: 'Portfolio', icon: '📁' },
      { path: '/graph-viewer', label: 'Viewer', icon: '👁️' },
      { path: '/search', label: 'Search', icon: '🔍' },
      { path: '/user', label: 'Dashboard', icon: '📊' },
      { path: '/github-issues', label: 'Roadmap', icon: '🗺️' },
      { path: '/gnew-viewer', label: 'GNew Viewer', icon: '🧪', requiresRole: ['Superadmin'] },
      { path: '/sandbox', label: 'Sandbox', icon: '🔧', requiresRole: ['Superadmin'] },
    ]

    // Build context-aware prompt with grounded system data
    const contextPrompt = `Based on the following knowledge graph content, generate a smart, context-aware menu structure that helps users navigate and discover related content.

GRAPH ANALYSIS:
- Title: ${graphMetadata.title || 'Untitled Graph'}
- Description: ${graphMetadata.description || 'No description'}
- Categories: ${categories.join(', ') || 'None'}
- Meta Areas: ${metaAreas.join(', ') || 'None'}
- Total Nodes: ${graphNodes.length}
- Content Themes: ${contentThemes.map((t) => `${t.label} (${t.type})`).join(', ')}

CONTENT SAMPLE:
${contentThemes.map((theme) => `- ${theme.label}: ${theme.content}`).join('\n')}

SIMILAR GRAPHS IN THE SYSTEM (${similarGraphs.length} found):
${similarGraphs
  .slice(0, 5)
  .map(
    (graph, i) =>
      `${i + 1}. "${graph.title}" (ID: ${graph.id}) - Categories: ${graph.categories.join(', ')} - Meta Areas: ${graph.metaAreas.join(', ')}`,
  )
  .join('\n')}

AVAILABLE ROUTES (only use these exact paths):
${availableRoutes.map((route) => `- ${route.path} (${route.label}) ${route.icon}${route.requiresRole ? ' - Requires: ' + route.requiresRole.join(', ') : ''}`).join('\n')}

AVAILABLE NODE TYPES FOR TEMPLATE-SELECTOR (only use these exact nodeTypes):
${availableNodeTypes.map((type) => `- ${type.nodeType} (${type.name})`).join('\n')}

HOW TEMPLATE-SELECTOR WORKS:
When a user clicks a template-selector menu item, the system:
1. Fetches templates from the graphTemplates database table
2. Finds a template where template.nodes[0].type === nodeType
3. Creates a new node from that template and adds it to the graph
4. Therefore, the nodeType MUST exactly match a real node type from the list above

${userRequest ? `\nUSER REQUEST: ${userRequest}` : ''}

CURRENT MENU (if any):
${currentMenuData ? JSON.stringify(currentMenuData, null, 2) : 'No current menu'}

CRITICAL REQUIREMENTS:
1. Menu items can ONLY use these types: "route", "graph-link", "template-selector", "external"
2. For "route" type: ONLY use paths from the AVAILABLE ROUTES list above
3. For "graph-link" type: ONLY use graph IDs from the SIMILAR GRAPHS list above
4. For "template-selector" type: ONLY use nodeTypes from the AVAILABLE NODE TYPES list above
5. For "external" type: Use valid external URLs
6. DO NOT invent functionality that doesn't exist
7. Focus on content themes and actual available similar graphs
8. Ensure all menu items are grounded in reality

EXACT JSON STRUCTURE FOR MENU ITEMS:
- route: {"type": "route", "path": "/exact-path", "requiresRole": null}
- graph-link: {"type": "graph-link", "graphId": "exact-graph-id", "requiresRole": null}
- template-selector: {"type": "template-selector", "nodeType": "exact-node-type", "requiresRole": ["Admin","Superadmin"]}
- external: {"type": "external", "url": "https://example.com", "requiresRole": null}

Return a JSON object with this structure:
{
  "menuSuggestion": {
    "name": "Generated Menu Name",
    "description": "Brief description of the menu purpose",
    "menuLevel": "graph",
    "items": [
      {
        "id": "unique-id",
        "label": "Menu Item Label",
        "icon": "🏠",
        "type": "route|graph-link|template-selector|external",
        "path": "/exact-path-from-available-routes",
        "graphId": "exact-graph-id-from-similar-graphs",
        "nodeType": "exact-node-type-from-available-types",
        "url": "https://external-url.com",
        "requiresRole": null,
        "description": "Why this menu item is relevant"
      }
    ],
    "style": {
      "layout": "horizontal",
      "theme": "default",
      "position": "top",
      "buttonStyle": "hamburger"
    }
  },
  "pageRecommendations": [
    {
      "title": "Suggested Page Title",
      "description": "Why this page would be valuable based on similar graphs and content",
      "estimatedContent": "Brief description of what this page should contain",
      "targetAudience": "Who would benefit from this page",
      "priority": "high|medium|low"
    }
  ],
  "audienceInsights": {
    "primaryAudience": "Identified primary audience based on categories and meta areas",
    "contentComplexity": "beginner|intermediate|advanced",
    "suggestedNavigationFlow": "How users should navigate through the content"
  }
}`

    console.log('Generated prompt length:', contextPrompt.length)

    // Generate menu using AI
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert UX designer and information architect specializing in knowledge graphs and user navigation. You excel at creating intuitive menu structures that guide users through complex content and suggest valuable related resources. CRITICAL: You MUST ONLY use the exact paths, graph IDs, and node types provided in the context. DO NOT invent functionality that does not exist. Ground all suggestions in the actual available system capabilities.',
        },
        { role: 'user', content: contextPrompt },
      ],
    })

    console.log('AI response received, parsing...')

    const result = JSON.parse(completion.choices[0].message.content.trim())

    // Validate the response structure
    if (!result.menuSuggestion || !result.menuSuggestion.items) {
      throw new Error('Invalid AI response: missing menuSuggestion or items')
    }

    // Validate and process each menu item to ensure it uses real functionality
    const processedItems = result.menuSuggestion.items
      .map((item, index) => {
        const processed = {
          id: item.id || `menu-item-${index + 1}`,
          label: item.label || `Menu Item ${index + 1}`,
          icon: item.icon || '📄',
          type: item.type || 'route',
          requiresRole: item.requiresRole || null,
          description: item.description || 'Generated menu item',
        }

        // Validate based on menu item type
        switch (item.type) {
          case 'route':
            // Validate path is in available routes
            const validRoute = availableRoutes.find((route) => route.path === item.path)
            if (validRoute) {
              processed.path = item.path
              processed.requiresRole = validRoute.requiresRole || null
            } else {
              console.warn(`Invalid route path: ${item.path}, defaulting to /`)
              processed.path = '/'
            }
            break

          case 'graph-link':
            // Validate graph ID is in similar graphs
            const validGraph = similarGraphs.find((graph) => graph.id === item.graphId)
            if (validGraph) {
              processed.graphId = item.graphId
            } else {
              console.warn(`Invalid graph ID: ${item.graphId}, removing item`)
              return null // Remove invalid items
            }
            break

          case 'template-selector':
            // Validate node type is in available node types
            const validNodeType = availableNodeTypes.find((type) => type.nodeType === item.nodeType)
            if (validNodeType) {
              processed.nodeType = item.nodeType
              // Ensure requiresRole is properly formatted as array or null
              if (item.requiresRole && Array.isArray(item.requiresRole)) {
                processed.requiresRole = item.requiresRole
              } else if (item.requiresRole && typeof item.requiresRole === 'string') {
                processed.requiresRole = [item.requiresRole]
              } else {
                processed.requiresRole = ['Admin', 'Superadmin'] // Default for template-selector
              }
            } else {
              console.warn(`Invalid node type: ${item.nodeType}, removing item`)
              return null // Remove invalid items
            }
            break

          case 'external':
            // Validate URL format
            if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
              processed.url = item.url
            } else {
              console.warn(`Invalid external URL: ${item.url}, removing item`)
              return null // Remove invalid items
            }
            break

          default:
            console.warn(`Unknown menu item type: ${item.type}, defaulting to route`)
            processed.type = 'route'
            processed.path = '/'
            break
        }

        return processed
      })
      .filter((item) => item !== null) // Remove null items (invalid ones)

    const processedMenu = {
      ...result.menuSuggestion,
      items: processedItems,
    }

    console.log('✅ Successfully generated menu:', processedMenu)
    console.log('✅ Validation results:', {
      originalItems: result.menuSuggestion.items.length,
      validatedItems: processedItems.length,
      removedItems: result.menuSuggestion.items.length - processedItems.length,
    })

    return createResponse(
      JSON.stringify({
        menuSuggestion: processedMenu,
        pageRecommendations: result.pageRecommendations || [],
        audienceInsights: result.audienceInsights || {},
        metadata: {
          sourceNodes: graphNodes.length,
          analysedCategories: categories,
          analysedMetaAreas: metaAreas,
          generatedAt: new Date().toISOString(),
          model: 'grok-3-beta',
        },
      }),
    )
  } catch (error) {
    console.error('Error in handleAIGenerateMenu:', error)
    return createErrorResponse(error.message || 'Internal server error', 500)
  }
}

// --- AI Generate Quotes Endpoint ---
const handleAIGenerateQuotes = async (request, env) => {
  try {
    const { graphContext, userRequest, graphId, username } = await request.json()

    console.log('=== AI Generate Quotes Debug ===')
    console.log('userRequest:', userRequest)
    console.log('graphId:', graphId)
    console.log('username:', username)
    console.log('graphContext nodes:', graphContext ? graphContext.length : 'null/undefined')
    console.log('================================')

    if (!graphContext || !Array.isArray(graphContext) || graphContext.length === 0) {
      return createErrorResponse('Missing or empty graphContext parameter', 400)
    }

    // Extract meaningful content from graph nodes
    const contextContent = graphContext
      .map((node) => {
        const nodeContent = `Title: ${node.label || 'Untitled'}\nContent: ${node.info || 'No content'}`
        return nodeContent
      })
      .join('\n\n---\n\n')

    console.log('Extracted context content length:', contextContent.length)

    // Create the prompt for quote generation
    const prompt = `Based on the following knowledge graph content, generate 4-5 inspirational and meaningful quotes that capture the essence and wisdom from the material.

Knowledge Graph Content:
${contextContent}

${userRequest ? `Additional context: ${userRequest}` : ''}
${username ? `Username: @${username}` : ''}

Requirements:
- Generate 4-5 unique quotes
- Each quote should be meaningful and inspirational
- Quotes should reflect the themes and wisdom from the provided content
- Include potential attribution/citation when relevant
- Make quotes suitable for social media sharing

Return a JSON object with the following structure:
{
  "quotes": [
    {
      "text": "The actual quote text here",
      "citation": "Optional author or source attribution",
      "source": "Brief description of which part of the content inspired this quote"
    }
  ]
}`

    console.log('Generated prompt length:', prompt.length)

    // Generate quotes using AI
    const client = new OpenAI({
      apiKey: env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.8, // Higher temperature for more creative quotes
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at creating inspirational quotes and extracting wisdom from complex content. You excel at distilling key insights into memorable, shareable quotes that resonate with people.',
        },
        { role: 'user', content: prompt },
      ],
    })

    console.log('AI response received, parsing...')

    const result = JSON.parse(completion.choices[0].message.content.trim())

    // Validate the response structure
    if (!result.quotes || !Array.isArray(result.quotes)) {
      throw new Error('Invalid AI response: missing quotes array')
    }

    // Ensure each quote has required fields
    const processedQuotes = result.quotes.map((quote, index) => ({
      text: quote.text || quote.quote || `Quote ${index + 1}`,
      citation: quote.citation || quote.author || '',
      source: quote.source || `Content analysis ${index + 1}`,
    }))

    console.log('✅ Successfully generated quotes:', processedQuotes.length)

    return createResponse(
      JSON.stringify({
        quotes: processedQuotes,
        metadata: {
          sourceNodes: graphContext.length,
          generatedAt: new Date().toISOString(),
          model: 'grok-3-beta',
        },
      }),
    )
  } catch (error) {
    console.error('Error in handleAIGenerateQuotes:', error)
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
    {
      id: 'text_only_basic',
      name: 'Text Only Basic',
      description:
        'Simple formatting with FANCY headers, SECTION blocks, and QUOTE citations - no images',
      nodeTypes: ['fulltext', 'title', 'worknote', 'markdown-image'],
      transformationRules: {
        addFancyHeaders: true,
        addSections: true,
        addQuotes: true,
      },
      category: 'basic',
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

  const {
    nodeContent,
    templateId,
    nodeType,
    options = {},
    colorTheme = null,
    languageOptions = null,
  } = body

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
  console.log('Language Options:', JSON.stringify(languageOptions))

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
    {
      id: 'text_only_basic',
      aiInstructions: `Transform this content with clean, simple text formatting - NO IMAGES:

TEXT-ONLY FORMATTING REQUIREMENTS:
1. Add a FANCY header with attractive styling:
   [FANCY | font-size: 2.5em; color: #2c3e50; background: linear-gradient(45deg, #f8f9fa, #e9ecef); text-align: center; padding: 15px; border-radius: 8px; margin-bottom: 20px]Your Title Here[END FANCY]

2. Structure content into clear SECTION blocks:
   [SECTION | background-color: '#f8f9fa'; color: '#333'; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #007bff]
   Main content section here
   [END SECTION]

3. Add relevant QUOTE blocks with proper citations:
   [QUOTE | Cited='Author Name or Source']
   Meaningful quote text that supports the content
   [END QUOTE]

4. Use different section colors for variety:
   - Light blue: background-color: '#e3f2fd'
   - Light green: background-color: '#e8f5e8'
   - Light yellow: background-color: '#fff8e1'
   - Light purple: background-color: '#f3e5f5'

IMPORTANT:
- Do NOT add any images, WNOTE blocks, or visual elements
- Do NOT add explanatory text, comments, or formatting notes
- Do NOT include introductory or concluding commentary
- Focus purely on clean text formatting with headers, sections, and quotes
- Return ONLY the formatted content, nothing else`,
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

    // Build language preservation instructions
    let languageInstructions = ''
    if (languageOptions?.mode === 'auto-detect' && languageOptions.detectedLanguage) {
      if (languageOptions.detectedLanguage !== 'Unknown') {
        languageInstructions = `
CRITICAL LANGUAGE REQUIREMENT: The original content is in ${languageOptions.detectedLanguage}.
You MUST preserve this language exactly. Do not translate or change the language in any way.
Apply the formatting while keeping all text in ${languageOptions.detectedLanguage}.
All headings, sections, and content must remain in ${languageOptions.detectedLanguage}.
`
      } else {
        languageInstructions = `
CRITICAL LANGUAGE REQUIREMENT: Preserve the exact original language of the content.
Do not translate, change language, or assume any specific language.
Keep the original language throughout the formatted content.
`
      }
    } else if (languageOptions?.mode === 'keep-current') {
      languageInstructions = `
CRITICAL LANGUAGE REQUIREMENT: Keep the exact same language as the original content.
Do not translate, change language, or assume any specific language.
Preserve the original language throughout the formatted content.
`
    }

    const prompt = `${template.aiInstructions}

${colorInstructions}

${languageInstructions}

ORIGINAL CONTENT TO TRANSFORM:
${nodeContent}

ADDITIONAL OPTIONS: ${JSON.stringify(options)}

CRITICAL OUTPUT REQUIREMENTS:
- Return ONLY the formatted content with the requested formatting applied
- Do NOT add any explanatory text, comments, or meta-commentary
- Do NOT include phrases like "Below is the transformed content..." or "Notes on formatting:"
- Do NOT explain your formatting choices or decisions
- Do NOT add any text that was not in the original content
- Simply return the clean, formatted version of the original content

Use the placeholder URLs exactly as specified (HEADER_IMAGE_PLACEHOLDER, LEFTSIDE_IMAGE_PLACEHOLDER, RIGHTSIDE_IMAGE_PLACEHOLDER) - these will be replaced with real contextual images. Apply the color theme consistently throughout all formatting elements. Preserve the core meaning while enhancing the presentation with the specified markdown formatting patterns.`

    console.log('=== Language Processing Info ===')
    if (languageInstructions) {
      console.log('Language preservation active:', languageOptions.mode)
      console.log('Detected/Target language:', languageOptions.detectedLanguage || 'N/A')
    } else {
      console.log('No language preservation applied')
    }

    console.log('Sending prompt to Grok:', prompt)

    const completion = await client.chat.completions.create({
      model: 'grok-3-beta',
      temperature: 0.7,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert content formatter specializing in rich markdown formatting for knowledge graphs. Apply the requested formatting patterns precisely while preserving content meaning and enhancing readability. CRITICAL: Return ONLY the formatted content without any explanatory text, comments, introductions, or meta-commentary. Do not explain your formatting choices.',
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

    // Clean and validate the code before deployment
    console.log(`Deploying persistent sandbox for user: ${workerName}`)
    console.log('Worker code preview:', code.substring(0, 200) + '...')

    // Enhanced debugging and cleaning
    console.log('🔍 Original code analysis:')
    console.log('- Length:', code.length)
    console.log('- First 100 chars:', JSON.stringify(code.substring(0, 100)))
    console.log('- Contains export default:', code.includes('export default'))
    console.log('- Contains addEventListener:', code.includes('addEventListener'))

    // Clean the code more conservatively
    let cleanCode = code
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Convert any remaining \r to \n
      .trim()

    console.log('🧹 After cleaning:')
    console.log('- Length:', cleanCode.length)
    console.log('- First 100 chars:', JSON.stringify(cleanCode.substring(0, 100)))
    console.log('- Contains export default:', cleanCode.includes('export default'))
    console.log('- Contains addEventListener:', cleanCode.includes('addEventListener'))

    // Reject ESM code
    if (cleanCode.includes('export default')) {
      return createErrorResponse(
        "ESM (export default) syntax is not supported. Please use classic addEventListener('fetch', ...) syntax.",
        400,
      )
    }
    // Require classic worker code
    if (
      !cleanCode.includes('addEventListener("fetch"') &&
      !cleanCode.includes("addEventListener('fetch'")
    ) {
      return createErrorResponse(
        'Invalid worker code: must use addEventListener("fetch", ...) syntax.',
        400,
      )
    }

    // Final syntax check: basic braces check
    const openBraces = (cleanCode.match(/{/g) || []).length
    const closeBraces = (cleanCode.match(/}/g) || []).length
    if (openBraces !== closeBraces) {
      console.log('❌ Mismatched braces detected:', { openBraces, closeBraces })
      return createErrorResponse(
        `Invalid worker code: mismatched braces (${openBraces} open, ${closeBraces} close)`,
        400,
      )
    }

    console.log('✅ Code validation passed, deploying...')
    console.log('📤 Final code to deploy:')
    console.log('- Length:', cleanCode.length)
    console.log('- Preview:', JSON.stringify(cleanCode.substring(0, 200) + '...'))
    console.log('🔍 Character analysis around position 87:')
    console.log('- Chars 80-90:', JSON.stringify(cleanCode.substring(80, 90)))
    console.log('- Char at 87:', JSON.stringify(cleanCode.charAt(87)))
    console.log('- Char code at 87:', cleanCode.charCodeAt(87))

    // Debug log to confirm deployment URL
    console.log(
      'Deploying to:',
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    )
    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/javascript',
        },
        body: cleanCode,
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
      codePreview: cleanCode.substring(0, 500), // Store preview for debugging
      originalCodeLength: code.length,
      cleanCodeLength: cleanCode.length,
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

// Get Deployed Sandbox Code Handler
const handleGetSandboxCode = async (request, env) => {
  try {
    const url = new URL(request.url)
    const userToken = url.searchParams.get('userToken')

    if (!userToken) {
      return createErrorResponse('Missing userToken parameter', 400)
    }

    // Get sandbox metadata from KV
    const sandboxData = await env.BINDING_NAME.get(`sandbox:${userToken}`)
    if (!sandboxData) {
      return createErrorResponse('Sandbox not found. Please deploy your sandbox first.', 404)
    }

    const sandbox = JSON.parse(sandboxData)
    const workerName = sandbox.workerName

    const accountId = env.CF_ACCOUNT_ID
    const apiToken = env.CF_API_TOKEN_SANDBOX

    // Fetch the deployed worker code from Cloudflare API
    console.log(`Fetching deployed code for worker: ${workerName}`)

    const codeRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/javascript',
        },
      },
    )

    if (!codeRes.ok) {
      const errorText = await codeRes.text()
      console.error('Failed to fetch deployed code:', errorText)
      return createErrorResponse(
        `Failed to fetch deployed code: HTTP ${codeRes.status}`,
        codeRes.status,
      )
    }

    const deployedCode = await codeRes.text()

    return createResponse(
      JSON.stringify({
        success: true,
        code: deployedCode,
        workerName: sandbox.workerName,
        endpoint: sandbox.endpoint,
        lastUpdated: sandbox.lastUpdated,
        fetchedAt: new Date().toISOString(),
      }),
      200,
    )
  } catch (e) {
    console.error('Error fetching sandbox code:', e)
    return createErrorResponse('Error fetching deployed code: ' + e.message, 500)
  }
}

// AI Worker Generation Handler
const handleGenerateWorker = async (request, env) => {
  try {
    const body = await request.json()
    const { prompt, aiModel, selectedExamples, userPrompt } = body

    if (!prompt || !aiModel) {
      return createErrorResponse('Missing required parameters: prompt and aiModel', 400)
    }

    // Prepare context from selected examples
    let exampleContext = ''
    if (selectedExamples && selectedExamples.length > 0) {
      exampleContext = `\n\nSelected Code Examples:\n${selectedExamples
        .map((ex) => `// ${ex.title} (${ex.language})\n// ${ex.description}\n${ex.code}`)
        .join('\n\n// ---\n\n')}`
    }

    const finalPrompt = `Generate a complete, production-ready Cloudflare Worker script based on the following requirements:

User Request: ${userPrompt || 'Create a basic worker'}

Context: This worker will be deployed to a RAG-enabled sandbox environment for knowledge graph operations.

Requirements:
- Must be a complete, working Cloudflare Worker
- Should handle HTTP requests appropriately
- Include proper error handling and CORS headers
- Add helpful comments explaining the functionality
- Make it production-ready and efficient
- Return valid JavaScript code only

${exampleContext}

Please generate only the JavaScript code for the worker, without any markdown formatting, explanations, or additional text.`

    let apiKey, baseURL, model, result

    // Call the appropriate AI model
    switch (aiModel) {
      case 'grok':
        apiKey = env.XAI_API_KEY
        if (!apiKey) {
          return createErrorResponse('XAI API key not configured', 500)
        }

        const grokClient = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.x.ai/v1',
        })

        const grokCompletion = await grokClient.chat.completions.create({
          model: 'grok-3-beta',
          temperature: 0.7,
          max_tokens: 3000,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert Cloudflare Worker developer. Generate clean, production-ready JavaScript code without any markdown formatting or explanations.',
            },
            { role: 'user', content: finalPrompt },
          ],
        })

        result = grokCompletion.choices[0].message.content.trim()
        break

      case 'openai':
        apiKey = env.OPENAI_API_KEY
        if (!apiKey) {
          return createErrorResponse('OpenAI API key not configured', 500)
        }

        const openaiClient = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.openai.com/v1',
        })

        const openaiCompletion = await openaiClient.chat.completions.create({
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 3000,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert Cloudflare Worker developer. Generate clean, production-ready JavaScript code without any markdown formatting or explanations.',
            },
            { role: 'user', content: finalPrompt },
          ],
        })

        result = openaiCompletion.choices[0].message.content.trim()
        break

      case 'gemini':
        apiKey = env.GOOGLE_GEMINI_API_KEY
        if (!apiKey) {
          return createErrorResponse('Google Gemini API key not configured', 500)
        }

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: finalPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 3000,
              },
            }),
          },
        )

        if (!geminiResponse.ok) {
          throw new Error(`Gemini API error: ${geminiResponse.status}`)
        }

        const geminiData = await geminiResponse.json()
        result = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No code generated'
        break

      default:
        return createErrorResponse('Invalid AI model specified', 400)
    }

    // Clean up the generated code
    let cleanCode = result
      .replace(/```javascript\n?/g, '')
      .replace(/```js\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Ensure it starts with proper worker code
    if (!cleanCode.includes('addEventListener') && !cleanCode.includes('export default')) {
      cleanCode = `// Generated Cloudflare Worker\n${cleanCode}`
    }

    return createResponse(
      JSON.stringify({
        success: true,
        code: cleanCode,
        model: aiModel,
        timestamp: new Date().toISOString(),
      }),
    )
  } catch (error) {
    console.error('Worker generation error:', error)
    return createErrorResponse(`Worker generation failed: ${error.message}`, 500)
  }
}

// --- YouTube Script Generation Handler ---
const handleGenerateYouTubeScript = async (request, env) => {
  try {
    const body = await request.json()
    const {
      markdown,
      youtubeUrl,
      aiProvider,
      language,
      scriptStyle,
      targetDuration,
      includeTimestamps,
      includeEngagement,
    } = body

    if (!markdown) {
      return createErrorResponse('Missing required parameter: markdown', 400)
    }

    // Extract YouTube video ID from URL
    let videoId = ''
    if (youtubeUrl) {
      const urlMatch = youtubeUrl.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      )
      videoId = urlMatch ? urlMatch[1] : ''
    }

    // Create language-specific prompt
    const isNorwegian = language === 'norwegian'
    const finalPrompt = isNorwegian
      ? `Du er en profesjonell YouTube-skaper og manusforfatter. Generer et omfattende, engasjerende YouTube-manus basert på følgende dokumentasjon:

DOKUMENTASJON:
${markdown}

VIDEOSTIL: ${scriptStyle || 'tutorial'}
MÅLVARIGHET: ${targetDuration || '5-10 minutter'}
YOUTUBE URL: ${youtubeUrl || 'Ikke oppgitt'}

KRAV:
1. **Huk (Første 15 sekunder)** - Fang oppmerksomhet umiddelbart
2. **Verdiløfte** - Fortell seerne hva de vil lære
3. **Strukturerte seksjoner** med klare overganger
4. **Engasjementselementer** - Abonner-påminnelser, kommentarer, liker
5. **Handling-til-handling** - Veilede seere til neste steg
6. **YouTube beste praksis** - Retensjonsfokusert skriving

${includeTimestamps ? 'INKLUDER TIDSSTEMPLER: Legg til [0:00], [1:30], etc. for YouTube-kapitler' : ''}
${includeEngagement ? 'INKLUDER ENGASJEMENT: Legg til abonner-oppfordringer, like-påminnelser, kommentarspørsmål' : ''}

FORMAT:
- Profesjonell, samtaleaktig tone
- Klare seksjonsoverskrifter
- Handlingsrettet innhold
- Seer-fokusert språk ("du vil lære", "la meg vise deg")
- Naturlige overganger mellom seksjoner

Generer et komplett, klart-til-bruk YouTube-manus som ville fungere godt for pedagogisk innhold om den dokumenterte funksjonen eller systemet. Skriv HELE manuset på norsk.`
      : `You are a professional YouTube creator and scriptwriter. Generate a comprehensive, engaging YouTube script based on the following documentation:

DOCUMENTATION:
${markdown}

VIDEO STYLE: ${scriptStyle || 'tutorial'}
TARGET DURATION: ${targetDuration || '5-10 minutes'}
YOUTUBE URL: ${youtubeUrl || 'Not provided'}

REQUIREMENTS:
1. **Hook (First 15 seconds)** - Grab attention immediately
2. **Value Promise** - Tell viewers what they'll learn
3. **Structured Sections** with clear transitions
4. **Engagement Elements** - Subscribe reminders, comments, likes
5. **Call-to-Actions** - Guide viewers to next steps
6. **YouTube Best Practices** - Retention-focused writing

${includeTimestamps ? 'INCLUDE TIMESTAMPS: Add [0:00], [1:30], etc. for YouTube chapters' : ''}
${includeEngagement ? 'INCLUDE ENGAGEMENT: Add subscribe prompts, like reminders, comment questions' : ''}

FORMAT:
- Professional, conversational tone
- Clear section headings
- Actionable content
- Viewer-focused language ("you'll learn", "let me show you")
- Natural transitions between sections

Generate a complete, ready-to-use YouTube script that would work well for educational content about the documented feature or system.`

    let apiKey, result

    // Determine AI provider (default to grok if not specified)
    // Handle both 'api-worker' and 'dev-worker' as valid provider names
    let provider = aiProvider
    if (aiProvider === 'dev-worker' || aiProvider === 'api-worker') {
      provider = 'grok' // Default to grok for both worker types
    } else if (!aiProvider) {
      provider = 'grok' // Default fallback
    }

    console.log('[Worker] YouTube script generation - AI provider mapping:', {
      originalProvider: aiProvider,
      mappedProvider: provider,
      language: language || 'english',
    })

    // Call the appropriate AI model
    switch (provider) {
      case 'grok':
        apiKey = env.XAI_API_KEY
        if (!apiKey) {
          return createErrorResponse('XAI API key not configured', 500)
        }

        const grokClient = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.x.ai/v1',
        })

        const grokCompletion = await grokClient.chat.completions.create({
          model: 'grok-3-beta',
          temperature: 0.7,
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: isNorwegian
                ? 'Du er en profesjonell YouTube-skaper og manusforfatter. Lag engasjerende, pedagogiske manus som holder seere interesserte og lærer dem noe.'
                : 'You are a professional YouTube creator and scriptwriter. Create engaging, educational scripts that keep viewers watching and learning.',
            },
            { role: 'user', content: finalPrompt },
          ],
        })

        result = grokCompletion.choices[0].message.content.trim()
        break

      case 'openai':
        apiKey = env.OPENAI_API_KEY
        if (!apiKey) {
          return createErrorResponse('OpenAI API key not configured', 500)
        }

        const openaiClient = new OpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.openai.com/v1',
        })

        const openaiCompletion = await openaiClient.chat.completions.create({
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: isNorwegian
                ? 'Du er en profesjonell YouTube-skaper og manusforfatter. Lag engasjerende, pedagogiske manus som holder seere interesserte og lærer dem noe.'
                : 'You are a professional YouTube creator and scriptwriter. Create engaging, educational scripts that keep viewers watching and learning.',
            },
            { role: 'user', content: finalPrompt },
          ],
        })

        result = openaiCompletion.choices[0].message.content.trim()
        break

      default:
        return createErrorResponse('Invalid AI provider specified', 400)
    }

    // Clean up the generated script
    const cleanScript = result.trim()

    return createResponse(
      JSON.stringify({
        success: true,
        script: cleanScript,
        videoId: videoId,
        provider: provider,
        language: language || 'english',
        timestamp: new Date().toISOString(),
      }),
    )
  } catch (error) {
    console.error('YouTube script generation error:', error)
    return createErrorResponse(`YouTube script generation failed: ${error.message}`, 500)
  }
}

// Removed handleCreateSandboxBrandDomain - using direct API calls instead

// --- Update Sandman Worker Endpoint ---
const handleUpdateSandman = async (request, env) => {
  try {
    const accountId = env.CF_ACCOUNT_ID
    const apiToken = env.SANDMAN_API_TOKEN
    const workerName = 'sandman'
    const newCode = `addEventListener('fetch', event => { event.respondWith(new Response('Hello I am the Sandman')) })`

    // Debug log
    console.log(
      'Updating sandman worker at:',
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
    )

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/javascript',
        },
        body: newCode,
      },
    )
    const deployJson = await deployRes.json()
    if (!deployJson.success) {
      return createErrorResponse('Cloudflare API error: ' + JSON.stringify(deployJson.errors), 500)
    }
    return createResponse(
      JSON.stringify({
        success: true,
        message: 'Sandman worker updated successfully',
        workerName,
      }),
      200,
    )
  } catch (e) {
    return createErrorResponse('Update sandman error: ' + e.message, 500)
  }
}

// ============================================
// SUPERADMIN DOMAIN MANAGEMENT ENDPOINTS
// ============================================

// Helper function to validate Superadmin role
const validateSuperadminRole = async (request, email, env) => {
  try {
    // Get role from header (sent from userStore)
    const userRole = request.headers.get('x-user-role')

    if (!userRole || userRole !== 'Superadmin') {
      return { valid: false, error: 'Access denied: Superadmin role required' }
    }

    // Optional: Verify role matches database for extra security
    // This could be cached or done periodically rather than every request
    const db = env.vegvisr_org
    const query = `SELECT role FROM config WHERE email = ?`
    const row = await db.prepare(query).bind(email).first()

    if (!row || row.role !== 'Superadmin') {
      return { valid: false, error: 'Role verification failed' }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error validating Superadmin role:', error)
    return { valid: false, error: 'Role validation failed' }
  }
}

// GET /admin/domains - List all domains with ownership info
const handleAdminDomains = async (request, env) => {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email')

    if (!email) {
      return createErrorResponse('Missing email parameter', 400)
    }

    // Validate Superadmin role
    const roleCheck = await validateSuperadminRole(request, email, env)
    if (!roleCheck.valid) {
      return createErrorResponse(roleCheck.error, 403)
    }

    // Get all domains from KV store
    const keys = await env.BINDING_NAME.list({ prefix: 'site-config:' })
    const domains = []

    for (const key of keys.keys) {
      const domain = key.name.replace('site-config:', '')
      const config = await env.BINDING_NAME.get(key.name)

      if (config) {
        const parsedConfig = JSON.parse(config)
        domains.push({
          domain,
          owner: parsedConfig.owner || 'Unknown',
          createdAt: parsedConfig.createdAt || null,
          lastModified: parsedConfig.lastModified || null,
          hasLogo: !!parsedConfig.logo,
          hasContentFilters: !!parsedConfig.contentFilters,
          graphId: parsedConfig.graphId || null,
        })
      }
    }

    // Sort domains by owner and domain name
    domains.sort((a, b) => {
      if (a.owner !== b.owner) {
        return a.owner.localeCompare(b.owner)
      }
      return a.domain.localeCompare(b.domain)
    })

    return createResponse(JSON.stringify({ domains }))
  } catch (error) {
    console.error('Error in handleAdminDomains:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// POST /admin/transfer-domain - Transfer domain between users
const handleTransferDomain = async (request, env) => {
  try {
    const { email, domain, newOwner } = await request.json()

    if (!email || !domain || !newOwner) {
      return createErrorResponse('Missing required fields: email, domain, newOwner', 400)
    }

    // Validate Superadmin role
    const roleCheck = await validateSuperadminRole(request, email, env)
    if (!roleCheck.valid) {
      return createErrorResponse(roleCheck.error, 403)
    }

    // Get current domain config from KV store
    const kvKey = `site-config:${domain}`
    const currentConfig = await env.BINDING_NAME.get(kvKey)

    if (!currentConfig) {
      return createErrorResponse('Domain not found', 404)
    }

    const parsedConfig = JSON.parse(currentConfig)
    const oldOwner = parsedConfig.owner

    // Update domain config in KV store
    parsedConfig.owner = newOwner
    parsedConfig.lastModified = new Date().toISOString()
    parsedConfig.transferHistory = parsedConfig.transferHistory || []
    parsedConfig.transferHistory.push({
      from: oldOwner,
      to: newOwner,
      transferredBy: email,
      timestamp: new Date().toISOString(),
    })

    await env.BINDING_NAME.put(kvKey, JSON.stringify(parsedConfig))

    // Update old owner's SQL profile - remove domain from domainConfigs
    if (oldOwner) {
      const oldOwnerData = await env.vegvisr_org
        .prepare('SELECT data FROM config WHERE email = ?')
        .bind(oldOwner)
        .first()
      if (oldOwnerData && oldOwnerData.data) {
        const userData = JSON.parse(oldOwnerData.data)
        if (userData.domainConfigs) {
          userData.domainConfigs = userData.domainConfigs.filter((d) => d.domain !== domain)
          await env.vegvisr_org
            .prepare('UPDATE config SET data = ? WHERE email = ?')
            .bind(JSON.stringify(userData), oldOwner)
            .run()
        }
      }
    }

    // Update new owner's SQL profile - add domain to domainConfigs
    const newOwnerData = await env.vegvisr_org
      .prepare('SELECT data FROM config WHERE email = ?')
      .bind(newOwner)
      .first()
    let userData = { domainConfigs: [] }

    if (newOwnerData && newOwnerData.data) {
      userData = JSON.parse(newOwnerData.data)
      if (!userData.domainConfigs) {
        userData.domainConfigs = []
      }
    }

    // Add domain to new owner's profile if not already present
    if (!userData.domainConfigs.find((d) => d.domain === domain)) {
      userData.domainConfigs.push({
        domain,
        owner: newOwner,
        createdAt: parsedConfig.createdAt || new Date().toISOString(),
        lastModified: parsedConfig.lastModified,
      })
    }

    await env.vegvisr_org
      .prepare(
        `
      INSERT INTO config (email, data)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET data = ?
    `,
      )
      .bind(newOwner, JSON.stringify(userData), JSON.stringify(userData))
      .run()

    return createResponse(
      JSON.stringify({
        success: true,
        message: `Domain ${domain} transferred from ${oldOwner} to ${newOwner}`,
        domain,
        oldOwner,
        newOwner,
      }),
    )
  } catch (error) {
    console.error('Error in handleTransferDomain:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// POST /admin/share-template - Share domain template
const handleShareTemplate = async (request, env) => {
  try {
    const { email, sourceDomain, targetDomain, targetOwner, includeContent } = await request.json()

    if (!email || !sourceDomain || !targetDomain || !targetOwner) {
      return createErrorResponse(
        'Missing required fields: email, sourceDomain, targetDomain, targetOwner',
        400,
      )
    }

    // Validate Superadmin role
    const roleCheck = await validateSuperadminRole(request, email, env)
    if (!roleCheck.valid) {
      return createErrorResponse(roleCheck.error, 403)
    }

    // Get source domain config
    const sourceConfig = await env.BINDING_NAME.get(`site-config:${sourceDomain}`)
    if (!sourceConfig) {
      return createErrorResponse('Source domain not found', 404)
    }

    const parsedSourceConfig = JSON.parse(sourceConfig)

    // Create template config for target domain
    const templateConfig = {
      domain: targetDomain,
      owner: targetOwner,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      templateSource: sourceDomain,
      templateCreatedBy: email,
      logo: parsedSourceConfig.logo || null,
      contentFilters: parsedSourceConfig.contentFilters || null,
      graphId: includeContent ? parsedSourceConfig.graphId : null,
      templateHistory: [
        {
          sourceTemplate: sourceDomain,
          createdBy: email,
          timestamp: new Date().toISOString(),
          includeContent: !!includeContent,
        },
      ],
    }

    // Save template to KV store
    await env.BINDING_NAME.put(`site-config:${targetDomain}`, JSON.stringify(templateConfig))

    // Update target owner's SQL profile
    const targetOwnerData = await env.vegvisr_org
      .prepare('SELECT data FROM config WHERE email = ?')
      .bind(targetOwner)
      .first()
    let userData = { domainConfigs: [] }

    if (targetOwnerData && targetOwnerData.data) {
      userData = JSON.parse(targetOwnerData.data)
      if (!userData.domainConfigs) {
        userData.domainConfigs = []
      }
    }

    // Add domain to target owner's profile if not already present
    if (!userData.domainConfigs.find((d) => d.domain === targetDomain)) {
      userData.domainConfigs.push({
        domain: targetDomain,
        owner: targetOwner,
        createdAt: templateConfig.createdAt,
        lastModified: templateConfig.lastModified,
        templateSource: sourceDomain,
      })
    }

    await env.vegvisr_org
      .prepare(
        `
      INSERT INTO config (email, data)
      VALUES (?, ?)
      ON CONFLICT(email) DO UPDATE SET data = ?
    `,
      )
      .bind(targetOwner, JSON.stringify(userData), JSON.stringify(userData))
      .run()

    return createResponse(
      JSON.stringify({
        success: true,
        message: `Template shared from ${sourceDomain} to ${targetDomain} for ${targetOwner}`,
        sourceDomain,
        targetDomain,
        targetOwner,
        includeContent: !!includeContent,
      }),
    )
  } catch (error) {
    console.error('Error in handleShareTemplate:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// DELETE /admin/remove-domain - Remove domain from system
const handleRemoveDomain = async (request, env) => {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get('email')
    const domain = url.searchParams.get('domain')

    if (!email || !domain) {
      return createErrorResponse('Missing required parameters: email, domain', 400)
    }

    // Validate Superadmin role
    const roleCheck = await validateSuperadminRole(request, email, env)
    if (!roleCheck.valid) {
      return createErrorResponse(roleCheck.error, 403)
    }

    // Get domain config to identify owner
    const kvKey = `site-config:${domain}`
    const currentConfig = await env.BINDING_NAME.get(kvKey)

    if (!currentConfig) {
      return createErrorResponse('Domain not found', 404)
    }

    const parsedConfig = JSON.parse(currentConfig)
    const owner = parsedConfig.owner

    // Remove domain from KV store
    await env.BINDING_NAME.delete(kvKey)

    // Update owner's SQL profile - remove domain from domainConfigs
    if (owner) {
      const ownerData = await env.vegvisr_org
        .prepare('SELECT data FROM config WHERE email = ?')
        .bind(owner)
        .first()
      if (ownerData && ownerData.data) {
        const userData = JSON.parse(ownerData.data)
        if (userData.domainConfigs) {
          userData.domainConfigs = userData.domainConfigs.filter((d) => d.domain !== domain)
          await env.vegvisr_org
            .prepare('UPDATE config SET data = ? WHERE email = ?')
            .bind(JSON.stringify(userData), owner)
            .run()
        }
      }
    }

    return createResponse(
      JSON.stringify({
        success: true,
        message: `Domain ${domain} removed from system`,
        domain,
        owner,
        removedBy: email,
      }),
    )
  } catch (error) {
    console.error('Error in handleRemoveDomain:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

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
    if (pathname === '/claude-test' && request.method === 'POST') {
      return await handleClaudeTest(request, env)
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
    if (pathname === '/ai-generate-menu' && request.method === 'POST') {
      return await handleAIGenerateMenu(request, env)
    }

    if (pathname === '/ai-generate-quotes' && request.method === 'POST') {
      return await handleAIGenerateQuotes(request, env)
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

    // Placeholder endpoints to prevent 404 errors
    if (pathname === '/user-preferences') {
      return createResponse(
        JSON.stringify({
          message: 'User preferences endpoint not yet implemented',
          preferences: {},
        }),
        200,
      )
    }

    if (pathname === '/ai-node-history') {
      return createResponse(
        JSON.stringify({
          message: 'AI node history endpoint not yet implemented',
          history: [],
        }),
        200,
      )
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

    if (pathname === '/get-sandbox-code' && request.method === 'GET') {
      return await handleGetSandboxCode(request, env)
    }

    if (pathname === '/generate-worker' && request.method === 'POST') {
      return await handleGenerateWorker(request, env)
    }

    if (pathname === '/generate-youtube-script' && request.method === 'POST') {
      return await handleGenerateYouTubeScript(request, env)
    }

    if (pathname === '/update-sandman' && request.method === 'POST') {
      return await handleUpdateSandman(request, env)
    }

    // Add new admin endpoints before the fallback
    if (pathname === '/admin/domains' && request.method === 'GET') {
      return await handleAdminDomains(request, env)
    }

    if (pathname === '/admin/transfer-domain' && request.method === 'POST') {
      return await handleTransferDomain(request, env)
    }

    if (pathname === '/admin/share-template' && request.method === 'POST') {
      return await handleShareTemplate(request, env)
    }

    if (pathname === '/admin/remove-domain' && request.method === 'DELETE') {
      return await handleRemoveDomain(request, env)
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
