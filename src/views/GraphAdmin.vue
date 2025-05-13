<template>
  <div class="admin-page" :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }">
    <!-- Top Bar -->
    <TopBar
      :selected-graph-id="selectedGraphId"
      :knowledge-graphs="knowledgeGraphs"
      :current-graph-id="graphStore.currentGraphId"
      :validation-errors="validationErrors"
      @update:selectedGraphId="updateSelectedGraphId"
      @toggle-sidebar="toggleSidebar"
    />

    <!-- Main Content -->
    <div class="main-content container-fluid" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <div class="row">
        <!-- Sidebar -->
        <Sidebar
          ref="sidebarRef"
          :sidebar-collapsed="sidebarCollapsed"
          :theme="theme"
          :active-tab="activeTab"
          :graph-metadata="graphStore.graphMetadata"
          :graph-history="graphHistory"
          :selected-history-index="selectedHistoryIndex"
          :selected-element="selectedElement"
          :fetched-templates="fetchedTemplates"
          :selected-graph-id="selectedGraphId"
          @update:activeTab="activeTab = $event"
          @save-graph="saveGraph"
          @history-keydown="handleHistoryKeydown"
          @history-item-click="onHistoryItemClick"
          @apply-template="applyTemplate"
          @update:graphMetadata="updateGraphMetadata"
          @fetch-work-notes="fetchWorkNotes"
          @add-work-note="addWorkNoteToGraph"
        />

        <!-- Main Graph Editor -->
        <div class="col-md-9 main-panel" :class="{ expanded: sidebarCollapsed }">
          <div class="row">
            <!-- Template Message -->
            <div v-if="templateMessage" class="alert alert-info text-center" role="alert">
              {{ templateMessage }}
            </div>

            <!-- Graph Editor -->
            <div class="col-12 graph-content">
              <div class="row">
                <!--<h2 class="graph-title text-center">Knowledge Story Graph</h2>-->
                <div class="col-md-12 graph-editor-container">
                  <div class="graph-editor">
                    <div
                      id="cy"
                      class="cy-container"
                      style="width: 100%; height: 600px; border: 1px solid #ddd"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Control Panel (Search and History) -->
            <div class="col-12 control-panel bg-light p-3 border-bottom">
              <div class="row align-items-center">
                <!-- Search Field -->
                <div class="col-md-6 mb-2">
                  <label for="searchField" class="form-label"><strong>Search Nodes:</strong></label>
                  <input
                    id="searchField"
                    v-model="searchQuery"
                    @input="searchNodes"
                    type="text"
                    class="form-control"
                    placeholder="Search by node name..."
                  />
                </div>
                <!-- Buttons -->
                <div class="col-md-6 mb-2 text-end">
                  <button @click="centerAndZoom" class="btn btn-outline-secondary me-2">
                    <span class="material-icons">center_focus_strong</span>
                  </button>
                  <button
                    @click="alignSelectedNodes('horizontal')"
                    class="btn btn-outline-secondary me-2"
                  >
                    <span class="material-icons">align_horizontal_center</span>
                  </button>
                  <button
                    @click="alignSelectedNodes('vertical')"
                    class="btn btn-outline-secondary me-2"
                  >
                    <span class="material-icons">align_vertical_center</span>
                  </button>
                  <button @click="alignSelectedNodes('center')" class="btn btn-outline-secondary">
                    <span class="material-icons">filter_center_focus</span>
                  </button>
                  <button
                    @click="spreadSelectedNodes('horizontal')"
                    class="btn btn-outline-secondary me-2"
                  >
                    <span class="material-icons">space_bar</span>
                  </button>
                  <button
                    @click="spreadSelectedNodes('vertical')"
                    class="btn btn-outline-secondary"
                  >
                    <span class="material-icons">height</span>
                  </button>
                  <button @click="undoAction" class="btn btn-outline-secondary me-2">
                    <span class="material-icons">undo</span>
                  </button>
                  <button @click="redoAction" class="btn btn-outline-secondary">
                    <span class="material-icons">redo</span>
                  </button>
                </div>
              </div>
            </div>
            <!-- JSON Editor -->
            <div class="col-12">
              <div v-if="saveMessage" class="alert alert-success text-center" role="alert">
                {{ saveMessage }}
              </div>
              <div
                v-if="validationMessage"
                class="alert text-center"
                :class="validationMessageClass"
                role="alert"
              >
                {{ validationMessage }}
              </div>

              <div class="d-flex justify-content-between mb-3 action-buttons">
                <div class="d-flex align-items-center">
                  <button @click="verifyJson" class="btn btn-secondary me-2">Verify JSON</button>
                  <button @click="saveCurrentGraph" class="btn btn-primary me-2">
                    Save Current Graph
                  </button>
                  <button
                    v-if="graphStore.currentGraphId"
                    @click="goToGraphViewer"
                    class="btn btn-outline-primary"
                  >
                    View Graph
                  </button>
                </div>
              </div>

              <label for="JsonEditor" class="form-label"><strong>Graph Json Editor:</strong></label>
              <textarea
                id="JsonEditor"
                v-model="graphJson"
                class="form-control"
                style="height: 300px; font-family: monospace; white-space: pre-wrap"
              ></textarea>
              <div class="d-flex align-items-center mt-2">
                <label class="me-2 ms-3">Search JSON:</label>
                <input
                  type="text"
                  v-model="jsonSearchQuery"
                  @input="searchJson"
                  class="form-control"
                  placeholder="Search JSON..."
                  style="max-width: 200px"
                />
                <label class="me-2 ms-3"
                  ><input type="checkbox" v-model="caseSensitive" /> Case Sensitive</label
                >
                <button
                  @click="prevMatch"
                  class="btn btn-outline-secondary me-2"
                  :disabled="matchCount <= 1"
                >
                  Previous
                </button>
                <button
                  @click="nextMatch"
                  class="btn btn-outline-secondary me-2"
                  :disabled="matchCount <= 1"
                >
                  Next
                </button>
                <span>{{
                  matchCount ? `${matchCount} match${matchCount > 1 ? 'es' : ''}` : ''
                }}</span>
              </div>
              <div
                id="jsonOutput"
                class="mt-2"
                style="
                  background: #f5f5f5;
                  border: 1px solid #ccc;
                  padding: 10px;
                  font-family: monospace;
                  font-size: 14px;
                  white-space: pre-wrap;
                  max-height: 400px;
                  overflow-y: auto;
                "
              ></div>
              <div
                v-if="jsonMessage"
                class="mt-2"
                :class="{
                  'text-danger': jsonMessage.includes('Invalid'),
                  'text-muted': !jsonMessage.includes('Invalid'),
                }"
              >
                {{ jsonMessage }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Add a context menu container -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ top: `${contextMenuPosition.y}px`, left: `${contextMenuPosition.x}px` }"
    >
      <ul>
        <li v-for="(option, index) in contextMenuOptions" :key="index" @click="option.action">
          {{ option.label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'
import undoRedo from 'cytoscape-undo-redo'
import TopBar from '../components/TopBar.vue' // Import TopBar
import Sidebar from '../components/sidebar.vue'
// Register the undo-redo extension only if it hasn't been registered already
if (!cytoscape.prototype.undoRedo) {
  undoRedo(cytoscape)
}

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useRouter } from 'vue-router'

const router = useRouter()

const goToGraphViewer = () => {
  if (graphStore.currentGraphId) {
    router.push({ name: 'GraphViewer', query: { graphId: graphStore.currentGraphId } })
  }
}

const cyInstance = ref(null)
const graphStore = useKnowledgeGraphStore()
const selectedElement = ref(null)
const searchQuery = ref('')
const validationErrors = ref([])
const sidebarRef = ref(null) // Define a reference for the Sidebar component

const fetchWorkNotes = (graphId) => {
  if (!graphId) {
    console.warn('No graph ID provided for fetching work notes.')
    return
  }
  if (typeof sidebarRef.value?.fetchWorkNotes === 'function') {
    console.log('Invoking fetchWorkNotes for graph ID:', graphId)
    sidebarRef.value.fetchWorkNotes(graphId)
  } else {
    console.error('fetchWorkNotes is not a function on Sidebar component')
  }
}

const updateSelectedGraphId = (newValue) => {
  selectedGraphId.value = newValue
  loadSelectedGraph()
  fetchWorkNotes(newValue) // Fetch work notes for the selected graph
}

const saveMessage = ref('')
const graphHistory = ref([])
const selectedHistoryIndex = ref(-1)
const knowledgeGraphs = ref([])
const selectedGraphId = ref('')
const graphJson = ref(`{
  nodes: [
    { id: 'main', label: 'Main Node', color: 'blue' },
    { id: 'first', label: 'First Node', color: 'red' },
    { id: 'node3', label: 'Node 3', color: 'green' },
    { id: 'Asgard', label: 'Asgard', color: 'goldenrod' }
  ],
  edges: [
    { source: 'main', target: 'first' }
  ]
}`)
const sidebarCollapsed = ref(false)
const activeTab = ref('form')
const validationMessage = ref('')
const validationMessageClass = ref('alert-danger')
const undoRedoInstance = ref(null)
const graphTemplates = ref([
  {
    name: 'Info Node Template',
    nodes: [
      {
        id: 'infoNodeDefault',
        label: 'New Info Node',
        color: '#FF5733',
        type: 'info',
        info: 'Provide a detailed description of the topic or concept for this node. Aim for 100-300 words to ensure clarity and depth. Include key facts, insights, or observations, and consider structuring your text for readability (e.g., use paragraphs or lists). For example, describe the historical, cultural, scientific, or spiritual significance of the topic. If applicable, include:\n\n1. [Key Point 1: e.g., historical context or specific discovery]\n2. [Key Point 2: e.g., cultural or practical implications]\n3. [Key Point 3: e.g., connections to other fields or traditions]\n\nExplain how this topic relates to your project or knowledge graph. Highlight unique aspects or interdisciplinary connections to engage users. Ensure the tone is informative yet accessible, avoiding overly technical jargon unless necessary.',
        bibl: [
          '[Author Last Name, First Initial. (Year). Title of the work. Publisher. DOI/URL]',
          '[Source 1: e.g., book title, article, or URL]',
          '[Source 2: e.g., academic paper, traditional text, or oral source]',
          '[Source 3: e.g., modern reference or dataset]',
          '[Source 4: e.g., website or multimedia source]',
        ],
        imageWidth: '100%',
        imageHeight: '100%',
      },
    ],
    edges: [],
  },
  {
    name: 'Notes Node Template',
    nodes: [
      {
        id: 'notesNodeDefault',
        label: 'New Notes Node',
        color: '#f4e2d8',
        type: 'notes',
        info: 'Provide a concise note or insight about the topic, typically 50-150 words. Focus on a specific aspect, observation, or connection relevant to your project or knowledge graph. For example, highlight a key idea, historical detail, cultural significance, or interdisciplinary link. Structure the text for clarity (e.g., a single paragraph or short list). If applicable, include:\n\n1. [Key Idea: e.g., a specific insight or observation]\n2. [Context: e.g., why this matters or its relevance]\n\nKeep the tone clear and engaging, avoiding overly complex terms. Ensure the note adds value by connecting to broader themes or nodes in your graph.',
        bibl: [
          '[Author Last Name, First Initial. (Year). Title of the work. Publisher. DOI/URL]',
          '[Source 1: e.g., book title, article, or URL]',
          '[Source 2: e.g., academic paper, traditional text, or oral source]',
        ],
        imageWidth: '100%',
        imageHeight: '100%',
      },
    ],
    edges: [],
  },

  // Add more templates as needed
  {
    name: 'Title Node',
    nodes: [
      {
        label: 'This is the title',
        color: 'white',
        type: 'title',
        info: null,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
      },
    ],
    edges: [],
  },
  { name: 'Custom Graph', nodes: [], edges: [] },

  { name: 'Custom Template', nodes: [], edges: [] },
])

const testEndpoint = async (endpoint, content) => {
  console.log('Testing endpoint:', endpoint, 'with content:', content) // Debug log

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: content }),
    })
    if (!response.ok) {
      console.error('Endpoint test failed:', response.statusText)
      return null
    }
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error testing endpoint:', error)
    return null
  }
}

