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

          <!-- Info when no user graphs available -->
          <div v-else-if="userStore.loggedIn" class="no-graphs-info">
            <small class="text-muted">
              💡 <strong>Tip:</strong> Enter your graph ID above (e.g., graph_1234567890) to load and generate SEO pages
            </small>
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

              <!-- Manual URL input -->
              <div class="manual-url-input">
                <label class="form-label">Or enter image URL directly:</label>
                <div class="url-input-group">
                  <input
                    v-model="seoConfig.ogImage"
                    type="url"
                    class="form-control"
                    placeholder="https://example.com/image.jpg"
                  />
                  <button
                    @click="seoConfig.ogImage = ''"
                    class="btn btn-outline-danger btn-sm"
                    :disabled="!seoConfig.ogImage"
                  >
                    Clear
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
                  🤖 Select from Graph ({{ availableGraphImages.length || 0 }} found)
                </button>
                <button @click="openImageSelector" class="btn btn-outline-secondary">
                  🖼️ Choose from Portfolio
                </button>
                <button
                  @click="openCustomImageUpload"
                  class="btn btn-outline-info"
                  :disabled="uploadingImage"
                >
                  <span v-if="uploadingImage" class="spinner-border spinner-border-sm me-1"></span>
                  {{ uploadingImage ? 'Uploading...' : '📁 Upload New Image' }}
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
            <button @click="testWorkerConnection" class="btn btn-outline-info" :disabled="testingConnection">
              <span v-if="testingConnection" class="spinner-border spinner-border-sm me-2"></span>
              {{ testingConnection ? 'Testing...' : '🔍 Test Worker Connection' }}
            </button>

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

    <!-- Image Selection Modal -->
    <div v-if="showImageSelectionModal" class="modal-overlay" @click="showImageSelectionModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Select Image from Graph</h3>
          <button @click="showImageSelectionModal = false" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="image-grid">
            <div
              v-for="(image, index) in availableGraphImages"
              :key="index"
              class="image-option"
              @click="selectImageFromGraph(image.url)"
            >
              <img :src="image.url" :alt="image.title" class="thumbnail" />
              <div class="image-info">
                <div class="image-title">{{ image.title }}</div>
                <div class="image-source">{{ image.source }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Portfolio Image Modal -->
    <div v-if="showPortfolioModal" class="modal-overlay" @click="showPortfolioModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Select from Portfolio</h3>
          <button @click="showPortfolioModal = false" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="image-grid">
            <div
              v-for="(image, index) in portfolioImages"
              :key="index"
              class="image-option"
              @click="selectPortfolioImage(image.url || image.src)"
            >
              <img :src="image.thumbnail || image.url || image.src" :alt="image.title || image.name" class="thumbnail" />
              <div class="image-info">
                <div class="image-title">{{ image.title || image.name || 'Untitled' }}</div>
                <div class="image-source">Portfolio</div>
              </div>
            </div>
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
const testingConnection = ref(false)
const staticPageGenerated = ref(false)
const generatedURL = ref('')
const successMessage = ref('')
const errorMessage = ref('')

// Image selection
const showImageSelectionModal = ref(false)
const availableGraphImages = ref([])
const showPortfolioModal = ref(false)
const portfolioImages = ref([])
const uploadingImage = ref(false)

// Computed
const isConfigValid = computed(() => {
  const hasRequiredFields = (
    seoConfig.value.slug &&
    !slugError.value &&
    seoConfig.value.description
  )

  console.log('Config validation:', {
    slug: seoConfig.value.slug,
    slugError: slugError.value,
    description: seoConfig.value.description,
    ogImage: seoConfig.value.ogImage,
    isValid: hasRequiredFields
  })

  return hasRequiredFields
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

  // Find all images in the graph
  const foundImages = []

  for (const node of graphData.value.nodes) {
    // Direct image nodes
    if (node.type === 'image' || node.type === 'markdown-image') {
      const imageUrl = node.path || node.url || ''
      if (imageUrl) {
        foundImages.push({
          url: imageUrl,
          title: node.label || node.title || 'Image',
          source: 'Direct image node'
        })
      }
    }

    // Images in markdown content
    if (node.info && typeof node.info === 'string') {
      const imageMatches = node.info.matchAll(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g)
      for (const match of imageMatches) {
        foundImages.push({
          url: match[2],
          title: match[1] || node.label || 'Image from content',
          source: `From node: ${node.label || 'Untitled'}`
        })
      }
    }

    // Images in HTML content (img tags)
    if (node.info && typeof node.info === 'string') {
      // Look for HTML img tags with src attribute
      const htmlImageMatches = node.info.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi)
      for (const match of htmlImageMatches) {
        const imageUrl = match[1]
        const altText = match[2] || ''

        // Decode HTML entities in the URL
        const decodedUrl = imageUrl.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

        foundImages.push({
          url: decodedUrl,
          title: altText || node.label || 'HTML Image',
          source: `HTML img from: ${node.label || 'Untitled'}`
        })
      }
    }

    // Check for imgix or other image URLs in various node properties
    const checkProperties = ['path', 'url', 'src', 'image', 'thumbnail']
    for (const prop of checkProperties) {
      if (node[prop] && typeof node[prop] === 'string' && node[prop].match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) {
        foundImages.push({
          url: node[prop],
          title: node.label || node.title || 'Image',
          source: `Property: ${prop}`
        })
      }
    }
  }

  // If we found images, show selection modal
  if (foundImages.length > 0) {
    availableGraphImages.value = foundImages
    showImageSelectionModal.value = true
  } else {
    // Set a default image if no images found
    seoConfig.value.ogImage = 'https://vegvisr.imgix.net/default-og-image.jpg'
    successMessage.value = 'No images found in graph, using default image'
    setTimeout(() => { successMessage.value = '' }, 3000)
  }
}

const clearOGImage = () => {
  seoConfig.value.ogImage = ''
}

const selectImageFromGraph = (imageUrl) => {
  seoConfig.value.ogImage = imageUrl
  showImageSelectionModal.value = false
  successMessage.value = 'Image selected successfully!'
  setTimeout(() => { successMessage.value = '' }, 3000)
}

const openImageSelector = async () => {
  try {
    // Load portfolio images from your existing API
    const response = await fetch('https://vegvisr.imgix.net/api/images') // Adjust URL as needed
    if (response.ok) {
      portfolioImages.value = await response.json()
      showPortfolioModal.value = true
    } else {
      // Fallback: show manual input
      const url = prompt('Enter image URL:')
      if (url && url.startsWith('http')) {
        seoConfig.value.ogImage = url
        successMessage.value = 'Image URL added successfully!'
        setTimeout(() => { successMessage.value = '' }, 3000)
      }
    }
  } catch (error) {
    console.error('Error loading portfolio:', error)
    // Fallback: show manual input
    const url = prompt('Enter image URL:')
    if (url && url.startsWith('http')) {
      seoConfig.value.ogImage = url
      successMessage.value = 'Image URL added successfully!'
      setTimeout(() => { successMessage.value = '' }, 3000)
    }
  }
}

const selectPortfolioImage = (imageUrl) => {
  seoConfig.value.ogImage = imageUrl
  showPortfolioModal.value = false
  successMessage.value = 'Portfolio image selected!'
  setTimeout(() => { successMessage.value = '' }, 3000)
}

const openCustomImageUpload = () => {
  // Create a file input element
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    uploadingImage.value = true
    try {
      // TODO: Replace with your actual R2 upload endpoint
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        seoConfig.value.ogImage = result.url
        successMessage.value = 'Image uploaded successfully!'
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      errorMessage.value = 'Failed to upload image: ' + error.message
    } finally {
      uploadingImage.value = false
    }
  }
  input.click()
}

