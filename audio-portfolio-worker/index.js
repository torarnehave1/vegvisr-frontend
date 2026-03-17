// Audio Portfolio Worker - Separate service for managing audio recording portfolios
// This worker is independent from whisper-worker to preserve functional code

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Email',
}

// Create error response with CORS
const createErrorResponse = (message, status = 400) => {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

// Create success response with CORS
const createSuccessResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

// Generate unique recording ID
const generateRecordingId = () => {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const isSuperadminRole = (role) => {
  return (role || '').toLowerCase() === 'superadmin'
}

const addRecordingToIndex = async (env, userEmail, recordingId) => {
  if (!userEmail || !recordingId) {
    throw new Error('User email and recordingId are required')
  }

  const recordingKey = `audio-recording:${userEmail}:${recordingId}`
  const recordingData = await env.AUDIO_PORTFOLIO.get(recordingKey)
  if (!recordingData) {
    throw new Error('Recording not found in KV')
  }

  const recording = JSON.parse(recordingData)
  const indexKey = `audio-index:${userEmail}`
  const userIndexRaw = await env.AUDIO_PORTFOLIO.get(indexKey)
  let userIndex = userIndexRaw ? JSON.parse(userIndexRaw) : null

  if (!userIndex) {
    userIndex = {
      userEmail,
      totalRecordings: 1,
      totalDuration: recording.duration || 0,
      lastUpdated: new Date().toISOString(),
      recordingIds: [recordingId],
    }
  } else {
    if (!Array.isArray(userIndex.recordingIds)) {
      userIndex.recordingIds = []
    }
    if (!userIndex.recordingIds.includes(recordingId)) {
      userIndex.recordingIds.push(recordingId)
      userIndex.totalRecordings = userIndex.recordingIds.length
      userIndex.totalDuration = (userIndex.totalDuration || 0) + (recording.duration || 0)
      userIndex.lastUpdated = new Date().toISOString()
    }
  }

  await env.AUDIO_PORTFOLIO.put(indexKey, JSON.stringify(userIndex))

  return { success: true, index: userIndex }
}

// Save recording metadata to portfolio
const saveRecordingToPortfolio = async (env, recordingData) => {
  try {
    const recordingId = recordingData.recordingId || generateRecordingId()
    const userEmail = recordingData.userEmail

    if (!userEmail) {
      throw new Error('User email is required')
    }

    // Create recording metadata
    const recordingMetadata = {
      // Core Identifiers
      userEmail,
      recordingId,

      // File Information
      fileName: recordingData.fileName || 'unknown.wav',
      displayName: recordingData.displayName || recordingData.fileName || 'Untitled Recording',
      r2Key: recordingData.r2Key || null,
      r2Url: recordingData.r2Url || null,
      fileSize: recordingData.fileSize || 0,
      duration: recordingData.duration || 0,

      // Transcription Data - Support both regular and Norwegian transcription formats
      transcriptionText: recordingData.transcriptionText || '',
      transcriptionExcerpt: recordingData.transcriptionText
        ? recordingData.transcriptionText.substring(0, 200) +
          (recordingData.transcriptionText.length > 200 ? '...' : '')
        : '',

      // Norwegian Transcription Data (if available)
      norwegianTranscription: recordingData.norwegianTranscription || null,

      // Organization
      tags: recordingData.tags || [],
      category: recordingData.category || 'general',

      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Publication State (NEW)
      publicationState: recordingData.publicationState || 'draft', // 'draft' or 'published'
      publishedAt: recordingData.publicationState === 'published' ? new Date().toISOString() : null,

      // Technical Details
      audioFormat: recordingData.audioFormat || 'wav',
      sampleRate: recordingData.sampleRate || 16000,
      channels: recordingData.channels || 1,

      // AI Processing Info
      aiService: recordingData.aiService || 'openai',
      aiModel: recordingData.aiModel || 'whisper-1',
      processingTime: recordingData.processingTime || 0,

      // Norwegian Transcription Specific Fields
      transcriptionContext: recordingData.transcriptionContext || null,
      transcriptionServer: recordingData.transcriptionServer || null,
      textImprovement: recordingData.textImprovement || null,
      cloudflareAiAvailable: recordingData.cloudflareAiAvailable || false,
    }

    // Save recording metadata
    const recordingKey = `audio-recording:${userEmail}:${recordingId}`
    await env.AUDIO_PORTFOLIO.put(recordingKey, JSON.stringify(recordingMetadata))

    // Update user index
    const indexKey = `audio-index:${userEmail}`
    let userIndex = await env.AUDIO_PORTFOLIO.get(indexKey)

    if (userIndex) {
      userIndex = JSON.parse(userIndex)
      if (!userIndex.recordingIds.includes(recordingId)) {
        userIndex.recordingIds.push(recordingId)
        userIndex.totalRecordings = userIndex.recordingIds.length
        userIndex.totalDuration += recordingMetadata.duration
        userIndex.lastUpdated = new Date().toISOString()
      }
    } else {
      userIndex = {
        userEmail,
        totalRecordings: 1,
        totalDuration: recordingMetadata.duration,
        lastUpdated: new Date().toISOString(),
        recordingIds: [recordingId],
      }
    }

    await env.AUDIO_PORTFOLIO.put(indexKey, JSON.stringify(userIndex))

    return { success: true, recordingId, recordingMetadata }
  } catch (error) {
    console.error('Error saving recording to portfolio:', error)
    throw error
  }
}

// Get user's audio recordings
const getUserRecordings = async (env, userEmail, limit = 50, offset = 0, userRole = 'user') => {
  try {
    if (!userEmail) {
      throw new Error('User email is required')
    }

    const indexKey = `audio-index:${userEmail}`
    const userIndex = await env.AUDIO_PORTFOLIO.get(indexKey)

    if (!userIndex) {
      return { recordings: [], total: 0, userStats: null }
    }

    const index = JSON.parse(userIndex)
    const recordingIds = index.recordingIds.slice(offset, offset + limit)

    const recordings = []
    for (const recordingId of recordingIds) {
      const recordingKey = `audio-recording:${userEmail}:${recordingId}`
      const recordingData = await env.AUDIO_PORTFOLIO.get(recordingKey)
      if (recordingData) {
        const recording = JSON.parse(recordingData)

        // Filter by publication state based on user role
        // Superadmin sees everything, regular users only see published
        if (isSuperadminRole(userRole) || recording.publicationState === 'published') {
          recordings.push(recording)
        }
      }
    }

    // Sort by creation date (newest first)
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      recordings,
      total: recordings.length, // Total after filtering
      userStats: {
        totalRecordings: index.totalRecordings,
        totalDuration: index.totalDuration,
        lastUpdated: index.lastUpdated,
      },
    }
  } catch (error) {
    console.error('Error getting user recordings:', error)
    throw error
  }
}

// Search recordings by text content, tags, or metadata
const searchRecordings = async (env, userEmail, query, limit = 50) => {
  try {
    if (!userEmail) {
      throw new Error('User email is required')
    }

    if (!query || query.trim().length === 0) {
      return getUserRecordings(env, userEmail, limit, 0)
    }

    const indexKey = `audio-index:${userEmail}`
    const userIndex = await env.AUDIO_PORTFOLIO.get(indexKey)

    if (!userIndex) {
      return { recordings: [], total: 0, userStats: null }
    }

    const index = JSON.parse(userIndex)
    const searchQuery = query.toLowerCase().trim()
    const matchedRecordings = []

    for (const recordingId of index.recordingIds) {
      const recordingKey = `audio-recording:${userEmail}:${recordingId}`
      const recordingData = await env.AUDIO_PORTFOLIO.get(recordingKey)

      if (recordingData) {
        const recording = JSON.parse(recordingData)

        // Search in transcription text, file name, display name, tags, and category
        // Also search in Norwegian transcription data if available
        const searchableTexts = [
          recording.transcriptionText,
          recording.fileName,
          recording.displayName,
          recording.tags.join(' '),
          recording.category,
        ]

        // Add Norwegian transcription data to search
        if (recording.norwegianTranscription) {
          searchableTexts.push(recording.norwegianTranscription.raw_text || '')
          searchableTexts.push(recording.norwegianTranscription.improved_text || '')
        }

        const searchableText = searchableTexts.join(' ').toLowerCase()

        if (searchableText.includes(searchQuery)) {
          matchedRecordings.push(recording)
        }
      }
    }

    // Sort by creation date (newest first)
    matchedRecordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      recordings: matchedRecordings.slice(0, limit),
      total: matchedRecordings.length,
      query: query,
      userStats: {
        totalRecordings: index.totalRecordings,
        totalDuration: index.totalDuration,
        lastUpdated: index.lastUpdated,
      },
    }
  } catch (error) {
    console.error('Error searching recordings:', error)
    throw error
  }
}

