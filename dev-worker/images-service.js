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

/** Workers AI. The same model Agent-Builder's generate_image uses. */
const IMAGE_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning'

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

/** Sizes must be multiples of 8 for the model; anything out of range is dropped, not guessed. */
function pixelSide(value) {
  const n = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(n) || n < 256 || n > 2048) return null
  return Math.round(n / 8) * 8
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

/** Generate the bytes. Returns {ok, bytes} or a structured failure. */
export async function generateImageBytes(env, { prompt, width = null, height = null }) {
  if (!env.AI) return fail(ERR.INTERNAL_ERROR, 'The AI binding is not configured on this worker.')

  const w = pixelSide(width)
  const h = pixelSide(height)

  let response
  try {
    response = await env.AI.run(IMAGE_MODEL, {
      prompt,
      ...(w ? { width: w } : {}),
      ...(h ? { height: h } : {}),
    })
  } catch (e) {
    console.error('[images] generation failed:', e.message)
    return fail(ERR.INTERNAL_ERROR, `Image generation failed: ${e.message}`)
  }
  if (!response) return fail(ERR.INTERNAL_ERROR, 'Workers AI returned nothing.')

  // env.AI.run returns a ReadableStream of JPEG bytes; buffer it through Response.
  const bytes = new Uint8Array(await new Response(response).arrayBuffer())
  if (bytes.length === 0) return fail(ERR.INTERNAL_ERROR, 'Workers AI returned an empty image.')

  // A JPEG starts FF D8. Anything else is an error payload wearing an image's clothes, and
  // storing it would put a permanently broken URL into someone's node.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    const preview = new TextDecoder().decode(bytes.slice(0, 120))
    return fail(ERR.INTERNAL_ERROR, `Workers AI returned non-image data: ${preview.slice(0, 100)}`)
  }

  return { ok: true, bytes, width: w, height: h }
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
export async function uploadImage(env, { bytes, actor }) {
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
  form.append('file', new File([bytes], `${stem}.jpg`, { type: 'image/jpeg' }))
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
  { graphId, nodeId, prompt, placement = 'header', expectedVersion = null, actor, width = null, height = null },
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
  const generated = await generateImageBytes(env, { prompt, width, height })
  if (!generated.ok) return generated

  const stored = await uploadImage(env, { bytes: generated.bytes, actor })
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
    replaced: placeholder,
    remainingPlaceholders: countOccurrences(newInfo, placeholder),
    currentVersion: patched.currentVersion,
    newVersion: patched.newVersion,
    ...graphLinks(graphId),
  }
}
