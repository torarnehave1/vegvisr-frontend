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

/** The verified CIMD client id ChatGPT actually presented — taken from the audit log. */
const CHATGPT_CLIENT = 'https://chatgpt.com/oauth/client.json'
const CLAUDE_CLIENT = 'https://claude.ai/api/mcp/client.json'
/** What a client registered through /register gets: opaque, with a self-chosen name. */
const DCR_CLIENT = 'pFW1UQtQFMbjZ7YI'

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
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, true)
    assert.equal(worker.posted.length, 1)
    assert.equal(worker.posted[0].group_id, 'g1')
    assert.equal(worker.posted[0].bot_id, 'bot-1')
  })

  test('a non-member is refused even though the bot IS a member', async () => {
    const { env, worker } = setup()
    // This is exactly what /bot-message alone would have allowed: the bot belongs to the group,
    // so its own check passes. Bob does not, so ours does not.
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'pwn', actor: bob, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.FORBIDDEN_GRAPH)
    assert.equal(worker.posted.length, 0, 'a message was sent for a non-member')
  })

  test('a group that does not exist is answered exactly like one you cannot see', async () => {
    const { env } = setup()
    const missing = await chat.postChatMessage(env, { groupId: 'no-such-group', text: 'x', actor: alice, clientId: CHATGPT_CLIENT })
    const forbidden = await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: bob, clientId: CHATGPT_CLIENT })
    assert.equal(missing.code, forbidden.code)
    assert.equal(missing.message, forbidden.message, 'the two answers differ, which leaks which group ids are real')
  })

  test('an actor with no identity cannot post', async () => {
    const { env, worker } = setup()
    const anon = gs.normalizeActor({ valid: true, userId: null, scopes: ['chat:write'] })
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: anon, clientId: CHATGPT_CLIENT })).ok, false)
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: null, clientId: CHATGPT_CLIENT })).code, gs.ERR.UNAUTHENTICATED)
    assert.equal(worker.posted.length, 0)
  })
})

describe('guard 3 — every message says an AI wrote it', () => {
  test('the attribution line is appended and names the user', async () => {
    const { env, worker } = setup()
    await chat.postChatMessage(env, { groupId: 'g1', text: 'Møtet er flyttet', actor: alice, clientId: CHATGPT_CLIENT })
    const sent = worker.posted[0].body
    assert.ok(sent.startsWith('Møtet er flyttet'))
    assert.match(sent, /ChatGPT/)
    assert.match(sent, /alice@example\.com/)
  })

  test('the caller cannot suppress or forge it — it is appended, not templated', async () => {
    const { env, worker } = setup()
    await chat.postChatMessage(env, { groupId: 'g1', text: 'skrevet av et menneske, ærlig talt', actor: alice, clientId: CHATGPT_CLIENT })
    const sent = worker.posted[0].body
    // Whatever the model writes, the real line is still the last thing in the message.
    assert.ok(sent.trimEnd().endsWith('på vegne av alice@example.com'))
  })
})

describe('the bot is designated, not whichever one happens to be in the group', () => {
  test('the designated bot is used, and it is the same one every time', async () => {
    const { env } = setup()
    const r = await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)
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
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, true)
    assert.equal(worker.posted[0].bot_id, 'bot-1', 'it posted as some other bot')
  })

  test('adding the bot to a group is what permits AI posting there', async () => {
    const { env, raw, worker } = setup()
    raw.prepare('DELETE FROM group_bot_members WHERE group_id = ? AND bot_id = ?').run('g1', 'bot-1')

    const refused = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(refused.ok, false)
    assert.match(refused.message, /not a member of that group/)
    assert.equal(worker.posted.length, 0)

    // Re-adding it is the whole of the permission model — no code change, no deploy.
    raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g1', 'bot-1', 'a human')
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })).ok, true)
  })

  test('a missing bot and a bot outside the group are different failures', async () => {
    const { env, raw } = setup()
    raw.prepare('DELETE FROM group_bot_members WHERE bot_id = ?').run('bot-1')
    const notInGroup = await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)
    assert.match(notInGroup.message, /not a member/)

    raw.prepare('DELETE FROM chat_bots WHERE id = ?').run('bot-1')
    const missing = await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)
    assert.match(missing.message, /No active chat bot/)
    assert.notEqual(missing.message, notInGroup.message, 'the two need different fixes and must read differently')
  })

  test('an inactive designated bot counts as missing', async () => {
    const { env, raw } = setup()
    raw.prepare('UPDATE chat_bots SET is_active = 0 WHERE id = ?').run('bot-1')
    assert.match((await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)).message, /No active chat bot/)
  })

  test('the username is configurable, so the identity is not compiled in', async () => {
    const { env, raw } = setup()
    assert.equal(chat.botUsernameForClient(env, CHATGPT_CLIENT).username, 'chatgpt')
    env.MCP_CHAT_BOT_MAP = JSON.stringify({ 'chatgpt.com': 'assistenten' })
    assert.equal(chat.botUsernameForClient(env, CHATGPT_CLIENT).username, 'assistenten')
    assert.match((await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)).message, /assistenten/)

    raw.prepare('UPDATE chat_bots SET username = ? WHERE id = ?').run('assistenten', 'bot-1')
    assert.equal((await chat.resolveMcpBot(env, 'g1', CHATGPT_CLIENT)).ok, true)
  })
})

