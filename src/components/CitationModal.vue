<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="citation-modal" @click.stop>
      <div class="modal-header">
        <h3>📖 APA Citation</h3>
        <button @click="closeModal" class="btn-close">&times;</button>
      </div>

      <div class="modal-body">
        <div class="citation-section">
          <h4>Formatted Citation:</h4>
          <div class="citation-box">
            <pre class="citation-text">{{ formattedCitation }}</pre>
            <button @click="copyCitation" class="copy-btn" :disabled="copying">
              <i class="fas fa-copy"></i>
              {{ copying ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>

        <div class="citation-details">
          <h4>Citation Details:</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <strong>Author:</strong>
              <span>{{ citationData.author }}</span>
            </div>
            <div class="detail-item">
              <strong>Title:</strong>
              <span>{{ citationData.title }}</span>
            </div>
            <div class="detail-item">
              <strong>Website:</strong>
              <span>{{ citationData.websiteName }}</span>
            </div>
            <div class="detail-item">
              <strong>URL:</strong>
              <span class="url-text">{{ citationData.url }}</span>
            </div>
            <div class="detail-item">
              <strong>Access Date:</strong>
              <span>{{ citationData.accessDate }}</span>
            </div>
            <div class="detail-item" v-if="citationData.publishDate">
              <strong>Published:</strong>
              <span>{{ citationData.publishDate }}</span>
            </div>
          </div>
        </div>

        <div class="citation-note">
          <p>
            <strong>Note:</strong> This citation follows APA 7th edition format for webpages. Please
            verify all details before using in academic work.
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="copyCitation" class="btn btn-primary" :disabled="copying">
          <i class="fas fa-clipboard"></i>
          {{ copying ? 'Citation Copied!' : 'Copy Citation' }}
        </button>
        <button @click="closeModal" class="btn btn-secondary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useBranding } from '@/composables/useBranding'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  graphData: {
    type: Object,
    required: true,
  },
  graphId: {
    type: String,
    required: true,
  },
  graphMetadata: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['close'])

const { currentSiteTitle, currentDomain } = useBranding()
const copying = ref(false)

// Citation data computation
const citationData = computed(() => {
  const metadata = props.graphMetadata || {}
  const currentDate = new Date()

  // Format author (handle multiple scenarios)
  let author = metadata.createdBy || 'Anonymous'
  if (author && author !== 'Unknown' && author !== 'Anonymous') {
    // Convert email to proper name format if needed
    if (author.includes('@')) {
      const namePart = author.split('@')[0]
      author = namePart
        .replace(/[._]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(', ')
    }
  } else {
    author = 'Anonymous'
  }

  // Format title
  const title = metadata.title || 'Untitled Knowledge Graph'

  // Website name from branding
  const websiteName = currentSiteTitle.value || 'Vegvisr'

  // URL with current domain
  const url = `https://${currentDomain.value}/gnew-viewer?graphId=${props.graphId}`

  // Access date (today)
  const accessDate = currentDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Publication date (if available)
  let publishDate = null
  if (metadata.created_date || metadata.createdAt) {
    const pubDate = new Date(metadata.created_date || metadata.createdAt)
    publishDate = pubDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return {
    author,
    title,
    websiteName,
    url,
    accessDate,
    publishDate,
  }
})

// Formatted APA citation
const formattedCitation = computed(() => {
  const { author, title, websiteName, url, accessDate, publishDate } = citationData.value

  let citation = `${author}.`

  if (publishDate) {
    const pubYear = new Date(publishDate).getFullYear()
    citation += ` (${pubYear}, ${publishDate}).`
  } else {
    citation += ' (n.d.).'
  }

  citation += ` ${title}. ${websiteName}. Retrieved ${accessDate}, from ${url}`

  return citation
})

// Methods
const copyCitation = async () => {
  try {
    copying.value = true
    await navigator.clipboard.writeText(formattedCitation.value)

    // Track citation copy event
    await trackCitationEvent('copy')

    setTimeout(() => {
      copying.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy citation:', error)
    copying.value = false

    // Fallback: show citation in alert
    alert(`Citation copied to clipboard:\n\n${formattedCitation.value}`)
  }
}

const trackCitationEvent = async (eventType) => {
  try {
    // Only track for logged-in users
    const userStore = useUserStore()
    if (!userStore.loggedIn || !userStore.user_id) return

    await fetch('https://social-worker.torarnehave.workers.dev/track-citation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        userId: userStore.user_id,
        citationType: eventType,
        citationData: {
          citation: formattedCitation.value,
          websiteName: citationData.value.websiteName,
          accessDate: citationData.value.accessDate,
        },
      }),
    })
  } catch (error) {
    console.log('Citation tracking failed (non-critical):', error)
  }
}

const closeModal = () => {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1050;
}

.citation-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #495057;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #e9ecef;
  color: #495057;
}

.modal-body {
  padding: 2rem;
}

.citation-section {
  margin-bottom: 2rem;
}

.citation-section h4 {
  color: #495057;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.citation-box {
  position: relative;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.citation-text {
  font-family: 'Georgia', serif;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  color: #212529;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.copy-btn:hover:not(:disabled) {
  background: #0056b3;
}

.copy-btn:disabled {
  background: #28a745;
  cursor: not-allowed;
}

.citation-details h4 {
  color: #495057;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.detail-grid {
  display: grid;
  gap: 1rem;
}

.detail-item {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.detail-item strong {
  color: #495057;
  font-weight: 600;
}

.detail-item span {
  color: #212529;
}

.url-text {
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9em;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.citation-note {
  margin-top: 2rem;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  border-left: 4px solid #ffc107;
}

.citation-note p {
  margin: 0;
  color: #856404;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #28a745;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .citation-modal {
    width: 95%;
    margin: 1rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .detail-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
