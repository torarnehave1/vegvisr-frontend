/**
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
    this.diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
    // Ask parent window for graph context
    let requestCounter = 0

    const requestId = ++requestCounter

    const handler = (event) => {
      if (event.data.type === 'GRAPH_CONTEXT_RESPONSE' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler)
        this.graphContext = event.data.context
        console.log('📊 Received graph context:', this.graphContext)
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
      window.parent.postMessage({
        type: 'GET_GRAPH_CONTEXT',
        requestId
      }, '*')
    }
  }

  updateGenerateButton() {
    const btn = this.shadowRoot.querySelector('.generate-btn')
    if (btn) {
      if (this.graphContext) {
        btn.disabled = false
        btn.textContent = '🤖 Generate from Graph'
        btn.title = `Generate ${this.diagramType} from ${this.graphContext.nodes?.length || 0} nodes`
      } else {
        btn.disabled = true
        btn.textContent = '⚠️ No Graph Context'
        btn.title = 'Component needs to be in GNewViewer to access graph data'
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
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
          <span class="diagram-type-badge">${this.diagramType}</span>
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
              value="${this.userQuestion}"
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
          <div class="editor-panel" ${!this.editable ? 'style="display:none"' : ''}>
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
    `
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
      const aiPrompt = `${context}

User Request: ${question}

Generate ONLY valid Mermaid.js syntax for a ${this.diagramType} diagram based on the graph data above.

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

Return ONLY the Mermaid code, nothing else.`

      console.log('🤖 Sending to AI:', aiPrompt)

      const mermaidSyntax = await askAI(aiPrompt)

      console.log('✅ AI Response:', mermaidSyntax)

      // Clean up the response (remove markdown code blocks if present)
      let cleanedSyntax = mermaidSyntax.trim()
      if (cleanedSyntax.startsWith('```')) {
        cleanedSyntax = cleanedSyntax.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '')
      }

      // Update editor and render
      const editor = this.shadowRoot.getElementById('mermaid-editor')
      editor.value = cleanedSyntax
      this.mermaidCode = cleanedSyntax

      await this.renderDiagram()

    } catch (error) {
      console.error('❌ Generate error:', error)
      output.innerHTML = `<div class="error-message">
        <strong>Error:</strong> ${error.message}
      </div>`
    } finally {
      this.isGenerating = false
      generateBtn.disabled = false
      generateBtn.textContent = '🤖 Generate from Graph'
    }
  }

  buildGraphContextPrompt() {
    const { nodes = [], edges = [], metadata = {} } = this.graphContext

    let context = `KNOWLEDGE GRAPH CONTEXT:\n\n`

    // Graph metadata
    if (metadata.name) {
      context += `Graph Name: ${metadata.name}\n`
    }
    if (metadata.category) {
      context += `Category: ${metadata.category}\n`
    }
    context += `\n`

    // Nodes
    context += `NODES (${nodes.length}):\n`
    nodes.forEach((node, i) => {
      context += `${i + 1}. [${node.type || 'node'}] ${node.label || 'Untitled'}\n`
      if (node.info && node.info.length < 200) {
        context += `   Content: ${node.info.substring(0, 200)}\n`
      }
      if (node.color) {
        context += `   Color: ${node.color}\n`
      }
    })
    context += `\n`

    // Edges
    if (edges.length > 0) {
      context += `CONNECTIONS (${edges.length}):\n`
      edges.forEach((edge, i) => {
        const sourceNode = nodes.find(n => n.id === edge.source)
        const targetNode = nodes.find(n => n.id === edge.target)
        context += `${i + 1}. ${sourceNode?.label || edge.source} → ${targetNode?.label || edge.target}\n`
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

    } catch (error) {
      console.error('❌ Mermaid render error:', error)
      output.innerHTML = `<div class="error-message">
        <strong>Syntax Error:</strong> ${error.message}<br>
        <small>Check your Mermaid syntax in the editor</small>
      </div>`
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
      link.download = `mermaid-${this.diagramType}-${Date.now()}.svg`
      link.click()

      URL.revokeObjectURL(svgUrl)

      console.log('✅ Diagram exported')
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
