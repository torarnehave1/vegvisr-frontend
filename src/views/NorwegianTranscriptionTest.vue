<template>
  <div class="norwegian-test-view">
    <div class="header">
      <h1>🇳🇴 Norwegian Audio Transcription Test</h1>
      <p>Test the Norwegian transcription service with audio files</p>
      <div class="service-info">
        <span class="service-badge">Worker: <code>norwegian-transcription-worker</code></span>
        <span class="language-badge">Language: Norwegian (no)</span>
      </div>
    </div>

    <!-- Status Message Display -->
    <div v-if="statusMessage" class="status-banner" :class="statusMessage.includes('✅') ? 'success' : 'info'">
      {{ statusMessage }}
    </div>

    <!-- Health Check Section -->
    <div class="test-section">
      <h2>🏥 Transcription Endpoint Status</h2>

      <!-- GPU Endpoint Section -->
      <div class="endpoint-section">
        <h3>🚀 GPU Endpoint (nb-whisper-medium-rda)</h3>
        <p class="section-description">
          Nvidia H200 GPU endpoint - Faster but may be scaled to zero.
          Wake it up and wait for it to be ready before transcribing.
        </p>

        <div class="endpoint-controls">
          <button @click="checkEndpointStatus" :disabled="checkingEndpoint" class="btn btn-primary">
            {{ checkingEndpoint ? 'Checking...' : '🔍 Check GPU Status' }}
          </button>
          <button @click="wakeUpAndWait" :disabled="wakingUpEndpoint" class="btn btn-success">
            {{ wakingUpEndpoint ? 'Waking Up...' : '⚡ Wake Up GPU & Wait' }}
          </button>
        </div>

        <div v-if="endpointStatus" class="status-result" :class="endpointStatus.type">
          <strong>GPU Status:</strong> {{ endpointStatus.message }}
          <div v-if="endpointStatus.details" class="health-details">
            <pre>{{ endpointStatus.details }}</pre>
          </div>
        </div>

        <!-- Progress indicator for GPU wake-up -->
        <div v-if="wakingUpEndpoint" class="wake-progress">
          <div class="progress-spinner">⏳</div>
          <strong>{{ wakeUpProgress }}</strong>
          <p class="hint-text">GPU typically takes 30-60 seconds...</p>
        </div>
      </div>

      <!-- CPU Endpoint Section -->
      <div class="endpoint-section">
        <h3>💻 CPU Endpoint (nb-whisper-medium-kgm)</h3>
        <p class="section-description">
          Intel Sapphire Rapids CPU endpoint - More economical, may be scaled to zero.
          Wake it up and wait for it to be ready before transcribing.
        </p>

        <div class="endpoint-controls">
          <button @click="checkEndpointStatusCPU" :disabled="checkingEndpointCPU" class="btn btn-primary">
            {{ checkingEndpointCPU ? 'Checking...' : '🔍 Check CPU Status' }}
          </button>
          <button @click="wakeUpAndWaitCPU" :disabled="wakingUpEndpointCPU" class="btn btn-success">
            {{ wakingUpEndpointCPU ? 'Waking Up...' : '⚡ Wake Up CPU & Wait' }}
          </button>
        </div>

        <div v-if="endpointStatusCPU" class="status-result" :class="endpointStatusCPU.type">
          <strong>CPU Status:</strong> {{ endpointStatusCPU.message }}
          <div v-if="endpointStatusCPU.details" class="health-details">
            <pre>{{ endpointStatusCPU.details }}</pre>
          </div>
        </div>

        <!-- Progress indicator for CPU wake-up -->
        <div v-if="wakingUpEndpointCPU" class="wake-progress">
          <div class="progress-spinner">⏳</div>
          <strong>{{ wakeUpProgressCPU }}</strong>
          <p class="hint-text">CPU typically takes 30-60 seconds...</p>
        </div>
      </div>
    </div>

    <!-- Automated Speaker Diarization Section -->
    <div class="test-section">
      <h2>🎯 Automated Speaker Diarization (AI-Powered)</h2>
      <p class="section-description">
        Use AI to automatically detect and separate different speakers in your audio recordings.
        Perfect for analyzing therapy sessions, interviews, and multi-speaker conversations.
      </p>

      <!-- Audio Source Options -->
      <div class="audio-source-options">
        <h4>Choose Audio Source:</h4>

        <!-- Option 1: Use Transcription Result -->
        <div v-if="transcriptionResult && transcriptionResult.r2Url" class="audio-option">
          <button
            @click="useTranscriptionForDiarization"
            class="btn btn-secondary"
          >
            🎯 Analyze Current Transcription Audio
          </button>
          <p class="option-hint">Use the audio from your current transcription</p>
        </div>

        <!-- Option 2: Load from Portfolio -->
        <div class="audio-option">
          <button
            @click="loadPortfolioForDiarization"
            :disabled="loadingDiarizationPortfolio"
            class="btn btn-primary"
          >
            {{ loadingDiarizationPortfolio ? '📼 Loading Portfolio...' : '📼 Load Audio Portfolio' }}
          </button>
          <p class="option-hint">Choose from your saved recordings</p>
        </div>
      </div>

      <!-- Portfolio Recordings List for Diarization -->
      <div v-if="diarizationRecordings.length > 0" class="portfolio-list">
        <h4>Select a Recording to Analyze:</h4>
        <div class="recordings-grid">
          <div
            v-for="recording in diarizationRecordings"
            :key="recording.id"
            class="recording-card"
            :class="{ selected: selectedDiarizationId === recording.id }"
            @click="selectDiarizationRecording(recording)"
          >
            <div class="recording-header">
              <strong>{{ recording.displayName || recording.fileName }}</strong>
              <span class="recording-date">{{ formatDate(recording.timestamp) }}</span>
            </div>

            <!-- Recording Info -->
            <div class="recording-info">
              <div class="recording-meta">
                <span v-if="recording.estimatedDuration || recording.duration">
                  🕐 {{ formatDuration(recording.estimatedDuration || recording.duration) }}
                </span>
                <span v-if="recording.fileSize">📦 {{ formatFileSize(recording.fileSize) }}</span>
              </div>
              <div class="badges-container">
                <span class="badge bg-primary">{{
                  recording.metadata?.category || recording.category || 'Uncategorized'
                }}</span>
                <span
                  v-for="tag in recording.metadata?.tags || recording.tags || []"
                  :key="tag"
                  class="badge bg-secondary ms-1"
                >
                  {{ tag }}
                </span>
                <span
                  v-if="recording.diarization && recording.diarization.segments && recording.diarization.segments.length > 0"
                  class="badge bg-success ms-1"
                  title="Speaker diarization available"
                >
                  🎤 {{ recording.diarization.numSpeakers || recording.diarization.segments.length }} Speakers
                </span>
                <span
                  v-if="recording.conversationAnalysis"
                  class="badge bg-primary ms-1"
                  title="AI conversation analysis available"
                >
                  🤖 AI Analysis
                </span>
              </div>
            </div>

            <!-- Transcription Preview -->
            <div v-if="recording.norwegianTranscription || recording.transcriptionText" class="transcription-preview">
              <p class="preview-text">
                {{
                  recording.norwegianTranscription?.improved_text?.substring(0, 150) ||
                  recording.norwegianTranscription?.raw_text?.substring(0, 150) ||
                  recording.transcriptionText?.substring(0, 150) ||
                  ''
                }}{{
                  (recording.norwegianTranscription?.improved_text?.length > 150 ||
                   recording.norwegianTranscription?.raw_text?.length > 150 ||
                   recording.transcriptionText?.length > 150) ? '...' : ''
                }}
              </p>
            </div>

            <!-- Action Buttons -->
            <div v-if="recording.diarization?.segments && recording.transcriptionText" class="card-actions mt-2">
              <router-link
                :to="{
                  name: 'conversation-analysis',
                  query: { recordingId: recording.recordingId }
                }"
                :class="['btn', 'btn-sm', recording.conversationAnalysis ? 'btn-primary' : 'btn-success']"
                @click.stop
              >
                {{ recording.conversationAnalysis ? '🤖 View Analysis' : '🎭 Analyze Conversation' }}
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Selected Recording for Diarization -->
      <div v-if="selectedDiarizationRecording" class="diarization-analysis">
        <h4>🎧 Analyzing: {{ selectedDiarizationRecording.displayName || selectedDiarizationRecording.fileName }}</h4>

        <!-- Audio Player -->
        <div class="audio-player-section">
          <audio
            v-if="selectedDiarizationRecording.r2Url"
            :src="selectedDiarizationRecording.r2Url"
            controls
            class="audio-player"
            ref="diarizationAudioPlayer"
            @timeupdate="updateDiarizationTime"
          ></audio>
          <div class="current-time">Current time: {{ formatTime(currentDiarizationTime) }}</div>
        </div>

        <!-- Analyze Button -->
        <button
          @click="analyzeSpeakerDiarization"
          :disabled="analyzingDiarization"
          class="btn btn-primary btn-lg"
        >
          {{ analyzingDiarization ? '🔄 Analyzing Speakers...' : '🎯 Analyze Speakers (AI)' }}
        </button>

        <!-- Use for Transcription Button -->
        <button
          @click="useThisAudioForTranscription"
          class="btn btn-success btn-lg"
          style="margin-left: 10px;"
        >
          🇳🇴 Use This Audio for Transcription
        </button>

        <!-- Progress Message -->
        <div v-if="diarizationProgress" class="progress-message">
          <div class="progress-spinner">⏳</div>
          <strong>{{ diarizationProgress }}</strong>
          <p class="hint-text">This may take 1-2 minutes for longer recordings...</p>
        </div>

        <!-- Diarization Results -->
        <div v-if="diarizationResult" class="diarization-results">
          <div class="results-header">
            <h5>✅ Diarization Complete!</h5>
            <div class="results-stats">
              <span class="stat-badge">👥 {{ diarizationResult.numSpeakers }} Speakers Detected</span>
              <span class="stat-badge">📊 {{ diarizationResult.segments.length }} Segments</span>
              <span class="stat-badge">⏱️ {{ formatDuration(diarizationResult.duration) }}</span>
            </div>
          </div>

          <!-- Speaker Labels (Editable) -->
          <div class="speaker-labels-section">
            <h6>🏷️ Speaker Labels (click to edit):</h6>
            <div class="speaker-labels-grid">
              <div
                v-for="(label, speaker) in speakerLabels"
                :key="speaker"
                class="speaker-label-item"
                :style="{ borderLeft: `4px solid ${getSpeakerColor(speaker)}` }"
              >
                <span class="speaker-id">{{ speaker }}</span>
                <input
                  v-model="speakerLabels[speaker]"
                  @change="updateSpeakerLabel(speaker)"
                  class="speaker-label-input"
                  :placeholder="`e.g., Therapist, Client`"
                />
              </div>
            </div>

            <!-- Smart Identify Feature -->
            <div v-if="canRunSmartIdentify" class="smart-identify-section">
              <div class="smart-identify-header">
                <h6>🤖 AI-Powered Speaker Identification</h6>
                <p class="help-text">Label a few segments with a speaker name (e.g., "Mentor"), then let AI find similar patterns</p>
              </div>

              <div class="smart-identify-controls">
                <input
                  v-model="targetSpeakerForAI"
                  class="speaker-input"
                  placeholder="Enter speaker name (e.g., Mentor)"
                />
                <button
                  @click="smartIdentifySpeaker(targetSpeakerForAI)"
                  :disabled="!targetSpeakerForAI || analyzingSpeaker"
                  class="btn btn-primary smart-btn"
                >
                  {{ analyzingSpeaker ? '🔍 Analyzing...' : '✨ Find Similar Patterns' }}
                </button>
              </div>

              <!-- AI Suggestions -->
              <div v-if="aiSuggestions.length > 0" class="ai-suggestions">
                <div class="suggestions-header">
                  <h6>💡 Found {{ aiSuggestions.length }} Suggestions</h6>
                  <button
                    @click="applyAllHighConfidence(targetSpeakerForAI)"
                    class="btn btn-success btn-sm"
                  >
                    ✅ Apply High Confidence (>70%)
                  </button>
                  <button
                    @click="clearSuggestions"
                    class="btn btn-outline-secondary btn-sm"
                  >
                    ✖ Clear
                  </button>
                </div>

                <div class="suggestions-list">
                  <div
                    v-for="(suggestion, idx) in aiSuggestions.slice(0, 10)"
                    :key="idx"
                    class="suggestion-item"
                    :class="{ 'high-confidence': suggestion.confidence > 0.7 }"
                  >
                    <div class="suggestion-info">
                      <span class="confidence-badge">{{ Math.round(suggestion.confidence * 100) }}%</span>
                      <span class="segment-time">{{ formatTime(suggestion.segment.start) }} - {{ formatTime(suggestion.segment.end) }}</span>
                      <span class="segment-speaker">{{ suggestion.segment.speaker }}</span>
                    </div>
                    <button
                      @click="applySuggestion(suggestion, targetSpeakerForAI)"
                      class="btn btn-sm btn-success apply-btn"
                    >
                      ✓ Apply
                    </button>
                  </div>
                  <p v-if="aiSuggestions.length > 10" class="more-suggestions">
                    + {{ aiSuggestions.length - 10 }} more suggestions
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Visual Timeline -->
          <div class="speaker-timeline-visual">
            <h6>📊 Speaker Timeline:</h6>
            <div class="timeline-container">
              <div
                v-for="(segment, index) in diarizationResult.segments"
                :key="index"
                class="timeline-bar"
                :style="{
                  left: `${(segment.start / diarizationResult.duration) * 100}%`,
                  width: `${((segment.end - segment.start) / diarizationResult.duration) * 100}%`,
                  backgroundColor: getEffectiveSpeakerColor(segment)
                }"
                :title="`${getDisplaySpeakerName(segment, index)}: ${formatTime(segment.start)} - ${formatTime(segment.end)}`"
                @click="seekToSegment(segment.start)"
              ></div>
            </div>
          </div>

          <!-- Speaker Mapping Management (for Chunked Transcriptions) -->
          <div v-if="hasMultipleChunks" class="speaker-mapping-section">
            <h6>🎯 Speaker Mapping (Cross-Chunk)</h6>
            <p class="mapping-help">
              Since this audio was processed in chunks, speakers may have different IDs across chunks.
              Use BLANK_SPEAKER tags to group the same person across different chunks.
            </p>

            <!-- Available BLANK_SPEAKER tags -->
            <div class="blank-speaker-tags">
              <button
                v-for="blankTag in availableBlankTags"
                :key="blankTag"
                @click="selectBlankTag(blankTag)"
                :class="['blank-tag-btn', { active: selectedBlankTag === blankTag }]"
                :style="{ borderColor: getBlankTagColor(blankTag) }"
              >
                {{ blankSpeakerNames[blankTag] || blankTag }}
              </button>
              <button @click="addNewBlankTag" class="blank-tag-btn new-tag">
                ➕ Add New Tag
              </button>
            </div>

            <!-- Rename BLANK_SPEAKER tags -->
            <div v-if="Object.keys(blankSpeakerNames).length > 0" class="blank-speaker-names">
              <h6>🏷️ Name Your Speakers:</h6>
              <div class="speaker-name-grid">
                <div
                  v-for="(name, tag) in blankSpeakerNames"
                  :key="tag"
                  class="speaker-name-item"
                >
                  <span class="tag-label" :style="{ color: getBlankTagColor(tag) }">{{ tag }}</span>
                  <input
                    v-model="blankSpeakerNames[tag]"
                    @change="updateBlankSpeakerName(tag)"
                    class="speaker-name-input"
                    :placeholder="`e.g., Tor Arne, Therapist`"
                  />
                  <button @click="removeBlankTag(tag)" class="btn-remove-tag" title="Remove this tag">✕</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Segment List -->
          <div class="segments-list">
            <h6>📝 Detailed Segments:</h6>
            <div class="segments-container" ref="segmentsContainer">
              <div
                v-for="(segment, index) in diarizationResult.segments"
                :key="index"
                :ref="el => { if (el) segmentRefs[index] = el }"
                class="segment-item"
                :class="{ active: isSegmentActive(segment) }"
              >
                <div class="segment-header">
                  <span
                    class="speaker-badge"
                    :style="{ backgroundColor: getSpeakerColor(segment.speaker) }"
                    @click="seekToSegment(segment.start)"
                  >
                    {{ getDisplaySpeakerName(segment, index) }}
                  </span>
                  <span class="segment-time">
                    {{ formatTime(segment.start) }} - {{ formatTime(segment.end) }}
                  </span>
                  <span class="segment-duration">
                    ({{ formatDuration(segment.end - segment.start) }})
                  </span>
                  <span v-if="segment.chunk !== undefined || segment.chunkIndex !== undefined" class="chunk-badge">
                    Chunk {{ (segment.chunk ?? segment.chunkIndex) + 1 }}
                  </span>

                  <!-- Speaker mapping button -->
                  <button
                    v-if="hasMultipleChunks && selectedBlankTag"
                    @click.stop="assignBlankSpeaker(index)"
                    :class="['btn-map-speaker', { mapped: segment.blankSpeaker }]"
                    :style="{ borderColor: getBlankTagColor(selectedBlankTag) }"
                    :title="`Assign to ${selectedBlankTag}`"
                  >
                    {{ segment.blankSpeaker ? '✓' : '→' }} {{ selectedBlankTag }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Save Diarization -->
          <div class="save-section">
            <button
              @click="saveDiarizationResult"
              :disabled="savingDiarization"
              class="btn btn-success btn-lg"
            >
              {{ savingDiarization ? 'Saving...' : '💾 Save Diarization to Portfolio' }}
            </button>

            <div v-if="diarizationSaved" class="success-message">
              ✅ Diarization saved successfully!
            </div>
            <div v-if="diarizationSaveError" class="error-message">
              ❌ {{ diarizationSaveError }}
            </div>
          </div>
        </div>

        <!-- Diarization Error -->
        <div v-if="diarizationError" class="error-message">
          <strong>❌ Diarization Failed:</strong>
          <p>{{ diarizationError }}</p>
        </div>
      </div>
    </div>

    <!-- Norwegian Model Info -->
    <div class="test-section">
      <h2>🇳🇴 Norwegian Transcription Model</h2>
      <div class="model-info-card">
        <div class="model-details">
          <strong>Specialized Norwegian Model</strong>
          <small>Optimized for Norwegian language transcription with high accuracy</small>
        </div>

        <!-- Endpoint Selection -->
        <div class="endpoint-selection">
          <h4>⚡ Processing Endpoint</h4>
          <div class="endpoint-options">
            <label class="endpoint-option">
              <input type="radio" v-model="selectedEndpoint" value="cpu" />
              <span class="endpoint-label">
                <strong>🖥️ CPU Endpoint</strong>
                <small>Stable, cost-effective processing (default)</small>
              </span>
            </label>
            <label class="endpoint-option">
              <input type="radio" v-model="selectedEndpoint" value="gpu" />
              <span class="endpoint-label">
                <strong>🚀 GPU Endpoint</strong>
                <small>Faster processing, higher performance</small>
              </span>
            </label>
          </div>
          <div class="endpoint-info">
            <small class="text-muted">
              {{ selectedEndpoint === 'gpu' ?
                '🚀 GPU endpoint provides faster transcription but may have longer cold start times' :
                '🖥️ CPU endpoint provides reliable processing with predictable performance'
              }}
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Cost-Saving Strategy Info -->
    <div class="cost-info-section">
      <div class="cost-info-card">
        <h3>💰 How We Keep Costs Low</h3>
        <p>
          To provide free Norwegian transcription while keeping costs minimal, our specialized Norwegian AI model automatically scales down when not in use.
          This means the first request after a period of inactivity may take <strong>3-4 minutes longer</strong> as the model fully warms up.
        </p>
        <details class="cost-details">
          <summary>Learn more about our cost-saving approach</summary>
          <div class="cost-details-content">
            <ul>
              <li><strong>Auto-scaling:</strong> Norwegian model sleeps when idle, wakes up on demand</li>
              <li><strong>Smart retries:</strong> We wait patiently for the model to warm up instead of failing immediately</li>
              <li><strong>Single endpoint:</strong> One specialized Norwegian model optimized for quality</li>
              <li><strong>Cost benefit:</strong> This approach saves ~80% on infrastructure costs vs always-on models</li>
            </ul>
            <p class="cost-note">
              <em>Your patience during the 3-4 minute warm-up helps us provide high-quality Norwegian transcription free of charge! 🙏</em>
            </p>
          </div>
        </details>
      </div>
    </div>

    <!-- Video to Audio Extraction Section -->
    <div class="test-section">
      <h2>🎬 Extract Audio from Video</h2>
      <p class="section-description">Upload a video file to automatically extract the audio for transcription</p>

      <!-- Video Upload -->
      <div class="upload-area" @dragover.prevent @drop.prevent="handleVideoFileDrop">
        <input
          ref="videoFileInput"
          type="file"
          accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
          @change="handleVideoFileSelect"
          class="file-input"
          style="display: none"
        />
        <button @click="$refs.videoFileInput.click()" class="btn btn-secondary" :disabled="extractingAudio">
          🎬 Choose Video File
        </button>
        <div class="upload-hint">or drag & drop video file here</div>
      </div>

      <!-- Video File Info -->
      <div v-if="selectedVideoFile" class="file-info">
        <h3>Selected Video</h3>
        <p><strong>Name:</strong> {{ selectedVideoFile.name }}</p>
        <p><strong>Type:</strong> {{ selectedVideoFile.type }}</p>
        <p><strong>Size:</strong> {{ formatFileSize(selectedVideoFile.size) }}</p>

        <!-- Extract Audio Button -->
        <button
          @click="extractAudioFromVideo"
          :disabled="extractingAudio"
          class="btn btn-success"
        >
          {{ extractingAudio ? '🎵 Extracting Audio...' : '🎵 Extract Audio' }}
        </button>
      </div>      <!-- Extraction Progress -->
      <div v-if="extractingAudio" class="loading">
        <div class="loading-spinner"></div>
        <p>{{ audioExtractionMessage || 'Extracting audio from video...' }}</p>
      </div>

      <!-- Extracted Audio Result -->
      <div v-if="extractedAudioBlob" class="extracted-audio-result">
        <h3>✅ Audio Extracted Successfully!</h3>
        <div class="audio-preview">
          <audio :src="extractedAudioUrl" controls class="audio-player"></audio>
        </div>
        <div class="extracted-info">
          <span>Format: MP3</span>
          <span>Size: {{ formatFileSize(extractedAudioBlob.size) }}</span>
        </div>
        <p class="hint-text">👆 Audio is ready for transcription below</p>
      </div>
    </div>

    <!-- Audio Upload Section -->
    <div class="test-section">
      <h2>📁 Audio File Upload</h2>

      <!-- File Input with Drag & Drop -->
      <div class="upload-area" @dragover.prevent @drop.prevent="handleFileDrop">
        <input
          ref="fileInput"
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.flac"
          @change="handleFileSelect"
          class="file-input"
          style="display: none"
        />
        <button @click="$refs.fileInput.click()" class="btn btn-secondary">
          📁 Choose Audio File
        </button>
        <div class="upload-hint">or drag & drop audio file here</div>
      </div>

      <!-- File Info -->
      <div v-if="selectedFile" class="file-info">
        <h3>Selected File</h3>
        <p><strong>Name:</strong> {{ selectedFile.name }}</p>
        <p><strong>Type:</strong> {{ selectedFile.type }}</p>
        <p><strong>Size:</strong> {{ formatFileSize(selectedFile.size) }}</p>

        <!-- Audio Preview -->
        <div v-if="audioPreviewUrl" class="audio-preview">
          <audio :src="audioPreviewUrl" controls class="audio-player"></audio>
        </div>
      </div>
    </div>

    <!-- Microphone Recording Section -->
    <div class="test-section">
      <h2>🎤 Microphone Recording</h2>

      <!-- Recording Controls -->
      <div class="recording-controls">
        <button
          @click="startRecording"
          :disabled="recording || !microphoneSupported"
          class="btn btn-primary"
        >
          {{ microphoneSupported ? '🎤 Start Recording' : '❌ Microphone Not Supported' }}
        </button>
        <button @click="stopRecording" :disabled="!recording" class="btn btn-secondary">
          ⏹️ Stop Recording
        </button>

        <!-- Recording Status -->
        <div v-if="recording" class="recording-indicator">
          <div class="recording-dot"></div>
          <span>Recording: {{ recordingDuration }}s</span>
        </div>
      </div>

      <!-- Recorded Audio Preview -->
      <div v-if="recordedBlob" class="recorded-audio">
        <h4>🎵 Recorded Audio</h4>
        <audio :src="recordedUrl" controls class="audio-player"></audio>
        <div class="recorded-info">
          <span>Duration: {{ Math.round(recordingDuration) }}s</span>
          <span>Size: {{ formatFileSize(recordedBlob.size) }}</span>
        </div>
      </div>
    </div>

    <!-- Save Audio Only Section (NEW) -->
    <div class="test-section save-audio-only-section">
      <h2>💾 Save Audio Without Transcription</h2>
      <p class="section-description">
        Save pure audio recordings (mantras, music, sound recordings) to your portfolio without transcription
      </p>

      <!-- Audio metadata for direct save -->
      <div v-if="selectedFile || recordedBlob" class="audio-metadata-form">
        <div class="form-group">
          <label><strong>Display Name:</strong></label>
          <input
            v-model="audioOnlyDisplayName"
            type="text"
            class="form-control"
            placeholder="e.g., Morning Mantra, Jazz Session, Nature Sounds"
          />
        </div>

        <div class="form-group">
          <label><strong>Category:</strong></label>
          <select v-model="audioOnlyCategory" class="form-control">
            <option value="mantra">🕉️ Mantra/Meditation</option>
            <option value="music">🎵 Music</option>
            <option value="nature">🌿 Nature Sounds</option>
            <option value="ambiance">🎧 Ambiance</option>
            <option value="podcast">🎙️ Podcast/Speech</option>
            <option value="other">📁 Other</option>
          </select>
        </div>

        <div class="form-group">
          <label><strong>Tags (comma separated):</strong></label>
          <input
            v-model="audioOnlyTags"
            type="text"
            class="form-control"
            placeholder="e.g., meditation, relaxation, tibetan"
          />
        </div>

        <div class="form-group">
          <label><strong>Description (optional):</strong></label>
          <textarea
            v-model="audioOnlyDescription"
            class="form-control"
            rows="2"
            placeholder="Brief description of the audio content..."
          ></textarea>
        </div>

        <button
          @click="saveAudioOnly"
          :disabled="savingAudioOnly || !userStore.loggedIn"
          class="btn btn-primary save-audio-btn"
        >
          {{ savingAudioOnly ? '💾 Saving...' : '💾 Save Audio to Portfolio' }}
        </button>

        <div v-if="!userStore.loggedIn" class="login-hint">
          ⚠️ Please log in to save audio to your portfolio
        </div>

        <div v-if="audioOnlySaved" class="portfolio-success">
          ✅ Audio saved to your portfolio!
          <router-link to="/audio-portfolio" class="btn btn-outline-primary btn-sm">
            View Portfolio
          </router-link>
        </div>

        <div v-if="audioOnlyError" class="portfolio-error">
          ❌ Failed to save: {{ audioOnlyError }}
          <button @click="saveAudioOnly" class="btn btn-outline-danger btn-sm">
            Try Again
          </button>
        </div>
      </div>

      <div v-else class="no-audio-hint">
        📌 Record or upload an audio file above to save it to your portfolio
      </div>
    </div>

    <!-- Norwegian Transcription Section -->
    <div class="test-section">
      <h2>🇳🇴 Norwegian Transcription</h2>

      <div class="transcription-info">
        <div class="info-card">
          <h4>🛠️ Service Details</h4>
          <ul>
            <li><strong>Endpoint:</strong> Norwegian Transcription Worker (Complete Workflow)</li>
            <li><strong>Language:</strong> Norwegian (no)</li>
            <li>
              <strong>Processing:</strong> Worker → Hetzner Server → Cloudflare AI → Text
              Enhancement
            </li>
            <li><strong>Supported Formats:</strong> WAV, MP3, M4A, FLAC</li>
          </ul>
        </div>
      </div>

      <!-- Context Input for AI Enhancement -->
      <div class="context-section">
        <h4>📝 Context for AI Enhancement (Optional)</h4>
        <p class="context-help">
          Help the AI understand your audio better for improved transcription enhancement:
        </p>
        <textarea
          v-model="transcriptionContext"
          class="context-input"
          placeholder="Example: 'This is a therapy session discussion about somatic therapy and trauma work. Speaker uses Norwegian mixed with English professional terms like trauma-release, biosynthesis, and knowledge elements. The discussion covers therapeutic techniques and workshop reflections.'"
          rows="3"
        ></textarea>
        <div class="context-examples">
          <small><strong>More examples:</strong></small>
          <ul class="example-list">
            <li>💼 Business meeting about software development and agile methods</li>
            <li>🎓 Academic lecture on psychology with research terminology</li>
            <li>🏥 Medical consultation with clinical terms</li>
            <li>🎵 Music lesson with instruments and technique names</li>
          </ul>
        </div>
      </div>

      <div class="transcription-buttons">
        <button
          @click="transcribeAudio"
          :disabled="(!selectedFile && !recordedBlob) || transcribing || whisperTranscribing"
          class="btn btn-success transcribe-btn"
        >
          {{ transcribing ? 'Transcribing...' : '🇳🇴 Norwegian Service' }}
        </button>

        <button
          @click="transcribeWithWhisper"
          :disabled="(!selectedFile && !recordedBlob) || whisperTranscribing || transcribing"
          class="btn btn-primary transcribe-btn"
        >
          {{ whisperTranscribing ? 'Processing...' : '🤖 Whisper-1' }}
        </button>
      </div>

      <div v-if="transcribing || whisperTranscribing" class="loading">
        <div class="loading-spinner"></div>
        <p>{{ loadingMessage || 'Processing audio...' }}</p>

        <!-- Simple processing info -->
        <div v-if="transcribing" class="processing-info">
          <small class="text-muted">
            ⚡ Processing with Norwegian transcription service...
          </small>
        </div>

        <div v-if="whisperTranscribing" class="processing-info">
          <small class="text-muted">
            🤖 Processing with OpenAI Whisper-1...
          </small>
        </div>

        <!-- Chunked processing progress -->
        <div v-if="isChunkedProcessing" class="chunk-progress">
          <div class="progress-info">
            <h4>📊 Processing Large Audio File</h4>
            <div class="progress-stats">
              <span class="chunk-counter">Chunk {{ currentChunk }}/{{ totalChunks }}</span>
              <span class="progress-percentage"
                >{{ Math.round((currentChunk / totalChunks) * 100) }}%</span
              >
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: (currentChunk / totalChunks) * 100 + '%' }"
              ></div>
            </div>
          </div>

          <div class="chunk-controls">
            <button @click="abortProcessing" class="btn btn-danger abort-btn">
              🛑 Abort Processing
            </button>
            <div class="context-quick-edit">
              <label>💡 Adjust context for remaining chunks:</label>
              <textarea
                v-model="transcriptionContext"
                class="context-quick-input"
                placeholder="Update context based on results so far..."
                rows="2"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Single File Results Section -->
    <div v-if="transcriptionResult && !isChunkedProcessing" class="test-section">
      <h2>📝 Transcription Results</h2>

      <div class="result-card">
        <div class="result-header">
          <h3>🇳🇴 Norwegian Transcription</h3>
          <div class="result-metadata">
            <span class="metadata-item"
              >Service: {{ transcriptionResult.metadata?.transcription_server }}</span
            >
            <span class="metadata-item"
              >Language: {{ transcriptionResult.transcription?.language }}</span
            >
            <span class="metadata-item">File: {{ transcriptionResult.metadata?.filename }}</span>
          </div>
        </div>

        <div class="transcription-text">
          <h4>Transcribed Text:</h4>

          <!-- Show improved text if available -->
          <div v-if="transcriptionResult.transcription?.improved_text" class="improved-text">
            <h5>✨ AI Enhanced Text:</h5>
            <div class="text-content enhanced">
              {{ transcriptionResult.transcription.improved_text }}
            </div>
          </div>

          <!-- Always show raw transcription -->
          <div class="raw-text">
            <h5>🎤 Raw Transcription:</h5>
            <div class="text-content raw">
              {{ transcriptionResult.transcription?.raw_text || transcriptionResult.text }}
            </div>
          </div>
        </div>

        <!-- Save to Portfolio Button -->
        <div class="portfolio-actions">
          <button
            v-if="userStore.loggedIn && !portfolioSaved"
            @click="saveToPortfolio"
            :disabled="savingToPortfolio"
            class="btn btn-success portfolio-btn"
          >
            {{ savingToPortfolio ? 'Saving...' : '💾 Save to Audio Portfolio' }}
          </button>

          <div v-if="portfolioSaved" class="portfolio-success">
            ✅ Saved to your Audio Portfolio!
            <router-link to="/audio-portfolio" class="btn btn-outline-primary btn-sm">
              View Portfolio
            </router-link>
          </div>

          <div v-if="portfolioError" class="portfolio-error">
            ❌ Failed to save to portfolio: {{ portfolioError }}
            <button @click="saveToPortfolio" class="btn btn-outline-danger btn-sm">
              Try Again
            </button>
          </div>
        </div>

        <!-- Create New Graph Button -->
        <div class="graph-actions">
          <button
            @click="createNewGraph"
            :disabled="creatingGraph"
            class="btn btn-primary graph-btn"
          >
            {{ creatingGraph ? 'Creating Graph...' : '🔗 Create New Graph from Transcription' }}
          </button>

          <div v-if="graphCreated" class="graph-success">
            ✅ New graph created successfully!
            <router-link to="/gnew-editor" class="btn btn-outline-primary btn-sm">
              Open Graph Editor
            </router-link>
          </div>

          <div v-if="graphError" class="graph-error">
            ❌ Failed to create graph: {{ graphError }}
            <button @click="createNewGraph" class="btn btn-outline-danger btn-sm">
              Try Again
            </button>
          </div>

          <div v-if="!transcriptionResult?.transcription?.improved_text && !transcriptionResult?.transcription?.raw_text && !transcriptionResult?.text" class="graph-info">
            ℹ️ Complete a transcription first to create a graph
          </div>
        </div>

        <div class="result-details">
          <h4>Processing Details:</h4>
          <pre>{{ JSON.stringify(transcriptionResult.metadata, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- Chunked Results Section -->
    <div v-if="chunkResults.length > 0" class="test-section">
      <h2>📝 Progressive Transcription Results</h2>

      <div class="chunk-results-container">
        <div v-for="(chunkResult, index) in chunkResults" :key="index" class="chunk-result">
          <div class="chunk-header">
            <h4>
              🎵 Chunk {{ index + 1 }} ({{ formatTime(chunkResult.startTime) }} -
              {{ formatTime(chunkResult.endTime) }})
            </h4>
            <div class="chunk-meta">
              <span class="processing-time">⏱️ {{ chunkResult.processingTime }}s</span>
              <span v-if="chunkResult.improved_text" class="enhancement-indicator"
                >✨ Enhanced</span
              >
            </div>
          </div>

          <!-- Enhanced text if available -->
          <div v-if="chunkResult.improved_text" class="chunk-text enhanced">
            <h5>✨ AI Enhanced:</h5>
            <div class="text-content">{{ chunkResult.improved_text }}</div>
          </div>

          <!-- Raw transcription -->
          <div class="chunk-text raw">
            <h5>🎤 Raw:</h5>
            <div class="text-content">{{ chunkResult.raw_text }}</div>
          </div>
        </div>
      </div>

      <!-- Combined results summary -->
      <div v-if="!isChunkedProcessing && chunkResults.length > 0" class="combined-results">
        <h3>📋 Complete Transcription</h3>

        <!-- Audio Statistics Summary -->
        <div class="audio-statistics" v-if="chunkResults.some(c => c.silent || c.error)">
          <h4>📊 Audio Analysis:</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total Duration:</span>
              <span class="stat-value">{{ formatTime(chunkResults.reduce((s, c) => s + (c.endTime - c.startTime), 0)) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Speech Duration:</span>
              <span class="stat-value">{{ formatTime(chunkResults.filter(c => !c.silent && !c.error).reduce((s, c) => s + (c.endTime - c.startTime), 0)) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Silence Duration:</span>
              <span class="stat-value">{{ formatTime(chunkResults.filter(c => c.silent).reduce((s, c) => s + (c.endTime - c.startTime), 0)) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Speech Percentage:</span>
              <span class="stat-value">{{ Math.round(chunkResults.filter(c => !c.silent && !c.error).reduce((s, c) => s + (c.endTime - c.startTime), 0) / chunkResults.reduce((s, c) => s + (c.endTime - c.startTime), 0) * 100) }}%</span>
            </div>
          </div>
        </div>

        <div class="combined-text">
          <h4>✨ Full Enhanced Text:</h4>
          <div class="text-content enhanced-combined">
            {{ chunkResults.filter(c => !c.silent && !c.error).map((chunk) => chunk.improved_text || chunk.raw_text).join(' ') }}
          </div>

          <h4>🎤 Full Raw Text:</h4>
          <div class="text-content raw-combined">
            {{ chunkResults.filter(c => !c.silent && !c.error).map((chunk) => chunk.raw_text).join(' ') }}
          </div>
        </div>

        <!-- Save to Portfolio Button for Chunked Results -->
        <div class="portfolio-actions">
          <button
            v-if="userStore.loggedIn && !portfolioSaved"
            @click="saveChunkedToPortfolio"
            :disabled="savingToPortfolio"
            class="btn btn-success portfolio-btn"
          >
            {{ savingToPortfolio ? 'Saving...' : '💾 Save Complete Transcription to Portfolio' }}
          </button>

          <div v-if="portfolioSaved" class="portfolio-success">
            ✅ Saved to your Audio Portfolio!
            <router-link to="/audio-portfolio" class="btn btn-outline-primary btn-sm">
              View Portfolio
            </router-link>
          </div>

          <div v-if="portfolioError" class="portfolio-error">
            ❌ Failed to save to portfolio: {{ portfolioError }}
            <button @click="saveChunkedToPortfolio" class="btn btn-outline-danger btn-sm">
              Try Again
            </button>
          </div>
        </div>

        <!-- Create New Graph Button for Chunked Results -->
        <div class="graph-actions">
          <button
            @click="createNewGraph"
            :disabled="creatingGraph"
            class="btn btn-primary graph-btn"
          >
            {{ creatingGraph ? 'Creating Graph...' : '🔗 Create New Graph from Complete Transcription' }}
          </button>

          <div v-if="graphCreated" class="graph-success">
            ✅ New graph created successfully!
            <router-link to="/gnew-editor" class="btn btn-outline-primary btn-sm">
              Open Graph Editor
            </router-link>
          </div>

          <div v-if="graphError" class="graph-error">
            ❌ Failed to create graph: {{ graphError }}
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-section">
      <div class="alert alert-danger">
        <h4>❌ Error</h4>
        <p>
          <strong>{{ error.message }}</strong>
        </p>
        <div v-if="error.details" class="error-details">
          <pre>{{ error.details }}</pre>
        </div>
        <button @click="clearError" class="btn btn-sm btn-outline-secondary">Clear Error</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

// Router and Store
const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// Reactive data
const selectedFile = ref(null)
const recordedBlob = ref(null)
const recording = ref(false)
const recordingDuration = ref(0)
const mediaRecorder = ref(null)
const recordingTimer = ref(null)
const microphoneSupported = ref(false)

// Video to audio extraction state
const selectedVideoFile = ref(null)
const extractingAudio = ref(false)
const audioExtractionMessage = ref('')
const extractedAudioBlob = ref(null)

const healthLoading = ref(false)
const healthStatus = ref(null)

// GPU Endpoint status checking
const checkingEndpoint = ref(false)
const wakingUpEndpoint = ref(false)
const endpointStatus = ref(null)
const wakeUpProgress = ref('')

// CPU Endpoint status checking
const checkingEndpointCPU = ref(false)
const wakingUpEndpointCPU = ref(false)
const endpointStatusCPU = ref(null)
const wakeUpProgressCPU = ref('')

const transcribing = ref(false)
const whisperTranscribing = ref(false) // For Whisper endpoint
const whisperResult = ref(null) // Store Whisper transcription result
const loadingMessage = ref('')
const transcriptionResult = ref(null)
const error = ref(null)
const transcriptionContext = ref('')
const statusMessage = ref('') // For general status messages

// Chunked processing state
const isChunkedProcessing = ref(false)
const currentChunk = ref(0)
const totalChunks = ref(0)
const chunkResults = ref([])
const processingAborted = ref(false)

// Portfolio save state
const savingToPortfolio = ref(false)
const portfolioSaved = ref(false)
const portfolioError = ref(null)

// Audio-only save state (NEW)
const audioOnlyDisplayName = ref('')
const audioOnlyCategory = ref('other')
const audioOnlyTags = ref('')
const audioOnlyDescription = ref('')
const savingAudioOnly = ref(false)
const audioOnlySaved = ref(false)
const audioOnlyError = ref(null)

// Graph creation state
const creatingGraph = ref(false)
const graphCreated = ref(false)
const graphError = ref(null)

// Model selection state
// Using single Norwegian model endpoint - no selection needed
const selectedEndpoint = ref('cpu') // Default to CPU endpoint

// Speaker identification state
const loadingPortfolio = ref(false)
const portfolioRecordings = ref([])
const selectedRecordingId = ref(null)
const selectedRecording = ref(null)
const numSpeakers = ref(2)
const speakerNames = ref(['Speaker 1', 'Speaker 2'])
const speakerTimeline = ref([])
const currentTimestamp = ref({ start: 0, end: 0 })
const currentSpeakerIndex = ref(0)
const currentAudioTime = ref(0)
const savingSpeakers = ref(false)
const speakersSaved = ref(false)
const speakersError = ref(null)
const identifyingAI = ref(false)
const aiIdentification = ref(null)
const aiError = ref(null)

// Automated diarization state
const loadingDiarizationPortfolio = ref(false)
const diarizationRecordings = ref([])
const selectedDiarizationId = ref(null)
const selectedDiarizationRecording = ref(null)
const analyzingDiarization = ref(false)
const diarizationProgress = ref('')
const diarizationResult = ref(null)
const diarizationError = ref(null)
const currentDiarizationTime = ref(0)
const speakerLabels = ref({}) // Labels by speaker ID (SPEAKER_00 → "Mentor")
const customSegmentLabels = ref({}) // Per-segment override labels { "segmentIndex": "Custom Name" }
const savingDiarization = ref(false)
const diarizationSaved = ref(false)
const diarizationSaveError = ref(null)
const diarizationAudioPlayer = ref(null)
const segmentsContainer = ref(null)
const segmentRefs = ref([])

// Speaker mapping state (for cross-chunk speaker identification)
const selectedBlankTag = ref(null)
const blankSpeakerNames = ref({}) // { BLANK_SPEAKER_A: "Tor Arne", BLANK_SPEAKER_B: "Therapist" }
const nextBlankTagLetter = ref('A')

// Smart identification state
const targetSpeakerForAI = ref('')

// Base URL for Norwegian transcription worker (complete workflow)
const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'

// Base URL for audio extraction worker (FFmpeg container)
const AUDIO_WORKER_BASE_URL = 'https://vegvisr-container.torarnehave.workers.dev'

// Computed properties
const audioPreviewUrl = computed(() => {
  return selectedFile.value ? URL.createObjectURL(selectedFile.value) : null
})

const recordedUrl = computed(() => {
  return recordedBlob.value ? URL.createObjectURL(recordedBlob.value) : null
})

const extractedAudioUrl = computed(() => {
  return extractedAudioBlob.value ? URL.createObjectURL(extractedAudioBlob.value) : null
})

// Computed property for sorted speaker timeline
const sortedTimeline = computed(() => {
  return [...speakerTimeline.value].sort((a, b) => a.start - b.start)
})

// Lifecycle
onMounted(async () => {
  // Check microphone support
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      microphoneSupported.value = true
    } catch (err) {
      console.log('Microphone access not available:', err)
      microphoneSupported.value = false
    }
  }

  // Check for audio URL from portfolio (query parameters)
  if (route.query.audioUrl && route.query.fromPortfolio === 'true') {
    console.log('=== LOADING AUDIO FROM PORTFOLIO ===')
    console.log('Audio URL:', route.query.audioUrl)
    console.log('File Name:', route.query.fileName)
    console.log('Recording ID:', route.query.recordingId)
    console.log('====================================')

    // Load the audio from URL
    try {
      const response = await fetch(route.query.audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${response.statusText}`)
      }

      const blob = await response.blob()

      // Create a File object from the blob
      const fileName = route.query.fileName || 'portfolio-audio.wav'
      const file = new File([blob], fileName, { type: blob.type || 'audio/wav' })

      selectedFile.value = file

      // Cleanup old preview URL if exists
      if (audioPreviewUrl.value) {
        URL.revokeObjectURL(audioPreviewUrl.value)
      }

      // Create preview URL for audio player - this is CRITICAL for playback!
      // The audio player uses audioPreviewUrl computed property

      console.log('✅ Audio file loaded from portfolio:', fileName, blob.size, 'bytes')
      console.log('📁 File object created, audio player should now be able to play it')

      // Show success message
      statusMessage.value = `✅ Loaded: ${fileName} from Audio Portfolio - Ready for transcription!`
      setTimeout(() => { statusMessage.value = '' }, 5000)

    } catch (err) {
      console.error('❌ Failed to load audio from portfolio:', err)
      error.value = { message: `Failed to load audio: ${err.message}` }
    }
  }

  // Removed portfolio loading - not needed without diarization feature
})

// Watch numSpeakers to update speakerNames array
watch(numSpeakers, (newNum, oldNum) => {
  if (newNum > oldNum) {
    // Add new speakers
    for (let i = oldNum; i < newNum; i++) {
      speakerNames.value[i] = `Speaker ${i + 1}`
    }
  } else if (newNum < oldNum) {
    // Remove excess speakers
    speakerNames.value = speakerNames.value.slice(0, newNum)
  }
})

onUnmounted(() => {
  // Cleanup
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
  }
  if (audioPreviewUrl.value) {
    URL.revokeObjectURL(audioPreviewUrl.value)
  }
  if (recordedUrl.value) {
    URL.revokeObjectURL(recordedUrl.value)
  }
})

// Methods
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Audio chunking utilities
const getAudioDuration = (audioBlob) => {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    audio.onloadedmetadata = () => {
      resolve(audio.duration)
    }
    audio.onerror = reject
    audio.src = URL.createObjectURL(audioBlob)
  })
}

const splitAudioIntoChunks = async (audioBlob, chunkDurationSeconds = 120, onProgress = null) => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const fileReader = new FileReader()

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        const sampleRate = audioBuffer.sampleRate
        const chunkSamples = chunkDurationSeconds * sampleRate
        const totalSamples = audioBuffer.length
        const numChunks = Math.ceil(totalSamples / chunkSamples)

        const chunks = []

        console.log(`🔧 Audio info: ${totalSamples} samples, ${sampleRate}Hz, ${numChunks} chunks needed`)
        if (onProgress) onProgress({ phase: 'info', numChunks, sampleRate, totalSamples })

        for (let i = 0; i < numChunks; i++) {
          const startSample = i * chunkSamples
          const endSample = Math.min(startSample + chunkSamples, totalSamples)

          console.log(`🎵 Creating chunk ${i + 1}: samples ${startSample}-${endSample}`)
          if (onProgress) onProgress({ phase: 'creating', current: i + 1, total: numChunks })

          // Create new audio buffer for this chunk
          const chunkBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            endSample - startSample,
            sampleRate,
          )

          // Copy audio data to chunk buffer
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const originalData = audioBuffer.getChannelData(channel)
            const chunkData = chunkBuffer.getChannelData(channel)
            for (let sample = 0; sample < chunkBuffer.length; sample++) {
              chunkData[sample] = originalData[startSample + sample]
            }
          }

          // Convert chunk buffer to blob
          const chunkBlob = await audioBufferToBlob(chunkBuffer)

          console.log(`✅ Chunk ${i + 1} created: ${chunkBlob.size} bytes, ${chunkBuffer.duration.toFixed(2)}s`)

          chunks.push({
            blob: chunkBlob,
            index: i,
            startTime: i * chunkDurationSeconds,
            endTime: Math.min((i + 1) * chunkDurationSeconds, totalSamples / sampleRate),
          })
        }

        resolve(chunks)
      } catch (error) {
        reject(error)
      }
    }

    fileReader.onerror = reject
    fileReader.readAsArrayBuffer(audioBlob)
  })
}

const audioBufferToBlob = (audioBuffer) => {
  return new Promise((resolve) => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length

    // Create WAV file
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)

    // WAV header
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

    // Audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7fff, true)
        offset += 2
      }
    }

    resolve(new Blob([arrayBuffer], { type: 'audio/wav' }))
  })
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedFile.value = file
    recordedBlob.value = null // Clear any recorded audio
    error.value = null
    transcriptionResult.value = null

    // Reset portfolio save state for new file
    portfolioSaved.value = false
    portfolioError.value = null

    console.log('File selected:', file.name, file.size, file.type)
  }
}

const handleFileDrop = (event) => {
  const files = event.dataTransfer.files
  if (files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('audio/')) {
      selectedFile.value = file
      recordedBlob.value = null
      error.value = null
      transcriptionResult.value = null

      // Reset portfolio save state for new file
      portfolioSaved.value = false
      portfolioError.value = null

      console.log('File dropped:', file.name, file.size, file.type)
    } else {
      error.value = { message: 'Please drop an audio file' }
    }
  }
}

// Video extraction methods
const handleVideoFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    selectedVideoFile.value = file
    extractedAudioBlob.value = null // Clear any previously extracted audio
    error.value = null
    console.log('Video file selected:', file.name, file.size, file.type)
  }
}

const handleVideoFileDrop = (event) => {
  const files = event.dataTransfer.files
  if (files.length > 0) {
    const file = files[0]
    if (file.type.startsWith('video/')) {
      selectedVideoFile.value = file
      extractedAudioBlob.value = null
      error.value = null
      console.log('Video file dropped:', file.name, file.size, file.type)
    } else {
      error.value = { message: 'Please drop a video file' }
    }
  }
}

const extractAudioFromVideo = async () => {
  if (!selectedVideoFile.value) {
    error.value = { message: 'Please select a video file first' }
    return
  }

  extractingAudio.value = true
  audioExtractionMessage.value = 'Uploading video and extracting audio...'
  error.value = null

  try {
    const instanceId = `norwegian-transcription-${Date.now()}`
    const formData = new FormData()
    formData.append('file', selectedVideoFile.value)

    console.log('🎬 Extracting audio from video:', {
      fileName: selectedVideoFile.value.name,
      size: selectedVideoFile.value.size,
      type: selectedVideoFile.value.type,
      instanceId,
      url: `${AUDIO_WORKER_BASE_URL}/upload/${instanceId}`
    })

    // For large files, show additional helpful message
    if (selectedVideoFile.value.size > 10 * 1024 * 1024) {
      // > 10MB
      audioExtractionMessage.value = `Uploading ${formatFileSize(selectedVideoFile.value.size)} video file... this may take a moment`
    }

    // Upload video to vegvisr-container for audio extraction with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('⏰ Request timeout after 120 seconds')
      controller.abort()
    }, 120000) // 120 second timeout for large files

    let result
    try {
      console.log('📤 Sending POST request...')
      const uploadResponse = await fetch(`${AUDIO_WORKER_BASE_URL}/upload/${instanceId}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('📡 Upload response received!')
      console.log('📡 Status:', uploadResponse.status, uploadResponse.statusText)
      console.log('📋 Response headers:', {
        contentType: uploadResponse.headers.get('content-type'),
        contentLength: uploadResponse.headers.get('content-length'),
        cors: uploadResponse.headers.get('access-control-allow-origin')
      })

      // Try to get response text regardless of status for debugging
      const responseText = await uploadResponse.text()
      console.log('📄 Response body:', responseText)

      if (!uploadResponse.ok) {
        console.error('❌ Upload failed with status:', uploadResponse.status)
        throw new Error(`Audio extraction failed: ${uploadResponse.status} - ${responseText}`)
      }

      // Parse the response as JSON
      console.log('📖 Parsing response as JSON...')
      result = JSON.parse(responseText)
      console.log('✅ Audio extraction result:', JSON.stringify(result, null, 2))
      console.log('📥 Download URL:', result.download_url)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out after 2 minutes - video file may be too large or network too slow. Try a smaller file (< 10MB) or use YouTube upload for larger videos.')
      }

      // Handle 503 and other fetch errors
      if (fetchError.message && fetchError.message.includes('503')) {
        throw new Error('Service temporarily unavailable (503). The video file may be too large for direct processing. Please try: 1) A smaller video file (< 10MB), or 2) Upload to YouTube first (YouTube worker handles large files better)')
      }

      throw new Error(`Failed to extract audio: ${fetchError.message}. Large files work better via YouTube upload.`)
    }

    if (!result || !result.success || !result.download_url) {
      throw new Error('Audio extraction failed: No download URL returned. Try a smaller video file.')
    }

    // Download the extracted audio
    audioExtractionMessage.value = 'Downloading extracted audio...'
    const audioResponse = await fetch(`${AUDIO_WORKER_BASE_URL}${result.download_url}`)

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    extractedAudioBlob.value = await audioResponse.blob()
    console.log('✅ Audio downloaded:', extractedAudioBlob.value.size, 'bytes')

    // Automatically set the extracted audio as the selected file for transcription
    selectedFile.value = new File(
      [extractedAudioBlob.value],
      selectedVideoFile.value.name.replace(/\.[^/.]+$/, '.mp3'),
      { type: 'audio/mpeg' }
    )

    // Clear recorded audio if any
    recordedBlob.value = null

    audioExtractionMessage.value = '✅ Audio extracted successfully!'
    setTimeout(() => {
      audioExtractionMessage.value = ''
    }, 3000)

  } catch (err) {
    console.error('Audio extraction error:', err)
    error.value = {
      message: 'Failed to extract audio from video',
      details: err.message
    }
  } finally {
    extractingAudio.value = false
  }
}

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)

    const chunks = []
    mediaRecorder.value.ondataavailable = (event) => {
      chunks.push(event.data)
    }

    mediaRecorder.value.onstop = () => {
      recordedBlob.value = new Blob(chunks, { type: 'audio/wav' })
      selectedFile.value = null // Clear any selected file
      error.value = null
      transcriptionResult.value = null

      // Reset portfolio save state for new recording
      portfolioSaved.value = false
      portfolioError.value = null

      stream.getTracks().forEach((track) => track.stop()) // Stop microphone
    }

    mediaRecorder.value.start()
    recording.value = true
    recordingDuration.value = 0

    // Start timer
    recordingTimer.value = setInterval(() => {
      recordingDuration.value++
    }, 1000)

    console.log('🎤 Recording started...')
  } catch (err) {
    console.error('Recording failed:', err)
    error.value = {
      message: 'Failed to start recording',
      details: err.message,
    }
  }
}

const stopRecording = () => {
  if (mediaRecorder.value && recording.value) {
    mediaRecorder.value.stop()
    recording.value = false

    if (recordingTimer.value) {
      clearInterval(recordingTimer.value)
      recordingTimer.value = null
    }

    console.log('🎤 Recording stopped')
  }
}

const checkHealth = async () => {
  healthLoading.value = true
  healthStatus.value = null

  try {
    console.log('🏥 Checking Norwegian worker health...')
    const response = await fetch(`${NORWEGIAN_WORKER_URL}/health`)

    if (response.ok) {
      const healthData = await response.json()
      healthStatus.value = {
        type: 'success',
        message: `✅ Norwegian Transcription Service is healthy`,
        details: JSON.stringify(healthData, null, 2),
      }
    } else {
      healthStatus.value = {
        type: 'error',
        message: `❌ Service returned ${response.status}: ${response.statusText}`,
      }
    }
  } catch (err) {
    console.error('Health check failed:', err)
    healthStatus.value = {
      type: 'error',
      message: `❌ Cannot reach Norwegian transcription service: ${err.message}`,
    }
  } finally {
    healthLoading.value = false
  }
}

// Check HuggingFace Inference Endpoint Status (GPU)
const checkEndpointStatus = async () => {
  checkingEndpoint.value = true
  endpointStatus.value = null

  try {
    console.log('🔍 Checking GPU endpoint status via worker API')

    const response = await fetch(`${NORWEGIAN_WORKER_URL}/hf-endpoint/status?type=gpu`)

    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status}`)
    }

    const result = await response.json()

    // Map worker response to UI status
    if (result.status === 'ready') {
      endpointStatus.value = {
        type: 'success',
        message: result.message,
        details: result.details
      }
    } else if (result.status === 'scaled_to_zero' || result.status === 'timeout') {
      endpointStatus.value = {
        type: 'warning',
        message: result.message,
        details: result.details
      }
    } else {
      endpointStatus.value = {
        type: 'info',
        message: result.message,
        details: result.details
      }
    }
  } catch (err) {
    endpointStatus.value = {
      type: 'error',
      message: `❌ Cannot check endpoint: ${err.message}`,
      details: 'Failed to communicate with worker API'
    }
  } finally {
    checkingEndpoint.value = false
  }
}

// Wake up endpoint and poll until ready (GPU)
const wakeUpAndWait = async () => {
  wakingUpEndpoint.value = true
  endpointStatus.value = null
  wakeUpProgress.value = 'Waking up GPU endpoint via worker...'

  try {
    console.log('⚡ Waking up GPU endpoint via worker API')

    const response = await fetch(`${NORWEGIAN_WORKER_URL}/hf-endpoint/wake?type=gpu`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      endpointStatus.value = {
        type: 'success',
        message: result.message,
        details: `Endpoint ready after ${result.attempts} attempts`
      }
    } else {
      endpointStatus.value = {
        type: 'error',
        message: result.message,
        details: `Failed after ${result.attempts} attempts`
      }
    }
  } catch (err) {
    endpointStatus.value = {
      type: 'error',
      message: `❌ Wake-up failed: ${err.message}`,
      details: 'Failed to communicate with worker API'
    }
  } finally {
    wakingUpEndpoint.value = false
    wakeUpProgress.value = ''
  }
}

// Check HuggingFace Inference Endpoint Status (CPU)
const checkEndpointStatusCPU = async () => {
  checkingEndpointCPU.value = true
  endpointStatusCPU.value = null

  try {
    console.log('🔍 Checking CPU endpoint status via worker API')

    const response = await fetch(`${NORWEGIAN_WORKER_URL}/hf-endpoint/status?type=cpu`)

    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status}`)
    }

    const result = await response.json()

    // Map worker response to UI status
    if (result.status === 'ready') {
      endpointStatusCPU.value = {
        type: 'success',
        message: result.message,
        details: result.details
      }
    } else if (result.status === 'scaled_to_zero' || result.status === 'timeout') {
      endpointStatusCPU.value = {
        type: 'warning',
        message: result.message,
        details: result.details
      }
    } else {
      endpointStatusCPU.value = {
        type: 'info',
        message: result.message,
        details: result.details
      }
    }
  } catch (err) {
    endpointStatusCPU.value = {
      type: 'error',
      message: `❌ Cannot check CPU endpoint: ${err.message}`,
      details: 'Failed to communicate with worker API'
    }
  } finally {
    checkingEndpointCPU.value = false
  }
}

// Wake up CPU endpoint and poll until ready
const wakeUpAndWaitCPU = async () => {
  wakingUpEndpointCPU.value = true
  endpointStatusCPU.value = null
  wakeUpProgressCPU.value = 'Waking up CPU endpoint via worker...'

  try {
    console.log('⚡ Waking up CPU endpoint via worker API')

    const response = await fetch(`${NORWEGIAN_WORKER_URL}/hf-endpoint/wake?type=cpu`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error(`Worker API error: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      endpointStatusCPU.value = {
        type: 'success',
        message: result.message,
        details: `Endpoint ready after ${result.attempts} attempts`
      }
    } else {
      endpointStatusCPU.value = {
        type: 'error',
        message: result.message,
        details: `Failed after ${result.attempts} attempts`
      }
    }
  } catch (err) {
    endpointStatusCPU.value = {
      type: 'error',
      message: `❌ Wake-up failed: ${err.message}`,
      details: 'Failed to communicate with worker API'
    }
  } finally {
    wakingUpEndpointCPU.value = false
    wakeUpProgressCPU.value = ''
  }
}

// Speaker Identification Functions
const loadPortfolioForSpeakers = async () => {
  if (!userStore.email) {
    speakersError.value = 'Please log in to access your audio portfolio'
    return
  }

  loadingPortfolio.value = true
  speakersError.value = null

  try {
    // Pass user role to backend for filtering (same as AudioPortfolio.vue)
    const userRole = (userStore.role === 'Superadmin' || userStore.role === 'Admin') ? 'superadmin' : 'user'

    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}&userRole=${userRole}`
    )

    if (!response.ok) {
      throw new Error(`Failed to load portfolio: ${response.statusText}`)
    }

    const data = await response.json()
    portfolioRecordings.value = data.recordings || []
    console.log('📼 Loaded portfolio recordings:', portfolioRecordings.value.length)
  } catch (err) {
    console.error('Error loading portfolio:', err)
    speakersError.value = err.message
  } finally {
    loadingPortfolio.value = false
  }
}

const selectRecording = (recording) => {
  selectedRecordingId.value = recording.id
  selectedRecording.value = recording
  speakerTimeline.value = []
  currentTimestamp.value = { start: 0, end: 0 }
  speakersSaved.value = false
  speakersError.value = null

  // Load existing speaker timeline if available
  if (recording.speakerTimeline) {
    speakerTimeline.value = recording.speakerTimeline
  }

  // Load speaker configuration if available
  if (recording.numSpeakers) {
    numSpeakers.value = recording.numSpeakers
  }
  if (recording.speakerNames) {
    speakerNames.value = recording.speakerNames
  }

  console.log('Selected recording:', recording.displayName || recording.fileName)
}

const updateCurrentTime = (event) => {
  currentAudioTime.value = event.target.currentTime
}

const useCurrentTime = (type) => {
  if (type === 'start') {
    currentTimestamp.value.start = Math.round(currentAudioTime.value * 10) / 10
  } else {
    currentTimestamp.value.end = Math.round(currentAudioTime.value * 10) / 10
  }
}

const addTimestamp = () => {
  if (currentTimestamp.value.start >= currentTimestamp.value.end) {
    speakersError.value = 'End time must be greater than start time'
    return
  }

  const speakerName = speakerNames.value[currentSpeakerIndex.value] || `Speaker ${currentSpeakerIndex.value + 1}`

  speakerTimeline.value.push({
    speaker: currentSpeakerIndex.value,
    speakerName: speakerName,
    start: currentTimestamp.value.start,
    end: currentTimestamp.value.end,
    text: '' // Could be filled in later
  })

  // Reset for next entry
  currentTimestamp.value = { start: currentTimestamp.value.end, end: currentTimestamp.value.end + 10 }
  speakersError.value = null

  console.log('Added timestamp:', speakerName, currentTimestamp.value)
}

const removeTimestamp = (index) => {
  speakerTimeline.value.splice(index, 1)
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const formatDuration = (seconds) => {
  if (!seconds) return 'Unknown'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const saveSpeakerTimeline = async () => {
  if (!selectedRecording.value) return

  savingSpeakers.value = true
  speakersError.value = null

  try {
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/update-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify({
          id: selectedRecording.value.id,
          updates: {
            speakerTimeline: speakerTimeline.value,
            numSpeakers: numSpeakers.value,
            speakerNames: speakerNames.value,
          }
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save: ${response.status}`)
    }

    speakersSaved.value = true
    console.log('✅ Speaker timeline saved successfully')

    // Refresh the recording data
    await loadPortfolioForSpeakers()
  } catch (err) {
    console.error('Failed to save speaker timeline:', err)
    speakersError.value = err.message
  } finally {
    savingSpeakers.value = false
  }
}

const identifySpeakersWithAI = async () => {
  if (!selectedRecording.value || speakerTimeline.value.length === 0) {
    aiError.value = 'Please add speaker timestamps first'
    return
  }

  identifyingAI.value = true
  aiError.value = null
  aiIdentification.value = null

  try {
    console.log('🤖 Calling AI to identify speakers...')

    const response = await fetch(`${NORWEGIAN_WORKER_URL}/identify-speakers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcriptionText: selectedRecording.value.transcriptionText || '',
        speakerTimeline: speakerTimeline.value,
        numSpeakers: numSpeakers.value,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `AI identification failed: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ AI identification result:', result)

    aiIdentification.value = result.identifications

    // If there's a rawResponse instead of speakers array, show it
    if (!aiIdentification.value.speakers || aiIdentification.value.speakers.length === 0) {
      if (aiIdentification.value.rawResponse) {
        aiError.value = 'AI response received but could not be parsed. Check console for details.'
        console.log('Raw AI response:', aiIdentification.value.rawResponse)
      }
    }
  } catch (err) {
    console.error('AI speaker identification error:', err)
    aiError.value = err.message
  } finally {
    identifyingAI.value = false
  }
}

const applySuggestedName = (speakerIndex, suggestedName) => {
  if (speakerIndex >= 0 && speakerIndex < speakerNames.value.length) {
    speakerNames.value[speakerIndex] = suggestedName

    // Update existing timeline segments with the new name
    speakerTimeline.value.forEach(segment => {
      if (segment.speaker === speakerIndex) {
        segment.speakerName = suggestedName
      }
    })

    console.log(`✅ Applied suggested name: ${suggestedName} for Speaker ${speakerIndex + 1}`)
  }
}

// ========== AUTOMATED SPEAKER DIARIZATION FUNCTIONS ==========

const useTranscriptionForDiarization = () => {
  if (!transcriptionResult.value || !transcriptionResult.value.r2Url) {
    diarizationError.value = 'No transcription result available'
    return
  }

  // Create a recording object from transcription result
  selectedDiarizationRecording.value = {
    id: 'transcription-current',
    fileName: transcriptionResult.value.fileName || 'Current Transcription',
    displayName: transcriptionResult.value.fileName || 'Current Transcription',
    r2Url: transcriptionResult.value.r2Url,
    duration: transcriptionResult.value.duration,
    timestamp: new Date().toISOString()
  }

  selectedDiarizationId.value = 'transcription-current'
  diarizationResult.value = null
  diarizationError.value = null
  diarizationSaved.value = false

  console.log('🎧 Using transcription audio for diarization:', transcriptionResult.value.r2Url)
}

const useThisAudioForTranscription = async () => {
  if (!selectedDiarizationRecording.value || !selectedDiarizationRecording.value.r2Url) {
    error.value = { message: 'No audio selected for diarization' }
    return
  }

  try {
    // Fetch the audio from the R2 URL
    const response = await fetch(selectedDiarizationRecording.value.r2Url)
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.statusText}`)
    }

    const blob = await response.blob()

    // Create a File object from the blob
    const fileName = selectedDiarizationRecording.value.fileName ||
                     selectedDiarizationRecording.value.displayName ||
                     'portfolio-audio.wav'
    const file = new File([blob], fileName, { type: blob.type || 'audio/wav' })

    selectedFile.value = file
    recordedBlob.value = null // Clear any recorded audio

    // Cleanup old preview URL if exists
    if (audioPreviewUrl.value) {
      URL.revokeObjectURL(audioPreviewUrl.value)
    }

    // Scroll to transcription section
    setTimeout(() => {
      const transcriptionSection = document.querySelector('.save-audio-only-section')
      if (transcriptionSection) {
        transcriptionSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)

    statusMessage.value = `✅ Ready to transcribe: ${fileName}`
    setTimeout(() => { statusMessage.value = '' }, 5000)

    console.log('🇳🇴 Audio ready for transcription:', fileName, blob.size, 'bytes')
  } catch (err) {
    console.error('❌ Failed to load audio for transcription:', err)
    error.value = { message: `Failed to load audio: ${err.message}` }
  }
}

const loadPortfolioForDiarization = async () => {
  if (!userStore.email) {
    diarizationError.value = 'Please log in to access your audio portfolio'
    return
  }

  loadingDiarizationPortfolio.value = true
  diarizationError.value = null

  try {
    // Pass user role to backend for filtering (same as AudioPortfolio.vue)
    const userRole = (userStore.role === 'Superadmin' || userStore.role === 'Admin') ? 'superadmin' : 'user'

    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}&userRole=${userRole}`
    )

    if (!response.ok) {
      throw new Error(`Failed to load portfolio: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('🔍 API Response:', data)
    console.log('🔍 Full API response JSON:', JSON.stringify(data, null, 2))
    console.log('🔍 Recordings in response:', data.recordings?.length || 0)
    console.log('🔍 User email used:', userStore.email)
    console.log('🔍 User role used:', userRole)
    diarizationRecordings.value = data.recordings || []
    console.log('📼 Loaded portfolio for diarization:', diarizationRecordings.value.length, 'recordings')

    // Debug: Check which recordings have analysis
    diarizationRecordings.value.forEach(rec => {
      if (rec.conversationAnalysis) {
        console.log('🤖 Recording has analysis:', rec.displayName || rec.fileName, rec.conversationAnalysis)
      }
    })
  } catch (err) {
    console.error('Error loading portfolio:', err)
    diarizationError.value = `Failed to load portfolio: ${err.message}`
  } finally {
    loadingDiarizationPortfolio.value = false
  }
}

const selectDiarizationRecording = (recording) => {
  selectedDiarizationId.value = recording.recordingId
  selectedDiarizationRecording.value = recording
  diarizationError.value = null
  diarizationSaved.value = false

  // Load existing diarization if available
  if (recording.diarization && recording.diarization.segments) {
    // Calculate duration from segments if not stored
    const calculatedDuration = recording.diarization.duration ||
      Math.max(...recording.diarization.segments.map(s => s.end))

    diarizationResult.value = {
      segments: recording.diarization.segments,
      numSpeakers: recording.diarization.numSpeakers,
      duration: calculatedDuration,
      metadata: recording.diarization.metadata || {}
    }
    speakerLabels.value = recording.diarization.speakerLabels || {}
    blankSpeakerNames.value = recording.diarization.blankSpeakerNames || {}
    diarizationSaved.value = true // Already saved
    console.log('✅ Loaded existing diarization:', recording.diarization.segments.length, 'segments')
    console.log('⏱️ Duration:', calculatedDuration.toFixed(2), 'seconds')

    // Debug: Check segment structure - ALWAYS RUN
    const segLen = recording.diarization.segments.length
    console.log('🔍 Segment array length:', segLen)
    const firstSegment = recording.diarization.segments[0]
    const lastSegment = recording.diarization.segments[segLen - 1]
    console.log('🔍 First segment:', JSON.stringify(firstSegment))
    console.log('🔍 Last segment:', JSON.stringify(lastSegment))
    const chunks = new Set(recording.diarization.segments.map(s => s.chunk ?? s.chunkIndex).filter(c => c !== undefined))
    console.log('🔍 Chunks found:', Array.from(chunks))

    if (Object.keys(blankSpeakerNames.value).length > 0) {
      console.log('🏷️ Loaded BLANK_SPEAKER mappings:', blankSpeakerNames.value)
    }
  } else {
    diarizationResult.value = null
    speakerLabels.value = {}
    blankSpeakerNames.value = {}
    console.log('🎧 Selected recording for diarization:', recording.recordingId, recording.displayName || recording.fileName)
  }
}

const analyzeSpeakerDiarization = async () => {
  if (!selectedDiarizationRecording.value || !selectedDiarizationRecording.value.r2Url) {
    diarizationError.value = 'No recording selected or URL missing'
    return
  }

  analyzingDiarization.value = true
  diarizationError.value = null
  diarizationResult.value = null
  diarizationProgress.value = 'Preparing audio for analysis...'

  try {
    console.log('🎯 Starting diarization analysis:', selectedDiarizationRecording.value.r2Url)

    const recording = selectedDiarizationRecording.value
    const duration = recording.duration || 0
    const fileSizeMB = recording.fileSize ? recording.fileSize / 1024 / 1024 : 0

    console.log('📊 File info:', {
      duration: `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`,
      durationSeconds: duration,
      fileSizeMB: fileSizeMB.toFixed(2),
      fileName: recording.fileName
    })

    // Check if file needs chunking for diarization
    // More conservative than transcription due to inference endpoint timeout limits
    // Use chunking if: duration unknown OR >15 min OR >20 MB
    const needsChunking = duration === 0 || duration > 15 * 60 || fileSizeMB > 20

    console.log('🔍 Chunking decision:', {
      needsChunking,
      durationCheck: duration > 15 * 60,
      sizeCheck: fileSizeMB > 20,
      durationUnknown: duration === 0,
      threshold: '15 min OR 20 MB (or unknown duration)'
    })

    if (needsChunking) {
      console.log('⚠️ Large file detected - using chunking approach:', {
        duration: `${Math.floor(duration / 60)}:${Math.floor(duration % 60)}`,
        sizeMB: fileSizeMB.toFixed(2)
      })

      // Use chunking approach (dynamic import to avoid loading if not needed)
      const { diarizeWithChunkingFromUrl } = await import('@/utils/audioChunker')

      const allSegments = await diarizeWithChunkingFromUrl(recording.r2Url, {
        chunkDuration: 5 * 60, // 5 minutes per chunk (smaller for high-quality audio)
        totalDuration: duration,
        workerUrl: NORWEGIAN_WORKER_URL,
        onProgress: (progress) => {
          diarizationProgress.value = `Processing chunk ${progress.current} of ${progress.total} (${progress.percent}%)...`
          console.log(`📊 Chunking progress: ${progress.current}/${progress.total}`)
        }
      })

      console.log('✅ Chunked diarization complete:', allSegments.length, 'segments')

      // Process results
      const speakers = [...new Set(allSegments.map(s => s.speaker))]
      diarizationResult.value = {
        segments: allSegments,
        numSpeakers: speakers.length,
        duration,
        metadata: {
          processedAt: new Date().toISOString(),
          chunked: true,
          service: 'Hugging Face Speaker Diarization (Chunked)'
        }
      }

      // Initialize speaker labels
      const labels = {}
      speakers.forEach(speaker => {
        labels[speaker] = speaker
      })
      speakerLabels.value = labels

    } else {
      console.log('✅ File size OK - using direct diarization')
      diarizationProgress.value = 'Sending audio to AI diarization service...'

      const response = await fetch(`${NORWEGIAN_WORKER_URL}/diarize-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: recording.r2Url
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Diarization failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success || !result.segments) {
        throw new Error('Invalid diarization response')
      }

      console.log('✅ Diarization complete:', result.segments.length, 'segments')

      // Process the results
      const segments = result.segments
      const speakers = [...new Set(segments.map(s => s.speaker))]

      diarizationResult.value = {
        segments,
        numSpeakers: speakers.length,
        duration: duration || Math.max(...segments.map(s => s.end)),
        metadata: result.metadata || {}
      }

      // Initialize speaker labels
      const labels = {}
      speakers.forEach(speaker => {
        labels[speaker] = speaker // Default label is the speaker ID
      })
      speakerLabels.value = labels
    }

    diarizationProgress.value = ''

  } catch (err) {
    console.error('Diarization error:', err)
    diarizationError.value = err.message
    diarizationProgress.value = ''
  } finally {
    analyzingDiarization.value = false
  }
}

const updateDiarizationTime = (event) => {
  const currentTime = event.target.currentTime
  currentDiarizationTime.value = currentTime

  if (!diarizationResult.value?.segments || !segmentsContainer.value || segmentRefs.value.length === 0) {
    return
  }

  const segments = diarizationResult.value.segments
  const activeIndex = segments.findIndex(s => currentTime >= s.start && currentTime < s.end)

  if (activeIndex !== -1) {
    const activeElement = segmentRefs.value[activeIndex]
    if (activeElement) {
      const containerTop = segmentsContainer.value.offsetTop
      const elementTop = activeElement.offsetTop
      const relativeTop = elementTop - containerTop

      segmentsContainer.value.scrollTo({
        top: relativeTop,
        behavior: 'smooth'
      })
    }
  }
}

const getSpeakerColor = (speaker) => {
  // Generate consistent colors for speakers
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ]
  const speakerIndex = parseInt(speaker.replace('SPEAKER_', '')) || 0
  return colors[speakerIndex % colors.length]
}

// Get effective speaker color considering BLANK_SPEAKER mappings
const getEffectiveSpeakerColor = (segment) => {
  // If segment has BLANK_SPEAKER mapping, use that for color
  if (segment.blankSpeaker) {
    return getBlankTagColor(segment.blankSpeaker)
  }
  // Otherwise use original speaker color
  return getSpeakerColor(segment.speaker)
}

const updateSpeakerLabel = (speaker) => {
  console.log('🏷️ Updated label for', speaker, ':', speakerLabels.value[speaker])
  console.log('🏷️ All speaker labels now:', speakerLabels.value)
  console.log('🏷️ canRunSmartIdentify should update...')
}

const isSegmentActive = (segment) => {
  return currentDiarizationTime.value >= segment.start && currentDiarizationTime.value <= segment.end
}

const seekToSegment = (time) => {
  if (diarizationAudioPlayer.value) {
    diarizationAudioPlayer.value.currentTime = time
    diarizationAudioPlayer.value.play()
  }
}

const saveDiarizationResult = async () => {
  if (!diarizationResult.value || !selectedDiarizationRecording.value) {
    console.error('❌ Missing data:', {
      hasDiarizationResult: !!diarizationResult.value,
      hasSelectedRecording: !!selectedDiarizationRecording.value
    })
    return
  }

  savingDiarization.value = true
  diarizationSaveError.value = null
  diarizationSaved.value = false

  try {
    const requestBody = {
      id: selectedDiarizationRecording.value.recordingId,
      updates: {
        diarization: {
          segments: diarizationResult.value.segments,
          speakerLabels: speakerLabels.value,
          blankSpeakerNames: blankSpeakerNames.value, // Save BLANK_SPEAKER mappings
          numSpeakers: diarizationResult.value.numSpeakers,
          duration: diarizationResult.value.duration, // Save duration for timeline
          metadata: diarizationResult.value.metadata,
          analyzedAt: new Date().toISOString()
        }
      }
    }

    console.log('💾 Saving diarization with:', {
      userEmail: userStore.email,
      recordingId: selectedDiarizationRecording.value.recordingId,
      recordingTitle: selectedDiarizationRecording.value.displayName,
      numSegments: diarizationResult.value.segments.length,
      requestBody
    })

    // Save diarization data to the recording using update-recording endpoint
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/update-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save: ${response.status}`)
    }

    diarizationSaved.value = true
    console.log('💾 Diarization saved successfully')

    // Refresh the portfolio data
    await loadPortfolioForDiarization()

    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      diarizationSaved.value = false
    }, 3000)

  } catch (err) {
    console.error('Error saving diarization:', err)
    diarizationSaveError.value = err.message
  } finally {
    savingDiarization.value = false
  }
}

// ========== SPEAKER MAPPING FUNCTIONS (Cross-Chunk) ==========

// Computed: Check if we have segments from multiple chunks
const hasMultipleChunks = computed(() => {
  if (!diarizationResult.value?.segments) return false
  // Check both 'chunk' and 'chunkIndex' for backward compatibility
  const chunks = new Set(diarizationResult.value.segments.map(s => s.chunk ?? s.chunkIndex).filter(c => c !== undefined))
  return chunks.size > 1
})

// Computed: Available BLANK_SPEAKER tags
const availableBlankTags = computed(() => {
  const tags = Object.keys(blankSpeakerNames.value)
  if (tags.length === 0) {
    return ['BLANK_SPEAKER_A'] // Show first tag by default
  }
  return tags
})

// Get color for BLANK_SPEAKER tag
const getBlankTagColor = (tag) => {
  const colors = {
    'BLANK_SPEAKER_A': '#3B82F6',
    'BLANK_SPEAKER_B': '#10B981',
    'BLANK_SPEAKER_C': '#F59E0B',
    'BLANK_SPEAKER_D': '#EF4444',
    'BLANK_SPEAKER_E': '#8B5CF6',
    'BLANK_SPEAKER_F': '#EC4899',
  }
  return colors[tag] || '#64748b'
}

// Select a BLANK_SPEAKER tag to use for mapping
const selectBlankTag = (tag) => {
  selectedBlankTag.value = tag
  // Initialize the tag if it doesn't exist
  if (!blankSpeakerNames.value[tag]) {
    blankSpeakerNames.value[tag] = tag
  }
}

// Add a new BLANK_SPEAKER tag
const addNewBlankTag = () => {
  const letter = nextBlankTagLetter.value
  const newTag = `BLANK_SPEAKER_${letter}`
  blankSpeakerNames.value[newTag] = newTag
  selectedBlankTag.value = newTag

  // Increment letter (A -> B -> C, etc.)
  nextBlankTagLetter.value = String.fromCharCode(letter.charCodeAt(0) + 1)
  console.log('✅ Added new BLANK_SPEAKER tag:', newTag)
}

// Remove a BLANK_SPEAKER tag
const removeBlankTag = (tag) => {
  // Remove tag from names
  delete blankSpeakerNames.value[tag]

  // Remove assignments from segments
  if (diarizationResult.value?.segments) {
    diarizationResult.value.segments.forEach(segment => {
      if (segment.blankSpeaker === tag) {
        delete segment.blankSpeaker
      }
    })
  }

  // Deselect if it was selected
  if (selectedBlankTag.value === tag) {
    selectedBlankTag.value = null
  }

  console.log('🗑️ Removed BLANK_SPEAKER tag:', tag)
}

// Assign a segment to the currently selected BLANK_SPEAKER
const assignBlankSpeaker = (segmentIndex) => {
  if (!selectedBlankTag.value || !diarizationResult.value?.segments[segmentIndex]) {
    return
  }

  const segment = diarizationResult.value.segments[segmentIndex]

  // Toggle: if already assigned to this tag, remove it
  if (segment.blankSpeaker === selectedBlankTag.value) {
    delete segment.blankSpeaker
    console.log('🔄 Removed BLANK_SPEAKER from segment:', segmentIndex)
  } else {
    segment.blankSpeaker = selectedBlankTag.value
    console.log('✅ Assigned segment', segmentIndex, 'to', selectedBlankTag.value, {
      originalSpeaker: segment.speaker,
      chunk: segment.chunk ?? segment.chunkIndex,
      time: `${formatTime(segment.start)} - ${formatTime(segment.end)}`
    })
  }
}

// Update the name for a BLANK_SPEAKER tag
const updateBlankSpeakerName = (tag) => {
  console.log('🏷️ Updated name for', tag, ':', blankSpeakerNames.value[tag])
}

// Get the display name for a segment (considering BLANK_SPEAKER mapping)
const getDisplaySpeakerName = (segment, segmentIndex = null) => {
  // Priority: per-segment custom label > blankSpeaker name > speakerLabel > original speaker
  if (segmentIndex !== null && customSegmentLabels.value[segmentIndex]) {
    return customSegmentLabels.value[segmentIndex]
  }
  if (segment.blankSpeaker) {
    return blankSpeakerNames.value[segment.blankSpeaker] || segment.blankSpeaker
  }
  return speakerLabels.value[segment.speaker] || segment.speaker
}

// ========== SMART MENTOR IDENTIFICATION ==========

// State for AI suggestions
const aiSuggestions = ref([])
const analyzingSpeaker = ref(false)

// Check if we have enough labeled segments for pattern analysis
const canRunSmartIdentify = computed(() => {
  if (!diarizationResult.value?.segments) {
    console.log('🚫 canRunSmartIdentify: No segments')
    return false
  }

  // Check if we have any custom labels (not SPEAKER_XX format)
  const labels = Object.values(speakerLabels.value)
  const hasCustomLabels = labels.some(label =>
    label && label !== label.toUpperCase() && !label.startsWith('SPEAKER_')
  )

  console.log('🔍 canRunSmartIdentify check:', {
    totalLabels: labels.length,
    labels: speakerLabels.value,
    hasCustomLabels,
    customLabelsFound: labels.filter(label => label && label !== label.toUpperCase() && !label.startsWith('SPEAKER_'))
  })

  return hasCustomLabels
})

// Smart identify: Find segments matching a labeled speaker's patterns
const smartIdentifySpeaker = async (targetSpeakerName) => {
  if (!diarizationResult.value?.segments || !selectedDiarizationRecording.value) {
    return
  }

  analyzingSpeaker.value = true
  aiSuggestions.value = []

  try {
    // Find segments already labeled with this speaker name
    const labeledSegments = diarizationResult.value.segments.filter((seg, idx) => {
      const displayName = getDisplaySpeakerName(seg, idx)
      return displayName === targetSpeakerName
    })

    if (labeledSegments.length < 3) {
      console.log('❌ Need at least 3 labeled segments for pattern analysis')
      analyzingSpeaker.value = false
      return
    }

    console.log(`🤖 Analyzing patterns for "${targetSpeakerName}" from ${labeledSegments.length} labeled segments`)

    // Analyze patterns from labeled segments
    const patterns = {
      avgDuration: labeledSegments.reduce((sum, s) => sum + (s.end - s.start), 0) / labeledSegments.length,
      minDuration: Math.min(...labeledSegments.map(s => s.end - s.start)),
      maxDuration: Math.max(...labeledSegments.map(s => s.end - s.start)),
      positions: labeledSegments.map(s => s.start),
      isFirstSpeaker: labeledSegments.some(s => s.start < 30), // Speaks in first 30 seconds
      isLastSpeaker: labeledSegments.some(s => {
        const maxTime = Math.max(...diarizationResult.value.segments.map(seg => seg.end))
        return s.end > maxTime - 30 // Speaks in last 30 seconds
      }),
      totalDuration: labeledSegments.reduce((sum, s) => sum + (s.end - s.start), 0),
      frequency: labeledSegments.length, // How many times they speak
    }

    console.log('📊 Speaker patterns:', patterns)

    // Find candidate segments (unlabeled segments that match the pattern)
    const candidates = []
    diarizationResult.value.segments.forEach((segment, index) => {
      // Skip segments that are already labeled with this name
      const currentLabel = getDisplaySpeakerName(segment, index)
      if (currentLabel === targetSpeakerName) {
        return
      }

      // Calculate confidence based on pattern matching (NOT speaker ID matching)
      let confidence = 0.3 // Base confidence
      const duration = segment.end - segment.start

      // Strong bonus for similar duration (mentors often speak for similar lengths)
      const durationDiff = Math.abs(duration - patterns.avgDuration)
      if (durationDiff < patterns.avgDuration * 0.3) {
        confidence += 0.25 // Very similar duration
      } else if (durationDiff < patterns.avgDuration * 0.5) {
        confidence += 0.15 // Somewhat similar
      }

      // Bonus for position patterns (mentors often speak first/last)
      if (patterns.isFirstSpeaker && segment.start < 60) {
        confidence += 0.2 // Speaks early like mentor
      }
      if (patterns.isLastSpeaker) {
        const maxTime = Math.max(...diarizationResult.value.segments.map(s => s.end))
        if (segment.end > maxTime - 60) {
          confidence += 0.2 // Speaks late like mentor
        }
      }

      // Only suggest if confidence is reasonable
      if (confidence >= 0.5) {
        let reason = 'Similar speaking pattern'
        if (durationDiff < patterns.avgDuration * 0.3) {
          reason = `Similar duration (~${Math.round(duration)}s, mentor avg: ${Math.round(patterns.avgDuration)}s)`
        }

        candidates.push({
          segmentIndex: index,
          segment: segment,
          confidence: Math.min(confidence, 0.95), // Cap at 95%
          reason: reason
        })
      }
    })

    // Sort by confidence
    aiSuggestions.value = candidates.sort((a, b) => b.confidence - a.confidence)

    console.log(`✨ Found ${aiSuggestions.value.length} suggestions for "${targetSpeakerName}"`)

  } catch (err) {
    console.error('Error in smart identify:', err)
  } finally {
    analyzingSpeaker.value = false
  }
}

// Apply a suggestion (label the segment)
// Apply a suggestion (label the specific segment, not all segments with that speaker ID)
const applySuggestion = (suggestion, speakerName) => {
  // Use per-segment labeling for cross-chunk identification
  customSegmentLabels.value[suggestion.segmentIndex] = speakerName

  // Remove from suggestions
  aiSuggestions.value = aiSuggestions.value.filter(s => s.segmentIndex !== suggestion.segmentIndex)

  console.log(`✅ Applied suggestion: Segment ${suggestion.segmentIndex} (${formatTime(suggestion.segment.start)}) → "${speakerName}"`)
}

// Apply all high-confidence suggestions (>70%)
const applyAllHighConfidence = (speakerName) => {
  const highConfidence = aiSuggestions.value.filter(s => s.confidence > 0.7)

  highConfidence.forEach(suggestion => {
    customSegmentLabels.value[suggestion.segmentIndex] = speakerName
  })

  // Remove applied suggestions
  aiSuggestions.value = aiSuggestions.value.filter(s => s.confidence <= 0.7)

  console.log(`✅ Applied ${highConfidence.length} high-confidence suggestions for "${speakerName}"`)
}

// Clear suggestions
const clearSuggestions = () => {
  aiSuggestions.value = []
}

// ========== END DIARIZATION FUNCTIONS ==========

const transcribeAudio = async () => {
  if (!selectedFile.value && !recordedBlob.value) {
    error.value = { message: 'Please select an audio file or record audio first' }
    return
  }

  transcribing.value = true
  error.value = null
  transcriptionResult.value = null

  // Reset portfolio save state for new transcription
  portfolioSaved.value = false
  portfolioError.value = null

  resetChunkedState()

  const audioBlob = selectedFile.value || recordedBlob.value
  const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

  try {
    console.log('🇳🇴 Starting Norwegian transcription analysis:', {
      fileName,
      size: audioBlob.size,
      type: audioBlob.type,
    })

    // Check audio duration to determine if chunking is needed
    loadingMessage.value = 'Analyzing audio file...'
    const audioDuration = await getAudioDuration(audioBlob)
    const CHUNK_THRESHOLD = 120 // 2 minutes

    console.log(`📊 Audio duration: ${Math.round(audioDuration)}s (${formatTime(audioDuration)})`)

    if (audioDuration > CHUNK_THRESHOLD) {
      // Use chunked processing for files > 2 minutes
      await processAudioInChunks(audioBlob, fileName, audioDuration)
    } else {
      // Use single file processing for smaller files
      await processSingleAudioFile(audioBlob, fileName)
    }
  } catch (err) {
    console.error('Norwegian transcription error:', err)
    error.value = {
      message: 'Norwegian transcription failed',
      details: err.message,
    }
  } finally {
    transcribing.value = false
    loadingMessage.value = ''
    isChunkedProcessing.value = false
  }
}

const processSingleAudioFile = async (audioBlob, fileName) => {
  loadingMessage.value = `🚀 Starting Norwegian transcription...`

  console.log('📄 Processing single file with Norwegian model')

  const formData = new FormData()
  formData.append('audio', audioBlob, fileName)
  formData.append('endpoint', selectedEndpoint.value) // Add endpoint selection

  if (transcriptionContext.value.trim()) {
    formData.append('context', transcriptionContext.value.trim())
  }

  // Track processing time
  const startTime = Date.now()

  // Progressive messaging based on processing time
  const processingTimer = setTimeout(() => {
    loadingMessage.value = "⚙️ Processing with Norwegian Whisper (GPU/CPU)..."
  }, 10000)

  // If taking longer than normal, suggest possible cold start
  const coldStartTimer = setTimeout(() => {
    loadingMessage.value = "⏳ Model warming up (GPU) - first request may take 3-4 minutes..."
  }, 60000) // Only after 1 minute

  // Extended processing message
  const extendedTimer = setTimeout(() => {
    loadingMessage.value = "🔥 GPU model warming up - saves ~80% on infrastructure costs..."
  }, 120000) // After 2 minutes

  try {
    const transcribeResponse = await fetch(NORWEGIAN_WORKER_URL, {
      method: 'POST',
      body: formData,
    })

    // Clear all timers on completion
    clearTimeout(processingTimer)
    clearTimeout(coldStartTimer)
    clearTimeout(extendedTimer)

    const processingTime = Math.round((Date.now() - startTime) / 1000)

    if (!transcribeResponse.ok) {
      throw new Error(
        `Transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}`,
      )
    }

    const result = await transcribeResponse.json()
    console.log('✅ Single file transcription result:', result)

    // Determine which model was used
    const modelUsed = result.metadata?.model || 'nb-whisper-small'
    const isGPU = result.metadata?.gpu_used === true || modelUsed.includes('large')
    const modelType = isGPU ? 'GPU' : 'CPU'

    // Update completion message with model info
    loadingMessage.value = `✅ Completed in ${processingTime}s (${modelType} - ${modelUsed})`

    // Check if cold start was detected by the backend
    if (result.metadata?.coldStartDetected) {
      console.log('🔥 Cold start was detected during transcription (503 received)')
      loadingMessage.value = `✅ Completed after GPU warm-up in ${processingTime}s`
    }

    transcriptionResult.value = {
      success: true,
      transcription: {
        raw_text: result.transcription?.raw_text || result.transcription?.text || result.text,
        improved_text: result.transcription?.improved_text,
        language: result.transcription?.language || 'no',
        chunks: result.transcription?.chunks || 1,
        processing_time: result.transcription?.processing_time || 0,
        improvement_time: result.transcription?.improvement_time || 0,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        filename: fileName,
        model: result.metadata?.model || 'nb-whisper-small',
        total_processing_time: result.metadata?.total_processing_time || 0,
        transcription_server: 'Worker Orchestration (Hetzner + Cloudflare AI)',
        text_improvement: result.metadata?.text_improvement || 'Cloudflare Workers AI',
        cloudflare_ai_available: !!result.transcription?.improved_text,
        coldStartDetected: result.metadata?.coldStartDetected || false,
      },
    }
  } catch (error) {
    // Clear all timers on error
    clearTimeout(processingTimer)
    clearTimeout(coldStartTimer)
    clearTimeout(extendedTimer)

    throw error
  }
}

const processAudioInChunks = async (audioBlob, fileName, audioDuration) => {
  loadingMessage.value = '📊 Analyzing audio file...'
  isChunkedProcessing.value = true

  console.log('🧩 Processing in chunks - splitting audio...')

  // Split audio into 2-minute chunks with progress callback
  const chunks = await splitAudioIntoChunks(audioBlob, 120, (progress) => {
    if (progress.phase === 'info') {
      loadingMessage.value = `📊 Audio: ${progress.numChunks} chunks needed (${progress.sampleRate}Hz)`
    } else if (progress.phase === 'creating') {
      loadingMessage.value = `🎵 Creating chunk ${progress.current}/${progress.total}...`
    }
  })

  totalChunks.value = chunks.length

  console.log(`📊 Split into ${chunks.length} chunks of ~2 minutes each`)

  // Process each chunk sequentially
  for (let i = 0; i < chunks.length; i++) {
    if (processingAborted.value) {
      console.log('🛑 Processing aborted by user')
      break
    }

    currentChunk.value = i + 1

    // Determine which model endpoint will be used (CPU or GPU based on availability)
    const modelType = i === 0 ? 'CPU/GPU' : 'CPU/GPU' // Worker decides dynamically
    loadingMessage.value = `🚀 Processing chunk ${i + 1}/${chunks.length} (${modelType}) (${formatTime(chunks[i].startTime)} - ${formatTime(chunks[i].endTime)})...`

    // Simple processing timer for chunks
    const chunkProcessingTimer = setTimeout(() => {
      loadingMessage.value = `⚙️ Processing chunk ${i + 1}/${chunks.length} with Norwegian Whisper...`
    }, 10000)

    try {
      const chunkStart = performance.now()

      // Validate chunk before processing
      if (!chunks[i].blob || chunks[i].blob.size === 0) {
        throw new Error(`Chunk ${i + 1} is empty or invalid`)
      }

      console.log(`🎯 Processing chunk ${i + 1}: ${chunks[i].blob.size} bytes, ${chunks[i].blob.type}`)

      // Process this chunk
      const formData = new FormData()
      formData.append('audio', chunks[i].blob, `${fileName}_chunk_${i + 1}.wav`)
      formData.append('endpoint', selectedEndpoint.value) // Add endpoint selection

      if (transcriptionContext.value.trim()) {
        formData.append('context', transcriptionContext.value.trim())
      }

      const transcribeResponse = await fetch(NORWEGIAN_WORKER_URL, {
        method: 'POST',
        body: formData,
      })

      console.log(`📡 Chunk ${i + 1} request sent, response status: ${transcribeResponse.status}`)

      // Handle response errors (read body only once)
      if (!transcribeResponse.ok) {
        let errorText = ''
        try {
          errorText = await transcribeResponse.text()
        } catch (readError) {
          errorText = `Failed to read error response: ${readError.message}`
        }

        console.error(`❌ Chunk ${i + 1} error response:`, {
          status: transcribeResponse.status,
          statusText: transcribeResponse.statusText,
          error: errorText
        })

        throw new Error(`Chunk ${i + 1} failed: ${transcribeResponse.status} - ${errorText}`)
      }

      const result = await transcribeResponse.json()
      const chunkProcessingTime = Math.round((performance.now() - chunkStart) / 1000)

      // Clear processing timer on success
      clearTimeout(chunkProcessingTimer)

      // Determine which model was used for this chunk
      const modelUsed = result.metadata?.model || 'nb-whisper-small'
      const isGPU = result.metadata?.gpu_used === true || modelUsed.includes('large')
      const modelType = isGPU ? 'GPU' : 'CPU'

      console.log(
        `✅ Chunk ${i + 1} completed in ${chunkProcessingTime}s (${modelType}):`,
        result.transcription?.raw_text?.substring(0, 100),
      )

      // Update status message with model info
      loadingMessage.value = `✅ Chunk ${i + 1}/${chunks.length} done in ${chunkProcessingTime}s (${modelType})`

      // Add to results
      chunkResults.value.push({
        index: i,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime,
        raw_text: result.transcription?.raw_text || result.transcription?.text || result.text,
        improved_text: result.transcription?.improved_text,
        processingTime: chunkProcessingTime,
        metadata: result.metadata,
      })
    } catch (err) {
      // Clear processing timer on error
      clearTimeout(chunkProcessingTimer)

      console.error(`Error processing chunk ${i + 1}:`, err)

      // Check if this is a silence/no speech error
      const isSilenceError = err.message && (
        err.message.includes('400') ||
        err.message.includes('not supported between instances') ||
        err.message.includes('NoneType') ||
        err.message.toLowerCase().includes('no speech')
      )

      if (isSilenceError) {
        console.log(`⏸️ Chunk ${i + 1} appears to be silent or has no recognizable speech - skipping`)
        loadingMessage.value = `⏸️ Chunk ${i + 1} is silent - skipping...`

        // Add silent chunk placeholder
        chunkResults.value.push({
          index: i,
          startTime: chunks[i].startTime,
          endTime: chunks[i].endTime,
          raw_text: '[Silent segment - no speech detected]',
          improved_text: null,
          processingTime: 0,
          silent: true,
        })
      } else {
        // Other errors - mark as failed
        chunkResults.value.push({
          index: i,
          startTime: chunks[i].startTime,
          endTime: chunks[i].endTime,
          raw_text: `[Error processing chunk ${i + 1}: ${err.message}]`,
          improved_text: null,
          processingTime: 0,
          error: true,
        })
      }
    }
  }

  if (!processingAborted.value) {
    // Count successful, silent, and error chunks
    const successfulChunks = chunkResults.value.filter(c => !c.error && !c.silent).length
    const silentChunks = chunkResults.value.filter(c => c.silent).length
    const errorChunks = chunkResults.value.filter(c => c.error).length

    let summary = `✅ Processed ${chunkResults.value.length} chunks`
    if (silentChunks > 0) {
      summary += ` (${silentChunks} silent)`
    }
    if (errorChunks > 0) {
      summary += ` (${errorChunks} errors)`
    }

    loadingMessage.value = summary
    console.log(`🎉 Chunk processing complete: ${successfulChunks} successful, ${silentChunks} silent, ${errorChunks} errors`)

    // Combine all chunk results into a single transcriptionResult for graph creation
    // Exclude silent chunks and error chunks from the text
    const combinedRawText = chunkResults.value
      .filter(c => !c.silent && !c.error)
      .map((chunk) => chunk.raw_text)
      .join(' ')
    const combinedImprovedText = chunkResults.value
      .filter(c => !c.silent && !c.error)
      .map((chunk) => chunk.improved_text || chunk.raw_text)
      .join(' ')

    // Set the combined result so "Create New Graph" can use it
    transcriptionResult.value = {
      success: true,
      transcription: {
        raw_text: combinedRawText,
        improved_text: combinedImprovedText,
        language: 'no',
        chunks: chunkResults.value.length,
        processing_time: chunkResults.value.reduce((total, chunk) => total + (chunk.processingTime || 0), 0),
        timestamp: new Date().toISOString(),
      },
      metadata: {
        total_chunks: chunkResults.value.length,
        transcription_server: 'Hugging Face (Chunked)',
        processing_method: 'chunked'
      }
    }

    setTimeout(() => {
      loadingMessage.value = ''
    }, 3000)
  }
}

const clearError = () => {
  error.value = null
  portfolioError.value = null
}

// Whisper-1 transcription using OpenAI endpoint
const transcribeWithWhisper = async () => {
  if (!selectedFile.value && !recordedBlob.value) {
    error.value = { message: 'Please select an audio file or record audio first' }
    return
  }

  whisperTranscribing.value = true
  error.value = null
  whisperResult.value = null

  // Reset portfolio save state for new transcription
  portfolioSaved.value = false
  portfolioError.value = null

  resetChunkedState()

  const audioBlob = selectedFile.value || recordedBlob.value
  const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

  try {
    console.log('🤖 Starting Whisper-1 transcription:', {
      fileName,
      size: audioBlob.size,
      type: audioBlob.type,
    })

    // Check audio duration to determine if chunking is needed
    loadingMessage.value = 'Analyzing audio file...'
    const audioDuration = await getAudioDuration(audioBlob)
    const CHUNK_THRESHOLD = 120 // 2 minutes

    console.log(`📊 Audio duration: ${Math.round(audioDuration)}s (${formatTime(audioDuration)})`)

    if (audioDuration > CHUNK_THRESHOLD) {
      // Use chunked processing for files > 2 minutes
      await processWhisperInChunks(audioBlob, fileName, audioDuration)
    } else {
      // Use single file processing for smaller files
      await processSingleWhisperFile(audioBlob, fileName)
    }
  } catch (err) {
    console.error('Whisper transcription error:', err)
    error.value = {
      message: 'Whisper transcription failed',
      details: err.message,
    }
  } finally {
    whisperTranscribing.value = false
    loadingMessage.value = ''
    isChunkedProcessing.value = false
  }
}

const processSingleWhisperFile = async (audioBlob, fileName) => {
  loadingMessage.value = '🤖 Transcribing with Whisper-1...'

  console.log('📄 Processing single file with Whisper-1')

  const formData = new FormData()
  formData.append('file', audioBlob, fileName)
  formData.append('model', 'whisper-1')
  formData.append('language', 'no') // Norwegian
  formData.append('userId', 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b')

  const startTime = performance.now()

  try {
    const response = await fetch('https://openai.vegvisr.org/audio', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }
      throw new Error(errorData.error || `Whisper API error: ${response.status}`)
    }

    const result = await response.json()
    const processingTime = ((performance.now() - startTime) / 1000).toFixed(2)

    console.log('✅ Whisper transcription completed:', result)

    whisperResult.value = {
      success: true,
      transcription: {
        raw_text: result.text,
        improved_text: null,
        language: 'no',
        processing_time: parseFloat(processingTime),
        timestamp: new Date().toISOString(),
      },
      metadata: {
        filename: fileName,
        model: 'whisper-1',
        total_processing_time: parseFloat(processingTime),
        transcription_server: 'OpenAI Whisper API',
      },
    }

    transcriptionResult.value = whisperResult.value

    loadingMessage.value = `✅ Whisper completed in ${processingTime}s`
    setTimeout(() => { loadingMessage.value = '' }, 3000)
  } catch (error) {
    throw error
  }
}

const processWhisperInChunks = async (audioBlob, fileName, audioDuration) => {
  loadingMessage.value = '📊 Analyzing audio file...'
  isChunkedProcessing.value = true

  console.log('🧩 Processing Whisper in chunks - splitting audio...')

  const chunks = await splitAudioIntoChunks(audioBlob, 120, (progress) => {
    if (progress.phase === 'info') {
      loadingMessage.value = `📊 Audio: ${progress.numChunks} chunks needed (${progress.sampleRate}Hz)`
    } else if (progress.phase === 'creating') {
      loadingMessage.value = `🎵 Creating chunk ${progress.current}/${progress.total}...`
    }
  })

  totalChunks.value = chunks.length
  console.log(`📊 Split into ${chunks.length} chunks of ~2 minutes each`)

  for (let i = 0; i < chunks.length; i++) {
    if (processingAborted.value) {
      console.log('🛑 Processing aborted by user')
      break
    }

    currentChunk.value = i + 1
    loadingMessage.value = `🤖 Processing chunk ${i + 1}/${chunks.length} with Whisper-1 (${formatTime(chunks[i].startTime)} - ${formatTime(chunks[i].endTime)})...`

    try {
      const chunkStart = performance.now()

      const formData = new FormData()
      formData.append('file', chunks[i].blob, `chunk_${i + 1}_${fileName}`)
      formData.append('model', 'whisper-1')
      formData.append('language', 'no')
      formData.append('userId', 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b')

      const response = await fetch('https://openai.vegvisr.org/audio', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        throw new Error(errorData.error || `Whisper API error: ${response.status}`)
      }

      const result = await response.json()
      const chunkTime = ((performance.now() - chunkStart) / 1000).toFixed(2)

      console.log(`✅ Chunk ${i + 1} completed in ${chunkTime}s`)

      chunkResults.value.push({
        index: i,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime,
        raw_text: result.text || '',
        improved_text: null,
        processingTime: parseFloat(chunkTime),
        silent: !result.text || result.text.trim().length === 0,
        error: false,
      })
    } catch (err) {
      console.error(`❌ Chunk ${i + 1} error:`, err)
      chunkResults.value.push({
        index: i,
        startTime: chunks[i].startTime,
        endTime: chunks[i].endTime,
        raw_text: `[Error processing chunk ${i + 1}: ${err.message}]`,
        improved_text: null,
        processingTime: 0,
        error: true,
      })
    }
  }

  if (!processingAborted.value) {
    const successfulChunks = chunkResults.value.filter(c => !c.error && !c.silent).length
    const silentChunks = chunkResults.value.filter(c => c.silent).length
    const errorChunks = chunkResults.value.filter(c => c.error).length

    let summary = `✅ Processed ${chunkResults.value.length} chunks`
    if (silentChunks > 0) summary += ` (${silentChunks} silent)`
    if (errorChunks > 0) summary += ` (${errorChunks} errors)`

    loadingMessage.value = summary
    console.log(`🎉 Whisper chunk processing complete: ${successfulChunks} successful, ${silentChunks} silent, ${errorChunks} errors`)

    const combinedText = chunkResults.value
      .filter(c => !c.silent && !c.error)
      .map((chunk) => chunk.raw_text)
      .join(' ')

    transcriptionResult.value = {
      success: true,
      transcription: {
        raw_text: combinedText,
        improved_text: null,
        language: 'no',
        chunks: chunkResults.value.length,
        processing_time: chunkResults.value.reduce((total, chunk) => total + (chunk.processingTime || 0), 0),
        timestamp: new Date().toISOString(),
      },
      metadata: {
        total_chunks: chunkResults.value.length,
        transcription_server: 'OpenAI Whisper-1 (Chunked)',
        processing_method: 'chunked',
        model: 'whisper-1'
      }
    }

    whisperResult.value = transcriptionResult.value

    setTimeout(() => { loadingMessage.value = '' }, 3000)
  }
}

// Utility functions
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const abortProcessing = () => {
  processingAborted.value = true
  transcribing.value = false
  isChunkedProcessing.value = false
  loadingMessage.value = 'Processing aborted by user'

  setTimeout(() => {
    loadingMessage.value = ''
  }, 3000)
}

const resetChunkedState = () => {
  isChunkedProcessing.value = false
  currentChunk.value = 0
  totalChunks.value = 0
  chunkResults.value = []
  processingAborted.value = false

  // Reset portfolio save state for new transcription
  portfolioSaved.value = false
  portfolioError.value = null
}

// Portfolio saving functions
const saveToPortfolio = async () => {
  if (!transcriptionResult.value || !userStore.loggedIn) {
    return
  }

  savingToPortfolio.value = true
  portfolioError.value = null

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('=== UPLOADING AUDIO TO R2 ===')
    console.log('Audio file details:', { fileName, size: audioBlob.size, type: audioBlob.type })

    // Step 1: Upload audio file to R2 using Norwegian transcription worker
    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json()
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Audio uploaded to R2:', uploadResult)

    // Step 2: Create recording data for the audio-portfolio-worker with R2 URL
    const recordingData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: fileName.replace(/\.[^/.]+$/, ''), // Remove extension for display name
      fileSize: audioBlob.size,
      duration: recordingDuration.value || 0,

      // R2 Information from upload
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      // Norwegian transcription data - support both raw and improved text
      transcriptionText:
        transcriptionResult.value.transcription.improved_text ||
        transcriptionResult.value.transcription.raw_text,
      norwegianTranscription: {
        raw_text: transcriptionResult.value.transcription.raw_text,
        improved_text: transcriptionResult.value.transcription.improved_text,
        language: transcriptionResult.value.transcription.language,
        processing_time: transcriptionResult.value.transcription.processing_time,
        improvement_time: transcriptionResult.value.transcription.improvement_time,
      },

      // Organization
      category: 'Norwegian Transcription',
      tags: [
        'norwegian',
        'transcription',
        transcriptionResult.value.transcription.improved_text ? 'ai-enhanced' : 'raw-only',
        'vegvisr-transcription',
      ],

      // Technical metadata
      audioFormat: audioBlob.type.split('/')[1] || 'wav',
      aiService: 'Norwegian Transcription Worker',
      aiModel: transcriptionResult.value.metadata.model || 'nb-whisper-small',
      processingTime: transcriptionResult.value.metadata.total_processing_time || 0,

      // Context information
      transcriptionContext: transcriptionContext.value,

      // Service metadata
      transcriptionServer: transcriptionResult.value.metadata.transcription_server,
      textImprovement: transcriptionResult.value.metadata.text_improvement,
      cloudflareAiAvailable: transcriptionResult.value.metadata.cloudflare_ai_available,
    }

    console.log('=== SAVING TO PORTFOLIO ===')
    console.log('Recording data:', JSON.stringify(recordingData, null, 2))

    // Step 3: Call the audio-portfolio-worker API
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(recordingData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save to portfolio: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Successfully saved to portfolio:', result)

    portfolioSaved.value = true
  } catch (err) {
    console.error('Failed to save audio to portfolio:', err)
    portfolioError.value = err.message
  } finally {
    savingToPortfolio.value = false
  }
}

// Save audio only (without transcription) - NEW FUNCTION
const saveAudioOnly = async () => {
  if ((!selectedFile.value && !recordedBlob.value) || !userStore.loggedIn) {
    audioOnlyError.value = 'Please select or record an audio file and log in'
    return
  }

  savingAudioOnly.value = true
  audioOnlyError.value = null

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('=== SAVING AUDIO ONLY (NO TRANSCRIPTION) ===')
    console.log('Audio details:', { fileName, size: audioBlob.size, type: audioBlob.type })

    // Step 1: Upload audio file to R2
    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json()
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Audio uploaded to R2:', uploadResult)

    // Step 2: Parse tags
    const tags = audioOnlyTags.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    // Step 3: Create recording data (audio-only, no transcription)
    const recordingData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: audioOnlyDisplayName.value || fileName.replace(/\.[^/.]+$/, ''),
      fileSize: audioBlob.size,
      duration: recordingDuration.value || 0,

      // R2 Information
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      // No transcription data
      transcriptionText: audioOnlyDescription.value || '', // Use description as fallback text

      // Organization
      category: audioOnlyCategory.value,
      tags: ['audio-only', 'no-transcription', ...tags],

      // Technical metadata
      audioFormat: audioBlob.type.split('/')[1] || 'wav',
      sampleRate: 16000, // Default
      channels: 1, // Default

      // Mark as audio-only (no AI processing)
      aiService: 'none',
      aiModel: 'none',
      processingTime: 0,
    }

    console.log('Recording data:', JSON.stringify(recordingData, null, 2))

    // Step 4: Save to audio-portfolio-worker
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(recordingData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Audio-only saved successfully:', result)

    audioOnlySaved.value = true

    // Reset form
    setTimeout(() => {
      audioOnlyDisplayName.value = ''
      audioOnlyCategory.value = 'other'
      audioOnlyTags.value = ''
      audioOnlyDescription.value = ''
      audioOnlySaved.value = false
    }, 3000)

  } catch (err) {
    console.error('Failed to save audio-only:', err)
    audioOnlyError.value = err.message
  } finally {
    savingAudioOnly.value = false
  }
}

// Calculate audio statistics (speech vs silence)
const calculateAudioStatistics = (chunks) => {
  const successfulChunks = chunks.filter(c => !c.error && !c.silent)
  const silentChunks = chunks.filter(c => c.silent)
  const errorChunks = chunks.filter(c => c.error)

  // Calculate durations
  const totalDuration = chunks.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
  const speechDuration = successfulChunks.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
  const silenceDuration = silentChunks.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)
  const errorDuration = errorChunks.reduce((sum, c) => sum + (c.endTime - c.startTime), 0)

  const speechPercentage = totalDuration > 0 ? (speechDuration / totalDuration * 100) : 0
  const silencePercentage = totalDuration > 0 ? (silenceDuration / totalDuration * 100) : 0

  return {
    totalChunks: chunks.length,
    successfulChunks: successfulChunks.length,
    silentChunks: silentChunks.length,
    errorChunks: errorChunks.length,
    totalDuration: Math.round(totalDuration),
    speechDuration: Math.round(speechDuration),
    silenceDuration: Math.round(silenceDuration),
    errorDuration: Math.round(errorDuration),
    speechPercentage: Math.round(speechPercentage * 10) / 10,
    silencePercentage: Math.round(silencePercentage * 10) / 10,
  }
}

const saveChunkedToPortfolio = async () => {
  if (!chunkResults.value.length || !userStore.loggedIn) {
    return
  }

  savingToPortfolio.value = true
  portfolioError.value = null

  try {
    const audioBlob = selectedFile.value || recordedBlob.value
    const fileName = selectedFile.value ? selectedFile.value.name : `recording_${Date.now()}.wav`

    console.log('=== UPLOADING CHUNKED AUDIO TO R2 ===')
    console.log('Audio file details:', { fileName, size: audioBlob.size, type: audioBlob.type })

    // Step 1: Upload audio file to R2 using Norwegian transcription worker
    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': fileName,
      },
      body: audioBlob,
    })

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json()
      throw new Error(uploadError.error || `Upload failed: ${uploadResponse.status}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('✅ Chunked audio uploaded to R2:', uploadResult)

    // Calculate audio statistics (speech vs silence)
    const audioStats = calculateAudioStatistics(chunkResults.value)
    console.log('📊 Audio statistics:', audioStats)

    // Step 2: Combine all chunk results (excluding silent and error chunks)
    const combinedRawText = chunkResults.value
      .filter(c => !c.silent && !c.error)
      .map((chunk) => chunk.raw_text)
      .join(' ')
    const combinedImprovedText = chunkResults.value
      .filter(c => !c.silent && !c.error)
      .map((chunk) => chunk.improved_text || chunk.raw_text)
      .join(' ')

    // Calculate total processing time
    const totalProcessingTime = chunkResults.value.reduce(
      (total, chunk) => total + (chunk.processingTime || 0),
      0,
    )

    // Step 3: Create recording data for the audio-portfolio-worker with R2 URL
    const recordingData = {
      userEmail: userStore.email,
      fileName: fileName,
      displayName: fileName.replace(/\.[^/.]+$/, '') + ' (Chunked Processing)', // Add chunked indicator
      fileSize: audioBlob.size,
      duration: recordingDuration.value || 0,

      // R2 Information from upload
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,

      // Norwegian transcription data - combined from all chunks
      transcriptionText: combinedImprovedText,
      norwegianTranscription: {
        raw_text: combinedRawText,
        improved_text: combinedImprovedText,
        language: 'no',
        processing_time: totalProcessingTime,
        chunks: chunkResults.value.length,
        chunk_details: chunkResults.value.map((chunk) => ({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          raw_text: chunk.raw_text,
          improved_text: chunk.improved_text,
          processingTime: chunk.processingTime,
          silent: chunk.silent,
          error: chunk.error,
        })),
        // Audio statistics
        audioStatistics: audioStats,
      },

      // Organization
      category: 'Norwegian Transcription (Chunked)',
      tags: [
        'norwegian',
        'transcription',
        'chunked-processing',
        'ai-enhanced',
        'vegvisr-transcription',
        `${chunkResults.value.length}-chunks`,
      ],

      // Technical metadata
      audioFormat: audioBlob.type.split('/')[1] || 'wav',
      aiService: 'Norwegian Transcription Worker (Chunked)',
      aiModel: 'nb-whisper-small',
      processingTime: totalProcessingTime,

      // Context information
      transcriptionContext: transcriptionContext.value,

      // Service metadata
      transcriptionServer: 'Worker Orchestration (Hetzner + Cloudflare AI)',
      textImprovement: 'Cloudflare Workers AI',
      cloudflareAiAvailable: true,
    }

    console.log('=== SAVING CHUNKED TRANSCRIPTION TO PORTFOLIO ===')
    console.log('Recording data:', JSON.stringify(recordingData, null, 2))

    // Step 4: Call the audio-portfolio-worker API
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/save-recording',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userStore.email,
        },
        body: JSON.stringify(recordingData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to save to portfolio: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Successfully saved chunked transcription to portfolio:', result)

    portfolioSaved.value = true
  } catch (err) {
    console.error('Failed to save chunked audio to portfolio:', err)
    portfolioError.value = err.message
  } finally {
    savingToPortfolio.value = false
  }
}

// Graph creation function - simplified approach that works
const createNewGraph = async () => {
  if (!transcriptionResult.value) {
    graphError.value = 'No transcription result available'
    return
  }

  creatingGraph.value = true
  graphError.value = null
  graphCreated.value = false

  try {
    // Get the best available text (improved > raw > fallback)
    const transcriptionText =
      transcriptionResult.value.transcription?.improved_text ||
      transcriptionResult.value.transcription?.raw_text ||
      transcriptionResult.value.text || ''

    if (!transcriptionText.trim()) {
      throw new Error('No transcription text available to create graph from')
    }



    console.log('🔍 Processing transcription through API for knowledge graph creation...')

    // Process the transcription through the same API as Process Transcript modal
    const apiResponse = await fetch('https://grok.vegvisr.org/process-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        transcript: transcriptionText,
        sourceLanguage: 'norwegian',
        targetLanguage: 'norwegian',
        userId: userStore.user_id, // Add userId for API key retrieval from D1
      }),
    })

    if (!apiResponse.ok) {
      throw new Error(`Transcript processing failed: ${apiResponse.status}`)
    }

    const result = await apiResponse.json()
    console.log('✅ API processing complete:', result)

    // Use the processed knowledge graph from the API
    const graphData = result.knowledgeGraph

    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      throw new Error('API returned empty knowledge graph')
    }

    // Update metadata with transcription info
    const today = new Date()
    const dateStr = today.toLocaleDateString('no-NO')
    const timeStr = today.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
    const nodeCount = graphData.nodes.length
    const filename = transcriptionResult.value.metadata?.filename || 'Audio'

    const graphTitle = `🎙️ ${filename.replace(/\.[^/.]+$/, '')} (${nodeCount} nodes)`

    graphData.metadata = {
      ...graphData.metadata,
      title: graphTitle,
      description: `Norsk kunnskapsgraf fra lydtranskripsjonen "${filename}". Prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} kunnskapsnoder.`,
      createdBy: userStore.email || 'Anonymous',
      source: 'Norwegian Transcription Service',
      language: 'Norwegian',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    console.log('Graph data prepared:', { nodeCount, title: graphTitle })

    const graphId = `graph_${Date.now()}`

    // Save the graph using saveGraphWithHistory (same as Process Transcript modal)
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify({
        id: graphId,
        graphData,
        override: true
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to save graph: ${response.status}`)
    }

    console.log('✅ Graph saved to server:', graphTitle)
    graphCreated.value = true

    // Navigate to the graph viewer
    console.log('🚀 Redirecting to graph viewer:', `/gnew-viewer?graphId=${graphId}`)
    router.push(`/gnew-viewer?graphId=${graphId}`)

    // Reset the success message after a delay (in case navigation fails)
    setTimeout(() => {
      graphCreated.value = false
    }, 5000)

  } catch (err) {
    console.error('Failed to create graph:', err)
    graphError.value = err.message
  } finally {
    creatingGraph.value = false
  }
}// Helper function to create knowledge graph nodes from text (like Process Transcript modal's fallback)
const createKnowledgeGraphFromText = async (text) => {
  try {
    const words = text.split(/\s+/)
    const chunkSize = 500 // words per node (same as Process Transcript modal fallback)
    const chunks = []

    // Split into chunks
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    // Create nodes from chunks (same format as Process Transcript modal)
    const nodes = chunks.map((chunk, index) => ({
      id: `transcript_${Date.now()}_${index}`,
      label: `DEL ${index + 1}`,
      color: '#f9f9f9',
      type: 'fulltext',
      info: `## DEL ${index + 1}\n\n${chunk}`,
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }))

    return {
      nodes,
      edges: [],
    }
  } catch (error) {
    console.error('Failed to create knowledge graph from text:', error)
    return null
  }
}

