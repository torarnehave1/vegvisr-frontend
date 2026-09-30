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
import * as templates from '../templates-service.js'
import * as images from '../images-service.js'
import * as sites from '../published-domains.js'
import * as publish from '../publish-service.js'
import { NODE_TYPES, DEFAULT_NODE_TYPE, suggestNodeType } from '../node-types.js'
import * as users from '../users-service.js'

// ─────────────────────────────────────────────────────────────────────────────
// Shared schemas
// ─────────────────────────────────────────────────────────────────────────────

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
            type: z.enum(NODE_TYPES).optional().describe('New node type. Must be one of the known types — "html-node", not "html".'),
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
        'image model responds to, and the reply shows the exact text that was sent. Requires the ' +
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
        width: z.number().int().optional().describe('Pixel width, 256–2048, rounded to a multiple of 8. Omit for the model default.'),
        height: z.number().int().optional().describe('Pixel height, 256–2048, rounded to a multiple of 8. Omit for the model default.'),
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
    async ({ graphId, nodeId, prompt, placement, width, height, expectedVersion, model, style, lighting, format, renderTraits, imageText, textTreatment }) => {
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
          (left > 0
            ? `${left} more ${result.placement} placeholder${left === 1 ? '' : 's'} left in this node.\n`
            : '') +
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
        'use list_users to check first, or to find who holds the address. A phone number is worth ' +
        'adding when you have it, because it is what lets them sign in by SMS code. The sign-in ' +
        'credential is never returned. Requires the user:register scope, which an ordinary ' +
        'connection does not carry.',
      inputSchema: {
        email: z.string().min(3).describe("The person's email address. This is the identity — it is how they sign in, and it is what makes the call idempotent."),
        name: z.string().optional().describe("The person's full name."),
        phone: z.string().optional().describe('Mobile number in +47XXXXXXXX form. Optional, but without it they cannot sign in by SMS code.'),
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
  'get_fulltext_elements',
  'generate_node_image',
  'update_graph_metadata',
  'publish_html_node',
  'register_user',
  'list_users',
  'set_user_groups',
  'set_user_role',
  'list_published_sites',
  'search_graphs',
  'list_my_graphs',
  'list_meta_areas',
  'search',
  'fetch',
]
