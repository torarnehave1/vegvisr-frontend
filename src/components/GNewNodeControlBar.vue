<template>
  <div class="gnew-node-control-bar">
    <!-- Control Bar Header with Toggle -->
    <div class="control-bar-header">
      <!-- Toggle Button for Node Content -->
      <button
        @click="$emit('toggle-content')"
        class="control-btn toggle-btn"
        :title="isCollapsed ? 'Expand Node Content' : 'Collapse Node Content'"
        :aria-label="isCollapsed ? 'Expand node content' : 'Collapse node content'"
      >
        <span class="icon">{{ isCollapsed ? '🔽' : '🔼' }}</span>
        <span class="btn-text">{{ isCollapsed ? 'Show' : 'Hide' }}</span>
      </button>

      <!-- Node Type and Position Info -->
      <div class="node-info">
        <span class="node-type-badge">{{ nodeType }}</span>
        <span class="position-info">{{ position }}/{{ total }}</span>
      </div>
    </div>

    <!-- Always Visible: Full Control Groups -->
    <div class="control-groups-container">
      <!-- Reordering Actions Group -->
      <div class="control-group reorder-group">
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
          title="Reorder All Nodes (Draggable Modal)"
          aria-label="Open reorder modal for all nodes"
        >
          <span class="icon">📋</span>
          <span class="btn-text">Order</span>
        </button>
      </div>

      <!-- AI Formatting & Content Actions Group -->
      <div class="control-group format-group">
        <button
          @click="$emit('format-node')"
          class="control-btn ai-format-btn"
          title="Format by AI"
          :aria-label="`Format ${nodeType} node using AI`"
        >
          <span class="icon">🤖</span>
          <span class="btn-text">Format by AI</span>
        </button>

        <button
          @click="$emit('quick-format', 'add_work_notes')"
          class="control-btn quick-btn"
          title="Add Work Notes"
          :aria-label="`Add work notes to ${nodeType} node`"
        >
          <span class="icon">📝</span>
          <span class="btn-text">Work Notes</span>
        </button>
      </div>

      <!-- Copy Actions Group -->
      <div class="control-group copy-group">
        <button
          @click="$emit('copy-node')"
          class="control-btn copy-btn"
          title="Copy to Another Graph"
          :aria-label="`Copy ${nodeType} node to another graph`"
        >
          <span class="icon">📋</span>
          <span class="btn-text">Copy</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
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
  isCollapsed: {
    type: Boolean,
    default: false,
  },
})

// Events this component emits
defineEmits(['move-up', 'move-down', 'open-reorder', 'format-node', 'quick-format', 'copy-node', 'toggle-content'])
</script>

<style scoped>
.gnew-node-control-bar {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 8px 12px;
}

/* Header section with toggle and info */
.control-bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-type-badge {
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.position-info {
  font-size: 0.875rem;
  color: #666;
  font-weight: 600;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

/* Control groups container */
.control-groups-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e9ecef;
}

.reorder-group {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #2196f3;
}

.format-group {
  background: linear-gradient(135deg, #f3e5f5 0%, #ce93d8 100%);
  border-color: #9c27b0;
}

.copy-group {
  background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
  border-color: #4caf50;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-height: 32px;
}

.control-btn:hover:not(:disabled) {
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.control-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f8f9fa;
}

/* Toggle button styling */
.toggle-btn {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
  font-weight: 600;
}

.toggle-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
}

.reorder-btn {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
}

.reorder-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
}

.ai-format-btn {
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
  color: white;
}

.ai-format-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%);
}

.copy-btn {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
  color: white;
}

.copy-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #388e3c 0%, #2e7d32 100%);
}

.quick-btn {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
}

.quick-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
}

.reorder-mini {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon {
  font-size: 1rem;
  line-height: 1;
}

.btn-text {
  font-size: 0.8rem;
  font-weight: 600;
}

/* Responsive design */
@media (max-width: 768px) {
  .gnew-node-control-bar {
    margin-bottom: 10px;
  }

  .control-bar-header {
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }

  .control-groups-container {
    flex-direction: column;
    gap: 8px;
  }

  .control-group {
    width: 100%;
    justify-content: center;
    padding: 6px;
  }

  .control-btn {
    flex: 1;
    justify-content: center;
    padding: 8px 12px;
  }

  .btn-text {
    display: none;
  }

  .reorder-mini {
    width: 100%;
    justify-content: center;
  }

  /* Keep toggle button text visible on mobile */
  .toggle-btn .btn-text {
    display: inline;
  }
}

@media (max-width: 480px) {
  .icon {
    font-size: 1.2rem;
  }

  .control-btn {
    min-height: 40px;
    min-width: 40px;
  }
}
</style>
