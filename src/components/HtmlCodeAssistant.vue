<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="code-assistant-modal" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <div class="header-left">
          <h3>🤖 Code Assistant</h3>
          <span class="node-label">{{ nodeLabel }}</span>
        </div>
        <div class="header-controls">
          <select v-model="provider" class="provider-select" title="Select AI provider">
            <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select
            v-if="provider === 'openai'"
            v-model="openaiModel"
            class="model-select"
            title="Select OpenAI model"
          >
            <option v-for="opt in openaiModelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select
            v-if="provider === 'claude'"
            v-model="claudeModel"
            class="model-select"
            title="Select Claude model"
          >
            <option v-for="opt in claudeModelOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button @click="$emit('close')" class="btn-close" title="Close">&times;</button>
        </div>
      </div>

      <!-- Graph Context Indicator -->
      <div v-if="graphContextSummary" class="graph-context-bar">
        <span class="context-icon">📊</span>
        <span class="context-text">
          Graph context loaded: <strong>{{ graphContextSummary.totalNodes }} nodes</strong>
          <span v-if="graphId" class="graph-id">({{ graphId.substring(0, 8) }}...)</span>
        </span>
        <button @click="showGraphContext = !showGraphContext" class="context-toggle">
          {{ showGraphContext ? 'Hide' : 'Show' }} details
        </button>
      </div>

      <!-- Graph Context Details (Collapsible) -->
      <div v-if="showGraphContext && graphContextSummary" class="graph-context-details">
        <div class="context-section">
          <strong>Graph ID:</strong> <code>{{ graphContextSummary.graphId }}</code>
        </div>
        <div class="context-section">
          <strong>Node Fields:</strong> {{ graphContextSummary.nodeFields.join(', ') }}
        </div>
        <div v-if="graphContextSummary.availableNodeLabels.length > 0" class="context-section">
          <strong>Sample Labels:</strong>
          <ul class="label-list">
            <li v-for="label in graphContextSummary.availableNodeLabels.slice(0, 5)" :key="label">{{ label }}</li>
          </ul>
        </div>
      </div>

      <!-- Current Code (Collapsible) -->
      <div class="code-section">
        <div class="code-header-row">
          <button class="code-toggle" @click="showCurrentCode = !showCurrentCode">
            <span class="toggle-icon">{{ showCurrentCode ? '▼' : '▶' }}</span>
            Current Code ({{ lineCount }} lines)
          </button>
          <div class="code-actions">
            <button @click="copyFullCode" class="btn-action" title="Copy full code">
              📋 Copy
            </button>
          </div>
        </div>
        <div v-if="showCurrentCode" class="code-display">
          <pre><code>{{ htmlContent }}</code></pre>
        </div>
      </div>

      <!-- Detected Issues Banner -->
      <div v-if="detectedIssues.length > 0 && conversationHistory.length === 0" class="detected-issues">
        <div class="issues-header">
          <span class="issues-icon">⚠️</span>
          <strong>Potential issues detected:</strong>
        </div>
        <ul class="issues-list">
          <li v-for="(issue, idx) in detectedIssues" :key="idx">
            {{ issue }}
          </li>
        </ul>
        <button @click="askAboutIssues" class="btn btn-sm btn-warning ask-issues-btn">
          Ask AI to fix these issues
        </button>
      </div>

      <!-- Conversation Area -->
      <div class="conversation-area" ref="conversationArea">
        <div v-if="conversationHistory.length === 0" class="empty-state">
          <p>Describe your issue or what you want to change. I'll analyze the code and give you specific guidance.</p>
          <p class="examples">Examples:</p>
          <ul>
            <li>"The code doesn't find any nodes" (API field mismatch)</li>
            <li>"Add a loading spinner to the fetch function"</li>
            <li>"The menu highlighting doesn't update correctly"</li>
            <li>"Make the error messages more user-friendly"</li>
          </ul>
          <p class="hint">I understand the Vegvisr Knowledge Graph API and will check for common issues automatically.</p>
        </div>

        <div v-for="(message, index) in conversationHistory" :key="index" class="message" :class="message.role">
          <div class="message-header">
            <span class="message-icon">{{ message.role === 'user' ? '👤' : '🤖' }}</span>
            <span class="message-role">{{ message.role === 'user' ? 'You' : providerLabel }}</span>
          </div>
          <div class="message-content">
            <!-- For assistant messages, render the full markdown response -->
            <template v-if="message.role === 'assistant'">
              <div class="assistant-response" v-html="renderMarkdown(message.content)"></div>

              <!-- Show fix buttons for code replacements -->
              <div v-if="getCodeReplacements(message.content).length > 0" class="fix-actions">
                <div class="fix-actions-header">
                  <span>{{ getCodeReplacements(message.content).length }} code change(s) found</span>
                  <button
                    @click="applyAllFixes(message.content)"
                    class="btn btn-sm btn-success fix-all-btn"
                    title="Apply all fixes to the code"
                  >
                    ✅ Fix All
                  </button>
                </div>
                <div
                  v-for="(replacement, rIdx) in getCodeReplacements(message.content)"
                  :key="rIdx"
                  class="fix-item"
                >
                  <div class="fix-item-header">
                    <span class="fix-location">{{ replacement.location || `Fix #${rIdx + 1}` }}</span>
                    <button
                      @click="applySingleFix(replacement)"
                      class="btn btn-sm btn-outline-success"
                      title="Apply this fix"
                    >
                      🔧 Apply Fix
                    </button>
                  </div>
                  <div class="fix-preview">
                    <div class="fix-from">
                      <span class="fix-label">From:</span>
                      <code>{{ replacement.from.substring(0, 60) }}{{ replacement.from.length > 60 ? '...' : '' }}</code>
                    </div>
                    <div class="fix-to">
                      <span class="fix-label">To:</span>
                      <code>{{ replacement.to.substring(0, 60) }}{{ replacement.to.length > 60 ? '...' : '' }}</code>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Show copy buttons for each code block -->
              <div v-if="message.hasCodeSnippets" class="snippet-actions">
                <button
                  @click="copySnippetsToClipboard(message.content)"
                  class="btn btn-sm btn-outline-secondary"
                  title="Copy code snippets"
                >
                  📋 Copy Snippets
                </button>
              </div>
            </template>
            <template v-else>
              <div v-html="renderMarkdown(message.content)"></div>
            </template>
          </div>
        </div>

        <div v-if="isLoading" class="message assistant loading">
          <div class="message-header">
            <span class="message-icon">🤖</span>
            <span class="message-role">{{ providerLabel }}</span>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Changes Applied Banner -->
      <div v-if="hasUnsavedChanges" class="changes-banner">
        <span>⚡ You have unsaved changes</span>
        <button @click="saveAndClose" class="btn btn-sm btn-success">
          💾 Save & Close
        </button>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <textarea
          ref="inputTextarea"
          v-model="userInput"
          @keydown.enter.ctrl.prevent="sendMessage"
          @keydown.enter.meta.prevent="sendMessage"
          @keydown.escape="$emit('close')"
          placeholder="Type your code change request... (Ctrl+Enter to send)"
          :disabled="isLoading"
          rows="2"
        ></textarea>
        <div class="input-actions">
          <button
            v-if="conversationHistory.length > 0"
            @click="clearConversation"
            class="btn btn-outline-secondary clear-btn"
            title="Clear conversation"
          >
            🗑️
          </button>
          <button
            @click="sendMessage"
            class="btn btn-primary send-btn"
            :disabled="!userInput.trim() || isLoading"
          >
            {{ isLoading ? '...' : 'Send' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  htmlContent: {
    type: String,
    required: true
  },
  nodeId: {
    type: String,
    required: true
  },
  nodeLabel: {
    type: String,
    default: 'HTML Node'
  },
  graphId: {
    type: String,
    default: ''
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  }
})

