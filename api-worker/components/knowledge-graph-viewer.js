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
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
        .graph-container { width: ${this.width}; height: ${this.height}; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: ${this.backgroundColor}; position: relative; }
        #cy { width: 100%; height: 100%; }
        .controls { position: absolute; top: 10px; left: 10px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); display: ${this.showControls ? 'flex' : 'none'}; flex-direction: column; gap: 8px; z-index: 1000; max-width: 250px; }
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
          <input type="text" id="searchBox" placeholder="Search nodes..." value="${this.searchQuery}" />
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
          <div class="stats" id="stats">Nodes: 0 | Edges: 0</div>
        </div>
        <div id="cy"></div>
        <div id="loading" class="loading hidden">Loading graph...</div>
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

    if (searchBox) searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value))
    if (layoutSelect) layoutSelect.addEventListener('change', (e) => this.applyLayout(e.target.value))
    if (centerBtn) centerBtn.addEventListener('click', () => this.centerGraph())
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.cyInstance?.zoom(this.cyInstance.zoom() * 1.2))
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.cyInstance?.zoom(this.cyInstance.zoom() * 0.8))
    if (exportPNGBtn) exportPNGBtn.addEventListener('click', () => this.exportGraph('png'))
    if (exportJSONBtn) exportJSONBtn.addEventListener('click', () => this.exportGraph('json'))
  }

  /**
   * PUBLIC API: Load a graph by ID from the API
   * @param {string} graphId - The graph ID to load
   * @returns {Promise<void>}
   */
  async loadGraph(graphId) {
    if (!this.isComponentReady) {
      console.log('Component not ready, queuing graph load:', graphId)
      this.pendingGraphId = graphId
      return
    }

    this.showLoading(true)
    this.hideError()
    try {
      const response = await fetch(`${this.apiEndpoint}?id=${encodeURIComponent(graphId)}`)
      if (!response.ok) throw new Error(`Failed to load graph: ${response.status}`)
      let graphData = await response.json()
      if (typeof graphData === 'string') graphData = JSON.parse(graphData)
      if (graphData.data) graphData = typeof graphData.data === 'string' ? JSON.parse(graphData.data) : graphData.data
      this.graphData = graphData
      this.initializeGraph(graphData)
      this.dispatchEvent(new CustomEvent('graphLoaded', { detail: { graphId, data: graphData, nodes: graphData.nodes, edges: graphData.edges, metadata: graphData.metadata } }))
    } catch (error) {
      console.error('Error loading graph:', error)
      this.showError(`Failed to load graph: ${error.message}`)
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
          id: edge.id || `${edge.source}_${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          ...edge
        }
      }))
    ]

    const container = this.shadowRoot.getElementById('cy')
    if (this.cyInstance) {
      this.cyInstance.destroy()
    }

    this.cyInstance = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': this.nodeColor,
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'color': '#333',
            'text-outline-color': '#fff',
            'text-outline-width': 2,
            'width': '40px',
            'height': '40px'
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
          selector: 'node:selected',
          style: {
            'background-color': '#f39c12',
            'border-width': 3,
            'border-color': '#e67e22'
          }
        }
      ],
      layout: { name: this.layout }
    })

    this.cyInstance.on('tap', 'node', (event) => {
      const node = event.target
      this.dispatchEvent(new CustomEvent('nodeSelected', { detail: { node: node.data() } }))
    })

    this.updateStats()
  }

  /**
   * PUBLIC API: Set graph data directly
   * @param {Object} data - Graph data with nodes and edges
   * @returns {Promise<void>}
   */
  async setGraphData(data) {
    if (!this.isComponentReady) {
      console.log('Component not ready, will set data when ready')
      await new Promise(resolve => setTimeout(resolve, 100))
      return this.setGraphData(data)
    }
    this.graphData = data
    this.initializeGraph(data)
  }

  /**
   * PUBLIC API: Get current graph context (for GNewViewer integration)
   * @returns {Promise<Object|null>}
   */
  async getGraphContext() {
    return new Promise((resolve) => {
      window.addEventListener('message', function handler(event) {
        if (event.data.type === 'GRAPH_CONTEXT_RESPONSE') {
          window.removeEventListener('message', handler)
          resolve(event.data.context)
        }
      })
      window.parent.postMessage({ type: 'GET_GRAPH_CONTEXT' }, '*')
      setTimeout(() => resolve(null), 1000)
    })
  }

  /**
   * PUBLIC API: Check if running inside GNewViewer
   * @returns {boolean}
   */
  isInGNewViewer() {
    return window.parent !== window
  }

  /**
   * PUBLIC API: Export graph as PNG or JSON
   * @param {string} format - 'png' or 'json'
   */
  exportGraph(format = 'png') {
    if (!this.cyInstance) return

    if (format === 'png') {
      const png = this.cyInstance.png({ full: true, scale: 2 })
      const link = document.createElement('a')
      link.href = png
      link.download = `graph-${Date.now()}.png`
      link.click()
    } else if (format === 'json') {
      const json = JSON.stringify(this.graphData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `graph-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  /**
   * PUBLIC API: Center and fit graph to view
   */
  centerGraph() {
    if (this.cyInstance) {
      this.cyInstance.fit(null, 50)
      this.cyInstance.center()
    }
  }

  /**
   * PUBLIC API: Apply a layout algorithm
   * @param {string} layoutName - Layout name: 'cose', 'circle', 'grid', etc.
   */
  applyLayout(layoutName = 'cose') {
    if (this.cyInstance) {
      this.cyInstance.layout({ name: layoutName }).run()
      this.setAttribute('layout', layoutName)
    }
  }

  /**
   * PUBLIC API: Select a node by ID
   * @param {string} nodeId - Node ID to select
   */
  selectNode(nodeId) {
    if (this.cyInstance) {
      this.cyInstance.nodes().unselect()
      this.cyInstance.getElementById(nodeId).select()
    }
  }

  /**
   * PUBLIC API: Deselect all nodes
   */
  deselectAll() {
    if (this.cyInstance) {
      this.cyInstance.nodes().unselect()
    }
  }

  handleSearch(query) {
    this.searchQuery = query
    if (!this.cyInstance) return

    if (!query) {
      this.cyInstance.nodes().style('opacity', 1)
      return
    }

    const lowerQuery = query.toLowerCase()
    this.cyInstance.nodes().forEach(node => {
      const label = (node.data('label') || '').toLowerCase()
      const match = label.includes(lowerQuery)
      node.style('opacity', match ? 1 : 0.2)
    })
  }

  updateStats() {
    const stats = this.shadowRoot.getElementById('stats')
    if (stats && this.cyInstance) {
      const nodeCount = this.cyInstance.nodes().length
      const edgeCount = this.cyInstance.edges().length
      stats.textContent = `Nodes: ${nodeCount} | Edges: ${edgeCount}`
    }
  }

  showLoading(show) {
    const loading = this.shadowRoot.getElementById('loading')
    if (loading) {
      loading.classList.toggle('hidden', !show)
    }
    this.isLoading = show
  }

  hideError() {
    const error = this.shadowRoot.getElementById('error')
    if (error) {
      error.classList.add('hidden')
    }
  }

  showError(message) {
    const error = this.shadowRoot.getElementById('error')
    if (error) {
      error.textContent = message
      error.classList.remove('hidden')
    }
  }
}

customElements.define('knowledge-graph-viewer', KnowledgeGraphViewer)
