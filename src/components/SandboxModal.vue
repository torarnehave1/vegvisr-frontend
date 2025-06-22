<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content sandbox-modal" @click.stop>
      <div class="modal-header">
        <h2>🧪 RAG Sandbox Creator</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button
          :class="['tab-btn', { active: activeTab === 'create' }]"
          @click="activeTab = 'create'"
        >
          🚀 Create Sandbox
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'test' }]"
          @click="activeTab = 'test'"
          :disabled="!sandboxResult"
        >
          🧪 Test Sandbox
        </button>
      </div>

      <!-- Create Tab Content -->
      <div v-if="activeTab === 'create'" class="step">
        <h3>🧠 Create RAG-Enabled Sandbox</h3>

        <div class="info-message">
          <p>
            This will create a temporary RAG-enabled sandbox environment from your knowledge graph
            data.
          </p>

          <div class="stats">
            <div class="stat-item">
              📄 <strong>{{ graphNodeCount }}</strong> nodes will be indexed
            </div>
            <div class="stat-item">🧠 Vector embeddings will be created for RAG queries</div>
            <div class="stat-item">⏱️ Sandbox expires in 4 hours</div>
          </div>
        </div>

        <div class="step-actions">
          <button @click="createSandbox" class="primary-btn" :disabled="isCreating">
            <span v-if="isCreating">🔄 Creating...</span>
            <span v-else>🚀 Create RAG Sandbox</span>
          </button>
        </div>

        <div v-if="sandboxResult" class="sandbox-result">
          <h4>✅ Sandbox Created Successfully!</h4>
          <div class="sandbox-info">
            <strong>URL:</strong>
            <a :href="sandboxResult.url" target="_blank">{{ sandboxResult.url }}</a>
          </div>
          <div class="code-examples-section">
            <h5>Suggested Code Examples from Knowledge Graph</h5>
            <div v-if="isLoadingExamples">Loading code examples...</div>
            <div v-else-if="codeExamples.length === 0">No code examples found for this graph.</div>
            <ul v-else class="code-example-list">
              <li
                v-for="(example, idx) in codeExamples"
                :key="example.id"
                class="code-example-item"
              >
                <label>
                  <input type="checkbox" v-model="selectedExampleIds" :value="example.id" />
                  <strong>{{ example.title }}</strong> <span>({{ example.language }})</span>
                </label>
                <div class="example-description">{{ example.description }}</div>
                <pre
                  class="example-preview">{{ example.code.slice(0, 200) }}<span v-if="example.code.length > 200">...</span></pre>
              </li>
            </ul>
          </div>
          <div class="test-section">
            <h5>Test RAG Query:</h5>
            <textarea
              v-model="testQuery"
              placeholder="Ask about your knowledge graph..."
            ></textarea>
            <button @click="testRAG" :disabled="!testQuery.trim()">Test RAG</button>
          </div>
          <div v-if="ragResponse" class="rag-response">
            <h5>Response:</h5>
            <p>{{ ragResponse }}</p>
          </div>
        </div>

        <!-- New: Generate Worker Section -->
        <div class="generate-worker-section" v-if="codeExamples.length > 0">
          <h5>Generate New Worker</h5>

          <!-- AI Model Selection -->
          <div class="model-selection-row">
            <label for="ai-model-select" class="model-label">🤖 AI Model:</label>
            <select v-model="selectedAIModel" id="ai-model-select" class="model-select">
              <option value="openai">🧠 OpenAI GPT-4 (Technical & Structured)</option>
              <option value="gemini">⚡ Google Gemini-2.0-Flash (Fast & Efficient)</option>
            </select>
          </div>

          <div class="user-prompt-section">
            <label for="user-prompt-textarea" class="prompt-label">
              📝 Describe Your Worker:
            </label>
            <textarea
              id="user-prompt-textarea"
              v-model="userPrompt"
              class="user-prompt-textarea"
              rows="4"
              placeholder="Describe what you want the worker to do...

