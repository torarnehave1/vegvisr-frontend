# Transcript Processor - Complete Technical Documentation

## Overview

The Transcript Processor is a sophisticated system that transforms raw text transcripts (from pasted text, YouTube videos, or uploaded files) into structured Norwegian knowledge graphs using AI-powered processing. The system combines frontend user interface, composable logic, and backend API processing with Grok-3-beta AI model.

---

## Architecture Overview

```
User Input (Paste/YouTube/File)
         ↓
TranscriptProcessorView.vue (UI Layer)
         ↓
useTranscriptProcessor.js (Logic Layer)
         ↓
API: https://api.vegvisr.org/process-transcript
         ↓
Grok-3-beta AI Model (X.AI)
         ↓
Knowledge Graph JSON Response
         ↓
Preview & Export Options
         ↓
Save to Backend: https://knowledge.vegvisr.org/saveGraphWithHistory
```

---

## Complete User Flow

### Step 1: User Input Selection

**Location**: `TranscriptProcessorView.vue` (Lines 1-151)

The user has 4 input methods:

1. **Upload File** - Upload text/document files
2. **Paste Text** - Direct text input via textarea
3. **YouTube** - Extract transcript from YouTube URL or search
4. **Audio** - Upload audio for transcription (future feature)

**Example - Paste Text Flow**:
```vue
<textarea v-model="transcriptText" placeholder="Lim inn transkript her..."></textarea>
<button @click="startProcessing" v-if="transcriptText.length > 0">
  Start Processing
</button>
```

### Step 2: Process Initiation

**Location**: `TranscriptProcessorView.vue` Lines 476-501

When user clicks "Start Processing":

```javascript
const startProcessing = async () => {
  currentStep.value = 2  // Move to processing stage
  
  // Calls the composable's processTranscript function
  await processTranscript()
  
  currentStep.value = 3  // Move to preview stage
}
```

### Step 2.5: Processing Indicator UI

**Location**: `TranscriptProcessorView.vue` (Processing stage display)

While the API processes the transcript, users see a professional loading interface:

```vue
<div v-if="currentStep === 2" class="processing-overlay">
  <div class="processing-card">
    <div class="loading-icon">🔍</div>
    <h3>{{ processingStage }}</h3>
    
    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: processingProgress + '%' }"></div>
    </div>
    
    <p class="processing-message">{{ processingMessage }}</p>
    
    <p class="help-text">
      We're analyzing your transcript and generating a knowledge graph
      with Norwegian summaries. This may take a few minutes depending
      on the content length.
    </p>
  </div>
</div>
```

**Processing States:**

The system updates the UI through these stages:

1. **Initial (20%)**: 
   - Icon: 🔍
   - Stage: "Analyzing transcript..."
   - Message: "Processing content structure"

2. **API Processing (80%)**:
   - Stage: "🧠 Generating knowledge graph..."
   - Message: "Creating Norwegian content"

3. **Complete (100%)**:
   - Stage: "✅ Complete!"
   - Message: "Knowledge graph ready"

**Implementation in Composable:**

```javascript
// Location: useTranscriptProcessor.js Lines 522-555

const processTranscript = async () => {
  isProcessing.value = true
  
  // Stage 1: Initial analysis (20%)
  processingProgress.value = 20
  processingStage.value = '🔍 Analyzing transcript...'
  processingMessage.value = 'Processing content structure'
  
  // Make API call
  const response = await fetch('https://api.vegvisr.org/process-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload)
  })
  
  // Stage 2: Graph generation (80%)
  processingStage.value = '🧠 Generating knowledge graph...'
  processingProgress.value = 80
  processingMessage.value = 'Creating Norwegian content'
  
  const result = await response.json()
  
  // Stage 3: Complete (100%)
  processingStage.value = '✅ Complete!'
  processingProgress.value = 100
  processingMessage.value = 'Knowledge graph ready'
  
  knowledgeGraphPreview.value = result.knowledgeGraph
  isProcessing.value = false
}
```

