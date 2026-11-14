<template>
  <div class="ap-page" :class="{ 'is-dark': theme === 'dark', 'has-player': !!nowPlaying }">
    <div class="ap-wrap">
      <!-- Header -->
      <header class="ap-header">
        <div class="ap-title-row">
          <div class="ap-title">
            <h1>Recordings</h1>
            <p class="ap-subtitle">{{ countLabel }}</p>
          </div>
          <button
            type="button"
            class="ap-btn ap-btn-primary"
            :aria-expanded="showUpload"
            @click="showUpload = !showUpload"
          >
            <i class="bi" :class="showUpload ? 'bi-x-lg' : 'bi-upload'" aria-hidden="true"></i>
            <span>{{ showUpload ? 'Close upload' : 'Upload audio' }}</span>
          </button>
        </div>

        <div class="ap-toolbar">
          <label class="ap-search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <span class="visually-hidden">Search recordings</span>
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search titles, tags and summaries"
            />
          </label>
          <div class="ap-selects">
            <label v-if="isSuperadmin" class="ap-select">
              <span>Owner</span>
              <select v-model="ownerFilter">
                <option value="mine">Only mine</option>
                <option value="all">All owners (slow)</option>
                <option v-for="email in otherOwnerEmails" :key="email" :value="email">
                  {{ email }}
                </option>
              </select>
            </label>
            <label class="ap-select">
              <span>Sort</span>
              <select v-model="sortBy">
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="duration">Longest first</option>
                <option value="category">Category</option>
              </select>
            </label>
          </div>
        </div>

        <div v-if="categoryCounts.length > 1" class="ap-chips" role="group" aria-label="Filter by category">
          <button
            type="button"
            class="ap-chip"
            :class="{ active: selectedCategory === null }"
            :aria-pressed="selectedCategory === null"
            @click="selectedCategory = null"
          >
            All <span class="ap-chip-count">{{ recordings.length }}</span>
          </button>
          <button
            v-for="c in categoryCounts"
            :key="c.name"
            type="button"
            class="ap-chip"
            :class="{ active: selectedCategory === c.name }"
            :aria-pressed="selectedCategory === c.name"
            @click="selectedCategory = selectedCategory === c.name ? null : c.name"
          >
            {{ c.name }} <span class="ap-chip-count">{{ c.count }}</span>
          </button>
        </div>
      </header>

      <!-- Upload -->
      <section v-if="showUpload" class="ap-panel ap-upload" aria-label="Upload audio">
        <div class="ap-upload-grid">
          <label class="ap-field ap-field-file">
            <span>Audio file</span>
            <input
              ref="directUploadInput"
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg"
              @change="handleDirectUploadFileSelect"
            />
            <small v-if="directUploadFile" class="ap-muted">
              {{ directUploadFile.name }} · {{ formatFileSize(directUploadFile.size) }}
            </small>
          </label>
          <label class="ap-field">
            <span>Title</span>
            <input v-model="directUploadDisplayName" type="text" placeholder="Uses the file name if empty" />
          </label>
          <label class="ap-field">
            <span>Category</span>
            <select v-model="directUploadCategory">
              <option value="other">Other</option>
              <option value="music">Music</option>
              <option value="podcast">Podcast</option>
              <option value="general">General</option>
              <option value="Norwegian Transcription">Norwegian Transcription</option>
              <option value="Norwegian Transcription (Chunked)">Norwegian Transcription (Chunked)</option>
              <option value="Sanskrit Letter Audio">Sanskrit Letter Audio</option>
            </select>
          </label>
          <label class="ap-field">
            <span>Tags</span>
            <input v-model="directUploadTags" type="text" placeholder="Comma-separated, e.g. interview, draft" />
          </label>
        </div>
        <div class="ap-upload-actions">
          <p v-if="!userStore.loggedIn" class="ap-muted mb-0">Log in to upload audio.</p>
          <button
            type="button"
            class="ap-btn ap-btn-primary"
            :disabled="!directUploadFile || directUploading || !userStore.loggedIn"
            @click="uploadAudioDirectly"
          >
            <span v-if="directUploading" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            {{ directUploading ? 'Uploading…' : 'Upload' }}
          </button>
        </div>
        <p v-if="directUploadMessage" class="ap-alert ap-alert-info">{{ directUploadMessage }}</p>
        <p v-if="directUploadError" class="ap-alert ap-alert-error">{{ directUploadError }}</p>
      </section>

      <!-- Notice (replaces alert dialogs for action results) -->
      <div v-if="notice" class="ap-alert" :class="notice.type === 'error' ? 'ap-alert-error' : 'ap-alert-info'" role="status">
        <span>{{ notice.text }}</span>
        <button type="button" class="ap-icon-btn" aria-label="Dismiss" @click="notice = null">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="ap-list" aria-busy="true">
        <div v-for="n in 5" :key="n" class="ap-row ap-skeleton">
          <div class="ap-play-btn"></div>
          <div class="ap-row-main">
            <div class="ap-skel-line w-60"></div>
            <div class="ap-skel-line w-40"></div>
          </div>
        </div>
        <span class="visually-hidden">Loading recordings…</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="ap-empty">
        <h2>Couldn't load your recordings</h2>
        <p class="ap-muted">{{ error }}</p>
        <button type="button" class="ap-btn" @click="fetchRecordings">Try again</button>
      </div>

      <!-- Empty: no recordings at all -->
      <div v-else-if="recordings.length === 0" class="ap-empty">
        <i class="bi bi-mic ap-empty-icon" aria-hidden="true"></i>
        <h2>No recordings yet</h2>
        <p class="ap-muted">Upload an audio file, or record one in a graph's audio node.</p>
        <button type="button" class="ap-btn ap-btn-primary" @click="showUpload = true">
          <i class="bi bi-upload" aria-hidden="true"></i> Upload audio
        </button>
      </div>

      <!-- Empty: filters hide everything -->
      <div v-else-if="filteredRecordings.length === 0" class="ap-empty">
        <h2>No recordings match</h2>
        <p class="ap-muted">Try a different search or category.</p>
        <button type="button" class="ap-btn" @click="clearFilters">Clear filters</button>
      </div>

      <!-- List -->
      <template v-else>
        <ul class="ap-list">
          <li
            v-for="recording in visibleRecordings"
            :key="recId(recording)"
            class="ap-row"
            :class="{ 'is-playing': nowPlaying && recId(nowPlaying) === recId(recording) }"
          >
            <!-- Edit mode -->
            <form
              v-if="editingRecordingId === recId(recording)"
              class="ap-edit"
              @submit.prevent="saveEdit(recording)"
            >
              <label class="ap-field">
                <span>Title</span>
                <input v-model="editingRecording.displayName" type="text" />
              </label>
              <label class="ap-field">
                <span>Category</span>
                <input v-model="editingRecording.metadata.category" type="text" placeholder="e.g. Meeting, Interview" />
              </label>
              <label class="ap-field">
                <span>Tags</span>
                <input
                  type="text"
                  :value="(editingRecording.metadata?.tags || []).join(', ')"
                  placeholder="Comma-separated"
                  @input="updateTags"
                />
              </label>
              <div class="ap-edit-actions">
                <button type="button" class="ap-btn" @click="cancelEdit">Cancel</button>
                <button type="submit" class="ap-btn ap-btn-primary">Save changes</button>
              </div>
            </form>

            <!-- View mode -->
            <template v-else>
              <button
                type="button"
                class="ap-play-btn"
                :disabled="!recordingAudioUrl(recording)"
                :aria-label="(isPlaying(recording) ? 'Pause ' : 'Play ') + recordingTitle(recording)"
                @click="togglePlay(recording)"
              >
                <i class="bi" :class="isPlaying(recording) ? 'bi-pause-fill' : 'bi-play-fill'" aria-hidden="true"></i>
              </button>

              <div class="ap-row-main">
                <div class="ap-row-head">
                  <h3 class="ap-row-title" :title="recordingTitle(recording)">{{ recordingTitle(recording) }}</h3>
                  <span
                    v-if="isSuperadmin"
                    class="ap-badge"
                    :class="recording.publicationState === 'published' ? 'ap-badge-ok' : 'ap-badge-warn'"
                  >
                    {{ recording.publicationState === 'published' ? 'Published' : 'Draft' }}
                  </span>
                </div>
                <p class="ap-meta">
                  <span>{{ formatShortDate(recording.metadata?.uploadedAt || recording.createdAt) }}</span>
                  <!-- Many older recordings were saved with duration 0; it is filled in when played. -->
                  <span v-if="recording.estimatedDuration || recording.duration">
                    {{ formatDuration(recording.estimatedDuration || recording.duration) }}
                  </span>
                  <span v-if="recording.fileSize">{{ formatFileSize(recording.fileSize) }}</span>
                  <span v-if="showOwnerColumn" class="ap-owner">{{ recording.userEmail }}</span>
                </p>
                <p v-if="recording.transcriptionExcerpt" class="ap-excerpt">{{ recording.transcriptionExcerpt }}</p>
                <div class="ap-tags">
                  <span class="ap-tag ap-tag-cat">{{ recordingCategory(recording) }}</span>
                  <span v-if="recording.has_norwegianTranscription" class="ap-tag">Norwegian</span>
                  <span v-if="recording.has_conversationAnalysis" class="ap-tag">AI analysis</span>
                  <span v-for="tag in recordingTags(recording).slice(0, 3)" :key="tag" class="ap-tag">{{ tag }}</span>
                  <span v-if="recordingTags(recording).length > 3" class="ap-tag ap-tag-more">
                    +{{ recordingTags(recording).length - 3 }}
                  </span>
                </div>
              </div>

              <div class="ap-row-actions">
                <button
                  v-if="hasTranscript(recording)"
                  type="button"
                  class="ap-btn ap-btn-sm ap-hide-sm"
                  @click="showFullTranscription(recording)"
                >
                  Transcript
                </button>
                <div class="ap-menu-wrap">
                  <button
                    type="button"
                    class="ap-icon-btn"
                    aria-haspopup="menu"
                    :aria-expanded="openMenuId === recId(recording)"
                    :aria-label="'More actions for ' + recordingTitle(recording)"
                    @click.stop="toggleMenu(recording)"
                  >
                    <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                  </button>
                  <div v-if="openMenuId === recId(recording)" class="ap-menu" role="menu" @click.stop>
                    <button v-if="hasTranscript(recording)" class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => showFullTranscription(recording))">
                      <i class="bi bi-file-text" aria-hidden="true"></i> View transcript
                    </button>
                    <button v-if="recording.has_conversationAnalysis || recording.conversationAnalysis" class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => viewAnalysis(recording))">
                      <i class="bi bi-graph-up" aria-hidden="true"></i> View analysis
                    </button>
                    <button class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => startEdit(recording))">
                      <i class="bi bi-pencil" aria-hidden="true"></i> Edit details
                    </button>
                    <button v-if="recordingAudioUrl(recording)" class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => (clippingRecording = recording))">
                      <i class="bi bi-scissors" aria-hidden="true"></i> Create clip
                    </button>
                    <button v-if="recordingAudioUrl(recording)" class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => reTranscribe(recording))">
                      <i class="bi bi-arrow-repeat" aria-hidden="true"></i> Transcribe again
                    </button>
                    <button v-if="recordingAudioUrl(recording)" class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => copyAudioLink(recording))">
                      <i class="bi bi-link-45deg" aria-hidden="true"></i> Copy audio link
                    </button>
                    <template v-if="isSuperadmin">
                      <hr class="ap-menu-sep" />
                      <button class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => requestTogglePublication(recording))">
                        <i class="bi" :class="recording.publicationState === 'published' ? 'bi-eye-slash' : 'bi-globe'" aria-hidden="true"></i>
                        {{ recording.publicationState === 'published' ? 'Unpublish' : 'Publish' }}
                      </button>
                      <button class="ap-menu-item" role="menuitem" type="button" @click="menuAction(() => showRawData(recording))">
                        <i class="bi bi-code-slash" aria-hidden="true"></i> Raw data
                      </button>
                    </template>
                    <hr class="ap-menu-sep" />
                    <button class="ap-menu-item ap-menu-danger" role="menuitem" type="button" @click="menuAction(() => confirmDelete(recording))">
                      <i class="bi bi-trash" aria-hidden="true"></i> Delete
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </li>
        </ul>

        <div class="ap-list-footer">
          <p class="ap-muted mb-0">
            Showing {{ visibleRecordings.length }} of {{ filteredRecordings.length }}
            <span v-if="loadingMore"> · loading more…</span>
          </p>
          <button
            v-if="visibleRecordings.length < filteredRecordings.length"
            type="button"
            class="ap-btn"
            @click="visibleCount += PAGE_SIZE"
          >
            Show more
          </button>
        </div>
      </template>
    </div>

    <!-- Docked player: one audio element for the whole page -->
    <div v-if="nowPlaying" class="ap-player" role="region" aria-label="Now playing">
      <div class="ap-player-info">
        <strong :title="recordingTitle(nowPlaying)">{{ recordingTitle(nowPlaying) }}</strong>
        <small v-if="playerError" class="ap-player-error">{{ playerError }}</small>
      </div>
      <audio
        ref="playerEl"
        :src="recordingAudioUrl(nowPlaying)"
        controls
        autoplay
        preload="metadata"
        @play="playerPaused = false"
        @pause="playerPaused = true"
        @error="handleAudioError($event, nowPlaying)"
        @loadedmetadata="handleAudioMetadata($event, nowPlaying)"
      ></audio>
      <button type="button" class="ap-icon-btn" aria-label="Close player" @click="closePlayer">
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Transcript dialog -->
    <div v-if="transcriptOpen" class="ap-modal-backdrop" @click.self="transcriptOpen = false">
      <div class="ap-modal" role="dialog" aria-modal="true" aria-labelledby="ap-transcript-title">
        <header class="ap-modal-head">
          <h2 id="ap-transcript-title">{{ recordingTitle(selectedRecording) }}</h2>
          <button type="button" class="ap-icon-btn" aria-label="Close" @click="transcriptOpen = false">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </header>
        <div class="ap-modal-body">
          <p v-if="detailLoading" class="ap-muted">Loading transcript…</p>
          <p v-else-if="detailError" class="ap-alert ap-alert-error">{{ detailError }}</p>
          <template v-else-if="fullRecording">
            <p class="ap-meta">
              <span>{{ fullRecording.transcription?.service || fullRecording.aiService || 'Unknown service' }}</span>
              <span>{{ fullRecording.transcription?.model || fullRecording.aiModel || 'Unknown model' }}</span>
            </p>
            <template v-if="fullRecording.norwegianTranscription">
              <section v-if="fullRecording.norwegianTranscription.improved_text" class="ap-transcript">
                <h3>AI-improved text</h3>
                <p>{{ fullRecording.norwegianTranscription.improved_text }}</p>
              </section>
              <section class="ap-transcript">
                <h3>Original transcription</h3>
                <p>{{ fullRecording.norwegianTranscription.raw_text || 'No original text saved.' }}</p>
              </section>
            </template>
            <section v-else class="ap-transcript">
              <p>{{ fullRecording.transcription?.text || fullRecording.transcriptionText || 'This recording has no transcript.' }}</p>
            </section>
          </template>
        </div>
        <footer class="ap-modal-foot">
          <button type="button" class="ap-btn" :disabled="!fullRecording" @click="copyTranscription">
            {{ copied ? 'Copied' : 'Copy text' }}
          </button>
          <button type="button" class="ap-btn ap-btn-primary" @click="transcriptOpen = false">Close</button>
        </footer>
      </div>
    </div>

    <!-- Raw data dialog (Superadmin) -->
    <div v-if="rawOpen" class="ap-modal-backdrop" @click.self="rawOpen = false">
      <div class="ap-modal ap-modal-wide" role="dialog" aria-modal="true" aria-labelledby="ap-raw-title">
        <header class="ap-modal-head">
          <h2 id="ap-raw-title">Raw data · {{ recordingTitle(selectedRecording) }}</h2>
          <button type="button" class="ap-icon-btn" aria-label="Close" @click="rawOpen = false">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </header>
        <div class="ap-modal-body">
          <p v-if="detailLoading" class="ap-muted">Loading…</p>
          <p v-else-if="detailError" class="ap-alert ap-alert-error">{{ detailError }}</p>
          <pre v-else class="ap-raw">{{ formatRawData(fullRecording) }}</pre>
        </div>
        <footer class="ap-modal-foot">
          <button type="button" class="ap-btn" :disabled="!fullRecording" @click="copyRawData">
            {{ copied ? 'Copied' : 'Copy JSON' }}
          </button>
          <button type="button" class="ap-btn ap-btn-primary" @click="rawOpen = false">Close</button>
        </footer>
      </div>
    </div>

    <!-- Confirm dialog -->
    <div v-if="confirmState" class="ap-modal-backdrop" @click.self="confirmState = null">
      <div class="ap-modal ap-modal-narrow" role="alertdialog" aria-modal="true" aria-labelledby="ap-confirm-title">
        <header class="ap-modal-head">
          <h2 id="ap-confirm-title">{{ confirmState.title }}</h2>
        </header>
        <div class="ap-modal-body">
          <p class="mb-0">{{ confirmState.body }}</p>
        </div>
        <footer class="ap-modal-foot">
          <button type="button" class="ap-btn" @click="confirmState = null">{{ confirmState.cancelLabel }}</button>
          <button
            type="button"
            class="ap-btn"
            :class="confirmState.danger ? 'ap-btn-danger' : 'ap-btn-primary'"
            @click="runConfirm"
          >
            {{ confirmState.confirmLabel }}
          </button>
        </footer>
      </div>
    </div>

    <!-- Audio Clip Modal -->
    <AudioClipModal
      :recording="clippingRecording"
      @close="clippingRecording = null"
      @clip-saved="clippingRecording = null; fetchRecordings()"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { apiUrls } from '@/config/api'