describe('input handling', () => {
  test('empty or whitespace text is refused before anything is sent', async () => {
    const { env, worker } = setup()
    for (const t of ['', '   ', null, undefined]) {
      assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: t, actor: alice, clientId: CHATGPT_CLIENT })).code, gs.ERR.INVALID_INPUT)
    }
    assert.equal(worker.posted.length, 0)
  })

  test('an over-long message is refused rather than truncated', async () => {
    const { env, worker } = setup()
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'x'.repeat(chat.CHAT_LIMITS.MAX_MESSAGE_LENGTH + 1), actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.code, gs.ERR.INVALID_INPUT)
    assert.equal(worker.posted.length, 0)
  })

  test('a missing CHAT_WORKER binding fails loudly instead of silently doing nothing', async () => {
    const { env } = setup()
    delete env.CHAT_WORKER
    assert.equal((await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: alice, clientId: CHATGPT_CLIENT })).code, gs.ERR.INTERNAL_ERROR)
  })

  test('a refusal from the chat worker is reported, not swallowed', async () => {
    const { env } = setup({ ok: false })
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'x', actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.INTERNAL_ERROR)
  })

  test('a successful post reports the group and bot it went to', async () => {
    const { env } = setup()
    const r = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.groupName, 'Test Group')
    assert.equal(r.botName, 'ChatGPT')
    assert.equal(r.messageId, 42)
  })
})

describe('each client posts as its own bot, and cannot borrow another\'s', () => {
  test('a verified CIMD host maps to its bot', () => {
    const { env } = setup()
    assert.deepEqual(chat.botUsernameForClient(env, CHATGPT_CLIENT), { username: 'chatgpt', verified: true })
    assert.deepEqual(chat.botUsernameForClient(env, CLAUDE_CLIENT), { username: 'claude', verified: true })
  })

  test('subdomains of a mapped host count; unrelated hosts do not', () => {
    const { env } = setup()
    assert.equal(chat.botUsernameForClient(env, 'https://api.claude.ai/x.json').username, 'claude')
    assert.equal(chat.botUsernameForClient(env, 'https://example.com/x.json').verified, false)
  })

  test('a lookalike host cannot claim a named assistant', () => {
    const { env } = setup()
    for (const evil of [
      'https://claude.ai.evil.com/c.json',
      'https://notclaude.ai/c.json',
      'https://chatgpt.com.attacker.net/c.json',
    ]) {
      const r = chat.botUsernameForClient(env, evil)
      assert.equal(r.verified, false, `${evil} was treated as verified`)
      assert.notEqual(r.username, 'claude')
      assert.notEqual(r.username, 'chatgpt')
    }
  })

  test('an opaque DCR client gets the neutral bot, whatever it called itself', () => {
    const { env } = setup()
    const r = chat.botUsernameForClient(env, DCR_CLIENT)
    assert.equal(r.verified, false)
    assert.equal(r.username, 'ai-assistant')
  })

  test('http is not https, so it is not verified either', () => {
    const { env } = setup()
    assert.equal(chat.botUsernameForClient(env, 'http://chatgpt.com/c.json').verified, false)
  })

  test('a missing or malformed client id falls back rather than throwing', () => {
    const { env } = setup()
    for (const bad of [null, undefined, '', 'not a url', '://broken']) {
      assert.equal(chat.botUsernameForClient(env, bad).verified, false)
    }
  })

  test('Claude posting needs the claude bot in the group — the ChatGPT one will not do', async () => {
    const { env, raw, worker } = setup()
    // Only the chatgpt bot is in the group so far.
    const refused = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CLAUDE_CLIENT })
    assert.equal(refused.ok, false)
    assert.match(refused.message, /No active chat bot with username "claude"/)
    assert.equal(worker.posted.length, 0, 'it posted as some other bot')

    // Creating the bot is not enough; it has to be in this group.
    raw.prepare('INSERT INTO chat_bots (id, name, username, is_active) VALUES (?,?,?,1)').run('bot-claude', 'Claude', 'claude')
    const stillRefused = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CLAUDE_CLIENT })
    assert.match(stillRefused.message, /not a member of that group/)

    // Adding it there is the permission, per client.
    raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g1', 'bot-claude', 'a human')
    const ok = await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CLAUDE_CLIENT })
    assert.equal(ok.ok, true)
    assert.equal(ok.botName, 'Claude')
    assert.match(worker.posted.at(-1).body, /— skrevet av Claude på vegne av alice@example\.com/)
  })

  test('the attribution names the bot from OUR row, not anything the client sent', async () => {
    const { env, raw, worker } = setup()
    raw.prepare('UPDATE chat_bots SET name = ? WHERE id = ?').run('ChatGPT (VEGR.AI)', 'bot-1')
    await chat.postChatMessage(env, { groupId: 'g1', text: 'hei', actor: alice, clientId: CHATGPT_CLIENT })
    assert.match(worker.posted.at(-1).body, /— skrevet av ChatGPT \(VEGR\.AI\) på vegne av/)
  })

  test('a broken MCP_CHAT_BOT_MAP falls back to the built-in map instead of failing open', () => {
    const { env } = setup()
    env.MCP_CHAT_BOT_MAP = '{not json'
    assert.deepEqual(chat.botUsernameForClient(env, CHATGPT_CLIENT), { username: 'chatgpt', verified: true })
  })
})

