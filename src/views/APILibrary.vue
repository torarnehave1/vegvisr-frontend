<template>
  <div class="api-library-page">
    <div class="back-navigation">
      <router-link to="/app-builder" class="back-button">
        ← Back to App Builder
      </router-link>
    </div>

    <div class="api-library-header">
      <div>
        <h1>🔌 API Library</h1>
        <p class="api-library-description">
          Enable or disable APIs that will be available in your generated apps.
          Always-on APIs are required and cannot be disabled.
        </p>
      </div>
      <div class="api-library-stats">
        <span class="enabled-count">
          {{ enabledAPIs.length }} API{{ enabledAPIs.length !== 1 ? 's' : '' }} enabled
        </span>
        <button
          v-if="userStore.role === 'Superadmin'"
          @click="showAPICreator = true"
          class="btn-create-api"
        >
          ✨ Create New API
        </button>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="api-category-tabs">
      <button
        @click="selectedAPICategory = 'all'"
        :class="['category-tab', { active: selectedAPICategory === 'all' }]"
      >
        All APIs
      </button>
      <button
        @click="selectedAPICategory = 'images'"
        :class="['category-tab', { active: selectedAPICategory === 'images' }]"
      >
        📸 Images <span class="count">{{ apiCategoryCount('images') }}</span>
      </button>
      <button
        @click="selectedAPICategory = 'ai'"
        :class="['category-tab', { active: selectedAPICategory === 'ai' }]"
      >
        🤖 AI <span class="count">{{ apiCategoryCount('ai') }}</span>
      </button>
      <button
        @click="selectedAPICategory = 'storage'"
        :class="['category-tab', { active: selectedAPICategory === 'storage' }]"
      >
        💾 Storage <span class="count">{{ apiCategoryCount('storage') }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loadingAPIs" class="loading-state">
      <div class="spinner"></div>
      <p>Loading APIs...</p>
    </div>

    <!-- API Cards Grid -->
    <div v-else class="api-cards-container">
      <template v-for="(apis, category) in filteredAPIs" :key="category">
        <div v-if="apis && apis.length > 0" class="category-section">
          <h3 class="category-title" v-if="selectedAPICategory === 'all'">
            {{ category === 'images' ? '📸 Images' : category === 'ai' ? '🤖 AI' : category === 'storage' ? '💾 Storage' : category }}
          </h3>

          <div class="api-cards-grid">
            <div
              v-for="api in apis"
              :key="api.slug"
              :class="['api-card', { enabled: isAPIEnabled(api.slug), 'always-on': api.is_always_on }]"
              @click="toggleAPI(api.slug, api.is_always_on)"
            >
              <div class="api-card-header">
                <span class="api-icon" :style="{ color: api.color }">{{ api.icon }}</span>
                <div class="api-info">
                  <h5 class="api-name">{{ api.name }}</h5>
                  <span v-if="api.is_always_on" class="always-on-badge">Always On</span>
                  <span v-else-if="api.status === 'coming_soon'" class="coming-soon-badge">Coming Soon</span>
                </div>
                <div class="api-toggle" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isAPIEnabled(api.slug)"
                    :disabled="api.is_always_on"
                    @change="toggleAPI(api.slug, api.is_always_on)"
                  />
                </div>
              </div>

              <p class="api-description">{{ api.description }}</p>

              <div class="api-meta">
                <span class="api-function">{{ api.function_name }}()</span>
                <span class="api-rate-limit">{{ api.rate_limit }}</span>
              </div>

              <details class="api-details" @click.stop>
                <summary>View Details</summary>
                <div class="api-details-content">
                  <p><strong>Signature:</strong></p>
                  <code>{{ api.function_signature }}</code>

                  <p v-if="api.example_code"><strong>Example:</strong></p>
                  <pre v-if="api.example_code"><code>{{ api.example_code }}</code></pre>

                  <p v-if="api.docs_url">
                    <a :href="api.docs_url" target="_blank" rel="noopener">📖 Documentation</a>
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="!loadingAPIs && Object.keys(availableAPIs).length === 0" class="empty-state">
      <p>No APIs available</p>
    </div>

    <!-- Status Message -->
    <div v-if="statusMessage" :class="['status-message', statusMessage.type]">
      {{ statusMessage.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

// State
const loadingAPIs = ref(false)
const availableAPIs = ref({})
const enabledAPIs = ref([
  'ai-chat',
  'cloud-storage-save',
  'cloud-storage-load',
  'cloud-storage-load-all',
  'cloud-storage-delete',
  'pexels',
  'portfolio-images'
])
const selectedAPICategory = ref('all')
const showAPICreator = ref(false)
const statusMessage = ref(null)

// Computed
const filteredAPIs = computed(() => {
  if (selectedAPICategory.value === 'all') {
    return availableAPIs.value
  }
  return {
    [selectedAPICategory.value]: availableAPIs.value[selectedAPICategory.value] || []
  }
})

const apiCategoryCount = (category) => {
  return availableAPIs.value[category]?.length || 0
}

// Methods
const loadAPILibrary = async () => {
  loadingAPIs.value = true

  try {
    const response = await fetch('https://api.vegvisr.org/api/apis/list?status=active')
    const result = await response.json()

    if (result.success) {
      availableAPIs.value = result.apis
    } else {
      throw new Error(result.error || 'Failed to load API library')
    }
  } catch (error) {
    console.error('Load API library error:', error)
    showStatus('error', `❌ Error loading APIs: ${error.message}`)
  } finally {
    loadingAPIs.value = false
  }
}

const toggleAPI = (slug, isAlwaysOn) => {
  if (isAlwaysOn) {
    showStatus('info', 'ℹ️ This API is always enabled and cannot be disabled')
    return
  }

  const index = enabledAPIs.value.indexOf(slug)
  if (index > -1) {
    enabledAPIs.value.splice(index, 1)
    showStatus('success', `✅ ${slug} disabled`)
  } else {
    enabledAPIs.value.push(slug)
    showStatus('success', `✅ ${slug} enabled`)
  }

  saveEnabledAPIsToLocalStorage()
}

const isAPIEnabled = (slug) => {
  return enabledAPIs.value.includes(slug)
}

const saveEnabledAPIsToLocalStorage = () => {
  try {
    localStorage.setItem('enabledAPIs', JSON.stringify(enabledAPIs.value))
  } catch (error) {
    console.error('Error saving enabled APIs to localStorage:', error)
  }
}

const loadEnabledAPIsFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('enabledAPIs')
    if (saved) {
      enabledAPIs.value = JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error loading enabled APIs from localStorage:', error)
  }
}

const showStatus = (type, message) => {
  statusMessage.value = { type, message }
  setTimeout(() => {
    statusMessage.value = null
  }, 3000)
}

// Lifecycle
onMounted(() => {
  loadEnabledAPIsFromLocalStorage()
  loadAPILibrary()
})
</script>

<style scoped>
.api-library-page {
  min-height: 100vh;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.back-navigation {
  margin-bottom: 1.5rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: white;
  color: #667eea;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.3s;
  border: 2px solid transparent;
}

.back-button:hover {
  background: #667eea;
  color: white;
  transform: translateX(-4px);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  border-color: #667eea;
}

.api-library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding: 2rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.api-library-header h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: #333;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.api-library-description {
  color: #666;
  font-size: 1rem;
  margin: 0.5rem 0 0 0;
  max-width: 600px;
  line-height: 1.6;
}

.api-library-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.enabled-count {
  font-size: 1.1rem;
  font-weight: 700;
  color: #667eea;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
  border-radius: 12px;
  border: 2px solid #667eea;
}

.btn-create-api {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 1rem 1.75rem;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.btn-create-api:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
}

.api-category-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  background: white;
  padding: 1rem;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow-x: auto;
}

.category-tab {
  background: none;
  border: none;
  padding: 0.875rem 1.5rem;
  cursor: pointer;
  font-weight: 700;
  font-size: 1rem;
  color: #666;
  border-radius: 10px;
  transition: all 0.3s;
  white-space: nowrap;
}

.category-tab:hover {
  background: #f0f4ff;
  color: #667eea;
}

.category-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.category-tab .count {
  display: inline-block;
  background: rgba(255, 255, 255, 0.3);
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-left: 0.5rem;
  font-weight: 700;
}

.category-tab.active .count {
  background: rgba(255, 255, 255, 0.25);
}

.loading-state {
  text-align: center;
  padding: 4rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto 1rem;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.api-cards-container {
  width: 100%;
}

.category-section {
  margin-bottom: 3rem;
}

.category-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #333;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 3px solid #667eea;
}

.api-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.api-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.api-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
}

