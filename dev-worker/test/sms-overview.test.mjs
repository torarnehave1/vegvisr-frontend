// sms_overview (7 Nov 2026): sent SMS + forwarded replies + ContactHub names, per person.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers } from './d1-adapter.mjs'
import { smsOverview, parseSmsReplyEmail } from '../sms-service.js'
import { callToolForFlow } from '../flow-tools.js'

const ALICE = { email: 'alice@example.com', userId: 'u-alice' }
const now = Math.floor(Date.now() / 1000)

function gateway(rows) {
  const calls = []
  return {
    calls,
    fetch: async (url) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ success: true, data: { current_page: 1, last_page: 1, total: rows.length, data: rows } }), { status: 200 })
    },
  }
}
const SENT = [
  { date: now - 86400, to: '+4799567770', from: 'TorArne', body: 'Hei Merete, her er info', status_text: 'Delivered' },
  { date: now - 3600, to: '+4795256324', from: 'TorArne', body: 'Velkommen til Stillerom i kveld', status_text: 'Delivered' },
  { date: now - 7200, to: '+4790000009', from: 'Vegvisr', body: 'Din innloggingskode er 1234', status_text: 'Delivered' },
]
const REPLY = "You've received a reply from +4799567770:\nTakk! Send meg gjerne info :) Merete\n\n--------------------------------------------------------------------------------\n\nOriginal Message on Thu, Nov 5, 2026 10:30 PM:\nHei Merete, her er info\n\nVarm hilsen\nTor Arne — ClickSend.com"
const mail = {
  listInbox: async (_env, { address }) => ({ ok: true, address, messages: [
    { uid: 7, from: '+4799567770@sms.clicksend.com', subject: 'SMS reply from +4799567770', date: new Date().toUTCString() },
    { uid: 6, from: 'no-reply@accounts.google.com', subject: 'Security alert', date: new Date().toUTCString() },
  ] }),
  readInboxEmail: async (_env, { uid }) => ({ ok: true, uid, text: REPLY }),
}
const contacts = {
  searchContacts: async (_env, { query }) => ({ ok: true, contacts: query === '99567770' ? [{ name: 'Merete', phones: ['+47 995 67 770'] }] : [] }),
}

test('a ClickSend reply e-mail splits into the reply and the quoted original', () => {
  const p = parseSmsReplyEmail(REPLY)
  assert.equal(p.reply, 'Takk! Send meg gjerne info :) Merete')
  assert.match(p.original, /^Hei Merete, her er info/)
  assert.doesNotMatch(p.original, /ClickSend\.com/)
  assert.equal(p.originalSentOn, 'Thu, Nov 5, 2026 10:30 PM')
})

test('per person: what was sent, what came back, names from ContactHub, login codes left out', async () => {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.SMS_GATEWAY = gateway(SENT)
  const r = await smsOverview(env, { actor: ALICE, days: 7, repliesMailbox: 'slowyou.net@gmail.com', mail, contacts })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(r.counts.sent, 2, 'the login code is not part of the overview')
  assert.equal(r.counts.replies, 1, 'only SMS replies, not the other mail')
  const merete = r.conversations.find((c) => c.number === '+4799567770')
  assert.equal(merete.name, 'Merete')
  assert.equal(merete.answered, true)
  assert.equal(merete.replies[0].text, 'Takk! Send meg gjerne info :) Merete')
  const other = r.conversations.find((c) => c.number === '+4795256324')
  assert.equal(other.answered, false)
  assert.equal(other.name, null)
  assert.ok(!r.conversations.some((c) => c.number === '+4790000009'))
})

test('without a replies mailbox it still shows what was sent, and says why there are no replies', async () => {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.SMS_GATEWAY = gateway(SENT)
  const r = await smsOverview(env, { actor: ALICE, days: 3, mail, contacts })
  assert.equal(r.ok, true)
  assert.equal(r.counts.replies, 0)
  assert.match(r.warnings.join(' '), /No repliesMailbox/)
})

test('a flow may run sms_overview (chat:read is lent for that read) but not send an SMS', async () => {
  const { env, raw } = freshDb()
  seedUsers(raw)
  env.SMS_GATEWAY = gateway(SENT)
  const r = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'sms_overview', args: { days: 7 } })
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.doesNotMatch(r.text || '', /requires the .* scope/)
  const s = await callToolForFlow(env, { email: 'alice@example.com', toolName: 'send_sms', args: { to: '+4799567770', message: 'x' } })
  assert.equal(s.status, 403)
})
