/**
 * images-service.js — generate an image and put it where a node already asked for one.
 *
 * THE SHAPE OF THIS, AND WHY
 * --------------------------
 * The fulltext element templates already ship with placeholder image URLs — HEADERIMG.png,
 * SIDEIMG.png, FANCYIMG.png — so the system already has a convention for "image not chosen
 * yet". A model that copies an element's format verbatim, which is what get_fulltext_elements
 * tells it to do, therefore writes a node that is already asking for an image and already says
 * where it goes and at what size. This fills that in. No new syntax is invented, and a
 * half-finished node looks half-finished instead of silently wrong.
 *
 * Image bytes never cross MCP. The model supplies a prompt; generation, upload and the swap all
 * happen here. Passing an image through a tool argument would mean base64 through the model's
 * context — a 1 MB image becomes ~1.4 MB of text — and a URL from the model's own image tool is
 * typically short-lived or authenticated, so it cannot be fetched again later.
 */

import * as gs from './graph-service.js'

const { ERR, statusForCode, graphLinks, checkAccess, updateNode } = gs

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/**
 * The text-to-image models on this account's AI binding, listed by `wrangler ai models`.
 *
 * An enum rather than a free string, for the reason node types are: a model asked to pick from
 * prose invents a plausible value, and an invented model id fails at generation time after the
 * caller has already been told the call is running.
 *
 * The default WAS stable-diffusion-xl-lightning, inherited from Agent-Builder's generate_image
 * without anyone asking whether it suited the job. "Lightning" is a distilled SDXL that trades
 * quality for a 4-8 step run — right for a preview, wrong for a header image in a published
 * article, which is what this tool actually produces. Lucid Origin is the default now; lightning
 * is still here for when speed matters more than the result.
 */
export const IMAGE_MODELS = [
  '@cf/leonardo/lucid-origin',
  '@cf/leonardo/phoenix-1.0',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/bytedance/stable-diffusion-xl-lightning',
]

export const DEFAULT_IMAGE_MODEL = '@cf/leonardo/lucid-origin'

/**
 * Models that were offered and are not any more, with the reason, so a caller naming one is told
 * something better than "unknown" and nobody re-adds it by working from the Workers AI catalog.
 *
 * flux-1-schnell is a capable model and the wrong one for THIS tool. It accepts no width and no
 * height at all, and every image this tool makes fills a placeholder whose element already
 * declared a size — `![Header|width:800px]`. A model that cannot honour the one thing the
 * surrounding markup already decided does not belong in the list, however good its pictures are.
 * It also has no seed, so nothing made with it can be reproduced.
 */
export const RETIRED_MODELS = {
  '@cf/black-forest-labs/flux-1-schnell':
    'it accepts no width or height, and this tool fills a placeholder whose element already set a size',
}

/**
 * What each model will actually ACCEPT, read from its published input schema — not guessed.
 *
 * Source: the JSON schema rendered on each model's page under
 * developers.cloudflare.com/workers-ai/models/<name>/, read 2026-09-30. Worth reading before
 * changing a number here, because the five disagree in ways a single passthrough cannot survive:
 *
 *   - phoenix-1.0's guidance MINIMUM is 2, not 0. guidance: 1 is valid for lucid-origin and
 *     rejected here.
 *   - the two SDXLs cap num_steps at 20; lucid-origin allows 40 and phoenix 50. The same number
 *     is a modest render on one and above the ceiling on another.
 *   - lucid-origin accepts up to 2500px — larger than the 2048 the others stop at — and is the
 *     only one that takes both `num_steps` and `steps`.
 *   - negative_prompt exists on phoenix and the two SDXLs; lucid-origin has no such parameter.
 *
 * `guidanceRange: null` means the schema documents the parameter with no bounds. The numbers used
 * in that case are OUR guard against an absurd value, not the model's limit, and are marked so.
 *
 * ONE number here is not from the schema: the 256 px floor on the two Leonardo models. Their
 * pages give the minimum as 0, which is not a request anyone means, so the SDXL floor is applied
 * across every model. Every other figure is transcribed.
 */
