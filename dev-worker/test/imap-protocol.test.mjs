// imap-service.js — filing a sent copy in the mailbox it was sent from.
//
// The parts that can be tested without a mail server are the parts most likely to be wrong: which
// folder gets chosen, and whether the message we hand to APPEND is a legal RFC 5322 message. A
// wrong folder name does not fail — Dovecot creates the folder and the copy lands somewhere nobody
// opens — so the choice is pinned here rather than discovered in production.
//
// Run:  node --test test/imap-protocol.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseListLine, chooseSentFolder, buildRfc822, parseKeyName, formatKeyName } from '../imap-protocol.js'

// ── Parsing what the server says ────────────────────────────────────────────

test('a LIST line yields flags, delimiter and name', () => {
  const r = parseListLine('* LIST (\\HasNoChildren \\Sent) "." INBOX.Sent')
  assert.deepEqual(r.flags, ['\\HasNoChildren', '\\Sent'])
  assert.equal(r.delimiter, '.')
  assert.equal(r.name, 'INBOX.Sent')
})

test('a quoted folder name loses its quotes', () => {
  assert.equal(parseListLine('* LIST (\\HasNoChildren) "/" "Sent Items"').name, 'Sent Items')
})

test('a name with a space survives', () => {
  assert.equal(parseListLine('* LIST (\\HasNoChildren) "." Sent Messages').name, 'Sent Messages')
})

test('anything that is not a LIST line is ignored rather than guessed at', () => {
  for (const line of ['a1 OK List completed', '* STATUS INBOX (MESSAGES 3)', '', '* LIST malformed']) {
    assert.equal(parseListLine(line), null, `"${line}" should not parse`)
  }
})

// ── Choosing the Sent folder ────────────────────────────────────────────────
//
// This server advertises no SPECIAL-USE, so it cannot be asked directly. The flag is still checked
// first, because Dovecot often sets it without advertising the extension — and a flag beats a name
// guess every time.

const f = (name, ...flags) => ({ name, flags, delimiter: '.' })

test('the \\Sent flag wins, whatever the folder is called', () => {
  const chosen = chooseSentFolder([f('INBOX'), f('Sendt', '\\Sent'), f('Sent')])
  assert.equal(chosen.name, 'Sendt')
  assert.equal(chosen.how, '\\Sent flag')
})

test('without a flag, the English name is matched', () => {
  const chosen = chooseSentFolder([f('INBOX'), f('Sent'), f('Trash')])
  assert.equal(chosen.name, 'Sent')
  assert.equal(chosen.how, 'name match')
})

test('a Norwegian mailbox with no flag is still found', () => {
  assert.equal(chooseSentFolder([f('INBOX'), f('Sendt'), f('Kladd')]).name, 'Sendt')
})

test('the dotted INBOX.Sent form is found', () => {
  assert.equal(chooseSentFolder([f('INBOX'), f('INBOX.Sent')]).name, 'INBOX.Sent')
})

test('matching ignores case, because servers differ on it', () => {
  assert.equal(chooseSentFolder([f('INBOX'), f('SENT')]).name, 'SENT')
})

// The one that matters. APPEND to a folder that does not exist does not fail — the server creates
// it, and the copy lands where nobody looks. A null answer must stay null so the caller can refuse.
test('no Sent folder yields null, never a guess', () => {
  const chosen = chooseSentFolder([f('INBOX'), f('Drafts'), f('Trash')])
  assert.equal(chosen.name, null)
  assert.equal(chosen.how, 'not found')
})

test('an empty mailbox list yields null', () => {
  assert.equal(chooseSentFolder([]).name, null)
})

// ── Building the message ────────────────────────────────────────────────────

const SAMPLE = {
  fromEmail: 'post@nibi.no',
  fromName: 'NIBI',
  toEmail: 'inger@example.com',
  subject: 'Nytt fra NIBI',
  html: '<p>Hei</p>',
  messageId: '<abc123@nibi.no>',
}