**Visual Elements:**

- **Animated spinner/icon**: Rotating search icon (🔍) or loading animation
- **Progress bar**: Blue gradient fill showing percentage (20% → 80% → 100%)
- **Dynamic text updates**: Stage name and processing message change in real-time
- **User guidance**: Explanation text helps users understand what's happening
- **Gray overlay**: Semi-transparent background to focus attention on processing card

**Timing Breakdown:**

- **Fast transcripts** (<1000 words): ~5-15 seconds total
- **Medium transcripts** (1000-3000 words): ~15-30 seconds total
- **Large transcripts** (>3000 words): ~30-60 seconds total

The progress bar provides visual feedback that something is happening, even though the actual API call happens in one step. This improves perceived performance and user experience.

---

## Core Processing Logic

### Step 3: API Request Construction

**Location**: `useTranscriptProcessor.js` Lines 522-555

The composable builds the API request:

```javascript
const processTranscript = async () => {
  isProcessing.value = true
  processingProgress.value = 20
  processingStage.value = '🔍 Analyzing transcript...'
  
  const requestPayload = {
    transcript: transcriptText.value,           // The full text
    sourceLanguage: sourceLanguage.value,       // 'auto', 'english', etc.
    targetLanguage: keepOriginalLanguage.value ? 'original' : 'norwegian'
  }
  
  const response = await fetch('https://api.vegvisr.org/process-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload)
  })
  
  processingProgress.value = 80
  processingStage.value = '🧠 Generating knowledge graph...'
  
  const result = await response.json()
  knowledgeGraphPreview.value = result.knowledgeGraph
}
```

---

## Backend API Processing

### Step 4: API Handler - Initial Validation

**Location**: `api-worker/index.js` Lines 2803-2825

```javascript
const handleProcessTranscript = async (request, env) => {
  const body = await request.json()
  const { transcript, sourceLanguage, targetLanguage } = body
  
  // Validate input
  if (!transcript) {
    return createErrorResponse('Missing transcript text', 400)
  }
  
  // Check API key availability
  const apiKey = env.XAI_API_KEY
  if (!apiKey) {
    return createErrorResponse('Grok API key not configured', 500)
  }
  
  // Count words for processing strategy
  const transcriptWords = transcript.split(/\s+/).length
  console.log('Transcript word count:', transcriptWords)
}
```

### Step 5: Prompt Construction Based on Target Language

**Location**: `api-worker/index.js` Lines 2827-2920

The system creates different prompts based on target language:

#### Option A: Original Language (No Translation)

```javascript
if (targetLanguage === 'original') {
  maxTokens = 16000
  
  prompt = `Transform this transcript into a comprehensive knowledge graph in its ORIGINAL language. DO NOT TRANSLATE.

SOURCE LANGUAGE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET LANGUAGE: Original (No Translation)

RULES:
1. DO NOT TRANSLATE the content. Keep it in the original language.
2. Create nodes with structure: {
     "id": "del_X", 
     "label": "PART X: [Descriptive Title in Original Language]", 
     "color": "#f9f9f9", 
     "type": "fulltext", 
     "info": "comprehensive content in original language",
     "bibl": [], 
     "imageWidth": "100%", 
     "imageHeight": "100%", 
     "visible": true, 
     "path": null
   }
3. Split into logical thematic sections. Be thorough.
4. Use rich markdown formatting in the "info" field with headers, lists, and emphasis.
5. Each node should contain substantial content (200-800 words).
6. Include key quotes, important details, and context from the original text.
7. Create a comprehensive knowledge graph that captures the full essence.

TRANSCRIPT (full content):
${transcript}

Return ONLY valid JSON: {"nodes": [...], "edges": []}`
}
```

#### Option B: Norwegian Translation (Standard)

For transcripts under 3000 words:

