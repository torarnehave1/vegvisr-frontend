/**
 * media-upload-service.js — let an MCP client upload a video or image it made, without the bytes
 * ever passing through the model.
 *
 * WHY A TICKET
 * ------------
 * A reel is 10–40 MB. As a tool argument it would be millions of tokens of base64, so the bytes
 * have to travel outside the MCP call. The client's own sandbox does that with one HTTP PUT to a
 * URL this worker hands out:
 *
 *   create_media_upload (MCP, authenticated)  →  ticket
 *   PUT /media-upload/<ticket> (no other credential)  →  photos-worker as the ticket's owner
 *                                                     →  public vegvisr.imgix.net URL
 *
 * The ticket is the ONLY credential the sandbox ever holds. The user's login token
 * (emailVerificationToken) is a long-lived key to the whole account and never leaves this worker.
 *
 * WHAT A TICKET CAN DO — and nothing else
 * ---------------------------------------
 *  - one upload (the claim is a single conditional UPDATE, so two PUTs cannot both win)
 *  - within TICKET_TTL_SECONDS
 *  - of at most MAX_BYTES (40 MB — the body is buffered here; a Worker has 128 MB)
 *  - of a file whose first bytes ARE an MP4/MOV, JPEG or PNG — the declared type is not trusted
 *  - into one album fixed when the ticket was made, never chosen by the uploader
 * Only the SHA-256 of the ticket is stored, so reading the table yields nothing usable.
 *
 * ALBUM PER INSTAGRAM ACCOUNT (decided 2026-10-19, option B)
 * ---------------------------------------------------------
 * Album names are global in photos-worker and owned by their first uploader, so a shared "IG Reels"
 * would 403 the second person. A ticket is made FOR an Instagram account the caller may post to
 * (checked against blotato-worker, as the caller) and the file lands in `ig-reels-<username>`.
 */

import { ERR, statusForCode } from './graph-service.js'
import { uploadImage } from './images-service.js'
import { listInstagramAccounts } from './social-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

