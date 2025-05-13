<template>
  <div class="graph-viewer container">
    <!-- Success Message at the top -->
    <div v-if="saveMessage" class="alert alert-success text-center" role="alert">
      {{ saveMessage }}
    </div>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <!-- Render only nodes with visible=true -->
      <div
        v-for="node in graphData.nodes.filter((n) => n.visible !== false)"
        :key="node.id"
        class="node"
        @contextmenu="showContextMenu($event, node)"
      >
        <template v-if="node.type === 'markdown-image'">
          <!-- Render markdown image nodes -->
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
        <template v-else-if="node.type === 'youtube-video'">
          <!-- Render YouTube video nodes -->
          <iframe
            :src="parseYoutubeVideo(node.label)"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            class="youtube-iframe"
          ></iframe>
        </template>
        <template v-else>
          <!-- Render other node types -->
          <h3 class="node-label">{{ node.label }}</h3>
          <div class="node-info">
            <button @click="openMarkdownEditor(node)">Edit Info</button>
            <div v-html="convertToHtml(node.info || 'No additional information available.')"></div>
          </div>
        </template>
      </div>

      <!-- Markdown Editor Modal -->
      <div v-if="isMarkdownEditorOpen" class="markdown-editor-modal">
        <div class="modal-content">
          <h3>Edit Info (Markdown)</h3>
          <!-- Ensure the editor is visible and bound to currentMarkdown -->
          <div class="d-flex align-items-center gap-2">
            <button @click="insertSectionMarkdown" title="Insert Section" class="btn btn-link p-0">
              <span class="material-icons">format_color_fill</span>
            </button>
            <button @click="insertQuoteMarkdown" title="Insert Quote" class="btn btn-link p-0">
              <span class="material-icons">format_quote</span>
            </button>

            <button
              @click="insertHeaderImageMarkdown"
              title="Insert Header Image"
              class="btn btn-link p-0"
            >
              <span class="material-icons">image</span>
            </button>
            <button
              @click="insertRightsideImageMarkdown"
              title="Insert Rightside Image"
              class="btn btn-link p-0"
            >
              <span class="material-icons">image</span>
            </button>
            <button
              @click="insertLeftsideImageMarkdown"
              title="Insert Leftside Image"
              class="btn btn-link p-0"
            >
              <span class="material-icons">image</span>
            </button>
            <button @click="insertFancyMarkdown" title="Insert Fancy" class="btn btn-link p-0">
              <span class="material-icons">format_paint</span>
            </button>

            <button
              @click="insertYoutubeVideoMarkdown"
              title="Insert Youtube Video"
              class="btn btn-link p-0"
            >
              <span class="material-icons">video_library</span>
            </button>
          </div>
          <textarea
            v-model="currentMarkdown"
            class="form-control"
            style="width: 100%; height: 200px; font-family: monospace"
          ></textarea>
          <div class="modal-actions">
            <button @click="saveMarkdown">Save</button>
            <button @click="closeMarkdownEditor">Cancel</button>
          </div>
        </div>
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
const saveMessage = ref('') // Add a reactive variable for the success message

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

// Create a funtion for the insertSectionMarkdown to insret a section markdown
const insertSectionMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const sectionMarkdown = `[SECTION | background-color: 'lightyellow'; color: 'black']\n${selectedText}\n[END SECTION]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      sectionMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const sectionMarkdown =
      "[SECTION | background-color: 'lightblue'; color: 'black']\n\nYour content here\n\n[END SECTION]"
    currentMarkdown.value += `\n${sectionMarkdown}\n`
  }
}

// Create a function for the insertQuoteMarkdown to insert a quote markdown
const insertQuoteMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const quoteMarkdown = `[QUOTE | Cited='Author']\n${selectedText}\n[END QUOTE]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      quoteMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const quoteMarkdown = "[QUOTE | Cited='Author']\n\nYour quote here\n\n[END QUOTE]"
    currentMarkdown.value += `\n${quoteMarkdown}\n`
  }
}

const insertHeaderImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const headerImageMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    // Update reactive state
    currentMarkdown.value = `${textBefore}${headerImageMarkdown}${textAfter}`

    // Ensure cursor moves to the end of the inserted markdown
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + headerImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

// Create a function for the insertRightsideImageMarkdown to insert a rightside image markdown
const insertRightsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const rightsideImageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    // Update reactive state
    currentMarkdown.value = `${textBefore}${rightsideImageMarkdown}${textAfter}`

    // Ensure cursor moves to the end of the inserted markdown
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + rightsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}
// Create a function for the insertLeftsideImageMarkdown to insert a leftside image markdown
const insertLeftsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const leftsideImageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`
  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    // Update reactive state
    currentMarkdown.value = `${textBefore}${leftsideImageMarkdown}${textAfter}`

    // Ensure cursor moves to the end of the inserted markdown
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + leftsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}
// Create a function for the insertFancyMarkdown to insert a fancy markdown
const insertFancyMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const fancyMarkdown = `[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    // Update reactive state
    currentMarkdown.value = `${textBefore}${fancyMarkdown}${textAfter}`

    // Ensure cursor moves to the end of the inserted markdown
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + fancyMarkdown.length
      textarea.focus()
    }, 0)
  }
}

