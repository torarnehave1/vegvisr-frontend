<template>
  <div class="graph-viewer container">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <div
        v-for="node in graphData.nodes.filter((n) => n.visible !== false)"
        :key="node.id"
        class="node"
      >
        <template v-if="node.type === 'markdown-image'">
          <img
            :src="parseMarkdownImage(node.label)?.url"
            alt="Markdown Image"
            class="node-image"
            :style="{
              width: parseMarkdownImage(node.label)?.styles?.width || 'auto',
              height: parseMarkdownImage(node.label)?.styles?.height || 'auto',
              objectFit: parseMarkdownImage(node.label)?.styles?.['object-fit'] || 'cover',
              objectPosition:
                parseMarkdownImage(node.label)?.styles?.['object-position'] || 'center',
            }"
          />
        </template>
        <template v-else-if="node.type === 'background'">
          <img :src="node.label" alt="Background Image" class="node-image" />
        </template>
        <template v-else-if="node.type === 'REG'">
          <iframe
            src="https://www.vegvisr.org/register?embed=true"
            style="width: 100%; height: 500px; border: none"
          ></iframe>
        </template>
        <template v-else-if="node.type === 'mermaid-diagram'">
          <h3 class="node-label">{{ node.label }}</h3>
          <div class="mermaid-diagram-container">
            <MermaidDiagram :code="node.info || 'graph TD; A-->B;'" />
          </div>
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
import MermaidDiagram from './Mermaid.vue'

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
      nodes: data.nodes.filter((node) => node.visible !== false),
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const preprocessMarkdown = (text) => {
  console.log('Input Markdown Text:', text)

  const markdownRegex = /!\[(Header|Rightside|Leftside)(?:-(\d+))?\|(.+?)\]\((.+?)\)/g
  let result = ''
  let lastIndex = 0

  let match
  while ((match = markdownRegex.exec(text)) !== null) {
    const [, type, paragraphCount, styles, url] = match
    console.log(`Processing ${type}:`, { paragraphCount, styles, url, index: match.index })

    // Add text before the match
    if (lastIndex < match.index) {
      result += marked.parse(text.slice(lastIndex, match.index))
    }

    if (type === 'Header') {
      const height = styles.match(/height:\s*([\d%]+)/)?.[1] || 'auto'
      const objectFit = styles.match(/object-fit:\s*([\w-]+)/)?.[1] || 'cover'
      const objectPosition = styles.match(/object-position:\s*([\w\s-]+)/)?.[1] || 'center'

      result += `
        <div class="header-image-container">
          <img src="${url}" alt="Header Image" class="header-image" style="object-fit: ${objectFit}; object-position: ${objectPosition}; height: ${height !== 'auto' ? height + 'px' : height}; border-radius: 8px;" />
        </div>
      `.trim()
    } else if (type === 'Rightside' || type === 'Leftside') {
      const width = styles.match(/width:\s*([\d%]+|[\d]+px)/)?.[1] || '20%'
      const height = styles.match(/height:\s*([\d%]+|[\d]+px)/)?.[1] || '200px'
      const objectFit = styles.match(/object-fit:\s*([\w-]+)/)?.[1] || 'cover'
      const objectPosition = styles.match(/object-position:\s*([\w\s-]+)/)?.[1] || 'center'

      // Get text after the markdown
      const remainingText = text.slice(match.index + match[0].length).trim()
      const paragraphs = remainingText.split(/\n\s*\n/).filter((p) => p.trim())
      const numParagraphs = parseInt(paragraphCount, 10) || 1
      const sideParagraphs = paragraphs
        .slice(0, numParagraphs)
        .map((p) => marked.parse(p))
        .join('')
      const afterParagraphs = paragraphs
        .slice(numParagraphs)
        .map((p) => marked.parse(p))
        .join('')

      const containerClass = type === 'Rightside' ? 'rightside-container' : 'leftside-container'
      const contentClass = type === 'Rightside' ? 'rightside-content' : 'leftside-content'
      const imageClass = type === 'Rightside' ? 'rightside-image' : 'leftside-image'
      const imageSideClass = type === 'Rightside' ? 'rightside' : 'leftside'

      result += `
        <div class="${containerClass}">
          <div class="${imageClass}">
            <img src="${url}" alt="${type} Image" class="${imageSideClass}" style="width: ${width}; min-width: ${width}; height: ${height !== 'auto' ? height + 'px' : height}; object-fit: ${objectFit}; object-position: ${objectPosition}; border-radius: 8px;" />
          </div>
          <div class="${contentClass}">${sideParagraphs}</div>
        </div>
      `.trim()

      if (afterParagraphs) {
        result += `<div class="remaining-content">${afterParagraphs}</div>`
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    result += marked.parse(text.slice(lastIndex))
  }

  return result.trim()
}

const convertToHtml = (text) => {
  return preprocessMarkdown(text)
}

const parseMarkdownImage = (markdown) => {
  const regex = /!\[.*?\|(.+?)\]\((.+?)\)/
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
/* Styles are now in main.css */
.mermaid-diagram-container {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}
</style>
