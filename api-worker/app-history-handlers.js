/**
 * App History API - Manages app prompt history and version history
 * Provides CRUD operations for storing and retrieving app creation history
 */

/**
 * Save app to history after successful generation
 * POST /api/app-history/save
 * Body: { userId, prompt, aiModel, generatedCode, appName?, description?, tags? }
 */
export async function saveAppToHistory(request, env) {
  try {
    const { userId, prompt, aiModel, generatedCode, appName, description, tags, conversationHistory } = await request.json()

    if (!userId || !prompt || !aiModel || !generatedCode) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, prompt, aiModel, generatedCode'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin
    const userCheck = await env.vegvisr_org.prepare(
      'SELECT Role FROM config WHERE user_id = ?'
    ).bind(userId).first()

    if (!userCheck || userCheck.Role !== 'Superadmin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Superadmin role required'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const historyId = crypto.randomUUID()
    const now = new Date().toISOString()
    const tagsJson = tags ? JSON.stringify(tags) : null
    const conversationHistoryJson = conversationHistory ? JSON.stringify(conversationHistory) : '[]'

    // Insert into AppPromptHistory
    await env.vegvisr_org.prepare(`
      INSERT INTO AppPromptHistory (id, user_id, prompt, ai_model, generated_code, app_name, description, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyId, userId, prompt, aiModel, generatedCode, appName || null, description || null, tagsJson, now, now).run()

    // Insert first version into AppVersionHistory (version 1.00)
    const versionId = crypto.randomUUID()
    await env.vegvisr_org.prepare(`
      INSERT INTO AppVersionHistory (id, app_history_id, user_id, version_number, prompt, ai_model, generated_code, conversation_history, is_current, created_at)
      VALUES (?, ?, ?, 1.00, ?, ?, ?, ?, true, ?)
    `).bind(versionId, historyId, userId, prompt, aiModel, generatedCode, conversationHistoryJson, now).run()

    return new Response(JSON.stringify({
      success: true,
      historyId,
      versionId,
      versionNumber: 1.00,
      appName: appName || 'Untitled App',
      message: 'App saved to history successfully'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })


  } catch (error) {
    console.error('Save app to history error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to save app to history: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Get user's app history
 * GET /api/app-history/list?userId=xxx&limit=20&offset=0
 */
export async function getUserAppHistory(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const limit = parseInt(url.searchParams.get('limit')) || 20
    const offset = parseInt(url.searchParams.get('offset')) || 0

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing userId parameter'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin
    const userCheck = await env.vegvisr_org.prepare(
      'SELECT Role FROM config WHERE user_id = ?'
    ).bind(userId).first()

    if (!userCheck || userCheck.Role !== 'Superadmin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Superadmin role required'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const apps = await env.vegvisr_org.prepare(`
      SELECT
        id,
        prompt,
        ai_model,
        app_name,
        description,
        tags,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM AppVersionHistory WHERE app_history_id = AppPromptHistory.id) as version_count
      FROM AppPromptHistory
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all()

    const totalCount = await env.vegvisr_org.prepare(
      'SELECT COUNT(*) as count FROM AppPromptHistory WHERE user_id = ?'
    ).bind(userId).first()

    // Parse tags JSON
    const appsWithParsedTags = apps.results.map(app => ({
      ...app,
      tags: app.tags ? JSON.parse(app.tags) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      apps: appsWithParsedTags,
      total: totalCount.count,
      limit,
      offset
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Get user app history error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to get app history: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Create new version of an existing app
 * POST /api/app-history/new-version
 * Body: { userId, appHistoryId, prompt, aiModel, generatedCode, previousCode }
 */
export async function createAppVersion(request, env) {
  try {
    const { userId, appHistoryId, prompt, aiModel, generatedCode, previousCode, conversationHistory } = await request.json()

    if (!userId || !appHistoryId || !prompt || !aiModel || !generatedCode) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, appHistoryId, prompt, aiModel, generatedCode'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin
    const userCheck = await env.vegvisr_org.prepare(
      'SELECT Role FROM config WHERE user_id = ?'
    ).bind(userId).first()

    if (!userCheck || userCheck.Role !== 'Superadmin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Superadmin role required'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    // Check if app history exists and belongs to user
    const appHistory = await env.vegvisr_org.prepare(
      'SELECT id FROM AppPromptHistory WHERE id = ? AND user_id = ?'
    ).bind(appHistoryId, userId).first()

    if (!appHistory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'App history not found or access denied'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Get next version number
    const lastVersion = await env.vegvisr_org.prepare(
      'SELECT MAX(version_number) as max_version FROM AppVersionHistory WHERE app_history_id = ?'
    ).bind(appHistoryId).first()

    // Calculate next version with minor increments (1.01, 1.02, etc.)
    let nextVersion
    if (!lastVersion.max_version || lastVersion.max_version === 0) {
      nextVersion = 1.01 // First version after initial
    } else {
      // Increment by 0.01
      nextVersion = parseFloat((lastVersion.max_version + 0.01).toFixed(2))
    }

    // Mark all previous versions as not current
    await env.vegvisr_org.prepare(
      'UPDATE AppVersionHistory SET is_current = false WHERE app_history_id = ?'
    ).bind(appHistoryId).run()

    // Insert new version
    const versionId = crypto.randomUUID()
    const now = new Date().toISOString()
    const conversationHistoryJson = conversationHistory ? JSON.stringify(conversationHistory) : '[]'

    await env.vegvisr_org.prepare(`
      INSERT INTO AppVersionHistory (id, app_history_id, user_id, version_number, prompt, ai_model, generated_code, previous_code, conversation_history, is_current, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?)
    `).bind(versionId, appHistoryId, userId, nextVersion, prompt, aiModel, generatedCode, previousCode || null, conversationHistoryJson, now).run()

    // Update AppPromptHistory updated_at timestamp
    await env.vegvisr_org.prepare(
      'UPDATE AppPromptHistory SET updated_at = ? WHERE id = ?'
    ).bind(now, appHistoryId).run()

    return new Response(JSON.stringify({
      success: true,
      versionId,
      versionNumber: nextVersion,
      appHistoryId,
      message: `Version ${nextVersion} created successfully`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Create app version error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to create app version: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Get all versions of a specific app
 * GET /api/app-history/versions?userId=xxx&appHistoryId=xxx
 */
export async function getAppVersions(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const appHistoryId = url.searchParams.get('appHistoryId')

    if (!userId || !appHistoryId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing userId or appHistoryId parameter'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin and owns the app
    const appHistory = await env.vegvisr_org.prepare(
      'SELECT app_name, description FROM AppPromptHistory WHERE id = ? AND user_id = ?'
    ).bind(appHistoryId, userId).first()

    if (!appHistory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'App history not found or access denied'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    const versions = await env.vegvisr_org.prepare(`
      SELECT
        id,
        version_number,
        prompt,
        ai_model,
        generated_code,
        conversation_history,
        is_current,
        created_at
      FROM AppVersionHistory
      WHERE app_history_id = ?
      ORDER BY version_number DESC
    `).bind(appHistoryId).all()

    return new Response(JSON.stringify({
      success: true,
      appName: appHistory.app_name || 'Untitled App',
      description: appHistory.description,
      versions: versions.results
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Get app versions error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to get app versions: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Restore a specific version (make it current)
 * POST /api/app-history/restore-version
 * Body: { userId, appHistoryId, versionId }
 */
export async function restoreAppVersion(request, env) {
  try {
    const { userId, appHistoryId, versionId } = await request.json()

    if (!userId || !appHistoryId || !versionId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, appHistoryId, versionId'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin and owns the app
    const appHistory = await env.vegvisr_org.prepare(
      'SELECT id FROM AppPromptHistory WHERE id = ? AND user_id = ?'
    ).bind(appHistoryId, userId).first()

    if (!appHistory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'App history not found or access denied'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate version exists
    const version = await env.vegvisr_org.prepare(
      'SELECT version_number FROM AppVersionHistory WHERE id = ? AND app_history_id = ?'
    ).bind(versionId, appHistoryId).first()

    if (!version) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Version not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Mark all versions as not current
    await env.vegvisr_org.prepare(
      'UPDATE AppVersionHistory SET is_current = false WHERE app_history_id = ?'
    ).bind(appHistoryId).run()

    // Mark specified version as current
    await env.vegvisr_org.prepare(
      'UPDATE AppVersionHistory SET is_current = true WHERE id = ?'
    ).bind(versionId).run()

    return new Response(JSON.stringify({
      success: true,
      message: `Version ${version.version_number} restored successfully`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Restore app version error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to restore app version: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Delete app and all its versions
 * DELETE /api/app-history/delete
 * Body: { userId, appHistoryId }
 */
export async function deleteAppHistory(request, env) {
  try {
    const { userId, appHistoryId } = await request.json()

    if (!userId || !appHistoryId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, appHistoryId'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Validate user is Superadmin and owns the app
    const appHistory = await env.vegvisr_org.prepare(
      'SELECT app_name FROM AppPromptHistory WHERE id = ? AND user_id = ?'
    ).bind(appHistoryId, userId).first()

    if (!appHistory) {
      return new Response(JSON.stringify({
        success: false,
        error: 'App history not found or access denied'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }

    // Delete all versions (cascade will handle this, but being explicit)
    await env.vegvisr_org.prepare(
      'DELETE FROM AppVersionHistory WHERE app_history_id = ?'
    ).bind(appHistoryId).run()

    // Delete app history
    await env.vegvisr_org.prepare(
      'DELETE FROM AppPromptHistory WHERE id = ?'
    ).bind(appHistoryId).run()

    return new Response(JSON.stringify({
      success: true,
      message: `App "${appHistory.app_name || 'Untitled'}" deleted successfully`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Delete app history error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to delete app history: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
