<template>
  <div class="gnew-viewer">
    <!-- Ultra-Clean Interface for Non-Logged Users -->
    <div v-if="!userStore.loggedIn" class="public-viewer">
      <!-- Graph Content -->
      <div v-if="loading" class="loading-state">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Loading graph data...</p>
      </div>

      <div v-else-if="error" class="alert alert-danger">
        <h5>❌ Error</h5>
        <p>{{ error }}</p>
      </div>

      <div v-else-if="graphData.nodes.length > 0" class="graph-content">
        <div class="nodes-container">
          <GNewNodeRenderer
            v-for="node in sortedNodes"
            :key="node.id"
            :node="node"
            :graphData="graphData"
            :showControls="false"
            :graphId="currentGraphId"
            @node-updated="handleNodeUpdated"
            @node-deleted="handleNodeDeleted"
            @node-created="handleNodeCreated"
          />
        </div>

        <!-- Graph-Level Social Stats (Public View) -->
        <div class="graph-social-public">
          <SocialInteractionBar
            :graph-id="currentGraphId"
            :show-stats="true"
            :graph-data="graphData"
            :graph-metadata="graphMetadata"
          />
        </div>
      </div>

      <div v-else class="empty-state">
        <h4>📊 No Graph Data Available</h4>
        <p class="text-muted">No content to display at this time.</p>
      </div>
    </div>

    <!-- Mobile Menu Overlay -->
    <div
      v-if="
        showMobileMenu &&
        userStore.loggedIn &&
        (userStore.role === 'Superadmin' || userStore.role === 'Admin')
      "
      class="mobile-menu-overlay"
      :class="{ show: showMobileMenu }"
      @click="closeMobileMenu"
    >
      <div class="mobile-menu-content" @click.stop>
        <div class="mobile-menu-header">
          <h5>Menu</h5>
          <button class="btn-close" @click="closeMobileMenu" aria-label="Close"></button>
        </div>

        <!-- Template Search (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Template Search</h6>
          <div class="search-input-container">
            <input
              v-model="mobileSearchQuery"
              type="text"
              placeholder="Search templates..."
              class="form-control mb-2"
            />
            <span class="search-icon">🔍</span>
          </div>
          <div v-if="mobileSearchQuery" class="search-results-info">
            {{ filteredMobileTemplates.length }} result{{
              filteredMobileTemplates.length !== 1 ? 's' : ''
            }}
          </div>
        </div>

        <!-- Action Buttons (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Actions</h6>
          <button @click="loadGraphAndClose" class="btn btn-primary w-100 mb-2" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            {{ loading ? 'Loading...' : 'Load Graph' }}
          </button>
          <button @click="refreshDataAndClose" class="btn btn-outline-secondary w-100 mb-2">
            🔄 Refresh
          </button>
          <button
            v-if="userStore.loggedIn"
            @click="navigateToProfessionalFeedAndClose"
            class="btn btn-outline-primary w-100 mb-2"
          >
            📊 Professional Feed
          </button>
          <button
            v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
            @click="duplicateGraphAndClose"
            class="btn btn-outline-info w-100 mb-2"
            :disabled="!graphData.nodes.length || duplicatingGraph"
          >
            <span v-if="duplicatingGraph" class="spinner-border spinner-border-sm me-2"></span>
            {{ duplicatingGraph ? 'Duplicating...' : '📋 Duplicate Graph' }}
          </button>
          <button
            v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
            @click="openImageQuoteAndClose"
            class="btn btn-success w-100 mb-2"
          >
            🎨 Create IMAGEQUOTE
          </button>
          <button
            @click="openShareAndClose"
            class="btn btn-outline-success w-100 mb-2"
            :disabled="!graphData.nodes.length"
          >
            <i class="bi bi-share"></i> Share
          </button>
        </div>

        <!-- Template Categories (Mobile) -->
        <div class="mobile-menu-section">
          <h6>Templates</h6>
          <div v-if="mobileSearchQuery" class="mobile-search-results">
            <div
              v-for="template in filteredMobileTemplates"
              :key="template.id"
              class="mobile-template-item"
              @click="addTemplateAndClose(template)"
            >
              <span class="template-icon">{{ template.icon }}</span>
              <div class="template-info">
                <div class="template-label">{{ template.label }}</div>
                <div class="template-category-tag">{{ template.category }}</div>
                <div class="template-description">{{ template.description }}</div>
              </div>
              <span class="template-add-btn">+</span>
            </div>
          </div>
          <div v-else class="mobile-categories-view">
            <div
              v-for="category in mobileTemplateCategories"
              :key="category"
              class="mobile-category-section"
            >
              <div class="mobile-category-header" @click="toggleMobileCategory(category)">
                <span class="category-icon">{{ getCategoryIcon(category) }}</span>
                <span class="category-name">{{ category }}</span>
                <span class="category-toggle">
                  {{ mobileExpandedCategories.includes(category) ? '▼' : '▶' }}
                </span>
              </div>
              <div
                v-if="mobileExpandedCategories.includes(category)"
                class="mobile-category-templates"
              >
                <div
                  v-for="template in getTemplatesByCategory(category)"
                  :key="template.id"
                  class="mobile-template-item"
                  @click="addTemplateAndClose(template)"
                >
                  <span class="template-icon">{{ template.icon }}</span>
                  <div class="template-info">
                    <div class="template-label">{{ template.label }}</div>
                    <div class="template-description">{{ template.description }}</div>
                  </div>
                  <span class="template-add-btn">+</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Full Interface for Logged Users -->
    <div v-if="userStore.loggedIn" class="admin-viewer">
      <!-- Header with Hamburger Menu -->
      <div class="gnew-header">
        <HamburgerMenu
          v-if="userStore.role === 'Superadmin' || userStore.role === 'Admin'"
          :isOpen="showMobileMenu"
          @toggle="toggleMobileMenu"
          @menu-item-clicked="handleMenuItemClick"
        />
        <h1 class="header-title">🧪 GNew Graph Viewer</h1>
      </div>

      <!-- Main Content -->
      <div class="gnew-content">
        <!-- Graph Status Bar -->
        <GraphStatusBar
          :graphData="graphData"
          :loading="loading"
          :error="error"
          :currentGraph="{
            id: currentGraphId,
            title: graphTitle,
            category: graphCategories.join(','),
            metaArea: graphMetaAreas.join(','),
            createdBy: graphCreatedBy,
          }"
        />

        <!-- Status Message -->
        <div v-if="statusMessage" class="status-message">
          {{ statusMessage }}
        </div>

        <!-- Template Access Info -->
        <div v-if="userStore.loggedIn && userStore.role === 'Superadmin'" class="template-info">
          <p class="small text-muted">
            <i class="bi bi-info-circle"></i> Use the template sidebar on the left to add templates
            to your graph
          </p>
        </div>

        <!-- Desktop Action Toolbar (hidden on mobile) -->
        <div class="action-toolbar d-none d-md-flex">
          <button @click="loadGraph" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
            {{ loading ? 'Loading...' : 'Load Graph' }}
          </button>
          <button @click="refreshData" class="btn btn-outline-secondary">🔄 Refresh</button>
          <button
            v-if="userStore.loggedIn"
            @click="navigateToProfessionalFeed"
            class="btn btn-outline-primary"
          >
            📊 Professional Feed
          </button>
          <button
            v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
            @click="duplicateKnowledgeGraph"
            class="btn btn-outline-info"
            :disabled="!graphData.nodes.length || duplicatingGraph"
          >
            <span v-if="duplicatingGraph" class="spinner-border spinner-border-sm me-2"></span>
            {{ duplicatingGraph ? 'Duplicating...' : '📋 Duplicate Graph' }}
          </button>
          <button
            v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
            @click="openImageQuoteCreator"
            class="btn btn-success"
          >
            🎨 Create IMAGEQUOTE
          </button>
          <button
            @click="openShareModal"
            class="btn btn-outline-success"
            :disabled="!graphData.nodes.length"
          >
            <i class="bi bi-share"></i> Share
          </button>
        </div>

        <!-- Node Edit Modal (Admin Only) -->
        <div
          v-if="showNodeEditModal && userStore.loggedIn && userStore.role === 'Superadmin'"
          class="modal-overlay"
        >
          <div class="node-edit-modal">
            <div class="modal-header">
              <h4>✏️ Edit Node Content</h4>
              <button @click="closeNodeEditModal" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Node Title:</label>
                <input
                  v-model="editingNode.label"
                  type="text"
                  class="form-control"
                  placeholder="Enter node title..."
                />
              </div>

              <div class="form-group">
                <label class="form-label">Node Content:</label>
                <div class="textarea-container">
                  <textarea
                    ref="nodeContentTextarea"
                    v-model="editingNode.info"
                    class="form-control node-content-textarea"
                    rows="20"
                    placeholder="Enter node content... Type [ to see available elements..."
                    @input="handleTextareaInput"
                    @keydown="handleTextareaKeydown"
                    @blur="hideAutocomplete"
                  ></textarea>

                  <!-- Autocomplete Dropdown -->
                  <div
                    v-if="showAutocomplete && filteredElements.length > 0"
                    class="autocomplete-dropdown"
                    :style="{
                      top: autocompletePosition.top + 'px',
                      left: autocompletePosition.left + 'px',
                    }"
                  >
                    <div class="autocomplete-header">
                      <span class="autocomplete-title"
                        >✨ Formatted Elements ({{ filteredElements.length }})</span
                      >
                      <span class="autocomplete-hint">Press Tab or Enter to insert</span>
                    </div>
                    <div
                      v-for="(element, index) in filteredElements"
                      :key="element.trigger"
                      class="autocomplete-item"
                      :class="{ 'autocomplete-item-active': index === selectedElementIndex }"
                      @mouseenter="selectedElementIndex = index"
                      @click="insertElement(element)"
                    >
                      <div class="element-trigger">{{ element.trigger }}</div>
                      <div class="element-description">{{ element.description }}</div>
                      <div class="element-category">{{ element.category }}</div>
                    </div>
                  </div>
                </div>
                <small class="form-text text-muted">
                  Type <code>[</code> or <code>![</code> to see available formatted elements with
                  autocomplete. Enhanced image positioning: <code>![Leftside-Small</code>,
                  <code>![Rightside-Large</code>, <code>![Leftside-Circle</code>, etc. <br /><strong
                    >Tip:</strong
                  >
                  Type <code>![Left</code> or <code>![Right</code> to see all image positioning
                  variants.
                </small>
              </div>

              <!-- Color Picker Section -->
              <div class="form-group">
                <label class="form-label">🎨 Color Picker:</label>
                <div class="color-picker-container">
                  <div class="color-picker-row">
                    <input
                      type="color"
                      v-model="selectedColor"
                      class="color-picker-input"
                      @input="updateSelectedColor"
                      title="Pick a custom color"
                    />
                    <span class="color-hex-display">{{ selectedColor }}</span>
                    <button
                      @click="insertColorAtCursor"
                      class="btn btn-sm btn-outline-primary"
                      type="button"
                      title="Insert color at cursor position"
                    >
                      Insert Color
                    </button>
                  </div>

                  <!-- Quick Color Palette -->
                  <div class="quick-colors">
                    <span class="quick-colors-label">Quick Colors:</span>
                    <button
                      v-for="color in quickColors"
                      :key="color.hex"
                      @click="selectQuickColor(color.hex)"
                      class="quick-color-btn"
                      :style="{ backgroundColor: color.hex }"
                      :title="color.name"
                      type="button"
                    ></button>
                  </div>

                  <!-- Expand Palette Button -->
                  <div class="palette-toggle">
                    <button
                      @click="showExpandedPalette = !showExpandedPalette"
                      class="btn btn-sm btn-outline-secondary"
                      type="button"
                    >
                      <i
                        :class="showExpandedPalette ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"
                      ></i>
                      {{ showExpandedPalette ? 'Hide' : 'Show' }} Full Color Wheel
                    </button>
                  </div>

                  <!-- Expanded Color Categories (Color Wheel Style) -->
                  <div v-if="showExpandedPalette" class="expanded-colors">
                    <div
                      v-for="category in colorCategories"
                      :key="category.name"
                      class="color-category"
                    >
                      <h6 class="category-title">{{ category.name }}</h6>
                      <div class="color-category-grid">
                        <button
                          v-for="color in category.colors"
                          :key="color.hex"
                          @click="selectQuickColor(color.hex)"
                          class="category-color-btn"
                          :style="{ backgroundColor: color.hex }"
                          :title="color.name + ' (' + color.hex + ')'"
                          type="button"
                        ></button>
                      </div>
                    </div>
                  </div>
                </div>
                <small class="form-text text-muted">
                  Select a color and click "Insert Color" to add it at your cursor position
                </small>
              </div>

              <!-- Image Insert Section -->
              <div class="form-group">
                <label class="form-label">📷 Insert Image:</label>
                <div class="image-insert-container">
                  <button
                    @click="insertImageAtCursor"
                    class="btn btn-outline-primary"
                    type="button"
                    title="Insert image markdown at cursor position"
                  >
                    📷 Insert Image
                  </button>
                  <small class="form-text text-muted">
                    Inserts image markdown template: <code>![Alt Text](Image URL)</code>
                  </small>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="saveNodeChanges" class="btn btn-primary" :disabled="savingNode">
                <span v-if="savingNode" class="spinner-border spinner-border-sm me-2"></span>
                {{ savingNode ? 'Saving...' : 'Save Changes' }}
              </button>
              <button @click="closeNodeEditModal" class="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>

        <!-- IMAGEQUOTE Creator Modal (Admin Only) -->
        <div
          v-if="showImageQuoteCreator && userStore.loggedIn && userStore.role === 'Superadmin'"
          class="modal-overlay"
        >
          <div class="imagequote-creator-modal">
            <div class="modal-header">
              <h4>🎨 Create IMAGEQUOTE</h4>
              <button @click="closeImageQuoteCreator" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Quote Text:</label>
                <div class="quote-input-section">
                  <textarea
                    v-model="newImageQuote.text"
                    class="form-control"
                    rows="3"
                    placeholder="Enter your quote text here..."
                  ></textarea>
                  <div class="quote-actions">
                    <button
                      @click="generateQuoteSuggestions"
                      class="btn btn-outline-primary btn-sm"
                      :disabled="isGeneratingQuotes || !hasGraphContext"
                    >
                      <span
                        v-if="isGeneratingQuotes"
                        class="spinner-border spinner-border-sm me-1"
                      ></span>
                      {{ isGeneratingQuotes ? 'Generating...' : '💡 Suggest Quotes' }}
                    </button>
                    <small v-if="!hasGraphContext" class="text-muted">
                      (Requires graph content for suggestions)
                    </small>
                  </div>
                </div>

                <!-- Quote Suggestions -->
                <div v-if="quoteSuggestions.length > 0" class="quote-suggestions">
                  <h6>💡 Suggested Quotes:</h6>
                  <div class="suggestions-list">
                    <div
                      v-for="(suggestion, index) in quoteSuggestions"
                      :key="index"
                      class="suggestion-item"
                      @click="applySuggestion(suggestion)"
                    >
                      <div class="suggestion-text">{{ suggestion.text }}</div>
                      <div v-if="suggestion.citation" class="suggestion-citation">
                        — {{ suggestion.citation }}
                      </div>
                      <div class="suggestion-source">
                        <small class="text-muted">From: {{ suggestion.source }}</small>
                      </div>
                    </div>
                  </div>
                  <button @click="clearSuggestions" class="btn btn-sm btn-outline-secondary mt-2">
                    Clear Suggestions
                  </button>
                </div>

                <!-- Error Message -->
                <div v-if="quoteSuggestionsError" class="alert alert-danger mt-2">
                  <strong>❌ Error:</strong> {{ quoteSuggestionsError }}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Background Image:</label>
                <div class="image-selection-area">
                  <!-- Current Image Preview -->
                  <div v-if="newImageQuote.backgroundImage" class="current-image-preview">
                    <img :src="newImageQuote.backgroundImage" alt="Background preview" />
                    <div class="image-actions">
                      <button @click="clearCreatorImage" class="btn btn-sm btn-outline-danger">
                        🗑️ Remove
                      </button>
                    </div>
                  </div>

                  <!-- Image Selection Methods -->
                  <div class="image-source-section">
                    <div class="image-source-options">
                      <button
                        @click="triggerCreatorImageUpload"
                        class="btn btn-outline-primary btn-source"
                        :disabled="isUploadingCreatorImage"
                      >
                        <i
                          class="bi"
                          :class="isUploadingCreatorImage ? 'bi-hourglass-split' : 'bi-upload'"
                        ></i>
                        {{ isUploadingCreatorImage ? 'Uploading...' : 'Upload Image' }}
                      </button>

                      <button
                        @click="openCreatorAIImageModal"
                        class="btn btn-outline-success btn-source"
                        :disabled="isUploadingCreatorImage"
                      >
                        <i class="bi bi-magic"></i>
                        AI Generate
                      </button>

                      <button
                        @click="showCreatorUrlInput = !showCreatorUrlInput"
                        class="btn btn-outline-info btn-source"
                        :class="{ active: showCreatorUrlInput }"
                      >
                        <i class="bi bi-link-45deg"></i>
                        Image URL
                      </button>

                      <button
                        @click="openPortfolioImageModal"
                        class="btn btn-outline-warning btn-source"
                        :disabled="isUploadingCreatorImage"
                      >
                        <i class="bi bi-collection"></i>
                        Portfolio Images
                      </button>
                    </div>

                    <!-- Hidden file input -->
                    <input
                      ref="creatorImageFileInput"
                      type="file"
                      accept="image/*"
                      style="display: none"
                      @change="handleCreatorImageUpload"
                    />

                    <!-- URL Input Section -->
                    <div v-if="showCreatorUrlInput" class="url-input-section">
                      <div class="form-group">
                        <label class="form-label">Image URL:</label>
                        <div class="url-input-group">
                          <input
                            v-model="creatorImageUrl"
                            type="url"
                            class="form-control"
                            placeholder="https://example.com/image.jpg"
                            @paste="handleCreatorUrlPaste"
                            @input="validateCreatorImageUrl"
                          />
                          <button
                            @click="useCreatorImageUrl"
                            :disabled="!isCreatorValidUrl || isLoadingCreatorUrl"
                            class="btn btn-primary"
                          >
                            {{ isLoadingCreatorUrl ? 'Loading...' : 'Use URL' }}
                          </button>
                        </div>
                      </div>

                      <!-- URL Preview -->
                      <div v-if="creatorUrlPreviewImage" class="url-preview">
                        <img :src="creatorUrlPreviewImage" alt="URL preview" />
                        <button @click="applyCreatorUrlImage" class="btn btn-success btn-sm">
                          ✅ Use This Image
                        </button>
                      </div>
                    </div>

                    <!-- Clipboard Paste Area -->
                    <div
                      v-if="
                        !creatorPastedImage &&
                        !showCreatorUrlInput &&
                        !newImageQuote.backgroundImage
                      "
                      class="clipboard-paste-area"
                    >
                      <div class="paste-info">
                        <span class="paste-icon">📋</span>
                        <span class="paste-text">Or paste an image from clipboard (Ctrl+V)</span>
                      </div>
                    </div>

                    <!-- Pasted Image Preview -->
                    <div v-if="creatorPastedImage" class="pasted-image-preview">
                      <h5>📋 Pasted Image</h5>
                      <div class="pasted-preview-container">
                        <img :src="creatorPastedImage.url" alt="Pasted image" />
                        <div class="pasted-actions">
                          <button @click="useCreatorPastedImage" class="btn btn-primary btn-sm">
                            Use This Image
                          </button>
                          <button @click="clearCreatorPastedImage" class="btn btn-secondary btn-sm">
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Error Display -->
                    <div v-if="creatorImageError" class="alert alert-danger mt-3">
                      <strong>❌ Error:</strong> {{ creatorImageError }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Aspect Ratio:</label>
                    <select v-model="newImageQuote.aspectRatio" class="form-control">
                      <option value="16/9">16:9 (Widescreen)</option>
                      <option value="1/1">1:1 (Square)</option>
                      <option value="4/3">4:3 (Standard)</option>
                      <option value="9/16">9:16 (Portrait)</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Text Alignment:</label>
                    <select v-model="newImageQuote.textAlign" class="form-control">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Padding:</label>
                    <select v-model="newImageQuote.padding" class="form-control">
                      <option value="1em">Small (1em)</option>
                      <option value="2em">Medium (2em)</option>
                      <option value="3em">Large (3em)</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Font Size:</label>
                    <select v-model="newImageQuote.fontSize" class="form-control">
                      <option value="1rem">Small (1rem)</option>
                      <option value="1.5rem">Medium (1.5rem)</option>
                      <option value="2rem">Large (2rem)</option>
                      <option value="2.5rem">Extra Large (2.5rem)</option>
                      <option value="3rem">Huge (3rem)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Width:</label>
                    <select v-model="newImageQuote.width" class="form-control">
                      <option value="100%">Full Width (100%)</option>
                      <option value="90%">90%</option>
                      <option value="80%">80%</option>
                      <option value="75%">75%</option>
                      <option value="66%">Two-thirds (66%)</option>
                      <option value="50%">Half Width (50%)</option>
                      <option value="33%">One-third (33%)</option>
                      <option value="25%">Quarter (25%)</option>
                    </select>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label class="form-label">Height:</label>
                    <select v-model="newImageQuote.height" class="form-control">
                      <option value="auto">Auto (Aspect Ratio)</option>
                      <option value="200px">Small (200px)</option>
                      <option value="300px">Medium (300px)</option>
                      <option value="400px">Large (400px)</option>
                      <option value="500px">Extra Large (500px)</option>
                      <option value="20vh">20% of viewport</option>
                      <option value="30vh">30% of viewport</option>
                      <option value="40vh">40% of viewport</option>
                      <option value="50vh">50% of viewport</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label class="form-label">Citation (optional):</label>
                    <input
                      v-model="newImageQuote.citation"
                      type="text"
                      class="form-control"
                      placeholder="Author name"
                    />
                  </div>
                </div>
              </div>

              <!-- IMAGEQUOTE Type Selection -->
              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label class="form-label">IMAGEQUOTE Type:</label>
                    <div class="imagequote-type-selection">
                      <label class="form-check">
                        <input
                          v-model="imageQuoteType"
                          type="radio"
                          value="static"
                          class="form-check-input"
                        />
                        <span class="form-check-label">
                          <strong>📄 Static Content</strong><br />
                          <small class="text-muted"
                            >Insert as formatted content within existing node text</small
                          >
                        </span>
                      </label>
                      <label class="form-check">
                        <input
                          v-model="imageQuoteType"
                          type="radio"
                          value="standalone"
                          class="form-check-input"
                        />
                        <span class="form-check-label">
                          <strong>🎨 Standalone Node</strong><br />
                          <small class="text-muted"
                            >Create dedicated IMAGEQUOTE node with full export functionality</small
                          >
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Node Selection for Static Insertion -->
              <div v-if="imageQuoteType === 'static'" class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label class="form-label">Insert into Node:</label>
                    <select v-model="selectedNodeForInsertion" class="form-control" required>
                      <option value="">Select a node to insert IMAGEQUOTE into...</option>
                      <option value="__CREATE_NEW__">🆕 Insert into a new Fulltext node</option>
                      <option
                        v-for="node in availableNodesForInsertion"
                        :key="node.id"
                        :value="node.id"
                      >
                        {{ node.label }} ({{ node.type }})
                      </option>
                    </select>
                    <small class="form-text text-muted">
                      IMAGEQUOTE will be inserted into the selected node's content and saved to the
                      graph.
                    </small>
                  </div>
                </div>
              </div>

              <!-- Live Preview -->
              <div v-if="newImageQuote.text" class="preview-section">
                <h5>Preview:</h5>
                <GNewImageQuote
                  :quote-text="newImageQuote.text"
                  :background-image="newImageQuote.backgroundImage"
                  :aspect-ratio="newImageQuote.aspectRatio"
                  :text-align="newImageQuote.textAlign"
                  :padding="newImageQuote.padding"
                  :font-size="newImageQuote.fontSize"
                  :width="newImageQuote.width"
                  :height="newImageQuote.height"
                  :citation="newImageQuote.citation"
                  :show-controls="false"
                />

                <!-- Formatted Definition -->
                <div class="formatted-definition-section">
                  <label class="form-label">IMAGEQUOTE Definition:</label>
                  <textarea
                    v-model="formattedDefinition"
                    class="form-control formatted-definition-textarea"
                    rows="3"
                    placeholder="Formatted IMAGEQUOTE definition will appear here..."
                    @input="parseFormattedDefinition"
                  ></textarea>
                  <small class="form-text text-muted">
                    Editable format for use in other parts of the system. Changes here will update
                    the preview above.
                  </small>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button
                @click="saveImageQuote"
                class="btn btn-primary"
                :disabled="imageQuoteType === 'static' && !selectedNodeForInsertion"
              >
                {{
                  imageQuoteType === 'standalone'
                    ? 'Create IMAGEQUOTE Node'
                    : 'Insert IMAGEQUOTE into Node'
                }}
              </button>
              <button @click="closeImageQuoteCreator" class="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>

        <!-- AI Image Modal (only for AI generation) -->
        <AIImageModal
          :isOpen="isCreatorAIImageModalOpen"
          :graphContext="{ type: 'imagequote-background' }"
          @close="closeCreatorAIImageModal"
          @image-inserted="handleCreatorAIImageGenerated"
        />

        <!-- Portfolio Image Selection Modal -->
        <div v-if="showPortfolioImageModal" class="modal-overlay">
          <div class="portfolio-image-modal">
            <div class="modal-header">
              <h4>🎨 Select Portfolio Image</h4>
              <button @click="closePortfolioImageModal" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <!-- Quality Controls Section -->
              <div class="quality-controls mb-4 p-3 border rounded">
                <h6 class="mb-3">Image Quality & Size Settings</h6>

                <!-- Quality Presets -->
                <div class="mb-3">
                  <label class="form-label fw-bold">Quality Preset:</label>
                  <div class="btn-group w-100" role="group">
                    <input
                      type="radio"
                      class="btn-check"
                      name="qualityPreset"
                      id="ultraFast"
                      value="ultraFast"
                      v-model="imageQualitySettings.preset"
                      @change="updateImagePreview"
                    />
                    <label class="btn btn-outline-success" for="ultraFast">
                      <i class="bi bi-lightning-fill"></i> Ultra Fast
                    </label>

                    <input
                      type="radio"
                      class="btn-check"
                      name="qualityPreset"
                      id="balanced"
                      value="balanced"
                      v-model="imageQualitySettings.preset"
                      @change="updateImagePreview"
                    />
                    <label class="btn btn-outline-primary" for="balanced">
                      <i class="bi bi-speedometer2"></i> Balanced
                    </label>

                    <input
                      type="radio"
                      class="btn-check"
                      name="qualityPreset"
                      id="highQuality"
                      value="highQuality"
                      v-model="imageQualitySettings.preset"
                      @change="updateImagePreview"
                    />
                    <label class="btn btn-outline-warning" for="highQuality">
                      <i class="bi bi-gem"></i> High Quality
                    </label>
                  </div>
                </div>

                <!-- Custom Size Controls -->
                <div class="row mb-3">
                  <div class="col-12 mb-2">
                    <div class="form-check">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="lockAspectRatio"
                        v-model="imageQualitySettings.lockAspectRatio"
                      />
                      <label class="form-check-label fw-bold" for="lockAspectRatio">
                        <i class="bi bi-lock-fill" v-if="imageQualitySettings.lockAspectRatio"></i>
                        <i class="bi bi-unlock-fill" v-else></i>
                        Lock Aspect Ratio ({{ aspectRatio }})
                      </label>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-bold">Width:</label>
                    <div class="input-group">
                      <input
                        type="range"
                        class="form-range"
                        min="50"
                        max="800"
                        v-model="imageQualitySettings.width"
                        @input="onWidthChange"
                      />
                      <input
                        type="number"
                        class="form-control"
                        style="max-width: 80px"
                        v-model="imageQualitySettings.width"
                        @input="onWidthChange"
                        min="50"
                        max="800"
                      />
                      <span class="input-group-text">px</span>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label fw-bold">Height:</label>
                    <div class="input-group">
                      <input
                        type="range"
                        class="form-range"
                        min="50"
                        max="600"
                        v-model="imageQualitySettings.height"
                        @input="onHeightChange"
                      />
                      <input
                        type="number"
                        class="form-control"
                        style="max-width: 80px"
                        v-model="imageQualitySettings.height"
                        @input="onHeightChange"
                        min="50"
                        max="600"
                      />
                      <span class="input-group-text">px</span>
                    </div>
                  </div>
                </div>

                <!-- Reset Button -->
                <div class="text-center">
                  <button @click="resetQualitySettings" class="btn btn-outline-secondary btn-sm">
                    <i class="bi bi-arrow-clockwise"></i> Reset to Defaults
                  </button>
                </div>
              </div>

              <!-- Portfolio Images Grid -->
              <div v-if="portfolioImages.length > 0">
                <div class="portfolio-grid">
                  <div
                    v-for="img in portfolioImages"
                    :key="img.key"
                    class="portfolio-card"
                    @click="selectPortfolioImage(img)"
                  >
                    <img
                      :src="getOptimizedImageUrl(img.url)"
                      :alt="img.key"
                      class="portfolio-thumb"
                      loading="lazy"
                    />
                    <div class="portfolio-caption">{{ img.key }}</div>
                  </div>
                </div>
              </div>

              <!-- Loading State -->
              <div v-else-if="loadingPortfolioImages" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading portfolio images...</span>
                </div>
                <p class="mt-2">Loading portfolio images...</p>
              </div>

              <!-- Error State -->
              <div v-else class="text-center py-4">
                <p class="text-muted">No portfolio images found.</p>
              </div>
            </div>

            <div class="modal-footer">
              <div class="me-auto">
                <small class="text-muted">
                  <strong>{{ portfolioImages.length }}</strong> images • Quality:
                  <strong>{{ imageQualitySettings.preset }}</strong> • Size:
                  <strong
                    >{{ imageQualitySettings.width }}×{{ imageQualitySettings.height }}</strong
                  >
                </small>
              </div>
              <button @click="closePortfolioImageModal" class="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>

        <!-- Reorder Modal (Admin Only) -->
        <div
          v-if="isReorderModalOpen && userStore.loggedIn && userStore.role === 'Superadmin'"
          class="modal-overlay"
          @click.self="closeReorderModal"
        >
          <div class="reorder-modal">
            <div class="modal-header">
              <h4>🔄 Reorder Nodes</h4>
              <button @click="closeReorderModal" class="btn-close">&times;</button>
            </div>

            <div class="modal-body">
              <div class="reorder-instructions">
                <p class="small text-muted">
                  <i class="bi bi-info-circle"></i>
                  Drag and drop nodes to reorder them, or use the position input fields.
                </p>
              </div>

              <div class="reorder-list">
                <div
                  v-for="node in reorderableNodes"
                  :key="node.id"
                  class="reorder-item"
                  draggable="true"
                  @dragstart="onDragStart($event, node.id)"
                  @dragend="onDragEnd"
                  @drop="onDrop($event, node.id)"
                  @dragover="onDragOver"
                >
                  <div class="node-info">
                    <span class="node-icon">{{ getNodeTypeIcon(node.type) }}</span>
                    <span class="node-name">{{ getNodeDisplayName(node) }}</span>
                    <span class="node-type text-muted">({{ node.type }})</span>
                  </div>

                  <div class="position-controls">
                    <label class="position-label">Position:</label>
                    <input
                      type="number"
                      :value="getNodePosition(node)"
                      @input="updateNodePosition(node.id, parseInt($event.target.value))"
                      min="1"
                      :max="reorderableNodes.length"
                      class="position-input"
                    />
                    <span class="position-total">/ {{ reorderableNodes.length }}</span>
                  </div>

                  <div class="drag-handle">
                    <i class="bi bi-grip-vertical"></i>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button @click="resetOrder" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-clockwise"></i> Reset
              </button>
              <button @click="closeReorderModal" class="btn btn-secondary">Cancel</button>
              <button @click="saveNodeOrder" class="btn btn-primary">
                <i class="bi bi-check-lg"></i> Save Order
              </button>
            </div>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="alert alert-danger">
          <h5>❌ Error</h5>
          <p>{{ error }}</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p>Loading graph data...</p>
        </div>

        <!-- Graph Content -->
        <div v-else-if="graphData.nodes.length > 0" class="graph-content">
          <h3>🔗 Graph Nodes</h3>
          <div class="nodes-container">
            <GNewNodeRenderer
              v-for="node in sortedNodes"
              :key="node.id"
              :node="node"
              :graphData="graphData"
              :showControls="userStore.loggedIn && userStore.role === 'Superadmin'"
              @node-updated="handleNodeUpdated"
              @node-deleted="handleNodeDeleted"
              @node-created="handleNodeCreated"
              @move-up="moveNodeUp"
              @move-down="moveNodeDown"
              @open-reorder="openReorderModal"
              @format-node="handleFormatNode"
              @quick-format="handleQuickFormat"
              @copy-node="handleCopyNode"
            />

            <!-- Real-time Professional Discussion -->
            <div v-if="graphData.nodes.length > 0" class="graph-chat-section">
              <GraphChatPanel :graph-id="currentGraphId" :graph-data="graphData" />
            </div>
          </div>

          <!-- Graph-Level Social Features -->
          <div v-if="userStore.loggedIn" class="graph-social-section">
            <SocialInteractionBar
              :graph-id="currentGraphId"
              :show-stats="true"
              :graph-data="graphData"
              :graph-metadata="graphMetadata"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <h4>📊 No Graph Data</h4>
          <p>Load a graph to begin using the GNew Viewer.</p>
          <p class="text-muted">
            This viewer uses the same data as the current GraphViewer but with a modern, clean
            architecture for new features.
          </p>
        </div>

        <!-- IMAGEQUOTE Instructions (Admin Only) -->
        <div
          v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
          class="imagequote-instructions"
        >
          <h3>🎨 IMAGEQUOTE Creation</h3>
          <p>
            IMAGEQUOTE elements are inserted directly into graph nodes and rendered within the
            content. Use the "Create IMAGEQUOTE" button above to generate a new IMAGEQUOTE and
            insert it into a selected node.
          </p>
          <p class="text-muted">
            Once inserted, IMAGEQUOTE elements will appear in the node content and be rendered by
            the GNew node renderer. The quotes are permanently saved in the graph database.
          </p>
        </div>

        <!-- Development Info (Admin Only) -->
        <div v-if="userStore.loggedIn && userStore.role === 'Superadmin'" class="dev-info">
          <h5>🚧 Development Status</h5>
          <ul>
            <li>✅ Menu integration complete</li>
            <li>✅ Superadmin access control</li>
            <li>✅ Basic graph data loading</li>
            <li>✅ IMAGEQUOTE component with comprehensive image handling</li>
            <li>✅ Consolidated IMAGEQUOTE creation interface</li>
            <li>✅ Upload, AI Generate, URL paste functionality</li>
            <li>✅ Portfolio image selection with quality controls</li>
            <li>✅ Export functionality with multiple formats</li>
            <li>✅ Live preview in creator modal</li>
            <li>✅ Font size control</li>
            <li>✅ Edit functionality for created IMAGEQUOTES</li>
            <li>🚧 Modern node rendering (Phase 3.1 - Basic Framework)</li>
            <li>✅ GNewNodeRenderer dynamic component loader</li>
            <li>✅ GNewDefaultNode with formatted element parsing</li>
            <li>✅ [FANCY] element support with styling</li>
            <li>✅ [SECTION] element support</li>
            <li>✅ [IMAGEQUOTE] element support</li>
            <li>✅ [QUOTE] element support with citations</li>
            <li>
              ✅ Enhanced image positioning - ![Leftside/Rightside] with
              Small/Medium/Large/Circle/Shadow variants
            </li>
            <li>✅ GNewImageNode for images</li>
            <li>✅ GNewVideoNode for YouTube videos</li>
            <li>✅ GNewTitleNode for title content</li>
            <li>✅ Chart node components (Phase 3.2) - All 6 chart types complete</li>
            <li>✅ Template Sidebar Infrastructure (Phase 3.3) - Complete with all features</li>
            <li>⏳ Mermaid Diagram Support (Phase 3.4) - Next phase</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Image Editing Modals (Admin Only) -->
    <ImageSelector
      v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
      :is-open="isImageSelectorOpen"
      :current-image-url="currentImageData.url"
      :current-image-alt="currentImageData.alt"
      :image-type="currentImageData.type"
      :image-context="currentImageData.context"
      :graph-context="{ type: 'image-replacement' }"
      @close="closeImageSelector"
      @image-replaced="handleImageReplaced"
    />

    <GooglePhotosSelector
      v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
      :is-open="isGooglePhotosSelectorOpen"
      :google-photos-data="currentGooglePhotosData"
      @close="closeGooglePhotosSelector"
      @photo-selected="handleGooglePhotoSelected"
    />

    <!-- ShareModal -->
    <ShareModal
      v-if="showShareModal"
      :graph-data="graphData"
      :current-graph-id="currentGraphId"
      :current-domain="currentDomain"
      :show-ai-share="showAIShare"
      @close="closeShareModal"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useBranding } from '@/composables/useBranding'
import GNewImageQuote from '@/components/GNewImageQuote.vue'
import AIImageModal from '@/components/AIImageModal.vue'
import ImageSelector from '@/components/ImageSelector.vue'
import GooglePhotosSelector from '@/components/GooglePhotosSelector.vue'
import ShareModal from '@/components/ShareModal.vue'
import GNewNodeRenderer from '@/components/GNewNodeRenderer.vue'
import GNewDefaultNode from '@/components/GNewNodes/GNewDefaultNode.vue'
import GraphStatusBar from '@/components/GraphStatusBar.vue'
import HamburgerMenu from '@/components/HamburgerMenu.vue'
import SocialInteractionBar from '@/components/SocialInteractionBar.vue'
import GraphChatPanel from '@/components/GraphChatPanel.vue'

// Props
const props = defineProps({
  graphId: {
    type: String,
    default: '',
  },
})

// Router
const route = useRoute()
const router = useRouter()

// Store access
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

// Branding composable
const { currentDomain, isCustomDomain } = useBranding()

// Dynamic API endpoint configuration
const getApiEndpoint = (endpoint) => {
  const currentHostname = window.location.hostname

  // If on custom domain, use relative paths for knowledge graph operations
  if (currentHostname !== 'www.vegvisr.org' && currentHostname !== 'localhost') {
    // Knowledge graph operations should go through proxy
    if (
      endpoint.includes('/getknowgraph') ||
      endpoint.includes('/saveGraphWithHistory') ||
      endpoint.includes('/saveknowgraph') ||
      endpoint.includes('/updateknowgraph') ||
      endpoint.includes('/deleteknowgraph')
    ) {
      return endpoint.replace(/https:\/\/knowledge\.vegvisr\.org/, '')
    }

    // API operations (AI, etc.) should still go to main API worker through proxy
    if (endpoint.includes('api.vegvisr.org')) {
      return endpoint.replace(/https:\/\/api\.vegvisr\.org/, '')
    }
  }

  // Default: return original endpoint for www.vegvisr.org
  return endpoint
}

// Reactive data
const graphData = ref({ nodes: [], edges: [] })
const loading = ref(false)
const error = ref(null)
const statusMessage = ref('')
const duplicatingGraph = ref(false)

// Computed properties
const currentGraphId = computed(() => {
  return (
    props.graphId ||
    route.params.graphId ||
    route.query.id ||
    knowledgeGraphStore.currentGraphId ||
    ''
  )
})

// Computed metadata object for social components
const graphMetadata = computed(() => {
  return {
    id: currentGraphId.value,
    title: graphTitle.value,
    category: graphCategories.value.join(','),
    metaArea: graphMetaAreas.value.join(','),
    createdBy: graphCreatedBy.value,
    created_date: graphData.value?.created_date || graphData.value?.metadata?.created_date,
  }
})

// Image editing modal state
const isImageSelectorOpen = ref(false)
const currentImageData = ref({
  url: '',
  alt: '',
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

// Image insert state for edit modal
const isInsertMode = ref(false)
const insertCursorPosition = ref(0)

const isGooglePhotosSelectorOpen = ref(false)
const currentGooglePhotosData = ref({
  url: '',
  alt: '',
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

// IMAGEQUOTE functionality
const showImageQuoteCreator = ref(false)
const newImageQuote = ref({
  text: '',
  backgroundImage: '',
  aspectRatio: '16/9',
  textAlign: 'center',
  padding: '2em',
  fontSize: '1.5rem',
  width: '100%',
  height: 'auto',
  citation: '',
})
// Removed: createdImageQuotes - now inserting directly into nodes

// Node editing functionality
const showNodeEditModal = ref(false)
const editingNode = ref({})
const savingNode = ref(false)

// Reorder modal functionality
const isReorderModalOpen = ref(false)
const reorderableNodes = ref([])
const draggedNodeId = ref(null)
const draggedFromIndex = ref(null)

// Color picker functionality
const selectedColor = ref('#2c3e50')
const showExpandedPalette = ref(false)

// Computed property for sorted nodes (reordering support)
const sortedNodes = computed(() => {
  if (!graphData.value.nodes || graphData.value.nodes.length === 0) {
    return []
  }

  // Filter visible nodes and sort by order property
  const visibleNodes = graphData.value.nodes.filter((node) => node.visible !== false)

  // Ensure all nodes have an order property
  visibleNodes.forEach((node, index) => {
    if (typeof node.order !== 'number') {
      node.order = index + 1
    }
  })

  return visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
})

// Organized color categories based on color wheel principles
const colorCategories = ref([
  {
    name: 'Reds',
    colors: [
      { name: 'Deep Red', hex: '#8B0000' },
      { name: 'Crimson', hex: '#DC143C' },
      { name: 'Red', hex: '#FF0000' },
      { name: 'Light Red', hex: '#FF6B6B' },
      { name: 'Pink', hex: '#FF69B4' },
      { name: 'Light Pink', hex: '#FFB6C1' },
    ],
  },
  {
    name: 'Oranges',
    colors: [
      { name: 'Dark Orange', hex: '#FF8C00' },
      { name: 'Orange', hex: '#FFA500' },
      { name: 'Light Orange', hex: '#FFB347' },
      { name: 'Peach', hex: '#FFCBA4' },
      { name: 'Coral', hex: '#FF7F50' },
      { name: 'Salmon', hex: '#FA8072' },
    ],
  },
  {
    name: 'Yellows',
    colors: [
      { name: 'Dark Yellow', hex: '#FFD700' },
      { name: 'Yellow', hex: '#FFFF00' },
      { name: 'Light Yellow', hex: '#FFFFE0' },
      { name: 'Gold', hex: '#B8860B' },
      { name: 'Khaki', hex: '#F0E68C' },
      { name: 'Cream', hex: '#FFFDD0' },
    ],
  },
  {
    name: 'Greens',
    colors: [
      { name: 'Dark Green', hex: '#006400' },
      { name: 'Forest Green', hex: '#228B22' },
      { name: 'Green', hex: '#008000' },
      { name: 'Lime', hex: '#00FF00' },
      { name: 'Light Green', hex: '#90EE90' },
      { name: 'Mint', hex: '#98FB98' },
    ],
  },
  {
    name: 'Blues',
    colors: [
      { name: 'Navy', hex: '#000080' },
      { name: 'Dark Blue', hex: '#00008B' },
      { name: 'Blue', hex: '#0000FF' },
      { name: 'Royal Blue', hex: '#4169E1' },
      { name: 'Sky Blue', hex: '#87CEEB' },
      { name: 'Light Blue', hex: '#ADD8E6' },
    ],
  },
  {
    name: 'Purples',
    colors: [
      { name: 'Indigo', hex: '#4B0082' },
      { name: 'Purple', hex: '#800080' },
      { name: 'Violet', hex: '#8A2BE2' },
      { name: 'Magenta', hex: '#FF00FF' },
      { name: 'Lavender', hex: '#E6E6FA' },
      { name: 'Plum', hex: '#DDA0DD' },
    ],
  },
  {
    name: 'Neutrals',
    colors: [
      { name: 'Black', hex: '#000000' },
      { name: 'Dark Gray', hex: '#2F2F2F' },
      { name: 'Gray', hex: '#808080' },
      { name: 'Light Gray', hex: '#D3D3D3' },
      { name: 'Silver', hex: '#C0C0C0' },
      { name: 'White', hex: '#FFFFFF' },
    ],
  },
  {
    name: 'Web Safe',
    colors: [
      { name: 'Bootstrap Primary', hex: '#007bff' },
      { name: 'Bootstrap Success', hex: '#28a745' },
      { name: 'Bootstrap Warning', hex: '#ffc107' },
      { name: 'Bootstrap Danger', hex: '#dc3545' },
      { name: 'Bootstrap Info', hex: '#17a2b8' },
      { name: 'Bootstrap Dark', hex: '#343a40' },
    ],
  },
  {
    name: 'Color Wheel Spectrum',
    colors: [
      { name: 'Crimson Red', hex: '#dd3371' },
      { name: 'Coral Red', hex: '#ef3c42' },
      { name: 'Orange Red', hex: '#f25e40' },
      { name: 'Light Orange', hex: '#f2823a' },
      { name: 'Golden Orange', hex: '#f69537' },
      { name: 'Amber', hex: '#f4aa2f' },
      { name: 'Golden Yellow', hex: '#f6c137' },
      { name: 'Bright Yellow', hex: '#fad435' },
      { name: 'Lime Yellow', hex: '#dff429' },
      { name: 'Spring Green', hex: '#a7d52a' },
      { name: 'Forest Green', hex: '#79c725' },
      { name: 'Teal Green', hex: '#53c025' },
      { name: 'Aqua Teal', hex: '#52c67f' },
      { name: 'Sky Blue', hex: '#44aecf' },
      { name: 'Ocean Blue', hex: '#4592ca' },
      { name: 'Royal Blue', hex: '#3f77c4' },
      { name: 'Deep Blue', hex: '#3a57bf' },
      { name: 'Navy Blue', hex: '#3438bd' },
      { name: 'Purple Blue', hex: '#4b27bd' },
      { name: 'Violet', hex: '#7328b6' },
      { name: 'Magenta', hex: '#b528c5' },
      { name: 'Pink Purple', hex: '#c32a94' },
    ],
  },
])

// Quick access colors (most commonly used)
const quickColors = ref([
  { name: 'Deep Blue', hex: '#2c3e50' },
  { name: 'Emerald', hex: '#27ae60' },
  { name: 'Peter River', hex: '#3498db' },
  { name: 'Amethyst', hex: '#9b59b6' },
  { name: 'Carrot', hex: '#e67e22' },
  { name: 'Alizarin', hex: '#e74c3c' },
  { name: 'Wet Asphalt', hex: '#34495e' },
  { name: 'Concrete', hex: '#95a5a6' },
  { name: 'Sun Flower', hex: '#f1c40f' },
  { name: 'Turquoise', hex: '#1abc9c' },
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#ffffff' },
])

// Sharing functionality
const showShareModal = ref(false)

// Formatted definition functionality
const formattedDefinition = ref('')

// Creator Image functionality (consolidated)
const isCreatorAIImageModalOpen = ref(false)
const creatorImageFileInput = ref(null)
const isUploadingCreatorImage = ref(false)
const showCreatorUrlInput = ref(false)
const creatorImageUrl = ref('')
const isCreatorValidUrl = ref(false)
const isLoadingCreatorUrl = ref(false)
const creatorUrlPreviewImage = ref('')
const creatorPastedImage = ref(null)
const creatorImageError = ref('')

// Portfolio image functionality
const showPortfolioImageModal = ref(false)
const portfolioImages = ref([])
const loadingPortfolioImages = ref(false)

// Template sidebar state
const showTemplateSidebar = ref(true)

// Quote suggestions functionality
const isGeneratingQuotes = ref(false)
const quoteSuggestions = ref([])
const quoteSuggestionsError = ref('')

// Node insertion functionality
const selectedNodeForInsertion = ref('')
const imageQuoteType = ref('static') // 'static' or 'standalone'

// Image Quality Settings
const imageQualitySettings = ref({
  preset: 'balanced',
  width: 150,
  height: 94,
  lockAspectRatio: true,
  originalAspectRatio: 150 / 94,
})

// Autocomplete functionality
const showAutocomplete = ref(false)
const selectedElementIndex = ref(0)
const autocompletePosition = ref({ top: 0, left: 0 })
const currentTrigger = ref('')
const nodeContentTextarea = ref(null)

// Mobile menu functionality (starts collapsed)
const showMobileMenu = ref(false)
const mobileSearchQuery = ref('')
const mobileExpandedCategories = ref([])

// New hamburger menu state
const showHamburgerMenu = ref(false)

// Database templates for mobile menu
const mobileTemplates = ref([])
const mobileTemplatesLoading = ref(false)
const mobileTemplatesError = ref(null)

// Comprehensive formatted elements data
const formatElements = [
  // SECTION variations
  {
    trigger: '[SECTION]',
    description: '📦 Styled section with background, alignment & sizing',
    template:
      "[SECTION | background-color: 'lightblue'; color: 'black'; text-align: 'center'; font-size: '1.1em']\nYour content here\n[END SECTION]",
    category: 'Layout',
  },

  // QUOTE elements
  {
    trigger: '[QUOTE]',
    description: '💬 Quote block with attribution',
    template: "[QUOTE | Cited='Author']\nYour quote here\n[END QUOTE]",
    category: 'Content',
  },

  // FANCY element variations
  {
    trigger: '[FANCY]',
    description: '✨ Simple fancy text styling',
    template:
      '[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]\nYour title here\n[END FANCY]',
    category: 'Typography',
  },
  {
    trigger: '[FANCY-IMG]',
    description: '🖼️✨ Fancy text with background image',
    template:
      "[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]",
    category: 'Typography',
  },
  {
    trigger: '[FANCY-GRAD]',
    description: '🌈✨ Fancy text with gradient background',
    template:
      '[FANCY | font-size: 3em; color: #2c3e50; background: linear-gradient(45deg, #f0f8ff, #e6f3ff); text-align: center; padding: 20px; border-radius: 10px]\nYour title here\n[END FANCY]',
    category: 'Typography',
  },

  // WNOTE elements
  {
    trigger: '[WNOTE]',
    description: '📝 Work note with attribution',
    template: "[WNOTE | Cited='Author']\nYour work note here\n[END WNOTE]",
    category: 'Annotation',
  },

  // COMMENT elements
  {
    trigger: '[COMMENT]',
    description: '💭 Comment block with styling',
    template:
      "[COMMENT | author: 'Author'; color: 'gray'; background-color: '#f9f9f9']\nYour comment here\n[END COMMENT]",
    category: 'Annotation',
  },

  // Image elements
  {
    trigger: '![Header',
    description: '🖼️ Header image with full width',
    template:
      "![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)",
    category: 'Media',
  },

  // Enhanced Rightside Image Variants
  {
    trigger: '![Rightside-Small',
    description: '➡️ Right side image - Small (120px)',
    template:
      "![Rightside-1|width: 120px; height: 120px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 10px 15px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Medium',
    description: '➡️ Right side image - Medium (200px)',
    template:
      "![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Large',
    description: '➡️ Right side image - Large (300px)',
    template:
      "![Rightside-1|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 20px 25px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Rounded',
    description: '➡️ Right side image - Rounded corners',
    template:
      "![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; border-radius: '15px'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Circle',
    description: '➡️ Right side image - Circular',
    template:
      '![Rightside-1|width: 180px; height: 180px; object-fit: cover; object-position: center; border-radius: 50%; margin: 0 0 15px 20px](https://vegvisr.imgix.net/SIDEIMG.png)',
    category: 'Media',
  },
  {
    trigger: '![Rightside-Shadow',
    description: '➡️ Right side image - With shadow effect',
    template:
      '![Rightside-1|width: 200px; height: 200px; object-fit: cover; object-position: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 0 0 15px 20px](https://vegvisr.imgix.net/SIDEIMG.png)',
    category: 'Media',
  },
  {
    trigger: '![Rightside',
    description: '➡️ Right side image - Default (200px)',
    template:
      "![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },

  // Enhanced Leftside Image Variants
  {
    trigger: '![Leftside-Small',
    description: '⬅️ Left side image - Small (120px)',
    template:
      "![Leftside-1|width: 120px; height: 120px; object-fit: 'cover'; object-position: 'center'; margin: '0 15px 10px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Medium',
    description: '⬅️ Left side image - Medium (200px)',
    template:
      "![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Large',
    description: '⬅️ Left side image - Large (300px)',
    template:
      "![Leftside-1|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 25px 20px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Rounded',
    description: '⬅️ Left side image - Rounded corners',
    template:
      "![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; border-radius: '15px'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Circle',
    description: '⬅️ Left side image - Circular',
    template:
      '![Leftside-1|width: 180px; height: 180px; object-fit: cover; object-position: center; border-radius: 50%; margin: 0 20px 15px 0](https://vegvisr.imgix.net/SIDEIMG.png)',
    category: 'Media',
  },
  {
    trigger: '![Leftside-Shadow',
    description: '⬅️ Left side image - With shadow effect',
    template:
      '![Leftside-1|width: 200px; height: 200px; object-fit: cover; object-position: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 0 20px 15px 0](https://vegvisr.imgix.net/SIDEIMG.png)',
    category: 'Media',
  },
  {
    trigger: '![Leftside',
    description: '⬅️ Left side image - Default (200px)',
    template:
      "![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },

  // Additional Image Positioning Variants
  {
    trigger: '![Rightside-Wide',
    description: '➡️ Right side image - Wide format (300x150)',
    template:
      "![Rightside-1|width: 300px; height: 150px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Wide',
    description: '⬅️ Left side image - Wide format (300x150)',
    template:
      "![Leftside-1|width: 300px; height: 150px; object-fit: 'cover'; object-position: 'center'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Portrait',
    description: '➡️ Right side image - Portrait format (150x250)',
    template:
      "![Rightside-1|width: 150px; height: 250px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Portrait',
    description: '⬅️ Left side image - Portrait format (150x250)',
    template:
      "![Leftside-1|width: 150px; height: 250px; object-fit: 'cover'; object-position: 'center'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },

  // IMAGEQUOTE elements
  {
    trigger: '[IMAGEQUOTE]',
    description: '🖼️💬 Image quote with background',
    template:
      "[IMAGEQUOTE backgroundImage:'url' fontFamily:'Arial' fontSize:'24px' textColor:'#333']\nYour image quote text\n[END IMAGEQUOTE]",
    category: 'Media',
  },

  // YouTube elements
  {
    trigger: '![YOUTUBE',
    description: '📺 YouTube video embed',
    template: '![YOUTUBE src=https://www.youtube.com/embed/VIDEO_ID]Video Title[END YOUTUBE]',
    category: 'Media',
  },

  // Page break
  {
    trigger: '[pb]',
    description: '📄 Page break for printing/PDF',
    template: '[pb]',
    category: 'Layout',
  },

  // FLEXBOX elements
  {
    trigger: '[FLEXBOX]',
    description: '📦 Flexible layout container with custom styling',
    template:
      '[FLEXBOX | gap: 20px; justify-content: center; align-items: flex-start]\n![Image](https://vegvisr.imgix.net/SIDEIMG.png) ![Image](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-GALLERY]',
    description: '🖼️ Image gallery with wrapping and center alignment',
    template:
      '[FLEXBOX-GALLERY]\n![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-ROW]',
    description: '➡️ Simple horizontal row with space between items',
    template:
      '[FLEXBOX-ROW]\n![Image|width: 120px; height: 80px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 120px; height: 80px](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-GRID]',
    description: '📱 Grid-like layout with responsive wrapping',
    template:
      '[FLEXBOX-GRID]\n![Image|width: 100px; height: 100px; border-radius: 8px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 100px; height: 100px; border-radius: 8px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 100px; height: 100px; border-radius: 8px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 100px; height: 100px; border-radius: 8px](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-CARDS]',
    description: '🃏 Card layout with equal height items',
    template:
      '[FLEXBOX-CARDS]\n**Card 1**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://vegvisr.imgix.net/SIDEIMG.png)\nContent here\n\n**Card 2**\n![Thumbnail|width: 60px; height: 60px; border-radius: 50%](https://vegvisr.imgix.net/SIDEIMG.png)\nMore content\n[END FLEXBOX]',
    category: 'Layout',
  },
]

// Computed property for filtered elements
const filteredElements = computed(() => {
  if (!currentTrigger.value) return []

  const trigger = currentTrigger.value.toLowerCase()

  // Special handling for just '[' - show common elements
  if (trigger === '[') {
    // Show a mix of common elements when user just types '['
    const commonElements = formatElements.filter((element) => {
      const lower = element.trigger.toLowerCase()
      return lower.startsWith('[') || lower.startsWith('![')
    })
    return commonElements.slice(0, 15)
  }

  // Get all matching elements
  const matchingElements = formatElements.filter((element) =>
    element.trigger.toLowerCase().includes(trigger),
  )

  // Sort by relevance: exact prefix matches first, then partial matches
  const sortedElements = matchingElements.sort((a, b) => {
    const aLower = a.trigger.toLowerCase()
    const bLower = b.trigger.toLowerCase()

    // Exact prefix match gets highest priority
    const aExactPrefix = aLower.startsWith(trigger)
    const bExactPrefix = bLower.startsWith(trigger)

    if (aExactPrefix && !bExactPrefix) return -1
    if (!aExactPrefix && bExactPrefix) return 1

    // If both are exact prefix matches, sort alphabetically
    if (aExactPrefix && bExactPrefix) return aLower.localeCompare(bLower)

    // Special prioritization for image elements
    if (trigger.startsWith('![')) {
      const aIsImage = aLower.startsWith('![')
      const bIsImage = bLower.startsWith('![')
      if (aIsImage && !bIsImage) return -1
      if (!aIsImage && bIsImage) return 1

      // Further prioritize Left/Right side elements when trigger suggests it
      if (trigger.includes('left') || trigger.includes('right')) {
        const aIsLeftRight = aLower.includes('leftside') || aLower.includes('rightside')
        const bIsLeftRight = bLower.includes('leftside') || bLower.includes('rightside')
        if (aIsLeftRight && !bIsLeftRight) return -1
        if (!aIsLeftRight && bIsLeftRight) return 1
      }
    }

    // Default alphabetical sort
    return aLower.localeCompare(bLower)
  })

  // Increase limit to show more variants
  return sortedElements.slice(0, 15)
})

// Reactive showAIShare - watch for userStore changes
const showAIShare = ref(false)

// Watch for userStore role changes
watch(
  () => userStore.role,
  (newRole) => {
    showAIShare.value = newRole === 'Superadmin'
  },
  { immediate: true },
)

const statusText = computed(() => {
  if (error.value) return 'Error'
  if (loading.value) return 'Loading'
  if (graphData.value.nodes.length > 0) return 'Loaded'
  return 'Ready'
})

const statusClass = computed(() => {
  if (error.value) return 'text-danger'
  if (loading.value) return 'text-warning'
  if (graphData.value.nodes.length > 0) return 'text-success'
  return 'text-info'
})

// Computed property for aspect ratio
const aspectRatio = computed(() => {
  const width = imageQualitySettings.value.width
  const height = imageQualitySettings.value.height
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  if (width > 0 && height > 0) {
    const divisor = gcd(width, height)
    return `${width / divisor}:${height / divisor}`
  }
  return '16:9'
})

// Computed property for graph context availability
const hasGraphContext = computed(() => {
  return graphData.value.nodes.length > 0
})

// Computed property for nodes available for IMAGEQUOTE insertion
const availableNodesForInsertion = computed(() => {
  return graphData.value.nodes.filter(
    (node) =>
      node.visible !== false && (node.type === 'fulltext' || node.type === 'title' || !node.type),
  )
})

// Aspect ratio dimension calculator
const calculateDimensionsFromAspectRatio = (aspectRatio) => {
  const baseHeight = 1024
  const ratios = {
    '16/9': { width: Math.round(baseHeight * (16 / 9)), height: baseHeight }, // 1536×1024
    '1/1': { width: baseHeight, height: baseHeight }, // 1024×1024
    '4/3': { width: Math.round(baseHeight * (4 / 3)), height: baseHeight }, // 1365×1024
    '9/16': { width: Math.round(baseHeight * (9 / 16)), height: baseHeight }, // 576×1024
  }
  return ratios[aspectRatio] || ratios['16/9']
}

// Enhanced status bar computed properties
const graphTitle = computed(() => {
  return graphData.value.metadata?.title || 'Untitled Graph'
})

const graphCategories = computed(() => {
  const categories = graphData.value.metadata?.category || ''
  if (!categories.trim()) return []
  return categories
    .split('#')
    .map((cat) => cat.trim())
    .filter((cat) => cat.length > 0)
})

const graphMetaAreas = computed(() => {
  const metaAreas = graphData.value.metadata?.metaArea || ''
  if (!metaAreas.trim()) return []
  return metaAreas
    .split('#')
    .map((area) => area.trim())
    .filter((area) => area.length > 0)
})

const graphCreatedBy = computed(() => {
  return graphData.value.metadata?.createdBy || null
})

const hasMetadata = computed(() => {
  return graphCategories.value.length > 0 || graphMetaAreas.value.length > 0 || graphCreatedBy.value
})

// Mobile menu computed properties
const mobileTemplateCategories = computed(() => {
  if (!mobileTemplates.value || !Array.isArray(mobileTemplates.value)) {
    console.log('No mobile templates for categories computation')
    return []
  }

  const categories = [...new Set(mobileTemplates.value.map((t) => t.category).filter(Boolean))]
  console.log('Mobile template categories:', categories)
  return categories.sort()
})

const filteredMobileTemplates = computed(() => {
  if (!mobileTemplates.value || !Array.isArray(mobileTemplates.value)) {
    console.log('No mobile templates for filtering')
    return []
  }

  const query = mobileSearchQuery.value.toLowerCase().trim()
  if (!query) {
    console.log('No search query, returning empty array')
    return []
  }

  const filtered = mobileTemplates.value
    .filter(
      (template) =>
        template.label?.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.category?.toLowerCase().includes(query),
    )
    .slice(0, 10) // Limit to 10 results

  console.log('Filtered mobile templates:', filtered.length, 'for query:', query)
  return filtered
})

// Methods
const loadGraph = async () => {
  const graphId = knowledgeGraphStore.currentGraphId
  if (!graphId) {
    error.value = 'No graph ID is set in the store.'
    return
  }

  loading.value = true
  error.value = null

  try {
    // Use same API endpoint as current GraphViewer with proper endpoint handling
    const apiUrl = getApiEndpoint(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`)
    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.statusText}`)
    }

    const data = await response.json()

    // Process and clean data
    const uniqueNodes = []
    const seenIds = new Set()

    for (const node of data.nodes) {
      if (!seenIds.has(node.id)) {
        uniqueNodes.push({
          ...node,
          visible: node.visible !== false,
        })
        seenIds.add(node.id)
      }
    }

    graphData.value = {
      ...data,
      nodes: uniqueNodes.filter((node) => node.visible !== false),
    }

    console.log(
      `✅ Graph auto-loaded: ${graphData.value.metadata?.title || 'Untitled'} - Nodes: ${graphData.value.nodes.length}`,
    )

    // Attach image change listeners after DOM is ready
    nextTick(() => {
      attachImageChangeListeners()
    })
  } catch (err) {
    error.value = err.message
    console.error('❌ GNew: Error loading graph:', err)
  } finally {
    loading.value = false
  }
}

const refreshData = () => {
  loadGraph()
}

// Mobile menu methods
// Fetch database templates for mobile menu
const fetchMobileTemplates = async () => {
  if (mobileTemplates.value.length > 0) {
    console.log('Mobile templates already loaded:', mobileTemplates.value.length)
    return // Already loaded
  }

  mobileTemplatesLoading.value = true
  mobileTemplatesError.value = null

  try {
    console.log('Fetching templates for mobile menu...')
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()
    console.log('Raw template data:', data)

    if (data.results && Array.isArray(data.results)) {
      mobileTemplates.value = data.results.map((template) => ({
        id: template.id,
        name: template.name,
        label: template.name, // For compatibility
        nodes: JSON.parse(template.nodes || '[]'),
        edges: JSON.parse(template.edges || '[]'),
        category: template.category || 'General',
        type: template.type || 'general',
        icon: getTemplateIcon(template.type),
        description: getTemplateDescription(template.type),
      }))
      console.log('Mobile templates loaded:', mobileTemplates.value.length)
      console.log('Sample template:', mobileTemplates.value[0])
    } else {
      throw new Error('Invalid response format: missing results array')
    }
  } catch (err) {
    console.error('Error fetching mobile templates:', err)
    mobileTemplatesError.value = err.message
  } finally {
    mobileTemplatesLoading.value = false
  }
}

// Helper functions for mobile templates
const getTemplateIcon = (type) => {
  const iconMap = {
    youtube: '🎬',
    image: '��️',
    fulltext: '📄',
    bubblechart: '🫧',
    linechart: '📈',
    gantt: '📊',
    flowchart: '🌊',
    timeline: '⏰',
    map: '🗺️',
    worknote: '📝',
    notes: '📄',
    title: '🎯',
    action_test: '🤖',
  }
  return iconMap[type] || '🧩'
}

const getTemplateDescription = (type) => {
  const descriptions = {
    youtube: 'Embed YouTube videos',
    image: 'Display images with captions',
    fulltext: 'Rich text content with formatting',
    bubblechart: 'Multi-dimensional data visualization',
    linechart: 'Line chart for data trends',
    gantt: 'Project timeline and task management',
    flowchart: 'Process flow diagrams',
    timeline: 'Chronological event visualization',
    map: 'Geographic data and locations',
    worknote: 'Research notes and observations',
    notes: 'Concise notes and insights',
    title: 'Section headers and titles',
    action_test: 'AI endpoint testing interface',
  }
  return descriptions[type] || 'Custom template'
}

const toggleMobileMenu = () => {
  // Only allow toggle for Superadmin and Admin roles
  if (!userStore.loggedIn || (userStore.role !== 'Superadmin' && userStore.role !== 'Admin')) {
    console.log('Mobile menu toggle denied - insufficient permissions')
    return
  }

  console.log('Toggle mobile menu called, current state:', showMobileMenu.value)
  showMobileMenu.value = !showMobileMenu.value
  if (showMobileMenu.value) {
    document.body.style.overflow = 'hidden'
    console.log('Mobile menu opened, fetching templates...')
    // Fetch templates when menu opens
    fetchMobileTemplates()
  } else {
    document.body.style.overflow = ''
    console.log('Mobile menu closed')
  }
}

const closeMobileMenu = () => {
  // Only allow close for Superadmin and Admin roles
  if (!userStore.loggedIn || (userStore.role !== 'Superadmin' && userStore.role !== 'Admin')) {
    return
  }

  showMobileMenu.value = false
  document.body.style.overflow = ''
}

// Mobile menu action wrappers (perform action and close menu)
const loadGraphAndClose = async () => {
  closeMobileMenu()
  await loadGraph()
}

const refreshDataAndClose = () => {
  closeMobileMenu()
  refreshData()
}

const duplicateGraphAndClose = async () => {
  closeMobileMenu()
  await duplicateKnowledgeGraph()
}

const openImageQuoteAndClose = () => {
  closeMobileMenu()
  openImageQuoteCreator()
}

const openShareAndClose = () => {
  closeMobileMenu()
  openShareModal()
}

// Professional Feed navigation
const navigateToProfessionalFeed = () => {
  router.push('/professional-feed')
}

const navigateToProfessionalFeedAndClose = () => {
  closeMobileMenu()
  navigateToProfessionalFeed()
}

// Mobile menu template system integration
const toggleMobileCategory = (category) => {
  const index = mobileExpandedCategories.value.indexOf(category)
  if (index > -1) {
    mobileExpandedCategories.value.splice(index, 1)
  } else {
    mobileExpandedCategories.value.push(category)
  }
}

const getTemplatesByCategory = (category) => {
  if (!mobileTemplates.value || !Array.isArray(mobileTemplates.value)) {
    console.log('No mobile templates available for category:', category)
    return []
  }

  const filtered = mobileTemplates.value.filter((template) => template.category === category)
  console.log(`Templates for category "${category}":`, filtered.length, filtered)
  return filtered
}

const getCategoryIcon = (category) => {
  const iconMap = {
    Charts: '📊',
    Media: '🎬',
    Text: '📝',
    Layout: '📐',
    Interactive: '🎯',
    Analysis: '🔍',
    Business: '💼',
    Marketing: '📈',
    Communication: '💬',
    Development: '⚙️',
    Design: '🎨',
    Data: '📊',
    Social: '👥',
    Tools: '🛠️',
    Templates: '📋',
    Components: '🧩',
    Widgets: '📱',
    Forms: '📄',
    Content: '📰',
  }

  return iconMap[category] || '📁'
}

// New hamburger menu methods
const toggleHamburgerMenu = () => {
  showHamburgerMenu.value = !showHamburgerMenu.value
  console.log('🍔 GNewViewer: toggleHamburgerMenu called, new state:', showHamburgerMenu.value)
}

const handleMenuItemClick = (item) => {
  console.log('🍔 GNewViewer: handleMenuItemClick called with:', item)

  // Handle different menu items
  switch (item) {
    case 'home':
      console.log('🍔 GNewViewer: Home clicked')
      break
    case 'about':
      console.log('🍔 GNewViewer: About clicked')
      break
    case 'settings':
      console.log('🍔 GNewViewer: Settings clicked')
      break
    case 'help':
      console.log('🍔 GNewViewer: Help clicked')
      break
    case 'templates':
      console.log('🍔 GNewViewer: Templates clicked')
      break
    default:
      console.log('🍔 GNewViewer: Unknown menu item:', item)
  }
}

const addTemplateAndClose = async (template) => {
  closeMobileMenu()

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Handle database template structure (extract from template.nodes[0])
  let nodeData = {}

  if (template.nodes && template.nodes.length > 0) {
    // Database template format - extract from first node
    const templateNode = template.nodes[0]

    nodeData = {
      id: generateUUID(),
      label: templateNode.label || template.name || 'New Node',
      color: templateNode.color || '#f9f9f9',
      type: templateNode.type || 'fulltext',
      info: templateNode.info || '',
      bibl: Array.isArray(templateNode.bibl) ? templateNode.bibl : [],
      imageWidth: templateNode.imageWidth || '100%',
      imageHeight: templateNode.imageHeight || '100%',
      visible: templateNode.visible !== false,
      path: templateNode.path || null,
    }
  } else {
    // Fallback for legacy client-side templates
    nodeData = {
      id: generateUUID(),
      label: template.label || template.name || 'New Node',
      color: template.color || 'lightblue',
      type: template.type || 'default',
      info: template.content || template.info || '',
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }
  }

  // Check if we have a valid graph to add to
  if (!knowledgeGraphStore.currentGraphId) {
    console.error('No current graph ID set - cannot add template')
    alert('No graph is currently loaded. Please load a graph first.')
    return
  }

  await handleTemplateAdded({ template, node: nodeData })
}

// Duplicate graph functionality
const duplicateKnowledgeGraph = async () => {
  if (!graphData.value.nodes.length) {
    alert('No graph data to duplicate.')
    return
  }

  // Get current graph metadata
  const currentTitle = graphData.value.metadata?.title || 'Untitled Graph'
  const defaultNewTitle = `${currentTitle} (Copy)`

  // Prompt user for new title
  const newTitle = prompt('Enter title for duplicated graph:', defaultNewTitle)

  if (!newTitle || !newTitle.trim()) {
    return // User cancelled or entered empty title
  }

  duplicatingGraph.value = true

  try {
    // Generate new unique IDs
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0
        const v = c == 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }

    const nodeIdMap = new Map()

    // Create new node IDs and map old to new
    graphData.value.nodes.forEach((node) => {
      nodeIdMap.set(node.id, generateUUID())
    })

    // Duplicate nodes with proper structure matching your JSON example
    const duplicatedNodes = graphData.value.nodes.map((node) => ({
      id: nodeIdMap.get(node.id),
      label: node.label || 'Untitled Node',
      color: node.color || 'gray',
      type: node.type || null,
      info: node.info || null,
      bibl: Array.isArray(node.bibl) ? [...node.bibl] : [],
      imageWidth: node.imageWidth || '100%',
      imageHeight: node.imageHeight || '100%',
      visible: node.visible !== false, // Default to true
      path: node.path || null,
    }))

    // Duplicate edges with proper structure matching your JSON example
    const duplicatedEdges = graphData.value.edges.map((edge) => ({
      id: generateUUID(),
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target,
      label: edge.label || null,
      type: edge.type || null,
      info: edge.info || null,
    }))

    // Create the proper data structure expected by /saveknowgraph endpoint
    // Match the exact structure used in GraphAdmin.vue
    const duplicatedGraphData = {
      metadata: {
        title: newTitle.trim(),
        description: graphData.value.metadata?.description || '',
        createdBy: graphData.value.metadata?.createdBy || 'Unknown',
        category: graphData.value.metadata?.category || '',
        metaArea: graphData.value.metadata?.metaArea || '',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: duplicatedNodes,
      edges: duplicatedEdges,
    }

    console.log('=== DEBUG: Duplicating Graph ===')
    console.log('Current graphData.value:', JSON.stringify(graphData.value, null, 2))
    console.log('Number of nodes in current graph:', graphData.value.nodes?.length || 0)
    console.log('Number of edges in current graph:', graphData.value.edges?.length || 0)
    console.log('Current graph metadata:', JSON.stringify(graphData.value.metadata, null, 2))
    console.log('Generated duplicated nodes:', JSON.stringify(duplicatedNodes, null, 2))
    console.log('Generated duplicated edges:', JSON.stringify(duplicatedEdges, null, 2))
    console.log(
      'Final duplicated graph data structure:',
      JSON.stringify(duplicatedGraphData, null, 2),
    )

    // Use the new dedicated duplicate endpoint
    const apiUrl = getApiEndpoint('https://knowledge.vegvisr.org/duplicateknowgraph')

    console.log('=== DEBUG: Using New Duplicate Endpoint ===')
    console.log('API URL:', apiUrl)
    console.log(
      'Request body size:',
      JSON.stringify({ graphData: duplicatedGraphData }).length,
      'characters',
    )
    console.log(
      'First node content preview:',
      duplicatedGraphData.nodes[0]?.info?.substring(0, 200) + '...',
    )

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graphData: duplicatedGraphData }), // Wrap in graphData object
    })

    console.log('=== DEBUG: API Response ===')
    console.log('Response status:', response.status)
    console.log('Response headers:', [...response.headers.entries()])

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to duplicate graph: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()

    console.log('=== DEBUG: API Response Data ===')
    console.log('Response data:', JSON.stringify(responseData, null, 2))

    // Show success message with details
    statusMessage.value = `✅ Graph duplicated successfully as "${newTitle}"! (${responseData.nodesCount} nodes, ${responseData.edgesCount} edges)`
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)

    // Optional: Ask user if they want to switch to the new graph
    const switchToNew = confirm(
      `Graph duplicated successfully!\n\nNew Title: "${responseData.title}"\nNodes: ${responseData.nodesCount}\nEdges: ${responseData.edgesCount}\n\nWould you like to switch to the new graph?`,
    )
    if (switchToNew) {
      // Update the store with new graph ID and load it
      knowledgeGraphStore.setCurrentGraphId(responseData.id)
      await loadGraph()
    }
  } catch (error) {
    console.error('❌ Error duplicating graph:', error)
    statusMessage.value = `❌ Failed to duplicate graph: ${error.message}`
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)
  } finally {
    duplicatingGraph.value = false
  }
}

// IMAGEQUOTE methods
const openImageQuoteCreator = () => {
  showImageQuoteCreator.value = true
  addPasteListener()
  // Initialize formatted definition
  generateFormattedDefinition()
}

const closeImageQuoteCreator = () => {
  showImageQuoteCreator.value = false
  // Reset form and image state
  newImageQuote.value = {
    text: '',
    backgroundImage: '',
    aspectRatio: '16/9',
    textAlign: 'center',
    padding: '2em',
    fontSize: '1.5rem',
    width: '100%',
    height: 'auto',
    citation: '',
  }
  // Reset image handling state
  showCreatorUrlInput.value = false
  creatorImageUrl.value = ''
  creatorUrlPreviewImage.value = ''
  creatorPastedImage.value = null
  creatorImageError.value = ''
  // Reset quote suggestions state
  quoteSuggestions.value = []
  quoteSuggestionsError.value = ''
  isGeneratingQuotes.value = false
  // Reset node selection
  selectedNodeForInsertion.value = ''
  imageQuoteType.value = 'static'
  removePasteListener()
}

// Share Modal methods
const openShareModal = () => {
  showShareModal.value = true
}

const closeShareModal = () => {
  showShareModal.value = false
}

const saveImageQuote = async () => {
  if (!newImageQuote.value.text.trim()) {
    alert('Please enter quote text')
    return
  }

  if (imageQuoteType.value === 'static' && !selectedNodeForInsertion.value) {
    alert('Please select a node to insert the IMAGEQUOTE into')
    return
  }

  try {
    console.log('=== DEBUG: Starting IMAGEQUOTE Insertion ===')
    console.log('Selected node ID:', selectedNodeForInsertion.value)
    console.log(
      'Available nodes:',
      graphData.value.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type })),
    )

    // Generate the IMAGEQUOTE definition
    const imageQuoteDefinition = generateFormattedDefinition()
    console.log('✅ Generated definition:', imageQuoteDefinition)

    let targetNode

    // Check if creating standalone IMAGEQUOTE node
    if (imageQuoteType.value === 'standalone') {
      console.log('🎨 Creating standalone IMAGEQUOTE node')

      // Generate new UUID for the node
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0
          const v = c == 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      }

      const newNodeId = generateUUID()
      const quoteText = newImageQuote.value.text.substring(0, 50) // First 50 chars for title
      const nodeTitle = `${quoteText}${quoteText.length > 50 ? '...' : ''}`

      // Calculate dimensions based on aspect ratio
      const dimensions = calculateDimensionsFromAspectRatio(newImageQuote.value.aspectRatio)

      // Create new IMAGEQUOTE node
      targetNode = {
        id: newNodeId,
        label: nodeTitle,
        color: '#e6f3ff', // Light blue for IMAGEQUOTE nodes
        type: 'imagequote',
        info: imageQuoteDefinition, // IMAGEQUOTE definition as content
        bibl: [],
        imageWidth: `${dimensions.width}px`,
        imageHeight: `${dimensions.height}px`,
        visible: true,
        path: newImageQuote.value.backgroundImage || null, // Store background image in path
      }

      // Add to graph data
      graphData.value.nodes.push(targetNode)

      console.log('✅ Standalone IMAGEQUOTE node created:', {
        id: targetNode.id,
        label: targetNode.label,
        type: targetNode.type,
        contentLength: targetNode.info.length,
      })
    } else if (selectedNodeForInsertion.value === '__CREATE_NEW__') {
      console.log('🆕 Creating new Fulltext node for IMAGEQUOTE')

      // Generate new UUID for the node
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0
          const v = c == 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      }

      const newNodeId = generateUUID()
      const quoteText = newImageQuote.value.text.substring(0, 50) // First 50 chars for title
      const nodeTitle = `IMAGEQUOTE: ${quoteText}${quoteText.length > 50 ? '...' : ''}`

      // Create new fulltext node
      targetNode = {
        id: newNodeId,
        label: nodeTitle,
        color: 'lightblue',
        type: 'fulltext',
        info: imageQuoteDefinition, // IMAGEQUOTE as the entire content
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
      }

      // Add to graph data
      graphData.value.nodes.push(targetNode)

      console.log('✅ New node created:', {
        id: targetNode.id,
        label: targetNode.label,
        type: targetNode.type,
        contentLength: targetNode.info.length,
      })
    } else {
      // Find existing selected node
      targetNode = graphData.value.nodes.find((node) => node.id === selectedNodeForInsertion.value)
      if (!targetNode) {
        console.error('❌ Selected node not found!')
        console.log(
          'Available node IDs:',
          graphData.value.nodes.map((n) => n.id),
        )
        throw new Error('Selected node not found')
      }

      console.log('✅ Target node found:', {
        id: targetNode.id,
        label: targetNode.label,
        type: targetNode.type,
        currentContentLength: (targetNode.info || '').length,
      })

      // Insert the IMAGEQUOTE definition into the existing node's content
      const currentContent = targetNode.info || ''
      console.log(
        'Current node content:',
        currentContent.substring(0, 200) + (currentContent.length > 200 ? '...' : ''),
      )

      const updatedContent = currentContent.trim()
        ? `${currentContent}\n\n${imageQuoteDefinition}`
        : imageQuoteDefinition

      console.log(
        'Updated content preview:',
        updatedContent.substring(0, 300) + (updatedContent.length > 300 ? '...' : ''),
      )

      // Update the existing node's content
      targetNode.info = updatedContent
      console.log('✅ Existing node content updated locally')
    }

    console.log('IMAGEQUOTE form data:', JSON.stringify(newImageQuote.value, null, 2))

    console.log('=== DEBUG: Preparing to save to database ===')
    console.log(
      'Updated target node in graph data:',
      graphData.value.nodes.find((n) => n.id === selectedNodeForInsertion.value),
    )
    console.log('Graph ID:', knowledgeGraphStore.currentGraphId)
    console.log('Total nodes:', graphData.value.nodes.length)
    console.log('Total edges:', graphData.value.edges.length)

    // Save to backend using the same format as GraphViewer and saveNodeChanges
    const apiUrl = getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory')
    console.log('API URL:', apiUrl)

    const requestPayload = {
      id: knowledgeGraphStore.currentGraphId,
      graphData: graphData.value, // Use raw graphData.value like working examples
      override: true,
    }

    console.log(
      'Request payload (first 500 chars):',
      JSON.stringify(requestPayload, null, 2).substring(0, 500) + '...',
    )

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    })

    console.log('API Response status:', response.status)
    console.log('API Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error response:', errorText)
      throw new Error(`Failed to save the graph with IMAGEQUOTE: ${response.status} - ${errorText}`)
    }

    const responseData = await response.json()
    console.log('✅ API Response data:', responseData)

    // Update the knowledge graph store
    knowledgeGraphStore.updateGraphFromJson(graphData.value)

    // Show success message
    let actionText
    if (imageQuoteType.value === 'standalone') {
      actionText = 'created standalone IMAGEQUOTE node'
    } else if (selectedNodeForInsertion.value === '__CREATE_NEW__') {
      actionText = 'created new node with IMAGEQUOTE'
    } else {
      actionText = `inserted IMAGEQUOTE into "${targetNode.label}"`
    }
    statusMessage.value = `✅ Successfully ${actionText}!`
    setTimeout(() => {
      statusMessage.value = ''
    }, 4000)

    console.log('✅ IMAGEQUOTE saved to node and database successfully')

    // Reattach image change listeners after DOM updates
    nextTick(() => {
      attachImageChangeListeners()
    })

    closeImageQuoteCreator()
  } catch (error) {
    console.error('❌ Error saving IMAGEQUOTE:', error)
    statusMessage.value = `❌ Failed to save IMAGEQUOTE: ${error.message}`
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)
  }
}

