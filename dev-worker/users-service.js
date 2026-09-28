/**
 * users-service.js — register a person on the platform, by asking the worker that already does it.
 *
 * No account logic here. agent-worker's executeAdminRegisterUser already gets the hard parts
 * right: the Superadmin gate, idempotence on email (an existing row is COMPLETED, never
 * replaced, keeping its role and its login token), and the deliberate refusal to return
 * emailVerificationToken because a tool result is sent to the model provider and shown in chat.
 * A second implementation would drift from all three.
 *
 * What this file owns is the MCP-specific narrowing: the caller's own credential, and a role
 * ceiling — a model cannot mint a Superadmin.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/**
 * Roles this surface may assign — only the ones that actually grant something.
 *
 * It used to also offer 'user' and 'Subscriber'. Both were traps. Every `role === 'user'` in the
 * frontend turned out to be a CHAT MESSAGE role (user vs assistant), not a platform role, so the
 * value granted nothing — and because it is the same word as the task ("register a user"), a
 * model asked to register someone picked it every time. Three accounts were created that way
 * before anyone noticed. Subscriber is checked nowhere either.
 *
 * What is left is what the code enforces: Admin (28 checks) and ViewOnly (5). Superadmin (108
 * checks) stays out on purpose — it passes every access check in the system, so letting a model
 * grant it would turn "register a user" into privilege escalation. Promoting someone remains a
 * human action in the Agent Builder.
 */
export const ASSIGNABLE_ROLES = ['Admin', 'ViewOnly']

/** A shape check only — the platform decides what it will actually accept. */
function looksLikeEmail(value) {
  const v = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

async function callerToken(env, actor) {
  if (!actor?.email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ? LIMIT 1')
    .bind(actor.email)
    .first()
  return row?.emailVerificationToken || null
}

export async function registerUser(env, { email, name = null, phone = null, role = null, groupTags = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!looksLikeEmail(email)) {
    return fail(ERR.INVALID_INPUT, 'A valid email address is required to register a user.')
  }

  const normalisedEmail = String(email).trim().toLowerCase()

  // Refuse a duplicate outright, which is DIFFERENT from the Agent Builder on purpose.
  //
  // executeAdminRegisterUser completes an existing row — a vCard filling in an account that is
  // already there. That is right for a human at a console who can see whose record they are
  // touching. Over MCP it is wrong: "add this member" silently patching a stranger's profile is
  // not what anyone asked for, and the caller cannot see what changed. So the existence check
  // happens HERE, before anything is written, and the reply says who already holds the address.
  const clash = await env.vegvisr_org
    .prepare('SELECT email, Role, group_tags FROM config WHERE email = ? LIMIT 1')
    .bind(normalisedEmail)
    .first()
  if (clash) {
    return fail(
      ERR.NODE_EXISTS,
      `${normalisedEmail} is already registered (role ${clash.Role || 'unknown'}` +
        `${clash.group_tags ? `, groups ${clash.group_tags}` : ''}). Nothing was changed. ` +
        'Use list_users to look them up; changing an existing account is done in the Agent Builder.',
      { email: normalisedEmail, existingRole: clash.Role || null, existingGroupTags: clash.group_tags || null },
    )
  }
  if (role && !ASSIGNABLE_ROLES.includes(role)) {
    return fail(
      ERR.INVALID_INPUT,
      `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}. Superadmin cannot be assigned through this connection.`,
    )
  }
  if (!env.AGENT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  }

  const token = await callerToken(env, actor)
  if (!token) {
    return fail(ERR.FORBIDDEN_GRAPH, 'No credential on your account. Sign in at vegvisr.org once, then try again.')
  }

  let res
  let data
  try {
    res = await env.AGENT_WORKER.fetch('https://agent-worker/admin/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
      body: JSON.stringify({
        email: normalisedEmail,
        ...(name ? { name: String(name).trim() } : {}),
        ...(phone ? { phone: String(phone).trim() } : {}),
        ...(role ? { role } : {}),
        ...(groupTags ? { group_tags: normaliseGroupTags(groupTags) } : {}),
      }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    console.error('[users] agent-worker unreachable:', e.message)
    return fail(ERR.INTERNAL_ERROR, `Could not reach the registration service: ${e.message}`)
  }

  if (!res.ok || data?.success === false) {
    const msg = data?.error || `Registration failed (status ${res.status}).`
    // The executor throws a plain Error for a non-Superadmin caller; surface it as a permission
    // problem rather than an internal one, so the model tells the user what is actually wrong.
    const code = /Superadmin/i.test(msg) ? ERR.FORBIDDEN_GRAPH : ERR.INVALID_INPUT
    return fail(code, msg)
  }

  // Whitelist the fields that come back. The executor does not return the login token, and this
  // makes sure a future change there cannot start leaking one into a model's context.
  return {
    ok: true,
    userId: data.user_id || null,
    email: data.email || null,
    name: data.name ?? null,
    role: data.role || null,
    groupTags: data.group_tags || null,
    created: data.updated !== true,
    loginUrl: 'https://login.vegvisr.org',
    message: data.message || null,
  }
}


/**
 * Group tags in the house style: space-separated #TAGS, uppercase, deduplicated.
 * The same shape metaArea uses on a graph, so one convention covers both.
 */
export function normaliseGroupTags(raw) {
  const tags = String(raw || '')
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim().toUpperCase())
    .filter(Boolean)
  return tags.length ? [...new Set(tags)].map((t) => `#${t}`).join(' ') : null
}

/**
 * The registered people, for the caller to look up who is already on the platform.
 *
 * Superadmin only — this is other people's contact data, and it lands in a model's context.
 * emailVerificationToken is never selected, so it cannot be returned by accident.
 */
export async function listUsers(env, { actor, groupTag = null, query = null, limit = 100 } = {}) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) {
    return fail(ERR.FORBIDDEN_GRAPH, 'Listing the registered users requires the Superadmin role.')
  }

  const lim = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 100, 1), 500)
  const where = []
  const binds = []

  if (groupTag) {
    const tag = normaliseGroupTags(groupTag)
    if (!tag) return fail(ERR.INVALID_INPUT, 'groupTag must contain at least one tag.')
    // One tag at a time; the column holds "#A #B" so a LIKE on the tag is the membership test.
    where.push('UPPER(COALESCE(group_tags, \'\')) LIKE ?')
    binds.push(`%${tag.split(' ')[0]}%`)
  }
  if (query) {
    where.push('(LOWER(email) LIKE ? OR LOWER(COALESCE(json_extract(data, \'$.profile.name\'), \'\')) LIKE ?)')
    const p = `%${String(query).toLowerCase().trim()}%`
    binds.push(p, p)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = await env.vegvisr_org
    .prepare(`
      SELECT email,
             COALESCE(json_extract(data, '$.profile.name'), display_name, '') AS name,
             Role AS role,
             group_tags,
             CASE WHEN phone IS NULL OR phone = '' THEN 0 ELSE 1 END AS has_phone
      FROM config
      ${whereSql}
      ORDER BY LOWER(email)
      LIMIT ?
    `)
    .bind(...binds, lim)
    .all()

  const users = (rows.results || []).map((r) => ({
    email: r.email,
    name: r.name || null,
    role: r.role || null,
    groupTags: r.group_tags || null,
    // Whether they can receive an SMS code, not the number itself: a phone book is not what was
    // asked for, and the number is not needed to answer "who is registered".
    canSignInBySms: r.has_phone === 1,
  }))

  return { ok: true, users, count: users.length, limit: lim }
}


