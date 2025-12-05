<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <button @click="close" class="close-button">&times;</button>
      <h3>🎙️ Automated Transcript to Knowledge Graph</h3>

      <!-- Input Method Tabs -->
      <div class="input-tabs">
        <button
          @click="inputMethod = 'upload'"
          :class="{ active: inputMethod === 'upload' }"
          class="tab-button"
        >
          📁 Upload File
        </button>
        <button
          @click="inputMethod = 'paste'"
          :class="{ active: inputMethod === 'paste' }"
          class="tab-button"
        >
          📝 Paste Text
        </button>
        <button
          @click="inputMethod = 'youtube'"
          :class="{ active: inputMethod === 'youtube' }"
          class="tab-button"
        >
          🎬 YouTube Video
        </button>
        <button
          @click="inputMethod = 'audio'"
          :class="{ active: inputMethod === 'audio' }"
          class="tab-button"
        >
          🎙️ Upload Audio
        </button>
      </div>

      <!-- Upload Section -->
      <div v-if="inputMethod === 'upload' && !transcriptText" class="upload-section">
        <div class="form-group">
          <label>Upload Transcript or Paste Text:</label>
          <div class="upload-area" @drop="handleDrop" @dragover.prevent @dragenter.prevent>
            <input
              type="file"
              ref="fileInput"
              @change="handleFileUpload"
              accept=".txt,.md,.doc,.docx,.pdf"
              class="file-input"
            />
            <div class="upload-content">
              <i class="bi bi-cloud-upload upload-icon"></i>
              <p>Drop transcript file here or click to browse</p>
              <small>Supports: .txt, .md, .doc, .docx, .pdf</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Paste Text Section -->
      <div v-if="inputMethod === 'paste' && !transcriptText" class="paste-section">
        <div class="form-group">
          <label>Paste transcript text directly:</label>
          <textarea
            v-model="transcriptText"
            class="form-control"
            rows="8"
            placeholder="Paste your transcript text here..."
          ></textarea>
        </div>
      </div>

      <!-- YouTube Section -->
      <div v-if="inputMethod === 'youtube' && !transcriptText" class="youtube-section">
        <!-- YouTube URL Input -->
        <div class="form-group">
          <label>🔗 Video URL or YouTube Video ID:</label>
          <div class="url-input-group">
            <input
              v-model="youtubeUrl"
              @input="extractVideoId"
              class="form-control"
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID, https://vimeo.com/123456, or just VIDEO_ID"
            />
            <div class="transcript-method-buttons">
              <button
                @click="fetchYouTubeTranscriptIO"
                :disabled="!videoId || isLoadingTranscript"
                class="btn btn-info"
                title="Third-party transcript service (YouTube only)"
              >
                {{ isLoadingTranscript ? '⏳' : '🌐' }} Transcribe
              </button>
              <button
                @click="fetchDownsubTranscript"
                :disabled="(!videoId && !youtubeUrl.trim()) || isLoadingTranscript"
                class="btn btn-success"
                title="DOWNSUB transcript service (supports YouTube, Vimeo, and other platforms)"
              >
                {{ isLoadingTranscript ? '⏳' : '🔽' }} DOWNSUB
              </button>
            </div>
          </div>
          <small v-if="videoId" class="video-id-display">Video ID: {{ videoId }}</small>
          <!-- Show video description here if selectedVideo and description exist -->
          <div v-if="selectedVideo && selectedVideo.description" class="video-description-box">
            <strong>Description:</strong>
            <div class="video-description-content">
              {{
                selectedVideo.description.length > 500
                  ? selectedVideo.description.slice(0, 500) + '...'
                  : selectedVideo.description
              }}
            </div>
          </div>
        </div>

        <!-- YouTube Search -->
        <div class="form-group">
          <label>🔍 Or search for videos:</label>
          <div class="search-input-group">
            <input
              v-model="searchQuery"
              @keyup.enter="searchYouTubeVideos"
              class="form-control"
              placeholder="Search YouTube videos..."
            />
            <button
              @click="searchYouTubeVideos"
              :disabled="!searchQuery.trim() || isSearching"
              class="btn btn-outline-primary"
            >
              {{ isSearching ? '⏳' : '🔍' }} Search
            </button>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="search-results">
          <h5>Search Results:</h5>
          <div class="video-list">
            <div
              v-for="video in searchResults.slice(0, 10)"
              :key="video.videoId"
              class="video-item"
              @click="selectVideo(video)"
            >
              <div class="video-thumbnail">
                <img
                  :src="video.thumbnails?.medium?.url || video.thumbnails?.default?.url"
                  :alt="video.title"
                  @error="handleImageError"
                />
              </div>
              <div class="video-info">
                <div class="video-title">{{ video.title }}</div>
                <div class="video-channel">{{ video.channelTitle }}</div>
                <div class="video-date">{{ formatDate(video.publishedAt) }}</div>
              </div>
              <div class="video-actions">
                <button class="btn btn-sm btn-primary">Select</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading States -->
        <div v-if="isLoadingTranscript" class="loading-state">
          <div class="spinner-border text-primary" role="status"></div>
          <p>Fetching YouTube transcript...</p>
        </div>

        <div v-if="isSearching" class="loading-state">
          <div class="spinner-border text-primary" role="status"></div>
          <p>Searching YouTube videos...</p>
        </div>
      </div>

      <!-- Video Metadata Display - Compact version when showing knowledge graph -->
      <div v-if="videoMetadata && transcriptText" class="video-metadata-section" :class="{ 'compact-mode': knowledgeGraphPreview }">
        <div v-if="!knowledgeGraphPreview">
          <h4>📹 Video Information</h4>
          <div class="metadata-card">
            <div class="metadata-header">
              <div class="video-thumbnail-large">
                <img
                  :src="videoMetadata.thumbnail"
                  :alt="videoMetadata.title"
                  @error="handleImageError"
                />
                <div class="video-overlay">
                  <a
                    :href="`https://www.youtube.com/watch?v=${videoId}`"
                    target="_blank"
                    class="btn btn-sm btn-primary"
                  >
                    🎬 Watch on YouTube
                  </a>
                </div>
              </div>
              <div class="video-details">
                <h5 class="video-title-meta">{{ videoMetadata.title }}</h5>
                <div class="video-info-meta">
                  <div class="info-item">
                    <i class="bi bi-person-circle"></i>
                    <span>{{ videoMetadata.channelTitle || 'Unknown Channel' }}</span>
                  </div>
                  <div class="info-item" v-if="videoMetadata.duration">
                    <i class="bi bi-clock"></i>
                    <span>{{ formatDuration(videoMetadata.duration) }}</span>
                  </div>
                  <div class="info-item" v-if="videoMetadata.publishedAt">
                    <i class="bi bi-calendar"></i>
                    <span>{{ formatDate(videoMetadata.publishedAt) }}</span>
                  </div>
                  <div class="info-item">
                    <i class="bi bi-translate"></i>
                    <span>{{ videoMetadata.transcriptLanguage || 'Auto-detected' }}</span>
                  </div>
                  <div class="info-item">
                    <i class="bi bi-file-text"></i>
                    <span>{{ videoMetadata.transcriptFormat || 'TXT' }} format</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="videoMetadata.description" class="video-description-meta">
              <div class="description-header">
                <strong>📝 Description:</strong>
                <button
                  @click="showFullDescription = !showFullDescription"
                  class="btn btn-sm btn-outline-secondary"
                >
                  {{ showFullDescription ? 'Show Less' : 'Show More' }}
                </button>
              </div>
              <div class="description-content" :class="{ expanded: showFullDescription }">
                {{
                  showFullDescription
                    ? videoMetadata.description
                    : videoMetadata.description.slice(0, 300) + '...'
                }}
              </div>
            </div>

            <div class="transcript-stats">
              <div class="stat-item">
                <strong>{{ transcriptText.length.toLocaleString() }}</strong>
                <span>Characters</span>
              </div>
              <div class="stat-item">
                <strong>{{ Math.round(transcriptText.split(' ').length) }}</strong>
                <span>Words</span>
              </div>
              <div class="stat-item">
                <strong>{{ Math.round(transcriptText.length / 1000) }}</strong>
                <span>KB Text</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Compact version shown with knowledge graph -->
        <div v-else class="video-metadata-compact">
          <div class="compact-video-info">
            <img :src="videoMetadata.thumbnail" :alt="videoMetadata.title" class="compact-thumbnail" />
            <div class="compact-details">
              <div class="compact-title">🎬 {{ videoMetadata.title.length > 60 ? videoMetadata.title.substring(0, 60) + '...' : videoMetadata.title }}</div>
              <div class="compact-meta">{{ videoMetadata.channelTitle }} • {{ formatDuration(videoMetadata.duration) }} • {{ transcriptText.split(' ').length }} words</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Audio Upload Section -->
      <div v-if="inputMethod === 'audio' && !transcriptText" class="audio-section">
        <div class="form-group">
          <label>🎙️ Upload Audio File for Norwegian Transcription:</label>
          <div class="audio-redirect-info">
            <div class="info-box">
              <i class="bi bi-info-circle-fill"></i>
              <div>
                <h5>Audio Transcription Available</h5>
                <p>Click the button below to use our Norwegian audio transcription service. You can upload audio files and get transcribed text that can then be converted into knowledge graphs.</p>
              </div>
            </div>
            <button @click="redirectToNorwegianTranscription" class="btn btn-primary btn-lg">
              🇳🇴 Go to Norwegian Audio Transcription
            </button>
          </div>
        </div>
      </div>

      <!-- Processing Controls (remove selected-video-info from here) -->
      <div
        v-if="transcriptText && !isProcessing && !knowledgeGraphPreview"
        class="processing-controls"
      >
        <div class="form-group">
          <label>Source Language:</label>
          <select v-model="sourceLanguage" class="form-control">
            <option value="auto">Auto-detect</option>
            <option value="turkish">Turkish</option>
            <option value="english">English</option>
            <option value="german">German</option>
            <option value="spanish">Spanish</option>
            <option value="norwegian">Norwegian</option>
          </select>
        </div>
        <div class="transcript-preview">
          <h5>Transcript Preview:</h5>
          <textarea
            v-model="transcriptText"
            class="form-control preview-text full-transcript"
            rows="10"
            readonly
          ></textarea>
          <small>{{ transcriptText.length }} characters total</small>
        </div>
      </div>

      <!-- Processing Status -->
      <div v-if="isProcessing" class="processing-status">
        <div class="progress-container">
          <div class="spinner-border text-primary mb-3" role="status">
            <span class="visually-hidden">Processing...</span>
          </div>
          <h5>{{ processingStage }}</h5>
          <div class="progress mb-3">
            <div
              class="progress-bar"
              :style="{ width: processingProgress + '%' }"
              role="progressbar"
            ></div>
          </div>
          <p class="text-muted">{{ processingMessage }}</p>
        </div>
      </div>

      <!-- Knowledge Graph Preview -->
      <div v-if="knowledgeGraphPreview" class="preview-section">
        <h4>📊 Generated Knowledge Graph Preview</h4>

        <div class="preview-stats">
          <div class="stat-card">
            <strong>{{ knowledgeGraphPreview.nodes?.length || 0 }}</strong>
            <span>Nodes</span>
          </div>
        </div>

        <!-- Node List Preview -->
        <div class="nodes-preview">
          <h5>Content Sections:</h5>
          <div class="node-list">
            <div
              v-for="node in (knowledgeGraphPreview.nodes || []).slice(0, 5)"
              :key="node.id"
              class="node-item"
            >
              <div class="node-header">
                <span class="node-label">{{ node.label }}</span>
                <span class="node-type">{{ node.type }}</span>
              </div>
              <div class="node-preview">{{ (node.info || '').substring(0, 150) }}...</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Processing Options -->
      <div v-if="transcriptText && !knowledgeGraphPreview" class="processing-options mt-3">
        <div class="form-check">
          <input
            type="checkbox"
            class="form-check-input"
            id="keepOriginalLanguage"
            v-model="keepOriginalLanguage"
          />
          <label class="form-check-label" for="keepOriginalLanguage">
            Keep Original Language (Do not translate to Norwegian)
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="modal-actions">
        <button
          v-if="transcriptText && !isProcessing && !knowledgeGraphPreview"
          @click="processTranscript"
          class="btn btn-primary"
          :disabled="!transcriptText.trim()"
        >
          🚀 Generate Knowledge Graph
        </button>
        <div v-if="isProcessing" class="processing-indicator">
          <div class="spinner-border spinner-border-sm" role="status"></div>
          <span class="ms-2">{{ processingStage || 'Processing...' }}</span>
        </div>
        <div v-if="knowledgeGraphPreview" class="post-processing-actions">
          <button @click="importToGraph" class="btn btn-success me-2">
            📥 Add to Current Graph
          </button>
          <button @click="createNewGraph" class="btn btn-info">➕ Create New Graph</button>
          <button
            v-if="transcriptText && !isProcessing"
            @click="resetProcessor"
            class="btn btn-warning"
          >
            🔄 Start Over
          </button>
          <button @click="close" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
})

