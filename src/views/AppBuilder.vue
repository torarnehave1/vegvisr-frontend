<template>
  <div class="app-builder">
    <div class="builder-header">
      <div class="header-content">
        <h1>🚀 App Builder</h1>
        <p class="subtitle">Create and deploy custom applications powered by AI and Cloudflare Workers</p>
      </div>
      <div class="header-actions">
        <button @click="startNewApp" class="btn-success" title="Start a fresh new app">
          ✨ New App
        </button>
        <router-link to="/app-history" class="btn-secondary btn-link">
          📱 My Apps
        </router-link>
        <button @click="showTemplates = !showTemplates" class="btn-secondary">
          {{ showTemplates ? '📝 Create Custom' : '📚 Browse Templates' }}
        </button>
        <router-link to="/api-library" class="btn-secondary btn-link">
          🔌 API Library
        </router-link>
        <button v-if="currentApp" @click="downloadApp" class="btn-secondary">
          📥 Download HTML
        </button>
        <button v-if="currentApp" @click="deployApp" class="btn-primary" :disabled="isDeploying">
          {{ isDeploying ? 'Saving...' : 'Save as Template' }}
        </button>
      </div>
    </div>

    <!-- Template Gallery -->
    <div v-if="showTemplates" class="template-gallery">
      <h2>App Templates</h2>
      <div class="templates-grid">
        <div
          v-for="template in appTemplates"
          :key="template.id"
          class="template-card"
          @click="selectTemplate(template)"
          :class="{ selected: selectedTemplate?.id === template.id }"
        >
          <div class="template-icon">{{ template.icon }}</div>
          <h3>{{ template.name }}</h3>
          <p>{{ template.description }}</p>
          <div class="template-tags">
            <span v-for="tag in template.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- My Apps Section -->
    <!-- AI App Builder -->
    <div v-else class="ai-builder">
      <div class="builder-panel">
        <!-- Conversation History -->
        <div v-if="conversationHistory.length > 0" class="conversation-history">
          <div
            v-for="(message, index) in conversationHistory"
            :key="index"
            :class="['message', message.role]"
          >
            <div class="message-header">
              <span class="message-author">
                {{ message.role === 'user' ? '👤 You' : '🤖 AI Assistant' }}
                <span v-if="message.role === 'assistant' && message.model" class="model-badge">{{ getModelBadge(message.model) }}</span>
              </span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">
              <div v-if="message.role === 'user'" class="user-message">
                {{ message.content }}
              </div>
              <div v-else class="assistant-message">
                <div v-if="message.thinking" class="thinking-indicator">
                  💭 {{ message.thinking }}
                </div>
                <div v-if="message.code" class="code-preview">
                  <div class="code-preview-header">
                    <span>Generated Code</span>
                    <button @click="useCode(message.code)" class="btn-tiny">Use This Version</button>
                  </div>
                  <pre><code>{{ message.code.substring(0, 200) }}...</code></pre>
                </div>
                <div v-if="message.explanation" class="explanation">
                  {{ message.explanation }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Prompt Section -->
        <div class="prompt-section">
          <h2 v-if="conversationHistory.length === 0">✨ Describe Your App</h2>
          <h2 v-else>💬 Continue the conversation</h2>
          <textarea
            v-model="appPrompt"
            :placeholder="conversationHistory.length === 0
              ? 'Example: Create a Pexels image search app with grid layout, or Build an AI chatbot using Grok'
              : 'Example: Add a search filter, Make the cards bigger, Add my portfolio images'"
            rows="3"
            class="prompt-input"
            @keydown.meta.enter="sendMessage"
            @keydown.ctrl.enter="sendMessage"
          ></textarea>

          <!-- Storage Option -->
          <div v-if="conversationHistory.length === 0 && userStore.role === 'Superadmin'" class="storage-option">
            <label class="storage-checkbox">
              <input type="checkbox" v-model="enableStorage" />
              <span class="checkbox-label">
                <strong>☁️ Enable Cloud Storage</strong>
                <small>Store data permanently using our API (todo lists, contacts, notes, etc.)</small>
              </span>
            </label>
            <label v-if="enableStorage" class="storage-checkbox sub-option">
              <input type="checkbox" v-model="enableMultiRowStorage" />
              <span class="checkbox-label">
                <strong>📊 Multi-Row Storage Mode</strong>
                <small>Store multiple rows like a database (for contacts, lists, tables). Each item gets a unique key.</small>
              </span>
            </label>
          </div>

          <!-- AI Model Selection -->
          <div v-if="conversationHistory.length === 0" class="model-selection">
            <label class="model-label">
              <strong>🤖 AI Model:</strong>
              <select v-model="selectedAIModel" class="model-select">
                <option value="grok">Grok Code Fast 1 (⚡ Best for large apps - 131K output)</option>
                <option value="gpt5">GPT-5.1 (Advanced reasoning - 16K output)</option>
                <option value="openai">GPT-4o (Fast & balanced - 16K output)</option>
                <option value="claude">Claude 4 Opus (Detailed - 8K output)</option>
                <option value="claude-4">Claude Sonnet 4 (Fast - 128K output)</option>
                <option value="claude-4.5">Claude 4.5 Sonnet (Balanced - 64K output)</option>
              </select>
            </label>
            <small class="model-hint">{{ getModelDescription(selectedAIModel) }}</small>
          </div>

          <!-- Model selector for regeneration (shown when code exists) -->
          <div v-if="generatedCode && currentApp" class="regenerate-model-section">
            <label class="model-label-small">
              <strong>🔄 Regenerate with:</strong>
              <select v-model="regenerateModel" class="model-select-small">
                <option value="grok">Grok Code Fast 1</option>
                <option value="gpt5">GPT-5.1</option>
                <option value="openai">GPT-4o</option>
                <option value="claude">Claude 4 Opus</option>
                <option value="claude-4">Claude Sonnet 4</option>
                <option value="claude-4.5">Claude 4.5 Sonnet</option>
              </select>
            </label>
            <button
              @click="regenerateWithDifferentModel"
              :disabled="isGenerating"
              class="btn-secondary"
              title="Regenerate current app with a different AI model"
            >
              {{ isGenerating ? '⏳ Regenerating...' : '🔄 Regenerate' }}
            </button>
          </div>

          <div class="prompt-actions">
            <button @click="openPortfolioModal" class="btn-secondary">
              🎨 Add Images
            </button>
            <button
              v-if="conversationHistory.length > 0"
              @click="startNewConversation"
              class="btn-secondary"
            >
              🔄 Start New
            </button>
            <button
              v-if="appPrompt.trim() && userStore.user_id"
              @click="openSavePromptDialog"
              class="btn-outline"
              title="Save this prompt to your library"
            >
              📝 Save Prompt
            </button>
            <button
              v-if="userStore.user_id"
              @click="loadPromptLibrary"
              class="btn-outline"
              title="Load prompt from library"
            >
              📚 My Prompts
            </button>
            <button
              v-if="generatedCode && userStore.user_id"
              @click="openSaveDialog"
              class="btn-success"
              :title="appBuilderStore.currentVersionInfo ? 'Save as new version' : 'Save this app to history'"
            >
              {{ appBuilderStore.currentVersionInfo ? '💾 Save App Version' : '💾 Save App' }}
            </button>
            <button
              v-if="userStore.user_id"
              @click="loadAppHistory"
              class="btn-secondary"
              title="Load app from history"
            >
              📚 App History
            </button>
            <button
              v-if="conversationHistory.length === 0 && appPrompt.trim()"
              @click="enhancePromptWithAI"
              :disabled="isEnhancingPrompt"
              class="btn-ai-enhance"
              title="Let AI enhance your prompt with technical details"
            >
              {{ isEnhancingPrompt ? '✨ Enhancing...' : '✨ AI Enhance Prompt' }}
            </button>
            <button
              v-if="conversationHistory.length > 0 && generatedCode"
              @click="testSmartChange"
              :disabled="!appPrompt.trim() || testingSmartChange"
              class="btn-test"
              title="Test what Llama detects as simple changes"
            >
              {{ testingSmartChange ? '🧪 Testing...' : '🧪 Test Smart Change' }}
            </button>
            <button
              @click="sendMessage"
              :disabled="!appPrompt.trim() || isGenerating"
              class="btn-primary"
            >
              {{ isGenerating ? '🤖 Generating...' : (conversationHistory.length === 0 ? '✨ Generate App' : '💬 Send') }}
            </button>
          </div>
          <div class="prompt-hints">
            <span class="hint">💡 Tip: Press {{ shortcutKey }}+Enter to send</span>
          </div>
          <div v-if="selectedPortfolioImages.length > 0" class="selected-images-info">
            <span>{{ selectedPortfolioImages.length }} image(s) selected</span>
            <button @click="clearSelectedImages" class="btn-link">Clear</button>
          </div>
        </div>

        <div v-if="generatedCode" class="code-section">
          <div class="code-header">
            <h3>Generated Code</h3>
            <div class="code-actions">
              <button @click="copyCode" class="btn-small">📋 Copy</button>
              <button @click="editCode = !editCode" class="btn-small">
                {{ editCode ? '👁️ Preview' : '✏️ Edit' }}
              </button>
              <span v-if="editCode && isUpdatingPreview" class="preview-updating">
                🔄 Updating preview...
              </span>
              <button @click="showErrorReporter = !showErrorReporter" class="btn-small btn-warning">
                🐛 Report Error
              </button>
            </div>
          </div>

          <!-- Error Reporter -->
          <div v-if="showErrorReporter" class="error-reporter">
            <h4>🐛 Report an Error</h4>
            <p>Paste the error message and the AI will fix it:</p>
            <textarea
              v-model="errorMessage"
              placeholder="Example: Uncaught ReferenceError: generatePalette is not defined at HTMLButtonElement.onclick"
              rows="4"
              class="error-input"
            ></textarea>
            <div class="error-actions">
              <button @click="regenerateWithFix" :disabled="!errorMessage.trim() || isGenerating" class="btn-primary">
                {{ isGenerating ? '🔧 Fixing...' : '🔧 Fix & Regenerate' }}
              </button>
              <button @click="showErrorReporter = false; errorMessage = ''" class="btn-secondary">
                Cancel
              </button>
            </div>
          </div>

          <textarea
            v-if="editCode"
            ref="codeEditorTextarea"
            v-model="generatedCode"
            @input="onCodeEdit"
            @keydown="onEditorKeydown"
            class="code-editor"
            rows="20"
            placeholder="Edit your HTML code here... Changes will be reflected in the preview automatically.

Tip: The preview updates automatically after you stop typing for 500ms.
Shortcut: Press Ctrl+E (Cmd+E on Mac) to toggle between Edit and Preview mode."
            spellcheck="false"
          ></textarea>
          <pre v-else class="code-preview"><code>{{ generatedCode }}</code></pre>
        </div>
      </div>

      <!-- Live Preview Panel -->
      <div class="preview-panel" :class="{ 'fullscreen-preview': isPreviewFullscreen }">
        <div class="preview-header">
          <h3>
            🎨 Live Preview
            <span v-if="appBuilderStore.currentVersionInfo" class="version-tag">
              {{ appBuilderStore.getVersionDisplayName() }}
            </span>
          </h3>
          <div class="preview-actions">
            <button @click="refreshPreview" class="btn-small">🔄 Refresh</button>
            <button v-if="previewUrl || streamingCode" @click="toggleFullscreen" class="btn-small">
              {{ isPreviewFullscreen ? '🗙 Exit Fullscreen' : '⛶ Fullscreen' }}
            </button>
            <button v-if="deployedUrl" @click="openInNewTab" class="btn-small">
              🔗 Open in New Tab
            </button>
          </div>
        </div>
        <div class="preview-container">
          <!-- Streaming Code Preview (shown while generating) -->
          <div v-if="isGenerating && streamingCode" class="streaming-preview">
            <div class="streaming-header">
              <span class="streaming-indicator">
                <span class="pulse-dot"></span>
                {{ getModelBadge(selectedAIModel) }} is writing code...
              </span>
              <span class="code-length">{{ streamingCode.length }} characters</span>
            </div>
            <pre class="streaming-code" ref="streamingCodeElement"><code>{{ streamingCode }}</code></pre>
          </div>

          <!-- Normal Preview (shown after generation) -->
          <iframe
            v-else-if="previewUrl"
            :src="previewUrl"
            class="preview-iframe"
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox allow-presentation"
            ref="previewFrame"
          ></iframe>
          <div v-else class="preview-placeholder">
            <div class="placeholder-icon">📱</div>
            <p>Generate an app to see live preview</p>
          </div>
        </div>
        <div v-if="deployedUrl" class="deployment-info">
          <strong>🎉 Deployed:</strong>
          <a :href="deployedUrl" target="_blank">{{ deployedUrl }}</a>
        </div>
      </div>
    </div>

    <!-- Deployment Status -->
    <div v-if="deploymentStatus" class="deployment-toast" :class="deploymentStatus.type">
      {{ deploymentStatus.message }}
    </div>

    <!-- Portfolio Image Modal -->
    <div v-if="showPortfolioModal" class="modal-overlay" @click.self="closePortfolioModal">
      <div class="portfolio-modal">
        <div class="modal-header">
          <h3>🎨 Select Portfolio Images</h3>
          <button @click="closePortfolioModal" class="btn-close">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="loadingPortfolioImages" class="loading-state">
            <div class="spinner"></div>
            <p>Loading portfolio images...</p>
          </div>

          <div v-else-if="portfolioImages.length > 0">
            <div class="image-quality-selector">
              <label>Image Quality:</label>
              <select v-model="imageQualityPreset">
                <option value="ultraFast">Ultra Fast (Low Quality)</option>
                <option value="balanced">Balanced (Recommended)</option>
                <option value="highQuality">High Quality</option>
              </select>
            </div>

            <div class="portfolio-grid">
              <div
                v-for="img in portfolioImages"
                :key="img.url"
                class="portfolio-image-card"
                :class="{ selected: isImageSelected(img) }"
                @click="toggleImageSelection(img)"
              >
                <img :src="getOptimizedImageUrl(img.url)" :alt="img.key" loading="lazy" />
                <div class="image-overlay">
                  <span v-if="isImageSelected(img)" class="check-icon">✓</span>
                </div>
                <div class="image-info">
                  <small>{{ img.key }}</small>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">
            <p>No portfolio images found.</p>
          </div>
        </div>

        <div class="modal-footer">
          <div class="selection-info">
            <strong>{{ selectedPortfolioImages.length }}</strong> image(s) selected
            <span v-if="portfolioSelectionMode === 'thumbnail'" class="mode-hint">
              (select one for thumbnail)
            </span>
          </div>
          <div class="modal-actions">
            <button @click="closePortfolioModal" class="btn-secondary">Cancel</button>
            <button
              @click="addSelectedImagesToPrompt"
              class="btn-primary"
              :disabled="selectedPortfolioImages.length === 0"
            >
              {{ portfolioSelectionMode === 'thumbnail' ? 'Set as Thumbnail' : 'Add to Prompt' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Change Test Modal -->
    <div v-if="showSmartChangeTest" class="modal-overlay" @click.self="showSmartChangeTest = false">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>🧪 Smart Change Detection Test</h3>
          <button @click="showSmartChangeTest = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="smartChangeResult">
            <div v-if="smartChangeResult.success" class="test-result-success">
              <h4>✅ Llama Analysis Result</h4>

              <div class="analysis-grid">
                <div class="analysis-item">
                  <strong>Is Simple:</strong>
                  <span :class="smartChangeResult.analysis.isSimple ? 'badge-success' : 'badge-warning'">
                    {{ smartChangeResult.analysis.isSimple ? '✓ Yes' : '✗ No (Complex)' }}
                  </span>
                </div>

                <div class="analysis-item">
                  <strong>Category:</strong>
                  <span class="badge-info">{{ smartChangeResult.analysis.category }}</span>
                </div>

                <div class="analysis-item">
                  <strong>Confidence:</strong>
                  <span :class="`badge-${smartChangeResult.analysis.confidence}`">
                    {{ smartChangeResult.analysis.confidence }}
                  </span>
                </div>
              </div>

              <div class="analysis-section">
                <h5>🎯 Transformation</h5>
                <p>{{ smartChangeResult.analysis.transformation }}</p>
              </div>

              <div class="analysis-section">
                <h5>🔍 Search Pattern</h5>
                <pre><code>{{ smartChangeResult.analysis.searchPattern }}</code></pre>
              </div>

              <div class="analysis-section">
                <h5>🔄 Replacement</h5>
                <pre><code>{{ smartChangeResult.analysis.replacement }}</code></pre>
              </div>

              <details class="raw-response">
                <summary>📄 Raw JSON Response</summary>
                <pre><code>{{ smartChangeResult.rawResponse }}</code></pre>
              </details>
            </div>

            <div v-else class="test-result-error">
              <h4>❌ Test Failed</h4>
              <p><strong>Error:</strong> {{ smartChangeResult.error }}</p>
              <details v-if="smartChangeResult.rawResponse">
                <summary>📄 Raw Response</summary>
                <pre><code>{{ smartChangeResult.rawResponse }}</code></pre>
              </details>
              <details v-if="smartChangeResult.details">
                <summary>🔍 Details</summary>
                <pre><code>{{ JSON.stringify(smartChangeResult.details, null, 2) }}</code></pre>
              </details>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showSmartChangeTest = false" class="btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- New App Confirmation Dialog -->
    <div v-if="showNewAppDialog" class="modal-overlay" @click.self="showNewAppDialog = false" @keydown.esc="showNewAppDialog = false">
      <div class="modal">
        <div class="modal-header">
          <h3>✨ Start New App</h3>
          <button @click="showNewAppDialog = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <p class="confirm-message">You have an app in progress. What would you like to do?</p>
          <div class="new-app-options">
            <div class="option-card" @click="saveAndStartNew">
              <div class="option-icon">💾</div>
              <h4>Save & Start New</h4>
              <p>Save current app to history, then create a new one</p>
            </div>
            <div class="option-card" @click="discardAndStartNew">
              <div class="option-icon">🗑️</div>
              <h4>Discard & Start New</h4>
              <p>Discard current app and start fresh</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showNewAppDialog = false" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Save App Dialog -->
    <div v-if="showSaveDialog" class="modal-overlay" @click.self="showSaveDialog = false">
      <div class="modal">
        <div class="modal-header">
          <h3>
            {{ appBuilderStore.currentVersionInfo ? '💾 Save New Version' : '💾 Save App to History' }}
          </h3>
          <button @click="showSaveDialog = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>App Name*</label>
            <input
              v-model="saveAppName"
              type="text"
              placeholder="My Awesome App"
              class="form-control"
              required
            />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="saveAppDescription"
              placeholder="Brief description of what this app does"
              class="form-control"
              rows="3"
            ></textarea>
          </div>
          <div class="form-group">
            <label>Tags (comma separated)</label>
            <input
              v-model="saveAppTags"
              type="text"
              placeholder="todo, productivity, ui"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label>App Thumbnail URL (optional)</label>
            <div class="thumbnail-upload-area">
              <input
                v-model="saveAppThumbnail"
                type="url"
                placeholder="https://example.com/screenshot.png or paste image below"
                class="form-control"
              />
              <div class="upload-buttons">
                <button type="button" @click="openPortfolioImagePicker" class="btn-secondary btn-sm">
                  🖼️ Choose from Portfolio
                </button>
                <button type="button" @click="pasteImageForThumbnail" class="btn-secondary btn-sm">
                  📋 Paste Image (Ctrl+V)
                </button>
              </div>
            </div>
            <small class="form-text">Paste an image from clipboard or choose from your portfolio</small>
            <div v-if="uploadingThumbnail" class="uploading-indicator">
              <div class="spinner-small"></div>
              <span>Uploading image...</span>
            </div>
            <div v-if="saveAppThumbnail" class="thumbnail-preview">
              <img :src="saveAppThumbnail" alt="App thumbnail" @error="saveAppThumbnail = ''" />
              <button type="button" @click="saveAppThumbnail = ''" class="remove-thumbnail">✕</button>
            </div>
          </div>
          <div class="form-group">
            <button
              @click="suggestAppMetadata"
              class="btn-secondary"
              :disabled="isSuggestingAppMetadata"
            >
              <span v-if="isSuggestingAppMetadata">✨ Suggesting...</span>
              <span v-else>✨ Suggest with AI</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showSaveDialog = false" class="btn-secondary">Cancel</button>
          <button @click="saveAppToHistory" class="btn-primary">
            {{ appBuilderStore.currentVersionInfo ? '💾 Save Version' : '💾 Save App' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Save Prompt to Library Modal -->
    <div v-if="showSavePromptDialog" class="modal-overlay" @click.self="showSavePromptDialog = false">
      <div class="modal">
        <div class="modal-header">
          <h3>📝 Save Prompt to Library</h3>
          <button @click="showSavePromptDialog = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <div class="input-with-ai">
              <label>Prompt Name*</label>
              <div class="input-group">
                <input
                  v-model="promptName"
                  type="text"
                  placeholder="e.g., Task Manager with Cloud Storage"
                  class="form-control"
                  required
                />
                <button
                  @click="suggestPromptName"
                  :disabled="loadingAISuggestions"
                  class="btn-ai-suggest"
                  title="Get AI name suggestion"
                >
                  {{ loadingAISuggestions ? '⏳' : '✨' }}
                </button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <div class="input-with-ai">
              <label>Description</label>
              <div class="input-group">
                <textarea
                  v-model="promptDescription"
                  placeholder="What this prompt creates and any special features"
                  class="form-control"
                  rows="2"
                ></textarea>
                <button
                  @click="suggestPromptDescription"
                  :disabled="loadingAISuggestions"
                  class="btn-ai-suggest"
                  title="Get AI description suggestion"
                >
                  {{ loadingAISuggestions ? '⏳' : '✨' }}
                </button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <div class="input-with-ai">
              <label>Category</label>
              <div class="input-group">
                <select v-model="promptCategory" class="form-control">
                  <option value="">-- Select Category --</option>
                  <option value="task-management">Task Management</option>
                  <option value="data-visualization">Data Visualization</option>
                  <option value="ui-components">UI Components</option>
                  <option value="forms">Forms</option>
                  <option value="games">Games</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
                <button
                  @click="suggestPromptCategory"
                  :disabled="loadingAISuggestions"
                  class="btn-ai-suggest"
                  title="Get AI category suggestion"
                >
                  {{ loadingAISuggestions ? '⏳' : '✨' }}
                </button>
              </div>
            </div>
          </div>
          <div class="form-group">
            <div class="input-with-ai">
              <label>Tags (comma separated)</label>
              <div class="input-group">
                <input
                  v-model="promptTags"
                  type="text"
                  placeholder="cloud-storage, crud, api"
                  class="form-control"
                />
                <button
                  @click="suggestPromptTags"
                  :disabled="loadingAISuggestions"
                  class="btn-ai-suggest"
                  title="Get AI tag suggestions"
                >
                  {{ loadingAISuggestions ? '⏳' : '✨' }}
                </button>
              </div>
            </div>
          </div>
          <div class="ai-suggest-all">
            <button
              @click="suggestAllMetadata"
              :disabled="loadingAISuggestions"
              class="btn-ai-suggest-all"
              title="Fill all fields with AI suggestions"
            >
              {{ loadingAISuggestions ? '⏳ Generating...' : '✨ Auto-Fill All' }}
            </button>
          </div>
          <div class="prompt-preview">
            <label>Prompt Preview:</label>
            <div class="preview-text">{{ appPrompt.substring(0, 200) }}{{ appPrompt.length > 200 ? '...' : '' }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showSavePromptDialog = false" class="btn-secondary">Cancel</button>
          <button @click="savePromptToLibrary" class="btn-primary">📝 Save Prompt</button>
        </div>
      </div>
    </div>

    <!-- Prompt Library Modal -->
    <div v-if="showPromptLibrary" class="modal-overlay" @click.self="showPromptLibrary = false">
      <div class="modal large">
        <div class="modal-header">
          <h3>📚 My Prompt Library</h3>
          <button @click="showPromptLibrary = false" class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="loadingPrompts" class="loading-state">
            <div class="spinner"></div>
            <p>Loading your prompts...</p>
          </div>
          <div v-else-if="savedPrompts.length === 0" class="empty-state">
            <p>📝 No saved prompts yet</p>
            <p>Save your favorite prompts to reuse them later!</p>
          </div>
          <div v-else class="prompt-list">
            <div
              v-for="prompt in savedPrompts"
              :key="prompt.id"
              class="prompt-item"
            >
              <div class="prompt-info">
                <div class="prompt-header">
                  <h4>{{ prompt.prompt_name }}</h4>
                  <span v-if="prompt.category" class="category-badge">{{ prompt.category }}</span>
                </div>
                <p v-if="prompt.description" class="prompt-description">{{ prompt.description }}</p>
                <p class="prompt-text">{{ prompt.prompt_text.substring(0, 150) }}{{ prompt.prompt_text.length > 150 ? '...' : '' }}</p>
                <div class="prompt-meta">
                  <span v-if="prompt.tags && prompt.tags.length" class="tags">
                    <span v-for="tag in prompt.tags" :key="tag" class="tag">{{ tag }}</span>
                  </span>
                  <span class="date">{{ formatDate(prompt.created_at) }}</span>
                  <span v-if="prompt.use_count > 0" class="use-count">Used {{ prompt.use_count }}x</span>
                </div>
              </div>
              <div class="prompt-actions">
                <button @click="loadPromptToEditor(prompt)" class="btn-primary">Use Prompt</button>
                <button @click="deletePromptFromLibrary(prompt.id)" class="btn-danger-small">Delete</button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showPromptLibrary = false" class="btn-secondary">Close</button>
        </div>
      </div>
    </div>

    <!-- AI API Creator Modal -->
    <div v-if="showAPICreator" class="modal-overlay" @click.self="cancelAPICreator">
      <div class="modal-content api-creator-modal">
        <div class="modal-header">
          <h3>✨ Create API with AI</h3>
          <button @click="cancelAPICreator" class="btn-close">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="!generatedAPIData">
            <!-- Step 1: Enter Endpoint and Description -->
            <p class="creator-description">
              <strong>Step 1:</strong> Enter your API endpoint URL (the Cloudflare Worker route you already built).<br>
              <strong>Step 2:</strong> Optionally describe what it does, and AI will generate the client wrapper function, documentation, and examples.
            </p>

            <div class="creator-examples">
              <strong>Workflow Example:</strong>
              <ol>
                <li>✅ You built: <code>/api/giphy/search</code> in your worker</li>
                <li>📝 Paste: <code>https://api.vegvisr.org/api/giphy/search</code></li>
                <li>💬 Describe: "Searches for GIFs on Giphy by keyword"</li>
                <li>🤖 AI generates the wrapper function for apps to use</li>
              </ol>
            </div>

            <div class="input-field">
              <label for="endpoint-url"><strong>API Endpoint URL</strong> (required)</label>
              <input
                id="endpoint-url"
                v-model="apiEndpointUrl"
                type="url"
                placeholder="https://api.vegvisr.org/api/your-endpoint"
                class="endpoint-input"
                :disabled="isGeneratingAPI"
              />
              <small class="input-hint">The Cloudflare Worker endpoint you already implemented</small>
            </div>

            <div class="input-field">
              <label for="api-description"><strong>Description</strong> (optional - helps AI understand)</label>
              <textarea
                id="api-description"
                v-model="apiCreatorPrompt"
                placeholder="e.g., 'Searches for animated GIFs from Giphy. Takes query and limit parameters.'"
                class="api-creator-input"
                rows="4"
                :disabled="isGeneratingAPI"
              ></textarea>
              <small class="input-hint">What does your endpoint do? What parameters does it accept?</small>
            </div>

            <div class="creator-actions">
              <button
                @click="generateAPIWithAI"
                :disabled="!apiEndpointUrl.trim() || isGeneratingAPI"
                class="btn-generate-api"
              >
                {{ isGeneratingAPI ? '🤖 Generating Wrapper...' : '🤖 Generate Client Wrapper' }}
              </button>
              <button @click="cancelAPICreator" class="btn-secondary">Cancel</button>
            </div>
          </div>

          <div v-else>
            <!-- Step 2: Review and Edit Generated API -->
            <p class="creator-description success">
              ✅ API specification generated! Review the details below and make any adjustments before saving.
            </p>

            <div class="generated-api-preview">
              <div class="preview-section">
                <div class="preview-header">
                  <span class="preview-icon" :style="{ color: generatedAPIData.color }">
                    {{ generatedAPIData.icon }}
                  </span>
                  <div>
                    <h4>{{ generatedAPIData.name }}</h4>
                    <span class="preview-category">{{ generatedAPIData.category }}</span>
                  </div>
                </div>
                <p class="preview-description">{{ generatedAPIData.description }}</p>
              </div>

              <div class="preview-field">
                <label>Slug (unique identifier):</label>
                <input v-model="generatedAPIData.slug" type="text" class="field-input" />
              </div>

              <div class="preview-field">
                <label>Function Name:</label>
                <input v-model="generatedAPIData.function_name" type="text" class="field-input" />
              </div>

              <div class="preview-field">
                <label>Function Signature:</label>
                <input v-model="generatedAPIData.function_signature" type="text" class="field-input" />
              </div>

              <div class="preview-field">
                <label>Function Code:</label>
                <textarea v-model="generatedAPIData.function_code" rows="10" class="field-textarea"></textarea>
              </div>

              <div class="preview-field">
                <label>Endpoint URL:</label>
                <input v-model="generatedAPIData.endpoint_url" type="text" class="field-input" />
              </div>

              <div class="preview-field">
                <label>Rate Limit:</label>
                <input v-model="generatedAPIData.rate_limit" type="text" class="field-input" />
              </div>

              <div class="preview-field">
                <label>Example Code:</label>
                <textarea v-model="generatedAPIData.example_code" rows="6" class="field-textarea"></textarea>
              </div>

              <div class="preview-field">
                <label>Documentation URL (optional):</label>
                <input v-model="generatedAPIData.docs_url" type="text" class="field-input" placeholder="https://..." />
              </div>

              <div class="preview-field checkbox-field">
                <label>
                  <input v-model="generatedAPIData.is_enabled_by_default" type="checkbox" />
                  Enable by default for all users
                </label>
              </div>
            </div>

            <div class="creator-actions">
              <button
                @click="saveGeneratedAPI"
                :disabled="isSavingAPI"
                class="btn-save-api"
              >
                {{ isSavingAPI ? '💾 Saving...' : '💾 Save API to Database' }}
              </button>
              <button @click="generatedAPIData = null" class="btn-secondary">← Back to Edit Prompt</button>
              <button @click="cancelAPICreator" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/userStore'
import { useAppBuilderStore } from '@/stores/appBuilderStore'

const userStore = useUserStore()
const appBuilderStore = useAppBuilderStore()

// State
const showTemplates = ref(true)
const appPrompt = ref('')
const generatedCode = ref('')
const selectedTemplate = ref(null)
const currentApp = ref(null)
const isGenerating = ref(false)
const isDeploying = ref(false)
const isEnhancingPrompt = ref(false)
const editCode = ref(false)
const codeEditorTextarea = ref(null) // Reference to the code editor textarea
const isUpdatingPreview = ref(false)
const previewUrl = ref('')
const deployedUrl = ref('')
const deploymentStatus = ref(null)
const previewFrame = ref(null)
const streamingCodeElement = ref(null)
const showErrorReporter = ref(false)
const errorMessage = ref('')
const selectedAIModel = ref('grok') // Default to Grok (highest token limit, creative)
const regenerateModel = ref('grok') // Model to use for regeneration
const streamingCode = ref('') // For real-time streaming preview
const isPreviewFullscreen = ref(false) // Fullscreen preview state

// Smart change detection test state
const showSmartChangeTest = ref(false)
const testingSmartChange = ref(false)
const smartChangeResult = ref(null)

// My Apps state
// Conversation state
const conversationHistory = ref([])
const conversationMode = ref(false)

// Storage state
const enableStorage = ref(true) // Default to true for Superadmin users
const enableMultiRowStorage = ref(false) // Multi-row storage mode for database-like apps

// App History Management
const showSaveDialog = ref(false)
const isSavingAsTemplate = ref(false) // Track if saving as template vs history
const showNewAppDialog = ref(false)
const saveAppName = ref('')
const saveAppDescription = ref('')
const saveAppTags = ref('')
const saveAppThumbnail = ref('')
const uploadingThumbnail = ref(false) // App thumbnail/screenshot URL
const isSuggestingAppMetadata = ref(false)

// Prompt Library state
const savedPrompts = ref([])
const showSavePromptDialog = ref(false)
const showPromptLibrary = ref(false)
const loadingPrompts = ref(false)
const promptName = ref('')
const promptDescription = ref('')
const promptCategory = ref('')
const promptTags = ref('')
const loadingAISuggestions = ref(false)

// Portfolio images state
const showPortfolioModal = ref(false)
const portfolioImages = ref([])
const loadingPortfolioImages = ref(false)
const selectedPortfolioImages = ref([])
const portfolioSelectionMode = ref('prompt') // 'prompt' or 'thumbnail'

// Get API and Component state from store (use storeToRefs for reactivity)
const { enabledAPIs, enabledComponents } = storeToRefs(appBuilderStore)

// AI API Creator state
const showAPICreator = ref(false)
const apiCreatorPrompt = ref('')
const apiEndpointUrl = ref('') // NEW: User provides the endpoint they built
const isGeneratingAPI = ref(false)
const generatedAPIData = ref(null)
const isSavingAPI = ref(false)

// Computed properties
const shortcutKey = computed(() => {
  if (typeof navigator === 'undefined') return 'Ctrl'
  return navigator.platform?.includes('Mac') ? 'Cmd' : 'Ctrl'
})
const imageQualityPreset = ref('balanced')

// Get model description helper
const getModelDescription = (model) => {
  const descriptions = {
    grok: '⭐ Best choice: Grok Code Fast 1 - 131K output limit, optimized for code generation. Fast & precise.',
    gpt5: '⚠️ SLOW (60s+) - Advanced reasoning, 16K output. May timeout on complex apps.',
    openai: 'Fast & reliable, 16K output. Good for medium-sized apps with quick iterations.',
    claude: 'High quality but 8K output - may truncate large apps. Use Grok for complex projects.',
    'claude-4': '🚀 Claude Sonnet 4 - 128K output limit with streaming. Fast, high-quality code generation.',
    'claude-4.5': '🚀 Claude 4.5 Sonnet - 64K output limit with streaming. Balanced quality and speed.'
  }
  return descriptions[model] || 'Select an AI model to generate your app'
}

// Get model badge for display in conversation
const getModelBadge = (model) => {
  const badges = {
    gpt5: 'GPT-5.1',
    openai: 'GPT-4o',
    grok: 'Grok Code Fast 1',
    claude: 'Claude 4 Opus',
    'claude-4': 'Claude Sonnet 4',
    'claude-4.5': 'Claude 4.5 Sonnet'
  }
  return badges[model] || model
}

/*
 * Vegvisr Platform - Available APIs & Integrations
 * ================================================
 *
 * TARGET MARKET: Knowledge Management System for Leaders, Marketers, Writers, Researchers, Business Developers
 *
 * WORKING API ENDPOINTS (no authentication required in generated apps):
 *
 * 1. Pexels Image Search
 *    - Endpoint: https://api.vegvisr.org/api/pexels/search?query=nature&per_page=30&page=1
 *    - Returns: Array of photos with src (original/large2x/large/medium/small), photographer, photographer_url, alt
 *    - Use case: Find professional images for presentations, reports, marketing materials, thought leadership content
 *
 * 2. Grok AI Chat (requires user token)
 *    - Endpoint: https://api.vegvisr.org/user-ai-chat (POST with emailVerificationToken)
 *    - Returns: Fulltext node structure with AI response
 *    - Use case: Research assistance, content generation, strategic analysis, market insights, competitive intelligence
 *
 * 3. Knowledge Graphs
 *    - List all: https://knowledge.vegvisr.org/getknowgraphs
 *    - Get specific: https://knowledge.vegvisr.org/getknowgraph?graphId=xxx
 *    - Returns: Graph metadata, nodes (with info, color, type, bibl), edges
 *    - Use case: Access organized research, business intelligence, project documentation, strategic planning materials
 *
 * 4. YouTube Search
 *    - Endpoint: https://api.vegvisr.org/youtube-search?query=education&maxResults=10
 *    - Returns: Array of videos with id, title, description, thumbnails, channelTitle, publishedAt
 *    - Use case: Find educational content, industry insights, training materials, market research, competitive analysis
 *
 * 5. Portfolio Images
 *    - Stored in Cloudflare R2, accessible via https://vegvisr.imgix.net/[filename]
 *    - Can be fetched from knowledge graph nodes with type: "portfolio-image"
 *    - Use case: Branded assets, campaign materials, case study images, presentation graphics
 *
 * 6. Google Maps
 *    - API key endpoint: https://api.vegvisr.org/getGoogleApiKey
 *    - Use case: Market analysis, location-based research, business expansion planning, geographic data visualization
 *
 * 7. Image Analysis (AI Vision)
 *    - POST https://image-analysis-worker.torarnehave.workers.dev/analyze-image
 *    - Body: { imageUrl: string, analysisType: string, model: 'gpt-4o' | 'gpt-4o-mini' }
 *    - Analysis types: general, detailed, objects, text (OCR), technical, public_document
 *    - Use case: Extract data from documents, analyze competitor materials, digitize research notes, business card scanning
 *
 * 8. AI Image Generation
 *    - POST https://api.vegvisr.org/gpt4-vision-image
 *    - Body: { prompt: string, model: 'dall-e-2' | 'dall-e-3' | 'gpt-image-1', size: string, quality: string }
 *    - Use case: Create unique visuals for presentations, marketing campaigns, thought leadership content, reports
 *
 * GRAPH NODE TYPES (from 37 available templates):
 * - Strategic Content: FullTextNode, InfoNode, NotesNode, WorkNote, TitleNode
 * - Data Visualization: BubbleChart, LineChart, MultiLineChart, QuadrantChart, GanttChart, Timeline, FlowChart
 * - Media Assets: Image, YouTube, PortfolioImage, Audio, Pexels, SlideShow
 * - Interactive Tools: AI Action Test, AI CHAT GROK, Image Analysis, Pexels Search, Menu Creator, Learning Content Creator
 * - Professional Layouts: FLEXBOX-CARDS, FLEXBOX-GALLERY, FLEXBOX-GRID
 * - Geographic Analysis: MapNode (KML support for market mapping, expansion planning)
 * - Business Tools: Advertisement Manager, Auto-Graph Subscription, Password Protection
 */

// App Templates - Knowledge Management & Business Intelligence Tools for Leaders, Marketers, Writers, Researchers
const appTemplates = ref([
  {
    id: 'research-assistant',
    name: 'Research Assistant Dashboard',
    icon: '👋',
    description: 'AI-powered research tool with knowledge graph integration',
    tags: ['research', 'ai', 'knowledge-management'],
    prompt: 'Create a research assistant app that lets me ask questions to Grok AI, search my knowledge graphs for related content, and display both AI insights and my existing research in a unified dashboard'
  },
  {
    id: 'content-finder',
    name: 'Content & Asset Finder',
    icon: '✅',
    description: 'Search Pexels images with markdown copy for FullText nodes',
    tags: ['marketing', 'content', 'media'],
    prompt: 'Create a Pexels image search app with grid layout - when copying an image, generate this exact markdown format: ![Header|height: 200px; object-fit: \'cover\'; object-position: \'center\'](IMAGE_URL). Include two buttons for each image: "Copy URL" for plain URL and "Copy Markdown" for the formatted markdown. Add view size options (large/medium/small) and display photographer credits.'
  },
  {
    id: 'knowledge-explorer',
    name: 'Knowledge Graph Explorer',
    icon: '🧮',
    description: 'Browse and search your knowledge base with filters',
    tags: ['knowledge-management', 'research', 'organization'],
    prompt: 'Create a knowledge graph browser that displays all my graphs as professional cards with titles, descriptions, and meta areas - include search functionality and filtering by category for quick access to research and business intelligence'
  },
  {
    id: 'presentation-builder',
    name: 'Presentation Asset Builder',
    icon: '🌤️',
    description: 'Gather images, data, and insights for presentations',
    tags: ['presentations', 'leadership', 'visual-content'],
    prompt: 'Create an app that helps build presentation materials - search Pexels for professional images, access portfolio graphics, generate AI images with DALL-E, and organize assets in a collection view for export'
  },
  {
    id: 'market-intelligence',
    name: 'Market Intelligence Hub',
    icon: '📝',
    description: 'Combine AI insights with YouTube industry content',
    tags: ['business-development', 'market-research', 'strategy'],
    prompt: 'Create a market intelligence app with AI chat for analysis questions and YouTube search for industry insights - display conversation history and relevant videos side-by-side for comprehensive market research'
  },
  {
    id: 'document-analyzer',
    name: 'Document OCR & Analysis',
    icon: '⏱️',
    description: 'Extract text and data from images using AI vision',
    tags: ['ai', 'ocr', 'data-extraction'],
    prompt: 'Create a document analysis app where I can upload images or paste URLs of documents, business cards, charts, or reports - use AI vision to extract all text and data, and display results in a copyable format for knowledge management'
  },
  {
    id: 'campaign-planner',
    name: 'Campaign Planning Dashboard',
    icon: '🎨',
    description: 'Plan marketing campaigns with AI and visual assets',
    tags: ['marketing', 'campaigns', 'planning'],
    prompt: 'Create a campaign planner with AI brainstorming chat, Pexels image search for campaign visuals, and DALL-E image generation for unique branded assets - organize ideas and assets in a visual board layout'
  },
  {
    id: 'competitive-analysis',
    name: 'Competitive Intelligence Tool',
    icon: '�',
    description: 'Analyze competitors with AI vision and research tools',
    tags: ['business-development', 'competitive-analysis', 'strategy'],
    prompt: 'Create a competitive intelligence app that analyzes competitor websites, marketing materials, and documents using AI vision OCR - extract key information and organize insights with AI-powered analysis and commentary'
  },
  {
    id: 'thought-leadership',
    name: 'Thought Leadership Studio',
    icon: '💰',
    description: 'Create content with AI writing and image generation',
    tags: ['content-creation', 'leadership', 'ai'],
    prompt: 'Create a thought leadership content studio with AI chat for article brainstorming and drafting, DALL-E image generation for unique visuals, and integration with my knowledge graphs for research references'
  },
  {
    id: 'business-model-canvas',
    name: 'Business Model Canvas Builder',
    icon: '🏗️',
    description: 'Create and analyze business models with AI assistance',
    tags: ['business-development', 'strategy', 'planning'],
    prompt: 'Create a Business Model Canvas app with 9 building blocks (Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue Streams, Key Resources, Key Activities, Key Partnerships, Cost Structure) - use AI to analyze each section, suggest improvements, and generate insights for business model validation and pivots'
  },
  {
    id: 'swot-analysis',
    name: 'Strategic SWOT Analyzer',
    icon: '🎯',
    description: 'AI-powered SWOT analysis with competitive intelligence',
    tags: ['business-development', 'strategy', 'analysis'],
    prompt: 'Create a SWOT analysis app with quadrants for Strengths, Weaknesses, Opportunities, and Threats - use AI to analyze market position, suggest strategic actions, search YouTube for industry trends, and integrate with my knowledge graphs for competitive intelligence and market data'
  },
  {
    id: 'value-proposition',
    name: 'Value Proposition Designer',
    icon: '💎',
    description: 'Design compelling value propositions with AI',
    tags: ['business-development', 'marketing', 'strategy'],
    prompt: 'Create a Value Proposition Canvas app showing Customer Profile (Jobs, Pains, Gains) and Value Map (Products/Services, Pain Relievers, Gain Creators) - use AI to analyze customer needs, refine messaging, and test value proposition clarity for target segments'
  },
  {
    id: 'market-opportunity',
    name: 'Market Opportunity Analyzer',
    icon: '📊',
    description: 'Evaluate market size, trends, and entry strategies',
    tags: ['business-development', 'market-research', 'strategy'],
    prompt: 'Create a market opportunity app with AI-powered TAM/SAM/SOM analysis, competitor landscape mapping, trend identification from YouTube industry content, and strategic recommendations - visualize market size and growth potential with charts and data'
  },
  {
    id: 'pestel-analysis',
    name: 'PESTEL Strategic Framework',
    icon: '🌍',
    description: 'Analyze macro-environmental factors affecting business',
    tags: ['business-development', 'strategy', 'risk-analysis'],
    prompt: 'Create a PESTEL analysis app examining Political, Economic, Social, Technological, Environmental, and Legal factors - use AI to identify risks and opportunities in each category, search YouTube for expert insights, and generate strategic recommendations for business planning'
  },
  {
    id: 'okr-tracker',
    name: 'OKR Goal Planning System',
    icon: '🎖️',
    description: 'Set and track Objectives and Key Results',
    tags: ['business-development', 'goal-setting', 'performance'],
    prompt: 'Create an OKR (Objectives and Key Results) planning app with quarterly objective setting, measurable key results tracking, AI suggestions for ambitious yet achievable goals, and progress visualization - integrate with knowledge graphs for strategic alignment'
  },
  {
    id: 'porter-five-forces',
    name: 'Porter Five Forces Analyzer',
    icon: '⚔️',
    description: 'Assess competitive intensity and market attractiveness',
    tags: ['business-development', 'competitive-analysis', 'strategy'],
    prompt: 'Create a Porter Five Forces analysis app examining Competitive Rivalry, Supplier Power, Buyer Power, Threat of Substitution, and Threat of New Entry - use AI to analyze each force, search for industry data, and provide strategic positioning recommendations'
  },
  {
    id: 'lean-canvas',
    name: 'Lean Canvas Planner',
    icon: '🚀',
    description: 'One-page business plan for startups and products',
    tags: ['business-development', 'startup', 'planning'],
    prompt: 'Create a Lean Canvas app with 9 blocks (Problem, Solution, Unique Value Proposition, Unfair Advantage, Customer Segments, Key Metrics, Channels, Cost Structure, Revenue Streams) - use AI to validate assumptions, identify risks, and refine the business model for rapid iteration'
  },
  {
    id: 'competitive-positioning',
    name: 'Competitive Positioning Map',
    icon: '🗺️',
    description: 'Visualize market positioning vs competitors',
    tags: ['business-development', 'competitive-analysis', 'visualization'],
    prompt: 'Create a competitive positioning map app where I can plot competitors on 2-axis grids (price vs quality, features vs usability, etc) - use AI to analyze positioning gaps, suggest differentiation strategies, and identify white space opportunities in the market'
  },
  {
    id: 'linguistic-etymology',
    name: 'Etymology & Cognate Explorer',
    icon: '🔤',
    description: 'Research word origins across Norse, Sanskrit, and PIE',
    tags: ['linguistics', 'etymology', 'research'],
    prompt: 'Create a linguistic research app where I can input Norse words and use AI to analyze etymological connections to Sanskrit, PIE roots, and cognates - display results with phonetic evolution, semantic shifts, and cross-references to my knowledge graphs on Indo-European linguistics'
  },
  {
    id: 'mythology-comparison',
    name: 'Cross-Cultural Mythology Analyzer',
    icon: '⚡',
    description: 'Compare Norse and Vedic mythological themes',
    tags: ['mythology', 'comparative-studies', 'research'],
    prompt: 'Create a mythology comparison tool with AI chat to analyze parallels between Norse and Vedic myths - search YouTube for academic lectures on Indo-European mythology, fetch my knowledge graphs on Odin/Varuna connections, and display comparative analysis with deity attributes, creation myths, and cultural themes'
  },
  {
    id: 'runic-research',
    name: 'Runic Text & Symbol Analyzer',
    icon: '᛫',
    description: 'OCR and analyze runic inscriptions and symbols',
    tags: ['runology', 'epigraphy', 'ocr'],
    prompt: 'Create a runic research app using AI vision OCR to extract text from runestone images or manuscript photos - analyze the inscription, provide transliteration, identify rune types (Elder/Younger Futhark), and use AI to suggest interpretations and cross-reference with my knowledge graphs on Norse epigraphy'
  },
  {
    id: 'vedic-norse-lexicon',
    name: 'Indo-European Lexicon Builder',
    icon: '📚',
    description: 'Build comparative lexicon of Norse, Sanskrit, PIE terms',
    tags: ['linguistics', 'lexicography', 'database'],
    prompt: 'Create a lexicon builder app where I can search my knowledge graphs for linguistic terms, add new entries with fields for Norse word, Sanskrit cognate, PIE reconstruction, semantic field, and references - include AI assistant for suggesting cognates and etymological connections based on sound laws'
  },
  {
    id: 'archaeological-map',
    name: 'Norse-Vedic Cultural Geography',
    icon: '🗺️',
    description: 'Map Indo-European cultural sites and migrations',
    tags: ['archaeology', 'cultural-geography', 'mapping'],
    prompt: 'Create a cultural geography app with Google Maps integration showing Norse archaeological sites, Vedic centers, and hypothesized Indo-European migration routes - overlay with my knowledge graph locations, add markers with cultural context, and visualize the spread of PIE languages and mythology'
  },
  {
    id: 'sacred-text-analyzer',
    name: 'Sacred Text Comparative Tool',
    icon: '📜',
    description: 'Analyze Eddas, Rigveda, and comparative texts',
    tags: ['philology', 'sacred-texts', 'comparative-religion'],
    prompt: 'Create a sacred text analysis app where I can paste excerpts from Poetic Edda, Prose Edda, or Rigveda - use AI to identify thematic parallels, linguistic patterns, poetic meters (fornyrðislag vs. Vedic chandas), and theological concepts - cross-reference with my knowledge graphs on Indo-European religion'
  },
  {
    id: 'symbol-iconography',
    name: 'Symbolic Iconography Database',
    icon: '☀️',
    description: 'Catalog Norse and Vedic symbols with AI analysis',
    tags: ['iconography', 'symbolism', 'visual-research'],
    prompt: 'Create a symbol database app combining Pexels search for Norse and Vedic imagery, AI vision analysis to identify symbolic elements (Mjolnir, Swastika/Svastika, Yggdrasil, Ashvattha), and organize findings with descriptions of symbolic meaning, cultural context, and Indo-European roots from my knowledge graphs'
  },
  {
    id: 'custom',
    name: 'Custom App',
    icon: '✨',
    description: 'Describe your own app idea',
    tags: ['custom', 'ai-powered'],
    prompt: ''
  }
])

const selectTemplate = (template) => {
  selectedTemplate.value = template
  if (template.id === 'custom') {
    showTemplates.value = false
    appPrompt.value = ''
  } else {
    showTemplates.value = false
    appPrompt.value = template.prompt
  }
}

// Helper functions for conversation
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const useCode = (code) => {
  generatedCode.value = code
  createPreview(code)
  deploymentStatus.value = { type: 'success', message: '✅ Using this version of the code' }
  setTimeout(() => deploymentStatus.value = null, 3000)
}

// Storage helper injection
const injectStorageHelper = (htmlCode) => {
  // Check if cloud storage helpers are already defined in the generated code
  // If they are, don't inject to avoid duplicate declarations
  if (htmlCode.includes('function saveData(') ||
      htmlCode.includes('async function saveData(') ||
      htmlCode.includes('function loadAllData(') ||
      htmlCode.includes('let requestCounter') ||
      htmlCode.includes('const APP_ID')) {
    console.log('☁️ Cloud storage helpers already in generated code - skipping injection')
    return htmlCode
  }

  const appId = crypto.randomUUID()

  const storageScript = `
<!-- Cloud Storage API Helper -->
<` + `script>
// Define APP_ID if not already defined by generated code
if (typeof APP_ID === 'undefined') {
  var APP_ID = '${appId}';
}
let requestCounter = 0;

// Helper to send request to parent window via postMessage
function sendToParent(action, payload) {
  return new Promise((resolve, reject) => {
    const requestId = ++requestCounter;

    // Listen for response
    const handler = (event) => {
      if (event.data.type === 'CLOUD_STORAGE_RESPONSE' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        if (event.data.success) {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error || 'Request failed'));
        }
      }
    };

    window.addEventListener('message', handler);

    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Request timeout'));
    }, 10000);

    // Send request to parent
    window.parent.postMessage({
      type: 'CLOUD_STORAGE_REQUEST',
      requestId,
      payload: { action, appId: APP_ID, ...payload }
    }, '*');
  });
}

// Save data to cloud
async function saveData(key, value) {
  try {
    const result = await sendToParent('save', { key, value });
    return result.success ? result : null;
  } catch (error) {
    console.error('Error saving data:', error);
    return null;
  }
}

// Load data from cloud
async function loadData(key) {
  try {
    const result = await sendToParent('load', { key });
    return result.success ? result.data.value : null;
  } catch (error) {
    console.error('Error loading data:', error);
    return null;
  }
}

// Load all data for this app
async function loadAllData() {
  try {
    const result = await sendToParent('loadAll', {});
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error loading all data:', error);
    return [];
  }
}

// Delete data from cloud
async function deleteData(key) {
  try {
    const result = await sendToParent('delete', { key });
    return result.success;
  } catch (error) {
    console.error('Error deleting data:', error);
    return false;
  }
}

console.log('☁️ Cloud Storage enabled for app:', APP_ID);
</` + `script>
`

  // Inject before closing </body> tag
  if (htmlCode.includes('</body>')) {
    return htmlCode.replace('</body>', storageScript + '\n</body>')
  } else if (htmlCode.includes('</head>')) {
    return htmlCode.replace('</head>', storageScript + '\n</head>')
  } else {
    return htmlCode + storageScript
  }
}

const startNewConversation = () => {
  if (conversationHistory.value.length > 0) {
    if (!confirm('Start a new conversation? Current conversation will be cleared.')) {
      return
    }
  }
  conversationHistory.value = []
  conversationMode.value = false
  appPrompt.value = ''
  generatedCode.value = ''
  deploymentStatus.value = null
}

// AI-powered prompt enhancement
const enhancePromptWithAI = async () => {
  if (!appPrompt.value.trim() || isEnhancingPrompt.value) return

  isEnhancingPrompt.value = true
  deploymentStatus.value = { type: 'info', message: '✨ AI is enhancing your prompt with technical details...' }

  try {
    const userId = userStore.user_id || 'anonymous'
    const appId = crypto.randomUUID()

    // Use our backend /enhance-prompt endpoint
    const response = await fetch('https://api.vegvisr.org/enhance-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: appPrompt.value,
        userId: userId,
        appId: appId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Enhancement API error:', errorText)
      throw new Error('AI enhancement failed')
    }

    const data = await response.json()
    const enhancedPrompt = data.enhancedPrompt

    if (enhancedPrompt) {
      appPrompt.value = enhancedPrompt.trim()
      deploymentStatus.value = {
        type: 'success',
        message: '✅ Prompt enhanced! Review the technical details and click Generate App'
      }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 5000)
    } else {
      throw new Error('No enhanced prompt received')
    }

  } catch (error) {
    console.error('Prompt enhancement error:', error)
    deploymentStatus.value = {
      type: 'error',
      message: '❌ Enhancement failed. Your original prompt is still available.'
    }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 3000)
  } finally {
    isEnhancingPrompt.value = false
  }
}

const sendMessage = async () => {
  if (!appPrompt.value.trim() || isGenerating.value) return

  // Add user message to history
  const userMessage = {
    role: 'user',
    content: appPrompt.value,
    timestamp: new Date().toISOString(),
    images: selectedPortfolioImages.value.length > 0 ? [...selectedPortfolioImages.value] : null
  }

  conversationHistory.value.push(userMessage)
  conversationMode.value = true

  // Save current prompt and clear input
  const currentPrompt = appPrompt.value
  appPrompt.value = ''

  await generateApp(currentPrompt)
}

const generateApp = async (promptOverride = null) => {
  const prompt = promptOverride || appPrompt.value
  if (!prompt.trim()) return

  isGenerating.value = true
  streamingCode.value = '' // Reset streaming code
  deploymentStatus.value = { type: 'info', message: `🤖 ${getModelBadge(selectedAIModel.value)} is generating your app...` }

  // Add thinking indicator to conversation
  const thinkingMessage = {
    role: 'assistant',
    thinking: 'Analyzing your request and generating code...',
    timestamp: new Date().toISOString()
  }

  if (conversationMode.value) {
    conversationHistory.value.push(thinkingMessage)
  }

  try {
    // Build context from conversation history
    let fullPrompt = prompt
    if (conversationHistory.value.length > 1) {
      const context = conversationHistory.value
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .slice(-3) // Last 3 user messages for context
        .join('\n\n')

      fullPrompt = `Previous context:\n${context}\n\nCurrent request: ${prompt}`
    }

    // Add storage hint to prompt if enabled
    if (enableStorage.value && userStore.role === 'Superadmin' && conversationHistory.value.length === 0) {
      const storageMode = enableMultiRowStorage.value ? 'MULTI-ROW' : 'SINGLE-ROW'
      const storageExample = enableMultiRowStorage.value ? `
MULTI-ROW STORAGE MODE - For apps with multiple records (contacts, inventory, notes):

1. On page load: const items = await loadAllData();
   Returns: [{key: "contact_123", value: {name: "John", phone: "555-0100"}}, ...]

2. Add record: await saveData('contact_' + Date.now(), {name: name, phone: phone, email: email});

3. Update record: await saveData(existingKey, updatedValue);

4. Delete record: await deleteData(key);

EXAMPLE for contacts app:
\`\`\`javascript
async function loadContacts() {
  const items = await loadAllData();
  items.forEach(item => addContactToTable(item.key, item.value));
}

async function addContact(name, phone, email) {
  const key = 'contact_' + Date.now();
  const contact = {name, phone, email, created: new Date().toISOString()};
  await saveData(key, contact);
  addContactToTable(key, contact);
}

async function deleteContact(key) {
  await deleteData(key);
  removeContactFromTable(key);
}

// Load on page load
window.addEventListener('DOMContentLoaded', loadContacts);
\`\`\`` : `
SINGLE-ROW STORAGE MODE - For apps with single data state (calculator history, settings):

1. Load: const data = await loadData('appState');

2. Save: await saveData('appState', {settings: {...}, history: [...]});

EXAMPLE for single state app:
\`\`\`javascript
async function loadState() {
  const state = await loadData('appState') || {count: 0};
  return state;
}

async function saveState(state) {
  await saveData('appState', state);
}
\`\`\``

      fullPrompt += `\n\n⚠️ CRITICAL: Cloud storage is ENABLED (${storageMode}). These functions are ALREADY defined globally - DO NOT redefine them, just use them:
- saveData(key, value)
- loadData(key)
- loadAllData()
- deleteData(key)

${storageExample}

NEVER use localStorage. NEVER define saveData/loadData/deleteData/loadAllData.`
    }

    console.log('🔌 Enabled APIs being sent:', enabledAPIs.value)
    console.log('🧩 Enabled Components being sent:', enabledComponents.value)

    const response = await fetch('https://api.vegvisr.org/generate-app?stream=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        aiModel: selectedAIModel.value, // Use selected model
        conversationMode: conversationMode.value,
        previousCode: conversationHistory.value.length > 0 && generatedCode.value ? generatedCode.value : null,
        enabledAPIs: enabledAPIs.value, // Send enabled APIs to backend
        enabledComponents: enabledComponents.value // Send enabled components to backend
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ API Error Response:', errorData)
      throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
    }

    // Check if streaming is supported
    const contentType = response.headers.get('content-type')

    if (contentType && contentType.includes('text/event-stream')) {
      // Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.chunk) {
                streamingCode.value += parsed.chunk
              } else if (parsed.done && parsed.code) {
                streamingCode.value = parsed.code
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }

      generatedCode.value = streamingCode.value
    } else {
      // Handle non-streaming response (fallback)
      const data = await response.json()

      if (data.success && data.code) {
        // Extract HTML from worker code if it's wrapped in a worker
        let htmlCode = data.code

        // If AI returned worker code, extract the HTML
        const htmlMatch = htmlCode.match(/`(<!DOCTYPE html>[\s\S]*?)`/m) ||
                         htmlCode.match(/return\s+`(<!DOCTYPE html>[\s\S]*?)`/m) ||
                         htmlCode.match(/return new Response\(`(<!DOCTYPE html>[\s\S]*?)`/m)

        if (htmlMatch) {
          htmlCode = htmlMatch[1]
        } else if (!htmlCode.includes('<!DOCTYPE html>')) {
          // If no HTML found, create a simple wrapper
          htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated App</title>
</head>
<body>
  <div style="padding: 2rem; text-align: center;">
    <h1>App Generated</h1>
    <p>The AI returned code in an unexpected format. Please try again.</p>
    <pre style="text-align: left; background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow: auto;">${htmlCode.substring(0, 500)}...</pre>
  </div>
</body>
</html>`
        }

        generatedCode.value = htmlCode
      } else {
        throw new Error(data.error || 'Failed to generate app')
      }
    }

    // Inject AI helper if prompt mentions AI/chat or if generated code uses askAI
    if (needsAIHelper(prompt) || generatedCode.value.includes('askAI(')) {
      generatedCode.value = injectAIHelper(generatedCode.value)
    }

    // Inject storage helper if enabled
    if (enableStorage.value && userStore.role === 'Superadmin') {
      generatedCode.value = injectStorageHelper(generatedCode.value)
      console.log('✅ Storage helper injected into generated app')
    }

    // Update or add assistant message to conversation
    if (conversationMode.value) {
      // Remove thinking message
      conversationHistory.value = conversationHistory.value.filter(msg => !msg.thinking)

      // Add assistant response
      conversationHistory.value.push({
        role: 'assistant',
        code: generatedCode.value,
        explanation: 'Code generated successfully',
        timestamp: new Date().toISOString(),
        model: selectedAIModel.value // Track which model was used
      })
    }

    currentApp.value = {
      prompt: prompt,
      code: generatedCode.value,
      timestamp: new Date().toISOString()
    }

    // Update store with generated app
    appBuilderStore.updateApp(generatedCode.value, prompt)

    // Create preview URL (blob URL for local preview)
    createPreview(generatedCode.value)

    deploymentStatus.value = { type: 'success', message: '✅ App generated successfully! Running in browser.' }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 3000)
  } catch (error) {
    console.error('Generation error:', error)

    // Remove thinking message on error
    if (conversationMode.value) {
      conversationHistory.value = conversationHistory.value.filter(msg => !msg.thinking)

      // Add error message to conversation
      conversationHistory.value.push({
        role: 'assistant',
        explanation: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString()
      })
    }

    deploymentStatus.value = { type: 'error', message: `❌ Error: ${error.message}` }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
  } finally {
    isGenerating.value = false
  }
}

const regenerateWithDifferentModel = async () => {
  if (!currentApp.value || !currentApp.value.prompt) {
    deploymentStatus.value = { type: 'error', message: '❌ No app to regenerate' }
    return
  }

  // Store the original model
  const originalModel = selectedAIModel.value

  // Switch to the regenerate model
  selectedAIModel.value = regenerateModel.value

  deploymentStatus.value = {
    type: 'info',
    message: `🔄 Regenerating with ${getModelBadge(regenerateModel.value)}...`
  }

  try {
    // Call generateApp with the stored prompt
    await generateApp(currentApp.value.prompt)
  } catch (error) {
    // Restore original model on error
    selectedAIModel.value = originalModel
    throw error
  }
}

const createPreview = (htmlCode) => {
  // Create blob URL for preview directly without string manipulation
  // The HTML from Claude is already clean and ready to use
  const blob = new Blob([htmlCode], { type: 'text/html' })

  // Revoke old blob URL if exists
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }

  previewUrl.value = URL.createObjectURL(blob)
}

const refreshPreview = () => {
  if (generatedCode.value) {
    createPreview(generatedCode.value)
  }
}

const toggleFullscreen = () => {
  isPreviewFullscreen.value = !isPreviewFullscreen.value
}

// Test smart change detection with Llama
const testSmartChange = async () => {
  if (!appPrompt.value || !generatedCode.value) {
    deploymentStatus.value = { type: 'error', message: '⚠️ Need both a request and existing code to test' }
    return
  }

  testingSmartChange.value = true
  smartChangeResult.value = null

  try {
    const analysisPrompt = `You are a code change analyzer. Analyze this request and respond ONLY with valid JSON.

USER REQUEST: ${appPrompt.value}

CODE PREVIEW (first 500 chars):
${generatedCode.value.substring(0, 500)}...

Respond with ONLY this JSON (no other text):
{
  "isSimple": true or false,
  "category": "title" or "color" or "text" or "css" or "complex",
  "transformation": "description of what needs to change",
  "searchPattern": "regex or string to find",
  "replacement": "what to replace with",
  "confidence": "high" or "medium" or "low"
}`

    const response = await fetch('https://api.vegvisr.org/ai-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: analysisPrompt,
        code: generatedCode.value
      })
    })

    const data = await response.json()

    if (data.success && data.response) {
      try {
        // Try to parse the response as JSON
        const analysis = JSON.parse(data.response)
        smartChangeResult.value = {
          success: true,
          analysis,
          rawResponse: data.response
        }
      } catch {
        // If not JSON, show raw response
        smartChangeResult.value = {
          success: false,
          error: 'Response is not valid JSON',
          rawResponse: data.response
        }
      }
    } else {
      smartChangeResult.value = {
        success: false,
        error: 'No response from AI',
        details: data
      }
    }

    showSmartChangeTest.value = true
  } catch (error) {
    smartChangeResult.value = {
      success: false,
      error: error.message
    }
    showSmartChangeTest.value = true
  } finally {
    testingSmartChange.value = false
  }
}

// Debounced function to update preview when code is edited
let updatePreviewTimeout = null
const onCodeEdit = () => {
  // Clear existing timeout
  if (updatePreviewTimeout) {
    clearTimeout(updatePreviewTimeout)
  }

  // Show updating indicator
  isUpdatingPreview.value = true

  // Set new timeout to update preview after 500ms of no typing
  updatePreviewTimeout = setTimeout(() => {
    if (generatedCode.value) {
      createPreview(generatedCode.value)
      console.log('🎨 Preview updated from code edit')
    }
    isUpdatingPreview.value = false
  }, 500)
}

// Handle keyboard shortcuts in editor
const onEditorKeydown = (event) => {
  // Toggle edit/preview mode with Ctrl+E (Cmd+E on Mac)
  if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
    event.preventDefault()
    editCode.value = !editCode.value
    console.log('🔄 Toggled edit mode via keyboard shortcut')
  }
}

// Check if prompt mentions AI-related keywords
const needsAIHelper = (prompt) => {
  const aiKeywords = ['ai', 'chat', 'assistant', 'grok', 'question', 'ask', 'journal', 'reflect', 'summarize', 'insight']
  const lowerPrompt = prompt.toLowerCase()
  return aiKeywords.some(keyword => lowerPrompt.includes(keyword))
}

// Inject AI helper function into HTML
const injectAIHelper = (htmlCode) => {
  // Check if the FULL auto-injection script is already present
  // Look for a unique marker that only appears in our complete injection
  if (htmlCode.includes('VEGVISR AUTO-INJECTED HELPER FUNCTIONS') ||
      htmlCode.includes('window.analyzeImage = analyzeImage')) {
    console.log('✅ Vegvisr helper functions already injected - skipping')
    return htmlCode
  }

  const appId = crypto.randomUUID()

  const aiHelper = `
  <script>
    // ============================================
    // VEGVISR AUTO-INJECTED HELPER FUNCTIONS
    // ============================================
    console.log('🤖 Vegvisr Helper Functions loaded!');

    // Global variables for graph context
    let GRAPH_ID = null;
    let GRAPH_CONTEXT = null;

    // Fetch graph context from parent window
    async function fetchGraphContext() {
      return new Promise((resolve) => {
        const requestId = Date.now();
        console.log('📊 [App] Requesting graph context from parent...');

        const handler = (event) => {
          if (event.data.type === 'GRAPH_CONTEXT_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            console.log('✅ [App] Graph context received:', event.data.context);

            GRAPH_ID = event.data.context.graphId;
            GRAPH_CONTEXT = event.data.context;

            resolve(event.data.context);
          }
        };

        window.addEventListener('message', handler);
        window.parent.postMessage({ type: 'GET_GRAPH_CONTEXT', requestId }, '*');

        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', handler);
          console.log('⚠️ [App] Graph context request timeout');
          resolve(null);
        }, 5000);
      });
    }

    // AI Chat function - AUTOMATICALLY CONTEXT AWARE
    async function askAI(question, options = {}) {
      console.log('🤖 askAI called with question:', question);

      // Fetch graph context on first call if not yet loaded
      if (GRAPH_ID === null && GRAPH_CONTEXT === null) {
        console.log('📊 Graph context not loaded, fetching now...');
        await fetchGraphContext();
      }

      console.log('🤖 Using graph_id:', GRAPH_ID);

      try {
        const response = await fetch('https://api.vegvisr.org/user-ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: question }],
            max_tokens: options.max_tokens || 4096,
            graph_id: GRAPH_ID,
            userEmail: options.userEmail || 'superadmin'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🤖 AI Error response:', errorText);
          throw new Error('AI request failed: ' + response.status);
        }

        const data = await response.json();
        console.log('🤖 AI Response:', data);

        // Send node to parent if needed
        if (window.parent !== window && data.node) {
          console.log('🤖 Sending node to parent window:', data.node);
          window.parent.postMessage({
            type: 'ADD_AI_NODE',
            node: data.node
          }, '*');
        }

        return data.message || 'No response from AI';
      } catch (error) {
        console.error('🤖 AI Error:', error);
        throw error;
      }
    }

    // Cloud Storage Helper
    const APP_ID = '${appId}';
    let requestCounter = 0;

    function sendToParent(action, payload) {
      return new Promise((resolve, reject) => {
        const requestId = ++requestCounter;

        const handler = (event) => {
          if (event.data.type === 'CLOUD_STORAGE_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            if (event.data.success) {
              resolve(event.data.data);
            } else {
              reject(new Error(event.data.error || 'Request failed'));
            }
          }
        };

        window.addEventListener('message', handler);

        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Request timeout'));
        }, 10000);

        window.parent.postMessage({
          type: 'CLOUD_STORAGE_REQUEST',
          requestId,
          payload: { action, appId: APP_ID, ...payload }
        }, '*');
      });
    }

    async function saveData(key, value) {
      try {
        const result = await sendToParent('save', { key, value });
        return result.success ? result : null;
      } catch (error) {
        console.error('Error saving data:', error);
        return null;
      }
    }

    async function loadData(key) {
      try {
        const result = await sendToParent('load', { key });
        return result.success ? result.data.value : null;
      } catch (error) {
        console.error('Error loading data:', error);
        return null;
      }
    }

    async function loadAllData() {
      try {
        const result = await sendToParent('loadAll', {});
        return result.success ? result.data : [];
      } catch (error) {
        console.error('Error loading all data:', error);
        return [];
      }
    }

    async function deleteData(key) {
      try {
        const result = await sendToParent('delete', { key });
        return result.success;
      } catch (error) {
        console.error('Error deleting data:', error);
        return false;
      }
    }

    // Portfolio Images function
    async function getPortfolioImages(quality = 'balanced') {
      console.log('🎨 Fetching portfolio images with quality:', quality);

      try {
        const response = await fetch('https://api.vegvisr.org/list-r2-images?size=small');

        if (!response.ok) {
          throw new Error('Failed to fetch portfolio images');
        }

        const data = await response.json();
        const images = data.images || [];

        // Apply quality presets to image URLs
        const qualityPresets = {
          ultraFast: '?w=150&h=94&fit=crop&auto=format,compress&q=30',
          balanced: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2',
          highQuality: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5',
          original: ''
        };

        const params = qualityPresets[quality] || qualityPresets.balanced;

        return images.map(img => ({
          ...img,
          url: img.url.includes('?') ? img.url.split('?')[0] + params : img.url + params,
          originalUrl: img.url
        }));
      } catch (error) {
        console.error('🎨 Portfolio images error:', error);
        return [];
      }
    }

    // Pexels search function
    async function searchPexels(query, perPage = 15, page = 1) {
      try {
        const response = await fetch(\`https://api.vegvisr.org/api/pexels/search?query=\${encodeURIComponent(query)}&per_page=\${perPage}&page=\${page}\`);
        if (!response.ok) throw new Error('Failed to search Pexels');

        const result = await response.json();
        return result.data.photos;
      } catch (error) {
        console.error('Pexels search error:', error);
        throw error;
      }
    }

    // Pixabay search function
    async function searchPixabay(query, perPage = 15, page = 1) {
      try {
        const response = await fetch(\`https://api.vegvisr.org/api/pixabay/search?query=\${encodeURIComponent(query)}&per_page=\${perPage}&page=\${page}\`);
        if (!response.ok) throw new Error('Failed to search Pixabay');

        const result = await response.json();
        return result.data.hits;
      } catch (error) {
        console.error('Pixabay search error:', error);
        throw error;
      }
    }

    // Image analysis function
    async function analyzeImage(imageUrl, prompt = 'Analyze this image in detail') {
      try {
        console.log('🔍 Analyzing image:', imageUrl);
        const response = await fetch('https://api.vegvisr.org/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, prompt })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Image analysis failed');
        }

        const data = await response.json();
        return {
          analysis: data.analysis,
          model: data.model,
          tokens: data.usage?.input_tokens || 0
        };
      } catch (error) {
        console.error('🔍 Image analysis error:', error);
        throw error;
      }
    }

    // SMS sending function
    async function sendSMS(to, message, sender = 'Vegvisr') {
      return new Promise((resolve, reject) => {
        const requestId = Date.now() + Math.random();

        const handler = (event) => {
          if (event.data.type === 'SMS_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);
            if (event.data.success) {
              resolve(event.data.result);
            } else {
              reject(new Error(event.data.error || 'Failed to send SMS'));
            }
          }
        };

        window.addEventListener('message', handler);

        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('SMS request timeout'));
        }, 30000);

        window.parent.postMessage({
          type: 'sendSMS',
          requestId,
          payload: {
            phoneNumber: to,
            message: message,
            appName: sender
          }
        }, '*');
      });
    }

    // Make functions globally accessible
    window.askAI = askAI;
    window.saveData = saveData;
    window.loadData = loadData;
    window.loadAllData = loadAllData;
    window.deleteData = deleteData;
    window.getPortfolioImages = getPortfolioImages;
    window.searchPexels = searchPexels;
    window.searchPixabay = searchPixabay;
    window.analyzeImage = analyzeImage;
    window.sendSMS = sendSMS;
    window.fetchGraphContext = fetchGraphContext;

    console.log('✅ Helper functions ready: askAI (with auto-context), saveData, loadData, loadAllData, deleteData, getPortfolioImages, searchPexels, searchPixabay, analyzeImage, sendSMS');
    console.log('☁️ Cloud Storage enabled for app:', APP_ID);
  </scr` + `ipt>
  `

  // Insert before closing </body> tag
  return htmlCode.replace('</body>', `${aiHelper}\n</body>`)
}

const regenerateWithFix = async () => {
  if (!errorMessage.value.trim()) return

  isGenerating.value = true
  showErrorReporter.value = false

  try {
    // Use the model from the store (which tracks the model used for generation)
    const modelToUse = appBuilderStore.selectedAIModel || selectedAIModel.value

    const fixPrompt = `${appPrompt.value}

IMPORTANT: The previous version had this error:
${errorMessage.value}

Please fix this error in the code. Make sure all functions are properly defined before they are used.

Previous code that had the error:
\`\`\`html
${generatedCode.value}
\`\`\`

Generate a corrected version with the error fixed.`

    const response = await fetch('https://api.vegvisr.org/generate-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fixPrompt,
        aiModel: modelToUse
      })
    })

    const data = await response.json()

    if (data.success && data.code) {
      let htmlCode = data.code

      // Check if AI needs to inject helper function
      if (needsAIHelper(appPrompt.value) || htmlCode.includes('askAI(')) {
        htmlCode = injectAIHelper(htmlCode)
      }

      generatedCode.value = htmlCode
      currentApp.value = {
        prompt: appPrompt.value,
        code: htmlCode,
        timestamp: new Date().toISOString()
      }

      createPreview(generatedCode.value)
      errorMessage.value = '' // Clear error message after successful fix

      deploymentStatus.value = { type: 'success', message: '✅ App regenerated with fix!' }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)
    } else {
      throw new Error(data.error || 'Failed to regenerate app')
    }
  } catch (error) {
    console.error('Regeneration error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error: ${error.message}` }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 5000)
  } finally {
    isGenerating.value = false
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    deploymentStatus.value = { type: 'success', message: '📋 Code copied to clipboard!' }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 2000)
  } catch (error) {
    console.error('Copy failed:', error)
  }
}

// Start a new app from scratch
const startNewApp = () => {
  if (currentApp.value || generatedCode.value) {
    // Show custom dialog asking what to do
    showNewAppDialog.value = true
  } else {
    // No app in progress, just reset
    resetAppBuilder()
  }
}

// Save current app and start new
const shouldResetAfterSave = ref(false)

const saveAndStartNew = () => {
  showNewAppDialog.value = false
  shouldResetAfterSave.value = true
  openSaveDialog()
  // After save completes in saveAppToHistory, we'll reset
}

// Discard current app and start new
const discardAndStartNew = () => {
  showNewAppDialog.value = false
  resetAppBuilder()
}

// Reset the app builder to initial state
const resetAppBuilder = () => {
  // Clear the store
  appBuilderStore.clearApp()

  // Clear local state
  appPrompt.value = ''
  generatedCode.value = ''
  currentApp.value = null
  previewUrl.value = null
  deployedUrl.value = null
  selectedAIModel.value = 'gpt-4o'
  showTemplates.value = false
  conversationHistory.value = []
  conversationMode.value = false

  deploymentStatus.value = {
    type: 'success',
    message: '✨ Ready to create a new app!'
  }

  setTimeout(() => {
    deploymentStatus.value = null
  }, 2000)

  console.log('🆕 Started new app, store cleared')
}

const deployApp = async () => {
  if (!currentApp.value || !generatedCode.value) return

  // Show save dialog for template save
  isSavingAsTemplate.value = true
  saveAppName.value = appPrompt.value.substring(0, 50)
  saveAppDescription.value = ''
  saveAppTags.value = ''
  saveAppThumbnail.value = ''
  showSaveDialog.value = true
}

const openInNewTab = () => {
  if (previewUrl.value) {
    window.open(previewUrl.value, '_blank')
  }
}

const downloadApp = () => {
  if (!generatedCode.value) return

  const blob = new Blob([generatedCode.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `app-${Date.now()}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  deploymentStatus.value = { type: 'success', message: '📥 App downloaded!' }
  setTimeout(() => {
    deploymentStatus.value = null
  }, 2000)
}

// Portfolio Image Functions
const openPortfolioModal = async () => {
  portfolioSelectionMode.value = 'prompt'
  showPortfolioModal.value = true
  loadingPortfolioImages.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/list-r2-images?size=small')
    const data = await response.json()
    portfolioImages.value = data.images || []
  } catch (error) {
    console.error('Error fetching portfolio images:', error)
    portfolioImages.value = []
  } finally {
    loadingPortfolioImages.value = false
  }
}

const closePortfolioModal = () => {
  showPortfolioModal.value = false
}

const toggleImageSelection = (img) => {
  const index = selectedPortfolioImages.value.findIndex(i => i.url === img.url)
  if (index > -1) {
    selectedPortfolioImages.value.splice(index, 1)
  } else {
    selectedPortfolioImages.value.push(img)
  }
}

const isImageSelected = (img) => {
  return selectedPortfolioImages.value.some(i => i.url === img.url)
}

const getOptimizedImageUrl = (baseUrl, preset = null) => {
  if (!baseUrl) return baseUrl

  const currentPreset = preset || imageQualityPreset.value
  const presets = {
    ultraFast: '?w=150&h=94&fit=crop&auto=format,compress&q=30',
    balanced: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2',
    highQuality: '?w=150&h=94&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5',
  }

  const params = presets[currentPreset] || presets.balanced

  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const addSelectedImagesToPrompt = () => {
  if (selectedPortfolioImages.value.length === 0) return

  // Check if we're selecting for thumbnail or prompt
  if (portfolioSelectionMode.value === 'thumbnail') {
    // Use first selected image as thumbnail
    const selectedImage = selectedPortfolioImages.value[0]
    saveAppThumbnail.value = getOptimizedImageUrl(selectedImage.url, 'highQuality')

    deploymentStatus.value = {
      type: 'success',
      message: '✅ Thumbnail set!'
    }
  } else {
    // Add to prompt (original behavior)
    const imageUrls = selectedPortfolioImages.value
      .map(img => getOptimizedImageUrl(img.url, 'highQuality'))
      .join(', ')

    const imageSection = `\n\nAvailable portfolio images to use in the app:\n${imageUrls}`

    if (!appPrompt.value.includes('Available portfolio images')) {
      appPrompt.value += imageSection
    }

    deploymentStatus.value = {
      type: 'success',
      message: `✅ Added ${selectedPortfolioImages.value.length} image(s) to prompt!`
    }
  }

  setTimeout(() => {
    deploymentStatus.value = null
  }, 2000)

  closePortfolioModal()
}

const clearSelectedImages = () => {
  selectedPortfolioImages.value = []
}

// Thumbnail Upload Functions
// ==========================

const pasteImageForThumbnail = async () => {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          await uploadThumbnailImage(blob)
          return
        }
      }
    }
    deploymentStatus.value = { type: 'error', message: '❌ No image found in clipboard' }
    setTimeout(() => deploymentStatus.value = null, 3000)
  } catch (error) {
    console.error('Error pasting image:', error)
    deploymentStatus.value = { type: 'error', message: '❌ Failed to paste image' }
    setTimeout(() => deploymentStatus.value = null, 3000)
  }
}

const uploadThumbnailImage = async (file) => {
  try {
    uploadingThumbnail.value = true
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`)
    }

    const data = await response.json()
    saveAppThumbnail.value = data.url

    deploymentStatus.value = { type: 'success', message: '✅ Thumbnail uploaded!' }
    setTimeout(() => deploymentStatus.value = null, 2000)
  } catch (error) {
    console.error('Error uploading thumbnail:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Upload failed: ${error.message}` }
    setTimeout(() => deploymentStatus.value = null, 5000)
  } finally {
    uploadingThumbnail.value = false
  }
}

const openPortfolioImagePicker = async () => {
  portfolioSelectionMode.value = 'thumbnail'
  showPortfolioModal.value = true
  loadingPortfolioImages.value = true
  selectedPortfolioImages.value = [] // Clear previous selections

  try {
    const response = await fetch('https://api.vegvisr.org/list-r2-images?size=small')
    const data = await response.json()
    portfolioImages.value = data.images || []
  } catch (error) {
    console.error('Error fetching portfolio images:', error)
    portfolioImages.value = []
  } finally {
    loadingPortfolioImages.value = false
  }
}

// App History Management Functions
// =================================

const suggestAppMetadata = async () => {
  if (!currentApp.value || !currentApp.value.prompt) {
    deploymentStatus.value = { type: 'error', message: '❌ No app to analyze. Generate an app first.' }
    return
  }

  isSuggestingAppMetadata.value = true

  try {
    console.log('🤖 Requesting AI suggestions for prompt:', currentApp.value.prompt)

    const response = await fetch('https://api.vegvisr.org/api/prompt-library/suggest-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: currentApp.value.prompt
      })
    })

    console.log('📡 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error response:', errorText)
      throw new Error(`Server error: ${response.status}`)
    }

    const metadata = await response.json()
    console.log('✅ Received metadata:', metadata)

    // Backend returns metadata directly: {name, description, category, tags}
    if (metadata && metadata.name) {
      saveAppName.value = metadata.name
      saveAppDescription.value = metadata.description || ''
      saveAppTags.value = metadata.tags ? metadata.tags.join(', ') : ''

      deploymentStatus.value = { type: 'success', message: '✨ AI suggestions applied!' }
      setTimeout(() => deploymentStatus.value = null, 2000)
    } else {
      console.error('❌ Invalid metadata structure:', metadata)
      throw new Error('Invalid metadata response from AI')
    }
  } catch (error) {
    console.error('❌ Error suggesting metadata:', error)
    deploymentStatus.value = { type: 'error', message: `❌ ${error.message}` }
    setTimeout(() => deploymentStatus.value = null, 5000)
  } finally {
    isSuggestingAppMetadata.value = false
  }
}

