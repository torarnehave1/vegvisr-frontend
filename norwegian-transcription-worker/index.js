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

// Helper function to detect actual audio format from buffer headers
const detectAudioFormat = (audioBuffer) => {
  const audioArray = new Uint8Array(audioBuffer)
  const header = Array.from(audioArray.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // WebM container (EBML header)
  if (header.startsWith('1a45dfa3')) {
    return { contentType: 'audio/webm', extension: '.webm', format: 'WebM' }
  }

  // WAV format (RIFF header)
  if (header.startsWith('52494646')) {
    // "RIFF"
    return { contentType: 'audio/wav', extension: '.wav', format: 'WAV' }
  }

  // MP3 format (ID3 or direct MP3 header)
  if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3')) {
    return { contentType: 'audio/mpeg', extension: '.mp3', format: 'MP3' }
  }

  // M4A/MP4 format (ftyp header)
  if (header.includes('66747970')) {
    // "ftyp"
    return { contentType: 'audio/mp4', extension: '.m4a', format: 'M4A' }
  }

  // FLAC format
  if (header.startsWith('664c6143')) {
    // "fLaC"
    return { contentType: 'audio/flac', extension: '.flac', format: 'FLAC' }
  }

  // Default fallback
  return { contentType: 'audio/wav', extension: '.wav', format: 'Unknown' }
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

    // Use the existing audio.vegvisr.org domain for consistency with whisper-worker
    const audioUrl = `https://audio.vegvisr.org/${r2Key}`

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
    if (audioUrl.includes('audio.vegvisr.org/')) {
      r2Key = audioUrl.split('audio.vegvisr.org/')[1]
    } else if (audioUrl.includes('.r2.cloudflarestorage.com/')) {
      r2Key = audioUrl.split('.r2.cloudflarestorage.com/')[1]
    } else {
      console.error('URL parsing failed:', {
        audioUrl,
        expectedPatterns: ['audio.vegvisr.org/', '.r2.cloudflarestorage.com/'],
      })
      return createErrorResponse(`Invalid audio URL format: ${audioUrl}`, 400)
    }

    // Download audio file from R2
    console.log('📥 Downloading audio from R2:', { r2Key, bucketBinding: 'NORWEGIAN_AUDIO_BUCKET' })
    const audioObject = await env.NORWEGIAN_AUDIO_BUCKET.get(r2Key)

    if (!audioObject) {
      console.error('R2 file not found:', { r2Key, bucketBinding: 'NORWEGIAN_AUDIO_BUCKET' })
      return createErrorResponse(`Audio file not found: ${r2Key}`, 404)
    }

    const audioBuffer = await audioObject.arrayBuffer()
    console.log('📁 Audio downloaded:', {
      size: audioBuffer.byteLength,
      sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
    })

    // Detect actual audio format from buffer headers
    const detectedFormat = detectAudioFormat(audioBuffer)
    console.log('📝 Detected audio format:', {
      format: detectedFormat.format,
      contentType: detectedFormat.contentType,
      extension: detectedFormat.extension,
    })

    // Get original filename from metadata or use default
    const originalFileName = audioObject.customMetadata?.originalFileName || 'audio.wav'
    const correctedFileName = originalFileName.replace(/\.[^.]+$/, detectedFormat.extension)

    // Prepare FormData for Norwegian transcription service
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: detectedFormat.contentType })

    // Add debugging logs similar to whisper-worker
    console.log('🎯 Audio blob details:', {
      originalFileName,
      correctedFileName,
      r2Key,
      detectedFormat: detectedFormat.format,
      detectedContentType: detectedFormat.contentType,
      blobSize: audioBuffer.byteLength,
      blobType: audioBlob.type,
    })

    formData.append('audio', audioBlob, correctedFileName)
    formData.append('language', 'no') // Norwegian language code

    console.log('🚀 Calling Norwegian transcription service:', {
      endpoint: 'http://46.62.149.157/transcribe',
      fileName: correctedFileName,
      detectedFormat: detectedFormat.format,
      contentType: detectedFormat.contentType,
      audioSize: audioBuffer.byteLength,
    })

    // Call the Norwegian transcription service with API token
    console.log('📤 Sending FormData to Norwegian service...')
    const norwegianResponse = await fetch('https://transcribe.vegvisr.org/transcribe', {
      method: 'POST',
      headers: {
        'X-API-Token': 'vegvisr_transcribe_2024_secure_token',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9,no;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        Origin: 'https://vegvisr.org',
        Referer: 'https://vegvisr.org/',
      },
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
          endpoint: 'https://transcribe.vegvisr.org/transcribe',
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
  async fetch(request, env, ctx) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const formData = await request.formData()
      const audioFile = formData.get('audio')
      const model = formData.get('model') || 'nb-whisper-small'

      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'No audio file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const startTime = Date.now()

      // Step 1: Call Hetzner server for transcription
      const transcriptionFormData = new FormData()
      transcriptionFormData.append('audio', audioFile)
      transcriptionFormData.append('model', model)

      console.log('About to call transcription service:', {
        url: 'https://transcribe.vegvisr.org/transcribe',
        hasAudio: !!audioFile,
        model: model,
        timestamp: new Date().toISOString(),
      })

      const transcriptionResponse = await fetch('https://transcribe.vegvisr.org/transcribe', {
        method: 'POST',
        headers: {
          'X-API-Token': 'vegvisr_transcribe_2024_secure_token',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Accept: '*/*',
        },
        body: transcriptionFormData,
      })

      console.log('Transcription response:', {
        status: transcriptionResponse.status,
        statusText: transcriptionResponse.statusText,
        headers: Object.fromEntries(transcriptionResponse.headers.entries()),
      })

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text()
        console.log('Error response body:', errorText)
        throw new Error(`Transcription failed: ${transcriptionResponse.status}`)
      }

      const transcriptionData = await transcriptionResponse.json()

      if (!transcriptionData.success || !transcriptionData.transcription?.text) {
        throw new Error('Invalid transcription response')
      }

      const rawText = transcriptionData.transcription.text

      // Step 2: Call Norwegian text improvement worker
      let improvedText = null
      let improvementTime = 0

      try {
        const improvementStart = Date.now()

        const improvementResponse = await fetch(
          'https://norwegian-text-worker.torarnehave.workers.dev/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: rawText,
            }),
          },
        )

        if (improvementResponse.ok) {
          const improvementData = await improvementResponse.json()
          if (improvementData.success && improvementData.improved_text) {
            improvedText = improvementData.improved_text
            improvementTime = Date.now() - improvementStart
          }
        }
      } catch (error) {
        console.error('Text improvement failed:', error)
        // Continue without improvement if it fails
      }

      const totalTime = Date.now() - startTime

      // Step 3: Return combined response
      return new Response(
        JSON.stringify({
          success: true,
          transcription: {
            raw_text: rawText,
            improved_text: improvedText,
            language: transcriptionData.transcription.language || 'no',
            chunks: transcriptionData.transcription.chunks || 1,
            processing_time: transcriptionData.transcription.processing_time || 0,
            improvement_time: improvementTime,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            filename: audioFile.name,
            model: transcriptionData.metadata?.model || model,
            total_processing_time: totalTime,
            transcription_server: 'Hetzner',
            text_improvement: improvedText
              ? 'Cloudflare Workers AI - Llama 3.3 70B Fast'
              : 'Not available',
            cloudflare_ai_available: improvedText !== null,
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    } catch (error) {
      console.error('Norwegian transcription error:', error)

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Transcription failed',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      )
    }
  },
}
