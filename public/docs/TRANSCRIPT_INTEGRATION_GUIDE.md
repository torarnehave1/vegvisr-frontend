# 🎙️ Automated Transcript Processing Integration Guide

## Overview

This guide shows how to integrate the automated transcript processing feature into your existing Vegvisr.org application. The feature allows users to upload transcripts in any language and automatically generate Norwegian knowledge graphs.

## ✅ What's Been Implemented

### 1. **Frontend Component** - `TranscriptProcessorModal.vue`

- **Location**: `src/components/TranscriptProcessorModal.vue`
- **Features**:
  - File upload with drag & drop
  - Direct text paste
  - Language detection/selection
  - Real-time processing status
  - Preview of generated knowledge graph
  - One-click import to current graph

### 2. **Backend API Endpoint** - `/process-transcript`

- **Location**: Added to `api-worker/index.js`
- **Features**:
  - Accepts transcript text + metadata
  - Uses OpenAI GPT-4 with custom prompts
  - Returns complete Norwegian knowledge graph JSON
  - Error handling and validation

## 🔧 Integration Steps

### Step 1: Add Component to Your Main View

Add the transcript processor to your main graph view (likely `GraphViewer.vue` or similar):

```vue
<template>
  <div class="graph-viewer">
    <!-- Your existing content -->

    <!-- Add Transcript Processor Button -->
    <button
      @click="showTranscriptProcessor = true"
      class="btn btn-primary"
      title="Process Transcript to Knowledge Graph"
    >
      🎙️ Import Transcript
    </button>

    <!-- Add the Modal -->
    <TranscriptProcessorModal
      :isOpen="showTranscriptProcessor"
      @close="showTranscriptProcessor = false"
      @graph-imported="handleGraphImported"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TranscriptProcessorModal from '@/components/TranscriptProcessorModal.vue'

const showTranscriptProcessor = ref(false)

const handleGraphImported = (knowledgeGraph) => {
  console.log('Transcript processed and imported:', knowledgeGraph)
  // The nodes are already added to the store by the modal
  // You can add additional logic here if needed
}
</script>
```

### Step 2: Add to Sidebar Menu

Add to your sidebar navigation (`sidebar.vue`):

```vue
<li class="nav-item">
  <a 
    class="nav-link" 
    href="#" 
    @click.prevent="$emit('open-transcript-processor')"
  >
    <i class="bi bi-mic"></i>
    Import Transcript
  </a>
</li>
```

### Step 3: Environment Variables

Ensure your `api-worker` has the required environment variable:

```toml
# In api-worker/wrangler.toml
[env.production.vars]
OPENAI_API_KEY = "your_openai_api_key_here"

[env.development.vars]
OPENAI_API_KEY = "your_openai_api_key_here"
```

## 🚀 Usage Flow

1. **User clicks "Import Transcript"** button
2. **Upload or paste** transcript text
3. **Select source language** (auto-detect available)
4. **Click "Generate Knowledge Graph"**
5. **Preview generated nodes** with statistics
6. **Import to current graph** or create new graph

## 📊 Expected Output

For a 30-minute transcript, the system generates:

- **10-15 fulltext nodes** (DEL 1, DEL 2, etc.)
- **Norwegian content** with cultural context preserved
- **Rich formatting** (sections, quotes, emphasis)
- **Proper metadata** (colors, types, visibility)

## 🎯 Example Integration in Main App

Here's how to add it to your main application view:

```vue
<!-- In src/views/GraphViewer.vue or similar -->
<template>
  <div class="main-app">
    <div class="toolbar">
      <!-- Existing buttons -->
      <button @click="showAIModal = true" class="btn btn-primary">🤖 AI Node</button>

      <!-- NEW: Add this button -->
      <button @click="showTranscriptModal = true" class="btn btn-success">
        🎙️ Import Transcript
      </button>
    </div>

    <!-- Existing modals -->
    <EnhancedAINodeModal
      :isOpen="showAIModal"
      @close="showAIModal = false"
      @node-inserted="handleNodeInserted"
    />

    <!-- NEW: Add this modal -->
    <TranscriptProcessorModal
      :isOpen="showTranscriptModal"
      @close="showTranscriptModal = false"
      @graph-imported="handleTranscriptImported"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import EnhancedAINodeModal from '@/components/EnhancedAINodeModal.vue'
import TranscriptProcessorModal from '@/components/TranscriptProcessorModal.vue'

const showAIModal = ref(false)
const showTranscriptModal = ref(false) // NEW

const handleTranscriptImported = (knowledgeGraph) => {
  console.log(`Imported ${knowledgeGraph.nodes.length} nodes from transcript`)
  // Optionally trigger graph refresh or other actions
}
</script>
```

## 🛠️ Customization Options

### 1. **Styling**

The component uses Bootstrap 5 classes and can be customized via CSS:

```css
/* Custom styling for transcript processor */
.modal-content {
  border-radius: 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.upload-area {
  border: 3px dashed var(--bs-primary);
  background: linear-gradient(135deg, #f8f9ff, #e6f3ff);
}
```

### 2. **Processing Settings**

Modify the API call in `TranscriptProcessorModal.vue`:

```javascript
// Add custom processing parameters
body: JSON.stringify({
  transcript: transcriptText.value,
  sourceLanguage: sourceLanguage.value,
  targetLanguage: 'norwegian',
  // Add these options:
  maxNodes: 15,
  nodeSize: 'medium', // small, medium, large
  includeImages: true,
  culturalContext: 'scandinavian',
})
```

## 🚀 Benefits

### **For Vegvisr.org Users:**

- **Instant Knowledge Graphs**: 30-min transcript → 15 organized nodes in minutes
- **Norwegian Focus**: Perfect for your target audience
- **Cultural Preservation**: Maintains cultural nuances and context
- **Professional Quality**: Academic-level content formatting

### **For Your Workflow:**

- **Eliminates Copy-Paste**: No more manual segmentation
- **Consistent Quality**: Standardized formatting across all imports
- **Scalable**: Works with any language → Norwegian
- **Time Savings**: Hours of work reduced to minutes

## 🔍 Testing

Test with your Turkish transcript example:

1. Open the transcript processor
2. Paste the Turkish content from `trnscriptexcample.md`
3. Select "Turkish" as source language
4. Generate and compare with your manual `KnowledgeGraphExcample.md`

## 📞 Support

The system follows your existing patterns:

- Uses same authentication (`userStore.emailVerificationToken`)
- Integrates with `knowledgeGraphStore`
- Follows Bootstrap/Vue.js 3 conventions
- Compatible with your Cloudflare Workers architecture

**Ready to eliminate your manual transcript processing workflow!** 🚀