export const MODEL_CAPABILITIES = {
  '@cf/leonardo/lucid-origin': {
    stepsParam: 'num_steps',
    stepsRange: [1, 40],
    guidanceRange: [0, 10],
    seed: true,
    negativePrompt: false,
    sizeRange: [256, 2500],
    // Omitted for "standard" so Cloudflare's own default applies; the rest are chosen points in
    // the documented range, not a formula.
    qualitySteps: { draft: 10, high: 30, max: 40 },
  },
  '@cf/leonardo/phoenix-1.0': {
    stepsParam: 'num_steps',
    stepsRange: [1, 50],
    guidanceRange: [2, 10],
    seed: true,
    negativePrompt: true,
    sizeRange: [256, 2048],
    qualitySteps: { draft: 10, high: 35, max: 50 },
  },
  '@cf/stabilityai/stable-diffusion-xl-base-1.0': {
    stepsParam: 'num_steps',
    stepsRange: [1, 20],
    guidanceRange: null, // schema documents no bounds; the clamp below is ours
    seed: true,
    negativePrompt: true,
    sizeRange: [256, 2048],
    qualitySteps: { draft: 8, high: 16, max: 20 },
  },
  '@cf/bytedance/stable-diffusion-xl-lightning': {
    stepsParam: 'num_steps',
    stepsRange: [1, 20],
    guidanceRange: null, // schema documents no bounds; the clamp below is ours
    seed: true,
    negativePrompt: true,
    sizeRange: [256, 2048],
    qualitySteps: { draft: 4, high: 12, max: 20 },
  },
}

/** Our own guard where the schema gives none. Not a model limit — see MODEL_CAPABILITIES. */
const UNDOCUMENTED_GUIDANCE_GUARD = [0, 20]

/**
 * A number the caller actually supplied, or null.
 *
 * Number(null) is 0, not NaN — so a bare Number.isFinite(Number(v)) test reads an UNSET
 * parameter as a deliberate zero. That turned "no steps requested" into steps: 0, clamped to the
 * model minimum of 1, and quietly set every image to a one-step render. Caught by the existing
 * payload assertions within a minute of being written; it would not have been visible in a
 * finished picture, only in a worse one.
 */
function suppliedNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export const IMAGE_QUALITY_LEVELS = ['draft', 'standard', 'high', 'max']

/**
 * The prompt vocabulary, copied VERBATIM from IMAGE_*_PRESETS in
 * Agent-Builder/src/components/VegvisrAgentChat.tsx.
 *
 * Copied rather than imported because the two live in different repos and deploy separately —
 * but copied exactly, token for token, so the same choice produces the same picture through the
 * chat UI and through MCP. If the UI's wording changes, change it here too; a style that means
 * one thing in one surface and another elsewhere is worse than no preset at all.
 *
 * WHY presets exist on an MCP tool at all: the UI gives a person dropdowns. A chat gives them
 * nothing, so either the model knows which phrases this model responds to — it does not — or
 * the server does. These enums put the vocabulary in the tool schema where a model can SEE it,
 * which is the same reason node types are an enum and not prose.
 */
export const IMAGE_FORMATS = {
  'landscape-16:9': { width: 1120, height: 630 },
  'cinematic-4:2': { width: 1200, height: 600 },
  'square-1:1': { width: 1024, height: 1024 },
  'portrait-4:5': { width: 896, height: 1120 },
  'story-9:16': { width: 630, height: 1120 },
}

export const IMAGE_STYLES = {
  photoreal: 'photorealistic rendering, professional clarity, rich textures',
  cinematic: 'cinematic precision, dramatic composition, widescreen film still',
  editorial: 'editorial photography, magazine-quality composition, clean subject separation',
  poster: 'poster design, strong composition, striking visual hierarchy',
  illustration: 'illustrated style, crafted visual storytelling, clean shapes',
  'pixar-3d': 'internal test render, Pixar style, polished 3D animated look',
  'concept-art': 'concept art, artstation quality, atmospheric visual development',
}

