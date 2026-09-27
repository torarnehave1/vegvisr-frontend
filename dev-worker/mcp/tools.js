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

// ─────────────────────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────────────────────

const NodeInput = z
  .object({
    id: z.string().min(1).optional().describe('Node id. A UUID v4 is generated when omitted.'),
    label: z.string().min(1).describe('Node display label. Required.'),
    type: z
      .string()
      .optional()
      .describe("Node content type, e.g. fulltext, image, link, video, audio, mermaid-diagram. Defaults to fulltext."),
    info: z.string().optional().describe('Node content. Markdown for fulltext nodes.'),
    color: z.string().optional().describe('Hex colour, e.g. #4f6d7a.'),
    bibl: z.array(z.string()).optional().describe('Source URLs or references.'),
    position: z.object({ x: z.number(), y: z.number() }).optional().describe('Canvas position.'),
    visible: z.boolean().optional(),
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

      const summary = nodeId
        ? `Node ${nodeId} of graph "${payload.title}" (version ${payload.version}).`
        : `Graph "${payload.title}" (${graphId}) — version ${payload.version}, ${payload.nodeCount} nodes, ` +
          `${payload.edgeCount} edges, ${payload.publicationState}.`

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
            type: z.string().optional().describe('New node type.'),
            color: z.string().optional().describe('New hex colour.'),
            path: z.string().nullable().optional().describe('New media path.'),
            bibl: z.array(z.string()).optional().describe('New source list — replaces the old one.'),
            visible: z.boolean().optional(),
          })
          .describe('The fields to change. Anything omitted is left untouched. Pass the whole new value for a field, not a fragment.'),
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

      const result = await gs.updateNode(env, { graphId, nodeId, fields, expectedVersion, actor })
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

      const result = await chat.postChatMessage(env, { groupId, text, actor })
      if (!result.ok) return fromService(result)

      const { ok: _o, ...payload } = result
      return ok(
        { success: true, ...payload },
        `Posted to "${result.groupName || result.groupId}" as ${result.botName || 'the group bot'}. ` +
          `The message carries a line saying an AI assistant wrote it on the user's behalf.`,
      )
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

      const r = await gs.searchGraphs(env, { query, metaArea, nodeType, limit, offset, actor })
      if (!r.ok) return fromService(r)

      const head = r.total === 0
        ? 'No graphs matched.'
        : `${r.total} graph${r.total === 1 ? '' : 's'} matched, showing ${r.results.length} from ${r.offset}.`
      const lines = r.results.map(
        (g) => `• ${g.title || '(untitled)'} — ${g.graphId} · ${g.nodeCount} nodes · ${g.publicationState}${g.isMine ? ' · yours' : ''}`,
      )
      return ok({ success: true, ...r, ok: undefined }, [head, ...lines].join('\n'))
    },
  )

  // ── list_my_graphs ────────────────────────────────────────────────────────
  server.registerTool(
    'list_my_graphs',
    {
      title: 'List my knowledge graphs',
      description:
        'List the graphs the authenticated user owns, newest first, including private ones. ' +
        'Requires the graph:read scope.',
      inputSchema: {
        metaArea: z.string().optional().describe('Narrow to a meta-area tag, e.g. "#HISTORY".'),
        limit: z.number().int().optional().describe('Results per page, 1–50. Default 20.'),
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

      const head = r.total === 0
        ? 'You have no graphs yet.'
        : `You own ${r.total} graph${r.total === 1 ? '' : 's'}, showing ${r.results.length} from ${r.offset}.`
      const lines = r.results.map(
        (g) => `• ${g.title || '(untitled)'} — ${g.graphId} · ${g.nodeCount} nodes · ${g.publicationState}`,
      )
      return ok({ success: true, ...r, ok: undefined }, [head, ...lines].join('\n'))
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
  'search_graphs',
  'list_my_graphs',
  'search',
  'fetch',
]
