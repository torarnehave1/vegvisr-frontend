<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <h3>Vegvisr AI Node Creation</h3>
      <div class="form-group">
        <label for="aiNodeRequest">What would you like to create?</label>
        <textarea
          id="aiNodeRequest"
          v-model="aiNodeRequest"
          class="form-control"
          rows="3"
          placeholder="Describe what you want to create...."
        ></textarea>
      </div>
      <div class="form-group">
        <div class="form-check">
          <input
            type="checkbox"
            id="includeContext"
            v-model="includeContext"
            class="form-check-input"
          />
          <label class="form-check-label" for="includeContext">
            Include context from existing nodes
          </label>
        </div>
      </div>
      <div v-if="aiNodePreview" class="node-preview">
        <h4>Preview:</h4>
        <div class="preview-content">
          <textarea v-model="aiNodePreview" class="form-control" rows="10" readonly></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button
          v-if="!aiNodePreview"
          @click="generateNode"
          class="btn btn-primary"
          :disabled="!aiNodeRequest || isGenerating"
        >
          <span
            v-if="isGenerating"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          {{ isGenerating ? 'Generating...' : 'Generate' }}
        </button>
        <button v-if="aiNodePreview" @click="insertNode" class="btn btn-success">
          Insert Node
        </button>
        <button @click="close" class="btn btn-secondary">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  graphContext: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'node-inserted'])

const aiNodeRequest = ref('')
const aiNodePreview = ref(null)
const includeContext = ref(false)
const isGenerating = ref(false)

const generateNode = async () => {
  try {
    isGenerating.value = true

    const response = await fetch('https://api.vegvisr.org/ai-generate-node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userRequest: aiNodeRequest.value,
        graphContext: props.graphContext,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to generate AI node')
    }

    const text = await response.text()
    const data = JSON.parse(text)
    aiNodePreview.value = JSON.stringify(data.node, null, 2)
  } catch (error) {
    console.error('Error generating AI node:', error)
    alert(error.message || 'Failed to generate AI node. Please try again.')
  } finally {
    isGenerating.value = false
  }
}

const insertNode = () => {
  if (aiNodePreview.value) {
    try {
      const responseData = JSON.parse(aiNodePreview.value)
      const nodeData = responseData.node || responseData
      emit('node-inserted', { ...nodeData, visible: true })
      close()
    } catch (error) {
      console.error('Error parsing node data:', error)
      alert('Invalid node data. Please check the preview and try again.')
    }
  }
}

const close = () => {
  aiNodeRequest.value = ''
  aiNodePreview.value = null
  includeContext.value = false
  isGenerating.value = false
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.node-preview {
  margin-top: 20px;
}

.preview-content {
  margin-top: 10px;
}
</style>
