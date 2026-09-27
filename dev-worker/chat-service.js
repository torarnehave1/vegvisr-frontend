/**
 * chat-service.js — posting into a group chat, for the MCP surface.
 *
 * This is the first thing the MCP server does that reaches OTHER PEOPLE. Every graph tool
 * touches only the caller's own data, where a mistake is private and reversible. A message in a
 * group is neither. Three guards exist because of that, all decided deliberately:
 *
 *   1. It needs the chat:write scope, which is NOT advertised in the discovery document. A
 *      normal connection cannot ask for it, so no client acquires it by default.
 *   2. The CALLER must be a member of the group. group-chat-worker's /bot-message only checks
 *      that the BOT is a member — enough for its original caller (brand-worker delivering a
 *      contact form) but not here: without this check you could have a model post into any
 *      group the bot happens to belong to, including groups you are not in.
 *   3. Every message carries an attribution line. It is posted as `bot:<id>`, so without one a
 *      reader sees a message from a bot with no idea a person's AI client wrote it.
 *
 * The bot is never hard-coded. It is resolved from the group's own membership, so a group
 * decides which bot speaks for it and this module picks nothing on anyone's behalf.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/** Hard cap. Longer than any sensible chat message, short enough not to be an upload channel. */
const MAX_MESSAGE_LENGTH = 4000

/**
 * Is this actor a member of the group?
 *
 * group_members.user_id holds config.user_id, which is exactly what the OAuth flow puts in
 * props.userId — verified against the live database. A user whose config row has no user_id
 * falls back to their e-mail, which will never match here, so they are refused. That is
 * fail-closed and correct: an identity that cannot be matched is not a membership.
 */
export async function isGroupMember(env, groupId, userId) {
  if (!userId) return false
  const row = await env.CHAT_DB.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
  )
    .bind(groupId, userId)
    .first()
  return Boolean(row)
}

/**
 * The bot this tool posts as. Always the same one, never whichever bot happens to be around.
 *
 * An earlier version resolved the bot from the group's own membership: one bot meant use it,
 * several meant ask. Checking a real group killed that idea — DEVMO GROUP has seven bots, so the
 * rule was unusable there, and in a group with exactly one it would have posted as whatever bot
 * was there for some unrelated purpose. Arbitrary identity for a message other people read.
 *
 * So it is one designated bot, configured by username. That makes a group's bot list the access
 * control: ADDING THIS BOT TO A GROUP IS WHAT PERMITS AN AI TO POST THERE. It is a deliberate
 * act by a human in the chat UI, per group, and it is revoked by removing the bot again — no
 * code change, no deploy, no scope juggling.
 */
const DEFAULT_CLIENT_BOT_MAP = {
  'chatgpt.com': 'chatgpt',
  'claude.ai': 'claude',
}

/** Used when the client's identity is not verifiable. Never one of the named assistants. */
const DEFAULT_FALLBACK_BOT_USERNAME = 'ai-assistant'

function clientBotMap(env) {
  if (!env.MCP_CHAT_BOT_MAP) return DEFAULT_CLIENT_BOT_MAP
  try {
    const parsed = JSON.parse(env.MCP_CHAT_BOT_MAP)
    return parsed && typeof parsed === 'object' ? parsed : DEFAULT_CLIENT_BOT_MAP
  } catch {
    console.error('[chat] MCP_CHAT_BOT_MAP is not valid JSON; using the built-in map')
    return DEFAULT_CLIENT_BOT_MAP
  }
}

/**
 * Which bot should THIS client post as?
 *
 * Keyed on the host of the client id, and ONLY when that id is a URL — because then it is a
 * Client ID Metadata Document, which the provider fetched over HTTPS to register the client.
 * The host is therefore verified: nobody can claim `chatgpt.com` without controlling it.
 *
 * A client registered through /register gets an opaque id and a SELF-CHOSEN name. Mapping on
 * that would let anyone register as "Claude" and post under the Claude bot — a lie about who
 * wrote the message, which is the one thing this whole feature exists to prevent. So an
 * unverifiable client falls back to a neutral bot and never borrows a named assistant's identity.
 *
 * Returns { username, verified }.
 */
