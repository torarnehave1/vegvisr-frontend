<template>
  <div class="graph-viewer container">
    <!-- Print/Save as PDF Buttons -->
    <button @click="printGraph" class="btn btn-primary mb-3">Print</button>
    <button @click="saveAsHtml2Pdf" class="btn btn-warning mb-3 ms-2">Save as PDF</button>
    <button
      v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
      @click="saveToMystmkraFromMenu"
      class="btn btn-info mb-3 ms-2"
    >
      Save to Mystmkra.io
    </button>
    <!-- Success Message at the top -->
    <div v-if="saveMessage" class="alert alert-success text-center" role="alert">
      {{ saveMessage }}
    </div>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="graph-container">
      <!-- Render only nodes with visible=true -->
      <div v-for="node in graphData.nodes.filter((n) => n.visible !== false)" :key="node.id">
        <div class="node-content-inner">
          <template v-if="node.type === 'markdown-image'">
            <div v-html="convertToHtml(node.label)"></div>
          </template>
          <template v-else-if="node.type === 'background'">
            <div class="image-wrapper">
              <img :src="node.label" alt="Background Image" />
            </div>
          </template>
          <template v-else-if="node.type === 'REG'">
            <iframe
              src="https://www.vegvisr.org/register?embed=true"
              style="width: 100%; height: 500px; border: none"
            ></iframe>
          </template>
          <template v-else-if="node.type === 'youtube-video'">
            <!-- Render YouTube video nodes -->
            <div class="youtube-section">
              <h3 class="youtube-title">{{ parseYoutubeVideoTitle(node.label) }}</h3>
              <iframe
                :src="parseYoutubeVideo(node.label)"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen
                class="youtube-iframe"
              ></iframe>
              <div class="node-info">
                <button @click="editYoutubeVideo(node)">Edit Video</button>
                <button @click="editYoutubeTitle(node)">Edit Title</button>
                <button @click="openMarkdownEditor(node)">Edit Info</button>
                <div
                  v-html="convertToHtml(node.info || 'No additional information available.')"
                ></div>
              </div>
            </div>
          </template>
          <template v-else-if="node.type === 'worknote'">
            <!-- Render worknote nodes -->
            <div class="work-note" :style="{ backgroundColor: node.color || '#FFD580' }">
              <h3 class="node-label">{{ node.label }}</h3>
              <button
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                @click="openMarkdownEditor(node)"
              >
                Edit Info
              </button>
              <div
                v-html="convertToHtml(node.info || 'No additional information available.')"
              ></div>
            </div>
          </template>
          <template v-else-if="node.type === 'map'">
            <!-- Render map nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <MapViewer
              v-if="node.path"
              :path="node.path"
              :map-id="node.mapId || 'efe3a8a8c093a07cf97c4b3c'"
              @place-changed="onPlaceChanged"
            />
            <div v-else class="text-danger">No map path provided for this node.</div>
            <div v-html="convertToHtml(node.info || 'No additional information available.')"></div>
          </template>
          <template v-else-if="node.type === 'timeline'">
            <!-- Render timeline nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <TimelineChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'chart'">
            <!-- Render chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <BarChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'piechart'">
            <!-- Render pie chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <PieChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'linechart'">
            <!-- Render line chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <LineChart :data="node.info" :xLabel="node.xLabel" :yLabel="node.yLabel" />
          </template>
          <template v-else-if="node.type === 'swot'">
            <!-- Render SWOT diagram nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <SWOTDiagram :data="node.info" />
          </template>
          <template v-else-if="node.type === 'bubblechart'">
            <!-- Render bubble chart nodes -->
            <h3 class="node-label">{{ node.label }}</h3>
            <BubbleChart :data="node.info" />
          </template>
          <template v-else-if="node.type === 'mermaid-diagram'">
            <h3 class="node-label">{{ node.label }}</h3>
            <Mermaid :code="node.info" />
          </template>
          <template v-else>
            <!-- Render other node types -->
            <h3 class="node-label">{{ node.label }}</h3>
            <div class="node-info">
              <button
                v-if="
                  userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
                "
                @click="openMarkdownEditor(node)"
              >
                Edit Info
              </button>
              <div
                v-html="convertToHtml(node.info || 'No additional information available.')"
              ></div>
            </div>
          </template>
        </div>
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
            <button @click="insertWNoteMarkdown" title="Insert Work Note" class="btn btn-link p-0">
              <span class="material-icons">note</span>
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
            <!-- Add AI Assist button to the modal toolbar -->
            <button
              v-if="
                userStore.loggedIn && ['Admin', 'Editor', 'Superadmin'].includes(userStore.role)
              "
              @click="openAIAssistInEditor"
              title="AI Assist"
              class="btn btn-link p-0"
              style="
                background: #6f42c1;
                color: #fff;
                border-radius: 4px;
                border: none;
                padding: 5px 10px;
              "
            >
              <span class="material-icons">smart_toy</span>
            </button>
          </div>
          <textarea
            v-model="currentMarkdown"
            class="form-control"
            style="width: 100%; height: 200px; font-family: monospace"
            ref="markdownEditorTextarea"
          ></textarea>
          <div class="modal-actions">
            <button @click="saveMarkdown">Save</button>
            <button @click="closeMarkdownEditor">Cancel</button>
            <button
              v-if="userStore.loggedIn && ['Admin', 'Superadmin'].includes(userStore.role)"
              @click="saveToMystmkra"
              class="btn btn-info"
            >
              Save to Mystmkra.io
            </button>
          </div>
        </div>
      </div>

      <!-- AI Assist Modal -->
      <div v-if="isAIAssistOpen" class="ai-assist-modal">
        <div class="ai-assist-content">
          <button class="ai-assist-close" @click="closeAIAssist" title="Close">&times;</button>
          <h4>Vegvisr AI Assist</h4>
          <div v-if="!aiAssistMode">
            <div class="mb-2">
              <textarea
                v-model="aiAssistQuestion"
                class="form-control mb-1 ai-assist-questionarea"
                placeholder="Ask a question..."
                rows="3"
              />
              <button
                class="btn btn-outline-success"
                @click="runAIAssist('ask')"
                :disabled="!aiAssistQuestion"
              >
                Ask
              </button>
            </div>
            <div class="ai-assist-btn-row">
              <button class="btn btn-outline-primary ai-assist-btn" @click="runAIAssist('expand')">
                Elaborate on the text
              </button>
              <button class="btn btn-outline-warning ai-assist-btn" @click="runAIAssist('image')">
                Generate Header Image
              </button>
            </div>
          </div>
          <div v-else>
            <div v-if="aiAssistLoading" class="text-center my-3">
              <span class="spinner-border spinner-border-sm"></span> Loading AI response...
            </div>
            <div v-else-if="aiAssistResult">
              <div class="alert alert-info">{{ aiAssistResult }}</div>
              <button class="btn btn-primary" @click="insertAIAssistResultToEditor">
                Insert at Cursor
              </button>
            </div>
            <div v-else-if="aiAssistImageUrl">
              <img
                :src="aiAssistImageUrl"
                alt="AI Header"
                style="max-width: 100%; border-radius: 6px; margin-bottom: 10px"
              />
              <button class="btn btn-primary" @click="insertAIAssistResultToEditor">
                Insert as Header Image
              </button>
            </div>
            <div v-if="aiAssistError" class="alert alert-danger">{{ aiAssistError }}</div>
            <button class="btn btn-secondary mt-2" @click="closeAIAssist">Back</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import MapViewer from '@/components/MapViewer.vue'
