// Component serving handler
export async function handleServeComponent(request, env, pathname) {
  try {
    // Extract component name from path: /components/canvas-drawing.js -> canvas-drawing
    const componentName = pathname.replace('/components/', '').replace('.js', '')

    // Map of available components
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
`
    }

    const componentCode = components[componentName]

    if (!componentCode) {
      return new Response('Component not found', {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
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