const openSaveDialog = () => {
  if (!generatedCode.value || !currentApp.value) {
    deploymentStatus.value = { type: 'error', message: '❌ No app to save. Generate an app first.' }
    return
  }

  // Saving to history (not template)
  isSavingAsTemplate.value = false
  
  // Pre-fill app name from prompt or use default
  const promptWords = appPrompt.value.trim().split(' ')
  saveAppName.value = promptWords.slice(0, 3).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') || 'My App'
  saveAppDescription.value = ''
  saveAppTags.value = ''
  showSaveDialog.value = true
}

const saveAppToHistory = async () => {
  if (!saveAppName.value.trim()) {
    deploymentStatus.value = { type: 'error', message: '❌ Please enter an app name' }
    return
  }

  console.log('💾 Saving app to history with userId:', userStore.user_id)
  console.log('👤 UserStore:', { email: userStore.email, role: userStore.role })
  console.log('📌 Current version info:', appBuilderStore.currentVersionInfo)

  try {
    const tags = saveAppTags.value
      ? saveAppTags.value.split(',').map(tag => tag.trim()).filter(Boolean)
      : []

    // Check if this is a version save (has currentVersionInfo) or new app
    const isVersionSave = appBuilderStore.currentVersionInfo !== null

    let endpoint, payload

    if (isVersionSave) {
      // Save as new version
      endpoint = 'https://api.vegvisr.org/api/app-history/new-version'
      payload = {
        userId: userStore.user_id,
        appHistoryId: appBuilderStore.currentVersionInfo.historyId,
        prompt: appPrompt.value || currentApp.value.prompt,
        aiModel: selectedAIModel.value,
        generatedCode: generatedCode.value,
        previousCode: appBuilderStore.currentApp?.code || null,
        conversationHistory: conversationHistory.value
      }
    } else {
      // Save as new app
      endpoint = 'https://api.vegvisr.org/api/app-history/save'
      payload = {
        userId: userStore.user_id,
        prompt: appPrompt.value || currentApp.value.prompt,
        aiModel: selectedAIModel.value,
        generatedCode: generatedCode.value,
        appName: saveAppName.value.trim(),
        description: saveAppDescription.value.trim(),
        tags,
        conversationHistory: conversationHistory.value
      }
    }

    console.log('📤 Save payload:', {
      ...payload,
      generatedCode: payload.generatedCode.substring(0, 100) + '...',
      endpoint,
      isVersionSave
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    console.log('📡 Response status:', response.status)

    const result = await response.json()
    console.log('📥 Response data:', result)

    if (result.success) {
      showSaveDialog.value = false

      // Update store with new version info
      if (isVersionSave && result.versionNumber) {
        appBuilderStore.currentVersionInfo = {
          historyId: result.appHistoryId,
          versionId: result.versionId,
          versionNumber: result.versionNumber,
          appName: appBuilderStore.currentVersionInfo.appName // Keep the app name
        }
      } else if (!isVersionSave) {
        // New app saved, update store with version 1.00
        appBuilderStore.currentVersionInfo = {
          historyId: result.historyId,
          versionId: result.versionId,
          versionNumber: result.versionNumber || 1.00,
          appName: saveAppName.value.trim()
        }
      }

      deploymentStatus.value = {
        type: 'success',
        message: isVersionSave
          ? `✅ Version ${result.versionNumber} saved!`
          : `✅ "${result.appName}" v${result.versionNumber || '1.00'} saved to history!`
      }

      // Also save to GraphTemplates if this is a template save
      if (isSavingAsTemplate.value) {
        try {
          const templateData = {
            name: saveAppName.value.trim(),
            category: 'My Apps',
            userId: userStore.email || 'anonymous',
            node: {
              id: `app-${Date.now()}`,
              type: 'app-viewer',
              label: saveAppName.value.trim(),
              info: generatedCode.value,
              color: '#11998e',
              visible: true,
              bibl: [],
              imageWidth: '100%',
              imageHeight: '100%',
              path: saveAppThumbnail.value || null, // Use path field for thumbnail URL
              ai_prompt: appPrompt.value,
              ai_model: selectedAIModel.value,
              generated_at: new Date().toISOString()
            },
            ai_instructions: JSON.stringify({
              prompt: appPrompt.value,
              model: selectedAIModel.value,
              generated_at: new Date().toISOString(),
              generated_by: 'AI App Builder',
              user_email: userStore.email || 'anonymous',
              description: saveAppDescription.value.trim(),
              tags
            })
          }

          await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/addTemplate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData)
          })

          deploymentStatus.value = {
            type: 'success',
            message: `✅ "${result.appName}" saved to history and templates!`
          }
        } catch (templateError) {
          console.error('Failed to save to GraphTemplates:', templateError)
          // Don't fail - history save succeeded
        }
      }

      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)

      // If saving before starting new app, reset after save
      if (shouldResetAfterSave.value) {
        shouldResetAfterSave.value = false
        setTimeout(() => {
          resetAppBuilder()
        }, 500) // Small delay to show success message
      }
    } else {
      throw new Error(result.error || 'Failed to save app')
    }
  } catch (error) {
    console.error('Save app error:', error)
    deploymentStatus.value = {
      type: 'error',
      message: `❌ ${error.message}`
    }
  }
}

