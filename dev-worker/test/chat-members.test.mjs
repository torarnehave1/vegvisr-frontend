/**
 * chat-members — who may change who is in a group.
 * Run: node --test dev-worker/test/chat-members.test.mjs
 *
 * These tests exist for one reason. group-chat-worker's `POST /groups/{id}/join` validates the
 * credentials of the person being ADDED and checks nothing about who is asking — not ownership,
 * not membership, only that the group exists. Agent-Builder reaches that endpoint the same way
 * this module does, and it is sound there because every caller of Agent-Builder is already a
 * Superadmin running their own system. An MCP caller is anyone holding a token.
 *
 * So the ownership check is ours, it exists nowhere else on this path, and if it ever silently
 * stops working nothing downstream will complain. That is what most of the file below pins.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedUsers, seedChat } from './d1-adapter.mjs'
import * as members from '../chat-members.js'
import * as gs from '../graph-service.js'

const actorFor = (userId, email = `${userId}@example.com`) =>
  gs.normalizeActor({ valid: true, userId, userEmail: email, userRole: 'User', scopes: ['chat:write'] })

// group_members.user_id holds config.user_id in production, and the OAuth flow puts the same
// value in props.userId — that identity is what lets a member list be joined to display names at
// all. The fixture uses those ids rather than e-mail addresses so the join is exercised for real.
const ALICE = actorFor('u-alice', 'alice@example.com')
const BOB = actorFor('u-bob', 'bob@example.com')
const CAROL = actorFor('u-carol', 'carol@example.com')

/**
 * Records every call rather than only the bodies: a DELETE carries its authorisation in the
 * query string and has no body at all, so a fake that assumed a body would hide half of what
 * these tests are checking.
 */
class RecordingChatWorker {
  constructor(reply = { ok: true, status: 200, body: { success: true } }) {
    this.calls = []
    this.reply = reply
  }
  async fetch(url, init = {}) {
    const method = init.method || 'GET'
    let body = null
    if (init.body) {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }
    this.calls.push({ url, method, body })
    return new Response(JSON.stringify(this.reply.body), { status: this.reply.status })
  }
}

/** A group with alice as owner, bob as admin, carol as an ordinary member. */
function setup(reply) {
  const { env, raw } = freshDb()
  seedUsers(raw)
  seedChat(raw)
  raw.prepare(
    "INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone, display_name) VALUES (?,'{}',?,?,?,?,?)",
  ).run('u-carol', 'carol@example.com', 'sess-carol', 'User', '+4790000003', 'Carol')
  const setRole = raw.prepare(
    'INSERT OR REPLACE INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,?,?)',
  )
  raw.prepare('DELETE FROM group_members WHERE group_id = ?').run('g1')
  setRole.run('g1', 'u-alice', 'owner', 1000)
  setRole.run('g1', 'u-bob', 'admin', 2000)
  setRole.run('g1', 'u-carol', 'member', 3000)

  const worker = new RecordingChatWorker(reply)
  env.CHAT_DB = env.vegvisr_org
  env.CHAT_WORKER = worker
  return { env, raw, worker }
}