/**
 * Camera and film traits, from IMAGE_RENDER_TRAITS and the branch that expands them in
 * composeImagePrompt(). Several may apply at once, which is why this is a list and not a choice.
 */
export const IMAGE_RENDER_TRAITS = {
  'long-exposure': 'long exposure photograph',
  '35mm-lens': '35mm lens',
  '85mm-portrait': '85mm portrait lens',
  'shallow-depth-of-field': 'shallow depth of field',
  'film-grain': 'film grain',
  'anamorphic-lens-flare': 'anamorphic lens flare',
}

/**
 * How lettering should look when the picture is meant to CONTAIN words.
 *
 * Diffusion models render text unreliably at the best of times, so this is worth reaching for
 * only when the words are the point — a poster, a logo, a sign. The tool says so, because a
 * caller who asks for text and gets garbled letters has paid ten seconds to learn it.
 */
export const IMAGE_TEXT_TREATMENTS = {
  'poster-title': 'bold poster title, clean edges',
  logo: 'logo design, crisp letterforms, balanced mark composition',
  neon: 'neon glowing outline, illuminated signage',
  'gold-serif': 'elegant serif lettering, gold foil embossed look',
  'carved-stone': 'chiseled stone inscription, carved letterforms',
}

export const IMAGE_LIGHTING = {
  'golden-hour': 'golden hour, warm diffused natural light',
  'soft-studio': 'softbox lighting, clean studio illumination',
  'low-key': 'low key lighting, moody high contrast shadows',
  overcast: 'diffused overcast light, matte editorial tone',
  candlelight: 'candlelight glow, warm amber practical lighting',
  'nordic-twilight': 'Nordic twilight, cool blue hour atmosphere',
}

/**
 * Assemble the text actually sent to the model: subject first, then style, then lighting —
 * the same order and the same comma joining composeImagePrompt() uses in the chat UI.
 */
export function composeImagePrompt({
  prompt,
  style = null,
  lighting = null,
  renderTraits = null,
  imageText = null,
  textTreatment = null,
}) {
  const parts = [String(prompt || '').trim()]
  if (style && IMAGE_STYLES[style]) parts.push(IMAGE_STYLES[style])
  if (lighting && IMAGE_LIGHTING[lighting]) parts.push(IMAGE_LIGHTING[lighting])

  // Traits are emitted in the table's own order, not the caller's, so the same set of choices
  // always produces the same string — the chat UI checks them in a fixed order for the same
  // reason. Unknown names are dropped rather than passed through as stray prompt words.
  if (Array.isArray(renderTraits)) {
    for (const [name, token] of Object.entries(IMAGE_RENDER_TRAITS)) {
      if (renderTraits.includes(name)) parts.push(token)
    }
  }

  // Text last, and only when there is text: the treatment describes lettering, so it means
  // nothing without words to letter.
  const text = String(imageText || '').trim()
  if (text) {
    parts.push(`the text "${text}"`)
    if (textTreatment && IMAGE_TEXT_TREATMENTS[textTreatment]) parts.push(IMAGE_TEXT_TREATMENTS[textTreatment])
  }

  return parts.filter(Boolean).join(', ').replace(/\s+,/g, ',').trim()
}

/**
 * What kind of picture arrived, sniffed from the bytes rather than assumed per model.
 *
 * Models differ in BOTH the envelope and the format: SDXL streams raw bytes, the Leonardo models
 * return `{ image: "<base64>" }`, and nothing documents which of them emits PNG rather than
 * JPEG. Guessing per model would be another contract written from memory, so the bytes are
 * asked instead. Returning null is how "this is not an image at all" is still caught — the
 * failure that made the original JPEG check worth having.
 */
function sniffImageType(bytes) {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' }
  const tag = String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12))
  if (tag === 'RIFFWEBP') return { ext: 'webp', mime: 'image/webp' }
  return null
}

/**
 * The placeholder each element family carries, and the name a caller uses for it.
 * These strings come from the live catalog (GET /plugin/fulltext-elements), not from memory.
 * SIDEIMG covers both Leftside and Rightside — the element decided the side, not this tool.
 */