import TimelineChart from '@/components/TimelineChart.vue'
import BarChart from '@/components/BarChart.vue'
import PieChart from '@/components/PieChart.vue'
import LineChart from '@/components/LineChart.vue'
import SWOTDiagram from '@/components/SWOTDiagram.vue'
import BubbleChart from '@/components/BubbleChart.vue'
import html2pdf from 'html2pdf.js'
import Mermaid from '@/components/Mermaid.vue'
import mermaid from 'mermaid'

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  logLevel: 'error',
})

const graphData = ref({ nodes: [], edges: [] })
const loading = ref(true)
const error = ref(null)
const saveMessage = ref('')
const knowledgeGraphStore = useKnowledgeGraphStore()
const userStore = useUserStore()

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

    const uniqueNodes = []
    const seenIds = new Set()
    for (const node of data.nodes) {
      if (!seenIds.has(node.id)) {
        uniqueNodes.push({
          ...node,
          position: node.position || { x: 0, y: 0 }, // Ensure position is preserved
          visible: node.visible !== false,
        })
        seenIds.add(node.id)
      }
    }

    graphData.value = {
      ...data,
      nodes: uniqueNodes.filter((node) => node.visible !== false),
    }

    // Update the store with the graph data
    knowledgeGraphStore.updateGraph(
      graphData.value.nodes.map((node) => ({
        ...node,
        position: node.position || { x: 0, y: 0 },
      })),
      graphData.value.edges,
    )
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

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

const insertWNoteMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const wNoteMarkdown = `[WNOTE | Cited='Author']\n${selectedText}\n[END WNOTE]`
    currentMarkdown.value =
      textarea.value.substring(0, textarea.selectionStart) +
      wNoteMarkdown +
      textarea.value.substring(textarea.selectionEnd)
  } else {
    const wNoteMarkdown = "[WNOTE | Cited='Author']\n\nYour work note here\n\n[END WNOTE]"
    currentMarkdown.value += `\n${wNoteMarkdown}\n`
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

    currentMarkdown.value = `${textBefore}${headerImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + headerImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertRightsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const rightsideImageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${rightsideImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + rightsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertLeftsideImageMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const leftsideImageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`
  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${leftsideImageMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + leftsideImageMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertFancyMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const fancyMarkdown = `[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]`

  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)

    currentMarkdown.value = `${textBefore}${fancyMarkdown}${textAfter}`

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + fancyMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const insertYoutubeVideoMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const videoUrl = prompt('Please enter the YouTube video URL:')

  if (videoUrl) {
    const videoIdMatch =
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (videoId) {
      const youtubeMarkdown = `![YOUTUBE src=https://www.youtube.com/embed/${videoId}]Title goes here[END YOUTUBE]`

      if (textarea && currentMarkdown.value !== undefined) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const textBefore = currentMarkdown.value.substring(0, start)
        const textAfter = currentMarkdown.value.substring(end)

        currentMarkdown.value = `${textBefore}${youtubeMarkdown}${textAfter}`

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

function preprocessPageBreaks(markdown) {
  return markdown.replace(/\[pb\]/gi, '<div class="page-break"></div>')
}

const preprocessMarkdown = (text) => {
  // First, process [pb] page breaks
  let processedText = preprocessPageBreaks(text)

  // Process fancy titles
  processedText = processedText.replace(
    /\[FANCY\s*\|([^\]]+)\]([\s\S]*?)\[END FANCY\]/g,
    (match, style, content) => {
      // Convert style string to inline CSS
      const css = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [k, v] = s.split(':').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
          return k && v ? `${k}:${v}` : ''
        })
        .join(';')
      return `<div class="fancy-title" style="${css}">${content.trim()}</div>`
    },
  )

  // Process quotes
  processedText = processedText.replace(
    /\[QUOTE\s*\|([^\]]+)\]([\s\S]*?)\[END QUOTE\]/g,
    (match, style, content) => {
      const cite = style.split('=')[1]?.replace(/['"]/g, '') || 'Unknown'
      const processedContent = marked.parse(content.trim())
      return `<div class="fancy-quote">${processedContent}<cite>— ${cite}</cite></div>`
    },
  )

  // Then process sections
  processedText = processedText.replace(
    /\[SECTION\s*\|([^\]]+)\]([\s\S]*?)\[END SECTION\]/g,
    (match, style, content) => {
      // Convert style string to inline CSS
      const css = style
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const [k, v] = s.split(':').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
          return k && v ? `${k}:${v}` : ''
        })
        .join(';')
      // Process the content through marked first to handle any markdown inside the section
      const processedContent = marked.parse(content.trim())
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )

  // Then process images
  const markdownRegex = /!\[(Header|Rightside|Leftside)(?:-(\d+))?\|(.+?)\]\((.+?)\)/g
  let result = ''
  let lastIndex = 0

  let match
  while ((match = markdownRegex.exec(processedText)) !== null) {
    const [, type, paragraphCount, styles, url] = match

    // Add text before the match
    if (lastIndex < match.index) {
      result += marked.parse(processedText.slice(lastIndex, match.index))
    }

    // Helper to extract style values robustly (with or without quotes)
    const getStyleValue = (styleString, key, fallback) => {
      const regex = new RegExp(key + ': *[\'"]?([^;\'"]+)[\'"]?', 'i')
      const found = styleString.match(regex)
      return found ? found[1].trim() : fallback
    }

    if (type === 'Header') {
      const height = getStyleValue(styles, 'height', 'auto')
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')

      result += `
        <div class="header-image-container">
          <img src="${url}" alt="Header Image" class="header-image" style="object-fit: ${objectFit}; object-position: ${objectPosition}; height: ${height !== 'auto' ? height + 'px' : height}; border-radius: 8px;" />
        </div>
      `.trim()
    } else if (type === 'Rightside' || type === 'Leftside') {
      const width = getStyleValue(styles, 'width', '20%')
      const height = getStyleValue(styles, 'height', '200px')
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')

      // Get text after the markdown
      const remainingText = processedText.slice(match.index + match[0].length).trim()
      const paragraphs = remainingText.split(/\n\s*\n/).filter((p) => p.trim())
      const numParagraphs = parseInt(paragraphCount, 10) || 1
      const sideParagraphs = paragraphs
        .slice(0, numParagraphs)
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

      // Skip the processed paragraphs in the remaining content
      lastIndex =
        match.index + match[0].length + paragraphs.slice(0, numParagraphs).join('\n\n').length
    }

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last match
  if (lastIndex < processedText.length) {
    result += marked.parse(processedText.slice(lastIndex))
  }

  return result.trim()
}

