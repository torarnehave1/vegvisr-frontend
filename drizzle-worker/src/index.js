import { drizzle } from 'drizzle-orm/d1';
import { eq, sql } from 'drizzle-orm';
import { appTables, appColumns } from './schema.js';

// ── Helpers ──

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin.endsWith('.vegvisr.org') || origin === 'https://vegvisr.org';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://vegvisr.org',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

const VALID_COLUMN_TYPES = ['text', 'integer', 'real', 'boolean', 'datetime'];

// ── Multi-database support ──

const DB_MAP = {
  vegvisr_org: 'DB',
  hallo_vegvisr_chat: 'CHAT_DB',
  calendar_db: 'CALENDAR_DB',
  agent_stats_db: 'STATS_DB',
};

function resolveD1(env, dbName) {
  const binding = DB_MAP[dbName];
  if (binding && env[binding]) return env[binding];
  return env.DB; // default
}

function listDatabases() {
  return Object.keys(DB_MAP);
}

function sqlType(colType) {
  switch (colType) {
    case 'integer':
    case 'boolean': return 'INTEGER';
    case 'real': return 'REAL';
    default: return 'TEXT';
  }
}

// ── Bootstrap metadata tables ──

async function ensureMetaTables(d1) {
  await d1.prepare(`CREATE TABLE IF NOT EXISTS app_tables (
    id TEXT PRIMARY KEY,
    graph_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT
  )`).run();
  await d1.prepare(`CREATE TABLE IF NOT EXISTS app_columns (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    column_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    column_type TEXT NOT NULL,
    position INTEGER NOT NULL,
    required INTEGER DEFAULT 0
  )`).run();
}

// ── Route handlers ──

async function handleCreateTable(db, d1, body, request) {
  const { graphId, displayName, columns, createdBy } = body;
  if (!graphId || !displayName || !Array.isArray(columns) || columns.length === 0) {
    return json({ error: 'graphId, displayName, and columns[] are required' }, 400, request);
  }

  for (const col of columns) {
    if (!col.name || !col.type) {
      return json({ error: `Each column needs name and type. Invalid: ${JSON.stringify(col)}` }, 400, request);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(col.name)) {
      return json({ error: `Column name must be lowercase alphanumeric with underscores, starting with a letter: "${col.name}"` }, 400, request);
    }
    if (!VALID_COLUMN_TYPES.includes(col.type)) {
      return json({ error: `Invalid column type "${col.type}". Must be one of: ${VALID_COLUMN_TYPES.join(', ')}` }, 400, request);
    }
  }

  const tableId = crypto.randomUUID();
  const tableName = `app_${graphId.slice(0, 8)}_${slugify(displayName)}`;

  // Build and execute CREATE TABLE DDL (no user values, all validated identifiers)
  const colDefs = columns.map(c => `${c.name} ${sqlType(c.type)}`).join(', ');
  await d1.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (_id TEXT PRIMARY KEY, _created_at TEXT NOT NULL, ${colDefs})`).run();

  // Insert metadata via Drizzle typed API
  await db.insert(appTables).values({
    id: tableId,
    graphId,
    tableName,
    displayName,
    createdAt: new Date().toISOString(),
    createdBy: createdBy || null,
  });

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    await db.insert(appColumns).values({
      id: crypto.randomUUID(),
      tableId,
      columnName: col.name,
      displayName: col.label || col.name,
      columnType: col.type,
      position: i,
      required: col.required ? 1 : 0,
    });
  }

  return json({ id: tableId, tableName, displayName, columnCount: columns.length }, 201, request);
}

async function handleAddColumn(db, d1, body, request) {
  const { tableId, name, type, label, required } = body;
  if (!tableId || !name || !type) {
    return json({ error: 'tableId, name, and type are required' }, 400, request);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return json({ error: `Column name must be lowercase alphanumeric with underscores, starting with a letter: "${name}"` }, 400, request);
  }
  if (!VALID_COLUMN_TYPES.includes(type)) {
    return json({ error: `Invalid column type "${type}". Must be one of: ${VALID_COLUMN_TYPES.join(', ')}` }, 400, request);
  }

  // Look up the table
  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const tableName = tables[0].tableName;

  // Get current max position
  const existingCols = await db.select().from(appColumns).where(eq(appColumns.tableId, tableId));
  const maxPos = existingCols.reduce((max, c) => Math.max(max, c.position), -1);

  // ALTER TABLE to add the column
  await d1.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${name} ${sqlType(type)}`).run();

  // Insert column metadata
  const colId = crypto.randomUUID();
  await db.insert(appColumns).values({
    id: colId,
    tableId,
    columnName: name,
    displayName: label || name,
    columnType: type,
    position: maxPos + 1,
    required: required ? 1 : 0,
  });

  return json({ id: colId, tableId, columnName: name, displayName: label || name, columnType: type, position: maxPos + 1, message: `Added column "${label || name}" (${name} ${type}) to table ${tableName}` }, 201, request);
}

