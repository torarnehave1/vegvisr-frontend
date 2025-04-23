<template>
  <div class="graph-viewer">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <div v-for="node in graphData.nodes" :key="node.id" class="node">
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
    graphData.value = data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const preprocessMarkdown = (text) => {
  console.log('--- Preprocessing Markdown ---')
  console.log('Original text:', text)

  // Regex to match image markdown with size and optional style information
  const imageRegex =
    /!\[([^\]]*?)\|width:(\d+(?:px|%));height:(\d+(?:px|%))(?:;object-fit:\s*(\w+);object-position:\s*([\w\s%]+))?\]\((.*?)\)/g

  // Replace matched image markdown with styled HTML
  const processedText = text.replace(
    imageRegex,
    (match, alt, width, height, objectFit, objectPosition, src) => {
      console.log('Matched image markdown:', { alt, width, height, objectFit, objectPosition, src })

      // Check if the alt text contains the key "Rightside-X" or "Leftside-X"
      const rightsideMatch = alt.match(/Rightside-(\d+)/)
      const leftsideMatch = alt.match(/Leftside-(\d+)/)

      if (rightsideMatch || leftsideMatch) {
        const paragraphsToInclude = parseInt((rightsideMatch || leftsideMatch)[1], 10) || 1 // Default to 1 paragraph
        const isLeftside = !!leftsideMatch
        const imageWidth = parseInt(width) || 50 // Default to 50% if width is not provided
        const textWidth = 100 - imageWidth // Calculate text width as the remaining percentage

        const styleImage = `width: ${imageWidth}%; height: ${height};${objectFit ? ` object-fit: ${objectFit};` : ''}${objectPosition ? ` object-position: ${objectPosition};` : ''}`
        const styleText = `width: ${textWidth}%; display: inline-block; vertical-align: top; padding-${isLeftside ? 'right' : 'left'}: 10px;`

        // Extract text following the image markdown
        const remainingText = text.split(match)[1]?.trim() || ''
        const paragraphs = remainingText.split('\n\n') // Split text into paragraphs
        const sideContentMarkdown = paragraphs.slice(0, paragraphsToInclude).join('\n\n')
        const remainingContentMarkdown = paragraphs.slice(paragraphsToInclude).join('\n\n')

        const sideContentHtml = marked(sideContentMarkdown) // Convert to HTML
        const remainingContentHtml = marked(remainingContentMarkdown) // Convert to HTML

        // Generate HTML for the image and aligned text
        const imgHtml = isLeftside
          ? `<div style="display: flex;"><div style="${styleText}">${sideContentHtml}</div><img src="${src}" alt="${alt}" style="${styleImage}" /></div>`
          : `<div style="display: flex;"><img src="${src}" alt="${alt}" style="${styleImage}" /><div style="${styleText}">${sideContentHtml}</div></div>`
        const fullHtml = `${imgHtml}<div style="width: 100%; margin-top: 10px;">${remainingContentHtml}</div>`
        console.log('Generated HTML:', fullHtml)
        return fullHtml
      }

      // Default handling for other images
      const style = `width: ${width}; height: ${height};${objectFit ? ` object-fit: ${objectFit};` : ''}${objectPosition ? ` object-position: ${objectPosition};` : ''}`
      const imgHtml = `<img src="${src}" alt="${alt}" style="${style}" />`
      console.log('Generated image HTML:', imgHtml)
      return imgHtml
    },
  )

  console.log('Processed text:', processedText)
  return processedText
}

const convertToHtml = (text) => {
  console.log('--- Debugging convertToHtml ---')
  console.log('Raw text being processed:', text)

  // Preprocess the markdown to handle image markdown with size information
  const preprocessedText = preprocessMarkdown(text)

  // Pass the preprocessed text to marked
  const html = marked(preprocessedText)
  console.log('Generated HTML from marked:', html)
  return html
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

/* Node styles */
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

/* Responsive styles */
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
