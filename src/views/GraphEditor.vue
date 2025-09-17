<template>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-8" style="height: 100vh">
        <!-- Action buttons positioned at the top -->
        <div class="graph-editor-toolbar" style="position: absolute; z-index: 10; margin: 10px; display: flex; gap: 10px;">
          <button @click="toggleInfoOnly" class="btn btn-outline-secondary">
            {{ infoOnly ? 'Show All' : 'Show Info Only' }}
          </button>
          <!-- Always visible test button -->
          <button
            @click="showTranscriptProcessor = true"
            class="btn btn-warning"
            title="Test - Always visible"
          >
            🧪 Test Modal
          </button>
          <button
            v-if="userStore.loggedIn"
            @click="showTranscriptProcessor = true"
            class="btn btn-success"
            title="Process YouTube videos or transcripts into knowledge graphs"
          >
            🎙️ Process Transcript
          </button>
          <!-- Debug info -->
          <div style="position: absolute; top: 50px; left: 10px; background: yellow; padding: 5px; font-size: 12px; z-index: 1000;">
            Debug: userStore.loggedIn = {{ userStore.loggedIn }}, userStore.role = {{ userStore.role }}
          </div>
        </div>
        <div id="cy" style="width: 100%; height: 100%"></div>
      </div>
      <div
        class="col-md-4"
        style="height: 100vh; overflow-y: auto; padding: 20px; border-left: 1px solid #ddd"
      >
        <div v-if="selectedElement">
          <h3>{{ selectedElement.label }}</h3>
          <p v-if="selectedElement.info">
            {{ selectedElement.info }}
          </p>
          <p v-else>No additional information available.</p>
        </div>
        <div v-else>
          <p>Select a node or connection to see details.</p>
        </div>
      </div>
    </div>

    <!-- Transcript Processor Modal -->
    <TranscriptProcessorModal
      :isOpen="showTranscriptProcessor"
      @close="showTranscriptProcessor = false"
      @graph-imported="handleTranscriptImported"
      @new-graph-created="handleNewGraphCreated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue' // <-- import nextTick
import cytoscape from 'cytoscape'
import TranscriptProcessorModal from '../components/TranscriptProcessorModal.vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
let cyInstance = null
const selectedElement = ref(null)
const infoOnly = ref(false)
const isSubgraphActive = ref(false)
const currentSubDegreeMap = ref(null) // <-- Add this reactive variable
const showTranscriptProcessor = ref(false)

