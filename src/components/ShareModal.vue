<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="share-modal" @click.stop>
      <div class="modal-header">
        <h5 class="modal-title">Share Knowledge Graph</h5>
        <button type="button" class="btn-close" @click="closeModal">&times;</button>
      </div>

      <div class="modal-body">
        <div class="mb-3" v-if="props.graphData?.metadata?.seoSlug">
          <label class="form-label">Share Type</label>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="shareType"
              id="shareTypeSEO"
              value="seo"
              v-model="shareType"
              @change="updateShareType"
            />
            <label class="form-check-label" for="shareTypeSEO">
              <strong>📄 Static SEO Page</strong> - Optimized for social media with rich previews
            </label>
          </div>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="shareType"
              id="shareTypeDynamic"
              value="dynamic"
              v-model="shareType"
              @change="updateShareType"
            />
            <label class="form-check-label" for="shareTypeDynamic">
              <strong>🔗 Interactive Graph</strong> - Dynamic experience in the app
            </label>
          </div>
        </div>
        <div class="mb-3">
          <label for="shareContent" class="form-label">
            Share Content
            <span v-if="shareContent.includes('Generating')" class="text-muted">
              <i class="bi bi-hourglass-split"></i> AI is creating an engaging summary...
            </span>
          </label>
          <textarea
            class="form-control"
            id="shareContent"
            rows="6"
            v-model="shareContent"
            readonly
            :class="{ 'text-muted': shareContent.includes('Generating') }"
          ></textarea>
        </div>

        <div class="share-buttons d-flex gap-2 justify-content-center flex-wrap">
          <button
            class="btn btn-outline-primary share-btn instagram-btn"
            @click="shareToInstagram"
            :disabled="shareContent.includes('Generating')"
            title="Share to Instagram"
          >
            <i class="bi bi-instagram"></i> Instagram
          </button>
          <button
            class="btn btn-outline-primary share-btn linkedin-btn"
            @click="shareToLinkedIn"
            :disabled="shareContent.includes('Generating')"
            title="Share to LinkedIn"
          >
            <i class="bi bi-linkedin"></i> LinkedIn
          </button>
          <button
            class="btn btn-outline-primary share-btn twitter-btn"
            @click="shareToTwitter"
            :disabled="shareContent.includes('Generating')"
            title="Share to Twitter"
          >
            <i class="bi bi-twitter-x"></i> Twitter
          </button>
          <button
            class="btn btn-outline-primary share-btn facebook-btn"
            @click="shareToFacebook"
            :disabled="shareContent.includes('Generating')"
            title="Share to Facebook"
          >
            <i class="bi bi-facebook"></i> Facebook
          </button>
          <button
            class="btn btn-outline-success share-btn sms-btn"
            @click="shareViaSMS"
            :disabled="shareContent.includes('Generating')"
            title="Share via SMS"
          >
            <i class="bi bi-chat-dots"></i> SMS
          </button>
          <button
            class="btn btn-outline-primary share-btn email-btn"
            @click="shareViaEmail"
            :disabled="shareContent.includes('Generating') || !props.graphData?.metadata?.seoSlug"
            :title="props.graphData?.metadata?.seoSlug ? 'Share via Email' : 'Generate an SEO page before sharing via email'"
          >
            <i class="bi bi-envelope"></i> Email
          </button>

          <!-- NEW: Share to AI button (superadmin only) -->
          <button
            v-if="showAIShareComputed"
            class="btn btn-outline-success share-btn ai-btn"
            @click="shareToAI"
            :disabled="shareContent.includes('Generating')"
            title="Copy public webpage link that AI systems can crawl"
          >
            <i class="bi bi-robot"></i> Share to AI
          </button>

          <!-- NEW: Share to Hallo Vegvisr Chat -->
          <button
            v-if="userStore.loggedIn"
            class="btn btn-outline-primary share-btn hallo-btn"
            @click="shareToHalloVegvisr"
            :disabled="shareContent.includes('Generating')"
            title="Share to Hallo Vegvisr Chat"
          >
            <i class="bi bi-chat-dots"></i> Hallo Vegvisr
          </button>
        </div>

        <div class="linkedin-share-section mt-4">
          <h6 class="section-title">
            <i class="bi bi-linkedin"></i> Post to LinkedIn
          </h6>
          <p class="text-muted small">
            Uses your SEO page to create a rich LinkedIn card.
          </p>

          <div v-if="!props.graphData?.metadata?.seoSlug" class="alert alert-info mb-3">
            Generate an SEO page for this graph before posting to LinkedIn.
          </div>

          <div v-else-if="!userStore.email" class="alert alert-warning mb-3">
            Sign in to connect LinkedIn and publish this graph.
          </div>

          <div v-else-if="!linkedinConnected" class="alert alert-info mb-3">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span>Connect your LinkedIn account to publish this graph.</span>
              <button @click="connectLinkedIn" class="btn btn-outline-primary btn-sm">
                <i class="bi bi-linkedin"></i> Connect LinkedIn
              </button>
            </div>
          </div>

          <div v-else class="linkedin-share-controls">
            <div class="form-group mb-3">
              <label class="form-label">Audience</label>
              <select v-model="linkedinVisibility" class="form-select" disabled>
                <option value="CONNECTIONS">Connections only (private)</option>
              </select>
            </div>

            <div class="form-group mb-3">
              <label class="form-label">Commentary (optional)</label>
              <textarea
                v-model="linkedinCommentary"
                class="form-control"
                rows="3"
                maxlength="1300"
                placeholder="Add a short intro before the graph link..."
              ></textarea>
              <small class="text-muted">{{ linkedinCommentary.length }}/1300 characters</small>
            </div>

            <button
              class="btn btn-linkedin w-100"
              @click="shareToLinkedInWorker"
              :disabled="sharingToLinkedIn"
            >
              <span v-if="sharingToLinkedIn" class="spinner-border spinner-border-sm me-2"></span>
              {{ sharingToLinkedIn ? 'Posting...' : 'Publish to LinkedIn' }}
            </button>

            <div v-if="linkedinShareSuccess" class="alert alert-success mt-3">
              LinkedIn post created.
              <a v-if="linkedinPostUrl" :href="linkedinPostUrl" target="_blank" class="btn btn-sm btn-outline-success ms-2">
                View post
              </a>
            </div>

            <div v-if="linkedinErrorMessage" class="alert alert-danger mt-3" style="white-space: pre-line;">
              {{ linkedinErrorMessage }}
            </div>
          </div>
        </div>

        <!-- AI Share Success Message -->
        <div v-if="aiShareSuccess" class="alert alert-success mt-3" role="alert">
          <i class="bi bi-check-circle"></i> AI crawlable page link copied! AI systems can now read
          the full graph content, including node details, connections, and metadata.
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  graphData: {
    type: Object,
    required: true,
    default: () => ({ nodes: [], edges: [] }),
  },
  currentGraphId: {
    type: String,
    required: true,
  },
  currentDomain: {
    type: String,
    required: true,
  },
  showAIShare: {
    type: Boolean,
    default: false,
  },
})

