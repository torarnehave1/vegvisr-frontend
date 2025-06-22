<template>
  <div class="node-control-bar">
    <!-- Edit Actions Group -->
    <div class="control-group edit-group">
      <button
        @click="$emit('edit-label')"
        class="control-btn edit-btn"
        title="Edit Label"
        :aria-label="`Edit label for ${nodeType} node`"
      >
        <span class="icon">✏️</span>
        <span class="btn-text">Label</span>
      </button>
      <button
        @click="$emit('edit-info')"
        class="control-btn edit-btn"
        title="Edit Content"
        :aria-label="`Edit content for ${nodeType} node`"
      >
        <span class="icon">📝</span>
        <span class="btn-text">{{ getEditButtonText }}</span>
      </button>
    </div>

    <!-- Template Formatting Group -->
    <div class="control-group template-group">
      <button
        @click="$emit('format-node')"
        class="control-btn template-btn"
        title="Apply Style Template"
        :aria-label="`Apply formatting template to ${nodeType} node`"
      >
        <span class="icon">✨</span>
        <span class="btn-text">Format</span>
      </button>
      <button
        @click="$emit('quick-format', 'add_side_images')"
        class="control-btn quick-btn"
        title="Add Side Images"
        :aria-label="`Add side images to ${nodeType} node`"
      >
        <span class="icon">🖼️</span>
      </button>
      <button
        @click="$emit('quick-format', 'add_work_notes')"
        class="control-btn quick-btn"
        title="Add Work Notes"
        :aria-label="`Add work notes to ${nodeType} node`"
      >
        <span class="icon">📝</span>
      </button>
    </div>

    <!-- AI Action Group (only for action_test nodes) -->
    <div v-if="nodeType === 'action_test'" class="control-group ai-group">
      <button
        @click="$emit('get-ai-response')"
        class="control-btn ai-btn"
        title="Get Response from AI"
        :aria-label="`Get AI response for ${nodeType} node`"
      >
        <span class="icon">🤖</span>
        <span class="btn-text">AI Response</span>
      </button>
    </div>

    <!-- Copy/Move Actions Group -->
    <div class="control-group action-group">
      <button
        @click="$emit('copy-node')"
        class="control-btn copy-btn"
        title="Copy to Another Graph"
        :aria-label="`Copy ${nodeType} node to another graph`"
      >
        <span class="icon">📋</span>
        <span class="btn-text">Copy</span>
      </button>

      <div class="reorder-mini">
        <button
          @click="$emit('move-up')"
          :disabled="isFirst"
          class="control-btn reorder-btn"
          title="Move Up"
          :aria-label="`Move ${nodeType} node up`"
        >
          <span class="icon">⬆️</span>
        </button>
        <span class="position-mini" :title="`Position ${position} of ${total}`">
          {{ position }}/{{ total }}
        </span>
        <button
          @click="$emit('move-down')"
          :disabled="isLast"
          class="control-btn reorder-btn"
          title="Move Down"
          :aria-label="`Move ${nodeType} node down`"
        >
          <span class="icon">⬇️</span>
        </button>
      </div>

      <button
        @click="$emit('open-reorder')"
        class="control-btn reorder-btn"
        title="Reorder All Nodes"
        aria-label="Open reorder modal for all nodes"
      >
        <span class="icon">📋</span>
        <span class="btn-text">Order</span>
      </button>
    </div>

    <!-- Delete Action Group -->
    <div class="control-group delete-group">
      <button
        @click="$emit('delete-node')"
        class="control-btn delete-btn"
        title="Delete Node"
        :aria-label="`Delete ${nodeType} node`"
      >
        <span class="icon">🗑️</span>
        <span class="btn-text">Delete</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  nodeType: {
    type: String,
    default: 'node',
  },
  position: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  isFirst: {
    type: Boolean,
    default: false,
  },
  isLast: {
    type: Boolean,
    default: false,
  },
  nodeContent: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'edit-label',
  'edit-info',
  'format-node',
  'quick-format',
  'copy-node',
  'delete-node',
  'move-up',
  'move-down',
  'open-reorder',
  'get-ai-response',
])

const getEditButtonText = computed(() => {
  switch (props.nodeType) {
    case 'title':
      return 'Title'
    case 'linechart':
      return 'Chart'
    case 'chart':
    case 'piechart':
    case 'timeline':
    case 'swot':
    case 'bubblechart':
      return 'Data'
    case 'markdown-image':
      return 'Markdown'
    default:
      return 'Info'
  }
})
</script>