const emit = defineEmits(['close', 'graph-imported', 'new-graph-created'])

// Stores
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

// State
const inputMethod = ref('upload') // 'upload', 'paste', 'youtube', 'audio'
const transcriptText = ref('')
const sourceLanguage = ref('auto')
const isProcessing = ref(false)
const processingStage = ref('')
const processingProgress = ref(0)
const processingMessage = ref('')
const knowledgeGraphPreview = ref(null)
const fileInput = ref(null)

// YouTube-specific state
const youtubeUrl = ref('')
const videoId = ref('')
const searchQuery = ref('')
const searchResults = ref([])
const selectedVideo = ref(null)
const isLoadingTranscript = ref(false)
const isSearching = ref(false)
const showFullDescription = ref(false)
const videoMetadata = ref(null)
const keepOriginalLanguage = ref(false)

// Helper function to extract video ID from any YouTube URL
const extractVideoIdFromUrl = (url) => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }
  return null
}

// YouTube functions
const extractVideoId = () => {
  const url = youtubeUrl.value.trim()
  if (!url) {
    videoId.value = ''
    return
  }

  // Handle direct video ID
  if (url.length === 11 && !url.includes('/')) {
    videoId.value = url
    return
  }

  // Extract from YouTube URLs
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      videoId.value = match[1]
      return
    }
  }

  videoId.value = ''
}