const fetchedTemplates = ref([])

// Fetch templates from the endpoint
const fetchTemplates = async () => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')
    if (response.ok) {
      const data = await response.json()
      console.log('Fetched templates:', data) // Debug log
      fetchedTemplates.value = data.results.map((template) => ({
        name: template.name,
        nodes: JSON.parse(template.nodes),
        edges: JSON.parse(template.edges),
      }))
    } else {
      console.error('Failed to fetch templates')
    }
  } catch (error) {
    console.error('Error fetching templates:', error)
  }
}

// Fetch templates on component mount
onMounted(() => {
  fetchTemplates()
})

// JSON Search refs
const jsonSearchQuery = ref('')
const caseSensitive = ref(false)
const matchCount = ref(0)
const jsonMessage = ref('')
const currentMatchIndex = ref(0)
const templateMessage = ref('') // Add a ref for the template message

// Debounce utility
const debounce = (func, delay) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), delay)
  }
}

// Escape HTML to prevent XSS
const escapeHtml = (text) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const highlightMatches = (text, query, caseSensitive) => {
  if (!query) return escapeHtml(text)
  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags)
  return text
    .split(regex)
    .map((part) =>
      regex.test(part) ? `<span class="match">${escapeHtml(part)}</span>` : escapeHtml(part),
    )
    .join('')
}

const searchJson = () => {
  const editor = document.getElementById('JsonEditor')
  const output = document.getElementById('jsonOutput')
  if (!editor || !output) return

  const query = jsonSearchQuery.value.trim()
  output.innerHTML = ''
  jsonMessage.value = ''
  matchCount.value = 0
  currentMatchIndex.value = 0

  if (!query) {
    try {
      const json = JSON.parse(graphJson.value)
      output.textContent = JSON.stringify(json, null, 2)
    } catch (e) {
      output.textContent = graphJson.value
      jsonMessage.value = 'Invalid JSON'
    }
    return
  }

  try {
    const json = JSON.parse(graphJson.value)
    const formattedJson = JSON.stringify(json, null, 2)
    output.innerHTML = highlightMatches(formattedJson, query, caseSensitive.value)

    const matches = output.querySelectorAll('.match')
    matchCount.value = matches.length
    if (matches.length === 0) {
      jsonMessage.value = 'No matches found'
      return
    }

    updateMatchFocus(matches)
  } catch (e) {
    output.textContent = graphJson.value
    jsonMessage.value = 'Invalid JSON'
  }
}

const updateMatchFocus = (matches) => {
  matches.forEach((match, i) => {
    match.classList.toggle('focused', i === parseInt(currentMatchIndex.value))
    if (i === parseInt(currentMatchIndex.value)) {
      match.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// Navigate to previous match
const prevMatch = () => {
  const matches = document.getElementById('jsonOutput').querySelectorAll('.match')
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matches.length) % matches.length
  updateMatchFocus(matches)
}

// Navigate to next match
const nextMatch = () => {
  const matches = document.getElementById('jsonOutput').querySelectorAll('.match')
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.length
  updateMatchFocus(matches)
}

// Debounced search
const debouncedSearchJson = debounce(searchJson, 300)

const applyTemplate = (template) => {
  const parsedNodes = template.nodes.map((node) => ({
    ...node,
    position: node.position || null,
  }))
  const parsedEdges = template.edges.map((edge) => ({
    ...edge,
  }))

  const updatedGraph = {
    nodes: [...graphStore.nodes.map((n) => n.data), ...parsedNodes],
    edges: [...graphStore.edges.map((e) => e.data), ...parsedEdges],
  }

  graphJson.value = JSON.stringify(updatedGraph, null, 2)
  templateMessage.value = `Template "${template.name}" added successfully!`

  setTimeout(() => {
    templateMessage.value = ''
  }, 3000)
}

// Initialize standard graph
const initializeStandardGraph = () => {
  const standardGraph = {
    nodes: [
      { id: 'node1', label: 'Node 1', color: 'blue' },
      { id: 'node2', label: 'Node 2', color: 'green' },
      { id: 'node3', label: 'Node 3', color: 'red' },
      {
        id: 'node4',
        label: 'Node 4',
        color: 'purple',
        type: 'infonode',
        info: 'This is Node 4, an example of an info node.',
      },
    ],
    edges: [
      { source: 'node1', target: 'node2' },
      { source: 'node2', target: 'node3' },
    ],
  }

  graphStore.nodes = standardGraph.nodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      color: node.color,
      type: node.type || null,
      info: node.info || null,
    },
  }))
  graphStore.edges = standardGraph.edges.map((edge) => ({
    data: {
      source: edge.source,
      target: edge.target,
    },
  }))

  const jsonString = JSON.stringify(
    {
      nodes: graphStore.nodes.map((node) => node.data),
      edges: graphStore.edges.map((edge) => edge.data),
    },
    null,
    2,
  )

  graphJson.value = jsonString
  graphStore.graphJson = jsonString

  if (cyInstance.value) {
    cyInstance.value.elements().remove()
    cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
    cyInstance.value.layout({ name: 'grid' }).run()
  }
}

