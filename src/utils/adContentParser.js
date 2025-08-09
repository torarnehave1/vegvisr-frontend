/**
 * Ad Content Parser - Phase E1
 * Handles parsing and serialization of [FANCY] ad content with slide support
 */

/**
 * Parse [FANCY] attributes from a block like:
 * [FANCY | font-size: 3.5em; color: lightblue; background-image: url('...'); text-align: center]
 */
export function parseFancyAttributes(fancyBlock) {
  const match = fancyBlock.match(/\[FANCY\s*\|\s*([^\]]+)\]/i)
  if (!match) return {}

  const attrString = match[1]
  const attrs = {}

  // Split by semicolon, then by colon
  attrString.split(';').forEach((pair) => {
    const [key, value] = pair.split(':').map((s) => s.trim())
    if (key && value) {
      attrs[key] = value
    }
  })

  return attrs
}

/**
 * Extract background image URL from parsed attributes
 */
export function extractBackgroundImageUrl(attrs) {
  const bgImage = attrs['background-image']
  if (!bgImage) return null

  const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)
  return urlMatch ? urlMatch[1] : null
}

/**
 * Update background image URL in attributes object
 */
export function updateBackgroundImageUrl(attrs, newUrl) {
  if (newUrl) {
    attrs['background-image'] = `url('${newUrl}')`
  } else {
    delete attrs['background-image']
  }
  return attrs
}

/**
 * Serialize attributes back to [FANCY] format
 */
export function serializeFancyAttributes(attrs) {
  const attrString = Object.entries(attrs)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
  return `[FANCY | ${attrString}]`
}

/**
 * Parse content into slides, each containing a [FANCY] block
 */
export function parseAdSlides(content) {
  if (!content || typeof content !== 'string') return []

  // Split on lines containing only --- (with optional whitespace)
  const rawSlides = content
    .split(/\n\s*---\s*\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return rawSlides.map((slideContent, index) => {
    // Find [FANCY] block
    const fancyMatch = slideContent.match(/(\[FANCY\s*\|[^\]]+\])/i)
    if (!fancyMatch) {
      return {
        index,
        content: slideContent,
        hasFancy: false,
        attrs: {},
        backgroundImageUrl: null,
        body: slideContent,
      }
    }

    const fancyBlock = fancyMatch[1]
    const attrs = parseFancyAttributes(fancyBlock)
    const backgroundImageUrl = extractBackgroundImageUrl(attrs)

    // Extract body content (everything after [FANCY] and before [END FANCY])
    const bodyMatch = slideContent.match(/\[FANCY[^\]]+\](.*?)\[END FANCY\]/is)
    const body = bodyMatch ? bodyMatch[1].trim() : ''

    return {
      index,
      content: slideContent,
      hasFancy: true,
      fancyBlock,
      attrs,
      backgroundImageUrl,
      body,
    }
  })
}

/**
 * Update image URL in a specific slide
 */
export function updateSlideImageUrl(slide, newUrl) {
  if (!slide.hasFancy) return slide

  const updatedAttrs = updateBackgroundImageUrl({ ...slide.attrs }, newUrl)
  const newFancyBlock = serializeFancyAttributes(updatedAttrs)

  // Replace the [FANCY] block in the content
  const updatedContent = slide.content.replace(/\[FANCY\s*\|[^\]]+\]/i, newFancyBlock)

  return {
    ...slide,
    attrs: updatedAttrs,
    backgroundImageUrl: newUrl,
    fancyBlock: newFancyBlock,
    content: updatedContent,
  }
}

/**
 * Serialize slides back to content string
 */
export function serializeAdSlides(slides) {
  return slides.map((slide) => slide.content).join('\n---\n')
}

/**
 * Main utility: parse content, update image for specific slide, serialize back
 */
export function replaceSlideImage(content, slideIndex, newImageUrl) {
  const slides = parseAdSlides(content)
  if (slideIndex < 0 || slideIndex >= slides.length) return content

  slides[slideIndex] = updateSlideImageUrl(slides[slideIndex], newImageUrl)
  return serializeAdSlides(slides)
}
