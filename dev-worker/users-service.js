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

export async function registerUser(env, { email, name = null, phone = null, role = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!looksLikeEmail(email)) {
    return fail(ERR.INVALID_INPUT, 'A valid email address is required to register a user.')
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
        email: String(email).trim().toLowerCase(),
        ...(name ? { name: String(name).trim() } : {}),
        ...(phone ? { phone: String(phone).trim() } : {}),
        ...(role ? { role } : {}),
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
    created: data.updated !== true,
    loginUrl: 'https://login.vegvisr.org',
    message: data.message || null,
  }
}
