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

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

const CRLF = '\r\n'

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
