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
 * Which bot speaks for this group?
 *
 * Exactly one active bot → that one. Several → refuse and name them, so the model can ask
 * rather than guess. None → say so plainly; a bot has to be added to the group first, which is
 * a deliberate act by a human in the chat UI.
 */
export async function resolveGroupBot(env, groupId, requestedBotId = null) {
  const rows = await env.CHAT_DB.prepare(`
    SELECT b.id, b.name, b.username
    FROM group_bot_members m
    JOIN chat_bots b ON b.id = m.bot_id
    WHERE m.group_id = ? AND b.is_active = 1
    ORDER BY b.name
  `)
    .bind(groupId)
    .all()

  const bots = rows.results || []
  if (bots.length === 0) {
    return fail(
      ERR.INVALID_INPUT,
      `No active bot is a member of group ${groupId}. Add one to the group in the chat app first — a bot is what actually posts the message.`,
      { groupId },
    )
  }

  if (requestedBotId) {
    const match = bots.find((b) => b.id === requestedBotId)
    if (!match) {
      return fail(ERR.INVALID_INPUT, `Bot ${requestedBotId} is not an active member of group ${groupId}.`, {
        availableBots: bots.map((b) => ({ id: b.id, name: b.name })),
      })
    }
    return { ok: true, bot: match }
  }

  if (bots.length > 1) {
    return fail(
      ERR.INVALID_INPUT,
      `Group ${groupId} has ${bots.length} bots. Pass botId to choose which one posts.`,
      { availableBots: bots.map((b) => ({ id: b.id, name: b.name, username: b.username })) },
    )
  }

  return { ok: true, bot: bots[0] }
}

/**
 * The attribution line appended to every message.
 *
 * Not configurable by the caller: a model that could choose its own signature could choose to
 * have none, and the whole point is that a reader can tell where the message came from.
 */
function attribution(actor) {
  const who = actor.email || actor.userId || 'en VEGR.AI-bruker'
  return `\n\n— skrevet av en AI-assistent på vegne av ${who}`
}

/**
 * Post a message into a group.
 *
 * Returns a structured result; never a Response. Posts through group-chat-worker's /bot-message,
 * which does its own checks on top of ours: the bot must be a group member and active, and the
 * message type is whitelisted.
 */
export async function postChatMessage(env, { groupId, text, botId = null, actor }) {
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

  const resolved = await resolveGroupBot(env, groupId, botId)
  if (!resolved.ok) return resolved

  const message = body + attribution(actor)

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

export const CHAT_LIMITS = { MAX_MESSAGE_LENGTH }
