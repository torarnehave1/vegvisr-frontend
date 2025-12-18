<template>
  <div class="graph-canvas" ref="graphCanvasRoot">
    <!-- Top Toolbar -->
    <div class="canvas-toolbar">
      <div class="toolbar-section">
        <h3 class="canvas-title">
          Graph Canvas
          <span v-if="currentGraphTitle" class="text-muted ms-2">- {{ currentGraphTitle }}</span>
        </h3>
      </div>

      <div class="toolbar-section">
        <!-- Search -->
        <input
          v-model="searchQuery"
          @input="searchNodes"
          type="text"
          class="form-control search-input"
          placeholder="Search nodes..."
        />
      </div>

      <div class="toolbar-section">
        <!-- Alignment Controls -->
        <div class="btn-group" role="group">
          <button
            @click="alignSelectedNodes('horizontal')"
            class="btn btn-outline-primary"
            title="Align Horizontal"
          >
            ⬌ Horizontal
          </button>
          <button
            @click="alignSelectedNodes('vertical')"
            class="btn btn-outline-primary"
            title="Align Vertical"
          >
            ⬍ Vertical
          </button>
          <button
            @click="alignSelectedNodes('center')"
            class="btn btn-outline-primary"
            title="Align Center"
          >
            ⊕ Center
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Spacing Controls -->
        <div class="btn-group" role="group">
          <button
            @click="spreadSelectedNodes('horizontal')"
            class="btn btn-outline-secondary"
            title="Spread Horizontal"
          >
            ↔ Spread H
          </button>
          <button
            @click="spreadSelectedNodes('vertical')"
            class="btn btn-outline-secondary"
            title="Spread Vertical"
          >
            ↕ Spread V
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- View Controls -->
        <div class="btn-group" role="group">
          <button @click="centerAndZoom" class="btn btn-outline-info" title="Center & Fit">
            🎯 Center
          </button>
          <button
            @click="toggleFullscreen"
            class="btn btn-outline-info"
            :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
          >
            {{ isFullscreen ? '⤢ Exit Fullscreen' : '⤢ Fullscreen' }}
          </button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Undo/Redo -->
        <div class="btn-group" role="group">
          <button @click="undoAction" class="btn btn-outline-secondary" title="Undo">↶ Undo</button>
          <button @click="redoAction" class="btn btn-outline-secondary" title="Redo">↷ Redo</button>
        </div>
      </div>

      <div class="toolbar-section">
        <!-- Save -->
        <button @click="saveGraph" class="btn btn-success" title="Save Changes">
          💾 Save Graph
        </button>
      </div>

      <div class="toolbar-section">
        <!-- AI Chat Toggle -->
        <button
          v-if="userStore.loggedIn"
          @click="showAIChat = !showAIChat"
          class="btn btn-sm ai-chat-toggle"
          :class="showAIChat ? 'btn-primary' : 'btn-outline-primary'"
          title="Toggle AI Assistant"
        >
          🤖 AI Chat
        </button>
      </div>
    </div>

    <!-- Status Bar -->
    <div v-if="statusMessage" class="status-bar" :class="statusClass">
      {{ statusMessage }}
    </div>

    <!-- Main Content with optional Chat Panel -->
    <div class="canvas-with-chat" :class="{ 'chat-open': showAIChat }">
      <!-- Main Canvas -->
      <div class="canvas-container" :class="{ 'with-chat': showAIChat }">
        <div id="graph-canvas" class="cytoscape-canvas"></div>
        <!-- Node Resize Handles -->
        <div
          v-if="resizeHandles.visible"
          class="node-resize-handles"
          :style="resizeHandles.containerStyle"
        >
          <div
            class="resize-handle resize-handle-n"
            @mousedown.prevent.stop="startNodeResize('n', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-s"
            @mousedown.prevent.stop="startNodeResize('s', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-e"
            @mousedown.prevent.stop="startNodeResize('e', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-w"
            @mousedown.prevent.stop="startNodeResize('w', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-ne"
            @mousedown.prevent.stop="startNodeResize('ne', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-nw"
            @mousedown.prevent.stop="startNodeResize('nw', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-se"
            @mousedown.prevent.stop="startNodeResize('se', $event)"
          ></div>
          <div
            class="resize-handle resize-handle-sw"
            @mousedown.prevent.stop="startNodeResize('sw', $event)"
          ></div>
        </div>
      </div>

      <!-- Chat Resize Handle -->
      <div
        v-if="showAIChat"
        class="chat-resize-handle"
        @mousedown.prevent="startChatResize"
      ></div>

      <!-- AI Chat Panel -->
      <div
        v-if="showAIChat"
        class="chat-panel-container"
        :style="{ width: chatWidth + 'px' }"
      >
        <GrokChatPanel
          :graphData="graphDataForChat"
          :selection-context="aiChatSelectionContext"
          parent-context="canvas"
          @insert-fulltext="insertAIResponseAsFullText"
        />
      </div>
    </div>

    <div class="floating-node-menu" v-if="canAddNodes">
      <div class="menu-header">
        <span>Nodes & Edges</span>
        <span class="menu-status" v-if="placementMode || edgeMode">
          {{ placementMode ? (placementMode === 'fulltext' ? 'Full Text mode' : 'Info mode') : edgeStartNode ? 'Select target node' : 'Select start node' }}
        </span>
      </div>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :class="{ active: placementMode === 'info' }"
        @click="startNodePlacement('info')"
      >
        ➕ Add Info Node
      </button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :class="{ active: placementMode === 'fulltext' }"
        @click="startNodePlacement('fulltext')"
      >
        📝 Add Full Text Node
      </button>
      <button
        class="btn btn-outline-primary btn-sm"
        type="button"
        :class="{ active: edgeMode }"
        @click="toggleEdgeMode"
      >
        {{ edgeMode ? 'Cancel Edge Mode' : '🔗 Create Edge' }}
      </button>
      <button
        class="btn btn-outline-success btn-sm"
        type="button"
        @click="createClusterFromSelected"
        :disabled="selectedCount < 2"
      >
        📦 Create Cluster
      </button>
      <button
        class="btn btn-outline-info btn-sm"
        type="button"
        @click="showImportGraphDialog"
      >
        🌐 Import Graph
      </button>
      <button
        class="btn btn-outline-secondary btn-sm"
        type="button"
        @click="toggleFontColor"
        :disabled="selectedCount === 0"
        title="Toggle font color between black and white"
      >
        🎨 Toggle Font Color
      </button>
      
      <!-- Shape Options -->
      <div v-if="selectedCount === 1" class="shape-options">
        <div class="menu-subheader">Shape</div>
        <div class="shape-buttons">
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('ellipse')"
            title="Circle"
          >⚫</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('rectangle')"
            title="Square"
          >⬜</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('round-rectangle')"
            title="Rounded Rectangle"
          >▭</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('triangle')"
            title="Triangle"
          >▲</button>
          <button
            class="btn btn-outline-secondary btn-sm shape-btn"
            type="button"
            @click="changeSelectedNodeShape('diamond')"
            title="Diamond"
          >◆</button>
        </div>
      </div>
      
      <!-- Color Options -->
      <div v-if="selectedCount === 1" class="color-options">
        <div class="menu-subheader">Color</div>
        <div class="color-buttons">
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#ADD8E6')"
            title="Light Blue"
            style="background-color: #ADD8E6;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#90EE90')"
            title="Light Green"
            style="background-color: #90EE90;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFB6C1')"
            title="Light Pink"
            style="background-color: #FFB6C1;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFD700')"
            title="Gold"
            style="background-color: #FFD700;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFA500')"
            title="Orange"
            style="background-color: #FFA500;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#DDA0DD')"
            title="Plum"
            style="background-color: #DDA0DD;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#F5F5DC')"
            title="Beige"
            style="background-color: #F5F5DC;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#E0E0E0')"
            title="Light Gray"
            style="background-color: #E0E0E0;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#FFFFFF')"
            title="White"
            style="background-color: #FFFFFF; border: 1px solid #ccc;"
          ></button>
          <button
            class="btn btn-sm color-btn"
            type="button"
            @click="changeSelectedNodeColor('#333333')"
            title="Dark Gray"
            style="background-color: #333333;"
          ></button>
        </div>
        <div class="color-picker-row">
          <input
            type="color"
            class="color-picker-input"
            @input="changeSelectedNodeColor($event.target.value)"
            title="Custom color"
          />
          <span class="color-picker-label">Custom</span>
        </div>
      </div>
      
      <button
        class="btn btn-link btn-sm"
        type="button"
        v-if="placementMode || edgeMode"
        @click="cancelInteractionModes"
      >
        Cancel Operation
      </button>
      <p class="menu-hint" v-if="placementMode">
        Click anywhere on the canvas to place the selected node type.
      </p>
      <p class="menu-hint" v-else-if="edgeMode && !edgeStartNode">
        Edge mode: select the start node.
      </p>
      <p class="menu-hint" v-else-if="edgeMode && edgeStartNode">
        Edge mode: select the target node.
      </p>
      <p class="menu-hint" v-else-if="selectedCount >= 2">
        Select 2+ nodes to group them in a cluster.
      </p>
      <p class="menu-hint" v-else>
        Tip: use these tools to add nodes or connect ideas.
      </p>
    </div>

    <!-- Selection Info -->
    <div v-if="selectedCount > 0" class="selection-info">
      {{ selectedCount }} node{{ selectedCount > 1 ? 's' : '' }} selected
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <!-- Background Image -->
      <div class="context-menu-section">
        <div class="context-menu-header">Background</div>
        <div class="context-menu-item" @click="openImageSelectorForNode">
          <span class="context-menu-icon">🖼️</span>
          Set Background Image
        </div>
        <div v-if="hasBackgroundImage()" class="context-menu-item" @click="removeBackgroundImage">
          <span class="context-menu-icon">🚫</span>
          Remove Background
        </div>
      </div>

      <!-- Edit Node (not for clusters) -->
      <div v-if="!contextMenu.isCluster" class="context-menu-section">
        <div class="context-menu-header">Content</div>
        <div class="context-menu-item" @click="openInfoModal">
          <span class="context-menu-icon">📝</span>
          Edit Info
        </div>
        <div class="context-menu-item" @click="renameNode">
          <span class="context-menu-icon">✏️</span>
          Rename Node
        </div>
      </div>

      <!-- Divider -->
      <div class="context-menu-divider"></div>

      <!-- Delete Options -->
      <div class="context-menu-item danger" @click="deleteContextNode">
        <span class="context-menu-icon">🗑️</span>
        {{ contextMenu.isImportedCluster ? 'Remove Imported Graph' : contextMenu.isCluster ? 'Delete Cluster' : 'Delete Node' }}
      </div>
      <div v-if="contextMenu.isCluster && !contextMenu.isImportedCluster" class="context-menu-item" @click="deleteClusterOnly">
        <span class="context-menu-icon">📦</span>
        Ungroup (Keep Children)
      </div>
    </div>

    <!-- Image Selector for Background Images -->
    <ImageSelector
      :is-open="isImageSelectorOpen"
      :current-image-url="currentImageData.url"
      :current-image-alt="currentImageData.alt"
      :image-type="currentImageData.type"
      :image-context="currentImageData.context"
      :node-content="currentImageData.nodeContent"
      @close="closeImageSelector"
      @image-replaced="handleBackgroundImageSelected"
    />

    <!-- Node Info Modal -->
    <div v-if="showInfoModal" class="modal-overlay">
      <div class="info-modal" @click.stop>
        <div class="modal-header">
          <h5>Edit Node Info</h5>
          <button @click="closeInfoModal" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Node Label:</label>
          <input
            v-model="editingNodeLabel"
            type="text"
            class="form-control mb-3"
            placeholder="Node label"
          />
          <label class="form-label">Node Info Content:</label>
          <textarea
            v-model="editingNodeInfo"
            class="form-control info-textarea"
            rows="15"
            placeholder="Enter node information..."
          ></textarea>
        </div>
        <div class="modal-footer">
          <button @click="closeInfoModal" class="btn btn-secondary">Cancel</button>
          <button @click="saveNodeInfo" class="btn btn-primary">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- Graph Import Modal -->
    <div v-if="showImportModal" class="graph-import-modal-overlay" @click="closeImportModal">
      <div class="graph-import-modal" @click.stop>
        <div class="modal-header">
          <h5>Import Knowledge Graph</h5>
          <button class="btn-close" @click="closeImportModal"></button>
        </div>
        <div class="modal-body">
          <input
            v-model="importSearchQuery"
            type="text"
            class="form-control mb-3"
            placeholder="🔍 Search graphs..."
          />
          <div class="graph-grid">
            <div
              v-for="graph in filteredImportGraphs"
              :key="graph.id"
              class="graph-card"
              @click="importGraphAsCluster(graph.id, graph.title || graph.name || `Graph ${graph.id}`)"
            >
              <div class="graph-card-title">{{ graph.title || graph.name || `Graph ${graph.id}` }}</div>
              <div class="graph-card-meta">
                <span v-if="graph.metadata?.metaArea" class="badge bg-secondary">{{ graph.metadata.metaArea }}</span>
                <span class="text-muted small">{{ graph.metadata?.description || 'No description' }}</span>
              </div>
            </div>
          </div>
          <div v-if="filteredImportGraphs.length === 0" class="text-center text-muted p-4">
            No graphs available to import
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import cytoscape from 'cytoscape'
import undoRedo from 'cytoscape-undo-redo'
import ImageSelector from '@/components/ImageSelector.vue'
import GrokChatPanel from '@/components/GrokChatPanel.vue'

