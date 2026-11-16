// Function calling on gemini-worker's POST /chat: the translation helpers (chat-tools.js) and one
// two-step tool conversation through the real handler with Google's API faked.
//
// Run:  node --test gemini-worker/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toGeminiTools, toGeminiToolConfig, functionCallParts, functionResponsePart, textFromParts, toolCallsFromParts,
} from '../chat-tools.js'
import worker from '../index.js'

const TOOL = { type: 'function', function: { name: 'read_graph', description: 'Read a graph', parameters: { type: 'object', properties: { graphId: { type: 'string' } }, required: ['graphId'], additionalProperties: false } } }
const NOARG = { type: 'function', function: { name: 'list_graphs', description: 'List graphs', parameters: { type: 'object', properties: {} } } }

test('tools become functionDeclarations with the JSON Schema passed as it is', () => {
  const t = toGeminiTools([TOOL, NOARG])
  assert.equal(t.length, 1)
  assert.deepEqual(t[0].functionDeclarations[0], { name: 'read_graph', description: 'Read a graph', parametersJsonSchema: TOOL.function.parameters })
  assert.deepEqual(t[0].functionDeclarations[1], { name: 'list_graphs', description: 'List graphs' })
})

test('no tools, an empty list or junk declares nothing', () => {
  assert.equal(toGeminiTools(undefined), null)
  assert.equal(toGeminiTools([]), null)
  assert.equal(toGeminiTools([{ type: 'web_search' }, null]), null)
})

test('tool_choice maps to the function calling mode', () => {
  assert.equal(toGeminiToolConfig('auto'), null)
  assert.equal(toGeminiToolConfig(undefined), null)
  assert.deepEqual(toGeminiToolConfig('none'), { functionCallingConfig: { mode: 'NONE' } })
  assert.deepEqual(toGeminiToolConfig('required'), { functionCallingConfig: { mode: 'ANY' } })
  assert.deepEqual(toGeminiToolConfig({ type: 'function', function: { name: 'read_graph' } }), { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['read_graph'] } })
})

test('an answer\'s functionCall parts become tool_calls that carry the thought signature', () => {
  const calls = toolCallsFromParts([
    { text: 'thinking out loud', thought: true },
    { functionCall: { name: 'read_graph', args: { graphId: 'g1' } }, thoughtSignature: 'SIG-A' },
    { functionCall: { name: 'list_graphs', args: {} } },
  ], (i) => `call_${i}`)
  assert.deepEqual(calls, [
    { id: 'call_0', type: 'function', function: { name: 'read_graph', arguments: '{"graphId":"g1"}' }, extra_content: { google: { thought_signature: 'SIG-A' } } },
    { id: 'call_1', type: 'function', function: { name: 'list_graphs', arguments: '{}' } },
  ])
  assert.deepEqual(toolCallsFromParts([{ text: 'just text' }]), [])
})

test('thought summaries are not part of the answer text', () => {
  assert.equal(textFromParts([{ text: 'plan', thought: true }, { text: 'Hei' }, { functionCall: { name: 'x' } }, { text: 'der' }]), 'Hei\nder')
  assert.equal(textFromParts(undefined), '')
})

test('tool_calls sent back become functionCall parts with the signature in the same part', () => {
  const names = new Map()
  const parts = functionCallParts([
    { id: 'call_0', type: 'function', function: { name: 'read_graph', arguments: '{"graphId":"g1"}' }, extra_content: { google: { thought_signature: 'SIG-A', function_call_id: 'fc-9' } } },
    { id: 'call_1', type: 'function', function: { name: 'list_graphs', arguments: 'not json' } },
  ], names)
  assert.deepEqual(parts, [
    { functionCall: { name: 'read_graph', args: { graphId: 'g1' }, id: 'fc-9' }, thoughtSignature: 'SIG-A' },
    { functionCall: { name: 'list_graphs', args: {} } },
  ])
  assert.equal(names.get('call_0').name, 'read_graph')
})

test('a tool message becomes a functionResponse named after its call, always with an object', () => {
  const names = new Map([['call_0', { name: 'read_graph', geminiId: 'fc-9' }], ['call_1', { name: 'list_graphs', geminiId: null }]])
  assert.deepEqual(functionResponsePart({ role: 'tool', tool_call_id: 'call_0', content: '{"title":"T"}' }, names), { functionResponse: { name: 'read_graph', response: { title: 'T' }, id: 'fc-9' } })
  assert.deepEqual(functionResponsePart({ role: 'tool', tool_call_id: 'call_1', content: '[1,2]' }, names), { functionResponse: { name: 'list_graphs', response: { result: [1, 2] } } })
  assert.deepEqual(functionResponsePart({ role: 'tool', tool_call_id: 'call_1', content: 'plain text… [12 chars trimmed]' }, names), { functionResponse: { name: 'list_graphs', response: { result: 'plain text… [12 chars trimmed]' } } })
  assert.equal(functionResponsePart({ role: 'tool', tool_call_id: 'gone', content: '{}' }, names).functionResponse.name, 'unknown_function')
})