// Events
const emit = defineEmits(['close'])

// Import userStore directly to avoid prop-passing issues
const userStore = useUserStore()

// Computed property to determine if AI share should be shown
const showAIShareComputed = computed(() => {
  return userStore.role === 'Superadmin'
})

// Reactive data
const shareContent = ref('')
const shareType = ref('dynamic') // Default to dynamic sharing
const aiShareSuccess = ref(false)
const linkedinConnected = ref(false)
const linkedinVisibility = ref('CONNECTIONS')
const linkedinCommentary = ref('')
const linkedinShareSuccess = ref(false)
const linkedinPostUrl = ref('')
const linkedinErrorMessage = ref('')
const sharingToLinkedIn = ref(false)

const primaryLinkedInBaseUrl = 'https://linkedin.vegvisr.org'
const fallbackLinkedInBaseUrl = 'https://linkedin-worker.torarnehave.workers.dev'

const requestLinkedIn = async (path, options = {}) => {
  const primaryUrl = `${primaryLinkedInBaseUrl}${path}`
  try {
    return await fetch(primaryUrl, options)
  } catch (error) {
    console.warn('LinkedIn primary host failed, retrying with fallback:', error)
    const fallbackUrl = `${fallbackLinkedInBaseUrl}${path}`
    return await fetch(fallbackUrl, options)
  }
}

// Methods
const closeModal = () => {
  emit('close')
}

const updateShareType = () => {
  // Regenerate share content when share type changes
  generateShareContent()
}

const getShareUrl = () => {
  if (shareType.value === 'seo' && props.graphData?.metadata?.seoSlug) {
    return `https://seo.vegvisr.org/graph/${props.graphData.metadata.seoSlug}`
  } else {
    return `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`
  }
}