// Removed: editImageQuote and deleteImageQuote - now editing directly in nodes

const handleImageQuoteExported = (exportData) => {
  console.log('📸 IMAGEQUOTE exported:', exportData)
  // Could add analytics or feedback here
}

// Quote suggestion methods
const generateQuoteSuggestions = async () => {
  if (!hasGraphContext.value) {
    quoteSuggestionsError.value = 'No graph content available for generating suggestions.'
    return
  }

  isGeneratingQuotes.value = true
  quoteSuggestionsError.value = ''
  quoteSuggestions.value = []

  try {
    console.log('=== Generating Quote Suggestions ===')
    console.log('Graph data available:', graphData.value.nodes.length, 'nodes')

    // Extract context from graph nodes
    const graphContext = graphData.value.nodes
      .filter((node) => node.visible !== false && node.info)
      .map((node) => ({
        id: node.id,
        label: node.label || 'Untitled',
        info: node.info,
        type: node.type || 'fulltext',
      }))
      .slice(0, 10) // Limit to 10 nodes to avoid token limits

    console.log('Context nodes:', graphContext.length)

    const requestPayload = {
      graphContext,
      userRequest:
        'Generate inspirational and meaningful quotes based on the knowledge graph content',
      graphId: knowledgeGraphStore.currentGraphId || '',
      username: userStore.email,
    }

    console.log('Request payload:', JSON.stringify(requestPayload, null, 2))

    const apiUrl = getApiEndpoint('https://api.vegvisr.org/ai-generate-quotes')
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify(requestPayload),
    })

    console.log('Response status:', response.status)

    const text = await response.text()
    console.log('Raw API Response:', text)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} - ${text}`)
    }

    const data = JSON.parse(text)
    console.log('Parsed response data:', data)

    if (data.quotes && Array.isArray(data.quotes)) {
      quoteSuggestions.value = data.quotes.map((quote, index) => ({
        text: quote.text || quote.quote || quote,
        citation: quote.citation || quote.author || '',
        source: quote.source || `Node ${index + 1}`,
        id: `suggestion-${Date.now()}-${index}`,
      }))

      console.log('✅ Quote suggestions generated:', quoteSuggestions.value.length)
    } else {
      throw new Error('Invalid response format: missing quotes array')
    }
  } catch (error) {
    console.error('❌ Error generating quote suggestions:', error)
    quoteSuggestionsError.value = `Failed to generate quotes: ${error.message}`
  } finally {
    isGeneratingQuotes.value = false
  }
}

const applySuggestion = (suggestion) => {
  newImageQuote.value.text = suggestion.text
  if (suggestion.citation) {
    newImageQuote.value.citation = suggestion.citation
  }

  console.log('✅ Quote suggestion applied:', suggestion.text)

  // Clear suggestions after applying
  quoteSuggestions.value = []

  // Regenerate formatted definition
  generateFormattedDefinition()
}

const clearSuggestions = () => {
  quoteSuggestions.value = []
  quoteSuggestionsError.value = ''
}

// Creator Image handling methods (consolidated)
const clearCreatorImage = () => {
  newImageQuote.value.backgroundImage = ''
}

// Removed: updateImageQuoteBackground - now editing directly in nodes

// AI Image methods
const openCreatorAIImageModal = () => {
  isCreatorAIImageModalOpen.value = true
}

const closeCreatorAIImageModal = () => {
  isCreatorAIImageModalOpen.value = false
}

const handleCreatorAIImageGenerated = (imageData) => {
  console.log('=== AI Image Generated for Creator ===')
  console.log('imageData:', imageData)

  try {
    let imageUrl = null

    // Extract URL from different possible formats
    if (typeof imageData === 'string' && imageData.startsWith('http')) {
      imageUrl = imageData
    } else if (typeof imageData === 'object' && imageData.info) {
      // Extract URL from markdown format: ![alt](url)
      const match = imageData.info.match(/!\[.*?\]\((.+?)\)/)
      imageUrl = match ? match[1] : null
    } else if (imageData.url) {
      imageUrl = imageData.url
    }

    console.log('Extracted image URL:', imageUrl)

    if (imageUrl) {
      newImageQuote.value.backgroundImage = imageUrl
      closeCreatorAIImageModal()
      console.log('✅ AI generated image applied:', imageUrl)
    } else {
      console.error('Could not extract image URL from AI response')
      creatorImageError.value = 'Failed to extract image URL from AI generated image.'
    }
  } catch (error) {
    console.error('Error processing AI generated image:', error)
    creatorImageError.value = 'Failed to process AI generated image.'
  }
}

// Upload handling methods
const triggerCreatorImageUpload = () => {
  creatorImageFileInput.value?.click()
}

const handleCreatorImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !file.type.startsWith('image/')) {
    creatorImageError.value = 'Please select a valid image file.'
    return
  }

  isUploadingCreatorImage.value = true
  creatorImageError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()

    console.log('✅ Image uploaded successfully:', data.url)
    newImageQuote.value.backgroundImage = data.url
  } catch (error) {
    console.error('❌ Upload error:', error)
    creatorImageError.value = 'Failed to upload image. Please try again.'
  } finally {
    isUploadingCreatorImage.value = false
    event.target.value = '' // Clear the file input
  }
}

// URL handling methods
const validateCreatorImageUrl = () => {
  isCreatorValidUrl.value =
    creatorImageUrl.value.trim() !== '' &&
    (creatorImageUrl.value.startsWith('http://') || creatorImageUrl.value.startsWith('https://'))
}

const handleCreatorUrlPaste = (event) => {
  // Allow normal paste behavior, validation will happen on input
  setTimeout(validateCreatorImageUrl, 50)
}

const useCreatorImageUrl = async () => {
  if (!isCreatorValidUrl.value) return

  isLoadingCreatorUrl.value = true
  creatorImageError.value = ''

  try {
    // Test if the URL loads as an image
    await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = resolve
      img.onerror = reject
      img.src = creatorImageUrl.value
    })

    creatorUrlPreviewImage.value = creatorImageUrl.value
  } catch (error) {
    creatorImageError.value = 'Invalid image URL or image failed to load.'
  } finally {
    isLoadingCreatorUrl.value = false
  }
}

const applyCreatorUrlImage = () => {
  if (creatorUrlPreviewImage.value) {
    newImageQuote.value.backgroundImage = creatorUrlPreviewImage.value
    creatorUrlPreviewImage.value = ''
    creatorImageUrl.value = ''
    showCreatorUrlInput.value = false
  }
}

// Clipboard paste handling
const handlePaste = async (event) => {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await processCreatorPastedImage(file)
      }
      return
    }
  }
}

const processCreatorPastedImage = async (file) => {
  try {
    isUploadingCreatorImage.value = true
    creatorImageError.value = ''

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload pasted image')
    }

    const data = await response.json()

    creatorPastedImage.value = {
      url: data.url,
      alt: 'Pasted image',
    }

    console.log('✅ Pasted image uploaded:', data.url)
  } catch (error) {
    console.error('❌ Paste error:', error)
    creatorImageError.value = 'Failed to process pasted image: ' + error.message
  } finally {
    isUploadingCreatorImage.value = false
  }
}

const useCreatorPastedImage = () => {
  if (creatorPastedImage.value) {
    newImageQuote.value.backgroundImage = creatorPastedImage.value.url
    creatorPastedImage.value = null
  }
}

const clearCreatorPastedImage = () => {
  creatorPastedImage.value = null
}

const addPasteListener = () => {
  document.addEventListener('paste', handlePaste)
}

const removePasteListener = () => {
  document.removeEventListener('paste', handlePaste)
}

// Portfolio image methods
const openPortfolioImageModal = async () => {
  showPortfolioImageModal.value = true
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

const closePortfolioImageModal = () => {
  showPortfolioImageModal.value = false
  portfolioImages.value = []
}

const selectPortfolioImage = (img) => {
  const optimizedUrl = getOptimizedImageUrl(img.url)
  newImageQuote.value.backgroundImage = optimizedUrl
  closePortfolioImageModal()
  console.log('✅ Portfolio image selected:', optimizedUrl)
}

// Image Quality Control Functions
const getOptimizedImageUrl = (baseUrl) => {
  if (!baseUrl) return baseUrl

  const settings = imageQualitySettings.value
  const presets = {
    ultraFast: `?w=${settings.width}&h=${settings.height}&fit=crop&auto=format,compress&q=30`,
    balanced: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance,compress&q=65&dpr=2`,
    highQuality: `?w=${settings.width}&h=${settings.height}&fit=crop&crop=entropy&auto=format,enhance&q=85&sharp=1&sat=5`,
  }

  const params = presets[settings.preset] || presets.balanced

  // If URL already has parameters, replace them; otherwise add them
  if (baseUrl.includes('?')) {
    return baseUrl.split('?')[0] + params
  }
  return baseUrl + params
}