const convertToHtml = (text) => {
  return preprocessMarkdown(text)
}

const parseYoutubeVideo = (markdown) => {
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)

  if (match) {
    let videoUrl = match[1].trim()
    if (videoUrl.includes('youtube.com/embed/')) {
      return videoUrl.split('?')[0]
    } else if (videoUrl.includes('youtu.be/')) {
      const videoId = videoUrl.split('youtu.be/')[1].split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    } else if (videoUrl.includes('youtube.com/watch?v=')) {
      const videoId = videoUrl.split('watch?v=')[1].split('&')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    console.warn('Invalid YouTube URL:', videoUrl)
    return null
  }
  console.warn('No match for YouTube markdown:', markdown)
  return null
}

const parseYoutubeVideoTitle = (markdown) => {
  const regex = /!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/
  const match = markdown.match(regex)
  return match ? match[2].trim() : 'Untitled Video'
}

const editYoutubeVideo = async (node) => {
  const currentLabel = node.label
  const match = currentLabel.match(/!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/)
  if (!match) {
    alert('Invalid YouTube markdown format.')
    return
  }

  const currentUrl = match[1].trim()
  const currentTitle = match[2].trim()
  const newUrl = prompt('Enter new YouTube share link or embed URL:', currentUrl)

  if (newUrl && newUrl !== currentUrl) {
    const videoIdMatch =
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/) ||
      newUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (!videoId) {
      alert('Invalid YouTube URL. Please use a valid share link or embed URL.')
      return
    }

    node.label = `![YOUTUBE src=https://www.youtube.com/embed/${videoId}]${currentTitle}[END YOUTUBE]`
    node.bibl = [`[Source: YouTube video URL, e.g., https://youtu.be/${videoId}]`]

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((n) =>
        n.id === node.id ? { ...n, label: node.label, bibl: node.bibl } : n,
      ),
    }

    try {
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

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'YouTube video updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving video:', error)
      alert('Failed to save the video. Please try again.')
    }
  }
}

