/**
 * published-domains.js — which live site a graph serves, and which html-node serves it.
 *
 * Extracted verbatim from index.js, where readPublishedDomainRegistry and
 * mergePublishedDomains were closures inside the request handler and therefore reachable only
 * from the two REST listing endpoints. MCP needs the same answer, so the functions moved out
 * rather than being written a second time. index.js imports them; there is one implementation.
 *
 * brand-worker records every html-node publish as an HTML_PAGES key `html:<hostname>` whose
 * metadata names the graph and the node it came from. That registry — not the node's own
 * publishedDomain field, which is stamped client-side and only when the graph happens to be
 * saved afterwards — is the authoritative answer to "which site does this graph publish?".
 */

import { ERR, statusForCode, graphLinks } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/** An empty registry in the shape every caller expects. */
const emptyRegistry = () => ({ byGraph: new Map(), ownerOf: new Map() })

// Module-scope so one isolate reads the 60-odd HTML_PAGES keys once a minute
// instead of on every graph listing.
let publishedDomainRegistryCache = null

/** Only for tests: drop the 60-second cache so a fixture's keys are read fresh. */
export function resetRegistryCache() {
  publishedDomainRegistryCache = null
}

/**
 * hostname → graph, and graph → hostnames. Cached for 60 seconds per isolate.
 *
 * `details` additionally carries the node id and publish timestamp from the key's metadata,
 * which the listing tool needs and the CSV merge does not.
 */
export async function readPublishedDomainRegistry(env) {
  // The original returned a bare Map here, which would have thrown in mergePublishedDomains on
  // `registry.ownerOf`. Unreachable in production — HTML_PAGES is always bound — so returning
  // the right shape changes no output, only what happens if the binding is ever missing.
  if (!env.HTML_PAGES) return emptyRegistry()
  const now = Date.now()
  if (publishedDomainRegistryCache && now - publishedDomainRegistryCache.at < 60000) {
    return publishedDomainRegistryCache.registry
  }

  const byGraph = new Map()
  const ownerOf = new Map()
  const details = new Map()
  try {
    let cursor
    do {
      const page = await env.HTML_PAGES.list({ prefix: 'html:', cursor })
      for (const key of page.keys || []) {
        const hostname = String(key.name || '').slice(5).trim().toLowerCase()
        // Skip malformed keys left by older publishes (pasted URLs, stray text).
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(hostname)) {
          continue
        }
        const graphId = String(key.metadata?.graphId || '').trim()
        if (!graphId) continue
        if (!byGraph.has(graphId)) byGraph.set(graphId, new Set())
        byGraph.get(graphId).add(hostname)
        ownerOf.set(hostname, graphId)
        details.set(hostname, {
          hostname,
          graphId,
          nodeId: String(key.metadata?.nodeId || '').trim() || null,
          publishedAt: key.metadata?.publishedAt || null,
          publishedBy: String(key.metadata?.publishedBy || '').trim() || null,
        })
      }
      cursor = page.list_complete ? null : page.cursor
    } while (cursor)
  } catch (error) {
    console.error('[Worker] Failed to read published domain registry:', error)
    return publishedDomainRegistryCache?.registry || emptyRegistry()
  }

  const registry = { byGraph, ownerOf, details }
  publishedDomainRegistryCache = { at: now, registry }
  return registry
}

/**
 * A node keeps its publishedDomain stamp forever, so a graph still claims a host that a later
 * publish gave to someone else. The registry decides who serves a host today; a stamp the
 * registry contradicts is dropped. Hosts the registry has no owner for (published before it
 * recorded graphId) are left to the stamp.
 */
export function mergePublishedDomains(graphId, stampedCsv, registry) {
  const stamped = String(stampedCsv || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((hostname) => {
      const owner = registry.ownerOf.get(hostname)
      return !owner || owner === graphId
    })
  return Array.from(new Set([...stamped, ...(registry.byGraph.get(graphId) || [])])).sort()
}

/** Graph ids in `ids` that `actor` is allowed to read, resolved in ONE query. */
async function readableGraphs(env, actor, ids) {
  if (!ids.length) return new Map()

  const placeholders = ids.map(() => '?').join(',')
  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  const rows = await env.vegvisr_org
    .prepare(`
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), '') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.createdBy'), created_by, '') AS owner,
        user_id
      FROM knowledge_graphs
      WHERE id IN (${placeholders})
    `)
    .bind(...ids)
    .all()

  const out = new Map()
  for (const row of rows.results || []) {
    // The same rule checkAccess applies, decided per row: your own graph, or a published one.
    const isOwner = Boolean(row.owner && actor.email && row.owner === actor.email)
    const userIdMatch = Boolean(row.user_id && actor.userId && row.user_id === actor.userId)
    const isPublished = row.publication_state === 'published'
    if (!(actor.isSuperadmin || isOwner || userIdMatch || isPublished)) continue
    out.set(row.id, {
      title: row.title || '(untitled)',
      metaArea: row.meta_area || null,
      publicationState: row.publication_state || 'private',
      owner: row.owner || null,
    })
  }
  return out
}

/**
 * The live sites, each with the graph and the html-node behind it.
 *
 * This is the Knowledge Graph Portfolio's "Published sites" chip as data. A host whose graph
 * the caller may not read is omitted entirely — the page it serves is public, but the graph
 * behind it, its title and its owner are not.
 */
export async function listPublishedSites(env, { actor, domain = null, graphId = null, limit = 100 } = {}) {
  if (!actor) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')

  const registry = await readPublishedDomainRegistry(env)
  const details = registry.details || new Map()

  const needle = String(domain || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()

  let entries = Array.from(details.values())
  if (needle) entries = entries.filter((e) => e.hostname.includes(needle))
  if (graphId) entries = entries.filter((e) => e.graphId === graphId)

  const totalBeforeAccess = entries.length
  const visible = await readableGraphs(env, actor, [...new Set(entries.map((e) => e.graphId))])

  const sites = entries
    .filter((e) => visible.has(e.graphId))
    .sort((a, b) => a.hostname.localeCompare(b.hostname))
    .slice(0, Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 100, 1), 500))
    .map((e) => {
      const g = visible.get(e.graphId)
      return {
        hostname: e.hostname,
        siteUrl: `https://${e.hostname}`,
        graphId: e.graphId,
        nodeId: e.nodeId,
        title: g.title,
        metaArea: g.metaArea,
        publicationState: g.publicationState,
        publishedAt: e.publishedAt,
        ...graphLinks(e.graphId),
      }
    })

  return {
    ok: true,
    sites,
    count: sites.length,
    // How many the registry holds in total for this filter, before the access check. A caller
    // who sees fewer knows the difference is other people's graphs, not a missing site.
    totalRegistered: totalBeforeAccess,
  }
}