// Search nodes
const searchNodes = () => {
  if (!cyInstance.value) return

  cyInstance.value.elements().removeClass('highlighted')

  if (searchQuery.value.trim() === '') return

  const matchingNodes = cyInstance.value
    .nodes()
    .filter((node) => node.data('label').toLowerCase().includes(searchQuery.value.toLowerCase()))

  matchingNodes.addClass('highlighted')

  if (matchingNodes.length > 0) {
    cyInstance.value.fit(matchingNodes, 50)
  }
}

// Add node
const addNode = () => {
  const id = `node${graphStore.nodes.length + 1}`
  const label = `Node ${graphStore.nodes.length + 1}`
  const newNode = { data: { id, label, color: 'gray' } }
  graphStore.pushToUndoStack({ type: 'addNode', nodeId: id, node: newNode })
  graphStore.nodes.push(newNode)
  cyInstance.value.add(newNode)
}

// Add edge
const addEdge = () => {
  if (graphStore.nodes.length < 2) {
    alert('You need at least two nodes to create an edge.')
    return
  }
  const source = graphStore.nodes[graphStore.nodes.length - 2].data.id
  const target = graphStore.nodes[graphStore.nodes.length - 1].data.id
  const newEdge = { data: { id: `${source}_${target}`, source, target } }
  graphStore.pushToUndoStack({ type: 'addEdge', edgeId: newEdge.data.id, edge: newEdge })
  graphStore.edges.push(newEdge)
  cyInstance.value.add(newEdge)
}

// Save graph
const saveGraph = async () => {
  if (cyInstance.value) {
    cyInstance.value.nodes().forEach((node) => {
      const graphNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (graphNode) {
        graphNode.position = node.position()
      }
    })
  }

  const graphData = {
    metadata: graphStore.graphMetadata,
    nodes: graphStore.nodes.map((node) => ({
      ...node.data,
      position: node.position,
      type: node.data.type || null,
      info: node.data.info || null,
    })),
    edges: graphStore.edges.map((edge) => ({
      ...edge.data,
      type: edge.data.type || null,
      info: edge.data.info || null,
    })),
  }

  try {
    const response = await fetch('https://knowledge.vegvisr.org/saveknowgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(graphData),
    })

    if (response.ok) {
      const result = await response.json()
      alert('Knowledge Graph saved successfully!')
      graphStore.currentGraphId = result.id
      fetchKnowledgeGraphs()
    } else {
      alert('Failed to save the Knowledge Graph.')
    }
  } catch (error) {
    console.error('Error saving the Knowledge Graph:', error)
    alert('An error occurred while saving the Knowledge Graph.')
  }
}

// Save current graph
const saveCurrentGraph = async () => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  if (cyInstance.value) {
    cyInstance.value.nodes().forEach((node) => {
      const graphNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
      if (graphNode) {
        graphNode.position = node.position()
      }
    })
  }

  try {
    const parsedGraph = JSON.parse(graphJson.value)

    if (!parsedGraph.nodes || !parsedGraph.edges) {
      alert('Invalid graph data. Please ensure the JSON contains "nodes" and "edges".')
      return
    }

    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphStore.currentGraphId}`,
    )
    if (response.ok) {
      const latestGraph = await response.json()
      const latestVersion = latestGraph.metadata.version

      if (graphStore.currentVersion !== latestVersion) {
        const userConfirmed = confirm(
          `Version mismatch detected. The current version is ${latestVersion}, but you are working on version ${graphStore.currentVersion}. Do you want to overwrite it?`,
        )

        if (!userConfirmed) {
          return
        }

        graphStore.setCurrentVersion(latestVersion)
      }
    }

    const graphData = {
      metadata: {
        title: graphStore.graphMetadata.title || 'Untitled Graph',
        description: graphStore.graphMetadata.description || '',
        createdBy: graphStore.graphMetadata.createdBy || 'Unknown',
        version: graphStore.currentVersion || 1,
      },
      nodes: graphStore.nodes.map((node) => ({
        ...node.data,
        position: node.position,
        visible: node.data.visible !== false, // Ensure visible field is included
      })),
      edges: graphStore.edges.map((edge) => ({
        ...edge.data,
        type: edge.data.type || null,
        info: edge.data.info || null,
      })),
    }

    const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: graphStore.currentGraphId,
        graphData,
        override: true,
      }),
    })

    if (saveResponse.ok) {
      const result = await saveResponse.json()
      saveMessage.value = 'Saved successfully!'

      graphStore.setCurrentVersion(result.newVersion)
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      fetchGraphHistory()
    } else {
      alert('Failed to save the graph.')
    }
  } catch (error) {
    console.error('Error saving the graph:', error)
    alert('An error occurred while saving the graph. Please check the JSON format.')
  }
}

// Center and zoom
const centerAndZoom = () => {
  if (cyInstance.value) {
    cyInstance.value.fit()
  }
}

// Update graph from JSON
const updateGraphFromJson = (parsedJson) => {
  graphStore.nodes = parsedJson.nodes.map((node) => ({
    data: {
      id: node.id,
      label: node.label,
      color: node.color || 'gray',
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? node.bibl : [],
    },
    position: node.position || null,
  }))

  graphStore.edges = parsedJson.edges.map((edge) => ({
    data: {
      id: edge.id || `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: edge.type || null,
      info: edge.info || null,
    },
  }))
}

// Handle JSON Editor Input
const onJsonEditorInput = () => {
  try {
    const parsedJson = JSON.parse(graphJson.value)
    validationMessage.value = 'JSON is valid!'
    validationMessageClass.value = 'alert-success'
    updateGraphFromJson(parsedJson)
  } catch (error) {
    validationMessage.value = `Invalid JSON: ${error.message}`
    validationMessageClass.value = 'alert-danger'
  }
}

