<template>
  <div class="gnew-default-node" :class="nodeTypeClass">
    <!-- Node Header -->
    <div v-if="node.label" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <!-- Node Type Badge in Header -->
        <div v-if="node.type && node.type !== 'default'" class="node-type-badge-inline">
          {{ nodeTypeDisplay }}
        </div>
      </div>
      <div v-if="showControls && !isPreview" class="node-controls">
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
          :style="contentPart.containerStyles"
        >
          <div class="imagequote-content" :style="contentPart.contentStyles">
            {{ contentPart.content }}
          </div>
          <div v-if="contentPart.citation" class="imagequote-citation">
            — {{ contentPart.citation }}
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

    <!-- Empty State -->
    <div v-else-if="!node.label" class="node-empty-state">
      <p class="text-muted">Empty node - no content available</p>
      <button v-if="showControls && !isPreview" @click="editNode" class="btn btn-sm btn-primary">
        Add Content
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

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
const emit = defineEmits(['node-updated', 'node-deleted'])

// Content parsing function - matches GraphViewer preprocessMarkdown
const parseFormattedElements = (text) => {
  // Follow the exact same order as GraphViewer preprocessMarkdown
  let processedText = text

  // Process all formatted elements in the correct order
  processedText = processFormattedElementsPass(processedText)

  // Finally process any remaining markdown
  const finalHtml = marked(processedText, { breaks: true })

  return finalHtml
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
      const sideParagraphs = marked(consumedParagraphs.join('\n\n'), { breaks: true })
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
<div>${marked(content.trim(), { breaks: true })}</div>
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
      const cited = parseQuoteParams(style)
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="fancy-quote">${processedContent}<cite>— ${cited}</cite></div>`
    },
  )

  // 5. Process SECTION elements (with markdown inside)
  processedText = processedText.replace(
    /\[SECTION\s*\|([^\]]*)\]([\s\S]*?)\[END\s+SECTION\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // Process the content through marked to handle markdown inside the section
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )

  // 6. Process WNOTE elements (with markdown inside)
  processedText = processedText.replace(
    /\[WNOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+WNOTE\]/gs,
    (match, style, content) => {
      const cited = parseQuoteParams(style)
      const processedContent = marked(content.trim(), { breaks: true })
      return `<div class="work-note">
        ${processedContent}
        ${cited !== 'Unknown' ? `<cite>— ${cited}</cite>` : ''}
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

  // 8. Process IMAGEQUOTE elements (no markdown - just content)
  processedText = processedText.replace(
    /\[IMAGEQUOTE\s*([^\]]*)\]([\s\S]*?)\[END\s+IMAGEQUOTE\]/gs,
    (match, params, content) => {
      console.log('=== Processing IMAGEQUOTE Element ===')
      console.log('Raw params:', params)
      console.log('Raw content:', content)

      const imageQuoteParams = parseImageQuoteParams(params)
      console.log('Parsed params:', imageQuoteParams)

      // IMAGEQUOTE elements do NOT process markdown - just use content.trim()
      const processedContent = content.trim()
      console.log('Processed content:', processedContent)

      const styles = {
        backgroundImage: imageQuoteParams.backgroundImage
          ? `url('${imageQuoteParams.backgroundImage}')`
          : 'none',
        aspectRatio: imageQuoteParams.aspectRatio || '16/9',
        textAlign: imageQuoteParams.textAlign || 'center',
        padding: imageQuoteParams.padding || '2rem',
        fontSize: imageQuoteParams.fontSize || '1.5rem',
        width: imageQuoteParams.width || '100%',
        height: imageQuoteParams.height || 'auto',
      }

      const styleString = Object.entries(styles)
        .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
        .join('; ')

      console.log('Generated styles:', styles)
      console.log('Style string:', styleString)

      const finalHtml = `<div class="imagequote-element" style="${styleString}; display: flex; align-items: center; justify-content: center; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.7); background-size: cover; background-position: center; border-radius: 8px; margin: 15px 0;">
        <div class="imagequote-content">${processedContent}</div>
        ${imageQuoteParams.cited ? `<div class="imagequote-citation" style="position: absolute; bottom: 10px; right: 15px; font-size: 0.9em; opacity: 0.9;">— ${imageQuoteParams.cited}</div>` : ''}
      </div>`

      console.log('✅ IMAGEQUOTE rendered successfully')
      console.log('Final HTML:', finalHtml)

      return finalHtml
    },
  )

  return processedText
}

const parseStyleString = (style) => {
  return style
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

      // For other properties, remove outer quotes but preserve inner content
      const cleanValue = v.replace(/^['"]|['"]$/g, '')
      return `${k}:${cleanValue}`
    })
    .join(';')
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
  // Parse both 'Cited=value' and 'param: value' formats
  const citedMatch = style.match(/Cited\s*=\s*['"]?([^'";]+)['"]?/i)
  if (citedMatch) {
    return citedMatch[1].trim()
  }

  // Try colon format
  const colonMatch = style.match(/cited\s*:\s*['"]?([^'";]+)['"]?/i)
  if (colonMatch) {
    return colonMatch[1].trim()
  }

  return 'Unknown'
}

// Computed properties
const nodeContent = computed(() => {
  return props.node.info || ''
})

const parsedContent = computed(() => {
  if (!nodeContent.value) return []

  try {
    // First process formatted elements
    let processedHtml = parseFormattedElements(nodeContent.value)

    // Check if the content contains already-processed HTML elements
    const hasProcessedElements = /<div class="[^"]*-element"/.test(processedHtml)

    if (hasProcessedElements) {
      // If we have processed elements, don't run markdown again to avoid escaping
      console.log('✅ Content contains processed elements, skipping markdown processing')
      return [{ type: 'text', content: processedHtml }]
    } else {
      // If no processed elements, we can safely run markdown
      const finalHtml = marked(processedHtml, { breaks: true })
      return [{ type: 'text', content: finalHtml }]
    }
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
</style>