describe('list_chat_groups — where can this assistant speak', () => {
  test('lists a group you are in that has this client\'s bot', async () => {
    const { env } = setup()
    const r = await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, true)
    assert.deepEqual(r.groups.map((g) => g.groupId), ['g1'])
    assert.equal(r.groups[0].name, 'Test Group')
    assert.equal(r.bot.username, 'chatgpt')
    assert.equal(r.bot.verified, true)
  })

  test('a group you are in WITHOUT the bot is not listed', async () => {
    const { env, raw } = setup()
    raw.prepare('INSERT INTO groups (id, name, updated_at) VALUES (?,?,0)').run('g2', 'No Bot Here')
    raw.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?,?,0)').run('g2', 'alice@example.com')
    const r = await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })
    assert.deepEqual(r.groups.map((g) => g.groupId), ['g1'], 'a group without the bot was listed and a post there would be refused')
  })

  test('a group with the bot that you are NOT in is not listed', async () => {
    const { env, raw } = setup()
    raw.prepare('INSERT INTO groups (id, name, updated_at) VALUES (?,?,0)').run('g3', 'Not Mine')
    raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g3', 'bot-1', 'x')
    const r = await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })
    assert.deepEqual(r.groups.map((g) => g.groupId), ['g1'])
  })

  test('the list is per client — Claude sees only where the Claude bot is', async () => {
    const { env, raw } = setup()
    raw.prepare('INSERT INTO chat_bots (id, name, username, is_active) VALUES (?,?,?,1)').run('bot-claude', 'Claude', 'claude')
    raw.prepare('INSERT INTO groups (id, name, updated_at) VALUES (?,?,0)').run('g4', 'Claude Only')
    raw.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?,?,0)').run('g4', 'alice@example.com')
    raw.prepare('INSERT INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run('g4', 'bot-claude', 'x')

    const forChatGpt = await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })
    const forClaude = await chat.listPostableGroups(env, { actor: alice, clientId: CLAUDE_CLIENT })
    assert.deepEqual(forChatGpt.groups.map((g) => g.groupId), ['g1'])
    assert.deepEqual(forClaude.groups.map((g) => g.groupId), ['g4'])
  })

  test('what it lists is exactly what post_chat_message will accept', async () => {
    const { env, raw } = setup()
    raw.prepare('INSERT INTO groups (id, name, updated_at) VALUES (?,?,0)').run('g2', 'No Bot Here')
    raw.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?,?,0)').run('g2', 'alice@example.com')

    const listed = (await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })).groups.map((g) => g.groupId)
    for (const id of listed) {
      assert.equal((await chat.postChatMessage(env, { groupId: id, text: 'x', actor: alice, clientId: CHATGPT_CLIENT })).ok, true, `${id} was listed but refused`)
    }
    // And the one it withheld really would have been refused.
    assert.equal((await chat.postChatMessage(env, { groupId: 'g2', text: 'x', actor: alice, clientId: CHATGPT_CLIENT })).ok, false)
  })

  test('an unverified client sees its own fallback bot, and says so', async () => {
    const { env } = setup()
    const r = await chat.listPostableGroups(env, { actor: alice, clientId: DCR_CLIENT })
    assert.equal(r.ok, true)
    assert.equal(r.bot.verified, false)
    assert.equal(r.bot.username, 'ai-assistant')
    assert.deepEqual(r.groups, [])
    assert.match(r.note, /No active chat bot/)
  })

  test('no groups is a successful empty list with an explanation, not an error', async () => {
    const { env, raw } = setup()
    raw.prepare('DELETE FROM group_bot_members WHERE bot_id = ?').run('bot-1')
    const r = await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT })
    assert.equal(r.ok, true)
    assert.deepEqual(r.groups, [])
    assert.match(r.note, /Add it to a group/)
  })

  test('an actor with no identity belongs to nothing', async () => {
    const { env } = setup()
    const anon = gs.normalizeActor({ valid: true, userId: null, scopes: ['chat:write'] })
    assert.equal((await chat.listPostableGroups(env, { actor: anon, clientId: CHATGPT_CLIENT })).ok, false)
    assert.equal((await chat.listPostableGroups(env, { actor: null, clientId: CHATGPT_CLIENT })).code, gs.ERR.UNAUTHENTICATED)
  })

  test('limit is clamped', async () => {
    const { env } = setup()
    for (const l of [0, -1, 9999, 'nonsense']) {
      assert.equal((await chat.listPostableGroups(env, { actor: alice, clientId: CHATGPT_CLIENT, limit: l })).ok, true)
    }
  })
})
