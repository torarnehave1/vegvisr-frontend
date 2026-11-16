// Which worker answers an agent step, how it is asked, and how its answer is read (providers.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { providerFor, buildModelRequest, parseModelResponse, askModel, hasModelConnection } from '../providers.js'
import { compileFlow } from '../compile.js'

test('the model name picks the worker', () => {
  assert.equal(providerFor('claude-sonnet-5-5'), 'anthropic')
  assert.equal(providerFor('claude-opus-5-5'), 'anthropic')
  assert.equal(providerFor('grok-4'), 'grok')
  assert.equal(providerFor('Grok-4-1-fast'), 'grok')
  assert.equal(providerFor('gpt-5'), 'openai')
  assert.equal(providerFor('o3-mini'), 'openai')
  assert.equal(providerFor('gemini-2.5-pro'), null)
  assert.equal(providerFor('smart'), null)
  assert.equal(providerFor(''), null)
})

test('anthropic is asked in its own format, the others in OpenAI chat format', () => {
  const q = { model: 'm', system: 'S', user: 'U', maxTokens: 900 }
  assert.deepEqual(buildModelRequest('anthropic', q), { model: 'm', system: 'S', max_tokens: 900, messages: [{ role: 'user', content: 'U' }] })
  assert.deepEqual(buildModelRequest('grok', q), { model: 'm', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], max_tokens: 900 })
  assert.deepEqual(buildModelRequest('openai', q), { model: 'm', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], max_completion_tokens: 900 })
})

test('an anthropic answer is read as before', () => {
  const r = parseModelResponse('anthropic', { content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: ' Hei ' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 4 } })
  assert.deepEqual(r, { ok: true, text: 'Hei', usage: { input_tokens: 10, output_tokens: 4 }, stopReason: 'end_turn' })
})

test('an OpenAI-format answer is folded to the same shape, and "length" becomes max_tokens', () => {
  const ok = parseModelResponse('grok', { choices: [{ message: { content: 'Hei' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 3 } })
  assert.deepEqual(ok, { ok: true, text: 'Hei', usage: { input_tokens: 12, output_tokens: 3 }, stopReason: 'stop' })
  const cut = parseModelResponse('openai', { choices: [{ message: { content: 'Halv' }, finish_reason: 'length' }], usage: { prompt_tokens: 1, completion_tokens: 2 } })
  assert.equal(cut.ok, true)
  assert.equal(cut.stopReason, 'max_tokens')
})

test('no text says why: the stop reason, the tokens used and what the answer held', () => {
  const r = parseModelResponse('anthropic', { content: [{ type: 'thinking', thinking: '…' }], stop_reason: 'max_tokens', usage: { input_tokens: 20000, output_tokens: 7000 } }, 7000)
  assert.equal(r.ok, false)
  assert.match(r.error, /returned no text/)
  assert.match(r.error, /stop reason max_tokens/)
  assert.match(r.error, /7000 tokens out of maxTokens 7000/)
  assert.match(r.error, /held only: thinking/)
  assert.match(r.error, /raise metadata\.maxTokens/)
  const bare = parseModelResponse('grok', {})
  assert.equal(bare.ok, false)
  assert.equal(bare.error, 'the model returned no text')
})

const svc = (handler) => ({ fetch: async (url, init) => handler(url, JSON.parse(init.body)) })
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('askModel sends a grok model to grok-worker and a claude model to anthropic-worker', async () => {
  const seen = []
  const env = {
    ANTHROPIC: svc((url, body) => { seen.push(['anthropic', url, body.model]); return reply({ content: [{ type: 'text', text: 'A' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) }),
    GROK: svc((url, body) => { seen.push(['grok', url, body.model]); return reply({ choices: [{ message: { content: 'G' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }),
  }
  const a = await askModel(env, { model: 'claude-haiku-5-5', system: 's', user: 'u', maxTokens: 10 })
  const g = await askModel(env, { model: 'grok-4', system: 's', user: 'u', maxTokens: 10 })
  assert.equal(a.text, 'A')
  assert.equal(g.text, 'G')
  assert.deepEqual(seen, [['anthropic', 'https://anthropic-worker/chat', 'claude-haiku-5-5'], ['grok', 'https://grok-worker/chat', 'grok-4']])
})

test('askModel never sends a model to a worker that cannot know it', async () => {
  let calls = 0
  const env = { ANTHROPIC: svc(() => { calls += 1; return reply({}) }) }
  const noWorker = await askModel(env, { model: 'gemini-2.5-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.equal(noWorker.ok, false)
  assert.match(noWorker.error, /no model worker for "gemini-2\.5-pro"/)
  const noBinding = await askModel(env, { model: 'grok-4', system: 's', user: 'u', maxTokens: 10 })
  assert.equal(noBinding.ok, false)
  assert.match(noBinding.error, /binding GROK is missing/)
  assert.equal(calls, 0)
})

test('askModel reports a provider error and a thrown fetch without throwing', async () => {
  const bad = await askModel({ GROK: svc(() => reply({ error: 'nope' }, 401)) }, { model: 'grok-4', system: 's', user: 'u', maxTokens: 10 })
  assert.match(bad.error, /HTTP 401.*nope/)
  const down = await askModel({ GROK: { fetch: async () => { throw new Error('boom') } } }, { model: 'grok-4', system: 's', user: 'u', maxTokens: 10 })
  assert.match(down.error, /could not reach the model: boom/)
})

test('hasModelConnection is true with any one model worker bound', () => {
  assert.equal(hasModelConnection({}), false)
  assert.equal(hasModelConnection({ GROK: { fetch() {} } }), true)
})

const flowGraph = (model) => ({
  nodes: [
    { id: 'flow', type: 'flow', label: 'F', metadata: { kind: 'vegr-flow', status: 'test' } },
    { id: 'a', type: 'flow-step', label: 'A', metadata: { kind: 'agent', model, instructions: 'x' } },
  ],
  edges: [{ source: 'flow', target: 'a' }],
})

test('a flow with a grok or gpt model compiles; one with a model no worker answers does not', () => {
  assert.equal(compileFlow(flowGraph('grok-4'), []).ok, true)
  assert.equal(compileFlow(flowGraph('gpt-5'), []).ok, true)
  const g = compileFlow(flowGraph('gemini-2.5-pro'), [])
  assert.equal(g.ok, false)
  assert.match(g.errors.join(' '), /no worker for|has a worker for/)
  const alias = compileFlow(flowGraph('odd'), [{ alias: 'odd', model: 'gemini-2.5-pro' }])
  assert.equal(alias.ok, false)
  assert.match(alias.errors.join(' '), /alias:odd points to "gemini-2\.5-pro"/)
})
