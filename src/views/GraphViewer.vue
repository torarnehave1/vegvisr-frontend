<template>
  <div class="graph-viewer">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <div
        v-for="node in graphData.nodes"
        :key="node.id"
        class="node"
        :style="{
          left: `${node.position.x}px`,
          top: `${node.position.y}px`,
          backgroundColor: node.color || '#ccc',
        }"
      >
        {{ node.label }}
      </div>
      <svg class="edges">
        <line
          v-for="edge in graphData.edges"
          :key="edge.id"
          :x1="getNodePosition(edge.source).x"
          :y1="getNodePosition(edge.source).y"
          :x2="getNodePosition(edge.target).x"
          :y2="getNodePosition(edge.target).y"
          stroke="black"
          stroke-width="2"
        />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const graphData = ref({ nodes: [], edges: [] })
const loading = ref(true)
const error = ref(null)

const knowledgeGraphStore = useKnowledgeGraphStore()

const fetchGraphData = async () => {
  try {
    const graphId = knowledgeGraphStore.currentGraphId
    if (!graphId) {
      throw new Error('No graph ID is set in the store.')
    }

    const apiUrl = `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.statusText}`)
    }
    const data = await response.json()
    graphData.value = data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const getNodePosition = (nodeId) => {
  const node = graphData.value.nodes.find((n) => n.id === nodeId)
  return node?.position || { x: 0, y: 0 }
}

onMounted(() => {
  fetchGraphData()
})

// Watch for changes to the currentGraphId in the store and refetch data
watch(
  () => knowledgeGraphStore.currentGraphId,
  () => {
    loading.value = true
    error.value = null
    fetchGraphData()
  },
)
</script>

<style scoped>
/* General styles */
.graph-viewer {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f9f9f9;
}

.loading,
.error {
  text-align: center;
  font-size: 1.5rem;
  margin-top: 20px;
}

.graph-container {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Node styles */
.node {
  position: absolute;
  padding: 10px;
  border-radius: 5px;
  color: white;
  font-size: 14px;
  text-align: center;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Edge styles */
.edges {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Responsive styles */
@media (max-width: 768px) {
  .node {
    font-size: 12px;
    padding: 8px;
  }
}
</style>
