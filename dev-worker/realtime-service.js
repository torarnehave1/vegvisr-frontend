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
  return { ok: true, raw: tidyRecordings(Array.isArray(r.data.recordings) ? r.data.recordings : []) }
}

const TRANSCRIPT_SUFFIX = '.transcript.json'

/**
 * Two things the raw list says that are not recordings (seen in the live data, 2026-11-13):
 *
 *  - A transcript is saved BESIDE its recording as "<key>.transcript.json". The shared-bucket
 *    branch of /realtime/recordings lists those files as if they were recordings (9 of 109 that
 *    day). Here they are taken out, and their presence becomes hasTranscript on the recording.
 *  - A recording that was copied to storage is still listed a second time from RealtimeKit cloud,
 *    with the same file name (14 of 25 cloud rows). Left in, the list says "not synced" about
 *    files that are stored. The cloud row is dropped and its duration and meeting are carried
 *    over to the stored one.
 *
 * Which recordings the caller may see is untouched — this only merges rows about the same file.
 */
function tidyRecordings(raw) {
  const rows = raw.filter((x) => x && typeof x === 'object')
  const sidecarOf = new Set()
  for (const x of rows) {
    const k = String(x.key || '')
    if (k.endsWith(TRANSCRIPT_SUFFIX)) sidecarOf.add(k.slice(0, -TRANSCRIPT_SUFFIX.length))
  }
  const cloudByName = new Map()
  for (const x of rows) if (x.source === 'realtimekit' && x.name) cloudByName.set(String(x.name), x)
  const storedNames = new Set()
  const out = []
  for (const x of rows) {
    const k = String(x.key || '')
    if (k.endsWith(TRANSCRIPT_SUFFIX) || x.source === 'realtimekit') continue
    storedNames.add(String(x.name || ''))
    const cloud = cloudByName.get(String(x.name || ''))
    out.push({
      ...x,
      ...(cloud ? { duration: cloud.duration, meetingId: cloud.meetingId, meetingTitle: cloud.meetingTitle } : {}),
      ...(typeof x.hasTranscript === 'boolean' ? {} : sidecarOf.has(k) ? { hasTranscript: true } : {}),
    })
  }
  for (const x of rows) if (x.source === 'realtimekit' && !storedNames.has(String(x.name || ''))) out.push(x)
  return out
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

// ─────────────────────────────────────────────────────────────────────────────
// Meetings (2026-11-15) — read only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The caller's ad-hoc meetings — the ones made with "New meeting", not the personal or team room
 * (listRooms has those). Whose meetings are listed is realtime-worker's decision
 * (GET /realtime/list-meetings): since 2026-11-15 a caller on the shared RealtimeKit app gets only
 * their own, a Superadmin the whole app. `allUsers` passes that fact on, so a Superadmin's list
 * is not mistaken for their own meetings.
 */
export async function listMeetings(env, { actor, status, limit = 50 }) {
  const want = status == null || status === '' ? null : String(status).toUpperCase()
  if (want && !['ACTIVE', 'INACTIVE'].includes(want)) return fail(ERR.INVALID_INPUT, 'status must be ACTIVE or INACTIVE.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callRealtime(env, t.token, '/realtime/list-meetings')
  if (!r.ok) return r
  const all = (Array.isArray(r.data.meetings) ? r.data.meetings : []).filter((m) => m?.id).map((m) => ({
    meetingId: String(m.id),
    title: m.title ? String(m.title) : null,
    status: String(m.status || ''),
    createdAt: m.created_at ? String(m.created_at) : null,
    joinUrl: joinUrlFor(String(m.id)),
  }))
  all.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const matched = want ? all.filter((m) => m.status === want) : all
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200)
  return {
    ok: true,
    total: all.length,
    matched: matched.length,
    allUsers: r.data.filteredByOwner !== true,
    meetings: matched.slice(0, n),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prepare a meeting (slice 2a, 2026-11-15) — the first functions that WRITE
// ─────────────────────────────────────────────────────────────────────────────
//
// realtime-worker decides who may change what (ownership, System Owner for the default open
// room). It also holds the two guards a partial caller needs — an omitted isDefault and an
// omitted waiting-screen field are left as they are — so nothing here has to read-then-write.
// Calls that touch the account settings go out ONE AFTER THE OTHER: toggle-waiting-room and
// update-waiting-screen each rewrite the whole settings JSON, and two at once can lose a write.

const post = (env, token, path, body) => callRealtime(env, token, path, { method: 'POST', body: JSON.stringify(body) })

function cleanTitle(title, { required }) {
  if (title == null || String(title).trim() === '') return required ? { error: 'title is required.' } : { title: null }
  const t = String(title).trim()
  if (t.length > 120) return { error: 'title must be at most 120 characters.' }
  return { title: t }
}

/**
 * Create an ad-hoc meeting owned by the caller. create-meeting takes no fields, so a title is set
 * with a second call. If that second call fails the meeting still exists — the result says so
 * (titleSet=false) instead of reporting a failure for something that was created.
 */
export async function createMeeting(env, { actor, title }) {
  const c = cleanTitle(title, { required: false })
  if (c.error) return fail(ERR.INVALID_INPUT, c.error)
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const made = await post(env, t.token, '/realtime/create-meeting', {})
  if (!made.ok) return made
  const meetingId = made.data.meetingId ? String(made.data.meetingId) : ''
  if (!meetingId) return fail(ERR.INTERNAL_ERROR, 'realtime-worker returned no meetingId.')
  const out = { ok: true, meetingId, status: String(made.data.status || ''), joinUrl: joinUrlFor(meetingId), title: null, titleSet: false, titleError: null }
  if (c.title) {
    const named = await post(env, t.token, '/realtime/rename-room', { meetingId, title: c.title })
    if (named.ok) { out.title = String(named.data.title || c.title); out.titleSet = true } else out.titleError = named.message
  }
  return out
}

/** Set the title of a room or meeting the caller owns. */
export async function renameRoom(env, { actor, meetingId, title }) {
  const id = String(meetingId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'meetingId is required — realtime_list_rooms or realtime_list_meetings gives it.')
  const c = cleanTitle(title, { required: true })
  if (c.error) return fail(ERR.INVALID_INPUT, c.error)
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, '/realtime/rename-room', { meetingId: id, title: c.title })
  if (!r.ok) return r
  return { ok: true, meetingId: id, title: String(r.data.title || c.title), joinUrl: joinUrlFor(id) }
}

/**
 * Open one of the caller's meetings to guests without login, or close it. isDefault is never
 * sent: which room the bare ?openroom link leads to is a platform setting made in the app.
 */
export async function setOpenRoom(env, { actor, meetingId, open }) {
  const id = String(meetingId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'meetingId is required — realtime_list_rooms or realtime_list_meetings gives it.')
  if (typeof open !== 'boolean') return fail(ERR.INVALID_INPUT, 'open must be true or false.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, '/realtime/open-room/toggle', { meetingId: id, enabled: open })
  if (!r.ok) return r
  const isOpen = r.data.open === true
  const isDefault = r.data.isDefault === true
  let slugs = []
  if (isOpen) {
    const st = await callRealtime(env, t.token, '/realtime/open-room/status')
    if (st.ok && Array.isArray(st.data.slugs?.[id])) slugs = st.data.slugs[id].map(String)
  }
  return {
    ok: true,
    meetingId: id,
    open: isOpen,
    isDefaultOpenRoom: isDefault,
    openRoomUrl: isOpen ? openRoomUrlFor(id, { isDefault, slug: slugs[0] || null }) : null,
    joinUrl: joinUrlFor(id),
  }
}

/**
 * The waiting room: one switch per ACCOUNT (all the caller's rooms), and what a guest sees while
 * waiting. Only what is passed is changed; '' clears a screen field.
 */
export async function setWaitingRoom(env, { actor, enabled, screenTitle, screenImageUrl }) {
  const wantsSwitch = typeof enabled === 'boolean'
  const screen = {}
  if (screenTitle !== undefined) screen.title = String(screenTitle ?? '').trim() || null
  if (screenImageUrl !== undefined) screen.image = String(screenImageUrl ?? '').trim() || null
  if (!wantsSwitch && !Object.keys(screen).length) return fail(ERR.INVALID_INPUT, 'Pass enabled, screenTitle or screenImageUrl — at least one.')
  if (screen.title && screen.title.length > 200) return fail(ERR.INVALID_INPUT, 'screenTitle must be at most 200 characters.')
  if (screen.image && !/^https?:\/\//i.test(screen.image)) return fail(ERR.INVALID_INPUT, 'screenImageUrl must be an http(s) URL.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error

  if (wantsSwitch) {
    const r = await post(env, t.token, '/realtime/toggle-waiting-room', { enabled })
    if (!r.ok) return r
  }
  if (Object.keys(screen).length) {
    const r = await post(env, t.token, '/realtime/update-waiting-screen', screen)
    if (!r.ok) return wantsSwitch ? { ...r, message: `The waiting room was switched ${enabled ? 'on' : 'off'}, but the waiting screen was not changed: ${r.message}` } : r
  }
  const now = await callRealtime(env, t.token, '/realtime/my-rooms')
  if (!now.ok) return now
  return {
    ok: true,
    waitingRoomEnabled: now.data.waitingRoomEnabled === true,
    screenTitle: now.data.waitingScreen?.title ? String(now.data.waitingScreen.title) : null,
    screenImageUrl: now.data.waitingScreen?.image ? String(now.data.waitingScreen.image) : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slugs (slice 2b, 2026-11-15) — writes
// ─────────────────────────────────────────────────────────────────────────────
//
// A slug is a door into a meeting: the people on its allowlist, and anyone holding one of its
// share links, get in without logging in. realtime-worker decides who may make one (Admin or
// Superadmin, and only onto a room the caller owns) and holds the list arithmetic for
// addEmails / removeEmails, so nothing here reads the list in order to write it back.

const SLUG_RE = /^[a-z0-9-]{3,50}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function cleanEmails(list, name) {
  if (list === undefined) return { value: undefined }
  if (!Array.isArray(list)) return { error: `${name} must be a list of e-mail addresses.` }
  const out = list.map((e) => String(e || '').trim()).filter(Boolean)
  const bad = out.find((e) => !EMAIL_RE.test(e))
  if (bad) return { error: `${name}: "${bad}" is not an e-mail address.` }
  return { value: out }
}

function cleanTime(v) {
  if (v === undefined) return { value: undefined }
  if (v === null || String(v).trim() === '') return { value: null }
  const d = new Date(String(v))
  if (isNaN(d.getTime())) return { error: 'scheduledStartAt is not a date. Use ISO 8601 with the time zone offset, e.g. 2026-12-01T10:00:00+01:00.' }
  // A time without a zone would be read as UTC by the server and land an hour or two off.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(String(v).trim())) return { error: 'scheduledStartAt needs a time zone offset, e.g. 2026-12-01T10:00:00+01:00 (or Z for UTC).' }
  return { value: d.toISOString() }
}

const slugUrl = (slug) => `${REALTIME_APP_ORIGIN}/${encodeURIComponent(String(slug))}`

/** Create a slug that lets the listed people into one of the caller's own rooms. */
export async function createSlug(env, { actor, slug, meetingId, allowedEmails, scheduledStartAt }) {
  const s = String(slug || '').trim().toLowerCase()
  if (!SLUG_RE.test(s) || /^-|-$|--/.test(s)) return fail(ERR.INVALID_INPUT, 'slug must be 3–50 characters: a–z, 0–9 and single hyphens, not at the ends.')
  const id = String(meetingId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'meetingId is required — realtime_list_rooms or realtime_list_meetings gives it.')
  const emails = cleanEmails(allowedEmails, 'allowedEmails')
  if (emails.error) return fail(ERR.INVALID_INPUT, emails.error)
  if (!emails.value?.length) return fail(ERR.INVALID_INPUT, 'allowedEmails needs at least one e-mail address.')
  const when = cleanTime(scheduledStartAt)
  if (when.error) return fail(ERR.INVALID_INPUT, when.error)
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, '/realtime/slugs/create', {
    slug: s, meetingId: id, allowedEmails: emails.value, ...(when.value ? { scheduledStartAt: when.value } : {}),
  })
  if (!r.ok) return r
  return {
    ok: true,
    slugId: String(r.data.slugId || ''),
    slug: s,
    url: slugUrl(s),
    meetingId: id,
    allowedEmails: emails.value,
    scheduledStartAt: r.data.scheduledStartAt ? String(r.data.scheduledStartAt) : null,
  }
}

/** Change one of the caller's own slugs. Only what is passed is changed. */
export async function updateSlug(env, { actor, slugId, addEmails, removeEmails, allowedEmails, scheduledStartAt, meetingId }) {
  const sid = String(slugId || '').trim()
  if (!sid) return fail(ERR.INVALID_INPUT, 'slugId is required — realtime_list_slugs gives it (the id, not the slug text).')
  const body = {}
  for (const [name, list] of [['addEmails', addEmails], ['removeEmails', removeEmails], ['allowedEmails', allowedEmails]]) {
    const c = cleanEmails(list, name)
    if (c.error) return fail(ERR.INVALID_INPUT, c.error)
    if (c.value !== undefined) {
      if (!c.value.length) return fail(ERR.INVALID_INPUT, `${name} is empty.`)
      body[name] = c.value
    }
  }
  if (body.allowedEmails && (body.addEmails || body.removeEmails)) {
    return fail(ERR.INVALID_INPUT, 'Pass either allowedEmails (replaces the whole list) or addEmails/removeEmails, not both.')
  }
  const when = cleanTime(scheduledStartAt)
  if (when.error) return fail(ERR.INVALID_INPUT, when.error)
  if (when.value !== undefined) body.scheduledStartAt = when.value
  if (meetingId !== undefined && String(meetingId).trim()) body.meetingId = String(meetingId).trim()
  if (!Object.keys(body).length) return fail(ERR.INVALID_INPUT, 'Nothing to change — pass addEmails, removeEmails, allowedEmails, scheduledStartAt or meetingId.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, `/realtime/slugs/${encodeURIComponent(sid)}/update`, body)
  if (!r.ok) return r
  const now = r.data.slug || {}
  return {
    ok: true,
    slugId: sid,
    slug: String(now.slug || ''),
    url: now.slug ? slugUrl(now.slug) : null,
    meetingId: String(now.meetingId || ''),
    allowedEmails: Array.isArray(now.allowedEmails) ? now.allowedEmails.map(String) : [],
    scheduledStartAt: now.scheduledStartAt ? String(now.scheduledStartAt) : null,
  }
}

/**
 * Make a share link for a slug: anyone holding it gets in without login, from an hour before to
 * an hour after the slug's meeting time. Every call makes ANOTHER link; earlier ones stay valid.
 */
export async function shareSlug(env, { actor, slugId }) {
  const sid = String(slugId || '').trim()
  if (!sid) return fail(ERR.INVALID_INPUT, 'slugId is required — realtime_list_slugs gives it (the id, not the slug text).')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, `/realtime/slugs/${encodeURIComponent(sid)}/share-token`, {})
  if (!r.ok) return r
  if (!r.data.url) return fail(ERR.INTERNAL_ERROR, 'realtime-worker returned no share link.')
  return {
    ok: true,
    slugId: sid,
    url: String(r.data.url),
    validFrom: String(r.data.validFrom || ''),
    validUntil: String(r.data.validUntil || ''),
    scheduledStartAt: String(r.data.scheduledStartAt || ''),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Removals (decision D3 = B, 2026-11-15) — preview, then confirm
// ─────────────────────────────────────────────────────────────────────────────
// Revoking a share link, deleting a slug and closing a meeting. The two-step rule is NOT kept
// here: realtime-worker issues the confirm token at /realtime/removals/preview and refuses
// /realtime/removals/confirm without a valid one, so the Agent-Builder chat tools (rt_*) get the
// same protection as these. This file only forwards.

/** The share links of one of the caller's slugs that are not revoked, each with its id. */
export async function listShareLinks(env, { actor, slugId }) {
  const sid = String(slugId || '').trim()
  if (!sid) return fail(ERR.INVALID_INPUT, 'slugId is required — realtime_list_slugs gives it (the id, not the slug text).')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await callRealtime(env, t.token, `/realtime/slugs/${encodeURIComponent(sid)}/share-tokens`)
  if (!r.ok) return r
  const now = new Date().toISOString()
  const links = (Array.isArray(r.data.tokens) ? r.data.tokens : []).filter((x) => x?.id).map((x) => {
    const validFrom = String(x.validFrom || '')
    const validUntil = String(x.validUntil || '')
    return {
      id: String(x.id),
      url: String(x.url || ''),
      validFrom,
      validUntil,
      createdAt: x.createdAt ? String(x.createdAt) : null,
      state: now < validFrom ? 'not_yet_valid' : now > validUntil ? 'expired' : 'valid_now',
    }
  })
  return { ok: true, slugId: sid, links }
}

export const REMOVAL_ACTIONS = ['revoke_share_link', 'delete_slug', 'close_meeting']

/** What a removal would do. Changes nothing; returns the token realtime_confirm_removal needs. */
export async function previewRemoval(env, { actor, action, id }) {
  if (!REMOVAL_ACTIONS.includes(action)) return fail(ERR.INVALID_INPUT, `action must be one of: ${REMOVAL_ACTIONS.join(', ')}.`)
  const target = String(id || '').trim()
  if (!target) return fail(ERR.INVALID_INPUT, 'id is required: the share link id or URL, the slug id, or the meetingId.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, '/realtime/removals/preview', { action, id: target })
  if (!r.ok) return r
  if (!r.data.confirmToken) return fail(ERR.INTERNAL_ERROR, 'realtime-worker returned no confirmToken.')
  return {
    ok: true,
    action,
    targetId: String(r.data.targetId || target),
    summary: String(r.data.summary || ''),
    effects: Array.isArray(r.data.effects) ? r.data.effects.map(String) : [],
    confirmToken: String(r.data.confirmToken),
    expiresAt: String(r.data.expiresAt || ''),
  }
}

/** Do the removal a preview described. The token is the only input — it names the target. */
export async function confirmRemoval(env, { actor, confirmToken }) {
  const tok = String(confirmToken || '').trim()
  if (!tok) return fail(ERR.INVALID_INPUT, 'confirmToken is required — it comes from realtime_preview_removal.')
  const t = await tokenOrFail(env, actor)
  if (t.error) return t.error
  const r = await post(env, t.token, '/realtime/removals/confirm', { confirmToken: tok })
  if (!r.ok) return r
  return { ok: true, action: String(r.data.action || ''), targetId: String(r.data.targetId || ''), done: String(r.data.done || 'Removed.') }
}
