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
                v-for="example in codeExamples"
                :key="example.id"
                class="code-example-item"
                @click="loadExampleCode(example)"
                :class="{ selected: selectedExampleIds.includes(example.id) }"
                style="cursor: pointer"
              >
                <div class="example-header">
                  <label>
                    <input
                      type="checkbox"
                      v-model="selectedExampleIds"
                      :value="example.id"
                      style="pointer-events: none"
                    />
                    <strong>{{ example.title }}</strong> <span>({{ example.language }})</span>
                  </label>
                </div>
                <div class="example-description">{{ example.description }}</div>
                <pre class="example-preview">{{ example.code }}</pre>
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
              <option value="cloudflare">🔥 Cloudflare Workers AI (Built-in & Fast)</option>
              <option value="openai">🧠 OpenAI GPT-4 (Technical & Structured)</option>
              <option value="gemini">⚡ Google Gemini-2.0-Flash (Fast & Efficient)</option>
            </select>
          </div>

          <!-- Available Services Information -->
          <div class="services-info-section">
            <div class="services-header" @click="showServicesInfo = !showServicesInfo">
              <h6>
                <span v-if="showServicesInfo">🔽</span>
                <span v-else>▶️</span>
                🔧 Available Services & APIs
              </h6>
              <span class="toggle-hint"
                >Click to {{ showServicesInfo ? 'hide' : 'show' }} details</span
              >
            </div>

            <div v-if="showServicesInfo" class="services-details">
              <div class="services-intro">
                <p>
                  <strong
                    >Your sandbox workers have access to these pre-configured services:</strong
                  >
                </p>
                <div class="r2-highlight">
                  🗄️ <strong>R2 Storage:</strong> Each sandbox gets its own R2 bucket for file
                  storage, accessible via <code>env.R2_BUCKET</code>
                </div>
              </div>

              <div class="service-cards">
                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('gemini')"
                >
                  <div class="service-header">
                    <span class="service-icon">🤖</span>
                    <strong>Google Gemini AI</strong>
                  </div>
                  <div class="service-description">
                    Generate text, analyze content, answer questions using Google's latest AI model
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Create a worker that uses Google Gemini API
                    with env.GOOGLE_GEMINI_API_KEY to answer questions. Use the correct Gemini
                    endpoint and include the env parameter in the handler function."
                  </div>
                  <div class="service-access">
                    <strong>Access via:</strong> <code>env.GOOGLE_GEMINI_API_KEY</code><br />
                    <strong>Endpoint:</strong> <code>generativelanguage.googleapis.com</code>
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('openai')"
                >
                  <div class="service-header">
                    <span class="service-icon">🧠</span>
                    <strong>OpenAI GPT</strong>
                  </div>
                  <div class="service-description">
                    Use GPT-4 and other OpenAI models for text generation and analysis
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Build a worker that uses GPT-4 to summarize
                    documents"
                  </div>
                  <div class="service-access">
                    <strong>Access via:</strong> <code>env.OPENAI_API_KEY</code>
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('pexels')"
                >
                  <div class="service-header">
                    <span class="service-icon">🖼️</span>
                    <strong>Pexels Images</strong>
                  </div>
                  <div class="service-description">
                    Search and retrieve high-quality stock photos and images
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Create an image search API using Pexels"
                  </div>
                  <div class="service-access">
                    <strong>Access via:</strong> <code>env.PEXELS_API_KEY</code>
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('youtube')"
                >
                  <div class="service-header">
                    <span class="service-icon">📺</span>
                    <strong>YouTube Data API</strong>
                  </div>
                  <div class="service-description">
                    Search YouTube videos, get video details and metadata
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Build a worker that searches YouTube for
                    educational videos"
                  </div>
                  <div class="service-access">
                    <strong>Access via:</strong> <code>env.YOUTUBE_API_KEY</code>
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div class="service-card clickable-service-card" @click="useServicePrompt('form')">
                  <div class="service-header">
                    <span class="service-icon">📝</span>
                    <strong>HTML Form Handler</strong>
                  </div>
                  <div class="service-description">
                    Create interactive HTML forms with validation and data processing
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Create a worker that serves an HTML contact
                    form and processes form submissions with validation"
                  </div>
                  <div class="service-access">
                    <strong>Features:</strong> Form validation, success pages, data processing<br />
                    <strong>Methods:</strong> GET (serve form), POST (process submission)
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('upload')"
                >
                  <div class="service-header">
                    <span class="service-icon">📁</span>
                    <strong>R2 File Upload Service</strong>
                  </div>
                  <div class="service-description">
                    Handle file uploads with R2 cloud storage, validation, and secure access
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Build a file upload worker that stores files
                    in R2 bucket, validates file types, and returns secure access URLs"
                  </div>
                  <div class="service-access">
                    <strong>Storage:</strong> <code>env.R2_BUCKET</code> (pre-configured)<br />
                    <strong>Features:</strong> Secure URLs, file validation, metadata
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('r2manager')"
                >
                  <div class="service-header">
                    <span class="service-icon">🗂️</span>
                    <strong>R2 File Manager</strong>
                  </div>
                  <div class="service-description">
                    Complete file management system with upload, list, download, and delete
                    operations
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Create an R2 file manager with web interface
                    for uploading, listing, downloading, and deleting files"
                  </div>
                  <div class="service-access">
                    <strong>Operations:</strong> CRUD operations on R2 files<br />
                    <strong>Interface:</strong> HTML file browser with drag-drop
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('staticsite')"
                >
                  <div class="service-header">
                    <span class="service-icon">🌐</span>
                    <strong>Static Site Hosting</strong>
                  </div>
                  <div class="service-description">
                    Host static websites and files directly from R2 storage with caching
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Build a static site hosting worker that serves
                    files from R2 with caching, custom domains, and directory listings"
                  </div>
                  <div class="service-access">
                    <strong>Features:</strong> CDN caching, custom domains, directory browsing<br />
                    <strong>Storage:</strong> R2 bucket integration
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>

                <div
                  class="service-card clickable-service-card"
                  @click="useServicePrompt('imagegallery')"
                >
                  <div class="service-header">
                    <span class="service-icon">🖼️</span>
                    <strong>Image Gallery & Processing</strong>
                  </div>
                  <div class="service-description">
                    Upload, resize, and display images with thumbnail generation and gallery
                    interface
                  </div>
                  <div class="service-example">
                    <strong>Example prompt:</strong> "Create an image gallery worker that uploads
                    images to R2, generates thumbnails, and displays them in a responsive gallery"
                  </div>
                  <div class="service-access">
                    <strong>Features:</strong> Image resizing, thumbnails, responsive gallery<br />
                    <strong>Processing:</strong> Automatic optimization and metadata
                  </div>
                  <div class="click-hint">👆 Click to use this example</div>
                </div>
              </div>

              <div class="services-tips">
                <h6>💡 Tips for Better Results:</h6>
                <ul>
                  <li>Mention specific APIs you want to use (e.g., "using Gemini API")</li>
                  <li>Specify the type of endpoints you need (GET, POST, etc.)</li>
                  <li>Include CORS handling if you plan to call from browsers</li>
                  <li>Ask for error handling and proper response formatting</li>
                  <li>
                    <strong>For R2 services:</strong> Mention file operations (upload, list, delete)
                    and UI requirements
                  </li>
                  <li>
                    <strong>For file uploads:</strong> Specify supported file types and size limits
                  </li>
                  <li>
                    <strong>For static sites:</strong> Include caching strategy and directory
                    structure needs
                  </li>
                </ul>
              </div>
            </div>
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
          <div class="generation-buttons">
            <button
              class="primary-btn generate-worker-btn"
              :disabled="isGeneratingWorker || !userPrompt.trim()"
              @click="generateWorker"
            >
              <span v-if="isGeneratingWorker">🔄 Generating Worker...</span>
              <span v-else>🤖 Generate AI Worker</span>
            </button>
            <button
              v-if="generatedCode || codeValidation || aiAnalysisResult"
              class="secondary-btn clear-all-btn"
              @click="resetWorkerGenerationState"
              title="Clear all generated code, validation results, and AI analysis"
            >
              🗑️ Clear All
            </button>
          </div>
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
              <div class="header-badges">
                <div class="model-badge" :class="`model-${selectedAIModel}`">
                  <span v-if="selectedAIModel === 'cloudflare'">🔥 Cloudflare AI</span>
                  <span v-else-if="selectedAIModel === 'openai'">🧠 GPT-4</span>
                  <span v-else-if="selectedAIModel === 'gemini'">⚡ Gemini-2.0</span>
                </div>
                <div
                  v-if="codeValidation"
                  class="validation-badge"
                  :class="
                    codeValidation.isValid && codeValidation.syntaxValid !== false
                      ? 'valid'
                      : 'invalid'
                  "
                >
                  <span v-if="codeValidation.isValid && codeValidation.syntaxValid !== false"
                    >✅ Valid</span
                  >
                  <span v-else-if="codeValidation.syntaxValid === false">❌ Syntax Error</span>
                  <span v-else>⚠️ Issues Found</span>
                </div>
              </div>
            </div>

            <!-- Validation Results -->
            <div v-if="codeValidation" class="validation-results">
              <div class="validation-score">
                <span class="score-label">Quality Score:</span>
                <span
                  class="score-value"
                  :class="
                    getScoreClass(codeValidation.syntaxValid === false ? 0 : codeValidation.score)
                  "
                >
                  {{ codeValidation.syntaxValid === false ? 0 : codeValidation.score }}/100
                </span>
                <span v-if="codeValidation.syntaxValid === false" class="syntax-error-note">
                  (Syntax errors detected - code cannot run)
                </span>
              </div>

              <div v-if="codeValidation.errors.length > 0" class="validation-errors">
                <h6>🚨 Errors (Must Fix):</h6>
                <ul>
                  <li v-for="error in codeValidation.errors" :key="error" class="error-item">
                    {{ error }}
                  </li>
                </ul>
              </div>

              <div v-if="codeValidation.warnings.length > 0" class="validation-warnings">
                <h6>⚠️ Warnings (Recommended):</h6>
                <ul>
                  <li
                    v-for="warning in codeValidation.warnings"
                    :key="warning"
                    class="warning-item"
                  >
                    {{ warning }}
                  </li>
                </ul>
              </div>

              <div v-if="validationRecommendations.length > 0" class="validation-recommendations">
                <h6>💡 Recommendations:</h6>
                <div
                  v-for="rec in validationRecommendations"
                  :key="rec.message"
                  class="recommendation-item"
                  :class="rec.type"
                >
                  <strong>{{ rec.message }}</strong>
                  <div class="fix-suggestion">Fix: {{ rec.fix }}</div>
                </div>
              </div>

              <!-- AI Analysis Button - Always Available -->
              <div v-if="generatedCode && generatedCode.trim()" class="ai-fix-section">
                <button
                  @click="analyzeAndFixCode"
                  :disabled="isAnalyzing || !generatedCode.trim()"
                  class="ai-fix-btn"
                >
                  <span v-if="isAnalyzing">🔍 AI Analyzing Code...</span>
                  <span v-else>🤖 AI Code Analysis</span>
                </button>
                <div class="ai-fix-hint">
                  AI will analyze your code for syntax errors, security issues, and best practices
                  using Cloudflare Workers AI
                </div>
              </div>
            </div>

            <!-- AI Analysis Results -->
            <div v-if="aiAnalysisResult" class="ai-analysis-results">
              <div class="analysis-header">
                <h6>🤖 AI Analysis Results</h6>
                <div class="score-improvement" v-if="aiAnalysisResult.fixed.score_improvement > 0">
                  Score improved: +{{ aiAnalysisResult.fixed.score_improvement }} points
                </div>
              </div>

              <div class="analysis-content">
                <div class="analysis-section">
                  <h6>🔍 Issues Found:</h6>
                  <ul class="issue-list">
                    <li v-for="issue in aiAnalysisResult.analysis.issues" :key="issue">
                      {{ issue }}
                    </li>
                  </ul>
                </div>

                <div class="analysis-section">
                  <h6>🔧 Fixes Applied:</h6>
                  <ul class="fix-list">
                    <li v-for="fix in aiAnalysisResult.analysis.fixes" :key="fix">
                      {{ fix }}
                    </li>
                  </ul>
                </div>

                <div class="analysis-section">
                  <h6>📝 Analysis:</h6>
                  <p class="analysis-text">{{ aiAnalysisResult.analysis.analysis }}</p>
                </div>

                <div class="analysis-section">
                  <h6>⚡ Improvements:</h6>
                  <p class="improvements-text">{{ aiAnalysisResult.analysis.improvements }}</p>
                </div>

                <div class="analysis-actions">
                  <div v-if="aiAnalysisResult.has_improvements" class="fixed-code-actions">
                    <button @click="applyFixedCode" class="apply-fix-btn">
                      ✅ Apply Improved Code
                    </button>
                    <button @click="showCodeComparison = !showCodeComparison" class="compare-btn">
                      👁️ {{ showCodeComparison ? 'Hide' : 'Show' }} Comparison
                    </button>
                  </div>
                  <div v-else class="analysis-note">
                    💡 <strong>Note:</strong> This analysis provides insights and recommendations.
                    Apply suggested fixes manually to your code above.
                  </div>
                </div>

                <!-- Code Comparison - Show when improvements are available -->
                <div
                  v-if="showCodeComparison && aiAnalysisResult.has_improvements"
                  class="code-comparison"
                >
                  <div class="comparison-header">
                    <div class="original-header">❌ Original (Issues)</div>
                    <div class="fixed-header">✅ Fixed Version</div>
                  </div>
                  <div class="comparison-content">
                    <textarea
                      class="original-code"
                      :value="generatedCode"
                      readonly
                      rows="15"
                    ></textarea>
                    <textarea
                      class="fixed-code"
                      :value="aiAnalysisResult.analysis.fixedCode"
                      readonly
                      rows="15"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <textarea
              v-model="generatedCode"
              class="generated-code-editor"
              rows="15"
              spellcheck="false"
              placeholder="Generated worker code will appear here..."
              @input="onCodeChange"
            ></textarea>
            <div class="code-editor-help">
              💡 <strong>Tip:</strong> You can edit the code above to fix any syntax errors before
              deployment.
              <br />
              🔍 <strong>Common fixes:</strong> Remove trailing commas, check matching braces {},
              ensure proper function syntax.
              <br />
              ⚠️ <strong>CRITICAL:</strong> Use ONLY classic addEventListener('fetch', ...) format.
              Do NOT use import statements or export default.
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
                <button @click="analyzeDeployedCode" :disabled="isAnalyzing" class="primary-btn">
                  <span v-if="isAnalyzing">🔍 Analyzing...</span>
                  <span v-else>🤖 AI Analyze Deployed Code</span>
                </button>
              </div>
              <div class="code-info-message">
                <div class="info-icon">💡</div>
                <div class="info-text">
                  <strong>Endpoints Auto-Detection:</strong> API endpoints from this deployed code
                  will be automatically detected and available for testing below.
                </div>
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

          <!-- AI Analysis Results for Deployed Code -->
          <div
            v-if="aiAnalysisResult && aiAnalysisResult.source === 'deployed_code'"
            class="ai-analysis-results"
          >
            <div class="analysis-header">
              <h6>🤖 Deployed Code Analysis Results</h6>
              <div class="score-improvement" v-if="aiAnalysisResult.fixed.score_improvement > 0">
                Score improved: +{{ aiAnalysisResult.fixed.score_improvement }} points
              </div>
            </div>

            <div class="analysis-content">
              <div class="analysis-section">
                <h6>🔍 Issues Found:</h6>
                <ul class="issue-list">
                  <li v-for="issue in aiAnalysisResult.analysis.issues" :key="issue">
                    {{ issue }}
                  </li>
                </ul>
              </div>

              <div class="analysis-section">
                <h6>🔧 Recommendations:</h6>
                <ul class="fix-list">
                  <li v-for="fix in aiAnalysisResult.analysis.fixes" :key="fix">
                    {{ fix }}
                  </li>
                </ul>
              </div>

              <div class="analysis-section">
                <h6>📝 Analysis:</h6>
                <p class="analysis-text">{{ aiAnalysisResult.analysis.analysis }}</p>
              </div>

              <div class="analysis-section">
                <h6>⚡ Improvements:</h6>
                <p class="improvements-text">{{ aiAnalysisResult.analysis.improvements }}</p>
              </div>

              <div class="analysis-actions">
                <div v-if="aiAnalysisResult.has_improvements" class="fixed-code-actions">
                  <button @click="applyImprovedToGenerated" class="apply-fix-btn">
                    ✅ Copy Improved Code to Create Tab
                  </button>
                  <button @click="showCodeComparison = !showCodeComparison" class="compare-btn">
                    👁️ {{ showCodeComparison ? 'Hide' : 'Show' }} Comparison
                  </button>
                </div>
                <div v-else class="analysis-note">
                  💡 <strong>Note:</strong> Your deployed code analysis is complete. Use the
                  insights above to improve future deployments.
                </div>
              </div>

              <!-- Code Comparison for Deployed Code -->
              <div
                v-if="showCodeComparison && aiAnalysisResult.has_improvements"
                class="code-comparison"
              >
                <div class="comparison-header">
                  <div class="original-header">❌ Currently Deployed</div>
                  <div class="fixed-header">✅ Improved Version</div>
                </div>
                <div class="comparison-content">
                  <textarea
                    class="original-code"
                    :value="deployedCode"
                    readonly
                    rows="15"
                  ></textarea>
                  <textarea
                    class="fixed-code"
                    :value="aiAnalysisResult.analysis.fixedCode"
                    readonly
                    rows="15"
                  ></textarea>
                </div>
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
              <div class="endpoints-header">
                <h5>📍 Detected Endpoints</h5>
                <div
                  v-if="detectedEndpoints[0]?.source"
                  class="endpoints-source-badge"
                  :class="`source-${detectedEndpoints[0].source}`"
                >
                  <span v-if="detectedEndpoints[0].source === 'generated'"
                    >🆕 From Generated Code</span
                  >
                  <span v-else-if="detectedEndpoints[0].source === 'deployed'"
                    >🚀 From Deployed Code</span
                  >
                  <span v-else>📄 From Code</span>
                </div>
              </div>
              <div class="endpoints-help">
                💡 <strong>Tip:</strong> These endpoints were automatically detected from your
                <strong>{{ detectedEndpoints[0]?.source || 'worker' }}</strong> code. Click on one
                to test it.
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
import { ref, computed, watch, nextTick } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

