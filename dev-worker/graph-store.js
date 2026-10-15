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
 * Today there is exactly one implementation and resolveGraphStore() always returns it, so this
 * file changes no behaviour. The SQL below is the SQL graph-service.js ran before, statement for
 * statement — see the note on commit() for the one place four variants became one.
 */

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

/**
 * The store that holds — or, for a graph about to be created, will hold — `graphId`.
 *
 * Always the platform today. It is async and takes the graph id because the answer is about to
 * depend on a lookup; callers written against this signature will not need touching when it does.
 */
export async function resolveGraphStore(env, { graphId = null } = {}) {
  return platformStore(env)
}
