<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="share-modal" @click.stop>
      <div class="modal-header">
        <h5 class="modal-title">Share Knowledge Graph</h5>
        <button type="button" class="btn-close" @click="closeModal">&times;</button>
      </div>

      <div class="modal-body">
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
        </div>

        <!-- AI Share Success Message -->
        <div v-if="aiShareSuccess" class="alert alert-success mt-3" role="alert">
          <i class="bi bi-check-circle"></i> AI crawlable page link copied to clipboard!
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
const aiShareSuccess = ref(false)

// Methods
const closeModal = () => {
  emit('close')
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
      const shareUrl = `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`
      shareContent.value = `${data.summary}\n\n${shareUrl}`

      console.log('AI-generated share summary:', data.summary)
      console.log('Used model:', data.model)
      console.log('Share URL with branded domain:', shareUrl)
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

    shareContent.value =
      `${graphTitle}\n\n` +
      `${graphDescription}\n\n` +
      `Nodes: ${nodeCount}\n` +
      `Edges: ${edgeCount}\n` +
      `${categoryText}\n\n` +
      `View this knowledge graph: https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`
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
  const url = encodeURIComponent(
    `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`,
  )

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}&summary=${summary}`
  window.open(linkedInUrl, '_blank', 'width=600,height=400')
}

const shareToTwitter = () => {
  const title = shareContent.value.split('\n')[0]
  const url = `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`

  // Twitter has a 280 character limit, so we'll create a shorter message
  const tweetText = encodeURIComponent(`${title}\n\nView this knowledge graph: ${url}`)
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`
  window.open(twitterUrl, '_blank', 'width=600,height=400')
}

const shareToFacebook = () => {
  const url = encodeURIComponent(
    `https://${props.currentDomain}/gnew-viewer?graphId=${props.currentGraphId}`,
  )
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
  window.open(facebookUrl, '_blank', 'width=600,height=400')
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

    console.log('AI crawlable page link copied to clipboard:', publicUrl)
  } catch (error) {
    console.error('Failed to copy AI link to clipboard:', error)

    // Fallback: show the link in an alert
    const publicUrl = `https://knowledge.vegvisr.org/public-graph?id=${props.currentGraphId}`
    alert(`AI Crawlable Page Link (please copy manually):\n\n${publicUrl}`)
  }
}

// Generate content when component mounts
onMounted(() => {
  generateShareContent()

  // Debug AI Share button visibility
  console.log('ShareModal: AI Share available =', showAIShareComputed.value)
})

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

.ai-btn {
  border-color: #28a745;
  color: #28a745;
}

.ai-btn:hover:not(:disabled) {
  background-color: #28a745;
  color: white;
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