// Initialize the knowledge graph store
const knowledgeGraphStore = useKnowledgeGraphStore()

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
const selectedExampleIds = ref([])
const userPrompt = ref('')
const selectedAIModel = ref('cloudflare') // Default to Cloudflare Workers AI
const isGeneratingWorker = ref(false)
const generatedCode = ref('')
const sandboxTestResult = ref(null)
const isDeployingWorker = ref(false)
const deployMessage = ref('')
const isSavingWorker = ref(false)
isSavingWorker.value = false
const saveMessage = ref('')
const showServicesInfo = ref(false) // Controls visibility of services information
const codeValidation = ref(null) // Stores validation results
const validationRecommendations = ref([]) // Stores validation recommendations
const isValidating = ref(false) // Loading state for validation
const isAnalyzing = ref(false) // Loading state for AI analysis
const aiAnalysisResult = ref(null) // Stores AI analysis results
const showCodeComparison = ref(false) // Controls code comparison visibility

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

// Reset all state when modal becomes visible
const resetWorkerGenerationState = () => {
  // Reset worker generation state
  generatedCode.value = ''
  userPrompt.value = ''
  selectedExampleIds.value = []

  // Reset validation state
  codeValidation.value = null
  validationRecommendations.value = []
  isValidating.value = false

  // Reset AI analysis state
  aiAnalysisResult.value = null
  isAnalyzing.value = false
  showCodeComparison.value = false

  // Reset deployment state
  deployMessage.value = ''
  saveMessage.value = ''
  isDeployingWorker.value = false
  isSavingWorker.value = false

  // Reset testing state
  sandboxTestResult.value = null
  detectedEndpoints.value = []
  selectedEndpoint.value = null
  testParams.value = {}
  testRequestBody.value = ''
  endpointResponse.value = null

  // Reset other states
  deployedCode.value = ''
  codeError.value = ''
  codeTimestamp.value = ''
}

