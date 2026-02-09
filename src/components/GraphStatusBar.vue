<template>
  <div class="graph-status-bar">
    <!-- First Row - Basic Info -->
    <div class="status-row">
      <div class="status-item">
        <span class="label">Current Graph:</span>
        <span class="value">{{ currentGraphId || 'None selected' }}</span>
      </div>
      <div class="status-item">
        <span class="label">Title:</span>
        <span class="value">{{ graphTitle || 'Untitled Graph' }}</span>
      </div>
      <div class="status-item">
        <span class="label">Nodes:</span>
        <span class="value">{{ nodeCount }}</span>
      </div>
      <div class="status-item">
        <span class="label">Status:</span>
        <span class="value" :class="statusClass">{{ statusText }}</span>
      </div>
      <div class="status-item" v-if="graphType">
        <span class="badge graph-type-badge" :class="graphTypeBadgeClass">
          {{ graphTypeLabel }}
        </span>
      </div>
      <div class="status-item version-dropdown-wrapper" v-if="graphVersion" ref="dropdownRef">
        <span class="label">Version:</span>
        <span
          class="value version-badge"
          :class="{ 'version-badge-clickable': versionHistory.length > 0 }"
          @click="toggleDropdown"
        >
          v{{ graphVersion }}
          <span v-if="versionHistory.length > 0" class="dropdown-arrow">&#9662;</span>
        </span>
        <div v-if="showDropdown && versionHistory.length > 0" class="version-dropdown">
          <div
            v-for="item in versionHistory"
            :key="item.version"
            class="version-dropdown-item"
            :class="{ 'version-current': item.version === graphVersion }"
            @click="selectVersion(item.version)"
          >
            <span class="version-dropdown-version">v{{ item.version }}</span>
            <span class="version-dropdown-time">{{ formatTimestamp(item.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Second Row - Metadata -->
    <div class="status-row" v-if="hasMetadata">
      <div class="status-item" v-if="graphCategories.length > 0">
        <span class="label">Categories:</span>
        <div class="badge-container">
          <span v-for="category in graphCategories" :key="category" class="badge bg-success">
            {{ category }}
          </span>
        </div>
      </div>
      <div class="status-item" v-if="graphMetaAreas.length > 0">
        <span class="label">Meta Areas:</span>
        <div class="badge-container">
          <span v-for="area in graphMetaAreas" :key="area" class="badge bg-warning">
            {{ area }}
          </span>
        </div>
      </div>
      <div class="status-item" v-if="graphCreatedBy">
        <span class="label">Created By:</span>
        <span class="value">{{ graphCreatedBy }}</span>
        <FollowButton
          v-if="userStore.loggedIn && graphCreatorId"
          :target-user-id="graphCreatorId"
          compact
          class="ms-2"
        />
      </div>
    </div>

    <!-- Third Row - Node Types -->
    <div class="status-row" v-if="nodeTypes.length > 0">
      <div class="status-item">
        <span class="label">Node Types:</span>
        <div class="badge-container">
          <span v-for="nodeType in nodeTypes" :key="nodeType" class="badge bg-info">
            {{ nodeType }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import FollowButton from './FollowButton.vue'

// Store management
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

// Props for additional data
const props = defineProps({
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  currentGraph: {
    type: Object,
    default: null,
  },
  versionHistory: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['version-selected'])

// Dropdown state
const showDropdown = ref(false)
const dropdownRef = ref(null)

const toggleDropdown = () => {
  if (props.versionHistory.length > 0) {
    showDropdown.value = !showDropdown.value
  }
}

const selectVersion = (version) => {
  showDropdown.value = false
  if (version !== graphVersion.value) {
    emit('version-selected', version)
  }
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Close dropdown on outside click
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Computed properties using store data
const currentGraphId = computed(() => {
  return knowledgeGraphStore.currentGraphId || props.currentGraph?.id
})

const graphTitle = computed(() => {
  return props.currentGraph?.title || knowledgeGraphStore.graphMetadata?.title || 'Untitled Graph'
})

const nodeCount = computed(() => {
  return props.graphData?.nodes?.length || 0
})

const graphVersion = computed(() => {
  return knowledgeGraphStore.currentVersion
})

const graphType = computed(() => {
  return props.currentGraph?.graphType || knowledgeGraphStore.graphMetadata?.graphType || null
})

const graphTypeLabel = computed(() => {
  const typeMap = {
    'html-template': 'HTML Template',
  }
  return typeMap[graphType.value] || graphType.value
})

const graphTypeBadgeClass = computed(() => {
  const classMap = {
    'html-template': 'graph-type-html-template',
  }
  return classMap[graphType.value] || 'graph-type-default'
})

const statusText = computed(() => {
  if (props.loading) return 'Loading...'
  if (props.error) return 'Error'
  if (currentGraphId.value) return 'Loaded'
  return 'Not Selected'
})

const statusClass = computed(() => {
  if (props.loading) return 'status-loading'
  if (props.error) return 'status-error'
  if (currentGraphId.value) return 'status-loaded'
  return 'status-none'
})

const graphCategories = computed(() => {
  const categories =
    props.currentGraph?.category || knowledgeGraphStore.graphMetadata?.category || ''
  return categories
    ? categories
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c)
    : []
})

const graphMetaAreas = computed(() => {
  const metaAreas =
    props.currentGraph?.metaArea || knowledgeGraphStore.graphMetadata?.metaArea || ''
  return metaAreas
    ? metaAreas
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a)
    : []
})

const graphCreatedBy = computed(() => {
  return (
    props.currentGraph?.createdBy ||
    knowledgeGraphStore.graphMetadata?.createdBy ||
    userStore.user?.email ||
    'Unknown'
  )
})

const graphCreatorId = computed(() => {
  const createdBy = props.currentGraph?.createdBy || knowledgeGraphStore.graphMetadata?.createdBy
  return createdBy && createdBy !== 'Unknown' ? createdBy : null
})

const hasMetadata = computed(() => {
  return (
    graphCategories.value.length > 0 ||
    graphMetaAreas.value.length > 0 ||
    graphCreatedBy.value !== 'Unknown'
  )
})

const nodeTypes = computed(() => {
  try {
    if (!props.graphData || !Array.isArray(props.graphData.nodes)) {
      return []
    }
    const types = new Set()
    props.graphData.nodes.forEach((node) => {
      if (node && typeof node === 'object' && node.type) {
        types.add(node.type)
      }
    })
    return Array.from(types).sort()
  } catch (error) {
    console.warn('Error computing nodeTypes:', error)
    return []
  }
})
</script>

<style scoped>
.graph-status-bar {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.status-row:last-child {
  margin-bottom: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.label {
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
  white-space: nowrap;
}

.value {
  font-size: 0.875rem;
  color: #212529;
  word-break: break-word;
}

.status-loading {
  color: #ffc107;
}

.status-error {
  color: #dc3545;
}

.status-loaded {
  color: #28a745;
}

.status-none {
  color: #6c757d;
}

.graph-type-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.graph-type-html-template {
  background-color: #e83e8c;
}

.graph-type-default {
  background-color: #6c757d;
}

.version-badge {
  background-color: #6f42c1;
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.version-badge-clickable {
  cursor: pointer;
  user-select: none;
}

.version-badge-clickable:hover {
  background-color: #5a32a3;
}

.dropdown-arrow {
  font-size: 0.6rem;
  margin-left: 0.2rem;
}

.version-dropdown-wrapper {
  position: relative;
}

.version-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  overflow: hidden;
}

.version-dropdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  gap: 1rem;
}

.version-dropdown-item:hover {
  background-color: #f0f0f0;
}

.version-current {
  background-color: #e8e0f3;
  font-weight: 600;
}

.version-dropdown-version {
  font-weight: 600;
  color: #6f42c1;
}

.version-dropdown-time {
  color: #6c757d;
  font-size: 0.7rem;
  white-space: nowrap;
}

.badge-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.bg-success {
  background-color: #28a745;
  color: white;
}

.bg-warning {
  background-color: #ffc107;
  color: #212529;
}

.bg-info {
  background-color: #17a2b8;
  color: white;
}

/* Follow button styling */
.ms-2 {
  margin-left: 0.5rem !important;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .status-row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .badge-container {
    margin-top: 0.25rem;
  }
}
</style>
