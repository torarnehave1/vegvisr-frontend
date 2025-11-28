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
    this.contextMenuTarget = null
    this.addEdgeMode = false
    this.pendingEdgeFrom = null
    this.isFullscreen = false
    this.currentGraphId = null
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
      'background-color',
      'title'
    ]
  }

  static get version() {
    return '1.1.0'
  }

  connectedCallback() {
    this.loadCytoscapeLibrary().then(async () => {
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
      } else if (this.isInGNewViewer()) {
        // Automatically get graph ID from parent when embedded in GNewViewer
        try {
          const context = await this.getGraphContext()
          if (context && context.graphId) {
            this.setAttribute('graph-id', context.graphId)
            this.loadGraph(context.graphId)
          } else {
            this.initializeGraph({ nodes: [], edges: [] })
          }
        } catch (error) {
          console.error('Failed to get graph context:', error)
          this.initializeGraph({ nodes: [], edges: [] })
        }
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
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
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
      } else if (name === 'title') {
        this.render()
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
  get title() { return this.getAttribute('title') || 'Canvas' }

  /**
   * Helper method to check if a URL is a valid image URL
   * @param {string} url - The URL to check
   * @returns {boolean} True if the URL is a valid image URL
   */
  isValidImageUrl(url) {
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return false
    const lowerUrl = url.toLowerCase()
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const isImageExtension = imageExtensions.some(ext => lowerUrl.endsWith(ext))
    const isImgix = lowerUrl.includes('imgix.net')
    const hasImagePattern = /\/images?\//.test(lowerUrl)
    return isImageExtension || isImgix || hasImagePattern
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: system-ui, -apple-system, sans-serif; }
        .graph-container { width: ${this.width}; height: ${this.height}; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: ${this.backgroundColor}; position: relative; }
        .graph-container.fullscreen { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; border: none; border-radius: 0; }
        .title { position: absolute; top: 10px; left: 10px; background: white; padding: 5px 10px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); font-weight: bold; z-index: 1001; }
        #cy { width: 100%; height: 100%; }
        .controls { position: absolute; top: ${this.title ? '50px' : '10px'}; left: 10px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); display: ${this.showControls ? 'flex' : 'none'}; flex-direction: column; gap: 8px; z-index: 1000; max-width: 250px; }
        .control-group { display: flex; gap: 6px; flex-wrap: wrap; }
        button { padding: 6px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s; }
        button:hover { background: #f5f5f5; border-color: #667eea; }
        button:active { transform: scale(0.98); }
        button.primary { background: #667eea; color: white; border-color: #667eea; }
        button.primary:hover { background: #5568d3; }
        button.active { background: #f39c12; color: white; border-color: #f39c12; }
        input[type="text"] { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100%; }
        select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 100%; background: white; }
        .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 2000; }
        .error { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fee; color: #c00; padding: 20px; border-radius: 8px; border: 1px solid #fcc; z-index: 2000; }
        .stats { font-size: 11px; color: #666; padding: 4px 0; border-top: 1px solid #eee; margin-top: 4px; }
        .hidden { display: none; }
        .context-menu { position: absolute; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); z-index: 3000; padding: 8px; display: none; flex-direction: column; gap: 8px; }
        .context-menu input[type="color"] { border: none; width: 30px; height: 20px; cursor: pointer; }
        .context-menu button { width: 100%; }
        .shape-buttons { display: flex; gap: 4px; }
        .shape-buttons button { flex: 1; padding: 4px 8px; font-size: 10px; }
      </style>
      <div class="graph-container">
        ${this.title ? `<div class="title">${this.title}</div>` : ''}
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
            <button id="fullscreenBtn" title="Toggle Fullscreen" class="${this.isFullscreen ? 'active' : ''}">⛶ Fullscreen</button>
          </div>
          <div class="control-group">
            <button id="savePNGBtn" title="Save Graph as PNG">📷 Save PNG</button>
            <button id="saveSVGBtn" title="Save Graph as SVG">🖼️ Save SVG</button>
            <button id="saveJSONBtn" title="Save Graph as JSON">💾 Save JSON</button>
            <button id="saveHistoryBtn" title="Save with History">📚 Save with History</button>
            <button id="addEdgeBtn" title="Toggle Add Edge Mode" class="${this.addEdgeMode ? 'active' : ''}">➕ Add Edge</button>
            <button id="exportPNGBtn" title="Export as PNG">📷 Export PNG</button>
            <button id="exportSVGBtn" title="Export as SVG">🖼️ Export SVG</button>
            <button id="exportJSONBtn" title="Export as JSON">💾 Export JSON</button>
          </div>
          <div class="stats" id="stats">Nodes: 0 | Edges: 0 | Version: ${this.constructor.version}</div>
        </div>
        <div id="cy"></div>
        <div id="loading" class="loading hidden">Loading graph...</div>
        <div id="error" class="error hidden"></div>
        <div id="contextMenu" class="context-menu">
          <label>Change Color: <input type="color" id="colorPicker" /></label>
          <div class="shape-buttons">
            <button id="shapeCircleBtn" title="Circle">○ Circle</button>
            <button id="shapeSquareBtn" title="Square">□ Square</button>
            <button id="shapeRectangleBtn" title="Rectangle">▭ Rectangle</button>
          </div>
          <button id="showJSONBtn">Show JSON</button>
        </div>
      </div>
    `
  }

  setupEventListeners() {
    const searchBox = this.shadowRoot.getElementById('searchBox')
    const layoutSelect = this.shadowRoot.getElementById('layoutSelect')
    const centerBtn = this.shadowRoot.getElementById('centerBtn')
    const zoomInBtn = this.shadowRoot.getElementById('zoomInBtn')
    const zoomOutBtn = this.shadowRoot.getElementById('zoomOutBtn')
    const fullscreenBtn = this.shadowRoot.getElementById('fullscreenBtn')
    const savePNGBtn = this.shadowRoot.getElementById('savePNGBtn')
    const saveSVGBtn = this.shadowRoot.getElementById('saveSVGBtn')
    const saveJSONBtn = this.shadowRoot.getElementById('saveJSONBtn')
    const saveHistoryBtn = this.shadowRoot.getElementById('saveHistoryBtn')
    const addEdgeBtn = this.shadowRoot.getElementById('addEdgeBtn')
    const exportPNGBtn = this.shadowRoot.getElementById('exportPNGBtn')
    const exportSVGBtn = this.shadowRoot.getElementById('exportSVGBtn')
    const exportJSONBtn = this.shadowRoot.getElementById('exportJSONBtn')
    const colorPicker = this.shadowRoot.getElementById('colorPicker')
    const shapeCircleBtn = this.shadowRoot.getElementById('shapeCircleBtn')
    const shapeSquareBtn = this.shadowRoot.getElementById('shapeSquareBtn')
    const shapeRectangleBtn = this.shadowRoot.getElementById('shapeRectangleBtn')
    const showJSONBtn = this.shadowRoot.getElementById('showJSONBtn')

    if (searchBox) searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value))
    if (layoutSelect) layoutSelect.addEventListener('change', (e) => this.applyLayout(e.target.value))
    if (centerBtn) centerBtn.addEventListener('click', () => this.centerGraph())
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.cyInstance?.zoom(this.cyInstance.zoom() * 1.2))
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.cyInstance?.zoom(this.cyInstance.zoom() * 0.8))
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen())
    if (savePNGBtn) savePNGBtn.addEventListener('click', () => this.saveGraph(this.getAttribute('graph-id'), 'png'))
    if (saveSVGBtn) saveSVGBtn.addEventListener('click', () => this.saveGraph(this.getAttribute('graph-id'), 'svg'))
    if (saveJSONBtn) saveJSONBtn.addEventListener('click', () => this.saveGraph(this.getAttribute('graph-id'), 'json'))
    if (saveHistoryBtn) saveHistoryBtn.addEventListener('click', () => this.saveGraphWithHistory())
    if (addEdgeBtn) addEdgeBtn.addEventListener('click', () => this.toggleAddEdgeMode())
    if (exportPNGBtn) exportPNGBtn.addEventListener('click', () => this.exportGraph('png'))
    if (exportSVGBtn) exportSVGBtn.addEventListener('click', () => this.exportGraph('svg'))
    if (exportJSONBtn) exportJSONBtn.addEventListener('click', () => this.exportGraph('json'))
    if (colorPicker) colorPicker.addEventListener('change', (e) => this.handleColorChange(e.target.value))
    if (shapeCircleBtn) shapeCircleBtn.addEventListener('click', () => this.handleShapeChange('ellipse'))
    if (shapeSquareBtn) shapeSquareBtn.addEventListener('click', () => this.handleShapeChange('square'))
    if (shapeRectangleBtn) shapeRectangleBtn.addEventListener('click', () => this.handleShapeChange('rectangle'))
    if (showJSONBtn) showJSONBtn.addEventListener('click', () => this.showNodeJSON())

    this.handleFullscreenChange = () => this.updateFullscreenButton()
    document.addEventListener('fullscreenchange', this.handleFullscreenChange)
  }

  /**
   * PUBLIC API: Toggle fullscreen mode for the graph
   */
  toggleFullscreen() {
    const graphContainer = this.shadowRoot.querySelector('.graph-container')
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      graphContainer.requestFullscreen().catch(err => console.error('Error entering fullscreen:', err))
    }
  }

  updateFullscreenButton() {
    const graphContainer = this.shadowRoot.querySelector('.graph-container')
    this.isFullscreen = document.fullscreenElement === graphContainer
    graphContainer.classList.toggle('fullscreen', this.isFullscreen)
    const fullscreenBtn = this.shadowRoot.getElementById('fullscreenBtn')
    if (fullscreenBtn) {
      fullscreenBtn.classList.toggle('active', this.isFullscreen)
    }
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
      this.currentGraphId = graphId
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

  /**
   * PUBLIC API: Save the current graph data to the API under the specified graph ID in the specified format
   * @param {string} graphId - The graph ID to save under (optional if currentGraphId is set)
   * @param {string} format - The format to save: 'json', 'png', or 'svg' (default: 'json')
   * @returns {Promise<void>}
   */
  async saveGraph(graphId, format = 'json') {
    if (!graphId) {
      graphId = this.currentGraphId
    }
    if (!graphId) {
      this.showError('No graph ID provided for saving')
      return
    }

    let data
    if (format === 'json') {
      if (!this.cyInstance) {
        this.showError('No graph instance to save')
        return
      }
      // Collect current data from Cytoscape to ensure all changes (including shapes, colors, positions) are saved
      const nodes = this.cyInstance.nodes().map(node => node.data())
      const edges = this.cyInstance.edges().map(edge => edge.data())
      data = { nodes, edges, metadata: this.graphData?.metadata || {} }
    } else if (format === 'png') {
      if (!this.cyInstance) {
        this.showError('No graph instance to export')
        return
      }
      data = this.cyInstance.png({ full: true, scale: 2 })
    } else if (format === 'svg') {
      if (!this.cyInstance) {
        this.showError('No graph instance to export')
        return
      }
      data = this.cyInstance.svg({ full: true, scale: 2 })
    } else {
      this.showError('Unsupported save format')
      return
    }

    this.showLoading(true)
    this.hideError()
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: graphId, data, format })
      })
      if (!response.ok) throw new Error(`Failed to save graph: ${response.status}`)
      this.currentGraphId = graphId
      this.dispatchEvent(new CustomEvent('graphSaved', { detail: { graphId, data, format } }))
    } catch (error) {
      console.error('Error saving graph:', error)
      this.showError(`Failed to save graph: ${error.message}`)
      this.dispatchEvent(new CustomEvent('error', { detail: { message: error.message, error } }))
    } finally {
      this.showLoading(false)
    }
  }

  /**
   * PUBLIC API: Save the current graph data with version history
   * @returns {Promise<void>}
   */
  async saveGraphWithHistory() {
    const graphId = this.currentGraphId
    if (!graphId) {
      this.showError('No graph ID available for saving with history')
      return
    }
    if (!this.graphData) {
      this.showError('No graph data to save')
      return
    }

    // Collect current data from Cytoscape to ensure all changes are saved
    const nodes = this.cyInstance.nodes().map(node => node.data())
    const edges = this.cyInstance.edges().map(edge => edge.data())
    const payload = {
      id: graphId,
      graphData: {
        metadata: this.graphData.metadata || {},
        nodes,
        edges
      },
      override: true
    }

    this.showLoading(true)
    this.hideError()
    try {
      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) throw new Error(`Failed to save graph with history: ${response.status}`)
      this.dispatchEvent(new CustomEvent('graphSavedWithHistory', { detail: { graphId, payload } }))
    } catch (error) {
      console.error('Error saving graph with history:', error)
      this.showError(`Failed to save graph with history: ${error.message}`)
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
    
    const elements = [
      ...graphData.nodes.map(node => {
        const hasPosition = node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number'
        return {
          data: {
            id: node.id,
            label: node.label || node.id,
            shape: node.shape || 'ellipse',
            color: node.color || this.nodeColor,
            width: node.width || (node.shape === 'rectangle' ? 80 : 40),
            height: node.height || (node.shape === 'rectangle' ? 40 : 40),
            ...node
          },
          position: hasPosition ? node.position : undefined
        }
      }),
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

    // Determine layout: use 'preset' if all nodes have valid positions, otherwise use the specified layout
    const allHavePositions = graphData.nodes.every(node => node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number')
    const layoutName = allHavePositions ? 'preset' : this.layout

    this.cyInstance = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-image': (ele) => {
              const path = ele.data('path')
              return this.isValidImageUrl(path) ? path : undefined
            },
            'background-fit': 'cover',
            'background-width': '100%',
            'background-height': '100%',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'color': '#333',
            'text-outline-color': '#fff',
            'text-outline-width': 2,
            'width': 'data(width)',
            'height': 'data(height)',
            'shape': 'data(shape)'
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
        },
        {
          selector: 'node.pending',
          style: {
            'border-width': 3,
            'border-color': '#e74c3c'
          }
        }
      ],
      layout: { name: layoutName },
      boxSelectionEnabled: !this.addEdgeMode,
      selectionType: 'single',
      autounselectify: false,
      userPanningEnabled: true
    })

    this.cyInstance.on('tap', 'node', (event) => {
      const node = event.target
      if (this.addEdgeMode) {
        this.handleAddEdgeTap(node)
      } else {
        const ctrlKey = event.originalEvent.ctrlKey || event.originalEvent.metaKey
        if (!ctrlKey) {
          this.cyInstance.nodes().unselect()
        }
        node.select()
        this.dispatchEvent(new CustomEvent('nodeSelected', { detail: { node: node.data() } }))
      }
    })

    this.cyInstance.on('dbltap', 'node', (event) => {
      event.originalEvent.preventDefault()
      event.originalEvent.stopPropagation()
      this.contextMenuTarget = event.target
      this.showContextMenu(event.renderedPosition.x, event.renderedPosition.y)
    })

    this.updateStats()
  }

  handleAddEdgeTap(node) {
    if (this.pendingEdgeFrom) {
      if (this.pendingEdgeFrom !== node.id()) {
        this.addEdge(this.pendingEdgeFrom, node.id())
      }
      this.pendingEdgeFrom = null
      this.cyInstance.nodes().removeClass('pending')
    } else {
      this.pendingEdgeFrom = node.id()
      node.addClass('pending')
    }
  }

  /**
   * PUBLIC API: Add an edge between two nodes (if not already exists)
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {string} label - Optional edge label
   */
  addEdge(sourceId, targetId, label = '') {
    if (!this.graphData) return
    const exists = this.graphData.edges.some(e => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId))
    if (!exists) {
      const edgeId = `${sourceId}_${targetId}_${Date.now()}`
      const edge = { id: edgeId, source: sourceId, target: targetId, label }
      this.graphData.edges.push(edge)
      this.cyInstance.add({ data: edge })
      this.updateStats()
      this.dispatchEvent(new CustomEvent('edgeAdded', { detail: { edge } }))
    }
  }

  /**
   * PUBLIC API: Toggle add edge mode on/off
   */
  toggleAddEdgeMode() {
    this.addEdgeMode = !this.addEdgeMode
    this.pendingEdgeFrom = null
    if (this.cyInstance) {
      this.cyInstance.nodes().removeClass('pending')
      this.cyInstance.boxSelectionEnabled(!this.addEdgeMode)
    }
    const addEdgeBtn = this.shadowRoot.getElementById('addEdgeBtn')
    if (addEdgeBtn) {
      addEdgeBtn.classList.toggle('active', this.addEdgeMode)
    }
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
   * PUBLIC API: Get the current graph data
   * @returns {Object} The current graph data with nodes and edges
   */
  getGraphData() {
    return this.graphData
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
   * PUBLIC API: Export graph as PNG, SVG, or JSON
   * @param {string} format - 'png', 'svg', or 'json'
   */
  exportGraph(format = 'png') {
    if (!this.cyInstance) return
    
    if (format === 'png') {
      const png = this.cyInstance.png({ full: true, scale: 2 })
      const link = document.createElement('a')
      link.href = png
      link.download = `graph-${Date.now()}.png`
      link.click()
    } else if (format === 'svg') {
      const svg = this.cyInstance.svg({ full: true, scale: 2 })
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `graph-${Date.now()}.svg`
      link.click()
      URL.revokeObjectURL(url)
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

  /**
   * PUBLIC API: Change the color of a specific node
   * @param {string} nodeId - The ID of the node to change color
   * @param {string} color - The new color (e.g., '#ff0000' or 'red')
   */
  changeNodeColor(nodeId, color) {
    if (this.cyInstance) {
      const node = this.cyInstance.getElementById(nodeId)
      if (node && node.isNode()) {
        node.data('color', color)
        // Update graphData
        const graphNode = this.graphData.nodes.find(n => n.id === nodeId)
        if (graphNode) {
          graphNode.color = color
        }
      }
    }
  }

  showContextMenu(x, y) {
    const contextMenu = this.shadowRoot.getElementById('contextMenu')
    const graphContainer = this.shadowRoot.querySelector('.graph-container')
    const rect = graphContainer.getBoundingClientRect()
    contextMenu.style.left = `${x}px`
    contextMenu.style.top = `${y}px`
    contextMenu.style.display = 'block'
    setTimeout(() => {
      const handleClickOutside = (e) => {
        if (!contextMenu.contains(e.target)) {
          this.hideContextMenu()
          this.shadowRoot.removeEventListener('click', handleClickOutside)
        }
      }
      this.shadowRoot.addEventListener('click', handleClickOutside)
    }, 10)
  }

  hideContextMenu() {
    const contextMenu = this.shadowRoot.getElementById('contextMenu')
    contextMenu.style.display = 'none'
    this.contextMenuTarget = null
  }

  handleColorChange(color) {
    if (this.contextMenuTarget) {
      this.changeNodeColor(this.contextMenuTarget.id(), color)
      this.hideContextMenu()
    }
  }

  handleShapeChange(shape) {
    if (this.contextMenuTarget) {
      const width = shape === 'rectangle' ? 80 : 40
      const height = shape === 'rectangle' ? 40 : 40
      this.contextMenuTarget.data('shape', shape)
      this.contextMenuTarget.data('width', width)
      this.contextMenuTarget.data('height', height)
      // Update graphData
      const graphNode = this.graphData.nodes.find(n => n.id === this.contextMenuTarget.id())
      if (graphNode) {
        graphNode.shape = shape
        graphNode.width = width
        graphNode.height = height
      }
      this.hideContextMenu()
    }
  }

  showNodeJSON() {
    if (this.contextMenuTarget) {
      const json = JSON.stringify(this.contextMenuTarget.data(), null, 2)
      alert(json)
      this.hideContextMenu()
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
      stats.textContent = `Nodes: ${nodeCount} | Edges: ${edgeCount} | Version: ${this.constructor.version}`
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
