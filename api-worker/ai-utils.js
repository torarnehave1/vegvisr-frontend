// Shared AI utilities extracted from test functions
export class AIUtils {

  static createClient(provider, apiKey) {
    const configs = {
      grok: { baseURL: 'https://api.x.ai/v1', model: 'grok-3-beta' },
      openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4' },
      gpt5: { baseURL: 'https://api.openai.com/v1', model: 'gpt-5' },
      gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
      claude: { baseURL: 'https://api.anthropic.com/v1', model: 'claude-3.5-sonnet' }
    }

    const config = configs[provider] || configs.grok
    return new OpenAI({
      apiKey: apiKey,
      baseURL: config.baseURL
    }), config.model
  }

  static processGraphContext(prompt, graphContext) {
    if (graphContext && graphContext.trim()) {
      return `Context from knowledge graph:\n${graphContext}\n\nQuestion: ${prompt}`
    }
    return prompt
  }

  static async generateBibliography(client, model, topic) {
    const biblCompletion = await client.chat.completions.create({
      model: model,
      temperature: 0.7,
      max_tokens: 500,
      messages: [{
        role: 'system',
        content: 'You are a scholarly AI. Return only 2-3 bibliographic references in APA format (e.g., "Author, A. A. (Year). Title of work. Publisher."), one per line, with no explanations, headings, or additional text.'
      }, {
        role: 'user',
        content: `Generate references for the topic: ${topic}`
      }]
    })

    return biblCompletion.choices[0].message.content
      .split('\n')
      .filter(ref => ref.trim())
      .map(ref => ref.trim())
  }

  static async generateFollowUp(client, model, responseText) {
    const followUpCompletion = await client.chat.completions.create({
      model: model,
      temperature: 0.8,
      max_tokens: 200,
      messages: [{
        role: 'system',
        content: 'You are a philosophical AI. Based on the previous answer, generate ONE thoughtful follow-up question that would lead to deeper insights. Return ONLY the question, no explanations.'
      }, {
        role: 'user',
        content: `Previous answer: ${responseText}\n\nGenerate a follow-up question:`
      }]
    })

    return followUpCompletion.choices[0].message.content.trim()
  }

  static createNode(type, content, options = {}) {
    const nodeTypes = {
      fulltext: {
        color: '#f9f9f9',
        defaultLabel: 'AI Answer'
      },
      action: {
        color: '#ffe6cc',
        defaultLabel: 'https://api.vegvisr.org/ai-action'
      },
      enhanced: {
        color: '#e6f3ff',
        defaultLabel: 'Enhanced AI Node'
      }
    }

    const nodeConfig = nodeTypes[type] || nodeTypes.fulltext

    return {
      id: options.id || `${type}_${Date.now()}`,
      label: options.label || nodeConfig.defaultLabel,
      type: type,
      info: content,
      color: options.color || nodeConfig.color,
      bibl: options.bibl || [],
      imageWidth: options.imageWidth,
      imageHeight: options.imageHeight,
      visible: true,
      path: options.path || ''
    }
  }

  static async generateMultiFormat(client, model, prompt, graphContext, options = {}) {
    const userMessage = this.processGraphContext(prompt, graphContext)

    // Generate main content
    const completion = await client.chat.completions.create({
      model: model,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4000,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || (graphContext
            ? 'You are a philosophical AI providing deep insights. Use the provided knowledge graph context to inform your response when relevant, but focus on answering the specific question asked.'
            : 'You are a philosophical AI providing deep insights.')
        },
        { role: 'user', content: userMessage }
      ]
    })

    const responseText = completion.choices[0].message.content.trim()

    // Generate bibliography if requested
    let bibliography = []
    if (options.includeBibliography) {
      bibliography = await this.generateBibliography(client, model, prompt)
    }

    // Generate follow-up if requested
    let followUp = null
    if (options.includeFollowUp) {
      followUp = await this.generateFollowUp(client, model, responseText)
    }

    return {
      content: responseText,
      bibliography,
      followUp
    }
  }
}
