<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content document-update-modal">
      <button @click="close" class="close-button">&times;</button>
      <h3>📄 Update Graph from Document</h3>

      <!-- Step 1: Document Input -->
      <div v-if="currentStep === 'input'" class="step-content">
        <div class="current-graph-info">
          <h5>Current Graph: {{ currentGraphTitle }}</h5>
          <div class="graph-stats">
            <span class="badge bg-info">{{ currentNodes.length }} nodes</span>
          </div>
        </div>

        <div class="form-group">
          <label>Paste New Markdown Document:</label>
          <textarea
            v-model="newMarkdownDocument"
            class="form-control"
            rows="12"
            placeholder="Paste your updated markdown document here..."
            style="font-family: monospace"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button
            @click="analyzeDocument"
            class="btn btn-primary"
            :disabled="!newMarkdownDocument.trim()"
          >
            🔍 Analyze Document
          </button>
          <button @click="close" class="btn btn-secondary">Cancel</button>
        </div>
      </div>

      <!-- Step 2: Analysis Results -->
      <div v-if="currentStep === 'analysis'" class="step-content">
        <div class="analysis-results">
          <h5>📊 Document Analysis</h5>

          <div class="analysis-stats">
            <div class="stat-card">
              <strong>{{ newSections.length }}</strong>
              <span>New Sections</span>
            </div>
            <div class="stat-card">
              <strong>{{ matchingPairs.length }}</strong>
              <span>Matches Found</span>
            </div>
            <div class="stat-card">
              <strong>{{ preservedNodes.length }}</strong>
              <span>Nodes Preserved</span>
            </div>
          </div>

          <!-- Matching Results -->
          <div class="matching-results">
            <h6>🔄 Content Matching:</h6>
            <div v-for="pair in matchingPairs" :key="pair.existingNode.id" class="match-item">
              <div class="match-header">
                <span class="existing-label">{{ pair.existingNode.label }}</span>
                <span class="match-arrow">→</span>
                <span class="new-label">{{ pair.newSection.title }}</span>
                <span class="match-confidence badge bg-success"
                  >{{ Math.round(pair.confidence * 100) }}%</span
                >
              </div>
              <div class="content-preview">
                <small>{{ pair.newSection.content.substring(0, 150) }}...</small>
              </div>
            </div>
          </div>

          <!-- Preserved Nodes -->
          <div v-if="preservedNodes.length > 0" class="preserved-nodes">
            <h6>🛡️ Nodes to Preserve (not in new document):</h6>
            <div class="preserved-list">
              <span v-for="node in preservedNodes" :key="node.id" class="badge bg-secondary me-1">
                {{ node.label }}
              </span>
            </div>
          </div>

          <!-- New Sections -->
          <div v-if="newUnmatchedSections.length > 0" class="new-sections">
            <h6>➕ New Sections to Add:</h6>
            <div class="new-list">
              <span
                v-for="section in newUnmatchedSections"
                :key="section.id"
                class="badge bg-primary me-1"
              >
                {{ section.title }}
              </span>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button @click="applyUpdates" class="btn btn-success">
            ✅ Apply Updates (New Version)
          </button>
          <button @click="currentStep = 'input'" class="btn btn-outline-secondary">
            ← Back to Edit
          </button>
          <button @click="close" class="btn btn-secondary">Cancel</button>
        </div>
      </div>

      <!-- Step 3: Processing -->
      <div v-if="currentStep === 'processing'" class="step-content">
        <div class="processing-status">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <h5>{{ processingMessage }}</h5>
          <p>Creating new version with preserved formatting...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  currentGraphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [], metadata: {} }),
  },
})

const emit = defineEmits(['close', 'graph-updated'])

// Stores
const knowledgeGraphStore = useKnowledgeGraphStore()
const userStore = useUserStore()

// State
const currentStep = ref('input')
const newMarkdownDocument = ref('')
const newSections = ref([])
const matchingPairs = ref([])
const preservedNodes = ref([])
const newUnmatchedSections = ref([])
const processingMessage = ref('')

// Computed
// IMPORTANT: Don't use props.currentGraphData - it might be stale from store cache
// Always fetch fresh data from API to get latest metadata from portfolio updates
const currentNodes = ref([])
const currentGraphMetadata = ref({})
const currentGraphTitle = computed(() => currentGraphMetadata.value?.title || 'Untitled Graph')