const searchYouTubeVideos = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  searchResults.value = []

  try {
    console.log('🔍 Searching YouTube for:', searchQuery.value)

    const response = await fetch(
      `https://api.vegvisr.org/youtube-search?q=${encodeURIComponent(searchQuery.value)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    console.log('📊 YouTube search response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ YouTube search results:', data)
      console.log('📝 First video description:', data.results?.[0]?.description)

      if (data.success && data.results) {
        searchResults.value = data.results
        console.log(`Found ${data.results.length} videos`)
      } else {
        console.warn('⚠️ No results in response:', data)
        alert('No videos found for your search.')
      }
    } else {
      const errorText = await response.text()
      console.error('❌ YouTube search failed:', errorText)
      alert(`YouTube search failed: ${response.status}`)
    }
  } catch (error) {
    console.error('❌ YouTube search error:', error)
    alert(`Error searching YouTube: ${error.message}`)
  } finally {
    isSearching.value = false
  }
}

const selectVideo = (video) => {
  console.log('📺 Selected video:', video)
  console.log('📝 Video description:', video.description)
  selectedVideo.value = video
  videoId.value = video.videoId
  youtubeUrl.value = `https://www.youtube.com/watch?v=${video.videoId}`

  // Don't auto-fetch anymore - let user choose method
  console.log('🎯 Video selected. Choose transcription method above.')
}

const fetchYouTubeTranscript = async () => {
  if (!videoId.value) {
    alert('Please enter a valid YouTube URL or Video ID')
    return
  }

  isLoadingTranscript.value = true
  transcriptText.value = ''

  try {
    console.log('📥 Fetching transcript for video ID:', videoId.value)

    const headers = {
      'Content-Type': 'application/json',
    }

    // Add user email for OAuth2 credentials if available
    if (userStore.email) {
      headers['x-user-email'] = userStore.email
    }

    const response = await fetch(`https://api.vegvisr.org/youtube-transcript/${videoId.value}`, {
      method: 'GET',
      headers,
    })

    console.log('📊 YouTube transcript response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ YouTube transcript response:', data)

      if (data.success && data.transcript) {
        // Convert transcript segments to text
        const transcriptParts = data.transcript.map((segment) => segment.text).join(' ')
        transcriptText.value = transcriptParts

        console.log(`📝 Transcript extracted: ${transcriptParts.length} characters`)

        // Set source language if detected
        if (data.language) {
          sourceLanguage.value = data.language === 'en' ? 'english' : 'auto'
        }

        alert(
          `✅ Official captions fetched successfully!\n📊 ${data.totalSegments} segments\n📝 ${transcriptParts.length} characters`,
        )
      } else {
        console.warn('⚠️ No transcript data in response:', data)
        alert(
          `No official captions available for this video.\n\nError: ${data.error || 'Unknown error'}\n\nTry the AI Whisper option instead!`,
        )
      }
    } else {
      const errorData = await response.json()
      console.error('❌ YouTube transcript failed:', errorData)

      if (errorData.debug) {
        console.log('🔍 Debug info:', errorData.debug)
      }

      // Check if this is a 404 - indicating the feature was removed
      if (response.status === 404) {
        alert(
          `❌ YouTube Transcript Feature Temporarily Disabled\n\nThe automatic YouTube transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
        )
      } else {
        alert(
          `Failed to get official captions.\n\nError: ${errorData.error || 'Unknown error'}\n\nTry the AI Whisper option for better compatibility!`,
        )
      }
    }
  } catch (error) {
    console.error('❌ YouTube transcript error:', error)

    // Check if this is a fetch error that might indicate the endpoint doesn't exist
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      alert(
        `❌ YouTube Transcript Feature Temporarily Disabled\n\nThe automatic YouTube transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
      )
    } else {
      alert(`Error fetching official captions: ${error.message}`)
    }
  } finally {
    isLoadingTranscript.value = false
  }
}

const fetchYouTubeTranscriptIO = async () => {
  if (!videoId.value) {
    alert('Please enter a valid YouTube URL or Video ID')
    return
  }

  isLoadingTranscript.value = true
  transcriptText.value = ''

  try {
    console.log('🌐 Fetching Transcript IO for video ID:', videoId.value)

    const response = await fetch(`https://api.vegvisr.org/youtube-transcript-io/${videoId.value}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('📊 YouTube Transcript IO response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ YouTube Transcript IO response:', data)
      console.log(
        '🔍 YouTube Transcript IO full response structure:',
        JSON.stringify(data, null, 2),
      )

      if (
        data.success &&
        data.transcript &&
        Array.isArray(data.transcript) &&
        data.transcript.length > 0
      ) {
        const transcriptEntry = data.transcript[0]
        console.log('🔍 Transcript entry structure:', JSON.stringify(transcriptEntry, null, 2))

        // Extract transcript text from the correct path
        let transcriptParts = ''
        let transcriptLanguage = 'Unknown'
        let totalSegments = 0

        if (
          transcriptEntry.tracks &&
          Array.isArray(transcriptEntry.tracks) &&
          transcriptEntry.tracks.length > 0
        ) {
          const track = transcriptEntry.tracks[0] // Use first available track
          transcriptLanguage = track.language || 'Unknown'

          if (track.transcript && Array.isArray(track.transcript)) {
            transcriptParts = track.transcript.map((segment) => segment.text).join(' ')
            totalSegments = track.transcript.length
          }
        }

        transcriptText.value = transcriptParts

        // Extract metadata from microformat
        const microformat = transcriptEntry.microformat?.playerMicroformatRenderer
        if (microformat) {
          console.log('📺 Microformat data:', JSON.stringify(microformat, null, 2))

          // Store video metadata for YouTube Transcript IO
          videoMetadata.value = {
            title:
              microformat.title?.simpleText ||
              transcriptEntry.title ||
              `YouTube Video ${videoId.value}`,
            description: microformat.description?.simpleText || '',
            thumbnail: `https://img.youtube.com/vi/${videoId.value}/maxresdefault.jpg`,
            channelTitle: microformat.ownerChannelName || 'Unknown Channel',
            channelId: microformat.externalChannelId || '',
            channelUrl: microformat.externalChannelId
              ? `https://www.youtube.com/channel/${microformat.externalChannelId}`
              : '',
            duration: microformat.lengthSeconds ? parseInt(microformat.lengthSeconds) : null,
            publishedAt: microformat.publishDate || null,
            category: microformat.category || '',
            transcriptLanguage: transcriptLanguage,
            transcriptFormat: 'YouTube Transcript IO',
            source: 'YouTube Transcript IO',
            videoId: videoId.value,
            url: `https://www.youtube.com/watch?v=${videoId.value}`,
          }

          console.log('📊 YouTube Transcript IO metadata captured:', videoMetadata.value)
        }

        console.log(`📝 Transcript IO extracted: ${transcriptParts.length} characters`)
        console.log(`📊 Total segments: ${totalSegments}`)
        console.log(`🌍 Language: ${transcriptLanguage}`)

        // Set source language if detected
        if (transcriptLanguage && transcriptLanguage !== 'Unknown') {
          sourceLanguage.value = transcriptLanguage === 'en' ? 'english' : 'auto'
        }

        alert(
          `✅ YouTube Transcript IO fetched successfully!\n🌐 Service: YouTube Transcript IO\n📊 ${totalSegments} segments\n📝 ${transcriptParts.length} characters\n🌍 Language: ${transcriptLanguage}\n🎬 Channel: ${microformat?.ownerChannelName || 'Unknown'}`,
        )
      } else {
        console.warn('⚠️ No Transcript IO data in response:', data)
        alert(`Failed to get third-party transcript.\n\nError: ${data.error || 'Unknown error'}`)
      }
    } else {
      const errorData = await response.json()
      console.error('❌ YouTube Transcript IO failed:', errorData)

      // Check if this is a 404 - indicating the feature was removed
      if (response.status === 404) {
        alert(
          `❌ YouTube Transcript Feature Temporarily Disabled\n\nThe automatic YouTube transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
        )
      } else {
        alert(
          `Failed to get third-party transcript.\n\nError: ${errorData.error || 'Unknown error'}\n\nThe video may not have transcripts available through this service.`,
        )
      }
    }
  } catch (error) {
    console.error('❌ YouTube Transcript IO error:', error)

    // Check if this is a fetch error that might indicate the endpoint doesn't exist
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      alert(
        `❌ YouTube Transcript Feature Temporarily Disabled\n\nThe automatic YouTube transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
      )
    } else {
      alert(`Error fetching third-party transcript: ${error.message}`)
    }
  } finally {
    isLoadingTranscript.value = false
  }
}

