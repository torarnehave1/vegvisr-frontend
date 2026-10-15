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
 *
 * A World on its OWN brand proxy keeps its pages in its own store, so brand-worker never writes
 * an `html:` key for it and the site was invisible here (lipi.vegr.ai, 2026-10-12). Such a
 * publish is recorded as `site:<hostname>` instead: the same metadata, no page. The page never
 * comes into the platform store, so nothing here can serve it by accident.
 */

import { platformStore, resolveGraphStore, mayUseWorld } from './graph-store.js'
import { ERR, statusForCode, graphLinks } from './graph-service.js'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
// `html:` = a page in the platform store, written by brand-worker. `site:` = a publish that went
// to a World's own brand proxy, written by recordPublishedSite below.
const REGISTRY_PREFIXES = ['html:', 'site:']

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
    // `html:` first, then `site:`. A host normally has only one of the two; if it has both (a
    // World that moved from the platform store to its own proxy), the later publish is the one
    // serving it.
    for (const prefix of REGISTRY_PREFIXES) {
      let cursor
      do {
        const page = await env.HTML_PAGES.list({ prefix, cursor })
        for (const key of page.keys || []) {
          const hostname = String(key.name || '').slice(prefix.length).trim().toLowerCase()
          // Skip malformed keys left by older publishes (pasted URLs, stray text).
          if (!HOSTNAME_RE.test(hostname)) continue
          const graphId = String(key.metadata?.graphId || '').trim()
          if (!graphId) continue
          const entry = {
            hostname,
            graphId,
            nodeId: String(key.metadata?.nodeId || '').trim() || null,
            publishedAt: key.metadata?.publishedAt || null,
            publishedBy: String(key.metadata?.publishedBy || '').trim() || null,
          }
          const earlier = details.get(hostname)
          if (earlier && String(earlier.publishedAt || '') >= String(entry.publishedAt || '')) continue
          details.set(hostname, entry)
        }
        cursor = page.list_complete ? null : page.cursor
      } while (cursor)
    }
    for (const entry of details.values()) {
      if (!byGraph.has(entry.graphId)) byGraph.set(entry.graphId, new Set())
      byGraph.get(entry.graphId).add(entry.hostname)
      ownerOf.set(entry.hostname, entry.graphId)
    }
  } catch (error) {
    console.error('[Worker] Failed to read published domain registry:', error)
    return publishedDomainRegistryCache?.registry || emptyRegistry()
  }

  const registry = { byGraph, ownerOf, details }
  publishedDomainRegistryCache = { at: now, registry }
  return registry
}

/**
 * Record a publish that went to a World's own brand proxy, so the registry knows the site.
 * Metadata only — the page stays in the World's store. Overwrites the previous record for the
 * host, which is how a host that moves to another graph changes owner here.
 */
export async function recordPublishedSite(env, { hostname, graphId, nodeId = null, publishedBy = null } = {}) {
  const host = String(hostname || '').trim().toLowerCase()
  const graph = String(graphId || '').trim()
  if (!HOSTNAME_RE.test(host)) return fail(ERR.INVALID_INPUT, 'hostname is not a valid host name.')
  if (!graph) return fail(ERR.INVALID_INPUT, 'graphId is required.')
  if (!env.HTML_PAGES) return fail(ERR.INTERNAL_ERROR, 'HTML_PAGES binding missing.')
  const metadata = {
    graphId: graph,
    nodeId: String(nodeId || '').trim(),
    publishedAt: new Date().toISOString(),
    publishedBy: publishedBy ? String(publishedBy) : null,
  }
  await env.HTML_PAGES.put(`site:${host}`, '1', { metadata })
  publishedDomainRegistryCache = null // the next listing must see this publish, not a minute-old view
  return { ok: true, hostname: host, ...metadata }
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

const READABLE_SQL = (n) => {
  const dataSql = `CASE WHEN json_valid(data) THEN data END`
  return `
      SELECT
        id,
        COALESCE(json_extract(${dataSql}, '$.metadata.title'), title, '') AS title,
        COALESCE(json_extract(${dataSql}, '$.metadata.metaArea'), '') AS meta_area,
        COALESCE(json_extract(${dataSql}, '$.metadata.publicationState'), '') AS publication_state,
        COALESCE(json_extract(${dataSql}, '$.metadata.createdBy'), created_by, '') AS owner,
        user_id
      FROM knowledge_graphs
      WHERE id IN (${Array.from({ length: n }, () => '?').join(',')})
    `
}

/**
 * Graph ids in `ids` that `actor` is allowed to read — one query per store. Most ids live on the
 * platform; an id whose locator names a World is looked up in that World's own store, and only if
 * the actor may use that World (its founder, account holder, or a Superadmin). Such a graph is
 * the founder's whoever created it, so a permitted actor may read it.
 */
async function readableGraphs(env, actor, ids) {
  if (!ids.length) return new Map()

  const byWorld = new Map()
  try {
    const locs = await env.vegvisr_org
      .prepare(`SELECT graph_id, world_domain FROM graph_locations WHERE graph_id IN (${ids.map(() => '?').join(',')}) AND status = 'active'`)
      .bind(...ids)
      .all()
    for (const r of locs.results || []) {
      if (!byWorld.has(r.world_domain)) byWorld.set(r.world_domain, [])
      byWorld.get(r.world_domain).push(r.graph_id)
    }
  } catch (e) {
    if (!/no such table/i.test(e.message)) throw e
  }
  const inWorld = new Set([...byWorld.values()].flat())
  const platformIds = ids.filter((id) => !inWorld.has(id))

  const out = new Map()
  const keep = (row, worldGranted) => {
    // The same rule checkAccess applies, decided per row: your own graph, or a published one —
    // or, for a World's graph, being allowed into that World at all.
    const isOwner = Boolean(row.owner && actor.email && row.owner === actor.email)
    const userIdMatch = Boolean(row.user_id && actor.userId && row.user_id === actor.userId)
    const isPublished = row.publication_state === 'published'
    if (!(actor.isSuperadmin || worldGranted || isOwner || userIdMatch || isPublished)) return
    out.set(row.id, {
      title: row.title || '(untitled)',
      metaArea: row.meta_area || null,
      publicationState: row.publication_state || 'private',
      owner: row.owner || null,
    })
  }

  if (platformIds.length) {
    const rows = await platformStore(env).all(READABLE_SQL(platformIds.length), platformIds)
    for (const row of rows) keep(row, false)
  }
  for (const [domain, worldIds] of byWorld) {
    if (!(await mayUseWorld(env, actor, domain))) continue
    const store = await resolveGraphStore(env, { graphId: worldIds[0], actor })
    for (const row of await store.all(READABLE_SQL(worldIds.length), worldIds)) keep(row, true)
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