const generateShareContent = async () => {
  shareContent.value = 'Generating engaging summary... Please wait.'

  try {
    // Get graph metadata
    const graphMetadata = props.graphData.metadata || {}

    // Call AI endpoint to generate engaging summary
    const response = await fetch(
      'https://knowledge-graph-worker.torarnehave.workers.dev/generate-share-summary',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphData: props.graphData,
          graphMetadata: graphMetadata,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to generate summary: ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.summary) {
      // Use AI-generated engaging summary with branded domain
      const shareUrl = getShareUrl()
      shareContent.value = `${data.summary}\n\n${shareUrl}`

      console.log('AI-generated share summary:', data.summary)
      console.log('Used model:', data.model)
      console.log('Share URL:', shareUrl)
    } else {
      throw new Error('AI response was not successful')
    }
  } catch (error) {
    console.error('Error generating AI summary:', error)

    // Fallback to basic summary if AI fails
    const nodeCount = Array.isArray(props.graphData.nodes) ? props.graphData.nodes.length : 0
    const edgeCount = Array.isArray(props.graphData.edges) ? props.graphData.edges.length : 0
    const graphMetadata = props.graphData.metadata || {}
    const graphTitle = graphMetadata.title || 'Untitled Graph'
    const graphDescription = graphMetadata.description || ''
    const categories = graphMetadata.category || ''
    const categoryText = categories ? `Categories: ${categories}` : ''

    const shareUrl = getShareUrl()
    const shareLabel = shareType.value === 'seo' && props.graphData?.metadata?.seoSlug
      ? 'View this SEO-optimized knowledge graph: '
      : 'View this knowledge graph: '

    shareContent.value =
      `${graphTitle}\n\n` +
      `${graphDescription}\n\n` +
      `Nodes: ${nodeCount}\n` +
      `Edges: ${edgeCount}\n` +
      `${categoryText}\n\n` +
      `${shareLabel}${shareUrl}`
  }
}

const shareToInstagram = () => {
  const instagramUrl = `https://www.instagram.com/create/story`
  window.open(instagramUrl, '_blank', 'width=600,height=400')

  // Show a message to the user
  alert('Please copy the text from the text area above and paste it into your Instagram story.')
}

const shareToLinkedIn = () => {
  const title = encodeURIComponent(shareContent.value.split('\n')[0])
  const summary = encodeURIComponent(shareContent.value)
  const url = encodeURIComponent(getShareUrl())

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`
  window.open(linkedInUrl, '_blank', 'width=600,height=400')
}

const shareToTwitter = () => {
  const title = shareContent.value.split('\n')[0]
  const url = getShareUrl()

  // Twitter has a 280 character limit, so we'll create a shorter message
  const tweetText = encodeURIComponent(`${title}\n\nView this knowledge graph: ${url}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`
  window.open(twitterUrl, '_blank', 'width=600,height=400')
}

const shareToFacebook = () => {
  const url = encodeURIComponent(getShareUrl())
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
}

const shareViaSMS = () => {
  // Navigate to SMS sharing page with the share content
  const url = getShareUrl()
  const smsPageUrl = `/sms-share?content=${encodeURIComponent(shareContent.value)}&url=${encodeURIComponent(url)}&graphId=${props.currentGraphId}`
  window.location.href = smsPageUrl
}

const shareViaEmail = () => {
  if (!props.graphData?.metadata?.seoSlug) {
    alert('Generate an SEO page before sharing via email.')
    return
  }
  const url = getShareUrl()
  const emailPageUrl = `/send-gmail-email?content=${encodeURIComponent(shareContent.value)}&url=${encodeURIComponent(url)}&graphId=${props.currentGraphId}`
  window.location.href = emailPageUrl
}

const shareToAI = async () => {
  try {
    // Create public HTML page link for AI systems to crawl
    const publicUrl = `https://knowledge.vegvisr.org/public-graph?id=${props.currentGraphId}`

    // Copy to clipboard
    await navigator.clipboard.writeText(publicUrl)

    // Show success message
    aiShareSuccess.value = true

    // Hide success message after 3 seconds
    setTimeout(() => {
      aiShareSuccess.value = false
    }, 3000)

    console.log('AI link copied:', publicUrl)
  } catch (error) {
    console.error('Failed to copy AI link to clipboard:', error)

    // Fallback: show the link in an alert
    const publicUrl = `https://knowledge.vegvisr.org/public-graph?id=${props.currentGraphId}`
    alert(`AI Crawlable Page Link (please copy manually):\n\n${publicUrl}`)
  }
}

const shareToHalloVegvisr = () => {
  // Navigate to the new share page with graph data
  const shareUrl = getShareUrl()
  const sharePageUrl = `/share-to-hallo-vegvisr?graphId=${props.currentGraphId}&shareUrl=${encodeURIComponent(shareUrl)}&shareContent=${encodeURIComponent(shareContent.value)}&shareType=${shareType.value}`
  window.location.href = sharePageUrl
}

