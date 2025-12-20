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
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' }">
            <input
              type="checkbox"
              v-model="useProffTools"
              :disabled="provider !== 'openai' && provider !== 'claude'"
            />
            <span>🏢 Proff Selskapsoppslag</span>
          </label>
          <span v-if="useProffTools && (provider === 'openai' || provider === 'claude')" class="context-indicator">
            AI kan slå opp norske selskaper
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude'" class="context-indicator muted">
            Kun OpenAI/Claude
          </span>
        </div>
        <div class="context-row">
          <label class="context-toggle" :class="{ disabled: provider !== 'openai' && provider !== 'claude' }">
            <input
              type="checkbox"
              v-model="useSourcesTools"
              :disabled="provider !== 'openai' && provider !== 'claude'"
            />
            <span>📰 Norske Kilder</span>
          </label>
          <span v-if="useSourcesTools && (provider === 'openai' || provider === 'claude')" class="context-indicator">
            Regjeringen, SSB, NRK, Forskning.no, miljøorg.
          </span>
          <span v-else-if="provider !== 'openai' && provider !== 'claude'" class="context-indicator muted">
            Kun OpenAI/Claude
          </span>
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
            <span v-if="message.usedProffAPI" class="proff-badge" title="Data hentet via Proff.no (Brønnøysundregistrene)">
              <img :src="proffIcon" alt="Proff" class="proff-badge-icon" />
            </span>
            <span class="message-time">{{ formatTime(message.timestamp) }}</span>
          </div>
          <div class="message-content" v-html="renderMarkdown(message.content)" @click="handleMessageContentClick($event)"></div>
          <div v-if="message.role === 'assistant'" class="message-actions">
            <button
              class="btn btn-link btn-sm insert-btn"
              type="button"
              @click="insertAsFullText(message.content)"
            >
              {{ insertLabel }}
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
          <div class="message-content" v-html="renderMarkdown(streamingContent)"></div>
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

const emit = defineEmits(['insert-fulltext', 'insert-node', 'insert-network'])

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

// State
const isCollapsed = ref(false)
const useGraphContext = ref(true)
const useSelectionContext = ref(false)
const provider = ref('grok')
const providerOptions = [
  { value: 'grok', label: 'Grok' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'perplexity', label: 'Perplexity' },
]
const messages = ref([])
const userInput = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingProviderOverride = ref(null)
const errorMessage = ref('')
const messagesContainer = ref(null)

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

