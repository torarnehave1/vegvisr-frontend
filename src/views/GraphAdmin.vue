<template>
  <div class="admin-page" :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }">
    <!-- Top Bar -->
    <div class="top-bar sticky-top bg-light p-3 border-bottom">
      <div class="container-fluid">
        <div class="row align-items-center">
          <!-- Graph Selector -->
          <div class="col-md-4 col-sm-12">
            <label for="graphDropdown" class="form-label"
              ><strong>Select Knowledge Graph:</strong></label
            >
            <select
              id="graphDropdown"
              v-model="selectedGraphId"
              @change="loadSelectedGraph"
              class="form-select"
            >
              <option value="" disabled>Select a graph</option>
              <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
                {{ graph.title }}
              </option>
            </select>
          </div>
          <!-- Current Graph ID -->
          <div class="col-md-4 col-sm-12 text-center">
            <p class="mb-0">
              <strong>Current Graph ID:</strong>
              <span>{{ graphStore.currentGraphId || 'Not saved yet' }}</span>
            </p>
          </div>
          <!-- Validation Errors -->
          <div class="col-md-4 col-sm-12">
            <div v-if="validationErrors.length" class="alert alert-danger mb-0" role="alert">
              <strong>Graph Validation Errors:</strong>
              <ul class="mb-0">
                <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content container-fluid">
      <!-- Success Message -->
      <div class="row">
        <!-- Sidebar (Collapsible) -->
        <div
          class="col-md-3 sidebar bg-light border-end"
          :class="{
            collapsed: sidebarCollapsed,
            'bg-dark': theme === 'dark',
            'text-white': theme === 'dark',
          }"
        >
          <div v-if="!sidebarCollapsed">
            <!-- Tabs for Form, JSON Editor, and Node Info -->
            <ul class="nav nav-tabs" :class="{ 'nav-tabs-dark': theme === 'dark' }">
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'form', 'text-white': theme === 'dark' }"
                  @click="activeTab = 'form'"
                >
                  New Graph
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'json', 'text-white': theme === 'dark' }"
                  @click="activeTab = 'json'"
                >
                  Version
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'node-info', 'text-white': theme === 'dark' }"
                  @click="activeTab = 'node-info'"
                >
                  Info
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: activeTab === 'templates', 'text-white': theme === 'dark' }"
                  @click="activeTab = 'templates'"
                >
                  Templates
                </button>
              </li>
            </ul>
            <div
              class="tab-content p-3"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
            >
              <!-- Create New Graph Form -->
              <div v-if="activeTab === 'form'" class="form-section">
                <h3>Create New Knowledge Graph</h3>
                <form @submit.prevent="saveGraph">
                  <div class="mb-3">
                    <label for="graphTitle" class="form-label">Title:</label>
                    <input
                      id="graphTitle"
                      v-model="graphStore.graphMetadata.title"
                      type="text"
                      class="form-control"
                      :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                      required
                    />
                  </div>
                  <div class="mb-3">
                    <label for="graphDescription" class="form-label">Description:</label>
                    <textarea
                      id="graphDescription"
                      v-model="graphStore.graphMetadata.description"
                      class="form-control"
                      rows="4"
                      :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                    ></textarea>
                  </div>
                  <div class="mb-3">
                    <label for="graphCreatedBy" class="form-label">Created By:</label>
                    <input
                      id="graphCreatedBy"
                      v-model="graphStore.graphMetadata.createdBy"
                      type="text"
                      class="form-control"
                      :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-primary">Create Knowledge Graph</button>
                </form>
              </div>
              <!-- Graph History -->
              <div v-if="activeTab === 'json'" class="form-section">
                <h3>Development Story</h3>
                <div
                  id="historyList"
                  tabindex="0"
                  @keydown="handleHistoryKeydown"
                  class="list-group"
                  :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                  style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
                >
                  <button
                    v-for="(history, index) in graphHistory"
                    :key="index"
                    @click="onHistoryItemClick(index)"
                    :class="[
                      'list-group-item',
                      'list-group-item-action',
                      {
                        active: index === selectedHistoryIndex,
                        'bg-dark': theme === 'dark',
                        'text-white': theme === 'dark',
                      },
                    ]"
                    style="cursor: pointer"
                    :aria-selected="index === selectedHistoryIndex"
                    role="option"
                  >
                    Version {{ history.version }} - {{ history.timestamp }}
                  </button>
                  <p v-if="graphHistory.length === 0" class="list-group-item text-center">
                    No history found for the current graph ID.
                  </p>
                </div>
              </div>
              <!-- Node Info Tab -->
              <div v-if="activeTab === 'node-info'" class="form-section">
                <h3>Node Information</h3>
                <div v-if="selectedElement">
                  <h4>{{ selectedElement.label }}</h4>
                  <textarea
                    v-if="selectedElement.info"
                    readonly
                    class="form-control mb-3"
                    style="height: 150px; font-family: monospace; white-space: pre-wrap"
                    v-model="selectedElement.info"
                    :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                  ></textarea>
                  <p v-else class="text-muted">No additional information available.</p>
                  <!-- Bibliographic References -->
                  <div v-if="selectedElement.bibl && selectedElement.bibl.length" class="mt-3">
                    <h5>Bibliographic References:</h5>
                    <ul class="list-unstyled">
                      <li v-for="(reference, index) in selectedElement.bibl" :key="index">
                        {{ reference }}
                      </li>
                    </ul>
                  </div>
                </div>
                <div v-else>
                  <p class="text-muted">Select a node or connection to see details.</p>
                </div>
              </div>
              <!-- Templates Tab -->
              <div v-if="activeTab === 'templates'" class="form-section">
                <h3>Graph Templates</h3>
                <p>Select a template to quickly create a new graph:</p>
                <ul class="list-group">
                  <li
                    v-for="(template, index) in graphTemplates"
                    :key="index"
                    class="list-group-item"
                    @click="applyTemplate(template)"
                    style="cursor: pointer"
                  >
                    {{ template.name }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Graph Editor -->
        <div class="col-md-9 main-panel">
          <div class="row">
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

            <!-- Graph Editor -->
            <div class="col-12 graph-content">
              <div class="row">
                <h2 class="graph-title text-center">Knowledge Story Graph</h2>
                <div class="col-md-12 graph-editor p-3">
                  <div
                    id="cy"
                    style="width: 100%; height: calc(100vh - 300px); border: 1px solid #ddd"
                  ></div>
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

              <div class="d-flex justify-content-between mb-3">
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import cytoscape from 'cytoscape'
import undoRedo from 'cytoscape-undo-redo'

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
        imageWidth: 'auto',
        imageHeight: 'auto',
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
        imageWidth: 'auto',
        imageHeight: 'auto',
      },
    ],
    edges: [],
  },
  { name: 'Custom Template', nodes: [], edges: [] },
])

