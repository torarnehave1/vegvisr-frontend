/**
 * AI Chat Component
 *
 * A web component for chatting with AI models (Grok, GPT-5, Claude)
 *
 * Features:
 * - Multi-model support (Grok, GPT-5.1, Claude)
 * - Knowledge graph context integration with toggle
 * - Message history with localStorage persistence
 * - Markdown rendering
 * - Export conversation
 * - Responsive design
 *
 * Usage:
 * <ai-chat-component
 *   api-endpoint="https://api.vegvisr.org"
 *   user-id="user@example.com"
 *   graph-id="optional-graph-id"
 *   theme="light">
 * </ai-chat-component>
 *
 * Attributes:
 * - api-endpoint: Base URL for API calls
 * - user-id: User email/identifier
 * - graph-id: Optional knowledge graph ID for context (shows toggle when present)
 * - theme: "light" or "dark"
 * - model: Default model ("grok", "gpt5", "claude")
 *
 * Public Methods:
 * - sendMessage(text) - Send a message programmatically
 * - clearHistory() - Clear chat history
 * - setModel(model) - Change AI model
 * - exportConversation() - Export chat as JSON
 * - setGraphContext(graphId) - Change graph context
 *
 * Events:
 * - messageSent - Fired when user sends a message
 * - responseReceived - Fired when AI responds
 * - modelChanged - Fired when model is changed
 * - graphContextToggled - Fired when graph context is toggled
 * - error - Fired on errors
 */

