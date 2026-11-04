/**
 * imap-protocol.js — the parts of IMAP that are pure text, with no socket.
 *
 * Split out of imap-service.js on 2026-10-04 for one practical reason: that file imports
 * `cloudflare:sockets`, which Node cannot load, so nothing in it could be unit tested. The logic
 * most likely to be wrong — which folder is the Sent folder, and whether the message handed to
 * APPEND is legal RFC 5322 — needs no socket at all, and now has tests.
 *
 * The folder choice in particular must not be discovered in production: APPEND to a name that does
 * not exist does NOT fail. The server creates the folder and the copy lands where nobody looks.
 */

export const CRLF = '\r\n'

/** What a Dovecot install might call Sent, best first. */
const SENT_CANDIDATES = ['Sent', 'INBOX.Sent', 'Sent Items', 'Sent Messages', 'Sendt', 'INBOX.Sendt']

export function parseListLine(line) {
  // * LIST (\HasNoChildren \Sent) "." INBOX.Sent
  const m = line.match(/^\*\s+LIST\s+\(([^)]*)\)\s+("[^"]*"|NIL)\s+(.+)$/i)
  if (!m) return null
  return {
    flags: m[1].split(/\s+/).filter(Boolean),
    delimiter: m[2].replace(/"/g, ''),
    name: m[3].trim().replace(/^"|"$/g, ''),
  }
}

/** Pick the Sent folder from a LIST result. Exported so it can be tested without a server. */
export function chooseSentFolder(folders) {
  const flagged = folders.find((f) => f.flags.some((x) => /^\\Sent$/i.test(x)))
  if (flagged) return { name: flagged.name, how: '\\Sent flag' }
  const named = SENT_CANDIDATES
    .map((c) => folders.find((f) => f.name.toLowerCase() === c.toLowerCase()))
    .find(Boolean)
  if (named) return { name: named.name, how: 'name match' }
  return { name: null, how: 'not found' }
}

/**
 * Which folder this server calls Sent.
 *
 * The CAPABILITY response carries no SPECIAL-USE, so the server cannot simply be asked. The
 * `\Sent` flag is still checked first — Dovecot often sets it without advertising the extension —
 * because a flag beats a name guess: a Norwegian mailbox may call it "Sendt", and APPEND to a
 * folder that does not exist creates one nobody ever opens.
 */
/**
 * An RFC 5322 message for the Sent copy. Single part — the body is HTML.
 *
 * Bcc IS written here, on purpose. This copy lives only in the sender's own Sent folder, which is
 * where a mail client keeps the Bcc line too (RFC 5322 §3.6.3 allows it in the sender's copy);
 * without it the sender could not see afterwards who got a blind copy. Recipients never see it:
 * delivery goes through Cloudflare, which does not put Bcc in the delivered headers.
 */
export function buildRfc822({ fromEmail, fromName, toEmail, cc = [], bcc = [], subject, html, messageId }) {
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(String(s || ''))))
  const enc = (s) => (/^[\x20-\x7E]*$/.test(String(s || '')) ? String(s || '') : `=?UTF-8?B?${b64(s)}?=`)
  const from = fromName ? `${enc(fromName)} <${fromEmail}>` : fromEmail
  const ccList = Array.isArray(cc) ? cc.filter(Boolean) : []
  const bccList = Array.isArray(bcc) ? bcc.filter(Boolean) : []
  return [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${toEmail}`,
    ...(ccList.length ? [`Cc: ${ccList.join(', ')}`] : []),
    ...(bccList.length ? [`Bcc: ${bccList.join(', ')}`] : []),
    `Subject: ${enc(subject)}`,
    ...(messageId ? [`Message-ID: ${messageId}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].join(CRLF)
}

/**
 * The `key_name` column carries the mailbox's connection settings, because adding a column to
 * user_api_keys for one feature would change a table five other workers read.
 *
 *   "mail.uniweb.no:993"              — written by set_mailbox_password
 *   "mail.uniweb.no:993:INBOX.Sent"   — once the Sent folder has been measured
 *
 * The two-field form is the legacy one and must keep parsing: a mailbox stored before the folder
 * was discovered still has to work, it just measures once more.
 */
export function parseKeyName(keyName) {
  const parts = String(keyName || '').split(':')
  return {
    hostname: parts[0] || null,
    port: Number(parts[1]) || 993,
    // The folder may itself contain no colon (INBOX.Sent uses a dot), so the rest is the folder.
    sentFolder: parts.length > 2 ? parts.slice(2).join(':') : null,
  }
}