```javascript
prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph JSON.

SOURCE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET: Norwegian

Create nodes with this structure:
{
  "id": "del_X", 
  "label": "DEL X: [Descriptive Title]", 
  "color": "#f9f9f9", 
  "type": "fulltext", 
  "info": "comprehensive Norwegian content",
  "bibl": [], 
  "imageWidth": "100%", 
  "imageHeight": "100%", 
  "visible": true, 
  "path": null
}

Rules:
- Translate ALL content to Norwegian with exceptional quality
- Split into 6-12 comprehensive thematic sections
- Use rich markdown formatting in "info" field
- Preserve cultural context and nuanced meaning
- Each node should be substantial (150-600 words)
- Include important quotes, examples, and detailed explanations
- Don't summarize - be comprehensive and detailed

TRANSCRIPT:
${transcript}

Return only JSON: {"nodes": [...], "edges": []}`
```

#### Option C: Norwegian Translation (Large Transcripts)

For transcripts over 3000 words:

```javascript
maxTokens = 16000  // Use Grok's full capacity

prompt = `Transform this transcript into a comprehensive Norwegian knowledge graph. Create 8-15 detailed thematic sections as nodes.

SOURCE: ${sourceLanguage === 'auto' ? 'auto-detect' : sourceLanguage}
TARGET: Norwegian

RULES:
1. Translate EVERYTHING to Norwegian with high quality
2. Create nodes with complete structure including id, label, color, type, info, bibl, etc.
3. Split into logical thematic sections - be thorough, don't skip content
4. Use rich markdown formatting in "info" field with headers, lists, emphasis
5. Each node should contain substantial content (200-800 words)
6. Include key quotes, important details, and context
7. Create a comprehensive knowledge graph that captures the full essence

TRANSCRIPT (full content):
${transcript}

Return JSON: {"nodes": [...], "edges": []}`
```

### Step 6: Grok-3-beta AI Processing

**Location**: `api-worker/index.js` Lines 2922-2945

```javascript
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://api.x.ai/v1',
})

const completion = await client.chat.completions.create({
  model: 'grok-3-beta',
  temperature: 0.7,
  max_tokens: maxTokens,  // 12000 or 16000 depending on transcript size
  messages: [
    {
      role: 'system',
      content: 'You are an expert Norwegian translator and knowledge graph creator specializing in comprehensive content generation. Transform content into detailed Norwegian knowledge graphs with substantial, well-structured content. Create thorough translations that preserve all important information, cultural context, and nuanced meaning. Always generate multiple detailed nodes with rich markdown formatting. Return only valid JSON in the specified format.'
    },
    { role: 'user', content: prompt }
  ]
})

