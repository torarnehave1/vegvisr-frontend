<template>
  <div class="gnew-swot-node" :class="nodeTypeClass">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit SWOT Analysis">
        <i class="fas fa-edit"></i> Edit SWOT
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- SWOT Content -->
    <div class="swot-container">
      <h3 v-if="node.label" class="node-label">📋 {{ node.label }}</h3>
      <div class="swot-wrapper">
        <SWOTDiagram :data="node.info" />
      </div>
      <div v-if="node.description" class="swot-description" v-html="node.description"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SWOTDiagram from '@/components/SWOTDiagram.vue'

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
  return `gnew-node-type-swot`
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this SWOT analysis?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-swot-node {
  background: #ffffff;
  border: 2px solid #f0f9ff;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
  transition: all 0.3s ease;
}

.gnew-swot-node:hover {
  border-color: #0ea5e9;
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.15);
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

.swot-container {
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

.swot-wrapper {
  margin: 1rem 0;
  padding: 1.5rem;
  background: #f8fcff;
  border-radius: 8px;
  border: 1px solid #e0f2fe;
  overflow-x: auto;
}

.swot-description {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fcff;
  border-radius: 8px;
  border-left: 4px solid #0ea5e9;
  font-size: 0.95rem;
  line-height: 1.6;
}

.gnew-node-type-swot {
  border-color: #0ea5e9;
}

/* Special SWOT styling */
.gnew-swot-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #22c55e 25%, #f59e0b 25% 50%, #ef4444 50% 75%, #3b82f6 75%);
  border-radius: 12px 12px 0 0;
}

.gnew-swot-node {
  position: relative;
}

@media (max-width: 768px) {
  .gnew-swot-node {
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

  .swot-wrapper {
    padding: 1rem;
  }
}
</style>
