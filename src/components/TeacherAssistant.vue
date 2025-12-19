<template>
  <div class="teacher-assistant">
    <!-- Floating Trigger Button -->
    <Transition name="bounce">
      <button
        v-if="!teacherStore.isOpen"
        class="teacher-trigger"
        @click="teacherStore.open()"
        :title="t('teacher.openAssistant')"
      >
        <span class="teacher-icon">🎓</span>
        <span v-if="contextSuggestions.length" class="suggestion-badge">
          {{ contextSuggestions.length }}
        </span>
      </button>
    </Transition>

    <!-- Main Panel -->
    <Transition name="slide-up">
      <div v-if="teacherStore.isOpen" class="teacher-panel">
        <!-- Header -->
        <div class="teacher-header">
          <div class="header-title">
            <span class="header-icon">🎓</span>
            <h3>{{ t('teacher.title') }}</h3>
          </div>
          <div class="header-actions">
            <button
              class="voice-toggle"
              :class="{ active: teacherStore.settings.voiceEnabled }"
              @click="teacherStore.toggleVoice()"
              :title="t('teacher.toggleVoice')"
            >
              {{ teacherStore.settings.voiceEnabled ? '🔊' : '🔇' }}
            </button>
            <button class="close-btn" @click="teacherStore.close()">✕</button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="teacher-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ t(tab.labelKey) }}</span>
          </button>
        </div>

        <!-- Content Area -->
        <div class="teacher-content">
          <!-- Tutorials Tab -->
          <div v-if="activeTab === 'tutorials'" class="tab-content tutorials-tab">
            <!-- Active Tutorial View -->
            <div v-if="teacherStore.activeTutorial" class="active-tutorial">
              <TutorialPlayer
                @close="teacherStore.closeTutorial()"
              />
            </div>

            <!-- Tutorial List -->
            <div v-else class="tutorial-list">
              <!-- Context Suggestions -->
              <div v-if="contextSuggestions.length" class="suggestion-section">
                <h4>{{ t('teacher.suggested') }}</h4>
                <TutorialCard
                  v-for="tutorial in contextSuggestions"
                  :key="tutorial.id"
                  :tutorial="tutorial"
                  :highlighted="true"
                  @start="teacherStore.startTutorial(tutorial.id)"
                />
              </div>

              <!-- All Tutorials -->
              <div class="all-tutorials">
                <h4>{{ t('teacher.allTutorials') }}</h4>
                <div v-if="teacherStore.isLoading" class="loading-state">
                  <span class="spinner">⏳</span>
                  {{ t('teacher.loading') }}
                </div>
                <div v-else-if="tutorialsForView.length === 0" class="empty-state">
                  {{ t('teacher.noTutorials') }}
                </div>
                <TutorialCard
                  v-for="tutorial in tutorialsForView"
                  :key="tutorial.id"
                  :tutorial="tutorial"
                  @start="teacherStore.startTutorial(tutorial.id)"
                />
              </div>
            </div>
          </div>

          <!-- Guide Tab -->
          <div v-if="activeTab === 'guide'" class="tab-content guide-tab">
            <div class="search-box">
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('teacher.searchPlaceholder')"
                @input="handleSearch"
              />
              <span class="search-icon">🔍</span>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length" class="search-results">
              <div
                v-for="result in searchResults"
                :key="result.id"
                class="result-item"
                @click="showGuideSection(result)"
              >
                <h5>{{ result.title }}</h5>
                <p>{{ result.snippet }}</p>
              </div>
            </div>

            <!-- Guide Section Detail -->
            <div v-else-if="selectedSection" class="guide-detail">
              <button class="back-btn" @click="selectedSection = null">
                ← {{ t('teacher.back') }}
              </button>
              <h4>{{ selectedSection.title }}</h4>
              <div class="guide-content" v-html="formatMarkdown(selectedSection.content)"></div>
              <button
                v-if="teacherStore.settings.voiceEnabled"
                class="read-aloud-btn"
                :disabled="teacherStore.isPlaying"
                @click="readAloud(selectedSection.content)"
              >
                {{ teacherStore.isPlaying ? '⏹️ ' + t('teacher.stop') : '🔊 ' + t('teacher.readAloud') }}
              </button>
            </div>

            <!-- Default Guide Topics -->
            <div v-else class="guide-topics">
              <h4>{{ t('teacher.helpTopics') }}</h4>
              <div class="topic-grid">
                <button
                  v-for="topic in defaultTopics"
                  :key="topic.id"
                  class="topic-card"
                  @click="selectTopic(topic)"
                >
                  <span class="topic-icon">{{ topic.icon }}</span>
                  <span class="topic-title">{{ topic.title }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div v-if="activeTab === 'settings'" class="tab-content settings-tab">
            <div class="setting-group">
              <label>{{ t('teacher.language') }}</label>
              <div class="language-buttons">
                <button
                  v-for="lang in teacherStore.availableLanguages"
                  :key="lang.code"
                  class="lang-btn"
                  :class="{ active: teacherStore.settings.language === lang.code }"
                  @click="teacherStore.setLanguage(lang.code)"
                >
                  {{ lang.code === 'en' ? '🇬🇧' : '🇳🇴' }} {{ lang.name }}
                </button>
              </div>
            </div>

            <div class="setting-group">
              <label>{{ t('teacher.voice') }}</label>
              <div class="voice-selector">
                <button
                  v-for="voice in teacherStore.availableVoices"
                  :key="voice.id"
                  class="voice-btn"
                  :class="{ active: teacherStore.settings.voice === voice.id }"
                  @click="selectVoice(voice)"
                >
                  <span class="voice-name">{{ voice.name }}</span>
                  <span class="voice-gender">{{ voice.gender === 'female' ? '♀️' : '♂️' }}</span>
                </button>
              </div>
              <button
                v-if="teacherStore.settings.voice"
                class="preview-voice-btn"
                :disabled="teacherStore.isPlaying"
                @click="previewVoice"
              >
                {{ teacherStore.isPlaying ? '⏹️' : '▶️' }} {{ t('teacher.previewVoice') }}
              </button>
            </div>

            <div class="setting-group">
              <label class="toggle-setting">
                <input
                  type="checkbox"
                  v-model="teacherStore.settings.voiceEnabled"
                  @change="teacherStore.saveSettings()"
                />
                <span>{{ t('teacher.enableVoice') }}</span>
              </label>
            </div>

            <div class="setting-group">
              <label class="toggle-setting">
                <input
                  type="checkbox"
                  v-model="teacherStore.settings.autoSuggestions"
                  @change="teacherStore.saveSettings()"
                />
                <span>{{ t('teacher.autoSuggestions') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Tutorial Overlay (for spotlight/animations) -->
    <TutorialOverlay v-if="teacherStore.activeTutorial" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTeacherStore } from '../stores/teacherStore'
import TutorialCard from './teacher/TutorialCard.vue'
import TutorialPlayer from './teacher/TutorialPlayer.vue'
import TutorialOverlay from './teacher/TutorialOverlay.vue'

const props = defineProps({
  currentView: {
    type: String,
    default: 'GraphCanvas'
  }
})

const emit = defineEmits(['context-update'])

const teacherStore = useTeacherStore()

// Local state
const activeTab = ref('tutorials')
const searchQuery = ref('')
const selectedSection = ref(null)
const searchResults = ref([])

// Tabs configuration
const tabs = [
  { id: 'tutorials', icon: '📚', labelKey: 'teacher.tutorials' },
  { id: 'guide', icon: '📖', labelKey: 'teacher.guide' },
  { id: 'settings', icon: '⚙️', labelKey: 'teacher.settings' }
]

// Default help topics
const defaultTopics = computed(() => {
  if (props.currentView === 'GraphCanvas') {
    return [
      { id: 'nodes', icon: '⭕', title: t('teacher.topics.nodes') },
      { id: 'edges', icon: '↔️', title: t('teacher.topics.edges') },
      { id: 'styling', icon: '🎨', title: t('teacher.topics.styling') },
      { id: 'navigation', icon: '🧭', title: t('teacher.topics.navigation') },
      { id: 'export', icon: '📤', title: t('teacher.topics.export') },
      { id: 'keyboard', icon: '⌨️', title: t('teacher.topics.keyboard') }
    ]
  }
  return []
})

// Computed
const tutorialsForView = computed(() => teacherStore.tutorialsForCurrentView)
const contextSuggestions = computed(() => teacherStore.contextSuggestions)

// Translations
const translations = {
  en: {
    teacher: {
      title: 'Learning Assistant',
      openAssistant: 'Open Learning Assistant',
      toggleVoice: 'Toggle Voice',
      tutorials: 'Tutorials',
      guide: 'Guide',
      settings: 'Settings',
      suggested: '✨ Suggested for you',
      allTutorials: 'All Tutorials',
      loading: 'Loading...',
      noTutorials: 'No tutorials available for this view',
      searchPlaceholder: 'Search for help...',
      back: 'Back',
      helpTopics: 'Help Topics',
      language: 'Language',
      voice: 'Voice',
      previewVoice: 'Preview Voice',
      enableVoice: 'Enable Voice Narration',
      autoSuggestions: 'Show Smart Suggestions',
      readAloud: 'Read Aloud',
      stop: 'Stop',
      topics: {
        nodes: 'Creating Nodes',
        edges: 'Connecting Nodes',
        styling: 'Styling & Colors',
        navigation: 'Navigation',
        export: 'Export & Save',
        keyboard: 'Keyboard Shortcuts'
      }
    }
  },
  no: {
    teacher: {
      title: 'Læringsassistent',
      openAssistant: 'Åpne Læringsassistent',
      toggleVoice: 'Slå av/på stemme',
      tutorials: 'Veiledninger',
      guide: 'Guide',
      settings: 'Innstillinger',
      suggested: '✨ Foreslått for deg',
      allTutorials: 'Alle Veiledninger',
      loading: 'Laster...',
      noTutorials: 'Ingen veiledninger tilgjengelig for denne visningen',
      searchPlaceholder: 'Søk etter hjelp...',
      back: 'Tilbake',
      helpTopics: 'Hjelpetemaer',
      language: 'Språk',
      voice: 'Stemme',
      previewVoice: 'Forhåndsvis Stemme',
      enableVoice: 'Aktiver Talenarrasjon',
      autoSuggestions: 'Vis Smarte Forslag',
      readAloud: 'Les høyt',
      stop: 'Stopp',
      topics: {
        nodes: 'Opprette Noder',
        edges: 'Koble Noder',
        styling: 'Stil & Farger',
        navigation: 'Navigasjon',
        export: 'Eksporter & Lagre',
        keyboard: 'Hurtigtaster'
      }
    }
  }
}

function t(key) {
  const lang = teacherStore.settings.language || 'en'
  const keys = key.split('.')
  let value = translations[lang]
  for (const k of keys) {
    value = value?.[k]
  }
  return value || key
}

// Methods
let searchTimeout = null
function handleSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.length >= 2) {
      teacherStore.searchGuide(searchQuery.value).then(() => {
        searchResults.value = teacherStore.searchResults
      })
    } else {
      searchResults.value = []
    }
  }, 300)
}

