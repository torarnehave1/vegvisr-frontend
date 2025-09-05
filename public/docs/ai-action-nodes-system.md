# AI Action Nodes System Documentation

## Overview

The AI Action Nodes system in GraphViewer enables users to create interactive nodes that can call different AI endpoints and automatically generate new content nodes from AI responses. This system bridges the frontend graph visualization with backend AI processing capabilities.

## System Architecture

### Frontend Components

**GraphViewer.vue** (Primary Interface)

- Renders `action_test` type nodes with special styling
- Displays endpoint URL in the `label` field
- Shows question/prompt in the `info` field
- **🆕 AI Provider Dropdown** - Easy selection from 5 AI endpoints with icons
- Provides "Get Response" button for authorized users
- **Automatic endpoint URL update** when dropdown selection changes
- Handles AI response processing and new node creation

**Key Frontend Functions:**

```javascript
// Main AI response handler
handleGetAIResponse(node)
- Validates node data (endpoint URL + prompt)
- Shows loading spinner with endpoint name
- Calls testEndpoint() function
- Creates new fulltext node from AI response
- Saves updated graph to backend

// Generic endpoint testing
testEndpoint(endpoint, content)
- Makes POST request to specified endpoint
- Sends prompt in JSON body: {prompt: content}
- Returns parsed JSON response
```

### Backend Components

**api-worker/index.js** (AI Processing)

- Handles 3 different AI endpoint routes (Grok, Gemini, Generic AI)
- Manages API keys for different providers
- Returns structured node data format
- Provides CORS headers for frontend access

**dev-worker/index.js** (Cloudflare Workers AI)

- Handles Cloudflare Workers AI endpoint (`/generate-worker-ai`)
- Uses built-in `env.AI` binding (no external API keys needed)
- Returns structured response data
- Provides CORS headers for frontend access

## AI Provider Endpoints

### 1. 🔥 Cloudflare Workers AI - `/generate-worker-ai`

**Model:** `@cf/meta/llama-3.1-8b-instruct`  
**API Key:** Built-in `env.AI` binding (no external API key needed)  
**Base URL:** `https://knowledge.vegvisr.org`

**Features:**

- Built-in Cloudflare Workers AI (fastest & most cost-effective)
- No external API dependencies or costs
- Meta's Llama 3.1 8B Instruct model
- Direct AI binding integration
- Orange gradient styling with 🔥 icon

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
// OR
{
  "userPrompt": "Your question or topic"
}
```

**Response Format:**

```json
{
  "success": true,
  "code": "AI generated response",
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "prompt": "original prompt",
  "timestamp": "ISO timestamp"
}
```

### 2. Grok AI (X.AI) - `/groktest`

**Model:** `grok-3-beta`  
**API Key:** `env.XAI_API_KEY`  
**Base URL:** `https://api.x.ai/v1`

**Features:**

- Philosophical AI providing deep insights
- Generates main content + bibliographic references
- Two-stage generation process
- APA format bibliography

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
```

**Response Format:**

```json
{
  "id": "fulltext_${timestamp}",
  "label": "Summary",
  "type": "fulltext",
  "info": "AI generated content",
  "color": "#f9f9f9",
  "bibl": ["APA formatted references"]
}
```

### 3. Google Gemini - `/gemini-test`

**Model:** `gemini-2.0-flash`  
**API Key:** `env.GOOGLE_GEMINI_API_KEY`  
**Base URL:** `https://generativelanguage.googleapis.com/v1beta/models/`

**Features:**

- Fast and efficient responses
- Accepts both `text` and `prompt` parameters
- Direct Google API integration

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
// OR
{
  "text": "Your question or topic"
}
```

**Response Format:**

```json
{
  "id": "gemini_${timestamp}",
  "label": "Gemini Response",
  "type": "fulltext",
  "info": "AI generated content",
  "color": "#e8f4fd",
  "model": "gemini-2.0-flash",
  "prompt": "original prompt"
}
```

### 4. 🧠 Claude AI (Anthropic) - `/claude-test`

**Model:** `claude-3-5-sonnet-20241022`  
**API Key:** `env.ANTHROPIC_API_KEY`  
**Base URL:** `https://api.anthropic.com/v1`

