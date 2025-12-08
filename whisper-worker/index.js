// Whisper Audio Transcription Worker
// Handles audio transcription using Cloudflare Workers AI (@cf/openai/whisper)

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
    'audio/ogg',
    'audio/ogg; codecs=opus',
  ]
  const validExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.webm', '.ogg', '.opus']

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

  // OGG/Opus container (OggS header)
  if (header.startsWith('4f676753')) {
    return { contentType: 'audio/ogg', extension: '.ogg', format: 'OGG/Opus' }
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

// Helper function to get audio content type from file extension (legacy)
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

// Audio upload handler (with chunked support)
const handleUpload = async (request, env) => {
  try {
    // Get upload parameters
    const contentType = request.headers.get('Content-Type')
    const fileName = request.headers.get('X-File-Name') || 'audio.wav'
    const chunkIndex = request.headers.get('X-Chunk-Index')
    const totalChunks = request.headers.get('X-Total-Chunks')
    const uploadId = request.headers.get('X-Upload-Id') || crypto.randomUUID()

    console.log('📤 Upload request:', {
      fileName,
      contentType,
      chunkIndex,
      totalChunks,
      uploadId,
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
    const r2Key = chunkIndex
      ? `temp/${uploadId}/chunk-${chunkIndex}.part`
      : `audio/${timestamp}-${fileName}`

    // Upload to R2 - back to working direct file method
    const audioBuffer = await request.arrayBuffer()
    await env.WHISPER_BUCKET.put(r2Key, audioBuffer, {
      httpMetadata: {
        contentType: audioContentType,
      },
      customMetadata: {
        originalFileName: fileName,
        uploadId: uploadId,
        chunkIndex: chunkIndex || '0',
        totalChunks: totalChunks || '1',
      },
    })

    console.log('✅ Upload completed:', {
      r2Key,
      size: audioBuffer.byteLength,
      chunks: totalChunks ? `${chunkIndex}/${totalChunks}` : 'single',
    })

    // If this is a chunked upload and not the last chunk, return upload progress
    if (totalChunks && parseInt(chunkIndex) < parseInt(totalChunks) - 1) {
      return createResponse(
        JSON.stringify({
          success: true,
          uploadId,
          chunkIndex: parseInt(chunkIndex),
          totalChunks: parseInt(totalChunks),
          status: 'chunk_uploaded',
          message: `Chunk ${parseInt(chunkIndex) + 1}/${totalChunks} uploaded`,
        }),
      )
    }

    // If chunked upload is complete, combine chunks
    if (totalChunks && parseInt(totalChunks) > 1) {
      const finalKey = `audio/${timestamp}-${fileName}`
      await combineChunks(
        env.WHISPER_BUCKET,
        uploadId,
        parseInt(totalChunks),
        finalKey,
        audioContentType,
        fileName,
      )

      // Clean up chunk files
      for (let i = 0; i < parseInt(totalChunks); i++) {
        await env.WHISPER_BUCKET.delete(`temp/${uploadId}/chunk-${i}.part`)
      }

      if (!env.ACCOUNT_ID) {
        return createErrorResponse('Server configuration error: ACCOUNT_ID not configured', 500)
      }

      const audioUrl = `https://audio.vegvisr.org/${finalKey}`

      console.log('✅ Generated R2 URL for combined chunks:', {
        accountId: env.ACCOUNT_ID,
        finalKey: finalKey,
        fullUrl: audioUrl,
        bucketName: 'whisper-audio-temp',
      })

      return createResponse(
        JSON.stringify({
          success: true,
          uploadId,
          r2Key: finalKey,
          audioUrl,
          message: 'Chunked upload completed and combined',
          fileSize: 'combined',
        }),
      )
    }

    // Single file upload
    if (!env.ACCOUNT_ID) {
      return createErrorResponse('Server configuration error: ACCOUNT_ID not configured', 500)
    }

    const audioUrl = `https://audio.vegvisr.org/${r2Key}`

    console.log('✅ Generated R2 URL:', {
      accountId: env.ACCOUNT_ID,
      r2Key: r2Key,
      fullUrl: audioUrl,
      bucketName: 'whisper-audio-temp',
    })

    return createResponse(
      JSON.stringify({
        success: true,
        uploadId,
        r2Key,
        audioUrl,
        fileSize: audioBuffer.byteLength,
        message: 'Audio uploaded successfully',
      }),
    )
  } catch (error) {
    console.error('Upload error:', error)
    return createErrorResponse(`Upload failed: ${error.message}`, 500)
  }
}

// Helper function to combine chunks
const combineChunks = async (bucket, uploadId, totalChunks, finalKey, contentType, fileName) => {
  const chunks = []

  // Retrieve all chunks
  for (let i = 0; i < totalChunks; i++) {
    const chunkKey = `temp/${uploadId}/chunk-${i}.part`
    const chunk = await bucket.get(chunkKey)
    if (chunk) {
      chunks.push(await chunk.arrayBuffer())
    }
  }

  // Combine chunks
  const totalSize = chunks.reduce((size, chunk) => size + chunk.byteLength, 0)
  const combinedBuffer = new Uint8Array(totalSize)
  let offset = 0

  for (const chunk of chunks) {
    combinedBuffer.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  // Upload combined file
  await bucket.put(finalKey, combinedBuffer, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      originalFileName: fileName,
      combined: 'true',
    },
  })
}

// Main transcription handler (supports both URL and direct file processing)
const handleTranscribe = async (request, env) => {
  try {
    // Validate required bindings
    if (!env.HF_API_TOKEN) {
      return createErrorResponse('Internal Server Error: HF_API_TOKEN not configured', 500)
    }

    // Check for audio URL parameter (preferred method for large files)
    const url = new URL(request.url)
    const audioUrl = url.searchParams.get('url')

    if (audioUrl) {
      // URL-based transcription (memory efficient)
      return await transcribeFromUrl(audioUrl, env)
    }

    // Direct file transcription (for smaller files)
    if (!request.body) {
      return createErrorResponse('Missing audio file in request body or url parameter', 400)
    }

    // Get content type and file info from headers
    const contentType = request.headers.get('Content-Type')
    const fileName = request.headers.get('X-File-Name') || 'audio.wav'
    const audioContentType = contentType || getAudioContentType(fileName)

    console.log('🎵 Direct transcribe request received:', {
      contentType,
      fileName,
      audioContentType,
      hasBody: !!request.body,
      timestamp: new Date().toISOString(),
    })

    // Validate audio format
    if (!isValidAudioFormat(contentType, fileName)) {
      return createErrorResponse(
        'Invalid audio format. Supported formats: WAV, MP3, M4A, FLAC.',
        400,
      )
    }

    // Check file size to prevent memory issues
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      // 10MB limit
      return createErrorResponse(
        'File too large for direct processing. Use /upload endpoint first, then /transcribe?url=...',
        413,
      )
    }

    // Read the audio file
    const audioBuffer = await request.arrayBuffer()

    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return createErrorResponse('Empty or invalid audio file', 400)
    }

    console.log('📝 Direct audio processing:', {
      originalSize: audioBuffer.byteLength,
      fileType: audioContentType,
    })

    // For smaller files, use Cloudflare Workers AI (but be careful with memory)
    if (audioBuffer.byteLength <= 5 * 1024 * 1024) {
      // 5MB limit for direct AI processing
      console.log('🤖 Using Cloudflare Workers AI for small file...')

      let transcriptionResult
      try {
        transcriptionResult = await env.AI.run('@cf/openai/whisper', {
          audio: [...new Uint8Array(audioBuffer)],
          // Language auto-detection enabled
        })
      } catch (aiError) {
        console.error('Cloudflare AI error:', aiError)
        return createErrorResponse(
          `Cloudflare Workers AI transcription failed: ${aiError.message}`,
          500,
        )
      }

      return createResponse(
        JSON.stringify({
          success: true,
          text: transcriptionResult.text || transcriptionResult,
          transcription: transcriptionResult,
          model: '@cf/openai/whisper',
          metadata: {
            fileSize: audioBuffer.byteLength,
            format: audioContentType,
            processedAt: new Date().toISOString(),
            service: 'Cloudflare Workers AI (Direct)',
          },
        }),
      )
    } else {
      return createErrorResponse(
        'File too large for direct processing. Use /upload endpoint first for files over 5MB.',
        413,
      )
    }
  } catch (error) {
    console.error('Transcription error:', error)
    return createErrorResponse(`Transcription failed: ${error.message}`, 500)
  }
}