import AudioClipModal from '../components/AudioClipModal.vue'

defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

const userStore = useUserStore()
const router = useRouter()

const PAGE_SIZE = 25

// Reactive data
const recordings = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(null)
const searchQuery = ref('')
const sortBy = ref('date-desc')
const selectedCategory = ref(null)
const visibleCount = ref(PAGE_SIZE)
const editingRecordingId = ref(null)
const editingRecording = ref(null)
const selectedRecording = ref(null)
const fullRecording = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const transcriptOpen = ref(false)
const rawOpen = ref(false)
const copied = ref(false)
const confirmState = ref(null)
const notice = ref(null)
// Superadmin owner view: 'mine' (fast, paged), 'all' (every owner, slow), or one owner's email.
const ownerFilter = ref('mine')
const adminOwnerEmails = ref([])
const showUpload = ref(false)
const directUploadInput = ref(null)
const directUploadFile = ref(null)
const directUploadDisplayName = ref('')
const directUploadCategory = ref('other')
const directUploadTags = ref('')
const directUploading = ref(false)
const directUploadMessage = ref('')
const directUploadError = ref('')
const clippingRecording = ref(null)
// One shared player. The page used to render an <audio> per recording; with hundreds on one
// page Chrome's per-page media-player cap failed every player past ~238 (code 4) — 2026-11-14.
// Row actions menu (Vue-controlled; Bootstrap's data-api dropdown does not bind on this page).
const openMenuId = ref(null)
const toggleMenu = (r) => {
  openMenuId.value = openMenuId.value === recId(r) ? null : recId(r)
}
const menuAction = (fn) => {
  openMenuId.value = null
  fn()
}
const closeMenu = () => {
  openMenuId.value = null
}
const onKeydown = (e) => {
  if (e.key !== 'Escape') return
  if (openMenuId.value) openMenuId.value = null
  else if (confirmState.value) confirmState.value = null
  else if (transcriptOpen.value) transcriptOpen.value = false
  else if (rawOpen.value) rawOpen.value = false
}
const nowPlaying = ref(null)
const playerEl = ref(null)
const playerPaused = ref(false)
const playerError = ref('')

