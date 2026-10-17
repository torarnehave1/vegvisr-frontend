/**
 * external-token.js — the account's own login token (emailVerificationToken) accepted at /mcp.
 *
 * WHY: Agent-Builder's mcp_call reaches this server on behalf of whoever is signed in there —
 * including a System Owner using "Login as" — so a World Founder's experience of the MCP tools
 * can be reproduced without them (Stine, 2026-10-17). Agent-Builder cannot run the browser
 * OAuth dance a desktop client runs, but it does hold the signed-in user's login token.
 *
 * NOT MCP-CONFORMANT, deliberately: the MCP profile wants only tokens this server issued. This is
 * the provider's documented compatibility hook (resolveExternalToken), and it runs only after the
 * internal token lookup has failed. The token proves no more here than it already does on every
 * REST route of this worker.
 *
 * SCOPES MIRROR THE USER'S OWN CONNECTIONS (decided 2026-10-17): the union of the scopes on every
 * grant the user has made to this server, so a test through Agent-Builder can do exactly what the
 * user's own Claude can — no more. No grant at all: CONNECT_SCOPES, what a new connection gets.
 *
 * No Workers-only imports, so it runs under plain Node tests; the grant listing is injected.
 */
import { CONNECT_SCOPES, KNOWN_SCOPES } from './scopes.js'

/** Who a login token belongs to, or null. The same lookup /authorize uses for its session cookie. */
export async function userForLoginToken(env, token) {
  if (!token || !env?.vegvisr_org) return null
  const row = await env.vegvisr_org
    .prepare('SELECT user_id, email, Role FROM config WHERE emailVerificationToken = ? LIMIT 1')
    .bind(token)
    .first()
  if (!row) return null
  return { userId: row.user_id || row.email, email: row.email, role: row.Role || 'User' }
}

/**
 * The union of scopes on the user's live grants for this resource. Unknown strings are dropped,
 * an expired grant counts for nothing, and a grant bound to another resource is ignored.
 */
export async function scopesFromGrants(listUserGrants, userId, resource, now = Math.floor(Date.now() / 1000)) {
  const found = new Set()
  let cursor
  let pages = 0
  do {
    const page = await listUserGrants(userId, { limit: 1000, cursor })
    for (const g of page?.items || []) {
      if (g.expiresAt && g.expiresAt < now) continue
      const res = Array.isArray(g.resource) ? g.resource : g.resource ? [g.resource] : null
      if (res && !res.includes(resource)) continue
      for (const s of g.scope || []) if (KNOWN_SCOPES.includes(s)) found.add(s)
    }
    cursor = page?.cursor
    pages += 1
  } while (cursor && pages < 10)
  return found.size ? KNOWN_SCOPES.filter((s) => found.has(s)) : [...CONNECT_SCOPES]
}

/**
 * The resolveExternalToken callback. Returns { props, audience } or null (a plain 401).
 * props.scopes carries the scopes, because the provider hands an external token an empty
 * ctx.auth.scope; mcpHandler moves them across.
 */
export async function resolveLoginToken({ token, env }, { resource, listUserGrants }) {
  // An internal token has the shape userId:grantId:secret and was already tried by the provider.
  if (!token || token.split(':').length === 3) return null
  let user
  try {
    user = await userForLoginToken(env, token)
  } catch (e) {
    console.error('[MCP] login-token lookup failed:', e.message)
    return null
  }
  if (!user) return null
  let scopes
  try {
    scopes = await scopesFromGrants(listUserGrants, user.userId, resource)
  } catch (e) {
    console.error('[MCP] grant listing failed, using connect scopes:', e.message)
    scopes = [...CONNECT_SCOPES]
  }
  return {
    props: { userId: user.userId, email: user.email, role: user.role, authMethod: 'login-token', scopes },
    audience: resource,
  }
}