const editYoutubeTitle = async (node) => {
  const currentLabel = node.label
  const match = currentLabel.match(/!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\]/)
  if (!match) {
    alert('Invalid YouTube markdown format.')
    return
  }

  const currentTitle = match[2].trim()
  const newTitle = prompt('Enter new video title:', currentTitle)

  if (newTitle && newTitle !== currentTitle) {
    node.label = `![YOUTUBE src=${match[1]}]${newTitle}[END YOUTUBE]`

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((n) => (n.id === node.id ? { ...n, label: node.label } : n)),
    }

    try {
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

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'Video title updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving title:', error)
      alert('Failed to save the title. Please try again.')
    }
  }
}

const isMarkdownEditorOpen = ref(false)
const currentMarkdown = ref('')
const currentNode = ref(null)
const markdownEditorTextarea = ref(null)

const openMarkdownEditor = (node) => {
  if (!node.info || node.info.trim() === '') {
    alert('This node does not contain any markdown content to edit.')
    return
  }
  currentNode.value = node
  currentMarkdown.value = node.info
  isMarkdownEditorOpen.value = true
}

const closeMarkdownEditor = () => {
  isMarkdownEditorOpen.value = false
  currentNode.value = null
  currentMarkdown.value = ''
}

const saveMarkdown = async () => {
  if (currentNode.value) {
    currentNode.value.info = currentMarkdown.value

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === currentNode.value.id ? { ...node, info: currentMarkdown.value } : node,
      ),
    }

    try {
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

      await response.json()

      knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

      saveMessage.value = 'Markdown saved and graph updated successfully!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 3000)
    } catch (error) {
      console.error('Error saving markdown:', error)
      alert('Failed to save the markdown. Please try again.')
    }
  }

  closeMarkdownEditor()
}

const onPlaceChanged = (place) => {
  if (place && place.location) {
    // You can add additional handling here if needed
  }
}

const printGraph = () => {
  window.print()
}

const saveAsHtml2Pdf = () => {
  const element = document.querySelector('.graph-container')
  if (!element) {
    alert('Graph content not found!')
    return
  }

  const opt = {
    margin: 0.5,
    filename: 'graph-export.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: true,
      onclone: (clonedDoc) => {
        // Hide all .node-info button elements in the cloned DOM
        const buttons = clonedDoc.querySelectorAll('.node-info button')
        buttons.forEach((btn) => (btn.style.display = 'none'))

        // Add strong page break styles and keep .section together
        const style = clonedDoc.createElement('style')
        style.textContent = `
          .page-break {
            display: block !important;
            width: 100% !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: none !important;
            page-break-before: always !important;
            page-break-after: always !important;
            break-before: page !important;
            break-after: page !important;
          }
          .section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          table, tr, td, th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        `
        clonedDoc.head.appendChild(style)
      },
    },
    jsPDF: {
      unit: 'in',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      before: '.page-break',
    },
  }

  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      console.log('PDF generation completed')
    })
    .catch((err) => {
      console.error('Error generating PDF:', err)
    })
}

