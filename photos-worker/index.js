const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token'
}

const createResponse = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

const createErrorResponse = (message, status = 400) =>
  createResponse(JSON.stringify({ error: message }), status)

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
  } catch {
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

const findAlbumByShareId = async (env, shareId) => {
  if (!env.PHOTO_ALBUMS) return null
  const list = await env.PHOTO_ALBUMS.list({ prefix: PHOTO_ALBUM_PREFIX })
  for (const entry of list.keys) {
    const name = entry.name.slice(PHOTO_ALBUM_PREFIX.length)
    const album = await readPhotoAlbum(env, name)
    if (album?.shareId === shareId) return album
  }
  return null
}

const parseTrashKey = (trashKey) => {
  const prefix = 'trash/'
  if (!trashKey.startsWith(prefix)) return { originalKey: null, deletedAt: null }
  const rest = trashKey.slice(prefix.length)
  const dashIndex = rest.indexOf('-')
  if (dashIndex === -1) return { originalKey: null, deletedAt: null }
  const timestamp = Number(rest.slice(0, dashIndex))
  const originalKey = rest.slice(dashIndex + 1)
  const deletedAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
  return { originalKey: originalKey || null, deletedAt }
}

const resolveBaseUrl = (value, fallback) => {
  const base = (value || fallback || '').trim()
  if (!base) return ''
  return base.endsWith('/') ? base : `${base}/`
}

const handleListR2Images = async (request, env) => {
  const url = new URL(request.url)
  const albumName = url.searchParams.get('album')
  const shareId = url.searchParams.get('share')
  const baseUrl = resolveBaseUrl(env.PHOTOS_BASE_URL, 'https://vegvisr.imgix.net/')

  if ((albumName || shareId) && !env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }

  if ((albumName || shareId) && env.PHOTO_ALBUMS) {
    const album = shareId
      ? await findAlbumByShareId(env, shareId)
      : await readPhotoAlbum(env, albumName)
    if (!album) {
      return createErrorResponse('Album not found', 404)
    }
    if (!album.isShared) {
      const auth = await validateAuth(request, env)
      if (!auth.valid) {
        return createErrorResponse(auth.error, 401)
      }
      if (
        auth.role !== 'Superadmin' &&
        album.createdBy &&
        album.createdBy !== auth.userId &&
        album.createdBy !== auth.email
      ) {
        return createErrorResponse('Unauthorized to view this album', 403)
      }
    }
    const images = (album.images || []).map((key) => ({
      key,
      url: `${baseUrl}${key}`,
      uploaded: null
    }))
    return createResponse(JSON.stringify({ images, album: album.name }), 200)
  }

  // R2 list() returns max 1000 objects per call — paginate with cursor to get all
  const allObjects = []
  let cursor
  do {
    const listResult = await env.PHOTOS_BUCKET.list({ cursor })
    allObjects.push(...listResult.objects)
    cursor = listResult.truncated ? listResult.cursor : undefined
  } while (cursor)

  const images = allObjects
    .filter((obj) => !obj.key.startsWith('trash/'))
    .filter((obj) => /\.(png|jpe?g|gif|webp)$/i.test(obj.key))
    .map((obj) => ({
      key: obj.key,
      url: `${baseUrl}${obj.key}`,
      uploaded: obj.uploaded ? obj.uploaded.toISOString() : null
    }))

  return createResponse(JSON.stringify({ images }), 200)
}

const handleListTrashImages = async (_request, env) => {
  const list = await env.PHOTOS_BUCKET.list({ prefix: 'trash/' })
  const baseUrl = resolveBaseUrl(env.PHOTOS_BASE_URL, 'https://vegvisr.imgix.net/')
  const items = []

  for (const obj of list.objects) {
    const { originalKey: fallbackKey, deletedAt: fallbackDeletedAt } = parseTrashKey(obj.key)
    let originalKey = fallbackKey
    let deletedAt = fallbackDeletedAt

    try {
      const head = await env.PHOTOS_BUCKET.head(obj.key)
      if (head?.customMetadata?.originalKey) {
        originalKey = head.customMetadata.originalKey
      }
      if (head?.customMetadata?.deletedAt) {
        deletedAt = head.customMetadata.deletedAt
      }
    } catch {
      // ignore head errors
    }

    items.push({
      trashKey: obj.key,
      originalKey: originalKey || null,
      deletedAt: deletedAt || null,
      url: `${baseUrl}${obj.key}`
    })
  }

  return createResponse(JSON.stringify({ items }), 200)
}

const handleRestoreTrashImage = async (request, env) => {
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const trashKey = body?.trashKey
  const overwrite = !!body?.overwrite
  if (!trashKey) {
    return createErrorResponse('trashKey is required', 400)
  }

  const trashObject = await env.PHOTOS_BUCKET.get(trashKey)
  if (!trashObject) {
    return createErrorResponse('Trash object not found', 404)
  }

  let originalKey = body?.originalKey
  if (!originalKey) {
    const { originalKey: parsedOriginal } = parseTrashKey(trashKey)
    originalKey = parsedOriginal
  }
  if (!originalKey) {
    return createErrorResponse('originalKey is required', 400)
  }

  const existing = await env.PHOTOS_BUCKET.head(originalKey)
  if (existing && !overwrite) {
    return createErrorResponse('Destination already exists', 409)
  }

  await env.PHOTOS_BUCKET.put(originalKey, trashObject.body, {
    httpMetadata: trashObject.httpMetadata
  })
  await env.PHOTOS_BUCKET.delete(trashKey)

  return createResponse(JSON.stringify({ restored: originalKey, trashed: trashKey }), 200)
}

const handleDeleteTrashImage = async (request, env) => {
  let body
  try {
    body = await request.json()
  } catch {
    return createErrorResponse('Invalid JSON body', 400)
  }
  const trashKey = body?.trashKey
  if (!trashKey) {
    return createErrorResponse('trashKey is required', 400)
  }
  await env.PHOTOS_BUCKET.delete(trashKey)
  return createResponse(JSON.stringify({ deleted: trashKey }), 200)
}

const handleDeleteR2Image = async (request, env) => {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')
  if (!key) {
    return createErrorResponse('Image key is required', 400)
  }
  const image = await env.PHOTOS_BUCKET.get(key)
  if (!image) {
    return createErrorResponse('Image not found', 404)
  }

  const deletedAt = new Date().toISOString()
  const trashKey = `trash/${Date.now()}-${key}`
  await env.PHOTOS_BUCKET.put(trashKey, image.body, {
    httpMetadata: image.httpMetadata,
    customMetadata: {
      originalKey: key,
      deletedAt
    }
  })
  await env.PHOTOS_BUCKET.delete(key)

  if (env.PHOTO_ALBUMS) {
    const list = await env.PHOTO_ALBUMS.list({ prefix: PHOTO_ALBUM_PREFIX })
    for (const entry of list.keys) {
      const name = entry.name.slice(PHOTO_ALBUM_PREFIX.length)
      const album = await readPhotoAlbum(env, name)
      if (!album || !Array.isArray(album.images)) continue
      if (!album.images.includes(key)) continue
      const updated = album.images.filter((item) => item !== key)
      const updatedAlbum = {
        ...album,
        images: updated,
        updatedAt: new Date().toISOString()
      }
      await env.PHOTO_ALBUMS.put(buildAlbumKey(name), JSON.stringify(updatedAlbum))
    }
  }

  return createResponse(JSON.stringify({ deleted: key, trashed: trashKey, deletedAt }), 200)
}

const handleUpload = async (request, env) => {
  const formData = await request.formData()
  const files = formData.getAll('file').filter((entry) => entry instanceof File)
  const customFilename = formData.get('filename')
  const albumName = normalizeAlbumName(formData.get('album'))
  const baseUrl = resolveBaseUrl(env.PHOTOS_BASE_URL, 'https://vegvisr.imgix.net/')

  if (!files.length) {
    return createErrorResponse('Missing file', 400)
  }
  if (albumName && !env.PHOTO_ALBUMS) {
    return createErrorResponse('Album storage is not configured', 500)
  }

  const uploadedKeys = []
  const baseTimestamp = Date.now()
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const fileExtension = file.name ? file.name.split('.').pop() : ''
    if (!fileExtension) {
      return createErrorResponse('Invalid file name or extension', 400)
    }

    const baseName =
      files.length === 1 && customFilename
        ? customFilename
        : `${baseTimestamp}-${index + 1}`
    const fileName = `${baseName}.${fileExtension}`
    const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

    await env.PHOTOS_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { contentType }
    })
    uploadedKeys.push(fileName)
  }

  if (albumName) {
    const existing = (await readPhotoAlbum(env, albumName)) || { name: albumName, images: [] }
    const merged = [...new Set([...existing.images, ...uploadedKeys])]
    const album = {
      name: albumName,
      images: merged,
      updatedAt: new Date().toISOString()
    }
    await env.PHOTO_ALBUMS.put(buildAlbumKey(albumName), JSON.stringify(album))
  }

  const urls = uploadedKeys.map((key) => `${baseUrl}${key}`)
  return createResponse(JSON.stringify({ urls, keys: uploadedKeys, album: albumName || null }), 200)
}

