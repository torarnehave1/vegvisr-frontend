// @name api-worker
// @description A Cloudflare Worker script to handle various API endpoints for a blog application.
// @version 1.0
// @author Tor Arne Håve
// @license MIT

import { marked } from 'marked'
import { OpenAI } from 'openai'

// Utility functions
const corsHeaders = {
'Access-Control-Allow-Origin': '\*',
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

    // Detailed logging before parsing
    console.log('AI completion object:', completion)
    console.log('AI completion.choices:', completion.choices)
    if (completion.choices && completion.choices[0]) {
      console.log('AI completion.choices[0]:', completion.choices[0])
      if (completion.choices[0].message) {
        console.log('AI completion.choices[0].message:', completion.choices[0].message)
        if (completion.choices[0].message.content) {
          console.log(
            'AI completion.choices[0].message.content:',
            completion.choices[0].message.content,
          )
        } else {
          console.error('No message.content in AI response')
        }
      } else {
        console.error('No message in AI response')
      }
    } else {
      console.error('No choices[0] in AI response')
    }

    let result
    try {
      result = JSON.parse(completion.choices[0].message.content.trim())
    } catch (error) {
      console.error('Error parsing AI response:', error)
      console.error('AI completion object:', completion)
      console.error('AI completion.choices:', completion.choices)
      if (completion.choices && completion.choices[0]) {
        console.error('AI completion.choices[0]:', completion.choices[0])
        if (completion.choices[0].message) {
          console.error('AI completion.choices[0].message:', completion.choices[0].message)
          if (completion.choices[0].message.content) {
            console.error(
              'AI completion.choices[0].message.content:',
              completion.choices[0].message.content,
            )
          } else {
            console.error('No message.content in AI response (error block)')
          }
        } else {
          console.error('No message in AI response (error block)')
        }
      } else {
        console.error('No choices[0] in AI response (error block)')
      }
      return createErrorResponse('Invalid response format from AI model', 500)
    }

    // Create the node using the selected template's structure
    const node = {
      id: crypto.randomUUID(),
      label: result.label || 'New Node',
      color: result.color || '#D2691E',
      type: result.type || 'fulltext',
      info: result.content,
      bibl: result.bibl || [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: '',
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
      node.path = infoObj.path || ''
    }

    // For worknote type, format the content with user's email
    if (node.type === 'worknote') {
      node.info = formatWorknoteContent(node.info, userEmail)
    }

    // Create a clean node object with only the required fields
    const cleanNode = {
      id: node.id,
      label: node.label,
      color: node.color,
      type: node.type,
      info: node.info,
      bibl: node.bibl,
      imageWidth: node.imageWidth,
      imageHeight: node.imageHeight,
      visible: node.visible,
      path: node.path,
    }

    return createResponse(JSON.stringify({ node: cleanNode }))

} catch (error) {
console.error('Error in handleGrokIssueDescription:', error)
return createErrorResponse('Failed to generate node', 500)
}
}

// Helper function to format worknote content
const formatWorknoteContent = (content, userEmail) => {
if (!userEmail) return content

const emailUsername = userEmail.split('@')[0]
const currentDate = new Date().toISOString().split('T')[0]
const infoLines = content.split('\n')

// Update the first line with the correct format if it exists
if (infoLines.length > 0) {
infoLines[0] = `${currentDate}: @${emailUsername} - ${infoLines[0].split('-').slice(1).join('-').trim()}`
}

return infoLines.join('\n')
}

