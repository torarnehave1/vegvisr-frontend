/**
 * worker-source-service.js — propose a Cloudflare Worker by committing its source to GitHub.
 *
 * This file does NOT deploy anything, and that is the design. It writes one file,
 * mcp-workers/<name>/index.js, to the main branch of this repository. From there
 * .github/workflows/deploy-mcp-workers.yml builds it, then WAITS for the owner's approval in the
 * mcp-production environment, and only then deploys it as the script `mcp-<name>`.
 *
 * So a model can write a worker, and a person lets it out. Three properties follow, and each one
 * is held by something other than this file's good behaviour:
 *
 *   * Nothing reaches production without a click — the Cloudflare token is a secret of the
 *     approval-gated environment, and this worker does not hold it.
 *   * No existing worker can be overwritten — the workflow deploys every directory under
 *     mcp-workers/ as `mcp-<dir>`, and no platform worker has that prefix. A script upload
 *     replaces the whole binding set, so landing on knowledge-graph-worker would strip it bare.
 *   * The code that went out is in git, with history, where it can be read and reverted.
 *
 * The workers made this way have NO bindings: no database, no KV, no secrets. That is what makes
 * it reasonable for a model to write them at all.
 *
 * The GitHub credential (GITHUB_WORKER_TOKEN) is a fine-grained token with Contents: write on
 * this one repository and WITHOUT the Workflows permission, so it cannot edit the workflow that
 * holds the approval.
 */

import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

export const REPO = 'torarnehave1/vegvisr-frontend'
export const BRANCH = 'main'
export const SOURCE_DIR = 'mcp-workers'
export const DEPLOY_PREFIX = 'mcp-'

/** Short enough that `mcp-<name>` is still a valid 63-character script name. */
export const WORKER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,48}$/

export const MAX_CODE_BYTES = 512 * 1024

const API = 'https://api.github.com'

function toBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export async function proposeWorker(env, { workerName, code, description = null, actor }, { fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) return fail(ERR.FORBIDDEN_GRAPH, 'Creating a worker requires the Superadmin role.')

  const name = String(workerName || '').trim()
  if (!WORKER_NAME_RE.test(name)) {
    return fail(ERR.INVALID_INPUT, 'workerName must be lowercase letters, digits and hyphens, at most 49 characters.')
  }
  if (typeof code !== 'string' || !code.trim()) return fail(ERR.INVALID_INPUT, 'code is required.')
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    return fail(ERR.INVALID_INPUT, `code is larger than ${MAX_CODE_BYTES} bytes.`)
  }
  if (!/export\s+default\b/.test(code)) {
    return fail(ERR.INVALID_INPUT, 'code must be an ES module with a default export (export default { fetch(request) { ... } }).')
  }

  const token = env.GITHUB_WORKER_TOKEN
  if (!token) {
    return fail(ERR.INTERNAL_ERROR, 'GITHUB_WORKER_TOKEN is not set on this worker, so nothing can be committed. The owner sets it with: wrangler secret put GITHUB_WORKER_TOKEN')
  }

  const path = `${SOURCE_DIR}/${name}/index.js`
  const url = `${API}/repos/${REPO}/contents/${path}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'vegvisr-mcp-server',
    'Content-Type': 'application/json',
  }

  try {
    // An existing file must be replaced by naming its blob sha; a 404 means this is a new worker.
    const head = await doFetch(`${url}?ref=${BRANCH}`, { headers })
    let sha = null
    if (head.status === 200) {
      sha = (await head.json().catch(() => ({})))?.sha || null
      if (!sha) return fail(ERR.INTERNAL_ERROR, 'GitHub returned the existing file without a sha; nothing was committed.')
    } else if (head.status !== 404) {
      return fail(ERR.INTERNAL_ERROR, `GitHub refused to read ${path} (status ${head.status}). Nothing was committed.`)
    }

    const summary = description ? `: ${String(description).trim().replace(/\s+/g, ' ').slice(0, 120)}` : ''
    // No e-mail address in the message: this repository is public.
    const put = await doFetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `${SOURCE_DIR}/${name}: ${sha ? 'update' : 'create'} via MCP${summary}`,
        content: toBase64(code),
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    })
    const data = await put.json().catch(() => ({}))
    if (put.status !== 200 && put.status !== 201) {
      const why = data?.message ? ` ${String(data.message).slice(0, 200)}` : ''
      return fail(ERR.INTERNAL_ERROR, `GitHub refused the commit (status ${put.status}).${why} Nothing was committed.`)
    }

    const deployedName = `${DEPLOY_PREFIX}${name}`
    return {
      ok: true,
      workerName: name,
      deployedName,
      created: !sha,
      live: false,
      status: 'awaiting_approval',
      path,
      commitSha: data?.commit?.sha || null,
      commitUrl: data?.commit?.html_url || null,
      approvalUrl: `https://github.com/${REPO}/actions/workflows/deploy-mcp-workers.yml`,
      url: `https://${deployedName}.torarnehave.workers.dev`,
    }
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach GitHub: ${e.message}`)
  }
}
