/**
 * server.js — the MCP endpoint at https://knowledge.vegvisr.org/mcp
 *
 * Stateless Streamable HTTP, per the 2026 transport: one POST carries one JSON-RPC exchange and
 * the server keeps nothing between requests. Built on the SDK's
 * WebStandardStreamableHTTPServerTransport, which speaks fetch Request/Response natively — no
 * Node http shims, no nodejs_compat. The deprecated SSE transport is not used, and neither is
 * the `agents` package's McpAgent, which is Durable-Object backed and therefore stateful.
 *
 * `sessionIdGenerator: undefined` selects stateless mode. `enableJsonResponse: true` answers
 * with a single JSON body instead of opening an SSE stream: there is nothing to stream when
 * every request is self-contained, and a plain body is what lets this module read the result
 * for the audit log.
 *
 * A fresh McpServer and transport are constructed per request. That is the point of stateless:
 * two concurrent calls from different users share no in-memory state, so one user's request can
 * never observe another's.
 *
 * AUTHENTICATION happens before this module runs. OAuthProvider validates the bearer token and
 * hands the handler `ctx.auth` (verified scope, userId, clientId) and `ctx.props` (what
 * completeAuthorization stored). Nothing here parses an Authorization header.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { registerTools, TOOL_NAMES } from './tools.js'

const SERVER_INFO = {
  name: 'vegvisr-knowledge-graph',
  version: '1.0.0',
}

const INSTRUCTIONS = `VEGR.AI Knowledge Graph.

A knowledge graph is the unit of content here: nodes hold the content (fulltext nodes hold
markdown in their "info" field) and edges connect them. Graphs carry metadata: title,
description, and metaArea tags used for filtering.

Rules this server enforces, so you do not have to ask:
- Every graph you create is PRIVATE. Nothing becomes visible to others without an explicit
  publish action, which this version does not expose.
- You are always the authenticated user. There is no way to act as someone else, and no tool
  takes an email or user id.
- You can only read or change graphs you own. Someone else's private graph returns
  FORBIDDEN_GRAPH.
- Graph and node ids are UUID v4, generated for you when you omit them.
- Writes keep full version history. If a write returns VERSION_CONFLICT, the graph changed
  since you read it: call get_graph again and retry against the version it reports.

Always show the user the viewerUrl or editorUrl that a write returns — that is how they see
what you made.`

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per MCP call: when, which verified user, which OAuth client, which tool, which graph,
 * the outcome code and how long it took.
 *
 * Deliberately absent: the access token, the Authorization header, the authorization code, any
 * OTP, and node content. The graph id is enough to find the data through the normal API; a copy
 * of the content in an audit table is a second place for it to leak from.
 *
 * Never throws into the request path — a failure to audit must not fail the user's call, so it
 * logs and moves on.
 */
async function audit(env, row) {
  try {
    await env.vegvisr_org
      .prepare(
        `INSERT INTO mcp_audit_log (id, ts, user_id, client_id, tool, graph_id, result_code, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        row.userId || null,
        row.clientId || null,
        row.tool || null,
        row.graphId || null,
        row.resultCode || null,
        Number.isFinite(row.durationMs) ? Math.round(row.durationMs) : null,
      )
      .run()
  } catch (e) {
    console.error('[MCP audit] could not write row:', e.message)
  }
}

/**
 * Pull the auditable facts out of a JSON-RPC request without keeping the payload.
 * Only graphId is taken from the arguments — never content, never anything identifying.
 */
function describeCall(parsed) {
  const one = (msg) => ({
    method: msg?.method || null,
    tool: msg?.method === 'tools/call' ? msg?.params?.name || null : null,
    graphId: msg?.method === 'tools/call' ? msg?.params?.arguments?.graphId || null : null,
  })
  if (Array.isArray(parsed)) {
    const calls = parsed.map(one)
    return {
      method: 'batch',
      tool: calls.map((c) => c.tool).filter(Boolean).join(',') || null,
      graphId: calls.map((c) => c.graphId).filter(Boolean)[0] || null,
    }
  }
  return one(parsed)
}

/** The outcome code to record, read back out of the response the tools produced. */
function resultCodeOf(body) {
  try {
    const msgs = Array.isArray(body) ? body : [body]
    for (const m of msgs) {
      if (m?.error) return `JSONRPC_${m.error.code}`
      const sc = m?.result?.structuredContent
      if (sc && sc.success === false && sc.code) return sc.code
    }
    return 'OK'
  } catch {
    return 'OK'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The apiHandler OAuthProvider routes /mcp to. `ctx.auth` and `ctx.props` are set by the
 * provider from the validated token; this handler does not accept an unauthenticated request
 * (the provider answers those with the Bearer challenge before we are reached).
 */
export const mcpHandler = {
  async fetch(request, env, ctx) {
    const started = Date.now()

    if (request.method === 'GET' || request.method === 'DELETE') {
      // Stateless: there is no session to resume with GET/SSE and none to delete.
      return json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'This MCP server is stateless: use POST for JSON-RPC. There are no resumable sessions.' }, id: null },
        405,
      )
    }
    if (request.method !== 'POST') {
      return json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }, 405)
    }

    const auth = ctx?.auth
    const props = ctx?.props
    if (!auth || !props) {
      // Belt and braces: the provider should never route an unauthenticated request here.
      return json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthenticated.' }, id: null }, 401)
    }

    // The body is read once here so the audit can describe the call, then handed to the
    // transport as parsedBody rather than being read twice.
    let parsed
    try {
      parsed = await request.json()
    } catch {
      return json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: body is not JSON.' }, id: null }, 400)
    }

    const described = describeCall(parsed)

    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS })
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    })

    // One context per request; the tools read it when they run.
    registerTools(server, () => ({ auth, env, props }))

    let response
    try {
      await server.connect(transport)
      response = await transport.handleRequest(request, {
        parsedBody: parsed,
        authInfo: {
          token: '', // deliberately not propagated: nothing downstream needs the raw token
          clientId: auth.clientId,
          scopes: Array.isArray(auth.scope) ? auth.scope : [],
          extra: { userId: props.userId, email: props.email },
        },
      })
    } catch (e) {
      console.error('[MCP] transport error:', e.message)
      ctx?.waitUntil?.(
        audit(env, {
          userId: props.userId,
          clientId: auth.clientId,
          tool: described.tool,
          graphId: described.graphId,
          resultCode: 'INTERNAL_ERROR',
          durationMs: Date.now() - started,
        }),
      )
      return json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error.' }, id: null }, 500)
    } finally {
      try {
        await server.close()
      } catch {
        /* closing a per-request server is best-effort */
      }
    }

    // Read the outcome for the audit without consuming the response the client gets.
    let resultCode = 'OK'
    let auditable = response
    try {
      const clone = response.clone()
      const text = await clone.text()
      if (text) resultCode = resultCodeOf(JSON.parse(text))
      auditable = new Response(text, { status: response.status, headers: response.headers })
    } catch {
      /* a non-JSON or already-consumed body simply audits as OK */
    }

    ctx?.waitUntil?.(
      audit(env, {
        userId: props.userId,
        clientId: auth.clientId,
        tool: described.tool,
        graphId: described.graphId,
        resultCode,
        durationMs: Date.now() - started,
      }),
    )

    return auditable
  },
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export { TOOL_NAMES, SERVER_INFO, INSTRUCTIONS }
