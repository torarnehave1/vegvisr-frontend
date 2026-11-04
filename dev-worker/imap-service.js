/**
 * imap-service.js — raw IMAP from a Worker, for putting a sent copy where it belongs.
 *
 * WHY THIS EXISTS
 * ---------------
 * Cloudflare Email Sending is an API, not a mail client: it delivers to the recipient and never
 * touches the sender's own mailbox. So mail sent as post@nibi.no appears in nobody's Sent folder.
 * email-worker compensates by POSTing a copy to vemail-store-worker, which means NIBI's mail is
 * split in two — inbound at Uniweb (the MX points there), outbound copies in a D1 table that has
 * no connection to it. Measured 2026-10-04: 0 messages in the vemail inbox, 31 in its sent folder.
 *
 * An IMAP APPEND to the real mailbox is the only thing that puts the copy where a person looking
 * at their own Sent folder would expect to find it.
 *
 * FIRST, A PROBE
 * --------------
 * Nothing in this codebase has ever opened a raw TCP socket from a Worker, and whether one can
 * reach port 993 at all is not something a document can answer — the sandbox these tools run in
 * blocks every outbound TCP port, including 443, so local testing proves nothing in either
 * direction. `imapProbe` is therefore the whole of stage one: connect, read the greeting, ask for
 * CAPABILITY, log out. It takes no credentials and sends none, so it can be run against a live
 * mail server without risking anything, and it answers the two questions an APPEND depends on —
 * can we get there, and what does the server actually support.
 *
 * Writing an IMAP client before knowing the answer would be writing against a guess.
 */

import { connect } from 'cloudflare:sockets'
import { ERR, statusForCode } from './graph-service.js'
import {
  CRLF, parseListLine, chooseSentFolder, buildRfc822, parseKeyName, formatKeyName,
  concatBytes, takeResponse, parseFetchResponse, parseSearch, parseHeaders, parseAddressList, parseMessage,
} from './imap-protocol.js'

// Re-exported so callers have one import for the whole surface.
export { parseListLine, chooseSentFolder, buildRfc822, parseKeyName, formatKeyName }

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}


/**
 * Read CRLF-delimited lines until `done(line)` says to stop, or the budget runs out.
 *
 * IMAP is a line protocol with no framing beyond CRLF, and a single read can return a partial
 * line or several at once, so the buffer is carried between reads rather than assumed to align.
 */
async function readLines(reader, done, { budgetMs = 8000, maxLines = 60 } = {}) {
  const decoder = new TextDecoder()
  const lines = []
  const deadline = Date.now() + budgetMs
  let buffer = ''

  while (Date.now() < deadline && lines.length < maxLines) {
    const { value, done: closed } = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve({ value: undefined, done: true }), Math.max(0, deadline - Date.now()))),
    ])
    if (closed) break
    buffer += decoder.decode(value, { stream: true })

    let i
    while ((i = buffer.indexOf(CRLF)) !== -1) {
      const line = buffer.slice(0, i)
      buffer = buffer.slice(i + CRLF.length)
      lines.push(line)
      if (done(line)) return { lines, finished: true }
      if (lines.length >= maxLines) return { lines, finished: false }
    }
  }
  return { lines, finished: false }
}

/**
 * Open a connection, read the greeting and CAPABILITY, and leave.
 *
 * `starttls` picks between the two shapes Uniweb documents: 993 with TLS from the first byte, or
 * 143 in the clear and then STARTTLS. Both are tried the same way from here, so a failure on one
 * and a success on the other is itself a useful answer.
 *
 * Takes no username and no password, and must stay that way — the point of a probe is that it can
 * be pointed at a live server by anyone without putting a credential on the wire.
 */
