/**
 * Align diarization segments with transcript text
 *
 * This function takes diarization timing data and the full transcript text,
 * then intelligently segments the text to match speaker segments.
 *
 * @param {Array} segments - Diarization segments with {speaker, start, end}
 * @param {string} fullText - Complete transcript text
 * @param {Object} speakerLabels - Optional speaker label mapping
 * @returns {Array} - Segments with text added: {speaker, start, end, text, speakerLabel}
 */
export function alignDiarizationWithText(segments, fullText, speakerLabels = {}) {
  if (!segments || segments.length === 0 || !fullText) {
    return []
  }

  // Clean and prepare the text
  const cleanText = fullText.trim()
  const words = cleanText.split(/\s+/)

  // Calculate total audio duration
  const totalDuration = Math.max(...segments.map(s => s.end))

  // Calculate words per second (rough estimate)
  const wordsPerSecond = words.length / totalDuration

  // Create aligned segments
  const alignedSegments = segments.map((segment, index) => {
    const duration = segment.end - segment.start

    // Estimate how many words this segment should contain
    const estimatedWords = Math.max(1, Math.round(duration * wordsPerSecond))

    // Calculate start word index based on cumulative duration
    const startWordIndex = Math.floor(segment.start * wordsPerSecond)
    const endWordIndex = Math.min(words.length, startWordIndex + estimatedWords)

    // Extract text for this segment
    const segmentWords = words.slice(startWordIndex, endWordIndex)
    const segmentText = segmentWords.join(' ')

    // Get speaker label
    const speakerLabel = speakerLabels[segment.speaker] || segment.speaker

    return {
      speaker: segment.speaker,
      speakerLabel: speakerLabel,
      start: segment.start,
      end: segment.end,
      text: segmentText || '(no text)',
      wordCount: segmentWords.length,
      index: index
    }
  })

  return alignedSegments
}

/**
 * Format aligned segments as markdown with timestamps
 *
 * @param {Array} alignedSegments - Output from alignDiarizationWithText
 * @returns {string} - Formatted markdown text
 */
export function formatAlignedSegmentsAsMarkdown(alignedSegments) {
  if (!alignedSegments || alignedSegments.length === 0) {
    return 'No aligned segments available.'
  }

  let markdown = '## Speaker-Aligned Conversation\n\n'

  // Filter out segments with no text before formatting
  const segmentsWithText = alignedSegments.filter(segment => segment.text && segment.text.trim().length > 0)

  segmentsWithText.forEach((segment) => {
    const startTime = Math.floor(segment.start)
    const minutes = Math.floor(startTime / 60)
    const seconds = startTime % 60
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

    const duration = Math.floor(segment.end - segment.start)

    markdown += `**[${timeLabel}] ${segment.speakerLabel}** (${duration}s):\n`
    markdown += `${segment.text}\n\n`
  })

  // Add note if segments were filtered out
  const filteredCount = alignedSegments.length - segmentsWithText.length
  if (filteredCount > 0) {
    markdown += `\n---\n\n*Note: ${filteredCount} empty segments were filtered out. The transcript appears to be shorter than the full audio recording.*\n`
  }

  return markdown
}

/**
 * Improved alignment using sentence boundaries
 *
 * This version tries to split at sentence boundaries for more natural segments
 *
 * @param {Array} segments - Diarization segments
 * @param {string} fullText - Complete transcript text
 * @param {Object} speakerLabels - Speaker label mapping
 * @returns {Array} - Better aligned segments
 */