const handleUploadFavicon = async (request, env) => {
  const formData = await request.formData()
  const files = formData.getAll('file').filter((entry) => entry instanceof File)
  const customFilename = formData.get('filename')
  const baseUrl = resolveBaseUrl(env.FAVICONS_BASE_URL, '')

  if (!env.FAVICONS_BUCKET) {
    return createErrorResponse('Favicon storage is not configured', 500)
  }
  if (!files.length) {
    return createErrorResponse('Missing file', 400)
  }

  const uploadedKeys = []
  const baseTimestamp = Date.now()
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const fileExtension = file.name ? file.name.split('.').pop() : ''
    if (!fileExtension) {
      return createErrorResponse('Invalid file name or extension', 400)
    }

    const baseName =
      files.length === 1 && customFilename
        ? customFilename
        : `favicons/${baseTimestamp}-${index + 1}`
    const fileName = `${baseName}.${fileExtension}`
    const contentType = fileExtension === 'svg' ? 'image/svg+xml' : file.type

    await env.FAVICONS_BUCKET.put(fileName, file.stream(), {
      httpMetadata: { contentType }
    })
    uploadedKeys.push(fileName)
  }

  const urls = baseUrl ? uploadedKeys.map((key) => `${baseUrl}${key}`) : []
  return createResponse(JSON.stringify({ urls, keys: uploadedKeys }), 200)
}