// Initialize undo-redo plugin
if (!cytoscape.prototype.undoRedo) {
  undoRedo(cytoscape)
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const graphStore = useKnowledgeGraphStore()

const searchQuery = ref('')
const statusMessage = ref('')
const statusClass = ref('')
const selectedCount = ref(0)
const knowledgeGraphs = ref([])
const showImportModal = ref(false)
const importSearchQuery = ref('')
const currentGraphTitle = ref('')
const graphCanvasRoot = ref(null)
const isFullscreen = ref(false)

// AI Chat Panel state
const showAIChat = ref(false)
const chatWidth = ref(420)
const isResizingChat = ref(false)
let chatResizeStartX = 0
let chatResizeStartWidth = 0
const chatSelection = ref(null)

const placementMode = ref(null)
const edgeMode = ref(false)
const edgeStartNode = ref(null)

// Node resize state
const isResizingNode = ref(false)
const resizeDirection = ref(null)
const resizeStartPos = ref({ x: 0, y: 0 })
const resizeStartSize = ref({ width: 0, height: 0 })
const resizeStartNodePos = ref({ x: 0, y: 0 })
const resizeTargetNode = ref(null)
const resizeUpdateToken = ref(0)

const bumpResizeUpdate = () => {
  resizeUpdateToken.value = (resizeUpdateToken.value + 1) % Number.MAX_SAFE_INTEGER
}

const handleWindowResize = () => {
  clampChatWidthToViewport()
  bumpResizeUpdate()
}

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  node: null,
  isCluster: false,
  isImportedCluster: false,
})
const isImageSelectorOpen = ref(false)
const targetNodeForImage = ref(null)
const currentImageData = ref({
  url: '',
  alt: '',
  type: 'node-background',
  context: 'Graph Canvas Node Background',
  nodeContent: '',
})
const showInfoModal = ref(false)
const editingNodeInfo = ref('')
const editingNodeLabel = ref('')
const editingNode = ref(null)
const canAddNodes = computed(() => Boolean(graphStore.currentGraphId))
const filteredImportGraphs = computed(() => {
  if (!importSearchQuery.value.trim()) {
    return knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)
  }
  const query = importSearchQuery.value.toLowerCase()
  return knowledgeGraphs.value
    .filter((g) => g.id !== graphStore.currentGraphId)
    .filter(
      (g) =>
        (g.title && g.title.toLowerCase().includes(query)) ||
        (g.name && g.name.toLowerCase().includes(query)) ||
        (g.metadata?.metaArea && g.metadata.metaArea.toLowerCase().includes(query)) ||
        (g.metadata?.description && g.metadata.description.toLowerCase().includes(query))
    )
})

// AI Chat Panel - computed properties
const aiChatSelectionContext = computed(() => {
  if (!chatSelection.value?.text) return null
  return {
    text: chatSelection.value.text,
    nodeId: chatSelection.value.nodeId || null,
    nodeLabel: chatSelection.value.nodeLabel || null,
    nodeType: chatSelection.value.nodeType || null,
    source: 'graph-canvas',
    updatedAt: chatSelection.value.updatedAt,
  }
})

const graphDataForChat = computed(() => {
  if (!cyInstance.value) return { nodes: [], edges: [], metadata: { title: currentGraphTitle.value } }

  const nodes = cyInstance.value.nodes().map(n => ({
    id: n.id(),
    label: n.data('label'),
    info: n.data('info'),
    fullText: n.data('fullText'),
    type: n.data('type'),
    ...n.data()
  }))

  const edges = cyInstance.value.edges().map(e => ({
    id: e.id(),
    source: e.source().id(),
    target: e.target().id(),
    ...e.data()
  }))

  return { nodes, edges, metadata: { title: currentGraphTitle.value } }
})