const checkLinkedInStatus = async () => {
  if (!userStore.email) return

  try {
    const response = await requestLinkedIn('/auth/status', {
      headers: {
        'x-user-email': userStore.email,
      },
    })
    const data = await response.json()
    linkedinConnected.value = Boolean(data.connected)

  } catch (error) {
    console.error('Error checking LinkedIn status:', error)
  }
}

const connectLinkedIn = () => {
  const returnUrl = encodeURIComponent(window.location.href)
  window.location.href = `https://auth.vegvisr.org/auth/linkedin/login?return_url=${returnUrl}`
}

const shareToLinkedInWorker = async () => {
  linkedinErrorMessage.value = ''
  linkedinShareSuccess.value = false
  linkedinPostUrl.value = ''

  if (!userStore.email) {
    linkedinErrorMessage.value = 'Sign in to publish to LinkedIn.'
    return
  }

  if (!props.graphData?.metadata?.seoSlug) {
    linkedinErrorMessage.value = 'Generate an SEO page before posting to LinkedIn.'
    return
  }

  sharingToLinkedIn.value = true

  try {
    const response = await requestLinkedIn('/share/article', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userStore.email,
      },
      body: JSON.stringify({
        userEmail: userStore.email,
        graphId: props.currentGraphId,
        seoSlug: props.graphData.metadata.seoSlug,
        shareCommentary: linkedinCommentary.value,
        visibility: linkedinVisibility.value,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      // Use detailed message if available, otherwise fallback to error
      const errorMsg = result.message || result.error || 'LinkedIn publish failed.'
      throw new Error(errorMsg)
    }

    linkedinShareSuccess.value = true
    linkedinPostUrl.value = result.postUrl || ''
    linkedinCommentary.value = ''
  } catch (error) {
    linkedinErrorMessage.value = error.message
  } finally {
    sharingToLinkedIn.value = false
  }
}

// Generate content when component mounts
onMounted(() => {
  // Set default share type based on whether SEO slug exists
  shareType.value = props.graphData?.metadata?.seoSlug ? 'seo' : 'dynamic'
  generateShareContent()
})

watch(
  () => userStore.email,
  (email) => {
    if (email) {
      checkLinkedInStatus()
    }
  },
  { immediate: true },
)

// Watch for changes in graphId to regenerate content
watch(
  () => props.currentGraphId,
  () => {
    if (props.currentGraphId) {
      generateShareContent()
    }
  },
)
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
  z-index: 1050;
}

.share-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px 15px;
  border-bottom: 1px solid #dee2e6;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.btn-close:hover {
  background-color: #f8f9fa;
}

.modal-body {
  padding: 25px;
}

.form-label {
  font-weight: 600;
  color: #555;
  margin-bottom: 8px;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.share-buttons {
  margin-top: 20px;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.share-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.share-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.instagram-btn {
  border-color: #e4405f;
  color: #e4405f;
}

.instagram-btn:hover:not(:disabled) {
  background-color: #e4405f;
  color: white;
}

.linkedin-btn {
  border-color: #0077b5;
  color: #0077b5;
}

.linkedin-btn:hover:not(:disabled) {
  background-color: #0077b5;
  color: white;
}

.twitter-btn {
  border-color: #1da1f2;
  color: #1da1f2;
}

.twitter-btn:hover:not(:disabled) {
  background-color: #1da1f2;
  color: white;
}

.facebook-btn {
  border-color: #1877f2;
  color: #1877f2;
}

.facebook-btn:hover:not(:disabled) {
  background-color: #1877f2;
  color: white;
}

.sms-btn {
  border-color: #28a745;
  color: #28a745;
}

.sms-btn:hover:not(:disabled) {
  background-color: #28a745;
  color: white;
}

.email-btn {
  border-color: #0d6efd;
  color: #0d6efd;
}

.email-btn:hover:not(:disabled) {
  background-color: #0d6efd;
  color: white;
}

.ai-btn {
  border-color: #28a745;
  color: #28a745;
}

.ai-btn:hover:not(:disabled) {
  background-color: #28a745;
  color: white;
}

.hallo-btn {
  border-color: #007bff;
  color: #007bff;
}

.hallo-btn:hover:not(:disabled) {
  background-color: #007bff;
  color: white;
}

.linkedin-share-section {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.btn-linkedin {
  background-color: #0077b5;
  border: none;
  color: #fff;
  font-weight: 600;
}

.btn-linkedin:hover:not(:disabled) {
  background-color: #00629a;
}

.btn-linkedin:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding: 15px 25px 25px;
  border-top: 1px solid #dee2e6;
}

.text-muted {
  color: #6c757d;
}

@media (max-width: 768px) {
  .share-buttons {
    justify-content: center;
  }

  .share-btn {
    flex: 1;
    min-width: 0;
    justify-content: center;
  }
}
</style>