Examples:
• Create a simple API that returns JSON data
• Build a worker that handles form submissions
• Make a proxy that adds CORS headers
• Create a worker that processes webhooks
• Build an authentication middleware"
              spellcheck="true"
            ></textarea>
            <div class="prompt-hint">
              💡 <strong>Tip:</strong> Be specific about functionality, endpoints, and expected
              behavior for better results.
            </div>
          </div>
          <button
            class="primary-btn generate-worker-btn"
            :disabled="isGeneratingWorker || !userPrompt.trim()"
            @click="generateWorker"
          >
            <span v-if="isGeneratingWorker">🔄 Generating Worker...</span>
            <span v-else>🤖 Generate AI Worker</span>
          </button>
          <div class="generation-info">
            <span v-if="selectedExampleIds.length > 0" class="examples-selected">
              ✅ {{ selectedExampleIds.length }} code example(s) selected
            </span>
            <span v-else class="no-examples">
              ℹ️ No examples selected - will generate from description only
            </span>
          </div>
          <div v-if="generatedCode" class="generated-code-section">
            <div class="code-header">
              <h6>Generated Worker Code</h6>
              <div class="model-badge" :class="`model-${selectedAIModel}`">
                <span v-if="selectedAIModel === 'openai'">🧠 GPT-4</span>
                <span v-else-if="selectedAIModel === 'gemini'">⚡ Gemini-2.0</span>
              </div>
            </div>
            <textarea
              v-model="generatedCode"
              class="generated-code-editor"
              rows="12"
              spellcheck="false"
              placeholder="Generated worker code will appear here..."
            ></textarea>
            <div class="code-editor-help">
              💡 <strong>Tip:</strong> You can edit the code above to fix any syntax errors before
              deployment.
              <br />
              🔍 <strong>Common fixes:</strong> Remove trailing commas, check matching braces {},
              ensure proper function syntax.
            </div>
            <!-- Deploy and Test Buttons -->
            <div class="deploy-test-row">
              <button class="secondary-btn" :disabled="isDeployingWorker" @click="deployWorker">
                <span v-if="isDeployingWorker">Deploying...</span>
                <span v-else>🚀 Deploy Worker First</span>
              </button>
              <button
                class="primary-btn"
                :disabled="!generatedCode.trim()"
                @click="activeTab = 'test'"
              >
                🧪 Go to Test Tab
              </button>
            </div>
            <div class="workflow-hint">
              💡 <strong>Recommended:</strong> Deploy worker first, then test it
            </div>
            <div v-if="sandboxTestResult !== null" class="sandbox-test-output">
              <h6>Sandbox Output</h6>
              <pre class="sandbox-output-area">{{ sandboxTestResult }}</pre>
            </div>
            <!-- New: Deploy/Save Buttons -->
            <div class="deploy-save-row">
              <button class="secondary-btn" :disabled="isDeployingWorker" @click="deployWorker">
                <span v-if="isDeployingWorker">Deploying...</span>
                <span v-else>Deploy Worker</span>
              </button>
              <button class="primary-btn" :disabled="isSavingWorker" @click="saveToKnowledgeGraph">
                <span v-if="isSavingWorker">Saving...</span>
                <span v-else>Save to Knowledge Graph</span>
              </button>
            </div>
            <div v-if="deployMessage" class="deploy-message">{{ deployMessage }}</div>
            <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>
          </div>
        </div>
        <!-- End Generate Worker Section -->
      </div>

      <!-- Test Tab Content -->
      <div v-if="activeTab === 'test'" class="step">
        <h3>🧪 Test Your RAG Sandbox</h3>

        <div v-if="sandboxResult" class="sandbox-info-section">
          <div class="sandbox-url-display">
            <strong>Sandbox URL:</strong>
            <code class="url-code">{{ sandboxResult.url }}</code>
            <button @click="copyToClipboard(sandboxResult.url)" class="copy-btn">📋 Copy</button>
          </div>

          <!-- Current Deployed Code Section -->
          <div class="deployed-code-section">
            <div class="deployed-code-header">
              <h5>📄 Currently Deployed Code</h5>
              <button @click="fetchDeployedCode" :disabled="isFetchingCode" class="secondary-btn">
                <span v-if="isFetchingCode">🔄 Loading...</span>
                <span v-else>🔍 Fetch Current Code</span>
              </button>
            </div>

            <div v-if="deployedCode" class="deployed-code-display">
              <div class="code-info">
                <span class="code-status">✅ Code Retrieved</span>
                <span class="code-timestamp" v-if="codeTimestamp"
                  >Last updated: {{ codeTimestamp }}</span
                >
              </div>
              <textarea
                v-model="deployedCode"
                class="deployed-code-viewer"
                readonly
                rows="15"
              ></textarea>
              <div class="code-actions">
                <button @click="copyToClipboard(deployedCode)" class="secondary-btn">
                  📋 Copy Code
                </button>
                <button @click="compareWithGenerated" class="secondary-btn" v-if="generatedCode">
                  🔍 Compare
                </button>
              </div>
            </div>

            <div v-else-if="codeError" class="code-error">
              <h6>⚠️ Could not fetch deployed code</h6>
              <p>{{ codeError }}</p>
              <div class="error-help">
                <strong>Possible reasons:</strong>
                <ul>
                  <li>Worker not deployed yet</li>
                  <li>Code retrieval not supported by this worker</li>
                  <li>Network connection issue</li>
                </ul>
              </div>
            </div>

            <div v-else class="code-placeholder">
              <p>Click "Fetch Current Code" to see what's actually deployed on your worker.</p>
              <div class="fetch-help">
                💡 <strong>Why fetch deployed code?</strong>
                <ul>
                  <li>Verify your latest changes were deployed</li>
                  <li>Debug deployment issues</li>
                  <li>Compare with your generated code</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="sandbox-iframe-container">
            <iframe
              :src="sandboxResult.url"
              class="sandbox-iframe"
              frameborder="0"
              title="RAG Sandbox"
            ></iframe>
          </div>

          <!-- Enhanced API Testing Section -->
          <div class="api-testing-section">
            <h4>🔧 Test Worker API</h4>

            <!-- Testing Instructions -->
            <div class="testing-instructions">
              <div class="instruction-card">
                <h5>📚 How to Test Your Worker:</h5>
                <ol class="instruction-list">
                  <li>
                    <strong>Deploy First:</strong> Make sure your worker is deployed using the "🚀
                    Deploy Worker" button in the Create tab
                  </li>
                  <li>
                    <strong>Select Endpoint:</strong> Choose from detected endpoints below, or use
                    manual testing
                  </li>
                  <li>
                    <strong>Fill Parameters:</strong> Enter required values for query parameters
                  </li>
                  <li>
                    <strong>Test & Review:</strong> Click test and check the response status and
                    data
                  </li>
                </ol>
              </div>

              <div v-if="!sandboxResult?.url" class="warning-card">
                <h6>⚠️ Worker Not Deployed</h6>
                <p>
                  You need to deploy your worker first before testing. Go to the
                  <strong>Create</strong> tab and click <strong>"🚀 Deploy Worker"</strong>.
                </p>
              </div>
            </div>

            <!-- Detected Endpoints -->
            <div v-if="detectedEndpoints.length > 0" class="endpoints-section">
              <h5>📍 Detected Endpoints:</h5>
              <div class="endpoints-help">
                💡 <strong>Tip:</strong> These endpoints were automatically detected from your
                worker code. Click on one to test it.
              </div>
              <div class="endpoints-list">
                <div
                  v-for="endpoint in detectedEndpoints"
                  :key="endpoint.path"
                  class="endpoint-item"
                  :class="{ active: selectedEndpoint?.path === endpoint.path }"
                  @click="selectEndpoint(endpoint)"
                >
                  <span class="method-badge" :class="endpoint.method.toLowerCase()">{{
                    endpoint.method
                  }}</span>
                  <span class="endpoint-path">{{ endpoint.path }}</span>
                  <span v-if="endpoint.params.length > 0" class="params-count"
                    >{{ endpoint.params.length }} params</span
                  >
                </div>
              </div>
            </div>

            <!-- Selected Endpoint Testing -->
            <div v-if="selectedEndpoint" class="endpoint-testing">
              <h5>
                🧪 Testing: <code>{{ selectedEndpoint.method }} {{ selectedEndpoint.path }}</code>
              </h5>

              <!-- Query Parameters -->
              <div v-if="selectedEndpoint.params.length > 0" class="params-section">
                <h6>🔧 Fill in Parameters:</h6>
                <div class="params-explanation">
                  <div class="url-preview">
                    <strong>📍 Your URL will be:</strong><br />
                    <code class="live-url">{{ buildPreviewUrl() }}</code>
                  </div>
                  <div class="params-help">
                    Enter values for each parameter below. They will be automatically added to your
                    URL as <code>?name=value</code>
                  </div>
                </div>

                <div class="params-grid">
                  <div v-for="param in selectedEndpoint.params" :key="param" class="param-card">
                    <div class="param-header">
                      <label :for="`param-${param}`" class="param-name">📝 {{ param }}</label>
                      <span class="param-format"
                        >?{{ param }}=<span class="param-value-preview">{{
                          testParams[param] || 'value'
                        }}</span></span
                      >
                    </div>
                    <input
                      :id="`param-${param}`"
                      v-model="testParams[param]"
                      type="text"
                      class="param-input"
                      :placeholder="getParameterPlaceholder(param)"
                    />
                    <div class="param-help" v-if="getParameterHelp(param)">
                      💡 {{ getParameterHelp(param) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Request Body (for POST/PUT) -->
              <div v-if="selectedEndpoint.method !== 'GET'" class="request-body-section">
                <h6>📝 Request Body (JSON):</h6>
                <div class="body-help">
                  Enter JSON data to send in the request body. Make sure it's valid JSON format.
                </div>
                <textarea
                  v-model="testRequestBody"
                  class="request-body-input"
                  rows="4"
                  :placeholder="getRequestBodyPlaceholder(selectedEndpoint.method)"
                ></textarea>
                <div class="json-examples">
                  <strong>Examples:</strong>
                  <button @click="setExampleRequestBody('simple')" class="example-btn">
                    Simple
                  </button>
                  <button @click="setExampleRequestBody('user')" class="example-btn">
                    User Data
                  </button>
                  <button @click="setExampleRequestBody('query')" class="example-btn">Query</button>
                </div>
              </div>

              <!-- Test Button -->
              <button
                @click="testEndpoint"
                :disabled="isTestingEndpoint"
                class="primary-btn test-endpoint-btn"
              >
                <span v-if="isTestingEndpoint">🔄 Testing...</span>
                <span v-else
                  >🚀 Test {{ selectedEndpoint.method }} {{ selectedEndpoint.path }}</span
                >
              </button>
            </div>

            <!-- Fallback: Manual URL Testing -->
            <div v-else class="manual-testing">
              <h5>🔧 Manual Testing</h5>
              <div class="manual-help">
                <p>
                  <strong>No endpoints detected automatically.</strong> Test your worker manually by
                  entering the full URL path with parameters:
                </p>

                <div class="url-structure-help">
                  <h6>📝 URL Structure:</h6>
                  <code class="url-example"
                    >https://your-worker.dev<span class="path-part">/path</span
                    ><span class="query-part">?parameter=value</span></code
                  >
                  <div class="url-parts-explanation">
                    • <span class="path-part">Path</span>: The endpoint route (e.g.,
                    /api/knowledge)<br />
                    • <span class="query-part">Parameters</span>: Added after ? with format
                    name=value
                  </div>
                </div>

                <div class="manual-examples">
                  <strong>📋 Common Examples:</strong>
                  <button @click="setManualExample('/')" class="example-btn">Root /</button>
                  <button
                    @click="setManualExample('/api/knowledge?query=test')"
                    class="example-btn"
                  >
                    API with Query
                  </button>
                  <button @click="setManualExample('/health')" class="example-btn">
                    Health Check
                  </button>
                </div>
              </div>

              <div class="manual-input-section">
                <label class="input-label">🌐 HTTP Method:</label>
                <select v-model="manualMethod" class="method-select">
                  <option value="GET">GET (retrieve data)</option>
                  <option value="POST">POST (send data)</option>
                  <option value="PUT">PUT (update data)</option>
                  <option value="DELETE">DELETE (remove data)</option>
                </select>

                <label class="input-label">🔗 Full URL Path with Parameters:</label>
                <input
                  v-model="manualPath"
                  type="text"
                  class="manual-path-input"
                  placeholder="/api/knowledge?query=your search term here"
                />
                <div class="path-help">
                  💡 <strong>Example:</strong> <code>/api/knowledge?query=test data&limit=10</code>
                </div>

                <button
                  @click="testManualEndpoint"
                  :disabled="isTestingEndpoint || !manualPath.trim()"
                  class="primary-btn manual-test-btn"
                >
                  <span v-if="isTestingEndpoint">🔄 Testing...</span>
                  <span v-else>🚀 Test {{ manualMethod }} {{ manualPath || '/path' }}</span>
                </button>
              </div>
            </div>

            <!-- Test Response -->
            <div v-if="endpointResponse" class="endpoint-response-display">
              <h5>📋 Response:</h5>
              <div
                class="response-status"
                :class="endpointResponse.status < 400 ? 'success' : 'error'"
              >
                Status: {{ endpointResponse.status }} {{ endpointResponse.statusText }}
              </div>
              <div class="response-headers" v-if="endpointResponse.headers">
                <h6>Headers:</h6>
                <pre class="headers-content">{{ endpointResponse.headers }}</pre>
              </div>
              <div class="response-body">
                <h6>Body:</h6>
                <pre class="response-content">{{ endpointResponse.body }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps({
  isVisible: Boolean,
  graphData: Object,
  graphId: String,
  userId: String,
  userToken: String, // Email verification token for persistent sandbox
})

const emit = defineEmits(['close'])

const activeTab = ref('create')
const isCreating = ref(false)
const sandboxResult = ref(null)
const testQuery = ref('')
const ragResponse = ref('')
const isTestingRAG = ref(false)

// Enhanced API Testing
const detectedEndpoints = ref([])
const selectedEndpoint = ref(null)
const testParams = ref({})
const testRequestBody = ref('')
const endpointResponse = ref(null)
const isTestingEndpoint = ref(false)
const manualMethod = ref('GET')
const manualPath = ref('/')

// Deployed Code Fetching
const deployedCode = ref('')
const isFetchingCode = ref(false)
const codeError = ref('')
const codeTimestamp = ref('')
const isLoadingExamples = ref(false)
const codeExamples = ref([])
const selectedExampleIds = ref([])
const userPrompt = ref('')
const selectedAIModel = ref('openai') // Default to OpenAI
const isGeneratingWorker = ref(false)
const generatedCode = ref('')
const isTestingSandbox = ref(false)
const sandboxTestResult = ref(null)
const isDeployingWorker = ref(false)
const deployMessage = ref('')
const isSavingWorker = ref(false)
isSavingWorker.value = false
const saveMessage = ref('')

const graphNodeCount = computed(() => {
  return props.graphData?.nodes?.length || 0
})

const closeModal = () => {
  emit('close')
  activeTab.value = 'create'
  sandboxResult.value = null
  testQuery.value = ''
  ragResponse.value = ''
}

// Reset to create tab when modal becomes visible
watch(
  () => props.isVisible,
  (newVal) => {
    if (newVal) {
      activeTab.value = 'create'
    }
  },
)

const createSandbox = async () => {
  isCreating.value = true

  try {
    // Step 1: Analyze the graph for RAG content
    const analysisResponse = await fetch('https://api.vegvisr.org/rag/analyze-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphData: props.graphData,
      }),
    })

    if (!analysisResponse.ok) {
      throw new Error('Failed to analyze graph')
    }

    const analysis = await analysisResponse.json()
    console.log('Graph analysis:', analysis)

    // Step 2: Create RAG index
    const indexResponse = await fetch('https://api.vegvisr.org/rag/create-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphData: props.graphData,
        graphId: props.graphId,
        userId: props.userId,
      }),
    })

    if (!indexResponse.ok) {
      throw new Error('Failed to create RAG index')
    }

    const indexResult = await indexResponse.json()
    console.log('RAG index created:', indexResult)

    // Step 3: Create sandbox
    const sandboxResponse = await fetch('https://api.vegvisr.org/rag/create-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indexId: indexResult.indexId,
        sandboxName: `graph-${props.graphId}-sandbox`,
        graphId: props.graphId,
        userId: props.userId,
      }),
    })

    if (!sandboxResponse.ok) {
      throw new Error('Failed to create sandbox')
    }

    const sandboxData = await sandboxResponse.json()
    console.log('Sandbox created:', sandboxData)

    // Use the user's persistent sandbox URL based on their email verification token
    const userToken = props.userToken || 'demo-user-' + Math.random().toString(36).substring(7)
    const persistentSandboxUrl = `https://sandbox-${userToken}.torarnehave.workers.dev`

    sandboxResult.value = {
      url: persistentSandboxUrl,
      sandboxId: sandboxData.sandbox.sandboxId,
    }
  } catch (error) {
    console.error('Failed to create sandbox:', error)
    alert('Failed to create sandbox: ' + error.message)
  } finally {
    isCreating.value = false
  }
}