// Verify JSON
const verifyJson = () => {
  try {
    const parsedJson = JSON.parse(graphJson.value)
    if (!parsedJson.nodes || !parsedJson.edges) {
      validationMessage.value = 'Invalid graph data. Ensure JSON contains "nodes" and "edges".'
      validationMessageClass.value = 'alert-danger'
      return // Do not clear the error message
    }

    // Check for duplicate node IDs
    const nodeIds = parsedJson.nodes.map((node) => node.id)
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      validationMessage.value = `Duplicate node IDs found: ${[...new Set(duplicateIds)].join(', ')}`
      validationMessageClass.value = 'alert-danger'
      return // Do not clear the error message
    }

    graphStore.nodes = parsedJson.nodes.map((node) => {
      const existingNode = graphStore.nodes.find((n) => n.data.id === node.id)
      return {
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || '100%',
          imageHeight: node.imageHeight || '100%',
          visible: node.visible !== false, // Ensure visible field is included
        },
        position: existingNode?.position || null,
      }
    })

    graphStore.edges = parsedJson.edges.map((edge) => ({
      data: {
        id: edge.id || `${edge.source}_${edge.target}`,
        source: edge.source,
        target: edge.target,
        label: edge.label !== undefined ? edge.label : null,
        type: edge.type !== undefined ? edge.type : null,
        info: edge.info !== undefined ? edge.info : null,
      },
    }))

    graphStore.graphJson = JSON.stringify(
      {
        nodes: graphStore.nodes.map((node) => node.data),
        edges: graphStore.edges.map((edge) => edge.data),
      },
      null,
      2,
    )

    if (cyInstance.value) {
      cyInstance.value.elements().remove()
      cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])

      // Update visibility for nodes
      cyInstance.value.nodes().forEach((node) => {
        const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
        if (storedNode?.position) {
          node.position(storedNode.position)
        }
        // Ensure all nodes are displayed in the graph editor
        node.style('display', 'element')
      })

      cyInstance.value
        .layout({
          name: 'preset',
          animate: true,
          fit: true,
          padding: 30,
        })
        .run()

      cyInstance.value.nodes().forEach((node) => {
        const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
        if (storedNode?.position) {
          node.position(storedNode.position)
        }
        node.unlock()
      })
    }

    validationMessage.value = 'JSON is valid!'
    validationMessageClass.value = 'alert-success'
    setTimeout(() => {
      validationMessage.value = ''
      validationMessageClass.value = ''
    }, 2000)
  } catch (error) {
    // Detect plain text input
    if (graphJson.value.trim()) {
      const userConfirmed = confirm(
        'The input is not valid JSON but contains text. Do you want to transform it into a fulltext node?',
      )
      if (userConfirmed) {
        const newNode = {
          data: {
            id: `fulltext_${Date.now()}`,
            label: 'Fulltext Node',
            type: 'fulltext',
            info: graphJson.value.trim(),
            color: '#f9f9f9',
          },
          position: { x: 100, y: 100 },
        }
        graphStore.nodes.push(newNode)

        const actionNode = {
          data: {
            id: `action_txt_${Date.now()}`,
            label: 'images/ActionSummary.png',
            color: 'gray',
            type: 'action_txt',
            info: null,
            bibl: [],
            imageWidth: 180,
            imageHeight: 180,
            visible: false,
          },
          position: { x: 200, y: 200 },
        }
        graphStore.nodes.push(actionNode)

        const newEdge = {
          data: {
            id: `edge_${newNode.data.id}_${actionNode.data.id}`,
            source: newNode.data.id,
            target: actionNode.data.id,
          },
        }
        graphStore.edges.push(newEdge)

        if (cyInstance.value) {
          cyInstance.value.add(newNode)
          cyInstance.value.add(actionNode)
          cyInstance.value.add(newEdge)
          //cyInstance.value.layout({ name: 'preset' }).run()
        }
        graphJson.value = JSON.stringify(
          {
            nodes: graphStore.nodes.map((node) => node.data),
            edges: graphStore.edges.map((edge) => edge.data),
          },
          null,
          2,
        )
        validationMessage.value =
          'Transformed text into a fulltext node, added an action node, and connected them with an edge!'
        validationMessageClass.value = 'alert-success'
        setTimeout(() => {
          validationMessage.value = ''
          validationMessageClass.value = ''
        }, 2000)
        return
      }
    }

    validationMessage.value = `Invalid JSON: ${error.message}`
    validationMessageClass.value = 'alert-danger'
    console.error('Error parsing JSON:', error)
  }
}

// Fetch knowledge graphs
const fetchKnowledgeGraphs = async () => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs')
    if (response.ok) {
      const data = await response.json()
      knowledgeGraphs.value = data.results || []
    } else {
      console.error('Failed to fetch knowledge graphs')
    }
  } catch (error) {
    console.error('Error fetching knowledge graphs:', error)
  }
}

// Load selected graph
const loadSelectedGraph = async () => {
  const graphIdToLoad = selectedGraphId.value
  if (!graphIdToLoad) {
    console.warn('No graph ID selected.')
    return
  }

  try {
    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphIdToLoad}`)
    if (response.ok) {
      let graphData = await response.json()
      if (typeof graphData === 'string') {
        graphData = JSON.parse(graphData)
      }

      if (!graphData.nodes || !graphData.edges) {
        console.warn('Invalid graph data structure:', graphData)
        return
      }

      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || '100%',
          imageHeight: node.imageHeight || '100%',
          visible: node.visible !== false, // Ensure visible field is updated
        },
        position: node.position || null,
      }))

      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.label || null,
          type: edge.type || null,
          info: edge.info || null,
        },
      }))

      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }

      graphStore.setCurrentGraphId(graphIdToLoad)
      graphStore.setCurrentVersion(graphData.metadata.version)
      await fetchGraphHistory()
      fetchWorkNotes(graphIdToLoad) // Ensure work notes are fetched for the loaded graph
    } else {
      console.error('Failed to load the selected graph:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading the selected graph:', error)
  }
}

// Fetch graph history
const fetchGraphHistory = async () => {
  if (!graphStore.currentGraphId) {
    console.warn('No currentGraphId found. Cannot fetch history.')
    return
  }

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraphhistory?id=${graphStore.currentGraphId}`,
    )
    if (response.ok) {
      const data = await response.json()
      if (data.history && data.history.results) {
        graphHistory.value = data.history.results.map((item) => ({
          version: item.version,
          timestamp: item.timestamp,
        }))
      } else {
        graphHistory.value = []
      }
    } else {
      console.error('Failed to fetch graph history:', response.statusText)
      graphHistory.value = []
    }
  } catch (error) {
    console.error('Error fetching graph history:', error)
    graphHistory.value = []
  }
}

