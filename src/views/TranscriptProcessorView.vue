<template>
  <div class="transcript-processor-page">
    <!-- Header -->
    <div class="page-header">
      <div class="container">
        <div class="header-content">
          <button @click="goBack" class="btn btn-outline-secondary back-btn">
            <i class="bi bi-arrow-left"></i> Back
          </button>
          <div class="header-title">
            <h1>🎙️ Transcript to Knowledge Graph</h1>
            <p class="header-subtitle">Transform transcripts and videos into interactive knowledge graphs</p>
          </div>
          <div class="header-actions">
            <!-- Future: save/load presets, settings -->
          </div>
        </div>
      </div>
    </div>

    <!-- Progress Indicator -->
    <div class="progress-section" v-if="transcriptText || isProcessing || knowledgeGraphPreview">
      <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div class="progress-indicator flex-grow-1">
            <div class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
              <div class="step-number">1</div>
              <div class="step-label">Input Source</div>
            </div>
            <div class="step-separator"></div>
            <div class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
              <div class="step-number">2</div>
              <div class="step-label">Process</div>
            </div>
            <div class="step-separator"></div>
            <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
              <div class="step-number">3</div>
              <div class="step-label">Review & Export</div>
            </div>
          </div>

          <!-- Test Modal Button -->
          <button @click="openTestModal" class="btn btn-outline-primary ms-3">
            <i class="fas fa-flask me-1"></i> Test Modal
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="container">
        <!-- Step 1: Input -->
        <div v-if="currentStep === 1" class="step-content">
          <div class="row">
            <!-- Left Column: Input Selection (only show if no transcript yet) -->
            <div v-if="!transcriptText" class="col-lg-6">
              <div class="card h-100">
                <div class="card-header">
                  <h4 class="mb-0">Choose Input Source</h4>
                </div>
                <div class="card-body">
                  <!-- Input method selection -->
                  <div class="row g-3">
                    <div class="col-12">
                      <div class="input-method"
                           :class="{ active: inputMethod === 'file' }"
                           @click="inputMethod = 'file'">
                        <div class="input-method-icon">
                          <i class="fas fa-file-upload"></i>
                        </div>
                        <div class="input-method-content">
                          <h5>Upload File</h5>
                          <p class="text-muted">Upload transcript files (.txt, .md, .doc, .pdf)</p>
                        </div>
                      </div>
                    </div>

                    <div class="col-12">
                      <div class="input-method"
                           :class="{ active: inputMethod === 'paste' }"
                           @click="inputMethod = 'paste'">
                        <div class="input-method-icon">
                          <i class="fas fa-paste"></i>
                        </div>
                        <div class="input-method-content">
                          <h5>Paste Text</h5>
                          <p class="text-muted">Paste transcript text directly</p>
                        </div>
                      </div>
                    </div>

                    <div class="col-12">
                      <div class="input-method"
                           :class="{ active: inputMethod === 'youtube' }"
                           @click="inputMethod = 'youtube'">
                        <div class="input-method-icon">
                          <i class="fab fa-youtube"></i>
                        </div>
                        <div class="input-method-content">
                          <h5>YouTube Video</h5>
                          <p class="text-muted">Extract transcript from YouTube videos</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- File upload interface -->
                  <div v-if="inputMethod === 'file'" class="mt-4">
                    <div class="upload-area" @dragover.prevent @drop="handleFileDrop">
                      <input type="file" ref="fileInput" @change="handleFileSelect" accept=".txt,.md,.doc,.docx,.pdf" class="d-none">
                      <div class="upload-content" @click="$refs.fileInput.click()">
                        <i class="fas fa-cloud-upload-alt fa-3x text-muted mb-3"></i>
                        <p class="mb-2">Drop files here or click to browse</p>
                        <small class="text-muted">Supported: .txt, .md, .doc, .pdf</small>
                      </div>
                    </div>
                    <div v-if="selectedFile" class="mt-3">
                      <div class="selected-file">
                        <i class="fas fa-file-alt me-2"></i>
                        {{ selectedFile.name }}
                        <button @click="selectedFile = null" class="btn btn-sm btn-outline-danger ms-2">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                    <!-- Direct processing button for file upload -->
                    <div v-if="selectedFile" class="mt-4 d-flex justify-content-end">
                      <button
                        @click="startProcessing"
                        class="btn btn-primary"
                      >
                        <i class="fas fa-play me-1"></i> Start Processing
                      </button>
                    </div>
                  </div>

                  <!-- Paste text interface -->
                  <div v-if="inputMethod === 'paste'" class="mt-4">
                    <textarea
                      v-model="pastedText"
                      class="form-control"
                      rows="8"
                      placeholder="Paste your transcript text here..."
                    ></textarea>
                    <!-- Direct processing button for pasted text -->
                    <div v-if="pastedText && pastedText.trim()" class="mt-4 d-flex justify-content-end">
                      <button
                        @click="startProcessing"
                        class="btn btn-primary"
                      >
                        <i class="fas fa-play me-1"></i> Start Processing
                      </button>
                    </div>
                  </div>

                  <!-- YouTube interface -->
                  <div v-if="inputMethod === 'youtube'" class="mt-4">
                    <div class="mb-3">
                      <label class="form-label">Video URL or ID:</label>
                      <input
                        v-model="youtubeUrl"
                        type="text"
                        class="form-control"
                        placeholder="https://youtu.be/CD5RENJiP6c?si=U7..."
                        @input="extractVideoId"
                      >
                      <small v-if="videoId" class="text-muted">Video ID: {{ videoId }}</small>
                    </div>

                    <div class="mb-3">
                      <label class="form-label">Or search for videos:</label>
                      <div class="input-group">
                        <input
                          v-model="searchQuery"
                          type="text"
                          class="form-control"
                          placeholder="Search YouTube videos..."
                        >
                        <button @click="searchVideos" class="btn btn-outline-secondary" type="button">
                          <i class="fas fa-search me-1"></i> Search
                        </button>
                      </div>
                    </div>

                    <div class="d-flex gap-2 mb-3">
                      <button
                        @click="fetchYouTubeTranscriptIO"
                        :disabled="!videoId || isLoading"
                        class="btn btn-primary"
                      >
                        <i class="fas fa-download me-1"></i>
                        {{ isLoading ? 'Loading...' : 'Transcribe' }}
                      </button>
                      <button
                        @click="fetchDownsubTranscript"
                        :disabled="!videoId || isLoading"
                        class="btn btn-success"
                      >
                        <i class="fas fa-download me-1"></i>
                        {{ isLoading ? 'Loading...' : 'DOWNSUB' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Transcript Result Section (show when transcript is fetched but not processing yet) -->
            <div v-if="transcriptText && currentStep === 1" class="col-lg-12">
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h4 class="mb-0">✅ Transcript Ready</h4>
                  <button @click="startOver" class="btn btn-outline-secondary btn-sm">
                    <i class="fas fa-redo"></i> Start Over
                  </button>
                </div>
                <div class="card-body">
                  <div class="row">
                    <!-- Video Information (if from YouTube) -->
                    <div v-if="videoMetadata" class="col-md-4">
                      <div class="video-info-card">
                        <h5>📹 Video Information</h5>
                        <div class="video-thumbnail-container mb-3">
                          <img
                            :src="videoMetadata.thumbnail"
                            :alt="videoMetadata.title"
                            class="video-thumbnail"
                            style="width: 100%; max-width: 200px; border-radius: 8px;"
                          />
                        </div>
                        <h6>{{ videoMetadata.title }}</h6>
                        <div class="video-meta text-muted small">
                          <div><i class="fas fa-user"></i> {{ videoMetadata.channelTitle }}</div>
                          <div v-if="videoMetadata.duration">
                            <i class="fas fa-clock"></i> {{ formatDuration(videoMetadata.duration) }}
                          </div>
                          <div v-if="videoMetadata.publishedAt">
                            <i class="fas fa-calendar"></i> {{ formatDate(videoMetadata.publishedAt) }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Transcript Preview -->
                    <div :class="videoMetadata ? 'col-md-8' : 'col-md-12'">
                      <div class="transcript-preview">
                        <h5>📝 Transcript Preview</h5>
                        <div class="transcript-stats mb-3">
                          <span class="badge bg-primary me-2">{{ transcriptStats.characters.toLocaleString() }} characters</span>
                          <span class="badge bg-info me-2">{{ transcriptStats.words.toLocaleString() }} words</span>
                          <span class="badge bg-success">~{{ transcriptStats.kb }} KB</span>
                        </div>

                        <!-- Language Configuration -->
                        <div class="language-config mb-3">
                          <div class="row">
                            <div class="col-md-6">
                              <label class="form-label">Source Language:</label>
                              <select v-model="sourceLanguage" class="form-select">
                                <option value="auto">Auto-detect</option>
                                <option value="English">English</option>
                                <option value="Turkish">Turkish</option>
                                <option value="German">German</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="Norwegian">Norwegian</option>
                              </select>
                            </div>
                            <div class="col-md-6 d-flex align-items-end">
                              <div class="form-check">
                                <input
                                  class="form-check-input"
                                  type="checkbox"
                                  id="keep-original"
                                  v-model="keepOriginalLanguage"
                                />
                                <label class="form-check-label" for="keep-original">
                                  Keep original language (don't translate to Norwegian)
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="transcript-content">
                          <textarea
                            v-model="transcriptText"
                            class="form-control"
                            rows="6"
                            readonly
                            style="resize: vertical;"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Continue Processing Button -->
                  <div class="text-center mt-4">
                    <button @click="startProcessing" class="btn btn-primary btn-lg px-5">
                      <i class="fas fa-play me-2"></i>
                      Start Processing Transcript
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

            <!-- Step 2: Processing (formerly Step 3) -->
              <div v-if="currentStep === 2" class="step-content">
                <div class="processing-section">
                  <div class="processing-header">
                    <h3>{{ processingStage || 'Processing Transcript...' }}</h3>
                    <div class="processing-animation">
                      <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Processing...</span>
                      </div>
                    </div>
                  </div>

                  <div class="progress-container">
                    <div class="progress mb-3">
                      <div
                        class="progress-bar progress-bar-striped progress-bar-animated"
                        :style="{ width: processingProgress + '%' }"
                        role="progressbar"
                      ></div>
                    </div>
                    <p class="processing-message">{{ processingMessage }}</p>
                  </div>

                  <div class="processing-details">
                    <p class="text-muted">
                      We're analyzing your transcript and generating a knowledge graph with Norwegian summaries.
                      This may take a few minutes depending on the content length.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Step 3: Review and Export -->
              <div v-if="currentStep === 3" class="step-content">
                <h3>Review Generated Knowledge Graph</h3>

                <div class="results-section">
                  <div class="results-stats" v-if="knowledgeGraphPreview">
                    <div class="stat-card">
                      <div class="stat-number">{{ knowledgeGraphPreview.nodes?.length || 0 }}</div>
                      <div class="stat-label">Content Sections</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">{{ (knowledgeGraphPreview.edges?.length || 0) }}</div>
                      <div class="stat-label">Connections</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-number">{{ transcriptStats.kb }}</div>
                      <div class="stat-label">KB Processed</div>
                    </div>
                  </div>

                  <!-- Action Buttons -->
                  <div class="action-buttons">
                    <button @click="handleImportToGraph" class="btn btn-success btn-lg">
                      <i class="bi bi-plus-circle"></i> Add to Current Graph
                    </button>
                    <button @click="handleCreateNewGraph" class="btn btn-info btn-lg">
                      <i class="bi bi-file-plus"></i> Create New Graph
                    </button>
                    <button @click="startOver" class="btn btn-outline-warning">
                      <i class="bi bi-arrow-clockwise"></i> Start Over
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <!-- Test Modal -->
      <TranscriptProcessorModal
        v-if="showTestModal"
        @close="closeTestModal"
        @graph-imported="closeTestModal"
      />
</template><script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTranscriptProcessor } from '@/composables/useTranscriptProcessor'
import TranscriptProcessorModal from '@/components/TranscriptProcessorModal.vue'

// Router
const router = useRouter()

// Use the transcript processor composable
const {
  // State
  transcriptText,
  sourceLanguage,
  keepOriginalLanguage,
  isLoading,
  isProcessing,
  processingStage,
  processingProgress,
  processingMessage,
  knowledgeGraphPreview,
  youtubeUrl,
  videoId,
  searchQuery,
  videoMetadata,

  // Computed
  transcriptStats,

  // Methods
  extractVideoId,
  processFile,
  fetchYouTubeTranscriptIO,
  fetchDownsubTranscript,
  searchYouTubeVideos,
  processTranscript,
  importToGraph,
  createNewGraph,
  formatDate,
  formatDuration,
} = useTranscriptProcessor()

// Local state for the page
const currentStep = ref(1)
const inputMethod = ref('upload')
const selectedFile = ref(null)
const pastedText = ref('')
const showTestModal = ref(false)

// Function to open test modal
const openTestModal = () => {
  showTestModal.value = true
}

const closeTestModal = () => {
  showTestModal.value = false
}

// Navigation methods
const goBack = () => {
  router.push('/graph-editor')
}

// Processing methods
const startProcessing = async () => {
  // Set transcript text based on input method
  if (inputMethod.value === 'paste' && pastedText.value) {
    transcriptText.value = pastedText.value.trim()
  } else if (inputMethod.value === 'file' && selectedFile.value) {
    // processFile should already have set transcriptText
  } else if (inputMethod.value === 'youtube' && transcriptText.value) {
    // transcript should already be fetched
  }

  if (!transcriptText.value) {
    alert('Please provide transcript content before processing')
    return
  }

  currentStep.value = 2

  try {
    await processTranscript()
    currentStep.value = 3
  } catch (error) {
    console.error('Processing failed:', error)
    alert('Processing failed: ' + error.message)
    currentStep.value = 1
  }
}

// Export methods with navigation
const handleImportToGraph = async () => {
  try {
    importToGraph()
    router.push('/graph-editor')
  } catch (error) {
    console.error('Import failed:', error)
    alert('Import failed: ' + error.message)
  }
}

const handleCreateNewGraph = async () => {
  try {
    const result = await createNewGraph()
    if (result && result.graphId) {
      // Navigate to gnew-viewer with the new graphId parameter
      router.push(`/gnew-viewer?graphId=${result.graphId}`)
    } else {
      // Fallback to graph-editor if no graphId is returned
      router.push('/graph-editor')
    }
  } catch (error) {
    console.error('Create new graph failed:', error)
    alert('Create new graph failed: ' + error.message)
  }
}

const startOver = () => {
  currentStep.value = 1
  inputMethod.value = 'upload'
  // Clear all data
  transcriptText.value = ''
  youtubeUrl.value = ''
  videoId.value = ''
  selectedFile.value = null
  pastedText.value = ''
  videoMetadata.value = null
  knowledgeGraphPreview.value = null
}

// File handling methods
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    processFile(file)
  }
}

const handleFileDrop = (event) => {
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file) {
    selectedFile.value = file
    processFile(file)
  }
}