**Features:**

 - Advanced reasoning and analytical capabilities
- High-quality structured responses
- Context-aware processing with graph integration
- Supports fulltext, action, and both return types

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
```

**Response Format:**

```json
{
  "id": "claude_${timestamp}",
  "label": "Claude Answer",
  "type": "fulltext",
  "info": "AI generated content",
  "color": "#f4e5d3",
  "model": "claude-3-5-sonnet",
  "prompt": "original prompt"
}
```

### 5. 🧩 GPT-4 (OpenAI) - `/gpt-4-test`

**Model:** `gpt-4`  
**API Key:** `env.OPENAI_API_KEY`  
**Base URL:** `https://api.openai.com/v1`

**Features:**

- Structured reasoning and problem-solving
- Excellent for complex analysis and detailed explanations
- High accuracy in logical thinking
- Supports fulltext, action, and both return types

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
```

**Response Format:**

```json
{
  "id": "gpt4_${timestamp}",
  "label": "GPT-4 Answer",
  "type": "fulltext",
  "info": "AI generated content",
  "color": "#e8f4fd",
  "model": "gpt-4",
  "prompt": "original prompt"
}
```

### 6. 🚀 GPT-5 (OpenAI) - `/gpt-5-test`

**Model:** `gpt-5` (fallback to gpt-4o if unavailable)  
**API Key:** `env.OPENAI_API_KEY`  
**Base URL:** `https://api.openai.com/v1`

**Features:**

- Next generation AI with enhanced capabilities
- Superior reasoning and creative problem solving
- Advanced context understanding
- Supports fulltext, action, and both return types

**Request Format:**

```json
{
  "prompt": "Your question or topic"
}
```

**Response Format:**

```json
{
  "id": "gpt5_${timestamp}",
  "label": "GPT-5 Answer",
  "type": "fulltext",
  "info": "AI generated content",
  "color": "#f0f8ff",
  "model": "gpt-5",
  "prompt": "original prompt"
}
```

### 7. Generic AI Action - `/aiaction`

### 5. Generic AI Action - `/aiaction`

**Providers:** X.AI, OpenAI, Google  
**Purpose:** Flexible AI endpoint with custom response formatting

**Features:**

- Multiple AI provider support
- Custom response format configuration
- Configurable model parameters
- Advanced prompt engineering

**Request Format:**

```json
{
  "prompt": "User input",
  "instructions": "System instructions",
  "baseURL": "https://api.provider.com/v1",
  "model": "model-name",
  "temperature": 0.7,
  "max_tokens": 2000,
  "apiProvider": "xai|openai|google",
  "response_format": {
    "label": "Custom Label",
    "type": "fulltext",
    "color": "#custom-color",
    "additional_fields": {}
  }
}
```

## Usage Examples

### Creating an Action Node

**Method 1: Manual Creation**

```javascript
const actionNode = {
  id: 'action_' + Date.now(),
  label: 'https://knowledge.vegvisr.org/generate-worker-ai', // Cloudflare Workers AI
  info: 'What are the philosophical implications of AI?', // Prompt
  type: 'action_test',
  color: '#ff9500', // Orange gradient for 🔥 Cloudflare AI
  visible: true,
}
```

**🆕 Dropdown Selection (New Feature):**
Instead of manually entering endpoint URLs, users can now:

1. **Select from dropdown** - Choose from 5 pre-configured AI providers
2. **Visual indicators** - Each provider has distinct icons and descriptions
3. **Auto-save** - Endpoint changes are automatically saved to backend
4. **Real-time updates** - UI reflects changes immediately

**Method 2: Through GraphAdmin Interface**

- Add new node
- Set type to `action_test`
- Enter endpoint URL in label field
- Enter question/prompt in info field

### Supported Endpoint URLs

**🆕 Available in Dropdown Menu:**

```
🔥 Cloudflare Workers AI (Fast & Free)    - https://knowledge.vegvisr.org/generate-worker-ai
🧠 Claude AI (Advanced Reasoning)          - https://api.vegvisr.org/claude-test
🤔 Grok AI (Philosophical Insights)        - https://api.vegvisr.org/groktest
⚡ Google Gemini (Fast Responses)           - https://api.vegvisr.org/gemini-test
🧩 GPT-4 (Structured Reasoning)            - https://api.vegvisr.org/gpt-4-test
🚀 GPT-5 (Next Generation AI)              - https://api.vegvisr.org/gpt-5-test
⚙️ Generic AI (Custom Formatting)          - https://api.vegvisr.org/aiaction
```

