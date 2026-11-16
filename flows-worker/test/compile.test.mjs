// VEGR Flows compiler + dry run (2026-11-06). Plain Node: node --test flows-worker/test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forEachPlan, contactSource, compileFlow, dryRun, templateRefs } from '../compile.js'

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
    id: 'g', nodes: [flowNode(), step('draft', 'agent', { model: 'smart', instructions: 'x' }), step('send', 'action', { toolName: 'send_email', params: {} })],
    edges: [edge('f', 'draft'), edge('draft', 'send')],
  }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /send_email.*without an approval/)
})

test('the same action after an approval compiles, and the dry run passes as approved', () => {
  const c = compileFlow({
    id: 'g',
    nodes: [flowNode(), step('draft', 'agent', { model: 'smart', instructions: 'x' }), step('ok', 'approval', {}), step('send', 'action', { toolName: 'send_email', params: { to: '{{inputs.phone}}' } }), step('stop', 'note')],
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

import { render } from '../compile.js'
test('a value that is one template keeps its type; a template inside text becomes text', () => {
  const state = { inputs: { n: 3 }, trigger: {}, owner: { email: 'o@x.no' }, results: { p: { result: { subject: 'S', textPreview: 'T' } } } }
  assert.deepEqual(render({ preview: '{{p.result}}', n: '{{inputs.n}}', line: 'Til {{owner.email}}' }, state), { preview: { subject: 'S', textPreview: 'T' }, n: 3, line: 'Til o@x.no' })
  assert.equal(render('{{nope.result}}', state), '{{nope.result}}', 'an unknown reference stays visible')
})

test('an approval preview may not use a tool that reaches other people', () => {
  const g = {
    id: 'g', nodes: [
      { id: 'f', type: 'flow', metadata: { kind: 'vegr-flow' } },
      { id: 'a', type: 'flow-step', label: 'Godkjenn', metadata: { kind: 'approval', preview: { toolName: 'send_email', params: {} } } },
      { id: 'n', type: 'flow-step', label: 'Ferdig', metadata: { kind: 'note' } },
    ], edges: [{ source: 'f', target: 'a' }, { source: 'a', target: 'n', label: 'approved' }],
  }
  const c = compileFlow(g)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /preview may not use send_email/)
})


// ── forEach and sending to ContactHub contacts (2026-11-16) ──
const contactsFlow = (send, lookup = { toolName: 'list_contacts', params: { label: 'STILLEROM' } }, extra = []) => compileFlow({
  id: 'g',
  nodes: [flowNode(), step('k', 'action', lookup), step('ok', 'approval', {}), step('send', 'action', send), ...extra],
  edges: [edge('f', 'k'), edge('k', 'ok'), edge('ok', 'send', 'approved')],
}, ALIASES)

test('a send to the contacts of a list_contacts step with a fixed label compiles', () => {
  const c = contactsFlow({ toolName: 'send_sms', forEach: '{{k.result.contacts}}', params: { toPhone: '{{item.phones.0}}', message: 'Hei {{item.name}}' } })
  assert.equal(c.ok, true, JSON.stringify(c.errors))
  assert.equal(c.spec.steps.send.maxItems, 50)
  assert.deepEqual(contactSource(c.spec, c.spec.steps.send), { stepId: 'k', label: 'STILLEROM' })
})

test('recipients must come from ContactHub by a fixed label — not from a model, an input, the whole book or a typed address', () => {
  const bad = [
    [{ toolName: 'send_sms', params: { toPhone: '+4790000000', message: 'x' } }, undefined, /only to contacts looked up in ContactHub/],
    [{ toolName: 'send_email', forEach: '{{k.result.contacts}}', params: { toEmail: 'a@b.no' } }, undefined, /params\.toEmail must come from the contact/],
    [{ toolName: 'send_email', forEach: '{{k.result.contacts}}', params: { toEmail: '{{item.emails.0}}' } }, { toolName: 'list_contacts', params: {} }, /fixed label/],
    [{ toolName: 'send_email', forEach: '{{k.result.contacts}}', params: { toEmail: '{{item.emails.0}}' } }, { toolName: 'list_contacts', params: { label: '{{inputs.label}}' } }, /fixed label/],
    [{ toolName: 'send_email', forEach: '{{k.result.contacts}}', params: { toEmail: '{{item.emails.0}}' } }, { toolName: 'search_contacts', params: { query: 'x' } }, /fixed label/],
    [{ toolName: 'send_email', forEach: '{{inputs.liste}}', params: { toEmail: '{{item.emails.0}}' } }, undefined, /fixed label/],
    [{ toolName: 'send_group_alert', forEach: '{{k.result.contacts}}', params: {} }, undefined, /cannot be sent to a list of contacts/],
    [{ toolName: 'send_sms', forEach: '{{k.result.contacts}}', maxItems: 500, params: { toPhone: '{{item.phones.0}}' } }, undefined, /maxItems must be 1–200/],
    [{ toolName: 'send_sms', forEach: 'alle', params: { toPhone: '{{item.phones.0}}' } }, undefined, /forEach must be one reference/],
  ]
  for (const [send, lookup, why] of bad) {
    const c = contactsFlow(send, lookup)
    assert.equal(c.ok, false, JSON.stringify(send))
    assert.match(c.errors.join('\n'), why)
  }
})

test('a forEach send still needs an approval before it', () => {
  const c = compileFlow({
    id: 'g',
    nodes: [flowNode(), step('k', 'action', { toolName: 'list_contacts', params: { label: 'X' } }), step('send', 'action', { toolName: 'send_email', forEach: '{{k.result.contacts}}', params: { toEmail: '{{item.emails.0}}' } })],
    edges: [edge('f', 'k'), edge('k', 'send')],
  }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /without an approval/)
})

test('{{item}} belongs to forEach steps and {{payload}} to an approval preview — elsewhere they are unknown steps', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('a', 'action', { toolName: 'get_graph', params: { graphId: '{{item.id}}' } }), step('ok', 'approval', { payload: { t: '{{payload.x}}' } })], edges: [edge('f', 'a'), edge('a', 'ok')] }, ALIASES)
  assert.equal(c.ok, false)
  assert.match(c.errors.join('\n'), /no step with id "item"/)
  assert.match(c.errors.join('\n'), /no step with id "payload"/)
})

