import { createWorkersAI } from 'workers-ai-provider'
import { generateText } from 'ai'

/**
 * @typedef {Object} Env
 * @property {Ai} AI
 */

// ── Semantic classification (auto-taxonomy) ──────────────────────────

const SEMANTIC_CATEGORIES = [
  'ART_AND_MEDIA', 'BRANDING_AND_WEB', 'BUSINESS', 'COMMUNITY',
  'EDUCATION', 'HEALTH_AND_MOVEMENT', 'KNOWLEDGE_MANAGEMENT',
  'PERSONAL_DEVELOPMENT', 'PHILOSOPHY', 'SYSTEM_INTERNAL', 'TECHNOLOGY',
  'MARKETING', 'OTHER'
]

async function classifyGraph(env, graphId, graphData) {
  try {
    const title = graphData.metadata?.title || graphId
    const description = graphData.metadata?.description || ''
    const metaArea = graphData.metadata?.metaArea || ''
    const nodeLabels = (graphData.nodes || [])
      .slice(0, 20)
      .map(n => n.label || n.type || '')
      .filter(Boolean)
      .join(', ')

    const prompt = `Classify this knowledge graph into categories.

Title: ${title}
Description: ${description}
Meta area: ${metaArea}
Node labels: ${nodeLabels}

Categories: ${SEMANTIC_CATEGORIES.join(', ')}

Return ONLY a JSON object with:
- "primary": the single best category
- "secondary": array of 0-2 additional relevant categories (different from primary)
- "confidence": number 0.0-1.0

Example: {"primary":"TECHNOLOGY","secondary":["EDUCATION"],"confidence":0.9}
JSON:`

    const workersai = createWorkersAI({ binding: env.AI })
    const result = await generateText({
      model: workersai('@cf/meta/llama-3.1-8b-instruct'),
      prompt,
      maxTokens: 100,
      temperature: 0.1,
    })

    const text = result.text.trim()
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (!jsonMatch) {
      console.log(`[Classify] No JSON in response for ${graphId}: ${text}`)
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])
    // Validate categories
    const primary = SEMANTIC_CATEGORIES.includes(parsed.primary) ? parsed.primary : 'OTHER'
    const secondary = (parsed.secondary || []).filter(c => SEMANTIC_CATEGORIES.includes(c) && c !== primary)
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7

    return { primary, secondary, confidence }
  } catch (err) {
    console.error(`[Classify] Error classifying ${graphId}:`, err.message)
    return null
  }
}

async function classifyAndStore(env, graphId, graphData) {
  const result = await classifyGraph(env, graphId, graphData)
  if (!result) return

  // Read current graph data to merge classification into metadata
  const existing = await env.vegvisr_org.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').bind(graphId).first()
  if (!existing) return

  const data = JSON.parse(existing.data)
  if (!data.metadata) data.metadata = {}
  data.metadata.semanticPrimary = result.primary
  data.metadata.semanticSecondary = result.secondary
  data.metadata.semanticConfidence = result.confidence
  data.metadata.classifiedAt = new Date().toISOString()

  await env.vegvisr_org.prepare('UPDATE knowledge_graphs SET data = ? WHERE id = ?')
    .bind(JSON.stringify(data), graphId).run()

  console.log(`[Classify] ${graphId} → ${result.primary} (${result.secondary.join(', ')}) confidence=${result.confidence}`)
}

// ── data-node encryption (AES-256-GCM + PBKDF2) ──────────────────────
async function encryptDataNodeInfo(plaintext, masterKey) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(masterKey), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('vegvisr-data-node'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptDataNodeInfo(encryptedBase64, masterKey) {
  const combined = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(masterKey), { name: 'PBKDF2' }, false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('vegvisr-data-node'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(decrypted)
}

// Deep merge for agent contract composition
function deepMergeContract(source, target) {
  const result = { ...source }
  for (const key of Object.keys(target)) {
    if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
        && source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMergeContract(source[key], target[key])
    } else {
      result[key] = target[key]
    }
  }
  return result
}

// Shared content parsing utilities (extracted from GNewDefaultNode)
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

      // Special handling for width and height - ensure units are added if missing
      if (k === 'width' || k === 'height') {
        // If the value is just a number, add px
        if (/^\d+(\.\d+)?$/.test(v)) {
          return `${k}:${v}px`
        }
        // If it already has units or is a percentage, keep as is
        return `${k}:${v}`
      }

      // For other properties, remove outer quotes but preserve inner content
      const cleanValue = v.replace(/^['"]|['"]$/g, '')
      return `${k}:${cleanValue}`
    })
    .join(';')
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

// Simple markdown processor for slideshow content
const processMarkdown = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/^#{1,6}\s*(.+)/gm, (match, heading) => {
      const level = match.split('#').length - 1
      return `<h${level}>${heading.replace(/^#+\s*/, '')}</h${level}>`
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
}

// Helper function to generate error HTML
function generateErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Knowledge Graph</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f8f9fa; }
        .error-container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .error-title { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
        .error-message { color: #6c757d; font-size: 16px; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1 class="error-title">Error</h1>
        <p class="error-message">${message}</p>
    </div>
</body>
</html>`
}

// Helper function to parse slideshow content from fulltext nodes
function parseSlideshowFromFulltext(content) {
  const slides = []
  let metadata = {}

  // Extract metadata from [SLIDE_META] block
  const metaMatch = content.match(/\[SLIDE_META([^\]]*)\]/)
  if (metaMatch) {
    const metaContent = metaMatch[1]
    const themeMatch = metaContent.match(/theme="([^"]*)"/)
    const titleMatch = metaContent.match(/title="([^"]*)"/)
    const subtitleMatch = metaContent.match(/subtitle="([^"]*)"/)

    if (themeMatch) metadata.theme = themeMatch[1]
    if (titleMatch) metadata.title = titleMatch[1]
    if (subtitleMatch) metadata.subtitle = subtitleMatch[1]
  }

  // First try to find [SLIDE] markers and their content
  const slideRegex = /\[SLIDE([^\]]*)\](.*?)(?=\[SLIDE|\[SLIDE_META|$)/gs
  let match

  while ((match = slideRegex.exec(content)) !== null) {
    const slideProps = match[1]
    const slideContent = match[2].trim()

    if (slideContent) {
      // Extract title from slide properties
      const titleMatch = slideProps.match(/title="([^"]*)"/)
      const title = titleMatch ? titleMatch[1] : ''

      slides.push({
        title: title,
        content: slideContent,
      })
    }
  }

  // If no [SLIDE] blocks found, try to parse simple markdown with --- separators
  if (slides.length === 0) {
    const simpleSections = content
      .split('---')
      .map((section) => section.trim())
      .filter((section) => section.length > 0)

    simpleSections.forEach((section, index) => {
      // Extract title from first heading if available
      const titleMatch = section.match(/^#\s*(.+)/m)
      const title = titleMatch ? titleMatch[1] : `Slide ${index + 1}`

      slides.push({
        title: title,
        content: section,
      })
    })
  }

  return { metadata, slides }
}

// Helper function to generate slideshow HTML
function generateSlideshowHtml(slideshowData, theme, nodeLabel) {
  const { metadata, slides } = slideshowData
  const themeName = theme || metadata.theme || 'nibi'
  const title = metadata.title || nodeLabel || 'Untitled Presentation'

  const slideHtmls = slides
    .map((slide, index) => {
      // Process slide content with proper element handling following GNewDefaultNode order
      let processedContent = slide.content

      // 1. Process FANCY elements (NO markdown processing - just content.trim())
      processedContent = processedContent.replace(
        /\[FANCY\s*\|([^\]]*)\]([\s\S]*?)\[END\s+FANCY\]/gs,
        (match, style, content) => {
          const css = parseStyleString(style)
          // FANCY elements do NOT process markdown - just use content.trim()
          return `<div class="fancy-title" style="${css}">${content.trim()}</div>`
        },
      )

      // 2. Process QUOTE elements (before SECTION to match GNewDefaultNode order)
      processedContent = processedContent.replace(
        /\[QUOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+QUOTE\]/gs,
        (match, style, content) => {
          const cited = parseQuoteParams(style)
          const processedQuoteContent = processMarkdown(content.trim())
          return `<div class="fancy-quote">${processedQuoteContent}<cite>— ${cited}</cite></div>`
        },
      )

      // 3. Process SECTION elements
      processedContent = processedContent.replace(
        /\[SECTION\s*\|([^\]]*)\]([\s\S]*?)\[END\s+SECTION\]/gs,
        (match, style, content) => {
          const css = parseStyleString(style)
          const processedSectionContent = processMarkdown(content.trim())
          return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedSectionContent}</div>`
        },
      )

      // Process other elements (keeping existing logic for now)
      processedContent = processedContent.replace(
        /!\[([^\]]*)\|[^\]]*\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" class="slide-image" />',
      ) // Apply basic markdown processing to remaining content
      processedContent = processMarkdown(processedContent)

      if (processedContent.trim()) {
        processedContent = '<div class="slide-content"><p>' + processedContent + '</p></div>'
      }

      return `
      <div class="slide ${index === 0 ? 'active' : ''}" data-slide="${index + 1}">
        <div class="slide-header">
          <h2 class="slide-title">${slide.title}</h2>
          <div class="slide-number">${index + 1} / ${slides.length}</div>
        </div>
        ${processedContent}
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Vegvisr Slideshow</title>
    <style>
        ${getSlideshowCSS(themeName)}
    </style>
</head>
<body>
    <div class="slideshow-container" data-theme="${themeName}">
        <div class="slideshow-header">
            <h1 class="presentation-title">${title}</h1>
            ${metadata.subtitle ? `<div class="presentation-subtitle">${metadata.subtitle}</div>` : ''}
        </div>

        <div class="slides-wrapper">
            ${slideHtmls}
        </div>

        <div class="slideshow-controls">
            <button onclick="previousSlide()" class="control-btn">‹ Previous</button>
            <div class="slide-indicator">
                <span id="current-slide">1</span> of <span id="total-slides">${slides.length}</span>
            </div>
            <button onclick="nextSlide()" class="control-btn">Next ›</button>
        </div>

        <div class="slideshow-footer">
            <div class="footer-left">
                <a href="https://vegvisr.org" target="_blank">Vegvisr.org</a>
            </div>
            <div class="footer-right">
                <button onclick="toggleFullscreen()" class="control-btn">⛶ Fullscreen</button>
            </div>
        </div>
    </div>

    <script>
        ${getSlideshowJS()}
    </script>
</body>
</html>`
}