async function handleInsert(db, d1, body, request) {
  const { tableId, record } = body;
  if (!tableId || !record || typeof record !== 'object') {
    return json({ error: 'tableId and record are required' }, 400, request);
  }

  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const tableMeta = tables[0];

  const cols = await db.select().from(appColumns).where(eq(appColumns.tableId, tableId));
  const validCols = new Set(cols.map(c => c.columnName));

  const rowId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const fields = ['_id', '_created_at'];
  const values = [rowId, createdAt];

  for (const [key, val] of Object.entries(record)) {
    if (validCols.has(key)) {
      fields.push(key);
      values.push(val);
    }
  }

  const placeholders = fields.map(() => '?').join(', ');
  const insertSql = `INSERT INTO ${tableMeta.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
  await d1.prepare(insertSql).bind(...values).run();

  return json({ success: true, _id: rowId, _created_at: createdAt }, 201, request);
}

async function handleDeleteRecords(db, d1, body, request) {
  const { tableId, where, ids } = body;
  if (!tableId) {
    return json({ error: 'tableId is required' }, 400, request);
  }

  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const tableMeta = tables[0];
  const cols = await db.select().from(appColumns).where(eq(appColumns.tableId, tableId));
  const validCols = new Set(['_id', '_created_at', ...cols.map(c => c.columnName)]);

  let deleteSql = `DELETE FROM ${tableMeta.tableName}`;
  const params = [];

  if (ids && Array.isArray(ids) && ids.length > 0) {
    // Delete by specific IDs
    const placeholders = ids.map(() => '?').join(', ');
    deleteSql += ` WHERE _id IN (${placeholders})`;
    params.push(...ids);
  } else if (where && typeof where === 'object' && Object.keys(where).length > 0) {
    // Delete by filter
    const conditions = [];
    for (const [key, val] of Object.entries(where)) {
      if (validCols.has(key)) {
        conditions.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (conditions.length > 0) {
      deleteSql += ` WHERE ${conditions.join(' AND ')}`;
    }
  }
  // No where/ids = delete all records (clear table)

  const result = await d1.prepare(deleteSql).bind(...params).run();
  return json({ success: true, deleted: result.meta?.changes ?? 0 }, 200, request);
}

async function handleQuery(db, d1, body, request) {
  const { tableId, where, orderBy, order, limit, offset } = body;
  if (!tableId) {
    return json({ error: 'tableId is required' }, 400, request);
  }

  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const tableMeta = tables[0];

  const cols = await db.select().from(appColumns).where(eq(appColumns.tableId, tableId));
  const validCols = new Set(['_id', '_created_at', ...cols.map(c => c.columnName)]);

  // Build query
  let querySql = `SELECT * FROM ${tableMeta.tableName}`;
  const params = [];

  if (where && typeof where === 'object' && Object.keys(where).length > 0) {
    const conditions = [];
    for (const [key, val] of Object.entries(where)) {
      if (validCols.has(key)) {
        conditions.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (conditions.length > 0) {
      querySql += ` WHERE ${conditions.join(' AND ')}`;
    }
  }

  // Count
  const countSql = querySql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await d1.prepare(countSql).bind(...params).first();
  const total = countResult?.total ?? 0;

  // Order
  const orderCol = (orderBy && validCols.has(orderBy)) ? orderBy : '_created_at';
  const orderDir = (order === 'asc') ? 'ASC' : 'DESC';
  querySql += ` ORDER BY ${orderCol} ${orderDir}`;

  // Pagination
  const lim = Math.min(Math.max(parseInt(limit) || 50, 1), 1000);
  const off = Math.max(parseInt(offset) || 0, 0);
  querySql += ` LIMIT ? OFFSET ?`;

  const result = await d1.prepare(querySql).bind(...params, lim, off).all();
  const records = result.results || [];

  return json({
    records,
    total,
    limit: lim,
    offset: off,
    columns: cols.map(c => ({ name: c.columnName, label: c.displayName, type: c.columnType, required: !!c.required })),
  }, 200, request);
}

async function handleListTables(db, url, request) {
  const graphId = url.searchParams.get('graphId');
  let tables;
  if (graphId) {
    tables = await db.select().from(appTables).where(eq(appTables.graphId, graphId));
  } else {
    tables = await db.select().from(appTables);
  }
  return json({ tables }, 200, request);
}

async function handleGetTable(db, tableId, request) {
  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const cols = await db.select().from(appColumns).where(eq(appColumns.tableId, tableId));
  return json({
    ...tables[0],
    columns: cols.sort((a, b) => a.position - b.position).map(c => ({
      name: c.columnName,
      label: c.displayName,
      type: c.columnType,
      required: !!c.required,
    })),
  }, 200, request);
}

async function handleDropTable(db, d1, body, request) {
  const { tableId } = body;
  if (!tableId) {
    return json({ error: 'tableId is required' }, 400, request);
  }

  const tables = await db.select().from(appTables).where(eq(appTables.id, tableId));
  if (tables.length === 0) {
    return json({ error: `Table not found: ${tableId}` }, 404, request);
  }
  const tableMeta = tables[0];

  await d1.prepare(`DROP TABLE IF EXISTS ${tableMeta.tableName}`).run();
  await db.delete(appColumns).where(eq(appColumns.tableId, tableId));
  await db.delete(appTables).where(eq(appTables.id, tableId));

  return json({ success: true, dropped: tableMeta.tableName }, 200, request);
}

// ── D1 introspection endpoints ──

async function handleD1Tables(d1, dbName, request) {
  const result = await d1.prepare(
    "SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
  ).all();
  const tables = result.results || [];

  // Get row counts for each table
  const withCounts = await Promise.all(tables.map(async (t) => {
    try {
      const countResult = await d1.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).first();
      return { name: t.name, rows: countResult?.count ?? 0 };
    } catch {
      return { name: t.name, rows: -1 };
    }
  }));

  return json({ database: dbName, tables: withCounts }, 200, request);
}

async function handleRawQuery(d1, body, dbName, request) {
  const { sql: rawSql } = body;
  if (!rawSql || typeof rawSql !== 'string') {
    return json({ error: 'sql string is required' }, 400, request);
  }

  // Basic safety: only allow read queries
  const trimmed = rawSql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('EXPLAIN')) {
    return json({ error: 'Only SELECT, PRAGMA, and EXPLAIN queries are allowed. Use the dedicated endpoints for writes.' }, 403, request);
  }

  try {
    const result = await d1.prepare(rawSql).all();
    return json({
      columns: result.results?.length > 0 ? Object.keys(result.results[0]) : [],
      rows: result.results || [],
      rowCount: result.results?.length ?? 0,
      meta: result.meta || null,
    }, 200, request);
  } catch (err) {
    return json({ error: `SQL error: ${err.message}` }, 400, request);
  }
}

// ── Cross-database: Chat group management ──

async function handleListChatGroups(env, request) {
  const chatDb = env.CHAT_DB;
  const result = await chatDb.prepare('SELECT id, name, created_by, graph_id, image_url FROM groups ORDER BY name').all();
  return json({ groups: result.results || [] }, 200, request);
}

async function handleAddUserToGroup(env, body, request) {
  const { email, groupId, groupName, role } = body;
  if (!email) {
    return json({ error: 'email is required' }, 400, request);
  }
  if (!groupId && !groupName) {
    return json({ error: 'groupId or groupName is required' }, 400, request);
  }

  const mainDb = env.DB;
  const chatDb = env.CHAT_DB;

  // 1. Look up user by email in vegvisr_org.config
  const user = await mainDb.prepare('SELECT user_id, email FROM config WHERE email = ?').bind(email).first();
  if (!user) {
    return json({ error: `User not found: ${email}` }, 404, request);
  }

  // 2. Resolve group — by ID or by name
  let resolvedGroupId = groupId;
  let resolvedGroupName = groupName;
  if (groupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(groupId).first();
    if (!group) {
      return json({ error: `Group not found: ${groupId}` }, 404, request);
    }
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) {
      return json({ error: `Group not found by name: ${groupName}` }, 404, request);
    }
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  }

  // 3. Check if already a member
  const existing = await chatDb.prepare(
    'SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(resolvedGroupId, user.user_id).first();
  if (existing) {
    return json({ error: `User ${email} is already a member of group "${resolvedGroupName}"` }, 409, request);
  }

  // 4. Insert into group_members
  const memberRole = role || 'member';
  await chatDb.prepare(
    'INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
  ).bind(resolvedGroupId, user.user_id, memberRole, Date.now()).run();

  return json({
    success: true,
    user_id: user.user_id,
    email: user.email,
    group_id: resolvedGroupId,
    groupName: resolvedGroupName,
    role: memberRole,
  }, 201, request);
}

async function handleGetGroupMessages(env, url, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const groupId = url.searchParams.get('groupId');
  const groupName = url.searchParams.get('groupName');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit')) || 10, 1), 100);

  if (!groupId && !groupName) {
    return json({ error: 'groupId or groupName query param is required' }, 400, request);
  }

  // Resolve group
  let resolvedGroupId, resolvedGroupName;
  if (groupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(groupId).first();
    if (!group) return json({ error: `Group not found: ${groupId}` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) return json({ error: `Group not found by name: ${groupName}` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  }

  // Fetch messages
  const msgResult = await chatDb.prepare(
    'SELECT id, user_id, body, message_type, created_at, transcript_text, sender_avatar_url FROM group_messages WHERE group_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(resolvedGroupId, limit).all();
  const messages = msgResult.results || [];

  // Batch-lookup user emails from vegvisr_org.config
  const userIds = [...new Set(messages.map(m => m.user_id))];
  const emailMap = {};
  for (const uid of userIds) {
    const user = await mainDb.prepare('SELECT email FROM config WHERE user_id = ?').bind(uid).first();
    emailMap[uid] = user?.email || null;
  }

  // Build response
  const formatted = messages.map(m => ({
    id: m.id,
    userId: m.user_id,
    email: emailMap[m.user_id] || null,
    body: m.body || '',
    messageType: m.message_type,
    createdAt: new Date(m.created_at).toISOString(),
    transcriptText: m.transcript_text || null,
    senderAvatarUrl: m.sender_avatar_url || null,
  }));

  return json({
    groupId: resolvedGroupId,
    groupName: resolvedGroupName,
    messages: formatted,
    count: formatted.length,
  }, 200, request);
}

async function handleGetGroupStats(env, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  // Get message counts, last message time, and member counts per group
  const result = await chatDb.prepare(`
    SELECT g.id, g.name, g.image_url, g.created_by,
      COUNT(DISTINCT gm.id) as message_count,
      MAX(gm.created_at) as last_message_at,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    LEFT JOIN group_messages gm ON g.id = gm.group_id
    GROUP BY g.id
    ORDER BY message_count DESC
  `).all();
  const groups = result.results || [];

  // Look up creator emails
  const creatorIds = [...new Set(groups.map(g => g.created_by).filter(Boolean))];
  const emailMap = {};
  for (const uid of creatorIds) {
    const user = await mainDb.prepare('SELECT email FROM config WHERE user_id = ?').bind(uid).first();
    emailMap[uid] = user?.email || null;
  }

  const stats = groups.map(g => ({
    id: g.id,
    name: g.name,
    messageCount: g.message_count,
    memberCount: g.member_count,
    lastMessageAt: g.last_message_at ? new Date(g.last_message_at).toISOString() : null,
    createdBy: emailMap[g.created_by] || g.created_by,
    imageUrl: g.image_url || null,
  }));

  return json({ groups: stats }, 200, request);
}

// ── Send message to chat group ──

async function handleSendGroupMessage(env, body, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const email = (body.email || '').trim();
  const groupId = (body.groupId || '').trim();
  const groupName = (body.groupName || '').trim();
  const messageBody = (body.body || '').trim();
  const messageType = (body.messageType || 'text').trim();
  const audioUrl = (body.audioUrl || '').trim();
  const audioDurationMs = body.audioDurationMs || null;
  const transcriptText = (body.transcriptText || '').trim() || null;
  const transcriptLang = (body.transcriptLang || '').trim() || null;
  const senderAvatarUrl = (body.senderAvatarUrl || '').trim() || null;

  if (!email) return json({ error: 'email is required' }, 400, request);
  if (messageType === 'voice') {
    if (!audioUrl) return json({ error: 'audioUrl is required for voice messages' }, 400, request);
  } else {
    if (!messageBody) return json({ error: 'body (message text) is required' }, 400, request);
  }
  if (!groupId && !groupName) return json({ error: 'groupId or groupName is required' }, 400, request);

  // 1. Look up user by email
  const user = await mainDb.prepare('SELECT user_id, email FROM config WHERE email = ?').bind(email).first();
  if (!user) return json({ error: `User "${email}" not found in vegvisr.org` }, 404, request);

  // 2. Resolve group
  let resolvedGroupId = groupId;
  let resolvedGroupName = groupName;
  if (!resolvedGroupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) return json({ error: `Group "${groupName}" not found` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(resolvedGroupId).first();
    if (!group) return json({ error: `Group "${resolvedGroupId}" not found` }, 404, request);
    resolvedGroupName = group.name;
  }

  // 3. Check membership
  const member = await chatDb.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(resolvedGroupId, user.user_id).first();
  if (!member) return json({ error: `User "${email}" is not a member of group "${resolvedGroupName}"` }, 403, request);

  // 4. Insert message
  const createdAt = Date.now();
  const transcriptionStatus = messageType === 'voice'
    ? (transcriptText ? 'completed' : 'pending')
    : null;
  const result = await chatDb.prepare(
    `INSERT INTO group_messages (group_id, user_id, body, created_at, message_type,
       audio_url, audio_duration_ms, transcript_text, transcript_lang, transcription_status,
       sender_avatar_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    resolvedGroupId, user.user_id, messageBody || '', createdAt, messageType,
    audioUrl || null, audioDurationMs, transcriptText, transcriptLang, transcriptionStatus,
    senderAvatarUrl
  ).run();

  // 5. Update group timestamp
  await chatDb.prepare('UPDATE groups SET updated_at = ? WHERE id = ?')
    .bind(createdAt, resolvedGroupId).run();

  const response = {
    success: true,
    messageId: result.meta.last_row_id,
    groupId: resolvedGroupId,
    groupName: resolvedGroupName,
    userId: user.user_id,
    email: user.email,
    body: messageBody,
    messageType,
    createdAt: new Date(createdAt).toISOString(),
  };
  if (messageType === 'voice') {
    response.audioUrl = audioUrl;
    response.audioDurationMs = audioDurationMs;
    response.transcriptText = transcriptText;
    response.transcriptionStatus = transcriptionStatus;
  }
  return json(response, 201, request);
}

