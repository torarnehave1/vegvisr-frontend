<template>
  <div class="social-interaction-bar">
    <div class="engagement-stats" v-if="showStats">
      <div class="stats-row">
        <span v-for="(count, type) in displayStats" :key="type" class="stat-item">
          {{ engagementConfig[type]?.icon }} {{ count }}
        </span>
      </div>
    </div>

    <div class="engagement-buttons">
      <button
        v-for="engagement in engagementButtons"
        :key="engagement.type"
        @click="handleEngagementClick(engagement)"
        :class="[
          'engagement-btn',
          engagement.color,
          { active: userEngagements.includes(engagement.type) },
        ]"
        :title="engagement.label"
      >
        <span class="icon">{{ engagement.icon }}</span>
        <span class="label">{{ engagement.label }}</span>
        <span v-if="engagementStats[engagement.type]" class="count">
          {{ engagementStats[engagement.type] }}
        </span>
      </button>
    </div>

    <!-- Commentary Modal for Building/Question/Repost -->
    <div v-if="showCommentaryModal" class="modal-overlay" @click="closeCommentaryModal">
      <div class="commentary-modal" @click.stop>
        <h3>{{ modalTitle }}</h3>
        <textarea
          v-model="commentary"
          :placeholder="modalPlaceholder"
          rows="4"
          maxlength="500"
        ></textarea>
        <div class="modal-actions">
          <button @click="closeCommentaryModal" class="btn-cancel">Cancel</button>
          <button @click="submitWithCommentary" class="btn-submit" :disabled="!commentary.trim()">
            {{ modalSubmitText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  graphId: {
    type: String,
    required: true,
  },
  showStats: {
    type: Boolean,
    default: true,
  },
})

const userStore = useUserStore()

// Reactive state
const engagementStats = ref({})
const userEngagements = ref([])
const isLoading = ref(false)
const showCommentaryModal = ref(false)
const commentary = ref('')
const pendingEngagement = ref(null)

// Enhanced Professional Engagement Configuration
const engagementConfig = {
  insightful: { icon: '💡', label: 'Insightful', color: 'primary', requiresComment: false },
  inspired: { icon: '✨', label: 'Inspiring', color: 'warning', requiresComment: false },
  learning: { icon: '📚', label: 'Learning', color: 'info', requiresComment: false },
  bookmark: { icon: '📎', label: 'Bookmark', color: 'secondary', requiresComment: false },
  building: { icon: '🏗️', label: 'Building On', color: 'success', requiresComment: true },
  validating: { icon: '✅', label: 'Validates', color: 'success', requiresComment: false },
  repost: { icon: '🔄', label: 'Repost', color: 'primary', requiresComment: true },
  question: { icon: '❓', label: 'Question', color: 'primary', requiresComment: true },
  citing: { icon: '📖', label: 'Citing', color: 'secondary', requiresComment: false },
}

const engagementButtons = computed(() => {
  return Object.entries(engagementConfig).map(([type, config]) => ({
    type,
    ...config,
  }))
})

const displayStats = computed(() => {
  return Object.fromEntries(Object.entries(engagementStats.value).filter(([_, count]) => count > 0))
})

const modalTitle = computed(() => {
  if (!pendingEngagement.value) return ''
  const config = engagementConfig[pendingEngagement.value]
  switch (pendingEngagement.value) {
    case 'building':
      return `Building on this insight`
    case 'question':
      return `Ask about this approach`
    case 'repost':
      return `Share with your network`
    default:
      return config.label
  }
})

const modalPlaceholder = computed(() => {
  switch (pendingEngagement.value) {
    case 'building':
      return 'Describe how you plan to build on this concept...'
    case 'question':
      return 'What aspects would you like to discuss?'
    case 'repost':
      return 'Add your professional commentary...'
    default:
      return 'Add your comment...'
  }
})

const modalSubmitText = computed(() => {
  switch (pendingEngagement.value) {
    case 'building':
      return 'Mark as Building On'
    case 'question':
      return 'Ask Question'
    case 'repost':
      return 'Repost to Network'
    default:
      return 'Submit'
  }
})