// Resize handles computed - calculates position based on selected node
const computeHandleStyle = (node) => {
  if (!cyInstance.value?.container()) return null

  // renderedPosition() is already relative to the cytoscape container
  // Since our overlay is inside .canvas-container (same as #graph-canvas),
  // we use the position directly without viewport offset adjustments
  const renderedPos = node.renderedPosition()
  const width = node.renderedOuterWidth()
  const height = node.renderedOuterHeight()

  return {
    position: 'absolute',
    left: `${renderedPos.x - width / 2}px`,
    top: `${renderedPos.y - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'auto',
  }
}

const resizeHandles = computed(() => {
  // Depend on selection count and explicit updates for reactivity
  selectedCount.value
  resizeUpdateToken.value
  if (!cyInstance.value || isResizingNode.value) {
    // Keep showing during resize
    if (isResizingNode.value && resizeTargetNode.value) {
      const node = resizeTargetNode.value
      const style = computeHandleStyle(node)
      if (!style) {
        return { visible: false, containerStyle: {} }
      }
      return {
        visible: true,
        containerStyle: { ...style, pointerEvents: 'none' },
      }
    }
    return { visible: false, containerStyle: {} }
  }

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) {
    return { visible: false, containerStyle: {} }
  }

  const node = selectedNodes.first()
  // Don't show resize handles for parent/cluster nodes
  if (node.isParent()) {
    return { visible: false, containerStyle: {} }
  }

  const style = computeHandleStyle(node)
  if (!style) {
    return { visible: false, containerStyle: {} }
  }

  return {
    visible: true,
    containerStyle: style,
  }
})

// Cytoscape instance
const cyInstance = ref(null)
const undoRedoInstance = ref(null)

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })

// Helper function to parse markdown image syntax (from GraphAdmin)
const parseMarkdownImage = (markdown) => {
  const regex = /!\[.*?\|(.+?)\]\((.+?)\)/ // Match markdown image syntax
  const match = markdown.match(regex)

  if (match) {
    const styles = match[1].split(';').reduce((acc, style) => {
      const [key, value] = style.split(':').map((s) => s.trim())
      if (key && value) acc[key] = value
      return acc
    }, {})

    return { url: match[2], styles }
  }
  return null
}

// Computed
const hasSelection = computed(() => selectedCount.value > 0)

// Load available graphs
const loadGraphs = async () => {
  try {
    const response = await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      console.log('Raw API response:', data)
      console.log('Data type:', typeof data)
      console.log('Is array:', Array.isArray(data))

      // Handle different response formats
      let graphs = []
      if (data.results && Array.isArray(data.results)) {
        graphs = data.results
      } else if (Array.isArray(data)) {
        graphs = data
      } else if (data && Array.isArray(data.graphs)) {
        graphs = data.graphs
      } else if (data && typeof data === 'object') {
        // If it's an object with graph data, try to extract graphs
        graphs = Object.values(data).filter((item) => item && typeof item === 'object' && item.id)
      } else {
        console.warn('Unexpected data format:', data)
        showStatus('Unexpected response format from server', 'warning')
        return
      }

      // Store all graphs without filtering by user
      knowledgeGraphs.value = graphs

      console.log('Total graphs loaded:', knowledgeGraphs.value.length)
      console.log('User email:', userStore.email)
      console.log('User role:', userStore.role)
      console.log('Current graph ID:', graphStore.currentGraphId)
      const availableForImport = knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)
      console.log('Available for import (excluding current):', availableForImport.length)
      showStatus(`Loaded ${knowledgeGraphs.value.length} graphs`, 'success')
    } else {
      console.error('Failed to fetch graphs. Status:', response.status)
      showStatus('Failed to load graphs from server', 'error')
    }
  } catch (error) {
    console.error('Error loading graphs:', error)
    showStatus('Error loading graphs: ' + error.message, 'error')
  }
}

// Load selected graph
const loadGraph = async () => {
  const currentGraphId = graphStore.currentGraphId
  if (!currentGraphId) return

  try {
    showStatus('Loading graph...', 'info')

    // Update URL to reflect current graph
    if (route.query.graphId !== currentGraphId) {
      router.replace({
        name: 'GraphCanvas',
        query: { graphId: currentGraphId },
      })
    }

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${currentGraphId}`,
    )

    if (response.ok) {
      let graphData = await response.json()
      console.log('Raw graph data:', graphData)

      // Handle case where graph data is stored as JSON string
      if (typeof graphData === 'string') {
        try {
          graphData = JSON.parse(graphData)
        } catch (parseError) {
          console.error('Failed to parse graph JSON:', parseError)
          showStatus('Invalid JSON format in graph data', 'error')
          return
        }
      }

      console.log('Parsed graph data:', graphData)
      console.log('Has nodes:', !!graphData.nodes)
      console.log('Has edges:', !!graphData.edges)

      // Ensure we have nodes and edges arrays
      if (!graphData.nodes || !graphData.edges) {
        console.warn('Missing nodes or edges in graph data')
        // Initialize empty arrays if missing
        graphData.nodes = graphData.nodes || []
        graphData.edges = graphData.edges || []
        showStatus('Graph loaded with missing data - initialized empty arrays', 'warning')
      }

      initializeCytoscape(graphData)
      currentGraphTitle.value = graphData.metadata?.title || graphData.title || 'Untitled Graph'
      showStatus('Graph loaded successfully', 'success')
    } else {
      showStatus('Error loading graph', 'error')
    }
  } catch (error) {
    console.error('Error loading graph:', error)
    showStatus('Error loading graph', 'error')
  }
}

