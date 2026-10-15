/**
 * graph-store.js — WHERE a graph's rows live.
 *
 * Until 2026-10-13 every graph lived in the platform D1 (`env.vegvisr_org`) and every function in
 * graph-service.js said so by name, 25 times. A World Founder's graphs are to live in a D1 inside
 * the founder's OWN Cloudflare account, so "which database" has to become a value that is resolved
 * per graph instead of a binding that is spelled out per statement. This file is that seam.
 *
 * A store answers a small set of graph-level questions. It is deliberately NOT "a D1": a World
 * store sits behind an HTTPS hop into another account, where six sequential statements per save
 * would be six round trips and a half-finished save would be a realistic outcome. So the write is
 * ONE call, `commit()`, and each store implements it as well as it can.
 *
 *   getRow(id)            the knowledge_graphs row, or null
 *   exists(id)            cheap existence test (no JSON blob over the wire)
 *   currentVersion(id)    MAX(version) in history — the authoritative version for save/add/metadata
 *   commit({...})         row write + history row + history trim
 *   first(sql, params)    read-only query, first row
 *   all(sql, params)      read-only query, all rows (array)
 *
 * Two implementations: D1GraphStore over a D1 binding (the platform, and — inside the World's
 * graph proxy — the World's own database), and WorldStore, which reaches a World's proxy over
 * signed HTTPS. resolveGraphStore() picks one per graph from graph_locations. The platform SQL is
 * the SQL graph-service.js ran before, statement for statement — see the note on commit() for the
 * one place four variants became one.
 */

import { signWorldGraphToken } from './world-graph-token.js'

const HISTORY_CAP = 20
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const VERSION_SQL = `COALESCE(CAST(json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.version') AS INTEGER), 0)`

/**
 * The store methods a World graph proxy exposes over RPC. Anything not listed is unreachable from
 * outside the proxy. `first` and `all` are listed here but the proxy refuses them for anything
 * that is not a read.
 */
export const STORE_RPC_OPS = Object.freeze([
  'getRow', 'exists', 'currentVersion', 'first', 'all', 'commit',
  'insertUnversioned', 'putData', 'getAiInstructions', 'setAiInstructions',
  'historyList', 'historyVersion',
  'trashCopy', 'deleteGraph', 'purgeTrash', 'listTrash', 'getTrashEntry', 'restoreFromTrash',
])

/**
 * A graph store over one D1 database holding the three graph tables. The platform's store is one;
 * a World's graph proxy runs the same class over the D1 in the founder's own account, so the SQL
 * for both lives here and only here.
 *
 *   kind     'platform' | 'world'
 *   world    the World's domain, or null
 *   atomic   commit() as one db.batch (a transaction) instead of statements in sequence. The World
 *            proxy sets it. The platform does not yet, because its commit has always been
 *            sequential and changing that is a separate decision from moving where graphs live.
 */
export class D1GraphStore {
  constructor(db, { kind = 'platform', world = null, atomic = false } = {}) {
    this.db = db
    this.kind = kind
    this.world = world
    this.atomic = atomic
  }

  async getRow(id) {
    return this.db
      .prepare('SELECT id, data, created_by, user_id, created_date, updated_at FROM knowledge_graphs WHERE id = ?')
      .bind(id)
      .first()
  }

  async exists(id) {
    const row = await this.db.prepare('SELECT id FROM knowledge_graphs WHERE id = ?').bind(id).first()
    return Boolean(row)
  }

  async currentVersion(id) {
    const row = await this.db
      .prepare('SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?')
      .bind(id)
      .first()
    return row?.version || 0
  }

  async first(sql, params = []) {
    return this.db.prepare(sql).bind(...params).first()
  }

  async all(sql, params = []) {
    const rows = await this.db.prepare(sql).bind(...params).all()
    return rows.results || []
  }

