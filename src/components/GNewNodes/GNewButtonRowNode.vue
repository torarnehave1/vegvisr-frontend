<template>
  <div class="gnew-buttonrow-node">
    <!-- Node Header (only for logged users) -->
    <div v-if="node.label && showControls" class="node-header">
      <div class="node-title-section">
        <h3 class="node-title">{{ node.label }}</h3>
        <div class="node-type-badge-inline">BUTTON ROW</div>
      </div>
      <div v-if="!isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Button Row Content -->
    <div class="button-row-container" :style="containerStyle">
      <!-- Empty State -->
      <div v-if="!hasValidButtons" class="empty-state">
        <div class="empty-icon">🔘</div>
        <p class="empty-text">No buttons configured</p>
        <small class="empty-hint">Configure buttons in the node's info field</small>
      </div>

      <!-- Button Row -->
      <div v-else class="button-row" :style="buttonRowStyle">
        <button
          v-for="button in validButtons"
          :key="button.id"
          :class="getButtonClasses(button)"
          :style="getButtonStyle(button)"
          @click="handleButtonClick(button)"
          :disabled="isPreview && button.action === 'function'"
        >
          {{ button.text }}
        </button>
      </div>
    </div>

    <!-- Debug Info (only in development) -->
    <div v-if="showDebug && isDevelopment" class="debug-info">
      <details>
        <summary>Debug: Button Configuration</summary>
        <pre>{{ JSON.stringify(buttonConfig, null, 2) }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

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
const emit = defineEmits(['node-updated', 'node-deleted', 'button-action'])

// Router for navigation
const router = useRouter()

// Development flag
const isDevelopment = computed(() => import.meta.env.DEV)
const showDebug = ref(false)

// Parse button configuration from node.info
const buttonConfig = computed(() => {
  if (!props.node.info) return null

  try {
    const parsed = JSON.parse(props.node.info)
    return parsed
  } catch (error) {
    console.warn('Failed to parse button configuration:', error)
    return null
  }
})

// Validate and filter buttons
const validButtons = computed(() => {
  if (!buttonConfig.value?.buttons || !Array.isArray(buttonConfig.value.buttons)) {
    return []
  }

  return buttonConfig.value.buttons.filter(
    (button) => button && typeof button === 'object' && button.id && button.text && button.action,
  )
})

const hasValidButtons = computed(() => validButtons.value.length > 0)

// Container styling
const containerStyle = computed(() => {
  const config = buttonConfig.value || {}
  return {
    padding: config.padding || '1rem',
    backgroundColor: config.backgroundColor || 'transparent',
  }
})

// Button row styling
const buttonRowStyle = computed(() => {
  const config = buttonConfig.value || {}
  const layout = config.layout || 'horizontal'

  return {
    display: 'flex',
    flexDirection: layout === 'vertical' ? 'column' : 'row',
    gap: config.gap || '0.75rem',
    justifyContent: config.justifyContent || 'flex-start',
    alignItems: config.alignItems || 'center',
    flexWrap: config.flexWrap || 'wrap',
  }
})

// Button classes based on style
const getButtonClasses = (button) => {
  const baseClasses = ['cta']
  const style = button.style || 'primary'

  // Map styles to FrontPage.vue classes
  switch (style) {
    case 'primary':
      baseClasses.push('primary')
      break
    case 'secondary':
      baseClasses.push('secondary')
      break
    case 'canvas':
      baseClasses.push('canvas')
      break
    case 'outline':
      baseClasses.push('outline')
      break
    default:
      baseClasses.push('primary')
  }

  return baseClasses.join(' ')
}

// Individual button styling
const getButtonStyle = (button) => {
  const style = {}

  if (button.width) style.width = button.width
  if (button.minWidth) style.minWidth = button.minWidth
  if (button.customColor) style.backgroundColor = button.customColor

  return style
}

// Handle button clicks
const handleButtonClick = (button) => {
  console.log('Button clicked:', button)

  // Emit button action event
  emit('button-action', {
    nodeId: props.node.id,
    buttonId: button.id,
    action: button.action,
    target: button.target,
    button: button,
  })

  // Handle different action types
  switch (button.action) {
    case 'route':
      if (button.target && router) {
        router.push(button.target)
      }
      break

    case 'url':
      if (button.target) {
        window.open(button.target, button.newTab !== false ? '_blank' : '_self')
      }
      break

    case 'email':
      if (button.target) {
        window.location.href = `mailto:${button.target}`
      }
      break

    case 'function':
      if (!props.isPreview && button.target) {
        try {
          // For function calls, target should be a function name or code
          if (typeof window[button.target] === 'function') {
            window[button.target](button.params || {})
          } else {
            console.warn(`Function ${button.target} not found`)
          }
        } catch (error) {
          console.error('Error executing button function:', error)
        }
      }
      break

    default:
      console.warn('Unknown button action:', button.action)
  }
}

// Node editing
const editNode = () => {
  emit('node-updated', { ...props.node, action: 'edit' })
}

// Node deletion
const deleteNode = () => {
  if (confirm('Are you sure you want to delete this button row?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-buttonrow-node {
  margin-bottom: 1rem;
}

/* Node Header */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.node-title-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.node-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.node-type-badge-inline {
  background: #007bff;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.node-controls {
  display: flex;
  gap: 0.5rem;
}

/* Button Row Container */
.button-row-container {
  min-height: 60px;
}

.button-row {
  width: 100%;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #666;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.empty-text {
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.empty-hint {
  color: #999;
  font-size: 0.85rem;
}

/* Button Styles (matching FrontPage.vue) */
.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  cursor: pointer;
  min-width: 120px;
  white-space: nowrap;
}

.cta.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.cta.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.cta.secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(240, 147, 251, 0.4);
}

.cta.secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(240, 147, 251, 0.6);
}

.cta.canvas {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
}

.cta.canvas:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79, 172, 254, 0.6);
}

.cta.outline {
  background: transparent;
  color: #667eea;
  border: 2px solid #667eea;
}

.cta.outline:hover {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
}

.cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

/* Debug Info */
.debug-info {
  padding: 1rem;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  font-size: 0.8rem;
}

.debug-info pre {
  background: #ffffff;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  overflow-x: auto;
  margin: 0.5rem 0 0 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .button-row {
    flex-direction: column;
    align-items: stretch;
  }

  .cta {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .node-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .node-title-section {
    width: 100%;
  }

  .node-controls {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
