/**
 * mcp/chat.js — a chat that runs on the MCP server itself (POST /mcp/chat), 2026-11-21.
 *
 * Why (Tor Arne, 18 and 21 Nov 2026): Garnet is its own application and talks to this server
 * directly; its chat ran through Agent-Builder's agent-worker, which he called an architectural
 * misstep. The model choice belongs to this server, not to Garnet. So the chat loop lives here,
 * behind the same login as /mcp, and uses the same tools as a Claude connection — nothing is
 * re-implemented.
 *
 * How:
 *   - /mcp/chat is a descendant of /mcp, so the OAuth provider has already checked the caller's
 *     token (an OAuth token or the account's own login token) and set ctx.auth / ctx.props, as
 *     for /mcp itself.
 *   - The tools are registered on an McpServer in this process and reached through an in-memory
 *     client, the way flow-tools.js runs them for VEGR Flows: only the tools this connection is
 *     offered (scopes and Starter set, mcp/tool-sets.js), each with its own access checks.
 *   - The model gets three small tools instead of the whole catalogue: list_tools, describe_tool
 *     and call_tool. A catalogue of names and one-line summaries sits in the system prompt. The
 *     full catalogue with every schema would be sent on every turn.
 *   - YES BEFORE CHANGE is enforced here, in code (Tor Arne, 21 Nov 2026, alternative A): when the
 *     model asks to run a tool that is not read-only (annotations.readOnlyHint !== true), nothing
 *     in that turn runs. The stream ends with an `approval` event naming each call; the app shows
 *     Yes / No and asks again with the person's decisions. A "no" reaches the model as a refusal.
 *     The paused turns travel with the app (state.turns): the server keeps nothing between the
 *     two requests. That is safe because the state only ever grants what the caller's own token
 *     already allows on /mcp; the gate protects the person from the model, not the server from
 *     the person.
 *   - The model is chosen per request (as agent-worker's model-router did): a small classifier
 *     labels the question simple or complex; simple → Haiku 5.5, complex → Opus 5.5.
 *
 * Events (text/event-stream, one JSON object per `data:` line):
 *   model {model, tier}, text {content}, tool_call {callId, name, args, write},
 *   tool_result {callId, ok, summary}, approval {calls:[{callId,name,args}], state}, error {error},
 *   done {}
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerTools, actorFromAuth } from './tools.js'
import { offeredToolsOnly, toolSetOf } from './tool-sets.js'

export const MODEL_SIMPLE = 'claude-haiku-5-5'
export const MODEL_COMPLEX = 'claude-opus-5-5'
const CLASSIFIER_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TURNS = 24
const MAX_TOKENS = 16384
const RESULT_CHARS_FOR_MODEL = 40_000
const SUMMARY_CHARS = 240
const TOOL_TIMEOUT_MS = 5 * 60 * 1000

/** A jsonSchemaValidator that accepts every value: the output comes from our own server (see flow-tools.js). */
const ACCEPT_OUTPUT = { getValidator: () => (input) => ({ valid: true, data: input, errorMessage: undefined }) }

/** A tool that changes or sends something: everything not marked read-only. */
export function isWriteTool(tool) {
  return tool?.annotations?.readOnlyHint !== true
}

/** The first sentence of a description, cut to n characters — one line of the catalogue. */
export function firstSentence(text, n = 150) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  const m = flat.match(/^(.+?[.!?])(\s|$)/)
  const s = m ? m[1] : flat
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** The catalogue in the system prompt: one line per tool, writes marked. */
export function catalogue(tools) {
  return tools
    .map((t) => `- ${t.name}${isWriteTool(t) ? ' [changes]' : ''}: ${firstSentence(t.description)}`)
    .join('\n')
}

/** The three tools the model calls. */
export const META_TOOLS = [
  {
    name: 'describe_tool',
    description: 'Read one VEGR.AI tool\'s full description and its input schema. Call it before call_tool when you are not sure of a tool\'s parameters.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'The tool name, from the catalogue.' } }, required: ['name'] },
  },
  {
    name: 'call_tool',
    description: 'Run one VEGR.AI tool as the signed-in person. Tools marked [changes] are paused until the person presses Yes; you do not need to ask in text first.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The tool name, from the catalogue.' },
        arguments: { type: 'object', description: 'The tool\'s own arguments, as its input schema says.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_tools',
    description: 'List every tool again with its one-line summary. The catalogue in the instructions already holds this list.',
    input_schema: { type: 'object', properties: {} },
  },
]

