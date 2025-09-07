<template>
  <div class="gnew-mermaid-node">
    <!-- Node Title -->
    <h3 v-if="node.label" class="node-label">{{ node.label }}</h3>

    <!-- Mermaid Diagram -->
    <div class="mermaid-wrapper">
      <Mermaid :code="node.info" />
    </div>

    <!-- Optional Bibliography -->
    <div v-if="node.bibl && node.bibl.length > 0" class="node-bibliography">
      <h6>📚 References:</h6>
      <ul class="bibliography-list">
        <li v-for="(ref, index) in node.bibl" :key="index" class="bibliography-item">
          {{ ref }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import Mermaid from '@/components/Mermaid.vue'

// Component name for debugging
defineOptions({
  name: 'GNewMermaidNode',
})

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  graphId: {
    type: String,
    default: '',
  },
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])
</script>

<style scoped>
.gnew-mermaid-node {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-label {
  color: #333;
  margin-bottom: 1rem;
  font-weight: 600;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.mermaid-wrapper {
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.node-bibliography {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.node-bibliography h6 {
  margin-bottom: 0.75rem;
  color: #495057;
  font-weight: 600;
}

.bibliography-list {
  margin: 0;
  padding-left: 1rem;
  list-style-type: decimal;
}

.bibliography-item {
  margin-bottom: 0.5rem;
  color: #6c757d;
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .gnew-mermaid-node {
    background: #2d3748;
    color: #e2e8f0;
  }

  .node-label {
    color: #e2e8f0;
    border-bottom-color: #4a5568;
  }

  .mermaid-wrapper,
  .node-bibliography {
    background: #4a5568;
    border-color: #718096;
  }

  .node-bibliography {
    border-left-color: #63b3ed;
  }

  .bibliography-item {
    color: #a0aec0;
  }
}
</style>