test('the message carries the headers a mail client needs to display it', () => {
  const msg = buildRfc822(SAMPLE)
  for (const h of ['Date:', 'From:', 'To:', 'Subject:', 'MIME-Version: 1.0', 'Content-Type: text/html']) {
    assert.ok(msg.includes(h), `missing ${h}`)
  }
  assert.ok(msg.includes('<abc123@nibi.no>'), 'the Message-ID ties the copy to the delivered mail')
})

test('headers end with CRLF, which is the one thing IMAP will not forgive', () => {
  const msg = buildRfc822(SAMPLE)
  assert.ok(msg.includes('\r\n'), 'lines must be CRLF-terminated')
  assert.equal(/[^\r]\n/.test(msg.split('<p>')[0]), false, 'no bare LF in the headers')
})

test('a blank line separates the headers from the body', () => {
  const msg = buildRfc822(SAMPLE)
  const [headers, body] = msg.split('\r\n\r\n')
  assert.ok(headers.includes('Subject:'))
  assert.equal(body, '<p>Hei</p>')
})

// A raw "Nytt fra NIBI — høsten" in a header is not legal 7-bit and some servers reject the whole
// APPEND for it, which would present as a mysterious failure long after the mail was delivered.
test('non-ASCII in the subject is encoded, ASCII is left readable', () => {
  const encoded = buildRfc822({ ...SAMPLE, subject: 'Nytt fra NIBI — høsten' })
  assert.ok(/Subject: =\?UTF-8\?B\?/.test(encoded), 'a non-ASCII subject must be encoded')
  assert.equal(/Subject: Nytt fra NIBI/.test(buildRfc822(SAMPLE)), true, 'an ASCII subject stays plain')
})

test('a display name with a Norwegian character is encoded, and the address is not', () => {
  const msg = buildRfc822({ ...SAMPLE, fromName: 'Tor Arne Håve' })
  assert.match(msg, /From: =\?UTF-8\?B\?[^?]+\?= <post@nibi\.no>/)
})

test('with no display name the From is the bare address', () => {
  assert.match(buildRfc822({ ...SAMPLE, fromName: null }), /From: post@nibi\.no/)
})

test('with no messageId the header is omitted rather than left empty', () => {
  const msg = buildRfc822({ ...SAMPLE, messageId: null })
  assert.equal(msg.includes('Message-ID:'), false)
  assert.ok(msg.includes('From:'), 'and the rest is intact')
})

test('the body is carried verbatim, including characters a header would have to encode', () => {
  const html = '<p>Hei Tor Arne — hilsen Inger &amp; Maiken</p>'
  assert.ok(buildRfc822({ ...SAMPLE, html }).endsWith(html))
})

// ── Where the connection settings live ──────────────────────────────────────
//
// They ride in user_api_keys.key_name rather than in a new column, because that table is read by
// five other workers and this is one feature. The format has to tolerate the form written before
// the Sent folder was ever measured.

test('the legacy two-field form still parses, with no folder', () => {
  const r = parseKeyName('mail.uniweb.no:993')
  assert.equal(r.hostname, 'mail.uniweb.no')
  assert.equal(r.port, 993)
  assert.equal(r.sentFolder, null, 'a mailbox stored before the probe must still work')
})

test('the three-field form carries the measured folder', () => {
  const r = parseKeyName('mail.uniweb.no:993:INBOX.Sent')
  assert.equal(r.hostname, 'mail.uniweb.no')
  assert.equal(r.port, 993)
  assert.equal(r.sentFolder, 'INBOX.Sent')
})

test('a folder name containing a colon survives the round trip', () => {
  const name = formatKeyName({ hostname: 'mail.example.no', port: 993, sentFolder: 'Odd:Name' })
  assert.equal(parseKeyName(name).sentFolder, 'Odd:Name')
})

test('a missing port falls back to 993 rather than NaN', () => {
  assert.equal(parseKeyName('mail.uniweb.no').port, 993)
  assert.equal(parseKeyName('mail.uniweb.no:abc').port, 993)
})

test('formatting without a folder yields the legacy form', () => {
  assert.equal(formatKeyName({ hostname: 'mail.uniweb.no', port: 993 }), 'mail.uniweb.no:993')
})

test('garbage in gives nulls, not a crash', () => {
  assert.equal(parseKeyName('').hostname, null)
  assert.equal(parseKeyName(null).sentFolder, null)
})
