<template>
  <div class="gnew-default-node" :class="nodeTypeClass">
    <!-- Hover Toolbar for Fulltext Nodes -->
    <div v-if="node.type === 'fulltext'" class="node-hover-toolbar">
      <button
        v-if="showControls"
        @click="openNodeSEO"
        class="toolbar-btn seo-btn"
        title="SEO Settings for this node"
      >
        🔍
      </button>
      <button
        @click="openNodeShare"
        class="toolbar-btn share-btn"
        title="Share this node"
      >
        🔗
      </button>
    </div>

    <!-- Node Header (Logged-in Users Only) -->
    <div v-if="showControls && node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <!-- Node Type Badge in Header -->
        <div v-if="node.type && node.type !== 'default'" class="node-type-badge-inline">
          {{ nodeTypeDisplay }}
        </div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Node Content -->
    <div v-if="nodeContent" class="node-content">
      <div v-for="(contentPart, index) in parsedContent" :key="index">
        <!-- Regular content -->
        <div v-if="contentPart.type === 'text'" v-html="contentPart.content"></div>

        <!-- FANCY element -->
        <div
          v-else-if="contentPart.type === 'FANCY'"
          class="fancy-element"
          :style="contentPart.styles"
        >
          <div class="fancy-content" v-html="contentPart.content"></div>
        </div>

        <!-- SECTION element -->
        <div
          v-else-if="contentPart.type === 'SECTION'"
          class="section-element"
          :style="contentPart.styles"
        >
          <div class="section-content" v-html="contentPart.content"></div>
        </div>

        <!-- IMAGEQUOTE element -->
        <div
          v-else-if="contentPart.type === 'IMAGEQUOTE'"
          class="imagequote-element"
          :style="convertStylesToString(contentPart.containerStyles)"
        >
          <div class="imagequote-content" :style="convertStylesToString(contentPart.contentStyles)">
            {{ contentPart.content }}
          </div>
          <div
            v-if="contentPart.citation"
            class="imagequote-citation"
            style="position: absolute; bottom: 10px; right: 15px; font-size: 0.9em; opacity: 0.9"
          >
            — {{ contentPart.citation }}
          </div>
          <!-- Attribution overlay for IMAGEQUOTE background images -->
          <div
            v-if="contentPart.attribution && contentPart.attribution.requires_attribution"
            class="imagequote-attribution-overlay"
          >
            <div class="imagequote-attribution-text">
              <span v-if="contentPart.attribution.provider === 'unsplash'">
                Photo by
                <a
                  :href="`${contentPart.attribution.photographer_url}?utm_source=vegvisr&utm_medium=referral`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="photographer-link"
                >
                  {{ contentPart.attribution.photographer }}
                </a>
                on
                <a
                  href="https://unsplash.com/?utm_source=vegvisr&utm_medium=referral"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="provider-link"
                >
                  Unsplash
                </a>
              </span>
              <span v-else-if="contentPart.attribution.provider === 'pexels'">
                Photo by
                <a
                  :href="contentPart.attribution.photographer_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="photographer-link"
                >
                  {{ contentPart.attribution.photographer }}
                </a>
                on
                <a
                  :href="contentPart.attribution.pexels_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="provider-link"
                >
                  Pexels
                </a>
              </span>
              <span v-else-if="contentPart.attribution.photographer && !['Portfolio', 'Unknown', ''].includes(contentPart.attribution.photographer.trim())">
                Photo by {{ contentPart.attribution.photographer }}
              </span>
            </div>
          </div>
        </div>

        <!-- QUOTE element -->
        <div
          v-else-if="contentPart.type === 'QUOTE'"
          class="quote-element"
          :style="contentPart.styles"
        >
          <div class="quote-content" v-html="contentPart.content"></div>
          <div v-if="contentPart.citation" class="quote-citation">— {{ contentPart.citation }}</div>
        </div>

        <!-- FLEXBOX-GRID element using dedicated component -->
        <FlexboxGrid
          v-else-if="contentPart.type === 'flexbox-grid'"
          :content="contentPart.content"
          :nodeId="node.id"
          :nodeContent="node.info || ''"
        />

        <!-- FLEXBOX-CARDS element using dedicated component -->
        <FlexboxCards
          v-else-if="contentPart.type === 'flexbox-cards'"
          :content="contentPart.content"
          :columnCount="contentPart.columnCount"
          :nodeId="node.id"
          :nodeContent="node.info || ''"
        />

        <!-- FLEXBOX-GALLERY element using dedicated component -->
        <FlexboxGallery
          v-else-if="contentPart.type === 'flexbox-gallery'"
          :content="contentPart.content"
          :nodeId="node.id"
          :nodeContent="node.info || ''"
        />

        <!-- Unknown formatted element -->
        <div v-else-if="contentPart.type === 'unknown'" class="unknown-element">
          <div class="unknown-header">
            <span class="unknown-type">[{{ contentPart.elementType }}]</span>
            <small class="text-muted">Unrecognized element type</small>
          </div>
          <div class="unknown-content">{{ contentPart.rawContent }}</div>
        </div>
      </div>
    </div>

    <!-- Empty State (Logged-in Users Only) -->
    <div v-else-if="!node.label && showControls" class="node-empty-state">
      <p class="text-muted">Empty node - no content available</p>
      <button v-if="!isPreview" @click="editNode" class="btn btn-sm btn-primary">
        Add Content
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import FlexboxGrid from '@/components/FlexboxGrid.vue'
import FlexboxCards from '@/components/FlexboxCards.vue'
import FlexboxGallery from '@/components/FlexboxGallery.vue'

// Configure marked to support GitHub Flavored Markdown (GFM) including tables
// For marked v15+, tables are included by default with gfm: true
marked.setOptions({
  breaks: false, // Set to false for proper table parsing
  gfm: true,
  pedantic: false,
  sanitize: false
})