// Initialize Cytoscape
const initializeCytoscape = (graphData) => {
  const container = document.getElementById('graph-canvas')
  if (!container) {
    console.error('Canvas container not found')
    return
  }

  // Destroy existing instance
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  resetInteractionModes()

  // Prepare elements
  const elements = [
    ...graphData.nodes.map((node) => ({
      data: { id: node.id, label: node.label, ...node },
      position: node.position || { x: Math.random() * 800, y: Math.random() * 600 },
    })),
    ...graphData.edges.map((edge) => ({
      data: { id: edge.id, source: edge.source, target: edge.target, ...edge },
    })),
  ]

  // Create Cytoscape instance
  cyInstance.value = cytoscape({
    container: container,
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: (ele) => ele.data('fontColor') || '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node[type="info"]',
        style: {
          shape: 'ellipse',
          width: (ele) => {
            const label = ele.data('label') || ''
            const info = ele.data('info') || ''
            const totalLength = label.length + info.length
            return Math.max(150, Math.min(400, 150 + totalLength * 2))
          },
          height: (ele) => {
            const label = ele.data('label') || ''
            const info = ele.data('info') || ''
            const totalLength = label.length + info.length
            return Math.max(150, Math.min(400, 150 + totalLength * 2))
          },
          'text-wrap': 'wrap',
          'text-max-width': '350px',
        },
      },
      {
        selector: 'node[type="worknote"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="markdown-image"]',
        style: {
          shape: 'rectangle',
          'background-image': (ele) => {
            const parsed = parseMarkdownImage(ele.data('label'))
            return parsed ? parsed.url : ''
          },
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 0,
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          'z-index': -1,
          label: '',
        },
      },
      {
        selector: 'node[type="fulltext"]',
        style: {
          shape: 'round-rectangle',
          'background-color': (ele) => ele.data('color') || '#ede8e8',
          'border-width': 4,
          'border-color': '#555',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '16px',
          padding: '10px',
          width: '794px',
          height: '1122pt',
        },
      },
      {
        selector: 'node[type="title"]',
        style: {
          shape: 'rectangle',
          'background-opacity': 0,
          'border-width': 1,
          'border-color': '#ccc',
          'padding-left': '15px',
          'padding-right': '10px',
          'padding-top': '5px',
          'padding-bottom': '5px',
          label: (ele) => ele.data('label') || '',
          'font-size': '24px',
          'font-weight': 'bold',
          color: 'black',
          'text-valign': 'center',
          'text-halign': 'center',
          width: 200,
          height: 50,
        },
      },
      {
        selector: 'node[type="youtube-video"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FF0000',
          'border-width': 1,
          'border-color': '#000',
          label: (ele) => {
            const match = ele.data('label').match(/!\[YOUTUBE src=.+?\](.+?)\[END YOUTUBE\]/)
            return match ? match[1] : ele.data('label')
          },
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          width: '200px',
          height: '112px',
        },
      },
      {
        selector: 'node[type="background"]',
        style: {
          shape: 'rectangle',
          'background-image': (ele) => ele.data('label'),
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 0,
          width: (ele) => ele.data('imageWidth') || '100%',
          height: (ele) => ele.data('imageHeight') || '100%',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'font-size': '0px',
          color: '#000',
          'background-image-crossorigin': 'anonymous',
        },
      },
      {
        selector: 'node[type="map"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FFD580',
          'border-width': 2,
          'border-color': '#333',
          label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`,
          'text-wrap': 'wrap',
          'text-max-width': '734px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '14px',
          'font-weight': 'bold',
          width: '300px',
          height: (ele) => {
            const lineHeight = 30
            const padding = 20
            const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
            const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
            const totalLines = labelLines + infoLines + 2
            return Math.max(100, totalLines * lineHeight + padding)
          },
        },
      },
      {
        selector: 'node[type="app-viewer"]',
        style: {
          shape: 'rectangle',
          'background-color': (ele) => ele.data('path') ? 'transparent' : '#11998e',
          'background-image': (ele) => ele.data('path') || null,
          'background-fit': 'cover',
          'background-opacity': 1,
          'border-width': 3,
          'border-color': '#11998e',
          label: 'data(label)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-background-color': 'rgba(17, 153, 142, 0.9)',
          'text-background-opacity': 1,
          'text-background-padding': '4px',
          'font-size': '14px',
          'font-weight': 'bold',
          color: '#fff',
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          width: '200px',
          height: '150px',
          'background-image-crossorigin': 'anonymous',
        },
      },
      {
        selector: 'edge',
        style: {
          label: (ele) => (ele.data('type') === 'info' ? 'ℹ️' : ''),
          width: 2,
          'line-color': '#999',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#999',
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [50, -50],
          'control-point-weights': [0.3, 0.7],
          'edge-distances': 'intersection',
        },
      },
      {
        selector: '.highlighted',
        style: {
          'border-width': 4,
          'border-color': 'yellow',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#FF9800',
          'target-arrow-color': '#FF9800',
          width: 4,
        },
      },
      {
        selector: ':parent',
        style: {
          'background-opacity': 0.2,
          'background-color': (ele) => ele.data('sourceGraphId') ? '#E8F5E9' : '#E3F2FD',
          'background-image': 'none',
          'border-width': 3,
          'border-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-weight': 'bold',
          'font-size': '16px',
          'padding': '20px',
          label: (ele) => {
            const collapsed = ele.data('collapsed')
            const childCount = ele.children().length
            const label = ele.data('label') || 'Cluster'
            const isImported = ele.data('sourceGraphId') ? ' 🌐' : ''
            return collapsed ? `${label} [${childCount}]${isImported}` : `${label}${isImported}`
          },
        },
      },
      {
        selector: ':parent[collapsed]',
        style: {
          'background-color': (ele) => ele.data('path') ? 'transparent' : (ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA'),
          'background-opacity': (ele) => ele.data('path') ? 1 : 0.4,
          'border-style': 'solid',
          width: '400px',
          height: '400px',
        },
      },
      {
        selector: ':parent[collapsed][path]',
        style: {
          'background-image': 'data(path)',
          'background-fit': 'cover',
        },
      },
    ],
    layout: {
      name: 'preset',
    },
    // Interaction options
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'single',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control (default is 1)
    minZoom: 0.1, // Minimum zoom level
    maxZoom: 10, // Maximum zoom level (1000%)
    zoomingEnabled: true,
    // Pan settings
    panningEnabled: true,
  })

  // Initialize undo-redo
  undoRedoInstance.value = cyInstance.value.undoRedo({
    isDebug: false,
    actions: {},
    undoableDrag: true,
    stackSizeLimit: 50,
  })

  // Event listeners
  setupEventListeners()
  updateCanvasInteractionState()

  // Apply collapsed state to clusters
  cyInstance.value.nodes().forEach((node) => {
    if (node.isParent() && node.data('collapsed')) {
      node.children().style('display', 'none')
    }
  })

  // Apply custom shapes and background images from node data
  cyInstance.value.nodes().forEach((node) => {
    // Apply custom shape if stored
    if (node.data('customShape')) {
      node.style('shape', node.data('customShape'))
    }

    // Apply background image if stored (using 'path' property)
    // Only apply to collapsed clusters or non-cluster nodes
    if (node.data('path')) {
      const isCluster = node.isParent()
      const isCollapsed = node.data('collapsed')

      // Only apply inline styles for non-clusters or collapsed clusters
      if (!isCluster || isCollapsed) {
        node.style({
          'background-image': node.data('path'),
          'background-fit': 'cover',
          'background-opacity': 1,
        })
      }
      // For expanded clusters with path, CSS selectors will handle hiding the image
    }

    // Apply custom font color if stored
    if (node.data('fontColor')) {
      node.style('color', node.data('fontColor'))
    }
  })

  // Fit to view
  cyInstance.value.fit()
}

const handleCanvasTap = async (event) => {
  if (!cyInstance.value) return

  // Check if clicked on background (not a node or edge)
  const isBackgroundClick = !event.target.isNode || !event.target.isNode()

  if (placementMode.value && isBackgroundClick) {
    console.log('Background clicked in placement mode, adding node at:', event.position)
    await addNodeAtPosition(placementMode.value, event.position)
    // Don't reset interaction modes - keep placement mode active
    return
  }

  if (edgeMode.value && event.target?.isNode?.()) {
    console.log('Node clicked in edge mode:', event.target.id())
    await handleEdgeNodeSelection(event.target)
  }
}

// Setup event listeners
const setupEventListeners = () => {
  if (!cyInstance.value) return

  // Selection tracking
  cyInstance.value.on('select unselect', () => {
    selectedCount.value = cyInstance.value.$(':selected').length
    bumpResizeUpdate()
  })

  // AI Chat - Update selection context when node is selected/unselected
  cyInstance.value.on('select', 'node', (event) => {
    const node = event.target
    updateChatSelectionFromNode(node)
    bumpResizeUpdate()
  })

  cyInstance.value.on('unselect', 'node', () => {
    // Only clear if no other nodes are selected
    if (cyInstance.value.nodes(':selected').length === 0) {
      chatSelection.value = null
    } else {
      // Update to the first selected node
      const firstSelected = cyInstance.value.nodes(':selected').first()
      updateChatSelectionFromNode(firstSelected)
    }
    bumpResizeUpdate()
  })

  // Update resize handles on viewport changes (pan, zoom, drag)
  cyInstance.value.on('viewport pan zoom drag position', () => {
    bumpResizeUpdate()
  })

  cyInstance.value.on('style', 'node', () => {
    bumpResizeUpdate()
  })

  // Close context menu on canvas click (but not immediately after opening)
  let contextMenuJustOpened = false

  cyInstance.value.on('tap', (event) => {
    // If menu was just opened, don't close it
    if (contextMenuJustOpened) {
      return
    }

    // Handle regular tap behavior
    handleCanvasTap(event)

    // Close context menu if open
    if (contextMenu.value.show) {
      contextMenu.value.show = false
    }
  })

  // Right-click context menu (works with right-click, Ctrl+click on Mac, or long-press)
  cyInstance.value.on('cxttap', 'node', (event) => {
    event.originalEvent.preventDefault()
    event.originalEvent.stopPropagation()
    console.log('Context menu triggered on node:', event.target.data('label'))
    const node = event.target
    
    // Select the node on right-click (standard UX behavior)
    cyInstance.value.nodes().unselect()
    node.select()
    
    // Get viewport coordinates from the original event for position: fixed menu
    const clientX = event.originalEvent.clientX ?? event.originalEvent.touches?.[0]?.clientX ?? 0
    const clientY = event.originalEvent.clientY ?? event.originalEvent.touches?.[0]?.clientY ?? 0

    // Set flag to prevent tap handler from closing menu
    contextMenuJustOpened = true

    // Show context menu immediately at cursor position
    contextMenu.value = {
      show: true,
      x: clientX,
      y: clientY,
      node: node,
      isCluster: node.isParent(),
      isImportedCluster: node.isParent() && Boolean(node.data('sourceGraphId')),
    }
    console.log('Context menu opened at:', clientX, clientY)

    // Clear flag after a delay to ensure menu stays open
    setTimeout(() => {
      contextMenuJustOpened = false
    }, 200)
  })

  // Also handle context menu via standard browser event as fallback
  const canvas = document.getElementById('graph-canvas')
  if (canvas) {
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      // Find the node at the click position using Cytoscape's API
      const containerRect = cyInstance.value.container().getBoundingClientRect()
      const renderedX = e.clientX - containerRect.left
      const renderedY = e.clientY - containerRect.top
      
      // Get node at rendered position
      const nodesAtPoint = cyInstance.value.nodes().filter(node => {
        const bbox = node.renderedBoundingBox()
        return renderedX >= bbox.x1 && renderedX <= bbox.x2 &&
               renderedY >= bbox.y1 && renderedY <= bbox.y2
      })
      
      if (nodesAtPoint.length > 0) {
        const node = nodesAtPoint.first()
        
        // Select the node
        cyInstance.value.nodes().unselect()
        node.select()
        
        contextMenuJustOpened = true

        contextMenu.value = {
          show: true,
          x: e.clientX,
          y: e.clientY,
          node: node,
          isCluster: node.isParent(),
          isImportedCluster: node.isParent() && Boolean(node.data('sourceGraphId')),
        }
        console.log('Context menu opened via browser contextmenu event at:', e.clientX, e.clientY)

        setTimeout(() => {
          contextMenuJustOpened = false
        }, 200)
      }
    })
  }

  // Double-click on parent nodes to toggle collapse/expand
  cyInstance.value.on('dblclick', 'node', (event) => {
    event.originalEvent.preventDefault()
    event.originalEvent.stopPropagation()

    const node = event.target

    // Check if it's a parent/cluster node
    if (node.isParent()) {
      toggleClusterCollapse(node)
    }
    // For regular nodes, the dbltap handler will open the info modal
  })

  // Delete key to remove selected elements
  document.addEventListener('keydown', handleKeyDown)
}

// Handle keyboard shortcuts
const handleKeyDown = (event) => {
  if (!cyInstance.value) return

  // Ignore keyboard shortcuts if user is typing in an input field
  const activeElement = document.activeElement
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.isContentEditable
  )) {
    return
  }

  switch (event.key) {
    case 'z':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        undoAction()
      }
      break
    case 'y':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        redoAction()
      }
      break
    case 'Escape':
      if (placementMode.value || edgeMode.value) {
        cancelInteractionModes()
      }
      break
  }
}

// Alignment functions
const alignSelectedNodes = (alignmentType) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length === 0) {
    showStatus('No nodes selected for alignment', 'warning')
    return
  }

  const positions = selectedNodes.map((node) => node.position())

  if (alignmentType === 'horizontal') {
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: node.position('x'), y: avgY })
    })
  } else if (alignmentType === 'vertical') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: node.position('y') })
    })
  } else if (alignmentType === 'center') {
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: avgY })
    })
  }

  showStatus(`Aligned ${selectedNodes.length} nodes ${alignmentType}`, 'success')
}

// Spacing functions
const spreadSelectedNodes = (axis) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes for spreading', 'warning')
    return
  }

  const sortedNodes = selectedNodes.sort((a, b) =>
    axis === 'horizontal' ? a.position('x') - b.position('x') : a.position('y') - b.position('y'),
  )

  const minPos = sortedNodes[0].position(axis === 'horizontal' ? 'x' : 'y')
  const maxPos = sortedNodes[sortedNodes.length - 1].position(axis === 'horizontal' ? 'x' : 'y')
  const spacing = (maxPos - minPos) / (sortedNodes.length - 1)

  sortedNodes.forEach((node, index) => {
    const newPos = minPos + index * spacing
    if (axis === 'horizontal') {
      node.position({ x: newPos, y: node.position('y') })
    } else {
      node.position({ x: node.position('x'), y: newPos })
    }
  })

  showStatus(`Spread ${selectedNodes.length} nodes ${axis}`, 'success')
}

// View controls
const centerAndZoom = () => {
  if (!cyInstance.value) return
  cyInstance.value.fit()
  showStatus('Centered and fitted to view', 'success')
}

// Delete selected elements
const deleteSelected = () => {
  if (!cyInstance.value) return

  const selected = cyInstance.value.$(':selected')
  if (selected.length === 0) {
    showStatus('No elements selected for deletion', 'warning')
    return
  }

  if (confirm(`Delete ${selected.length} selected element(s)?`)) {
    selected.remove()
    selectedCount.value = 0
    showStatus(`Deleted ${selected.length} element(s)`, 'success')
  }
}

const deleteContextNode = async () => {
  const node = contextMenu.value.node
  if (!node) return

  const isImportedCluster = contextMenu.value.isImportedCluster
  const isCluster = contextMenu.value.isCluster
  const nodeName = node.data('label') || 'this item'

  contextMenu.value.show = false

  if (isImportedCluster) {
    // Just remove from canvas - original graph remains intact
    if (confirm(`Remove imported graph "${nodeName}" from canvas?\n\nThe original graph will remain intact.`)) {
      node.remove()
      await saveGraph()
      showStatus(`Removed imported graph "${nodeName}"`, 'success')
    }
  } else if (isCluster) {
    // Delete cluster and all children
    const childCount = node.children().length
    if (confirm(`Delete cluster "${nodeName}" and ${childCount} children?`)) {
      node.remove()
      await saveGraph()
      showStatus(`Deleted cluster "${nodeName}" with ${childCount} nodes`, 'success')
    }
  } else {
    // Regular node deletion
    if (confirm(`Delete node "${nodeName}"?`)) {
      node.remove()
      await saveGraph()
      showStatus(`Deleted node "${nodeName}"`, 'success')
    }
  }
}

const deleteClusterOnly = async () => {
  const node = contextMenu.value.node
  if (!node || !node.isParent()) return

  const nodeName = node.data('label') || 'cluster'
  contextMenu.value.show = false

  if (confirm(`Ungroup "${nodeName}"?\n\nChildren will be moved to root level.`)) {
    const children = node.children()

    // Move children to root (remove parent reference)
    children.forEach((child) => {
      child.move({ parent: null })
    })

    // Delete the cluster node itself
    node.remove()

    await saveGraph()
    showStatus(`Ungrouped "${nodeName}" - ${children.length} nodes moved to root`, 'success')
  }
}

// Node styling functions
const changeNodeShape = async (shape) => {
  const node = contextMenu.value.node
  if (!node) return

  contextMenu.value.show = false

  // Update node style
  node.style('shape', shape)

  // Store shape in node data for persistence
  node.data('customShape', shape)

  await saveGraph()
  showStatus(`Changed node shape to ${shape}`, 'success')
}

// Change shape for currently selected node (from floating menu)
const changeSelectedNodeShape = async (shape) => {
  if (!cyInstance.value) return
  
  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return
  
  const node = selectedNodes.first()
  if (node.isParent()) return // Don't change shape of clusters
  
  // Update node style
  node.style('shape', shape)
  
  // Store shape in node data for persistence
  node.data('customShape', shape)
  
  await saveGraph()
  showStatus(`Changed node shape to ${shape}`, 'success')
}

// Change color for currently selected node (from floating menu)
const changeSelectedNodeColor = async (color) => {
  if (!cyInstance.value) return
  
  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return
  
  const node = selectedNodes.first()
  if (node.isParent()) return // Don't change color of clusters
  
  // Update node style
  node.style('background-color', color)
  
  // Store color in node data for persistence
  node.data('color', color)
  
  await saveGraph()
  showStatus(`Changed node color`, 'success')
}

const openImageSelectorForNode = () => {
  console.log('🖼️ openImageSelectorForNode called', {
    hasContextMenu: !!contextMenu.value,
    hasNode: !!contextMenu.value?.node,
    isCluster: contextMenu.value?.isCluster,
    nodeLabel: contextMenu.value?.node?.data('label')
  })

  targetNodeForImage.value = contextMenu.value.node
  contextMenu.value.show = false

  const node = targetNodeForImage.value
  currentImageData.value = {
    url: node.data('path') || '',
    alt: node.data('label') || 'Node background',
    type: 'node-background',
    context: `Background image for node: ${node.data('label') || 'Untitled'}`,
    nodeContent: node.data('info') || node.data('label') || '',
  }

  console.log('🖼️ Opening ImageSelector', {
    currentImageData: currentImageData.value,
    isImageSelectorOpen: isImageSelectorOpen.value
  })

  isImageSelectorOpen.value = true

  console.log('🖼️ After setting isImageSelectorOpen', {
    isImageSelectorOpen: isImageSelectorOpen.value
  })
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
  targetNodeForImage.value = null
  currentImageData.value = {
    url: '',
    alt: '',
    type: 'node-background',
    context: 'Graph Canvas Node Background',
    nodeContent: '',
  }
}

const handleBackgroundImageSelected = async (replacementData) => {
  if (!targetNodeForImage.value) return

  const node = targetNodeForImage.value
  const imageUrl = replacementData.newUrl

  // Store image URL in node data for persistence (using 'path' property)
  node.data('path', imageUrl)

  // Apply inline styles for immediate visual update
  // For clusters, check if collapsed
  const isCluster = node.isParent()
  const isCollapsed = node.data('collapsed')

  // Apply styles to non-clusters or collapsed clusters
  if (!isCluster || isCollapsed) {
    node.style({
      'background-image': imageUrl,
      'background-fit': 'cover',
      'background-opacity': 1,
    })
  }

  await saveGraph()
  showStatus('Background image applied', 'success')

  closeImageSelector()
}

const removeBackgroundImage = async () => {
  const node = contextMenu.value.node
  if (!node) return

  contextMenu.value.show = false

  // Remove background image style
  node.style({
    'background-image': 'none',
    'background-color': '#6495ED', // Reset to default blue
  })

  // Remove from node data (using 'path' property)
  node.removeData('path')

  await saveGraph()
  showStatus('Background image removed', 'success')
}

const hasBackgroundImage = () => {
  const node = contextMenu.value.node
  if (!node) return false
  return Boolean(node.data('path'))
}

// Node info modal functions
const renameNode = () => {
  const node = contextMenu.value.node
  if (!node) return

  const currentLabel = node.data('label') || ''
  const newLabel = prompt('Enter new name for node:', currentLabel)

  if (newLabel !== null && newLabel.trim() !== '') {
    node.data('label', newLabel.trim())
    saveCytoscape()
  }

  contextMenu.value.show = false
}

const openInfoModal = () => {
  const node = contextMenu.value.node
  if (!node) return

  editingNode.value = node
  editingNodeLabel.value = node.data('label') || ''
  editingNodeInfo.value = node.data('info') || ''
  contextMenu.value.show = false
  showInfoModal.value = true
}

const closeInfoModal = () => {
  showInfoModal.value = false
  editingNode.value = null
  editingNodeLabel.value = ''
  editingNodeInfo.value = ''
}

const saveNodeInfo = async () => {
  if (!editingNode.value) return

  const node = editingNode.value

  // Update label if changed
  if (editingNodeLabel.value.trim()) {
    node.data('label', editingNodeLabel.value.trim())
  }

  // Update info
  node.data('info', editingNodeInfo.value)

  await saveGraph()
  showStatus('Node info updated', 'success')
  closeInfoModal()
}

// Toggle font color on selected nodes
const toggleFontColor = async () => {
  if (!cyInstance.value) return

  // Get selected nodes but exclude parent/cluster nodes
  const selectedNodes = cyInstance.value.$('node:selected').filter(node => !node.isParent())
  console.log('Selected nodes count:', selectedNodes.length)
  console.log('Selected node IDs:', selectedNodes.map(n => n.id()).join(', '))

  if (selectedNodes.length === 0) {
    showStatus('No nodes selected (or only clusters selected)', 'warning')
    return
  }

  selectedNodes.forEach((node) => {
    // Check if node has stored fontColor in data, otherwise get current computed color
    const storedColor = node.data('fontColor')
    const currentColor = storedColor || node.style('color')

    console.log(`Node ${node.id()} - Current color:`, currentColor, 'Stored color:', storedColor)

    // Determine new color - if it's white or contains white, switch to black, otherwise to white
    let newColor
    if (currentColor === '#fff' || currentColor === '#ffffff' ||
        currentColor === 'rgb(255, 255, 255)' || currentColor === 'white' ||
        storedColor === '#fff' || storedColor === 'white') {
      newColor = '#000'
    } else {
      newColor = '#fff'
    }

    console.log(`Node ${node.id()} - Setting new color:`, newColor)

    // Apply the new color
    node.style('color', newColor)
    // Store color in node data for persistence
    node.data('fontColor', newColor)
  })

  await saveGraph()
  showStatus(`Font color toggled for ${selectedNodes.length} node(s)`, 'success')
}

// Search nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  cyInstance.value.nodes().removeClass('highlighted')

  if (searchQuery.value.trim()) {
    const matchingNodes = cyInstance.value
      .nodes()
      .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

    if (matchingNodes.length > 0) {
      matchingNodes.addClass('highlighted')
      cyInstance.value.fit(matchingNodes, 50)
      showStatus(`Found ${matchingNodes.length} matching nodes`, 'success')
    } else {
      showStatus('No matching nodes found', 'warning')
    }
  }
}

// Undo/Redo
const undoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.undo()
    showStatus('Undone', 'info')
  }
}

const redoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.redo()
    showStatus('Redone', 'info')
  }
}

// Save graph (position updates only) - FIXED to preserve metadata
const saveGraph = async () => {
  if (!cyInstance.value || !graphStore.currentGraphId) {
    showStatus('No graph selected to save', 'warning')
    return
  }

  try {
    showStatus('Saving positions...', 'info')

    // CRITICAL FIX: Fetch the current graph data to preserve metadata
    console.log('🔍 [GraphCanvas] Fetching current graph to preserve metadata...')
    const currentGraphResponse = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphStore.currentGraphId}`,
    )

    if (!currentGraphResponse.ok) {
      throw new Error(`Failed to fetch current graph: ${currentGraphResponse.status}`)
    }

    const currentGraph = await currentGraphResponse.json()

    // Ensure metadata exists with fallback defaults
    const existingMetadata = currentGraph.metadata || {}

    console.log(
      '🔍 [GraphCanvas] Current graph metadata:',
      JSON.stringify(existingMetadata, null, 2),
    )
    console.log(
      '🔍 [GraphCanvas] Meta area in current graph:',
      existingMetadata.metaArea || 'NO META AREA FOUND',
    )

    // Get current positions from Cytoscape
    const updatedNodes = cyInstance.value.nodes().map((node) => ({
      ...node.data(), // Keep all existing node data
      position: node.position(), // Update position
    }))

    const updatedEdges = cyInstance.value.edges().map((edge) => ({
      ...edge.data(), // Keep all existing edge data
    }))

    console.log('=== Saving Position Updates ===')
    console.log('Updated nodes with positions:', updatedNodes.length)
    console.log(
      'Sample node positions:',
      updatedNodes.slice(0, 2).map((n) => ({ id: n.id, position: n.position })),
    )

    // CRITICAL FIX: Include metadata in the payload to preserve it
    const preservedMetadata = {
      title: existingMetadata.title || 'Untitled Graph',
      description: existingMetadata.description || '',
      createdBy: existingMetadata.createdBy || 'Unknown',
      category: existingMetadata.category || '',
      metaArea: existingMetadata.metaArea || '', // Preserve metaArea - CRITICAL!
      version: existingMetadata.version || 1,
      createdAt: existingMetadata.createdAt || new Date().toISOString(),
      // Preserve any other existing fields
      ...existingMetadata,
      // Always update timestamp
      updatedAt: new Date().toISOString(),
    }

    const payload = {
      id: graphStore.currentGraphId,
      graphData: {
        metadata: preservedMetadata,
        nodes: updatedNodes,
        edges: updatedEdges,
      },
    }

    console.log(
      '💾 [GraphCanvas] Saving with preserved metadata:',
      JSON.stringify(preservedMetadata, null, 2),
    )
    console.log(
      '💾 [GraphCanvas] Meta area being saved:',
      preservedMetadata.metaArea || 'NO META AREA IN SAVE DATA',
    )

    const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      console.log('✅ [GraphCanvas] Position update successful with metadata preserved')
      showStatus('Positions saved successfully!', 'success')
    } else {
      const errorText = await response.text()
      console.error('❌ [GraphCanvas] Save failed:', response.status, errorText)
      showStatus(`Error saving positions: ${response.status}`, 'error')
    }
  } catch (error) {
    console.error('❌ [GraphCanvas] Error saving positions:', error)
    showStatus('Error saving positions: ' + error.message, 'error')
  }
}