.api-card.enabled {
  border-color: #667eea;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.15);
}

.api-card.always-on {
  border-color: #4caf50;
  background: linear-gradient(135deg, #f1f8f4 0%, #e8f5e9 100%);
}

.api-card.always-on:hover {
  border-color: #4caf50;
  box-shadow: 0 8px 25px rgba(76, 175, 80, 0.2);
}

.api-card-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.api-icon {
  font-size: 2.5rem;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.api-info {
  flex: 1;
}

.api-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: #333;
}

.always-on-badge,
.coming-soon-badge {
  display: inline-block;
  padding: 0.3rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-top: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.always-on-badge {
  background: #4caf50;
  color: white;
}

.coming-soon-badge {
  background: #ff9800;
  color: white;
}

.api-toggle {
  flex-shrink: 0;
}

.api-toggle input[type="checkbox"] {
  width: 24px;
  height: 24px;
  cursor: pointer;
  accent-color: #667eea;
}

.api-toggle input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.api-description {
  color: #666;
  font-size: 0.95rem;
  margin: 1rem 0;
  line-height: 1.6;
}

.api-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
  padding-top: 1rem;
  border-top: 2px solid #f0f0f0;
}

.api-function {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  color: #667eea;
  font-weight: 700;
  background: rgba(102, 126, 234, 0.1);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
}

.api-rate-limit {
  font-size: 0.8rem;
  color: #999;
  font-weight: 600;
}

.api-details {
  margin-top: 1rem;
  border-top: 2px solid #f0f0f0;
  padding-top: 1rem;
}

.api-details summary {
  cursor: pointer;
  font-size: 0.9rem;
  color: #667eea;
  font-weight: 700;
  user-select: none;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.api-details summary:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #764ba2;
}

.api-details-content {
  margin-top: 1rem;
  padding: 1.25rem;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.api-details-content p {
  margin: 0.75rem 0;
  font-weight: 600;
  color: #555;
}

.api-details-content code {
  display: block;
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  color: #333;
  margin: 0.5rem 0;
  border: 1px solid #e0e0e0;
}

.api-details-content pre {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5rem 0;
  border: 1px solid #e0e0e0;
}

.api-details-content pre code {
  background: none;
  padding: 0;
  border: none;
  white-space: pre-wrap;
}

.api-details-content a {
  color: #667eea;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s;
}

.api-details-content a:hover {
  color: #764ba2;
  text-decoration: underline;
}

.empty-state {
  text-align: center;
  padding: 4rem;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  color: #999;
  font-size: 1.2rem;
}

.status-message {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease-out;
  z-index: 1000;
}

.status-message.success {
  background: #4caf50;
  color: white;
}

.status-message.error {
  background: #f44336;
  color: white;
}

.status-message.info {
  background: #2196F3;
  color: white;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .api-library-page {
    padding: 1rem;
  }

  .api-library-header {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .api-library-header h1 {
    font-size: 2rem;
  }

  .api-library-stats {
    width: 100%;
    flex-direction: column;
  }

  .enabled-count,
  .btn-create-api {
    width: 100%;
    text-align: center;
  }

  .api-cards-grid {
    grid-template-columns: 1fr;
  }

  .category-tab {
    padding: 0.7rem 1rem;
    font-size: 0.9rem;
  }
}
</style>
