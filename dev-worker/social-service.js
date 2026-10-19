/**
 * social-service.js — Instagram posting from the MCP surface, through blotato-worker.
 *
 * WHO MAY POST IS DECIDED BY blotato-worker, NOT HERE
 * ---------------------------------------------------
 * blotato-worker already owns the access model (decided 2026-10-19 to keep it the single source):
 *   - a caller with their own `config.blotato_api_key` → their own Blotato workspace
 *   - a Superadmin                                   → the platform workspace
 *   - anyone with rows in `blotato_account_grants`   → only those account ids
 * and an account granted to someone is hidden from everyone else. This module never re-implements
 * that. It calls blotato-worker AS THE CALLER — with the caller's own `emailVerificationToken`,
 * looked up from config by the e-mail on the verified OAuth token — so whatever the worker would
 * refuse a person in the browser, it refuses them here too. Granting a new person is one row in
 * blotato_account_grants; no code changes.
 *
 * The token is read server-side and never returned or logged.
 *
 * PUBLISHING IS ASYNCHRONOUS
 * --------------------------
 * Blotato answers a post with a `postSubmissionId`; the post is not on Instagram yet. Only
 * getInstagramPostStatus → `published` (with a publicUrl) proves it is live.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

const BLOTATO_BASE = 'https://api.vegvisr.org/blotato'

export const MEDIA_TYPES = ['post', 'reel', 'story']
const CAPTION_MAX = 2200
const HASHTAG_MAX = 30
const ALT_MAX = 1000
const CAROUSEL_MAX = 10

/** The caller's own blotato-worker credential. Null when the person has none. */
async function callerToken(env, actor) {
  const email = String(actor?.email || '').trim().toLowerCase()
  if (!email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken AS t FROM config WHERE lower(email) = ?')
    .bind(email)
    .first()
  return row?.t || null
}

/** One call to blotato-worker as the caller. Returns { ok, status, body } or a fail(). */
async function callBlotato(env, actor, path, init = {}) {
  if (!actor || actor.anonymous) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!env.BLOTATO_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The BLOTATO_WORKER service binding is not configured on this worker.')
  }
  let token
  try {
    token = await callerToken(env, actor)
  } catch (e) {
    return fail(ERR.STORE_UNAVAILABLE, `Could not read your account: ${e.message}`)
  }
  if (!token) {
    return fail(ERR.FORBIDDEN_GRAPH, 'Your account has no platform credential, so it cannot use Instagram posting.')
  }
  let res
  try {
    res = await env.BLOTATO_WORKER.fetch(`${BLOTATO_BASE}${path}`, {
      ...init,
      headers: { 'X-API-Token': token, ...(init.headers || {}) },
    })
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `blotato-worker did not answer: ${e.message}`)
  }
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (res.status === 401 || res.status === 403) {
    return fail(ERR.FORBIDDEN_GRAPH, body?.error || 'Instagram posting is not available to your account.')
  }
  if (!res.ok || !body?.success) {
    const upstream = body?.data?.message || body?.data?.error || body?.error || `HTTP ${res.status}`
    return fail(ERR.INTERNAL_ERROR, `Blotato refused the request: ${typeof upstream === 'string' ? upstream : JSON.stringify(upstream)}`)
  }
  return { ok: true, status: res.status, body }
}

/** The Instagram accounts this caller may post to. */
export async function listInstagramAccounts(env, { actor }) {
  const r = await callBlotato(env, actor, '/accounts')
  if (!r.ok) return r
  const items = Array.isArray(r.body?.data?.items) ? r.body.data.items : []
  const accounts = items
    .filter((a) => String(a.platform).toLowerCase() === 'instagram')
    .map((a) => ({ accountId: String(a.id), username: a.username || null, name: a.fullname || null }))
  return { ok: true, accounts }
}

