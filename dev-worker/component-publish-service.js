/**
 * component-publish-service.js — put a registry component's code from GitHub into service.
 *
 * A component served with delivery "graph-js" (graph-portfolio, vegvisr-fulltext …) is the
 * string in metadata.impl on its node in the Component Registry graph. api-worker serves that
 * string verbatim as https://api.vegvisr.org/components/<name>.js, and every page that carries
 * the <script src> line runs it. The source of truth is a file in the PUBLIC repository
 * torarnehave1/Agent-Builder, worker/components/<name>.js.
 *
 * Until this file there were two ways to move the code from the repository to the node:
 * agent-worker's /save-component, which needs a session an assistant on claude.ai does not
 * have, and update_node, where a model would have to retype the whole file — 110 000 characters
 * for graph-portfolio — as a tool-call argument. One slipped character there is a SyntaxError
 * on every page that references the component, all at once (2026-11-13: a finished and tested
 * change to graph-portfolio could not be put into service from the chat).
 *
 * So the model never carries the code. It names the component; this file fetches the bytes
 * itself and stores them. What is held by this file rather than by the caller's good behaviour:
 *
 *   * WHERE the code comes from is fixed: one repository, its default branch, one directory.
 *     The caller cannot pass a url, a repository, a branch or a commit to publish. The commit
 *     is read from the branch head here — a caller-supplied sha would not do, because GitHub
 *     serves the commits of FORKS under the parent repository's raw address.
 *   * WHAT can be replaced is narrow: a node that already exists in the registry, is a
 *     component and is already served as JavaScript. Creating a component, changing its
 *     schema or its delivery stays with the Agent Builder's save_component.
 *   * The two regressions save_component guards against are guarded here too, with no override:
 *     markup stored as JavaScript, and a large unexplained shrink (a truncated file).
 *
 * Nothing here can check that the code is CORRECT — a Worker cannot parse JavaScript without
 * running it. The component's tests live beside it in the repository and are the caller's job;
 * `verify` records what was actually checked and defaults to UNVERIFIED.
 */

import * as gs from './graph-service.js'
import { ERR, statusForCode } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

export const COMPONENT_REGISTRY_GRAPH_ID = '4072b898-f111-42a9-b5ca-0d901bb17d26'
export const SOURCE_REPO = 'torarnehave1/Agent-Builder'
export const SOURCE_BRANCH = 'master'
export const SOURCE_DIR = 'worker/components'
export const SERVE_BASE = 'https://api.vegvisr.org/components'
/** api-worker serves a component with max-age 300, so a change is everywhere within this. */
export const SERVE_MAX_AGE_SECONDS = 300

export const COMPONENT_NAME_RE = /^[a-z][a-z0-9-]{0,62}$/
export const MAX_IMPL_BYTES = 512 * 1024
/** save_component's rule: a stored impl over 2000 chars may not lose more than 40 % in one save. */
export const SHRINK_FLOOR = 0.6

const SHA_RE = /^[0-9a-f]{40}$/

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github.sha',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'vegvisr-mcp-server',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** The commit the source branch points at right now. Read without a token; the repository is public. */
async function branchHead(env, doFetch) {
  const url = `https://api.github.com/repos/${SOURCE_REPO}/commits/${SOURCE_BRANCH}`
  let res = await doFetch(url, { headers: githubHeaders(null) })
  // An unauthenticated call shares its rate limit with everything else leaving Cloudflare's
  // addresses. The worker's GitHub token is tried only then, and only to be counted — it grants
  // nothing on this repository that an anonymous reader does not have.
  if ((res.status === 403 || res.status === 429) && env.GITHUB_WORKER_TOKEN) {
    res = await doFetch(url, { headers: githubHeaders(env.GITHUB_WORKER_TOKEN) })
  }
  if (res.status !== 200) return { error: `GitHub refused to read the head of ${SOURCE_REPO}@${SOURCE_BRANCH} (status ${res.status}).` }
  const sha = (await res.text()).trim()
  if (!SHA_RE.test(sha)) return { error: `GitHub did not return a commit id for ${SOURCE_REPO}@${SOURCE_BRANCH}.` }
  return { sha }
}