const handleAIGenerateNode = async (request, env) => {
try {
const { userRequest, graphContext, userEmail } = await request.json()
if (!userRequest) {
return createErrorResponse('Missing userRequest parameter', 400)
}
if (!userEmail) {
return createErrorResponse('Missing userEmail parameter', 400)
}

    // Default template for fulltext nodes
    const defaultFulltextTemplate = {
      id: 'template_fulltext_node',
      label: 'Template: Fulltext Node',
      color: '#D2691E',
      type: 'fulltext',
      info: '[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]\nTitle\n[END FANCY]\n\n![Header|height: 200px; object-fit: cover; object-position: center](https://vegvisr.imgix.net/HEADERIMG.png)\n\n## Introduction\n\n[SECTION | background-color:#FFFBE6; color:#000]\nMain content goes here. You can include regular markdown formatting like **bold**, *italic*, and `code`.\n[END SECTION]\n\n[QUOTE | Cited=Author Name]\nImportant quote or citation goes here.\n[END QUOTE]\n\n## Key Points\n\n1. First point\n2. Second point\n3. Third point\n\n[SECTION | background-color:#E7F7F7; color:#111]\nAdditional content section\n[END SECTION]',
      bibl: ['Source: Template Example'],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: '',
      ai_instructions:
        'Generate a well-structured fulltext node with a title, introduction, key points, and supporting sections. Include appropriate formatting and styling.',
    }

    // Get templates from knowledge worker
    let templates = [defaultFulltextTemplate]
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
      if (templatesData.results && Array.isArray(templatesData.results)) {
        templates = templatesData.results
        console.log('Successfully fetched templates:', templates)
      } else {
        console.log('No templates found, using default template')
      }
    } catch (error) {
      console.error('Detailed error fetching templates:', error)
      console.log('Using default template due to error')
    }

    // Create the prompt with all context
    const prompt = `Given the following user request and available templates, generate an appropriate node.

User Request: ${userRequest}

Available Templates:
${templates
.map(
(t) => `Template: ${t.label}
Type: ${t.type}
Example Node: ${JSON.stringify(t, null, 2)}
AI Instructions: ${t.ai_instructions || 'No specific instructions provided.'}`,
)
.join('\n')}

${
  graphContext && graphContext.nodes
    ? `\nContext from current graph (ID: ${graphContext.id}):
${graphContext.nodes
.map(
(node) => `Node: ${node.label}
Type: ${node.type}
Content: ${node.info || ''}`,
)
.join('\n')}`
: ''
}

Based on the user's request and the context provided, generate a node following the template structure.
You MUST return a valid JSON object with the following structure:
{
"label": "The title of the node",
"type": "fulltext",
"color": "#D2691E",
"content": "The main content following the template structure",
"bibl": ["Source 1", "Source 2"],
"reasoning": "Brief explanation of why this content was generated"
}

The content should follow the template structure with proper formatting. Do not include any text outside the JSON object.`

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
            'You are an expert at generating well-structured content for knowledge graphs. You must always return a valid JSON object with the specified structure. Do not include any text outside the JSON object.',
        },
        { role: 'user', content: prompt },
      ],
    })

    let result
    try {
      result = JSON.parse(completion.choices[0].message.content.trim())
    } catch (error) {
      console.error('Error parsing AI response:', error)
      return createErrorResponse('Invalid response format from AI model', 500)
    }

    // Create the node using the selected template's structure
    const node = {
      id: crypto.randomUUID(),
      label: result.label || 'New Node',
      color: result.color || '#D2691E',
      type: result.type || 'fulltext',
      info: result.content,
      bibl: result.bibl || [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: '',
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
      node.path = infoObj.path || ''
    }

    // For worknote type, format the content with user's email
    if (node.type === 'worknote') {
      node.info = formatWorknoteContent(node.info, userEmail)
    }

    // Create a clean node object with only the required fields
    const cleanNode = {
      id: node.id,
      label: node.label,
      color: node.color,
      type: node.type,
      info: node.info,
      bibl: node.bibl,
      imageWidth: node.imageWidth,
      imageHeight: node.imageHeight,
      visible: node.visible,
      path: node.path,
    }

    return createResponse(JSON.stringify({ node: cleanNode }))

} catch (error) {
console.error('Error in handleAIGenerateNode:', error)
return createErrorResponse('Failed to generate node', 500)
}
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

    if (pathname === '/ai-generate-node' && request.method === 'POST') {
      return await handleAIGenerateNode(request, env)
    }

    // Fallback
    return createErrorResponse('Not Found', 404)

},
}
