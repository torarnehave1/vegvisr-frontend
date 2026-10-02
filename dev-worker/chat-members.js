/**
 * chat-members.js — who is in a chat group, for the MCP surface.
 *
 * THE GUARD THAT ONLY EXISTS HERE
 * -------------------------------
 * group-chat-worker's `POST /groups/{id}/join` validates the user_id/phone pair it is given and
 * then inserts THAT user into the group. It does not check who is asking, and it does not check
 * that the group belongs to them — it only checks that the group exists. Read the handler before
 * changing anything here: it is self-join by design, and the caller's own credentials are the
 * authorisation.
 *
 * Agent-Builder's `add_user_to_chat_group` reaches it by looking the TARGET person up in `config`
 * and sending their credentials. That is sound there, because every caller of Agent-Builder is
 * already a Superadmin operating their own system. It is not sound here: an MCP caller is any
 * person holding an OAuth token, and copying that tool across unchanged would let any connected
 * user add anybody to any group whose id they could guess.
 *
 * So the ownership check that the chat worker does not perform is performed here, before the
 * lookup happens. `requireGroupRole` is the whole reason this module exists rather than the four
 * tools calling the worker directly.
 *
 * READS GO TO THE DATABASE, WRITES GO THROUGH THE WORKER
 * -----------------------------------------------------
 * Listing members is a direct CHAT_DB read — the same thing `isGroupMember` in chat-service.js
 * already does, and it avoids needing the caller's phone number to answer a question we can
 * answer ourselves. Every write goes through group-chat-worker so that its own `validateUser`
 * runs and its own rules (an owner cannot remove themselves, an owner cannot be removed) stay in
 * one place rather than being restated here and drifting.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/** Roles that may change who is in a group. `member` is in neither list. */
const CAN_INVITE = ['owner', 'admin']
const CAN_REMOVE = ['owner']

/**
 * This actor's role in the group, or null if they are not in it.
 *
 * `group_members.user_id` holds `config.user_id`, which is what the OAuth flow puts in
 * props.userId. An identity that cannot be matched returns null and is refused — fail-closed, the
 * same rule `isGroupMember` states.
 */
export async function groupRole(env, groupId, userId) {
  if (!userId || !groupId) return null
  const row = await env.CHAT_DB.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
  )
    .bind(groupId, userId)
    .first()
  return row?.role || null
}

/**
 * Refuse unless the actor holds one of `roles` in this group.
 *
 * The message deliberately does not distinguish "this group does not exist" from "you are not in
 * it": a caller who is not a member has no business learning which group ids are real.
 */
async function requireGroupRole(env, groupId, actor, roles) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.userId) {
    return fail(ERR.FORBIDDEN_GRAPH, 'This token has no user identity, so it belongs to no groups.')
  }
  const role = await groupRole(env, groupId, actor.userId)
  if (!role) {
    return fail(ERR.FORBIDDEN_GRAPH, 'You are not a member of that group.', { groupId })
  }
  if (!roles.includes(role)) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `You are a ${role} of that group, and this needs ${roles.join(' or ')}.`,
      { groupId, yourRole: role },
    )
  }
  return { ok: true, role }
}

/**
 * The caller's own credentials, read server-side.
 *
 * group-chat-worker authenticates every write with a user_id/phone pair in the request. For the
 * caller's own actions that pair is simply their own row, looked up here — never accepted from a
 * tool argument, and never returned to the client. A person with no phone number on file cannot
 * act, because the chat worker will not validate them, and saying so plainly beats a 400 from
 * two services away.
 */
async function callerCredentials(env, actor) {
  const row = await env.vegvisr_org
    .prepare('SELECT user_id, email, phone FROM config WHERE user_id = ? OR email = ? LIMIT 1')
    .bind(actor.userId, actor.email || actor.userId)
    .first()
  if (!row?.user_id) return { ok: false, reason: 'no account row' }
  if (!row.phone) return { ok: false, reason: 'no phone number on your account' }
  return { ok: true, userId: row.user_id, phone: row.phone, email: row.email || '' }
}

/** The query string group-chat-worker wants for a caller-authenticated GET or DELETE. */
function authQuery(creds) {
  const p = new URLSearchParams({ user_id: creds.userId, phone: creds.phone })
  if (creds.email) p.set('email', creds.email)
  return p.toString()
}

/**
 * List a group's members.
 *
 * E-MAIL IS NOT SHOWN TO EVERY MEMBER. readGroupMessages already settled this for messages:
 * display names, never addresses, because a name is what a summary needs and an address never
 * is. The same holds here, with one difference — an owner or admin deciding whom to remove or
 * invite genuinely needs to tell two people named "Tor" apart, so they get the address and an
 * ordinary member does not.
 */