// Proff API Function Calling Configuration
const PROFF_API_BASE = 'https://proff-worker.torarnehave.workers.dev'
const useProffTools = ref(true) // Enable Proff company lookup by default

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
const useSourcesTools = ref(true) // Enable Norwegian sources by default

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
  }
]

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

    throw new Error(`Unknown sources tool: ${toolName}`)
  } catch (error) {
    console.error('Sources tool execution error:', error)
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
  const toolCalls = data.choices?.[0]?.message?.tool_calls || []
  if (!toolCalls.length) return { message: null, usedProffAPI: false, usedSourcesAPI: false, proffData: null, sourcesData: null }

  console.log('Processing tool calls:', toolCalls.map(t => t.function.name))

  // Track which APIs were used
  const usedProffAPI = toolCalls.some(t => t.function.name.startsWith('proff_'))
  const usedSourcesAPI = toolCalls.some(t => t.function.name.startsWith('sources_'))

  // Collect raw data from tool results
  let proffData = null
  let sourcesData = null

  // Execute all tool calls
  const toolResults = []
  for (const toolCall of toolCalls) {
    const { name, arguments: argsStr } = toolCall.function
    const args = JSON.parse(argsStr)

    console.log(`Executing tool: ${name}`, args)

    // Route to appropriate executor
    let result
    if (name.startsWith('sources_')) {
      result = await executeSourcesTool(name, args)
      // Store sources data for later use
      if (!sourcesData) sourcesData = {}
      sourcesData[name] = result
      if (result.results) sourcesData.results = result.results
    } else {
      result = await executeProffTool(name, args)
      // Store proff data for later use
      if (!proffData) proffData = {}
      proffData[name] = result
      // Extract key data for easy access
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

  // Build new messages with assistant's tool call and tool results
  const newMessages = [
    ...grokMessages,
    data.choices[0].message, // Assistant message with tool_calls
    ...toolResults
  ]

  // Make follow-up request without tools (to get final response)
  const followUpBody = {
    ...requestBody,
    messages: newMessages,
    tools: undefined, // Remove tools for final response
    tool_choice: undefined
  }
  delete followUpBody.tools
  delete followUpBody.tool_choice

  const followUpResponse = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(followUpBody)
  })

  if (!followUpResponse.ok) {
    throw new Error(`Follow-up API error: ${followUpResponse.status}`)
  }

  const followUpData = await followUpResponse.json()
  return {
    message: followUpData.choices?.[0]?.message?.content,
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
const MAX_GRAPH_JOBS = 4

const graphProcessingJobs = ref([])

const CHAT_HISTORY_BASE_URL = 'https://api.vegvisr.org/chat-history'
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

// Prefer a user-provided profile image; fall back to an initial
const userAvatarUrl = computed(() => userStore.profileimage || null)
const userInitial = computed(() => {
  const source = userStore.email || userStore.user_id || 'You'
  return source.charAt(0).toUpperCase()
})

const canCreateGraph = computed(() => Boolean(userStore.emailVerificationToken))

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

const insertAsFullText = (content) => {
  if (!content) return
  emit('insert-fulltext', content)
}

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
    console.log('hasPersonData: No proffData on message', message?.usedProffAPI)
    return false
  }
  console.log('hasPersonData: proffData keys:', Object.keys(message.proffData))
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
  console.log('hasCompanyData: proffData keys:', Object.keys(message.proffData))
  return message.proffData.company ||
         message.proffData.companies ||
         message.proffData.proff_search_companies ||
         message.proffData.proff_get_company_details ||
         (message.content && message.content.includes('organisationNumber'))
}

// Check if message contains network/connection data
const hasNetworkData = (message) => {
  if (!message?.proffData) return false
  console.log('hasNetworkData: proffData keys:', Object.keys(message.proffData))
  return message.proffData.paths ||
         message.proffData.network ||
         message.proffData.proff_find_business_network ||
         message.proffData.degreesOfSeparation !== undefined
}

// Check if message contains news/sources data
const hasNewsData = (message) => {
  console.log('hasNewsData: sourcesData:', message?.sourcesData)
  return message?.sourcesData?.results?.length > 0 ||
         message?.sourcesData?.sources_search?.results?.length > 0 ||
         (message?.usedSourcesAPI && message.content?.includes('artikler'))
}