export async function imapProbe(_env, { hostname, port = 993, starttls = false }) {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host || !/^[a-z0-9.-]+$/.test(host)) {
    return fail(ERR.INVALID_INPUT, 'hostname must be a bare host such as "mail.uniweb.no".')
  }
  const p = Number(port)
  if (!Number.isInteger(p) || p < 1 || p > 65535) return fail(ERR.INVALID_INPUT, 'port must be 1-65535.')

  const started = Date.now()
  let socket
  try {
    socket = connect({ hostname: host, port: p }, { secureTransport: starttls ? 'starttls' : 'on', allowHalfOpen: false })
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not open a socket to ${host}:${p}: ${e.message}`, { hostname: host, port: p })
  }

  const result = { hostname: host, port: p, tlsMode: starttls ? 'starttls' : 'implicit' }
  try {
    let reader = socket.readable.getReader()
    let writer = socket.writable.getWriter()
    const encoder = new TextEncoder()
    const send = (s) => writer.write(encoder.encode(s + CRLF))

    // 1. The greeting. A server that speaks IMAP opens with an untagged OK before we say anything.
    const greet = await readLines(reader, (l) => /^\*\s+(OK|PREAUTH|BYE|NO|BAD)/i.test(l), { budgetMs: 8000 })
    result.greeting = greet.lines[greet.lines.length - 1] || null
    if (!result.greeting) {
      return fail(ERR.INTERNAL_ERROR, `Connected to ${host}:${p} but got no IMAP greeting within 8s.`, result)
    }

    // 2. STARTTLS, when that is the shape being tested. The greeting above was in the clear.
    if (starttls) {
      await send('p0 STARTTLS')
      const st = await readLines(reader, (l) => /^p0 /i.test(l), { budgetMs: 6000 })
      result.starttlsResponse = st.lines[st.lines.length - 1] || null
      if (!/^p0 OK/i.test(result.starttlsResponse || '')) {
        return fail(ERR.INTERNAL_ERROR, `${host}:${p} refused STARTTLS: ${result.starttlsResponse}`, result)
      }
      reader.releaseLock()
      writer.releaseLock()
      socket = socket.startTls()
      reader = socket.readable.getReader()
      writer = socket.writable.getWriter()
    }

    // 3. What it supports. AUTH= entries decide how a later login has to be done, and the presence
    //    of LOGINDISABLED would mean plain LOGIN is refused even over TLS.
    await send('p1 CAPABILITY')
    const cap = await readLines(reader, (l) => /^p1 /i.test(l), { budgetMs: 8000 })
    const capLine = cap.lines.find((l) => /^\*\s+CAPABILITY/i.test(l)) || ''
    result.capabilities = capLine.replace(/^\*\s+CAPABILITY\s*/i, '').trim().split(/\s+/).filter(Boolean)
    result.capabilityStatus = cap.lines[cap.lines.length - 1] || null

    await send('p2 LOGOUT').catch(() => {})
    try { reader.releaseLock(); writer.releaseLock() } catch { /* already released */ }
    try { await socket.close() } catch { /* the server may have closed first */ }

    result.ms = Date.now() - started
    result.speaksImap = /^\*\s+(OK|PREAUTH)/i.test(result.greeting)
    result.loginDisabled = result.capabilities.some((c) => /^LOGINDISABLED$/i.test(c))
    return { ok: true, ...result }
  } catch (e) {
    try { await socket.close() } catch { /* ignore */ }
    return fail(ERR.INTERNAL_ERROR, `${host}:${p} — ${e.message}`, { ...result, ms: Date.now() - started })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated IMAP — login, find the Sent folder, append a copy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mailbox password, fetched over the service binding.
 *
 * NOT decrypted here. The first attempt copied the AES-GCM/PBKDF2 routine into this worker and
 * gave it ENCRYPTION_MASTER_KEY against `user_api_keys` — which would have let the MCP server
 * decrypt every row in that table, thirteen of them, when it needs one mailbox password.
 * user-keys-worker keeps the crypto and answers only for `imap:` providers, only over a binding.
 */
async function mailboxCredential(env, address) {
  if (!env.USER_KEYS_WORKER?.fetch) {
    return { ok: false, reason: 'the USER_KEYS_WORKER binding is not configured on this worker' }
  }
  let res
  let data
  try {
    res = await env.USER_KEYS_WORKER.fetch(
      `https://user-keys-worker/mailbox-password?address=${encodeURIComponent(String(address).toLowerCase())}`,
    )
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return { ok: false, reason: `could not reach the key service: ${e.message}` }
  }
  if (!res.ok || !data.password) {
    // Status and the service's own words; never anything that could echo the secret.
    return { ok: false, reason: data.error || `the key service refused (status ${res.status})` }
  }
  // key_name carries host:port and, once measured, the Sent folder. The service returns it raw so
  // the parsing lives in one place.
  const parsed = parseKeyName(data.keyName || `${data.hostname || ''}:${data.port || 993}`)
  return {
    ok: true,
    password: data.password,
    hostname: parsed.hostname || data.hostname || 'mail.uniweb.no',
    port: parsed.port || data.port || 993,
    sentFolder: parsed.sentFolder,
  }
}