const testRAG = async () => {
  if (!testQuery.value.trim() || !sandboxResult.value) return

  isTestingRAG.value = true
  try {
    const response = await fetch(`${sandboxResult.value.url}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery.value }),
    })

    const result = await response.json()
    ragResponse.value = result.response || 'No response'
  } catch (error) {
    console.error('RAG test failed:', error)
    ragResponse.value = `Error: ${error.message}`
  } finally {
    isTestingRAG.value = false
  }
}

// Enhanced API Testing Functions
const analyzeCodeForEndpoints = (code) => {
  const endpoints = []

  try {
    // Extract pathname checks and route patterns
    const pathMatches = code.match(/pathname\s*===?\s*['"`]([^'"`]+)['"`]/g) || []
    const routeMatches = code.match(/if\s*\(\s*pathname\s*===?\s*['"`]([^'"`]+)['"`]/g) || []

    // Extract URL search params
    const paramMatches = code.match(/url\.searchParams\.get\(['"`]([^'"`]+)['"`]\)/g) || []

    // Combine all path matches
    const allPathMatches = [...pathMatches, ...routeMatches]

    for (const match of allPathMatches) {
      const pathMatch = match.match(/['"`]([^'"`]+)['"`]/)
      if (pathMatch) {
        const path = pathMatch[1]

        // Determine HTTP methods by looking at surrounding code
        const methods = []
        const codeAroundPath = code.substring(
          Math.max(0, code.indexOf(match) - 200),
          code.indexOf(match) + 200,
        )

        if (codeAroundPath.includes('GET') || codeAroundPath.includes("request.method !== 'GET'")) {
          methods.push('GET')
        }
        if (codeAroundPath.includes('POST')) {
          methods.push('POST')
        }
        if (codeAroundPath.includes('PUT')) {
          methods.push('PUT')
        }
        if (codeAroundPath.includes('DELETE')) {
          methods.push('DELETE')
        }

        // Default to GET if no methods detected
        if (methods.length === 0) {
          methods.push('GET')
        }

        // Extract parameters for this endpoint
        const params = []
        for (const paramMatch of paramMatches) {
          const param = paramMatch.match(/['"`]([^'"`]+)['"`]/)
          if (param) {
            params.push(param[1])
          }
        }

        // Add endpoint for each method
        for (const method of methods) {
          endpoints.push({
            path,
            method,
            params: [...new Set(params)], // Remove duplicates
          })
        }
      }
    }

    // Remove duplicates
    const uniqueEndpoints = endpoints.filter(
      (endpoint, index, self) =>
        index === self.findIndex((e) => e.path === endpoint.path && e.method === endpoint.method),
    )

    return uniqueEndpoints
  } catch (error) {
    console.warn('Error analyzing code for endpoints:', error)
    return []
  }
}

const selectEndpoint = (endpoint) => {
  selectedEndpoint.value = endpoint
  testParams.value = {}
  testRequestBody.value = ''
  endpointResponse.value = null

  // Initialize params with empty values
  endpoint.params.forEach((param) => {
    testParams.value[param] = ''
  })
}

const testEndpoint = async () => {
  if (!selectedEndpoint.value || !sandboxResult.value?.url) return

  isTestingEndpoint.value = true
  endpointResponse.value = null

  try {
    // Build URL with query parameters
    const baseUrl = sandboxResult.value.url
    const url = new URL(selectedEndpoint.value.path, baseUrl)

    // Add query parameters
    Object.entries(testParams.value).forEach(([key, value]) => {
      if (value.trim()) {
        url.searchParams.set(key, value)
      }
    })

    // Prepare request options
    const requestOptions = {
      method: selectedEndpoint.value.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vegvisr-API-Test',
      },
    }

    // Add request body for non-GET requests
    if (selectedEndpoint.value.method !== 'GET' && testRequestBody.value.trim()) {
      try {
        JSON.parse(testRequestBody.value) // Validate JSON
        requestOptions.body = testRequestBody.value
      } catch (e) {
        throw new Error('Invalid JSON in request body')
      }
    }

    console.log('🧪 Testing endpoint:', url.toString(), requestOptions)

    const response = await fetch(url.toString(), requestOptions)

    // Get response headers
    const headers = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Get response body
    const body = await response.text()

    endpointResponse.value = {
      status: response.status,
      statusText: response.statusText,
      headers: JSON.stringify(headers, null, 2),
      body: body,
    }
  } catch (error) {
    endpointResponse.value = {
      status: 0,
      statusText: 'Error',
      headers: '',
      body: `Error: ${error.message}`,
    }
  } finally {
    isTestingEndpoint.value = false
  }
}

const testManualEndpoint = async () => {
  if (!sandboxResult.value?.url || !manualPath.value.trim()) return

  isTestingEndpoint.value = true
  endpointResponse.value = null

  try {
    const baseUrl = sandboxResult.value.url
    const url = new URL(manualPath.value, baseUrl)

    const requestOptions = {
      method: manualMethod.value,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vegvisr-Manual-Test',
      },
    }

    console.log('🔧 Manual testing:', url.toString(), requestOptions)

    const response = await fetch(url.toString(), requestOptions)

    const headers = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    const body = await response.text()

    endpointResponse.value = {
      status: response.status,
      statusText: response.statusText,
      headers: JSON.stringify(headers, null, 2),
      body: body,
    }
  } catch (error) {
    endpointResponse.value = {
      status: 0,
      statusText: 'Error',
      headers: '',
      body: `Error: ${error.message}`,
    }
  } finally {
    isTestingEndpoint.value = false
  }
}

// Helper functions for better user guidance
const getParameterPlaceholder = (param) => {
  const paramLower = param.toLowerCase()
  if (paramLower.includes('query')) return 'e.g., "knowledge graph data"'
  if (paramLower.includes('id')) return 'e.g., "123" or "user-456"'
  if (paramLower.includes('name')) return 'e.g., "John Doe"'
  if (paramLower.includes('email')) return 'e.g., "user@example.com"'
  if (paramLower.includes('search')) return 'e.g., "search term"'
  if (paramLower.includes('limit')) return 'e.g., "10"'
  if (paramLower.includes('page')) return 'e.g., "1"'
  return `Enter ${param} value...`
}

const getParameterHelp = (param) => {
  const paramLower = param.toLowerCase()
  if (paramLower.includes('query')) return 'Search term or question for your knowledge graph'
  if (paramLower.includes('id')) return 'Unique identifier (numbers or text)'
  if (paramLower.includes('limit')) return 'Maximum number of results to return'
  if (paramLower.includes('page')) return 'Page number for pagination'
  return null
}

const getRequestBodyPlaceholder = (method) => {
  if (method === 'POST') {
    return `{
  "name": "Example Item",
  "description": "Sample data for POST request"
}`
  }
  if (method === 'PUT') {
    return `{
  "id": "123",
  "name": "Updated Item",
  "status": "active"
}`
  }
  return '{"key": "value"}'
}

const setExampleRequestBody = (type) => {
  const examples = {
    simple: '{"message": "Hello World"}',
    user: '{"name": "John Doe", "email": "john@example.com", "role": "user"}',
    query: '{"query": "knowledge graph data", "limit": 10}',
  }
  testRequestBody.value = examples[type] || examples.simple
}

const setManualExample = (path) => {
  manualPath.value = path
}

const buildPreviewUrl = () => {
  if (!selectedEndpoint.value || !sandboxResult.value?.url) {
    return 'https://your-worker.dev/path?param=value'
  }

  const baseUrl = sandboxResult.value.url
  const path = selectedEndpoint.value.path
  const params = new URLSearchParams()

  // Add filled parameters
  Object.entries(testParams.value).forEach(([key, value]) => {
    if (value && value.trim()) {
      params.set(key, value)
    } else {
      params.set(key, 'your-value-here')
    }
  })

  const queryString = params.toString()
  return `${baseUrl}${path}${queryString ? '?' + queryString : ''}`
}

const fetchDeployedCode = async () => {
  if (!sandboxResult.value?.url) {
    codeError.value = 'No sandbox URL available'
    return
  }

  isFetchingCode.value = true
  codeError.value = ''
  deployedCode.value = ''

  try {
    const userToken =
      props.userToken || props.userId || 'demo-user-' + Math.random().toString(36).substring(7)

    console.log('🔍 Fetching deployed code for:', userToken)

    // Try to fetch the deployed code from the API
    const response = await fetch(
      `https://vegvisr-api-worker.torarnehave.workers.dev/get-sandbox-code?userToken=${encodeURIComponent(userToken)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch code: HTTP ${response.status}`)
    }

    const result = await response.json()

    if (result.success && result.code) {
      deployedCode.value = result.code
      codeTimestamp.value = result.lastUpdated
        ? new Date(result.lastUpdated).toLocaleString()
        : new Date().toLocaleString()
      console.log('✅ Successfully fetched deployed code')
    } else {
      throw new Error(result.error || 'No code found in response')
    }
  } catch (error) {
    console.error('❌ Error fetching deployed code:', error)
    codeError.value = error.message

    // Fallback: Try to infer from the worker response
    try {
      console.log('🔄 Trying fallback method...')
      const fallbackResponse = await fetch(`${sandboxResult.value.url}/__code__`, {
        method: 'GET',
        headers: { 'User-Agent': 'Vegvisr-Code-Fetcher' },
      })

      if (fallbackResponse.ok) {
        const code = await fallbackResponse.text()
        deployedCode.value = code
        codeTimestamp.value = new Date().toLocaleString()
        codeError.value = ''
        console.log('✅ Fallback method successful')
      } else {
        throw new Error('Fallback method also failed')
      }
    } catch (fallbackError) {
      console.warn('⚠️ Fallback method failed:', fallbackError.message)
      // Keep the original error message
    }
  } finally {
    isFetchingCode.value = false
  }
}

const compareWithGenerated = () => {
  if (!deployedCode.value || !generatedCode.value) {
    alert('Both deployed code and generated code must be available for comparison')
    return
  }

  // Simple comparison - could be enhanced with a diff viewer
  const deployed = deployedCode.value.trim()
  const generated = generatedCode.value.trim()

  if (deployed === generated) {
    alert('✅ Code matches! Your deployed code is identical to the generated code.')
  } else {
    const message = `⚠️ Code differs!\n\nDeployed: ${deployed.length} characters\nGenerated: ${generated.length} characters\n\nCheck both code sections to see the differences.`
    alert(message)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could add a toast notification here
    console.log('URL copied to clipboard')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const generateWorker = async () => {
  isGeneratingWorker.value = true

  console.log('🤖 Starting worker generation with:', {
    aiModel: selectedAIModel.value,
    userPrompt: userPrompt.value,
    selectedExamplesCount: selectedExampleIds.value.length,
  })

  try {
    const selectedExamples = codeExamples.value.filter((ex) =>
      selectedExampleIds.value.includes(ex.id),
    )

    // Prepare the context for AI generation
    const exampleContext =
      selectedExamples.length > 0
        ? `\n\nSelected Code Examples:\n${selectedExamples.map((ex) => `// ${ex.title} (${ex.language})\n// ${ex.description}\n${ex.code}`).join('\n\n// ---\n\n')}`
        : ''

    const prompt = `Generate a Cloudflare Worker script based on the following requirements:

User Request: ${userPrompt.value.trim() || 'Create a basic worker'}

Context: This worker will be deployed to a RAG-enabled sandbox environment for knowledge graph operations.

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use "export default" syntax - this will cause deployment errors
- Use the addEventListener('fetch', event => {}) format instead
- OR use the object format with fetch handler: addEventListener('fetch', event => { event.respondWith(handleRequest(event.request)) })
- Include proper CORS headers for cross-origin requests
- Handle OPTIONS requests for CORS preflight
- Include proper error handling and status codes
- Add helpful comments explaining the functionality
- Make it production-ready

CORRECT CLOUDFLARE WORKER FORMAT EXAMPLE:
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Your worker code here
  return new Response('Hello World', { status: 200 })
}

${exampleContext}

Please generate only the JavaScript code for the worker using the addEventListener format, without any markdown formatting or explanations. Do NOT use export default syntax.`

    console.log('📡 Calling worker generation API...')

    // Use the dedicated worker generation endpoint
    const response = await fetch(
      'https://vegvisr-api-worker.torarnehave.workers.dev/generate-worker',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aiModel: selectedAIModel.value,
          selectedExamples,
          userPrompt: userPrompt.value.trim() || 'Create a basic worker',
        }),
      },
    )

    console.log('📡 API Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error Response:', errorText)
      throw new Error(`Worker generation API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Worker generation result:', result)

    if (!result.success) {
      throw new Error(result.message || 'Worker generation failed')
    }

    // Clean up the generated code to fix common syntax issues
    let cleanedCode = result.code

    console.log('🔍 Original code preview:', cleanedCode.substring(0, 200) + '...')

    // Remove any markdown code blocks if they slipped through
    cleanedCode = cleanedCode.replace(/```(?:javascript|js)?\n?/g, '').replace(/```/g, '')

    // Fix export default syntax if present
    if (cleanedCode.includes('export default')) {
      console.log('🔧 Fixing export default syntax...')

      // More robust conversion for export default object syntax
      if (cleanedCode.match(/export\s+default\s*{[\s\S]*async\s+fetch/)) {
        // Extract the fetch function body
        const fetchMatch = cleanedCode.match(
          /async\s+fetch\s*\(\s*request\s*(?:,\s*env\s*,\s*ctx\s*)?\)\s*{([\s\S]*?)}\s*(?:,|\s*})/,
        )

        if (fetchMatch) {
          const fetchBody = fetchMatch[1]
          cleanedCode = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {${fetchBody}
}`
        } else {
          // Fallback: just remove export default and wrap in addEventListener
          cleanedCode = cleanedCode.replace(/export\s+default\s*{\s*/, '').replace(/}\s*$/, '')
          cleanedCode = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
${cleanedCode}
}`
        }
      } else {
        // Simple export default removal
        cleanedCode = cleanedCode.replace(/export\s+default\s+/, '')
        if (!cleanedCode.includes('addEventListener')) {
          cleanedCode = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  ${cleanedCode}
}`
        }
      }
    }

    // Fix common syntax issues
    cleanedCode = cleanedCode
      .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
      .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
      .replace(/;\s*;/g, ';') // Remove double semicolons
      .trim()

    // Basic syntax validation
    try {
      // Try to detect obvious syntax errors
      const openBraces = (cleanedCode.match(/{/g) || []).length
      const closeBraces = (cleanedCode.match(/}/g) || []).length
      const openParens = (cleanedCode.match(/\(/g) || []).length
      const closeParens = (cleanedCode.match(/\)/g) || []).length

      if (openBraces !== closeBraces) {
        console.warn('⚠️ Mismatched braces detected:', { openBraces, closeBraces })
      }
      if (openParens !== closeParens) {
        console.warn('⚠️ Mismatched parentheses detected:', { openParens, closeParens })
      }
    } catch (e) {
      console.warn('⚠️ Syntax validation failed:', e.message)
    }

    generatedCode.value = cleanedCode
    console.log('🎉 Worker code generated and cleaned successfully!')
    console.log('🔍 Cleaned code preview:', cleanedCode.substring(0, 300) + '...')
  } catch (e) {
    console.error('❌ Worker generation error:', e)
    generatedCode.value = `// Error generating code: ${e.message}
// Please try again or select a different AI model.
//
// Debug info:
// - AI Model: ${selectedAIModel.value}
// - User Prompt: ${userPrompt.value || 'None'}
// - Selected Examples: ${selectedExampleIds.value.length}
// - Timestamp: ${new Date().toISOString()}`
  } finally {
    isGeneratingWorker.value = false
  }
}