const createNodeTemplate = (type) => {
  if (type === 'fulltext') {
    return {
      id: generateUUID(),
      label: 'New Full Text Node',
      type: 'fulltext',
      color: '#f8f9fa',
      info: 'Add your full text content here.',
      bibl: [],
      visible: true,
      imageWidth: '100%',
      imageHeight: '100%',
    }
  }

  return {
    id: generateUUID(),
    label: 'New Info Node',
    type: 'info',
    color: '#d1ecf1',
    info: 'Add supporting details here.',
    bibl: [],
    visible: true,
    imageWidth: '100%',
    imageHeight: '100%',
  }
}

const addNodeAtPosition = async (type, position) => {
  if (!cyInstance.value) return

  const nodeData = createNodeTemplate(type)

  try {
    cyInstance.value.add({
      group: 'nodes',
      data: nodeData,
      position,
    })

    cyInstance.value.$(`#${nodeData.id}`).select()
    showStatus('Saving new node...', 'info')
    await saveGraph()
    showStatus('Node added successfully.', 'success')
  } catch (error) {
    console.error('Failed to add node:', error)
    showStatus('Unable to add node. Please try again.', 'error')
    const created = cyInstance.value.$(`#${nodeData.id}`)
    if (created) {
      created.remove()
    }
  }
}