/** HEAD each media URL: Instagram fetches them itself, so a URL that is not public fails late. */
async function checkMedia(url) {
  let res
  try {
    res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' })
    }
  } catch (e) {
    return { url, ok: false, kind: null, problem: `not reachable: ${e.message}` }
  }
  if (!res.ok) return { url, ok: false, kind: null, problem: `answered HTTP ${res.status}` }
  const type = String(res.headers.get('content-type') || '').toLowerCase()
  const kind = type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : null
  if (!kind) return { url, ok: false, kind: null, problem: `is not an image or video (content-type "${type || 'none'}")` }
  return { url, ok: true, kind, contentType: type }
}

/**
 * Validate and build the exact Blotato body. Shared by preview and post so they cannot drift.
 * Returns { ok, account, body, media, warnings } or a fail().
 */
async function composeInstagramPost(env, args) {
  const { actor } = args
  const accountId = String(args.accountId || '').trim()
  const text = String(args.text ?? '')
  const mediaType = args.mediaType || 'post'
  const mediaUrls = Array.isArray(args.mediaUrls) ? args.mediaUrls.map((u) => String(u).trim()).filter(Boolean) : []
  const warnings = []

  if (!accountId) return fail(ERR.INVALID_INPUT, 'accountId is required — call list_instagram_accounts.')
  if (!MEDIA_TYPES.includes(mediaType)) return fail(ERR.INVALID_INPUT, `mediaType must be one of ${MEDIA_TYPES.join(', ')}.`)
  if (mediaUrls.length === 0) return fail(ERR.INVALID_INPUT, 'Instagram needs at least one image or video in mediaUrls.')
  for (const u of mediaUrls) {
    if (!/^https:\/\//i.test(u)) return fail(ERR.INVALID_INPUT, `Media URLs must be public https URLs: ${u}`)
  }
  if (mediaType === 'story' && mediaUrls.length !== 1) return fail(ERR.INVALID_INPUT, 'A story takes exactly one image or video.')
  if (mediaType === 'reel' && mediaUrls.length !== 1) return fail(ERR.INVALID_INPUT, 'A reel takes exactly one video.')
  if (mediaUrls.length > CAROUSEL_MAX) return fail(ERR.INVALID_INPUT, `A carousel takes at most ${CAROUSEL_MAX} items.`)
  if (mediaType !== 'story' && !text.trim()) return fail(ERR.INVALID_INPUT, 'text (the caption) is required for a post or reel.')
  if (text.length > CAPTION_MAX) return fail(ERR.INVALID_INPUT, `The caption is ${text.length} characters; Instagram allows ${CAPTION_MAX}.`)
  const hashtags = (text.match(/#[\p{L}\p{N}_]+/gu) || []).length
  if (hashtags > HASHTAG_MAX) return fail(ERR.INVALID_INPUT, `The caption has ${hashtags} hashtags; Instagram allows ${HASHTAG_MAX}.`)
  if (mediaType === 'story' && text.trim()) warnings.push('A story has no caption; the text will not be shown.')
  if (args.altText && String(args.altText).length > ALT_MAX) return fail(ERR.INVALID_INPUT, `altText may be at most ${ALT_MAX} characters.`)
  if (args.firstComment) {
    if (mediaType === 'story') return fail(ERR.INVALID_INPUT, 'A story cannot have a first comment.')
    if (String(args.firstComment).length > CAPTION_MAX) return fail(ERR.INVALID_INPUT, `firstComment may be at most ${CAPTION_MAX} characters.`)
  }

  let scheduledTime = null
  if (args.scheduledTime) {
    const s = String(args.scheduledTime).trim()
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return fail(ERR.INVALID_INPUT, 'scheduledTime must be ISO 8601 with a timezone, e.g. 2026-10-20T09:00:00+02:00.')
    const t = Date.parse(s)
    if (Number.isNaN(t)) return fail(ERR.INVALID_INPUT, `scheduledTime is not a valid date: ${s}`)
    if (t <= Date.now()) return fail(ERR.INVALID_INPUT, 'scheduledTime is in the past. Omit it to publish now.')
    scheduledTime = new Date(t).toISOString()
  }

  // The account must be one blotato-worker shows THIS caller — that is the access check.
  const list = await listInstagramAccounts(env, { actor })
  if (!list.ok) return list
  const account = list.accounts.find((a) => a.accountId === accountId)
  if (!account) {
    return fail(ERR.FORBIDDEN_GRAPH, `Instagram account ${accountId} is not one you may post to. Call list_instagram_accounts.`)
  }

  const media = await Promise.all(mediaUrls.map(checkMedia))
  const bad = media.filter((m) => !m.ok)
  if (bad.length) {
    return fail(ERR.INVALID_INPUT, `Instagram could not fetch this media: ${bad.map((m) => `${m.url} ${m.problem}`).join('; ')}`, { media })
  }
  if (mediaType === 'reel' && media[0].kind !== 'video') return fail(ERR.INVALID_INPUT, 'A reel must be a video.')

  const target = { targetType: 'instagram' }
  if (mediaType === 'reel' || mediaType === 'story') target.mediaType = mediaType
  if (args.altText) target.altText = String(args.altText)
  if (args.firstComment) target.firstComment = String(args.firstComment)

  const body = {
    post: {
      accountId,
      content: { text: mediaType === 'story' ? '' : text, mediaUrls, platform: 'instagram' },
      target,
    },
    ...(scheduledTime ? { scheduledTime } : {}),
  }
  const shape = mediaType === 'post' ? (mediaUrls.length > 1 ? 'carousel' : media[0].kind === 'video' ? 'video (reel)' : 'image post') : mediaType
  return { ok: true, account, body, media, shape, hashtags, scheduledTime, warnings }
}

function summary(c) {
  return {
    accountId: c.account.accountId,
    username: c.account.username,
    shape: c.shape,
    text: c.body.post.content.text,
    chars: c.body.post.content.text.length,
    hashtags: c.hashtags,
    mediaUrls: c.body.post.content.mediaUrls,
    media: c.media.map((m) => ({ url: m.url, kind: m.kind, contentType: m.contentType })),
    altText: c.body.post.target.altText || null,
    firstComment: c.body.post.target.firstComment || null,
    scheduledTime: c.scheduledTime,
    warnings: c.warnings,
  }
}

/** Compose exactly what postToInstagram would send, and send nothing. */
export async function previewInstagramPost(env, args) {
  const c = await composeInstagramPost(env, args)
  if (!c.ok) return c
  return { ok: true, posted: false, ...summary(c) }
}

/** Publish (or schedule) the post. Not idempotent: twice is two posts. */
export async function postToInstagram(env, args) {
  const c = await composeInstagramPost(env, args)
  if (!c.ok) return c
  const r = await callBlotato(env, args.actor, '/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.body),
  })
  if (!r.ok) return r
  const data = r.body?.data || {}
  return {
    ok: true,
    posted: true,
    postSubmissionId: data.postSubmissionId || null,
    scheduledTime: data.scheduledTime || c.scheduledTime || null,
    ...summary(c),
  }
}

/** Where a submitted post stands: in-progress, scheduled, published or failed. */
export async function getInstagramPostStatus(env, { actor, postSubmissionId }) {
  const id = String(postSubmissionId || '').trim()
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return fail(ERR.INVALID_INPUT, 'postSubmissionId is the id post_to_instagram returned.')
  const r = await callBlotato(env, actor, `/post/${id}`)
  if (!r.ok) return r
  const d = r.body?.data || {}
  return {
    ok: true,
    postSubmissionId: d.postSubmissionId || id,
    status: d.status || 'unknown',
    publicUrl: d.publicUrl || null,
    scheduledTime: d.scheduledTime || null,
    errorMessage: d.errorMessage || null,
  }
}