export async function listGroupMembers(env, { groupId, actor }) {
  if (!groupId) return fail(ERR.INVALID_INPUT, 'groupId is required.')
  const gate = await requireGroupRole(env, groupId, actor, ['owner', 'admin', 'member'])
  if (!gate.ok) return gate

  const detailed = CAN_INVITE.includes(gate.role)

  const rows = await env.CHAT_DB.prepare(
    'SELECT user_id, role, joined_at FROM group_members WHERE group_id = ? ORDER BY joined_at',
  )
    .bind(groupId)
    .all()

  const members = rows.results || []
  if (members.length === 0) return { ok: true, groupId, yourRole: gate.role, count: 0, members: [] }

  // One query for the names rather than one per member.
  const ids = members.map((m) => m.user_id)
  const placeholders = ids.map(() => '?').join(',')
  const profiles = await env.vegvisr_org
    .prepare(`SELECT user_id, email, display_name FROM config WHERE user_id IN (${placeholders})`)
    .bind(...ids)
    .all()
  const byId = new Map((profiles.results || []).map((p) => [p.user_id, p]))

  return {
    ok: true,
    groupId,
    yourRole: gate.role,
    count: members.length,
    members: members.map((m) => {
      const p = byId.get(m.user_id)
      return {
        userId: m.user_id,
        name: p?.display_name || null,
        role: m.role,
        joinedAt: m.joined_at ? new Date(m.joined_at).toISOString() : null,
        ...(detailed ? { email: p?.email || null } : {}),
      }
    }),
  }
}

/**
 * Add an already-registered person to a group.
 *
 * Named by e-mail, not by user id: a person asking for this knows an address, and a model that
 * had to produce a user id would invent one. The address is resolved against `config`, so only
 * someone already registered — by a Superadmin, or through a form a Superadmin approved — can be
 * added at all. That vetting is the reason this is a reasonable thing for a group owner to do
 * from a chat client; it is not an invitation to a stranger.
 *
 * The role gate is ours. The chat worker has none on this path.
 */
export async function addGroupMember(env, { groupId, email, role = 'member', actor }) {
  if (!groupId) return fail(ERR.INVALID_INPUT, 'groupId is required.')
  const address = String(email || '').trim().toLowerCase()
  if (!address) return fail(ERR.INVALID_INPUT, 'email is required.')
  if (!['member', 'admin'].includes(role)) {
    return fail(ERR.INVALID_INPUT, "role must be 'member' or 'admin'. Ownership is not transferable here.")
  }

  const gate = await requireGroupRole(env, groupId, actor, CAN_INVITE)
  if (!gate.ok) return gate

  const target = await env.vegvisr_org
    .prepare('SELECT user_id, email, phone FROM config WHERE LOWER(email) = ? LIMIT 1')
    .bind(address)
    .first()
  if (!target?.user_id) {
    return fail(
      ERR.GRAPH_NOT_FOUND,
      `${address} is not a registered VEGR.AI user, so they cannot be added to a group. Register them first.`,
      { email: address },
    )
  }
  if (!target.phone) {
    // The chat worker validates a user_id/phone pair, so an account without a number cannot be
    // added by anyone, through any surface. Said here rather than surfaced as a 400 from a
    // service the caller cannot see.
    return fail(
      ERR.INVALID_INPUT,
      `${address} has no phone number on their account, and the chat service identifies people by that. Add one first.`,
      { email: address },
    )
  }

  const existing = await groupRole(env, groupId, target.user_id)
  if (existing) {
    return { ok: true, groupId, email: address, userId: target.user_id, role: existing, alreadyMember: true }
  }

  // added_by_* names US as the requester, so the chat worker checks our standing in the group as
  // well as we do. Defence in depth rather than duplication: the gate above stops the call
  // happening at all, and this stops it being honoured if some future path reaches the endpoint
  // without passing through here. If the caller has no phone on file the fields are simply
  // omitted, because the endpoint accepts that shape and refusing would break the tool over a
  // check that is not the one protecting it.
  const mine = await callerCredentials(env, actor)

  const res = await env.CHAT_WORKER.fetch(`https://group-chat-worker/groups/${groupId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: target.user_id,
      phone: target.phone,
      email: target.email || address,
      role,
      ...(mine.ok ? { added_by_user_id: mine.userId, added_by_phone: mine.phone, added_by_email: mine.email } : {}),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[chat-members] join refused, status', res.status)
    return fail(ERR.INTERNAL_ERROR, data.error || `The chat service refused the request (status ${res.status}).`)
  }

  return { ok: true, groupId, email: address, userId: target.user_id, role, alreadyMember: false }
}

/**
 * Promote a member to admin, or demote an admin back to member. Owner only.
 *
 * This is how a group owner DELEGATES. An admin can add members and create invite links but
 * cannot change roles, so the ability to appoint one stays with the owner and goes no further.
 *
 * The case it was built for: a World's main chat group is owned by the World's own address
 * (post@nibi.no), while the person administering the platform connects as themselves and could
 * not add members to a group they are responsible for. The alternative was letting any platform
 * Superadmin bypass the owner check in every group; this removes no check at all.
 *
 * The chat worker's further rules — ownership is not assignable, the owner cannot change their
 * own role, an owner's role cannot be changed by anyone — are deliberately NOT restated here.
 * They are its rules, they are already right, and a second copy would drift from the first.
 */
export async function setGroupMemberRole(env, { groupId, email, role, actor }) {
  if (!groupId) return fail(ERR.INVALID_INPUT, 'groupId is required.')
  const address = String(email || '').trim().toLowerCase()
  if (!address) return fail(ERR.INVALID_INPUT, 'email is required.')
  if (!['member', 'admin'].includes(role)) {
    return fail(ERR.INVALID_INPUT, "role must be 'member' or 'admin'. Ownership is a transfer, not a role change.")
  }

  const gate = await requireGroupRole(env, groupId, actor, CAN_REMOVE)
  if (!gate.ok) return gate

  const target = await env.vegvisr_org
    .prepare('SELECT user_id FROM config WHERE LOWER(email) = ? LIMIT 1')
    .bind(address)
    .first()
  if (!target?.user_id) {
    return fail(ERR.GRAPH_NOT_FOUND, `${address} is not a registered VEGR.AI user.`, { email: address })
  }

  const creds = await callerCredentials(env, actor)
  if (!creds.ok) {
    return fail(ERR.FORBIDDEN_GRAPH, `The chat service cannot identify you: ${creds.reason}.`)
  }

  const res = await env.CHAT_WORKER.fetch(
    `https://group-chat-worker/groups/${groupId}/members/${encodeURIComponent(target.user_id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: creds.userId, phone: creds.phone, email: creds.email, role }),
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[chat-members] role change refused, status', res.status)
    return fail(
      res.status === 404 ? ERR.GRAPH_NOT_FOUND : ERR.FORBIDDEN_GRAPH,
      data.error || `The chat service refused the request (status ${res.status}).`,
      { groupId, email: address },
    )
  }

  return {
    ok: true,
    groupId,
    email: address,
    userId: target.user_id,
    role: data.role || role,
    previousRole: data.previous_role || null,
  }
}