// Parse markdown document into sections
const parseMarkdownSections = (markdown) => {
  console.log('=== INTELLIGENT MARKDOWN PARSING ===')
  console.log('Document length:', markdown.length)

  const sections = []
  const lines = markdown.split('\n')
  let currentSection = null
  let sectionId = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Only detect MAJOR headers (# and ## - ignore ### and below for section boundaries)
    const majorHeaderMatch = line.match(/^(#{1,2})\s+(.+)/)
    if (majorHeaderMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentSection.content.trim()
        currentSection.meaningfulLength = currentSection.content.replace(/\s+/g, ' ').length
        sections.push(currentSection)
      }

      // Start new section
      const headerLevel = majorHeaderMatch[1].length
      const title = majorHeaderMatch[2].trim()

      currentSection = {
        id: `section_${sectionId++}`,
        title: title,
        headerLevel: headerLevel,
        content: '',
        startLine: i,
        rawHeader: line,
        isMajorSection: true,
      }
    } else if (currentSection) {
      // Add ALL content to current section (including ### subheaders)
      currentSection.content += line + '\n'
    } else if (line.length > 20) {
      // Substantial content before any headers - create intro section
      if (!sections.find((s) => s.title === 'Document Introduction')) {
        currentSection = {
          id: `section_${sectionId++}`,
          title: 'Document Introduction',
          headerLevel: 1,
          content: line + '\n',
          startLine: i,
          rawHeader: '# Document Introduction',
          isMajorSection: true,
        }
      }
    }
  }

  // Add final section
  if (currentSection) {
    currentSection.content = currentSection.content.trim()
    currentSection.meaningfulLength = currentSection.content.replace(/\s+/g, ' ').length
    sections.push(currentSection)
  }

  // Filter out very small sections (less than 200 characters of meaningful content)
  const meaningfulSections = sections.filter(
    (section) => section.meaningfulLength > 200 || section.headerLevel === 1,
  )

  console.log('=== INTELLIGENT PARSING RESULTS ===')
  console.log(`Raw sections found: ${sections.length}`)
  console.log(`Meaningful major sections: ${meaningfulSections.length}`)
  console.log(`Section breakdown:`)
  meaningfulSections.forEach((section) => {
    const preview = section.content.replace(/\n/g, ' ').substring(0, 60) + '...'
    console.log(`  ${'#'.repeat(section.headerLevel)} ${section.title}`)
    console.log(`     Length: ${section.meaningfulLength} chars | Preview: ${preview}`)
  })
  console.log('===================================')

  return meaningfulSections
}

// Calculate content similarity between strings
const calculateSimilarity = (text1, text2) => {
  const words1 = text1
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
  const words2 = text2
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)

  const intersection = words1.filter((word) => words2.includes(word))
  const union = [...new Set([...words1, ...words2])]

  return union.length > 0 ? intersection.length / union.length : 0
}