const testInSandbox = async () => {
  // This function is no longer used for automatic testing
  // Users will use the manual endpoint testing interface instead
  console.log('testInSandbox called - redirecting to manual testing interface')
}

const deployWorker = async () => {
  if (!generatedCode.value || !generatedCode.value.trim()) {
    deployMessage.value = '❌ No code to deploy! Generate a worker first.'
    return
  }

  isDeployingWorker.value = true
  deployMessage.value = '🔄 Deploying worker...'

  try {
    const userToken =
      props.userToken || props.userId || 'demo-user-' + Math.random().toString(36).substring(7)

    console.log('🚀 Deploying worker with:', {
      userToken,
      codeLength: generatedCode.value.length,
      codePreview: generatedCode.value.substring(0, 100) + '...',
    })

    // 1. Deploy/update the persistent sandbox worker
    const response = await fetch('https://api.vegvisr.org/deploy-sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userToken: userToken,
        code: generatedCode.value,
        timestamp: new Date().toISOString(),
      }),
    })

    console.log('📡 Deploy response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Deploy error response:', errorText)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Deploy result:', result)

    if (result.success) {
      deployMessage.value = `✅ ${result.message}\n🔗 Workers.dev: ${result.endpoint}\n📅 Deployed: ${new Date().toLocaleString()}`

      // Update the sandbox result if we have the endpoint
      if (result.endpoint && !sandboxResult.value) {
        sandboxResult.value = { url: result.endpoint }
      }

      // Optional: Test the deployed worker to verify it's working
      if (result.endpoint) {
        try {
          deployMessage.value += '\n🔄 Verifying deployment...'
          await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for deployment

          const testResponse = await fetch(result.endpoint, {
            method: 'GET',
            headers: { 'User-Agent': 'Vegvisr-Deploy-Test' },
          })

          if (testResponse.ok) {
            const responseText = await testResponse.text()
            deployMessage.value += '\n✅ Verification successful!'
            console.log('🔍 Deployed worker response:', responseText)
          } else {
            deployMessage.value += '\n⚠️ Deployment successful but worker returned error'
          }
        } catch (verifyError) {
          console.warn('Verification failed:', verifyError)
          deployMessage.value += '\n⚠️ Could not verify deployment'
        }
      }
    } else {
      deployMessage.value = `❌ Deployment failed: ${result.error || 'Unknown error'}`
    }
  } catch (e) {
    console.error('❌ Deployment error:', e)
    deployMessage.value = `❌ Deployment error: ${e.message}`
  } finally {
    isDeployingWorker.value = false
  }
}