const emit = defineEmits(['apply-changes', 'close'])

// Provider options (same as GrokChatPanel)
const providerOptions = [
  { value: 'grok', label: 'Grok' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'perplexity', label: 'Perplexity' }
]

const openaiModelOptions = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4', label: 'GPT-4' }
]

const claudeModelOptions = [
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
]

// State
const provider = ref('grok')
const openaiModel = ref('gpt-5.2')
const claudeModel = ref('claude-opus-4-5-20251101')
const showCurrentCode = ref(false)
const showGraphContext = ref(false)
const conversationHistory = ref([])
const userInput = ref('')
const isLoading = ref(false)
const conversationArea = ref(null)
const inputTextarea = ref(null)
const currentHtmlState = ref(props.htmlContent)

// Computed
const lineCount = computed(() => {
  return (props.htmlContent || '').split('\n').length
})

const providerLabel = computed(() => {
  const opt = providerOptions.find(o => o.value === provider.value)
  return opt ? opt.label : 'AI'
})

// Track if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  return currentHtmlState.value !== props.htmlContent
})

// Create a summary of the graph data for AI context
const graphContextSummary = computed(() => {
  if (!props.graphData || !props.graphData.nodes || props.graphData.nodes.length === 0) {
    return null
  }

  const nodes = props.graphData.nodes
  const sampleNode = nodes[0]

  // Get all unique field names from the first few nodes
  const allFields = new Set()
  nodes.slice(0, 5).forEach(node => {
    Object.keys(node).forEach(key => allFields.add(key))
  })

  // Create a sample of node labels for context
  const nodeLabels = nodes.slice(0, 10).map(n => n.label).filter(Boolean)

  return {
    graphId: props.graphId,
    totalNodes: nodes.length,
    nodeFields: Array.from(allFields),
    sampleNodeStructure: sampleNode ? {
      id: sampleNode.id,
      label: sampleNode.label,
      type: sampleNode.type,
      hasInfo: !!sampleNode.info,
      infoPreview: sampleNode.info ? sampleNode.info.substring(0, 100) + '...' : null
    } : null,
    availableNodeLabels: nodeLabels
  }
})