export function formatKeyName({ hostname, port, sentFolder }) {
  const base = `${hostname}:${port || 993}`
  return sentFolder ? `${base}:${sentFolder}` : base
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading — responses with literals, headers, and a small MIME reader
// ─────────────────────────────────────────────────────────────────────────────
//
// Reading mail is where line-based parsing stops being enough. A FETCH answer carries the message
// as a LITERAL — "{1234}" at the end of a line, then exactly 1234 BYTES that may contain CRLFs and
// non-UTF-8 text. Counting characters instead of bytes, or splitting on CRLF inside a literal,
// corrupts the message silently. So the reader below works on bytes and is pure: a test can feed
// it a captured server answer in arbitrary chunks.

const ENC = new TextEncoder()

/** Concatenate two byte arrays. */
export function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function indexOfCrlf(buf, from) {
  for (let i = from; i < buf.length - 1; i++) if (buf[i] === 13 && buf[i + 1] === 10) return i
  return -1
}

/**
 * Take one complete server response from the front of `buf`.
 *
 * Returns `{ response: { text, literals }, rest }`, or `null` when `buf` does not yet hold a whole
 * response. `text` is the response with each literal replaced by the marker `{#n}` (n = index into
 * `literals`), so the structure can be matched with ordinary regexes while the literal bytes stay
 * exact.
 */
export function takeResponse(buf) {
  const latin1 = new TextDecoder('latin1')
  let pos = 0
  let text = ''
  const literals = []
  for (;;) {
    const eol = indexOfCrlf(buf, pos)
    if (eol === -1) return null
    const line = latin1.decode(buf.subarray(pos, eol))
    const m = line.match(/\{(\d+)\+?\}$/)
    if (!m) {
      text += line
      return { response: { text, literals }, rest: buf.subarray(eol + 2) }
    }
    const n = Number(m[1])
    const start = eol + 2
    if (buf.length < start + n) return null
    text += `${line.slice(0, -m[0].length)}{#${literals.length}}`
    literals.push(buf.slice(start, start + n))
    pos = start + n
  }
}

/** The fields of one `* n FETCH (...)` response that the inbox tools use. */
export function parseFetchResponse(response) {
  const t = response.text
  if (!/^\*\s+\d+\s+FETCH\s+\(/i.test(t)) return null
  const uid = t.match(/\bUID\s+(\d+)/i)
  const flags = t.match(/\bFLAGS\s+\(([^)]*)\)/i)
  const size = t.match(/\bRFC822\.SIZE\s+(\d+)/i)
  const date = t.match(/\bINTERNALDATE\s+"([^"]+)"/i)
  const lit = t.match(/\bBODY\[[^\]]*\](?:<\d+>)?\s+\{#(\d+)\}/i)
  return {
    uid: uid ? Number(uid[1]) : null,
    flags: flags ? flags[1].split(/\s+/).filter(Boolean) : [],
    size: size ? Number(size[1]) : null,
    internalDate: date ? date[1] : null,
    body: lit ? response.literals[Number(lit[1])] : null,
  }
}

/** UIDs from `* SEARCH 1 2 3` lines. */
export function parseSearch(responses) {
  const out = []
  for (const r of responses) {
    const m = r.text.match(/^\*\s+SEARCH\b(.*)$/i)
    if (m) for (const n of m[1].trim().split(/\s+/).filter(Boolean)) out.push(Number(n))
  }
  return out.filter((n) => Number.isInteger(n) && n > 0)
}

function decodeCharset(bytes, charset) {
  const label = String(charset || 'utf-8').trim().replace(/^"|"$/g, '').toLowerCase()
  try {
    return new TextDecoder(label).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

function base64Bytes(s) {
  const clean = String(s).replace(/[^A-Za-z0-9+/=]/g, '')
  try {
    const bin = atob(clean)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array(0)
  }
}

function quotedPrintableBytes(s, { header = false } = {}) {
  let str = String(s)
  if (header) str = str.replace(/_/g, ' ')
  else str = str.replace(/=\r?\n/g, '')
  const out = []
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(str.slice(i + 1, i + 3))) {
      out.push(parseInt(str.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      const code = str.charCodeAt(i)
      if (code < 256) out.push(code)
      else out.push(...ENC.encode(c))
    }
  }
  return new Uint8Array(out)
}

/** Decode RFC 2047 encoded words: "=?UTF-8?B?...?=" and "=?iso-8859-1?Q?...?=". */
export function decodeHeaderValue(value) {
  return String(value || '')
    // Whitespace between two adjacent encoded words is not part of the text (RFC 2047 §6.2).
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, '$1')
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, charset, enc, data) => {
      const bytes = enc.toUpperCase() === 'B' ? base64Bytes(data) : quotedPrintableBytes(data, { header: true })
      return decodeCharset(bytes, charset.split('*')[0])
    })
}