const addEdgeBetweenNodes = async (sourceNode, targetNode) => {
  if (!cyInstance.value || !sourceNode || !targetNode) return

  const edgeId = generateUUID()

  try {
    cyInstance.value.add({
      group: 'edges',
      data: {
        id: edgeId,
        source: sourceNode.id(),
        target: targetNode.id(),
        type: 'info',
        label: '',
      },
    })

    showStatus('Saving new edge...', 'info')
    await saveGraph()
    showStatus('Edge added successfully.', 'success')
  } catch (error) {
    console.error('Failed to add edge:', error)
    showStatus('Unable to add edge. Please try again.', 'error')
    const created = cyInstance.value.$(`#${edgeId}`)
    if (created) {
      created.remove()
    }
  }
}

const updateCanvasInteractionState = () => {
  const interactionLocked = Boolean(placementMode.value || edgeMode.value)
  const cy = cyInstance.value

  if (cy) {
    cy.userPanningEnabled(!interactionLocked)
    cy.boxSelectionEnabled(!interactionLocked)
    cy.autoungrabify(interactionLocked)
  }

  const root = graphCanvasRoot.value
  if (root) {
    root.classList.toggle('interaction-locked', interactionLocked)
    root.classList.toggle('placement-active', Boolean(placementMode.value))
    root.classList.toggle('edge-active', Boolean(edgeMode.value))
  }
}

const resetInteractionModes = () => {
  placementMode.value = null
  edgeMode.value = false
  edgeStartNode.value = null
  updateCanvasInteractionState()
}

const cancelInteractionModes = () => {
  if (placementMode.value || edgeMode.value) {
    resetInteractionModes()
    showStatus('Placement cancelled.', 'info')
  }
}

const startNodePlacement = (type) => {
  if (!canAddNodes.value) {
    showStatus('Load a graph to add nodes.', 'warning')
    return
  }

  // Toggle behavior: if already in this mode, turn it off
  if (placementMode.value === type) {
    resetInteractionModes()
    showStatus('Node placement mode disabled.', 'info')
    return
  }

  resetInteractionModes()
  placementMode.value = type
  updateCanvasInteractionState()
  const label = type === 'fulltext' ? 'Full Text' : 'Info'
  showStatus(`${label} node mode enabled. Click to add nodes. Click button again to disable.`, 'info')
}

const toggleEdgeMode = () => {
  if (!canAddNodes.value) {
    showStatus('Load a graph to add edges.', 'warning')
    return
  }

  if (edgeMode.value) {
    resetInteractionModes()
    showStatus('Edge mode cancelled.', 'info')
  } else {
    resetInteractionModes()
    edgeMode.value = true
    updateCanvasInteractionState()
    showStatus('Edge mode: select the start node.', 'info')
  }
}

const handleEdgeNodeSelection = async (node) => {
  if (!edgeMode.value || !node) {
    return
  }

  if (!edgeStartNode.value) {
    edgeStartNode.value = node
    showStatus('Start node selected. Choose the target node.', 'info')
    return
  }

  if (edgeStartNode.value.id() === node.id()) {
    showStatus('Choose a different node as the target.', 'warning')
    return
  }

  await addEdgeBetweenNodes(edgeStartNode.value, node)
  resetInteractionModes()
}

const toggleClusterCollapse = async (clusterNode) => {
  if (!cyInstance.value || !clusterNode || !clusterNode.isParent()) return

  const isCollapsed = clusterNode.data('collapsed')
  const children = clusterNode.children()

  if (isCollapsed) {
    // Expand: show children and remove background image inline styles
    children.style('display', 'element')
    clusterNode.removeData('collapsed')
    // Force remove any inline background-image styles so CSS selectors take over
    clusterNode.removeStyle('background-image')
    clusterNode.removeStyle('background-fit')
    showStatus(`Expanded cluster "${clusterNode.data('label')}"`, 'info')
  } else {
    // Collapse: hide children
    children.style('display', 'none')
    clusterNode.data('collapsed', true)
    showStatus(`Collapsed cluster "${clusterNode.data('label')}" (${children.length} nodes)`, 'info')
  }

  // Save the collapsed state
  await saveGraph()
}

const createClusterFromSelected = async () => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$('node:selected')
  if (selectedNodes.length < 2) {
    showStatus('Select at least 2 nodes to create a cluster', 'warning')
    return
  }

  const clusterName = prompt('Enter cluster name:', 'New Cluster')
  if (!clusterName || !clusterName.trim()) {
    showStatus('Cluster creation cancelled', 'info')
    return
  }

  try {
    // Calculate bounding box for selected nodes
    const boundingBox = selectedNodes.boundingBox()
    const centerX = (boundingBox.x1 + boundingBox.x2) / 2
    const centerY = (boundingBox.y1 + boundingBox.y2) / 2

    // Create parent/cluster node
    const clusterId = generateUUID()
    cyInstance.value.add({
      group: 'nodes',
      data: {
        id: clusterId,
        label: clusterName.trim(),
        type: 'cluster',
        color: '#A5D6FF',
        visible: true,
      },
      position: { x: centerX, y: centerY },
    })

    // Move selected nodes into the cluster
    selectedNodes.forEach((node) => {
      node.move({ parent: clusterId })
    })

    showStatus('Saving cluster...', 'info')
    await saveGraph()
    showStatus(`Cluster "${clusterName.trim()}" created with ${selectedNodes.length} nodes`, 'success')

    // Select the new cluster
    cyInstance.value.$(':selected').unselect()
    cyInstance.value.$(`#${clusterId}`).select()
  } catch (error) {
    console.error('Failed to create cluster:', error)
    showStatus('Unable to create cluster. Please try again.', 'error')
  }
}

const showImportGraphDialog = async () => {
  if (!cyInstance.value) return

  // Ensure graphs are loaded
  if (knowledgeGraphs.value.length === 0) {
    showStatus('Loading graphs...', 'info')
    await loadGraphs()
  }

  const availableGraphs = knowledgeGraphs.value.filter((g) => g.id !== graphStore.currentGraphId)

  if (availableGraphs.length === 0) {
    showStatus('No other graphs available to import', 'warning')
    return
  }

  showImportModal.value = true
  importSearchQuery.value = ''
}

const closeImportModal = () => {
  showImportModal.value = false
  importSearchQuery.value = ''
}