export const TICKET_TTL_SECONDS = 600
// 40 MB: the body is read once here and copied once into the multipart form photos-worker takes,
// so two copies have to fit in a Worker's 128 MB.
export const MAX_BYTES = 40 * 1024 * 1024
export const UPLOAD_PATH = '/media-upload/'
const PUBLIC_ORIGIN = 'https://knowledge.vegvisr.org'

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS media_upload_tickets (
  ticket_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  album TEXT NOT NULL,
  account_id TEXT,
  max_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  result_url TEXT
)`
export { TABLE_SQL as MEDIA_UPLOAD_TABLE_SQL }

const now = () => Math.floor(Date.now() / 1000)

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

/** `ig-reels-<username>`, in the characters an Instagram handle can have. */
export function albumForInstagram(username) {
  const safe = String(username || '').toLowerCase().replace(/[^a-z0-9._]+/g, '').slice(0, 30)
  return safe ? `ig-reels-${safe}` : null
}

/** What the first bytes say the file is. Null for anything we do not accept. */
export function sniffMedia(bytes) {
  const b = new Uint8Array(bytes.buffer ? bytes.buffer : bytes, bytes.byteOffset || 0, Math.min(bytes.byteLength, 16))
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // ISO base media: 'ftyp' at offset 4. 'qt  ' brand = QuickTime .mov, anything else = .mp4.
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    return brand === 'qt  ' ? { ext: 'mov', mime: 'video/quicktime', kind: 'video' } : { ext: 'mp4', mime: 'video/mp4', kind: 'video' }
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg', kind: 'image' }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png', kind: 'image' }
  return null
}

/**
 * Make a ticket for one upload into the album of an Instagram account the caller may post to.
 * Returns { ok, uploadUrl, album, expiresAt, maxBytes, curl } — the ticket appears only in the URL.
 */
export async function createMediaUpload(env, { actor, accountId }) {
  if (!actor || actor.anonymous || !actor.email) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  const id = String(accountId || '').trim()
  if (!id) return fail(ERR.INVALID_INPUT, 'accountId is required — call list_instagram_accounts.')

  const list = await listInstagramAccounts(env, { actor })
  if (!list.ok) return list
  const account = list.accounts.find((a) => a.accountId === id)
  if (!account) {
    return fail(ERR.FORBIDDEN_GRAPH, `Instagram account ${id} is not one you may post to. Call list_instagram_accounts.`)
  }
  const album = albumForInstagram(account.username) || `ig-reels-${id}`

  const ticket = hex(crypto.getRandomValues(new Uint8Array(32)))
  const created = now()
  const expires = created + TICKET_TTL_SECONDS
  try {
    await env.vegvisr_org
      .prepare(
        'INSERT INTO media_upload_tickets (ticket_hash, email, album, account_id, max_bytes, created_at, expires_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind(await sha256(ticket), actor.email, album, id, MAX_BYTES, created, expires)
      .run()
  } catch (e) {
    return fail(ERR.STORE_UNAVAILABLE, `Could not create the upload ticket: ${e.message}`)
  }

  const uploadUrl = `${PUBLIC_ORIGIN}${UPLOAD_PATH}${ticket}`
  return {
    ok: true,
    uploadUrl,
    album,
    username: account.username,
    expiresAt: new Date(expires * 1000).toISOString(),
    maxBytes: MAX_BYTES,
    curl: `curl -sS -X PUT --data-binary @reel.mp4 "${uploadUrl}"`,
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * PUT /media-upload/<ticket>. The ticket is the whole authentication; it is claimed BEFORE the
 * body is read, so a refused or failed upload still spends it — a ticket is never retried.
 */
export async function handleMediaUpload(request, env) {
  if (request.method !== 'PUT' && request.method !== 'POST') return json({ error: 'PUT the file bytes to this URL.' }, 405)
  const ticket = new URL(request.url).pathname.slice(UPLOAD_PATH.length)
  if (!/^[0-9a-f]{64}$/.test(ticket)) return json({ error: 'Unknown or expired upload ticket.' }, 404)

  const declared = Number(request.headers.get('Content-Length') || '')
  if (!Number.isFinite(declared) || declared <= 0) return json({ error: 'Send the file with a Content-Length (curl --data-binary @file).' }, 411)
  if (declared > MAX_BYTES) return json({ error: `The file is ${declared} bytes; the limit is ${MAX_BYTES}.` }, 413)

  const hash = await sha256(ticket)
  let row
  try {
    const t = now()
    const claim = await env.vegvisr_org
      .prepare('UPDATE media_upload_tickets SET used_at = ? WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?')
      .bind(t, hash, t)
      .run()
    if (!claim?.meta?.changes) return json({ error: 'Unknown, expired or already used upload ticket.' }, 404)
    row = await env.vegvisr_org.prepare('SELECT email, album, max_bytes FROM media_upload_tickets WHERE ticket_hash = ?').bind(hash).first()
  } catch (e) {
    return json({ error: `Upload tickets unavailable: ${e.message}` }, 503)
  }
  if (!row) return json({ error: 'Unknown upload ticket.' }, 404)

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > row.max_bytes) return json({ error: `The file is larger than ${row.max_bytes} bytes.` }, 413)
  const type = sniffMedia(bytes)
  if (!type) return json({ error: 'Only MP4, MOV, JPEG and PNG files are accepted (checked from the file itself).' }, 415)

  const actor = { email: row.email, userId: row.email, anonymous: false }
  const stored = await uploadImage(env, { bytes, actor, type, album: row.album })
  if (!stored.ok) return json({ error: stored.message }, 502)

  try {
    await env.vegvisr_org.prepare('UPDATE media_upload_tickets SET result_url = ? WHERE ticket_hash = ?').bind(stored.url, hash).run()
  } catch {
    // The file is stored and its URL is in this response; a missing audit column is not a failure.
  }
  return json({ ok: true, url: stored.url, album: row.album, kind: type.kind, contentType: type.mime, bytes: bytes.byteLength })
}