// Delete recording from portfolio
const deleteRecording = async (env, userEmail, recordingId) => {
  try {
    if (!userEmail || !recordingId) {
      throw new Error('User email and recording ID are required')
    }

    // Delete recording metadata
    const recordingKey = `audio-recording:${userEmail}:${recordingId}`
    const recordingData = await env.AUDIO_PORTFOLIO.get(recordingKey)

    if (!recordingData) {
      throw new Error('Recording not found')
    }

    const recording = JSON.parse(recordingData)
    await env.AUDIO_PORTFOLIO.delete(recordingKey)

    // Update user index
    const indexKey = `audio-index:${userEmail}`
    let userIndex = await env.AUDIO_PORTFOLIO.get(indexKey)

    if (userIndex) {
      userIndex = JSON.parse(userIndex)
      userIndex.recordingIds = userIndex.recordingIds.filter((id) => id !== recordingId)
      userIndex.totalRecordings = userIndex.recordingIds.length
      userIndex.totalDuration -= recording.duration
      userIndex.lastUpdated = new Date().toISOString()

      await env.AUDIO_PORTFOLIO.put(indexKey, JSON.stringify(userIndex))
    }

    return { success: true, deletedRecording: recording }
  } catch (error) {
    console.error('Error deleting recording:', error)
    throw error
  }
}

