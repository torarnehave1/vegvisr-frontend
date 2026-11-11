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