// Prompt Library Functions
// =========================

// AI Suggestion Functions
const suggestAllMetadata = async () => {
  if (!appPrompt.value.trim()) {
    deploymentStatus.value = { type: 'error', message: '❌ Please enter a prompt first' }
    return
  }

  loadingAISuggestions.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/api/prompt-library/suggest-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promptText: appPrompt.value
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to get AI suggestions: ${response.status}`)
    }

    const suggestions = await response.json()

    // Fill all fields with AI suggestions
    promptName.value = suggestions.name || ''
    promptDescription.value = suggestions.description || ''
    promptCategory.value = suggestions.category || ''
    promptTags.value = suggestions.tags ? suggestions.tags.join(', ') : ''

    deploymentStatus.value = {
      type: 'success',
      message: '✨ AI suggestions applied!'
    }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 2000)

  } catch (error) {
    console.error('AI suggestion error:', error)
    deploymentStatus.value = {
      type: 'error',
      message: `❌ Failed to get AI suggestions: ${error.message}`
    }
  } finally {
    loadingAISuggestions.value = false
  }
}

const suggestPromptName = async () => {
  loadingAISuggestions.value = true
  try {
    const suggestions = await getAISuggestions()
    promptName.value = suggestions.name || ''
  } catch (error) {
    console.error('AI name suggestion error:', error)
  } finally {
    loadingAISuggestions.value = false
  }
}

const suggestPromptDescription = async () => {
  loadingAISuggestions.value = true
  try {
    const suggestions = await getAISuggestions()
    promptDescription.value = suggestions.description || ''
  } catch (error) {
    console.error('AI description suggestion error:', error)
  } finally {
    loadingAISuggestions.value = false
  }
}

const suggestPromptCategory = async () => {
  loadingAISuggestions.value = true
  try {
    const suggestions = await getAISuggestions()
    promptCategory.value = suggestions.category || ''
  } catch (error) {
    console.error('AI category suggestion error:', error)
  } finally {
    loadingAISuggestions.value = false
  }
}

const suggestPromptTags = async () => {
  loadingAISuggestions.value = true
  try {
    const suggestions = await getAISuggestions()
    promptTags.value = suggestions.tags ? suggestions.tags.join(', ') : ''
  } catch (error) {
    console.error('AI tags suggestion error:', error)
  } finally {
    loadingAISuggestions.value = false
  }
}

const getAISuggestions = async () => {
  if (!appPrompt.value.trim()) {
    throw new Error('Please enter a prompt first')
  }

  const response = await fetch('https://api.vegvisr.org/api/prompt-library/suggest-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptText: appPrompt.value
    })
  })

  if (!response.ok) {
    throw new Error(`Failed to get AI suggestions: ${response.status}`)
  }

  return await response.json()
}

const openSavePromptDialog = () => {
  if (!appPrompt.value.trim()) return

  // Pre-fill prompt name from beginning of prompt
  const promptWords = appPrompt.value.trim().split(' ')
  promptName.value = promptWords.slice(0, 4).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') || 'My Prompt'
  promptDescription.value = ''
  promptCategory.value = ''
  promptTags.value = ''
  showSavePromptDialog.value = true
}

const savePromptToLibrary = async () => {
  if (!promptName.value.trim()) {
    deploymentStatus.value = { type: 'error', message: '❌ Please enter a prompt name' }
    return
  }

  try {
    const tags = promptTags.value
      ? promptTags.value.split(',').map(tag => tag.trim()).filter(Boolean)
      : []

    const response = await fetch('https://api.vegvisr.org/api/prompt-library/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.user_id,
        promptName: promptName.value.trim(),
        promptText: appPrompt.value.trim(),
        description: promptDescription.value.trim(),
        category: promptCategory.value,
        tags
      })
    })

    const result = await response.json()

    if (result.success) {
      showSavePromptDialog.value = false
      deploymentStatus.value = {
        type: 'success',
        message: `📝 Prompt "${promptName.value}" saved to library!`
      }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)
    } else {
      throw new Error(result.error || 'Failed to save prompt')
    }
  } catch (error) {
    console.error('Save prompt error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error saving prompt: ${error.message}` }
  }
}

