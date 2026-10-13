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

export class PlatformStore {
  constructor(db) {
    this.db = db
    this.kind = 'platform'
    this.world = null
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
  async commit({ id, create = false, data, version, casVersion = null, now, title = null, description = null, createdBy = null, userId = null, sourceApp = null }) {
    if (create) {
      await this.db
        .prepare(
          `INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at, user_id, source_app)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(id, title, description, createdBy, data, now, now, userId, sourceApp)
        .run()
    } else {
      const cas = Number.isInteger(casVersion)
      const sql = `UPDATE knowledge_graphs
         SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), created_by = COALESCE(?, created_by), updated_at = ?,
             user_id = COALESCE(?, user_id), source_app = COALESCE(?, source_app)
         WHERE id = ?${cas ? `
           AND COALESCE(CAST(json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.version') AS INTEGER), 0) = ?` : ''}`
      const args = [data, title, description, createdBy, now, userId, sourceApp, id]
      if (cas) args.push(casVersion)
      const result = await this.db.prepare(sql).bind(...args).run()
      // Zero rows changed means another request won the race between the caller's read and this write.
      if (cas && !result.meta?.changes) return { ok: false, conflict: true }
    }

    await this.db
      .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data, user_id, source_app) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), id, version, data, userId, sourceApp)
      .run()

    await this.#trimHistory(id)
    return { ok: true }
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

/** The platform's own store. Listings and searches that span every graph start here. */
export function platformStore(env) {
  return new PlatformStore(env.vegvisr_org)
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
