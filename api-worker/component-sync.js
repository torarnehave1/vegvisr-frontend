/**
 * Component Sync Utility
 * Syncs web_components table to apiForApps table
 * This ensures AppBuilder sees the latest components from Component Manager
 */

export async function syncComponentsToAPIRegistry(env) {
  try {
    console.log('🔄 Starting component sync: web_components → apiForApps')

    // Get all active components from web_components table
    const componentsStmt = env.vegvisr_org.prepare(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.category,
        c.tags,
        c.r2_path,
        c.current_version,
        c.status,
        c.created_at,
        c.updated_at,
        (SELECT COUNT(*) FROM component_versions WHERE component_id = c.id) as version_count
      FROM web_components c
      WHERE status = 'active'
      ORDER BY updated_at DESC
    `)

    const { results: components } = await componentsStmt.all()

    console.log(`📦 Found ${components.length} active components to sync`)

    let syncedCount = 0
    let updatedCount = 0
    let errorCount = 0

    for (const comp of components) {
      try {
        // Check if component already exists in apiForApps
        const checkStmt = env.vegvisr_org.prepare(`
          SELECT id, updated_at
          FROM apiForApps
          WHERE slug = ? AND capability_type = 'component'
        `).bind(comp.slug)

        const existing = await checkStmt.first()

        const cdnUrl = `https://api.vegvisr.org/components/${comp.slug}.js`
        const docsUrl = `https://api.vegvisr.org/api/components/${comp.slug}`
        const exampleCode = `<script src="${cdnUrl}"></script>\n<${comp.slug}></${comp.slug}>`

        if (existing) {
          // Update existing entry
          const updateStmt = env.vegvisr_org.prepare(`
            UPDATE apiForApps
            SET
              name = ?,
              description = ?,
              category = ?,
              cdn_url = ?,
              docs_url = ?,
              example_code = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            comp.name,
            comp.description,
            comp.category || 'components',
            cdnUrl,
            docsUrl,
            exampleCode,
            comp.status,
            existing.id
          )

          await updateStmt.run()
          updatedCount++
          console.log(`✅ Updated: ${comp.name}`)
        } else {
          // Insert new entry
          const insertStmt = env.vegvisr_org.prepare(`
            INSERT INTO apiForApps (
              name,
              slug,
              description,
              category,
              capability_type,
              cdn_url,
              docs_url,
              example_code,
              status,
              is_enabled_by_default,
              requires_auth,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, 'component', ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(
            comp.name,
            comp.slug,
            comp.description,
            comp.category || 'components',
            cdnUrl,
            docsUrl,
            exampleCode,
            comp.status
          )

          await insertStmt.run()
          syncedCount++
          console.log(`✨ Created: ${comp.name}`)
        }
      } catch (error) {
        console.error(`❌ Error syncing ${comp.name}:`, error.message)
        errorCount++
      }
    }

    const summary = {
      total: components.length,
      created: syncedCount,
      updated: updatedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    }

    console.log('🎉 Sync complete:', summary)

    return new Response(JSON.stringify({
      success: true,
      message: `Synced ${components.length} components (${syncedCount} created, ${updatedCount} updated)`,
      ...summary
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('❌ Sync failed:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