/** One IMAP session: connect, LOGIN, run `work`, LOGOUT. The password is never logged. */
async function withImap({ hostname, port, user, password }, work) {
  const socket = connect({ hostname, port }, { secureTransport: 'on', allowHalfOpen: false })
  const reader = socket.readable.getReader()
  const writer = socket.writable.getWriter()
  const encoder = new TextEncoder()
  let tag = 0
  const send = (s) => writer.write(encoder.encode(s + CRLF))
  const command = async (text, { budgetMs = 15000 } = {}) => {
    const t = `a${++tag}`
    await send(`${t} ${text}`)
    const { lines } = await readLines(reader, (l) => l.startsWith(`${t} `), { budgetMs, maxLines: 400 })
    const final = lines[lines.length - 1] || ''
    return { lines, ok: /^a\d+ OK/i.test(final), final }
  }

  try {
    const greet = await readLines(reader, (l) => /^\*\s+(OK|PREAUTH)/i.test(l), { budgetMs: 8000 })
    if (!greet.lines.length) return fail(ERR.INTERNAL_ERROR, `${hostname}:${port} gave no IMAP greeting.`)

    // A literal, not a quoted string: a password may contain characters that would need escaping,
    // and getting that wrong presents as "wrong password" rather than as a syntax error.
    const pwBytes = encoder.encode(password).length
    const login = await command(`LOGIN "${user}" {${pwBytes}+}\r\n${password}`)
    if (!login.ok) {
      return fail(ERR.FORBIDDEN_GRAPH, `IMAP login failed for ${user}: ${login.final.replace(/^a\d+\s+/, '')}`)
    }

    const result = await work(command)
    await command('LOGOUT', { budgetMs: 4000 }).catch(() => {})
    return result
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `IMAP error against ${hostname}:${port}: ${e.message}`)
  } finally {
    try { reader.releaseLock(); writer.releaseLock() } catch { /* already released */ }
    try { await socket.close() } catch { /* the server may have closed first */ }
  }
}

export async function imapFindSentFolder(env, { address }) {
  const cred = await mailboxCredential(env, address)
  if (!cred.ok) return fail(ERR.FORBIDDEN_GRAPH, cred.reason, { address })

  return withImap({ hostname: cred.hostname, port: cred.port, user: address, password: cred.password }, async (command) => {
    const list = await command('LIST "" "*"')
    if (!list.ok) return fail(ERR.INTERNAL_ERROR, `LIST failed: ${list.final}`)
    const folders = list.lines.map(parseListLine).filter(Boolean)
    const chosen = chooseSentFolder(folders)
    return {
      ok: true,
      address,
      hostname: cred.hostname,
      sentFolder: chosen.name,
      how: chosen.how,
      folders: folders.map((f) => f.name),
    }
  })
}

/**
 * File a copy of a sent message in the mailbox's own Sent folder.
 *
 * Best-effort BY CONTRACT: the e-mail has already been delivered by the time this runs, so a
 * failure here is a missing copy and never a failed send. It returns a reason instead of throwing.
 */
