// Which worker answers an agent step, how it is asked, and how its answer is read (providers.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { providerFor, modelId, buildModelRequest, parseModelResponse, askModel, ownerUserId, hasModelConnection } from '../providers.js'
import { compileFlow } from '../compile.js'

test('the model name picks the worker', () => {
  assert.equal(providerFor('claude-sonnet-5-5'), 'anthropic')
  assert.equal(providerFor('claude-opus-5-5'), 'anthropic')
  assert.equal(providerFor('grok-4'), 'grok')
  assert.equal(providerFor('Grok-4-1-fast'), 'grok')
  assert.equal(providerFor('gpt-5'), 'openai')
  assert.equal(providerFor('o3-mini'), 'openai')
  assert.equal(providerFor('gemini-2.5-pro'), 'gemini')
  assert.equal(providerFor('kimi-k3.1-pro'), 'kimi')
  assert.equal(providerFor('mistral-large'), null)
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
  const noWorker = await askModel(env, { model: 'mistral-large', system: 's', user: 'u', maxTokens: 10 })
  assert.equal(noWorker.ok, false)
  assert.match(noWorker.error, /no model worker for "mistral-large"/)
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
  assert.equal(compileFlow(flowGraph('gemini-2.5-pro'), []).ok, true)
  assert.equal(compileFlow(flowGraph('kimi-k3.1-pro'), []).ok, true)
  assert.equal(compileFlow(flowGraph('kimi/kimi-k3.1-pro'), []).ok, true)
  const g = compileFlow(flowGraph('mistral-large'), [])
  assert.equal(g.ok, false)
  assert.match(g.errors.join(' '), /no worker for|has a worker for/)
  assert.match(g.errors.join(' '), /gemini…, kimi…/)
  const alias = compileFlow(flowGraph('odd'), [{ alias: 'odd', model: 'mistral-large' }])
  assert.equal(alias.ok, false)
  assert.match(alias.errors.join(' '), /alias:odd points to "mistral-large"/)
})

// ---- Gemini and Kimi (2026-11-16) -----------------------------------------------------------------

const dbWith = (rows) => ({
  prepare(sql) {
    let args = []
    const st = { bind(...a) { args = a; return st }, async first() { return rows[args[0]] ?? null } }
    return st
  },
})

test('the prefix from Agent-Builder\'s model panel is cut before the model is asked', () => {
  assert.equal(modelId('kimi/kimi-k3.1-pro'), 'kimi-k3.1-pro')
  assert.equal(modelId('gemini/gemini-2.5-flash'), 'gemini-2.5-flash')
  assert.equal(modelId('grok/grok-4.5'), 'grok-4.5')
  assert.equal(modelId('openai/gpt-5'), 'gpt-5')
  assert.equal(modelId('claude-sonnet-5-5'), 'claude-sonnet-5-5')
  assert.equal(providerFor('kimi/kimi-k3.1-pro'), 'kimi')
  assert.equal(providerFor('gemini/gemini-2.5-flash'), 'gemini')
  assert.equal(providerFor('openai/gpt-5'), 'openai')
  assert.equal(providerFor('grok/grok-4.5'), 'grok')
})

test('gemini is asked with the owner\'s user id; kimi with nothing beside the model\'s own fields', () => {
  const q = { model: 'gemini-2.5-flash', system: 'S', user: 'U', maxTokens: 900, userId: 'u-1' }
  assert.deepEqual(buildModelRequest('gemini', q), { userId: 'u-1', model: 'gemini-2.5-flash', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], max_tokens: 900 })
  assert.deepEqual(buildModelRequest('kimi', { ...q, model: 'kimi-k3.1-pro' }), { messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }], max_tokens: 900 })
})

