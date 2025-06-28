<template>
  <div class="gnew-timeline-node" :class="nodeTypeClass">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Timeline Data">
        <i class="fas fa-edit"></i> Edit Timeline
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- Timeline Content -->
    <div class="timeline-container">
      <h3 v-if="node.label" class="node-label">{{ node.label }}</h3>
      <div class="timeline-wrapper">
        <TimelineChart :data="node.info" />
      </div>
      <div v-if="node.description" class="timeline-description" v-html="node.description"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TimelineChart from '@/components/TimelineChart.vue'

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
  return `gnew-node-type-timeline`
})

// Methods
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this timeline?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-timeline-node {
  background: #ffffff;
  border: 2px solid #fff4e6;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(253, 126, 20, 0.1);
  transition: all 0.3s ease;
}

.gnew-timeline-node:hover {
  border-color: #fd7e14;
  box-shadow: 0 4px 16px rgba(253, 126, 20, 0.15);
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

.timeline-container {
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
  position: relative;
}

.node-label::before {
  content: '⏰';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.2rem;
}

.timeline-wrapper {
  margin: 1rem 0;
  padding: 1.5rem;
  background: #fffaf0;
  border-radius: 8px;
  border: 1px solid #ffe4b5;
  overflow-x: auto;
}

.timeline-description {
  margin-top: 1rem;
  padding: 1rem;
  background: #fffaf0;
  border-radius: 8px;
  border-left: 4px solid #fd7e14;
  font-size: 0.95rem;
  line-height: 1.6;
}

.gnew-node-type-timeline {
  border-color: #fd7e14;
}

@media (max-width: 768px) {
  .gnew-timeline-node {
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

  .timeline-wrapper {
    padding: 1rem;
  }
}
</style>