const loadPromptLibrary = async () => {
  if (!userStore.user_id) return

  loadingPrompts.value = true

  try {
    const response = await fetch(`https://api.vegvisr.org/api/prompt-library/list?userId=${userStore.user_id}&limit=50&offset=0`)
    const result = await response.json()

    if (result.success) {
      savedPrompts.value = result.prompts
      showPromptLibrary.value = true
    } else {
      throw new Error(result.error || 'Failed to load prompt library')
    }
  } catch (error) {
    console.error('Load prompts error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error loading prompts: ${error.message}` }
  } finally {
    loadingPrompts.value = false
  }
}

const loadPromptToEditor = async (prompt) => {
  try {
    // Call the load endpoint to increment use count
    await fetch('https://api.vegvisr.org/api/prompt-library/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.user_id,
        promptId: prompt.id
      })
    })

    // Load the prompt text into the editor
    appPrompt.value = prompt.prompt_text
    showPromptLibrary.value = false

    deploymentStatus.value = {
      type: 'success',
      message: `📝 Loaded prompt: "${prompt.prompt_name}"`
    }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 2000)
  } catch (error) {
    console.error('Load prompt to editor error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error loading prompt: ${error.message}` }
  }
}

const deletePromptFromLibrary = async (promptId) => {
  const prompt = savedPrompts.value.find(p => p.id === promptId)
  if (!confirm(`Delete prompt "${prompt?.prompt_name || 'Untitled'}" permanently?`)) {
    return
  }

  try {
    const response = await fetch('https://api.vegvisr.org/api/prompt-library/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userStore.user_id,
        promptId
      })
    })

    const result = await response.json()

    if (result.success) {
      savedPrompts.value = savedPrompts.value.filter(p => p.id !== promptId)
      deploymentStatus.value = { type: 'success', message: '📝 Prompt deleted from library' }
      setTimeout(() => {
        deploymentStatus.value = null
      }, 2000)
    } else {
      throw new Error(result.error || 'Failed to delete prompt')
    }
  } catch (error) {
    console.error('Delete prompt error:', error)
    deploymentStatus.value = { type: 'error', message: `❌ Error deleting prompt: ${error.message}` }
  }
}

