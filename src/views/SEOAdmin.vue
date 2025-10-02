<template>
  <div class="seo-admin">
    <!-- Header -->
    <div class="seo-header">
      <div class="header-content">
        <h1 class="header-title">
          <span class="title-icon">📈</span>
          SEO & Social Media Manager
        </h1>
        <p class="header-subtitle">
          Generate static pages for Google indexing and Facebook sharing
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="seo-content">
      <!-- Graph Selection -->
      <div class="card">
        <div class="card-header">
          <h3>🎯 Select Knowledge Graph</h3>
        </div>
        <div class="card-body">
          <div class="graph-selector">
            <input
              v-model="graphIdInput"
              type="text"
              class="form-control"
              placeholder="Enter Graph ID (e.g., graph_1759133206105)"
              @keyup.enter="loadGraph"
            />
            <button @click="loadGraph" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
              {{ loading ? 'Loading...' : 'Load Graph' }}
            </button>
          </div>

          <!-- Quick access to user's graphs -->
          <div v-if="userGraphs.length > 0" class="quick-graphs">
            <h5>Your Recent Graphs:</h5>
            <div class="graph-list">
              <div
                v-for="graph in userGraphs"
                :key="graph.id"
                class="graph-item"
                @click="selectGraph(graph.id)"
              >
                <span class="graph-title">{{ graph.title || 'Untitled' }}</span>
                <span class="graph-id">{{ graph.id }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Graph Data Display -->
      <div v-if="currentGraph" class="card mt-4">
        <div class="card-header">
          <h3>📊 Graph Information</h3>
        </div>
        <div class="card-body">
          <div class="graph-info">
            <div class="info-row">
              <label>Title:</label>
              <span>{{ graphData.metadata?.title || 'Untitled Graph' }}</span>
            </div>
            <div class="info-row">
              <label>Description:</label>
              <span>{{ graphData.metadata?.description || 'No description' }}</span>
            </div>
            <div class="info-row">
              <label>Nodes:</label>
              <span>{{ graphData.nodes?.length || 0 }}</span>
            </div>
            <div class="info-row">
              <label>Created By:</label>
              <span>{{ graphData.metadata?.createdBy || 'Unknown' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- SEO Configuration -->
      <div v-if="currentGraph" class="card mt-4">
        <div class="card-header">
          <h3>🔧 SEO Configuration</h3>
        </div>
        <div class="card-body">
          <!-- SEO Slug -->
          <div class="form-group">
            <label class="form-label">
              <strong>SEO-Friendly URL Slug:</strong>
              <button @click="generateSlugFromTitle" class="btn btn-sm btn-outline-secondary ms-2">
                Auto-generate from title
              </button>
            </label>
            <div class="url-preview-container">
              <span class="url-base">https://www.vegvisr.org/graph/</span>
              <input
                v-model="seoConfig.slug"
                type="text"
                class="form-control slug-input"
                placeholder="my-knowledge-graph"
                @input="validateSlug"
              />
            </div>
            <small class="form-text text-muted">
              Use lowercase letters, numbers, and hyphens only (e.g., "norse-mythology-symbols")
            </small>
            <div v-if="slugError" class="text-danger mt-1">{{ slugError }}</div>
          </div>

          <!-- Meta Description -->
          <div class="form-group mt-3">
            <label class="form-label">
              <strong>Meta Description:</strong>
              <button
                @click="generateAIDescription"
                class="btn btn-sm btn-outline-primary ms-2"
                :disabled="generatingDescription"
              >
                <span v-if="generatingDescription" class="spinner-border spinner-border-sm me-1"></span>
                {{ generatingDescription ? 'Generating...' : '✨ Generate with AI' }}
              </button>
            </label>
            <textarea
              v-model="seoConfig.description"
              class="form-control"
              rows="3"
              placeholder="A compelling description for search engines and social media (155-160 characters recommended)"
              maxlength="300"
            ></textarea>
            <small class="form-text text-muted">
              {{ seoConfig.description.length }}/300 characters
              <span v-if="seoConfig.description.length > 160" class="text-warning">
                (Recommended: 155-160 characters)
              </span>
            </small>
          </div>

          <!-- Open Graph Image Selection -->
          <div class="form-group mt-3">
            <label class="form-label"><strong>Open Graph Image:</strong></label>

            <div class="og-image-selection">
              <!-- Current selected image preview -->
              <div v-if="seoConfig.ogImage" class="og-preview-container">
                <img :src="seoConfig.ogImage" alt="Open Graph preview" class="og-preview-image" />
                <div class="og-preview-info">
                  <small>{{ seoConfig.ogImage }}</small>
                  <button @click="clearOGImage" class="btn btn-sm btn-outline-danger">
                    Remove
                  </button>
                </div>
              </div>

              <!-- Image selection options -->
              <div class="og-selection-buttons">
                <button
                  @click="autoSelectImageFromGraph"
                  class="btn btn-outline-primary"
                  :disabled="!graphData.nodes?.length"
                >
                  🤖 Auto-select from Graph
                </button>
                <button @click="openImageSelector" class="btn btn-outline-secondary">
                  🖼️ Choose from Portfolio
                </button>
                <button @click="openCustomImageUpload" class="btn btn-outline-info">
                  📁 Upload Custom Image
                </button>
              </div>
            </div>
            <small class="form-text text-muted">
              Recommended: 1200x630px for best Facebook/Twitter display
            </small>
          </div>

          <!-- Keywords/Tags -->
          <div class="form-group mt-3">
            <label class="form-label"><strong>Keywords (optional):</strong></label>
            <input
              v-model="seoConfig.keywords"
              type="text"
              class="form-control"
              placeholder="knowledge graph, education, visualization (comma-separated)"
            />
            <small class="form-text text-muted">
              Comma-separated keywords for SEO
            </small>
          </div>
        </div>
      </div>

      <!-- Preview Section -->
      <div v-if="currentGraph" class="card mt-4">
        <div class="card-header">
          <h3>👁️ Social Media Preview</h3>
        </div>
        <div class="card-body">
          <!-- Facebook Preview -->
          <div class="social-preview facebook-preview">
            <h5>Facebook Preview:</h5>
            <div class="preview-card">
              <img
                v-if="seoConfig.ogImage"
                :src="seoConfig.ogImage"
                alt="Preview"
                class="preview-image"
              />
              <div class="preview-content">
                <div class="preview-domain">vegvisr.org</div>
                <div class="preview-title">
                  {{ seoConfig.title || graphData.metadata?.title || 'Untitled' }}
                </div>
                <div class="preview-description">
                  {{ seoConfig.description || 'No description provided' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Twitter Preview -->
          <div class="social-preview twitter-preview mt-3">
            <h5>Twitter Card Preview:</h5>
            <div class="preview-card twitter-card">
              <img
                v-if="seoConfig.ogImage"
                :src="seoConfig.ogImage"
                alt="Preview"
                class="preview-image"
              />
              <div class="preview-content">
                <div class="preview-title">
                  {{ seoConfig.title || graphData.metadata?.title || 'Untitled' }}
                </div>
                <div class="preview-description">
                  {{ seoConfig.description || 'No description provided' }}
                </div>
                <div class="preview-domain">🔗 vegvisr.org</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="currentGraph" class="card mt-4">
        <div class="card-header">
          <h3>🚀 Actions</h3>
        </div>
        <div class="card-body">
          <div class="action-buttons">
            <button
              @click="generateStaticPage"
              class="btn btn-success btn-lg"
              :disabled="!isConfigValid || generating"
            >
              <span v-if="generating" class="spinner-border spinner-border-sm me-2"></span>
              {{ generating ? 'Generating Static Page...' : '🚀 Generate Static Page' }}
            </button>

            <button @click="testFacebookScraper" class="btn btn-outline-primary" :disabled="!staticPageGenerated">
              🔍 Test Facebook Scraper
            </button>

            <button @click="viewStaticPage" class="btn btn-outline-info" :disabled="!staticPageGenerated">
              👁️ View Static Page
            </button>

            <button @click="copyStaticURL" class="btn btn-outline-secondary" :disabled="!staticPageGenerated">
              📋 Copy URL
            </button>
          </div>

          <!-- Success/Error Messages -->
          <div v-if="successMessage" class="alert alert-success mt-3">
            {{ successMessage }}
          </div>
          <div v-if="errorMessage" class="alert alert-danger mt-3">
            {{ errorMessage }}
          </div>

          <!-- Generated URL Display -->
          <div v-if="generatedURL" class="generated-url-display mt-3">
            <h5>✅ Static Page Generated:</h5>
            <div class="url-display">
              <input
                :value="generatedURL"
                readonly
                class="form-control"
                ref="urlInput"
              />
              <button @click="copyToClipboard(generatedURL)" class="btn btn-primary">
                Copy
              </button>
            </div>
            <small class="text-muted">
              This URL is now optimized for Google indexing and Facebook sharing!
            </small>
          </div>
        </div>
      </div>

      <!-- Developer Info -->
      <div v-if="userStore.role === 'Superadmin'" class="card mt-4">
        <div class="card-header">
          <h3>🔧 Developer Information</h3>
        </div>
        <div class="card-body">
          <div class="dev-info">
            <h5>How it works:</h5>
            <ol>
              <li>You configure the SEO settings above</li>
              <li>Click "Generate Static Page" to create an HTML page</li>
              <li>The SEO Worker creates a static page at <code>/graph/{slug}</code></li>
              <li>Google can index the page, Facebook can scrape it</li>
              <li>Users visiting the page get redirected to the Vue app for interactivity</li>
            </ol>

            <h5 class="mt-3">Technical Details:</h5>
            <ul>
              <li><strong>Static Page URL:</strong> <code>https://www.vegvisr.org/graph/{slug}</code></li>
              <li><strong>Vue App URL:</strong> <code>https://www.vegvisr.org/gnew-viewer?graphId={id}</code></li>
              <li><strong>SEO Worker:</strong> <code>seo-worker.vegvisr.workers.dev</code></li>
              <li><strong>Meta Tags:</strong> Open Graph, Twitter Cards, JSON-LD structured data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Store
const userStore = useUserStore()

// State
const graphIdInput = ref('')
const currentGraph = ref(null)
const graphData = ref({ nodes: [], edges: [], metadata: {} })
const loading = ref(false)
const userGraphs = ref([])

// SEO Configuration
const seoConfig = ref({
  slug: '',
  title: '',
  description: '',
  ogImage: '',
  keywords: '',
})

const slugError = ref('')
const generatingDescription = ref(false)
const generating = ref(false)
const staticPageGenerated = ref(false)
const generatedURL = ref('')
const successMessage = ref('')
const errorMessage = ref('')

// Computed
const isConfigValid = computed(() => {
  return (
    seoConfig.value.slug &&
    !slugError.value &&
    seoConfig.value.description &&
    seoConfig.value.ogImage
  )
})

// Methods
const loadGraph = async () => {
  if (!graphIdInput.value.trim()) return

  loading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(
      `https://knowledge.vegvisr.org/getknowgraph?id=${graphIdInput.value.trim()}`
    )

    if (!response.ok) {
      throw new Error('Failed to load graph')
    }

    const data = await response.json()
    graphData.value = data
    currentGraph.value = graphIdInput.value.trim()

    // Auto-fill SEO config from graph metadata
    seoConfig.value.title = data.metadata?.title || ''
    seoConfig.value.description = data.metadata?.description || ''

    // Auto-generate slug from title
    if (data.metadata?.title) {
      generateSlugFromTitle()
    }

    // Try to auto-select an image
    autoSelectImageFromGraph()

    successMessage.value = 'Graph loaded successfully!'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    console.error('Error loading graph:', error)
    errorMessage.value = 'Failed to load graph: ' + error.message
  } finally {
    loading.value = false
  }
}

const selectGraph = (graphId) => {
  graphIdInput.value = graphId
  loadGraph()
}

const generateSlugFromTitle = () => {
  const title = graphData.value.metadata?.title || ''
  if (!title) return

  // Convert to lowercase, replace spaces with hyphens, remove special chars
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60) // Limit length

  seoConfig.value.slug = slug
  validateSlug()
}

const validateSlug = () => {
  const slug = seoConfig.value.slug
  slugError.value = ''

  if (!slug) {
    slugError.value = 'Slug is required'
    return false
  }

  // Check format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    slugError.value = 'Slug can only contain lowercase letters, numbers, and hyphens'
    return false
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    slugError.value = 'Slug cannot start or end with a hyphen'
    return false
  }

  return true
}

const generateAIDescription = async () => {
  if (!currentGraph.value) return

  generatingDescription.value = true
  errorMessage.value = ''

  try {
    // Call your existing AI summary service
    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/ai-summary',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphData: graphData.value,
          maxLength: 160, // SEO-optimized length
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to generate AI description')
    }

    const result = await response.json()
    seoConfig.value.description = result.summary || result.description || ''

    successMessage.value = 'AI description generated!'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    console.error('Error generating AI description:', error)
    errorMessage.value = 'Failed to generate AI description: ' + error.message
  } finally {
    generatingDescription.value = false
  }
}

const autoSelectImageFromGraph = () => {
  if (!graphData.value.nodes || graphData.value.nodes.length === 0) return

  // Find first image in nodes
  for (const node of graphData.value.nodes) {
    if (node.type === 'image' || node.type === 'markdown-image') {
      seoConfig.value.ogImage = node.path || node.url || ''
      return
    }

    // Check for images in node content (markdown)
    if (node.info && typeof node.info === 'string') {
      const imageMatch = node.info.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/)
      if (imageMatch && imageMatch[1]) {
        seoConfig.value.ogImage = imageMatch[1]
        return
      }
    }
  }

  // If no image found, you could set a default
  // seoConfig.value.ogImage = 'https://vegvisr.imgix.net/default-og-image.jpg'
}

