// The strict engine (2026-11-13, after the failed Samtalerapport runs of 10 Nov): a live step
// stops on a reference with no value, a cut-off answer, JSON without its keys — and accepts a
// node that an earlier run already wrote. Plain Node: node --test flows-worker/test/*.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileFlow, liveStep, render, schemaKeys, dryRun } from '../compile.js'

const ALIASES = [{ alias: 'smart', model: 'claude-sonnet-5-5' }]
const flowNode = (meta = {}) => ({ id: 'f', type: 'flow', label: 'Test', metadata: { kind: 'vegr-flow', schema: 1, status: 'test', ...meta } })
const step = (id, kind, meta = {}) => ({ id, type: 'flow-step', label: id, metadata: { kind, ...meta } })
const edge = (source, target, label) => ({ source, target, ...(label ? { label } : {}) })
const compile = (nodes, edges) => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), ...nodes], edges }, ALIASES)
  assert.ok(c.ok, (c.errors || []).join('; '))
  return c.spec
}
const state = (results = {}, inputs = {}) => ({ inputs, trigger: { type: 'manual' }, owner: { email: 'o@x.no' }, results, approved: false, sends: 0, costUsd: 0 })
const never = () => { throw new Error('must not be called') }

test('render collects references with no value, and still leaves them visible', () => {
  const missing = []
  const out = render({ a: '{{t.result.text}}', b: 'Hei {{inputs.navn}}', c: '{{t.result.transcript}}' }, state({ t: { result: { transcript: 'abc' } } }), missing)
  assert.deepEqual(out, { a: '{{t.result.text}}', b: 'Hei {{inputs.navn}}', c: 'abc' })
  assert.deepEqual(missing.map((m) => m.ref), ['{{t.result.text}}', '{{inputs.navn}}'])
})

test('an action with a reference that has no value fails BEFORE the tool is called, and names the fields that exist', async () => {
  const spec = compile(
    [step('t', 'action', { toolName: 'transcribe_contact_recording', params: {} }), step('skriv', 'action', { toolName: 'add_node', params: { node: { info: '{{t.result.text}}' } } })],
    [edge('f', 't'), edge('t', 'skriv')],
  )
  const r = await liveStep(spec, 'skriv', state({ t: { result: { transcript: 'abc', graphId: 'g1', nodeId: 'n1' } } }), { callTool: never })
  assert.equal(r.record.status, 'error')
  assert.match(r.stop, /no value for \{\{t\.result\.text\}\}/)
  assert.match(r.stop, /transcript, graphId, nodeId/)
  assert.deepEqual(r.record.detail.missing, ['{{t.result.text}}'])
})

test('an agent with a reference that has no value fails before the model is asked', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'Skriv om {{inputs.navn}}', input: { tekst: '{{inputs.tekst}}' } })], [edge('f', 'a')])
  const r = await liveStep(spec, 'a', state({}, { tekst: 'x' }), { callModel: never })
  assert.match(r.stop, /\{\{inputs\.navn\}\}.*inputs given: tekst/)
})

test('a dry run is not strict: its results are placeholders', () => {
  const spec = compile(
    [step('t', 'action', { toolName: 'get_graph', params: {} }), step('a', 'agent', { model: 'smart', instructions: 'x', input: { t: '{{t.result.nodes.0.info}}' } })],
    [edge('f', 't'), edge('t', 'a')],
  )
  const d = dryRun(spec)
  assert.equal(d.records.length, 2)
  assert.ok(d.records.every((x) => x.status === 'ok'))
})

test('a cut-off answer says so, with token use and both ends of the text', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'x', maxTokens: 4000 })], [edge('f', 'a')])
  const long = `START${'x'.repeat(5000)}END`
  const r = await liveStep(spec, 'a', state(), { callModel: async () => ({ ok: true, text: long, usage: { input_tokens: 10, output_tokens: 4000 }, stopReason: 'max_tokens' }) })
  assert.match(r.stop, /cut off at maxTokens 4000/)
  assert.equal(r.record.detail.stopReason, 'max_tokens')
  assert.equal(r.record.detail.usage.output_tokens, 4000)
  assert.ok(r.record.detail.textStart.startsWith('START') && r.record.detail.textEnd.endsWith('END'))
  assert.ok(r.record.detail.costUsd > 0, 'a failed step still counts its cost')
})