export async function imapAppendSent(env, { address, sentFolder, rfc822 }) {
  if (!sentFolder) return fail(ERR.INVALID_INPUT, 'sentFolder is required.')
  const cred = await mailboxCredential(env, address)
  if (!cred.ok) return fail(ERR.FORBIDDEN_GRAPH, cred.reason, { address })

  return withImap({ hostname: cred.hostname, port: cred.port, user: address, password: cred.password }, async (command) => {
    const bytes = new TextEncoder().encode(rfc822).length
    // \Seen because the sender has by definition already read what they sent.
    const res = await command(`APPEND "${sentFolder}" (\\Seen) {${bytes}+}\r\n${rfc822}`, { budgetMs: 25000 })
    if (!res.ok) return fail(ERR.INTERNAL_ERROR, `APPEND to "${sentFolder}" failed: ${res.final}`, { address, sentFolder })
    return { ok: true, address, sentFolder, bytes }
  })
}


/** Write the measured Sent folder back into key_name, so the next send skips the LIST. */
async function rememberSentFolder(env, address, { hostname, port, sentFolder }) {
  try {
    await env.vegvisr_org
      .prepare('UPDATE user_api_keys SET key_name = ?, updated_at = CURRENT_TIMESTAMP WHERE provider = ?')
      .bind(formatKeyName({ hostname, port, sentFolder }), `imap:${String(address).toLowerCase()}`)
      .run()
  } catch (e) {
    // A send that could not cache the folder still filed its copy; it just measures again next time.
    console.error('[imap] could not remember the sent folder:', e.message)
  }
}

/**
 * File a copy of a just-sent message in the sender's own Sent folder.
 *
 * BEST-EFFORT BY CONTRACT. The e-mail has already been delivered by the time this runs, so every
 * failure path here returns a reason and none of them throws — a missing copy must never present
 * as a failed send.
 *
 * The folder is measured once and remembered in key_name. If the remembered name stops working —
 * the mailbox moved provider, the folder was renamed — one re-measure is attempted before giving
 * up, because the alternative is a silent stop that nobody notices until they look for an e-mail
 * that is not there.
 */
export async function fileSentCopy(env, { address, toEmail, cc = [], bcc = [], subject, html, fromName, messageId }) {
  const cred = await mailboxCredential(env, address)
  if (!cred.ok) return { filed: false, reason: cred.reason }

  const rfc822 = buildRfc822({ fromEmail: address, fromName, toEmail, cc, bcc, subject, html, messageId })

  let folder = cred.sentFolder
  let measured = false
  if (!folder) {
    const found = await imapFindSentFolder(env, { address })
    if (!found.ok) return { filed: false, reason: `could not list folders: ${found.message}` }
    if (!found.sentFolder) {
      return { filed: false, reason: `no Sent folder found among: ${found.folders.join(', ')}` }
    }
    folder = found.sentFolder
    measured = true
  }

  let res = await imapAppendSent(env, { address, sentFolder: folder, rfc822 })

  // A remembered name that no longer works earns exactly one re-measure.
  if (!res.ok && !measured) {
    const found = await imapFindSentFolder(env, { address })
    if (found.ok && found.sentFolder && found.sentFolder !== folder) {
      folder = found.sentFolder
      measured = true
      res = await imapAppendSent(env, { address, sentFolder: folder, rfc822 })
    }
  }

  if (!res.ok) return { filed: false, reason: res.message, sentFolder: folder }

  if (measured) await rememberSentFolder(env, address, { hostname: cred.hostname, port: cred.port, sentFolder: folder })
  return { filed: true, sentFolder: folder, bytes: res.bytes }
}


// ─────────────────────────────────────────────────────────────────────────────
// Reading the inbox — read-only by construction
// ─────────────────────────────────────────────────────────────────────────────
//
// READ-ONLY IS ENFORCED HERE, NOT PROMISED. The folder is opened with EXAMINE, never SELECT, so the
// server itself refuses any change for the whole session, and every fetch uses BODY.PEEK, which
// does not set \Seen. Reading mail through this tool therefore never marks it as read, moves it or
// deletes it — the person still sees it as new in their own mail client.
//
// A separate session function rather than an extension of withImap: the Sent-copy path works on
// lines and is proven in production; reading needs a byte-exact literal reader, and keeping the two
// apart means a bug here cannot break the copy that follows every send.