const updateImagePreview = () => {
  // Force reactivity update by triggering computed property recalculation
}

const resetQualitySettings = () => {
  imageQualitySettings.value = {
    preset: 'balanced',
    width: 150,
    height: 94,
    lockAspectRatio: true,
    originalAspectRatio: 150 / 94,
  }
  updateImagePreview()
}

const onWidthChange = () => {
  if (imageQualitySettings.value.lockAspectRatio) {
    const newHeight = Math.round(
      imageQualitySettings.value.width / imageQualitySettings.value.originalAspectRatio,
    )
    imageQualitySettings.value.height = Math.max(50, Math.min(600, newHeight))
  } else {
    // Update aspect ratio when not locked
    updateAspectRatio()
  }
  updateImagePreview()
}

const onHeightChange = () => {
  if (imageQualitySettings.value.lockAspectRatio) {
    const newWidth = Math.round(
      imageQualitySettings.value.height * imageQualitySettings.value.originalAspectRatio,
    )
    imageQualitySettings.value.width = Math.max(50, Math.min(800, newWidth))
  } else {
    // Update aspect ratio when not locked
    updateAspectRatio()
  }
  updateImagePreview()
}

const updateAspectRatio = () => {
  if (imageQualitySettings.value.width > 0 && imageQualitySettings.value.height > 0) {
    imageQualitySettings.value.originalAspectRatio =
      imageQualitySettings.value.width / imageQualitySettings.value.height
  }
}

