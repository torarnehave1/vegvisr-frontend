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
export function actorFromAuth(auth) {
  if (!auth?.props) return null
  return gs.normalizeActor({
    valid: true,
    userId: auth.props.userId || auth.props.email || null,
    userEmail: auth.props.email || null,
    userRole: auth.props.role || 'User',
    scopes: Array.isArray(auth.scope) ? auth.scope : [],
    authMethod: auth.props.authMethod || 'oauth',
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
    },
    async ({ title, description, metaArea, nodes, edges }) => {
      const { auth, env } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth)
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
    },
    async ({ graphId, nodeId }) => {
      const { auth, env } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth)
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
    },
    async ({ graphId, node, expectedVersion }) => {
      const { auth, env } = getContext()
      const scopeErr = requireScope(auth, 'graph:write')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth)
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
    },
    async ({ graphId }) => {
      const { auth, env } = getContext()
      const scopeErr = requireScope(auth, 'graph:read')
      if (scopeErr) return scopeErr

      const actor = actorFromAuth(auth)
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
}

/** Names of the tools this version registers — used by the tests and the audit log. */
export const TOOL_NAMES = ['create_graph', 'get_graph', 'add_node', 'get_graph_links']