const handleListFavicons = async (request, env) => {
  if (!env.FAVICONS_BUCKET) {
    return createErrorResponse('Favicon storage is not configured', 500)
  }
  const url = new URL(request.url)
  const prefix = url.searchParams.get('prefix') || 'favicons/'
  const list = await env.FAVICONS_BUCKET.list({ prefix })
  const baseUrl = resolveBaseUrl(env.FAVICONS_BASE_URL, '')
  const items = list.objects.map((obj) => ({
    key: obj.key,
    url: baseUrl ? `${baseUrl}${obj.key}` : obj.key
  }))
  return createResponse(JSON.stringify({ items }), 200)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    try {
      if (pathname === '/health' && request.method === 'GET') {
        return createResponse(JSON.stringify({
          status: 'healthy',
          worker: 'vegvisr-photos-worker',
          timestamp: new Date().toISOString()
        }), 200)
      }

      if (pathname === '/openapi.json' && request.method === 'GET') {
        const spec = {
          openapi: '3.0.3',
          info: {
            title: 'Photos Worker API',
            version: '1.0.0',
            description: 'Cloudflare Worker for managing photos, albums, favicons, and trash in R2 storage.'
          },
          paths: {
            '/health': {
              get: {
                summary: 'Health check',
                description: 'Returns the health status of the worker.',
                responses: {
                  '200': {
                    description: 'Worker is healthy',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            status: { type: 'string', example: 'healthy' },
                            worker: { type: 'string', example: 'vegvisr-photos-worker' },
                            timestamp: { type: 'string', format: 'date-time' }
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
                description: 'Returns this OpenAPI 3.0 specification.',
                responses: {
                  '200': {
                    description: 'OpenAPI spec',
                    content: { 'application/json': { schema: { type: 'object' } } }
                  }
                }
              }
            },
            '/list-r2-images': {
              get: {
                summary: 'List images',
                description: 'List images from R2 storage, optionally filtered by album name or share ID. Private albums require authentication.',
                parameters: [
                  { name: 'album', in: 'query', required: false, schema: { type: 'string' }, description: 'Album name to filter by' },
                  { name: 'share', in: 'query', required: false, schema: { type: 'string' }, description: 'Share ID for shared album access' }
                ],
                responses: {
                  '200': {
                    description: 'List of images',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            images: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  key: { type: 'string' },
                                  url: { type: 'string' },
                                  uploaded: { type: 'string', format: 'date-time', nullable: true }
                                }
                              }
                            },
                            album: { type: 'string', nullable: true }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Unauthorized — missing or invalid token' },
                  '403': { description: 'Forbidden — not authorized for this album' },
                  '404': { description: 'Album not found' },
                  '500': { description: 'Album storage not configured' }
                }
              }
            },
            '/upload': {
              post: {
                summary: 'Upload images',
                description: 'Upload one or more image files to R2 storage, optionally adding them to an album.',
                requestBody: {
                  required: true,
                  content: {
                    'multipart/form-data': {
                      schema: {
                        type: 'object',
                        properties: {
                          file: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'One or more image files' },
                          filename: { type: 'string', description: 'Custom filename (single file upload only)' },
                          album: { type: 'string', description: 'Album name to add uploaded images to' }
                        },
                        required: ['file']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Upload successful',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            urls: { type: 'array', items: { type: 'string' } },
                            keys: { type: 'array', items: { type: 'string' } },
                            album: { type: 'string', nullable: true }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing file or invalid file name' },
                  '500': { description: 'Album storage not configured' }
                }
              }
            },
            '/upload-favicon': {
              post: {
                summary: 'Upload favicon',
                description: 'Upload one or more favicon files to the FAVICONS_BUCKET.',
                requestBody: {
                  required: true,
                  content: {
                    'multipart/form-data': {
                      schema: {
                        type: 'object',
                        properties: {
                          file: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'One or more favicon files' },
                          filename: { type: 'string', description: 'Custom filename (single file upload only)' }
                        },
                        required: ['file']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Upload successful',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            urls: { type: 'array', items: { type: 'string' } },
                            keys: { type: 'array', items: { type: 'string' } }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing file or invalid file name' },
                  '500': { description: 'Favicon storage not configured' }
                }
              }
            },
            '/favicons': {
              get: {
                summary: 'List favicons',
                description: 'List favicon files from FAVICONS_BUCKET.',
                parameters: [
                  { name: 'prefix', in: 'query', required: false, schema: { type: 'string', default: 'favicons/' }, description: 'Key prefix to filter by' }
                ],
                responses: {
                  '200': {
                    description: 'List of favicons',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            items: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  key: { type: 'string' },
                                  url: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '500': { description: 'Favicon storage not configured' }
                }
              }
            },
            '/delete-r2-image': {
              delete: {
                summary: 'Delete an image (move to trash)',
                description: 'Soft-deletes an image by moving it to the trash/ prefix in R2 and removing it from any albums.',
                parameters: [
                  { name: 'key', in: 'query', required: true, schema: { type: 'string' }, description: 'R2 object key of the image to delete' }
                ],
                responses: {
                  '200': {
                    description: 'Image moved to trash',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            deleted: { type: 'string' },
                            trashed: { type: 'string' },
                            deletedAt: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Image key is required' },
                  '404': { description: 'Image not found' }
                }
              }
            },
            '/trash/list': {
              get: {
                summary: 'List trashed images',
                description: 'List all soft-deleted images in the trash/ prefix.',
                responses: {
                  '200': {
                    description: 'List of trashed items',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            items: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  trashKey: { type: 'string' },
                                  originalKey: { type: 'string', nullable: true },
                                  deletedAt: { type: 'string', format: 'date-time', nullable: true },
                                  url: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/trash/restore': {
              post: {
                summary: 'Restore a trashed image',
                description: 'Restore an image from trash back to its original key.',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          trashKey: { type: 'string', description: 'Key of the trashed object' },
                          originalKey: { type: 'string', description: 'Original key to restore to (auto-detected if omitted)' },
                          overwrite: { type: 'boolean', default: false, description: 'Overwrite if destination exists' }
                        },
                        required: ['trashKey']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Image restored',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            restored: { type: 'string' },
                            trashed: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Invalid request — trashKey or originalKey missing' },
                  '404': { description: 'Trash object not found' },
                  '409': { description: 'Destination already exists (use overwrite: true)' }
                }
              }
            },
            '/trash/delete': {
              delete: {
                summary: 'Permanently delete a trashed image',
                description: 'Permanently removes an image from the trash.',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          trashKey: { type: 'string', description: 'Key of the trashed object to permanently delete' }
                        },
                        required: ['trashKey']
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Image permanently deleted',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            deleted: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'trashKey is required' }
                }
              }
            }
          }
        }
        return createResponse(JSON.stringify(spec, null, 2), 200)
      }

      if (pathname === '/list-r2-images' && request.method === 'GET') {
        return await handleListR2Images(request, env)
      }
      if (pathname === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env)
      }
      if (pathname === '/upload-favicon' && request.method === 'POST') {
        return await handleUploadFavicon(request, env)
      }
      if (pathname === '/favicons' && request.method === 'GET') {
        return await handleListFavicons(request, env)
      }
      if (pathname === '/delete-r2-image' && request.method === 'DELETE') {
        return await handleDeleteR2Image(request, env)
      }
      if (pathname === '/trash/list' && request.method === 'GET') {
        return await handleListTrashImages(request, env)
      }
      if (pathname === '/trash/restore' && request.method === 'POST') {
        return await handleRestoreTrashImage(request, env)
      }
      if (pathname === '/trash/delete' && request.method === 'DELETE') {
        return await handleDeleteTrashImage(request, env)
      }

      return createErrorResponse('Not found', 404)
    } catch (error) {
      console.error('Photos worker error:', error)
      return createErrorResponse('Internal server error', 500)
    }
  }
}