// Formatted definition methods
const generateFormattedDefinition = () => {
  if (!newImageQuote.value.text.trim()) {
    formattedDefinition.value = ''
    return ''
  }

  const params = []

  // Always include backgroundImage if present
  if (newImageQuote.value.backgroundImage) {
    params.push(`backgroundImage:'${newImageQuote.value.backgroundImage}'`)
  }

  // Always include aspectRatio (needed for proper rendering)
  const aspectRatio = newImageQuote.value.aspectRatio || '16/9'
  params.push(`aspectRatio:'${aspectRatio}'`)

  // Always include textAlign (needed for proper rendering)
  const textAlign = newImageQuote.value.textAlign || 'center'
  params.push(`textAlign:'${textAlign}'`)

  // Always include padding (needed for proper rendering)
  const padding = newImageQuote.value.padding || '2rem'
  params.push(`padding:'${padding}'`)

  // Always include fontSize (needed for proper rendering)
  const fontSize = newImageQuote.value.fontSize || '1.5rem'
  params.push(`fontSize:'${fontSize}'`)

  // Include width if not 100%
  if (newImageQuote.value.width && newImageQuote.value.width !== '100%') {
    params.push(`width:'${newImageQuote.value.width}'`)
  }

  // Include height if not auto
  if (newImageQuote.value.height && newImageQuote.value.height !== 'auto') {
    params.push(`height:'${newImageQuote.value.height}'`)
  }

  // Always include citation if present
  if (newImageQuote.value.citation) {
    params.push(`cited:'${newImageQuote.value.citation}'`)
  }

  const paramString = params.length > 0 ? ` ${params.join(' ')}` : ''
  const definition = `[IMAGEQUOTE${paramString}] ${newImageQuote.value.text} [END IMAGEQUOTE]`

  formattedDefinition.value = definition
  return definition
}

