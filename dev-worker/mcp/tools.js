/**
 * tools.js — the MCP tools, version 1.
 *
 * Every tool runs through graph-service.js, the same module the REST handlers use. There is no
 * second Knowledge Graph implementation behind MCP.
 *
 * Two rules hold everywhere in this file:
 *
 *   The caller's identity comes from `auth.props`, which was written by completeAuthorization()
 *   after a magic link and an SMS code proved who the person is. It is never taken from a tool
 *   argument. There is deliberately no `email`, `userId`, `role` or `createdBy` input on any
 *   tool — a model cannot ask to be someone else, because the schema gives it nowhere to say so.
 *
 *   Scope is checked before the work, ownership immediately after. A valid token for the wrong
 *   user is not enough: checkAccess() re-reads the graph's creator on every call.
 *
 * Results are returned twice over: `structuredContent` for a program, and a short text block a
 * model can read without parsing anything. Errors carry a stable machine code AND a sentence,
 * so a model can recover (re-read the version after a conflict) instead of guessing.
 */

import { z } from 'zod'
import * as gs from '../graph-service.js'
import * as chat from '../chat-service.js'
import * as members from '../chat-members.js'
import * as mail from '../email-service.js'
import * as mailTemplates from '../email-templates-service.js'
import * as templates from '../templates-service.js'
import * as images from '../images-service.js'
import * as sites from '../published-domains.js'
import * as publish from '../publish-service.js'
import { NODE_TYPES, DEFAULT_NODE_TYPE, suggestNodeType } from '../node-types.js'
import * as users from '../users-service.js'

// ─────────────────────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────────────────────

// Reserved node-metadata keys.
//
// `metadata` is a passthrough object, which re-opens for ONE field the hole that the schema-wide
// ban loop in test/mcp-tools.test.mjs closes everywhere else: that loop reads declared property
// NAMES, so it cannot see a `createdBy` smuggled inside a free-form object. These keys are
// therefore refused by the protocol, before anything is stored.
//
//   createdBy / userId / actor   would forge authorship — the graph already stamps the real caller
//   token / authToken            a credential has no business in graph content
//   encrypted                    addNode sets this when it encrypts a data-node's info; a model
//                                setting it on plaintext makes the reader try to decrypt prose
//   review                       under Human Knowledge First an approval is a HUMAN's act, and
//                                every MCP caller is a model holding a human's token. The review
//                                block is written by the UI; it is not askable from here.
//
// Compared on a normalised key, so created_by, Created-By and CREATEDBY are the same refusal.
const RESERVED_NODE_METADATA = new Set([
  'createdby', 'userid', 'actor', 'token', 'authtoken', 'encrypted', 'review',
])

const normaliseMetaKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '')

const NodeMetadata = z
  .object({})
  .passthrough()
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj || {})) {
      if (RESERVED_NODE_METADATA.has(normaliseMetaKey(key))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `metadata.${key} is reserved and cannot be set through the MCP.`,
        })
      }
    }
  })

const NodeInput = z
  .object({
    id: z.string().min(1).optional().describe('Node id. A UUID v4 is generated when omitted.'),
    label: z.string().min(1).describe('Node display label. Required.'),
    // An enum, not a sentence. The old free-text description listed five examples and omitted
    // html-node, so a model building an HTML page invented "html" — which has no renderer and
    // displays as raw text. A wrong value is now refused by the protocol before anything is
    // stored, and the list a model sees is the same one openapi.json publishes.
    type: z
      .enum(NODE_TYPES)
      .optional()
      .describe(
        `The node's content type — it selects the renderer, so the exact string matters and a ` +
          `wrong one would display as plain text. Note the -node suffix: "html-node", not "html". ` +
          `Defaults to ${DEFAULT_NODE_TYPE}. Common: fulltext (markdown), html-node (a full HTML ` +
          `document in an iframe), css-node (a stylesheet for the html-nodes in the same graph), ` +
          `info (markdown in an info panel), markdown-image, youtube-video, mermaid-diagram.`,
      ),
    info: z.string().optional().describe('Node content. Markdown for fulltext nodes.'),
    color: z.string().optional().describe('Hex colour, e.g. #4f6d7a.'),
    bibl: z.array(z.string()).optional().describe('Source URLs or references.'),
    position: z.object({ x: z.number(), y: z.number() }).optional().describe('Canvas position.'),
    visible: z.boolean().optional(),
    metadata: NodeMetadata.optional().describe(
      'Structured fields for machines, beside the prose a human reads in `info` — a kind, a ' +
        'binding name, a pointer to another graph. The viewer renders `info`; tools query this. ' +
        'Reserved keys (createdBy, userId, token, encrypted, review) are refused.',
    ),
  })
  .describe('A knowledge-graph node.')

const EdgeInput = z
  .object({
    id: z.string().optional().describe('Edge id. Defaults to "<source>_<target>".'),
    source: z.string().min(1).describe('Source node id — must exist in the same graph.'),
    target: z.string().min(1).describe('Target node id — must exist in the same graph.'),
    label: z.string().optional(),
    type: z.string().optional(),
  })
  .describe('A directed edge between two nodes of the same graph.')

// ─────────────────────────────────────────────────────────────────────────────
// Result envelopes
// ─────────────────────────────────────────────────────────────────────────────

function ok(structured, text) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  }
}

/**
 * A tool error, not a protocol error: isError tells the model the call failed while still
 * handing it the structured reason, which is what lets it act on VERSION_CONFLICT.
 */
function err(code, message, extra = {}) {
  const structured = { success: false, code, message, ...extra }
  return {
    content: [{ type: 'text', text: `${code}: ${message}` }],
    structuredContent: structured,
    isError: true,
  }
}

/**
 * Graph ids the publish registry says serve a host matching this query.
 *
 * The portfolio's filter box treats a hostname as a search term, so the MCP search does too: a
 * graph whose node was never stamped with publishedDomain is still findable by the site it
 * serves, because the registry knows and the stamp does not.
 */
