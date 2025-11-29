<template>
  <div class="ai-chat-view">
    <div class="chat-container">
      <ai-chat-component
        :api-endpoint="apiEndpoint"
        :user-id="userId"
        :graph-id="graphId"
        :theme="theme"
        :model="selectedModel"
        @message-sent="handleMessageSent"
        @response-received="handleResponseReceived"
        @model-changed="handleModelChanged"
        @error="handleError">
      </ai-chat-component>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraph'
import { useAuthStore } from '@/stores/auth'

const graphStore = useKnowledgeGraphStore()
const authStore = useAuthStore()

// API configuration
const apiEndpoint = ref('https://api.vegvisr.org')

// User ID from auth store or default
const userId = computed(() => authStore.userEmail || 'demo-user@example.com')

// Graph context from store (if viewing a graph)
const graphId = computed(() => graphStore.currentGraphId || null)

// Theme from user preferences or system
const theme = ref('light')

// Selected model
const selectedModel = ref('grok')

// Event handlers
const handleMessageSent = (event) => {
  console.log('Message sent:', event.detail)
}

const handleResponseReceived = (event) => {
  console.log('Response received:', event.detail)
  // Could show a toast notification here
}

const handleModelChanged = (event) => {
  console.log('Model changed:', event.detail)
  selectedModel.value = event.detail.newModel
}

const handleError = (event) => {
  console.error('Chat error:', event.detail)
  // Could show an error notification here
}

// Load theme from localStorage or system preference
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    theme.value = savedTheme
  } else {
    // Detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme.value = 'dark'
    }
  }

  // Load the component script
  loadComponentScript()
})

// Load the AI chat component from R2
const loadComponentScript = () => {
  // Check if already loaded
  if (customElements.get('ai-chat-component')) {
    return
  }

  const script = document.createElement('script')
  script.src = `${apiEndpoint.value}/components/ai-chat-component.js`
  script.async = true
  script.onerror = () => {
    console.error('Failed to load AI chat component')
  }
  document.head.appendChild(script)
}
</script>

<style scoped>
.ai-chat-view {
  height: calc(100vh - 120px); /* Adjust based on your layout */
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.chat-container {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

ai-chat-component {
  display: block;
  height: 100%;
}
</style>
