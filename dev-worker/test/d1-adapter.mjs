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
    phone_verification_code TEXT, phone_verification_expires_at INTEGER, phone_verified_at INTEGER,
    display_name TEXT, group_tags TEXT
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

/** Put messages in a group. `sender` is a user_id, or 'bot:<id>' with a name. */
export function seedMessages(raw, rows, groupId = 'g1') {
  const ins = raw.prepare(
    'INSERT INTO group_messages (group_id, user_id, body, created_at, message_type, sender_name) VALUES (?,?,?,?,?,?)',
  )
  for (const m of rows) {
    ins.run(groupId, m.sender, m.text, m.at ?? Date.now(), m.type || 'text', m.senderName ?? null)
  }
}

/** config rows in the identity database, which is where human display names come from. */
export function seedProfiles(raw, people) {
  raw.exec(`CREATE TABLE IF NOT EXISTS config (
    user_id TEXT, data TEXT NOT NULL DEFAULT '{}', email TEXT PRIMARY KEY,
    display_name TEXT, Role TEXT
  )`)
  const ins = raw.prepare("INSERT OR REPLACE INTO config (user_id, data, email, display_name) VALUES (?,'{}',?,?)")
  for (const p of people) ins.run(p.userId, p.email, p.displayName ?? null)
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


/** The graphTemplates rows the fulltext-element catalog is read from. */
export function seedTemplates(raw, rows) {
  raw.exec(`CREATE TABLE IF NOT EXISTS graphTemplates (
    id TEXT PRIMARY KEY, name TEXT, nodes TEXT, edges TEXT, ai_instructions TEXT,
    category TEXT, thumbnail_path TEXT, standard_question TEXT,
    gemini INTEGER DEFAULT 0, tool INTEGER DEFAULT 0, plugin INTEGER DEFAULT 0
  )`)
  const ins = raw.prepare(
    'INSERT OR REPLACE INTO graphTemplates (id,name,nodes,edges,ai_instructions,category,plugin) VALUES (?,?,?,?,?,?,?)',
  )
  for (const r of rows) {
    ins.run(
      r.id, r.name, r.nodes ?? '[]', r.edges ?? '[]',
      r.ai === undefined ? null : (typeof r.ai === 'string' ? r.ai : JSON.stringify(r.ai)),
      r.category ?? 'Fulltext Elements', r.plugin ?? 1,
    )
  }
}

/**
 * Workers AI, faked. `run` returns the same thing the real binding does as far as this code is
 * concerned: something `new Response(...)` can turn into bytes. The default body starts FF D8,
 * because images-service checks the JPEG magic and a fake without it would make the
 * happy-path tests fail for the wrong reason.
 */
export class FakeAI {
  constructor({ bytes = null, throws = null, envelope = 'stream' } = {}) {
    this.calls = []
    this.throws = throws
    this.envelope = envelope
    // 12 bytes minimum: the sniffer needs enough to rule out WebP's RIFF....WEBP.
    this.bytes = bytes ?? new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8])
  }
  async run(model, input) {
    this.calls.push({ model, input })
    if (this.throws) throw new Error(this.throws)
    // The Leonardo models answer { image: "<base64>" } rather than streaming bytes.
    if (this.envelope === 'base64') {
      return { image: btoa(String.fromCharCode(...this.bytes)) }
    }
    return this.bytes
  }
}

/**
 * photos-worker, faked. Records the X-API-Token it was sent and the form fields, so a test can
 * assert that the upload ran as the user rather than unauthenticated — which is exactly the bug
 * in Agent-Builder's generate_image.
 */
export class FakePhotosWorker {
  constructor({ status = 200, url = 'https://vegvisr.imgix.net/mcp-1.jpg', error = null } = {}) {
    this.uploads = []
    this.status = status
    this.url = url
    this.error = error
  }
  async fetch(url, init) {
    const form = await new Response(init.body, { headers: init.headers }).formData()
    const file = form.get('file')
    this.uploads.push({
      url,
      token: new Headers(init.headers).get('X-API-Token'),
      filename: form.get('filename'),
      album: form.get('album'),
      fileName: file?.name ?? null,
      size: file?.size ?? 0,
    })
    if (this.status !== 200) {
      return new Response(JSON.stringify({ error: this.error || 'refused' }), { status: this.status })
    }
    return new Response(JSON.stringify({ urls: [this.url], keys: ['mcp-1.jpg'] }), { status: 200 })
  }
}