test('JSON that does not parse gets ONE more try; the second answer is used', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'x', outputSchema: { tittel: 'string', dato: 'string' } })], [edge('f', 'a')])
  const answers = ['{"tittel": "A "quoted" word"}', '{"tittel":"A","dato":"2026-11-13"}']
  let calls = 0
  const r = await liveStep(spec, 'a', state(), { callModel: async () => ({ ok: true, text: answers[calls++], usage: { input_tokens: 100, output_tokens: 100 }, stopReason: 'end_turn' }) })
  assert.equal(calls, 2)
  assert.equal(r.record.status, 'ok')
  assert.equal(r.result.dato, '2026-11-13')
  assert.match(r.record.summary, /second try/)
  assert.ok(Math.abs(r.record.detail.costUsd - 2 * (100 * 3 + 100 * 15) / 1e6) < 1e-9, 'both calls are counted')
})

test('JSON that fails twice stops the step and says it was not a cut-off', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'x', outputSchema: { tittel: 'string' } })], [edge('f', 'a')])
  let calls = 0
  const r = await liveStep(spec, 'a', state(), { callModel: async () => { calls += 1; return { ok: true, text: 'ingen json', usage: null, stopReason: 'end_turn' } } })
  assert.equal(calls, 2)
  assert.match(r.stop, /twice without valid JSON/)
})

test('a JSON answer must carry every key the outputSchema asks for', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'x', outputSchema: { tittel: 'string', dato: 'string' } })], [edge('f', 'a')])
  const r = await liveStep(spec, 'a', state(), { callModel: async () => ({ ok: true, text: '{"tittel":"A"}', usage: null, stopReason: 'end_turn' }) })
  assert.match(r.stop, /lacks dato/)
  assert.deepEqual(schemaKeys({ type: 'object', properties: { a: {}, b: {} }, required: ['a'] }), ['a'])
  assert.deepEqual(schemaKeys({ type: 'object', properties: { a: {}, b: {} } }), ['a', 'b'])
})

test('a plain-text agent step (no outputSchema) never goes through JSON', async () => {
  const spec = compile([step('a', 'agent', { model: 'smart', instructions: 'x' })], [edge('f', 'a')])
  const r = await liveStep(spec, 'a', state(), { callModel: async () => ({ ok: true, text: '# Oppsummering\n"sitat" {ikke json', usage: null, stopReason: 'end_turn' }) })
  assert.equal(r.record.status, 'ok')
  assert.equal(r.result.text, '# Oppsummering\n"sitat" {ikke json')
})

test('add_node on a node an earlier run wrote is fine; any other tool error still fails', async () => {
  const spec = compile(
    [step('n', 'action', { toolName: 'add_node', params: { graphId: 'g1', node: { id: 'fast-id' } } }), step('e', 'action', { toolName: 'add_edge', params: { graphId: 'g1' } }), step('m', 'action', { toolName: 'update_graph_metadata', params: {} }), step('nei', 'action', { toolName: 'add_node', existsOk: false, params: {} })],
    [edge('f', 'n'), edge('n', 'e'), edge('e', 'm'), edge('m', 'nei')],
  )
  const exists = { ok: true, isError: true, structured: { success: false, code: 'NODE_EXISTS', message: 'Node with id fast-id already exists in graph g1.' }, text: 'NODE_EXISTS: Node with id fast-id already exists in graph g1.' }
  const n = await liveStep(spec, 'n', state(), { callTool: async () => exists })
  assert.equal(n.record.status, 'ok')
  assert.equal(n.stop, null)
  assert.equal(n.nextId, 'e')
  assert.deepEqual(n.result, { alreadyExists: true, graphId: 'g1', nodeId: 'fast-id' })

  const e = await liveStep(spec, 'e', state(), { callTool: async () => ({ ok: true, isError: true, structured: { success: false, code: 'INVALID_INPUT', message: 'Edge a_b already exists in graph g1.' }, text: 'INVALID_INPUT: Edge a_b already exists in graph g1.' }) })
  assert.equal(e.record.status, 'ok')

  const m = await liveStep(spec, 'm', state(), { callTool: async () => exists })
  assert.equal(m.record.status, 'error', 'only add_node / add_edge accept "already there"')

  const nei = await liveStep(spec, 'nei', state(), { callTool: async () => exists })
  assert.equal(nei.record.status, 'error', 'existsOk: false turns it off')

  const other = await liveStep(spec, 'n', state(), { callTool: async () => ({ ok: true, isError: true, structured: { code: 'INVALID_NODE_TYPE', message: 'x' }, text: 'INVALID_NODE_TYPE: x' }) })
  assert.equal(other.record.status, 'error')
})
