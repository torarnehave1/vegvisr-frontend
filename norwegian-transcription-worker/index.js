// Norwegian Audio Transcription Worker
// Handles audio transcription using Norwegian transcription service

// Norwegian model endpoints - CPU and GPU
const NORWEGIAN_CPU_ENDPOINT = 'https://oor2ob8vgl59eiht.eu-west-1.aws.endpoints.huggingface.cloud'
const NORWEGIAN_GPU_ENDPOINT = 'https://vfclin5tvetohyv0.us-east-2.aws.endpoints.huggingface.cloud'

// Helper function to safely convert ArrayBuffer to base64 (avoids call stack overflow)
const arrayBufferToBase64 = (buffer) => {
  const uint8Array = new Uint8Array(buffer)
  const chunkSize = 0x8000 // 32KB chunks
  let result = ''

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize)
    result += String.fromCharCode.apply(null, chunk)
  }

  return btoa(result)
}

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

// Helper function to call Norwegian transcription service with exponential backoff
const callNorwegianTranscription = async (base64Audio, env, useGpu = false) => {
  const maxRetries = 8 // Increased retries for longer warm-up time
  const initialDelay = 3000 // 3 seconds initial delay
  let coldStartDetected = false

  // Select endpoint based on preference
  const endpoint = useGpu ? NORWEGIAN_GPU_ENDPOINT : NORWEGIAN_CPU_ENDPOINT
  const endpointType = useGpu ? 'GPU' : 'CPU'

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🚀 Calling Norwegian transcription ${endpointType} (attempt ${attempt + 1}/${maxRetries})`)

      const payload = {
        inputs: base64Audio,
        parameters: {}
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${env.whisperailab}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log(`📊 Norwegian ${endpointType} response (attempt ${attempt + 1}):`, {
        status: response.status,
        statusText: response.statusText,
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`✅ Success with Norwegian ${endpointType} after ${attempt + 1} attempts`)
        return {
          success: true,
          result,
          modelUsed: `norwegian-${endpointType.toLowerCase()}`,
          endpoint: endpoint,
          endpointType: endpointType,
          attemptsUsed: attempt + 1,
          coldStartDetected
        }
      } else if (response.status === 503 && attempt < maxRetries - 1) {
        // Cold start detected - use exponential backoff with jitter
        coldStartDetected = true
        const baseDelay = initialDelay * Math.pow(2, Math.min(attempt, 4)) // Cap at 2^4 = 16x
        const jitter = Math.random() * 2000 // 0-2000ms random jitter
        const totalDelay = Math.min(baseDelay + jitter, 60000) // Cap at 60 seconds

        console.log(`⏳ Norwegian ${endpointType} cold start (503), waiting ${Math.round(totalDelay/1000)}s before retry... (can take 3-4 minutes total)`)

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, totalDelay))
        continue // Retry
      } else {
        // Non-503 error or max retries reached
        console.log(`❌ Norwegian ${endpointType} error:`, response.status)
        const errorText = await response.text()
        if (attempt === maxRetries - 1) {
          return {
            success: false,
            error: `Norwegian ${endpointType} error (${response.status}) after ${attempt + 1} attempts: ${errorText}`
          }
        }
        // For non-503 errors, wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    } catch (error) {
      console.error(`❌ Norwegian ${endpointType} exception (attempt ${attempt + 1}):`, error)
      if (attempt === maxRetries - 1) {
        return {
          success: false,
          error: `Norwegian ${endpointType} exception after ${attempt + 1} attempts: ${error.message}`
        }
      }
      // For network errors, also use backoff
      const baseDelay = initialDelay * Math.pow(2, Math.min(attempt, 4))
      const jitter = Math.random() * 2000
      const totalDelay = Math.min(baseDelay + jitter, 60000)
      console.log(`⏳ Network error, waiting ${Math.round(totalDelay/1000)}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, totalDelay))
    }
  }

  // All retries failed
  return {
    success: false,
    error: `Norwegian ${endpointType} failed after all retries - may need 3-4 minutes to warm up`
  }
}// Norwegian transcription handler
const handleNorwegianTranscribe = async (request, env) => {
  try {
    // Get audio URL, model, and endpoint type from query params or request body
    const url = new URL(request.url)
    let audioUrl = url.searchParams.get('url')
    let selectedModel = url.searchParams.get('model') || 'medium' // Default to medium
    let endpointType = url.searchParams.get('endpoint') || 'cpu' // Default to CPU

    if (!audioUrl && request.body) {
      const body = await request.json()
      audioUrl = body.audioUrl
      selectedModel = body.model || selectedModel
      endpointType = body.endpoint || endpointType
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

    // Convert audio buffer to base64 for Hugging Face API (chunk-based to avoid call stack overflow)
    const base64Audio = arrayBufferToBase64(audioBuffer)

    // Add debugging logs
    console.log('🎯 Audio processing details:', {
      originalFileName,
      correctedFileName,
      r2Key,
      detectedFormat: detectedFormat.format,
      detectedContentType: detectedFormat.contentType,
      audioSize: audioBuffer.byteLength,
      base64Length: base64Audio.length,
    })

    console.log('🚀 Calling transcription service with model selection:', {
      selectedModel,
      endpointType,
      fileName: correctedFileName,
      detectedFormat: detectedFormat.format,
      contentType: detectedFormat.contentType,
      audioSize: audioBuffer.byteLength,
      base64Size: base64Audio.length,
    })

    // Call Norwegian transcription service with retry logic
    const useGpu = endpointType.toLowerCase() === 'gpu'
    const transcriptionResponse = await callNorwegianTranscription(base64Audio, env, useGpu)

    if (!transcriptionResponse.success) {
      console.error('Norwegian transcription failed:', transcriptionResponse.error)
      return createErrorResponse(
        `Transcription failed: ${transcriptionResponse.error}. Model may need 3-4 minutes to warm up.`,
        502,
      )
    }

    const transcriptionResult = transcriptionResponse.result

    console.log('✅ Transcription successful:', {
      modelUsed: transcriptionResponse.modelUsed,
      attemptedModels: transcriptionResponse.attemptedModels,
      endpoint: transcriptionResponse.endpoint,
    })

    console.log('✅ Hugging Face transcription completed:', {
      hasResult: !!transcriptionResult,
      resultType: typeof transcriptionResult,
      resultPreview: JSON.stringify(transcriptionResult).substring(0, 200) + '...',
    })

    // Extract text from Hugging Face response format
    let transcriptionText = ''
    if (typeof transcriptionResult === 'string') {
      transcriptionText = transcriptionResult
    } else if (transcriptionResult.text) {
      transcriptionText = transcriptionResult.text
    } else if (Array.isArray(transcriptionResult) && transcriptionResult[0]?.text) {
      transcriptionText = transcriptionResult[0].text
    } else if (transcriptionResult.generated_text) {
      transcriptionText = transcriptionResult.generated_text
    } else {
      transcriptionText = JSON.stringify(transcriptionResult)
    }

    return createResponse(
      JSON.stringify({
        success: true,
        text: transcriptionText,
        transcription: transcriptionResult,
        language: 'no',
        service: 'Hugging Face Norwegian Transcription',
        metadata: {
          fileSize: audioBuffer.byteLength,
          fileName: originalFileName,
          processedAt: new Date().toISOString(),
          service: 'Hugging Face Norwegian Transcription',
          modelUsed: transcriptionResponse.modelUsed,
          endpoint: transcriptionResponse.endpoint,
          endpointType: transcriptionResponse.endpointType,
          requestedModel: selectedModel,
          requestedEndpoint: endpointType,
          language: 'Norwegian',
          coldStartDetected: transcriptionResponse.coldStartDetected,
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

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-File-Name',
        },
      })
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return createResponse(
        JSON.stringify({
          status: 'healthy',
          service: 'Norwegian Transcription Worker',
          version: '2.0.0',
          features: ['transcription', 'text_improvement', 'upload', 'speaker_diarization'],
          timestamp: new Date().toISOString(),
          endpoints: {
            transcribe: '/ (POST)',
            upload: '/upload (POST)',
            health: '/health (GET)',
            diarization: '/test-diarization (POST)',
          },
        }),
      )
    }

    // Speaker Diarization Test Endpoint
    if (request.method === 'POST' && url.pathname === '/test-diarization') {
      try {
        console.log('👥 Starting speaker diarization test...')

        const formData = await request.formData()
        const audioFile = formData.get('audio')

        if (!audioFile) {
          return createErrorResponse('No audio file provided', 400)
        }

        // Get audio buffer
        const audioBuffer = await audioFile.arrayBuffer()
        console.log('📊 Audio file size:', audioBuffer.byteLength, 'bytes')

        // Call Hugging Face Inference API for speaker diarization
        const response = await fetch(
          'https://api-inference.huggingface.co/models/pyannote/speaker-diarization-3.1',
          {
            headers: {
              'Authorization': `Bearer ${env.HF_TOKEN}`,
              'Content-Type': 'audio/wav',
            },
            method: 'POST',
            body: audioBuffer,
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ Diarization API error:', errorText)
          throw new Error(`Diarization API failed: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log('✅ Diarization result:', result)

        // Transform result to a more user-friendly format
        const segments = result.labels || result.segments || []
        const numSpeakers = new Set(segments.map(s => s.label || s.speaker)).size

        return createResponse(JSON.stringify({
          success: true,
          segments: segments.map(seg => ({
            speaker: seg.label || seg.speaker || 'Unknown',
            start: seg.start || 0,
            end: seg.end || 0,
          })),
          num_speakers: numSpeakers,
          raw_result: result,
        }))

      } catch (error) {
        console.error('❌ Diarization test error:', error)
        return createErrorResponse(`Diarization test failed: ${error.message}`, 500)
      }
    }

    // Upload endpoint - for uploading audio files to R2
    if (request.method === 'POST' && url.pathname === '/upload') {
      return handleUpload(request, env)
    }

    // Transcription endpoint - transcribe from R2 URL
    if (request.method === 'POST' && url.pathname === '/transcribe-from-url') {
      return handleNorwegianTranscribe(request, env)
    }

    // Main transcription endpoint (default behavior)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    try {
      const formData = await request.formData()
      const audioFile = formData.get('audio')
      const model = formData.get('model') || 'medium' // Use our new model system
      const endpoint = formData.get('endpoint') || 'cpu' // Default to CPU endpoint
      const context = formData.get('context') || ''

      if (!audioFile) {
        return new Response(JSON.stringify({ error: 'No audio file provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const startTime = Date.now()

      // Step 1: Call transcription service with fallback
      const audioBuffer = await audioFile.arrayBuffer()
      const base64Audio = arrayBufferToBase64(audioBuffer)

      console.log('🚀 Calling transcription service with model selection:', {
        selectedModel: model,
        endpointType: endpoint,
        hasAudio: !!audioFile,
        audioSize: audioBuffer.byteLength,
        base64Size: base64Audio.length,
        hasContext: !!context,
        timestamp: new Date().toISOString(),
      })

      // Use Norwegian transcription service
      const useGpu = endpoint.toLowerCase() === 'gpu'
      const transcriptionResponse = await callNorwegianTranscription(base64Audio, env, useGpu)

      if (!transcriptionResponse.success) {
        console.error('Norwegian transcription failed:', transcriptionResponse.error)
        throw new Error(transcriptionResponse.error)
      }

      const transcriptionData = transcriptionResponse.result

      console.log('✅ Transcription successful:', {
        modelUsed: transcriptionResponse.modelUsed,
        endpoint: transcriptionResponse.endpoint,
        attempts: transcriptionResponse.attemptsUsed,
      })

      // Extract text from Hugging Face response format
      let rawText = ''
      if (typeof transcriptionData === 'string') {
        rawText = transcriptionData
      } else if (transcriptionData.text) {
        rawText = transcriptionData.text
      } else if (Array.isArray(transcriptionData) && transcriptionData[0]?.text) {
        rawText = transcriptionData[0].text
      } else if (transcriptionData.generated_text) {
        rawText = transcriptionData.generated_text
      } else {
        throw new Error('Invalid transcription response format')
      }

      if (!rawText) {
        throw new Error('No transcription text received')
      }

      // Step 2: Call Norwegian text improvement worker using service binding
      let improvedText = null
      let improvementTime = 0

      try {
        const improvementStart = Date.now()

        // Use service binding instead of HTTP fetch
        const improvementRequest = new Request('https://dummy-url/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: rawText,
            context: context,
          }),
        })

        const improvementResponse = await env.NORWEGIAN_TEXT_WORKER.fetch(improvementRequest)

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
            language: 'no',
            chunks: 1,
            processing_time: 0,
            improvement_time: improvementTime,
            timestamp: new Date().toISOString(),
          },
          metadata: {
            filename: audioFile.name,
            model: model,
            modelUsed: transcriptionResponse.modelUsed,
            endpoint: transcriptionResponse.endpoint,
            endpointType: transcriptionResponse.endpointType,
            requestedModel: model,
            requestedEndpoint: endpoint,
            total_processing_time: totalTime,
            transcription_server: 'Hugging Face',
            coldStartDetected: transcriptionResponse.coldStartDetected,
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