// Load graph version
const loadGraphVersion = async (version) => {
  if (!graphStore.currentGraphId) {
    console.warn('No currentGraphId found. Cannot load version.')
    return
  }

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraphversion?id=${graphStore.currentGraphId}&version=${version}`,
    )
    if (response.ok) {
      const graphData = await response.json()

      // Preserve existing action_txt nodes
      const existingActionTxtNodes = graphStore.nodes.filter(
        (node) => node.data.type === 'action_txt',
      )

      // Filter out duplicates by checking node IDs
      const newNodes = graphData.nodes.filter(
        (node) => !existingActionTxtNodes.some((existingNode) => existingNode.data.id === node.id),
      )

      graphStore.nodes = [
        ...newNodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            color: node.color || 'gray',
            type: node.type || null,
            info: node.info || null,
            bibl: Array.isArray(node.bibl) ? node.bibl : [],
            imageWidth: node.imageWidth || '100%',
            imageHeight: node.imageHeight || '100%',
            visible: node.visible !== false, // Ensure the visible field is respected
          },
          position: node.position || { x: 0, y: 0 }, // Preserve original position
        })),
        ...existingActionTxtNodes, // Add preserved action_txt nodes
      ]

      graphStore.edges = graphData.edges.map((edge) => ({
        data: {
          source: edge.source,
          target: edge.target,
          label: edge.label || null,
          type: edge.type || null,
          info: edge.info || null,
        },
      }))

      // Update Cytoscape instance
      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])

        // Ensure node positions are preserved
        cyInstance.value.nodes().forEach((node) => {
          const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
          if (storedNode?.position) {
            node.position(storedNode.position)
          }
        })

        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }

      graphJson.value = JSON.stringify(
        {
          nodes: graphStore.nodes.map((node) => ({
            ...node.data,
            position: node.position, // Include position in JSON
          })),
          edges: graphStore.edges.map((edge) => ({
            ...edge.data,
            type: edge.type || null,
            info: edge.info || null,
          })),
        },
        null,
        2,
      )

      graphStore.setCurrentVersion(version)
    } else {
      console.error('Failed to load graph version:', response.statusText)
    }
  } catch (error) {
    console.error('Error loading graph version:', error)
  }
}

// Handle history keyboard navigation
const handleHistoryKeydown = (event) => {
  if (graphHistory.value.length === 0) return

  if (event.key === 'ArrowDown') {
    selectedHistoryIndex.value = (selectedHistoryIndex.value + 1) % graphHistory.value.length
    ensureHistoryItemVisible(selectedHistoryIndex.value)
    selectHistoryVersion(selectedHistoryIndex.value)
    event.preventDefault()
  } else if (event.key === 'ArrowUp') {
    selectedHistoryIndex.value =
      (selectedHistoryIndex.value - 1 + graphHistory.value.length) % graphHistory.value.length
    ensureHistoryItemVisible(selectedHistoryIndex.value)
    selectHistoryVersion(selectedHistoryIndex.value)
    event.preventDefault()
  } else if (event.key === 'Enter') {
    if (selectedHistoryIndex.value >= 0) {
      selectHistoryVersion(selectedHistoryIndex.value)
    }
  }
}

// Ensure history item is visible
const ensureHistoryItemVisible = (index) => {
  const historyList = document.getElementById('historyList')
  const items = historyList?.getElementsByClassName('list-group-item')
  if (items && items[index]) {
    items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// Select history version
const selectHistoryVersion = (index) => {
  const selectedVersion = graphHistory.value[index]
  if (selectedVersion) {
    selectedElement.value = null
    loadGraphVersion(selectedVersion.version)
  }
}

// Handle history item click
const onHistoryItemClick = (index) => {
  selectedHistoryIndex.value = index
  selectHistoryVersion(index)
}

// Align selected nodes
const alignSelectedNodes = (alignmentType) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$(':selected')
  if (selectedNodes.length === 0) {
    alert('No nodes selected for alignment.')
    return
  }

  if (alignmentType === 'horizontal') {
    const avgY =
      selectedNodes.reduce((sum, node) => sum + node.position('y'), 0) / selectedNodes.length
    selectedNodes.forEach((node) => {
      node.position({ x: node.position('x'), y: avgY })
    })
  } else if (alignmentType === 'vertical') {
    const avgX =
      selectedNodes.reduce((sum, node) => sum + node.position('x'), 0) / selectedNodes.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: node.position('y') })
    })
  } else if (alignmentType === 'center') {
    const avgX =
      selectedNodes.reduce((sum, node) => sum + node.position('x'), 0) / selectedNodes.length
    const avgY =
      selectedNodes.reduce((sum, node) => sum + node.position('y'), 0) / selectedNodes.length
    selectedNodes.forEach((node) => {
      node.position({ x: avgX, y: avgY })
    })
  }

  cyInstance.value.fit()
}

const spreadSelectedNodes = (axis) => {
  if (!cyInstance.value) return

  const selectedNodes = cyInstance.value.$(':selected')
  if (selectedNodes.length === 0) {
    alert('No nodes selected for spreading.')
    return
  }

  const sortedNodes = selectedNodes.sort((a, b) =>
    axis === 'horizontal' ? a.position('x') - b.position('x') : a.position('y') - b.position('y'),
  )

  const minPosition = sortedNodes[0].position(axis === 'horizontal' ? 'x' : 'y')
  const maxPosition = sortedNodes[sortedNodes.length - 1].position(
    axis === 'horizontal' ? 'x' : 'y',
  )
  const spacing = (maxPosition - minPosition) / (sortedNodes.length - 1)

  sortedNodes.forEach((node, index) => {
    const newPosition = minPosition + index * spacing
    if (axis === 'horizontal') {
      node.position({ x: newPosition, y: node.position('y') })
    } else {
      node.position({ x: node.position('x'), y: newPosition })
    }
  })

  cyInstance.value.fit()
}

// Undo action
const undoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.undo()
    updateStoreFromCytoscape()
  }
}

// Redo action
const redoAction = () => {
  if (undoRedoInstance.value) {
    undoRedoInstance.value.redo()
    updateStoreFromCytoscape()
  }
}

// Update store from Cytoscape
const updateStoreFromCytoscape = () => {
  if (!cyInstance.value) return

  graphStore.nodes = cyInstance.value.nodes().map((node) => ({
    data: node.data(),
    position: node.position(),
  }))
  graphStore.edges = cyInstance.value.edges().map((edge) => ({
    data: edge.data(),
  }))
}

// Track changes in Cytoscape and push to undo stack
const trackChanges = () => {
  if (!cyInstance.value || !undoRedoInstance.value) return

  cyInstance.value.on('add', 'node', (event) => {
    const node = event.target
    undoRedoInstance.value.action(
      'addNode',
      () => {
        cyInstance.value.add(node)
        updateStoreFromCytoscape()
      },
      () => {
        cyInstance.value.$id(node.data('id')).remove()
        updateStoreFromCytoscape()
      },
    )
  })

  cyInstance.value.on('add', 'edge', (event) => {
    const edge = event.target
    undoRedoInstance.value.action(
      'addEdge',
      () => {
        cyInstance.value.add(edge)
        updateStoreFromCytoscape()
      },
      () => {
        cyInstance.value.$id(edge.data('id')).remove()
        updateStoreFromCytoscape()
      },
    )
  })

  cyInstance.value.on('remove', 'node', (event) => {
    const node = event.target
    undoRedoInstance.value.action(
      'removeNode',
      () => {
        cyInstance.value.$id(node.data('id')).remove()
        updateStoreFromCytoscape()
      },
      () => {
        cyInstance.value.add(node)
        updateStoreFromCytoscape()
      },
    )
  })

  cyInstance.value.on('remove', 'edge', (event) => {
    const edge = event.target
    undoRedoInstance.value.action(
      'removeEdge',
      () => {
        cyInstance.value.$id(edge.data('id')).remove()
        updateStoreFromCytoscape()
      },
      () => {
        cyInstance.value.add(edge)
        updateStoreFromCytoscape()
      },
    )
  })

  cyInstance.value.on('dragfree', 'node', (event) => {
    const node = event.target
    const previousPosition = { ...node.position() }
    undoRedoInstance.value.action(
      'moveNode',
      () => {
        node.position(node.position())
        updateStoreFromCytoscape()
      },
      () => {
        node.position(previousPosition)
        updateStoreFromCytoscape()
      },
    )
  })
}

// Initialize Cytoscape
onMounted(() => {
  console.log('Component mounted. Initializing Cytoscape...')
  const cyContainer = document.getElementById('cy')
  if (!cyContainer) {
    console.error('Cytoscape container #cy not found!')
    return
  }
  //NodeTypes
  try {
    cyInstance.value = cytoscape({
      container: cyContainer,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            display: 'element', // Override display to ensure visibility
            label: (ele) =>
              ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
            'background-color': (ele) => ele.data('color') || '#ccc',
            color: '#000',
            'text-valign': 'center',
            'text-halign': 'center',
          },
        },
        {
          selector: 'node[type="action_test"]',
          style: {
            shape: 'rectangle',
            'background-color': '#ffcc00',
            'border-width': 1,
            'border-color': '#000',
            label: (ele) => `${ele.data('label')}`, // Assumes label is stored in node data
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            width: 300,
            height: 300,
          },
        },
        {
          selector: 'node[type="worknote"]',
          style: {
            shape: 'rectangle',
            'background-color': 'yellow', // Bright color for post-it effect
            'border-width': 2,
            'border-color': '#333',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`, // Assumes label is stored in node data
            'text-wrap': 'wrap',
            'text-max-width': '734px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            width: '794px',
            height: '1122pt' /* A4 height in pixels */,
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
            'z-index': -1, // Set z-index to a lower value to ensure it is behind other nodes
            label: '',
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
            'curve-style': 'unbundled-bezier', // Use unbundled-bezier for more control
            'control-point-distances': [50, -50], // Adjusts the curve's offset from the straight line
            'control-point-weights': [0.3, 0.7], // Positions control points along the edge
            'edge-distances': 'intersection', // Ensures curves respect node boundaries
          },
        },
        //add a selector for fulltext page that will be used to show a full text in a html page text aling left

        {
          selector: '.highlighted',
          style: {
            'border-width': 4,
            'border-color': 'yellow',
          },
        },
        {
          selector: 'node[type="quote"]',
          style: {
            shape: 'round-rectangle',
            'background-color': (ele) => ele.data('color') || '#f9f9f9',
            'border-width': 0,
            'border-color': '#ccc',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
            'text-wrap': 'wrap',
            'text-max-width': '250px',
            'text-valign': 'center',
            'text-halign': 'right',
            'font-size': '16px',
            padding: '10px',
            width: '280px',
            height: (ele) => (ele.data('info') ? 100 + ele.data('info').length / 10 : 100),
          },
        },
        {
          selector: 'node[type="quote-line"]',
          style: {
            shape: 'rectangle',
            'background-color': (ele) => ele.data('color') || '#666',
            width: 5,
            height: '100%',
            'border-width': 0,
            'text-opacity': 0,
          },
        },
        {
          selector: 'node[type="notes"]',
          style: {
            shape: 'round-rectangle',
            'background-color': (ele) => ele.data('color') || '#f9f9f9',
            'border-width': 1,
            'border-color': '#ccc',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
            'text-wrap': 'wrap',
            'text-max-width': '250px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '16px',
            padding: '20px',
            width: '800px',
            height: (ele) => {
              const lineHeight = 30 // Approximate line height in pixels
              const padding = 20 // Total vertical padding (10px top + 10px bottom)
              const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
              const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
              const totalLines = labelLines + infoLines + 2 // +2 for the double newline
              return Math.max(100, totalLines * lineHeight + padding) // Ensure minimum height of 100px
            },
          },
        },
        // In GraphAdmin.vue, within the cytoscape style array
        {
          selector: 'node[type="worknote"]',
          style: {
            shape: 'rectangle',
            'background-color': '#FFD580', // Light orange background
            'border-width': 2,
            'border-color': '#333',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info') || ''}`, // Display label and info
            'text-wrap': 'wrap',
            'text-max-width': '734px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            'font-weight': 'bold', // Bold font
            width: '794px',
            height: (ele) => {
              const lineHeight = 30 // Approximate line height in pixels
              const padding = 20 // Total vertical padding (10px top + 10px bottom)
              const labelLines = ele.data('label') ? ele.data('label').split('\n').length : 1
              const infoLines = ele.data('info') ? ele.data('info').split('\n').length : 0
              const totalLines = labelLines + infoLines + 2 // +2 for the double newline
              return Math.max(100, totalLines * lineHeight + padding) // Ensure minimum height of 100px
            },
          },
        },

        {
          selector: 'node[type="fulltext"]',
          style: {
            shape: 'round-rectangle',
            'background-color': (ele) => ele.data('color') || '#ede8e8',
            'border-width': 1,
            'border-color': '#ccc',
            label: (ele) => `${ele.data('label')}\n\n${ele.data('info')}`,
            'text-wrap': 'wrap',
            'text-max-width': '734px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '16px',

            padding: '10px',
            width: '794px',
            height: '1122pt' /* A4 height in pixels */,
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
          selector: 'node[type="openai"]',
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
          selector: 'node[type="REG"]',
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
            'background-color': '#FF0000', // YouTube red
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
            height: '112px', // 16:9 aspect ratio for video thumbnail
          },
        },

        {
          selector: 'node[type="action_txt"]',
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
          selector: 'node[type="action_openai"]',
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
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': 'blue',
            'background-color': 'lightblue',
          },
        },
      ],
      layout: {
        name: 'preset',
      },
      boxSelectionEnabled: true,
    })

    // Initialize undo-redo instance
    undoRedoInstance.value = cyInstance.value.undoRedo()

    // Event listener for node clicks
    cyInstance.value.on('tap', 'node', async (event) => {
      const node = event.target
      const data = node.data()

      // Handle action_test node
      if (data.type === 'action_test') {
        if (!data.label || !data.info) {
          alert('Node must have a valid endpoint URL in label and text in info.')
          return
        }
        const result = await testEndpoint(data.label, data.info)
        if (result) {
          console.log('Endpoint test successful: ' + JSON.stringify(result))

          if (validateNode(result)) {
            const NewNode = {
              data: result,
              position: { x: node.position('x') + 100, y: node.position('y') + 100 },
            }
            graphStore.nodes.push(NewNode)
            cyInstance.value.add(NewNode)
            cyInstance.value.layout({ name: 'preset' }).run()
            graphJson.value = JSON.stringify(
              {
                nodes: graphStore.nodes.map((n) => n.data),
                edges: graphStore.edges.map((e) => e.data),
              },
              null,
              2,
            )

            console.log('Node added successfully.')

            // Update JSON editor
            graphJson.value = JSON.stringify(
              {
                nodes: graphStore.nodes.map((n) => n.data),
                edges: graphStore.edges.map((e) => e.data),
              },
              null,
              2,
            )
          } else {
            alert('Endpoint test failed.')
          }
        }
        return
      }

      // Check if the node type is "action"
      if (data.type === 'action_txt') {
        // Retrieve edges connected to the current node
        const connectedEdges = cyInstance.value.edges().filter((edge) => {
          return edge.data('source') === node.id() || edge.data('target') === node.id()
        })

        console.log('Connected edges:', connectedEdges.length)

        if (connectedEdges.length > 0) {
          const connectedNodeId =
            connectedEdges[0].data('source') === node.id()
              ? connectedEdges[0].data('target')
              : connectedEdges[0].data('source')
          const connectedNode = cyInstance.value.getElementById(connectedNodeId)

          if (connectedNode && connectedNode.data('label')) {
            console.log('Connected to node:', connectedNode.data('label'))
            const content = connectedNode.data('info') || ''
            console.log('Content:', content)

            //ask the ser if he want to summarize the content
            const userConfirmed = confirm(
              'Do you want to summarize the content of the connected node?',
            )

            //If the user confirms yes call the summarize endpoint
            if (userConfirmed) {
              const summaryData = await summarizeContent(content)
              if (summaryData) {
                console.log('Summary:', summaryData)
                if (validateNode(summaryData)) {
                  const summaryNode = {
                    data: summaryData,
                    position: { x: node.position('x') + 100, y: node.position('y') + 100 },
                  }

                  graphStore.nodes.push(summaryNode)
                  cyInstance.value.add(summaryNode)

                  // Add an edge between the fulltext node and the summary node
                  const summaryEdge = {
                    data: {
                      id: `edge_${connectedNode.id()}_${summaryNode.data.id}`,
                      source: connectedNode.id(),
                      target: summaryNode.data.id,
                    },
                  }

                  graphStore.edges.push(summaryEdge)
                  cyInstance.value.add(summaryEdge)

                  cyInstance.value.layout({ name: 'preset' }).run()

                  // Update JSON editor
                  graphJson.value = JSON.stringify(
                    {
                      nodes: graphStore.nodes.map((n) => n.data),
                      edges: graphStore.edges.map((e) => e.data),
                    },
                    null,
                    2,
                  )
                } else {
                  console.error('Invalid summary node. It was not added to the graph.')
                }
              }
            }
            // If the user confirms no, do nothing
            else {
              console.log('User chose not to summarize the content.')
            }
          } else {
            console.warn('Connected node not found or has no label.')
          }

          return
        }

        // File upload dialog for "action" nodes
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.txt,.md'
        fileInput.onchange = async (event) => {
          const file = event.target.files[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = async (e) => {
              const content = new TextDecoder('windows-1252').decode(e.target.result)

              // Generate a unique hash for the node ID
              const hashBuffer = await crypto.subtle.digest(
                'SHA-256',
                new TextEncoder().encode(content),
              )
              const hashArray = Array.from(new Uint8Array(hashBuffer))
              const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
              const newNodeId = `${file.name}_${hash}`

              const existingNode = cyInstance.value.getElementById(newNodeId)
              if (existingNode.length > 0) {
                alert('Node with this content already exists.')
                return
              }

              // Create a new node
              const newNode = {
                data: {
                  id: newNodeId,
                  label: '/images/openai.svg',
                  type: 'fulltext',
                  info: content,
                  color: '#f9f9f9',
                  imageWidth: 250,
                  imageHeight: 250,
                },
                position: { x: node.position('x') + 500, y: node.position('y') + 500 },
              }
              graphStore.nodes.push(newNode)
              cyInstance.value.add(newNode)
              cyInstance.value.layout({ name: 'preset' }).run()
            }
            reader.readAsArrayBuffer(file)
          } else {
            console.error('No file selected')
          }
        }
        fileInput.click()
      } else if (data.type === 'action_img') {
        // Handle image upload
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = 'image/*'
        fileInput.onchange = async (event) => {
          const file = event.target.files[0]
          if (file) {
            const formData = new FormData()
            formData.append('file', file)

            try {
              const response = await fetch('https://api.vegvisr.org/upload', {
                method: 'POST',
                body: formData,
              })

              if (response.ok) {
                const result = await response.json()
                const imageUrl = result.url

                // Create a new node with the uploaded image
                const newNode = {
                  data: {
                    id: `${data.id}_img`,
                    label: imageUrl,
                    type: 'background',
                    color: '#f9f9f9',
                    imageWidth: 250,
                    imageHeight: 250,
                  },
                  position: { x: node.position('x') + 100, y: node.position('y') + 100 },
                }
                graphStore.nodes.push(newNode)
                cyInstance.value.add(newNode)
              } else {
                console.error('Image upload failed')
              }
            } catch (error) {
              console.error('Error uploading image:', error)
            }
          }
        }
        fileInput.click()
      }

      selectedElement.value = {
        label: data.label || `${data.source} → ${data.target}`,
        info: data.info || null,
        bibl: Array.isArray(data.bibl) ? data.bibl : [],
      }
    }) // <-- Add this closing brace to fix the syntax error

    cyInstance.value.on('tap', 'node, edge', (event) => {
      const element = event.target
      const data = element.data()
      selectedElement.value = {
        label: data.label || `${data.source} → ${data.target}`,
        info: data.info || null,
        bibl: Array.isArray(data.bibl) ? data.bibl : [],
      }
    })

    cyInstance.value.on('select', 'node', (event) => {
      const node = event.target
      node.addClass('selected')
    })

    cyInstance.value.on('unselect', 'node', (event) => {
      const node = event.target
      node.removeClass('selected')
    })

    if (graphStore.currentGraphId) {
      selectedGraphId.value = graphStore.currentGraphId
      loadSelectedGraph()
    } else {
      initializeStandardGraph()
    }

    fetchKnowledgeGraphs()
    fetchGraphHistory()
  } catch (error) {
    console.error('Error initializing Cytoscape:', error)
  }

  trackChanges()
})