/**
 * Change which groups a person belongs to.
 *
 * The write goes through the same agent-worker route registration uses: supplying group_tags for
 * an email that already exists is exactly what its completion path is for, so there is still one
 * writer. What lives here is the add/remove arithmetic — the route can only set a whole string,
 * and "add #IIBA to whatever they already have" is the thing a caller actually asks for.
 *
 * Superadmin only, like listing. Changing someone else's record is not an ordinary user action.
 */
export async function setUserGroups(env, { email, groupTags, mode = 'add', actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) {
    return fail(ERR.FORBIDDEN_GRAPH, "Changing someone's groups requires the Superadmin role.")
  }
  if (!looksLikeEmail(email)) return fail(ERR.INVALID_INPUT, 'A valid email address is required.')
  if (!['add', 'replace', 'remove'].includes(mode)) {
    return fail(ERR.INVALID_INPUT, "mode must be 'add', 'replace' or 'remove'.")
  }

  const asked = normaliseGroupTags(groupTags)
  if (!asked) return fail(ERR.INVALID_INPUT, 'groupTags must contain at least one tag.')

  const normalisedEmail = String(email).trim().toLowerCase()
  const row = await env.vegvisr_org
    .prepare('SELECT email, group_tags FROM config WHERE email = ? LIMIT 1')
    .bind(normalisedEmail)
    .first()
  if (!row) {
    return fail(
      ERR.GRAPH_NOT_FOUND,
      `${normalisedEmail} is not registered. Use register_user to create the account — it takes groupTags directly.`,
    )
  }

  const before = row.group_tags || null
  const current = before ? before.split(/\s+/).filter(Boolean) : []
  const wanted = asked.split(' ')

  let next
  if (mode === 'replace') next = wanted
  else if (mode === 'add') next = [...new Set([...current, ...wanted])]
  else next = current.filter((t) => !wanted.includes(t))

  const after = next.length ? next.join(' ') : null

  if (after === before) {
    return { ok: true, email: normalisedEmail, groupTags: after, before, changed: false }
  }

  // The route's completion path treats an empty string as "leave alone", so clearing the last
  // tag has to be done here rather than by sending ''.
  if (after === null) {
    await env.vegvisr_org
      .prepare('UPDATE config SET group_tags = NULL WHERE email = ?')
      .bind(normalisedEmail)
      .run()
    return { ok: true, email: normalisedEmail, groupTags: null, before, changed: true }
  }

  const token = await callerToken(env, actor)
  if (!token) return fail(ERR.FORBIDDEN_GRAPH, 'No credential on your account. Sign in at vegvisr.org once, then try again.')
  if (!env.AGENT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  }

  const res = await env.AGENT_WORKER.fetch('https://agent-worker/admin/register-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
    body: JSON.stringify({ email: normalisedEmail, group_tags: after }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    return fail(ERR.INVALID_INPUT, data?.error || `Could not update groups (status ${res.status}).`)
  }

  return { ok: true, email: normalisedEmail, groupTags: data.group_tags || after, before, changed: true }
}