/** Split a raw header block into a map of lower-cased name → decoded value (first one wins). */
export function parseHeaders(headerText) {
  const unfolded = String(headerText || '').replace(/\r?\n[ \t]+/g, ' ')
  const out = {}
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([!-9;-~]+):\s?(.*)$/)
    if (!m) continue
    const name = m[1].toLowerCase()
    if (!(name in out)) out[name] = decodeHeaderValue(m[2].trim())
  }
  return out
}

/** "Name <a@b.no>, c@d.no" → [{ name, address }]. Good enough for display; not a full RFC 5322 parser. */
export function parseAddressList(value) {
  const out = []
  for (const part of String(value || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const p = part.trim()
    if (!p) continue
    const m = p.match(/^(.*)<([^>]+)>\s*$/)
    if (m) out.push({ name: m[1].trim().replace(/^"|"$/g, '') || null, address: m[2].trim().toLowerCase() })
    else out.push({ name: null, address: p.replace(/^"|"$/g, '').toLowerCase() })
  }
  return out
}

function headerParam(value, param) {
  const re = new RegExp(`(?:^|;)\\s*${param}\\*?=\\s*("([^"]*)"|[^;\\s]+)`, 'i')
  const m = String(value || '').match(re)
  if (!m) return null
  const v = m[2] !== undefined ? m[2] : m[1]
  // RFC 2231 form: utf-8''Navn%20p%C3%A5%20fil.pdf
  const ext = v.match(/^([^']*)'[^']*'(.*)$/)
  if (ext) {
    try { return decodeURIComponent(ext[2]) } catch { return ext[2] }
  }
  return decodeHeaderValue(v)
}

function splitHeadBody(bytes) {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) {
      return { head: bytes.subarray(0, i), body: bytes.subarray(i + 4) }
    }
  }
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 10 && bytes[i + 1] === 10) return { head: bytes.subarray(0, i), body: bytes.subarray(i + 2) }
  }
  return { head: bytes, body: new Uint8Array(0) }
}

/** Strip HTML to readable text. For a model to read, not for display. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Read a raw RFC 5322 message into what a person would see: headers, the text, and a list of
 * attachments (names and sizes only — their bytes are never returned).
 *
 * Prefers text/plain; falls back to text/html converted to text. Handles nested multipart,
 * base64 and quoted-printable, and the common charsets TextDecoder knows.
 */
export function parseMessage(rawBytes, { depth = 0 } = {}) {
  const bytes = rawBytes instanceof Uint8Array ? rawBytes : ENC.encode(String(rawBytes || ''))
  const { head, body } = splitHeadBody(bytes)
  const headers = parseHeaders(new TextDecoder('latin1').decode(head))
  const result = { headers, text: '', html: '', attachments: [] }
  walkPart(headers, body, result, depth)
  if (!result.text && result.html) result.text = htmlToText(result.html)
  return result
}

function walkPart(headers, body, result, depth) {
  const ctype = headers['content-type'] || 'text/plain; charset=us-ascii'
  const type = ctype.split(';')[0].trim().toLowerCase()
  const disposition = (headers['content-disposition'] || '').toLowerCase()
  const cte = (headers['content-transfer-encoding'] || '7bit').trim().toLowerCase()

  if (type.startsWith('multipart/') && depth < 8) {
    const boundary = headerParam(ctype, 'boundary')
    if (!boundary) return
    const latin = new TextDecoder('latin1').decode(body)
    const parts = latin.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n?`))
    // The first piece is the preamble and the last the epilogue; both carry no content.
    for (const piece of parts.slice(1, -1)) {
      const pieceBytes = new Uint8Array([...piece].map((c) => c.charCodeAt(0) & 0xff))
      const { head, body: pb } = splitHeadBody(pieceBytes)
      walkPart(parseHeaders(new TextDecoder('latin1').decode(head)), pb, result, depth + 1)
    }
    return
  }

  const raw = new TextDecoder('latin1').decode(body)
  const decoded = cte === 'base64' ? base64Bytes(raw) : cte === 'quoted-printable' ? quotedPrintableBytes(raw) : body
  const filename = headerParam(headers['content-disposition'], 'filename') || headerParam(ctype, 'name')
  const isAttachment = disposition.startsWith('attachment') || (filename && !type.startsWith('text/'))

  if (isAttachment || !(type === 'text/plain' || type === 'text/html' || type === 'message/rfc822')) {
    result.attachments.push({ filename: filename || '(uten navn)', mimeType: type, sizeBytes: decoded.length })
    return
  }
  if (type === 'message/rfc822') {
    result.attachments.push({ filename: filename || 'videresendt e-post', mimeType: type, sizeBytes: decoded.length })
    return
  }
  const text = decodeCharset(decoded, headerParam(ctype, 'charset'))
  if (type === 'text/plain' && !result.text) result.text = text.replace(/\r\n/g, '\n')
  else if (type === 'text/html' && !result.html) result.html = text
}