// Methods
const handleEngagementClick = async (engagement) => {
  if (engagement.requiresComment) {
    pendingEngagement.value = engagement.type
    commentary.value = ''
    showCommentaryModal.value = true
  } else {
    await submitEngagement(engagement.type)
  }
}

const submitEngagement = async (engagementType, commentaryText = null) => {
  try {
    isLoading.value = true

    const response = await fetch('https://social.vegvisr.org/engage-graph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        userId: userStore.user_id,
        engagementType: engagementType,
        commentary: commentaryText,
      }),
    })

    if (response.ok) {
      await fetchEngagementData()
      showSuccessMessage(`${engagementConfig[engagementType].label} engagement updated!`)
    } else {
      throw new Error('Failed to update engagement')
    }
  } catch (error) {
    console.error('Error updating engagement:', error)
    showErrorMessage('Failed to update engagement')
  } finally {
    isLoading.value = false
  }
}

const submitWithCommentary = async () => {
  if (!commentary.value.trim()) return

  await submitEngagement(pendingEngagement.value, commentary.value.trim())
  closeCommentaryModal()
}

const closeCommentaryModal = () => {
  showCommentaryModal.value = false
  pendingEngagement.value = null
  commentary.value = ''
}

const fetchEngagementData = async () => {
  try {
    // Fetch engagement statistics
    const statsResponse = await fetch(
      `https://social.vegvisr.org/graph-engagement?graphId=${props.graphId}`,
    )
    const statsData = await statsResponse.json()
    engagementStats.value = statsData.engagements || {}

    // Fetch user's engagements for this graph
    const userResponse = await fetch(
      `https://social.vegvisr.org/user-engagements?userId=${userStore.user_id}`,
    )
    const userData = await userResponse.json()

    userEngagements.value =
      userData.engagements
        ?.filter((e) => e.graph_id === props.graphId)
        ?.map((e) => e.insight_type) || []
  } catch (error) {
    console.error('Error fetching engagement data:', error)
  }
}

const showSuccessMessage = (message) => {
  // Integration with existing notification system
  console.log('Success:', message)
}

const showErrorMessage = (message) => {
  // Integration with existing notification system
  console.error('Error:', message)
}

// Lifecycle
onMounted(() => {
  if (userStore.user_id) {
    fetchEngagementData()
  }
})
</script>

<style scoped>
.social-interaction-bar {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.engagement-stats {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stat-item {
  font-size: 14px;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 4px;
}

.engagement-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.engagement-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  white-space: nowrap;
}

.engagement-btn:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.engagement-btn.active {
  background: #e7f3ff;
  border-color: #0066cc;
  color: #0066cc;
}

.engagement-btn.primary {
  border-color: #0066cc;
}
.engagement-btn.warning {
  border-color: #ff8c00;
}
.engagement-btn.info {
  border-color: #17a2b8;
}
.engagement-btn.success {
  border-color: #28a745;
}
.engagement-btn.secondary {
  border-color: #6c757d;
}

.engagement-btn.primary.active {
  background: #e7f3ff;
}
.engagement-btn.warning.active {
  background: #fff3e0;
}
.engagement-btn.info.active {
  background: #e0f7fa;
}
.engagement-btn.success.active {
  background: #e8f5e8;
}
.engagement-btn.secondary.active {
  background: #f8f9fa;
}

.icon {
  font-size: 16px;
}

.label {
  font-weight: 500;
}

.count {
  background: #e9ecef;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.commentary-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.commentary-modal h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.commentary-modal textarea {
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  font-family: inherit;
  resize: vertical;
  min-height: 100px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.btn-cancel,
.btn-submit {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: white;
  color: #6c757d;
}

.btn-cancel:hover {
  background: #f8f9fa;
}

.btn-submit {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.btn-submit:hover:not(:disabled) {
  background: #0056b3;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .engagement-buttons {
    justify-content: center;
  }

  .engagement-btn .label {
    display: none;
  }
}
</style>
