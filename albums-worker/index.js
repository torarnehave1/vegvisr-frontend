const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers }
  })
}

const createErrorResponse = (message, status) => {
  return createResponse(JSON.stringify({ error: message }), status)
}

const PHOTO_ALBUM_PREFIX = 'album:'

const normalizeAlbumName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return ''
  return rawName.trim()
}

const buildAlbumKey = (name) => `${PHOTO_ALBUM_PREFIX}${name}`

const readPhotoAlbum = async (env, rawName) => {
  if (!env.PHOTO_ALBUMS) return null
  const name = normalizeAlbumName(rawName)
  if (!name) return null
  const stored = await env.PHOTO_ALBUMS.get(buildAlbumKey(name))
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

const handleListPhotoAlbums = async (_request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  const list = await env.PHOTO_ALBUMS.list({ prefix: PHOTO_ALBUM_PREFIX })
  const albums = list.keys.map((key) => key.name.slice(PHOTO_ALBUM_PREFIX.length))
  return createResponse(JSON.stringify({ albums }), 200)
}

const handleGetPhotoAlbum = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  const url = new URL(request.url)
  const name = normalizeAlbumName(url.searchParams.get('name'))
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  const album = await readPhotoAlbum(env, name)
  if (!album) {
    return createErrorResponse('Album not found', 404)
  }
  return createResponse(JSON.stringify(album), 200)
}

const handleUpsertPhotoAlbum = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const name = normalizeAlbumName(body?.name)
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : []
  const album = {
    name,
    images,
    updatedAt: new Date().toISOString()
  }
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleAddPhotoAlbumImages = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const name = normalizeAlbumName(body?.name)
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  const incoming = Array.isArray(body?.images)
    ? body.images.filter(Boolean)
    : body?.image
      ? [body.image]
      : []
  if (incoming.length === 0) {
    return createErrorResponse('No images provided', 400)
  }
  const existing = (await readPhotoAlbum(env, name)) || { name, images: [] }
  const merged = [...new Set([...existing.images, ...incoming])]
  const album = {
    name,
    images: merged,
    updatedAt: new Date().toISOString()
  }
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleRemovePhotoAlbumImages = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const name = normalizeAlbumName(body?.name)
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  const incoming = Array.isArray(body?.images)
    ? body.images.filter(Boolean)
    : body?.image
      ? [body.image]
      : []
  if (incoming.length === 0) {
    return createErrorResponse('No images provided', 400)
  }
  const existing = await readPhotoAlbum(env, name)
  if (!existing) {
    return createErrorResponse('Album not found', 404)
  }
  const toRemove = new Set(incoming)
  const updated = existing.images.filter((key) => !toRemove.has(key))
  const album = {
    name,
    images: updated,
    updatedAt: new Date().toISOString()
  }
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleDeletePhotoAlbum = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  const url = new URL(request.url)
  const name = normalizeAlbumName(url.searchParams.get('name'))
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  await env.PHOTO_ALBUMS.delete(buildAlbumKey(name))
  return createResponse(JSON.stringify({ deleted: name }), 200)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (pathname === '/health' && request.method === 'GET') {
      return createResponse(JSON.stringify({ ok: true, service: 'albums-worker' }), 200)
    }

    if (pathname === '/photo-albums' && request.method === 'GET') {
      return await handleListPhotoAlbums(request, env)
    }
    if (pathname === '/photo-album' && request.method === 'GET') {
      return await handleGetPhotoAlbum(request, env)
    }
    if (pathname === '/photo-album' && request.method === 'POST') {
      return await handleUpsertPhotoAlbum(request, env)
    }
    if (pathname === '/photo-album' && request.method === 'DELETE') {
      return await handleDeletePhotoAlbum(request, env)
    }
    if (pathname === '/photo-album/add' && request.method === 'POST') {
      return await handleAddPhotoAlbumImages(request, env)
    }
    if (pathname === '/photo-album/remove' && request.method === 'POST') {
      return await handleRemovePhotoAlbumImages(request, env)
    }

    return createErrorResponse('Not found', 404)
  }
}