const importGraphAsCluster = async (graphId, graphTitle) => {
  if (!cyInstance.value) return

  closeImportModal()

  try {
    showStatus(`Loading graph "${graphTitle}"...`, 'info')

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.status}`)
    }

    let importedGraphData = await response.json()

    // Handle JSON string
    if (typeof importedGraphData === 'string') {
      importedGraphData = JSON.parse(importedGraphData)
    }

    if (!importedGraphData.nodes || !importedGraphData.edges) {
      throw new Error('Invalid graph data structure')
    }

    // Calculate center position for the imported cluster
    const extent = cyInstance.value.extent()
    const centerX = (extent.x1 + extent.x2) / 2
    const centerY = (extent.y1 + extent.y2) / 2

    // Create parent cluster node
    const clusterId = generateUUID()
    cyInstance.value.add({
      group: 'nodes',
      data: {
        id: clusterId,
        label: graphTitle,
        type: 'cluster',
        color: '#B8E6B8',
        visible: true,
        sourceGraphId: graphId, // Track original graph
      },
      position: { x: centerX, y: centerY },
    })

    // Map old node IDs to new ones to avoid conflicts
    const idMap = {}
    importedGraphData.nodes.forEach((node) => {
      const newId = generateUUID()
      idMap[node.id] = newId

      // Calculate relative position offset
      const relativeX = node.position?.x || 0
      const relativeY = node.position?.y || 0

      cyInstance.value.add({
        group: 'nodes',
        data: {
          ...node,
          id: newId,
          originalId: node.id, // Keep reference to original
          parent: clusterId,
        },
        position: {
          x: relativeX,
          y: relativeY,
        },
      })
    })

    // Add edges with mapped IDs
    importedGraphData.edges.forEach((edge) => {
      const newSource = idMap[edge.source]
      const newTarget = idMap[edge.target]

      if (newSource && newTarget) {
        cyInstance.value.add({
          group: 'edges',
          data: {
            ...edge,
            id: generateUUID(),
            source: newSource,
            target: newTarget,
          },
        })
      }
    })

    showStatus('Saving imported cluster...', 'info')
    await saveGraph()
    showStatus(
      `Graph "${graphTitle}" imported with ${importedGraphData.nodes.length} nodes`,
      'success'
    )

    // Select the imported cluster
    cyInstance.value.$(':selected').unselect()
    cyInstance.value.$(`#${clusterId}`).select()
    cyInstance.value.fit(cyInstance.value.$(`#${clusterId}`), 50)
  } catch (error) {
    console.error('Failed to import graph:', error)
    showStatus(`Unable to import graph: ${error.message}`, 'error')
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

const toggleFullscreen = async () => {
  const target = graphCanvasRoot.value
  if (!target) {
    showStatus('Canvas not ready for fullscreen', 'warning')
    return
  }

  try {
    if (!document.fullscreenElement) {
      await target.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.error('Fullscreen toggle failed:', error)
    showStatus('Fullscreen mode is unavailable in this browser.', 'error')
  }
}

// Status message helper
const showStatus = (message, type = 'info') => {
  statusMessage.value = message
  statusClass.value = `alert-${type === 'error' ? 'danger' : type}`

  setTimeout(() => {
    statusMessage.value = ''
    statusClass.value = ''
  }, 3000)
}

// Initialize empty canvas
const initializeEmptyCanvas = () => {
  const container = document.getElementById('graph-canvas')
  if (!container) return

  if (cyInstance.value) {
    cyInstance.value.destroy()
  }

  resetInteractionModes()

  cyInstance.value = cytoscape({
    container: container,
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          display: 'element',
          label: (ele) =>
            ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
          'background-color': (ele) => ele.data('color') || '#ccc',
          color: (ele) => ele.data('fontColor') || '#000',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#FF9800',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#999',
          'target-arrow-color': '#999',
          'target-arrow-shape': 'triangle',
          'curve-style': 'unbundled-bezier',
        },
      },
      {
        selector: ':parent',
        style: {
          'background-opacity': 0.2,
          'background-color': (ele) => ele.data('sourceGraphId') ? '#B8E6B8' : '#A5D6FF',
          'border-width': 3,
          'border-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'border-style': 'dashed',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-weight': 'bold',
          'font-size': '16px',
          'padding': '20px',
          label: (ele) => {
            const collapsed = ele.data('collapsed')
            const childCount = ele.children().length
            const label = ele.data('label') || 'Cluster'
            const isImported = ele.data('sourceGraphId') ? ' 🌐' : ''
            return collapsed ? `${label} [${childCount}]${isImported}` : `${label}${isImported}`
          },
        },
      },
      {
        selector: ':parent[collapsed]',
        style: {
          'background-color': (ele) => ele.data('sourceGraphId') ? '#2DA44E' : '#0969DA',
          'background-opacity': 0.4,
          'border-style': 'solid',
          width: '400px',
          height: '400px',
        },
      },
    ],
    layout: { name: 'grid' },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: true,
    selectionType: 'single',
    // Fine-tuned zoom settings
    wheelSensitivity: 0.1, // Reduce wheel sensitivity for finer control
    minZoom: 0.001, // Minimum zoom level (0.1%)
    maxZoom: 500, // Maximum zoom level (50000%)
    zoomingEnabled: true,
    panningEnabled: true,
  })

  setupEventListeners()
  updateCanvasInteractionState()
  showStatus('Canvas initialized - select a graph to load data', 'info')
  bumpResizeUpdate()
}

// Handle URL parameters and store changes
const handleGraphIdChange = async (newGraphId) => {
  if (newGraphId && knowledgeGraphs.value.length > 0) {
    console.log('Loading graph from ID change:', newGraphId)
    await loadGraph()
  }
}

watch([placementMode, edgeMode], () => {
  updateCanvasInteractionState()
}, { immediate: true })

// Watch for changes in currentGraphId (from store or URL)
watch(() => graphStore.currentGraphId, handleGraphIdChange)

// Node Resize Handlers
const startNodeResize = (direction, event) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.nodes(':selected')
  if (selectedNodes.length !== 1) return

  const node = selectedNodes.first()
  if (node.isParent()) return

  isResizingNode.value = true
  resizeDirection.value = direction
  resizeTargetNode.value = node
  resizeStartPos.value = { x: event.clientX, y: event.clientY }

  // Get current node dimensions
  const width = node.width()
  const height = node.height()
  const pos = node.position()

  resizeStartSize.value = { width, height }
  resizeStartNodePos.value = { x: pos.x, y: pos.y }

  document.addEventListener('mousemove', handleNodeResize)
  document.addEventListener('mouseup', stopNodeResize)

  // Prevent node dragging during resize
  node.ungrabify()
  bumpResizeUpdate()
}

const handleNodeResize = (event) => {
  if (!isResizingNode.value || !resizeTargetNode.value) return

  const node = resizeTargetNode.value
  const deltaX = event.clientX - resizeStartPos.value.x
  const deltaY = event.clientY - resizeStartPos.value.y

  // Get zoom level for accurate delta calculation
  const zoom = cyInstance.value.zoom()
  const minSizePx = 50
  const minSize = minSizePx / zoom

  let newWidth = resizeStartSize.value.width
  let newHeight = resizeStartSize.value.height
  let newX = resizeStartNodePos.value.x
  let newY = resizeStartNodePos.value.y

  const dir = resizeDirection.value
  const shiftKey = event.shiftKey
  const startAspectRatio = resizeStartSize.value.width / resizeStartSize.value.height

  // Calculate new dimensions based on resize direction
  if (dir.includes('e')) {
    newWidth = Math.max(minSize, resizeStartSize.value.width + deltaX / zoom)
  }
  if (dir.includes('w')) {
    newWidth = Math.max(minSize, resizeStartSize.value.width - deltaX / zoom)
    const widthDelta = newWidth - resizeStartSize.value.width
    if (newWidth >= minSize) {
      newX = resizeStartNodePos.value.x - widthDelta / 2
    }
  }
  if (dir.includes('s')) {
    newHeight = Math.max(minSize, resizeStartSize.value.height + deltaY / zoom)
  }
  if (dir.includes('n')) {
    newHeight = Math.max(minSize, resizeStartSize.value.height - deltaY / zoom)
    const heightDelta = newHeight - resizeStartSize.value.height
    if (newHeight >= minSize) {
      newY = resizeStartNodePos.value.y - heightDelta / 2
    }
  }

  // Maintain aspect ratio when Shift is held
  if (shiftKey) {
    const currentAspectRatio = newWidth / newHeight
    
    // Determine which dimension to adjust based on resize direction
    if (dir === 'e' || dir === 'w') {
      // Horizontal only - adjust height to match
      newHeight = newWidth / startAspectRatio
    } else if (dir === 'n' || dir === 's') {
      // Vertical only - adjust width to match
      newWidth = newHeight * startAspectRatio
    } else {
      // Corner resize - use the larger change
      const widthChange = Math.abs(newWidth - resizeStartSize.value.width)
      const heightChange = Math.abs(newHeight - resizeStartSize.value.height)
      
      if (widthChange > heightChange) {
        newHeight = newWidth / startAspectRatio
      } else {
        newWidth = newHeight * startAspectRatio
      }
    }
    
    // Recalculate position for north/west directions with aspect ratio
    if (dir.includes('w')) {
      const widthDelta = newWidth - resizeStartSize.value.width
      newX = resizeStartNodePos.value.x - widthDelta / 2
    }
    if (dir.includes('n')) {
      const heightDelta = newHeight - resizeStartSize.value.height
      newY = resizeStartNodePos.value.y - heightDelta / 2
    }
  }

  // Apply the new size using style
  node.style({
    width: newWidth,
    height: newHeight,
  })

  // Update position if resizing from top or left
  if (dir.includes('n') || dir.includes('w')) {
    node.position({ x: newX, y: newY })
  }

  // Store dimensions in node data for persistence
  node.data('customWidth', newWidth)
  node.data('customHeight', newHeight)
  bumpResizeUpdate()
}

const stopNodeResize = () => {
  if (resizeTargetNode.value) {
    // Re-enable grabbing
    resizeTargetNode.value.grabify()
  }

  isResizingNode.value = false
  resizeDirection.value = null
  resizeTargetNode.value = null

  document.removeEventListener('mousemove', handleNodeResize)
  document.removeEventListener('mouseup', stopNodeResize)

  // Mark graph as modified
  showStatus('Node resized', 'success')
  bumpResizeUpdate()
}

// AI Chat Panel - Resize handlers
const getMaxChatWidth = () => Math.min(800, window.innerWidth * 0.5)

const clampChatWidthToViewport = () => {
  const maxWidth = getMaxChatWidth()
  if (chatWidth.value > maxWidth) {
    chatWidth.value = maxWidth
  }
}