// Update recording metadata
const updateRecording = async (env, userEmail, recordingId, updates) => {
  try {
    if (!userEmail || !recordingId) {
      throw new Error('User email and recording ID are required')
    }

    const recordingKey = `audio-recording:${userEmail}:${recordingId}`
    const recordingData = await env.AUDIO_PORTFOLIO.get(recordingKey)

    if (!recordingData) {
      throw new Error('Recording not found')
    }

    const recording = JSON.parse(recordingData)

    // Update allowed fields (expanded to include speaker identification and diarization fields)
    const allowedUpdates = [
      'displayName',
      'tags',
      'category',
      'publicationState',
      'publishedAt',
      'speakerTimeline',
      'numSpeakers',
      'speakerNames',
      'diarization',
      'conversationAnalysis'
    ]
    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        recording[field] = updates[field]
      }
    })

    recording.updatedAt = new Date().toISOString()

    await env.AUDIO_PORTFOLIO.put(recordingKey, JSON.stringify(recording))

    return { success: true, updatedRecording: recording }
  } catch (error) {
    console.error('Error updating recording:', error)
    throw error
  }
}

// List public recordings across users (published only), optionally filtered by tag
const listPublicRecordings = async (env, tag, limit = 50, cursor = null) => {
  try {
    const normalizedTag = tag ? String(tag).toLowerCase().trim() : null
    const recordings = []
    let listCursor = cursor || undefined
    let listComplete = false

    while (!listComplete && recordings.length < limit) {
      const page = await env.AUDIO_PORTFOLIO.list({
        prefix: 'audio-recording:',
        cursor: listCursor,
        limit: 100,
      })

      listCursor = page.cursor
      listComplete = page.list_complete

      for (const key of page.keys) {
        if (recordings.length >= limit) break
        const recordingData = await env.AUDIO_PORTFOLIO.get(key.name)
        if (!recordingData) continue

        const recording = JSON.parse(recordingData)
        if (recording.publicationState !== 'published') continue

        if (normalizedTag) {
          const tags = (recording.tags || recording.metadata?.tags || []).map((t) =>
            String(t).toLowerCase().trim(),
          )
          if (!tags.includes(normalizedTag)) continue
        }

        recordings.push(recording)
      }
    }

    return {
      recordings,
      total: recordings.length,
      cursor: listComplete ? null : listCursor,
    }
  } catch (error) {
    console.error('Error listing public recordings:', error)
    throw error
  }
}