/** One read-only IMAP session that understands literals. */
async function withImapReader({ hostname, port, user, password }, work) {
  const socket = connect({ hostname, port }, { secureTransport: 'on', allowHalfOpen: false })
  const reader = socket.readable.getReader()
  const writer = socket.writable.getWriter()
  const encoder = new TextEncoder()
  let buf = new Uint8Array(0)
  let tag = 0

  // Read until a response matching `done` arrives; returns every response up to and including it.
  const readUntil = async (done, { budgetMs = 15000, maxBytes = 6_000_000 } = {}) => {
    const responses = []
    const deadline = Date.now() + budgetMs
    for (;;) {
      let taken
      while ((taken = takeResponse(buf))) {
        buf = taken.rest
        responses.push(taken.response)
        if (done(taken.response)) return { responses, finished: true }
      }
      if (Date.now() >= deadline || buf.length > maxBytes) return { responses, finished: false }
      const { value, done: closed } = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ value: undefined, done: true }), Math.max(0, deadline - Date.now()))),
      ])
      if (closed || !value) return { responses, finished: false }
      buf = concatBytes(buf, value)
    }
  }
  const command = async (text, opts) => {
    const t = `r${++tag}`
    await writer.write(encoder.encode(`${t} ${text}${CRLF}`))
    const { responses, finished } = await readUntil((r) => r.text.startsWith(`${t} `), opts)
    const final = finished ? responses[responses.length - 1].text : '(no answer in time)'
    return { responses, ok: new RegExp(`^${t} OK`, 'i').test(final), final }
  }

  try {
    const greet = await readUntil((r) => /^\*\s+(OK|PREAUTH)/i.test(r.text), { budgetMs: 8000 })
    if (!greet.finished) return fail(ERR.INTERNAL_ERROR, `${hostname}:${port} gave no IMAP greeting.`)
    const pwBytes = encoder.encode(password).length
    const login = await command(`LOGIN "${user}" {${pwBytes}+}\r\n${password}`)
    if (!login.ok) {
      return fail(ERR.FORBIDDEN_GRAPH, `IMAP login failed for ${user}: ${login.final.replace(/^r\d+\s+/, '')}`)
    }
    const result = await work(command)
    await command('LOGOUT', { budgetMs: 4000 }).catch(() => {})
    return result
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `IMAP error against ${hostname}:${port}: ${e.message}`)
  } finally {
    try { reader.releaseLock(); writer.releaseLock() } catch { /* already released */ }
    try { await socket.close() } catch { /* the server may have closed first */ }
  }
}

