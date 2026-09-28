/**
 * publish-service.js — put an html-node live, by asking the worker that already knows how.
 *
 * There is deliberately NO publish logic in this file. agent-worker's executePublishHtmlNode is
 * the one implementation: it holds the wrong-host guard, the dead-backend probe, the gate and
 * version-pill persistence, the choice between the two proxies that sign a publish token, and
 * the read-back verification that decides whether a page is actually live. Every one of those
 * rules exists because something went wrong once. Reimplementing them here would create a
 * second publisher that drifts from the first one bug at a time, which is exactly what the
 * "one internal service, two front doors" rule exists to prevent.
 *
 * What this file DOES own is the MCP-specific narrowing: the caller's own credential, and the
 * fact that `force` is never sent, so the host guard cannot be overridden from a chat.
 */

import { ERR, statusForCode, checkAccess, graphLinks } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/**
 * The caller's own X-API-Token, read server-side from their config row.
 * Same rule as the image upload: never from a tool argument, never returned, never logged.
 */
async function callerToken(env, actor) {
  if (!actor?.email) return null
  const row = await env.vegvisr_org
    .prepare('SELECT emailVerificationToken FROM config WHERE email = ? LIMIT 1')
    .bind(actor.email)
    .first()
  return row?.emailVerificationToken || null
}

/** Hosts a node is already associated with, so the tool can name them before it tries. */
export function referencedHosts(node) {
  const sources = [
    ...(Array.isArray(node?.references) ? node.references : []),
    ...(Array.isArray(node?.bibl) ? node.bibl : []),
    ...(node?.path ? [node.path] : []),
  ]
  const hosts = sources.map((r) => {
    try {
      return new URL(String(r)).hostname.toLowerCase()
    } catch {
      return String(r).replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
    }
  })
  return [...new Set(hosts.filter((h) => h && h.includes('.') && !h.includes(' ')))]
}

/**
 * Publish one html-node to a host it is already associated with.
 *
 * Access is checked twice over and that is intentional: checkAccess here decides whether this
 * user may touch this graph at all, and agent-worker's executor applies its own Superadmin gate
 * plus the host guard on top. Neither is a substitute for the other — the first is about the
 * graph, the second about the live web.
 */
export async function publishHtmlNode(env, { graphId, nodeId, host, versionPill = null, actor }) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!graphId || !nodeId || !host) {
    return fail(ERR.INVALID_INPUT, 'graphId, nodeId and host are required.')
  }
  if (!env.AGENT_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The AGENT_WORKER service binding is not configured on this worker.')
  }

  const access = await checkAccess(env, actor, graphId, 'write')
  if (!access.ok) return access

  // Name the node's hosts before attempting, so a mismatch is a useful answer rather than a
  // round trip. The executor enforces this too; this is the friendly half of the same rule.
  let graphData
  try {
    graphData = JSON.parse(access.graph.data)
  } catch {
    return fail(ERR.INTERNAL_ERROR, 'The stored graph is not valid JSON.')
  }
  const node = (graphData.nodes || []).find((n) => n.id === nodeId)
  if (!node) return fail(ERR.GRAPH_NOT_FOUND, `Node ${nodeId} not found in graph ${graphId}.`, { graphId, nodeId })
  if (node.type !== 'html-node' && node.type !== 'css-node') {
    return fail(ERR.INVALID_INPUT, `Only an html-node or css-node can be published. Node ${nodeId} is type "${node.type}".`)
  }

  const known = referencedHosts(node)
  const target = String(host).trim().toLowerCase()
  if (known.length && !known.includes(target)) {
    return fail(
      ERR.INVALID_INPUT,
      `This node is associated with ${known.join(', ')}, not ${target}. Publish to one of those. ` +
        'A different host cannot be forced through this connection — use the Agent Builder if you ' +
        'deliberately need a new host.',
      { associatedHosts: known, requestedHost: target },
    )
  }
  if (!known.length) {
    return fail(
      ERR.INVALID_INPUT,
      `This node is not associated with any host yet, so there is nothing to republish. Set the ` +
        `host up in the Agent Builder first; this connection can only republish to a host the node ` +
        `already points at.`,
      { requestedHost: target },
    )
  }

  const token = await callerToken(env, actor)
  if (!token) {
    return fail(ERR.FORBIDDEN_GRAPH, 'No publish credential on your account. Sign in at vegvisr.org once, then try again.')
  }

  let res
  let data
  try {
    res = await env.AGENT_WORKER.fetch('https://agent-worker/publish/html-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
      // force is deliberately absent — see the module note.
      body: JSON.stringify({
        graphId,
        nodeId,
        host: target,
        ...(typeof versionPill === 'boolean' ? { version_pill: versionPill } : {}),
      }),
    })
    data = await res.json().catch(() => ({}))
  } catch (e) {
    console.error('[publish] agent-worker unreachable:', e.message)
    return fail(ERR.INTERNAL_ERROR, `Could not reach the publish service: ${e.message}`)
  }

  if (!res.ok || data?.success === false) {
    return fail(ERR.INVALID_INPUT, data?.error || `Publish failed (status ${res.status}).`, {
      ...(data?.associatedHosts ? { associatedHosts: data.associatedHosts } : {}),
    })
  }

  // verified:false means the bytes landed in a store that does not serve this host — a publish
  // that reports success but is not live. Passing it through unchanged is the point.
  return {
    ok: true,
    graphId,
    nodeId,
    host: target,
    siteUrl: `https://${target}`,
    verified: data.verified === true,
    message: data.message || null,
    ...graphLinks(graphId),
  }
}