// Detect common issues in the code
const detectedIssues = computed(() => {
  const issues = []
  const code = props.htmlContent || ''

  // Check for wrong field names
  if (code.includes('node.title') && !code.includes('node.label')) {
    issues.push('Uses "node.title" but API returns "node.label"')
  }
  if (code.includes('node.fulltext')) {
    issues.push('Uses "node.fulltext" but API returns "node.info"')
  }
  if (code.includes('node.description') && !code.includes('node.info')) {
    issues.push('Uses "node.description" but API returns "node.info"')
  }

  // Check for wrong API parameter
  if (code.includes('?id=') && code.includes('getknowgraph')) {
    issues.push('Uses "?id=" but API expects "?graphId="')
  }

  // Check for MongoDB-style ID (24 hex chars) instead of UUID
  const mongoIdMatch = code.match(/GRAPH_ID\s*=\s*['"]([a-f0-9]{24})['"]/i)
  if (mongoIdMatch) {
    issues.push(`Graph ID "${mongoIdMatch[1]}" looks like MongoDB ObjectID, should be UUID format`)
  }

  return issues
})

// Auto-ask about detected issues
const askAboutIssues = () => {
  const issueText = detectedIssues.value.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
  userInput.value = `I have these issues in my code:\n${issueText}\n\nPlease show me exactly where to fix each one.`
  sendMessage()
}

// System prompt for code assistant - focused on snippets and guidance
// Enhanced with Vegvisr Knowledge Graph API context
const systemPrompt = `You are a code assistant helping debug and modify HTML/CSS/JavaScript code for the Vegvisr platform.

## VEGVISR KNOWLEDGE GRAPH API REFERENCE

When working with code that fetches data from the Vegvisr Knowledge Graph API, use this reference:

**API Endpoint:**
\`https://knowledge.vegvisr.org/getknowgraph\`

**Query Parameters:**
- \`graphId\` (required) - The UUID of the graph (NOT "id")
  Example: \`?graphId=81e55d4a-a2d1-456b-93e4-d548c7d70a2b\`
- \`nodeId\` (optional) - Fetch a specific node by ID
- \`nodeTitle\` (optional) - Search nodes by title

**IMPORTANT - Graph ID Format:**
- Graph IDs are UUIDs like: \`81e55d4a-a2d1-456b-93e4-d548c7d70a2b\`
- NOT MongoDB ObjectIDs like: \`6784be6a1d8e9f7e4f4b5b44\`

**Node Object Structure (what the API returns):**
\`\`\`javascript
{
  id: "node-uuid-here",
  label: "Node Title",        // USE THIS (not "title")
  info: "Node content...",    // USE THIS (not "fulltext" or "description")
  type: "html-node",
  x: 100,
  y: 200
}
\`\`\`

**COMMON MISTAKES TO CHECK:**
1. Using \`node.title\` instead of \`node.label\`
2. Using \`node.fulltext\` or \`node.description\` instead of \`node.info\`
3. Using \`?id=\` instead of \`?graphId=\`
4. Using wrong Graph ID format (MongoDB ObjectID vs UUID)

---

## YOUR JOB

1. ANALYZE the issue or request
2. EXPLAIN what's wrong or what needs to change
3. Give SPECIFIC code snippets (not the full document)
4. Tell the user EXACTLY WHERE to make the change (function name, line context, or section)

## RESPONSE FORMAT

1. **Analysis**: What's happening and why
2. **Solution**: What needs to change
3. **Location**: Where in the code (e.g., "In the loadWeek() function" or "At the top where GRAPH_ID is defined")
4. **Code snippet**: Only the relevant lines to add/modify/replace

## EXAMPLE RESPONSE

"**Analysis**: The code is using wrong field names. The API returns \`label\` and \`info\`, but the code uses \`title\` and \`fulltext\`.

**Solution**: Change the field names to match the API response.

**Location 1**: In the renderNodeContent() function

**Change this**:
\`\`\`javascript
if (node.title) {
  html += \`<h1>\${node.title}</h1>\`;
}
\`\`\`

**To this**:
\`\`\`javascript
if (node.label) {
  html += \`<h1>\${node.label}</h1>\`;
}
\`\`\`

**Location 2**: Same function, a few lines below

**Change this**:
\`\`\`javascript
if (node.fulltext) {
  html += formatContent(node.fulltext);
}
\`\`\`

**To this**:
\`\`\`javascript
if (node.info) {
  html += formatContent(node.info);
}
\`\`\`"

## IMPORTANT RULES

- NEVER return the complete HTML document
- Give small, focused snippets
- Always specify the exact location
- Check for common Vegvisr API mistakes first
- Explain your reasoning
- If you need more context about a specific function, ask
- Use \`\`\`javascript or \`\`\`css or \`\`\`html for code blocks`

// Get API endpoint based on provider (same as GrokChatPanel)
const getEndpoint = () => {
  const endpoints = {
    grok: 'https://grok.vegvisr.org/chat',
    openai: 'https://openai.vegvisr.org/chat',
    claude: 'https://anthropic.vegvisr.org/chat',
    gemini: 'https://gemini.vegvisr.org/chat',
    perplexity: 'https://perplexity.vegvisr.org/chat'
  }
  return endpoints[provider.value] || endpoints.grok
}

// Get selected model and max tokens based on provider
const getModelConfig = () => {
  const currentProvider = provider.value

  if (currentProvider === 'openai') {
    const model = openaiModel.value
    const maxTokens = model && model.startsWith('gpt-5') ? 32768 : 16384
    return { model, maxTokens, useMaxCompletionTokens: model && model.startsWith('gpt-5') }
  } else if (currentProvider === 'claude') {
    const model = claudeModel.value
    let maxTokens = 8192
    if (model === 'claude-opus-4-5-20251101') maxTokens = 16384
    else if (model === 'claude-sonnet-4-5-20250929') maxTokens = 64000
    else if (model === 'claude-haiku-4-5-20251001') maxTokens = 8192
    return { model, maxTokens, useMaxCompletionTokens: false }
  } else if (currentProvider === 'grok') {
    return { model: 'grok-3', maxTokens: 32000, useMaxCompletionTokens: false }
  } else if (currentProvider === 'perplexity') {
    return { model: 'sonar', maxTokens: 16384, useMaxCompletionTokens: false }
  } else if (currentProvider === 'gemini') {
    return { model: undefined, maxTokens: undefined, useMaxCompletionTokens: false }
  }
  return { model: 'grok-3', maxTokens: 32000, useMaxCompletionTokens: false }
}

// Build request payload based on provider (same structure as GrokChatPanel)
const buildPayload = (userMessage) => {
  const currentCode = currentHtmlState.value
  const currentProvider = provider.value
  const { model, maxTokens, useMaxCompletionTokens } = getModelConfig()

  // Build the context with graph data if available
  let contextInfo = `Current HTML:\n\`\`\`html\n${currentCode}\n\`\`\`\n\n`

  // Add graph context if available
  if (graphContextSummary.value) {
    const ctx = graphContextSummary.value
    contextInfo += `## CURRENT GRAPH CONTEXT\n\n`
    contextInfo += `**Graph ID:** \`${ctx.graphId}\`\n`
    contextInfo += `**Total Nodes:** ${ctx.totalNodes}\n`
    contextInfo += `**Available Fields on Nodes:** ${ctx.nodeFields.join(', ')}\n\n`

    if (ctx.sampleNodeStructure) {
      contextInfo += `**Sample Node Structure:**\n\`\`\`json\n${JSON.stringify(ctx.sampleNodeStructure, null, 2)}\n\`\`\`\n\n`
    }

    if (ctx.availableNodeLabels.length > 0) {
      contextInfo += `**Available Node Labels (first 10):**\n`
      ctx.availableNodeLabels.forEach(label => {
        contextInfo += `- "${label}"\n`
      })
      contextInfo += '\n'
    }
  }

  contextInfo += `Request: ${userMessage}`

  // Build conversation messages
  const grokMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextInfo }
  ]

  // Add conversation history
  conversationHistory.value.forEach(msg => {
    if (msg.role === 'user') {
      grokMessages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      grokMessages.push({ role: 'assistant', content: msg.fullContent || msg.content })
    }
  })

  // Build request body (same structure as GrokChatPanel)
  let requestBody = {
    userId: 'code-assistant',
    temperature: 0.7,
    stream: false
  }

  if (model) {
    requestBody.model = model
  }

  if (typeof maxTokens === 'number') {
    if (useMaxCompletionTokens) {
      requestBody.max_completion_tokens = maxTokens
    } else {
      requestBody.max_tokens = maxTokens
    }
  }

  // Claude needs system message as separate parameter
  if (currentProvider === 'claude') {
    const systemMsg = grokMessages.find(m => m.role === 'system')
    const nonSystemMessages = grokMessages.filter(m => m.role !== 'system')
    requestBody.messages = nonSystemMessages
    if (systemMsg) {
      requestBody.system = systemMsg.content
    }
  } else {
    requestBody.messages = grokMessages
  }

  return requestBody
}