const parseFormattedDefinition = () => {
  if (!formattedDefinition.value.trim()) return

  try {
    // Parse the formatted definition back to the form
    const match = formattedDefinition.value.match(
      /^\[IMAGEQUOTE([^\]]*)\]\s*(.*?)\s*\[END\s+IMAGEQUOTE\]$/s,
    )

    if (match) {
      const paramString = match[1]
      const text = match[2]

      // Update text
      newImageQuote.value.text = text

      // Parse parameters
      const params = paramString.match(/(\w+):'([^']*)'/g) || []

      // Reset to defaults
      newImageQuote.value.backgroundImage = ''
      newImageQuote.value.aspectRatio = '16/9'
      newImageQuote.value.textAlign = 'center'
      newImageQuote.value.padding = '2em'
      newImageQuote.value.fontSize = '1.5rem'
      newImageQuote.value.width = '100%'
      newImageQuote.value.height = 'auto'
      newImageQuote.value.citation = ''

      // Apply parsed parameters
      params.forEach((param) => {
        const [, key, value] = param.match(/(\w+):'([^']*)'/)

        switch (key) {
          case 'backgroundImage':
            newImageQuote.value.backgroundImage = value
            break
          case 'aspectRatio':
            newImageQuote.value.aspectRatio = value
            break
          case 'textAlign':
            newImageQuote.value.textAlign = value
            break
          case 'padding':
            newImageQuote.value.padding = value
            break
          case 'fontSize':
            newImageQuote.value.fontSize = value
            break
          case 'width':
            newImageQuote.value.width = value
            break
          case 'height':
            newImageQuote.value.height = value
            break
          case 'cited':
            newImageQuote.value.citation = value
            break
        }
      })
    }
  } catch (error) {
    console.error('Error parsing formatted definition:', error)
  }
}

