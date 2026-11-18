/**
 * search_text's rules (mcp/search-text.js), without a database.
 * Run: node --test dev-worker/test/search-text.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseQuery, matchGraph, collectWords, suggest, EXCLUDED_NODE_TYPES, LABEL_ONLY_NODE_TYPES } from '../mcp/search-text.js'

const graph = {
  metadata: { title: 'Livspuls – studien', description: 'En videreføring', metaArea: '#KOHESJON', createdBy: 'kohesjon@example.test' },
  nodes: [
    { id: 'tekst', type: 'fulltext', label: 'Oversikt', info: 'Pulsen i gruppen. Økonomi og kohesjon.', color: '#kohesjon', path: 'https://example.test/kohesjon.png' },
    { id: 'side', type: 'html-node', label: 'Siden', info: '<p>bare i html: fjellrev</p>' },
    { id: 'ord', type: 'sanskrit-ord', label: 'yoga', info: 'forening', metadata: { devanagari: 'योग', meaning: { translation: 'å binde sammen', roots: [{ t: 'yuj', no: 'åk' }] }, sourceNodeId: 'fjellrev' } },
    { id: 'diagram', type: 'mermaid-diagram', label: 'Flyten i gruppen', info: 'graph TB\n  A[hemmelig] --> B' },
    { id: 'video', type: 'youtube-video', label: 'Forelesning', info: 'Om grounding', path: 'https://youtube.com/watch?v=grounding123' },
    { id: 'stor', type: 'fulltext', label: 'STORE BOKSTAVER', info: 'SPØRSMÅL OM ØKONOMI' },
  ],
}
const hits = (q) => matchGraph(graph, parseQuery(q).rx)

test('a word matches as a whole word, in any case', () => {
  assert.deepEqual(hits('kohesjon').nodeIds, ['tekst'])
  assert.deepEqual(hits('KOHESJON').nodeIds, ['tekst'])
  assert.equal(hits('puls'), null, '"puls" is not a word in "Pulsen" or "Livspuls"')
  assert.deepEqual(hits('økonomi').nodeIds, ['tekst', 'stor'])
  assert.deepEqual(hits('spørsmål').nodeIds, ['stor'])
})

test('* stands for any letters, at either end or inside', () => {
  assert.deepEqual(hits('puls*').nodeIds, ['tekst'])
  assert.equal(hits('*puls').inTitle, true)
  assert.deepEqual(hits('*puls').nodeIds, [])
  assert.deepEqual(hits('koh*jon').nodeIds, ['tekst'])
})

test('several words are a phrase', () => {
  assert.deepEqual(hits('økonomi og kohesjon').nodeIds, ['tekst'])
  assert.equal(hits('kohesjon og økonomi'), null)
  assert.deepEqual(hits('binde sammen').nodeIds, ['ord'])
})

test('the title and the description are searched', () => {
  assert.deepEqual(hits('studien'), { inTitle: true, nodeIds: [] })
  assert.equal(hits('videreføring').inTitle, true)
})

test('text a node type keeps in metadata is found', () => {
  assert.deepEqual(hits('yuj').nodeIds, ['ord'])
  assert.deepEqual(hits('योग').nodeIds, ['ord'])
})

test('not searched: excluded node types, technical fields, addresses, a diagram\'s source', () => {
  assert.equal(hits('fjellrev'), null, 'only in an html-node and in an id field')
  assert.equal(hits('hemmelig'), null, 'only in a diagram\'s source')
  assert.deepEqual(hits('flyten').nodeIds, ['diagram'], 'a diagram\'s name is searched')
  assert.equal(hits('grounding123'), null, 'only in an address')
  assert.deepEqual(hits('grounding').nodeIds, ['video'], 'a video\'s description is searched')
  assert.equal(hits('fulltext'), null, 'a type name is not text')
  assert.equal(hits('example'), null, 'createdBy and paths are not text')
})

test('the lists hold what the architect chose as the starting point', () => {
  for (const t of ['html-node', 'css-node', 'json-node', 'agent-config', 'stripe-button']) assert.ok(EXCLUDED_NODE_TYPES.has(t), t)
  for (const t of ['fulltext', 'sanskrit-ord', 'oppgave', 'micro-story', 'youtube-video']) assert.ok(!EXCLUDED_NODE_TYPES.has(t), t)
  assert.ok(LABEL_ONLY_NODE_TYPES.has('mermaid-diagram'))
})

test('parseQuery refuses what cannot be searched and names the spellings to look for', () => {
  assert.match(parseQuery('').error, /word/)
  assert.match(parseQuery('a').error, /two letters/)
  assert.match(parseQuery('*a*').error, /two letters/)
  assert.deepEqual(parseQuery('Kohesjon').literals, ['kohesjon'])
  assert.deepEqual(parseQuery('økonomi').literals, ['økonomi', 'Økonomi'])
  assert.deepEqual(parseQuery('spørsmål').literals, ['spørsmål', 'spØrsmÅl'])
  assert.equal(parseQuery('puls*').literals[0], 'puls')
  assert.equal(parseQuery('puls').plain, true)
  assert.equal(parseQuery('puls*').plain, false)
  assert.equal(parseQuery('to ord').plain, false)
  assert.equal(parseQuery('a.b(c)').rx.test('x a.b(c) y'), true, 'signs in the text are read as signs')
})

test('spelling help offers the closest words that exist, never the word itself', () => {
  const vocab = new Map()
  collectWords(graph, vocab)
  assert.ok(vocab.has('kohesjon') && vocab.has('yuj') && !vocab.has('fjellrev') && !vocab.has('hemmelig'))
  assert.deepEqual(suggest('kohesion', vocab), ['kohesjon'])
  assert.deepEqual(suggest('økonmi', vocab), ['økonomi'])
  assert.deepEqual(suggest('okonomi', vocab), ['økonomi'])
  assert.deepEqual(suggest('kohesjon', vocab), [])
  assert.deepEqual(suggest('xyzxyzxyz', vocab), [])
  assert.deepEqual(suggest('yug', vocab), ['yuj'], 'one slip is allowed in a short word')
})