// Subgraph for Yggdrasil
const yggdrasilSubgraph = {
  nodes: [
    { id: 'Asgard', label: 'Asgard', color: 'goldenrod' },
    { id: 'Midgard', label: 'Midgard', color: 'lightblue' },
    { id: 'Hel', label: 'Hel', color: 'gray' },
    { id: 'Norns', label: 'Norns', color: 'violet' },
    { id: 'Urd', label: 'Urd', color: 'lightgreen' },
    { id: 'Verdandi', label: 'Verdandi', color: 'lightgreen' },
    { id: 'Skuld', label: 'Skuld', color: 'lightgreen' },
    { id: 'Yggdrasil', label: 'Yggdrasil', color: 'lightgreen', hasSubgraph: true },
    { id: 'Tridevi', label: 'Tridevi', color: 'deeppink' },
    { id: 'Saraswati', label: 'Saraswati', color: 'lightcoral' },
    { id: 'Lakshmi', label: 'Lakshmi', color: 'lightcoral' },
    { id: 'Parvati', label: 'Parvati', color: 'lightcoral' },
    {
      id: 'AUM',
      label: 'AUM (ॐ)',
      color: 'orangered',
      type: 'infonode',
      info: 'AUM (अ - ॐ) is a sacred syllable representing ultimate reality and consciousness.',
    },
    {
      id: 'HA',
      label: 'HA (ሐ)',
      color: 'indigo',
      type: 'infonode',
      info: 'The symbol "HA (ሐ)" is a sacred syllable, resonant in Ge\'ez and Sanskrit traditions.',
    },
    {
      id: 'Haymanot',
      label: 'ሐይማኖት (Haymanot - Faith)',
      color: 'orangered',
      type: 'infonode',
      info: 'Faith in Ethiopian Orthodox and spiritual traditions.',
    },
    {
      id: 'Hawariyat',
      label: 'Hawariyat (Disciples)',
      color: 'orangered',
      type: 'infonode',
      info: 'Disciples or apostles spreading teachings.',
    },
    {
      id: 'Sanskrit_HA',
      label: 'ह',
      color: 'orangered',
      type: 'infonode',
      info: 'Sanskrit HA representing divine breath and energy.',
    },
    { id: 'MahaMantra', label: 'महामंत्र', color: 'orangered' },
    { id: 'Odin', label: 'Odin', color: 'orangered' },
    { id: 'Vili', label: 'Vili', color: 'orangered' },
    { id: 'Ve', label: 'Ve', color: 'orangered' },
    { id: 'Mimir', label: 'Mimir', color: 'orangered' },
    {
      id: 'Hvergelmir',
      label: 'Hvergelmir',
      color: 'orangered',
      type: 'infonode',
      info: 'Primordial well in Niflheim associated with chaos and rebirth.',
    },
    {
      id: 'Udgitha',
      label: 'Udgitha',
      color: 'orangered',
      type: 'infonode',
      info: 'Sacred sound representing the cosmic vibration in Hinduism.',
    },
    {
      id: 'Bhagavad Gita',
      label: 'Bhagavad Gita',
      color: 'goldenrod',
      type: 'infonode',
      info: 'Philosophical Hindu scripture from the Mahabharata.',
    },
    {
      id: 'Yaz',
      label: 'Yaz (ⵣ)',
      color: 'orangered',
      type: 'infonode',
      info: 'Tifinagh symbol of Amazigh identity and cultural roots.',
    },
    {
      id: 'Hávamál',
      label: 'Hávamál',
      color: 'orangered',
      type: 'infonode',
      info: 'Wisdom poems attributed to Odin in Norse tradition.',
    },
    // Added referenced but previously undefined nodes
    { id: 'Tree', label: 'Sacred Tree', color: 'green' },
    { id: 'DNA', label: 'DNA', color: 'green' },
    { id: 'Roots', label: 'Roots', color: 'brown' },
    { id: 'Branches', label: 'Branches', color: 'forestgreen' },
    { id: 'Ouroboros', label: 'Ouroboros', color: 'darkslateblue' },
    { id: 'HolyTrinity', label: 'Holy Trinity', color: 'lightgoldenrodyellow' },
    { id: 'Father', label: 'Father', color: 'lightgoldenrodyellow' },
    { id: 'Son', label: 'Son', color: 'lightgoldenrodyellow' },
    { id: 'HolySpirit', label: 'Holy Spirit', color: 'lightgoldenrodyellow' },
    { id: 'Hayl', label: 'Hayl', color: 'indigo' },
    { id: 'Niflheim', label: 'Niflheim', color: 'gray' },
    {
      id: 'Turiya',
      label: 'Turīya (Fourth State)',
      color: 'lavender',
      type: 'infonode',
      info: 'Pure consciousness beyond waking, dreaming, and sleep.',
    },
  ],
  edges: [
    { source: 'Norns', target: 'Urd' },
    { source: 'Norns', target: 'Verdandi' },
    { source: 'Norns', target: 'Skuld' },
    { source: 'Norns', target: 'Yggdrasil' },
    { source: 'Urd', target: 'Yggdrasil' },
    { source: 'Verdandi', target: 'Yggdrasil' },
    { source: 'Skuld', target: 'Yggdrasil' },

    { source: 'Tridevi', target: 'Saraswati' },
    { source: 'Tridevi', target: 'Lakshmi' },
    { source: 'Tridevi', target: 'Parvati' },
    { source: 'Tridevi', target: 'Yggdrasil' },
    { source: 'Saraswati', target: 'Urd' },
    { source: 'Lakshmi', target: 'Verdandi' },
    { source: 'Parvati', target: 'Skuld' },
    { source: 'Saraswati', target: 'Tree' },
    { source: 'Lakshmi', target: 'Tree' },
    { source: 'Parvati', target: 'Tree' },
    { source: 'Tridevi', target: 'DNA' },
    { source: 'Tridevi', target: 'Ouroboros' },
    { source: 'Tridevi', target: 'Roots' },
    { source: 'Tridevi', target: 'Branches' },

    { source: 'HolyTrinity', target: 'Father' },
    { source: 'HolyTrinity', target: 'Son' },
    { source: 'HolyTrinity', target: 'HolySpirit' },
    { source: 'Father', target: 'HA' },
    { source: 'Son', target: 'HA' },
    { source: 'HolySpirit', target: 'HA' },

    { source: 'HA', target: 'Hayl' },
    { source: 'HA', target: 'Haymanot' },
    { source: 'HA', target: 'Yggdrasil' },
    { source: 'Haymanot', target: 'Yggdrasil' },

    { source: 'Sanskrit_HA', target: 'HA' },
    { source: 'Sanskrit_HA', target: 'Yggdrasil' },
    { source: 'Sanskrit_HA', target: 'Tree' },
    { source: 'Sanskrit_HA', target: 'DNA' },
    { source: 'Sanskrit_HA', target: 'Roots' },

    { source: 'AUM', target: 'Sanskrit_HA' },
    { source: 'AUM', target: 'HA' },
    { source: 'AUM', target: 'Yggdrasil' },
    { source: 'AUM', target: 'Tree' },
    { source: 'AUM', target: 'DNA' },
    { source: 'AUM', target: 'Roots' },
    { source: 'AUM', target: 'Udgitha' },
    { source: 'Udgitha', target: 'Yggdrasil' },
    { source: 'AUM', target: 'Turiya' },

    { source: 'Yggdrasil', target: 'Mimir' },
    { source: 'Yggdrasil', target: 'Hvergelmir' },
    { source: 'Yggdrasil', target: 'Niflheim' },

    { source: 'Bhagavad Gita', target: 'Sanskrit_HA' },
    {
      source: 'Bhagavad Gita',
      target: 'Tree',
      type: 'info',
      info: 'Describes the cosmic ashvattha tree.',
    },

    {
      source: 'Hávamál',
      target: 'Bhagavad Gita',
      type: 'info',
      info: 'Both contain verse wisdom.',
    },
    {
      source: 'Hávamál',
      target: 'Yggdrasil',
      type: 'info',
      info: 'Contains Norse cosmological knowledge.',
    },
    { source: 'Odin', target: 'Hávamál' },

    { source: 'Odin', target: 'Yggdrasil' },
    { source: 'Vili', target: 'Yggdrasil' },
    { source: 'Ve', target: 'Yggdrasil' },
    { source: 'Odin', target: 'Vili' },
    { source: 'Odin', target: 'Ve' },
    { source: 'Vili', target: 'Ve' },

    { source: 'Yaz', target: 'Sanskrit_HA' },

    {
      source: 'Yaz',
      target: 'HA',
      type: 'info',
      info: 'Both symbols (ⵣ) and HA (ሐ)signify vital life essence (free human spirit vs. divine breath) in Afroasiatic cultures. Some modern thinkers in Afro-Asiatic studies have speculated on such parallels as evidence of a shared outlook among ancient African cultures for example, the emphasis on breath and freedom as sacred. Whether by cultural diffusion or pure coincidence, Yaz and HA both serve as reminders of the sacred life force - one grounded in ethnic-cultural freedom, the other in spiritual-divine vitality.',
    },

    { source: 'Yaz', target: 'Yggdrasil' },
    { source: 'Yaz', target: 'Tree' },
    { source: 'Yaz', target: 'DNA' },
    { source: 'Yaz', target: 'Roots' },
  ],
}