// Test marked table parsing capability
const testTable = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`

const testResult = marked(testTable)
console.log('🧪 Table test result:', testResult)
if (testResult.includes('<table>')) {
  console.log('✅ Marked table parsing is working')
} else {
  console.log('❌ Marked table parsing failed, output:', testResult)
}

// Store access
const userStore = useUserStore()

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'open-node-seo', 'open-node-share'])

// Content parsing function - matches GraphViewer preprocessMarkdown
const parseFormattedElements = (text) => {
  // Follow the exact same order as GraphViewer preprocessMarkdown
  let processedText = text

  // DEBUG: Log the raw input to understand what we're working with
  console.log('🔍 RAW INPUT to parseFormattedElements:', text.substring(0, 500))

  // Fix line break issues that break markdown parsing
  // Ensure proper line breaks before headers and around content
  processedText = processedText
    .replace(/\.#/g, '.\n\n#')  // Fix "content.#" -> "content.\n\n#"
    .replace(/([.!?])\s*([#*|-])/g, '$1\n\n$2')  // Ensure line breaks before markdown elements
    .replace(/\n{3,}/g, '\n\n')  // Clean up excessive line breaks

  console.log('🔄 AFTER line break fixes:', processedText.substring(0, 500))

  // Process all formatted elements in the correct order FIRST
  processedText = processFormattedElementsPass(processedText)

  console.log('🎨 AFTER formatted elements pass:', processedText.substring(0, 500))

  // CRITICAL: Pre-process tables AFTER formatted elements to repair any damage they caused
  processedText = preprocessTables(processedText)

  console.log('📊 AFTER table preprocessing:', processedText.substring(0, 500))

  // Test if we have table content
  if (processedText.includes('|') && processedText.includes('---')) {
    console.log('🔍 Table detected in content:', processedText.substring(0, 200) + '...')

    // Show the exact table structure we're trying to parse
    const lines = processedText.split('\n')
    const tableLines = lines.filter(line => line.includes('|')).slice(0, 5)
    console.log('📊 Table lines being parsed:', tableLines)
  }

  // Finally process any remaining markdown with GFM support
  const finalHtml = marked(processedText)

  // Log the final HTML to see if tables are rendered
  if (finalHtml.includes('<table>') || finalHtml.includes('<th>') || finalHtml.includes('<td>')) {
    console.log('✅ Table HTML generated successfully')
  } else if (processedText.includes('|')) {
    console.log('❌ Table content found but no table HTML generated')
    console.log('Input text sample:', processedText.substring(0, 300))
    console.log('Output HTML sample:', finalHtml.substring(0, 300))

    // Test just the table portion in isolation
    const lines = processedText.split('\n')
    const tableStart = lines.findIndex(line => line.includes('|') && (line.includes('Plan') || line.includes('Feature Category')))
    if (tableStart !== -1) {
      const tableSection = lines.slice(tableStart, tableStart + 5).join('\n')
      console.log('🧪 Testing isolated table section:', tableSection)
      const isolatedResult = marked(tableSection)
      console.log('🧪 Isolated table result:', isolatedResult)
    }
  }

  console.log('🏁 FINAL HTML output:', finalHtml.substring(0, 500))

  return finalHtml
}

// Preprocess tables to ensure proper markdown table format
const preprocessTables = (text) => {
  // Split text into lines
  const lines = text.split('\n')
  const processedLines = []

  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : ''

    // Detect start of table
    if (line.includes('|') && nextLine.includes('|') && nextLine.includes('-')) {
      inTable = true

      // Add clean header
      const cleanHeader = line.replace(/\s*\|\s*/g, ' | ').trim()
      processedLines.push(cleanHeader)

      // Add clean separator
      const cleanSeparator = nextLine.replace(/\s*\|\s*/g, ' | ').replace(/-+/g, '---').trim()
      processedLines.push(cleanSeparator)
      i++ // Skip the separator line since we just processed it
      continue
    }

    // If we're in a table
    if (inTable) {
      // Check if this line continues the table
      if (line.includes('|') && line.length > 0) {
        // Clean table row
        const cleanRow = line.replace(/\s*\|\s*/g, ' | ').trim()
        processedLines.push(cleanRow)
      } else if (line.length === 0) {
        // CRITICAL: Skip ALL empty lines within tables - they break markdown parsing
        continue
      } else {
        // End of table - add the non-table line and exit table mode
        inTable = false
        processedLines.push(line)
      }
    } else {
      // Not in table, add line as-is
      processedLines.push(line)
    }
  }

  // FINAL PASS: Remove any remaining blank lines between consecutive table rows
  const finalLines = []
  for (let i = 0; i < processedLines.length; i++) {
    const currentLine = processedLines[i]
    const nextLine = processedLines[i + 1] || ''

    finalLines.push(currentLine)

    // If current line is a table row and next line is empty and line after that is also a table row,
    // skip the empty line
    if (currentLine.includes('|') && nextLine.trim() === '' && processedLines[i + 2]?.includes('|')) {
      i++ // Skip the empty line
    }
  }

  return finalLines.join('\n')
}

// Process leftside/rightside images - matches GraphViewer processLeftRightImages
const processLeftRightImages = (text) => {
  // Split into blocks (paragraphs, images, etc.)
  const lines = text.split(/\n+/)
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    // Updated regex: match image at start of line, even if text follows
    const imageMatch = line.match(
      /^!\[(Rightside|Leftside)(?:-(\d+))?\s*\|\s*([^\]]+?)\s*\]\((.+?)\)(.*)$/,
    )
    if (imageMatch) {
      const type = imageMatch[1]
      const paragraphCount = parseInt(imageMatch[2], 10) || 1
      const styles = imageMatch[3].trim()
      const url = imageMatch[4].trim()
      const afterText = imageMatch[5].trim()
      // Collect the next N non-empty lines as paragraphs
      const consumedParagraphs = []
      // If there is text after the image on the same line, treat it as the first paragraph
      if (afterText) {
        consumedParagraphs.push(afterText)
      }
      let j = i + 1
      while (consumedParagraphs.length < paragraphCount && j < lines.length) {
        if (lines[j].trim() !== '') {
          consumedParagraphs.push(lines[j])
        }
        j++
      }
      // Helper to extract style values
      const getStyleValue = (styleString, key, fallback) => {
        const regex = new RegExp(key + ': *[\'"]?([^;\'"]+)[\'"]?', 'i')
        const found = styleString.match(regex)
        return found ? found[1].trim() : fallback
      }
      const width = (() => {
        let w = getStyleValue(styles, 'width', '20%')
        if (/^\d+$/.test(w)) w = w + 'px'
        return w
      })()
      let height = getStyleValue(styles, 'height', '200px')
      if (/^\d+$/.test(height)) height = height + 'px'
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')
      const sideParagraphs = marked(consumedParagraphs.join('\n\n'))
      const containerClass = type === 'Rightside' ? 'rightside-container' : 'leftside-container'
      const contentClass = type === 'Rightside' ? 'rightside-content' : 'leftside-content'
      const imageClass = type === 'Rightside' ? 'rightside-image' : 'leftside-image'
      const imageSideClass = type === 'Rightside' ? 'rightside' : 'leftside'
      // Use a human-readable alt text
      const altText = type + ' Image'

      // Calculate dynamic width for containers if image is large
      if (width.endsWith('px')) {
        const widthValue = parseInt(width)
        if (widthValue > 200) {
          const containerWidth = 1000 // Typical container width
          const imagePercentage = Math.min((widthValue / containerWidth) * 100, 60) // Max 60%
          const contentPercentage = 100 - imagePercentage - 2 // 2% for gap

          const containerStyle = ` style="display: flex; gap: 20px; align-items: flex-start;"`
          const imageStyle = ` style="flex: 0 0 ${imagePercentage}%; width: ${imagePercentage}%; min-width: ${imagePercentage}%;"`
          const contentStyleAttr = ` style="flex: 1 1 auto; max-width: ${contentPercentage}%; min-width: 0; overflow-wrap: break-word;"`

          const containerHtml = `
            <div class="${containerClass} dynamic-width-container"${containerStyle}>
              <div class="${imageClass}"${imageStyle}>
                <img src="${url}" alt="${altText}" class="${imageSideClass}" style="width: ${width}; min-width: ${width}; height: ${height}; object-fit: ${objectFit}; object-position: ${objectPosition}; border-radius: 8px;" />
              </div>
              <div class="${contentClass}"${contentStyleAttr}>${sideParagraphs}</div>
            </div>
          `.trim()

          blocks.push(containerHtml)
          i = j
          continue
        }
      }

      const containerHtml = `
        <div class="${containerClass}">
          <div class="${imageClass}">
            <img src="${url}" alt="${altText}" class="${imageSideClass}" style="width: ${width}; min-width: ${width}; height: ${height}; object-fit: ${objectFit}; object-position: ${objectPosition}; border-radius: 8px;" />
          </div>
          <div class="${contentClass}">${sideParagraphs}</div>
        </div>
      `.trim()
      blocks.push(containerHtml)
      i = j // Skip the image line and the consumed paragraphs
      continue
    }
    // Otherwise, just add the line as a block
    if (line.trim() !== '') {
      blocks.push(line)
    }
    i++
  }
  return blocks.join('\n\n')
}

const processFormattedElementsPass = (text) => {
  let processedText = text

  // Follow the EXACT order from GraphViewer preprocessMarkdown

  // 1. Process COMMENT blocks (with markdown inside)
  processedText = processedText.replace(
    /\[COMMENT\s*\|([^\]]*)\]([\s\S]*?)\[END\s+COMMENT\]/gs,
    (match, style, content) => {
      // Parse style string for author and CSS
      let author = ''
      let css = ''
      style.split(';').forEach((s) => {
        const [k, v] = s.split(':').map((x) => x && x.trim().replace(/^['"]|['"]$/g, ''))
        if (k && v) {
          if (k.toLowerCase() === 'author') {
            author = v
          } else {
            css += `${k}:${v};`
          }
        }
      })

      return `<div class="comment-block" style="${css}">