// audio-portfolio-worker authenticates per-user routes with X-API-Token (emailVerificationToken).
const authHeaders = (extra = {}) => ({
  ...extra,
  'X-API-Token': userStore.emailVerificationToken || '',
})

const NORWEGIAN_WORKER_URL = 'https://norwegian-transcription-worker.torarnehave.workers.dev'
const AUDIO_PORTFOLIO_WORKER_URL = 'https://audio-portfolio-worker.torarnehave.workers.dev'

const isSuperadmin = computed(() => userStore.role === 'Superadmin')

// Field helpers (records come in several historical shapes)
const recId = (r) => r?.recordingId || r?.id
const recordingTitle = (r) => r?.displayName || r?.fileName || 'Untitled recording'
const recordingCategory = (r) => r?.metadata?.category || r?.category || 'Uncategorized'
const recordingTags = (r) => r?.metadata?.tags || r?.tags || []
const recordingOwner = (r) => r?.userEmail || r?.ownerEmail || r?.metadata?.userEmail || ''
const recordingDate = (r) => new Date(r?.metadata?.uploadedAt || r?.createdAt || 0)
const hasTranscript = (r) =>
  Boolean(
    r?.hasTranscript ||
      r?.has_norwegianTranscription ||
      r?.transcriptionText ||
      r?.transcription?.text ||
      r?.norwegianTranscription ||
      r?.transcriptionExcerpt,
  )