function showGuideSection(result) {
  teacherStore.loadGuideSection(result.id).then(() => {
    selectedSection.value = teacherStore.selectedGuideSection
  })
}

function selectTopic(topic) {
  searchQuery.value = topic.title
  handleSearch()
}

function selectVoice(voice) {
  teacherStore.setVoice(voice.id)
}

function previewVoice() {
  if (teacherStore.isPlaying) {
    teacherStore.stopAudio()
  } else {
    const previewText = teacherStore.settings.language === 'no'
      ? 'Hei! Jeg er din læringsassistent. Jeg kan hjelpe deg med å lære å bruke denne applikasjonen.'
      : 'Hello! I am your learning assistant. I can help you learn how to use this application.'
    teacherStore.speak(previewText)
  }
}

function readAloud(content) {
  if (teacherStore.isPlaying) {
    teacherStore.stopAudio()
  } else {
    // Strip markdown for TTS
    const plainText = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, '. ')
    teacherStore.speak(plainText)
  }
}

function formatMarkdown(content) {
  if (!content) return ''
  // Simple markdown formatting
  return content
    .replace(/#{3}\s(.+)/g, '<h5>$1</h5>')
    .replace(/#{2}\s(.+)/g, '<h4>$1</h4>')
    .replace(/#{1}\s(.+)/g, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

// Watch for view changes
watch(() => props.currentView, (newView) => {
  teacherStore.setCurrentView(newView)
})

// Provide method for parent to update context
function updateContext(context) {
  teacherStore.updateSuggestions(context)
}

defineExpose({ updateContext })

// Initialize on mount
onMounted(async () => {
  teacherStore.setCurrentView(props.currentView)
  await teacherStore.initialize()
})
</script>

<style scoped>
.teacher-assistant {
  --teacher-primary: #6366f1;
  --teacher-secondary: #4f46e5;
  --teacher-bg: #ffffff;
  --teacher-surface: #f8fafc;
  --teacher-text: #1e293b;
  --teacher-text-dim: #64748b;
  --teacher-border: #e2e8f0;
  --teacher-success: #22c55e;
  --teacher-warning: #f59e0b;
}

/* Floating Trigger Button */
.teacher-trigger {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--teacher-primary), var(--teacher-secondary));
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 1000;
}

.teacher-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
}

.teacher-icon {
  font-size: 28px;
}

.suggestion-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: var(--teacher-warning);
  color: #000;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

/* Main Panel */
.teacher-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 380px;
  max-height: 600px;
  background: var(--teacher-bg);
  border: 1px solid var(--teacher-border);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1001;
}

