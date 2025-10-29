# Pinia Store SEO Implementation

## Overview
Successfully migrated node-specific SEO context passing from URL parameters to Pinia store for better state management and no content truncation.

## Changes Made

### 1. Knowledge Graph Store (`src/stores/knowledgeGraphStore.js`)

Added new SEO context state and methods:

```javascript
// New State
const seoContext = ref({
  nodeId: null,
  nodeLabel: null,
  nodeContent: null,
  nodeType: null,
  isNodeSpecific: false
})

// New Methods
const setSEOContext = (context) => { ... }
const clearSEOContext = () => { ... }
```

**Exports:**
- `seoContext` - Reactive ref containing node SEO data
- `setSEOContext(context)` - Store node data for SEO
- `clearSEOContext()` - Clear SEO context

### 2. GNewViewer.vue (`src/views/GNewViewer.vue`)

Updated `handleOpenNodeSEO` function (lines 6254-6284):

**Before:** Passed node content via URL parameters with 2000 character truncation
```javascript
const truncatedContent = nodeContent.length > maxContentLength 
  ? nodeContent.substring(0, maxContentLength) + '...'
  : nodeContent
```

**After:** Stores full content in Pinia, minimal URL params
```javascript
knowledgeGraphStore.setSEOContext({
  nodeId: node.id,
  nodeLabel: nodeLabel,
  nodeContent: nodeContent, // No truncation!
  nodeType: node.type || 'fulltext'
})

router.push({
  name: 'seo-admin',
  query: {
    graphId: currentGraphId.value,
    nodeId: node.id // Minimal params
  }
})
```

**Benefits:**
- ✅ No 2000 character truncation limit
- ✅ Full node content available for AI description
- ✅ Cleaner URLs
- ✅ Better state management

### 3. SEOAdmin.vue (`src/views/SEOAdmin.vue`)

#### Added Imports
```javascript
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const knowledgeGraphStore = useKnowledgeGraphStore()
```

#### Updated onMounted (lines 1087-1177)
**Priority:** Pinia store → URL parameters (fallback)

```javascript
onMounted(async () => {
  // Check Pinia store first (preferred method)
  const storeContext = knowledgeGraphStore.seoContext
  
  if (storeContext && storeContext.isNodeSpecific) {
    // Use full node content from store (no truncation!)
    seoConfig.value.title = storeContext.nodeLabel
    const cleanContent = storeContext.nodeContent
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
      // ... more cleaning
    seoConfig.value.description = cleanContent.substring(0, 160)
    
    await loadGraph()
  } else if (route.query.graphId) {
    // Fallback to legacy URL parameter method
    // ...
  }
})
```

#### Added onUnmounted Hook
```javascript
onUnmounted(() => {
  knowledgeGraphStore.clearSEOContext()
  console.log('🧹 SEO Admin: Cleared SEO context on unmount')
})
```

#### Updated loadGraph() (lines 508-565)
```javascript
// Check Pinia store first
const storeContext = knowledgeGraphStore.seoContext
if (storeContext && storeContext.isNodeSpecific) {
  // Use full node content (no truncation!)
  seoConfig.value.description = storeContext.nodeContent...
} else if (route.query.nodeId && route.query.nodeContent) {
  // Fallback to query params
  // ...
}
```

#### Updated generateAIDescription() (lines 621-676)
```javascript
// Check Pinia store first
const storeContext = knowledgeGraphStore.seoContext
if (storeContext && storeContext.isNodeSpecific) {
  contentToSummarize = {
    nodes: [{
      type: storeContext.nodeType,
      label: storeContext.nodeLabel,
      info: storeContext.nodeContent // Full content!
    }],
    metadata: { ... }
  }
}
```

#### Updated Badge Indicator (lines 77-84)
```vue
<!-- Check store first, then query params -->
<div v-if="knowledgeGraphStore.seoContext.isNodeSpecific" class="badge bg-info text-white ms-2">
  📝 Node-Specific SEO: {{ knowledgeGraphStore.seoContext.nodeLabel }}
</div>
<div v-else-if="route.query.nodeId" class="badge bg-info text-white ms-2">
  📝 Node-Specific SEO: {{ route.query.nodeLabel }}
</div>
```

## Architecture Benefits

### Before (URL Parameters)
```
GNewViewer → router.push(query: {nodeContent: truncated(2000 chars)})
  ↓
SEOAdmin → route.query.nodeContent (truncated)
  ↓
AI Worker → Receives truncated content
```

**Limitations:**
- ❌ 2000 character URL limit
- ❌ Content truncation
- ❌ Messy URLs
- ❌ Data loss on long content

### After (Pinia Store)
```
GNewViewer → knowledgeGraphStore.setSEOContext({full content})
  ↓
SEOAdmin → knowledgeGraphStore.seoContext (full content)
  ↓
AI Worker → Receives complete node content
```

**Benefits:**
- ✅ No content truncation
- ✅ Full node content available
- ✅ Clean URLs
- ✅ Reactive state management
- ✅ Automatic cleanup on unmount
- ✅ Better separation of concerns

## Data Flow

1. **User clicks SEO button** on fulltext node
2. **GNewViewer** stores context in Pinia:
   ```javascript
   knowledgeGraphStore.setSEOContext({
     nodeId, nodeLabel, nodeContent, nodeType
   })
   ```
3. **Router navigates** to SEO Admin with minimal query params
4. **SEOAdmin onMounted** reads from store:
   - Full node content (no truncation)
   - Pre-fills title and description
   - Auto-loads graph
5. **AI description generation** uses full content from store
6. **SEOAdmin onUnmounted** clears context for cleanup

## Backward Compatibility

All functions check **Pinia store first**, then fall back to **route.query** parameters. This ensures:
- ✅ New approach works immediately
- ✅ Legacy URLs still function
- ✅ Gradual migration possible
- ✅ No breaking changes

## Testing Checklist

- [ ] Click SEO button on fulltext node
- [ ] Verify store populated in Vue DevTools
- [ ] Check SEO Admin receives full content
- [ ] Verify description uses node text (not graph metadata)
- [ ] Test AI description generation with full content
- [ ] Confirm badge shows "Node-Specific SEO: [label]"
- [ ] Test page refresh behavior
- [ ] Verify context cleared on navigation away
- [ ] Test with long node content (>2000 chars)
- [ ] Compare AI output: truncated vs full content

## Files Modified

1. `/src/stores/knowledgeGraphStore.js` - Added SEO context state
2. `/src/views/GNewViewer.vue` - Store-based context setting
3. `/src/views/SEOAdmin.vue` - Store-based context reading

## Console Debugging

Look for these log messages:

**GNewViewer:**
```
🔍 Opening SEO admin for node: [nodeId]
🎯 Navigating to SEO admin with node context stored in Pinia
```

**SEOAdmin:**
```
🎯 SEO Admin: Using Pinia store context for node: [nodeId]
📝 Using Pinia store node-specific content for SEO description
📝 Generating AI description from Pinia store node content
🧹 SEO Admin: Cleared SEO context on unmount
```

## Next Steps

1. Test with various node content lengths
2. Monitor Vue DevTools for store state
3. Verify AI descriptions improve with full content
4. Consider adding store persistence (localStorage) if needed
5. Remove legacy URL parameter fallback after validation period