const showOwnerColumn = computed(() => isSuperadmin.value && ownerFilter.value === 'all')

const countLabel = computed(() => {
  if (loading.value) return 'Loading…'
  const n = recordings.value.length
  const scope = isSuperadmin.value
    ? ownerFilter.value === 'mine'
      ? ''
      : ownerFilter.value === 'all'
        ? ' across all owners'
        : ` for ${ownerFilter.value}`
    : ''
  return `${n} recording${n === 1 ? '' : 's'}${scope}`
})

const filteredRecordings = computed(() => {
  let filtered = recordings.value

  if (selectedCategory.value) {
    filtered = filtered.filter((r) => recordingCategory(r) === selectedCategory.value)
  }

  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    filtered = filtered.filter((r) => {
      const haystack = [
        recordingTitle(r),
        r.fileName || '',
        recordingCategory(r),
        r.transcriptionExcerpt || '',
        r.transcription?.text || r.transcriptionText || '',
        ...recordingTags(r),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }

  return [...filtered].sort((a, b) => {
    switch (sortBy.value) {
      case 'date-desc':
        return recordingDate(b) - recordingDate(a)
      case 'date-asc':
        return recordingDate(a) - recordingDate(b)
      case 'name-asc':
        return recordingTitle(a).localeCompare(recordingTitle(b))
      case 'name-desc':
        return recordingTitle(b).localeCompare(recordingTitle(a))
      case 'duration':
        return (b.estimatedDuration || b.duration || 0) - (a.estimatedDuration || a.duration || 0)
      case 'category':
        return recordingCategory(a).localeCompare(recordingCategory(b))
      default:
        return 0
    }
  })
})

const visibleRecordings = computed(() => filteredRecordings.value.slice(0, visibleCount.value))

watch([searchQuery, selectedCategory, sortBy], () => {
  visibleCount.value = PAGE_SIZE
})

const categoryCounts = computed(() => {
  const counts = new Map()
  recordings.value.forEach((r) => {
    const c = recordingCategory(r)
    counts.set(c, (counts.get(c) || 0) + 1)
  })
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

const otherOwnerEmails = computed(() => {
  const emails = new Set(adminOwnerEmails.value)
  recordings.value.forEach((r) => {
    const e = recordingOwner(r)
    if (e) emails.add(e)
  })
  emails.delete(userStore.email)
  return [...emails].sort()
})

const clearFilters = () => {
  searchQuery.value = ''
  selectedCategory.value = null
}

const showNotice = (text, type = 'info') => {
  notice.value = { text, type }
  const current = notice.value
  setTimeout(() => {
    if (notice.value === current) notice.value = null
  }, 6000)
}

const recordingAudioUrl = (recording) => {
  if (!recording) return ''

  const baseOrigin = (() => {
    if (recording.r2Url) {
      try {
        return new URL(recording.r2Url).origin
      } catch {
        return null
      }
    }
    return null
  })()

  const encodeKey = (key) =>
    String(key)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')

  if (recording.r2Key && baseOrigin) return `${baseOrigin}/${encodeKey(recording.r2Key)}`
  if (recording.r2Url) return recording.r2Url
  if (recording.r2Key) return `https://audio.vegvisr.org/${encodeKey(recording.r2Key)}`
  return ''
}

// ── Player ──────────────────────────────────────────────
const isPlaying = (r) => nowPlaying.value && recId(nowPlaying.value) === recId(r) && !playerPaused.value

const togglePlay = async (recording) => {
  if (nowPlaying.value && recId(nowPlaying.value) === recId(recording)) {
    const el = playerEl.value
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
    return
  }
  playerError.value = ''
  playerPaused.value = false
  nowPlaying.value = recording
  await nextTick()
  playerEl.value?.play().catch(() => {})
}

const closePlayer = () => {
  playerEl.value?.pause()
  nowPlaying.value = null
  playerError.value = ''
}

// ── Upload ─────────────────────────────────────────────
const handleDirectUploadFileSelect = (event) => {
  const file = event.target?.files?.[0]
  directUploadFile.value = file || null
  directUploadError.value = ''
  directUploadMessage.value = ''
  if (file && !directUploadDisplayName.value) {
    directUploadDisplayName.value = file.name.replace(/\.[^/.]+$/, '')
  }
}

const getAudioDurationSeconds = (blob) =>
  new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.addEventListener('loadedmetadata', () => {
        const duration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0
        URL.revokeObjectURL(url)
        resolve(duration)
      })
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        resolve(0)
      })
    } catch {
      resolve(0)
    }
  })

