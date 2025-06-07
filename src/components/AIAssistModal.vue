<template>
  <div v-if="isOpen" class="ai-assist-modal">
    <div class="modal-content">
      <button class="ai-assist-close" @click="close" title="Close">&times;</button>
      <h3>AI Assist</h3>
      <div v-if="!mode">
        <div class="mb-2">
          <textarea
            v-model="question"
            class="form-control mb-1 ai-assist-questionarea"
            placeholder="Ask a question..."
            rows="3"
          />
          <button class="btn btn-outline-success" @click="runAssist('ask')" :disabled="!question">
            Ask
          </button>
        </div>
        <div class="ai-assist-btn-row">
          <button class="btn btn-outline-primary ai-assist-btn" @click="runAssist('expand')">
            Elaborate on the text
          </button>
          <button class="btn btn-outline-warning ai-assist-btn" @click="runAssist('image')">
            Generate Header Image
          </button>
        </div>
      </div>
      <div v-else>
        <div v-if="loading" class="text-center my-3">
          <span class="spinner-border spinner-border-sm"></span> Loading AI response...
        </div>
        <div v-else-if="result" class="ai-assist-result-container">
          <div class="ai-assist-buttons">
            <button class="btn btn-primary" @click="insertResult">Insert at Cursor</button>
            <button class="btn btn-secondary" @click="close">Back</button>
          </div>
          <div class="alert alert-info">{{ result }}</div>
        </div>
        <div v-else-if="imageUrl" class="ai-assist-image-container">
          <div class="ai-assist-buttons">
            <button class="btn btn-primary" @click="insertResult">Insert as Header Image</button>
            <button class="btn btn-secondary" @click="close">Back</button>
          </div>
          <img
            :src="imageUrl"
            alt="AI Header"
            style="max-width: 100%; border-radius: 6px; margin-bottom: 10px"
          />
        </div>
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
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
  context: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'insert'])

const mode = ref('')
const question = ref('')
const loading = ref(false)
const result = ref('')
const imageUrl = ref('')
const error = ref('')

const runAssist = async (assistMode) => {
  mode.value = assistMode
  loading.value = true
  result.value = ''
  imageUrl.value = ''
  error.value = ''

  if (assistMode === 'image') {
    try {
      const prompt =
        String(props.context ?? '').slice(0, 300) || 'A beautiful, wide, horizontal header image'
      const response = await fetch('https://api.vegvisr.org/generate-header-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'API error')
      }
      const data = await response.json()
      result.value = data.markdown || '[No image generated]'
      imageUrl.value = data.url || ''
    } catch (err) {
      error.value = 'Error: ' + (err.message || err)
    } finally {
      loading.value = false
    }
    return
  }

  try {
    const payload = {
      context: String(props.context ?? ''),
      ...(assistMode === 'ask' && question.value ? { question: String(question.value) } : {}),
    }
    const endpoint =
      assistMode === 'ask'
        ? 'https://api.vegvisr.org/grok-ask'
        : 'https://api.vegvisr.org/grok-elaborate'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'API error')
    }
    const data = await response.json()
    result.value = data.result || '[No response from AI]'
  } catch (err) {
    error.value = 'Error: ' + (err.message || err)
  } finally {
    loading.value = false
  }
}

const insertResult = () => {
  emit('insert', result.value)
  close()
}

const close = () => {
  mode.value = ''
  question.value = ''
  result.value = ''
  imageUrl.value = ''
  error.value = ''
  emit('close')
}
</script>

<style scoped>
.ai-assist-modal {
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
  position: relative;
}

.ai-assist-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.ai-assist-close:hover {
  color: #000;
}

.ai-assist-btn-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.ai-assist-btn {
  flex: 1;
}

.ai-assist-result-container,
.ai-assist-image-container {
  margin-top: 20px;
}

.ai-assist-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.ai-assist-questionarea {
  resize: vertical;
}
</style>
