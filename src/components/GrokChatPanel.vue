<template>
  <div class="grok-chat-panel" :class="{ collapsed: isCollapsed }">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-title">
        <img :src="providerMeta(provider).icon || grokIcon" :alt="providerMeta(provider).label" class="icon-img" />
        <h3>{{ providerMeta(provider).label }} Assistant</h3>
      </div>
      <div class="header-actions">
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
        <button
          @click="backgroundImageUrl ? clearBackgroundImage() : openImageSelector()"
          class="btn btn-sm btn-ghost"
          :title="backgroundImageUrl ? 'Clear background image' : 'Change background image'"
        >
          {{ backgroundImageUrl ? '🗑️' : '🎨' }}
        </button>
        <button
          @click="toggleCollapse"
          class="btn btn-sm btn-ghost"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        >
          {{ isCollapsed ? '◀' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Chat Content -->
    <div
      v-if="!isCollapsed"
      class="chat-content"
      :style="backgroundImageUrl ? { backgroundImage: `url(${backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}"
    >
      <!-- Context Toggle -->
      <div class="context-controls">
        <div class="context-row">
          <label class="context-toggle">
            <input type="checkbox" v-model="useGraphContext" />
            <img :src="graphContextIcon" alt="Graph context" class="context-icon" />
            <span>Use Graph Context</span>
          </label>
          <span v-if="useGraphContext" class="context-indicator">
            {{ graphContextSummary }}
          </span>
        </div>
        <div class="context-row">
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' && provider !== 'grok' }">
            <input
              type="checkbox"
              v-model="useProffTools"
              :disabled="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'"
            />
            <span>🏢 Proff Selskapsoppslag</span>
          </label>
          <span v-if="useProffTools && (provider === 'openai' || provider === 'claude' || provider === 'grok')" class="context-indicator">
            AI kan slå opp norske selskaper
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'" class="context-indicator muted">
            Kun OpenAI/Claude/Grok
          </span>
        </div>
        <div class="context-row">
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' && provider !== 'grok' }">
            <input
              type="checkbox"
              v-model="useSourcesTools"
              :disabled="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'"
            />
            <span>📰 Norske Kilder</span>
          </label>
          <span v-if="useSourcesTools && (provider === 'openai' || provider === 'claude' || provider === 'grok')" class="context-indicator">
            Regjeringen, SSB, NRK, Forskning.no, miljøorg.
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'" class="context-indicator muted">
            Kun OpenAI/Claude/Grok
          </span>
        </div>
        <div v-if="canUseTemplateTools" class="context-row">
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' && provider !== 'grok' }">
            <input
              type="checkbox"
              v-model="useTemplateTools"
              :disabled="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'"
            />
            <span>🧩 Node Template Tools</span>
          </label>
          <span v-if="useTemplateTools && (provider === 'openai' || provider === 'claude' || provider === 'grok')" class="context-indicator">
            AI kan sette inn godkjente node-maler
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude' && provider !== 'grok'" class="context-indicator muted">
            Kun OpenAI/Claude/Grok
          </span>
        </div>
        <div class="context-row">
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' }">
            <input
              type="checkbox"
              v-model="useWebSearch"
              :disabled="provider !== 'openai' && provider !== 'claude'"
            />
            <span>🌐 Web Search (Perplexity)</span>
          </label>
          <span v-if="useWebSearch && (provider === 'openai' || provider === 'claude')" class="context-indicator">
            AI will suggest search queries to run via Perplexity
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude'" class="context-indicator muted">
            Kun OpenAI/Claude
          </span>
        </div>
        <!-- Suggested Web Search Queries from AI -->
        <div v-if="suggestedWebSearches.length > 0" class="suggested-web-searches">
          <div class="web-search-label">🔍 Suggested searches:</div>
          <div class="web-search-chips">
            <button
              v-for="(search, idx) in suggestedWebSearches"
              :key="idx"
              class="web-search-chip"
              type="button"
              @click="runPerplexitySearch(search)"
              :disabled="isLoading"
            >
              {{ search }}
            </button>
          </div>
        </div>
        <div
          v-if="hasSelectionContext"
          class="context-row selection-context"
          :class="{ active: useSelectionContext }"
        >
          <label class="context-toggle">
            <input type="checkbox" v-model="useSelectionContext" />
            <span>Focus on Highlighted Text</span>
          </label>
          <span v-if="useSelectionContext" class="context-indicator selection">
            <strong>{{ selectionContextLabel }}:</strong> {{ selectionContextSummary }}
          </span>
        </div>
        <div v-else class="selection-hint">
          {{ isCanvasContext ? 'Select a node in the canvas to share it with the assistant.' : 'Highlight text in the graph to share it with the assistant.' }}
        </div>
        <div class="context-row">
          <label class="context-toggle">
            <input type="checkbox" v-model="useRawJsonMode" />
            <span>📋 Raw JSON Mode</span>
          </label>
          <span v-if="useRawJsonMode" class="context-indicator">
            AI can analyze raw database JSON with metadata
          </span>
          <button
            v-if="props.graphData"
            class="btn btn-outline-secondary btn-sm"
            type="button"
            @click="showRawJsonModal = true"
            title="View raw JSON data with metadata"
          >
            📊 View JSON
          </button>
        </div>
        <div class="context-row api-lookup-toggle">
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="toggleApiLookup">
            🔎 API Lookup
          </button>
          <span v-if="apiSearchLoading" class="context-indicator">Searching...</span>
          <span v-else-if="apiSearchError" class="context-indicator muted">{{ apiSearchError }}</span>
        </div>
        <div class="context-row">
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            @click="openHtmlImportModal"
            :disabled="!canCreateGraph"
            title="Paste HTML and create a new knowledge graph"
          >
            📥 Import HTML
          </button>
          <span v-if="!canCreateGraph" class="context-indicator muted">
            Logg inn for å opprette graf
          </span>
        </div>
        <div v-if="apiLookupOpen" class="api-lookup-panel">
          <div class="api-lookup-input">
            <input
              v-model="apiSearchQuery"
              type="text"
              class="form-control form-control-sm"
              placeholder="Search APIs (e.g., graph, album, image)"
              @keydown.enter.prevent="runApiSearch"
            />
            <button class="btn btn-primary btn-sm" type="button" @click="runApiSearch" :disabled="!apiSearchQuery.trim()">
              Search
            </button>
          </div>
          <div v-if="apiSearchResults.length" class="api-lookup-results">
            <button
              v-for="api in apiSearchResults"
              :key="api.slug"
              class="api-lookup-item"
              type="button"
              @click="insertApiSnippet(api)"
              :title="api.description"
            >
              <span class="api-lookup-icon" :style="{ color: api.color || '#6b7280' }">
                {{ api.icon || '🔌' }}
              </span>
              <span class="api-lookup-name">{{ api.name }}</span>
              <span class="api-lookup-signature">{{ api.function_signature || api.function_name }}</span>
            </button>
          </div>
          <div v-else-if="apiSearchQuery.trim() && !apiSearchLoading" class="api-lookup-empty">
            No APIs found.
          </div>
        </div>
        <!-- Suggested Questions based on selection -->
        <div v-if="suggestedQuestions.length > 0" class="suggested-questions">
          <div class="suggested-questions-chips">
            <button
              v-for="(question, idx) in suggestedQuestions"
              :key="idx"
              class="suggested-question-chip"
              type="button"
              @click="askSuggestedQuestion(question.query)"
              :title="question.description"
            >
              {{ question.icon }} {{ question.label }}
            </button>
          </div>
        </div>
        <div
          v-if="canPersistHistory"
          class="history-status"
          :class="{ loading: historyLoading, error: historyError }"
        >
          <span v-if="historyLoading">
            💾 Syncing chat history...
          </span>
          <span v-else-if="historyError">
            ⚠️ {{ historyError }}
            <button class="btn btn-link btn-sm" type="button" @click="retryHistoryLoad">
              Retry
            </button>
          </span>
          <span v-else-if="historyLastLoaded">
            ✅ History synced at {{ historyLastLoadedLabel }}
          </span>
          <span v-else>
            💾 History will be saved for this graph.
          </span>
        </div>
        <div v-if="canPersistHistory" class="session-picker">
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            @click="toggleSessionList"
          >
            📁 Sessions ({{ availableSessions.length }})
          </button>
          <div v-if="sessionListOpen" class="session-dropdown">
            <div class="session-dropdown__actions">
              <button
                class="btn btn-primary btn-sm"
                type="button"
                @click="startNewChatSession"
                :disabled="historyLoading || renameSaving"
              >
                ➕ New Session
              </button>
            </div>
            <div v-if="sessionsLoading" class="session-dropdown__state">Loading sessions...</div>
            <div v-else-if="sessionsError" class="session-dropdown__state error">
              {{ sessionsError }}
              <button class="btn btn-link btn-sm" type="button" @click="fetchChatSessions">Retry</button>
            </div>
            <div v-else-if="!availableSessions.length" class="session-dropdown__state">
              No saved sessions yet.
            </div>
            <div v-else-if="deleteSessionError" class="session-dropdown__state error">
              {{ deleteSessionError }}
            </div>
            <ul v-else class="session-list">
              <li
                v-for="session in availableSessions"
                :key="session.id"
                :class="{ active: session.id === chatSessionId }"
              >
                <div v-if="renamingSessionId === session.id" class="session-rename-form">
                  <input
                    class="session-rename-input"
                    type="text"
                    v-model="renameInput"
                    maxlength="140"
                    placeholder="Session title"
                    :disabled="renameSaving"
                  />
                  <div class="session-rename-actions">
                    <button
                      class="btn btn-primary btn-sm"
                      type="button"
                      @click="confirmRenameSession(session.id)"
                      :disabled="renameSaving"
                    >
                      {{ renameSaving ? 'Saving...' : 'Save' }}
                    </button>
                    <button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      @click="cancelRenameSession"
                      :disabled="renameSaving"
                    >
                      Cancel
                    </button>
                  </div>
                  <div v-if="renameError" class="session-rename-error">{{ renameError }}</div>
                </div>
                <template v-else>
                  <div class="session-list__info">
                    <strong>{{ session.title || 'Untitled session' }}</strong>
                    <small>Updated {{ formatSessionTimestamp(session.updatedAt) }}</small>
                  </div>
                  <div class="session-list__actions">
                    <button
                      class="btn btn-link btn-sm"
                      type="button"
                      :disabled="session.id === chatSessionId || historyLoading"
                      @click="selectChatSession(session.id)"
                    >
                      {{ session.id === chatSessionId ? 'Current' : 'Open' }}
                    </button>
                    <button
                      class="btn btn-link btn-sm"
                      type="button"
                      @click="beginRenameSession(session)"
                      :disabled="renameSaving"
                    >
                      Rename
                    </button>
                    <button
                      class="btn btn-link btn-sm text-danger"
                      type="button"
                      :disabled="deletingSessionId === session.id"
                      @click="deleteChatSession(session)">
                      {{ deletingSessionId === session.id ? 'Deleting…' : 'Delete' }}
                    </button>
                  </div>
                </template>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          class="message"
          :class="message.role"
        >
          <div class="message-header">
            <div v-if="message.role === 'user'" class="message-avatar" :title="userStore.email || 'You'">
              <img
                v-if="userAvatarUrl"
                :src="userAvatarUrl"
                alt="You"
                class="message-avatar-img"
              />
              <span v-else class="message-avatar-initial">{{ userInitial }}</span>
            </div>
            <div v-else class="assistant-avatar" :title="providerMeta(message.provider || provider).label">
              <img
                v-if="providerMeta(message.provider || provider).icon"
                :src="providerMeta(message.provider || provider).icon"
                :alt="providerMeta(message.provider || provider).label"
                class="message-icon-img"
              />
              <span v-else class="assistant-avatar-initial">{{ providerMeta(message.provider || provider).initials }}</span>
            </div>
            <span class="message-role">{{ message.role === 'user' ? 'You' : providerMeta(message.provider || provider).label }}</span>
            <span v-if="message.usedProffAPI || message.proffData" class="proff-badge" title="Data hentet via Proff.no (Brønnøysundregistrene)">
              <img :src="proffIcon" alt="Proff" class="proff-badge-icon" />
            </span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div
            class="message-content"
            v-html="renderMarkdown(message.content)"
            @click="handleMessageContentClick($event)"
            @mouseover="handleMessageContentMouseOver($event)"
            @mouseout="handleMessageContentMouseOut($event)"
          ></div>
          <div v-if="isImageMessage(message)" class="message-image">
            <img
              :src="getMessageImageSrc(message)"
              alt="Generated image preview"
              class="message-image-preview"
              @load="markImageLoaded(message)"
              @error="markImageLoaded(message)"
            />
          </div>
          <div v-if="message.role === 'assistant'" class="message-actions">
            <button
              class="btn btn-link btn-sm insert-btn"
              type="button"
              @click="handleInsertMessage(message)"
            >
              {{ isImageMessage(message) ? 'Insert Image' : insertLabel }}
            </button>
            <button
              v-if="!isImageMessage(message) && isHtmlMessage(message)"
              class="btn btn-link btn-sm insert-btn"
              type="button"
              @click="insertAsHtml(message)"
            >
              Insert as HTML
            </button>
            <!-- Case Study Node Insert Buttons -->
            <button
              v-if="hasPersonData(message)"
              class="btn btn-link btn-sm case-study-btn"
              type="button"
              @click="insertAsNode(message, 'person-profile')"
              title="Sett inn som Person Profile node"
            >
              👤 Person
            </button>
            <button
              v-if="hasCompanyData(message)"
              class="btn btn-link btn-sm case-study-btn"
              type="button"
              @click="insertAsNode(message, 'company-card')"
              title="Sett inn som Company Card node"
            >
              🏢 Bedrift
            </button>
            <button
              v-if="hasNetworkData(message)"
              class="btn btn-link btn-sm case-study-btn"
              type="button"
              @click="insertAsNetwork(message)"
              title="Sett inn som Network diagram"
            >
              🕸️ Nettverk
            </button>
            <button
              v-if="canBatchGenerate(message)"
              class="btn btn-link btn-sm batch-btn"
              type="button"
              @click="openBatchGenerateModal()"
              title="Generer flere fulltext-noder basert på en mal og datatabell"
            >
              📦 Batch Generate
            </button>
            <button
              v-if="hasPersonConnectionsData(message)"
              class="btn btn-link btn-sm case-study-btn"
              type="button"
              @click="insertAsPersonNetwork(message)"
              title="Sett inn som nettverkskart med alle forbindelser"
            >
              🌐 Nettverkskart
            </button>
            <button
              v-if="hasPersonConnectionsData(message)"
              class="btn btn-link btn-sm case-study-btn case-graph-btn"
              type="button"
              @click="openCaseGraphDialog(message)"
              :disabled="message.caseGraphCreating"
              title="Opprett egen kunnskapsgraf fra nettverksdata (kan importeres som cluster i hoved-case)"
            >
              {{ message.caseGraphCreating ? '⏳ Oppretter...' : '📊 Opprett Case Graf' }}
            </button>
            <button
              v-if="hasNewsData(message)"
              class="btn btn-link btn-sm case-study-btn"
              type="button"
              @click="insertAsNode(message, 'news-feed')"
              title="Sett inn som News Feed node"
            >
              📰 Nyheter
            </button>
            <button
              class="btn btn-link btn-sm graph-btn"
              type="button"
              @click="startGraphProcessingFromMessage(message, index)"
              :disabled="isMessageGraphJobProcessing(message)"
            >
              {{ graphJobButtonLabel(message) }}
            </button>
            <button
              class="btn btn-link btn-sm advanced-graph-btn"
              type="button"
              @click="openAdvancedGraphModal(message, index)"
              :disabled="isMessageGraphJobProcessing(message)"
              title="Create graph with custom node template selection"
            >
              ⚙️ Advanced Graph Creation
            </button>
          </div>
        </div>

        <!-- Streaming Message -->
        <div v-if="isStreaming" class="message assistant streaming">
          <div class="message-header">
            <div class="assistant-avatar" :title="providerMeta(streamingProviderOverride || provider).label">
              <img
                v-if="providerMeta(streamingProviderOverride || provider).icon"
                :src="providerMeta(streamingProviderOverride || provider).icon"
                :alt="providerMeta(streamingProviderOverride || provider).label"
                class="message-icon-img"
              />
              <span v-else class="assistant-avatar-initial">{{ providerMeta(streamingProviderOverride || provider).initials }}</span>
            </div>
            <span class="message-role">{{ providerMeta(streamingProviderOverride || provider).label }}</span>
            <span class="streaming-indicator">
              <span class="spinner"></span> Thinking...
            </span>
          </div>
          <div
            class="message-content"
            v-html="renderMarkdown(streamingContent)"
            @mouseover="handleMessageContentMouseOver($event)"
            @mouseout="handleMessageContentMouseOut($event)"
          ></div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="message error">
          <div class="message-header">
            <span class="message-icon">⚠️</span>
            <span class="message-role">Error</span>
          </div>
          <div class="message-content">{{ errorMessage }}</div>
        </div>
      </div>

      <div
        v-if="citationPreview.visible"
        class="citation-preview"
        :style="citationPreview.style"
        @mouseenter="handleCitationPreviewEnter"
        @mouseleave="handleCitationPreviewLeave"
      >
        <div v-if="citationPreview.loading" class="citation-preview-loading">Loading source…</div>
        <div v-else-if="citationPreview.error" class="citation-preview-error">
          Could not load source preview.
        </div>
        <div v-else class="citation-preview-content">
          <div class="citation-preview-header">
            <span class="citation-preview-domain">{{ citationPreview.domain }}</span>
          </div>
          <div class="citation-preview-body">
            <img
              v-if="citationPreview.image"
              :src="citationPreview.image"
              alt=""
              class="citation-preview-image"
            />
            <div>
              <div class="citation-preview-title">{{ citationPreview.title }}</div>
              <div class="citation-preview-description">{{ citationPreview.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showCitationModal" class="citation-modal-overlay" @click="closeCitationModal">
        <div class="citation-modal" @click.stop>
          <div class="citation-modal-header">
            <div class="citation-modal-title">Source</div>
            <div class="citation-modal-actions">
              <a
                v-if="citationModalUrl"
                :href="citationModalUrl"
                target="_blank"
                rel="noreferrer"
                class="btn btn-sm btn-outline-secondary"
              >
                Open in new tab
              </a>
              <button class="btn-close" @click="closeCitationModal">&times;</button>
            </div>
          </div>
          <div class="citation-modal-body">
            <iframe
              v-if="citationModalUrl"
              :src="citationModalUrl"
              class="citation-modal-iframe"
              title="Source preview"
            ></iframe>
            <div v-else class="citation-preview-error">No source URL available.</div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div
        class="chat-input-container"
        :class="{ 'drag-over': isDragOver }"
        @dragenter.prevent="handleDragEnter"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <!-- Drop Zone Overlay -->
        <div v-if="isDragOver" class="drop-zone-overlay">
          <div class="drop-zone-content">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>
              <path d="M12 5v13"/>
              <path d="m8 9 4-4 4 4"/>
            </svg>
            <p>Drop files here</p>
            <small>Images{{ providerSupportsImages ? '' : ' (not supported by ' + providerMeta(provider).label + ')' }} • Audio files</small>
          </div>
        </div>
        <div v-if="uploadedImage" class="image-preview-container">
          <img :src="uploadedImage.preview" alt="Uploaded image" class="uploaded-image-preview" />
          <button @click="clearUploadedImage" class="clear-image-btn" title="Remove image">×</button>
        </div>
        <div v-if="selectedAudioFile" class="audio-preview-container">
          <div class="audio-preview-header">
            <div>
              <div class="audio-file-name">{{ selectedAudioFile.name }}</div>
              <div class="audio-meta">
                <span>{{ formatFileSize(selectedAudioFile.size) }}</span>
                <span v-if="selectedAudioFile.duration">Duration: {{ formatDuration(selectedAudioFile.duration) }}</span>
              </div>
            </div>
            <button
              class="clear-audio-btn"
              :disabled="audioProcessing"
              @click="clearSelectedAudio"
              title="Remove audio"
            >
              ×
            </button>
          </div>
          <div class="audio-settings">
            <label class="auto-detect-toggle">
              <input type="checkbox" v-model="audioAutoDetect" :disabled="audioProcessing" />
              <span>Auto-detect language</span>
            </label>
            <select
              v-model="audioLanguage"
              :disabled="audioAutoDetect || audioProcessing"
              class="audio-language-select"
            >
              <option v-for="lang in audioLanguageOptions" :key="lang.code" :value="lang.code">
                {{ lang.label }}
              </option>
            </select>
          </div>
          <div class="audio-actions">
            <button class="btn btn-secondary" @click="startAudioTranscription" :disabled="audioProcessing">
              <span v-if="audioProcessing" class="spinner-border spinner-border-sm"></span>
              <span v-else>Transcribe & Insert</span>
            </button>
            <div class="audio-status" v-if="audioTranscriptionStatus">
              {{ audioTranscriptionStatus }}
              <span v-if="audioChunkProgress.total > 0">
                • Chunk {{ audioChunkProgress.current }}/{{ audioChunkProgress.total }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="graphProcessingJobs.length" class="graph-job-panel">
          <div
            v-for="job in graphProcessingJobs"
            :key="job.id"
            class="graph-job-card"
            :class="job.status"
          >
            <div class="graph-job-header">
              <div>
                <div class="graph-job-title-row">
                  <span class="graph-job-title">Knowledge Graph</span>
                  <span class="graph-job-chip" :class="job.status">{{ jobStatusLabel(job) }}</span>
                </div>
                <div class="graph-job-meta">
                  <span>{{ providerMeta(job.provider || provider).label }}</span>
                  <span>• {{ formatTime(job.createdAt) }}</span>
                </div>
              </div>
              <button class="graph-job-remove" @click="removeGraphJob(job.id)" title="Remove job">
                ×
              </button>
            </div>
            <p class="graph-job-preview">{{ job.sourcePreview }}</p>
            <div v-if="job.status !== 'failed'" class="graph-job-progress">
              <div class="graph-job-progress-bar" :style="{ width: job.progress + '%' }"></div>
            </div>
            <div class="graph-job-status-text">
              <span>{{ job.stage }}</span>
              <span v-if="job.result && job.status === 'completed'">
                • {{ job.result.nodeCount || 0 }} nodes · {{ job.result.edgeCount || 0 }} edges
              </span>
            </div>
            <div v-if="job.error" class="graph-job-error">{{ job.error }}</div>
            <div v-if="job.graphSaveState === 'error'" class="graph-job-error">{{ job.graphSaveError }}</div>
            <div class="graph-job-actions">
              <button
                class="btn btn-outline-secondary btn-sm"
                @click="openTranscriptProcessor(job)"
                :disabled="job.status === 'processing'"
              >
                Review in Processor
              </button>
              <button
                v-if="job.graphSaveState !== 'success'"
                class="btn btn-primary btn-sm"
                @click="createGraphFromJob(job)"
                :disabled="job.status !== 'completed' || job.graphSaveState === 'saving' || !canCreateGraph"
              >
                <span v-if="job.graphSaveState === 'saving'">
                  Saving...
                </span>
                <span v-else>
                  Create Graph
                </span>
              </button>
              <button
                v-else
                class="btn btn-success btn-sm"
                @click="openGraphInViewer(job)"
              >
                Open Graph
              </button>
              <button
                class="btn btn-link btn-sm json-btn"
                @click="copyKnowledgeGraphJson(job)"
                :disabled="!job.result"
              >
                {{ job.copyState === 'copied' ? 'Copied!' : 'Copy JSON' }}
              </button>
            </div>
            <p v-if="job.status === 'completed' && !canCreateGraph" class="graph-job-hint">
              Log in to save the generated graph.
            </p>
          </div>
        </div>
        <div class="input-wrapper">
          <div class="input-main">
            <div class="input-toolbar">
              <button
                @click="toggleSpeechRecognition"
                :disabled="isStreaming || !speechSupported"
                class="btn mic-btn"
                :class="{ recording: isRecording }"
                :title="isRecording ? 'Stop recording' : 'Start voice input'"
              >
                <span v-if="isRecording" class="recording-pulse"></span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </button>
              <button
                @click="triggerAudioUpload"
                :disabled="isStreaming || audioProcessing"
                class="btn audio-btn"
                title="Upload audio for transcription"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>
                  <path d="M12 5v13"/>
                  <path d="m8 9 4-4 4 4"/>
                </svg>
              </button>
              <button
                @click="triggerImageUpload"
                :disabled="isStreaming || provider === 'grok'"
                class="btn image-btn"
                :title="provider === 'grok' ? 'Grok does not support image analysis' : 'Upload image for analysis'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            </div>
            <textarea
              v-model="userInput"
              @keydown.enter.exact.prevent="sendMessage"
              @keydown.shift.enter.exact="handleShiftEnter"
              @paste="handlePaste"
              :placeholder="`Ask ${providerMeta(provider).label} anything about the graph...`"
              class="chat-input"
              rows="3"
              :disabled="isStreaming"
            ></textarea>
            <input
              ref="imageFileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="handleImageUpload"
            />
            <input
              ref="audioFileInput"
              type="file"
              accept=".wav,.mp3,.m4a,.aac,.ogg,.opus,.mp4,.webm"
              style="display: none"
              @change="handleAudioFileSelect"
            />
          </div>
          <button
            @click="sendMessage"
            :disabled="!userInput.trim() || isStreaming"
            class="btn btn-primary send-btn"
            title="Send (Enter)"
          >
            <span v-if="isStreaming" class="spinner-border spinner-border-sm"></span>
            <span v-else>Send</span>
          </button>
        </div>
        <div class="input-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
          <span v-if="speechSupported"> | 🎤 Voice input available</span>
          <span> | 🎧 Audio upload ready</span>
          <span> | 📎 Drag & drop or paste images</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Image Selector Modal -->
  <ImageSelector
    :isOpen="isImageSelectorOpen"
    :currentImageUrl="backgroundImageUrl"
    :currentImageAlt="'Chat background'"
    :imageType="'Background'"
    :imageContext="'Chat panel background image'"
    :nodeContent="'Chat background customization'"
    @close="closeImageSelector"
    @image-replaced="handleBackgroundImageChange"
  />

  <!-- Advanced Graph Creation Modal -->
  <div v-if="showAdvancedGraphModal" class="modal-overlay" @click.self="closeAdvancedGraphModal">
    <div class="advanced-graph-modal">
      <div class="modal-header">
        <h3>⚙️ Advanced Graph Creation</h3>
        <button class="btn-close" @click="closeAdvancedGraphModal">✕</button>
      </div>

      <div class="modal-body">
        <div class="help-text">
          <p><strong>Select node templates</strong> to guide AI graph generation. Only selected types will be used.</p>
          <p class="text-muted">Tip: Start with 2-4 templates for best results.</p>
        </div>

        <div v-if="templatesLoading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading templates...</p>
        </div>

        <div v-else-if="templatesFetchError" class="error-state">
          <p class="error-message">{{ templatesFetchError }}</p>
          <button class="btn btn-secondary btn-sm" @click="fetchGraphTemplates">
            Retry
          </button>
        </div>

        <div v-else class="template-selector">
          <div v-for="(templates, category) in templatesByCategory" :key="category" class="category-group">
            <h4 class="category-header">{{ category }}</h4>

            <div class="template-list">
              <label
                v-for="template in templates"
                :key="template.id"
                class="template-item"
                :class="{ selected: isTemplateSelected(template.id) }"
              >
                <input
                  type="checkbox"
                  :value="template.id"
                  v-model="selectedTemplates"
                  :disabled="getTemplateNodeType(template) === null"
                />
                <div class="template-info">
                  <span class="template-name">{{ template.name }}</span>
                  <span class="template-type" v-if="getTemplateNodeType(template)">
                    Type: <code>{{ getTemplateNodeType(template) }}</code>
                  </span>
                  <span class="template-description" v-if="getTemplateAIInstructions(template)">
                    {{ getTemplateAIInstructions(template) }}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="selection-summary" v-if="!templatesLoading && !templatesFetchError">
          <strong>Selected:</strong> {{ selectedTemplates.length }} template(s)
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeAdvancedGraphModal">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="generateAdvancedGraph"
          :disabled="selectedTemplates.length === 0"
        >
          🚀 Generate Graph
        </button>
      </div>
    </div>
  </div>

  <!-- Case Graph Creation Modal -->
  <div v-if="showCaseGraphModal" class="modal-overlay" @click.self="closeCaseGraphModal">
    <div class="case-graph-modal">
      <div class="modal-header">
        <h3>📊 Opprett Case Graf</h3>
        <button class="btn-close" @click="closeCaseGraphModal">✕</button>
      </div>

      <div class="modal-body">
        <div class="case-info" v-if="caseGraphPersonData">
          <div class="person-header">
            <span class="person-avatar" :class="caseGraphPersonData.gender === 'K' ? 'female' : 'male'">
              {{ caseGraphPersonData.gender === 'K' ? '👩' : '👨' }}
            </span>
            <div class="person-details">
              <h4>{{ caseGraphPersonData.name }}</h4>
              <p class="connections-count">
                {{ caseGraphPersonData.connections?.length || 0 }} forbindelser i nettverket
              </p>
            </div>
          </div>

          <div class="case-preview">
            <p><strong>Grafen vil inneholde:</strong></p>
            <ul>
              <li>1 sentral person-node ({{ caseGraphPersonData.name }})</li>
              <li>{{ caseGraphPersonData.connections?.length || 0 }} forbindelse-noder</li>
              <li>{{ caseGraphPersonData.connections?.length || 0 }} edges (kanter)</li>
            </ul>
          </div>

          <div class="case-title-input">
            <label for="caseGraphTitle">Graf-tittel:</label>
            <input
              id="caseGraphTitle"
              type="text"
              v-model="caseGraphTitle"
              class="form-control"
              :placeholder="`${caseGraphPersonData.name} sitt nettverk`"
            />
          </div>
        </div>

        <div v-if="caseGraphError" class="error-state">
          <p class="error-message">{{ caseGraphError }}</p>
        </div>

        <div v-if="caseGraphCreating && !caseGraphCreatedId" class="loading-state">
          <div class="spinner"></div>
          <p>{{ caseGraphStatus }}</p>
        </div>
      </div>

      <div class="modal-footer" v-if="!caseGraphCreating && !caseGraphCreatedId">
        <button class="btn btn-secondary" @click="closeCaseGraphModal">
          Avbryt
        </button>
        <button
          class="btn btn-primary"
          @click="createCaseGraphAndOpen"
          :disabled="!caseGraphPersonData"
        >
          📂 Åpne i GNewViewer
        </button>
        <button
          class="btn btn-success"
          @click="createCaseGraphAndImport"
          :disabled="!caseGraphPersonData || parentContext !== 'canvas'"
          :title="parentContext !== 'canvas' ? 'Kun tilgjengelig fra GraphCanvas' : 'Importer som cluster i nåværende graf'"
        >
          📦 Importer som Cluster
        </button>
      </div>

      <div class="modal-footer" v-if="caseGraphCreatedId">
        <p class="success-message">✅ Graf opprettet!</p>
        <button class="btn btn-primary" @click="openCreatedCaseGraph">
          📂 Åpne graf
        </button>
        <button
          class="btn btn-success"
          @click="importCreatedCaseGraphAsCluster"
          :disabled="parentContext !== 'canvas'"
        >
          📦 Importer som Cluster
        </button>
        <button class="btn btn-secondary" @click="closeCaseGraphModal">
          Lukk
        </button>
      </div>
    </div>
  </div>

  <!-- Batch Fulltext Generation Modal -->
  <div v-if="showBatchGenerateModal" class="modal-overlay">
    <div class="batch-generate-modal">
      <div class="modal-header">
        <h3>📦 Batch Fulltext Generation</h3>
        <button class="btn-close" @click="closeBatchGenerateModal">✕</button>
      </div>

      <div class="modal-body">
        <!-- Setup Phase: Select template and data source -->
        <div v-if="!batchCurrentPreview && !batchGenerating">
          <!-- Step 1: Template Selection -->
          <div class="batch-step">
            <h4>1. Velg mal-node</h4>
            <p class="help-text">Velg en node med formateringen du vil bruke som mal</p>
            <select v-model="batchTemplateNodeId" class="form-control">
              <option value="">-- Velg en node --</option>
              <option v-for="node in fulltextNodes" :key="node.id" :value="node.id">
                {{ node.label || node.id }}
              </option>
            </select>
            <div v-if="selectedTemplatePreview" class="template-preview">
              <strong>Forhåndsvisning:</strong>
              <div v-html="renderMarkdown(selectedTemplatePreview)"></div>
            </div>
          </div>

          <!-- Step 2: Data Source Selection -->
          <div class="batch-step">
            <h4>2. Velg datakilde-node</h4>
            <p class="help-text">Velg en node som inneholder tabellen med elementer å generere</p>
            <select v-model="batchDataSourceNodeId" class="form-control">
              <option value="">-- Velg en node --</option>
              <option v-for="node in fulltextNodes" :key="node.id" :value="node.id">
                {{ node.label || node.id }}
              </option>
            </select>
            <div v-if="parsedBatchItems.length > 0" class="parsed-info">
              ✅ Fant {{ parsedBatchItems.length }} elementer i tabellen
              <ul class="parsed-items-preview">
                <li v-for="(item, idx) in parsedBatchItems.slice(0, 5)" :key="idx">
                  {{ item.primary }} {{ item.secondary ? `(${item.secondary})` : '' }}
                </li>
                <li v-if="parsedBatchItems.length > 5">
                  ... og {{ parsedBatchItems.length - 5 }} til
                </li>
              </ul>
            </div>
            <div v-else-if="batchDataSourceNodeId" class="no-table-warning">
              ⚠️ Ingen tabell funnet i valgt node
            </div>
          </div>

          <!-- Created nodes summary -->
          <div v-if="batchCreatedNodes.length > 0" class="batch-created-summary">
            <strong>✅ Opprettet {{ batchCreatedNodes.length }} noder</strong>
          </div>
        </div>

        <!-- Preview Phase: Show generated content for editing/approval -->
        <div v-if="batchCurrentPreview && !batchGenerating" class="batch-preview-phase">
          <div class="batch-preview-header">
            <span class="batch-preview-counter">
              {{ batchCurrentIndex + 1 }} / {{ parsedBatchItems.length }}
            </span>
            <span class="batch-preview-item">
              {{ parsedBatchItems[batchCurrentIndex]?.primary }}
              {{ parsedBatchItems[batchCurrentIndex]?.secondary ? `(${parsedBatchItems[batchCurrentIndex].secondary})` : '' }}
            </span>
          </div>

          <div class="batch-edit-field">
            <label><strong>Label:</strong></label>
            <input
              type="text"
              v-model="batchCurrentPreview.label"
              class="form-control"
            />
          </div>

          <div class="batch-edit-field">
            <label><strong>Innhold:</strong> <span class="edit-hint">(Du kan redigere før godkjenning)</span></label>
            <textarea
              v-model="batchCurrentPreview.info"
              class="form-control batch-content-editor"
              rows="15"
            ></textarea>
          </div>

          <div class="batch-preview-rendered">
            <label><strong>Forhåndsvisning:</strong></label>
            <div class="batch-preview-content">
              <div v-html="renderMarkdown(batchCurrentPreview.info)"></div>
            </div>
          </div>
        </div>

        <!-- Generating spinner -->
        <div v-if="batchGenerating" class="batch-generating">
          <span class="batch-spinner"></span>
          <span>Genererer innhold for {{ parsedBatchItems[batchCurrentIndex]?.primary }}...</span>
        </div>

        <!-- Error display -->
        <div v-if="batchErrors.length > 0" class="batch-errors">
          <strong>Feil:</strong>
          <ul>
            <li v-for="(err, idx) in batchErrors" :key="idx">{{ err }}</li>
          </ul>
        </div>
      </div>

      <div class="modal-footer">
        <!-- Setup phase buttons -->
        <template v-if="!batchCurrentPreview && !batchGenerating">
          <button class="btn btn-secondary" @click="closeBatchGenerateModal">
            Lukk
          </button>
          <button
            class="btn btn-primary"
            @click="generateNextItem"
            :disabled="!canStartBatch"
          >
            🚀 Start ({{ batchCurrentIndex + 1 }}/{{ parsedBatchItems.length }})
          </button>
        </template>

        <!-- Preview phase buttons -->
        <template v-if="batchCurrentPreview && !batchGenerating">
          <button class="btn btn-outline-danger" @click="skipCurrentItem">
            ⏭️ Hopp over
          </button>
          <button class="btn btn-success" @click="approveCurrentItem">
            ✅ Godkjenn
          </button>
          <button
            v-if="batchCurrentIndex < parsedBatchItems.length - 1"
            class="btn btn-primary"
            @click="approveAndNext"
          >
            ✅ Godkjenn & Neste →
          </button>
          <button
            v-if="batchCurrentIndex === parsedBatchItems.length - 1"
            class="btn btn-primary"
            @click="approveAndFinish"
          >
            ✅ Godkjenn & Fullfør
          </button>
        </template>

        <!-- Generating phase -->
        <template v-if="batchGenerating">
          <button class="btn btn-danger" @click="abortBatchGeneration">
            Avbryt
          </button>
        </template>
      </div>
    </div>
  </div>

  <!-- HTML Import Modal -->
  <div v-if="showHtmlImportModal" class="modal-overlay" @click.self="closeHtmlImportModal">
    <div class="html-import-modal">
      <div class="modal-header">
        <h3>📥 Import HTML to Knowledge Graph</h3>
        <button class="btn-close" @click="closeHtmlImportModal" :disabled="htmlImportSaving">✕</button>
      </div>

      <div class="modal-body">
        <p class="text-muted">
          Import from URL (recommended) or paste a full HTML page/snippet.
          URL import extracts external + inline CSS into a <code>css-node</code> and links it to an <code>html-node</code>.
        </p>

        <div class="form-group mb-3">
          <label for="htmlImportUrl"><strong>Source URL (optional)</strong></label>
          <input
            id="htmlImportUrl"
            v-model="htmlImportUrl"
            type="url"
            class="form-control"
            placeholder="https://example.com/"
            :disabled="htmlImportSaving"
          />
          <div class="text-muted small mt-1">
            If set, URL import is used. HTML textarea is fallback/manual mode.
          </div>
        </div>

        <div class="form-group mb-3">
          <label for="htmlImportTitle"><strong>Graph title</strong></label>
          <input
            id="htmlImportTitle"
            v-model="htmlImportTitle"
            type="text"
            class="form-control"
            placeholder="Imported HTML Template"
            :disabled="htmlImportSaving"
          />
        </div>

        <div class="form-group mb-3">
          <label for="htmlImportDescription"><strong>Description (optional)</strong></label>
          <input
            id="htmlImportDescription"
            v-model="htmlImportDescription"
            type="text"
            class="form-control"
            placeholder="Imported from Grok Chat panel"
            :disabled="htmlImportSaving"
          />
        </div>

        <div class="form-group mb-2">
          <label for="htmlImportContent"><strong>HTML content</strong></label>
          <textarea
            id="htmlImportContent"
            v-model="htmlImportContent"
            class="form-control html-import-textarea"
            rows="14"
            placeholder="Paste full HTML document or snippet here..."
            :disabled="htmlImportSaving"
          ></textarea>
        </div>

        <div class="text-muted small mb-2">
          {{ htmlImportCharacterCount }} chars ({{ htmlImportSizeKb }} KB)
        </div>

        <div class="form-check mb-3 html-import-option">
          <input
            id="htmlImportRemoveInlineStyles"
            v-model="htmlImportRemoveInlineStyles"
            class="form-check-input"
            type="checkbox"
            :disabled="htmlImportSaving"
          />
          <label class="form-check-label" for="htmlImportRemoveInlineStyles">
            Remove inline <code>&lt;style&gt;</code> tags from HTML after extracting CSS node
          </label>
        </div>

        <div v-if="htmlImportError" class="error-state compact">
          <p class="error-message mb-0">{{ htmlImportError }}</p>
        </div>
        <div v-if="htmlImportCreatedGraphId && !htmlImportError" class="success-message compact">
          ✅ Graph created: <code>{{ htmlImportCreatedGraphId }}</code>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeHtmlImportModal" :disabled="htmlImportSaving">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="createHtmlImportGraph"
          :disabled="htmlImportSaving || (!htmlImportContent.trim() && !htmlImportUrl.trim()) || !canCreateGraph"
        >
          <span v-if="htmlImportSaving" class="spinner-border spinner-border-sm me-1"></span>
          {{ htmlImportSaving ? 'Importing...' : 'Create Graph' }}
        </button>
        <button
          v-if="htmlImportCreatedGraphId"
          class="btn btn-success"
          @click="openImportedHtmlGraph"
          :disabled="htmlImportSaving"
        >
          📂 Open Graph
        </button>
      </div>
    </div>
  </div>

  <!-- Raw JSON Viewer Modal -->
  <div v-if="showRawJsonModal" class="modal-overlay" @click.self="showRawJsonModal = false">
    <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
      <div class="modal-header">
        <h3>📋 Raw JSON Data with Metadata</h3>
        <button class="modal-close" @click="showRawJsonModal = false">×</button>
      </div>
      <div class="modal-body">
        <div v-if="buildRawJsonContext()" class="raw-json-viewer">
          <div class="raw-json-actions">
            <button
              class="btn btn-primary btn-sm"
              @click="copyRawJsonToClipboard"
            >
              {{ rawJsonCopyState }}
            </button>
            <button
              class="btn btn-outline-secondary btn-sm"
              @click="downloadRawJson"
            >
              💾 Download JSON
            </button>
          </div>
          <pre class="raw-json-content"><code>{{ buildRawJsonContext().jsonString }}</code></pre>
        </div>
        <div v-else class="alert alert-info">
          No graph data available to display.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="showRawJsonModal = false">
          Close
        </button>
      </div>
    </div>

    <!-- === NEW: Graph Update Approval Modal === -->
    <div v-if="showApprovalModal" class="approval-modal-overlay" @click.self="cancelGraphUpdate">
      <div class="approval-modal">
        <div class="approval-modal-header">
          <h3>🔍 Confirm Graph Update</h3>
          <button type="button" class="close-btn" @click="cancelGraphUpdate">&times;</button>
        </div>

        <div class="approval-modal-content">
          <p class="approval-intro">The AI wants to make the following change to your graph:</p>

          <!-- Node Being Changed -->
          <div class="approval-node-info" v-if="pendingApproval">
            <div class="approval-label">Node Being Updated:</div>
            <div class="approval-value">{{ pendingApproval.nodeLabel || pendingApproval.nodeId }}</div>
            <div class="approval-hint">(ID: {{ pendingApproval.nodeId }})</div>
          </div>

          <!-- Changes Summary -->
          <div class="approval-changes" v-if="pendingApproval">
            <div class="approval-label">Changes:</div>
            <div class="approval-change-list">
              <div v-for="(value, field) in pendingApproval.changes" :key="field" class="approval-change-item">
                <div class="change-field">{{ field }}:</div>
                <div class="change-detail">
                  <div v-if="field === 'info' && typeof value === 'string' && value.length > 100" class="change-preview">
                    <div class="change-old">
                      <strong>Old:</strong>
                      <div class="text-truncate">{{ pendingApproval.oldValues?.[field] || '(empty)' | truncate }}</div>
                    </div>
                    <div class="change-new">
                      <strong>New:</strong>
                      <div class="text-truncate">{{ value | truncate }}</div>
                    </div>
                  </div>
                  <div v-else class="change-inline">
                    <span class="old-value">{{ pendingApproval.oldValues?.[field] || '(empty)' }}</span>
                    <span class="arrow">→</span>
                    <span class="new-value">{{ value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- AI's Explanation (if provided) -->
          <div v-if="pendingApproval?.explanation" class="approval-explanation">
            <div class="approval-label">AI's Explanation:</div>
            <div class="approval-text">{{ pendingApproval.explanation }}</div>
          </div>
        </div>

        <div class="approval-modal-footer">
          <button type="button" class="btn btn-cancel" @click="cancelGraphUpdate">
            ❌ Don't Save
          </button>
          <button type="button" class="btn btn-approve" @click="approveGraphUpdate">
            ✅ Approve & Save
          </button>
        </div>

        <div v-if="approvalStatus" :class="['approval-status', approvalStatus.type]">
          {{ approvalStatus.message }}
        </div>
      </div>
    </div>
    <!-- === END NEW === -->

  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import grokIcon from '@/assets/grok.svg'
import openaiIcon from '@/assets/openai.svg'
import perplexityIcon from '@/assets/perplexity.svg'
import claudeIcon from '@/assets/claude.svg'
import geminiIcon from '@/assets/gemini.svg'
import graphContextIcon from '@/assets/graph-context.svg'
import proffIcon from '@/assets/proff.svg'
import ImageSelector from '@/components/ImageSelector.vue'

const emit = defineEmits([
  'insert-fulltext',
  'insert-fulltext-batch',
  'insert-html',
  'insert-node',
  'insert-network',
  'insert-person-network',
  'import-graph-as-cluster',
  'graph-updated'
])

const router = useRouter()
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

const props = defineProps({
  graphData: {
    type: Object,
    required: true,
  },
  selectionContext: {
    type: Object,
    required: false,
    default: () => null,
  },
  /**
   * Context identifier for the parent component.
   * - 'viewer': GNewViewer (reading/viewing graphs)
   * - 'canvas': GraphCanvas (editing/creating graphs with Cytoscape)
   * This affects hints, suggestions, and insert behavior.
   */
  parentContext: {
    type: String,
    required: false,
    default: 'viewer',
    validator: (value) => ['viewer', 'canvas'].includes(value),
  },
})

// Computed helpers for context-aware behavior
const isCanvasContext = computed(() => props.parentContext === 'canvas')
const isViewerContext = computed(() => props.parentContext === 'viewer')

// Context-aware labels
const contextLabel = computed(() => isCanvasContext.value ? 'Canvas' : 'Graph')
const insertLabel = computed(() => isCanvasContext.value ? 'Insert as Node' : 'Insert as Full Text')

const extractHtmlDocument = (content) => {
  if (!content || typeof content !== 'string') return null
  const trimmed = content.trim()
  if (!trimmed) return null

  const fenceMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  if (/<!doctype\s+html/i.test(candidate)) return candidate
  if (/<html[\s>]/i.test(candidate) && /<\/html>/i.test(candidate)) return candidate
  if (/<head[\s>]/i.test(candidate) && /<body[\s>]/i.test(candidate)) return candidate

  return null
}

const isHtmlMessage = (message) => {
  return Boolean(extractHtmlDocument(message?.content))
}

// Batch Generation Computed Properties
const fulltextNodes = computed(() => {
  if (!props.graphData?.nodes) return []
  return props.graphData.nodes.filter(n => n.type === 'fulltext')
})

const selectedTemplatePreview = computed(() => {
  if (!batchTemplateNodeId.value) return null
  const node = fulltextNodes.value.find(n => n.id === batchTemplateNodeId.value)
  return node?.info?.substring(0, 500) || null
})

const selectedDataSourcePreview = computed(() => {
  if (!batchDataSourceNodeId.value) return null
  const node = fulltextNodes.value.find(n => n.id === batchDataSourceNodeId.value)
  return node?.info || null
})

const parsedBatchItems = computed(() => {
  if (!selectedDataSourcePreview.value) return []
  return parseMarkdownTable(selectedDataSourcePreview.value)
})

const canStartBatch = computed(() => {
  return batchTemplateNodeId.value &&
         batchDataSourceNodeId.value &&
         parsedBatchItems.value.length > 0 &&
         !batchGenerationActive.value
})

const batchProgressPercent = computed(() => {
  if (batchProgressTotal.value === 0) return 0
  return Math.round((batchProgressCurrent.value / batchProgressTotal.value) * 100)
})

// State
const isCollapsed = ref(false)
const useGraphContext = ref(true)
const useSelectionContext = ref(false)
const useRawJsonMode = ref(false)
const provider = ref('grok')
const providerOptions = [
  { value: 'grok', label: 'Grok' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'perplexity', label: 'Perplexity' },
]
const openaiModel = ref('gpt-5.2')
const openaiChatModelOptions = [
  { value: 'gpt-5.2', label: 'GPT-5.2 (Chat/Text)' },
  { value: 'gpt-5.1', label: 'GPT-5.1 (Chat/Text)' },
  { value: 'gpt-5', label: 'GPT-5 (Chat/Text)' },
  { value: 'gpt-4o', label: 'GPT-4o (Chat/Text)' },
  { value: 'gpt-4', label: 'GPT-4 (Chat/Text)' }
]
const openaiImageModelOptions = [
  { value: 'gpt-image-1.5', label: 'GPT-Image-1.5 (Image Gen)' },
  { value: 'gpt-image-1', label: 'GPT-Image-1 (Image Gen)' },
  { value: 'gpt-image-1-mini', label: 'GPT-Image-1 Mini (Image Gen)' }
]
const openaiModelOptions = [
  ...openaiImageModelOptions,
  ...openaiChatModelOptions,
]

const isImageMode = computed(() => {
  // This should be set by your UI logic; for now, check if userInput contains 'image'
  return userInput.value?.toLowerCase().includes('image') || false
})
const claudeModel = ref('claude-opus-4-5-20251101')
const claudeModelOptions = [
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
]
const messages = ref([])
const userInput = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingProviderOverride = ref(null)
const errorMessage = ref('')
const messagesContainer = ref(null)
const citationPreview = ref({
  visible: false,
  loading: false,
  error: false,
  url: '',
  domain: '',
  title: '',
  description: '',
  image: '',
  style: {},
})
const isCitationPreviewHovered = ref(false)
const showCitationModal = ref(false)
const citationModalUrl = ref('')
let citationHideTimeout = null
const linkPreviewCache = new Map()

// Background image state
const backgroundImageUrl = ref(localStorage.getItem('grok-chat-background') || '')
const isImageSelectorOpen = ref(false)

// Speech recognition
const isRecording = ref(false)
const speechSupported = ref(false)
let recognition = null

// Image upload
const uploadedImage = ref(null)
const imageFileInput = ref(null)
const isUploadingImage = ref(false)

// Drag and drop
const isDragOver = ref(false)
let dragCounter = 0

// Audio upload/transcription
const audioFileInput = ref(null)
const selectedAudioFile = ref(null)
const audioProcessing = ref(false)
const audioTranscriptionStatus = ref('')
const audioChunkProgress = ref({ current: 0, total: 0 })
const audioAutoDetect = ref(true)
const audioLanguage = ref('no')

// === NEW: Graph Update Approval Modal ===
const showApprovalModal = ref(false)
const pendingApproval = ref(null)
const approvalStatus = ref(null)
let pendingApprovalResolve = null
// === END NEW ===
const audioLanguageOptions = [
  { code: 'no', label: 'Norwegian' },
  { code: 'en', label: 'English' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' }
]

// Batch Fulltext Node Generation State
const showBatchGenerateModal = ref(false)
const batchTemplateNodeId = ref('')
const batchDataSourceNodeId = ref('')
const batchGenerationActive = ref(false)
const batchProgressStage = ref('')
const batchProgressCurrent = ref(0)
const batchProgressTotal = ref(0)
const batchErrors = ref([])
const batchAbortController = ref(null)
const batchAborting = ref(false)
const batchCreatedNodes = ref([])
const batchCurrentIndex = ref(0)
const batchCurrentPreview = ref(null)
const batchGenerating = ref(false)

// API Lookup
const apiLookupOpen = ref(false)
const apiSearchQuery = ref('')
const apiSearchResults = ref([])
const apiSearchLoading = ref(false)
const apiSearchError = ref('')

// Proff API Function Calling Configuration
const PROFF_API_BASE = 'https://proff-worker.torarnehave.workers.dev'
const useProffTools = ref(true) // Enable Proff company lookup by default
const useTemplateTools = ref(true)
const TOOL_TEMPLATES_ENDPOINT = 'https://knowledge.vegvisr.org/getToolTemplates'

const canUseTemplateTools = computed(() => {
  return userStore.role === 'Superadmin' || userStore.role === 'Admin'
})

const toggleApiLookup = () => {
  apiLookupOpen.value = !apiLookupOpen.value
  apiSearchError.value = ''
  if (!apiLookupOpen.value) {
    apiSearchResults.value = []
  }
}

const runApiSearch = async () => {
  const query = apiSearchQuery.value.trim()
  if (!query) return
  apiSearchLoading.value = true
  apiSearchError.value = ''
  try {
    const res = await fetch(`https://api.vegvisr.org/api/apis/search?q=${encodeURIComponent(query)}`)
    if (!res.ok) {
      throw new Error(`Search failed (${res.status})`)
    }
    const data = await res.json()
    apiSearchResults.value = data.results || []
  } catch (error) {
    apiSearchResults.value = []
    apiSearchError.value = error instanceof Error ? error.message : 'Search failed'
  } finally {
    apiSearchLoading.value = false
  }
}

const insertApiSnippet = (api) => {
  if (!api) return
  const signature = api.function_signature || api.function_name || api.slug
  const endpoint = api.endpoint_url || ''
  const example = api.example_code ? `\nExample:\n${api.example_code}` : ''
  const snippet = `API: ${api.name || api.slug}\nSignature: ${signature}${endpoint ? `\nEndpoint: ${endpoint}` : ''}${example}\n`
  userInput.value = `${userInput.value || ''}${userInput.value ? '\n\n' : ''}${snippet}`
}

// OpenAI-compatible tool definitions for Proff API
const proffTools = [
  {
    type: 'function',
    function: {
      name: 'proff_search_companies',
      description: 'Search for Norwegian companies by name. Returns a list of matching companies with their organization numbers (org.nr). Use this FIRST to find the org.nr, then use other tools to get details.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Company name to search for (e.g., "Equinor", "Universi AS")'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'proff_get_financials',
      description: `Get financial history for a Norwegian company. Returns revenue (omsetning), operating result (driftsresultat), annual result (årsresultat), and EBITDA for ALL available years.

IMPORTANT: This tool returns a ready-to-use markdown table in the "markdown_table" field. When presenting financial data, ALWAYS display this table directly to the user.

Use this tool when the user asks about:
- Revenue / omsetning / inntekter
- Profit / resultat / overskudd
- Financial performance over years
- Company economics / økonomi`,
      parameters: {
        type: 'object',
        properties: {
          orgNr: {
            type: 'string',
            description: 'The 9-digit Norwegian organization number'
          }
        },
        required: ['orgNr']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'proff_get_company_details',
      description: 'Get company details: board members (styremedlemmer), shareholders (aksjonærer), address, contact info, industry code. Use for ownership, management, or company structure questions - NOT for financial data.',
      parameters: {
        type: 'object',
        properties: {
          orgNr: {
            type: 'string',
            description: 'The 9-digit Norwegian organization number'
          }
        },
        required: ['orgNr']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'proff_search_persons',
      description: 'Search for business persons (executives, board members) by name in Norwegian business registry. Returns personId needed for detailed lookups and network searches.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Person name to search for (e.g., "Anders Opedal", "Kjell Inge Røkke")'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'proff_get_person_details',
      description: `Get detailed information about a business person including ALL their board positions, roles, and connected companies.

Use this tool when user wants to:
- See all companies a person is involved with
- List all board positions/roles for a person
- "Dykke dypere" or explore someone's full business network
- Understand the extent of someone's business involvement

Returns a markdown summary table with all roles.`,
      parameters: {
        type: 'object',
        properties: {
          personId: {
            type: 'string',
            description: 'Proff personId (get this from proff_search_persons first)'
          }
        },
        required: ['personId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'proff_find_business_network',
      description: `Find the shortest business connection path between two persons through shared companies and board positions. Shows how two business people are connected (degrees of separation).

WORKFLOW:
1. First use proff_search_persons to find personId for BOTH persons
2. Then use this tool with both personIds

Returns the connection path like: Person A → Company X → Person B → Company Y → Person C`,
      parameters: {
        type: 'object',
        properties: {
          fromPersonId: {
            type: 'string',
            description: 'Proff personId of the first person (get this from proff_search_persons)'
          },
          toPersonId: {
            type: 'string',
            description: 'Proff personId of the second person (get this from proff_search_persons)'
          }
        },
        required: ['fromPersonId', 'toPersonId']
      }
    }
  }
]

// Sources API Configuration
const SOURCES_API_BASE = 'https://sources-worker.torarnehave.workers.dev'
const LINK_PREVIEW_ENDPOINT = `${SOURCES_API_BASE}/link-preview`
const useSourcesTools = ref(true) // Enable Norwegian sources by default

// Web Search Configuration (Perplexity integration)
const useWebSearch = ref(false) // Disabled by default - user opts in
const suggestedWebSearches = ref([]) // AI-suggested search queries to run via Perplexity

// OpenAI-compatible tool definitions for Sources API
const sourcesTools = [
  {
    type: 'function',
    function: {
      name: 'sources_search',
      description: `Search Norwegian government, news, research, and environmental sources for articles and reports.

Use this when users ask about:
- Norwegian government news and policy
- Environment/nature/climate news
- Research and statistics
- Public hearings (høringer)

Available sources: Regjeringen (government), SSB (statistics), NRK (news), Forskning.no (research), Naturvernforbundet, SABIMA (biodiversity), WWF, Bellona (environment), CICERO (climate)

Returns articles with links to original sources.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in Norwegian or English (e.g., "naturmangfold", "climate change", "rovdyr", "biologisk mangfold", "høring")'
          },
          sources: {
            type: 'string',
            description: 'Comma-separated source IDs (optional). Available: regjeringen, ssb, nrk, forskning, naturvern, sabima, wwf, bellona, cicero'
          },
          days: {
            type: 'number',
            description: 'How many days back to search (default: 30)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sources_get_hearings',
      description: `Search for public hearings (høringer) from the Norwegian government and news sources.

Searches regjeringen.no and other sources for hearing-related content.

Use when users ask about:
- Public hearings / høringer
- Ways to participate in policy
- Current consultations
- Offentlige høringer`,
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Filter by topic (e.g., "naturvern", "klima", "biodiversitet", "mineral")'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sources_environment_news',
      description: `Get the latest environment and nature news from Norwegian sources.

Aggregates news from: Regjeringen, SSB (statistics), NRK Klima, Naturvernforbundet, SABIMA, WWF, Bellona, CICERO, Forskning.no

Use when users ask about:
- Environment news / miljønyheter
- Nature conservation updates / naturvern
- Climate policy news / klimapolitikk
- Biodiversity / biologisk mangfold`,
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of articles (default: 20)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sources_list_feeds',
      description: 'List all available Norwegian RSS feeds and sources that can be searched. Returns source names, descriptions, and categories.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sources_google_news',
      description: `Search Google News for Norwegian and international news articles.

Use this when users ask about:
- Breaking news / siste nytt
- International news / utenriksnyheter
- Current events / aktuelle saker
- Recent news about specific topics

Returns news articles from Google News with Norwegian language preference.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "klimaendringer", "stortinget", "biodiversitet", "NATO")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of articles (default: 20)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sources_web_search',
      description: `Search the web for general information using DuckDuckGo.

Use this when:
- Users need general web information (not just news)
- Looking for websites, documentation, or resources
- Need current information beyond news articles
- Other source searches don't have relevant results

Note: Results may be limited. For news, prefer sources_search or sources_google_news.`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in any language'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10)'
          }
        },
        required: ['query']
      }
    }
  }
]

// OpenAI-compatible tool definitions for graph template tools
const templateTools = [
  {
    type: 'function',
    function: {
      name: 'graph_template_catalog',
      description: 'List available admin-approved graph node templates for tool insertion. Call this before choosing a template to insert.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'graph_template_insert',
      description: 'Insert a node based on an approved graph template into the current graph. Use after graph_template_catalog. Provide template_id and node_overrides with generated content.',
      parameters: {
        type: 'object',
        properties: {
          template_id: {
            type: 'string',
            description: 'Template id from graph_template_catalog.'
          },
          node_overrides: {
            type: 'object',
            description: 'Fields to override on the template node. Use info for the main content.',
            properties: {
              label: { type: 'string' },
              info: { type: 'string' },
              description: { type: 'string' },
              path: { type: 'string' },
              color: { type: 'string' },
              imageWidth: { type: 'string' },
              imageHeight: { type: 'string' },
              bibl: { type: 'array', items: { type: 'string' } }
            },
            additionalProperties: true
          }
        },
        required: ['template_id']
      }
    }
  }
]

const graphTools = [
  {
    type: 'function',
    function: {
      name: 'graph_update_current',
      description: 'Update the current graph with modified nodes. Supports partial updates - only send the node id and changed fields.',
      parameters: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            description: 'Array of nodes to update. Only include id and changed fields.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Node ID (required)' },
                label: { type: 'string' },
                info: { type: 'string' },
                type: { type: 'string' },
                visible: { type: 'boolean' }
              },
              required: ['id']
            }
          }
        },
        required: ['nodes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'graph_node_search_replace',
      description: 'Fast search-and-replace within a node\'s info field. Use this for simple text changes (e.g. changing a CSS color, renaming a class, updating a word) instead of sending the entire node content via graph_update_current. Much faster for surgical edits.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'The ID of the node to modify' },
          search: { type: 'string', description: 'The exact text to find in the node\'s info field' },
          replace: { type: 'string', description: 'The replacement text' },
          replaceAll: { type: 'boolean', description: 'Replace all occurrences (default: false)' }
        },
        required: ['nodeId', 'search', 'replace']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'graph_attach_css_to_html',
      description: 'Attach or switch a css-node for an html-node by creating a styles edge in the current graph.',
      parameters: {
        type: 'object',
        properties: {
          cssNodeId: { type: 'string', description: 'CSS node id (source)' },
          htmlNodeId: { type: 'string', description: 'HTML node id (target)' },
          replaceExisting: { type: 'boolean', description: 'Remove existing styles edges to this html node first (default true)' },
        },
        required: ['cssNodeId', 'htmlNodeId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'graph_detach_css_from_html',
      description: 'Detach styles edges for an html-node and/or css-node in the current graph.',
      parameters: {
        type: 'object',
        properties: {
          cssNodeId: { type: 'string', description: 'Optional css node id filter' },
          htmlNodeId: { type: 'string', description: 'Optional html node id filter' }
        },
        required: []
      }
    }
  }
]

/**
 * Execute graph manipulation tools (save/update knowledge graphs)
 * @param {string} toolName - The function name to call
 * @param {object} args - The function arguments
 * @returns {Promise<object>} - The operation result
 */
async function executeGraphManipulationTool(toolName, args) {
  const userId = userStore.user_id || 'system'
  const graphStore = knowledgeGraphStore

  try {
    if (toolName === 'graph_save_new') {
      // Save the current graph as a new knowledge graph
      if (!props.graphData) {
        throw new Error('No graph data available to save')
      }

      const graphTitle = args?.title || props.graphData?.metadata?.title || 'AI Generated Graph'
      const graphDescription = args?.description || props.graphData?.metadata?.description || 'Created by AI analysis'

      const newGraphId = `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newGraphData = {
        id: newGraphId,
        nodes: props.graphData.nodes || [],
        edges: props.graphData.edges || [],
        metadata: {
          ...props.graphData.metadata,
          title: graphTitle,
          description: graphDescription,
          created: new Date().toISOString(),
          createdBy: userId,
          version: '1.0',
        },
      }

      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newGraphId,
          graphData: newGraphData,
          override: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to save graph: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      // Update the store
      graphStore.setCurrentGraphId(newGraphId)
      graphStore.setCurrentGraph(newGraphData)

      return {
        status: 'success',
        graphId: newGraphId,
        title: graphTitle,
        message: `Graph saved as "${graphTitle}"`,
      }
    }

    if (toolName === 'graph_update_current') {
      // Update the current graph with new/modified data
      // Supports BOTH full graph updates AND implicit partial node patching
      const currentGraphId = props.graphData?.id || graphStore.currentGraphId

      if (!currentGraphId) {
        throw new Error('No current graph loaded. Use graph_save_new to create a new graph first.')
      }

      // === NEW: Implicit Patching Support ===
      // If only partial node data is provided, merge with existing nodes
      let updatedNodes = args?.nodes || props.graphData?.nodes || []

      // Detect if this is a partial node update (surgical edit)
      const isPartialUpdate = args?.nodes && args.nodes.length > 0 &&
        args.nodes.some(n => {
          // A node is "partial" if it doesn't have all standard properties
          // (has only id + some changed fields, not the complete node definition)
          const hasId = n.id;
          const hasLabel = 'label' in n;
          const hasInfo = 'info' in n;
          const hasType = 'type' in n;
          const hasPosition = 'position' in n;

          // If a node has id but is missing most fields, it's likely a partial update
          return hasId && [hasLabel, hasInfo, hasType, hasPosition].filter(Boolean).length < 3;
        });

      if (isPartialUpdate) {
        // Merge partial updates with existing nodes
        const existingNodes = props.graphData?.nodes || [];
        const updateMap = new Map(args.nodes.map(n => [n.id, n]));

        updatedNodes = existingNodes.map(existingNode => {
          const partialUpdate = updateMap.get(existingNode.id);
          if (partialUpdate) {
            // Surgical merge: only update specified fields
            return {
              ...existingNode,
              ...partialUpdate,
              updatedAt: new Date().toISOString(),
              updatedBy: userId,
            };
          }
          return existingNode;
        });

        console.log('✂️ Implicit node patch detected: merging partial updates with existing nodes');
      } else {
        // Full node replacement mode (existing behavior)
        updatedNodes = updatedNodes.length > 0 ? updatedNodes : (props.graphData?.nodes || []);
      }
      // === END NEW ===

      const updatedEdges = args?.edges || props.graphData?.edges || []
      const updatedMetadata = args?.metadata ? { ...props.graphData?.metadata, ...args.metadata } : props.graphData?.metadata

      const updatedGraphData = {
        id: currentGraphId,
        nodes: updatedNodes,
        edges: updatedEdges,
        metadata: {
          ...updatedMetadata,
          updated: new Date().toISOString(),
          updatedBy: userId,
        },
      }

      // === NEW: Approval Modal Disabled - Save Directly ===
      // TODO: Approval workflow needs redesign to work with async tool execution
      // For now, skip approval modal and save changes directly
      // Extract which nodes are being changed and what fields changed
      const changedNodes = args?.nodes || [];
      if (changedNodes.length > 0) {
        console.log('Graph update detected:', changedNodes.length, 'node(s) being changed');
        // Approval modal temporarily disabled - proceeding with save
      }
      // === END NEW ===

      // If no nodes to change, proceed with saving
      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userStore.role || 'Superadmin',
        },
        body: JSON.stringify({
          id: currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update graph: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      // Update the store
      graphStore.setCurrentGraph(updatedGraphData)

      // Emit event to refresh the graph viewer
      emit('graph-updated', { graphId: currentGraphId, graphData: updatedGraphData })

      return {
        status: 'success',
        graphId: currentGraphId,
        message: `Graph updated successfully`,
        nodesModified: updatedNodes.length,
        edgesModified: updatedEdges.length,
        patchMode: isPartialUpdate,
      }
    }

    if (toolName === 'graph_node_search_replace') {
      // Fast search-and-replace within a node's info field
      const { nodeId, search, replace, replaceAll } = args
      if (!nodeId || !search) {
        throw new Error('nodeId and search are required')
      }
      if (!props.graphData?.nodes) {
        throw new Error('No graph data available')
      }

      const node = props.graphData.nodes.find(n => n.id === nodeId)
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`)
      }

      const originalInfo = node.info || ''
      if (!originalInfo.includes(search)) {
        return {
          status: 'not_found',
          message: `Search text not found in node "${node.label || nodeId}". No changes made.`,
        }
      }

      const newInfo = replaceAll
        ? originalInfo.split(search).join(replace)
        : originalInfo.replace(search, replace)

      const occurrences = replaceAll
        ? (originalInfo.split(search).length - 1)
        : 1

      // Apply the change to the node in graphData
      node.info = newInfo

      // Save the graph with the updated node
      const currentGraphId = props.graphData?.id || knowledgeGraphStore.currentGraphId
      if (currentGraphId) {
        const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentGraphId,
            graphData: props.graphData,
            override: true,
          }),
        })
        if (!response.ok) {
          throw new Error(`Failed to save: ${response.status}`)
        }
        const result = await response.json()
        if (result?.newVersion) {
          knowledgeGraphStore.setCurrentVersion(result.newVersion)
        }
      }

      return {
        status: 'success',
        nodeId,
        nodeLabel: node.label || nodeId,
        occurrencesReplaced: occurrences,
        message: `Replaced ${occurrences} occurrence(s) of "${search}" with "${replace}" in node "${node.label || nodeId}".`,
      }
    }

    if (toolName === 'graph_attach_css_to_html') {
      const currentGraphId = props.graphData?.id || knowledgeGraphStore.currentGraphId
      if (!currentGraphId) {
        throw new Error('No current graph loaded.')
      }
      const cssNodeId = String(args?.cssNodeId || '').trim()
      const htmlNodeId = String(args?.htmlNodeId || '').trim()
      const replaceExisting = args?.replaceExisting !== false
      if (!cssNodeId || !htmlNodeId) {
        throw new Error('cssNodeId and htmlNodeId are required')
      }

      const currentGraph = props.graphData || knowledgeGraphStore.currentGraph
      const nodes = Array.isArray(currentGraph?.nodes) ? currentGraph.nodes : []
      const edges = Array.isArray(currentGraph?.edges) ? currentGraph.edges.slice() : []

      const cssNode = nodes.find((n) => n.id === cssNodeId)
      if (!cssNode) throw new Error(`CSS node not found: ${cssNodeId}`)
      const htmlNode = nodes.find((n) => n.id === htmlNodeId)
      if (!htmlNode) throw new Error(`HTML node not found: ${htmlNodeId}`)

      if (cssNode.type && cssNode.type !== 'css-node') {
        throw new Error(`Node ${cssNodeId} is type "${cssNode.type}", expected "css-node"`)
      }
      if (htmlNode.type && htmlNode.type !== 'html-node') {
        throw new Error(`Node ${htmlNodeId} is type "${htmlNode.type}", expected "html-node"`)
      }

      let removedStylesEdges = 0
      let nextEdges = edges
      if (replaceExisting) {
        nextEdges = nextEdges.filter((edge) => {
          const isStyles = String(edge?.label || edge?.type || '').toLowerCase() === 'styles'
          const matchTarget = edge?.target === htmlNodeId
          if (isStyles && matchTarget) removedStylesEdges += 1
          return !(isStyles && matchTarget)
        })
      }

      const hasEdge = nextEdges.some((edge) => {
        const isStyles = String(edge?.label || edge?.type || '').toLowerCase() === 'styles'
        return isStyles && edge?.source === cssNodeId && edge?.target === htmlNodeId
      })
      if (!hasEdge) {
        nextEdges.push({
          id: createGraphId('edge'),
          source: cssNodeId,
          target: htmlNodeId,
          type: 'styles',
          label: 'styles',
        })
      }

      const updatedGraphData = {
        ...currentGraph,
        id: currentGraphId,
        nodes,
        edges: nextEdges,
        metadata: {
          ...(currentGraph?.metadata || {}),
          updated: new Date().toISOString(),
          updatedBy: userId,
        },
      }

      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userStore.role || 'Superadmin',
        },
        body: JSON.stringify({
          id: currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update graph: ${response.status} - ${errorText}`)
      }
      await response.json().catch(() => ({}))

      knowledgeGraphStore.setCurrentGraph(updatedGraphData)
      emit('graph-updated', { graphId: currentGraphId, graphData: updatedGraphData })

      return {
        status: 'success',
        graphId: currentGraphId,
        cssNodeId,
        htmlNodeId,
        replaceExisting,
        removedStylesEdges,
        createdStylesEdge: !hasEdge,
        message: `Attached css node "${cssNodeId}" to html node "${htmlNodeId}".`,
      }
    }

    if (toolName === 'graph_detach_css_from_html') {
      const currentGraphId = props.graphData?.id || knowledgeGraphStore.currentGraphId
      if (!currentGraphId) {
        throw new Error('No current graph loaded.')
      }
      const cssNodeId = String(args?.cssNodeId || '').trim()
      const htmlNodeId = String(args?.htmlNodeId || '').trim()
      if (!cssNodeId && !htmlNodeId) {
        throw new Error('Provide cssNodeId and/or htmlNodeId')
      }

      const currentGraph = props.graphData || knowledgeGraphStore.currentGraph
      const edges = Array.isArray(currentGraph?.edges) ? currentGraph.edges : []
      const nextEdges = edges.filter((edge) => {
        const isStyles = String(edge?.label || edge?.type || '').toLowerCase() === 'styles'
        if (!isStyles) return true
        if (cssNodeId && edge?.source !== cssNodeId) return true
        if (htmlNodeId && edge?.target !== htmlNodeId) return true
        return false
      })
      const removedStylesEdges = edges.length - nextEdges.length

      const updatedGraphData = {
        ...currentGraph,
        id: currentGraphId,
        nodes: Array.isArray(currentGraph?.nodes) ? currentGraph.nodes : [],
        edges: nextEdges,
        metadata: {
          ...(currentGraph?.metadata || {}),
          updated: new Date().toISOString(),
          updatedBy: userId,
        },
      }

      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userStore.role || 'Superadmin',
        },
        body: JSON.stringify({
          id: currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update graph: ${response.status} - ${errorText}`)
      }
      await response.json().catch(() => ({}))

      knowledgeGraphStore.setCurrentGraph(updatedGraphData)
      emit('graph-updated', { graphId: currentGraphId, graphData: updatedGraphData })

      return {
        status: 'success',
        graphId: currentGraphId,
        cssNodeId: cssNodeId || null,
        htmlNodeId: htmlNodeId || null,
        removedStylesEdges,
        message: `Detached ${removedStylesEdges} styles edge(s).`,
      }
    }

    if (toolName === 'graph_get_current_data') {
      // Get the current graph data in a format suitable for manipulation
      if (!props.graphData) {
        throw new Error('No graph data available')
      }

      return {
        status: 'success',
        graphId: props.graphData?.id || 'unknown',
        title: props.graphData?.metadata?.title || 'Untitled',
        nodeCount: (props.graphData?.nodes || []).length,
        edgeCount: (props.graphData?.edges || []).length,
        sampleNodes: (props.graphData?.nodes || []).slice(0, 5).map(n => ({
          id: n.id,
          label: n.label,
          type: n.type,
        })),
        message: 'Current graph data retrieved',
      }
    }

    throw new Error(`Unknown graph manipulation tool: ${toolName}`)
  } catch (error) {
    console.error('Graph manipulation tool execution error:', error)
    return { error: error.message, status: 'failed' }
  }
}