/**
 * Remove a member. Owner only, and the chat worker enforces that again on its side.
 *
 * Its two further rules — an owner cannot remove themselves, and an owner cannot be removed — are
 * deliberately NOT restated here. They are its rules, they are already correct, and a second copy
 * would drift from the first.
 */
export async function removeGroupMember(env, { groupId, email, actor }) {
  if (!groupId) return fail(ERR.INVALID_INPUT, 'groupId is required.')
  const address = String(email || '').trim().toLowerCase()
  if (!address) return fail(ERR.INVALID_INPUT, 'email is required.')

  const gate = await requireGroupRole(env, groupId, actor, CAN_REMOVE)
  if (!gate.ok) return gate

  const target = await env.vegvisr_org
    .prepare('SELECT user_id FROM config WHERE LOWER(email) = ? LIMIT 1')
    .bind(address)
    .first()
  if (!target?.user_id) {
    return fail(ERR.GRAPH_NOT_FOUND, `${address} is not a registered VEGR.AI user.`, { email: address })
  }

  const creds = await callerCredentials(env, actor)
  if (!creds.ok) {
    return fail(ERR.FORBIDDEN_GRAPH, `The chat service cannot identify you: ${creds.reason}.`)
  }

  const res = await env.CHAT_WORKER.fetch(
    `https://group-chat-worker/groups/${groupId}/members/${encodeURIComponent(target.user_id)}?${authQuery(creds)}`,
    { method: 'DELETE' },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[chat-members] remove refused, status', res.status)
    return fail(
      res.status === 404 ? ERR.GRAPH_NOT_FOUND : ERR.FORBIDDEN_GRAPH,
      data.error || `The chat service refused the request (status ${res.status}).`,
      { groupId, email: address },
    )
  }

  return { ok: true, groupId, email: address, removedUserId: target.user_id }
}

/**
 * Create an invite link. Owner or admin.
 *
 * This is the path for someone who is NOT already registered, and the one that keeps consent with
 * the person joining: they follow the link and join themselves. addGroupMember is for people the
 * system already knows; this is for everyone else.
 */
export async function createGroupInvite(env, { groupId, expiresInDays = 7, actor }) {
  if (!groupId) return fail(ERR.INVALID_INPUT, 'groupId is required.')
  // `|| 7` would be the falsy-zero trap again: a requested 0 days is not "unspecified", it is a
  // number out of range, and it belongs at the floor like any other. Unspecified means absent.
  const asked = Number.parseInt(expiresInDays ?? '', 10)
  const days = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), 30) : 7

  const gate = await requireGroupRole(env, groupId, actor, CAN_INVITE)
  if (!gate.ok) return gate

  const creds = await callerCredentials(env, actor)
  if (!creds.ok) {
    return fail(ERR.FORBIDDEN_GRAPH, `The chat service cannot identify you: ${creds.reason}.`)
  }

  const res = await env.CHAT_WORKER.fetch(`https://group-chat-worker/groups/${groupId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: creds.userId,
      phone: creds.phone,
      email: creds.email,
      expires_in_days: days,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[chat-members] invite refused, status', res.status)
    return fail(ERR.FORBIDDEN_GRAPH, data.error || `The chat service refused the request (status ${res.status}).`)
  }

  return {
    ok: true,
    groupId,
    inviteLink: data.invite?.invite_link || null,
    code: data.invite?.code || null,
    expiresAt: data.invite?.expires_at ? new Date(data.invite.expires_at).toISOString() : null,
    expiresInDays: days,
  }
}