/* Header */
.teacher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--teacher-surface);
  border-bottom: 1px solid var(--teacher-border);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 24px;
}

.header-title h3 {
  margin: 0;
  font-size: 16px;
  color: var(--teacher-text);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.voice-toggle, .close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--teacher-border);
  background: transparent;
  color: var(--teacher-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background 0.2s;
}

.voice-toggle:hover, .close-btn:hover {
  background: var(--teacher-border);
}

.voice-toggle.active {
  background: var(--teacher-primary);
  border-color: var(--teacher-primary);
}

/* Tabs */
.teacher-tabs {
  display: flex;
  border-bottom: 1px solid var(--teacher-border);
}

.tab-btn {
  flex: 1;
  padding: 12px 8px;
  border: none;
  background: transparent;
  color: var(--teacher-text-dim);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: color 0.2s, background 0.2s;
}

.tab-btn:hover {
  background: var(--teacher-surface);
}

.tab-btn.active {
  color: var(--teacher-primary);
  background: var(--teacher-surface);
  border-bottom: 2px solid var(--teacher-primary);
}

.tab-icon {
  font-size: 18px;
}

.tab-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Content Area */
.teacher-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

/* Tutorials Tab */
.tutorial-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggestion-section h4,
.all-tutorials h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--teacher-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 24px;
  color: var(--teacher-text-dim);
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

