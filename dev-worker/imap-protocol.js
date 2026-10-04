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
/** An RFC 5322 message for the Sent copy. Single part — the body is HTML. */
export function buildRfc822({ fromEmail, fromName, toEmail, subject, html, messageId }) {
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(String(s || ''))))
  const enc = (s) => (/^[\x20-\x7E]*$/.test(String(s || '')) ? String(s || '') : `=?UTF-8?B?${b64(s)}?=`)
  const from = fromName ? `${enc(fromName)} <${fromEmail}>` : fromEmail
  return [
    `Date: ${new Date().toUTCString()}`,
    `From: ${from}`,
    `To: ${toEmail}`,
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
