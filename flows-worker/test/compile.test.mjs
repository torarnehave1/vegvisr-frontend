// VEGR Flows compiler + dry run (2026-11-06). Plain Node: node --test flows-worker/test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileFlow, dryRun, templateRefs } from '../compile.js'

const ALIASES = [
  { alias: 'fast', model: 'claude-haiku-5-5', fallbackAlias: 'smart' },
  { alias: 'smart', model: 'claude-sonnet-5-5' },
  { alias: 'auto', model: 'auto', fallbackAlias: 'smart' },
]

const flowNode = (meta = {}) => ({ id: 'f', type: 'flow', label: 'Hei, flow', metadata: { kind: 'vegr-flow', schema: 1, status: 'test', ...meta } })
const step = (id, kind, meta = {}) => ({ id, type: 'flow-step', label: id, metadata: { kind, ...meta } })
const edge = (source, target, label) => ({ source, target, ...(label ? { label } : {}) })

test('a simple three-step flow compiles and dry-runs in order', () => {
  const g = {
    id: 'g1', version: 3,
    nodes: [
      flowNode(),
      step('read', 'action', { toolName: 'list_my_graphs', params: { limit: 3 } }),
      step('sum', 'agent', { model: 'fast', instructions: 'Summarise', input: { graphs: '{{read.result.results}}' } }),
      step('end', 'note'),
      { id: 'doc', type: 'fulltext', label: 'Docs' },
    ],
    edges: [edge('f', 'read'), edge('read', 'sum', 'next'), edge('sum', 'end'), edge('doc', 'read')],
  }
  const c = compileFlow(g, ALIASES)
  assert.equal(c.ok, true, JSON.stringify(c.errors))
  assert.equal(c.spec.entry, 'read')
  assert.equal(c.spec.steps.sum.resolvedModel.model, 'claude-haiku-5-5')
  assert.equal(c.spec.steps.sum.resolvedFallback.model, 'claude-sonnet-5-5')
  const r = dryRun(c.spec)
  assert.deepEqual(r.records.map((x) => x.nodeId), ['read', 'sum', 'end'])
  assert.match(r.records[0].summary, /would call list_my_graphs/)
  assert.equal(r.stoppedByLimit, false)
})

test('the entry is found without an edge from the flow node when there is one root', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'note'), step('b', 'note')], edges: [edge('a', 'b')] }, ALIASES)
  assert.equal(c.ok, true)
  assert.equal(c.spec.entry, 'a')
})

test('an external action without an approval before it is refused', () => {
  const c = compileFlow({
    id: 'g', nodes: [flowNode(), step('draft', 'agent', { model: 'smart', instructions: 'x' }), step('send', 'action', { toolName: 'send_sms', params: {} })],
    edges: [edge('f', 'draft'), edge('draft', 'send')],
  }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /send_sms.*without an approval/)
})

test('the same action after an approval compiles, and the dry run passes as approved', () => {
  const c = compileFlow({
    id: 'g',
    nodes: [flowNode(), step('draft', 'agent', { model: 'smart', instructions: 'x' }), step('ok', 'approval', {}), step('send', 'action', { toolName: 'send_sms', params: { to: '{{inputs.phone}}' } }), step('stop', 'note')],
    edges: [edge('f', 'draft'), edge('draft', 'ok'), edge('ok', 'send', 'approved'), edge('ok', 'stop', 'rejected')],
  }, ALIASES)
  assert.equal(c.ok, true, JSON.stringify(c.errors))
  const r = dryRun(c.spec, { inputs: { phone: '+4700000000' } })
  assert.deepEqual(r.records.map((x) => x.nodeId), ['draft', 'ok', 'send'])
  assert.equal(r.records[2].detail.params.to, '+4700000000')
})

test('an agent may not hold tools that reach other people', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'agent', { model: 'fast', instructions: 'x', tools: ['send_email'] })], edges: [] }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /may not hold tools/)
})

test('an unknown model alias is refused; an explicit model id is accepted', () => {
  const bad = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'agent', { model: 'turbo', instructions: 'x' })], edges: [] }, ALIASES)
  assert.equal(bad.ok, false)
  const good = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'agent', { model: 'claude-opus-5-5', instructions: 'x' })], edges: [] }, ALIASES)
  assert.equal(good.ok, true)
  assert.equal(good.spec.steps.a.resolvedModel.via, 'explicit')
})

test('a cycle without a loop step is refused; through a loop step it is allowed', () => {
  const cyc = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'note'), step('b', 'note')], edges: [edge('f', 'a'), edge('a', 'b'), edge('b', 'a')] }, ALIASES)
  assert.equal(cyc.ok, false)
  assert.match(cyc.errors.join('\n'), /cycle/)
  const loop = compileFlow({
    id: 'g', nodes: [flowNode(), step('l', 'loop', { maxItems: 5, items: [] }), step('body', 'note'), step('done', 'note')],
    edges: [edge('f', 'l'), edge('l', 'body', 'each'), edge('body', 'l'), edge('l', 'done', 'done')],
  }, ALIASES)
  assert.equal(loop.ok, true, JSON.stringify(loop.errors))
  assert.deepEqual(dryRun(loop.spec).records.map((x) => x.nodeId), ['l', 'done'])
})

test('a template pointing at a missing step is refused', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'action', { toolName: 'x', params: { v: '{{nope.result.y}}' } })], edges: [] }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /no step with id "nope"/)
})

test('no flow node, two flow nodes, bad kinds and missing fields are all reported', () => {
  assert.equal(compileFlow({ id: 'g', nodes: [step('a', 'note')], edges: [] }).ok, false)
  assert.equal(compileFlow({ id: 'g', nodes: [flowNode(), { ...flowNode(), id: 'f2' }], edges: [] }).ok, false)
  const c = compileFlow({
    id: 'g', nodes: [flowNode(), step('a', 'teleport'), step('b', 'action', {}), step('c', 'loop', {}), step('d', 'wait', {})], edges: [],
  }, ALIASES)
  assert.equal(c.ok, false)
  const all = c.errors.join('\n')
  for (const re of [/teleport/, /toolName is required/, /maxItems/, /duration is required/]) assert.match(all, re)
})

test('an approval without an "approved" edge is refused', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'approval'), step('b', 'note')], edges: [edge('f', 'a'), edge('a', 'b', 'next')] }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /needs an edge labelled "approved"/)
})

test('the dry run stops at limits.maxSteps', () => {
  const nodes = [flowNode({ limits: { maxSteps: 2 } }), step('a', 'note'), step('b', 'note'), step('c', 'note')]
  const c = compileFlow({ id: 'g', nodes, edges: [edge('f', 'a'), edge('a', 'b'), edge('b', 'c')] }, ALIASES)
  const r = dryRun(c.spec)
  assert.equal(r.records.length, 2)
  assert.equal(r.stoppedByLimit, true)
})

test('templateRefs finds nested references', () => {
  assert.deepEqual(templateRefs({ a: ['{{x.result.y}}', { b: 'hi {{inputs.name}}' }] }), [['x', 'result.y'], ['inputs', 'name']])
})
