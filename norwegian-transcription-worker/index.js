// Norwegian Audio Transcription Worker
// Handles audio transcription using Norwegian transcription service

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-File-Name, X-Chunk-Index, X-Total-Chunks, X-Upload-Id',
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

// Helper function to validate audio format
const isValidAudioFormat = (contentType, fileName) => {
  const validMimeTypes = [
    'audio/wav',
    'audio/wave',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/flac',
    'audio/webm',
  ]
  const validExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.webm']

  // Check MIME type
  if (contentType && validMimeTypes.includes(contentType.toLowerCase())) {
    return true
  }

  // Check file extension if provided
  if (fileName) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return validExtensions.includes(extension)
  }

  return false
}

// Helper function to get audio content type from file extension
const getAudioContentType = (fileName) => {
  if (!fileName) return 'audio/wav'

  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))

  switch (extension) {
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.m4a':
      return 'audio/mp4'
    case '.webm':
      return 'audio/webm'
    default:
      return 'audio/wav'
  }
}

// Audio upload handler
const handleUpload = async (request, env) => {
  try {
    // Get upload parameters
    const contentType = request.headers.get('Content-Type')
    const fileName = request.headers.get('X-File-Name') || 'audio.wav'

    console.log('📤 Norwegian Upload request:', {
      fileName,
      contentType,
      hasBody: !!request.body,
      timestamp: new Date().toISOString(),
    })

    // Validate audio format
    const audioContentType = contentType || getAudioContentType(fileName)
    if (!isValidAudioFormat(contentType, fileName)) {
      return createErrorResponse(
        'Invalid audio format. Supported formats: WAV, MP3, M4A, FLAC.',
        400,
      )
    }

    // Generate R2 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const r2Key = `norwegian-audio/${timestamp}-${fileName}`

    // Upload to R2
    const audioBuffer = await request.arrayBuffer()
    await env.NORWEGIAN_AUDIO_BUCKET.put(r2Key, audioBuffer, {
      httpMetadata: {
        contentType: audioContentType,
      },
      customMetadata: {
        originalFileName: fileName,
        service: 'norwegian-transcription',
      },
    })

    console.log('✅ Norwegian upload completed:', {
      r2Key,
      size: audioBuffer.byteLength,
    })

    if (!env.ACCOUNT_ID) {
      return createErrorResponse('Server configuration error: ACCOUNT_ID not configured', 500)
    }

    const audioUrl = `https://norwegian-audio.vegvisr.org/${r2Key}`

    return createResponse(
      JSON.stringify({
        success: true,
        audioUrl: audioUrl,
        r2Key: r2Key,
        fileName: fileName,
        size: audioBuffer.byteLength,
        contentType: audioContentType,
        message: 'Audio uploaded successfully',
      }),
    )
  } catch (error) {
    console.error('Norwegian upload error:', error)
    return createErrorResponse(`Upload failed: ${error.message}`, 500)
  }
}