<style scoped>
.node-control-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: linear-gradient(145deg, #ffffff, #f8f9fa);
  border: 1px solid #e9ecef;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  border-radius: 6px;
}

.edit-group {
  background-color: rgba(13, 110, 253, 0.05);
  border-left: 3px solid #0d6efd;
}

.template-group {
  background-color: rgba(111, 66, 193, 0.05);
  border-left: 3px solid #6f42c1;
}

.action-group {
  background-color: rgba(25, 135, 84, 0.05);
  border-left: 3px solid #198754;
}

.ai-group {
  background-color: rgba(255, 149, 0, 0.05);
  border-left: 3px solid #ff9500;
}

.sandbox-group {
  background-color: rgba(25, 118, 210, 0.05);
  border-left: 3px solid #1976d2;
}

.delete-group {
  background-color: rgba(220, 53, 69, 0.05);
  border-left: 3px solid #dc3545;
  margin-left: auto;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: transparent;
  color: #495057;
  min-height: 32px;
}

.control-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.control-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.edit-btn {
  background-color: #e7f1ff;
  color: #0d6efd;
  border: 1px solid rgba(13, 110, 253, 0.2);
}

.edit-btn:hover:not(:disabled) {
  background-color: #0d6efd;
  color: white;
}

.template-btn {
  background-color: #f3e8ff;
  color: #6f42c1;
  border: 1px solid rgba(111, 66, 193, 0.2);
}

.template-btn:hover:not(:disabled) {
  background-color: #6f42c1;
  color: white;
}

.quick-btn {
  background-color: #f3e8ff;
  color: #6f42c1;
  border: 1px solid rgba(111, 66, 193, 0.2);
  min-width: 32px;
  justify-content: center;
}

.quick-btn:hover:not(:disabled) {
  background-color: #6f42c1;
  color: white;
}

.copy-btn {
  background-color: #d1e7dd;
  color: #198754;
  border: 1px solid rgba(25, 135, 84, 0.2);
}

.copy-btn:hover:not(:disabled) {
  background-color: #198754;
  color: white;
}

.reorder-btn {
  background-color: #fff3cd;
  color: #664d03;
  border: 1px solid rgba(255, 193, 7, 0.2);
  min-width: 32px;
  justify-content: center;
}

.reorder-btn:hover:not(:disabled) {
  background-color: #ffc107;
  color: #000;
}

.ai-btn {
  background-color: #fff3e0;
  color: #ff9500;
  border: 1px solid rgba(255, 149, 0, 0.2);
}

.ai-btn:hover:not(:disabled) {
  background-color: #ff9500;
  color: white;
}

.sandbox-btn {
  background-color: #e3f2fd;
  color: #1976d2;
  border: 1px solid rgba(25, 118, 210, 0.2);
}

.sandbox-btn:hover:not(:disabled) {
  background-color: #1976d2;
  color: white;
}

.delete-btn {
  background-color: #f8d7da;
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.2);
}

.delete-btn:hover:not(:disabled) {
  background-color: #dc3545;
  color: white;
}

.icon {
  font-size: 14px;
  line-height: 1;
}

.btn-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.reorder-mini {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background-color: rgba(255, 193, 7, 0.1);
  border-radius: 6px;
  border: 1px solid rgba(255, 193, 7, 0.2);
}

.position-mini {
  font-size: 10px;
  font-weight: 600;
  color: #664d03;
  min-width: 28px;
  text-align: center;
  padding: 2px 4px;
  background-color: rgba(255, 193, 7, 0.2);
  border-radius: 3px;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .node-control-bar {
    gap: 8px;
    padding: 6px 8px;
  }

  .control-group {
    gap: 4px;
    padding: 0 4px;
  }

  .control-btn {
    padding: 4px 6px;
    font-size: 11px;
    min-height: 28px;
  }

  .btn-text {
    display: none;
  }

  .icon {
    font-size: 12px;
  }

  .reorder-mini {
    gap: 2px;
    padding: 2px;
  }

  .position-mini {
    font-size: 9px;
    min-width: 24px;
  }
}

/* Focus styles for accessibility */
.control-btn:focus {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

.control-btn:focus:not(:focus-visible) {
  outline: none;
}
</style>