const knowledgeGraphData = completion.choices[0].message.content.trim()
```

**What Grok-3-beta Does:**

1. **Analyzes** the transcript content and structure
2. **Identifies** logical thematic sections (topics, chapters, themes)
3. **Translates** content to Norwegian (if targetLanguage='norwegian')
4. **Chunks** into 6-15 nodes based on themes, not word count
5. **Generates** descriptive labels like "DEL 1: Introduction to Topic"
6. **Formats** each node's content with:
   - Markdown headers (##, ###)
   - Lists and bullet points
   - Emphasis (*italic*, **bold**)
   - Block quotes
   - Structured paragraphs
7. **Preserves** cultural context, idioms, and nuanced meaning
8. **Returns** valid JSON structure

### Step 7: Response Validation and Processing

**Location**: `api-worker/index.js` Lines 2947-2993

```javascript
try {
  const parsedGraph = JSON.parse(knowledgeGraphData)
  
  // Validate structure
  if (!parsedGraph.nodes || !Array.isArray(parsedGraph.nodes)) {
    throw new Error('Invalid knowledge graph structure: missing nodes array')
  }
  
  // Add timestamps to node IDs if missing
  parsedGraph.nodes = parsedGraph.nodes.map((node) => ({
    ...node,
    id: node.id || `fulltext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    visible: true,
    path: null
  }))
  
  console.log('Successfully generated', parsedGraph.nodes.length, 'nodes')
  
  return createResponse(JSON.stringify({
    knowledgeGraph: parsedGraph,
    stats: {
      totalNodes: parsedGraph.nodes.length,
      processingTime: Date.now(),
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      modelUsed: 'grok-3-beta',
      transcriptWords: transcriptWords
    }
  }))
}
```

**Response Format:**

```json
{
  "knowledgeGraph": {
    "nodes": [
      {
        "id": "del_1",
        "label": "DEL 1: Innledning til emnet",
        "color": "#f9f9f9",
        "type": "fulltext",
        "info": "## Innledning\n\nDette er en detaljert beskrivelse...\n\n- Punkt 1\n- Punkt 2\n\n**Viktig:** Dette er viktig informasjon.",
        "bibl": [],
        "imageWidth": "100%",
        "imageHeight": "100%",
        "visible": true,
        "path": null
      }
    ],
    "edges": []
  },
  "stats": {
    "totalNodes": 8,
    "processingTime": 1730563200000,
    "sourceLanguage": "auto",
    "targetLanguage": "norwegian",
    "modelUsed": "grok-3-beta",
    "transcriptWords": 2500
  }
}
```

---

## Fallback Processing (When API Fails)

### Step 8: Local Fallback

**Location**: `useTranscriptProcessor.js` Lines 461-519

If the API call fails, the system uses a simple local fallback:

```javascript
const createLocalKnowledgeGraph = async () => {
  const text = transcriptText.value
  const words = text.split(/\s+/)
  const chunkSize = 500  // Simple 500-word chunks
  const chunks = []
  
  // Split by word count (not intelligent chunking)
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
  }
  
  // Create basic nodes
  const nodes = chunks.map((chunk, index) => ({
    id: `transcript_${Date.now()}_${index}`,
    label: `DEL ${index + 1}`,  // Generic "Part 1", "Part 2" labels
    color: '#f9f9f9',
    type: 'fulltext',
    info: `## DEL ${index + 1}\n\n${chunk}\n\n*Note: This content was created using local processing. For full AI translation and enhancement, please ensure the API service is available.*`,
    bibl: [],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null
  }))
  
  return { nodes, edges: [], fallbackMode: true }
}
```

**Fallback Characteristics:**

- ❌ No AI processing
- ❌ No translation
- ❌ No intelligent chunking (just counts 500 words)
- ❌ No thematic analysis
- ✅ Simple backup to prevent complete failure
- ✅ Adds note to user about limitations

---

## Preview and Export

### Step 9: Knowledge Graph Preview

**Location**: `TranscriptProcessorView.vue` Lines 300-450

After processing completes, user sees:

```vue
<div v-if="currentStep === 3" class="preview-section">
  <h3>Knowledge Graph Preview</h3>
  
  <div class="graph-stats">
    <span>{{ knowledgeGraphPreview.nodes.length }} nodes created</span>
  </div>
  
  <div class="node-grid">
    <div v-for="node in knowledgeGraphPreview.nodes" :key="node.id" class="node-card">
      <h4>{{ node.label }}</h4>
      <div v-html="renderMarkdown(node.info)"></div>
    </div>
  </div>
  
  <div class="export-actions">
    <button @click="handleImportToGraph">Import to Current Graph</button>
    <button @click="handleCreateNewGraph">Create New Graph</button>
  </div>
