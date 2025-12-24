<template>
  <div ref="container" class="mermaid-container"></div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import mermaid from '@/utils/mermaid'

// Define component name
defineOptions({
  name: 'MermaidDiagram',
})

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
})

const container = ref(null)

async function renderMermaid() {
  if (!container.value || !props.code) {
    console.warn('Mermaid: Missing container or code')
    return
  }

  try {
    // Clear previous content
    container.value.innerHTML = ''

    // Generate a unique ID for this diagram
    const id = 'mermaid-graph-' + Math.random().toString(36).substr(2, 9)

    // Render the diagram
    const { svg } = await mermaid.render(id, props.code)
    container.value.innerHTML = svg
  } catch (err) {
    console.error('Mermaid rendering error:', err)
    container.value.innerHTML = `<pre style="color:red;">Error rendering Mermaid diagram: ${err.message}</pre>`
  }
}

onMounted(() => {
  console.log('Mermaid component mounted with code:', props.code)
  renderMermaid()
})

watch(
  () => props.code,
  (newCode) => {
    console.log('Mermaid code changed:', newCode)
    renderMermaid()
  },
)
</script>

<style scoped>
.mermaid-container {
  width: 100%;
  overflow-x: auto;
  margin: 1rem 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
