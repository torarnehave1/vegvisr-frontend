<template>
  <div class="graph-viewer">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <div
        v-for="node in graphData.nodes.filter((n) => n.visible !== false)"
        :key="node.id"
        class="node"
      >
        <template v-if="node.type === 'background'">
          <img :src="node.label" alt="Background Image" class="node-image" />
        </template>
        <template v-else-if="node.type === 'REG'">
          <iframe
            src="https://www.vegvisr.org/register?embed=true"
            style="width: 100%; height: 500px; border: none"
          ></iframe>
        </template>
        <template v-else>
          <h3 class="node-label">{{ node.label }}</h3>
          <div
            class="node-info"
            v-html="convertToHtml(node.info || 'No additional information available.')"
          ></div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { marked } from 'marked'

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

    graphData.value = {
      ...data,
      nodes: data.nodes.filter((node) => node.visible !== false), // Exclude invisible nodes
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const preprocessMarkdown = (text) => {
  const imageRegex =
    /!\[([^\]]*?)\|width:(\d+(?:px|%));height:(\d+(?:px|%))(?:;object-fit:\s*(\w+);object-position:\s*([\w\s%]+))?\]\((.*?)\)/g

  let result = ''
  let lastIndex = 0
  let match

  // Process each image markdown match
  while ((match = imageRegex.exec(text)) !== null) {
    const [fullMatch, alt, width, height, objectFit, objectPosition, src] = match
    const offset = match.index

    // Append text before the match
    result += marked.parse(text.slice(lastIndex, offset))

    const rightsideMatch = alt.match(/Rightside-(\d+)/)
    const leftsideMatch = alt.match(/Leftside-(\d+)/)

    if (rightsideMatch || leftsideMatch) {
      const paragraphsToInclude = parseInt((rightsideMatch || leftsideMatch)[1], 10) || 1
      const isLeftside = !!leftsideMatch
      const imageWidth = parseInt(width) || 50
      const textWidth = 100 - imageWidth

      const styleImage = `width: ${imageWidth}%; height: ${height};${objectFit ? ` object-fit: ${objectFit};` : ''}${objectPosition ? ` object-position: ${objectPosition};` : ''}`
      const styleText = `width: ${textWidth}%; display: inline-block; vertical-align: top; padding-${isLeftside ? 'right' : 'left'}: 10px;`

      // Get text after the match
      const remainingText = text.slice(offset + fullMatch.length).trim()
      const paragraphs = remainingText.split('\n\n')
      const sideContentMarkdown = paragraphs.slice(0, paragraphsToInclude).join('\n\n')
      const remainingContentMarkdown = paragraphs.slice(paragraphsToInclude).join('\n\n')

      const sideContentHtml = marked.parse(sideContentMarkdown)
      const remainingContentHtml = remainingContentMarkdown
        ? marked.parse(remainingContentMarkdown)
        : ''

      const imgHtml = isLeftside
        ? `<div style="display: flex;"><div style="${styleText}">${sideContentHtml}</div><img src="${src}" alt="${alt}" style="${styleImage}" /></div>`
        : `<div style="display: flex;"><img src="${src}" alt="${alt}" style="${styleImage}" /><div style="${styleText}">${sideContentHtml}</div></div>`

      result += remainingContentHtml
        ? `${imgHtml}<div style="width: 100%; margin-top: 10px;">${remainingContentHtml}</div>`
        : imgHtml

      // Update lastIndex to skip processed remaining content
      lastIndex = offset + fullMatch.length + remainingText.length
    } else {
      const style = `width: ${width}; height: ${height};${objectFit ? ` object-fit: ${objectFit};` : ''}${objectPosition ? ` object-position: ${objectPosition};` : ''}`
      result += `<img src="${src}" alt="${alt}" style="${style}" />`
      lastIndex = offset + fullMatch.length
    }
  }

  // Append any remaining text after the last match
  if (lastIndex < text.length) {
    result += marked.parse(text.slice(lastIndex))
  }

  return result
}

const convertToHtml = (text) => {
  return preprocessMarkdown(text)
}

onMounted(() => {
  fetchGraphData()
})

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
.graph-viewer {
  padding: 20px;
  background-color: #f9f9f9;
}

.loading,
.error {
  text-align: center;
  font-size: 1.5rem;
  margin-top: 20px;
}

.graph-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.node {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-label {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #333;
}

.node-info {
  margin: 0;
  font-size: 1rem;
  color: #666;
}

.node-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .node {
    padding: 10px;
  }

  .node-label {
    font-size: 1rem;
  }

  .node-info {
    font-size: 0.875rem;
  }
}
</style>
