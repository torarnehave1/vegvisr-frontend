<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content sandbox-modal" @click.stop>
      <div class="modal-header">
        <h2>🧪 RAG Sandbox Creator</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <div class="step">
        <h3>🧠 Create RAG-Enabled Sandbox</h3>

        <div class="info-message">
          <p>
            This will create a temporary RAG-enabled sandbox environment from your knowledge graph
            data.
          </p>

          <div class="stats">
            <div class="stat-item">
              📄 <strong>{{ graphNodeCount }}</strong> nodes will be indexed
            </div>
            <div class="stat-item">🧠 Vector embeddings will be created for RAG queries</div>
            <div class="stat-item">⏱️ Sandbox expires in 4 hours</div>
          </div>
        </div>

        <div class="step-actions">
          <button @click="createSandbox" class="primary-btn" :disabled="isCreating">
            <span v-if="isCreating">🔄 Creating...</span>
            <span v-else>🚀 Create RAG Sandbox</span>
          </button>
        </div>

        <div v-if="sandboxResult" class="sandbox-result">
          <h4>✅ Sandbox Created Successfully!</h4>
          <div class="sandbox-info">
            <strong>URL:</strong>
            <a :href="sandboxResult.url" target="_blank">{{ sandboxResult.url }}</a>
          </div>
          <div class="test-section">
            <h5>Test RAG Query:</h5>
            <textarea
              v-model="testQuery"
              placeholder="Ask about your knowledge graph..."
            ></textarea>
            <button @click="testRAG" :disabled="!testQuery.trim()">Test RAG</button>
          </div>
          <div v-if="ragResponse" class="rag-response">
            <h5>Response:</h5>
            <p>{{ ragResponse }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { apiCall } from '@/config/api'

const props = defineProps({
  isVisible: Boolean,
  graphData: Object,
  graphId: String,
  userId: String,
})

const emit = defineEmits(['close'])

const isCreating = ref(false)
const sandboxResult = ref(null)
const testQuery = ref('')
const ragResponse = ref('')

const graphNodeCount = computed(() => {
  return props.graphData?.nodes?.length || 0
})

const closeModal = () => {
  emit('close')
  sandboxResult.value = null
  testQuery.value = ''
  ragResponse.value = ''
}

const createSandbox = async () => {
  isCreating.value = true

  try {
    // First create RAG index
    const ragIndex = await apiCall('/rag/create-index', {
      method: 'POST',
      body: JSON.stringify({
        graphData: props.graphData,
        graphId: props.graphId,
        userId: props.userId,
      }),
    })

    // Then create sandbox
    const sandbox = await apiCall('/rag/create-sandbox', {
      method: 'POST',
      body: JSON.stringify({
        indexId: ragIndex.indexId,
        extractedCode: ragIndex.extractedCode,
        userId: props.userId,
        graphId: props.graphId,
      }),
    })

    sandboxResult.value = sandbox.sandbox
  } catch (error) {
    console.error('Failed to create sandbox:', error)
    alert('Failed to create sandbox: ' + error.message)
  } finally {
    isCreating.value = false
  }
}

const testRAG = async () => {
  if (!testQuery.value.trim() || !sandboxResult.value) return

  try {
    const response = await fetch(`${sandboxResult.value.url}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: testQuery.value }),
    })

    const result = await response.json()
    ragResponse.value = result.response || 'No response'
  } catch (error) {
    console.error('RAG test failed:', error)
    ragResponse.value = `Error: ${error.message}`
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  color: #1976d2;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.step {
  padding: 24px;
}

.step h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.info-message {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.stats {
  margin-top: 12px;
}

.stat-item {
  margin: 8px 0;
  color: #555;
}

.step-actions {
  text-align: center;
  margin: 24px 0;
}

.primary-btn {
  background: #1976d2;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.primary-btn:hover:not(:disabled) {
  background: #1565c0;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sandbox-result {
  background: #e8f5e8;
  border: 1px solid #4caf50;
  border-radius: 8px;
  padding: 16px;
  margin-top: 20px;
}

.sandbox-info a {
  color: #1976d2;
  text-decoration: none;
}

.sandbox-info a:hover {
  text-decoration: underline;
}

.test-section {
  margin-top: 16px;
}

.test-section textarea {
  width: 100%;
  height: 60px;
  margin: 8px 0;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.test-section button {
  background: #1976d2;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.rag-response {
  margin-top: 16px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
}
</style>