/**
 * Execute a Proff API tool call
 * @param {string} toolName - The function name to call
 * @param {object} args - The function arguments
 * @returns {Promise<object>} - The API response
 */
async function executeProffTool(toolName, args) {
  const userId = userStore.user_id || 'system'

  try {
    if (toolName === 'proff_search_companies') {
      const response = await fetch(`${PROFF_API_BASE}/search?query=${encodeURIComponent(args.query)}&userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'proff_get_financials') {
      const response = await fetch(`${PROFF_API_BASE}/financials/${args.orgNr}?userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'proff_get_company_details') {
      const response = await fetch(`${PROFF_API_BASE}/company/${args.orgNr}?userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'proff_search_persons') {
      const response = await fetch(`${PROFF_API_BASE}/persons?query=${encodeURIComponent(args.query)}&userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'proff_get_person_details') {
      const response = await fetch(`${PROFF_API_BASE}/person/${args.personId}?userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'proff_find_business_network') {
      const response = await fetch(`${PROFF_API_BASE}/network?from=${args.fromPersonId}&to=${args.toPersonId}&userId=${userId}`)
      if (!response.ok) throw new Error(`Proff API error: ${response.status}`)
      return await response.json()
    }

    throw new Error(`Unknown tool: ${toolName}`)
  } catch (error) {
    console.error('Proff tool execution error:', error)
    return { error: error.message }
  }
}

/**
 * Execute a Sources API tool call
 * @param {string} toolName - The function name to call
 * @param {object} args - The function arguments
 * @returns {Promise<object>} - The API response
 */
async function executeSourcesTool(toolName, args) {
  try {
    if (toolName === 'sources_search') {
      let url = `${SOURCES_API_BASE}/search?query=${encodeURIComponent(args.query)}`
      if (args.sources) url += `&sources=${encodeURIComponent(args.sources)}`
      if (args.days) url += `&days=${args.days}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'sources_get_hearings') {
      let url = `${SOURCES_API_BASE}/hearings`
      if (args.topic) url += `?topic=${encodeURIComponent(args.topic)}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'sources_environment_news') {
      let url = `${SOURCES_API_BASE}/environment`
      if (args.limit) url += `?limit=${args.limit}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'sources_list_feeds') {
      const response = await fetch(`${SOURCES_API_BASE}/feeds`)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'sources_google_news') {
      let url = `${SOURCES_API_BASE}/googlenews?query=${encodeURIComponent(args.query)}`
      if (args.limit) url += `&limit=${args.limit}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    if (toolName === 'sources_web_search') {
      let url = `${SOURCES_API_BASE}/websearch?query=${encodeURIComponent(args.query)}`
      if (args.limit) url += `&limit=${args.limit}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sources API error: ${response.status}`)
      return await response.json()
    }

    throw new Error(`Unknown sources tool: ${toolName}`)
  } catch (error) {
    console.error('Sources tool execution error:', error)
    return { error: error.message }
  }
}

const createTemplateNodeId = () => {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const fetchToolTemplates = async ({ force = false } = {}) => {
  if (toolTemplatesLoaded.value && !force) return toolTemplates.value
  if (toolTemplatesLoading.value) return toolTemplates.value

  toolTemplatesLoading.value = true
  toolTemplatesError.value = ''

  try {
    if (!canUseTemplateTools.value) {
      throw new Error('Admin access required for template tools')
    }

    const response = await fetch(TOOL_TEMPLATES_ENDPOINT, {
      headers: {
        'X-API-Token': userStore.emailVerificationToken || '',
        'x-user-role': userStore.role || '',
        Accept: 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tool templates: ${response.status}`)
    }

    const data = await response.json()
    toolTemplates.value = Array.isArray(data.results) ? data.results : []
    toolTemplatesLoaded.value = true
    return toolTemplates.value
  } catch (error) {
    console.error('Failed to load tool templates:', error)
    toolTemplatesError.value = error.message || 'Failed to load tool templates'
    return []
  } finally {
    toolTemplatesLoading.value = false
  }
}

async function executeTemplateTool(toolName, args) {
  try {
    if (!isViewerContext.value) {
      throw new Error('Template tools are only available in the GNewViewer context.')
    }

    if (toolName === 'graph_template_catalog') {
      const templates = await fetchToolTemplates()
      const catalog = templates.map((template) => ({
        id: template.id,
        name: template.name,
        nodeType: template.nodeType || template.nodes?.[0]?.type || null,
        category: template.category || 'General',
        description: template.description || template.ai_instructions || '',
      }))
      return { templates: catalog }
    }

    if (toolName === 'graph_template_insert') {
      const templates = await fetchToolTemplates()
      const templateId = args?.template_id || args?.templateId || ''
      const template = templates.find((t) => t.id === templateId) ||
        templates.find((t) => t.name === args?.template_name)

      if (!template) {
        throw new Error('Template not found. Use graph_template_catalog first.')
      }

      const baseNode = Array.isArray(template.nodes) ? { ...template.nodes[0] } : null
      if (!baseNode || !baseNode.type) {
        throw new Error('Template has no valid node definition.')
      }

      const overrides = args?.node_overrides || {}
      if (!overrides.label && args?.label) overrides.label = args.label
      if (!overrides.info && args?.info) overrides.info = args.info
      if (!overrides.description && args?.description) overrides.description = args.description

      if (overrides.info && typeof overrides.info !== 'string') {
        overrides.info = JSON.stringify(overrides.info)
      }

      // Calculate position for new node
      const existingNodes = props.graphData?.nodes || []
      const maxY = existingNodes.reduce((max, n) => Math.max(max, n.position?.y || 0), 0)
      const defaultPosition = { x: 100, y: maxY + 150 }

      const newNode = {
        ...baseNode,
        ...overrides,
        id: createTemplateNodeId(),
        position: overrides.position || baseNode.position || defaultPosition,
        bibl: Array.isArray(overrides.bibl) ? overrides.bibl : (baseNode.bibl || []),
        visible: overrides.visible !== undefined ? overrides.visible : (baseNode.visible ?? true),
        createdAt: new Date().toISOString(),
        createdBy: userStore.user_id || 'system',
      }

      // Get current graph data
      const currentGraphId = props.graphData?.id || knowledgeGraphStore.currentGraphId
      if (!currentGraphId) {
        throw new Error('No current graph loaded.')
      }

      // Add new node to existing nodes
      const updatedNodes = [...existingNodes, newNode]
      const updatedEdges = props.graphData?.edges || []

      const updatedGraphData = {
        id: currentGraphId,
        nodes: updatedNodes,
        edges: updatedEdges,
        metadata: {
          ...props.graphData?.metadata,
          updated: new Date().toISOString(),
          updatedBy: userStore.user_id || 'system',
        },
      }

      // Save to backend
      const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userStore.role || 'Superadmin',
        },
        body: JSON.stringify({
          id: currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to insert node: ${response.status} - ${errorText}`)
      }

      // Update the store
      knowledgeGraphStore.setCurrentGraph(updatedGraphData)

      // Also emit for UI update
      emit('insert-node', { node: newNode, source: 'template-tool', templateId: template.id })

      return {
        status: 'ok',
        inserted: true,
        nodeId: newNode.id,
        nodeType: newNode.type,
        templateId: template.id,
        message: `Node "${newNode.label}" added using template "${template.name}"`,
      }
    }

    throw new Error(`Unknown template tool: ${toolName}`)
  } catch (error) {
    console.error('Template tool execution error:', error)
    return { error: error.message }
  }
}

/**
 * Process tool calls from AI response and get final answer
 * @param {object} data - The AI response with tool_calls
 * @param {array} grokMessages - The conversation messages
 * @param {string} endpoint - The AI endpoint
 * @param {object} requestBody - The original request body
 * @returns {Promise<{message: string, usedProffAPI: boolean, proffData: object, sourcesData: object}>} - The final AI message and tool usage info
 */
async function processToolCalls(data, grokMessages, endpoint, requestBody) {
  const safeParseToolArgs = (rawArgs) => {
    if (!rawArgs) return {}
    if (typeof rawArgs === 'object') return rawArgs
    try {
      return JSON.parse(rawArgs)
    } catch (_) {
      return {}
    }
  }

  let currentData = data
  let currentMessages = [...grokMessages]
  let usedProffAPI = false
  let usedSourcesAPI = false
  let proffData = null
  let sourcesData = null
  let iterations = 0
  const maxIterations = 5

  while (iterations < maxIterations) {
    const toolCalls = currentData.choices?.[0]?.message?.tool_calls || []
    if (!toolCalls.length) break

    iterations += 1
    console.log('Processing tool calls:', toolCalls.map(t => t.function.name))

    if (toolCalls.some(t => t.function.name.startsWith('proff_'))) usedProffAPI = true
    if (toolCalls.some(t => t.function.name.startsWith('sources_'))) usedSourcesAPI = true

    const toolResults = []
    for (const toolCall of toolCalls) {
      const { name, arguments: argsStr } = toolCall.function
      const args = safeParseToolArgs(argsStr)

      console.log(`Executing tool: ${name}`, args)

      let result
      if (name.startsWith('graph_template_')) {
        result = await executeTemplateTool(name, args)
      } else if (name.startsWith('graph_save_') || name.startsWith('graph_update_') || name === 'graph_get_current_data' || name === 'graph_node_search_replace') {
        result = await executeGraphManipulationTool(name, args)
      } else if (name.startsWith('sources_')) {
        result = await executeSourcesTool(name, args)
        if (!sourcesData) sourcesData = {}
        sourcesData[name] = result
        if (result.results) sourcesData.results = result.results
      } else {
        result = await executeProffTool(name, args)
        if (!proffData) proffData = {}
        proffData[name] = result
        if (result.person) proffData.person = result.person
        if (result.persons) proffData.persons = result.persons
        if (result.company) proffData.company = result.company
        if (result.companies) proffData.companies = result.companies
        if (result.paths) proffData.paths = result.paths
        if (result.degreesOfSeparation !== undefined) proffData.degreesOfSeparation = result.degreesOfSeparation
      }

      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: name,
        content: JSON.stringify(result, null, 2)
      })
    }

    currentMessages = [
      ...currentMessages,
      currentData.choices[0].message,
      ...toolResults
    ]

    const nextBody = {
      ...requestBody,
      messages: currentMessages
    }

    const nextResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextBody)
    })

    if (!nextResponse.ok) {
      throw new Error(`Follow-up API error: ${nextResponse.status}`)
    }

    currentData = await nextResponse.json()
  }

  if (iterations >= maxIterations) {
    return {
      message: 'Tool chain reached maximum iterations. Please try a simpler question.',
      usedProffAPI,
      usedSourcesAPI,
      proffData,
      sourcesData
    }
  }

  return {
    message: currentData.choices?.[0]?.message?.content,
    usedProffAPI,
    usedSourcesAPI,
    proffData,
    sourcesData
  }
}

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/ogg; codecs=opus',
  'audio/opus',
  'audio/webm',
  'video/mp4',
  'video/webm'
])

const SUPPORTED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.mp4', '.webm']
const AUDIO_ENDPOINT = 'https://openai.vegvisr.org/audio'
const CHUNK_DURATION_SECONDS = 120
const GRAPH_PROCESS_ENDPOINT = 'https://grok.vegvisr.org/process-transcript'
const KNOWLEDGE_GRAPH_SAVE_ENDPOINT = 'https://knowledge.vegvisr.org/saveGraphWithHistory'

// Advanced Graph Creation
const showAdvancedGraphModal = ref(false)
const selectedMessage = ref(null)
const selectedMessageIndex = ref(null)
const availableTemplates = ref([])
const selectedTemplates = ref([])
const templatesLoading = ref(false)
const templatesFetchError = ref('')
const toolTemplates = ref([])
const toolTemplatesLoading = ref(false)
const toolTemplatesError = ref('')
const toolTemplatesLoaded = ref(false)
const MAX_GRAPH_JOBS = 4

// Case Graph Creation (from person network data)
const showCaseGraphModal = ref(false)
const caseGraphPersonData = ref(null)
const caseGraphTitle = ref('')
const caseGraphCreating = ref(false)
const caseGraphStatus = ref('')
const caseGraphError = ref('')
const caseGraphCreatedId = ref(null)
const caseGraphSourceMessage = ref(null)

// Raw JSON Viewer
const showRawJsonModal = ref(false)
const rawJsonCopyState = ref('Copy JSON')

// HTML Import (Phase 1: paste HTML/snippet)
const showHtmlImportModal = ref(false)
const htmlImportTitle = ref('')
const htmlImportDescription = ref('')
const htmlImportUrl = ref('')
const htmlImportContent = ref('')
const htmlImportRemoveInlineStyles = ref(false)
const htmlImportSaving = ref(false)
const htmlImportError = ref('')
const htmlImportCreatedGraphId = ref('')

const graphProcessingJobs = ref([])

const CHAT_HISTORY_BASE_URL = 'https://api.vegvisr.org/chat-history'
const HTML_IMPORT_WORKER_BASE = 'https://test-domain-worker.torarnehave.workers.dev'
const RESUME_SESSION_ON_LOAD = false
const chatSessionId = ref(null)
const lastInitializedSessionKey = ref(null)
let sessionInitPromise = null
const historyLoading = ref(false)
const historyError = ref('')
const historyLastLoaded = ref(null)
const availableSessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sessionListOpen = ref(false)
const deletingSessionId = ref(null)
const deleteSessionError = ref('')

// Computed
const graphContextSummary = computed(() => {
  if (!props.graphData || !props.graphData.nodes) return 'No graph data'
  const nodeCount = props.graphData.nodes.length
  const edgeCount = props.graphData.edges?.length || 0
  return `${nodeCount} nodes, ${edgeCount} edges`
})

const hasSelectionContext = computed(() => {
  const text = props.selectionContext?.text
  return Boolean(text && text.trim().length > 0)
})

const selectionContextSummary = computed(() => {
  if (!hasSelectionContext.value) return ''
  const text = props.selectionContext.text.trim()
  return text.length > 140 ? `${text.substring(0, 140)}…` : text
})

const selectionContextLabel = computed(() => {
  if (!hasSelectionContext.value) return 'Highlighted text'
  return props.selectionContext?.nodeLabel || 'Highlighted text'
})

// Suggested questions based on selection context
const suggestedQuestions = computed(() => {
  const selection = props.selectionContext
  if (!selection?.selectedNodes?.length) return []

  const nodes = selection.selectedNodes
  const questions = []

  // Check if nodes are person-profile type (from Proff network)
  const isPersonNetwork = nodes.some(n => n.type === 'person-profile' || n.data?.source === 'proff')

  if (nodes.length === 1) {
    // Single node selected
    const node = nodes[0]
    const name = node.label || node.data?.name || 'denne personen'

    if (isPersonNetwork) {
      questions.push({
        icon: '🔍',
        label: 'Utvid nettverk',
        query: `Utvid nettverket for ${name}. Vis alle forbindelser og roller.`,
        description: `Hent flere detaljer om ${name} sitt nettverk`
      })
      questions.push({
        icon: '🌐',
        label: 'Lag nettverkskart',
        query: `Lag et detaljert nettverkskart for ${name}. Vis alle styreposisjoner og selskaper.`,
        description: `Generer et visuelt nettverkskart for ${name}`
      })
      questions.push({
        icon: '📊',
        label: 'Analyser roller',
        query: `Analyser rollene og posisjonene til ${name}. Hva er de viktigste selskapene?`,
        description: `Få en analyse av ${name} sine roller`
      })
    } else {
      questions.push({
        icon: '💡',
        label: 'Forklar',
        query: `Forklar innholdet i denne noden: ${name}`,
        description: 'Få en forklaring av nodeinnholdet'
      })
    }
  } else if (nodes.length === 2) {
    // Two nodes selected
    const name1 = nodes[0].label || nodes[0].data?.name || 'Person 1'
    const name2 = nodes[1].label || nodes[1].data?.name || 'Person 2'

    if (isPersonNetwork) {
      questions.push({
        icon: '🔗',
        label: 'Finn forbindelse',
        query: `Finn forbindelsen mellom ${name1} og ${name2}. Hvilke selskaper og roller knytter dem sammen?`,
        description: `Finn hvordan ${name1} og ${name2} er koblet`
      })
      questions.push({
        icon: '⚖️',
        label: 'Sammenlign',
        query: `Sammenlign ${name1} og ${name2}. Hva har de til felles og hva skiller dem?`,
        description: `Sammenlign de to personene`
      })
    }
    questions.push({
      icon: '🔍',
      label: 'Analyser relasjon',
      query: `Analyser relasjonen mellom ${name1} og ${name2}.`,
      description: 'Analyser forbindelsen mellom de valgte nodene'
    })
  } else if (nodes.length > 2) {
    // Multiple nodes selected
    const names = nodes.map(n => n.label || n.data?.name).filter(Boolean).slice(0, 5)
    const namesStr = names.join(', ')

    if (isPersonNetwork) {
      questions.push({
        icon: '🕸️',
        label: 'Finn fellesnevner',
        query: `Analyser gruppen: ${namesStr}. Hva har disse personene til felles? Hvilke selskaper deler de?`,
        description: 'Finn hva de valgte personene har felles'
      })
      questions.push({
        icon: '📈',
        label: 'Kartlegg nettverk',
        query: `Kartlegg nettverket mellom disse personene: ${namesStr}. Vis alle forbindelser.`,
        description: 'Vis nettverket mellom de valgte personene'
      })
    }
    questions.push({
      icon: '📋',
      label: 'Oppsummer',
      query: `Oppsummer de valgte nodene: ${namesStr}`,
      description: 'Få en oppsummering av alle valgte noder'
    })
  }

  return questions
})

const askSuggestedQuestion = (query) => {
  userInput.value = query
  sendMessage()
}

/**
 * Run a web search via Perplexity provider
 * Switches to Perplexity, sets the query, and sends the message
 */
const runPerplexitySearch = (query) => {
  // Store current provider to potentially restore later
  const previousProvider = provider.value

  // Switch to Perplexity
  provider.value = 'perplexity'

  // Clear any existing suggestions since we're running one
  suggestedWebSearches.value = []

  // Set the query and send
  userInput.value = query
  sendMessage()

  console.log(`🌐 Running Perplexity search: "${query}" (switched from ${previousProvider})`)
}

const canPersistHistory = computed(() => Boolean(userStore.loggedIn && userStore.user_id))
const graphIdentifier = computed(() => {
  return (
    knowledgeGraphStore.currentGraphId ||
    props.graphData?.metadata?.id ||
    props.graphData?.metadata?.graphId ||
    props.graphData?.metadata?.slug ||
    props.graphData?.metadata?.title ||
    'grok-graph'
  )
})
const sessionStorageKey = computed(() => {
  if (!canPersistHistory.value || !userStore.user_id) return null
  return `grok-chat-session:${userStore.user_id}:${graphIdentifier.value}`
})

const prefsStorageKey = computed(() => {
  const userPart = userStore.user_id || 'anon'
  return `grok-chat-prefs:${userPart}:${graphIdentifier.value}`
})

const loadChatPreferences = () => {
  if (!prefsStorageKey.value || typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(prefsStorageKey.value)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed?.provider && providerOptions.some(opt => opt.value === parsed.provider)) {
      provider.value = parsed.provider
    }
    if (parsed?.openaiModel && openaiModelOptions.some(opt => opt.value === parsed.openaiModel)) {
      openaiModel.value = parsed.openaiModel
    }
    if (parsed?.claudeModel && claudeModelOptions.some(opt => opt.value === parsed.claudeModel)) {
      claudeModel.value = parsed.claudeModel
    }
    if (typeof parsed?.useProffTools === 'boolean') {
      useProffTools.value = parsed.useProffTools
    }
    if (typeof parsed?.useSourcesTools === 'boolean') {
      useSourcesTools.value = parsed.useSourcesTools
    }
    if (typeof parsed?.useTemplateTools === 'boolean') {
      useTemplateTools.value = parsed.useTemplateTools
    }
    if (typeof parsed?.useWebSearch === 'boolean') {
      useWebSearch.value = parsed.useWebSearch
    }
    if (!canUseTemplateTools.value) {
      useTemplateTools.value = false
    }
  } catch (error) {
    console.warn('Failed to load chat preferences:', error)
  }
}

const persistChatPreferences = () => {
  if (!prefsStorageKey.value || typeof window === 'undefined') return
  try {
    const payload = {
      provider: provider.value,
      openaiModel: openaiModel.value,
      claudeModel: claudeModel.value,
      useProffTools: useProffTools.value,
      useSourcesTools: useSourcesTools.value,
      useTemplateTools: useTemplateTools.value,
      useWebSearch: useWebSearch.value
    }
    localStorage.setItem(prefsStorageKey.value, JSON.stringify(payload))
  } catch (error) {
    console.warn('Failed to persist chat preferences:', error)
  }
}

const historyLastLoadedLabel = computed(() => {
  if (!historyLastLoaded.value) return ''
  try {
    return new Date(historyLastLoaded.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (_) {
    return ''
  }
})

const renamingSessionId = ref(null)
const renameInput = ref('')
const renameSaving = ref(false)
const renameError = ref('')

let lastSelectionFingerprint = ''
watch(
  () => props.selectionContext?.text,
  (newText) => {
    const trimmed = typeof newText === 'string' ? newText.trim() : ''
    if (!trimmed) {
      lastSelectionFingerprint = ''
      useSelectionContext.value = false
      return
    }

    const fingerprint = `${trimmed}::${props.selectionContext?.nodeId || ''}`
    if (!lastSelectionFingerprint || fingerprint !== lastSelectionFingerprint) {
      useSelectionContext.value = true
      lastSelectionFingerprint = fingerprint
    }
  },
  { immediate: true }
)

watch(
  () => prefsStorageKey.value,
  () => {
    loadChatPreferences()
  },
  { immediate: true }
)

watch(
  [provider, openaiModel, claudeModel, useProffTools, useSourcesTools, useTemplateTools, useWebSearch],
  () => {
    persistChatPreferences()
  }
)

watch(canUseTemplateTools, (canUse) => {
  if (!canUse) {
    useTemplateTools.value = false
  }
})

// Prefer a user-provided profile image; fall back to an initial
const userAvatarUrl = computed(() => userStore.profileimage || null)
const userInitial = computed(() => {
  const source = userStore.email || userStore.user_id || 'You'
  return source.charAt(0).toUpperCase()
})

const canCreateGraph = computed(() => Boolean(userStore.emailVerificationToken))
const htmlImportCharacterCount = computed(() => htmlImportContent.value.length)
const htmlImportSizeKb = computed(() => (htmlImportCharacterCount.value / 1024).toFixed(1))

// Provider image support
const providerSupportsImages = computed(() => {
  // Grok does not support image analysis
  return provider.value !== 'grok'
})

// Group templates by category
const templatesByCategory = computed(() => {
  const grouped = {}
  availableTemplates.value.forEach(template => {
    const cat = template.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(template)
  })
  return grouped
})

const providerMeta = (key) => {
  if (key === 'openai') return { label: 'OpenAI', icon: openaiIcon, initials: 'OA' }
  if (key === 'claude') return { label: 'Claude', icon: claudeIcon, initials: 'CL' }
  if (key === 'gemini') return { label: 'Gemini', icon: geminiIcon, initials: 'GM' }
  if (key === 'perplexity') return { label: 'Perplexity', icon: perplexityIcon, initials: 'PP' }
  return { label: 'Grok', icon: grokIcon, initials: 'G' }
}

// Speech Recognition Setup
onMounted(() => {
  // Check for browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRecognition) {
    speechSupported.value = true
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US' // Can be changed to other languages

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // Append final transcript to user input
      if (finalTranscript) {
        userInput.value += (userInput.value ? ' ' : '') + finalTranscript
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      isRecording.value = false
      if (event.error === 'not-allowed') {
        errorMessage.value = 'Microphone access denied. Please allow microphone access in your browser settings.'
      }
    }

    recognition.onend = () => {
      isRecording.value = false
    }
  }
})

const toggleSpeechRecognition = () => {
  if (!recognition) return

  if (isRecording.value) {
    recognition.stop()
    isRecording.value = false
  } else {
    recognition.start()
    isRecording.value = true
    errorMessage.value = '' // Clear any previous errors
  }
}

// Methods
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const openImageSelector = () => {
  isImageSelectorOpen.value = true
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
}

const handleBackgroundImageChange = (imageData) => {
  backgroundImageUrl.value = imageData.newUrl
  localStorage.setItem('grok-chat-background', imageData.newUrl)
  closeImageSelector()
}

const clearBackgroundImage = () => {
  backgroundImageUrl.value = ''
  localStorage.removeItem('grok-chat-background')
}

const triggerImageUpload = () => {
  if (provider.value === 'grok') return
  imageFileInput.value?.click()
}

const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !file.type.startsWith('image/')) {
    errorMessage.value = 'Please select a valid image file.'
    return
  }

  isUploadingImage.value = true
  errorMessage.value = ''

  try {
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedImage.value = {
        file: file,
        preview: e.target.result,
        base64: e.target.result.split(',')[1],
        mimeType: file.type
      }
    }
    reader.readAsDataURL(file)
  } catch (err) {
    console.error('Error uploading image:', err)
    errorMessage.value = 'Failed to upload image. Please try again.'
  } finally {
    isUploadingImage.value = false
    event.target.value = ''
  }
}

const clearUploadedImage = () => {
  uploadedImage.value = null
}

const copyRawJsonToClipboard = async () => {
  const jsonContext = buildRawJsonContext()
  if (jsonContext) {
    try {
      await navigator.clipboard.writeText(jsonContext.jsonString)
      rawJsonCopyState.value = 'Copied!'
      setTimeout(() => {
        rawJsonCopyState.value = 'Copy JSON'
      }, 2000)
    } catch (err) {
      console.error('Failed to copy JSON:', err)
      rawJsonCopyState.value = 'Copy failed'
      setTimeout(() => {
        rawJsonCopyState.value = 'Copy JSON'
      }, 2000)
    }
  }
}

const downloadRawJson = () => {
  const jsonContext = buildRawJsonContext()
  if (jsonContext) {
    try {
      const element = document.createElement('a')
      const fileName = props.graphData?.metadata?.title?.replace(/\s+/g, '_') || 'graph-data'
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(jsonContext.jsonString))
      element.setAttribute('download', `${fileName}.json`)
      element.style.display = 'none'
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    } catch (err) {
      console.error('Failed to download JSON:', err)
    }
  }
}

// === NEW: Graph Update Approval Functions ===
/**
 * Approve and save the pending graph update
 */
const approveGraphUpdate = async () => {
  if (!pendingApproval.value) return;

  try {
    approvalStatus.value = { type: 'loading', message: 'Saving approved changes...' };

    const graphData = pendingApproval.value.graphData;
    const graphStore = pendingApproval.value.graphStore;
    const currentGraphId = graphData.id;

    // Send the update to backend
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentGraphId,
        graphData: graphData,
        override: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update graph: ${response.status} - ${errorText}`);
    }

    // Update the store
    graphStore.setCurrentGraph(graphData);

    approvalStatus.value = { type: 'success', message: '✅ Changes saved successfully!' };

    // Close modal after brief delay
    setTimeout(() => {
      showApprovalModal.value = false;
      pendingApproval.value = null;
      approvalStatus.value = null;

      // Resolve the promise with success
      if (pendingApprovalResolve) {
        pendingApprovalResolve({
          status: 'success',
          graphId: currentGraphId,
          message: 'Graph updated successfully',
          nodesModified: graphData.nodes?.length || 0,
        });
        pendingApprovalResolve = null;
      }
    }, 1500);
  } catch (error) {
    console.error('Error saving approved update:', error);
    approvalStatus.value = { type: 'error', message: `❌ Error: ${error.message}` };

    // Resolve promise with error
    if (pendingApprovalResolve) {
      pendingApprovalResolve({
        status: 'failed',
        error: error.message,
      });
      pendingApprovalResolve = null;
    }
  }
};

/**
 * Cancel and discard the pending graph update
 */
const cancelGraphUpdate = () => {
  showApprovalModal.value = false;
  pendingApproval.value = null;
  approvalStatus.value = null;

  // Resolve promise with cancellation
  if (pendingApprovalResolve) {
    pendingApprovalResolve({
      status: 'cancelled',
      message: 'Update was cancelled by user',
    });
    pendingApprovalResolve = null;
  }
};
// === END NEW ===

// Drag and drop handlers
const handleDragEnter = (event) => {
  dragCounter++
  isDragOver.value = true
}

const handleDragOver = (event) => {
  // Keep the drag-over state active
  isDragOver.value = true
}

const handleDragLeave = (event) => {
  dragCounter--
  if (dragCounter === 0) {
    isDragOver.value = false
  }
}

const handleDrop = async (event) => {
  dragCounter = 0
  isDragOver.value = false

  if (isStreaming.value) return

  // First, check for image URL data (from dragging images within the app)
  const imageUrl = event.dataTransfer?.getData('text/uri-list') ||
                   event.dataTransfer?.getData('text/plain') ||
                   event.dataTransfer?.getData('application/x-vegvisr-image')

  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    // Check if it looks like an image URL
    const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(imageUrl) ||
                       imageUrl.includes('/image') ||
                       imageUrl.includes('unsplash') ||
                       imageUrl.includes('pexels') ||
                       imageUrl.includes('portfolio') ||
                       imageUrl.includes('r2.cloudflarestorage')

    if (isImageUrl) {
      if (!providerSupportsImages.value) {
        errorMessage.value = `${providerMeta(provider.value).label} does not support image analysis. Please switch to OpenAI, Claude, Gemini, or Perplexity.`
        return
      }
      // Process the URL as an image
      await processImageFromUrl(imageUrl)
      return
    }
  }

  // Next, check for dropped files
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) {
    // No files and no valid URL - maybe it's an image dragged from HTML
    const htmlData = event.dataTransfer?.getData('text/html')
    if (htmlData) {
      const imgMatch = htmlData.match(/src=["']([^"']+)["']/)
      if (imgMatch && imgMatch[1]) {
        const extractedUrl = imgMatch[1]
        if (extractedUrl.startsWith('http://') || extractedUrl.startsWith('https://')) {
          if (!providerSupportsImages.value) {
            errorMessage.value = `${providerMeta(provider.value).label} does not support image analysis. Please switch to OpenAI, Claude, Gemini, or Perplexity.`
            return
          }
          await processImageFromUrl(extractedUrl)
          return
        }
      }
    }
    return
  }

  const file = files[0] // Handle first file only

  // Check if it's an image
  if (file.type.startsWith('image/')) {
    if (!providerSupportsImages.value) {
      errorMessage.value = `${providerMeta(provider.value).label} does not support image analysis. Please switch to OpenAI, Claude, Gemini, or Perplexity.`
      return
    }
    // Process as image
    await processDroppedImage(file)
    return
  }

  // Check if it's an audio file
  if (isSupportedAudioFile(file)) {
    // Process as audio
    await processDroppedAudio(file)
    return
  }

  // Unsupported file type
  errorMessage.value = 'Unsupported file type. Please drop an image or audio file (wav, mp3, m4a, aac, ogg, opus, mp4, webm).'
}

