/**
 * Function calling for POST /chat — OpenAI chat format on the outside, Gemini generateContent on
 * the inside (2026-11-16).
 *
 * Until now /chat dropped `tools` on the floor: a caller that sent tools got a plain text answer
 * and no sign that anything was ignored. Agent-Builder's chat is built on tool calls, so Gemini
 * could talk there but not read a graph or change a page.
 *
 * What is translated, both ways:
 *
 *   request   tools[{ type:'function', function:{ name, description, parameters } }]
 *               → tools[{ functionDeclarations:[{ name, description, parametersJsonSchema }] }]
 *             tool_choice 'auto' | 'none' | 'required' | { function:{ name } }
 *               → toolConfig.functionCallingConfig { mode: AUTO | NONE | ANY, allowedFunctionNames }
 *             assistant message with tool_calls
 *               → a model turn whose parts are { functionCall:{ name, args }, thoughtSignature }
 *             role 'tool' messages (one per call)
 *               → ONE user turn whose parts are { functionResponse:{ name, response } }, in order
 *   answer    parts with functionCall
 *               → message.tool_calls[{ id, type:'function', function:{ name, arguments } }],
 *                 finish_reason 'tool_calls'
 *
 * Thought signatures. A thinking model returns `thoughtSignature` beside a functionCall and, from
 * Gemini 3 on, REFUSES the next request (400) when it does not come back in the same part. The
 * signature rides on the OpenAI tool call as `extra_content.google.thought_signature`; a caller
 * that sends its assistant message back unchanged — as every OpenAI-format agent loop does —
 * returns it without knowing it is there.
 *
 * Pure functions, no network: tested under plain Node (test/chat-tools.test.mjs).
 */

/** OpenAI tools → Gemini `tools`, or null when there is nothing to declare. */
export function toGeminiTools(tools) {
  if (!Array.isArray(tools)) return null
  const functionDeclarations = []
  for (const tool of tools) {
    const fn = tool?.type === 'function' ? tool.function : (tool?.name ? tool : null)
    if (!fn?.name) continue
    const decl = { name: String(fn.name) }
    if (fn.description) decl.description = String(fn.description)
    const schema = fn.parameters || fn.input_schema
    // A function without parameters is declared without a schema: an object schema with no
    // properties is the one shape Gemini has refused.
    if (schema && typeof schema === 'object' && Object.keys(schema.properties || {}).length) {
      decl.parametersJsonSchema = schema
    }
    functionDeclarations.push(decl)
  }
  return functionDeclarations.length ? [{ functionDeclarations }] : null
}

/** OpenAI tool_choice → Gemini toolConfig, or null to leave the default (AUTO). */
export function toGeminiToolConfig(toolChoice) {
  if (toolChoice === undefined || toolChoice === null || toolChoice === 'auto') return null
  if (toolChoice === 'none') return { functionCallingConfig: { mode: 'NONE' } }
  if (toolChoice === 'required') return { functionCallingConfig: { mode: 'ANY' } }
  const name = toolChoice?.function?.name
  if (name) return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [String(name)] } }
  return null
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

/**
 * An assistant message's tool_calls → Gemini functionCall parts. `callNames` (a Map) remembers
 * which function each call id named, because an OpenAI tool message carries only the id.
 */
export function functionCallParts(toolCalls, callNames) {
  const parts = []
  for (const call of Array.isArray(toolCalls) ? toolCalls : []) {
    const name = call?.function?.name
    if (!name) continue
    const google = call.extra_content?.google || {}
    if (call.id) callNames.set(call.id, { name, geminiId: google.function_call_id || null })
    const functionCall = { name, args: parseArgs(call.function.arguments) }
    if (google.function_call_id) functionCall.id = google.function_call_id
    const part = { functionCall }
    if (google.thought_signature) part.thoughtSignature = google.thought_signature
    parts.push(part)
  }
  return parts
}

/** One role:'tool' message → one Gemini functionResponse part. */
export function functionResponsePart(message, callNames) {
  const known = callNames.get(message?.tool_call_id) || null
  const name = known?.name || message?.name || 'unknown_function'
  let response
  const content = message?.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    response = content
  } else {
    const text = Array.isArray(content)
      ? content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n')
      : String(content ?? '')
    try {
      const parsed = JSON.parse(text)
      // `response` must be an object: a bare list or scalar is wrapped.
      response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { result: parsed }
    } catch {
      response = { result: text }
    }
  }
  const functionResponse = { name, response }
  if (known?.geminiId) functionResponse.id = known.geminiId
  return { functionResponse }
}

/** The answer text: every text part that is not a thought summary. */
export function textFromParts(parts) {
  return (Array.isArray(parts) ? parts : [])
    .filter((p) => p && typeof p.text === 'string' && p.text && !p.thought)
    .map((p) => p.text)
    .join('\n')
}

/** Gemini functionCall parts → OpenAI tool_calls (empty when the answer called nothing). */
export function toolCallsFromParts(parts, makeId = defaultCallId) {
  const calls = []
  for (const part of Array.isArray(parts) ? parts : []) {
    const fc = part?.functionCall
    if (!fc?.name) continue
    const google = {}
    if (part.thoughtSignature) google.thought_signature = part.thoughtSignature
    if (fc.id) google.function_call_id = fc.id
    const call = {
      id: makeId(calls.length, fc),
      type: 'function',
      function: { name: fc.name, arguments: JSON.stringify(fc.args && typeof fc.args === 'object' ? fc.args : {}) },
    }
    if (Object.keys(google).length) call.extra_content = { google }
    calls.push(call)
  }
  return calls
}

function defaultCallId(index) {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).slice(2, 14)
  return `call_${index}_${rand}`
}
