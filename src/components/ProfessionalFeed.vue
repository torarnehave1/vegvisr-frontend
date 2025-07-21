<template>
  <div class="professional-feed">
    <div class="feed-header">
      <h2>📊 Professional Insights Feed</h2>
      <div class="feed-controls">
        <select v-model="selectedExpertise" class="expertise-filter">
          <option value="">All Expertise Areas</option>
          <option v-for="area in expertiseAreas" :key="area" :value="area">
            {{ area }}
          </option>
        </select>
        <button @click="refreshFeed" :disabled="isLoading" class="refresh-btn">
          {{ isLoading ? '⏳' : '🔄' }} Refresh
        </button>
      </div>
    </div>

    <div v-if="isLoading && feedItems.length === 0" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading professional insights...</p>
    </div>

    <div v-else-if="feedItems.length === 0" class="empty-state">
      <div class="empty-icon">📊</div>
      <h3>No Professional Insights Yet</h3>
      <p>Follow professionals to see their knowledge graphs and insights in your feed.</p>
      <button @click="$router.push('/discover')" class="discover-btn">
        Discover Professionals
      </button>
    </div>

    <div v-else class="feed-content">
      <div
        v-for="insight in filteredFeedItems"
        :key="insight.id"
        class="insight-card"
        @click="viewInsight(insight)"
      >
        <!-- User Info Header -->
        <div class="insight-header">
          <div class="user-info">
            <div class="user-avatar">
              {{ insight.userDetails?.email?.charAt(0).toUpperCase() || '?' }}
            </div>
            <div class="user-details">
              <div class="user-name">
                {{ insight.userDetails?.email || 'Unknown User' }}
              </div>
              <div class="user-role">
                {{ insight.userDetails?.role || 'Professional' }}
              </div>
            </div>
          </div>
          <div class="insight-meta">
            <span class="timestamp">{{ formatTime(insight.created_date) }}</span>
            <FollowButton
              :target-user-id="insight.created_by"
              compact
              @follow-changed="handleFollowChanged"
            />
          </div>
        </div>

        <!-- Insight Content -->
        <div class="insight-content">
          <h3 class="insight-title">{{ insight.metadata?.title || 'Untitled Insight' }}</h3>
          <p class="insight-description">
            {{ insight.metadata?.description || 'No description provided' }}
          </p>

          <!-- Graph Preview -->
          <div class="graph-preview">
            <div class="graph-stats">
              <span class="stat">{{ insight.nodes?.length || 0 }} nodes</span>
              <span class="stat">{{ insight.edges?.length || 0 }} connections</span>
              <span class="stat">{{ insight.metadata?.category || 'General' }}</span>
            </div>

            <!-- Mini visualization would go here -->
            <div class="mini-graph-placeholder">🔗 Interactive Knowledge Graph</div>
          </div>

          <!-- Professional Tags -->
          <div class="insight-tags" v-if="insight.metadata?.metaArea">
            <span class="tag">{{ insight.metadata.metaArea }}</span>
            <span v-if="insight.metadata.category" class="tag secondary">
              {{ insight.metadata.category }}
            </span>
          </div>
        </div>

        <!-- Social Engagement Bar -->
        <div class="insight-engagement">
          <SocialInteractionBar :graph-id="insight.id" :show-stats="true" @click.stop />
        </div>

        <!-- Professional Comments Preview -->
        <div v-if="insight.commentCount > 0" class="comments-preview" @click.stop>
          <div class="comments-header">
            <span>💬 {{ insight.commentCount }} professional comments</span>
            <button @click="expandComments(insight)" class="expand-btn">View Discussion</button>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="hasMoreItems" class="load-more-section">
        <button @click="loadMoreItems" :disabled="isLoadingMore" class="load-more-btn">
          {{ isLoadingMore ? 'Loading...' : 'Load More Insights' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import SocialInteractionBar from './SocialInteractionBar.vue'
import FollowButton from './FollowButton.vue'

const router = useRouter()
const userStore = useUserStore()

// Reactive state
const feedItems = ref([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const hasMoreItems = ref(true)
const selectedExpertise = ref('')
const expertiseAreas = ref([])
const currentPage = ref(0)
const pageSize = 10

// Computed properties
const filteredFeedItems = computed(() => {
  let items = feedItems.value

  if (selectedExpertise.value) {
    items = items.filter(
      (item) =>
        item.metadata?.metaArea === selectedExpertise.value ||
        item.metadata?.category === selectedExpertise.value,
    )
  }

  return items.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
})

// Methods
const fetchFeedItems = async (append = false) => {
  if (!userStore.user_id) return

  try {
    if (!append) {
      isLoading.value = true
      currentPage.value = 0
    } else {
      isLoadingMore.value = true
    }

    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/professional-feed?userId=${userStore.user_id}&page=${currentPage.value}&limit=${pageSize}`,
    )

    if (response.ok) {
      const data = await response.json()
      const insights = data.insights || []

      // Add comment counts and other social stats
      const enrichedInsights = await Promise.all(
        insights.map(async (insight) => ({
          ...insight,
          commentCount: await getCommentCount(insight.id),
          socialStats: insight.socialStats || {},
        })),
      )

      if (append) {
        feedItems.value = [...feedItems.value, ...enrichedInsights]
      } else {
        feedItems.value = enrichedInsights
        extractExpertiseAreas(enrichedInsights)
      }

      hasMoreItems.value = insights.length === pageSize
      currentPage.value++
    } else {
      throw new Error('Failed to fetch feed')
    }
  } catch (error) {
    console.error('Error fetching professional feed:', error)
    showErrorMessage('Failed to load professional insights')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

const getCommentCount = async (graphId) => {
  try {
    // This would ideally be included in the main feed response for efficiency
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/graph-comment-count?graphId=${graphId}`,
    )
    if (response.ok) {
      const data = await response.json()
      return data.count || 0
    }
  } catch (error) {
    console.error('Error fetching comment count:', error)
  }
  return 0
}

const extractExpertiseAreas = (insights) => {
  const areas = new Set()
  insights.forEach((insight) => {
    if (insight.metadata?.metaArea) areas.add(insight.metadata.metaArea)
    if (insight.metadata?.category) areas.add(insight.metadata.category)
  })
  expertiseAreas.value = Array.from(areas).sort()
}

const refreshFeed = async () => {
  await fetchFeedItems(false)
}

const loadMoreItems = async () => {
  await fetchFeedItems(true)
}

const viewInsight = (insight) => {
  // Navigate to GNewViewer for this graph
  router.push(`/gnew-viewer/${insight.id}`)
}

const expandComments = (insight) => {
  // Navigate to graph with comments section focused
  router.push(`/gnew-viewer/${insight.id}?focus=comments`)
}

const handleFollowChanged = (event) => {
  console.log('Follow status changed:', event)
  // Optionally refresh feed or update UI
}

const formatTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = (now - date) / (1000 * 60 * 60)

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60)
    return minutes < 1 ? 'Just now' : `${minutes}m ago`
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  } else {
    const days = Math.floor(diffInHours / 24)
    return days === 1 ? '1 day ago' : `${days} days ago`
  }
}