const clearOGImage = () => {
  seoConfig.value.ogImage = ''
}

const openImageSelector = () => {
  // TODO: Integrate with your existing portfolio image selector
  alert('Image selector coming soon - for now, paste image URL or use auto-select')
}

const openCustomImageUpload = () => {
  // TODO: Integrate with your existing R2 upload system
  alert('Custom upload coming soon - for now, paste image URL or use auto-select')
}

const generateStaticPage = async () => {
  if (!isConfigValid.value) {
    errorMessage.value = 'Please complete all required fields'
    return
  }

  generating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Call the SEO Worker to generate static page
    // Use seo.vegvisr.org in production or fallback to workers.dev
    const workerUrl = import.meta.env.PROD
      ? 'https://seo.vegvisr.org/generate'
      : 'https://seo-worker.vegvisr.workers.dev/generate'

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        graphId: currentGraph.value,
        slug: seoConfig.value.slug,
        title: seoConfig.value.title,
        description: seoConfig.value.description,
        ogImage: seoConfig.value.ogImage,
        keywords: seoConfig.value.keywords,
        graphData: graphData.value,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error || 'Failed to generate static page')
    }

    await response.json()

    generatedURL.value = `https://www.vegvisr.org/graph/${seoConfig.value.slug}`
    staticPageGenerated.value = true
    successMessage.value = '✅ Static page generated successfully!'

  } catch (error) {
    console.error('Error generating static page:', error)
    errorMessage.value = 'Failed to generate static page: ' + error.message
  } finally {
    generating.value = false
  }
}

