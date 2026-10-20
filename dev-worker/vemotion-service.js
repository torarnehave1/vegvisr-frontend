/**
 * vemotion-service.js — VEmotion compositions and render jobs from the MCP surface.
 *
 * COMPOSITIONS: ONE IMPLEMENTATION (decided 2026-10-19)
 * ----------------------------------------------------
 * list / get / save / reference / refit are forwarded to agent-worker's POST /vemotion/tool, which runs
 * Agent-Builder's own vemotion_* executors. That keeps checkVemotionComposition — the gate that
 * refuses compositions the renderer would draw as a blank canvas — and the meta merge on update in
 * one place. This module adds nothing to them; it only carries the caller's own credential.
 *
 * RENDERING: THE APP DOES IT (decided 2026-10-19, render job queue)
 * ----------------------------------------------------------------
 * A composition becomes an MP4 only in the VEmotion app (canvas + ffmpeg.wasm in a browser).
 * queueInstagramRender puts a job on vemotion-worker's /vemotion/render queue with a target —
 * the photos album of the Instagram account (ig-reels-<username>, same as create_media_upload).
 * Someone opens the job's renderUrl in a browser where they are signed in; the app renders,
 * uploads to that album and marks the job done with the public URL. getRenderJob reads it back.
 *
 * PREVIEW FRAMES (2026-10-19): queuePreviewFrames queues the same kind of job with kind "frames" and
 * `times`; the app renders still PNGs (long side ≤ 960 px) into the album "vemotion-previews". When
 * it is done, frameImages fetches them so the MCP tool can hand Claude the pictures themselves.
 */

import { ERR, statusForCode } from './graph-service.js'
import { listInstagramAccounts } from './social-service.js'
import { albumForInstagram } from './media-upload-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

export const COMPOSITION_TOOLS = [
  'vemotion_list_compositions',
  'vemotion_get_composition',
  'vemotion_save_composition',
  'get_vemotion_reference',
  'vemotion_refit_composition',
  // 2026-10-19: discover and check — the vocabulary, the libraries and the gate, as read-only tools
  'get_vemotion_catalog',
  'list_vemotion_library',
  'get_vemotion_library_item',
  'check_vemotion_composition',
  // 2026-10-19: the Add Layer tabs' media, run by Agent-Builder's executors like the tools above
  'album_list',
  'get_album_images',
  'search_unsplash',
  'search_pexels',
  'photos_upload_from_url',
  'generate_image',
  'vemotion_list_videos',
  'vemotion_import_video',
  'vemotion_list_audio',
  'get_vemotion_media_info',
  'vemotion_set_drawing_pace',
  'search_album_images',
  'tag_album_images',
]

