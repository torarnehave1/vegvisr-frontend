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

    // Generate AI Analysis Endpoint - Simple conversation analysis using Workers AI
    if (request.method === 'POST' && url.pathname === '/generate-analysis') {
      try {
        const { prompt, returnType = 'json' } = await request.json()

        if (!prompt) {
          return createErrorResponse('Missing required prompt parameter', 400)
        }

        console.log('🤖 Generating AI analysis:', {
          promptLength: prompt.length,
          returnType,
          timestamp: new Date().toISOString()
        })

        // Llama 3.3 70B has a 24k token context limit (~18k tokens for input after system prompt + completion)
        // Rough estimate: 1 token ≈ 4 characters, so limit input to ~40k characters to be safe
        const MAX_INPUT_LENGTH = 40000
        let processedPrompt = prompt

        if (prompt.length > MAX_INPUT_LENGTH) {
          console.log(`⚠️ Prompt too long (${prompt.length} chars), truncating to ${MAX_INPUT_LENGTH}`)

          // Try to intelligently truncate - keep the instructions and summary parts
          const parts = prompt.split('\n\n')
          const instructions = parts.slice(-5).join('\n\n') // Keep last 5 paragraphs (usually instructions)
          const conversationParts = parts.slice(0, -5).join('\n\n')

          // Calculate how much conversation we can keep
          const instructionsLength = instructions.length
          const availableSpace = MAX_INPUT_LENGTH - instructionsLength - 200 // 200 char buffer

          if (conversationParts.length > availableSpace) {
            // Truncate from the middle, keep beginning and end
            const keepLength = Math.floor(availableSpace / 2)
            const beginning = conversationParts.substring(0, keepLength)
            const end = conversationParts.substring(conversationParts.length - keepLength)
            processedPrompt = `${beginning}\n\n[... ${Math.floor((conversationParts.length - availableSpace) / 1000)}k characters omitted for context length ...]\n\n${end}\n\n${instructions}`
          } else {
            processedPrompt = `${conversationParts}\n\n${instructions}`
          }

          console.log(`✂️ Truncated prompt from ${prompt.length} to ${processedPrompt.length} chars`)
        }

        // Call Cloudflare Workers AI with Llama model
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            {
              role: 'system',
              content: 'Du er en ekspert på samtalanalyse. Svar KUN med valid JSON uten markdown formatering.'
            },
            {
              role: 'user',
              content: processedPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2048,
          stream: false
        })

        console.log('✅ AI response received:', {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        })

        // Extract response text
        let responseText
        if (aiResponse.response && typeof aiResponse.response === 'object') {
          responseText = JSON.stringify(aiResponse.response)
        } else {
          responseText = aiResponse.response || aiResponse.result?.response || aiResponse.text || JSON.stringify(aiResponse)
        }

        // Clean markdown code blocks if present
        let cleanedText = typeof responseText === 'string' ? responseText.trim() : JSON.stringify(responseText)
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```\s*$/, '')
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```\s*$/, '')
        }

        // Return in the expected format (matching the frontend's expectation)
        return createResponse(JSON.stringify({
          success: true,
          info: cleanedText,
          bibl: [],
          timestamp: new Date().toISOString()
        }))

      } catch (error) {
        console.error('Error generating AI analysis:', error)
        return createErrorResponse(`AI analysis failed: ${error.message}`, 500)
      }
    }

    // Health check endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return createResponse(
        JSON.stringify({
          status: 'healthy',
          service: 'Norwegian Transcription Worker',
          version: '2.1.0',
          features: ['transcription', 'text_improvement', 'upload', 'speaker_diarization'],
          timestamp: new Date().toISOString(),
          endpoints: {
            transcribe: '/ (POST)',
            upload: '/upload (POST)',
            health: '/health (GET)',
            generateAnalysis: '/generate-analysis (POST) - NEW: Simple AI analysis using Workers AI',
            diarization: '/diarize-audio (POST) - Test speaker diarization',
            speakerIdentification: '/identify-speakers (POST) - AI-powered speaker identification',
            conversationAnalysis: '/analyze-conversation (POST) - AI conversation analysis with diarization',
          },
          diarization: {
            provider: 'Hugging Face Inference Endpoint',
            model: 'pyannote/speaker-diarization-3.1',
            endpoint: 'https://xr8h7vvrrtja455d.us-east-1.aws.endpoints.huggingface.cloud',
            status: 'active'
          }
        }),
      )
    }

    // Speaker Diarization Endpoint - NEW IMPLEMENTATION
    if (request.method === 'POST' && url.pathname === '/diarize-audio') {
      try {
        const { audioUrl } = await request.json()

        if (!audioUrl) {
          return createErrorResponse('Missing required audioUrl parameter', 400)
        }

        console.log('🎤 Diarization request:', { audioUrl, timestamp: new Date().toISOString() })

        // Extract R2 key from URL
        let r2Key
        if (audioUrl.includes('audio.vegvisr.org/')) {
          r2Key = audioUrl.split('audio.vegvisr.org/')[1]
        } else if (audioUrl.includes('.r2.cloudflarestorage.com/')) {
          r2Key = audioUrl.split('.r2.cloudflarestorage.com/')[1]
        } else {
          return createErrorResponse(`Invalid audio URL format: ${audioUrl}`, 400)
        }

        // Download audio from R2
        console.log('📥 Downloading audio from R2:', { r2Key })
        const audioObject = await env.NORWEGIAN_AUDIO_BUCKET.get(r2Key)

        if (!audioObject) {
          return createErrorResponse(`Audio file not found: ${r2Key}`, 404)
        }

        const audioBuffer = await audioObject.arrayBuffer()
        console.log('📁 Audio downloaded:', {
          size: audioBuffer.byteLength,
          sizeMB: (audioBuffer.byteLength / 1024 / 1024).toFixed(2),
        })

        // Convert to base64
        const base64Audio = arrayBufferToBase64(audioBuffer)
        console.log('🔄 Converted to base64:', { length: base64Audio.length })

        // Call Hugging Face diarization endpoint
        const HF_DIARIZATION_ENDPOINT = 'https://xr8h7vvrrtja455d.us-east-1.aws.endpoints.huggingface.cloud'

        console.log('🚀 Calling HF diarization endpoint...')
        const diarizationResponse = await fetch(HF_DIARIZATION_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.whisperailab}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: base64Audio
          }),
        })

        if (!diarizationResponse.ok) {
          const errorText = await diarizationResponse.text()
          console.error('❌ Diarization failed:', {
            status: diarizationResponse.status,
            error: errorText
          })
          return createErrorResponse(
            `Diarization service error (${diarizationResponse.status}): ${errorText}`,
            502
          )
        }

        const diarizationResult = await diarizationResponse.json()
        console.log('✅ Diarization successful:', {
          hasSegments: !!diarizationResult.segments,
          segmentCount: diarizationResult.segments?.length
        })

        // Return editable segments
        return createResponse(JSON.stringify({
          success: true,
          segments: diarizationResult.segments || [],
          metadata: {
            audioUrl,
            r2Key,
            processedAt: new Date().toISOString(),
            service: 'Hugging Face Speaker Diarization',
            model: 'pyannote/speaker-diarization-3.1',
            segmentCount: diarizationResult.segments?.length || 0
          }
        }))

      } catch (error) {
        console.error('❌ Diarization error:', error)
        return createErrorResponse(`Diarization failed: ${error.message}`, 500)
      }
    }

    // AI Speaker Identification Endpoint - Analyze dialogue to identify speaker roles
    if (request.method === 'POST' && url.pathname === '/identify-speakers') {
      try {
        const { transcriptionText, speakerTimeline, numSpeakers } = await request.json()

        if (!transcriptionText || !speakerTimeline || speakerTimeline.length === 0) {
          return createErrorResponse('Missing required data: transcriptionText and speakerTimeline required', 400)
        }

        console.log('🤖 Identifying speakers with AI:', {
          textLength: transcriptionText.length,
          segments: speakerTimeline.length,
          numSpeakers
        })

        // Build a prompt for AI to segment the conversation automatically
        const totalDuration = Math.max(...speakerTimeline.map(s => s.end))
        const totalChars = transcriptionText.length
        const approxSecondsPerChar = totalDuration / totalChars

        let prompt = `Du skal automatisk segmentere denne norske samtalen i talersegmenter.\n\n`

        prompt += `INFORMASJON:\n`
        prompt += `- Antall talere: ${numSpeakers}\n`
        prompt += `- Total varighet: ${Math.round(totalDuration)} sekunder\n`
        prompt += `- Beregningsformel: tegnposisjon × ${approxSecondsPerChar.toFixed(4)} = sekunder\n\n`

        prompt += `TRANSKRIPSJON:\n"${transcriptionText}"\n\n`

        prompt += `OPPGAVE:\n`
        prompt += `1. Les hele samtalen og identifiser rollene til hver taler\n`
        prompt += `2. Analyser dialogmønsteret - spørsmål, svar, lengre monologer, korte responser\n`
        prompt += `3. Identifiser ALLE steder i teksten hvor taleren skifter\n`
        prompt += `4. For hvert segment, beregn start/slutt-tid basert på tegnposisjon i teksten\n\n`

        prompt += `EKSEMPEL PÅ TALERSKIFT:\n`
        prompt += `- Spørsmål etterfulgt av svar = talerskift\n`
        prompt += `- Lang monolog = én taler\n`
        prompt += `- Korte bekreftelser ("ja", "ok") = én taler\n`
        prompt += `- Emnebytte eller ny tankerekke = potensielt talerskift\n\n`

        prompt += `Svar KUN med JSON (ingen markdown, ingen forklaring):\n`
        prompt += `{"speakers":[{"index":0,"role":"Terapeut/Klient","reasoning":"kort forklaring","suggestedName":"Navn"}],`
        prompt += `"suggestedTimeline":[{"speaker":0,"start":0,"end":15.5,"role":"Terapeut","textExcerpt":"første 50 tegn..."}]}\n\n`
        prompt += `VIKTIG: Generer ALLE segmenter du kan identifisere i samtalen.`

        console.log('📤 Calling Cloudflare Workers AI for automatic speaker segmentation')
        console.log('📊 Input:', {
          promptLength: prompt.length,
          transcriptionLength: transcriptionText.length,
          expectedSegments: 'auto-detect all speaker changes'
        })

        // Call Cloudflare Workers AI with settings optimized for longer output
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            {
              role: 'system',
              content: 'Du er ekspert på å analysere dialoger og identifisere talerskift. Du analyserer norsk transkribert tale og genererer automatiske talersegmenter. Svar KUN med valid JSON. VIKTIG: Sørg for at JSON er komplett og valid med alle krøllete parenteser lukket.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4096,
          stream: false
        })

        console.log('✅ AI response received:', {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        })

        console.log('✅ AI response received:', {
          hasResponse: !!aiResponse,
          responseType: typeof aiResponse
        })

        let speakerIdentifications
        try {
          // AI.run() returns the response directly
          const aiText = aiResponse.response || JSON.stringify(aiResponse)
          console.log('📝 Full AI response text length:', aiText.length)
          console.log('📝 AI response text (first 500 chars):', aiText.substring(0, 500))

          // Remove markdown code blocks if present
          let cleanedText = aiText.trim()
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```\s*$/, '')
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```\s*$/, '')
          }

          // Fix incomplete JSON - if it ends abruptly, close it properly
          if (!cleanedText.trim().endsWith('}')) {
            console.log('⚠️ JSON appears incomplete, attempting to repair')
            // Count open/close brackets to determine what's missing
            const openBrackets = (cleanedText.match(/\[/g) || []).length
            const closeBrackets = (cleanedText.match(/\]/g) || []).length
            const openBraces = (cleanedText.match(/\{/g) || []).length
            const closeBraces = (cleanedText.match(/\}/g) || []).length

            // Remove trailing commas and incomplete entries
            cleanedText = cleanedText.replace(/,\s*$/, '')

            // Close arrays and objects as needed
            for (let i = 0; i < (openBrackets - closeBrackets); i++) {
              cleanedText += ']'
            }
            for (let i = 0; i < (openBraces - closeBraces); i++) {
              cleanedText += '}'
            }

            console.log('🔧 Repaired JSON (last 200 chars):', cleanedText.substring(cleanedText.length - 200))
          }

          console.log('📝 Final JSON (first 200 chars):', cleanedText.substring(0, 200))

          // Try to parse the JSON
          speakerIdentifications = JSON.parse(cleanedText)
          console.log('✅ Successfully parsed speaker identifications:', {
            hasSpeakers: !!speakerIdentifications.speakers,
            speakersCount: speakerIdentifications.speakers?.length,
            hasTimeline: !!speakerIdentifications.suggestedTimeline,
            timelineCount: speakerIdentifications.suggestedTimeline?.length
          })
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError)
          console.error('Parse error details:', {
            message: parseError.message,
            stack: parseError.stack
          })
          speakerIdentifications = {
            speakers: [],
            suggestedTimeline: [],
            rawResponse: JSON.stringify(aiResponse),
            error: parseError.message
          }
        }

        return createResponse(JSON.stringify({
          success: true,
          identifications: speakerIdentifications,
          processingTime: Date.now()
        }))

      } catch (error) {
        console.error('Error identifying speakers:', error)
        return createErrorResponse(`Speaker identification failed: ${error.message}`, 500)
      }
    }

    // Analyze conversation endpoint - combines transcription + diarization for AI analysis
    if (request.method === 'POST' && url.pathname === '/analyze-conversation') {
      try {
        const body = await request.json()
        const { transcription, diarization, context, model = 'cloudflare' } = body

        if (!transcription || !diarization?.segments) {
          return createErrorResponse('Transcription and diarization data required', 400)
        }

        // Provider configuration - matches action_test providers exactly
        const providers = {
          cloudflare: { type: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          claude: { type: 'anthropic', apiKey: env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
          grok: { type: 'openai', apiKey: env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1', model: 'grok-beta' },
          gemini: { type: 'gemini', apiKey: env.GOOGLE_GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
          gpt4: { type: 'openai', apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
          gpt5: { type: 'openai', apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', model: 'gpt-5' }
        }

        const provider = providers[model] || providers.cloudflare

        console.log('🎭 Analyzing conversation:', {
          segmentCount: diarization.segments.length,
          hasContext: !!context,
          transcriptionLength: transcription.length,
          provider: model,
          type: provider.type
        })

        // Build conversation timeline with speaker attribution
        const conversationTimeline = diarization.segments.map(segment => {
          const startTime = Math.floor(segment.start)
          const minutes = Math.floor(startTime / 60)
          const seconds = startTime % 60
          const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

          return `[${timeLabel}] ${segment.speaker}: [speaking for ${Math.floor(segment.end - segment.start)}s]`
        }).join('\n')

        // Build AI prompt
        const systemPrompt = 'Du er en ekspert på samtaleanalyse. Du analyserer norske samtaler og gir innsiktsfulle, strukturerte analyser. Svar alltid med valid JSON.'

        let userPrompt = `Analyser denne samtalen og gi en strukturert analyse.\n\n`

        if (context) {
          userPrompt += `Kontekst: ${context}\n\n`
        }

        userPrompt += `Samtale tidslinje:\n${conversationTimeline}\n\n`
        userPrompt += `Full transkripsjon:\n${transcription.substring(0, 8000)}\n\n` // Limit to avoid token limits

        userPrompt += `Generer analyse i følgende JSON-format:\n`
        userPrompt += `{\n`
        userPrompt += `  "summary": "Kort 2-3 setningers oppsummering",\n`
        userPrompt += `  "keyThemes": ["tema1", "tema2", "tema3"],\n`
        userPrompt += `  "speakerRoles": {\n`
        userPrompt += `    "SPEAKER_01": {"role": "Rolle", "characteristics": "Beskrivelse"},\n`
        userPrompt += `    "SPEAKER_02": {"role": "Rolle", "characteristics": "Beskrivelse"}\n`
        userPrompt += `  },\n`
        userPrompt += `  "keyMoments": [\n`
        userPrompt += `    {"timestamp": 145, "speaker": "SPEAKER_01", "description": "Hva skjedde"}\n`
        userPrompt += `  ],\n`
        userPrompt += `  "actionItems": ["handling1", "handling2"]\n`
        userPrompt += `}\n\n`
        userPrompt += `Svar KUN med valid JSON, ingen markdown eller forklaring.`

        let analysisResult

        // Call appropriate AI service based on provider type
        if (provider.type === 'cloudflare') {
          console.log('📤 Calling Cloudflare Workers AI')

          const aiResponse = await env.AI.run(provider.model, {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 2048,
            stream: false
          })

          console.log('✅ AI analysis response received')

          // Parse Cloudflare AI response
          if (aiResponse.response && typeof aiResponse.response === 'object') {
            analysisResult = aiResponse.response
          } else {
            const aiText = aiResponse.response || aiResponse.result?.response || aiResponse.text || JSON.stringify(aiResponse)
            let cleanedText = typeof aiText === 'string' ? aiText.trim() : JSON.stringify(aiText)

            if (cleanedText.startsWith('```json')) {
              cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```\s*$/, '')
            } else if (cleanedText.startsWith('```')) {
              cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```\s*$/, '')
            }

            analysisResult = JSON.parse(cleanedText)
          }

        } else if (provider.type === 'anthropic') {
          // Claude API
          console.log('📤 Calling Claude API')

          if (!provider.apiKey) {
            return createErrorResponse('Anthropic API key not configured', 500)
          }

          const response = await fetch(`${provider.baseURL}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': provider.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 4096,
              temperature: 0.2,
              messages: [
                { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
              ]
            })
          })

          const data = await response.json()
          const textContent = data.content?.[0]?.text || JSON.stringify(data)
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, '').replace(/```\s*$/, ''))

          console.log('✅ Claude analysis completed')

        } else if (provider.type === 'gemini') {
          // Gemini API
          console.log('📤 Calling Gemini API')

          if (!provider.apiKey) {
            return createErrorResponse('Google Gemini API key not configured', 500)
          }

          const response = await fetch(`${provider.baseURL}/models/${provider.model}:generateContent?key=${provider.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096
              }
            })
          })

          const data = await response.json()
          const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data)
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, '').replace(/```\s*$/, ''))

          console.log('✅ Gemini analysis completed')

        } else if (provider.type === 'openai') {
          // OpenAI-compatible API (GPT-4, Grok, etc.)
          console.log('📤 Calling OpenAI-compatible API:', model, provider.model)

          if (!provider.apiKey) {
            return createErrorResponse(`API key not configured for ${model} provider`, 500)
          }

          const response = await fetch(`${provider.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
              temperature: 0.2,
              max_tokens: 4096
            })
          })

          const data = await response.json()
          const textContent = data.choices?.[0]?.message?.content || JSON.stringify(data)
          analysisResult = JSON.parse(textContent.replace(/^```json\s*/, '').replace(/```\s*$/, ''))

          console.log('✅ OpenAI-compatible analysis completed')
        }

        return createResponse(JSON.stringify({
          success: true,
          analysis: analysisResult,
          metadata: {
            model: model,
            provider: provider.type,
            analyzedAt: new Date().toISOString(),
            segmentCount: diarization.segments.length,
            hasContext: !!context
          }
        }))

      } catch (error) {
        console.error('Conversation analysis error:', error)
        return createErrorResponse(error.message || 'Analysis failed', 500)
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