const uploadAudioDirectly = async () => {
  if (!directUploadFile.value || !userStore.loggedIn) return

  directUploading.value = true
  directUploadError.value = ''
  directUploadMessage.value = 'Uploading audio…'

  try {
    const file = directUploadFile.value
    const duration = await getAudioDurationSeconds(file)

    const uploadResponse = await fetch(`${NORWEGIAN_WORKER_URL}/upload`, {
      method: 'POST',
      headers: {
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      let msg = `Upload failed (${uploadResponse.status}).`
      try {
        const data = await uploadResponse.json()
        msg = data.error || msg
      } catch {
        // ignore
      }
      throw new Error(msg)
    }

    const uploadResult = await uploadResponse.json()
    const parsedTags = directUploadTags.value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    const recordingData = {
      userEmail: userStore.email,
      fileName: file.name,
      displayName: directUploadDisplayName.value || file.name.replace(/\.[^/.]+$/, ''),
      fileSize: file.size,
      duration,
      r2Key: uploadResult.r2Key,
      r2Url: uploadResult.audioUrl,
      transcriptionText: '',
      category: directUploadCategory.value || 'other',
      tags: ['audio-only', 'direct-upload', ...parsedTags],
      audioFormat: file.type?.split('/')[1] || 'unknown',
      aiService: 'none',
      aiModel: 'none',
      processingTime: 0,
    }

    const saveResponse = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/save-recording`, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': 'application/json',
        'X-User-Email': userStore.email,
      }),
      body: JSON.stringify(recordingData),
    })

    if (!saveResponse.ok) {
      let msg = `Saving failed (${saveResponse.status}).`
      try {
        const data = await saveResponse.json()
        msg = data.error || msg
      } catch {
        // ignore
      }
      throw new Error(msg)
    }

    directUploadMessage.value = `Uploaded "${recordingData.displayName}".`
    directUploadFile.value = null
    directUploadDisplayName.value = ''
    directUploadCategory.value = 'other'
    directUploadTags.value = ''
    if (directUploadInput.value) directUploadInput.value.value = ''
    await fetchRecordings()
  } catch (err) {
    console.error('Direct upload failed:', err)
    directUploadMessage.value = ''
    directUploadError.value = `Upload failed. ${err.message || ''} Check the file and try again.`
  } finally {
    directUploading.value = false
  }
}

// ── Loading ────────────────────────────────────────────
// Each fetch gets a run number; a later fetch (owner switch, upload) abandons older ones.
let fetchRun = 0

const listUrl = (params) => `${AUDIO_PORTFOLIO_WORKER_URL}/list-recordings?${new URLSearchParams(params).toString()}`

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) {
    let detail = response.statusText
    try {
      detail = (await response.json()).error || detail
    } catch {
      // ignore
    }
    throw new Error(`The server answered ${response.status}: ${detail}`)
  }
  return response.json()
}

// One owner, newest first, light records (no transcript bodies). The first page renders on its
// own; the rest streams in behind it so search and category counts cover everything.
const fetchOwnerPaged = async (run, ownerEmail) => {
  const base = { userEmail: userStore.email, order: 'newest', fields: 'light' }
  if (ownerEmail && ownerEmail !== userStore.email) base.ownerEmail = ownerEmail

  const first = await fetchJson(listUrl({ ...base, offset: '0', limit: String(PAGE_SIZE) }))
  if (run !== fetchRun) return
  recordings.value = first.recordings || []
  loading.value = false

  let offset = first.nextOffset ?? recordings.value.length
  let hasMore = Boolean(first.hasMore)
  loadingMore.value = hasMore
  while (hasMore) {
    const page = await fetchJson(listUrl({ ...base, offset: String(offset), limit: '500' }))
    if (run !== fetchRun) return
    recordings.value = [...recordings.value, ...(page.recordings || [])]
    offset = page.nextOffset ?? offset + (page.recordings || []).length
    hasMore = Boolean(page.hasMore) && (page.recordings || []).length > 0
  }
  loadingMore.value = false
}

// Every owner (Superadmin only). The worker has no paged form for this, so it is one slow call.
const fetchAllOwners = async (run) => {
  const data = await fetchJson(listUrl({ userEmail: userStore.email, limit: '500' }))
  if (run !== fetchRun) return
  recordings.value = data.recordings || []
}

const fetchRecordings = async () => {
  if (!userStore.email) {
    error.value = 'Log in to see your recordings.'
    return
  }

  const run = ++fetchRun
  loading.value = true
  loadingMore.value = false
  error.value = null
  visibleCount.value = PAGE_SIZE

  try {
    if (isSuperadmin.value && ownerFilter.value === 'all') {
      await fetchAllOwners(run)
    } else {
      const owner = isSuperadmin.value && ownerFilter.value !== 'mine' ? ownerFilter.value : userStore.email
      await fetchOwnerPaged(run, owner)
    }
  } catch (err) {
    if (run !== fetchRun) return
    console.error('Error fetching recordings:', err)
    error.value = err.message
  } finally {
    if (run === fetchRun) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

watch(ownerFilter, () => {
  selectedCategory.value = null
  fetchRecordings()
})

// Full record (transcript, analysis) for one recording — list rows are light.
const fetchFullRecording = async (recording) => {
  const owner = recordingOwner(recording)
  const params = { userEmail: userStore.email, recordingId: recId(recording) }
  if (owner && owner !== userStore.email) params.ownerEmail = owner
  const data = await fetchJson(
    `${AUDIO_PORTFOLIO_WORKER_URL}/get-recording?${new URLSearchParams(params).toString()}`,
  )
  return data.recording
}

const openDetail = async (recording) => {
  selectedRecording.value = recording
  fullRecording.value = null
  detailError.value = ''
  copied.value = false
  detailLoading.value = true
  try {
    fullRecording.value = await fetchFullRecording(recording)
  } catch (err) {
    detailError.value = `Couldn't load this recording. ${err.message}`
  } finally {
    detailLoading.value = false
  }
}

const showFullTranscription = (recording) => {
  transcriptOpen.value = true
  openDetail(recording)
}

const showRawData = (recording) => {
  rawOpen.value = true
  openDetail(recording)
}

// ── Edit ──────────────────────────────────────────────
const startEdit = (recording) => {
  editingRecordingId.value = recId(recording)
  editingRecording.value = {
    displayName: recordingTitle(recording),
    metadata: {
      category: recordingCategory(recording),
      tags: [...recordingTags(recording)],
    },
  }
}

const cancelEdit = () => {
  editingRecordingId.value = null
  editingRecording.value = null
}

const updateTags = (event) => {
  editingRecording.value.metadata.tags = event.target.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

const saveEdit = async (recording) => {
  try {
    const response = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/update-recording`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        userEmail: recordingOwner(recording) || userStore.email,
        recordingId: recId(recording),
        updates: editingRecording.value,
      }),
    })

    if (!response.ok) {
      throw new Error(`The server answered ${response.status}.`)
    }

    const target = recordings.value.find((r) => recId(r) === recId(recording))
    if (target) {
      target.displayName = editingRecording.value.displayName
      if (!target.metadata) target.metadata = {}
      target.metadata.category = editingRecording.value.metadata.category
      target.metadata.tags = editingRecording.value.metadata.tags
    }

    cancelEdit()
    showNotice('Changes saved.')
  } catch (err) {
    console.error('Error updating recording:', err)
    showNotice(`Couldn't save changes. ${err.message} Try again.`, 'error')
  }
}

// ── Confirm-backed actions ──────────────────────────────
const runConfirm = async () => {
  const action = confirmState.value?.action
  confirmState.value = null
  if (action) await action()
}

const confirmDelete = (recording) => {
  confirmState.value = {
    title: `Delete "${recordingTitle(recording)}"?`,
    body: 'This removes the recording and its transcript from your portfolio. It can\'t be undone.',
    confirmLabel: 'Delete recording',
    cancelLabel: 'Keep it',
    danger: true,
    action: () => deleteRecording(recording),
  }
}

const deleteRecording = async (recording) => {
  try {
    const recordingId = recId(recording)
    const params = new URLSearchParams({
      userEmail: recordingOwner(recording) || userStore.email,
      recordingId,
    })
    const response = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/delete-recording?${params.toString()}`, {
      method: 'DELETE',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || response.statusText)
    }

    if (nowPlaying.value && recId(nowPlaying.value) === recordingId) closePlayer()
    recordings.value = recordings.value.filter((r) => recId(r) !== recordingId)
    showNotice(`Deleted "${recordingTitle(recording)}".`)
  } catch (err) {
    console.error('Error deleting recording:', err)
    showNotice(`Couldn't delete "${recordingTitle(recording)}". ${err.message}`, 'error')
  }
}

const requestTogglePublication = (recording) => {
  const publishing = recording.publicationState !== 'published'
  confirmState.value = publishing
    ? {
        title: `Publish "${recordingTitle(recording)}"?`,
        body: 'Everyone will be able to find and play it.',
        confirmLabel: 'Publish',
        cancelLabel: 'Cancel',
        danger: false,
        action: () => togglePublicationState(recording),
      }
    : {
        title: `Unpublish "${recordingTitle(recording)}"?`,
        body: 'Only its owner and Superadmins will see it.',
        confirmLabel: 'Unpublish',
        cancelLabel: 'Cancel',
        danger: false,
        action: () => togglePublicationState(recording),
      }
}

const togglePublicationState = async (recording) => {
  if (!isSuperadmin.value) return

  const newState = recording.publicationState === 'published' ? 'draft' : 'published'
  try {
    const response = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/update-publication-state`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        userEmail: recordingOwner(recording) || userStore.email,
        recordingId: recId(recording),
        publicationState: newState,
        requestingUserRole: 'Superadmin',
      }),
    })

    if (!response.ok) {
      throw new Error(`The server answered ${response.status}.`)
    }

    recording.publicationState = newState
    recording.publishedAt = newState === 'published' ? new Date().toISOString() : null
    showNotice(newState === 'published' ? 'Published.' : 'Moved back to draft.')
  } catch (err) {
    console.error('Error updating publication state:', err)
    showNotice(`Couldn't change publication state. ${err.message}`, 'error')
  }
}

// ── Navigation actions ─────────────────────────────────
const viewAnalysis = (recording) => {
  const recordingId = recId(recording)
  if (!recordingId) {
    showNotice('This recording has no ID, so its analysis can\'t be opened.', 'error')
    return
  }
  router.push({ name: 'conversation-analysis', query: { recordingId } }).catch((err) => {
    console.error('Navigation error:', err)
    showNotice('Couldn\'t open the analysis page.', 'error')
  })
}

const reTranscribe = (recording) => {
  const audioUrl = recordingAudioUrl(recording)
  if (!audioUrl) {
    showNotice('This recording has no audio file to transcribe.', 'error')
    return
  }
  router
    .push({
      path: '/norwegian-transcription-test',
      query: {
        audioUrl,
        fileName: recording.fileName || recording.displayName,
        recordingId: recId(recording),
        fromPortfolio: 'true',
      },
    })
    .catch((err) => {
      console.error('Navigation error:', err)
      showNotice('Couldn\'t open the transcription page.', 'error')
    })
}

const copyAudioLink = async (recording) => {
  try {
    await navigator.clipboard.writeText(recordingAudioUrl(recording))
    showNotice('Audio link copied.')
  } catch {
    showNotice('Couldn\'t copy the link. Your browser blocked clipboard access.', 'error')
  }
}

// ── Copy ──────────────────────────────────────────────
const formatRawData = (recording) => (recording ? JSON.stringify(recording, null, 2) : '{}')

const flashCopied = () => {
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const copyRawData = () => {
  if (!fullRecording.value) return
  navigator.clipboard
    .writeText(formatRawData(fullRecording.value))
    .then(flashCopied)
    .catch(() => showNotice('Couldn\'t copy. Your browser blocked clipboard access.', 'error'))
}

const copyTranscription = () => {
  const r = fullRecording.value
  if (!r) return
  let text
  if (r.norwegianTranscription) {
    const { improved_text: improved, raw_text: raw } = r.norwegianTranscription
    text = improved
      ? `AI-improved text:\n${improved}\n\nOriginal transcription:\n${raw || ''}`
      : raw || ''
  } else {
    text = r.transcription?.text || r.transcriptionText || ''
  }
  navigator.clipboard
    .writeText(text)
    .then(flashCopied)
    .catch(() => showNotice('Couldn\'t copy. Your browser blocked clipboard access.', 'error'))
}

// ── Formatting ────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatShortDate = (dateString) => {
  if (!dateString) return 'Unknown date'
  const date = new Date(dateString)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// Backfill a missing duration once the docked player has read the file's metadata.
const handleAudioMetadata = async (event, recording) => {
  const duration = Math.floor(event.target.duration)
  if (!recording || !Number.isFinite(duration) || recording.duration) return
  try {
    const response = await fetch(`${AUDIO_PORTFOLIO_WORKER_URL}/update-recording`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        userEmail: recordingOwner(recording) || userStore.email,
        recordingId: recId(recording),
        updates: { duration },
      }),
    })
    if (response.ok) recording.duration = duration
  } catch (err) {
    console.error('Error updating duration:', err)
  }
}

const handleAudioError = (event, recording) => {
  const messages = {
    1: 'Playback was stopped.',
    2: 'A network error interrupted the download. Check your connection and press play again.',
    3: 'The file is damaged or in a format this browser can\'t play.',
    4: 'The file is missing or in a format this browser can\'t play.',
  }
  const code = event.target?.error?.code
  console.error('Audio error', code, recordingAudioUrl(recording))
  playerError.value = `Can't play this recording. ${messages[code] || 'Try again later.'}`
}

const fetchAdminOwnerEmails = async () => {
  if (!isSuperadmin.value) return
  try {
    const response = await fetch(apiUrls.listUsersByRole(['Superadmin', 'Admin']))
    if (!response.ok) throw new Error(response.statusText)
    const data = await response.json()
    adminOwnerEmails.value = (data.users || []).map((user) => user.email).filter(Boolean)
  } catch (err) {
    console.error('Error fetching admin users:', err)
  }
}

onMounted(() => {
  fetchRecordings()
  fetchAdminOwnerEmails()
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ap-page {
  --ap-bg: #f6f7f9;
  --ap-surface: #ffffff;
  --ap-surface-2: #f1f3f5;
  --ap-border: #e3e6ea;
  --ap-text: #1b1f24;
  --ap-muted: #626b75;
  --ap-accent: #2f5bd3;
  --ap-accent-soft: #e8eefc;
  --ap-accent-text: #ffffff;
  --ap-danger: #c62f2f;
  --ap-danger-soft: #fdecec;
  --ap-ok: #1f7a46;
  --ap-ok-soft: #e5f4ec;
  --ap-warn: #8a5a00;
  --ap-warn-soft: #fff4dc;
  --ap-radius: 12px;
  --ap-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);

  background: var(--ap-bg);
  color: var(--ap-text);
  min-height: 100vh;
  padding: 24px 16px 48px;
}

.ap-page.is-dark {
  --ap-bg: #121417;
  --ap-surface: #1b1e23;
  --ap-surface-2: #23272d;
  --ap-border: #2e333a;
  --ap-text: #e8eaed;
  --ap-muted: #9aa3ad;
  --ap-accent: #7c9cf2;
  --ap-accent-soft: #23304f;
  --ap-accent-text: #0e1220;
  --ap-danger: #f07b7b;
  --ap-danger-soft: #3a2224;
  --ap-ok: #6fcf97;
  --ap-ok-soft: #1d3326;
  --ap-warn: #f2c46d;
  --ap-warn-soft: #382f1c;
  --ap-shadow: none;
}

.ap-page.has-player {
  padding-bottom: 120px;
}

.ap-wrap {
  max-width: 1040px;
  margin: 0 auto;
}

/* Header */
.ap-header {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.ap-title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ap-title h1 {
  font-size: 1.75rem;
  font-weight: 650;
  margin: 0;
  letter-spacing: -0.01em;
}

.ap-subtitle {
  margin: 2px 0 0;
  color: var(--ap-muted);
  font-size: 0.9rem;
}

.ap-toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ap-search {
  flex: 1 1 280px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ap-surface);
  border: 1px solid var(--ap-border);
  border-radius: 10px;
  padding: 0 12px;
  margin: 0;
}

.ap-search:focus-within {
  border-color: var(--ap-accent);
  box-shadow: 0 0 0 3px var(--ap-accent-soft);
}

.ap-search i {
  color: var(--ap-muted);
}

.ap-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ap-text);
  height: 42px;
  font-size: 1rem;
}