// API Library Functions
// =====================

// Note: API Library has been moved to /api-library route
// enabledAPIs and enabledComponents are now managed in appBuilderStore
// The store automatically persists to localStorage

// AI API Creator Functions
// =========================

const generateAPIWithAI = async () => {
  if (!apiEndpointUrl.value.trim()) {
    deploymentStatus.value = { type: 'error', message: '❌ Please provide the API endpoint URL' }
    return
  }

  isGeneratingAPI.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken
      },
      body: JSON.stringify({
        prompt: `You are a JavaScript API wrapper generator. The user has already implemented a Cloudflare Worker API endpoint and needs you to generate the client-side wrapper function and documentation.

**EXISTING BACKEND ENDPOINT:**
URL: ${apiEndpointUrl.value}
${apiCreatorPrompt.value ? `Description: ${apiCreatorPrompt.value}` : ''}

**YOUR TASK:** Generate a client-side JavaScript wrapper function that calls this endpoint.

Generate a JSON object with these fields:
{
  "name": "Descriptive API Name (e.g., 'Giphy GIF Search')",
  "slug": "api-slug (lowercase, hyphenated, based on endpoint name)",
  "category": "category (choose: images, ai, storage, weather, maps, social, finance, other)",
  "description": "Brief description (1-2 sentences explaining what the API does)",
  "icon": "Single emoji representing the API",
  "color": "Hex color code matching the brand/category (e.g., #FF6B35)",
  "function_name": "functionName (camelCase, descriptive)",
  "function_signature": "async function functionName(param1, param2 = defaultValue)",
  "function_code": "Complete async function that:\n    - Accepts appropriate parameters based on the endpoint\n    - Builds the full URL with query params using encodeURIComponent\n    - Makes fetch request with X-API-Token header\n    - Parses JSON response\n    - Checks data.success and throws Error if false\n    - Returns the data payload\n    - Example:\n    async function searchGifs(query, limit = 20) {\n      const response = await fetch(\`${apiEndpointUrl.value}?query=\${encodeURIComponent(query)}&limit=\${limit}\`, {\n        headers: { 'X-API-Token': window.API_TOKEN }\n      });\n      const data = await response.json();\n      if (!data.success) throw new Error(data.error || 'Request failed');\n      return data.results;\n    }",
  "endpoint_url": "${apiEndpointUrl.value}",
  "docs_url": "Official API documentation URL if known (or null)",
  "example_code": "Real-world usage example:\n    - Show how to call the function\n    - Display or process the results\n    - Use realistic parameters",
  "rate_limit": "Rate limit info (e.g., '60 requests/minute', 'Unlimited')",
  "requires_auth": true
}

**CRITICAL RULES:**
1. Return ONLY valid JSON, no markdown fences, no explanations
2. The endpoint_url MUST be exactly: ${apiEndpointUrl.value}
3. The function_code must call this exact endpoint
4. Include proper error handling (check data.success)
5. Use window.API_TOKEN for authentication
6. Make the function_name match the API purpose (e.g., searchGifs, getWeather, translateText)
7. Include realistic example_code that would actually work`,
        model: 'grok-beta'
      })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate API specification')
    }

    // Parse the AI response as JSON
    let apiSpec
    try {
      // Extract JSON from response (in case AI added explanations)
      const jsonMatch = result.response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      apiSpec = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Parse error:', parseError)
      throw new Error('Failed to parse AI response. Please try again.')
    }

    // Validate required fields
    const requiredFields = ['name', 'slug', 'category', 'description', 'function_name', 'function_signature', 'function_code']
    const missingFields = requiredFields.filter(field => !apiSpec[field])
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
    }

    // Ensure endpoint_url matches what user provided
    apiSpec.endpoint_url = apiEndpointUrl.value

    generatedAPIData.value = {
      ...apiSpec,
      status: 'active',
      is_enabled_by_default: false,
      is_always_on: false
    }

    deploymentStatus.value = {
      type: 'success',
      message: '✨ API wrapper generated! Review and save below.'
    }
    setTimeout(() => {
      deploymentStatus.value = null
    }, 3000)

  } catch (error) {
    console.error('Generate API error:', error)
    deploymentStatus.value = {
      type: 'error',
      message: `❌ Failed to generate API: ${error.message}`
    }
  } finally {
    isGeneratingAPI.value = false
  }
}