export const PLACEHOLDERS = {
  header: 'https://vegvisr.imgix.net/HEADERIMG.png',
  side: 'https://vegvisr.imgix.net/SIDEIMG.png',
  fancy: 'https://vegvisr.imgix.net/FANCYIMG.png',
}

/**
 * The caller's own upload credential, read on the server.
 *
 * photos-worker's /upload authenticates with X-API-Token resolved against
 * config.emailVerificationToken; it has no service-binding trust path. Verified by probe: with
 * no header it answers 401 "Missing X-API-Token header". So the upload runs as the
 * authenticated user — which also means a World Founder's bytes land in their own R2 account,
 * because photos-worker routes on that same identity.
 *
 * The token is never accepted from a tool argument, never returned, and never logged.
 */
async function uploadTokenFor(env, actor) {
  if (!actor?.email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ? LIMIT 1')
    .bind(actor.email)
    .first()
  return row?.emailVerificationToken || null
}

/**
 * Turn what the caller asked for into a payload the CHOSEN model will accept, and say out loud
 * whatever had to change on the way.
 *
 * CLAMP AND REPORT, rather than refuse. A caller who asks SDXL Lightning for 40 steps has made
 * a reasonable request of the wrong model; failing the call costs a round trip and produces no
 * picture, so the run happens at 20 and the reply says the number moved. Silence is the one
 * option ruled out — Agent-Builder's generate_image advertised width, height and seed in its
 * schema and dropped all three in the executor, and the only way that was ever discovered was
 * the user measuring a file (2026-09-04). A parameter that is ignored must be reported ignored.
 *
 * Returns { payload, applied, notes }. `notes` is caller-facing prose, one line per adjustment.
 */
export function resolveModelParams(model, requested = {}) {
  const caps = MODEL_CAPABILITIES[model]
  if (!caps) return { payload: {}, applied: {}, notes: [] }

  const short = model.split('/').pop()
  const payload = {}
  const applied = {}
  const notes = []

  // ── size ────────────────────────────────────────────────────────────────────
  const { format = null, width = null, height = null } = requested
  const preset = format && IMAGE_FORMATS[format] ? IMAGE_FORMATS[format] : null
  if (caps.sizeRange === false) {
    if (preset || width || height) {
      notes.push(`${short} has no width or height parameter — it generates at its own fixed size, so the size you asked for was not sent.`)
    }
  } else {
    const [minSide, maxSide] = caps.sizeRange
    const clampSide = (value, round) => {
      const n = Number.parseInt(value ?? '', 10)
      if (!Number.isFinite(n)) return null
      const r = round ? Math.round(n / 8) * 8 : n
      return Math.min(maxSide, Math.max(minSide, r))
    }
    // A named format carries exact dimensions and is NOT rounded to a multiple of 8: the chat UI
    // sends 1120x630 and it works, so rounding would quietly change an aspect ratio the caller
    // asked for BY NAME. Loose numbers are free input and do get rounded.
    const w = preset ? clampSide(preset.width, false) : clampSide(width, true)
    const h = preset ? clampSide(preset.height, false) : clampSide(height, true)
    if (w) { payload.width = w; applied.width = w }
    if (h) { payload.height = h; applied.height = h }
    if (!preset && width && w !== null && Number.parseInt(width, 10) !== w) {
      notes.push(`width ${width} became ${w} — ${short} takes ${minSide}-${maxSide} px in multiples of 8.`)
    }
    if (!preset && height && h !== null && Number.parseInt(height, 10) !== h) {
      notes.push(`height ${height} became ${h} — ${short} takes ${minSide}-${maxSide} px in multiples of 8.`)
    }
  }

  // ── steps ───────────────────────────────────────────────────────────────────
  // An explicit number beats a named level: someone who passes steps knows what it is.
  const [minSteps, maxSteps] = caps.stepsRange
  const askedSteps = suppliedNumber(requested.steps)
  let wantSteps = null
  if (askedSteps !== null) {
    wantSteps = Math.round(askedSteps)
  } else if (requested.quality && requested.quality !== 'standard') {
    wantSteps = caps.qualitySteps[requested.quality] ?? null
  }
  if (wantSteps !== null) {
    const clamped = Math.min(maxSteps, Math.max(minSteps, wantSteps))
    payload[caps.stepsParam] = clamped
    applied[caps.stepsParam] = clamped
    if (clamped !== wantSteps) {
      notes.push(`steps ${wantSteps} became ${clamped} — ${short} accepts ${minSteps}-${maxSteps}.`)
    }
  }

  // ── guidance ────────────────────────────────────────────────────────────────
  const askedGuidance = suppliedNumber(requested.guidance)
  if (askedGuidance !== null) {
    const want = askedGuidance
    if (caps.guidanceRange === false) {
      notes.push(`${short} has no guidance parameter, so guidance ${want} was not sent.`)
    } else {
      const [lo, hi] = caps.guidanceRange === null ? UNDOCUMENTED_GUIDANCE_GUARD : caps.guidanceRange
      const clamped = Math.min(hi, Math.max(lo, want))
      payload.guidance = clamped
      applied.guidance = clamped
      if (clamped !== want) {
        notes.push(`guidance ${want} became ${clamped} — ${short} accepts ${lo}-${hi}.`)
      }
    }
  }

  // ── seed ────────────────────────────────────────────────────────────────────
  // Seed 0 is a legal seed and a falsy number. A truthiness test here would silently discard it
  // and break the one thing a seed is for: asking for the same picture twice.
  const askedSeed = suppliedNumber(requested.seed)
  if (askedSeed !== null) {
    const want = Math.round(askedSeed)
    if (!caps.seed) {
      notes.push(`${short} has no seed parameter, so seed ${want} was not sent and this image cannot be reproduced. Use lucid-origin for a repeatable result.`)
    } else if (want < 0) {
      notes.push(`seed ${want} was not sent — a seed must be 0 or greater.`)
    } else {
      payload.seed = want
      applied.seed = want
    }
  }

  // ── negative prompt ─────────────────────────────────────────────────────────
  const neg = String(requested.negativePrompt || '').trim()
  if (neg) {
    if (!caps.negativePrompt) {
      notes.push(`${short} has no negative_prompt parameter. Say what you DO want in the prompt instead; what to avoid cannot be expressed to this model.`)
    } else {
      payload.negative_prompt = neg
      applied.negativePrompt = neg
    }
  }

  return { payload, applied, notes }
}

/** Generate the bytes. Returns {ok, bytes, type} or a structured failure. */
export async function generateImageBytes(
  env,
  {
    prompt,
    width = null,
    height = null,
    model = null,
    style = null,
    lighting = null,
    format = null,
    renderTraits = null,
    imageText = null,
    textTreatment = null,
    quality = null,
    steps = null,
    guidance = null,
    seed = null,
    negativePrompt = null,
  },
) {
  if (!env.AI) return fail(ERR.INTERNAL_ERROR, 'The AI binding is not configured on this worker.')

  // A model this server does not offer falls back to the default — but says so. A client that
  // connected before the list changed still holds the old enum, so this is a real path, and a
  // silent substitution is the same failure class as a silently dropped parameter: the caller
  // reads `model` in the reply and assumes it was their choice.
  const asked = model || null
  const chosen = asked && IMAGE_MODELS.includes(asked) ? asked : DEFAULT_IMAGE_MODEL
  const substitution =
    asked && asked !== chosen
      ? `${asked.split('/').pop()} is not offered here${RETIRED_MODELS[asked] ? ` — ${RETIRED_MODELS[asked]}` : ''}. Used ${chosen.split('/').pop()} instead.`
      : null
  const finalPrompt = composeImagePrompt({ prompt, style, lighting, renderTraits, imageText, textTreatment })

  // Size, steps, guidance, seed and negative_prompt are all resolved against THIS model's own
  // schema rather than sent blind — the five models disagree about which of them even exist.
  const { payload, applied, notes } = resolveModelParams(chosen, {
    format,
    width,
    height,
    quality,
    steps,
    guidance,
    seed,
    negativePrompt,
  })

  let response
  try {
    response = await env.AI.run(chosen, { prompt: finalPrompt, ...payload })
  } catch (e) {
    console.error('[images] generation failed on', chosen, '-', e.message)
    return fail(ERR.INTERNAL_ERROR, `Image generation failed (${chosen}): ${e.message}`)
  }
  if (!response) return fail(ERR.INTERNAL_ERROR, `${chosen} returned nothing.`)

  // Two envelopes. SDXL streams raw bytes; the Leonardo models answer { image: "<base64>" }.
  // agent-worker's /generate-image already handles both — the same branch, not a new invention.
  let bytes
  if (typeof response === 'object' && response !== null && typeof response.image === 'string') {
    const binary = atob(response.image)
    bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  } else {
    bytes = new Uint8Array(await new Response(response).arrayBuffer())
  }

  if (bytes.length === 0) return fail(ERR.INTERNAL_ERROR, `${chosen} returned an empty image.`)

  // Ask the bytes what they are. An error payload wearing an image's clothes would otherwise be
  // stored and put a permanently broken URL into someone's node — the reason this check exists.
  const type = sniffImageType(bytes)
  if (!type) {
    const preview = new TextDecoder().decode(bytes.slice(0, 120))
    return fail(ERR.INTERNAL_ERROR, `${chosen} returned non-image data: ${preview.slice(0, 100)}`)
  }

  return {
    ok: true,
    bytes,
    type,
    model: chosen,
    width: applied.width || null,
    height: applied.height || null,
    finalPrompt,
    applied,
    notes: substitution ? [substitution, ...notes] : notes,
  }
}

/**
 * Store the bytes through photos-worker, as the authenticated user.
 *
 * No album. photos-worker stamps `createdBy` on an album record the first time someone uploads
 * into one, and thereafter refuses everyone else with 403. The shared `agent-generated` album
 * holds ~280 images and currently has no `createdBy`, so the first MCP upload would claim it
 * for whoever called first and lock the rest out. The image is reachable by its URL from the
 * node either way; that is the deliverable.
 */
export async function uploadImage(env, { bytes, actor, type = { ext: 'jpg', mime: 'image/jpeg' } }) {
  if (!env.PHOTOS_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The PHOTOS_WORKER service binding is not configured on this worker.')
  }

  const token = await uploadTokenFor(env, actor)
  if (!token) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      'No upload credential on your account. Sign in at vegvisr.org once, then try again.',
    )
  }

  // photos-worker builds the stored name as `${filename}.${ext of the File's name}`, so the
  // stem must NOT carry .jpg itself — that is where the `.jpg.jpg` keys in the album came from.
  const stem = `mcp-${Date.now()}`
  const form = new FormData()
  form.append('file', new File([bytes], `${stem}.${type.ext}`, { type: type.mime }))
  form.append('filename', stem)

  const res = await env.PHOTOS_WORKER.fetch('https://vegvisr-photos-worker/upload', {
    method: 'POST',
    headers: { 'X-API-Token': token },
    body: form,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Status only. The request carried a credential, so nothing from this exchange is echoed
    // beyond the worker's own error string.
    console.error('[images] upload refused, status', res.status)
    return fail(ERR.INTERNAL_ERROR, data.error || `The photo service refused the upload (status ${res.status}).`)
  }

  const url = data.urls?.[0] || null
  if (!url) return fail(ERR.INTERNAL_ERROR, 'The upload succeeded but returned no URL.')
  return { ok: true, url }
}