// Helper function to get slideshow CSS based on theme
function getSlideshowCSS(theme) {
  const baseCSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #333;
        overflow: hidden;
        height: 100vh;
    }

    .slideshow-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }

    .slideshow-header {
        text-align: center;
        margin-bottom: 20px;
        background: rgba(255, 255, 255, 0.95);
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }

    .presentation-title {
        color: #2c3e50;
        font-size: 2.5em;
        margin-bottom: 5px;
        font-weight: 600;
    }

    .presentation-meta {
        color: #7f8c8d;
        font-size: 0.9em;
    }

    .slides-wrapper {
        flex: 1;
        position: relative;
        background: white;
        border-radius: 15px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        overflow: hidden;
    }

    .slide {
        display: none;
        padding: 40px;
        height: 100%;
        overflow-y: auto;
        position: relative;
    }

    .slide.active {
        display: block;
    }

    .slide-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 15px;
        border-bottom: 3px solid #3498db;
    }

    .slide-title {
        color: #2c3e50;
        font-size: 2.2em;
        font-weight: 600;
    }

    .slide-number {
        background: #3498db;
        color: white;
        padding: 8px 15px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 0.9em;
    }

    .slide-content {
        font-size: 1.2em;
        line-height: 1.8;
        color: #34495e;
    }

    .slide-content h1, .slide-content h2, .slide-content h3 {
        color: #2c3e50;
        margin: 20px 0 15px 0;
    }

    .slide-content p {
        margin-bottom: 15px;
    }

    .slide-content ul, .slide-content ol {
        margin: 15px 0 15px 30px;
    }

    .slide-content li {
        margin-bottom: 8px;
    }

    /* QUOTE elements - matching GNewDefaultNode styling */
    .fancy-quote {
        background: #f8f9fa;
        border-left: 4px solid #3498db;
        padding: 20px;
        margin: 20px 0;
        font-style: italic;
        font-size: 1.1em;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .fancy-quote cite {
        display: block;
        margin-top: 10px;
        font-style: normal;
        font-weight: 600;
        color: #6c757d;
        font-size: 0.9em;
    }

    /* SECTION elements - matching GNewDefaultNode styling */
    .section {
        /* Styles are applied inline from parseStyleString, but base styles here */
        border-radius: 8px;
        margin: 15px 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        padding: 15px;
    }

    /* Legacy styles for backward compatibility */
    .slide-quote {
        background: #ecf0f1;
        border-left: 4px solid #3498db;
        padding: 20px;
        margin: 20px 0;
        font-style: italic;
        font-size: 1.1em;
    }

    .slide-section {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #e9ecef;
    }

    /* FANCY elements - matching GNewDefaultNode styling */
    .fancy-title {
        margin: 1.5em 0;
        padding: 1.5em;
        border-radius: 12px;
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border: 1px solid #dee2e6;
        position: relative;
        overflow: hidden;
        text-align: center;
        font-size: 1.8em;
        font-weight: 600;
        color: #2c3e50;
    }

    .fancy-title::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #007bff, #6610f2, #e83e8c, #fd7e14);
    }

    /* Legacy styles for backward compatibility */
    .slide-fancy {
        text-align: center;
        font-size: 1.5em;
        font-weight: 600;
        color: #e74c3c;
        margin: 25px 0;
    }

    .slide-image {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin: 20px 0;
    }

    .slideshow-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        background: rgba(255, 255, 255, 0.95);
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }

    .control-btn {
        background: #3498db;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1em;
        font-weight: 600;
        transition: all 0.3s ease;
    }

    .control-btn:hover {
        background: #2980b9;
        transform: translateY(-2px);
    }

    .control-btn:active {
        transform: translateY(0);
    }

    .slide-indicator {
        font-size: 1.1em;
        font-weight: 600;
        color: #2c3e50;
    }

    .slideshow-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 15px;
        padding: 0 10px;
    }

    .footer-left a {
        color: white;
        text-decoration: none;
        font-weight: 600;
        opacity: 0.8;
    }

    .footer-left a:hover {
        opacity: 1;
    }

    .footer-right {
        display: flex;
        gap: 10px;
    }
  `

  // Theme-specific styles
  const themeStyles = {
    nibi: `
      body { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); }
      .presentation-title { color: #1e3c72; }
      .slide-header { border-bottom-color: #1e3c72; }
      .slide-number { background: #1e3c72; }
      .control-btn { background: #1e3c72; }
      .control-btn:hover { background: #16325c; }
      .slide-quote { border-left-color: #1e3c72; }
    `,
    academic: `
      body { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); }
      .presentation-title { color: #2c3e50; }
      .slide-header { border-bottom-color: #2c3e50; }
      .slide-number { background: #2c3e50; }
      .control-btn { background: #2c3e50; }
      .control-btn:hover { background: #1a252f; }
    `,
    business: `
      body { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); }
      .presentation-title { color: #27ae60; }
      .slide-header { border-bottom-color: #27ae60; }
      .slide-number { background: #27ae60; }
      .control-btn { background: #27ae60; }
      .control-btn:hover { background: #1e8449; }
    `,
  }

  return baseCSS + (themeStyles[theme] || themeStyles.default || '')
}

// Helper function to get slideshow JavaScript
function getSlideshowJS() {
  return `
    let currentSlide = 1;
    const totalSlides = document.querySelectorAll('.slide').length;

    function showSlide(n) {
        const slides = document.querySelectorAll('.slide');
        if (n > totalSlides) currentSlide = 1;
        if (n < 1) currentSlide = totalSlides;

        slides.forEach(slide => slide.classList.remove('active'));
        slides[currentSlide - 1].classList.add('active');

        document.getElementById('current-slide').textContent = currentSlide;
    }

    function nextSlide() {
        currentSlide++;
        showSlide(currentSlide);
    }

    function previousSlide() {
        currentSlide--;
        showSlide(currentSlide);
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    function exportToPDF() {
        window.print();
    }

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        switch(e.key) {
            case 'ArrowRight':
            case ' ':
                e.preventDefault();
                nextSlide();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                previousSlide();
                break;
            case 'Escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
        }
    });

    // Initialize
    showSlide(1);

    // Auto-advance slides (optional, can be enabled via query parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const autoAdvance = urlParams.get('auto');
    if (autoAdvance) {
        const interval = parseInt(autoAdvance) || 5000;
        setInterval(() => {
            nextSlide();
        }, interval);
    }
  `
}

// Helper function to generate knowledge graph HTML
function generateGraphHtml(graphData, graphId) {
  const metadata = graphData.metadata || {}
  const title = metadata.title || 'Untitled Knowledge Graph'
  const description = metadata.description || 'No description provided'
  const createdBy = metadata.createdBy || 'Unknown'
  const createdAt = metadata.createdAt || ''
  const category = metadata.category || 'Uncategorized'
  const metaArea = metadata.metaArea || 'General'
  const nodes = graphData.nodes || []
  const edges = graphData.edges || []

  // Generate nodes list
  const nodesHtml = nodes
    .map((node) => {
      const nodeInfo = node.info || ''
      const nodeLabel = node.label || 'Untitled Node'
      const nodeType = node.type || 'default'
      const nodeId = node.id || ''
      const nodeColor = node.color || '#ffffff'
      const nodeBibl = node.bibl || []

      // Process the info content to remove special formatting for HTML display
      let processedContent = nodeInfo
        .replace(/\[SECTION[^\]]*\](.*?)\[END SECTION\]/gs, '$1')
        .replace(/\[QUOTE[^\]]*\](.*?)\[END QUOTE\]/gs, '<blockquote>$1</blockquote>')
        .replace(/\[FANCY[^\]]*\](.*?)\[END FANCY\]/gs, '<strong>$1</strong>')
        .replace(
          /!\[([^\]]*)\|[^\]]*\]\(([^)]+)\)/g,
          '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />',
        )
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')

      // Wrap in paragraph tags if content exists
      if (processedContent.trim()) {
        processedContent = '<p>' + processedContent + '</p>'
      }

      // Generate bibliography
      const biblHtml =
        nodeBibl.length > 0
          ? `
        <div class="node-bibliography">
          <h4>References:</h4>
          <ul>
            ${nodeBibl.map((ref) => `<li>${ref}</li>`).join('')}
          </ul>
        </div>`
          : ''

      return `
    <div class="node" style="border-left: 4px solid ${nodeColor}">
        <h3 class="node-title">${nodeLabel}</h3>
        <div class="node-meta">
          <span class="node-id">ID: ${nodeId}</span>
          <span class="node-type">Type: ${nodeType}</span>
        </div>
        <div class="node-content">${processedContent || '<em>No content available</em>'}</div>
        ${biblHtml}
    </div>`
    })
    .join('')

  // Generate edges list
  const edgesHtml = edges
    .map((edge) => {
      return `
    <div class="edge">
        <span class="edge-source">${edge.source}</span>
        <span class="edge-arrow"> → </span>
        <span class="edge-target">${edge.target}</span>
    </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Knowledge Graph</title>
    <meta name="description" content="${description}">
    <meta name="author" content="${createdBy}">
    <meta name="keywords" content="knowledge graph, ${category}, ${metaArea}">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 40px; background-color: #f8f9fa; line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .graph-title { color: #007bff; font-size: 32px; margin-bottom: 10px; }
        .graph-description { color: #6c757d; font-size: 18px; margin-bottom: 20px; }
        .graph-metadata { display: flex; gap: 20px; flex-wrap: wrap; }
        .metadata-item { background: #e9ecef; padding: 5px 10px; border-radius: 4px; font-size: 14px; }
        .section { margin: 30px 0; }
        .section-title { color: #343a40; font-size: 24px; margin-bottom: 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-item { background: #007bff; color: white; padding: 10px 20px; border-radius: 4px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; display: block; }
        .stat-label { font-size: 14px; }
                 .node { border: 1px solid #dee2e6; margin: 15px 0; padding: 20px; border-radius: 6px; background: #f8f9fa; }
         .node-title { color: #007bff; font-size: 18px; margin-bottom: 8px; font-weight: bold; }
         .node-meta { margin-bottom: 12px; }
         .node-id, .node-type { color: #6c757d; font-size: 12px; margin-right: 15px; background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
         .node-content { color: #343a40; line-height: 1.6; margin-bottom: 15px; }
         .node-content p { margin-bottom: 10px; }
         .node-content blockquote { background: #e7f3ff; border-left: 4px solid #007bff; padding: 10px 15px; margin: 10px 0; font-style: italic; }
         .node-content img { margin: 10px 0; border-radius: 4px; }
         .node-bibliography { margin-top: 15px; }
         .node-bibliography h4 { color: #495057; font-size: 14px; margin-bottom: 8px; }
         .node-bibliography ul { margin-left: 20px; }
         .node-bibliography li { color: #6c757d; font-size: 13px; margin-bottom: 5px; }
        .edge { padding: 8px; margin: 5px 0; background: #e9ecef; border-radius: 4px; }
        .edge-source, .edge-target { font-weight: bold; color: #007bff; }
        .edge-arrow { color: #6c757d; }
        .api-link { margin-top: 30px; padding: 20px; background: #e7f3ff; border-radius: 4px; border-left: 4px solid #007bff; }
        .api-link-title { font-weight: bold; color: #007bff; margin-bottom: 10px; }
        .api-url { font-family: monospace; background: #f8f9fa; padding: 5px 10px; border-radius: 4px; word-break: break-all; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="graph-title">${title}</h1>
            <p class="graph-description">${description}</p>
            <div class="graph-metadata">
                <div class="metadata-item"><strong>Created by:</strong> ${createdBy}</div>
                <div class="metadata-item"><strong>Category:</strong> ${category}</div>
                <div class="metadata-item"><strong>Meta Area:</strong> ${metaArea}</div>
                <div class="metadata-item"><strong>Graph ID:</strong> ${graphId}</div>
                ${createdAt ? `<div class="metadata-item"><strong>Created:</strong> ${new Date(createdAt).toLocaleDateString()}</div>` : ''}
            </div>
        </div>

        <div class="section">
            <div class="stats">
                <div class="stat-item">
                    <span class="stat-number">${nodes.length}</span>
                    <span class="stat-label">Nodes</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${edges.length}</span>
                    <span class="stat-label">Edges</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Nodes</h2>
            ${nodesHtml || '<p>No nodes found in this graph.</p>'}
        </div>

        <div class="section">
            <h2 class="section-title">Connections</h2>
            ${edgesHtml || '<p>No connections found in this graph.</p>'}
        </div>

        <div class="api-link">
            <div class="api-link-title">API Access</div>
            <p>For programmatic access to this knowledge graph data, use:</p>
            <div class="api-url">https://knowledge.vegvisr.org/getknowgraph?id=${graphId}</div>
        </div>
    </div>
</body>
</html>`
}

// ============================================
// API Token Validation
// ============================================

/**
 * Hash a token using SHA-256 (same as hashToken in api-token-handlers.js)
 */
async function hashToken(token) {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate authentication - supports:
 * 1. API Token via X-API-Token header (for external API access)
 * 2. Session-based auth via x-user-role header (for logged-in web users)
 * 3. Service binding calls (internal worker-to-worker, trusted)
 * 4. Trusted origin calls (from www.vegvisr.org, hello.vegvisr.org, etc.)
 *
 * Returns { valid: true, userId, scopes, authMethod } on success
 * Returns { valid: false, error, status } on failure
 */
async function validateAuth(request, env) {
  const apiToken = request.headers.get('X-API-Token')
  const userRole = request.headers.get('x-user-role')
  const pluginAuthenticated = request.headers.get('x-plugin-authenticated') === 'true'
  const origin = request.headers.get('Origin')

  // Define trusted origins early so we can use them in fallback logic
  const trustedOrigins = [
    'https://www.vegvisr.org',
    'https://vegvisr.org',
    'https://hello.vegvisr.org',
    'https://dashboard.vegvisr.org',
    'https://mystmkra.io',
    'https://www.mystmkra.io'
  ]
  const isTrustedOrigin = origin && trustedOrigins.includes(origin)

  // Method 1: API Token authentication
  // Only attempt if token looks like a real API token (not empty, null, undefined, or "null" string)
  if (apiToken && apiToken !== 'null' && apiToken !== 'undefined' && apiToken.trim() !== '') {
    try {
      // Hash the incoming token
      const tokenHash = await hashToken(apiToken)

      // Query the database
      const query = `
        SELECT user_id, scopes, is_active, expires_at, rate_limit
        FROM api_tokens
        WHERE token = ?
      `
      const result = await env.vegvisr_org.prepare(query).bind(tokenHash).first()

      if (!result) {
        // Token not found - if from trusted origin, fall through to other auth methods
        if (isTrustedOrigin) {
          console.log('API token not found, but request is from trusted origin - allowing')
        } else {
          return { valid: false, error: 'Invalid API token', status: 401 }
        }
      } else {
        // Check if token is active
        if (!result.is_active) {
          if (isTrustedOrigin) {
            console.log('API token inactive, but request is from trusted origin - allowing')
          } else {
            return { valid: false, error: 'API token is inactive', status: 401 }
          }
        } else if (result.expires_at) {
          const expiresAt = new Date(result.expires_at)
          if (expiresAt < new Date()) {
            if (isTrustedOrigin) {
              console.log('API token expired, but request is from trusted origin - allowing')
            } else {
              return { valid: false, error: 'API token has expired', status: 401 }
            }
          } else {
            // Valid token - update last_used_at and return success
            try {
              await env.vegvisr_org.prepare(
                `UPDATE api_tokens SET last_used_at = datetime('now') WHERE token = ?`
              ).bind(tokenHash).run()
            } catch (e) {
              console.error('Failed to update last_used_at:', e)
            }

            return {
              valid: true,
              userId: result.user_id,
              scopes: JSON.parse(result.scopes || '[]'),
              rateLimit: result.rate_limit,
              authMethod: 'api_token'
            }
          }
        } else {
          // Valid token with no expiry - update last_used_at and return success
          try {
            await env.vegvisr_org.prepare(
              `UPDATE api_tokens SET last_used_at = datetime('now') WHERE token = ?`
            ).bind(tokenHash).run()
          } catch (e) {
            console.error('Failed to update last_used_at:', e)
          }

          return {
            valid: true,
            userId: result.user_id,
            scopes: JSON.parse(result.scopes || '[]'),
            rateLimit: result.rate_limit,
            authMethod: 'api_token'
          }
        }
      }
    } catch (error) {
      console.error('Token validation error:', error)
      // If from trusted origin, don't fail - fall through to other auth methods
      if (!isTrustedOrigin) {
        return { valid: false, error: 'Token validation failed', status: 500 }
      }
    }
  }

  // Method 2: Session-based authentication (logged-in web user)
  // If x-user-role header is present, the user is authenticated via the web app
  if (userRole) {
    // Logged-in users have full access to their own operations
    // The frontend is responsible for sending the correct user context
    return {
      valid: true,
      userId: null, // User ID comes from request body for session-based auth
      scopes: ['all'], // Logged-in users have full access
      rateLimit: null,
      authMethod: 'session'
    }
  }

  if (pluginAuthenticated) {
    return {
      valid: true,
      userId: request.headers.get('x-user-id') || null,
      scopes: ['all'],
      rateLimit: null,
      authMethod: 'plugin_session'
    }
  }

  // Method 3: Service binding calls (worker-to-worker)
  // These come from trusted internal services like helloworld's save-hello.js
  // Service binding calls typically have no Origin header or use internal URLs
  if (!origin || origin.startsWith('https://knowledge-graph-worker')) {
    // Internal service call - the calling worker is responsible for auth
    return {
      valid: true,
      userId: null,
      scopes: ['all'],
      rateLimit: null,
      authMethod: 'service_binding'
    }
  }

  // Method 4: Trusted origin authentication (web app users)
  // Requests from the main Vegvisr sites are trusted - the user is authenticated
  // via cookies/session on those sites. This allows the frontend to work without
  // needing to explicitly send x-user-role header on every Knowledge Graph request.
  // Note: trustedOrigins is defined at the top of this function
  if (isTrustedOrigin) {
    return {
      valid: true,
      userId: null,
      scopes: ['all'],
      rateLimit: null,
      authMethod: 'trusted_origin'
    }
  }

  // No authentication provided
  return { valid: false, error: 'Authentication required. Provide X-API-Token header or log in.', status: 401 }
}

/**
 * Check if a scope is required and present
 */
function hasScope(userScopes, requiredScope) {
  // 'all' scope grants access to everything
  if (userScopes.includes('all')) return true
  return userScopes.includes(requiredScope)
}

const THEME_OWNER_PREFIX = 'theme:owner:'
const THEME_SHARED_PREFIX = 'theme:shared:'
const THEME_ALL_PREFIX = 'theme:'
const THEME_CATALOG_KEY = 'theme-catalog:v1'
const THEME_CATALOG_META_KEY = 'theme-catalog-meta:v1'

function normalizeThemeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || ''
  const cookies = {}
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    cookies[key] = value
  }
  return cookies
}

function getPluginTokenFromRequest(request, body = null) {
  const authHeader = request.headers.get('Authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const apiToken = request.headers.get('X-API-Token')
  const cookies = parseCookies(request)
  const pluginCookie = cookies.vegvisr_plugin_token
    ? decodeURIComponent(cookies.vegvisr_plugin_token)
    : null
  const vegvisrCookie = cookies.vegvisr_token ? decodeURIComponent(cookies.vegvisr_token) : null
  const bodyToken = body?.emailVerificationToken || body?.token || null
  return bodyToken || bearerToken || apiToken || pluginCookie || vegvisrCookie || null
}

const PLUGIN_DEVICE_PREFIX = 'plugin-device:'

function createDeviceCode() {
  return crypto.randomUUID().replace(/-/g, '')
}

function getPluginKv(env) {
  return env.BINDING_NAME || env.THEME_STUDIO_KV || null
}

async function pluginDevicePut(env, code, payload, expirationTtl = 900) {
  const kv = getPluginKv(env)
  if (!kv) throw new Error('Plugin KV binding missing.')
  await kv.put(`${PLUGIN_DEVICE_PREFIX}${code}`, JSON.stringify(payload), { expirationTtl })
}

async function pluginDeviceGet(env, code) {
  const kv = getPluginKv(env)
  if (!kv) throw new Error('Plugin KV binding missing.')
  const raw = await kv.get(`${PLUGIN_DEVICE_PREFIX}${code}`)
  return raw ? JSON.parse(raw) : null
}

function generatePluginAuthorizeHtml(deviceCode, email = '') {
  const safeCode = String(deviceCode || '')
  const safeEmail = String(email || '')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect Vegvisr Plugin</title>
  <style>
    :root { --ink:#133145; --teal:#0f766e; --paper:#fffdf8; --line:rgba(19,49,69,.12); --muted:#54616d; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Georgia, "Times New Roman", serif; color:var(--ink); background:linear-gradient(180deg,#fffdf8,#f4ede1); }
    .wrap { max-width:760px; margin:0 auto; padding:32px 20px 80px; }
    .card { background:var(--paper); border:1px solid var(--line); border-radius:28px; padding:28px; box-shadow:0 18px 60px rgba(17,33,45,.08); }
    h1 { margin:0 0 12px; font-size:clamp(34px,6vw,58px); line-height:0.98; }
    p { color:var(--muted); line-height:1.55; }
    input, button { width:100%; border-radius:14px; padding:14px 16px; font:inherit; }
    input { border:1px solid rgba(17,33,45,.14); margin:12px 0; }
    button { border:0; cursor:pointer; color:#fff; background:linear-gradient(135deg,var(--teal),#0f3b53); font-weight:700; }
    .status { margin-top:16px; white-space:pre-wrap; font:14px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; background:#f8fffe; border:1px solid rgba(15,118,110,.15); border-radius:16px; padding:14px; }
    .code { font:600 13px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color:#0f3b53; background:#eef7f7; padding:6px 10px; border-radius:999px; display:inline-block; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="code">Device code: ${safeCode}</div>
      <h1>Connect the local Vegvisr plugin</h1>
      <p>Sign in with your normal Vegvisr magic link. When the login completes, the local plugin on your machine will pick up the session automatically.</p>
      <form id="magicForm">
        <input id="email" type="email" value="${safeEmail.replace(/"/g, '&quot;')}" placeholder="name@example.com" autocomplete="email" required />
        <button type="submit">Send Magic Link</button>
      </form>
      <div id="status" class="status">Waiting for login…</div>
    </div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const setStatus = (value) => { statusEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
    document.getElementById('magicForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email').value.trim();
      const redirectUrl = 'https://knowledge.vegvisr.org/plugin/callback?device_code=${safeCode}';
      const res = await fetch('https://cookie.vegvisr.org/login/magic/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectUrl })
      });
      const data = await res.json();
      setStatus({
        success: res.ok && data?.success !== false,
        email,
        redirectUrl,
        providerResponse: data
      });
    });
    if (new URL(window.location.href).searchParams.get('connected') === '1') {
      setStatus('Login completed. You can return to Codex now.');
    }
  </script>
</body>
</html>`
}

function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`]
  parts.push(`Path=${options.path || '/'}`)
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.secure !== false) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite || 'Lax'}`)
  return parts.join('; ')
}

async function fetchDashJson(env, path, init = {}) {
  const request = new Request(`https://dash.internal${path}`, init)
  const response = env.DASH
    ? await env.DASH.fetch(request)
    : await fetch(`https://dashboard.vegvisr.org${path}`, init)

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }
  return { ok: response.ok, status: response.status, data }
}

async function resolvePluginUser(env, token) {
  if (!token) {
    return { ok: false, status: 401, data: { error: 'Missing token' } }
  }

  const result = await fetchDashJson(env, '/userdata-from-token', {
    method: 'GET',
    headers: { 'X-API-Token': token, Accept: 'application/json' },
  })

  if (!result.ok) return result

  return {
    ok: true,
    status: 200,
    data: {
      authenticated: true,
      email: result.data.email || null,
      user_id: result.data.user_id || null,
      oauth_id: result.data.oauth_id || result.data.user_id || null,
      role: result.data.role || null,
      profileimage: result.data.profileimage || null,
      phone: result.data.phone || null,
      phoneVerifiedAt: result.data.phoneVerifiedAt || null,
      emailVerificationToken: result.data.emailVerificationToken || null,
    },
  }
}

function getPluginProxyPath(pathname) {
  const prefix = '/plugin/api'
  if (!pathname.startsWith(prefix)) return null

  const suffix = pathname.slice(prefix.length) || ''
  if (!suffix.startsWith('/')) return null

  const allowedPaths = new Set([
    '/health',
    '/getknowgraphsummaries',
    '/getknowgraphs',
    '/getknowgraph',
    '/searchGraphs',
    '/saveGraphWithHistory',
    '/patchNode',
    '/patchGraphMetadata',
    '/addNode',
  ])

  return allowedPaths.has(suffix) ? suffix : null
}

async function rewritePluginApiRequest(request, env, corsHeaders, url) {
  const targetPath = getPluginProxyPath(url.pathname)
  if (!targetPath) {
    return {
      response: new Response(JSON.stringify({ error: 'Unknown plugin API route' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const token = getPluginTokenFromRequest(request)
  const userResult = await resolvePluginUser(env, token)
  if (!userResult.ok) {
    return {
      response: new Response(JSON.stringify(userResult.data), {
        status: userResult.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const rewrittenUrl = new URL(request.url)
  rewrittenUrl.pathname = targetPath

  const headers = new Headers(request.headers)
  headers.delete('Authorization')
  headers.delete('X-API-Token')
  headers.delete('cookie')
  headers.delete('host')
  headers.delete('origin')
  headers.set('x-plugin-authenticated', 'true')
  if (userResult.data.role) headers.set('x-user-role', userResult.data.role)
  if (userResult.data.email) headers.set('x-user-email', userResult.data.email)
  if (userResult.data.user_id) headers.set('x-user-id', userResult.data.user_id)

  const init = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  return {
    request: new Request(rewrittenUrl.toString(), init),
    url: rewrittenUrl,
    pathname: targetPath,
    user: userResult.data,
  }
}

function generatePluginLandingHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vegvisr Knowledge Plugin</title>
  <style>
    :root {
      --sand:#f6efe4; --paper:rgba(255,255,255,.78); --ink:#11212d; --muted:#4d6471;
      --teal:#0f766e; --marine:#0f3b53; --coral:#dc6b52; --line:rgba(17,33,45,.12);
    }
    * { box-sizing:border-box; }
    body {
      margin:0; color:var(--ink);
      background:
        radial-gradient(circle at 0% 0%, rgba(15,118,110,.18), transparent 28%),
        radial-gradient(circle at 100% 0%, rgba(220,107,82,.14), transparent 25%),
        linear-gradient(180deg, #fffdf8 0%, #f4ede1 100%);
      font-family: Georgia, "Times New Roman", serif;
    }
    .shell { max-width:1100px; margin:0 auto; padding:28px 20px 80px; }
    .hero, .card {
      border:1px solid var(--line);
      border-radius:28px;
      background:var(--paper);
      box-shadow:0 18px 60px rgba(17,33,45,.1);
    }
    .hero { padding:32px; }
    .eyebrow {
      display:inline-block; margin-bottom:14px; color:var(--teal);
      font:700 12px/1.2 "Trebuchet MS","Segoe UI",sans-serif; letter-spacing:.18em; text-transform:uppercase;
    }
    h1,h2,h3 { margin:0; line-height:.98; }
    h1 { font-size:clamp(48px, 8vw, 98px); max-width:800px; }
    p { color:var(--muted); line-height:1.55; }
    .lead { font-size:20px; max-width:720px; margin-top:18px; }
    .grid { display:grid; grid-template-columns:repeat(12,1fr); gap:16px; margin-top:24px; }
    .card { padding:22px; }
    .span-5 { grid-column:span 5; } .span-7 { grid-column:span 7; } .span-6 { grid-column:span 6; } .span-12 { grid-column:span 12; }
    .big { font-size:32px; color:var(--marine); }
    .stack { display:grid; gap:20px; margin-top:24px; }
    .pillrow { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
    .pill {
      padding:9px 14px; border-radius:999px; border:1px solid rgba(15,59,83,.12);
      background:rgba(15,59,83,.06); color:var(--marine);
      font:600 13px/1 "Trebuchet MS","Segoe UI",sans-serif;
    }
    .status {
      margin-top:14px; padding:16px; border-radius:18px; background:#f8fffe; border:1px solid rgba(15,118,110,.15);
      white-space:pre-wrap; word-break:break-word;
      font:14px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      color:#173042;
    }
    .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:18px; }
    button {
      border:0; border-radius:14px; padding:14px 18px; cursor:pointer; color:white;
      background:linear-gradient(135deg, var(--teal), var(--marine));
      font:700 15px/1.1 "Trebuchet MS","Segoe UI",sans-serif;
    }
    .secondary { background:transparent; color:var(--teal); border:1px solid rgba(15,118,110,.25); }
    form { display:grid; gap:12px; margin-top:14px; }
    input {
      width:100%; padding:14px 15px; border-radius:14px; border:1px solid rgba(17,33,45,.14);
      font:inherit;
    }
    @media (max-width:900px) {
      .span-5,.span-6,.span-7 { grid-column:span 12; }
      .lead { font-size:18px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">Vegvisr Plugin Marketplace</div>
      <h1>Bring the Vegvisr knowledge graph directly into Codex.</h1>
      <p class="lead">Registered Vegvisr users can connect with their existing auth state, confirm identity on knowledge.vegvisr.org, and then use live knowledge graph tools without pasting service tokens.</p>
      <div class="grid">
        <div class="card span-5">
          <div class="eyebrow">Connect Fast</div>
          <div class="big">Use existing Vegvisr auth first</div>
          <p>If <code>emailVerificationToken</code> already exists in localStorage on this origin, exchange it into a plugin session immediately.</p>
        </div>
        <div class="card span-7">
          <div class="eyebrow">Native Shape</div>
          <div class="big">knowledge worker for routes, dash worker for user truth, cookie service for magic links.</div>
        </div>
      </div>
    </section>

    <div class="stack">
      <section class="card">
        <div class="eyebrow">Connection</div>
        <h2 class="big">Plugin Session</h2>
        <p>This page can exchange an existing Vegvisr token into a plugin session cookie or request a magic link that returns to <code>/plugin/callback</code>.</p>
        <div class="actions">
          <button id="exchangeBtn">Use Existing Vegvisr Login</button>
          <button id="whoamiBtn" class="secondary">Check Plugin Session</button>
          <button id="logoutBtn" class="secondary">Log Out</button>
        </div>
        <div id="status" class="status">Waiting for action…</div>
      </section>

      <section class="card">
        <div class="eyebrow">Fallback</div>
        <h2 class="big">Request Magic Link</h2>
        <form id="magicForm">
          <input id="email" type="email" placeholder="name@example.com" autocomplete="email" required>
          <button type="submit">Send Magic Link</button>
        </form>
      </section>
    </div>
  </div>

  <script>
    const statusEl = document.getElementById('status');
    const setStatus = (value) => { statusEl.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };

    async function exchangeStoredToken() {
      const token = localStorage.getItem('emailVerificationToken');
      if (!token) {
        setStatus('No emailVerificationToken found in localStorage on this origin.');
        return;
      }
      const res = await fetch('/plugin/session/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emailVerificationToken: token })
      });
      const data = await res.json();
      setStatus(data);
    }

    async function whoami() {
      const res = await fetch('/plugin/whoami', { credentials: 'include' });
      const data = await res.json();
      setStatus(data);
    }

    async function logout() {
      const res = await fetch('/plugin/logout', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      setStatus(data);
    }

    document.getElementById('exchangeBtn').addEventListener('click', exchangeStoredToken);
    document.getElementById('whoamiBtn').addEventListener('click', whoami);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('magicForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email').value.trim();
      const res = await fetch('https://cookie.vegvisr.org/login/magic/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectUrl: 'https://knowledge.vegvisr.org/plugin/callback'
        })
      });
      const data = await res.json();
      setStatus({
        success: res.ok && data?.success !== false,
        email,
        redirectUrl: 'https://knowledge.vegvisr.org/plugin/callback',
        providerResponse: data
      });
    });

    if (new URL(window.location.href).searchParams.get('connected') === '1') {
      whoami().catch((error) => setStatus(String(error)));
    }
  </script>
</body>
</html>`
}

function isThemeValid(theme) {
  if (!theme || typeof theme !== 'object') return false
  if (!theme.id || !theme.label || !theme.tokens) return false
  if (!Array.isArray(theme.tags) || !Array.isArray(theme.swatches)) return false
  return true
}

async function listKvKeysByPrefix(kv, prefix) {
  const names = []
  let cursor
  do {
    const page = await kv.list({ prefix, cursor, limit: 100 })
    if (Array.isArray(page.keys)) {
      names.push(...page.keys.map((item) => item.name))
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return names
}

const extractFirstGoogleFontUrl = (html) => {
  const match = String(html || '').match(/href="(https:\/\/fonts\.googleapis\.com[^"]+)"/i)
  return match ? match[1].trim() : ''
}

const extractCssVarBlock = (html) => {
  const match = String(html || '').match(/:root\s*\{([\s\S]*?)\}/i)
  return match ? match[1] : ''
}

const readCssVar = (block, name) => {
  const match = String(block || '').match(new RegExp(`--${name}\\s*:\\s*([^;]+);`, 'i'))
  return match ? match[1].trim() : ''
}

const normalizeHexColor = (value) => {
  const raw = String(value || '').trim()
  const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!match) return ''
  return `#${match[1].toLowerCase()}`
}

const clamp01 = (n) => Math.min(1, Math.max(0, n))

const hexToRgb = (hex) => {
  const clean = String(hex || '').replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return { r, g, b }
  }
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255)
  const lin = srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

const pickTextOn = (bgHex) => {
  const lum = relativeLuminance(bgHex)
  return lum > 0.55 ? '#0b1220' : '#ffffff'
}

const extractPaletteFromHtml = (html) => {
  const items = []
  const re =
    /<div[^>]*class="[^"]*text-sm[^"]*"[^>]*>\s*([^<]+?)\s*<\/div>\s*<div[^>]*class="[^"]*text-xs[^"]*"[^>]*>\s*(#[0-9a-fA-F]{3,8})\s*<\/div>/g
  let match
  while ((match = re.exec(String(html || '')))) {
    const name = String(match[1] || '').replace(/\s+/g, ' ').trim()
    const hex = normalizeHexColor(match[2])
    if (name && hex) items.push({ name, hex })
    if (items.length >= 12) break
  }
  return items
}

const extractThemeIdFromHtml = (html) => {
  const h = String(html || '')
  const a = h.match(/data-theme-id="([^"]+)"/i)?.[1]
  if (a) return String(a).trim()
  const b = h.match(/data-v-theme="([^"]+)"/i)?.[1]
  if (b) return String(b).trim()
  return ''
}

const extractFontFamilyFromHtml = (html) => {
  const cssBlock = extractCssVarBlock(html)
  const fromVar = readCssVar(cssBlock, 'font')
  if (fromVar) return fromVar.replace(/^["']|["']$/g, '').trim()
  const bodyMatch = String(html || '').match(/body\s*\{[\s\S]*?font-family\s*:\s*([^;]+);/i)
  if (bodyMatch?.[1]) return bodyMatch[1].trim()
  return ''
}

const buildThemeFromHtmlNode = (node) => {
  const html = String(node?.info || '')
  const cssVars = extractCssVarBlock(html)
  const palette = extractPaletteFromHtml(html)

  const label = String(node?.label || '').trim() || 'Theme'
  const rawThemeId =
    String(node?.metadata?.themeId || '').trim() || extractThemeIdFromHtml(html) || normalizeThemeId(label)
  const id = normalizeThemeId(rawThemeId) || normalizeThemeId(label) || `theme-${Date.now()}`

  const bg =
    normalizeHexColor(readCssVar(cssVars, 'bg')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-bg')) ||
    normalizeHexColor(readCssVar(cssVars, 'bg1')) ||
    (palette.find((p) => /bg|background/i.test(p.name))?.hex || palette[0]?.hex) ||
    '#0b1220'

  const surface =
    normalizeHexColor(readCssVar(cssVars, 'surface')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-surface')) ||
    normalizeHexColor(readCssVar(cssVars, 'card')) ||
    (palette.find((p) => /surface|snow|cream/i.test(p.name))?.hex || palette[1]?.hex) ||
    '#0f172a'

  const surfaceElevated =
    normalizeHexColor(readCssVar(cssVars, 'elevated')) ||
    normalizeHexColor(readCssVar(cssVars, 'surfaceElevated')) ||
    normalizeHexColor(readCssVar(cssVars, 'bg2')) ||
    palette[2]?.hex ||
    surface

  const text =
    normalizeHexColor(readCssVar(cssVars, 'text')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-text')) ||
    (palette.find((p) => /text|ink|night/i.test(p.name))?.hex || pickTextOn(bg))

  const muted =
    normalizeHexColor(readCssVar(cssVars, 'muted')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-muted')) ||
    palette[3]?.hex ||
    text

  const primary =
    normalizeHexColor(readCssVar(cssVars, 'primary')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-primary')) ||
    normalizeHexColor(readCssVar(cssVars, 'accent2')) ||
    normalizeHexColor(readCssVar(cssVars, 'accent')) ||
    palette[4]?.hex ||
    '#22d3ee'

  const primaryInk =
    normalizeHexColor(readCssVar(cssVars, 'primaryInk')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-primary-ink')) ||
    pickTextOn(primary)

  const border =
    normalizeHexColor(readCssVar(cssVars, 'border')) ||
    normalizeHexColor(readCssVar(cssVars, 'v-border')) ||
    normalizeHexColor(readCssVar(cssVars, 'line')) ||
    '#334155'

  const radius = readCssVar(cssVars, 'radius') || readCssVar(cssVars, 'v-radius') || '16px'
  const shadow =
    readCssVar(cssVars, 'shadow') || readCssVar(cssVars, 'v-shadow') || '0 22px 50px rgba(15, 23, 42, 0.4)'
  const fontFamily = extractFontFamilyFromHtml(html)
  const googleFontImportUrl = extractFirstGoogleFontUrl(html)

  const swatches = palette.length
    ? palette.map((p) => p.hex).filter(Boolean).slice(0, 5)
    : [bg, surface, text, muted, primary]

  const tags = ['theme', 'graph', 'theme-page']

  return {
    id,
    label,
    description: 'Theme imported from a theme graph.',
    tags,
    swatches,
    ...(fontFamily ? { fontFamily } : {}),
    ...(googleFontImportUrl ? { googleFontImportUrl } : {}),
    ...(palette.length ? { palette } : {}),
    tokens: {
      bg,
      surface,
      surfaceElevated,
      text,
      muted,
      primary,
      primaryInk,
      border,
      radius,
      shadow,
    },
  }
}

async function readThemeCatalog(kv) {
  try {
    const raw = await kv.get(THEME_CATALOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeThemeCatalog(kv, themes, meta) {
  await kv.put(THEME_CATALOG_KEY, JSON.stringify(themes || []))
  await kv.put(THEME_CATALOG_META_KEY, JSON.stringify(meta || {}))
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, x-user-role, x-user-id, x-user-email, x-plugin-authenticated, X-API-Token, X-Email, Accept, Origin, Cache-Control',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }

    console.log(`[Worker] Incoming request: ${request.method} ${request.url}`)

    if (request.method === 'OPTIONS') {
      console.log('[Worker] Handling OPTIONS request')
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      let url = new URL(request.url)
      let pathname = url.pathname

      console.log(`[Worker] Request pathname: ${pathname}`)

      if (pathname === '/health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: 'knowledge-graph-worker',
          timestamp: new Date().toISOString()
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (pathname === '/plugin/landing' && request.method === 'GET') {
        return new Response(generatePluginLandingHtml(), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      if (pathname === '/plugin/session/exchange' && request.method === 'POST') {
        try {
          const body = await readJsonBody(request)
          const token = getPluginTokenFromRequest(request, body)
          const userResult = await resolvePluginUser(env, token)

          if (!userResult.ok) {
            return new Response(JSON.stringify(userResult.data), {
              status: userResult.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
          headers.append(
            'Set-Cookie',
            buildCookie('vegvisr_plugin_token', encodeURIComponent(token), {
              path: '/',
              maxAge: 60 * 60 * 24 * 30,
              httpOnly: true,
              secure: true,
              sameSite: 'Lax',
            }),
          )

          return new Response(JSON.stringify(userResult.data), {
            status: 200,
            headers,
          })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/session/exchange:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/whoami' && request.method === 'GET') {
        try {
          const token = getPluginTokenFromRequest(request)
          const userResult = await resolvePluginUser(env, token)
          return new Response(JSON.stringify(userResult.data), {
            status: userResult.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/whoami:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/device/start' && request.method === 'POST') {
        try {
          const body = await readJsonBody(request)
          const email = String(body.email || '').trim()
          const deviceCode = createDeviceCode()
          await pluginDevicePut(env, deviceCode, {
            status: 'pending',
            createdAt: new Date().toISOString(),
            email: email || null,
          }, 900)
          const authUrl = `https://knowledge.vegvisr.org/plugin/authorize?device_code=${encodeURIComponent(deviceCode)}${email ? `&email=${encodeURIComponent(email)}` : ''}`
          return new Response(JSON.stringify({
            success: true,
            deviceCode,
            authUrl,
            expiresIn: 900,
            interval: 3,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/device/start:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/device/poll' && request.method === 'GET') {
        try {
          const deviceCode = String(url.searchParams.get('device_code') || '').trim()
          if (!deviceCode) {
            return new Response(JSON.stringify({ error: 'Missing device_code' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          const record = await pluginDeviceGet(env, deviceCode)
          if (!record) {
            return new Response(JSON.stringify({ success: false, status: 'expired' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          return new Response(JSON.stringify({ success: true, ...record }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/device/poll:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/authorize' && request.method === 'GET') {
        const deviceCode = String(url.searchParams.get('device_code') || '').trim()
        const email = String(url.searchParams.get('email') || '').trim()
        if (!deviceCode) {
          return new Response('Missing device code.', {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
        return new Response(generatePluginAuthorizeHtml(deviceCode, email), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      if ((
        pathname === '/plugin/templates' ||
        pathname === '/plugin/templates/fulltext-elements' ||
        pathname === '/plugin/templates/node-types' ||
        pathname === '/plugin/fulltext-elements' ||
        pathname === '/plugin/node-templates'
      ) && request.method === 'GET') {
        try {
          const requestedPlugin = url.searchParams.get('plugin')
          const pluginValue = requestedPlugin === null ? 1 : ((requestedPlugin === '1' || requestedPlugin === 'true') ? 1 : 0)
          const explicitCategory = url.searchParams.get('category')

          let requestedCategory = explicitCategory
          let mode = 'fulltext-elements'
          let query
          let bindings

          if (pathname.endsWith('/node-types') || pathname === '/plugin/node-templates') {
            mode = 'node-templates'
            query = `
              SELECT
                id,
                name,
                nodes,
                edges,
                ai_instructions,
                category,
                thumbnail_path,
                standard_question,
                gemini,
                tool,
                plugin
              FROM graphTemplates
              WHERE plugin = ?
                AND category != 'Fulltext Elements'
                AND (? IS NULL OR category = ?)
              ORDER BY category, name
            `
            bindings = [pluginValue, requestedCategory, requestedCategory]
          } else {
            requestedCategory = requestedCategory || 'Fulltext Elements'
            query = `
              SELECT
                id,
                name,
                nodes,
                edges,
                ai_instructions,
                category,
                thumbnail_path,
                standard_question,
                gemini,
                tool,
                plugin
              FROM graphTemplates
              WHERE plugin = ?
                AND (? IS NULL OR category = ?)
              ORDER BY category, name
            `
            bindings = [pluginValue, requestedCategory, requestedCategory]
          }

          const results = await env.vegvisr_org.prepare(query).bind(...bindings).all()

          const templates = (results.results || []).map((template) => ({
            id: template.id,
            name: template.name,
            nodes: JSON.parse(template.nodes || '[]'),
            edges: JSON.parse(template.edges || '[]'),
            ai_instructions: template.ai_instructions || '',
            category: template.category || 'General',
            thumbnail_path: template.thumbnail_path || null,
            standard_question: template.standard_question || '',
            gemini: template.gemini || 0,
            tool: template.tool || 0,
            plugin: template.plugin || 0,
          }))

          return new Response(JSON.stringify({
            success: true,
            plugin: pluginValue,
            mode,
            category: requestedCategory,
            count: templates.length,
            results: templates,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Plugin] Error in plugin template/element listing:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/logout' && request.method === 'POST') {
        const headers = new Headers({ ...corsHeaders, 'Content-Type': 'application/json' })
        headers.append(
          'Set-Cookie',
          buildCookie('vegvisr_plugin_token', '', {
            path: '/',
            maxAge: 0,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
          }),
        )
        return new Response(JSON.stringify({ success: true, loggedOut: true }), {
          status: 200,
          headers,
        })
      }

      if (pathname === '/plugin/login/magic/send' && request.method === 'POST') {
        try {
          const body = await readJsonBody(request)
          const email = String(body.email || '').trim()
          if (!email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const redirectUrl = 'https://knowledge.vegvisr.org/plugin/callback'
          const response = await fetch('https://cookie.vegvisr.org/login/magic/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email, redirectUrl }),
          })
          const text = await response.text()
          let data
          try {
            data = JSON.parse(text)
          } catch {
            data = { raw: text }
          }

          return new Response(JSON.stringify({
            success: response.ok && data?.success !== false,
            email,
            redirectUrl,
            providerResponse: data,
          }), {
            status: response.ok ? 200 : response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/login/magic/send:', error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/plugin/callback' && request.method === 'GET') {
        try {
          const magic = url.searchParams.get('magic')
          const deviceCode = String(url.searchParams.get('device_code') || '').trim()
          if (!magic) {
            return new Response('Missing magic token.', {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
            })
          }

          const verifyResponse = await fetch(
            `https://cookie.vegvisr.org/login/magic/verify?token=${encodeURIComponent(magic)}`,
            { headers: { Accept: 'application/json' } },
          )
          const verifyText = await verifyResponse.text()
          let verifyData
          try {
            verifyData = JSON.parse(verifyText)
          } catch {
            verifyData = { raw: verifyText }
          }

          if (!verifyResponse.ok || !verifyData?.success || !verifyData?.email) {
            return new Response('Magic link verification failed.', {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
            })
          }

          const dashResult = await fetchDashJson(
            env,
            `/userdata?email=${encodeURIComponent(verifyData.email)}`,
            { method: 'GET', headers: { Accept: 'application/json' } },
          )

          if (!dashResult.ok || !dashResult.data?.emailVerificationToken) {
            return new Response('User token could not be resolved.', {
              status: dashResult.status || 502,
              headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
            })
          }

          if (deviceCode) {
            await pluginDevicePut(env, deviceCode, {
              status: 'approved',
              approvedAt: new Date().toISOString(),
              email: verifyData.email,
              token: dashResult.data.emailVerificationToken,
              user: {
                email: dashResult.data.email || verifyData.email || null,
                user_id: dashResult.data.user_id || null,
                oauth_id: dashResult.data.oauth_id || dashResult.data.user_id || null,
                role: dashResult.data.role || null,
                profileimage: dashResult.data.profileimage || null,
                phone: dashResult.data.phone || null,
                phoneVerifiedAt: dashResult.data.phoneVerifiedAt || null,
              },
            }, 900)
          }

          const location = deviceCode
            ? `/plugin/authorize?device_code=${encodeURIComponent(deviceCode)}&connected=1`
            : '/plugin/landing?connected=1'
          const headers = new Headers({ ...corsHeaders, Location: location })
          headers.append(
            'Set-Cookie',
            buildCookie(
              'vegvisr_plugin_token',
              encodeURIComponent(dashResult.data.emailVerificationToken),
              {
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
              },
            ),
          )

          return new Response(null, { status: 302, headers })
        } catch (error) {
          console.error('[Plugin] Error in /plugin/callback:', error)
          return new Response(`Plugin callback failed: ${error.message}`, {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      }

      if (pathname.startsWith('/plugin/api/')) {
        const rewritten = await rewritePluginApiRequest(request, env, corsHeaders, url)
        if (rewritten.response) return rewritten.response
        request = rewritten.request
        url = rewritten.url
        pathname = rewritten.pathname
      }

      const sanitizeGraphData = (graphData) => {
        const sanitize = (obj) =>
          Object.fromEntries(
            Object.entries(obj)
              .filter(([, value]) => value !== null) // Exclude null values
              .map(([key, value]) => [
                key,
                typeof value === 'object' && value !== null && !Array.isArray(value)
                  ? sanitize(value)
                  : value,
              ]),
          )

        return {
          ...graphData,
          nodes: graphData.nodes.map((node) => ({
            ...sanitize(node),
            visible: node.visible !== false, // Default to true if not set
            position: node.position || { x: 0, y: 0 },
            imageWidth: node.imageWidth || null,
            imageHeight: node.imageHeight || null,
            path: node.path || null, // Ensure path is included
          })),
          edges: graphData.edges.map((edge) => {
            const sanitizedEdge = sanitize(edge)
            return {
              id: edge.id || `${edge.source}_${edge.target}`,
              source: edge.source,
              target: edge.target,
              ...(sanitizedEdge.label !== undefined && { label: sanitizedEdge.label }),
              ...(sanitizedEdge.type !== undefined && { type: sanitizedEdge.type }),
              ...(sanitizedEdge.info !== undefined && { info: sanitizedEdge.info }),
            }
          }),
        }
      }

      const parseIntWithBounds = (rawValue, fallback, min, max) => {
        const parsed = Number.parseInt(rawValue ?? '', 10)
        if (Number.isNaN(parsed)) return fallback
        return Math.min(Math.max(parsed, min), max)
      }

      const resolveAllowedMetaAreas = async (hostname) => {
        if (!env.SITE_CONFIGS) {
          return null
        }

        try {
          const kvKey = `site-config:${hostname}`
          const siteConfigData = await env.SITE_CONFIGS.get(kvKey)

          if (!siteConfigData) {
            return null
          }

          const siteConfig = JSON.parse(siteConfigData)
          if (!siteConfig.contentFilter || !Array.isArray(siteConfig.contentFilter.metaAreas)) {
            return null
          }

          const normalized = siteConfig.contentFilter.metaAreas
            .map((area) => String(area || '').trim().toUpperCase())
            .filter(Boolean)

          return normalized.length ? normalized : null
        } catch (error) {
          console.error(`[Worker] Failed to resolve allowed meta areas for ${hostname}:`, error)
          return null
        }
      }

      const parseMetaAreas = (metaAreaString) => {
        if (!metaAreaString) return []
        return String(metaAreaString)
          .split('#')
          .map((token) => token.trim().toUpperCase())
          .filter(Boolean)
      }

      const parseMaybeJsonObject = (value) => {
        if (!value) return null
        if (typeof value === 'object') return value
        if (typeof value !== 'string') return null

        try {
          const parsed = JSON.parse(value)
          return parsed && typeof parsed === 'object' ? parsed : null
        } catch {
          return null
        }
      }

      if (pathname === '/theme/custom' && request.method === 'GET') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(
            JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        const userId = String(request.headers.get('x-user-id') || '').trim()
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, message: 'Missing x-user-id header.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        try {
          const ownPrefix = `${THEME_OWNER_PREFIX}${userId}:`
          const ownKeys = await listKvKeysByPrefix(env.THEME_STUDIO_KV, ownPrefix)
          const sharedKeys = await listKvKeysByPrefix(env.THEME_STUDIO_KV, THEME_SHARED_PREFIX)
          const byOwnerTheme = new Map()

          for (const key of [...ownKeys, ...sharedKeys]) {
            const raw = await env.THEME_STUDIO_KV.get(key)
            if (!raw) continue
            try {
              const record = JSON.parse(raw)
              if (!isThemeValid(record?.theme)) continue
              const owner = String(record.ownerUserId || 'unknown').trim()
              const compositeKey = `${owner}:${record.theme.id}`
              byOwnerTheme.set(compositeKey, record)
            } catch {
              // ignore malformed entries
            }
          }

          const records = [...byOwnerTheme.values()]
            .filter((record) => {
              if (record.ownerUserId === userId) return true
              return (record.visibility || 'shared') === 'shared'
            })
            .sort((a, b) => {
              const aTs = Date.parse(a.updatedAt || a.createdAt || '') || 0
              const bTs = Date.parse(b.updatedAt || b.createdAt || '') || 0
              return bTs - aTs
            })

          const themes = records.map((record) => ({
            ...record.theme,
            ownerUserId: record.ownerUserId,
            ownerEmail: record.ownerEmail || null,
            visibility: record.visibility || 'shared',
            createdAt: record.createdAt || null,
            updatedAt: record.updatedAt || null,
          }))

          return new Response(JSON.stringify({ success: true, themes }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              message: `Failed to load themes: ${error.message || 'Unknown error'}`,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      if (pathname === '/theme/custom' && request.method === 'POST') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(
            JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        const userId = String(request.headers.get('x-user-id') || '').trim()
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, message: 'Missing x-user-id header.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        const body = await readJsonBody(request)
        const theme = body?.theme
        const visibility = body?.visibility === 'private' ? 'private' : 'shared'
        if (!isThemeValid(theme)) {
          return new Response(JSON.stringify({ success: false, message: 'Invalid theme payload.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const themeId = normalizeThemeId(theme.id)
        if (!themeId) {
          return new Response(JSON.stringify({ success: false, message: 'Invalid theme id.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const ownerEmail = String(request.headers.get('x-user-email') || '').trim() || null
        const ownerKey = `${THEME_OWNER_PREFIX}${userId}:${themeId}`
        const sharedKey = `${THEME_SHARED_PREFIX}${themeId}:${userId}`
        const now = new Date().toISOString()

        try {
          const existingRaw = await env.THEME_STUDIO_KV.get(ownerKey)
          let createdAt = now
          if (existingRaw) {
            try {
              const parsed = JSON.parse(existingRaw)
              createdAt = parsed?.createdAt || now
            } catch {
              createdAt = now
            }
          }

          const normalizedTheme = {
            ...theme,
            id: themeId,
            visibility,
            ownerUserId: userId,
            ownerEmail,
            createdAt,
            updatedAt: now,
          }

          const record = {
            theme: normalizedTheme,
            ownerUserId: userId,
            ownerEmail,
            visibility,
            createdAt,
            updatedAt: now,
          }

          await env.THEME_STUDIO_KV.put(ownerKey, JSON.stringify(record))
          if (visibility === 'shared') {
            await env.THEME_STUDIO_KV.put(sharedKey, JSON.stringify(record))
          } else {
            await env.THEME_STUDIO_KV.delete(sharedKey)
          }

          return new Response(JSON.stringify({ success: true, theme: normalizedTheme }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              message: `Failed to save theme: ${error.message || 'Unknown error'}`,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      if (pathname === '/theme/custom' && request.method === 'DELETE') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(
            JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        const userId = String(request.headers.get('x-user-id') || '').trim()
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, message: 'Missing x-user-id header.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        const themeId = normalizeThemeId(url.searchParams.get('themeId') || '')
        if (!themeId) {
          return new Response(JSON.stringify({ success: false, message: 'Missing themeId.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const ownerKey = `${THEME_OWNER_PREFIX}${userId}:${themeId}`
        const sharedKey = `${THEME_SHARED_PREFIX}${themeId}:${userId}`
        await env.THEME_STUDIO_KV.delete(ownerKey)
        await env.THEME_STUDIO_KV.delete(sharedKey)

        return new Response(JSON.stringify({ success: true, deleted: true, themeId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (pathname === '/theme/catalog' && request.method === 'GET') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          const themes = await readThemeCatalog(env.THEME_STUDIO_KV)
          const metaRaw = await env.THEME_STUDIO_KV.get(THEME_CATALOG_META_KEY)
          const meta = metaRaw ? parseMaybeJsonObject(metaRaw) : null
          return new Response(JSON.stringify({ success: true, themes, meta }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, message: `Failed to load theme catalog: ${error.message || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      if (pathname === '/theme/catalog' && request.method === 'POST') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const userId = String(request.headers.get('x-user-id') || '').trim()
        if (!userId) {
          return new Response(JSON.stringify({ success: false, message: 'Missing x-user-id header.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const body = await readJsonBody(request)
        const theme = body?.theme
        if (!isThemeValid(theme)) {
          return new Response(JSON.stringify({ success: false, message: 'Invalid theme payload.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          const now = new Date().toISOString()
          const themeId = normalizeThemeId(theme.id) || normalizeThemeId(theme.label)
          const normalizedTheme = {
            ...theme,
            id: themeId,
            ownerUserId: theme.ownerUserId || userId,
            ownerEmail: theme.ownerEmail || String(request.headers.get('x-user-email') || '').trim() || null,
            visibility: theme.visibility === 'private' ? 'private' : 'shared',
            createdAt: theme.createdAt || now,
            updatedAt: now,
          }

          const existing = await readThemeCatalog(env.THEME_STUDIO_KV)
          const next = [normalizedTheme, ...existing.filter((t) => String(t?.id || '') !== themeId)].slice(0, 400)
          await writeThemeCatalog(env.THEME_STUDIO_KV, next, {
            updatedAt: now,
            updatedBy: userId,
            count: next.length,
          })

          return new Response(JSON.stringify({ success: true, theme: normalizedTheme, count: next.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, message: `Failed to upsert theme: ${error.message || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      if (pathname === '/theme/catalog/sync-from-graph' && request.method === 'POST') {
        if (!env.THEME_STUDIO_KV) {
          return new Response(JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const userRole = String(request.headers.get('x-user-role') || '').trim()
        if (userRole !== 'Superadmin') {
          return new Response(JSON.stringify({ success: false, message: 'Superadmin role required.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const body = await readJsonBody(request)
        const graphId = String(body?.graphId || '').trim()
        if (!graphId) {
          return new Response(JSON.stringify({ success: false, message: 'graphId is required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          const query = `SELECT data FROM knowledge_graphs WHERE id = ?`
          const result = await env.vegvisr_org.prepare(query).bind(graphId).first()
          if (!result) {
            return new Response(JSON.stringify({ success: false, message: 'Graph not found.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))
          const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []

          const themes = []
          const usedIds = new Set()
          for (const node of nodes) {
            if (String(node?.type || '').toLowerCase() !== 'html-node') continue
            const html = String(node?.info || '')
            if (!html || (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<!doctype'))) continue
            const theme = buildThemeFromHtmlNode(node)
            if (!isThemeValid(theme)) continue
            let themeId = normalizeThemeId(theme.id)
            if (!themeId) continue
            if (usedIds.has(themeId)) themeId = `${themeId}-${String(node.id || '').slice(-6)}`
            usedIds.add(themeId)

            themes.push({
              ...theme,
              id: themeId,
              visibility: 'shared',
              sourceGraphId: graphId,
              sourceHtmlNodeId: String(node?.id || ''),
              updatedAt: new Date().toISOString(),
            })
          }

          const now = new Date().toISOString()
          await writeThemeCatalog(env.THEME_STUDIO_KV, themes, {
            sourceGraphId: graphId,
            syncedAt: now,
            count: themes.length,
          })

          return new Response(JSON.stringify({ success: true, graphId, count: themes.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, message: `Catalog sync failed: ${error.message || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      if (pathname === '/theme/sync-from-graph' && request.method === 'POST') {
        // Backwards-compatible: sync the catalog (single KV key) instead of deleting per-theme keys.
        if (!env.THEME_STUDIO_KV) {
          return new Response(JSON.stringify({ success: false, message: 'THEME_STUDIO_KV binding missing.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const userRole = String(request.headers.get('x-user-role') || '').trim()
        if (userRole !== 'Superadmin') {
          return new Response(JSON.stringify({ success: false, message: 'Superadmin role required.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const body = await readJsonBody(request)
        const graphId = String(body?.graphId || '').trim()
        if (!graphId) {
          return new Response(JSON.stringify({ success: false, message: 'graphId is required.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        try {
          const query = `SELECT data FROM knowledge_graphs WHERE id = ?`
          const result = await env.vegvisr_org.prepare(query).bind(graphId).first()
          if (!result) {
            return new Response(JSON.stringify({ success: false, message: 'Graph not found.' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))
          const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : []

          const themes = []
          const usedIds = new Set()
          for (const node of nodes) {
            if (String(node?.type || '').toLowerCase() !== 'html-node') continue
            const html = String(node?.info || '')
            if (!html || (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<!doctype'))) continue
            const theme = buildThemeFromHtmlNode(node)
            if (!isThemeValid(theme)) continue
            let themeId = normalizeThemeId(theme.id)
            if (!themeId) continue
            if (usedIds.has(themeId)) themeId = `${themeId}-${String(node.id || '').slice(-6)}`
            usedIds.add(themeId)

            themes.push({
              ...theme,
              id: themeId,
              visibility: 'shared',
              sourceGraphId: graphId,
              sourceHtmlNodeId: String(node?.id || ''),
              updatedAt: new Date().toISOString(),
            })
          }

          const now = new Date().toISOString()
          await writeThemeCatalog(env.THEME_STUDIO_KV, themes, {
            sourceGraphId: graphId,
            syncedAt: now,
            count: themes.length,
          })

          return new Response(JSON.stringify({ success: true, graphId, count: themes.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, message: `Catalog sync failed: ${error.message || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      // Render a page in a REAL browser and return its Markdown.
      //
      // Why this exists: a Worker only has fetch(), which gets bytes and does not run
      // JavaScript. Two things defeat a plain fetch on the modern web — Cloudflare bot
      // mitigation (cf-mitigated: challenge -> 403, even on fully public pages) and pages
      // whose content is built by JavaScript, where fetch returns an empty app shell.
      // Browser Rendering solves both: a real browser passes the challenge and runs the JS.
      //
      // Uses the /markdown Quick Action, so the result drops straight into a knowledge-graph
      // node (nodes already carry markdown) with no further cleanup.
      if (pathname === '/renderUrl' && request.method === 'POST') {
        try {
          const { url: targetUrl } = await request.json()
          if (!targetUrl || typeof targetUrl !== 'string') {
            return new Response(
              JSON.stringify({ error: 'url (string) is required.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }
          if (!/^https?:\/\//i.test(targetUrl)) {
            return new Response(
              JSON.stringify({ error: 'url must start with http:// or https://' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }
          if (!env.BROWSER) {
            return new Response(
              JSON.stringify({ error: 'Browser Rendering binding not available on this deployment.' }),
              { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }

          console.log(`[Worker] renderUrl: ${targetUrl}`)
          // quickAction returns a Response, not data — Cloudflare's own example returns it
          // straight out of fetch(). Read the body, then unwrap: the markdown action answers
          // with { success, result }, but fall back to the raw body if it ever answers plain.
          const upstream = await env.BROWSER.quickAction('markdown', { url: targetUrl })
          const body = await upstream.text()
          if (!upstream.ok) {
            console.error(`[Worker] renderUrl upstream ${upstream.status}: ${body.slice(0, 300)}`)
            return new Response(
              JSON.stringify({ error: `Browser Rendering returned ${upstream.status}`, details: body.slice(0, 500) }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            )
          }
          let text = body
          try {
            const parsed = JSON.parse(body)
            if (parsed && typeof parsed === 'object' && 'result' in parsed) text = parsed.result
          } catch { /* not JSON — the body IS the markdown */ }

          console.log(`[Worker] renderUrl: ${targetUrl} -> ${String(text).length} chars`)
          return new Response(
            JSON.stringify({ success: true, url: targetUrl, markdown: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        } catch (error) {
          console.error('[Worker] renderUrl failed:', error?.message)
          return new Response(
            JSON.stringify({ error: `Render failed: ${error?.message || 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      // OpenAPI Specification endpoint
      if (pathname === '/openapi.json' && request.method === 'GET') {
        const openApiSpec = {
          openapi: '3.0.3',
          info: {
            title: 'Vegvisr Knowledge Graph API',
            version: '1.0.0',
            description: 'API for managing knowledge graphs in the Vegvisr ecosystem. Use this API to create, read, update, and delete knowledge graphs with full version history support.',
            contact: {
              name: 'Vegvisr',
              url: 'https://vegvisr.org'
            }
          },
          servers: [
            {
              url: 'https://knowledge-graph-worker.torarnehave.workers.dev',
              description: 'Production server'
            }
          ],
          paths: {
            '/health': {
              get: {
                summary: 'Health check',
                description: 'Returns health status for the knowledge worker.',
                operationId: 'healthCheck',
                responses: {
                  '200': {
                    description: 'Worker is healthy',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            worker: { type: 'string' },
                            timestamp: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/openapi.json': {
              get: {
                summary: 'OpenAPI specification',
                description: 'Returns the OpenAPI 3.0 specification for the knowledge worker.',
                operationId: 'getOpenApiSpec',
                responses: {
                  '200': {
                    description: 'OpenAPI JSON'
                  }
                }
              }
            },
            '/renderUrl': {
              post: {
                summary: 'Render a page in a real browser and return its Markdown',
                description: 'Opens the URL in a real browser (Cloudflare Browser Rendering), lets its JavaScript build the page, and returns the content as Markdown.\n\nUSE THIS INSTEAD OF a plain fetch when a page fails to load or comes back empty. Two things defeat an ordinary HTTP fetch on the modern web: Cloudflare bot mitigation (returns 403 with cf-mitigated: challenge, even on fully public pages), and pages whose content is built by JavaScript (an ordinary fetch gets an empty app shell). A real browser handles both.\n\nCosts more than a plain fetch — a browser is started per call — so reach for it when a normal fetch has failed or returned nothing useful, not by default.',
                operationId: 'renderUrl',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['url'],
                        properties: {
                          url: {
                            type: 'string',
                            description: 'The page to render. Must start with http:// or https://'
                          }
                        }
                      },
                      example: { url: 'https://example.com' }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'The rendered page as Markdown',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            url: { type: 'string' },
                            markdown: { type: 'string', description: 'Page content as Markdown — styling and scripts stripped, links kept' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'url missing, or not an http(s) URL' },
                  '503': { description: 'Browser Rendering is not available on this deployment' },
                  '500': { description: 'The render failed — the message carries the reason' }
                }
              }
            },
            '/plugin/fulltext-elements': {
              get: {
                summary: 'List fulltext-element definitions (source of truth for element syntax)',
                description: "Returns the canonical catalog of fulltext elements ([FANCY], [SECTION], [FLEXBOX-CARDS], [QUOTE], [WNOTE], image variants, etc.) used inside a fulltext node's info field. ALWAYS read this before authoring or editing element markup in a graph node — each element's ai_instructions carries the exact trigger, format template, and allowed parameters. Do not write element syntax from memory. Backed by the graphTemplates table where category='Fulltext Elements'.",
                operationId: 'getFulltextElements',
                parameters: [
                  {
                    name: 'plugin',
                    in: 'query',
                    required: false,
                    description: 'Filter to plugin-enabled templates. Accepts 1/true (default) or 0.',
                    schema: { type: 'string', enum: ['0', '1', 'true'] }
                  },
                  {
                    name: 'category',
                    in: 'query',
                    required: false,
                    description: "Template category. Defaults to 'Fulltext Elements' for this endpoint.",
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': {
                    description: 'Catalog of fulltext elements',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            plugin: { type: 'integer' },
                            mode: { type: 'string', example: 'fulltext-elements' },
                            category: { type: 'string', example: 'Fulltext Elements' },
                            count: { type: 'integer' },
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  name: { type: 'string', description: 'Element display name, e.g. FLEXBOX-CARDS' },
                                  ai_instructions: { type: 'string', description: 'JSON string: { kind, trigger, insert_mode, format, parameters, notes }. Use format + parameters verbatim; do not invent params.' },
                                  category: { type: 'string' },
                                  nodes: { type: 'array', items: { type: 'object' } },
                                  edges: { type: 'array', items: { type: 'object' } },
                                  thumbnail_path: { type: 'string', nullable: true },
                                  standard_question: { type: 'string' },
                                  gemini: { type: 'integer' },
                                  tool: { type: 'integer' },
                                  plugin: { type: 'integer' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/saveknowgraph': {
              post: {
                summary: 'Save knowledge graph (legacy)',
                description: 'Legacy graph save endpoint. Prefer /saveGraphWithHistory for versioned saves.',
                operationId: 'saveKnowGraphLegacy',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          data: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph saved' }
                }
              }
            },
            '/updateknowgraph': {
              post: {
                summary: 'Update knowledge graph (legacy)',
                description: 'Legacy graph update endpoint. Prefer /patchNode and /patchGraphMetadata for incremental updates.',
                operationId: 'updateKnowGraphLegacy',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          data: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph updated' }
                }
              }
            },
            '/saveGraphWithHistory': {
              post: {
                summary: 'Save graph with version history',
                description: 'Creates a new graph or updates an existing one with automatic version history. Recommended endpoint for apps. Requires graph:write scope.',
                operationId: 'saveGraphWithHistory',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/SaveGraphRequest' },
                      // (Note: example below uses UUID v4 because /saveGraphWithHistory
                      //  enforces it for new graphs. Existing semantic-named graphs may
                      //  still update at their current id for backward compatibility.)
                      example: {
                        id: '550e8400-e29b-41d4-a716-446655440000',
                        graphData: {
                          metadata: {
                            title: 'My Knowledge Graph',
                            description: 'A sample graph',
                            createdBy: 'my-app',
                            version: 0
                          },
                          nodes: [
                            {
                              id: 'node-uuid-here',
                              label: 'Sample Node',
                              color: '#4f6d7a',
                              type: 'fulltext',
                              info: '# Markdown content here',
                              bibl: ['https://source.com'],
                              position: { x: 0, y: 0 },
                              visible: true
                            }
                          ],
                          edges: []
                        },
                        override: false
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Graph saved successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string' },
                            id: { type: 'string' },
                            newVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Invalid request - missing id or graphData' },
                  '409': { description: 'Version mismatch - reload latest version' }
                }
              }
            },
            '/getknowgraph': {
              get: {
                summary: 'Get a single graph by ID',
                description: 'Retrieves a knowledge graph with all its nodes and edges. Accepts an optional X-API-Token with graph:read scope — if provided the token is validated and an invalid token returns 401. Without a token the graph is returned if it exists (backward compatible).',
                operationId: 'getKnowGraph',
                security: [{ ApiTokenAuth: ['graph:read'] }, {}],
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID'
                  },
                  {
                    name: 'nodeId',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Optional node ID to filter the graph nodes'
                  },
                  {
                    name: 'nodeTitle',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Optional substring match on node label/title'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Graph data',
                    content: {
                      'application/json': {
                        schema: { $ref: '#/components/schemas/GraphData' }
                      }
                    }
                  },
                  '401': { description: 'Invalid or expired API token' },
                  '403': { description: 'Token lacks graph:read scope' },
                  '404': { description: 'Graph not found' }
                }
              }
            },
            '/getknowgraphs': {
              get: {
                summary: 'List all graphs',
                description: 'Returns a list of knowledge graphs (id and title only). Without authentication only graphs with publicationState=published or a seoSlug are returned. Provide X-API-Token with graph:read scope to retrieve all graphs including drafts. Trusted origins (vegvisr.org) and session-based auth (x-user-role) also return all graphs.',
                operationId: 'getKnowGraphs',
                security: [{ ApiTokenAuth: ['graph:read'] }, {}],
                responses: {
                  '200': {
                    description: 'List of graphs. Unauthenticated callers only receive published graphs.',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  title: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Invalid or expired API token' },
                  '403': { description: 'Token lacks graph:read scope' }
                }
              }
            },
            '/getknowgraphhistory': {
              get: {
                summary: 'Get version history for a graph',
                description: 'Returns all saved versions of a graph (up to 20 most recent).',
                operationId: 'getKnowGraphHistory',
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Version history',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  version: { type: 'integer' },
                                  created_at: { type: 'string', format: 'date-time' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/getEditTimeline': {
              get: {
                summary: 'Get edit timeline for all graphs',
                description: 'Returns a lightweight list of all edit events (graph_id, version, timestamp) ordered by timestamp. Used for visualizing edit activity over time.',
                operationId: 'getEditTimeline',
                parameters: [],
                responses: {
                  '200': {
                    description: 'Edit timeline data',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            total: { type: 'integer' },
                            edits: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  graph_id: { type: 'string' },
                                  version: { type: 'integer' },
                                  timestamp: { type: 'string', format: 'date-time' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/getknowgraphversion': {
              get: {
                summary: 'Get specific version of a graph',
                description: 'Retrieves a specific historical version of a graph.',
                operationId: 'getKnowGraphVersion',
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID'
                  },
                  {
                    name: 'version',
                    in: 'query',
                    required: true,
                    schema: { type: 'integer' },
                    description: 'The version number'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Graph data for the specified version',
                    content: {
                      'application/json': {
                        schema: { $ref: '#/components/schemas/GraphData' }
                      }
                    }
                  },
                  '404': { description: 'Version not found' }
                }
              }
            },
            '/duplicateknowgraph': {
              post: {
                summary: 'Duplicate an existing graph',
                description: 'Creates a copy of an existing graph with a new ID and title. Requires graph:write scope.',
                operationId: 'duplicateKnowGraph',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['sourceId', 'newId', 'newTitle'],
                        properties: {
                          sourceId: { type: 'string', description: 'ID of the graph to duplicate' },
                          newId: { type: 'string', description: 'ID for the new graph' },
                          newTitle: { type: 'string', description: 'Title for the new graph' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph duplicated successfully' },
                  '404': { description: 'Source graph not found' }
                }
              }
            },
            '/getTrash': {
              get: {
                summary: 'List trashed graphs',
                description: 'Returns graphs moved to trash in the last 30 days. Requires graph:delete scope.',
                operationId: 'getTrash',
                security: [{ ApiTokenAuth: ['graph:delete'] }],
                responses: {
                  '200': {
                    description: 'List of trashed graphs',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', description: 'Trash entry ID' },
                                  graph_id: { type: 'string', description: 'Original graph ID' },
                                  title: { type: 'string' },
                                  deleted_by: { type: 'string' },
                                  deleted_at: { type: 'string', format: 'date-time' },
                                  expires_at: { type: 'string', format: 'date-time' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Authentication required' },
                  '403': { description: 'Token lacks graph:delete scope' }
                }
              }
            },
            '/video-progress': {
              get: {
                summary: 'Get completed onboarding video keys for a founder',
                description: 'Returns the list of video_key values the given email has marked completed. Caller must be Superadmin or the email owner (via X-API-Token).',
                operationId: 'getVideoProgress',
                parameters: [
                  { name: 'email', in: 'query', required: true, schema: { type: 'string' }, description: 'Founder email to look up' }
                ],
                responses: {
                  '200': {
                    description: 'Completed video keys',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            email: { type: 'string' },
                            completed: { type: 'array', items: { type: 'string' } }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'email parameter is required' },
                  '401': { description: 'Authentication required' },
                  '403': { description: 'Not authorized for that email' }
                }
              },
              post: {
                summary: 'Mark an onboarding video as completed',
                description: 'Marks the given video_key as completed for the given email. Caller must be Superadmin or the email owner (via X-API-Token).',
                operationId: 'setVideoProgress',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['email', 'video_key'],
                        properties: {
                          email: { type: 'string' },
                          video_key: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Video marked as completed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' } } } } } },
                  '400': { description: 'email and video_key are required' },
                  '401': { description: 'Authentication required' },
                  '403': { description: 'Not authorized for that email' }
                }
              }
            },
            '/onboarding-status': {
              get: {
                summary: 'Get founder onboarding status report',
                description: 'Returns onboarding/setup status for a founder: World domain resolution, config/secret presence, knowledge graph count, and chat engagement. Caller must be Superadmin, or hold a token whose own email matches the requested email.',
                operationId: 'getOnboardingStatus',
                parameters: [
                  { name: 'email', in: 'query', required: true, schema: { type: 'string' }, description: 'Founder or account-holder email to report on' },
                  { name: 'domain', in: 'query', required: false, schema: { type: 'string' }, description: 'World domain to check; auto-derived from email or the world_founders registry when omitted' }
                ],
                responses: {
                  '200': { description: 'Onboarding status report', content: { 'application/json': { schema: { type: 'object' } } } },
                  '400': { description: 'email parameter is required' },
                  '403': { description: 'Superadmin required, or a token matching the requested email' }
                }
              }
            },
            '/restoreGraph': {
              post: {
                summary: 'Restore a graph from trash',
                description: 'Restores a trashed graph and its history back to the knowledge graphs table. Requires graph:write scope.',
                operationId: 'restoreGraph',
                security: [{ ApiTokenAuth: ['graph:write'] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['trashId'],
                        properties: {
                          trashId: { type: 'string', description: 'The trash entry ID from /getTrash' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph restored successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, graphId: { type: 'string' } } } } } },
                  '401': { description: 'Authentication required' },
                  '403': { description: 'Token lacks graph:write scope' },
                  '404': { description: 'Trash entry not found or expired' }
                }
              }
            },
            '/deleteknowgraph': {
              post: {
                summary: 'Delete a graph',
                description: 'Moves a graph to trash (30-day retention) then permanently deletes it. Requires graph:delete scope.',
                operationId: 'deleteKnowGraph',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['id'],
                        properties: {
                          id: { type: 'string', description: 'ID of the graph to delete' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph deleted successfully' }
                }
              }
            },
            '/public-graph': {
              get: {
                summary: 'Get graph as HTML',
                description: 'Returns the graph rendered as HTML for SEO and AI crawling purposes.',
                operationId: 'getPublicGraph',
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID'
                  }
                ],
                responses: {
                  '200': {
                    description: 'HTML representation of the graph',
                    content: {
                      'text/html': {
                        schema: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            '/slideshow': {
              get: {
                summary: 'Generate slideshow from fulltext node',
                description: 'Renders a fulltext node as an HTML slideshow presentation.',
                operationId: 'getSlideshow',
                parameters: [
                  {
                    name: 'graphId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID'
                  },
                  {
                    name: 'nodeId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The node ID containing slideshow content'
                  },
                  {
                    name: 'theme',
                    in: 'query',
                    required: false,
                    schema: { type: 'string', default: 'nibi' },
                    description: 'Slideshow theme'
                  }
                ],
                responses: {
                  '200': {
                    description: 'HTML slideshow',
                    content: {
                      'text/html': {
                        schema: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            '/getTemplates': {
              get: {
                summary: 'List graph templates',
                description: 'Returns all graph templates. Requires X-API-Token with graph:read scope, a session (x-user-role), or a trusted origin.',
                operationId: 'getTemplates',
                security: [{ ApiTokenAuth: ['graph:read'] }],
                responses: {
                  '200': {
                    description: 'List of templates',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Template' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Authentication required or invalid token' },
                  '403': { description: 'Token lacks graph:read scope' }
                }
              }
            },
            '/updateTemplate': {
              post: {
                summary: 'Update an existing template',
                description: 'Updates fields on an existing graph template. Only provided fields are updated. Requires template:write scope.',
                operationId: 'updateTemplate',
                security: [{ ApiTokenAuth: ['template:write'] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['id'],
                        properties: {
                          id: { type: 'string', description: 'Template ID to update' },
                          name: { type: 'string' },
                          node: { type: 'object', description: 'Node definition' },
                          edges: { type: 'array' },
                          ai_instructions: { type: 'string' },
                          category: { type: 'string' },
                          userId: { type: 'string' },
                          tool: { type: 'boolean' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Template updated', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, id: { type: 'string' } } } } } },
                  '400': { description: 'Missing id or no fields to update' },
                  '401': { description: 'Authentication required' },
                  '403': { description: 'Token lacks template:write scope' }
                }
              }
            },
            '/addTemplate': {
              post: {
                summary: 'Add a new template',
                description: 'Creates a new graph template. Requires template:write scope.',
                operationId: 'addTemplate',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Template' }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Template added successfully' }
                }
              }
            },
            '/addNode': {
              post: {
                summary: 'Add a node to a graph',
                description: 'Adds a new node to an existing graph without requiring download of the entire graph. Requires graph:write scope.',
                operationId: 'addNode',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'node'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID to add the node to' },
                          node: { $ref: '#/components/schemas/Node', description: 'The node object to add (must include unique id)' }
                        }
                      },
                      example: {
                        graphId: 'graph_1234567890',
                        node: {
                          id: 'node-unique-id',
                          label: 'New Node',
                          type: 'fulltext',
                          color: '#4f6d7a',
                          info: '# Node content here',
                          position: { x: 0, y: 0 },
                          visible: true
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Node added successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            graphId: { type: 'string' },
                            nodeId: { type: 'string' },
                            newVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '404': { description: 'Graph not found' },
                  '409': { description: 'Node with this ID already exists' }
                }
              }
            },
            '/addEdge': {
              post: {
                summary: 'Add an edge to a graph',
                description: 'Adds a new edge to an existing graph without requiring download of the entire graph. Requires graph:write scope.',
                operationId: 'addEdge',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'edge'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID to add the edge to' },
                          edge: { $ref: '#/components/schemas/Edge', description: 'The edge object to add (must include source and target; id is optional)' }
                        }
                      },
                      example: {
                        graphId: 'graph_1234567890',
                        edge: {
                          source: 'node-a',
                          target: 'node-b',
                          label: 'relates to'
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Edge added successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            graphId: { type: 'string' },
                            edgeId: { type: 'string' },
                            newVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId or invalid edge payload' },
                  '404': { description: 'Graph or referenced node not found' },
                  '409': { description: 'Edge with this ID already exists or the source-target pair already exists' }
                }
              }
            },
            '/removeNode': {
              post: {
                summary: 'Remove a node from a graph',
                description: 'Removes a node from an existing graph without requiring download of the entire graph. Optionally removes connected edges. Requires graph:write scope.',
                operationId: 'removeNode',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'nodeId'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID to remove the node from' },
                          nodeId: { type: 'string', description: 'The node ID to remove' },
                          removeEdges: { type: 'boolean', default: true, description: 'Whether to also remove edges connected to this node' }
                        }
                      },
                      example: {
                        graphId: 'graph_1234567890',
                        nodeId: 'node-to-remove',
                        removeEdges: true
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Node removed successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            graphId: { type: 'string' },
                            nodeId: { type: 'string' },
                            newVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '404': { description: 'Graph or node not found' }
                }
              }
            },
            '/patchNode': {
              post: {
                summary: 'Update node fields',
                description: 'Updates specific fields of an existing node without requiring download of the entire graph. Requires graph:write scope.\n\nOPTIMISTIC CONCURRENCY — expectedVersion is REQUIRED. This endpoint is a read-modify-write over the whole graph JSON, so a concurrent write would otherwise be silently clobbered. Read metadata.version from getknowgraph and send it as expectedVersion; if the graph changed in between, the write is refused with 409 and the response carries currentVersion so you can re-read and retry. Omitting it returns 400, not a successful write.',
                operationId: 'patchNode',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'nodeId', 'fields', 'expectedVersion'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID' },
                          nodeId: { type: 'string', description: 'The node ID to update' },
                          fields: {
                            type: 'object',
                            description: 'Object containing fields to update (id cannot be changed)',
                            additionalProperties: true
                          },
                          expectedVersion: {
                            type: 'integer',
                            description: "The graph's current metadata.version, as returned by getknowgraph. Must be an integer — the write is rejected (409) if the graph has moved on."
                          }
                        }
                      },
                      example: {
                        graphId: 'graph_1234567890',
                        nodeId: 'node-to-update',
                        expectedVersion: 12,
                        fields: {
                          label: 'Updated Label',
                          color: '#ff0000',
                          info: 'Updated content here'
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Node updated successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            ok: { type: 'boolean' },
                            graphId: { type: 'string' },
                            nodeId: { type: 'string' },
                            newVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'graphId, nodeId, fields (object), and expectedVersion (integer) are all required' },
                  '404': { description: 'Graph or node not found' },
                  '409': {
                    description: 'Version mismatch — the graph changed since expectedVersion was read. Re-read the graph and retry.',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            error: { type: 'string' },
                            currentVersion: { type: 'integer', description: 'Send this as expectedVersion on the retry' },
                            expectedVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/patchGraphMetadata': {
              post: {
                summary: 'Update graph metadata fields',
                description: 'Updates graph-level metadata without changing nodes/edges. Requires graph:write scope.\n\nOPTIMISTIC CONCURRENCY — expectedVersion is REQUIRED, same contract as patchNode. Read metadata.version from getknowgraph and send it; a concurrent write returns 409 with currentVersion. Omitting it returns 400.',
                operationId: 'patchGraphMetadata',
                security: [{ ApiTokenAuth: [] }],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'fields', 'expectedVersion'],
                        properties: {
                          graphId: { type: 'string' },
                          fields: { type: 'object', additionalProperties: true },
                          expectedVersion: {
                            type: 'integer',
                            description: "The graph's current metadata.version, as returned by getknowgraph."
                          }
                        }
                      },
                      example: {
                        graphId: 'graph_1234567890',
                        expectedVersion: 12,
                        fields: { title: 'Updated title', metaArea: '#SYSTEM #BILLING' }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph metadata updated' },
                  '400': { description: 'graphId, fields (object), and expectedVersion (integer) are all required' },
                  '404': { description: 'Graph not found' },
                  '409': {
                    description: 'Version mismatch — the graph changed since expectedVersion was read. Re-read the graph and retry.',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            error: { type: 'string' },
                            currentVersion: { type: 'integer', description: 'Send this as expectedVersion on the retry' },
                            expectedVersion: { type: 'integer' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '/getGraphsByUser': {
              get: {
                summary: 'Get graphs created by a specific user',
                description: 'Returns graphs filtered by userId and optionally by sourceApp. Useful for showing a user their own graphs.',
                operationId: 'getGraphsByUser',
                parameters: [
                  {
                    name: 'userId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The user ID to fetch graphs for'
                  },
                  {
                    name: 'sourceApp',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Filter graphs by source application'
                  },
                  {
                    name: 'limit',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', default: 50 },
                    description: 'Maximum number of results to return'
                  }
                ],
                responses: {
                  '200': {
                    description: 'List of graphs belonging to the user',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            graphs: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  title: { type: 'string' },
                                  description: { type: 'string' },
                                  createdAt: { type: 'string', format: 'date-time' },
                                  updatedAt: { type: 'string', format: 'date-time' },
                                  userId: { type: 'string' },
                                  sourceApp: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing userId parameter' }
                }
              }
            },
            '/getmetaareas': {
              get: {
                summary: 'Get unique meta areas and categories with graph counts',
                description: 'Returns all unique meta areas and categories aggregated across all graphs, sorted by frequency. Without auth only published graphs are counted. Provide X-API-Token with graph:read to count all graphs including drafts.',
                operationId: 'getMetaAreas',
                security: [{ ApiTokenAuth: ['graph:read'] }, {}],
                responses: {
                  '200': {
                    description: 'Meta areas and categories with counts',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            metaAreas: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  count: { type: 'integer' }
                                }
                              }
                            },
                            categories: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  count: { type: 'integer' }
                                }
                              }
                            },
                            privileged: { type: 'boolean', description: 'Whether the request was authenticated' }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Invalid or expired API token' },
                  '403': { description: 'Token lacks graph:read scope' }
                }
              }
            },
            '/getGraphsByCreator': {
              get: {
                summary: 'Count and list graphs by creator email',
                description:
                  'Returns the total count of graphs whose metadata.createdBy equals the given email, plus a limited list. Single json_extract query — use this instead of paging /getknowgraphsummaries to count a creator\'s graphs.',
                operationId: 'getGraphsByCreator',
                parameters: [
                  { name: 'email', in: 'query', required: true, schema: { type: 'string' }, description: 'Creator email (metadata.createdBy) to count/list' },
                  { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 50 }, description: 'Max graphs to list (count is always the full total)' }
                ],
                responses: {
                  '200': {
                    description: 'Count and list of graphs by this creator',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            email: { type: 'string' },
                            count: { type: 'integer' },
                            graphs: { type: 'array', items: { type: 'object' } }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'email parameter is required' }
                }
              }
            },
            '/getknowgraphsummaries': {
              get: {
                summary: 'List graph summaries with pagination',
                description: 'Returns paginated graph summaries including metadata, node counts, node types, and search text. Without authentication only graphs with publicationState=published or a seoSlug are returned. Provide X-API-Token with graph:read scope to retrieve all graphs including drafts. Trusted origins (vegvisr.org) and session-based auth (x-user-role) also return all graphs.',
                operationId: 'getKnowGraphSummaries',
                security: [{ ApiTokenAuth: ['graph:read'] }, {}],
                parameters: [
                  {
                    name: 'offset',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', default: 0 },
                    description: 'Pagination offset (0-1000000)'
                  },
                  {
                    name: 'limit',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', default: 80 },
                    description: 'Number of results per page (1-250)'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Paginated graph summaries',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  title: { type: 'string' },
                                  createdAt: { type: 'string', format: 'date-time' },
                                  updatedAt: { type: 'string', format: 'date-time' },
                                  nodeCount: { type: 'integer' },
                                  edgeCount: { type: 'integer' },
                                  nodeTypes: { type: 'array', items: { type: 'string' } },
                                  nodeLabelsText: { type: 'string' },
                                  metadata: {
                                    type: 'object',
                                    properties: {
                                      title: { type: 'string' },
                                      description: { type: 'string' },
                                      createdBy: { type: 'string' },
                                      version: { type: 'integer' },
                                      category: { type: 'string' },
                                      metaArea: { type: 'string' },
                                      publicationState: { type: 'string' },
                                      isThemeGraph: { type: 'boolean' }
                                    }
                                  }
                                }
                              }
                            },
                            total: { type: 'integer' },
                            limit: { type: 'integer' },
                            offset: { type: 'integer' },
                            hasMore: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Invalid or expired API token' },
                  '403': { description: 'Token lacks graph:read scope' }
                }
              }
            },
            '/searchGraphs': {
              get: {
                summary: 'Search and filter knowledge graphs',
                description: 'Search graphs by free text (title, description, category, node labels), filter by node type or category. Without auth only published graphs are searched. Provide X-API-Token with graph:read to search all graphs including drafts.',
                operationId: 'searchGraphs',
                security: [{ ApiTokenAuth: ['graph:read'] }, {}],
                parameters: [
                  {
                    name: 'q',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Free text search across title, description, category, and node labels'
                  },
                  {
                    name: 'nodeType',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Filter to graphs containing this node type (e.g. "youtube-video", "html-node", "mermaid-diagram", "chart")'
                  },
                  {
                    name: 'category',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'Filter by category hashtag (e.g. "#Health", "Neuroscience")'
                  },
                  {
                    name: 'limit',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', default: 20 },
                    description: 'Max results to return (1-50)'
                  },
                  {
                    name: 'offset',
                    in: 'query',
                    required: false,
                    schema: { type: 'integer', default: 0 },
                    description: 'Pagination offset'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Matching graphs',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  title: { type: 'string' },
                                  description: { type: 'string' },
                                  category: { type: 'string' },
                                  metaArea: { type: 'string' },
                                  nodeCount: { type: 'integer' },
                                  nodeTypes: { type: 'array', items: { type: 'string' } },
                                  updatedAt: { type: 'string' }
                                }
                              }
                            },
                            total: { type: 'integer' },
                            limit: { type: 'integer' },
                            offset: { type: 'integer' },
                            hasMore: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Invalid or expired API token' },
                  '403': { description: 'Token lacks graph:read scope' }
                }
              }
            },
            '/theme/custom': {
              get: {
                summary: 'Get custom themes for a user',
                description: 'Returns all custom themes owned by the specified user.',
                operationId: 'getCustomThemes',
                parameters: [
                  {
                    name: 'x-user-id',
                    in: 'header',
                    required: true,
                    schema: { type: 'string' },
                    description: 'User ID to fetch themes for'
                  }
                ],
                responses: {
                  '200': {
                    description: 'List of custom themes',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            themes: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Theme' }
                            }
                          }
                        }
                      }
                    }
                  },
                  '401': { description: 'Missing x-user-id header' }
                }
              },
              post: {
                summary: 'Save a custom theme',
                description: 'Creates or updates a custom theme for the authenticated user.',
                operationId: 'saveCustomTheme',
                parameters: [
                  {
                    name: 'x-user-id',
                    in: 'header',
                    required: true,
                    schema: { type: 'string' },
                    description: 'User ID'
                  },
                  {
                    name: 'x-user-email',
                    in: 'header',
                    required: false,
                    schema: { type: 'string' },
                    description: 'User email'
                  }
                ],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['theme'],
                        properties: {
                          theme: { $ref: '#/components/schemas/Theme' },
                          visibility: { type: 'string', enum: ['shared', 'private'], default: 'shared' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Theme saved successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            theme: { $ref: '#/components/schemas/Theme' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Invalid theme payload' },
                  '401': { description: 'Missing x-user-id header' }
                }
              },
              delete: {
                summary: 'Delete a custom theme',
                description: 'Deletes a custom theme by ID for the authenticated user.',
                operationId: 'deleteCustomTheme',
                parameters: [
                  {
                    name: 'x-user-id',
                    in: 'header',
                    required: true,
                    schema: { type: 'string' },
                    description: 'User ID'
                  },
                  {
                    name: 'themeId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'Theme ID to delete'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Theme deleted successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            deleted: { type: 'boolean' },
                            themeId: { type: 'string' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing themeId' },
                  '401': { description: 'Missing x-user-id header' }
                }
              }
            },
            '/theme/catalog': {
              get: {
                summary: 'Get theme catalog',
                description: 'Returns the full shared theme catalog with sync metadata.',
                operationId: 'getThemeCatalog',
                responses: {
                  '200': {
                    description: 'Theme catalog',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            themes: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Theme' }
                            },
                            meta: {
                              type: 'object',
                              nullable: true,
                              properties: {
                                syncedAt: { type: 'string', format: 'date-time' },
                                sourceGraphId: { type: 'string' },
                                count: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              post: {
                summary: 'Upsert a theme into the catalog',
                description: 'Adds or updates a theme in the shared catalog.',
                operationId: 'upsertCatalogTheme',
                parameters: [
                  {
                    name: 'x-user-id',
                    in: 'header',
                    required: true,
                    schema: { type: 'string' },
                    description: 'User ID'
                  }
                ],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['theme'],
                        properties: {
                          theme: { $ref: '#/components/schemas/Theme' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Theme upserted into catalog',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            theme: { $ref: '#/components/schemas/Theme' },
                            count: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Invalid theme payload' },
                  '401': { description: 'Missing x-user-id header' }
                }
              }
            },
            '/theme/catalog/sync-from-graph': {
              post: {
                summary: 'Sync theme catalog from a graph',
                description: 'Extracts HTML node themes from a knowledge graph and syncs them to the catalog. Requires Superadmin role.',
                operationId: 'syncCatalogFromGraph',
                parameters: [
                  {
                    name: 'x-user-role',
                    in: 'header',
                    required: true,
                    schema: { type: 'string', enum: ['Superadmin'] },
                    description: 'Must be Superadmin'
                  }
                ],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId'],
                        properties: {
                          graphId: { type: 'string', description: 'Graph ID containing HTML node themes' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Catalog synced successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            graphId: { type: 'string' },
                            count: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId' },
                  '403': { description: 'Superadmin role required' },
                  '404': { description: 'Graph not found' }
                }
              }
            },
            '/theme/sync-from-graph': {
              post: {
                summary: 'Sync themes from a graph (legacy)',
                description: 'Backwards-compatible variant of /theme/catalog/sync-from-graph. Syncs HTML node themes from a graph to the catalog. Requires Superadmin role.',
                operationId: 'syncThemesFromGraph',
                parameters: [
                  {
                    name: 'x-user-role',
                    in: 'header',
                    required: true,
                    schema: { type: 'string', enum: ['Superadmin'] },
                    description: 'Must be Superadmin'
                  }
                ],
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId'],
                        properties: {
                          graphId: { type: 'string', description: 'Graph ID containing HTML node themes' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Themes synced successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            graphId: { type: 'string' },
                            count: { type: 'integer' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId' },
                  '403': { description: 'Superadmin role required' },
                  '404': { description: 'Graph not found' }
                }
              }
            },
            '/saveToGraphWorkNotes': {
              post: {
                summary: 'Save a work note for a graph',
                description: 'Creates a new work note associated with a specific graph. Work notes are stored separately from graph data.',
                operationId: 'saveToGraphWorkNotes',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'note', 'name'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID to associate the note with' },
                          note: { type: 'string', description: 'The note content' },
                          name: { type: 'string', description: 'Author name for the note' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Work note saved',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string' },
                            workNoteId: { type: 'string', description: 'UUID of the created work note' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId, note, or name' }
                }
              }
            },
            '/getGraphWorkNotes': {
              get: {
                summary: 'Get work notes for a graph',
                description: 'Returns all work notes associated with a specific graph.',
                operationId: 'getGraphWorkNotes',
                parameters: [
                  {
                    name: 'graphId',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' },
                    description: 'The graph ID to fetch work notes for'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Work notes for the graph',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            meta: {
                              type: 'object',
                              properties: {
                                graphId: { type: 'string' }
                              }
                            },
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  note: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId parameter' }
                }
              }
            },
            '/insertWorkNoteIntoGraph': {
              post: {
                summary: 'Insert a work note as a graph node',
                description: 'Takes an existing work note and inserts it as a new node into the specified graph.',
                operationId: 'insertWorkNoteIntoGraph',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphId', 'workNoteId'],
                        properties: {
                          graphId: { type: 'string', description: 'The graph ID to insert the note into' },
                          workNoteId: { type: 'string', description: 'The work note ID to insert' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Work note inserted as node',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string' },
                            newNode: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                label: { type: 'string' },
                                color: { type: 'string' },
                                type: { type: 'string' },
                                info: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing graphId or workNoteId' },
                  '404': { description: 'Work note or graph not found' }
                }
              }
            },
            '/getAITemplates': {
              get: {
                summary: 'Get AI templates',
                description: 'Returns all AI templates including their node structures, instructions, and categories.',
                operationId: 'getAITemplates',
                responses: {
                  '200': {
                    description: 'List of AI templates',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  name: { type: 'string' },
                                  type: { type: 'string' },
                                  nodes: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
                                  edges: { type: 'array', items: { $ref: '#/components/schemas/Edge' } },
                                  ai_instructions: { type: 'string' },
                                  category: { type: 'string' },
                                  thumbnail_path: { type: 'string', nullable: true },
                                  standard_question: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '404': { description: 'No templates found' }
                }
              }
            },
            '/getToolTemplates': {
              get: {
                summary: 'Get tool templates',
                description: 'Returns templates marked as tools, with nodeType extracted from the first node. Requires Admin or Superadmin role.',
                operationId: 'getToolTemplates',
                parameters: [
                  {
                    name: 'x-user-role',
                    in: 'header',
                    required: true,
                    schema: { type: 'string', enum: ['Admin', 'Superadmin'] },
                    description: 'Must be Admin or Superadmin'
                  }
                ],
                responses: {
                  '200': {
                    description: 'List of tool templates',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            results: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  name: { type: 'string' },
                                  nodeType: { type: 'string', nullable: true },
                                  nodes: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
                                  edges: { type: 'array', items: { $ref: '#/components/schemas/Edge' } },
                                  ai_instructions: { type: 'string' },
                                  category: { type: 'string' },
                                  thumbnail_path: { type: 'string', nullable: true },
                                  standard_question: { type: 'string' },
                                  description: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  },
                  '403': { description: 'Admin role required' }
                }
              }
            },
            '/addAITemplate': {
              post: {
                summary: 'Add an AI template',
                description: 'Creates a new AI template with node data, instructions, and optional category.',
                operationId: 'addAITemplate',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['name', 'node'],
                        properties: {
                          name: { type: 'string', description: 'Template name' },
                          node: { $ref: '#/components/schemas/Node', description: 'Node data for the template' },
                          ai_instructions: { type: 'string', description: 'AI instructions for this template' },
                          category: { type: 'string', description: 'Template category' },
                          thumbnail_path: { type: 'string', description: 'Path to template thumbnail' },
                          tool: { type: 'boolean', description: 'Whether this template is a tool' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Template created successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            message: { type: 'string' },
                            id: { type: 'string' },
                            name: { type: 'string' },
                            category: { type: 'string' },
                            thumbnail_path: { type: 'string', nullable: true }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing name or node data' }
                }
              }
            },
            '/getTaxonomy': {
              get: {
                summary: 'Get taxonomy metadata',
                description: 'Returns current taxonomy definitions used by graph classification endpoints.',
                operationId: 'getTaxonomy',
                responses: {
                  '200': { description: 'Taxonomy data' }
                }
              }
            },
            '/classifyGraph': {
              post: {
                summary: 'Classify a single graph',
                description: 'Runs metadata classification for one graph.',
                operationId: 'classifyGraph',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Graph classified' }
                }
              }
            },
            '/classifyAll': {
              post: {
                summary: 'Classify all graphs',
                description: 'Runs metadata classification across all graphs.',
                operationId: 'classifyAll',
                responses: {
                  '200': { description: 'Batch classification completed' }
                }
              }
            },
            '/deleteTemplate': {
              delete: {
                summary: 'Delete template by query id',
                description: 'Deletes a template using DELETE semantics.',
                operationId: 'deleteTemplateDelete',
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: true,
                    schema: { type: 'string' }
                  }
                ],
                responses: {
                  '200': { description: 'Template deleted' }
                }
              },
              post: {
                summary: 'Delete template by request body id',
                description: 'Backwards-compatible delete template endpoint using POST.',
                operationId: 'deleteTemplatePost',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['id'],
                        properties: {
                          id: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Template deleted' }
                }
              }
            },
            '/generateText': {
              post: {
                summary: 'Generate text with Workers AI',
                description: 'Generates fulltext-node shaped output from a prompt.',
                operationId: 'generateText',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['prompt'],
                        properties: {
                          prompt: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Generated text node payload' }
                }
              }
            },
            '/migrateTemplatesAddUUIDs': {
              post: {
                summary: 'Migrate template IDs to UUIDs',
                description: 'Assigns UUID IDs to templates missing IDs. Administrative migration endpoint.',
                operationId: 'migrateTemplatesAddUUIDs',
                responses: {
                  '200': { description: 'Migration completed' }
                }
              }
            },
            '/resetMetaAreas': {
              post: {
                summary: 'Reset meta areas on all graphs',
                description: 'Superadmin endpoint to clear metadata metaArea values across graphs.',
                operationId: 'resetMetaAreas',
                parameters: [
                  {
                    name: 'x-user-role',
                    in: 'header',
                    required: true,
                    schema: { type: 'string', enum: ['Superadmin'] }
                  }
                ],
                responses: {
                  '200': { description: 'Meta areas reset summary' },
                  '403': { description: 'Superadmin required' }
                }
              }
            },
            '/validate-worker': {
              post: {
                summary: 'Validate worker source code',
                description: 'Performs static checks on submitted worker code.',
                operationId: 'validateWorker',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['code'],
                        properties: {
                          code: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Validation result' }
                }
              }
            },
            '/analyze-worker-code': {
              post: {
                summary: 'Analyze worker source code',
                description: 'Runs AI-powered code analysis and returns recommendations.',
                operationId: 'analyzeWorkerCode',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['code'],
                        properties: {
                          code: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Analysis result' }
                }
              }
            },
            '/generate-share-summary': {
              post: {
                summary: 'Generate social share summary from graph',
                description: 'Creates a social media style summary from graph content.',
                operationId: 'generateShareSummary',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['graphData'],
                        properties: {
                          graphData: { type: 'object' },
                          graphMetadata: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Generated summary' }
                }
              }
            },
            '/generate-youtube-script': {
              post: {
                summary: 'Generate YouTube script from markdown',
                description: 'Generates a YouTube-ready script based on markdown content and options.',
                operationId: 'generateYoutubeScript',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['markdown'],
                        properties: {
                          markdown: { type: 'string' },
                          youtubeUrl: { type: 'string' },
                          language: { type: 'string' },
                          scriptStyle: { type: 'string' },
                          targetDuration: { type: 'string' },
                          includeTimestamps: { type: 'boolean' },
                          includeEngagement: { type: 'boolean' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Generated YouTube script' }
                }
              }
            },
            '/generate-worker-ai': {
              post: {
                summary: 'Generate Worker code/content via AI',
                description: 'AI generation endpoint for worker code, explanations, and structured outputs.',
                operationId: 'generateWorkerAI',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          prompt: { type: 'string' },
                          userPrompt: { type: 'string' },
                          returnType: { type: 'string' },
                          graphContext: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': { description: 'Generated output' }
                }
              }
            },
            '/getContract': {
              get: {
                summary: 'Get an agent contract',
                description: 'Retrieves an agent contract by ID or template name. Supports parent contract composition via deep merge. If the contract has a parent_contract_id, the parent contract is fetched and deep-merged with the child. If a template_id is linked, template example data is included.',
                operationId: 'getContract',
                parameters: [
                  {
                    name: 'id',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'The contract ID (e.g., contract_dark_glass). Either id or templateName is required.'
                  },
                  {
                    name: 'templateName',
                    in: 'query',
                    required: false,
                    schema: { type: 'string' },
                    description: 'The contract name to look up. Falls back to graphTemplates.ai_instructions if not found in agent_contracts.'
                  }
                ],
                responses: {
                  '200': {
                    description: 'Contract retrieved successfully',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            contract: { $ref: '#/components/schemas/AgentContract' },
                            source: { type: 'string', description: 'Set to "graphTemplates" when contract was resolved from template ai_instructions fallback' }
                          }
                        },
                        example: {
                          success: true,
                          contract: {
                            version: '1.0',
                            type: 'html-node',
                            node: {
                              css: {
                                designSystem: 'dark-glass',
                                colorTokens: { '--bg1': '#070a0f', '--accent': '#7c3aed', '--text': '#e5e7eb' },
                                fontStack: 'system-ui, sans-serif',
                                borderRadius: '18px'
                              },
                              features: { responsiveBreakpoints: true, darkMode: true },
                              content: { sections: ['hero', 'body', 'footer'], menuMode: 'none' },
                              validation: { mustContain: ['<!doctype html>', '<html', '</html>'], maxSizeKb: 200 },
                              safety: { sanitizer: 'DOMPurify', noExternalScripts: true }
                            }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing id or templateName query parameter' },
                  '404': { description: 'Contract not found' }
                }
              },
              post: {
                summary: 'Get a contract with runtime overrides',
                description: 'Retrieves an agent contract by ID and applies user-provided overrides via deep merge. Useful for customizing a base contract at execution time without modifying the stored version.',
                operationId: 'getContractWithOverrides',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        required: ['contractId'],
                        properties: {
                          contractId: { type: 'string', description: 'The contract ID to retrieve and customize' },
                          overrides: {
                            type: 'object',
                            description: 'Partial contract object to deep-merge over the stored contract. Any nested keys will override the base contract values.',
                            additionalProperties: true
                          }
                        }
                      },
                      example: {
                        contractId: 'contract_dark_glass',
                        overrides: {
                          node: {
                            css: { colorTokens: { '--accent': '#ff6600' } },
                            features: { login: true }
                          }
                        }
                      }
                    }
                  }
                },
                responses: {
                  '200': {
                    description: 'Contract with overrides applied',
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' },
                            contract: { $ref: '#/components/schemas/AgentContract' }
                          }
                        }
                      }
                    }
                  },
                  '400': { description: 'Missing contractId' },
                  '404': { description: 'Contract not found' }
                }
              }
            }
          },
          components: {
            schemas: {
              SaveGraphRequest: {
                type: 'object',
                required: ['id', 'graphData'],
                properties: {
                  id: {
                    type: 'string',
                    pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
                    description: 'Unique graph ID. NEW graphs MUST be a valid UUID v4 (e.g., 550e8400-e29b-41d4-a716-446655440000). EXISTING graphs may continue to update at their current id regardless of format — legacy semantic-named graphs created before this rule remain mutable for backward compatibility. Only new-graph creation is constrained.',
                    example: '550e8400-e29b-41d4-a716-446655440000'
                  },
                  graphData: { $ref: '#/components/schemas/GraphData' },
                  override: {
                    type: 'boolean',
                    default: false,
                    description: 'Set to true to force save despite version mismatch'
                  }
                }
              },
              GraphData: {
                type: 'object',
                required: ['metadata', 'nodes', 'edges'],
                properties: {
                  metadata: { $ref: '#/components/schemas/GraphMetadata' },
                  nodes: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Node' }
                  },
                  edges: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Edge' }
                  }
                }
              },
              GraphMetadata: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', description: 'Graph title' },
                  description: { type: 'string', description: 'Graph description' },
                  createdBy: { type: 'string', description: 'Creator identifier (app name)' },
                  version: { type: 'integer', description: 'Version number (auto-incremented)' },
                  metaArea: { type: 'string', description: 'Meta area tags for filtering (e.g., "#TAG1#TAG2")' }
                }
              },
              Node: {
                type: 'object',
                required: ['id', 'label'],
                properties: {
                  id: { type: 'string', description: 'Unique node ID (UUID recommended)' },
                  label: { type: 'string', description: 'Node display label' },
                  color: { type: 'string', default: '#4f6d7a', description: 'Node color (hex)' },
                  type: {
                    type: 'string',
                    enum: ['fulltext', 'image', 'link', 'video', 'audio'],
                    description: 'Node content type'
                  },
                  info: { type: 'string', description: 'Node content (markdown for fulltext)' },
                  bibl: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Source URLs/references'
                  },
                  position: {
                    type: 'object',
                    properties: {
                      x: { type: 'number' },
                      y: { type: 'number' }
                    },
                    description: 'Node position on canvas'
                  },
                  visible: { type: 'boolean', default: true },
                  imageWidth: { type: 'integer', nullable: true },
                  imageHeight: { type: 'integer', nullable: true },
                  path: { type: 'string', nullable: true, description: 'Image/media path' }
                }
              },
              Edge: {
                type: 'object',
                required: ['source', 'target'],
                properties: {
                  id: { type: 'string', description: 'Edge ID (auto-generated as source_target)' },
                  source: { type: 'string', description: 'Source node ID' },
                  target: { type: 'string', description: 'Target node ID' },
                  label: { type: 'string', description: 'Optional edge label' }
                }
              },
              Template: {
                type: 'object',
                required: ['name', 'node'],
                properties: {
                  name: { type: 'string', description: 'Template display name' },
                  node: { type: 'object', description: 'The node data (type, label, info, color, etc.). Will be wrapped in an array for storage.' },
                  ai_instructions: { type: 'string', description: 'JSON string with AI usage instructions for this template' },
                  category: { type: 'string', description: 'Template category (e.g. General, My Apps, HTML Templates, Agent, etc.)', default: 'General' },
                  userId: { type: 'string', description: 'Creator email address' },
                  tool: { type: 'boolean', description: 'Whether this template should be available as an agent tool', default: false },
                  standard_question: { type: 'string', description: 'Default prompt/question shown when using this template' }
                }
              },
              Theme: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique theme ID' },
                  label: { type: 'string', description: 'Theme display label' },
                  visibility: { type: 'string', enum: ['shared', 'private'], description: 'Theme visibility' },
                  ownerUserId: { type: 'string', description: 'Owner user ID' },
                  ownerEmail: { type: 'string', nullable: true, description: 'Owner email' },
                  createdAt: { type: 'string', format: 'date-time', nullable: true },
                  updatedAt: { type: 'string', format: 'date-time', nullable: true }
                }
              },
              AgentContract: {
                type: 'object',
                description: 'Agent contract defining how an agent should build HTML nodes. Supports parent-child composition via deep merge.',
                properties: {
                  version: { type: 'string', description: 'Contract schema version', example: '1.0' },
                  type: { type: 'string', description: 'Target node type', example: 'html-node' },
                  graph: {
                    type: 'object',
                    description: 'Graph-level settings for where to store output',
                    properties: {
                      targetGraphId: { type: 'string', description: 'Existing graph to add nodes to' },
                      createNew: { type: 'boolean', description: 'Whether to create a new graph' },
                      title: { type: 'string', description: 'Title for a newly created graph' },
                      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for graph metadata' }
                    }
                  },
                  node: {
                    type: 'object',
                    description: 'Node-level contract specifying CSS, features, content, and validation rules',
                    properties: {
                      type: { type: 'string' },
                      css: {
                        type: 'object',
                        properties: {
                          designSystem: { type: 'string', description: 'Design system name (e.g., dark-glass)' },
                          colorTokens: { type: 'object', additionalProperties: { type: 'string' }, description: 'CSS custom property tokens' },
                          fontStack: { type: 'string' },
                          borderRadius: { type: 'string' },
                          effects: { type: 'array', items: { type: 'string' } }
                        }
                      },
                      features: {
                        type: 'object',
                        additionalProperties: { type: 'boolean' },
                        description: 'Feature flags (e.g., login, darkMode, responsiveBreakpoints)'
                      },
                      content: {
                        type: 'object',
                        properties: {
                          sections: { type: 'array', items: { type: 'string' }, description: 'Page sections (e.g., hero, body, footer)' },
                          menuMode: { type: 'string', enum: ['none', 'hamburger', 'sidebar', 'top'] },
                          imageStrategy: { type: 'string', enum: ['pexels', 'unsplash', 'none', 'custom'] },
                          language: { type: 'string' }
                        }
                      },
                      validation: {
                        type: 'object',
                        properties: {
                          mustContain: { type: 'array', items: { type: 'string' }, description: 'Strings the output HTML must contain' },
                          maxSizeKb: { type: 'integer' },
                          requiredFields: { type: 'array', items: { type: 'string' } }
                        }
                      },
                      safety: {
                        type: 'object',
                        properties: {
                          sanitizer: { type: 'string', description: 'HTML sanitizer to use (e.g., DOMPurify)' },
                          renderer: { type: 'string' },
                          noExternalScripts: { type: 'boolean' }
                        }
                      }
                    }
                  },
                  userPrompt: { type: 'string', description: 'User-provided task prompt' },
                  _templateExample: {
                    type: 'object',
                    description: 'Included when contract links to a graphTemplate. Provides example data.',
                    properties: {
                      name: { type: 'string' },
                      nodes: { type: 'array', nullable: true, items: { $ref: '#/components/schemas/Node' } }
                    }
                  }
                }
              }
            },
            securitySchemes: {
              ApiTokenAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Token',
                description: 'API token obtained from the Vegvisr API token management. Tokens are scoped and can have different permissions (graph:write, graph:delete, template:write, etc.). Alternative auth methods: (1) Session-based auth via x-user-role header for logged-in web users, (2) Service binding calls from trusted internal workers.'
              }
            }
          }
        }

        return new Response(JSON.stringify(openApiSpec, null, 2), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (pathname === '/saveknowgraph' && request.method === 'POST') {
        // Validate API token for write operations
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }

        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const requestBody = await request.json()
          console.log('[Worker] Request body:', requestBody)

          let { id, graphData } = requestBody
          let newlyCreated = false

          // Generate an ID if it's missing
          if (!id) {
            id = `graph_${Date.now()}`
            console.log(`[Worker] Generated ID: ${id}`)
            newlyCreated = true
          }

          // Initialize graphData if missing
          if (!graphData) {
            console.warn(
              '[Worker] Missing graphData in request body. Initializing default graphData.',
            )
            graphData = {
              metadata: { title: '', description: '', createdBy: '' },
              nodes: [
                {
                  id: crypto.randomUUID(),
                  color: 'goldenrod',
                  label: 'Alpha',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
                {
                  id: crypto.randomUUID(),
                  color: 'steelblue',
                  label: 'Hyper',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
                {
                  id: crypto.randomUUID(),
                  color: 'lightcoral',
                  label: 'Vector',
                  type: null,
                  info: null,
                  bibl: [],
                  imageWidth: null,
                  imageHeight: null,
                  visible: true,
                },
              ],
            }
            newlyCreated = true
          }

          // Ensure there are at least two nodes and one edge
          if (!graphData.nodes || graphData.nodes.length < 2) {
            console.log('[Worker] Adding default nodes "Main" and "First".')
            graphData.nodes = [
              {
                id: crypto.randomUUID(),
                color: 'goldenrod',
                type: null,
                info: null,
                bibl: [],
                imageWidth: null,
                imageHeight: null,
                visible: true,
              },
              {
                id: crypto.randomUUID(),
                color: 'steelblue',
                type: null,
                info: null,
                bibl: [],
                imageWidth: null,
                imageHeight: null,
                visible: true,
              },
            ]
            newlyCreated = true
          }
          if (!graphData.edges || graphData.edges.length === 0) {
            console.log('[Worker] Adding default edge between "Main" and "First".')
            graphData.edges = [
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[0].id,
                target: graphData.nodes[1].id,
                label: '1 to 2',
                type: null,
                info: null,
              },
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[1].id,
                target: graphData.nodes[2].id,
                label: '2 to 3',
                type: null,
                info: null,
              },
              {
                id: crypto.randomUUID(),
                source: graphData.nodes[2].id,
                target: graphData.nodes[0].id,
                label: '3 to 1',
                type: null,
                info: null,
              },
            ]
            newlyCreated = true
          } else {
            // Ensure edges connect valid node IDs
            graphData.edges = graphData.edges.map((edge) => {
              const validSource = graphData.nodes.find((node) => node.id === edge.source)
              const validTarget = graphData.nodes.find((node) => node.id === edge.target)

              if (!validSource || !validTarget) {
                console.warn(
                  `[Worker] Invalid edge detected. Reconnecting edge ${edge.id} to valid nodes.`,
                )
                return {
                  ...edge,
                  source: graphData.nodes[0].id,
                  target: graphData.nodes[1].id,
                }
              }
              return edge
            })
          }

          // Ensure metadata fields are included
          graphData.metadata = {
            title: requestBody.metadata?.title || '',
            description: requestBody.metadata?.description || '',
            createdBy: requestBody.metadata?.createdBy || '',
          }

          console.log('[Worker] Final graphData:', graphData)

          console.log('[Worker] Saving knowledge graph to database')

          if (!env.vegvisr_org || !env.vegvisr_org.prepare) {
            console.error('[Worker] vegvisr_org is not defined or improperly configured.')
            return new Response(
              JSON.stringify({ error: 'Database connection is not available.' }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }

          const query = `INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          await env.vegvisr_org
            .prepare(query)
            .bind(
              id,
              graphData.metadata.title,
              graphData.metadata.description,
              graphData.metadata.createdBy,
              JSON.stringify(graphData),
              new Date().toISOString(),
              new Date().toISOString(),
            )
            .run()

          console.log('[Worker] Knowledge graph saved successfully')
          return new Response(
            JSON.stringify({
              message: 'Knowledge graph saved successfully',
              id,
              newlyCreated,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error processing /saveknowgraph request:', error)
          return new Response(
            JSON.stringify({ error: 'Invalid JSON or server error', details: error.message }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      } else if (
        pathname.match(/^\/api\/graph\/[^/]+\/ai-instructions$/) &&
        request.method === 'GET'
      ) {
        const graphId = pathname.split('/')[3]

        try {
          const result = await env.vegvisr_org
            .prepare('SELECT ai_instructions FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          return new Response(JSON.stringify({ instructions: result?.ai_instructions || '' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching AI instructions:', error)
          return new Response(JSON.stringify({ error: 'Failed to fetch AI instructions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else if (
        pathname.match(/^\/api\/graph\/[^/]+\/ai-instructions$/) &&
        request.method === 'PUT'
      ) {
        const graphId = pathname.split('/')[3]
        const { instructions } = await request.json()

        try {
          await env.vegvisr_org
            .prepare('UPDATE knowledge_graphs SET ai_instructions = ?, updated_at = ? WHERE id = ?')
            .bind(instructions, new Date().toISOString(), graphId)
            .run()

          return new Response(JSON.stringify({ message: 'AI instructions updated successfully' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error updating AI instructions:', error)
          return new Response(JSON.stringify({ error: 'Failed to update AI instructions' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      if (pathname === '/updateknowgraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id, graphData } = requestBody

          if (!id || !graphData) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and graph data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Updating graph with ID: ${id}`)

          const query = `UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?`
          await env.vegvisr_org
            .prepare(query)
            .bind(JSON.stringify(graphData), new Date().toISOString(), id)
            .run()

          console.log('[Worker] Graph updated successfully')
          return new Response(JSON.stringify({ message: 'Graph updated successfully', id }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error processing /updateknowgraph request:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }



      if (pathname === '/getmetaareas' && request.method === 'GET') {
        try {
          // Requires valid X-API-Token with graph:read scope
          const _maApiToken = request.headers.get('X-API-Token')
          const _maUserRole = request.headers.get('x-user-role')
          const _maOrigin = request.headers.get('Origin')
          const _maTrustedOrigins = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
          let maPrivileged = false

          if (_maApiToken && _maApiToken !== 'null' && _maApiToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (!tv.valid) {
              return new Response(JSON.stringify({ error: tv.error || 'Invalid API token' }), {
                status: tv.status || 401, headers: corsHeaders,
              })
            }
            if (!hasScope(tv.scopes, 'graph:read') && !hasScope(tv.scopes, 'all')) {
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:read' }), {
                status: 403, headers: corsHeaders,
              })
            }
            maPrivileged = true
          } else if (_maUserRole || (_maOrigin && _maTrustedOrigins.includes(_maOrigin))) {
            maPrivileged = true
          }

          const safeJsonDataSql = `CASE WHEN json_valid(data) THEN data ELSE '{}' END`

          // For privileged: all graphs. For unprivileged: published only.
          const pubWhere = maPrivileged ? '' : `WHERE (json_extract(${safeJsonDataSql}, '$.metadata.publicationState') = 'published' OR json_extract(${safeJsonDataSql}, '$.metadata.seoSlug') IS NOT NULL)`

          const query = `
            SELECT
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.metaArea'), '') AS metaArea,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.category'), '') AS category
            FROM knowledge_graphs
            ${pubWhere}
          `
          const rows = await env.vegvisr_org.prepare(query).all()

          const metaAreaCounts = {}
          const categoryCounts = {}

          for (const row of (rows.results || [])) {
            // Meta areas — split on #
            const areas = (row.metaArea || '').split('#').map(s => s.trim().toUpperCase()).filter(Boolean)
            for (const area of areas) {
              metaAreaCounts[area] = (metaAreaCounts[area] || 0) + 1
            }
            // Categories — split on #
            const cats = (row.category || '').split('#').map(s => s.trim()).filter(Boolean)
            for (const cat of cats) {
              categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
            }
          }

          const metaAreas = Object.entries(metaAreaCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))

          const categories = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }))

          return new Response(JSON.stringify({ metaAreas, categories, privileged: maPrivileged }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500, headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphsummaries' && request.method === 'GET') {
        try {
          const limit = parseIntWithBounds(url.searchParams.get('limit'), 80, 1, 250)
          const offset = parseIntWithBounds(url.searchParams.get('offset'), 0, 0, 1000000)
          const metaAreaParam = url.searchParams.get('metaArea') || ''
          const hostname =
            request.headers.get('x-original-hostname') || new URL(request.url).hostname

          // Determine if caller is privileged (valid API token, web session, or trusted origin)
          const _summariesApiToken = request.headers.get('X-API-Token')
          const _summariesUserRole = request.headers.get('x-user-role')
          const _summariesPluginAuth = request.headers.get('x-plugin-authenticated') === 'true'
          const _summariesOrigin = request.headers.get('Origin')
          const _summariesTrustedOrigins = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
          let isPrivileged = false
          if (_summariesApiToken && _summariesApiToken !== 'null' && _summariesApiToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (tv.valid && (hasScope(tv.scopes, 'graph:read') || hasScope(tv.scopes, 'all'))) isPrivileged = true
            else if (!tv.valid) {
              return new Response(JSON.stringify({ error: tv.error || 'Invalid API token' }), {
                status: tv.status || 401, headers: corsHeaders,
              })
            }
          } else if (_summariesPluginAuth || _summariesUserRole || (_summariesOrigin && _summariesTrustedOrigins.includes(_summariesOrigin))) {
            isPrivileged = true
          }
          if (!isPrivileged) {
            console.log('[Worker] Unauthenticated request — restricting to published graphs only')
          }

          console.log('[Worker] Fetching paginated graph summaries:', { hostname, limit, offset, metaAreaParam })

          const allowedMetaAreas = await resolveAllowedMetaAreas(hostname)
          const whereBindings = []
          let whereSql = ''
          const safeJsonDataSql = `CASE WHEN json_valid(data) THEN data ELSE '{}' END`
          const safeNodesSql = `COALESCE(json_extract(${safeJsonDataSql}, '$.nodes'), '[]')`
          const safeEdgesSql = `COALESCE(json_extract(${safeJsonDataSql}, '$.edges'), '[]')`

          if (allowedMetaAreas && allowedMetaAreas.length > 0) {
            const metaFilters = allowedMetaAreas.map(
              () =>
                `UPPER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.metaArea'), '')) LIKE ?`,
            )
            whereSql = `WHERE (${metaFilters.join(' OR ')})`
            whereBindings.push(...allowedMetaAreas.map((area) => `%${area}%`))
          }

          // Support explicit metaArea query parameter for API consumers (e.g. agent-worker)
          if (metaAreaParam) {
            const metaAreaFilter = `UPPER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.metaArea'), '')) LIKE ?`
            if (whereSql) {
              whereSql += ` AND (${metaAreaFilter})`
            } else {
              whereSql = `WHERE (${metaAreaFilter})`
            }
            whereBindings.push(`%${metaAreaParam.toUpperCase()}%`)
          }

          // Restrict unauthenticated requests to published graphs only
          if (!isPrivileged) {
            const pubFilter = `(json_extract(${safeJsonDataSql}, '$.metadata.publicationState') = 'published' OR json_extract(${safeJsonDataSql}, '$.metadata.seoSlug') IS NOT NULL)`
            whereSql = whereSql ? `${whereSql} AND ${pubFilter}` : `WHERE ${pubFilter}`
          }

          const totalQuery = `SELECT COUNT(*) AS total FROM knowledge_graphs ${whereSql}`
          const totalRow = await env.vegvisr_org
            .prepare(totalQuery)
            .bind(...whereBindings)
            .first()

          const total = Number(totalRow?.total || 0)
          if (total === 0) {
            return new Response(
              JSON.stringify({
                results: [],
                total: 0,
                limit,
                offset,
                hasMore: false,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              },
            )
          }

          const summaryQuery = `
            SELECT
              id,
              title,
              created_date,
              updated_at,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.title'), title) AS metadata_title,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.description'), '') AS metadata_description,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.createdBy'), 'Unknown') AS metadata_created_by,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.version'), 1) AS metadata_version,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.category'), '#Uncategorized') AS metadata_category,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.metaArea'), '') AS metadata_meta_area,
              json_extract(${safeJsonDataSql}, '$.metadata.graphType') AS metadata_graph_type,
              json_extract(${safeJsonDataSql}, '$.metadata.seoSlug') AS metadata_seo_slug,
              json_extract(${safeJsonDataSql}, '$.metadata.publicationState') AS metadata_publication_state,
              json_extract(${safeJsonDataSql}, '$.metadata.publishedAt') AS metadata_published_at,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.chatSessionCount'), 0) AS metadata_chat_session_count,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.isThemeGraph'), 0) AS metadata_is_theme_graph,
              json_extract(${safeJsonDataSql}, '$.metadata.mystmkraUrl') AS metadata_mystmkra_url,
              json_extract(${safeJsonDataSql}, '$.metadata.mystmkraDocumentId') AS metadata_mystmkra_document_id,
              json_extract(${safeJsonDataSql}, '$.metadata.mystmkraNodeId') AS metadata_mystmkra_node_id,
              json_extract(${safeJsonDataSql}, '$.metadata.affiliates') AS metadata_affiliates,
              COALESCE(json_array_length(${safeNodesSql}), 0) AS node_count,
              COALESCE(json_array_length(${safeEdgesSql}), 0) AS edge_count,
              COALESCE((
                SELECT GROUP_CONCAT(DISTINCT json_extract(value, '$.type'))
                FROM json_each(${safeNodesSql})
                WHERE json_extract(value, '$.type') IS NOT NULL
              ), '') AS node_types_csv,
              COALESCE((
                SELECT GROUP_CONCAT(json_extract(label_rows.value, '$.label'), ' ')
                FROM (
                  SELECT value
                  FROM json_each(${safeNodesSql})
                  WHERE json_extract(value, '$.label') IS NOT NULL
                  LIMIT 40
                ) AS label_rows
              ), '') AS node_labels_text,
              (
                SELECT json_extract(value, '$.path')
                FROM json_each(${safeNodesSql})
                WHERE json_extract(value, '$.type') = 'portfolio-image'
                  AND json_extract(value, '$.path') IS NOT NULL
                LIMIT 1
              ) AS portfolio_image_path
            FROM knowledge_graphs
            ${whereSql}
            ORDER BY COALESCE(updated_at, created_date) DESC
            LIMIT ? OFFSET ?
          `

          // Safety net: if the rich summary query fails on edge-case data,
          // serve a minimal summary response instead of failing the endpoint.
          const fallbackSummaryQuery = `
            SELECT
              id,
              title,
              created_date,
              updated_at,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.title') END,
                title
              ) AS metadata_title,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.description') END,
                ''
              ) AS metadata_description,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.createdBy') END,
                'Unknown'
              ) AS metadata_created_by,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.version') END,
                1
              ) AS metadata_version,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.category') END,
                '#Uncategorized'
              ) AS metadata_category,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.metaArea') END,
                ''
              ) AS metadata_meta_area,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.graphType') END AS metadata_graph_type,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.seoSlug') END AS metadata_seo_slug,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.publicationState') END AS metadata_publication_state,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.publishedAt') END AS metadata_published_at,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.chatSessionCount') END,
                0
              ) AS metadata_chat_session_count,
              COALESCE(
                CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.isThemeGraph') END,
                0
              ) AS metadata_is_theme_graph,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.mystmkraUrl') END AS metadata_mystmkra_url,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.mystmkraDocumentId') END AS metadata_mystmkra_document_id,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.mystmkraNodeId') END AS metadata_mystmkra_node_id,
              CASE WHEN json_valid(data) THEN json_extract(data, '$.metadata.affiliates') END AS metadata_affiliates
            FROM knowledge_graphs
            ${whereSql}
            ORDER BY COALESCE(updated_at, created_date) DESC
            LIMIT ? OFFSET ?
          `

          let rows = []
          try {
            const result = await env.vegvisr_org
              .prepare(summaryQuery)
              .bind(...whereBindings, limit, offset)
              .all()
            rows = result.results || result.rows || []
          } catch (summaryQueryError) {
            console.error('[Worker] Rich summary query failed, using minimal fallback:', summaryQueryError)
            const fallbackResult = await env.vegvisr_org
              .prepare(fallbackSummaryQuery)
              .bind(...whereBindings, limit, offset)
              .all()
            rows = fallbackResult.results || fallbackResult.rows || []
          }

          const summaries = rows
            .map((row) => {
              const metaArea = row.metadata_meta_area || ''
              const rowMetaAreas = parseMetaAreas(metaArea)

              if (
                allowedMetaAreas &&
                allowedMetaAreas.length &&
                !rowMetaAreas.some((area) => allowedMetaAreas.includes(area))
              ) {
                return null
              }

              const nodeTypes = String(row.node_types_csv || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)

              const affiliates = parseMaybeJsonObject(row.metadata_affiliates)
              const seoSlug = row.metadata_seo_slug || ''
              const publicationState =
                row.metadata_publication_state || (seoSlug ? 'published' : 'draft')
              const isThemeGraph =
                row.metadata_is_theme_graph === true ||
                row.metadata_is_theme_graph === 1 ||
                row.metadata_is_theme_graph === '1' ||
                row.metadata_is_theme_graph === 'true'
              const nodeLabelsText = row.node_labels_text || ''

              return {
                id: row.id,
                title: row.metadata_title || row.title || 'Untitled Graph',
                createdAt: row.created_date || null,
                updatedAt: row.updated_at || row.created_date || null,
                nodeCount: Number(row.node_count || 0),
                edgeCount: Number(row.edge_count || 0),
                nodeTypes,
                nodeLabelsText,
                portfolioImagePath: row.portfolio_image_path || null,
                searchText: `${nodeTypes.join(' ')} ${nodeLabelsText}`.trim(),
                metadata: {
                  title: row.metadata_title || row.title || 'Untitled Graph',
                  description: row.metadata_description || '',
                  createdBy: row.metadata_created_by || 'Unknown',
                  version: Number(row.metadata_version || 1),
                  updatedAt: row.updated_at || row.created_date || 'Unknown',
                  category: row.metadata_category || '#Uncategorized',
                  metaArea,
                  graphType: row.metadata_graph_type || null,
                  seoSlug,
                  publicationState,
                  publishedAt: row.metadata_published_at || null,
                  isThemeGraph,
                  chatSessionCount: Number(row.metadata_chat_session_count || 0),
                  mystmkraUrl: row.metadata_mystmkra_url || null,
                  mystmkraDocumentId: row.metadata_mystmkra_document_id || null,
                  mystmkraNodeId: row.metadata_mystmkra_node_id || null,
                  ...(affiliates ? { affiliates } : {}),
                },
              }
            })
            .filter(Boolean)

          const hasMore = offset + rows.length < total

          return new Response(
            JSON.stringify({
              results: summaries,
              total,
              limit,
              offset,
              hasMore,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error fetching graph summaries:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // GET /searchGraphs — Search/filter graphs by node type, free text, or category
      if (pathname === '/searchGraphs' && request.method === 'GET') {
        try {
          // Auth: token with graph:read, session, or trusted origin = all graphs
          // Unauthenticated = published only
          const _srchApiToken = request.headers.get('X-API-Token')
          const _srchUserRole = request.headers.get('x-user-role')
          const _srchPluginAuth = request.headers.get('x-plugin-authenticated') === 'true'
          const _srchOrigin = request.headers.get('Origin')
          const _srchTrusted = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
          let srchPrivileged = false

          if (_srchApiToken && _srchApiToken !== 'null' && _srchApiToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (!tv.valid) {
              return new Response(JSON.stringify({ error: tv.error || 'Invalid API token' }), {
                status: tv.status || 401, headers: corsHeaders,
              })
            }
            if (!hasScope(tv.scopes, 'graph:read') && !hasScope(tv.scopes, 'all')) {
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:read' }), {
                status: 403, headers: corsHeaders,
              })
            }
            srchPrivileged = true
          } else if (_srchPluginAuth || _srchUserRole || (_srchOrigin && _srchTrusted.includes(_srchOrigin))) {
            srchPrivileged = true
          }

          const q = url.searchParams.get('q') || null
          const nodeType = url.searchParams.get('nodeType') || null
          const category = url.searchParams.get('category') || null
          const limit = parseIntWithBounds(url.searchParams.get('limit'), 20, 1, 50)
          const offset = parseIntWithBounds(url.searchParams.get('offset'), 0, 0, 1000000)

          const safeJsonDataSql = `CASE WHEN json_valid(data) THEN data ELSE '{}' END`
          const safeNodesSql = `COALESCE(json_extract(${safeJsonDataSql}, '$.nodes'), '[]')`

          const conditions = []
          const bindings = []

          // Restrict unauthenticated requests to published graphs only
          if (!srchPrivileged) {
            conditions.push(`(json_extract(${safeJsonDataSql}, '$.metadata.publicationState') = 'published' OR json_extract(${safeJsonDataSql}, '$.metadata.seoSlug') IS NOT NULL)`)
          }

          // Filter by node type
          if (nodeType) {
            conditions.push(`EXISTS (
              SELECT 1 FROM json_each(${safeNodesSql})
              WHERE json_extract(value, '$.type') = ?
            )`)
            bindings.push(nodeType)
          }

          // Free text search (title, description, category, node labels, and node content)
          // Supports wildcard: "Per * Stilling" matches "Per Egenæss Stilling"
          if (q) {
            // Replace * with SQL wildcard % so users can bridge unknown middle names etc.
            const searchPattern = `%${q.toLowerCase().replace(/\*/g, '%')}%`
            conditions.push(`(
              LOWER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.title'), title, '')) LIKE ?
              OR LOWER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.description'), '')) LIKE ?
              OR LOWER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.category'), '')) LIKE ?
              OR EXISTS (
                SELECT 1 FROM json_each(${safeNodesSql})
                WHERE LOWER(COALESCE(json_extract(value, '$.label'), '')) LIKE ?
                   OR LOWER(COALESCE(json_extract(value, '$.info'), '')) LIKE ?
              )
            )`)
            bindings.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
          }

          // Filter by category
          if (category) {
            conditions.push(`LOWER(COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.category'), '')) LIKE ?`)
            bindings.push(`%${category.toLowerCase()}%`)
          }

          const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

          // Count total matches
          const totalRow = await env.vegvisr_org
            .prepare(`SELECT COUNT(*) AS total FROM knowledge_graphs ${whereSql}`)
            .bind(...bindings)
            .first()
          const total = Number(totalRow?.total || 0)

          if (total === 0) {
            return new Response(JSON.stringify({ results: [], total: 0, limit, offset, hasMore: false }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          // Fetch matching graphs
          const query = `
            SELECT
              id,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.title'), title) AS metadata_title,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.description'), '') AS metadata_description,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.category'), '') AS metadata_category,
              COALESCE(json_extract(${safeJsonDataSql}, '$.metadata.metaArea'), '') AS metadata_meta_area,
              COALESCE(json_array_length(${safeNodesSql}), 0) AS node_count,
              COALESCE((
                SELECT GROUP_CONCAT(DISTINCT json_extract(value, '$.type'))
                FROM json_each(${safeNodesSql})
                WHERE json_extract(value, '$.type') IS NOT NULL
              ), '') AS node_types_csv,
              updated_at
            FROM knowledge_graphs
            ${whereSql}
            ORDER BY COALESCE(updated_at, created_date) DESC
            LIMIT ? OFFSET ?
          `

          const result = await env.vegvisr_org
            .prepare(query)
            .bind(...bindings, limit, offset)
            .all()
          const rows = result.results || result.rows || []

          const results = rows.map(row => ({
            id: row.id,
            title: row.metadata_title || row.id,
            description: row.metadata_description || '',
            category: row.metadata_category || '',
            metaArea: row.metadata_meta_area || '',
            nodeCount: Number(row.node_count || 0),
            nodeTypes: String(row.node_types_csv || '').split(',').filter(Boolean),
            updatedAt: row.updated_at || '',
          }))

          return new Response(JSON.stringify({
            results,
            total,
            limit,
            offset,
            hasMore: offset + rows.length < total,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error in /searchGraphs:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphs' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of knowledge graphs')

          // Token check: valid X-API-Token with graph:read bypasses hostname filter
          let tokenBypassFilter = false
          const apiToken = request.headers.get('X-API-Token')
          const pluginAuthenticated = request.headers.get('x-plugin-authenticated') === 'true'
          if (apiToken && apiToken !== 'null' && apiToken.trim() !== '') {
            const tokenValidation = await validateAuth(request, env)
            if (!tokenValidation.valid) {
              return new Response(JSON.stringify({ error: tokenValidation.error || 'Invalid API token' }), {
                status: tokenValidation.status || 401,
                headers: corsHeaders,
              })
            }
            if (!hasScope(tokenValidation.scopes, 'graph:read') && !hasScope(tokenValidation.scopes, 'all')) {
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:read' }), {
                status: 403,
                headers: corsHeaders,
              })
            }
            tokenBypassFilter = true
            console.log('[Worker] Valid API token — bypassing hostname filter, returning all graphs')
          } else if (pluginAuthenticated) {
            tokenBypassFilter = true
            console.log('[Worker] Plugin-authenticated request — bypassing hostname filter, returning all graphs')
          }

          // 1. Determine allowed meta areas based on KV store configuration
          const hostname =
            request.headers.get('x-original-hostname') || new URL(request.url).hostname
          console.log('[Worker] Request hostname:', hostname)

          let allowedMetaAreas = null

          // Check KV store for site configuration (skipped when token bypasses filter)
          if (!tokenBypassFilter) try {
            const kvKey = `site-config:${hostname}`
            const siteConfigData = await env.SITE_CONFIGS.get(kvKey)

            if (siteConfigData) {
              const siteConfig = JSON.parse(siteConfigData)
              if (siteConfig.contentFilter && Array.isArray(siteConfig.contentFilter.metaAreas)) {
                allowedMetaAreas = siteConfig.contentFilter.metaAreas
                console.log(
                  `[Worker] Using KV-based meta area filter for ${hostname}:`,
                  allowedMetaAreas,
                )
              } else {
                console.log(`[Worker] No meta area filter found in KV for ${hostname}`)
              }
            } else {
              console.log(`[Worker] No site configuration found in KV for ${hostname}`)
            }
          } catch (error) {
            console.error(`[Worker] Error fetching site config from KV for ${hostname}:`, error)
          }

          // 2. Fetch all graphs
          const query = `
            SELECT id, title, data, created_date, updated_at
            FROM knowledge_graphs
            ORDER BY COALESCE(updated_at, created_date) DESC
          `
          const results = await env.vegvisr_org.prepare(query).all()
          const allGraphs = results.results || results.rows || []
          console.log('[Worker] Total graphs fetched from database:', allGraphs.length)

          // 3a. Restrict unauthenticated requests to published graphs only
          if (!tokenBypassFilter) {
            const _graphsUserRole = request.headers.get('x-user-role')
            const _graphsPluginAuth = request.headers.get('x-plugin-authenticated') === 'true'
            const _graphsOrigin = request.headers.get('Origin')
            const _graphsTrustedOrigins = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
            const _graphsPrivileged = _graphsPluginAuth || _graphsUserRole || (_graphsOrigin && _graphsTrustedOrigins.includes(_graphsOrigin))
            if (!_graphsPrivileged) {
              console.log('[Worker] /getknowgraphs: unauthenticated — restricting to published graphs')
              allGraphs.splice(0, allGraphs.length, ...allGraphs.filter((row) => {
                try {
                  const g = JSON.parse(row.data)
                  return g.metadata?.publicationState === 'published' || g.metadata?.seoSlug
                } catch { return false }
              }))
            }
          }

          // 3b. Filter by meta area if needed (skipped when token bypass is active)
          let filteredGraphs = allGraphs
          if (!tokenBypassFilter && allowedMetaAreas) {
            console.log('[Worker] Applying meta area filter...')
            filteredGraphs = allGraphs.filter((row) => {
              try {
                const graphData = JSON.parse(row.data)
                const metaAreaString = graphData.metadata?.metaArea || ''
                const metaAreas = metaAreaString
                  .split('#')
                  .map((a) => a.trim().toUpperCase())
                  .filter(Boolean)
                const match = metaAreas.some((area) => allowedMetaAreas.includes(area))
                console.log(
                  `[Worker] Graph ${row.id} (${row.title}) - metaAreas:`,
                  metaAreas,
                  '- Match:',
                  match,
                )
                return match
              } catch (e) {
                console.log(`[Worker] Error parsing graph ${row.id}:`, e)
                return false
              }
            })
            console.log(
              '[Worker] Graphs after filtering:',
              filteredGraphs.length,
              'out of',
              allGraphs.length,
            )
          } else {
            console.log('[Worker] No filtering applied - returning all graphs')
          }

          // 4. Return only id and title (or whatever fields you want)
          const responseGraphs = filteredGraphs.map((row) => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_date || null,
            updatedAt: row.updated_at || row.created_date || null,
          }))

          console.log('[Worker] Final response will contain', responseGraphs.length, 'graphs')
          console.log(
            '[Worker] Graph IDs being returned:',
            responseGraphs.map((g) => g.id),
          )
          return new Response(JSON.stringify({ results: responseGraphs }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching knowledge graphs:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // Get graphs by user_id - efficient direct SQL query
      if (pathname === '/getGraphsByUser' && request.method === 'GET') {
        try {
          const userId = url.searchParams.get('userId')
          const sourceApp = url.searchParams.get('sourceApp')
          const limit = parseInt(url.searchParams.get('limit') || '50', 10)

          if (!userId) {
            return new Response(JSON.stringify({ error: 'userId parameter is required' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching graphs for user_id: ${userId}, sourceApp: ${sourceApp || 'any'}`)

          let query, params
          if (sourceApp) {
            query = `
              SELECT id, title, description, created_date, updated_at, user_id, source_app
              FROM knowledge_graphs
              WHERE user_id = ? AND source_app = ?
              ORDER BY created_date DESC
              LIMIT ?
            `
            params = [userId, sourceApp, limit]
          } else {
            query = `
              SELECT id, title, description, created_date, updated_at, user_id, source_app
              FROM knowledge_graphs
              WHERE user_id = ?
              ORDER BY created_date DESC
              LIMIT ?
            `
            params = [userId, limit]
          }

          const stmt = env.vegvisr_org.prepare(query)
          const results = sourceApp
            ? await stmt.bind(userId, sourceApp, limit).all()
            : await stmt.bind(userId, limit).all()

          const graphs = (results.results || []).map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            createdAt: row.created_date,
            updatedAt: row.updated_at,
            userId: row.user_id,
            sourceApp: row.source_app,
          }))

          console.log(`[Worker] Found ${graphs.length} graphs for user ${userId}`)

          return new Response(JSON.stringify({ success: true, graphs }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graphs by user:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // Video progress (World Builder Academy): founder marks own video completed; founder reads
      // own progress; Superadmin reads/writes for any email (operator "who watched what").
      if (pathname === '/video-progress' && (request.method === 'GET' || request.method === 'POST')) {
        try {
          await env.vegvisr_org.prepare(
            `CREATE TABLE IF NOT EXISTS video_progress (
               founder_email TEXT NOT NULL,
               video_key TEXT NOT NULL,
               completed INTEGER NOT NULL DEFAULT 1,
               updated_at TEXT DEFAULT (datetime('now')),
               PRIMARY KEY (founder_email, video_key)
             )`
          ).run()

          const tok = request.headers.get('X-API-Token')
          let callerEmail = null
          let callerRole = (request.headers.get('x-user-role') || '').trim() || null
          if (tok) {
            const a = await env.vegvisr_org.prepare('SELECT email, Role FROM config WHERE emailVerificationToken = ?').bind(tok).first()
            if (a) { callerEmail = String(a.email || '').toLowerCase(); callerRole = a.Role || callerRole }
          }
          const isSuper = callerRole === 'Superadmin'
          if (!callerEmail && !isSuper) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }

          if (request.method === 'GET') {
            const email = String(url.searchParams.get('email') || '').toLowerCase()
            if (!email) return new Response(JSON.stringify({ error: 'email parameter is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            if (!isSuper && email !== callerEmail) {
              return new Response(JSON.stringify({ error: 'Not authorized for that email' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            }
            const rows = await env.vegvisr_org.prepare('SELECT video_key FROM video_progress WHERE founder_email = ? AND completed = 1').bind(email).all()
            const completed = (rows?.results || []).map((r) => r.video_key)
            return new Response(JSON.stringify({ success: true, email, completed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }

          let body = {}
          try { body = await request.json() } catch {}
          const email = String(body.email || '').toLowerCase()
          const videoKey = String(body.video_key || '').trim()
          if (!email || !videoKey) return new Response(JSON.stringify({ error: 'email and video_key are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          if (!isSuper && email !== callerEmail) {
            return new Response(JSON.stringify({ error: 'Not authorized for that email' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
          await env.vegvisr_org.prepare(
            `INSERT INTO video_progress (founder_email, video_key, completed, updated_at)
             VALUES (?, ?, 1, datetime('now'))
             ON CONFLICT(founder_email, video_key) DO UPDATE SET completed = 1, updated_at = datetime('now')`
          ).bind(email, videoKey).run()
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      if (pathname === '/onboarding-status' && request.method === 'GET') {
        try {
          const email = url.searchParams.get('email')
          // Gate: Superadmin (any email) OR self — an X-API-Token resolving to a config row whose
          // OWN email equals the requested ?email may read their own report (a founder's MyPage).
          let allowed = request.headers.get('x-user-role') === 'Superadmin'
          if (!allowed) {
            const tok = request.headers.get('X-API-Token')
            if (tok) {
              const a = await env.vegvisr_org.prepare('SELECT Role, email FROM config WHERE emailVerificationToken = ?').bind(tok).first()
              if (a && (a.Role === 'Superadmin' || (email && String(a.email || '').toLowerCase() === String(email).toLowerCase()))) {
                allowed = true
              }
            }
          }
          if (!allowed) {
            return new Response(JSON.stringify({ error: 'Superadmin required, or a token matching the requested email' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }

          let domain = (url.searchParams.get('domain') || '').trim().toLowerCase()
          // The World this page is ABOUT is the one whose host it is served from. Derive it from
          // the calling page's Origin/Referer (me.<domain> -> <domain>) so a founder who belongs to
          // several Worlds sees the right one. Without this the registry lookup below just took
          // founderOf[0] — the oldest row — so torarnehave@gmail.com got lydmorah.net on EVERY
          // me.<domain> page, including me.slowyou.training (2026-08-19). An explicit ?domain=
          // still wins.
          let hostDomain = ''
          try {
            const ref = request.headers.get('Origin') || request.headers.get('Referer') || ''
            if (ref) {
              const h = new URL(ref).hostname.toLowerCase()
              hostDomain = h.startsWith('me.') ? h.slice(3) : h
            }
          } catch (_) { /* unparseable Origin/Referer — fall through to the old behaviour */ }
          // Auto-derive the World domain when not passed, so account-owner emails still get the
          // `world` block (e.g. lydmorah.net@gmail.com -> lydmorah.net; kristoffer@vitalinnsikt.no
          // -> vitalinnsikt.no). Skip generic providers (gmail etc.) where the host isn't a World.
          let domainSource = domain ? 'param' : null
          if (!domain && email && email.indexOf('@') > 0) {
            const local = email.slice(0, email.indexOf('@')).toLowerCase()
            const host = email.slice(email.indexOf('@') + 1).toLowerCase()
            const providers = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com'])
            // Only treat a dotted local-part as a domain if its last label is a real TLD
            // (lydmorah.net, iamazing.page). "stine.oksvold" is firstname.lastname — NOT a domain;
            // deriving it produced bogus DNS checks. The registry is the real fix for such founders.
            const tlds = new Set(['com','net','org','io','ai','page','dev','app','co','me','training','tech','xyz','site','online','store','blog','no','se','dk','fi','uk','eu','us'])
            const localTld = local.includes('.') ? local.split('.').pop() : ''
            if (local.includes('.') && tlds.has(localTld)) { domain = local; domainSource = 'derived-from-email-local' }
            else if (host && !providers.has(host)) { domain = host; domainSource = 'derived-from-email-host' }
          }
          if (!email) {
            return new Response(JSON.stringify({ error: 'email parameter is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }

          // Explicit World ownership registry — bridges founders whose World name has no relation
          // to their email (e.g. msneeggen@gmail.com founds iamazing.page; gmail derives no domain).
          // Maps founder OR account-holder email → World(s). Overrides convention when no domain.
          let founderOf = []
          let registryWorld = null
          try {
            const fr = await env.vegvisr_org
              .prepare("SELECT world_name, domain, cf_account_id, meta_area_tag, account_holder_email FROM world_founders WHERE founder_email = ?1 OR account_holder_email = ?1 ORDER BY created_at")
              .bind(email).all()
            founderOf = (fr && fr.results) || []
          } catch (_) { /* table may not exist yet */ }
          if (founderOf.length) {
            // Prefer the row for the host we are actually being viewed on, then an explicit
            // ?domain=, and only then fall back to the oldest row.
            registryWorld =
              (hostDomain && founderOf.find((w) => String(w.domain || '').toLowerCase() === hostDomain)) ||
              (domainSource === 'param' && domain && founderOf.find((w) => String(w.domain || '').toLowerCase() === domain)) ||
              founderOf[0]
            // Registry is authoritative: override an email-DERIVED domain (but respect an explicit
            // ?domain= param). This is why stine.oksvold@gmail.com resolves to stineoksvolddesign.no.
            if (domainSource !== 'param') { domain = registryWorld.domain; domainSource = 'world-founder-registry' }
          }

          // Config row (presence-only for secrets)
          const cfg = await env.vegvisr_org
            .prepare(`SELECT Role, user_id, cf_account_id, cf_api_token, cf_rtk_app_id, cf_r2_bucket, cf_kv_namespace_id, cf_r2_public_base,
                json_extract(data,'$.publishSubdomain') AS publishSubdomain,
                json_extract(data,'$.realtime.personalMeetingId') AS personal_meeting_id,
                json_extract(data,'$.realtime.teamMeetingId') AS team_meeting_id,
                (cf_rtk_token IS NOT NULL) AS has_rtk_token,
                (cf_r2_secret IS NOT NULL) AS has_r2_secret,
                (cf_kv_token IS NOT NULL) AS has_kv_token
              FROM config WHERE email = ?`).bind(email).first()
          const uid = cfg && cfg.user_id ? cfg.user_id : null

          // Knowledge graphs by createdBy
          const kgRow = await env.vegvisr_org
            .prepare("SELECT COUNT(*) AS n FROM knowledge_graphs WHERE json_extract(data,'$.metadata.createdBy') = ?").bind(email).first()
          const graphs = (kgRow && kgRow.n) || 0

          // Chat engagement (by user_id) from the group-chat DB
          let chat = { groups: 0, contributions: 0, total_in_groups: 0 }
          if (uid && env.CHAT_DB) {
            try {
              const g = await env.CHAT_DB.prepare('SELECT COUNT(*) AS n FROM group_members WHERE user_id = ?').bind(uid).first()
              const m = await env.CHAT_DB.prepare('SELECT COUNT(*) AS n, MAX(created_at) AS last FROM group_messages WHERE user_id = ?').bind(uid).first()
              const t = await env.CHAT_DB.prepare('SELECT COUNT(*) AS n FROM group_messages WHERE group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)').bind(uid).first()
              chat = { groups: (g && g.n) || 0, contributions: (m && m.n) || 0, total_in_groups: (t && t.n) || 0, last_message_ms: (m && m.last) || null }
            } catch (_) { /* leave zeros */ }
          }

          // Routine graph: graphs tagged #<DOMAIN-STEM>
          let routineGraphs = 0
          if (domain) {
            const tag = domain.split('.')[0].toUpperCase()
            const rg = await env.vegvisr_org
              .prepare("SELECT COUNT(*) AS n FROM knowledge_graphs WHERE upper(json_extract(data,'$.metadata.metaArea')) LIKE ?").bind('%#' + tag + '%').first()
            routineGraphs = (rg && rg.n) || 0
          }

          // Zone on Cloudflare via DNS-over-HTTPS NS lookup (no dig)
          let zoneOnCloudflare = null
          if (domain) {
            try {
              const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000) })
              const dj = await dns.json()
              const ns = (dj.Answer || []).map(a => String(a.data || '').toLowerCase()).join(',')
              zoneOnCloudflare = ns.includes('cloudflare')
            } catch (_) { zoneOnCloudflare = null }
          }

          // Cloudflare Email Routing — does the World's domain receive mail via Cloudflare? Email
          // Routing publishes route{1,2,3}.mx.cloudflare.net MX records, so a DoH MX lookup detects
          // it with no credentials (same approach as the NS/zone check). Other MX (Google, self-
          // hosted) => routing not enabled; we still surface the actual MX hosts for context.
          let emailRouting = { enabled: null, mx: [] }
          if (domain) {
            try {
              const mxr = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(4000) })
              const mj = await mxr.json()
              const mx = (mj.Answer || []).map((a) => String(a.data || '').split(' ').pop().replace(/\.$/, '').toLowerCase()).filter(Boolean)
              emailRouting = { enabled: mx.some((h) => h.endsWith('mx.cloudflare.net')), mx }
            } catch (_) { emailRouting = { enabled: null, mx: [] } }
          }

          // Published pages — the FINAL step of the Fully Provisioned World Builder journey.
          // Probe the brand proxy's /__html/check (live, like the DoH/RDAP checks) for the apex,
          // www, and any assigned subdomain. A live page lives in the CLIENT's own HTML_PAGES KV
          // (their account), so we detect it over HTTP rather than reading KV cross-account.
          let publishedPages = []
          let hasPublishedPage = false
          if (domain) {
            // Primary: ask the brand proxy to ENUMERATE all published pages — apex, www, AND arbitrary
            // subdomains (e.g. claude.iamazing.page) the report can't guess. Auto-discovers everything.
            let listed = null
            try {
              const lr = await fetch(`https://${domain}/__html/list`, { signal: AbortSignal.timeout(5000) })
              if (lr.ok) {
                const lj = await lr.json()
                if (lj && lj.ok && Array.isArray(lj.pages)) {
                  listed = lj.pages.map((p) => ({ host: p.host, live: true, published_at: p.published_at || null }))
                }
              }
            } catch (_) { listed = null }
            if (listed) {
              publishedPages = listed
            } else {
              // Fallback: proxy lacks /__html/list — probe the known candidate hosts individually.
              const hosts = new Set([domain, `www.${domain}`])
              if (cfg && cfg.publishSubdomain) hosts.add(String(cfg.publishSubdomain).trim().toLowerCase())
              // Step 1: explicit-key check per host (does html:<host> exist in the proxy's KV?).
              const checks = await Promise.all(Array.from(hosts).map(async (h) => {
                try {
                  const r = await fetch(`https://${h}/__html/check?hostname=${encodeURIComponent(h)}`, { signal: AbortSignal.timeout(4000) })
                  if (!r.ok) return { host: h, exists: false, published_at: null }
                  const j = await r.json()
                  return { host: h, exists: Boolean(j && j.exists), published_at: (j && j.metadata && j.metadata.publishedAt) || null }
                } catch (_) { return { host: h, exists: false, published_at: null } }
              }))
              // Step 2: apex-fallback awareness. The brand proxy serves the apex page for www (and
              // other fallback hosts) even with NO dedicated html:<host> key — /__html/check then
              // reports exists:false while GET returns the real 200 page (observed for
              // www.universi.no, 2026-07-13). So a host with no own key still counts as live when
              // the apex IS published AND the host actually serves 200. Gated on apexPublished to
              // avoid marking a random 200 (parked page) as a published World page.
              const apexCheck = checks.find((c) => c.host === domain)
              const apexPublished = Boolean(apexCheck && apexCheck.exists)
              publishedPages = await Promise.all(checks.map(async (c) => {
                if (c.exists) return { host: c.host, live: true, published_at: c.published_at }
                if (apexPublished && c.host !== domain) {
                  try {
                    const r = await fetch(`https://${c.host}/`, { method: 'GET', signal: AbortSignal.timeout(4000) })
                    if (r.ok) return { host: c.host, live: true, published_at: (apexCheck && apexCheck.published_at) || null }
                  } catch (_) { /* not serving via fallback */ }
                }
                return { host: c.host, live: false, published_at: null }
              }))
            }
            hasPublishedPage = publishedPages.some((p) => p.live)
          }

          // Registrar + nameservers via RDAP (HTTP whois). rdap.org 302-redirects to the
          // authoritative RDAP server per the IANA bootstrap; follow the redirect MANUALLY
          // (Worker redirect:'follow' was unreliable here). Works for any TLD.
          let registrar = null
          let nameservers = null
          if (domain) {
            // Registry RDAP — esp. Google's pubapi.registry.google for .page/.dev — is routinely
            // slow, so a single 5s attempt intermittently read null ("Not detected" for a domain
            // that IS registered). Give each attempt 8s and retry once on timeout/failure; stop as
            // soon as we get a parseable response (even if it has no registrar entity).
            for (let attempt = 0; attempt < 2; attempt++) {
              let rj = null
              try {
                let rurl = `https://rdap.org/domain/${encodeURIComponent(domain)}`
                for (let hop = 0; hop < 4 && rurl; hop++) {
                  const rd = await fetch(rurl, { headers: { Accept: 'application/rdap+json', 'User-Agent': 'vegvisr-onboarding/1.0' }, redirect: 'manual', signal: AbortSignal.timeout(8000) })
                  if (rd.status >= 300 && rd.status < 400) { rurl = rd.headers.get('location'); continue }
                  if (rd.ok) rj = await rd.json()
                  break
                }
              } catch (_) { rj = null }
              if (rj) {
                for (const e of (rj.entities || [])) {
                  if ((e.roles || []).includes('registrar')) {
                    const va = e.vcardArray
                    if (va && va[1]) for (const it of va[1]) if (it[0] === 'fn') registrar = it[3]
                    registrar = registrar || e.handle || null
                  }
                }
                nameservers = (rj.nameservers || []).map(n => n.ldhName).filter(Boolean)
                break // got a response — don't retry
              }
              // rj null → timed out or failed; loop retries once more
            }
          }

          // Recorded meetings (r2_sync_jobs, keyed by owner_email) — a strong "actually used it" signal
          let recordings = 0
          try {
            const rr = await env.vegvisr_org.prepare('SELECT COUNT(*) AS n FROM r2_sync_jobs WHERE owner_email = ?').bind(email).first()
            recordings = (rr && rr.n) || 0
          } catch (_) { recordings = 0 }

          // Live Cloudflare account introspection — audio R2 buckets and transcripts KV namespaces are
          // NOT tracked by any D1 column, so a presence-of-column check would silently miss a founder
          // who already has one provisioned by hand. Query the founder's own Cloudflare account
          // directly (their stored cf_account_id + cf_api_token, same credentials Agent-Builder's
          // set_world_credentials/cfApi helper uses) so this reflects what's ACTUALLY there.
          let audioR2 = { ok: false, bucket: null, object_count: 0, kv_namespace: null, note: 'no Cloudflare credentials stored for this founder' }
          let transcriptsKv = { ok: false, namespaces: [], note: 'no Cloudflare credentials stored for this founder' }
          if (cfg && cfg.cf_account_id && cfg.cf_api_token) {
            const cfHeaders = { Authorization: `Bearer ${cfg.cf_api_token}` }
            // Audio setup has TWO real parts, verified against stine.oksvold's account (b68bda52e0…):
            // (1) the actual files, under an `audio/` PREFIX inside the same R2 bucket used for video
            //     (cfg.cf_r2_bucket, e.g. "meeting-recordings") — NOT a separately named bucket.
            // (2) the metadata/delivery index, a KV namespace titled exactly AUDIO_PORTFOLIO.
            let objectCount = 0
            let bucketNote = null
            if (cfg.cf_r2_bucket) {
              try {
                const or = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.cf_account_id}/r2/buckets/${cfg.cf_r2_bucket}/objects?prefix=audio/&per_page=1`, { headers: cfHeaders, signal: AbortSignal.timeout(6000) })
                const oj = await or.json().catch(() => null)
                if (or.ok && oj && oj.success) {
                  objectCount = (oj.result || []).length
                  bucketNote = objectCount ? null : `bucket "${cfg.cf_r2_bucket}" has no objects under audio/`
                } else {
                  bucketNote = (oj && oj.errors && oj.errors[0] && oj.errors[0].message) || `object list failed (${or.status})`
                }
              } catch (e) { bucketNote = `object list error: ${e.message}` }
            } else {
              bucketNote = 'no cf_r2_bucket configured for this founder'
            }
            let audioKvNs = null
            let allNs = []
            try {
              const kr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.cf_account_id}/storage/kv/namespaces`, { headers: cfHeaders, signal: AbortSignal.timeout(6000) })
              const kj = await kr.json().catch(() => null)
              if (kr.ok && kj && kj.success) allNs = kj.result || []
            } catch (_) { /* leave empty */ }
            const audioNsMatch = allNs.find((n) => String(n.title || '').toUpperCase() === 'AUDIO_PORTFOLIO')
            if (audioNsMatch) audioKvNs = { id: audioNsMatch.id, title: audioNsMatch.title }
            audioR2 = {
              ok: objectCount > 0 || Boolean(audioKvNs),
              bucket: cfg.cf_r2_bucket || null,
              object_count: objectCount,
              kv_namespace: audioKvNs,
              note: (objectCount || audioKvNs) ? null : bucketNote,
            }
            // Transcripts are NOT a separately-named KV namespace either — verified against
            // stine.oksvold's AUDIO_PORTFOLIO namespace: each recording's transcript is the VALUE of
            // an `audio-recording:<email>:<id>` key inside that same namespace. List keys with that
            // prefix in the AUDIO_PORTFOLIO namespace found above, rather than looking for a
            // differently-titled namespace.
            if (audioKvNs) {
              try {
                const kkr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.cf_account_id}/storage/kv/namespaces/${audioKvNs.id}/keys?prefix=audio-recording:&limit=10`, { headers: cfHeaders, signal: AbortSignal.timeout(6000) })
                const kkj = await kkr.json().catch(() => null)
                if (kkr.ok && kkj && kkj.success) {
                  const keys = kkj.result || []
                  transcriptsKv = { ok: keys.length > 0, namespace: audioKvNs, key_count: keys.length, note: keys.length ? null : `namespace "${audioKvNs.title}" has no audio-recording: keys` }
                } else {
                  transcriptsKv = { ok: false, namespace: audioKvNs, key_count: 0, note: (kkj && kkj.errors && kkj.errors[0] && kkj.errors[0].message) || `key list failed (${kkr.status})` }
                }
              } catch (e) { transcriptsKv = { ok: false, namespace: audioKvNs, key_count: 0, note: `key list error: ${e.message}` } }
            } else {
              transcriptsKv = { ok: false, namespace: null, key_count: 0, note: 'no AUDIO_PORTFOLIO namespace found for this founder' }
            }
          }

          // Email sending — can this account actually send mail? The "machine password" (Gmail app
          // password) the email-worker uses lives in config.data.settings.emailAccountPasswords,
          // keyed by account id, with senders in config.data.settings.emailAccounts. A sender is
          // "live" when it has a stored password. This is exactly what loadUserSettings resolves.
          // ok = CONFIGURED (a sender has a stored app password). verified = PROVEN (a real send
          // succeeded — the email-worker stamps settings.emailAccountVerifiedAt[id] on success).
          let emailSending = { ok: false, verified: false, accounts: 0, with_password: 0, senders: [], verified_senders: [], last_verified_at: null }
          try {
            const emailSql =
              "SELECT json_extract(je.value,'$.email') AS account_email, " +
              "json_extract(je.value,'$.hasPassword') AS has_password, " +
              "json_extract(c2.data,'$.settings.emailAccountVerifiedAt.' || json_extract(je.value,'$.id')) AS verified_at " +
              "FROM config c2, json_each(json_extract(c2.data,'$.settings.emailAccounts')) je WHERE c2.email = ?"
            const er = await env.vegvisr_org.prepare(emailSql).bind(email).all()
            const rows = (er && er.results) || []
            const senders = rows.filter((r) => r.has_password).map((r) => r.account_email).filter(Boolean)
            const verifiedSenders = rows.filter((r) => r.verified_at).map((r) => r.account_email).filter(Boolean)
            const verifiedAts = rows.map((r) => r.verified_at).filter(Boolean).sort()
            emailSending = {
              ok: senders.length > 0,
              verified: verifiedSenders.length > 0,
              accounts: rows.length,
              with_password: senders.length,
              senders,
              verified_senders: verifiedSenders,
              last_verified_at: verifiedAts.length ? verifiedAts[verifiedAts.length - 1] : null,
            }
          } catch (_) { /* leave default (no accounts configured) */ }

          // DNS move state (registry delegation via RDAP vs. actual Cloudflare resolution via DoH).
          // Computed before the verdict because "propagating" — nameservers swapped but not yet
          // resolving — is the ON WAIT signal: the owner has ACTED and is blocked waiting, not idle.
          const delegatedToCloudflare = Array.isArray(nameservers) && nameservers.some((n) => String(n).toLowerCase().includes('cloudflare'))
          let dnsMoveStatus = null
          if (domain) {
            if (zoneOnCloudflare === true) dnsMoveStatus = 'active'           // resolving via Cloudflare → ready to provision
            else if (delegatedToCloudflare) dnsMoveStatus = 'propagating'      // NS swapped at registrar, not yet resolving
            else if (zoneOnCloudflare === false) dnsMoveStatus = 'not_started' // still on the old registrar's nameservers
            else dnsMoveStatus = 'unknown'
          }
          const blockedWaiting = dnsMoveStatus === 'propagating'

          // Engagement ladder (lowest→highest energy): PARK < ON WAIT < NUDGE < DEVELOPING < GO.
          //  GO         = shipped: a live published page (the end state of the journey).
          //  DEVELOPING = real momentum, not live yet: tested the product, recently active in chat,
          //               or building KGs alongside chat. Flips to GO when a page goes live.
          //  NUDGE      = some signal but stalled/thin: a little chat, or KGs but no chat.
          //  ON WAIT    = engaged but blocked on an external step (DNS propagating after an NS swap).
          //  PARK       = dormant: no testing, no chat, no content, nothing in flight.
          const VERDICT_RANK = { PARK: 0, 'ON WAIT': 1, NUDGE: 2, DEVELOPING: 3, GO: 4 }
          const lastMs = chat.last_message_ms || 0
          const lastChatDaysAgo = lastMs ? Math.floor((Date.now() - lastMs) / 86400000) : null
          const tested = Boolean((cfg && (cfg.personal_meeting_id || cfg.team_meeting_id)) || recordings > 0)
          const recentlyActive = Boolean(chat.contributions >= 5 && lastChatDaysAgo !== null && lastChatDaysAgo <= 14)
          const hasChat = chat.contributions > 0
          const building = graphs > 0
          let verdict, verdictReason
          if (hasPublishedPage) {
            verdict = 'GO'; verdictReason = recentlyActive ? 'published a live page and active in chat — fully launched' : 'published a live page — reached the end of the onboarding journey'
          } else if (tested || recentlyActive || (building && hasChat)) {
            verdict = 'DEVELOPING'
            verdictReason = (tested && recentlyActive) ? 'tested the product and active in chat — building toward launch'
              : recentlyActive ? 'active in chat and building — not yet published'
              : tested ? 'tested the product — building toward launch'
              : 'building knowledge graphs with chat activity — not yet published'
          } else if (hasChat || building) {
            verdict = 'NUDGE'
            verdictReason = hasChat ? 'some chat activity but stalled — one nudge with a deadline' : 'building knowledge graphs but quiet in chat — one nudge with a deadline'
          } else if (blockedWaiting) {
            verdict = 'ON WAIT'; verdictReason = 'nameservers swapped to Cloudflare — waiting on DNS propagation before the next steps'
          } else {
            verdict = 'PARK'; verdictReason = 'provisioned but no testing, chat, or content yet'
          }

          // World-scoped aggregation (derived by convention): a World = the domain + its chat
          // group(s) (name ~ domain stem) + KGs tagged #<STEM> + contributors (group members ∪
          // KG creators). Counts activity that belongs to the World even when it's under other
          // identities (e.g. iamazing.page: Maiken's "iAmazing" group + her #IAMAZING graphs).
          let world = null
          if (domain) {
            const stem = domain.split('.')[0]
            // Honor the registry's explicit metaArea tag when present (e.g. #IAMAZING), else convention (#<STEM>).
            const worldTagStem = (registryWorld && registryWorld.meta_area_tag ? String(registryWorld.meta_area_tag).replace(/^#/, '') : stem).toUpperCase()
            // Match chat groups by the WORLD tag stem (e.g. #STINE → "stine" matches group "Stine sin"),
            // not the domain stem ("stineoksvolddesign") — the tag is the World's real content key.
            const likeName = `%${worldTagStem.toLowerCase()}%`
            const tagLike = `%#${worldTagStem}%`
            let worldGroups = [], worldMsgs = 0, worldMembers = 0, memberUids = []
            if (env.CHAT_DB) {
              try {
                const gr = await env.CHAT_DB.prepare("SELECT g.id, g.name, (SELECT COUNT(*) FROM group_messages WHERE group_id=g.id) AS msgs, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) AS members FROM groups g WHERE lower(g.name) LIKE ?").bind(likeName).all()
                worldGroups = (gr.results || []).map(r => ({ id: r.id, name: r.name, messages: r.msgs || 0, members: r.members || 0 }))
                worldMsgs = worldGroups.reduce((s, g) => s + (g.messages || 0), 0)
                const mr = await env.CHAT_DB.prepare("SELECT DISTINCT user_id FROM group_members WHERE group_id IN (SELECT id FROM groups WHERE lower(name) LIKE ?)").bind(likeName).all()
                memberUids = (mr.results || []).map(r => r.user_id).filter(Boolean)
                worldMembers = memberUids.length
              } catch (_) { /* leave zeros */ }
            }
            let worldKgCount = 0
            const kgCreators = []
            try {
              const kr = await env.vegvisr_org.prepare("SELECT json_extract(data,'$.metadata.createdBy') AS creator, COUNT(*) AS n FROM knowledge_graphs WHERE upper(json_extract(data,'$.metadata.metaArea')) LIKE ? GROUP BY creator").bind(tagLike).all()
              for (const row of (kr.results || [])) { worldKgCount += row.n || 0; if (row.creator && String(row.creator).includes('@')) kgCreators.push(row.creator) }
            } catch (_) { /* leave zero */ }
            const contribEmails = new Set(kgCreators)
            if (memberUids.length) {
              try {
                const ph = memberUids.map(() => '?').join(',')
                const er = await env.vegvisr_org.prepare(`SELECT DISTINCT email FROM config WHERE user_id IN (${ph})`).bind(...memberUids).all()
                for (const row of (er.results || [])) if (row.email) contribEmails.add(row.email)
              } catch (_) { /* skip */ }
            }
            // Same 5-level ladder, World-scoped.
            const worldActive = worldMsgs >= 5
            const worldBuilding = worldKgCount >= 1
            const worldHasChat = worldMsgs > 0
            let wVerdict, wReason
            if (hasPublishedPage) { wVerdict = 'GO'; wReason = worldBuilding ? 'World is live — published page plus knowledge graphs' : 'World is live — published page' }
            else if (worldActive || (worldBuilding && worldHasChat)) { wVerdict = 'DEVELOPING'; wReason = 'active World — group and knowledge graphs, not yet published' }
            else if (worldHasChat || worldBuilding) { wVerdict = 'NUDGE'; wReason = 'some World activity but thin' }
            else if (blockedWaiting) { wVerdict = 'ON WAIT'; wReason = 'domain nameservers swapped — waiting on DNS propagation' }
            else { wVerdict = 'PARK'; wReason = 'no World group activity or knowledge graphs' }
            world = {
              tag: `#${worldTagStem}`,
              chat: { groups: worldGroups, messages: worldMsgs, members: worldMembers },
              knowledge_graphs: { count: worldKgCount, creators: kgCreators },
              published_pages: publishedPages,
              published: hasPublishedPage,
              contributors: Array.from(contribEmails),
              verdict: wVerdict,
              reason: wReason,
            }
          }

          // Overall verdict = the HIGHER of the personal and World ladders. A World further along
          // than the account-holder's personal identity (whose activity often lives under other
          // identities, e.g. iamazing.page's real work is Maiken's) lifts the owner to match.
          // personal_verdict preserves the raw account-only signal.
          const personalVerdict = verdict
          if (world && VERDICT_RANK[world.verdict] > VERDICT_RANK[verdict]) {
            verdict = world.verdict
            verdictReason = `World is ${world.verdict} (${world.reason}); credited to ${email} even though the personal identity is at ${personalVerdict}`
          }

          // Ownership stack — walk the org/World model for this email: which org(s) they own a
          // share of, whether those orgs are System Owner / World Founder, and the domains operated.
          let ownership = null
          try {
            const so = await env.vegvisr_org.prepare('SELECT org_name, scope FROM system_owners WHERE email = ?').bind(email).first()
            const orgRows = ((await env.vegvisr_org.prepare('SELECT o.id AS id, o.name AS name, o.function AS fn, ow.percent AS percent FROM org_ownership ow JOIN organizations o ON o.id = ow.org_id WHERE ow.person_email = ?').bind(email).all()).results) || []
            const orgIds = orgRows.map((r) => r.id)
            const orgPh = orgIds.map(() => '?').join(',')
            const wfSql = 'SELECT wf.world_name AS world_name, wf.domain AS domain, wf.hosting_model AS hosting_model, o.name AS org_name FROM world_founders wf LEFT JOIN organizations o ON o.id = wf.founder_org_id WHERE wf.founder_email = ?' + (orgIds.length ? ` OR wf.founder_org_id IN (${orgPh})` : '')
            const worlds = ((await env.vegvisr_org.prepare(wfSql).bind(email, ...orgIds).all()).results) || []
            let domainsOperated = []
            if (orgIds.length) {
              domainsOperated = ((await env.vegvisr_org.prepare(`SELECT d.domain AS domain, d.kind AS kind, o.name AS org_name FROM domains d JOIN organizations o ON o.id = d.founder_org_id WHERE d.founder_org_id IN (${orgPh}) ORDER BY d.kind, d.domain`).bind(...orgIds).all()).results) || []
            }
            if (so || orgRows.length || worlds.length) {
              ownership = {
                system_owner: so ? { org_name: so.org_name, scope: so.scope } : null,
                orgs: orgRows.map((r) => ({ name: r.name, function: r.fn, percent: r.percent })),
                worlds: worlds.map((w) => ({ world_name: w.world_name, domain: w.domain, org_name: w.org_name || null, hosting_model: w.hosting_model })),
                domains_operated: domainsOperated,
              }
            }
          } catch (_) { ownership = null }

          // ── Gamification engine (additive) ──────────────────────────────
          // Turns the SAME signals the verdict already used into level/xp/badges/next_quest.
          // No new measurement; reuses verdict, tested, chat, graphs, hasPublishedPage, world.*.
          // Consumed by the Agent-Builder "Gamification" card and (later) the Founder cockpit.
          // Badges that need event history we don't yet store are returned earned:false with a
          // `needs` note rather than faked (Lesson 1 — don't claim what isn't measured).
          const TIER_BY_RANK = ['Seed', 'Waiting', 'Sprout', 'Grove', 'Beacon']
          const gLevel = VERDICT_RANK[verdict]
          const gTier = TIER_BY_RANK[gLevel] || 'Seed'
          const wChatMembers = world ? (world.chat.members || 0) : 0
          const wContributors = world ? ((world.contributors || []).length || 0) : 0
          const wKg = world ? (world.knowledge_graphs.count || 0) : 0
          const gXp =
            (tested ? 100 : 0) +
            Math.min(chat.contributions || 0, 50) * 5 +
            (graphs || 0) * 30 +
            (hasPublishedPage ? 300 : 0) +
            wChatMembers * 10 +
            wKg * 20
          const mkBadge = (id, name, earned, needs) => ({ id, name, earned: Boolean(earned), ...(needs ? { needs } : {}) })
          const gBadges = [
            mkBadge('first_light', 'First Light', tested),
            mkBadge('open_doors', 'Open Doors', hasPublishedPage),
            mkBadge('town_square', 'Town Square', wChatMembers >= 5),
            mkBadge('cartographer', 'Cartographer', (graphs || 0) >= 3 || wKg >= 3),
            mkBadge('circle_keeper', 'Circle Keeper', wContributors > 1),
            mkBadge('flow_rider', 'Flow Rider', recentlyActive, recentlyActive ? null : 'needs a 4-week activity streak (history not yet tracked)'),
            mkBadge('bridge_builder', 'Bridge Builder', false, 'needs member-activated-N-days tracking (not yet stored)'),
            mkBadge('weekend_gathering', 'Weekend Gathering', false, 'needs live-session weekend history (not yet stored)'),
          ]
          let gNextQuest
          if (verdict === 'GO') gNextQuest = 'Maintain momentum — keep weekly live sessions and chat alive.'
          else if (verdict === 'DEVELOPING') gNextQuest = "Publish your World's page to reach GO."
          else if (verdict === 'NUDGE') gNextQuest = hasChat ? 'Add knowledge graphs and invite members to deepen the World.' : 'Start a chat group and invite your first members.'
          else if (verdict === 'ON WAIT') gNextQuest = 'Waiting on DNS propagation — nothing to do until the domain resolves on Cloudflare.'
          else gNextQuest = 'Host your first live room or start your World chat to wake the World.'
          const gamification = {
            level: gLevel,
            tier: gTier,
            verdict,
            xp: gXp,
            badges: gBadges,
            earned_badge_ids: gBadges.filter((b) => b.earned).map((b) => b.id),
            next_quest: gNextQuest,
          }

          const result = {
            success: true,
            email,
            domain: domain || null,
            domain_source: domainSource,
            ownership,
            founder_of: founderOf,
            registrar: registrar || null,
            dns_move: domain ? { status: dnsMoveStatus, delegated_to_cloudflare: delegatedToCloudflare, resolving_on_cloudflare: zoneOnCloudflare } : null,
            world,
            engagement: {
              verdict,
              reason: verdictReason,
              personal_verdict: personalVerdict,
              blocked_waiting: blockedWaiting,
              tested,
              published: hasPublishedPage,
              recordings,
              chat_contributions: chat.contributions,
              last_chat_days_ago: lastChatDaysAgo,
              recently_active: recentlyActive,
            },
            gamification,
            nameservers: nameservers || null,
            role: (cfg && cfg.Role) || null,
            account: (cfg && cfg.cf_account_id) || null,
            capabilities: {
              cf_account: Boolean(cfg && cfg.cf_account_id),
              realtimekit: {
                ok: Boolean(cfg && cfg.cf_rtk_app_id && cfg.has_rtk_token),
                app_id: (cfg && cfg.cf_rtk_app_id) || null,
                rooms_created: Boolean(cfg && (cfg.personal_meeting_id || cfg.team_meeting_id)),
                personal_meeting_id: (cfg && cfg.personal_meeting_id) || null,
                team_meeting_id: (cfg && cfg.team_meeting_id) || null,
              },
              r2_recording: { ok: Boolean(cfg && cfg.cf_r2_bucket && cfg.has_r2_secret), bucket: (cfg && cfg.cf_r2_bucket) || null },
              telemetry_kv: { ok: Boolean(cfg && cfg.cf_kv_namespace_id && cfg.has_kv_token), namespace_id: (cfg && cfg.cf_kv_namespace_id) || null },
              // Custom domain for video storage — config.cf_r2_public_base is the permanent public
              // origin set by set_realtime_recordings_domain (Agent-Builder), e.g. recordings.<domain>.
              video_domain: { ok: Boolean(cfg && cfg.cf_r2_public_base), domain: (cfg && cfg.cf_r2_public_base) || null },
              // Any videos actually stored — r2_sync_jobs rows keyed by owner_email (same count as
              // engagement.recordings above; surfaced here as its own status check).
              videos_stored: { ok: recordings > 0, count: recordings },
              // Per-founder audio R2 — no D1 column tracks this, so it's resolved LIVE against the
              // founder's own Cloudflare account (cf_account_id + cf_api_token) rather than guessed.
              audio_r2: audioR2,
              // Per-founder transcripts KV — same live-lookup approach as audio_r2 above.
              transcripts_kv: transcriptsKv,
              email_sending: emailSending,
              email_routing: emailRouting,
              assigned_subdomain: (cfg && cfg.publishSubdomain) || null,
              published_pages: publishedPages,
              knowledge_graphs: graphs,
              chat,
              zone_on_cloudflare: zoneOnCloudflare,
              routine_graph: routineGraphs,
            },
          }
          return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (error) {
          console.error('[Worker] onboarding/status error:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), { status: 500, headers: corsHeaders })
        }
      }

      if (pathname === '/getGraphsByCreator' && request.method === 'GET') {
        try {
          const email = url.searchParams.get('email')
          const limit = parseInt(url.searchParams.get('limit') || '50', 10)
          if (!email) {
            return new Response(JSON.stringify({ error: 'email parameter is required' }), {
              status: 400,
              headers: corsHeaders,
            })
          }
          // createdBy lives in the graph JSON (data.metadata.createdBy), not a column —
          // a single json_extract COUNT replaces client-side paging of all summaries.
          const countRow = await env.vegvisr_org
            .prepare("SELECT COUNT(*) AS n FROM knowledge_graphs WHERE json_extract(data, '$.metadata.createdBy') = ?")
            .bind(email)
            .first()
          const count = (countRow && countRow.n) || 0
          const results = await env.vegvisr_org
            .prepare(
              "SELECT id, title, created_date, updated_at FROM knowledge_graphs WHERE json_extract(data, '$.metadata.createdBy') = ? ORDER BY updated_at DESC LIMIT ?"
            )
            .bind(email, limit)
            .all()
          const graphs = (results.results || []).map(row => ({
            id: row.id,
            title: row.title,
            createdAt: row.created_date,
            updatedAt: row.updated_at,
          }))
          return new Response(JSON.stringify({ success: true, email, count, graphs }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error in getGraphsByCreator:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraph' && request.method === 'GET') {
        try {
          // Auth: accept X-API-Token with graph:read scope in addition to existing methods.
          // Backward compatible — unauthenticated requests still pass through.
          const apiToken = request.headers.get('X-API-Token')
          const pluginAuthenticated = request.headers.get('x-plugin-authenticated') === 'true'
          if (apiToken && apiToken !== 'null' && apiToken.trim() !== '') {
            const tokenValidation = await validateAuth(request, env)
            if (!tokenValidation.valid) {
              return new Response(JSON.stringify({ error: tokenValidation.error || 'Invalid API token' }), {
                status: tokenValidation.status || 401,
                headers: corsHeaders,
              })
            }
            if (!hasScope(tokenValidation.scopes, 'graph:read') && !hasScope(tokenValidation.scopes, 'all')) {
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:read' }), {
                status: 403,
                headers: corsHeaders,
              })
            }
          } else if (pluginAuthenticated) {
            // Already validated through the plugin session flow.
          }

          const id = url.searchParams.get('id')
          if (!id) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching graph with ID: ${id}`)

          const query = `SELECT data, created_date, updated_at FROM knowledge_graphs WHERE id = ?`
          const result = await env.vegvisr_org.prepare(query).bind(id).first()

          if (!result) {
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))

          // Add database timestamp fields to the response
          graphData.created_date = result.created_date
          graphData.updated_at = result.updated_at

          graphData.nodes = graphData.nodes.map((node) => ({
            ...node,
            imageWidth: node.imageWidth || null, // Ensure imageWidth is included
            imageHeight: node.imageHeight || null, // Ensure imageHeight is included
            path: node.path || null, // Ensure path is included
          }))
          graphData.edges = graphData.edges.map(({ source, target }) => ({
            id: `${source}_${target}`, // Ensure edge ID is set
            source,
            target,
          }))

          const nodeId = url.searchParams.get('nodeId')
          const nodeTitle = url.searchParams.get('nodeTitle')
          if (nodeId || nodeTitle) {
            let filteredNodes = graphData.nodes
            if (nodeId) {
              filteredNodes = filteredNodes.filter((node) => String(node.id) === String(nodeId))
            }
            if (nodeTitle) {
              const needle = nodeTitle.toLowerCase()
              filteredNodes = filteredNodes.filter((node) => {
                const label = node.label || node.title || node.name || ''
                return String(label).toLowerCase().includes(needle)
              })
            }
            const allowedIds = new Set(filteredNodes.map((node) => String(node.id)))
            graphData.nodes = filteredNodes
            graphData.edges = graphData.edges.filter(
              (edge) => allowedIds.has(String(edge.source)) && allowedIds.has(String(edge.target)),
            )
          }

          // Decrypt data-node info fields before returning
          if (env.ENCRYPTION_MASTER_KEY && graphData.nodes) {
            for (const node of graphData.nodes) {
              if (node.type === 'data-node' && node.metadata?.encrypted && node.info) {
                try {
                  node.info = await decryptDataNodeInfo(node.info, env.ENCRYPTION_MASTER_KEY)
                } catch (e) {
                  console.error('Failed to decrypt data-node:', node.id, e.message)
                  node.info = '[]'
                }
              }
            }
          }

          console.log('[Worker] Graph fetched successfully')
          return new Response(JSON.stringify(graphData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // NEW: Public HTML version of knowledge graph for AI crawling
      if (pathname === '/public-graph' && request.method === 'GET') {
        try {
          const id = url.searchParams.get('id')
          if (!id) {
            return new Response(generateErrorHtml('Graph ID is required.'), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'text/html' },
            })
          }

          console.log(`[Worker] Fetching public graph with ID: ${id}`)

          const query = `SELECT data, created_date, updated_at FROM knowledge_graphs WHERE id = ?`
          const result = await env.vegvisr_org.prepare(query).bind(id).first()

          if (!result) {
            return new Response(generateErrorHtml('Graph not found.'), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'text/html' },
            })
          }

          const graphData = sanitizeGraphData(JSON.parse(result.data))
          const html = generateGraphHtml(graphData, id)

          console.log('[Worker] Public graph HTML generated successfully')
          return new Response(html, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching public graph:', error)
          return new Response(generateErrorHtml(`Server error: ${error.message}`), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          })
        }
      }

      if (pathname === '/saveGraphWithHistory' && request.method === 'POST') {
        // Validate API token for write operations
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }

        // Check for required scope
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const requestBody = await request.json()
          const { id, graphData, override } = requestBody

          if (!id || !graphData) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and graph data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Saving graph with history for ID: ${id}`)

          // Check if this graph exists in the main knowledge_graphs table first
          const checkGraphExistsQuery = `SELECT id FROM knowledge_graphs WHERE id = ?`
          const graphExists = await env.vegvisr_org.prepare(checkGraphExistsQuery).bind(id).first()

          // UUID v4 required for NEW graphs. Existing graphs (regardless of id
          // format — semantic-named legacy graphs are common in this database)
          // may continue to update at their current id. Additive enforcement
          // decided 2026-05-28: tighten new-graph creation without breaking
          // any existing data. Only applies to /saveGraphWithHistory; the
          // legacy /saveknowgraph endpoint stays fully permissive.
          const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          if (!graphExists && !UUID_V4_RE.test(id)) {
            return new Response(
              JSON.stringify({
                error: 'New graph IDs must be a valid UUID v4. Existing graphs with non-UUID ids may still update at their current id.',
                expected: 'UUID v4 (e.g., 550e8400-e29b-41d4-a716-446655440000)',
                received: id,
              }),
              { status: 400, headers: corsHeaders },
            )
          }

          // Fetch the current version of the graph from history table
          const currentVersionQuery = `SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?`
          const currentVersionResult = await env.vegvisr_org
            .prepare(currentVersionQuery)
            .bind(id)
            .first()
          const currentVersion = currentVersionResult?.version || 0

          // For completely new graphs, we should start with version 1 regardless of metadata
          let newVersion
          if (!graphExists && currentVersion === 0) {
            // This is a brand new graph - start at version 1
            newVersion = 1
            console.log(`[Worker] New graph detected, starting at version 1 for ID: ${id}`)
          } else {
            // This is an existing graph - check for version mismatch only if override is false
            if (!override && graphData.metadata && graphData.metadata.version !== currentVersion) {
              return new Response(
                JSON.stringify({
                  error: 'Version mismatch. Please reload the latest version of the graph.',
                  currentVersion,
                }),
                { status: 409, headers: corsHeaders },
              )
            }
            // Increment the version for existing graphs
            newVersion = currentVersion + 1
          }
          if (!graphData.metadata) graphData.metadata = { title: null, description: null, createdBy: null }
          graphData.metadata.version = newVersion // Update the version in metadata

          // Ensure nodes include the bibl field
          const enrichedGraphData = {
            ...graphData,
            nodes: graphData.nodes.map((node) => ({
              ...node,
              bibl: Array.isArray(node.bibl) ? node.bibl : [], // Ensure bibl is included
              type: node.type || null, // Ensure type is included
              info: node.info || null, // Ensure info is included
              position: node.position || { x: 0, y: 0 }, // Ensure position is included
              imageWidth: node.imageWidth || null, // Include image-width
              imageHeight: node.imageHeight || null, // Include image-height
              visible: node.visible !== false, // Default to true if not set
              path: node.path || null, // Ensure path is included
            })),
            edges: graphData.edges.map(({ source, target }) => ({
              id: `${source}_${target}`, // Ensure edge ID is set
              source,
              target,
            })),
          }

          // FIRST: Check if graph exists in main table, then INSERT or UPDATE accordingly
          const checkExistingQuery = `SELECT id FROM knowledge_graphs WHERE id = ?`
          const existingGraph = await env.vegvisr_org.prepare(checkExistingQuery).bind(id).first()

          // Extract user_id and source_app from metadata for direct column storage
          const userId = enrichedGraphData.metadata.userId || null
          const sourceApp = enrichedGraphData.metadata.createdBy || null

          if (existingGraph) {
            // Update existing graph (preserve existing values for title/description/created_by if not provided)
            const updateGraphQuery = `
              UPDATE knowledge_graphs
              SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), created_by = COALESCE(?, created_by), updated_at = ?,
                  user_id = COALESCE(?, user_id), source_app = COALESCE(?, source_app)
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateGraphQuery)
              .bind(
                JSON.stringify(enrichedGraphData),
                enrichedGraphData.metadata.title || null,
                enrichedGraphData.metadata.description || null,
                enrichedGraphData.metadata.createdBy || null,
                new Date().toISOString(),
                userId,
                sourceApp,
                id,
              )
              .run()
            console.log(`[Worker] Updated existing graph: ${id}`)
          } else {
            // Insert new graph with user_id and source_app columns
            const insertGraphQuery = `
              INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at, user_id, source_app)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
            await env.vegvisr_org
              .prepare(insertGraphQuery)
              .bind(
                id,
                enrichedGraphData.metadata.title || '',
                enrichedGraphData.metadata.description || '',
                enrichedGraphData.metadata.createdBy || '',
                JSON.stringify(enrichedGraphData),
                new Date().toISOString(),
                new Date().toISOString(),
                userId,
                sourceApp,
              )
              .run()
            console.log(`[Worker] Created new graph: ${id} (user_id: ${userId}, source_app: ${sourceApp})`)
          }

          // SECOND: Insert the new version into the history table (now that parent exists)
          const insertHistoryQuery = `
            INSERT INTO knowledge_graph_history (id, graph_id, version, data, user_id, source_app)
            VALUES (?, ?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(insertHistoryQuery)
            .bind(crypto.randomUUID(), id, newVersion, JSON.stringify(enrichedGraphData), userId, sourceApp)
            .run()

          // THIRD: Ensure no more than 20 versions are stored
          const countHistoryQuery = `SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?`
          const historyCountResult = await env.vegvisr_org
            .prepare(countHistoryQuery)
            .bind(id)
            .first()

          if (historyCountResult?.count > 20) {
            const deleteOldestQuery = `
              DELETE FROM knowledge_graph_history
              WHERE graph_id = ?
              AND version = (
                SELECT MIN(version)
                FROM knowledge_graph_history
                WHERE graph_id = ?
              )
            `
            await env.vegvisr_org.prepare(deleteOldestQuery).bind(id, id).run()
            console.log(`[Worker] Deleted oldest version for graph ID: ${id}`)
          }

          console.log('[Worker] Graph with history saved successfully')

          // Auto-classify in the background (non-blocking)
          if (ctx && ctx.waitUntil) {
            ctx.waitUntil(classifyAndStore(env, id, enrichedGraphData))
          }

          return new Response(
            JSON.stringify({ message: 'Graph with history saved successfully', id, newVersion }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error processing /saveGraphWithHistory request:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // PATCH a single node's fields within a graph (without sending the entire graph)
      if (pathname === '/patchNode' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const { graphId, nodeId, fields, expectedVersion } = await request.json()

          if (!graphId || !nodeId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
            return new Response(
              JSON.stringify({ error: 'graphId, nodeId, fields (object), and expectedVersion (integer) are required.' }),
              { status: 400, headers: corsHeaders }
            )
          }

          console.log(`[Worker] patchNode: graph=${graphId} node=${nodeId} fields=${Object.keys(fields).join(',')}`)

          // 1. Read graph from D1
          const result = await env.vegvisr_org
            .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          if (!result) {
            return new Response(
              JSON.stringify({ error: 'Graph not found.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const graphData = JSON.parse(result.data)

          // 2. Find the node
          const nodeIndex = graphData.nodes.findIndex(n => n.id === nodeId)
          if (nodeIndex === -1) {
            return new Response(
              JSON.stringify({ error: `Node ${nodeId} not found in graph ${graphId}.` }),
              { status: 404, headers: corsHeaders }
            )
          }

          // 3. Encrypt data-node info before patching
          if (graphData.nodes[nodeIndex].type === 'data-node' && fields.info && env.ENCRYPTION_MASTER_KEY) {
            fields.info = await encryptDataNodeInfo(fields.info, env.ENCRYPTION_MASTER_KEY)
          }

          const currentVersion = Number(graphData.metadata?.version || 0)
          if (currentVersion !== expectedVersion) {
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Reload the graph and retry the patch.',
                currentVersion,
                expectedVersion,
              }),
              { status: 409, headers: corsHeaders }
            )
          }

          // 4. Patch only the specified fields (don't allow changing id)
          const { id: _ignoreId, ...safeFields } = fields
          Object.assign(graphData.nodes[nodeIndex], safeFields)

          // 5. Bump version
          const newVersion = currentVersion + 1
          if (!graphData.metadata) graphData.metadata = {}
          graphData.metadata.version = newVersion

          // 6. Write back to D1 with optimistic concurrency
          const now = new Date().toISOString()
          const updateResult = await env.vegvisr_org
            .prepare(`
              UPDATE knowledge_graphs
              SET data = ?, updated_at = ?
              WHERE id = ?
                AND COALESCE(CAST(json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.version') AS INTEGER), 0) = ?
            `)
            .bind(JSON.stringify(graphData), now, graphId, expectedVersion)
            .run()

          if (!updateResult.meta?.changes) {
            const latestGraph = await env.vegvisr_org
              .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
              .bind(graphId)
              .first()
            const latestData = latestGraph?.data ? JSON.parse(latestGraph.data) : null
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Graph was updated by another request.',
                currentVersion: Number(latestData?.metadata?.version || 0),
                expectedVersion,
              }),
              { status: 409, headers: corsHeaders }
            )
          }

          // 7. Save history
          await env.vegvisr_org
            .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
            .run()

          // 8. Trim history to 20 versions
          const countResult = await env.vegvisr_org
            .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          if (countResult?.count > 20) {
            await env.vegvisr_org
              .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)')
              .bind(graphId, graphId)
              .run()
          }

          console.log(`[Worker] patchNode: success, version ${currentVersion} → ${newVersion}`)
          return new Response(
            JSON.stringify({ ok: true, graphId, nodeId, newVersion }),
            { status: 200, headers: corsHeaders }
          )
        } catch (error) {
          console.error('[Worker] Error processing /patchNode:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // PATCH graph-level metadata (without re-sending all nodes/edges)
      if (pathname === '/patchGraphMetadata' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const { graphId, fields, expectedVersion } = await request.json()

          if (!graphId || !fields || typeof fields !== 'object' || !Number.isInteger(expectedVersion)) {
            return new Response(
              JSON.stringify({ error: 'graphId, fields (object), and expectedVersion (integer) are required.' }),
              { status: 400, headers: corsHeaders }
            )
          }

          console.log(`[Worker] patchGraphMetadata: graph=${graphId} fields=${Object.keys(fields).join(',')}`)

          // 1. Read graph from D1
          const result = await env.vegvisr_org
            .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          if (!result) {
            return new Response(
              JSON.stringify({ error: 'Graph not found.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const graphData = JSON.parse(result.data)

          const currentVersion = Number(graphData.metadata?.version || 0)
          if (currentVersion !== expectedVersion) {
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Reload the graph and retry the patch.',
                currentVersion,
                expectedVersion,
              }),
              { status: 409, headers: corsHeaders }
            )
          }

          // 2. Merge metadata fields
          if (!graphData.metadata) graphData.metadata = {}
          Object.assign(graphData.metadata, fields)

          // 3. Bump version
          const newVersion = currentVersion + 1
          graphData.metadata.version = newVersion

          // 4. Write back to D1 (update title/description columns too if provided)
          const now = new Date().toISOString()
          const updateResult = await env.vegvisr_org
            .prepare(`
              UPDATE knowledge_graphs
              SET data = ?, title = COALESCE(?, title), description = COALESCE(?, description), updated_at = ?
              WHERE id = ?
                AND COALESCE(CAST(json_extract(CASE WHEN json_valid(data) THEN data ELSE '{}' END, '$.metadata.version') AS INTEGER), 0) = ?
            `)
            .bind(JSON.stringify(graphData), fields.title || null, fields.description || null, now, graphId, expectedVersion)
            .run()

          if (!updateResult.meta?.changes) {
            const latestGraph = await env.vegvisr_org
              .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
              .bind(graphId)
              .first()
            const latestData = latestGraph?.data ? JSON.parse(latestGraph.data) : null
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Graph was updated by another request.',
                currentVersion: Number(latestData?.metadata?.version || 0),
                expectedVersion,
              }),
              { status: 409, headers: corsHeaders }
            )
          }

          // 5. Save history
          await env.vegvisr_org
            .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
            .run()

          // 6. Trim history to 20 versions
          const countResult = await env.vegvisr_org
            .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          if (countResult?.count > 20) {
            await env.vegvisr_org
              .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)')
              .bind(graphId, graphId)
              .run()
          }

          console.log(`[Worker] patchGraphMetadata: success, version ${currentVersion} → ${newVersion}`)
          return new Response(
            JSON.stringify({ ok: true, graphId, newVersion, updatedFields: Object.keys(fields) }),
            { status: 200, headers: corsHeaders }
          )
        } catch (error) {
          console.error('[Worker] Error processing /patchGraphMetadata:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // ADD a new node to a graph (without sending the entire graph)
      if (pathname === '/addNode' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const { graphId, node } = await request.json()

          if (!graphId || !node || typeof node !== 'object' || !node.id) {
            return new Response(
              JSON.stringify({ error: 'graphId and node (with id) are required.' }),
              { status: 400, headers: corsHeaders }
            )
          }

          console.log(`[Worker] addNode: graph=${graphId} nodeId=${node.id}`)

          // 1. Read graph from D1
          const result = await env.vegvisr_org
            .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          if (!result) {
            return new Response(
              JSON.stringify({ error: 'Graph not found.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const graphData = JSON.parse(result.data)

          // 2. Check if node ID already exists
          const existingNode = graphData.nodes.find(n => n.id === node.id)
          if (existingNode) {
            return new Response(
              JSON.stringify({ error: `Node with id ${node.id} already exists in graph ${graphId}.` }),
              { status: 409, headers: corsHeaders }
            )
          }

          // 3. Encrypt data-node info before storing
          if (node.type === 'data-node' && node.info && env.ENCRYPTION_MASTER_KEY) {
            node.info = await encryptDataNodeInfo(node.info, env.ENCRYPTION_MASTER_KEY)
            if (!node.metadata) node.metadata = {}
            node.metadata.encrypted = true
          }

          // 4. Add the new node
          graphData.nodes.push(node)

          // 4. Bump version
          const currentVersionResult = await env.vegvisr_org
            .prepare('SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          const currentVersion = currentVersionResult?.version || 0
          const newVersion = currentVersion + 1
          if (!graphData.metadata) graphData.metadata = {}
          graphData.metadata.version = newVersion

          // 5. Write back to D1
          const now = new Date().toISOString()
          await env.vegvisr_org
            .prepare('UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify(graphData), now, graphId)
            .run()

          // 6. Save history
          await env.vegvisr_org
            .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
            .run()

          // 7. Trim history to 20 versions
          const countResult = await env.vegvisr_org
            .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          if (countResult?.count > 20) {
            await env.vegvisr_org
              .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)')
              .bind(graphId, graphId)
              .run()
          }

          console.log(`[Worker] addNode: success, version ${currentVersion} → ${newVersion}`)
          return new Response(
            JSON.stringify({ ok: true, graphId, nodeId: node.id, newVersion }),
            { status: 200, headers: corsHeaders }
          )
        } catch (error) {
          console.error('[Worker] Error processing /addNode:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // ADD a new edge to a graph (without sending the entire graph)
      if (pathname === '/addEdge' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const { graphId, edge } = await request.json()

          if (!graphId || !edge || typeof edge !== 'object' || !edge.source || !edge.target) {
            return new Response(
              JSON.stringify({ error: 'graphId and edge (with source and target) are required.' }),
              { status: 400, headers: corsHeaders }
            )
          }

          console.log(`[Worker] addEdge: graph=${graphId} source=${edge.source} target=${edge.target}`)

          const result = await env.vegvisr_org
            .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          if (!result) {
            return new Response(
              JSON.stringify({ error: 'Graph not found.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const graphData = JSON.parse(result.data)
          if (!Array.isArray(graphData.nodes)) graphData.nodes = []
          if (!Array.isArray(graphData.edges)) graphData.edges = []

          const sourceExists = graphData.nodes.some(n => n.id === edge.source)
          const targetExists = graphData.nodes.some(n => n.id === edge.target)
          if (!sourceExists || !targetExists) {
            return new Response(
              JSON.stringify({ error: 'Both edge.source and edge.target must reference existing nodes.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const edgeId = edge.id || `${edge.source}_${edge.target}`
          const duplicateById = graphData.edges.some(e => e.id === edgeId)
          const duplicateByPair = graphData.edges.some(e => e.source === edge.source && e.target === edge.target)
          if (duplicateById || duplicateByPair) {
            return new Response(
              JSON.stringify({ error: `Edge ${edgeId} already exists in graph ${graphId}.` }),
              { status: 409, headers: corsHeaders }
            )
          }

          graphData.edges.push({ ...edge, id: edgeId })

          const currentVersionResult = await env.vegvisr_org
            .prepare('SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          const currentVersion = currentVersionResult?.version || 0
          const newVersion = currentVersion + 1
          if (!graphData.metadata) graphData.metadata = {}
          graphData.metadata.version = newVersion

          const now = new Date().toISOString()
          await env.vegvisr_org
            .prepare('UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify(graphData), now, graphId)
            .run()

          await env.vegvisr_org
            .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
            .run()

          const countResult = await env.vegvisr_org
            .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          if (countResult?.count > 20) {
            await env.vegvisr_org
              .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)')
              .bind(graphId, graphId)
              .run()
          }

          console.log(`[Worker] addEdge: success, version ${currentVersion} → ${newVersion}`)
          return new Response(
            JSON.stringify({ ok: true, graphId, edgeId, newVersion }),
            { status: 200, headers: corsHeaders }
          )
        } catch (error) {
          console.error('[Worker] Error processing /addEdge:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      // REMOVE a node from a graph (without sending the entire graph)
      if (pathname === '/removeNode' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }
        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const { graphId, nodeId, removeEdges = true } = await request.json()

          if (!graphId || !nodeId) {
            return new Response(
              JSON.stringify({ error: 'graphId and nodeId are required.' }),
              { status: 400, headers: corsHeaders }
            )
          }

          console.log(`[Worker] removeNode: graph=${graphId} nodeId=${nodeId} removeEdges=${removeEdges}`)

          // 1. Read graph from D1
          const result = await env.vegvisr_org
            .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
            .bind(graphId)
            .first()

          if (!result) {
            return new Response(
              JSON.stringify({ error: 'Graph not found.' }),
              { status: 404, headers: corsHeaders }
            )
          }

          const graphData = JSON.parse(result.data)

          // 2. Find and remove the node
          const nodeIndex = graphData.nodes.findIndex(n => n.id === nodeId)
          if (nodeIndex === -1) {
            return new Response(
              JSON.stringify({ error: `Node ${nodeId} not found in graph ${graphId}.` }),
              { status: 404, headers: corsHeaders }
            )
          }

          graphData.nodes.splice(nodeIndex, 1)

          // 3. Optionally remove edges connected to this node
          if (removeEdges) {
            const originalEdgeCount = graphData.edges.length
            graphData.edges = graphData.edges.filter(edge =>
              edge.source !== nodeId && edge.target !== nodeId && edge.from !== nodeId && edge.to !== nodeId
            )
            const removedEdgeCount = originalEdgeCount - graphData.edges.length
            console.log(`[Worker] removeNode: removed ${removedEdgeCount} edges connected to ${nodeId}`)
          }

          // 4. Bump version
          const currentVersionResult = await env.vegvisr_org
            .prepare('SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          const currentVersion = currentVersionResult?.version || 0
          const newVersion = currentVersion + 1
          if (!graphData.metadata) graphData.metadata = {}
          graphData.metadata.version = newVersion

          // 5. Write back to D1
          const now = new Date().toISOString()
          await env.vegvisr_org
            .prepare('UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify(graphData), now, graphId)
            .run()

          // 6. Save history
          await env.vegvisr_org
            .prepare('INSERT INTO knowledge_graph_history (id, graph_id, version, data) VALUES (?, ?, ?, ?)')
            .bind(crypto.randomUUID(), graphId, newVersion, JSON.stringify(graphData))
            .run()

          // 7. Trim history to 20 versions
          const countResult = await env.vegvisr_org
            .prepare('SELECT COUNT(*) AS count FROM knowledge_graph_history WHERE graph_id = ?')
            .bind(graphId)
            .first()
          if (countResult?.count > 20) {
            await env.vegvisr_org
              .prepare('DELETE FROM knowledge_graph_history WHERE graph_id = ? AND version = (SELECT MIN(version) FROM knowledge_graph_history WHERE graph_id = ?)')
              .bind(graphId, graphId)
              .run()
          }

          console.log(`[Worker] removeNode: success, version ${currentVersion} → ${newVersion}`)
          return new Response(
            JSON.stringify({ ok: true, graphId, nodeId, newVersion }),
            { status: 200, headers: corsHeaders }
          )
        } catch (error) {
          console.error('[Worker] Error processing /removeNode:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders }
          )
        }
      }

      if (pathname === '/getknowgraphhistory' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('id')
          if (!graphId) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching history for graph ID: ${graphId}`)

          const query = `
            SELECT version, timestamp
            FROM knowledge_graph_history
            WHERE graph_id = ?
            ORDER BY version DESC
          `
          const results = await env.vegvisr_org.prepare(query).bind(graphId).all()

          if (!results || results.length === 0) {
            return new Response(
              JSON.stringify({ error: `No history found for the given graph ID: ${graphId}.` }),
              {
                status: 404,
                headers: corsHeaders,
              },
            )
          }

          console.log('[Worker] History fetched successfully')
          return new Response(JSON.stringify({ graphId, history: results }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph history:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // ── Edit Timeline: lightweight list of all edit timestamps ──────
      if (pathname === '/getEditTimeline' && request.method === 'GET') {
        try {
          const query = `
            SELECT graph_id, version, timestamp
            FROM knowledge_graph_history
            ORDER BY timestamp ASC
          `
          const { results } = await env.vegvisr_org.prepare(query).all()

          return new Response(JSON.stringify({ total: results.length, edits: results }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching edit timeline:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // ── Dynamic Taxonomy: get all classifications ──────────────────
      if (pathname === '/getTaxonomy' && request.method === 'GET') {
        try {
          const { results } = await env.vegvisr_org.prepare(
            `SELECT id,
                    json_extract(data, '$.metadata.semanticPrimary') as primary_cat,
                    json_extract(data, '$.metadata.semanticSecondary') as secondary_cats,
                    json_extract(data, '$.metadata.semanticConfidence') as confidence
             FROM knowledge_graphs
             WHERE json_extract(data, '$.metadata.semanticPrimary') IS NOT NULL`
          ).all()

          const taxonomy = {}
          for (const row of results) {
            let sec = []
            try { sec = JSON.parse(row.secondary_cats) || [] } catch(e) {}
            taxonomy[row.id] = {
              primary: row.primary_cat,
              secondary: sec,
              confidence: row.confidence || 0.7,
            }
          }

          return new Response(JSON.stringify({ total: Object.keys(taxonomy).length, taxonomy }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching taxonomy:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500, headers: corsHeaders,
          })
        }
      }

      // ── Classify a graph on demand ──────────────────────────────────
      if (pathname === '/classifyGraph' && request.method === 'POST') {
        try {
          const body = await request.json()
          const graphId = body.graphId || body.id
          if (!graphId) {
            return new Response(JSON.stringify({ error: 'graphId is required' }), {
              status: 400, headers: corsHeaders,
            })
          }

          // Fetch graph data
          const row = await env.vegvisr_org.prepare('SELECT data FROM knowledge_graphs WHERE id = ?').bind(graphId).first()
          if (!row) {
            return new Response(JSON.stringify({ error: 'Graph not found' }), {
              status: 404, headers: corsHeaders,
            })
          }

          const graphData = JSON.parse(row.data)
          const result = await classifyGraph(env, graphId, graphData)
          if (!result) {
            return new Response(JSON.stringify({ error: 'Classification failed' }), {
              status: 500, headers: corsHeaders,
            })
          }

          // Store the result
          await classifyAndStore(env, graphId, graphData)

          return new Response(JSON.stringify({ graphId, classification: result }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error classifying graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500, headers: corsHeaders,
          })
        }
      }

      // ── Bulk classify unclassified graphs (batched) ─────────────────
      if (pathname === '/classifyAll' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}))
          const batchSize = Math.min(body.limit || 10, 20) // max 20 per request

          const { results } = await env.vegvisr_org.prepare(
            `SELECT id, data FROM knowledge_graphs`
          ).all()

          let classified = 0, skipped = 0, failed = 0, remaining = 0
          for (const row of results) {
            try {
              const graphData = JSON.parse(row.data)
              if (graphData.metadata?.semanticPrimary) { skipped++; continue }
              if (classified >= batchSize) { remaining++; continue }
              await classifyAndStore(env, row.id, graphData)
              classified++
            } catch (e) { failed++ }
          }

          return new Response(JSON.stringify({ classified, skipped, failed, remaining, total: results.length }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error bulk classifying:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500, headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getknowgraphversion' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('id')
          const version = url.searchParams.get('version')

          if (!graphId || !version) {
            return new Response(JSON.stringify({ error: 'Graph ID and version are required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching version ${version} for graph ID: ${graphId}`)

          const query = `
            SELECT data
            FROM knowledge_graph_history
            WHERE graph_id = ? AND version = ?
          `
          const result = await env.vegvisr_org.prepare(query).bind(graphId, version).first()

          if (!result) {
            return new Response(
              JSON.stringify({
                error: `No data found for graph ID: ${graphId} and version: ${version}.`,
              }),
              { status: 404, headers: corsHeaders },
            )
          }

          const graphData = JSON.parse(result.data)
          graphData.nodes = graphData.nodes.map((node) => ({
            ...node,
            visible: node.visible !== false, // Ensure visible field is included
            imageWidth: node.imageWidth || null, // Ensure imageWidth is included
            imageHeight: node.imageHeight || null, // Ensure imageHeight is included
            path: node.path || null, // Ensure path is included
          }))
          graphData.edges = graphData.edges.map(({ source, target }) => ({
            id: `${source}_${target}`, // Ensure edge ID is set
            source,
            target,
          }))

          // Decrypt data-node info fields before returning
          if (env.ENCRYPTION_MASTER_KEY && graphData.nodes) {
            for (const node of graphData.nodes) {
              if (node.type === 'data-node' && node.metadata?.encrypted && node.info) {
                try {
                  node.info = await decryptDataNodeInfo(node.info, env.ENCRYPTION_MASTER_KEY)
                } catch (e) {
                  console.error('Failed to decrypt data-node:', node.id, e.message)
                  node.info = '[]'
                }
              }
            }
          }

          console.log(`[Worker] Version ${version} for graph ID: ${graphId} fetched successfully`)
          return new Response(JSON.stringify(graphData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph version:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/duplicateknowgraph' && request.method === 'POST') {
        // Validate API token for write operations
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }

        if (!hasScope(tokenValidation.scopes, 'graph:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const requestBody = await request.json()
          const { sourceId, newTitle, graphData: inlineGraphData } = requestBody

          let graphData = inlineGraphData

          // If sourceId is provided (OpenAPI spec usage), fetch the source graph from D1
          if (sourceId && !graphData) {
            const sourceRow = await env.vegvisr_org
              .prepare('SELECT data FROM knowledge_graphs WHERE id = ?')
              .bind(sourceId)
              .first()
            if (!sourceRow) {
              return new Response(
                JSON.stringify({ error: `Source graph '${sourceId}' not found.` }),
                { status: 404, headers: corsHeaders },
              )
            }
            graphData = JSON.parse(sourceRow.data)
            if (newTitle) {
              graphData = { ...graphData, metadata: { ...graphData.metadata, title: newTitle } }
            }
          }

          if (!graphData || !graphData.metadata || !graphData.nodes || !graphData.edges) {
            return new Response(
              JSON.stringify({
                error: 'Complete graph data with metadata, nodes, and edges is required. Or provide sourceId to duplicate an existing graph.',
              }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log('[Worker] Duplicating knowledge graph')
          console.log('[Worker] Original title:', graphData.metadata.title)
          console.log('[Worker] Number of nodes to duplicate:', graphData.nodes.length)
          console.log('[Worker] Number of edges to duplicate:', graphData.edges.length)

          // Generate new unique graph ID
          const newGraphId = crypto.randomUUID()

          // Prepare the graph data with version 1
          const duplicatedGraphData = {
            ...graphData,
            metadata: {
              ...graphData.metadata,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }

          console.log('[Worker] Generated new graph ID:', newGraphId)
          console.log('[Worker] New graph title:', duplicatedGraphData.metadata.title)

          if (!env.vegvisr_org || !env.vegvisr_org.prepare) {
            console.error('[Worker] vegvisr_org is not defined or improperly configured.')
            return new Response(
              JSON.stringify({ error: 'Database connection is not available.' }),
              { status: 500, headers: corsHeaders },
            )
          }

          // Step 1: Insert into main knowledge_graphs table
          const insertMainQuery = `
            INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(insertMainQuery)
            .bind(
              newGraphId,
              duplicatedGraphData.metadata.title,
              duplicatedGraphData.metadata.description,
              duplicatedGraphData.metadata.createdBy,
              JSON.stringify(duplicatedGraphData),
              new Date().toISOString(),
              new Date().toISOString(),
            )
            .run()

          console.log('[Worker] Main graph record created successfully')

          // Step 2: Insert into knowledge_graph_history table (version 1)
          const insertHistoryQuery = `
            INSERT INTO knowledge_graph_history (id, graph_id, version, data)
            VALUES (?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(insertHistoryQuery)
            .bind(
              crypto.randomUUID(), // History entry ID
              newGraphId, // Graph ID
              1, // Version 1
              JSON.stringify(duplicatedGraphData),
            )
            .run()

          console.log('[Worker] Graph history record created successfully')

          return new Response(
            JSON.stringify({
              success: true,
              id: newGraphId,
              message: 'Graph duplicated successfully',
              title: duplicatedGraphData.metadata.title,
              nodesCount: graphData.nodes.length,
              edgesCount: graphData.edges.length,
            }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error duplicating knowledge graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/updateTemplate' && request.method === 'POST') {
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(JSON.stringify({ error: tokenValidation.error }), { status: tokenValidation.status, headers: corsHeaders })
        }
        if (!hasScope(tokenValidation.scopes, 'template:write')) {
          return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: template:write' }), { status: 403, headers: corsHeaders })
        }
        try {
          const { id, name, node, edges, ai_instructions, category, userId, tool } = await request.json()
          if (!id) return new Response(JSON.stringify({ error: 'Template id is required.' }), { status: 400, headers: corsHeaders })

          const fields = []
          const bindings = []

          if (name !== undefined)            { fields.push('name = ?');            bindings.push(name) }
          if (node !== undefined)            { fields.push('nodes = ?');           bindings.push(JSON.stringify(node)) }
          if (edges !== undefined)           { fields.push('edges = ?');           bindings.push(JSON.stringify(edges)) }
          if (ai_instructions !== undefined) { fields.push('ai_instructions = ?'); bindings.push(ai_instructions) }
          if (category !== undefined)        { fields.push('category = ?');        bindings.push(category) }
          if (userId !== undefined)          { fields.push('userId = ?');          bindings.push(userId) }
          if (tool !== undefined)            { fields.push('tool = ?');            bindings.push(tool ? 1 : 0) }
          fields.push('updated_at = datetime(\'now\')')

          if (fields.length === 1) return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400, headers: corsHeaders })

          bindings.push(id)
          await env.vegvisr_org.prepare(
            `UPDATE graphTemplates SET ${fields.join(', ')} WHERE id = ?`
          ).bind(...bindings).run()

          console.log(`[Worker] Updated template: ${id}`)
          return new Response(JSON.stringify({ success: true, id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), { status: 500, headers: corsHeaders })
        }
      }

      if (pathname === '/addTemplate' && request.method === 'POST') {
        // Allow x-user-role: Superadmin (service binding from agent-worker) OR API token
        const _atUserRole = request.headers.get('x-user-role')
        if (_atUserRole !== 'Superadmin') {
          const tokenValidation = await validateAuth(request, env)
          if (!tokenValidation.valid) {
            return new Response(
              JSON.stringify({ error: tokenValidation.error }),
              { status: tokenValidation.status, headers: corsHeaders }
            )
          }

          if (!hasScope(tokenValidation.scopes, 'template:write')) {
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions. Required scope: template:write' }),
              { status: 403, headers: corsHeaders }
            )
          }
        }

        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions, category, userId, tool, standard_question } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding template: ${name} for user: ${userId || 'anonymous'}`)

          const templateId = crypto.randomUUID()
          const toolFlag = tool ? 1 : 0

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              userId,
              tool,
              standard_question
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(query)
            .bind(
              templateId,
              name,
              JSON.stringify([node]),
              JSON.stringify([]),
              ai_instructions || null,
              category || 'General',
              userId || null,
              toolFlag,
              standard_question || null,
            )
            .run()

          // If ai_instructions are provided, update the template with them
          if (ai_instructions) {
            const updateQuery = `
              UPDATE graphTemplates
              SET ai_instructions = ?
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateQuery)
              .bind(JSON.stringify(ai_instructions), templateId)
              .run()
          }

          console.log('[Worker] Template added successfully')
          return new Response(
            JSON.stringify({ message: 'Template added successfully', id: templateId, name }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error adding template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/deleteTemplate' && request.method === 'DELETE') {
        try {
          const requestBody = await request.json()
          const { templateId, userId } = requestBody

          if (!templateId) {
            return new Response(
              JSON.stringify({ error: 'Template ID is required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Deleting template: ${templateId} for user: ${userId || 'unknown'}`)

          // First, verify the template exists and belongs to the user
          const checkQuery = `SELECT userId FROM graphTemplates WHERE id = ?`
          const existingTemplate = await env.vegvisr_org.prepare(checkQuery).bind(templateId).first()

          if (!existingTemplate) {
            return new Response(
              JSON.stringify({ error: 'Template not found.' }),
              { status: 404, headers: corsHeaders },
            )
          }

          // Verify ownership (if userId is provided)
          if (userId && existingTemplate.userId !== userId) {
            return new Response(
              JSON.stringify({ error: 'You do not have permission to delete this template.' }),
              { status: 403, headers: corsHeaders },
            )
          }

          // Delete the template
          const deleteQuery = `DELETE FROM graphTemplates WHERE id = ?`
          await env.vegvisr_org.prepare(deleteQuery).bind(templateId).run()

          console.log('[Worker] Template deleted successfully')
          return new Response(
            JSON.stringify({ success: true, message: 'Template deleted successfully' }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error deleting template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getTemplates' && request.method === 'GET') {
        try {
          const _gtApiToken = request.headers.get('X-API-Token')
          const _gtUserRole = request.headers.get('x-user-role')
          const _gtOrigin = request.headers.get('Origin')
          const _gtTrusted = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']

          if (_gtApiToken && _gtApiToken !== 'null' && _gtApiToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (!tv.valid) {
              return new Response(JSON.stringify({ error: tv.error || 'Invalid API token' }), {
                status: tv.status || 401, headers: corsHeaders,
              })
            }
            if (!hasScope(tv.scopes, 'graph:read') && !hasScope(tv.scopes, 'all')) {
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:read' }), {
                status: 403, headers: corsHeaders,
              })
            }
          } else if (!_gtUserRole && !(_gtOrigin && _gtTrusted.includes(_gtOrigin))) {
            return new Response(JSON.stringify({ error: 'Authentication required. Provide X-API-Token with graph:read scope.' }), {
              status: 401, headers: corsHeaders,
            })
          }

          console.log('[Worker] Fetching list of graph templates')

          const query = `SELECT id, name, nodes, edges, category, userId, ai_instructions FROM graphTemplates`
          const results = await env.vegvisr_org.prepare(query).all()

          console.log('[Worker] Graph templates fetched successfully')
          return new Response(JSON.stringify(results), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching graph templates:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // Slideshow endpoint - generates HTML slideshow from fulltext node
      if (pathname === '/slideshow' && request.method === 'GET') {
        try {
          const urlParams = new URLSearchParams(url.search)
          const nodeId = urlParams.get('nodeId')
          const graphId = urlParams.get('graphId')
          const theme = urlParams.get('theme') || 'nibi'

          if (!nodeId || !graphId) {
            return new Response('Missing nodeId or graphId parameter', {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Generating slideshow for node ${nodeId} in graph ${graphId}`)

          // Fetch the graph data
          const graphQuery = `SELECT data FROM knowledge_graphs WHERE id = ?`
          const graphResult = await env.vegvisr_org.prepare(graphQuery).bind(graphId).first()

          if (!graphResult) {
            return new Response('Graph not found', {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphData = JSON.parse(graphResult.data)
          const targetNode = graphData.nodes.find((node) => node.id === nodeId)

          if (!targetNode) {
            return new Response('Node not found', {
              status: 404,
              headers: corsHeaders,
            })
          }

          if (targetNode.type !== 'fulltext' && targetNode.type !== 'slideshow') {
            return new Response('Node is not a fulltext or slideshow node', {
              status: 400,
              headers: corsHeaders,
            })
          }

          // Parse slideshow content from the fulltext node
          const slideshowData = parseSlideshowFromFulltext(targetNode.info)

          if (slideshowData.slides.length === 0) {
            return new Response('No slideshow content found in node', {
              status: 400,
              headers: corsHeaders,
            })
          }

          // Generate HTML slideshow
          const slideshowHtml = generateSlideshowHtml(slideshowData, theme, targetNode.label)

          return new Response(slideshowHtml, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          })
        } catch (error) {
          console.error('[Worker] Error generating slideshow:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/saveToGraphWorkNotes' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { graphId, note, name } = requestBody

          console.log('Saving work note:', { graphId, note, name }) // Debug log

          if (!graphId || !note || !name) {
            return new Response(
              JSON.stringify({ error: 'Graph ID, note, and name are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          const workNoteId = crypto.randomUUID() // Generate a unique ID for the work note

          const query = `
        INSERT INTO graphWorkNotes (id, graph_id, note, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `
          await env.vegvisr_org.prepare(query).bind(workNoteId, graphId, `${name}: ${note}`).run()

          console.log('Work note saved successfully') // Debug log
          return new Response(
            JSON.stringify({ message: 'Work note saved successfully', workNoteId }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('Error saving work note:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getGraphWorkNotes' && request.method === 'GET') {
        try {
          const graphId = url.searchParams.get('graphId')
          if (!graphId) {
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Fetching work notes for graph ID: ${graphId}`)

          const query = `
            SELECT id, note, created_at
            FROM graphWorkNotes
            WHERE graph_id = ?
            ORDER BY created_at DESC
          `
          const results = await env.vegvisr_org.prepare(query).bind(graphId).all()

          console.log('[Worker] Work notes fetched successfully')
          return new Response(
            JSON.stringify({
              success: true,
              meta: { graphId },
              results: results || [], // Ensure results is always an array
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error fetching work notes:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/insertWorkNoteIntoGraph' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { graphId, workNoteId } = requestBody

          if (!graphId || !workNoteId) {
            return new Response(
              JSON.stringify({ error: 'Graph ID and work note ID are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Inserting work note ID: ${workNoteId} into graph ID: ${graphId}`)

          const noteQuery = `
            SELECT note
            FROM graphWorkNotes
            WHERE id = ?
          `
          const noteResult = await env.vegvisr_org.prepare(noteQuery).bind(workNoteId).first()

          if (!noteResult) {
            return new Response(JSON.stringify({ error: 'Work note not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphQuery = `
            SELECT data
            FROM knowledge_graphs
            WHERE id = ?
          `
          const graphResult = await env.vegvisr_org.prepare(graphQuery).bind(graphId).first()

          if (!graphResult) {
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          const graphData = JSON.parse(graphResult.data)
          const newNode = {
            id: `workNote_${Date.now()}`,
            label: 'Work Note',
            color: '#f4e2d8',
            type: 'notes',
            info: noteResult.note,
          }
          graphData.nodes.push(newNode)

          const updateQuery = `
            UPDATE knowledge_graphs
            SET data = ?, updated_at = ?
            WHERE id = ?
          `
          await env.vegvisr_org
            .prepare(updateQuery)
            .bind(JSON.stringify(graphData), new Date().toISOString(), graphId)
            .run()

          console.log('[Worker] Work note inserted into graph successfully')
          return new Response(
            JSON.stringify({ message: 'Work note inserted into graph successfully', newNode }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error inserting work note into graph:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/generateText' && request.method === 'POST') {
        try {
          const workersai = createWorkersAI({ binding: env.AI })
          console.log('[Worker] Created workersai instance:', workersai)

          const requestBody = await request.json()
          const { prompt } = requestBody
          console.log('[Worker] Request body:', requestBody)
          console.log('[Worker] Prompt:', prompt)

          if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log('[Worker] Received prompt:', prompt)

          const result = await generateText({
            model: workersai('@cf/meta/llama-3.2-1b-instruct'),
            max_tokens: 5000,
            prompt,
          })
          if (
            !result ||
            !result.response ||
            !result.response.messages ||
            !result.response.messages[0].content[0].text
          ) {
            throw new Error('Invalid response from Workers AI')
          }
          const summary = result.response.messages[0].content[0].text.trim()
          console.log('[Worker] Generated text:', result)

          // const summary = result.choices[0].message.content.trim()

          return new Response(
            JSON.stringify({
              id: `fulltext_${Date.now()}`,
              label: 'Summary',
              type: 'fulltext',
              info: summary,
              color: '#f9f9f9',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error generating text:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/migrateTemplatesAddUUIDs' && request.method === 'POST') {
        try {
          // 1. Fetch all templates without an id or with empty/null id
          const selectQuery = `SELECT rowid FROM graphTemplates WHERE id IS NULL OR id = ''`
          const result = await env.vegvisr_org.prepare(selectQuery).all()
          const templates = result.results || result.rows || result || []

          if (!Array.isArray(templates) || templates.length === 0) {
            return new Response(JSON.stringify({ message: 'No templates need migration.' }), {
              status: 200,
              headers: corsHeaders,
            })
          }

          // 2. For each, generate a UUID and update the row
          for (const template of templates) {
            const newId = crypto.randomUUID()
            const updateQuery = `UPDATE graphTemplates SET id = ? WHERE rowid = ?`
            await env.vegvisr_org.prepare(updateQuery).bind(newId, template.rowid).run()
          }

          return new Response(
            JSON.stringify({ message: `Migrated ${templates.length} templates with new UUIDs.` }),
            { status: 200, headers: corsHeaders },
          )
        } catch (error) {
          console.error('[Worker] Error migrating template UUIDs:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/deleteTemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { id } = requestBody

          if (!id) {
            return new Response(JSON.stringify({ error: 'Template id is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          const query = `DELETE FROM graphTemplates WHERE id = ?`
          await env.vegvisr_org.prepare(query).bind(id).run()

          return new Response(JSON.stringify({ message: 'Template deleted successfully', id }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error deleting template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      // ── GET /getTrash — list trashed graphs ──────────────────────────────
      if (pathname === '/getTrash' && request.method === 'GET') {
        try {
          const _trashToken = request.headers.get('X-API-Token')
          const _trashRole  = request.headers.get('x-user-role')
          const _trashOrigin = request.headers.get('Origin')
          const _trashTrusted = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
          let trashAuth = false

          if (_trashToken && _trashToken !== 'null' && _trashToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (!tv.valid) return new Response(JSON.stringify({ error: tv.error }), { status: tv.status, headers: corsHeaders })
            if (!hasScope(tv.scopes, 'graph:delete') && !hasScope(tv.scopes, 'all'))
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:delete' }), { status: 403, headers: corsHeaders })
            trashAuth = true
          } else if (_trashRole || (_trashOrigin && _trashTrusted.includes(_trashOrigin))) {
            trashAuth = true
          }
          if (!trashAuth) return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers: corsHeaders })

          // Purge expired entries first
          await env.vegvisr_org.prepare(`DELETE FROM graph_trash WHERE expires_at < datetime('now')`).run()

          const rows = await env.vegvisr_org.prepare(
            `SELECT id, graph_id, title, deleted_by, deleted_at, expires_at FROM graph_trash ORDER BY deleted_at DESC`
          ).all()

          return new Response(JSON.stringify({ results: rows.results || [] }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Server error', details: err.message }), { status: 500, headers: corsHeaders })
        }
      }

      // ── POST /restoreGraph — restore from trash ───────────────────────────
      if (pathname === '/restoreGraph' && request.method === 'POST') {
        try {
          const _restToken = request.headers.get('X-API-Token')
          const _restRole  = request.headers.get('x-user-role')
          const _restOrigin = request.headers.get('Origin')
          const _restTrusted = ['https://www.vegvisr.org','https://vegvisr.org','https://hello.vegvisr.org','https://dashboard.vegvisr.org','https://mystmkra.io','https://www.mystmkra.io']
          let restAuth = false

          if (_restToken && _restToken !== 'null' && _restToken.trim() !== '') {
            const tv = await validateAuth(request, env)
            if (!tv.valid) return new Response(JSON.stringify({ error: tv.error }), { status: tv.status, headers: corsHeaders })
            if (!hasScope(tv.scopes, 'graph:write') && !hasScope(tv.scopes, 'all'))
              return new Response(JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:write' }), { status: 403, headers: corsHeaders })
            restAuth = true
          } else if (_restRole || (_restOrigin && _restTrusted.includes(_restOrigin))) {
            restAuth = true
          }
          if (!restAuth) return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401, headers: corsHeaders })

          const { trashId } = await request.json()
          if (!trashId) return new Response(JSON.stringify({ error: 'trashId is required.' }), { status: 400, headers: corsHeaders })

          const entry = await env.vegvisr_org.prepare(
            `SELECT * FROM graph_trash WHERE id = ? AND expires_at > datetime('now')`
          ).bind(trashId).first()

          if (!entry) return new Response(JSON.stringify({ error: 'Trash entry not found or expired.' }), { status: 404, headers: corsHeaders })

          // Restore graph
          await env.vegvisr_org.prepare(
            `INSERT OR REPLACE INTO knowledge_graphs (id, data) VALUES (?, ?)`
          ).bind(entry.graph_id, entry.graph_data).run()

          // Restore history
          if (entry.graph_history) {
            const history = JSON.parse(entry.graph_history)
            for (const h of history) {
              await env.vegvisr_org.prepare(
                `INSERT OR IGNORE INTO knowledge_graph_history (id, graph_id, version, timestamp, data, user_id, source_app) VALUES (?, ?, ?, ?, ?, ?, ?)`
              ).bind(h.id, h.graph_id, h.version, h.timestamp, h.data, h.user_id || null, h.source_app || null).run()
            }
          }

          // Remove from trash
          await env.vegvisr_org.prepare(`DELETE FROM graph_trash WHERE id = ?`).bind(trashId).run()

          console.log(`[Worker] Graph ${entry.graph_id} restored from trash`)
          return new Response(JSON.stringify({ success: true, graphId: entry.graph_id }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Server error', details: err.message }), { status: 500, headers: corsHeaders })
        }
      }

      if (pathname === '/deleteknowgraph' && request.method === 'POST') {
        // Validate API token for delete operations
        const tokenValidation = await validateAuth(request, env)
        if (!tokenValidation.valid) {
          return new Response(
            JSON.stringify({ error: tokenValidation.error }),
            { status: tokenValidation.status, headers: corsHeaders }
          )
        }

        if (!hasScope(tokenValidation.scopes, 'graph:delete')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions. Required scope: graph:delete' }),
            { status: 403, headers: corsHeaders }
          )
        }

        try {
          const requestBody = await request.json()
          const { id } = requestBody

          console.log('[Worker] Delete request received:', { id, requestBody })

          if (!id) {
            console.log('[Worker] Error: No ID provided in request')
            return new Response(JSON.stringify({ error: 'Graph ID is required.' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log(`[Worker] Deleting graph with ID: ${id}`)

          // First check if the graph exists and fetch its data for trash
          const checkQuery = `SELECT id, data FROM knowledge_graphs WHERE id = ?`
          console.log('[Worker] Checking if graph exists with query:', checkQuery)
          const graphExists = await env.vegvisr_org.prepare(checkQuery).bind(id).first()
          console.log('[Worker] Graph exists check result:', graphExists)

          if (!graphExists) {
            console.log('[Worker] Graph not found:', id)
            return new Response(JSON.stringify({ error: 'Graph not found.' }), {
              status: 404,
              headers: corsHeaders,
            })
          }

          // ── Copy to trash before deleting (30-day retention) ──────────────
          try {
            // Fetch all history entries for this graph
            const historyRows = await env.vegvisr_org
              .prepare(`SELECT * FROM knowledge_graph_history WHERE graph_id = ? ORDER BY version ASC`)
              .bind(id).all()
            const historyJson = JSON.stringify(historyRows.results || [])

            // Parse title from graph data
            let graphTitle = id
            try {
              const gd = JSON.parse(graphExists.data)
              graphTitle = gd.metadata?.title || gd.title || id
            } catch {}

            const trashId = `trash_${id}_${Date.now()}`
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            const deletedBy = tokenValidation.userId || 'unknown'

            await env.vegvisr_org.prepare(
              `INSERT INTO graph_trash (id, graph_id, title, graph_data, graph_history, deleted_by, deleted_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
            ).bind(trashId, id, graphTitle, graphExists.data, historyJson, deletedBy, expiresAt).run()

            console.log(`[Worker] Graph ${id} moved to trash (expires: ${expiresAt})`)

            // Purge any expired trash entries while we're here
            await env.vegvisr_org.prepare(
              `DELETE FROM graph_trash WHERE expires_at < datetime('now')`
            ).run()
          } catch (trashError) {
            console.error('[Worker] Failed to copy to trash:', trashError.message)
            // Continue with deletion even if trash copy fails
          }

          // Delete related records first (in correct order)
          try {
            // 0. Delete chat sessions via chat-history-worker service binding
            if (env.CHAT_HISTORY_WORKER) {
              try {
                console.log('[Worker] Deleting chat sessions for graph:', id)
                const chatDeleteResponse = await env.CHAT_HISTORY_WORKER.fetch(
                  `https://chat-history-worker/sessions-by-graph/${encodeURIComponent(id)}`,
                  { method: 'DELETE' }
                )
                if (chatDeleteResponse.ok) {
                  const chatResult = await chatDeleteResponse.json()
                  console.log('[Worker] Deleted chat sessions:', chatResult)
                } else {
                  console.log('[Worker] Chat session deletion returned:', chatDeleteResponse.status)
                }
              } catch (chatError) {
                console.error('[Worker] Failed to delete chat sessions:', chatError.message)
                // Continue with graph deletion even if chat cleanup fails
              }
            }

            // 1. Delete from graphWorkNotes table first (most dependent)
            console.log('[Worker] Deleting from graphWorkNotes table')
            const deleteWorkNotesQuery = `DELETE FROM graphWorkNotes WHERE graph_id = ?`
            await env.vegvisr_org.prepare(deleteWorkNotesQuery).bind(id).run()
            console.log('[Worker] Deleted from graphWorkNotes table')

            // 2. Delete from knowledge_graph_history table
            console.log('[Worker] Deleting from knowledge_graph_history table')
            const deleteHistoryQuery = `DELETE FROM knowledge_graph_history WHERE graph_id = ?`
            await env.vegvisr_org.prepare(deleteHistoryQuery).bind(id).run()
            console.log('[Worker] Deleted from knowledge_graph_history table')

            // 3. Finally delete from knowledge_graphs table
            console.log('[Worker] Deleting from knowledge_graphs table')
            const deleteGraphQuery = `DELETE FROM knowledge_graphs WHERE id = ?`
            await env.vegvisr_org.prepare(deleteGraphQuery).bind(id).run()
            console.log('[Worker] Deleted from knowledge_graphs table')

            console.log('[Worker] Graph and all related records deleted successfully')
            return new Response(JSON.stringify({ message: 'Graph deleted successfully', id }), {
              status: 200,
              headers: corsHeaders,
            })
          } catch (error) {
            console.error('[Worker] Error during deletion process:', error)
            console.error('[Worker] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name,
            })
            return new Response(
              JSON.stringify({
                error: 'Failed to delete graph and related records',
                details: error.message,
                type: error.name,
                stack: error.stack,
              }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }
        } catch (error) {
          console.error('[Worker] Unexpected error:', error)
        }
      }

      if (pathname === '/resetMetaAreas' && request.method === 'POST') {
        // Only allow Superadmin
        const userRole = request.headers.get('x-user-role') || ''
        if (userRole !== 'Superadmin') {
          return new Response(JSON.stringify({ error: 'Forbidden: Superadmin role required' }), {
            status: 403,
            headers: corsHeaders,
          })
        }
        try {
          // Fetch all graph IDs
          const query = `SELECT id, data FROM knowledge_graphs`
          const queryResult = await env.vegvisr_org.prepare(query).all()
          const results = queryResult.results || queryResult.rows || []
          let updated = 0
          let skipped = 0
          for (const row of results) {
            let graphData
            try {
              graphData = JSON.parse(row.data)
            } catch {
              console.log(`[Worker] Skipping graph ${row.id}: invalid JSON`)
              skipped++
              continue
            }
            if (
              graphData.metadata &&
              typeof graphData.metadata === 'object' &&
              graphData.metadata.metaArea !== ''
            ) {
              graphData.metadata.metaArea = ''
              // Update the graph
              const updateQuery = `UPDATE knowledge_graphs SET data = ?, updated_at = ? WHERE id = ?`
              await env.vegvisr_org
                .prepare(updateQuery)
                .bind(JSON.stringify(graphData), new Date().toISOString(), row.id)
                .run()
              updated++
            } else {
              skipped++
            }
          }
          return new Response(JSON.stringify({ success: true, updated, skipped }), {
            status: 200,
            headers: corsHeaders,
          })
        } catch (error) {
          console.error('[Worker] Error in /resetMetaAreas:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/getAITemplates' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of AI templates')

          // Check if database binding exists
          if (!env.vegvisr_org) {
            console.error('[Worker] Database binding not found')
            return new Response(JSON.stringify({ error: 'Database connection not configured' }), {
              status: 500,
              headers: corsHeaders,
            })
          }

          // NEW: Support optional gemini query parameter for filtering
          const geminiParam = url.searchParams.get('gemini')
          let whereClause = ''
          if (geminiParam !== null) {
            const geminiValue = geminiParam === '1' || geminiParam === 'true' ? 1 : 0
            whereClause = `WHERE gemini = ${geminiValue}`
            console.log('[Worker] Filtering templates by gemini:', geminiValue)
          }

          const query = `
            SELECT
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path,
              standard_question,
              gemini
            FROM graphTemplates
            ${whereClause}
          `
          console.log('[Worker] Executing query:', query)

          const results = await env.vegvisr_org.prepare(query).all()
          console.log('[Worker] Query results:', results)

          if (!results || !results.results) {
            console.error('[Worker] No results returned from database')
            return new Response(JSON.stringify({ results: [] }), {
              status: 200,
              headers: corsHeaders,
            })
          }

          // Process and enrich the templates with additional AI-specific information
          const enrichedTemplates = results.results.map((template) => ({
            id: template.id,
            name: template.name,
            type: template.name.toLowerCase().replace(/\s+/g, '_'),
            nodes: JSON.parse(template.nodes || '[]'),
            edges: JSON.parse(template.edges || '[]'),
            ai_instructions: template.ai_instructions || '',
            category: template.category || 'General',
            thumbnail_path: template.thumbnail_path || null,
            standard_question: template.standard_question || '',
            gemini: template.gemini || 0,
            cdn_url: `https://api.vegvisr.org/templates/${template.id}`,
          }))

          console.log('[Worker] AI templates fetched successfully:', enrichedTemplates.length)
          return new Response(JSON.stringify({ results: enrichedTemplates }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching AI templates:', error)
          return new Response(
            JSON.stringify({
              error: 'Server error',
              details: error.message,
              stack: error.stack,
            }),
            { status: 500, headers: corsHeaders },
          )
        }
      }

      if (pathname === '/getToolTemplates' && request.method === 'GET') {
        try {
          const userRole = request.headers.get('x-user-role') || ''
          if (userRole !== 'Superadmin' && userRole !== 'Admin') {
            return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
              status: 403,
              headers: corsHeaders,
            })
          }

          console.log('[Worker] Fetching list of tool-enabled templates')

          if (!env.vegvisr_org) {
            console.error('[Worker] Database binding not found')
            return new Response(JSON.stringify({ error: 'Database connection not configured' }), {
              status: 500,
              headers: corsHeaders,
            })
          }

          const query = `
            SELECT
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path,
              standard_question,
              tool
            FROM graphTemplates
            WHERE tool = 1
          `

          const results = await env.vegvisr_org.prepare(query).all()
          const templates = (results?.results || [])
            .map((template) => {
              let nodes = []
              let edges = []
              try {
                nodes = JSON.parse(template.nodes || '[]')
              } catch {
                nodes = []
              }
              try {
                edges = JSON.parse(template.edges || '[]')
              } catch {
                edges = []
              }

              let description = ''
              if (template.ai_instructions) {
                try {
                  const parsed = JSON.parse(template.ai_instructions)
                  description = parsed?.purpose || parsed?.usage || ''
                } catch {
                  description = template.ai_instructions
                }
              }

              return {
                id: template.id,
                name: template.name,
                nodeType: nodes[0]?.type || null,
                nodes,
                edges,
                ai_instructions: template.ai_instructions || '',
                category: template.category || 'General',
                thumbnail_path: template.thumbnail_path || null,
                standard_question: template.standard_question || '',
                description,
              }
            })
            .filter((template) => template.nodeType)

          console.log('[Worker] Tool templates fetched successfully:', templates.length)
          return new Response(JSON.stringify({ results: templates }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Worker] Error fetching tool templates:', error)
          return new Response(
            JSON.stringify({ error: 'Server error', details: error.message }),
            { status: 500, headers: corsHeaders },
          )
        }
      }

      if (pathname === '/addAITemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions, category, thumbnail_path, tool } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding AI template: ${name}`)

          const templateId = crypto.randomUUID()
          const toolFlag = tool ? 1 : 0

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path,
              tool
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(query)
            .bind(
              templateId,
              'AI Knowledge Node', // New name
              JSON.stringify([
                {
                  id: 'Node_Grok_Test',
                  label: 'https://api.vegvisr.org/groktest',
                  color: 'black',
                  type: 'action_test',
                  info: 'Ask a question about any topic to get an AI-generated response with references.',
                  bibl: [],
                  imageWidth: 250,
                  imageHeight: 250,
                  visible: true,
                },
              ]),
              JSON.stringify([]),
              ai_instructions ||
                "Generate a comprehensive response to the user's question. Include:\n1. A clear explanation of the topic\n2. Key concepts and their relationships\n3. Historical or cultural context if relevant\n4. 2-3 academic references in APA format\n\nKeep the response focused and well-structured, avoiding unnecessary jargon. The response should be informative while remaining accessible to a general audience.", // AI instructions
              category || 'General',
              thumbnail_path || null,
              toolFlag,
            )
            .run()

          // If ai_instructions are provided, update the template with them
          if (ai_instructions) {
            const updateQuery = `
              UPDATE graphTemplates
              SET ai_instructions = ?,
                  category = ?,
                  thumbnail_path = ?
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateQuery)
              .bind(
                JSON.stringify(ai_instructions),
                category || 'General',
                thumbnail_path || null,
                templateId,
              )
              .run()
          }

          console.log('[Worker] AI template added successfully')
          return new Response(
            JSON.stringify({
              message: 'AI template added successfully',
              id: templateId,
              name: 'AI Knowledge Node',
              category: category || 'General',
              thumbnail_path: thumbnail_path || null,
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] Error adding AI template:', error)
          return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
            status: 500,
            headers: corsHeaders,
          })
        }
      }

      if (pathname === '/validate-worker' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { code } = requestBody

          if (!code) {
            return new Response(JSON.stringify({ error: 'Code is required' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          // Basic validation checks
          const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            score: 100,
          }

          // Check for export default
          if (!code.includes('export default')) {
            validation.errors.push('Missing export default structure')
            validation.isValid = false
            validation.score -= 30
          }

          // Check for fetch function
          if (!code.includes('async fetch(request, env')) {
            validation.errors.push('Missing proper fetch function signature')
            validation.isValid = false
            validation.score -= 30
          }

          // Check for CORS handling
          if (!code.includes('Access-Control-Allow-Origin')) {
            validation.warnings.push('Missing CORS headers')
            validation.score -= 10
          }

          // Check for error handling
          if (!code.includes('try') || !code.includes('catch')) {
            validation.warnings.push('Missing error handling')
            validation.score -= 10
          }

          // Check for debug endpoint
          if (!code.includes('/debug')) {
            validation.warnings.push('Missing debug endpoint')
            validation.score -= 10
          }

          // Simple syntax checks
          const openBraces = (code.match(/{/g) || []).length
          const closeBraces = (code.match(/}/g) || []).length
          if (openBraces !== closeBraces) {
            validation.errors.push('Mismatched braces - syntax error likely')
            validation.isValid = false
            validation.score -= 40
          }

          validation.score = Math.max(0, validation.score)

          return new Response(
            JSON.stringify({
              success: true,
              validation,
              recommendations: validation.errors.concat(validation.warnings).map((msg) => ({
                type: validation.errors.includes(msg) ? 'error' : 'warning',
                message: msg,
                fix: 'Review the generated code and fix the identified issue',
              })),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error validating code:', error)
          return new Response(
            JSON.stringify({ error: 'Validation failed', details: error.message }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (pathname === '/analyze-worker-code' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { code } = requestBody

          if (!code) {
            return new Response(JSON.stringify({ error: 'Code is required for analysis' }), {
              status: 400,
              headers: corsHeaders,
            })
          }

          console.log('[Worker] Analyzing worker code with Cloudflare AI...')

          // Use Cloudflare Workers AI for code analysis
          const analysisPrompt = `Analyze this Cloudflare Worker code for issues, best practices, and improvements:

${code}

IMPORTANT: This code should use CLASSIC Cloudflare Worker syntax (addEventListener('fetch', ...)), NOT ESM (export default).

Provide a comprehensive analysis including:
1. Syntax errors or issues
2. Security concerns
3. Performance optimizations
4. Best practice violations
5. Specific code improvements
6. Overall code quality assessment

Focus on classic Cloudflare Workers patterns and requirements. Do NOT recommend ESM or export default syntax.`

          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert Cloudflare Workers developer and code analyst. Provide detailed, actionable feedback on worker code quality, security, and best practices.',
              },
              {
                role: 'user',
                content: analysisPrompt,
              },
            ],
            max_tokens: 2000,
            temperature: 0.3,
          })

          const analysisText = aiResponse.response || 'Analysis completed'

          // Parse analysis into structured format
          const analysis = {
            summary: analysisText.substring(0, 200) + '...',
            issues: extractIssues(analysisText),
            recommendations: extractRecommendations(analysisText),
            overall_score: calculateOverallScore(code, analysisText),
            deployment_ready:
              !analysisText.toLowerCase().includes('error') &&
              !analysisText.toLowerCase().includes('critical'),
          }

          // Generate improved code if issues found
          let improvedCode = code
          let hasImprovements = false

          if (analysis.issues.length > 0) {
            const improvementPrompt = `Fix the following issues in this Cloudflare Worker code:

Original Code:
${code}

Issues to fix:
${analysis.issues.map((issue) => `- ${issue.message}`).join('\n')}

CRITICAL: Generate the corrected code using CLASSIC Cloudflare Worker syntax (addEventListener('fetch', ...)).
DO NOT use ESM or export default syntax. Return ONLY the corrected JavaScript code in classic format.`

            try {
              const improvementResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are an expert Cloudflare Workers developer. Fix code issues and return clean, working JavaScript code.',
                  },
                  {
                    role: 'user',
                    content: improvementPrompt,
                  },
                ],
                max_tokens: 3000,
                temperature: 0.2,
              })

              improvedCode = improvementResponse.response || code

              // Reject improved code if it contains ESM syntax or import statements
              if (improvedCode.includes('export default') || improvedCode.includes('import ')) {
                console.warn('[Worker] AI generated ESM/import code - rejecting improvement')
                improvedCode = code
                hasImprovements = false
              } else if (!improvedCode.includes('addEventListener')) {
                console.warn(
                  '[Worker] AI generated non-classic worker code - rejecting improvement',
                )
                improvedCode = code
                hasImprovements = false
              } else {
                hasImprovements = improvedCode !== code && improvedCode.length > 50
              }
            } catch (improvementError) {
              console.warn('[Worker] Code improvement failed:', improvementError)
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              analysis,
              improved_code: improvedCode,
              has_improvements: hasImprovements,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        } catch (error) {
          console.error('[Worker] Error analyzing worker code:', error)
          return new Response(
            JSON.stringify({
              error: 'Code analysis failed',
              details: error.message,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (pathname === '/generate-share-summary' && request.method === 'POST') {
        try {
          console.log('[Worker] ========== GENERATING SHARE SUMMARY ==========')

          const requestBody = await request.json()
          const { graphData, graphMetadata } = requestBody

          console.log(
            '[Worker] Request data:',
            JSON.stringify({
              nodeCount: graphData?.nodes?.length || 0,
              edgeCount: graphData?.edges?.length || 0,
              hasMetadata: !!graphMetadata,
            }),
          )

          if (!graphData || !graphData.nodes) {
            console.log('[Worker] ERROR: Missing graph data')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Missing required parameter: graphData with nodes',
              }),
              {
                status: 400,
                headers: corsHeaders,
              },
            )
          }

          // Check if Cloudflare AI binding is available
          if (!env.AI) {
            console.error('[Worker] ERROR: AI binding not available')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'AI binding not configured',
              }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }

          // Extract content from graph nodes for analysis
          const nodeContents = graphData.nodes
            .filter((node) => node.visible !== false)
            .map((node) => {
              const parts = []
              if (node.label) parts.push(`Title: ${node.label}`)
              if (node.info) parts.push(`Content: ${node.info}`)
              return parts.join('\n')
            })
            .filter((content) => content.trim().length > 0)

          const graphTitle = graphMetadata?.title || 'Untitled Graph'
          const graphDescription = graphMetadata?.description || ''
          const categories = graphMetadata?.category || ''

          // Combine all content for language detection and summary generation
          const allContent = [graphTitle, graphDescription, categories, ...nodeContents]
            .join('\n')
            .trim()

          console.log('[Worker] Content length for analysis:', allContent.length)
          console.log('[Worker] Content preview:', allContent.substring(0, 200) + '...')

          try {
            // Generate engaging share summary using AI
            const aiPrompt = `You are a social media content creator. Analyze this knowledge graph content and create an engaging social media summary.

GRAPH CONTENT:
Title: ${graphTitle}
Description: ${graphDescription}
Categories: ${categories}
Nodes: ${graphData.nodes.length}
Edges: ${graphData.edges.length}

NODE CONTENTS:
${nodeContents.join('\n\n')}

CRITICAL REQUIREMENTS:
1. DETECT the primary language used in the content (Norwegian, English, etc.)
2. Write the ENTIRE response in that SAME language
3. Start with an engaging hook like "Look here! I think this might be interesting for you" (but in the detected language)
4. Create a compelling 2-3 sentence summary of what this knowledge graph is about
5. Make it sound personal and engaging for social media sharing
6. Keep it under 200 words
7. DO NOT translate - use the original language throughout

If content is in Norwegian, use Norwegian phrases like "Se her! Jeg tror dette kan være interessant for deg"
If content is in English, use "Look here! I think this might be interesting for you"

Return ONLY the social media summary text, no explanations or metadata.`

            console.log('[Worker] Sending prompt to AI for share summary generation')

            const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                {
                  role: 'user',
                  content: aiPrompt,
                },
              ],
              max_tokens: 512,
              temperature: 0.7,
            })

            console.log('[Worker] AI response:', JSON.stringify(aiResponse, null, 2))

            let summary = ''
            if (aiResponse && aiResponse.response) {
              summary = aiResponse.response.trim()
              console.log('[Worker] Generated summary length:', summary.length)
              console.log('[Worker] Generated summary:', summary)
            } else {
              throw new Error('AI did not return valid response')
            }

            // Fallback summary if AI fails
            if (!summary || summary.length < 10) {
              console.log('[Worker] AI summary too short, using fallback')
              // Simple language detection for fallback
              const isNorwegian =
                /\b(og|er|på|med|til|av|for|som|ikke|det|en|et|jeg|du|han|hun|vi|de)\b/gi.test(
                  allContent,
                )

              if (isNorwegian) {
                summary = `Se her! Jeg tror dette kan være interessant for deg. ${graphTitle ? `Dette er en kunnskapsgraf om "${graphTitle}"` : 'Dette er en interessant kunnskapsgraf'} med ${graphData.nodes.length} noder og ${graphData.edges.length} forbindelser. ${graphDescription || 'Den inneholder verdifull informasjon som kan være nyttig.'}`
              } else {
                summary = `Look here! I think this might be interesting for you. ${graphTitle ? `This is a knowledge graph about "${graphTitle}"` : 'This is an interesting knowledge graph'} with ${graphData.nodes.length} nodes and ${graphData.edges.length} connections. ${graphDescription || 'It contains valuable information that might be useful.'}`
              }
            }

            const response = {
              success: true,
              summary: summary,
              model: '@cf/meta/llama-3.1-8b-instruct',
              nodeCount: graphData.nodes.length,
              edgeCount: graphData.edges.length,
              timestamp: new Date().toISOString(),
            }

            console.log('[Worker] Sending share summary response')

            return new Response(JSON.stringify(response), {
              status: 200,
              headers: corsHeaders,
            })
          } catch (aiError) {
            console.error('[Worker] AI summary generation failed:', aiError)

            // Fallback summary generation
            const isNorwegian =
              /\b(og|er|på|med|til|av|for|som|ikke|det|en|et|jeg|du|han|hun|vi|de)\b/gi.test(
                allContent,
              )

            let fallbackSummary
            if (isNorwegian) {
              fallbackSummary = `Se her! Jeg tror dette kan være interessant for deg. ${graphTitle ? `Dette er en kunnskapsgraf om "${graphTitle}"` : 'Dette er en interessant kunnskapsgraf'} med ${graphData.nodes.length} noder og ${graphData.edges.length} forbindelser. ${graphDescription || 'Den inneholder verdifull informasjon som kan være nyttig.'}`
            } else {
              fallbackSummary = `Look here! I think this might be interesting for you. ${graphTitle ? `This is a knowledge graph about "${graphTitle}"` : 'This is an interesting knowledge graph'} with ${graphData.nodes.length} nodes and ${graphData.edges.length} connections. ${graphDescription || 'It contains valuable information that might be useful.'}`
            }

            return new Response(
              JSON.stringify({
                success: true,
                summary: fallbackSummary,
                model: 'fallback',
                nodeCount: graphData.nodes.length,
                edgeCount: graphData.edges.length,
                timestamp: new Date().toISOString(),
                note: 'Generated using fallback due to AI error',
              }),
              {
                status: 200,
                headers: corsHeaders,
              },
            )
          }
        } catch (error) {
          console.error('[Worker] CRITICAL ERROR in generate-share-summary:', error)
          console.error('[Worker] Error stack:', error.stack)

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Share summary generation failed',
              details: error.message,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (pathname === '/generate-youtube-script' && request.method === 'POST') {
        try {
          console.log('[Worker] ========== YOUTUBE SCRIPT GENERATION ==========')

          const requestBody = await request.json()
          const {
            markdown,
            youtubeUrl,
            aiProvider,
            language,
            scriptStyle,
            targetDuration,
            includeTimestamps,
            includeEngagement,
          } = requestBody

          console.log('[Worker] Request data:', JSON.stringify(requestBody, null, 2))
          console.log('[Worker] Language selected:', language || 'english')

          if (!markdown) {
            console.log('[Worker] ERROR: Missing markdown')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Missing required parameter: markdown',
              }),
              {
                status: 400,
                headers: corsHeaders,
              },
            )
          }

          // Check if Cloudflare AI binding is available
          if (!env.AI) {
            console.error('[Worker] ERROR: AI binding not available')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'AI binding not configured',
              }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }

          // Extract YouTube video ID from URL
          let videoId = ''
          if (youtubeUrl) {
            const urlMatch = youtubeUrl.match(
              /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            )
            videoId = urlMatch ? urlMatch[1] : ''
          }

          // Create language-specific prompt
          const isNorwegian = language === 'norwegian'
          const finalPrompt = isNorwegian
            ? `Du er en profesjonell YouTube-skaper og manusforfatter. Generer et omfattende, engasjerende YouTube-manus basert på følgende dokumentasjon:

DOKUMENTASJON:
${markdown}

VIDEOSTIL: ${scriptStyle || 'tutorial'}
MÅLVARIGHET: ${targetDuration || '5-10 minutter'}
YOUTUBE URL: ${youtubeUrl || 'Ikke oppgitt'}

KRAV:
1. **Huk (Første 15 sekunder)** - Fang oppmerksomhet umiddelbart
2. **Verdiløfte** - Fortell seerne hva de vil lære
3. **Strukturerte seksjoner** med klare overganger
4. **Engasjementselementer** - Abonner-påminnelser, kommentarer, liker
5. **Handling-til-handling** - Veilede seere til neste steg
6. **YouTube beste praksis** - Retensjonsfokusert skriving

${includeTimestamps ? 'INKLUDER TIDSSTEMPLER: Legg til [0:00], [1:30], etc. for YouTube-kapitler' : ''}
${includeEngagement ? 'INKLUDER ENGASJEMENT: Legg til abonner-oppfordringer, like-påminnelser, kommentarspørsmål' : ''}

FORMAT:
- Profesjonell, samtaleaktig tone
- Klare seksjonsoverskrifter
- Handlingsrettet innhold
- Seer-fokusert språk ("du vil lære", "la meg vise deg")
- Naturlige overganger mellom seksjoner

Generer et komplett, klart-til-bruk YouTube-manus som ville fungere godt for pedagogisk innhold om den dokumenterte funksjonen eller systemet. Skriv HELE manuset på norsk.`
            : `You are a professional YouTube creator and scriptwriter. Generate a comprehensive, engaging YouTube script based on the following documentation:

DOCUMENTATION:
${markdown}

VIDEO STYLE: ${scriptStyle || 'tutorial'}
TARGET DURATION: ${targetDuration || '5-10 minutes'}
YOUTUBE URL: ${youtubeUrl || 'Not provided'}

REQUIREMENTS:
1. **Hook (First 15 seconds)** - Grab attention immediately
2. **Value Promise** - Tell viewers what they'll learn
3. **Structured Sections** with clear transitions
4. **Engagement Elements** - Subscribe reminders, comments, likes
5. **Call-to-Actions** - Guide viewers to next steps
6. **YouTube Best Practices** - Retention-focused writing

${includeTimestamps ? 'INCLUDE TIMESTAMPS: Add [0:00], [1:30], etc. for YouTube chapters' : ''}
${includeEngagement ? 'INCLUDE ENGAGEMENT: Add subscribe prompts, like reminders, comment questions' : ''}

FORMAT:
- Professional, conversational tone
- Clear section headings
- Actionable content
- Viewer-focused language ("you'll learn", "let me show you")
- Natural transitions between sections

Generate a complete, ready-to-use YouTube script that would work well for educational content about the documented feature or system.`

          console.log('[Worker] Sending prompt to AI:', finalPrompt.substring(0, 200) + '...')

          const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              {
                role: 'system',
                content: isNorwegian
                  ? 'Du er en profesjonell YouTube-skaper og manusforfatter. Lag engasjerende, pedagogiske manus som holder seere interesserte og lærer dem noe.'
                  : 'You are a professional YouTube creator and scriptwriter. Create engaging, educational scripts that keep viewers watching and learning.',
              },
              {
                role: 'user',
                content: finalPrompt,
              },
            ],
            max_tokens: 2048,
            temperature: 0.7,
          })

          console.log('[Worker] AI response:', JSON.stringify(aiResponse, null, 2))

          let generatedScript = ''
          if (aiResponse && aiResponse.response) {
            generatedScript = aiResponse.response.trim()
            console.log('[Worker] Generated script length:', generatedScript.length)
          } else {
            throw new Error('AI did not return valid response')
          }

          return new Response(
            JSON.stringify({
              success: true,
              script: generatedScript,
              videoId: videoId,
              provider: 'dev-worker',
              language: language || 'english',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: corsHeaders,
            },
          )
        } catch (error) {
          console.error('[Worker] YouTube script generation error:', error)
          return new Response(
            JSON.stringify({
              success: false,
              error: `YouTube script generation failed: ${error.message}`,
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      if (pathname === '/generate-worker-ai' && request.method === 'POST') {
        try {
          console.log('[Worker] ========== CLEAN SLATE AI GENERATION ==========')

          const requestBody = await request.json()
          const { prompt, userPrompt, returnType = 'fulltext', graphContext } = requestBody

          console.log('[Worker] Request data:', JSON.stringify(requestBody, null, 2))

          if (!prompt && !userPrompt) {
            console.log('[Worker] ERROR: Missing prompt')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Missing required parameter: prompt or userPrompt',
              }),
              {
                status: 400,
                headers: corsHeaders,
              },
            )
          }

          // Check if Cloudflare AI binding is available
          if (!env.AI) {
            console.error('[Worker] ERROR: AI binding not available')
            return new Response(
              JSON.stringify({
                success: false,
                error: 'AI binding not configured',
              }),
              {
                status: 500,
                headers: corsHeaders,
              },
            )
          }

          let finalPrompt = userPrompt || prompt
          console.log('[Worker] Base prompt:', finalPrompt)

          // Add graph context if provided
          if (graphContext && graphContext.trim()) {
            finalPrompt = `Context from knowledge graph:\n${graphContext}\n\nUser request: ${finalPrompt}`
            console.log('[Worker] Added graph context, final prompt length:', finalPrompt.length)
          }

          // Generate worker code based on the actual prompt
          console.log('[Worker] Processing user prompt with AI...')

          let generatedCode = ''

          try {
            // Use Cloudflare Workers AI to generate code based on the prompt
            const aiPrompt = `You are a Cloudflare Worker code generator. Generate ONLY raw JavaScript code - no markdown, no code fences, no explanations.

${graphContext ? 'Use the provided knowledge graph context to inform your code generation when relevant.\n\n' : ''}User request: "${finalPrompt}"

Return raw JavaScript code without any formatting or explanations. Requirements:
- Triple backticks with javascript or plain backticks
- Any markdown formatting
- Explanations or comments
- Code block indicators

Requirements:
- Use addEventListener('fetch', event => { event.respondWith(handleRequest(event.request)) })
- Create an async function handleRequest(request)
- Include proper CORS headers
- Include OPTIONS handling
- Return JSON responses with proper Content-Type headers
- Keep the code simple and focused on the user's request

Return the complete worker code as plain JavaScript:`

            console.log('[Worker] Sending prompt to AI:', aiPrompt.substring(0, 200) + '...')

            const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                {
                  role: 'user',
                  content: aiPrompt,
                },
              ],
              max_tokens: 2048,
              temperature: 0.3,
            })

            console.log('[Worker] AI response:', JSON.stringify(aiResponse, null, 2))

            if (aiResponse && aiResponse.response) {
              generatedCode = aiResponse.response.trim()

              // Clean up any markdown formatting that might have slipped through
              generatedCode = generatedCode.replace(/```javascript\n?/g, '')
              generatedCode = generatedCode.replace(/```\n?/g, '')
              generatedCode = generatedCode.trim()

              console.log('[Worker] Generated code length:', generatedCode.length)
              console.log(
                '[Worker] Generated code preview:',
                generatedCode.substring(0, 200) + '...',
              )
            } else {
              throw new Error('AI did not return valid response')
            }

            // Validate that the generated code looks like a worker
            if (
              !generatedCode.includes('addEventListener') ||
              !generatedCode.includes('handleRequest')
            ) {
              throw new Error('Generated code does not appear to be a valid Cloudflare Worker')
            }
          } catch (aiError) {
            console.error('[Worker] AI generation failed:', aiError)
            console.log('[Worker] Falling back to template-based generation')

            // Fallback: Generate simple code based on prompt analysis
            generatedCode = generateSimpleWorkerFromPrompt(finalPrompt)
          }

          console.log('[Worker] Final generated code length:', generatedCode.length)
          console.log(
            '[Worker] Final generated code preview:',
            generatedCode.substring(0, 100) + '...',
          )

          // Handle different return types
          if (returnType === 'action') {
            // Return action_test node
            const response = {
              id: `action_${Date.now()}`,
              label: 'https://knowledge.vegvisr.org/generate-worker-ai',
              type: 'action_test',
              info: generatedCode,
              color: '#ffe6cc',
              model: '@cf/meta/llama-3.1-8b-instruct',
              prompt: finalPrompt,
            }

            return new Response(JSON.stringify(response), {
              status: 200,
              headers: corsHeaders,
            })
          } else if (returnType === 'both') {
            // Generate follow-up question using AI
            let followUpQuestion = 'What additional features would you like to add to this worker?'

            try {
              const followUpPrompt = `Based on this generated code, create ONE brief follow-up question that would help the user enhance or expand this Cloudflare Worker. Return ONLY the question, no explanations.

Generated code summary: Worker that handles "${finalPrompt}"

Question:`

              const followUpAI = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [
                  {
                    role: 'user',
                    content: followUpPrompt,
                  },
                ],
                max_tokens: 100,
                temperature: 0.7,
              })

              if (followUpAI && followUpAI.response) {
                followUpQuestion = followUpAI.response.trim()
              }
            } catch (error) {
              console.log('[Worker] Follow-up generation failed, using default')
            }

            // Return both fulltext and action nodes
            const response = {
              type: 'both',
              fulltext: {
                id: `fulltext_${Date.now()}`,
                label: 'Worker Code',
                type: 'fulltext',
                info: generatedCode,
                color: '#e8f4fd',
                model: '@cf/meta/llama-3.1-8b-instruct',
                prompt: finalPrompt,
              },
              action: {
                id: `action_${Date.now() + 1}`,
                label: 'https://knowledge.vegvisr.org/generate-worker-ai',
                type: 'action_test',
                info: followUpQuestion,
                color: '#ffe6cc',
              },
            }

            return new Response(JSON.stringify(response), {
              status: 200,
              headers: corsHeaders,
            })
          } else {
            // Default: return fulltext node
            const response = {
              id: `fulltext_${Date.now()}`,
              label: 'Worker Code',
              type: 'fulltext',
              info: generatedCode,
              color: '#e8f4fd',
              model: '@cf/meta/llama-3.1-8b-instruct',
              prompt: finalPrompt,
            }

            return new Response(JSON.stringify(response), {
              status: 200,
              headers: corsHeaders,
            })
          }
        } catch (error) {
          console.error('[Worker] CRITICAL ERROR in generate-worker-ai:', error)
          console.error('[Worker] Error stack:', error.stack)

          return new Response(
            JSON.stringify({
              success: false,
              error: 'AI generation failed',
              details: error.message,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 500,
              headers: corsHeaders,
            },
          )
        }
      }

      // GET/POST /getContract - Retrieve agent contracts with composition
      if (pathname === '/getContract') {
        if (request.method === 'GET') {
          const contractId = url.searchParams.get('id')
          const templateName = url.searchParams.get('templateName')

          if (!contractId && !templateName) {
            return new Response(JSON.stringify({ error: 'id or templateName query parameter required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          let contract = null
          if (contractId) {
            contract = await env.vegvisr_org.prepare(
              'SELECT * FROM agent_contracts WHERE id = ?1'
            ).bind(contractId).first()
          } else if (templateName) {
            contract = await env.vegvisr_org.prepare(
              'SELECT * FROM agent_contracts WHERE name = ?1'
            ).bind(templateName).first()
          }

          if (contract) {
            let contractJson = JSON.parse(contract.contract_json)

            // Resolve parent contract for composition
            if (contract.parent_contract_id) {
              const parent = await env.vegvisr_org.prepare(
                'SELECT contract_json FROM agent_contracts WHERE id = ?1'
              ).bind(contract.parent_contract_id).first()
              if (parent) {
                const parentJson = JSON.parse(parent.contract_json)
                contractJson = deepMergeContract(parentJson, contractJson)
              }
            }

            // Include template example if linked
            if (contract.template_id) {
              const template = await env.vegvisr_org.prepare(
                'SELECT name, nodes, ai_instructions FROM graphTemplates WHERE id = ?1'
              ).bind(contract.template_id).first()
              if (template) {
                contractJson._templateExample = {
                  name: template.name,
                  nodes: template.nodes ? JSON.parse(template.nodes) : null
                }
              }
            }

            return new Response(JSON.stringify({ success: true, contract: contractJson }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          // Fallback: check graphTemplates.ai_instructions
          if (templateName) {
            const template = await env.vegvisr_org.prepare(
              'SELECT name, nodes, ai_instructions FROM graphTemplates WHERE name = ?1'
            ).bind(templateName).first()
            if (template && template.ai_instructions) {
              let parsed
              try { parsed = JSON.parse(template.ai_instructions) } catch { parsed = { rawInstructions: template.ai_instructions } }
              return new Response(JSON.stringify({ success: true, contract: parsed, source: 'graphTemplates' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
          }

          return new Response(JSON.stringify({ error: 'Contract not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (request.method === 'POST') {
          const body = await request.json()
          const { contractId, overrides } = body

          if (!contractId) {
            return new Response(JSON.stringify({ error: 'contractId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const contract = await env.vegvisr_org.prepare(
            'SELECT * FROM agent_contracts WHERE id = ?1'
          ).bind(contractId).first()

          if (!contract) {
            return new Response(JSON.stringify({ error: 'Contract not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          let contractJson = JSON.parse(contract.contract_json)

          // Resolve parent
          if (contract.parent_contract_id) {
            const parent = await env.vegvisr_org.prepare(
              'SELECT contract_json FROM agent_contracts WHERE id = ?1'
            ).bind(contract.parent_contract_id).first()
            if (parent) {
              contractJson = deepMergeContract(JSON.parse(parent.contract_json), contractJson)
            }
          }

          // Apply user overrides
          if (overrides && typeof overrides === 'object') {
            contractJson = deepMergeContract(contractJson, overrides)
          }

          return new Response(JSON.stringify({ success: true, contract: contractJson }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Important: Always return a Response. Otherwise Cloudflare will throw a 1101
      // ("the Promise did not resolve to 'Response'") for any unhandled route.
      return new Response(JSON.stringify({ success: false, message: 'Not found.', pathname }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('[Worker] Error handling request:', error)
      return new Response(JSON.stringify({ error: 'Server error', details: error.message }), {
        status: 500,
        headers: corsHeaders,
      })
    }
  },
}

// Helper functions for code analysis
function extractIssues(analysisText) {
  const issues = []
  const lines = analysisText.split('\n')

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase()
    if (
      lowerLine.includes('error') ||
      lowerLine.includes('issue') ||
      lowerLine.includes('problem')
    ) {
      issues.push({
        type: lowerLine.includes('syntax')
          ? 'syntax'
          : lowerLine.includes('security')
            ? 'security'
            : 'general',
        message: line.trim(),
        severity: lowerLine.includes('critical')
          ? 'high'
          : lowerLine.includes('warning')
            ? 'medium'
            : 'low',
      })
    }
  })

  return issues.slice(0, 10) // Limit to 10 issues
}

function extractRecommendations(analysisText) {
  const recommendations = []
  const lines = analysisText.split('\n')

  lines.forEach((line) => {
    const lowerLine = line.toLowerCase()
    if (
      lowerLine.includes('recommend') ||
      lowerLine.includes('should') ||
      lowerLine.includes('consider')
    ) {
      recommendations.push({
        type: 'improvement',
        suggestion: line.trim(),
        priority: lowerLine.includes('important') ? 'high' : 'medium',
      })
    }
  })

  return recommendations.slice(0, 5) // Limit to 5 recommendations
}

function calculateOverallScore(code, analysisText) {
  let score = 50 // Base score

  // Reward classic worker patterns
  if (code.includes('addEventListener("fetch"') || code.includes("addEventListener('fetch'"))
    score += 20
  if (code.includes('event.respondWith')) score += 15
  if (code.includes('handleRequest')) score += 10
  if (code.includes('Access-Control-Allow-Origin')) score += 10
  if (code.includes('OPTIONS')) score += 5
  if (code.includes('try') && code.includes('catch')) score += 10

  // Heavily penalize ESM and import patterns
  if (code.includes('export default')) score -= 40 // ESM completely breaks deployment
  if (code.includes('export {')) score -= 40 // Named exports also break deployment
  if (code.includes('import ')) score -= 30 // Import statements not supported

  // Reward good practices
  if (code.includes('/debug')) score += 5
  if (code.includes('encodeURIComponent')) score += 5
  if (code.includes('new URL(')) score += 5

  // Deduct for issues mentioned in analysis
  const lowerAnalysis = analysisText.toLowerCase()
  if (lowerAnalysis.includes('syntax error')) score -= 30
  if (lowerAnalysis.includes('critical')) score -= 25
  if (lowerAnalysis.includes('security')) score -= 15
  if (lowerAnalysis.includes('error')) score -= 10

  return Math.max(0, Math.min(100, score))
}

// Fallback function to generate simple workers based on prompt analysis
function generateSimpleWorkerFromPrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase()

  // Generate specific response for "hei Tor Arne" case
  if (lowerPrompt.includes('hei') && lowerPrompt.includes('tor arne')) {
    return `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  const responseData = { "message": "hei Tor Arne" }

  return new Response(JSON.stringify(responseData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}`
  }

  // Default fallback for other prompts
  return `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  const responseData = { "message": "Hello from worker!" }

  return new Response(JSON.stringify(responseData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}`
}