const saveGeneratedAPI = async () => {
  if (!generatedAPIData.value) return

  isSavingAPI.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/api/apis/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generatedAPIData.value)
    })

    const result = await response.json()

    if (result.success) {
      deploymentStatus.value = {
        type: 'success',
        message: `✅ API "${generatedAPIData.value.name}" created successfully!`
      }

      // Reset form
      apiCreatorPrompt.value = ''
      apiEndpointUrl.value = ''
      generatedAPIData.value = null
      showAPICreator.value = false

      // API saved successfully - user can view it on /api-library page

      setTimeout(() => {
        deploymentStatus.value = null
      }, 3000)
    } else {
      throw new Error(result.error || 'Failed to save API')
    }
  } catch (error) {
    console.error('Save API error:', error)
    deploymentStatus.value = {
      type: 'error',
      message: `❌ Failed to save API: ${error.message}`
    }
  } finally {
    isSavingAPI.value = false
  }
}

const cancelAPICreator = () => {
  showAPICreator.value = false
  apiCreatorPrompt.value = ''
  apiEndpointUrl.value = ''
  generatedAPIData.value = null
}

// Watch for edit mode toggle to update preview
watch(editCode, (newValue) => {
  if (!newValue && generatedCode.value) {
    // Switched from edit to preview mode, update the preview
    setTimeout(() => {
      createPreview(generatedCode.value)
      console.log('🎨 Preview refreshed after exiting edit mode')
    }, 100)
  } else if (newValue) {
    // Switched to edit mode, focus the textarea
    nextTick(() => {
      if (codeEditorTextarea.value) {
        codeEditorTextarea.value.focus()
        console.log('✏️ Code editor focused')
      }
    })
  }
})

