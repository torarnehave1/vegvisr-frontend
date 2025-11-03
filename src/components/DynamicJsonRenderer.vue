<template>
  <div class="dynamic-json-renderer">
    <!-- Render based on data type -->
    
    <!-- String value -->
    <div v-if="isString" class="value-string">
      <p class="mb-0" v-html="formatText(data)"></p>
    </div>

    <!-- Number value -->
    <div v-else-if="isNumber" class="value-number">
      <span class="badge bg-secondary">{{ data }}</span>
    </div>

    <!-- Boolean value -->
    <div v-else-if="isBoolean" class="value-boolean">
      <span class="badge" :class="data ? 'bg-success' : 'bg-danger'">
        {{ data ? '✓ True' : '✗ False' }}
      </span>
    </div>

    <!-- Array of strings/numbers (badges) -->
    <div v-else-if="isSimpleArray" class="value-array-simple">
      <div class="d-flex flex-wrap gap-2">
        <span 
          v-for="(item, index) in data" 
          :key="index"
          class="badge bg-secondary"
        >
          {{ item }}
        </span>
      </div>
    </div>

    <!-- Array of objects (list) -->
    <div v-else-if="isArray" class="value-array">
      <div 
        v-for="(item, index) in data" 
        :key="index"
        class="array-item mb-3 p-3 border-start border-3 border-secondary rounded"
      >
        <div class="d-flex align-items-start">
          <span class="badge bg-secondary me-2">{{ index + 1 }}</span>
          <div class="flex-grow-1">
            <DynamicJsonRenderer :data="item" :label="`Item ${index + 1}`" :depth="depth + 1" />
          </div>
        </div>
      </div>
    </div>

    <!-- Object (nested fields) -->
    <div v-else-if="isObject" class="value-object">
      <div class="row g-3">
        <div 
          v-for="(value, key) in data" 
          :key="key"
          :class="getColumnClass(value)"
        >
          <div class="card h-100">
            <div class="card-header bg-light border-bottom">
              <h6 class="mb-0">{{ formatFieldName(key) }}</h6>
            </div>
            <div class="card-body">
              <DynamicJsonRenderer :data="value" :label="key" :depth="depth + 1" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Null/undefined -->
    <div v-else class="value-null">
      <span class="text-muted fst-italic">No data</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: [String, Number, Boolean, Array, Object],
    default: null
  },
  label: {
    type: String,
    default: ''
  },
  depth: {
    type: Number,
    default: 0
  }
})

const isString = computed(() => typeof props.data === 'string')
const isNumber = computed(() => typeof props.data === 'number')
const isBoolean = computed(() => typeof props.data === 'boolean')
const isArray = computed(() => Array.isArray(props.data))
const isObject = computed(() => 
  props.data !== null && 
  typeof props.data === 'object' && 
  !Array.isArray(props.data)
)

const isSimpleArray = computed(() => {
  if (!isArray.value || props.data.length === 0) return false
  // Check if all items are strings or numbers
  return props.data.every(item => 
    typeof item === 'string' || typeof item === 'number'
  )
})

function formatText(text) {
  if (!text) return ''
  // Convert newlines to <br>, preserve paragraphs
  return text
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function formatFieldName(fieldName) {
  if (!fieldName) return ''
  // Convert various naming conventions to readable format
  return fieldName
    .replace(/([A-Z])/g, ' $1') // camelCase
    .replace(/_/g, ' ') // snake_case
    .replace(/-/g, ' ') // kebab-case
    .replace(/^\d+_/, '') // Remove number prefixes like "1_"
    .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize
    .trim()
}

function getColumnClass(value) {
  // Decide column width based on content
  if (!value) return 'col-md-6 col-lg-4' // Handle null/undefined
  
  if (typeof value === 'string' && value.length > 200) {
    return 'col-12' // Full width for long text
  }
  if (Array.isArray(value) && value.length > 5) {
    return 'col-12' // Full width for large arrays
  }
  if (typeof value === 'object' && Object.keys(value).length > 3) {
    return 'col-12' // Full width for complex objects
  }
  // Otherwise use responsive columns
  return 'col-md-6 col-lg-4'
}
</script>

<style scoped>
.dynamic-json-renderer {
  width: 100%;
}

.value-string p {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.array-item {
  background-color: rgba(0, 123, 255, 0.03);
  transition: background-color 0.2s;
}

.array-item:hover {
  background-color: rgba(0, 123, 255, 0.08);
}

.card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.value-array-simple {
  margin: 0.5rem 0;
}
</style>