// Match existing nodes with new sections using intelligent type-aware analysis
const matchContent = (existingNodes, newSections) => {
  console.log('=== INTELLIGENT CONTENT MATCHING ===')
  console.log('Existing nodes:', existingNodes.length)
  console.log('New sections:', newSections.length)

  // Analyze existing nodes by type
  existingNodes.forEach((node) => {
    const isBibliography = /bibliography|reference|citation/i.test(node.info || '')
    console.log(
      `Node: "${node.label}" | Type: ${node.type} | Has formatting: ${hasSpecialFormatting(node.info)} | Is bibliography: ${isBibliography}`,
    )
  })

  const matches = []
  const usedNodeIds = new Set()
  const usedSectionIds = new Set()

  // Step 1: Exclude non-text nodes from matching (preserve as-is)
  const textNodes = existingNodes.filter((node) => isTextBasedNode(node))
  const preservedNodes = existingNodes.filter((node) => !isTextBasedNode(node))

  console.log(`Text-based nodes for matching: ${textNodes.length}`)
  console.log(`Non-text nodes (auto-preserved): ${preservedNodes.length}`)

  // Step 2: Smart matching for architecture-related content
  for (const node of textNodes) {
    if (usedNodeIds.has(node.id)) continue

    let bestMatch = null
    let bestScore = 0
    let matchReason = ''

    for (const section of newSections) {
      if (usedSectionIds.has(section.id)) continue

      // Enhanced scoring system
      let score = 0
      let reasons = []

      // 1. Architecture content detection
      if (isArchitectureContent(node.info) && isArchitectureContent(section.content)) {
        score += 0.4
        reasons.push('architecture-content')
      }

      // 2. Title similarity (weighted higher for exact matches)
      const titleSim = calculateSimilarity(node.label || '', section.title)
      if (titleSim > 0.9) {
        score += 0.4
        reasons.push(`exact-title(${Math.round(titleSim * 100)}%)`)
      } else if (titleSim > 0.5) {
        score += titleSim * 0.3
        reasons.push(`title-sim(${Math.round(titleSim * 100)}%)`)
      }

      // 3. Content similarity (but consider existing formatting)
      const contentSim = calculateContentSimilarity(node.info || '', section.content)
      score += contentSim * 0.3
      if (contentSim > 0.2) {
        reasons.push(`content-sim(${Math.round(contentSim * 100)}%)`)
      }

      // 4. Boost for comprehensive document updates
      if (isComprehensiveUpdate(section.content)) {
        score += 0.1
        reasons.push('comprehensive-update')
      }

      // 5. Strong penalty for very different content types (like bibliography vs architecture)
      if (isDifferentContentType(node.info, section.content)) {
        score -= 0.5 // Increased penalty to prevent wrong matches
        reasons.push('content-type-penalty')
      }

      // 6. Special handling for bibliography content - should rarely match
      if (/bibliography|reference|citation/i.test(node.info || '')) {
        score -= 0.3 // Additional penalty for bibliography nodes
        reasons.push('bibliography-content-penalty')
      }

      if (score > bestScore && score > 0.4) {
        bestMatch = {
          existingNode: node,
          newSection: section,
          confidence: Math.min(score, 1.0),
          matchType: 'intelligent',
          reasons: reasons,
        }
        bestScore = score
        matchReason = reasons.join(', ')
      }
    }

    if (bestMatch) {
      matches.push(bestMatch)
      usedNodeIds.add(node.id)
      usedSectionIds.add(bestMatch.newSection.id)
      console.log(
        `Smart match: "${node.label}" → "${bestMatch.newSection.title}" (${Math.round(bestMatch.confidence * 100)}%) [${matchReason}]`,
      )
    }
  }

  // Combine preserved nodes with unmatched text nodes
  const allUnmatchedNodes = [
    ...preservedNodes,
    ...textNodes.filter((node) => !usedNodeIds.has(node.id)),
  ]

  const unmatchedSections = newSections.filter((section) => !usedSectionIds.has(section.id))

  console.log('Smart matches found:', matches.length)
  console.log('Nodes preserved (all types):', allUnmatchedNodes.length)
  console.log('New sections to add:', unmatchedSections.length)

  // Debug: Show which nodes are being preserved
  console.log('=== PRESERVED NODES BREAKDOWN ===')
  allUnmatchedNodes.forEach((node) => {
    const isBibliography = /bibliography|reference|citation/i.test(node.info || '')
    const isTextBased = isTextBasedNode(node)
    console.log(
      `Preserved: "${node.label}" | Type: ${node.type} | Text-based: ${isTextBased} | Bibliography: ${isBibliography}`,
    )
  })
  console.log('===================================')

  return { matches, unmatchedNodes: allUnmatchedNodes, unmatchedSections }
}

// Helper functions for intelligent matching
const isTextBasedNode = (node) => {
  const textTypes = ['fulltext', 'markdown', 'notes', 'info', 'worknote']
  return textTypes.includes(node.type) || (!node.type && node.info)
}