const fetchDownsubTranscript = async () => {
  // For DOWNSUB, we can use either videoId or the raw URL
  const inputUrl = youtubeUrl.value.trim()
  if (!inputUrl && !videoId.value) {
    alert('Please enter a valid video URL (YouTube, Vimeo, etc.) or YouTube Video ID')
    return
  }

  // Use the raw URL if available, otherwise construct YouTube URL from videoId
  const targetUrl = inputUrl || `https://www.youtube.com/watch?v=${videoId.value}`

  isLoadingTranscript.value = true
  transcriptText.value = ''

  try {
    console.log('🔽 Fetching DOWNSUB transcript for URL:', targetUrl)

    // Define variables that will be used throughout the function
    const isYouTubeUrl = targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')
    const displayVideoId =
      videoId.value || (isYouTubeUrl ? extractVideoIdFromUrl(targetUrl) : 'N/A')

    // For non-YouTube URLs, we need to send the URL in the request body
    // For YouTube URLs, we can use the existing endpoint
    let response
    if (inputUrl && !inputUrl.includes('youtube.com') && !inputUrl.includes('youtu.be')) {
      // Use POST request for non-YouTube URLs
      response = await fetch(`https://api.vegvisr.org/downsub-url-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      })
    } else {
      // Use existing GET endpoint for YouTube URLs
      const videoIdToUse = videoId.value || extractVideoIdFromUrl(targetUrl)
      response = await fetch(`https://api.vegvisr.org/downsub-transcript/${videoIdToUse}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    console.log('📊 DOWNSUB response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ DOWNSUB response:', data)

      if (data.success && data.transcript && data.transcript.data) {
        const transcriptData = data.transcript.data

        console.log(
          '🔍 DOWNSUB transcript data structure:',
          JSON.stringify(transcriptData, null, 2),
        )
        console.log('📺 Video Info:', {
          title: transcriptData.title,
          source: transcriptData.source,
          duration: transcriptData.duration,
          state: transcriptData.state,
          subtitlesCount: transcriptData.subtitles?.length || 0,
          translatedSubtitlesCount: transcriptData.translatedSubtitles?.length || 0,
        })

        // Look for English subtitles first (default language)
        let targetSubtitles = null

        // Try to find English subtitles in the main subtitles array
        if (transcriptData.subtitles && Array.isArray(transcriptData.subtitles)) {
          console.log(
            '📋 Available subtitles:',
            transcriptData.subtitles.map((sub) => ({
              language: sub.language,
              formats: Object.keys(sub).filter((key) => key !== 'language'),
            })),
          )

          targetSubtitles = transcriptData.subtitles.find(
            (sub) =>
              sub.language === 'en' ||
              sub.language === 'English' ||
              sub.language.includes('English') ||
              sub.language.includes('en') ||
              sub.language === 'en-US' ||
              sub.language === 'en-GB',
          )
        }

        // If no English subtitles found, try the first available subtitle
        if (!targetSubtitles && transcriptData.subtitles && transcriptData.subtitles.length > 0) {
          targetSubtitles = transcriptData.subtitles[0]
          console.log(
            '🌐 No English subtitles found, using first available:',
            targetSubtitles.language,
          )
        }

        // If still no subtitles, check translatedSubtitles for English
        if (
          !targetSubtitles &&
          transcriptData.translatedSubtitles &&
          Array.isArray(transcriptData.translatedSubtitles)
        ) {
          console.log(
            '📋 Available translated subtitles:',
            transcriptData.translatedSubtitles.map((sub) => ({
              language: sub.language,
              formats: Object.keys(sub).filter((key) => key !== 'language'),
            })),
          )

          targetSubtitles = transcriptData.translatedSubtitles.find(
            (sub) =>
              sub.language === 'en' ||
              sub.language === 'English' ||
              sub.language.includes('English') ||
              sub.language.includes('en') ||
              sub.language === 'en-US' ||
              sub.language === 'en-GB',
          )
        }

        // If still no subtitles found, try the first available from translatedSubtitles
        if (
          !targetSubtitles &&
          transcriptData.translatedSubtitles &&
          transcriptData.translatedSubtitles.length > 0
        ) {
          targetSubtitles = transcriptData.translatedSubtitles[0]
          console.log('🌐 Using first available translated subtitle:', targetSubtitles.language)
        }

        if (targetSubtitles) {
          console.log('🎯 Found subtitles for language:', targetSubtitles.language)
          console.log('🔍 Subtitle object structure:', JSON.stringify(targetSubtitles, null, 2))

          // Look for TXT format URL - check if formats object exists
          let txtUrl = null

          if (targetSubtitles.formats && typeof targetSubtitles.formats === 'object') {
            console.log(
              '📋 Found formats object:',
              JSON.stringify(targetSubtitles.formats, null, 2),
            )

            // Check for TXT format in formats object
            const possibleTxtKeys = ['TXT', 'txt', 'text', 'TEXT']
            for (const key of possibleTxtKeys) {
              if (targetSubtitles.formats[key] && targetSubtitles.formats[key].url) {
                txtUrl = targetSubtitles.formats[key].url
                console.log(`📋 Found TXT format with key: ${key}`)
                break
              }
            }
          } else {
            // Fallback: check direct format keys (original approach)
            const possibleTxtKeys = ['TXT', 'txt', 'text', 'TEXT']
            for (const key of possibleTxtKeys) {
              if (targetSubtitles[key] && targetSubtitles[key].url) {
                txtUrl = targetSubtitles[key].url
                console.log(`📋 Found TXT format with key: ${key}`)
                break
              }
            }
          }

          if (txtUrl) {
            console.log('📥 Downloading TXT file from:', txtUrl)

            // Download the actual subtitle file
            const txtResponse = await fetch(txtUrl)
            if (txtResponse.ok) {
              const txtContent = await txtResponse.text()

              // Clean up the subtitle content to extract plain text
              let cleanText = txtContent

              // Remove SRT/VTT timing information if present
              cleanText = cleanText
                .replace(/\d+:\d+:\d+[,\.]\d+ --> \d+:\d+:\d+[,\.]\d+/g, '') // Remove timestamps
                .replace(/^\d+$/gm, '') // Remove sequence numbers
                .replace(/WEBVTT/g, '') // Remove WebVTT header
                .replace(/NOTE.*/g, '') // Remove NOTE lines
                .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
                .replace(/^\s+|\s+$/g, '') // Trim whitespace
                .replace(/\n+/g, ' ') // Replace newlines with spaces
                .trim()

              transcriptText.value = cleanText

              // Store video metadata - handle both YouTube and non-YouTube URLs
              videoMetadata.value = {
                title: transcriptData.title || `Video ${displayVideoId}`,
                description: transcriptData.description || '',
                thumbnail:
                  transcriptData.thumbnail ||
                  (isYouTubeUrl && displayVideoId !== 'N/A'
                    ? `https://img.youtube.com/vi/${displayVideoId}/maxresdefault.jpg`
                    : 'https://via.placeholder.com/480x360?text=Video+Thumbnail'),
                channelTitle:
                  transcriptData.metadata?.author ||
                  transcriptData.channel ||
                  transcriptData.channelTitle ||
                  'Unknown Channel',
                channelId: transcriptData.metadata?.channelId || '',
                channelUrl: transcriptData.metadata?.channelUrl || '',
                duration: transcriptData.duration || null,
                publishedAt: transcriptData.publishedAt || null,
                transcriptLanguage: targetSubtitles.language || 'Unknown',
                transcriptFormat: 'TXT',
                source: 'DOWNSUB',
                videoId: displayVideoId,
                url: data.originalUrl || targetUrl,
                platform: isYouTubeUrl ? 'YouTube' : 'Other',
              }

              console.log(`📝 DOWNSUB TXT extracted: ${cleanText.length} characters`)
              console.log('📄 Sample text:', cleanText.substring(0, 200) + '...')
              console.log('📊 Video metadata captured:', videoMetadata.value)

              alert(
                `✅ DOWNSUB transcript fetched successfully!\n🔽 Service: DOWNSUB\n🌐 Language: ${targetSubtitles.language}\n📝 ${cleanText.length} characters\n🎬 Video: ${displayVideoId}\n🌐 Platform: ${videoMetadata.value.platform}`,
              )
            } else {
              throw new Error(`Failed to download TXT file: ${txtResponse.status}`)
            }
          } else {
            // Fallback: try SRT or VTT format and extract text
            let fallbackUrl = null
            let fallbackFormat = null

            // Try different possible format keys - check formats object first
            const possibleSrtKeys = ['SRT', 'srt', 'SubRip']
            const possibleVttKeys = ['VTT', 'vtt', 'WebVTT', 'webvtt']

            if (targetSubtitles.formats && typeof targetSubtitles.formats === 'object') {
              // Check for SRT formats in formats object
              for (const key of possibleSrtKeys) {
                if (targetSubtitles.formats[key] && targetSubtitles.formats[key].url) {
                  fallbackUrl = targetSubtitles.formats[key].url
                  fallbackFormat = 'SRT'
                  console.log(`📋 Found SRT format with key: ${key}`)
                  break
                }
              }

              // If no SRT found, check for VTT formats in formats object
              if (!fallbackUrl) {
                for (const key of possibleVttKeys) {
                  if (targetSubtitles.formats[key] && targetSubtitles.formats[key].url) {
                    fallbackUrl = targetSubtitles.formats[key].url
                    fallbackFormat = 'VTT'
                    console.log(`📋 Found VTT format with key: ${key}`)
                    break
                  }
                }
              }
            } else {
              // Fallback: check direct format keys
              // Check for SRT formats
              for (const key of possibleSrtKeys) {
                if (targetSubtitles[key] && targetSubtitles[key].url) {
                  fallbackUrl = targetSubtitles[key].url
                  fallbackFormat = 'SRT'
                  console.log(`📋 Found SRT format with key: ${key}`)
                  break
                }
              }

              // If no SRT found, check for VTT formats
              if (!fallbackUrl) {
                for (const key of possibleVttKeys) {
                  if (targetSubtitles[key] && targetSubtitles[key].url) {
                    fallbackUrl = targetSubtitles[key].url
                    fallbackFormat = 'VTT'
                    console.log(`📋 Found VTT format with key: ${key}`)
                    break
                  }
                }
              }
            }

            if (fallbackUrl) {
              console.log(
                `📥 TXT not available, downloading ${fallbackFormat} file from:`,
                fallbackUrl,
              )

              const fallbackResponse = await fetch(fallbackUrl)
              if (fallbackResponse.ok) {
                const fallbackContent = await fallbackResponse.text()

                // Extract text from SRT/VTT format
                let cleanText = fallbackContent
                  .replace(/\d+:\d+:\d+[,\.]\d+ --> \d+:\d+:\d+[,\.]\d+/g, '') // Remove timestamps
                  .replace(/^\d+$/gm, '') // Remove sequence numbers
                  .replace(/WEBVTT/g, '') // Remove WebVTT header
                  .replace(/NOTE.*/g, '') // Remove NOTE lines
                  .replace(/<[^>]*>/g, '') // Remove HTML tags
                  .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
                  .replace(/^\s+|\s+$/g, '') // Trim whitespace
                  .replace(/\n+/g, ' ') // Replace newlines with spaces
                  .trim()

                transcriptText.value = cleanText

                // Store video metadata for fallback format
                videoMetadata.value = {
                  title: transcriptData.title || `Video ${displayVideoId}`,
                  description: transcriptData.description || '',
                  thumbnail:
                    transcriptData.thumbnail ||
                    (isYouTubeUrl && displayVideoId !== 'N/A'
                      ? `https://img.youtube.com/vi/${displayVideoId}/maxresdefault.jpg`
                      : 'https://via.placeholder.com/480x360?text=Video+Thumbnail'),
                  channelTitle:
                    transcriptData.metadata?.author ||
                    transcriptData.channel ||
                    transcriptData.channelTitle ||
                    'Unknown Channel',
                  channelId: transcriptData.metadata?.channelId || '',
                  channelUrl: transcriptData.metadata?.channelUrl || '',
                  duration: transcriptData.duration || null,
                  publishedAt: transcriptData.publishedAt || null,
                  transcriptLanguage: targetSubtitles.language || 'Unknown',
                  transcriptFormat: fallbackFormat,
                  source: 'DOWNSUB',
                  videoId: displayVideoId,
                  url: data.originalUrl || targetUrl,
                  platform: isYouTubeUrl ? 'YouTube' : 'Other',
                }

                console.log(
                  `📝 DOWNSUB ${fallbackFormat} extracted: ${cleanText.length} characters`,
                )
                console.log('📊 Video metadata captured:', videoMetadata.value)

                alert(
                  `✅ DOWNSUB transcript fetched successfully!\n🔽 Service: DOWNSUB (${fallbackFormat} format)\n🌐 Language: ${targetSubtitles.language}\n📝 ${cleanText.length} characters\n🎬 Video: ${displayVideoId}\n🌐 Platform: ${videoMetadata.value.platform}`,
                )
              } else {
                throw new Error(
                  `Failed to download ${fallbackFormat} file: ${fallbackResponse.status}`,
                )
              }
            } else {
              // Last resort: try to find ANY format with a URL
              console.log('🔍 No standard formats found, checking all available keys...')

              let anyFormatUrl = null
              let anyFormatKey = null

              if (targetSubtitles.formats && typeof targetSubtitles.formats === 'object') {
                // Check inside formats object
                const formatKeys = Object.keys(targetSubtitles.formats)
                console.log('📋 Available format keys in formats object:', formatKeys)

                for (const key of formatKeys) {
                  if (targetSubtitles.formats[key] && targetSubtitles.formats[key].url) {
                    anyFormatUrl = targetSubtitles.formats[key].url
                    anyFormatKey = key
                    console.log(`📋 Found format with key: ${key}, URL: ${anyFormatUrl}`)
                    break
                  }
                }
              } else {
                // Check direct keys
                const availableKeys = Object.keys(targetSubtitles).filter(
                  (key) => key !== 'language',
                )
                console.log('📋 Available format keys:', availableKeys)

                for (const key of availableKeys) {
                  if (
                    targetSubtitles[key] &&
                    typeof targetSubtitles[key] === 'object' &&
                    targetSubtitles[key].url
                  ) {
                    anyFormatUrl = targetSubtitles[key].url
                    anyFormatKey = key
                    console.log(`📋 Found format with key: ${key}, URL: ${anyFormatUrl}`)
                    break
                  }
                }
              }

              if (anyFormatUrl) {
                console.log(`📥 Trying to download ${anyFormatKey} format from:`, anyFormatUrl)

                const anyFormatResponse = await fetch(anyFormatUrl)
                if (anyFormatResponse.ok) {
                  const anyFormatContent = await anyFormatResponse.text()

                  // Extract text from any subtitle format
                  let cleanText = anyFormatContent
                    .replace(/\d+:\d+:\d+[,\.]\d+ --> \d+:\d+:\d+[,\.]\d+/g, '') // Remove timestamps
                    .replace(/^\d+$/gm, '') // Remove sequence numbers
                    .replace(/WEBVTT/g, '') // Remove WebVTT header
                    .replace(/NOTE.*/g, '') // Remove NOTE lines
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
                    .replace(/^\s+|\s+$/g, '') // Trim whitespace
                    .replace(/\n+/g, ' ') // Replace newlines with spaces
                    .trim()

                  transcriptText.value = cleanText

                  // Store video metadata for any format
                  videoMetadata.value = {
                    title: transcriptData.title || `Video ${displayVideoId}`,
                    description: transcriptData.description || '',
                    thumbnail:
                      transcriptData.thumbnail ||
                      (isYouTubeUrl && displayVideoId !== 'N/A'
                        ? `https://img.youtube.com/vi/${displayVideoId}/maxresdefault.jpg`
                        : 'https://via.placeholder.com/480x360?text=Video+Thumbnail'),
                    channelTitle:
                      transcriptData.metadata?.author ||
                      transcriptData.channel ||
                      transcriptData.channelTitle ||
                      'Unknown Channel',
                    channelId: transcriptData.metadata?.channelId || '',
                    channelUrl: transcriptData.metadata?.channelUrl || '',
                    duration: transcriptData.duration || null,
                    publishedAt: transcriptData.publishedAt || null,
                    transcriptLanguage: targetSubtitles.language || 'Unknown',
                    transcriptFormat: anyFormatKey,
                    source: 'DOWNSUB',
                    videoId: displayVideoId,
                    url: data.originalUrl || targetUrl,
                    platform: isYouTubeUrl ? 'YouTube' : 'Other',
                  }

                  console.log(
                    `📝 DOWNSUB ${anyFormatKey} extracted: ${cleanText.length} characters`,
                  )
                  console.log('📊 Video metadata captured:', videoMetadata.value)

                  alert(
                    `✅ DOWNSUB transcript fetched successfully!\n🔽 Service: DOWNSUB (${anyFormatKey} format)\n🌐 Language: ${targetSubtitles.language}\n📝 ${cleanText.length} characters\n🎬 Video: ${displayVideoId}\n🌐 Platform: ${videoMetadata.value.platform}`,
                  )
                } else {
                  throw new Error(
                    `Failed to download ${anyFormatKey} file: ${anyFormatResponse.status}`,
                  )
                }
              } else {
                if (targetSubtitles.formats && typeof targetSubtitles.formats === 'object') {
                  const formatKeys = Object.keys(targetSubtitles.formats)
                  console.error('❌ No subtitle formats found. Available format keys:', formatKeys)
                  console.error('❌ Formats object:', targetSubtitles.formats)
                  throw new Error(
                    `No supported subtitle format found. Available format keys: ${formatKeys.join(', ')}`,
                  )
                } else {
                  const availableKeys = Object.keys(targetSubtitles).filter(
                    (key) => key !== 'language',
                  )
                  console.error('❌ No subtitle formats found. Available keys:', availableKeys)
                  console.error('❌ Subtitle object:', targetSubtitles)
                  throw new Error(
                    `No supported subtitle format found. Available keys: ${availableKeys.join(', ')}`,
                  )
                }
              }
            }
          }
        } else {
          // Check if it's a "no_subtitles" state
          if (transcriptData.state === 'no_subtitles') {
            throw new Error(
              `No subtitles available for this ${transcriptData.source || 'video'} video. The video creator has not provided captions or subtitles.`,
            )
          } else {
            throw new Error('No subtitles found in the DOWNSUB response')
          }
        }
      } else {
        console.warn('⚠️ No DOWNSUB data in response:', data)
        alert(
          `Failed to get DOWNSUB transcript.\n\nError: ${data.error || 'No transcript data found'}\n\nThe video may not have subtitles available.`,
        )
      }
    } else {
      const errorData = await response.json()
      console.error('❌ DOWNSUB failed:', errorData)

      // Check if this is a 404 - indicating the feature was removed
      if (response.status === 404) {
        alert(
          `❌ DOWNSUB Transcript Feature Temporarily Disabled\n\nThe automatic DOWNSUB transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
        )
      } else {
        alert(
          `Failed to get DOWNSUB transcript.\n\nError: ${errorData.error || 'Unknown error'}\n\nThe video may not have transcripts available through this service.`,
        )
      }
    }
  } catch (error) {
    console.error('❌ DOWNSUB error:', error)

    // Check if this is a fetch error that might indicate the endpoint doesn't exist
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      alert(
        `❌ DOWNSUB Transcript Feature Temporarily Disabled\n\nThe automatic DOWNSUB transcript extraction feature has been temporarily disabled due to technical issues.\n\nAs an alternative, you can:\n• Manually copy transcript text from YouTube (click "...More" → "Show transcript")\n• Use the "Paste Text" option to input transcript manually\n• Upload a transcript file`,
      )
    } else {
      alert(`Error fetching DOWNSUB transcript: ${error.message}`)
    }
  } finally {
    isLoadingTranscript.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

const formatDuration = (duration) => {
  if (!duration) return ''

  // Handle different duration formats
  if (typeof duration === 'string') {
    // If it's already formatted (e.g., "10:23"), return as is
    if (duration.includes(':')) return duration

    // If it's seconds as string, convert to number
    const seconds = parseInt(duration)
    if (!isNaN(seconds)) {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      const secs = seconds % 60

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`
      }
    }
  }

  if (typeof duration === 'number') {
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const secs = duration % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    }
  }

  return duration.toString()
}

const handleImageError = (event) => {
  event.target.src =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB2aWV3Qm94PSIwIDAgMTIwIDkwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjYwIiB5PSI0NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9IjAuM2VtIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'
}

// File handling
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (file) {
    try {
      // Handle different file types
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        transcriptText.value = await file.text()
      } else {
        // For other file types (.doc, .docx, .pdf), treat as text for now
        // You could add more sophisticated file parsing here
        transcriptText.value = await file.text()
      }
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error reading file. Please try a different format or copy-paste the text directly.')
    }
  }
}