// Function to handle clicks on action nodes
// const handleActionNodeClick = (nodeData) => {
//   console.log('Action node clicked:', nodeData)

//   if (nodeData.type === 'action_txt') {
//     // Handle text file upload
//     const fileInput = document.createElement('input')
//     fileInput.type = 'file'
//     fileInput.accept = '.txt,.md'
//     fileInput.onchange = (event) => {
//       const file = event.target.files[0]
//       if (file) {
//         const reader = new FileReader()
//         reader.onload = (e) => {
//           const content = e.target.result

//           // Create a new node with the uploaded text
//           const newNode = {
//             data: {
//               id: `${nodeData.id}_txt`,
//               label: 'Uploaded Text',
//               type: 'info',
//               info: content,
//               color: '#f9f9f9',
//             },
//             position: { x: nodeData.position.x + 100, y: nodeData.position.y + 100 },
//           }
//           graphStore.nodes.push(newNode)
//           cyInstance.value.add(newNode)
//         }
//         reader.readAsText(file)
//       }
//     }
//     fileInput.click()
//   } else if (nodeData.type === 'action_img') {
//     // Handle image upload
//     const fileInput = document.createElement('input')
//     fileInput.type = 'file'
//     fileInput.accept = 'image/*'
//     fileInput.onchange = async (event) => {
//       const file = event.target.files[0]
//       if (file) {
//         const formData = new FormData()
//         formData.append('file', file)