const hasSpecialFormatting = (content) => {
  if (!content) return false
  return /\[SECTION|\[FANCY|\[QUOTE|!\[Header|!\[Leftside|!\[Rightside/.test(content)
}

const isArchitectureContent = (content) => {
  if (!content) return false
  const archKeywords = [
    'architecture',
    'component',
    'frontend',
    'backend',
    'api',
    'worker',
    'vue',
    'cloudflare',
    'system',
  ]
  const lowerContent = content.toLowerCase()
  return archKeywords.some((keyword) => lowerContent.includes(keyword))
}

const calculateContentSimilarity = (text1, text2) => {
  // Extract meaningful content (skip formatting blocks)
  const cleanText1 = text1
    .replace(/\[SECTION[\s\S]*?\[END SECTION\]/g, '')
    .replace(/\[FANCY[\s\S]*?\[END FANCY\]/g, '')
  const cleanText2 = text2

  return calculateSimilarity(cleanText1, cleanText2)
}

// Extract clean content for precise similarity comparison
const extractCleanContent = (content) => {
  if (!content) return ''

  return (
    content
      // Remove all formatting blocks but keep their content
      .replace(/\[SECTION[^\]]*\]([\s\S]*?)\[END SECTION\]/g, '$1')
      .replace(/\[FANCY[^\]]*\]([\s\S]*?)\[END FANCY\]/g, '$1')
      .replace(/\[QUOTE[^\]]*\]([\s\S]*?)\[END QUOTE\]/g, '$1')
      // Remove image syntax but keep alt text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  )
}

const isComprehensiveUpdate = (content) => {
  return content.length > 2000 && content.split('#').length > 10
}

const isDifferentContentType = (existingContent, newContent) => {
  const existingIsBibliography = /bibliography|reference|citation/i.test(existingContent)
  const newIsBibliography = /bibliography|reference|citation/i.test(newContent)

  return existingIsBibliography !== newIsBibliography
}

// Intelligently preserve node formatting while updating content
const preserveNodeFormatting = (existingNode, newContent, newTitle) => {
  console.log('=== INTELLIGENT FORMATTING PRESERVATION ===')
  console.log('Node ID:', existingNode.id)
  console.log('Node type:', existingNode.type)
  console.log('Original title:', existingNode.label)
  console.log('New title:', newTitle)

  const originalInfo = existingNode.info || ''

  // CRITICAL: Check if content is essentially identical - preserve existing formatting
  const cleanExistingContent = extractCleanContent(originalInfo)
  const cleanNewContent = extractCleanContent(newContent)
  const contentSimilarity = calculateSimilarity(cleanExistingContent, cleanNewContent)

  console.log('Content similarity check:', {
    similarity: Math.round(contentSimilarity * 100) + '%',
    existingLength: cleanExistingContent.length,
    newLength: cleanNewContent.length,
    hasExistingFormatting: hasSpecialFormatting(originalInfo),
  })

  // If content is very similar (>85%) and existing has formatting, preserve the existing
  if (contentSimilarity > 0.85 && hasSpecialFormatting(originalInfo)) {
    console.log('🎯 PRESERVING EXISTING FORMATTING - Content is essentially identical')
    console.log('Keeping original formatted content instead of replacing with plain text')

    return {
      ...existingNode,
      label: newTitle, // Update title if needed
      info: originalInfo, // Keep the original formatted content
      // Explicitly preserve critical fields
      bibl: existingNode.bibl || [],
      imageWidth: existingNode.imageWidth || '100%',
      imageHeight: existingNode.imageHeight || '100%',
      visible: existingNode.visible !== false,
      path: existingNode.path || null,
      color: existingNode.color || '#f9f9f9',
      type: existingNode.type || 'fulltext',
    }
  }

  // Analyze existing content structure for cases where we need to merge
  const formattingAnalysis = analyzeFormattingStructure(originalInfo)
  console.log('Formatting analysis:', formattingAnalysis)

  // Extract various formatting elements
  const preservedElements = extractFormattingElements(originalInfo)

  // Build updated content with intelligent formatting preservation
  let updatedContent = buildUpdatedContent(newContent, preservedElements, formattingAnalysis)

  console.log('=== FORMATTING PRESERVATION SUMMARY ===')
  console.log(`Content similarity: ${Math.round(contentSimilarity * 100)}%`)
  console.log(`Action: ${contentSimilarity > 0.85 ? 'PRESERVED EXISTING' : 'MERGED FORMATTING'}`)
  console.log(`Header images preserved: ${preservedElements.headerImages.length}`)
  console.log(`SECTION blocks preserved: ${preservedElements.sections.length}`)
  console.log(`QUOTE blocks preserved: ${preservedElements.quotes.length}`)
  console.log(`FANCY blocks preserved: ${preservedElements.fancyBlocks.length}`)
  console.log(`Side images preserved: ${preservedElements.sideImages.length}`)
  console.log(`Custom elements preserved: ${preservedElements.customElements.length}`)
  console.log('Final content length:', updatedContent.length)
  console.log('=====================================')

  // Preserve ALL original node properties, especially bibl (bibliographic references)
  return {
    ...existingNode,
    label: newTitle,
    info: updatedContent,
    // Explicitly preserve critical fields that might be missing in spread
    bibl: existingNode.bibl || [],
    imageWidth: existingNode.imageWidth || '100%',
    imageHeight: existingNode.imageHeight || '100%',
    visible: existingNode.visible !== false,
    path: existingNode.path || null,
    color: existingNode.color || '#f9f9f9',
    type: existingNode.type || 'fulltext',
  }
}

// Analyze the structure and patterns of existing formatting
const analyzeFormattingStructure = (content) => {
  return {
    hasHeaderImage: /!\[Header[^\]]*\]\([^)]+\)/.test(content),
    hasSectionBlocks: /\[SECTION[^\]]*\]/.test(content),
    hasQuoteBlocks: /\[QUOTE[^\]]*\]/.test(content),
    hasFancyBlocks: /\[FANCY[^\]]*\]/.test(content),
    hasCustomMarkdown: /\[SECTION|\[QUOTE|\[FANCY/.test(content),
    contentStartsWithImage: content.trim().startsWith('![Header'),
    hasIntroSection: /introduction for the audience/i.test(content),
    hasDisclaimerSection: /disclaimer/i.test(content),
  }
}

// Extract all formatting elements from the original content
const extractFormattingElements = (content) => {
  return {
    // Header images (usually at the top)
    headerImages: content.match(/!\[Header[^\]]*\]\([^)]+\)/g) || [],

    // SECTION blocks with all their styling
    sections: content.match(/\[SECTION[^\]]*\][\s\S]*?\[END SECTION\]/g) || [],

    // QUOTE blocks with attribution
    quotes: content.match(/\[QUOTE[^\]]*\][\s\S]*?\[END QUOTE\]/g) || [],

    // FANCY blocks
    fancyBlocks: content.match(/\[FANCY[^\]]*\][\s\S]*?\[END FANCY\]/g) || [],

    // Side images (Leftside, Rightside)
    sideImages: content.match(/!\[(Leftside|Rightside)[^\]]*\]\([^)]+\)/g) || [],

    // Custom elements (HTML tables, etc.)
    customElements: content.match(/<table[\s\S]*?<\/table>/g) || [],

    // Metadata and author info
    authorInfo: content.match(/by\s+[^0-9\n]*\d{2}\s+\w+\s+\d{4}/g) || [],
  }
}