**Manual Entry:** Users can still manually enter endpoint URLs in the `label` field if needed.

### Frontend Integration Example

```vue
<template v-else-if="node.type === 'action_test'">
  <div class="action-test-content">
    <div class="endpoint-info"><strong>Endpoint:</strong> {{ node.label }}</div>
    <div class="question-info"><strong>Question:</strong> {{ node.info }}</div>
    <button
      @click="handleGetAIResponse(node)"
      :disabled="isActionTestLoading"
      class="ai-response-btn"
    >
      Get AI Response
    </button>
  </div>
</template>
```

## Data Flow Process

```
1. User creates action_test node
   ├── label: endpoint URL
   └── info: question/prompt

2. User clicks "Get AI Response"
   └── handleGetAIResponse(node) triggered

3. Frontend validation
   ├── Check node.label (endpoint URL)
   └── Check node.info (prompt text)

4. API call via testEndpoint()
   ├── POST to endpoint URL
   ├── Body: {prompt: node.info}
   └── Headers: Content-Type: application/json

5. Backend processing
   ├── Route to appropriate handler
   ├── Validate API key for provider
   ├── Call AI provider API
   └── Format response as node structure

6. Frontend receives structured response
   ├── Validate response format
   ├── Create new fulltext node
   ├── Add to graph data
   └── Save to backend

7. New AI-generated node appears in graph
   ├── Contains AI response in info field
   ├── Includes metadata (color, type, etc.)
   └── Optionally includes bibliography
```

## Node Control Bar Integration

Action test nodes get special UI treatment:

```vue
<div v-if="nodeType === 'action_test'" class="control-group ai-group">
  <!-- Special controls for AI action nodes -->
  <button @click="handleGetAIResponse(node)">
    🤖 Get AI Response
  </button>
</div>
```

## Error Handling

**Frontend Validation:**

- Checks for valid endpoint URL in label
- Validates prompt text in info field
- Shows user-friendly error messages

**Backend Error Responses:**

- Missing API keys → 500 Internal Server Error
- Invalid JSON → 400 Bad Request
- API provider errors → 500 with provider details
- Invalid prompt → 400 Bad Request

**Loading States:**

- Shows spinner during API calls
- Displays endpoint name being called
- Prevents duplicate requests
- Timeout handling for slow responses

## Security Considerations

**Authorization:**

- Only Admin/Superadmin users can trigger AI responses
- API keys stored as environment variables
- CORS headers properly configured

**Input Validation:**

- Prompt text sanitized before API calls
- Endpoint URLs validated against allowed patterns
- Response content validated before node creation

## Performance Notes

**Response Times:**

- 🔥 Cloudflare Workers AI: ~1-3 seconds (built-in, fastest & most cost-effective)
- 🧠 Claude AI: ~2-4 seconds (high quality, advanced reasoning)
- Grok: ~3-5 seconds (includes bibliography generation)
- Gemini: ~1-2 seconds (fast external API)
- 🧩 GPT-4: ~2-3 seconds (structured reasoning, reliable)
- 🚀 GPT-5: ~2-4 seconds (next generation AI, enhanced capabilities)
- Generic AI: Variable based on provider and model

**Rate Limiting:**

- Handled by individual AI providers
- Frontend prevents rapid successive calls
- Loading states prevent user confusion

## Future Enhancements

**Potential Improvements:**

- Support for more AI providers (Claude, etc.)
- Custom system prompts per action node
- Response caching mechanisms
- Batch processing multiple action nodes
- Custom response templates
- Integration with RAG (Retrieval-Augmented Generation)

## 🆕 NEW: Three-Way Return Type System

### Overview

The AI Action Nodes system now supports three different response formats through a new "Return Type" dropdown:

1. **📄 Fulltext (Final Answer)** - Creates a single fulltext node (ends conversation)
2. **🔄 Action (Continue Chain)** - Creates a single action_test node (continues AI chain)
3. **📄+🔄 Both (Answer + Follow-up)** - Creates both fulltext and action nodes

