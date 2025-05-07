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

    // Deduplicate nodes based on id
    const uniqueNodes = []
    const seenIds = new Set()
    for (const node of data.nodes) {
      if (!seenIds.has(node.id)) {
        uniqueNodes.push(node)
        seenIds.add(node.id)
      }
    }

    graphData.value = {
      ...data,
      nodes: uniqueNodes.filter((node) => node.visible !== false),
    }
    console.log('Fetched graphData:', graphData.value)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const preprocessMarkdown = (text) => {
  console.log('Input Markdown Text:', text)

  // Updated regex to include text-align for FANCY
  const markdownRegex =
    /(!\[(Header|Rightside|Leftside)(?:-(\d+))?\|(.+?)\]\((.+?)\))|(\[QUOTE\s*\|\s*Cited='(.+?)'\](.*?)\[END QUOTE\])|(\[SECTION\s*\|\s*background-color:\s*'(.+?)';\s*color:\s*'(.+?)'\](.*?)\[END SECTION\])|(\[FANCY\s*\|\s*font-size:\s*([^;]+?);\s*color:\s*([^;]+?)(?:;\s*background-image:\s*url\('([^;]+?)'\))?(?:;\s*text-align:\s*([^;]+?))?\s*\](.*?)\[END FANCY\])/gs
  let result = ''
  let currentIndex = 0
  let match

  while ((match = markdownRegex.exec(text)) !== null) {
    const fullMatch = match[0]
    const isImage = match[1]
    const isQuote = match[6]
    const isSection = match[9]
    const isFancy = match[13]
    const startIndex = match.index
    const endIndex = startIndex + fullMatch.length

    console.log('Processing match:', {
      fullMatch,
      startIndex,
      endIndex,
      isImage,
      isQuote,
      isSection,
      isFancy,
    })

    // Add text before the match
    if (currentIndex < startIndex) {
      result += marked.parse(text.slice(currentIndex, startIndex))
    }

    if (isImage) {
      const type = match[2]
      const paragraphCount = match[3]
      const styles = match[4]
      const url = match[5]

      console.log(`Processing ${type}:`, { paragraphCount, styles, url, startIndex, endIndex })

      if (type === 'Header') {
        const height = styles.match(/height:\s*([\d%]+|[\d]+px)/)?.[1] || 'auto'
        const objectFit = styles.match(/object-fit:\s*([\w-]+)/)?.[1] || 'cover'
        const objectPosition = styles.match(/object-position:\s*([\w\s-]+)/)?.[1] || 'center'

        result += `
          <div class="header-image-container">
            <img src="${url}" alt="Header Image" class="header-image" style="object-fit: ${objectFit}; object-position: ${objectPosition}; height: ${height !== 'auto' ? height + 'px' : height}; border-radius: 8px;" />
          </div>
        `.trim()
        currentIndex = endIndex
      } else if (type === 'Rightside' || type === 'Leftside') {
        const width = styles.match(/width:\s*([\d%]+|[\d]+px)/)?.[1] || '20%'
        const height = styles.match(/height:\s*([\d%]+|[\d]+px)/)?.[1] || '200px'
        const objectFit = styles.match(/object-fit:\s*([\w-]+)/)?.[1] || 'cover'
        const objectPosition = styles.match(/object-position:\s*([\w\s-]+)/)?.[1] || 'center'

        // Get text after the markdown
        const remainingText = text.slice(endIndex)
        const paragraphs = remainingText.split(/\n\s*\n/).filter((p) => p.trim())
        const numParagraphs = parseInt(paragraphCount, 10) || 1
        const sideParagraphs = paragraphs
          .slice(0, numParagraphs)
          .map((p) => marked.parse(p))
          .join('')

        // Calculate the index after the processed paragraphs
        let paragraphEndIndex = endIndex
        let paragraphTextLength = 0
        for (let i = 0; i < numParagraphs && i < paragraphs.length; i++) {
          const paragraph = paragraphs[i]
          paragraphTextLength += paragraph.length
          const nextNewline = remainingText.slice(paragraphTextLength).indexOf('\n\n')
          if (nextNewline !== -1) {
            paragraphTextLength += nextNewline + 2
          }
        }
        paragraphEndIndex += paragraphTextLength

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

        currentIndex = paragraphEndIndex
      }
    } else if (isQuote) {
      const cited = match[7]
      const quoteContent = match[8].trim()

      console.log('Processing Quote:', { cited, quoteContent, startIndex, endIndex })

      result += `
        <div class="fancy-quote">
          ${marked.parse(quoteContent)}
          <cite>— ${cited}</cite>
        </div>
      `.trim()
      currentIndex = endIndex
    } else if (isSection) {
      const backgroundColor = match[10]
      const color = match[11]
      const sectionContent = match[12].trim()

      console.log('Processing Section:', {
        backgroundColor,
        color,
        sectionContent,
        startIndex,
        endIndex,
      })

      result += `
        <div class="section" style="background-color: ${backgroundColor}; color: ${color};">
          ${marked.parse(sectionContent)}
        </div>
      `.trim()
      currentIndex = endIndex
    } else if (isFancy) {
      const fontSize = match[14].trim()
      const color = match[15].trim()
      const backgroundImage = match[16] ? match[16].trim() : null
      const textAlign = match[17] ? match[17].trim() : 'center' // Default to center if not specified
      const titleContent = match[18].trim()

      console.log('Processing Fancy:', {
        fontSize,
        color,
        backgroundImage,
        textAlign,
        titleContent,
        startIndex,
        endIndex,
      })

      // Validate backgroundImage URL
      const isValidUrl = backgroundImage && /^https?:\/\/[^\s;]+$/.test(backgroundImage)
      let style = `font-size: ${fontSize}; color: ${color}; text-align: ${textAlign};`
      if (isValidUrl) {
        style += ` background-image: url('${backgroundImage}');`
      }

      result += `
        <div class="fancy-title" style="${style}">
          ${marked.parse(titleContent)}
        </div>
      `.trim()
      if (!isValidUrl && backgroundImage) {
        console.warn('Invalid background-image URL:', backgroundImage)
      }
      currentIndex = endIndex
    }
  }

  // Add any remaining text
  if (currentIndex < text.length) {
    result += marked.parse(text.slice(currentIndex))
  }

  console.log('Processed Markdown Output:', result)
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
.graph-viewer {
  padding: 20px;
  background-color: #f9f9f9;
  box-sizing: border-box;
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
  box-sizing: border-box;
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

.header-image-container {
  width: 100%;
  max-width: 100%;
  margin: 0 auto 20px;
  overflow: hidden;
  box-sizing: border-box;
}

.header-image-container img.header-image {
  width: 100%;
  max-width: 100%;
  max-height: 200px;
  height: auto;
  display: block;
  border-radius: 8px;
  object-fit: cover;
}

.rightside-container,
.leftside-container {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 20px;
  align-items: flex-start;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.rightside-content,
.leftside-content {
  flex: 1 1 auto;
  min-width: 0;
  max-width: calc(100% - 20% - 20px) !important;
  box-sizing: border-box;
}

.rightside-image {
  flex: 0 0 20%;
  width: 20%;
  min-width: 20% !important;
  box-sizing: border-box;
  order: 2;
}

.leftside-image {
  flex: 0 0 20%;
  width: 20%;
  min-width: 20% !important;
  box-sizing: border-box;
  order: 1;
}

.rightside-content {
  order: 1;
}

.leftside-content {
  order: 2;
}

img.rightside,
img.leftside {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

.fancy-quote {
  font-style: italic;
  background-color: #f9f9f9;
  border-left: 5px solid #ccc;
  padding: 1em;
  margin: 1em 0;
  color: #333;
}

.fancy-quote cite {
  display: block;
  text-align: right;
  font-style: normal;
  color: #666;
  margin-top: 0.5em;
}

.section {
  padding: 1em;
  margin: 1em 0;
  border-radius: 4px;
  box-sizing: border-box;
}

.fancy-title {
  font-family: Arial, Helvetica, sans-serif;
  background-color: #f9f9f9;
  padding: 0.5em;
  margin: 0.5em 0;
  border-radius: 4px;
  box-sizing: border-box;
  font-weight: bold;
  text-align: center;
  background-size: cover;
  background-position: center;
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

  .header-image-container {
    margin: 0 0 15px;
  }

  .header-image-container img.header-image {
    max-height: 150px;
  }

  .rightside-container,
  .leftside-container {
    flex-direction: column;
    flex-wrap: wrap;
  }

  .rightside-content,
  .leftside-content {
    max-width: 100% !important;
  }

  .rightside-image,
  .leftside-image {
    flex: 0 0 auto;
    width: 100%;
    min-width: 0 !important;
  }
}
</style>
