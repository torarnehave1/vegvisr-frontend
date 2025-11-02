/**
 * Test: Diarization Text Alignment
 *
 * This demonstrates how the alignment function matches timing segments
 * with actual transcript text.
 */

import { alignDiarizationWithTextAdvanced, formatAlignedSegmentsAsMarkdown } from './src/utils/alignDiarizationWithText.js'

// Sample diarization data (from your JSON)
const sampleSegments = [
  { speaker: 'SPEAKER_01', start: 0.48, end: 1.08 },
  { speaker: 'SPEAKER_01', start: 1.5, end: 3.15 },
  { speaker: 'SPEAKER_03', start: 5.37, end: 5.7 },
  { speaker: 'SPEAKER_01', start: 6.27, end: 8.55 },
  { speaker: 'SPEAKER_00', start: 34.8, end: 35.29 },
  { speaker: 'SPEAKER_00', start: 36.07, end: 36.97 },
  { speaker: 'SPEAKER_00', start: 38.8, end: 40.89 },
  { speaker: 'SPEAKER_00', start: 41.4, end: 45.97 }
]

const sampleSpeakerLabels = {
  'SPEAKER_00': 'Mentor',
  'SPEAKER_01': 'Deltager',
  'SPEAKER_02': 'Birolle',
  'SPEAKER_03': 'Teknisk'
}

// Sample transcript text (excerpt from your conversation)
const sampleTranscript = `Så tenker jeg: Hvor kommer tankene fra? Det har vært en slik undring for meg, og jeg kunne tenkt meg å prate litt med deg om det. For du virker veldig rolig, og det ser ut til at du har full kontroll på tanker og innstillinger. Det er jo mange interessante betraktninger du kommer med. Det første du kanskje kunne begynne med er å forklare hva et perspektiv er. Prøv å forstå hva perspektiv er, fordi det tyder på at et menneske kan ta et perspektiv.`

console.log('=== DIARIZATION TEXT ALIGNMENT TEST ===\n')

// Test 1: Basic alignment
console.log('Test 1: Basic Word-Based Alignment\n')
console.log('Input:')
console.log(`- ${sampleSegments.length} diarization segments`)
console.log(`- Transcript: ${sampleTranscript.length} characters, ${sampleTranscript.split(/\s+/).length} words`)
console.log(`- Total duration: ${Math.max(...sampleSegments.map(s => s.end))} seconds\n`)

// Perform alignment
const alignedSegments = alignDiarizationWithTextAdvanced(
  sampleSegments,
  sampleTranscript,
  sampleSpeakerLabels
)

console.log('Output: Aligned Segments\n')
alignedSegments.forEach((seg, idx) => {
  const timeLabel = `${Math.floor(seg.start / 60)}:${(Math.floor(seg.start) % 60).toString().padStart(2, '0')}`
  console.log(`${idx + 1}. [${timeLabel}] ${seg.speakerLabel}:`)
  console.log(`   Duration: ${Math.floor(seg.end - seg.start)}s`)
  console.log(`   Text: "${seg.text.substring(0, 80)}${seg.text.length > 80 ? '...' : ''}"`)
  console.log()
})

// Test 2: Markdown formatting
console.log('\n=== Test 2: Markdown Formatted Output ===\n')
const markdown = formatAlignedSegmentsAsMarkdown(alignedSegments)
console.log(markdown)

// Test 3: Statistics
console.log('\n=== Test 3: Alignment Statistics ===\n')
const totalWords = sampleTranscript.split(/\s+/).length
const assignedWords = alignedSegments.reduce((sum, seg) => {
  return sum + (seg.text ? seg.text.split(/\s+/).length : 0)
}, 0)

console.log(`Total words in transcript: ${totalWords}`)
console.log(`Words assigned to segments: ${assignedWords}`)
console.log(`Coverage: ${((assignedWords / totalWords) * 100).toFixed(1)}%`)

// Speaker distribution
const speakerStats = {}
alignedSegments.forEach(seg => {
  if (!speakerStats[seg.speakerLabel]) {
    speakerStats[seg.speakerLabel] = {
      segments: 0,
      totalTime: 0,
      wordCount: 0
    }
  }
  speakerStats[seg.speakerLabel].segments++
  speakerStats[seg.speakerLabel].totalTime += (seg.end - seg.start)
  speakerStats[seg.speakerLabel].wordCount += seg.text.split(/\s+/).length
})

console.log('\nSpeaker Statistics:')
Object.entries(speakerStats).forEach(([speaker, stats]) => {
  console.log(`\n${speaker}:`)
  console.log(`  - Segments: ${stats.segments}`)
  console.log(`  - Speaking time: ${stats.totalTime.toFixed(1)}s`)
  console.log(`  - Words: ${stats.wordCount}`)
  console.log(`  - Avg words/segment: ${(stats.wordCount / stats.segments).toFixed(1)}`)
})

console.log('\n✅ Alignment test complete!')
console.log('\n📝 Note: This alignment is approximate. For perfect accuracy,')
console.log('   you would need word-level timestamps from the transcription service.')
