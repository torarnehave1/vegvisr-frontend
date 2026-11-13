/**
 * realtime-service.js — Vegvisr Realtime (rooms, meetings, recordings) from the MCP surface.
 *
 * ONE IMPLEMENTATION (decided 2026-11-10, plan graph 5b429a57-0fc3-41b9-b6c4-0adbdecdee0a)
 * ---------------------------------------------------------------------------------------
 * Every function here forwards to an existing realtime-worker endpoint (/realtime/*) over the
 * REALTIME_WORKER service binding, carrying the caller's own credential in X-API-Token. Ownership
 * and role checks stay in realtime-worker; this module adds none and re-implements nothing.
 *
 * The response shapes read here are the ones realtime-worker publishes in /realtime/openapi.json.
 * A field renamed in a handler has to be renamed in that spec and here.
 *
 * Being IN a meeting (camera, microphone) needs a browser. These functions return links.
 */

import { ERR, statusForCode } from './graph-service.js'

/** Where the Realtime app lives. Room links are built the way the app builds them (App.tsx). */
export const REALTIME_APP_ORIGIN = 'https://realtime.vegvisr.org'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

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
  if (!actor || actor.anonymous || !actor.email) return { error: fail(ERR.UNAUTHENTICATED, 'Authentication required.') }
  let token
  try {
    token = await callerToken(env, actor)
  } catch (e) {
    return { error: fail(ERR.STORE_UNAVAILABLE, `Could not read your account: ${e.message}`) }
  }
  if (!token) return { error: fail(ERR.FORBIDDEN_GRAPH, 'No platform credential on your account. Sign in at vegvisr.org once, then try again.') }
  return { token }
}

/** One request to realtime-worker as the caller. Returns { ok: true, data } or a fail(). */
async function callRealtime(env, token, path, init = {}) {
  if (!env.REALTIME_WORKER?.fetch) return fail(ERR.INTERNAL_ERROR, 'The REALTIME_WORKER service binding is not configured on this worker.')
  let res
  let data
  try {
    res = await env.REALTIME_WORKER.fetch(`https://api.vegvisr.org${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token, ...(init.headers || {}) },
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach realtime-worker: ${e.message}`)
  }
  if (res.status === 401 || res.status === 403) return fail(ERR.FORBIDDEN_GRAPH, data?.error || 'Realtime refused your credential.')
  if (res.status === 404) return fail(ERR.GRAPH_NOT_FOUND, data?.error || 'Not found.')
  if (res.status >= 500) return fail(ERR.INTERNAL_ERROR, data?.error || `realtime-worker answered ${res.status}.`)
  if (!res.ok || data?.success === false) return fail(ERR.INVALID_INPUT, data?.error || `realtime-worker answered ${res.status}.`)
  return { ok: true, data }
}

/** The link a signed-in or invited person opens to join a room. */
export function joinUrlFor(meetingId) {
  return `${REALTIME_APP_ORIGIN}/?meetingId=${encodeURIComponent(meetingId)}`
}

/**
 * The guest link of an OPEN room (no login). The platform default open room is the bare ?openroom;
 * any other open room is addressed by its first slug, or by its meeting id when it has none.
 */
export function openRoomUrlFor(meetingId, { isDefault = false, slug = null } = {}) {
  if (isDefault) return `${REALTIME_APP_ORIGIN}/?openroom`
  return `${REALTIME_APP_ORIGIN}/?openroom=${encodeURIComponent(slug || meetingId)}`
}

/**
 * The caller's rooms: the personal and team room (GET /realtime/my-rooms) joined with which of
 * their meetings are open to guests and which slugs point at them (GET /realtime/open-room/status).
 *
 * A meeting that is open or has a slug but is neither the personal nor the team room is listed
 * with kind "other" — it exists on the account and has a working link, so leaving it out would
 * hide a door that is open.
 */