// JSON Search refs
const jsonSearchQuery = ref('')
const caseSensitive = ref(false)
const matchCount = ref(0)
const jsonMessage = ref('')
const currentMatchIndex = ref(0)

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
  const newNodes = template.nodes.map((node) => ({
    data: {
      label: node.label,
      color: node.color,
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? node.bibl : [],
    },
  }))
  const newEdges = template.edges.map((edge) => ({
    data: {
      id: edge.id || `${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || null,
      type: edge.type || null,
      info: edge.info || null,
    },
  }))

  graphStore.nodes.unshift(...newNodes)

  if (cyInstance.value) {
    cyInstance.value.add([...newNodes, ...newEdges])
    //refresh the layout without changing the currect position of the nodes
  }
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
        type: node.data.type || null,
        info: node.data.info || null,
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
      label: edge.label ?? null,
      type: edge.type ?? null,
      info: edge.info ?? null,
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
      setTimeout(() => {
        validationMessage.value = ''
        validationMessageClass.value = ''
      }, 2000)
      return
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
          imageWidth: node.imageWidth || null,
          imageHeight: node.imageHeight || null,
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
      cyInstance.value.nodes().forEach((node) => {
        const storedNode = graphStore.nodes.find((n) => n.data.id === node.data('id'))
        if (storedNode?.position) {
          node.position(storedNode.position)
          node.lock()
        }
      })

      cyInstance.value
        .layout({
          name: 'cose',
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
    validationMessage.value = `Invalid JSON: ${error.message}`
    validationMessageClass.value = 'alert-danger'
    setTimeout(() => {
      validationMessage.value = ''
      validationMessageClass.value = ''
    }, 2000)
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
          imageWidth: node.imageWidth || null,
          imageHeight: node.imageHeight || null,
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

      graphStore.nodes = graphData.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color || 'gray',
          type: node.type || null,
          info: node.info || null,
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || 'auto',
          imageHeight: node.imageHeight || 'auto',
        },
        position: node.position || { x: 0, y: 0 },
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

      graphJson.value = JSON.stringify(
        {
          nodes: graphStore.nodes.map((node) => ({
            ...node.data,
            position: node.position,
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

      if (cyInstance.value) {
        cyInstance.value.elements().remove()
        cyInstance.value.add([...graphStore.nodes, ...graphStore.edges])
        cyInstance.value.layout({ name: 'preset' }).run()
        cyInstance.value.fit()
      }

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

  try {
    cyInstance.value = cytoscape({
      container: cyContainer,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            label: (ele) =>
              ele.data('type') === 'info' ? ele.data('label') + ' ℹ️' : ele.data('label') || '',
            'background-color': (ele) => ele.data('color') || '#ccc',
            color: '#000',
            'text-valign': 'center',
            'text-halign': 'center',
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
            'curve-style': 'bezier',
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
            padding: '10px',
            width: '280px',
            height: (ele) => (ele.data('info') ? 100 + ele.data('info').length / 10 : 100),
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
            'text-max-height': '1122px',
            padding: '10px',
            width: '794px',
            height: '1122px' /* A4 height in pixels */,
            overflow: 'hidden' /* Set overflow to hidden */,
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
            width: (ele) => ele.data('imageWidth'),
            height: (ele) => ele.data('imageHeight'),
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
            width: (ele) => ele.data('imageWidth'),
            height: (ele) => ele.data('imageHeight'),
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
            width: (ele) => ele.data('imageWidth'),
            height: (ele) => ele.data('imageHeight'),
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
          selector: 'node[type="action"]',
          style: {
            shape: 'rectangle',
            'background-color': (ele) => ele.data('color') || '#f9f9f9',

            'border-width': 5,
            'border-color': '#ccc',

            label: (ele) =>
              ele.data('type') === 'action' ? ele.data('label') + '⚠️' : ele.data('label') || '',
            'text-wrap': 'wrap',
            'text-max-width': '250px',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '16px',
            padding: '10px',
            width: '250px',
            height: (ele) => (ele.data('info') ? 100 + ele.data('info').length / 10 : 100),
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
      wheelSensitivity: 0.2,
    })

    // Initialize undo-redo instance
    undoRedoInstance.value = cyInstance.value.undoRedo()

    // Event listener for node clicks
    cyInstance.value.on('tap', 'node', (event) => {
      const node = event.target
      const data = node.data()

      // Check if the node type is "action"
      if (data.type === 'action') {
        handleActionNodeClick(data)

        // File upload dialog for "action" nodes
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = '.txt,.md'
        fileInput.onchange = (event) => {
          const file = event.target.files[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const content = new TextDecoder('windows-1252').decode(e.target.result)

              //Duplictae node
              const newNode = {
                data: {
                  id: `${data.id}_copy`,
                  label: '/images/openai.svg',
                  type: 'openai',
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
      }

      selectedElement.value = {
        label: data.label || `${data.source} → ${data.target}`,
        info: data.info || null,
        bibl: Array.isArray(data.bibl) ? data.bibl : [],
      }
    })

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
const handleActionNodeClick = (nodeData) => {
  console.log('Action node clicked:', nodeData)
  // Add your custom logic here
  alert(`Action node clicked: ${nodeData.label}`)
}

// Watch graph changes
watch(
  () => [graphStore.nodes, graphStore.edges],
  () => {
    graphJson.value = JSON.stringify(
      {
        nodes: graphStore.nodes.map((node) => ({
          ...node.data,
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

defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})
</script>

<style scoped>
/* Existing styles */
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
  overflow: auto;
}

.main-panel {
  height: 100%;
  overflow: auto;
}

.control-panel {
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.graph-editor {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.info-section {
  background: #f8f9fa;
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(100vh - 300px);
}

.graph-content {
  height: calc(100vh - 200px);
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

.nav-tabs-dark {
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
</style>
