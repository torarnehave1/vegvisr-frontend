/**
 * email-templates-service.js — write a World's e-mail template, by asking the worker that already
 * knows how.
 *
 * There is deliberately NO template logic in this file, for the same reason publish-service.js
 * holds no publish logic. agent-worker's `executeSetWorldEmailTemplate` is the one
 * implementation, and almost every line of it exists because something went wrong once:
 *
 *   - it finds the `#EMAIL-<domain>` graph by its metaArea marker and creates one on first use,
 *     so a caller never has to know a graph id;
 *   - it holds the built-in Norwegian and English login templates, added because setting
 *     nibi.no's login e-mail meant pasting a prompt full of HTML into a chat and that broke;
 *   - it picks an accent from the brand's logo that white button text stays readable on (WCAG
 *     4.5:1), reading the palette from the ORIGINAL image because the resized copy yields a
 *     different set;
 *   - it wraps the body in the edit-section markers that let the result be edited in the same
 *     machinery html-nodes use, and leaves the signature slot where the composer expects it;
 *   - it stamps ownership from `world_founders`, so a Superadmin setting up somebody else's World
 *     does not end up owning it — a fault found in production on 2026-10-03;
 *   - and it gates on Superadmin-or-that-World's-founder, because the login e-mail is what a
 *     World's members click to sign in, and anyone able to rewrite it could point the button
 *     somewhere else.
 *
 * Reimplementing that here would produce a second template writer that drifts from the first one
 * bug at a time. `add_node` can already write these nodes raw under graph:write — what it cannot
 * do is any of the above, which is why a typo in `metadata.purpose` produces a template that
 * exists and is invisible to every send.
 *
 * What this file DOES own is the MCP-specific narrowing: the caller's own credential, read
 * server-side, and a refusal that names what the World already has when a write would otherwise
 * be a silent no-op.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/**
 * The caller's own X-API-Token, read from their config row.
 *
 * Same rule as publish-service.js and users-service.js: never from a tool argument, never
 * returned to the client, never logged. agent-worker resolves the identity from this token and
 * applies its own gate, so the credential IS the authorisation — there is nothing for a model to
 * assert.
 */
async function callerToken(env, actor) {
  if (!actor?.email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ? LIMIT 1')
    .bind(actor.email)
    .first()
  return row?.emailVerificationToken || null
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/**
 * Create or update one World's e-mail template, brand and/or signature.
 *
 * At least one of `purpose` or `signature` must be present. Without that check a call naming only
 * a domain would reach agent-worker, save a graph with nothing new in it, and report success —
 * the shape of no-op that reads like a result.
 */
export async function setWorldEmailTemplate(env, { domain, purpose, language, subject, body, brand, signature, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')

  const host = String(domain || '').trim().toLowerCase()
  if (!host || !DOMAIN_RE.test(host)) {
    return fail(ERR.INVALID_INPUT, 'domain must be a World domain such as "nibi.no".')
  }
  if (!purpose && !signature && !brand) {
    return fail(
      ERR.INVALID_INPUT,
      'Nothing to write: give a purpose (with subject and body, or alone for "login" to use the ' +
        'built-in template), a signature, or a brand.',
    )
  }
  if (signature && (!signature.name || !signature.html)) {
    return fail(ERR.INVALID_INPUT, 'A signature needs both name (its selector) and html.')
  }
  if (!env.AGENT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  }

  const token = await callerToken(env, actor)
  if (!token) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      'No credential on your account. Sign in at vegvisr.org once, then try again.',
    )
  }

  let res
  let data
  try {
    res = await env.AGENT_WORKER.fetch('https://agent-worker/email/world-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
      body: JSON.stringify({
        domain: host,
        ...(purpose ? { purpose } : {}),
        ...(language ? { language } : {}),
        ...(subject ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(brand ? { brand } : {}),
        ...(signature ? { signature } : {}),
      }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    console.error('[email-templates] agent-worker unreachable:', e.message)
    return fail(ERR.INTERNAL_ERROR, `Could not reach the template service: ${e.message}`)
  }

  if (!res.ok || data?.success === false) {
    // The executor's gate refusal — "only a Superadmin or the World Founder of X" — is the most
    // useful thing it can say, so it is passed through rather than replaced.
    const code = /Superadmin or the World Founder/i.test(data?.error || '')
      ? ERR.FORBIDDEN_GRAPH
      : ERR.INVALID_INPUT
    return fail(code, data?.error || `The template service refused the request (status ${res.status}).`, { domain: host })
  }

  return {
    ok: true,
    domain: host,
    graphId: data.graphId || null,
    nodeId: data.nodeId || null,
    purpose: data.purpose || null,
    language: data.language || null,
    subject: data.subject || null,
    brandUpdated: !!data.brandUpdated,
    usedDefaultTemplate: !!data.used_default_template,
    signatureName: data.signature?.name || null,
    owner: data.owner || null,
    viewUrl: data.viewUrl || null,
    message: data.message || null,
  }
}