/* Guide Tab */
.search-box {
  position: relative;
  margin-bottom: 16px;
}

.search-box input {
  width: 100%;
  padding: 12px 16px 12px 40px;
  border: 1px solid var(--teacher-border);
  border-radius: 10px;
  background: var(--teacher-surface);
  color: var(--teacher-text);
  font-size: 14px;
}

.search-box input:focus {
  outline: none;
  border-color: var(--teacher-primary);
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  padding: 12px;
  background: var(--teacher-surface);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.result-item:hover {
  background: var(--teacher-border);
}

.result-item h5 {
  margin: 0 0 4px 0;
  color: var(--teacher-text);
  font-size: 14px;
}

.result-item p {
  margin: 0;
  color: var(--teacher-text-dim);
  font-size: 12px;
  line-height: 1.4;
}

.guide-detail {
  animation: fadeIn 0.2s ease;
}

.back-btn {
  padding: 8px 12px;
  margin-bottom: 12px;
  border: none;
  background: var(--teacher-surface);
  color: var(--teacher-text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.back-btn:hover {
  background: var(--teacher-border);
}

.guide-detail h4 {
  margin: 0 0 12px 0;
  color: var(--teacher-text);
}

.guide-content {
  color: var(--teacher-text-dim);
  font-size: 14px;
  line-height: 1.6;
}

.guide-content :deep(code) {
  background: var(--teacher-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.read-aloud-btn {
  margin-top: 16px;
  padding: 10px 16px;
  border: none;
  background: var(--teacher-primary);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  width: 100%;
}

.read-aloud-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.guide-topics h4 {
  margin: 0 0 16px 0;
  color: var(--teacher-text);
  font-size: 14px;
}

.topic-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.topic-card {
  padding: 16px 12px;
  border: 1px solid var(--teacher-border);
  border-radius: 10px;
  background: var(--teacher-surface);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: border-color 0.2s, transform 0.2s;
}

.topic-card:hover {
  border-color: var(--teacher-primary);
  transform: translateY(-2px);
}

.topic-icon {
  font-size: 24px;
}

.topic-title {
  font-size: 12px;
  color: var(--teacher-text);
  text-align: center;
}

/* Settings Tab */
.setting-group {
  margin-bottom: 20px;
}

.setting-group > label {
  display: block;
  margin-bottom: 10px;
  color: var(--teacher-text);
  font-size: 14px;
  font-weight: 500;
}

.language-buttons {
  display: flex;
  gap: 10px;
}

.lang-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--teacher-border);
  border-radius: 8px;
  background: var(--teacher-surface);
  color: var(--teacher-text);
  cursor: pointer;
  font-size: 14px;
  transition: border-color 0.2s, background 0.2s;
}

.lang-btn:hover {
  border-color: var(--teacher-primary);
}

.lang-btn.active {
  border-color: var(--teacher-primary);
  background: rgba(99, 102, 241, 0.2);
}

.voice-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.voice-btn {
  padding: 8px 12px;
  border: 1px solid var(--teacher-border);
  border-radius: 6px;
  background: var(--teacher-surface);
  color: var(--teacher-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.voice-btn:hover {
  border-color: var(--teacher-primary);
}

.voice-btn.active {
  border-color: var(--teacher-primary);
  background: rgba(99, 102, 241, 0.2);
}

.preview-voice-btn {
  padding: 10px 16px;
  border: none;
  background: var(--teacher-surface);
  color: var(--teacher-text);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  width: 100%;
}

.preview-voice-btn:hover {
  background: var(--teacher-border);
}

.toggle-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.toggle-setting input {
  width: 18px;
  height: 18px;
  accent-color: var(--teacher-primary);
}

.toggle-setting span {
  color: var(--teacher-text);
  font-size: 14px;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.bounce-enter-active {
  animation: bounce-in 0.3s;
}
.bounce-leave-active {
  animation: bounce-in 0.2s reverse;
}
@keyframes bounce-in {
  0% { transform: scale(0); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.slide-up-enter-active {
  animation: slide-up 0.3s ease;
}
.slide-up-leave-active {
  animation: slide-up 0.2s ease reverse;
}
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar */
.teacher-content::-webkit-scrollbar {
  width: 6px;
}

.teacher-content::-webkit-scrollbar-track {
  background: transparent;
}

.teacher-content::-webkit-scrollbar-thumb {
  background: var(--teacher-border);
  border-radius: 3px;
}

.teacher-content::-webkit-scrollbar-thumb:hover {
  background: var(--teacher-text-dim);
}
</style>