// List all recordings across users (superadmin only), optionally filtered by ownerEmail
const listAllRecordings = async (env, limit = 50, cursor = null, ownerEmail = null) => {
  try {
    const normalizedOwner = ownerEmail ? String(ownerEmail).toLowerCase().trim() : null
    const recordings = []
    let listCursor = cursor || undefined
    let listComplete = false

    while (!listComplete && recordings.length < limit) {
      const page = await env.AUDIO_PORTFOLIO.list({
        prefix: 'audio-recording:',
        cursor: listCursor,
        limit: 100,
      })

      listCursor = page.cursor
      listComplete = page.list_complete

      for (const key of page.keys) {
        if (recordings.length >= limit) break
        const recordingData = await env.AUDIO_PORTFOLIO.get(key.name)
        if (!recordingData) continue

        const recording = JSON.parse(recordingData)
        const keyParts = key.name.split(':')
        const keyEmail = keyParts.length >= 3 ? keyParts[1] : null
        const recordingEmail = recording.userEmail || recording.ownerEmail || keyEmail

        if (normalizedOwner && recordingEmail?.toLowerCase() !== normalizedOwner) continue

        if (!recording.userEmail && recordingEmail) {
          recording.userEmail = recordingEmail
        }

        recordings.push(recording)
      }
    }

    // Sort by creation date (newest first)
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      recordings,
      total: recordings.length,
      cursor: listComplete ? null : listCursor,
    }
  } catch (error) {
    console.error('Error listing all recordings:', error)
    throw error
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Log all incoming requests for debugging
    console.log('🎵 Audio Portfolio Worker Request:', {
      method: request.method,
      pathname: pathname,
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

    // Health check endpoint
    if (pathname === '/' || pathname === '/health') {
      return createSuccessResponse({
        service: 'audio-portfolio-worker',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.1.0',
        features: ['norwegian-transcription-support'],
        kvBinding: env.AUDIO_PORTFOLIO ? 'connected' : 'missing',
      })
    }

    // OpenAPI 3.0 specification
    if (pathname === '/openapi.json' && request.method === 'GET') {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'Audio Portfolio Worker API',
          description: 'Manages audio recording portfolios with metadata, transcriptions, publication state, and context templates. Backed by Cloudflare KV.',
          version: '1.1.0',
        },
        paths: {
          '/health': {
            get: {
              summary: 'Health check',
              description: 'Returns service status, version, and KV binding status.',
              operationId: 'healthCheck',
              responses: {
                '200': {
                  description: 'Service health information',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          service: { type: 'string', example: 'audio-portfolio-worker' },
                          status: { type: 'string', example: 'healthy' },
                          timestamp: { type: 'string', format: 'date-time' },
                          version: { type: 'string', example: '1.1.0' },
                          features: { type: 'array', items: { type: 'string' } },
                          kvBinding: { type: 'string', enum: ['connected', 'missing'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '/openapi.json': {
            get: {
              summary: 'OpenAPI specification',
              description: 'Returns this OpenAPI 3.0 specification.',
              operationId: 'getOpenApiSpec',
              responses: {
                '200': {
                  description: 'OpenAPI 3.0 JSON specification',
                  content: { 'application/json': { schema: { type: 'object' } } },
                },
              },
            },
          },
          '/save-recording': {
            post: {
              summary: 'Save recording metadata',
              description: 'Saves recording metadata to the portfolio and updates the user index.',
              operationId: 'saveRecording',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/SaveRecordingRequest' },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Recording saved successfully',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          recordingId: { type: 'string' },
                          recordingMetadata: { $ref: '#/components/schemas/RecordingMetadata' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/list-recordings': {
            get: {
              summary: 'List user recordings',
              description: 'Returns recordings for a user. Superadmin role returns all recordings across users. Regular users only see published recordings.',
              operationId: 'listRecordings',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'Email of the user whose recordings to list' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Maximum number of recordings to return' },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Number of recordings to skip (non-superadmin only)' },
                { name: 'userRole', in: 'query', schema: { type: 'string', default: 'user' }, description: 'User role. "superadmin" returns all recordings across users.' },
                { name: 'ownerEmail', in: 'query', schema: { type: 'string' }, description: 'Filter by owner email (superadmin only)' },
                { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Pagination cursor (superadmin only)' },
              ],
              responses: {
                '200': {
                  description: 'List of recordings',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/RecordingListResponse' },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/search-recordings': {
            get: {
              summary: 'Search recordings',
              description: 'Searches recordings by text content across transcription, file name, display name, tags, category, and Norwegian transcription data.',
              operationId: 'searchRecordings',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'Email of the user whose recordings to search' },
                { name: 'query', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query string' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Maximum number of results' },
              ],
              responses: {
                '200': {
                  description: 'Search results',
                  content: {
                    'application/json': {
                      schema: {
                        allOf: [
                          { $ref: '#/components/schemas/RecordingListResponse' },
                          { type: 'object', properties: { query: { type: 'string' } } },
                        ],
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/list-recordings-public': {
            get: {
              summary: 'List public recordings',
              description: 'Lists published recordings across all users, optionally filtered by tag.',
              operationId: 'listPublicRecordings',
              parameters: [
                { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by tag (case-insensitive)' },
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Maximum number of recordings' },
                { name: 'cursor', in: 'query', schema: { type: 'string' }, description: 'Pagination cursor' },
              ],
              responses: {
                '200': {
                  description: 'List of public recordings',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          recordings: { type: 'array', items: { $ref: '#/components/schemas/RecordingMetadata' } },
                          total: { type: 'integer' },
                          cursor: { type: 'string', nullable: true },
                        },
                      },
                    },
                  },
                },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/delete-recording': {
            delete: {
              summary: 'Delete a recording',
              description: 'Deletes a recording and updates the user index.',
              operationId: 'deleteRecording',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'Owner email' },
                { name: 'recordingId', in: 'query', required: true, schema: { type: 'string' }, description: 'Recording ID to delete' },
              ],
              responses: {
                '200': {
                  description: 'Recording deleted',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          deletedRecording: { $ref: '#/components/schemas/RecordingMetadata' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/update-recording': {
            put: {
              summary: 'Update recording metadata (PUT)',
              description: 'Updates recording metadata using query params for identification and JSON body for updates.',
              operationId: 'updateRecordingPut',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'Owner email' },
                { name: 'recordingId', in: 'query', required: true, schema: { type: 'string' }, description: 'Recording ID' },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/UpdateRecordingFields' },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Recording updated',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          updatedRecording: { $ref: '#/components/schemas/RecordingMetadata' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
            post: {
              summary: 'Update recording metadata (POST)',
              description: 'Updates recording metadata using JSON body for identification and updates. Supports X-User-Email header.',
              operationId: 'updateRecordingPost',
              parameters: [
                { name: 'X-User-Email', in: 'header', schema: { type: 'string' }, description: 'User email (alternative to body.userEmail)' },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        userEmail: { type: 'string' },
                        id: { type: 'string', description: 'Recording ID (alternative: recordingId)' },
                        recordingId: { type: 'string' },
                        updates: { $ref: '#/components/schemas/UpdateRecordingFields' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Recording updated',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          updatedRecording: { $ref: '#/components/schemas/RecordingMetadata' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/update-publication-state': {
            post: {
              summary: 'Update publication state (superadmin only)',
              description: 'Changes a recording publication state between draft and published. Requires superadmin role.',
              operationId: 'updatePublicationState',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['userEmail', 'recordingId', 'publicationState', 'requestingUserRole'],
                      properties: {
                        userEmail: { type: 'string' },
                        recordingId: { type: 'string' },
                        publicationState: { type: 'string', enum: ['draft', 'published'] },
                        requestingUserRole: { type: 'string', description: 'Must be "superadmin"' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Publication state updated',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          updatedRecording: { $ref: '#/components/schemas/RecordingMetadata' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '403': { description: 'Forbidden - superadmin role required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/repair-index': {
            post: {
              summary: 'Repair user index (superadmin only)',
              description: 'Adds a recording to the user index if it is missing. Admin maintenance endpoint.',
              operationId: 'repairIndex',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['userEmail', 'recordingId', 'requestingUserRole'],
                      properties: {
                        userEmail: { type: 'string' },
                        recordingId: { type: 'string' },
                        requestingUserRole: { type: 'string', description: 'Must be "superadmin"' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Index repaired',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          index: { $ref: '#/components/schemas/UserIndex' },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '403': { description: 'Forbidden - superadmin role required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
                '500': { $ref: '#/components/responses/InternalError' },
              },
            },
          },
          '/context-templates': {
            get: {
              summary: 'Get context templates',
              description: 'Returns saved context templates for a user.',
              operationId: 'getContextTemplates',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'User email' },
              ],
              responses: {
                '200': {
                  description: 'User context templates',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          templates: { type: 'array', items: { $ref: '#/components/schemas/ContextTemplate' } },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
              },
            },
            post: {
              summary: 'Create context template',
              description: 'Saves a new context template for a user.',
              operationId: 'createContextTemplate',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['userEmail', 'name', 'context'],
                      properties: {
                        userEmail: { type: 'string' },
                        name: { type: 'string' },
                        context: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Template created',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          template: { $ref: '#/components/schemas/ContextTemplate' },
                          allTemplates: {
                            type: 'object',
                            properties: {
                              templates: { type: 'array', items: { $ref: '#/components/schemas/ContextTemplate' } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
              },
            },
            put: {
              summary: 'Update template last used',
              description: 'Updates the lastUsed timestamp of a context template.',
              operationId: 'updateContextTemplateUsage',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['userEmail', 'templateId'],
                      properties: {
                        userEmail: { type: 'string' },
                        templateId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'Template usage updated',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          template: { $ref: '#/components/schemas/ContextTemplate' },
                          allTemplates: {
                            type: 'object',
                            properties: {
                              templates: { type: 'array', items: { $ref: '#/components/schemas/ContextTemplate' } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '404': { description: 'No templates found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
              },
            },
            delete: {
              summary: 'Delete context template',
              description: 'Deletes a context template by ID.',
              operationId: 'deleteContextTemplate',
              parameters: [
                { name: 'userEmail', in: 'query', required: true, schema: { type: 'string' }, description: 'User email' },
                { name: 'templateId', in: 'query', required: true, schema: { type: 'string' }, description: 'Template ID to delete' },
              ],
              responses: {
                '200': {
                  description: 'Template deleted',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          deleted: { type: 'string' },
                          allTemplates: {
                            type: 'object',
                            properties: {
                              templates: { type: 'array', items: { $ref: '#/components/schemas/ContextTemplate' } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '400': { $ref: '#/components/responses/BadRequest' },
                '404': { description: 'No templates found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
              },
            },
          },
        },
        components: {
          schemas: {
            ErrorResponse: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
            },
            SaveRecordingRequest: {
              type: 'object',
              required: ['userEmail'],
              properties: {
                userEmail: { type: 'string', description: 'Owner email address' },
                recordingId: { type: 'string', description: 'Optional custom ID; auto-generated if omitted' },
                fileName: { type: 'string', default: 'unknown.wav' },
                displayName: { type: 'string' },
                r2Key: { type: 'string', nullable: true },
                r2Url: { type: 'string', nullable: true },
                fileSize: { type: 'integer', default: 0 },
                duration: { type: 'number', default: 0 },
                transcriptionText: { type: 'string' },
                norwegianTranscription: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    raw_text: { type: 'string' },
                    improved_text: { type: 'string' },
                  },
                },
                tags: { type: 'array', items: { type: 'string' }, default: [] },
                category: { type: 'string', default: 'general' },
                publicationState: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
                audioFormat: { type: 'string', default: 'wav' },
                sampleRate: { type: 'integer', default: 16000 },
                channels: { type: 'integer', default: 1 },
                aiService: { type: 'string', default: 'openai' },
                aiModel: { type: 'string', default: 'whisper-1' },
                processingTime: { type: 'number', default: 0 },
                transcriptionContext: { type: 'string', nullable: true },
                transcriptionServer: { type: 'string', nullable: true },
                textImprovement: { type: 'string', nullable: true },
                cloudflareAiAvailable: { type: 'boolean', default: false },
              },
            },
            RecordingMetadata: {
              type: 'object',
              properties: {
                userEmail: { type: 'string' },
                recordingId: { type: 'string' },
                fileName: { type: 'string' },
                displayName: { type: 'string' },
                r2Key: { type: 'string', nullable: true },
                r2Url: { type: 'string', nullable: true },
                fileSize: { type: 'integer' },
                duration: { type: 'number' },
                transcriptionText: { type: 'string' },
                transcriptionExcerpt: { type: 'string' },
                norwegianTranscription: { type: 'object', nullable: true },
                tags: { type: 'array', items: { type: 'string' } },
                category: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                publicationState: { type: 'string', enum: ['draft', 'published'] },
                publishedAt: { type: 'string', format: 'date-time', nullable: true },
                audioFormat: { type: 'string' },
                sampleRate: { type: 'integer' },
                channels: { type: 'integer' },
                aiService: { type: 'string' },
                aiModel: { type: 'string' },
                processingTime: { type: 'number' },
                transcriptionContext: { type: 'string', nullable: true },
                transcriptionServer: { type: 'string', nullable: true },
                textImprovement: { type: 'string', nullable: true },
                cloudflareAiAvailable: { type: 'boolean' },
                speakerTimeline: { type: 'array', nullable: true, items: { type: 'object' } },
                numSpeakers: { type: 'integer', nullable: true },
                speakerNames: { type: 'object', nullable: true },
                diarization: { type: 'object', nullable: true },
                conversationAnalysis: { type: 'object', nullable: true },
              },
            },
            UpdateRecordingFields: {
              type: 'object',
              description: 'Updatable recording fields',
              properties: {
                displayName: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                category: { type: 'string' },
                publicationState: { type: 'string', enum: ['draft', 'published'] },
                publishedAt: { type: 'string', format: 'date-time', nullable: true },
                speakerTimeline: { type: 'array', items: { type: 'object' } },
                numSpeakers: { type: 'integer' },
                speakerNames: { type: 'object' },
                diarization: { type: 'object' },
                conversationAnalysis: { type: 'object' },
              },
            },
            UserIndex: {
              type: 'object',
              properties: {
                userEmail: { type: 'string' },
                totalRecordings: { type: 'integer' },
                totalDuration: { type: 'number' },
                lastUpdated: { type: 'string', format: 'date-time' },
                recordingIds: { type: 'array', items: { type: 'string' } },
              },
            },
            RecordingListResponse: {
              type: 'object',
              properties: {
                recordings: { type: 'array', items: { $ref: '#/components/schemas/RecordingMetadata' } },
                total: { type: 'integer' },
                cursor: { type: 'string', nullable: true },
                userStats: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    totalRecordings: { type: 'integer' },
                    totalDuration: { type: 'number' },
                    lastUpdated: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
            ContextTemplate: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                context: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                lastUsed: { type: 'string', format: 'date-time' },
              },
            },
          },
          responses: {
            BadRequest: {
              description: 'Bad request',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            InternalError: {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
          },
        },
      }
      return new Response(JSON.stringify(spec, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    // Check KV binding
    if (!env.AUDIO_PORTFOLIO) {
      return createErrorResponse('KV binding AUDIO_PORTFOLIO not configured', 500)
    }

    try {
      // POST /save-recording - Save recording metadata to portfolio
      if (pathname === '/save-recording' && request.method === 'POST') {
        const recordingData = await request.json()

        // Log the recording data for debugging
        console.log('💾 Saving recording data:', {
          userEmail: recordingData.userEmail,
          fileName: recordingData.fileName,
          category: recordingData.category,
          hasNorwegianTranscription: !!recordingData.norwegianTranscription,
          hasImprovedText: !!recordingData.norwegianTranscription?.improved_text,
        })

        const result = await saveRecordingToPortfolio(env, recordingData)
        return createSuccessResponse(result)
      }

      // GET /list-recordings - Get user's recordings
      if (pathname === '/list-recordings' && request.method === 'GET') {
        const userEmail = url.searchParams.get('userEmail')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const userRole = url.searchParams.get('userRole') || 'user' // NEW: Get user role

        if (isSuperadminRole(userRole)) {
          const ownerEmail = url.searchParams.get('ownerEmail')
          const cursor = url.searchParams.get('cursor')
          const result = await listAllRecordings(env, limit, cursor, ownerEmail)
          return createSuccessResponse(result)
        }

        const result = await getUserRecordings(env, userEmail, limit, offset, userRole)
        return createSuccessResponse(result)
      }

      // GET /search-recordings - Search recordings
      if (pathname === '/search-recordings' && request.method === 'GET') {
        const userEmail = url.searchParams.get('userEmail')
        const query = url.searchParams.get('query')
        const limit = parseInt(url.searchParams.get('limit') || '50')

        const result = await searchRecordings(env, userEmail, query, limit)
        return createSuccessResponse(result)
      }

      // GET /list-recordings-public - Public recordings by tag (published only)
      if (pathname === '/list-recordings-public' && request.method === 'GET') {
        const tag = url.searchParams.get('tag')
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const cursor = url.searchParams.get('cursor')

        const result = await listPublicRecordings(env, tag, limit, cursor)
        return createSuccessResponse(result)
      }

      // DELETE /delete-recording - Delete recording
      if (pathname === '/delete-recording' && request.method === 'DELETE') {
        const userEmail = url.searchParams.get('userEmail')
        const recordingId = url.searchParams.get('recordingId')

        const result = await deleteRecording(env, userEmail, recordingId)
        return createSuccessResponse(result)
      }

      // PUT or POST /update-recording - Update recording metadata
      if (pathname === '/update-recording' && (request.method === 'PUT' || request.method === 'POST')) {
        let userEmail, recordingId, updates

        // Support both query params (PUT) and JSON body (POST)
        if (request.method === 'PUT') {
          userEmail = url.searchParams.get('userEmail')
          recordingId = url.searchParams.get('recordingId')
          updates = await request.json()
        } else {
          // POST request with JSON body containing id and updates
          const body = await request.json()
          userEmail = request.headers.get('X-User-Email') || body.userEmail
          recordingId = body.id || body.recordingId
          updates = body.updates || body
        }

        console.log('📝 Updating recording:', {
          userEmail,
          recordingId,
          updates: Object.keys(updates),
          hasSpeakerTimeline: !!updates.speakerTimeline,
        })

        const result = await updateRecording(env, userEmail, recordingId, updates)
        return createSuccessResponse(result)
      }

      // POST /update-publication-state - Update publication state (Superadmin only)
      if (pathname === '/update-publication-state' && request.method === 'POST') {
        const body = await request.json()
        const { userEmail, recordingId, publicationState, requestingUserRole } = body

        // Only superadmin can change publication state
        if (!isSuperadminRole(requestingUserRole)) {
          return createErrorResponse('Only superadmin can change publication state', 403)
        }

        if (!['draft', 'published'].includes(publicationState)) {
          return createErrorResponse('Invalid publication state. Must be "draft" or "published"', 400)
        }

        const updates = {
          publicationState,
          publishedAt: publicationState === 'published' ? new Date().toISOString() : null
        }

        const result = await updateRecording(env, userEmail, recordingId, updates)
        return createSuccessResponse(result)
      }

      // POST /repair-index - Add a recording to the user's index (admin maintenance)
      if (pathname === '/repair-index' && request.method === 'POST') {
        const body = await request.json()
        const { userEmail, recordingId, requestingUserRole } = body

        if (!isSuperadminRole(requestingUserRole)) {
          return createErrorResponse('Only Superadmin can repair indexes', 403)
        }

        const result = await addRecordingToIndex(env, userEmail, recordingId)
        return createSuccessResponse(result)
      }

      // GET /context-templates - Get user's saved context templates
      if (pathname === '/context-templates' && request.method === 'GET') {
        const userEmail = url.searchParams.get('userEmail')
        if (!userEmail) {
          return createErrorResponse('User email is required', 400)
        }

        const templatesKey = `context-templates:${userEmail}`
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey)
        const templates = templatesData ? JSON.parse(templatesData) : { templates: [] }

        return createSuccessResponse(templates)
      }

      // POST /context-templates - Save a new context template
      if (pathname === '/context-templates' && request.method === 'POST') {
        const body = await request.json()
        const { userEmail, name, context } = body

        if (!userEmail || !name || !context) {
          return createErrorResponse('User email, name, and context are required', 400)
        }

        const templatesKey = `context-templates:${userEmail}`
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey)
        const templates = templatesData ? JSON.parse(templatesData) : { templates: [] }

        // Add new template
        const newTemplate = {
          id: `template_${Date.now()}`,
          name,
          context,
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        }

        templates.templates.push(newTemplate)
        await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates))

        return createSuccessResponse({ template: newTemplate, allTemplates: templates })
      }

      // DELETE /context-templates - Delete a context template
      if (pathname === '/context-templates' && request.method === 'DELETE') {
        const userEmail = url.searchParams.get('userEmail')
        const templateId = url.searchParams.get('templateId')

        if (!userEmail || !templateId) {
          return createErrorResponse('User email and template ID are required', 400)
        }

        const templatesKey = `context-templates:${userEmail}`
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey)

        if (!templatesData) {
          return createErrorResponse('No templates found', 404)
        }

        const templates = JSON.parse(templatesData)
        templates.templates = templates.templates.filter(t => t.id !== templateId)

        await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates))

        return createSuccessResponse({ deleted: templateId, allTemplates: templates })
      }

      // PUT /context-templates - Update template last used timestamp
      if (pathname === '/context-templates' && request.method === 'PUT') {
        const body = await request.json()
        const { userEmail, templateId } = body

        if (!userEmail || !templateId) {
          return createErrorResponse('User email and template ID are required', 400)
        }

        const templatesKey = `context-templates:${userEmail}`
        const templatesData = await env.AUDIO_PORTFOLIO.get(templatesKey)

        if (!templatesData) {
          return createErrorResponse('No templates found', 404)
        }

        const templates = JSON.parse(templatesData)
        const template = templates.templates.find(t => t.id === templateId)

        if (template) {
          template.lastUsed = new Date().toISOString()
          await env.AUDIO_PORTFOLIO.put(templatesKey, JSON.stringify(templates))
        }

        return createSuccessResponse({ template, allTemplates: templates })
      }

      // 404 for unknown endpoints
      return createErrorResponse('Endpoint not found', 404)
    } catch (error) {
      console.error('Audio Portfolio Worker Error:', error)
      return createErrorResponse(error.message || 'Internal server error', 500)
    }
  },
}