function countOccurrences(haystack, needle) {
  let n = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    n += 1
    at = haystack.indexOf(needle, at + needle.length)
  }
  return n
}

/**
 * Generate an image and swap it into a node that already carries a placeholder.
 *
 * `placement` names WHICH placeholder to replace, not where to put anything: position, size and
 * how many paragraphs wrap beside it were all decided by the element the model wrote. Only the
 * FIRST matching placeholder is replaced, so a node with two pending images fills them one call
 * at a time and the caller can see which one moved.
 */
export async function generateImageForNode(
  env,
  {
    graphId,
    nodeId,
    prompt,
    placement = 'header',
    expectedVersion = null,
    actor,
    width = null,
    height = null,
    model = null,
    style = null,
    lighting = null,
    format = null,
    renderTraits = null,
    imageText = null,
    textTreatment = null,
    quality = null,
    steps = null,
    guidance = null,
    seed = null,
    negativePrompt = null,
  },
) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!graphId || !nodeId) return fail(ERR.INVALID_INPUT, 'graphId and nodeId are required.')
  if (!prompt || !String(prompt).trim()) return fail(ERR.INVALID_INPUT, 'prompt is required.')

  const placeholder = PLACEHOLDERS[String(placement).toLowerCase()]
  if (!placeholder) {
    return fail(ERR.INVALID_INPUT, `placement must be one of: ${Object.keys(PLACEHOLDERS).join(', ')}.`)
  }

  const access = await checkAccess(env, actor, graphId, 'write')
  if (!access.ok) return access

  // checkAccess already read the row; reuse it rather than querying the same graph twice.
  let graphData
  try {
    graphData = JSON.parse(access.graph.data)
  } catch {
    return fail(ERR.INTERNAL_ERROR, 'The stored graph is not valid JSON.')
  }

  const node = (graphData.nodes || []).find((n) => n.id === nodeId)
  if (!node) return fail(ERR.GRAPH_NOT_FOUND, `Node ${nodeId} not found in graph ${graphId}.`, { graphId, nodeId })

  const info = String(node.info || '')
  if (!info.includes(placeholder)) {
    return fail(
      ERR.INVALID_INPUT,
      `That node has no ${placement} placeholder to fill. Write the element first — the format ` +
        `from get_fulltext_elements already contains ${placeholder} — then call this.`,
      { expectedPlaceholder: placeholder },
    )
  }

  // updateNode compares against metadata.version, NOT the history table's MAX(version); the two
  // can differ. Read the default from the same row the placeholder came from.
  const version = Number.isInteger(expectedVersion)
    ? expectedVersion
    : Number(graphData.metadata?.version || 0)

  // Generate and store BEFORE touching the graph. A failed upload must not bump a version or
  // leave a node half-edited.
  const generated = await generateImageBytes(env, {
    prompt,
    width,
    height,
    model,
    style,
    lighting,
    format,
    renderTraits,
    imageText,
    textTreatment,
    quality,
    steps,
    guidance,
    seed,
    negativePrompt,
  })
  if (!generated.ok) return generated

  const stored = await uploadImage(env, { bytes: generated.bytes, type: generated.type, actor })
  if (!stored.ok) return stored

  const at = info.indexOf(placeholder)
  const newInfo = info.slice(0, at) + stored.url + info.slice(at + placeholder.length)

  const patched = await updateNode(env, {
    graphId,
    nodeId,
    fields: { info: newInfo },
    expectedVersion: version,
    actor,
  })
  if (!patched.ok) {
    // The image exists and is addressable; only the node edit failed. Hand back the URL so the
    // caller can retry the swap with update_node instead of paying to generate it again.
    return { ...patched, imageUrl: stored.url }
  }

  return {
    ok: true,
    graphId,
    nodeId,
    placement,
    imageUrl: stored.url,
    model: generated.model,
    // What was actually sent, the way the chat UI shows "FINAL PROMPT SENT TO LUCID" — so a
    // caller can see how a style choice changed the wording instead of guessing.
    finalPrompt: generated.finalPrompt,
    // What the model was actually given, and every request that had to be bent to fit it. A
    // caller reads `notes` aloud to the user rather than reporting a setting as applied when the
    // chosen model has no such parameter.
    appliedParams: generated.applied,
    ...(generated.notes?.length ? { notes: generated.notes } : {}),
    replaced: placeholder,
    remainingPlaceholders: countOccurrences(newInfo, placeholder),
    currentVersion: patched.currentVersion,
    newVersion: patched.newVersion,
    ...graphLinks(graphId),
  }
}