export function botUsernameForClient(env, clientId) {
  const fallback = String(env.MCP_CHAT_BOT_FALLBACK_USERNAME || DEFAULT_FALLBACK_BOT_USERNAME)
    .trim()
    .toLowerCase()

  let host = null
  try {
    const url = new URL(String(clientId || ''))
    if (url.protocol === 'https:') host = url.hostname.toLowerCase()
  } catch {
    /* not a URL: an opaque DCR client id */
  }
  if (!host) return { username: fallback, verified: false }

  const map = clientBotMap(env)
  for (const [key, username] of Object.entries(map)) {
    const k = String(key).toLowerCase()
    if (host === k || host.endsWith(`.${k}`)) {
      return { username: String(username).toLowerCase(), verified: true }
    }
  }
  return { username: fallback, verified: false }
}

/**
 * Find the designated bot, and confirm it belongs to this group.
 *
 * Two distinct failures, reported distinctly, because they need different fixes: the bot does
 * not exist at all (create it), or it exists but is not in this group (add it there).
 */
export async function resolveMcpBot(env, groupId, clientId = null) {
  const { username, verified } = botUsernameForClient(env, clientId)

  const bot = await env.CHAT_DB.prepare(
    'SELECT id, name, username FROM chat_bots WHERE LOWER(username) = ? AND is_active = 1 LIMIT 1',
  )
    .bind(username)
    .first()

  if (!bot) {
    return fail(
      ERR.INVALID_INPUT,
      `No active chat bot with username "${username}" exists. Create it in the chat app first — it is the identity this client's messages appear under.`,
      { expectedBotUsername: username, clientVerified: verified },
    )
  }

  const member = await env.CHAT_DB.prepare(
    'SELECT 1 FROM group_bot_members WHERE group_id = ? AND bot_id = ? LIMIT 1',
  )
    .bind(groupId, bot.id)
    .first()

  if (!member) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `The "${bot.name}" bot is not a member of that group, so an AI cannot post there. Add it to the group in the chat app to allow it.`,
      { groupId, expectedBotUsername: username },
    )
  }

  return { ok: true, bot, verified }
}

/**
 * The attribution line appended to every message.
 *
 * Not configurable by the caller: a model that could choose its own signature could choose to
 * have none, and the whole point is that a reader can tell where the message came from.
 */
function attribution(actor, bot) {
  const who = actor.email || actor.userId || 'en VEGR.AI-bruker'
  // The assistant is named from OUR database row, never from anything the client sent, so the
  // line cannot be used to claim an identity the client does not have.
  const what = bot?.name || 'en AI-assistent'
  return `\n\n— skrevet av ${what} på vegne av ${who}`
}

/**
 * Post a message into a group, as the designated bot.
 *
 * Returns a structured result; never a Response. Posts through group-chat-worker's /bot-message,
 * which does its own checks on top of ours: the bot must be a group member and active, and the
 * message type is whitelisted.
 */
export async function postChatMessage(env, { groupId, text, actor, clientId = null }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!groupId || !String(groupId).trim()) return fail(ERR.INVALID_INPUT, 'groupId is required.')

  const body = String(text || '').trim()
  if (!body) return fail(ERR.INVALID_INPUT, 'text is required and cannot be empty.')
  if (body.length > MAX_MESSAGE_LENGTH) {
    return fail(ERR.INVALID_INPUT, `text is ${body.length} characters; the limit is ${MAX_MESSAGE_LENGTH}.`)
  }

  if (!env.CHAT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'CHAT_WORKER service binding is not configured on this worker.')
  }

  const group = await env.CHAT_DB.prepare('SELECT id, name FROM groups WHERE id = ? LIMIT 1')
    .bind(groupId)
    .first()
  // A group that does not exist and a group you cannot see are answered identically, so this
  // cannot be used to discover which group ids are real.
  if (!group || !(await isGroupMember(env, groupId, actor.userId))) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      'You are not a member of that group, or it does not exist.',
      { groupId },
    )
  }

  const resolved = await resolveMcpBot(env, groupId, clientId)
  if (!resolved.ok) return resolved

  const message = body + attribution(actor, resolved.bot)

  const res = await env.CHAT_WORKER.fetch('https://group-chat-worker/bot-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: resolved.bot.id,
      group_id: groupId,
      body: message,
      message_type: 'text',
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[chat] bot-message refused, status', res.status)
    return fail(ERR.INTERNAL_ERROR, data.error || `The chat worker refused the message (status ${res.status}).`)
  }

  return {
    ok: true,
    groupId,
    groupName: group.name || null,
    botId: resolved.bot.id,
    botName: resolved.bot.name || null,
    messageId: data.message?.id ?? data.id ?? null,
    characters: message.length,
  }
}

export const CHAT_LIMITS = { MAX_MESSAGE_LENGTH, DEFAULT_CLIENT_BOT_MAP, DEFAULT_FALLBACK_BOT_USERNAME }