  /**
   * Write one new version of a graph: the row, its history snapshot, and the history trim.
   *
   *   create       true = INSERT a new row, false = UPDATE the existing one
   *   data         the full graph JSON, already stringified
   *   version      the version number this write produces (goes into the history row)
   *   casVersion   when an integer, the UPDATE only lands if the stored JSON still carries this
   *                version. Zero rows changed returns { ok: false, conflict: true } and writes
   *                NO history — the caller reports VERSION_CONFLICT.
   *   title, description, createdBy, userId, sourceApp
   *                column values. On UPDATE each is COALESCE(?, column): null leaves the column
   *                alone. That is what lets one statement stand in for the four that existed —
   *                saveGraph set all five, updateMetadata set two, addNode and updateNode set
   *                none, and passing null for "not mine to set" is the same write.
   *
   * The three statements run in sequence, not in a batch, because that is what ran before and
   * this file's first job is to change nothing. A store that is one network hop away must do
   * them atomically; this one inherits the platform's existing behaviour.
   */
  async commit(input) {
    if (this.atomic) return this.#commitAtomic(input)
    const { id, create = false, data, version, casVersion = null, userId = null, sourceApp = null } = input
    const result = await this.#rowStatement(input).run()
    // Zero rows changed means another request won the race between the caller's read and this write.
    if (!create && Number.isInteger(casVersion) && !result.meta?.changes) return { ok: false, conflict: true }

    await this.db
      .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data, user_id, source_app) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, version, data, userId, sourceApp)
      .run()

    await this.#trimHistory(id)
    return { ok: true }
  }

  /** The INSERT (create) or UPDATE (with optional compare-and-swap) of the graph row. */
  #rowStatement({ id, create = false, data, casVersion = null, now, title = null, description = null, createdBy = null, userId = null, sourceApp = null }) {
    if (create) {
      return this.db
        .prepare(
          `INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at, user_id, source_app)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, title, description, createdBy, data, now, now, userId, sourceApp)
    }
    const cas = Number.isInteger(casVersion)
    const sql = `UPDATE knowledge_graphs
         SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), created_by = COALESCE(?, created_by), updated_at = ?,
             user_id = COALESCE(?, user_id), source_app = COALESCE(?, source_app)
         WHERE id = ?${cas ? `
           AND ${VERSION_SQL} = ?` : ''}`
    const args = [data, title, description, createdBy, now, userId, sourceApp, id]
    if (cas) args.push(casVersion)
    return this.db.prepare(sql).bind(...args)
  }

  /**
   * One transaction: row, history row, trim. The history row is inserted only if the row
   * statement just before it changed a row (`changes()`), so a compare-and-swap that lost its race
   * writes nothing at all, inside the same batch, with no second round trip to find out. Checking
   * the row's version instead is wrong: the winner already moved it to the same number, and the
   * loser then wrote a duplicate history row (caught by the test, 2026-10-15). The trim keeps the newest HISTORY_CAP
   * versions by number, which also catches up after a restore inserted many rows at once.
   */
  async #commitAtomic(input) {
    const { id, create = false, data, version, casVersion = null, userId = null, sourceApp = null } = input
    const results = await this.db.batch([
      this.#rowStatement(input),
      this.db
        .prepare(
          `INSERT INTO knowledge_graph_history (id, graph_id, version, data, user_id, source_app)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE changes() > 0`,
        )
        .bind(crypto.randomUUID(), id, version, data, userId, sourceApp),
      this.db
        .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version <= ?')
        .bind(id, version - HISTORY_CAP),
    ])
    if (!create && Number.isInteger(casVersion) && !results[0]?.meta?.changes) return { ok: false, conflict: true }
    return { ok: true }
  }

  // ── Unversioned writes ────────────────────────────────────────────────────────────────────
  // Older endpoints overwrite a graph without bumping its version or writing history
  // (/saveknowgraph, /updateknowgraph, the classifier, work notes). They are kept as they are —
  // changing them is a product decision, not a refactor — but they go through the store so a
  // graph that lives elsewhere is overwritten where it lives.

  /** INSERT a row with no history entry. */
  async insertUnversioned({ id, title = null, description = null, createdBy = null, data, now }) {
    await this.db
      .prepare('INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, description, createdBy, data, now, now)
      .run()
  }

  /** Overwrite the JSON with no history entry. `now` null leaves updated_at untouched. */
  async putData(id, data, now = null) {
    if (now) {
      await this.db.prepare('UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?').bind(data, now, id).run()
    } else {
      await this.db.prepare('UPDATE knowledge_graphs SET data = ? WHERE id = ?').bind(data, id).run()
    }
  }

  async getAiInstructions(id) {
    const row = await this.db.prepare('SELECT ai_instructions FROM knowledge_graphs WHERE id = ?').bind(id).first()
    return row?.ai_instructions || ''
  }

  async setAiInstructions(id, instructions, now) {
    await this.db
      .prepare('UPDATE knowledge_graphs SET ai_instructions = ?, updated_at = ? WHERE id = ?')
      .bind(instructions, now, id)
      .run()
  }

  // ── History reads ─────────────────────────────────────────────────────────────────────────

  /**
   * Versions and timestamps, newest first. Returns the D1 result object ({ results, ... }), not
   * a bare array: GET /getknowgraphhistory has always put that whole object on the wire as
   * `history`, and clients read `history.results`.
   */
  async historyList(id) {
    return this.db
      .prepare(`
            SELECT version, timestamp
            FROM knowledge_graph_history
            WHERE graph_id = ?
            ORDER BY version DESC
          `)
      .bind(id)
      .all()
  }

  /** The history row for one version ({ data }), or null. */
  async historyVersion(id, version) {
    return this.db
      .prepare('SELECT data FROM knowledge_graph_history WHERE graph_id = ? AND version = ?')
      .bind(id, version)
      .first()
  }

  // ── Trash ─────────────────────────────────────────────────────────────────────────────────
  // A deleted graph is copied to graph_trash with its whole history and kept for 30 days. The
  // trash lives in the same store as the graph it came from.

  /** Copy a graph and its history into the trash, then purge expired entries. */
  async trashCopy({ id, data, deletedBy }) {
    const historyRows = await this.db
      .prepare('SELECT * FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version ASC')
      .bind(id)
      .all()
    const historyJson = JSON.stringify(historyRows.results || [])

    let title = id
    try {
      const gd = JSON.parse(data)
      title = gd.metadata?.title || gd.title || id
    } catch {}

    const trashId = `trash_${id}_${Date.now()}`
    const expiresAt = new Date(Date.now() + TRASH_RETENTION_MS).toISOString()
    await this.db
      .prepare(
        `INSERT INTO graph_trash (id, graph_id, title, graph_data, graph_history, deleted_by, deleted_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      )
      .bind(trashId, id, title, data, historyJson, deletedBy, expiresAt)
      .run()
    await this.purgeTrash()
    return { trashId, expiresAt }
  }

  /** Remove a graph's history and then its row. Does not touch the trash. */
  async deleteGraph(id) {
    await this.db.prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ?').bind(id).run()
    await this.db.prepare('DELETE FROM knowledge_graphs WHERE id = ?').bind(id).run()
  }

  async purgeTrash() {
    await this.db.prepare(`DELETE FROM graph_trash WHERE expires_at < datetime('now')`).run()
  }

  /** Unexpired trash entries, newest first, without the graph bodies. */
  async listTrash() {
    await this.purgeTrash()
    const rows = await this.db
      .prepare('SELECT id, graph_id, title, deleted_by, deleted_at, expires_at FROM graph_trash ORDER BY deleted_at DESC')
      .all()
    return rows.results || []
  }

  /** One unexpired trash entry with its bodies, or null. */
  async getTrashEntry(trashId) {
    return this.db
      .prepare(`SELECT * FROM graph_trash WHERE id = ? AND expires_at > datetime('now')`)
      .bind(trashId)
      .first()
  }

  /**
   * Put a trashed graph and its history back, and drop the trash entry.
   *
   * The columns are rebuilt from the graph's own JSON. Until 2026-10-13 this was
   * `INSERT OR REPLACE ... (id, data)`, which names neither `title` nor `created_by` — both
   * NOT NULL — so every restore failed with a constraint error and nothing could leave the trash.
   * The trash keeps the JSON and the history, not the row, so the row's columns have to come
   * from the metadata, the same way saveGraph fills them for a new graph. created_date is the
   * first history entry's timestamp when there is one: the original is not kept anywhere.
   */
  async restoreFromTrash(entry, now = new Date().toISOString()) {
    const history = entry.graph_history ? JSON.parse(entry.graph_history) : []
    let meta = {}
    try {
      meta = JSON.parse(entry.graph_data)?.metadata || {}
    } catch { /* an unparseable graph is restored with empty columns */ }

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at, user_id, source_app)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.graph_id,
        meta.title || entry.title || '',
        meta.description || '',
        meta.createdBy || '',
        entry.graph_data,
        history[0]?.timestamp || now,
        now,
        meta.userId || null,
        meta.createdBy || null,
      )
      .run()
    for (const h of history) {
      await this.db
        .prepare(
          'INSERT OR IGNORE INTO knowledge_graph_history (id, graph_id, version, timestamp, data, user_id, source_app) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(h.id, h.graph_id, h.version, h.timestamp, h.data, h.user_id || null, h.source_app || null)
        .run()
    }
    await this.db.prepare('DELETE FROM graph_trash WHERE id = ?').bind(entry.id).run()
  }

  /** History is capped at 20 versions per graph — drop the oldest once over. */
  async #trimHistory(id) {
    const countResult = await this.db
      .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
      .bind(id)
      .first()
    if (countResult?.count > HISTORY_CAP) {
      await this.db
        .prepare(
          'DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)',
        )
        .bind(id, id)
        .run()
    }
  }
}