// URL-based transcription using Cloudflare Workers AI (for large files from R2)
const transcribeFromUrl = async (audioUrl, env, options = {}) => {
  try {
    const { service = 'cloudflare', model = 'whisper-1', language, temperature = '0' } = options

    console.log('🎵 URL-based transcription request:', {
      audioUrl,
      service,
      model,
      language,
      temperature,
      timestamp: new Date().toISOString(),
    })

    // Extract R2 key from URL (supports both custom domain and R2 direct URLs)
    let r2Key
    if (audioUrl.includes('audio.vegvisr.org/')) {
      r2Key = audioUrl.split('audio.vegvisr.org/')[1]
    } else if (audioUrl.includes('.r2.cloudflarestorage.com/')) {
      r2Key = audioUrl.split('.r2.cloudflarestorage.com/')[1]
    } else {
      console.error('Invalid audio URL format:', audioUrl)
      return createErrorResponse(
        `Invalid audio URL format. Expected: https://audio.vegvisr.org/... or R2 direct URL`,
        400,
      )
    }
    if (!r2Key) {
      console.error('Could not extract R2 key from URL:', audioUrl)
      return createErrorResponse('Invalid R2 URL: could not extract file key', 400)
    }

    // Download audio file directly from R2 bucket binding
    console.log('📥 Downloading audio from R2 bucket binding:', {
      r2Key,
      service: service,
      model: model,
      language: language,
      temperature: temperature,
    })

    const audioObject = await env.WHISPER_BUCKET.get(r2Key)

    if (!audioObject) {
      console.error('Audio file not found in R2 bucket:', {
        r2Key,
        bucketName: 'whisper-audio-temp',
      })
      return createErrorResponse(`Audio file not found in R2 storage: ${r2Key}`, 404)
    }

    const audioBuffer = await audioObject.arrayBuffer()
    console.log('📁 Audio downloaded via bucket binding:', {
      r2Key,
      size: audioBuffer.byteLength,
      sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
    })

    // Route to appropriate transcription service
    if (service === 'openai') {
      return await transcribeFromUrlWithOpenAI(audioBuffer, audioUrl, env, {
        model,
        language,
        temperature,
      })
    } else {
      return await transcribeFromUrlWithCloudflare(audioBuffer, audioUrl, env)
    }
  } catch (error) {
    console.error('URL transcription error:', error)
    return createErrorResponse(`URL-based transcription failed: ${error.message}`, 500)
  }
}