const testWorkerConnection = async () => {
  testingConnection.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    console.log('Testing worker connection...')
    const response = await fetch('https://seo.vegvisr.org/health')

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    console.log('Health check result:', result)

    successMessage.value = `✅ Worker connection successful! Status: ${result.status}`

  } catch (error) {
    console.error('Worker connection failed:', error)
    errorMessage.value = `❌ Worker connection failed: ${error.message}`
  } finally {
    testingConnection.value = false
  }
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
    const workerUrl = 'https://seo.vegvisr.org/generate'

    console.log('Sending request to:', workerUrl)
    console.log('Request payload:', {
      graphId: currentGraph.value,
      slug: seoConfig.value.slug,
      title: seoConfig.value.title || graphData.value.metadata?.title,
      description: seoConfig.value.description,
      ogImage: seoConfig.value.ogImage,
      keywords: seoConfig.value.keywords,
      graphData: graphData.value,
    })

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        graphId: currentGraph.value,
        slug: seoConfig.value.slug,
        title: seoConfig.value.title || graphData.value.metadata?.title || 'Untitled Graph',
        description: seoConfig.value.description,
        ogImage: seoConfig.value.ogImage,
        keywords: seoConfig.value.keywords,
        graphData: graphData.value,
      }),
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      let errorText
      try {
        const errorData = await response.json()
        errorText = errorData.error || errorData.message || 'Unknown error'
      } catch {
        errorText = await response.text()
      }
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('Response data:', result)

    generatedURL.value = result.url || `https://seo.vegvisr.org/graph/${seoConfig.value.slug}`
    staticPageGenerated.value = true
    successMessage.value = '✅ Static page generated successfully!'

  } catch (error) {
    console.error('Error generating static page:', error)
    errorMessage.value = 'Failed to generate static page: ' + error.message

    // Additional debugging info
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage.value += ' (Network error - check if worker is deployed and accessible)'
    }
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
      // Fetch user's graphs with CORS handling
      const response = await fetch(
        `https://knowledge.vegvisr.org/getknowgraphs`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          mode: 'cors'
        }
      )

      if (response.ok) {
        const data = await response.json()
        userGraphs.value = data.results || []
        console.log(`Loaded ${userGraphs.value.length} user graphs`)
      } else {
        console.warn('Failed to load user graphs:', response.status, response.statusText)
      }
    } catch (error) {
      console.warn('User graphs not available (CORS or network issue):', error.message)
      // This is not a critical error - user can still manually enter graph IDs
      // Don't show error to user as it's an optional feature
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

/* No graphs info */
.no-graphs-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #17a2b8;
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

/* Manual URL Input */
.manual-url-input {
  margin-bottom: 1rem;
}

.url-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.url-input-group input {
  flex: 1;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6c757d;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background: #e9ecef;
  color: #2c3e50;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 60vh;
}

/* Image Grid */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.image-option {
  border: 2px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;
}

.image-option:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.image-option .thumbnail {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}

.image-info {
  padding: 0.75rem;
}

.image-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-source {
  font-size: 0.75rem;
  color: #6c757d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Loading States */
.spinner-border-sm {
  width: 0.875rem;
  height: 0.875rem;
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

  .url-input-group {
    flex-direction: column;
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .modal-content {
    margin: 1rem;
    max-height: 90vh;
  }
}
</style>