// Handle clicks on message content (for related questions)
const handleMessageContentClick = (event) => {
  const target = event.target

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
  const normalized = (data.messages || []).map((message) => {
    const timestamp = message.createdAt ? Date.parse(message.createdAt) : Date.now()
    return {
      id: message.id,
      role: message.role,
      content: message.content || '',
      timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
      provider: message.role === 'assistant' ? (message.provider || 'grok') : (message.provider || provider.value),
      selectionMeta: message.selectionMeta || null,
    }
  })

  if (sessionStorageKey.value !== keySnapshot) {
    return false
  }

  messages.value = normalized.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  scrollToBottom()
  historyLastLoaded.value = new Date().toISOString()
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

    if (message.ciphertext && message.iv && message.salt) {
      payload.ciphertext = message.ciphertext
      payload.iv = message.iv
      payload.salt = message.salt
    } else if (typeof message.content === 'string' && message.content.length) {
      payload.content = message.content
    } else {
      return
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
      return {
        id: node.id,
        label: node.label || node.id,
        type: node.type || 'unknown',
        info: infoString ? infoString.substring(0, 500) : '',
      }
    }) || [],
    edges: edges?.slice(0, 30).map((edge) => ({
      from: edge.from,
      to: edge.to,
    })) || [],
  }

  return context
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
    const response = await fetch('https://openai.vegvisr.org/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userStore.user_id || 'system',
        model: 'gpt-image-1',
        prompt: imagePrompt,
        size: '1024x1024',
        quality: 'standard',
        n: 1,
        response_format: 'url'
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
    const imageUrl = data.data?.[0]?.url
    const imageB64 = data.data?.[0]?.b64_json
    const revisedPrompt = data.data?.[0]?.revised_prompt

    // Handle both URL and base64 responses
    const finalImageUrl = imageUrl || (imageB64 ? `data:image/png;base64,${imageB64}` : null)

    if (!finalImageUrl) {
      throw new Error('No image in response (neither URL nor base64)')
    }

    // Create markdown with image and revised prompt if available
    let responseContent = `![Generated Image](${finalImageUrl})\n\n`
    if (revisedPrompt && revisedPrompt !== imagePrompt) {
      responseContent += `**Revised prompt:** ${revisedPrompt}\n\n`
    }
    responseContent += `**Original prompt:** ${imagePrompt}`

    // Add assistant message with the image
    appendChatMessage({
      role: 'assistant',
      content: responseContent,
      timestamp: Date.now(),
      provider: provider.value,
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

  const currentProvider = provider.value
  const hasImage = uploadedImage.value && currentProvider !== 'grok'
  const selectionFocus = buildSelectionContext()

  // Check for natural language image generation commands
  const imageGenPattern = /^(create|generate|make|draw|paint|design|produce)\s+(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of\s+)?(.+)$/i
  const imageGenMatch = message.match(imageGenPattern)

  if (imageGenMatch && currentProvider === 'openai') {
    // Extract the prompt (last capture group)
    const imagePrompt = imageGenMatch[5].trim()
    return await handleImageGeneration(imagePrompt, message)
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

    // Add tool usage instructions for OpenAI when tools are enabled
    if (currentProvider === 'openai' && (useProffTools.value || useSourcesTools.value)) {
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
- sources_search - Search across Norwegian news, government, research sources
- sources_get_hearings - Get public hearings (høringer)
- sources_environment_news - Environment/climate news
- sources_list_feeds - List all available sources

Use these for questions about Norwegian politics, environment, research, statistics.
`
      }
      contextSections.push(toolInstructions.trim())
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
${graphContext.nodes?.map(node => `- ${node.label} (${node.type}): ${node.info || 'No info'}`).join('\n') || 'No nodes'}

Connections (up to 30):
${graphContext.edges?.map(edge => `- ${edge.from} → ${edge.to}`).join('\n') || 'No connections'}

Use this context to provide relevant insights and answers about the knowledge graph.`)
      }
    }

    if (selectionFocus) {
      const typeLabel = selectionFocus.nodeType ? ` (${selectionFocus.nodeType})` : ''
      const nodeIdLine = selectionFocus.nodeId ? `Node ID: ${selectionFocus.nodeId}\n\n` : ''
      contextSections.push(`Highlighted Selection — ${selectionFocus.label}${typeLabel}
    ${nodeIdLine}${selectionFocus.text}

    Prioritize this highlighted passage when answering the user's next question, while still considering the broader graph context.`)
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
      model = 'gpt-4o'
      maxTokens = 16384 // OpenAI gpt-4o limit
    } else if (currentProvider === 'claude') {
      endpoint = 'https://anthropic.vegvisr.org/chat'
      model = 'claude-sonnet-4-20250514'
      maxTokens = 8192 // Claude default
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
      requestBody.max_tokens = maxTokens
    }

    // Combine Proff and Sources tools
    const allTools = [
      ...(useProffTools.value ? proffTools : []),
      ...(useSourcesTools.value ? sourcesTools : [])
    ]

    // Add tools for OpenAI function calling
    if (currentProvider === 'openai' && allTools.length > 0) {
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
    if (currentProvider === 'openai' && data.choices?.[0]?.message?.tool_calls) {
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
            if (toolBlock.name.startsWith('sources_')) {
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
        aiMessage = data.content?.find(c => c.type === 'text')?.text || `Tool error: ${toolError.message}`
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
            return `[<sup>${num}</sup>](${url} "${domain}")`
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

.provider-select option {
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
}

.message.assistant {
  align-self: flex-start;
  background: rgba(245, 245, 245, 0.95);
  border: 1px solid #e0e0e0;
}

.message.error {
  align-self: center;
  background: rgba(255, 235, 238, 0.95);
  border: 1px solid #ef5350;
}

.message.streaming {
  background: rgba(255, 249, 230, 0.95);
  border: 1px solid #ffd54f;
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
</style>
