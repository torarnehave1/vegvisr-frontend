/**
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
 * Features:
 * - Loads and displays knowledge graphs from database
 * - Multiple layout algorithms (cose, circle, grid, breadthfirst, etc.)
 * - Interactive node selection and manipulation
 * - Search functionality
 * - Export to PNG/JSON
 * - Customizable styling
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
    this.graphContext = null // Graph context from GNewViewer
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
      
      // Try to get graph context from GNewViewer
      this.requestGraphContext()

      // Load graph if graph-id is provided
      const graphId = this.getAttribute('graph-id')
      if (graphId) {
        this.loadGraph(graphId)
      }
      // Or use inline graph-data if provided
      else if (this.getAttribute('graph-data')) {
        try {
          const data = JSON.parse(this.getAttribute('graph-data'))
          this.initializeGraph(data)
        } catch (error) {
          console.error('Failed to parse graph-data:', error)
          this.showError('Invalid graph data format')
        }
      }
      // Or if no graph-id/data provided, try to use graph context from GNewViewer
      else if (this.graphContext && this.graphContext.graphId) {
        console.log('📊 Auto-loading graph from GNewViewer context:', this.graphContext.graphId)
        this.loadGraph(this.graphContext.graphId)
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
    // Check if Cytoscape is already loaded
    if (window.cytoscape) {
      return
    }

    // Load Cytoscape.js from CDN
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.28.1/cytoscape.min.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  get width() {
    return this.getAttribute('width') || '100%'
  }

  get height() {
    return this.getAttribute('height') || '600px'
  }

  get layout() {
    return this.getAttribute('layout') || 'cose'
  }

  get apiEndpoint() {
    return this.getAttribute('api-endpoint') || 'https://knowledge.vegvisr.org/getknowgraph'
  }

  get showControls() {
    return this.getAttribute('show-controls') !== 'false'
  }

  get nodeColor() {
    return this.getAttribute('node-color') || '#667eea'
  }

  get edgeColor() {
    return this.getAttribute('edge-color') || '#999'
  }

  get backgroundColor() {
    return this.getAttribute('background-color') || '#ffffff'
  }

  requestGraphContext() {
    console.log('🔍 Knowledge Graph Viewer: Requesting graph context...')

    // Wait a tick to allow inline scripts to execute first
    setTimeout(() => {
      // First, check if graph context was injected by GNewViewer
      if (window.__GRAPH_CONTEXT__) {
        console.log('✅ Found injected graph context:', window.__GRAPH_CONTEXT__)
        this.graphContext = window.__GRAPH_CONTEXT__
        this.updateStatsWithContext()
        return
      }

      console.log('📡 No injected context found, trying postMessage...')
      this.requestViaPostMessage()
    }, 0)
  }

  requestViaPostMessage() {
    // Fallback to postMessage for compatibility
    const requestId = Date.now() + Math.random()

    console.log('📡 Requesting graph context via postMessage with requestId:', requestId)

    const handler = (event) => {
      if (event.data.type === 'GRAPH_CONTEXT_RESPONSE' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler)
        this.graphContext = event.data.context
        console.log('📊 Received graph context via postMessage:', this.graphContext)
        this.updateStatsWithContext()
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

  updateStatsWithContext() {
    if (this.graphContext) {
      const statsEl = this.shadowRoot.getElementById('stats')
      if (statsEl) {
        statsEl.innerHTML = `
          <div style="font-size: 10px; color: #667eea; margin-bottom: 4px;">
            📊 Connected to: ${this.graphContext.metadata?.name || this.graphContext.graphId}
          </div>
          <div>Nodes: 0 | Edges: 0</div>
        `
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .graph-container {
          width: ${this.width};
          height: ${this.height};
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
          background: ${this.backgroundColor};
          position: relative;
        }

        #cy {
          width: 100%;
          height: 100%;
        }

        .controls {
          position: absolute;
          top: 10px;
          left: 10px;
          background: white;
          padding: 10px;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          display: ${this.showControls ? 'flex' : 'none'};
          flex-direction: column;
          gap: 8px;
          z-index: 1000;
          max-width: 250px;
        }

        .control-group {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        button:hover {
          background: #f5f5f5;
          border-color: #667eea;
        }

        button:active {
          transform: scale(0.98);
        }

        button.primary {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        button.primary:hover {
          background: #5568d3;
        }

        input[type="text"] {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          width: 100%;
        }

        select {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          width: 100%;
          background: white;
        }

        .loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px 40px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          z-index: 2000;
        }

        .error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #fee;
          color: #c00;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #fcc;
          z-index: 2000;
        }

        .stats {
          font-size: 11px;
          color: #666;
          padding: 4px 0;
          border-top: 1px solid #eee;
          margin-top: 4px;
        }

        .hidden {
          display: none;
        }
      </style>

      <div class="graph-container">
        <div class="controls">
          <input
            type="text"
            id="searchBox"
            placeholder="Search nodes..."
            value="${this.searchQuery}"
          />
          
          <select id="layoutSelect">
            <option value="cose" ${this.layout === 'cose' ? 'selected' : ''}>Force-Directed (COSE)</option>
            <option value="circle" ${this.layout === 'circle' ? 'selected' : ''}>Circle</option>
            <option value="grid" ${this.layout === 'grid' ? 'selected' : ''}>Grid</option>
            <option value="breadthfirst" ${this.layout === 'breadthfirst' ? 'selected' : ''}>Breadth-First</option>
            <option value="concentric" ${this.layout === 'concentric' ? 'selected' : ''}>Concentric</option>
            <option value="random" ${this.layout === 'random' ? 'selected' : ''}>Random</option>
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

          <div class="stats" id="stats">
            Nodes: 0 | Edges: 0
          </div>
        </div>

        <div id="cy"></div>
        
        <div id="loading" class="loading hidden">
          Loading graph...
        </div>

        <div id="error" class="error hidden"></div>
      </div>
    `
  }

  setupEventListeners() {
    const searchBox = this.shadowRoot.getElementById('searchBox')
    const layoutSelect = this.shadowRoot.getElementById('layoutSelect')
    const centerBtn = this.shadowRoot.getElementById('centerBtn')
    const zoomInBtn = this.shadowRoot.getElementById('zoomInBtn')
    const zoomOutBtn = this.shadowRoot.getElementById('zoomOutBtn')
    const exportPNGBtn = this.shadowRoot.getElementById('exportPNGBtn')
    const exportJSONBtn = this.shadowRoot.getElementById('exportJSONBtn')

    if (searchBox) {
      searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value))
    }

    if (layoutSelect) {
      layoutSelect.addEventListener('change', (e) => this.applyLayout(e.target.value))
    }

    if (centerBtn) {
      centerBtn.addEventListener('click', () => this.centerGraph())
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoom(1.2))
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoom(0.8))
    }

    if (exportPNGBtn) {
      exportPNGBtn.addEventListener('click', () => this.exportPNG())
    }

    if (exportJSONBtn) {
      exportJSONBtn.addEventListener('click', () => this.exportJSON())
    }
  }

  async loadGraph(graphId) {
    this.showLoading(true)
    this.hideError()

    try {
      const response = await fetch(`${this.apiEndpoint}?id=${encodeURIComponent(graphId)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load graph: ${response.status}`)
      }

      let graphData = await response.json()

      // Handle case where graph data is stored as JSON string
      if (typeof graphData === 'string') {
        graphData = JSON.parse(graphData)
      }

      // Extract data if it's nested
      if (graphData.data) {
        graphData = typeof graphData.data === 'string' 
          ? JSON.parse(graphData.data) 
          : graphData.data
      }

      this.graphData = graphData
      this.initializeGraph(graphData)

      // Emit event
      this.dispatchEvent(new CustomEvent('graphLoaded', {
        detail: { graphId, data: graphData }
      }))

    } catch (error) {
      console.error('Error loading graph:', error)
      this.showError(`Failed to load graph: ${error.message}`)
    } finally {
      this.showLoading(false)
    }
  }

  initializeGraph(graphData) {
    if (!graphData || !graphData.nodes) {
      console.warn('No graph data provided')
      graphData = { nodes: [], edges: [] }
    }

    // Prepare elements for Cytoscape
    const elements = [
      ...graphData.nodes.map(node => ({
        data: {
          id: node.id,
          label: node.label || node.id,
          ...node
        },
        position: node.position || undefined
      })),
      ...(graphData.edges || []).map(edge => ({
        data: {
          id: edge.id || `${edge.source}_${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          ...edge
        }
      }))
    ]

    // Destroy existing instance
    if (this.cyInstance) {
      this.cyInstance.destroy()
    }

    // Create Cytoscape instance
    const container = this.shadowRoot.getElementById('cy')
    
    this.cyInstance = cytoscape({
      container: container,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': (ele) => ele.data('color') || this.nodeColor,
            'color': '#000',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'width': 40,
            'height': 40,
            'border-width': 2,
            'border-color': '#555'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#667eea'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': this.edgeColor,
            'target-arrow-color': this.edgeColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'text-rotation': 'autorotate'
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#667eea',
            'target-arrow-color': '#667eea',
            'width': 3
          }
        }
      ],
      layout: {
        name: this.layout
      },
      wheelSensitivity: 0.2
    })

    // Setup Cytoscape event listeners
    this.cyInstance.on('tap', 'node', (evt) => {
      const node = evt.target
      this.dispatchEvent(new CustomEvent('nodeClick', {
        detail: { node: node.data() }
      }))
    })

    this.cyInstance.on('select', 'node', () => {
      this.selectedNodes = this.cyInstance.$('node:selected').map(n => n.data())
      this.updateStats()
    })

    this.cyInstance.on('unselect', 'node', () => {
      this.selectedNodes = this.cyInstance.$('node:selected').map(n => n.data())
      this.updateStats()
    })

    this.updateStats()
  }

  applyLayout(layoutName) {
    if (!this.cyInstance) return

    const layout = this.cyInstance.layout({
      name: layoutName,
      animate: true,
      animationDuration: 500
    })

    layout.run()
  }

  handleSearch(query) {
    this.searchQuery = query

    if (!this.cyInstance) return

    if (!query) {
      // Reset all nodes
      this.cyInstance.nodes().removeClass('dimmed')
      return
    }

    const queryLower = query.toLowerCase()

    this.cyInstance.nodes().forEach(node => {
      const label = (node.data('label') || '').toLowerCase()
      const id = (node.data('id') || '').toLowerCase()
      
      if (label.includes(queryLower) || id.includes(queryLower)) {
        node.removeClass('dimmed')
        node.addClass('highlighted')
      } else {
        node.addClass('dimmed')
        node.removeClass('highlighted')
      }
    })

    // Update styles for search
    this.cyInstance.style()
      .selector('.dimmed')
      .style({ 'opacity': 0.3 })
      .selector('.highlighted')
      .style({ 
        'opacity': 1,
        'border-width': 4,
        'border-color': '#f39c12'
      })
      .update()
  }

  centerGraph() {
    if (!this.cyInstance) return
    this.cyInstance.fit(null, 50)
  }

  zoom(factor) {
    if (!this.cyInstance) return
    const currentZoom = this.cyInstance.zoom()
    this.cyInstance.zoom({
      level: currentZoom * factor,
      renderedPosition: { 
        x: this.cyInstance.width() / 2, 
        y: this.cyInstance.height() / 2 
      }
    })
  }

  exportPNG() {
    if (!this.cyInstance) return

    const png = this.cyInstance.png({
      output: 'blob',
      bg: this.backgroundColor,
      full: true,
      scale: 2
    })

    const url = URL.createObjectURL(png)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-graph-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)

    this.dispatchEvent(new CustomEvent('export', {
      detail: { type: 'png' }
    }))
  }

  exportJSON() {
    if (!this.cyInstance) return

    const data = {
      nodes: this.cyInstance.nodes().map(n => ({
        ...n.data(),
        position: n.position()
      })),
      edges: this.cyInstance.edges().map(e => e.data())
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-graph-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    this.dispatchEvent(new CustomEvent('export', {
      detail: { type: 'json', data }
    }))
  }

  updateStats() {
    const statsEl = this.shadowRoot.getElementById('stats')
    if (!statsEl || !this.cyInstance) return

    const nodeCount = this.cyInstance.nodes().length
    const edgeCount = this.cyInstance.edges().length
    const selectedCount = this.selectedNodes.length

    let text = `Nodes: ${nodeCount} | Edges: ${edgeCount}`
    if (selectedCount > 0) {
      text += ` | Selected: ${selectedCount}`
    }

    statsEl.textContent = text
  }

  showLoading(show) {
    const loadingEl = this.shadowRoot.getElementById('loading')
    if (loadingEl) {
      loadingEl.classList.toggle('hidden', !show)
    }
    this.isLoading = show
  }

  showError(message) {
    const errorEl = this.shadowRoot.getElementById('error')
    if (errorEl) {
      errorEl.textContent = message
      errorEl.classList.remove('hidden')
    }
  }

  hideError() {
    const errorEl = this.shadowRoot.getElementById('error')
    if (errorEl) {
      errorEl.classList.add('hidden')
    }
  }

  // Public API methods
  getGraphData() {
    if (!this.cyInstance) return null
    
    return {
      nodes: this.cyInstance.nodes().map(n => ({
        ...n.data(),
        position: n.position()
      })),
      edges: this.cyInstance.edges().map(e => e.data())
    }
  }

  setGraphData(data) {
    this.initializeGraph(data)
  }

  getSelectedNodes() {
    return this.selectedNodes
  }

  selectNode(nodeId) {
    if (!this.cyInstance) return
    this.cyInstance.$(`#${nodeId}`).select()
  }

  deselectAll() {
    if (!this.cyInstance) return
    this.cyInstance.$(':selected').unselect()
  }

  // Get graph context from GNewViewer
  getGraphContext() {
    return this.graphContext
  }

  // Check if running inside GNewViewer
  isInGNewViewer() {
    return !!this.graphContext
  }
}

// Register the custom element
customElements.define('knowledge-graph-viewer', KnowledgeGraphViewer)
