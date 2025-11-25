/**
 * Vegvisr Graph Context Helper
 *
 * Drop this into any app to easily access Knowledge Graph context.
 * Works automatically when app runs inside GNewViewer.
 *
 * Usage:
 *   <script src="graph-context-helper.js"></script>
 *   <script>
 *     if (GraphContext.isAvailable()) {
 *       console.log('Connected to graph with', GraphContext.getNodeCount(), 'nodes')
 *     }
 *   </script>
 */

const GraphContext = (() => {
  // Private: Get raw context object
  const getContext = () => window.__GRAPH_CONTEXT__ || null

  return {
    /**
     * Check if graph context is available
     * @returns {boolean}
     */
    isAvailable() {
      return !!getContext()
    },

    /**
     * Get all nodes
     * @returns {Array}
     */
    getNodes() {
      return getContext()?.nodes || []
    },

    /**
     * Get all edges
     * @returns {Array}
     */
    getEdges() {
      return getContext()?.edges || []
    },

    /**
     * Get graph metadata
     * @returns {Object}
     */
    getMetadata() {
      return getContext()?.metadata || {}
    },

    /**
     * Get count of nodes
     * @returns {number}
     */
    getNodeCount() {
      return this.getNodes().length
    },

    /**
     * Get count of edges
     * @returns {number}
     */
    getEdgeCount() {
      return this.getEdges().length
    },

    /**
     * Find a node by ID
     * @param {string} id - Node ID
     * @returns {Object|null}
     */
    getNodeById(id) {
      return this.getNodes().find(node => node.id === id) || null
    },

    /**
     * Find nodes by type
     * @param {string} type - Node type (e.g., 'default', 'app-viewer')
     * @returns {Array}
     */
    getNodesByType(type) {
      return this.getNodes().filter(node => node.type === type)
    },

    /**
     * Get all node labels
     * @returns {Array<string>}
     */
    getNodeLabels() {
      return this.getNodes().map(node => node.label).filter(Boolean)
    },

    /**
     * Get edges connected to a node
     * @param {string} nodeId - Node ID
     * @returns {Object} { incoming: [], outgoing: [] }
     */
    getNodeConnections(nodeId) {
      const edges = this.getEdges()
      return {
        incoming: edges.filter(edge => edge.to === nodeId),
        outgoing: edges.filter(edge => edge.from === nodeId)
      }
    },

    /**
     * Get most connected nodes
     * @param {number} limit - Number of nodes to return
     * @returns {Array<{nodeId: string, connections: number}>}
     */
    getMostConnectedNodes(limit = 5) {
      const connections = {}
      this.getEdges().forEach(edge => {
        connections[edge.from] = (connections[edge.from] || 0) + 1
        connections[edge.to] = (connections[edge.to] || 0) + 1
      })

      return Object.entries(connections)
        .map(([nodeId, count]) => ({ nodeId, connections: count }))
        .sort((a, b) => b.connections - a.connections)
        .slice(0, limit)
    },

    /**
     * Get node type distribution
     * @returns {Object} { type: count }
     */
    getNodeTypeDistribution() {
      const types = {}
      this.getNodes().forEach(node => {
        types[node.type] = (types[node.type] || 0) + 1
      })
      return types
    },

    /**
     * Search nodes by content
     * @param {string} query - Search query
     * @returns {Array}
     */
    searchNodes(query) {
      const lowerQuery = query.toLowerCase()
      return this.getNodes().filter(node => {
        const label = (node.label || '').toLowerCase()
        const content = (node.content || '').toLowerCase()
        return label.includes(lowerQuery) || content.includes(lowerQuery)
      })
    },

    /**
     * Get graph summary for AI
     * @returns {string}
     */
    getSummaryForAI() {
      if (!this.isAvailable()) {
        return 'No graph context available'
      }

      const nodes = this.getNodes()
      const edges = this.getEdges()
      const metadata = this.getMetadata()

      return `
Knowledge Graph: ${metadata.name || 'Untitled'}
Category: ${metadata.category || 'Uncategorized'}
Nodes: ${nodes.length}
Edges: ${edges.length}

Node Titles:
${nodes.map(n => `- ${n.label}`).join('\n')}

Node Types:
${JSON.stringify(this.getNodeTypeDistribution())}

Most Connected Nodes:
${this.getMostConnectedNodes(3).map(n => {
  const node = this.getNodeById(n.nodeId)
  return `- ${node?.label || n.nodeId} (${n.connections} connections)`
}).join('\n')}
      `.trim()
    },

    /**
     * Log graph info to console
     */
    debug() {
      if (!this.isAvailable()) {
        console.log('⚠️ No graph context available (running standalone)')
        return
      }

      console.group('📊 Graph Context Debug Info')
      console.log('Metadata:', this.getMetadata())
      console.log('Nodes:', this.getNodeCount())
      console.log('Edges:', this.getEdgeCount())
      console.log('Node Types:', this.getNodeTypeDistribution())
      console.log('Most Connected:', this.getMostConnectedNodes(5))
      console.groupEnd()
    },

    /**
     * Get raw context object
     * @returns {Object|null}
     */
    getRaw() {
      return getContext()
    }
  }
})()

// Auto-log on load (can be disabled)
if (typeof GRAPH_CONTEXT_AUTO_LOG === 'undefined' || GRAPH_CONTEXT_AUTO_LOG) {
  if (GraphContext.isAvailable()) {
    console.log(`✅ Graph Context: ${GraphContext.getNodeCount()} nodes, ${GraphContext.getEdgeCount()} edges`)
  } else {
    console.log('ℹ️ No graph context (running in standalone mode)')
  }
}

// Make available globally
window.GraphContext = GraphContext
