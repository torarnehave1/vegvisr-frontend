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
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js'
import { registerTools, TOOL_NAMES } from './tools.js'

// What the server reports in the MCP initialize handshake. A client shows this, and a bug
// report that names a version is worth more than one that does not.
//
// This said 1.0.0 from launch on 2026-09-27 through every addition since — four tools became
// twenty-two and one scope became seven while the handshake still claimed the launch version.
// Bump it with the surface from here; MCP_OAUTH_DEPLOYMENT.md carries the changelog.
const SERVER_INFO = {
  name: 'vegvisr-knowledge-graph',
  version: '1.15.0',
}

const INSTRUCTIONS = `VEGR.AI Knowledge Graph.

A knowledge graph is the unit of content here: nodes hold the content (fulltext nodes hold
markdown in their "info" field) and edges connect them. Graphs carry metadata: title,
description, and metaArea tags used for filtering.

Rules this server enforces, so you do not have to ask:
- Every graph you create is PRIVATE. Nothing becomes visible to others until the user asks for
  it: publish_html_node is the one tool that puts anything on the public web, and it publishes a
  single named node to a domain the user already owns.
- You are always the authenticated user. There is no way to act as someone else, and no tool
  takes an email or user id.
- You can only read or change graphs you own. Someone else's private graph returns
  FORBIDDEN_GRAPH.
- Graph and node ids are UUID v4, generated for you when you omit them.
- Writes keep full version history. If a write returns VERSION_CONFLICT, the graph changed
  since you read it: call get_graph again and retry against the version it reports.

Two things on this system cannot be inferred from general knowledge, so ask rather than guess:
- Fulltext syntax: call get_fulltext_elements before writing a node's "info" and copy the format
  verbatim. A wrong parameter renders as literal text instead of failing, so mistakes are silent.
- Images: call get_image_guide before generating one. Five image models are available and they
  accept genuinely different parameters — one has no seed, another no negative prompt, a third no
  size at all — so a setting you assume exists is dropped rather than refused.

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
        `INSERT INTO mcp_audit_log (id, ts, user_id, client_id, method, tool, graph_id, result_code, duration_ms, client_info)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        row.userId || null,
        row.clientId || null,
        // `tool` is NULL for everything that is not tools/call, so a row for a rejected
        // handshake used to say nothing at all about what had been rejected.
        row.method || null,
        row.tool || null,
        row.graphId || null,
        row.resultCode || null,
        Number.isFinite(row.durationMs) ? Math.round(row.durationMs) : null,
        row.clientInfo || null,
      )
      .run()
  } catch (e) {
    console.error('[MCP audit] could not write row:', e.message)
  }
}

/**
 * What a client says about ITSELF at initialize: its name, its version, and which MCP
 * capabilities it declares.
 *
 * Recorded because the server's options for talking to a user depend on it and nothing else
 * measures it. `elicitation` is the capability that lets a server ASK THE USER a question in the
 * middle of a tool call — the natural way to fill in a missing argument instead of guessing —
 * and `sampling` lets it ask the client's model. A server that blocks on a question no client
 * will answer hangs the call, so neither can be used on a guess. One line per handshake turns
 * "do Claude, ChatGPT and Grok support this?" from an assumption into a query.
 *
 * This is software metadata, not user data: a product name, a version string and capability
 * keys. No parameters, no content, nothing identifying.
 */
function describeClient(msg) {
  if (msg?.method !== 'initialize') return null
  const info = msg?.params?.clientInfo || {}
  const caps = Object.keys(msg?.params?.capabilities || {}).sort()
  const name = [info.name, info.version].filter(Boolean).join('/') || 'unknown'
  return `${name} proto:${msg?.params?.protocolVersion || '?'} caps:${caps.join(',') || 'none'}`.slice(0, 300)
}

/** What the SDK insists a POST must accept, and what we substitute when it does not. */
export const ACCEPT_BOTH = 'application/json, text/event-stream'
export const CONTENT_JSON = 'application/json'

/**
 * True when the SDK would refuse this Accept header.
 *
 * Mirrors the transport's own test, which requires BOTH types — not either. Written as one
 * function because the version that lived inline checked only one of the two and therefore only
 * fixed half the clients.
 */
export function acceptNeedsWidening(accept) {
  const a = accept || ''
  return !a.includes('application/json') || !a.includes('text/event-stream')
}

/**
 * True when the SDK would refuse this Content-Type with 415 and -32000.
 *
 * The transport parses the media type rather than substring-matching it, so a missing header, an
 * empty one, `text/plain` or `application/jsonrequest` are all refused; `application/json` with
 * any charset parameter is fine. Verified against the transport, not inferred.
 *
 * WHY WE OVERRIDE IT. That check exists to protect the SDK's own reading of the request body.
 * This handler has already read and parsed the body itself and hands the result over as
 * `parsedBody`, so the transport never touches the stream — it is validating a header describing
 * something it will not read. If `request.json()` succeeded, the payload IS JSON, whatever the
 * header claims.
 *
 * AND WHY THAT IS SAFE. A JSON Content-Type requirement is also a CSRF defence: it forces a
 * preflight on cross-origin requests, because a plain HTML form can only send
 * form-urlencoded, multipart or text/plain. That defence is not what is holding this endpoint
 * shut. /mcp requires a validated OAuth bearer token, and no form post can set an Authorization
 * header — cross-origin, that header itself forces a preflight. The token is the gate; the
 * media type never was.
 */