// Build the updated content with intelligent placement of preserved elements
const buildUpdatedContent = (newContent, preservedElements, analysis) => {
  let result = ''

  // 1. Start with header image if it exists
  if (preservedElements.headerImages.length > 0) {
    result += preservedElements.headerImages[0] + '\n\n'
  }

  // 2. Add author info if it exists (right after header)
  if (preservedElements.authorInfo.length > 0) {
    result += preservedElements.authorInfo[0] + '\n\n'
  }

  // 3. Add the new main content
  result += newContent

  // 4. Add preserved SECTION blocks (these are usually disclaimers or special notes)
  if (preservedElements.sections.length > 0) {
    result += '\n\n' + preservedElements.sections.join('\n\n')
  }

  // 5. Add preserved QUOTE blocks
  if (preservedElements.quotes.length > 0) {
    result += '\n\n' + preservedElements.quotes.join('\n\n')
  }

  // 6. Add any custom elements (like HTML tables)
  if (preservedElements.customElements.length > 0) {
    result += '\n\n' + preservedElements.customElements.join('\n\n')
  }

  // 7. Add side images strategically throughout content
  if (preservedElements.sideImages.length > 0) {
    // Insert side images at strategic points in the content
    const contentSections = result.split('\n## ')
    if (contentSections.length > 1) {
      // Insert side images between major sections
      for (
        let i = 0;
        i < Math.min(preservedElements.sideImages.length, contentSections.length - 1);
        i++
      ) {
        contentSections[i + 1] =
          preservedElements.sideImages[i] + '\n\n## ' + contentSections[i + 1]
      }
      result = contentSections.join('\n')
    }
  }

  return result
}

