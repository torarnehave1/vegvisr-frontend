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
const getUserRecordings = async (env, userEmail, limit = 50, offset = 0) => {
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
        recordings.push(JSON.parse(recordingData))
      }
    }

    // Sort by creation date (newest first)
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      recordings,
      total: index.totalRecordings,
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

    // Update allowed fields (expanded to include speaker identification fields)
    const allowedUpdates = [
      'displayName',
      'tags',
      'category',
      'speakerTimeline',
      'numSpeakers',
      'speakerNames'
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

        const result = await getUserRecordings(env, userEmail, limit, offset)
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

      // 404 for unknown endpoints
      return createErrorResponse('Endpoint not found', 404)
    } catch (error) {
      console.error('Audio Portfolio Worker Error:', error)
      return createErrorResponse(error.message || 'Internal server error', 500)
    }
  },
}