const processDroppedImage = async (file) => {
  errorMessage.value = ''
  isUploadingImage.value = true

  try {
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedImage.value = {
        file: file,
        preview: e.target.result,
        base64: e.target.result.split(',')[1],
        mimeType: file.type
      }
    }
    reader.readAsDataURL(file)
  } catch (err) {
    console.error('Error processing dropped image:', err)
    errorMessage.value = 'Failed to process the dropped image. Please try again.'
  } finally {
    isUploadingImage.value = false
  }
}

const processImageFromUrl = async (url) => {
  errorMessage.value = ''
  isUploadingImage.value = true

  try {
    // Fetch the image and convert to base64
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const blob = await response.blob()
    const mimeType = blob.type || 'image/jpeg'

    // Convert blob to base64
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedImage.value = {
        file: null,
        preview: url, // Use original URL for preview (better quality)
        base64: e.target.result.split(',')[1],
        mimeType: mimeType,
        sourceUrl: url
      }
    }
    reader.readAsDataURL(blob)
  } catch (err) {
    console.error('Error processing image from URL:', err)
    // Fallback: use the URL directly without base64 conversion
    // Some providers may support direct URL analysis
    uploadedImage.value = {
      file: null,
      preview: url,
      base64: null,
      mimeType: 'image/jpeg',
      sourceUrl: url,
      isUrlOnly: true
    }
  } finally {
    isUploadingImage.value = false
  }
}

