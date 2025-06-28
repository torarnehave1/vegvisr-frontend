<template>
  <div class="gnew-linechart-node" :class="nodeTypeClass">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Chart Data">
        <i class="fas fa-edit"></i> Edit Chart
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- Chart Content -->
    <div class="chart-container">
      <h3 v-if="node.label" class="node-label">{{ node.label }}</h3>
      <div class="chart-wrapper">
        <LineChart :data="node.info" :xLabel="node.xLabel" :yLabel="node.yLabel" />
      </div>
      <div v-if="node.description" class="chart-description" v-html="node.description"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import LineChart from '@/components/LineChart.vue'

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
  return `gnew-node-type-linechart`
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this line chart?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-linechart-node {
  background: #ffffff;
  border: 2px solid #e8f5e8;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.1);
  transition: all 0.3s ease;
}

.gnew-linechart-node:hover {
  border-color: #28a745;
  box-shadow: 0 4px 16px rgba(40, 167, 69, 0.15);
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
  background: #f8fff8;
  border-radius: 8px;
  border: 1px solid #d4edda;
}

.chart-description {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fff8;
  border-radius: 8px;
  border-left: 4px solid #28a745;
  font-size: 0.95rem;
  line-height: 1.6;
}

.gnew-node-type-linechart {
  border-color: #28a745;
}

@media (max-width: 768px) {
  .gnew-linechart-node {
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
  }
}
</style>
