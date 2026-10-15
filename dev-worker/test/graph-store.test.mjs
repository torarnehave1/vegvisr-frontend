/**
 * graph-store.js — the store seam, against a real SQLite engine with the real schema.
 * Run: node --test dev-worker/test/
 *
 * graph-service.test.mjs proves the service still behaves. These prove the properties the seam
 * itself promises, the ones a second store implementation will be held to: one commit() is a row,
 * a history row and a trim; null leaves a column alone; a lost race writes nothing.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb } from './d1-adapter.mjs'
import { PlatformStore, D1GraphStore, platformStore, resolveGraphStore } from '../graph-store.js'

const ID = '11111111-1111-4111-8111-111111111111'
const blob = (version, extra = {}) => JSON.stringify({ metadata: { version, ...extra }, nodes: [], edges: [] })
const NOW = '2026-10-13T10:00:00.000Z'

async function seeded() {
  const { env } = freshDb()
  const store = platformStore(env)
  await store.commit({ id: ID, create: true, data: blob(1), version: 1, now: NOW, title: 'T', description: 'D', createdBy: 'alice@example.com', userId: 'u1', sourceApp: 'app' })
  return { env, store }
}

const historyVersions = async (store) =>
  (await store.all('SELECT version FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version', [ID])).map((r) => r.version)

describe('resolveGraphStore', () => {
  test('every graph resolves to the platform store today', async () => {
    const { env } = freshDb()
    const store = await resolveGraphStore(env, { graphId: ID })
    assert.ok(store instanceof PlatformStore)
    assert.equal(store.kind, 'platform')
    assert.equal(store.world, null)
  })
})

describe('commit — create', () => {
  test('writes the row and exactly one history row at the given version', async () => {
    const { store } = await seeded()
    const row = await store.getRow(ID)
    assert.equal(row.created_by, 'alice@example.com')
    assert.equal(row.user_id, 'u1')
    assert.equal(row.created_date, NOW)
    assert.equal(await store.exists(ID), true)
    assert.equal(await store.currentVersion(ID), 1)
    assert.deepEqual(await historyVersions(store), [1])
  })
  test('a graph that does not exist has no row, and version 0', async () => {
    const { env } = freshDb()
    const store = platformStore(env)
    assert.equal(await store.getRow(ID), null)
    assert.equal(await store.exists(ID), false)
    assert.equal(await store.currentVersion(ID), 0)
  })
})

describe('commit — update', () => {
  test('null column values leave the stored columns untouched', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2), version: 2, now: '2026-10-13T11:00:00.000Z' })
    const row = await store.first('SELECT title, description, created_by, user_id, source_app, updated_at, created_date FROM knowledge_graphs WHERE id = ?', [ID])
    assert.deepEqual({ ...row }, {
      title: 'T', description: 'D', created_by: 'alice@example.com', user_id: 'u1', source_app: 'app',
      updated_at: '2026-10-13T11:00:00.000Z', created_date: NOW,
    })
    assert.deepEqual(await historyVersions(store), [1, 2])
  })
  test('given column values replace the stored ones', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2), version: 2, now: NOW, title: 'T2', description: 'D2' })
    const row = await store.first('SELECT title, description, created_by FROM knowledge_graphs WHERE id = ?', [ID])
    assert.deepEqual({ ...row }, { title: 'T2', description: 'D2', created_by: 'alice@example.com' })
  })
})

describe('commit — compare-and-swap', () => {
  test('lands when the stored version matches', async () => {
    const { store } = await seeded()
    const r = await store.commit({ id: ID, data: blob(2), version: 2, casVersion: 1, now: NOW })
    assert.deepEqual(r, { ok: true })
    assert.deepEqual(await historyVersions(store), [1, 2])
  })
  test('a lost race reports a conflict and writes neither row nor history', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2, { winner: true }), version: 2, casVersion: 1, now: NOW })
    const r = await store.commit({ id: ID, data: blob(2, { winner: false }), version: 2, casVersion: 1, now: NOW })
    assert.deepEqual(r, { ok: false, conflict: true })
    assert.equal(JSON.parse((await store.getRow(ID)).data).metadata.winner, true)
    assert.deepEqual(await historyVersions(store), [1, 2])
  })
  test('without casVersion the update is unconditional', async () => {
    const { store } = await seeded()
    const r = await store.commit({ id: ID, data: blob(9), version: 9, now: NOW })
    assert.deepEqual(r, { ok: true })
    assert.equal(JSON.parse((await store.getRow(ID)).data).metadata.version, 9)
  })
})

describe('history cap', () => {
  test('the 21st version drops the oldest, leaving 20', async () => {
    const { store } = await seeded()
    for (let v = 2; v <= 21; v++) await store.commit({ id: ID, data: blob(v), version: v, now: NOW })
    const versions = await historyVersions(store)
    assert.equal(versions.length, 20)
    assert.equal(versions[0], 2)
    assert.equal(versions.at(-1), 21)
  })
})

describe('unversioned writes', () => {
  test('putData overwrites the JSON and writes no history', async () => {
    const { store } = await seeded()
    await store.putData(ID, blob(1, { touched: true }), '2026-10-13T12:00:00.000Z')
    const row = await store.getRow(ID)
    assert.equal(JSON.parse(row.data).metadata.touched, true)
    assert.equal(row.updated_at, '2026-10-13T12:00:00.000Z')
    assert.deepEqual(await historyVersions(store), [1])
  })
  test('putData without a timestamp leaves updated_at alone', async () => {
    const { store } = await seeded()
    await store.putData(ID, blob(1))
    assert.equal((await store.getRow(ID)).updated_at, NOW)
  })
  test('insertUnversioned creates a row with no history', async () => {
    const { env } = freshDb()
    const store = platformStore(env)
    await store.insertUnversioned({ id: ID, title: 'T', description: 'D', createdBy: 'a@b.no', data: blob(0), now: NOW })
    assert.equal(await store.exists(ID), true)
    assert.equal(await store.currentVersion(ID), 0)
  })
})

describe('history reads', () => {
  test('historyList is newest first inside a results envelope; historyVersion returns one body', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2), version: 2, now: NOW })
    const list = await store.historyList(ID)
    assert.deepEqual(list.results.map((r) => r.version), [2, 1])
    assert.equal(JSON.parse((await store.historyVersion(ID, 1)).data).metadata.version, 1)
    assert.equal(await store.historyVersion(ID, 7), null)
  })
})

describe('trash', () => {
  test('trashCopy keeps the body and whole history; deleteGraph removes row and history', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2), version: 2, now: NOW })
    const { trashId } = await store.trashCopy({ id: ID, data: (await store.getRow(ID)).data, deletedBy: 'alice@example.com' })
    await store.deleteGraph(ID)

    assert.equal(await store.exists(ID), false)
    assert.deepEqual(await historyVersions(store), [])
    const listed = await store.listTrash()
    assert.deepEqual(listed.map((t) => [t.id, t.graph_id, t.deleted_by]), [[trashId, ID, 'alice@example.com']])
    const entry = await store.getTrashEntry(trashId)
    assert.equal(JSON.parse(entry.graph_history).length, 2)
  })
  test('restoreFromTrash brings back the row and its history and empties the trash', async () => {
    const { store } = await seeded()
    await store.commit({ id: ID, data: blob(2), version: 2, now: NOW })
    const { trashId } = await store.trashCopy({ id: ID, data: (await store.getRow(ID)).data, deletedBy: 'alice@example.com' })
    await store.deleteGraph(ID)

    await store.restoreFromTrash(await store.getTrashEntry(trashId))

    assert.equal(JSON.parse((await store.getRow(ID)).data).metadata.version, 2)
    assert.deepEqual(await historyVersions(store), [1, 2])
    assert.deepEqual(await store.listTrash(), [])
  })
})

describe('atomic commit (the World proxy mode)', () => {
  async function atomicSeeded() {
    const { env } = freshDb()
    const store = new D1GraphStore(env.vegvisr_org, { kind: 'world', world: 'sodesign.no', atomic: true })
    await store.commit({ id: ID, create: true, data: blob(1), version: 1, now: NOW, title: 'T', description: 'D', createdBy: 'a@b.no' })
    return store
  }
  test('create and update write row and history in one batch', async () => {
    const store = await atomicSeeded()
    assert.deepEqual(await store.commit({ id: ID, data: blob(2), version: 2, casVersion: 1, now: NOW }), { ok: true })
    assert.deepEqual(await historyVersions(store), [1, 2])
    assert.equal((await store.first('SELECT title FROM knowledge_graphs WHERE id = ?', [ID])).title, 'T')
  })
  test('a lost race writes neither row nor history', async () => {
    const store = await atomicSeeded()
    await store.commit({ id: ID, data: blob(2, { winner: true }), version: 2, casVersion: 1, now: NOW })
    const r = await store.commit({ id: ID, data: blob(2, { winner: false }), version: 2, casVersion: 1, now: NOW })
    assert.deepEqual(r, { ok: false, conflict: true })
    assert.equal(JSON.parse((await store.getRow(ID)).data).metadata.winner, true)
    assert.deepEqual(await historyVersions(store), [1, 2])
  })
  test('a failing statement rolls the whole commit back', async () => {
    const store = await atomicSeeded()
    // A second create of the same id violates the primary key: nothing from that batch may remain.
    await assert.rejects(store.commit({ id: ID, create: true, data: blob(5), version: 5, now: NOW, title: 'X', createdBy: 'a@b.no' }))
    assert.deepEqual(await historyVersions(store), [1])
    assert.equal((await store.first('SELECT title FROM knowledge_graphs WHERE id = ?', [ID])).title, 'T')
  })
  test('trim keeps the newest 20 by version number, even after a gap', async () => {
    const store = await atomicSeeded()
    for (let v = 2; v <= 30; v++) await store.commit({ id: ID, data: blob(v), version: v, now: NOW })
    const versions = await historyVersions(store)
    assert.equal(versions.length, 20)
    assert.deepEqual([versions[0], versions.at(-1)], [11, 30])
  })
})