/** Pure: the tier from the classifier's text, or null. */
export function parseTier(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0])
    if (j.tier === 'simple' || j.tier === 'complex') return j.tier
  } catch { /* not a label */ }
  return null
}

export function modelForTier(tier) {
  return tier === 'simple' ? MODEL_SIMPLE : MODEL_COMPLEX
}

const CLASSIFIER_PROMPT = `You route requests for an assistant that reads and changes knowledge graphs through tools.
Label the user's request:
- "simple": read, show, list, search or look something up; answer a question; one named change the user spelled out; a greeting.
- "complex": several dependent steps, building or restructuring a graph, writing longer content, a design decision, anything where a careless mistake damages existing content.
When unsure, answer "complex".
Reply with ONLY JSON: {"tier":"simple"|"complex"}`

/** The text of the last user message (blocks: their text parts). */
export function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m?.role !== 'user') continue
    if (typeof m.content === 'string') return m.content
    if (Array.isArray(m.content)) return m.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
  }
  return ''
}

/** Only well-formed user/assistant turns from the app; anything else is dropped. */
export function cleanHistory(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && (typeof m.content === 'string' ? m.content.trim() : Array.isArray(m.content) && m.content.length))
    .map((m) => ({ role: m.role, content: m.content }))
}

/** A short line for the app about a tool's result. */
export function summarize(text, isError) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim()
  const s = flat.length > SUMMARY_CHARS ? flat.slice(0, SUMMARY_CHARS - 1) + '…' : flat
  return s || (isError ? 'The tool reported an error.' : 'Done.')
}

export function buildSystem({ view, graphId, tools, instructions }) {
  return [
    'You are the chat beside Garnet, the network map of the person\'s VEGR.AI knowledge graphs. You run on the VEGR.AI MCP server and act as the signed-in person, with exactly the tools their own connection has.',
    'Reading is free. Tools marked [changes] create, change, move, delete, publish or send something: when you call one, the server pauses and shows the person what will happen with a Yes / No button. Say in one short sentence what you are about to change (name the graph), then call the tool. If the person says no, accept it and do not try another way around.',
    'Answer in the language the person writes in. Be brief. Never invent graph ids, node ids or results: read them with the tools.',
    instructions ? `Server instructions:\n${instructions}` : '',
    view ? `What the map shows now:\n${String(view).slice(0, 6000)}` : '',
    graphId ? `The graph selected on the map: ${graphId}` : '',
    `Tools (call them with call_tool; describe_tool gives the schema):\n${catalogue(tools)}`,
  ].filter(Boolean).join('\n\n')
}

async function askAnthropic(env, body) {
  if (!env.ANTHROPIC?.fetch) return { ok: false, error: 'The ANTHROPIC service binding is not configured on this worker.' }
  let res
  try {
    res = await env.ANTHROPIC.fetch('https://anthropic-worker/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    return { ok: false, error: `Could not reach the model: ${e?.message || e}` }
  }
  const raw = await res.text().catch(() => '')
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: `The model service answered HTTP ${res.status} without JSON${res.status === 524 ? ' (timed out)' : ''}.` }
  }
  if (!res.ok || data?.error) {
    const e = data?.error
    return { ok: false, error: `The model answered HTTP ${res.status}: ${typeof e === 'string' ? e : e?.message || JSON.stringify(e || data).slice(0, 300)}` }
  }
  return { ok: true, data }
}

async function chooseModel(env, userId, text) {
  const q = String(text || '').trim().slice(0, 4000)
  if (!q) return { model: MODEL_COMPLEX, tier: 'complex' }
  const r = await askAnthropic(env, {
    userId,
    model: CLASSIFIER_MODEL,
    max_tokens: 60,
    temperature: 0,
    system: CLASSIFIER_PROMPT,
    messages: [{ role: 'user', content: q }],
  })
  const t = r.ok ? parseTier((r.data.content || []).find((c) => c.type === 'text')?.text) : null
  // A failed classifier goes to the strong model: a wrong "complex" costs a little money,
  // a wrong "simple" can cost a damaged graph.
  return t ? { model: modelForTier(t), tier: t } : { model: MODEL_COMPLEX, tier: 'complex' }
}

