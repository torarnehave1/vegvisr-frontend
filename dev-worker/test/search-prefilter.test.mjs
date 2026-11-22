/**
 * The raw-text prefilter in front of free-text search must never drop a real match.
 * Run: node --test dev-worker/test/
 */
import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import * as gs from '../graph-service.js'

const admin = gs.normalizeActor({ valid: true, userId: 'root@example.com', userEmail: 'root@example.com', userRole: 'Superadmin', authMethod: 'oauth', scopes: ['all'] })
let env
const ids = async (query) => (await gs.searchGraphs(env, { query, actor: admin })).results.map((r) => r.title).sort()

beforeEach(() => { env = freshDb().env })

describe('rawTextPrefilter', () => {
  test('a plain query gets the cheap test on data and title', () => {
    const p = gs.rawTextPrefilter('%skuld%', 'skuld')
    assert.equal(p.sql, `(data LIKE ? OR COALESCE(title, '') LIKE ?)`)
    assert.deepEqual(p.bindings, ['%skuld%', '%skuld%'])
  })
  test('a query JSON would escape, or holding _, runs the full search alone', () => {
    for (const q of ['say "hi"', 'a\\b', 'snake_case', 'line\nbreak', 'tab\there']) {
      assert.equal(gs.rawTextPrefilter(`%${q}%`, q), null, q)
    }
  })
})

describe('search results are unchanged by the prefilter', () => {
  beforeEach(async () => {
    await gs.createGraph(env, { title: 'Strikkeoppskrift', metaArea: '#X', nodes: [{ id: 'n1', label: 'Mønster', info: 'Alpakkagarn i rosa\nmed "dobbel" tråd' }], actor: admin })
    await gs.createGraph(env, { title: 'Per Egenæss Stilling', metaArea: '#X', nodes: [{ id: 'n1', label: 'snake_case', info: 'C:\\sti' }], actor: admin })
    await gs.createGraph(env, { title: 'Annet', metaArea: '#X', nodes: [{ id: 'n1', label: 'x', info: 'ingenting her' }], actor: admin })
  })
  test('node text, label, title, Norwegian letters, ASCII case', async () => {
    assert.deepEqual(await ids('alpakka'), ['Strikkeoppskrift'])
    assert.deepEqual(await ids('mønster'), ['Strikkeoppskrift'])
    assert.deepEqual(await ids('ALPAKKA'), ['Strikkeoppskrift'])
    assert.deepEqual(await ids('egenæss'), ['Per Egenæss Stilling'])
  })
  test('the * wildcard still bridges words', async () => {
    assert.deepEqual(await ids('per * stilling'), ['Per Egenæss Stilling'])
  })
  test('queries holding escaped characters still find their graph', async () => {
    assert.deepEqual(await ids('"dobbel"'), ['Strikkeoppskrift'])
    assert.deepEqual(await ids('snake_case'), ['Per Egenæss Stilling'])
    assert.deepEqual(await ids('c:\\sti'), ['Per Egenæss Stilling'])
  })
  test('no match is no match', async () => {
    assert.deepEqual(await ids('finnesikke'), [])
  })
})
