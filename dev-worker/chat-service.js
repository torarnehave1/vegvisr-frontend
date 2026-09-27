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
  'grok.com': 'grok',
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
export function botUsernameForClient(env, clientId, client = null) {
  const fallback = String(env.MCP_CHAT_BOT_FALLBACK_USERNAME || DEFAULT_FALLBACK_BOT_USERNAME)
    .trim()
    .toLowerCase()
  const map = clientBotMap(env)

  const lookup = (host) => {
    for (const [key, username] of Object.entries(map)) {
      const k = String(key).toLowerCase()
      if (host === k || host.endsWith(`.${k}`)) return String(username).toLowerCase()
    }
    return null
  }

  // 1. A client id that is an https URL is a Client ID Metadata Document, which the provider
  //    fetched to register the client. The host is verified by that fetch.
  try {
    const url = new URL(String(clientId || ''))
    if (url.protocol === 'https:') {
      const hit = lookup(url.hostname.toLowerCase())
      if (hit) return { username: hit, verified: true, via: 'cimd' }
      return { username: fallback, verified: false, via: 'cimd-unmapped' }
    }
  } catch {
    /* not a URL: a client registered through /register */
  }

  // 2. Otherwise fall back to the registered redirect URIs — and this is a real signal, not a
  //    claim. The authorization code is delivered to that address, so registering as "Grok"
  //    with a redirect to grok.com sends the code TO grok.com; borrowing someone's redirect
  //    host makes the flow useless to the borrower rather than useful. clientName, by contrast,
  //    is self-asserted and would let anyone call themselves Grok.
  //
  //    EVERY redirect must agree on the host. A client registering one redirect at grok.com and
  //    another at its own address would otherwise be mapped to @grok while receiving codes
  //    itself — which is exactly the attack the CIMD rule exists to prevent.
  const uris = Array.isArray(client?.redirectUris) ? client.redirectUris : []
  if (uris.length) {
    const hosts = new Set()
    for (const uri of uris) {
      try {
        const u = new URL(String(uri))
        if (u.protocol !== 'https:') return { username: fallback, verified: false, via: 'redirect-insecure' }
        hosts.add(u.hostname.toLowerCase())
      } catch {
        return { username: fallback, verified: false, via: 'redirect-unparseable' }
      }
    }
    if (hosts.size === 1) {
      const hit = lookup([...hosts][0])
      if (hit) return { username: hit, verified: true, via: 'redirect' }
    }
  }

  return { username: fallback, verified: false, via: 'unmapped' }
}

/**
 * Find the designated bot, and confirm it belongs to this group.
 *
 * Two distinct failures, reported distinctly, because they need different fixes: the bot does
 * not exist at all (create it), or it exists but is not in this group (add it there).
 */
export async function resolveMcpBot(env, groupId, clientId = null, client = null) {
  const { username, verified } = botUsernameForClient(env, clientId, client)

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
export async function postChatMessage(env, { groupId, text, actor, clientId = null, client = null }) {
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

  const resolved = await resolveMcpBot(env, groupId, clientId, client)
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

/**
 * The groups this caller can actually post in, with this client.
 *
 * Both ChatGPT and Claude had to ask the user for a group id by hand, three times between them,
 * because posting existed without any way to discover where. This closes that — and answers a
 * second question at the same time: since the bot is per client and its membership is the
 * permission, the list IS "where have I let this assistant speak".
 *
 * Read-only, and deliberately narrow: only groups where the caller is a member AND this
 * client's bot is present. A group the user belongs to but has not added the bot to is not
 * listed, because naming it would invite a post that would then be refused.
 */
export async function listPostableGroups(env, { actor, clientId = null, client = null, limit = 50 }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.userId) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it belongs to no groups.')
  }

  const { username, verified } = botUsernameForClient(env, clientId, client)

  const bot = await env.CHAT_DB.prepare(
    'SELECT id, name, username FROM chat_bots WHERE LOWER(username) = ? AND is_active = 1 LIMIT 1',
  )
    .bind(username)
    .first()

  if (!bot) {
    // Not an error: there is simply nowhere this client can post yet, and saying why is more
    // useful than an empty list with no explanation.
    return {
      ok: true,
      groups: [],
      bot: { username, name: null, verified },
      note: `No active chat bot with username "${username}" exists yet, so this client cannot post anywhere. Create it in the chat app, then add it to the groups it should be able to write in.`,
    }
  }

  const lim = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 50, 1), 100)

  const rows = await env.CHAT_DB.prepare(`
    SELECT g.id, g.name,
           (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS members,
           (SELECT COUNT(*) FROM group_messages m WHERE m.group_id = g.id) AS messages
    FROM groups g
    JOIN group_members me ON me.group_id = g.id AND me.user_id = ?
    JOIN group_bot_members gb ON gb.group_id = g.id AND gb.bot_id = ?
    ORDER BY g.name
    LIMIT ?
  `)
    .bind(actor.userId, bot.id, lim)
    .all()

  const groups = (rows.results || []).map((r) => ({
    groupId: r.id,
    name: r.name || null,
    members: r.members ?? 0,
    messages: r.messages ?? 0,
  }))

  return {
    ok: true,
    groups,
    bot: { id: bot.id, name: bot.name, username: bot.username, verified },
    note:
      groups.length === 0
        ? `You are not in any group that has the "${bot.name}" bot. Add it to a group in the chat app to let this assistant post there.`
        : undefined,
  }
}