test('forEach also repeats a tool that reaches nobody, and the plan refuses a list that is not one or is too long', () => {
  const c = compileFlow({ id: 'g', nodes: [flowNode(), step('l', 'action', { toolName: 'list_my_graphs' }), step('each', 'action', { toolName: 'get_graph', forEach: '{{l.result.results}}', maxItems: 2, params: { graphId: '{{item.graphId}}' } })], edges: [edge('f', 'l'), edge('l', 'each')] }, ALIASES)
  assert.equal(c.ok, true, JSON.stringify(c.errors))
  const st = (results) => ({ inputs: {}, trigger: {}, owner: { email: 'o@x.no' }, results: { l: { result: { results } } }, approved: false, sends: 0 })
  assert.deepEqual(forEachPlan(c.spec, 'each', st([{ graphId: 'a' }]), 1).items, [{ graphId: 'a' }])
  assert.match(forEachPlan(c.spec, 'each', st('tekst'), 1).outcome.stop, /is not a list/)
  assert.match(forEachPlan(c.spec, 'each', st([1, 2, 3]), 1).outcome.stop, /3 items, more than this step's maxItems 2/)
  assert.equal(forEachPlan(c.spec, 'each', st([]), 1).outcome.record.status, 'ok')
  assert.match(forEachPlan(c.spec, 'each', { inputs: {}, results: {} }, 1).outcome.stop, /no value for \{\{l\.result\.results\}\}/)
})