export function contentTypeNeedsFixing(contentType) {
  const essence = String(contentType || '').split(';')[0].trim().toLowerCase()
  return essence !== 'application/json'
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
    clientInfo: describeClient(msg),
  })
  if (Array.isArray(parsed)) {
    const calls = parsed.map(one)
    return {
      method: 'batch',
      tool: calls.map((c) => c.tool).filter(Boolean).join(',') || null,
      graphId: calls.map((c) => c.graphId).filter(Boolean)[0] || null,
      clientInfo: calls.map((c) => c.clientInfo).filter(Boolean)[0] || null,
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

    // Widen Accept before the transport sees it.
    //
    // The SDK refuses a POST whose Accept does not list BOTH application/json and
    // text/event-stream, with 406 and JSON-RPC -32000. That check is meaningless for this server:
    // it is stateless and runs with enableJsonResponse, so it NEVER returns an event stream.
    // Refusing a client for not accepting something we never send costs real requests, so the
    // header is normalised here rather than the client being asked to change.
    //
    // The first version of this only widened when text/event-stream was MISSING — which left the
    // other half of the SDK's condition wide open. A client sending `Accept: text/event-stream`
    // alone sailed past it and was refused anyway. That is where the `server/discover` rows with
    // JSONRPC_-32000 came from: three per connector setup, and NOT, as first assumed, the method
    // being unknown. An unknown method answers -32601 "Method not found" with HTTP 200 — verified
    // against this transport — so a -32000 always means the request never reached dispatch at all.
    //
    // The body is already parsed and passed as parsedBody, so rebuilding the Request without it
    // is safe.
    // Content-Type is normalised for the same reason and in the same breath. `server/discover`
    // kept auditing as -32000 after the Accept fix landed, which is how the second header came to
    // light: the transport refuses a POST whose Content-Type is not application/json with 415 and
    // the same -32000 code, and our own request.json() had already parsed the body regardless, so
    // the method name reached the audit while the request never reached dispatch.
    const needsAccept = acceptNeedsWidening(request.headers.get('accept'))
    const needsType = contentTypeNeedsFixing(request.headers.get('content-type'))
    let mcpRequest = request
    if (needsAccept || needsType) {
      const headers = new Headers(request.headers)
      if (needsAccept) headers.set('accept', ACCEPT_BOTH)
      if (needsType) headers.set('content-type', CONTENT_JSON)
      mcpRequest = new Request(request.url, { method: request.method, headers })
    }

    let response
    try {
      await server.connect(transport)
      response = await transport.handleRequest(mcpRequest, {
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
          ...described,
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

      // A JSONRPC_-32000 means the transport refused the request before dispatch, and its own
      // message says which check did it. Two rounds were spent inferring that from the audit code
      // alone — first the Accept header, then Content-Type — and neither explained
      // `server/discover`. The message was available the whole time and was being discarded.
      if (resultCode.startsWith('JSONRPC_-32000') || resultCode.startsWith('JSONRPC_-32600')) {
        const asked = request.headers.get('mcp-protocol-version')

        // Claude probes `server/discover` with Mcp-Protocol-Version: 2026-07-28, a version no
        // published SDK implements — 1.31.0, the newest, still tops out at 2025-11-25. Being
        // refused is the CORRECT answer and the point of the probe: the client learns what this
        // server speaks and then sends initialize at 2025-11-25, which succeeds a second later.
        //
        // So this is negotiation, not failure, and it gets its own audit code rather than sitting
        // in the log looking like six broken requests per connector setup. It is deliberately NOT
        // "fixed" by accepting the version: claiming to speak a protocol the SDK does not
        // implement would trade a truthful refusal for an untruthful acceptance, and the client
        // would then hold us to it.
        if (asked && !SUPPORTED_PROTOCOL_VERSIONS.includes(asked)) {
          resultCode = 'PROTOCOL_UNSUPPORTED'
          console.log(
            `[MCP] ${described.method || '?'} probed protocol ${asked}; this server speaks ` +
              `${SUPPORTED_PROTOCOL_VERSIONS[0]}. Refused, as intended.`,
          )
        } else {
          const body = JSON.parse(text)
          console.error(
            `[MCP refused] ${described.method || '?'} → HTTP ${response.status} ${resultCode}: ` +
              `${body?.error?.message || '(no message)'} | accept=${request.headers.get('accept') || '(none)'}` +
              ` | content-type=${request.headers.get('content-type') || '(none)'}` +
              ` | mcp-protocol-version=${asked || '(none)'}` +
              ` | mcp-session-id=${request.headers.get('mcp-session-id') ? 'present' : '(none)'}`,
          )
        }
      }
    } catch {
      /* a non-JSON or already-consumed body simply audits as OK */
    }

    ctx?.waitUntil?.(
      audit(env, {
        userId: props.userId,
        clientId: auth.clientId,
        // Spread, not copied field by field. Listing them by hand is exactly how clientInfo was
        // computed by describeCall and then dropped on the floor here — the column read NULL on
        // every initialize since it was added, while the code that filled it looked correct in
        // isolation. A value that is derived and then not carried is worse than one never
        // derived: the schema says the answer is there.
        ...described,
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
// Exported for the tests: what lands in an audit row is a contract, and the one field that was
// derived here and then silently not written is the reason it now has one.
export { describeCall }