// Reset to create tab when modal becomes visible
watch(
  () => props.isVisible,
  (newVal) => {
    if (newVal) {
      activeTab.value = 'create'
      resetWorkerGenerationState()
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
    // Extract pathname checks and route patterns - handles both old and modern formats
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
      } catch {
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

// 1. Replace all code examples and templates with classic worker syntax
const defaultClassicExample = `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  return new Response('Hello from classic worker!', {
    headers: { 'Content-Type': 'text/plain' }
  })
}`

// Update fallback codeExamples to use defaultClassicExample
const codeExamples = ref([
  {
    id: 'basic-worker',
    title: 'Basic Classic Worker',
    language: 'JavaScript',
    description: 'A simple classic worker using addEventListener.',
    code: defaultClassicExample,
  },
])

// 2. Update AI prompt in generateWorker to instruct classic worker code
// Replace the prompt string in generateWorker with instructions to use addEventListener('fetch', ...), not export default
// ...

// 3. Remove logic that converts classic to ESM; block ESM instead
// In loadExampleCode and generateWorker, if code contains 'export default', show a warning or block
const loadExampleCode = (example) => {
  console.log('📋 Loading example code:', example.title)
  let codeToLoad = example.code
  if (/export\s+default/.test(codeToLoad)) {
    deployMessage.value =
      '❌ ESM (export default) syntax is not supported. Please use classic addEventListener format.'
    return
  }
  generatedCode.value = codeToLoad
  userPrompt.value = `Load example: ${example.title}`
  selectedExampleIds.value = [example.id]
  codeValidation.value = null
  aiAnalysisResult.value = null
  deployMessage.value = ''
  saveMessage.value = ''
  console.log(`✅ Loaded example: ${example.title}`)
  console.log(`📝 Code length: ${codeToLoad.length}`)
  console.log(`🔍 Code preview: ${codeToLoad.substring(0, 100)}...`)
  nextTick(() => {
    console.log(`🔄 After nextTick - generatedCode length: ${generatedCode.value.length}`)
  })
}

// 4. Update helper text and tooltips for classic worker only
// In the code-editor-help and other UI text, clarify only classic worker syntax is supported
// Example:
// 💡 Tip: Use classic Cloudflare Worker syntax: addEventListener('fetch', ...). Do NOT use export default or import statements.
// ...

// 5. Remove references to ESM or export default in comments and documentation
// ... existing code ...

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

    // Note: selectedExamples are passed in the API request body, not used in prompt directly

    const prompt = `IMPORTANT: You are generating a Cloudflare Worker using the CLASSIC format. Use the working example as your template.

User Request: ${userPrompt.value.trim() || 'Create a basic worker'}

CRITICAL: Follow this EXACT working pattern from the provided working example. This format is PROVEN to work correctly:

1. ALWAYS use: addEventListener('fetch', event => { event.respondWith(...) })
2. DO NOT use export default or ESM syntax
3. DO NOT use import statements
4. ALWAYS handle CORS if needed
5. ALWAYS use try-catch for error handling
6. ALWAYS include debug endpoint for testing if possible

AVAILABLE ENVIRONMENT VARIABLES:
- GOOGLE_GEMINI_API_KEY: Google Gemini AI
- OPENAI_API_KEY: OpenAI GPT models
- PEXELS_API_KEY: Pexels image search
- YOUTUBE_API_KEY: YouTube Data API

API ENDPOINTS:
- Gemini: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent (use x-goog-api-key header)
- OpenAI: https://api.openai.com/v1/chat/completions (use Bearer token)
- Pexels: https://api.pexels.com/v1/search (use Authorization header)
- YouTube: https://www.googleapis.com/youtube/v3/search (use key parameter)

CRITICAL RULES:
❌ DO NOT use import statements
❌ DO NOT use export default or ESM syntax
✅ DO use addEventListener('fetch', ...)
✅ DO include /debug endpoint if possible
✅ DO use proper error handling

Generate ONLY the JavaScript code following the working example pattern. No markdown, no explanations.`

    console.log('📡 Calling worker generation API with Cloudflare AI...')

    // Use Cloudflare Workers AI binding for better, more consistent results
    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/generate-worker-ai',
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
          useCloudflareAI: true, // Flag to use Workers AI binding
          workingExample: `addEventListener('fetch', event => {
  event.respondWith(new Response('Hello from classic worker!'))
})`,
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

    // CRITICAL: Remove import statements that cause deployment errors
    if (cleanedCode.includes('import')) {
      console.log('🔧 Removing import statements...')
      // Remove all import statements (single line and multiline)
      cleanedCode = cleanedCode
        .replace(/import\s+.*?from\s+['"][^'"]*['"]\s*;?\s*\n?/g, '')
        .replace(/import\s+['"][^'"]*['"]\s*;?\s*\n?/g, '')
        .replace(/import\s*\{[^}]*\}\s*from\s+['"][^'"]*['"]\s*;?\s*\n?/g, '')
        .replace(/import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]*['"]\s*;?\s*\n?/g, '')
    }

    // Handle old addEventListener format - convert to modern format if needed
    if (cleanedCode.includes('addEventListener')) {
      console.log('🔧 Converting old addEventListener format to modern export default format...')
      // Extract the handler function
      const handlerMatch = cleanedCode.match(
        /async\s+function\s+\w+\s*\(\s*request\s*(?:,\s*env\s*(?:,\s*ctx\s*)?)?\s*\)\s*{([\s\S]*?)}\s*$/,
      )

      if (handlerMatch) {
        // Convert old handler to classic format
        cleanedCode = `addEventListener('fetch', event => {
  event.respondWith(new Response('Hello from classic worker!'))
})`
      } else {
        // Fallback: wrap everything in export default format
        cleanedCode = cleanedCode
          .replace(
            /addEventListener\(['"]fetch['"],\s*(?:event\s*=>\s*{\s*)?event\.respondWith\([\w.()]+\)\s*(?:}\s*)?/g,
            '',
          )
          .replace(/async\s+function\s+\w+\s*\(/g, 'async fetch(')
          .replace(/^/, 'export default {\n  ')
          .replace(/$/, '\n}')
      }
    }

    // Ensure modern export default format is used
    if (!cleanedCode.includes('export default')) {
      console.log('🔧 Adding export default wrapper...')
      cleanedCode = `export default {
  async fetch(request, env, ctx) {
    ${cleanedCode}
  }
}`
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

    // Extract validation info from API response if available
    if (result.validation) {
      codeValidation.value = result.validation
    }

    // Auto-validate the generated code
    await validateGeneratedCode(cleanedCode)

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

// testInSandbox function removed - users now use manual endpoint testing interface

const deployWorker = async () => {
  if (!generatedCode.value || !generatedCode.value.trim()) {
    deployMessage.value = '❌ No code to deploy! Generate a worker first.'
    return
  }
  if (/export\s+default/.test(generatedCode.value)) {
    deployMessage.value =
      '❌ ESM (export default) syntax is not supported. Please use classic addEventListener format.'
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
  saveMessage.value = '💾 Saving worker to knowledge graph...'

  try {
    // Step 1: Prompt for label/description
    let label = prompt('Enter a label for this worker node:', 'Generated Worker')
    if (!label) label = 'Generated Worker'

    // Step 2: Create new worker-code node with proper structure
    const newNode = {
      id: uuidv4(),
      label,
      color: 'gray',
      type: 'worker-code',
      info: generatedCode.value,
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }

    // Step 3: Add node to the knowledge graph store (this will handle API calls)
    await knowledgeGraphStore.addNode(newNode)

    saveMessage.value = '✅ Worker saved to knowledge graph as a reusable example!'

    // Step 4: Refresh the code examples to include the newly saved worker
    const workerCodeExamples = await fetchWorkerCodeNodes()
    if (workerCodeExamples.length > 0) {
      codeExamples.value = workerCodeExamples
      console.log('📝 Code examples refreshed with new worker-code node')
    }
  } catch (e) {
    console.error('Error saving worker to knowledge graph:', e)
    saveMessage.value = `❌ Save failed: ${e.message}`
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

// Unified function to analyze endpoints from any code source
const analyzeEndpointsFromCode = (code, source = 'unknown') => {
  if (code && code.trim()) {
    console.log(`🔍 Analyzing ${source} code for endpoints...`)
    const endpoints = analyzeCodeForEndpoints(code)
    console.log(`📍 Detected endpoints from ${source}:`, endpoints)

    // Add source information to endpoints
    const endpointsWithSource = endpoints.map((endpoint) => ({
      ...endpoint,
      source: source,
    }))

    detectedEndpoints.value = endpointsWithSource

    // Auto-select first endpoint if available and no endpoint is currently selected
    if (endpointsWithSource.length > 0 && !selectedEndpoint.value) {
      selectEndpoint(endpointsWithSource[0])
    }
  } else {
    detectedEndpoints.value = []
    selectedEndpoint.value = null
  }
}

// Analyze generated code for endpoints
watch(
  () => generatedCode.value,
  (newCode) => {
    // Only analyze generated code if there's no deployed code or if we're on the create tab
    if (activeTab.value === 'create' || !deployedCode.value) {
      analyzeEndpointsFromCode(newCode, 'generated')
    }
  },
  { immediate: true },
)

// Analyze deployed code for endpoints when it's fetched
watch(
  () => deployedCode.value,
  (newCode) => {
    // Only analyze deployed code if we're on the test tab or if there's no generated code
    if (activeTab.value === 'test' || !generatedCode.value) {
      analyzeEndpointsFromCode(newCode, 'deployed')
    }
  },
  { immediate: true },
)

// Switch endpoint source based on active tab
watch(
  () => activeTab.value,
  (newTab) => {
    if (newTab === 'create' && generatedCode.value) {
      analyzeEndpointsFromCode(generatedCode.value, 'generated')
    } else if (newTab === 'test' && deployedCode.value) {
      analyzeEndpointsFromCode(deployedCode.value, 'deployed')
    }
  },
)

// Note: Removed auto-switch to test tab - let user manually switch when ready

// Function to fetch worker-code nodes from the current knowledge graph
const fetchWorkerCodeNodes = async () => {
  try {
    // Get nodes from the knowledge graph store
    const nodes = knowledgeGraphStore.nodes || []

    // Filter nodes with type "worker-code"
    const workerCodeNodes = nodes.filter(
      (node) => node.data && node.data.type === 'worker-code' && node.data.info,
    )

    console.log('Found worker-code nodes:', workerCodeNodes.length)

    // Convert nodes to code examples format
    return workerCodeNodes.map((node) => ({
      id: node.data.id,
      title: node.data.label || 'Untitled Worker',
      language: 'JavaScript',
      description: `Worker code from knowledge graph node: ${node.data.label}`,
      code: node.data.info,
    }))
  } catch (error) {
    console.error('Error fetching worker-code nodes:', error)
    return []
  }
}

// Validation methods for generated worker code
const validateGeneratedCode = async (code) => {
  if (!code || !code.trim()) {
    codeValidation.value = null
    validationRecommendations.value = []
    return
  }

  isValidating.value = true

  try {
    console.log('🔍 Validating generated worker code...')

    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/validate-worker',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code }),
      },
    )

    if (!response.ok) {
      throw new Error(`Validation API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      codeValidation.value = result.validation
      validationRecommendations.value = result.recommendations || []

      console.log('✅ Code validation completed:', {
        score: result.validation.score,
        errors: result.validation.errors.length,
        warnings: result.validation.warnings.length,
        recommendations: result.recommendations.length,
      })
    } else {
      console.error('Validation failed:', result)
    }
  } catch (error) {
    console.error('❌ Code validation error:', error)
    codeValidation.value = {
      isValid: false,
      errors: [`Validation service error: ${error.message}`],
      warnings: [],
      score: 0,
    }
    validationRecommendations.value = []
  } finally {
    isValidating.value = false
  }
}

const onCodeChange = async () => {
  // Debounce validation to avoid too many API calls
  if (validateTimeout) {
    clearTimeout(validateTimeout)
  }

  validateTimeout = setTimeout(() => {
    validateGeneratedCode(generatedCode.value)
  }, 1000) // Wait 1 second after user stops typing
}

const getScoreClass = (score) => {
  if (score >= 80) return 'score-excellent'
  if (score >= 60) return 'score-good'
  if (score >= 40) return 'score-fair'
  return 'score-poor'
}

let validateTimeout = null

// AI Analysis and Fix methods
const analyzeAndFixCode = async () => {
  if (!generatedCode.value || !generatedCode.value.trim()) {
    return
  }

  isAnalyzing.value = true
  aiAnalysisResult.value = null

  try {
    console.log('🤖 Starting AI analysis and fix...')

    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/analyze-worker-code',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          code: generatedCode.value,
          analysisType: 'comprehensive',
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Analysis API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      // Transform dev-worker response to match expected format
      aiAnalysisResult.value = {
        success: true,
        analysis: {
          analysis: result.analysis.summary || 'Code analysis completed',
          issues: result.analysis.issues?.map((issue) => issue.message) || [],
          fixes: result.analysis.recommendations?.map((rec) => rec.suggestion) || [],
          fixedCode: result.improved_code || generatedCode.value, // Use improved code from dev-worker
          improvements:
            result.analysis.recommendations?.map((rec) => rec.suggestion).join('; ') ||
            'No specific improvements suggested',
        },
        fixed: {
          score_improvement: Math.max(0, (result.analysis.overall_score || 0) - 50), // Estimate improvement
        },
        has_improvements: result.has_improvements || false,
      }

      console.log('✅ AI analysis completed:', {
        overall_score: result.analysis.overall_score,
        issues_found: result.analysis.issues?.length || 0,
        recommendations: result.analysis.recommendations?.length || 0,
        deployment_ready: result.analysis.deployment_ready,
      })
    } else {
      throw new Error(result.error || 'Analysis failed')
    }
  } catch (error) {
    console.error('❌ AI analysis error:', error)
    aiAnalysisResult.value = {
      success: false,
      error: error.message,
      analysis: {
        analysis: `Analysis failed: ${error.message}`,
        issues: ['Unable to connect to analysis service'],
        fixes: [],
        fixedCode: generatedCode.value,
        improvements: 'Please check your internet connection and try again.',
      },
    }
  } finally {
    isAnalyzing.value = false
  }
}

const applyFixedCode = () => {
  if (aiAnalysisResult.value?.analysis?.fixedCode) {
    generatedCode.value = aiAnalysisResult.value.analysis.fixedCode

    // Re-validate the improved code
    validateGeneratedCode(generatedCode.value)

    // Reset analysis result since we've applied the fix
    aiAnalysisResult.value = null
    showCodeComparison.value = false

    console.log('✅ Improved code applied successfully!')
  }
}

// AI Analysis for deployed code
const analyzeDeployedCode = async () => {
  if (!deployedCode.value || !deployedCode.value.trim()) {
    alert('No deployed code available to analyze. Please fetch the current code first.')
    return
  }

  isAnalyzing.value = true
  aiAnalysisResult.value = null

  try {
    console.log('🤖 Starting AI analysis of deployed code...')

    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/analyze-worker-code',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          code: deployedCode.value,
          analysisType: 'comprehensive',
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Analysis API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      // Transform dev-worker response to match expected format
      aiAnalysisResult.value = {
        success: true,
        analysis: {
          analysis: result.analysis.summary || 'Deployed code analysis completed',
          issues: result.analysis.issues?.map((issue) => issue.message) || [],
          fixes: result.analysis.recommendations?.map((rec) => rec.suggestion) || [],
          fixedCode: result.improved_code || deployedCode.value, // Use improved code from dev-worker
          improvements:
            result.analysis.recommendations?.map((rec) => rec.suggestion).join('; ') ||
            'No specific improvements suggested',
        },
        fixed: {
          score_improvement: Math.max(0, (result.analysis.overall_score || 0) - 50), // Estimate improvement
        },
        has_improvements: result.has_improvements || false,
        source: 'deployed_code', // Mark this as analysis of deployed code
      }

      console.log('✅ Deployed code analysis completed:', {
        overall_score: result.analysis.overall_score,
        issues_found: result.analysis.issues?.length || 0,
        recommendations: result.analysis.recommendations?.length || 0,
        deployment_ready: result.analysis.deployment_ready,
      })

      // Scroll to show the analysis results
      setTimeout(() => {
        const analysisSection = document.querySelector('.ai-analysis-results')
        if (analysisSection) {
          analysisSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    } else {
      throw new Error(result.error || 'Analysis failed')
    }
  } catch (error) {
    console.error('❌ Deployed code analysis error:', error)
    aiAnalysisResult.value = {
      success: false,
      error: error.message,
      analysis: {
        analysis: `Analysis failed: ${error.message}`,
        issues: ['Unable to connect to analysis service'],
        fixes: [],
        fixedCode: deployedCode.value,
        improvements: 'Please check your internet connection and try again.',
      },
      source: 'deployed_code',
    }
  } finally {
    isAnalyzing.value = false
  }
}

// Copy improved deployed code to the Create tab
const applyImprovedToGenerated = () => {
  if (aiAnalysisResult.value?.analysis?.fixedCode) {
    generatedCode.value = aiAnalysisResult.value.analysis.fixedCode

    // Switch to Create tab to show the improved code
    activeTab.value = 'create'

    // Reset analysis result and validation
    aiAnalysisResult.value = null
    showCodeComparison.value = false

    // Re-validate the improved code
    setTimeout(() => {
      validateGeneratedCode(generatedCode.value)
    }, 100)

    console.log('✅ Improved deployed code copied to Create tab!')

    // Scroll to the code editor in Create tab
    setTimeout(() => {
      const codeEditor = document.querySelector('.generated-code-editor')
      if (codeEditor) {
        codeEditor.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 200)
  }
}

// Fetch code examples from the Knowledge Graph after sandbox creation
watch(
  () => sandboxResult.value,
  async (newVal) => {
    if (newVal) {
      isLoadingExamples.value = true
      try {
        // First, try to fetch worker-code nodes from the current knowledge graph
        const workerCodeExamples = await fetchWorkerCodeNodes()

        // If we have worker-code nodes, use them
        if (workerCodeExamples.length > 0) {
          codeExamples.value = workerCodeExamples
        } else {
          // Fallback to default examples with pre-configured environment variables
          codeExamples.value = [
            {
              id: 'gemini-api',
              title: 'Google Gemini AI API',
              language: 'JavaScript',
              description:
                'Worker that uses Google Gemini AI to generate responses from user queries.',
              code: `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  if (request.method === 'POST') {
    try {
      const { prompt } = await request.json()

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GOOGLE_GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  return new Response('Send POST request with {"prompt": "your question"}', {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}`,
            },
            {
              id: 'openai-api',
              title: 'OpenAI GPT API',
              language: 'JavaScript',
              description: 'Worker that uses OpenAI GPT models to process text requests.',
              code: `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  if (request.method === 'POST') {
    try {
      const { prompt, model = 'gpt-4' } = await request.json()

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${OPENAI_API_KEY}\`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500
        })
      })

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }

  return new Response('Send POST request with {"prompt": "your question", "model": "gpt-4"}')
}`,
            },
            {
              id: 'pexels-images',
              title: 'Pexels Image Search',
              language: 'JavaScript',
              description: 'Worker that searches for images using the Pexels API.',
              code: `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const url = new URL(request.url)
  const query = url.searchParams.get('q') || 'nature'
  const perPage = url.searchParams.get('per_page') || '10'

  try {
    const response = await fetch(\`https://api.pexels.com/v1/search?query=\${encodeURIComponent(query)}&per_page=\${perPage}\`, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}`,
            },
            {
              id: 'youtube-search',
              title: 'YouTube Video Search',
              language: 'JavaScript',
              description: 'Worker that searches YouTube videos using the YouTube Data API.',
              code: `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const url = new URL(request.url)
  const query = url.searchParams.get('q') || 'cloudflare workers'
  const maxResults = url.searchParams.get('maxResults') || '10'

  try {
    const response = await fetch(\`https://www.googleapis.com/youtube/v3/search?part=snippet&q=\${encodeURIComponent(query)}&maxResults=\${maxResults}&key=\${YOUTUBE_API_KEY}\`)

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}`,
            },
            {
              id: 'basic-worker',
              title: 'Basic API Worker',
              language: 'JavaScript',
              description:
                'A simple worker that demonstrates basic API structure with CORS support.',
              code: `addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const url = new URL(request.url)

  // Simple routing
  if (url.pathname === '/hello') {
    return new Response(JSON.stringify({ message: 'Hello World!' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  if (url.pathname === '/time') {
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      timezone: 'UTC'
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Default response
  return new Response(JSON.stringify({
    endpoints: ['/hello', '/time'],
    message: 'Welcome to your sandbox worker!'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}`,
            },
          ]
        }
      } catch {
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

// Method to populate prompt textarea when service card is clicked
const useServicePrompt = (serviceType) => {
  const servicePrompts = {
    gemini:
      'Create a Cloudflare Worker that uses Google Gemini API. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.GOOGLE_GEMINI_API_KEY for authentication. Use the endpoint https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent with x-goog-api-key header. Include CORS headers and handle OPTIONS requests. Accept POST requests with {"prompt": "text"} and return JSON responses. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    openai:
      'Create a Cloudflare Worker that uses OpenAI GPT-4. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.OPENAI_API_KEY with Bearer token. Use https://api.openai.com/v1/chat/completions endpoint. Include CORS headers, handle OPTIONS requests. Accept POST with {"prompt": "text", "model": "gpt-4"} and return JSON. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    pexels:
      'Create a Cloudflare Worker for Pexels image search. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.PEXELS_API_KEY in Authorization header. Use https://api.pexels.com/v1/search endpoint. Support both "query" and "q" parameters, plus "per_page" and "page" parameters. Include CORS headers with Access-Control-Allow-Origin: "*". Handle OPTIONS requests properly. Use encodeURIComponent for all URL parameters. Include proper error handling with try-catch blocks. Add /debug endpoint that returns JSON with available environment variables. Main endpoints should be "/" and "/search" for image search. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    youtube:
      'Create a Cloudflare Worker for YouTube video search. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.YOUTUBE_API_KEY. Use https://www.googleapis.com/youtube/v3/search endpoint with part=snippet, q, maxResults, and key parameters. Include CORS headers, handle OPTIONS requests, use encodeURIComponent for search terms. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    form: 'Create a Cloudflare Worker that serves HTML forms. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. For GET requests, return HTML form with name, email, message fields and proper CSS styling. For POST requests, parse formData, validate inputs, and return success/error HTML pages. Include CORS headers and handle OPTIONS requests. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    upload:
      'Create a Cloudflare Worker for R2 file uploads. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.R2_BUCKET_BINDING (R2 bucket binding) for direct access. For GET requests, serve HTML upload interface with drag-drop. For POST requests, validate file types (jpg,png,pdf,txt), check file sizes, upload to R2 using put() method, return JSON with file URLs. Include CORS headers. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    r2manager:
      'Create a Cloudflare Worker for complete R2 file management. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.R2_BUCKET_BINDING (R2 bucket binding) for direct access. Handle GET / (serve HTML file browser), GET /list (return JSON file list with list() method), POST /upload (handle file uploads with put() method), DELETE /delete (delete files with delete() method). Include responsive HTML interface with file icons and drag-drop upload. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    staticsite:
      'Create a Cloudflare Worker for static site hosting from R2. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.R2_BUCKET_BINDING for storage access. Parse URL pathname, fetch files from R2 using get() method, set proper Content-Type headers based on file extensions, add cache headers (max-age=3600), support index.html files for directories. Handle 404 errors gracefully with proper status codes. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
    imagegallery:
      'Create a Cloudflare Worker for image gallery with R2 storage. CRITICAL: DO NOT USE import statements or export default. IMPORTANT: Use ONLY classic addEventListener("fetch", ...) format. Use env.R2_BUCKET_BINDING for storage access. For GET requests, serve HTML gallery interface with responsive grid, lightbox viewer, lazy loading. For POST /upload, accept image files, validate types (jpg,png,gif,webp), store in R2 using put() method, return JSON with image URLs and metadata. Start with addEventListener("fetch", event => { event.respondWith(handleRequest(event.request)) }) pattern.',
  }

  if (servicePrompts[serviceType]) {
    userPrompt.value = servicePrompts[serviceType]
    // Scroll to the prompt textarea to show it's been populated
    const textarea = document.getElementById('user-prompt-textarea')
    if (textarea) {
      textarea.focus()
      textarea.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}
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

.model-badge.model-cloudflare {
  background: linear-gradient(135deg, #f38020, #f56500);
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

.code-info-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #f0f7ff;
  border-top: 1px solid #b3d9ff;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

.info-icon {
  font-size: 16px;
  margin-top: 2px;
}

.info-text {
  font-size: 13px;
  color: #0056b3;
  line-height: 1.4;
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

.endpoints-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.endpoints-header h5 {
  margin: 0;
}

.endpoints-source-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
}

.endpoints-source-badge.source-generated {
  background: #e8f5e8;
  color: #2e7d32;
  border-color: #4caf50;
}

.endpoints-source-badge.source-deployed {
  background: #e3f2fd;
  color: #1976d2;
  border-color: #2196f3;
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

/* Services Information Section */
.services-info-section {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin: 16px 0;
}

.services-header {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 8px 8px 0 0;
  transition: background 0.2s ease;
}

.services-header:hover {
  background: linear-gradient(135deg, #bbdefb 0%, #e1bee7 100%);
}

.services-header h6 {
  margin: 0;
  color: #1976d2;
  font-weight: 600;
}

.toggle-hint {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.services-details {
  padding: 16px;
  border-top: 1px solid #e9ecef;
}

.services-intro {
  margin-bottom: 16px;
}

.services-intro p {
  margin: 0;
  color: #333;
}

.r2-highlight {
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 100%);
  border: 1px solid #4caf50;
  border-radius: 6px;
  padding: 12px;
  margin: 12px 0;
  font-size: 14px;
}

.r2-highlight code {
  background: #e8f5e8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #2e7d32;
  font-size: 12px;
}

.service-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.service-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.service-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.clickable-service-card {
  cursor: pointer;
  position: relative;
}

.clickable-service-card:hover {
  border-color: #1976d2;
  box-shadow: 0 6px 20px rgba(25, 118, 210, 0.15);
  transform: translateY(-3px);
}

.clickable-service-card:active {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.2);
}

.click-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #1976d2, #42a5f5);
  color: white;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.clickable-service-card:hover .click-hint {
  opacity: 1;
}

.service-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.service-icon {
  font-size: 20px;
}

.service-description {
  color: #666;
  font-size: 14px;
  margin-bottom: 12px;
  line-height: 1.4;
}

.service-example {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #1976d2;
  font-size: 13px;
  margin-bottom: 8px;
}

.service-example strong {
  color: #1976d2;
}

.service-access {
  font-size: 12px;
  color: #666;
}

.service-access code {
  background: #e8f5e8;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #2e7d32;
  font-size: 11px;
}

.services-tips {
  background: #fff3e0;
  border: 1px solid #ffcc02;
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
}

.services-tips h6 {
  margin: 0 0 12px 0;
  color: #f57c00;
}

.services-tips ul {
  margin: 0;
  padding-left: 20px;
}

.services-tips li {
  margin-bottom: 6px;
  color: #333;
  font-size: 14px;
}

/* Generation Buttons */
.generation-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.clear-all-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.clear-all-btn:hover {
  background: #d32f2f;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.2);
}

.clear-all-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(244, 67, 54, 0.2);
}

/* Validation Styles */
.header-badges {
  display: flex;
  gap: 8px;
  align-items: center;
}

.validation-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.validation-badge.valid {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.validation-badge.invalid {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #f44336;
}

.validation-results {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
}

.validation-score {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.score-label {
  font-weight: 500;
  color: #333;
}

.score-value {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 14px;
}

.score-excellent {
  background: #e8f5e8;
  color: #2e7d32;
}

.score-good {
  background: #e3f2fd;
  color: #1976d2;
}

.score-fair {
  background: #fff3e0;
  color: #f57c00;
}

.score-poor {
  background: #ffebee;
  color: #c62828;
}

.syntax-error-note {
  font-size: 12px;
  color: #c62828;
  font-style: italic;
  margin-left: 8px;
}

.validation-errors {
  margin-bottom: 12px;
}

.validation-errors h6 {
  margin: 0 0 8px 0;
  color: #c62828;
  font-size: 14px;
}

.validation-errors ul {
  margin: 0;
  padding-left: 20px;
}

.error-item {
  color: #c62828;
  margin-bottom: 4px;
  font-size: 13px;
}

.validation-warnings {
  margin-bottom: 12px;
}

.validation-warnings h6 {
  margin: 0 0 8px 0;
  color: #f57c00;
  font-size: 14px;
}

.validation-warnings ul {
  margin: 0;
  padding-left: 20px;
}

.warning-item {
  color: #f57c00;
  margin-bottom: 4px;
  font-size: 13px;
}

.validation-recommendations {
  margin-top: 12px;
}

.validation-recommendations h6 {
  margin: 0 0 8px 0;
  color: #1976d2;
  font-size: 14px;
}

.recommendation-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.recommendation-item.error {
  border-left: 4px solid #f44336;
}

.recommendation-item.warning {
  border-left: 4px solid #ff9800;
}

.fix-suggestion {
  margin-top: 4px;
  font-style: italic;
  color: #666;
  font-size: 12px;
}

/* AI Analysis and Fix Styles */
.ai-fix-section {
  margin-top: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 100%);
  border: 1px solid #4caf50;
  border-radius: 8px;
  text-align: center;
}

.ai-fix-btn {
  background: linear-gradient(135deg, #4caf50 0%, #2196f3 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-fix-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.ai-fix-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.ai-fix-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #2e7d32;
  font-style: italic;
}

.ai-analysis-results {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-top: 16px;
  overflow: hidden;
}

.analysis-header {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.analysis-header h6 {
  margin: 0;
  color: #1976d2;
  font-size: 16px;
}

.score-improvement {
  background: #e8f5e8;
  color: #2e7d32;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.analysis-content {
  padding: 16px;
}

.analysis-section {
  margin-bottom: 16px;
}

.analysis-section h6 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 14px;
}

.issue-list,
.fix-list {
  margin: 0;
  padding-left: 20px;
}

.issue-list li {
  color: #c62828;
  margin-bottom: 4px;
  font-size: 13px;
}

.fix-list li {
  color: #2e7d32;
  margin-bottom: 4px;
  font-size: 13px;
}

.analysis-text,
.improvements-text {
  margin: 0;
  color: #555;
  font-size: 14px;
  line-height: 1.5;
  background: white;
  padding: 12px;
  border-radius: 4px;
  border-left: 4px solid #1976d2;
}

.improvements-text {
  border-left-color: #4caf50;
}

.analysis-actions {
  margin: 16px 0;
}

.analysis-note {
  background: #f0f7ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
  padding: 12px;
  color: #0056b3;
  font-size: 14px;
}

.fixed-code-actions {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}

.apply-fix-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.apply-fix-btn:hover {
  background: #45a049;
}

.compare-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.compare-btn:hover {
  background: #1976d2;
}

.code-comparison {
  margin-top: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}

.comparison-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #f5f5f5;
}

.original-header,
.fixed-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.original-header {
  color: #c62828;
  background: #ffebee;
  border-right: 1px solid #e0e0e0;
}

.fixed-header {
  color: #2e7d32;
  background: #e8f5e8;
}

.comparison-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}

.original-code,
.fixed-code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  border: none;
  padding: 12px;
  resize: none;
  background: white;
}

.original-code {
  border-right: 1px solid #e0e0e0;
  background: #fffbfb;
}

.fixed-code {
  background: #f8fff8;
}

.code-example-item.selected {
  border: 2px solid #1976d2;
  background: #e3f2fd;
}
</style>