.ap-selects {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.ap-select {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  background: var(--ap-surface);
  border: 1px solid var(--ap-border);
  border-radius: 10px;
  padding: 0 4px 0 12px;
  font-size: 0.85rem;
  color: var(--ap-muted);
}

.ap-select select {
  min-width: 0;
  text-overflow: ellipsis;
  border: 0;
  background: transparent;
  color: var(--ap-text);
  height: 42px;
  font-size: 0.95rem;
  max-width: 220px;
  outline: none;
}

.ap-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ap-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ap-border);
  background: var(--ap-surface);
  color: var(--ap-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.85rem;
  white-space: nowrap;
  cursor: pointer;
}

.ap-chip:hover {
  border-color: var(--ap-accent);
}

.ap-chip.active {
  background: var(--ap-accent);
  border-color: var(--ap-accent);
  color: var(--ap-accent-text);
}

.ap-chip-count {
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Buttons */
.ap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid var(--ap-border);
  background: var(--ap-surface);
  color: var(--ap-text);
  font-weight: 550;
  font-size: 0.95rem;
  cursor: pointer;
  white-space: nowrap;
}

.ap-btn:hover:not(:disabled) {
  border-color: var(--ap-accent);
}

.ap-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ap-btn-primary {
  background: var(--ap-accent);
  border-color: var(--ap-accent);
  color: var(--ap-accent-text);
}