const showErrorMessage = (message) => {
  console.error('Error:', message)
}

// Watch for expertise filter changes
watch(selectedExpertise, () => {
  // Filter is reactive, no need to refetch
})

// Watch for user login state
watch(
  () => userStore.user_id,
  (newUserId) => {
    if (newUserId) {
      fetchFeedItems()
    } else {
      feedItems.value = []
    }
  },
)

// Lifecycle
onMounted(() => {
  if (userStore.user_id) {
    fetchFeedItems()
  }
})
</script>

<style scoped>
.professional-feed {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e9ecef;
}

.feed-header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.feed-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.expertise-filter {
  padding: 8px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  min-width: 180px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.refresh-btn:hover:not(:disabled) {
  background: #0056b3;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  color: #495057;
  margin: 0 0 12px 0;
}

.empty-state p {
  color: #6c757d;
  margin: 0 0 24px 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

.discover-btn {
  background: #0066cc;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
}

.discover-btn:hover {
  background: #0056b3;
}

.feed-content {
  space-y: 24px;
}

.insight-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.insight-card:hover {
  border-color: #0066cc;
  box-shadow: 0 4px 12px rgba(0, 102, 204, 0.1);
  transform: translateY(-1px);
}

.insight-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0066cc, #004499);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.user-details {
  flex: 1;
}

.user-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.user-role {
  color: #6c757d;
  font-size: 12px;
}

.insight-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timestamp {
  color: #6c757d;
  font-size: 12px;
}

.insight-content {
  margin-bottom: 16px;
}

.insight-title {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.insight-description {
  color: #6c757d;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.graph-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.graph-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.graph-stats .stat {
  font-size: 12px;
  color: #6c757d;
  background: white;
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid #dee2e6;
}

.mini-graph-placeholder {
  text-align: center;
  color: #0066cc;
  font-weight: 500;
  padding: 20px;
  background: white;
  border: 2px dashed #dee2e6;
  border-radius: 6px;
}

.insight-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: #e7f3ff;
  color: #0066cc;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #cce7ff;
}

.tag.secondary {
  background: #f8f9fa;
  color: #6c757d;
  border-color: #dee2e6;
}

.insight-engagement {
  margin: 16px 0;
}

.comments-preview {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expand-btn {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.expand-btn:hover {
  background: #e7f3ff;
}

.load-more-section {
  text-align: center;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e9ecef;
}

.load-more-btn {
  background: #f8f9fa;
  color: #495057;
  border: 1px solid #dee2e6;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.load-more-btn:hover:not(:disabled) {
  background: #e9ecef;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .professional-feed {
    padding: 16px;
  }

  .feed-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .feed-controls {
    justify-content: space-between;
  }

  .expertise-filter {
    flex: 1;
    min-width: auto;
  }

  .insight-header {
    flex-direction: column;
    gap: 12px;
  }

  .insight-meta {
    align-self: flex-end;
  }

  .graph-stats {
    justify-content: center;
  }
}
</style>
