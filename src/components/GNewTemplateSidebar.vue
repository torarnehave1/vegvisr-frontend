<template>
  <div
    class="gnew-template-sidebar"
    :class="{ 'sidebar-collapsed': isCollapsed, 'sidebar-mobile': isMobile }"
  >
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="sidebar-icon">🧩</span>
        <span v-if="!isCollapsed" class="sidebar-text">Templates</span>
      </div>
      <button
        @click="toggleSidebar"
        class="sidebar-toggle"
        :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <span v-if="isCollapsed">▶</span>
        <span v-else>◀</span>
      </button>
    </div>

    <!-- Search Section -->
    <div v-if="!isCollapsed" class="sidebar-search">
      <div class="search-input-container">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search templates..."
          class="search-input"
        />
        <span class="search-icon">🔍</span>
      </div>
      <div v-if="searchQuery" class="search-results-info">
        {{ filteredTemplates.length }} result{{ filteredTemplates.length !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="!isCollapsed && isLoading" class="sidebar-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading templates...</div>
    </div>

    <!-- Error State -->
    <div v-if="!isCollapsed && error" class="sidebar-error">
      <div class="error-message">{{ error }}</div>
      <button @click="fetchTemplates" class="retry-button">Retry</button>
    </div>

    <!-- Templates Content -->
    <div v-if="!isCollapsed && !isLoading && !error" class="sidebar-content">
      <!-- Search Results View -->
      <div v-if="searchQuery" class="search-results">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-item"
          @click="addTemplate(template)"
          :title="getTemplateDescription(template)"
        >
          <span class="template-icon">{{ getTemplateIcon(template) }}</span>
          <div class="template-info">
            <div class="template-label">{{ template.name }}</div>
            <div class="template-category-tag">{{ template.category || 'General' }}</div>
            <div class="template-description">{{ getTemplateDescription(template) }}</div>
          </div>
          <span class="template-add-btn">+</span>
        </div>
      </div>

      <!-- Category View -->
      <div v-else class="categories-view">
        <div v-for="category in categories" :key="category" class="category-section">
          <div class="category-header" @click="toggleCategory(category)">
            <span class="category-icon">{{ getCategoryIcon(category) }}</span>
            <span class="category-name">{{ category }}</span>
            <span class="category-toggle">
              {{ expandedCategories.includes(category) ? '▼' : '▶' }}
            </span>
            <span class="category-count">{{ getTemplatesByCategory(category).length }}</span>
          </div>

          <div v-if="expandedCategories.includes(category)" class="category-templates">
            <div
              v-for="template in getTemplatesByCategory(category)"
              :key="template.id"
              class="template-item"
              @click="addTemplate(template)"
              :title="getTemplateDescription(template)"
            >
              <span class="template-icon">{{ getTemplateIcon(template) }}</span>
              <div class="template-info">
                <div class="template-label">{{ template.name }}</div>
                <div class="template-description">{{ getTemplateDescription(template) }}</div>
              </div>
              <span class="template-add-btn">+</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Collapsed View - Quick Icons -->
    <div v-if="isCollapsed" class="sidebar-collapsed-content">
      <div
        v-for="template in popularTemplates"
        :key="template.id"
        class="collapsed-template-item"
        @click="addTemplate(template)"
        :title="`${template.name} - ${getTemplateDescription(template)}`"
      >
        <span class="template-icon">{{ getTemplateIcon(template) }}</span>
      </div>
    </div>

    <!-- Mobile Overlay -->
    <div v-if="isMobile && !isCollapsed" class="mobile-overlay" @click="closeMobileSidebar"></div>
  </div>

  <!-- Audio Recording Selector Modal -->
  <AudioRecordingSelector
    :isVisible="showAudioModal"
    :transcriptionType="selectedTranscriptionType"
    @close="closeAudioModal"
    @node-created="handleAudioNodeCreated"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import AudioRecordingSelector from './AudioRecordingSelector.vue'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['template-added', 'sidebar-toggled'])

// Store
const userStore = useUserStore()

// Reactive state
const isCollapsed = ref(false)
const isMobile = ref(false)
const searchQuery = ref('')
const expandedCategories = ref([]) // Start with all categories collapsed

// Database template state
const databaseTemplates = ref([])
const isLoading = ref(false)
const error = ref(null)

// Audio modal state
const showAudioModal = ref(false)
const selectedTranscriptionType = ref('')

// Fetch templates from database
const fetchTemplates = async () => {
  isLoading.value = true
  error.value = null

  try {
    console.log('Fetching templates from database...')
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()
    console.log('Fetched templates:', data)

    if (data.results && Array.isArray(data.results)) {
      databaseTemplates.value = data.results.map((template) => ({
        id: template.id,
        name: template.name,
        nodes: JSON.parse(template.nodes || '[]'),
        edges: JSON.parse(template.edges || '[]'),
        category: template.category || 'General',
        type: template.type || 'general',
      }))
      console.log('Processed templates:', databaseTemplates.value.length)
    } else {
      throw new Error('Invalid response format: missing results array')
    }
  } catch (err) {
    console.error('Error fetching templates:', err)
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

// Computed properties
const filteredTemplates = computed(() => {
  if (!searchQuery.value.trim()) return databaseTemplates.value
  return databaseTemplates.value.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

const categories = computed(() => {
  const categorySet = new Set()
  databaseTemplates.value.forEach((template) => {
    categorySet.add(template.category || 'General')
  })
  return Array.from(categorySet).sort()
})

const popularTemplates = computed(() => {
  // Show first 8 templates in collapsed view
  return databaseTemplates.value.slice(0, 8)
})

// Methods
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  emit('sidebar-toggled', { collapsed: isCollapsed.value })
}

const closeMobileSidebar = () => {
  if (isMobile.value) {
    isCollapsed.value = true
    emit('sidebar-toggled', { collapsed: true })
  }
}

const toggleCategory = (category) => {
  const index = expandedCategories.value.indexOf(category)
  if (index > -1) {
    expandedCategories.value.splice(index, 1)
  } else {
    expandedCategories.value.push(category)
  }
}

const getTemplatesByCategory = (category) => {
  return databaseTemplates.value.filter((template) => (template.category || 'General') === category)
}

const getCategoryIcon = (category) => {
  const iconMap = {
    General: '📝',
    'Content Nodes': '📝',
    'Charts & Data': '📊',
    'Visual Elements': '🎨',
    Interactive: '⚡',
    Diagrams: '🌊',
    'Project Management': '📋',
  }
  return iconMap[category] || '📁'
}

const getTemplateIcon = (template) => {
  // Map template types to icons
  const iconMap = {
    youtube: '🎬',
    image: '🖼️',
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
  return iconMap[template.type] || '🧩'
}

const getTemplateDescription = (template) => {
  if (!template.nodes || !template.nodes[0]) return 'Template'

  const node = template.nodes[0]
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
  return descriptions[template.type] || node.type || 'Custom template'
}

const addTemplate = (template) => {
  if (!template) return

  console.log('=== Template Sidebar: Adding database template ===')
  console.log('Template:', template.name, template.id)
  console.log('Template nodes:', template.nodes)

  // Handle audio templates by opening modal (if needed)
  if (template.isAudioTemplate) {
    selectedTranscriptionType.value = template.transcriptionType
    showAudioModal.value = true

    // Close mobile sidebar after opening modal
    if (isMobile.value) {
      closeMobileSidebar()
    }
    return
  }

  // Generate UUID for new node
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c == 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Create node data from database template
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

  console.log('Created node data:', nodeData)

  // Emit the template with properly formed node data
  emit('template-added', {
    template: template,
    node: nodeData,
  })

  // Close mobile sidebar after adding
  if (isMobile.value) {
    closeMobileSidebar()
  }
}

const closeAudioModal = () => {
  showAudioModal.value = false
  selectedTranscriptionType.value = ''
}

const handleAudioNodeCreated = (node) => {
  // Create appropriate template info based on transcription type
  const templateInfo = {
    id: `audio-${selectedTranscriptionType.value}-transcription`,
    name: `${selectedTranscriptionType.value === 'enhanced' ? 'Enhanced' : selectedTranscriptionType.value === 'raw' ? 'Raw' : 'Both'} Audio Transcription`,
    type: 'audio-transcription',
    nodes: [node],
    edges: [],
  }

  emit('template-added', {
    template: templateInfo,
    node: node,
  })
  closeAudioModal()
}

// Responsive handling
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isCollapsed.value = true
  }
}

const handleResize = () => {
  checkMobile()
}

// Lifecycle
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize)
  fetchTemplates() // Fetch templates from database on mount
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.gnew-template-sidebar {
  position: fixed;
  top: 0px; /* Align with GNewViewer content area */
  left: 0; /* At actual screen edge */
  height: calc(100vh - 60px); /* Adjusted for new positioning */
  min-height: 500px;
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.3s ease;
  width: 280px;
  display: flex;
  flex-direction: column;
  border-radius: 0 8px 8px 0; /* Subtle rounded corners on right */
}

.sidebar-collapsed {
  width: 60px;
}

.sidebar-mobile {
  z-index: 2000; /* Higher z-index for mobile overlay */
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  min-height: 60px;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  color: #333;
}

.sidebar-icon {
  font-size: 1.2rem;
}

.sidebar-text {
  font-size: 1rem;
}

.sidebar-toggle {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  color: #666;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: #e9ecef;
  color: #333;
}

/* Search */
.sidebar-search {
  padding: 15px;
  border-bottom: 1px solid #e0e0e0;
}

.search-input-container {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 35px 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  border-color: #007bff;
}

.search-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  font-size: 14px;
}

.search-results-info {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

/* Loading State */
.sidebar-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #666;
  font-size: 1rem;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-weight: 500;
}

/* Error State */
.sidebar-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #dc3545;
  font-size: 1rem;
  text-align: center;
}