//         try {
//           const response = await fetch('https://api.vegvisr.org/upload', {
//             method: 'POST',
//             body: formData,
//           })

//           if (response.ok) {
//             const result = await response.json()
//             const imageUrl = result.url

//             // Create a new node with the uploaded image
//             const newNode = {
//               data: {
//                 id: `${nodeData.id}_img`,
//                 label: imageUrl,
//                 type: 'background',
//                 color: '#f9f9f9',
//                 imageWidth: 250,
//                 imageHeight: 250,
//               },
//               position: { x: nodeData.position.x + 100, y: nodeData.position.y + 100 },
//             }
//             graphStore.nodes.push(newNode)
//             cyInstance.value.add(newNode)
//           } else {
//             console.error('Image upload failed')
//           }
//         } catch (error) {
//           console.error('Error uploading image:', error)
//         }
//       }
//     }
//     fileInput.click()
//   } else {
//     alert('Unknown action type')
//   }
// }

watch(
  () => [graphStore.nodes, graphStore.edges],
  () => {
    graphJson.value = JSON.stringify(
      {
        nodes: graphStore.nodes.map((node) => ({
          ...node.data,
          visible: node.data.visible !== false, // Ensure visible field is included
          imageWidth: node.data.imageWidth || null,
          imageHeight: node.data.imageHeight || null,
        })),
        edges: graphStore.edges.map((edge) => ({
          ...edge.data,
          type: edge.type !== undefined ? edge.data.type : null,
          info: edge.info !== undefined ? edge.data.info : null,
        })),
      },
      null,
      2,
    )
  },
  { deep: true },
)

// Watch JSON changes to update search output
watch(graphJson, () => {
  debouncedSearchJson()
})

// Watch search query and case sensitivity
watch([jsonSearchQuery, caseSensitive], () => {
  debouncedSearchJson()
})

const toggleNodeVisibility = (nodeId) => {
  const node = graphStore.nodes.find((n) => n.data.id === nodeId)
  if (node) {
    node.data.visible = !node.data.visible
    if (cyInstance.value) {
      const cyNode = cyInstance.value.getElementById(nodeId)
      if (cyNode) {
        cyNode.style('display', node.data.visible ? 'element' : 'none')
      }
    }
  }
}

const updateNodeVisibility = async (nodeId, isVisible) => {
  const node = graphStore.nodes.find((n) => n.data.id === nodeId)
  if (node) {
    node.data.visible = isVisible

    // Update the graph view
    if (cyInstance.value) {
      const cyNode = cyInstance.value.getElementById(nodeId)
      if (cyNode) {
        cyNode.style('display', isVisible ? 'element' : 'none')
      }
    }

    // Update the database
    try {
      const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: graphStore.currentGraphId,
          graphData: {
            nodes: graphStore.nodes.map((node) => node.data),
            edges: graphStore.edges.map((edge) => edge.data),
          },
        }),
      })

      if (!response.ok) {
        console.error('Failed to update the database.')
      }
    } catch (error) {
      console.error('Error updating the database:', error)
    }
  }
}

const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuOptions = ref([]) // Ensure contextMenuOptions is defined as a reactive variable

// Show context menu on right-click
// In GraphAdmin.vue <script setup>, update showContextMenu
const showContextMenu = (event, node = null) => {
  event.preventDefault()
  const cyContainer = document.getElementById('cy')
  const containerRect = cyContainer.getBoundingClientRect()

  // Use node position if provided, else use mouse position
  const position = node
    ? node.renderedPosition()
    : {
        x: event.originalEvent.clientX - containerRect.left,
        y: event.originalEvent.clientY - containerRect.top,
      }

  contextMenuPosition.value = {
    x: containerRect.left + position.x - 100,
    y: containerRect.top + position.y + 100,
  }
  contextMenuVisible.value = true

  // Set selectedElement for node if provided
  if (node) {
    selectedElement.value = {
      label: node.data('label'),
      info: node.data('info') || null,
      bibl: node.data('bibl') || [],
    }
  }

  // Get all selected nodes
  const selectedNodes = cyInstance.value.$(':selected')
  const nodeData =
    selectedNodes.length > 0
      ? selectedNodes.map((node) => ({
          label: node.data('label') || '',
          info: node.data('info') || '',
        }))
      : node
        ? [{ label: node.data('label') || '', info: node.data('info') || '' }]
        : []

  // Populate contextMenuOptions dynamically
  contextMenuOptions.value =
    nodeData.length > 0
      ? [
          { label: 'Add as Template', action: () => addTemplateFromNode(node?.data()) },
          { label: 'Delete Node', action: () => deleteNode(node) },
          {
            label: 'Save Work Note',
            action: () => {
              if (node) {
                saveWorkNote(node.data('label'), node.data('info'))
              } else {
                alert('No node selected. Please select a node to save as a work note.')
              }
              hideContextMenu()
            },
          },
        ]
      : [
          {
            label: 'Save Work Note',
            action: () => {
              alert('No nodes selected. Please select one or more nodes.')
              hideContextMenu()
            },
          },
        ]
}

// Hide context menu (unchanged)
const hideContextMenu = () => {
  contextMenuVisible.value = false
}

// In onMounted, update the right-click handlers
onMounted(() => {
  if (cyInstance.value) {
    // Right-click on node
    cyInstance.value.on('cxttap', 'node', (event) => {
      showContextMenu(event.originalEvent, event.target)
    })
    // Right-click on canvas
    cyInstance.value.on('cxttap', (event) => {
      if (!event.target.data()) {
        // Ensure no node is clicked
        showContextMenu(event.originalEvent)
      }
    })
  }

  document.addEventListener('click', hideContextMenu)
})