// Video search method
const searchVideos = () => {
  if (searchQuery.value.trim()) {
    searchYouTubeVideos()
  }
}

onMounted(() => {
  // Initialize any required data
})
</script>

<style scoped>
.transcript-processor-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* Header Styles */
.page-header {
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 20px 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title h1 {
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
}

.header-subtitle {
  margin: 5px 0 0 0;
  color: #7f8c8d;
  font-size: 1.1rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Progress Indicator */
.progress-section {
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 20px 0;
}

.progress-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 600px;
  margin: 0 auto;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #dee2e6;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: #007bff;
  color: white;
}

.step.completed .step-number {
  background: #28a745;
  color: white;
}

.step-label {
  font-size: 0.9rem;
  color: #6c757d;
  font-weight: 500;
}

.step.active .step-label {
  color: #007bff;
}

.step.completed .step-label {
  color: #28a745;
}

.step-separator {
  width: 60px;
  height: 2px;
  background: #dee2e6;
  margin: 0 20px;
  margin-bottom: 32px;
}

/* Main Content */
.main-content {
  padding: 40px 0;
}

.content-card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.step-content h3 {
  color: #2c3e50;
  margin-bottom: 25px;
  font-weight: 600;
}

/* Input Method Selector */
.input-method-selector {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
}

.input-method {
  display: flex;
  align-items: center;
  padding: 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  margin-bottom: 15px;
}

.input-method:hover {
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0,123,255,0.15);
  transform: translateY(-2px);
}