/** The name graph-service and the tests have always used for the platform's store. */
export const PlatformStore = D1GraphStore

/** The platform's own store. Listings and searches that span every graph start here. */
export function platformStore(env) {
  return new D1GraphStore(env.vegvisr_org)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// World stores — graphs that live in a World Founder's own Cloudflare account (G3, 2026-10-15)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** A routing failure with a code graph-service maps to its own error vocabulary. */
export class GraphStoreError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

/**
 * The same methods as D1GraphStore, each one a signed RPC to the World's graph proxy, which runs
 * D1GraphStore over the World's own database. Errors are thrown, never returned as data: a write
 * that may or may not have landed must stop the caller, not be reported as a result.
 */
export class WorldStore {
  constructor(env, row) {
    this.env = env
    this.kind = 'world'
    this.world = row.domain
    this.endpoint = row.endpoint_base
  }

  async rpc(op, args) {
    if (!this.env.WORLD_GRAPH_SIGNING_KEY) {
      throw new GraphStoreError('STORE_UNAVAILABLE', `This worker cannot sign requests to the graph store of ${this.world}.`)
    }
    const body = JSON.stringify({ op, args })
    const token = await signWorldGraphToken(this.env.WORLD_GRAPH_SIGNING_KEY, { aud: this.world, op, body })
    let res, out
    try {
      res = await fetch(`${this.endpoint}/__graphs/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
      })
      out = await res.json()
    } catch (e) {
      throw new GraphStoreError('STORE_UNAVAILABLE', `The graph store of ${this.world} did not answer (${e.message}). Nothing was stored anywhere else.`)
    }
    if (!res.ok || !out?.ok) {
      throw new GraphStoreError('STORE_UNAVAILABLE', `The graph store of ${this.world} refused ${op}: ${out?.error || `HTTP ${res.status}`}. Nothing was stored anywhere else.`)
    }
    return out.result
  }
}
for (const op of STORE_RPC_OPS) {
  WorldStore.prototype[op] = function (...args) {
    return this.rpc(op, args)
  }
}

// Reads that treat a table that does not exist yet as "no row": before the first World store is
// provisioned, graph_locations and world_graph_stores simply are not there, and every graph is
// the platform's. Any OTHER failure is an error — rule 2 of the plan: a registry that cannot be
// read must never be taken to mean "platform", or a World graph would be written to the platform.
async function registryRead(env, sql, params) {
  try {
    return await env.vegvisr_org.prepare(sql).bind(...params).first()
  } catch (e) {
    if (/no such table/i.test(e.message)) return null
    throw new GraphStoreError('STORE_UNAVAILABLE', `The graph registry could not be read: ${e.message}`)
  }
}

const LIVE_STORE_STATES = new Set(['provisioned', 'active'])

async function worldStoreRow(env, domain) {
  const row = await registryRead(env, 'SELECT * FROM world_graph_stores WHERE domain = ?', [String(domain).toLowerCase()])
  if (!row) return null
  if (!LIVE_STORE_STATES.has(row.status)) {
    throw new GraphStoreError('STORE_UNAVAILABLE', `The graph store of ${row.domain} is ${row.status}.`)
  }
  return row
}

/**
 * Who may reach a World's graphs: a Superadmin, or the World's founder or account holder. An
 * actor with no identity — a trusted origin, a service binding that names no user — never may.
 */
export async function mayUseWorld(env, actor, domain) {
  if (!actor || actor.anonymous || (!actor.email && !actor.isSuperadmin)) return false
  if (actor.isSuperadmin) return true
  const row = await registryRead(
    env,
    'SELECT 1 AS ok FROM world_founders WHERE domain = ? AND (LOWER(founder_email) = ? OR LOWER(COALESCE(account_holder_email, \'\')) = ?) LIMIT 1',
    [String(domain).toLowerCase(), actor.email, actor.email],
  )
  return Boolean(row)
}

async function authorizedWorldStore(env, row, actor, graphId) {
  if (!(await mayUseWorld(env, actor, row.domain))) {
    throw new GraphStoreError(
      'FORBIDDEN_GRAPH',
      graphId
        ? `Graph ${graphId} is stored in the World ${row.domain}, and this request is not signed in as that World's founder.`
        : `Only the founder of ${row.domain} or a Superadmin may store graphs there.`,
    )
  }
  return new WorldStore(env, row)
}

/**
 * The store that holds — or, for a graph about to be created, will hold — a graph.
 *
 *   graphId   route by where the graph lives (graph_locations); no row means the platform
 *   world     a NEW graph is to be created in this World's store (an explicit choice)
 *   actor     who is asking. Required to reach a World store at all; ignored for the platform,
 *             whose own access rules are unchanged. Omitting it is the same as being anonymous.
 *
 * Throws GraphStoreError: FORBIDDEN_GRAPH when the actor may not use that World, INVALID_INPUT
 * for a World with no graph store, STORE_UNAVAILABLE when the registry cannot be read.
 */
export async function resolveGraphStore(env, { graphId = null, world = null, actor = null } = {}) {
  if (world) {
    const row = await worldStoreRow(env, world)
    if (!row) throw new GraphStoreError('INVALID_INPUT', `${world} has no graph store. Provision it with provision_world_graphs first.`)
    return authorizedWorldStore(env, row, actor, null)
  }
  if (graphId) {
    const loc = await registryRead(env, 'SELECT world_domain, status FROM graph_locations WHERE graph_id = ?', [graphId])
    if (loc && loc.status !== 'moved_out') {
      const row = await worldStoreRow(env, loc.world_domain)
      if (!row) throw new GraphStoreError('STORE_UNAVAILABLE', `Graph ${graphId} is located in ${loc.world_domain}, which has no graph store registered.`)
      return authorizedWorldStore(env, row, actor, graphId)
    }
  }
  return platformStore(env)
}

// ── The locator: which World holds a graph. Ids only — no title, owner or content (decided 2026-10-13).

const LOCATOR_DDL = `CREATE TABLE IF NOT EXISTS graph_locations (
  graph_id TEXT PRIMARY KEY,
  world_domain TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

/**
 * Claim an id for a World BEFORE its row is written there. A graph whose World commit succeeds
 * but whose locator write fails would be unreachable; a pending locator with no graph behind it
 * is merely a dangling id, and dropLocation() clears it when the commit fails.
 */
export async function reserveLocation(env, graphId, domain, now = new Date().toISOString()) {
  await env.vegvisr_org.prepare(LOCATOR_DDL).run()
  await env.vegvisr_org
    .prepare("INSERT INTO graph_locations (graph_id, world_domain, status, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?)")
    .bind(graphId, domain, now, now)
    .run()
}

export async function activateLocation(env, graphId, now = new Date().toISOString()) {
  await env.vegvisr_org.prepare("UPDATE graph_locations SET status = 'active', updated_at = ? WHERE graph_id = ?").bind(now, graphId).run()
}

export async function dropPendingLocation(env, graphId) {
  await env.vegvisr_org.prepare("DELETE FROM graph_locations WHERE graph_id = ? AND status = 'pending'").bind(graphId).run()
}

export async function setLocationStatus(env, graphId, status, now = new Date().toISOString()) {
  await env.vegvisr_org.prepare('UPDATE graph_locations SET status = ?, updated_at = ? WHERE graph_id = ?').bind(status, now, graphId).run()
}

/**
 * Every World store this actor may use — for listings, searches and the trash, which have no
 * graph id to route by and so must ask each store the actor can see. A Superadmin sees every live
 * store; a founder or account holder sees their own World's; anyone else, none.
 */
export async function worldStoresFor(env, actor) {
  if (!actor || actor.anonymous || (!actor.email && !actor.isSuperadmin)) return []
  let rows
  try {
    const sql = actor.isSuperadmin
      ? "SELECT * FROM world_graph_stores WHERE status IN ('provisioned', 'active') ORDER BY domain"
      : `SELECT DISTINCT s.* FROM world_graph_stores s JOIN world_founders f ON f.domain = s.domain
         WHERE s.status IN ('provisioned', 'active')
           AND (LOWER(f.founder_email) = ? OR LOWER(COALESCE(f.account_holder_email, '')) = ?)
         ORDER BY s.domain`
    const stmt = env.vegvisr_org.prepare(sql)
    rows = (await (actor.isSuperadmin ? stmt : stmt.bind(actor.email, actor.email)).all()).results || []
  } catch (e) {
    if (/no such table/i.test(e.message)) return []
    throw new GraphStoreError('STORE_UNAVAILABLE', `The graph registry could not be read: ${e.message}`)
  }
  return rows.map((row) => new WorldStore(env, row))
}

/** The graph id inside a trash id ("trash_<graphId>_<epoch ms>"), or null. */
export function graphIdOfTrashId(trashId) {
  const m = /^trash_(.+)_(\d+)$/.exec(String(trashId || ''))
  return m ? m[1] : null
}

/**
 * World stores whose content tag matches `metaArea` — for PUBLISHED-ONLY public listings, such as
 * a member page's portfolio (getknowgraphsummaries?metaArea=#STINE, no credentials). No access
 * rule is applied here, so a caller must restrict every query it runs on these stores to
 * published graphs. Returns [] when nothing matches or the registry does not exist yet.
 */
export async function publicWorldStoresByTag(env, metaArea) {
  const tag = String(metaArea || '').trim().replace(/^#/, '').toUpperCase()
  if (!tag) return []
  try {
    const rows = await env.vegvisr_org
      .prepare(
        `SELECT DISTINCT s.* FROM world_graph_stores s JOIN world_founders f ON f.domain = s.domain
         WHERE s.status IN ('provisioned', 'active') AND UPPER(REPLACE(COALESCE(f.meta_area_tag, ''), '#', '')) = ?`,
      )
      .bind(tag)
      .all()
    return (rows.results || []).map((row) => new WorldStore(env, row))
  } catch (e) {
    if (/no such table/i.test(e.message)) return []
    throw new GraphStoreError('STORE_UNAVAILABLE', `The graph registry could not be read: ${e.message}`)
  }
}