/**
 * HTML_PAGES, faked with the one method the publish registry uses: list({prefix, cursor}).
 * Keys carry metadata, because the metadata IS the registry — a key without a graphId is
 * exactly the case the reader has to skip, so the stub can hold those too.
 */
export class PagesKVLike {
  constructor(entries = [], { pageSize = 1000, throws = false } = {}) {
    this.entries = entries.map((e) =>
      typeof e === 'string' ? { name: e } : { name: e.name, metadata: e.metadata },
    )
    this.pageSize = pageSize
    this.throws = throws
    this.listCalls = 0
  }
  async list({ prefix = '', cursor } = {}) {
    this.listCalls += 1
    if (this.throws) throw new Error('KV unavailable')
    const all = this.entries.filter((e) => e.name.startsWith(prefix))
    const start = cursor ? Number(cursor) : 0
    const keys = all.slice(start, start + this.pageSize)
    const next = start + keys.length
    return next >= all.length
      ? { keys, list_complete: true }
      : { keys, list_complete: false, cursor: String(next) }
  }
}

/** agent-worker, faked. Records what the publish request carried. */
export class FakeAgentWorker {
  constructor({ ok = true, verified = true, error = null, status = 200 } = {}) {
    this.calls = []
    this.ok = ok
    this.verified = verified
    this.error = error
    this.status = status
  }
  async fetch(url, init) {
    const body = JSON.parse(init.body)
    this.calls.push({ url, token: new Headers(init.headers).get('X-API-Token'), body })
    if (!this.ok) {
      return new Response(JSON.stringify({ success: false, error: this.error || 'refused' }), { status: this.status })
    }
    return new Response(JSON.stringify({ success: true, verified: this.verified, message: 'published' }), { status: 200 })
  }
}

/** agent-worker's /admin/set-user-role, faked. */
export class FakeRoleWorker {
  constructor({ ok = true, changed = true, previousRole = 'Realtime', error = null, status = 200 } = {}) {
    this.calls = []
    this.ok = ok; this.changed = changed; this.previousRole = previousRole; this.error = error; this.status = status
  }
  async fetch(url, init) {
    const body = JSON.parse(init.body)
    this.calls.push({ url, token: new Headers(init.headers).get('X-API-Token'), body })
    if (!this.ok) return new Response(JSON.stringify({ success: false, error: this.error }), { status: this.status })
    return new Response(JSON.stringify({
      success: true, email: body.email, role: body.role,
      previousRole: this.previousRole, changed: this.changed,
    }), { status: 200 })
  }
}

/** agent-worker's /admin/register-user, faked. Records what the MCP layer forwarded. */
export class FakeRegisterWorker {
  constructor({ ok = true, updated = false, error = null, status = 200, role = 'Admin' } = {}) {
    this.calls = []
    this.ok = ok; this.updated = updated; this.error = error; this.status = status; this.role = role
  }
  async fetch(url, init) {
    const body = JSON.parse(init.body)
    this.calls.push({ url, token: new Headers(init.headers).get('X-API-Token'), body })
    if (!this.ok) return new Response(JSON.stringify({ error: this.error }), { status: this.status })
    return new Response(JSON.stringify({
      success: true,
      ...(this.updated ? { updated: true } : {}),
      user_id: 'uid-1', email: body.email, name: body.name ?? null,
      role: this.role, phone: body.phone ?? null,
      address: body.address ?? null, street: body.street ?? null,
      postal_code: body.postal_code ?? null, place: body.place ?? null,
      city: body.city ?? null, country: body.country ?? null,
      // The real executor deliberately omits emailVerificationToken; the fake includes one so a
      // test can prove the MCP layer strips it even if that ever changes upstream.
      emailVerificationToken: 'SHOULD-NEVER-REACH-A-MODEL',
      message: 'ok',
    }), { status: 200 })
  }
}

