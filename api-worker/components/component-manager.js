/**
 * Component Manager Web Component
 * AI-powered web component editor with version control
 *
 * Usage:
 * <component-manager
 *   api-endpoint="https://api.vegvisr.org"
 *   user-id="user@example.com">
 * </component-manager>
 *
 * Public API Methods:
 * - manager.refreshComponents() - Reload component list
 * - manager.selectComponent(name) - Select a component to view/edit
 * - manager.editWithAI(componentName, request) - Edit component with AI
 * - manager.restoreVersion(componentName, versionNumber) - Restore a version
 *
 * Events:
 * - componentSelected: {componentName, component}
 * - versionCreated: {componentName, newVersion, changes}
 * - versionRestored: {componentName, versionNumber}
 * - error: {message, error}
 */

class ComponentManager extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // State
    this.components = []
    this.selectedComponent = null
    this.versions = []
    this.selectedCode = ''
    this.isLoading = false
    this.aiRequest = ''
    this.currentView = 'list' // 'list', 'edit', 'versions'
  }

  static get observedAttributes() {
    return ['api-endpoint', 'user-id', 'theme']
  }

  get apiEndpoint() { return this.getAttribute('api-endpoint') || 'https://api.vegvisr.org' }
  get userId() { return this.getAttribute('user-id') || 'anonymous' }
  get theme() { return this.getAttribute('theme') || 'light' }

  connectedCallback() {
    this.render()
    this.setupEventListeners()
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
      console.log('🔄 Component Manager: Starting component refresh...')
      this.refreshComponents()
    }, 100)
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --primary-color: #667eea;
          --primary-dark: #5568d3;
          --bg-color: #ffffff;
          --text-color: #333;
          --border-color: #e0e0e0;
          --success-color: #10b981;
          --danger-color: #ef4444;
          --warning-color: #f59e0b;
        }

        :host([theme="dark"]) {
          --bg-color: #1a1a1a;
          --text-color: #e0e0e0;
          --border-color: #333;
        }

        .container {
          background: var(--bg-color);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn-primary {
          background: white;
          color: var(--primary-color);
        }

        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .btn-success {
          background: var(--success-color);
          color: white;
        }

        .btn-danger {
          background: var(--danger-color);
          color: white;
        }

        .content {
          padding: 24px;
        }

        .component-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .component-card {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .component-card:hover {
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
          transform: translateY(-2px);
        }

        .component-name {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 8px;
          color: var(--primary-color);
        }

        .component-meta {
          font-size: 12px;
          color: #666;
          margin-top: 8px;
        }

        .component-description {
          font-size: 14px;
          color: var(--text-color);
          margin: 8px 0;
          line-height: 1.5;
        }

        .component-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .tag {
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          color: #666;
        }

        .edit-view {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .panel {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
        }

        .panel-header {
          background: #f9fafb;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-content {
          padding: 16px;
        }

        textarea {
          width: 100%;
          min-height: 150px;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 13px;
          resize: vertical;
        }

        .code-view {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 13px;
          max-height: 400px;
          overflow-y: auto;
        }

        .version-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .version-item {
          border-bottom: 1px solid var(--border-color);
          padding: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .version-item:hover {
          background: #f9fafb;
        }

        .version-number {
          font-weight: 600;
          color: var(--primary-color);
          margin-bottom: 4px;
        }

        .version-date {
          font-size: 12px;
          color: #666;
        }

        .version-change {
          font-size: 13px;
          margin-top: 6px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid var(--primary-color);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error {
          background: #fee;
          border: 1px solid #fcc;
          color: #c00;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .success {
          background: #d1fae5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .breadcrumb a {
          color: var(--primary-color);
          text-decoration: none;
          cursor: pointer;
        }

        .breadcrumb a:hover {
          text-decoration: underline;
        }

        .stats {
          display: flex;
          gap: 24px;
          margin-bottom: 16px;
        }

        .stat {
          background: #f9fafb;
          padding: 12px 16px;
          border-radius: 6px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: var(--primary-color);
        }
      </style>

      <div class="container">
        <div class="header">
          <h1>⚡ Component Manager</h1>
          <div class="header-actions">
            <button class="btn btn-secondary" id="refreshBtn">🔄 Refresh</button>
          </div>
        </div>

        <div class="content">
          <div id="loadingView" class="loading" style="display: none;">
            <div class="spinner"></div>
            <p>Loading...</p>
          </div>

          <div id="errorView" style="display: none;"></div>
          <div id="successView" style="display: none;"></div>

          <div id="listView" style="display: none;">
            <div class="stats">
              <div class="stat">
                <div class="stat-label">Total Components</div>
                <div class="stat-value" id="totalComponents">0</div>
              </div>
              <div class="stat">
                <div class="stat-label">Total Versions</div>
                <div class="stat-value" id="totalVersions">0</div>
              </div>
            </div>
            <div class="component-grid" id="componentGrid"></div>
          </div>

          <div id="editView" style="display: none;">
            <div class="breadcrumb">
              <a id="backToList">← Back to List</a>
              <span>/</span>
              <span id="currentComponentName"></span>
            </div>

            <div class="edit-view">
              <div class="panel">
                <div class="panel-header">
                  <span>🤖 AI Editor</span>
                </div>
                <div class="panel-content">
                  <p style="font-size: 14px; color: #666; margin-bottom: 12px;">
                    Describe what you want to change:
                  </p>
                  <textarea id="aiRequestInput" placeholder="Example: Add the capability for users to add new edges between nodes by clicking one node then another"></textarea>
                  <button class="btn btn-success" id="editWithAIBtn" style="margin-top: 12px; width: 100%;">
                    ✨ Edit with AI
                  </button>
                </div>
              </div>

              <div class="panel">
                <div class="panel-header">
                  <span>📚 Version History</span>
                  <span id="versionCount">0 versions</span>
                </div>
                <div class="panel-content">
                  <div class="version-list" id="versionList"></div>
                </div>
              </div>
            </div>

            <div class="panel" style="margin-top: 24px;">
              <div class="panel-header">
                <span>💻 Current Code</span>
                <button class="btn btn-secondary" id="viewCodeBtn">View Full Code</button>
              </div>
              <div class="panel-content">
                <div class="code-view" id="codePreview">Select a component to view code...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  setupEventListeners() {
    const refreshBtn = this.shadowRoot.getElementById('refreshBtn')
    const backToList = this.shadowRoot.getElementById('backToList')
    const editWithAIBtn = this.shadowRoot.getElementById('editWithAIBtn')
    const viewCodeBtn = this.shadowRoot.getElementById('viewCodeBtn')

    if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshComponents())
    if (backToList) backToList.addEventListener('click', () => this.showListView())
    if (editWithAIBtn) editWithAIBtn.addEventListener('click', () => this.handleAIEdit())
    if (viewCodeBtn) viewCodeBtn.addEventListener('click', () => this.viewFullCode())
  }

  async refreshComponents() {
    console.log('🔄 RefreshComponents: Starting...')
    this.showLoading(true)
    this.hideMessages()

    try {
      console.log('🔄 RefreshComponents: Fetching from', `${this.apiEndpoint}/api/components`)
      const response = await fetch(`${this.apiEndpoint}/api/components`)
      const data = await response.json()

      console.log('🔄 RefreshComponents: Response:', data)

      if (data.success) {
        this.components = data.components
        console.log('✅ RefreshComponents: Loaded', this.components.length, 'components')
        this.showListView()
      } else {
        console.error('❌ RefreshComponents: API error:', data.error)
        this.showError(data.error || 'Failed to load components')
      }
    } catch (error) {
      console.error('❌ RefreshComponents: Network error:', error)
      this.showError(`Error: ${error.message}`)
    } finally {
      this.showLoading(false)
    }
  }

  showListView() {
    console.log('📋 ShowListView: Showing list with', this.components.length, 'components')
    this.currentView = 'list'
    this.shadowRoot.getElementById('listView').style.display = 'block'
    this.shadowRoot.getElementById('editView').style.display = 'none'

    const grid = this.shadowRoot.getElementById('componentGrid')
    const totalComponents = this.shadowRoot.getElementById('totalComponents')

    if (!grid || !totalComponents) {
      console.error('❌ ShowListView: Required elements not found', { grid: !!grid, totalComponents: !!totalComponents })
      return
    }

    totalComponents.textContent = this.components.length

    grid.innerHTML = this.components.map(comp => `
      <div class="component-card" data-name="${comp.name}">
        <div class="component-name">${comp.name}</div>
        <div class="component-description">${comp.description || 'No description'}</div>
        <div class="component-meta">
          Version ${comp.current_version} • ${comp.version_count} total versions
        </div>
        <div class="component-tags">
          ${this.parseTags(comp.tags).map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      </div>
    `).join('')

    console.log('📋 ShowListView: Grid HTML updated, adding click handlers...')

    // Add click handlers
    grid.querySelectorAll('.component-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectComponent(card.dataset.name)
      })
    })

    console.log('✅ ShowListView: Complete')
  }

  async selectComponent(name) {
    this.showLoading(true)
    this.hideMessages()

    try {
      // Get component details
      const detailsResponse = await fetch(`${this.apiEndpoint}/api/components/${name}`)
      const detailsData = await detailsResponse.json()

      if (!detailsData.success) {
        this.showError(detailsData.error)
        return
      }

      this.selectedComponent = detailsData.component
      this.selectedCode = detailsData.code

      // Get versions
      const versionsResponse = await fetch(`${this.apiEndpoint}/api/components/${name}/versions`)
      const versionsData = await versionsResponse.json()

      if (versionsData.success) {
        this.versions = versionsData.versions
      }

      this.showEditView()

      this.dispatchEvent(new CustomEvent('componentSelected', {
        detail: { componentName: name, component: this.selectedComponent }
      }))

    } catch (error) {
      this.showError(`Error: ${error.message}`)
    } finally {
      this.showLoading(false)
    }
  }

  showEditView() {
    this.currentView = 'edit'
    this.shadowRoot.getElementById('listView').style.display = 'none'
    this.shadowRoot.getElementById('editView').style.display = 'block'

    const currentName = this.shadowRoot.getElementById('currentComponentName')
    const codePreview = this.shadowRoot.getElementById('codePreview')
    const versionList = this.shadowRoot.getElementById('versionList')
    const versionCount = this.shadowRoot.getElementById('versionCount')

    currentName.textContent = this.selectedComponent.name
    codePreview.textContent = this.selectedCode.substring(0, 1000) + '...'
    versionCount.textContent = `${this.versions.length} versions`

    versionList.innerHTML = this.versions.map(v => `
      <div class="version-item" data-version="${v.version_number}">
        <div class="version-number">Version ${v.version_number}</div>
        <div class="version-date">${new Date(v.created_at).toLocaleString()}</div>
        <div class="version-change">${v.change_description || 'No description'}</div>
        ${v.user_request ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">📝 ${v.user_request}</div>` : ''}
        <button class="btn btn-secondary" style="margin-top: 8px; font-size: 12px;" data-restore="${v.version_number}">
          ↩️ Restore
        </button>
      </div>
    `).join('')

    // Add restore handlers
    versionList.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const versionNumber = parseInt(btn.dataset.restore)
        this.restoreVersion(this.selectedComponent.name, versionNumber)
      })
    })
  }

  async handleAIEdit() {
    const input = this.shadowRoot.getElementById('aiRequestInput')
    const request = input.value.trim()

    if (!request) {
      this.showError('Please describe what you want to change')
      return
    }

    this.showLoading(true)
    this.hideMessages()

    try {
      const response = await fetch(`${this.apiEndpoint}/api/components/${this.selectedComponent.name}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: request,
          userId: this.userId
        })
      })

      const data = await response.json()

      if (data.success) {
        this.showSuccess(`✅ Component updated to version ${data.newVersion}!\n\n${data.changes}`)
        input.value = ''

        // Refresh component details
        await this.selectComponent(this.selectedComponent.name)

        this.dispatchEvent(new CustomEvent('versionCreated', {
          detail: {
            componentName: this.selectedComponent.name,
            newVersion: data.newVersion,
            changes: data.changes
          }
        }))
      } else {
        this.showError(data.error)
      }

    } catch (error) {
      this.showError(`Error: ${error.message}`)
    } finally {
      this.showLoading(false)
    }
  }

  async restoreVersion(componentName, versionNumber) {
    if (!confirm(`Restore ${componentName} to version ${versionNumber}?`)) {
      return
    }

    this.showLoading(true)
    this.hideMessages()

    try {
      const response = await fetch(`${this.apiEndpoint}/api/components/${componentName}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionNumber,
          userId: this.userId
        })
      })

      const data = await response.json()

      if (data.success) {
        this.showSuccess(`✅ Restored to version ${versionNumber} (created new version ${data.newVersion})`)

        // Refresh component details
        await this.selectComponent(componentName)

        this.dispatchEvent(new CustomEvent('versionRestored', {
          detail: { componentName, versionNumber }
        }))
      } else {
        this.showError(data.error)
      }

    } catch (error) {
      this.showError(`Error: ${error.message}`)
    } finally {
      this.showLoading(false)
    }
  }

  viewFullCode() {
    const codePreview = this.shadowRoot.getElementById('codePreview')
    codePreview.textContent = this.selectedCode
  }

  parseTags(tagsJson) {
    try {
      return JSON.parse(tagsJson || '[]')
    } catch {
      return []
    }
  }

  showLoading(show) {
    const loadingView = this.shadowRoot.getElementById('loadingView')
    const listView = this.shadowRoot.getElementById('listView')
    const editView = this.shadowRoot.getElementById('editView')

    if (show) {
      loadingView.style.display = 'block'
      listView.style.display = 'none'
      editView.style.display = 'none'
    } else {
      loadingView.style.display = 'none'
      // Don't automatically show other views here - let showListView() or showEditView() handle it
    }
  }

  showError(message) {
    const errorView = this.shadowRoot.getElementById('errorView')
    errorView.className = 'error'
    errorView.textContent = message
    errorView.style.display = 'block'

    this.dispatchEvent(new CustomEvent('error', {
      detail: { message }
    }))
  }

  showSuccess(message) {
    const successView = this.shadowRoot.getElementById('successView')
    successView.className = 'success'
    successView.textContent = message
    successView.style.display = 'block'
  }

  hideMessages() {
    this.shadowRoot.getElementById('errorView').style.display = 'none'
    this.shadowRoot.getElementById('successView').style.display = 'none'
  }

  // Public API methods
  async editWithAI(componentName, request) {
    await this.selectComponent(componentName)
    const input = this.shadowRoot.getElementById('aiRequestInput')
    input.value = request
    await this.handleAIEdit()
  }
}

customElements.define('component-manager', ComponentManager)
console.log('✅ Component Manager component loaded')