// Create a function for the insertYoutubeVideoMarkdown to insert a youtube video markdown
const insertYoutubeVideoMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const videoUrl = prompt('Please enter the YouTube video URL:')

  if (videoUrl) {
    // Extract the video ID from the URL
    const videoIdMatch =
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (videoId) {
      const youtubeMarkdown = `![YOUTUBE scr=${videoUrl}]Title goes here[END YOUTUBE]`

      if (textarea && currentMarkdown.value !== undefined) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const textBefore = currentMarkdown.value.substring(0, start)
        const textAfter = currentMarkdown.value.substring(end)

        // Update reactive state
        currentMarkdown.value = `${textBefore}${youtubeMarkdown}${textAfter}`

        // Ensure cursor moves to the end of the inserted markdown
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + youtubeMarkdown.length
          textarea.focus()
        }, 0)
      }
    } else {
      alert('Invalid YouTube URL. Please try again.')
    }
  }
}

const preprocessMarkdown = (text) => {
  console.log('Input Markdown Text:', text)

  // Updated regex to include text-align for FANCY
  const markdownRegex =
    /(!\[(Header|Rightside|Leftside)(?:-(\d+))?\|(.+?)\]\((.+?)\))|(\[QUOTE\s*\|\s*Cited='(.+?)'\](.*?)\[END QUOTE\])|(\[SECTION\s*\|\s*background-color:\s*'(.+?)';\s*color:\s*'(.+?)'\](.*?)\[END SECTION\])|(\[FANCY\s*\|\s*font-size:\s*([^;]+?);\s*color:\s*([^;]+?)(?:;\s*background-image:\s*url\('([^;]+?)'\))?(?:;\s*text-align:\s*([^;]+?))?\s*\](.*?)\[END FANCY\])|(!\[YOUTUBE scr=(.+?)\](.+?)\[END YOUTUBE\])/gs
  let result = ''
  let currentIndex = 0
  let match

  while ((match = markdownRegex.exec(text)) !== null) {
    const fullMatch = match[0]
    const isImage = match[1]
    const isQuote = match[6]
    const isSection = match[9]
    const isFancy = match[13]
    const isYoutube = match[18]
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
      isYoutube,
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
    } else if (isYoutube) {
      const videoUrl = match[19].trim()
      const title = match[20].trim()

      result += `
        <div class="youtube-section">
          <iframe
            src="${videoUrl.replace('watch?v=', 'embed/')}"
            title="${title}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            class="youtube-iframe"
          ></iframe>
          <p class="youtube-title">${title}</p>
        </div>
      `.trim()
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

const parseYoutubeVideo = (markdown) => {
  const regex = /!\[YOUTUBE scr=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)

  if (match) {
    const videoUrl = match[1].trim()
    const embedUrl = videoUrl.replace('watch?v=', 'embed/') // Convert YouTube URL to embed format
    return embedUrl
  }
  return null
}

const isMarkdownEditorOpen = ref(false)
const currentMarkdown = ref('')
const currentNode = ref(null)

const openMarkdownEditor = (node) => {
  if (!node.info || node.info.trim() === '') {
    alert('This node does not contain any markdown content to edit.')
    return
  }
  currentNode.value = node
  currentMarkdown.value = node.info // Ensure the content is passed to the editor
  isMarkdownEditorOpen.value = true
}

const closeMarkdownEditor = () => {
  isMarkdownEditorOpen.value = false
  currentNode.value = null
  currentMarkdown.value = ''
}

const saveMarkdown = async () => {
  if (currentNode.value) {
    // Update the node's info in the graph data
    currentNode.value.info = currentMarkdown.value

    // Prepare the updated graph data
    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === currentNode.value.id ? { ...node, info: currentMarkdown.value } : node,
      ),
    }

    try {
      // Save the updated graph to the backend with a new version
      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save the graph with history.')
      }

      const result = await response.json()
      console.log('Graph saved successfully:', result)

      // Update the Pinia store with the new graph data
      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      // Show success message
      saveMessage.value = 'Markdown saved and graph updated successfully!'
      setTimeout(() => {
        saveMessage.value = '' // Clear the message after 3 seconds
      }, 3000)
    } catch (error) {
      console.error('Error saving markdown:', error)
      alert('Failed to save the markdown. Please try again.')
    }
  }

  closeMarkdownEditor()
}

const toggleNodeVisibility = (node) => {
  // Toggle the node's visibility property
  node.visible = !node.visible

  // Update the Pinia store
  const updatedGraphData = {
    ...graphData.value,
    nodes: graphData.value.nodes.map((n) =>
      n.id === node.id ? { ...n, visible: node.visible } : n,
    ),
  }
  knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

  // Show success message
  saveMessage.value = 'Node visibility updated successfully!'
  setTimeout(() => {
    saveMessage.value = '' // Clear the message after 3 seconds
  }, 3000)
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

.markdown-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  width: 80%;
  max-width: 600px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.modal-actions button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.modal-actions button:first-child {
  background-color: #007bff;
  color: #fff;
}

.modal-actions button:last-child {
  background-color: #ccc;
  color: #333;
}

.youtube-iframe {
  width: 100%;
  height: 315px;
  border: none;
  border-radius: 8px;
  margin-bottom: 20px;
}

.youtube-section {
  margin: 20px 0;
  text-align: center;
}

.youtube-iframe {
  width: 100%;
  max-width: 560px;
  height: 315px;
  border: none;
  border-radius: 8px;
}

.youtube-title {
  margin-top: 10px;
  font-size: 1rem;
  color: #333;
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
