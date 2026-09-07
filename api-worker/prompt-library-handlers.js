// Prompt Library Handlers
// Save a prompt to the library
export async function savePromptToLibrary(request, env) {
  try {
    const { userId, promptName, promptText, description, category, tags } = await request.json()

    if (!userId || !promptName || !promptText) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, promptName, promptText'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const tagsJson = tags ? JSON.stringify(tags) : null

    const result = await env.vegvisr_org.prepare(`
      INSERT INTO PromptLibrary (user_id, name, prompt_text, description, category, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, promptName, promptText, description, category, tagsJson).run()

    return new Response(JSON.stringify({
      success: true,
      promptId: result.meta.last_row_id
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Save prompt error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Get user's prompt library
export async function getUserPrompts(request, env) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const category = url.searchParams.get('category')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing userId parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let query = `
      SELECT id, name, prompt_text, description, category, tags,
             created_at, updated_at
      FROM PromptLibrary
      WHERE user_id = ?
    `
    const params = [userId]

    if (category) {
      query += ' AND category = ?'
      params.push(category)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { results } = await env.vegvisr_org.prepare(query).bind(...params).all()

    // Parse tags JSON for each prompt
    const prompts = results.map(prompt => ({
      ...prompt,
      tags: prompt.tags ? JSON.parse(prompt.tags) : []
    }))

    return new Response(JSON.stringify({
      success: true,
      prompts
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get prompts error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Load a prompt (increments use count)
export async function loadPrompt(request, env) {
  try {
    const { userId, promptId } = await request.json()

    if (!userId || !promptId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, promptId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get the prompt
    const { results } = await env.vegvisr_org.prepare(`
      SELECT id, name, prompt_text, description, category, tags
      FROM PromptLibrary
      WHERE id = ? AND user_id = ?
    `).bind(promptId, userId).all()

    if (results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Prompt not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const prompt = results[0]
    return new Response(JSON.stringify({
      success: true,
      prompt: {
        ...prompt,
        tags: prompt.tags ? JSON.parse(prompt.tags) : []
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Load prompt error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Delete a prompt from library
export async function deletePrompt(request, env) {
  try {
    const { userId, promptId } = await request.json()

    if (!userId || !promptId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: userId, promptId'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await env.vegvisr_org.prepare(`
      DELETE FROM PromptLibrary
      WHERE id = ? AND user_id = ?
    `).bind(promptId, userId).run()

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Delete prompt error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