/** A folder name safe to put in a quoted IMAP string. */
function folderArg(folder) {
  const f = String(folder || 'INBOX').trim()
  if (!f || f.length > 200 || /["\\\r\n]/.test(f)) return null
  return f
}

const HEADER_FIELDS = 'FROM TO CC SUBJECT DATE MESSAGE-ID'

/**
 * The most recent messages in a folder, newest first, as headers only.
 *
 * `address` must already have passed the access gate — this function checks nothing about WHO is
 * asking; email-service.listInbox does that before calling it.
 */
export async function imapListMessages(env, { address, folder = 'INBOX', limit = 20, unreadOnly = false, since = null }) {
  const box = folderArg(folder)
  if (!box) return fail(ERR.INVALID_INPUT, 'folder must be a plain folder name such as "INBOX".')
  const n = Math.min(Math.max(Number(limit) || 20, 1), 50)
  const cred = await mailboxCredential(env, address)
  if (!cred.ok) return fail(ERR.FORBIDDEN_GRAPH, cred.reason, { address })

  return withImapReader({ hostname: cred.hostname, port: cred.port, user: address, password: cred.password }, async (command) => {
    const ex = await command(`EXAMINE "${box}"`)
    if (!ex.ok) return fail(ERR.GRAPH_NOT_FOUND, `Could not open folder "${box}": ${ex.final.replace(/^r\d+\s+/, '')}`)
    const total = ex.responses.map((r) => r.text.match(/^\*\s+(\d+)\s+EXISTS/i)).find(Boolean)

    const criteria = [unreadOnly ? 'UNSEEN' : 'ALL']
    if (since) criteria.push(`SINCE ${since}`)
    const search = await command(`UID SEARCH ${criteria.join(' ')}`)
    if (!search.ok) return fail(ERR.INTERNAL_ERROR, `SEARCH failed: ${search.final}`)
    const uids = parseSearch(search.responses).sort((a, b) => b - a).slice(0, n)
    if (!uids.length) return { ok: true, address, folder: box, total: total ? Number(total[1]) : 0, messages: [] }

    const fetch = await command(
      `UID FETCH ${uids.join(',')} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (${HEADER_FIELDS})])`,
      { budgetMs: 20000 },
    )
    if (!fetch.ok) return fail(ERR.INTERNAL_ERROR, `FETCH failed: ${fetch.final}`)

    const messages = fetch.responses
      .map(parseFetchResponse)
      .filter((m) => m && m.uid)
      .map((m) => {
        const h = parseHeaders(new TextDecoder('latin1').decode(m.body || new Uint8Array(0)))
        const from = parseAddressList(h.from)[0] || null
        return {
          uid: m.uid,
          from: from ? from.address : null,
          fromName: from ? from.name : null,
          to: parseAddressList(h.to).map((a) => a.address),
          cc: parseAddressList(h.cc).map((a) => a.address),
          subject: h.subject || '(uten emne)',
          date: h.date || m.internalDate,
          seen: m.flags.some((f) => /^\\Seen$/i.test(f)),
          sizeBytes: m.size,
        }
      })
      .sort((a, b) => b.uid - a.uid)
    return { ok: true, address, folder: box, total: total ? Number(total[1]) : messages.length, messages }
  })
}

/** Largest message read in full. Bigger ones are read up to this size and said to be truncated. */
export const MAX_READ_BYTES = 2_000_000
/** Most text returned to the caller. A model's context is the limit, not the mailbox. */
export const MAX_TEXT_CHARS = 20_000

/** One message, read without marking it as read. */
export async function imapReadMessage(env, { address, folder = 'INBOX', uid }) {
  const box = folderArg(folder)
  if (!box) return fail(ERR.INVALID_INPUT, 'folder must be a plain folder name such as "INBOX".')
  const id = Number(uid)
  if (!Number.isInteger(id) || id < 1) return fail(ERR.INVALID_INPUT, 'uid must be a positive whole number from list_inbox.')
  const cred = await mailboxCredential(env, address)
  if (!cred.ok) return fail(ERR.FORBIDDEN_GRAPH, cred.reason, { address })

  return withImapReader({ hostname: cred.hostname, port: cred.port, user: address, password: cred.password }, async (command) => {
    const ex = await command(`EXAMINE "${box}"`)
    if (!ex.ok) return fail(ERR.GRAPH_NOT_FOUND, `Could not open folder "${box}": ${ex.final.replace(/^r\d+\s+/, '')}`)
    const fetch = await command(`UID FETCH ${id} (UID FLAGS RFC822.SIZE BODY.PEEK[]<0.${MAX_READ_BYTES}>)`, { budgetMs: 25000 })
    if (!fetch.ok) return fail(ERR.INTERNAL_ERROR, `FETCH failed: ${fetch.final}`)
    const m = fetch.responses.map(parseFetchResponse).find((x) => x && x.uid === id)
    if (!m || !m.body) return fail(ERR.GRAPH_NOT_FOUND, `No message with uid ${id} in "${box}".`)

    const parsed = parseMessage(m.body)
    const h = parsed.headers
    const from = parseAddressList(h.from)[0] || null
    const text = parsed.text || ''
    return {
      ok: true,
      address,
      folder: box,
      uid: id,
      from: from ? from.address : null,
      fromName: from ? from.name : null,
      to: parseAddressList(h.to).map((a) => a.address),
      cc: parseAddressList(h.cc).map((a) => a.address),
      replyTo: parseAddressList(h['reply-to']).map((a) => a.address),
      subject: h.subject || '(uten emne)',
      date: h.date || null,
      messageId: h['message-id'] || null,
      seen: m.flags.some((f) => /^\\Seen$/i.test(f)),
      sizeBytes: m.size,
      text: text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text,
      textTruncated: text.length > MAX_TEXT_CHARS || (m.size || 0) > MAX_READ_BYTES,
      attachments: parsed.attachments,
    }
  })
}
