// Voice Worker - upload and transcribe short voice notes

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-Chat-Id, X-Message-Id',
}

const jsonResponse = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })

const errorResponse = (message, status = 400) => {
  console.error('[voice-worker]', message)
  return jsonResponse({ success: false, error: message }, status)
}

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

  if (contentType && validMimeTypes.includes(contentType.toLowerCase())) {
    return true
  }

  if (fileName) {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return validExtensions.includes(extension)
  }

  return false
}

const detectAudioFormat = (audioBuffer) => {
  const audioArray = new Uint8Array(audioBuffer)
  const header = Array.from(audioArray.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (header.startsWith('1a45dfa3')) {
    return { contentType: 'audio/webm', extension: '.webm', format: 'WebM' }
  }

  if (header.startsWith('4f676753')) {
    return { contentType: 'audio/ogg', extension: '.ogg', format: 'OGG/Opus' }
  }

  if (header.startsWith('52494646')) {
    return { contentType: 'audio/wav', extension: '.wav', format: 'WAV' }
  }

  if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3')) {
    return { contentType: 'audio/mpeg', extension: '.mp3', format: 'MP3' }
  }

  if (header.includes('66747970')) {
    return { contentType: 'audio/mp4', extension: '.m4a', format: 'M4A' }
  }

  if (header.startsWith('664c6143')) {
    return { contentType: 'audio/flac', extension: '.flac', format: 'FLAC' }
  }

  return { contentType: 'audio/wav', extension: '.wav', format: 'Unknown' }
}

const buildAudioUrl = (request, env, objectKey) => {
  if (env.PUBLIC_AUDIO_BASE_URL) {
    return `${env.PUBLIC_AUDIO_BASE_URL}?key=${encodeURIComponent(objectKey)}`
  }

  const url = new URL(request.url)
  return `${url.origin}/audio?key=${encodeURIComponent(objectKey)}`
}

const readJson = async (request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const extractObjectKeyFromUrl = (audioUrl) => {
  try {
    const parsed = new URL(audioUrl)
    const keyParam = parsed.searchParams.get('key')
    if (keyParam) {
      return keyParam
    }
    return null
  } catch {
    return null
  }
}

const handleUpload = async (request, env) => {
  const contentType = request.headers.get('Content-Type')
  const fileName = request.headers.get('X-File-Name') || 'voice-note.m4a'
  const chatId = request.headers.get('X-Chat-Id') || 'unknown-chat'
  const messageId = request.headers.get('X-Message-Id') || crypto.randomUUID()

  if (!isValidAudioFormat(contentType, fileName)) {
    return errorResponse('Invalid audio format. Supported formats: WAV, MP3, M4A, FLAC, OGG, WebM.', 400)
  }

  const audioBuffer = await request.arrayBuffer()
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return errorResponse('Empty or invalid audio file', 400)
  }

  const detectedFormat = detectAudioFormat(audioBuffer)
  const sanitizedChatId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const sanitizedMessageId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const objectKey = `voice/${sanitizedChatId}/${sanitizedMessageId}${detectedFormat.extension}`

  await env.VOICE_MESSAGES.put(objectKey, audioBuffer, {
    httpMetadata: {
      contentType: detectedFormat.contentType,
    },
    customMetadata: {
      originalFileName: fileName,
      chatId: String(chatId),
      messageId: String(messageId),
    },
  })

  return jsonResponse({
    success: true,
    objectKey,
    audioUrl: buildAudioUrl(request, env, objectKey),
    size: audioBuffer.byteLength,
    contentType: detectedFormat.contentType,
  })
}

const handleAudioFetch = async (request, env) => {
  const url = new URL(request.url)
  const objectKey = url.searchParams.get('key')

  if (!objectKey) {
    return errorResponse('Missing required key parameter', 400)
  }

  const rangeHeader = request.headers.get('Range')
  let audioObject
  let responseStatus = 200
  let extraHeaders = {}

  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader)
    if (match) {
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : null
      const object = await env.VOICE_MESSAGES.get(objectKey)
      if (!object) {
        return errorResponse('Audio not found', 404)
      }
      const size = object.size
      const safeEnd = end !== null ? Math.min(end, size - 1) : size - 1
      if (start >= size || start < 0 || safeEnd < start) {
        return new Response(null, {
          status: 416,
          headers: {
            ...corsHeaders,
            'Content-Range': `bytes */${size}`,
            'Accept-Ranges': 'bytes',
          },
        })
      }
      const length = safeEnd - start + 1
      audioObject = await env.VOICE_MESSAGES.get(objectKey, {
        range: { offset: start, length },
      })
      responseStatus = 206
      extraHeaders = {
        'Content-Range': `bytes ${start}-${safeEnd}/${size}`,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
      }
    }
  }

  if (!audioObject) {
    audioObject = await env.VOICE_MESSAGES.get(objectKey)
  }
  if (!audioObject) {
    return errorResponse('Audio not found', 404)
  }

  return new Response(audioObject.body, {
    status: responseStatus,
    headers: {
      ...corsHeaders,
      'Content-Type': audioObject.httpMetadata?.contentType || 'audio/mpeg',
      'Content-Length': String(audioObject.size ?? 0),
      'Accept-Ranges': 'bytes',
      ...extraHeaders,
    },
  })
}

const handleTranscribe = async (request, env) => {
  if (!env.OPENAI_API_KEY) {
    return errorResponse('Missing OPENAI_API_KEY', 500)
  }

  const body = await readJson(request)
  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  const model = body.model || 'whisper-1'
  const language = body.language || null
  let objectKey = body.objectKey || null

  if (!objectKey && body.audioUrl) {
    objectKey = extractObjectKeyFromUrl(body.audioUrl)
  }

  let audioBuffer
  let fileName = 'voice-note.m4a'

  if (objectKey) {
    const audioObject = await env.VOICE_MESSAGES.get(objectKey)
    if (!audioObject) {
      return errorResponse('Audio not found for objectKey', 404)
    }

    audioBuffer = await audioObject.arrayBuffer()
    fileName = objectKey.split('/').pop() || fileName
  } else if (body.audioUrl) {
    const response = await fetch(body.audioUrl)
    if (!response.ok) {
      return errorResponse(`Failed to download audio: ${response.status}`, 400)
    }
    audioBuffer = await response.arrayBuffer()
  } else {
    return errorResponse('Missing objectKey or audioUrl', 400)
  }

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return errorResponse('Empty or invalid audio buffer', 400)
  }

  const detectedFormat = detectAudioFormat(audioBuffer)
  const audioBlob = new Blob([audioBuffer], { type: detectedFormat.contentType })

  const formData = new FormData()
  formData.append('file', audioBlob, fileName || `voice-note${detectedFormat.extension}`)
  formData.append('model', model)
  if (language && model === 'whisper-1') {
    formData.append('language', language)
  }

  const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: formData,
  })

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text()
    console.error('[voice-worker] OpenAI error:', errorText)
    return errorResponse(`OpenAI transcription failed: ${openaiResponse.status}`, 500)
  }

  const result = await openaiResponse.json()
  return jsonResponse({
    success: true,
    text: result.text || '',
    language: result.language || null,
    model,
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const url = new URL(request.url)
    const pathname = url.pathname

    if (pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env)
    }

    if (pathname === '/audio' && request.method === 'GET') {
      return handleAudioFetch(request, env)
    }

    if (pathname === '/transcribe' && request.method === 'POST') {
      return handleTranscribe(request, env)
    }

    if (pathname === '/health' && request.method === 'GET') {
      return jsonResponse({ ok: true, service: 'voice-worker' })
    }

    return errorResponse('Not found', 404)
  },
}