.input-method.active {
  border-color: #007bff;
  background: #f8f9ff;
  box-shadow: 0 4px 12px rgba(0,123,255,0.2);
}

.input-method-icon {
  font-size: 2.5rem;
  margin-right: 20px;
  color: #007bff;
  min-width: 60px;
  text-align: center;
}

.input-method.active .input-method-icon {
  color: #0056b3;
}

.input-method-content {
  flex: 1;
}

.input-method-content h5 {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.2rem;
  margin-bottom: 8px;
}

.input-method-content p {
  color: #7f8c8d;
  font-size: 0.95rem;
  margin: 0;
}

.method-btn {
  display: flex;
  align-items: center;
  padding: 20px;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.method-btn:hover {
  border-color: #007bff;
  box-shadow: 0 2px 10px rgba(0,123,255,0.1);
}

.method-btn.active {
  border-color: #007bff;
  background: #f8f9ff;
}

.method-icon {
  font-size: 2rem;
  margin-right: 20px;
}

.method-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
  margin-bottom: 5px;
}

.method-description {
  color: #7f8c8d;
  font-size: 0.9rem;
}

/* Transcript Result Section */
.video-info-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.video-info-card h5 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-weight: 600;
}

.video-meta {
  line-height: 1.6;
}

.video-meta div {
  margin-bottom: 8px;
}

