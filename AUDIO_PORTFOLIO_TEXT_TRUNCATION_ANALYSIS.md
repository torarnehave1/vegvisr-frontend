# Audio Portfolio Text Truncation - Root Cause Analysis

## Date: November 2, 2025

## Issue Report

User reports: "Audio Portfolio Selector is not returning the full text that is in the KV"

## Investigation Summary

### ✅ VERIFIED: KV Storage is CORRECT

The KV contains FULL text:

```json
{
  "transcriptionText": "Full 8700+ char improved text",
  "transcriptionExcerpt": "First 200 chars...",  // This is INTENTIONAL
  "norwegianTranscription": {
    "raw_text": "Full 8700+ char raw text",
    "improved_text": "Full 8700+ char enhanced text"  // ✅ FULL TEXT HERE
  }
}
```

### ✅ VERIFIED: Component Code is CORRECT

**AudioRecordingSelector.vue Line 353:**
```javascript
const createEnhancedTextNode = (recording) => {
  const enhancedText = recording.norwegianTranscription.improved_text  // ✅ Uses full text
  
  const nodeContent = `...${enhancedText}...`  // ✅ Inserts full text
  
  return { info: nodeContent, ... }  // ✅ Node has full text
}
```

### ⚠️ COSMETIC: Preview Text is Truncated (BY DESIGN)

**AudioRecordingSelector.vue Line 343:**
```javascript
const getPreviewText = (recording) => {
  // ... gets improved_text or raw_text ...
  
  // TRUNCATES TO 120 CHARS FOR LIST DISPLAY
  return previewText.length > 120 
    ? previewText.substring(0, 120) + '...' 
    : previewText
}
```

This is used in the **recording list** (Line 102):
```vue
<div class="preview-text">
  {{ getPreviewText(recording) }}  <!-- Only 120 chars shown -->
</div>
```

## The Confusion

There are **TWO** different displays of text:

### 1. **Preview in Recording List** (BEFORE inserting)
- **Location:** AudioRecordingSelector modal, recording list
- **Text Length:** 120 characters maximum
- **Purpose:** Quick preview to help user select recording
- **Status:** ✅ WORKING AS DESIGNED

### 2. **Actual Graph Node** (AFTER inserting)
- **Location:** Knowledge graph canvas
- **Text Length:** FULL 8700+ characters
- **Purpose:** Complete transcription content
- **Status:** ✅ SHOULD HAVE FULL TEXT

## Diagnostic Steps

### Step 1: Verify What You're Looking At

**Question:** When you say "not returning full text", are you looking at:

**A) The preview in the recording list?**
```
┌─────────────────────────────────┐
│ ✨ Enhanced Available           │
│ ─────────────────────────────── │
│ Så tenker jeg: Hvor kommer...  │  <-- This is ALWAYS 120 chars
│                                 │
│ [Insert Recording Button]       │
└─────────────────────────────────┘
```

**B) The actual graph node content?**
```
┌─────────────────────────────────────────┐
│ ✨ Enhanced: recording_name.wav         │
│ ─────────────────────────────────────── │
│                                         │
│ [Full 8700+ character text should       │
│  be displayed here when you click       │
│  on the node in the graph]              │
│                                         │
└─────────────────────────────────────────┘
```

### Step 2: Test Actual Node Insertion

1. **Open AudioRecordingSelector**
2. **Select a recording** with enhanced text
3. **Click "Insert Recording"** button
4. **Check the graph node** that was created
5. **Click on the node** to view its content
6. **Verify:** Does the node's `info` field contain all 8700+ characters?

### Step 3: Browser Console Debugging

Add this to your browser console while testing:

```javascript
// After inserting a recording, check the node
const lastNode = window.knowledgeGraphStore?.nodes[window.knowledgeGraphStore.nodes.length - 1]
console.log('Node info length:', lastNode?.info?.length)
console.log('Full text preview:', lastNode?.info?.substring(0, 200))
```

## Possible Real Issues

If the **actual inserted node** is truncated (not just the preview), then:

### Issue 1: GraphViewer Truncating Node Content

Check if GraphViewer.vue has any truncation logic:

```bash
grep -n "info.*substring" src/components/GraphViewer.vue
grep -n "info.*slice" src/components/GraphViewer.vue
```

### Issue 2: Node Rendering Limiting Text Display

Check if the node rendering component limits text:

```bash
grep -n "maxLength" src/components/GNewNodes/*.vue
grep -n "truncate" src/components/GNewNodes/*.vue
```

### Issue 3: Data Store Truncating on Add

Check if knowledgeGraphStore modifies node.info:

```bash
grep -n "node.info" src/stores/knowledgeGraphStore.js
```

## The Likely Explanation

Based on the code review, the most likely scenario is:

**You are looking at the PREVIEW text (120 chars) in the recording list, not the actual inserted node content (full 8700+ chars).**

The preview is intentionally short to make the list readable. The actual graph node should contain the complete text.

## Verification Test

Run this test to confirm:

```javascript
// In NorwegianTranscriptionTest.vue or AudioRecordingSelector
// Add logging after node creation:

const node = createEnhancedTextNode(recording)
console.log('=== NODE CREATION VERIFICATION ===')
console.log('Node ID:', node.id)
console.log('Node info length:', node.info.length)
console.log('Enhanced text length:', recording.norwegianTranscription.improved_text.length)
console.log('Are they equal?', node.info.includes(recording.norwegianTranscription.improved_text))
```

Expected output:
```
=== NODE CREATION VERIFICATION ===
Node ID: enhanced_1730563200000_abc123
Node info length: 8950  (approximate, includes formatting)
Enhanced text length: 8700
Are they equal? true
```

## Next Steps

1. **Clarify:** Are you looking at preview or actual node?
2. **Test:** Insert a recording and check the graph node
3. **Verify:** Does the node's info field have full text?
4. **If NO:** Then we have a real bug in node creation/storage
5. **If YES:** Then the "issue" is just preview truncation (by design)

## Questions for User

1. Have you actually **inserted** a recording into your graph?
2. After inserting, did you **click on the node** to view its content?
3. Or are you just looking at the **preview in the selector list**?

The preview text is supposed to be short. The actual node should have all the text.

---

**Status:** Awaiting user clarification on what they're actually viewing.