// Fetch fresh graph data from API (not from stale store cache)
const fetchFreshGraphData = async () => {
  console.log('=== FETCHING FRESH GRAPH DATA ===')
  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${knowledgeGraphStore.currentGraphId}`,
      {
        headers: {
          'X-API-Token': userStore.emailVerificationToken,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.status}`)
    }

    const graphData = await response.json()

    console.log('=== FRESH GRAPH DATA FROM API ===')
    console.log('Title:', graphData.metadata?.title)
    console.log('Description:', graphData.metadata?.description)
    console.log('Version:', graphData.metadata?.version)
    console.log('Meta Area:', graphData.metadata?.metaArea)
    console.log('Category:', graphData.metadata?.category)
    console.log('Updated At:', graphData.metadata?.updatedAt)
    console.log('Nodes count:', graphData.nodes?.length || 0)
    console.log('=== This should include latest portfolio updates ===')

    // Update our refs with fresh data
    currentNodes.value = graphData.nodes || []
    currentGraphMetadata.value = graphData.metadata || {}

    return graphData
  } catch (error) {
    console.error('Error fetching fresh graph data:', error)
    throw error
  }
}

// Analyze the document
const analyzeDocument = async () => {
  if (!newMarkdownDocument.value.trim()) {
    alert('Please enter a markdown document to analyze.')
    return
  }

  console.log('=== DOCUMENT ANALYSIS START ===')

  try {
    // First, fetch fresh graph data to ensure we have latest metadata
    await fetchFreshGraphData()

    newSections.value = parseMarkdownSections(newMarkdownDocument.value)

    const matchingResult = matchContent(currentNodes.value, newSections.value)

    matchingPairs.value = matchingResult.matches
    preservedNodes.value = matchingResult.unmatchedNodes
    newUnmatchedSections.value = matchingResult.unmatchedSections

    currentStep.value = 'analysis'

    console.log('=== ANALYSIS COMPLETE ===')
  } catch (error) {
    console.error('Error during analysis:', error)
    alert('Failed to fetch latest graph data: ' + error.message)
  }
}

