/**
 * Extract Theme from Diarized Conversation
 *
 * This utility helps users extract specific themes/topics from conversations
 * and create dedicated knowledge graph nodes with Grok-enhanced analysis.
 */

/**
 * Search for theme-related content in aligned conversation segments
 *
 * @param {Array} alignedSegments - Speaker-aligned conversation segments
 * @param {string} theme - Theme/topic to search for (e.g., "perspective", "kjærlighet", "meditation")
 * @returns {Array} - Segments containing theme-related content
 */
export function findThemeSegments(alignedSegments, theme) {
  if (!alignedSegments || alignedSegments.length === 0 || !theme) {
    return []
  }

  // Create search terms (case insensitive, multiple forms)
  const searchTerms = [
    theme.toLowerCase(),
    theme.toLowerCase() + 'et', // Norwegian definite form
    theme.toLowerCase() + 'en', // Norwegian definite form
    theme.toLowerCase() + 's',  // Possessive/plural
  ]

  // Find segments containing the theme
  const themeSegments = alignedSegments.filter(segment => {
    const text = segment.text.toLowerCase()
    return searchTerms.some(term => text.includes(term))
  })

  return themeSegments
}

/**
 * Create a simple theme-focused node (local processing)
 *
 * @param {Array} themeSegments - Segments related to theme
 * @param {string} theme - Theme name
 * @param {string} fullTranscript - Complete transcript text
 * @returns {Object} - Theme node data
 */
export function createSimpleThemeNode(themeSegments, theme) {
  if (themeSegments.length === 0) {
    return null
  }

  // Build markdown content
  let content = `# Tema: ${theme}\n\n`
  content += `## Samtaleuttrekk (${themeSegments.length} segmenter)\n\n`

  themeSegments.forEach((segment) => {
    const minutes = Math.floor(segment.start / 60)
    const seconds = Math.floor(segment.start) % 60
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

    content += `### [${timeLabel}] ${segment.speakerLabel}\n\n`
    content += `${segment.text}\n\n`
    content += `---\n\n`
  })

  // Add statistics
  const totalDuration = themeSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0)
  const speakerCounts = {}
  themeSegments.forEach(seg => {
    speakerCounts[seg.speakerLabel] = (speakerCounts[seg.speakerLabel] || 0) + 1
  })

  content += `## Statistikk\n\n`
  content += `- **Antall segmenter**: ${themeSegments.length}\n`
  content += `- **Total varighet**: ${Math.floor(totalDuration)} sekunder\n`
  content += `- **Deltakere**: ${Object.entries(speakerCounts).map(([speaker, count]) => `${speaker} (${count})`).join(', ')}\n`

  return {
    id: `theme_${theme.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    label: `🎯 Tema: ${theme}`,
    color: '#fff3cd',
    type: 'fulltext',
    info: content,
    bibl: [],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null,
    metadata: {
      theme: theme,
      segmentCount: themeSegments.length,
      duration: totalDuration,
      extractedAt: new Date().toISOString()
    }
  }
}

/**
 * Prepare data for Grok-enhanced theme analysis
 *
 * @param {Array} themeSegments - Segments related to theme
 * @param {string} theme - Theme name
 * @param {string} fullTranscript - Complete transcript text
 * @param {string} language - Language ('norwegian' or 'original')
 * @returns {Object} - API request payload
 */
export function prepareThemeAnalysisRequest(themeSegments, theme, fullTranscript, language = 'norwegian') {
  // Extract just the theme-related text with timestamps
  const themeConversation = themeSegments.map(seg => {
    const minutes = Math.floor(seg.start / 60)
    const seconds = Math.floor(seg.start) % 60
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
    return `[${timeLabel}] ${seg.speakerLabel}: ${seg.text}`
  }).join('\n\n')

  return {
    theme: theme,
    themeConversation: themeConversation,
    fullTranscript: fullTranscript,
    segmentCount: themeSegments.length,
    language: language
  }
}

/**
 * Format Grok-enhanced theme analysis as knowledge graph node
 *
 * @param {Object} grokResponse - Response from Grok theme analysis API
 * @param {string} theme - Theme name
 * @returns {Object} - Knowledge graph node
 */
export function formatGrokThemeNode(grokResponse, theme) {
  if (!grokResponse || !grokResponse.analysis) {
    return null
  }

  return {
    id: `theme_grok_${theme.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    label: `🎯 ${grokResponse.title || `Tema: ${theme}`}`,
    color: '#d4edda',
    type: 'fulltext',
    info: grokResponse.analysis,
    bibl: grokResponse.references || [],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null,
    metadata: {
      theme: theme,
      modelUsed: 'grok-3-beta',
      analysisType: 'theme-extraction',
      createdAt: new Date().toISOString(),
      ...grokResponse.metadata
    }
  }
}