// Create graph from chunked results - works like Process Transcript modal's "Create New Graph"
const createChunkedGraph = async () => {
  if (!chunkResults.value.length) {
    graphError.value = 'No chunked transcription results available'
    return
  }

  creatingGraph.value = true
  graphError.value = null
  graphCreated.value = false

  try {
    // Combine all chunk results
    const combinedRawText = chunkResults.value.map(chunk => chunk.raw_text).join(' ')
    const combinedImprovedText = chunkResults.value
      .map(chunk => chunk.improved_text || chunk.raw_text)
      .join(' ')

    const transcriptionText = combinedImprovedText || combinedRawText

    if (!transcriptionText.trim()) {
      throw new Error('No transcription text available to create graph from')
    }

    console.log('Creating new graph from chunked transcription:', transcriptionText.substring(0, 100) + '...')

    // Create a more detailed graph structure for chunked results
    const graphName = `Chunked Audio Transcription ${new Date().toLocaleString()}`
    const totalProcessingTime = chunkResults.value.reduce((total, chunk) => total + (chunk.processingTime || 0), 0)

    // Create nodes for each chunk plus a main node
    const nodes = [
      {
        id: '1',
        type: 'concept',
        label: 'Complete Transcription',
        content: transcriptionText,
        x: 400,
        y: 200,
        metadata: {
          source: 'Norwegian Transcription (Chunked)',
          created: new Date().toISOString(),
          language: 'no',
          totalChunks: chunkResults.value.length,
          totalProcessingTime: totalProcessingTime
        }
      }
    ]

    // Add individual chunk nodes
    chunkResults.value.forEach((chunk, index) => {
      if (chunk.raw_text && chunk.raw_text.trim() && !chunk.error) {
        nodes.push({
          id: `chunk-${index + 1}`,
          type: 'chunk',
          label: `Chunk ${index + 1}`,
          content: chunk.improved_text || chunk.raw_text,
          x: 200 + (index * 150),
          y: 400,
          metadata: {
            chunkIndex: index + 1,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            processingTime: chunk.processingTime,
            enhanced: !!chunk.improved_text
          }
        })
      }
    })

    const graphData = {
      name: graphName,
      description: `Graph created from chunked Norwegian audio transcription (${chunkResults.value.length} chunks)`,
      nodes: nodes,
      edges: [],
      metadata: {
        createdFrom: 'chunked-audio-transcription',
        transcriptionSource: 'norwegian-worker',
        totalChunks: chunkResults.value.length,
        totalProcessingTime: totalProcessingTime,
        chunkDetails: chunkResults.value.map(chunk => ({
          index: chunk.index,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          hasImprovedText: !!chunk.improved_text
        }))
      }
    }

    // Store the graph data in localStorage
    const graphs = JSON.parse(localStorage.getItem('savedGraphs') || '[]')
    graphs.push({
      id: Date.now().toString(),
      name: graphName,
      data: graphData,
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    })
    localStorage.setItem('savedGraphs', JSON.stringify(graphs))

    console.log('✅ Chunked graph created successfully:', graphName)
    graphCreated.value = true

    // Reset the success message after a delay
    setTimeout(() => {
      graphCreated.value = false
    }, 5000)

  } catch (err) {
    console.error('Failed to create chunked graph:', err)
    graphError.value = err.message
  } finally {
    creatingGraph.value = false
  }
}
</script>

