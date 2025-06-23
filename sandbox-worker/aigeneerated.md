addEventListener('fetch', event => {
event.respondWith(handleRequest(event.request, event.env))
})

async function handleRequest(request, env) {
const url = new URL(request.url)
const pathname = url.pathname

// Handle CORS preflight request
if (request.method === 'OPTIONS') {
return new Response(null, {
status: 204,
headers: {
'Access-Control-Allow-Origin': '\*', // Restrict this in production
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
'Access-Control-Max-Age': '86400'
}
})
}

try {
if (pathname === '/debug') {
return handleDebug(env)
}
if (pathname === '/' || pathname === '/search') {
return handlePexelsSearch(request, env)
}
return new Response(
JSON.stringify({
message: 'Pexels API Worker',
endpoints: {
'/': 'Pexels image search',
'/search': 'Pexels image search',
'/debug': 'Debug environment variables'
},
usage: {
search: '/?query=nature&per_page=10',
debug: '/debug'
},
timestamp: new Date().toISOString()
}),
{
status: 200,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '_' // Restrict this in production
}
}
)
} catch (error) {
return new Response(
JSON.stringify({
error: 'Internal server error',
message: error.message,
timestamp: new Date().toISOString()
}),
{
status: 500,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '_' // Restrict this in production
}
}
)
}
}

async function handleDebug(env) {
const envInfo = {
pexels_api_key: env.PEXELS_API_KEY ? 'available' : 'missing',
timestamp: new Date().toISOString()
}
return new Response(JSON.stringify(envInfo, null, 2), {
status: 200,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '\*' // Restrict this in production
}
})
}

async function handlePexelsSearch(request, env) {
const url = new URL(request.url)
const query = sanitizeInput(url.searchParams.get('query') || url.searchParams.get('q') || 'nature')
const perPage = sanitizeInput(url.searchParams.get('per_page') || '10')
const page = sanitizeInput(url.searchParams.get('page') || '1')

if (!env.PEXELS_API_KEY) {
return new Response(
JSON.stringify({
error: 'Pexels API key not configured',
message: 'PEXELS_API_KEY environment variable is missing'
}),
{
status: 500,
headers: {
'Content-Type': 'application/json',
'Access-Control-Allow-Origin': '\*' // Restrict this in production
}
}
)
}

const cacheKey = new Request(`https://api.pexels.com/v1/search?query=${query}&per_page=${perPage}&page=${page}`, request)
const cache = caches.default

let response = await cache.match(cacheKey)

if (!response) {
try {
const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}`
response = await fetch(pexelsUrl, {
headers: {
Authorization: env.PEXELS_API_KEY
}
})

      if (!response.ok) {
        throw new Error(`Pexels API error: ${response.status} ${response.statusText}`)
      }

      response = new Response(response.body, response)
      response.headers.append('Cache-Control', 's-maxage=120, stale-while-revalidate=60')
      event.waitUntil(cache.put(cacheKey, response.clone()))
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Pexels search failed',
          message: error.message,
          query,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Restrict this in production
          }
        }
      )
    }

}

return response
}

function sanitizeInput(input) {
return input.replace(/[^a-zA-Z0-9\s]/g, '')
}