// Cloudflare Workers AI transcription from R2
const transcribeFromUrlWithCloudflare = async (audioBuffer, audioUrl, env) => {
  console.log('🤖 Processing with Cloudflare Workers AI...')

  let transcriptionResult
  try {
    transcriptionResult = await env.AI.run('@cf/openai/whisper', {
      audio: [...new Uint8Array(audioBuffer)],
      // Language auto-detection enabled
    })
  } catch (aiError) {
    console.error('Cloudflare AI error:', aiError)
    return createErrorResponse(
      `Cloudflare Workers AI transcription failed: ${aiError.message}`,
      500,
    )
  }

  console.log('✅ Cloudflare AI transcription completed:', {
    hasResult: !!transcriptionResult,
    resultType: typeof transcriptionResult,
  })

  return createResponse(
    JSON.stringify({
      success: true,
      text: transcriptionResult.text || transcriptionResult,
      transcription: transcriptionResult,
      model: '@cf/openai/whisper',
      metadata: {
        audioUrl,
        fileSize: audioBuffer.byteLength,
        processedAt: new Date().toISOString(),
        service: 'Cloudflare Workers AI (from R2)',
      },
    }),
  )
}

// OpenAI API transcription from R2
const transcribeFromUrlWithOpenAI = async (audioBuffer, audioUrl, env, options) => {
  const { model, language, temperature } = options

  if (!env.OPENAI_API_KEY) {
    return createErrorResponse('OpenAI API key not configured', 500)
  }

  console.log('🔥 Processing with OpenAI API from R2:', {
    model,
    language,
    temperature,
  })

  // Extract filename from URL for proper content type detection (supports custom domain)
  let r2Key
  if (audioUrl.includes('audio.vegvisr.org/')) {
    r2Key = audioUrl.split('audio.vegvisr.org/')[1]
  } else if (audioUrl.includes('.r2.cloudflarestorage.com/')) {
    r2Key = audioUrl.split('.r2.cloudflarestorage.com/')[1]
  } else {
    r2Key = 'audio-from-unknown-source.wav'
  }
  const originalFileName = r2Key ? r2Key.split('/').pop() : 'audio-from-r2.wav'

  // Detect actual audio format from buffer content
  const detectedFormat = detectAudioFormat(audioBuffer)
  const actualFileName = originalFileName.replace(/\.[^.]+$/, detectedFormat.extension)

  // Create FormData for multipart/form-data request with correct format
  const formData = new FormData()
  const audioBlob = new Blob([audioBuffer], { type: detectedFormat.contentType })

  // Generate audio buffer checksum for debugging
  const audioArray = new Uint8Array(audioBuffer)
  const audioChecksum = Array.from(audioArray.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const audioHeader = Array.from(audioArray.slice(0, 20))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')

  console.log('🎯 R2 Audio blob details:', {
    originalFileName,
    correctedFileName: actualFileName,
    r2Key,
    detectedFormat: detectedFormat.format,
    detectedContentType: detectedFormat.contentType,
    blobSize: audioBuffer.byteLength,
    blobType: audioBlob.type,
  })

  console.log('🔬 R2 Audio format detection:', {
    checksum: audioChecksum,
    header: audioHeader,
    detectedFormat: detectedFormat.format,
    wasCorrectlyDetected: true,
    bufferIntegrity: audioBuffer.byteLength > 0 && audioBuffer.byteLength === audioBlob.size,
  })

  formData.append('file', audioBlob, actualFileName)
  formData.append('model', model)

  console.log('📋 R2 FormData structure:', {
    originalFileName: originalFileName,
    correctedFileName: actualFileName,
    model: model,
    language: language || 'not-set',
    temperature: temperature,
    hasLanguageParam: !!(language && model === 'whisper-1'),
    actualFormat: detectedFormat.format,
    contentType: detectedFormat.contentType,
  })

  // Only add language if specified and using whisper-1 model
  if (language && model === 'whisper-1') {
    formData.append('language', language)
  }

  formData.append('temperature', temperature)
  formData.append('response_format', 'json')

  // Call OpenAI API
  console.log('🚀 Calling OpenAI API from R2...')
  console.log('📤 R2 Request headers:', {
    Authorization: `Bearer ${env.OPENAI_API_KEY?.substring(0, 10)}...`,
    'Content-Type': 'multipart/form-data (FormData)',
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    method: 'POST',
  })

  const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: formData,
  })

  console.log('🤖 OpenAI API response:', {
    status: openaiResponse.status,
    statusText: openaiResponse.statusText,
  })

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text()
    console.error('🚨 R2 OpenAI API error:', {
      status: openaiResponse.status,
      statusText: openaiResponse.statusText,
      body: errorText,
      responseHeaders: Object.fromEntries(openaiResponse.headers.entries()),
      requestType: 'R2-download',
    })

    return createErrorResponse(
      `OpenAI API error: ${openaiResponse.status} - ${openaiResponse.statusText}`,
      502,
    )
  }

  const transcriptionResult = await openaiResponse.json()

  console.log('✅ R2 OpenAI transcription completed:', {
    hasResult: !!transcriptionResult,
    resultType: typeof transcriptionResult,
    hasText: !!transcriptionResult.text,
    textPreview: transcriptionResult.text?.substring(0, 50) + '...' || 'no-text',
    requestType: 'R2-download',
    model: model,
  })

  return createResponse(
    JSON.stringify({
      success: true,
      text: transcriptionResult.text || transcriptionResult,
      transcription: transcriptionResult,
      model: model,
      metadata: {
        audioUrl,
        fileSize: audioBuffer.byteLength,
        language: language,
        temperature: temperature,
        processedAt: new Date().toISOString(),
        service: 'OpenAI Direct API (from R2)',
      },
    }),
  )
}

