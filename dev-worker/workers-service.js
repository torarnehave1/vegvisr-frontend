/**
 * workers-service.js — deploy a Cloudflare Worker, by asking the worker that already does it.
 *
 * No Cloudflare logic here. agent-worker's executeDeployWorker owns the upload, and its guarded
 * door (POST /admin/deploy-worker) owns the check that matters: it reads the target's bindings
 * from Cloudflare and refuses anything that has one, failing closed when it cannot tell. That
 * check is the mechanism. A script upload replaces the whole binding set, so a worker with D1,
 * KV or secrets would deploy "successfully" and come back without any of them.
 *
 * What this file owns is the friendly half: the Superadmin gate, and a list of names that are
 * known to carry bindings, so the refusal arrives before anything leaves this worker and says
 * why. The list is NOT the guard — a worker missing from it is still stopped by agent-worker.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/**
 * Workers that have bindings. Every `name =` in a wrangler.toml of this monorepo, plus
 * agent-worker from the Agent-Builder repo. Taken 2026-10-13; a new worker with bindings does not
 * need adding for safety, only for a quicker and clearer refusal.
 */
export const PROTECTED_WORKERS = [
  'agent-worker', 'anthropic-worker', 'audio-portfolio-worker', 'auth-worker', 'billing-worker',
  'blotato-worker', 'brand-worker', 'chat-history-worker', 'client-gateway',
  'coaching-report-worker', 'deployment-status-worker', 'drizzle-worker', 'durable-chat-template',
  'email-worker', 'gemini-worker', 'grok-worker', 'group-chat-worker', 'image-analysis-worker',
  'image-proxy', 'knowledge-graph-worker', 'linkedin-worker', 'mobile-apps-worker',
  'momentum-config-worker', 'mystmkra-worker', 'norwegian-transcription-worker', 'omr-worker',
  'onboarding-worker', 'openai-worker', 'openapi-worker', 'password-worker', 'perplexity-worker',
  'proff-worker', 'realtime-worker', 'sanskrit-learner-worker', 'seo-worker', 'simple-name-app',
  'sms-gateway', 'sources-worker', 'subscription-worker', 'teacher-worker', 'user-keys-worker',
  'vector-search-worker', 'vegvisr-albums-worker', 'vegvisr-api-worker', 'vegvisr-dash-worker',
  'vegvisr-frontend', 'vegvisr-photos-worker', 'vemotion-worker', 'videostream-worker',
  'voice-worker', 'whisper-worker', 'youtube-worker',
]

/** Cloudflare's own rule for a script name, which also keeps it from being a path. */
export const WORKER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

/** A worker script far larger than this is not something to paste through a tool call. */
export const MAX_CODE_BYTES = 1024 * 1024

/** The caller's own session credential — agent-worker resolves the role from it, not from us. */
async function callerToken(env, actor) {
  if (!actor?.email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ? LIMIT 1')
    .bind(actor.email)
    .first()
  return row?.emailVerificationToken || null
}

export async function deployWorker(env, { workerName, code, compatibilityDate = null, description = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) {
    return fail(ERR.FORBIDDEN_GRAPH, 'Deploying a worker requires the Superadmin role.')
  }

  const name = String(workerName || '').trim()
  if (!WORKER_NAME_RE.test(name)) {
    return fail(ERR.INVALID_INPUT, 'workerName must be lowercase letters, digits and hyphens, at most 63 characters.')
  }
  if (PROTECTED_WORKERS.includes(name)) {
    return fail(
      ERR.FORBIDDEN_GRAPH,
      `"${name}" has bindings (database, storage, secrets or other workers). Uploading it through this tool ` +
        'would replace all of them with none, so it is refused. It is deployed with wrangler from its own directory.',
      { refused: 'HAS_BINDINGS' },
    )
  }
  if (typeof code !== 'string' || !code.trim()) return fail(ERR.INVALID_INPUT, 'code is required.')
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    return fail(ERR.INVALID_INPUT, `code is larger than ${MAX_CODE_BYTES} bytes.`)
  }

  if (!env.AGENT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  }
  const token = await callerToken(env, actor)
  if (!token) return fail(ERR.FORBIDDEN_GRAPH, 'No credential on your account. Sign in at vegvisr.org once, then try again.')

  let res
  let data
  try {
    res = await env.AGENT_WORKER.fetch('https://agent-worker/admin/deploy-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
      // bindAdmin:false is the default and there is no way to send true from here. agent-worker
      // ignores the field on this route anyway; it is stated so the intent is readable in a log.
      body: JSON.stringify({
        workerName: name,
        code,
        bindAdmin: false,
        ...(compatibilityDate ? { compatibilityDate } : {}),
        ...(description ? { description: String(description).trim() } : {}),
      }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach the deploy service: ${e.message}`)
  }

  if (!res.ok || data?.success !== true) {
    const msg = data?.error || `The worker was not deployed (status ${res.status}).`
    const detail = data?.details ? ` ${JSON.stringify(data.details).slice(0, 600)}` : ''
    if (data?.refused) return fail(ERR.FORBIDDEN_GRAPH, msg, { refused: data.refused })
    if (res.status === 401 || res.status === 403) return fail(ERR.FORBIDDEN_GRAPH, msg)
    return fail(ERR.INVALID_INPUT, msg + detail)
  }

  return {
    ok: true,
    workerName: data.workerName || name,
    url: data.url || `https://${name}.torarnehave.workers.dev`,
    created: data.created === true,
    subdomainEnabled: data.subdomainEnabled === true,
    deploymentId: data.deploymentId ?? null,
    modifiedOn: data.modifiedOn ?? null,
    deployedBy: data.deployedBy ?? actor.email ?? null,
  }
}
