// Component serving handler
export async function handleServeComponent(request, env, pathname) {
  try {
    // Extract component name from path: /components/knowledge-graph-viewer.js
    const componentName = pathname.replace('/components/', '')

    // Try to serve from R2 first (for components stored separately)
    if (env.WEB_COMPONENTS) {
      try {
        const object = await env.WEB_COMPONENTS.get(componentName)
        if (object) {
          return new Response(object.body, {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      } catch (r2Error) {
        console.log('R2 fetch failed, falling back to legacy components:', r2Error.message)
      }
    }

    // Fallback to legacy string-based components
    const componentKey = componentName.replace('.js', '')
    const components = {
      'canvas-drawing': `/**
 * Canvas Drawing Web Component
 * A standalone, reusable drawing canvas component
 * Usage: <canvas-drawing width="800" height="600"></canvas-drawing>
 */

class CanvasDrawing extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // State
    this.isDrawing = false
    this.currentColor = '#000000'
    this.currentWidth = 2
    this.history = []
    this.historyStep = -1
    this.maxHistory = 20
  }

  static get observedAttributes() {
    return ['width', 'height', 'stroke-color', 'stroke-width', 'show-controls', 'background-color']
  }

  connectedCallback() {
    this.render()
    this.setupCanvas()
    this.setupEventListeners()
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render()
      this.setupCanvas()
    }
  }

  get canvasWidth() {
    return parseInt(this.getAttribute('width') || '800')
  }

  get canvasHeight() {
    return parseInt(this.getAttribute('height') || '600')
  }

  get strokeColor() {
    return this.getAttribute('stroke-color') || '#000000'
  }

  get strokeWidth() {
    return parseInt(this.getAttribute('stroke-width') || '2')
  }

  get showControls() {
    return this.getAttribute('show-controls') !== 'false'
  }

  get backgroundColor() {
    return this.getAttribute('background-color') || '#ffffff'
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .canvas-container {
          display: inline-block;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        canvas {
          display: block;
          cursor: crosshair;
          touch-action: none;
        }

        .controls {
          margin-top: 1rem;
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
        }

        .control-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        label {
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
        }

        input[type="color"] {
          width: 50px;
          height: 40px;
          border: 2px solid white;
          border-radius: 6px;
          cursor: pointer;
          background: none;
        }

        input[type="range"] {
          width: 120px;
          cursor: pointer;
        }

        button {
          padding: 0.5rem 1rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.875rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        button:active {
          transform: translateY(0);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .width-value {
          color: white;
          font-weight: 600;
          min-width: 2ch;
        }
      </style>

      <div class="canvas-container">
        <canvas id="canvas"></canvas>
      </div>

      \${this.showControls ? \`
        <div class="controls">
          <div class="control-group">
            <label>Color:</label>
            <input type="color" id="colorPicker" value="\${this.strokeColor}">
          </div>

          <div class="control-group">
            <label>Width:</label>
            <input type="range" id="widthSlider" min="1" max="20" value="\${this.strokeWidth}">
            <span class="width-value" id="widthValue">\${this.strokeWidth}</span>
          </div>

          <button id="undoBtn">↶ Undo</button>
          <button id="clearBtn">✕ Clear</button>
          <button id="exportBtn">⬇ Export PNG</button>
        </div>
      \` : ''}
    \`
  }

  setupCanvas() {
    this.canvas = this.shadowRoot.getElementById('canvas')
    if (!this.canvas) return

    this.ctx = this.canvas.getContext('2d')
    this.canvas.width = this.canvasWidth
    this.canvas.height = this.canvasHeight

    // Set background
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Initialize drawing settings
    this.currentColor = this.strokeColor
    this.currentWidth = this.strokeWidth

    // Save initial state
    this.saveState()
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.startDrawing.bind(this))
    this.canvas.addEventListener('mousemove', this.draw.bind(this))
    this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this))
    this.canvas.addEventListener('mouseleave', this.stopDrawing.bind(this))

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouch.bind(this))
    this.canvas.addEventListener('touchmove', this.handleTouch.bind(this))
    this.canvas.addEventListener('touchend', this.stopDrawing.bind(this))

    if (!this.showControls) return

    // Control events
    const colorPicker = this.shadowRoot.getElementById('colorPicker')
    const widthSlider = this.shadowRoot.getElementById('widthSlider')
    const widthValue = this.shadowRoot.getElementById('widthValue')
    const undoBtn = this.shadowRoot.getElementById('undoBtn')
    const clearBtn = this.shadowRoot.getElementById('clearBtn')
    const exportBtn = this.shadowRoot.getElementById('exportBtn')

    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.currentColor = e.target.value
        this.dispatchEvent(new CustomEvent('colorChange', { detail: this.currentColor }))
      })
    }

    if (widthSlider && widthValue) {
      widthSlider.addEventListener('input', (e) => {
        this.currentWidth = parseInt(e.target.value)
        widthValue.textContent = this.currentWidth
      })
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo())
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear())
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.export())
    }
  }

  startDrawing(e) {
    this.isDrawing = true
    const pos = this.getMousePos(e)
    this.ctx.beginPath()
    this.ctx.moveTo(pos.x, pos.y)
  }

  draw(e) {
    if (!this.isDrawing) return

    const pos = this.getMousePos(e)

    this.ctx.strokeStyle = this.currentColor
    this.ctx.lineWidth = this.currentWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.lineTo(pos.x, pos.y)
    this.ctx.stroke()

    this.dispatchEvent(new CustomEvent('draw', { detail: pos }))
  }

  stopDrawing() {
    if (this.isDrawing) {
      this.isDrawing = false
      this.saveState()
    }
  }

  handleTouch(e) {
    e.preventDefault()
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 'mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    })

    if (e.type === 'touchstart') {
      this.startDrawing(mouseEvent)
    } else if (e.type === 'touchmove') {
      this.draw(mouseEvent)
    }
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  saveState() {
    // Remove any states after current step
    this.history = this.history.slice(0, this.historyStep + 1)

    // Add new state
    this.history.push(this.canvas.toDataURL())

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    } else {
      this.historyStep++
    }
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--
      const img = new Image()
      img.src = this.history[this.historyStep]
      img.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.drawImage(img, 0, 0)
      }
    }
  }

  clear() {
    this.ctx.fillStyle = this.backgroundColor
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.saveState()
    this.dispatchEvent(new CustomEvent('clear'))
  }

  export() {
    const dataUrl = this.canvas.toDataURL('image/png')
    this.dispatchEvent(new CustomEvent('export', { detail: dataUrl }))

    // Auto-download
    const link = document.createElement('a')
    link.download = \`drawing-\${Date.now()}.png\`
    link.href = dataUrl
    link.click()
  }
}

// Register the custom element
customElements.define('canvas-drawing', CanvasDrawing)`,

    'mermaid-diagram': `/**
 * Mermaid Diagram Web Component
 * Context-Aware diagram generator for knowledge graphs
 *
 * Usage:
 * <mermaid-diagram
 *   diagram-type="gantt"
 *   user-question="Create a timeline of events">
 * </mermaid-diagram>
 *
 * Features:
 * - All Mermaid diagram types (Gantt, Timeline, Flowchart, Sequence, etc.)
 * - AI generation from graph context
 * - Editable Mermaid syntax
 * - Live preview
 * - Export to SVG/PNG
 */

class MermaidDiagram extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // State
    this.mermaidCode = ''
    this.graphContext = null
    this.isGenerating = false
    this.diagramId = \`mermaid-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`
  }

  static get observedAttributes() {
    return ['diagram-type', 'mermaid-code', 'user-question', 'editable']
  }

  connectedCallback() {
    this.loadMermaidLibrary().then(() => {
      this.render()
      this.setupEventListeners()

      // Request graph context from parent (if in GNewViewer)
      this.requestGraphContext()

      // Initialize with any provided code
      if (this.mermaidCode) {
        this.renderDiagram()
      }
    })
  }

  async loadMermaidLibrary() {
    // Check if Mermaid is already loaded
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose'
      })
      return
    }

    // Load Mermaid.js from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
      script.onload = () => {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'loose'
        })
        resolve()
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  get diagramType() {
    return this.getAttribute('diagram-type') || 'flowchart'
  }

  get userQuestion() {
    return this.getAttribute('user-question') || ''
  }

  get editable() {
    return this.getAttribute('editable') !== 'false'
  }

  requestGraphContext() {
    console.log('🔍 Requesting graph context...')

    // Wait a tick to allow inline scripts to execute first
    // This ensures the injected __GRAPH_CONTEXT__ script has run
    setTimeout(() => {
      // First, check if graph context was injected by GNewViewer
      if (window.__GRAPH_CONTEXT__) {
        console.log('✅ Found injected graph context:', window.__GRAPH_CONTEXT__)
        this.graphContext = window.__GRAPH_CONTEXT__
        this.updateGenerateButton()
        return
      }

      console.log('📡 No injected context found, trying postMessage...')
      this.requestViaPostMessage()
    }, 0)
  }

  requestViaPostMessage() {
    console.log('📡 Requesting via postMessage...')

  requestViaPostMessage() {
    console.log('📡 Requesting via postMessage...')

    // Fallback to postMessage for compatibility
    let requestCounter = 0
    const requestId = ++requestCounter

    console.log('🔍 Requesting graph context via postMessage with requestId:', requestId)

    const handler = (event) => {
      console.log('📬 Component received message:', { type: event.data.type, requestId: event.data.requestId, expectedId: requestId })

      if (event.data.type === 'GRAPH_CONTEXT_RESPONSE' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler)
        this.graphContext = event.data.context
        console.log('📊 Received graph context via postMessage:', this.graphContext)
        this.updateGenerateButton()
      }
    }

    window.addEventListener('message', handler)

    // Timeout after 2 seconds (not in GNewViewer context)
    setTimeout(() => {
      window.removeEventListener('message', handler)
      if (!this.graphContext) {
        console.log('⚠️ No graph context available (running standalone)')
      }
    }, 2000)

    // Send request to parent
    if (window.parent !== window) {
      console.log('📤 Sending GET_GRAPH_CONTEXT to parent window')
      window.parent.postMessage({
        type: 'GET_GRAPH_CONTEXT',
        requestId
      }, '*')
    } else {
      console.log('⚠️ No parent window detected')
    }
  }

  updateGenerateButton() {
    const btn = this.shadowRoot.querySelector('.generate-btn')
    if (btn) {
      if (this.graphContext) {
        btn.disabled = false
        btn.textContent = '🤖 Generate from Graph'
        btn.title = \`Generate \${this.diagramType} from \${this.graphContext.nodes?.length || 0} nodes\`
      } else {
        btn.disabled = true
        btn.textContent = '⚠️ No Graph Context'
        btn.title = 'Component needs to be in GNewViewer to access graph data'
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host {
          display: block;
          width: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .diagram-type-badge {
          background: rgba(255,255,255,0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .controls {
          padding: 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .control-group {
          flex: 1;
          min-width: 200px;
        }

        label {
          display: block;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
          color: #495057;
        }

        input[type="text"],
        select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ced4da;
          border-radius: 6px;
          font-size: 0.875rem;
        }

        .button-group {
          display: flex;
          gap: 0.5rem;
        }

        button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .generate-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .clear-btn {
          background: #6c757d;
          color: white;
        }

        .export-btn {
          background: #28a745;
          color: white;
        }

        .content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .editor-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e9ecef;
        }

        .editor-header {
          padding: 0.75rem 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          font-weight: 600;
          font-size: 0.875rem;
        }

        textarea {
          flex: 1;
          padding: 1rem;
          border: none;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
          resize: none;
          background: #fafbfc;
        }

        textarea:focus {
          outline: none;
          background: white;
        }

        .preview-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .preview-header {
          padding: 0.75rem 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .preview-container {
          flex: 1;
          padding: 2rem;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .diagram-output {
          max-width: 100%;
          max-height: 100%;
        }

        .error-message {
          padding: 1rem;
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 6px;
          color: #721c24;
          font-size: 0.875rem;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: #6c757d;
        }

        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .content {
            flex-direction: column;
          }

          .editor-panel {
            border-right: none;
            border-bottom: 1px solid #e9ecef;
          }
        }
      </style>

      <div class="container">
        <div class="header">
          <h3>🎨 Mermaid Diagram</h3>
          <span class="diagram-type-badge">\${this.diagramType}</span>
        </div>

        <div class="controls">
          <div class="control-group">
            <label for="diagram-type-select">Diagram Type</label>
            <select id="diagram-type-select">
              <option value="flowchart">Flowchart</option>
              <option value="sequenceDiagram">Sequence Diagram</option>
              <option value="classDiagram">Class Diagram</option>
              <option value="stateDiagram">State Diagram</option>
              <option value="erDiagram">ER Diagram</option>
              <option value="gantt">Gantt Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="journey">User Journey</option>
              <option value="gitGraph">Git Graph</option>
              <option value="timeline">Timeline</option>
            </select>
          </div>

          <div class="control-group">
            <label for="user-question-input">What do you want to visualize?</label>
            <input
              type="text"
              id="user-question-input"
              placeholder="e.g., Create a timeline of all events in this graph"
              value="\${this.userQuestion}"
            />
          </div>

          <div class="button-group">
            <button class="generate-btn" disabled>
              ⏳ Loading...
            </button>
            <button class="clear-btn">🗑️ Clear</button>
            <button class="export-btn">📥 Export SVG</button>
          </div>
        </div>

        <div class="content">
          <div class="editor-panel" \${!this.editable ? 'style="display:none"' : ''}>
            <div class="editor-header">✏️ Mermaid Syntax Editor</div>
            <textarea id="mermaid-editor" placeholder="Enter Mermaid syntax here or click 'Generate from Graph'..."></textarea>
          </div>

          <div class="preview-panel">
            <div class="preview-header">👁️ Live Preview</div>
            <div class="preview-container">
              <div id="diagram-output" class="diagram-output"></div>
            </div>
          </div>
        </div>
      </div>
    \`
  }

  setupEventListeners() {
    const editor = this.shadowRoot.getElementById('mermaid-editor')
    const generateBtn = this.shadowRoot.querySelector('.generate-btn')
    const clearBtn = this.shadowRoot.querySelector('.clear-btn')
    const exportBtn = this.shadowRoot.querySelector('.export-btn')
    const typeSelect = this.shadowRoot.getElementById('diagram-type-select')
    const questionInput = this.shadowRoot.getElementById('user-question-input')

    // Editor changes
    editor.addEventListener('input', () => {
      this.mermaidCode = editor.value
      this.renderDiagram()
    })

    // Generate from graph
    generateBtn.addEventListener('click', () => this.generateFromGraph())

    // Clear
    clearBtn.addEventListener('click', () => {
      editor.value = ''
      this.mermaidCode = ''
      this.renderDiagram()
    })

    // Export
    exportBtn.addEventListener('click', () => this.exportDiagram())

    // Diagram type change
    typeSelect.addEventListener('change', (e) => {
      this.setAttribute('diagram-type', e.target.value)
      this.updateGenerateButton()
    })

    // Question change
    questionInput.addEventListener('change', (e) => {
      this.setAttribute('user-question', e.target.value)
    })
  }

  async generateFromGraph() {
    if (!this.graphContext) {
      alert('No graph context available. This component needs to be used inside GNewViewer.')
      return
    }

    const question = this.shadowRoot.getElementById('user-question-input').value
    if (!question) {
      alert('Please enter what you want to visualize')
      return
    }

    this.isGenerating = true
    const generateBtn = this.shadowRoot.querySelector('.generate-btn')
    const output = this.shadowRoot.getElementById('diagram-output')

    generateBtn.disabled = true
    generateBtn.textContent = '⏳ Generating...'

    output.innerHTML = '<div class="loading"><div class="spinner"></div>Analyzing graph and generating diagram...</div>'

    try {
      // Check if askAI is available (auto-injected in apps)
      if (typeof askAI !== 'function') {
        throw new Error('askAI function not available. Please ensure this component is used in an AppBuilder-generated app.')
      }

      // Build context for AI
      const context = this.buildGraphContextPrompt()

      // Ask AI to generate Mermaid syntax
      const aiPrompt = \`\${context}

User Request: \${question}

Generate ONLY valid Mermaid.js syntax for a \${this.diagramType} diagram based on the graph data above.

CRITICAL REQUIREMENTS:
1. Return ONLY the Mermaid syntax code - no explanations, no markdown code blocks
2. Start with the diagram type keyword (gantt, flowchart, etc.)
3. Use information from the graph nodes and edges
4. Make it visually clear and well-organized
5. Include meaningful labels and descriptions
6. For Gantt charts, extract or infer dates from node content
7. For flowcharts, use node connections (edges) as arrows
8. For timelines, order nodes chronologically

Example format for Gantt:
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :done, t1, 2024-01-01, 30d
    Task 2 :active, t2, 2024-01-31, 15d

Return ONLY the Mermaid code, nothing else.\`

      console.log('🤖 Sending to AI:', aiPrompt)

      const mermaidSyntax = await askAI(aiPrompt)

      console.log('✅ AI Response:', mermaidSyntax)

      // Clean up the response (remove markdown code blocks if present)
      let cleanedSyntax = mermaidSyntax.trim()
      if (cleanedSyntax.startsWith('\`\`\`')) {
        cleanedSyntax = cleanedSyntax.replace(/\`\`\`mermaid\\n?/g, '').replace(/\`\`\`\\n?/g, '')
      }

      // Update editor and render
      const editor = this.shadowRoot.getElementById('mermaid-editor')
      editor.value = cleanedSyntax
      this.mermaidCode = cleanedSyntax

      await this.renderDiagram()

      this.dispatchEvent(new CustomEvent('diagram-generated', {
        detail: { code: cleanedSyntax, type: this.diagramType }
      }))

    } catch (error) {
      console.error('❌ Generate error:', error)
      output.innerHTML = \`<div class="error-message">
        <strong>Error:</strong> \${error.message}
      </div>\`
    } finally {
      this.isGenerating = false
      generateBtn.disabled = false
      generateBtn.textContent = '🤖 Generate from Graph'
    }
  }

  buildGraphContextPrompt() {
    const { nodes = [], edges = [], metadata = {} } = this.graphContext

    let context = \`KNOWLEDGE GRAPH CONTEXT:\\n\\n\`

    // Graph metadata
    if (metadata.name) {
      context += \`Graph Name: \${metadata.name}\\n\`
    }
    if (metadata.category) {
      context += \`Category: \${metadata.category}\\n\`
    }
    context += \`\\n\`

    // Nodes
    context += \`NODES (\${nodes.length}):\\n\`
    nodes.forEach((node, i) => {
      context += \`\${i + 1}. [\${node.type || 'node'}] \${node.label || 'Untitled'}\\n\`
      if (node.info && node.info.length < 200) {
        context += \`   Content: \${node.info.substring(0, 200)}\\n\`
      }
      if (node.color) {
        context += \`   Color: \${node.color}\\n\`
      }
    })
    context += \`\\n\`

    // Edges
    if (edges.length > 0) {
      context += \`CONNECTIONS (\${edges.length}):\\n\`
      edges.forEach((edge, i) => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        context += \`\${i + 1}. \${sourceNode?.label || edge.source} → \${targetNode?.label || edge.target}\\n\`
      })
    }

    return context
  }

  async renderDiagram() {
    const output = this.shadowRoot.getElementById('diagram-output')

    if (!this.mermaidCode || !this.mermaidCode.trim()) {
      output.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 2rem;">Enter Mermaid syntax or click "Generate from Graph"</div>'
      return
    }

    try {
      // Clear previous diagram
      output.innerHTML = ''

      // Create temp element for Mermaid to render into
      const tempDiv = document.createElement('div')
      tempDiv.className = 'mermaid'
      tempDiv.textContent = this.mermaidCode
      output.appendChild(tempDiv)

      // Render with Mermaid
      await window.mermaid.run({
        nodes: [tempDiv]
      })

      console.log('✅ Diagram rendered successfully')

      this.dispatchEvent(new CustomEvent('diagram-rendered', {
        detail: { type: this.diagramType }
      }))

    } catch (error) {
      console.error('❌ Mermaid render error:', error)
      output.innerHTML = \`<div class="error-message">
        <strong>Syntax Error:</strong> \${error.message}<br>
        <small>Check your Mermaid syntax in the editor</small>
      </div>\`
    }
  }

  async exportDiagram() {
    const svg = this.shadowRoot.querySelector('.mermaid svg')
    if (!svg) {
      alert('No diagram to export. Generate or create a diagram first.')
      return
    }

    try {
      // Get SVG string
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      // Download
      const link = document.createElement('a')
      link.href = svgUrl
      link.download = \`mermaid-\${this.diagramType}-\${Date.now()}.svg\`
      link.click()

      URL.revokeObjectURL(svgUrl)

      console.log('✅ Diagram exported')

      this.dispatchEvent(new CustomEvent('export-complete', {
        detail: { type: 'svg', filename: link.download }
      }))

    } catch (error) {
      console.error('❌ Export error:', error)
      alert('Failed to export diagram')
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.shadowRoot) {
      if (name === 'mermaid-code') {
        this.mermaidCode = newValue
        const editor = this.shadowRoot.getElementById('mermaid-editor')
        if (editor) {
          editor.value = newValue
        }
        this.renderDiagram()
      }
    }
  }
}

// Register the custom element
customElements.define('mermaid-diagram', MermaidDiagram)

console.log('✅ Mermaid Diagram component loaded')
`,
      
    'knowledge-graph-viewer': `/**
 * Knowledge Graph Viewer Web Component
 * A standalone Cytoscape-based knowledge graph visualization component
 * 
 * Usage:
 * <knowledge-graph-viewer
 *   graph-id="graph_123"
 *   width="800px"
 *   height="600px"
 *   layout="cose"
 *   api-endpoint="https://knowledge.vegvisr.org/getknowgraph">
 * </knowledge-graph-viewer>
 * 
 * Public API Methods (call these from JavaScript):
 * - viewer.loadGraph(graphId) - Load a graph by ID from the API
 * - viewer.setGraphData(data) - Set graph data directly (nodes, edges)
 * - viewer.getGraphContext() - Get current graph context (if in GNewViewer)
 * - viewer.isInGNewViewer() - Check if component is inside GNewViewer
 * - viewer.exportGraph(format) - Export as 'png' or 'json'
 * - viewer.centerGraph() - Center and fit graph to view
 * - viewer.applyLayout(layoutName) - Apply layout: 'cose', 'circle', 'grid', etc.
 * - viewer.selectNode(nodeId) - Select a node by ID
 * - viewer.deselectAll() - Deselect all nodes
 * 
 * Features:
 * - Loads and displays knowledge graphs from database
 * - Multiple layout algorithms (cose, circle, grid, breadthfirst, etc.)
 * - Interactive node selection and manipulation
 * - Search functionality
 * - Export to PNG/JSON
 * - Customizable styling
 * - GNewViewer integration support
 */

class KnowledgeGraphViewer extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // State
    this.cyInstance = null
    this.graphData = null
    this.selectedNodes = []
    this.searchQuery = ''
    this.isLoading = false
    this.isComponentReady = false
    this.pendingGraphId = null
  }

  static get observedAttributes() {
    return [
      'graph-id',
      'graph-data',
      'width',
      'height',
      'layout',
      'api-endpoint',
      'show-controls',
      'node-color',
      'edge-color',
      'background-color'
    ]
  }

  connectedCallback() {
    this.loadCytoscapeLibrary().then(() => {
      this.render()
      this.setupEventListeners()
      this.isComponentReady = true

      // Handle pending loadGraph call
      if (this.pendingGraphId) {
        const graphId = this.pendingGraphId
        this.pendingGraphId = null
        this.loadGraph(graphId)
        return
      }

      const graphId = this.getAttribute('graph-id')
      if (graphId) {
        this.loadGraph(graphId)
      } else if (this.getAttribute('graph-data')) {
        try {
          const data = JSON.parse(this.getAttribute('graph-data'))
          this.initializeGraph(data)
        } catch (error) {
          console.error('Failed to parse graph-data:', error)
          this.showError('Invalid graph data format')
        }
      } else {
        this.initializeGraph({ nodes: [], edges: [] })
      }
    })
  }

  disconnectedCallback() {
    if (this.cyInstance) {
      this.cyInstance.destroy()
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.shadowRoot.innerHTML) {
      if (name === 'graph-id' && newValue) {
        this.loadGraph(newValue)
      } else if (name === 'graph-data' && newValue) {
        try {
          const data = JSON.parse(newValue)
          this.initializeGraph(data)
        } catch (error) {
          console.error('Failed to parse graph-data:', error)
        }
      } else if (name === 'layout' && this.cyInstance) {
        this.applyLayout(newValue)
      }
    }
  }

  async loadCytoscapeLibrary() {
    if (window.cytoscape) return
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  get width() { return this.getAttribute('width') || '100%' }
  get height() { return this.getAttribute('height') || '600px' }
  get layout() { return this.getAttribute('layout') || 'cose' }
  get apiEndpoint() { return this.getAttribute('api-endpoint') || 'https://knowledge.vegvisr.org/getknowgraph' }
  get showControls() { return this.getAttribute('show-controls') !== 'false' }
  get nodeColor() { return this.getAttribute('node-color') || '#667eea' }
  get edgeColor() { return this.getAttribute('edge-color') || '#999' }
  get backgroundColor() { return this.getAttribute('background-color') || '#ffffff' }

  render() {
    this.shadowRoot.innerHTML = \\\`
      <style>
        :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
        .graph-container { width: \\\${this.width}; height: \\\${this.height}; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: \\\${this.backgroundColor}; position: relative; }
        #cy { width: 100%; height: 100%; }
        .controls { position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); display: \\\${this.showControls ? 'flex' : 'none'}; flex-direction: column; gap: 8px; z-index: 1000; max-width: 250px; }
        .control-group { display: flex; gap: 6px; flex-wrap: wrap; }
        button { padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        button:hover { background: #f5f5f5; border-color: #667eea; }
        button:active { transform: scale(0.98); }
        button.primary { background: #667eea; color: white; border-color: #667eea; }
        button.primary:hover { background: #5568d3; }
        input[type="text"] { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100%; }
        select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100%; background: white; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 2000; }
        .error { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fee; color: #c00; padding: 20px; border-radius: 8px; border: 1px solid #fcc; z-index: 2000; }
        .stats { font-size: 11px; color: #666; padding: 4px 0; border-top: 1px solid #eee; margin-top: 4px; }
        .hidden { display: none; }
      </style>
      <div class="graph-container">
        <div class="controls">
          <input type="text" id="searchBox" placeholder="Search nodes..." value="\\\${this.searchQuery}" />
          <select id="layoutSelect">
            <option value="cose" \\\${this.layout === 'cose' ? 'selected' : ''}>Force-Directed (COSE)</option>
            <option value="circle" \\\${this.layout === 'circle' ? 'selected' : ''}>Circle</option>
            <option value="grid" \\\${this.layout === 'grid' ? 'selected' : ''}>Grid</option>
            <option value="breadthfirst" \\\${this.layout === 'breadthfirst' ? 'selected' : ''}>Breadth-First</option>
            <option value="concentric" \\\${this.layout === 'concentric' ? 'selected' : ''}>Concentric</option>
            <option value="random" \\\${this.layout === 'random' ? 'selected' : ''}>Random</option>
          </select>
          <div class="control-group">
            <button id="centerBtn" title="Center & Fit">🎯 Center</button>
            <button id="zoomInBtn" title="Zoom In">➕</button>
            <button id="zoomOutBtn" title="Zoom Out">➖</button>
          </div>
          <div class="control-group">
            <button id="exportPNGBtn" title="Export as PNG">📷 PNG</button>
            <button id="exportJSONBtn" title="Export as JSON">💾 JSON</button>
          </div>
          <div class="stats" id="stats">Nodes: 0 | Edges: 0</div>
        </div>
        <div id="cy"></div>
        <div id="loading" class="loading hidden">Loading graph...</div>
        <div id="error" class="error hidden"></div>
      </div>
    \\\`
  }

  setupEventListeners() {
    const searchBox = this.shadowRoot.getElementById('searchBox')
    const layoutSelect = this.shadowRoot.getElementById('layoutSelect')
    const centerBtn = this.shadowRoot.getElementById('centerBtn')
    const zoomInBtn = this.shadowRoot.getElementById('zoomInBtn')
    const zoomOutBtn = this.shadowRoot.getElementById('zoomOutBtn')
    const exportPNGBtn = this.shadowRoot.getElementById('exportPNGBtn')
    const exportJSONBtn = this.shadowRoot.getElementById('exportJSONBtn')
    if (searchBox) searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value))
    if (layoutSelect) layoutSelect.addEventListener('change', (e) => this.applyLayout(e.target.value))
    if (centerBtn) centerBtn.addEventListener('click', () => this.centerGraph())
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoom(1.2))
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoom(0.8))
    if (exportPNGBtn) exportPNGBtn.addEventListener('click', () => this.exportPNG())
    if (exportJSONBtn) exportJSONBtn.addEventListener('click', () => this.exportJSON())
  }

  async loadGraph(graphId) {
    // If component not ready yet, queue the request
    if (!this.isComponentReady) {
      console.log('Component not ready, queuing graph load:', graphId)
      this.pendingGraphId = graphId
      return
    }

    this.showLoading(true)
    this.hideError()
    try {
      const response = await fetch(\\\`\\${this.apiEndpoint}?id=\\${encodeURIComponent(graphId)}\\\`)
      if (!response.ok) throw new Error(\\\`Failed to load graph: \\${response.status}\\\`)
      let graphData = await response.json()
      if (typeof graphData === 'string') graphData = JSON.parse(graphData)
      if (graphData.data) graphData = typeof graphData.data === 'string' ? JSON.parse(graphData.data) : graphData.data
      this.graphData = graphData
      this.initializeGraph(graphData)
      this.dispatchEvent(new CustomEvent('graphLoaded', { detail: { graphId, data: graphData, nodes: graphData.nodes, edges: graphData.edges, metadata: graphData.metadata } }))
    } catch (error) {
      console.error('Error loading graph:', error)
      this.showError(\\\`Failed to load graph: \\${error.message}\\\`)
      this.dispatchEvent(new CustomEvent('error', { detail: { message: error.message, error } }))
    } finally {
      this.showLoading(false)
    }
  }

  initializeGraph(graphData) {
    if (!graphData || !graphData.nodes) {
      console.warn('No graph data provided')
      graphData = { nodes: [], edges: [] }
    }
    
    // Check if all nodes have the same position (common issue with new graphs)
    const positions = graphData.nodes.map(n => n.position).filter(Boolean)
    const allSamePosition = positions.length > 1 && positions.every(p => 
      p.x === positions[0].x && p.y === positions[0].y
    )
    
    // If all positions are the same, don't use them (let layout algorithm handle it)
    const elements = [
      ...graphData.nodes.map(node => ({ 
        data: { id: node.id, label: node.label || node.id, ...node }, 
        position: (allSamePosition ? undefined : node.position) 
      })),
      ...(graphData.edges || []).map(edge => ({ 
        data: { 
          id: edge.id || \\\`\\${edge.source}_\\${edge.target}\\\`, 
          source: edge.source, 
          target: edge.target, 
          label: edge.label, 
          ...edge 
        } 
      }))
    ]
    
    if (this.cyInstance) this.cyInstance.destroy()
    const container = this.shadowRoot.getElementById('cy')
    this.cyInstance = cytoscape({
      container: container,
      elements: elements,
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'background-color': (ele) => ele.data('color') || this.nodeColor, 'color': '#000', 'text-valign': 'center', 'text-halign': 'center', 'font-size': '12px', 'width': 40, 'height': 40, 'border-width': 2, 'border-color': '#555' } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#667eea' } },
        { selector: 'edge', style: { 'width': 2, 'line-color': this.edgeColor, 'target-arrow-color': this.edgeColor, 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': '10px', 'text-rotation': 'autorotate' } },
        { selector: 'edge:selected', style: { 'line-color': '#667eea', 'target-arrow-color': '#667eea', 'width': 3 } }
      ],
      layout: { name: this.layout },
      wheelSensitivity: 0.2
    })
    
    // Always run layout after initialization to ensure proper positioning
    setTimeout(() => {
      if (this.cyInstance) {
        this.cyInstance.layout({ name: this.layout, animate: true }).run()
        this.cyInstance.fit(null, 50)
      }
    }, 100)
    
    this.cyInstance.on('tap', 'node', (evt) => { const node = evt.target; this.dispatchEvent(new CustomEvent('nodeClick', { detail: { node: node.data() } })) })
    this.cyInstance.on('select', 'node', () => { this.selectedNodes = this.cyInstance.\\\$('node:selected').map(n => n.data()); this.updateStats() })
    this.cyInstance.on('unselect', 'node', () => { this.selectedNodes = this.cyInstance.\\\$('node:selected').map(n => n.data()); this.updateStats() })
    this.updateStats()
  }

  applyLayout(layoutName) {
    if (!this.cyInstance) return
    const layout = this.cyInstance.layout({ name: layoutName, animate: true, animationDuration: 500 })
    layout.run()
  }

  handleSearch(query) {
    this.searchQuery = query
    if (!this.cyInstance) return
    if (!query) { this.cyInstance.nodes().removeClass('dimmed'); return }
    const queryLower = query.toLowerCase()
    this.cyInstance.nodes().forEach(node => {
      const label = (node.data('label') || '').toLowerCase()
      const id = (node.data('id') || '').toLowerCase()
      if (label.includes(queryLower) || id.includes(queryLower)) { node.removeClass('dimmed'); node.addClass('highlighted') }
      else { node.addClass('dimmed'); node.removeClass('highlighted') }
    })
    this.cyInstance.style().selector('.dimmed').style({ 'opacity': 0.3 }).selector('.highlighted').style({ 'opacity': 1, 'border-width': 4, 'border-color': '#f39c12' }).update()
  }

  centerGraph() { if (!this.cyInstance) return; this.cyInstance.fit(null, 50) }
  zoom(factor) { if (!this.cyInstance) return; const currentZoom = this.cyInstance.zoom(); this.cyInstance.zoom({ level: currentZoom * factor, renderedPosition: { x: this.cyInstance.width() / 2, y: this.cyInstance.height() / 2 } }) }

  exportPNG() {
    if (!this.cyInstance) return
    const png = this.cyInstance.png({ output: 'blob', bg: this.backgroundColor, full: true, scale: 2 })
    const url = URL.createObjectURL(png)
    const a = document.createElement('a')
    a.href = url
    a.download = \\\`knowledge-graph-\\${Date.now()}.png\\\`
    a.click()
    URL.revokeObjectURL(url)
    this.dispatchEvent(new CustomEvent('export', { detail: { type: 'png' } }))
  }

  exportJSON() {
    if (!this.cyInstance) return
    const data = { nodes: this.cyInstance.nodes().map(n => ({ ...n.data(), position: n.position() })), edges: this.cyInstance.edges().map(e => e.data()) }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = \\\`knowledge-graph-\\${Date.now()}.json\\\`
    a.click()
    URL.revokeObjectURL(url)
    this.dispatchEvent(new CustomEvent('export', { detail: { type: 'json', data } }))
  }

  updateStats() {
    const statsEl = this.shadowRoot.getElementById('stats')
    if (!statsEl || !this.cyInstance) return
    const nodeCount = this.cyInstance.nodes().length
    const edgeCount = this.cyInstance.edges().length
    const selectedCount = this.selectedNodes.length
    let text = \\\`Nodes: \\${nodeCount} | Edges: \\${edgeCount}\\\`
    if (selectedCount > 0) text += \\\` | Selected: \\${selectedCount}\\\`
    statsEl.textContent = text
  }

  showLoading(show) { const loadingEl = this.shadowRoot.getElementById('loading'); if (loadingEl) loadingEl.classList.toggle('hidden', !show); this.isLoading = show }
  showError(message) { const errorEl = this.shadowRoot.getElementById('error'); if (errorEl) { errorEl.textContent = message; errorEl.classList.remove('hidden') } }
  hideError() { const errorEl = this.shadowRoot.getElementById('error'); if (errorEl) errorEl.classList.add('hidden') }

  // ============================================
  // PUBLIC API - Call these methods from JavaScript
  // ============================================
  
  /**
   * Load a graph by ID from the API endpoint
   * @param {string} graphId - The graph ID to load
   * @returns {Promise<void>}
   * @example viewer.loadGraph('graph_123')
   */
  // loadGraph(graphId) - defined above
  
  /**
   * Set graph data directly (bypasses API)
   * @param {Object} data - Graph data with nodes and edges arrays
   * @example viewer.setGraphData({ nodes: [...], edges: [...] })
   */
  setGraphData(data) { 
    if (!this.isComponentReady) {
      console.warn('Component not ready yet, queuing setGraphData')
      setTimeout(() => this.setGraphData(data), 100)
      return
    }
    this.initializeGraph(data) 
  }
  
  /**
   * Get current graph data
   * @returns {Object|null} Graph data with nodes and edges
   */
  getGraphData() { 
    if (!this.cyInstance) return null
    return { 
      nodes: this.cyInstance.nodes().map(n => ({ ...n.data(), position: n.position() })), 
      edges: this.cyInstance.edges().map(e => e.data()) 
    } 
  }
  
  /**
   * Get currently selected nodes
   * @returns {Array} Array of selected node data
   */
  getSelectedNodes() { return this.selectedNodes }
  
  /**
   * Select a node by ID
   * @param {string} nodeId - The node ID to select
   */
  selectNode(nodeId) { if (!this.cyInstance) return; this.cyInstance.\\\$(\\\`#\\${nodeId}\\\`).select() }
  
  /**
   * Deselect all nodes
   */
  deselectAll() { if (!this.cyInstance) return; this.cyInstance.\\\$(':selected').unselect() }
}

customElements.define('knowledge-graph-viewer', KnowledgeGraphViewer)
console.log('✅ Knowledge Graph Viewer component loaded')
`
    }

    const componentCode = components[componentKey]
    
    if (!componentCode) {
      return new Response('Component not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    return new Response(componentCode, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('Error serving component:', error)
    return new Response(`Error serving component: ${error.message}`, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain'
      }
    })
  }
}
