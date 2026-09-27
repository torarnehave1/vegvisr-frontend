/**
 * A D1-compatible adapter over node:sqlite, so graph-service.js can be exercised against a
 * REAL SQL engine with the REAL vegvisr_org schema instead of a hand-written mock whose
 * behaviour I would be choosing myself. Mocks confirm the test author's assumptions;
 * a real engine confirms the SQL.
 *
 * Implements only the surface graph-service uses: prepare().bind().first()/run()/all().
 */
import { DatabaseSync } from 'node:sqlite'

class Stmt {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.args = []
  }
  bind(...args) {
    this.args = args.map((a) => (a === undefined ? null : a))
    return this
  }
  #prep() {
    return this.db.prepare(this.sql)
  }
  async first() {
    const row = this.#prep().get(...this.args)
    return row === undefined ? null : row
  }
  async run() {
    const r = this.#prep().run(...this.args)
    return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } }
  }
  async all() {
    return { results: this.#prep().all(...this.args), success: true }
  }
}

export class D1Like {
  constructor(db) {
    this.db = db
  }
  prepare(sql) {
    return new Stmt(this.db, sql)
  }
}

/** The REAL production schema, read from sqlite_master on the live vegvisr_org D1
 * (2026-09-27) — NOT database/knowledge_graphs.sql, which is missing updated_at and
 * every generated column and would have made these tests pass against a fiction. */
export function freshDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE knowledge_graphs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      parent_graph_id TEXT,
      data TEXT,
      updated_at DATETIME,
      user_id TEXT,
      source_app TEXT,
      meta_area TEXT GENERATED ALWAYS AS (CASE WHEN json_valid(data) THEN json_extract(data,'$.metadata.metaArea') END) VIRTUAL,
      meta_category TEXT GENERATED ALWAYS AS (CASE WHEN json_valid(data) THEN json_extract(data,'$.metadata.category') END) VIRTUAL,
      publication_state TEXT GENERATED ALWAYS AS (CASE WHEN json_valid(data) THEN json_extract(data,'$.metadata.publicationState') END) VIRTUAL,
      seo_slug TEXT GENERATED ALWAYS AS (CASE WHEN json_valid(data) THEN json_extract(data,'$.metadata.seoSlug') END) VIRTUAL,
      creator_email TEXT GENERATED ALWAYS AS (CASE WHEN json_valid(data) THEN json_extract(data,'$.metadata.createdBy') END) VIRTUAL,
      FOREIGN KEY (parent_graph_id) REFERENCES knowledge_graphs (id)
    );
    CREATE TABLE knowledge_graph_history (
      id TEXT PRIMARY KEY,
      graph_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL,
      user_id TEXT,
      source_app TEXT,
      FOREIGN KEY (graph_id) REFERENCES knowledge_graphs (id)
    );
  `)
  return { env: { vegvisr_org: new D1Like(db) }, raw: db }
}