.video-meta i {
  width: 16px;
  margin-right: 8px;
  color: #6c757d;
}

.transcript-preview {
  height: 100%;
}

.transcript-preview h5 {
  color: #2c3e50;
  margin-bottom: 15px;
  font-weight: 600;
}

.transcript-stats {
  margin-bottom: 15px;
}

.transcript-content {
  flex: 1;
}

.language-config {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.language-config .form-label {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 5px;
}

.language-config .form-check-label {
  font-size: 0.9rem;
  color: #495057;
}

/* Upload Section */
.upload-area {
  border: 3px dashed #007bff;
  border-radius: 12px;
  padding: 60px 20px;
  text-align: center;
  background: #f8f9ff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-area:hover {
  background: #e6f3ff;
  border-color: #0056b3;
}

.file-input {
  display: none;
}

.upload-icon {
  font-size: 3rem;
  color: #007bff;
  margin-bottom: 15px;
}

.upload-content h4 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.upload-content p {
  color: #7f8c8d;
  margin-bottom: 20px;
}

.supported-formats {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.format-tag {
  background: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
}

/* Text Input */
.transcript-input {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: vertical;
}

.input-stats {
  display: flex;
  gap: 20px;
  margin-top: 10px;
  font-size: 0.9rem;
  color: #6c757d;
}

/* YouTube Section */
.youtube-section > * + * {
  margin-top: 20px;
}

.url-input-group {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.url-input-group .form-control {
  flex: 1;
}

.transcript-method-buttons {
  display: flex;
  gap: 8px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.video-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.video-card:hover {
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.video-thumbnail {
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.video-info {
  padding: 15px;
}

.video-title {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-channel {
  color: #7f8c8d;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.video-date {
  color: #adb5bd;
  font-size: 0.8rem;
}

/* Configuration Section */
.configuration-section > * + * {
  margin-top: 20px;
}

.preview-box {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
}

.preview-stats {
  display: flex;
  gap: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  font-size: 0.9rem;
  color: #6c757d;
}

/* Processing Section */
.processing-section {
  text-align: center;
  padding: 40px 20px;
}

.processing-header h3 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.processing-animation {
  margin-bottom: 30px;
}

.progress-container {
  max-width: 400px;
  margin: 0 auto;
}

.processing-message {
  color: #6c757d;
  font-style: italic;
}

.processing-details {
  margin-top: 30px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* Results Section */
.results-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  justify-content: center;
}

.stat-card {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  min-width: 120px;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9rem;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Step Actions */
.step-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #e9ecef;
}

/* Preview Panel */
.preview-panel > * + * {
  margin-top: 30px;
}

.video-metadata-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.video-metadata-card h4 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.metadata-content {
  display: flex;
  gap: 20px;
}

.video-thumbnail-container {
  position: relative;
  flex-shrink: 0;
}

.video-thumbnail {
  width: 160px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.watch-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.8rem;
}

.video-details h5 {
  color: #2c3e50;
  margin-bottom: 10px;
  line-height: 1.3;
}

.video-meta > * + * {
  margin-top: 5px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6c757d;
  font-size: 0.9rem;
}

/* Knowledge Graph Preview */
.knowledge-graph-preview {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-bottom: 30px;
}

.knowledge-graph-preview h4 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.node-list > * + * {
  margin-top: 15px;
}

.node-preview-item {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.node-index {
  width: 24px;
  height: 24px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
}

.node-label {
  font-weight: 600;
  color: #2c3e50;
  flex: 1;
}

.node-type {
  background: #28a745;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.node-content {
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

.more-nodes {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 15px;
}

/* Tips Card */
.tips-card {
  background: white;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.tips-card h4 {
  color: #2c3e50;
  margin-bottom: 15px;
}

.tips-list {
  list-style: none;
  padding: 0;
}

.tips-list > * + * {
  margin-top: 10px;
}

.tips-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: #6c757d;
  line-height: 1.5;
}

.tips-list li::before {
  content: "💡";
  flex-shrink: 0;
}

/* Loading States */
.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.loading-state .spinner-border {
  margin-bottom: 15px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .progress-indicator {
    flex-direction: column;
    gap: 20px;
  }

  .step-separator {
    width: 2px;
    height: 30px;
    margin: 10px 0;
  }

  .content-card {
    padding: 20px;
  }

  .metadata-content {
    flex-direction: column;
  }

  .video-thumbnail {
    width: 100%;
    max-width: 280px;
  }

  .step-actions {
    flex-direction: column;
  }

  .action-buttons {
    flex-direction: column;
  }

  .results-stats {
    flex-direction: column;
    align-items: center;
  }
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.step-content {
  animation: fadeIn 0.5s ease-out;
}

/* Utility classes for spacing */
.space-y-10 > * + * { margin-top: 10px; }
.space-y-15 > * + * { margin-top: 15px; }
.space-y-20 > * + * { margin-top: 20px; }
.space-y-30 > * + * { margin-top: 30px; }
</style>
