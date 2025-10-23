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
            </div>

            <div class="videos-grid">
              <div
                v-for="video in results.videos.videos"
                :key="video.video_id"
                class="video-card"
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
                  <div class="video-actions">
                    <a :href="video.video_url" target="_blank" class="btn btn-primary btn-small">
                      🔗 Watch
                    </a>
                    <button @click="loadVideoInfo(video.video_id)" class="btn btn-secondary btn-small">
                      📊 Info
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
  api: false
})

const results = reactive({
  health: null,
  credentials: null,
  upload: null,
  download: null,
  videos: null,
  api: null
})

const uploadForm = reactive({
  title: '',
  description: '',
  privacy: 'private',
  tags: ''
})

const downloadForm = reactive({
  videoUrl: ''
})

const videosForm = reactive({
  maxResults: 25,
  pageToken: null
})

const apiTest = reactive({
  endpoint: '/health',
  payload: '{"user_email": "test@example.com"}'
})

// Constants
const WORKER_BASE_URL = 'https://youtube.vegvisr.org'

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
      if (uploadProgress.value < 90) {
        uploadProgress.value += Math.random() * 10
      }
    }, 500)

    const response = await fetch(`${WORKER_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    })

    clearInterval(progressInterval)
    uploadProgress.value = 100

    results.upload = await response.json()

    if (results.upload.success) {
      // Reset form
      selectedFile.value = null
      uploadForm.title = ''
      uploadForm.description = ''
      uploadForm.tags = ''
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

const logout = () => {
  userEmail.value = ''
  results.credentials = null
}

// Check for auth success on mount
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('youtube_auth_success')) {
    const email = urlParams.get('user_email')
    if (email) {
      userEmail.value = email
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