const saveToKnowledgeGraph = async () => {
  if (!props.graphId || !generatedCode.value.trim()) {
    saveMessage.value = 'Missing graph ID or code.'
    return
  }
  isSavingWorker.value = true
  saveMessage.value = ''
  try {
    // Step 1: Fetch current graph
    const graphRes = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${props.graphId}`)
    if (!graphRes.ok) throw new Error('Failed to fetch current graph')
    const graphData = await graphRes.json()
    // Step 2: Prompt for label/description (simple prompt for now)
    let label = prompt('Enter a label for this worker node:', 'Generated Worker')
    if (!label) label = 'Generated Worker'
    let description = userPrompt.value || ''
    // Step 3: Add new node
    const newNode = {
      id: uuidv4(),
      label,
      type: 'worker-code',
      info: generatedCode.value,
      description,
      createdAt: new Date().toISOString(),
    }
    graphData.nodes.push(newNode)
    // Step 4: Save updated graph
    const updateRes = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: props.graphId, graphData }),
    })
    if (!updateRes.ok) throw new Error('Failed to update graph')
    saveMessage.value = 'Worker node saved to Knowledge Graph!'
  } catch (e) {
    saveMessage.value = 'Error: ' + e.message
  } finally {
    isSavingWorker.value = false
  }
}

// Check if user already has a persistent sandbox
const checkExistingSandbox = async () => {
  const userToken =
    props.userToken || props.userId || 'demo-user-' + Math.random().toString(36).substring(7)
  try {
    const response = await fetch(`https://api.vegvisr.org/get-sandbox-info?userToken=${userToken}`)
    const result = await response.json()
    if (result.exists) {
      deployMessage.value = `🔄 Existing sandbox found:\n🔗 Workers.dev: ${result.sandbox.endpoint}\n📅 Last updated: ${new Date(result.sandbox.lastUpdated).toLocaleString()}`
    }
  } catch (error) {
    console.log('No existing sandbox found or error checking:', error.message)
  }
}

