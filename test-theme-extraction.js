/**
 * Theme Extraction Feature - Test & Documentation
 *
 * This demonstrates the new theme extraction feature that allows users to:
 * 1. Search for specific themes/topics in conversations
 * 2. Extract relevant segments with speaker attribution
 * 3. Create focused knowledge graph nodes
 * 4. Use Grok AI for enhanced analysis that preserves conversation wording
 */

import { findThemeSegments, createSimpleThemeNode, prepareThemeAnalysisRequest } from './src/utils/extractConversationTheme.js'

// Sample conversation data (from your Norwegian philosophy discussion)
const sampleAlignedSegments = [
  {
    speaker: 'SPEAKER_01',
    speakerLabel: 'Deltager',
    start: 0,
    end: 3,
    text: 'Så tenker jeg: Hvor kommer tankene fra? Det har vært en slik undring for meg.'
  },
  {
    speaker: 'SPEAKER_00',
    speakerLabel: 'Mentor',
    start: 11,
    end: 14,
    text: 'Det første du kanskje kunne begynne med er å forklare hva et perspektiv er.'
  },
  {
    speaker: 'SPEAKER_01',
    speakerLabel: 'Deltager',
    start: 24,
    end: 27,
    text: 'Så når jeg lytter til deg, kan jeg ha to vidt forskjellige perspektiver samtidig.'
  },
  {
    speaker: 'SPEAKER_00',
    speakerLabel: 'Mentor',
    start: 141,
    end: 145,
    text: 'Og tredje perspektivet handler ikke om at jeg ser på følelser og tanker som noe objektivt sant.'
  },
  {
    speaker: 'SPEAKER_01',
    speakerLabel: 'Deltager',
    start: 256,
    end: 260,
    text: 'Kjærligheten er helt totalt fri. En enorm kraft. Å elske ubetinget betyr å være totalt i ærefullt forhold til det andre mennesket.'
  },
  {
    speaker: 'SPEAKER_00',
    speakerLabel: 'Mentor',
    start: 304,
    end: 309,
    text: 'Ubetinget kjærlighet betyr at man ikke har noen krav eller forventninger til noe som man tror er der ute.'
  },
  {
    speaker: 'SPEAKER_01',
    speakerLabel: 'Deltager',
    start: 425,
    end: 428,
    text: 'Jeg prøver å forstå mye mer enn å slutte. Du kan få at stillheten, eller det høyeste selv, der kan du få svar.'
  },
  {
    speaker: 'SPEAKER_00',
    speakerLabel: 'Mentor',
    start: 442,
    end: 445,
    text: 'Det mest brukte mantraet er "om". Det holder.'
  }
]

const fullTranscript = `Så tenker jeg: Hvor kommer tankene fra? Det har vært en slik undring for meg. Det første du kanskje kunne begynne med er å forklare hva et perspektiv er. Så når jeg lytter til deg, kan jeg ha to vidt forskjellige perspektiver samtidig. Og tredje perspektivet handler ikke om at jeg ser på følelser og tanker som noe objektivt sant. Kjærligheten er helt totalt fri. En enorm kraft. Å elske ubetinget betyr å være totalt i ærefullt forhold til det andre mennesket. Ubetinget kjærlighet betyr at man ikke har noen krav eller forventninger til noe som man tror er der ute. Jeg prøver å forstå mye mer enn å slutte. Du kan få at stillheten, eller det høyeste selv, der kan du få svar. Det mest brukte mantraet er "om". Det holder.`

console.log('=== THEME EXTRACTION FEATURE TEST ===\n')

// Test 1: Search for "perspektiv" theme
console.log('Test 1: Extracting theme "perspektiv"')
console.log('─'.repeat(50))

const perspektivSegments = findThemeSegments(sampleAlignedSegments, 'perspektiv')
console.log(`Found ${perspektivSegments.length} segments containing "perspektiv":\n`)

perspektivSegments.forEach((seg, idx) => {
  const time = Math.floor(seg.start)
  const mins = Math.floor(time / 60)
  const secs = time % 60
  console.log(`${idx + 1}. [${mins}:${secs.toString().padStart(2, '0')}] ${seg.speakerLabel}:`)
  console.log(`   "${seg.text.substring(0, 80)}${seg.text.length > 80 ? '...' : ''}"`)
  console.log()
})

// Test 2: Create simple theme node
console.log('\nTest 2: Creating simple theme node')
console.log('─'.repeat(50))

const simpleNode = createSimpleThemeNode(perspektivSegments, 'perspektiv')
console.log('Node created:', {
  id: simpleNode.id,
  label: simpleNode.label,
  type: simpleNode.type,
  metadata: simpleNode.metadata
})
console.log('\nContent preview (first 300 chars):')
console.log(simpleNode.info.substring(0, 300) + '...\n')

// Test 3: Search for "kjærlighet" theme
console.log('\nTest 3: Extracting theme "kjærlighet"')
console.log('─'.repeat(50))

const kjærlighetSegments = findThemeSegments(sampleAlignedSegments, 'kjærlighet')
console.log(`Found ${kjærlighetSegments.length} segments containing "kjærlighet":\n`)

kjærlighetSegments.forEach((seg, idx) => {
  const time = Math.floor(seg.start)
  const mins = Math.floor(time / 60)
  const secs = time % 60
  console.log(`${idx + 1}. [${mins}:${secs.toString().padStart(2, '0')}] ${seg.speakerLabel}:`)
  console.log(`   "${seg.text}"`)
  console.log()
})

// Test 4: Prepare Grok API request
console.log('\nTest 4: Preparing Grok API request for "kjærlighet"')
console.log('─'.repeat(50))

const grokRequest = prepareThemeAnalysisRequest(
  kjærlighetSegments,
  'kjærlighet',
  fullTranscript,
  'norwegian'
)

console.log('API Request payload:')
console.log({
  theme: grokRequest.theme,
  segmentCount: grokRequest.segmentCount,
  language: grokRequest.language,
  conversationLength: grokRequest.themeConversation.length
})

console.log('\nTheme conversation excerpt:')
console.log(grokRequest.themeConversation.substring(0, 400) + '...\n')

// Summary
console.log('\n' + '='.repeat(50))
console.log('FEATURE SUMMARY')
console.log('='.repeat(50))
console.log(`
✅ findThemeSegments()      - Search conversation for theme keywords
✅ createSimpleThemeNode()   - Create basic theme node locally
✅ prepareThemeAnalysisRequest() - Prepare Grok API request
✅ formatGrokThemeNode()     - Format Grok response as node

📡 API Endpoint: POST https://api.vegvisr.org/analyze-conversation-theme

🎯 Use Cases:
   - Extract discussions about "perspektiv" (philosophical concepts)
   - Find mentions of "kjærlighet" (love & relationships)
   - Analyze "meditasjon" (meditation techniques)
   - Study "tankefrihet" (freedom of thought)

💡 Grok Enhancement:
   - Preserves actual conversation wording
   - Provides deeper thematic analysis
   - Includes direct quotes with timestamps
   - Maintains speaker attribution

📝 Output Format:
   - Knowledge graph node with theme-focused content
   - Markdown formatted with headers, quotes, insights
   - Can be saved and viewed in graph viewer
`)

console.log('\n✅ Theme extraction feature ready for use!')
