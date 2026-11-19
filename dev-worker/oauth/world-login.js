/**
 * world-login.js — signing in to /authorize with a session that lives on a World's own editor.
 *
 * WHY (owner decision 2026-11-19): the code step takes Norwegian mobile numbers only, and the
 * session shortcut reads a cookie on .vegvisr.org. A World Founder outside Norway who works in her
 * own World's editor (editor.<her domain>) has neither: her login sits in that editor's
 * localStorage, on her own domain, and a browser never sends that to knowledge.vegvisr.org. She
 * could not connect an MCP client at all.
 *
 * HOW: a hand-off, because the two origins cannot see each other's storage.
 *
 *   1. /authorize, action=world-start, world=<domain>   the domain must be a registered World
 *        → a one-time hand-off id is bound to the transaction
 *        → 302 to https://editor.<domain>/?mcp_connect=<hand-off id>
 *   2. The editor, where she is signed in, asks her to confirm and then POSTs
 *        action=world-token, handoff=<id>, token=<her login token>   to /authorize
 *   3. The token is looked up exactly as the session cookie's is; the transaction moves to consent.
 *
 * WHAT TRAVELS WHERE
 *   * The transaction id never leaves this origin. It is the CSRF token of every other POST, so
 *     the editor is given a separate id that can do one thing once: attach an identity.
 *   * The login token goes from the editor to this worker, which is where that editor already
 *     sends it as a Bearer on every graph request. Nothing new learns it.
 *   * The redirect goes only to editor.<a domain in world_founders>, so this page cannot be used
 *     to bounce someone to an address of the caller's choosing.
 *
 * WHAT IT DOES NOT CHANGE: consent. A hand-off says who you are, not that you agreed. The risk is
 * the one the cookie shortcut already has — someone can be sent a link to an authorization they
 * did not start — and the answer is the same: the consent page names the client and the account,
 * and nothing is granted until a person approves it there.
 *
 * No Workers-only imports, so it runs under plain Node tests.
 */
import { getTx, putTx } from './otp.js'
import { userForLoginToken } from './external-token.js'

const HANDOFF_PREFIX = 'oauthhandoff:'
// Long enough to sign in at the editor with an e-mailed link first; shorter than a transaction.
export const HANDOFF_TTL_SECONDS = 15 * 60

export const WORLD_ERR = {
  BAD_DOMAIN: 'BAD_DOMAIN',
  UNKNOWN_WORLD: 'UNKNOWN_WORLD',
  NO_HANDOFF: 'NO_HANDOFF',
  BAD_TOKEN: 'BAD_TOKEN',
}

/**
 * What a person types for "my World" → its bare domain, or null.
 * Accepts navaninas.site, editor.navaninas.site, https://editor.navaninas.site/view?x=1.
 * Hostname characters only, at least one dot, no port, no userinfo: the result is put into a URL.
 */
export function normalizeWorldDomain(raw) {
  let d = String(raw == null ? '' : raw).trim().toLowerCase()
  if (!d || d.length > 253) return null
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  d = d.split(/[/?#]/)[0]
  if (d.includes('@') || d.includes(':')) return null
  d = d.replace(/^(editor|www|graphs)\./, '')
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d)) return null
  return d
}

function newHandoffId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Step 1. Bind a one-time hand-off to the transaction and say where to send the browser.
 * `knownWorld(env, domain)` is injected (graph-store.js) so this file stays free of the store.
 * Starting again replaces the earlier hand-off: only the newest id is honoured.
 */
export async function startWorldHandoff(env, tx, domainRaw, { knownWorld }) {
  const domain = normalizeWorldDomain(domainRaw)
  if (!domain) return { ok: false, code: WORLD_ERR.BAD_DOMAIN }
  const world = await knownWorld(env, domain)
  if (!world) return { ok: false, code: WORLD_ERR.UNKNOWN_WORLD }

  if (tx.handoff?.id) await env.OAUTH_KV.delete(HANDOFF_PREFIX + tx.handoff.id)
  const id = newHandoffId()
  tx.handoff = { id, world }
  await putTx(env, tx)
  await env.OAUTH_KV.put(HANDOFF_PREFIX + id, tx.txId, { expirationTtl: HANDOFF_TTL_SECONDS })
  return { ok: true, world, redirectTo: `https://editor.${world}/?mcp_connect=${id}` }
}

/**
 * Step 3. Spend the hand-off: attach the identity behind the login token to its transaction.
 * The id is deleted before anything else is decided, so it works once whatever the outcome.
 * A wrong token leaves the transaction untouched at the stage it was in.
 */
export async function redeemWorldHandoff(env, { handoff, token }) {
  const id = String(handoff || '')
  if (!/^[0-9a-f]{48}$/.test(id)) return { ok: false, code: WORLD_ERR.NO_HANDOFF }
  const txId = await env.OAUTH_KV.get(HANDOFF_PREFIX + id)
  if (!txId) return { ok: false, code: WORLD_ERR.NO_HANDOFF }
  await env.OAUTH_KV.delete(HANDOFF_PREFIX + id)

  const tx = await getTx(env, txId)
  // The transaction must still name THIS hand-off: a newer world-start replaced an older id.
  if (!tx || tx.handoff?.id !== id) return { ok: false, code: WORLD_ERR.NO_HANDOFF }

  const world = tx.handoff.world
  delete tx.handoff
  // The same refusals the session cookie gets: an empty value, or a stringified nothing.
  const t = String(token == null ? '' : token).trim()
  const user = t && t !== 'null' && t !== 'undefined' ? await userForLoginToken(env, t) : null
  if (!user) {
    await putTx(env, tx)
    return { ok: false, code: WORLD_ERR.BAD_TOKEN, tx }
  }

  tx.email = user.email
  tx.userId = user.userId
  tx.role = user.role
  tx.stage = 'consent'
  // A code that was on its way for another number proves nothing about this account.
  tx.phone = null
  tx.codeHash = null
  tx.codeExpiresAt = null
  await putTx(env, tx)
  return { ok: true, tx, world }
}