// Handle paste event for images from clipboard
const handlePaste = async (event) => {
  const clipboardData = event.clipboardData
  if (!clipboardData) return

  // Check for image files in clipboard
  const items = clipboardData.items
  if (!items) return

  for (const item of items) {
    // Check if item is an image
    if (item.type.startsWith('image/')) {
      event.preventDefault() // Prevent default paste behavior for images

      if (!providerSupportsImages.value) {
        errorMessage.value = `${providerMeta(provider.value).label} does not support image analysis. Please switch to OpenAI, Claude, Gemini, or Perplexity.`
        return
      }

      const file = item.getAsFile()
      if (file) {
        await processDroppedImage(file)
      }
      return
    }
  }

  // Check for image URL in plain text (e.g., copied image URL)
  const text = clipboardData.getData('text/plain')
  if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
    const isImageUrl = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(text) ||
                       text.includes('/image') ||
                       text.includes('unsplash') ||
                       text.includes('pexels') ||
                       text.includes('portfolio') ||
                       text.includes('r2.cloudflarestorage')

    if (isImageUrl) {
      event.preventDefault()

      if (!providerSupportsImages.value) {
        errorMessage.value = `${providerMeta(provider.value).label} does not support image analysis. Please switch to OpenAI, Claude, Gemini, or Perplexity.`
        return
      }

      await processImageFromUrl(text)
      return
    }
  }

  // Let normal text paste through
}

const processDroppedAudio = async (file) => {
  errorMessage.value = ''
  audioTranscriptionStatus.value = ''
  audioChunkProgress.value = { current: 0, total: 0 }

  try {
    const duration = await getAudioDurationSeconds(file).catch(() => null)
    selectedAudioFile.value = {
      file,
      name: file.name || 'audio-file',
      size: file.size,
      type: file.type || inferMimeTypeFromExtension(file.name),
      duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    }
    audioAutoDetect.value = true
    audioLanguage.value = 'no'
  } catch (err) {
    console.error('Error processing dropped audio:', err)
    errorMessage.value = 'Failed to process the dropped audio file. Please try again.'
    selectedAudioFile.value = null
  }
}

const triggerAudioUpload = () => {
  audioFileInput.value?.click()
}

const isSupportedAudioFile = (file) => {
  if (!file) return false
  if (file.type && SUPPORTED_AUDIO_MIME_TYPES.has(file.type.toLowerCase())) {
    return true
  }

  const extension = file.name?.toLowerCase().substring(file.name.lastIndexOf('.'))
  return extension ? SUPPORTED_AUDIO_EXTENSIONS.includes(extension) : false
}

const inferMimeTypeFromExtension = (fileName = '') => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  switch (extension) {
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.m4a':
      return 'audio/mp4'
    case '.ogg':
      return 'audio/ogg'
    case '.opus':
      return 'audio/opus'
    case '.aac':
      return 'audio/aac'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    default:
      return 'audio/wav'
  }
}

const getAudioDurationSeconds = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
        resolve(audio.duration || 0)
      }
      audio.onerror = (event) => {
        URL.revokeObjectURL(audio.src)
        reject(event.error || new Error('Unable to read audio metadata'))
      }
      audio.src = URL.createObjectURL(file)
    } catch (err) {
      reject(err)
    }
  })
}

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Unknown'
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const handleAudioFileSelect = async (event) => {
  const file = event.target.files?.[0]
  if (audioFileInput.value) {
    audioFileInput.value.value = ''
  }
  if (!file) return

  if (!isSupportedAudioFile(file)) {
    errorMessage.value = 'Unsupported audio format. Allowed: wav, mp3, m4a, aac, ogg, opus, mp4, webm.'
    return
  }

  errorMessage.value = ''
  audioTranscriptionStatus.value = ''
  audioChunkProgress.value = { current: 0, total: 0 }

  try {
    const duration = await getAudioDurationSeconds(file).catch(() => null)
    selectedAudioFile.value = {
      file,
      name: file.name || 'audio-file',
      size: file.size,
      type: file.type || inferMimeTypeFromExtension(file.name),
      duration: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    }
    audioAutoDetect.value = true
    audioLanguage.value = 'no'
  } catch (err) {
    console.error('Audio selection error:', err)
    errorMessage.value = 'Failed to read the selected audio file. Please try another file.'
    selectedAudioFile.value = null
  }
}

const clearSelectedAudio = () => {
  selectedAudioFile.value = null
  audioProcessing.value = false
  audioTranscriptionStatus.value = ''
  audioChunkProgress.value = { current: 0, total: 0 }
  if (audioFileInput.value) {
    audioFileInput.value.value = ''
  }
}

const callWhisperTranscription = async (blob, fileName) => {
  const formData = new FormData()
  formData.append('file', blob, fileName)
  formData.append('model', 'whisper-1')
  formData.append('userId', userStore.user_id || 'system')
  if (!audioAutoDetect.value && audioLanguage.value) {
    formData.append('language', audioLanguage.value)
  }

  const response = await fetch(AUDIO_ENDPOINT, {
    method: 'POST',
    body: formData,
  })

  const payloadText = await response.text()
  let parsed
  try {
    parsed = JSON.parse(payloadText)
  } catch (_) {
    parsed = null
  }

  if (!response.ok) {
    const detail = parsed?.error || parsed?.message || payloadText || 'Audio transcription failed'
    throw new Error(typeof detail === 'string' ? detail : 'Audio transcription failed')
  }

  return parsed || { text: payloadText }
}

const transcribeSingleAudio = async (file, fileName) => {
  audioTranscriptionStatus.value = 'Uploading audio...'
  const result = await callWhisperTranscription(file, fileName)
  const transcript = (result.text || '').trim()
  streamingContent.value = transcript
  scrollToBottom()
  return {
    text: transcript,
    language: result.language || (audioAutoDetect.value ? 'auto' : audioLanguage.value)
  }
}

const sanitizeFileBaseName = (name = '') => {
  if (!name.includes('.')) return name
  return name.substring(0, name.lastIndexOf('.'))
}

const formatChunkTimestamp = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const audioBufferToWavBlob = (audioBuffer) => {
  return new Promise((resolve) => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(buffer)

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)

    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7fff, true)
        offset += 2
      }
    }

    resolve(new Blob([buffer], { type: 'audio/wav' }))
  })
}

const splitAudioIntoChunks = async (file, chunkDurationSeconds = CHUNK_DURATION_SECONDS, onProgress) => {
  if (typeof window === 'undefined') {
    throw new Error('Audio processing is only available in the browser')
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('This browser does not support audio processing APIs')
  }

  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContextClass()

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const sampleRate = audioBuffer.sampleRate
    const chunkSamples = chunkDurationSeconds * sampleRate
    const totalSamples = audioBuffer.length
    const totalChunks = Math.max(Math.ceil(totalSamples / chunkSamples), 1)

    onProgress?.({ phase: 'info', total: totalChunks })

    const chunks = []
    for (let i = 0; i < totalChunks; i++) {
      const startSample = i * chunkSamples
      const endSample = Math.min(startSample + chunkSamples, totalSamples)
      const chunkLength = endSample - startSample
      const chunkBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, chunkLength, sampleRate)

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel)
        const chunkData = chunkBuffer.getChannelData(channel)
        for (let sample = 0; sample < chunkLength; sample++) {
          chunkData[sample] = channelData[startSample + sample]
        }
      }

      const blob = await audioBufferToWavBlob(chunkBuffer)
      chunks.push({
        blob,
        startTime: startSample / sampleRate,
        endTime: endSample / sampleRate,
      })

      onProgress?.({ phase: 'creating', current: i + 1, total: totalChunks })
    }

    return chunks
  } finally {
    await audioContext.close()
  }
}

const transcribeAudioInChunks = async (file, fileName, durationSeconds) => {
  audioTranscriptionStatus.value = 'Splitting audio into chunks...'
  const chunks = await splitAudioIntoChunks(file, CHUNK_DURATION_SECONDS, (progress) => {
    if (progress.phase === 'creating') {
      audioTranscriptionStatus.value = `Preparing chunk ${progress.current}/${progress.total}...`
    }
  })

  if (!chunks.length) {
    throw new Error('Audio could not be chunked for transcription')
  }

  audioChunkProgress.value = { current: 0, total: chunks.length }
  streamingContent.value = ''
  const combinedSegments = []
  const detectedLanguages = new Set()
  const baseName = sanitizeFileBaseName(fileName)

  for (let i = 0; i < chunks.length; i++) {
    audioChunkProgress.value = { current: i + 1, total: chunks.length }
    audioTranscriptionStatus.value = `Processing chunk ${i + 1}/${chunks.length}...`

    try {
      const chunkResult = await callWhisperTranscription(
        chunks[i].blob,
        `${baseName || 'audio'}_chunk_${i + 1}.wav`
      )

      const chunkText = (chunkResult.text || '').trim()
      const chunkLabel = `[${formatChunkTimestamp(chunks[i].startTime)} - ${formatChunkTimestamp(chunks[i].endTime)}]`

      if (chunkText) {
        const formatted = `${chunkLabel} ${chunkText}`
        combinedSegments.push(formatted)
        streamingContent.value += (streamingContent.value ? '\n\n' : '') + formatted
        scrollToBottom()
      }

      if (chunkResult.language) {
        detectedLanguages.add(chunkResult.language)
      }

      audioTranscriptionStatus.value = `Chunk ${i + 1}/${chunks.length} complete`
    } catch (error) {
      console.error(`Chunk ${i + 1} transcription failed:`, error)
      const chunkLabel = `[${formatChunkTimestamp(chunks[i].startTime)} - ${formatChunkTimestamp(chunks[i].endTime)}]`
      const errorText = `${chunkLabel} [Error: ${error.message}]`
      combinedSegments.push(errorText)
      streamingContent.value += (streamingContent.value ? '\n\n' : '') + errorText
      audioTranscriptionStatus.value = `Chunk ${i + 1}/${chunks.length} failed`
      scrollToBottom()
    }
  }

  return {
    text: combinedSegments.join('\n\n'),
    language:
      detectedLanguages.size === 1
        ? Array.from(detectedLanguages)[0]
        : (audioAutoDetect.value ? 'auto' : audioLanguage.value)
  }
}

const finalizeTranscriptionMessage = (result, fileName) => {
  const transcript = (result?.text || '').trim()
  const languageLabel = audioLanguageOptions.find((opt) => opt.code === result?.language)?.label || result?.language
  const content = [
    `🎧 Transcription for **${fileName}**`,
    languageLabel ? `Language: ${languageLabel}` : null,
    transcript || '_No speech detected_'
  ]
    .filter(Boolean)
    .join('\n\n')

  appendChatMessage({
    role: 'assistant',
    content,
    timestamp: Date.now(),
    provider: 'openai',
  })
}

const startAudioTranscription = async () => {
  if (!selectedAudioFile.value || audioProcessing.value) return

  audioProcessing.value = true
  audioTranscriptionStatus.value = 'Preparing audio...'
  audioChunkProgress.value = { current: 0, total: 0 }
  errorMessage.value = ''

  const { file, name } = selectedAudioFile.value

  appendChatMessage({
    role: 'user',
    content: `Uploaded audio "${name}" for transcription.`,
    timestamp: Date.now(),
    provider: provider.value,
  })

  isStreaming.value = true
  streamingContent.value = ''
  streamingProviderOverride.value = 'openai'

  try {
    const duration = selectedAudioFile.value.duration ?? (await getAudioDurationSeconds(file).catch(() => null))
    const hasDuration = typeof duration === 'number' && Number.isFinite(duration)
    const shouldChunk = hasDuration ? duration > CHUNK_DURATION_SECONDS : file.size > 8 * 1024 * 1024

    let result
    try {
      result = shouldChunk
        ? await transcribeAudioInChunks(file, name, duration)
        : await transcribeSingleAudio(file, name)
    } catch (error) {
      if (shouldChunk) {
        console.warn('Chunked transcription failed, falling back to single upload:', error)
        audioTranscriptionStatus.value = 'Chunking failed. Retrying whole file...'
        result = await transcribeSingleAudio(file, name)
      } else {
        throw error
      }
    }

    finalizeTranscriptionMessage(result, name)
    clearSelectedAudio()
  } catch (error) {
    console.error('Audio transcription error:', error)
    errorMessage.value = `Audio transcription failed: ${error.message}`
  } finally {
    audioProcessing.value = false
    audioTranscriptionStatus.value = ''
    audioChunkProgress.value = { current: 0, total: 0 }
    isStreaming.value = false
    streamingContent.value = ''
    streamingProviderOverride.value = null
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    return marked(content)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return content
  }
}

const isImageMessage = (message) => {
  const imageData = message?.imageData
  return Boolean(imageData && (imageData.base64Data || imageData.previewImageUrl))
}

const getImagePreviewUrl = (imageData) => {
  if (!imageData) return null
  if (imageData.base64Data) {
    const mimeType = imageData.mimeType || 'image/png'
    return `data:${mimeType};base64,${imageData.base64Data}`
  }
  if (imageData.previewImageUrl) return imageData.previewImageUrl
  return null
}

const getFullImageUrl = (imageData) => {
  if (!imageData) return null
  return imageData.fullImageUrl || imageData.previewImageUrl || null
}

const imageLoadStates = ref({})

const getMessageImageSrc = (message) => {
  const preview = getImagePreviewUrl(message?.imageData)
  const full = getFullImageUrl(message?.imageData)
  if (!full || imageLoadStates.value[message.id]) return full || preview || null
  return preview || full || null
}

const markImageLoaded = (message) => {
  const preview = getImagePreviewUrl(message?.imageData)
  const full = getFullImageUrl(message?.imageData)
  if (full && preview && full !== preview && !imageLoadStates.value[message.id]) {
    imageLoadStates.value = { ...imageLoadStates.value, [message.id]: true }
  }
}

const compressBase64Image = (base64, mimeType, maxDimension = 512, quality = 0.7) =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const compressedBase64 = dataUrl.split(',')[1] || ''
      resolve({ base64: compressedBase64, mimeType: 'image/jpeg' })
    }
    img.onerror = () => resolve(null)
    img.src = `data:${mimeType || 'image/png'};base64,${base64}`
  })

const toBase64FromUrl = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  const blob = await response.blob()
  const mimeType = blob.type || 'image/png'
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1] || '')
      } else {
        reject(new Error('Unable to read image'))
      }
    }
    reader.onerror = () => reject(new Error('Unable to read image'))
    reader.readAsDataURL(blob)
  })
  return { base64, mimeType }
}

const insertAsFullText = (content) => {
  if (!content) return
  emit('insert-fulltext', content)
}

const insertAsHtml = (message) => {
  const htmlContent = extractHtmlDocument(message?.content)
  if (!htmlContent) return
  emit('insert-html', htmlContent)
}

const insertGeneratedImage = async (message) => {
  const imageData = message?.imageData
  if (!imageData) return

  try {
    const saveResp = await fetch('https://api.vegvisr.org/save-approved-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: {
          metadata: {
            base64Data: imageData.base64Data || null,
            previewImageUrl: imageData.previewImageUrl || null,
            originalPrompt: imageData.prompt || '',
            imageType: imageData.imageType || 'standalone',
            model: imageData.model || 'gpt-image-1.5',
            size: imageData.size || '1024x1024',
            quality: imageData.quality || 'auto',
          },
        },
      }),
    })

    if (!saveResp.ok) {
      const errorData = await saveResp.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to save approved image')
    }

    const saved = await saveResp.json()
    const markdown = saved.info
      || (saved.metadata?.generatedImageUrl
        ? `![Generated Image](${saved.metadata.generatedImageUrl})`
        : null)

    if (!markdown) {
      throw new Error('Failed to get saved image URL')
    }

    insertAsFullText(markdown)
  } catch (error) {
    console.error('Insert image error:', error)
    errorMessage.value = `Error: ${error.message}`
  }
}

const handleInsertMessage = async (message) => {
  if (isImageMessage(message)) {
    await insertGeneratedImage(message)
    return
  }
  insertAsFullText(message.content)
}

// ==========================================
// Batch Fulltext Node Generation Functions
// ==========================================

/**
 * Parse a markdown table from node content into structured items
 */