test('askModel sends a gemini model to gemini-worker with the flow owner\'s user id', async () => {
  const seen = []
  const env = {
    DB: dbWith({ 'tor@example.com': { user_id: 'owner-uuid' } }),
    GEMINI: svc((url, body) => { seen.push([url, body.model, body.userId, body.max_tokens]); return reply({ choices: [{ message: { content: 'Hei fra Gemini' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 3 } }) }),
  }
  const r = await askModel(env, { model: 'gemini/gemini-2.5-flash', system: 's', user: 'u', maxTokens: 700, ownerEmail: 'Tor@Example.com' })
  assert.deepEqual(r, { ok: true, text: 'Hei fra Gemini', usage: { input_tokens: 5, output_tokens: 3 }, stopReason: 'stop' })
  assert.deepEqual(seen, [['https://gemini-worker/chat', 'gemini-2.5-flash', 'owner-uuid', 700]])
})

test('a gemini model is never asked without a known owner, and gemini-worker\'s own refusal is passed on', async () => {
  let calls = 0
  const GEMINI = svc(() => { calls += 1; return reply({}) })
  const noEmail = await askModel({ GEMINI, DB: dbWith({}) }, { model: 'gemini-2.5-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.match(noEmail.error, /no owner e-mail/)
  const unknown = await askModel({ GEMINI, DB: dbWith({}) }, { model: 'gemini-2.5-pro', system: 's', user: 'u', maxTokens: 10, ownerEmail: 'who@example.com' })
  assert.match(unknown.error, /no user was found for who@example\.com/)
  const noDb = await ownerUserId({}, 'tor@example.com')
  assert.match(noDb.error, /binding DB is missing/)
  assert.equal(calls, 0)
  const noKey = await askModel(
    { DB: dbWith({ 'tor@example.com': { user_id: 'owner-uuid' } }), GEMINI: svc(() => reply({ error: 'Google Gemini API key not configured for this user. Please add a Gemini/Google key.' }, 401)) },
    { model: 'gemini-2.5-pro', system: 's', user: 'u', maxTokens: 10, ownerEmail: 'tor@example.com' },
  )
  assert.match(noKey.error, /HTTP 401.*Gemini API key not configured/)
})

test('askModel asks kimi through the AI binding: catalog id, the gateway, and only the model\'s own fields', async () => {
  const seen = []
  const AI = { async run(id, input, opts) { seen.push([id, input, opts]); return { choices: [{ message: { content: 'Hei fra Kimi', reasoning_content: 'tenker' }, finish_reason: 'stop' }], usage: { prompt_tokens: 7, completion_tokens: 4 } } } }
  const r = await askModel({ AI }, { model: 'kimi-k3.1-pro', system: 's', user: 'u', maxTokens: 800, ownerEmail: 'tor@example.com' })
  assert.deepEqual(r, { ok: true, text: 'Hei fra Kimi', usage: { input_tokens: 7, output_tokens: 4 }, stopReason: 'stop' })
  assert.deepEqual(seen, [['moonshotai/kimi-k3.1-pro', { messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], max_tokens: 800 }, { gateway: { id: 'default' } }]])
  await askModel({ AI, AI_GATEWAY_ID: 'vegr' }, { model: 'kimi/kimi-k3.1-pro', system: '', user: 'u', maxTokens: 5 })
  assert.deepEqual(seen[1], ['moonshotai/kimi-k3.1-pro', { messages: [{ role: 'user', content: 'u' }], max_tokens: 5 }, { gateway: { id: 'vegr' } }])
})

test('kimi failures are reported without throwing: no binding, a thrown run, an odd answer, reasoning but no text', async () => {
  const noBinding = await askModel({}, { model: 'kimi-k3.1-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.match(noBinding.error, /Workers AI binding AI is missing/)
  const thrown = await askModel({ AI: { async run() { throw new Error('gateway not found') } } }, { model: 'kimi-k3.1-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.match(thrown.error, /could not reach the model \(Cloudflare model catalog, moonshotai\/kimi-k3\.1-pro\): gateway not found/)
  const odd = await askModel({ AI: { async run() { return { response: 'x' } } } }, { model: 'kimi-k3.1-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.match(odd.error, /unexpected format/)
  const spent = await askModel({ AI: { async run() { return { choices: [{ message: { content: '', reasoning_content: 'lang tanke' }, finish_reason: 'length' }], usage: { prompt_tokens: 9, completion_tokens: 10 } } } } }, { model: 'kimi-k3.1-pro', system: 's', user: 'u', maxTokens: 10 })
  assert.equal(spent.ok, false)
  assert.match(spent.error, /stop reason max_tokens.*the answer held only: reasoning.*raise metadata\.maxTokens/)
})

test('grok and gpt models are asked with the flow owner\'s user id, so the owner\'s own key answers', async () => {
  const seen = []
  const ok = (who) => svc((url, body) => { seen.push([who, body.userId, body.model]); return reply({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) })
  const env = { DB: dbWith({ 'tor@example.com': { user_id: 'owner-uuid' } }), GROK: ok('grok'), OPENAI: ok('openai') }
  assert.equal((await askModel(env, { model: 'grok-4.5', system: 's', user: 'u', maxTokens: 10, ownerEmail: 'tor@example.com' })).ok, true)
  assert.equal((await askModel(env, { model: 'gpt-5', system: 's', user: 'u', maxTokens: 10, ownerEmail: 'tor@example.com' })).ok, true)
  assert.deepEqual(seen, [['grok', 'owner-uuid', 'grok-4.5'], ['openai', 'owner-uuid', 'gpt-5']])
})

test('a grok or gpt model is still asked when the owner is unknown: the platform key is the fallback', async () => {
  const seen = []
  const GROK = svc((url, body) => { seen.push(['userId' in body, body.model]); return reply({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) })
  assert.equal((await askModel({ GROK }, { model: 'grok-4.5', system: 's', user: 'u', maxTokens: 10 })).ok, true)
  assert.equal((await askModel({ GROK, DB: dbWith({}) }, { model: 'grok-4.5', system: 's', user: 'u', maxTokens: 10, ownerEmail: 'who@example.com' })).ok, true)
  assert.deepEqual(seen, [[false, 'grok-4.5'], [false, 'grok-4.5']])
  const noKey = await askModel({ GROK: svc(() => reply({ error: 'Error: X AI API key not configured. Please add your Grok API key.' }, 401)) }, { model: 'grok-4.5', system: 's', user: 'u', maxTokens: 10 })
  assert.match(noKey.error, /HTTP 401.*X AI API key not configured/)
})

test('hasModelConnection counts the AI binding and gemini-worker too', () => {
  assert.equal(hasModelConnection({ AI: { run() {} } }), true)
  assert.equal(hasModelConnection({ AI: { fetch() {} } }), false)
  assert.equal(hasModelConnection({ GEMINI: { fetch() {} } }), true)
})
