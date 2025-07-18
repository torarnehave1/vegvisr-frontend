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
import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

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