function parseMarkdownTable(content) {
  if (!content) return []

  const lines = content.split('\n')
  const items = []
  let inTable = false
  let headerSkipped = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect table rows (lines starting with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true

      // Skip separator line (contains only |, -, and spaces)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        headerSkipped = true
        continue
      }

      // Skip header row (first row before separator)
      if (!headerSkipped) {
        continue
      }

      // Parse table cells
      const cells = trimmed
        .split('|')
        .slice(1, -1) // Remove empty first/last from split
        .map(cell => cell.trim())

      if (cells.length >= 2 && cells[0]) {
        items.push({
          primary: cells[0],           // e.g., "ka"
          secondary: cells[1] || '',   // e.g., "क"
          description: cells[2] || '', // e.g., "velar plosive"
          raw: trimmed
        })
      }
    } else if (inTable && trimmed === '') {
      // End of table
      inTable = false
      headerSkipped = false
    }
  }

  return items
}

/**
 * Check if a message can trigger batch generation
 */
function canBatchGenerate(message) {
  return message?.role === 'assistant' &&
         fulltextNodes.value.length > 0 &&
         isViewerContext.value
}

/**
 * Open the batch generation modal
 */
function openBatchGenerateModal() {
  // Reset state
  batchTemplateNodeId.value = ''
  batchDataSourceNodeId.value = ''
  batchGenerationActive.value = false
  batchProgressStage.value = ''
  batchProgressCurrent.value = 0
  batchProgressTotal.value = 0
  batchErrors.value = []
  batchAborting.value = false
  batchCreatedNodes.value = []
  batchCurrentIndex.value = 0
  batchCurrentPreview.value = null
  batchGenerating.value = false

  showBatchGenerateModal.value = true
}

/**
 * Close the batch generation modal
 */
function closeBatchGenerateModal() {
  if (batchGenerating.value) {
    if (!confirm('Generering pågår. Avbryte?')) return
    abortBatchGeneration()
  }
  showBatchGenerateModal.value = false
}

/**
 * Abort ongoing batch generation
 */
function abortBatchGeneration() {
  batchAborting.value = true
  if (batchAbortController.value) {
    batchAbortController.value.abort()
  }
}

/**
 * Generate a UUID for new nodes
 */
function generateBatchUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Generate content for the next item in the batch
 */
async function generateNextItem() {
  if (!canStartBatch.value && batchCurrentIndex.value === 0) return

  const templateNode = fulltextNodes.value.find(n => n.id === batchTemplateNodeId.value)
  if (!templateNode) {
    batchErrors.value.push('Mal-node ikke funnet')
    return
  }

  const currentItem = parsedBatchItems.value[batchCurrentIndex.value]
  if (!currentItem) {
    batchErrors.value.push('Ingen flere elementer å generere')
    return
  }

  batchGenerating.value = true
  batchAbortController.value = new AbortController()

  try {
    const generatedContent = await generateSingleItemContent(
      templateNode,
      currentItem,
      batchAbortController.value.signal
    )

    if (batchAborting.value) return

    // Clean up the response - remove common AI prefixes
    let info = generatedContent.trim()
    // Remove various label/content prefixes (case insensitive, with optional colon)
    info = info.replace(/^(Innhold|Content|Label|Etikett)\s*:?\s*/i, '')
    // Remove if it starts with the item name as a label
    info = info.replace(/^Lyden\s+[«"']?\w+[»"']?\s*[-–—]\s*\S+\s*\n/i, '')
    // Remove "Label: something" on its own line at the start
    info = info.replace(/^Label\s*:\s*[^\n]*\n/gi, '')
    // Remove any remaining "Innhold:" anywhere at the start of a line
    info = info.replace(/^\s*Innhold\s*:\s*/gim, '')

    // Create preview object
    batchCurrentPreview.value = {
      label: `Lyden «${currentItem.primary.charAt(0).toUpperCase() + currentItem.primary.slice(1)}» – ${currentItem.secondary}`,
      info: info.trim(),
      item: currentItem
    }

  } catch (error) {
    console.error('Generation failed:', error)
    batchErrors.value.push(`Feil ved generering: ${error.message}`)
  } finally {
    batchGenerating.value = false
    batchAbortController.value = null
  }
}

/**
 * Approve current preview and create the node
 */
async function approveCurrentItem() {
  if (!batchCurrentPreview.value) return

  const templateNode = fulltextNodes.value.find(n => n.id === batchTemplateNodeId.value)

  const newNode = {
    id: generateBatchUUID(),
    label: batchCurrentPreview.value.label,
    type: 'fulltext',
    color: templateNode?.color || '#f8f9fa',
    info: batchCurrentPreview.value.info,
    bibl: [],
    visible: true,
    position: { x: 0, y: batchCreatedNodes.value.length * 50 }
  }

  emit('insert-fulltext-batch', {
    node: newNode,
    index: batchCreatedNodes.value.length,
    total: parsedBatchItems.value.length
  })

  batchCreatedNodes.value.push({ label: newNode.label })
  batchCurrentPreview.value = null
}

/**
 * Skip current item without creating a node
 */
function skipCurrentItem() {
  batchCurrentPreview.value = null
  if (batchCurrentIndex.value < parsedBatchItems.value.length - 1) {
    batchCurrentIndex.value++
  }
}

/**
 * Approve current and generate next
 */
async function approveAndNext() {
  await approveCurrentItem()
  batchCurrentIndex.value++
  await generateNextItem()
}

/**
 * Approve current and finish (save all to backend)
 */
async function approveAndFinish() {
  await approveCurrentItem()
  // The last node triggers save in handleBatchNodeInsert
}

/**
 * Generate content for a SINGLE item via AI
 */
async function generateSingleItemContent(templateNode, item, abortSignal) {
  const templateContent = templateNode.info || ''
  const templateLabel = templateNode.label || 'Template'

  const systemPrompt = `Du genererer formatert innhold for en kunnskapsgraf.
Du får en mal som viser ønsket formatering, og ETT element å generere innhold for.
Følg malens markdown-struktur, overskrifter og visuelle stil NØYAKTIG.

VIKTIG:
- Generer KUN innholdet, IKKE skriv "Innhold:" eller "Label:" foran
- Start direkte med [FANCY] taggen eller første overskrift
- Følg malens struktur eksakt
- Tilpass innholdet for det spesifikke elementet
- Bevar alle [FANCY], [QUOTE], [SECTION] og andre spesielle formateringstagger`

  const userPrompt = `MAL-NODE (bruk denne formateringsstilen):
Label: ${templateLabel}
Innhold:
${templateContent}

---

ELEMENT Å GENERERE:
Lyd: ${item.primary}
Devanagari: ${item.secondary}
${item.description ? `Beskrivelse: ${item.description}` : ''}

---

Generer formatert innhold for dette elementet. Start direkte med innholdet (f.eks. [FANCY] taggen).`

  const endpoint = 'https://grok.vegvisr.org/chat'

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userStore.user_id || 'system',
      model: 'grok-3',
      max_tokens: 4000,
      temperature: 0.7,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal: abortSignal
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`AI-forespørsel feilet: ${response.status} - ${errText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ==========================================
// End Batch Generation Functions
// ==========================================

// Insert structured node (person-profile, company-card, news-feed)
const insertAsNode = (message, nodeType) => {
  if (!message?.proffData && !message?.sourcesData) {
    // Try to extract structured data from message content
    emit('insert-node', {
      type: nodeType,
      content: message.content,
      rawData: null
    })
    return
  }

  emit('insert-node', {
    type: nodeType,
    content: message.content,
    rawData: message.proffData || message.sourcesData
  })
}

// Insert network diagram from Proff network data
const insertAsNetwork = (message) => {
  if (!message?.proffData?.paths && !message?.proffData?.network) {
    console.warn('No network data found in message')
    return
  }

  emit('insert-network', {
    content: message.content,
    networkData: message.proffData
  })
}

// Check if message contains Proff person data
const hasPersonData = (message) => {
  if (!message?.proffData) {
    return false
  }
  // Check for person data from any Proff tool
  return message.proffData.person ||
         message.proffData.persons ||
         message.proffData.proff_search_persons ||
         message.proffData.proff_get_person_details ||
         (message.content && message.content.includes('personId'))
}

// Check if message contains Proff company data
const hasCompanyData = (message) => {
  if (!message?.proffData) return false
  return message.proffData.company ||
         message.proffData.companies ||
         message.proffData.proff_search_companies ||
         message.proffData.proff_get_company_details ||
         (message.content && message.content.includes('organisationNumber'))
}

// Check if message contains network/connection data
const hasNetworkData = (message) => {
  if (!message?.proffData) return false
  return message.proffData.paths ||
         message.proffData.network ||
         message.proffData.proff_find_business_network ||
         message.proffData.degreesOfSeparation !== undefined
}

// Check if message contains news/sources data
const hasNewsData = (message) => {
  return message?.sourcesData?.results?.length > 0 ||
         message?.sourcesData?.sources_search?.results?.length > 0 ||
         (message?.usedSourcesAPI && message.content?.includes('artikler'))
}

// Check if message contains person data with connections (for network canvas)
const hasPersonConnectionsData = (message) => {
  if (!message?.proffData) {
    return false
  }

  // Check for person details with connections array - multiple possible paths
  // Path 1: proff_get_person_details.person (nested)
  const personFromDetails = message.proffData.proff_get_person_details?.person
  // Path 2: proff_get_person_details directly (API returns person at root)
  const detailsDirect = message.proffData.proff_get_person_details
  // Path 3: Direct person object (extracted during tool processing)
  const directPerson = message.proffData.person
  // Path 4: First person from search results (might have connections if details were fetched)
  const personFromSearch = message.proffData.proff_search_persons?.persons?.[0]

  // Check each path for connections
  for (const personData of [personFromDetails, detailsDirect, directPerson, personFromSearch]) {
    if (personData?.connections && Array.isArray(personData.connections) && personData.connections.length > 0) {
      return true
    }
  }

  // Also check for direct connections array at root level
  if (message.proffData.connections && Array.isArray(message.proffData.connections) && message.proffData.connections.length > 0) {
    return true
  }

  return false
}

// Insert person network canvas from Proff person data with connections
const insertAsPersonNetwork = (message) => {
  if (!hasPersonConnectionsData(message)) {
    console.warn('No person connections data found in message')
    return
  }

  const personData = extractPersonConnectionsFromMessage(message)
  if (!personData) {
    console.warn('No person connections data found in message')
    return
  }

  console.log('insertAsPersonNetwork: Using personData:', personData?.name, 'with', personData?.connections?.length, 'connections')

  emit('insert-person-network', {
    content: message.content,
    personData: personData
  })
}

const createGraphId = (prefix = 'graph') => {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}_${randomPart}`
}

const escapeHtmlText = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const normalizeHtmlImportInput = (rawHtml, fallbackTitle = 'Imported HTML') => {
  if (typeof rawHtml !== 'string') return null
  const trimmed = rawHtml.trim()
  if (!trimmed) return null

  const fenceMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/i)
  const candidate = (fenceMatch ? fenceMatch[1] : trimmed).trim()
  if (!candidate) return null

  const fullDocument = extractHtmlDocument(candidate)
  if (fullDocument) {
    return fullDocument
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlText(fallbackTitle || 'Imported HTML')}</title>
</head>
<body>
${candidate}
</body>
</html>`
}

const extractInlineCssBlocks = (htmlDocument) => {
  if (typeof htmlDocument !== 'string' || !htmlDocument.trim()) {
    return { cssText: '', styleBlockCount: 0 }
  }

  const styleMatches = Array.from(htmlDocument.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
  if (!styleMatches.length) {
    return { cssText: '', styleBlockCount: 0 }
  }

  const cssChunks = styleMatches
    .map((match) => String(match?.[1] || '').trim())
    .filter(Boolean)

  return {
    cssText: cssChunks.join('\n\n'),
    styleBlockCount: cssChunks.length,
  }
}

const stripInlineStyleBlocks = (htmlDocument) => {
  if (typeof htmlDocument !== 'string' || !htmlDocument.trim()) return htmlDocument
  return htmlDocument.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

const resetHtmlImportState = () => {
  htmlImportTitle.value = ''
  htmlImportDescription.value = ''
  htmlImportUrl.value = ''
  htmlImportContent.value = ''
  htmlImportRemoveInlineStyles.value = false
  htmlImportSaving.value = false
  htmlImportError.value = ''
  htmlImportCreatedGraphId.value = ''
}

const openHtmlImportModal = () => {
  if (!canCreateGraph.value) {
    htmlImportError.value = 'Logg inn for å opprette graf.'
    return
  }
  resetHtmlImportState()
  htmlImportTitle.value = `Imported HTML ${new Date().toLocaleDateString('no-NO')}`
  showHtmlImportModal.value = true
}

const closeHtmlImportModal = () => {
  if (htmlImportSaving.value) return
  showHtmlImportModal.value = false
  resetHtmlImportState()
}

const createHtmlImportGraph = async () => {
  if (!canCreateGraph.value) {
    htmlImportError.value = 'Logg inn for å opprette graf.'
    return
  }

  const title = (htmlImportTitle.value || '').trim() || `Imported HTML ${new Date().toLocaleDateString('no-NO')}`
  const description = (htmlImportDescription.value || '').trim() || 'Imported from Grok Chat panel'
  const sourceUrl = (htmlImportUrl.value || '').trim()
  const normalizedHtmlDocument = sourceUrl ? null : normalizeHtmlImportInput(htmlImportContent.value, title)

  if (!sourceUrl && !normalizedHtmlDocument) {
    htmlImportError.value = 'Legg inn en URL eller lim inn gyldig HTML først.'
    return
  }

  htmlImportSaving.value = true
  htmlImportError.value = ''
  htmlImportCreatedGraphId.value = ''

  try {
    if (sourceUrl) {
      let parsedUrl
      try {
        parsedUrl = new URL(sourceUrl)
      } catch {
        throw new Error('Ugyldig URL.')
      }
      if (!/^https?:$/i.test(parsedUrl.protocol)) {
        throw new Error('Kun http(s)-URL støttes.')
      }

      const response = await fetch(`${HTML_IMPORT_WORKER_BASE}/import-html`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: parsedUrl.toString(),
          title,
          description,
          createdBy: userStore.email || userStore.user_id || 'unknown',
          category: '#HTMLTemplate',
          metaArea: '#Imported',
          publicationState: 'draft',
        }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || `Failed with status ${response.status}`)
      }

      const finalGraphId = result.graphId || result.id
      if (!finalGraphId) {
        throw new Error('Import endpoint returned no graph id.')
      }

      htmlImportCreatedGraphId.value = finalGraphId

      messages.value.push({
        role: 'assistant',
        content: `✅ URL imported successfully and saved as graph \`${finalGraphId}\` with css-node + html-node structure.`,
        provider: provider.value,
        timestamp: new Date().toISOString(),
      })

      return
    }

    const nowIso = new Date().toISOString()
    const graphId = createGraphId('html_graph')
    const htmlNodeId = createGraphId('html_node')
    const { cssText: extractedInlineCss, styleBlockCount } = extractInlineCssBlocks(normalizedHtmlDocument)
    const cssNodeId = extractedInlineCss ? createGraphId('css_node') : null
    const shouldRemoveInlineStyles = Boolean(
      htmlImportRemoveInlineStyles.value && cssNodeId && styleBlockCount > 0
    )
    const htmlDocument = shouldRemoveInlineStyles
      ? stripInlineStyleBlocks(normalizedHtmlDocument)
      : normalizedHtmlDocument

    const nodes = [
      {
        id: htmlNodeId,
        label: 'Imported HTML Page',
        type: 'html-node',
        color: '#f8f9fa',
        info: htmlDocument,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 },
      },
    ]

    const edges = []

    if (cssNodeId) {
      nodes.unshift({
        id: cssNodeId,
        label: `${title} Styles`,
        type: 'css-node',
        color: '#fff3cd',
        info: extractedInlineCss,
        bibl: [],
        visible: true,
        path: null,
        position: { x: 100, y: -120 },
        metadata: {
          appliesTo: [htmlNodeId],
          priority: 100,
          source: 'inline-style',
          extractedFrom: htmlNodeId,
          styleBlockCount,
          removedInlineStylesFromHtmlNode: shouldRemoveInlineStyles,
          extractedAt: nowIso,
        },
      })

      // Keep a styles edge so imported graphs match the documented html-template structure.
      edges.push({
        id: createGraphId('edge'),
        source: cssNodeId,
        target: htmlNodeId,
        type: 'styles',
        label: 'styles',
      })
    }

    const graphData = {
      id: graphId,
      metadata: {
        title,
        description,
        createdBy: userStore.email || userStore.user_id || 'unknown',
        createdAt: nowIso,
        updatedAt: nowIso,
        publicationState: 'draft',
        graphType: 'html-template',
        category: '#HTMLTemplate',
        metaArea: '#Imported',
        source: 'GrokChatPanel',
        version: 1,
      },
      nodes,
      edges,
    }

    const response = await fetch(KNOWLEDGE_GRAPH_SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken || '',
        'x-user-role': userStore.role || '',
      },
      body: JSON.stringify({
        id: graphId,
        graphData,
        override: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `Failed with status ${response.status}`)
    }

    const result = await response.json().catch(() => ({}))
    const finalGraphId = result.graphId || result.id || graphId
    htmlImportCreatedGraphId.value = finalGraphId

    knowledgeGraphStore.setCurrentGraphId(finalGraphId)
    knowledgeGraphStore.updateGraphFromJson({
      nodes: graphData.nodes,
      edges: graphData.edges,
      metadata: graphData.metadata,
    })

    messages.value.push({
      role: 'assistant',
      content: `✅ HTML imported successfully and saved as graph \`${finalGraphId}\`${cssNodeId ? ` with inline CSS extracted (${styleBlockCount} style block${styleBlockCount === 1 ? '' : 's'})${shouldRemoveInlineStyles ? ' and removed from HTML node.' : '.'}` : '.'}`,
      provider: provider.value,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to import HTML graph:', error)
    htmlImportError.value = error?.message || 'Kunne ikke importere HTML.'
  } finally {
    htmlImportSaving.value = false
  }
}

const openImportedHtmlGraph = () => {
  if (!htmlImportCreatedGraphId.value) return
  try {
    if (typeof window !== 'undefined') {
      window.open(`/gnew-viewer?graphId=${htmlImportCreatedGraphId.value}`, '_blank')
      return
    }
    router.push(`/gnew-viewer?graphId=${htmlImportCreatedGraphId.value}`)
  } catch (error) {
    console.error('Failed to open imported HTML graph:', error)
  }
}

const buildRetryMessage = (question, detail) => {
  const trimmed = (question || '').trim()
  const encodedQuestion = encodeURIComponent(trimmed)
  const detailText = detail ? ` (${detail})` : ''
  const retryLink = trimmed
    ? `<a href="#" class="chat-retry-question" data-question="${encodedQuestion}">Prøv igjen</a>`
    : 'Prøv igjen'
  return `⚠️ Claude kunne ikke fullføre verktøykjøringen${detailText}. ${retryLink}`
}

const extractPersonConnectionsFromMessage = (message) => {
  if (!message?.proffData) return null

  let personData = message.proffData.proff_get_person_details?.person ||
    message.proffData.person

  if (!personData && message.proffData.proff_get_person_details) {
    personData = message.proffData.proff_get_person_details
  }

  if (!personData?.connections && message.proffData.proff_search_persons?.persons?.[0]?.connections) {
    personData = message.proffData.proff_search_persons.persons[0]
  }

  if (!personData) {
    personData = message.proffData
  }

  if (!personData?.connections && Array.isArray(message.proffData.connections)) {
    personData = { ...personData, connections: message.proffData.connections }
  }

  if (!Array.isArray(personData?.connections)) return null
  return personData
}

const createNetworkKnowledgeGraph = (personData, requestedTitle = '', sourceMessage = '') => {
  if (!personData || !Array.isArray(personData.connections)) {
    throw new Error('Missing person network data')
  }

  const now = new Date()
  const title = requestedTitle?.trim() || `${personData.name || 'Ukjent person'} sitt nettverk`
  const connections = personData.connections

  // Color based on gender: pink for female (K), blue for male (M)
  const getGenderColor = (gender) => {
    if (gender === 'K') return '#ec4899' // Pink for female
    if (gender === 'M') return '#3b82f6' // Blue for male
    return '#9ca3af' // Gray for unknown
  }

  // Size based on number of connections (min 60, max 120)
  const getNodeSize = (numConnections) => {
    const baseSize = 60
    const maxSize = 120
    const size = baseSize + Math.min(numConnections || 0, 30) * 2
    return Math.min(size, maxSize)
  }

  const centerNodeId = createGraphId('person')
  const nodes = []
  const edges = []

  const centerSize = getNodeSize(connections.length)

  nodes.push({
    id: centerNodeId,
    type: 'person-profile',
    label: personData.name || 'Ukjent person',
    position: { x: 0, y: 0 },
    visible: true,
    color: getGenderColor(personData.gender),
    width: centerSize,
    height: centerSize,
    data: {
      personId: personData.personId || '',
      name: personData.name || '',
      gender: personData.gender || '',
      age: personData.age || personData.alder || '',
      roles: personData.roles || [],
      connections,
      industryConnections: personData.industryConnections || [],
      source: 'proff'
    }
  })

  const radius = Math.max(320, 140 + connections.length * 18)
  const angleStep = (Math.PI * 2) / Math.max(connections.length, 1)

  connections.forEach((connection, index) => {
    const nodeId = createGraphId('connection')
    const angle = angleStep * index
    const connectionName = connection.name || `Forbindelse ${index + 1}`
    const nodeSize = getNodeSize(connection.numberOfConnections)

    nodes.push({
      id: nodeId,
      type: 'person-profile',
      label: connectionName,
      position: {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      },
      visible: true,
      color: getGenderColor(connection.gender),
      width: nodeSize,
      height: nodeSize,
      data: {
        name: connectionName,
        gender: connection.gender || '',
        numberOfConnections: connection.numberOfConnections || 0,
        roles: connection.roles || [],
        source: 'proff'
      }
    })

    edges.push({
      id: createGraphId('edge'),
      source: centerNodeId,
      target: nodeId,
      type: 'connection',
      label: connection.companyName || connection.roleName || 'forbindelse'
    })
  })

  return {
    metadata: {
      title,
      description: `Automatisk generert nettverksgraf for ${personData.name || 'ukjent person'} (${connections.length} forbindelser).`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: userStore.email || 'GrokChatPanel',
      source: 'GrokChatPanel',
      sourceMessage
    },
    nodes,
    edges
  }
}

const resetCaseGraphState = () => {
  caseGraphPersonData.value = null
  caseGraphTitle.value = ''
  caseGraphCreating.value = false
  caseGraphStatus.value = ''
  caseGraphError.value = ''
  caseGraphCreatedId.value = null
  caseGraphSourceMessage.value = null
}

const openCaseGraphDialog = (message) => {
  const personData = extractPersonConnectionsFromMessage(message)
  if (!personData) {
    caseGraphError.value = 'Fant ikke nettverksdata for personen.'
    return
  }

  caseGraphPersonData.value = personData
  caseGraphTitle.value = `${personData.name || 'Ukjent person'} sitt nettverk`
  caseGraphSourceMessage.value = message || null
  caseGraphError.value = ''
  caseGraphCreatedId.value = null
  caseGraphStatus.value = ''
  showCaseGraphModal.value = true
}

const closeCaseGraphModal = () => {
  showCaseGraphModal.value = false
  resetCaseGraphState()
}

const openCaseGraphInViewer = (graphId) => {
  if (!graphId) return
  try {
    if (typeof window !== 'undefined') {
      window.open(`/gnew-viewer?graphId=${graphId}`, '_blank')
      return
    }
    router.push(`/gnew-viewer?graphId=${graphId}`)
  } catch (error) {
    console.error('Failed to open case graph viewer:', error)
  }
}

const emitImportCaseGraph = (graphId, graphTitle) => {
  if (!graphId) return
  emit('import-graph-as-cluster', {
    graphId,
    title: graphTitle || caseGraphTitle.value || 'Case graf'
  })
}

const createCaseGraph = async (action) => {
  if (!caseGraphPersonData.value) return
  if (!canCreateGraph.value) {
    caseGraphError.value = 'Logg inn for å lagre grafen.'
    return
  }

  caseGraphCreating.value = true
  caseGraphStatus.value = 'Bygger graf...'
  caseGraphError.value = ''
  caseGraphCreatedId.value = null

  if (caseGraphSourceMessage.value) {
    caseGraphSourceMessage.value.caseGraphCreating = true
  }

  try {
    const graphData = createNetworkKnowledgeGraph(
      caseGraphPersonData.value,
      caseGraphTitle.value,
      caseGraphSourceMessage.value?.content || ''
    )

    caseGraphStatus.value = 'Lagrer graf...'
    const graphId = createGraphId('case_graph')
    const response = await fetch(KNOWLEDGE_GRAPH_SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        id: graphId,
        graphData,
        override: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `Failed to save graph (${response.status})`)
    }

    const result = await response.json().catch(() => ({}))
    const savedGraphId = result.graphId || result.id || graphId

    caseGraphCreatedId.value = savedGraphId
    caseGraphStatus.value = '✅ Graf opprettet!'

    if (action === 'open') {
      openCaseGraphInViewer(savedGraphId)
    } else if (action === 'import') {
      emitImportCaseGraph(savedGraphId, graphData.metadata?.title)
    }
  } catch (error) {
    console.error('Failed to create case graph:', error)
    caseGraphError.value = error.message || 'Kunne ikke opprette grafen.'
  } finally {
    caseGraphCreating.value = false
    if (caseGraphSourceMessage.value) {
      caseGraphSourceMessage.value.caseGraphCreating = false
    }
  }
}

const createCaseGraphAndOpen = () => createCaseGraph('open')
const createCaseGraphAndImport = () => createCaseGraph('import')

const openCreatedCaseGraph = () => {
  openCaseGraphInViewer(caseGraphCreatedId.value)
}

const importCreatedCaseGraphAsCluster = () => {
  emitImportCaseGraph(caseGraphCreatedId.value, caseGraphTitle.value)
}

const getCitationAnchor = (target) => {
  if (!target) return null
  return target.closest ? target.closest('.perplexity-citation') : null
}

const extractCitationData = (element) => {
  if (!element) return null
  const url = element.getAttribute('data-url') || ''
  const domain = element.getAttribute('data-domain') || ''
  const index = element.getAttribute('data-index') || ''
  return { url, domain, index }
}

const positionCitationPreview = (element) => {
  const rect = element.getBoundingClientRect()
  const maxWidth = 360
  const spacing = 10
  const left = Math.min(rect.left + rect.width / 2, window.innerWidth - maxWidth - spacing)
  const top = Math.min(rect.bottom + spacing, window.innerHeight - 220)
  return {
    position: 'fixed',
    top: `${Math.max(10, top)}px`,
    left: `${Math.max(10, left)}px`,
    width: `${maxWidth}px`,
  }
}

const fetchCitationPreview = async (url) => {
  if (!url) return null
  if (linkPreviewCache.has(url)) {
    return linkPreviewCache.get(url)
  }

  const response = await fetch(`${LINK_PREVIEW_ENDPOINT}?url=${encodeURIComponent(url)}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch preview (${response.status})`)
  }
  const data = await response.json()
  linkPreviewCache.set(url, data)
  return data
}

const showCitationPreview = async (element) => {
  const data = extractCitationData(element)
  if (!data?.url) return

  citationPreview.value = {
    ...citationPreview.value,
    visible: true,
    loading: true,
    error: false,
    url: data.url,
    domain: data.domain || '',
    title: '',
    description: '',
    image: '',
    style: positionCitationPreview(element),
  }

  try {
    const preview = await fetchCitationPreview(data.url)
    citationPreview.value = {
      ...citationPreview.value,
      loading: false,
      error: false,
      domain: preview.domain || data.domain || '',
      title: preview.title || data.domain || 'Source',
      description: preview.description || '',
      image: preview.image || '',
    }
  } catch (error) {
    console.error('Citation preview error:', error)
    citationPreview.value = {
      ...citationPreview.value,
      loading: false,
      error: false,
      domain: data.domain || '',
      title: data.domain || 'Source',
      description: 'Preview unavailable. Click to open.',
      image: '',
    }
  }
}

const hideCitationPreview = () => {
  citationPreview.value = {
    ...citationPreview.value,
    visible: false,
    loading: false,
    error: false,
  }
}

const handleCitationPreviewEnter = () => {
  isCitationPreviewHovered.value = true
  if (citationHideTimeout) {
    clearTimeout(citationHideTimeout)
    citationHideTimeout = null
  }
}

const handleCitationPreviewLeave = () => {
  isCitationPreviewHovered.value = false
  citationHideTimeout = setTimeout(() => {
    if (!isCitationPreviewHovered.value) {
      hideCitationPreview()
    }
  }, 150)
}

const handleMessageContentMouseOver = (event) => {
  const citation = getCitationAnchor(event.target)
  if (!citation) return

  if (citationPreview.value.url === citation.getAttribute('data-url') && citationPreview.value.visible) {
    return
  }

  if (citationHideTimeout) {
    clearTimeout(citationHideTimeout)
    citationHideTimeout = null
  }

  showCitationPreview(citation)
}

const handleMessageContentMouseOut = (event) => {
  const citation = getCitationAnchor(event.target)
  if (!citation) return

  const related = event.relatedTarget
  if (related && (related.closest?.('.perplexity-citation') || related.closest?.('.citation-preview'))) {
    return
  }

  citationHideTimeout = setTimeout(() => {
    if (!isCitationPreviewHovered.value) {
      hideCitationPreview()
    }
  }, 150)
}

const openCitationModal = (url) => {
  if (!url) return
  citationModalUrl.value = url
  showCitationModal.value = true
}

const closeCitationModal = () => {
  showCitationModal.value = false
  citationModalUrl.value = ''
}

// Handle clicks on message content (for related questions)
const handleMessageContentClick = (event) => {
  const target = event.target

  const citation = getCitationAnchor(target)
  if (citation) {
    event.preventDefault()
    event.stopPropagation()
    const data = extractCitationData(citation)
    if (data?.url) {
      openCitationModal(data.url)
    }
    return
  }

  // Check if clicked element is a related question link
  if (target.classList.contains('perplexity-related-question')) {
    event.preventDefault()
    event.stopPropagation()

    const encodedQuestion = target.getAttribute('data-question')
    if (encodedQuestion) {
      const question = decodeURIComponent(encodedQuestion)

      // Set the question in the input
      userInput.value = question

      // Ensure Perplexity is selected as the provider
      if (provider.value !== 'perplexity') {
        provider.value = 'perplexity'
      }

      // Send the message
      nextTick(() => {
        sendMessage()
      })
    }
  }

  if (target.classList.contains('chat-retry-question')) {
    event.preventDefault()
    event.stopPropagation()

    const encodedQuestion = target.getAttribute('data-question')
    if (encodedQuestion) {
      const question = decodeURIComponent(encodedQuestion)
      userInput.value = question
      nextTick(() => {
        sendMessage()
      })
    }
  }
}

