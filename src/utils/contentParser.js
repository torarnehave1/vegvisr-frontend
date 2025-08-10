/**
 * Shared content parsing utilities for GNewViewer and Slideshow
 * Extracted from GNewDefaultNode.vue to ensure consistency
 */

/**
 * Parse style string from element parameters
 * Handles CSS property parsing with quote removal and special cases
 */
export const parseStyleString = (style) => {
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

/**
 * Parse quote parameters to extract citation
 * Handles both 'Cited=value' and 'cited: value' formats
 */
export const parseQuoteParams = (style) => {
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

/**
 * Process SECTION elements with proper style and markdown handling
 * Matches the exact logic from GNewDefaultNode
 */
export const processSectionElements = (text, markdownProcessor) => {
  return text.replace(
    /\[SECTION\s*\|([^\]]*)\]([\s\S]*?)\[END\s+SECTION\]/gs,
    (match, style, content) => {
      const css = parseStyleString(style)
      // Process the content through markdown to handle markdown inside the section
      const processedContent = markdownProcessor(content.trim())
      return `<div class="section" style="${css}; padding: 15px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${processedContent}</div>`
    },
  )
}

/**
 * Process QUOTE elements with proper citation and markdown handling
 * Matches the exact logic from GNewDefaultNode
 */
export const processQuoteElements = (text, markdownProcessor) => {
  return text.replace(
    /\[QUOTE\s*\|([^\]]*)\]([\s\S]*?)\[END\s+QUOTE\]/gs,
    (match, style, content) => {
      const cited = parseQuoteParams(style)
      const processedContent = markdownProcessor(content.trim())
      return `<div class="fancy-quote">${processedContent}<cite>— ${cited}</cite></div>`
    },
  )
}