// Full sanitized JSON dataset (inlined)
const rawGraph = {
  nodes: [
    { id: 'Vegvísir', label: 'Vegvísir', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Compass', label: 'Compass', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Trigrams', label: 'Trigrams', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'Guidance', label: 'Guidance', group: 'Symbolic Core', color: 'lightcoral' },
    { id: 'HA', label: 'HA', group: 'Phonetic', color: 'gold' },
    { id: 'Breath', label: 'Breath', group: 'Phonetic', color: 'gold' },
    { id: 'Sanskrit', label: 'Sanskrit', group: 'Phonetic', color: 'gold' },
    { id: 'Hebrew', label: 'Hebrew', group: 'Phonetic', color: 'gold' },
    { id: 'Seed', label: 'Seed', group: 'Phonetic', color: 'gold' },
    { id: 'Mantra', label: 'Mantra', group: 'Phonetic', color: 'gold' },
    { id: 'Sound', label: 'Sound', group: 'Phonetic', color: 'gold' },
    { id: 'Syllables', label: 'Syllables', group: 'Phonetic', color: 'gold' },
    {
      id: 'Yggdrasil',
      label: 'Yggdrasil',
      group: 'Mythic Symbols',
      color: 'lightgreen',
      hasSubgraph: true,
    },
    { id: 'Tree', label: 'Tree', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'DNA', label: 'DNA', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'Ouroboros', label: 'Ouroboros', group: 'Mythic Symbols', color: 'lightgreen' },
    { id: 'Runes', label: 'Runes', group: 'Runes', color: 'lightskyblue' },
    { id: 'Elder Futhark', label: 'Elder Futhark', group: 'Runes', color: 'lightskyblue' },
    { id: 'Ættir', label: 'Ættir', group: 'Runes', color: 'lightskyblue' },
    { id: 'Phonetic', label: 'Phonetic', group: 'Phonetic', color: 'gold' },
    { id: '54 Letters', label: '54 Letters', group: 'Phonetic', color: 'gold' },
    { id: 'Bagua', label: 'Bagua', group: 'Esoteric Systems', color: 'violet' },
    { id: 'Pre-Heaven', label: 'Pre-Heaven', group: 'Esoteric Systems', color: 'violet' },
    { id: 'Post-Heaven', label: 'Post-Heaven', group: 'Esoteric Systems', color: 'violet' },
    { id: 'AZ', label: 'AZ', group: 'Centering', color: 'mediumorchid' },
    { id: 'Center', label: 'Center', group: 'Centering', color: 'mediumorchid' },
    { id: 'Unity', label: 'Unity', group: 'Centering', color: 'mediumorchid' },
    { id: 'Non-duality', label: 'Non-duality', group: 'Centering', color: 'mediumorchid' },
    { id: 'Hanuman', label: 'Hanuman', group: 'Mythology', color: 'tan' },
    { id: 'Mythology', label: 'Mythology', group: 'Mythology', color: 'tan' },
    { id: 'Hávamál', label: 'Hávamál', group: 'Mythology', color: 'tan' },
    { id: 'Elements', label: 'Elements', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Fire', label: 'Fire', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Water', label: 'Water', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Earth', label: 'Earth', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Air', label: 'Air', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Ether', label: 'Ether', group: 'Elementals', color: 'deepskyblue' },
    { id: 'Midjourney', label: 'Midjourney', group: 'Tools', color: 'gray' },
    { id: 'Infographic', label: 'Infographic', group: 'Tools', color: 'gray' },
    { id: 'Illustrator', label: 'Illustrator', group: 'Tools', color: 'gray' },
  ],
  edges: [
    { source: 'Vegvísir', target: 'Compass', weight: 9 },
    { source: 'Vegvísir', target: 'Trigrams', weight: 8 },
    { source: 'Vegvísir', target: 'Guidance', weight: 7 },
    { source: 'Trigrams', target: 'Bagua', weight: 9 },
    { source: 'HA', target: 'Breath', weight: 2 },
    { source: 'HA', target: 'Sanskrit', weight: 8 },
    { source: 'HA', target: 'Hebrew', weight: 8 },
    { source: 'HA', target: 'Seed', weight: 7 },
    { source: 'Breath', target: 'Mantra', weight: 8 },
    { source: 'Sanskrit', target: 'Phonetic', weight: 8 },
    { source: 'Sanskrit', target: '54 Letters', weight: 7 },
    { source: 'Seed', target: 'Mantra', weight: 7 },
    { source: 'Mantra', target: 'Sound', weight: 9 },
    { source: 'Sound', target: 'Syllables', weight: 8 },
    { source: 'Yggdrasil', target: 'Tree', weight: 9 },
    { source: 'Yggdrasil', target: 'DNA', weight: 7 },
    { source: 'Yggdrasil', target: 'Ouroboros', weight: 7 },
    { source: 'Runes', target: 'Elder Futhark', weight: 9 },
    { source: 'Elder Futhark', target: 'Ættir', weight: 8 },
    { source: 'Bagua', target: 'Pre-Heaven', weight: 8 },
    { source: 'Bagua', target: 'Post-Heaven', weight: 8 },
    { source: 'AZ', target: 'Center', weight: 9 },
    { source: 'AZ', target: 'Unity', weight: 8 },
    { source: 'Unity', target: 'Non-duality', weight: 9 },
    { source: 'Hanuman', target: 'Mythology', weight: 8 },
    { source: 'Mythology', target: 'Hávamál', weight: 7 },
    { source: 'Elements', target: 'Fire', weight: 6 },
    { source: 'Elements', target: 'Water', weight: 6 },
    { source: 'Elements', target: 'Earth', weight: 6 },
    { source: 'Elements', target: 'Air', weight: 6 },
    { source: 'Elements', target: 'Ether', weight: 6 },
    { source: 'Midjourney', target: 'Infographic', weight: 7 },
    { source: 'Infographic', target: 'Illustrator', weight: 9 },
  ],
}

const nodeIds = new Set(rawGraph.nodes.map((n) => n.id))
const degreeMap = {}
rawGraph.nodes.forEach((n) => (degreeMap[n.id] = 0))
rawGraph.edges.forEach((e) => {
  if (degreeMap[e.source] !== undefined) degreeMap[e.source]++
  if (degreeMap[e.target] !== undefined) degreeMap[e.target]++
})

const mainElements = [
  ...rawGraph.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      color: n.color,
      group: n.group,
      hasSubgraph: !!n.hasSubgraph,
      size: degreeMap[n.id] || 1,
    },
  })),
  ...rawGraph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      data: {
        id: `${e.source}_${e.target}`,
        source: e.source,
        target: e.target,
        weight: e.weight,
      },
    })),
]

