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

/**
 * A KV stub with the surface otp.js uses: get / put (with expirationTtl) / delete.
 * TTLs are honoured against a clock the test controls, because expiry is half of what the OTP
 * rules are — a stub that ignored expirationTtl would let the expiry tests pass vacuously.
 */
export class KVLike {
  constructor(now = () => Date.now()) {
    this.map = new Map()
    this.now = now
  }
  async get(key) {
    const e = this.map.get(key)
    if (!e) return null
    if (e.expiresAt != null && this.now() > e.expiresAt) {
      this.map.delete(key)
      return null
    }
    return e.value
  }
  async put(key, value, opts = {}) {
    const ttl = opts.expirationTtl
    this.map.set(key, { value: String(value), expiresAt: ttl ? this.now() + ttl * 1000 : null })
  }
  async delete(key) {
    this.map.delete(key)
  }
}

/** Records what was "sent" instead of calling a real SMS gateway. */
export class FakeSmsGateway {
  constructor({ ok = true } = {}) {
    this.sent = []
    this.ok = ok
  }
  async fetch(url, init) {
    const body = JSON.parse(init.body)
    this.sent.push(body)
    return new Response(JSON.stringify({ success: this.ok }), { status: this.ok ? 200 : 502 })
  }
  /** The 6-digit code out of the last message — the test's only way to learn it. */
  lastCode() {
    const m = /(\d{6})/.exec(this.sent.at(-1)?.message || '')
    return m ? m[1] : null
  }
}

/** Adds the config rows the OAuth OTP flow reads. */
export function seedUsers(raw) {
  raw.exec(`CREATE TABLE IF NOT EXISTS config (
    user_id TEXT, data TEXT NOT NULL DEFAULT '{}', email TEXT PRIMARY KEY,
    emailVerificationToken TEXT, Role TEXT, phone TEXT,
    phone_verification_code TEXT, phone_verification_expires_at INTEGER, phone_verified_at INTEGER
  )`)
  const ins = raw.prepare(
    "INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone) VALUES (?,'{}',?,?,?,?)",
  )
  ins.run('u-alice', 'alice@example.com', 'sess-alice', 'User', '+4790000001')
  ins.run('u-bob', 'bob@example.com', 'sess-bob', 'User', '+4790000002')
  ins.run('u-nophone', 'nophone@example.com', 'sess-nophone', 'User', null)
}

/** The chat tables post_chat_message touches, with the real production shapes. */
export function seedChat(raw, { groupId = 'g1', memberId = 'alice@example.com' } = {}) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT, updated_at INTEGER);
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
      joined_at INTEGER NOT NULL, alerts_enabled INTEGER DEFAULT 0,
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS group_bot_members (
      group_id TEXT NOT NULL, bot_id TEXT NOT NULL, added_by TEXT NOT NULL,
      added_at INTEGER NOT NULL, PRIMARY KEY (group_id, bot_id)
    );
    CREATE TABLE IF NOT EXISTS chat_bots (
      id TEXT PRIMARY KEY, name TEXT, username TEXT, avatar_url TEXT, is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, group_id TEXT NOT NULL, user_id TEXT NOT NULL,
      body TEXT NOT NULL, created_at INTEGER NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text', sender_avatar_url TEXT, sender_name TEXT
    );
  `)
  raw.prepare('INSERT OR REPLACE INTO groups (id, name, updated_at) VALUES (?,?,?)').run(groupId, 'Test Group', 0)
  raw.prepare('INSERT OR REPLACE INTO group_members (group_id, user_id, joined_at) VALUES (?,?,0)').run(groupId, memberId)
  raw.prepare('INSERT OR REPLACE INTO chat_bots (id, name, username, is_active) VALUES (?,?,?,1)').run('bot-1', 'ChatGPT', 'chatgpt')
  raw.prepare('INSERT OR REPLACE INTO group_bot_members (group_id, bot_id, added_by, added_at) VALUES (?,?,?,0)').run(groupId, 'bot-1', 'someone')
}

/** Captures what would have been posted instead of calling group-chat-worker. */
export class FakeChatWorker {
  constructor({ ok = true } = {}) {
    this.posted = []
    this.ok = ok
  }
  async fetch(url, init) {
    const body = JSON.parse(init.body)
    this.posted.push(body)
    return new Response(JSON.stringify(this.ok ? { message: { id: 42 } } : { error: 'refused' }), {
      status: this.ok ? 200 : 403,
    })
  }
}
