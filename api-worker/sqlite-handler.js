/**
 * SQLite Handler for R2-stored databases
 * Handles creation, querying, and modification of user SQLite databases
 */

import initSqlJs from 'sql.js/dist/sql-wasm.js'

/**
 * Initialize sql.js (required before using SQLite)
 */
let SQL = null
async function initSQL() {
  if (!SQL) {
    // Initialize sql.js with wasm file from CDN
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    })
  }
  return SQL
}

/**
 * Create a new SQLite database with initial schema
 * @returns {Uint8Array} SQLite database file content
 */
export async function createNewDatabase() {
  const SQL = await initSQL()
  const db = new SQL.Database()

  // Create initial schema for user data
  db.run(`
    CREATE TABLE user_data (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE user_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  db.run(`
    CREATE TABLE user_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Insert welcome data
  db.run(`
    INSERT INTO user_notes (title, content, tags)
    VALUES (?, ?, ?)
  `, ['Welcome', 'This is your personal SQLite database stored in Cloudflare R2!', 'welcome,info'])

  db.run(`
    INSERT INTO user_settings (key, value)
    VALUES (?, ?)
  `, ['database_version', '1.0'])

  // Export database to binary format
  const data = db.export()
  db.close()

  return data
}

/**
 * Load database from R2, execute query, return results
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} r2Key - Path to database file in R2
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Object} Query results
 */
export async function queryDatabase(r2Bucket, r2Key, sql, params = []) {
  const SQL = await initSQL()

  // Get database from R2
  const dbFile = await r2Bucket.get(r2Key)
  if (!dbFile) {
    throw new Error('Database file not found')
  }

  const arrayBuffer = await dbFile.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(arrayBuffer))

  try {
    // Execute query
    const results = db.exec(sql, params)
    db.close()

    // Format results
    if (results.length === 0) {
      return { rows: [], columns: [] }
    }

    return {
      columns: results[0].columns,
      rows: results[0].values.map(row => {
        const obj = {}
        results[0].columns.forEach((col, idx) => {
          obj[col] = row[idx]
        })
        return obj
      })
    }
  } catch (error) {
    db.close()
    throw error
  }
}

/**
 * Load database from R2, execute modification query, save back to R2
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} r2Key - Path to database file in R2
 * @param {string} sql - SQL statement to execute (INSERT/UPDATE/DELETE)
 * @param {Array} params - Query parameters
 * @returns {Object} Execution results
 */
export async function executeDatabase(r2Bucket, r2Key, sql, params = []) {
  const SQL = await initSQL()

  // Get database from R2
  const dbFile = await r2Bucket.get(r2Key)
  if (!dbFile) {
    throw new Error('Database file not found')
  }

  const arrayBuffer = await dbFile.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(arrayBuffer))

  try {
    // Execute statement
    db.run(sql, params)

    // Get changes count
    const changes = db.getRowsModified()

    // Export modified database
    const data = db.export()

    // Save back to R2
    await r2Bucket.put(r2Key, data, {
      customMetadata: {
        lastModified: new Date().toISOString(),
        type: 'sqlite-database'
      }
    })

    db.close()

    return {
      success: true,
      changes: changes,
      message: `${changes} row(s) affected`
    }
  } catch (error) {
    db.close()
    throw error
  }
}

/**
 * Get database schema information
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} r2Key - Path to database file in R2
 * @returns {Object} Schema information
 */
export async function getDatabaseSchema(r2Bucket, r2Key) {
  const SQL = await initSQL()

  const dbFile = await r2Bucket.get(r2Key)
  if (!dbFile) {
    throw new Error('Database file not found')
  }

  const arrayBuffer = await dbFile.arrayBuffer()
  const db = new SQL.Database(new Uint8Array(arrayBuffer))

  try {
    // Get all tables
    const tablesResult = db.exec(`
      SELECT name, sql FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)

    const tables = tablesResult[0]?.values.map(row => ({
      name: row[0],
      sql: row[1]
    })) || []

    // Get row counts for each table
    const tableInfo = []
    for (const table of tables) {
      const countResult = db.exec(`SELECT COUNT(*) as count FROM ${table.name}`)
      const count = countResult[0]?.values[0][0] || 0
      tableInfo.push({
        name: table.name,
        rowCount: count,
        createSQL: table.sql
      })
    }

    db.close()

    return {
      tables: tableInfo,
      tableCount: tables.length
    }
  } catch (error) {
    db.close()
    throw error
  }
}