// Norwegian transcription handler
const handleNorwegianTranscribe = async (request, env) => {
  try {
    // Get audio URL from query params or request body
    const url = new URL(request.url)
    let audioUrl = url.searchParams.get('url')

    if (!audioUrl && request.body) {
      const body = await request.json()
      audioUrl = body.audioUrl
    }

    if (!audioUrl) {
      return createErrorResponse('Missing required audio URL parameter', 400)
    }

    console.log('🇳🇴 Norwegian transcription request:', {
      audioUrl,
      timestamp: new Date().toISOString(),
    })

    // Extract R2 key from URL
    let r2Key
    if (audioUrl.includes('norwegian-audio.vegvisr.org/')) {
      r2Key = audioUrl.split('norwegian-audio.vegvisr.org/')[1]
    } else if (audioUrl.includes('.r2.cloudflarestorage.com/')) {
      r2Key = audioUrl.split('.r2.cloudflarestorage.com/')[1]
    } else {
      return createErrorResponse('Invalid audio URL format', 400)
    }

    // Download audio file from R2
    console.log('📥 Downloading audio from R2:', r2Key)
    const audioObject = await env.NORWEGIAN_AUDIO_BUCKET.get(r2Key)

    if (!audioObject) {
      return createErrorResponse(`Audio file not found: ${r2Key}`, 404)
    }

    const audioBuffer = await audioObject.arrayBuffer()
    console.log('📁 Audio downloaded:', {
      size: audioBuffer.byteLength,
      sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
    })

    // Prepare FormData for Norwegian transcription service
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' })

    // Get original filename from metadata or use default
    const originalFileName = audioObject.customMetadata?.originalFileName || 'audio.wav'

    formData.append('audio', audioBlob, originalFileName)
    formData.append('language', 'no') // Norwegian language code

    console.log('🚀 Calling Norwegian transcription service:', {
      endpoint: 'http://46.62.149.157/transcribe',
      fileName: originalFileName,
      audioSize: audioBuffer.byteLength,
    })

    // Call the Norwegian transcription service
    const norwegianResponse = await fetch('http://46.62.149.157/transcribe', {
      method: 'POST',
      body: formData,
    })

    console.log('🇳🇴 Norwegian API response:', {
      status: norwegianResponse.status,
      statusText: norwegianResponse.statusText,
      headers: Object.fromEntries(norwegianResponse.headers.entries()),
    })

    if (!norwegianResponse.ok) {
      const errorText = await norwegianResponse.text()
      console.error('Norwegian API error:', errorText)
      return createErrorResponse(
        `Norwegian transcription service error: ${norwegianResponse.status} - ${errorText}`,
        502,
      )
    }

    const transcriptionResult = await norwegianResponse.json()

    console.log('✅ Norwegian transcription completed:', {
      hasResult: !!transcriptionResult,
      hasText: !!transcriptionResult.text,
      textPreview: transcriptionResult.text?.substring(0, 100) + '...' || 'no-text',
    })

    return createResponse(
      JSON.stringify({
        success: true,
        text: transcriptionResult.text || transcriptionResult,
        transcription: transcriptionResult,
        language: 'no',
        service: 'Norwegian Transcription Service',
        metadata: {
          fileSize: audioBuffer.byteLength,
          fileName: originalFileName,
          processedAt: new Date().toISOString(),
          service: 'Norwegian Transcription Service',
          endpoint: 'http://46.62.149.157/transcribe',
          language: 'Norwegian',
        },
      }),
    )
  } catch (error) {
    console.error('Norwegian transcription error:', error)
    return createErrorResponse(`Norwegian transcription failed: ${error.message}`, 500)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Log all incoming requests
    console.log('🔍 Norwegian Worker Request:', {
      method: request.method,
      pathname: pathname,
      contentType: request.headers.get('Content-Type'),
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
      return createResponse(
        JSON.stringify({
          status: 'healthy',
          service: 'Norwegian Transcription Worker',
          timestamp: new Date().toISOString(),
          endpoints: [
            '/health - Service status',
            'POST /upload - Upload audio file',
            'POST /transcribe-norwegian - Transcribe with Norwegian service',
            'GET /transcribe-norwegian?url=... - Transcribe from URL',
          ],
          norwegianService: 'http://46.62.149.157/transcribe',
          language: 'Norwegian (no)',
        }),
      )
    }

    // Audio upload endpoint
    if (pathname === '/upload' && request.method === 'POST') {
      return await handleUpload(request, env)
    }

    // Norwegian transcription endpoint
    if (
      pathname === '/transcribe-norwegian' &&
      (request.method === 'POST' || request.method === 'GET')
    ) {
      return await handleNorwegianTranscribe(request, env)
    }

    // Fallback - return 404 for unmatched routes
    console.log('❌ No route matched:', {
      pathname: pathname,
      method: request.method,
      availableRoutes: [
        '/health',
        'POST /upload',
        'POST /transcribe-norwegian',
        'GET /transcribe-norwegian',
      ],
    })

    return createErrorResponse('Not Found', 404)
  },
}
