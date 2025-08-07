import { createWorkersAI } from 'workers-ai-provider'
import { generateText } from 'ai'

/**
 * @typedef {Object} Env
 * @property {Ai} AI
 */

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

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, x-user-role, X-API-Token, Accept, Origin, Cache-Control',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }

    console.log(`[Worker] Incoming request: ${request.method} ${request.url}`)

    if (request.method === 'OPTIONS') {
      console.log('[Worker] Handling OPTIONS request')
      return new Response('', { status: 204, headers: corsHeaders })
    }

    try {
      const url = new URL(request.url)
      const { pathname } = url

      console.log(`[Worker] Request pathname: ${pathname}`)

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

      if (pathname === '/saveknowgraph' && request.method === 'POST') {
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

      if (pathname === '/getknowgraphs' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of knowledge graphs')

          // 1. Determine allowed meta areas based on KV store configuration
          const hostname =
            request.headers.get('x-original-hostname') || new URL(request.url).hostname
          console.log('[Worker] Request hostname:', hostname)

          let allowedMetaAreas = null

          // Check KV store for site configuration
          try {
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
          const query = `SELECT id, title, data, created_date, updated_at FROM knowledge_graphs`
          const results = await env.vegvisr_org.prepare(query).all()
          const allGraphs = results.results || results.rows || []
          console.log('[Worker] Total graphs fetched from database:', allGraphs.length)

          // 3. Filter by meta area if needed
          let filteredGraphs = allGraphs
          if (allowedMetaAreas) {
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

      if (pathname === '/getknowgraph' && request.method === 'GET') {
        try {
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

          // Fetch the current version of the graph
          const currentVersionQuery = `SELECT MAX(version) AS version FROM knowledge_graph_history WHERE graph_id = ?`
          const currentVersionResult = await env.vegvisr_org
            .prepare(currentVersionQuery)
            .bind(id)
            .first()
          const currentVersion = currentVersionResult?.version || 0

          // Check for version mismatch only if override is false
          if (!override && graphData.metadata.version !== currentVersion) {
            return new Response(
              JSON.stringify({
                error: 'Version mismatch. Please reload the latest version of the graph.',
                currentVersion,
              }),
              { status: 409, headers: corsHeaders },
            )
          }

          // Increment the version
          const newVersion = currentVersion + 1
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

          if (existingGraph) {
            // Update existing graph
            const updateGraphQuery = `
              UPDATE knowledge_graphs
              SET data = ?, title = ?, description = ?, created_by = ?, updated_at = ?
              WHERE id = ?
            `
            await env.vegvisr_org
              .prepare(updateGraphQuery)
              .bind(
                JSON.stringify(enrichedGraphData),
                enrichedGraphData.metadata.title,
                enrichedGraphData.metadata.description,
                enrichedGraphData.metadata.createdBy,
                new Date().toISOString(),
                id,
              )
              .run()
            console.log(`[Worker] Updated existing graph: ${id}`)
          } else {
            // Insert new graph
            const insertGraphQuery = `
              INSERT INTO knowledge_graphs (id, title, description, created_by, data, created_date, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `
            await env.vegvisr_org
              .prepare(insertGraphQuery)
              .bind(
                id,
                enrichedGraphData.metadata.title,
                enrichedGraphData.metadata.description,
                enrichedGraphData.metadata.createdBy,
                JSON.stringify(enrichedGraphData),
                new Date().toISOString(),
                new Date().toISOString(),
              )
              .run()
            console.log(`[Worker] Created new graph: ${id}`)
          }

          // SECOND: Insert the new version into the history table (now that parent exists)
          const insertHistoryQuery = `
            INSERT INTO knowledge_graph_history (id, graph_id, version, data)
            VALUES (?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(insertHistoryQuery)
            .bind(crypto.randomUUID(), id, newVersion, JSON.stringify(enrichedGraphData))
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
        try {
          const requestBody = await request.json()
          const { graphData } = requestBody

          if (!graphData || !graphData.metadata || !graphData.nodes || !graphData.edges) {
            return new Response(
              JSON.stringify({
                error: 'Complete graph data with metadata, nodes, and edges is required.',
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

      if (pathname === '/addTemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding template: ${name}`)

          const templateId = crypto.randomUUID()

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions
            )
            VALUES (?, ?, ?, ?, ?)
          `
          await env.vegvisr_org
            .prepare(query)
            .bind(
              templateId,
              name,
              JSON.stringify([node]),
              JSON.stringify([]),
              ai_instructions || null,
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

      if (pathname === '/getTemplates' && request.method === 'GET') {
        try {
          console.log('[Worker] Fetching list of graph templates')

          const query = `SELECT id, name, nodes, edges, category FROM graphTemplates`
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

      if (pathname === '/deleteknowgraph' && request.method === 'POST') {
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

          // First check if the graph exists
          const checkQuery = `SELECT id FROM knowledge_graphs WHERE id = ?`
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

          // Delete related records first (in correct order)
          try {
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

          const query = `
            SELECT
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path,
              standard_question
            FROM graphTemplates
          `
          console.log('[Worker] Executing query:', query)

          const results = await env.vegvisr_org.prepare(query).all()
          console.log('[Worker] Query results:', results)

          if (!results || !results.results) {
            console.error('[Worker] No results returned from database')
            return new Response(JSON.stringify({ error: 'No templates found' }), {
              status: 404,
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

      if (pathname === '/addAITemplate' && request.method === 'POST') {
        try {
          const requestBody = await request.json()
          const { name, node, ai_instructions, category, thumbnail_path } = requestBody

          if (!name || !node) {
            return new Response(
              JSON.stringify({ error: 'Template name and node data are required.' }),
              { status: 400, headers: corsHeaders },
            )
          }

          console.log(`[Worker] Adding AI template: ${name}`)

          const templateId = crypto.randomUUID()

          const query = `
            INSERT INTO graphTemplates (
              id,
              name,
              nodes,
              edges,
              ai_instructions,
              category,
              thumbnail_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
