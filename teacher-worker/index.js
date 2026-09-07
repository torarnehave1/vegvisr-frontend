/**
 * Teacher Worker - Onboarding & Tutorial System
 *
 * URL: https://teacher.vegvisr.org
 *
 * Provides:
 * - User guide search
 * - Tutorial definitions & progress tracking
 * - Text-to-speech via Google Gemini API
 * - Multi-language support (English, Norwegian)
 *
 * Endpoints:
 *   GET  /health                    - Health check
 *   GET  /api/teacher/voices        - List available TTS voices
 *   GET  /api/teacher/guide/search  - Search guide sections
 *   GET  /api/teacher/guide/section/:id - Get specific guide section
 *   GET  /api/teacher/tutorials     - List tutorials (with progress)
 *   GET  /api/teacher/tutorials/:id - Get specific tutorial
 *   POST /api/teacher/tts           - Generate TTS audio
 *   GET  /api/teacher/progress      - Get user's tutorial progress
 *   POST /api/teacher/progress      - Update tutorial progress
 *   GET  /api/teacher/settings      - Get user's teacher settings
 *   POST /api/teacher/settings      - Update teacher settings
 *
 * Secrets (set via wrangler secret put):
 *   - GEMINI_API_KEY (for TTS generation)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-user-email, x-user-role',
}

// Available voices for TTS (Gemini 2.5 Flash TTS has 30 voices)
const AVAILABLE_VOICES = {
  en: [
    { id: 'Puck', name: 'Puck', description: 'Upbeat, friendly guide', style: 'friendly and encouraging' },
    { id: 'Aoede', name: 'Aoede', description: 'Breezy, natural teacher', style: 'warm and conversational' },
    { id: 'Kore', name: 'Kore', description: 'Firm, clear instructor', style: 'clear and professional' },
    { id: 'Charon', name: 'Charon', description: 'Informative narrator', style: 'calm and knowledgeable' },
    { id: 'Zephyr', name: 'Zephyr', description: 'Bright, cheerful', style: 'bright and enthusiastic' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Excitable, energetic', style: 'excited and dynamic' },
  ],
  no: [
    { id: 'Puck', name: 'Puck', description: 'Positiv, vennlig guide', style: 'vennlig og oppmuntrende' },
    { id: 'Aoede', name: 'Aoede', description: 'Avslappet, naturlig lærer', style: 'varm og samtalepreget' },
    { id: 'Kore', name: 'Kore', description: 'Tydelig, klar instruktør', style: 'klar og profesjonell' },
    { id: 'Charon', name: 'Charon', description: 'Informativ forteller', style: 'rolig og kunnskapsrik' },
  ]
}

// Voice style prompts for better TTS quality
const VOICE_STYLE_PROMPTS = {
  'Puck': {
    profile: 'A friendly software teacher who makes learning fun',
    style: 'Speak in a warm, upbeat tone like a helpful friend showing you around. Be encouraging and positive.',
    pacing: 'Natural conversational pace, not too fast'
  },
  'Aoede': {
    profile: 'A patient tutorial guide who explains things clearly',
    style: 'Speak in a breezy, easy-going manner. Make technical concepts feel approachable.',
    pacing: 'Relaxed but engaging pace'
  },
  'Kore': {
    profile: 'A professional instructor delivering clear guidance',
    style: 'Speak with confidence and clarity. Be firm but friendly.',
    pacing: 'Measured pace, clear enunciation'
  },
  'Charon': {
    profile: 'An informative narrator explaining software features',
    style: 'Speak calmly and knowledgeably. Be reassuring and thorough.',
    pacing: 'Steady, informative pace'
  },
  'Zephyr': {
    profile: 'An enthusiastic tech guide',
    style: 'Speak brightly with enthusiasm. Make the user excited to learn.',
    pacing: 'Energetic but clear'
  },
  'Fenrir': {
    profile: 'An excitable teacher who loves technology',
    style: 'Speak with genuine excitement. Share the joy of learning.',
    pacing: 'Dynamic, engaging pace'
  }
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // Route handling
      if (path === '/api/teacher/voices') {
        return handleGetVoices(request, env)
      }

      if (path === '/api/teacher/guide/search') {
        return handleGuideSearch(request, env)
      }

      if (path.startsWith('/api/teacher/guide/section/')) {
        const sectionId = path.split('/').pop()
        return handleGetGuideSection(sectionId, env)
      }

      if (path === '/api/teacher/tutorials') {
        return handleGetTutorials(request, env)
      }

      if (path.startsWith('/api/teacher/tutorials/') && !path.includes('/progress')) {
        const tutorialId = path.split('/').pop()
        return handleGetTutorial(tutorialId, env)
      }

      if (path === '/api/teacher/tts') {
        return handleTTS(request, env)
      }

      if (path === '/api/teacher/progress') {
        if (request.method === 'GET') {
          return handleGetProgress(request, env)
        } else if (request.method === 'POST') {
          return handleUpdateProgress(request, env)
        }
      }

      if (path === '/api/teacher/settings') {
        if (request.method === 'GET') {
          return handleGetSettings(request, env)
        } else if (request.method === 'POST') {
          return handleUpdateSettings(request, env)
        }
      }

      // Health check
      if (path === '/health') {
        return jsonResponse({ status: 'ok', service: 'teacher-worker' })
      }

      return jsonResponse({ error: 'Not found' }, 404)
    } catch (error) {
      console.error('Teacher worker error:', error)
      return jsonResponse({ error: error.message }, 500)
    }
  }
}

// Get available voices
function handleGetVoices(request, env) {
  const url = new URL(request.url)
  const lang = url.searchParams.get('lang') || 'en'

  return jsonResponse({
    success: true,
    voices: AVAILABLE_VOICES[lang] || AVAILABLE_VOICES.en,
    languages: [
      { code: 'en', name: 'English' },
      { code: 'no', name: 'Norsk' }
    ]
  })
}

// Search user guide
async function handleGuideSearch(request, env) {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.toLowerCase() || ''
  const lang = url.searchParams.get('lang') || 'en'
  const targetView = url.searchParams.get('view') || null

  if (!query) {
    return jsonResponse({ success: true, results: [] })
  }

  // Search guide sections in database
  let sql = `
    SELECT id, title, content, target_view, language, keywords
    FROM guide_sections
    WHERE language = ?
    AND (
      LOWER(title) LIKE ? OR
      LOWER(content) LIKE ? OR
      LOWER(keywords) LIKE ?
    )
  `
  const params = [lang, `%${query}%`, `%${query}%`, `%${query}%`]

  if (targetView) {
    sql += ' AND (target_view = ? OR target_view IS NULL)'
    params.push(targetView)
  }

  sql += ' LIMIT 10'

  const results = await env.DB.prepare(sql).bind(...params).all()

  return jsonResponse({
    success: true,
    results: results.results || []
  })
}

// Get specific guide section
async function handleGetGuideSection(sectionId, env) {
  const result = await env.DB
    .prepare('SELECT * FROM guide_sections WHERE id = ?')
    .bind(sectionId)
    .first()

  if (!result) {
    return jsonResponse({ error: 'Section not found' }, 404)
  }

  return jsonResponse({ success: true, section: result })
}

// Get all tutorials (optionally filtered by view)
async function handleGetTutorials(request, env) {
  const url = new URL(request.url)
  const targetView = url.searchParams.get('view') || null
  const lang = url.searchParams.get('lang') || 'en'
  const userEmail = request.headers.get('x-user-email')

  let sql = `
    SELECT t.*,
           COALESCE(p.current_step, 0) as user_current_step,
           COALESCE(p.completed, 0) as user_completed
    FROM tutorials t
    LEFT JOIN user_tutorial_progress p ON t.id = p.tutorial_id AND p.user_email = ?
    WHERE t.language = ?
  `
  const params = [userEmail || '', lang]

  if (targetView) {
    sql += ' AND t.target_view = ?'
    params.push(targetView)
  }

  sql += ' ORDER BY t.sort_order, t.difficulty'

  const results = await env.DB.prepare(sql).bind(...params).all()

  return jsonResponse({
    success: true,
    tutorials: results.results || []
  })
}

// Get specific tutorial
async function handleGetTutorial(tutorialId, env) {
  const result = await env.DB
    .prepare('SELECT * FROM tutorials WHERE id = ?')
    .bind(tutorialId)
    .first()

  if (!result) {
    return jsonResponse({ error: 'Tutorial not found' }, 404)
  }

  // Parse steps JSON
  result.steps = JSON.parse(result.steps || '[]')

  return jsonResponse({ success: true, tutorial: result })
}

// Text-to-speech handler
async function handleTTS(request, env) {
  const { text, voice = 'Puck', language = 'en-US' } = await request.json()

  if (!text) {
    return jsonResponse({ error: 'Text is required' }, 400)
  }

  // Check if GEMINI_API_KEY is set
  if (!env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured')
    return jsonResponse({ error: 'TTS not configured', details: 'API key missing' }, 500)
  }

  // Create hash for caching
  const textHash = await hashText(text + voice + language)

  // Check cache
  const cached = await env.DB
    .prepare('SELECT r2_path FROM tts_cache WHERE text_hash = ?')
    .bind(textHash)
    .first()

  if (cached) {
    const audio = await env.TEACHER_AUDIO.get(cached.r2_path)
    if (audio) {
      return new Response(audio.body, {
        headers: {
          'Content-Type': 'audio/wav',
          ...corsHeaders
        }
      })
    }
  }

  // Build enhanced prompt with director's notes for better voice quality
  const voiceStyle = VOICE_STYLE_PROMPTS[voice] || VOICE_STYLE_PROMPTS['Puck']

  // Create a styled prompt that guides the TTS to sound natural
  // Keep it simple - just add speaking style instruction
  const styledPrompt = `Say in a ${voiceStyle.style} voice: ${text}`

  console.log('TTS Request:', { voice, textLength: text.length, styledPrompt: styledPrompt.substring(0, 100) })

  // Use Gemini 2.5 Flash TTS with styled prompt
  try {
    const ttsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: styledPrompt }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice }
              }
            }
          }
        })
      }
    )

    console.log('Gemini TTS response status:', ttsResponse.status)

    if (ttsResponse.ok) {
      const ttsData = await ttsResponse.json()
      const audioContent = ttsData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

      if (audioContent) {
        const pcmData = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))

        // Create proper WAV file with headers (Gemini returns 24kHz 16-bit mono PCM)
        const wavBuffer = createWavFile(pcmData, 24000, 1, 16)

        // Cache to R2
        const r2Path = `tts/${textHash}.wav`
        await env.TEACHER_AUDIO.put(r2Path, wavBuffer)

        // Save cache reference
        await env.DB
          .prepare('INSERT OR REPLACE INTO tts_cache (id, text_hash, r2_path, voice, language) VALUES (?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID(), textHash, r2Path, voice, language)
          .run()

        return new Response(wavBuffer, {
          headers: {
            'Content-Type': 'audio/wav',
            ...corsHeaders
          }
        })
      } else {
        console.error('Gemini TTS: No audio data in response', JSON.stringify(ttsData).substring(0, 500))
        return jsonResponse({
          error: 'TTS: No audio in response',
          debug: JSON.stringify(ttsData).substring(0, 300),
          fallback: 'browser',
          text: text
        }, 200)
      }
    } else {
      const errorText = await ttsResponse.text()
      console.error('Gemini TTS error:', ttsResponse.status, errorText)
      return jsonResponse({
        error: 'TTS API error',
        status: ttsResponse.status,
        debug: errorText.substring(0, 300),
        fallback: 'browser',
        text: text
      }, 200)
    }
  } catch (error) {
    console.error('TTS fetch error:', error.message)
    return jsonResponse({
      error: 'TTS exception',
      debug: error.message,
      fallback: 'browser',
      text: text
    }, 200)
  }

  // Return error with suggestion to use browser TTS
  return jsonResponse({
    error: 'TTS generation failed',
    fallback: 'browser',
    text: text
  }, 200) // Return 200 so frontend can fallback gracefully
}

// Get user progress
async function handleGetProgress(request, env) {
  const userEmail = request.headers.get('x-user-email')

  if (!userEmail) {
    return jsonResponse({ error: 'User email required' }, 401)
  }

  const results = await env.DB
    .prepare(`
      SELECT p.*, t.name as tutorial_name, t.steps
      FROM user_tutorial_progress p
      JOIN tutorials t ON p.tutorial_id = t.id
      WHERE p.user_email = ?
    `)
    .bind(userEmail)
    .all()

  // Calculate progress percentages
  const progress = (results.results || []).map(p => {
    const steps = JSON.parse(p.steps || '[]')
    const totalSteps = steps.length
    const progressPercent = totalSteps > 0 ? Math.round((p.current_step / totalSteps) * 100) : 0

    return {
      tutorial_id: p.tutorial_id,
      tutorial_name: p.tutorial_name,
      current_step: p.current_step,
      total_steps: totalSteps,
      progress_percent: progressPercent,
      completed: p.completed,
      completed_at: p.completed_at
    }
  })

  return jsonResponse({ success: true, progress })
}

// Update user progress
async function handleUpdateProgress(request, env) {
  const userEmail = request.headers.get('x-user-email')

  if (!userEmail) {
    return jsonResponse({ error: 'User email required' }, 401)
  }

  const { tutorial_id, current_step, completed } = await request.json()

  if (!tutorial_id) {
    return jsonResponse({ error: 'tutorial_id is required' }, 400)
  }

  const id = `${userEmail}-${tutorial_id}`
  const completedAt = completed ? new Date().toISOString() : null

  await env.DB
    .prepare(`
      INSERT INTO user_tutorial_progress (id, user_email, tutorial_id, current_step, completed, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        current_step = excluded.current_step,
        completed = excluded.completed,
        completed_at = CASE WHEN excluded.completed = 1 THEN excluded.completed_at ELSE completed_at END
    `)
    .bind(id, userEmail, tutorial_id, current_step || 0, completed ? 1 : 0, completedAt)
    .run()

  return jsonResponse({ success: true })
}

// Get user settings (voice preference, language)
async function handleGetSettings(request, env) {
  const userEmail = request.headers.get('x-user-email')

  if (!userEmail) {
    return jsonResponse({ error: 'User email required' }, 401)
  }

  const result = await env.DB
    .prepare('SELECT * FROM user_teacher_settings WHERE user_email = ?')
    .bind(userEmail)
    .first()

  const defaults = {
    voice: 'Kore',
    language: 'en',
    voice_enabled: true,
    auto_suggestions: true
  }

  return jsonResponse({
    success: true,
    settings: result || defaults
  })
}

// Update user settings
async function handleUpdateSettings(request, env) {
  const userEmail = request.headers.get('x-user-email')

  if (!userEmail) {
    return jsonResponse({ error: 'User email required' }, 401)
  }

  const { voice, language, voice_enabled, auto_suggestions } = await request.json()

  await env.DB
    .prepare(`
      INSERT INTO user_teacher_settings (user_email, voice, language, voice_enabled, auto_suggestions, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_email) DO UPDATE SET
        voice = excluded.voice,
        language = excluded.language,
        voice_enabled = excluded.voice_enabled,
        auto_suggestions = excluded.auto_suggestions,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(userEmail, voice || 'Puck', language || 'en', voice_enabled ? 1 : 0, auto_suggestions ? 1 : 0)
    .run()

  return jsonResponse({ success: true })
}

// Utility functions
async function hashText(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

// Create a WAV file from raw PCM data
function createWavFile(pcmData, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const fileSize = 44 + dataSize - 8  // Total size minus 8 bytes for RIFF header

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, fileSize, true)  // File size minus 8 bytes
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)  // fmt chunk size (16 for PCM)
  view.setUint16(20, 1, true)   // Audio format (1 = PCM)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Copy PCM data
  const wavBytes = new Uint8Array(buffer)
  wavBytes.set(pcmData, 44)

  return wavBytes
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