const handleDrop = async (event) => {
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file) {
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        transcriptText.value = await file.text()
      } else {
        transcriptText.value = await file.text()
      }
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Error reading file. Please try a different format or copy-paste the text directly.')
    }
  }
}

// Processing functions
const setProcessingStage = (stage, progress, message = '') => {
  isProcessing.value = true
  processingStage.value = stage
  processingProgress.value = progress
  processingMessage.value = message
}

// Health check function
const checkApiHealth = async () => {
  try {
    console.log('Checking API health...')
    // Try a simple request to see if the API is responding
    const healthResponse = await fetch('https://api.vegvisr.org/blog-posts', {
      method: 'GET',
    })
    console.log('API health check status:', healthResponse.status)
    return healthResponse.ok
  } catch (error) {
    console.error('API health check failed:', error)
    return false
  }
}

// Test API connection with detailed logging
const testApiConnection = async () => {
  console.log('=== TESTING API CONNECTION ===')

  try {
    // Test 1: Basic connectivity
    console.log('Test 1: Basic blog-posts endpoint...')
    const basicResponse = await fetch('https://api.vegvisr.org/blog-posts')
    console.log('Basic test status:', basicResponse.status)

    // Test 2: Process transcript endpoint with OPTIONS
    console.log('Test 2: CORS preflight check...')
    const corsResponse = await fetch('https://api.vegvisr.org/process-transcript', {
      method: 'OPTIONS',
    })
    console.log('CORS test status:', corsResponse.status)
    console.log('CORS headers:', Object.fromEntries(corsResponse.headers.entries()))

    // Test 3: Small test payload to process-transcript
    console.log('Test 3: Small test payload...')
    const testPayload = {
      transcript: 'Test transcript for API connectivity.',
      sourceLanguage: 'auto',
      targetLanguage: 'norwegian',
    }

    const testResponse = await fetch('https://api.vegvisr.org/process-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken || 'test-token',
      },
      body: JSON.stringify(testPayload),
    })

    console.log('Test API Response Status:', testResponse.status)
    console.log('Test API Response Headers:', Object.fromEntries(testResponse.headers.entries()))

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.log('Test API Error Response:', errorText)
    } else {
      const result = await testResponse.json()
      console.log('Test API Success Response:', result)
    }

    alert(
      `API Test Results:\n✅ Basic: ${basicResponse.status}\n✅ CORS: ${corsResponse.status}\n✅ Process: ${testResponse.status}\n\nCheck console for detailed logs.`,
    )
  } catch (error) {
    console.error('API test failed:', error)
    alert(`API Test Failed: ${error.message}\n\nCheck console for details.`)
  }

  console.log('===========================')
}