describe('the ownership gate that the chat worker does not have', () => {
  test('an ordinary member cannot add anyone, and the chat service is never reached', async () => {
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'nophone@example.com', actor: CAROL })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.match(r.message, /member of that group, and this needs owner or admin/)
    assert.equal(worker.calls.length, 0, 'refused before anything left this worker')
  })

  test('a non-member is refused without learning whether the group exists', async () => {
    const { env } = setup()
    const real = await members.listGroupMembers(env, { groupId: 'g1', actor: actorFor('u-stranger', 'stranger@example.com') })
    const fake = await members.listGroupMembers(env, { groupId: 'no-such-group', actor: actorFor('u-stranger', 'stranger@example.com') })
    assert.equal(real.code, gs.ERR.FORBIDDEN_GRAPH)
    // Identical wording on purpose: a caller outside the group has no business discovering which
    // group ids are real by comparing error messages.
    assert.equal(real.message, fake.message)
  })

  test('an admin may add, an owner may add', async () => {
    for (const actor of [ALICE, BOB]) {
      const { env, worker } = setup()
      const r = await members.addGroupMember(env, { groupId: 'g1', email: 'nophone@example.com', actor })
      // nophone has no number, so this stops one step later — but it got PAST the gate, which is
      // what is being checked here.
      assert.notEqual(r.code, gs.ERR.FORBIDDEN_GRAPH, `${actor.userId} should clear the gate`)
      assert.equal(worker.calls.length, 0)
    }
  })

  test('removal is owner-only: an admin is refused even though they may add', async () => {
    const { env, worker } = setup()
    const asAdmin = await members.removeGroupMember(env, { groupId: 'g1', email: 'carol@example.com', actor: BOB })
    assert.equal(asAdmin.ok, false)
    assert.equal(asAdmin.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.match(asAdmin.message, /admin of that group, and this needs owner/)
    assert.equal(worker.calls.length, 0)

    const asOwner = await members.removeGroupMember(env, { groupId: 'g1', email: 'carol@example.com', actor: ALICE })
    assert.equal(asOwner.ok, true, JSON.stringify(asOwner))
    assert.equal(worker.calls.length, 1)
  })

  test('an invite needs owner or admin, never a plain member', async () => {
    const { env, worker } = setup({ ok: true, status: 201, body: { success: true, invite: { code: 'abc', invite_link: 'https://hallo.vegvisr.org/join/abc', expires_at: 1 } } })
    const refused = await members.createGroupInvite(env, { groupId: 'g1', actor: CAROL })
    assert.equal(refused.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(worker.calls.length, 0)

    const allowed = await members.createGroupInvite(env, { groupId: 'g1', actor: BOB })
    assert.equal(allowed.ok, true, JSON.stringify(allowed))
    assert.equal(allowed.inviteLink, 'https://hallo.vegvisr.org/join/abc')
  })
})

describe('whose credentials go to the chat service', () => {
  test('adding sends the TARGET\'s user_id and phone, because that endpoint is a self-join', async () => {
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'bob@example.com', actor: ALICE })
    // bob is already in the group in this fixture, so use someone who is not.
    assert.equal(r.alreadyMember, true)
    assert.equal(worker.calls.length, 0, 'an existing member needs no call at all')

    const { env: env2, worker: w2 } = setup()
    env2.vegvisr_org
      .prepare("INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone) VALUES (?,'{}',?,?,?,?)")
      .bind('u-dave', 'dave@example.com', 'sess-dave', 'User', '+4790000009')
      .run()
    const added = await members.addGroupMember(env2, { groupId: 'g1', email: 'dave@example.com', role: 'admin', actor: ALICE })
    assert.equal(added.ok, true, JSON.stringify(added))
    assert.equal(w2.calls.length, 1)
    const sent = w2.calls[0]
    assert.match(sent.url, /\/groups\/g1\/join$/)
    assert.equal(sent.body.user_id, 'u-dave', 'the person being added, not the caller')
    assert.equal(sent.body.phone, '+4790000009')
    assert.equal(sent.body.role, 'admin')
  })

  test('removing and inviting send the CALLER\'s credentials, and never a token', async () => {
    const { env, worker } = setup()
    await members.removeGroupMember(env, { groupId: 'g1', email: 'carol@example.com', actor: ALICE })
    const del = worker.calls[0]
    assert.equal(del.method, 'DELETE')
    assert.match(del.url, /\/members\/u-carol\?/, 'the target is in the path')
    assert.match(del.url, /user_id=u-alice/, "the caller's identity authorises it")
    assert.match(del.url, /phone=%2B4790000001/)

    const { env: e2, worker: w2 } = setup({ ok: true, status: 201, body: { success: true, invite: { code: 'x', invite_link: 'l', expires_at: 1 } } })
    await members.createGroupInvite(e2, { groupId: 'g1', actor: ALICE })
    assert.equal(w2.calls[0].body.user_id, 'u-alice')
    assert.equal(w2.calls[0].body.phone, '+4790000001')

    // Nothing anywhere carries an authentication token to the chat service.
    for (const call of [...worker.calls, ...w2.calls]) {
      const blob = JSON.stringify(call)
      assert.ok(!/sess-|emailVerificationToken|Bearer/.test(blob), `a credential leaked: ${blob}`)
    }
  })
})