// Direct OpenAI API transcription
const transcribeWithOpenAI = async (request, env) => {
  try {
    if (!env.OPENAI_API_KEY) {
      return createErrorResponse('OpenAI API key not configured', 500)
    }

    console.log('🔥 OpenAI direct transcription request:', {
      timestamp: new Date().toISOString(),
    })

    // Get parameters from request
    const contentType = request.headers.get('Content-Type')
    const fileName = request.headers.get('X-File-Name') || 'audio.wav'

    // Get model from query params or default to whisper-1
    const url = new URL(request.url)
    const model = url.searchParams.get('model') || 'whisper-1'
    const language = url.searchParams.get('language') // Auto-detect if not specified
    const temperature = url.searchParams.get('temperature') || '0'
    const responseFormat = url.searchParams.get('response_format') || 'json'

    console.log('🎯 OpenAI parameters:', {
      model,
      language: language || 'auto-detect',
      temperature,
      responseFormat,
      fileName,
    })

    if (!isValidAudioFormat(contentType, fileName)) {
      return createErrorResponse(
        'Invalid audio format. Supported formats: WAV, MP3, M4A, FLAC.',
        400,
      )
    }

    const audioBuffer = await request.arrayBuffer()
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      return createErrorResponse('Empty or invalid audio file', 400)
    }

    console.log('📁 Audio file info:', {
      size: audioBuffer.byteLength,
      sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
    })

    // Detect actual audio format from buffer content
    const detectedFormat = detectAudioFormat(audioBuffer)
    const correctedFileName = fileName.replace(/\.[^.]+$/, detectedFormat.extension)

    // Create FormData for multipart/form-data request with correct format
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: detectedFormat.contentType })

    // Generate audio buffer checksum for debugging
    const audioArray = new Uint8Array(audioBuffer)
    const audioChecksum = Array.from(audioArray.slice(0, 16))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const audioHeader = Array.from(audioArray.slice(0, 20))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')

    console.log('🎯 Direct Upload audio blob details:', {
      originalFileName: fileName,
      correctedFileName: correctedFileName,
      detectedFormat: detectedFormat.format,
      detectedContentType: detectedFormat.contentType,
      blobSize: audioBuffer.byteLength,
      blobType: audioBlob.type,
    })

    console.log('🔬 Direct Upload format detection:', {
      checksum: audioChecksum,
      header: audioHeader,
      detectedFormat: detectedFormat.format,
      wasCorrectlyDetected: true,
      bufferIntegrity: audioBuffer.byteLength > 0 && audioBuffer.byteLength === audioBlob.size,
    })

    formData.append('file', audioBlob, correctedFileName)
    formData.append('model', model)

    console.log('📋 Direct Upload FormData structure:', {
      originalFileName: fileName,
      correctedFileName: correctedFileName,
      model: model,
      language: language || 'not-set',
      temperature: temperature,
      responseFormat: responseFormat,
      hasLanguageParam: !!(language && model === 'whisper-1'),
      actualFormat: detectedFormat.format,
      contentType: detectedFormat.contentType,
    })
    // Only add language if specified and using whisper-1 model (gpt-4o models don't support language parameter)
    if (language && model === 'whisper-1') {
      formData.append('language', language)
    }
    formData.append('temperature', temperature)
    formData.append('response_format', responseFormat)

    // Call OpenAI API
    console.log('🚀 Calling OpenAI API...')
    console.log('📤 Direct Upload request headers:', {
      Authorization: `Bearer ${env.OPENAI_API_KEY?.substring(0, 10)}...`,
      'Content-Type': 'multipart/form-data (FormData)',
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      method: 'POST',
    })

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: formData,
    })

    console.log('🤖 OpenAI API response:', {
      status: openaiResponse.status,
      statusText: openaiResponse.statusText,
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('🚨 Direct Upload OpenAI API error:', {
        status: openaiResponse.status,
        statusText: openaiResponse.statusText,
        body: errorText,
        responseHeaders: Object.fromEntries(openaiResponse.headers.entries()),
        requestType: 'direct-upload',
      })

      return createErrorResponse(
        `OpenAI API error: ${openaiResponse.status} - ${openaiResponse.statusText}`,
        502,
      )
    }

    const transcriptionResult = await openaiResponse.json()

    console.log('✅ Direct Upload OpenAI transcription completed:', {
      hasResult: !!transcriptionResult,
      resultType: typeof transcriptionResult,
      hasText: !!transcriptionResult.text,
      textPreview: transcriptionResult.text?.substring(0, 50) + '...' || 'no-text',
      requestType: 'direct-upload',
      model: model,
    })

    return createResponse(
      JSON.stringify({
        success: true,
        text: transcriptionResult.text || transcriptionResult,
        transcription: transcriptionResult,
        model: model,
        metadata: {
          fileSize: audioBuffer.byteLength,
          language: language,
          temperature: temperature,
          responseFormat: responseFormat,
          processedAt: new Date().toISOString(),
          service: 'OpenAI Direct API',
        },
      }),
    )
  } catch (error) {
    console.error('OpenAI transcription error:', error)
    return createErrorResponse(`OpenAI transcription failed: ${error.message}`, 500)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Log all incoming requests for debugging
    console.log('🔍 Whisper Worker Request:', {
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
      return new Response('Whisper Worker running', {
        status: 200,
        headers: corsHeaders,
      })
    }

    // AI binding test endpoint
    if (pathname === '/ai-test' && request.method === 'GET') {
      try {
        const testResult = {
          timestamp: new Date().toISOString(),
          aiBindingAvailable: !!env.AI,
          r2BindingAvailable: !!env.WHISPER_BUCKET,
          openaiApiKeyAvailable: !!env.OPENAI_API_KEY,
          hfApiTokenAvailable: !!env.HF_API_TOKEN,
          envKeys: Object.keys(env),
          accountId: env.ACCOUNT_ID || 'NOT_SET',
          r2BucketName: 'whisper-audio-temp',
        }

        if (!env.AI) {
          testResult.error = 'AI binding not available'
          testResult.suggestion = 'Check wrangler.toml [ai] binding configuration'
        } else if (!env.WHISPER_BUCKET) {
          testResult.error = 'R2 bucket binding not available'
          testResult.suggestion = 'Check wrangler.toml [[r2_buckets]] configuration'
        } else {
          testResult.success = true
          testResult.message = 'Core bindings properly configured'
          testResult.availableServices = []

          if (env.AI && env.WHISPER_BUCKET) {
            testResult.availableServices.push('Cloudflare Workers AI (small + large files)')
          }
          if (env.OPENAI_API_KEY) {
            testResult.availableServices.push('OpenAI Direct API (/transcribe-openai)')
          }
          if (env.HF_API_TOKEN) {
            testResult.availableServices.push('Hugging Face Gateway (reserved)')
          }
        }

        return createResponse(JSON.stringify(testResult, null, 2))
      } catch (error) {
        return createErrorResponse(`AI test failed: ${error.message}`, 500)
      }
    }

    // R2 URL test endpoint
    if (pathname === '/test-r2-url' && request.method === 'GET') {
      const testUrl = url.searchParams.get('url')
      if (!testUrl) {
        return createErrorResponse('Missing "url" query parameter', 400)
      }

      try {
        console.log('🧪 Testing R2 URL accessibility:', testUrl)

        const testResponse = await fetch(testUrl)
        const result = {
          url: testUrl,
          status: testResponse.status,
          statusText: testResponse.statusText,
          headers: Object.fromEntries(testResponse.headers.entries()),
          accessible: testResponse.ok,
          timestamp: new Date().toISOString(),
        }

        console.log('🧪 R2 URL test result:', result)
        return createResponse(JSON.stringify(result, null, 2))
      } catch (error) {
        console.error('🧪 R2 URL test failed:', error)
        return createErrorResponse(`R2 URL test failed: ${error.message}`, 500)
      }
    }

    // Audio upload endpoint (with chunked support)
    if (pathname === '/upload' && request.method === 'POST') {
      return await handleUpload(request, env)
    }

    // Main transcription endpoint
    if (pathname === '/transcribe' && request.method === 'POST') {
      return await handleTranscribe(request, env)
    }

    // URL-based transcription endpoint (for large files uploaded to R2)
    if (pathname === '/transcribe' && request.method === 'GET') {
      const audioUrl = url.searchParams.get('url')
      const service = url.searchParams.get('service') || 'cloudflare'
      const model = url.searchParams.get('model') || 'whisper-1'
      const language = url.searchParams.get('language')
      const temperature = url.searchParams.get('temperature') || '0'

      if (!audioUrl) {
        return createErrorResponse('Missing required "url" query parameter', 400)
      }

      console.log('🎵 GET /transcribe with URL:', {
        audioUrl,
        service,
        model,
        language,
        temperature,
        timestamp: new Date().toISOString(),
      })

      return await transcribeFromUrl(audioUrl, env, { service, model, language, temperature })
    }

    // OpenAI direct API transcription endpoint
    if (pathname === '/transcribe-openai' && request.method === 'POST') {
      return await transcribeWithOpenAI(request, env)
    }

    // Fallback - return 404 for unmatched routes
    console.log('❌ No route matched, returning 404:', {
      pathname: pathname,
      method: request.method,
      availableRoutes: [
        '/health',
        '/ai-test',
        '/upload',
        'POST /transcribe',
        'GET /transcribe?url=...',
        'POST /transcribe-openai',
      ],
    })

    return createErrorResponse('Not Found', 404)
  },
}
