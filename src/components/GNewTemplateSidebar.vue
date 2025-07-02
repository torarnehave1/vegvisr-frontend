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

    <!-- Templates Content -->
    <div v-if="!isCollapsed" class="sidebar-content">
      <!-- Search Results View -->
      <div v-if="searchQuery" class="search-results">
        <div
          v-for="template in filteredTemplates"
          :key="template.id"
          class="template-item"
          @click="addTemplate(template)"
          :title="template.description"
        >
          <span class="template-icon">{{ template.icon }}</span>
          <div class="template-info">
            <div class="template-label">{{ template.label }}</div>
            <div class="template-category-tag">{{ template.category }}</div>
            <div class="template-description">{{ template.description }}</div>
          </div>
          <span class="template-add-btn">+</span>
        </div>
      </div>

      <!-- Category View -->
      <div v-else class="categories-view">
        <div
          v-for="category in templateStore.categoryList"
          :key="category"
          class="category-section"
        >
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
              :title="template.description"
            >
              <span class="template-icon">{{ template.icon }}</span>
              <div class="template-info">
                <div class="template-label">{{ template.label }}</div>
                <div class="template-description">{{ template.description }}</div>
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
        :title="`${template.label} - ${template.description}`"
      >
        <span class="template-icon">{{ template.icon }}</span>
      </div>
    </div>

    <!-- Mobile Overlay -->
    <div v-if="isMobile && !isCollapsed" class="mobile-overlay" @click="closeMobileSidebar"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTemplateStore } from '@/stores/templateStore'

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
const templateStore = useTemplateStore()

// Reactive state
const isCollapsed = ref(false)
const isMobile = ref(false)
const searchQuery = ref('')
const expandedCategories = ref(['Content Nodes', 'Charts & Data']) // Default expanded categories

// Computed properties
const filteredTemplates = computed(() => {
  if (!searchQuery.value.trim()) return templateStore.nodeTemplates
  return templateStore.searchTemplates(searchQuery.value)
})

const popularTemplates = computed(() => {
  // Show most commonly used templates in collapsed view
  return [
    templateStore.getTemplateById('fulltext-basic'),
    templateStore.getTemplateById('title-basic'),
    templateStore.getTemplateById('chart-bar'),
    templateStore.getTemplateById('image-markdown'),
    templateStore.getTemplateById('button-row'),
    templateStore.getTemplateById('ai-test'),
    templateStore.getTemplateById('audio-transcription'),
  ].filter(Boolean)
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
  return templateStore.getTemplatesByCategory(category)
}

const getCategoryIcon = (category) => {
  const iconMap = {
    'Content Nodes': '📝',
    'Charts & Data': '📊',
    'Visual Elements': '🎨',
    Interactive: '⚡',
    Diagrams: '🌊', // For future Phase 3.4
  }
  return iconMap[category] || '📁'
}

const addTemplate = (template) => {
  if (!template) return

  console.log('=== Template Sidebar: Adding template ===')
  console.log('Template:', template.label, template.id)

  // Create node from template
  const newNode = templateStore.createNodeFromTemplate(template.id)
  if (!newNode) {
    console.error('Failed to create node from template:', template.id)
    return
  }

  // Emit event to parent (GNewViewer)
  emit('template-added', {
    template: template,
    node: newNode,
  })

  // Close mobile sidebar after adding
  if (isMobile.value) {
    closeMobileSidebar()
  }
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
