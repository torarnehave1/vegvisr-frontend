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
            <div v-html="convertToHtml(node.info || 'No additional information available.')"></div>
          </div>
        </template>
        <template v-else-if="node.type === 'map'">
          <!-- Render map nodes -->
          <h3 class="node-label">{{ node.label }}</h3>
          <MapViewer :path="node.path" @gmp-place-changed="onPlaceChanged" />
          <div v-html="convertToHtml(node.info || 'No additional information available.')"></div>
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
import { useUserStore } from '@/stores/userStore'
import MapViewer from '@/components/MapViewer.vue'

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

const insertWorkNoteMarkdown = () => {
  const textarea = document.querySelector('.markdown-editor-modal textarea')
  const workNoteMarkdown = `[WORKNOTE]\n\nYour quote here\n\n[END WORKNOTE]`
  if (textarea && currentMarkdown.value !== undefined) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textBefore = currentMarkdown.value.substring(0, start)
    const textAfter = currentMarkdown.value.substring(end)
    currentMarkdown.value = `${textBefore}${workNoteMarkdown}${textAfter}`
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + workNoteMarkdown.length
      textarea.focus()
    }, 0)
  }
}

const preprocessMarkdown = (text) => {
  console.log('Input Markdown Text:', text)

  const markdownRegex =
    /(!\[(Header|Rightside|Leftside)(?:-(\d+))?\|(.+?)\]\((.+?)\))|(\[QUOTE\s*\|\s*Cited=['"](.+?)['"]\](.*?)\[END QUOTE\])|(\[WNOTE\s*\|\s*Cited=['"](.+?)['"]\](.*?)\[END WNOTE\])|(\[SECTION\s*\|\s*background-color:\s*['"](.+?)['"];\s*color:\s*['"](.+?)['"]\](.*?)\[END SECTION\])|(\[FANCY\s*\|\s*font-size:\s*([^;]+?);\s*color:\s*([^;]+?)(?:;\s*background-image:\s*url\(['"]([^;]+?)['"]\))?(?:;\s*text-align:\s*([^;]+?))?\s*\](.*?)\[END FANCY\])|(!\[YOUTUBE src=(.+?)\](.+?)\[END YOUTUBE\])|(\[WORKNOTE\](.*?)\[END WORKNOTE\])/gs

  let result = ''
  let currentIndex = 0
  let match

  while ((match = markdownRegex.exec(text)) !== null) {
    const fullMatch = match[0]
    const isImage = match[1]
    const isQuote = match[6]
    const isWNote = match[9]
    const isSection = match[12]
    const isFancy = match[16]
    const isYoutube = match[21]
    const isWorkNote = match[24]
    const startIndex = match.index
    const endIndex = startIndex + fullMatch.length

    console.log('Processing match:', {
      fullMatch,
      startIndex,
      endIndex,
      isImage,
      isQuote,
      isWNote,
      isSection,
      isFancy,
      isYoutube,
      isWorkNote,
    })

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

        const remainingText = text.slice(endIndex)
        const paragraphs = remainingText.split(/\n\s*\n/).filter((p) => p.trim())
        const numParagraphs = parseInt(paragraphCount, 10) || 1
        const sideParagraphs = paragraphs
          .slice(0, numParagraphs)
          .map((p) => marked.parse(p))
          .join('')

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
    } else if (isWNote) {
      const cited = match[10]
      const wNoteContent = match[11].trim()

      console.log('Processing WNote:', { cited, wNoteContent, startIndex, endIndex })

      result += `
        <div class="work-note">
          ${marked.parse(wNoteContent)}
          <cite>— ${cited}</cite>
        </div>
      `.trim()
      currentIndex = endIndex
    } else if (isSection) {
      const backgroundColor = match[13]
      const color = match[14]
      const sectionContent = match[15].trim()

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
      const fontSize = match[17].trim()
      const color = match[18].trim()
      const backgroundImage = match[19] ? match[19].trim() : null
      const textAlign = match[20] ? match[20].trim() : 'center'
      const titleContent = match[21].trim()

      console.log('Processing Fancy:', {
        fontSize,
        color,
        backgroundImage,
        textAlign,
        titleContent,
        startIndex,
        endIndex,
      })

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
      const videoUrl = match[22].trim()
      const title = match[23].trim()

      result += `
        <div class="youtube-section">
          <iframe
            src="${parseYoutubeVideo(fullMatch) || videoUrl}"
            title="${title}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
            class="youtube-iframe"
          ></iframe>
          <p class="youtube-title">${title}</p>
        </div>
      `.trim()
      currentIndex = endIndex
    } else if (isWorkNote) {
      const workNoteContent = match[25].trim()
      console.log('Processing WorkNote:', {
        workNoteContent,
        startIndex,
        endIndex,
      })
      result += `
        <div class="work-note">
          ${marked.parse(workNoteContent)}
        </div>
      `.trim()
      currentIndex = endIndex
    }
  }

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

      const result = await response.json()
      console.log('Graph saved successfully:', result)

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

      const result = await response.json()
      console.log('Graph saved successfully:', result)

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

      const result = await response.json()
      console.log('Graph saved successfully:', result)

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

const toggleNodeVisibility = (node) => {
  node.visible = !node.visible

  const updatedGraphData = {
    ...graphData.value,
    nodes: graphData.value.nodes.map((n) =>
      n.id === node.id ? { ...n, visible: node.visible } : n,
    ),
  }
  knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

  saveMessage.value = 'Node visibility updated successfully!'
  setTimeout(() => {
    saveMessage.value = ''
  }, 3000)
}

const onPlaceChanged = (place) => {
  console.log('Place changed event received in GraphViewer:', place)
  // Handle the place change logic here if needed
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
</style>
