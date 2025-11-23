/**
 * R2 User Database Management
 * Allows Superadmin users to create and manage their own R2 buckets
 * with SQLite database files for private data storage
 */

// For now, we'll create a minimal SQLite file structure
// TODO: Integrate proper SQLite WASM when Cloudflare Workers supports it better
async function createMinimalSQLiteDB() {
  // Create a minimal valid SQLite database file
  // SQLite header: "SQLite format 3\0" (16 bytes)
  const header = new TextEncoder().encode('SQLite format 3\0')
  const db = new Uint8Array(4096) // Minimum SQLite page size

  // Set header
  db.set(header, 0)

  // Set page size (4096 at offset 16-17)
  db[16] = 0x10
  db[17] = 0x00

  // Set database size in pages (1 page at offset 28-31)
  db[28] = 0x00
  db[29] = 0x00
  db[30] = 0x00
  db[31] = 0x01

  return db
}

/**
 * Create an R2 bucket for a user
 * POST /api/user-database/create
 *
 * NOTE: This creates a "virtual bucket" by using a prefix in the existing R2 bucket
 * since Cloudflare Workers can't dynamically create R2 buckets via API without special permissions.
 * Each user gets their data stored under: user-{userId}/ prefix
 */
export async function createUserR2Bucket(request, env) {
  try {
    // Parse request
    const { userId, userEmail } = await request.json()

    // Validate Superadmin role (TODO: Add proper auth check)
    // This should check the user's role from the config table

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if bucket already exists
    const existing = await env.vegvisr_org.prepare(
      'SELECT * FROM user_databases WHERE user_id = ?'
    ).bind(userId).first()

    if (existing) {
      return new Response(JSON.stringify({
        error: 'Database already exists for this user',
        bucketName: existing.bucket_name,
        createdAt: existing.created_at
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create bucket name (must be DNS-compliant)
    const bucketName = `user-${userId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`

    // Create initial SQLite database file with minimal structure
    const dbContent = await createMinimalSQLiteDB()

    // Store database file in R2 under user's prefix
    const r2Key = `${bucketName}/database.sqlite`
    await env.USER_DATABASES.put(r2Key, dbContent, {
      customMetadata: {
        userId: userId,
        createdAt: new Date().toISOString(),
        type: 'sqlite-database'
      }
    })

    // Store bucket info in database
    await env.vegvisr_org.prepare(`
      INSERT INTO user_databases (user_id, bucket_name, status, storage_used, object_count)
      VALUES (?, ?, 'active', ?, 1)
    `).bind(userId, bucketName, dbContent.byteLength).run()

    return new Response(JSON.stringify({
      success: true,
      bucketName,
      message: 'User database created successfully',
      databaseUrl: `r2://${bucketName}/database.sqlite`,
      r2Key: r2Key
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error creating user R2 bucket:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Get user's R2 bucket information
 * GET /api/user-database/info
 */
export async function getUserR2Info(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get bucket info from database
    const result = await env.vegvisr_org.prepare(`
      SELECT bucket_name, created_at, status, last_accessed, storage_used, object_count
      FROM user_databases
      WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
      return new Response(JSON.stringify({
        exists: false,
        message: 'No database found for this user'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check if database file exists in R2
    const r2Key = `${result.bucket_name}/database.sqlite`
    const dbFile = await env.USER_DATABASES.head(r2Key)

    return new Response(JSON.stringify({
      exists: true,
      bucketName: result.bucket_name,
      createdAt: result.created_at,
      status: result.status,
      lastAccessed: result.last_accessed,
      storageUsed: result.storage_used,
      objectCount: result.object_count,
      r2Key: r2Key,
      fileSize: dbFile?.size || 0,
      metadata: dbFile?.customMetadata || {}
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error getting user database info:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Delete user's R2 bucket
 * DELETE /api/user-database/delete
 */
export async function deleteUserR2Bucket(request, env) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get bucket name
    const result = await env.vegvisr_org.prepare(`
      SELECT bucket_name FROM user_databases WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
      return new Response(JSON.stringify({ error: 'No database found for user' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const bucketName = result.bucket_name

    // Delete database file from R2
    const r2Key = `${bucketName}/database.sqlite`
    await env.USER_DATABASES.delete(r2Key)

    // Remove from database
    await env.vegvisr_org.prepare(`
      DELETE FROM user_databases WHERE user_id = ?
    `).bind(userId).run()

    return new Response(JSON.stringify({
      success: true,
      message: 'User database deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error deleting user database:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Download user's SQLite database
 * GET /api/user-database/download
 */
export async function downloadUserDatabase(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get bucket name
    const result = await env.vegvisr_org.prepare(`
      SELECT bucket_name FROM user_databases WHERE user_id = ?
    `).bind(userId).first()

    if (!result) {
      return new Response(JSON.stringify({ error: 'No database found for user' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get database file from R2
    const dbFile = await env.USER_DATABASES.get(`${result.bucket_name}/database.sqlite`)

    if (!dbFile) {
      return new Response(JSON.stringify({ error: 'Database file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return database file
    return new Response(dbFile.body, {
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="user-${userId}-database.sqlite"`
      }
    })

  } catch (error) {
    console.error('Error downloading database:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Query user's SQLite database
 * POST /api/user-database/query
 * TODO: Implement once sql.js/WASM integration is fixed for Workers
 */
export async function queryUserDatabase(request, env) {
  return new Response(JSON.stringify({
    error: 'Not implemented yet',
    message: 'SQLite querying will be available soon. For now, download the database file and query locally.'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Execute modification on user's SQLite database
 * POST /api/user-database/execute
 * TODO: Implement once sql.js/WASM integration is fixed for Workers
 */
export async function executeUserDatabase(request, env) {
  return new Response(JSON.stringify({
    error: 'Not implemented yet',
    message: 'SQLite execution will be available soon. For now, download, modify, and re-upload the database file.'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * Get database schema information
 * GET /api/user-database/schema
 * TODO: Implement once sql.js/WASM integration is fixed for Workers
 */
export async function getUserDatabaseSchema(request, env) {
  return new Response(JSON.stringify({
    error: 'Not implemented yet',
    message: 'Schema inspection will be available soon. For now, download the database and inspect locally.'
  }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' }
  })
}
