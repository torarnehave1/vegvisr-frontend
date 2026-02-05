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
      'SELECT user_id, Role, email FROM config WHERE emailVerificationToken = ?'
    ).bind(apiToken).first()

    if (!userRecord) {
      return { valid: false, error: 'Invalid authentication token' }
    }

    return {
      valid: true,
      userId: userRecord.user_id,
      email: userRecord.email || null,
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

const appendAuditEntry = (existing, entry) => {
  const log = Array.isArray(existing?.auditLog) ? existing.auditLog : []
  const next = [...log, entry]
  return next.slice(-100)
}

const appendSuperadminAuditEntry = (existing, entry) => {
  const log = Array.isArray(existing?.superadminAuditLog) ? existing.superadminAuditLog : []
  const next = [...log, entry]
  return next.slice(-100)
}

const buildAlbumRecord = ({ name, images, existing, createdBy, auditEntry, isSuperadmin, seo, isShared }) => {
  const now = new Date().toISOString()
  const base = existing && typeof existing === 'object' ? existing : {}
  return {
    name,
    images,
    createdAt: base.createdAt || now,
    createdBy: createdBy ?? base.createdBy ?? null,
    seoTitle: seo?.title ?? base.seoTitle ?? null,
    seoDescription: seo?.description ?? base.seoDescription ?? null,
    seoImageKey: seo?.imageKey ?? base.seoImageKey ?? null,
    isShared: isShared ?? base.isShared ?? false,
    updatedAt: now,
    lastModifiedBy: auditEntry?.actor || base.lastModifiedBy || null,
    lastModifiedRole: auditEntry?.actorRole || base.lastModifiedRole || null,
    lastModifiedAction: auditEntry?.action || base.lastModifiedAction || null,
    auditLog: auditEntry ? appendAuditEntry(base, auditEntry) : base.auditLog || [],
    superadminAuditLog:
      auditEntry && isSuperadmin ? appendSuperadminAuditEntry(base, auditEntry) : base.superadminAuditLog || []
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
  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
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
  const auth = await validateAuth(request, env)
  if (!auth.valid) {
    return createErrorResponse(auth.error, 401)
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
  const images = Array.isArray(body?.images) ? body.images.filter(Boolean) : []
  const seo = {
    title: typeof body?.seoTitle === 'string' ? body.seoTitle.trim() || null : undefined,
    description: typeof body?.seoDescription === 'string' ? body.seoDescription.trim() || null : undefined,
    imageKey: typeof body?.seoImageKey === 'string' ? body.seoImageKey.trim() || null : undefined
  }
  const isShared = typeof body?.isShared === 'boolean' ? body.isShared : undefined
  const existing = await readPhotoAlbum(env, name)
  const auditEntry = {
    action: existing ? 'update_album' : 'create_album',
    actor: auth.email || auth.userId,
    actorRole: auth.role || null,
    at: new Date().toISOString(),
    details: {
      imageCount: images.length
    }
  }
  if (auth.role !== 'Superadmin' && existing?.createdBy && existing.createdBy !== auth.userId && existing.createdBy !== auth.email) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const album = buildAlbumRecord({
    name,
    images,
    existing,
    createdBy: auth.email || auth.userId,
    auditEntry,
    isSuperadmin: auth.role === 'Superadmin',
    seo,
    isShared
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
  const auditEntry = {
    action: 'add_images',
    actor: auth.email || auth.userId,
    actorRole: auth.role || null,
    at: new Date().toISOString(),
    details: {
      added: incoming.length
    }
  }
  if (auth.role !== 'Superadmin' && existing?.createdBy && existing.createdBy !== auth.userId && existing.createdBy !== auth.email) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const merged = [...new Set([...(existing.images || []), ...incoming])]
  const album = buildAlbumRecord({
    name,
    images: merged,
    existing,
    auditEntry,
    isSuperadmin: auth.role === 'Superadmin'
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
  const auditEntry = {
    action: 'remove_images',
    actor: auth.email || auth.userId,
    actorRole: auth.role || null,
    at: new Date().toISOString(),
    details: {
      removed: incoming.length
    }
  }
  if (auth.role !== 'Superadmin' && existing?.createdBy && existing.createdBy !== auth.userId && existing.createdBy !== auth.email) {
    return createErrorResponse('Unauthorized to modify this album', 403)
  }
  const toRemove = new Set(incoming)
  const updated = (existing.images || []).filter((key) => !toRemove.has(key))
  const updatedSeo =
    existing?.seoImageKey && !updated.includes(existing.seoImageKey)
      ? { imageKey: updated[0] || null }
      : {}
  const album = buildAlbumRecord({
    name,
    images: updated,
    existing,
    auditEntry,
    isSuperadmin: auth.role === 'Superadmin',
    seo: updatedSeo
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
  if (auth.role !== 'Superadmin' && existing?.createdBy && existing.createdBy !== auth.userId && existing.createdBy !== auth.email) {
    return createErrorResponse('Unauthorized to delete this album', 403)
  }
  if (existing) {
    const auditEntry = {
      action: 'delete_album',
      actor: auth.email || auth.userId,
      actorRole: auth.role || null,
      at: new Date().toISOString(),
      details: {
        imageCount: Array.isArray(existing.images) ? existing.images.length : 0
      }
    }
    const auditPayload = buildAlbumRecord({
      name,
      images: existing.images || [],
      existing,
      createdBy: existing.createdBy,
      auditEntry,
      isSuperadmin: auth.role === 'Superadmin'
    })
    await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(auditPayload))
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