// Parse AI response - check if it contains code snippets
const parseResponse = (responseText) => {
  // Check if response contains code blocks (snippets)
  const codeBlockRegex = /```(?:javascript|js|css|html)?\s*[\s\S]*?```/gi
  const hasCodeSnippets = codeBlockRegex.test(responseText)

  return {
    content: responseText,
    hasCodeSnippets
  }
}

// Extract all code snippets from a message
const extractCodeSnippets = (content) => {
  const snippets = []
  const regex = /```(?:javascript|js|css|html)?\s*([\s\S]*?)```/gi
  let match
  while ((match = regex.exec(content)) !== null) {
    snippets.push(match[1].trim())
  }
  return snippets
}

// Copy all code snippets to clipboard
const copySnippetsToClipboard = async (content) => {
  const snippets = extractCodeSnippets(content)
  if (snippets.length === 0) return

  const text = snippets.join('\n\n// ---\n\n')
  try {
    await navigator.clipboard.writeText(text)
    alert('Code snippets copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
    // Fallback
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Code snippets copied to clipboard!')
  }
}

// Copy full HTML code to clipboard
const copyFullCode = async () => {
  try {
    await navigator.clipboard.writeText(props.htmlContent)
    alert('Full code copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
    const textArea = document.createElement('textarea')
    textArea.value = props.htmlContent
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('Full code copied to clipboard!')
  }
}

// Clear conversation history
const clearConversation = () => {
  if (confirm('Clear the conversation history?')) {
    conversationHistory.value = []
  }
}

// Parse AI response to find "Change this / To this" code replacement pairs
const getCodeReplacements = (content) => {
  const replacements = []

  // Pattern 1: "Change this:" followed by code block, then "To this:" followed by code block
  const pattern1 = /\*\*(?:Change this|Before)\*\*:?\s*```(?:javascript|js|html|css)?\s*([\s\S]*?)```\s*\*\*(?:To this|After)\*\*:?\s*```(?:javascript|js|html|css)?\s*([\s\S]*?)```/gi

  // Pattern 2: Location headers like "**Location 1**:" or "In the function()"
  const locationPattern = /\*\*Location\s*\d*\*\*:?\s*(?:In the\s+)?`?([^`\n]+)`?/gi

  let match
  let locations = []

  // Extract locations first
  while ((match = locationPattern.exec(content)) !== null) {
    locations.push(match[1].trim())
  }

  // Reset and find code pairs
  let pairIndex = 0
  while ((match = pattern1.exec(content)) !== null) {
    replacements.push({
      from: match[1].trim(),
      to: match[2].trim(),
      location: locations[pairIndex] || null
    })
    pairIndex++
  }

  // If no pairs found with pattern 1, try simpler pattern
  if (replacements.length === 0) {
    // Look for consecutive code blocks that might be before/after
    const codeBlocks = []
    const blockRegex = /```(?:javascript|js|html|css)?\s*([\s\S]*?)```/gi
    while ((match = blockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim())
    }

    // Check for "Change this" or "To this" keywords near code blocks
    const changeThisMatch = content.match(/\*\*Change this\*\*:?\s*```(?:javascript|js|html|css)?\s*([\s\S]*?)```/i)
    const toThisMatch = content.match(/\*\*To this\*\*:?\s*```(?:javascript|js|html|css)?\s*([\s\S]*?)```/i)

    if (changeThisMatch && toThisMatch) {
      replacements.push({
        from: changeThisMatch[1].trim(),
        to: toThisMatch[1].trim(),
        location: locations[0] || null
      })
    }
  }

  return replacements
}

// Apply a single fix to the current HTML
const applySingleFix = (replacement) => {
  const currentCode = currentHtmlState.value
  const fromCode = replacement.from

  // Try to find and replace the code
  if (currentCode.includes(fromCode)) {
    currentHtmlState.value = currentCode.replace(fromCode, replacement.to)
    alert('Fix applied! Remember to save your changes.')
  } else {
    // Try with normalized whitespace
    const normalizedFrom = fromCode.replace(/\s+/g, ' ').trim()
    const normalizedCurrent = currentCode.replace(/\s+/g, ' ')

    if (normalizedCurrent.includes(normalizedFrom)) {
      // Find the actual position and replace
      alert('Code found but whitespace differs. Please apply manually or copy the snippet.')
    } else {
      alert('Could not find the exact code to replace. The code may have already been changed, or the pattern doesn\'t match exactly.')
    }
  }
}

// Apply all fixes from a message
const applyAllFixes = (content) => {
  const replacements = getCodeReplacements(content)
  if (replacements.length === 0) {
    alert('No code replacements found in this message.')
    return
  }

  let appliedCount = 0
  let currentCode = currentHtmlState.value

  for (const replacement of replacements) {
    if (currentCode.includes(replacement.from)) {
      currentCode = currentCode.replace(replacement.from, replacement.to)
      appliedCount++
    }
  }

  if (appliedCount > 0) {
    currentHtmlState.value = currentCode
    alert(`Applied ${appliedCount} of ${replacements.length} fixes! Click "Save & Close" to keep changes.`)
  } else {
    alert('Could not apply any fixes. The code patterns may not match exactly.')
  }
}

// Save changes and close
const saveAndClose = () => {
  emit('apply-changes', currentHtmlState.value)
}

// Send message to AI
const sendMessage = async () => {
  const message = userInput.value.trim()
  if (!message || isLoading.value) return

  // Add user message to history
  conversationHistory.value.push({
    role: 'user',
    content: message
  })

  userInput.value = ''
  isLoading.value = true

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  try {
    const endpoint = getEndpoint()
    const requestBody = buildPayload(message)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract response text based on provider response format (same as GrokChatPanel)
    let responseText = ''
    if (data.content) {
      // Claude format
      if (Array.isArray(data.content)) {
        responseText = data.content.map(c => c.text || '').join('')
      } else {
        responseText = data.content
      }
    } else if (data.choices && data.choices[0]) {
      // OpenAI/Grok format
      responseText = data.choices[0].message?.content || data.choices[0].text || ''
    } else if (data.result) {
      responseText = data.result
    } else if (typeof data === 'string') {
      responseText = data
    }

    // Parse the response
    const parsed = parseResponse(responseText)

    // Add assistant message to history
    conversationHistory.value.push({
      role: 'assistant',
      content: parsed.content,
      hasCodeSnippets: parsed.hasCodeSnippets
    })

  } catch (error) {
    console.error('Code Assistant error:', error)
    conversationHistory.value.push({
      role: 'assistant',
      content: `Error: ${error.message}. Please try again.`,
      hasCodeSnippets: false
    })
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

// Scroll conversation to bottom
const scrollToBottom = () => {
  if (conversationArea.value) {
    conversationArea.value.scrollTop = conversationArea.value.scrollHeight
  }
}

// Simple markdown renderer
const renderMarkdown = (text) => {
  if (!text) return ''
  try {
    return marked.parse(text)
  } catch {
    return text
  }
}

// Watch for content changes
watch(() => props.htmlContent, (newVal) => {
  currentHtmlState.value = newVal
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  backdrop-filter: blur(4px);
}

.code-assistant-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90vw;
  max-width: 900px;
  height: 85vh;
  max-height: 800px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.node-label {
  color: #6b7280;
  font-size: 14px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-select,
.model-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.provider-select:focus,
.model-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.btn-close:hover {
  color: #111827;
}

/* Graph Context Bar */
.graph-context-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-bottom: 1px solid #10b981;
  font-size: 13px;
  color: #065f46;
}

.context-icon {
  font-size: 16px;
}

.context-text {
  flex: 1;
}

.graph-id {
  color: #047857;
  font-size: 12px;
  margin-left: 4px;
}

.context-toggle {
  background: none;
  border: 1px solid #10b981;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #065f46;
  cursor: pointer;
  transition: all 0.2s;
}

.context-toggle:hover {
  background: #10b981;
  color: white;
}

.graph-context-details {
  padding: 12px 20px;
  background: #f0fdf4;
  border-bottom: 1px solid #bbf7d0;
  font-size: 13px;
}

.context-section {
  margin-bottom: 8px;
  color: #166534;
}

.context-section:last-child {
  margin-bottom: 0;
}

.context-section code {
  background: #dcfce7;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #15803d;
}

.label-list {
  margin: 4px 0 0 20px;
  padding: 0;
  list-style: disc;
}

.label-list li {
  margin: 2px 0;
  color: #166534;
}

/* Detected Issues Banner */
.detected-issues {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 16px 20px;
  margin: 16px 20px 0 20px;
}

.issues-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #92400e;
}

.issues-icon {
  font-size: 18px;
}

.issues-list {
  margin: 0 0 12px 0;
  padding-left: 24px;
}

.issues-list li {
  color: #78350f;
  font-size: 14px;
  margin-bottom: 6px;
  line-height: 1.5;
}

.ask-issues-btn {
  background: #f59e0b;
  border-color: #d97706;
  color: white;
  font-weight: 500;
}

.ask-issues-btn:hover {
  background: #d97706;
  border-color: #b45309;
}

.code-section {
  border-bottom: 1px solid #e5e7eb;
}

.code-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f3f4f6;
}

.code-actions {
  padding-right: 12px;
}

.btn-action {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.code-toggle {
  flex: 1;
  padding: 12px 20px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.code-toggle:hover {
  background: #e5e7eb;
}

.toggle-icon {
  font-size: 10px;
  color: #6b7280;
}

.code-display {
  max-height: 200px;
  overflow: auto;
  background: #1e1e1e;
}

.code-display pre {
  margin: 0;
  padding: 12px 20px;
}

.code-display code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #d4d4d4;
  white-space: pre;
}

.conversation-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafafa;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 40px 20px;
}

.empty-state p {
  margin: 0 0 16px 0;
}

.empty-state .examples {
  font-weight: 600;
  color: #374151;
}

.empty-state ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 16px 0;
}

.empty-state li {
  padding: 8px 16px;
  margin: 4px 0;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  font-size: 14px;
  color: #4b5563;
}

.empty-state .hint {
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.message {
  margin-bottom: 16px;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.message-icon {
  font-size: 16px;
}

.message-role {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.message-content {
  padding-left: 28px;
}

.message.user .message-content {
  background: #eff6ff;
  padding: 12px 16px;
  border-radius: 12px;
  color: #1e40af;
  margin-left: 28px;
}

.message.assistant .message-content {
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  margin-left: 28px;
}

/* Assistant response styling */
.assistant-response {
  color: #374151;
  line-height: 1.7;
}

.assistant-response :deep(p) {
  margin: 0 0 12px 0;
}

.assistant-response :deep(strong) {
  color: #111827;
}

.assistant-response :deep(pre) {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 12px 0;
  overflow-x: auto;
}

.assistant-response :deep(code) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.assistant-response :deep(pre code) {
  color: #d4d4d4;
  background: none;
  padding: 0;
}

.assistant-response :deep(:not(pre) > code) {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  color: #dc2626;
  font-size: 13px;
}

.assistant-response :deep(ul),
.assistant-response :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.assistant-response :deep(li) {
  margin: 4px 0;
}

/* Fix Actions */
.fix-actions {
  margin-top: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #10b981;
  border-radius: 8px;
}

.fix-actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #a7f3d0;
  font-weight: 600;
  color: #065f46;
}

.fix-all-btn {
  background: #10b981;
  border-color: #059669;
  font-weight: 600;
}

.fix-all-btn:hover {
  background: #059669;
  border-color: #047857;
}

.fix-item {
  background: white;
  border: 1px solid #d1fae5;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
}

.fix-item:last-child {
  margin-bottom: 0;
}

.fix-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.fix-location {
  font-size: 13px;
  color: #047857;
  font-weight: 500;
}

.fix-preview {
  font-size: 12px;
}

.fix-from,
.fix-to {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.fix-label {
  color: #6b7280;
  min-width: 40px;
  font-weight: 500;
}

.fix-from code {
  background: #fef2f2;
  color: #dc2626;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
}

.fix-to code {
  background: #ecfdf5;
  color: #059669;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  word-break: break-all;
}

.snippet-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.explanation {
  margin-bottom: 12px;
  color: #374151;
  line-height: 1.6;
}

.explanation :deep(p) {
  margin: 0 0 8px 0;
}

.code-response {
  margin-top: 12px;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #1e1e1e;
  border-radius: 8px 8px 0 0;
  color: #9ca3af;
  font-size: 12px;
}

.apply-btn {
  font-size: 12px;
  padding: 4px 12px;
}

.code-block {
  margin: 0;
  padding: 12px;
  background: #1e1e1e;
  border-radius: 0 0 8px 8px;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.code-block code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #d4d4d4;
  white-space: pre;
}

.code-block :deep(.line-added) {
  background: rgba(34, 197, 94, 0.2);
  display: block;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.6;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Changes Banner */
.changes-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-top: 1px solid #f59e0b;
  color: #92400e;
  font-weight: 500;
  font-size: 14px;
}

.changes-banner .btn-success {
  background: #10b981;
  border-color: #059669;
}

.input-area {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.input-area textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
}

.input-area textarea:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.input-area textarea:disabled {
  background: #f3f4f6;
}

.input-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.send-btn {
  padding: 12px 24px;
  font-weight: 600;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn {
  padding: 8px 12px;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 640px) {
  .code-assistant-modal {
    width: 100%;
    height: 100%;
    max-height: 100%;
    border-radius: 0;
  }

  .modal-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-controls {
    flex-wrap: wrap;
  }

  .node-label {
    display: none;
  }
}
</style>
