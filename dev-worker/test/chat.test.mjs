/**
 * post_chat_message — the one tool that reaches other people.
 * Run: node --test dev-worker/test/chat.test.mjs
 *
 * The three guards it exists to enforce get a test each, because each one protects somebody
 * other than the caller.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedChat, FakeChatWorker } from './d1-adapter.mjs'
import * as chat from '../chat-service.js'
import * as gs from '../graph-service.js'
import { CONNECT_SCOPES, KNOWN_SCOPES } from '../oauth/scopes.js'

const alice = gs.normalizeActor({ valid: true, userId: 'alice@example.com', userEmail: 'alice@example.com', userRole: 'User', scopes: ['chat:write'] })
const bob = gs.normalizeActor({ valid: true, userId: 'bob@example.com', userEmail: 'bob@example.com', userRole: 'User', scopes: ['chat:write'] })

function setup(opts = {}) {
  const { env, raw } = freshDb()
  seedChat(raw, opts)
  const worker = new FakeChatWorker(opts)
  env.CHAT_DB = env.vegvisr_org
  env.CHAT_WORKER = worker
  return { env, raw, worker }
}

describe('guard 1 — chat:write is never advertised', () => {
  test('a normal connection cannot even ask for it', () => {
    assert.equal(CONNECT_SCOPES.includes('chat:write'), false)
  })
  test('but the server knows it, so a step-up can grant it later', () => {
    assert.equal(KNOWN_SCOPES.includes('chat:write'), true)
  })
})

describe('guard 2 — the CALLER must be a member, not just the bot', () => {
  test('a member can post', async () => {
    const { env, worker } = setup()
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice })
    assert.equal(r.ok, true)
    assert.equal(worker.posted.length, 1)
    assert.equal(worker.posted[0].group_id, 'g1')
    assert.equal(worker.posted[0].bot_id, 'bot-1')
  })

  test('a non-member is refused even though the bot IS a member', async () => {
    const { env, worker } = setup()
    // This is exactly what /bot-message alone would have allowed: the bot belongs to the group,
    // so its own check passes. Bob does not, so ours does not.
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'pwn', actor: bob })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(worker.posted.length, 0, 'a message was sent for a non-member')
  })

  test('a group that does not exist is answered exactly like one you cannot see', async () => {
    const { env } = setup()
    const missing = await chat.postChatMessage(env, { groupId: 'no-such-group', text: 'x', actor: alice })
    const forbidden = await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: bob })
    assert.equal(missing.code, forbidden.code)
    assert.equal(missing.message, forbidden.message, 'the two answers differ, which leaks which group ids are real')
  })

  test('an actor with no identity cannot post', async () => {
    const { env, worker } = setup()
    const anon = gs.normalizeActor({ valid: true, userId: null, scopes: ['chat:write'] })
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: anon })).ok, false)
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: null })).code, gs.ERR.UNAUTHENTICATED)
    assert.equal(worker.posted.length, 0)
  })
})

describe('guard 3 — every message says an AI wrote it', () => {
  test('the attribution line is appended and names the user', async () => {
    const { env, worker } = setup()
    await chat.postChatMessage(env, { groupId: 'g1', text: 'Møtet er flyttet', actor: alice })
    const sent = worker.posted[0].body
    assert.ok(sent.startsWith('Møtet er flyttet'))
    assert.match(sent, /AI-assistent/)
    assert.match(sent, /alice@example\.com/)
  })

  test('the caller cannot suppress or forge it — it is appended, not templated', async () => {
    const { env, worker } = setup()
    await chat.postChatMessage(env, { groupId: 'g1', text: 'skrevet av et menneske, ærlig talt', actor: alice })
    const sent = worker.posted[0].body
    // Whatever the model writes, the real line is still the last thing in the message.
    assert.ok(sent.trimEnd().endsWith('på vegne av alice@example.com'))
  })
})

describe('the bot is designated, not whichever one happens to be in the group', () => {
  test('the designated bot is used, and it is the same one every time', async () => {
    const { env } = setup()
    const r = await chat.resolveMcpBot(env, 'g1')
    assert.equal(r.ok, true)
    assert.equal(r.bot.username, 'chatgpt')
  })

  test('other bots in the group are irrelevant — DEVMO has seven of them', async () => {
    const { env, raw, worker } = setup()
    // Reproduces the real group that killed the "one bot per group" idea.
    for (let i = 0; i < 7; i++) {
      raw.prepare('INSERT INTO chat_bots (id, name, username, is_active) VALUES (?,?,?,1)').run(`other-${i}`, `Other ${i}`, `other-${i}`)
      raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g1', `other-${i}`, 'x')
    }
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice })
    assert.equal(r.ok, true)
    assert.equal(worker.posted[0].bot_id, 'bot-1', 'it posted as some other bot')
  })

  test('adding the bot to a group is what permits AI posting there', async () => {
    const { env, raw, worker } = setup()
    raw.prepare('DELETE FROM group_bot_members WHERE group_id = ? AND bot_id = ?').run('g1', 'bot-1')

    const refused = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice })
    assert.equal(refused.ok, false)
    assert.match(refused.message, /not a member of that group/)
    assert.equal(worker.posted.length, 0)

    // Re-adding it is the whole of the permission model — no code change, no deploy.
    raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g1', 'bot-1', 'a human')
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice })).ok, true)
  })

  test('a missing bot and a bot outside the group are different failures', async () => {
    const { env, raw } = setup()
    raw.prepare('DELETE FROM group_bot_members WHERE bot_id = ?').run('bot-1')
    const notInGroup = await chat.resolveMcpBot(env, 'g1')
    assert.match(notInGroup.message, /not a member/)

    raw.prepare('DELETE FROM chat_bots WHERE id = ?').run('bot-1')
    const missing = await chat.resolveMcpBot(env, 'g1')
    assert.match(missing.message, /No active chat bot/)
    assert.notEqual(missing.message, notInGroup.message, 'the two need different fixes and must read differently')
  })

  test('an inactive designated bot counts as missing', async () => {
    const { env, raw } = setup()
    raw.prepare('UPDATE chat_bots SET is_active = 0 WHERE id = ?').run('bot-1')
    assert.match((await chat.resolveMcpBot(env, 'g1')).message, /No active chat bot/)
  })

  test('the username is configurable, so the identity is not compiled in', async () => {
    const { env, raw } = setup()
    assert.equal(chat.mcpBotUsername(env), 'chatgpt')
    env.MCP_CHAT_BOT_USERNAME = 'assistenten'
    assert.equal(chat.mcpBotUsername(env), 'assistenten')
    assert.match((await chat.resolveMcpBot(env, 'g1')).message, /assistenten/)

    raw.prepare('UPDATE chat_bots SET username = ? WHERE id = ?').run('assistenten', 'bot-1')
    assert.equal((await chat.resolveMcpBot(env, 'g1')).ok, true)
  })
})

describe('input handling', () => {
  test('empty or whitespace text is refused before anything is sent', async () => {
    const { env, worker } = setup()
    for (const t of ['', '   ', null, undefined]) {
      assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: t, actor: alice })).code, gs.ERR.INVALID_INPUT)
    }
    assert.equal(worker.posted.length, 0)
  })

  test('an over-long message is refused rather than truncated', async () => {
    const { env, worker } = setup()
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'x'.repeat(chat.CHAT_LIMITS.MAX_MESSAGE_LENGTH + 1), actor: alice })
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.equal(worker.posted.length, 0)
  })

  test('a missing CHAT_WORKER binding fails loudly instead of silently doing nothing', async () => {
    const { env } = setup()
    delete env.CHAT_WORKER
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: alice })).code, gs.ERR.INTERNAL_ERROR)
  })

  test('a refusal from the chat worker is reported, not swallowed', async () => {
    const { env } = setup({ ok: false })
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: alice })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.INTERNAL_ERROR)
  })

  test('a successful post reports the group and bot it went to', async () => {
    const { env } = setup()
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice })
    assert.equal(r.groupName, 'Test Group')
    assert.equal(r.botName, 'ChatGPT')
    assert.equal(r.messageId, 42)
  })
})