// Sync conversation history to store when it changes
watch(conversationHistory, (newValue) => {
  appBuilderStore.conversationHistory = newValue
}, { deep: true })

// Load apps on mount
onMounted(() => {
  // enabledAPIs and enabledComponents are loaded from store automatically

  // Check if a version was loaded from App History view (via store)
  if (appBuilderStore.currentVersionInfo) {
    // Version was loaded via store, sync to local refs
    appPrompt.value = appBuilderStore.appPrompt
    generatedCode.value = appBuilderStore.generatedCode
    selectedAIModel.value = appBuilderStore.selectedAIModel || 'grok' // Ensure valid default
    currentApp.value = appBuilderStore.currentApp
    conversationHistory.value = appBuilderStore.conversationHistory || []
    showTemplates.value = false

    // If there's no conversation history but there is a prompt,
    // initialize conversation history with the original prompt
    // This allows users to continue refining even old apps
    if (conversationHistory.value.length === 0 && appPrompt.value) {
      conversationHistory.value = [{
        role: 'user',
        content: appPrompt.value,
        timestamp: currentApp.value.created_at || new Date().toISOString()
      }]
      conversationMode.value = true
      console.log('📝 Initialized conversation history with original prompt')
    }

    // Create preview immediately
    createPreview(appBuilderStore.generatedCode)

    // Show success message
    const versionName = appBuilderStore.getVersionDisplayName()
    const historyMsg = conversationHistory.value.length > 0
      ? ` (${conversationHistory.value.length} conversation${conversationHistory.value.length > 1 ? 's' : ''})`
      : ''
    deploymentStatus.value = {
      type: 'success',
      message: `✅ Loaded ${versionName}${historyMsg} - Ready to regenerate!`
    }

    console.log('✅ Loaded version from store:', appBuilderStore.currentVersionInfo)
    console.log('📜 Conversation history restored:', conversationHistory.value)
  }

  // Listen for postMessage requests from iframe apps
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
})

// Auto-scroll streaming code to bottom as it updates
watch(streamingCode, () => {
  if (streamingCodeElement.value) {
    streamingCodeElement.value.scrollTop = streamingCodeElement.value.scrollHeight
  }
})

// Handle postMessage from iframe apps for cloud storage
const handleIframeMessage = async (event) => {
  // Security: Accept messages from preview iframe (same origin OR blob URLs)
  const isPreviewFrame = event.source === previewFrame.value?.contentWindow
  const isSameOrigin = event.origin === window.location.origin

  if (!isPreviewFrame && !isSameOrigin) {
    console.warn('⚠️ Rejected message from unknown source:', event.origin)
    return
  }

  const { type, payload, requestId } = event.data

  console.log('📨 Received message:', { type, origin: event.origin, requestId, isPreviewFrame })

  // Handle SMS requests separately
  if (type === 'sendSMS') {
    console.log('📱 SMS request received:', payload)
    try {
      const result = await fetch('https://sms-gateway.torarnehave.workers.dev/api/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: payload.phoneNumber,
          message: payload.message,
          sender: payload.appName || 'Vegvisr'
        })
      })

      const data = await result.json()
      console.log('📱 SMS result:', data)

      const smsOrigin = event.origin.startsWith('blob:') || event.origin === 'null' ? '*' : event.origin
      event.source.postMessage({
        type: 'SMS_RESPONSE',
        requestId,
        success: data.success || result.ok,
        result: data
      }, smsOrigin)
    } catch (error) {
      console.error('📱 SMS error:', error)
      const smsOrigin = event.origin.startsWith('blob:') || event.origin === 'null' ? '*' : event.origin
      event.source.postMessage({
        type: 'SMS_RESPONSE',
        requestId,
        success: false,
        error: error.message
      }, smsOrigin)
    }
    return
  }

  if (type === 'CLOUD_STORAGE_REQUEST') {
    const userId = userStore.user_id
    const apiToken = userStore.emailVerificationToken

    console.log('🔐 Auth check:', { userId: !!userId, apiToken: !!apiToken })

    if (!userId || !apiToken) {
      console.error('❌ Not authenticated')
      const targetOrigin = event.origin.startsWith('blob:') || event.origin === 'null' ? '*' : event.origin
      event.source.postMessage({
        type: 'CLOUD_STORAGE_RESPONSE',
        requestId,
        success: false,
        error: 'Not authenticated'
      }, targetOrigin)
      return
    }

    try {
      let result

      switch (payload.action) {
        case 'save':
          console.log('💾 Saving to cloud:', { appId: payload.appId, key: payload.key })
          result = await fetch('https://api.vegvisr.org/api/user-app/data/set', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Token': apiToken
            },
            body: JSON.stringify({
              userId,
              appId: payload.appId,
              key: payload.key,
              value: payload.value
            })
          }).then(r => r.json())
          console.log('📦 Save result:', result)
          break

        case 'load':
          result = await fetch(
            `https://api.vegvisr.org/api/user-app/data/get?userId=${userId}&appId=${payload.appId}&key=${payload.key}`,
            { headers: { 'X-API-Token': apiToken } }
          ).then(r => r.json())
          break

        case 'loadAll':
          result = await fetch(
            `https://api.vegvisr.org/api/user-app/data/list?userId=${userId}&appId=${payload.appId}`,
            { headers: { 'X-API-Token': apiToken } }
          ).then(r => r.json())
          break

        case 'delete':
          result = await fetch('https://api.vegvisr.org/api/user-app/data/delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Token': apiToken
            },
            body: JSON.stringify({
              userId,
              appId: payload.appId,
              key: payload.key
            })
          }).then(r => r.json())
          break

        default:
          throw new Error(`Unknown action: ${payload.action}`)
      }

      // Send success response back to iframe (use '*' for blob: origins)
      const targetOrigin = event.origin.startsWith('blob:') || event.origin === 'null' ? '*' : event.origin
      console.log('✅ Sending success response:', { requestId, targetOrigin, actualOrigin: event.origin })
      event.source.postMessage({
        type: 'CLOUD_STORAGE_RESPONSE',
        requestId,
        success: true,
        data: result
      }, targetOrigin)

    } catch (error) {
      console.error('❌ Cloud storage request error:', error)
      const targetOrigin = event.origin.startsWith('blob:') || event.origin === 'null' ? '*' : event.origin
      event.source.postMessage({
        type: 'CLOUD_STORAGE_RESPONSE',
        requestId,
        success: false,
        error: error.message
      }, targetOrigin)
    }
  }
}

</script>

<style scoped>
.app-builder {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 2rem;
}

.builder-header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  margin: 0;
  font-size: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  margin: 0.5rem 0 0 0;
  color: #666;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