async function handleCreateChatGroup(env, body, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const email = (body.email || '').trim();
  const groupName = (body.name || '').trim();
  const graphId = (body.graphId || '').trim() || null;

  if (!email) return json({ error: 'email is required' }, 400, request);
  if (!groupName) return json({ error: 'name (group name) is required' }, 400, request);

  // 1. Look up user by email
  const user = await mainDb.prepare('SELECT user_id, email FROM config WHERE email = ?').bind(email).first();
  if (!user) return json({ error: `User "${email}" not found in vegvisr.org` }, 404, request);

  // 2. Check if group name already exists
  const existing = await chatDb.prepare('SELECT id FROM groups WHERE name = ?').bind(groupName).first();
  if (existing) return json({ error: `Group "${groupName}" already exists` }, 409, request);

  // 3. Create group
  const groupId = crypto.randomUUID();
  const createdAt = Date.now();
  await chatDb.prepare(
    `INSERT INTO groups (id, name, created_by, graph_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(groupId, groupName, user.user_id, graphId, createdAt, createdAt).run();

  // 4. Add creator as owner
  await chatDb.prepare(
    `INSERT INTO group_members (group_id, user_id, role, joined_at)
     VALUES (?, ?, 'owner', ?)`
  ).bind(groupId, user.user_id, createdAt).run();

  return json({
    success: true,
    groupId,
    groupName,
    createdBy: user.email,
    role: 'owner',
    graphId,
    createdAt: new Date(createdAt).toISOString(),
  }, 201, request);
}

async function handleRegisterChatBot(env, body, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const graphId = (body.graphId || '').trim();
  const agentId = (body.agentId || '').trim();
  const botName = (body.botName || '').trim();
  const groupId = (body.groupId || '').trim();
  const groupName = (body.groupName || '').trim();

  if (!graphId && !agentId) return json({ error: 'graphId or agentId is required' }, 400, request);
  if (!botName) return json({ error: 'botName is required' }, 400, request);
  if (!groupId && !groupName) return json({ error: 'groupId or groupName is required' }, 400, request);

  // 1. Resolve group
  let resolvedGroupId = groupId;
  let resolvedGroupName = groupName;
  if (!resolvedGroupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) return json({ error: `Group "${groupName}" not found` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(resolvedGroupId).first();
    if (!group) return json({ error: `Group "${resolvedGroupId}" not found` }, 404, request);
    resolvedGroupName = group.name;
  }

  // 2. Check if bot already in this group
  const botUserId = agentId ? `bot-agent-${agentId}` : `bot-${graphId}`;
  const existing = await chatDb.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(resolvedGroupId, botUserId).first();
  if (existing) return json({ error: `Bot "${botName}" is already registered in group "${resolvedGroupName}"` }, 409, request);

  // 3. Create bot user in config table (idempotent)
  const sanitized = botName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const botEmail = `${sanitized}-bot@vegvisr.org`;
  const botData = JSON.stringify({ type: 'bot', botName, graphId: graphId || null, agentId: agentId || null });
  await mainDb.prepare('INSERT OR IGNORE INTO config (email, user_id, data) VALUES (?, ?, ?)').bind(botEmail, botUserId, botData).run();

  // 4. Add bot to group
  const joinedAt = Date.now();
  await chatDb.prepare(
    'INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
  ).bind(resolvedGroupId, botUserId, 'bot', joinedAt).run();

  return json({
    success: true,
    botUserId,
    botEmail,
    botName,
    groupId: resolvedGroupId,
    groupName: resolvedGroupName,
    graphId: graphId || null,
    agentId: agentId || null,
    joinedAt: new Date(joinedAt).toISOString(),
  }, 201, request);
}

async function handleGetGroupBots(env, url, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const groupId = url.searchParams.get('groupId') || '';
  const groupName = url.searchParams.get('groupName') || '';
  if (!groupId && !groupName) return json({ error: 'groupId or groupName is required' }, 400, request);

  // 1. Resolve group
  let resolvedGroupId = groupId;
  let resolvedGroupName = groupName;
  if (!resolvedGroupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) return json({ error: `Group "${groupName}" not found` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(resolvedGroupId).first();
    if (!group) return json({ error: `Group "${resolvedGroupId}" not found` }, 404, request);
    resolvedGroupName = group.name;
  }

  // 2. Get bot members
  const { results } = await chatDb.prepare(
    'SELECT user_id, joined_at FROM group_members WHERE group_id = ? AND role = ?'
  ).bind(resolvedGroupId, 'bot').all();

  // 3. Look up bot emails and extract graphIds
  const bots = [];
  for (const row of results) {
    const isAgentBot = row.user_id.startsWith('bot-agent-');
    const agentId = isAgentBot ? row.user_id.replace('bot-agent-', '') : null;
    const graphId = isAgentBot ? null : row.user_id.replace(/^bot-/, '');
    const config = await mainDb.prepare('SELECT email, data FROM config WHERE user_id = ?').bind(row.user_id).first();
    const configData = config?.data ? JSON.parse(config.data) : {};
    bots.push({
      userId: row.user_id,
      email: config?.email || null,
      graphId: configData.graphId || graphId,
      agentId,
      botName: configData.botName || null,
      joinedAt: new Date(row.joined_at).toISOString(),
    });
  }

  return json({ groupId: resolvedGroupId, groupName: resolvedGroupName, bots, count: bots.length }, 200, request);
}

async function handleUnregisterChatBot(env, body, request) {
  const chatDb = env.CHAT_DB;
  const agentId = (body.agentId || '').trim();
  const botUserId = (body.botUserId || '').trim();
  const groupId = (body.groupId || '').trim();

  if (!groupId) return json({ error: 'groupId is required' }, 400, request);
  const resolvedBotUserId = botUserId || (agentId ? `bot-agent-${agentId}` : '');
  if (!resolvedBotUserId) return json({ error: 'agentId or botUserId is required' }, 400, request);

  const result = await chatDb.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?'
  ).bind(groupId, resolvedBotUserId).run();

  if (result.meta.changes === 0) {
    return json({ error: 'Bot not found in group' }, 404, request);
  }

  return json({ success: true, groupId, botUserId: resolvedBotUserId }, 200, request);
}

async function handleGetAgentBotGroups(env, url, request) {
  const chatDb = env.CHAT_DB;
  const agentId = url.searchParams.get('agentId') || '';
  if (!agentId) return json({ error: 'agentId is required' }, 400, request);

  const botUserId = `bot-agent-${agentId}`;
  const { results } = await chatDb.prepare(
    'SELECT gm.group_id, g.name, gm.joined_at FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ?'
  ).bind(botUserId).all();

  const groups = results.map(r => ({
    groupId: r.group_id,
    groupName: r.name,
    joinedAt: new Date(r.joined_at).toISOString(),
  }));

  return json({ agentId, botUserId, groups, count: groups.length }, 200, request);
}

// ── Get group members with profile info ──

async function handleGetGroupMembers(env, url, request) {
  const chatDb = env.CHAT_DB;
  const mainDb = env.DB;

  const groupId = url.searchParams.get('groupId') || '';
  const groupName = url.searchParams.get('groupName') || '';
  if (!groupId && !groupName) return json({ error: 'groupId or groupName is required' }, 400, request);

  // Resolve group
  let resolvedGroupId = groupId;
  let resolvedGroupName = groupName;
  if (!resolvedGroupId) {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE name = ?').bind(groupName).first();
    if (!group) return json({ error: `Group "${groupName}" not found` }, 404, request);
    resolvedGroupId = group.id;
    resolvedGroupName = group.name;
  } else {
    const group = await chatDb.prepare('SELECT id, name FROM groups WHERE id = ?').bind(resolvedGroupId).first();
    if (!group) return json({ error: `Group "${resolvedGroupId}" not found` }, 404, request);
    resolvedGroupName = group.name;
  }

  // Get all members
  const { results } = await chatDb.prepare(
    'SELECT user_id, role, joined_at FROM group_members WHERE group_id = ?'
  ).bind(resolvedGroupId).all();

  // Look up profile info from config table
  const members = [];
  for (const row of results) {
    const config = await mainDb.prepare(
      'SELECT email, data, profileimage FROM config WHERE user_id = ?'
    ).bind(row.user_id).first();
    const configData = config?.data ? (() => { try { return JSON.parse(config.data); } catch { return {}; } })() : {};
    members.push({
      userId: row.user_id,
      email: config?.email || null,
      name: configData.botName || configData.name || null,
      role: row.role || 'member',
      profileImage: config?.profileimage || null,
      joinedAt: new Date(row.joined_at).toISOString(),
      isBot: row.role === 'bot',
      botGraphId: configData.graphId || null,
      agentId: configData.agentId || null,
    });
  }

  return json({ groupId: resolvedGroupId, groupName: resolvedGroupName, members, count: members.length }, 200, request);
}

// ── OpenAPI 3.0 specification ──

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Drizzle Worker API',
    version: '1.0.0',
    description: 'Cloudflare Worker providing D1 database management, app-table CRUD, and cross-database chat group operations.',
  },
  servers: [{ url: 'https://drizzle.vegvisr.org' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Returns worker health status and current timestamp.',
        responses: {
          200: {
            description: 'Healthy',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, worker: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } } } },
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'OpenAPI specification',
        description: 'Returns this OpenAPI 3.0 JSON specification.',
        responses: { 200: { description: 'OpenAPI spec', content: { 'application/json': { schema: { type: 'object' } } } } },
      },
    },
    '/databases': {
      get: {
        summary: 'List available databases',
        description: 'Returns the list of D1 database names this worker can connect to.',
        responses: {
          200: {
            description: 'Database list',
            content: { 'application/json': { schema: { type: 'object', properties: { databases: { type: 'array', items: { type: 'string' } } } } } },
          },
        },
      },
    },
    '/create-table': {
      post: {
        summary: 'Create an app table',
        description: 'Creates a new D1 table with the specified columns and registers it in app_tables metadata.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name (default: vegvisr_org)' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['graphId', 'displayName', 'columns'],
                properties: {
                  graphId: { type: 'string', description: 'Associated knowledge graph ID' },
                  displayName: { type: 'string', description: 'Human-readable table name' },
                  columns: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name', 'type'],
                      properties: {
                        name: { type: 'string', description: 'Column name (lowercase alphanumeric + underscores)' },
                        type: { type: 'string', enum: ['text', 'integer', 'real', 'boolean', 'datetime'] },
                        label: { type: 'string', description: 'Display label' },
                        required: { type: 'boolean' },
                      },
                    },
                  },
                  createdBy: { type: 'string', description: 'Creator identifier' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Table created', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, tableName: { type: 'string' }, displayName: { type: 'string' }, columnCount: { type: 'integer' } } } } } },
          400: { description: 'Validation error' },
        },
      },
    },
    '/insert': {
      post: {
        summary: 'Insert a record',
        description: 'Inserts a row into the specified app table. Auto-generates _id and _created_at.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tableId', 'record'],
                properties: {
                  tableId: { type: 'string', description: 'The app_tables.id of the target table' },
                  record: { type: 'object', additionalProperties: true, description: 'Key-value pairs matching column names' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Record inserted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, _id: { type: 'string' }, _created_at: { type: 'string' } } } } } },
          400: { description: 'Validation error' },
          404: { description: 'Table not found' },
        },
      },
    },
    '/query': {
      post: {
        summary: 'Query records',
        description: 'Queries rows from an app table with optional filtering, ordering, and pagination.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tableId'],
                properties: {
                  tableId: { type: 'string', description: 'The app_tables.id to query' },
                  where: { type: 'object', additionalProperties: true, description: 'Equality filters as key-value pairs' },
                  orderBy: { type: 'string', description: 'Column name to order by (default: _created_at)' },
                  order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction (default: desc)' },
                  limit: { type: 'integer', description: 'Max rows (1-1000, default: 50)' },
                  offset: { type: 'integer', description: 'Pagination offset (default: 0)' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Query results',
            content: { 'application/json': { schema: { type: 'object', properties: { records: { type: 'array', items: { type: 'object' } }, total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' }, columns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' }, required: { type: 'boolean' } } } } } } } },
          },
          404: { description: 'Table not found' },
        },
      },
    },
    '/tables': {
      get: {
        summary: 'List app tables',
        description: 'Lists all registered app tables, optionally filtered by graphId.',
        parameters: [
          { name: 'graphId', in: 'query', schema: { type: 'string' }, description: 'Filter by knowledge graph ID' },
          { name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' },
        ],
        responses: {
          200: { description: 'Table list', content: { 'application/json': { schema: { type: 'object', properties: { tables: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, graphId: { type: 'string' }, tableName: { type: 'string' }, displayName: { type: 'string' }, createdAt: { type: 'string' }, createdBy: { type: 'string' } } } } } } } },
        },
      },
    },
    '/table/{tableId}': {
      get: {
        summary: 'Get table schema',
        description: 'Returns table metadata and its column definitions sorted by position.',
        parameters: [
          { name: 'tableId', in: 'path', required: true, schema: { type: 'string' }, description: 'The app_tables.id' },
          { name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' },
        ],
        responses: {
          200: { description: 'Table with columns', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, graphId: { type: 'string' }, tableName: { type: 'string' }, displayName: { type: 'string' }, columns: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' }, required: { type: 'boolean' } } } } } } } } },
          404: { description: 'Table not found' },
        },
      },
    },
    '/add-column': {
      post: {
        summary: 'Add column to table',
        description: 'Adds a new column to an existing app table via ALTER TABLE and registers it in metadata.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tableId', 'name', 'type'],
                properties: {
                  tableId: { type: 'string' },
                  name: { type: 'string', description: 'Column name (lowercase alphanumeric + underscores)' },
                  type: { type: 'string', enum: ['text', 'integer', 'real', 'boolean', 'datetime'] },
                  label: { type: 'string', description: 'Display label' },
                  required: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Column added', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, tableId: { type: 'string' }, columnName: { type: 'string' }, displayName: { type: 'string' }, columnType: { type: 'string' }, position: { type: 'integer' }, message: { type: 'string' } } } } } },
          400: { description: 'Validation error' },
          404: { description: 'Table not found' },
        },
      },
    },
    '/drop-table': {
      post: {
        summary: 'Drop an app table',
        description: 'Drops the D1 table and removes its metadata from app_tables and app_columns.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['tableId'], properties: { tableId: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Table dropped', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, dropped: { type: 'string' } } } } } },
          404: { description: 'Table not found' },
        },
      },
    },
    '/d1-tables': {
      get: {
        summary: 'List raw D1 tables',
        description: 'Introspects sqlite_master to list all tables in the selected D1 database with row counts.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name (default: vegvisr_org)' }],
        responses: {
          200: { description: 'D1 table list', content: { 'application/json': { schema: { type: 'object', properties: { database: { type: 'string' }, tables: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'integer' } } } } } } } } },
        },
      },
    },
    '/raw-query': {
      post: {
        summary: 'Execute raw SQL query (read-only)',
        description: 'Executes a raw SELECT, PRAGMA, or EXPLAIN query against the selected D1 database. Write queries are rejected.',
        parameters: [{ name: 'database', in: 'query', schema: { type: 'string' }, description: 'Target database name' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sql'],
                properties: {
                  sql: { type: 'string', description: 'SQL query (SELECT/PRAGMA/EXPLAIN only)' },
                  database: { type: 'string', description: 'Override database in body' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Query results', content: { 'application/json': { schema: { type: 'object', properties: { columns: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'object' } }, rowCount: { type: 'integer' }, meta: { type: 'object', nullable: true } } } } } },
          400: { description: 'SQL error or invalid query' },
          403: { description: 'Write queries not allowed' },
        },
      },
    },
    '/chat-groups': {
      get: {
        summary: 'List chat groups',
        description: 'Returns all chat groups from the CHAT_DB with id, name, created_by, graph_id, and image_url.',
        responses: {
          200: { description: 'Group list', content: { 'application/json': { schema: { type: 'object', properties: { groups: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, created_by: { type: 'string' }, graph_id: { type: 'string' }, image_url: { type: 'string' } } } } } } } } },
        },
      },
    },
    '/add-user-to-group': {
      post: {
        summary: 'Add user to chat group',
        description: 'Looks up user by email in vegvisr_org, resolves group by ID or name, and adds the user as a member.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                  groupId: { type: 'string' },
                  groupName: { type: 'string' },
                  role: { type: 'string', description: 'Member role (default: member)' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User added to group' },
          400: { description: 'Missing required fields' },
          404: { description: 'User or group not found' },
          409: { description: 'User already a member' },
        },
      },
    },
    '/group-messages': {
      get: {
        summary: 'Get group messages',
        description: 'Fetches recent messages from a chat group with user email lookup.',
        parameters: [
          { name: 'groupId', in: 'query', schema: { type: 'string' }, description: 'Group ID' },
          { name: 'groupName', in: 'query', schema: { type: 'string' }, description: 'Group name (alternative to groupId)' },
          { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Max messages (1-100, default: 10)' },
        ],
        responses: {
          200: { description: 'Messages', content: { 'application/json': { schema: { type: 'object', properties: { groupId: { type: 'string' }, groupName: { type: 'string' }, messages: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, userId: { type: 'string' }, email: { type: 'string', nullable: true }, body: { type: 'string' }, messageType: { type: 'string' }, createdAt: { type: 'string' }, transcriptText: { type: 'string', nullable: true }, senderAvatarUrl: { type: 'string', nullable: true } } } }, count: { type: 'integer' } } } } } },
          400: { description: 'Missing groupId or groupName' },
          404: { description: 'Group not found' },
        },
      },
    },
    '/group-stats': {
      get: {
        summary: 'Get group statistics',
        description: 'Returns message counts, member counts, last message timestamps, and creator info for all groups.',
        responses: {
          200: { description: 'Group stats', content: { 'application/json': { schema: { type: 'object', properties: { groups: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, messageCount: { type: 'integer' }, memberCount: { type: 'integer' }, lastMessageAt: { type: 'string', nullable: true }, createdBy: { type: 'string' }, imageUrl: { type: 'string', nullable: true } } } } } } } } },
        },
      },
    },
    '/send-group-message': {
      post: {
        summary: 'Send a message to a chat group',
        description: 'Sends a text or voice message to a chat group. Validates user membership. Supports audio with transcription.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                  groupId: { type: 'string' },
                  groupName: { type: 'string' },
                  body: { type: 'string', description: 'Message text (required for text messages)' },
                  messageType: { type: 'string', enum: ['text', 'voice'], description: 'Default: text' },
                  audioUrl: { type: 'string', description: 'Required for voice messages' },
                  audioDurationMs: { type: 'integer' },
                  transcriptText: { type: 'string' },
                  transcriptLang: { type: 'string' },
                  senderAvatarUrl: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Message sent' },
          400: { description: 'Validation error' },
          403: { description: 'User not a member of the group' },
          404: { description: 'User or group not found' },
        },
      },
    },
    '/create-chat-group': {
      post: {
        summary: 'Create a chat group',
        description: 'Creates a new chat group and adds the creator as owner.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name'],
                properties: {
                  email: { type: 'string', description: 'Creator email (must exist in vegvisr_org)' },
                  name: { type: 'string', description: 'Group name (must be unique)' },
                  graphId: { type: 'string', description: 'Optional linked knowledge graph ID' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Group created' },
          400: { description: 'Missing required fields' },
          404: { description: 'User not found' },
          409: { description: 'Group name already exists' },
        },
      },
    },
    '/register-chat-bot': {
      post: {
        summary: 'Register a bot in a chat group',
        description: 'Creates a bot user in the config table and adds it to a chat group with role "bot".',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['botName'],
                properties: {
                  graphId: { type: 'string', description: 'Knowledge graph ID for the bot' },
                  agentId: { type: 'string', description: 'Agent ID (alternative to graphId)' },
                  botName: { type: 'string' },
                  groupId: { type: 'string' },
                  groupName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Bot registered' },
          400: { description: 'Missing required fields' },
          404: { description: 'Group not found' },
          409: { description: 'Bot already in group' },
        },
      },
    },
    '/group-bots': {
      get: {
        summary: 'List bots in a group',
        description: 'Returns all bot members in a chat group with their config data.',
        parameters: [
          { name: 'groupId', in: 'query', schema: { type: 'string' } },
          { name: 'groupName', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Bot list', content: { 'application/json': { schema: { type: 'object', properties: { groupId: { type: 'string' }, groupName: { type: 'string' }, bots: { type: 'array', items: { type: 'object' } }, count: { type: 'integer' } } } } } },
          400: { description: 'Missing groupId or groupName' },
          404: { description: 'Group not found' },
        },
      },
    },
    '/unregister-chat-bot': {
      post: {
        summary: 'Remove a bot from a chat group',
        description: 'Deletes the bot membership from group_members.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['groupId'],
                properties: {
                  groupId: { type: 'string' },
                  agentId: { type: 'string' },
                  botUserId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Bot removed' },
          400: { description: 'Missing required fields' },
          404: { description: 'Bot not found in group' },
        },
      },
    },
    '/agent-bot-groups': {
      get: {
        summary: 'List groups an agent bot belongs to',
        description: 'Returns all chat groups where the specified agent bot is a member.',
        parameters: [
          { name: 'agentId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Group list', content: { 'application/json': { schema: { type: 'object', properties: { agentId: { type: 'string' }, botUserId: { type: 'string' }, groups: { type: 'array', items: { type: 'object', properties: { groupId: { type: 'string' }, groupName: { type: 'string' }, joinedAt: { type: 'string' } } } }, count: { type: 'integer' } } } } } },
          400: { description: 'Missing agentId' },
        },
      },
    },
    '/group-members': {
      get: {
        summary: 'Get group members with profiles',
        description: 'Returns all members (humans and bots) with profile info from the config table.',
        parameters: [
          { name: 'groupId', in: 'query', schema: { type: 'string' } },
          { name: 'groupName', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Member list', content: { 'application/json': { schema: { type: 'object', properties: { groupId: { type: 'string' }, groupName: { type: 'string' }, members: { type: 'array', items: { type: 'object', properties: { userId: { type: 'string' }, email: { type: 'string', nullable: true }, name: { type: 'string', nullable: true }, role: { type: 'string' }, profileImage: { type: 'string', nullable: true }, joinedAt: { type: 'string' }, isBot: { type: 'boolean' }, botGraphId: { type: 'string', nullable: true }, agentId: { type: 'string', nullable: true } } } }, count: { type: 'integer' } } } } } },
          400: { description: 'Missing groupId or groupName' },
          404: { description: 'Group not found' },
        },
      },
    },
  },
  },
};

// ── Worker entry ──

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Resolve which D1 database to use (default: vegvisr_org)
    const dbParam = url.searchParams.get('database') || 'vegvisr_org';
    const d1 = resolveD1(env, dbParam);
    const db = drizzle(d1);  // Drizzle ORM for typed metadata queries

    try {
      // ── Health check (no DB needed) ──
      if (request.method === 'GET' && path === '/health') {
        return json({ status: 'healthy', worker: 'drizzle-worker', timestamp: new Date().toISOString() }, 200, request);
      }

      // ── OpenAPI spec (no DB needed) ──
      if (request.method === 'GET' && path === '/openapi.json') {
        return json(openApiSpec, 200, request);
      }

      // Only ensure meta tables on the default DB
      if (dbParam === 'vegvisr_org') {
        await ensureMetaTables(d1);
      }

      // List available databases
      if (request.method === 'GET' && path === '/databases') {
        return json({ databases: listDatabases() }, 200, request);
      }

      if (request.method === 'POST' && path === '/create-table') {
        return await handleCreateTable(db, d1, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/insert') {
        return await handleInsert(db, d1, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/query') {
        return await handleQuery(db, d1, await request.json(), request);
      }
      if (request.method === 'GET' && path === '/tables') {
        return await handleListTables(db, url, request);
      }
      if (request.method === 'GET' && path.startsWith('/table/')) {
        const tableId = path.split('/table/')[1];
        if (tableId) return await handleGetTable(db, tableId, request);
      }
      if (request.method === 'POST' && path === '/add-column') {
        return await handleAddColumn(db, d1, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/delete-records') {
        return await handleDeleteRecords(db, d1, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/drop-table') {
        return await handleDropTable(db, d1, await request.json(), request);
      }
      if (request.method === 'GET' && path === '/d1-tables') {
        return await handleD1Tables(d1, dbParam, request);
      }
      if (request.method === 'POST' && path === '/raw-query') {
        const body = await request.json();
        // Allow database override in body too (for POST convenience)
        const queryDb = body.database ? resolveD1(env, body.database) : d1;
        const queryDbName = body.database || dbParam;
        return await handleRawQuery(queryDb, body, queryDbName, request);
      }

      // Cross-database chat group endpoints (always use both DB and CHAT_DB)
      if (request.method === 'GET' && path === '/chat-groups') {
        return await handleListChatGroups(env, request);
      }
      if (request.method === 'POST' && path === '/add-user-to-group') {
        return await handleAddUserToGroup(env, await request.json(), request);
      }
      if (request.method === 'GET' && path === '/group-messages') {
        return await handleGetGroupMessages(env, url, request);
      }
      if (request.method === 'GET' && path === '/group-stats') {
        return await handleGetGroupStats(env, request);
      }
      if (request.method === 'POST' && path === '/send-group-message') {
        return await handleSendGroupMessage(env, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/create-chat-group') {
        return await handleCreateChatGroup(env, await request.json(), request);
      }
      if (request.method === 'POST' && path === '/register-chat-bot') {
        return await handleRegisterChatBot(env, await request.json(), request);
      }
      if (request.method === 'GET' && path === '/group-bots') {
        return await handleGetGroupBots(env, url, request);
      }
      if (request.method === 'POST' && path === '/unregister-chat-bot') {
        return await handleUnregisterChatBot(env, await request.json(), request);
      }
      if (request.method === 'GET' && path === '/agent-bot-groups') {
        return await handleGetAgentBotGroups(env, url, request);
      }
      if (request.method === 'GET' && path === '/group-members') {
        return await handleGetGroupMembers(env, url, request);
      }

      return json({ error: 'Not found', endpoints: ['GET /health', 'GET /openapi.json', 'GET /databases', 'POST /create-table', 'POST /insert', 'POST /query', 'POST /delete-records', 'GET /tables', 'GET /table/:id', 'POST /add-column', 'POST /drop-table', 'GET /d1-tables', 'POST /raw-query', 'GET /chat-groups', 'POST /add-user-to-group', 'POST /send-group-message', 'POST /create-chat-group', 'POST /register-chat-bot', 'GET /group-bots', 'POST /unregister-chat-bot', 'GET /agent-bot-groups', 'GET /group-members'] }, 404, request);
    } catch (err) {
      console.error('Drizzle worker error:', err);
      return json({ error: err.message }, 500, request);
    }
  },
};