class AIChatComponent extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // State
    this.messages = []
    this.currentModel = 'grok'
    this.isLoading = false
    this.graphId = null
    this.useGraphContext = false

    // Available models
    this.models = {
      grok: { name: 'Grok 3 Beta', icon: '🤖', color: '#667eea' },
      gpt5: { name: 'GPT-5.1', icon: '🧠', color: '#10a37f' },
      claude: { name: 'Claude 3.5 Sonnet', icon: '🎭', color: '#cc785c' }
    }
  }

  static get observedAttributes() {
    return ['api-endpoint', 'user-id', 'graph-id', 'theme', 'model']
  }

  connectedCallback() {
    console.log('🟢 [AI Chat Component] connectedCallback called')

    // Set graph context if provided
    const graphAttr = this.getAttribute('graph-id')
    console.log('🟢 [AI Chat Component] graph-id attribute:', graphAttr)
    if (graphAttr) {
      this.graphId = graphAttr
      console.log('🟢 [AI Chat Component] graphId set to:', this.graphId)
    }

    this.render()
    this.setupEventListeners()

    // Load saved chat history from localStorage
    this.loadHistory()

    // Set initial model from attribute
    const modelAttr = this.getAttribute('model')
    if (modelAttr && this.models[modelAttr]) {
      this.currentModel = modelAttr
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.shadowRoot.innerHTML) {
      if (name === 'graph-id') {
        this.graphId = newValue
        this.updateGraphContext()
      } else if (name === 'model' && this.models[newValue]) {
        this.setModel(newValue)
      } else if (name === 'theme') {
        this.render()
      }
    }
  }

  render() {
    const theme = this.getAttribute('theme') || 'light'
    const isDark = theme === 'dark'

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          height: 100%;
          --primary-color: ${this.models[this.currentModel].color};
          --bg-color: ${isDark ? '#1a1a1a' : '#ffffff'};
          --text-color: ${isDark ? '#e0e0e0' : '#333'};
          --border-color: ${isDark ? '#333' : '#e0e0e0'};
          --message-user-bg: ${isDark ? '#2d3748' : '#f0f0f0'};
          --message-ai-bg: ${isDark ? '#1e293b' : '#ffffff'};
          --input-bg: ${isDark ? '#2d3748' : '#ffffff'};
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-color);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(135deg, var(--primary-color) 0%, #5568d3 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .model-badge {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn-icon {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 10px;
        }

        .btn-icon:hover {
          background: rgba(255,255,255,0.3);
        }

        .toggle-btn {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .toggle-btn.active {
          background: rgba(255,255,255,0.4);
          border-color: rgba(255,255,255,0.6);
        }

        .toggle-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .graph-badge {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          display: flex;
          gap: 12px;
          max-width: 80%;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message.ai {
          align-self: flex-start;
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .message.user .message-avatar {
          background: linear-gradient(135deg, #667eea 0%, #5568d3 100%);
        }

        .message.ai .message-avatar {
          background: linear-gradient(135deg, var(--primary-color) 0%, #5568d3 100%);
        }

        .message-content {
          flex: 1;
        }

        .message-bubble {
          padding: 12px 16px;
          border-radius: 12px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .message.user .message-bubble {
          background: var(--message-user-bg);
          border-bottom-right-radius: 4px;
        }

        .message.ai .message-bubble {
          background: var(--message-ai-bg);
          border: 1px solid var(--border-color);
          border-bottom-left-radius: 4px;
        }

        .message-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
          padding: 0 4px;
        }

        .message-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          padding: 0 4px;
        }

        .btn-save-to-graph {
          background: #28a745;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .btn-save-to-graph:hover {
          background: #218838;
          transform: translateY(-1px);
        }

        .btn-save-to-graph:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .save-status {
          font-size: 11px;
          color: #28a745;
          padding: 4px 0;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #999;
          text-align: center;
          padding: 40px 20px;
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: var(--text-color);
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        .suggestions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .suggestion {
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestion:hover {
          border-color: var(--primary-color);
          transform: translateY(-2px);
        }

        .input-container {
          padding: 16px 20px;
          background: var(--bg-color);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .input-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .model-selector {
          position: relative;
        }

        .model-button {
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-color);
          transition: all 0.2s;
        }

        .model-button:hover {
          border-color: var(--primary-color);
        }

        .model-dropdown {
          position: absolute;
          bottom: 100%;
          left: 0;
          margin-bottom: 8px;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          min-width: 200px;
          display: none;
          z-index: 1000;
        }

        .model-dropdown.show {
          display: block;
        }

        .model-option {
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.2s;
        }

        .model-option:hover {
          background: rgba(102, 126, 234, 0.1);
        }

        .model-option.active {
          background: rgba(102, 126, 234, 0.15);
          font-weight: 600;
        }

        .model-option:first-child {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }

        .model-option:last-child {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }

        .input-field {
          flex: 1;
          min-height: 44px;
          max-height: 120px;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--input-bg);
          color: var(--text-color);
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
        }

        .input-field:focus {
          border-color: var(--primary-color);
        }

        .send-button {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
        }

        .loading-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary-color);
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .error-message {
          background: #fee;
          border: 1px solid #fcc;
          color: #c00;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 8px 0;
          font-size: 14px;
        }

        .graph-badge {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .markdown-content p {
          margin: 8px 0;
        }

        .markdown-content code {
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'Monaco', 'Menlo', monospace;
        }

        .markdown-content pre {
          background: rgba(0,0,0,0.1);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 8px 0;
        }

        .markdown-content pre code {
          background: none;
          padding: 0;
        }
      </style>

      <div class="container">
        <div class="header">
          <div class="header-left">
            <h1>💬 AI Chat</h1>
            <div class="model-badge">
              🤖 Grok 3
            </div>
            ${this.graphId && this.useGraphContext ? '<div class="graph-badge">📊 Context: ON</div>' : ''}
          </div>
          <div class="header-actions">
            ${this.graphId ? `
              <button class="btn toggle-btn ${this.useGraphContext ? 'active' : ''}" id="graphToggleBtn" title="Toggle Knowledge Graph Context">
                📊 Graph Context ${this.useGraphContext ? 'ON' : 'OFF'}
              </button>
            ` : ''}
            <button class="btn btn-icon" id="refreshBtn" title="Refresh Component">
              🔄
            </button>
            <button class="btn btn-icon" id="exportBtn" title="Export Conversation">
              📥
            </button>
            <button class="btn btn-icon" id="clearBtn" title="Clear History">
              🗑️
            </button>
          </div>
        </div>

        <div class="messages-container" id="messagesContainer">
          ${this.messages.length === 0 ? this.renderEmptyState() : this.renderMessages()}
        </div>

        <div class="input-container">
          <div class="input-wrapper">
            <textarea
              class="input-field"
              id="messageInput"
              placeholder="Type your message..."
              rows="1"
            ></textarea>

            <button class="send-button" id="sendButton" ${this.isLoading ? 'disabled' : ''}>
              ${this.isLoading ? '<div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>' : '✨ Send'}
            </button>
          </div>
        </div>
      </div>
    `

    this.updateMessagesScroll()
    this.setupEventListeners()
  }

  renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🤖</div>
        <h3>Start a conversation</h3>
        <p>Ask me anything!</p>
        <div class="suggestions">
          <div class="suggestion" data-prompt="Explain quantum computing in simple terms">
            Explain quantum computing
          </div>
          <div class="suggestion" data-prompt="What are the benefits of knowledge graphs?">
            Benefits of knowledge graphs
          </div>
          <div class="suggestion" data-prompt="Help me brainstorm ideas for my project">
            Brainstorm ideas
          </div>
        </div>
      </div>
    `
  }

  renderMessages() {
    const lastAiMessageIndex = this.messages.map((m, i) => ({ m, i }))
      .reverse()
      .find(({m}) => m.role === 'assistant')?.i

    return this.messages.map((msg, index) => `
      <div class="message ${msg.role}">
        <div class="message-avatar">
          ${msg.role === 'user' ? '👤' : this.models[msg.model || this.currentModel].icon}
        </div>
        <div class="message-content">
          <div class="message-bubble">
            <div class="markdown-content">
              ${this.renderMarkdown(msg.content)}
            </div>
          </div>
          <div class="message-time">${msg.timestamp}</div>
          ${msg.role === 'assistant' && index === lastAiMessageIndex && this.graphId ? `
            <div class="message-actions">
              <button class="btn-save-to-graph" data-message-index="${index}" ${msg.savedToGraph ? 'disabled' : ''}>
                ${msg.savedToGraph ? '✅ Saved to Graph' : '💾 Save to Graph'}
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('')
  }

  renderMarkdown(text) {
    // Simple markdown rendering (can be enhanced with a proper library)
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
  }

  setupEventListeners() {
    console.log('🟢 [AI Chat] Setting up event listeners')
    const sendButton = this.shadowRoot.getElementById('sendButton')
    const messageInput = this.shadowRoot.getElementById('messageInput')
    const clearBtn = this.shadowRoot.getElementById('clearBtn')
    const exportBtn = this.shadowRoot.getElementById('exportBtn')
    const modelButton = this.shadowRoot.getElementById('modelButton')
    const modelDropdown = this.shadowRoot.getElementById('modelDropdown')

    // Send message
    sendButton?.addEventListener('click', () => {
      console.log('🟢 [AI Chat] Send button clicked')
      this.handleSendMessage()
    })

    // Enter to send, Shift+Enter for new line
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log('🟢 [AI Chat] Enter key pressed')
        e.preventDefault()
        this.handleSendMessage()
      }
    })

    // Auto-resize textarea
    messageInput?.addEventListener('input', (e) => {
      e.target.style.height = 'auto'
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    })

    // Clear history
    clearBtn?.addEventListener('click', () => this.clearHistory())

    // Refresh component
    const refreshBtn = this.shadowRoot.getElementById('refreshBtn')
    refreshBtn?.addEventListener('click', () => {
      const userId = this.getAttribute('user-id') || 'demo-user'
      const storageKey = `ai-chat-history-${userId}`
      localStorage.removeItem(storageKey)
      this.messages = []
      this.render()
    })

    // Export conversation
    exportBtn?.addEventListener('click', () => this.exportConversation())

    // Save to graph buttons
    const saveButtons = this.shadowRoot.querySelectorAll('.btn-save-to-graph')
    saveButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const messageIndex = parseInt(e.target.getAttribute('data-message-index'))
        this.saveMessageToGraph(messageIndex)
      })
    })

    // Graph context toggle
    const graphToggleBtn = this.shadowRoot.getElementById('graphToggleBtn')
    graphToggleBtn?.addEventListener('click', () => {
      console.log('🔵 [Graph Toggle] Button clicked!')
      console.log('🔵 [Graph Toggle] Current state:', this.useGraphContext ? 'ON' : 'OFF')
      console.log('🔵 [Graph Toggle] Graph ID:', this.graphId)

      this.useGraphContext = !this.useGraphContext

      console.log('🔵 [Graph Toggle] New state:', this.useGraphContext ? 'ON' : 'OFF')
      console.log('🔵 [Graph Toggle] Will use endpoint:', this.useGraphContext ? '/user-ai-chat' : '/simple-chat')

      this.render()

      // Dispatch event
      this.dispatchEvent(new CustomEvent('graphContextToggled', {
        detail: { enabled: this.useGraphContext, graphId: this.graphId }
      }))
    })

    // Model selector
    modelButton?.addEventListener('click', (e) => {
      e.stopPropagation()
      modelDropdown.classList.toggle('show')
    })

    // Model options
    this.shadowRoot.querySelectorAll('.model-option').forEach(option => {
      option.addEventListener('click', () => {
        const model = option.dataset.model
        this.setModel(model)
        modelDropdown.classList.remove('show')
      })
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      modelDropdown?.classList.remove('show')
    })

    // Suggestion prompts
    this.shadowRoot.querySelectorAll('.suggestion').forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        const prompt = suggestion.dataset.prompt
        messageInput.value = prompt
        this.handleSendMessage()
      })
    })
  }

  async handleSendMessage() {
    console.log('🟢 [AI Chat] handleSendMessage called')
    const input = this.shadowRoot.getElementById('messageInput')
    const message = input.value.trim()

    console.log('🟢 [AI Chat] Message:', message)
    console.log('🟢 [AI Chat] isLoading:', this.isLoading)

    if (!message || this.isLoading) {
      console.log('🔴 [AI Chat] Blocked - empty message or already loading')
      return
    }

    // Add user message
    console.log('🟢 [AI Chat] Adding user message to array')
    this.addMessage('user', message)
    input.value = ''
    input.style.height = 'auto'

    // Set loading state
    this.isLoading = true
    console.log('🟢 [AI Chat] Set loading state, re-rendering')
    this.render()

    try {
      // Send to AI
      console.log('🟢 [AI Chat] Calling AI...')
      const response = await this.callAI(message)
      console.log('🟢 [AI Chat] Got AI response:', response)

      // Add AI response
      console.log('🟢 [AI Chat] Adding AI response to messages')
      this.addMessage('ai', response)

      this.dispatchEvent(new CustomEvent('responseReceived', {
        detail: { message: response, model: this.currentModel }
      }))
    } catch (error) {
      console.error('🔴 [AI Chat] ERROR:', error)
      console.error('🔴 [AI Chat] Error stack:', error.stack)
      this.showError(error.message || 'Failed to get AI response')

      this.dispatchEvent(new CustomEvent('error', {
        detail: { error: error.message }
      }))
    } finally {
      console.log('🟢 [AI Chat] Finally block - clearing loading state')
      this.isLoading = false
      this.render()

      // Focus input
      setTimeout(() => {
        this.shadowRoot.getElementById('messageInput')?.focus()
      }, 100)
    }
  }

  async callAI(userMessage) {
    const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
    const userId = this.getAttribute('user-id') || 'anonymous'

    console.log('🟢 [AI Chat] callAI - apiEndpoint:', apiEndpoint)
    console.log('🟢 [AI Chat] callAI - userId:', userId)
    console.log('🟢 [AI Chat] callAI - useGraphContext:', this.useGraphContext)
    console.log('🟢 [AI Chat] callAI - graphId:', this.graphId)

    if (this.graphId && this.useGraphContext) {
      console.log('📊 [AI Chat] GRAPH CONTEXT ENABLED - Using graph:', this.graphId)
      console.log('📊 [AI Chat] Will call /user-ai-chat endpoint with graph_id parameter')
    } else if (this.graphId && !this.useGraphContext) {
      console.log('⚪ [AI Chat] Graph available but CONTEXT DISABLED - Using simple chat')
    } else {
      console.log('⚪ [AI Chat] No graph context - Using simple chat')
    }

    console.log('🟢 [AI Chat] callAI - messages in history:', this.messages.length)

    // Build messages array with history (user message already added to this.messages)
    const messages = this.messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))

    console.log('🟢 [AI Chat] callAI - sending messages:', JSON.stringify(messages, null, 2))

    // Use user-ai-chat endpoint if graph context is enabled, otherwise simple-chat
    const endpoint = (this.useGraphContext && this.graphId) ? 'user-ai-chat' : 'simple-chat'
    const url = `${apiEndpoint}/${endpoint}`
    console.log('🟢 [AI Chat] callAI - fetching:', url, '(endpoint:', endpoint, ')')

    // Build request body
    const requestBody = { messages }
    if (this.useGraphContext && this.graphId) {
      requestBody.graph_id = this.graphId
      requestBody.userEmail = userId
      console.log('🟢 [AI Chat] callAI - including graph_id:', this.graphId)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('🟢 [AI Chat] callAI - response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🔴 [AI Chat] callAI - API error:', response.status, errorText)
      throw new Error(`AI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('🟢 [AI Chat] callAI - response data:', data)

    if (!data.success || !data.message) {
      console.error('🔴 [AI Chat] callAI - invalid response:', data)
      throw new Error('Invalid response from AI')
    }

    console.log('🟢 [AI Chat] callAI - returning message')
    return data.message
  }

  addMessage(role, content) {
    console.log('🟢 [AI Chat] addMessage - role:', role, 'content length:', content.length)
    const message = {
      role,
      content,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      model: this.currentModel
    }

    this.messages.push(message)
    console.log('🟢 [AI Chat] addMessage - total messages now:', this.messages.length)
    this.saveHistory()
    this.render()

    if (role === 'user') {
      this.dispatchEvent(new CustomEvent('messageSent', {
        detail: { message: content }
      }))
    }
  }

  showError(message) {
    const container = this.shadowRoot.getElementById('messagesContainer')
    const errorDiv = document.createElement('div')
    errorDiv.className = 'error-message'
    errorDiv.textContent = `❌ ${message}`
    container.appendChild(errorDiv)

    setTimeout(() => errorDiv.remove(), 5000)
  }

  setModel(model) {
    if (this.models[model]) {
      const oldModel = this.currentModel
      this.currentModel = model
      this.render()

      this.dispatchEvent(new CustomEvent('modelChanged', {
        detail: { oldModel, newModel: model }
      }))
    }
  }

  clearHistory() {
    if (confirm('Clear all chat history?')) {
      this.messages = []
      this.saveHistory()
      this.render()
    }
  }

  exportConversation() {
    const data = {
      model: this.currentModel,
      graphId: this.graphId,
      messages: this.messages,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async saveMessageToGraph(messageIndex) {
    const message = this.messages[messageIndex]
    if (!message || message.role !== 'assistant') return
    if (!this.graphId) {
      console.error('❌ No graph ID available')
      return
    }

    console.log('💾 [Save to Graph] Saving message:', messageIndex)
    console.log('💾 [Save to Graph] Graph ID:', this.graphId)

    try {
      // Generate UUID for new node
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0
          const v = c == 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      }

      // First, fetch current graph data
      const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
      const fetchResponse = await fetch(`${apiEndpoint}/knowledge-graph/${this.graphId}`)

      if (!fetchResponse.ok) {
        throw new Error('Failed to fetch graph data')
      }

      const graphResponse = await fetchResponse.json()
      const currentGraphData = JSON.parse(graphResponse.data)

      console.log('💾 [Save to Graph] Current graph has', currentGraphData.nodes?.length || 0, 'nodes')

      // Create new fulltext node
      const newNode = {
        id: generateUUID(),
        label: 'AI Chat Response',
        color: '#e3f2fd',
        type: 'fulltext',
        info: message.content,
        bibl: ['AI Generated', new Date().toISOString()],
        visible: true,
        position: { x: 0, y: 0 }
      }

      // Add new node to graph data
      const updatedGraphData = {
        ...currentGraphData,
        nodes: [...(currentGraphData.nodes || []), newNode],
        edges: currentGraphData.edges || []
      }

      console.log('💾 [Save to Graph] Saving updated graph with', updatedGraphData.nodes.length, 'nodes')

      // Save to backend with override: true
      const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.graphId,
          graphData: updatedGraphData,
          override: true
        })
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        throw new Error(`Save failed: ${saveResponse.status} - ${errorText}`)
      }

      const result = await saveResponse.json()
      console.log('✅ [Save to Graph] Success:', result)

      // Mark message as saved
      this.messages[messageIndex].savedToGraph = true
      this.saveHistory()
      this.render()

      // Dispatch event
      this.dispatchEvent(new CustomEvent('messageSavedToGraph', {
        detail: { messageIndex, nodeId: newNode.id, graphId: this.graphId }
      }))

    } catch (error) {
      console.error('❌ [Save to Graph] Error:', error)
      alert(`Failed to save to graph: ${error.message}`)
    }
  }

  saveHistory() {
    try {
      const key = `ai-chat-history-${this.getAttribute('user-id') || 'default'}`
      localStorage.setItem(key, JSON.stringify(this.messages))
    } catch (error) {
      console.error('Failed to save chat history:', error)
    }
  }

  loadHistory() {
    try {
      const key = `ai-chat-history-${this.getAttribute('user-id') || 'default'}`
      const saved = localStorage.getItem(key)
      if (saved) {
        this.messages = JSON.parse(saved)
        this.render()
      }
    } catch (error) {
      console.error('Failed to load chat history:', error)
    }
  }

  updateMessagesScroll() {
    setTimeout(() => {
      const container = this.shadowRoot.getElementById('messagesContainer')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }, 100)
  }

  updateGraphContext() {
    this.render()
  }

  // Public API methods
  sendMessage(text) {
    const input = this.shadowRoot.getElementById('messageInput')
    if (input) {
      input.value = text
      this.handleSendMessage()
    }
  }

  setGraphContext(graphId) {
    this.graphId = graphId
    this.updateGraphContext()
  }
}

// Register the custom element
customElements.define('ai-chat-component', AIChatComponent)
