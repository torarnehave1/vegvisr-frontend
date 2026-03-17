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
    shareId: base.shareId ?? null,
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
  const shouldRegenerateShareId = !!body?.regenerateShareId
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
  if (album.isShared) {
    if (shouldRegenerateShareId || !album.shareId) {
      album.shareId = crypto.randomUUID()
    }
  }
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

    if (pathname === '/openapi.json' && request.method === 'GET') {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'Albums Worker API',
          version: '1.0.0',
          description: 'Cloudflare Worker API for managing photo albums stored in KV. All mutating endpoints require X-API-Token authentication.'
        },
        servers: [{ url: '/' }],
        components: {
          securitySchemes: {
            ApiToken: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Token',
              description: 'Authentication token (emailVerificationToken from config table)'
            }
          },
          schemas: {
            Error: {
              type: 'object',
              properties: {
                error: { type: 'string' }
              },
              required: ['error']
            },
            AuditEntry: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['create_album', 'update_album', 'add_images', 'remove_images', 'delete_album'] },
                actor: { type: 'string' },
                actorRole: { type: 'string', nullable: true },
                at: { type: 'string', format: 'date-time' },
                details: { type: 'object' }
              }
            },
            Album: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                images: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string', format: 'date-time' },
                createdBy: { type: 'string', nullable: true },
                seoTitle: { type: 'string', nullable: true },
                seoDescription: { type: 'string', nullable: true },
                seoImageKey: { type: 'string', nullable: true },
                isShared: { type: 'boolean' },
                shareId: { type: 'string', nullable: true },
                updatedAt: { type: 'string', format: 'date-time' },
                lastModifiedBy: { type: 'string', nullable: true },
                lastModifiedRole: { type: 'string', nullable: true },
                lastModifiedAction: { type: 'string', nullable: true },
                auditLog: { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } },
                superadminAuditLog: { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } }
              }
            },
            AlbumSummary: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                createdBy: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time', nullable: true },
                updatedAt: { type: 'string', format: 'date-time', nullable: true }
              }
            }
          }
        },
        paths: {
          '/health': {
            get: {
              summary: 'Health check',
              operationId: 'getHealth',
              responses: {
                '200': {
                  description: 'Service is healthy',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          ok: { type: 'boolean', example: true },
                          service: { type: 'string', example: 'albums-worker' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/openapi.json': {
            get: {
              summary: 'OpenAPI specification',
              operationId: 'getOpenApiSpec',
              responses: {
                '200': {
                  description: 'OpenAPI 3.0 JSON specification',
                  content: { 'application/json': { schema: { type: 'object' } } }
                }
              }
            }
          },
          '/photo-albums': {
            get: {
              summary: 'List all photo albums',
              operationId: 'listPhotoAlbums',
              security: [{ ApiToken: [] }],
              parameters: [
                {
                  name: 'includeMeta',
                  in: 'query',
                  required: false,
                  description: 'Set to "1" to include album metadata (createdBy, createdAt, updatedAt) for each album instead of just names',
                  schema: { type: 'string', enum: ['0', '1'] }
                }
              ],
              responses: {
                '200': {
                  description: 'List of albums',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          albums: {
                            type: 'array',
                            items: {
                              oneOf: [
                                { type: 'string', description: 'Album name (when includeMeta is not set)' },
                                { $ref: '#/components/schemas/AlbumSummary' }
                              ]
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            }
          },
          '/photo-album': {
            get: {
              summary: 'Get a single photo album by name',
              operationId: 'getPhotoAlbum',
              security: [{ ApiToken: [] }],
              parameters: [
                {
                  name: 'name',
                  in: 'query',
                  required: true,
                  description: 'Album name',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Album record',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/Album' } } }
                },
                '400': { description: 'Album name is required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'Album not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            },
            post: {
              summary: 'Create or update a photo album',
              operationId: 'upsertPhotoAlbum',
              security: [{ ApiToken: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', description: 'Album name' },
                        images: { type: 'array', items: { type: 'string' }, description: 'Array of image keys/URLs' },
                        seoTitle: { type: 'string', nullable: true, description: 'SEO title' },
                        seoDescription: { type: 'string', nullable: true, description: 'SEO description' },
                        seoImageKey: { type: 'string', nullable: true, description: 'SEO image key' },
                        isShared: { type: 'boolean', description: 'Whether the album is publicly shared' },
                        regenerateShareId: { type: 'boolean', description: 'Force regeneration of the share UUID' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Created or updated album',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/Album' } } }
                },
                '400': { description: 'Invalid request (missing name or bad JSON)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '403': { description: 'Unauthorized to modify this album (not owner or superadmin)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            },
            delete: {
              summary: 'Delete a photo album',
              operationId: 'deletePhotoAlbum',
              security: [{ ApiToken: [] }],
              parameters: [
                {
                  name: 'name',
                  in: 'query',
                  required: true,
                  description: 'Album name to delete',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Album deleted',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          deleted: { type: 'string', description: 'Name of deleted album' }
                        }
                      }
                    }
                  }
                },
                '400': { description: 'Album name is required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '403': { description: 'Unauthorized to delete this album', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            }
          },
          '/photo-album/add': {
            post: {
              summary: 'Add images to an existing album (or create it)',
              operationId: 'addPhotoAlbumImages',
              security: [{ ApiToken: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', description: 'Album name' },
                        images: { type: 'array', items: { type: 'string' }, description: 'Array of image keys to add' },
                        image: { type: 'string', description: 'Single image key to add (alternative to images array)' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Updated album with merged images',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/Album' } } }
                },
                '400': { description: 'Invalid request (missing name, bad JSON, or no images)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '403': { description: 'Unauthorized to modify this album', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            }
          },
          '/photo-album/remove': {
            post: {
              summary: 'Remove images from an album',
              operationId: 'removePhotoAlbumImages',
              security: [{ ApiToken: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', description: 'Album name' },
                        images: { type: 'array', items: { type: 'string' }, description: 'Array of image keys to remove' },
                        image: { type: 'string', description: 'Single image key to remove (alternative to images array)' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Updated album with images removed. If the removed image was the SEO image, seoImageKey is updated to the first remaining image.',
                  content: { 'application/json': { schema: { $ref: '#/components/schemas/Album' } } }
                },
                '400': { description: 'Invalid request (missing name, bad JSON, or no images)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '403': { description: 'Unauthorized to modify this album', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '404': { description: 'Album not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                '500': { description: 'Album storage not configured', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }
              }
            }
          }
        }
      }
      return createResponse(JSON.stringify(spec, null, 2), 200)
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
