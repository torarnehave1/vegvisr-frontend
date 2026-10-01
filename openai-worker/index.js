// OpenAI Worker - Complete OpenAI API Integration
// Supports: Chat, Image Generation, and all GPT models

/**
 * ENCRYPTION/DECRYPTION UTILITIES
 * Get user API key from D1 database
 */
async function decryptApiKey(encryptedBase64, masterKey) {
  const encoder = new TextEncoder()
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('vegvisr-user-api-keys'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

async function getUserApiKey(env, userId, provider) {
  if (!userId) return null
  if (!env.DB) return null
  if (!env.ENCRYPTION_MASTER_KEY) return null

  try {
    const result = await env.DB.prepare(`
      SELECT encrypted_key FROM user_api_keys
      WHERE user_id = ?1 AND provider = ?2 AND enabled = 1
    `).bind(userId, provider).first()

    if (!result || !result.encrypted_key) {
      return null
    }

    const plaintextApiKey = await decryptApiKey(result.encrypted_key, env.ENCRYPTION_MASTER_KEY)

    // Update last_used timestamp
    await env.DB.prepare(`
      UPDATE user_api_keys SET last_used = CURRENT_TIMESTAMP
      WHERE user_id = ?1 AND provider = ?2
    `).bind(userId, provider).run()

    return plaintextApiKey

  } catch (error) {
    console.error(`Failed to get user API key: ${error.message}`)
    return null
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, X-API-Token, X-Email',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: env.WORKER_NAME || 'openai-worker',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // OpenAPI 3.0 JSON spec
      if (pathname === '/openapi.json' && request.method === 'GET') {
        return handleOpenApiJson(corsHeaders);
      }

      // API Documentation
      if (pathname === '/api/docs' && request.method === 'GET') {
        return handleApiDocs(corsHeaders);
      }

      // List models
      if (pathname === '/models' && request.method === 'GET') {
        return handleModels(env, corsHeaders);
      }

      // Chat completions
      if (pathname === '/chat' && request.method === 'POST') {
        return await handleChat(request, env, corsHeaders);
      }

      // Model-specific shortcuts
      if (pathname.match(/^\/(gpt-4o|gpt-4|gpt-5\.2|gpt-5\.1|gpt-5)$/) && request.method === 'POST') {
        const model = pathname.substring(1);
        return await handleModelEndpoint(request, env, corsHeaders, model);
      }

      // Image generation
      if (pathname === '/images' && request.method === 'POST') {
        return await handleImages(request, env, corsHeaders);
      }

      // Image editing with reference images — the only route that takes pictures IN
      if (pathname === '/images/edits' && request.method === 'POST') {
        return await handleImageEdits(request, env, corsHeaders);
      }

      // Image model shortcuts
      if (pathname.match(/^\/(dall-e-3|dall-e-2|gpt-image-1|gpt-image-1-mini|gpt-image-1\.5)$/) && request.method === 'POST') {
        const model = pathname.substring(1);
        return await handleImageModel(request, env, corsHeaders, model);
      }

      // Audio transcription
      if ((pathname === '/audio' || pathname === '/whisper-1') && request.method === 'POST') {
        return await handleAudio(request, env, corsHeaders);
      }

      // Branding JSON generation
      if (pathname === '/branding/generate' && request.method === 'POST') {
        return await handleBrandingGenerate(request, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Handle chat completions
async function handleChat(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const {
      messages,
      model = 'gpt-4o',
      temperature = 0.7,
      max_tokens,
      max_completion_tokens,
      top_p = 1,
      frequency_penalty = 0,
      presence_penalty = 0,
      stream = false,
      userId,
      tools,        // Function calling tools
      tool_choice   // Function calling mode: 'auto', 'none', or specific function
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({
        error: 'messages array is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get API key from D1 database or fall back to system key
    const userKey = await getUserApiKey(env, userId, 'openai')
    const openaiKey = userKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Call OpenAI API - aligned with OpenAI SDK format
    const requestBody = {
      model,
      messages
    };

    // Add optional parameters only if provided
    // GPT-5+ uses max_completion_tokens, older models use max_tokens
    if (temperature !== undefined && temperature !== 0.7) requestBody.temperature = temperature;
    if (max_completion_tokens !== undefined) {
      requestBody.max_completion_tokens = max_completion_tokens;
    } else if (max_tokens !== undefined) {
      requestBody.max_tokens = max_tokens;
    }
    if (top_p !== undefined && top_p !== 1) requestBody.top_p = top_p;
    if (frequency_penalty !== undefined && frequency_penalty !== 0) requestBody.frequency_penalty = frequency_penalty;
    if (presence_penalty !== undefined && presence_penalty !== 0) requestBody.presence_penalty = presence_penalty;
    if (stream !== undefined && stream !== false) requestBody.stream = stream;

    // Add function calling parameters
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools;
    }
    if (tool_choice !== undefined) {
      requestBody.tool_choice = tool_choice;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle model-specific endpoints
async function handleModelEndpoint(request, env, corsHeaders, modelName) {
  try {
    const body = await request.json();
    const {
      messages,
      temperature = 0.7,
      max_tokens,
      max_completion_tokens,
      userId,
      tools,        // Function calling tools
      tool_choice   // Function calling mode
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({
        error: 'messages array is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userKey = await getUserApiKey(env, userId, 'openai')
    const openaiKey = userKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build request body - aligned with OpenAI SDK format
    const requestBody = {
      model: modelName,
      messages
    };

    if (temperature !== undefined && temperature !== 0.7) requestBody.temperature = temperature;
    // GPT-5+ uses max_completion_tokens, older models use max_tokens
    if (max_completion_tokens !== undefined) {
      requestBody.max_completion_tokens = max_completion_tokens;
    } else if (max_tokens !== undefined) {
      requestBody.max_tokens = max_tokens;
    }

    // Add function calling parameters
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools;
    }
    if (tool_choice !== undefined) {
      requestBody.tool_choice = tool_choice;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle image generation
async function handleImages(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'standard',
      n = 1,
      userId
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({
        error: 'prompt is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userKey = await getUserApiKey(env, userId, 'openai')
    const openaiKey = userKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate model-specific parameters
    const validSizes = {
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
      'dall-e-3': ['1024x1024', '1024x1792', '1792x1024'],
      'gpt-image-1': ['1024x1024', '1024x1536', '1536x1024', 'auto'],
      'gpt-image-1.5': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      'gpt-image-1-mini': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
    };

    if (!validSizes[model]?.includes(size)) {
      return new Response(JSON.stringify({
        error: `Invalid size for ${model}. Valid sizes: ${validSizes[model]?.join(', ')}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build request body
    const requestBody = {
      prompt,
      model,
      size,
      n
    };

    // Only add quality for models that support it
    if (model === 'dall-e-3' || model.startsWith('gpt-image-')) {
      requestBody.quality = quality;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image editing with reference images — POST /images/edits
// ─────────────────────────────────────────────────────────────────────────────
//
// The endpoint that takes pictures IN. /images above calls /v1/images/generations, which is
// text-only; this calls /v1/images/edits, which accepts several reference images and composes
// from them. Measured against the real API on 2026-10-01: a photo of a specific plush toy plus a
// logo file produced that same toy, recognisably itself, in a new scene with the logo embroidered
// on its chest — one call, 99 seconds, $0.18 at max quality.
//
// REFERENCES ARE URLs, NOT BYTES. The caller names images by URL and this worker fetches them.
// That is what lets the MCP server use it: a URL is a short string, where base64 in a tool
// argument would put a megabyte of noise through a model's context. It is also why the allowlist
// below is not optional — a worker that fetches an arbitrary URL on a caller's say-so is a
// request-forgery engine with someone else's API key attached.
//
// QUALITY DEFAULTS TO low, DELIBERATELY. Measured: low 196 output tokens, high 1756, max 7024 —
// a 15x spread in cost and an 8x spread in latency for the same request. Everything else in this
// worker defaults to the generous option; this one must not, because the obvious caller is an AI
// agent that may run it in a loop.

/**
 * Hosts a reference image may be fetched from.
 *
 * An allowlist rather than a blocklist, and fixed hostnames rather than a pattern the caller
 * supplies. EXTRA_IMAGE_HOSTS in wrangler vars extends it comma-separated for a World on its
 * own domain.
 */
const ALLOWED_IMAGE_HOSTS = ['vegvisr.imgix.net', 'photos-api.vegvisr.org'];
const ALLOWED_IMAGE_SUFFIXES = ['.vegvisr.org', '.vegr.ai'];

function isAllowedImageUrl(raw, env) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'must be https' };
  }
  const host = url.hostname.toLowerCase();
  const extra = String(env.EXTRA_IMAGE_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);
  const allowed =
    ALLOWED_IMAGE_HOSTS.includes(host) ||
    extra.includes(host) ||
    ALLOWED_IMAGE_SUFFIXES.some(suffix => host.endsWith(suffix));
  if (!allowed) {
    return { ok: false, reason: `host ${host} is not allowed` };
  }
  return { ok: true, url };
}

/**
 * The output size rules, from OpenAI's own image guide (read 2026-10-01): both edges multiples
 * of 16, neither above 3840, ratio within 1:3 to 3:1, and a total pixel count between 655,360
 * and 8,294,400.
 *
 * Checked here rather than left to the API, because the failure arrives after the caller has
 * already waited through the uploads — and because an unchecked multiple-of-8 rule produced
 * exactly this class of failure in the Workers AI path two days ago.
 */
function validateEditSize(size) {
  if (!size || size === 'auto') return { ok: true, size: 'auto' };
  const match = String(size).match(/^(\d+)x(\d+)$/);
  if (!match) return { ok: false, reason: 'size must be WIDTHxHEIGHT, or "auto"' };
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (w % 16 || h % 16) return { ok: false, reason: `both edges must be multiples of 16 (got ${w}x${h})` };
  if (w > 3840 || h > 3840) return { ok: false, reason: 'neither edge may exceed 3840' };
  const ratio = w / h;
  if (ratio > 3 || ratio < 1 / 3) return { ok: false, reason: 'aspect ratio must be between 1:3 and 3:1' };
  const pixels = w * h;
  if (pixels < 655360) return { ok: false, reason: 'total pixels must be at least 655,360' };
  if (pixels > 8294400) return { ok: false, reason: 'total pixels must not exceed 8,294,400' };
  return { ok: true, size: `${w}x${h}` };
}

/** Models documented to accept reference images on /v1/images/edits. Only sunburst is verified. */
const EDIT_MODELS = ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'];
const EDIT_QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max', 'auto'];
const MAX_REFERENCE_IMAGES = 4;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

/** Token rates for gpt-image-2.5, per million. From OpenAI's pricing page, 2026-10-01. */
const IMAGE_TOKEN_RATES = { imageInput: 8, textInput: 5, output: 30 };

function jsonError(message, status, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function handleImageEdits(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const {
      prompt,
      referenceImageUrls,
      model = 'gpt-image-2.5-sunburst',
      size = 'auto',
      quality = 'low',
      background,
      output_format,
      userId
    } = body;

    if (!prompt) {
      return jsonError('prompt is required', 400, corsHeaders);
    }
    if (!Array.isArray(referenceImageUrls) || referenceImageUrls.length === 0) {
      return jsonError('referenceImageUrls must be a non-empty array of https URLs', 400, corsHeaders);
    }
    if (referenceImageUrls.length > MAX_REFERENCE_IMAGES) {
      return jsonError(`at most ${MAX_REFERENCE_IMAGES} reference images`, 400, corsHeaders);
    }
    if (!EDIT_MODELS.includes(model)) {
      return jsonError(`model must be one of: ${EDIT_MODELS.join(', ')}`, 400, corsHeaders);
    }
    if (!EDIT_QUALITIES.includes(quality)) {
      return jsonError(`quality must be one of: ${EDIT_QUALITIES.join(', ')}`, 400, corsHeaders);
    }
    const sizeCheck = validateEditSize(size);
    if (!sizeCheck.ok) {
      return jsonError(sizeCheck.reason, 400, corsHeaders);
    }

    // Credential before any fetching: the same rule /generate-image learned the hard way, where
    // an image was generated and only then found to be unstorable.
    const userKey = await getUserApiKey(env, userId, 'openai');
    const openaiKey = userKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return jsonError('OpenAI API key not configured', 500, corsHeaders);
    }

    // Fetch every reference up front, so one bad URL fails before anything reaches OpenAI.
    const files = [];
    for (const [index, raw] of referenceImageUrls.entries()) {
      const check = isAllowedImageUrl(raw, env);
      if (!check.ok) {
        return jsonError(`referenceImageUrls[${index}]: ${check.reason}`, 400, corsHeaders);
      }
      const res = await fetch(check.url.href);
      if (!res.ok) {
        return jsonError(`referenceImageUrls[${index}]: fetch returned ${res.status}`, 400, corsHeaders);
      }
      const type = res.headers.get('content-type') || '';
      if (!type.startsWith('image/')) {
        return jsonError(`referenceImageUrls[${index}]: served ${type || 'no content-type'}, not an image`, 400, corsHeaders);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > MAX_REFERENCE_BYTES) {
        return jsonError(`referenceImageUrls[${index}]: larger than 20 MB`, 400, corsHeaders);
      }
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
      files.push(new File([bytes], `reference-${index + 1}.${ext}`, { type }));
    }

    // ORDER MATTERS, and a caller has to be told so: a prompt refers to "the first reference
    // image" and "the second", and that wording is the only thing keeping them apart.
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    if (sizeCheck.size !== 'auto') form.append('size', sizeCheck.size);
    if (quality !== 'auto') form.append('quality', quality);
    if (background) form.append('background', background);
    if (output_format) form.append('output_format', output_format);
    for (const file of files) form.append('image[]', file);

    const started = Date.now();
    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();

    // The cost is reported back because it is not guessable from the request: measured, the same
    // call costs $0.014 at low and $0.219 at max. A caller that cannot see the bill cannot choose
    // a quality sensibly.
    const usage = result.usage || {};
    const details = usage.input_tokens_details || {};
    const imageTokens = details.image_tokens || 0;
    const textTokens = details.text_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const costUsd =
      (imageTokens / 1e6) * IMAGE_TOKEN_RATES.imageInput +
      (textTokens / 1e6) * IMAGE_TOKEN_RATES.textInput +
      (outputTokens / 1e6) * IMAGE_TOKEN_RATES.output;

    return new Response(JSON.stringify({
      ...result,
      model,
      quality,
      size: sizeCheck.size,
      reference_images: files.length,
      duration_ms: Date.now() - started,
      cost_usd: Number(costUsd.toFixed(4))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return jsonError(error.message, 500, corsHeaders);
  }
}

// Handle audio transcription endpoint
async function handleAudio(request, env, corsHeaders) {
  try {
    console.log('🎤 Audio transcription request received');
    const formData = await request.formData();
    console.log('📋 FormData keys:', Array.from(formData.keys()));

    const file = formData.get('file');
    const model = formData.get('model') || 'whisper-1';
    const language = formData.get('language');
    const prompt = formData.get('prompt');
    const response_format = formData.get('response_format') || 'json';
    const temperature = formData.get('temperature');
    const userId = formData.get('userId');

    console.log('📊 Request params:', { model, language, userId, hasFile: !!file });

    if (!file) {
      console.error('❌ Missing file in FormData');
      return new Response(JSON.stringify({
        error: 'Missing required field: file'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userKey = await getUserApiKey(env, userId, 'openai')
    const openaiKey = userKey || env.OPENAI_API_KEY;
    const keySource = userKey ? 'user' : 'system';
    if (!openaiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'OpenAI API key not configured',
        key_source: 'none'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Forward to OpenAI Audio API
    const openaiFormData = new FormData();

    // Normalize .opus uploads to .ogg for OpenAI compatibility
    let outgoingFile = file;
    if (file && file.name && file.name.toLowerCase().endsWith('.opus')) {
      const blob = file; // File extends Blob in Workers runtime
      outgoingFile = new File([blob], file.name.replace(/\.opus$/i, '.ogg'), {
        type: blob.type || 'audio/ogg'
      });
    }

    openaiFormData.append('file', outgoingFile);
    openaiFormData.append('model', model);
    if (language) openaiFormData.append('language', language);
    if (prompt) openaiFormData.append('prompt', prompt);
    openaiFormData.append('response_format', response_format);
    if (temperature) openaiFormData.append('temperature', temperature);

    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`
      },
      body: openaiFormData
    });

    const rawText = await openaiResponse.text();

    // Normalize errors so downstream clients don't end up with "[object Object]".
    if (!openaiResponse.ok) {
      let errorMessage = rawText;
      let errorObject = null;
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          const rawErr = parsed.error;
          if (typeof rawErr === 'string') {
            errorMessage = rawErr;
          } else if (rawErr && typeof rawErr === 'object') {
            errorMessage = rawErr.message || JSON.stringify(rawErr);
            errorObject = rawErr;
          } else {
            errorMessage = JSON.stringify(parsed);
          }
        }
      } catch (_) {
        // rawText is not JSON
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          openai_error: errorObject,
          status: openaiResponse.status,
          key_source: keySource
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Success: pass through OpenAI JSON
    return new Response(rawText, {
      status: openaiResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Generate branding JSON
async function handleBrandingGenerate(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const {
      userId,
      brandName = '',
      appName = 'Vegvisr Connect',
      audience = '',
      prompt = ''
    } = body || {};

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'userId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userKey = await getUserApiKey(env, userId, 'openai')
    const openaiKey = userKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `
You generate branding JSON for a web app. Output ONLY valid JSON.
The JSON must follow this structure:
{
  "brand": { "name": "", "logoUrl": "", "slogan": "" },
  "theme": {
    "background": { "base": "", "radialTop": "", "radialBottom": "" },
    "text": { "primary": "", "muted": "", "headlineGradient": ["", ""] },
    "card": { "bg": "", "border": "" },
    "button": { "bgGradient": ["", ""], "text": "" }
  },
  "copy": {
    "badge": "",
    "headline": "",
    "subheadline": "",
    "emailLabel": "",
    "emailPlaceholder": "",
    "cta": ""
  },
  "language": { "default": "en" },
  "layout": { "showLanguageToggle": true }
}
Use hex colors or rgba() for colors. Keep text short and clear.
`;

    const userMessage = `
Brand name: ${brandName}
App: ${appName}
Audience: ${audience}
User notes: ${prompt}
`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt.trim() },
          { role: 'user', content: userMessage.trim() }
        ]
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();
    const content = result.choices?.[0]?.message?.content || '{}';
    let branding = {};
    try {
      branding = JSON.parse(content);
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to parse branding JSON response'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, branding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle image model shortcuts
async function handleImageModel(request, env, corsHeaders, modelName) {
  try {
    const body = await request.json();
    const {
      prompt,
      size = modelName === 'dall-e-2' ? '1024x1024' : '1024x1024',
      quality = 'standard',
      apiKey
    } = body;

    if (!prompt) {
      return new Response(JSON.stringify({
        error: 'prompt is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiKey = apiKey || env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = {
      prompt,
      model: modelName,
      size,
      n: 1
    };

    if (modelName === 'dall-e-3' || modelName.startsWith('gpt-image-')) {
      requestBody.quality = quality;
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      return new Response(error, {
        status: openaiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await openaiResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// List available models
function handleModels(env, corsHeaders) {
  const models = {
    chat: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        context_length: 128000,
        max_output_tokens: 16384,
        features: ['chat', 'vision', 'function calling', 'json mode'],
        description: 'GPT-4 Optimized - Multimodal model with vision capabilities'
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        context_length: 8192,
        max_output_tokens: 4096,
        features: ['chat', 'function calling', 'json mode'],
        description: 'GPT-4 - Advanced reasoning and complex task handling'
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        context_length: 200000,
        max_output_tokens: 32768,
        features: ['chat', 'vision', 'function calling', 'json mode', 'advanced reasoning'],
        description: 'GPT-5 - Next generation model with enhanced capabilities'
      },
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        context_length: 200000,
        max_output_tokens: 32768,
        features: ['chat', 'vision', 'function calling', 'json mode', 'advanced reasoning', 'improved accuracy'],
        description: 'GPT-5.1 - Latest iteration with improved performance'
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        context_length: 200000,
        max_output_tokens: 32768,
        features: ['chat', 'vision', 'function calling', 'json mode', 'advanced reasoning', 'improved accuracy'],
        description: 'GPT-5.2 - Latest iteration with improved performance'
      }
    ],
    image: [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        sizes: ['1024x1024', '1024x1792', '1792x1024'],
        quality: ['standard', 'hd'],
        features: ['high quality', 'prompt following', 'realistic'],
        description: 'DALL-E 3 - High quality image generation'
      },
      {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        sizes: ['256x256', '512x512', '1024x1024'],
        quality: ['standard'],
        features: ['fast', 'cost effective'],
        description: 'DALL-E 2 - Fast and affordable image generation'
      },
      {
        id: 'gpt-image-1',
        name: 'GPT-Image 1',
        sizes: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
        quality: ['low', 'medium', 'high', 'auto'],
        features: ['vision', 'world knowledge', 'multimodal LLM', 'image generation'],
        description: 'Natively multimodal LLM with vision understanding and image generation capabilities'
      },
      {
        id: 'gpt-image-1.5',
        name: 'GPT-Image 1.5',
        sizes: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
        quality: ['low', 'medium', 'high', 'auto'],
        features: ['fast', 'image generation'],
        description: 'Optimized image generation model with high-quality output'
      },
      {
        id: 'gpt-image-1-mini',
        name: 'GPT-Image 1 Mini',
        sizes: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
        quality: ['low', 'medium', 'high', 'auto'],
        features: ['fast', 'cost effective', 'image generation'],
        description: 'Lightweight image generation model optimized for speed and cost'
      }
    ],
    audio: [
      {
        id: 'whisper-1',
        name: 'Whisper',
        formats: ['json', 'text', 'srt', 'verbose_json', 'vtt'],
        features: ['transcription', 'translation', 'language detection', 'multilingual'],
        max_file_size: '25MB',
        supported_formats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
        pricing: '$0.006 per minute',
        description: 'General-purpose speech recognition model for transcription and translation'
      }
    ]
  };

  return new Response(JSON.stringify({
    models,
    count: {
      chat: models.chat.length,
      image: models.image.length,
      audio: models.audio.length,
      total: models.chat.length + models.image.length + models.audio.length
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle /openapi.json — complete OpenAPI 3.0 specification
function handleOpenApiJson(corsHeaders) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'OpenAI Worker API',
      version: '1.0.0',
      description: 'Proxy API for OpenAI services including chat completions (GPT-4, GPT-4o, GPT-5, GPT-5.1, GPT-5.2), image generation (DALL-E 2, DALL-E 3, GPT-Image-1, GPT-Image-1.5, GPT-Image-1 Mini), audio transcription (Whisper-1), and branding generation. Supports per-user encrypted API key retrieval from D1 database with fallback to system key.'
    },
    servers: [
      {
        url: 'https://openai.vegvisr.org',
        description: 'Production'
      }
    ],
    tags: [
      { name: 'Meta', description: 'Health checks, model listings, and documentation' },
      { name: 'Chat', description: 'Chat completion endpoints for GPT models' },
      { name: 'Images', description: 'Image generation with DALL-E and GPT-Image models' },
      { name: 'Audio', description: 'Audio transcription with Whisper' },
      { name: 'Branding', description: 'AI-generated branding JSON' }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Meta'],
          summary: 'Health check',
          description: 'Returns worker health status, name, and current timestamp.',
          responses: {
            200: {
              description: 'Worker is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      worker: { type: 'string', example: 'openai-worker' },
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
          tags: ['Meta'],
          summary: 'OpenAPI 3.0 specification',
          description: 'Returns this OpenAPI 3.0 JSON specification documenting all endpoints.',
          responses: {
            200: {
              description: 'OpenAPI spec',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/api/docs': {
        get: {
          tags: ['Meta'],
          summary: 'API documentation (legacy)',
          description: 'Returns OpenAPI-style documentation. See /openapi.json for the canonical spec.',
          responses: {
            200: {
              description: 'API documentation JSON',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/models': {
        get: {
          tags: ['Meta'],
          summary: 'List all available models',
          description: 'Returns all supported chat, image, and audio models with their capabilities, supported sizes, quality levels, and features.',
          responses: {
            200: {
              description: 'Models list with counts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'object',
                        properties: {
                          chat: { type: 'array', items: { $ref: '#/components/schemas/ChatModel' } },
                          image: { type: 'array', items: { $ref: '#/components/schemas/ImageModel' } },
                          audio: { type: 'array', items: { $ref: '#/components/schemas/AudioModel' } }
                        }
                      },
                      count: {
                        type: 'object',
                        properties: {
                          chat: { type: 'integer' },
                          image: { type: 'integer' },
                          audio: { type: 'integer' },
                          total: { type: 'integer' }
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
      '/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Chat completions (all models)',
          description: 'Generic chat endpoint supporting all GPT models. Specify model in request body. API key retrieved from D1 using userId, falls back to system key.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatRequest' }
              }
            }
          },
          responses: {
            200: { description: 'Chat completion response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing or invalid messages array' },
            500: { description: 'API key not configured or upstream OpenAI error' }
          }
        }
      },
      '/gpt-4o': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-4o shortcut',
          description: 'Direct endpoint for GPT-4o (128K context, vision, function calling). Model is set automatically. Uses max_tokens.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModelChatRequest' } } } },
          responses: {
            200: { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-4': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-4 shortcut',
          description: 'Direct endpoint for GPT-4 (8K context). Model is set automatically. Uses max_tokens.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModelChatRequest' } } } },
          responses: {
            200: { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-5': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5 shortcut',
          description: 'Direct endpoint for GPT-5 (200K context, vision). Model is set automatically. Uses max_completion_tokens (not max_tokens).',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModelChatRequest' } } } },
          responses: {
            200: { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-5.1': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5.1 shortcut',
          description: 'Direct endpoint for GPT-5.1 (200K context). Model is set automatically. Uses max_completion_tokens (not max_tokens).',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModelChatRequest' } } } },
          responses: {
            200: { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-5.2': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5.2 shortcut',
          description: 'Direct endpoint for GPT-5.2 (200K context). Model is set automatically. Uses max_completion_tokens (not max_tokens).',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ModelChatRequest' } } } },
          responses: {
            200: { description: 'Chat completion', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/images/edits': {
        post: {
          tags: ['Images'],
          summary: 'Image editing with reference images',
          description:
            'Edit or compose using one to four REFERENCE IMAGES, named by https URL — the only route here that takes pictures in. ' +
            'The worker fetches each URL itself, so a caller sends short strings rather than base64; the hosts it will fetch from ' +
            'are allowlisted (vegvisr.imgix.net, photos-api.vegvisr.org, *.vegvisr.org, *.vegr.ai, plus EXTRA_IMAGE_HOSTS). ' +
            'ORDER MATTERS: refer to them in the prompt as "the first reference image", "the second", and so on. ' +
            'Size must have both edges a multiple of 16, each at most 3840, a ratio within 1:3 to 3:1, and 655,360 to 8,294,400 total pixels. ' +
            'Quality defaults to "low" on purpose — measured, "max" costs about 15x more and takes about 8x longer for the same request ' +
            '(low $0.014, high $0.061, max $0.219 at 1024x1024). The reply carries usage, duration_ms and cost_usd so a caller can see the bill. ' +
            'Expect 30-120 seconds; a max-quality call with two references measured 99 seconds.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['prompt', 'referenceImageUrls'],
                  properties: {
                    prompt: { type: 'string', description: 'What to make. Name each reference by position, and list every feature that must be preserved.' },
                    referenceImageUrls: {
                      type: 'array',
                      items: { type: 'string', format: 'uri' },
                      minItems: 1,
                      maxItems: 4,
                      description: 'https URLs on an allowlisted host. Order is the order the prompt refers to.'
                    },
                    model: { type: 'string', enum: ['gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'], default: 'gpt-image-2.5-sunburst' },
                    size: { type: 'string', default: 'auto', description: 'WIDTHxHEIGHT with both edges a multiple of 16, or "auto".' },
                    quality: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max', 'auto'], default: 'low' },
                    background: { type: 'string', description: 'Set "transparent" with output_format png or webp.' },
                    output_format: { type: 'string', enum: ['png', 'jpeg', 'webp'] },
                    userId: { type: 'string', description: 'Resolves a per-user OpenAI key; falls back to the worker key.' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Image produced, with usage, duration_ms and cost_usd', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt, a disallowed reference host, an unfetchable reference, or an invalid size' },
            500: { description: 'API key not configured or upstream error' }
          }
        }
      },
      '/images': {
        post: {
          tags: ['Images'],
          summary: 'Image generation (all models)',
          description: 'Generate images with DALL-E 2, DALL-E 3, GPT-Image-1, GPT-Image-1.5, or GPT-Image-1 Mini. Validates model-specific size constraints.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImageRequest' }
              }
            }
          },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt or invalid size for model' },
            500: { description: 'API key not configured or upstream error' }
          }
        }
      },
      '/dall-e-3': {
        post: {
          tags: ['Images'],
          summary: 'DALL-E 3 shortcut',
          description: 'Direct endpoint for DALL-E 3 image generation. Model is set automatically. Sizes: 1024x1024, 1024x1792, 1792x1024.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageModelRequest' } } } },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/dall-e-2': {
        post: {
          tags: ['Images'],
          summary: 'DALL-E 2 shortcut',
          description: 'Direct endpoint for DALL-E 2 image generation. Model is set automatically. Sizes: 256x256, 512x512, 1024x1024.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageModelRequest' } } } },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-image-1': {
        post: {
          tags: ['Images'],
          summary: 'GPT-Image-1 shortcut',
          description: 'Direct endpoint for GPT-Image-1. Multimodal LLM with vision and image generation. Sizes: 1024x1024, 1536x1024, 1024x1536, auto.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageModelRequest' } } } },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-image-1-mini': {
        post: {
          tags: ['Images'],
          summary: 'GPT-Image-1 Mini shortcut',
          description: 'Direct endpoint for GPT-Image-1 Mini. Lightweight, fast image generation. Sizes: 1024x1024, 1536x1024, 1024x1536, auto.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageModelRequest' } } } },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/gpt-image-1.5': {
        post: {
          tags: ['Images'],
          summary: 'GPT-Image-1.5 shortcut',
          description: 'Direct endpoint for GPT-Image-1.5. High-quality image generation. Sizes: 1024x1024, 1536x1024, 1024x1536, auto.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageModelRequest' } } } },
          responses: {
            200: { description: 'Image generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImageResponse' } } } },
            400: { description: 'Missing prompt' },
            500: { description: 'API key not configured' }
          }
        }
      },
      '/audio': {
        post: {
          tags: ['Audio'],
          summary: 'Audio transcription',
          description: 'Transcribe audio files using Whisper-1. Supports mp3, mp4, mpeg, mpga, m4a, wav, webm. Max 25MB. Normalizes .opus to .ogg for OpenAI compatibility.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Audio file (mp3, mp4, mpeg, mpga, m4a, wav, webm). Max 25MB.' },
                    model: { type: 'string', default: 'whisper-1', description: 'Transcription model' },
                    language: { type: 'string', description: 'ISO-639-1 language code (e.g. "en", "no", "es")' },
                    prompt: { type: 'string', description: 'Optional prompt to guide transcription style' },
                    response_format: { type: 'string', enum: ['json', 'text', 'srt', 'verbose_json', 'vtt'], default: 'json' },
                    temperature: { type: 'number', minimum: 0, maximum: 1, description: 'Sampling temperature' },
                    userId: { type: 'string', description: 'User ID for D1 key lookup' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Transcription result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: 'Transcribed text' }
                    }
                  }
                }
              }
            },
            400: { description: 'Missing file in form data' },
            401: { description: 'API key not configured (no user key and no system key)' },
            500: { description: 'Server error' }
          }
        }
      },
      '/whisper-1': {
        post: {
          tags: ['Audio'],
          summary: 'Whisper-1 shortcut',
          description: 'Alias for /audio. Same parameters and behavior.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    model: { type: 'string', default: 'whisper-1' },
                    language: { type: 'string' },
                    prompt: { type: 'string' },
                    response_format: { type: 'string', enum: ['json', 'text', 'srt', 'verbose_json', 'vtt'], default: 'json' },
                    temperature: { type: 'number' },
                    userId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Transcription result', content: { 'application/json': { schema: { type: 'object', properties: { text: { type: 'string' } } } } } },
            400: { description: 'Missing file' },
            401: { description: 'API key not configured' }
          }
        }
      },
      '/branding/generate': {
        post: {
          tags: ['Branding'],
          summary: 'Generate branding JSON',
          description: 'Uses GPT-4o-mini to generate a complete branding JSON configuration including theme colors, copy text, and layout settings for a web app.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for D1 API key lookup (required)' },
                    brandName: { type: 'string', description: 'Name of the brand', default: '' },
                    appName: { type: 'string', description: 'Name of the application', default: 'Vegvisr Connect' },
                    audience: { type: 'string', description: 'Target audience description', default: '' },
                    prompt: { type: 'string', description: 'Additional user instructions for branding', default: '' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Generated branding configuration',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      branding: {
                        type: 'object',
                        description: 'Complete branding JSON with brand, theme, copy, language, and layout sections',
                        properties: {
                          brand: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              logoUrl: { type: 'string' },
                              slogan: { type: 'string' }
                            }
                          },
                          theme: {
                            type: 'object',
                            properties: {
                              background: { type: 'object' },
                              text: { type: 'object' },
                              card: { type: 'object' },
                              button: { type: 'object' }
                            }
                          },
                          copy: {
                            type: 'object',
                            properties: {
                              badge: { type: 'string' },
                              headline: { type: 'string' },
                              subheadline: { type: 'string' },
                              emailLabel: { type: 'string' },
                              emailPlaceholder: { type: 'string' },
                              cta: { type: 'string' }
                            }
                          },
                          language: { type: 'object', properties: { default: { type: 'string' } } },
                          layout: { type: 'object', properties: { showLanguageToggle: { type: 'boolean' } } }
                        }
                      }
                    }
                  }
                }
              }
            },
            400: { description: 'Missing userId' },
            500: { description: 'API key not configured, upstream error, or failed to parse branding JSON' }
          }
        }
      }
    },
    components: {
      schemas: {
        Message: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { type: 'string', enum: ['system', 'user', 'assistant'] },
            content: { type: 'string' }
          }
        },
        ChatRequest: {
          type: 'object',
          required: ['messages'],
          properties: {
            userId: { type: 'string', description: 'User ID for retrieving encrypted API key from D1. Falls back to system key if absent.' },
            model: { type: 'string', enum: ['gpt-4o', 'gpt-4', 'gpt-5', 'gpt-5.1', 'gpt-5.2'], default: 'gpt-4o', description: 'GPT model to use' },
            messages: { type: 'array', items: { $ref: '#/components/schemas/Message' }, description: 'Array of chat messages' },
            temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
            max_tokens: { type: 'integer', description: 'Max tokens for GPT-4/GPT-4o. Do NOT use with GPT-5.x.' },
            max_completion_tokens: { type: 'integer', description: 'Max completion tokens for GPT-5.x models.' },
            top_p: { type: 'number', minimum: 0, maximum: 1, default: 1 },
            frequency_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
            presence_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
            stream: { type: 'boolean', default: false, description: 'Enable streaming response' },
            tools: { type: 'array', items: { type: 'object' }, description: 'Function calling tool definitions' },
            tool_choice: { description: 'Function calling mode: "auto", "none", or specific function object' }
          }
        },
        ModelChatRequest: {
          type: 'object',
          required: ['messages'],
          description: 'Request body for model-specific shortcut endpoints. Model is set by the URL path.',
          properties: {
            userId: { type: 'string', description: 'User ID for D1 key lookup' },
            messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
            temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
            max_tokens: { type: 'integer', description: 'For GPT-4/GPT-4o only' },
            max_completion_tokens: { type: 'integer', description: 'For GPT-5.x only' },
            tools: { type: 'array', items: { type: 'object' }, description: 'Function calling tool definitions' },
            tool_choice: { description: 'Function calling mode' }
          }
        },
        ChatResponse: {
          type: 'object',
          description: 'Standard OpenAI chat completion response (proxied directly)',
          properties: {
            id: { type: 'string', example: 'chatcmpl-abc123' },
            object: { type: 'string', example: 'chat.completion' },
            model: { type: 'string' },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  index: { type: 'integer' },
                  message: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      content: { type: 'string' }
                    }
                  },
                  finish_reason: { type: 'string', enum: ['stop', 'length', 'tool_calls', 'content_filter'] }
                }
              }
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer' },
                completion_tokens: { type: 'integer' },
                total_tokens: { type: 'integer' }
              }
            }
          }
        },
        ImageRequest: {
          type: 'object',
          required: ['prompt'],
          properties: {
            userId: { type: 'string', description: 'User ID for D1 key retrieval' },
            model: { type: 'string', enum: ['dall-e-2', 'dall-e-3', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini'], default: 'dall-e-3' },
            prompt: { type: 'string', maxLength: 4000 },
            size: { type: 'string', description: 'DALL-E 2: 256x256|512x512|1024x1024. DALL-E 3: 1024x1024|1024x1792|1792x1024. GPT-Image: 1024x1024|1536x1024|1024x1536|auto.', default: '1024x1024' },
            quality: { type: 'string', enum: ['standard', 'hd', 'low', 'medium', 'high', 'auto'], default: 'standard', description: 'DALL-E 3: standard|hd. GPT-Image: low|medium|high|auto.' },
            n: { type: 'integer', minimum: 1, maximum: 10, default: 1, description: 'Number of images. DALL-E 3 always generates 1.' }
          }
        },
        ImageModelRequest: {
          type: 'object',
          required: ['prompt'],
          description: 'Request body for image model shortcut endpoints. Model is set by the URL path.',
          properties: {
            prompt: { type: 'string', maxLength: 4000 },
            size: { type: 'string', default: '1024x1024' },
            quality: { type: 'string', default: 'standard' },
            apiKey: { type: 'string', description: 'Direct API key (alternative to userId-based lookup)' }
          }
        },
        ImageResponse: {
          type: 'object',
          description: 'Standard OpenAI image generation response (proxied directly)',
          properties: {
            created: { type: 'integer' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri' },
                  revised_prompt: { type: 'string', description: 'Present for DALL-E 3 and GPT-Image-1' }
                }
              }
            }
          }
        },
        ChatModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            context_length: { type: 'integer' },
            max_output_tokens: { type: 'integer' },
            features: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' }
          }
        },
        ImageModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sizes: { type: 'array', items: { type: 'string' } },
            quality: { type: 'array', items: { type: 'string' } },
            features: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' }
          }
        },
        AudioModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            formats: { type: 'array', items: { type: 'string' } },
            features: { type: 'array', items: { type: 'string' } },
            max_file_size: { type: 'string' },
            supported_formats: { type: 'array', items: { type: 'string' } },
            pricing: { type: 'string' },
            description: { type: 'string' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' },
            stack: { type: 'string', description: 'Stack trace (only on 500 errors)' }
          }
        }
      }
    }
  };

  return new Response(JSON.stringify(spec, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Handle API documentation
function handleApiDocs(corsHeaders) {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'OpenAI Worker API Documentation',
      version: '1.0.0',
      description: 'Complete OpenAI API integration with 11 models: 5 chat (GPT-4o, GPT-4, GPT-5, GPT-5.1, GPT-5.2), 5 image (DALL-E 2, DALL-E 3, GPT-Image-1, GPT-Image-1.5, GPT-Image-1 Mini), 1 audio (Whisper-1). Features userId-based encrypted key retrieval from D1 database.',
      contact: {
        name: 'Vegvisr Platform',
        url: 'https://openai.vegvisr.org'
      }
    },
    servers: [
      {
        url: 'https://openai.vegvisr.org',
        description: 'OpenAI Worker (Production)'
      }
    ],
    tags: [
      { name: 'Chat', description: 'Chat completion endpoints for GPT models' },
      { name: 'Images', description: 'Image generation with DALL-E and GPT-Image-1' },
      { name: 'Audio', description: 'Audio transcription with Whisper' },
      { name: 'Meta', description: 'Health checks and model listings' }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Meta'],
          summary: 'Health check',
          description: 'Check if worker is running',
          responses: {
            200: {
              description: 'Worker is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      worker: { type: 'string', example: 'openai-worker' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/models': {
        get: {
          tags: ['Meta'],
          summary: 'List all available models',
          description: 'Get complete list of 8 OpenAI models with capabilities, parameters, and pricing',
          responses: {
            200: {
              description: 'Models list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: {
                        type: 'object',
                        properties: {
                          chat: { type: 'array', items: { $ref: '#/components/schemas/ChatModel' } },
                          image: { type: 'array', items: { $ref: '#/components/schemas/ImageModel' } },
                          audio: { type: 'array', items: { $ref: '#/components/schemas/AudioModel' } }
                        }
                      },
                      count: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Chat completions (all models)',
          description: 'Generic chat endpoint supporting all 5 GPT models. API key retrieved from D1 using userId.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ChatRequest' },
                examples: {
                  'gpt-4o': {
                    summary: 'GPT-4o example',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'gpt-4o',
                      messages: [{ role: 'user', content: 'Explain quantum computing in one sentence' }],
                      max_tokens: 100
                    }
                  },
                  'gpt-5.2': {
                    summary: 'GPT-5.2 example (uses max_completion_tokens)',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'gpt-5.2',
                      messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'What is AI?' }],
                      max_completion_tokens: 150
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Chat completion response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ChatResponse' }
                }
              }
            },
            400: { description: 'Missing messages array' },
            500: { description: 'API key not configured or OpenAI error' }
          }
        }
      },
      '/gpt-4o': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-4o endpoint',
          description: 'Direct endpoint for GPT-4o (128K context, vision, function calling). Uses max_tokens parameter.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for D1 key lookup' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    temperature: { type: 'number', default: 0.7, minimum: 0, maximum: 2 },
                    max_tokens: { type: 'integer', description: 'GPT-4o uses max_tokens (not max_completion_tokens)' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } }
          }
        }
      },
      '/gpt-4': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-4 endpoint',
          description: 'Direct endpoint for GPT-4 (8K context). Uses max_tokens parameter.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    max_tokens: { type: 'integer' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } }
          }
        }
      },
      '/gpt-5': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5 endpoint',
          description: 'Direct endpoint for GPT-5 (200K context, vision). IMPORTANT: Uses max_completion_tokens (not max_tokens).',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    max_completion_tokens: { type: 'integer', description: 'GPT-5+ uses max_completion_tokens' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } }
          }
        }
      },
      '/gpt-5.1': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5.1 endpoint (Latest)',
          description: 'Direct endpoint for GPT-5.1 (200K context, latest release). IMPORTANT: Uses max_completion_tokens (not max_tokens).',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for encrypted key retrieval from D1' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    max_completion_tokens: { type: 'integer', description: 'CRITICAL: GPT-5.1 requires max_completion_tokens (max_tokens will error)' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Error if max_tokens used instead of max_completion_tokens' }
          }
        }
      },
      '/gpt-5.2': {
        post: {
          tags: ['Chat'],
          summary: 'GPT-5.2 endpoint (Latest)',
          description: 'Direct endpoint for GPT-5.2 (200K context, latest release). IMPORTANT: Uses max_completion_tokens (not max_tokens).',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'messages'],
                  properties: {
                    userId: { type: 'string', description: 'User ID for encrypted key retrieval from D1' },
                    messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
                    max_completion_tokens: { type: 'integer', description: 'CRITICAL: GPT-5.2 requires max_completion_tokens (max_tokens will error)' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatResponse' } } } },
            400: { description: 'Error if max_tokens used instead of max_completion_tokens' }
          }
        }
      },
      '/images': {
        post: {
          tags: ['Images'],
          summary: 'Image generation',
          description: 'Generate images with DALL-E 2, DALL-E 3, GPT-Image-1, GPT-Image-1.5, or GPT-Image-1 Mini. GPT Image models support size 1024x1024, 1536x1024, 1024x1536, or auto; quality low/medium/high/auto.',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImageRequest' },
                examples: {
                  'dall-e-3': {
                    summary: 'DALL-E 3 example',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'dall-e-3',
                      prompt: 'A photorealistic sunset over mountains',
                      size: '1024x1024',
                      quality: 'hd'
                    }
                  },
                  'gpt-image-1': {
                    summary: 'GPT-Image-1 (multimodal LLM)',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'gpt-image-1',
                      prompt: 'A minimalist logo with geometric shapes',
                      size: '1024x1024'
                    }
                  },
                  'gpt-image-1.5': {
                    summary: 'GPT-Image-1.5 (high quality)',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'gpt-image-1.5',
                      prompt: 'A cinematic portrait of a fox in a misty forest',
                      size: '1024x1024',
                      quality: 'high'
                    }
                  },
                  'gpt-image-1-mini': {
                    summary: 'GPT-Image-1 Mini (fast & lightweight)',
                    value: {
                      userId: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
                      model: 'gpt-image-1-mini',
                      prompt: 'A friendly robot sketch in pencil style',
                      size: '512x512'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Image generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      created: { type: 'integer' },
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            url: { type: 'string', format: 'uri' },
                            revised_prompt: { type: 'string', description: 'Only for GPT-Image-1 and DALL-E 3' }
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
      '/audio': {
        post: {
          tags: ['Audio'],
          summary: 'Audio transcription',
          description: 'Transcribe audio files using Whisper-1. Supports mp3, mp4, wav, webm. Max 25MB. API key from D1.',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file', 'userId'],
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Audio file (mp3, mp4, wav, webm)' },
                    userId: { type: 'string', description: 'User ID for D1 key lookup' },
                    model: { type: 'string', default: 'whisper-1' },
                    language: { type: 'string', description: 'ISO-639-1 code (e.g., "en", "es")' },
                    response_format: { type: 'string', enum: ['json', 'text', 'srt', 'vtt', 'verbose_json'], default: 'json' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Transcription complete',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      text: { type: 'string', description: 'Transcribed text' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Message: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { type: 'string', enum: ['system', 'user', 'assistant'] },
            content: { type: 'string' }
          }
        },
        ChatRequest: {
          type: 'object',
          required: ['userId', 'messages'],
          properties: {
            userId: {
              type: 'string',
              description: 'User ID for retrieving encrypted API key from D1 database. Falls back to system key if user has none.'
            },
            model: { type: 'string', enum: ['gpt-4o', 'gpt-4', 'gpt-5', 'gpt-5.1', 'gpt-5.2'], default: 'gpt-4o' },
            messages: { type: 'array', items: { $ref: '#/components/schemas/Message' } },
            temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
            max_tokens: {
              type: 'integer',
              description: 'For GPT-4 and GPT-4o only. Do NOT use with GPT-5.x.'
            },
            max_completion_tokens: {
              type: 'integer',
              description: 'For GPT-5.x only. Required for these models.'
            },
            top_p: { type: 'number', minimum: 0, maximum: 1, default: 1 },
            frequency_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 },
            presence_penalty: { type: 'number', minimum: -2, maximum: 2, default: 0 }
          }
        },
        ChatResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            model: { type: 'string' },
            choices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      content: { type: 'string' }
                    }
                  },
                  finish_reason: { type: 'string' }
                }
              }
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer' },
                completion_tokens: { type: 'integer' },
                total_tokens: { type: 'integer' },
                completion_tokens_details: {
                  type: 'object',
                  properties: {
                    reasoning_tokens: { type: 'integer', description: 'GPT-5+ only: tokens used for reasoning' }
                  }
                }
              }
            }
          }
        },
        ImageRequest: {
          type: 'object',
          required: ['userId', 'prompt'],
          properties: {
            userId: { type: 'string', description: 'User ID for D1 key retrieval' },
            model: { type: 'string', enum: ['dall-e-2', 'dall-e-3', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-1-mini'], default: 'dall-e-3' },
            prompt: { type: 'string', maxLength: 4000 },
            size: {
              type: 'string',
              enum: [
                '256x256', '512x512', '1024x1024',
                '1024x1792', '1792x1024',
                '1024x1536', '1536x1024',
                'auto'
              ],
              description: 'DALL-E 2: 256x256, 512x512, 1024x1024. DALL-E 3: 1024x1024, 1024x1792, 1792x1024. GPT Image (1/1.5/mini): 1024x1024, 1536x1024, 1024x1536, or auto.'
            },
            quality: { type: 'string', enum: ['standard', 'hd', 'low', 'medium', 'high', 'auto'], description: 'DALL-E 3: standard|hd. GPT Image: low|medium|high|auto.' },
            n: { type: 'integer', minimum: 1, maximum: 10, description: 'DALL-E 2 only (1-10). DALL-E 3: always 1' }
          }
        },
        ChatModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            context_length: { type: 'string' },
            max_output: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } },
            pricing: { type: 'object' }
          }
        },
        ImageModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sizes: { type: 'array', items: { type: 'string' } },
            quality: { type: 'array', items: { type: 'string' } },
            features: { type: 'array', items: { type: 'string' } }
          }
        },
        AudioModel: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            formats: { type: 'array', items: { type: 'string' } },
            features: { type: 'array', items: { type: 'string' } },
            max_file_size: { type: 'string' },
            pricing: { type: 'string' }
          }
        }
      },
      securitySchemes: {
        D1Database: {
          type: 'apiKey',
          in: 'body',
          name: 'userId',
          description: 'User ID used to retrieve encrypted OpenAI API key from D1 database (vegvisr_org.user_api_keys). Key is decrypted using ENCRYPTION_MASTER_KEY and used for OpenAI API calls. Falls back to env.OPENAI_API_KEY if user has no key stored.'
        }
      }
    }
  };

  return new Response(JSON.stringify(openApiSpec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