.ap-btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.ap-btn-danger {
  background: var(--ap-danger);
  border-color: var(--ap-danger);
  color: #fff;
}

.ap-btn-sm {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.85rem;
}

.ap-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  border: 0;
  background: transparent;
  color: var(--ap-muted);
  cursor: pointer;
}

.ap-icon-btn:hover {
  background: var(--ap-surface-2);
  color: var(--ap-text);
}

/* Panels, fields, alerts */
.ap-panel {
  background: var(--ap-surface);
  border: 1px solid var(--ap-border);
  border-radius: var(--ap-radius);
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--ap-shadow);
}

.ap-upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.ap-upload-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}

.ap-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  min-width: 0;
}

.ap-field > span {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ap-muted);
}

.ap-field input,
.ap-field select {
  height: 42px;
  border: 1px solid var(--ap-border);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--ap-surface);
  color: var(--ap-text);
  font-size: 0.95rem;
  min-width: 0;
}

.ap-field input[type='file'] {
  padding: 8px;
  height: auto;
}

.ap-field input:focus,
.ap-field select:focus {
  outline: none;
  border-color: var(--ap-accent);
  box-shadow: 0 0 0 3px var(--ap-accent-soft);
}

.ap-muted {
  color: var(--ap-muted);
}

.ap-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-radius: 10px;
  padding: 8px 8px 8px 14px;
  margin: 12px 0 0;
  font-size: 0.9rem;
}

