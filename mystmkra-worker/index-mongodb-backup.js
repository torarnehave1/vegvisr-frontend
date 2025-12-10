/**
 * Mystmkra Worker - Markdown File Search
 * Connects to existing MongoDB database from mystmkra.io
 */

import { MongoClient, ObjectId } from 'mongodb'

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-email, x-user-role, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

// Timeout wrapper for database operations
async function withTimeout(promise, timeoutMs = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ])
}

// MongoDB connection (reuse connection across requests)
let cachedClient = null
let cachedDb = null
let connectPromise = null

async function connectToDatabase(env) {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const client = new MongoClient(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,  // Increased from 15s for Atlas wake-up
        socketTimeoutMS: 30000,            // Increased from 20s
        connectTimeoutMS: 30000,           // Added explicit connect timeout
        maxPoolSize: 5,
        minPoolSize: 1,
      })

      await client.connect()
      const db = client.db(env.MONGODB_DB_NAME || 'slowyounet')

      cachedClient = client
      cachedDb = db
      console.log('[MongoDB] Connected successfully')
      return { client, db }
    })().catch(err => {
      // Reset promise so future attempts can retry
      connectPromise = null
      console.error('[MongoDB] Connection failed:', err.message)
      throw err
    })
  }

  return connectPromise
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const corsHeaders = getCorsHeaders(origin)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      })
    }

    try {
      // Connect to MongoDB with timeout (increased for Atlas wake-up)
      const { db } = await withTimeout(connectToDatabase(env), 35000)

      // Route handling
      if (url.pathname === '/search' && request.method === 'GET') {
        return handleSearch(request, db, corsHeaders)
      }

      if (url.pathname.startsWith('/file/') && request.method === 'GET') {
        return handleGetFile(request, db, corsHeaders)
      }

      if (url.pathname === '/files' && request.method === 'GET') {
        return handleListFiles(request, db, corsHeaders)
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({ success: true, status: 'healthy', database: 'connected' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders })
    } catch (error) {
      console.error('Request error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  },
}

async function handleSearch(request, db, corsHeaders) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  if (!query) {
    return new Response(
      JSON.stringify({ success: false, error: 'Search query is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Avoid running expensive queries on very short inputs
  if (query.trim().length < 2) {
    return new Response(
      JSON.stringify({ success: true, results: [], message: 'Query too short' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const collection = db.collection('mdfiles')
    let results

    // Check if query is a MongoDB ObjectId (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(query.trim())) {
      console.log('ID search:', query)
      try {
        const result = await withTimeout(
          collection.findOne(
            { _id: new ObjectId(query.trim()) },
            { projection: { _id: 1, title: 1, content: 1, tags: 1 } }  // Exclude embeddings
          ),
          15000
        )
        results = result ? [result] : []
      } catch (idError) {
        console.error('Invalid ObjectId:', idError)
        results = []
      }
    } else if (query.startsWith('#')) {
      console.log('Tag search:', query)
      results = await withTimeout(
        collection
          .find({ tags: query.trim() })
          .project({ _id: 1, title: 1, content: 1, tags: 1 })
          .limit(50)
          .toArray(),
        15000
      )
    } else {
      console.log('Content search:', query)
      results = await withTimeout(
        collection
          .find({ content: { $regex: query, $options: 'i' } })
          .project({ _id: 1, title: 1, content: 1, tags: 1 })
          .limit(50)
          .toArray(),
        15000
      )
    }

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], message: 'No results found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resultsWithAbstracts = results.map(result => {
      const content = result.content || ''
      let plainText = content
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/!\[.+?\]\(.+?\)/g, '')
        .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/<[^>]*>/g, '')
        .trim()

      const abstract = plainText.substring(0, 100) + (plainText.length > 100 ? '...' : '')

      return {
        id: result._id.toString(),
        title: result.title || 'Untitled',
        abs: abstract,
        tags: result.tags || []
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: resultsWithAbstracts,
        count: resultsWithAbstracts.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Search error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleGetFile(request, db, corsHeaders) {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const fileId = pathParts[2]

  if (!fileId) {
    return new Response(
      JSON.stringify({ success: false, error: 'File ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const collection = db.collection('mdfiles')
    
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(fileId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid file ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const result = await withTimeout(
      collection.findOne(
        { _id: new ObjectId(fileId) },
        { projection: { embeddings: 0 } }  // Exclude embeddings array to reduce size
      ),
      10000  // 10 seconds for individual file fetch
    )

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: 'File not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const file = {
      id: result._id.toString(),
      title: result.title,
      content: result.content,
      tags: result.tags || [],
      author: result.author,
      imgURL: result.ImgURL,
      published: result.published,
      locked: result.locked,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    }

    return new Response(
      JSON.stringify({ success: true, file }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get file error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleListFiles(request, db, corsHeaders) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  try {
    const collection = db.collection('mdfiles')
    const results = await withTimeout(
      collection
        .find({ $or: [{ locked: { $exists: false } }, { locked: false }] })
        .project({ _id: 1, title: 1, tags: 1, createdAt: 1, updatedAt: 1, published: 1 })
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      15000
    )

    const files = results.map(file => ({
      id: file._id.toString(),
      title: file.title || 'Untitled',
      tags: file.tags || [],
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      published: file.published || false
    }))

    return new Response(
      JSON.stringify({ 
        success: true, 
        files,
        count: files.length,
        limit,
        offset
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('List files error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