export async function listRooms(env, { actor }) {
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error

  const [mine, open] = await Promise.all([
    callRealtime(env, t.token, '/realtime/my-rooms'),
    callRealtime(env, t.token, '/realtime/open-room/status'),
  ])
  if (!mine.ok) return mine
  if (!open.ok) return open

  const openById = new Map()
  for (const r of Array.isArray(open.data.rooms) ? open.data.rooms : []) {
    if (r?.meetingId) openById.set(String(r.meetingId), { isDefault: r.isDefault === true })
  }
  const slugsById = open.data.slugs && typeof open.data.slugs === 'object' ? open.data.slugs : {}
  const slugsFor = (id) => (Array.isArray(slugsById[id]) ? slugsById[id].map(String) : [])

  const room = (kind, meetingId, title) => {
    const id = String(meetingId)
    const slugs = slugsFor(id)
    const o = openById.get(id)
    return {
      kind,
      meetingId: id,
      title: title ? String(title) : null,
      joinUrl: joinUrlFor(id),
      slugs,
      slugUrls: slugs.map((s) => `${REALTIME_APP_ORIGIN}/${encodeURIComponent(s)}`),
      openRoom: !!o,
      isDefaultOpenRoom: !!o?.isDefault,
      openRoomUrl: o ? openRoomUrlFor(id, { isDefault: o.isDefault, slug: slugs[0] || null }) : null,
    }
  }

  const rooms = []
  const seen = new Set()
  const add = (kind, id, title) => {
    if (!id || seen.has(String(id))) return
    seen.add(String(id))
    rooms.push(room(kind, id, title))
  }
  add('personal', mine.data.personalMeetingId, mine.data.personalTitle)
  add('team', mine.data.teamMeetingId, mine.data.teamTitle)
  for (const id of new Set([...openById.keys(), ...Object.keys(slugsById)])) add('other', id, null)

  return {
    ok: true,
    displayName: mine.data.displayName ? String(mine.data.displayName) : null,
    waitingRoomEnabled: mine.data.waitingRoomEnabled === true,
    canSetDefaultOpenRoom: open.data.canSetDefault === true,
    rooms,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recordings (slice 1, 2026-11-13) — read only
// ─────────────────────────────────────────────────────────────────────────────

const RECORDING_SOURCES = ['r2', 'r2-own', 'stream', 'realtimekit']

/**
 * One item of GET /realtime/recordings, reduced to what a model needs.
 *
 * Left out on purpose: download_url (an expiring bearer link into RealtimeKit's own bucket),
 * etag, customMetadata and thumbnailUrl. playUrl is passed on only when it never expires; a
 * presigned one would be stale by the time anyone clicked it — getRecordingLink makes a fresh one.
 */
function shapeRecording(x) {
  const source = RECORDING_SOURCES.includes(x?.source) ? x.source : 'r2'
  const stored = source !== 'realtimekit'
  const size = Number(x?.size) || 0
  const duration = Number(x?.duration)
  const labels = Array.isArray(x?.labels) ? x.labels.map(String) : []
  return {
    key: String(x?.key || ''),
    name: String(x?.name || ''),
    title: x?.title ? String(x.title) : null,
    labels,
    source,
    stored,
    sizeMB: Math.round((size / 1048576) * 10) / 10,
    recordedAt: x?.uploaded ? String(x.uploaded) : null,
    durationMinutes: Number.isFinite(duration) && duration > 0 ? Math.round((duration / 60) * 10) / 10 : null,
    meetingId: x?.meetingId ? String(x.meetingId) : null,
    meetingTitle: x?.meetingTitle ? String(x.meetingTitle) : null,
    status: x?.status ? String(x.status) : null,
    hasTranscript: typeof x?.hasTranscript === 'boolean' ? x.hasTranscript : null,
    playUrl: stored && x?.playUrlPermanent === true && x?.playUrl ? String(x.playUrl) : null,
    error: x?.error ? String(x.error) : null,
    ownerEmail: x?.ownerEmail ? String(x.ownerEmail) : null,
  }
}

async function fetchRecordings(env, token) {
  const r = await callRealtime(env, token, '/realtime/recordings')
  if (!r.ok) return r
  return { ok: true, raw: Array.isArray(r.data.recordings) ? r.data.recordings : [] }
}

/**
 * The caller's meeting recordings, newest first. `query` matches name, title, meeting title and
 * labels; `source` narrows to one kind. Filtering here is presentation only — WHICH recordings the
 * caller may see was already decided by realtime-worker.
 */
export async function listRecordings(env, { actor, query, source, limit = 20 }) {
  const src = source == null || source === '' ? null : String(source)
  if (src && !RECORDING_SOURCES.includes(src)) {
    return fail(ERR.INVALID_INPUT, `source must be one of ${RECORDING_SOURCES.join(', ')}.`)
  }
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const list = await fetchRecordings(env, t.token)
  if (!list.ok) return list

  const all = list.raw.map(shapeRecording).filter((x) => x.key)
  all.sort((a, b) => String(b.recordedAt || '').localeCompare(String(a.recordedAt || '')))
  const q = String(query || '').trim().toLowerCase()
  const matched = all.filter((x) =>
    (!src || x.source === src) &&
    (!q || [x.name, x.title, x.meetingTitle, ...x.labels].some((s) => String(s || '').toLowerCase().includes(q))))
  const n = Math.min(Math.max(Number(limit) || 20, 1), 100)
  return {
    ok: true,
    total: all.length,
    matched: matched.length,
    notStored: all.filter((x) => !x.stored).length,
    recordings: matched.slice(0, n),
  }
}

/**
 * A link that plays one recording. The key must be one from the caller's own list — play-url
 * itself checks nothing and would build a link for any string, so the list is the gate.
 *
 * A permanent playUrl from the list is returned as it is. Otherwise a "recordings/…" key gets a
 * fresh presign from /realtime/recordings/play-url. Any other key (a Stream copy in an own bucket
 * without a public address) keeps the list's own link, which lasts about an hour — play-url would
 * prefix such a key with "recordings/" and return a link to nothing.
 */
export async function getRecordingLink(env, { actor, key, expiresMinutes = 60 }) {
  const k = String(key || '').trim()
  if (!k) return fail(ERR.INVALID_INPUT, 'key is required — realtime_list_recordings gives it.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const list = await fetchRecordings(env, t.token)
  if (!list.ok) return list
  const raw = list.raw.find((x) => String(x?.key || '') === k)
  if (!raw) return fail(ERR.GRAPH_NOT_FOUND, `No recording with key ${k} among your recordings. Call realtime_list_recordings.`)
  const rec = shapeRecording(raw)
  if (!rec.stored) {
    return fail(ERR.INVALID_INPUT, 'This recording is still in RealtimeKit cloud and has not been copied to storage, so it has no playback link yet. Sync it in the Realtime app (Recordings → Sync).', { recordingStatus: rec.status, recordingError: rec.error })
  }
  const base = { ok: true, key: rec.key, name: rec.name, title: rec.title, source: rec.source }
  if (rec.playUrl) return { ...base, url: rec.playUrl, expiresAt: null, permanent: true }

  if (k.startsWith('recordings/')) {
    const minutes = Math.min(Math.max(Number(expiresMinutes) || 60, 1), 1440)
    const r = await callRealtime(env, t.token, `/realtime/recordings/play-url?key=${encodeURIComponent(k)}&expires=${Math.round(minutes * 60)}`)
    if (!r.ok) return r
    if (!r.data.url) return fail(ERR.INTERNAL_ERROR, 'realtime-worker returned no URL.')
    return { ...base, url: String(r.data.url), expiresAt: r.data.expiresAt ? String(r.data.expiresAt) : null, permanent: !r.data.expiresAt }
  }
  if (raw.playUrl) {
    return { ...base, url: String(raw.playUrl), expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(), permanent: false }
  }
  return fail(ERR.INTERNAL_ERROR, 'This recording has no playback link.')
}

/** The transcript saved beside a stored recording. found=false is an answer, not an error. */
export async function getTranscript(env, { actor, key, maxChars = 50000 }) {
  const k = String(key || '').trim()
  if (!k) return fail(ERR.INVALID_INPUT, 'key is required — realtime_list_recordings gives it.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callRealtime(env, t.token, `/realtime/recordings/transcript?key=${encodeURIComponent(k)}`)
  if (!r.ok) return r
  if (r.data.found !== true) return { ok: true, key: k, found: false }
  const text = typeof r.data.text === 'string' ? r.data.text : ''
  const cap = Math.min(Math.max(Number(maxChars) || 50000, 1000), 200000)
  return {
    ok: true,
    key: k,
    found: true,
    chars: text.length,
    truncated: text.length > cap,
    text: text.length > cap ? text.slice(0, cap) : text,
    model: r.data.model ? String(r.data.model) : null,
    savedAt: r.data.savedAt ? String(r.data.savedAt) : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slugs (slice 1) — read only
// ─────────────────────────────────────────────────────────────────────────────

/** The caller's active custom room slugs. realtime-worker allows this to Admin and Superadmin. */
export async function listSlugs(env, { actor }) {
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callRealtime(env, t.token, '/realtime/slugs')
  if (!r.ok) return r
  const slugs = (Array.isArray(r.data.slugs) ? r.data.slugs : []).filter((s) => s?.slug).map((s) => ({
    id: String(s.id || ''),
    slug: String(s.slug),
    url: `${REALTIME_APP_ORIGIN}/${encodeURIComponent(String(s.slug))}`,
    meetingId: String(s.meetingId || ''),
    allowedEmails: Array.isArray(s.allowedEmails) ? s.allowedEmails.map(String) : [],
    scheduledStartAt: s.scheduledStartAt ? String(s.scheduledStartAt) : null,
    createdAt: s.createdAt ? String(s.createdAt) : null,
  }))
  return { ok: true, slugs }
}
