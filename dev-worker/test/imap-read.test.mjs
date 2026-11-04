// imap-protocol.js — the pure half of reading a mailbox: literals, headers and MIME.
//
// A FETCH answer carries the message as a literal: "{n}" then exactly n BYTES, which may contain
// CRLFs and non-UTF-8 text. Splitting on lines, or counting characters instead of bytes, corrupts
// the message without failing. These tests feed captured-shape server answers in awkward chunks.
//
// Run:  node --test test/imap-read.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  concatBytes, takeResponse, parseFetchResponse, parseSearch, decodeHeaderValue, parseHeaders,
  parseAddressList, parseMessage, htmlToText,
} from '../imap-protocol.js'

const enc = (s) => new TextEncoder().encode(s)
const latin = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff))

function takeAll(bytes) {
  const out = []
  let buf = bytes
  let t
  while ((t = takeResponse(buf))) { out.push(t.response); buf = t.rest }
  return { out, rest: buf }
}

// ── Literals ────────────────────────────────────────────────────────────────

test('a literal is taken by BYTE count, including the CRLFs inside it', () => {
  const body = 'Subject: Hei\r\nFrom: Ingrid <i@x.no>\r\n\r\n'
  const n = enc(body).length
  const wire = enc(`* 1 FETCH (UID 7 BODY[HEADER] {${n}}\r\n${body})\r\nr3 OK done\r\n`)
  const { out } = takeAll(wire)
  assert.equal(out.length, 2)
  assert.match(out[0].text, /UID 7 BODY\[HEADER\] \{#0\}\)$/)
  assert.equal(new TextDecoder().decode(out[0].literals[0]), body)
  assert.equal(out[1].text, 'r3 OK done')
})

test('multi-byte characters count as bytes, not characters', () => {
  const body = 'Subject: Søknad – Ærlig\r\n\r\n'
  assert.notEqual(body.length, enc(body).length, 'the fixture must actually contain multi-byte text')
  const wire = enc(`* 2 FETCH (UID 9 BODY[] {${enc(body).length}}\r\n${body})\r\n`)
  const { out } = takeAll(wire)
  assert.equal(new TextDecoder().decode(out[0].literals[0]), body)
})

test('an incomplete response waits for more bytes instead of guessing', () => {
  const body = 'x'.repeat(40)
  const full = enc(`* 1 FETCH (UID 1 BODY[] {40}\r\n${body})\r\nr1 OK\r\n`)
  for (const cut of [5, 25, 40, 71]) {
    assert.equal(takeResponse(full.subarray(0, cut))?.response.text.startsWith('*') ? 'took' : 'waited', 'waited', `cut at ${cut}`)
  }
  // Fed in arbitrary chunks, the result is identical.
  let buf = new Uint8Array(0)
  const got = []
  for (let i = 0; i < full.length; i += 7) {
    buf = concatBytes(buf, full.subarray(i, i + 7))
    let t
    while ((t = takeResponse(buf))) { got.push(t.response); buf = t.rest }
  }
  assert.equal(got.length, 2)
  assert.equal(new TextDecoder().decode(got[0].literals[0]), body)
})

test('a FETCH response yields uid, flags, size, date and the literal', () => {
  const body = 'Subject: Test\r\n\r\n'
  const wire = enc(`* 3 FETCH (UID 42 FLAGS (\\Seen \\Answered) INTERNALDATE "04-Nov-2026 07:12:00 +0100" RFC822.SIZE 1234 BODY[HEADER.FIELDS (FROM SUBJECT)] {${body.length}}\r\n${body})\r\n`)
  const f = parseFetchResponse(takeAll(wire).out[0])
  assert.equal(f.uid, 42)
  assert.deepEqual(f.flags, ['\\Seen', '\\Answered'])
  assert.equal(f.size, 1234)
  assert.equal(f.internalDate, '04-Nov-2026 07:12:00 +0100')
  assert.equal(new TextDecoder().decode(f.body), body)
})

test('a partial-body fetch <0.n> is still found', () => {
  const wire = enc('* 3 FETCH (UID 5 RFC822.SIZE 10 BODY[]<0> {2}\r\nab)\r\n')
  assert.equal(new TextDecoder().decode(parseFetchResponse(takeAll(wire).out[0]).body), 'ab')
})

test('SEARCH results are read as numbers, across lines, and an empty search is empty', () => {
  const { out } = takeAll(enc('* SEARCH 3 17 200\r\n* SEARCH\r\nr2 OK\r\n'))
  assert.deepEqual(parseSearch(out), [3, 17, 200])
})

// ── Headers ─────────────────────────────────────────────────────────────────

test('encoded words are decoded in both B and Q forms, and adjacent words join', () => {
  assert.equal(decodeHeaderValue('=?UTF-8?B?U8O4a25hZA==?='), 'Søknad')
  assert.equal(decodeHeaderValue('=?iso-8859-1?Q?M=F8te_om_=F8konomi?='), 'Møte om økonomi')
  assert.equal(decodeHeaderValue('=?UTF-8?Q?Hei_?= =?UTF-8?Q?Ingrid?='), 'Hei Ingrid')
  assert.equal(decodeHeaderValue('Plain subject'), 'Plain subject')
})

test('folded headers are unfolded and names are case-insensitive', () => {
  const h = parseHeaders('SUBJECT: Re: Møte\r\n om tid\r\nfrom: "Meyer, Ingrid" <Ingrid.Synnove.Meyer@gmail.com>\r\n')
  assert.equal(h.subject, 'Re: Møte om tid')
  assert.deepEqual(parseAddressList(h.from), [{ name: 'Meyer, Ingrid', address: 'ingrid.synnove.meyer@gmail.com' }])
})

test('an address list keeps a comma inside a quoted name', () => {
  assert.deepEqual(
    parseAddressList('"Håve, Tor Arne" <post@nibi.no>, giulia@example.com').map((a) => a.address),
    ['post@nibi.no', 'giulia@example.com'],
  )
})

// ── MIME ────────────────────────────────────────────────────────────────────

test('a plain message gives its text, with the charset honoured', () => {
  const raw = latin('Subject: Hei\r\nContent-Type: text/plain; charset=iso-8859-1\r\n\r\nM\xf8tet passer fint.\r\n')
  const m = parseMessage(raw)
  assert.equal(m.headers.subject, 'Hei')
  assert.equal(m.text.trim(), 'Møtet passer fint.')
})

test('multipart/alternative prefers text/plain, decodes quoted-printable', () => {
  const raw = enc([
    'Subject: Svar',
    'Content-Type: multipart/alternative; boundary="b1"',
    '',
    '--b1',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    'Tirsdag kl. 18 passer for meg. Hilsen Giulia =C3=A6=C3=B8=C3=A5 og en lang lin=',
    'je.',
    '--b1',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<p>Tirsdag kl. 18</p>',
    '--b1--',
    '',
  ].join('\r\n'))
  const m = parseMessage(raw)
  assert.match(m.text, /Tirsdag kl\. 18 passer for meg\. Hilsen Giulia æøå og en lang linje\./)
  assert.deepEqual(m.attachments, [])
})

test('an HTML-only message is converted to readable text', () => {
  const raw = enc('Content-Type: text/html; charset=utf-8\r\n\r\n<html><head><style>p{}</style></head><body><p>Hei &amp; takk</p><p>Linje 2</p></body></html>')
  assert.equal(parseMessage(raw).text, 'Hei & takk\nLinje 2')
})

test('attachments are listed by name, type and size — and their bytes are not returned', () => {
  const pdf = btoa('%PDF-1.4 fake')
  const raw = enc([
    'Content-Type: multipart/mixed; boundary=XYZ',
    '',
    '--XYZ',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa('Se vedlegg.'),
    '--XYZ',
    'Content-Type: application/pdf; name="kvittering.pdf"',
    'Content-Disposition: attachment; filename="kvittering.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    pdf,
    '--XYZ--',
  ].join('\r\n'))
  const m = parseMessage(raw)
  assert.equal(m.text.trim(), 'Se vedlegg.')
  assert.deepEqual(m.attachments, [{ filename: 'kvittering.pdf', mimeType: 'application/pdf', sizeBytes: 13 }])
  assert.equal(JSON.stringify(m).includes('PDF-1.4'), false, 'attachment content never leaves the parser')
})

test('nested multipart (mixed → alternative) still finds the text', () => {
  const raw = enc([
    'Content-Type: multipart/mixed; boundary="outer"',
    '',
    '--outer',
    'Content-Type: multipart/alternative; boundary="inner"',
    '',
    '--inner',
    'Content-Type: text/plain',
    '',
    'Inne i inne.',
    '--inner--',
    '--outer--',
  ].join('\r\n'))
  assert.equal(parseMessage(raw).text.trim(), 'Inne i inne.')
})

test('an RFC 2231 filename is decoded', () => {
  const raw = enc([
    'Content-Type: multipart/mixed; boundary=B',
    '',
    '--B',
    "Content-Type: application/pdf; name*=utf-8''Protokoll%20%C3%A5rsm%C3%B8te.pdf",
    'Content-Disposition: attachment',
    '',
    'x',
    '--B--',
  ].join('\r\n'))
  assert.equal(parseMessage(raw).attachments[0].filename, 'Protokoll årsmøte.pdf')
})

test('htmlToText removes scripts and keeps line structure', () => {
  assert.equal(htmlToText('<script>alert(1)</script><div>A</div><ul><li>en</li><li>to</li></ul>'), 'A\n• en\n• to')
})