const saveToMystmkra = async () => {
  if (!userStore.emailVerificationToken) {
    saveMessage.value = 'No API token found for this user.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
    return
  }
  const mystmkraUserId = userStore.mystmkraUserId
  if (!mystmkraUserId || !/^[a-f\d]{24}$/i.test(mystmkraUserId)) {
    saveMessage.value =
      'Mystmkra User ID is missing or invalid. Please set it in your profile before saving.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
    return
  }
  const content = currentNode.value?.info || ''
  const title = currentNode.value?.label || 'Untitled'
  closeMarkdownEditor()
  saveMessage.value = 'Saving to Mystmkra.io...'
  try {
    const response = await fetch('https://api.vegvisr.org/mystmkrasave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        content,
        title,
        tags: [],
        documentId: graphData.value.metadata?.mystmkraDocumentId || null,
        userId: mystmkraUserId,
      }),
    })
    if (response.ok) {
      const data = await response.json()
      console.log('Mystmkra Save Response:', JSON.stringify(data, null, 2))
      if (currentNode.value) {
        currentNode.value.mystmkraUrl = data.data.fileUrl
        currentNode.value.mystmkraDocumentId = data.data.documentId

        const updatedGraphData = {
          ...graphData.value,
          nodes: graphData.value.nodes.map((node) =>
            node.id === currentNode.value.id ? { ...node, ...currentNode.value } : node,
          ),
          metadata: {
            ...graphData.value.metadata,
            mystmkraDocumentId: data.data.documentId,
            mystmkraUrl: data.data.fileUrl,
            mystmkraNodeId: currentNode.value.id,
          },
        }

        const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: updatedGraphData,
            override: true,
          }),
        })

        if (!saveResponse.ok) {
          throw new Error('Failed to save the graph with history.')
        }

        knowledgeGraphStore.updateGraphFromJson(updatedGraphData)
      }

      saveMessage.value = graphData.value.metadata?.mystmkraDocumentId
        ? 'Updated existing document on Mystmkra.io!'
        : 'Created new document on Mystmkra.io!'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    } else {
      const text = await response.text()
      saveMessage.value = 'Failed to save to Mystmkra.io. ' + text
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
    }
  } catch (err) {
    saveMessage.value = 'Error saving to Mystmkra.io: ' + err.message
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
  }
}

function saveToMystmkraFromMenu() {
  let content = ''
  let title = ''
  let targetNode = null
  if (isMarkdownEditorOpen.value && currentNode.value) {
    content = currentMarkdown.value
    title = currentNode.value.label || 'Untitled'
    targetNode = currentNode.value
  } else {
    const node = (graphData.value.nodes || []).find((n) => n.visible !== false)
    if (node && node.info) {
      content = node.info
      title = node.label || 'Untitled'
      targetNode = node
    }
  }

  if (content) {
    if (!userStore.emailVerificationToken) {
      saveMessage.value = 'No API token found for this user.'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      return
    }
    const mystmkraUserId = userStore.mystmkraUserId
    if (!mystmkraUserId || !/^[a-f\d]{24}$/i.test(mystmkraUserId)) {
      saveMessage.value =
        'Mystmkra User ID is missing or invalid. Please set it in your profile before saving.'
      setTimeout(() => {
        saveMessage.value = ''
      }, 2000)
      return
    }
    saveMessage.value = 'Saving to Mystmkra.io...'
    fetch('https://api.vegvisr.org/mystmkrasave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        content,
        title,
        tags: [],
        documentId: graphData.value.metadata?.mystmkraDocumentId || null,
        userId: mystmkraUserId,
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json()
          console.log('Mystmkra Save Response:', JSON.stringify(data, null, 2))
          if (targetNode) {
            targetNode.mystmkraUrl = data.data.fileUrl
            targetNode.mystmkraDocumentId = data.data.documentId

            const updatedGraphData = {
              ...graphData.value,
              nodes: graphData.value.nodes.map((node) =>
                node.id === targetNode.id ? { ...node, ...targetNode } : node,
              ),
              metadata: {
                ...graphData.value.metadata,
                mystmkraDocumentId: data.data.documentId,
                mystmkraUrl: data.data.fileUrl,
                mystmkraNodeId: targetNode.id,
              },
            }

            const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: knowledgeGraphStore.currentGraphId,
                graphData: updatedGraphData,
                override: true,
              }),
            })

            if (!saveResponse.ok) {
              throw new Error('Failed to save the graph with history.')
            }

            knowledgeGraphStore.updateGraphFromJson(updatedGraphData)
          }

          saveMessage.value = graphData.value.metadata?.mystmkraDocumentId
            ? 'Updated existing document on Mystmkra.io!'
            : 'Created new document on Mystmkra.io!'
          setTimeout(() => {
            saveMessage.value = ''
          }, 2000)
        } else {
          response.text().then((text) => {
            saveMessage.value = 'Failed to save to Mystmkra.io. ' + text
            setTimeout(() => {
              saveMessage.value = ''
            }, 2000)
          })
        }
      })
      .catch((err) => {
        saveMessage.value = 'Error saving to Mystmkra.io: ' + err.message
        setTimeout(() => {
          saveMessage.value = ''
        }, 2000)
      })
  } else {
    saveMessage.value = 'No visible node with markdown content to save.'
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
  }
}