// Check for existing sandbox when modal opens
watch(
  () => props.isVisible,
  (newVal) => {
    if (newVal) {
      checkExistingSandbox()
    }
  },
)

// Analyze generated code for endpoints
watch(
  () => generatedCode.value,
  (newCode) => {
    if (newCode && newCode.trim()) {
      console.log('🔍 Analyzing code for endpoints...')
      detectedEndpoints.value = analyzeCodeForEndpoints(newCode)
      console.log('📍 Detected endpoints:', detectedEndpoints.value)

      // Auto-select first endpoint if available
      if (detectedEndpoints.value.length > 0 && !selectedEndpoint.value) {
        selectEndpoint(detectedEndpoints.value[0])
      }
    } else {
      detectedEndpoints.value = []
      selectedEndpoint.value = null
    }
  },
  { immediate: true },
)

// Note: Removed auto-switch to test tab - let user manually switch when ready

// Placeholder: Fetch code examples from the Knowledge Graph after sandbox creation
watch(
  () => sandboxResult.value,
  async (newVal) => {
    if (newVal) {
      isLoadingExamples.value = true
      try {
        // TODO: Replace with real API call to fetch code examples for this graph
        // Example placeholder data:
        codeExamples.value = [
          {
            id: 'ex1',
            title: 'Basic Worker Example',
            language: 'JavaScript',
            description: 'A simple Cloudflare Worker that returns Hello World.',
            code: "addEventListener('fetch', event => { event.respondWith(new Response('Hello World!')) })",
          },
          {
            id: 'ex2',
            title: 'Graph Query Worker',
            language: 'JavaScript',
            description: 'Worker that queries the knowledge graph and returns node data.',
            code: "addEventListener('fetch', event => { /* graph query logic */ })",
          },
        ]
      } catch (e) {
        codeExamples.value = []
      } finally {
        isLoadingExamples.value = false
      }
    } else {
      codeExamples.value = []
      selectedExampleIds.value = []
    }
  },
)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 95%;
  max-width: 1200px;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  color: #1976d2;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 500;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab-btn:hover:not(:disabled) {
  background: #e9ecef;
  color: #333;
}