// ── through the real handler ──
async function chat(body, googleReply) {
  const seen = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), body: JSON.parse(init.body) })
    return new Response(JSON.stringify(googleReply), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const res = await worker.fetch(new Request('https://gemini.vegvisr.org/chat', { method: 'POST', body: JSON.stringify(body) }), { GEMINI_API_KEY: 'k', DEFAULT_USER_ID: 'u1' })
    return { status: res.status, data: await res.json(), seen }
  } finally {
    globalThis.fetch = realFetch
  }
}

test('/chat step 1: tools are declared and the function call comes back as tool_calls', async () => {
  const r = await chat(
    { userId: 'u1', model: 'gemini-2.5-flash', messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'read g1' }], tools: [TOOL], tool_choice: 'auto', max_tokens: 8192 },
    { candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'read_graph', args: { graphId: 'g1' } }, thoughtSignature: 'SIG-A' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4, totalTokenCount: 13 } },
  )
  assert.equal(r.status, 200)
  const sent = r.seen.at(-1).body
  assert.equal(sent.tools[0].functionDeclarations[0].name, 'read_graph')
  assert.equal(sent.toolConfig, undefined)
  assert.equal(sent.generationConfig.maxOutputTokens, 8192)
  const choice = r.data.choices[0]
  assert.equal(choice.finish_reason, 'tool_calls')
  assert.equal(choice.message.tool_calls[0].function.name, 'read_graph')
  assert.equal(choice.message.tool_calls[0].extra_content.google.thought_signature, 'SIG-A')
  assert.deepEqual(r.data.usage, { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 })
})

test('/chat step 2: the call (with its signature) and BOTH results go back in Gemini\'s shape', async () => {
  const assistant = { role: 'assistant', content: null, tool_calls: [
    { id: 'call_0', type: 'function', function: { name: 'read_graph', arguments: '{"graphId":"g1"}' }, extra_content: { google: { thought_signature: 'SIG-A' } } },
    { id: 'call_1', type: 'function', function: { name: 'read_graph', arguments: '{"graphId":"g2"}' } },
  ] }
  const r = await chat(
    { userId: 'u1', model: 'gemini-2.5-flash', tools: [TOOL], messages: [
      { role: 'system', content: 'sys' }, { role: 'user', content: 'read g1 and g2' }, assistant,
      { role: 'tool', tool_call_id: 'call_0', content: '{"title":"One"}' },
      { role: 'tool', tool_call_id: 'call_1', content: '{"title":"Two"}' },
    ] },
    { candidates: [{ content: { role: 'model', parts: [{ text: 'Ferdig.' }] }, finishReason: 'STOP' }], usageMetadata: {} },
  )
  const contents = r.seen.at(-1).body.contents
  assert.deepEqual(contents.map((c) => c.role), ['user', 'model', 'user'])
  assert.deepEqual(contents[1].parts, [
    { functionCall: { name: 'read_graph', args: { graphId: 'g1' } }, thoughtSignature: 'SIG-A' },
    { functionCall: { name: 'read_graph', args: { graphId: 'g2' } } },
  ])
  assert.deepEqual(contents[2].parts, [
    { functionResponse: { name: 'read_graph', response: { title: 'One' } } },
    { functionResponse: { name: 'read_graph', response: { title: 'Two' } } },
  ])
  assert.equal(r.data.choices[0].message.content, 'Ferdig.')
  assert.equal(r.data.choices[0].message.tool_calls, undefined)
  assert.equal(r.data.choices[0].finish_reason, 'stop')
})

test('/chat without tools is asked exactly as before: no tools, no toolConfig', async () => {
  const r = await chat(
    { userId: 'u1', messages: [{ role: 'user', content: 'hei' }] },
    { candidates: [{ content: { parts: [{ text: 'Hei!' }] }, finishReason: 'STOP' }], usageMetadata: {} },
  )
  const sent = r.seen.at(-1).body
  assert.equal('tools' in sent, false)
  assert.equal('toolConfig' in sent, false)
  assert.deepEqual(sent.contents, [{ role: 'user', parts: [{ text: 'hei' }] }])
  assert.equal(r.data.choices[0].message.content, 'Hei!')
})

test('/chat with tool_choice none declares no tools', async () => {
  const r = await chat(
    { userId: 'u1', messages: [{ role: 'user', content: 'hei' }], tools: [TOOL], tool_choice: 'none' },
    { candidates: [{ content: { parts: [{ text: 'Hei!' }] }, finishReason: 'STOP' }], usageMetadata: {} },
  )
  assert.equal('tools' in r.seen.at(-1).body, false)
})