// Removed: generateCreatedQuoteDefinition - using generateFormattedDefinition instead

// Node editing methods
const openNodeEditModal = (node) => {
  editingNode.value = {
    id: node.id,
    label: node.label || '',
    info: node.info || '',
    type: node.type || 'default',
  }
  showNodeEditModal.value = true
}

const closeNodeEditModal = () => {
  showNodeEditModal.value = false
  editingNode.value = {}
  savingNode.value = false
}

// Color picker methods
const updateSelectedColor = (event) => {
  selectedColor.value = event.target.value
}

const selectQuickColor = (hex) => {
  selectedColor.value = hex
}

const insertColorAtCursor = () => {
  const textarea = nodeContentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = editingNode.value.info || ''

  // Insert the color hex code at cursor position
  const newValue = value.slice(0, start) + selectedColor.value + value.slice(end)
  editingNode.value.info = newValue

  // Restore cursor position after the inserted text
  nextTick(() => {
    const newPosition = start + selectedColor.value.length
    textarea.setSelectionRange(newPosition, newPosition)
    textarea.focus()
  })
}

const insertImageAtCursor = () => {
  const textarea = nodeContentTextarea.value
  if (!textarea) return

  // Store the current cursor position for later insertion
  insertCursorPosition.value = textarea.selectionStart
  
  // Set up image selector in insert mode
  isInsertMode.value = true
  currentImageData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: editingNode.value.id,
    nodeContent: editingNode.value.info || '',
  }
  
  // Open the ImageSelector modal
  isImageSelectorOpen.value = true
}

const saveNodeChanges = async () => {
  if (!editingNode.value.id) {
    console.error('No node ID to save')
    return
  }

  savingNode.value = true

  try {
    // Update the node in the local graph data
    const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === editingNode.value.id)
    if (nodeIndex !== -1) {
      graphData.value.nodes[nodeIndex] = {
        ...graphData.value.nodes[nodeIndex],
        label: editingNode.value.label,
        info: editingNode.value.info,
        updatedAt: new Date().toISOString(),
      }

      // Save to backend using the same mechanism as GraphViewer
      const response = await fetch(
        getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: knowledgeGraphStore.currentGraphId,
            graphData: graphData.value,
            override: true,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to save the graph with updated node.')
      }

      await response.json()

      // Update the knowledge graph store
      knowledgeGraphStore.updateGraphFromJson(graphData.value)

      // Show success message
      statusMessage.value = 'Node updated successfully!'
      setTimeout(() => {
        statusMessage.value = ''
      }, 3000)

      closeNodeEditModal()
    } else {
      console.error('Node not found in graph data')
    }
  } catch (error) {
    console.error('Error saving node changes:', error)
    statusMessage.value = 'Failed to save node changes. Please try again.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  } finally {
    savingNode.value = false
  }
}

// Node event handlers
const handleNodeUpdated = async (updatedNode) => {
  if (updatedNode.action === 'edit') {
    openNodeEditModal(updatedNode)
    return
  }

  // Handle actual node updates (like audio path changes)
  console.log('🔄 GNew: Node Updated:', updatedNode.id, updatedNode)

  try {
    // Find and update the node in graphData
    const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === updatedNode.id)
    if (nodeIndex === -1) {
      throw new Error('Node not found in graph data')
    }

    // Update the node with new data
    graphData.value.nodes[nodeIndex] = { ...updatedNode }

    // Create updated graph data
    const updatedGraphData = {
      ...graphData.value,
      nodes: [...graphData.value.nodes],
    }

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save graph after node update.')
    }

    await response.json()

    // Update the store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Update local state
    graphData.value = updatedGraphData

    console.log('🎤 GNew: Node updated successfully, path:', updatedNode.path)
  } catch (error) {
    console.error('GNew: Error updating node:', error)
    statusMessage.value = `❌ Failed to update node: ${error.message}`
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)

    // Reload the graph data to ensure consistency
    await fetchGraphData()
  }
}

const handleNodeDeleted = async (nodeId) => {
  console.log('=== GNew: Node Deletion ===')
  console.log('Node ID to delete:', nodeId)

  try {
    // Find the node to delete
    const nodeToDelete = graphData.value.nodes.find((node) => node.id === nodeId)
    if (!nodeToDelete) {
      throw new Error('Node not found in graph data')
    }

    const nodeDisplayName = getNodeDisplayName(nodeToDelete)
    console.log('Node to delete:', nodeToDelete)

    // Remove the node from graphData
    const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === nodeId)
    if (nodeIndex === -1) {
      throw new Error('Node not found in graph data')
    }

    // Remove from local data
    graphData.value.nodes.splice(nodeIndex, 1)

    // Reassign order values to maintain sequence
    const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
    visibleNodes.forEach((n, index) => {
      n.order = index + 1
    })

    console.log('Updated graph data after deletion:', graphData.value)

    // Create updated graph data
    const updatedGraphData = {
      ...graphData.value,
      nodes: [...graphData.value.nodes],
    }

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save graph after node deletion.')
    }

    await response.json()

    // Update the store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Update local state
    graphData.value = updatedGraphData

    // Show success message
    statusMessage.value = `✅ Node "${nodeDisplayName}" deleted successfully!`
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)

    console.log('GNew: Node deleted successfully')

    // Reattach image change listeners after DOM updates
    nextTick(() => {
      attachImageChangeListeners()
    })
  } catch (error) {
    console.error('GNew: Error deleting node:', error)
    statusMessage.value = `❌ Failed to delete node: ${error.message}`
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)

    // Reload the graph data to ensure consistency
    await fetchGraphData()
  }
}

const handleNodeCreated = async (newNode) => {
  console.log('=== GNew: Node Created ===')
  console.log('New node data:', newNode)

  try {
    // Add the new node to the local graph data
    graphData.value.nodes.push(newNode)

    // Create updated graph data
    const updatedGraphData = {
      ...graphData.value,
      nodes: [...graphData.value.nodes],
    }

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with new node.')
    }

    await response.json()

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Update local state
    graphData.value = updatedGraphData

    statusMessage.value = `✅ New node "${newNode.label}" created successfully!`
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)

    console.log('GNew: New node saved successfully')

    // Reattach image change listeners after DOM updates
    nextTick(() => {
      attachImageChangeListeners()
    })
  } catch (error) {
    console.error('GNew: Error creating new node:', error)
    statusMessage.value = '❌ Failed to create new node. Please try again.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)
  }
}

// Watchers
watch(() => creatorImageUrl.value, validateCreatorImageUrl)

// Watch for changes in newImageQuote to update formatted definition
watch(
  () => newImageQuote.value,
  () => {
    generateFormattedDefinition()
  },
  { deep: true },
)

// Watch for changes to the graph data nodes to reattach listeners when new content is added
watch(
  () => graphData.value.nodes.length,
  () => {
    nextTick(() => {
      attachImageChangeListeners()
    })
  },
)

// Debug configuration for image replacement (toggle for debugging)
const IMAGE_DEBUG = {
  enabled: true, // Set to false to disable all debug logging
  logReplacement: true,
  logNodeData: true,
  logApiCalls: true,
}

// Clean debug function for image operations
const imageDebug = (category, message, data) => {
  if (!IMAGE_DEBUG.enabled) return
  if (!IMAGE_DEBUG[category]) return

  console.log(`🖼️ [${category.toUpperCase()}] ${message}`)
  if (data) console.log(data)
}

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to get node display name for dialogs
const getNodeDisplayName = (node) => {
  if (node.type === 'title') {
    return node.label || 'Untitled'
  }
  return node.label || `${node.type} node`
}

// Helper function to get node type icon for reorder modal
const getNodeTypeIcon = (type) => {
  const icons = {
    title: '📄',
    worknote: '📝',
    'markdown-image': '🖼️',
    'youtube-video': '📺',
    map: '🗺️',
    chart: '📊',
    piechart: '🥧',
    linechart: '📈',
    timeline: '⏰',
    swot: '📋',
    bubblechart: '💭',
    'mermaid-diagram': '🔀',
    background: '🖼️',
  }
  return icons[type] || '📄'
}

// Helper function to get node position in reorder modal
const getNodePosition = (node) => {
  const index = reorderableNodes.value.findIndex((n) => n.id === node.id)
  return index !== -1 ? index + 1 : 1
}

// Image editing modal functions
const openImageSelector = (imageData) => {
  if (!userStore.loggedIn || userStore.role !== 'Superadmin') {
    console.log('Image editing access denied - requires Superadmin role')
    return
  }

  console.log('=== GNew: Opening Image Selector ===')
  console.log('Image data:', imageData)

  currentImageData.value = {
    url: imageData.url,
    alt: imageData.alt || '',
    type: imageData.type || 'Unknown',
    context: imageData.context || 'No context provided',
    nodeId: imageData.nodeId,
    nodeContent: imageData.nodeContent || '',
  }
  isImageSelectorOpen.value = true
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
  currentImageData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

const openGooglePhotosSelector = (googlePhotosData) => {
  if (!userStore.loggedIn || userStore.role !== 'Superadmin') {
    console.log('Google Photos access denied - requires Superadmin role')
    return
  }

  console.log('=== GNew: Opening Google Photos Selector ===')
  console.log('Google Photos data:', googlePhotosData)

  currentGooglePhotosData.value = {
    url: googlePhotosData.url || '',
    alt: googlePhotosData.alt || '',
    type: googlePhotosData.type || 'Unknown',
    context: googlePhotosData.context || 'No context provided',
    nodeId: googlePhotosData.nodeId,
    nodeContent: googlePhotosData.nodeContent || '',
  }
  isGooglePhotosSelectorOpen.value = true
}

const closeGooglePhotosSelector = () => {
  isGooglePhotosSelectorOpen.value = false
  currentGooglePhotosData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

// Image replacement handler
const handleImageReplaced = async (replacementData) => {
  imageDebug('logReplacement', 'Image replacement/insertion started', replacementData)

  try {
    // Handle insert mode differently from replacement mode
    if (isInsertMode.value) {
      // Insert mode: Add image markdown at cursor position in edit modal
      const imageMarkdown = `![${replacementData.alt || 'Image'}](${replacementData.newUrl})`
      
      const textarea = nodeContentTextarea.value
      if (textarea) {
        const value = editingNode.value.info || ''
        const newValue = value.slice(0, insertCursorPosition.value) + imageMarkdown + value.slice(insertCursorPosition.value)
        editingNode.value.info = newValue
        
        // Restore cursor position after the inserted text
        nextTick(() => {
          textarea.focus()
          textarea.setSelectionRange(
            insertCursorPosition.value + imageMarkdown.length, 
            insertCursorPosition.value + imageMarkdown.length
          )
        })
      }
      
      statusMessage.value = `✅ Image inserted successfully! Image by ${replacementData.photographer || 'Unknown'}`
      setTimeout(() => {
        statusMessage.value = ''
      }, 3000)
      
      // Reset insert mode
      isInsertMode.value = false
      insertCursorPosition.value = 0
      closeImageSelector()
      return
    }

    // Original replacement mode logic follows...
    // Find the node to update
    const nodeToUpdate = graphData.value.nodes.find(
      (node) => node.id === currentImageData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for image replacement')
    }

    imageDebug('logNodeData', 'Node found for update', {
      nodeId: nodeToUpdate.id,
      nodeType: nodeToUpdate.type,
      nodeLabel: nodeToUpdate.label,
      hasInfo: !!nodeToUpdate.info,
      infoLength: nodeToUpdate.info?.length || 0,
      hasLabel: !!nodeToUpdate.label,
      labelLength: nodeToUpdate.label?.length || 0,
    })

    // Determine which field contains the image URL based on node type
    let contentField = 'info' // default
    let updatedContent = ''

    if (nodeToUpdate.type === 'markdown-image') {
      // For markdown-image nodes, the URL is in the label field
      contentField = 'label'
      updatedContent = nodeToUpdate.label || ''
    } else {
      // For other node types, the URL is typically in the info field
      contentField = 'info'
      updatedContent = nodeToUpdate.info || ''
    }

    imageDebug('logReplacement', 'Content field determination', {
      nodeType: nodeToUpdate.type,
      contentField: contentField,
      contentLength: updatedContent.length,
      contentPreview: updatedContent.substring(0, 100),
    })

    const oldUrl = replacementData.oldUrl
    const newUrl = replacementData.newUrl

    imageDebug('logReplacement', 'URL replacement parameters', {
      oldUrl: oldUrl,
      newUrl: newUrl,
      oldUrlType: typeof oldUrl,
      newUrlType: typeof newUrl,
      updatedContentType: typeof updatedContent,
      updatedContentLength: updatedContent.length,
    })

    // Safety check before calling replace
    if (typeof oldUrl !== 'string') {
      throw new Error(`oldUrl is not a string: ${typeof oldUrl} - ${oldUrl}`)
    }
    if (typeof newUrl !== 'string') {
      throw new Error(`newUrl is not a string: ${typeof newUrl} - ${newUrl}`)
    }
    if (typeof updatedContent !== 'string') {
      throw new Error(
        `updatedContent is not a string: ${typeof updatedContent} - ${updatedContent}`,
      )
    }

    // Replace the image URL in the node's content
    const originalContent = updatedContent
    updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), newUrl)

    imageDebug('logReplacement', 'URL replacement completed successfully', {
      replacementCount: originalContent.split(oldUrl).length - 1,
      newContentLength: updatedContent.length,
      contentField: contentField,
      oldUrlFound: originalContent.includes(oldUrl),
    })

    // Store attribution data in the node if available
    if (replacementData.attribution && replacementData.attribution.requires_attribution) {
      imageDebug('logReplacement', 'Storing attribution data', replacementData.attribution)

      // Initialize imageAttributions as an object if it doesn't exist
      if (!nodeToUpdate.imageAttributions) {
        nodeToUpdate.imageAttributions = {}
      }

      // Store attribution data keyed by the new image URL
      nodeToUpdate.imageAttributions[newUrl] = {
        provider: replacementData.attribution.provider,
        photographer: replacementData.attribution.photographer,
        photographer_url: replacementData.attribution.photographer_url,
        photographer_username: replacementData.attribution.photographer_username,
        unsplash_url: replacementData.attribution.unsplash_url,
        pexels_url: replacementData.attribution.pexels_url,
        requires_attribution: replacementData.attribution.requires_attribution,
        attribution_text:
          replacementData.attribution.provider === 'unsplash'
            ? `Photo by ${replacementData.attribution.photographer} on Unsplash`
            : replacementData.attribution.provider === 'pexels'
              ? `Photo by ${replacementData.attribution.photographer} on Pexels`
              : `Photo by ${replacementData.attribution.photographer}`,
        timestamp: Date.now(),
      }
    }

    // Update the correct field on the node
    if (contentField === 'label') {
      nodeToUpdate.label = updatedContent
    } else {
      nodeToUpdate.info = updatedContent
    }

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) => {
        if (node.id === nodeToUpdate.id) {
          // Update the correct field based on what was changed and include imageAttributions
          const updatedNode = { ...node, imageAttributions: nodeToUpdate.imageAttributions }
          if (contentField === 'label') {
            return { ...updatedNode, label: updatedContent }
          } else {
            return { ...updatedNode, info: updatedContent }
          }
        }
        return node
      }),
    }

    imageDebug('logApiCalls', 'Preparing API call to save graph', {
      graphId: knowledgeGraphStore.currentGraphId,
      totalNodes: updatedGraphData.nodes.length,
      updatedNodeId: nodeToUpdate.id,
    })

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    imageDebug('logApiCalls', 'API response received', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    })

    if (!response.ok) {
      throw new Error('Failed to save the graph with updated image.')
    }

    await response.json()

    imageDebug('logApiCalls', 'Graph saved successfully', {
      message: 'Image replacement operation completed successfully',
    })

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Update local state
    graphData.value = updatedGraphData

    statusMessage.value = `✅ Image replaced successfully! New image by ${replacementData.photographer || 'Unknown'}`
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)

    imageDebug('logReplacement', 'Image replacement process completed', {
      photographer: replacementData.photographer || 'Unknown',
      finalMessage: 'All operations successful',
    })

    console.log('GNew: Image update saved successfully')

    // Reattach image change listeners after DOM updates
    nextTick(() => {
      attachImageChangeListeners()
    })
  } catch (error) {
    imageDebug('logReplacement', 'Error during image replacement', {
      errorMessage: error.message,
      errorStack: error.stack,
      replacementData: replacementData,
      currentImageData: currentImageData.value,
    })
    console.error('GNew: Error updating image:', error)
    statusMessage.value = '❌ Failed to update the image. Please try again.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)
  }

  closeImageSelector()
}