// --- AI Assist UI State ---
const isAIAssistOpen = ref(false)
const aiAssistMode = ref('') // 'expand', 'ask', 'image'
const aiAssistQuestion = ref('')
const aiAssistLoading = ref(false)
const aiAssistResult = ref('')
const aiAssistImageUrl = ref('')
const aiAssistError = ref('')
let aiAssistNode = null

function closeAIAssist() {
  isAIAssistOpen.value = false
  aiAssistMode.value = ''
  aiAssistQuestion.value = ''
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''
  aiAssistNode = null
}

async function runAIAssist(mode) {
  aiAssistMode.value = mode
  aiAssistLoading.value = true
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''

  if (mode === 'image') {
    // Real API call for image generation
    try {
      const prompt =
        String(aiAssistNode?.info ?? '').slice(0, 300) ||
        'A beautiful, wide, horizontal header image'
      const response = await fetch('https://api.vegvisr.org/generate-header-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'API error')
      }
      const data = await response.json()
      aiAssistResult.value = data.markdown || '[No image generated]'
      aiAssistImageUrl.value = data.url || ''
    } catch (err) {
      aiAssistError.value = 'Error: ' + (err.message || err)
    } finally {
      aiAssistLoading.value = false
    }
    return
  }

  // Real API call for 'expand' and 'ask'
  try {
    const payload = {
      context: String(aiAssistNode?.info ?? ''),
      ...(mode === 'ask' && aiAssistQuestion
        ? { question: String(aiAssistQuestion?.value ?? aiAssistQuestion) }
        : {}),
    }
    const endpoint =
      mode === 'ask' ? 'https://api.vegvisr.org/grok-ask' : 'https://api.vegvisr.org/grok-elaborate'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'API error')
    }
    const data = await response.json()
    aiAssistResult.value = data.result || '[No response from AI]'
  } catch (err) {
    aiAssistError.value = 'Error: ' + (err.message || err)
  } finally {
    aiAssistLoading.value = false
  }
}

function openAIAssistInEditor() {
  isAIAssistOpen.value = true
  aiAssistMode.value = ''
  aiAssistQuestion.value = ''
  aiAssistResult.value = ''
  aiAssistImageUrl.value = ''
  aiAssistError.value = ''
  aiAssistNode = currentNode.value // Use the node being edited
}

function insertAIAssistResultToEditor() {
  const textarea = markdownEditorTextarea.value
  if (!textarea) return
  let insertText = ''
  if (aiAssistMode.value === 'expand' || aiAssistMode.value === 'ask') {
    insertText = aiAssistResult.value
  } else if (aiAssistMode.value === 'image') {
    insertText = aiAssistResult.value
  }
  // Insert at cursor position
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = currentMarkdown.value.substring(0, start)
  const after = currentMarkdown.value.substring(end)
  currentMarkdown.value = before + insertText + after
  // Move cursor after inserted text
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length
    textarea.focus()
  })
  closeAIAssist()
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
  max-width: 1200px;
  margin: 0 auto;
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
  max-width: 100%;
  overflow: hidden;
  padding: 0 20px;
  box-sizing: border-box;
}