${author ? `<div class="comment-author">${author}</div>` : ''}
<div>${marked(content.trim())}</div>
</div>\n\n`
    },
  )

  // 2. Process FANCY elements (NO markdown processing - just content.trim())
  processedText = processedText.replace(
    /\[FANCY\s*\|([^\]]*)\]([\s\S]*?)\[END\s+FANCY\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // FANCY elements do NOT process markdown - just use content.trim()
      return `<div class="fancy-title" style="${css}">${content.trim()}</div>`
    },
  )

  // 3. Process leftside/rightside images FIRST (before sections and quotes)
  processedText = processLeftRightImages(processedText)

  // 4. Process QUOTE elements (with markdown inside)
  processedText = processedText.replace(
    /\[QUOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+QUOTE\]/gs,
    (match, style, content) => {
      const quoteParams = parseQuoteParams(style)
      const processedContent = marked(content.trim())
      const styleAttr = quoteParams.styles ? ` style="${quoteParams.styles}"` : ''
      return `<div class="fancy-quote"${styleAttr}>${processedContent}<cite>— ${quoteParams.cited}</cite></div>`
    },
  )

  // 5. Process SECTION elements (with markdown inside)
  processedText = processedText.replace(
    /\[SECTION\s*\|([^\]]*)\]([\s\S]*?)\[END\s+SECTION\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // Process the content through marked to handle markdown inside the section
      const processedContent = marked(content.trim())
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )

  // 6. Process WNOTE elements (with markdown inside)
  processedText = processedText.replace(
    /\[WNOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+WNOTE\]/gs,
    (match, style, content) => {
      const quoteParams = parseQuoteParams(style)
      const processedContent = marked(content.trim())
      const styleAttr = quoteParams.styles ? ` style="${quoteParams.styles}"` : ''
      return `<div class="work-note"${styleAttr}>
        ${processedContent}
        ${quoteParams.cited !== 'Unknown' ? `<cite>— ${quoteParams.cited}</cite>` : ''}
      </div>`
    },
  )

  // 7. Handle header images (they don't consume text)
  processedText = processedText.replace(
    /!\[Header(?:-(\d+))?\|(.+?)\]\((.+?)\)/g,
    (match, paragraphCount, styles, url) => {
      const getStyleValue = (styleString, key, fallback) => {
        const regex = new RegExp(key + ': *[\'"]?([^;\'"]+)[\'"]?', 'i')
        const found = styleString.match(regex)
        return found ? found[1].trim() : fallback
      }
      const height = getStyleValue(styles, 'height', 'auto')
      const objectFit = getStyleValue(styles, 'object-fit', 'cover')
      const objectPosition = getStyleValue(styles, 'object-position', 'center')
      return `<div class="header-image-container">