async function callerToken(env, actor) {
  const email = String(actor?.email || '').trim().toLowerCase()
  if (!email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken AS t FROM config WHERE lower(email) = ? LIMIT 1')
    .bind(email)
    .first()
  return row?.t || null
}

async function tokenOrFail(env, actor) {
  if (!actor || actor.anonymous) return { error: fail(ERR.UNAUTHENTICATED, 'Authentication required.') }
  let token
  try {
    token = await callerToken(env, actor)
  } catch (e) {
    return { error: fail(ERR.STORE_UNAVAILABLE, `Could not read your account: ${e.message}`) }
  }
  if (!token) return { error: fail(ERR.FORBIDDEN_GRAPH, 'No platform credential on your account. Sign in at vegvisr.org once, then try again.') }
  return { token }
}

/** Run one of Agent-Builder's vemotion_* tools as the caller. Returns { ok, result } or a fail(). */
export async function runCompositionTool(env, { actor, tool, input = {} }) {
  if (!COMPOSITION_TOOLS.includes(tool)) return fail(ERR.INVALID_INPUT, `Unknown VEmotion tool ${tool}.`)
  if (!env.AGENT_WORKER?.fetch) return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  let res
  let data
  try {
    res = await env.AGENT_WORKER.fetch('https://agent-worker/vemotion/tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': t.token },
      body: JSON.stringify({ tool, input }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach the VEmotion tools: ${e.message}`)
  }
  if (res.status === 401) return fail(ERR.FORBIDDEN_GRAPH, data?.error || 'Not signed in to VEmotion.')
  if (!res.ok || data?.success === false) return fail(ERR.INVALID_INPUT, data?.error || `VEmotion refused the request (status ${res.status}).`)
  return { ok: true, result: data.result ?? {} }
}

async function callVemotion(env, token, path, init = {}) {
  if (!env.VEMOTION_WORKER?.fetch) return fail(ERR.INTERNAL_ERROR, 'The VEMOTION_WORKER service binding is not configured on this worker.')
  let res
  let data
  try {
    res = await env.VEMOTION_WORKER.fetch(`https://vemotion-worker${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token, ...(init.headers || {}) },
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach vemotion-worker: ${e.message}`)
  }
  if (res.status === 404) return fail(ERR.GRAPH_NOT_FOUND, data?.error || 'Not found.')
  if (res.status === 401 || res.status === 403) return fail(ERR.FORBIDDEN_GRAPH, data?.error || 'Not yours.')
  if (!res.ok) return fail(ERR.INVALID_INPUT, data?.error || `vemotion-worker answered ${res.status}.`)
  return { ok: true, data }
}

/** Queue a render of a saved composition, bound for an Instagram account's album. */
export async function queueInstagramRender(env, { actor, compositionId, accountId }) {
  const id = String(compositionId || '').trim()
  const acct = String(accountId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'compositionId is required — vemotion_list_compositions gives it.')
  if (!acct) return fail(ERR.INVALID_INPUT, 'accountId is required — call list_instagram_accounts.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error

  const list = await listInstagramAccounts(env, { actor })
  if (!list.ok) return list
  const account = list.accounts.find((a) => a.accountId === acct)
  if (!account) return fail(ERR.FORBIDDEN_GRAPH, `Instagram account ${acct} is not one you may post to. Call list_instagram_accounts.`)
  const album = albumForInstagram(account.username) || `ig-reels-${acct}`

  const r = await callVemotion(env, t.token, '/vemotion/render', {
    method: 'POST',
    body: JSON.stringify({
      compositionId: id,
      target: { platform: 'instagram', accountId: acct, username: account.username, album },
    }),
  })
  if (!r.ok) return r
  return {
    ok: true,
    jobId: r.data.jobId,
    status: r.data.status || 'queued',
    renderUrl: r.data.renderUrl || `https://vemotion.vegvisr.org/?renderJob=${r.data.jobId}`,
    album,
    username: account.username,
  }
}

/** Queue still frames of a saved composition at `times` (seconds) — a preview Claude can look at. */
export async function queuePreviewFrames(env, { actor, compositionId, times }) {
  const id = String(compositionId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'compositionId is required — vemotion_save_composition or vemotion_list_compositions gives it.')
  const list = (Array.isArray(times) ? times : []).map(Number).filter((t) => Number.isFinite(t) && t >= 0)
  if (list.length === 0 || list.length > 12) return fail(ERR.INVALID_INPUT, 'times: 1–12 moments in seconds, e.g. [0.5, 2, 4].')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callVemotion(env, t.token, '/vemotion/render', {
    method: 'POST',
    body: JSON.stringify({ compositionId: id, kind: 'frames', times: list, target: { platform: 'preview', album: 'vemotion-previews' } }),
  })
  if (!r.ok) return r
  return {
    ok: true,
    jobId: r.data.jobId,
    status: r.data.status || 'queued',
    renderUrl: r.data.renderUrl || `https://vemotion.vegvisr.org/?renderJob=${r.data.jobId}`,
    times: list,
    album: 'vemotion-previews',
  }
}

// What one tool result may carry as pictures. A preview frame is ≤ 960 px on its long side, usually
// well under 1 MB; the caps keep a busy photo composition from producing an oversized response.
const FRAME_MAX_BYTES = 2_000_000
const FRAMES_MAX_TOTAL = 8_000_000

function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Fetch finished preview frames as MCP image content: [{ type:'image', data, mimeType }] (+ skipped). */
export async function frameImages(urls, fetchImpl = fetch) {
  const images = []
  const skipped = []
  let total = 0
  for (const url of urls || []) {
    try {
      const res = await fetchImpl(url)
      if (!res.ok) { skipped.push(`${url} (HTTP ${res.status})`); continue }
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.length > FRAME_MAX_BYTES || total + bytes.length > FRAMES_MAX_TOTAL) { skipped.push(`${url} (too large to inline — open the URL)`); continue }
      total += bytes.length
      images.push({ type: 'image', data: toBase64(bytes), mimeType: (res.headers.get('content-type') || 'image/png').split(';')[0] })
    } catch (e) {
      skipped.push(`${url} (${e.message})`)
    }
  }
  return { images, skipped }
}

/** Queue a pixel-grid job: the app turns one image into a knitting-chart grid (Pixel Grid tab). */
export async function queuePixelGrid(env, { actor, imageUrl, cols, colors }) {
  const url = String(imageUrl || '').trim()
  if (!/^https:\/\//.test(url)) return fail(ERR.INVALID_INPUT, 'imageUrl must be an https image URL.')
  const c = Math.round(Number(cols) || 40)
  const k = Math.round(Number(colors) || 8)
  if (c < 4 || c > 200) return fail(ERR.INVALID_INPUT, 'cols must be 4–200.')
  if (k < 2 || k > 32) return fail(ERR.INVALID_INPUT, 'colors must be 2–32.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callVemotion(env, t.token, '/vemotion/render', {
    method: 'POST',
    body: JSON.stringify({ kind: 'pixel-grid', imageUrl: url, cols: c, colors: k }),
  })
  if (!r.ok) return r
  return {
    ok: true,
    jobId: r.data.jobId,
    status: r.data.status || 'queued',
    renderUrl: r.data.renderUrl || `https://vemotion.vegvisr.org/?renderJob=${r.data.jobId}`,
    cols: c,
    colors: k,
  }
}

/** Where a render job stands; outputUrl is set once the app has uploaded the MP4. */
export async function getRenderJob(env, { actor, jobId }) {
  const id = String(jobId || '').trim()
  if (!/^render_[a-z0-9_]+$/i.test(id)) return fail(ERR.INVALID_INPUT, 'jobId is the id render_vemotion_for_instagram, preview_vemotion_frames or pixelate_image_for_vemotion returned.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callVemotion(env, t.token, `/vemotion/render?id=${encodeURIComponent(id)}&brief=1`)
  if (!r.ok) return r
  const d = r.data
  return {
    ok: true,
    jobId: d.jobId || id,
    status: d.status || 'unknown',
    progress: typeof d.progress === 'number' ? d.progress : 0,
    outputUrl: d.outputUrl || null,
    error: d.error || null,
    compositionId: d.compositionId || null,
    album: d.target?.album || null,
    accountId: d.target?.accountId || null,
    kind: d.kind || 'video',
    times: Array.isArray(d.times) ? d.times : null,
    outputUrls: Array.isArray(d.outputUrls) ? d.outputUrls : null,
    result: d.result && typeof d.result === 'object' ? d.result : null,
  }
}