const testFacebookScraper = () => {
  if (!generatedURL.value) return

  // Open Facebook's debugger tool
  const debugUrl = `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(generatedURL.value)}`
  window.open(debugUrl, '_blank')
}

const viewStaticPage = () => {
  if (!generatedURL.value) return
  window.open(generatedURL.value, '_blank')
}

const copyStaticURL = () => {
  if (!generatedURL.value) return
  copyToClipboard(generatedURL.value)
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    successMessage.value = 'URL copied to clipboard!'
    setTimeout(() => {
      successMessage.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

// Load user's graphs on mount
onMounted(async () => {
  if (userStore.loggedIn && userStore.email) {
    try {
      // Fetch user's graphs
      const response = await fetch(
        `https://knowledge.vegvisr.org/getUserGraphs?email=${userStore.email}`
      )
      if (response.ok) {
        const data = await response.json()
        userGraphs.value = data.graphs || []
      }
    } catch (error) {
      console.error('Error loading user graphs:', error)
    }
  }
})
</script>

<style scoped>
.seo-admin {
  min-height: 100vh;
  background: #f8f9fa;
  padding-bottom: 2rem;
}

/* Header */
.seo-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem 0;
  margin-bottom: 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header-title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon {
  font-size: 2.25rem;
}

.header-subtitle {
  margin: 0.75rem 0 0 0;
  font-size: 1.15rem;
  opacity: 0.95;
}

/* Main Content */
.seo-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* Cards */
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #dee2e6;
}

.card-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2c3e50;
}

.card-body {
  padding: 1.5rem;
}

/* Graph Selector */
.graph-selector {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.graph-selector input {
  flex: 1;
}

/* Quick Graphs */
.quick-graphs {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e9ecef;
}

.quick-graphs h5 {
  margin-bottom: 1rem;
  color: #495057;
  font-size: 1rem;
  font-weight: 600;
}

.graph-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.graph-item {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.graph-item:hover {
  background: #e9ecef;
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.graph-title {
  font-weight: 600;
  color: #2c3e50;
}

.graph-id {
  font-size: 0.875rem;
  color: #6c757d;
  font-family: monospace;
}

/* Graph Info */
.graph-info {
  display: grid;
  gap: 1rem;
}

.info-row {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.info-row label {
  font-weight: 600;
  color: #495057;
  margin: 0;
}

.info-row span {
  color: #2c3e50;
}

/* Form Groups */
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #2c3e50;
}

/* URL Preview */
.url-preview-container {
  display: flex;
  align-items: center;
  gap: 0;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 0.5rem;
}

.url-base {
  padding: 0.375rem 0.75rem;
  color: #6c757d;
  font-family: monospace;
  font-size: 0.9rem;
  white-space: nowrap;
}

.slug-input {
  flex: 1;
  border: none;
  background: white;
  font-family: monospace;
  padding: 0.375rem 0.75rem;
}

/* OG Image Selection */
.og-image-selection {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.og-preview-container {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.og-preview-image {
  width: 300px;
  height: auto;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.og-preview-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.og-selection-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Social Previews */
.social-preview {
  margin-bottom: 1.5rem;
}

.social-preview h5 {
  margin-bottom: 1rem;
  color: #495057;
  font-weight: 600;
}

.preview-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  max-width: 500px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: auto;
  display: block;
}

.preview-content {
  padding: 1rem;
}

.preview-domain {
  font-size: 0.75rem;
  color: #6c757d;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.preview-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.preview-description {
  font-size: 0.875rem;
  color: #65676b;
  line-height: 1.5;
}

/* Twitter Card specific */
.twitter-card {
  max-width: 500px;
}

.twitter-card .preview-domain {
  order: 3;
  margin-top: 0.5rem;
  margin-bottom: 0;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-buttons .btn {
  padding: 0.75rem 1.5rem;
  font-weight: 600;
}

/* Generated URL Display */
.generated-url-display {
  padding: 1.5rem;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 8px;
}

.generated-url-display h5 {
  margin-bottom: 1rem;
  color: #155724;
}

.url-display {
  display: flex;
  gap: 0.5rem;
}

.url-display input {
  flex: 1;
  font-family: monospace;
}

/* Developer Info */
.dev-info {
  line-height: 1.8;
}

.dev-info h5 {
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  color: #495057;
  font-weight: 600;
}

.dev-info code {
  background: #f8f9fa;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9em;
}

.dev-info ul, .dev-info ol {
  padding-left: 1.5rem;
}

.dev-info li {
  margin-bottom: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .header-title {
    font-size: 1.75rem;
  }

  .graph-selector {
    flex-direction: column;
  }

  .info-row {
    grid-template-columns: 1fr;
  }

  .og-preview-container {
    flex-direction: column;
  }

  .og-preview-image {
    width: 100%;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-buttons .btn {
    width: 100%;
  }
}
</style>