const processTranscript = async () => {
  try {
    setProcessingStage('🔍 Analyzing transcript...', 20, 'Processing content structure')

    // First, test if the API is accessible
    console.log('Testing API connectivity...')
    const apiHealthy = await checkApiHealth()

    if (!apiHealthy) {
      console.warn('API health check failed, using fallback method immediately')
      throw new Error('API service is currently unavailable')
    }

    // Log detailed request information
    const requestPayload = {
      transcript: transcriptText.value,
      sourceLanguage: sourceLanguage.value,
      targetLanguage: keepOriginalLanguage.value ? 'original' : 'norwegian',
      userId: userStore.user_id, // Add userId for API key retrieval from D1
    }

    console.log('=== TRANSCRIPT API REQUEST ===')
    console.log('URL:', 'https://grok.vegvisr.org/process-transcript')
    console.log('Method:', 'POST')
    console.log('API Token:', userStore.emailVerificationToken ? 'Present' : 'MISSING')
    console.log('API Token Length:', userStore.emailVerificationToken?.length || 0)
    console.log('Transcript Length:', transcriptText.value.length)
    console.log('Source Language:', sourceLanguage.value)
    console.log('Target Language:', keepOriginalLanguage.value ? 'original' : 'norwegian')
    console.log('Full Payload:', JSON.stringify(requestPayload, null, 2))
    console.log('===============================')

    const response = await fetch('https://grok.vegvisr.org/process-transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      },
      body: JSON.stringify(requestPayload),
    })

    setProcessingStage('🧠 Generating knowledge graph...', 80, 'Creating Norwegian content')

    console.log('=== TRANSCRIPT API RESPONSE ===')
    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    console.log('Headers:', Object.fromEntries(response.headers.entries()))
    console.log('================================')

    if (!response.ok) {
      let errorMessage = `Processing failed: ${response.status}`
      let fullErrorDetails = null

      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
        fullErrorDetails = errorData
        console.error('=== API ERROR JSON ===')
        console.error('Error Data:', JSON.stringify(errorData, null, 2))
        console.error('======================')
      } catch (e) {
        const errorText = await response.text()
        console.error('=== API ERROR TEXT ===')
        console.error('Error Text:', errorText)
        console.error('Parse Error:', e.message)
        console.error('======================')
        errorMessage = errorText || errorMessage
        fullErrorDetails = { rawText: errorText, parseError: e.message }
      }

      console.error('=== FULL ERROR CONTEXT ===')
      console.error('Request URL:', 'https://grok.vegvisr.org/process-transcript')
      console.error('Request Headers:', {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken,
      })
      console.error('Response Status:', response.status)
      console.error('Response Headers:', Object.fromEntries(response.headers.entries()))
      console.error('Error Details:', fullErrorDetails)
      console.error('==========================')

      throw new Error(errorMessage)
    }

    const result = await response.json()

    setProcessingStage('✅ Complete!', 100, 'Knowledge graph ready')

    console.log('=== PROCESSING COMPLETE ===')
    console.log('API Result:', result)
    console.log('Knowledge Graph:', result.knowledgeGraph)
    console.log('Nodes received:', result.knowledgeGraph?.nodes?.length || 0)
    console.log('Sample node:', result.knowledgeGraph?.nodes?.[0])
    console.log('===========================')

    // Add YouTube node if video metadata exists
    console.log('=== YOUTUBE NODE CREATION DEBUG ===')
    console.log('inputMethod.value:', inputMethod.value)
    console.log('videoMetadata.value:', videoMetadata.value)
    console.log('selectedVideo.value:', selectedVideo.value)
    console.log('videoId.value:', videoId.value)
    console.log('=====================================')

    if (inputMethod.value === 'youtube' && (videoMetadata.value || selectedVideo.value)) {
      console.log('🎬 Creating YouTube node...')
      const youtubeNode = createYouTubeNode()
      console.log('Generated YouTube node:', youtubeNode)
      if (youtubeNode) {
        result.knowledgeGraph.nodes.push(youtubeNode)
        console.log('✅ YouTube node added to knowledge graph')
        console.log('Total nodes now:', result.knowledgeGraph.nodes.length)
      } else {
        console.log('❌ YouTube node creation failed')
      }
    } else {
      console.log('❌ YouTube node creation skipped - conditions not met')
    }

    setTimeout(() => {
      knowledgeGraphPreview.value = result.knowledgeGraph
      console.log('knowledgeGraphPreview.value set to:', knowledgeGraphPreview.value)
      isProcessing.value = false
    }, 1000)
  } catch (error) {
    console.error('Error processing transcript:', error)

    // Fallback: Create nodes locally if API fails
    console.log('API failed, attempting local processing...')
    setProcessingStage('🔄 Using fallback method...', 50, 'Creating nodes locally')

    try {
      const fallbackResult = await createLocalKnowledgeGraph()
      if (fallbackResult) {
        setProcessingStage('✅ Complete!', 100, 'Knowledge graph ready (local)')

        setTimeout(() => {
          knowledgeGraphPreview.value = fallbackResult
          isProcessing.value = false
        }, 1000)
        return
      }
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError)
    }

    alert(
      `Error: ${error.message}\n\nThe transcript processor is currently unavailable. Please try again later or contact support.`,
    )
    isProcessing.value = false
  }
}

