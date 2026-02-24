<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="node-edit-modal" @click.stop>
      <div class="modal-header">
        <h4>✏️ Edit Node Content</h4>
        <button @click="$emit('close')" class="btn-close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Node Title -->
        <div class="form-group">
          <label class="form-label">Node Title:</label>
          <input
            v-model="localNode.label"
            type="text"
            class="form-control"
            placeholder="Enter node title..."
          />
          <div v-if="showSuperadminOnlyToggle" class="form-check mt-2">
            <input
              id="node-superadmin-only-modal"
              class="form-check-input"
              type="checkbox"
              v-model="localNode.superadminOnly"
            />
            <label class="form-check-label" for="node-superadmin-only-modal">
              Show only for Superadmin
            </label>
            <small class="form-text text-muted d-block">
              Hidden for published/shared graphs unless the viewer is Superadmin.
            </small>
          </div>
        </div>

        <!-- YouTube URL Path Field (for youtube-video nodes) -->
        <div v-if="localNode.type === 'youtube-video'" class="form-group">
          <label class="form-label">📺 YouTube URL (Path):</label>
          <input
            v-model="localNode.path"
            type="url"
            class="form-control"
            placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)..."
          />
          <small class="form-text text-muted">
            Enter the full YouTube URL. This will be stored as the node's path property.
          </small>
        </div>

        <!-- Image URL Path Field (for markdown-image nodes) -->
        <div v-if="localNode.type === 'markdown-image'" class="form-group">
          <label class="form-label">Image URL (Path):</label>
          <input
            v-model="localNode.path"
            type="url"
            class="form-control"
            placeholder="Enter image URL (e.g., https://images.unsplash.com/photo-...)..."
          />
          <small class="form-text text-muted">
            The image URL stored as the node's path property.
          </small>
        </div>

        <!-- Node Content -->
        <div class="form-group">
          <label class="form-label">Node Content:</label>
          <div class="content-tools mb-2">
            <button
              v-if="hasSelectedText"
              @click="$emit('ai-rewrite', getSelectedText())"
              class="btn btn-sm btn-outline-primary me-2 ai-action-btn"
              type="button"
              title="AI Rewrite Selected Text"
            >
              🤖 Rewrite
            </button>
            <button
              v-if="hasSelectedText"
              @click="$emit('ai-challenge', getSelectedText())"
              class="btn btn-sm btn-outline-warning me-2 ai-action-btn"
              type="button"
              title="Challenge AI Claim"
            >
              🤔 Challenge
            </button>
            <button
              v-if="hasSelectedText"
              @click="$emit('ai-elaborate', getSelectedText())"
              class="btn btn-sm btn-outline-info ai-action-btn"
              type="button"
              title="Elaborate & Enhance"
            >
              ✨ Elaborate
            </button>
            <small class="text-muted ms-2" v-if="selectedText">
              Selected: "{{ truncateSelectedText }}"
            </small>

            <div class="node-find-replace d-flex flex-wrap align-items-center gap-2 mt-2">
              <input
                v-model="findText"
                type="text"
                class="form-control form-control-sm"
                placeholder="Find in node..."
              />
              <input
                v-model="replaceText"
                type="text"
                class="form-control form-control-sm"
                placeholder="Replace with..."
              />
              <div class="form-check form-check-inline m-0">
                <input
                  id="replace-node-title-modal"
                  class="form-check-input"
                  type="checkbox"
                  v-model="replaceTitle"
                />
                <label class="form-check-label small" for="replace-node-title-modal">
                  Title
                </label>
              </div>
              <button
                class="btn btn-sm btn-outline-secondary"
                type="button"
                @click="applyFindReplace"
                :disabled="!canReplaceText"
              >
                Replace in Node
              </button>
              <small v-if="replaceStatus" class="text-muted">
                {{ replaceStatus }}
              </small>
            </div>
          </div>
          <div class="textarea-container">
            <textarea
              ref="contentTextarea"
              v-model="localNode.info"
              class="form-control node-content-textarea"
              rows="20"
              placeholder="Enter node content... Type [ to see available elements..."
              @input="handleTextareaInput"
              @keydown="handleTextareaKeydown"
              @blur="hideAutocomplete"
              @mouseup="handleTextSelection"
              @keyup="handleTextSelection"
            ></textarea>

            <!-- Autocomplete Dropdown -->
            <div
              v-if="showAutocomplete && filteredElements.length > 0"
              class="autocomplete-dropdown"
              :style="{
                top: autocompletePosition.top + 'px',
                left: autocompletePosition.left + 'px',
              }"
            >
              <div class="autocomplete-header">
                <span class="autocomplete-title">✨ Formatted Elements ({{ filteredElements.length }})</span>
                <span class="autocomplete-hint">Press Tab or Enter to insert</span>
              </div>
              <div
                v-for="(element, index) in filteredElements"
                :key="element.trigger"
                class="autocomplete-item"
                :class="{ 'autocomplete-item-active': index === selectedElementIndex }"
                @mouseenter="selectedElementIndex = index"
                @click="insertElement(element)"
              >
                <div class="element-trigger">{{ element.trigger }}</div>
                <div class="element-description">{{ element.description }}</div>
                <div class="element-category">{{ element.category }}</div>
              </div>
            </div>
          </div>
          <small class="form-text text-muted">
            Type <code>[</code> or <code>![</code> to see available formatted elements with
            autocomplete. Press Tab or Enter to insert.
          </small>
        </div>

        <!-- Color Picker Section -->
        <div class="form-group">
          <label class="form-label">🎨 Node Color:</label>
          <div class="color-picker-container">
            <div class="color-picker-row">
              <input
                type="color"
                v-model="localNode.color"
                class="color-picker-input"
                title="Pick a custom color"
              />
              <span class="color-hex-display">{{ localNode.color || '#f8f9fa' }}</span>
            </div>

            <!-- Quick Color Palette -->
            <div class="quick-colors">
              <span class="quick-colors-label">Quick Colors:</span>
              <button
                v-for="color in quickColors"
                :key="color.hex"
                @click="localNode.color = color.hex"
                class="quick-color-btn"
                :style="{ backgroundColor: color.hex }"
                :title="color.name"
                type="button"
              ></button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">Cancel</button>
        <button @click="saveChanges" class="btn btn-primary" :disabled="saving">
          <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  node: {
    type: Object,
    default: () => ({})
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save', 'ai-rewrite', 'ai-challenge', 'ai-elaborate'])
const userStore = useUserStore()

// Local copy of node data
const localNode = ref({
  id: '',
  label: '',
  info: '',
  type: 'default',
  color: '#f8f9fa',
  path: '',
  superadminOnly: false
})

// Text selection state
const selectedText = ref('')
const selectedTextStart = ref(0)
const selectedTextEnd = ref(0)
const contentTextarea = ref(null)
const findText = ref('')
const replaceText = ref('')
const replaceTitle = ref(true)
const replaceStatus = ref('')

// Autocomplete state
const showAutocomplete = ref(false)
const currentTrigger = ref('')
const selectedElementIndex = ref(0)
const autocompletePosition = ref({ top: 0, left: 0 })

// Format elements for autocomplete
const formatElements = [
  // SECTION variations
  {
    trigger: '[SECTION]',
    description: '📦 Styled section with background, alignment & sizing',
    template: "[SECTION | background-color: 'lightblue'; color: 'black'; text-align: 'center'; font-size: '1.1em']\nYour content here\n[END SECTION]",
    category: 'Layout',
  },
  // QUOTE elements
  {
    trigger: '[QUOTE]',
    description: '💬 Quote block with attribution',
    template: "[QUOTE | Cited='Author']\nYour quote here\n[END QUOTE]",
    category: 'Content',
  },
  // FANCY element variations
  {
    trigger: '[FANCY]',
    description: '✨ Simple fancy text styling',
    template: '[FANCY | font-size: 4.5em; color: #2c3e50; text-align: center]\nYour title here\n[END FANCY]',
    category: 'Typography',
  },
  {
    trigger: '[FANCY-IMG]',
    description: '🖼️✨ Fancy text with background image',
    template: "[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]",
    category: 'Typography',
  },
  // WNOTE elements
  {
    trigger: '[WNOTE]',
    description: '📝 Work note with attribution',
    template: "[WNOTE | Cited='Author']\nYour work note here\n[END WNOTE]",
    category: 'Annotation',
  },
  // COMMENT elements
  {
    trigger: '[COMMENT]',
    description: '💭 Comment block with styling',
    template: "[COMMENT | author: 'Author'; color: 'gray'; background-color: '#f9f9f9']\nYour comment here\n[END COMMENT]",
    category: 'Annotation',
  },
  // Image elements
  {
    trigger: '![Header',
    description: '🖼️ Header image with full width',
    template: "![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)",
    category: 'Media',
  },
  // Rightside Image Variants
  {
    trigger: '![Rightside-Small',
    description: '➡️ Right side image - Small (120px)',
    template: "![Rightside-1|width: 120px; height: 120px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 10px 15px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Medium',
    description: '➡️ Right side image - Medium (200px)',
    template: "![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Large',
    description: '➡️ Right side image - Large (300px)',
    template: "![Rightside-1|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 0 20px 25px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Rightside-Circle',
    description: '➡️ Right side image - Circular',
    template: "![Rightside-1|width: 150px; height: 150px; object-fit: 'cover'; object-position: 'center'; border-radius: '50%'; margin: '0 0 15px 20px'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  // Leftside Image Variants
  {
    trigger: '![Leftside-Small',
    description: '⬅️ Left side image - Small (120px)',
    template: "![Leftside-1|width: 120px; height: 120px; object-fit: 'cover'; object-position: 'center'; margin: '0 15px 10px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Medium',
    description: '⬅️ Left side image - Medium (200px)',
    template: "![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Large',
    description: '⬅️ Left side image - Large (300px)',
    template: "![Leftside-1|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'; margin: '0 25px 20px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  {
    trigger: '![Leftside-Circle',
    description: '⬅️ Left side image - Circular',
    template: "![Leftside-1|width: 150px; height: 150px; object-fit: 'cover'; object-position: 'center'; border-radius: '50%'; margin: '0 20px 15px 0'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  // Center Image
  {
    trigger: '![Center',
    description: '🎯 Centered image',
    template: "![Center|width: 300px; height: auto; margin: '20px auto'; display: 'block'](https://vegvisr.imgix.net/SIDEIMG.png)",
    category: 'Media',
  },
  // FLEXBOX layouts
  {
    trigger: '[FLEXBOX]',
    description: '📐 Flexible container for side-by-side content',
    template: '[FLEXBOX | gap: 20px; justify-content: center; align-items: flex-start]\n![Image](https://vegvisr.imgix.net/SIDEIMG.png) ![Image](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-GALLERY]',
    description: '🖼️ Image gallery with wrapping and center alignment',
    template: '[FLEXBOX-GALLERY]\n![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 150px; height: 100px](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
  {
    trigger: '[FLEXBOX-ROW]',
    description: '➡️ Simple horizontal row with space between items',
    template: '[FLEXBOX-ROW]\n![Image|width: 120px; height: 80px](https://vegvisr.imgix.net/SIDEIMG.png) ![Image|width: 120px; height: 80px](https://vegvisr.imgix.net/SIDEIMG.png)\n[END FLEXBOX]',
    category: 'Layout',
  },
]

const showSuperadminOnlyToggle = computed(() => {
  if (userStore.role !== 'Superadmin') return false
  return localNode.value.type === 'fulltext' || localNode.value.type === 'html-node'
})

const canReplaceText = computed(() => {
  return findText.value.trim() !== '' && replaceText.value.trim() !== ''
})

const escapeRegExp = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const applyFindReplace = () => {
  if (!canReplaceText.value) return
  const searchText = findText.value
  const replacement = replaceText.value
  const regex = new RegExp(escapeRegExp(searchText), 'g')
  const currentContent = String(localNode.value?.info || '')
  const currentLabel = String(localNode.value?.label || '')

  localNode.value.info = currentContent.replace(regex, replacement)
  if (replaceTitle.value && currentLabel) {
    localNode.value.label = currentLabel.replace(regex, replacement)
  }

  replaceStatus.value = '✅ Replaced'
  setTimeout(() => {
    replaceStatus.value = ''
  }, 1500)
}

// Quick colors palette
const quickColors = [
  { name: 'Light Gray', hex: '#f8f9fa' },
  { name: 'Light Blue', hex: '#e3f2fd' },
  { name: 'Light Green', hex: '#e8f5e9' },
  { name: 'Light Yellow', hex: '#fff9c4' },
  { name: 'Light Orange', hex: '#fff3e0' },
  { name: 'Light Pink', hex: '#fce4ec' },
  { name: 'Light Purple', hex: '#f3e5f5' },
  { name: 'Light Teal', hex: '#e0f2f1' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Gray', hex: '#9e9e9e' }
]

// Computed
const hasSelectedText = computed(() => {
  return selectedText.value && selectedText.value.trim().length > 0
})

const truncateSelectedText = computed(() => {
  if (!selectedText.value) return ''
  return selectedText.value.length > 30
    ? selectedText.value.substring(0, 30) + '...'
    : selectedText.value
})

// Filtered elements for autocomplete
const filteredElements = computed(() => {
  if (!currentTrigger.value) return []

  const trigger = currentTrigger.value.toLowerCase()

  // Special handling for just '[' - show common elements
  if (trigger === '[') {
    const commonElements = formatElements.filter((element) => {
      const lower = element.trigger.toLowerCase()
      return lower.startsWith('[') || lower.startsWith('![')
    })
    return commonElements.slice(0, 15)
  }

  // Get all matching elements
  const matchingElements = formatElements.filter((element) =>
    element.trigger.toLowerCase().includes(trigger)
  )

  // Sort by relevance
  const sortedElements = matchingElements.sort((a, b) => {
    const aLower = a.trigger.toLowerCase()
    const bLower = b.trigger.toLowerCase()

    const aExactPrefix = aLower.startsWith(trigger)
    const bExactPrefix = bLower.startsWith(trigger)

    if (aExactPrefix && !bExactPrefix) return -1
    if (!aExactPrefix && bExactPrefix) return 1
    if (aExactPrefix && bExactPrefix) return aLower.localeCompare(bLower)

    // Prioritize image elements
    if (trigger.startsWith('![')) {
      const aIsImage = aLower.startsWith('![')
      const bIsImage = bLower.startsWith('![')
      if (aIsImage && !bIsImage) return -1
      if (!aIsImage && bIsImage) return 1
    }

    return aLower.localeCompare(bLower)
  })

  return sortedElements.slice(0, 15)
})

// Watch for node changes
watch(() => props.node, (newNode) => {
  if (newNode && Object.keys(newNode).length > 0) {
    localNode.value = {
      id: newNode.id || '',
      label: newNode.label || '',
      info: newNode.info || '',
      type: newNode.type || 'default',
      color: newNode.color || '#f8f9fa',
      path: newNode.path || '',
      superadminOnly: !!newNode.superadminOnly,
      ...newNode
    }
    findText.value = ''
    replaceText.value = ''
    replaceTitle.value = true
    replaceStatus.value = ''
  }
}, { immediate: true, deep: true })

// Watch for modal close to reset
watch(() => props.show, (isShowing) => {
  if (!isShowing) {
    selectedText.value = ''
    selectedTextStart.value = 0
    selectedTextEnd.value = 0
    showAutocomplete.value = false
    currentTrigger.value = ''
    findText.value = ''
    replaceText.value = ''
    replaceTitle.value = true
    replaceStatus.value = ''
  }
})

// Methods
const handleTextSelection = () => {
  const textarea = contentTextarea.value
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start !== end) {
      selectedText.value = textarea.value.substring(start, end)
      selectedTextStart.value = start
      selectedTextEnd.value = end
    } else {
      selectedText.value = ''
      selectedTextStart.value = 0
      selectedTextEnd.value = 0
    }
  }
}

const getSelectedText = () => {
  return {
    text: selectedText.value,
    start: selectedTextStart.value,
    end: selectedTextEnd.value,
    fullContent: localNode.value.info
  }
}

// Autocomplete methods
const handleTextareaInput = () => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const cursorPos = textarea.selectionStart
  const text = textarea.value

  // Look backwards from cursor to find trigger
  let triggerStart = -1
  let triggerText = ''

  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i]

    if (char === '[') {
      triggerStart = i
      triggerText = text.substring(i, cursorPos)
      break
    } else if (char === '!' && i > 0 && text[i - 1] !== '[') {
      // Check for ![ pattern
      continue
    } else if (char === ' ' || char === '\n' || char === '\t') {
      break
    }
  }

  // Show autocomplete if we found a trigger
  if (triggerStart >= 0 && triggerText.length > 0) {
    currentTrigger.value = triggerText
    updateAutocompletePosition(textarea, triggerStart)
    showAutocomplete.value = true
    selectedElementIndex.value = 0
  } else {
    showAutocomplete.value = false
  }
}

const handleTextareaKeydown = (event) => {
  if (!showAutocomplete.value || filteredElements.value.length === 0) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedElementIndex.value = Math.min(
        selectedElementIndex.value + 1,
        filteredElements.value.length - 1
      )
      break

    case 'ArrowUp':
      event.preventDefault()
      selectedElementIndex.value = Math.max(selectedElementIndex.value - 1, 0)
      break

    case 'Tab':
    case 'Enter':
      if (showAutocomplete.value && filteredElements.value[selectedElementIndex.value]) {
        event.preventDefault()
        insertElement(filteredElements.value[selectedElementIndex.value])
      }
      break

    case 'Escape':
      event.preventDefault()
      hideAutocomplete()
      break
  }
}

const updateAutocompletePosition = (textarea, triggerStart) => {
  const style = window.getComputedStyle(textarea)
  const lineHeight = parseInt(style.lineHeight) || 20
  const charWidth = 8

  const textBeforeCursor = textarea.value.substring(0, triggerStart)
  const lines = textBeforeCursor.split('\n')
  const currentLine = lines.length - 1
  const currentColumn = lines[lines.length - 1].length

  const top = currentLine * lineHeight + 25
  const left = Math.min(currentColumn * charWidth + 10, 300)

  autocompletePosition.value = { top, left }
}

const insertElement = (element) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const cursorPos = textarea.selectionStart
  const text = textarea.value

  // Find the trigger start position
  let triggerStart = cursorPos
  for (let i = cursorPos - 1; i >= 0; i--) {
    const char = text[i]
    if (char === '[') {
      triggerStart = i
      break
    }
  }

  // Replace the trigger text with the template
  const beforeTrigger = text.substring(0, triggerStart)
  const afterCursor = text.substring(cursorPos)
  const newText = beforeTrigger + element.template + afterCursor

  localNode.value.info = newText
  hideAutocomplete()

  // Position cursor after inserted template
  nextTick(() => {
    const newCursorPos = triggerStart + element.template.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

const hideAutocomplete = () => {
  // Delay to allow click events to fire
  setTimeout(() => {
    showAutocomplete.value = false
    currentTrigger.value = ''
  }, 150)
}

const saveChanges = () => {
  emit('save', { ...localNode.value })
}

// Expose methods for parent components
defineExpose({
  replaceSelectedText: (newText) => {
    if (selectedTextStart.value !== selectedTextEnd.value && localNode.value.info) {
      const before = localNode.value.info.substring(0, selectedTextStart.value)
      const after = localNode.value.info.substring(selectedTextEnd.value)
      localNode.value.info = before + newText + after
      selectedText.value = ''
      selectedTextStart.value = 0
      selectedTextEnd.value = 0
    }
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.node-edit-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.modal-header h4 {
  margin: 0;
  font-size: 1.25rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #000;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: block;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 1rem;
}

.form-control:focus {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.node-content-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  min-height: 300px;
  resize: vertical;
}

.content-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.ai-action-btn {
  font-size: 0.875rem;
}

.textarea-container {
  position: relative;
}

.form-text {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.form-text code {
  background: #e9ecef;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85em;
}

/* Autocomplete Dropdown */
.autocomplete-dropdown {
  position: absolute;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-height: 300px;
  overflow-y: auto;
  z-index: 1000;
  min-width: 350px;
  max-width: 450px;
}

.autocomplete-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-size: 0.8rem;
}

.autocomplete-title {
  font-weight: 600;
  color: #495057;
}

.autocomplete-hint {
  color: #6c757d;
  font-size: 0.75rem;
}

.autocomplete-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

.autocomplete-item:last-child {
  border-bottom: none;
}

.autocomplete-item:hover,
.autocomplete-item-active {
  background: #e7f1ff;
}

.element-trigger {
  font-family: monospace;
  font-size: 0.8rem;
  color: #0d6efd;
  font-weight: 600;
  white-space: nowrap;
}

.element-description {
  font-size: 0.8rem;
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-category {
  font-size: 0.7rem;
  color: #6c757d;
  background: #e9ecef;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  white-space: nowrap;
}

/* Color Picker */
.color-picker-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.color-picker-input {
  width: 50px;
  height: 35px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
}

.color-hex-display {
  font-family: monospace;
  font-size: 0.9rem;
  color: #666;
}

.quick-colors {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.quick-colors-label {
  font-size: 0.85rem;
  color: #666;
  margin-right: 0.5rem;
}

.quick-color-btn {
  width: 28px;
  height: 28px;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
}

.quick-color-btn:hover {
  transform: scale(1.15);
  border-color: #0d6efd;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #dee2e6;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  background: #0d6efd;
  border: 1px solid #0d6efd;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0b5ed7;
  border-color: #0a58ca;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  border: 1px solid #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5c636a;
  border-color: #565e64;
}

.btn-outline-primary {
  background: transparent;
  border: 1px solid #0d6efd;
  color: #0d6efd;
}

.btn-outline-primary:hover {
  background: #0d6efd;
  color: white;
}

.btn-outline-warning {
  background: transparent;
  border: 1px solid #ffc107;
  color: #997404;
}

.btn-outline-warning:hover {
  background: #ffc107;
  color: #000;
}

.btn-outline-info {
  background: transparent;
  border: 1px solid #0dcaf0;
  color: #055160;
}

.btn-outline-info:hover {
  background: #0dcaf0;
  color: #000;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
  border-width: 0.15em;
}

/* Responsive */
@media (max-width: 768px) {
  .node-edit-modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-body {
    padding: 1rem;
  }

  .content-tools {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-action-btn {
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .autocomplete-dropdown {
    min-width: 280px;
    max-width: 100%;
    left: 0 !important;
  }
}
</style>