describe('who can be added at all', () => {
  test('an unregistered address is refused with the reason, before any call', async () => {
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'nobody@example.com', actor: ALICE })
    assert.equal(r.code, gs.ERR.GRAPH_NOT_FOUND)
    assert.match(r.message, /not a registered VEGR\.AI user/)
    assert.equal(worker.calls.length, 0)
  })

  test('a registered person with no phone number is refused HERE, not two services away', async () => {
    // The chat service identifies people by a user_id/phone pair, so an account without a number
    // cannot be added through any surface. Saying so plainly beats a 400 the caller cannot see.
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'nophone@example.com', actor: ALICE })
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.match(r.message, /no phone number/)
    assert.equal(worker.calls.length, 0)
  })

  test('ownership cannot be handed out through the role argument', async () => {
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'dave@example.com', role: 'owner', actor: ALICE })
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.match(r.message, /Ownership is not transferable/)
    assert.equal(worker.calls.length, 0)
  })

  test('adding someone already in the group changes nothing and says so', async () => {
    const { env, worker } = setup()
    const r = await members.addGroupMember(env, { groupId: 'g1', email: 'carol@example.com', actor: ALICE })
    assert.equal(r.ok, true)
    assert.equal(r.alreadyMember, true)
    assert.equal(r.role, 'member', 'their existing role is reported, not the one that was asked for')
    assert.equal(worker.calls.length, 0)
  })
})

describe('what a member list reveals', () => {
  test('an ordinary member sees names and roles, never e-mail addresses', async () => {
    const { env } = setup()
    const r = await members.listGroupMembers(env, { groupId: 'g1', actor: CAROL })
    assert.equal(r.ok, true)
    assert.equal(r.yourRole, 'member')
    assert.equal(r.count, 3)
    for (const m of r.members) {
      assert.equal('email' in m, false, 'an address is never what a member needs')
    }
    assert.ok(!JSON.stringify(r).includes('@example.com'))
  })

  test('an owner or admin sees addresses, because they have to tell two people apart', async () => {
    for (const actor of [ALICE, BOB]) {
      const { env } = setup()
      const r = await members.listGroupMembers(env, { groupId: 'g1', actor })
      const carol = r.members.find((m) => m.userId === 'u-carol')
      assert.equal(carol.email, 'carol@example.com')
      assert.equal(carol.role, 'member')
    }
  })

  test('the list is ordered by when people joined, and reports your own standing', async () => {
    const { env } = setup()
    const r = await members.listGroupMembers(env, { groupId: 'g1', actor: ALICE })
    assert.deepEqual(r.members.map((m) => m.role), ['owner', 'admin', 'member'])
    assert.equal(r.yourRole, 'owner')
  })
})

describe('the invite window', () => {
  test('a requested lifetime is clamped to 1–30 days rather than refused', async () => {
    for (const [asked, expected] of [[0, 1], [7, 7], [30, 30], [365, 30], [null, 7]]) {
      const { env, worker } = setup({ ok: true, status: 201, body: { success: true, invite: { code: 'x', invite_link: 'l', expires_at: 1 } } })
      const r = await members.createGroupInvite(env, { groupId: 'g1', expiresInDays: asked, actor: ALICE })
      assert.equal(r.expiresInDays, expected, `asked ${asked}`)
      assert.equal(worker.calls[0].body.expires_in_days, expected)
    }
  })
})