// Advanced Graph Creation Functions
const fetchGraphTemplates = async () => {
  if (availableTemplates.value.length > 0) return // Already loaded

  templatesLoading.value = true
  templatesFetchError.value = ''
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates', {
      headers: {
        'X-API-Token': userStore.emailVerificationToken,
        Accept: 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      // Filter to only templates with nodes (exclude email templates, etc.)
      availableTemplates.value = data.results.filter(template => {
        try {
          const nodes = JSON.parse(template.nodes || '[]')
          return nodes.length > 0 && nodes[0].type
        } catch {
          return false
        }
      })
    }
  } catch (error) {
    console.error('Failed to fetch templates:', error)
    templatesFetchError.value = 'Could not load node templates. Please try again.'
  } finally {
    templatesLoading.value = false
  }
}

const getTemplateNodeType = (template) => {
  try {
    const nodes = JSON.parse(template.nodes || '[]')
    return nodes[0]?.type || null
  } catch {
    return null
  }
}

const getTemplateAIInstructions = (template) => {
  try {
    const instructions = JSON.parse(template.ai_instructions || '{}')
    return instructions.purpose || instructions.usage || ''
  } catch {
    return ''
  }
}

const isTemplateSelected = (templateId) => {
  return selectedTemplates.value.includes(templateId)
}

const openAdvancedGraphModal = async (message, index) => {
  selectedMessage.value = message
  selectedMessageIndex.value = index
  selectedTemplates.value = [] // Reset selection
  showAdvancedGraphModal.value = true

  await fetchGraphTemplates()
}

const closeAdvancedGraphModal = () => {
  showAdvancedGraphModal.value = false
  selectedMessage.value = null
  selectedMessageIndex.value = null
  selectedTemplates.value = []
}

const generateAdvancedGraph = async () => {
  console.log('🚀 generateAdvancedGraph called')
  console.log('Selected templates:', selectedTemplates.value)
  console.log('Selected message:', selectedMessage.value)

  if (selectedTemplates.value.length === 0) {
    errorMessage.value = 'Please select at least one node template.'
    console.error('❌ No templates selected')
    return
  }

  if (!selectedMessage.value) {
    errorMessage.value = 'No message selected. Please try again.'
    console.error('❌ No message selected')
    return
  }

  // Save message data before closing modal (which resets selectedMessage)
  const message = selectedMessage.value
  const messageIndex = selectedMessageIndex.value

  // Map selected template IDs to node types
  const allowedNodeTypes = selectedTemplates.value
    .map(templateId => {
      const template = availableTemplates.value.find(t => t.id === templateId)
      return getTemplateNodeType(template)
    })
    .filter(Boolean) // Remove nulls

  console.log('✅ Allowed node types:', allowedNodeTypes)

  // Close modal
  closeAdvancedGraphModal()
  console.log('✅ Modal closed')

  // Create graph job with advanced mode
  const transcript = (message.content || '').trim()
  if (!transcript) {
    errorMessage.value = 'Assistant response is empty. Nothing to process.'
    return
  }

  const job = {
    id: generateGraphJobId(),
    messageIndex: messageIndex,
    provider: message.provider || provider.value,
    createdAt: Date.now(),
    status: 'queued',
    stage: 'Queued (Advanced Mode)',
    progress: 5,
    transcript,
    sourcePreview: sanitizeJobPreview(message.content || ''),
    error: '',
    result: null,
    graphSaveState: 'idle',
    graphSaveError: '',
    copyState: 'idle',
    mode: 'advanced',
    allowedNodeTypes
  }

  graphProcessingJobs.value = [job, ...graphProcessingJobs.value].slice(0, MAX_GRAPH_JOBS)

  if (messages.value[messageIndex]) {
  console.log('✅ Job created:', job)
  console.log('🚀 Calling processGraphJob...')
    messages.value[messageIndex].graphJobId = job.id
  }

  processGraphJob(job)
}

const generateGraphJobId = () => {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `graph-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const sanitizeJobPreview = (content = '') => {
  if (!content) return ''
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

const getMessageGraphJob = (message) => {
  if (!message?.graphJobId) return null
  return graphProcessingJobs.value.find((job) => job.id === message.graphJobId) || null
}

const isMessageGraphJobProcessing = (message) => {
  const job = getMessageGraphJob(message)
  return Boolean(job && (job.status === 'processing' || job.status === 'queued'))
}

const graphJobButtonLabel = (message) => {
  const job = getMessageGraphJob(message)
  if (!job) return 'Generate Knowledge Graph'
  if (job.status === 'processing' || job.status === 'queued') return 'Processing graph...'
  if (job.status === 'completed') return 'Graph ready'
  if (job.status === 'failed') return 'Retry graph'
  return 'Generate Knowledge Graph'
}

const jobStatusLabel = (job) => {
  if (!job) return ''
  if (job.status === 'queued' || job.status === 'processing') return 'Processing'
  if (job.status === 'completed') return 'Completed'
  if (job.status === 'failed') return 'Failed'
  return job.status
}

const startGraphProcessingFromMessage = (message, messageIndex) => {
  if (!message || message.role !== 'assistant') return
  if (!userStore.loggedIn) {
    errorMessage.value = 'Please log in to generate knowledge graphs.'
    return
  }

  const existingJob = getMessageGraphJob(message)
  if (existingJob) {
    if (existingJob.status === 'processing' || existingJob.status === 'queued') {
      return
    }
    if (existingJob.status === 'failed') {
      existingJob.status = 'queued'
      existingJob.stage = 'Retrying...'
      existingJob.progress = 5
      existingJob.error = ''
      return processGraphJob(existingJob)
    }
    return
  }

  const transcript = (message.content || '').trim()
  if (!transcript) {
    errorMessage.value = 'Assistant response is empty. Nothing to process.'
    return
  }

  const job = {
    id: generateGraphJobId(),
    messageIndex,
    provider: message.provider || provider.value,
    createdAt: Date.now(),
    status: 'queued',
    stage: 'Queued',
    progress: 5,
    transcript,
    sourcePreview: sanitizeJobPreview(message.content || ''),
    error: '',
    result: null,
    graphSaveState: 'idle',
    graphSaveError: '',
    copyState: 'idle'
  }

  graphProcessingJobs.value = [job, ...graphProcessingJobs.value].slice(0, MAX_GRAPH_JOBS)
  if (messages.value[messageIndex]) {
    messages.value[messageIndex].graphJobId = job.id
  }
  processGraphJob(job)
}

const processGraphJob = async (job) => {
  console.log('📊 processGraphJob called with job:', job)
  if (!job) return
  job.status = 'processing'
  job.stage = job.mode === 'advanced'
    ? '🔍 Analyzing with custom templates...'
    : '🔍 Analyzing transcript...'
  job.progress = 20
  job.error = ''

  try {
    const payload = {
      transcript: job.transcript,
      sourceLanguage: 'auto',
      targetLanguage: 'norwegian',
      userId: userStore.user_id,
      // Add advanced mode parameters
      ...(job.mode === 'advanced' && {
        mode: 'advanced',
        allowedNodeTypes: job.allowedNodeTypes
      })
    }

    console.log('📤 Sending request to:', GRAPH_PROCESS_ENDPOINT)
    console.log('📦 Payload:', payload)

    const response = await fetch(GRAPH_PROCESS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    job.stage = job.mode === 'advanced'
      ? '🧠 Generating graph with selected templates...'
      : '🧠 Generating knowledge graph...'
    job.progress = 70

    if (!response.ok) {
      let detail = `Processing failed (${response.status})`
      try {
        const errJson = await response.json()
        detail = errJson.error || detail
      } catch (_) {
        const errText = await response.text()
        detail = errText || detail
      }
      throw new Error(detail)
    }

    const data = await response.json().catch(() => null)
    const knowledgeGraph = data?.knowledgeGraph || data?.graph

    if (!knowledgeGraph || !Array.isArray(knowledgeGraph.nodes)) {
      throw new Error('Processor returned no knowledge graph data')
    }

    job.result = {
      ...data,
      knowledgeGraph,
      nodeCount: knowledgeGraph.nodes?.length || 0,
      edgeCount: knowledgeGraph.edges?.length || 0,
    }

    job.stage = '✅ Ready for review'
    job.status = 'completed'
    job.progress = 100

    // Auto-save graph if in advanced mode
    if (job.mode === 'advanced') {
      console.log('📦 Auto-saving graph from advanced mode')
      await createGraphFromJob(job)

      // Auto-open the graph if save succeeded
      if (job.graphSaveState === 'success' && job.createdGraphId) {
        console.log('🎯 Opening newly created graph:', job.createdGraphId)
        openGraphInViewer(job)
      }
    }
  } catch (error) {
    console.error('Graph processing failed:', error)
    job.status = 'failed'
    job.stage = '⚠️ Processing failed'
    job.progress = 100
    job.error = error.message || 'Unknown error'
  }
}

const removeGraphJob = (jobId) => {
  graphProcessingJobs.value = graphProcessingJobs.value.filter((job) => job.id !== jobId)
  messages.value.forEach((msg) => {
    if (msg.graphJobId === jobId) {
      delete msg.graphJobId
    }
  })
}

const openTranscriptProcessor = (job) => {
  if (!job) return
  try {
    sessionStorage.setItem('prefill_transcript', job.transcript || '')
    sessionStorage.setItem('auto_process', job.status === 'completed' ? 'false' : 'true')
    if (typeof window !== 'undefined') {
      window.open('/transcript-processor?prefill=true', '_blank')
    }
  } catch (error) {
    console.error('Failed to open transcript processor:', error)
    errorMessage.value = 'Unable to open transcript processor. Please check popup blockers.'
  }
}

const buildGraphSavePayload = (job) => {
  if (!job?.result?.knowledgeGraph) {
    throw new Error('No knowledge graph available to save')
  }

  const now = new Date()
  const nodeCount = job.result.nodeCount || job.result.knowledgeGraph.nodes?.length || 0
  const graphId = job.createdGraphId || `chat_graph_${Date.now()}`
  const providerLabel = providerMeta(job.provider || provider.value).label

  const metadata = {
    title: job.result?.metadata?.title || `Chat Graph ${now.toLocaleDateString('no-NO')} (${nodeCount} noder)`,
    description:
      job.result?.metadata?.description ||
      `Automatisk generert fra ${providerLabel}-svar ${now.toLocaleDateString('no-NO')} kl. ${now.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}.`,
    createdBy: userStore.email || providerLabel,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    source: 'GrokChatPanel',
  }

  const nodes = (job.result.knowledgeGraph.nodes || []).map((node, index) => ({
    ...node,
    id: node.id || `chat_node_${job.id}_${index}`,
    position: node.position || { x: 150 + (index % 4) * 280, y: 80 + Math.floor(index / 4) * 220 },
    visible: node.visible !== false,
  }))

  const edges = job.result.knowledgeGraph.edges || []

  return {
    id: graphId,
    graphData: {
      metadata,
      nodes,
      edges,
    },
  }
}

const createGraphFromJob = async (job) => {
  if (!job || job.status !== 'completed' || job.graphSaveState === 'saving') return
  if (!userStore.loggedIn || !userStore.emailVerificationToken) {
    errorMessage.value = 'Log in to save generated graphs.'
    return
  }

  job.graphSaveState = 'saving'
  job.graphSaveError = ''

  try {
    const payload = buildGraphSavePayload(job)
    const response = await fetch(KNOWLEDGE_GRAPH_SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({ id: payload.id, graphData: payload.graphData }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || `Failed with status ${response.status}`)
    }

    const result = await response.json().catch(() => ({}))
    const finalGraphId = result.graphId || payload.id

    knowledgeGraphStore.setCurrentGraphId(finalGraphId)
    knowledgeGraphStore.updateGraphFromJson({
      nodes: payload.graphData.nodes,
      edges: payload.graphData.edges,
      metadata: payload.graphData.metadata,
    })

    job.createdGraphId = finalGraphId
    job.graphSaveState = 'success'
    job.stage = '📦 Graph saved'
  } catch (error) {
    console.error('Failed to save graph:', error)
    job.graphSaveState = 'error'
    job.graphSaveError = error.message || 'Unknown error'
  }
}

const openGraphInViewer = (job) => {
  if (!job?.createdGraphId) return
  try {
    router.push(`/gnew-viewer?graphId=${job.createdGraphId}`)
  } catch (error) {
    console.warn('Router navigation failed, opening new tab.', error)
    if (typeof window !== 'undefined') {
      window.open(`/gnew-viewer?graphId=${job.createdGraphId}`, '_blank')
    }
  }
}

const copyKnowledgeGraphJson = async (job) => {
  if (!job?.result?.knowledgeGraph || typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(job.result.knowledgeGraph, null, 2))
    job.copyState = 'copied'
    setTimeout(() => {
      job.copyState = 'idle'
    }, 1500)
  } catch (error) {
    console.error('Clipboard copy failed:', error)
    errorMessage.value = 'Failed to copy knowledge graph JSON. Please try again.'
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const authorizedHistoryFetch = async (path, options = {}) => {
  if (!canPersistHistory.value) {
    throw new Error('Chat history unavailable for anonymous users')
  }
  const headers = new Headers(options.headers || {})
  headers.set('x-user-id', userStore.user_id)
  headers.set('x-user-email', userStore.email || 'anonymous@vegvisr.org')
  headers.set('x-user-role', userStore.role || 'User')

  return fetch(`${CHAT_HISTORY_BASE_URL}${path}`, {
    ...options,
    headers,
  })
}

const getStoredSessionId = () => {
  if (!sessionStorageKey.value || typeof window === 'undefined') return null
  try {
    return localStorage.getItem(sessionStorageKey.value)
  } catch (_) {
    return null
  }
}

const persistSessionIdLocally = (sessionId) => {
  if (!sessionId || !sessionStorageKey.value || typeof window === 'undefined') return
  try {
    localStorage.setItem(sessionStorageKey.value, sessionId)
  } catch (_) {
    /* ignore quota errors */
  }
}

const clearStoredSessionId = () => {
  if (!sessionStorageKey.value || typeof window === 'undefined') return
  try {
    localStorage.removeItem(sessionStorageKey.value)
  } catch (_) {
    /* ignore */
  }
}

const beginRenameSession = (session) => {
  if (!session) return
  renamingSessionId.value = session.id
  renameInput.value = session.title || 'Untitled session'
  renameError.value = ''
}

const cancelRenameSession = () => {
  renamingSessionId.value = null
  renameInput.value = ''
  renameError.value = ''
}

const confirmRenameSession = async (sessionId) => {
  if (!sessionId || renamingSessionId.value !== sessionId) return
  const trimmedTitle = (renameInput.value || '').trim()
  if (!trimmedTitle) {
    renameError.value = 'Please enter a session title.'
    return
  }

  renameSaving.value = true
  renameError.value = ''
  try {
    const preserveActive = chatSessionId.value !== sessionId
    const session = await upsertChatSession({
      sessionIdOverride: sessionId,
      customTitle: trimmedTitle,
      preserveActiveSession: preserveActive,
    })
    if (!session) {
      upsertSessionPreview({
        id: sessionId,
        title: trimmedTitle,
        updatedAt: new Date().toISOString(),
      })
    }
    cancelRenameSession()
  } catch (error) {
    renameError.value = error.message || 'Failed to rename session'
  } finally {
    renameSaving.value = false
  }
}

const buildSessionMetadata = () => ({
  graphTitle: props.graphData?.metadata?.title || 'Untitled Graph',
  graphDescription: props.graphData?.metadata?.description || '',
  nodeCount: props.graphData?.nodes?.length || 0,
  edgeCount: props.graphData?.edges?.length || 0,
  selectionNodeId: props.selectionContext?.nodeId || null,
})

const upsertSessionPreview = (session) => {
  if (!session) return
  const existingIndex = availableSessions.value.findIndex((s) => s.id === session.id)
  if (existingIndex >= 0) {
    availableSessions.value[existingIndex] = {
      ...availableSessions.value[existingIndex],
      ...session,
    }
  } else {
    availableSessions.value = [session, ...availableSessions.value].slice(0, 50)
  }
}

const upsertChatSession = async (options = {}) => {
  const {
    sessionIdOverride = null,
    customTitle = null,
    skipStoredId = false,
    preserveActiveSession = false,
  } = options
  if (!canPersistHistory.value || !graphIdentifier.value) return null

  const previousSessionId = chatSessionId.value

  const payload = {
    graphId: graphIdentifier.value,
    provider: provider.value,
    metadata: buildSessionMetadata(),
  }
  const defaultSessionTitle = props.graphData?.metadata?.title || 'Graph Conversation'

  const cachedSessionId = (skipStoredId || !RESUME_SESSION_ON_LOAD) ? null : getStoredSessionId()
  const finalSessionId = sessionIdOverride || cachedSessionId
  if (finalSessionId) {
    payload.sessionId = finalSessionId
  }

  if (customTitle) {
    payload.title = customTitle
  } else if (!finalSessionId) {
    payload.title = defaultSessionTitle
  }

  const response = await authorizedHistoryFetch('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Unable to create chat session')
  }

  const data = await response.json().catch(() => ({}))
  if (data?.session?.id) {
    const shouldPreserveActive = Boolean(
      preserveActiveSession &&
      sessionIdOverride &&
      previousSessionId &&
      sessionIdOverride !== previousSessionId
    )

    if (!shouldPreserveActive) {
      chatSessionId.value = data.session.id
      persistSessionIdLocally(data.session.id)
    }
    upsertSessionPreview(data.session)
  }
  return data.session || null
}

const loadChatHistory = async (keySnapshot = sessionStorageKey.value) => {
  if (!chatSessionId.value) return false

  const params = new URLSearchParams({
    sessionId: chatSessionId.value,
    decrypt: '1',
    limit: '200',
  })

  const response = await authorizedHistoryFetch(`/messages?${params.toString()}`, {
    method: 'GET',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || 'Unable to load chat history')
  }

  const data = await response.json().catch(() => ({}))
  const rawMessages = data.messages || []

  // Debug: Log raw messages from API to see if proffData is returned
  const rawWithProff = rawMessages.filter(m => m.proffData || m.usedProffAPI)
  if (rawWithProff.length > 0) {
    console.log('loadChatHistory: Raw API response has', rawWithProff.length, 'messages with proffData')
    rawWithProff.forEach((m, i) => {
      console.log(`  [${i}] raw proffData keys:`, m.proffData ? Object.keys(m.proffData) : 'null', 'usedProffAPI:', m.usedProffAPI)
    })
  } else {
    console.log('loadChatHistory: No proffData in raw API response')
  }

  const sortedRaw = [...rawMessages].sort((a, b) => {
    const aTs = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTs = b.createdAt ? Date.parse(b.createdAt) : 0
    return aTs - bTs
  })

  let fallbackProvider = provider.value
  const normalized = sortedRaw.map((message) => {
    const timestamp = message.createdAt ? Date.parse(message.createdAt) : Date.now()
    const resolvedProvider = message.provider || (message.role === 'assistant' ? fallbackProvider : provider.value)
    if (message.role === 'assistant' && message.provider) {
      fallbackProvider = message.provider
    }
    const hasProff = Boolean(message.usedProffAPI || message.proffData)
    const hasSources = Boolean(message.usedSourcesAPI || message.sourcesData)

    return {
      id: message.id,
      role: message.role,
      content: message.content || '',
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      provider: resolvedProvider,
      selectionMeta: message.selectionMeta || null,
      // Restore Proff API metadata if present
      usedProffAPI: hasProff,
      proffData: message.proffData || null,
      // Restore Sources API metadata if present
      usedSourcesAPI: hasSources,
      sourcesData: message.sourcesData || null,
      imageData: message.imageData || null,
    }
  })

  if (sessionStorageKey.value !== keySnapshot) {
    return false
  }

  messages.value = normalized
  scrollToBottom()
  historyLastLoaded.value = new Date().toISOString()

  // Debug: Log messages with proffData after loading
  const messagesWithProff = normalized.filter(m => m.proffData || m.usedProffAPI)
  if (messagesWithProff.length > 0) {
    console.log('loadChatHistory: Found', messagesWithProff.length, 'messages with proffData')
    messagesWithProff.forEach((m, i) => {
      console.log(`  [${i}] proffData keys:`, m.proffData ? Object.keys(m.proffData) : 'null', 'usedProffAPI:', m.usedProffAPI)
    })
  }

  const lastAssistant = [...normalized].reverse().find((msg) => msg.role === 'assistant' && msg.provider)
  if (lastAssistant?.provider) {
    provider.value = lastAssistant.provider
  }
  return true
}

const initializeChatHistory = async (forceReload = false, keySnapshot = sessionStorageKey.value) => {
  if (!canPersistHistory.value || !sessionStorageKey.value) return null
  if (sessionInitPromise && !forceReload) {
    return sessionInitPromise
  }

  sessionInitPromise = (async () => {
    historyLoading.value = true
    historyError.value = ''
    try {
      // Always fetch available sessions when initializing
      fetchChatSessions()

      // Only try to load existing session, don't create a new one yet
      const cachedSessionId = getStoredSessionId()
      if (cachedSessionId) {
        chatSessionId.value = cachedSessionId
        await loadChatHistory(keySnapshot)
      } else {
        // No existing session - will be created on first message
        console.log('No existing session found - will create on first message')
      }
    } catch (error) {
      console.warn('Chat session init failed:', error)
      historyError.value = error.message || 'Failed to load chat history'
    } finally {
      historyLoading.value = false
      sessionInitPromise = null
    }
  })()

  return sessionInitPromise
}

const startNewChatSession = async () => {
  if (!canPersistHistory.value || historyLoading.value) return
  historyLoading.value = true
  historyError.value = ''
  cancelRenameSession()
  sessionListOpen.value = false
  messages.value = []
  historyLastLoaded.value = null
  chatSessionId.value = null
  clearStoredSessionId()
  try {
    const session = await upsertChatSession({ skipStoredId: true })
    if (session?.id) {
      chatSessionId.value = session.id
      persistSessionIdLocally(session.id)
      upsertSessionPreview(session)
    }
    await fetchChatSessions()
  } catch (error) {
    historyError.value = error.message || 'Failed to start new session'
  } finally {
    historyLoading.value = false
  }
}

const deleteChatSession = async (session) => {
  const sessionId = session?.id
  if (!sessionId || deletingSessionId.value === sessionId) return

  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(`Delete session "${session.title || 'Untitled session'}"?`)
    if (!confirmed) {
      return
    }
  }

  deleteSessionError.value = ''
  deletingSessionId.value = sessionId
  try {
    const response = await authorizedHistoryFetch(`/sessions/${sessionId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error((await response.text()) || 'Failed to delete session')
    }

    availableSessions.value = availableSessions.value.filter((s) => s.id !== sessionId)

    if (chatSessionId.value === sessionId) {
      chatSessionId.value = null
      clearStoredSessionId()
      messages.value = []
      historyLastLoaded.value = null
    }

    await fetchChatSessions()
  } catch (error) {
    deleteSessionError.value = error.message || 'Failed to delete session'
  } finally {
    if (deletingSessionId.value === sessionId) {
      deletingSessionId.value = null
    }
  }
}
const persistChatMessage = async (message) => {
  if (!canPersistHistory.value || !message) return

  // Create session on first message
  if (!chatSessionId.value) {
    console.log('Creating chat session for first message')
    await upsertChatSession()
  }

  if (!chatSessionId.value) return

  try {
    const payload = {
      sessionId: chatSessionId.value,
      role: message.role || 'user',
    }

    if (message.id) {
      payload.messageId = message.id
    }

    if (message.selectionMeta) {
      payload.selectionMeta = message.selectionMeta
    }

    // Save provider info for assistant messages
    if (message.role === 'assistant' && message.provider) {
      payload.provider = message.provider
    }

    // Save Proff API metadata if present
    if (message.usedProffAPI) {
      payload.usedProffAPI = true
    }
    if (message.proffData) {
      payload.proffData = message.proffData
    }

    // Save Sources API metadata if present
    if (message.usedSourcesAPI) {
      payload.usedSourcesAPI = true
    }
    if (message.sourcesData) {
      payload.sourcesData = message.sourcesData
    }
    if (message.imageData) {
      payload.imageData = message.imageData
    }

    if (message.ciphertext && message.iv && message.salt) {
      payload.ciphertext = message.ciphertext
      payload.iv = message.iv
      payload.salt = message.salt
    } else if (typeof message.content === 'string' && message.content.length) {
      payload.content = message.content
    } else {
      return
    }

    // Debug: Log when persisting proffData
    if (payload.proffData || payload.usedProffAPI) {
      console.log('persistChatMessage: Saving message with proffData keys:', payload.proffData ? Object.keys(payload.proffData) : 'null', 'usedProffAPI:', payload.usedProffAPI)
    }

    const response = await authorizedHistoryFetch('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      if (data?.message?.id && !message.id) {
        message.id = data.message.id
      }
      const nowIso = new Date().toISOString()
      upsertSessionPreview({
        id: chatSessionId.value,
        updatedAt: nowIso,
      })
    } else {
      console.warn('Chat history persistence failed:', await response.text())
    }
  } catch (error) {
    console.warn('Chat history persistence error:', error)
  }
}

const appendChatMessage = (message, options = {}) => {
  messages.value.push(message)
  scrollToBottom()
  if (options.persist === false) {
    return
  }
  persistChatMessage(message)
}

const fetchChatSessions = async () => {
  if (!canPersistHistory.value) return
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const params = new URLSearchParams()
    if (graphIdentifier.value) {
      params.set('graphId', graphIdentifier.value)
    }
    const query = params.toString()
    const response = await authorizedHistoryFetch(`/sessions${query ? `?${query}` : ''}`, {
      method: 'GET',
    })
    if (!response.ok) {
      throw new Error((await response.text()) || 'Failed to load sessions')
    }
    const data = await response.json().catch(() => ({}))
    availableSessions.value = data.sessions || []
  } catch (error) {
    sessionsError.value = error.message || 'Failed to load sessions'
  } finally {
    sessionsLoading.value = false
  }
}