.error-message {
  margin-bottom: 15px;
  font-weight: 500;
}

.retry-button {
  background-color: #007bff;
  color: white;
  padding: 8px 15px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.2s ease;
}

.retry-button:hover {
  background-color: #0056b3;
}

/* Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

/* Categories */
.category-section {
  margin-bottom: 10px;
}

.category-header {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  transition: background-color 0.2s ease;
}

.category-header:hover {
  background: #e9ecef;
}

.category-icon {
  margin-right: 8px;
  font-size: 1rem;
}

.category-name {
  flex: 1;
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.category-toggle {
  margin-right: 8px;
  color: #666;
  font-size: 0.8rem;
}

.category-count {
  background: #007bff;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 0.7rem;
  font-weight: 600;
}

/* Templates */
.category-templates {
  background: #ffffff;
}

.template-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.2s ease;
}

.template-item:hover {
  background: #f8f9fa;
  transform: translateX(2px);
}

.template-icon {
  margin-right: 10px;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-label {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.template-description {
  font-size: 0.75rem;
  color: #666;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-category-tag {
  font-size: 0.7rem;
  color: #007bff;
  font-weight: 500;
  margin-bottom: 2px;
}

.template-add-btn {
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.template-item:hover .template-add-btn {
  background: #0056b3;
  transform: scale(1.1);
}

/* Collapsed View */
.sidebar-collapsed-content {
  padding: 15px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.collapsed-template-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
}

.collapsed-template-item:hover {
  background: #007bff;
  transform: scale(1.1);
}

.collapsed-template-item:hover .template-icon {
  filter: grayscale(1) brightness(10);
}

.collapsed-template-item .template-icon {
  font-size: 1.2rem;
}

/* Search Results */
.search-results {
  padding: 0;
}

/* Mobile Overlay */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1999;
}

/* Mobile Responsive */
@media (max-width: 767px) {
  .gnew-template-sidebar {
    width: 100%;
    max-width: 320px;
    height: calc(100vh - 160px); /* Consistent with desktop */
    top: 0px; /* Align with desktop positioning */
  }

  .sidebar-collapsed {
    width: 60px;
  }

  .sidebar-mobile {
    /* Already fixed positioned like desktop */
    border-radius: 0; /* No border radius on mobile */
  }
}

/* Scrollbar Styling */
.sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