<img src="${url}" alt="Header Image" class="header-image" style="object-fit: ${objectFit}; object-position: ${objectPosition}; height: ${height !== 'auto' ? height + 'px' : height}; border-radius: 8px;" />
</div>\n\n`
    },
  )

  // Note: IMAGEQUOTE elements are now handled separately in parsedContent to create structured objects
  // Note: FLEXBOX elements (GRID, CARDS, GALLERY) are now handled as structured components in parsedContent

  return processedText
}

const parseStyleString = (style) => {
  console.log('parseStyleString input:', style)
  const result = style
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const colonIndex = s.indexOf(':')
      if (colonIndex === -1) return ''

      const k = s.substring(0, colonIndex).trim()
      const v = s.substring(colonIndex + 1).trim()

      if (!k || !v) return ''

      // Special handling for background-image to preserve url() quotes
      if (k === 'background-image' && v.includes('url(')) {
        return `${k}:${v}`
      }

      // Special handling for width and height - ensure units are added if missing
      if (k === 'width' || k === 'height') {
        console.log(`Processing ${k}: ${v}`)
        // If the value is just a number, add px
        if (/^\d+(\.\d+)?$/.test(v)) {
          const processed = `${k}:${v}px`
          console.log(`Added px units: ${processed}`)
          return processed
        }
        // If it already has units or is a percentage, keep as is
        const processed = `${k}:${v}`
        console.log(`Keeping as is: ${processed}`)
        return processed
      }

      // For other properties, remove outer quotes but preserve inner content
      const cleanValue = v.replace(/^['"]|['"]$/g, '')
      return `${k}:${cleanValue}`
    })
    .join(';')

  console.log('parseStyleString output:', result)
  return result
}

const parseImageQuoteParams = (params) => {
  const result = {}

  // Split by spaces but preserve quoted values
  const matches = params.match(/(\w+):\s*(?:'([^']*)'|"([^"]*)"|([^\s]+))/g) || []

  matches.forEach((match) => {
    const [, key, singleQuoted, doubleQuoted, unquoted] =
      match.match(/(\w+):\s*(?:'([^']*)'|"([^"]*)"|([^\s]+))/) || []
    if (key) {
      result[key] = singleQuoted || doubleQuoted || unquoted
    }
  })

  return result
}

const camelToKebab = (str) => {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

const parseQuoteParams = (style) => {
  const result = { cited: 'Unknown', styles: '' }

  // Parse 'Cited=value' format
  const citedMatch = style.match(/Cited\s*=\s*['"]?([^'";]+)['"]?/i)
  if (citedMatch) {
    result.cited = citedMatch[1].trim()
  }

  // Try colon format for cited
  if (result.cited === 'Unknown') {
    const colonMatch = style.match(/cited\s*:\s*['"]?([^'";]+)['"]?/i)
    if (colonMatch) {
      result.cited = colonMatch[1].trim()
    }
  }

  // Parse CSS properties (font-size, color, etc.)
  const cssProps = []

  // Look for CSS properties in the format: property: 'value' or property: value
  const cssRegex = /([\w-]+)\s*:\s*['"]?([^'";]+)['"]?/g
  let match

  while ((match = cssRegex.exec(style)) !== null) {
    const prop = match[1].toLowerCase()
    const value = match[2].trim()

    // Skip the 'cited' property as it's handled separately
    if (prop !== 'cited') {
      cssProps.push(`${prop}: ${value}`)
    }
  }

  result.styles = cssProps.join('; ')

  return result
}

// Add change image buttons for regular images (Leftside, Rightside, Header, markdown) - matches GraphViewer
const addChangeImageButtons = (html, nodeId, originalContent) => {
  console.log('=== GNew: Adding Change Image Buttons ===')
  console.log('User role:', userStore.role)
  console.log('User logged in:', userStore.loggedIn)
  console.log('Node ID:', nodeId)

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // Find all images EXCEPT those in IMAGEQUOTE elements
  const images = tempDiv.querySelectorAll('img')
  console.log('Found images:', images.length)

  images.forEach((img) => {
    // Skip images that are inside IMAGEQUOTE elements
    const isInImagequote = img.closest('.imagequote-element')
    if (isInImagequote) {
      console.log('Skipping image in IMAGEQUOTE element')
      return
    }

    const imageUrl = img.src
    const imageAlt = img.alt || ''

    // Determine image type from alt text or class
    let imageType = 'Unknown'
    let imageContext = 'Image in content'

    if (imageAlt.toLowerCase().includes('header')) {
      imageType = 'Header'
      imageContext = 'Header image for visual impact'
    } else if (imageAlt.toLowerCase().includes('leftside')) {
      imageType = 'Leftside'
      imageContext = 'Left-aligned contextual image'
    } else if (imageAlt.toLowerCase().includes('rightside')) {
      imageType = 'Rightside'
      imageContext = 'Right-aligned contextual image'
    } else if (img.classList.contains('header-image')) {
      imageType = 'Header'
      imageContext = 'Header image for visual impact'
    } else if (img.classList.contains('leftside')) {
      imageType = 'Leftside'
      imageContext = 'Left-aligned contextual image'
    } else if (img.classList.contains('rightside')) {
      imageType = 'Rightside'
      imageContext = 'Right-aligned contextual image'
    }

    // Wrap the image for change button positioning
    const imageWrapper = document.createElement('div')
    imageWrapper.className = 'image-change-wrapper'
    imageWrapper.setAttribute('data-node-id', nodeId)
    imageWrapper.setAttribute('data-node-content', originalContent)
    imageWrapper.setAttribute('data-image-type', imageType)

    // Wrap the image
    img.parentNode.insertBefore(imageWrapper, img)
    imageWrapper.appendChild(img)

    // Check if this image has attribution data in the node
    const nodeImageAttributions = props.node.imageAttributions || {}
    const attribution = nodeImageAttributions[imageUrl]

    // Create attribution if attribution data exists
    if (attribution && attribution.requires_attribution) {
      // Determine if this is a small contextual image (Rightside/Leftside)
      const isSmallContextualImage =
        imageType === 'Rightside' ||
        imageType === 'Leftside' ||
        imageAlt.match(/^(Rightside|Leftside)-\d+/i)

      if (isSmallContextualImage) {
        // For small contextual images, add attribution below the image
        const attributionDiv = document.createElement('div')
        attributionDiv.className = 'image-attribution-below'

        const attributionText = document.createElement('div')
        attributionText.className = 'attribution-text-below'

        if (attribution.provider === 'unsplash') {
          attributionText.innerHTML = `
            Photo by
            <a href="${attribution.photographer_url}?utm_source=vegvisr&utm_medium=referral"
               target="_blank" rel="noopener noreferrer" class="photographer-link">
              ${attribution.photographer}
            </a> on
            <a href="https://unsplash.com/?utm_source=vegvisr&utm_medium=referral"
               target="_blank" rel="noopener noreferrer" class="provider-link">
              Unsplash
            </a>
          `
        } else if (attribution.provider === 'pexels') {
          attributionText.innerHTML = `
            Photo by
            <a href="${attribution.photographer_url}"
               target="_blank" rel="noopener noreferrer" class="photographer-link">
              ${attribution.photographer}
            </a> on
            <a href="${attribution.pexels_url}"
               target="_blank" rel="noopener noreferrer" class="provider-link">
              Pexels
            </a>
          `
        } else if (attribution.provider === 'custom') {
          // Handle custom attribution for small contextual images
          let customAttributionHtml = 'Photo by '

          if (attribution.photographer_url && attribution.photographer_url.trim()) {
            customAttributionHtml += `
              <a href="${attribution.photographer_url}"
                 target="_blank" rel="noopener noreferrer" class="photographer-link">
                ${attribution.photographer || 'Unknown'}
              </a>`
          } else {
            customAttributionHtml += `<span class="photographer-name">${attribution.photographer || 'Unknown'}</span>`
          }

          if (attribution.custom_attribution && attribution.custom_attribution.trim()) {
            customAttributionHtml += ` - ${attribution.custom_attribution}`
          }

          attributionText.innerHTML = customAttributionHtml
        } else if (attribution.photographer && !['Portfolio', 'Unknown', ''].includes(attribution.photographer.trim())) {
          // Only show attribution if photographer name is meaningful
          attributionText.innerHTML = `Photo by ${attribution.photographer}`
        } else {
          // Skip attribution for meaningless photographer names
          return
        }

        attributionDiv.appendChild(attributionText)

        // Insert attribution after the image wrapper
        imageWrapper.parentNode.insertBefore(attributionDiv, imageWrapper.nextSibling)
      } else {
        // For larger images (Header, etc.), use overlay
        const attributionOverlay = document.createElement('div')
        attributionOverlay.className = 'image-attribution-overlay'

        const attributionText = document.createElement('div')
        attributionText.className = 'attribution-text'

        if (attribution.provider === 'unsplash') {
          attributionText.innerHTML = `
            Photo by
            <a href="${attribution.photographer_url}?utm_source=vegvisr&utm_medium=referral"
               target="_blank" rel="noopener noreferrer" class="photographer-link">
              ${attribution.photographer}
            </a> on
            <a href="https://unsplash.com/?utm_source=vegvisr&utm_medium=referral"
               target="_blank" rel="noopener noreferrer" class="provider-link">
              Unsplash
            </a>
          `
        } else if (attribution.provider === 'pexels') {
          attributionText.innerHTML = `
            Photo by
            <a href="${attribution.photographer_url}"
               target="_blank" rel="noopener noreferrer" class="photographer-link">
              ${attribution.photographer}
            </a> on
            <a href="${attribution.pexels_url}"
               target="_blank" rel="noopener noreferrer" class="provider-link">
              Pexels
            </a>
          `
        } else if (attribution.provider === 'custom') {
          // Handle custom attribution for overlay images
          let customAttributionHtml = 'Photo by '

          if (attribution.photographer_url && attribution.photographer_url.trim()) {
            customAttributionHtml += `
              <a href="${attribution.photographer_url}"
                 target="_blank" rel="noopener noreferrer" class="photographer-link">
                ${attribution.photographer || 'Unknown'}
              </a>`
          } else {
            customAttributionHtml += `<span class="photographer-name">${attribution.photographer || 'Unknown'}</span>`
          }

          if (attribution.custom_attribution && attribution.custom_attribution.trim()) {
            customAttributionHtml += ` - ${attribution.custom_attribution}`
          }

          attributionText.innerHTML = customAttributionHtml
        } else if (attribution.photographer && !['Portfolio', 'Unknown', ''].includes(attribution.photographer.trim())) {
          // Only show attribution if photographer name is meaningful
          attributionText.innerHTML = `Photo by ${attribution.photographer}`
        } else {
          // Skip attribution for meaningless photographer names
          return
        }

        attributionOverlay.appendChild(attributionText)
        imageWrapper.appendChild(attributionOverlay)
      }
    }

    // Create button container
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'image-button-container'

    // Create change image button
    const changeButton = document.createElement('button')
    changeButton.className = 'change-image-btn'

    // Check if this image has existing attribution to determine button text
    const hasAttribution = attribution && attribution.requires_attribution
    changeButton.innerHTML = hasAttribution ? '🔄 Update Image' : '🔄 Change Image'
    changeButton.title = hasAttribution ? 'Update this image and attribution' : 'Change this image'

    // Add click handler data
    changeButton.setAttribute('data-image-url', imageUrl)
    changeButton.setAttribute('data-image-alt', imageAlt)
    changeButton.setAttribute('data-image-type', imageType)
    changeButton.setAttribute('data-image-context', imageContext)
    changeButton.setAttribute('data-node-id', nodeId)
    changeButton.setAttribute('data-node-content', originalContent)

    // Create Update Attribution button
    const updateAttributionButton = document.createElement('button')
    updateAttributionButton.className = 'update-attribution-btn'
    updateAttributionButton.innerHTML = '✏️ Update Attribution'
    updateAttributionButton.title = 'Update photo attribution'

    // Add click handler data for attribution button
    updateAttributionButton.setAttribute('data-image-url', imageUrl)
    updateAttributionButton.setAttribute('data-image-alt', imageAlt)
    updateAttributionButton.setAttribute('data-image-type', imageType)
    updateAttributionButton.setAttribute('data-image-context', imageContext)
    updateAttributionButton.setAttribute('data-node-id', nodeId)
    updateAttributionButton.setAttribute('data-node-content', originalContent)

    // Create Google Photos button
    const googleButton = document.createElement('button')
    googleButton.className = 'google-photos-btn'
    googleButton.innerHTML = '📷 Google'
    googleButton.title = 'Select from Google Photos'

    // Add click handler data for Google button
    googleButton.setAttribute('data-image-url', imageUrl)
    googleButton.setAttribute('data-image-alt', imageAlt)
    googleButton.setAttribute('data-image-type', imageType)
    googleButton.setAttribute('data-image-context', imageContext)
    googleButton.setAttribute('data-node-id', nodeId)
    googleButton.setAttribute('data-node-content', originalContent)

    // Add buttons to container
    buttonContainer.appendChild(changeButton)
    buttonContainer.appendChild(updateAttributionButton)
    buttonContainer.appendChild(googleButton)

    // Insert button container after the image wrapper
    if (imageWrapper.parentNode) {
      // If wrapper is in a container, add button container to container
      if (
        imageWrapper.parentNode.classList.contains('header-image-container') ||
        imageWrapper.parentNode.classList.contains('rightside-image') ||
        imageWrapper.parentNode.classList.contains('leftside-image')
      ) {
        imageWrapper.parentNode.appendChild(buttonContainer)
      } else {
        // Insert after the wrapper
        imageWrapper.parentNode.insertBefore(buttonContainer, imageWrapper.nextSibling)
      }
    }
  })

  return tempDiv.innerHTML
}

// Add IMAGEQUOTE image change buttons for IMAGEQUOTE elements
const addImagequoteChangeButtons = (html, nodeId, originalContent) => {
  console.log('=== GNew: Adding IMAGEQUOTE Change Buttons ===')

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // Find all IMAGEQUOTE elements
  const imagequoteElements = tempDiv.querySelectorAll('.imagequote-element')
  console.log('Found IMAGEQUOTE elements:', imagequoteElements.length)

  imagequoteElements.forEach((element, index) => {
    // Create IMAGEQUOTE image change button
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'imagequote-button-container'

    const changeImageButton = document.createElement('button')
    changeImageButton.className = 'imagequote-image-btn'
    changeImageButton.innerHTML = '🖼️ Change Background'
    changeImageButton.title = 'Change IMAGEQUOTE background image'

    // Add data attributes for IMAGEQUOTE editing
    changeImageButton.setAttribute('data-node-id', nodeId)
    changeImageButton.setAttribute('data-node-content', originalContent)
    changeImageButton.setAttribute('data-imagequote-index', index)
    changeImageButton.setAttribute('data-editing-type', 'imagequote')

    buttonContainer.appendChild(changeImageButton)

    // Insert button container after the IMAGEQUOTE element
    element.parentNode.insertBefore(buttonContainer, element.nextSibling)
  })

  return tempDiv.innerHTML
}

// Computed properties
const nodeContent = computed(() => {
  return props.node.info || ''
})

const parsedContent = computed(() => {
  if (!nodeContent.value) return []

  try {
    const parts = []

    // Extract all FLEXBOX elements first (GRID, CARDS, GALLERY) to create structured objects
    const flexboxRegex = /\[FLEXBOX-(GRID|CARDS(?:-(\d+))?|GALLERY)\]([\s\S]*?)\[END\s+FLEXBOX\]/gs
    const flexboxMatches = [...nodeContent.value.matchAll(flexboxRegex)]

    if (flexboxMatches.length > 0) {
      let lastIndex = 0

      for (const match of flexboxMatches) {
        // Add text before this FLEXBOX block
        if (match.index > lastIndex) {
          const beforeText = nodeContent.value.slice(lastIndex, match.index).trim()
          if (beforeText) {
            const processedBefore = parseFormattedElements(beforeText)
            let finalContent = marked(processedBefore)

            if (props.showControls && userStore.loggedIn && userStore.role === 'Superadmin') {
              finalContent = addChangeImageButtons(finalContent, props.node.id, nodeContent.value)
              finalContent = addImagequoteChangeButtons(
                finalContent,
                props.node.id,
                nodeContent.value,
              )
            }

            parts.push({ type: 'text', content: finalContent })
          }
        }

        // Determine FLEXBOX type and create structured object
        const flexboxType = match[1].toLowerCase()
        const content = match[3].trim()

        // Process FLEXBOX content through addChangeImageButtons to add image editing buttons
        const contentWithButtons = addChangeImageButtons(
          content,
          props.nodeId,
          props.nodeData?.originalContent || '',
        )

        if (flexboxType === 'grid') {
          parts.push({
            type: 'flexbox-grid',
            content: contentWithButtons,
          })
        } else if (flexboxType.startsWith('cards')) {
          const columnCount = match[2] ? parseInt(match[2], 10) : 3
          parts.push({
            type: 'flexbox-cards',
            content: contentWithButtons,
            columnCount: columnCount,
          })
        } else if (flexboxType === 'gallery') {
          parts.push({
            type: 'flexbox-gallery',
            content: contentWithButtons,
          })
        }

        lastIndex = match.index + match[0].length
      }

      // Add any remaining text after the last FLEXBOX
      if (lastIndex < nodeContent.value.length) {
        const afterText = nodeContent.value.slice(lastIndex).trim()
        if (afterText) {
          const processedAfter = parseFormattedElements(afterText)
          let finalContent = marked(processedAfter)

          if (props.showControls && userStore.loggedIn && userStore.role === 'Superadmin') {
            finalContent = addChangeImageButtons(finalContent, props.node.id, nodeContent.value)
            finalContent = addImagequoteChangeButtons(
              finalContent,
              props.node.id,
              nodeContent.value,
            )
          }

          parts.push({ type: 'text', content: finalContent })
        }
      }

      return parts
    }

    // Extract IMAGEQUOTE elements first and create structured objects
    const imagequoteRegex = /\[IMAGEQUOTE\s*([^\]]*)\]([\s\S]*?)\[END\s+IMAGEQUOTE\]/gs
    let lastIndex = 0
    let match

    while ((match = imagequoteRegex.exec(nodeContent.value)) !== null) {
      // Add any text before this IMAGEQUOTE as regular content
      if (match.index > lastIndex) {
        const beforeText = nodeContent.value.slice(lastIndex, match.index).trim()
        if (beforeText) {
          const processedBefore = parseFormattedElements(beforeText)
          let finalContent = marked(processedBefore)

          // Add image edit buttons for Superadmin users
          if (props.showControls && userStore.loggedIn && userStore.role === 'Superadmin') {
            // First add regular image buttons (excluding IMAGEQUOTE images)
            finalContent = addChangeImageButtons(finalContent, props.node.id, nodeContent.value)
            // Then add IMAGEQUOTE-specific buttons
            finalContent = addImagequoteChangeButtons(
              finalContent,
              props.node.id,
              nodeContent.value,
            )
          }

          parts.push({ type: 'text', content: finalContent })
        }
      }

      // Parse IMAGEQUOTE parameters
      const params = match[1]
      const content = match[2].trim()
      const imageQuoteParams = parseImageQuoteParams(params)

      // Create structured IMAGEQUOTE object
      const containerStyles = {
        backgroundImage: imageQuoteParams.backgroundImage
          ? `url('${imageQuoteParams.backgroundImage}')`
          : 'none',
        aspectRatio: imageQuoteParams.aspectRatio || '16/9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: '8px',
        margin: '15px 0',
        position: 'relative',
        width: imageQuoteParams.width || '100%',
        height: imageQuoteParams.height || 'auto',
        minHeight: '200px',
      }

      const contentStyles = {
        color: 'white',
        textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
        textAlign: imageQuoteParams.textAlign || 'center',
        padding: imageQuoteParams.padding || '2rem',
        fontSize: imageQuoteParams.fontSize || '1.5rem',
      }

      // Check for attribution data for this IMAGEQUOTE background image
      const nodeImageAttributions = props.node.imageAttributions || {}
      const backgroundImageUrl = imageQuoteParams.backgroundImage
      const attribution = backgroundImageUrl ? nodeImageAttributions[backgroundImageUrl] : null

      parts.push({
        type: 'IMAGEQUOTE',
        content: content,
        citation: imageQuoteParams.cited || null,
        containerStyles: containerStyles,
        contentStyles: contentStyles,
        backgroundImageUrl: backgroundImageUrl,
        attribution: attribution,
      })

      lastIndex = imagequoteRegex.lastIndex
    }

    // Add any remaining text after the last IMAGEQUOTE
    if (lastIndex < nodeContent.value.length) {
      const afterText = nodeContent.value.slice(lastIndex).trim()
      if (afterText) {
        const processedAfter = parseFormattedElements(afterText)
        let finalContent = marked(processedAfter)

        // Add image edit buttons for Superadmin users
        if (props.showControls && userStore.loggedIn && userStore.role === 'Superadmin') {
          // First add regular image buttons (excluding IMAGEQUOTE images)
          finalContent = addChangeImageButtons(finalContent, props.node.id, nodeContent.value)
          // Then add IMAGEQUOTE-specific buttons
          finalContent = addImagequoteChangeButtons(finalContent, props.node.id, nodeContent.value)
        }

        parts.push({ type: 'text', content: finalContent })
      }
    }

    // If no IMAGEQUOTE elements were found, process the entire content normally
    if (parts.length === 0) {
      const processedHtml = parseFormattedElements(nodeContent.value)
      const hasProcessedElements = /<div class="[^"]*-element"/.test(processedHtml)

      let finalContent = hasProcessedElements
        ? processedHtml
        : marked(processedHtml)

      // Add image edit buttons for Superadmin users
      if (props.showControls && userStore.loggedIn && userStore.role === 'Superadmin') {
        // First add regular image buttons (excluding IMAGEQUOTE images)
        finalContent = addChangeImageButtons(finalContent, props.node.id, nodeContent.value)
        // Then add IMAGEQUOTE-specific buttons
        finalContent = addImagequoteChangeButtons(finalContent, props.node.id, nodeContent.value)
      }

      return [{ type: 'text', content: finalContent }]
    }

    return parts
  } catch (error) {
    console.error('Error parsing formatted content:', error)
    return [{ type: 'text', content: nodeContent.value }]
  }
})

const nodeTypeClass = computed(() => {
  const type = props.node.type || 'default'
  return `node-type-${type}`
})

const nodeTypeDisplay = computed(() => {
  const type = props.node.type || 'default'
  const typeLabels = {
    fulltext: 'Full Text',
    worknote: 'Work Note',
    info: 'Information',
    chart: 'Chart',
    piechart: 'Pie Chart',
    linechart: 'Line Chart',
    timeline: 'Timeline',
    bubblechart: 'Bubble Chart',
    swot: 'SWOT Analysis',
    REG: 'Registration',
  }
  return typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)
})

// Methods
const editNode = () => {
  // Emit event for parent to handle
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this node?')) {
    emit('node-deleted', props.node.id)
  }
}

// SEO modal for individual node
const openNodeSEO = () => {
  console.log('🔍 Opening SEO modal for node:', props.node.id)
  // Emit event to GNewViewer to handle SEO modal
  emit('open-node-seo', props.node)
}

// Share functionality for individual node
const openNodeShare = () => {
  console.log('🔗 Opening Share options for node:', props.node.id)
  // Emit event to GNewViewer to handle Share modal
  emit('open-node-share', props.node)
}

const convertStylesToString = (styleObj) => {
  if (!styleObj || typeof styleObj !== 'object') return ''

  return Object.entries(styleObj)
    .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
    .join('; ')
}
</script>

<style scoped>
.gnew-default-node {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
  position: relative;
}

.gnew-default-node:hover {
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

/* Hover Toolbar for Fulltext Nodes */
.node-hover-toolbar {
  position: absolute;
  top: 12px;
  right: 120px; /* Position to the left of edit/delete buttons */
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

/* When node has no header, position at far right */
.gnew-default-node:not(:has(.node-header)) .node-hover-toolbar {
  right: 12px;
}

.gnew-default-node:hover .node-hover-toolbar {
  opacity: 1;
}

.toolbar-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.toolbar-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.toolbar-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.seo-btn:hover {
  background: #f0f8ff;
}

.share-btn:hover {
  background: #f0fff4;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.node-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.3;
}

.node-controls {
  display: flex;
  gap: 8px;
  margin-left: 15px;
}

.node-content {
  color: #495057;
  line-height: 1.6;
  font-size: 1rem;
}

.node-content :deep(h1),
.node-content :deep(h2),
.node-content :deep(h3),
.node-content :deep(h4),
.node-content :deep(h5),
.node-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: #2c3e50;
}

.node-content :deep(p) {
  margin-bottom: 1em;
}

.node-content :deep(ul),
.node-content :deep(ol) {
  margin-bottom: 1em;
  padding-left: 1.5em;
}

.node-content :deep(blockquote) {
  border-left: 4px solid #007bff;
  margin: 1em 0;
  padding: 0.5em 1em;
  background: #f8f9fa;
  font-style: italic;
}

.node-content :deep(code) {
  background: #f8f9fa;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.node-content :deep(pre) {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1em;
  overflow-x: auto;
  margin: 1em 0;
}

.node-empty-state {
  text-align: center;
  padding: 40px 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

.node-type-badge-inline {
  background: #007bff;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Node type specific styling */
.node-type-fulltext {
  background: #f8f9fa;
  border-color: #6c757d;
}

.node-type-worknote {
  background: #fff3cd;
  border-color: #ffc107;
}

.node-type-worknote .node-type-badge-inline {
  background: #ffc107;
  color: #212529;
}

.node-type-info {
  background: #d1ecf1;
  border-color: #17a2b8;
}

.node-type-info .node-type-badge-inline {
  background: #17a2b8;
}

/* IMAGEQUOTE element styling */
.imagequote-element {
  position: relative;
  overflow: hidden;
}

.imagequote-content {
  z-index: 2;
  position: relative;
}

.imagequote-citation {
  z-index: 2;
  position: absolute;
}

.node-type-chart,
.node-type-piechart,
.node-type-linechart,
.node-type-timeline,
.node-type-bubblechart {
  background: #e7f3ff;
  border-color: #007bff;
}

.node-type-swot {
  background: #f0f9ff;
  border-color: #0ea5e9;
}

.node-type-REG {
  background: #dcfce7;
  border-color: #16a34a;
}

.node-type-REG .node-type-badge-inline {
  background: #16a34a;
}

/* Formatted Elements */
.fancy-element {
  margin: 1.5em 0;
  padding: 1.5em;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  position: relative;
  overflow: hidden;
}

.fancy-element::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #007bff, #6610f2, #e83e8c, #fd7e14);
}

.fancy-content {
  position: relative;
  z-index: 1;
}

.fancy-title {
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  font-weight: bold;
  border-radius: 8px;
  overflow: hidden;
}

.section-element {
  margin: 1.5em 0;
  padding: 1.5em;
  border-radius: 8px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-left: 4px solid #007bff;
}

.section-content {
  font-weight: 500;
}

.imagequote-element {
  margin: 2em 0;
  border-radius: 12px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
}

.imagequote-element::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.imagequote-content {
  position: relative;
  z-index: 2;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.4;
  max-width: 80%;
}

.imagequote-citation {
  position: relative;
  z-index: 2;
  margin-top: 1em;
  font-size: 1rem;
  font-style: italic;
  opacity: 0.9;
}

.unknown-element {
  margin: 1em 0;
  padding: 1em;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  border-left: 4px solid #f39c12;
}

.unknown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.unknown-type {
  background: #f39c12;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.unknown-content {
  font-family: monospace;
  background: #fff;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .gnew-default-node {
    padding: 15px;
    margin-bottom: 15px;
  }

  .node-header {
    flex-direction: column;
    gap: 10px;
  }

  .node-title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .node-controls {
    margin-left: 0;
    align-self: flex-end;
  }

  .node-title {
    font-size: 1.2rem;
  }

  .node-type-badge-inline {
    align-self: flex-start;
  }

  .imagequote-content {
    font-size: 1.2rem;
    max-width: 90%;
  }

  .imagequote-citation {
    font-size: 0.9rem;
  }
}

/* Enhanced CSS for GNew-specific elements */
.imagequote-element {
  position: relative;
  min-height: 200px;
  overflow: hidden;
}

.imagequote-content {
  z-index: 1;
  position: relative;
  text-align: inherit;
  max-width: 90%;
}

.imagequote-citation {
  z-index: 1;
}

/* Image editing button styles - matches GraphViewer */
.node-content :deep(.image-change-wrapper) {
  position: relative;
  display: inline-block;
  width: 100%;
}

.node-content :deep(.image-button-container) {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: 15px;
}

.node-content :deep(.change-image-btn),
.node-content :deep(.update-attribution-btn),
.node-content :deep(.google-photos-btn) {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.node-content :deep(.change-image-btn:hover),
.node-content :deep(.update-attribution-btn:hover),
.node-content :deep(.google-photos-btn:hover) {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-content :deep(.change-image-btn:active),
.node-content :deep(.update-attribution-btn:active),
.node-content :deep(.google-photos-btn:active) {
  transform: translateY(0);
  box-shadow: none;
}

.node-content :deep(.google-photos-btn) {
  background: #28a745;
}

.node-content :deep(.google-photos-btn:hover) {
  background: #1e7e34;
}

/* Specific positioning for image containers */
.node-content :deep(.header-image-container .image-button-container),
.node-content :deep(.rightside-image .image-button-container),
.node-content :deep(.leftside-image .image-button-container) {
  justify-content: center;
  margin-top: 10px;
}

.node-content :deep(.rightside-container .rightside-image .image-button-container),
.node-content :deep(.leftside-container .leftside-image .image-button-container) {
  width: 100%;
  justify-content: center;
  padding: 0 5px;
}

/* IMAGEQUOTE editing button styles */
.node-content :deep(.imagequote-button-container) {
  display: flex;
  justify-content: center;
  margin-top: 10px;
  margin-bottom: 15px;
}

/* Image Attribution Overlay Styles */
.node-content :deep(.image-change-wrapper) {
  position: relative;
  display: inline-block;
}

.node-content :deep(.image-attribution-overlay) {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: clamp(4px, 2vw, 12px) clamp(6px, 3vw, 12px) clamp(6px, 2.5vw, 10px);
  font-size: clamp(0.6rem, 1.5vw, 0.8rem);
  line-height: 1.2;
  z-index: 2;
  container-type: inline-size;
}

/* For smaller images (width <= 300px), show attribution below instead of overlay */
@container (max-width: 300px) {
  .node-content :deep(.image-attribution-overlay) {
    position: static;
    background: none;
    padding: 8px 0 0 0;
    font-size: 0.75rem;
    line-height: 1.3;
    border-top: 1px solid #e9ecef;
    margin-top: 8px;
  }

  .node-content :deep(.attribution-text) {
    color: #495057 !important;
    text-shadow: none !important;
  }

  .node-content :deep(.attribution-text a) {
    color: #007bff !important;
    border-bottom: 1px solid rgba(0, 123, 255, 0.3) !important;
  }

  .node-content :deep(.attribution-text a:hover) {
    color: #0056b3 !important;
    border-bottom-color: #0056b3 !important;
    text-shadow: none !important;
  }
}

/* For medium images (301px - 500px), use smaller overlay */
@container (min-width: 301px) and (max-width: 500px) {
  .node-content :deep(.image-attribution-overlay) {
    font-size: 0.7rem;
    padding: 6px 8px 8px;
    line-height: 1.15;
  }
}

/* For larger images (501px+), use full overlay */
@container (min-width: 501px) {
  .node-content :deep(.image-attribution-overlay) {
    font-size: 0.8rem;
    padding: 8px 12px 10px;
    line-height: 1.2;
  }
}

.node-content :deep(.attribution-text) {
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.node-content :deep(.attribution-text a) {
  color: #ffffff;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;
}

.node-content :deep(.attribution-text a:hover) {
  color: #f8f9fa;
  border-bottom-color: #f8f9fa;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

.node-content :deep(.photographer-link) {
  font-weight: 500;
}

.node-content :deep(.provider-link) {
  font-weight: 600;
}

/* Attribution below image (for small contextual images like Rightside/Leftside) */
.node-content :deep(.image-attribution-below) {
  margin-top: 4px;
  padding: 6px 0;
  font-size: 0.7rem;
  line-height: 1.3;
  border-top: 1px solid #e9ecef;
  text-align: left;
}

.node-content :deep(.attribution-text-below) {
  color: #495057;
  font-size: 0.7rem;
}

.node-content :deep(.attribution-text-below a) {
  color: #007bff;
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 123, 255, 0.3);
  transition: all 0.2s ease;
}

.node-content :deep(.attribution-text-below a:hover) {
  color: #0056b3;
  border-bottom-color: #0056b3;
}

.node-content :deep(.attribution-text-below .photographer-link) {
  font-weight: 500;
}

.node-content :deep(.attribution-text-below .provider-link) {
  font-weight: 600;
}

/* IMAGEQUOTE Attribution Overlay Styles */
.imagequote-attribution-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
  padding: 8px 15px 12px;
  font-size: 0.75rem;
  line-height: 1.2;
  z-index: 3;
}

.imagequote-attribution-text {
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  opacity: 0.9;
}

.imagequote-attribution-text a {
  color: #ffffff;
  text-decoration: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.4);
  transition: all 0.2s ease;
}

.imagequote-attribution-text a:hover {
  color: #f8f9fa;
  border-bottom-color: #f8f9fa;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
}

.imagequote-attribution-text .photographer-link {
  font-weight: 500;
}

.imagequote-attribution-text .provider-link {
  font-weight: 600;
}

.node-content :deep(.imagequote-image-btn) {
  background: #6f42c1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.node-content :deep(.imagequote-image-btn:hover) {
  background: #5a2d91;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-content :deep(.imagequote-image-btn:active) {
  transform: translateY(0);
  box-shadow: none;
}

/* Mobile responsiveness for image buttons */
@media (max-width: 768px) {
  .node-content :deep(.image-button-container) {
    flex-direction: column;
    gap: 4px;
  }

  .node-content :deep(.change-image-btn),
  .node-content :deep(.google-photos-btn) {
    width: 100%;
    font-size: 0.8rem;
    padding: 8px 10px;
  }

  .node-content :deep(.imagequote-image-btn) {
    width: 100%;
    font-size: 0.8rem;
    padding: 10px 12px;
  }
}

/* Custom attribution styling */
.node-content :deep(.photographer-name) {
  font-weight: 500;
  color: inherit;
}

/* Markdown table styles */
.node-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
  font-size: 0.9rem;
  background-color: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.node-content :deep(table thead) {
  background-color: #f8f9fa;
}

.node-content :deep(table thead tr) {
  border-bottom: 2px solid #dee2e6;
}

.node-content :deep(table th) {
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  background-color: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
}

.node-content :deep(table td) {
  padding: 12px 15px;
  border-bottom: 1px solid #dee2e6;
  vertical-align: top;
}

.node-content :deep(table tbody tr) {
  transition: background-color 0.2s ease;
}

.node-content :deep(table tbody tr:hover) {
  background-color: #f8f9fa;
}

.node-content :deep(table tbody tr:nth-child(even)) {
  background-color: #fdfdfd;
}

.node-content :deep(table tbody tr:nth-child(even):hover) {
  background-color: #f8f9fa;
}

/* Responsive table styling */
@media (max-width: 768px) {
  .node-content :deep(table) {
    font-size: 0.8rem;
  }

  .node-content :deep(table th),
  .node-content :deep(table td) {
    padding: 8px 10px;
  }
}

/* Table cell content styling */
.node-content :deep(table td strong),
.node-content :deep(table th strong) {
  font-weight: 600;
}

.node-content :deep(table td code),
.node-content :deep(table th code) {
  background-color: #f1f3f4;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.85em;
}

/* Emoji and special characters in tables */
.node-content :deep(table td) {
  line-height: 1.4;
}
</style>
