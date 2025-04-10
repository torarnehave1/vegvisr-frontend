<template>
  <div id="cy" style="width: 100%; height: 600px"></div>
</template>

<script setup>
import { onMounted } from 'vue'
import cytoscape from 'cytoscape'

// Inline JSON graph data
const graphData = {
  elements: [
    // Nodes
    { data: { id: 'bagua', label: 'Bagua', color: '#e377c2' } },
    { data: { id: 'pre', label: 'Pre-Heaven Bagua', color: '#e377c2' } },
    { data: { id: 'post', label: 'Post-Heaven Bagua', color: '#e377c2' } },
    { data: { id: 'motion', label: 'Motion', color: '#e377c2' } },
    { data: { id: 'stillness', label: 'Stillness', color: '#e377c2' } },

    // Edges
    { data: { source: 'pre', target: 'stillness' } },
    { data: { source: 'post', target: 'motion' } },
    { data: { source: 'pre', target: 'post' } },
  ],
}

onMounted(() => {
  cytoscape({
    container: document.getElementById('cy'),
    elements: graphData.elements,
    style: [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          'text-valign': 'center',
          color: '#000',
          'background-color': 'data(color)',
          width: 'label',
          height: 'label',
          padding: '10px',
        },
      },
      {
        selector: 'edge',
        style: {
          'line-color': '#aaa',
          width: 2,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#aaa',
          'curve-style': 'bezier',
        },
      },
    ],
    layout: { name: 'cose' },
  })
})
</script>