// Apply the updates
const applyUpdates = async () => {
  currentStep.value = 'processing'
  processingMessage.value = 'Getting latest graph version...'

  try {
    console.log('=== APPLYING UPDATES ===')

    // First, fetch the latest version of the graph to avoid version mismatch
    console.log('Fetching latest graph version...')
    const latestGraphResponse = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${knowledgeGraphStore.currentGraphId}`,
      {
        headers: {
          'X-API-Token': userStore.emailVerificationToken,
        },
      },
    )

    if (!latestGraphResponse.ok) {
      throw new Error(`Failed to fetch latest graph: ${latestGraphResponse.status}`)
    }

    const latestGraphData = await latestGraphResponse.json()
    console.log('=== CURRENT GRAPH DATA (should include latest metadata) ===')
    console.log('Graph ID:', latestGraphData.id || knowledgeGraphStore.currentGraphId)
    console.log('Title:', latestGraphData.metadata?.title || 'No title')
    console.log('Description:', latestGraphData.metadata?.description || 'No description')
    console.log('Version:', latestGraphData.metadata?.version || 'unknown')
    console.log('Updated At:', latestGraphData.metadata?.updatedAt || 'unknown')
    console.log('Meta Area:', latestGraphData.metadata?.metaArea || 'No meta area')
    console.log('Category:', latestGraphData.metadata?.category || 'No category')
    console.log('Created By:', latestGraphData.metadata?.createdBy || 'unknown')
    console.log('Nodes count:', latestGraphData.nodes?.length || 0)
    console.log('=== This should match your portfolio updates ===')
    console.log('Full metadata object:', JSON.stringify(latestGraphData.metadata, null, 2))

    // Compare with props data to see if there's a mismatch
    console.log('=== METADATA COMPARISON ===')
    console.log('Props metadata:', JSON.stringify(props.currentGraphData?.metadata, null, 2))
    console.log('Fresh API metadata:', JSON.stringify(latestGraphData.metadata, null, 2))
    console.log(
      'Are they the same?',
      JSON.stringify(props.currentGraphData?.metadata) === JSON.stringify(latestGraphData.metadata),
    )
    console.log('=================================')

    processingMessage.value = 'Updating nodes with preserved formatting...'

    // Update matched nodes with preserved formatting using LATEST graph data
    const updatedNodes = [...(latestGraphData.nodes || [])]

    for (const pair of matchingPairs.value) {
      const nodeIndex = updatedNodes.findIndex((n) => n.id === pair.existingNode.id)
      if (nodeIndex !== -1) {
        updatedNodes[nodeIndex] = preserveNodeFormatting(
          pair.existingNode,
          pair.newSection.content,
          pair.newSection.title,
        )
        console.log(`Updated node: ${pair.existingNode.id}`)
      }
    }

    // Add new nodes from unmatched sections
    for (const section of newUnmatchedSections.value) {
      const newNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        label: section.title,
        info: section.content,
        type: 'fulltext',
        color: '#f9f9f9',
        visible: true,
        position: { x: 100 + updatedNodes.length * 150, y: 100 },
      }
      updatedNodes.push(newNode)
      console.log(`Added new node: ${newNode.id} - ${section.title}`)
    }

    // Preserved nodes are already in updatedNodes, no action needed
    console.log(`Preserved ${preservedNodes.value.length} nodes unchanged`)

    // Create updated graph data using the LATEST version
    const updatedGraphData = {
      ...latestGraphData,
      nodes: updatedNodes,
      metadata: {
        ...latestGraphData.metadata,
        updatedAt: new Date().toISOString(),
        lastDocumentUpdate: new Date().toISOString(),
      },
    }

    console.log('=== FINAL METADATA BEING SAVED ===')
    console.log('Original metadata:', JSON.stringify(latestGraphData.metadata, null, 2))
    console.log('Final metadata:', JSON.stringify(updatedGraphData.metadata, null, 2))
    console.log(
      'Metadata preserved correctly:',
      JSON.stringify(latestGraphData.metadata.category) ===
        JSON.stringify(updatedGraphData.metadata.category),
    )
    console.log('====================================')

    processingMessage.value = 'Saving new version to history...'

    // Save with history
    console.log('=== SAVING TO API ===')
    console.log('Graph ID:', knowledgeGraphStore.currentGraphId)
    console.log('User token:', userStore.emailVerificationToken ? 'Present' : 'Missing')
    console.log('Updated nodes count:', updatedNodes.length)
    console.log('Graph metadata:', updatedGraphData.metadata)

    const savePayload = {
      id: knowledgeGraphStore.currentGraphId,
      graphData: updatedGraphData,
      override: false, // Create new version
    }

    console.log('Payload size:', JSON.stringify(savePayload).length, 'bytes')

    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify(savePayload),
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error Response:', errorText)
      throw new Error(`API request failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Graph updated successfully:', result)

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    emit('graph-updated', {
      updatedNodes: matchingPairs.value.length,
      preservedNodes: preservedNodes.value.length,
      newNodes: newUnmatchedSections.value.length,
    })

    close()

    console.log('=== UPDATE COMPLETE ===')
  } catch (error) {
    console.error('=== UPDATE FAILED ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)

    // More specific error messages
    let userMessage = 'Failed to update graph. '
    if (error.message.includes('401')) {
      userMessage += 'Authentication error - please try logging out and back in.'
    } else if (error.message.includes('500')) {
      userMessage += 'Server error - please try again in a few minutes.'
    } else if (error.message.includes('fetch')) {
      userMessage += 'Network error - check your internet connection.'
    } else {
      userMessage += `Error: ${error.message}`
    }

    alert(userMessage)
    currentStep.value = 'analysis'
    processingMessage.value = ''
  }
}

// Close modal
const close = () => {
  currentStep.value = 'input'
  newMarkdownDocument.value = ''
  newSections.value = []
  matchingPairs.value = []
  preservedNodes.value = []
  newUnmatchedSections.value = []
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.document-update-modal {
  background: white;
  border-radius: 15px;
  padding: 2rem;
  max-height: 90vh;
  overflow-y: auto;
  width: 90%;
  max-width: 800px;
  position: relative;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1.5rem;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
}

.current-graph-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.graph-stats {
  margin-top: 0.5rem;
}

.analysis-stats {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}

.stat-card {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  flex: 1;
}

.stat-card strong {
  display: block;
  font-size: 1.5rem;
  color: #007bff;
}

.match-item {
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.match-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.existing-label {
  font-weight: bold;
  color: #666;
}

.match-arrow {
  color: #007bff;
}

.new-label {
  font-weight: bold;
  color: #28a745;
}

.match-confidence {
  margin-left: auto;
}

.content-preview {
  color: #666;
  font-style: italic;
}

.preserved-nodes,
.new-sections {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.preserved-list,
.new-list {
  margin-top: 0.5rem;
}

.processing-status {
  text-align: center;
  padding: 2rem;
}

.modal-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.step-content {
  margin-top: 1rem;
}
</style>
