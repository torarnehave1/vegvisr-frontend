<template>
  <div class="gnew-bubblechart-node" :class="nodeTypeClass">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button
        @click="editNode"
        class="btn btn-sm btn-outline-primary"
        title="Edit Bubble Chart Data"
      >
        <i class="fas fa-edit"></i> Edit Data
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- Chart Content -->
    <div class="chart-container">
      <h3 v-if="node.label" class="node-label">💭 {{ node.label }}</h3>
      <div class="chart-wrapper">
        <BubbleChart :data="node.info" />
      </div>
      <div v-if="node.description" class="chart-description" v-html="node.description"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BubbleChart from '@/components/BubbleChart.vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Computed
const nodeTypeClass = computed(() => {
  return `gnew-node-type-bubblechart`
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this bubble chart?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-bubblechart-node {
  background: #ffffff;
  border: 2px solid #f0f8ff;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1);
  transition: all 0.3s ease;
}

.gnew-bubblechart-node:hover {
  border-color: #4a90e2;
  box-shadow: 0 4px 16px rgba(74, 144, 226, 0.15);
}

.node-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.node-controls .btn {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.chart-container {
  width: 100%;
}

.node-label {
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  text-align: center;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.chart-wrapper {
  margin: 1rem 0;
  padding: 1.5rem;
  background: #f8fbff;
  border-radius: 8px;
  border: 1px solid #e6f3ff;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.chart-description {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fbff;
  border-radius: 8px;
  border-left: 4px solid #4a90e2;
  font-size: 0.95rem;
  line-height: 1.6;
}

.gnew-node-type-bubblechart {
  border-color: #4a90e2;
}

@media (max-width: 768px) {
  .gnew-bubblechart-node {
    padding: 1rem;
    margin: 0.75rem 0;
  }

  .node-label {
    font-size: 1.25rem;
  }

  .node-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .chart-wrapper {
    padding: 1rem;
    min-height: 250px;
  }
}
</style>