export function alignDiarizationWithTextAdvanced(segments, fullText, speakerLabels = {}) {
  if (!segments || segments.length === 0 || !fullText) {
    return []
  }

  // STEP 1: Merge consecutive segments from the same speaker into "speaker turns"
  const speakerTurns = []
  let currentTurn = null

  segments.forEach((segment) => {
    if (!currentTurn || currentTurn.speaker !== segment.speaker) {
      // New speaker turn
      if (currentTurn) {
        speakerTurns.push(currentTurn)
      }
      currentTurn = {
        speaker: segment.speaker,
        speakerLabel: speakerLabels[segment.speaker] || segment.speaker,
        start: segment.start,
        end: segment.end,
        segmentCount: 1
      }
    } else {
      // Continue current speaker's turn
      currentTurn.end = segment.end
      currentTurn.segmentCount++
    }
  })

  // Push last turn
  if (currentTurn) {
    speakerTurns.push(currentTurn)
  }

  console.log(`Merged ${segments.length} segments into ${speakerTurns.length} speaker turns`)

  // STEP 2: Split text into sentences/phrases
  let sentences = fullText
    .replace(/([.!?])\s+/g, '$1|||')
    .split('|||')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // If too few sentences, split by commas and conjunctions
  if (sentences.length < speakerTurns.length * 1.5) {
    sentences = fullText
      .replace(/([.!?])\s+/g, '$1|||')
      .replace(/([,;:])\s+(og|men|så|for|eller|da|altså|fordi|når|hvis)\s+/g, '$1||| $2 ')
      .split('|||')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }

  if (sentences.length === 0) {
    return alignDiarizationWithText(segments, fullText, speakerLabels)
  }

  // STEP 3: Calculate total duration from speaker turns
  const totalDuration = speakerTurns[speakerTurns.length - 1].end

  // STEP 4: Distribute sentences across speaker turns based on duration
  const alignedTurns = []
  let currentSentenceIndex = 0

  speakerTurns.forEach((turn, turnIndex) => {
    const duration = turn.end - turn.start
    const durationRatio = duration / totalDuration
    const sentencesForTurn = Math.max(1, Math.round(sentences.length * durationRatio))

    // Collect sentences for this speaker turn
    const turnSentences = []
    for (let i = 0; i < sentencesForTurn && currentSentenceIndex < sentences.length; i++) {
      turnSentences.push(sentences[currentSentenceIndex])
      currentSentenceIndex++
    }

    // If no sentences assigned and sentences remain, assign at least one
    if (turnSentences.length === 0 && currentSentenceIndex < sentences.length) {
      turnSentences.push(sentences[currentSentenceIndex])
      currentSentenceIndex++
    }

    alignedTurns.push({
      speaker: turn.speaker,
      speakerLabel: turn.speakerLabel,
      start: turn.start,
      end: turn.end,
      text: turnSentences.join(' '),
      sentenceCount: turnSentences.length,
      segmentCount: turn.segmentCount,
      index: turnIndex
    })
  })

  // STEP 5: If sentences remain, append to last turn
  if (currentSentenceIndex < sentences.length) {
    const remainingSentences = sentences.slice(currentSentenceIndex).join(' ')
    if (alignedTurns.length > 0) {
      alignedTurns[alignedTurns.length - 1].text += ' ' + remainingSentences
    }
  }

  return alignedTurns
}

/**
 * Format aligned segments as a compact timeline (for display)
 *
 * @param {Array} alignedSegments - Aligned segments
 * @returns {string} - Compact timeline string
 */
export function formatCompactTimeline(alignedSegments) {
  if (!alignedSegments || alignedSegments.length === 0) {
    return ''
  }

  return alignedSegments.map(segment => {
    const startTime = Math.floor(segment.start)
    const minutes = Math.floor(startTime / 60)
    const seconds = startTime % 60
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
    const duration = Math.floor(segment.end - segment.start)

    return `[${timeLabel}] ${segment.speakerLabel} (${duration}s)`
  }).join('\n')
}

/**
 * Create a searchable index of segments (for finding specific content)
 *
 * @param {Array} alignedSegments - Aligned segments
 * @returns {Object} - Searchable index with keywords
 */
export function createSegmentIndex(alignedSegments) {
  const index = {
    bySpeaker: {},
    byTime: [],
    fullText: '',
    totalDuration: 0
  }

  if (!alignedSegments || alignedSegments.length === 0) {
    return index
  }

  alignedSegments.forEach(segment => {
    // Index by speaker
    if (!index.bySpeaker[segment.speaker]) {
      index.bySpeaker[segment.speaker] = []
    }
    index.bySpeaker[segment.speaker].push(segment)

    // Time-based index
    index.byTime.push({
      start: segment.start,
      end: segment.end,
      speaker: segment.speaker,
      speakerLabel: segment.speakerLabel,
      textPreview: segment.text.substring(0, 100)
    })

    // Accumulate full text
    index.fullText += segment.text + ' '
  })

  // Calculate total duration
  index.totalDuration = Math.max(...alignedSegments.map(s => s.end))

  return index
}