// Cleanup event listener
onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

const addTemplateFromNode = async (node) => {
  const templateName = prompt('Enter a name for the template:')
  if (!templateName) return

  try {
    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName, node }),
    })

    if (response.ok) {
      const result = await response.json()
      alert(result.message)
    } else {
      const error = await response.json()
      alert(`Error: ${error.error}`)
    }
  } catch (error) {
    console.error('Error adding template:', error)
    alert('An error occurred while adding the template.')
  }
}

// Example function for deleting a node
const deleteNode = (node) => {
  if (cyInstance.value) {
    cyInstance.value.remove(node)
    graphStore.nodes = graphStore.nodes.filter((n) => n.data.id !== node.data('id'))
  }
  hideContextMenu()
}

// Function to parse markdown image syntax
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

// Example usage
const markdown =
  '![Header|width:100%;height:250px;object-fit: cover;object-position: center](https://images.pexels.com/photos/3822236/pexels-photo-3822236.jpeg)'
const parsed = parseMarkdownImage(markdown)

if (parsed) {
  const newNode = {
    data: {
      id: 'markdownImageNode',
      type: 'markdown-image',
      label: markdown,
      imageUrl: parsed.url,
      styles: parsed.styles,
    },
    position: { x: 100, y: 100 },
  }

  graphStore.nodes.push(newNode)
  if (cyInstance.value) {
    cyInstance.value.add(newNode)
    cyInstance.value.layout({ name: 'preset' }).run()
  }
}

const summarizeContent = async (content) => {
  try {
    const response = await fetch('https://api.vegvisr.org/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    })

    if (!response.ok) {
      console.error('Failed to summarize content:', response.statusText)
      return null
    }

    const summaryData = await response.json()
    return summaryData
  } catch (error) {
    console.error('Error summarizing content:', error)
    return null
  }
}

const validateNode = (node) => {
  if (!node.id || typeof node.id !== 'string') {
    console.error('Invalid node ID')
    return false
  }
  if (!node.label || typeof node.label !== 'string') {
    console.error('Invalid node label')
    return false
  }
  if (!node.type || node.type !== 'fulltext') {
    console.error('Invalid or missing node type')
    return false
  }
  if (!node.info || typeof node.info !== 'string') {
    console.error('Invalid or missing node info')
    return false
  }
  if (!node.color || typeof node.color !== 'string') {
    console.error('Invalid or missing node color')
    return false
  }
  return true
}

const updateGraphMetadata = (updatedMetadata) => {
  graphStore.graphMetadata = { ...graphStore.graphMetadata, ...updatedMetadata }
}

defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const saveWorkNote = async (label, info) => {
  if (!graphStore.currentGraphId) {
    alert('No graph ID is set. Please save the graph first.')
    return
  }

  const noteName = prompt('Enter a name for the work note:')
  if (!noteName) {
    alert('Work note name is required.')
    return
  }

  try {
    console.log('Saving work note:', { label, info, noteName }) // Debug log
    const response = await fetch('https://knowledge.vegvisr.org/saveToGraphWorkNotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: graphStore.currentGraphId,
        note: `Label: ${label}\nInfo: ${info || 'None'}`,
        name: noteName,
      }),
    })

    if (response.ok) {
      alert('Work note saved successfully!')
    } else {
      const error = await response.json()
      console.error('Failed to save the work note:', error)
      alert('Failed to save the work note.')
    }
  } catch (error) {
    console.error('Error saving the work note:', error)
    alert('An error occurred while saving the work note.')
  }
}

const addWorkNoteToGraph = (note) => {
  console.log('Adding work note to graph:', note)

  const newNode = {
    data: {
      id: note.id,
      label: note.name,
      info: note.content,
      type: 'worknote',
    },
    position: { x: 100, y: 100 }, // Default position
  }

  // Add the node to the graph view
  graphStore.nodes.push(newNode)
  if (cyInstance.value) {
    cyInstance.value.add(newNode)
    cyInstance.value.layout({ name: 'preset' }).run()
  }

  // Update the JSON editor
  graphJson.value = JSON.stringify(
    {
      nodes: graphStore.nodes.map((node) => node.data),
      edges: graphStore.edges.map((edge) => edge.data),
    },
    null,
    2,
  )
}
</script>

<style scoped>
.admin-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.top-bar {
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  overflow: auto;
  transition:
    margin-left 0.3s,
    width 0.3s;
}

.main-content.sidebar-collapsed {
  margin-left: 0;
  width: 100%;
}

.sidebar {
  transition: width 0.3s;
  width: 25%;
  overflow-y: auto;
  padding: 20px;
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}

.main-panel {
  height: 100%;
  overflow: auto;
  transition:
    margin-left 0.3s,
    width 0.3s;
  display: flex; /* Add for vertical stacking */
  flex-direction: column; /* Stack children vertically */
  gap: 20px; /* Space between col-12 sections */
}

.main-panel.expanded {
  margin-left: 0;
  width: 100%;
}

.control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.graph-editor-container {
  position: relative;
  height: 600px; /* Already set, but confirming */
  margin-top: 20px;
  margin-bottom: 0; /* No need for bottom margin since we control spacing in main-panel */
}

.graph-editor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cy-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 1; /* Add this to fix overlap */
}

.top-bar {
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.main-content {
  flex: 1;
  overflow: auto;
  transition:
    margin-left 0.3s,
    width 0.3s;
}

.main-content.sidebar-collapsed {
  margin-left: 0;
  width: 100%;
}

.sidebar {
  transition: width 0.3s;
  width: 25%;
  overflow-y: auto;
  padding: 20px;
}

.col-12 {
  padding-bottom: 20px; /* Add space between sections */
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}

.main-panel {
  height: 100%;
  overflow: auto;
  transition:
    margin-left 0.3s,
    width 0.3s;
}

.main-panel.expanded {
  margin-left: 0;
  width: 100%;
}

.control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.graph-title {
  text-align: center;
  margin-bottom: 20px;
}

.info-section {
  background: #f8f9fa;
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.form-section {
  background: transparent;
}

.nav-tabs .nav-link {
  border-radius: 0;
}

.nav-tabs .nav-link.active {
  background: #fff;
  border-bottom: 2px solid #007bff;
}

.btn {
  transition: background-color 0.2s;
}

.list-group-item-action:hover {
  background-color: #e9ecef;
}

.alert {
  border-radius: 8px;
}

.nav .nav-tabs-dark {
  background-color: #343a40;
  border-color: #454d55;
}
.nav-tabs-dark .nav-link {
  color: #adb5bd;
}
.nav-tabs-dark .nav-link.active {
  background-color: #495057;
  color: #fff;
}

/* New styles for JSON search */
#jsonOutput {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 10px;
  font-family: monospace;
  font-size: 14px;
  white-space: pre-wrap;
  max-height: 400px;
  overflow-y: auto;
}

#jsonOutput .match {
  background: yellow;
  padding: 2px;
}

#jsonOutput .match.focused {
  background: orange;
  outline: 2px solid red;
}

.action-buttons {
  margin-bottom: 20px;
  z-index: 0;
}

.graph-content {
  min-height: 600px; /* Ensure minimum height */
  height: auto; /* Allow natural growth */
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    z-index: 1000;
    height: 100%;
    width: 80%;
    left: 0;
    transform: translateX(-100%);
  }

  .sidebar.collapsed {
    transform: translateX(0);
  }

  .main-panel {
    width: 100%;
  }

  .graph-title {
    text-align: center;
    margin-bottom: 10px;
    font-size: 1.5rem;
    color: #333;
  }
}

#jsonOutput {
  max-height: 200px;
  overflow: auto;
  white-space: pre;
  font-family: monospace;
}

#jsonOutput .match {
  background: yellow;
  padding: 2px;
}

#jsonOutput span.match.focused {
  background: orange;
  outline: 2px solid red;
  padding: 2px;
}

#jsonOutput .match.focused {
  background: orange;
  outline: 2px solid #f7f4f4;
  padding: 2px;
}

/* Add styles for the context menu */
.context-menu {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  padding: 10px;
  border-radius: 4px;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 5px 10px;
  cursor: pointer;
}

.context-menu li:hover {
  background: #f0f0f0;
}

/* Add styles for markdown-image nodes */
</style>