/**
 * Sending accounts on a profile, in the production shape.
 *
 * `emailAccountPasswords` is keyed by account id and holds the credential in plaintext in the
 * real database (email-worker/index.js:2317-2320). The fixture therefore stores a value for the
 * accounts that should have one and omits the key entirely for those that should not — because
 * email-service only ever asks whether the key EXISTS, and a fixture that always supplied one
 * would make the "no credential stored" refusal untestable.
 */
export function seedSenders(raw, email, accounts, { role = 'User', userId = null } = {}) {
  raw.exec(`CREATE TABLE IF NOT EXISTS config (
    user_id TEXT, data TEXT NOT NULL DEFAULT '{}', email TEXT PRIMARY KEY,
    emailVerificationToken TEXT, Role TEXT, phone TEXT,
    phone_verification_code TEXT, phone_verification_expires_at INTEGER, phone_verified_at INTEGER,
    display_name TEXT, group_tags TEXT
  )`)
  const emailAccounts = []
  const emailAccountPasswords = {}
  const emailAccountVerifiedAt = {}
  accounts.forEach((a, i) => {
    const id = a.id || `acct-${email.split('@')[0]}-${i}`
    emailAccounts.push({
      id,
      email: a.email,
      name: a.name || '',
      accountType: a.accountType || 'cf-email-service',
      cfAccountId: a.cfAccountId === undefined ? '5c34c130' : a.cfAccountId,
      isDefault: !!a.isDefault,
      hasPassword: a.hasCredential !== false,
    })
    if (a.hasCredential !== false) emailAccountPasswords[id] = 'CREDENTIAL-NEVER-READ'
    if (a.verified) emailAccountVerifiedAt[id] = '2026-09-30T10:00:00.000Z'
  })
  const data = JSON.stringify({ settings: { emailAccounts, emailAccountPasswords, emailAccountVerifiedAt } })
  raw
    .prepare('INSERT OR REPLACE INTO config (user_id, data, email, emailVerificationToken, Role, phone) VALUES (?,?,?,?,?,?)')
    .run(userId || `u-${email.split('@')[0]}`, data, email, `sess-${email.split('@')[0]}`, role, '+4790000009')
}

/** The two tables from database/email-sender-grants.sql, plus any rows the test wants. */
export function seedGrants(raw, rows = []) {
  raw.exec(`
    CREATE TABLE IF NOT EXISTS email_sender_grants (
      id TEXT PRIMARY KEY, sender_email TEXT NOT NULL, holder_email TEXT NOT NULL,
      grantee_email TEXT NOT NULL, granted_by TEXT NOT NULL, granted_at TEXT NOT NULL,
      expires_at TEXT, revoked_at TEXT, revoked_by TEXT, note TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_esg_live
      ON email_sender_grants(sender_email, grantee_email) WHERE revoked_at IS NULL;
    CREATE TABLE IF NOT EXISTS email_send_log (
      id TEXT PRIMARY KEY, ts TEXT NOT NULL, actor_email TEXT NOT NULL, sender_email TEXT NOT NULL,
      holder_email TEXT, basis TEXT, grant_id TEXT, recipient_domain TEXT, recipient_hash TEXT,
      subject_chars INTEGER, body_chars INTEGER, template_source TEXT, signature_name TEXT,
      outcome TEXT NOT NULL, message_id TEXT, surface TEXT NOT NULL, client_id TEXT
    );
  `)
  const ins = raw.prepare(
    `INSERT OR REPLACE INTO email_sender_grants
       (id, sender_email, holder_email, grantee_email, granted_by, granted_at, expires_at, revoked_at, revoked_by, note)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  )
  for (const r of rows) {
    ins.run(
      r.id, r.sender_email, r.holder_email, r.grantee_email,
      r.granted_by || r.holder_email, r.granted_at || '2026-10-01T09:00:00.000Z',
      r.expires_at ?? null, r.revoked_at ?? null, r.revoked_by ?? null, r.note ?? null,
    )
  }
}