/* Template Gallery */
.template-gallery {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.template-gallery h2 {
  margin-bottom: 1.5rem;
  color: #333;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.template-card {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 20%);
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.template-card.selected {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.template-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.template-card h3 {
  margin: 0.5rem 0;
  font-size: 1.2rem;
}

.template-card p {
  color: inherit;
  opacity: 0.8;
  margin: 0.5rem 0 1rem 0;
  font-size: 0.9rem;
}

.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.tag {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.template-card.selected .tag {
  background: rgba(255, 255, 255, 0.4);
}

.loading-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.empty-state p {
  margin: 1rem 0;
}

.empty-state .btn-primary {
  margin-top: 1.5rem;
}

/* AI Builder */
.ai-builder {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.builder-panel,
.preview-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.preview-panel.fullscreen-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border-radius: 0;
  padding: 1rem;
  max-width: 100vw;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
}

.preview-panel.fullscreen-preview .preview-container {
  flex: 1;
  height: auto;
}

/* Streaming Code Preview */
.streaming-preview {
  height: 100%;
  min-height: 600px;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.streaming-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #4ade80;
  font-size: 0.9rem;
  font-weight: 500;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.code-length {
  color: #888;
  font-size: 0.85rem;
}

.streaming-code {
  flex: 1;
  margin: 0;
  padding: 1.5rem;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  background: #1e1e1e;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.streaming-code::-webkit-scrollbar {
  width: 10px;
}

.streaming-code::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.streaming-code::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 5px;
}

.streaming-code::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Conversation Styles */
.conversation-history {
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  scroll-behavior: smooth;
}

.message {
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.message-author {
  font-weight: 600;
  color: #667eea;
}

.message.user .message-author {
  color: #48bb78;
}

.model-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.message-time {
  color: #999;
  font-size: 0.8rem;
}

.message-content {
  padding: 1rem;
  border-radius: 8px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.user-message {
  color: #333;
  line-height: 1.6;
  white-space: pre-wrap;
}

.assistant-message {
  color: #555;
}

.thinking-indicator {
  padding: 0.75rem;
  background: #e6f3ff;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  color: #667eea;
  font-style: italic;
  margin-bottom: 1rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.code-preview {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-top: 0.5rem;
  overflow: hidden;
}

.code-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #2d3748;
  color: white;
  font-size: 0.85rem;
}

.code-preview pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  background: #1a202c;
  color: #e2e8f0;
}

.code-preview code {
  font-family: inherit;
}

.code-editor {
  width: 100%;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  background: #1a202c;
  color: #e2e8f0;
  border: 1px solid #4a5568;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.5rem;
  resize: vertical;
  line-height: 1.4;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
  position: relative;
  z-index: 1;
  pointer-events: auto;
  user-select: text;
  opacity: 1 !important;
  filter: none !important;
}

.code-editor:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.code-editor::placeholder {
  color: #a0aec0;
  font-style: italic;
}

.preview-updating {
  color: #667eea;
  font-size: 0.85rem;
  font-weight: 500;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.btn-tiny {
  padding: 0.25rem 0.75rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.2s;
}

.btn-tiny:hover {
  background: #5568d3;
}

.explanation {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f7fafc;
  border-left: 3px solid #48bb78;
  border-radius: 4px;
  color: #2d3748;
  line-height: 1.6;
}

.prompt-section {
  margin-bottom: 2rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.prompt-section h2 {
  margin-bottom: 1rem;
  color: #333;
  font-size: 1.25rem;
}

.prompt-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  margin-bottom: 1rem;
  resize: vertical;
  transition: border-color 0.3s;
}

.prompt-input:focus {
  outline: none;
  border-color: #667eea;
}

.storage-option {
  margin: 1rem 0;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.storage-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.storage-checkbox.sub-option {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.storage-checkbox input[type="checkbox"] {
  margin-top: 0.25rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.checkbox-label strong {
  font-size: 1rem;
  font-weight: 600;
}

.checkbox-label small {
  opacity: 0.9;
  font-size: 0.85rem;
  line-height: 1.4;
}

.model-selection {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
}

.model-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
  color: #333;
}

.model-label strong {
  white-space: nowrap;
}

.model-select {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 2px solid #d0d0d0;
  border-radius: 6px;
  font-size: 0.95rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.model-select:hover {
  border-color: #667eea;
}

.model-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.model-hint {
  display: block;
  color: #666;
  font-size: 0.85rem;
  font-style: italic;
  margin-left: 0.25rem;
}

.prompt-hints {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #999;
}

.hint {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.selected-images-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #e6f3ff;
  border-radius: 6px;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #2c5282;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  padding: 0;
}

.btn-link:hover {
  color: #5568d3;
}

.code-section {
  margin-top: 2rem;
  position: relative;
  z-index: 1;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.code-header h3 {
  margin: 0;
  color: #333;
}

.code-actions {
  display: flex;
  gap: 0.5rem;
}

.code-editor,
.code-preview {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  background: #f5f5f5;
  overflow: auto;
}

.code-editor {
  resize: vertical;
}

.code-preview {
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.code-preview code {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Error Reporter */
.error-reporter {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.error-reporter h4 {
  margin: 0 0 0.5rem 0;
  color: #856404;
}

.error-reporter p {
  margin: 0 0 1rem 0;
  color: #856404;
  font-size: 0.9rem;
}

.error-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ffc107;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.error-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-warning {
  background: #ffc107 !important;
  color: #000 !important;
}

.btn-warning:hover {
  background: #e0a800 !important;
}

/* Preview Panel */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h3 {
  margin: 0;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.version-tag {
  font-size: 0.75rem;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  letter-spacing: 0.5px;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.preview-container {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  height: 600px;
  overflow: hidden;
  background: white;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.preview-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.deployment-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #e8f5e9;
  border-radius: 8px;
  text-align: center;
}

.deployment-info a {
  color: #2e7d32;
  text-decoration: none;
  font-weight: 500;
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-small {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 1rem;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ai-enhance {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  position: relative;
  overflow: hidden;
}

.btn-ai-enhance::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s;
}

.btn-ai-enhance:hover:not(:disabled)::before {
  left: 100%;
}

.btn-ai-enhance:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

.btn-ai-enhance:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 0.9; }
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #667eea;
  color: white;
}

.btn-secondary.btn-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: #f5f5f5;
  color: #333;
}

.btn-small:hover {
  background: #e0e0e0;
}

/* Deployment Toast */
.deployment-toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  font-weight: 500;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.deployment-toast.success {
  background: #4caf50;
  color: white;
}

.deployment-toast.error {
  background: #f44336;
  color: white;
}

.deployment-toast.info {
  background: #2196f3;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Portfolio Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 2rem;
}

.modal {
  background: white;
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal.large {
  max-width: 900px;
}

.portfolio-modal {
  background: white;
  border-radius: 16px;
  max-width: 1000px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f0f0f0;
  color: #333;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
  border-radius: 0 0 16px 16px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
}

.form-control::placeholder {
  color: #999;
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}

.form-text {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}

.thumbnail-preview {
  margin-top: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  max-width: 300px;
  position: relative;
}

.thumbnail-preview img {
  width: 100%;
  height: auto;
  display: block;
}

.remove-thumbnail {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.remove-thumbnail:hover {
  background: rgba(220, 38, 38, 1);
}

.thumbnail-upload-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm:hover {
  background: #f3f4f6;
  border-color: #11998e;
  color: #11998e;
}

.uploading-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  color: #11998e;
  font-size: 0.875rem;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #11998e;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* New App Dialog */
.confirm-message {
  text-align: center;
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 2rem;
}

.new-app-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.option-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.option-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
}

.option-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.option-card h4 {
  margin: 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.option-card p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.image-quality-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f5f7fa;
  border-radius: 8px;
}

.image-quality-selector label {
  font-weight: 500;
  color: #333;
}

.image-quality-selector select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.portfolio-image-card {
  position: relative;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  background: #f9f9f9;
}

.portfolio-image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.portfolio-image-card.selected {
  border-color: #667eea;
  border-width: 3px;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.portfolio-image-card img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

.portfolio-image-card.selected .image-overlay {
  opacity: 1;
}

.check-icon {
  color: white;
  font-size: 2rem;
  font-weight: bold;
}

.image-info {
  padding: 0.5rem;
  background: white;
  text-align: center;
}

.image-info small {
  color: #666;
  font-size: 0.75rem;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e0e0e0;
  background: #f9f9f9;
}

.selection-info {
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.prompt-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.selected-images-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #e8f5e9;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #2e7d32;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.9rem;
  padding: 0;
}

.btn-link:hover {
  color: #764ba2;
}

/* App History Styles */
.app-list, .version-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.app-item, .version-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  transition: all 0.2s;
  cursor: pointer;
}

.app-item:hover, .version-item:hover {
  border-color: #667eea;
  background: #f0f4ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.version-item.current {
  border-color: #4caf50;
  background: #f1f8f4;
}

.app-info, .version-info {
  flex: 1;
}

.app-info h4, .version-info h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.app-prompt, .version-prompt {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.app-meta, .version-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-top: 0.75rem;
}

.date {
  color: #999;
  font-size: 0.85rem;
}

.current-badge {
  background: #4caf50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.version-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-actions, .version-actions {
  display: flex;
  gap: 0.5rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
}

.empty-state p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

/* Prompt Library Styles */
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prompt-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  transition: all 0.2s;
}

.prompt-item:hover {
  border-color: #667eea;
  background: #f0f4ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.prompt-info {
  flex: 1;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.prompt-info h4 {
  margin: 0;
  color: #333;
  font-size: 1.1rem;
}

.category-badge {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.prompt-description {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
  font-style: italic;
}

.prompt-text {
  color: #333;
  font-size: 0.85rem;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  margin: 0.75rem 0;
}

.prompt-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-top: 0.75rem;
}

.tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.use-count {
  color: #4caf50;
  font-size: 0.8rem;
  font-weight: 600;
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 1rem;
}

.btn-danger-small {
  background: #f44336;
  color: white;
  border: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger-small:hover {
  background: #d32f2f;
}

.btn-outline {
  background: transparent;
  border: 2px solid #667eea;
  color: #667eea;
  padding: 0.75rem 1.5rem;
  border-radius: 50px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-outline:hover {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
}

.prompt-preview {
  margin: 1rem 0;
}

.prompt-preview label {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  display: block;
}

.preview-text {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.9rem;
  color: #666;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
}

/* AI Suggestion Styles */
.input-with-ai {
  position: relative;
}

.input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.input-group .form-control {
  flex: 1;
}

.btn-ai-suggest {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-ai-suggest:hover:not(:disabled) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-ai-suggest:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.ai-suggest-all {
  margin: 1.5rem 0;
  text-align: center;
  padding: 1rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 12px;
  border: 2px dashed #667eea;
}

.btn-ai-suggest-all {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-ai-suggest-all:hover:not(:disabled) {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.btn-ai-suggest-all:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Responsive */
@media (max-width: 1024px) {
  .ai-builder {
    grid-template-columns: 1fr;
  }

  .portfolio-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 1rem;
  }

  .portfolio-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .modal-header {
    padding: 1rem;
  }

  .modal-body {
    padding: 1rem;
  }

  .modal-footer {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
}

/* Regenerate Model Section */
.regenerate-model-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%);
  border-radius: 12px;
  border: 2px solid #667eea;
}

.model-label-small {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.5rem;
}

.model-select-small {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s;
}

.model-select-small:hover {
  border-color: #667eea;
}

.model-select-small:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* API Library Styles */
.api-library-page {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.api-library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;
}

.api-library-header h2 {
  font-size: 2rem;
  font-weight: 800;
  color: #333;
  margin: 0 0 0.5rem 0;
}

.api-library-description {
  color: #666;
  font-size: 0.95rem;
  margin: 0.5rem 0 0 0;
  max-width: 600px;
}

.api-library-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.enabled-count {
  font-size: 1rem;
  font-weight: 600;
  color: #667eea;
  padding: 0.75rem 1.5rem;
  background: #f0f4ff;
  border-radius: 12px;
}

.btn-create-api {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.btn-create-api:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.api-category-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
  overflow-x: auto;
}

.category-tab {
  background: none;
  border: none;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  font-weight: 600;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.3s;
  white-space: nowrap;
}

.category-tab:hover {
  color: #667eea;
}

.category-tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.category-tab .count {
  display: inline-block;
  background: #e0e0e0;
  color: #666;
  padding: 0.2rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.category-tab.active .count {
  background: #667eea;
  color: white;
}

.api-cards-container {
  width: 100%;
}

.category-section {
  margin-bottom: 3rem;
}

.category-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #333;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e0e0e0;
}

.api-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.api-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.api-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.api-card.enabled {
  border-color: #667eea;
  background: #f0f4ff;
}

.api-card.always-on {
  border-color: #4caf50;
  background: #f1f8f4;
}

.api-card.always-on:hover {
  border-color: #4caf50;
}

.api-card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.api-icon {
  font-size: 2rem;
  line-height: 1;
}

.api-info {
  flex: 1;
}

.api-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #333;
}

.always-on-badge {
  display: inline-block;
  background: #4caf50;
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.coming-soon-badge {
  display: inline-block;
  background: #ff9800;
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.api-toggle {
  flex-shrink: 0;
}

.api-toggle input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.api-toggle input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.api-description {
  color: #666;
  font-size: 0.875rem;
  margin: 0.75rem 0;
  line-height: 1.5;
}

.api-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin: 0.75rem 0;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
}

.api-function {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: #667eea;
  font-weight: 600;
}

.api-rate-limit {
  font-size: 0.75rem;
  color: #999;
}

.api-details {
  margin-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
  padding-top: 0.75rem;
}

.api-details summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: #667eea;
  font-weight: 600;
  user-select: none;
}

.api-details summary:hover {
  color: #764ba2;
}

.api-details-content {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.api-details-content p {
  margin: 0.5rem 0;
  font-size: 0.85rem;
}

.api-details-content strong {
  color: #333;
}

.api-details-content code {
  display: block;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  color: #333;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.api-details-content pre {
  margin: 0.5rem 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.75rem;
  overflow-x: auto;
}

.api-details-content pre code {
  display: block;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.75rem;
}

.api-details-content a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.api-details-content a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .api-cards-grid {
    grid-template-columns: 1fr;
  }

  .api-library-page {
    padding: 1rem;
  }

  .api-library-header {
    flex-direction: column;
    gap: 1rem;
  }

  .api-library-stats {
    width: 100%;
    flex-direction: column;
  }

  .api-category-tabs {
    gap: 0.25rem;
  }

  .category-tab {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }
}

/* API Creator Styles */
.footer-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.btn-create-api {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-create-api:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
}

.api-creator-modal {
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.creator-description {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.creator-description.success {
  background: #f1f8f4;
  border-left-color: #4caf50;
  color: #2e7d32;
}

.creator-examples {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.creator-examples strong {
  color: #856404;
  display: block;
  margin-bottom: 0.5rem;
}

.creator-examples ul {
  margin: 0.5rem 0 0 1.5rem;
  color: #856404;
}

.creator-examples ol {
  margin: 0.5rem 0 0 1.5rem;
  color: #856404;
}

.creator-examples li {
  margin: 0.25rem 0;
  font-size: 0.9rem;
}

.creator-examples code {
  background: #fff;
  border: 1px solid #ffc107;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.input-field {
  margin-bottom: 1.5rem;
}

.input-field label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.endpoint-input {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid #667eea;
  border-radius: 8px;
  font-size: 1rem;
  font-family: 'Courier New', monospace;
  transition: all 0.3s;
  background: #f0f4ff;
}

.endpoint-input:focus {
  outline: none;
  border-color: #764ba2;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  background: white;
}

.endpoint-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.input-hint {
  display: block;
  margin-top: 0.5rem;
  color: #999;
  font-size: 0.85rem;
  font-style: italic;
}

.api-creator-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  transition: all 0.3s;
}

.api-creator-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.api-creator-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.creator-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
}

.btn-generate-api {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.875rem 1.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s;
  flex: 1;
}

.btn-generate-api:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-generate-api:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-save-api {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
  border: none;
  padding: 0.875rem 1.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s;
}

.btn-save-api:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
}

.btn-save-api:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.generated-api-preview {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.preview-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.preview-icon {
  font-size: 3rem;
  line-height: 1;
}

.preview-header h4 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.preview-category {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.preview-description {
  color: #666;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
}

.preview-field {
  margin-bottom: 1.25rem;
}

.preview-field label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.field-input,
.field-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  transition: all 0.3s;
}

.field-input:focus,
.field-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field-textarea {
  resize: vertical;
  min-height: 100px;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-field label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  cursor: pointer;
}

.checkbox-field input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Smart Change Test Styles */
.btn-test {
  padding: 0.75rem 1.25rem;
  border: 2px solid #8b5cf6;
  background: white;
  color: #8b5cf6;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-test:hover:not(:disabled) {
  background: #8b5cf6;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-large {
  max-width: 800px;
  width: 90vw;
}

.test-result-success,
.test-result-error {
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.test-result-success {
  background: #f0fdf4;
  border: 2px solid #22c55e;
}

.test-result-error {
  background: #fef2f2;
  border: 2px solid #ef4444;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.analysis-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.analysis-item strong {
  color: #666;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-success {
  background: #22c55e;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.badge-warning {
  background: #f59e0b;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.badge-info {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.badge-high {
  background: #22c55e;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.badge-medium {
  background: #f59e0b;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.badge-low {
  background: #ef4444;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  display: inline-block;
}

.analysis-section {
  margin: 1.5rem 0;
}

.analysis-section h5 {
  color: #333;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.analysis-section p {
  color: #666;
  line-height: 1.6;
}

.analysis-section pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
}

.raw-response {
  margin-top: 1.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem;
}

.raw-response summary {
  cursor: pointer;
  font-weight: 600;
  color: #666;
  user-select: none;
}

.raw-response summary:hover {
  color: #333;
}

.raw-response pre {
  margin-top: 1rem;
  background: #f9fafb;
  color: #333;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .api-creator-modal {
    max-width: 95vw;
  }

  .creator-actions {
    flex-direction: column;
  }

  .btn-generate-api {
    width: 100%;
  }

  .modal-large {
    max-width: 95vw;
  }

  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>

