// AI Component Editor
// Handles AI-powered component editing with versioning

import OpenAI from 'openai'

/**
 * Edit a web component using AI
 * @param {Object} params
 * @param {string} params.componentName - Name of component to edit
 * @param {string} params.userRequest - What the user wants to change
 * @param {Object} params.env - Worker environment bindings
 * @param {string} params.userId - User making the request
 * @returns {Object} {success, newVersion, changes, error}
 */
export async function editComponentWithAI({ componentName, userRequest, env, userId = 'anonymous' }) {
  try {
    // 1. Get current component from R2
    const currentCode = await getComponentCode(componentName, env)
    if (!currentCode) {
      return { success: false, error: 'Component not found' }
    }

    // 2. Get component metadata from D1
    const metadata = await env.vegvisr_org.prepare(
      'SELECT * FROM web_components WHERE name = ?'
    ).bind(componentName).first()

    if (!metadata) {
      return { success: false, error: 'Component metadata not found' }
    }

    // 3. Use AI to generate improved code
    const aiResult = await generateImprovedComponent({
      currentCode,
      userRequest,
      componentName,
      metadata,
      env
    })

    if (!aiResult.success) {
      return { success: false, error: aiResult.error }
    }

    // 4. Validate the new code
    const validation = validateComponentCode(aiResult.newCode)
    if (!validation.valid) {
      return { success: false, error: `Invalid code: ${validation.error}` }
    }

    // 5. Create new version in R2
    const newVersion = metadata.current_version + 1
    const versionPath = `${componentName}/v${newVersion}_${Date.now()}.js`

    await env.WEB_COMPONENTS.put(versionPath, aiResult.newCode, {
      httpMetadata: {
        contentType: 'application/javascript',
      },
      customMetadata: {
        version: newVersion.toString(),
        editedBy: userId,
        aiModel: aiResult.model,
        timestamp: new Date().toISOString()
      }
    })

    // 6. Update main component file
    await env.WEB_COMPONENTS.put(`${componentName}.js`, aiResult.newCode, {
      httpMetadata: {
        contentType: 'application/javascript',
      }
    })

    // 7. Record version in D1
    await env.vegvisr_org.prepare(`
      INSERT INTO component_versions
      (component_id, version_number, r2_path, change_description, changed_by, ai_model, ai_prompt, code_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      componentName,
      newVersion,
      versionPath,
      aiResult.changeDescription,
      'ai',
      aiResult.model,
      userRequest,
      await hashCode(aiResult.newCode)
    ).run()

    // 8. Update current version
    await env.vegvisr_org.prepare(`
      UPDATE web_components
      SET current_version = ?, updated_at = datetime('now'), r2_path = ?
      WHERE id = ?
    `).bind(newVersion, `${componentName}.js`, componentName).run()

    // 9. Record AI edit
    await env.vegvisr_org.prepare(`
      INSERT INTO component_ai_edits
      (component_id, from_version, to_version, user_request, ai_response, ai_model, success, changes_summary, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      componentName,
      metadata.current_version,
      newVersion,
      userRequest,
      aiResult.reasoning,
      aiResult.model,
      1,
      aiResult.changeDescription,
      userId
    ).run()

    return {
      success: true,
      newVersion,
      changes: aiResult.changeDescription,
      reasoning: aiResult.reasoning,
      diffUrl: `/api/components/${componentName}/diff/${metadata.current_version}/${newVersion}`
    }

  } catch (error) {
    console.error('Error editing component:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Generate improved component code using AI
 */
async function generateImprovedComponent({ currentCode, userRequest, componentName, metadata, env }) {
  const client = new OpenAI({
    apiKey: env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  const systemPrompt = `You are a professional software development assistant specializing in web component architecture and JavaScript programming.

Task: Enhance and improve existing Custom Element web components based on feature requests.
Context: Component library management system for production web applications.

Guidelines:
- Maintain backward compatibility and existing public API
- Follow Web Components standard (Custom Elements v1)
- Use modern ES6+ JavaScript syntax
- Include JSDoc documentation
- Output only executable JavaScript code
- No markdown formatting or explanations

Component: ${componentName}
Type: ${metadata.description || 'Interactive web component'}
`

  const userPrompt = `Current implementation:

${currentCode}

Enhancement request: ${userRequest}

Output the complete enhanced component code.`

  try {
    const response = await client.chat.completions.create({
      model: 'grok-code-fast-1',
      max_tokens: 131072,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })

    const newCode = response.choices[0].message.content
      .replace(/^```javascript\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    // Ask AI to explain the changes
    const explainResponse = await client.chat.completions.create({
      model: 'grok-code-fast-1',
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        { role: 'assistant', content: newCode },
        { role: 'user', content: 'Briefly explain what changes you made (2-3 sentences)' }
      ]
    })

    return {
      success: true,
      newCode,
      changeDescription: explainResponse.choices[0].message.content.trim(),
      reasoning: explainResponse.choices[0].message.content.trim(),
      model: 'grok-code-fast-1'
    }

  } catch (error) {
    return {
      success: false,
      error: `AI generation failed: ${error.message}`
    }
  }
}

/**
 * Get component code from R2
 */
async function getComponentCode(componentName, env) {
  const object = await env.WEB_COMPONENTS.get(`${componentName}.js`)
  if (!object) return null
  return await object.text()
}

/**
 * Validate component code syntax
 */
function validateComponentCode(code) {
  // Cloudflare Workers/V8 may disallow code generation from strings (new Function/eval).
  // Avoid executing code; perform structural/syntactic heuristics instead.
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Code must be a non-empty string' }
  }

  // Heuristic checks for Web Component structure
  const hasClassExtendsHTMLElement = /class\s+\w+\s+extends\s+HTMLElement/.test(code)
  if (!hasClassExtendsHTMLElement) {
    return { valid: false, error: 'Must be a Web Component (class extending HTMLElement)' }
  }

  const hasCustomElementsDefine = /customElements\.define\s*\(/.test(code)
  if (!hasCustomElementsDefine) {
    return { valid: false, error: 'Must call customElements.define()' }
  }

  // Basic sanity: ensure code length is reasonable
  if (code.length < 20) {
    return { valid: false, error: 'Code appears too short to be a valid component' }
  }

  return { valid: true }
}

/**
 * Generate SHA-256 hash of code
 */
async function hashCode(code) {
  const encoder = new TextEncoder()
  const data = encoder.encode(code)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Restore a previous version
 */
export async function restoreComponentVersion({ componentName, versionNumber, env, userId = 'anonymous' }) {
  try {
    // Get version from D1
    const version = await env.vegvisr_org.prepare(
      'SELECT * FROM component_versions WHERE component_id = ? AND version_number = ?'
    ).bind(componentName, versionNumber).first()

    if (!version) {
      return { success: false, error: 'Version not found' }
    }

    // Get code from R2
    const versionCode = await env.WEB_COMPONENTS.get(version.r2_path)
    if (!versionCode) {
      return { success: false, error: 'Version file not found in R2' }
    }

    const code = await versionCode.text()

    // Get current version number
    const metadata = await env.vegvisr_org.prepare(
      'SELECT current_version FROM web_components WHERE id = ?'
    ).bind(componentName).first()

    const newVersion = metadata.current_version + 1

    // Create new version (restoration)
    const restorationPath = `${componentName}/v${newVersion}_restored_from_v${versionNumber}_${Date.now()}.js`

    await env.WEB_COMPONENTS.put(restorationPath, code)
    await env.WEB_COMPONENTS.put(`${componentName}.js`, code)

    // Record restoration
    await env.vegvisr_org.prepare(`
      INSERT INTO component_versions
      (component_id, version_number, r2_path, change_description, changed_by)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      componentName,
      newVersion,
      restorationPath,
      `Restored from version ${versionNumber}`,
      userId
    ).run()

    await env.vegvisr_org.prepare(`
      UPDATE web_components
      SET current_version = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(newVersion, componentName).run()

    return {
      success: true,
      newVersion,
      restoredFrom: versionNumber
    }

  } catch (error) {
    return { success: false, error: error.message }
  }
}