<style scoped>
.norwegian-test-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #dc143c, #b71c1c);
  color: white;
  border-radius: 12px;
}

.header h1 {
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: bold;
}

.header p {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.service-info {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.service-badge,
.language-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  backdrop-filter: blur(10px);
}

.test-section {
  background: white;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.test-section h2 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 1.5rem;
  border-bottom: 2px solid #dc143c;
  padding-bottom: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #dc143c, #b71c1c);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #b71c1c, #8b0000);
  transform: translateY(-2px);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
  transform: translateY(-2px);
}

.btn-success {
  background: linear-gradient(135deg, #28a745, #1e7e34);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e7e34, #155724);
  transform: translateY(-2px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.upload-area {
  border: 2px dashed #dc143c;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  background: linear-gradient(135deg, #fff5f5, #ffeef0);
  transition: all 0.3s ease;
}

.upload-area:hover {
  border-color: #b71c1c;
  background: linear-gradient(135deg, #ffeef0, #ffe0e6);
}

.upload-hint {
  margin-top: 10px;
  color: #666;
  font-style: italic;
}

.section-description {
  color: #666;
  margin-bottom: 15px;
  font-size: 0.95rem;
}

.extracted-audio-result {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border-radius: 8px;
  border: 2px solid #10b981;
}

.extracted-audio-result h3 {
  margin: 0 0 15px 0;
  color: #059669;
}

.extracted-info {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  color: #666;
  font-size: 0.9rem;
}

.extracted-info span {
  padding: 4px 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #d1fae5;
}

.hint-text {
  margin-top: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  text-align: center;
  color: #059669;
  font-weight: 500;
}

.file-size-warning {
  margin: 15px 0;
  padding: 12px 15px;
  background: linear-gradient(135deg, #fff3cd, #ffe8a1);
  border-left: 4px solid #ffc107;
  border-radius: 6px;
  color: #856404;
  font-size: 0.9rem;
  line-height: 1.5;
}

.file-size-warning a {
  color: #0056b3;
  font-weight: 600;
  text-decoration: underline;
}

.file-size-warning a:hover {
  color: #003d82;
}

.context-section {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #dc143c;
}

.context-section h4 {
  margin: 0 0 10px 0;
  color: #dc143c;
}

.context-help {
  color: #666;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.context-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 80px;
}

.context-input:focus {
  border-color: #dc143c;
  outline: none;
  box-shadow: 0 0 0 3px rgba(220, 20, 60, 0.1);
}

/* Status Banner Styles */
.status-banner {
  padding: 15px 20px;
  margin: 20px 0;
  border-radius: 8px;
  font-weight: 600;
  text-align: center;
  animation: slideDown 0.3s ease;
}

.status-banner.success {
  background: #d1fae5;
  color: #065f46;
  border: 2px solid #10b981;
}

.status-banner.info {
  background: #dbeafe;
  color: #1e40af;
  border: 2px solid #3b82f6;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.context-examples {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}

.example-list {
  margin: 5px 0 0 0;
  padding-left: 20px;
}

.example-list li {
  margin: 2px 0;
  color: #666;
  font-size: 0.85rem;
}

/* Chunked Processing Styles */
.chunk-progress {
  margin-top: 20px;
  padding: 20px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 1px solid #87ceeb;
}

.progress-info h4 {
  margin: 0 0 15px 0;
  color: #1e40af;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.chunk-counter {
  font-weight: bold;
  color: #1e40af;
}

.progress-percentage {
  font-size: 1.2rem;
  font-weight: bold;
  color: #059669;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.chunk-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.abort-btn {
  background: #dc2626;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-start;
}

.abort-btn:hover {
  background: #b91c1c;
}

.context-quick-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-quick-edit label {
  font-weight: 500;
  color: #374151;
}

.context-quick-input {
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
}

/* Chunk Results Styles */
.chunk-results-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chunk-result {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f3f4f6;
}

.chunk-header h4 {
  margin: 0;
  color: #1f2937;
}

.chunk-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.processing-time {
  color: #6b7280;
  font-size: 0.9rem;
}

.enhancement-indicator {
  background: #10b981;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.chunk-text {
  margin-bottom: 15px;
}

.chunk-text h5 {
  margin: 0 0 8px 0;
  color: #374151;
  font-size: 0.9rem;
}

.chunk-text.enhanced .text-content {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
  padding: 12px;
  border-radius: 4px;
}

.chunk-text.raw .text-content {
  background: #fafafa;
  border-left: 4px solid #6b7280;
  padding: 12px;
  border-radius: 4px;
}

.combined-results {
  margin-top: 30px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.combined-results h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
}

.audio-statistics {
  background: #eff6ff;
  border: 1px solid #3b82f6;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

.audio-statistics h4 {
  margin: 0 0 12px 0;
  color: #1e40af;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dbeafe;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.combined-text h4 {
  margin: 15px 0 10px 0;
  color: #374151;
}

.enhanced-combined {
  background: #ecfdf5;
  border: 1px solid #10b981;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 15px;
  line-height: 1.6;
}

.raw-combined {
  background: #f5f5f5;
  border: 1px solid #6b7280;
  padding: 15px;
  border-radius: 6px;
  line-height: 1.6;
}

.file-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.file-info h3 {
  margin: 0 0 15px 0;
  color: #dc143c;
}

.audio-preview,
.recorded-audio {
  margin-top: 15px;
}

.audio-player {
  width: 100%;
  margin-top: 10px;
}

.recording-controls {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #dc143c;
  font-weight: bold;
}

.recording-dot {
  width: 12px;
  height: 12px;
  background: #dc143c;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.recorded-info {
  margin-top: 10px;
  display: flex;
  gap: 20px;
  color: #666;
}

.transcription-info {
  margin-bottom: 20px;
}

.info-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  border-left: 4px solid #dc143c;
}

.info-card h4 {
  margin: 0 0 15px 0;
  color: #dc143c;
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
}

.info-card li {
  margin-bottom: 8px;
}

.transcription-buttons {
  display: flex;
  gap: 15px;
  margin-top: 20px;
}

.transcribe-btn {
  font-size: 1.1rem;
  padding: 15px 30px;
  flex: 1;
}

.loading {
  text-align: center;
  margin-top: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #dc143c;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
  transition: all 0.3s ease;
}

.loading-spinner.cold-start {
  border-top: 4px solid #ff9500;
  animation: coldStartSpin 2s ease-in-out infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes coldStartSpin {
  0% {
    transform: rotate(0deg);
    border-top-color: #ff9500;
  }
  25% {
    transform: rotate(90deg);
    border-top-color: #ffa500;
  }
  50% {
    transform: rotate(180deg);
    border-top-color: #ffb500;
  }
  75% {
    transform: rotate(270deg);
    border-top-color: #ffa500;
  }
  100% {
    transform: rotate(360deg);
    border-top-color: #ff9500;
  }
}

.cold-start-info {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 10px;
  font-size: 0.9em;
}

.processing-info {
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 10px;
  font-size: 0.9em;
}

.status-result {
  margin-top: 15px;
  padding: 15px;
  border-radius: 8px;
  border-left: 4px solid;
}

.status-result.success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.status-result.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.status-result.warning {
  background: #fff3cd;
  border-color: #ffc107;
  color: #856404;
}

.status-result.info {
  background: #d1ecf1;
  border-color: #17a2b8;
  color: #0c5460;
}

.endpoint-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.endpoint-section h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.endpoint-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 15px;
}

.wake-progress {
  margin-top: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #ddd;
}

.wake-progress .progress-spinner {
  font-size: 2rem;
  margin-bottom: 10px;
  animation: spin 2s linear infinite;
}

.wake-progress strong {
  display: block;
  margin-bottom: 5px;
  color: #333;
}

.wake-progress .hint-text {
  color: #666;
  font-size: 0.9rem;
  margin-top: 5px;
}

.health-details {
  margin-top: 10px;
}

.health-details pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  overflow-x: auto;
}

.result-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  border: 1px solid #e0e0e0;
}

.result-header {
  margin-bottom: 20px;
}

.result-header h3 {
  margin: 0 0 10px 0;
  color: #dc143c;
}

.result-metadata {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.metadata-item {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #666;
  border: 1px solid #ddd;
}

.transcription-text {
  margin-bottom: 20px;
}

.transcription-text h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.text-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
  line-height: 1.6;
  font-size: 1.1rem;
  min-height: 100px;
}

.result-details h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.result-details pre {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
  font-size: 0.9rem;
  overflow-x: auto;
}

.error-section {
  margin-top: 20px;
}

.alert {
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
}

.alert-danger {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.alert h4 {
  margin: 0 0 10px 0;
}

.error-details {
  margin-top: 15px;
}

.error-details pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 10px;
  border-radius: 4px;
  font-size: 0.9rem;
  overflow-x: auto;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 0.9rem;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

/* Portfolio Action Styles */
.portfolio-actions {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.portfolio-btn {
  font-size: 1.1rem;
  padding: 12px 24px;
  margin-bottom: 10px;
}

.portfolio-success {
  background: #d4edda;
  color: #155724;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #c3e6cb;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.portfolio-success .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.portfolio-error {
  background: #f8d7da;
  color: #721c24;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #f5c6cb;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.portfolio-error .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.btn-outline-primary {
  background: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline-primary:hover {
  background: #007bff;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.btn-outline-danger:hover {
  background: #dc3545;
  color: white;
}

/* Graph Action Styles */
.graph-actions {
  margin-top: 20px;
  padding: 15px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.graph-btn {
  font-size: 1.1rem;
  padding: 12px 24px;
  margin-bottom: 10px;
  background: #0ea5e9;
  border-color: #0ea5e9;
}

.graph-btn:hover {
  background: #0284c7;
  border-color: #0284c7;
}

.graph-success {
  background: #d1fae5;
  color: #065f46;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.graph-success .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.graph-error {
  background: #fee2e2;
  color: #991b1b;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #fecaca;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.graph-error .btn {
  font-size: 0.9rem;
  padding: 6px 12px;
}

.graph-info {
  background: #fef3c7;
  color: #92400e;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #fde68a;
  font-style: italic;
}

/* Endpoint Selection Styles */
.endpoint-selection {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #dc143c;
}

.endpoint-selection h4 {
  margin: 0 0 15px 0;
  color: #dc143c;
}

.endpoint-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 15px;
}

.endpoint-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.endpoint-option:hover {
  border-color: #dc143c;
  background: #fff5f5;
}

.endpoint-option input[type="radio"] {
  margin: 0;
  transform: scale(1.2);
}

.endpoint-option input[type="radio"]:checked + .endpoint-label {
  color: #dc143c;
}

.endpoint-option:has(input:checked) {
  border-color: #dc143c;
  background: #fff5f5;
}

.endpoint-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.endpoint-label strong {
  font-size: 1rem;
  color: #333;
}

.endpoint-label small {
  color: #666;
  font-size: 0.85rem;
}

.endpoint-info {
  padding: 8px 12px;
  background: #e3f2fd;
  border-radius: 4px;
  border-left: 3px solid #2196f3;
}

.endpoint-info .text-muted {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

/* Speaker Identification Styles */
.portfolio-list {
  margin-top: 20px;
}

.recordings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.recording-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
}

.recording-card:hover {
  border-color: #dc143c;
  box-shadow: 0 2px 8px rgba(220, 20, 60, 0.2);
  transform: translateY(-2px);
}

.recording-card.selected {
  border-color: #dc143c;
  background: #fff5f5;
  box-shadow: 0 4px 12px rgba(220, 20, 60, 0.3);
}

.recording-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 10px;
}

.recording-header strong {
  color: #333;
  font-size: 1rem;
}

.recording-date {
  font-size: 0.8rem;
  color: #666;
}

.recording-meta {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 0.85rem;
  color: #666;
}

.recording-preview {
  font-size: 0.85rem;
  color: #999;
  font-style: italic;
  margin-top: 10px;
  line-height: 1.4;
}

.speaker-config {
  margin-top: 30px;
  padding: 25px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #dc143c;
}

.config-input {
  margin-bottom: 20px;
}

.config-input label {
  display: block;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-control:focus {
  border-color: #dc143c;
  outline: none;
  box-shadow: 0 0 0 3px rgba(220, 20, 60, 0.1);
}

.speaker-names {
  margin-top: 20px;
}

.speaker-names h5 {
  margin: 0 0 15px 0;
  color: #333;
}

.speaker-name-input {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.speaker-name-input label {
  min-width: 100px;
  font-weight: 500;
}

.audio-player-section {
  margin-top: 25px;
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.audio-player-section h5 {
  margin: 0 0 15px 0;
  color: #333;
}

.current-time {
  margin-top: 10px;
  font-size: 0.9rem;
  color: #666;
  font-family: monospace;
}

.transcription-display {
  margin-top: 25px;
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.transcription-display h5 {
  margin: 0 0 15px 0;
  color: #333;
}

.transcription-text {
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
}

.timestamp-entry {
  margin-top: 25px;
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.timestamp-entry h5 {
  margin: 0 0 15px 0;
  color: #333;
}

.timestamp-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  align-items: end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #666;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 0.85rem;
}

.speaker-timeline {
  margin-top: 30px;
  padding: 25px;
  background: #f0f8ff;
  border-radius: 8px;
  border: 2px solid #4a90e2;
}

.speaker-timeline h5 {
  margin: 0 0 20px 0;
  color: #1e40af;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.timeline-segment {
  background: white;
  border-radius: 6px;
  padding: 15px;
  border-left: 4px solid #4a90e2;
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 8px;
}

.segment-header strong {
  color: #1e40af;
  min-width: 100px;
}

.time-range {
  color: #666;
  font-family: monospace;
  font-size: 0.9rem;
}

.btn-remove {
  margin-left: auto;
  padding: 4px 8px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-remove:hover {
  background: #b91c1c;
}

.segment-text {
  color: #666;
  font-size: 0.9rem;
  padding-left: 10px;
  border-left: 2px solid #e5e7eb;
}

.save-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e5e7eb;
}

.btn-lg {
  padding: 15px 30px;
  font-size: 1.1rem;
}

.success-message {
  margin-top: 15px;
  padding: 12px;
  background: #d1fae5;
  color: #065f46;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
}

.error-message {
  margin-top: 15px;
  padding: 12px;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 6px;
  border: 1px solid #fecaca;
}

/* AI Speaker Identification Styles */
.ai-identification-section {
  margin-top: 25px;
  padding: 20px;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border-radius: 8px;
  border: 2px solid #0ea5e9;
}

.ai-identification-section h5 {
  margin: 0 0 10px 0;
  color: #0369a1;
}

.ai-identification-section .hint-text {
  margin: 0 0 15px 0;
  color: #666;
  font-size: 0.9rem;
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
}

.ai-results {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 6px;
}

.ai-results h6 {
  margin: 0 0 15px 0;
  color: #0369a1;
  font-weight: 600;
}

.ai-speaker-result {
  margin-bottom: 15px;
  padding: 15px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 4px solid #0ea5e9;
}

.ai-speaker-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.ai-speaker-header strong {
  color: #1e293b;
  font-size: 1rem;
}

.ai-role-badge {
  padding: 4px 12px;
  background: #0ea5e9;
  color: white;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.ai-reasoning {
  color: #475569;
  font-size: 0.9rem;
  margin-bottom: 10px;
  line-height: 1.5;
}

.ai-suggestion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  font-size: 0.9rem;
}

.ai-suggestion strong {
  color: #0ea5e9;
}

.btn-apply {
  padding: 4px 12px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-apply:hover {
  background: #059669;
}

/* ========== AUTOMATED DIARIZATION STYLES ========== */

.audio-source-options {
  margin: 20px 0;
  padding: 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.audio-source-options h4 {
  color: #1e293b;
  margin: 0 0 15px 0;
  font-size: 1.1rem;
}

.audio-option {
  margin: 15px 0;
}

.audio-option button {
  width: 100%;
  max-width: 400px;
  margin-bottom: 5px;
}

.option-hint {
  color: #64748b;
  font-size: 0.9rem;
  margin: 5px 0 0 0;
  font-style: italic;
}

.diarization-analysis {
  margin-top: 20px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.diarization-analysis h4 {
  color: #1e293b;
  margin-bottom: 15px;
}

.progress-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  background: white;
  border-radius: 8px;
  border: 2px dashed #3b82f6;
  margin: 20px 0;
}

.progress-spinner {
  font-size: 2rem;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.progress-message strong {
  color: #1e293b;
  font-size: 1.1rem;
  margin: 10px 0;
}

.hint-text {
  color: #64748b;
  font-size: 0.9rem;
  margin: 5px 0;
}

.diarization-results {
  margin-top: 20px;
}

.results-header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.results-header h5 {
  color: #10b981;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
}

.results-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stat-badge {
  padding: 8px 16px;
  background: #f1f5f9;
  color: #1e293b;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  border: 1px solid #e2e8f0;
}

.speaker-labels-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.speaker-labels-section h6 {
  color: #1e293b;
  margin: 0 0 15px 0;
  font-size: 1rem;
}

.speaker-labels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

/* Smart Speaker Identification Styles */
.smart-identify-section {
  margin-top: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 8px;
  border: 1px solid #bae6fd;
}

.smart-identify-header {
  margin-bottom: 15px;
}

.smart-identify-header h6 {
  color: #0369a1;
  margin: 0 0 8px 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.smart-identify-header p {
  color: #0c4a6e;
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.smart-identify-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.smart-identify-controls input {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid #38bdf8;
  border-radius: 6px;
  font-size: 0.95rem;
  background: white;
  transition: all 0.2s;
}

.smart-identify-controls input:focus {
  outline: none;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
}

.smart-identify-controls input::placeholder {
  color: #94a3b8;
}

.smart-identify-controls button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);
}

.smart-identify-controls button:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(2, 132, 199, 0.4);
}

.smart-identify-controls button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.ai-suggestions {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.ai-suggestions h6 {
  color: #0c4a6e;
  margin: 0 0 15px 0;
  font-size: 1rem;
  font-weight: 600;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.suggestion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s;
}

.suggestion-item:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateX(2px);
}

.suggestion-item.high-confidence {
  background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
  border-color: #22d3ee;
}

.suggestion-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.confidence-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  min-width: 60px;
  text-align: center;
  color: white;
}

.confidence-badge.high {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.confidence-badge.medium {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.confidence-badge.low {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  box-shadow: 0 2px 4px rgba(100, 116, 139, 0.3);
}

.segment-info {
  color: #64748b;
  font-size: 0.9rem;
}

.segment-info strong {
  color: #1e293b;
  font-weight: 600;
}

.apply-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(6, 182, 212, 0.3);
}

.apply-btn:hover {
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(6, 182, 212, 0.4);
}

.suggestions-list p {
  text-align: center;
  color: #64748b;
  padding: 20px;
  margin: 0;
  font-style: italic;
}

.bulk-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.bulk-actions button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.bulk-actions button:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.speaker-label-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 6px;
}

.speaker-id {
  font-weight: 600;
  color: #64748b;
  min-width: 100px;
  font-size: 0.9rem;
}

.speaker-label-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.speaker-label-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.speaker-timeline-visual {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.speaker-timeline-visual h6 {
  color: #1e293b;
  margin: 0 0 15px 0;
  font-size: 1rem;
}

.timeline-container {
  position: relative;
  height: 60px;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.timeline-bar {
  position: absolute;
  height: 100%;
  opacity: 0.85;
  transition: opacity 0.2s;
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
}

.timeline-bar:hover {
  opacity: 1;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.segments-list {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.segments-list h6 {
  color: #1e293b;
  margin: 0 0 15px 0;
  font-size: 1rem;
}

.segments-container {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.segment-item {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  transition: background 0.2s;
  cursor: pointer;
}

.segment-item:hover {
  background: #f8fafc;
}

.segment-item.active {
  background: #dbeafe;
  border-left: 4px solid #3b82f6;
}

.segment-item:last-child {
  border-bottom: none;
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.speaker-badge {
  padding: 4px 12px;
  color: white;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  min-width: 120px;
  text-align: center;
}

.segment-time {
  color: #64748b;
  font-size: 0.9rem;
  font-family: monospace;
}

.segment-duration {
  color: #94a3b8;
  font-size: 0.85rem;
}

.chunk-badge {
  padding: 2px 8px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
}

.btn-map-speaker {
  padding: 4px 10px;
  background: white;
  border: 2px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  margin-left: auto;
}

.btn-map-speaker:hover {
  background: #f1f5f9;
  transform: translateY(-1px);
}

.btn-map-speaker.mapped {
  background: #dbeafe;
  border-color: currentColor;
}

/* Speaker Mapping Section */
.speaker-mapping-section {
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 2px solid #cbd5e1;
}

.speaker-mapping-section h6 {
  color: #1e293b;
  margin: 0 0 10px 0;
  font-size: 1rem;
  font-weight: 600;
}

.mapping-help {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 15px 0;
  line-height: 1.5;
}

.blank-speaker-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.blank-tag-btn {
  padding: 8px 16px;
  background: white;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.blank-tag-btn:hover {
  background: #f8fafc;
  transform: translateY(-1px);
}

.blank-tag-btn.active {
  background: #dbeafe;
  border-color: currentColor;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.blank-tag-btn.new-tag {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.blank-tag-btn.new-tag:hover {
  background: #059669;
  border-color: #059669;
}

.blank-speaker-names {
  background: white;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.blank-speaker-names h6 {
  color: #1e293b;
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.speaker-name-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.speaker-name-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-label {
  font-weight: 600;
  font-size: 0.85rem;
  min-width: 150px;
}

.speaker-name-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
}

.speaker-name-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn-remove-tag {
  padding: 4px 8px;
  background: #fee2e2;
  color: #991b1b;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-remove-tag:hover {
  background: #fecaca;
}

/* Audio-Only Save Section Styles */
.save-audio-only-section {
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border: 2px solid #86efac;
}

.save-audio-only-section h2 {
  color: #166534;
}

.audio-metadata-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-top: 15px;
}

.audio-metadata-form .form-group {
  margin-bottom: 15px;
}

.audio-metadata-form label {
  display: block;
  margin-bottom: 5px;
  color: #374151;
  font-size: 0.95rem;
}

.audio-metadata-form .form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.95rem;
}

.audio-metadata-form .form-control:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.save-audio-btn {
  width: 100%;
  padding: 12px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}

.save-audio-btn:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.save-audio-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.no-audio-hint {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 1rem;
}

.login-hint {
  background: #fef3c7;
  padding: 10px 15px;
  border-radius: 6px;
  color: #92400e;
  margin-top: 10px;
  font-size: 0.9rem;
}

/* ========== END DIARIZATION STYLES ========== */
</style>