/* Remove or override previous image rules that set width: 100% for images inside p/header containers */
.graph-container img {
  display: block;
  max-width: 100%;
  width: auto;
  height: auto;
  margin: 0 auto 20px auto;
  border-radius: 8px;
  object-fit: cover;
  box-sizing: border-box;
}

/* For header images, if you use a class or alt text, make them full width inside the card, but not outside the card's padding */
.node img.header-image,
.node p:has(img[alt*='Header']) img {
  width: 100%;
  max-width: 100%;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  margin: 0 0 20px 0;
  box-sizing: border-box;
}

/* Remove any special container rules that set width: 100vw or override the card's padding */
.graph-container p:has(img[alt*='Header']),
.graph-container p:has(img[alt*='Rightside']),
.graph-container p:has(img[alt*='Leftside']) {
  width: 100%;
  max-width: 100%;
  margin: 0 0 20px 0;
  overflow: hidden;
  padding: 0;
  box-sizing: border-box;
}

.node {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  overflow: hidden;
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

.node-info button {
  margin-right: 10px;
  padding: 5px 10px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.node-info button:hover {
  background-color: #0056b3;
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
  max-height: 250px;
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

.work-note {
  background-color: #ffd580;
  color: #333;
  font-size: 14px;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  padding: 10px;
  margin: 10px 0;
  border-left: 5px solid #ccc;
  border-radius: 4px;
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

.work-note cite {
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
  padding: 0.5em;
  margin: 1em 0;
  border-radius: 4px;
  box-sizing: border-box;
  font-weight: bold;
  text-align: center;
  background-size: cover;
  background-position: center;
  line-height: 1.2;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
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

.youtube-section {
  margin: 20px 0;
  text-align: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
}

.youtube-title {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #333;
  font-weight: bold;
}

.youtube-iframe {
  width: 100%;
  max-width: 560px;
  height: 315px;
  border: none;
  border-radius: 8px;
  margin-bottom: 10px;
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
    width: 200px;
    min-width: 0 !important;
  }
}

.node-content-inner {
  /* Remove left/right padding for better image centering */
  box-sizing: border-box;
}
.node-content-inner img {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  margin-bottom: 20px;
}

.image-wrapper {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
}
.image-wrapper img {
  width: 90% !important;
  max-width: 90% !important;
  display: block;
  object-fit: cover;
  border-radius: 8px;
  box-sizing: border-box;
  margin: 0 auto;
}

.ai-assist-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.ai-assist-content {
  background: #fff;
  padding: 24px 20px;
  border-radius: 10px;
  min-width: 320px;
  max-width: 95vw;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
  text-align: center;
  position: relative;
}
.ai-assist-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 2rem;
  color: #888;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
}
.ai-assist-close:hover {
  color: #333;
}
.ai-assist-questionarea {
  min-width: 220px;
  min-height: 60px;
  resize: vertical;
  margin-bottom: 8px;
}
.ai-assist-btn-row {
  display: flex;
  flex-direction: row;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}
.ai-assist-btn {
  flex: 1 1 0;
  min-width: 0;
  max-width: 100%;
  white-space: normal;
}
</style>

<!-- Global print styles (not scoped) -->
<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  .graph-viewer,
  .graph-viewer * {
    visibility: visible !important;
  }
  .graph-viewer {
    position: absolute !important;
    left: 0;
    top: 0;
    width: 100vw;
    background: #fff !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .btn,
  .alert,
  .modal,
  .navbar,
  .sidebar,
  .footer {
    display: none !important;
  }
  .node-info button {
    display: none !important;
  }
}
</style>
