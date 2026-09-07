// Enhanced AI Generate Node with multi-model support (improved version)
const handleAIGenerateNodeEnhanced = async (request, env) => {
  try {
    const {
      userRequest,
      graphId,
      username,
      contextType,
      contextData,
      // New parameters from test functions
      preferredModel = 'grok',
      returnType = 'fulltext', // 'fulltext', 'action', 'both', 'enhanced'
      includeBibliography = true,
      includeFollowUp = false,
      temperature = 0.7,
      maxTokens = 4000
    } = await request.json()

    if (!userRequest) {
      return createErrorResponse('Missing userRequest parameter', 400)
    }

    // Multi-model support with fallbacks
    const modelConfig = {
      grok: { apiKey: env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1', model: 'grok-3-beta' },
      gpt4: { apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      gpt5: { apiKey: env.OPENAI_API_KEY, baseURL: 'https://api.openai.com/v1', model: 'gpt-5' },
      gemini: { apiKey: env.GOOGLE_GEMINI_API_KEY, baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
      claude: { apiKey: env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com/v1', model: 'claude-3.5-sonnet' }
    }

    // Try preferred model first, fallback to others
    let selectedConfig = modelConfig[preferredModel]
    if (!selectedConfig?.apiKey) {
      console.log(`Preferred model ${preferredModel} not available, trying fallbacks...`)
      selectedConfig = Object.values(modelConfig).find(config => config.apiKey)
    }

    if (!selectedConfig) {
      return createErrorResponse('No AI models available - missing API keys', 500)
    }

    const client = new OpenAI({
      apiKey: selectedConfig.apiKey,
      baseURL: selectedConfig.baseURL
    })

    // Get templates (reuse existing logic)
    let templates = []
    try {
      const templatesResponse = await env.KNOWLEDGE.fetch('https://knowledge.vegvisr.org/getAITemplates')
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json()
        templates = templatesData.results || []
      }
    } catch (error) {
      console.error('Could not fetch templates:', error)
    }

    // Enhanced context processing (similar to test functions)
    let finalContext = ''
    if (contextType === 'current' && contextData) {
      finalContext = `Current Node Context:\n${JSON.stringify(contextData, null, 2)}`
    } else if (contextType === 'all' && contextData) {
      finalContext = `All Nodes Context:\n${JSON.stringify(contextData, null, 2)}`
    }

    // Process graph context like test functions
    let userMessage = userRequest
    if (finalContext) {
      userMessage = `Context from knowledge graph:\n${finalContext}\n\nRequest: ${userRequest}`
    }

    // Create enhanced prompt combining template and test function approaches
    const systemPrompt = templates.length > 0
      ? `You are an expert at understanding user intent and generating appropriate content for knowledge graphs. Use the provided templates and context to create well-structured responses.

Available Templates:
${templates.map(t => `Template: ${t.label}\nType: ${t.type}\nInstructions: ${t.ai_instructions || 'No specific instructions'}`).join('\n\n')}`
      : 'You are a philosophical AI providing deep insights. Use any provided context to inform your response.'

    // Generate main content
    const completion = await client.chat.completions.create({
      model: selectedConfig.model,
      temperature: temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })

    const responseText = completion.choices[0].message.content.trim()

    // Generate bibliography (from test functions)
    let bibliography = []
    if (includeBibliography) {
      try {
        const biblCompletion = await client.chat.completions.create({
          model: selectedConfig.model,
          temperature: 0.7,
          max_tokens: 500,
          messages: [{
            role: 'system',
            content: 'You are a scholarly AI. Return only 2-3 bibliographic references in APA format, one per line, with no explanations.'
          }, {
            role: 'user',
            content: `Generate references for: ${userRequest}`
          }]
        })
        bibliography = biblCompletion.choices[0].message.content
          .split('\n')
          .filter(ref => ref.trim())
          .map(ref => ref.trim())
      } catch (error) {
        console.error('Bibliography generation failed:', error)
      }
    }

    // Generate follow-up question (from test functions)
    let followUpQuestion = null
    if (includeFollowUp) {
      try {
        const followUpCompletion = await client.chat.completions.create({
          model: selectedConfig.model,
          temperature: 0.8,
          max_tokens: 200,
          messages: [{
            role: 'system',
            content: 'Generate ONE thoughtful follow-up question that would lead to deeper insights. Return ONLY the question.'
          }, {
            role: 'user',
            content: `Previous answer: ${responseText}\n\nGenerate a follow-up question:`
          }]
        })
        followUpQuestion = followUpCompletion.choices[0].message.content.trim()
      } catch (error) {
        console.error('Follow-up generation failed:', error)
      }
    }

    // Handle different return types (from test functions)
    const createNodeResponse = (nodeData) => createResponse(JSON.stringify(nodeData))

    if (returnType === 'action') {
      return createNodeResponse({
        id: `action_${Date.now()}`,
        label: `https://api.vegvisr.org/ai-generate-node`,
        type: 'action_test',
        info: responseText,
        color: '#ffe6cc',
        bibl: bibliography
      })
    }

    if (returnType === 'both') {
      return createNodeResponse({
        type: 'both',
        fulltext: {
          id: `fulltext_${Date.now()}`,
          label: 'Enhanced AI Answer',
          type: 'fulltext',
          info: responseText,
          color: '#f9f9f9',
          bibl: bibliography
        },
        action: followUpQuestion ? {
          id: `action_${Date.now() + 1}`,
          label: 'https://api.vegvisr.org/ai-generate-node',
          type: 'action_test',
          info: followUpQuestion,
          color: '#ffe6cc'
        } : null
      })
    }

    // Enhanced mode - use template-based structure if available
    if (returnType === 'enhanced' && templates.length > 0) {
      // Try to parse structured response or use first template
      let selectedTemplate = templates[0]
      try {
        const structuredResponse = JSON.parse(responseText)
        if (structuredResponse.template) {
          selectedTemplate = templates.find(t => t.id === structuredResponse.template) || templates[0]
        }
      } catch {
        // Use response as-is with first template structure
      }

      const node = {
        id: crypto.randomUUID(),
        label: selectedTemplate.nodes?.label || 'Enhanced AI Node',
        color: selectedTemplate.nodes?.color || '#e6f3ff',
        type: selectedTemplate.nodes?.type || 'enhanced_ai',
        info: responseText,
        bibl: bibliography,
        imageWidth: selectedTemplate.nodes?.imageWidth,
        imageHeight: selectedTemplate.nodes?.imageHeight,
        visible: true,
        path: selectedTemplate.nodes?.path || ''
      }

      return createNodeResponse({ node })
    }

    // Default: fulltext mode (existing behavior)
    const node = {
      id: crypto.randomUUID(),
      label: 'Enhanced AI Node',
      color: '#e6f3ff',
      type: 'enhanced_ai',
      info: responseText,
      bibl: bibliography,
      visible: true
    }

    return createNodeResponse({ node })

  } catch (error) {
    console.error('Error in enhanced AI generate node:', error)
    return createErrorResponse(`AI generation error: ${error.message}`, 500)
  }
}