/**
 * Read messages from a group.
 *
 * THE PRIVACY POSITION, stated once so it is not re-argued per call: this tool does not widen
 * access, it widens PROCESSING. The caller is already a member of the group and already reads
 * these messages in the chat app. What is new is that an AI client reads them too — which is
 * exactly what the separate chat:read consent is for, and why it is a separate consent from
 * chat:write. Someone may well want an assistant that posts announcements but never reads the
 * conversation.
 *
 * Two gates, the same as posting: the caller must be a member, and this client's bot must be in
 * the group. The second matters more here than it does for posting — a group that added the
 * ChatGPT bot has visibly consented to ChatGPT being present. Reading without that visible
 * presence would be surveillance.
 *
 * Display names, never e-mail addresses. A name is what a summary needs; an address never is.
 */
export async function readGroupMessages(env, { groupId, limit = 50, since = null, actor, clientId = null, client = null }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!groupId || !String(groupId).trim()) return fail(ERR.INVALID_INPUT, 'groupId is required.')

  const group = await env.CHAT_DB.prepare('SELECT id, name FROM groups WHERE id = ? LIMIT 1')
    .bind(groupId)
    .first()
  // Same indistinguishable answer as posting: a group that does not exist and one you cannot
  // see read identically, so this cannot enumerate group ids.
  if (!group || !(await isGroupMember(env, groupId, actor.userId))) {
    return fail(ERR.FORBIDDEN_GRAPH, 'You are not a member of that group, or it does not exist.', { groupId })
  }

  const resolved = await resolveMcpBot(env, groupId, clientId, client)
  if (!resolved.ok) return resolved

  const lim = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 50, 1), 200)

  // `since` is an ISO timestamp or a millisecond epoch; anything unparseable reads as no bound
  // rather than silently returning everything from the beginning of time.
  let sinceMs = 0
  if (since) {
    const asNumber = Number(since)
    const parsed = Number.isFinite(asNumber) && asNumber > 0 ? asNumber : Date.parse(String(since))
    if (!Number.isFinite(parsed)) return fail(ERR.INVALID_INPUT, 'since must be an ISO timestamp or a millisecond epoch.')
    sinceMs = parsed
  }

  const rows = await env.CHAT_DB.prepare(`
    SELECT id, user_id, body, created_at, message_type, sender_name
    FROM group_messages
    WHERE group_id = ? AND created_at > ?
    ORDER BY created_at DESC
    LIMIT ?
  `)
    .bind(groupId, sinceMs, lim)
    .all()

  const raw = (rows.results || []).reverse() // oldest first: a conversation reads forwards

  // Resolve human senders to DISPLAY NAMES from the identity database. Never the e-mail, even
  // though it is the primary key sitting right next to it in the same row.
  const humanIds = [...new Set(raw.map((r) => r.user_id).filter((u) => !String(u).startsWith('bot:')))]
  const names = new Map()
  if (humanIds.length) {
    const placeholders = humanIds.map(() => '?').join(',')
    const profiles = await env.vegvisr_org
      .prepare(`SELECT user_id, display_name FROM config WHERE user_id IN (${placeholders})`)
      .bind(...humanIds)
      .all()
    for (const p of profiles.results || []) {
      if (p.display_name) names.set(p.user_id, p.display_name)
    }
  }

  // A participant with no display name becomes a stable pseudonym rather than a raw uuid: the
  // structure of who-said-what survives, the identity does not leak.
  let anon = 0
  const pseudonyms = new Map()
  const nameFor = (userId) => {
    if (String(userId).startsWith('bot:')) return null
    if (names.has(userId)) return names.get(userId)
    if (!pseudonyms.has(userId)) pseudonyms.set(userId, `Deltaker ${++anon}`)
    return pseudonyms.get(userId)
  }

  const messages = raw.map((r) => {
    const isBot = String(r.user_id).startsWith('bot:')
    return {
      id: r.id,
      sender: isBot ? r.sender_name || 'En bot' : nameFor(r.user_id),
      isBot,
      isMine: !isBot && r.user_id === actor.userId,
      text: r.body,
      type: r.message_type || 'text',
      at: new Date(r.created_at).toISOString(),
    }
  })

  return {
    ok: true,
    groupId,
    groupName: group.name || null,
    count: messages.length,
    messages,
  }
}
