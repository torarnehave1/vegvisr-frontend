const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Token'
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

const validateAuth = async (request, env) => {
  const apiToken = request.headers.get('X-API-Token')
  if (!apiToken) {
    return { valid: false, error: 'Missing X-API-Token header' }
  }

  try {
    const userRecord = await env.vegvisr_org.prepare(
      'SELECT user_id, Role FROM config WHERE emailVerificationToken = ?'
    ).bind(apiToken).first()

    if (!userRecord) {
      return { valid: false, error: 'Invalid authentication token' }
    }

    return {
      valid: true,
      userId: userRecord.user_id,
      role: userRecord.Role
    }
  } catch (error) {
    return { valid: false, error: 'Authentication error' }
  }
}

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

const buildAlbumRecord = ({ name, images, existing, createdBy }) => {
  const now = new Date().toISOString()
  const base = existing && typeof existing === 'object' ? existing : {}
  return {
    name,
    images,
    createdAt: base.createdAt || now,
    createdBy: createdBy ?? base.createdBy ?? null,
    updatedAt: now
  }
}

const summarizeAlbum = (name, record) => {
  if (!record || typeof record !== 'object') {
    return { name, createdBy: null, createdAt: null, updatedAt: null }
  }
  return {
    name,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null
  }
}

const handleListPhotoAlbums = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }
  const url = new URL(request.url)
  const includeMeta = url.searchParams.get('includeMeta') === '1'
  const list = await env.PHOTO_ALBUMS.list({ prefix: PHOTO_ALBUM_PREFIX })
  if (!includeMeta) {
    const albums = list.keys.map((key) => key.name.slice(PHOTO_ALBUM_PREFIX.length))
    return createResponse(JSON.stringify({ albums }), 200)
  }

  const albums = await Promise.all(
    list.keys.map(async (key) => {
      const name = key.name.slice(PHOTO_ALBUM_PREFIX.length)
      const record = await readPhotoAlbum(env, name)
      return summarizeAlbum(name, record)
    })
  )
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

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
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
  const existing = await readPhotoAlbum(env, name)
  if (existing?.createdBy && existing.createdBy !== auth.userId) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : []
  const album = buildAlbumRecord({
    name,
    images,
    existing,
    createdBy: auth.userId
  })
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleAddPhotoAlbumImages = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
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
  if (existing?.createdBy && existing.createdBy !== auth.userId) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const merged = [...new Set([...(existing.images || []), ...incoming])]
  const album = buildAlbumRecord({
    name,
    images: merged,
    existing
  })
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleRemovePhotoAlbumImages = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
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
  if (existing?.createdBy && existing.createdBy !== auth.userId) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const toRemove = new Set(incoming)
  const updated = (existing.images || []).filter((key) => !toRemove.has(key))
  const album = buildAlbumRecord({
    name,
    images: updated,
    existing
  })
  await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(album))
  return createResponse(JSON.stringify(album), 200)
}

const handleDeletePhotoAlbum = async (request, env) => {
  if (!env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }

  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
  }

  const url = new URL(request.url)
  const name = normalizeAlbumName(url.searchParams.get('name'))
  if (!name) {
    return createErrorResponse('Album name is required', 400)
  }
  const existing = await readPhotoAlbum(env, name)
  if (existing?.createdBy && existing.createdBy !== auth.userId) {
    return createErrorResponse('Unauthorized to delete this album', 403)
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