const getFilteredElements = () => {
  if (!infoOnly.value) return mainElements
  return mainElements.filter((el) => {
    if (el.data.type === 'infonode' || el.data.info) return true
    if (el.data.source && el.data.target) {
      const sourceNode = mainElements.find((n) => n.data.id === el.data.source)
      const targetNode = mainElements.find((n) => n.data.id === el.data.target)
      return (
        (sourceNode && sourceNode.data.type === 'infonode') ||
        (targetNode && targetNode.data.type === 'infonode') ||
        el.data.info
      )
    }
    return false
  })
}

const getFilteredSubgraphElements = (subDegreeMap) => {
  const subNodes = yggdrasilSubgraph.nodes
    .filter((n) => !infoOnly.value || n.type === 'infonode' || n.info)
    .map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        color: n.color,
        size: subDegreeMap[n.id] || 1,
        type: n.type || null,
        info: n.info || null,
      },
      classes: 'subgraph',
    }))

  const visibleNodeIds = new Set(subNodes.map((n) => n.data.id))

  const subEdges = yggdrasilSubgraph.edges
    .filter((e) => {
      const edgeHasInfo = e.type === 'info' || e.info
      const nodesAreVisible = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      return !infoOnly.value || edgeHasInfo || nodesAreVisible
    })
    .map((e) => ({
      data: {
        id: `${e.source}_${e.target}`,
        source: e.source,
        target: e.target,
        type: e.type || null,
        info: e.info || null,
      },
      classes: 'subgraph',
    }))

  return [...subNodes, ...subEdges]
}