const formatSessionTimestamp = (isoString) => {
  if (!isoString) return 'No activity yet'
  try {
    const date = new Date(isoString)
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch (_) {
    return isoString
  }
}

const selectChatSession = async (sessionId) => {
  if (!sessionId || sessionId === chatSessionId.value) {
    sessionListOpen.value = false
    return
  }

  cancelRenameSession()
  historyLoading.value = true
  historyError.value = ''
  chatSessionId.value = sessionId
  persistSessionIdLocally(sessionId)
  messages.value = []

  try {
    await loadChatHistory(sessionStorageKey.value)
    sessionListOpen.value = false
  } catch (error) {
    historyError.value = error.message || 'Failed to load chat history'
  } finally {
    historyLoading.value = false
  }
}

const toggleSessionList = async () => {
  if (!canPersistHistory.value) return
  sessionListOpen.value = !sessionListOpen.value
  if (sessionListOpen.value) {
    deleteSessionError.value = ''
  }
  if (sessionListOpen.value) {
    if (!sessionsLoading.value && availableSessions.value.length === 0) {
      await fetchChatSessions()
    }
  } else {
    cancelRenameSession()
  }
}

const retryHistoryLoad = () => {
  if (!canPersistHistory.value) return
  initializeChatHistory(true, sessionStorageKey.value)
}

watch(
  () => ({ key: sessionStorageKey.value, allow: canPersistHistory.value }),
  async ({ key, allow }, oldValue) => {
    if (!allow || !key) {
      if (!allow) {
        chatSessionId.value = null
        historyLoading.value = false
        historyError.value = ''
        availableSessions.value = []
        sessionListOpen.value = false
        cancelRenameSession()
        deleteSessionError.value = ''
      }
      return
    }

    const shouldForceReload = lastInitializedSessionKey.value !== key
    if (shouldForceReload) {
      // Clean up empty session from previous graph if it exists
      const previousSessionId = chatSessionId.value
      if (previousSessionId && messages.value.length === 0) {
        console.log('Deleting empty session:', previousSessionId)
        try {
          await authorizedHistoryFetch(`/sessions/${previousSessionId}`, {
            method: 'DELETE'
          })
        } catch (error) {
          console.warn('Failed to delete empty session:', error)
        }
      }

      messages.value = []
      availableSessions.value = []
      chatSessionId.value = null
      clearStoredSessionId()
    }

    lastInitializedSessionKey.value = key
    await initializeChatHistory(shouldForceReload, key)
  },
  { immediate: true }
)

const handleShiftEnter = () => {
  // Allow default behavior (new line)
}

onMounted(() => {
  userStore.hydrateProfileImageFromConfig()
})

const buildGraphContext = () => {
  if (!useGraphContext.value || !props.graphData) return null

  const { nodes, edges, metadata } = props.graphData

  const context = {
    metadata: {
      title: metadata?.title || 'Untitled Graph',
      description: metadata?.description || '',
      category: metadata?.category || '',
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0,
    },
    nodes: nodes?.slice(0, 20).map((node) => {
      const infoString = typeof node.info === 'string' ? node.info : String(node.info || '')
      // CSS nodes need full content so the AI can edit styles properly
      const maxLen = node.type === 'css-node' ? 10000 : 500
      return {
        id: node.id,
        label: node.label || node.id,
        type: node.type || 'unknown',
        info: infoString ? infoString.substring(0, maxLen) : '',
      }
    }) || [],
    edges: edges?.slice(0, 30).map((edge) => ({
      from: edge.from,
      to: edge.to,
    })) || [],
  }

  return context
}

const buildGraphIdContext = () => {
  if (!props.graphData) return null

  const graphId =
    props.graphData.id ||
    props.graphData.graphId ||
    props.graphData.metadata?.id ||
    props.graphData.metadata?.graphId ||
    props.graphData.metadata?.graph_id ||
    null
  const nodes = Array.isArray(props.graphData.nodes) ? props.graphData.nodes : []
  const sampleSize = 60
  const nodeLines = nodes.slice(0, sampleSize).map((node) => {
    const label = node.label || node.title || ''
    return label ? `- ${node.id} — ${label}` : `- ${node.id}`
  })
  const moreCount = nodes.length > sampleSize ? `\n...and ${nodes.length - sampleSize} more nodes.` : ''

  return `Current Graph ID: ${graphId || 'Unknown'}
Node count: ${nodes.length}
Node IDs & labels (first ${Math.min(sampleSize, nodes.length)}):
${nodeLines.join('\n') || 'No nodes'}
${moreCount}`
}

const extractReferencedNodeIds = (text) => {
  if (!text) return []
  const matches = String(text).match(
    /\b(html-node_[a-zA-Z0-9_-]+|css-node_[a-zA-Z0-9_-]+|node-[a-zA-Z0-9_-]+)\b/g,
  )
  if (!matches) return []
  return Array.from(new Set(matches))
}

const buildReferencedNodeContext = (text) => {
  if (!props.graphData) return null
  const nodeIds = extractReferencedNodeIds(text)
  if (!nodeIds.length) return null

  const nodes = Array.isArray(props.graphData.nodes) ? props.graphData.nodes : []
  const byId = new Map(nodes.map((n) => [String(n.id || ''), n]))

  const blocks = []
  for (const nodeId of nodeIds.slice(0, 3)) {
    const node = byId.get(nodeId)
    if (!node) continue
    const type = String(node.type || 'unknown')
    const label = String(node.label || node.title || nodeId)
    const rawInfo = typeof node.info === 'string' ? node.info : String(node.info || '')
    const maxLen = type === 'css-node' ? 12000 : type === 'html-node' ? 20000 : 6000
    const info = rawInfo.length > maxLen ? `${rawInfo.slice(0, maxLen)}\n<!-- truncated -->` : rawInfo
    const fence = type === 'css-node' ? 'css' : type === 'html-node' ? 'html' : 'text'
    blocks.push(
      `Referenced node: ${nodeId}\nType: ${type}\nLabel: ${label}\n\n\`\`\`${fence}\n${info}\n\`\`\``,
    )
  }

  if (!blocks.length) return null

  return `**Referenced Node Context (Auto-included)**\nThe user referenced node id(s) in their prompt. Use the content below so you can make edits without asking the user to paste the node.\n\n${blocks.join(
    '\n\n',
  )}`
}

const buildSelectionContext = () => {
  if (!useSelectionContext.value || !hasSelectionContext.value) return null

  const selection = props.selectionContext
  if (!selection?.text?.trim()) return null

  return {
    text: selection.text.trim().substring(0, 1500),
    label: selection.nodeLabel || 'Highlighted text',
    nodeId: selection.nodeId || null,
    nodeType: selection.nodeType || null,
    source: selection.source || 'graph',
  }
}

const buildRawJsonContext = () => {
  if (!useRawJsonMode.value || !props.graphData) return null

  const rawData = {
    metadata: {
      graphId: props.graphData.id || props.graphData.graphId || props.graphData.metadata?.id || null,
      title: props.graphData.metadata?.title || 'Untitled',
      description: props.graphData.metadata?.description || '',
      category: props.graphData.metadata?.category || '',
      created: props.graphData.metadata?.created || null,
      updated: props.graphData.metadata?.updated || null,
      author: props.graphData.metadata?.author || '',
      tags: props.graphData.metadata?.tags || [],
      nodeCount: (props.graphData.nodes || []).length,
      edgeCount: (props.graphData.edges || []).length,
      version: props.graphData.metadata?.version || '1.0',
      ...(props.graphData.metadata || {}), // Include all other metadata
    },
    nodes: props.graphData.nodes || [],
    edges: props.graphData.edges || [],
    raw: props.graphData, // Include the complete raw data
  }

  return {
    json: rawData,
    jsonString: JSON.stringify(rawData, null, 2),
  }
}

const handleImageGeneration = async (imagePrompt, originalMessage) => {
  // Add user message showing the request
  appendChatMessage({
    role: 'user',
    content: originalMessage,
    timestamp: Date.now(),
    provider: provider.value,
  })

  userInput.value = ''
  errorMessage.value = ''
  isStreaming.value = true
  streamingContent.value = 'Generating image...'
  scrollToBottom()

  try {
    // 1. Generate image via OpenAI
    const validImageSizes = {
      'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      'gpt-image-1.5': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      'gpt-image-1-mini': ['1024x1024', '1536x1024', '1024x1536', 'auto'],
      'dall-e-3': ['1024x1024', '1024x1792', '1792x1024'],
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
    }
    const aspectMap = {
      '1:1': 'square',
      '16:9': 'landscape',
      '9:16': 'portrait',
    }
    const extractAspectRatio = (text) => {
      if (!text) return { aspect: '1:1', cleaned: text }
      const match = text.match(/--ar\s*(\d+\s*:\s*\d+)/i)
      if (!match) return { aspect: '1:1', cleaned: text }
      const raw = match[1].replace(/\s+/g, '')
      const aspect = aspectMap[raw] ? raw : '1:1'
      const cleaned = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim()
      return { aspect, cleaned }
    }
    const { aspect, cleaned } = extractAspectRatio(imagePrompt)
    const requestedModel = openaiModel.value.startsWith('gpt-image')
      ? openaiModel.value
      : 'gpt-image-1.5'
    const supportedImageModels = new Set(['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'])
    const selectedModel = supportedImageModels.has(requestedModel) ? requestedModel : 'gpt-image-1.5'
    const sizeByAspect = {
      'gpt-image-1-mini': {
        '1:1': '512x512',
        '16:9': '768x384',
        '9:16': '256x512',
      },
      'gpt-image-1': {
        '1:1': '1024x1024',
        '16:9': '1536x1024',
        '9:16': '1024x1536',
      },
      'default': {
        '1:1': '1024x1024',
        '16:9': '1536x1024',
        '9:16': '1024x1536',
      },
    }
    const aspectSizes = sizeByAspect[selectedModel] || sizeByAspect.default
    const requestedSize = aspectSizes[aspect] || aspectSizes['1:1']
    const modelSizes = validImageSizes[selectedModel] || [aspectSizes['1:1']]
    const size = modelSizes.includes(requestedSize)
      ? requestedSize
      : modelSizes[0]
    const response = await fetch('https://openai.vegvisr.org/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userStore.user_id || 'system',
        model: selectedModel,
        prompt: cleaned,
        size,
        quality: 'auto',
        n: 1
      }),
    })

    if (!response.ok) {
      let errorDetail = `Image generation error: ${response.status}`
      try {
        const errJson = await response.json()
        errorDetail = errJson.error?.message || errJson.error || JSON.stringify(errJson)
      } catch (_) {
        errorDetail = await response.text()
      }
      throw new Error(errorDetail)
    }

    const data = await response.json()
    const imageBase64 = data.data?.[0]?.b64_json
    const imageUrl = data.data?.[0]?.url
    const revisedPrompt = data.data?.[0]?.revised_prompt

    if (!imageBase64 && !imageUrl) {
      throw new Error('No image data in response')
    }

    let fullImageUrl = null
    let previewBase64 = imageBase64 || null
    let previewMimeType = 'image/png'
    if (!previewBase64 && imageUrl) {
      const fromUrl = await toBase64FromUrl(imageUrl)
      previewBase64 = fromUrl.base64
      previewMimeType = fromUrl.mimeType
    }
    if (previewBase64) {
      const preview = await compressBase64Image(previewBase64, previewMimeType, 512, 0.7)
      if (preview?.base64) {
        previewBase64 = preview.base64
        previewMimeType = preview.mimeType
      }
    }

    try {
      if (previewBase64) {
        const uploadMimeType = imageBase64 ? 'image/png' : previewMimeType
        const uploadResponse = await authorizedHistoryFetch('/session-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data: imageBase64 || previewBase64,
            mimeType: uploadMimeType,
          }),
        })
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json().catch(() => ({}))
          fullImageUrl = uploadData?.url || null
        }
      }
    } catch (error) {
      console.warn('Image upload failed:', error)
    }

    const imageData = {
      base64Data: previewBase64 || null,
      previewImageUrl: fullImageUrl || imageUrl || null,
      fullImageUrl: fullImageUrl || null,
      mimeType: previewMimeType,
      prompt: cleaned,
      revisedPrompt,
      model: selectedModel,
      size,
      quality: 'auto',
      imageType: 'standalone',
    }

    // Add assistant message with the image preview data
    appendChatMessage({
      role: 'assistant',
      content: `🖼️ ${imagePrompt}`,
      timestamp: Date.now(),
      provider: provider.value,
      imageData,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    errorMessage.value = `Error: ${error.message}`

    // Add error message to chat
    appendChatMessage({
      role: 'assistant',
      content: `❌ Image generation failed: ${error.message}`,
      timestamp: Date.now(),
      provider: provider.value,
    })
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

const sendMessage = async () => {
  const message = userInput.value.trim()
  if (!message || isStreaming.value) return

  const userPrompt = message
  const currentProvider = provider.value
  const hasImage = uploadedImage.value && currentProvider !== 'grok'
  const selectionFocus = buildSelectionContext()

  // Image generation (OpenAI only): support `/image ...` plus common natural language phrasing.
  const slashImageMatch = message.match(/^\/(image|img)\s+(.+)$/i)
  if (slashImageMatch) {
    if (currentProvider !== 'openai') {
      appendChatMessage({
        role: 'assistant',
        content: `🖼️ Image generation is currently only wired for OpenAI. Switch provider to OpenAI and try again.`,
        timestamp: Date.now(),
        provider: currentProvider,
      })
      return
    }

    const imagePrompt = (slashImageMatch[2] || '').trim()
    if (!imagePrompt) return
    return await handleImageGeneration(imagePrompt, message)
  }

  // Check for natural language image generation commands (e.g. "make me an image of ...", "please generate a picture ...")
  const normalizedForImageGen = message
    .replace(/^\s*(please|pls)\s+/i, '')
    .replace(/^\s*(can you|could you|would you)\s+/i, '')
    .trim()

  const imageGenPattern = /^(create|generate|make|draw|paint|design|produce)\s+(me\s+)?(an?\s+)?(image|picture|photo|illustration|artwork)\s*(of\s+)?(.+)$/i
  const imageGenMatch = normalizedForImageGen.match(imageGenPattern)

  if (imageGenMatch) {
    if (currentProvider !== 'openai') {
      appendChatMessage({
        role: 'assistant',
        content: `🖼️ Image generation is currently only wired for OpenAI. Switch provider to OpenAI and try again.`,
        timestamp: Date.now(),
        provider: currentProvider,
      })
      return
    }

    // Extract the prompt (last capture group)
    const imagePrompt = (imageGenMatch[6] || '').trim()
    if (!imagePrompt) return
    return await handleImageGeneration(imagePrompt, message)
  }

  if (currentProvider === 'openai' && openaiModel.value.startsWith('gpt-image')) {
    if (hasImage) {
      appendChatMessage({
        role: 'assistant',
        content: '🖼️ Image models cannot analyze images. Switch to a chat model (e.g. GPT-5.2) for image analysis.',
        timestamp: Date.now(),
        provider: currentProvider,
      })
      return
    }
    return await handleImageGeneration(message, message)
  }

  // Add user message
  appendChatMessage({
    role: 'user',
    content: hasImage ? `${message} [Image attached]` : message,
    timestamp: Date.now(),
    provider: currentProvider,
    hasImage,
    selectionMeta: selectionFocus || null,
  })

  userInput.value = ''
  errorMessage.value = ''
  isStreaming.value = true
  streamingContent.value = ''
  scrollToBottom()

  try {
    // Build messages array
    let grokMessages = messages.value.map((m) => {
      // For the latest message with image, format according to provider
      if (m === messages.value[messages.value.length - 1] && hasImage && uploadedImage.value) {
        if (currentProvider === 'claude') {
          return {
            role: m.role,
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: uploadedImage.value.mimeType,
                  data: uploadedImage.value.base64
                }
              },
              {
                type: 'text',
                text: message
              }
            ]
          }
        } else if (currentProvider === 'openai' || currentProvider === 'perplexity') {
          return {
            role: m.role,
            content: [
              {
                type: 'text',
                text: message
              },
              {
                type: 'image_url',
                image_url: {
                  url: uploadedImage.value.preview
                }
              }
            ]
          }
        }
      }
      return {
        role: m.role,
        content: m.content,
      }
    })

    const contextSections = []
    const graphIdContext = buildGraphIdContext()
    if (graphIdContext) {
      contextSections.push(graphIdContext)
    }

    const referencedNodeContext = buildReferencedNodeContext(userPrompt)
    if (referencedNodeContext) {
      contextSections.push(referencedNodeContext)
    }

    // Add tool usage instructions when tools are enabled
    if (currentProvider === 'openai' || currentProvider === 'claude' || currentProvider === 'grok') {
      const toolSections = []

      if (useProffTools.value || useSourcesTools.value) {
        let toolInstructions = `IMPORTANT: You have access to external data tools and YOU MUST USE THEM for any questions about Norwegian companies, people, or sources. Do NOT answer from memory - always use the tools to get real-time data.

`
        if (useProffTools.value) {
          toolInstructions += `**Proff.no Tools** (Norwegian Business Registry - Brønnøysundregistrene):
You MUST use these tools for ANY question about Norwegian companies or business people. Never guess - always look up!

WORKFLOW FOR COMPANIES:
1. proff_search_companies - ALWAYS start here when user mentions ANY company name. Returns org.nr needed for other lookups.
2. proff_get_financials - Use for revenue/omsetning, profit/resultat, EBITDA. Requires org.nr from step 1.
3. proff_get_company_details - Use for board members, shareholders, addresses. Requires org.nr from step 1.

WORKFLOW FOR FINDING CONNECTIONS BETWEEN PEOPLE:
1. proff_search_persons - Search for FIRST person by name → get their personId
2. proff_search_persons - Search for SECOND person by name → get their personId
3. proff_find_business_network - Use BOTH personIds to find the shortest path/connection between them

WORKFLOW FOR EXPLORING A PERSON:
1. proff_search_persons - Search by name → get personId
2. proff_get_person_details - Get ALL their board positions, roles, and connected companies

EXAMPLES:
- "Hvem er Maiken Sneeggen?" → proff_search_persons("Maiken Sneeggen") → proff_get_person_details(personId)
- "Hva er forbindelsen mellom Maiken Sneeggen og Tor Arne Håve?" → proff_search_persons for BOTH names → proff_find_business_network(personId1, personId2)
- "Hva tjener Equinor?" → proff_search_companies("Equinor") → proff_get_financials(orgNr)

`
        }
        if (useSourcesTools.value) {
          toolInstructions += `**Norwegian Sources Tools** (Government, Research, News):
- sources_search - Search across Norwegian news, government, research sources (Regjeringen, SSB, NRK, etc.)
- sources_google_news - Search Google News for breaking news and international stories
- sources_web_search - General web search (DuckDuckGo) for websites and documentation
- sources_get_hearings - Get public hearings (høringer)
- sources_environment_news - Environment/climate news from multiple sources
- sources_list_feeds - List all available sources

Use sources_search for Norwegian public sources, sources_google_news for current news, sources_web_search for general web info.
`
        }
        toolSections.push(toolInstructions.trim())
      }

      if (useTemplateTools.value && canUseTemplateTools.value) {
        toolSections.push(`**Graph Template Tools** (Admin only):
Use graph_template_catalog to list approved node templates. Then call graph_template_insert with template_id and node_overrides to insert a node into the current graph. The graph is saved immediately after insertion.

Guidelines:
- Call graph_template_catalog FIRST to see available templates and their content.
- Templates contain pre-defined content (info field) - DO NOT override the info field unless the user explicitly asks to change the content.
- Only override "label" to give the node a meaningful name.
- The template's info field contains carefully designed HTML/content that should be preserved.
- For html-node templates: NEVER override the info field - the template contains the complete HTML page.
- For fulltext templates: NEVER override the info field unless user provides specific content.
- For mermaid-diagram templates: You MAY override info with new mermaid syntax if user wants different diagram content.

IMPORTANT: When user says "add a new html-node" or "add a fulltext node", use the template AS-IS with only a label override.

Example (using template without changing content):
graph_template_insert({
  "template_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "node_overrides": {
    "label": "KontaktPunkt Landing Page"
  }
})

Example (timeline - where info override IS appropriate):
graph_template_insert({
  "template_id": "74e137f0-5e08-4efe-a062-c806fa633813",
  "node_overrides": {
    "label": "Timeline of Early Sanskrit Scholars",
    "info": "timeline\\n  title Timeline of Early Sanskrit Scholars\\n  section Vedic period\\n    Yaska : Nirukta\\n    Panini : Ashtadhyayi"
  }
})`)
      }

      // Always offer graph manipulation tools
      toolSections.push(`**Graph Data Manipulation Tools** (Save/Update Knowledge Graphs):
You can directly manipulate and persist the knowledge graph data to the database:
- graph_get_current_data - Retrieve information about the current graph (nodes, edges, metadata)
- graph_save_new - Save the current graph as a NEW knowledge graph with a custom title and description
- graph_update_current - Update the current graph with modified nodes, edges, or metadata
- graph_node_search_replace - Fast search-and-replace within a node's info field (PREFERRED for simple text changes)
- graph_attach_css_to_html - Link a css-node to an html-node with a styles edge
- graph_detach_css_from_html - Remove styles edges from html-node/css-node

IMPORTANT — PREFER graph_node_search_replace FOR SIMPLE EDITS:
When the user asks to change a color, rename a class, update a word, or make any small text change in a node, ALWAYS use graph_node_search_replace instead of graph_update_current. It is much faster because it only sends the search/replace strings instead of the entire node content. Only use graph_update_current when you need to rewrite large portions of the content.

Example: "Change the title color from red to green"
graph_node_search_replace({
  "nodeId": "4745d030-b004-4f19-ad89-39e42e33fbd8",
  "search": "color: red",
  "replace": "color: green"
})

Example: "Rename all .btn classes to .button"
graph_node_search_replace({
  "nodeId": "4745d030-b004-4f19-ad89-39e42e33fbd8",
  "search": ".btn",
  "replace": ".button",
  "replaceAll": true
})

WORKFLOW FOR MODIFYING AND SAVING GRAPHS:
1. Use graph_get_current_data to understand the current graph structure
2. If you want to create a new version: graph_save_new with title and description
3. If you want to modify the existing: graph_update_current with updated nodes/edges/metadata

PARTIAL NODE UPDATES (Implicit Patching):
When you're in Raw JSON Mode with a highlighted selection, you can perform surgical edits:
- Only include the specific fields that changed (don't resend entire nodes)
- The backend's PATCH endpoint will merge your changes with existing data
- Example: If only "info" field changed, send only {"id": "node-id", "info": "new content"}

EXAMPLES:
graph_save_new({
  "title": "Market Analysis 2024",
  "description": "Competitive analysis of software companies"
})

graph_update_current({
  "metadata": {
    "description": "Updated with latest market data"
  },
  "nodes": [/* modified nodes */],
  "edges": [/* modified edges */]
})

PARTIAL UPDATE EXAMPLE (changing only a meta tag in node info):
graph_update_current({
  "nodes": [{
    "id": "node-96e477ae",
    "info": "<meta property=\"og:site_name\" content=\"Connect Norse Gong ™\" />"
  }]
})

Guidelines:
- Always use graph_get_current_data first to understand the structure
- When saving new graphs, provide meaningful titles and descriptions
- For partial updates: only include the fields being changed (id + changed fields)
- The backend supports both full node replacement and surgical field updates
- The database saves automatically after each operation
- Store graph IDs for reference`)

      if (toolSections.length) {
        contextSections.push(toolSections.join('\n\n'))
      }
    }

    // Add web search suggestion instruction when enabled
    if ((currentProvider === 'openai' || currentProvider === 'claude') && useWebSearch.value) {
      contextSections.push(`**Web Search Integration**:
The user has enabled web search. After providing your answer using available tools, you SHOULD suggest 2-4 specific search queries that would help find additional information from the web.

Format your suggestions at the END of your response like this:
---WEBSEARCH_SUGGESTIONS---
query1: Your first suggested search query
query2: Your second suggested search query
query3: Your third suggested search query (optional)
---END_SUGGESTIONS---

Guidelines for suggestions:
- Make queries specific and targeted (not generic)
- Use Norwegian for Norwegian topics, English for international topics
- Focus on finding information that complements what you found with tools
- Include company names, person names, or specific topics from the conversation
- Avoid duplicating what was already searched via tools

Example for a question about "Equinor's climate strategy":
---WEBSEARCH_SUGGESTIONS---
query1: Equinor klimastrategi 2024 nyheter
query2: Equinor renewable energy investments latest
query3: Norwegian oil companies green transition
---END_SUGGESTIONS---`)
    }

    // Add image analysis context when image is attached
    if (hasImage) {
      contextSections.push(`You are a helpful assistant with vision capabilities. When analyzing images:
- Describe what you see in detail
- If there is text visible in the image, transcribe it accurately
- Provide OCR for any text, code, or written content
- Be thorough and helpful in your image analysis
Do not refuse to describe or transcribe text from images - this is a legitimate and helpful task.`)
    }

    if (useGraphContext.value) {
      const graphContext = buildGraphContext()
      if (graphContext) {
        contextSections.push(`You are an AI assistant helping analyze a knowledge graph. Here is the current graph context:

Title: ${graphContext.metadata?.title || 'Untitled'}
Description: ${graphContext.metadata?.description || 'No description'}
Category: ${graphContext.metadata?.category || 'Uncategorized'}
Nodes: ${graphContext.metadata?.nodeCount || 0}
Edges: ${graphContext.metadata?.edgeCount || 0}

Sample Nodes (up to 20):
${graphContext.nodes?.map(node => {
  if (node.type === 'css-node' && node.info) {
    return `- ${node.label} (${node.type}):\n\`\`\`css\n${node.info}\n\`\`\``
  }
  return `- ${node.label} (${node.type}): ${node.info || 'No info'}`
}).join('\n') || 'No nodes'}

Connections (up to 30):
${graphContext.edges?.map(edge => `- ${edge.from} → ${edge.to}`).join('\n') || 'No connections'}

Use this context to provide relevant insights and answers about the knowledge graph.`)
      }
    }

    if (useRawJsonMode.value) {
      const rawJsonContext = buildRawJsonContext()
      if (rawJsonContext) {
        contextSections.push(`**RAW JSON DATABASE EXPORT**

You have access to the complete raw JSON data from the database, including all metadata and internal structure. You can analyze and answer detailed questions about:
- The complete data schema and structure
- Metadata information (creation date, author, version, tags, etc.)
- How nodes and edges are organized
- Data relationships and connections
- Data quality and completeness
- Custom properties and fields
- Any structural or design patterns in the data

Here is the complete raw JSON export:

\`\`\`json
${rawJsonContext.jsonString}
\`\`\`

Feel free to ask detailed analytical questions about this data structure, metadata, relationships, or any aspect of how it's organized.`)
      }
    }

    if (selectionFocus) {
      const typeLabel = selectionFocus.nodeType ? ` (${selectionFocus.nodeType})` : ''
      const nodeIdLine = selectionFocus.nodeId ? `Node ID: ${selectionFocus.nodeId}\n\n` : ''
      contextSections.push(`Highlighted Selection — ${selectionFocus.label}${typeLabel}
    ${nodeIdLine}${selectionFocus.text}

    Prioritize this highlighted passage when answering the user's next question, while still considering the broader graph context.`)

      // === NEW: Add implicit node patching context when Raw JSON Mode + highlighted text are both active ===
      if (useRawJsonMode.value && selectionFocus.nodeId) {
        contextSections.push(`**IMPLICIT NODE PATCHING MODE**

You have detected that:
1. Raw JSON Mode is enabled - you can see the complete node data and structure
2. A specific piece of text is highlighted in node: "${selectionFocus.nodeId}"

This means the user wants to modify just this highlighted portion. When they ask you to "change this to X" or "update this", you should:

1. **Understand the context**: The highlighted text is from node ID "${selectionFocus.nodeId}"
2. **Make the surgical change**: Only modify what the user specified - don't rewrite the entire node
3. **Use graph_update_current to save**: When you've made the change, call graph_update_current with:
   - ONLY the modified node(s) - don't send the entire graph
   - Just the fields that changed: label, info, type, etc.
   - Keep all other node data unchanged

EXAMPLE WORKFLOW:
User highlights: '<meta property="og:site_name" content="Norse Gong ™" />'
User asks: "Change this to Connect Norse Gong ™"

You should:
1. Understand the user wants to replace "Norse Gong" with "Connect Norse Gong" in the meta tag
2. Make ONLY that change in the node's info field
3. Call graph_update_current with the updated node

IMPORTANT: You should use graph_update_current to persist changes, which will automatically be sent to the backend. The backend supports partial node updates through the PATCH endpoint.

Guidelines:
- Be surgical: change only what's highlighted or requested
- Don't reformat or restructure entire fields
- Preserve formatting (HTML, Markdown, JSON structure) unless the user explicitly asks to change it
- Confirm changes before saving
- Always use graph_update_current to persist your changes to the database`)
      }
      // === END NEW ===
    }

    if (contextSections.length) {
      grokMessages = [
        {
          role: 'system',
          content: contextSections.join('\n\n---\n\n'),
        },
        ...grokMessages,
      ]
    }

    let endpoint = 'https://grok.vegvisr.org/chat'
    let model = 'grok-3'
    let maxTokens = 32000

    if (currentProvider === 'openai') {
      endpoint = 'https://openai.vegvisr.org/chat'
      model = openaiModel.value
      maxTokens = model && model.startsWith('gpt-5') ? 32768 : 16384
    } else if (currentProvider === 'claude') {
      endpoint = 'https://anthropic.vegvisr.org/chat'
      model = claudeModel.value
      if (model === 'claude-opus-4-5-20251101') {
        maxTokens = 16384
      } else if (model === 'claude-sonnet-4-5-20250929') {
        maxTokens = 64000
      } else if (model === 'claude-haiku-4-5-20251001') {
        maxTokens = 8192
      } else {
        maxTokens = 8192
      }
    } else if (currentProvider === 'gemini') {
      endpoint = 'https://gemini.vegvisr.org/chat'
      model = undefined // Let the worker pick the default Gemini model
      maxTokens = undefined
    } else if (currentProvider === 'perplexity') {
      endpoint = 'https://perplexity.vegvisr.org/chat'
      model = 'sonar'
      maxTokens = 16384
    }

    // Build request body - Claude needs system message as separate parameter
    let requestBody = {
      userId: userStore.user_id || 'system',
      temperature: 0.7,
      stream: false,
    }

    // Add Perplexity-specific parameters for richer responses
    if (currentProvider === 'perplexity') {
      requestBody.return_images = true
      requestBody.return_related_questions = true
      requestBody.search_recency_filter = 'month'
    }

    if (model) {
      requestBody.model = model
    }

    if (typeof maxTokens === 'number') {
      const useMaxCompletionTokens = currentProvider === 'openai' && model && model.startsWith('gpt-5')
      if (useMaxCompletionTokens) {
        requestBody.max_completion_tokens = maxTokens
      } else {
        requestBody.max_tokens = maxTokens
      }
    }

    // Combine Proff, Sources, Template, and Graph tools
    const allTools = [
      ...(useProffTools.value ? proffTools : []),
      ...(useSourcesTools.value ? sourcesTools : []),
      ...(useTemplateTools.value && canUseTemplateTools.value ? templateTools : []),
      ...graphTools
    ]

    // Add tools for OpenAI/Grok function calling
    if ((currentProvider === 'openai' || currentProvider === 'grok') && allTools.length > 0) {
      requestBody.tools = allTools
      requestBody.tool_choice = 'auto' // Let AI decide when to use tools
    }

    if (currentProvider === 'claude') {
      // Extract system message for Claude (Anthropic API uses top-level system param)
      const systemMsg = grokMessages.find(m => m.role === 'system')
      const nonSystemMessages = grokMessages.filter(m => m.role !== 'system')
      requestBody.messages = nonSystemMessages
      if (systemMsg) {
        requestBody.system = systemMsg.content
      }
      // Add tools for Claude
      if (allTools.length > 0) {
        requestBody.tools = allTools
        requestBody.tool_choice = { type: 'auto' }
      }
    } else if (currentProvider === 'perplexity') {
      // Perplexity requires messages to strictly alternate between user and assistant
      // Extract system message first
      const systemMsg = grokMessages.find(m => m.role === 'system')
      const nonSystemMessages = grokMessages.filter(m => m.role !== 'system')

      // Merge consecutive messages of the same role
      const alternatingMessages = []
      for (const msg of nonSystemMessages) {
        const lastMsg = alternatingMessages[alternatingMessages.length - 1]
        if (lastMsg && lastMsg.role === msg.role) {
          // Merge with previous message of same role
          if (typeof lastMsg.content === 'string' && typeof msg.content === 'string') {
            lastMsg.content = lastMsg.content + '\n\n' + msg.content
          } else {
            // For complex content (arrays with images), keep the last one
            lastMsg.content = msg.content
          }
        } else {
          alternatingMessages.push({ ...msg })
        }
      }

      // Ensure first non-system message is from user
      if (alternatingMessages.length > 0 && alternatingMessages[0].role !== 'user') {
        alternatingMessages.unshift({ role: 'user', content: 'Continue the conversation.' })
      }

      // Build final messages with system message first if present
      if (systemMsg) {
        requestBody.messages = [systemMsg, ...alternatingMessages]
      } else {
        requestBody.messages = alternatingMessages
      }
    } else {
      requestBody.messages = grokMessages
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      let errorDetail = `API error: ${response.status}`
      try {
        const errJson = await response.json()
        // Handle different error formats: OpenAI uses { error: { message } }, others use { error: "string" }
        if (typeof errJson.error === 'object' && errJson.error?.message) {
          errorDetail = errJson.error.message
        } else if (typeof errJson.error === 'string') {
          errorDetail = errJson.error
        } else {
          errorDetail = JSON.stringify(errJson)
        }
      } catch (_) {
        try {
          errorDetail = await response.text()
        } catch (_) {
          /* ignore */
        }
      }
      throw new Error(errorDetail)
    }

    // Parse response - Claude uses different format than OpenAI/Grok
    const data = await response.json()
    let aiMessage
    let usedProffAPI = false
    let usedSourcesAPI = false
    let proffData = null
    let sourcesData = null
    let perplexityCitations = null
    let perplexityImages = null
    let perplexityRelatedQuestions = null

    // Check for tool calls (function calling) - OpenAI format
    if ((currentProvider === 'openai' || currentProvider === 'grok') && data.choices?.[0]?.message?.tool_calls) {
      console.log('Detected tool calls, processing...')
      try {
        const toolResult = await processToolCalls(data, grokMessages, endpoint, requestBody)
        aiMessage = toolResult.message
        usedProffAPI = toolResult.usedProffAPI
        usedSourcesAPI = toolResult.usedSourcesAPI
        proffData = toolResult.proffData
        sourcesData = toolResult.sourcesData
        if (!aiMessage) {
          throw new Error('No response after tool execution')
        }
      } catch (toolError) {
        console.error('Tool call processing error:', toolError)
        // Fall back to any content in the original response
        aiMessage = data.choices?.[0]?.message?.content || `Tool execution failed: ${toolError.message}`
      }
    } else if (currentProvider === 'claude' && data.stop_reason === 'tool_use') {
      // Claude tool use handling - supports multi-step chains
      console.log('Claude tool use detected, starting tool chain...')

      let currentData = data
      let currentMessages = [...requestBody.messages]
      let maxIterations = 5 // Safety limit
      let iterations = 0

      try {
        while (currentData.stop_reason === 'tool_use' && iterations < maxIterations) {
          iterations++

          // Find all tool_use blocks in the response
          const toolUseBlocks = currentData.content?.filter(c => c.type === 'tool_use') || []
          console.log(`Claude iteration ${iterations}: ${toolUseBlocks.length} tool(s) to execute`)

          if (toolUseBlocks.length === 0) break

          // Track which APIs are used
          if (toolUseBlocks.some(t => t.name.startsWith('proff_'))) {
            usedProffAPI = true
          }
          if (toolUseBlocks.some(t => t.name.startsWith('sources_'))) {
            usedSourcesAPI = true
          }

          // Execute all tools and collect results
          const toolResults = []
          for (const toolBlock of toolUseBlocks) {
            console.log(`  Executing: ${toolBlock.name}`, toolBlock.input)

            // Route to appropriate executor
            let result
            if (toolBlock.name.startsWith('graph_template_')) {
              result = await executeTemplateTool(toolBlock.name, toolBlock.input)
            } else if (toolBlock.name.startsWith('graph_save_') || toolBlock.name.startsWith('graph_update_') || toolBlock.name === 'graph_get_current_data' || toolBlock.name === 'graph_node_search_replace') {
              result = await executeGraphManipulationTool(toolBlock.name, toolBlock.input)
            } else if (toolBlock.name.startsWith('sources_')) {
              result = await executeSourcesTool(toolBlock.name, toolBlock.input)
              // Store sources data for Case Study buttons
              if (!sourcesData) sourcesData = {}
              sourcesData[toolBlock.name] = result
              if (result.results) sourcesData.results = result.results
            } else {
              result = await executeProffTool(toolBlock.name, toolBlock.input)
              // Store proff data for Case Study buttons
              if (!proffData) proffData = {}
              proffData[toolBlock.name] = result
              // Extract key data for easy access
              if (result.person) proffData.person = result.person
              if (result.persons) proffData.persons = result.persons
              if (result.company) proffData.company = result.company
              if (result.companies) proffData.companies = result.companies
              if (result.paths) proffData.paths = result.paths
              if (result.degreesOfSeparation !== undefined) proffData.degreesOfSeparation = result.degreesOfSeparation
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result, null, 2)
            })
          }

          // Build next request with tool results
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: currentData.content },
            { role: 'user', content: toolResults }
          ]

          const nextBody = {
            ...requestBody,
            messages: currentMessages
            // Keep tools so Claude can make more calls if needed
          }

          const nextResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextBody)
          })

          if (!nextResponse.ok) {
            throw new Error(`Claude follow-up error: ${nextResponse.status}`)
          }

          currentData = await nextResponse.json()
          console.log(`  Response stop_reason: ${currentData.stop_reason}`)
        }

        // Extract final text response
        aiMessage = currentData.content?.find(c => c.type === 'text')?.text

        if (!aiMessage && iterations >= maxIterations) {
          aiMessage = 'Tool chain reached maximum iterations. Please try a simpler question.'
        }

      } catch (toolError) {
        console.error('Claude tool chain error:', toolError)
        usedProffAPI = false
        usedSourcesAPI = false
        proffData = null
        sourcesData = null
        aiMessage = buildRetryMessage(userPrompt, toolError.message || 'Midleridig feil')
      }
    } else if (currentProvider === 'claude') {
      // Anthropic format: data.content[0].text
      aiMessage = data.content?.[0]?.text
    } else if (currentProvider === 'perplexity') {
      // Perplexity format: data.choices[0].message.content + extra fields
      aiMessage = data.choices?.[0]?.message?.content
      perplexityCitations = data.citations || []
      perplexityImages = data.images || []
      perplexityRelatedQuestions = data.related_questions || []
    } else {
      // OpenAI/Grok format: data.choices[0].message.content
      aiMessage = data.choices?.[0]?.message?.content
    }

    if (!aiMessage) {
      throw new Error('No response from AI')
    }

    // For Perplexity, process citations and enhance the message
    let enhancedMessage = aiMessage

    if (currentProvider === 'perplexity') {
      // Convert inline citation references [1], [2], etc. to clickable links
      if (perplexityCitations && perplexityCitations.length > 0) {
        // Replace [1], [2], [1][2], etc. with clickable superscript links
        enhancedMessage = enhancedMessage.replace(/\[(\d+)\]/g, (match, num) => {
          const index = parseInt(num) - 1
          if (index >= 0 && index < perplexityCitations.length) {
            const url = perplexityCitations[index]
            // Extract domain for display
            let domain = ''
            try {
              domain = new URL(url).hostname.replace('www.', '')
            } catch {
              domain = url.substring(0, 30)
            }
            return `<sup class="perplexity-citation" data-url="${url}" data-domain="${domain}" data-index="${num}">${num}</sup>`
          }
          return match
        })
      }

      // Add images as clickable thumbnails if available (often YouTube thumbnails)
      if (perplexityImages && perplexityImages.length > 0) {
        enhancedMessage += '\n\n**📺 Related Media:**\n\n'
        perplexityImages.forEach((img, index) => {
          // Handle both string URLs and object format from Perplexity API
          // API returns: { image_url, origin_url, title, width, height }
          const imgUrl = typeof img === 'string' ? img : (img.image_url || img.url)
          const originUrl = typeof img === 'object' ? (img.origin_url || imgUrl) : imgUrl
          const imgTitle = typeof img === 'object' ? (img.title || `Media ${index + 1}`) : `Media ${index + 1}`

          if (imgUrl) {
            // Use origin_url for the link (e.g., YouTube watch URL)
            enhancedMessage += `[![${imgTitle}](${imgUrl})](${originUrl} "${imgTitle}")\n\n`
          }
        })
      }

      // Add citations list at the bottom
      if (perplexityCitations && perplexityCitations.length > 0) {
        enhancedMessage += '\n---\n\n**📚 Sources:**\n'
        perplexityCitations.forEach((citation, index) => {
          // Extract title from URL or use domain
          let displayText = ''
          try {
            const urlObj = new URL(citation)
            displayText = urlObj.hostname.replace('www.', '')
            // Try to get a readable path
            if (urlObj.pathname && urlObj.pathname !== '/') {
              const pathParts = urlObj.pathname.split('/').filter(p => p)
              if (pathParts.length > 0) {
                displayText += ' - ' + decodeURIComponent(pathParts[pathParts.length - 1]).replace(/-/g, ' ').substring(0, 50)
              }
            }
          } catch {
            displayText = citation.substring(0, 60)
          }
          enhancedMessage += `${index + 1}. [${displayText}](${citation})\n`
        })
      }

      // Add related questions section if available (as clickable links)
      if (perplexityRelatedQuestions && perplexityRelatedQuestions.length > 0) {
        enhancedMessage += '\n**🔍 Related Questions:**\n'
        perplexityRelatedQuestions.forEach((question) => {
          // Encode the question for use in a data attribute
          const encodedQuestion = encodeURIComponent(question)
          enhancedMessage += `- <a href="#" class="perplexity-related-question" data-question="${encodedQuestion}">${question}</a>\n`
        })
      }
    }

    // Parse and extract web search suggestions if present
    if (useWebSearch.value) {
      const suggestionMatch = enhancedMessage.match(/---WEBSEARCH_SUGGESTIONS---\s*([\s\S]*?)\s*---END_SUGGESTIONS---/)
      if (suggestionMatch) {
        const suggestionBlock = suggestionMatch[1]
        const queries = []
        // Parse query lines like "query1: Search term here"
        const queryLines = suggestionBlock.split('\n').filter(line => line.trim())
        for (const line of queryLines) {
          const queryMatch = line.match(/query\d+:\s*(.+)/)
          if (queryMatch && queryMatch[1].trim()) {
            queries.push(queryMatch[1].trim())
          }
        }
        suggestedWebSearches.value = queries
        // Remove the suggestion block from the displayed message
        enhancedMessage = enhancedMessage.replace(/---WEBSEARCH_SUGGESTIONS---[\s\S]*?---END_SUGGESTIONS---/, '').trim()
      } else {
        // Clear suggestions if none found
        suggestedWebSearches.value = []
      }
    }

    // Simulate streaming effect by displaying word by word
    const words = enhancedMessage.split(' ')
    for (let i = 0; i < words.length; i++) {
      streamingContent.value += words[i] + (i < words.length - 1 ? ' ' : '')
      scrollToBottom()
      await new Promise(resolve => setTimeout(resolve, 30))
    }

    // Add assistant message
    appendChatMessage({
      role: 'assistant',
      content: enhancedMessage,
      timestamp: Date.now(),
      provider: currentProvider,
      usedProffAPI: usedProffAPI,
      usedSourcesAPI: usedSourcesAPI,
      proffData: proffData,
      sourcesData: sourcesData,
    })

    // Clear uploaded image after successful send
    uploadedImage.value = null
  } catch (error) {
    console.error('Chat error:', error)
    errorMessage.value = `Error: ${error.message}`
  } finally {
    isStreaming.value = false
    streamingContent.value = ''
    scrollToBottom()
  }
}