// Fallback method to create knowledge graph locally
const createLocalKnowledgeGraph = async () => {
  try {
    const text = transcriptText.value
    const words = text.split(/\s+/)
    const chunkSize = 500 // words per node
    const chunks = []

    // Split into chunks
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    // Create nodes from chunks
    const nodes = chunks.map((chunk, index) => ({
      id: `transcript_${Date.now()}_${index}`,
      label: `DEL ${index + 1}`,
      color: '#f9f9f9',
      type: 'fulltext',
      info: `## DEL ${index + 1}\n\n${chunk}\n\n*Note: This content was created using local processing. For full AI translation and enhancement, please ensure the API service is available.*`,
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: null,
    }))

    // Add YouTube node if video metadata exists
    console.log('=== FALLBACK YOUTUBE NODE DEBUG ===')
    console.log('inputMethod.value:', inputMethod.value)
    console.log('videoMetadata.value:', videoMetadata.value)
    console.log('selectedVideo.value:', selectedVideo.value)
    console.log('videoId.value:', videoId.value)
    console.log('===================================')

    if (inputMethod.value === 'youtube' && (videoMetadata.value || selectedVideo.value)) {
      console.log('🎬 Creating YouTube node in fallback...')
      const youtubeNode = createYouTubeNode()
      console.log('Generated YouTube node in fallback:', youtubeNode)
      if (youtubeNode) {
        nodes.push(youtubeNode)
        console.log('✅ YouTube node added to fallback nodes')
      } else {
        console.log('❌ YouTube node creation failed in fallback')
      }
    } else {
      console.log('❌ YouTube node creation skipped in fallback - conditions not met')
    }

    return {
      nodes,
      edges: [],
      fallbackMode: true,
    }
  } catch (error) {
    console.error('Local processing failed:', error)
    return null
  }
}