.ap-alert-info {
  background: var(--ap-accent-soft);
  color: var(--ap-text);
}

.ap-alert-error {
  background: var(--ap-danger-soft);
  color: var(--ap-danger);
}

.ap-page > .ap-wrap > .ap-alert {
  margin: 0 0 12px;
}

/* List */
.ap-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ap-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--ap-surface);
  border: 1px solid var(--ap-border);
  border-radius: var(--ap-radius);
  padding: 14px;
  box-shadow: var(--ap-shadow);
}

.ap-row.is-playing {
  border-color: var(--ap-accent);
  box-shadow: 0 0 0 1px var(--ap-accent);
}

.ap-play-btn {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0;
  background: var(--ap-accent-soft);
  color: var(--ap-accent);
  font-size: 1.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ap-play-btn:hover:not(:disabled),
.ap-row.is-playing .ap-play-btn {
  background: var(--ap-accent);
  color: var(--ap-accent-text);
}

.ap-play-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ap-row-main {
  flex: 1;
  min-width: 0;
}

.ap-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ap-row-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.ap-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--ap-muted);
}

.ap-owner {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.ap-excerpt {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: var(--ap-text);
  opacity: 0.85;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ap-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.ap-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--ap-surface-2);
  color: var(--ap-muted);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ap-tag-cat {
  background: var(--ap-accent-soft);
  color: var(--ap-accent);
  font-weight: 600;
}

.ap-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.ap-badge-ok {
  background: var(--ap-ok-soft);
  color: var(--ap-ok);
}

.ap-badge-warn {
  background: var(--ap-warn-soft);
  color: var(--ap-warn);
}

.ap-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ap-menu-wrap {
  position: relative;
}

.ap-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 1030;
  min-width: 200px;
  padding: 6px;
  background: var(--ap-surface);
  border: 1px solid var(--ap-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.16);
}

.ap-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ap-text);
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}

.ap-menu-item:hover,
.ap-menu-item:focus-visible {
  background: var(--ap-surface-2);
  outline: none;
}

.ap-menu-danger {
  color: var(--ap-danger);
}

.ap-menu-sep {
  margin: 6px 4px;
  border: 0;
  border-top: 1px solid var(--ap-border);
  opacity: 1;
}

.ap-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
  font-size: 0.9rem;
}

/* Edit form */
.ap-edit {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.ap-edit-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Empty, loading */
.ap-empty {
  text-align: center;
  padding: 56px 16px;
  background: var(--ap-surface);
  border: 1px dashed var(--ap-border);
  border-radius: var(--ap-radius);
}

.ap-empty h2 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 6px;
}

.ap-empty-icon {
  font-size: 2rem;
  color: var(--ap-muted);
  display: block;
  margin-bottom: 8px;
}

.ap-skeleton .ap-play-btn {
  background: var(--ap-surface-2);
}

.ap-skel-line {
  height: 12px;
  border-radius: 6px;
  background: var(--ap-surface-2);
  margin: 6px 0;
  animation: ap-pulse 1.4s ease-in-out infinite;
}

.ap-skel-line.w-60 {
  width: 60%;
}

.ap-skel-line.w-40 {
  width: 40%;
}

@keyframes ap-pulse {
  50% {
    opacity: 0.5;
  }
}

/* Docked player */
.ap-player {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1040;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background: var(--ap-surface);
  border-top: 1px solid var(--ap-border);
  box-shadow: 0 -4px 16px rgba(16, 24, 40, 0.08);
}

.ap-player-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 0 1 280px;
}

.ap-player-info strong {
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ap-player-error {
  color: var(--ap-danger);
}

.ap-player audio {
  flex: 1;
  min-width: 0;
  height: 40px;
}

/* Dialogs */
.ap-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  background: rgba(10, 12, 16, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.ap-modal {
  background: var(--ap-surface);
  color: var(--ap-text);
  border-radius: 14px;
  width: 100%;
  max-width: 680px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25);
}

.ap-modal-wide {
  max-width: 960px;
}

.ap-modal-narrow {
  max-width: 440px;
}

.ap-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 8px 20px;
}

.ap-modal-head h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}

.ap-modal-body {
  padding: 8px 20px;
  overflow-y: auto;
}

.ap-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}

.ap-transcript {
  margin-top: 12px;
}

.ap-transcript h3 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ap-muted);
  margin: 0 0 6px;
}

.ap-transcript p {
  white-space: pre-wrap;
  line-height: 1.6;
  margin: 0;
}

.ap-raw {
  background: #15181d;
  color: #d4d4d4;
  border-radius: 10px;
  padding: 14px;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* Phones */
@media (max-width: 640px) {
  .ap-page {
    padding: 16px 12px 40px;
  }

  .ap-title h1 {
    font-size: 1.4rem;
  }

  .ap-title-row .ap-btn span {
    display: none;
  }

  .ap-title-row .ap-btn {
    width: 42px;
    padding: 0;
  }

  .ap-selects,
  .ap-select {
    width: 100%;
  }

  .ap-select {
    min-width: 0;
  }

  .ap-select select {
    flex: 1;
    width: 100%;
    max-width: none;
  }

  /* Two lines of title instead of an early ellipsis on narrow screens */
  .ap-row-head {
    flex-wrap: wrap;
    gap: 4px 8px;
  }

  .ap-row-title {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* One scrolling row of chips instead of a tall wrapped block */
  .ap-chips {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 -12px;
    padding: 0 12px 4px;
    scrollbar-width: none;
  }

  .ap-chips::-webkit-scrollbar {
    display: none;
  }

  .ap-row {
    gap: 10px;
    padding: 12px;
  }

  .ap-hide-sm {
    display: none;
  }

  .ap-player {
    flex-wrap: wrap;
    gap: 6px 8px;
  }

  .ap-player-info {
    flex: 1 1 calc(100% - 56px);
  }

  .ap-player audio {
    flex: 1 1 100%;
    order: 3;
  }

  .ap-modal-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .ap-modal {
    border-radius: 16px 16px 0 0;
    max-height: 90vh;
  }
}
</style>