const toggleInfoOnly = async () => {
  infoOnly.value = !infoOnly.value
  cyInstance.elements().remove()
  if (isSubgraphActive.value && currentSubDegreeMap.value) {
    cyInstance.add(getFilteredSubgraphElements(currentSubDegreeMap.value))
    await nextTick()
    setTimeout(() => {
      // <-- Add short delay to ensure Cytoscape readiness
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 200,
          nodeRepulsion: 5000,
        })
        .run()
    }, 50)
  } else {
    cyInstance.add(getFilteredElements())
    await nextTick()
    setTimeout(() => {
      // <-- Add short delay here as well
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 150,
          nodeRepulsion: 4000,
        })
        .run()
    }, 50)
  }
  selectedElement.value = null
}

// Handle imported transcript nodes
const handleTranscriptImported = (knowledgeGraph) => {
  console.log('Importing transcript knowledge graph to GraphEditor:', knowledgeGraph)

  if (!cyInstance || !knowledgeGraph || !knowledgeGraph.nodes) {
    console.warn('Invalid cytoscape instance or knowledge graph data')
    return
  }

  // Add nodes to the current graph
  knowledgeGraph.nodes.forEach((node, index) => {
    const cytoscapeNode = {
      data: {
        id: node.id || `transcript_${Date.now()}_${index}`,
        label: node.label || 'Imported Node',
        color: node.color || '#f9f9f9',
        type: node.type || 'fulltext',
        info: node.info || '',
        size: 3, // Medium size for imported nodes
      },
      position: {
        x: 200 + index * 150,
        y: 200 + Math.floor(index / 5) * 200
      },
    }

    cyInstance.add(cytoscapeNode)
  })

  // Add edges if any exist in the knowledge graph
  if (knowledgeGraph.edges && Array.isArray(knowledgeGraph.edges)) {
    knowledgeGraph.edges.forEach((edge, index) => {
      const cytoscapeEdge = {
        data: {
          id: `transcript_edge_${Date.now()}_${index}`,
          source: edge.source,
          target: edge.target,
          type: edge.type || null,
          info: edge.info || null,
        },
      }

      cyInstance.add(cytoscapeEdge)
    })
  }

  // Run layout to organize new nodes
  cyInstance.layout({
    name: 'cose',
    idealEdgeLength: 150,
    nodeRepulsion: 4000,
  }).run()

  console.log(`Added ${knowledgeGraph.nodes.length} transcript nodes to graph`)
}