</div>
```

### Step 10A: Import to Existing Graph

**Location**: `useTranscriptProcessor.js` Lines 647-674

```javascript
const importToGraph = () => {
  if (!knowledgeGraphPreview.value) {
    throw new Error('No knowledge graph preview available!')
  }
  
  // Add nodes to the current graph
  knowledgeGraphPreview.value.nodes.forEach((node, index) => {
    const newNode = {
      id: node.id || `transcript_${Date.now()}_${index}`,
      label: node.label || 'Imported Node',
      color: node.color || '#f9f9f9',
      type: node.type || 'fulltext',
      info: node.info || '',
      size: 3,
      position: { x: 100 + index * 200, y: 100 + Math.floor(index / 5) * 300 }
    }
    
    knowledgeGraphStore.nodes.push(newNode)
  })
  
  console.log(`Added ${knowledgeGraphPreview.value.nodes.length} transcript nodes to current graph`)
  return knowledgeGraphPreview.value
}
```

### Step 10B: Create New Graph

**Location**: `useTranscriptProcessor.js` Lines 675-740

```javascript
const createNewGraph = async () => {
  if (!knowledgeGraphPreview.value) {
    throw new Error('No knowledge graph preview available!')
  }
  
  // Create metadata
  const today = new Date()
  const dateStr = today.toLocaleDateString('no-NO')
  const timeStr = today.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  const nodeCount = knowledgeGraphPreview.value.nodes?.length || 0
  
  const graphTitle = `📝 Transkript ${dateStr} (${nodeCount} deler)`
  
  const graphMetadata = {
    title: graphTitle,
    description: `Automatisk generert norsk kunnskapsgraf fra transkript prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`,
    createdBy: userStore.email || 'Anonymous',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  // Prepare graph data with positions
  const graphData = {
    metadata: graphMetadata,
    nodes: knowledgeGraphPreview.value.nodes.map((node, index) => ({
      ...node,
      position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 250 },
      visible: true
    })),
    edges: knowledgeGraphPreview.value.edges || []
  }
  
  // Generate unique graph ID
  const graphId = `graph_${Date.now()}`
  
  // Save to backend
  const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': userStore.emailVerificationToken
    },
    body: JSON.stringify({ id: graphId, graphData })
  })
  
  if (response.ok) {
    const result = await response.json()
    const finalGraphId = result.graphId || graphId
    
    // Update store
    knowledgeGraphStore.setCurrentGraphId(finalGraphId)
    knowledgeGraphStore.updateGraphFromJson({
      nodes: graphData.nodes,
      edges: graphData.edges,
      metadata: graphData.metadata
    })
    
    return { graphId: finalGraphId, graphData }
  }
}
```

---

## Complete Data Flow Summary

### Input → Processing → Output

```
1. USER INPUT
   ├─ Paste Text: "This is a transcript about AI..."
   ├─ YouTube URL: "https://youtube.com/watch?v=..."
   └─ File Upload: transcript.txt

2. FRONTEND (TranscriptProcessorView.vue)
   └─ Captures input → Calls startProcessing()

3. COMPOSABLE (useTranscriptProcessor.js)
   └─ Builds request → Sends to API

4. API REQUEST
   POST https://api.vegvisr.org/process-transcript
   Body: {
     transcript: "full text...",
     sourceLanguage: "auto",
     targetLanguage: "norwegian"
   }

5. BACKEND (api-worker/index.js)
   ├─ Validates input
   ├─ Analyzes word count
   ├─ Constructs appropriate prompt
   └─ Calls Grok-3-beta

6. AI PROCESSING (Grok-3-beta)
   ├─ Analyzes content themes
   ├─ Identifies logical sections
   ├─ Translates to Norwegian
   ├─ Formats with markdown
   └─ Returns JSON structure

7. API RESPONSE
   {
     knowledgeGraph: {
       nodes: [
         {id, label, color, type, info, ...},
         ...
       ],
       edges: []
     },
     stats: {totalNodes, modelUsed, ...}
   }

8. FRONTEND PREVIEW
   └─ Displays nodes in grid layout

9. USER EXPORT CHOICE
   ├─ Import to Current Graph → Adds to existing
   └─ Create New Graph → Saves new graph to backend

10. BACKEND STORAGE
    POST https://knowledge.vegvisr.org/saveGraphWithHistory
    └─ Saves complete graph with metadata