/**
 * Publish worker/components/<name>.js from the head of the source branch into the registry.
 *
 * @param {object} args
 * @param {string} args.name            component name, e.g. "graph-portfolio"
 * @param {string} [args.expectedCommit] full sha the caller tested; refused if the branch has moved
 * @param {string} [args.changeNote]    one or two sentences on what changed, stored on the node
 * @param {object} [args.verify]        { verdict: 'PASS' | 'UNVERIFIED', method, note }
 * @param {boolean} [args.dryRun]       fetch and check everything, write nothing
 * @param {object} args.actor
 */
export async function publishComponent(env, { name, expectedCommit = null, changeNote = null, verify = null, dryRun = false, actor }, { fetchImpl, now } = {}) {
  const doFetch = fetchImpl || fetch
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!actor.isSuperadmin) return fail(ERR.FORBIDDEN_GRAPH, 'Publishing a component requires the Superadmin role.')

  const component = String(name || '').trim()
  if (!COMPONENT_NAME_RE.test(component)) {
    return fail(ERR.INVALID_INPUT, 'name must be a component name in kebab-case, e.g. "graph-portfolio".')
  }
  const expected = expectedCommit == null ? null : String(expectedCommit).trim().toLowerCase()
  if (expected !== null && !SHA_RE.test(expected)) {
    return fail(ERR.INVALID_INPUT, 'expectedCommit must be a full 40-character commit id.')
  }
  const verdict = String(verify?.verdict || 'UNVERIFIED').toUpperCase()
  if (verdict !== 'PASS' && verdict !== 'UNVERIFIED') {
    return fail(ERR.INVALID_INPUT, "verify.verdict must be 'PASS' or 'UNVERIFIED'.")
  }
  if (verdict === 'PASS' && !String(verify?.method || '').trim()) {
    return fail(ERR.INVALID_INPUT, 'verify.method is required with verdict PASS: say how the component was checked in a real browser.')
  }

  // 1. The node being replaced. Read first: a name that is not a served component costs GitHub nothing.
  const read = await gs.getGraph(env, COMPONENT_REGISTRY_GRAPH_ID, { caller: actor })
  if (!read.ok) return read
  const node = (read.graph?.nodes || []).find(
    (n) => String(n.type || '') === 'component' && String(n.label || '').toLowerCase() === component,
  )
  if (!node) {
    return fail(ERR.GRAPH_NOT_FOUND, `No component named "${component}" in the Component Registry. This tool only updates a component that is already there; a new one is registered with the Agent Builder's save_component.`)
  }
  const meta = node.metadata && typeof node.metadata === 'object' ? node.metadata : {}
  if (!String(meta.delivery || '').includes('graph-js')) {
    return fail(ERR.INVALID_INPUT, `"${component}" is not served as JavaScript (delivery is "${meta.delivery || 'inline'}"), so there is no file in ${SOURCE_REPO} to publish for it.`)
  }
  const previous = String(meta.impl || '')
  const version = Number(read.version)
  if (!Number.isInteger(version)) return fail(ERR.INTERNAL_ERROR, 'The Component Registry graph has no version; nothing was written.')

  // 2. The code, from the head of the branch — by commit id, so what is read is exactly what is recorded.
  let commit, impl
  const path = `${SOURCE_DIR}/${component}.js`
  try {
    const head = await branchHead(env, doFetch)
    if (head.error) return fail(ERR.INTERNAL_ERROR, `${head.error} Nothing was written.`)
    commit = head.sha
    if (expected && expected !== commit) {
      return fail(ERR.VERSION_CONFLICT, `${SOURCE_REPO}@${SOURCE_BRANCH} is at ${commit}, not at the expected ${expected}. Nothing was written. Check what changed, then call again with the new commit id.`, { commit, expectedCommit: expected })
    }
    const raw = await doFetch(`https://raw.githubusercontent.com/${SOURCE_REPO}/${commit}/${path}`, { headers: { 'User-Agent': 'vegvisr-mcp-server' } })
    if (raw.status === 404) return fail(ERR.GRAPH_NOT_FOUND, `${path} does not exist in ${SOURCE_REPO} at ${commit}. Nothing was written.`, { commit })
    if (raw.status !== 200) return fail(ERR.INTERNAL_ERROR, `GitHub refused to serve ${path} (status ${raw.status}). Nothing was written.`, { commit })
    const bytes = new Uint8Array(await raw.arrayBuffer())
    if (bytes.length > MAX_IMPL_BYTES) return fail(ERR.INVALID_INPUT, `${path} is ${bytes.length} bytes, over the ${MAX_IMPL_BYTES} limit. Nothing was written.`, { commit })
    try {
      // fatal: a file that is not valid UTF-8 would be stored with replacement characters.
      impl = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return fail(ERR.INVALID_INPUT, `${path} is not valid UTF-8. Nothing was written.`, { commit })
    }
  } catch (e) {
    return fail(ERR.INTERNAL_ERROR, `Could not reach GitHub: ${e.message}. Nothing was written.`)
  }

  // 3. The guards. No override: the way past them is the Agent Builder, with a person at it.
  if (!impl.trim()) return fail(ERR.INVALID_INPUT, `${path} is empty at ${commit}. Nothing was written.`, { commit })
  if (/^\s*</.test(impl)) {
    return fail(ERR.INVALID_INPUT, `${path} starts with '<' (markup). It is served verbatim as JavaScript, so this would be a SyntaxError on every page. Nothing was written.`, { commit })
  }
  if (previous.length > 2000 && impl.length < previous.length * SHRINK_FLOOR) {
    return fail(ERR.INVALID_INPUT, `${path} is ${impl.length} characters and the served component is ${previous.length} — a ${Math.round((1 - impl.length / previous.length) * 100)} % reduction, which usually means a truncated file. Nothing was written. A deliberate rewrite that large goes through the Agent Builder's save_component with force.`, { commit })
  }

  const base = {
    ok: true,
    name: component,
    graphId: COMPONENT_REGISTRY_GRAPH_ID,
    nodeId: node.id,
    commit,
    sourceUrl: `https://github.com/${SOURCE_REPO}/blob/${commit}/${path}`,
    url: `${SERVE_BASE}/${component}.js`,
    chars: impl.length,
    previousChars: previous.length,
    verifyVerdict: verdict,
  }
  if (impl === previous) {
    return { ...base, changed: false, written: false, dryRun: !!dryRun, registryVersion: version }
  }
  if (dryRun) return { ...base, changed: true, written: false, dryRun: true, registryVersion: version }

  // 4. The write. Every other key on the node (schema, delivery, origin …) is carried over as read.
  const stamp = (now ? now() : new Date()).toISOString()
  const metadata = {
    ...meta,
    impl,
    updatedAt: stamp,
    // Not an e-mail address: the registry graph is readable without signing in.
    updatedBy: 'mcp:publish_component',
    sourceCommit: commit,
    verify: {
      verdict,
      verifiedDate: verdict === 'PASS' ? stamp.slice(0, 10) : null,
      method: verify?.method ? String(verify.method).trim() : null,
      note: verify?.note ? String(verify.note).trim() : null,
    },
  }
  if (changeNote && String(changeNote).trim()) metadata.changeNote = `${stamp.slice(0, 10)}: ${String(changeNote).trim()}`

  const result = await gs.updateNode(env, {
    graphId: COMPONENT_REGISTRY_GRAPH_ID,
    nodeId: node.id,
    fields: { metadata },
    expectedVersion: version,
    actor,
  })
  if (!result.ok) return result
  return { ...base, changed: true, written: true, dryRun: false, registryVersion: result.newVersion }
}