.tab-btn.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
  background: white;
}

.tab-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step {
  padding: 24px;
}

.step h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.info-message {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.stats {
  margin-top: 12px;
}

.stat-item {
  margin: 8px 0;
  color: #555;
}

.step-actions {
  text-align: center;
  margin: 24px 0;
}

.primary-btn {
  background: #1976d2;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.primary-btn:hover:not(:disabled) {
  background: #1565c0;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sandbox-result {
  background: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
}

.sandbox-info a {
  color: #1976d2;
  text-decoration: none;
}

.sandbox-info a:hover {
  text-decoration: underline;
}

.test-section {
  margin-top: 16px;
}

.test-section textarea {
  width: 100%;
  height: 60px;
  margin: 8px 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.test-section button {
  background: #1976d2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.rag-response {
  margin-top: 16px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
}

.code-examples-section {
  margin: 1.5em 0;
  padding: 1em;
  background: #f8f9fa;
  border-radius: 8px;
}

.code-example-list {
  list-style: none;
  padding: 0;
}

.code-example-item {
  margin-bottom: 1em;
  padding-bottom: 1em;
  border-bottom: 1px solid #e0e0e0;
}

.example-description {
  font-size: 0.95em;
  color: #555;
  margin-bottom: 0.5em;
}

.example-preview {
  background: #272822;
  color: #f8f8f2;
  padding: 0.5em;
  border-radius: 4px;
  font-size: 0.9em;
  overflow-x: auto;
  max-width: 100%;
}

.generate-worker-section {
  margin: 1.5em 0;
  padding: 1em;
  background: #eef6fa;
  border-radius: 8px;
}
.model-selection-row {
  margin-bottom: 1em;
  display: flex;
  align-items: center;
  gap: 0.75em;
}

.model-label {
  font-weight: 600;
  color: #333;
  min-width: 80px;
}

.model-select {
  flex: 1;
  padding: 0.5em;
  border-radius: 6px;
  border: 2px solid #e0e0e0;
  background: white;
  font-size: 0.95em;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.model-select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.model-select:hover {
  border-color: #bdbdbd;
}

.user-prompt-section {
  margin-bottom: 1.5em;
}

.prompt-label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5em;
  font-size: 1em;
}

.user-prompt-textarea {
  width: 100%;
  padding: 0.75em;
  border-radius: 6px;
  border: 2px solid #e0e0e0;
  font-size: 0.95em;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.user-prompt-textarea:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}

.user-prompt-textarea:hover {
  border-color: #bdbdbd;
}

.user-prompt-textarea::placeholder {
  color: #888;
  line-height: 1.4;
}

.prompt-hint {
  margin-top: 0.5em;
  padding: 0.5em 0.75em;
  background: #f0f7ff;
  border: 1px solid #b3d9ff;
  border-radius: 4px;
  font-size: 0.85em;
  color: #0056b3;
}

.generate-worker-btn {
  width: 100%;
  margin: 1em 0 0.5em 0;
  padding: 0.75em 1.5em;
  font-size: 1.05em;
  font-weight: 600;
  background: linear-gradient(135deg, #1976d2, #1565c0);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.2);
}

.generate-worker-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1565c0, #0d47a1);
  box-shadow: 0 4px 8px rgba(25, 118, 210, 0.3);
  transform: translateY(-1px);
}

.generate-worker-btn:disabled {
  background: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.generation-info {
  text-align: center;
  margin-bottom: 1em;
  font-size: 0.9em;
}

.examples-selected {
  color: #2e7d32;
  font-weight: 500;
}

.no-examples {
  color: #757575;
  font-style: italic;
}
.generated-code-section {
  margin-top: 1em;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5em;
}

.code-header h6 {
  margin: 0;
}

.model-badge {
  padding: 0.25em 0.75em;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 600;
  color: white;
}

.model-badge.model-openai {
  background: linear-gradient(135deg, #00d2d3, #54a0ff);
}

.model-badge.model-gemini {
  background: linear-gradient(135deg, #5f27cd, #341f97);
}
.generated-code-editor {
  width: 100%;
  font-family: 'Fira Mono', 'Consolas', monospace;
  font-size: 0.98em;
  border-radius: 4px;
  border: 1px solid #bbb;
  background: #23272e;
  color: #f8f8f2;
  padding: 0.75em;
  resize: vertical;
}

.code-editor-help {
  margin-top: 0.5em;
  padding: 0.5em 0.75em;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  font-size: 0.85em;
  color: #856404;
}
.deploy-test-row {
  margin-top: 1em;
  display: flex;
  gap: 1em;
  align-items: center;
}

.workflow-hint {
  margin-top: 0.5em;
  padding: 0.5em;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  font-size: 0.9em;
  color: #856404;
}
.sandbox-test-output {
  margin-top: 1em;
  background: #f6f8fa;
  border-radius: 6px;
  padding: 1em;
}
.sandbox-output-area {
  background: #23272e;
  color: #f8f8f2;
  padding: 0.75em;
  border-radius: 4px;
  font-size: 0.98em;
  margin: 0;
  white-space: pre-wrap;
}
.deploy-save-row {
  margin-top: 1.5em;
  display: flex;
  gap: 1em;
}
.deploy-message,
.save-message {
  margin-top: 0.75em;
  font-size: 1em;
  color: #1976d2;
}
.secondary-btn {
  background: #e0e0e0;
  color: #222;
  border: none;
  border-radius: 4px;
  padding: 0.5em 1.2em;
  font-size: 1em;
  cursor: pointer;
  transition: background 0.2s;
}
.secondary-btn:hover {
  background: #bdbdbd;
}

/* Test Tab Styles */
.sandbox-info-section {
  margin: 20px 0;
}

.sandbox-url-display {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.url-code {
  flex: 1;
  background: #e9ecef;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  word-break: break-all;
}

.copy-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.copy-btn:hover {
  background: #218838;
}

.deployed-code-section {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.deployed-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.deployed-code-header h5 {
  margin: 0;
  color: #1976d2;
}

.deployed-code-display {
  background: white;
  border-radius: 6px;
  border: 1px solid #ddd;
  overflow: hidden;
}

.code-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #e8f5e8;
  border-bottom: 1px solid #ddd;
}

.code-status {
  color: #2e7d32;
  font-weight: 500;
}

.code-timestamp {
  color: #666;
  font-size: 0.9em;
}

.deployed-code-viewer {
  width: 100%;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  background: #23272e;
  color: #f8f8f2;
  border: none;
  padding: 16px;
  resize: vertical;
  min-height: 300px;
}

.code-actions {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid #ddd;
}

.code-error {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 16px;
}

.code-error h6 {
  margin: 0 0 8px 0;
  color: #856404;
}

.code-error p {
  margin: 0 0 12px 0;
  color: #856404;
}

.error-help {
  color: #856404;
}

.error-help ul {
  margin: 8px 0 0 20px;
}

.code-placeholder {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 20px;
  text-align: center;
}

.fetch-help {
  margin-top: 12px;
  text-align: left;
  background: #f0f7ff;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #b3d9ff;
}

.fetch-help ul {
  margin: 8px 0 0 20px;
}

.sandbox-iframe-container {
  margin: 20px 0;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.sandbox-iframe {
  width: 100%;
  height: 400px;
  border: none;
}

.rag-testing-section {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.rag-input-group {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 16px;
}

.rag-query-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
}

.rag-response-display {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
}

.response-content {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border-left: 4px solid #1976d2;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Enhanced API Testing Styles */
.api-testing-section {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.testing-instructions {
  margin-bottom: 24px;
}

.instruction-card {
  background: #e3f2fd;
  border: 1px solid #1976d2;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.instruction-card h5 {
  margin: 0 0 12px 0;
  color: #1976d2;
}

.instruction-list {
  margin: 0;
  padding-left: 20px;
}

.instruction-list li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.warning-card {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  padding: 16px;
}

.warning-card h6 {
  margin: 0 0 8px 0;
  color: #856404;
}

.warning-card p {
  margin: 0;
  color: #856404;
}

.endpoints-help {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 0.9em;
  color: #0056b3;
}

.params-help {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 0.85em;
  color: #0056b3;
}

.param-help {
  font-size: 0.8em;
  color: #666;
  margin-top: 4px;
  font-style: italic;
}

.body-help {
  margin-bottom: 8px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 4px;
  font-size: 0.85em;
  color: #0056b3;
}

.json-examples {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.example-btn {
  background: #e0e0e0;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  cursor: pointer;
  transition: background 0.2s;
}

.example-btn:hover {
  background: #bdbdbd;
}

.manual-help {
  margin-bottom: 16px;
  padding: 12px;
  background: #fff3cd;
  border-radius: 4px;
  border: 1px solid #ffeaa7;
}

.manual-help p {
  margin: 0 0 8px 0;
  color: #856404;
}

.manual-examples {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.url-structure-help {
  margin: 12px 0;
  padding: 12px;
  background: #e8f5e8;
  border-radius: 6px;
  border: 1px solid #4caf50;
}

.url-structure-help h6 {
  margin: 0 0 8px 0;
  color: #2e7d32;
}

.url-example {
  display: block;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  margin-bottom: 8px;
}

.path-part {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 4px;
  border-radius: 3px;
}

.query-part {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 4px;
  border-radius: 3px;
}

.url-parts-explanation {
  font-size: 0.85em;
  color: #2e7d32;
  line-height: 1.4;
}

.manual-input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  font-weight: 500;
  color: #333;
  margin: 0;
}

.manual-test-btn {
  margin-top: 8px;
}

.path-help {
  font-size: 0.85em;
  color: #666;
  margin-top: 4px;
}

.params-explanation {
  margin-bottom: 16px;
}

.url-preview {
  background: #e8f5e8;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #4caf50;
  margin-bottom: 12px;
}

.live-url {
  display: block;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  word-break: break-all;
  margin-top: 4px;
  border: 1px solid #ddd;
}

.params-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.param-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.param-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.param-name {
  font-weight: 600;
  color: #1976d2;
  font-size: 16px;
}

.param-format {
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #666;
}

.param-value-preview {
  color: #1976d2;
  font-weight: 500;
}

.endpoints-section {
  margin-bottom: 20px;
}

.endpoints-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.endpoint-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.endpoint-item:hover {
  background: #e3f2fd;
  border-color: #1976d2;
}

.endpoint-item.active {
  background: #e3f2fd;
  border-color: #1976d2;
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.2);
}

.method-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: white;
  min-width: 60px;
  text-align: center;
}

.method-badge.get {
  background: #4caf50;
}

.method-badge.post {
  background: #2196f3;
}

.method-badge.put {
  background: #ff9800;
}

.method-badge.delete {
  background: #f44336;
}

.endpoint-path {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  flex: 1;
}

.params-count {
  background: #e0e0e0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.endpoint-testing {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
  margin-bottom: 20px;
}

.params-section {
  margin: 16px 0;
}

.param-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.param-label {
  min-width: 100px;
  font-weight: 500;
  color: #333;
}

.param-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.request-body-section {
  margin: 16px 0;
}

.request-body-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  resize: vertical;
}

.test-endpoint-btn {
  width: 100%;
  margin-top: 16px;
}

.manual-testing {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.manual-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.method-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  min-width: 100px;
}

.manual-path-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.endpoint-response-display {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
}

.response-status {
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: bold;
  margin-bottom: 12px;
}

.response-status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.response-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.response-headers,
.response-body {
  margin-bottom: 12px;
}

.headers-content,
.response-content {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border-left: 4px solid #1976d2;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  white-space: pre-wrap;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
}

.test-result-display {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 16px;
}

.test-result-content {
  background: #23272e;
  color: #f8f8f2;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  white-space: pre-wrap;
  line-height: 1.5;
  border-left: 4px solid #4caf50;
}
</style>