// Watch for graph changes
watch(
  () => props.graphData,
  () => {
    // Optionally notify user if graph context is enabled
  },
  { deep: true }
)
</script>

<style scoped>
.grok-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  background: white;
  border-left: 1px solid #e0e0e0;
  transition: width 0.3s ease;
  width: 100%;
  min-width: 320px;
  max-width: 100%;
  overflow: hidden;
}

.grok-chat-panel.collapsed {
  width: 72px;
  min-width: 72px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-title .icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
}

.header-title h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.provider-select {
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
  color: white;
  padding: 0 0.5rem;
  font-weight: 600;
}

.model-select {
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
  color: white;
  padding: 0 0.5rem;
  font-weight: 600;
}

.provider-select option {
  color: #2c3e50;
}

.model-select option {
  color: #2c3e50;
}

.btn-ghost {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.2);
}

.collapsed .chat-header h3,
.collapsed .header-title .icon-img {
  display: none;
}

.chat-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  position: relative;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.context-controls {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: rgba(248, 249, 250, 0.95);
  position: relative;
  z-index: 1;
}

.context-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.context-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.context-toggle.disabled input {
  cursor: not-allowed;
}

.context-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  display: block;
}

.context-toggle input[type='checkbox'] {
  cursor: pointer;
}

.context-indicator {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: #666;
}

.context-indicator.muted {
  color: #999;
  font-style: italic;
}

.context-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.api-lookup-toggle {
  align-items: center;
  gap: 10px;
}

.api-lookup-panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #f8fafc;
  margin-bottom: 8px;
  width: 100%;
}

.api-lookup-input {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.api-lookup-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.api-lookup-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
}

.api-lookup-item:hover {
  border-color: #cbd5f5;
  background: #f1f5ff;
}

.api-lookup-icon {
  font-size: 18px;
}

.api-lookup-name {
  font-weight: 600;
  color: #0f172a;
}

.api-lookup-signature {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.api-lookup-empty {
  font-size: 12px;
  color: #64748b;
}

.selection-context {
  margin-top: 0.35rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: rgba(102, 126, 234, 0.08);
  border: 1px solid transparent;
}

.selection-context.active {
  border-color: rgba(102, 126, 234, 0.4);
  box-shadow: inset 0 0 0 1px rgba(102, 126, 234, 0.12);
}

.context-indicator.selection {
  color: #5b4bff;
  font-weight: 500;
}

.selection-hint {
  margin-top: 0.35rem;
  font-size: 0.82rem;
  color: #7a7a8c;
}

.suggested-questions {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
  border-radius: 8px;
  border: 1px solid #d0daf0;
}

.suggested-questions-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.suggested-question-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: #1a56db;
  background: #fff;
  border: 1px solid #c3d4f7;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.suggested-question-chip:hover {
  background: #1a56db;
  color: #fff;
  border-color: #1a56db;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(26, 86, 219, 0.25);
}

.suggested-question-chip:active {
  transform: translateY(0);
}

/* Web Search Suggestions (Perplexity integration) */
.suggested-web-searches {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border-radius: 8px;
  border: 1px solid #fed7aa;
}

.web-search-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #c2410c;
  margin-bottom: 0.4rem;
}

.web-search-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.web-search-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.65rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: #c2410c;
  background: #fff;
  border: 1px solid #fdba74;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  max-width: 100%;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.web-search-chip:hover:not(:disabled) {
  background: #ea580c;
  color: #fff;
  border-color: #ea580c;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25);
}

.web-search-chip:active:not(:disabled) {
  transform: translateY(0);
}

.web-search-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.web-search-chip::before {
  content: '🔍';
  font-size: 0.7rem;
}

.history-status {
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: #4a4a4a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-status.loading {
  color: #0c63e7;
}

.history-status.error {
  color: #b3261e;
}

.session-picker {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-dropdown {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
  background: white;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.08);
  max-height: 260px;
  overflow: auto;
}

.session-dropdown__actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.session-dropdown__state {
  font-size: 0.82rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-dropdown__state.error {
  color: #b3261e;
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.session-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0.25rem;
  border-bottom: 1px dashed rgba(15, 23, 42, 0.08);
}

.session-list li:last-child {
  border-bottom: none;
}

.session-list li.active {
  background: rgba(102, 126, 234, 0.08);
  border-radius: 6px;
}

.session-list__info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.session-list__info strong {
  font-size: 0.88rem;
  color: #111827;
}

.session-list__info small {
  font-size: 0.75rem;
  color: #6b7280;
}

.session-list__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.session-rename-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.session-rename-input {
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.session-rename-actions {
  display: flex;
  gap: 0.35rem;
}

.session-rename-error {
  font-size: 0.78rem;
  color: #b3261e;
}

.messages-container {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  padding-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
  min-height: 0;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  max-width: 90%;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-start;
}

.insert-btn {
  padding: 0;
  font-weight: 600;
}

.case-study-btn {
  padding: 2px 8px;
  font-size: 0.75rem;
  background: #e8f5e9;
  border: 1px solid #81c784;
  border-radius: 12px;
  color: #2e7d32;
  text-decoration: none;
}

.case-study-btn:hover {
  background: #c8e6c9;
  color: #1b5e20;
}

.message.user {
  align-self: flex-end;
  background: rgba(227, 242, 253, 0.95);
  border: 1px solid #90caf9;
  color: #1f2933;
}

.message.assistant {
  align-self: flex-start;
  background: rgba(245, 245, 245, 0.95);
  border: 1px solid #e0e0e0;
  color: #1f2933;
}

.message.error {
  align-self: center;
  background: rgba(255, 235, 238, 0.95);
  border: 1px solid #ef5350;
  color: #1f2933;
}

.message.streaming {
  background: rgba(255, 249, 230, 0.95);
  border: 1px solid #ffd54f;
  color: #1f2933;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}

.message-icon {
  font-size: 1.2rem;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: #e5e7eb;
  border: 2px solid #d1d5db;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.message-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.message-avatar-initial {
  font-weight: 700;
  color: #4a5568;
  font-size: 1.1rem;
}

.message-icon-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  display: block;
}

.assistant-avatar {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #eef2ff;
  border: 1px solid #d7dcff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.assistant-avatar-initial {
  font-size: 0.75rem;
  font-weight: 700;
  color: #4c51bf;
}

.message-role {
  font-weight: 600;
}

.proff-badge {
  display: inline-flex;
  align-items: center;
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 6px;
  margin-left: 10px;
  cursor: help;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.proff-badge:hover {
  transform: scale(1.08);
  box-shadow: 0 3px 10px rgba(26, 54, 93, 0.25);
}

.proff-badge-icon {
  width: 50px;
  height: auto;
  border-radius: 4px;
}

.message-time {
  margin-left: auto;
  font-size: 0.75rem;
  color: #999;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ff9800;
  font-weight: 600;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ff9800;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
  color: #1f2933;
}

.message-content :deep(pre) {
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
}

.message-content :deep(code) {
  background: #f5f5f5;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-content :deep(pre code) {
  background: transparent;
  padding: 0;
}

/* Perplexity citation styles */
.message-content :deep(sup) {
  font-size: 0.7em;
  color: #667eea;
  font-weight: 600;
  cursor: pointer;
}

.message-content :deep(sup:hover) {
  color: #4c51bf;
  text-decoration: underline;
}

.message-content :deep(.perplexity-citation) {
  background: rgba(102, 126, 234, 0.12);
  border-radius: 999px;
  padding: 0 6px;
  margin: 0 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.citation-preview {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.18);
  padding: 12px;
  z-index: 1200;
}

.citation-preview-loading,
.citation-preview-error {
  font-size: 0.85rem;
  color: #6b7280;
}

.citation-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.citation-preview-domain {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.citation-preview-body {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
}

.citation-preview-image {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  background: #f3f4f6;
}

.citation-preview-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.citation-preview-description {
  font-size: 0.8rem;
  color: #6b7280;
  line-height: 1.3;
}

.citation-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
}

.citation-modal {
  width: min(1100px, 92vw);
  height: min(80vh, 860px);
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
  display: flex;
  flex-direction: column;
}

.citation-modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.citation-modal-title {
  font-weight: 600;
  color: #111827;
}

.citation-modal-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.citation-modal-body {
  flex: 1;
  background: #fff;
}

.citation-modal-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* Perplexity image/video thumbnails */
.message-content :deep(img) {
  max-width: 200px;
  max-height: 120px;
  border-radius: 8px;
  margin: 0.5rem 0.5rem 0.5rem 0;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: inline-block;
  vertical-align: top;
}

.message-content :deep(img:hover) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.message-image {
  margin-top: 0.5rem;
}

.message-image-preview {
  max-width: 100%;
  max-height: 360px;
  border-radius: 12px;
  display: block;
}

/* Perplexity sources list */
.message-content :deep(hr) {
  margin: 1rem 0;
  border: none;
  border-top: 1px solid #e0e0e0;
}

.message-content :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.message-content :deep(a:hover) {
  text-decoration: underline;
}

/* Perplexity related questions - clickable */
.message-content :deep(.perplexity-related-question) {
  color: #667eea;
  text-decoration: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(102, 126, 234, 0.08);
  transition: all 0.2s ease;
  display: inline-block;
  margin: 2px 0;
}

.message-content :deep(.perplexity-related-question:hover) {
  background: rgba(102, 126, 234, 0.15);
  text-decoration: none;
  transform: translateX(4px);
}

.message-content :deep(.perplexity-related-question::before) {
  content: '→ ';
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-content :deep(.perplexity-related-question:hover::before) {
  opacity: 1;
}

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.message-actions .btn-link {
  padding: 0;
  font-weight: 600;
  color: #4c51bf;
}

.message-actions .graph-btn {
  color: #0f766e;
}

.message-actions .btn-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-input-container {
  padding: 0.75rem 1rem 1.25rem 1rem;
  border-top: 1px solid #e0e0e0;
  background: rgba(255, 255, 255, 0.95);
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  min-height: 200px;
  transition: border-color 0.2s, background-color 0.2s;
}

.chat-input-container.drag-over {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.drop-zone-overlay {
  position: absolute;
  inset: 0;
  background: rgba(102, 126, 234, 0.95);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
}

.drop-zone-content {
  text-align: center;
  color: white;
}

.drop-zone-content svg {
  margin-bottom: 0.75rem;
  opacity: 0.9;
}

.drop-zone-content p {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.drop-zone-content small {
  opacity: 0.8;
  font-size: 0.875rem;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.input-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.chat-input {
  flex: 1;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 60px;
  max-height: 150px;
  font-family: inherit;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.mic-btn,
.image-btn,
.audio-btn {
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  background: #f8f9fa;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mic-btn:hover:not(:disabled),
.image-btn:hover:not(:disabled),
.audio-btn:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #667eea;
  color: #667eea;
}

.mic-btn:disabled,
.image-btn:disabled,
.audio-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mic-btn.recording {
  background: #fee2e2;
  border-color: #ef4444;
  color: #ef4444;
}

.recording-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 12px;
  border: 2px solid #ef4444;
  animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.2);
  }
}

.send-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.input-hint {
  margin-top: 0.75rem;
  margin-bottom: 0;
  padding: 0 0.5rem;
  font-size: 0.8rem;
  color: #6c757d;
  text-align: center;
  line-height: 1.5;
}

.input-hint kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-family: monospace;
  font-size: 0.85em;
  font-weight: 700;
  color: #000;
}

.image-preview-container {
  position: relative;
  margin-bottom: 0.75rem;
  display: inline-block;
}

.uploaded-image-preview {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  border: 2px solid #667eea;
  object-fit: cover;
}

.clear-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef5350;
  color: white;
  border: 2px solid white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
  padding: 0;
  transition: all 0.2s;
}

.clear-image-btn:hover {
  background: #d32f2f;
  transform: scale(1.1);
}

.audio-preview-container {
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #f9fafb;
}

.audio-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.audio-file-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.audio-meta {
  display: flex;
  gap: 0.5rem;
  color: #666;
  font-size: 0.85rem;
  margin-top: 0.15rem;
}

.audio-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.75rem;
}

.auto-detect-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}

.audio-language-select {
  flex: 0 0 150px;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
}

.audio-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.audio-status {
  font-size: 0.9rem;
  color: #555;
}

.clear-audio-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ef5350;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.clear-audio-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-audio-btn:not(:disabled):hover {
  background: #d32f2f;
}

.input-hint kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0.1rem 0.4rem;
  font-family: monospace;
  font-size: 0.85em;
}

.graph-job-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.graph-job-card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 0.85rem;
  background: #f8f9ff;
  box-shadow: 0 4px 12px rgba(18, 24, 40, 0.05);
}

.graph-job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.graph-job-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #1f2933;
}

.graph-job-chip {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.graph-job-chip.processing,
.graph-job-chip.queued {
  background: #fff6e6;
  border-color: #ffd28c;
  color: #b67200;
}

.graph-job-chip.completed {
  background: #ecfdf3;
  border-color: #a7f3d0;
  color: #047857;
}

.graph-job-chip.failed {
  background: #fee2e2;
  border-color: #fecaca;
  color: #b91c1c;
}

.graph-job-meta {
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  gap: 0.35rem;
}

.graph-job-remove {
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.graph-job-remove:hover {
  color: #6b7280;
}

.graph-job-preview {
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: #374151;
}

.graph-job-progress {
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  margin-bottom: 0.35rem;
}

.graph-job-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.3s ease;
}

.graph-job-status-text {
  font-size: 0.85rem;
  color: #4b5563;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.graph-job-error {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: #b91c1c;
}

.graph-job-actions {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.graph-job-actions .btn-link {
  padding-left: 0;
  padding-right: 0;
}

.graph-job-hint {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: #b45309;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .grok-chat-panel {
    width: 100%;
    max-width: 100%;
    border-left: none;
    border-top: 1px solid #e0e0e0;
  }

  .grok-chat-panel.collapsed {
    width: 100%;
    height: 50px;
  }

  .collapsed .chat-content {
    display: none;
  }

  .message {
    max-width: 95%;
  }
}

/* Advanced Graph Creation Modal */
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
  z-index: 9999;
}

.advanced-graph-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.advanced-graph-modal .modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.advanced-graph-modal .modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #f8f9fa;
}

.advanced-graph-modal .modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.advanced-graph-modal .modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.help-text {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.help-text p {
  margin: 0.5rem 0;
}

.text-muted {
  color: #6c757d;
  font-size: 0.9rem;
}

.category-group {
  margin-bottom: 1.5rem;
}

.category-header {
  font-size: 0.9rem;
  font-weight: 600;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e9ecef;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-item {
  display: flex;
  align-items: start;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #0d6efd;
  background: #f8f9fa;
}

.template-item.selected {
  border-color: #0d6efd;
  background: #e7f1ff;
}

.template-item input[type="checkbox"] {
  margin-top: 0.25rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.template-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.template-name {
  font-weight: 600;
  color: #212529;
}

.template-type {
  font-size: 0.85rem;
  color: #6c757d;
}

.template-type code {
  background: #e9ecef;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.8rem;
}

.template-description {
  font-size: 0.85rem;
  color: #6c757d;
  line-height: 1.4;
}

.selection-summary {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #e7f1ff;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
}

.advanced-graph-btn {
  color: #6f42c1 !important;
  font-weight: 500;
}

.advanced-graph-btn:hover {
  color: #5a32a3 !important;
  text-decoration: underline;
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #0d6efd;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 2rem;
}

.error-message {
  color: #dc3545;
  margin-bottom: 1rem;
}

/* Batch Generation Modal */
.batch-generate-modal {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 95%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.html-import-modal {
  background: white;
  border-radius: 12px;
  width: 95%;
  max-width: 900px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.html-import-textarea {
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  min-height: 260px;
  resize: vertical;
}

.html-import-option {
  padding: 0.5rem 0.25rem;
}

.error-state.compact {
  text-align: left;
  padding: 0.5rem 0;
}

.success-message.compact {
  margin: 0.5rem 0 0;
  color: #0f5132;
}

.batch-step {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.batch-step:last-child {
  border-bottom: none;
}

.batch-step h4 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1rem;
}

.batch-step .help-text {
  color: #6b7280;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.template-preview {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.85rem;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
}

.parsed-info {
  margin-top: 0.75rem;
  color: #059669;
  font-size: 0.875rem;
}

.parsed-items-preview {
  margin: 0.5rem 0 0 1.25rem;
  padding: 0;
  font-size: 0.8rem;
  color: #4b5563;
}

.parsed-items-preview li {
  margin-bottom: 0.25rem;
}

.no-table-warning {
  margin-top: 0.75rem;
  color: #d97706;
  font-size: 0.875rem;
}

.batch-progress-panel {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f3f4f6;
  border-radius: 8px;
}

.batch-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.batch-progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.batch-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  transition: width 0.3s ease;
}

.batch-progress-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
  text-align: center;
}

.batch-errors {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fef2f2;
  border-radius: 6px;
  color: #b91c1c;
  font-size: 0.85rem;
}

.batch-errors ul {
  margin: 0.5rem 0 0 1rem;
  padding: 0;
}

.batch-btn {
  color: #6366f1;
}

.batch-btn:hover {
  color: #4f46e5;
}

.batch-progress-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.batch-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: batch-spin 0.8s linear infinite;
}

@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}

.batch-created-feed {
  margin-top: 0.75rem;
  max-height: 150px;
  overflow-y: auto;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
}

.batch-created-item {
  padding: 0.35rem 0.5rem;
  background: #ecfdf5;
  border-radius: 4px;
  margin-bottom: 0.35rem;
  font-size: 0.85rem;
  color: #065f46;
  animation: batch-fade-in 0.3s ease-out;
}

@keyframes batch-fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.batch-created-more {
  font-size: 0.8rem;
  color: #6b7280;
  text-align: center;
  padding: 0.25rem;
}

/* Batch Preview Phase */
.batch-preview-phase {
  animation: batch-fade-in 0.3s ease-out;
}

.batch-preview-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.batch-preview-counter {
  background: #6366f1;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
}

.batch-preview-item {
  font-size: 1.1rem;
  font-weight: 500;
  color: #374151;
}

.batch-preview-label {
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 0.9rem;
}

.batch-preview-content {
  max-height: 250px;
  overflow-y: auto;
  padding: 1rem;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.batch-edit-field {
  margin-bottom: 1rem;
}

.batch-edit-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.9rem;
}

.batch-edit-field .edit-hint {
  font-weight: normal;
  color: #6b7280;
  font-size: 0.8rem;
}

.batch-content-editor {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
}

.batch-preview-rendered {
  margin-top: 1rem;
}

.batch-preview-rendered label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.9rem;
}

.batch-generating {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #6366f1;
  font-weight: 500;
}

.batch-created-summary {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #ecfdf5;
  border-radius: 6px;
  color: #065f46;
  text-align: center;
}

.btn-outline-danger {
  color: #dc2626;
  border: 1px solid #dc2626;
  background: transparent;
}

.btn-outline-danger:hover {
  background: #dc2626;
  color: white;
}

/* Raw JSON Viewer Styles */
.raw-json-viewer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.raw-json-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.raw-json-content {
  background: #1e1e1e;
  color: #d4d4d4;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
  white-space: pre;
  word-wrap: break-word;
  margin: 0;
}

.raw-json-content code {
  color: inherit;
  font-family: inherit;
  background: none;
}

/* === NEW: Graph Update Approval Modal Styles === */
.approval-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.approval-modal {
  background: #1a1a2e;
  border: 1px solid #6366f1;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.approval-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
}

.approval-modal-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.3rem;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.8rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.approval-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approval-intro {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.95rem;
  margin: 0;
}

.approval-node-info {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  padding: 12px;
}

.approval-label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.approval-value {
  color: #fff;
  font-weight: 500;
  word-break: break-word;
}

.approval-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  margin-top: 4px;
}

.approval-changes {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
}

.approval-change-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approval-change-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 10px;
}

.approval-change-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.change-field {
  color: rgba(125, 211, 252, 0.95);
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 6px;
}

.change-detail {
  color: rgba(255, 255, 255, 0.8);
}

.change-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.85rem;
}

.change-old,
.change-new {
  background: rgba(0, 0, 0, 0.4);
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid rgba(248, 113, 113, 0.5);
}

.change-old strong,
.change-new strong {
  display: block;
  margin-bottom: 4px;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.change-new {
  border-left-color: rgba(74, 222, 128, 0.5);
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.change-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.old-value,
.new-value {
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 0.85rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.old-value {
  border: 1px solid rgba(248, 113, 113, 0.3);
  color: rgba(248, 113, 113, 0.9);
}

.new-value {
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: rgba(74, 222, 128, 0.9);
}

.arrow {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.approval-explanation {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 8px;
  padding: 12px;
}

.approval-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  line-height: 1.4;
}

.approval-modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid rgba(99, 102, 241, 0.3);
  background: rgba(0, 0, 0, 0.2);
}

.approval-modal-footer .btn {
  flex: 1;
  padding: 12px 20px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.95rem;
}

.btn-cancel {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: rgba(248, 113, 113, 0.9);
}

.btn-cancel:hover {
  background: rgba(248, 113, 113, 0.3);
  border-color: rgba(248, 113, 113, 0.6);
}

.btn-approve {
  background: rgba(74, 222, 128, 0.2);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: rgba(74, 222, 128, 0.9);
}

.btn-approve:hover {
  background: rgba(74, 222, 128, 0.3);
  border-color: rgba(74, 222, 128, 0.6);
}

.approval-status {
  padding: 12px 20px;
  margin: 0;
  font-size: 0.9rem;
  text-align: center;
  border-top: 1px solid rgba(99, 102, 241, 0.2);
}

.approval-status.success {
  background: rgba(74, 222, 128, 0.15);
  color: rgba(74, 222, 128, 0.9);
}

.approval-status.error {
  background: rgba(248, 113, 113, 0.15);
  color: rgba(248, 113, 113, 0.9);
}

.approval-status.loading {
  background: rgba(99, 102, 241, 0.15);
  color: rgba(255, 255, 255, 0.7);
}
/* === END NEW === */
</style>
