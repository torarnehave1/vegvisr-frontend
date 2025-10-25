<template>
  <div class="youtube-worker-test">
    <div class="container">
      <h1>🎬 YouTube Worker Test Interface</h1>
      <p class="subtitle">Test all YouTube Worker endpoints and functionality</p>

      <!-- Status Section -->
      <div class="status-section">
        <h2>📊 Worker Status</h2>
        <div class="status-grid">
          <div class="status-card">
            <h4>Health Check</h4>
            <button @click="testHealth" :disabled="loading.health" class="btn btn-primary">
              <span v-if="loading.health" class="spinner"></span>
              Test Health
            </button>
            <div v-if="results.health" class="result" :class="results.health.success ? 'success' : 'error'">
              {{ results.health.message }}
            </div>
          </div>

          <div class="status-card">
            <h4>Authentication Status</h4>
            <div v-if="userEmail" class="auth-status success">
              ✅ Authenticated: {{ userEmail }}
              <button @click="logout" class="btn btn-small btn-secondary">Logout</button>
            </div>
            <div v-else class="auth-status error">
              ❌ Not authenticated
              <button @click="startAuth" class="btn btn-small btn-primary">Login</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Authentication Section -->
      <div class="section">
        <h2>🔐 Authentication</h2>
        <div class="auth-controls">
          <div class="form-group">
            <label for="email">User Email:</label>
            <input
              id="email"
              v-model="userEmail"
              type="email"
              placeholder="your@email.com"
              class="form-control"
            />
          </div>

          <div class="button-group">
            <button @click="startAuth" class="btn btn-primary">
              🔗 Start OAuth Flow
            </button>
            <button @click="checkCredentials" :disabled="!userEmail || loading.credentials" class="btn btn-secondary">
              <span v-if="loading.credentials" class="spinner"></span>
              🔍 Check Credentials
            </button>
            <button @click="deleteCredentials" :disabled="!userEmail || loading.delete" class="btn btn-danger">
              <span v-if="loading.delete" class="spinner"></span>
              🗑️ Delete Credentials
            </button>
          </div>
        </div>

        <div v-if="results.credentials" class="result" :class="results.credentials.success ? 'success' : 'error'">
          <pre>{{ JSON.stringify(results.credentials, null, 2) }}</pre>
        </div>
      </div>

      <!-- Video Upload Section -->
      <div class="section">
        <h2>📤 Video Upload</h2>
        <div class="upload-form">
          <div class="form-group">
            <label for="video-file">Video File:</label>
            <input
              id="video-file"
              type="file"
              @change="handleFileSelect"
              accept="video/*"
              class="form-control"
            />
            <small v-if="selectedFile" class="file-info">
              Selected: {{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
            </small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="video-title">Title:</label>
              <input
                id="video-title"
                v-model="uploadForm.title"
                type="text"
                placeholder="My Awesome Video"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label for="video-privacy">Privacy:</label>
              <select id="video-privacy" v-model="uploadForm.privacy" class="form-control">
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="video-description">Description:</label>
            <textarea
              id="video-description"
              v-model="uploadForm.description"
              placeholder="Video description..."
              rows="3"
              class="form-control"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="video-tags">Tags (comma-separated):</label>
            <input
              id="video-tags"
              v-model="uploadForm.tags"
              type="text"
              placeholder="tutorial, demo, awesome"
              class="form-control"
            />
          </div>

          <!-- Audio Extraction Option -->
          <div class="form-group audio-extract-option">
            <div class="checkbox-group">
              <input
                id="extract-audio"
                v-model="uploadForm.extractAudio"
                type="checkbox"
                class="checkbox"
              />
              <label for="extract-audio" class="checkbox-label">
                🎵 Also extract audio during upload
              </label>
            </div>
            <div v-if="uploadForm.extractAudio" class="audio-format-selection">
              <label for="upload-audio-format">Audio Format:</label>
              <select id="upload-audio-format" v-model="uploadForm.audioFormat" class="form-control form-control-small">
                <option value="mp3">MP3 (192 kbps)</option>
                <option value="wav">WAV (Lossless)</option>
                <option value="aac">AAC (Advanced)</option>
                <option value="flac">FLAC (Lossless)</option>
              </select>
            </div>
            <small v-if="uploadForm.extractAudio" class="help-text">
              💡 Audio will be extracted using FFmpeg and stored separately in R2 storage
            </small>
          </div>

          <button
            @click="uploadVideo"
            :disabled="!selectedFile || !userEmail || loading.upload"
            class="btn btn-primary btn-large"
          >
            <span v-if="loading.upload" class="spinner"></span>
            🎬 Upload Video
          </button>

          <div v-if="uploadProgress" class="upload-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <span>{{ uploadProgress }}%</span>
          </div>
        </div>

        <div v-if="results.upload" class="result" :class="results.upload.success ? 'success' : 'error'">
          <h4>Upload Result:</h4>
          <div v-if="results.upload.success" class="upload-success">
            <p><strong>Video ID:</strong> {{ results.upload.video_id }}</p>
            <p><strong>Title:</strong> {{ results.upload.title }}</p>
            <p><strong>Privacy:</strong> {{ results.upload.privacy_status }}</p>
            <a :href="results.upload.video_url" target="_blank" class="btn btn-primary btn-small">
              🔗 View on YouTube
            </a>

            <!-- Audio Extraction Results -->
            <div v-if="results.upload.audio_info" class="audio-extraction-results">
              <h5>🎵 Audio Extraction Results:</h5>
              <div v-if="results.upload.audio_info.success" class="audio-success-info">
                <p><strong>✅ Audio extracted successfully!</strong></p>
                <p><strong>📁 File:</strong> {{ results.upload.audio_info.file_name }}</p>
                <p><strong>🎵 Format:</strong> {{ results.upload.audio_info.format?.toUpperCase() }}</p>
                <p><strong>⏱️ Processing Time:</strong> {{ results.upload.audio_info.processing_time }}s</p>
                <div class="audio-actions">
                  <a :href="results.upload.audio_info.download_url" target="_blank" class="btn btn-secondary btn-small">
                    ⬇️ Download Audio
                  </a>
                  <button @click="playUploadAudioPreview" class="btn btn-secondary btn-small">
                    ▶️ Preview Audio
                  </button>
                </div>
                <!-- Audio Preview -->
                <audio v-if="uploadAudioPreviewUrl" :src="uploadAudioPreviewUrl" controls class="audio-preview">
                  Your browser doesn't support the audio element.
                </audio>
              </div>
              <div v-else class="audio-error-info">
                <p><strong>❌ Audio extraction failed:</strong> {{ results.upload.audio_info.error }}</p>
              </div>
            </div>
          </div>
          <pre v-else>{{ JSON.stringify(results.upload, null, 2) }}</pre>
        </div>
      </div>

      <!-- Video Download/Info Section -->
      <div class="section">
        <h2>📥 Video Information</h2>
        <div class="download-form">
          <div class="form-group">
            <label for="video-url">YouTube URL or Video ID:</label>
            <input
              id="video-url"
              v-model="downloadForm.videoUrl"
              type="text"
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
              class="form-control"
            />
          </div>

          <button
            @click="getVideoInfo"
            :disabled="!downloadForm.videoUrl || !userEmail || loading.download"
            class="btn btn-primary"
          >
            <span v-if="loading.download" class="spinner"></span>
            📊 Get Video Info
          </button>
        </div>

        <div v-if="results.download" class="result" :class="results.download.success ? 'success' : 'error'">
          <div v-if="results.download.success" class="video-info">
            <div class="video-header">
              <img
                v-if="results.download.thumbnails?.medium?.url"
                :src="results.download.thumbnails.medium.url"
                :alt="results.download.title"
                class="video-thumbnail"
              />
              <div class="video-details">
                <h4>{{ results.download.title }}</h4>
                <p><strong>Channel:</strong> {{ results.download.channel_title }}</p>
                <p><strong>Duration:</strong> {{ results.download.duration }}</p>
                <p><strong>Views:</strong> {{ formatNumber(results.download.view_count) }}</p>
                <p><strong>Likes:</strong> {{ formatNumber(results.download.like_count) }}</p>
                <div class="video-links">
                  <a :href="results.download.video_url" target="_blank" class="btn btn-primary btn-small">
                    🔗 Watch on YouTube
                  </a>
                  <a :href="results.download.embed_url" target="_blank" class="btn btn-secondary btn-small">
                    📺 Embed URL
                  </a>
                </div>
              </div>
            </div>
            <div class="video-description">
              <h5>Description:</h5>
              <p>{{ results.download.description || 'No description available' }}</p>
            </div>
          </div>
          <pre v-else>{{ JSON.stringify(results.download, null, 2) }}</pre>
        </div>
      </div>

      <!-- Channel Videos Section -->
      <div class="section">
        <h2>📺 Channel Videos</h2>
        <div class="videos-form">
          <div class="form-row">
            <div class="form-group">
              <label for="max-results">Max Results:</label>
              <select id="max-results" v-model="videosForm.maxResults" class="form-control">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <button
            @click="getChannelVideos"
            :disabled="!userEmail || loading.videos"
            class="btn btn-primary"
          >
            <span v-if="loading.videos" class="spinner"></span>
            📋 Get My Videos
          </button>
        </div>

        <div v-if="results.videos" class="result" :class="results.videos.success ? 'success' : 'error'">
          <div v-if="results.videos.success" class="videos-list">
            <div class="videos-header">
              <h4>{{ results.videos.total_results }} videos found</h4>
              <p><strong>Channel ID:</strong> {{ results.videos.channel_id }}</p>
              <p v-if="results.videos.note" class="privacy-note">{{ results.videos.note }}</p>
            </div>

            <div class="videos-grid">
              <div
                v-for="video in results.videos.videos"
                :key="video.video_id"
                class="video-card"
                :class="'privacy-' + (video.privacy_status || 'unknown')"
              >
                <img
                  v-if="video.thumbnails?.medium?.url"
                  :src="video.thumbnails.medium.url"
                  :alt="video.title"
                  class="video-card-thumbnail"
                />
                <div class="video-card-content">
                  <h5>{{ video.title }}</h5>
                  <p class="video-published">{{ formatDate(video.published_at) }}</p>

                  <!-- Privacy Status Badge -->
                  <div class="video-meta">
                    <span
                      class="privacy-badge"
                      :class="'privacy-' + (video.privacy_status || 'unknown')"
                      :title="'Privacy: ' + (video.privacy_status || 'unknown')"
                    >
                      {{ getPrivacyIcon(video.privacy_status) }} {{ formatPrivacyStatus(video.privacy_status) }}
                    </span>

                    <!-- Video Stats -->
                    <div class="video-stats">
                      <span v-if="video.view_count" title="Views">👁️ {{ formatNumber(video.view_count) }}</span>
                      <span v-if="video.like_count" title="Likes">👍 {{ formatNumber(video.like_count) }}</span>
                      <span v-if="video.duration" title="Duration">⏱️ {{ formatDuration(video.duration) }}</span>
                    </div>
                  </div>

                  <div class="video-actions">
                    <a :href="video.video_url" target="_blank" class="btn btn-primary btn-small">
                      🔗 Watch
                    </a>
                    <button @click="loadVideoInfo(video.video_id)" class="btn btn-secondary btn-small">
                      📊 Info
                    </button>
                    <button @click="loadVideoForEdit(video)" class="btn btn-warning btn-small">
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="results.videos.next_page_token" class="pagination">
              <button @click="getNextPage" class="btn btn-secondary">
                ➡️ Load More Videos
              </button>
            </div>
          </div>
          <pre v-else>{{ JSON.stringify(results.videos, null, 2) }}</pre>
        </div>
      </div>

      <!-- Video Update Section -->
      <div class="section">
        <h2>✏️ Update Video Metadata</h2>
        <div class="update-form">
          <div class="form-group">
            <label for="update-video-id">Video ID or YouTube URL:</label>
            <input
              id="update-video-id"
              v-model="updateForm.videoId"
              type="text"
              placeholder="dQw4w9WgXcQ or https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              class="form-control"
            />
            <small class="helper-text">You can get the video ID from the channel videos list above</small>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="update-title">New Title (optional):</label>
              <input
                id="update-title"
                v-model="updateForm.title"
                type="text"
                placeholder="Leave empty to keep current title"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label for="update-privacy">Privacy Status (optional):</label>
              <select id="update-privacy" v-model="updateForm.privacy" class="form-control">
                <option value="">Keep current</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="update-description">New Description (optional):</label>
            <textarea
              id="update-description"
              v-model="updateForm.description"
              placeholder="Leave empty to keep current description"
              rows="4"
              class="form-control"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="update-tags">Tags (optional, comma-separated):</label>
            <input
              id="update-tags"
              v-model="updateForm.tags"
              type="text"
              placeholder="tag1, tag2, tag3 (leave empty to keep current tags)"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="update-category">Category ID (optional):</label>
            <select id="update-category" v-model="updateForm.categoryId" class="form-control">
              <option value="">Keep current</option>
              <option value="1">Film & Animation</option>
              <option value="2">Autos & Vehicles</option>
              <option value="10">Music</option>
              <option value="15">Pets & Animals</option>
              <option value="17">Sports</option>
              <option value="19">Travel & Events</option>
              <option value="20">Gaming</option>
              <option value="22">People & Blogs</option>
              <option value="23">Comedy</option>
              <option value="24">Entertainment</option>
              <option value="25">News & Politics</option>
              <option value="26">Howto & Style</option>
              <option value="27">Education</option>
              <option value="28">Science & Technology</option>
            </select>
          </div>

          <button
            @click="updateVideo"
            :disabled="!updateForm.videoId || !userEmail || loading.update"
            class="btn btn-primary btn-large"
          >
            <span v-if="loading.update" class="spinner"></span>
            ✏️ Update Video
          </button>

          <div class="update-help">
            <h5>💡 Update Tips:</h5>
            <ul>
              <li><strong>Selective Updates:</strong> Only fill in the fields you want to change</li>
              <li><strong>Private Videos:</strong> You can update private videos just like public ones</li>
              <li><strong>Privacy Changes:</strong> Be careful when changing from private to public</li>
              <li><strong>Tags:</strong> Separate multiple tags with commas</li>
            </ul>
          </div>
        </div>

        <div v-if="results.update" class="result" :class="results.update.success ? 'success' : 'error'">
          <h4>Update Result:</h4>
          <div v-if="results.update.success" class="update-success">
            <p><strong>✅ {{ results.update.message }}</strong></p>
            <div class="updated-fields">
              <h5>Updated Fields:</h5>
              <p><strong>Title:</strong> {{ results.update.updated_fields.title }}</p>
              <p><strong>Privacy:</strong> {{ results.update.updated_fields.privacy_status }}</p>
              <p v-if="results.update.updated_fields.description"><strong>Description:</strong> {{ results.update.updated_fields.description.substring(0, 100) }}{{ results.update.updated_fields.description.length > 100 ? '...' : '' }}</p>
              <p v-if="results.update.updated_fields.tags?.length"><strong>Tags:</strong> {{ results.update.updated_fields.tags.join(', ') }}</p>
            </div>
            <a :href="results.update.video_url" target="_blank" class="btn btn-primary btn-small">
              🔗 View Updated Video
            </a>
          </div>
          <pre v-else>{{ JSON.stringify(results.update, null, 2) }}</pre>
        </div>
      </div>

      <!-- Audio Extraction Section -->
      <div class="section">
        <h2>🎵 Audio Extraction (YouTube → FFmpeg)</h2>
        <div class="audio-extraction">
          <div class="workflow-info">
            <h4>📋 Workflow:</h4>
            <ol>
              <li><strong>Step 1:</strong> Download video from YouTube using your worker</li>
              <li><strong>Step 2:</strong> Extract audio using vegvisr-container FFmpeg service → Get direct download link</li>
            </ol>
            <p class="workflow-note">💡 The vegvisr-container returns a direct download URL for the extracted audio stored in Cloudflare R2</p>
          </div>

          <div class="form-group">
            <label for="audio-video-id">Video ID or URL:</label>
            <input
              id="audio-video-id"
              v-model="audioForm.videoId"
              type="text"
              placeholder="dQw4w9WgXcQ or full YouTube URL"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="audio-format">Audio Format:</label>
            <select id="audio-format" v-model="audioForm.format" class="form-control">
              <option value="mp3">MP3 (192 kbps)</option>
              <option value="wav">WAV (Lossless)</option>
              <option value="aac">AAC (Advanced)</option>
              <option value="flac">FLAC (Lossless)</option>
            </select>
          </div>

          <div class="button-group">
            <button
              @click="extractAudio"
              :disabled="!audioForm.videoId || !userEmail || loading.audio"
              class="btn btn-primary btn-large"
            >
              <span v-if="loading.audio" class="spinner"></span>
              🎵 Extract Audio
            </button>
          </div>

          <!-- Progress Display -->
          <div v-if="audioProgress.step" class="audio-progress">
            <h4>🔄 Processing Progress:</h4>
            <div class="progress-steps">
              <div class="progress-step" :class="{ active: audioProgress.step >= 1, complete: audioProgress.step > 1 }">
                <span class="step-number">1</span>
                <span class="step-text">Download from YouTube</span>
                <span v-if="audioProgress.step === 1" class="spinner-small"></span>
                <span v-if="audioProgress.step > 1">✅</span>
              </div>
              <div class="progress-step" :class="{ active: audioProgress.step >= 2, complete: audioProgress.step > 2 }">
                <span class="step-number">2</span>
                <span class="step-text">Extract Audio (FFmpeg) → Get Download Link</span>
                <span v-if="audioProgress.step === 2" class="spinner-small"></span>
                <span v-if="audioProgress.step > 2">✅</span>
              </div>
            </div>
            <div v-if="audioProgress.message" class="progress-message">
              {{ audioProgress.message }}
            </div>
          </div>

          <!-- Results Display -->
          <div v-if="results.audio" class="result" :class="results.audio.success ? 'success' : 'error'">
            <h4>Audio Extraction Result:</h4>
            <div v-if="results.audio.success" class="audio-success">
              <p><strong>✅ {{ results.audio.message }}</strong></p>
              <div class="audio-info">
                <p><strong>📁 File:</strong> {{ results.audio.file_name }}</p>
                <p><strong>🌐 Format:</strong> {{ audioForm.format.toUpperCase() }}</p>
                <p><strong>⏱️ Processing Time:</strong> {{ results.audio.processing_time }}s</p>
                <div class="audio-actions">
                  <a :href="results.audio.download_url" target="_blank" class="btn btn-primary">
                    ⬇️ Download Audio
                  </a>
                  <button @click="playAudioPreview" class="btn btn-secondary">
                    ▶️ Preview Audio
                  </button>
                </div>
              </div>
              <!-- Audio Preview -->
              <audio v-if="audioPreviewUrl" :src="audioPreviewUrl" controls class="audio-preview">
                Your browser doesn't support the audio element.
              </audio>
            </div>
            <pre v-else>{{ JSON.stringify(results.audio, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <!-- Raw API Testing Section -->
      <div class="section">
        <h2>🔧 Raw API Testing</h2>
        <div class="api-tester">
          <div class="form-group">
            <label for="api-endpoint">Endpoint:</label>
            <select id="api-endpoint" v-model="apiTest.endpoint" class="form-control">
              <option value="/health">GET /health</option>
              <option value="/credentials">POST /credentials</option>
              <option value="/upload">POST /upload</option>
              <option value="/download">POST /download</option>
              <option value="/videos">POST /videos</option>
              <option value="/update-video">POST /update-video</option>
            </select>
          </div>

          <div class="form-group">
            <label for="api-payload">Request Payload (JSON):</label>
            <textarea
              id="api-payload"
              v-model="apiTest.payload"
              rows="6"
              placeholder='{"user_email": "test@example.com"}'
              class="form-control"
            ></textarea>
          </div>

          <button @click="testRawAPI" :disabled="loading.api" class="btn btn-primary">
            <span v-if="loading.api" class="spinner"></span>
            🧪 Test API
          </button>

          <div v-if="results.api" class="result">
            <h4>API Response:</h4>
            <pre>{{ JSON.stringify(results.api, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

// Reactive state
const userEmail = ref('')
const selectedFile = ref(null)
const uploadProgress = ref(0)

const loading = reactive({
  health: false,
  credentials: false,
  delete: false,
  upload: false,
  download: false,
  videos: false,
  update: false,
  api: false,
  audio: false
})

const results = reactive({
  health: null,
  credentials: null,
  upload: null,
  download: null,
  videos: null,
  update: null,
  api: null,
  audio: null
})

const uploadForm = reactive({
  title: '',
  description: '',
  privacy: 'private',
  tags: '',
  extractAudio: false,
  audioFormat: 'mp3'
})

const downloadForm = reactive({
  videoUrl: ''
})

const videosForm = reactive({
  maxResults: 25,
  pageToken: null
})

const updateForm = reactive({
  videoId: '',
  title: '',
  description: '',
  privacy: '',
  tags: '',
  categoryId: ''
})

const apiTest = reactive({
  endpoint: '/health',
  payload: '{"user_email": "test@example.com"}'
})

const audioForm = reactive({
  videoId: '',
  format: 'mp3'
})

const audioProgress = reactive({
  step: 0,
  message: ''
})

const audioPreviewUrl = ref('')
const uploadAudioPreviewUrl = ref('')

// Constants
const WORKER_BASE_URL = 'https://youtube.vegvisr.org'
const AUDIO_WORKER_BASE_URL = 'https://vegvisr-container.torarnehave.workers.dev'

// Utility functions
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatNumber = (num) => {
  if (!num) return '0'
  return new Intl.NumberFormat().format(num)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString()
}

const formatPrivacyStatus = (status) => {
  const statusMap = {
    'public': 'Public',
    'private': 'Private',
    'unlisted': 'Unlisted',
    'unknown': 'Unknown'
  }
  return statusMap[status] || status || 'Unknown'
}

const getPrivacyIcon = (status) => {
  const iconMap = {
    'public': '🌍',
    'private': '🔒',
    'unlisted': '🔗',
    'unknown': '❓'
  }
  return iconMap[status] || '❓'
}

const formatDuration = (duration) => {
  if (!duration) return '0:00'

  // Parse ISO 8601 duration (PT4M13S format)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return duration

  const hours = parseInt(match[1]) || 0
  const minutes = parseInt(match[2]) || 0
  const seconds = parseInt(match[3]) || 0

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// API functions
const testHealth = async () => {
  loading.health = true
  try {
    const response = await fetch(`${WORKER_BASE_URL}/health`)
    const text = await response.text()
    results.health = {
      success: response.ok,
      message: text,
      status: response.status
    }
  } catch (error) {
    results.health = {
      success: false,
      message: error.message
    }
  } finally {
    loading.health = false
  }
}

const startAuth = () => {
  window.open(`${WORKER_BASE_URL}/auth`, '_blank')
}

const checkCredentials = async () => {
  if (!userEmail.value) {
    alert('Please enter your email address')
    return
  }

  loading.credentials = true
  try {
    const response = await fetch(`${WORKER_BASE_URL}/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail.value
      })
    })

    results.credentials = await response.json()
  } catch (error) {
    results.credentials = {
      success: false,
      error: error.message
    }
  } finally {
    loading.credentials = false
  }
}

const deleteCredentials = async () => {
  if (!userEmail.value) {
    alert('Please enter your email address')
    return
  }

  if (!confirm('Are you sure you want to delete your YouTube credentials?')) {
    return
  }

  loading.delete = true
  try {
    const response = await fetch(`${WORKER_BASE_URL}/credentials`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail.value
      })
    })

    const result = await response.json()
    results.credentials = result

    if (result.success) {
      alert('Credentials deleted successfully')
    }
  } catch (error) {
    results.credentials = {
      success: false,
      error: error.message
    }
  } finally {
    loading.delete = false
  }
}

const handleFileSelect = (event) => {
  selectedFile.value = event.target.files[0]
}

const uploadVideo = async () => {
  if (!selectedFile.value || !userEmail.value) {
    alert('Please select a video file and enter your email')
    return
  }

  loading.upload = true
  uploadProgress.value = 0
  let audioExtractionResult = null

  try {
    const formData = new FormData()
    formData.append('user_email', userEmail.value)
    formData.append('video', selectedFile.value)
    formData.append('title', uploadForm.title || 'Untitled Video')
    formData.append('description', uploadForm.description)
    formData.append('privacy', uploadForm.privacy)
    formData.append('tags', uploadForm.tags)

    // Simulate upload progress (real progress would need server-sent events or websockets)
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 70) {
        uploadProgress.value += Math.random() * 10
      }
    }, 500)

    // Step 1: Upload to YouTube
    const response = await fetch(`${WORKER_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    })

    clearInterval(progressInterval)
    uploadProgress.value = 80

    results.upload = await response.json()

    // Step 2: If audio extraction is requested and upload was successful
    if (results.upload.success && uploadForm.extractAudio) {
      uploadProgress.value = 85

      try {
        // We need to store the video file temporarily in R2 and get a public URL
        // This requires modifying the YouTube worker to return a temporary R2 URL
        // For now, let's show this is where the audio extraction would happen

        const instanceId = `youtube-upload-${Date.now()}`

        // TODO: This needs the YouTube worker to provide a temporary R2 URL of the uploaded video
        // The workflow should be:
        // 1. YouTube worker uploads to YouTube AND stores copy in R2
        // 2. Returns both YouTube URL and temporary R2 URL
        // 3. We use R2 URL for audio extraction
        // 4. Clean up R2 temp file after extraction

        audioExtractionResult = {
          success: false,
          error: 'Audio extraction requires YouTube worker to provide temporary R2 video URL',
          note: 'YouTube worker needs modification to store video temporarily in R2 during upload'
        }

      } catch (audioError) {
        audioExtractionResult = {
          success: false,
          error: `Audio extraction failed: ${audioError.message}`
        }
      }

      uploadProgress.value = 100
    } else {
      uploadProgress.value = 100
    }

    // Add audio extraction results if attempted
    if (audioExtractionResult) {
      results.upload.audio_info = audioExtractionResult
    }

    if (results.upload.success) {
      // Reset form but keep audio extraction preference
      selectedFile.value = null
      uploadForm.title = ''
      uploadForm.description = ''
      uploadForm.tags = ''
      // Don't reset extractAudio and audioFormat so user doesn't have to re-select
      const fileInput = document.getElementById('video-file')
      if (fileInput) fileInput.value = ''
    }
  } catch (error) {
    results.upload = {
      success: false,
      error: error.message
    }
  } finally {
    loading.upload = false
    setTimeout(() => {
      uploadProgress.value = 0
    }, 2000)
  }
}

const getVideoInfo = async () => {
  if (!downloadForm.videoUrl || !userEmail.value) {
    alert('Please enter a YouTube URL and your email')
    return
  }

  loading.download = true
  try {
    const response = await fetch(`${WORKER_BASE_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail.value,
        video_url: downloadForm.videoUrl
      })
    })

    results.download = await response.json()
  } catch (error) {
    results.download = {
      success: false,
      error: error.message
    }
  } finally {
    loading.download = false
  }
}

const getChannelVideos = async () => {
  if (!userEmail.value) {
    alert('Please enter your email address')
    return
  }

  loading.videos = true
  try {
    const response = await fetch(`${WORKER_BASE_URL}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail.value,
        max_results: parseInt(videosForm.maxResults),
        page_token: videosForm.pageToken
      })
    })

    results.videos = await response.json()
  } catch (error) {
    results.videos = {
      success: false,
      error: error.message
    }
  } finally {
    loading.videos = false
  }
}

const getNextPage = async () => {
  if (results.videos && results.videos.next_page_token) {
    videosForm.pageToken = results.videos.next_page_token
    await getChannelVideos()
  }
}

const loadVideoInfo = (videoId) => {
  downloadForm.videoUrl = videoId
  getVideoInfo()
}

const loadVideoForEdit = (video) => {
  // Populate the update form with current video data
  updateForm.videoId = video.video_id
  updateForm.title = video.title || ''
  updateForm.description = video.description || ''
  updateForm.privacy = video.privacy_status || ''
  updateForm.tags = Array.isArray(video.tags) ? video.tags.join(', ') : (video.tags || '')
  updateForm.categoryId = video.category_id || ''

  // Scroll to the update section
  const updateSection = document.querySelector('.section:has(h2:contains("Update Video Metadata"))')
  if (updateSection) {
    updateSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    // Alternative selector if the above doesn't work
    const sections = document.querySelectorAll('.section h2')
    for (const section of sections) {
      if (section.textContent.includes('Update Video Metadata')) {
        section.closest('.section').scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }

  // Add visual feedback
  setTimeout(() => {
    const updateForm = document.querySelector('#update-video-id')
    if (updateForm) {
      updateForm.focus()
      updateForm.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.3)'
      setTimeout(() => {
        updateForm.style.boxShadow = ''
      }, 2000)
    }
  }, 500)
}

const updateVideo = async () => {
  if (!updateForm.videoId || !userEmail.value) {
    alert('Please enter a video ID and your email')
    return
  }

  // Extract video ID from URL if provided
  let videoId = updateForm.videoId
  const urlMatch = updateForm.videoId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (urlMatch) {
    videoId = urlMatch[1]
  }

  loading.update = true
  try {
    const updateData = {
      user_email: userEmail.value,
      video_id: videoId
    }

    // Only include fields that have values
    if (updateForm.title.trim()) updateData.title = updateForm.title.trim()
    if (updateForm.description.trim()) updateData.description = updateForm.description.trim()
    if (updateForm.privacy) updateData.privacy_status = updateForm.privacy
    if (updateForm.tags.trim()) updateData.tags = updateForm.tags.trim()
    if (updateForm.categoryId) updateData.category_id = updateForm.categoryId

    const response = await fetch(`${WORKER_BASE_URL}/update-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    })

    results.update = await response.json()

    if (results.update.success) {
      // Reset form on success
      updateForm.videoId = ''
      updateForm.title = ''
      updateForm.description = ''
      updateForm.privacy = ''
      updateForm.tags = ''
      updateForm.categoryId = ''

      // Refresh video list if it's currently displayed
      if (results.videos && results.videos.success) {
        await getChannelVideos()
      }
    }
  } catch (error) {
    results.update = {
      success: false,
      error: error.message
    }
  } finally {
    loading.update = false
  }
}

const testRawAPI = async () => {
  loading.api = true
  try {
    const url = `${WORKER_BASE_URL}${apiTest.endpoint}`
    let options = {
      method: apiTest.endpoint === '/health' ? 'GET' : 'POST'
    }

    if (options.method === 'POST') {
      options.headers = {
        'Content-Type': 'application/json',
      }
      options.body = apiTest.payload
    }

    const response = await fetch(url, options)

    if (response.headers.get('content-type')?.includes('application/json')) {
      results.api = await response.json()
    } else {
      const text = await response.text()
      results.api = {
        status: response.status,
        text: text
      }
    }
  } catch (error) {
    results.api = {
      error: error.message
    }
  } finally {
    loading.api = false
  }
}

// Audio extraction functions
const extractAudio = async () => {
  if (!audioForm.videoId || !userEmail.value) {
    alert('Please provide a video ID and ensure you are authenticated')
    return
  }

  loading.audio = true
  results.audio = null
  audioProgress.step = 0
  audioProgress.message = ''
  audioPreviewUrl.value = ''

  const startTime = Date.now()

  try {
    // Step 1: Download video from YouTube
    audioProgress.step = 1
    audioProgress.message = 'Downloading video from YouTube...'

    const videoId = extractVideoId(audioForm.videoId)
    const downloadResponse = await fetch(`${WORKER_BASE_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_email: userEmail.value,
        video_url: videoId,
        format: 'mp4'
      })
    })

    const downloadResult = await downloadResponse.json()

    if (!downloadResult.success) {
      throw new Error(`YouTube download failed: ${downloadResult.error}`)
    }

    // Step 2: Extract audio using vegvisr-container
    audioProgress.step = 2
    audioProgress.message = 'Extracting audio using FFmpeg...'

    const instanceId = `youtube-audio-${Date.now()}`
    const audioResponse = await fetch(`${AUDIO_WORKER_BASE_URL}/ffmpeg/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: downloadResult.download_url,
        output_format: audioForm.format
      })
    })

    const audioResult = await audioResponse.json()

    if (!audioResult.success) {
      throw new Error(`Audio extraction failed: ${audioResult.error}`)
    }

    // Success!
    audioProgress.step = 3
    const processingTime = Math.round((Date.now() - startTime) / 1000)

    results.audio = {
      success: true,
      message: 'Audio extracted successfully!',
      file_name: audioResult.file_name,
      download_url: `${AUDIO_WORKER_BASE_URL}${audioResult.download_url}`,
      processing_time: processingTime,
      video_id: videoId,
      format: audioForm.format
    }

    audioProgress.message = `✅ Complete! Audio ready for download (${processingTime}s)`

  } catch (error) {
    results.audio = {
      success: false,
      error: error.message,
      processing_time: Math.round((Date.now() - startTime) / 1000)
    }
    audioProgress.step = 0
    audioProgress.message = `❌ Failed: ${error.message}`
  } finally {
    loading.audio = false
  }
}

const playAudioPreview = () => {
  if (results.audio?.download_url) {
    audioPreviewUrl.value = results.audio.download_url
  }
}

const playUploadAudioPreview = () => {
  if (results.upload?.audio_info?.download_url) {
    uploadAudioPreviewUrl.value = results.upload.audio_info.download_url
  }
}

// Helper function to extract video ID from URL or return as-is if already an ID
const extractVideoId = (input) => {
  if (!input) return ''

  // If it's already a video ID (11 characters), return as-is
  if (input.length === 11 && !input.includes('/')) {
    return input
  }

  // Extract from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) return match[1]
  }

  return input // Return original if no pattern matches
}

const logout = () => {
  userEmail.value = ''
  results.credentials = null
  // Clear persisted authentication
  localStorage.removeItem('youtube_worker_user_email')
}

// Check for auth success on mount
onMounted(() => {
  // First, try to restore email from localStorage
  const savedEmail = localStorage.getItem('youtube_worker_user_email')
  if (savedEmail) {
    userEmail.value = savedEmail
  }

  // Then check for new auth from URL params
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('youtube_auth_success')) {
    const email = urlParams.get('user_email')
    if (email) {
      userEmail.value = email
      // Persist the email to localStorage
      localStorage.setItem('youtube_worker_user_email', email)
      alert('YouTube authentication successful!')
    }
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (urlParams.get('youtube_auth_error')) {
    const error = urlParams.get('youtube_auth_error')
    alert('YouTube authentication failed: ' + error)
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname)
  }
})
</script>

<style scoped>
.youtube-worker-test {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

h1 {
  text-align: center;
  color: white;
  font-size: 2.5rem;
  margin-bottom: 10px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.subtitle {
  text-align: center;
  color: rgba(255,255,255,0.9);
  font-size: 1.1rem;
  margin-bottom: 40px;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}

.status-section {
  background: linear-gradient(45deg, #f093fb 0%, #f5576c 100%);
  color: white;
  margin-bottom: 30px;
}

.status-section h2 {
  color: white;
  margin-bottom: 20px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.status-card {
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.status-card h4 {
  margin-bottom: 15px;
  color: white;
}

.auth-status {
  padding: 10px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.auth-status.success {
  background: rgba(40, 167, 69, 0.2);
  border: 1px solid rgba(40, 167, 69, 0.3);
}

.auth-status.error {
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid rgba(220, 53, 69, 0.3);
}

h2 {
  color: #333;
  margin-bottom: 25px;
  font-size: 1.8rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
  transform: translateY(-1px);
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
  transform: translateY(-1px);
}

.btn-small {
  padding: 8px 16px;
  font-size: 14px;
}

.btn-large {
  padding: 16px 32px;
  font-size: 18px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.result {
  margin-top: 20px;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid;
}

.result.success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.result.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.result pre {
  background: rgba(0,0,0,0.05);
  padding: 15px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 14px;
  margin: 10px 0 0 0;
}

.file-info {
  color: #666;
  font-style: italic;
  margin-top: 5px;
  display: block;
}

.upload-progress {
  margin-top: 15px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(45deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.upload-success {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.video-header {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.video-thumbnail {
  width: 200px;
  height: auto;
  border-radius: 8px;
}

.video-details {
  flex: 1;
}

.video-details h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.video-details p {
  margin: 5px 0;
  color: #666;
}

.video-links {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.video-description {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.video-description h5 {
  margin: 0 0 10px 0;
  color: #333;
}

.videos-header {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.videos-header h4 {
  margin: 0 0 5px 0;
  color: #333;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.video-card {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.video-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.video-card-thumbnail {
  width: 100%;
  height: 180px;
  object-fit: cover;
}

.video-card-content {
  padding: 15px;
}

.video-card-content h5 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 16px;
  line-height: 1.3;
}

.video-published {
  color: #666;
  font-size: 14px;
  margin: 5px 0 15px 0;
}

.video-actions {
  display: flex;
  gap: 8px;
}

.pagination {
  text-align: center;
  margin-top: 30px;
}

.api-tester {
  border: 2px dashed #dee2e6;
  border-radius: 8px;
  padding: 20px;
  background: #f8f9fa;
}

/* Privacy and Video Metadata Styles */
.privacy-note {
  color: #6c757d;
  font-style: italic;
  margin: 5px 0;
}

.video-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0;
}

.privacy-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.privacy-badge.privacy-public {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.privacy-badge.privacy-private {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.privacy-badge.privacy-unlisted {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.privacy-badge.privacy-unknown {
  background: #e2e3e5;
  color: #6c757d;
  border: 1px solid #d6d8db;
}

.video-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.video-stats span {
  font-size: 12px;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 3px;
}

/* Video card privacy styling */
.video-card.privacy-private {
  border-left: 4px solid #dc3545;
}

.video-card.privacy-unlisted {
  border-left: 4px solid #ffc107;
}

.video-card.privacy-public {
  border-left: 4px solid #28a745;
}

/* Update Form Styles */
.update-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.helper-text {
  color: #6c757d;
  font-size: 0.85rem;
  font-style: italic;
  margin-top: 5px;
  display: block;
}

.update-help {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 6px;
  padding: 15px;
  margin-top: 20px;
}

.update-help h5 {
  margin: 0 0 10px 0;
  color: #0056b3;
}

.update-help ul {
  margin: 0;
  padding-left: 20px;
}

.update-help li {
  margin-bottom: 5px;
  color: #495057;
}

.update-success {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.updated-fields {
  background: rgba(40, 167, 69, 0.1);
  border-radius: 6px;
  padding: 15px;
}

.updated-fields h5 {
  margin: 0 0 10px 0;
  color: #155724;
}

.updated-fields p {
  margin: 5px 0;
  color: #155724;
}

/* Audio extraction styles */
/* Audio extraction styles */
.audio-extract-option {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
}

.checkbox-group {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.checkbox {
  margin-right: 10px;
  transform: scale(1.2);
}

.checkbox-label {
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  margin: 0;
}

.audio-format-selection {
  margin: 10px 0;
  padding-left: 25px;
}

.audio-format-selection label {
  font-size: 14px;
  margin-bottom: 5px;
  display: block;
}

.form-control-small {
  max-width: 200px;
}

.help-text {
  color: #6c757d;
  font-style: italic;
  display: block;
  margin-top: 8px;
}

.audio-extraction-results {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 6px;
  padding: 15px;
  margin-top: 20px;
}

.audio-extraction-results h5 {
  margin: 0 0 15px 0;
  color: #1565c0;
}

.audio-success-info {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  padding: 15px;
  margin: 10px 0;
}

.audio-success-info p {
  margin: 8px 0;
  color: #155724;
}

.audio-error-info {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 15px;
  margin: 10px 0;
}

.audio-error-info p {
  margin: 8px 0;
  color: #721c24;
}

.audio-actions {
  margin: 15px 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.audio-actions .btn-small {
  padding: 6px 12px;
  font-size: 13px;
}

.audio-extraction {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #6c5ce7;
}

.workflow-info {
  background: #e3f2fd;
  padding: 15px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.workflow-info ol {
  margin: 10px 0 0 0;
  padding-left: 20px;
}

.workflow-note {
  margin: 10px 0 0 0;
  font-style: italic;
  color: #666;
}

.audio-progress {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 20px;
  margin: 20px 0;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.progress-step {
  display: flex;
  align-items: center;
  flex: 1;
  padding: 10px;
  margin: 0 5px;
  background: #f8f9fa;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.progress-step.active {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
}

.progress-step.complete {
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.step-number {
  background: #6c757d;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  margin-right: 10px;
  flex-shrink: 0;
}

.progress-step.active .step-number {
  background: #ffc107;
  color: #000;
}

.progress-step.complete .step-number {
  background: #28a745;
}

.step-text {
  font-size: 14px;
  flex: 1;
}

.spinner-small {
  margin-left: 8px;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #6c5ce7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.progress-message {
  text-align: center;
  font-weight: 500;
  color: #495057;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.audio-success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
  padding: 20px;
}

.audio-info {
  margin: 15px 0;
}

.audio-info p {
  margin: 8px 0;
  color: #155724;
}

.audio-actions {
  margin: 15px 0;
  display: flex;
  gap: 10px;
}

.audio-preview {
  width: 100%;
  margin-top: 15px;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .container {
    padding: 0 15px;
  }

  h1 {
    font-size: 2rem;
  }

  .section {
    padding: 20px;
  }

  .button-group {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }

  .video-header {
    flex-direction: column;
  }

  .video-thumbnail {
    width: 100%;
    max-width: 300px;
    align-self: center;
  }

  .videos-grid {
    grid-template-columns: 1fr;
  }
}
</style>
