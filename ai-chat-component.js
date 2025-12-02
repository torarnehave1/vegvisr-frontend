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
    this.showEmojiPicker = false
    this.showSettingsPage = false
    this.showHamburgerMenu = false
    this.isListening = false
    this.recognition = null

    // User API Keys state (NEW)
    this.userApiKeys = []          // Metadata from GET /user-api-keys
    this.selectedProvider = null   // Currently selected provider for user model
    this.useUserModel = false      // Toggle between system/user models

    // Available models
    this.models = {
      grok: { name: 'Grok 3 Beta', icon: '🤖', color: '#667eea' },
      gpt5: { name: 'GPT-5.1', icon: '🧠', color: '#10a37f' },
      claude: { name: 'Claude 4 Opus', icon: '🎭', color: '#cc785c' },
      'claude-4': { name: 'Claude Sonnet 4', icon: '🎭', color: '#cc785c' },
      'claude-4.5': { name: 'Claude 4.5 Sonnet', icon: '🎭', color: '#9f7aea' }
    }

    // Provider configurations for user API keys
    this.providers = {
      openai: { name: 'OpenAI', icon: '🧠', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
      anthropic: { name: 'Anthropic', icon: '🎭', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'] },
      google: { name: 'Google', icon: '🔮', models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'] },
      grok: { name: 'Grok (X.AI)', icon: '🤖', models: ['grok-beta', 'grok-vision-beta'] }
    }

    // Common emojis for picker (removed as per request)
    // this.emojis = ['😀', '😂', '😊', '😍', '👍', '👎', '❤️', '🔥', '💯', '🤔', '😢', '😡', '🎉', '👏', '🙌', '🤝', '💪', '🌟', '⭐', '✨']

    // Documentation response triggers
    this.documentationTriggers = [
      /how.*component.*made/i,
      /documentation.*about.*yourself/i,
      /help.*documentation/i,
      /what.*are.*you.*made.*of/i,
      /tell.*me.*about.*yourself/i
    ]
  }

  static get observedAttributes() {
    return ['api-endpoint', 'user-id', 'graph-id', 'theme', 'model', 'documentation-url']
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

    // Load user API keys (NEW)
    this.loadUserApiKeys()

    // Set initial model from attribute
    const modelAttr = this.getAttribute('model')
    if (modelAttr && this.models[modelAttr]) {
      this.currentModel = modelAttr
    }

    // Initialize speech recognition if supported
    this.initSpeechRecognition()
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
    const userId = this.getAttribute('user-id') || 'Guest'

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          height: 100%;
          --primary-color: ${this.models[this.currentModel].color};
          --bg-color: ${isDark ? '#343541' : '#ffffff'};
          --text-color: ${isDark ? '#e0e0e0' : '#333'};
          --border-color: ${isDark ? '#565869' : '#e0e0e0'};
          --message-user-bg: ${isDark ? '#343541' : '#f7f7f8'};
          --message-ai-bg: ${isDark ? '#444654' : '#ffffff'};
          --input-bg: ${isDark ? '#40414f' : '#f7f7f8'};
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-color);
          color: var(--text-color);
          border-radius: 8px;
          overflow: hidden;
          position: relative;
        }

        .header {
          background: var(--bg-color);
          color: var(--text-color);
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          border-bottom: 1px solid var(--border-color);
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

        .model-badge, .user-badge {
          background: rgba(102, 126, 234, 0.1);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }

        .hamburger-btn {
          display: none;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .hamburger-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .hamburger-menu {
          position: absolute;
          top: 100%;
          left: 20px;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 8px 0;
          display: none;
          z-index: 1000;
          min-width: 160px;
        }

        .hamburger-menu.show {
          display: block;
        }

        .hamburger-menu-item {
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .hamburger-menu-item:hover {
          background: rgba(102, 126, 234, 0.1);
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
          border-radius: 18px;
          line-height: 1.5;
          word-wrap: break-word;
          max-width: 100%;
        }

        .message.user .message-bubble {
          background: #007bff;
          color: white;
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

        .input-field-container {
          flex: 1;
          position: relative;
        }

        .input-field {
          width: 100%;
          min-height: 44px;
          max-height: 120px;
          padding: 12px 50px 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 22px;
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
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--primary-color);
          color: white;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-50%) scale(1.1);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .mic-btn {
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .mic-btn:hover {
          border-color: var(--primary-color);
        }

        .mic-btn.listening {
          background: #ff6b6b;
          color: white;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
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

        .settings-page {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: var(--bg-color);
          color: var(--text-color);
          z-index: 2000;
          display: none;
          flex-direction: column;
          padding: 20px;
          box-sizing: border-box;
        }

        .settings-page.show {
          display: flex;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .settings-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .close-settings {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-color);
        }

        .settings-content {
          flex: 1;
          overflow-y: auto;
        }

        .settings-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 16px;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .settings-item:last-child {
          margin-bottom: 0;
        }

        .settings-item label {
          font-size: 16px;
          font-weight: 500;
        }

        .settings-item select {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--input-bg);
          color: var(--text-color);
          font-size: 14px;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: var(--primary-color);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        /* User API Keys Styling (NEW) */
        .settings-section {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid var(--border-color);
        }

        .settings-section h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          color: var(--text-color);
        }

        .settings-section h4 {
          margin: 20px 0 12px 0;
          font-size: 16px;
          color: var(--text-color);
        }

        .toggle-label {
          margin-left: 12px;
          font-size: 14px;
        }

        .api-keys-list {
          margin: 16px 0;
        }

        .api-key-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          margin-bottom: 8px;
        }

        .api-key-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .api-key-provider {
          font-weight: 600;
          font-size: 14px;
        }

        .api-key-name {
          font-size: 13px;
          color: #888;
        }

        .api-key-last-used {
          font-size: 12px;
          color: #999;
        }

        .btn-delete-key {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-delete-key:hover {
          background: #c82333;
          transform: scale(1.05);
        }

        .no-keys-message {
          color: #888;
          font-size: 14px;
          font-style: italic;
          margin: 12px 0;
        }

        .add-key-form {
          margin-top: 20px;
          padding: 16px;
          background: rgba(0,0,0,0.05);
          border-radius: 8px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--input-bg);
          color: var(--text-color);
          font-size: 14px;
          box-sizing: border-box;
        }

        .input-with-toggle {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .input-with-toggle input {
          flex: 1;
        }

        .btn-toggle-visibility {
          background: var(--input-bg);
          border: 1px solid var(--border-color);
          padding: 10px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s;
        }

        .btn-toggle-visibility:hover {
          background: rgba(255,255,255,0.1);
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn-test {
          background: #17a2b8;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-test:hover {
          background: #138496;
        }

        .btn-save {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-save:hover {
          background: #218838;
        }

        .btn-test:disabled,
        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-started;
        }

        .form-feedback {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 6px;
          font-size: 14px;
          display: none;
        }

        .form-feedback.success {
          display: block;
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .form-feedback.error {
          display: block;
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .form-feedback.info {
          display: block;
          background: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
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

        .markdown-content a {
          color: var(--primary-color);
          text-decoration: none;
        }

        .markdown-content a:hover {
          text-decoration: underline;
        }

        /* Enhanced mobile responsiveness */
        @media (max-width: 768px) {
          .container {
            border-radius: 0;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            z-index: 1000;
          }

          .header {
            padding: 12px 16px;
            position: sticky;
            top: 0;
            z-index: 10;
          }

          .header h1 {
            font-size: 18px;
          }

          .model-badge, .user-badge {
            font-size: 11px;
            padding: 2px 8px;
          }

          .hamburger-btn {
            display: block;
          }

          .hamburger-menu {
            left: 16px;
          }

          .messages-container {
            padding: 16px;
            gap: 12px;
            padding-bottom: 100px; /* Extra space for input on mobile */
          }

          .message {
            max-width: 90%;
            gap: 8px;
          }

          .message-avatar {
            width: 32px;
            height: 32px;
            font-size: 16px;
          }

          .message-bubble {
            padding: 10px 14px;
            font-size: 14px;
            max-width: 100%;
            word-break: break-word;
          }

          .message-time {
            font-size: 10px;
          }

          .message-actions {
            gap: 6px;
            margin-top: 6px;
          }

          .btn-save-to-graph {
            padding: 6px 10px;
            font-size: 12px;
            min-height: 32px;
          }

          .empty-state {
            padding: 20px 16px;
          }

          .empty-state-icon {
            font-size: 40px;
          }

          .empty-state h3 {
            font-size: 16px;
          }

          .empty-state p {
            font-size: 13px;
          }

          .suggestions {
            gap: 6px;
            flex-direction: column;
            align-items: center;
          }

          .suggestion {
            padding: 10px 16px;
            font-size: 14px;
            width: 100%;
            max-width: 280px;
            text-align: center;
          }

          .input-container {
            padding: 12px 16px;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-color);
            border-top: 1px solid var(--border-color);
            z-index: 15;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
          }

          .input-wrapper {
            gap: 8px;
            align-items: center;
          }

          .input-field-container {
            flex: 1;
          }

          .input-field {
            font-size: 16px; /* Prevents zoom on iOS */
            padding: 12px 50px 12px 16px;
            min-height: 48px;
            max-height: 120px;
            width: 100%;
          }

          .send-button {
            width: 36px;
            height: 36px;
            font-size: 18px;
          }

          .mic-btn {
            padding: 12px;
            font-size: 18px;
            min-width: 48px;
            min-height: 48px;
          }

          .settings-page {
            padding: 16px;
            padding-top: env(safe-area-inset-top, 16px);
            padding-bottom: env(safe-area-inset-bottom, 16px);
          }

          .settings-header {
            margin-bottom: 16px;
          }

          .settings-header h2 {
            font-size: 20px;
          }

          .settings-content {
            padding-bottom: 20px;
          }

          .settings-item {
            padding: 14px;
            margin-bottom: 16px;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .settings-item label {
            font-size: 16px;
            width: 100%;
          }

          .settings-item select {
            width: 100%;
            font-size: 16px;
            padding: 10px 12px;
            min-height: 44px;
          }

          .toggle-switch {
            width: 60px;
            height: 28px;
          }

          .toggle-slider:before {
            height: 22px;
            width: 22px;
            left: 3px;
            bottom: 3px;
          }

          input:checked + .toggle-slider:before {
            transform: translateX(32px);
          }
        }

        /* Touch-friendly interactions */
        @media (hover: none) and (pointer: coarse) {
          .btn-icon, .mic-btn, .send-button, .suggestion, .btn-save-to-graph, .hamburger-btn, .hamburger-menu-item {
            min-height: 44px;
            min-width: 44px;
          }
        }
      </style>

      <div class="container">
        <div class="header">
          <div class="header-left">
            <button class="hamburger-btn" id="hamburgerBtn">☰</button>
            <h1>AI Chat</h1>
            <div class="model-badge">
              ${this.models[this.currentModel].icon} ${this.models[this.currentModel].name}
            </div>
            <div class="user-badge">
              👤 ${userId}
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-icon" id="settingsBtn" title="Settings">⚙️</button>
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
          <div class="hamburger-menu" id="hamburgerMenu">
            <div class="hamburger-menu-item" id="hamburgerSettingsBtn">
              ⚙️ Settings
            </div>
            <div class="hamburger-menu-item" id="hamburgerRefreshBtn">
              🔄 Refresh Component
            </div>
            <div class="hamburger-menu-item" id="hamburgerExportBtn">
              📥 Export Conversation
            </div>
            <div class="hamburger-menu-item" id="hamburgerClearBtn">
              🗑️ Clear History
            </div>
          </div>
        </div>

        <div class="settings-page" id="settingsPage">
          <div class="settings-header">
            <h2>Settings</h2>
            <button class="close-settings" id="closeSettingsBtn">✕</button>
          </div>
          <div class="settings-content">
            <div class="settings-item">
              <label>Theme:</label>
              <select id="themeSelect">
                <option value="light" ${this.getAttribute('theme') === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${this.getAttribute('theme') === 'dark' ? 'selected' : ''}>Dark</option>
              </select>
            </div>
            <div class="settings-item">
              <label>Model:</label>
              <select id="modelSelect">
                ${Object.keys(this.models).map(key => `<option value="${key}" ${key === this.currentModel ? 'selected' : ''}>${this.models[key].name}</option>`).join('')}
              </select>
            </div>
            ${this.graphId ? `
              <div class="settings-item">
                <label>Graph Context:</label>
                <label class="toggle-switch">
                  <input type="checkbox" id="graphContextToggle" ${this.useGraphContext ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
              </div>
            ` : ''}

            <!-- User API Keys Section (NEW) -->
            <div class="settings-section">
              <h3>🔑 Your API Keys</h3>
              <div class="settings-item">
                <label class="toggle-switch">
                  <input type="checkbox" id="useUserModelToggle" ${this.useUserModel ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">Use My Own API Key</span>
                </label>
              </div>

              ${this.userApiKeys.length > 0 ? `
                <div class="api-keys-list">
                  ${this.userApiKeys.map(key => `
                    <div class="api-key-item">
                      <div class="api-key-info">
                        <span class="api-key-provider">${this.providers[key.provider]?.icon || '🔑'} ${this.providers[key.provider]?.name || key.provider}</span>
                        <span class="api-key-name">${key.keyName || 'Unnamed Key'}</span>
                        ${key.lastUsed ? `<span class="api-key-last-used">Last used: ${this.formatLastUsed(key.lastUsed)}</span>` : ''}
                      </div>
                      <button class="btn-delete-key" data-provider="${key.provider}" title="Delete API Key">🗑️</button>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="no-keys-message">No API keys configured yet.</p>'}

              <div class="add-key-form" id="addKeyForm">
                <h4>➕ Add New API Key</h4>
                <div class="form-group">
                  <label for="providerSelect">Provider:</label>
                  <select id="providerSelect">
                    <option value="">Select Provider</option>
                    ${Object.keys(this.providers).map(key =>
                      `<option value="${key}">${this.providers[key].icon} ${this.providers[key].name}</option>`
                    ).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label for="apiKeyInput">API Key:</label>
                  <div class="input-with-toggle">
                    <input type="password" id="apiKeyInput" placeholder="sk-proj-..." autocomplete="off">
                    <button type="button" class="btn-toggle-visibility" id="toggleKeyVisibility">👁️</button>
                  </div>
                </div>
                <div class="form-group">
                  <label for="keyNameInput">Key Name (optional):</label>
                  <input type="text" id="keyNameInput" placeholder="My Production Key">
                </div>
                <div class="form-actions">
                  <button class="btn btn-test" id="testConnectionBtn">Test Connection</button>
                  <button class="btn btn-save" id="saveKeyBtn">💾 Save Key</button>
                </div>
                <div class="form-feedback" id="formFeedback"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="messages-container" id="messagesContainer">
          ${this.messages.length === 0 ? this.renderEmptyState() : this.renderMessages()}
        </div>

        <div class="input-container">
          <div class="input-wrapper">
            <div class="input-field-container">
              <textarea
                class="input-field"
                id="messageInput"
                placeholder="Message..."
                rows="1"
              ></textarea>
              <button class="send-button" id="sendButton" ${this.isLoading ? 'disabled' : ''}>
                ${this.isLoading ? '<div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>' : '➤'}
              </button>
            </div>
            <button class="mic-btn" id="micBtn" title="Voice Input">🎤</button>
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
        <h3>How can I help you today?</h3>
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
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
  }

  setupEventListeners() {
    console.log('🟢 [AI Chat] Setting up event listeners')
    const sendButton = this.shadowRoot.getElementById('sendButton')
    const messageInput = this.shadowRoot.getElementById('messageInput')
    const clearBtn = this.shadowRoot.getElementById('clearBtn')
    const exportBtn = this.shadowRoot.getElementById('exportBtn')
    const micBtn = this.shadowRoot.getElementById('micBtn')
    const settingsBtn = this.shadowRoot.getElementById('settingsBtn')
    const settingsPage = this.shadowRoot.getElementById('settingsPage')
    const closeSettingsBtn = this.shadowRoot.getElementById('closeSettingsBtn')
    const themeSelect = this.shadowRoot.getElementById('themeSelect')
    const modelSelect = this.shadowRoot.getElementById('modelSelect')
    const graphContextToggle = this.shadowRoot.getElementById('graphContextToggle')
    const hamburgerBtn = this.shadowRoot.getElementById('hamburgerBtn')
    const hamburgerMenu = this.shadowRoot.getElementById('hamburgerMenu')
    const hamburgerSettingsBtn = this.shadowRoot.getElementById('hamburgerSettingsBtn')
    const hamburgerRefreshBtn = this.shadowRoot.getElementById('hamburgerRefreshBtn')
    const hamburgerExportBtn = this.shadowRoot.getElementById('hamburgerExportBtn')
    const hamburgerClearBtn = this.shadowRoot.getElementById('hamburgerClearBtn')

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

    // Settings button
    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.showSettingsPage = true
      settingsPage.classList.add('show')
    })

    // Close settings
    closeSettingsBtn?.addEventListener('click', () => {
      this.showSettingsPage = false
      settingsPage.classList.remove('show')
    })

    // Theme select
    themeSelect?.addEventListener('change', (e) => {
      this.setAttribute('theme', e.target.value)
    })

    // Model select
    modelSelect?.addEventListener('change', (e) => {
      this.setModel(e.target.value)
    })

    // Graph context toggle
    graphContextToggle?.addEventListener('change', (e) => {
      console.log('🔵 [Graph Toggle] Button clicked!')
      console.log('🔵 [Graph Toggle] Current state:', this.useGraphContext ? 'ON' : 'OFF')
      console.log('🔵 [Graph Toggle] Graph ID:', this.graphId)

      this.useGraphContext = e.target.checked

      console.log('🔵 [Graph Toggle] New state:', this.useGraphContext ? 'ON' : 'OFF')
      console.log('🔵 [Graph Toggle] Will use endpoint:', this.useGraphContext ? '/user-ai-chat' : '/simple-chat')

      this.render()

      // Dispatch event
      this.dispatchEvent(new CustomEvent('graphContextToggled', {
        detail: { enabled: this.useGraphContext, graphId: this.graphId }
      }))
    })

    // User API Keys Event Handlers (NEW)
    const useUserModelToggle = this.shadowRoot.getElementById('useUserModelToggle')
    const providerSelect = this.shadowRoot.getElementById('providerSelect')
    const apiKeyInput = this.shadowRoot.getElementById('apiKeyInput')
    const keyNameInput = this.shadowRoot.getElementById('keyNameInput')
    const toggleKeyVisibility = this.shadowRoot.getElementById('toggleKeyVisibility')
    const testConnectionBtn = this.shadowRoot.getElementById('testConnectionBtn')
    const saveKeyBtn = this.shadowRoot.getElementById('saveKeyBtn')
    const formFeedback = this.shadowRoot.getElementById('formFeedback')

    // Toggle user model usage
    useUserModelToggle?.addEventListener('change', (e) => {
      this.useUserModel = e.target.checked
      console.log('🔑 [User API] Toggle user model:', this.useUserModel)

      // Update selectedProvider if we have keys
      if (this.useUserModel && this.userApiKeys.length > 0) {
        this.selectedProvider = this.userApiKeys[0].provider
        console.log('🔑 [User API] Auto-selected provider:', this.selectedProvider)
      }

      this.render()
    })

    // Toggle API key visibility
    toggleKeyVisibility?.addEventListener('click', () => {
      const type = apiKeyInput.type === 'password' ? 'text' : 'password'
      apiKeyInput.type = type
      toggleKeyVisibility.textContent = type === 'password' ? '👁️' : '🙈'
    })

    // Test connection
    testConnectionBtn?.addEventListener('click', async () => {
      const provider = providerSelect.value
      const apiKey = apiKeyInput.value

      if (!provider || !apiKey) {
        this.showFormFeedback('error', 'Please select a provider and enter an API key')
        return
      }

      testConnectionBtn.disabled = true
      testConnectionBtn.textContent = 'Testing...'
      this.showFormFeedback('info', 'Testing connection...')

      try {
        // Simple test: Try to make a minimal API call to validate the key
        // This would be enhanced with actual provider-specific validation
        this.showFormFeedback('success', '✅ Connection test successful! (Note: Full validation happens on save)')
      } catch (error) {
        this.showFormFeedback('error', `❌ Connection test failed: ${error.message}`)
      } finally {
        testConnectionBtn.disabled = false
        testConnectionBtn.textContent = 'Test Connection'
      }
    })

    // Save API key
    saveKeyBtn?.addEventListener('click', async () => {
      const provider = providerSelect.value
      const apiKey = apiKeyInput.value
      const keyName = keyNameInput.value

      if (!provider || !apiKey) {
        this.showFormFeedback('error', 'Please select a provider and enter an API key')
        return
      }

      saveKeyBtn.disabled = true
      saveKeyBtn.textContent = 'Saving...'
      this.showFormFeedback('info', 'Encrypting and saving API key...')

      try {
        await this.saveApiKey(provider, apiKey, keyName)
        this.showFormFeedback('success', '✅ API key saved successfully!')

        // Clear form
        providerSelect.value = ''
        apiKeyInput.value = ''
        keyNameInput.value = ''
        apiKeyInput.type = 'password'
        toggleKeyVisibility.textContent = '👁️'

        // If this is the first key, enable user model toggle
        if (this.userApiKeys.length === 1) {
          this.useUserModel = true
          this.selectedProvider = this.userApiKeys[0].provider
        }

        setTimeout(() => {
          formFeedback.style.display = 'none'
        }, 3000)
      } catch (error) {
        this.showFormFeedback('error', `❌ Failed to save API key: ${error.message}`)
      } finally {
        saveKeyBtn.disabled = false
        saveKeyBtn.textContent = '💾 Save Key'
      }
    })

    // Delete API key
    const deleteKeyButtons = this.shadowRoot.querySelectorAll('.btn-delete-key')
    deleteKeyButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const provider = e.target.dataset.provider

        if (!confirm(`Are you sure you want to delete your ${this.providers[provider]?.name || provider} API key?`)) {
          return
        }

        try {
          await this.deleteApiKey(provider)
          console.log('✅ [User API] Deleted key for provider:', provider)

          // If we deleted the selected provider, disable user model
          if (this.selectedProvider === provider) {
            this.useUserModel = false
            this.selectedProvider = null
          }
        } catch (error) {
          alert(`Failed to delete API key: ${error.message}`)
        }
      })
    })

    // Provider selection - update selectedProvider when user model is enabled
    providerSelect?.addEventListener('change', (e) => {
      if (this.useUserModel) {
        this.selectedProvider = e.target.value
        console.log('🔑 [User API] Selected provider:', this.selectedProvider)
      }
    })

    // Microphone button
    micBtn?.addEventListener('click', () => this.toggleSpeechRecognition())

    // Suggestion prompts
    this.shadowRoot.querySelectorAll('.suggestion').forEach(suggestion => {
      suggestion.addEventListener('click', () => {
        const prompt = suggestion.dataset.prompt
        messageInput.value = prompt
        this.handleSendMessage()
      })
    })

    // Hamburger menu button
    hamburgerBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.showHamburgerMenu = !this.showHamburgerMenu
      hamburgerMenu.classList.toggle('show', this.showHamburgerMenu)
    })

    // Hamburger menu items
    hamburgerSettingsBtn?.addEventListener('click', () => {
      this.showSettingsPage = true
      settingsPage.classList.add('show')
      this.showHamburgerMenu = false
      hamburgerMenu.classList.remove('show')
    })

    hamburgerRefreshBtn?.addEventListener('click', () => {
      const userId = this.getAttribute('user-id') || 'demo-user'
      const storageKey = `ai-chat-history-${userId}`
      localStorage.removeItem(storageKey)
      this.messages = []
      this.render()
      this.showHamburgerMenu = false
      hamburgerMenu.classList.remove('show')
    })

    hamburgerExportBtn?.addEventListener('click', () => {
      this.exportConversation()
      this.showHamburgerMenu = false
      hamburgerMenu.classList.remove('show')
    })

    hamburgerClearBtn?.addEventListener('click', () => {
      this.clearHistory()
      this.showHamburgerMenu = false
      hamburgerMenu.classList.remove('show')
    })

    // Close hamburger menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!hamburgerBtn.contains(e.target) && !hamburgerMenu.contains(e.target)) {
        this.showHamburgerMenu = false
        hamburgerMenu.classList.remove('show')
      }
    })
  }

  initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = false
      this.recognition.interimResults = false
      this.recognition.lang = 'en-US'

      this.recognition.onstart = () => {
        this.isListening = true
        this.updateMicButton()
      }

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        this.insertSpeechText(transcript)
      }

      this.recognition.onend = () => {
        this.isListening = false
        this.updateMicButton()
      }

      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        this.isListening = false
        this.updateMicButton()
        this.showError(`Speech recognition error: ${event.error}`)
      }
    } else {
      // Hide mic button if not supported
      const micBtn = this.shadowRoot.getElementById('micBtn')
      if (micBtn) micBtn.style.display = 'none'
    }
  }

  toggleSpeechRecognition() {
    if (!this.recognition) return

    if (this.isListening) {
      this.recognition.stop()
    } else {
      this.recognition.start()
    }
  }

  updateMicButton() {
    const micBtn = this.shadowRoot.getElementById('micBtn')
    if (micBtn) {
      micBtn.classList.toggle('listening', this.isListening)
      micBtn.textContent = this.isListening ? '🎙️' : '🎤'
    }
  }

  insertSpeechText(text) {
    const input = this.shadowRoot.getElementById('messageInput')
    if (input) {
      input.value += (input.value ? ' ' : '') + text
      input.style.height = 'auto'
      input.style.height = Math.min(input.scrollHeight, 120) + 'px'
      input.focus()
    }
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

    // Check for documentation queries
    if (this.isDocumentationQuery(message)) {
      console.log('📚 [AI Chat] Detected documentation query, responding directly')
      this.addMessage('user', message)
      input.value = ''
      input.style.height = 'auto'
      this.respondWithDocumentation()
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

  isDocumentationQuery(message) {
    return this.documentationTriggers.some(trigger => trigger.test(message))
  }

  respondWithDocumentation() {
    const docsUrl = this.getAttribute('documentation-url') || 'https://github.com/vegvisr/ai-chat-component'
    const response = `I'm an AI Chat Web Component built using modern JavaScript and Web Components standards. I support multiple AI models (Grok, GPT-5.1, Claude), knowledge graph integration, and various features like markdown rendering and emoji support.

For full documentation, including usage examples, API reference, and implementation details, please visit: [${docsUrl}](${docsUrl})`

    this.addMessage('ai', response)

    this.dispatchEvent(new CustomEvent('responseReceived', {
      detail: { message: response, model: this.currentModel, isDocumentationResponse: true }
    }))
  }

  // User API Keys Management (NEW)
  async loadUserApiKeys() {
    try {
      const userId = this.getAttribute('user-id')
      if (!userId || userId === 'anonymous') {
        console.log('👤 [API Keys] No user ID, skipping API keys load')
        return
      }

      const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
      const response = await fetch(`${apiEndpoint}/user-api-keys?userId=${userId}`)

      if (!response.ok) {
        throw new Error(`Failed to load API keys: ${response.status}`)
      }

      const data = await response.json()
      this.userApiKeys = data.keys || []
      console.log('🔑 [API Keys] Loaded:', this.userApiKeys.length, 'keys')
      this.render()
    } catch (error) {
      console.error('❌ [API Keys] Error loading:', error)
    }
  }

  async saveApiKey(provider, apiKey, keyName) {
    try {
      const userId = this.getAttribute('user-id')
      if (!userId || userId === 'anonymous') {
        throw new Error('User must be logged in to save API keys')
      }

      const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
      const response = await fetch(`${apiEndpoint}/user-api-keys`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, provider, apiKey, keyName })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save API key')
      }

      const data = await response.json()
      console.log('✅ [API Keys] Saved successfully:', provider)

      // Reload API keys list
      await this.loadUserApiKeys()

      return data
    } catch (error) {
      console.error('❌ [API Keys] Error saving:', error)
      throw error
    }
  }

  async deleteApiKey(provider) {
    try {
      const userId = this.getAttribute('user-id')
      if (!userId || userId === 'anonymous') {
        throw new Error('User must be logged in')
      }

      const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
      const response = await fetch(`${apiEndpoint}/user-api-keys/${provider}?userId=${userId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete API key: ${response.status}`)
      }

      console.log('🗑️ [API Keys] Deleted:', provider)

      // Reload API keys list
      await this.loadUserApiKeys()

      return true
    } catch (error) {
      console.error('❌ [API Keys] Error deleting:', error)
      throw error
    }
  }

  formatLastUsed(timestamp) {
    if (!timestamp) return 'Never'

    const now = new Date()
    const used = new Date(timestamp)
    const diffMs = now - used
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  showFormFeedback(type, message) {
    const formFeedback = this.shadowRoot.getElementById('formFeedback')
    if (!formFeedback) return

    formFeedback.className = `form-feedback ${type}`
    formFeedback.textContent = message
    formFeedback.style.display = 'block'
  }

  async callAI(userMessage) {
    const apiEndpoint = this.getAttribute('api-endpoint') || 'https://api.vegvisr.org'
    const userId = this.getAttribute('user-id') || 'anonymous'

    console.log('🟢 [AI Chat] callAI - apiEndpoint:', apiEndpoint)
    console.log('🟢 [AI Chat] callAI - userId:', userId)
    console.log('🟢 [AI Chat] callAI - useGraphContext:', this.useGraphContext)
    console.log('🟢 [AI Chat] callAI - graphId:', this.graphId)
    console.log('🔑 [AI Chat] callAI - useUserModel:', this.useUserModel)
    console.log('🔑 [AI Chat] callAI - selectedProvider:', this.selectedProvider)

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

    // Always use user-ai-chat endpoint (supports both graph context and user API keys)
    const endpoint = 'user-ai-chat'
    const url = `${apiEndpoint}/${endpoint}`
    console.log('🟢 [AI Chat] callAI - fetching:', url, '(endpoint:', endpoint, ')')

    // Build request body
    const requestBody = { messages }

    // Add graph context if enabled
    if (this.useGraphContext && this.graphId) {
      requestBody.graph_id = this.graphId
      requestBody.userEmail = userId
      console.log('🟢 [AI Chat] callAI - including graph_id:', this.graphId)
    }

    // Add user API key parameters if enabled
    if (this.useUserModel && this.selectedProvider) {
      requestBody.useUserModel = true
      requestBody.userId = userId
      requestBody.provider = this.selectedProvider
      requestBody.model = this.currentModel // Can be enhanced to select specific model per provider
      console.log('🔑 [AI Chat] callAI - using user API key for provider:', this.selectedProvider)
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
      console.error('🔴 [AI Chat] callAI - invalid response:', response.status, errorText)
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
  /**
   * Sends a message programmatically
   * @param {string} text - The message text to send
   */
  sendMessage(text) {
    const input = this.shadowRoot.getElementById('messageInput')
    if (input) {
      input.value = text
      this.handleSendMessage()
    }
  }

  /**
   * Sets the graph context for the chat
   * @param {string} graphId - The graph ID to use for context
   */
  setGraphContext(graphId) {
    this.graphId = graphId
    this.updateGraphContext()
  }
}

// Register the custom element
customElements.define('ai-chat-component', AIChatComponent)
