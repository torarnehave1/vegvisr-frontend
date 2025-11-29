<template>
  <div class="component-docs-view">
    <div class="docs-header">
      <button @click="goBack" class="btn-back">← Back to Component Manager</button>
      <div v-if="!loading && documentation" class="header-info">
        <h1>{{ documentation.component.name }}</h1>
        <span class="version-badge">v{{ documentation.component.version }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading documentation...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <h2>❌ Documentation Not Available</h2>
      <p>{{ error }}</p>
      <button @click="goBack" class="btn-primary">Go Back</button>
    </div>

    <!-- Documentation Content -->
    <div v-else-if="documentation" class="docs-content">
      <ComponentDocumentation 
        :component="{ name: componentName, version: version || 'current' }"
        :documentation="documentation"
        @refresh="loadDocumentation" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ComponentDocumentation from '@/components/ComponentDocumentation.vue'

const route = useRoute()
const router = useRouter()

const componentName = route.params.componentName
const version = route.params.version

const documentation = ref(null)
const loading = ref(true)
const error = ref(null)

const loadDocumentation = async () => {
  loading.value = true
  error.value = null

  try {
    const url = version
      ? `https://api.vegvisr.org/api/components/${componentName}/docs/${version}`
      : `https://api.vegvisr.org/api/components/${componentName}/docs`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to load documentation (${response.status})`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Documentation not available')
    }

    documentation.value = data.documentation
  } catch (err) {
    console.error('Documentation loading error:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/component-manager')
}

onMounted(() => {
  loadDocumentation()
})
</script>

<style scoped>
.component-docs-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.docs-header {
  margin-bottom: 30px;
}

.btn-back {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
  margin-bottom: 20px;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateX(-2px);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-info h1 {
  color: white;
  margin: 0;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.version-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 1.1rem;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

/* Loading State */
.loading-container {
  background: white;
  border-radius: 12px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #e2e8f0;
  border-top: 5px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-container p {
  color: #64748b;
  font-size: 1.1rem;
  margin: 0;
}

/* Error State */
.error-container {
  background: white;
  border-radius: 12px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.error-container h2 {
  color: #dc2626;
  margin-bottom: 15px;
}

.error-container p {
  color: #7f1d1d;
  background: #fef2f2;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #fecaca;
  margin-bottom: 25px;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Documentation Content */
.docs-content {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* Responsive */
@media (max-width: 768px) {
  .component-docs-view {
    padding: 15px;
  }

  .header-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-info h1 {
    font-size: 2rem;
  }

  .docs-content {
    padding: 20px;
  }
}
</style>