// Handle creation of new graph (not applicable in GraphEditor context, but needed for modal)
const handleNewGraphCreated = (newGraph) => {
  console.log('New graph creation requested in GraphEditor - redirecting to import:', newGraph)
  // In GraphEditor context, treat new graph creation as import
  handleTranscriptImported(newGraph)
}

onMounted(() => {
  cyInstance = cytoscape({
    container: document.getElementById('cy'),
    elements: getFilteredElements(),
    layout: {
      name: 'cose',
      idealEdgeLength: 150, // <-- Increase to spread nodes out
      nodeRepulsion: 4000, // <-- Add repulsion to avoid clustering
    },
    style: [
      {
        selector: 'node',
        style: {
          label: (ele) =>
            ele.data('type') === 'infonode' ? ele.data('label') + ' ℹ️' : ele.data('label'),
          'background-color': 'data(color)',
          color: '#222',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          width: 'mapData(size, 1, 10, 20, 80)',
          height: 'mapData(size, 1, 10, 20, 80)',
          'border-width': 0.5,
          'border-color': '#000',
          'border-style': 'solid',
        },
      },
      {
        selector: 'node[id = "Yggdrasil"]',
        style: {
          'border-width': 0.5,
          'border-color': '#000',
          'border-style': 'dashed',
        },
      },
      {
        selector: 'node[type="youtube-video"]',
        style: {
          shape: 'rectangle',
          'background-color': '#FF0000', // YouTube red
          'border-width': 2,
          'border-color': '#000',
          label: (ele) => {
            // Extract title from YouTube markdown format
            const match = ele.data('label').match(/!\[YOUTUBE src=.+?\](.+?)\[END YOUTUBE\]/)
            return match ? match[1] : ele.data('label')
          },
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          color: '#fff',
          width: '200px',
          height: '112px', // 16:9 aspect ratio for video thumbnail
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1, // <-- Ensure edge width is always 1pt
          'line-color': '#999',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#ccc',
          'curve-style': 'bezier',
          label: (ele) => (ele.data('info') ? 'ℹ️' : ''),
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': '-10px',
          color: '#555',
        },
      },
      {
        selector: 'node.subgraph',
        style: {
          shape: 'ellipse', // circular form
          width: 'mapData(size, 1, 5, 20, 60)', // weighted size
          height: 'mapData(size, 1, 5, 20, 60)', // weighted size
          'border-width': 1,
          'border-color': '#000',
          'border-style': 'solid',
          'background-color': 'data(color)',
          label: (ele) =>
            ele.data('type') === 'infonode' ? ele.data('label') + ' ℹ️' : ele.data('label'),
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '12px',
          color: '#222',
        },
      },
      {
        selector: 'edge.subgraph',
        style: {
          width: 1, // Explicitly set edge width to 1pt
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#ccc',
          'arrow-scale': 0.5,
          'line-color': '#999',
          'curve-style': 'bezier',
          label: (ele) => (ele.data('info') ? 'ℹ️' : ''),
          'font-size': '10px',
          'text-rotation': 'autorotate',
          'text-margin-y': '-8px',
          color: '#555',
        },
      },
    ],
  })

  cyInstance.on('tap', 'node, edge', (event) => {
    const element = event.target
    const data = element.data()

    selectedElement.value = {
      label: data.label || `${data.source} → ${data.target}`,
      info: data.info || null,
      type: data.type || null,
    }

    if (element.isNode() && data.hasSubgraph && data.id === 'Yggdrasil') {
      isSubgraphActive.value = true
      cyInstance.elements().remove()

      const subDegreeMap = {}
      yggdrasilSubgraph.nodes.forEach((n) => (subDegreeMap[n.id] = 0))
      yggdrasilSubgraph.edges.forEach((e) => {
        subDegreeMap[e.source]++
        subDegreeMap[e.target]++
      })

      currentSubDegreeMap.value = subDegreeMap // <-- Store subDegreeMap here

      cyInstance.add(getFilteredSubgraphElements(subDegreeMap))
      cyInstance
        .layout({
          name: 'cose',
          idealEdgeLength: 200, // <-- Spread out subgraph nodes
          nodeRepulsion: 5000, // <-- Add repulsion for subgraph
        })
        .run()
    }
  })
})
</script>