// Google Photo selection handler
const handleGooglePhotoSelected = async (selectionData) => {
  console.log('=== GNew: Google Photo Selected ===')
  console.log('Selection data:', selectionData)

  try {
    // Find the node to update
    const nodeToUpdate = graphData.value.nodes.find(
      (node) => node.id === currentGooglePhotosData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for Google photo replacement')
    }

    const photo = selectionData.photo
    let photoMarkdown = ''
    const imageUrl = photo.permanentUrl || photo.url

    // Create markdown for the selected Google photo
    switch (selectionData.imageType) {
      case 'Header':
        photoMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Leftside':
        photoMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Rightside':
        photoMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      default:
        photoMarkdown = `![Image|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
    }

    let updatedContent = nodeToUpdate.info || ''
    const oldUrl = currentGooglePhotosData.value.url

    if (oldUrl && updatedContent.includes(oldUrl)) {
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), imageUrl)
    } else {
      if (updatedContent.trim()) {
        updatedContent += '\n\n' + photoMarkdown
      } else {
        updatedContent = photoMarkdown
      }
    }

    // Update the node
    nodeToUpdate.info = updatedContent

    const updatedGraphData = {
      ...graphData.value,
      nodes: graphData.value.nodes.map((node) =>
        node.id === nodeToUpdate.id ? { ...node, info: updatedContent } : node,
      ),
    }

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with Google photo.')
    }

    await response.json()

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Update local state
    graphData.value = updatedGraphData

    statusMessage.value = '✅ Google Photo added successfully from your Google Photos!'
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)

    console.log('GNew: Google photo saved successfully')

    // Reattach image change listeners after DOM updates
    nextTick(() => {
      attachImageChangeListeners()
    })
  } catch (error) {
    console.error('GNew: Error adding Google photo:', error)
    statusMessage.value = '❌ Failed to add the Google photo. Please try again.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 5000)
  }

  closeGooglePhotosSelector()
}

// Event listener attachment for image edit buttons
const attachImageChangeListeners = () => {
  console.log('=== GNew: Attaching Change Image Button Listeners ===')

  // Regular change image button listeners
  const changeImageButtons = document.querySelectorAll('.change-image-btn')
  console.log('Found change image buttons:', changeImageButtons.length)
  changeImageButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const btn = event.target
      const imageData = {
        url: btn.getAttribute('data-image-url'),
        alt: btn.getAttribute('data-image-alt'),
        type: btn.getAttribute('data-image-type'),
        context: btn.getAttribute('data-image-context'),
        nodeId: btn.getAttribute('data-node-id'),
        nodeContent: btn.getAttribute('data-node-content'),
      }
      openImageSelector(imageData)
    })
  })

  // Google Photos button listeners
  const googlePhotosButtons = document.querySelectorAll('.google-photos-btn')
  console.log('Found Google Photos buttons:', googlePhotosButtons.length)
  googlePhotosButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const btn = event.target
      const googlePhotosData = {
        url: btn.getAttribute('data-image-url'),
        alt: btn.getAttribute('data-image-alt'),
        type: btn.getAttribute('data-image-type'),
        context: btn.getAttribute('data-image-context'),
        nodeId: btn.getAttribute('data-node-id'),
        nodeContent: btn.getAttribute('data-node-content'),
      }
      openGooglePhotosSelector(googlePhotosData)
    })
  })

  // IMAGEQUOTE image button listeners
  const imagequoteImageButtons = document.querySelectorAll('.imagequote-image-btn')
  console.log('Found IMAGEQUOTE image buttons:', imagequoteImageButtons.length)
  imagequoteImageButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const btn = event.target
      // For now, just log - IMAGEQUOTE editing can be implemented later
      console.log('IMAGEQUOTE image button clicked - implement IMAGEQUOTE image editing modal')
      console.log('Node ID:', btn.getAttribute('data-node-id'))
      console.log('IMAGEQUOTE index:', btn.getAttribute('data-imagequote-index'))
    })
  })

  console.log('GNew: Change image and Google Photos button listeners attached successfully')
}

// Autocomplete Methods
const handleTextareaInput = (event) => {
  const textarea = event.target
  const cursorPos = textarea.selectionStart
  const text = textarea.value

  // Look backwards from cursor position to find trigger
  let triggerStart = -1
  let triggerText = ''

  // Check for [ or ![ triggers
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i]
    if (char === '[') {
      triggerStart = i
      triggerText = text.substring(i, cursorPos)
      break
    } else if (char === '!' && i > 0 && text[i - 1] === '[') {
      triggerStart = i - 1
      triggerText = text.substring(i - 1, cursorPos)
      break
    } else if (char === ' ' || char === '\n' || char === '\t') {
      // Stop at whitespace
      break
    }
  }

  // Show autocomplete if we found a trigger
  if (triggerStart >= 0 && triggerText.length > 0) {
    currentTrigger.value = triggerText
    updateAutocompletePosition(textarea, triggerStart)
    showAutocomplete.value = true
    selectedElementIndex.value = 0
  } else {
    showAutocomplete.value = false
  }
}

const handleTextareaKeydown = (event) => {
  if (!showAutocomplete.value || filteredElements.value.length === 0) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedElementIndex.value = Math.min(
        selectedElementIndex.value + 1,
        filteredElements.value.length - 1,
      )
      break

    case 'ArrowUp':
      event.preventDefault()
      selectedElementIndex.value = Math.max(selectedElementIndex.value - 1, 0)
      break

    case 'Tab':
    case 'Enter':
      event.preventDefault()
      if (filteredElements.value[selectedElementIndex.value]) {
        insertElement(filteredElements.value[selectedElementIndex.value])
      }
      break

    case 'Escape':
      event.preventDefault()
      hideAutocomplete()
      break
  }
}

const updateAutocompletePosition = (textarea, triggerStart) => {
  // Get line height and character dimensions for position calculation
  const style = window.getComputedStyle(textarea)
  const lineHeight = parseInt(style.lineHeight) || 20
  const charWidth = 8 // Approximate character width

  // Count lines and characters to cursor position
  const textBeforeCursor = textarea.value.substring(0, triggerStart)
  const lines = textBeforeCursor.split('\n')
  const currentLine = lines.length - 1
  const currentColumn = lines[lines.length - 1].length

  // Calculate position relative to textarea
  const top = currentLine * lineHeight + 25 // Add offset for line height
  const left = currentColumn * charWidth + 10 // Add small offset

  autocompletePosition.value = { top, left }
}

const insertElement = (element) => {
  const textarea = nodeContentTextarea.value
  if (!textarea) return

  const cursorPos = textarea.selectionStart
  const text = textarea.value

  // Find the trigger start position
  let triggerStart = cursorPos
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i]
    if (char === '[' || (char === '!' && i > 0 && text[i - 1] === '[')) {
      if (char === '!') {
        triggerStart = i - 1
      } else {
        triggerStart = i
      }
      break
    }
  }

  // Replace the trigger text with the template
  const beforeTrigger = text.substring(0, triggerStart)
  const afterCursor = text.substring(cursorPos)
  const newText = beforeTrigger + element.template + afterCursor

  // Update the textarea value and model
  editingNode.value.info = newText

  // Position cursor after inserted template
  nextTick(() => {
    const newCursorPos = triggerStart + element.template.length
    textarea.setSelectionRange(newCursorPos, newCursorPos)
    textarea.focus()
  })

  hideAutocomplete()
}

const hideAutocomplete = () => {
  // Small delay to allow click events to process
  setTimeout(() => {
    showAutocomplete.value = false
    currentTrigger.value = ''
    selectedElementIndex.value = 0
  }, 150)
}

// Template Sidebar handlers
const handleTemplateAdded = async ({ template, node }) => {
  console.log('=== Template Added Event ===')
  console.log('Template:', template)
  console.log('Node:', node)

  // Validate node data
  if (!node || !node.id) {
    console.error('Invalid node data provided to handleTemplateAdded:', node)
    statusMessage.value = 'Failed to add template node: Invalid node data.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
    return
  }

  try {
    // Add the new node to the graph data
    graphData.value.nodes.push(node)

    // Save to backend
    const response = await fetch(
      getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: graphData.value,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with new template node.')
    }

    await response.json()

    // Update the knowledge graph store
    knowledgeGraphStore.updateGraphFromJson(graphData.value)

    // Show success message
    statusMessage.value = `✅ ${template.name || template.label || 'Template'} added successfully!`
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)

    console.log('Template node saved and added to graph')
  } catch (error) {
    console.error('Error adding template node:', error)
    // Remove the node from local state on error (with null check)
    if (node && node.id) {
      const nodeIndex = graphData.value.nodes.findIndex((n) => n.id === node.id)
      if (nodeIndex > -1) {
        graphData.value.nodes.splice(nodeIndex, 1)
      }
    }

    statusMessage.value = 'Failed to add template node. Please try again.'
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  }
}

// Lifecycle
// Function to handle graph loading from different sources
const handleGraphLoad = () => {
  console.log('GNewViewer: handleGraphLoad called')

  // First check URL parameters for direct graph access (shared links)
  const urlParams = new URLSearchParams(window.location.search)
  const urlGraphId = urlParams.get('graphId')
  const urlTemplate = urlParams.get('template')

  if (urlGraphId) {
    console.log(
      `Loading graph from URL parameter: ${urlGraphId}, Template: ${urlTemplate || 'Default'}`,
    )
    // Set the graph ID in the store for shared links
    knowledgeGraphStore.setCurrentGraphId(urlGraphId)
    loadGraph()
    return
  }

  // Second check prop graphId (from router)
  if (props.graphId) {
    console.log(`Loading graph from prop: ${props.graphId}`)
    // Set the graph ID in the store for prop-based access
    knowledgeGraphStore.setCurrentGraphId(props.graphId)
    loadGraph()
    return
  }

  // Auto-load if graph is already selected in store
  if (currentGraphId.value) {
    console.log('Auto-loading graph from store:', currentGraphId.value)
    loadGraph()
  }
}

onMounted(() => {
  console.log('GNewViewer mounted')

  // Load graph on mount
  handleGraphLoad()

  // Add keyboard listener for mobile menu
  document.addEventListener('keydown', handleEscKey)
})

// Watch for route changes to handle navigation within the same component
watch(
  () => route.query.graphId,
  (newGraphId) => {
    console.log('GNewViewer: Route graphId changed to:', newGraphId)
    if (newGraphId) {
      knowledgeGraphStore.setCurrentGraphId(newGraphId)
      loadGraph()
    }
  },
  { immediate: false },
)

// Watch for store changes as backup
watch(
  () => knowledgeGraphStore.currentGraphId,
  (newGraphId) => {
    console.log('GNewViewer: Store graphId changed to:', newGraphId)
    if (newGraphId && newGraphId !== currentGraphId.value) {
      loadGraph()
    }
  },
  { immediate: false },
)

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscKey)
  document.body.style.overflow = '' // Restore body scroll on component unmount
})

// Close mobile menu on ESC key
const handleEscKey = (event) => {
  if (
    event.key === 'Escape' &&
    showMobileMenu.value &&
    userStore.loggedIn &&
    (userStore.role === 'Superadmin' || userStore.role === 'Admin')
  ) {
    closeMobileMenu()
  }
}

// ===================================
// REORDERING SYSTEM (copied from GraphViewer)
// ===================================

const moveNodeUp = async (node) => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  const sortedNodes = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentIndex = sortedNodes.findIndex((n) => n.id === node.id)

  if (currentIndex > 0) {
    // Swap orders with the node above
    const nodeAbove = sortedNodes[currentIndex - 1]
    const tempOrder = node.order
    node.order = nodeAbove.order
    nodeAbove.order = tempOrder

    // Re-sort and update
    await saveNodeOrder()
  }
}

const moveNodeDown = async (node) => {
  const visibleNodes = graphData.value.nodes.filter((n) => n.visible !== false)
  const sortedNodes = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
  const currentIndex = sortedNodes.findIndex((n) => n.id === node.id)

  if (currentIndex < sortedNodes.length - 1) {
    // Swap orders with the node below
    const nodeBelow = sortedNodes[currentIndex + 1]
    const tempOrder = node.order
    node.order = nodeBelow.order
    nodeBelow.order = tempOrder

    // Re-sort and update
    await saveNodeOrder()
  }
}

const saveNodeOrder = async () => {
  try {
    // If called from reorder modal, update main graph data with reordered nodes
    if (isReorderModalOpen.value && reorderableNodes.value.length > 0) {
      // Update the order values in the main graph data
      reorderableNodes.value.forEach((reorderedNode, index) => {
        const originalNode = graphData.value.nodes.find((n) => n.id === reorderedNode.id)
        if (originalNode) {
          originalNode.order = index + 1
        }
      })
    }

    // Sort main graph data
    graphData.value.nodes.sort((a, b) => (a.order || 0) - (b.order || 0))

    // Save to backend using same API as GraphViewer
    const apiUrl = getApiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory')
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: knowledgeGraphStore.currentGraphId,
        graphData: graphData.value,
        override: true,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to save node order.')
    }

    await response.json()
    knowledgeGraphStore.updateGraphFromJson(graphData.value)

    console.log('✅ Node order saved successfully')
    statusMessage.value = 'Node order updated'

    // Close reorder modal if open
    if (isReorderModalOpen.value) {
      closeReorderModal()
    }

    setTimeout(() => {
      statusMessage.value = ''
    }, 2000)
  } catch (error) {
    console.error('❌ Error saving node order:', error)
    statusMessage.value = 'Failed to save node order'
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  }
}

// Open reorder modal
const openReorderModal = () => {
  console.log('🔄 Opening reorder modal')

  // Prepare reorderable nodes from visible nodes
  const visibleNodes = graphData.value.nodes.filter((node) => node.visible !== false)
  reorderableNodes.value = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))

  // Open the modal
  isReorderModalOpen.value = true
}

// Close reorder modal
const closeReorderModal = () => {
  isReorderModalOpen.value = false
  draggedNodeId.value = null
  draggedFromIndex.value = null
  reorderableNodes.value = []
}

// Drag and drop functions for reorder modal
const onDragStart = (event, nodeId) => {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/html', event.target.outerHTML)

  draggedNodeId.value = nodeId
  draggedFromIndex.value = reorderableNodes.value.findIndex((node) => node.id === nodeId)

  event.target.style.opacity = '0.5'
}

const onDragEnd = (event) => {
  event.target.style.opacity = '1'
}

const onDrop = (event, targetNodeId) => {
  event.preventDefault()

  if (!draggedNodeId.value || draggedNodeId.value === targetNodeId) return

  const draggedFromIdx = draggedFromIndex.value
  const draggedToIdx = reorderableNodes.value.findIndex((node) => node.id === targetNodeId)

  if (draggedFromIdx === -1 || draggedToIdx === -1) return

  // Remove the dragged node from its original position
  const draggedNode = reorderableNodes.value.splice(draggedFromIdx, 1)[0]

  // Insert it at the new position
  reorderableNodes.value.splice(draggedToIdx, 0, draggedNode)

  // Update order values
  reorderableNodes.value.forEach((node, index) => {
    node.order = index + 1
  })

  console.log('🔄 Nodes reordered via drag and drop')
}

const onDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

// Update node position in reorder modal
const updateNodePosition = (nodeId, newPosition) => {
  const nodeIndex = reorderableNodes.value.findIndex((node) => node.id === nodeId)
  if (nodeIndex === -1) return

  const targetPosition = Math.max(1, Math.min(newPosition, reorderableNodes.value.length))
  const node = reorderableNodes.value[nodeIndex]

  // Remove node from current position
  reorderableNodes.value.splice(nodeIndex, 1)

  // Insert at new position (subtract 1 for 0-based index)
  reorderableNodes.value.splice(targetPosition - 1, 0, node)

  // Update all order values
  reorderableNodes.value.forEach((n, index) => {
    n.order = index + 1
  })
}

// Reset order to original state
const resetOrder = () => {
  const visibleNodes = graphData.value.nodes.filter((node) => node.visible !== false)
  reorderableNodes.value = visibleNodes.sort((a, b) => (a.order || 0) - (b.order || 0))
}

// ===================================
// NODE CONTROL HANDLERS (for GNewNodeControlBar)
// ===================================

const handleFormatNode = (node) => {
  console.log('🤖 Format by AI requested for node:', node.id)
  statusMessage.value = 'AI formatting feature coming soon'
  setTimeout(() => {
    statusMessage.value = ''
  }, 2000)
}

const handleQuickFormat = (node, formatType) => {
  console.log('📝 Quick format requested:', formatType, 'for node:', node.id)

  if (formatType === 'add_work_notes') {
    // Add work note template to the node
    const workNoteTemplate = "\n\n[WNOTE | Cited='Your Name']\nAdd your work note here\n[END WNOTE]"

    // Add to node content
    if (node.info) {
      node.info += workNoteTemplate
    } else {
      node.info = workNoteTemplate.trim()
    }

    // Save the changes
    saveNodeOrder()
    statusMessage.value = 'Work note template added to node'
    setTimeout(() => {
      statusMessage.value = ''
    }, 2000)
  }
}

const handleCopyNode = (node) => {
  console.log('📋 Copy node requested for:', node.id)
  statusMessage.value = 'Node copy feature coming soon'
  setTimeout(() => {
    statusMessage.value = ''
  }, 2000)
}
</script>

<style scoped>
.gnew-viewer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.gnew-content {
  transition: margin-left 0.3s ease;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Public Viewer Styles - Ultra Clean */
.public-viewer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.public-viewer .graph-content {
  background: transparent;
  border-radius: 0;
  padding: 20px;
  box-shadow: none;
  margin-bottom: 0;
}

.public-viewer .nodes-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.public-viewer .loading-state,
.public-viewer .empty-state {
  text-align: center;
  padding: 40px 20px;
}

.public-viewer .empty-state h4 {
  color: #6c757d;
  margin-bottom: 10px;
}

/* Admin Viewer Styles - Full Interface */
.admin-viewer {
  /* Inherits from .gnew-viewer styles */
  transition: margin-left 0.3s ease;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.gnew-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.gnew-header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
}

.gnew-subtitle {
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

/* Status Bar styles moved to GraphStatusBar.vue component */

.bg-success {
  background-color: #198754;
}

.bg-warning {
  background-color: #ffc107;
  color: #000;
}

.imagequote-type-selection {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.imagequote-type-selection .form-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.imagequote-type-selection .form-check:hover {
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
}

.imagequote-type-selection .form-check-input:checked + .form-check-label {
  color: #007bff;
}

.imagequote-type-selection .form-check-input:checked {
  background-color: #007bff;
  border-color: #007bff;
}

.imagequote-type-selection .form-check:has(.form-check-input:checked) {
  border-color: #007bff;
  background: #f0f8ff;
}

.imagequote-type-selection .form-check-label {
  flex: 1;
  margin: 0;
  cursor: pointer;
}

.imagequote-type-selection .form-check-input {
  margin: 0;
  flex-shrink: 0;
}

.status-message {
  padding: 0.75rem 1rem;
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
}

.action-toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.loading-state {
  text-align: center;
  padding: 40px;
}

.graph-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

.nodes-container {
  margin-top: 20px;
  max-width: 1200px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}

.node-comments-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.graph-social-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid #e9ecef;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.graph-chat-section {
  margin-top: 30px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.graph-social-public {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
}

.nodes-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.node-preview-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
}

.node-preview-card h6 {
  margin: 0 0 8px 0;
  color: #495057;
  font-weight: 600;
}

.node-type {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
}

.node-info {
  color: #6c757d;
  line-height: 1.4;
}

.more-nodes {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9ecef;
  border: 2px dashed #ced4da;
  border-radius: 6px;
  padding: 20px;
  color: #6c757d;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 40px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 30px;
}

.dev-info {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 8px;
  padding: 20px;
}

.dev-info h5 {
  margin: 0 0 15px 0;
  color: #0056b3;
}

.dev-info ul {
  margin: 0;
  padding-left: 20px;
}

.dev-info li {
  margin-bottom: 8px;
  color: #495057;
}

/* Modal Overlay */
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
  backdrop-filter: blur(4px);
}

/* Node Edit Modal Styles */
.node-edit-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 1200px;
  width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.node-content-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}

.edit-preview-container {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
  margin-top: 10px;
}

.preview-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #dee2e6;
}

/* Color Picker Styles */
.color-picker-container {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.color-picker-input {
  width: 60px;
  height: 40px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.color-picker-input:hover {
  border-color: #007bff;
}

.color-hex-display {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  background: white;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  min-width: 80px;
  text-align: center;
}

.quick-colors {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-colors-label {
  font-size: 14px;
  font-weight: 500;
  color: #6c757d;
  margin-right: 8px;
}

.quick-color-btn {
  width: 32px;
  height: 32px;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.quick-color-btn:hover {
  border-color: #007bff;
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.quick-color-btn:active {
  transform: scale(0.95);
}

/* Special styling for white color button */
.quick-color-btn[style*='ffffff'] {
  border-color: #adb5bd;
}

.quick-color-btn[style*='ffffff']:hover {
  border-color: #007bff;
}

/* Palette Toggle */
.palette-toggle {
  margin-top: 15px;
  text-align: center;
  border-top: 1px solid #dee2e6;
  padding-top: 15px;
}

.palette-toggle button {
  transition: all 0.2s ease;
}

.palette-toggle button:hover {
  transform: translateY(-1px);
}

/* Expanded Color Categories */
.expanded-colors {
  margin-top: 20px;
  border-top: 1px solid #dee2e6;
  padding-top: 20px;
  max-height: 400px;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 8px;
}

.color-category {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.category-title {
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.color-category-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  align-items: center;
}

/* Special layout for the Color Wheel Spectrum */
.color-category:has(.category-title:contains('Color Wheel Spectrum')) .color-category-grid,
.color-category:nth-child(9) .color-category-grid {
  grid-template-columns: repeat(11, 1fr);
  gap: 4px;
}

.category-color-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-color-btn:hover {
  border-color: #007bff;
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
  z-index: 10;
}

.category-color-btn:active {
  transform: scale(1.05);
}

/* Special handling for light colors to ensure visibility */
.category-color-btn[style*='ffffff'],
.category-color-btn[style*='FFFFFF'],
.category-color-btn[style*='FFFFE0'],
.category-color-btn[style*='FFFDD0'],
.category-color-btn[style*='FFCBA4'],
.category-color-btn[style*='FFB6C1'],
.category-color-btn[style*='ADD8E6'],
.category-color-btn[style*='E6E6FA'],
.category-color-btn[style*='DDA0DD'] {
  border-color: #adb5bd;
}

.category-color-btn[style*='ffffff']:hover,
.category-color-btn[style*='FFFFFF']:hover,
.category-color-btn[style*='FFFFE0']:hover,
.category-color-btn[style*='FFFDD0']:hover,
.category-color-btn[style*='FFCBA4']:hover,
.category-color-btn[style*='FFB6C1']:hover,
.category-color-btn[style*='ADD8E6']:hover,
.category-color-btn[style*='E6E6FA']:hover,
.category-color-btn[style*='DDA0DD']:hover {
  border-color: #007bff;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .color-category-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .category-color-btn {
    width: 35px;
    height: 35px;
  }
}

/* Image Insert Styles */
.image-insert-container {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  text-align: center;
}

.image-insert-container .btn {
  font-size: 14px;
  font-weight: 500;
  padding: 10px 20px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.image-insert-container .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

/* IMAGEQUOTE Creator Modal */
.imagequote-creator-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.imagequote-creator-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px 15px;
  border-bottom: 1px solid #dee2e6;
}

.imagequote-creator-modal .modal-body {
  padding: 25px;
}

.imagequote-creator-modal .modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 15px 25px 25px;
  border-top: 1px solid #dee2e6;
}

.imagequote-creator-modal .btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.imagequote-creator-modal .form-group {
  margin-bottom: 20px;
}

.imagequote-creator-modal .form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

/* IMAGEQUOTES Display */
.imagequotes-section {
  background: white;
  border-radius: 8px;
  padding: 25px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.imagequotes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 25px;
  margin-top: 20px;
}

.imagequote-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
}

.imagequote-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.imagequote-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Image Selection Area */
.image-selection-area {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 15px;
  background-color: #f8f9fa;
  margin-bottom: 15px;
}

.current-image-preview {
  display: flex;
  align-items: center;
  gap: 15px;
}

.current-image-preview img {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #28a745;
}

.image-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-image-buttons {
  text-align: center;
  padding: 20px;
}

.add-image-buttons .btn {
  margin-bottom: 10px;
}

.add-image-buttons small {
  display: block;
  margin-top: 5px;
}

/* Image Modal */
.image-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.image-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px 15px;
  border-bottom: 1px solid #dee2e6;
}

.image-modal .modal-body {
  padding: 25px;
}

.image-modal .modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 15px 25px 25px;
  border-top: 1px solid #dee2e6;
}

.image-modal .btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.image-modal .btn-close:hover {
  background-color: #f8f9fa;
}

/* Image Source Section */
.image-source-section {
  margin-top: 15px;
}

.image-source-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.btn-source {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 8px;
  border: 2px solid;
  border-radius: 8px;
  transition: all 0.2s;
  text-decoration: none;
  font-size: 0.9rem;
}

.btn-source:hover {
  transform: translateY(-2px);
}

.btn-source.active {
  background-color: #e7f3ff;
  border-color: #007bff;
}

.btn-source i {
  font-size: 1.1rem;
}

.url-input-section {
  margin-top: 15px;
  padding: 15px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.url-input-group {
  display: flex;
  gap: 10px;
}

.url-input-group input {
  flex: 1;
}

.url-preview {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  text-align: center;
}

.url-preview img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: 8px;
  margin-bottom: 10px;
}

.clipboard-paste-area {
  margin-top: 15px;
  padding: 20px;
  border: 2px dashed #007bff;
  border-radius: 8px;
  text-align: center;
  background-color: #f8f9ff;
  transition: all 0.2s;
}

.clipboard-paste-area:hover {
  border-color: #0056b3;
  background-color: #e7f3ff;
}

.paste-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
}

.paste-icon {
  font-size: 1.5rem;
}

.paste-text {
  font-size: 0.85rem;
}

.pasted-image-preview {
  margin-top: 15px;
  padding: 15px;
  background-color: #e8f5e8;
  border-radius: 8px;
  border: 2px solid #28a745;
}

.pasted-preview-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.pasted-preview-container img {
  width: 80px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid #28a745;
}

.pasted-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Preview Section */
.preview-section {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.preview-section h5 {
  margin: 0 0 15px 0;
  color: #333;
  font-weight: 600;
}

/* Formatted Definition Section */
.formatted-definition-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #dee2e6;
}

.formatted-definition-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  background-color: #2d3748;
  color: #e2e8f0;
  border: 1px solid #4a5568;
  border-radius: 6px;
  resize: vertical;
  min-height: 80px;
}

.formatted-definition-textarea:focus {
  background-color: #2d3748;
  color: #e2e8f0;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.formatted-definition-textarea::placeholder {
  color: #a0aec0;
}

/* Created Quote Definition */
.created-quote-definition {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.created-quote-definition .form-label {
  font-size: 0.9rem;
  margin-bottom: 5px;
}

.created-quote-definition .formatted-definition-textarea {
  min-height: 60px;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .gnew-viewer {
    padding: 15px;
  }

  .public-viewer {
    padding: 10px;
  }

  .public-viewer .graph-content {
    padding: 15px;
  }

  .public-viewer .loading-state,
  .public-viewer .empty-state {
    padding: 20px 15px;
  }

  .gnew-header h1 {
    font-size: 2rem;
  }

  .action-toolbar {
    flex-direction: column;
  }

  .nodes-preview {
    grid-template-columns: 1fr;
  }

  .imagequotes-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .imagequote-creator-modal,
  .image-modal {
    width: 95%;
    margin: 20px;
  }

  .current-image-preview {
    flex-direction: column;
    text-align: center;
  }

  .current-image-preview img {
    width: 100px;
    height: 80px;
  }

  .image-actions {
    flex-direction: row;
    justify-content: center;
  }

  .image-source-options {
    grid-template-columns: 1fr;
  }

  .url-input-group {
    flex-direction: column;
  }

  .pasted-preview-container {
    flex-direction: column;
    text-align: center;
  }

  .pasted-actions {
    flex-direction: row;
    justify-content: center;
  }
}

/* Portfolio Image Modal */
.portfolio-image-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  max-width: 1000px;
  width: 95%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.portfolio-image-modal .modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 25px;
}

.quality-controls {
  background: #f8f9fa;
  border-color: #e9ecef;
}

.quality-controls h6 {
  color: #495057;
  font-weight: 600;
}

.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.portfolio-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
}

.portfolio-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  border-color: #6f42c1;
}

.portfolio-thumb {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.portfolio-caption {
  font-size: 0.9em;
  padding: 8px;
  text-align: center;
  word-break: break-all;
  background: #f8f9fa;
  color: #495057;
}

@media (max-width: 768px) {
  .portfolio-image-modal {
    width: 98%;
    max-height: 95vh;
  }

  .portfolio-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .portfolio-thumb {
    height: 100px;
  }
}

/* Quote Suggestions Styles */
.quote-input-section {
  position: relative;
}

.quote-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.quote-suggestions {
  margin-top: 15px;
  padding: 15px;
  background-color: #f8f9ff;
  border: 1px solid #e3e8ff;
  border-radius: 8px;
}

.quote-suggestions h6 {
  margin: 0 0 12px 0;
  color: #4c51bf;
  font-weight: 600;
  font-size: 0.95rem;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suggestion-item {
  padding: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-item:hover {
  border-color: #4c51bf;
  background-color: #faf5ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(76, 81, 191, 0.1);
}

.suggestion-text {
  font-weight: 500;
  color: #2d3748;
  line-height: 1.4;
  margin-bottom: 4px;
}

.suggestion-citation {
  font-style: italic;
  color: #4a5568;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.suggestion-source {
  font-size: 0.8rem;
  color: #718096;
}

@media (max-width: 768px) {
  .quote-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .suggestion-item {
    padding: 10px;
  }

  .suggestion-text {
    font-size: 0.9rem;
  }
}

/* Autocomplete Styles */
.textarea-container {
  position: relative;
}

.autocomplete-dropdown {
  position: absolute;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 350px;
  max-width: 500px;
  max-height: 450px; /* Increased height for more items */
  overflow-y: auto;
  font-size: 14px; /* Slightly smaller font for more items */
}

.autocomplete-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.autocomplete-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.autocomplete-hint {
  font-size: 0.8rem;
  opacity: 0.9;
}

.autocomplete-item {
  padding: 10px 16px; /* Slightly reduced padding */
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 3px; /* Reduced gap */
}

.autocomplete-item:hover,
.autocomplete-item-active {
  background: #f8f9ff;
  border-left: 4px solid #667eea;
}

.autocomplete-item:last-child {
  border-bottom: none;
  border-radius: 0 0 8px 8px;
}

.element-trigger {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  color: #667eea;
  background: #f8f9ff;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  max-width: fit-content;
}

.element-description {
  font-size: 0.85rem;
  color: #4a5568;
  line-height: 1.3;
}

.element-category {
  font-size: 0.75rem;
  color: #718096;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .autocomplete-dropdown {
    min-width: 280px;
    max-width: 90vw;
  }

  .autocomplete-header {
    padding: 10px 12px;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .autocomplete-item {
    padding: 10px 12px;
  }

  .element-trigger {
    font-size: 0.8rem;
  }

  .element-description {
    font-size: 0.8rem;
  }
}

/* Mobile navigation styles moved to main.css */

/* Template Info Styles */
.template-info {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 15px;
}

.template-info p {
  margin: 0;
  font-size: 14px;
}

/* Bootstrap Override for FLEXBOX-GRID */
.gnew-viewer .flexbox-container[style*='display: grid'],
.gnew-viewer .flexbox-container[style*='grid-template-columns'],
.gnew-viewer div[style*='display: grid'] {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 20px !important;
  justify-items: center !important;
  align-items: start !important;
  max-width: 1000px !important;
  margin: 25px auto !important;
  justify-content: center !important;
  width: 100% !important;
  grid-auto-flow: row !important;
  grid-auto-rows: minmax(120px, auto) !important;
  flex-wrap: unset !important;
  flex-direction: unset !important;
  flex: unset !important;
  flex-basis: unset !important;
  flex-grow: unset !important;
  flex-shrink: unset !important;
}

.gnew-viewer .flexbox-container[style*='display: grid'] .grid-item,
.gnew-viewer .flexbox-container[style*='grid-template-columns'] .grid-item,
.gnew-viewer div[style*='display: grid'] .grid-item {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 120px !important;
  flex: unset !important;
  flex-basis: unset !important;
  flex-grow: unset !important;
  flex-shrink: unset !important;
}

.gnew-viewer .flexbox-container[style*='display: grid'] .grid-item img,
.gnew-viewer .flexbox-container[style*='grid-template-columns'] .grid-item img,
.gnew-viewer div[style*='display: grid'] .grid-item img {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

/* Mobile responsive for grid */
@media (max-width: 768px) {
  .gnew-viewer .flexbox-container[style*='display: grid'],
  .gnew-viewer .flexbox-container[style*='grid-template-columns'],
  .gnew-viewer div[style*='display: grid'] {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 15px !important;
    max-width: 600px !important;
  }

  .gnew-viewer .flexbox-container[style*='display: grid'] .grid-item,
  .gnew-viewer .flexbox-container[style*='grid-template-columns'] .grid-item,
  .gnew-viewer div[style*='display: grid'] .grid-item {
    width: 100% !important;
    height: auto !important;
  }
}

/* Bootstrap Grid for FLEXBOX-GRID */
.gnew-viewer .flexbox-container.row {
  display: flex !important;
  flex-wrap: wrap !important;
  margin: 25px auto !important;
  max-width: 1000px !important;
  width: 100% !important;
}

.gnew-viewer .flexbox-container.row .col-sm-4,
.gnew-viewer .flexbox-container.row .col-6 {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 10px !important;
  text-align: center !important;
}

.gnew-viewer .flexbox-container.row .col-sm-4 img,
.gnew-viewer .flexbox-container.row .col-6 img {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  margin: 0 auto !important;
}

.gnew-viewer .flexbox-container.row .col-4 {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 10px !important;
  text-align: center !important;
}

.gnew-viewer .flexbox-container.row .col-4 img {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  margin: 0 auto !important;
}

/* PURE CSS GRID STYLES FOR FLEXBOX-GRID */
.gnew-viewer .flexbox-container[style*='display: grid'] {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 20px !important;
  max-width: 1000px !important;
  margin: 25px auto !important;
  justify-items: center !important;
  align-items: start !important;
}

.gnew-viewer .flexbox-container[style*='display: grid'] .grid-item {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
  width: 100% !important;
}

.gnew-viewer .flexbox-container[style*='display: grid'] .grid-item img {
  display: block !important;
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  margin: 0 auto !important;
}

/* Mobile responsive for CSS Grid */
@media (max-width: 768px) {
  .gnew-viewer .flexbox-container[style*='display: grid'] {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 15px !important;
  }
}

@media (max-width: 480px) {
  .gnew-viewer .flexbox-container[style*='display: grid'] {
    grid-template-columns: 1fr !important;
    gap: 10px !important;
  }
}

/* ===================================
   REORDER MODAL STYLES
   =================================== */
.reorder-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.reorder-modal .modal-header {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reorder-modal .modal-header h4 {
  margin: 0;
  color: #2c3e50;
  font-weight: 600;
}

.reorder-modal .modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.reorder-instructions {
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.reorder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reorder-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: grab;
}

.reorder-item:hover {
  background: #e9ecef;
  border-color: #007bff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
}

.reorder-item:active {
  cursor: grabbing;
}

.reorder-item.dragging {
  opacity: 0.5;
  transform: rotate(2deg);
}

.node-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.node-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

.node-name {
  font-weight: 500;
  color: #2c3e50;
}

.node-type {
  font-size: 12px;
  font-style: italic;
}

.position-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 15px;
}

.position-label {
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
}

.position-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  text-align: center;
  font-size: 12px;
}

.position-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.position-total {
  font-size: 12px;
  color: #6c757d;
}

.drag-handle {
  color: #6c757d;
  cursor: grab;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.drag-handle:hover {
  color: #007bff;
  background: rgba(0, 123, 255, 0.1);
}

.reorder-modal .modal-footer {
  padding: 20px;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.reorder-modal .btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}

.reorder-modal .btn-primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.reorder-modal .btn-primary:hover {
  background: #0056b3;
  border-color: #0056b3;
  transform: translateY(-1px);
}

.reorder-modal .btn-secondary {
  background: #6c757d;
  color: white;
  border-color: #6c757d;
}

.reorder-modal .btn-secondary:hover {
  background: #545b62;
  border-color: #545b62;
}

.reorder-modal .btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border-color: #6c757d;
}

.reorder-modal .btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .reorder-modal {
    width: 95%;
    max-height: 90vh;
  }

  .position-controls {
    flex-direction: column;
    gap: 4px;
    margin-right: 10px;
  }

  .position-label {
    display: none;
  }

  .reorder-item {
    padding: 10px;
  }

  .node-info {
    gap: 8px;
  }

  .node-icon {
    font-size: 16px;
    width: 20px;
  }
}
</style>