/** Validate a paused state sent back by the app; returns the turns or null. */
export function checkState(state) {
  const turns = state?.turns
  if (!Array.isArray(turns) || !turns.length || turns.length > MAX_TURNS * 2 + 2) return null
  const last = turns[turns.length - 1]
  if (last?.role !== 'assistant' || !Array.isArray(last.content)) return null
  if (!last.content.some((b) => b?.type === 'tool_use')) return null
  for (const t of turns) if (t?.role !== 'user' && t?.role !== 'assistant') return null
  return turns
}

/**
 * POST /mcp/chat. Body: { messages, view?, graphId?, resume?: { state, decisions: {callId: true|false} } }
 */
export async function handleChat(request, env, ctx, auth, props) {
  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body is not JSON.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  const history = cleanHistory(body?.messages)
  if (!history.length) return new Response(JSON.stringify({ error: 'No messages.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const resume = body?.resume || null
  const pausedTurns = resume ? checkState(resume.state) : null
  if (resume && !pausedTurns) return new Response(JSON.stringify({ error: 'The paused chat could not be read. Ask again.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const enc = new TextEncoder()
  let open = true
  const emit = async (event, data) => {
    if (!open) return
    try {
      await writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch {
      open = false // the app went away; the loop finishes the turn it is in and stops
    }
  }

  const run = async () => {
    const server = new McpServer({ name: 'vegr-chat', version: '1.0.0' })
    const client = new Client({ name: 'garnet-chat', version: '1.0.0' }, { jsonSchemaValidator: ACCEPT_OUTPUT })
    try {
      const { requestNodeTypes, INSTRUCTIONS } = await import('./server.js')
      const scopes = Array.isArray(auth.scope) ? auth.scope : []
      const offered = offeredToolsOnly(server, { scopes, toolSet: toolSetOf(props) })
      registerTools(offered, () => ({ auth, env, props, ctx }), { nodeTypes: await requestNodeTypes(env, actorFromAuth(auth, props)) })
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
      await Promise.all([server.connect(serverSide), client.connect(clientSide)])
      const { tools } = await client.listTools()
      const byName = new Map(tools.map((t) => [t.name, t]))
      // anthropic-worker looks up the person's own key by user id (config.user_id), else the platform's.
      const userId = props.userId || props.email

      const chosen = resume?.state?.model && [MODEL_SIMPLE, MODEL_COMPLEX].includes(resume.state.model)
        ? { model: resume.state.model, tier: resume.state.tier || '' }
        : await chooseModel(env, userId, lastUserText(history))
      await emit('model', chosen)

      const system = buildSystem({ view: body.view, graphId: body.graphId, tools, instructions: INSTRUCTIONS })
      const turns = pausedTurns ? [...pausedTurns] : []

      // Run every tool_use of one assistant message; returns the user message with the results.
      const runTools = async (assistantMsg, decisions) => {
        const results = []
        for (const b of assistantMsg.content) {
          if (b?.type !== 'tool_use') continue
          const out = await runOne(b, decisions)
          results.push({ type: 'tool_result', tool_use_id: b.id, content: out.text, ...(out.isError ? { is_error: true } : {}) })
          await emit('tool_result', { callId: b.id, ok: !out.isError, summary: out.summary })
        }
        return { role: 'user', content: results }
      }

      const runOne = async (b, decisions) => {
        const input = b.input && typeof b.input === 'object' ? b.input : {}
        if (b.name === 'list_tools') return { text: catalogue(tools), summary: `${tools.length} tools` }
        if (b.name === 'describe_tool') {
          const t = byName.get(String(input.name || ''))
          if (!t) return { text: `There is no tool named "${input.name}".`, isError: true, summary: 'No such tool.' }
          return { text: JSON.stringify({ name: t.name, description: t.description, changes: isWriteTool(t), inputSchema: t.inputSchema }), summary: t.name }
        }
        if (b.name !== 'call_tool') return { text: `Unknown tool "${b.name}". Use call_tool.`, isError: true, summary: 'Unknown tool.' }
        const t = byName.get(String(input.name || ''))
        if (!t) return { text: `There is no tool named "${input.name}" for this connection. Check the catalogue.`, isError: true, summary: 'No such tool.' }
        if (isWriteTool(t) && decisions?.[b.id] !== true) {
          return { text: 'The person pressed No. Nothing was changed. Do not try another way to make this change.', isError: true, summary: 'Declined — nothing was changed.' }
        }
        try {
          const r = await client.callTool({ name: t.name, arguments: input.arguments && typeof input.arguments === 'object' ? input.arguments : {} }, undefined, { timeout: TOOL_TIMEOUT_MS })
          let text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
          if (!text && r.structuredContent) text = JSON.stringify(r.structuredContent)
          const summary = summarize(text, r.isError)
          if (text.length > RESULT_CHARS_FOR_MODEL) text = text.slice(0, RESULT_CHARS_FOR_MODEL) + `… [cut at ${RESULT_CHARS_FOR_MODEL} characters]`
          return { text: text || 'Done.', isError: r.isError === true, summary }
        } catch (e) {
          return { text: `The tool failed: ${e?.message || e}`, isError: true, summary: `Failed: ${e?.message || e}` }
        }
      }

      // Resuming: the paused assistant message's tools run now, with the person's decisions.
      if (pausedTurns) {
        const decisions = resume.decisions && typeof resume.decisions === 'object' ? resume.decisions : {}
        turns.push(await runTools(turns[turns.length - 1], decisions))
      }

      for (let turn = 0; turn < MAX_TURNS && open; turn++) {
        const r = await askAnthropic(env, {
          userId,
          model: chosen.model,
          max_tokens: MAX_TOKENS,
          system,
          tools: META_TOOLS,
          messages: [...history, ...turns],
        })
        if (!r.ok) {
          await emit('error', { error: r.error })
          break
        }
        const content = Array.isArray(r.data.content) ? r.data.content : []
        const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n\n').trim()
        if (text) await emit('text', { content: text })
        const uses = content.filter((c) => c.type === 'tool_use')
        if (r.data.stop_reason !== 'tool_use' || !uses.length) {
          if (r.data.stop_reason === 'max_tokens') await emit('error', { error: 'The answer was cut off at its length limit.' })
          break
        }
        const assistantMsg = { role: 'assistant', content }
        turns.push(assistantMsg)
        const calls = uses.map((u) => {
          const input = u.input && typeof u.input === 'object' ? u.input : {}
          const t = u.name === 'call_tool' ? byName.get(String(input.name || '')) : null
          return {
            callId: u.id,
            name: u.name === 'call_tool' ? String(input.name || '?') : u.name === 'describe_tool' ? `describe ${input.name || ''}`.trim() : u.name,
            args: u.name === 'call_tool' && input.arguments && typeof input.arguments === 'object' ? input.arguments : {},
            write: !!t && isWriteTool(t),
          }
        })
        for (const c of calls) await emit('tool_call', c)
        const writes = calls.filter((c) => c.write)
        if (writes.length) {
          // Nothing in this turn runs before the person has answered.
          await emit('approval', { calls: writes.map(({ callId, name, args }) => ({ callId, name, args })), state: { turns, model: chosen.model, tier: chosen.tier } })
          break
        }
        turns.push(await runTools(assistantMsg, {}))
        if (turn === MAX_TURNS - 1) await emit('error', { error: `Stopped after ${MAX_TURNS} steps.` })
      }
    } catch (e) {
      console.error('[mcp/chat]', e?.stack || e)
      await emit('error', { error: `The chat stopped: ${e?.message || e}` })
    } finally {
      await emit('done', {})
      try { await writer.close() } catch { /* already closed */ }
      await client.close().catch(() => {})
      await server.close().catch(() => {})
    }
  }

  ctx?.waitUntil?.(run())
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive' },
  })
}