const startChatResize = (e) => {
  isResizingChat.value = true
  chatResizeStartX = e.clientX
  chatResizeStartWidth = chatWidth.value
  document.addEventListener('mousemove', handleChatResize)
  document.addEventListener('mouseup', stopChatResize)
}

const handleChatResize = (e) => {
  if (!isResizingChat.value) return
  const delta = chatResizeStartX - e.clientX
  const newWidth = Math.max(300, Math.min(getMaxChatWidth(), chatResizeStartWidth + delta))
  chatWidth.value = newWidth
}

const stopChatResize = () => {
  isResizingChat.value = false
  document.removeEventListener('mousemove', handleChatResize)
  document.removeEventListener('mouseup', stopChatResize)
}

// AI Chat Panel - Insert AI response as fulltext node
const insertAIResponseAsFullText = async (content) => {
  if (!cyInstance.value) return

  // Create new fulltext node with AI response
  const newNodeId = generateUUID()

  // Calculate position - center of visible viewport
  const extent = cyInstance.value.extent()
  const position = {
    x: (extent.x1 + extent.x2) / 2,
    y: (extent.y1 + extent.y2) / 2
  }

  // Create a summary label from the content (first 50 chars)
  const labelPreview = content.substring(0, 50).replace(/\n/g, ' ').trim()
  const label = labelPreview.length < content.length ? `${labelPreview}...` : labelPreview

  cyInstance.value.add({
    data: {
      id: newNodeId,
      label: 'AI Response',
      type: 'fulltext',
      fullText: content,
      info: label,
      color: '#e8f4f8',
      fontColor: '#000',
      createdAt: new Date().toISOString()
    },
    position: position
  })

  showStatus('AI response inserted as new fulltext node', 'success')

  // Auto-save the graph
  await saveGraph()
}

// AI Chat Panel - Update selection context when node is selected
const updateChatSelectionFromNode = (node) => {
  if (!node) {
    chatSelection.value = null
    return
  }

  const textContent = node.data('fullText') || node.data('info') || node.data('label') || ''

  chatSelection.value = {
    text: textContent,
    nodeId: node.id(),
    nodeLabel: node.data('label'),
    nodeType: node.data('type'),
    source: 'node-selection',
    updatedAt: Date.now()
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  // Clamp chat width on window resize
  window.addEventListener('resize', handleWindowResize)

  // Close context menu when clicking outside
  document.addEventListener('click', (e) => {
    const contextMenuEl = document.querySelector('.context-menu')
    if (contextMenu.value.show && contextMenuEl && !contextMenuEl.contains(e.target)) {
      contextMenu.value.show = false
    }
  })

  if (!userStore.loggedIn) {
    router.push('/login')
    return
  }

  // Check URL parameters first
  const urlGraphId = route.query.graphId
  if (urlGraphId) {
    console.log('Found graphId in URL:', urlGraphId)
    graphStore.setCurrentGraphId(urlGraphId)
  }

  // Initialize empty canvas first
  setTimeout(() => {
    initializeEmptyCanvas()
  }, 100)

  await loadGraphs()

  // Auto-load current graph if one is stored
  if (graphStore.currentGraphId) {
    console.log('Auto-loading stored graph:', graphStore.currentGraphId)
    await loadGraph()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  // Clean up chat resize listeners
  document.removeEventListener('mousemove', handleChatResize)
  document.removeEventListener('mouseup', stopChatResize)
  // Clean up node resize listeners
  document.removeEventListener('mousemove', handleNodeResize)
  document.removeEventListener('mouseup', stopNodeResize)
  window.removeEventListener('resize', handleWindowResize)
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
  if (cyInstance.value) {
    cyInstance.value.destroy()
  }
})
</script>

<style scoped>
.graph-canvas {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  position: relative;
}

:global(.graph-canvas:fullscreen),
:global(.graph-canvas:-webkit-full-screen) {
  height: 100vh;
  width: 100vw;
  background: #f8f9fa;
}

.canvas-toolbar {
  background: white;
  border-bottom: 1px solid #dee2e6;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.canvas-title {
  margin: 0;
  color: #495057;
  font-size: 1.25rem;
  font-weight: 600;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input {
  width: 200px;
}

.status-bar {
  padding: 0.5rem 1rem;
  text-align: center;
  font-weight: 500;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
}
.alert-info {
  background-color: #d1ecf1;
  color: #0c5460;
}
.alert-warning {
  background-color: #fff3cd;
  color: #856404;
}
.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  transition: flex 0.2s ease;
}

/* AI Chat Panel Layout */
.canvas-with-chat {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.canvas-with-chat.chat-open .canvas-container {
  flex: 1;
}

.chat-resize-handle {
  width: 6px;
  cursor: ew-resize;
  background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
  transition: background 0.2s;
  flex-shrink: 0;
}

.chat-resize-handle:hover {
  background: linear-gradient(90deg, transparent, #007bff, transparent);
}

.chat-resize-handle:active {
  background: linear-gradient(90deg, transparent, #0056b3, transparent);
}

.chat-panel-container {
  height: 100%;
  min-width: 300px;
  max-width: 800px;
  border-left: 1px solid #e0e0e0;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.ai-chat-toggle {
  font-weight: 500;
  transition: all 0.2s ease;
}

.ai-chat-toggle:hover {
  transform: scale(1.02);
}

.ai-chat-toggle.btn-primary {
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.floating-node-menu {
  position: absolute;
  left: 1rem;
  top: calc(1rem + 100px);
  width: 240px;
  background: rgba(255, 255, 255, 0.97);
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 5;
}

.floating-node-menu .menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.floating-node-menu .menu-status {
  font-size: 0.75rem;
  color: #0d6efd;
}

.floating-node-menu .btn {
  width: 100%;
}

.floating-node-menu .btn.active {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.floating-node-menu .menu-hint {
  font-size: 0.8rem;
  color: #495057;
  margin: 0;
}

.floating-node-menu .shape-options {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #dee2e6;
}

.floating-node-menu .menu-subheader {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.floating-node-menu .shape-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.floating-node-menu .shape-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.floating-node-menu .color-options {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #dee2e6;
}

.floating-node-menu .color-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.floating-node-menu .color-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  border: 2px solid #dee2e6;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.floating-node-menu .color-btn:hover {
  transform: scale(1.1);
  border-color: #0969DA;
}

.floating-node-menu .color-picker-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.floating-node-menu .color-picker-input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
}

.floating-node-menu .color-picker-input:hover {
  border-color: #0969DA;
}

.floating-node-menu .color-picker-label {
  font-size: 0.75rem;
  color: #6c757d;
}

.cytoscape-canvas {
  width: 100%;
  height: 100%;
  background: white;
}

.selection-info {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 200px;
  padding: 0.25rem 0;
}

.context-menu-section {
  padding: 0.25rem 0;
}

.context-menu-header {
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.context-menu-divider {
  height: 1px;
  background-color: #dee2e6;
  margin: 0.25rem 0;
}

.context-menu-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background-color: #f8f9fa;
}

.context-menu-item.danger:hover {
  background-color: #fee;
  color: #dc3545;
}

.context-menu-icon {
  font-size: 1.1rem;
}

.graph-canvas.placement-active .cytoscape-canvas {
  cursor: crosshair;
}

.graph-canvas.edge-active .cytoscape-canvas {
  cursor: pointer;
}

.graph-canvas.interaction-locked .cytoscape-canvas {
  user-select: none;
}

.graph-import-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.graph-import-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.graph-import-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.graph-import-modal .modal-header h5 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.graph-import-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.info-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.info-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-modal .modal-header h5 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.info-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.info-modal .modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.info-textarea {
  font-family: 'Courier New', Courier, monospace;
  font-size: 16px;
  line-height: 1.5;
  resize: vertical;
  color: #000;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.btn-close:hover {
  opacity: 1;
}

.graph-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.graph-card {
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.graph-card:hover {
  border-color: #0969DA;
  background: #f8f9fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.graph-card-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #212529;
}

.graph-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.graph-card-meta .badge {
  align-self: flex-start;
  font-size: 0.75rem;
}

/* Highlighted nodes */
:global(.highlighted) {
  background-color: #ff5722 !important;
  border-color: #d84315 !important;
}

/* Node Resize Handles */
.node-resize-handles {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  border: 2px solid #0969DA;
  border-radius: 2px;
  box-sizing: border-box;
}

.resize-handle {
  position: absolute;
  background: #0969DA;
  border: 2px solid white;
  border-radius: 2px;
  pointer-events: auto;
  z-index: 101;
}

/* Edge handles (top, bottom, left, right) */
.resize-handle-n,
.resize-handle-s {
  width: 12px;
  height: 8px;
  left: 50%;
  transform: translateX(-50%);
  cursor: ns-resize;
}

.resize-handle-n {
  top: -5px;
}

.resize-handle-s {
  bottom: -5px;
}

.resize-handle-e,
.resize-handle-w {
  width: 8px;
  height: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: ew-resize;
}

.resize-handle-e {
  right: -5px;
}

.resize-handle-w {
  left: -5px;
}

/* Corner handles */
.resize-handle-ne,
.resize-handle-nw,
.resize-handle-se,
.resize-handle-sw {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.resize-handle-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.resize-handle-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.resize-handle-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.resize-handle-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.resize-handle:hover {
  background: #0550ae;
  transform-origin: center;
}

.resize-handle-n:hover,
.resize-handle-s:hover {
  transform: translateX(-50%) scale(1.1);
}

.resize-handle-e:hover,
.resize-handle-w:hover {
  transform: translateY(-50%) scale(1.1);
}

.resize-handle-ne:hover,
.resize-handle-nw:hover,
.resize-handle-se:hover,
.resize-handle-sw:hover {
  transform: scale(1.2);
}

/* Responsive design */
@media (max-width: 768px) {
  .canvas-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-section {
    justify-content: center;
  }

  .search-input {
    width: 100%;
  }
}
</style>
