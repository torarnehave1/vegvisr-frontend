<template>
  <div class="admin-page">
    <!-- Form Section -->
    <div class="form-section">
      <h2>Create New Knowledge Graph</h2>
      <form @submit.prevent="saveGraph">
        <label>
          Title:
          <input v-model="graphMetadata.title" type="text" required />
        </label>
        <label>
          Description:
          <textarea v-model="graphMetadata.description"></textarea>
        </label>
        <label>
          Created By:
          <input v-model="graphMetadata.createdBy" type="text" required />
        </label>
        <button type="submit">Save Knowledge Graph</button>
      </form>
    </div>

    <!-- Graph Editor Section -->
    <div class="graph-editor">
      <h3>Graph Editor</h3>
      <div id="cy" style="width: 100%; height: 500px; border: 1px solid #ddd"></div>
      <button @click="addNode">Add Node</button>
      <button @click="addEdge">Add Edge</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import cytoscape from 'cytoscape'

const cyInstance = ref(null)
const graphMetadata = ref({
  title: '',
  description: '',
  createdBy: '',
})
const nodes = ref([])
const edges = ref([])

onMounted(() => {
  cyInstance.value = cytoscape({
    container: document.getElementById('cy'),
    elements: [],
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'background-color': '#0074D9',
          color: '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#999',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#999',
          'curve-style': 'bezier',
        },
      },
    ],
    layout: {
      name: 'grid',
    },
  })
})

const addNode = () => {
  const id = `node${nodes.value.length + 1}`
  const label = `Node ${nodes.value.length + 1}`
  const newNode = { data: { id, label } }
  nodes.value.push(newNode)
  cyInstance.value.add(newNode)
}

const addEdge = () => {
  if (nodes.value.length < 2) {
    alert('You need at least two nodes to create an edge.')
    return
  }
  const source = nodes.value[nodes.value.length - 2].data.id
  const target = nodes.value[nodes.value.length - 1].data.id
  const newEdge = { data: { id: `${source}_${target}`, source, target } }
  edges.value.push(newEdge)
  cyInstance.value.add(newEdge)
}

const saveGraph = async () => {
  const graphData = {
    metadata: graphMetadata.value,
    nodes: nodes.value,
    edges: edges.value,
  }

  // Save to D1 database using Wrangler
  const response = await fetch('https://knowledge.vegvisr.org/saveknowgraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(graphData),
  })

  if (response.ok) {
    alert('Knowledge Graph saved successfully!')
  } else {
    alert('Failed to save the Knowledge Graph.')
  }
}
</script>

<style>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}
.form-section {
  background: #f9f9f9;
  padding: 20px;
  border: 1px solid #ddd;
}
.graph-editor {
  background: #fff;
  padding: 20px;
  border: 1px solid #ddd;
}
</style>