function hostMatches(registry, query) {
  const needle = String(query || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
  if (!needle) return []
  const ids = []
  for (const [graphId, hostnames] of registry.byGraph) {
    for (const hostname of hostnames) {
      if (hostname.includes(needle)) {
        ids.push(graphId)
        break
      }
    }
  }
  return ids
}

/** Replace each result's raw stamp CSV with the merged, registry-checked hostname list. */
function withDomains(results, registry) {
  return results.map(({ publishedDomainsCsv, ...g }) => ({
    ...g,
    publishedDomains: sites.mergePublishedDomains(g.graphId, publishedDomainsCsv, registry),
  }))
}

/** Turn a graph-service failure into a tool error, preserving its code and fields. */
function fromService(result) {
  const { ok: _drop, status: _s, code, message, ...rest } = result
  return err(code || gs.ERR.INTERNAL_ERROR, message || 'Operation failed.', rest)
}

// ─────────────────────────────────────────────────────────────────────────────
// Authorization helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The actor for this call, built from the verified token only.
 * `auth.props` was set by completeAuthorization(); `auth.scope` is what the token really carries.
 */
export function actorFromAuth(auth, props) {
  // props is NOT a field of auth. ctx.auth is OAuthResourceAuth — {token, audience, expiresAt,
  // scope, userId, clientId} — and the application data completeAuthorization() stored arrives
  // separately on ctx.props. An earlier version read auth.props, which is always undefined, so
  // every tool call resolved to no actor and returned UNAUTHENTICATED. It passed the tests
  // because the test fixture built auth objects with a props key: the fixture encoded the
  // assumption instead of the contract, which is exactly what a fixture must never do.
  if (!props) return null
  return gs.normalizeActor({
    valid: true,
    userId: props.userId || props.email || auth?.userId || null,
    userEmail: props.email || null,
    userRole: props.role || 'User',
    scopes: Array.isArray(auth?.scope) ? auth.scope : [],
    authMethod: props.authMethod || 'oauth',
  })
}

function hasScope(auth, needed) {
  const scopes = Array.isArray(auth?.scope) ? auth.scope : []
  return scopes.includes(needed)
}

function requireScope(auth, needed) {
  if (hasScope(auth, needed)) return null
  return err(gs.ERR.INSUFFICIENT_SCOPE, `This operation requires the ${needed} scope. The connected token does not carry it.`, {
    requiredScope: needed,
  })
}



/**
 * The registered OAuth client record, when the provider can supply it.
 *
 * Needed because a client registered through /register has an opaque id, and its redirect URIs
 * are the only non-forgeable thing about it. The provider injects env.OAUTH_PROVIDER before
 * calling this handler, so lookupClient is reachable here; a failure is not fatal, it just means
 * the caller falls back to the neutral bot.
 */
async function lookupClient(env, clientId) {
  try {
    return (await env.OAUTH_PROVIDER?.lookupClient?.(clientId)) || null
  } catch (e) {
    console.error('[mcp] client lookup failed:', e.message)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotations and output schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ToolAnnotations are hints a client uses to decide how cautious to be. Without them ChatGPT
 * guesses, and it guessed wrong: add_node was shown to the user tagged DESTRUCTIVE, which it is
 * not — it appends a node and never overwrites one. Saying so explicitly is the difference
 * between a connector that looks dangerous and one that reads honestly.
 *
 *   readOnlyHint    — the call cannot change anything
 *   destructiveHint — meaningful only when readOnlyHint is false: does it DESTROY existing data?
 *   idempotentHint  — calling it twice with the same arguments is the same as calling it once
 *   openWorldHint   — does it reach outside this system? Everything here stays in one database.
 */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const ADDITIVE_WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }

/** Fields every graph-shaped result carries. */
const graphSummaryShape = {
  graphId: z.string(),
  title: z.string().nullable(),
  metaArea: z.string().nullable(),
  publicationState: z.string(),
  version: z.number().nullable(),
  editorUrl: z.string(),
  viewerUrl: z.string(),
}

const listShape = {
  success: z.boolean(),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
  results: z.array(
    z.object({
      ...graphSummaryShape,
      description: z.string().nullable(),
      nodeCount: z.number(),
      updatedAt: z.string().nullable(),
      isMine: z.boolean(),
      publishedDomains: z.array(z.string()).describe('Hostnames this graph serves a live page at. Empty for a graph that publishes nowhere.'),
    }),
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers the v1 tool set on an McpServer.
 *
 * `getContext()` returns { auth, env } for the request currently being served. It is a function
 * rather than a value because one registration serves every request in a stateless transport.
 */
export function registerTools(server, getContext) {
  // ── create_graph ──────────────────────────────────────────────────────────
  server.registerTool(
    'create_graph',
    {
      title: 'Create a knowledge graph',
      description:
        'Create a new VEGR.AI knowledge graph owned by the authenticated user. The graph is PRIVATE: ' +
        'it is never visible to anyone else until it is explicitly published. Returns the graph id ' +
        'plus editor and viewer links. Requires the graph:write scope.',
      inputSchema: {
        title: z.string().min(1).describe('Graph title.'),
        description: z.string().optional().describe('Short description of what the graph covers.'),
        metaArea: z
          .string()
          .min(1)
          .describe('Meta-area tags used for filtering, written with leading hashes, e.g. "#HISTORY #NORWAY".'),
        nodes: z.array(NodeInput).optional().describe('Nodes to create the graph with. May be empty.'),
        edges: z.array(EdgeInput).optional().describe('Edges between those nodes. Each end must be a node in this call.'),
      },
      outputSchema: {
        success: z.boolean(),
        ...graphSummaryShape,
      },
      annotations: ADDITIVE_WRITE,
    },
    async ({ title, description, metaArea, nodes, edges }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await gs.createGraph(env, {
        title,
        description,
        metaArea,
        nodes: nodes || [],
        edges: edges || [],
        actor,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Created private graph "${result.title}" (${result.graphId}) at version ${result.version}.\n` +
          `Editor: ${result.editorUrl}\nViewer: ${result.viewerUrl}\n` +
          `It is private — nobody else can see it until you publish it explicitly.`,
      )
    },
  )

  // ── get_graph ─────────────────────────────────────────────────────────────
  server.registerTool(
    'get_graph',
    {
      title: 'Read a knowledge graph',
      description:
        'Read a graph the authenticated user has access to: its metadata, nodes, edges and current ' +
        'version. Pass nodeId to read a single node. A private graph belonging to someone else is ' +
        'refused. Requires the graph:read scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph id.'),
        nodeId: z.string().optional().describe('Return only this node, instead of the whole graph.'),
      },
      // Declared 2026-10-01. This was the only tool of 28 without one, and the omission made it
      // look broken from outside: the nodes WERE fetched and WERE in structuredContent, but a
      // client has no contract telling it what that field holds, so it reads content[0].text —
      // which was a one-line count. The description promised "metadata, nodes, edges" and that
      // was true of a field nothing was reading.
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        title: z.string().nullable(),
        description: z.string().nullable(),
        metaArea: z.string().nullable(),
        publicationState: z.string(),
        version: z.number().nullable(),
        createdBy: z.string().nullable(),
        nodeCount: z.number(),
        edgeCount: z.number(),
        nodes: z.array(z.record(z.any())),
        edges: z.array(z.record(z.any())),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      annotations: READ_ONLY,
    },
    async ({ graphId, nodeId }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      // Ownership first: a missing graph and a graph belonging to someone else are answered
      // before any content is read.
      const access = await gs.checkAccess(env, actor, graphId, 'read')
      if (!access.ok) return fromService(access)

      const read = await gs.getGraph(env, graphId, nodeId ? { nodeId } : {})
      if (!read.ok) return fromService(read)

      const g = read.graph
      const meta = g.metadata || {}

      if (nodeId && g.nodes.length === 0) {
        return err(gs.ERR.GRAPH_NOT_FOUND, `Graph ${graphId} has no node with id ${nodeId}.`, { graphId, nodeId })
      }

      const payload = {
        success: true,
        graphId,
        title: meta.title ?? null,
        description: meta.description ?? null,
        metaArea: meta.metaArea ?? null,
        publicationState: meta.publicationState || 'private',
        version: meta.version ?? null,
        createdBy: meta.createdBy ?? null,
        nodeCount: g.nodes.length,
        edgeCount: g.edges.length,
        nodes: g.nodes,
        edges: g.edges,
        ...gs.graphLinks(graphId),
      }

      // The text has to carry the ids too, not just a count.
      //
      // structuredContent holds everything, and with an outputSchema declared a client can now
      // rely on it — but a client that only reads the text still has to be able to find a node to
      // act on. A summary that says "4 nodes" and names none of them cannot be followed by
      // update_node. Every other read tool here lists its contents; this one counted them.
      //
      // Truncated per node rather than dropped: an html-node's info can be tens of kilobytes, and
      // a graph of them would bury the ids this exists to surface. The full text is one
      // get_graph(nodeId) away, and the reply says so when it has cut something.
      const PREVIEW = 160
      const preview = (text) => {
        const flat = String(text || '').replace(/\s+/g, ' ').trim()
        if (!flat) return ''
        return flat.length > PREVIEW ? `${flat.slice(0, PREVIEW)}…` : flat
      }

      let summary
      if (nodeId) {
        const node = g.nodes[0] || {}
        const info = String(node.info || '')
        summary =
          `Node ${nodeId} of graph "${payload.title}" (version ${payload.version}).\n` +
          `label: ${node.label ?? '(none)'}\ntype: ${node.type ?? '(none)'}\n` +
          (info ? `info (${info.length} chars):\n${info}` : 'info: (empty)')
      } else {
        const lines = g.nodes.map((n) => {
          const body = preview(n.info)
          return `• ${n.id} — ${n.label || '(no label)'} [${n.type || 'unknown'}]${body ? `\n    ${body}` : ''}`
        })
        const edgeLines = g.edges.map(
          (e) => `• ${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`,
        )
        summary = [
          `Graph "${payload.title}" (${graphId}) — version ${payload.version}, ${payload.nodeCount} nodes, ` +
            `${payload.edgeCount} edges, ${payload.publicationState}.`,
          ...(lines.length ? ['', 'Nodes:', ...lines] : []),
          ...(edgeLines.length ? ['', 'Edges:', ...edgeLines] : []),
          ...(g.nodes.some((n) => String(n.info || '').replace(/\s+/g, ' ').trim().length > PREVIEW)
            ? ['', `Node text is shortened above. Call get_graph with that nodeId for the whole thing.`]
            : []),
        ].join('\n')
      }

      return ok(payload, `${summary}\nViewer: ${payload.viewerUrl}`)
    },
  )

  // ── add_node ──────────────────────────────────────────────────────────────
  server.registerTool(
    'add_node',
    {
      title: 'Add a node to a graph',
      description:
        'Append one node to an existing graph without sending the whole graph. Existing nodes are ' +
        'never overwritten. Pass expectedVersion (from get_graph) to have a concurrent change ' +
        'refused with VERSION_CONFLICT instead of interleaving. Requires the graph:write scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph to add the node to.'),
        node: NodeInput,
        expectedVersion: z
          .number()
          .int()
          .optional()
          .describe('The version you last read. If the graph has moved on, the write is refused with VERSION_CONFLICT.'),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        nodeId: z.string(),
        currentVersion: z.number(),
        newVersion: z.number(),
        title: z.string().nullable(),
        metaArea: z.string().nullable(),
        publicationState: z.string(),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // NOT destructive: the node is appended, a duplicate id is refused with NODE_EXISTS, and
      // nothing existing is ever rewritten. Not idempotent: calling it twice adds two nodes.
      annotations: ADDITIVE_WRITE,
    },
    async ({ graphId, node, expectedVersion }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const access = await gs.checkAccess(env, actor, graphId, 'write')
      if (!access.ok) return fromService(access)

      const result = await gs.addNode(env, {
        graphId,
        node,
        expectedVersion: expectedVersion ?? null,
        actor,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Added node ${result.nodeId} ("${node.label}") to graph ${graphId}. ` +
          `Version ${result.currentVersion} → ${result.newVersion}.\nViewer: ${result.viewerUrl}`,
      )
    },
  )

  // ── get_graph_links ───────────────────────────────────────────────────────
  server.registerTool(
    'get_graph_links',
    {
      title: 'Get editor and viewer links',
      description:
        'Return the canonical editor and viewer URLs for a graph, so they can be shown to the user. ' +
        'Requires the graph:read scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph id.'),
      },
      outputSchema: { success: z.boolean(), graphId: z.string(), editorUrl: z.string(), viewerUrl: z.string() },
      annotations: READ_ONLY,
    },
    async ({ graphId }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const access = await gs.checkAccess(env, actor, graphId, 'read')
      if (!access.ok) return fromService(access)

      const links = gs.graphLinks(graphId)
      return ok(
        { success: true, ...links },
        `Editor: ${links.editorUrl}\nViewer: ${links.viewerUrl}`,
      )
    },
  )

  // ── update_node ───────────────────────────────────────────────────────────
  server.registerTool(
    'update_node',
    {
      title: 'Update fields of a node',
      description:
        'Change named fields of one existing node — its text, label, colour or path — without ' +
        'sending the whole graph. Only the fields you pass are touched; everything else on the ' +
        'node is left alone. expectedVersion is REQUIRED: read it from get_graph, and if the ' +
        'graph has moved on the write is refused with VERSION_CONFLICT rather than overwriting ' +
        'someone else\'s change. The node id itself cannot be changed. Requires the graph:write scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph containing the node.'),
        nodeId: z.string().min(1).describe('The node to update.'),
        fields: z
          .object({
            label: z.string().optional().describe('New display label.'),
            info: z.string().optional().describe('New content. Markdown for fulltext nodes. Replaces the old content entirely.'),
            type: z.enum(NODE_TYPES).optional().describe('New node type. Must be one of the known types — "html-node", not "html".'),
            color: z.string().optional().describe('New hex colour.'),
            path: z.string().nullable().optional().describe('New media path.'),
            bibl: z.array(z.string()).optional().describe('New source list — replaces the old one.'),
            visible: z.boolean().optional(),
            metadata: NodeMetadata.optional().describe(
              'Metadata keys to MERGE into the node. The one field here that does not replace: ' +
                'keys you omit are kept, so changing `kind` cannot silently delete a `review` ' +
                'block a human wrote. Pass null as a value to remove that one key. Reserved keys ' +
                'are refused.',
            ),
          })
          .describe('The fields to change. Anything omitted is left untouched. Pass the whole new value for a field, not a fragment — except metadata, which merges key by key.'),
        expectedVersion: z
          .number()
          .int()
          .describe('The version you read from get_graph. Required — this is a read-modify-write, so without it a concurrent change would be silently lost.'),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        nodeId: z.string(),
        currentVersion: z.number(),
        newVersion: z.number(),
        updatedFields: z.array(z.string()),
        title: z.string().nullable(),
        metaArea: z.string().nullable(),
        publicationState: z.string(),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // A write, and unlike add_node this one DOES replace existing content: destructiveHint is
      // true because a wrong `info` overwrites what was there. Idempotent, though — applying the
      // same patch twice lands on the same node state (the version moves, the content does not).
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ graphId, nodeId, fields, expectedVersion }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const access = await gs.checkAccess(env, actor, graphId, 'write')
      if (!access.ok) return fromService(access)

      if (!fields || Object.keys(fields).length === 0) {
        return err(gs.ERR.INVALID_INPUT, 'fields must name at least one field to change.')
      }

      // metadata MERGES while every other field replaces, and the asymmetry is deliberate: a
      // model changing `kind` must not silently delete the `review` block a human wrote. The read
      // below cannot race the write — gs.updateNode re-checks expectedVersion inside the SQL
      // UPDATE, so a graph that moved after this read is refused rather than patched from stale
      // metadata.
      let patch = fields
      if (fields.metadata) {
        const read = await gs.getGraph(env, graphId)
        if (!read.ok) return fromService(read)
        const existing = (read.graph?.nodes || []).find((n) => n.id === nodeId)
        if (!existing) {
          return err(gs.ERR.GRAPH_NOT_FOUND, `Node ${nodeId} not found in graph ${graphId}.`)
        }
        const merged = { ...(existing.metadata || {}) }
        for (const [k, v] of Object.entries(fields.metadata)) {
          if (v === null) delete merged[k]
          else merged[k] = v
        }
        patch = { ...fields, metadata: merged }
      }

      const result = await gs.updateNode(env, { graphId, nodeId, fields: patch, expectedVersion, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Updated ${result.updatedFields.join(', ')} on node ${nodeId} in graph ${graphId}. ` +
          `Version ${result.currentVersion} → ${result.newVersion}.\nViewer: ${result.viewerUrl}`,
      )
    },
  )

  // ── post_chat_message ─────────────────────────────────────────────────────
  //
  // The only tool here that reaches other people. Everything else touches the caller's own
  // graphs, where a mistake is private and undoable; a message in a group is neither. It needs
  // chat:write, which the discovery document does not advertise, so an ordinary connection
  // cannot obtain it.
  server.registerTool(
    'post_chat_message',
    {
      title: 'Post a message to a chat group',
      description:
        'Post a text message into a VEGR.AI chat group the authenticated user belongs to. THIS ' +
        'SENDS A MESSAGE TO OTHER PEOPLE AND CANNOT BE UNDONE — confirm the exact wording and the ' +
        'group with the user before calling it. The message is posted by the group\'s bot and ' +
        'always carries a line saying an AI assistant wrote it on that user\'s behalf. You cannot ' +
        'post to a group the user is not a member of, nor to one the designated bot has not been ' +
        'added to — that is how a group opts in to allowing AI messages. Requires the chat:write ' +
        'scope, which a normal connection does not have.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group to post in. The user must be a member of it.'),
        text: z.string().min(1).describe('The message. An attribution line is appended automatically; do not write your own.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        groupName: z.string().nullable(),
        botId: z.string(),
        botName: z.string().nullable(),
        messageId: z.union([z.string(), z.number()]).nullable(),
        characters: z.number(),
      },
      // openWorldHint is TRUE here and false everywhere else: this is the one tool whose effect
      // leaves the caller's own data and lands in front of other people.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ groupId, text }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const client = await lookupClient(env, auth.clientId)
      const result = await chat.postChatMessage(env, { groupId, text, actor, clientId: auth.clientId, client })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Posted to "${result.groupName || result.groupId}" as ${result.botName || 'the group bot'}. ` +
          `The message carries a line naming that assistant and the user it was written for.`,
      )
    },
  )

  // ── list_chat_groups ──────────────────────────────────────────────────────
  //
  // Read-only companion to post_chat_message. Both ChatGPT and Claude had to ask the user for a
  // group id by hand because posting existed with no way to discover where — three times between
  // them before this was written.
  server.registerTool(
    'list_chat_groups',
    {
      title: 'List chat groups you can post in',
      description:
        'List the VEGR.AI chat groups this assistant can post in: groups the authenticated user ' +
        'belongs to AND that have this assistant\'s bot added. Use it to find a groupId before ' +
        'calling post_chat_message, rather than asking the user to look one up. A group the user ' +
        'is in but has not added the bot to is NOT listed — adding the bot is how a group opts in. ' +
        'Reading this list changes nothing. Requires the chat:write scope, the same one posting needs.',
      inputSchema: {
        limit: z.number().int().optional().describe('Maximum groups to return, 1–100. Default 50.'),
      },
      outputSchema: {
        success: z.boolean(),
        bot: z.object({
          id: z.string().optional(),
          name: z.string().nullable(),
          username: z.string(),
          verified: z.boolean(),
        }),
        groups: z.array(
          z.object({
            groupId: z.string(),
            name: z.string().nullable(),
            members: z.number(),
            messages: z.number(),
          }),
        ),
        note: z.string().optional(),
      },
      // Reading a list of groups changes nothing and leaves nothing — unlike posting, which is
      // the openWorld tool next to it.
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ limit }) => {
      const { auth, env, props } = getContext()
      // Gated on chat:write rather than a read scope on purpose: this list describes where an
      // assistant may speak, so it should not be visible to a connection that cannot speak.
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const client = await lookupClient(env, auth.clientId)
      const result = await chat.listPostableGroups(env, { actor, clientId: auth.clientId, client, limit })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const head = result.groups.length
        ? `${result.groups.length} group${result.groups.length === 1 ? '' : 's'} you can post in as ${result.bot.name}:`
        : result.note || 'No groups available.'
      const lines = result.groups.map((g) => `• ${g.name || '(unnamed)'} — ${g.groupId} · ${g.members} members · ${g.messages} messages`)
      return ok({ success: true, ...payload }, [head, ...lines].join('\n'))
    },
  )

  // ── list_group_members ────────────────────────────────────────────────────
  //
  // The four tools below change or expose WHO IS IN a group, which is a different risk from
  // saying something in one. The gate they share lives in chat-members.js, and the reason it has
  // to: group-chat-worker's /join endpoint checks the credentials of the person being added and
  // nothing about who is asking, so without an ownership check here any connected user could add
  // anybody to any group whose id they could guess.
  server.registerTool(
    'list_group_members',
    {
      title: 'List who is in a chat group',
      description:
        'List the members of a VEGR.AI chat group you belong to, with each one\'s role (owner, ' +
        'admin or member) and when they joined. Use it before add_group_member or ' +
        'remove_group_member to see who is already there and whether you have the standing to ' +
        'change it — your own role is in the reply. E-mail addresses are included only if you ' +
        'are the owner or an admin; an ordinary member sees display names. Requires the ' +
        'chat:write scope.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group. Use list_chat_groups to find one.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        yourRole: z.string(),
        count: z.number(),
        members: z.array(
          z.object({
            userId: z.string(),
            name: z.string().nullable(),
            role: z.string(),
            joinedAt: z.string().nullable(),
            email: z.string().nullable().optional(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ groupId }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await members.listGroupMembers(env, { groupId, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const lines = result.members.map(
        (m) => `• ${m.name || m.userId}${m.email ? ` <${m.email}>` : ''} — ${m.role}`,
      )
      return ok(
        { success: true, ...payload },
        [`${result.count} member${result.count === 1 ? '' : 's'} (you are ${result.yourRole}):`, ...lines].join('\n'),
      )
    },
  )

  // ── add_group_member ──────────────────────────────────────────────────────
  //
  // Mirrors Agent-Builder's add_user_to_chat_group, with the one difference that matters: there,
  // every caller is a Superadmin running their own system, so no ownership check was needed. Here
  // the caller is whoever holds a token, so the check is the tool.
  server.registerTool(
    'add_group_member',
    {
      title: 'Add a registered person to a chat group',
      description:
        'Add an existing VEGR.AI user to a chat group, by e-mail. Only works in groups where YOU ' +
        'are the owner or an admin, and only for people who are already registered — someone who ' +
        'has no account cannot be added this way; use create_group_invite for them. The person ' +
        'appears in the group immediately and can read everything posted from then on, so ' +
        'confirm the address with the user before calling this. Adding someone who is already a ' +
        'member changes nothing and says so. Requires the chat:write scope.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group. Use list_chat_groups to find one.'),
        email: z.string().min(3).describe("The person's registered VEGR.AI e-mail address."),
        role: z
          .enum(['member', 'admin'])
          .optional()
          .describe('Their role in the group. Default "member". Ownership cannot be granted here.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        email: z.string(),
        userId: z.string(),
        role: z.string(),
        alreadyMember: z.boolean(),
      },
      // A write that reaches other people, and not idempotent in effect: the person is in the
      // group afterwards and can read what is said there. Not destructive — nothing is lost.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ groupId, email, role }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await members.addGroupMember(env, { groupId, email, role: role || 'member', actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        result.alreadyMember
          ? `${result.email} was already a ${result.role} of that group. Nothing changed.`
          : `Added ${result.email} to the group as ${result.role}. They can now read everything posted there.`,
      )
    },
  )

  // ── remove_group_member ───────────────────────────────────────────────────
  server.registerTool(
    'remove_group_member',
    {
      title: 'Remove someone from a chat group',
      description:
        'Remove a member from a chat group you OWN, by e-mail. Admins cannot do this — only the ' +
        'owner. An owner cannot remove themselves and cannot remove another owner; the chat ' +
        'service refuses both. The person loses access to anything posted from then on but ' +
        'remains a registered user. Confirm with the user before calling this. Requires the ' +
        'chat:write scope.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group you own.'),
        email: z.string().min(3).describe("The member's registered e-mail address. Use list_group_members to check it."),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        email: z.string(),
        removedUserId: z.string(),
      },
      // Destructive: it takes away access, and this tool cannot put it back — re-adding is a
      // separate deliberate act.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ groupId, email }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await members.removeGroupMember(env, { groupId, email, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok({ success: true, ...payload }, `Removed ${result.email} from the group.`)
    },
  )

  // ── set_group_member_role ─────────────────────────────────────────────────
  //
  // How a group owner DELEGATES. An admin can add members and make invite links but cannot change
  // roles, so appointing one stays with the owner and goes no further. Built 2026-10-02 because a
  // World's main chat group is owned by the World's own address while the person running the
  // platform connects as themselves — the alternative on the table was letting any Superadmin
  // bypass the owner check everywhere, and this removes no check at all.
  server.registerTool(
    'set_group_member_role',
    {
      title: 'Promote or demote a member of a chat group',
      description:
        'Make an existing member of a chat group an admin, or put an admin back to ordinary ' +
        'member. Only the group OWNER can do this — an admin cannot appoint another admin. An ' +
        'admin may add members and create invite links; removing members and changing roles stay ' +
        'with the owner. Ownership itself cannot be granted here: handing over a group is a ' +
        'transfer, not a role change. The owner cannot change their own role either, which would ' +
        'leave the group with nobody able to promote anyone back. Use list_group_members to see ' +
        'who holds what. Requires the chat:write scope.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group you own.'),
        email: z.string().min(3).describe("The member's registered e-mail address."),
        role: z
          .enum(['member', 'admin'])
          .describe('"admin" lets them add members and make invite links; "member" takes that away.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        email: z.string(),
        userId: z.string(),
        role: z.string(),
        previousRole: z.string().nullable(),
      },
      // A write that reaches another person — it changes what they can do — but nothing is lost
      // and it is exactly reversible by the same call with the other role.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ groupId, email, role }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await members.setGroupMemberRole(env, { groupId, email, role, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        result.previousRole && result.previousRole !== result.role
          ? `${result.email} is now ${result.role} of that group (was ${result.previousRole}).`
          : `${result.email} is ${result.role} of that group.`,
      )
    },
  )

  // ── create_group_invite ───────────────────────────────────────────────────
  //
  // The path for someone the system does NOT already know. It keeps the consent with the person
  // joining — they follow the link themselves — which add_group_member cannot do and does not
  // need to, because the people it can add were vetted at registration.
  server.registerTool(
    'create_group_invite',
    {
      title: 'Create an invite link to a chat group',
      description:
        'Create a time-limited invite link to a chat group where you are the owner or an admin. ' +
        'Anyone holding the link can join the group themselves, so treat it as a secret and give ' +
        'it only to the people it is meant for. Use this for someone who is NOT yet a registered ' +
        'VEGR.AI user; for someone who is, add_group_member is direct and needs no link. ' +
        'Requires the chat:write scope.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group you own or administer.'),
        expiresInDays: z
          .number()
          .int()
          .optional()
          .describe('How long the link stays valid, 1–30 days. Default 7. Shorter is safer.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        inviteLink: z.string().nullable(),
        code: z.string().nullable(),
        expiresAt: z.string().nullable(),
        expiresInDays: z.number(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ groupId, expiresInDays }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await members.createGroupInvite(env, { groupId, expiresInDays, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Invite link, valid ${result.expiresInDays} day${result.expiresInDays === 1 ? '' : 's'}:\n${result.inviteLink}\n` +
          'Anyone with this link can join the group. Give it only to the people it is for.',
      )
    },
  )

  // ── list_email_senders ────────────────────────────────────────────────────
  //
  // Behind chat:write rather than a read scope, for the reason list_chat_groups already gives:
  // the list describes where this assistant is allowed to speak.
  server.registerTool(
    'list_email_senders',
    {
      title: 'Addresses you may send e-mail as',
      description:
        "List the e-mail addresses this connection can send FROM, and why each one is allowed: " +
        "either the address is on the authenticated user's own profile, or somebody explicitly " +
        "granted it to them. For a granted address it names who granted it and when the grant " +
        "expires, so the user can see what they are relying on. Call this before preview_email " +
        "rather than asking the user to recall an address, and never guess an address that is not " +
        "in the list — it will be refused. Platform Superadmin status adds nothing to this list. " +
        "It never returns a credential, an account id, or anybody else's addresses. Reading it " +
        "changes nothing and sends nothing. Requires the chat:write scope, the same one sending needs.",
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        count: z.number(),
        senders: z.array(
          z.object({
            email: z.string(),
            fromName: z.string().nullable(),
            basis: z.string(),
            holderEmail: z.string(),
            grantedBy: z.string().nullable(),
            expiresAt: z.string().nullable(),
            note: z.string().nullable(),
            lastVerifiedAt: z.string().nullable(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await mail.listSendableSenders(env, { actor })
      if (!result.ok) return fromService(result)
      const { ok: _o, ...payload } = result
      const lines = result.senders.map((s) =>
        s.basis === 'own-profile'
          ? `${s.email} — your own address`
          : `${s.email} — granted by ${s.grantedBy}${s.expiresAt ? `, expires ${s.expiresAt}` : ''}`,
      )
      return ok(
        { success: true, ...payload },
        result.count === 0
          ? 'You cannot send e-mail as any address. Add a sending account to your profile, or ask ' +
              'an address holder to grant you theirs.'
          : `You may send as:\n${lines.join('\n')}`,
      )
    },
  )

  // ── preview_email ─────────────────────────────────────────────────────────
  //
  // A separate tool rather than a flag on the send, because no connected MCP client declares the
  // `elicitation` capability: this server cannot ask the user anything in the middle of a call. A
  // preview is the only point at which a person reads the text before it leaves, and a tool whose
  // name is not "send" is much harder for a model to reach for when it was asked for a draft.
  server.registerTool(
    'preview_email',
    {
      title: 'Render an e-mail without sending it',
      description:
        "Render exactly what sending would produce, and return it without sending anything. " +
        "USE THIS BEFORE EVERY SEND. No connected MCP client lets this server ask the user a " +
        "question mid-call, so this is the only way the user sees the text before it leaves. It " +
        "resolves the sending address by the same rule a send does, so a refusal here is the " +
        "refusal you would get there — one step earlier, with nothing delivered. It fills the " +
        "sending World's template and the chosen signature, and lists every placeholder no " +
        "variable filled in `unresolvedPlaceholders`; sending REFUSES those rather than delivering " +
        "a literal \"{name}\" to a person. Show the user the `subject` and `html` it returns and " +
        "let them confirm before you send. You may only send as an address on the user's own " +
        "profile or one somebody explicitly granted them — platform Superadmin grants nothing " +
        "here, so call list_email_senders rather than assuming. `sent` is always false: this " +
        "changes nothing, sends nothing and reaches nobody. Requires the chat:write scope.",
      inputSchema: {
        fromEmail: z
          .string()
          .min(3)
          .describe(
            "The address the e-mail comes FROM. Must be one list_email_senders returned — an " +
              "address on your own profile, or one somebody granted you. Being a platform " +
              "Superadmin grants nothing here. Never invent one.",
          ),
        toEmail: z
          .string()
          .min(3)
          .optional()
          .describe('The recipient, if known. Optional for a preview, required to send. One address only.'),
        templatePurpose: z
          .string()
          .optional()
          .describe(
            "Which of the sending World's templates to use, e.g. \"login\". Omit it and pass " +
              "subject + bodyHtml to write the e-mail yourself.",
          ),
        language: z.enum(['no', 'en']).optional().describe('Template language. Default "no".'),
        signature: z
          .string()
          .optional()
          .describe(
            "The signature to append, by its name. Omit for the World's default; pass \"none\" to " +
              "append none. A name that does not exist is refused with the list of names that do.",
          ),
        subject: z
          .string()
          .optional()
          .describe("Subject line. Required when no templatePurpose is given; overrides the template's own subject."),
        bodyHtml: z
          .string()
          .optional()
          .describe(
            'The body as HTML, when writing one directly instead of using a template. This is the ' +
              'ONLY input treated as markup — every value in `variables` is HTML-escaped.',
          ),
        variables: z
          .record(z.string())
          .optional()
          .describe('Values for the {placeholders} in the template and signature. Each one is HTML-escaped.'),
      },
      outputSchema: {
        success: z.boolean(),
        sent: z.boolean(),
        senderEmail: z.string(),
        fromName: z.string().nullable(),
        toEmail: z.string().nullable(),
        domain: z.string(),
        subject: z.string(),
        html: z.string(),
        textPreview: z.string(),
        basis: z.string(),
        grantId: z.string().nullable(),
        templateSource: z.string(),
        signatureName: z.string().nullable(),
        unresolvedPlaceholders: z.array(z.string()),
        warnings: z.array(z.string()),
        characters: z.number(),
      },
      // Renders and returns. Nothing is written, nothing is sent, nobody is reached.
      annotations: READ_ONLY,
    },
    async (args) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await mail.renderEmail(env, { ...args, actor })
      if (!result.ok) {
        // A refused preview earns a log row: an attempt to send as another World's address is
        // precisely the event worth being able to see afterwards, succeeded or not.
        await mail.logSend(env, {
          actorEmail: actor.email,
          senderEmail: String(args.fromEmail || '').toLowerCase(),
          toEmail: args.toEmail,
          outcome: result.code,
          surface: 'mcp-preview',
          clientId: auth?.clientId || null,
        })
        return fromService(result)
      }

      // Whitelisted, not spread. renderEmail carries the holder's address and the sending
      // account — including its id — because sendEmail authenticates with them; neither belongs
      // in a model's context, and the same precedent is set in users-service.js:124-134. Listing
      // the fields here means a future addition there cannot start leaking one.
      const payload = {
        sent: result.sent,
        senderEmail: result.senderEmail,
        fromName: result.fromName,
        toEmail: result.toEmail,
        domain: result.domain,
        subject: result.subject,
        html: result.html,
        textPreview: result.textPreview,
        basis: result.basis,
        grantId: result.grantId,
        templateSource: result.templateSource,
        signatureName: result.signatureName,
        unresolvedPlaceholders: result.unresolvedPlaceholders,
        warnings: result.warnings,
        characters: result.characters,
      }
      const notes = [
        result.unresolvedPlaceholders.length
          ? `Unfilled placeholders: ${result.unresolvedPlaceholders.map((x) => `{${x}}`).join(', ')} — sending will refuse until every one has a value.`
          : null,
        ...result.warnings,
      ].filter(Boolean)
      return ok(
        { success: true, ...payload },
        `NOT SENT — this is a preview.\nFrom: ${result.senderEmail}${result.toEmail ? `\nTo: ${result.toEmail}` : ''}\n` +
          `Subject: ${result.subject}\n` +
          `Signature: ${result.signatureName || 'none'} · Template: ${result.templateSource}\n` +
          (notes.length ? `\n${notes.join('\n')}\n` : '') +
          `\n${result.html}`,
      )
    },
  )

  // ── send_email ────────────────────────────────────────────────────────────
  //
  // The outward one. Everything above it renders; this is the only thing in the e-mail set whose
  // effect leaves the system, and it cannot be taken back.
  server.registerTool(
    'send_email',
    {
      title: 'Send an e-mail',
      description:
        "Send an e-mail. THIS DELIVERS A MESSAGE TO A REAL PERSON AND CANNOT BE UNDONE OR " +
        "RECALLED. Call preview_email first, show the user what it returns, and send only after " +
        "they have confirmed that text — this server cannot ask them anything itself. Takes the " +
        "same arguments as preview_email and produces byte-identical output, with two additions: " +
        "toEmail is required, and an unfilled {placeholder} is REFUSED rather than delivered " +
        "literally. You may only send as an address on the user's own profile or one somebody " +
        "explicitly granted them; platform Superadmin grants nothing here, so use " +
        "list_email_senders rather than assuming. One recipient per call. Requires the chat:write " +
        "scope.",
      inputSchema: {
        fromEmail: z
          .string()
          .min(3)
          .describe(
            "The address the e-mail comes FROM. Must be one list_email_senders returned. Never invent one.",
          ),
        toEmail: z.string().min(3).describe('The recipient. One address only, and it is required here.'),
        templatePurpose: z
          .string()
          .optional()
          .describe("Which of the sending World's templates to use. Omit it and pass subject + bodyHtml instead."),
        language: z.enum(['no', 'en']).optional().describe('Template language. Default "no".'),
        signature: z
          .string()
          .optional()
          .describe("The signature to append, by name. Omit for the World's default; \"none\" appends none."),
        subject: z.string().optional().describe('Subject line. Required when no templatePurpose is given.'),
        bodyHtml: z
          .string()
          .optional()
          .describe('The body as HTML. The ONLY input treated as markup — every value in `variables` is escaped.'),
        variables: z.record(z.string()).optional().describe('Values for the {placeholders}. Each one is HTML-escaped.'),
      },
      outputSchema: {
        success: z.boolean(),
        sent: z.boolean(),
        senderEmail: z.string(),
        toEmail: z.string(),
        subject: z.string(),
        messageId: z.string().nullable(),
        basis: z.string(),
        grantId: z.string().nullable(),
        templateSource: z.string(),
        signatureName: z.string().nullable(),
        characters: z.number(),
        sentCopy: z.string(),
      },
      // The one e-mail tool that reaches outside. Not destructive — nothing is lost — but not
      // idempotent either: calling it twice sends two e-mails to a person.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await mail.sendEmail(env, { ...args, actor, clientId: auth?.clientId || null })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `SENT to ${result.toEmail} from ${result.senderEmail}.\nSubject: ${result.subject}\n` +
          `Signature: ${result.signatureName || 'none'}${result.messageId ? ` · id ${result.messageId}` : ''}\n` +
          'This cannot be recalled.',
      )
    },
  )

  // ── set_email_template ────────────────────────────────────────────────────
  //
  // graph:write, the same scope add_node already needs — because add_node can write these nodes
  // raw today. What it cannot do is find the right graph, create one, fill in the built-in login
  // template, pick a readable accent, place the edit markers, or get the ownership stamp right,
  // and a typo in metadata.purpose produces a template that exists and is invisible to every
  // send. Gating this more tightly than add_node would protect nothing and only push people
  // towards the rawer path.
  server.registerTool(
    'set_email_template',
    {
      title: "Set a World's e-mail template, brand or signature",
      description:
        "Create or update the e-mail template, brand or signature for a World (a domain such as " +
        "\"nibi.no\"). This is what send_email fills in when you give it a templatePurpose, and " +
        "what puts the signature at the bottom of a sent e-mail. Stored in that World's knowledge " +
        "graph, created on first use and found by its tag afterwards. Only a platform Superadmin " +
        "or that World's registered founder may write it, because the login template is what a " +
        "World's members click to sign in. For purpose \"login\" the subject and body are " +
        "OPTIONAL — omit both to get the built-in Norwegian or English template, which is almost " +
        "always better than writing HTML by hand. Pass `signature` alone, with no purpose, to add " +
        "a signature without touching any template. Bodies are HTML with {placeholders}: brand " +
        "values {brandName}, {brandLogo}, {brandAccent}, {brandFooter} are filled from the brand " +
        "node, and anything else must be supplied when sending or the send is refused. Nothing is " +
        "sent by this tool. Requires the graph:write scope.",
      inputSchema: {
        domain: z
          .string()
          .min(3)
          .describe('The World domain, e.g. "nibi.no". It decides both the sending World and which template graph is written.'),
        purpose: z
          .string()
          .optional()
          .describe(
            'Which e-mail this template is for, e.g. "login" or "nyhetsbrev". Matching at send ' +
              'time is EXACT, so reuse a name the World already has rather than inventing a variant. ' +
              'Omit it when you are only adding a signature or brand.',
          ),
        language: z.enum(['no', 'en']).optional().describe('Template language. Defaults to "no".'),
        subject: z
          .string()
          .optional()
          .describe('Subject line, may contain {placeholders}. Optional only for purpose "login".'),
        body: z
          .string()
          .optional()
          .describe('The e-mail body as HTML. Optional only for purpose "login", where the built-in template is used.'),
        brand: z
          .object({
            name: z.string().optional().describe('The World\'s display name, e.g. "NIBI".'),
            logo: z.string().optional().describe('Logo image URL.'),
            accent: z
              .string()
              .optional()
              .describe('Accent colour as hex, or "auto" to pick one from the logo that white button text stays readable on.'),
            fromName: z.string().optional().describe('The display name recipients see in the From line.'),
            fromEmail: z.string().optional().describe("The address this World's mail is sent from, e.g. \"post@nibi.no\"."),
            footer: z.string().optional().describe('Footer line, e.g. "NIBI · nibi.no".'),
          })
          .optional()
          .describe("The World's e-mail brand. Templates pull their colours and footer from it."),
        signature: z
          .object({
            name: z
              .string()
              .describe('The selector a send uses, lowercase letters, digits and hyphens, e.g. "tor-arne". "none" is reserved.'),
            html: z.string().describe('The signature block as HTML.'),
            language: z.string().optional().describe('ISO code, e.g. "no".'),
            isDefault: z.boolean().optional().describe('Use this when a send names no signature. At most one per language.'),
            senderEmail: z.string().optional().describe('Restrict it to one sending address, for a World with several.'),
            personName: z.string().optional().describe('Who it is, e.g. "Tor Arne Håve".'),
            title: z.string().optional().describe('Their role, e.g. "Systemeier".'),
            phone: z.string().optional().describe('Contact number, if the signature shows one.'),
          })
          .optional()
          .describe('An e-mail signature. A World may hold several; a send picks one by name.'),
      },
      outputSchema: {
        success: z.boolean(),
        domain: z.string(),
        graphId: z.string().nullable(),
        nodeId: z.string().nullable(),
        purpose: z.string().nullable(),
        language: z.string().nullable(),
        subject: z.string().nullable(),
        brandUpdated: z.boolean(),
        usedDefaultTemplate: z.boolean(),
        signatureName: z.string().nullable(),
        owner: z.string().nullable(),
        viewUrl: z.string().nullable(),
        message: z.string().nullable(),
      },
      // Writes a node in a graph. It changes what a later send looks like, but by itself it
      // reaches nobody — which is why openWorldHint is false here and true on send_email.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await mailTemplates.setWorldEmailTemplate(env, { ...args, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `${result.message || `Saved for ${result.domain}.`}${result.viewUrl ? `\n${result.viewUrl}` : ''}`,
      )
    },
  )

  // ── read_chat_messages ────────────────────────────────────────────────────
  //
  // The counterpart to post_chat_message, and the one that turns a conversation into something
  // that can become a graph. It reads OTHER PEOPLE's words, so it has its own scope: someone may
  // want an assistant that posts announcements and never reads the discussion.
  server.registerTool(
    'read_chat_messages',
    {
      title: 'Read messages from a chat group',
      description:
        'Read recent messages from a VEGR.AI chat group the authenticated user belongs to, oldest ' +
        'first. Use it to summarise a discussion — for example into a new graph with create_graph. ' +
        'It returns other participants\' messages with their display names, never their e-mail ' +
        'addresses, and only for groups where this assistant\'s bot has been added. Requires the ' +
        'chat:read scope, which is separate from chat:write and granted separately.',
      inputSchema: {
        groupId: z.string().min(1).describe('The group to read. Use list_chat_groups to find one.'),
        limit: z.number().int().optional().describe('How many of the most recent messages to return, 1–200. Default 50.'),
        since: z.string().optional().describe('Only messages after this moment — an ISO timestamp, e.g. 2026-09-27T12:00:00Z.'),
      },
      outputSchema: {
        success: z.boolean(),
        groupId: z.string(),
        groupName: z.string().nullable(),
        count: z.number(),
        messages: z.array(
          z.object({
            id: z.number(),
            sender: z.string().nullable(),
            isBot: z.boolean(),
            isMine: z.boolean(),
            text: z.string(),
            type: z.string(),
            at: z.string(),
          }),
        ),
      },
      // Reading changes nothing. openWorld is false: it reaches no further than this database,
      // even though what it reads was written by other people.
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ groupId, limit, since }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'chat:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const client = await lookupClient(env, auth.clientId)
      const result = await chat.readGroupMessages(env, {
        groupId, limit, since, actor, clientId: auth.clientId, client,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const head = result.count
        ? `${result.count} message${result.count === 1 ? '' : 's'} from "${result.groupName || result.groupId}", oldest first:`
        : `No messages in "${result.groupName || result.groupId}" for that range.`
      const lines = result.messages.map((m) => `[${m.at}] ${m.sender}${m.isBot ? ' (bot)' : ''}: ${m.text}`)
      return ok({ success: true, ...payload }, [head, ...lines].join('\n'))
    },
  )

  // ── get_fulltext_elements ─────────────────────────────────────────────────
  //
  // The grammar a fulltext node's `info` is written in. It is specific to this system, so a
  // model either reads it or invents it — and inventing produces syntax that looks right and
  // renders as literal text. This project has the scar: a `[FLEXBOX-CARDS | gap]` parameter
  // that never existed, written from memory on 2026-07-10.
  //
  // Reads through templates-service, the same function GET /plugin/fulltext-elements uses.
  server.registerTool(
    'get_fulltext_elements',
    {
      title: 'Get the fulltext element syntax',
      description:
        'Return the catalog of VEGR.AI fulltext elements — [FANCY], [SECTION], [QUOTE], the image ' +
        'variants and the rest — each with its exact trigger, format, parameters and notes. ' +
        'CALL THIS BEFORE writing or editing the `info` field of a fulltext node, and copy the ' +
        'format verbatim. The syntax is specific to this system and cannot be inferred from ' +
        'general markdown knowledge; a wrong parameter renders as literal text rather than ' +
        'failing, so a mistake is silent. Pass a name to check one element without pulling the ' +
        'whole catalog into context. Requires the graph:read scope.',
      inputSchema: {
        name: z.string().optional().describe('Check a single element, e.g. "FANCY". Omit for all of them.'),
      },
      outputSchema: {
        success: z.boolean(),
        count: z.number(),
        elements: z.array(
          z.object({
            name: z.string(),
            trigger: z.string().nullable(),
            insertMode: z.string().nullable(),
            format: z.string().nullable(),
            parameters: z.unknown().nullable(),
            notes: z.string().nullable(),
          }),
        ),
        unreadable: z.array(z.string()).optional(),
      },
      // Reference data about the system itself. It touches no user data, which is why the read
      // scope every connection already has is enough.
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ name }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await templates.listFulltextElements(env, { name })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const lines = result.elements.map(
        (e) => `• ${e.name} — trigger ${e.trigger || '?'} (${e.insertMode || 'block'})\n    ${e.format || ''}`,
      )
      return ok(
        { success: true, ...payload },
        [`${result.count} fulltext element${result.count === 1 ? '' : 's'}. Copy each format verbatim:`, ...lines].join('\n'),
      )
    },
  )

  // ── get_image_guide ───────────────────────────────────────────────────────
  //
  // WHY A TOOL AND NOT A PROMPT OR A RESOURCE.
  //
  // MCP has three other ways a server can hand a client guidance, and each was considered:
  //
  //   - prompts/list + prompts/get — user-invoked templates. The user has to know they exist and
  //     pick one from a menu; support across the three clients this server actually serves
  //     (Claude, ChatGPT, Grok) is uneven, and a guide nobody opens is not a guide.
  //   - resources/list + resources/read — the client decides whether to attach it. Same problem.
  //   - elicitation/create — the server asks the USER a question mid-call. This is the closest
  //     thing MCP has to "ask me what I want", but it only works if the client declares the
  //     `elicitation` capability at initialize, and a server that blocks on a question no client
  //     will answer hangs the call. Nothing in this server's audit log records what the three
  //     clients declare, so the honest state is: unmeasured, therefore not relied on.
  //
  // A tool is the one channel every client already uses on its own initiative. get_fulltext_
  // elements proved the pattern with all three: a model that is told in another tool's
  // description to call this first, does. The vocabulary also lives in generate_node_image's own
  // enums, so a client that never calls this still cannot invent a value — this is the long form
  // for when the user asks what their options are, and the enums are the enforcement.
  server.registerTool(
    'get_image_guide',
    {
      title: 'How to ask for an image on this system',
      description:
        'Return everything generate_node_image can be told: the five image models and which ' +
        'parameters each one actually accepts, plus the style, lighting, format, render-trait, ' +
        'text-treatment and quality vocabularies with the exact wording each choice adds to the ' +
        'prompt. CALL THIS when the user asks what their image options are, wants to control ' +
        'quality, size or style, is unhappy with a generated image and wants to know what to ' +
        'change, or asks for something a diffusion model handles badly — text in the picture, a ' +
        'reproducible variation, a specific aspect ratio. The models disagree about which ' +
        'parameters exist at all, so guessing produces a setting that is silently dropped. ' +
        'Requires the graph:read scope.',
      inputSchema: {
        model: z
          .enum(images.IMAGE_MODELS)
          .optional()
          .describe('Limit the model table to one model. Omit to compare all five.'),
      },
      outputSchema: {
        success: z.boolean(),
        defaultModel: z.string(),
        models: z.array(
          z.object({
            model: z.string(),
            maxSteps: z.number(),
            guidance: z.string(),
            seed: z.boolean(),
            negativePrompt: z.boolean(),
            size: z.string(),
          }),
        ),
        quality: z.record(z.string()),
        formats: z.record(z.string()),
        styles: z.record(z.string()),
        lighting: z.record(z.string()),
        renderTraits: z.record(z.string()),
        textTreatments: z.record(z.string()),
        placements: z.record(z.string()),
        howToAsk: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ model }) => {
      const { auth, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      if (!actorFromAuth(auth, props)) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const wanted = model ? [model] : images.IMAGE_MODELS
      const rows = wanted.map((name) => {
        const c = images.MODEL_CAPABILITIES[name]
        return {
          model: name,
          maxSteps: c.stepsRange[1],
          guidance:
            c.guidanceRange === false
              ? 'not supported'
              : c.guidanceRange === null
                ? 'no documented range'
                : `${c.guidanceRange[0]}-${c.guidanceRange[1]}`,
          seed: c.seed,
          negativePrompt: c.negativePrompt,
          size: c.sizeRange === false ? 'fixed, not settable' : `${c.sizeRange[0]}-${c.sizeRange[1]} px`,
        }
      })

      const payload = {
        success: true,
        defaultModel: images.DEFAULT_IMAGE_MODEL,
        models: rows,
        quality: {
          draft: 'fewest steps, fastest, visibly rough',
          standard: "the model's own default",
          high: 'more steps for more detail, proportionally slower',
          max: "the model's documented ceiling",
        },
        formats: Object.fromEntries(
          Object.entries(images.IMAGE_FORMATS).map(([k, v]) => [k, `${v.width}x${v.height}`]),
        ),
        styles: images.IMAGE_STYLES,
        lighting: images.IMAGE_LIGHTING,
        renderTraits: images.IMAGE_RENDER_TRAITS,
        textTreatments: images.IMAGE_TEXT_TREATMENTS,
        placements: {
          header: 'the ![Header|…] image at the top of a node',
          side: 'a ![Leftside-N|…] or ![Rightside-N|…] image with N paragraphs wrapped beside it',
          fancy: 'the background of a [FANCY] block',
        },
        howToAsk: [
          'Put the SUBJECT in prompt and everything else in a named argument — the named values map to wording these models respond to, which prompt adjectives do not reliably do.',
          'For "make it sharper" or "higher quality", pass quality: high or max rather than a steps number; the ceiling differs per model.',
          'For a variation on an image the user liked, keep its seed from the previous reply and change one thing in the prompt. Only lucid-origin, phoenix-1.0 and the two SDXLs have a seed.',
          'For text inside the picture, use imageText and textTreatment, and warn the user the spelling may come out wrong — diffusion models letter unreliably.',
          'negativePrompt does not exist on lucid-origin, the default. Say what you DO want instead.',
          'The reply carries finalPrompt, appliedParams and notes: read notes to the user rather than reporting a setting as applied when the chosen model has no such parameter.',
        ],
      }

      const table = rows
        .map(
          (r) =>
            `• ${r.model.split('/').pop()} — steps ≤${r.maxSteps}, guidance ${r.guidance}, ` +
            `seed ${r.seed ? 'yes' : 'no'}, negative_prompt ${r.negativePrompt ? 'yes' : 'no'}, size ${r.size}`,
        )
        .join('\n')

      const named = (label, obj) => `${label}: ${Object.keys(obj).join(', ')}`

      return ok(
        payload,
        [
          `Default model: ${images.DEFAULT_IMAGE_MODEL}`,
          table,
          '',
          named('quality', payload.quality),
          named('format', payload.formats),
          named('style', images.IMAGE_STYLES),
          named('lighting', images.IMAGE_LIGHTING),
          named('renderTraits', images.IMAGE_RENDER_TRAITS),
          named('textTreatment', images.IMAGE_TEXT_TREATMENTS),
          named('placement', payload.placements),
          '',
          ...payload.howToAsk.map((h) => `- ${h}`),
        ].join('\n'),
      )
    },
  )

  // ── generate_node_image ───────────────────────────────────────────────────
  //
  // The counterpart to get_fulltext_elements. Those element formats ship with placeholder
  // image URLs — HEADERIMG.png, SIDEIMG.png, FANCYIMG.png — so a model that copies a format
  // verbatim has already said "an image goes here, this size, with this much text wrapped
  // beside it". This fills that slot in and nothing else.
  //
  // No image ever crosses the wire. The model sends a prompt; generation, upload and the swap
  // all happen server-side, with the upload running as the authenticated user on a credential
  // read from their own config row. That is deliberate: a base64 image through a tool argument
  // would cost the model's whole context, and a URL from the model's own image tool expires.
  server.registerTool(
    'generate_node_image',
    {
      title: 'Generate the image a node is waiting for',
      description:
        'Generate an image from a text prompt and put it into a fulltext node that already ' +
        'contains an image placeholder. WORKFLOW: call get_fulltext_elements, copy an image ' +
        "element's format verbatim into the node's info (the format already contains the " +
        'placeholder URL), then call this to fill it. It does NOT add an image element to a ' +
        'node that has none — if the placeholder is missing it tells you so rather than ' +
        'guessing where the image belongs. Only the first matching placeholder is replaced, so ' +
        'a node with two pending images takes two calls. Put the SUBJECT in the prompt — what is ' +
        'in the picture — and use the style, lighting and format arguments for how it should ' +
        'look, rather than writing those words into the prompt yourself: they map to wording this ' +
        'image model responds to, and the reply shows the exact text that was sent. Call ' +
        'get_image_guide when the user asks about quality, size, style or reproducibility — the ' +
        'five models accept different parameters and an unsupported one is dropped. Requires the ' +
        'graph:write scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph containing the node.'),
        nodeId: z.string().min(1).describe('The node whose placeholder to fill.'),
        prompt: z
          .string()
          .min(1)
          .describe('What to draw. Describe the image, not the topic: subject, setting, style, lighting, mood.'),
        placement: z
          .enum(['header', 'side', 'fancy'])
          .optional()
          .describe(
            'Which placeholder to replace, matching the element already in the node: "header" for ' +
              '![Header|…] (HEADERIMG.png), "side" for ![Leftside-N|…] or ![Rightside-N|…] ' +
              '(SIDEIMG.png — the N is how many following paragraphs wrap beside the image, and it ' +
              'is part of the element, not something this tool sets), "fancy" for a [FANCY] block ' +
              'background (FANCYIMG.png). Default "header".',
          ),
        style: z
          .enum(Object.keys(images.IMAGE_STYLES))
          .optional()
          .describe(
            'Visual treatment. Pick the one matching what the user asked for in their own words — ' +
              '"make it look like a photo" is photoreal, "like a film still" is cinematic, ' +
              '"for an article" is editorial. Each adds wording this model is known to respond to, ' +
              'so choosing one beats writing style adjectives into the prompt yourself.',
          ),
        lighting: z
          .enum(Object.keys(images.IMAGE_LIGHTING))
          .optional()
          .describe('Lighting treatment, e.g. golden-hour for warm low sun, nordic-twilight for cool blue hour. Omit unless the user implies one.'),
        format: z
          .enum(Object.keys(images.IMAGE_FORMATS))
          .optional()
          .describe(
            'Aspect ratio and size, named. landscape-16:9 (1120x630) suits a header; square-1:1 ' +
              'a thumbnail; portrait-4:5 or story-9:16 a vertical image. Prefer this over width ' +
              'and height — the numbers are the ones the Vegvisr chat UI uses.',
          ),
        renderTraits: z
          .array(z.enum(Object.keys(images.IMAGE_RENDER_TRAITS)))
          .optional()
          .describe(
            'Camera and film characteristics, several at once. Use when the user asks for a ' +
              'photographic look: shallow-depth-of-field for a blurred background, film-grain for ' +
              'an analogue feel, long-exposure for smooth water or light trails.',
          ),
        imageText: z
          .string()
          .optional()
          .describe(
            'Words that should APPEAR IN the picture — a poster title, a sign, a logo. Leave it ' +
              'out for an ordinary illustration: image models render lettering unreliably, so ask ' +
              'for text only when the words are the point, and tell the user the spelling may come ' +
              'out wrong.',
          ),
        textTreatment: z
          .enum(Object.keys(images.IMAGE_TEXT_TREATMENTS))
          .optional()
          .describe('How the lettering should look. Only meaningful together with imageText.'),
        model: z
          .enum(images.IMAGE_MODELS)
          .optional()
          .describe(
            'Which image model to use. Omit for the default, Lucid Origin, which is the most ' +
              'prompt-responsive of the ones available. Pick ' +
              '"@cf/bytedance/stable-diffusion-xl-lightning" only when speed matters more than ' +
              'the result — it is a distilled model that runs in a few steps and looks it.',
          ),
        quality: z
          .enum(images.IMAGE_QUALITY_LEVELS)
          .optional()
          .describe(
            'How many diffusion steps to spend, named rather than numbered because each model ' +
              'has a different ceiling. Use this when the user says something like "make it ' +
              'sharper", "high quality" or "just a quick draft": "draft" is fastest and looks ' +
              'it, "standard" is the model default, "high" and "max" spend more steps for more ' +
              'detail and take proportionally longer. Prefer this over steps.',
          ),
        steps: z
          .number()
          .int()
          .optional()
          .describe(
            'Diffusion steps as an exact number, for a caller who knows the model. Overrides ' +
              'quality. Ceilings differ per model — 40 for lucid-origin, 50 for phoenix-1.0, ' +
              '20 for the two SDXL models — and a number above the ceiling is ' +
              'lowered to it and reported in notes rather than refused. See get_image_guide.',
          ),
        guidance: z
          .number()
          .optional()
          .describe(
            'How literally the model follows the prompt. Higher sticks closer to the words and ' +
              'lower leaves the model more freedom. 0–10 for lucid-origin, 2–10 for ' +
              'phoenix-1.0; the SDXL models document no range. Omit unless the user complains ' +
              'the picture ignored part of their description.',
          ),
        seed: z
          .number()
          .int()
          .optional()
          .describe(
            'Fixes the randomness so the SAME prompt and seed give the same picture again. Use ' +
              'it when the user wants a variation on an image they liked: keep the seed from the ' +
              'previous reply and change one thing in the prompt. Every model offered here has a ' +
              'seed, so any image can be reproduced.',
          ),
        negativePrompt: z
          .string()
          .optional()
          .describe(
            'What to keep OUT of the picture, e.g. "text, watermark, extra fingers". Supported ' +
              'by phoenix-1.0 and the two SDXL models only — lucid-origin, the default, has ' +
              'no such parameter and will say so in notes.',
          ),
        width: z
          .number()
          .int()
          .optional()
          .describe(
            'Pixel width, rounded to a multiple of 8 and clamped to what the model takes (up to ' +
              '2496 for lucid-origin, 2048 for the rest; every side is rounded to a multiple of 8, ' +
              'which the models require). Prefer format.',
          ),
        height: z
          .number()
          .int()
          .optional()
          .describe('Pixel height, same rules as width. Prefer format.'),
        expectedVersion: z
          .number()
          .int()
          .optional()
          .describe("The version from get_graph. Omit to use the graph's current version — safe when nothing else is editing it."),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        nodeId: z.string(),
        placement: z.string(),
        imageUrl: z.string(),
        model: z.string(),
        finalPrompt: z.string(),
        appliedParams: z.record(z.any()).optional(),
        notes: z.array(z.string()).optional(),
        replaced: z.string(),
        remainingPlaceholders: z.number(),
        currentVersion: z.number(),
        newVersion: z.number(),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // A write, but it only overwrites a placeholder it verified was there, so nothing the
      // user wrote is lost. Not idempotent: calling twice generates a second, different image —
      // though the second call finds no placeholder left and refuses, which is the intent.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({
      graphId,
      nodeId,
      prompt,
      placement,
      width,
      height,
      expectedVersion,
      model,
      style,
      lighting,
      format,
      renderTraits,
      imageText,
      textTreatment,
      quality,
      steps,
      guidance,
      seed,
      negativePrompt,
    }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await images.generateImageForNode(env, {
        graphId,
        nodeId,
        prompt,
        placement: placement || 'header',
        width: width ?? null,
        height: height ?? null,
        model: model ?? null,
        style: style ?? null,
        lighting: lighting ?? null,
        format: format ?? null,
        renderTraits: renderTraits ?? null,
        imageText: imageText ?? null,
        textTreatment: textTreatment ?? null,
        quality: quality ?? null,
        steps: Number.isFinite(steps) ? steps : null,
        guidance: Number.isFinite(guidance) ? guidance : null,
        // `?? null` and not a truthiness test: seed 0 is a legal, reproducible seed.
        seed: seed ?? null,
        negativePrompt: negativePrompt ?? null,
        expectedVersion: Number.isInteger(expectedVersion) ? expectedVersion : null,
        actor,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const left = result.remainingPlaceholders
      return ok(
        { success: true, ...payload },
        `Image generated with ${result.model} and placed in node ${nodeId}.\n${result.imageUrl}\n` +
          `Prompt sent: ${result.finalPrompt}\n` +
          (result.notes?.length ? `Adjusted for this model:\n- ${result.notes.join('\n- ')}\n` : '') +
          (left > 0
            ? `${left} more ${result.placement} placeholder${left === 1 ? '' : 's'} left in this node.\n`
            : '') +
          `Version ${result.currentVersion} → ${result.newVersion}.\nViewer: ${result.viewerUrl}`,
      )
    },
  )

  // ── compose_node_image ────────────────────────────────────────────────────
  //
  // The sibling of generate_node_image, and a different provider underneath. Workers AI cannot
  // hold onto a SPECIFIC subject across a new scene — lucid-origin and phoenix take no image
  // input at all — so this goes out to gpt-image-2.5 through openai-worker. It is the only tool
  // here whose cost is worth a caller's attention, which is why the reply states it.
  server.registerTool(
    'compose_node_image',
    {
      title: 'Compose a node image from reference pictures',
      description:
        'Make an image FROM one to four reference pictures you already have URLs for, and put it ' +
        'into a fulltext node that contains an image placeholder. Use this when the point is a ' +
        'SPECIFIC thing rather than a described one — this exact product, mascot, person or logo, ' +
        'placed in a new scene, or two of them combined. generate_node_image is the right tool ' +
        'when a description is enough; this one is slower and costs real money per call. ' +
        'ORDER MATTERS: write the prompt referring to "the first reference image", "the second", ' +
        'and so on, matching the order of referenceImageUrls — that wording is the only thing ' +
        'telling them apart. List every feature that must survive (exact colours, markings, ' +
        'clothing), because what you do not name may change. The URLs must be on a VEGR.AI host ' +
        'such as vegvisr.imgix.net; anything else is refused. Requires the graph:write scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph containing the node.'),
        nodeId: z.string().min(1).describe('The node whose placeholder to fill.'),
        prompt: z
          .string()
          .min(1)
          .describe(
            'What to make, naming each reference by position and listing every feature that must ' +
              'be preserved. Example: "The exact green plush rabbit from the first reference ' +
              'image, jumping in a meadow, keeping its pink scarf and red shoes, with the emblem ' +
              'from the second reference image embroidered on its chest."',
          ),
        referenceImageUrls: z
          .array(z.string().min(1))
          .min(1)
          .max(4)
          .describe('One to four https image URLs on a VEGR.AI host, in the order the prompt refers to them.'),
        placement: z
          .enum(['header', 'side', 'fancy'])
          .optional()
          .describe('Which placeholder to replace, matching the element already in the node. Default "header".'),
        format: z
          .enum(Object.keys(images.COMPOSE_FORMATS))
          .optional()
          .describe(
            'Aspect ratio and size, named — the same names generate_node_image uses, at sizes ' +
              'this model renders exactly. Omit to let it choose.',
          ),
        quality: z
          .enum(images.COMPOSE_QUALITIES)
          .optional()
          .describe(
            'Default "low", which answers in about 13 seconds. "high" takes about 33 and costs ' +
              'roughly four times as much — ask the user before choosing it. A still higher ' +
              'setting exists but takes about 99 seconds, longer than this connection waits, so ' +
              'it is only available in the Agent Builder.',
          ),
        expectedVersion: z
          .number()
          .int()
          .optional()
          .describe("The version from get_graph. Omit to use the graph's current version."),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        nodeId: z.string(),
        placement: z.string(),
        imageUrl: z.string(),
        model: z.string(),
        quality: z.string(),
        size: z.string(),
        referenceImages: z.number(),
        costUsd: z.number().nullable(),
        durationMs: z.number().nullable(),
        replaced: z.string(),
        remainingPlaceholders: z.number(),
        currentVersion: z.number(),
        newVersion: z.number(),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // A write that only overwrites a placeholder it verified was there. Not idempotent: a
      // second call makes a different picture and costs again. openWorld, because the reference
      // images are fetched and the composition happens at a third party.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ graphId, nodeId, prompt, referenceImageUrls, placement, format, quality, expectedVersion }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await images.composeImageForNode(env, {
        graphId,
        nodeId,
        prompt,
        referenceImageUrls,
        placement: placement || 'header',
        format: format ?? null,
        quality: quality || 'low',
        expectedVersion: Number.isInteger(expectedVersion) ? expectedVersion : null,
        actor,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Composed from ${result.referenceImages} reference image${result.referenceImages === 1 ? '' : 's'} ` +
          `at ${result.quality} quality and placed in node ${nodeId}.\n${result.imageUrl}\n` +
          (result.costUsd !== null ? `Cost: $${result.costUsd} · ${Math.round((result.durationMs || 0) / 1000)}s\n` : '') +
          `Version ${result.currentVersion} → ${result.newVersion}.\nViewer: ${result.viewerUrl}`,
      )
    },
  )

  // ── update_graph_metadata ─────────────────────────────────────────────────
  //
  // Wraps graph-service's updateMetadata, which was written and tested when graphService was
  // extracted but never given a caller — index.js imports it and never calls it. This is its
  // first one, so the guard rails are here rather than assumed to exist upstream.
  //
  // publicationState is deliberately absent from the schema. The service refuses it too, but a
  // model should not see a field it cannot use: publishing is its own audited action.
  server.registerTool(
    'update_graph_metadata',
    {
      title: 'Update a graph\'s title, description, meta areas or category',
      description:
        "Change a graph's metadata without touching its nodes or edges. THE FIELDS YOU PASS " +
        'REPLACE THE OLD VALUES ENTIRELY — metaArea is a single space-separated string, so to ' +
        'ADD a tag you must read the current value with get_graph and send the whole new string ' +
        'including the tags that were already there. Sending only the new tag silently deletes ' +
        'the rest. Meta-area tags are written #LIKETHIS, uppercase, separated by spaces. ' +
        'Anything you omit is left untouched. This cannot publish or unpublish a graph and ' +
        'cannot change who created it. Requires the graph:write scope.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph to update.'),
        fields: z
          .object({
            title: z.string().optional().describe('New title. Replaces the old one.'),
            description: z.string().optional().describe('New description. Replaces the old one.'),
            metaArea: z
              .string()
              .optional()
              .describe(
                'The COMPLETE new meta-area string, e.g. "#MAIKENSNEEGGEN #LIVINGART #OFFER". ' +
                  'This replaces the whole value — read the current one first and include every ' +
                  'tag you want to keep.',
              ),
            category: z.string().optional().describe('New category, e.g. "#Uncategorized".'),
          })
          .describe('The metadata fields to change. Omit a field to leave it alone.'),
        expectedVersion: z
          .number()
          .int()
          .optional()
          .describe(
            'Optional concurrency guard. Omit it to use the graph\'s current version. Note this ' +
              'is the VERSION HISTORY number, which for a handful of older graphs differs from ' +
              'the version get_graph reports — so prefer omitting it over copying that one.',
          ),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        newVersion: z.number(),
        title: z.string().nullable(),
        metaArea: z.string().nullable(),
        publicationState: z.string(),
        updatedFields: z.array(z.string()),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // A write that replaces existing values, so destructive — a metaArea sent without the
      // existing tags loses them. Idempotent: applying the same fields twice lands on the same
      // metadata (the version moves, the content does not).
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ graphId, fields, expectedVersion }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const access = await gs.checkAccess(env, actor, graphId, 'write')
      if (!access.ok) return fromService(access)

      if (!fields || Object.keys(fields).length === 0) {
        return err(gs.ERR.INVALID_INPUT, 'fields must name at least one metadata field to change.')
      }

      // updateMetadata compares against MAX(version) in the history table, NOT metadata.version.
      // The two agree for all but nine of the graphs in production, and a model that copied the
      // version out of get_graph would hit a conflict it could not explain. Defaulting from the
      // source the service actually reads removes the trap.
      const version = Number.isInteger(expectedVersion)
        ? expectedVersion
        : await gs.currentVersion(env, graphId)

      const result = await gs.updateMetadata(env, { graphId, fields, expectedVersion: version, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      const updatedFields = Object.keys(fields)
      return ok(
        { success: true, ...payload, updatedFields },
        `Updated ${updatedFields.join(', ')} on graph ${graphId}.` +
          (result.metaArea ? `\nMeta areas are now: ${result.metaArea}` : '') +
          `\nVersion is now ${result.newVersion}.\nViewer: ${result.viewerUrl}`,
      )
    },
  )

  // ── publish_html_node ─────────────────────────────────────────────────────
  //
  // The only tool here that puts something on the public internet. It is narrowed twice over
  // compared with the same action in the Agent Builder:
  //
  //   * graph:publish is not advertised, so no client can request it. It is granted only by a
  //     person ticking an unticked box on the consent screen, for one authorization at a time.
  //   * the host must be one the node already points at. The Agent Builder lets a Superadmin
  //     publish anywhere and override the guard with force:true; that override is simply not
  //     reachable from here, so a model cannot take over another World's host by naming it.
  //
  // The publishing itself is agent-worker's executePublishHtmlNode, reached over a service
  // binding. There is no second implementation.
  server.registerTool(
    'publish_html_node',
    {
      title: 'Republish an html-node to its live site',
      description:
        'Push an html-node\'s current HTML to the live website it already serves, replacing what ' +
        'is there. THIS PUTS CONTENT ON THE PUBLIC INTERNET AND REPLACES THE EXISTING PAGE — ' +
        'confirm with the user before calling it. It can only publish to a host the node is ' +
        'ALREADY associated with, so it republishes an existing site and can neither create a new ' +
        'one nor take over a different address; if you are unsure which host a node belongs to, ' +
        'call list_published_sites rather than guessing. Check `verified` in the result: only ' +
        'verified:true means the page is actually live. Requires the graph:publish scope, which ' +
        'an ordinary connection does not carry.',
      inputSchema: {
        graphId: z.string().min(1).describe('The graph containing the html-node.'),
        nodeId: z.string().min(1).describe('The html-node (or css-node) to publish.'),
        host: z
          .string()
          .min(1)
          .describe(
            'The live host to republish, e.g. "fonemer.vegvisr.org". Must be a host this node is ' +
              'already associated with — read it from list_published_sites or the node itself, never invent it.',
          ),
        versionPill: z
          .boolean()
          .optional()
          .describe('Show a small version pill on the served page (host, version, publish time). Omit to keep the current setting.'),
      },
      outputSchema: {
        success: z.boolean(),
        graphId: z.string(),
        nodeId: z.string(),
        host: z.string(),
        siteUrl: z.string(),
        verified: z.boolean(),
        message: z.string().nullable(),
        editorUrl: z.string(),
        viewerUrl: z.string(),
      },
      // Destructive: it replaces whatever page is currently served at that host. openWorldHint
      // because, like chat, its effect leaves this system and is seen by other people.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ graphId, nodeId, host, versionPill }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:publish')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await publish.publishHtmlNode(env, {
        graphId,
        nodeId,
        host,
        versionPill: typeof versionPill === 'boolean' ? versionPill : null,
        actor,
      })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        result.verified
          ? `Published node ${nodeId} to ${result.siteUrl} — verified live.`
          : `Published node ${nodeId} to ${result.siteUrl}, but the page could NOT be verified as live. ` +
            `Report it as not live. ${result.message || ''}`.trim(),
      )
    },
  )

  // ── register_user ─────────────────────────────────────────────────────────
  //
  // Creates a login for a REAL PERSON, so it is gated like the other outward-facing tools:
  // user:register is not advertised, cannot be requested by a client, and is granted only by a
  // ticked box on the consent screen. Superadmin is not assignable here — that would make
  // "register a user" a privilege-escalation path.
  //
  // The account work is agent-worker's executeAdminRegisterUser, reached over a service binding.
  server.registerTool(
    'register_user',
    {
      title: 'Register a person on the platform',
      description:
        'Create a user account from a name and an email address so that person can sign in at ' +
        'login.vegvisr.org. THIS CREATES AN ACCOUNT FOR A REAL PERSON — confirm the name and the ' +
        'exact email with the user before calling it. An email that is ALREADY REGISTERED is ' +
        'refused and nothing is changed, so this can never quietly edit a stranger\'s record; ' +
        'use list_users to check first, or to find who holds the address. To update phone, ' +
        'postal address, or name on an account that already exists, use update_user_profile ' +
        'instead. A phone number is worth ' +
        'adding when you have it, because it is what lets them sign in by SMS code. The sign-in ' +
        'credential is never returned. Requires the user:register scope, which an ordinary ' +
        'connection does not carry.',
      inputSchema: {
        email: z.string().min(3).describe("The person's email address. This is the identity — it is how they sign in, and it is what makes the call idempotent."),
        name: z.string().optional().describe("The person's full name."),
        phone: z.string().optional().describe('Mobile number in +47XXXXXXXX form. Optional, but without it they cannot sign in by SMS code. Marked verified immediately — usable for SMS sign-in and chat-group membership right away, no OTP step needed.'),
        groupTags: z
          .string()
          .optional()
          .describe('Which group(s) this person belongs to, as space-separated tags, e.g. "#IIBA #DEMO". Written in the same style as a graph\'s metaArea; a missing # is added for you.'),
        role: z
          .enum(users.ASSIGNABLE_ROLES)
          .optional()
          .describe(
            'What the person may do. OMIT THIS for a normal person who will use the platform — ' +
              'it defaults to "Admin", which is the ordinary member role here despite the name. ' +
              'Pass "ViewOnly" only when they should be able to read but not change anything. ' +
              'Superadmin cannot be granted through this connection.',
          ),
      },
      outputSchema: {
        success: z.boolean(),
        userId: z.string().nullable(),
        email: z.string().nullable(),
        name: z.string().nullable(),
        role: z.string().nullable(),
        groupTags: z.string().nullable(),
        created: z.boolean(),
        loginUrl: z.string(),
        message: z.string().nullable(),
      },
      // Creates a real account, and the person may receive mail about it — its effect leaves the
      // system. Not destructive: an existing account is completed, never replaced. Idempotent on
      // email, which is why calling it twice is safe.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ email, name, phone, role, groupTags }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'user:register')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const result = await users.registerUser(env, { email, name, phone, role, groupTags, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Registered ${result.email}${result.name ? ` (${result.name})` : ''} with role ${result.role}` +
          `${result.groupTags ? ` in ${result.groupTags}` : ''}. ` +
          `They sign in at ${result.loginUrl} using that email.`,
      )
    },
  )

  // ── list_users ────────────────────────────────────────────────────────────
  //
  // Other people's contact details, so it is behind its own opt-in rather than riding along with
  // user:register — the same split as chat:read from chat:write. Reading about people who did not
  // ask to be in this conversation is a different decision from adding one.
  //
  // Superadmin only, and emailVerificationToken is never selected by the query, so it cannot be
  // returned by accident.
  server.registerTool(
    'list_users',
    {
      title: 'List registered people',
      description:
        'List the people registered on the platform, with name, email, role and group tags. Use ' +
        'it to check whether someone already has an account before calling register_user, to find ' +
        'who holds an address, or to see who belongs to a group. THIS RETURNS OTHER PEOPLE\'S ' +
        'CONTACT DETAILS into the conversation — ask for the narrowest filter that answers the ' +
        'question rather than pulling the whole directory. Sign-in credentials and phone numbers ' +
        'are never returned; the reply only says whether an SMS sign-in is possible. Requires the ' +
        'user:read scope and the Superadmin role.',
      inputSchema: {
        groupTag: z.string().optional().describe('Only people in this group, e.g. "#IIBA". One tag at a time.'),
        query: z.string().optional().describe('Free text matched against email and name.'),
        limit: z.number().int().optional().describe('Maximum people to return, 1–500. Default 100.'),
      },
      outputSchema: {
        success: z.boolean(),
        count: z.number(),
        limit: z.number(),
        users: z.array(
          z.object({
            email: z.string(),
            name: z.string().nullable(),
            role: z.string().nullable(),
            groupTags: z.string().nullable(),
            canSignInBySms: z.boolean(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ groupTag, query, limit }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'user:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await users.listUsers(env, { actor, groupTag, query, limit })
      if (!r.ok) return fromService(r)

      const { ok: _o, ...payload } = r
      const head = r.count === 0 ? 'Nobody matched.' : `${r.count} registered ${r.count === 1 ? 'person' : 'people'}:`
      const lines = r.users.map(
        (u) => `• ${u.name || '(no name)'} — ${u.email} · ${u.role || 'no role'}` +
          `${u.groupTags ? ` · ${u.groupTags}` : ''}${u.canSignInBySms ? '' : ' · no phone'}`,
      )
      return ok({ success: true, ...payload }, [head, ...lines].join('\n'))
    },
  )

  // ── set_user_groups ───────────────────────────────────────────────────────
  //
  // register_user refuses an email that already exists, which left no way to tag someone who is
  // already registered. This is that way. It shares user:register — the scope that covers writing
  // to the user directory — rather than adding a sixth opt-in that would force another reconnect.
  server.registerTool(
    'set_user_groups',
    {
      title: 'Change which groups a person belongs to',
      description:
        "Add, replace or remove group tags on someone who is ALREADY registered. Use mode 'add' " +
        "to put them in another group while keeping the ones they have, 'replace' to set the " +
        "whole list, and 'remove' to take a group away. Tags are written like \"#IIBA #DEMO\"; a " +
        'missing # is added for you. For someone who does not have an account yet, use ' +
        'register_user instead — it takes groupTags directly. Requires the user:register scope ' +
        'and the Superadmin role.',
      inputSchema: {
        email: z.string().min(3).describe('The registered person to change.'),
        groupTags: z.string().min(1).describe('The tags to act on, e.g. "#IIBA" or "#IIBA #DEMO".'),
        mode: z
          .enum(['add', 'replace', 'remove'])
          .optional()
          .describe("What to do with them. 'add' (default) keeps existing tags, 'replace' sets exactly these, 'remove' takes them away."),
      },
      outputSchema: {
        success: z.boolean(),
        email: z.string(),
        groupTags: z.string().nullable(),
        before: z.string().nullable(),
        changed: z.boolean(),
      },
      // Writes to someone's record, but only this one field, and the reply shows before and
      // after. Idempotent: adding a tag they already have changes nothing and says so.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ email, groupTags, mode }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'user:register')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await users.setUserGroups(env, { email, groupTags, mode: mode || 'add', actor })
      if (!r.ok) return fromService(r)

      const { ok: _o, ...payload } = r
      return ok(
        { success: true, ...payload },
        r.changed
          ? `${r.email}: ${r.before || '(no groups)'} → ${r.groupTags || '(no groups)'}`
          : `${r.email} was already ${r.groupTags ? `in ${r.groupTags}` : 'in no groups'}. Nothing changed.`,
      )
    },
  )

  // ── update_user_profile ───────────────────────────────────────────────────
  //
  // register_user refuses an email that already exists, which also left no way to update
  // contact info — phone, address, etc. — on an account once it was created. Same split as
  // set_user_groups just above: a sibling tool for the existing-account case, sharing
  // user:register rather than adding a new opt-in scope.
  server.registerTool(
    'update_user_profile',
    {
      title: "Update a member's contact info",
      description:
        'Update phone, address, street, postal code, place, city, country or name for someone ' +
        'who is ALREADY registered. Only the fields you supply change — everything else, ' +
        'including role and group tags, is left alone. Fails if the email is not registered. ' +
        'For someone who does not have an account yet, use register_user instead — it takes ' +
        'these same contact fields directly. Requires the user:register scope and the ' +
        'Superadmin role.',
      inputSchema: {
        email: z.string().min(3).describe('The already-registered person to update.'),
        phone: z.string().optional().describe('Mobile number in +47XXXXXXXX form. Marked verified immediately if it is new or different from what was on file — usable for SMS sign-in and chat-group membership right away, no OTP step needed.'),
        address: z.string().optional().describe('Address line.'),
        street: z.string().optional().describe('Street or road name.'),
        postalCode: z.string().optional().describe('Postal code.'),
        place: z.string().optional().describe('Postal place/locality.'),
        city: z.string().optional().describe('City/municipality.'),
        country: z.string().optional().describe('Country.'),
        name: z.string().optional().describe("The person's full name."),
      },
      outputSchema: {
        success: z.boolean(),
        email: z.string(),
        name: z.string().nullable(),
        phone: z.string().nullable(),
        address: z.string().nullable(),
        street: z.string().nullable(),
        postalCode: z.string().nullable(),
        place: z.string().nullable(),
        city: z.string().nullable(),
        country: z.string().nullable(),
        changed: z.boolean(),
      },
      // Writes to someone's own contact fields only — never role, never group_tags, and nothing
      // leaves this system.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ email, phone, address, street, postalCode, place, city, country, name }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'user:register')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await users.updateUserProfile(env, { email, phone, address, street, postalCode, place, city, country, name, actor })
      if (!r.ok) return fromService(r)

      const { ok: _o, ...payload } = r
      const changedFields = Object.entries({ phone, address, street, postalCode, place, city, country, name })
        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
        .map(([k]) => k)
      return ok(
        { success: true, ...payload },
        `${r.email} updated: ${changedFields.join(', ') || 'nothing supplied'}.`,
      )
    },
  )

  // ── set_user_role ─────────────────────────────────────────────────────────
  //
  // register_user does not re-rank an existing account, on purpose — completing a profile must
  // not change what someone may do. That left no way to change a role at all, so a role passed
  // to registration came back "success" with the ranking untouched.
  server.registerTool(
    'set_user_role',
    {
      title: "Change a registered person's role",
      description:
        'Change what an already-registered person may do. This is the ONLY way to change a role: ' +
        'register_user completes a profile but deliberately leaves the existing role alone, so ' +
        'passing a role there does nothing for someone who already has an account. Superadmin ' +
        'cannot be granted here, and a person who already IS Superadmin cannot be changed. ' +
        'Requires the user:register scope and the Superadmin role.',
      inputSchema: {
        email: z.string().min(3).describe('The registered person whose role to change.'),
        role: z.enum(users.ASSIGNABLE_ROLES).describe('The new role. Admin is the ordinary member role here; ViewOnly can read but not change.'),
      },
      outputSchema: {
        success: z.boolean(),
        email: z.string(),
        role: z.string(),
        previousRole: z.string().nullable(),
        changed: z.boolean(),
      },
      // Changes what a person may do, so destructive in the sense that it can take access away.
      // Idempotent: setting the role they already have reports changed:false.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ email, role }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'user:register')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await users.setUserRole(env, { email, role, actor })
      if (!r.ok) return fromService(r)

      const { ok: _o, ...payload } = r
      return ok(
        { success: true, ...payload },
        r.changed
          ? `${r.email}: role ${r.previousRole || '(none)'} → ${r.role}.`
          : `${r.email} already had role ${r.role}. Nothing changed.`,
      )
    },
  )

  // ── list_meta_areas ───────────────────────────────────────────────────────
  //
  // The map before the territory. Without it the only way to learn which meta areas exist was to
  // page every graph — 675 of them here — or to open each one. The counts come from the same
  // tokenisation GET /getmetaareas uses, so the two surfaces cannot disagree about the same data.
  server.registerTool(
    'list_meta_areas',
    {
      title: 'List the meta areas used across my graphs',
      description:
        'Return every meta area used by the graphs the authenticated user owns, with how many ' +
        'graphs each covers, most-used first, plus how many graphs have no meta area at all. ' +
        'CALL THIS BEFORE filtering by metaArea, so the filter uses a tag that exists rather than ' +
        'a guess. One graph can carry several tags ("#NIBI #VEGR.AI") and is counted under each, ' +
        'so the counts add up to more than the number of graphs. Requires the graph:read scope.',
      inputSchema: {},
      outputSchema: {
        success: z.boolean(),
        count: z.number(),
        untagged: z.number(),
        totalGraphs: z.number(),
        metaAreas: z.array(z.object({ metaArea: z.string(), graphCount: z.number() })),
      },
      annotations: READ_ONLY,
    },
    async () => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await gs.listMetaAreas(env, { actor })
      if (!r.ok) return fromService(r)

      const { ok: _o, ...payload } = r
      const lines = r.metaAreas.map((m) => `${m.metaArea} — ${m.graphCount} graph${m.graphCount === 1 ? '' : 's'}`)
      if (r.untagged) lines.push(`(none) — ${r.untagged} graph${r.untagged === 1 ? '' : 's'}`)
      const head = r.count === 0
        ? `None of your ${r.totalGraphs} graphs has a meta area.`
        : `${r.count} meta area${r.count === 1 ? '' : 's'} across ${r.totalGraphs} graphs you own:`
      return ok({ success: true, ...payload }, [head, ...lines].join('\n'))
    },
  )

  // ── list_published_sites ──────────────────────────────────────────────────
  //
  // The portfolio's "Published sites" chip, as data. brand-worker writes an HTML_PAGES key
  // `html:<hostname>` on every html-node publish, and its metadata names the graph and the node
  // that serves it. That registry is the authority — a node's own publishedDomain stamp is
  // written client-side and survives a later publish that handed the host to someone else.
  //
  // A host whose graph the caller cannot read is omitted. The page it serves is public; the
  // graph behind it, its title and its owner are not.
  server.registerTool(
    'list_published_sites',
    {
      title: 'List live sites and the graphs behind them',
      description:
        'List the domains that currently serve a published html-node, each with the graph and ' +
        'the node id it is served from, when it was published, and links to open the graph. ' +
        'This is the answer to "which of my graphs are live, and where" — the same registry the ' +
        'Knowledge Graph Portfolio\'s "Published sites" filter reads. Pass a domain to check one ' +
        'host or a family of them; pass a graphId to ask what one graph publishes. Only sites ' +
        'whose graph you can read are listed. Requires the graph:read scope.',
      inputSchema: {
        domain: z
          .string()
          .optional()
          .describe('Narrow to hostnames containing this text, e.g. "vegvisr.org" or "minside". A full URL works too.'),
        graphId: z.string().optional().describe('Only the sites this one graph serves.'),
        limit: z.number().int().optional().describe('Maximum sites to return, 1–500. Default 100.'),
      },
      outputSchema: {
        success: z.boolean(),
        count: z.number(),
        totalRegistered: z.number(),
        sites: z.array(
          z.object({
            hostname: z.string(),
            siteUrl: z.string(),
            graphId: z.string(),
            nodeId: z.string().nullable(),
            title: z.string(),
            metaArea: z.string().nullable(),
            publicationState: z.string(),
            publishedAt: z.string().nullable(),
            editorUrl: z.string(),
            viewerUrl: z.string(),
          }),
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ domain, graphId, limit }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await sites.listPublishedSites(env, { actor, domain, graphId, limit })
      if (!r.ok) return fromService(r)

      const hidden = r.totalRegistered - r.count
      const head = r.count === 0
        ? 'No published sites you can see match that.'
        : `${r.count} published site${r.count === 1 ? '' : 's'}` +
          (hidden > 0 ? ` (${hidden} more belong to graphs you cannot read).` : '.')
      const lines = r.sites.map(
        (x) => `• ${x.hostname} — ${x.title} · graph ${x.graphId}` +
          `${x.nodeId ? ` · node ${x.nodeId}` : ''}${x.publishedAt ? ` · published ${x.publishedAt}` : ''}\n    ${x.viewerUrl}`,
      )
      const { ok: _o, ...payload } = r
      return ok({ success: true, ...payload }, [head, ...lines].join('\n'))
    },
  )

  // ── search_graphs ─────────────────────────────────────────────────────────
  server.registerTool(
    'search_graphs',
    {
      title: 'Search knowledge graphs',
      description:
        'Free-text search across the graphs the authenticated user can see — their own graphs, ' +
        'whatever their publication state, plus anything published by others. Matches titles, ' +
        'descriptions, meta areas, node labels and node content. Returns summaries with ids and ' +
        'links, not full content: follow up with get_graph. Requires the graph:read scope.',
      inputSchema: {
        query: z.string().optional().describe('Free text. Omit to list everything visible to you. * works as a wildcard.'),
        metaArea: z.string().optional().describe('Narrow to a meta-area tag, e.g. "#HISTORY".'),
        nodeType: z.string().optional().describe('Only graphs containing a node of this type, e.g. "fulltext".'),
        limit: z.number().int().optional().describe('Results per page, 1–50. Default 20.'),
        offset: z.number().int().optional().describe('How many results to skip, for paging.'),
      },
      outputSchema: listShape,
      annotations: READ_ONLY,
    },
    async ({ query, metaArea, nodeType, limit, offset }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      // A hostname is a first-class way to find a graph, exactly as in the portfolio's filter
      // box: the publish registry resolves the query to the graphs that serve a matching host,
      // and those ids are OR'd into the search.
      const registry = await sites.readPublishedDomainRegistry(env)
      const r = await gs.searchGraphs(env, {
        query,
        metaArea,
        nodeType,
        limit,
        offset,
        actor,
        domainMatchIds: hostMatches(registry, query),
      })
      if (!r.ok) return fromService(r)

      const results = withDomains(r.results, registry)
      const head = r.total === 0
        ? 'No graphs matched.'
        : `${r.total} graph${r.total === 1 ? '' : 's'} matched, showing ${results.length} from ${r.offset}.`
      const lines = results.map(
        (g) => `• ${g.title || '(untitled)'} — ${g.graphId} · ${g.nodeCount} nodes · ${g.publicationState}` +
          `${g.isMine ? ' · yours' : ''}${g.publishedDomains.length ? ` · live at ${g.publishedDomains.join(', ')}` : ''}`,
      )
      // Destructure `ok` out rather than setting it undefined: a key with an undefined value is
      // still a key, and outputSchema forbids extras — an SDK client that has fetched the tool
      // list THROWS on the response rather than ignoring it.
      const { ok: _drop, ...payload } = r
      return ok({ success: true, ...payload, results }, [head, ...lines].join('\n'))
    },
  )

  // ── list_my_graphs ────────────────────────────────────────────────────────
  server.registerTool(
    'list_my_graphs',
    {
      title: 'List my knowledge graphs',
      description:
        'List the graphs the authenticated user owns, newest first, including private ones. Each ' +
        'line carries the meta areas and any live site, so the whole collection can be surveyed ' +
        'without opening graphs one by one. limit goes up to 200, so a few hundred graphs take a ' +
        'handful of calls — page with offset. To find out which meta areas exist before filtering, ' +
        'call list_meta_areas. Requires the graph:read scope.',
      inputSchema: {
        metaArea: z.string().optional().describe('Narrow to a meta-area tag, e.g. "#HISTORY". Call list_meta_areas first to see which tags exist and how many graphs each has.'),
        limit: z.number().int().optional().describe('Results per page, 1–200. Default 20. Use 200 to survey a large collection in few calls.'),
        offset: z.number().int().optional().describe('How many results to skip, for paging.'),
      },
      outputSchema: listShape,
      annotations: READ_ONLY,
    },
    async ({ metaArea, limit, offset }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await gs.listMyGraphs(env, { metaArea, limit, offset, actor })
      if (!r.ok) return fromService(r)

      const results = withDomains(r.results, await sites.readPublishedDomainRegistry(env))
      const head = r.total === 0
        ? 'You have no graphs yet.'
        : `You own ${r.total} graph${r.total === 1 ? '' : 's'}, showing ${results.length} from ${r.offset}.`
      const lines = results.map(
        (g) => `• ${g.title || '(untitled)'} — ${g.graphId} · ${g.nodeCount} nodes · ${g.publicationState}` +
          ` · meta: ${g.metaArea || '(none)'}` +
          `${g.publishedDomains.length ? ` · live at ${g.publishedDomains.join(', ')}` : ''}`,
      )
      // Destructure `ok` out rather than setting it undefined: a key with an undefined value is
      // still a key, and outputSchema forbids extras — an SDK client that has fetched the tool
      // list THROWS on the response rather than ignoring it.
      const { ok: _drop, ...payload } = r
      return ok({ success: true, ...payload, results }, [head, ...lines].join('\n'))
    },
  )

  // ── search / fetch ────────────────────────────────────────────────────────
  //
  // These two names are not ours to choose. ChatGPT's deep research connectors call a tool
  // literally named `search` and one named `fetch`, with a fixed result shape: search returns
  // {id, title, url} and fetch returns {id, title, text, url, metadata}. Without them this
  // server works in Developer Mode but never appears as a research source.
  //
  // They are thin projections of search_graphs and get_graph onto that shape, through the same
  // graphService calls — not a second search implementation.

  server.registerTool(
    'search',
    {
      title: 'Search (deep research)',
      description:
        'Search the knowledge graphs available to the authenticated user and return matching ' +
        'documents as {id, title, url}. Use fetch to read one. Requires the graph:read scope.',
      inputSchema: {
        query: z.string().describe('The search query.'),
      },
      outputSchema: {
        results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })),
      },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const r = await gs.searchGraphs(env, { query, limit: 20, actor })
      if (!r.ok) return fromService(r)

      const results = r.results.map((g) => ({
        id: g.graphId,
        title: g.title || '(untitled)',
        url: g.viewerUrl,
      }))
      // The compatibility schema wants the structured payload AND a JSON-encoded text copy.
      return {
        content: [{ type: 'text', text: JSON.stringify({ results }) }],
        structuredContent: { results },
      }
    },
  )

  server.registerTool(
    'fetch',
    {
      title: 'Fetch (deep research)',
      description:
        'Retrieve one knowledge graph by the id that search returned, as {id, title, text, url, ' +
        'metadata}. The text is the graph rendered as readable markdown. Requires the graph:read scope.',
      inputSchema: {
        id: z.string().describe('The graph id, as returned by search.'),
      },
      outputSchema: {
        id: z.string(),
        title: z.string(),
        text: z.string(),
        url: z.string(),
        metadata: z.object({}).passthrough(),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const { auth, env, props } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr
      const actor = actorFromAuth(auth, props)
      if (!actor) return err(gs.ERR.UNAUTHENTICATED, 'No authenticated user on this request.')

      const access = await gs.checkAccess(env, actor, id, 'read')
      if (!access.ok) return fromService(access)

      const read = await gs.getGraph(env, id)
      if (!read.ok) return fromService(read)

      const g = read.graph
      const meta = g.metadata || {}
      // Flatten the graph into something a research model can actually read.
      const text = [
        `# ${meta.title || '(untitled)'}`,
        meta.description ? `\n${meta.description}` : '',
        ...g.nodes.map((n) => `\n## ${n.label || n.id}\n${n.info || ''}`),
      ].join('\n')

      const doc = {
        id,
        title: meta.title || '(untitled)',
        text,
        url: gs.graphLinks(id).viewerUrl,
        metadata: {
          metaArea: meta.metaArea || null,
          publicationState: meta.publicationState || 'private',
          version: meta.version ?? null,
          nodeCount: g.nodes.length,
        },
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(doc) }],
        structuredContent: doc,
      }
    },
  )
}

/** Names of the tools this version registers — used by the tests and the audit log. */
export const TOOL_NAMES = [
  'create_graph',
  'get_graph',
  'add_node',
  'get_graph_links',
  'update_node',
  'post_chat_message',
  'list_chat_groups',
  'read_chat_messages',
  'list_group_members',
  'add_group_member',
  'remove_group_member',
  'set_group_member_role',
  'create_group_invite',
  'list_email_senders',
  'preview_email',
  'send_email',
  'set_email_template',
  'get_fulltext_elements',
  'get_image_guide',
  'generate_node_image',
  'compose_node_image',
  'update_graph_metadata',
  'publish_html_node',
  'register_user',
  'list_users',
  'set_user_groups',
  'update_user_profile',
  'set_user_role',
  'list_published_sites',
  'search_graphs',
  'list_my_graphs',
  'list_meta_areas',
  'search',
  'fetch',
]