### UI Components

**New Return Type Dropdown:**

```vue
<div class="ai-return-type-selector">
  <label for="return-type-select">📋 Return Type:</label>
  <select v-model="selectedReturnType" @change="updateReturnType">
    <option value="fulltext">📄 Fulltext (Final Answer)</option>
    <option value="action">🔄 Action (Continue Chain)</option>
    <option value="both">📄+🔄 Both (Answer + Follow-up)</option>
  </select>
</div>
```

### Backend Implementation

**Updated Request Format:**
All AI endpoints now accept an optional `returnType` parameter:

```json
{
  "prompt": "Your question or topic",
  "returnType": "fulltext|action|both" // Optional, defaults to "fulltext"
}
```

**Response Formats:**

**Fulltext Response (Default):**

```json
{
  "id": "fulltext_123",
  "label": "AI Answer",
  "type": "fulltext",
  "info": "AI generated response...",
  "color": "#e8f4fd"
}
```

**Action Response:**

```json
{
  "id": "action_123",
  "label": "https://api.vegvisr.org/groktest",
  "type": "action_test",
  "info": "AI generated response...",
  "color": "#ffe6cc"
}
```

**Both Response:**

```json
{
  "type": "both",
  "fulltext": {
    "id": "fulltext_123",
    "label": "AI Answer",
    "type": "fulltext",
    "info": "AI response content...",
    "color": "#e8f4fd"
  },
  "action": {
    "id": "action_124",
    "label": "https://api.vegvisr.org/groktest",
    "type": "action_test",
    "info": "What aspects would you like to explore further?",
    "color": "#ffe6cc"
  }
}
```

### Follow-Up Question Generation

When `returnType: "both"` is used, AI endpoints automatically generate intelligent follow-up questions:

**Grok AI:**

```javascript
// Generates philosophical follow-up questions
const followUpCompletion = await client.chat.completions.create({
  model: 'grok-3-beta',
  messages: [
    {
      role: 'system',
      content: 'Generate ONE thoughtful follow-up question that would lead to deeper insights.',
    },
  ],
})
```

**Cloudflare Workers AI:**

```javascript
// Generates technical enhancement questions
const followUpPrompt = `Based on this generated code, create ONE brief follow-up question 
that would help the user enhance or expand this Cloudflare Worker.`
```

### Usage Examples

**Testing with CURL:**

```bash
# Get final answer only
curl -X POST "https://api.vegvisr.org/groktest" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is consciousness?", "returnType": "fulltext"}'

# Continue conversation chain
curl -X POST "https://api.vegvisr.org/groktest" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is consciousness?", "returnType": "action"}'

# Get both answer and follow-up
curl -X POST "https://api.vegvisr.org/groktest" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is consciousness?", "returnType": "both"}'
```

### Benefits

1. **Conversation Continuity**: Action chains enable ongoing AI discussions
2. **Flexible Endings**: Users choose when to end conversations with fulltext
3. **Maximum Value**: "Both" option provides answers AND exploration paths
4. **Persistent Context**: Return type saved per node for consistency

## Troubleshooting

**Common Issues:**

1. **"Action test node must have a valid endpoint URL"**

   - Ensure label field contains full endpoint URL
   - Check that info field has prompt text

2. **"AI API error" responses**

   - Verify API keys are configured in environment
   - Check network connectivity to AI providers
   - Validate request format matches provider expectations

3. **Empty or malformed responses**

   - AI provider may be experiencing issues
   - Check browser console for detailed error messages
   - Verify response format validation logic

4. **🆕 "Both" type validation errors**
   - Check that both fulltext and action objects are present
   - Verify follow-up question generation succeeded
   - Ensure proper node structure for dual responses

**Debug Mode:**
Enable console logging to trace the full request/response cycle:

```javascript
console.log('Action test node:', node)
console.log('Endpoint URL:', node.label)
console.log('Return type:', node.returnType || 'fulltext')
console.log('AI response received:', result)
console.log('Creating nodes:', newNodes.length)
```

---

This AI action node system provides a powerful way to integrate multiple AI providers directly into the knowledge graph workflow, enabling dynamic content generation, conversation chains, and exploration of topics through different AI perspectives with flexible response formats.