```

---

## Technical Specifications

### Models Used

- **Primary AI Model**: Grok-3-beta (X.AI)
- **API Endpoint**: https://api.x.ai/v1
- **Model Capabilities**:
  - Large context window (16,000 tokens)
  - Multilingual translation
  - Structured JSON generation
  - Markdown formatting
  - Semantic content analysis

### No Traditional NLP Libraries

The system does **NOT** use:
- ❌ spaCy
- ❌ NLTK
- ❌ Transformers (for transcript processing)
- ❌ Sentence transformers
- ❌ Traditional chunking algorithms

Instead, it relies on:
- ✅ Grok-3-beta AI model for intelligent processing
- ✅ User-defined RULES in prompts
- ✅ Simple JavaScript string operations (fallback only)

### Performance Characteristics

**API Processing:**
- Standard transcripts (<3000 words): 12,000 max tokens, 6-12 nodes
- Large transcripts (>3000 words): 16,000 max tokens, 8-15 nodes
- Temperature: 0.7 (balanced creativity and consistency)

**Local Fallback:**
- Simple 500-word chunks
- No AI processing
- No translation
- Generic labels

---

## Node Structure Specification

### Complete Node Object

```javascript
{
  id: "del_1",                    // Unique identifier
  label: "DEL 1: Descriptive Title", // Human-readable title
  color: "#f9f9f9",               // Background color
  type: "fulltext",               // Node type
  info: "## Title\n\nContent...", // Markdown formatted content
  bibl: [],                       // Bibliography/sources (optional)
  imageWidth: "100%",             // Image width if applicable
  imageHeight: "100%",            // Image height if applicable
  visible: true,                  // Visibility flag
  path: null,                     // File path (if applicable)
  position: {                     // Canvas position (added during save)
    x: 100,
    y: 250
  }
}
```

### Markdown Formatting in `info` Field

Grok-3-beta generates rich markdown:

```markdown
## Hovedoverskrift

Dette er introduksjonsteksten med **viktig innhold** og *emfase*.

### Underoverskrift

- Liste punkt 1
- Liste punkt 2
- Liste punkt 3

> Dette er et sitat eller viktig merknad

**Nøkkelpunkter:**
1. Første punkt
2. Andre punkt
3. Tredje punkt

*Konklusjon:* Dette er oppsummeringen.
```

---

## Error Handling

### API Errors

```javascript
try {
  const response = await fetch('https://api.vegvisr.org/process-transcript', {...})
  
  if (!response.ok) {
    throw new Error(`Processing failed: ${response.status}`)
  }
  
  const result = await response.json()
  knowledgeGraphPreview.value = result.knowledgeGraph
  
} catch (error) {
  console.error('API failed, attempting local processing...')
  
  // Fallback to createLocalKnowledgeGraph()
  const fallbackResult = await createLocalKnowledgeGraph()
  knowledgeGraphPreview.value = fallbackResult
}
```

### Validation Errors

```javascript
// Backend validation
if (!transcript) {
  return createErrorResponse('Missing transcript text', 400)
}

if (!apiKey) {
  return createErrorResponse('Grok API key not configured', 500)
}

// JSON parsing validation
try {
  const parsedGraph = JSON.parse(knowledgeGraphData)
  
  if (!parsedGraph.nodes || !Array.isArray(parsedGraph.nodes)) {
    throw new Error('Invalid knowledge graph structure')
  }
} catch (parseError) {
  return createErrorResponse('Failed to parse generated JSON', 500)
}
```

---

## Summary

The Transcript Processor is a **user-designed, AI-powered system** where:

1. **You (the developer)** defined the RULES for how content should be processed
2. **Grok-3-beta AI** follows your rules to intelligently analyze, translate, and structure content
3. **No traditional NLP libraries** are used - just AI model intelligence + your architectural design
4. **Fallback system** ensures functionality even when API is unavailable
5. **Complete workflow** from user input to saved knowledge graph with rich metadata

The system demonstrates modern AI-powered application architecture where prompt engineering and rule design create sophisticated functionality without complex NLP pipelines.

---

**Last Updated**: November 2, 2025
**Model Version**: Grok-3-beta
**API Version**: api.vegvisr.org v1
