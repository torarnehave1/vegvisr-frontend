/**
 * templates-service — the extracted template query and the element catalog.
 * Run: node --test dev-worker/test/templates.test.mjs
 *
 * The extraction itself was verified against production: the local response and the live one
 * were byte-identical at 25251 bytes. These cover the projection and its edges.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, seedTemplates } from './d1-adapter.mjs'
import * as tpl from '../templates-service.js'
import * as gs from '../graph-service.js'

function setup() {
  const { env, raw } = freshDb()
  seedTemplates(raw, [
    { id: 'elt-fancy', name: 'FANCY', ai: { kind: 'fulltext-element', trigger: '[FANCY]', insert_mode: 'block', format: '[FANCY | font-size: 4.5em; color: #333]Din tekst[END FANCY]', parameters: 'font-size, color', notes: 'Bruk for overskrifter' } },
    { id: 'elt-quote', name: 'QUOTE', ai: { trigger: '[QUOTE]', insert_mode: 'block', format: '[QUOTE | Cited=Navn]Sitatet[END QUOTE]', parameters: 'Cited' } },
    { id: 'elt-center', name: 'Center Image', ai: { trigger: '![Center', insert_mode: 'inline', format: '![Center|width: 300px](url)' } },
    { id: 'elt-broken', name: 'BROKEN', ai: 'this is not json' },
    { id: 'tpl-other', name: 'Some Node Template', category: 'Content', ai: { trigger: 'x' } },
  ])
  return { env, raw }
}

describe('listTemplates — the extracted query', () => {
  test('fulltext-elements mode selects that category only', async () => {
    const { env } = setup()
    const r = await tpl.listTemplates(env, {})
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'fulltext-elements')
    assert.equal(r.category, 'Fulltext Elements')
    assert.equal(r.results.some((x) => x.name === 'Some Node Template'), false)
  })

  test('node-templates mode EXCLUDES that category rather than selecting it', async () => {
    const { env } = setup()
    const r = await tpl.listTemplates(env, { mode: 'node-templates' })
    assert.deepEqual(r.results.map((x) => x.name), ['Some Node Template'])
  })

  test('rows come back in the shape the REST endpoint has always sent', async () => {
    const { env } = setup()
    const row = (await tpl.listTemplates(env, {})).results[0]
    for (const k of ['id', 'name', 'nodes', 'edges', 'ai_instructions', 'category', 'thumbnail_path', 'standard_question', 'gemini', 'tool', 'plugin']) {
      assert.ok(k in row, `the response lost ${k}`)
    }
    assert.ok(Array.isArray(row.nodes), 'nodes must be parsed, not a JSON string')
  })

  test('plugin=0 returns nothing when every row is a plugin row', async () => {
    const { env } = setup()
    assert.equal((await tpl.listTemplates(env, { plugin: 0 })).count, 0)
  })
})

describe('listFulltextElements — the projection a model reads', () => {
  test('returns trigger, format, parameters and notes', async () => {
    const { env } = setup()
    const r = await tpl.listFulltextElements(env)
    const fancy = r.elements.find((e) => e.name === 'FANCY')
    assert.equal(fancy.trigger, '[FANCY]')
    assert.equal(fancy.insertMode, 'block')
    assert.match(fancy.format, /\[FANCY \| font-size/)
    assert.equal(fancy.parameters, 'font-size, color')
    assert.equal(fancy.notes, 'Bruk for overskrifter')
  })

  test('it is compact — no node templates ride along', async () => {
    const { env } = setup()
    const r = await tpl.listFulltextElements(env)
    for (const e of r.elements) {
      assert.equal('nodes' in e, false, 'the full node template leaked into the projection')
      assert.equal('ai_instructions' in e, false, 'the raw JSON string leaked')
    }
  })

  test('an element whose instructions will not parse is NAMED, not dropped', async () => {
    const { env } = setup()
    const r = await tpl.listFulltextElements(env)
    assert.equal(r.elements.some((e) => e.name === 'BROKEN'), false)
    assert.deepEqual(r.unreadable, ['BROKEN'], 'a silently dropped element teaches the model it does not exist')
  })

  test('unreadable is absent when every row parses', async () => {
    const { env, raw } = setup()
    raw.prepare('DELETE FROM graphTemplates WHERE id = ?').run('elt-broken')
    assert.equal('unreadable' in (await tpl.listFulltextElements(env)), false)
  })

  test('name matches exactly or as a substring, case-insensitively', async () => {
    const { env } = setup()
    assert.equal((await tpl.listFulltextElements(env, { name: 'FANCY' })).count, 1)
    assert.equal((await tpl.listFulltextElements(env, { name: 'fancy' })).count, 1)
    assert.equal((await tpl.listFulltextElements(env, { name: 'center' })).elements[0].name, 'Center Image')
  })

  test('a name that matches nothing says so, and says how to see them all', async () => {
    const { env } = setup()
    const r = await tpl.listFulltextElements(env, { name: 'FLEXBOX-CARDS-WITH-GAP' })
    assert.equal(r.ok, false)
    assert.equal(r.code, gs.ERR.GRAPH_NOT_FOUND)
    assert.match(r.message, /without a name to see them all/)
  })

  test('missing fields become null rather than undefined', async () => {
    const { env } = setup()
    const center = (await tpl.listFulltextElements(env, { name: 'Center Image' })).elements[0]
    assert.equal(center.parameters, null)
    assert.equal(center.notes, null)
  })
})
