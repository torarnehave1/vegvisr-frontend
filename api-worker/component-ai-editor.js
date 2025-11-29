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
export async function editComponentWithAI({ componentName, userRequest, env, userId = 'anonymous', includeDocs = false }) {
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
      env,
      includeDocs
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

    // 10. Generate and store component documentation
    const documentation = await generateComponentDocumentation({
      componentName,
      componentCode: aiResult.newCode,
      version: newVersion,
      userId,
      env
    })

    if (documentation.success) {
      // Store documentation in R2
      await env.WEB_COMPONENTS.put(`${componentName}-docs-v${newVersion}.json`, JSON.stringify(documentation.data), {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          componentName,
          version: newVersion.toString(),
          generatedBy: 'ai',
          timestamp: new Date().toISOString()
        }
      })

      // Also update the current documentation
      await env.WEB_COMPONENTS.put(`${componentName}-docs.json`, JSON.stringify(documentation.data), {
        httpMetadata: {
          contentType: 'application/json',
        }
      })
    }

    return {
      success: true,
      newVersion,
      changes: aiResult.changeDescription,
      reasoning: aiResult.reasoning,
      diffUrl: `/api/components/${componentName}/diff/${metadata.current_version}/${newVersion}`,
      documentationGenerated: documentation.success
    }

  } catch (error) {
    console.error('Error editing component:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Extract relevant documentation based on user request and component code
 */
function extractRelevantDocs(docsData, userRequest, componentName, currentCode) {
  const relevantDocs = {
    paths: {},
    externalAPIs: {}
  }

  // Keywords to look for in user request and code
  const requestKeywords = extractKeywords(userRequest.toLowerCase())
  const codeKeywords = extractKeywords(currentCode.toLowerCase())
  const allKeywords = [...new Set([...requestKeywords, ...codeKeywords])]

  // Check each API path for relevance
  if (docsData.paths) {
    Object.entries(docsData.paths).forEach(([path, methods]) => {
      const pathLower = path.toLowerCase()

      // Include if path matches keywords or component name
      const isRelevant = allKeywords.some(keyword =>
        pathLower.includes(keyword) ||
        pathLower.includes(componentName.toLowerCase())
      ) ||
      // Always include component edit endpoint
      pathLower.includes('/api/components/') ||
      // Include if mentioned in user request
      userRequest.toLowerCase().includes(path.toLowerCase())

      if (isRelevant) {
        relevantDocs.paths[path] = methods
      }
    })
  }

  // Include external APIs that are mentioned or used
  const externalAPIs = [
    'https://knowledge.vegvisr.org/saveGraphWithHistory',
    'https://knowledge.vegvisr.org/getknowgraph',
    'https://knowledge.vegvisr.org/getknowgraphs',
    'https://cdnjs.cloudflare.com/ajax/libs/cytoscape'
  ]

  externalAPIs.forEach(api => {
    const apiLower = api.toLowerCase()
    const apiKey = api.split('/').pop() || api

    if (allKeywords.some(keyword => apiLower.includes(keyword)) ||
        currentCode.includes(api) ||
        userRequest.toLowerCase().includes(apiKey.toLowerCase())) {

      if (docsData.paths && docsData.paths[api]) {
        relevantDocs.externalAPIs[api] = docsData.paths[api]
      }
    }
  })

  return Object.keys(relevantDocs.paths).length > 0 || Object.keys(relevantDocs.externalAPIs).length > 0
    ? relevantDocs
    : null
}

/**
 * Extract relevant keywords from text
 */
function extractKeywords(text) {
  const keywords = []

  // API-related keywords
  const apiPatterns = [
    /save[a-z]*/g, /load[a-z]*/g, /fetch[a-z]*/g, /get[a-z]*/g, /post[a-z]*/g,
    /graph[a-z]*/g, /history[a-z]*/g, /version[a-z]*/g, /conflict[a-z]*/g,
    /override[a-z]*/g, /cytoscape[a-z]*/g, /knowledge[a-z]*/g
  ]

  apiPatterns.forEach(pattern => {
    const matches = text.match(pattern) || []
    keywords.push(...matches)
  })

  // URL fragments
  const urls = text.match(/https?:\/\/[^\s'"]+/g) || []
  urls.forEach(url => {
    keywords.push(url)
    // Extract path components
    const pathParts = url.split('/').filter(part => part && part !== 'https:' && part !== 'http:')
    keywords.push(...pathParts)
  })

  return keywords
}

/**
 * Generate improved component code using AI
 */
async function generateImprovedComponent({ currentCode, userRequest, componentName, metadata, env, includeDocs = false }) {
  const client = new OpenAI({
    apiKey: env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  // Fetch API documentation only if requested or if userRequest mentions API/dependencies
  let apiDocumentation = ''
  const needsDocs = includeDocs ||
    /\b(api|endpoint|fetch|save|load|conflict|version|override|dependency|cdn)\b/i.test(userRequest)

  if (needsDocs) {
    try {
      const docsResponse = await fetch('https://api.vegvisr.org/api/docs')
      if (docsResponse.ok) {
        const docsData = await docsResponse.json()

        // Extract relevant documentation based on user request and component
        const relevantDocs = extractRelevantDocs(docsData, userRequest, componentName, currentCode)

        if (relevantDocs) {
          apiDocumentation = `

RELEVANT API DOCUMENTATION:
${JSON.stringify(relevantDocs, null, 2)}

This shows the specific APIs and dependencies relevant to your request.
Pay attention to required parameters, response formats, and usage patterns.
`
        }
      }
    } catch (error) {
      console.log('Could not fetch API documentation:', error.message)
    }
  }

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
- Use the provided API documentation to understand system patterns and dependencies

Component: ${componentName}
Type: ${metadata.description || 'Interactive web component'}

${apiDocumentation}
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

/**
 * Regenerate documentation for an existing component
 * @param {Object} params
 * @param {string} params.componentName - Name of the component
 * @param {Object} params.env - Worker environment bindings
 * @param {string} params.userId - User requesting regeneration
 * @returns {Object} {success, data, error}
 */
export async function regenerateComponentDocumentation({ componentName, env, userId = 'system' }) {
  try {
    // Get current component code
    const componentCode = await getComponentCode(componentName, env)
    if (!componentCode) {
      return { success: false, error: 'Component not found' }
    }

    // Get component metadata
    const metadata = await env.vegvisr_org.prepare(
      'SELECT * FROM web_components WHERE name = ?'
    ).bind(componentName).first()

    if (!metadata) {
      return { success: false, error: 'Component metadata not found' }
    }

    // Generate documentation
    const documentation = await generateComponentDocumentation({
      componentName,
      componentCode,
      version: metadata.current_version,
      userId,
      env
    })

    if (!documentation.success) {
      return documentation
    }

    // Store documentation in R2
    const version = metadata.current_version
    await env.WEB_COMPONENTS.put(`${componentName}-docs-v${version}.json`, JSON.stringify(documentation.data), {
      httpMetadata: {
        contentType: 'application/json',
      },
      customMetadata: {
        componentName,
        version: version.toString(),
        generatedBy: 'ai',
        timestamp: new Date().toISOString()
      }
    })

    // Update current documentation
    await env.WEB_COMPONENTS.put(`${componentName}-docs.json`, JSON.stringify(documentation.data), {
      httpMetadata: {
        contentType: 'application/json',
      }
    })

    return {
      success: true,
      data: documentation.data,
      message: `Documentation regenerated for ${componentName} v${version}`
    }

  } catch (error) {
    return { success: false, error: error.message }
  }
}
async function generateComponentDocumentation({ componentName, componentCode, version, userId, env }) {
  const client = new OpenAI({
    apiKey: env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  })

  const systemPrompt = `You are a technical documentation specialist. Analyze the provided web component code and generate comprehensive, structured documentation in JSON format.

Focus on:
- Extracting all observedAttributes and their usage
- Identifying custom events dispatched by the component
- Finding public methods and their signatures
- Determining dependencies and external libraries
- Understanding the component's purpose and functionality
- Providing practical usage examples

Output only valid JSON with no additional text or formatting.`

  const userPrompt = `Analyze this web component and generate documentation:

Component Name: ${componentName}
Version: ${version}

Component Code:
${componentCode}

Generate a JSON object with this exact structure:
{
  "component": {
    "name": "string",
    "version": "string",
    "description": "string",
    "category": "string",
    "lastUpdated": "ISO date string"
  },
  "attributes": {
    "attributeName": {
      "type": "string (String|Number|Boolean|Object)",
      "required": boolean,
      "default": "any",
      "description": "string"
    }
  },
  "events": {
    "eventName": {
      "description": "string",
      "detail": {
        "propertyName": "type"
      }
    }
  },
  "methods": {
    "methodName": {
      "signature": "string",
      "description": "string",
      "parameters": {
        "paramName": "description"
      },
      "returns": "string"
    }
  },
  "dependencies": ["array of external dependencies"],
  "usage": {
    "basic": "HTML usage example",
    "javascript": "JavaScript integration example"
  },
  "aiGenerated": true,
  "lastAIGeneration": "ISO date string"
}`

  try {
    const response = await client.chat.completions.create({
      model: 'grok-code-fast-1',
      max_tokens: 16384,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })

    const documentationJson = response.choices[0].message.content.trim()

    // Validate JSON
    const documentation = JSON.parse(documentationJson)

    // Ensure required fields
    documentation.aiGenerated = true
    documentation.lastAIGeneration = new Date().toISOString()

    return {
      success: true,
      data: documentation
    }

  } catch (error) {
    console.error('Documentation generation failed:', error)
    return {
      success: false,
      error: `Documentation generation failed: ${error.message}`
    }
  }
}