// Helper function to create YouTube node
const createYouTubeNode = () => {
  console.log('=== createYouTubeNode DEBUG ===')
  console.log('videoMetadata.value:', videoMetadata.value)
  console.log('selectedVideo.value:', selectedVideo.value)
  console.log('videoId.value:', videoId.value)

  if (!videoMetadata.value && !selectedVideo.value) {
    console.log('❌ No video metadata or selected video available')
    return null
  }

  const metadata = videoMetadata.value || selectedVideo.value
  console.log('Using metadata:', metadata)

  const videoTitle = metadata.title || `YouTube Video ${videoId.value}`
  const channelTitle = metadata.channelTitle || 'Unknown Channel'
  const description = metadata.description || ''
  const duration = metadata.duration || null
  const publishedAt = metadata.publishedAt || null
  const videoUrl = `https://www.youtube.com/watch?v=${videoId.value}`
  const embedUrl = `https://www.youtube.com/embed/${videoId.value}`

  console.log('Video details:', {
    videoTitle,
    channelTitle,
    description: description.substring(0, 100) + '...',
    duration,
    publishedAt,
    videoUrl,
    embedUrl,
  })

  // Format duration if available
  const durationText = duration
    ? formatDuration(duration) || 'Unknown duration'
    : 'Unknown duration'

  // Format publish date if available
  const publishText = publishedAt ? formatDate(publishedAt) || 'Unknown date' : 'Unknown date'

  // Create rich info content
  const infoContent = `[SECTION | background-color:'#FFF'; color:'#333']
**${videoTitle}**

**Channel:** ${channelTitle}
**Duration:** ${durationText}
**Published:** ${publishText}

${description ? `**Description:**\n${description.length > 500 ? description.substring(0, 500) + '...' : description}` : ''}

**Source:** [Watch on YouTube](${videoUrl})
[END SECTION]`

  const youtubeNode = {
    id: `youtube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    label: `![YOUTUBE src=${embedUrl}]${videoTitle}[END YOUTUBE]`,
    color: '#FF0000',
    type: 'youtube-video',
    info: infoContent,
    bibl: [videoUrl],
    imageWidth: '100%',
    imageHeight: '100%',
    visible: true,
    path: null,
  }

  console.log('✅ YouTube node created:', youtubeNode)
  console.log('==============================')

  return youtubeNode
}

const importToGraph = () => {
  if (knowledgeGraphPreview.value) {
    knowledgeGraphPreview.value.nodes.forEach((node, index) => {
      const newNode = {
        data: {
          id: node.id,
          label: node.label,
          color: node.color || '#f9f9f9',
          type: node.type || 'fulltext',
          info: node.info || '',
          bibl: Array.isArray(node.bibl) ? node.bibl : [],
          imageWidth: node.imageWidth || '100%',
          imageHeight: node.imageHeight || '100%',
          visible: true,
          path: node.path || null,
        },
        position: { x: 100 + index * 200, y: 100 + Math.floor(index / 5) * 300 },
      }

      knowledgeGraphStore.nodes.push(newNode)
    })

    console.log(
      `Added ${knowledgeGraphPreview.value.nodes.length} transcript nodes to current graph`,
    )
    emit('graph-imported', knowledgeGraphPreview.value)
    close()
  }
}

const createNewGraph = async () => {
  if (!knowledgeGraphPreview.value) {
    console.error('No knowledge graph preview available!')
    return
  }

  console.log('=== CREATE NEW GRAPH DEBUG ===')
  console.log('knowledgeGraphPreview.value:', JSON.stringify(knowledgeGraphPreview.value, null, 2))
  console.log('Number of nodes:', knowledgeGraphPreview.value.nodes?.length || 0)
  console.log('First node sample:', knowledgeGraphPreview.value.nodes?.[0])
  console.log('==============================')

  try {
    // Create graph metadata with better naming
    const today = new Date()
    const dateStr = today.toLocaleDateString('no-NO')
    const timeStr = today.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
    const nodeCount = knowledgeGraphPreview.value.nodes?.length || 0

    // Use video title if available, otherwise generic title
    const videoTitle = selectedVideo.value?.title || 'Transkript'
    const graphTitle = selectedVideo.value
      ? `🎬 ${videoTitle.substring(0, 50)}${videoTitle.length > 50 ? '...' : ''} (${nodeCount} deler)`
      : `📝 Transkript ${dateStr} (${nodeCount} deler)`

    const graphMetadata = {
      title: graphTitle,
      description: selectedVideo.value
        ? `Norsk kunnskapsgraf fra YouTube video: "${videoTitle}" (${selectedVideo.value.channelTitle}). Prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`
        : `Automatisk generert norsk kunnskapsgraf fra transkript prosessert ${dateStr} kl. ${timeStr}. Inneholder ${nodeCount} tekstdeler.`,
      createdBy: userStore.email || 'Anonymous',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Prepare graph data with positions
    const graphData = {
      metadata: graphMetadata,
      nodes: knowledgeGraphPreview.value.nodes.map((node, index) => ({
        ...node,
        position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 250 },
        visible: true,
      })),
      edges: knowledgeGraphPreview.value.edges || [],
    }

    console.log('=== GRAPH DATA TO SAVE ===')
    console.log('Metadata:', graphMetadata)
    console.log('Nodes being saved:', graphData.nodes.length)
    console.log('Sample node:', graphData.nodes[0])
    console.log('==========================')

    // Generate unique graph ID
    const graphId = `graph_${Date.now()}`

    // Save the new graph using saveGraphWithHistory for proper versioning
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

    console.log('=== SAVE RESPONSE ===')
    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (response.ok) {
      const result = await response.json()
      console.log('Save result:', result)
      console.log('Created graph ID:', result.id)
      console.log('===================')

      // Update the knowledge graph store with the graph ID and data
      knowledgeGraphStore.setCurrentGraphId(graphId) // Use our generated ID
      knowledgeGraphStore.updateGraphFromJson(graphData)

      console.log('Updated store with new graph ID:', graphId)
      console.log('Graph title:', graphData.metadata.title)

      alert(`Ny kunnskapsgraf opprettet: "${graphData.metadata.title}"`)
      emit('new-graph-created', { graphId: graphId, graphData }) // Use our generated ID
      close()
    } else {
      const errorText = await response.text()
      console.error('Save failed:', errorText)
      throw new Error(`Failed to save new graph: ${response.status} - ${errorText}`)
    }
  } catch (error) {
    console.error('Error creating new graph:', error)
    alert(`Error creating new graph: ${error.message}`)
  }
}

const resetProcessor = () => {
  transcriptText.value = ''
  knowledgeGraphPreview.value = null
  isProcessing.value = false
  youtubeUrl.value = ''
  videoId.value = ''
  searchQuery.value = ''
  searchResults.value = []
  selectedVideo.value = null
  videoMetadata.value = null
  inputMethod.value = 'upload'
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// Audio transcription redirect function
const redirectToNorwegianTranscription = () => {
  // Close the modal
  close()

  // Navigate to the Norwegian transcription page
  window.location.href = '/norwegian-transcription-test'
}

const close = () => {
  resetProcessor()
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  position: relative;
}

.close-button {
  position: absolute;
  top: 15px;
  right: 20px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.input-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-button {
  background: none;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: 500;
  color: #333;
  transition: all 0.3s ease;
}

.tab-button.active {
  border-bottom: 2px solid #007bff;
}

.upload-section {
  margin-bottom: 30px;
}

.upload-area {
  border: 2px dashed #007bff;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: #f8f9ff;
}

.upload-area:hover {
  border-color: #0056b3;
  background: #f0f4ff;
}

.file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-icon {
  font-size: 48px;
  color: #007bff;
  margin-bottom: 15px;
}

.paste-section {
  margin-bottom: 30px;
}

.youtube-section {
  margin-bottom: 30px;
}

.url-input-group {
  display: flex;
  gap: 10px;
}

.search-input-group {
  display: flex;
  gap: 10px;
}

.transcript-method-buttons {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.transcript-method-buttons .btn {
  flex: 1;
  font-size: 0.85em;
  min-width: 120px;
}

.method-explanation {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.processing-controls {
  margin-bottom: 20px;
}

.selected-video-info {
  margin-bottom: 20px;
}

.video-card {
  display: flex;
  gap: 10px;
  align-items: center;
}

.video-thumbnail img {
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
}

.video-info {
  flex: 1;
}

.video-title {
  font-weight: bold;
  color: #333;
}

.video-channel {
  color: #666;
}

.video-date {
  color: #666;
}

.video-actions {
  text-align: right;
}

.search-results {
  margin-bottom: 20px;
}

.video-list {
  max-height: 300px;
  overflow-y: auto;
}

.video-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.video-item:hover {
  background: #f0f0f0;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
}

.video-id-display {
  color: #007bff;
  font-weight: 500;
  margin-top: 5px;
  display: block;
}

.transcript-preview {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-top: 15px;
}

.preview-text {
  background: white;
  padding: 10px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  max-height: 150px;
  overflow-y: auto;
}

.full-transcript {
  max-height: 400px;
}

.processing-status {
  text-align: center;
  padding: 40px 20px;
}

.progress-container {
  max-width: 400px;
  margin: 0 auto;
}

.preview-section {
  margin: 15px 0;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  background: #f8f9fa;
}

.preview-stats {
  display: flex;
  gap: 15px;
  margin: 15px 0;
  justify-content: center;
}

.stat-card {
  background: white;
  padding: 10px 15px;
  border-radius: 6px;
  text-align: center;
  flex: 0 0 auto;
  min-width: 80px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat-card strong {
  display: block;
  font-size: 1.3em;
  color: #007bff;
  margin-bottom: 2px;
}

.nodes-preview {
  margin: 15px 0;
}

.node-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: white;
}

.node-item {
  border-bottom: 1px solid #f1f1f1;
  padding: 8px 12px;
  background: white;
  margin-bottom: 0;
}

.node-item:last-child {
  border-bottom: none;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.node-label {
  font-weight: 500;
  color: #333;
  font-size: 0.9em;
}

.node-type {
  background: #007bff;
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.75em;
}

.node-preview {
  color: #666;
  font-size: 0.85em;
  line-height: 1.3;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #e9ecef;
  flex-wrap: wrap;
  position: sticky;
  bottom: 0;
  background: white;
  margin-left: -20px;
  margin-right: -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.post-processing-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.post-processing-actions .btn {
  font-size: 0.9em;
  padding: 8px 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.video-metadata-section.compact-mode {
  margin-bottom: 10px;
}

.video-metadata-compact {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 15px;
}

.compact-video-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.compact-thumbnail {
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.compact-details {
  flex: 1;
  min-width: 0;
}

.compact-title {
  font-weight: 500;
  font-size: 0.9em;
  color: #333;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compact-meta {
  font-size: 0.8em;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-description {
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
  background: #f8f9fa;
  border-radius: 4px;
  padding: 8px;
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #dee2e6;
}

.description-header span {
  font-weight: 500;
  color: #333;
}

.description-content {
  max-height: 60px;
  overflow: hidden;
  transition: all 0.3s ease;
  white-space: pre-wrap;
  line-height: 1.4;
  position: relative;
}

.description-content.expanded {
  max-height: none;
}

.description-content:not(.expanded)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, #f8f9fa);
}

.btn-link {
  padding: 0;
  font-size: 0.85em;
  color: #007bff;
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
}

.btn-link:hover {
  text-decoration: underline;
}

.video-detailed-info {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.detail-label {
  font-size: 0.8em;
  color: #666;
  margin-bottom: 4px;
}

.detail-value {
  font-weight: 500;
  color: #333;
}

.video-description-box {
  margin-top: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  padding: 10px 12px;
  color: #444;
  font-size: 0.97em;
  border-left: 3px solid #007bff;
}
.video-description-content {
  margin-top: 4px;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Video Metadata Styles */
.video-metadata-section {
  margin: 25px 0;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-radius: 12px;
  border: 1px solid #e3e9ff;
}

.video-metadata-section h4 {
  margin-bottom: 20px;
  color: #2c3e50;
  text-align: center;
  font-weight: 600;
}

.metadata-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.metadata-header {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  align-items: flex-start;
}

.video-thumbnail-large {
  position: relative;
  flex-shrink: 0;
}

.video-thumbnail-large img {
  width: 160px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.video-overlay {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.video-overlay .btn {
  font-size: 0.75em;
  padding: 4px 8px;
  background: rgba(0, 123, 255, 0.9);
  border: none;
  color: white;
  text-decoration: none;
}

.video-overlay .btn:hover {
  background: rgba(0, 123, 255, 1);
}

.video-details {
  flex: 1;
  min-width: 0;
}

.video-title-meta {
  margin: 0 0 15px 0;
  color: #2c3e50;
  font-size: 1.1em;
  font-weight: 600;
  line-height: 1.3;
  word-wrap: break-word;
}

.video-info-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.9em;
}

.info-item i {
  color: #007bff;
  font-size: 1.1em;
  width: 16px;
  text-align: center;
}

.info-item span {
  color: #495057;
  font-weight: 500;
}

.video-description-meta {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
}

.description-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.description-header strong {
  color: #2c3e50;
}

.description-content {
  color: #495057;
  line-height: 1.5;
  max-height: 100px;
  overflow: hidden;
  transition: max-height 0.3s ease;
  white-space: pre-wrap;
}

.description-content.expanded {
  max-height: none;
}

.transcript-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 8px;
}

.stat-item {
  text-align: center;
  padding: 10px;
}

.stat-item strong {
  display: block;
  font-size: 1.5em;
  color: #2c3e50;
  margin-bottom: 5px;
}

.stat-item span {
  color: #6c757d;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    padding: 20px;
  }

  .modal-actions {
    justify-content: center;
  }

  .preview-stats {
    flex-direction: column;
    gap: 10px;
  }

  .option-cards {
    flex-direction: column;
    gap: 10px;
  }

  .metadata-header {
    flex-direction: column;
    gap: 15px;
  }

  .video-thumbnail-large {
    align-self: center;
  }

  .video-info-meta {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .transcript-stats {
    flex-direction: column;
    gap: 10px;
  }

  .description-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}

/* Audio Section Styles */
.audio-section {
  margin-bottom: 30px;
}

.audio-redirect-info {
  text-align: center;
  padding: 30px 20px;
}

.info-box {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: left;
}

.info-box i {
  color: #007bff;
  font-size: 24px;
  margin-top: 2px;
}

.info-box h5 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.info-box p {
  margin: 0;
  color: #6c757d;
  line-height: 1.5;
}

.btn-lg {
  padding: 12px 30px;
  font-size: 1.1rem;
}
</style>
