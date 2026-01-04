<template>
  <div class="share-to-hallo-container">
    <div class="share-header">
      <h2><i class="bi bi-chat-dots"></i> Share to Hallo Vegvisr Chat</h2>
      <p>Share this knowledge graph with your groups in Hallo Vegvisr Chat</p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading your groups...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="alert alert-danger">
        <h5>Error</h5>
        <p>{{ error }}</p>
        <button @click="retryLoad" class="btn btn-primary">Retry</button>
      </div>
    </div>

    <div v-else class="share-content">
      <!-- Graph Preview -->
      <div class="graph-preview">
        <h4>
          <i class="bi bi-diagram-3"></i>
          {{ isSEOShare ? 'SEO Graph to Share' : 'Interactive Graph to Share' }}
        </h4>
        <div class="graph-info">
          <div class="graph-title">{{ graphTitle }}</div>
          <div class="graph-stats">
            <span class="badge bg-primary">{{ nodeCount }} nodes</span>
            <span class="badge bg-secondary">{{ edgeCount }} connections</span>
            <span v-if="isSEOShare" class="badge bg-success">📄 SEO Optimized</span>
            <span v-else class="badge bg-info">🔗 Interactive</span>
          </div>
          <div class="share-url">
            <small class="text-muted">
              <strong>Share URL:</strong>
              <a :href="shareUrl" target="_blank" class="text-decoration-none">{{ shareUrl }}</a>
            </small>
          </div>
        </div>
      </div>

      <!-- Message Input -->
      <div class="message-section">
        <h4>
          <i class="bi bi-chat-text"></i>
          {{ isSEOShare ? 'SEO Graph Message' : 'Graph Message' }}
        </h4>
        <div v-if="isSEOShare" class="alert alert-info">
          <small>
            <i class="bi bi-info-circle"></i>
            This is a public SEO-optimized graph. The message will include the shareable SEO link.
          </small>
        </div>
        <textarea
          v-model="messageText"
          class="form-control"
          rows="4"
          :placeholder="isSEOShare ? 'Add a personal message (optional - the SEO link will be included automatically)...' : 'Add a message about this graph...'"
          maxlength="1000"
        ></textarea>
        <small class="text-muted">{{ messageText.length }}/1000 characters</small>
      </div>

      <!-- Group Selection -->
      <div class="groups-section">
        <h4>Select Group</h4>
        <div v-if="groups.length === 0" class="no-groups">
          <p>You don't have any groups yet. Create a group in Hallo Vegvisr Chat first.</p>
          <button @click="goToChat" class="btn btn-primary">Go to Chat</button>
        </div>
        <div v-else class="groups-list">
          <div
            v-for="group in groups"
            :key="group.id"
            class="group-item"
            :class="{ selected: selectedGroupId === group.id }"
            @click="selectGroup(group.id)"
          >
            <div class="group-info">
              <div class="group-name">{{ group.name }}</div>
              <div class="group-meta">
                <span class="badge bg-light text-dark">{{ group.member_count }} members</span>
                <span class="group-role">Role: {{ group.role }}</span>
              </div>
            </div>
            <div class="group-select">
              <input
                type="radio"
                :value="group.id"
                v-model="selectedGroupId"
                @change="selectGroup(group.id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Share Button -->
      <div class="share-actions">
        <button
          @click="shareToGroup"
          :disabled="!selectedGroupId || sharing"
          class="btn btn-success btn-lg"
        >
          <span v-if="sharing" class="spinner-border spinner-border-sm me-2"></span>
          {{ sharing ? 'Sharing...' : `Share ${isSEOShare ? 'SEO Graph' : 'Graph'} to Group` }}
        </button>
        <button @click="goBack" class="btn btn-secondary">Cancel</button>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="shareSuccess" class="alert alert-success mt-3">
        <i class="bi bi-check-circle"></i>
        {{ isSEOShare ? 'SEO Graph' : 'Interactive graph' }} shared successfully to {{ selectedGroupName }}!
        <div v-if="isSEOShare" class="mt-2">
          <small class="text-muted">
            Group members can now access the SEO-optimized version of your graph.
          </small>
        </div>
      </div>

      <div v-if="shareError" class="alert alert-danger mt-3">
        <i class="bi bi-exclamation-triangle"></i> Failed to share: {{ shareError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useRoute, useRouter } from 'vue-router'

// Route and router
const route = useRoute()
const router = useRouter()

// User store
const userStore = useUserStore()

// Reactive data
const loading = ref(true)
const error = ref('')
const groups = ref([])
const selectedGroupId = ref('')
const messageText = ref('')
const sharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')

// Computed properties
const graphId = computed(() => route.query.graphId || '')
const shareUrl = computed(() => route.query.shareUrl || '')
const shareContent = computed(() => route.query.shareContent || '')
const shareType = computed(() => route.query.shareType || 'dynamic')
const graphTitle = computed(() => {
  // Extract title from share content
  const lines = shareContent.value.split('\n')
  return lines[0] || 'Untitled Graph'
})
const nodeCount = computed(() => {
  // Try to extract from share content
  const content = shareContent.value
  const nodeMatch = content.match(/Nodes: (\d+)/)
  return nodeMatch ? parseInt(nodeMatch[1]) : 0
})
const edgeCount = computed(() => {
  // Try to extract from share content
  const content = shareContent.value
  const edgeMatch = content.match(/Edges: (\d+)/)
  return edgeMatch ? parseInt(edgeMatch[1]) : 0
})
const selectedGroupName = computed(() => {
  const group = groups.value.find(g => g.id === selectedGroupId.value)
  return group ? group.name : ''
})
const isSEOShare = computed(() => shareType.value === 'seo')

// Methods
const loadGroups = async () => {
  if (!userStore.loggedIn) {
    error.value = 'Please sign in to share to groups.'
    loading.value = false
    return
  }

  if (!userStore.phone) {
    try {
      loading.value = true
      await userStore.fetchUserDataFromConfig()
    } catch (e) {
      // Ignore and fall through to the normal validation error
      console.warn('Failed to hydrate phone from config:', e)
    }
  }

  if (!userStore.phone) {
    error.value = 'Phone number is required for sharing. Please update your profile.'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''

    // Get user's groups from group-chat-worker
    const params = new URLSearchParams({
      user_id: userStore.user_id,
      phone: userStore.phone,
      email: userStore.email || '',
    })

    console.log('Loading groups with params:', {
      user_id: userStore.user_id,
      phone: userStore.phone,
      email: userStore.email,
      phoneType: typeof userStore.phone,
      phoneLength: userStore.phone ? userStore.phone.length : 0,
      fullUrl: `https://group-chat-worker.torarnehave.workers.dev/groups?${params}`
    })

    const response = await fetch(`https://group-chat-worker.torarnehave.workers.dev/groups?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groups API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Failed to load groups: ${response.status}`)
    }

    const data = await response.json()

    if (data.success && Array.isArray(data.groups)) {
      groups.value = data.groups.map(group => ({
        id: group.id,
        name: group.name,
        member_count: group.member_count || 0,
        role: group.user_role || 'member',
      }))
    } else {
      groups.value = []
    }

    // Pre-populate message if share content exists
    if (shareContent.value) {
      messageText.value = shareContent.value
    }

  } catch (err) {
    console.error('Error loading groups:', err)
    error.value = err.message || 'Failed to load groups'
  } finally {
    loading.value = false
  }
}

const selectGroup = (groupId) => {
  selectedGroupId.value = groupId
}

const shareToGroup = async () => {
  if (!selectedGroupId.value) {
    shareError.value = 'Please select a group'
    return
  }

  if (!userStore.loggedIn) {
    shareError.value = 'Please sign in to share'
    return
  }

  if (!userStore.phone) {
    try {
      await userStore.fetchUserDataFromConfig()
    } catch (e) {
      console.warn('Failed to hydrate phone from config:', e)
    }
  }

  if (!userStore.phone) {
    shareError.value = 'Phone number is required for sharing. Please update your profile.'
    return
  }

  try {
    sharing.value = true
    shareError.value = ''
    shareSuccess.value = false

    let messageBody = messageText.value.trim()

    // For SEO graphs, create a formatted message with the SEO link
    if (isSEOShare.value) {
      const baseMessage = messageBody || shareContent.value || 'Check out this knowledge graph!'
      messageBody = `${baseMessage}\n\n📄 SEO Graph: ${shareUrl.value}`
    } else {
      // For dynamic graphs, use the message or share content
      messageBody = messageBody || shareContent.value
    }

    if (!messageBody) {
      messageBody = `Check out this ${isSEOShare.value ? 'SEO' : 'interactive'} knowledge graph: ${shareUrl.value}`
    }

    // Send message to the selected group
    const response = await fetch(`https://group-chat-worker.torarnehave.workers.dev/groups/${selectedGroupId.value}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userStore.user_id,
        'x-user-phone': userStore.phone,
        'x-user-email': userStore.email,
      },
      body: JSON.stringify({
        user_id: userStore.user_id,
        phone: userStore.phone,
        email: userStore.email,
        body: messageBody,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to send message: ${response.status}`)
    }

    const result = await response.json()

    if (result.success) {
      shareSuccess.value = true
      // Clear form after success
      messageText.value = ''
      selectedGroupId.value = ''
    } else {
      throw new Error(result.error || 'Failed to share graph')
    }

  } catch (err) {
    console.error('Error sharing to group:', err)
    shareError.value = err.message || 'Failed to share graph'
  } finally {
    sharing.value = false
  }
}

const retryLoad = () => {
  loadGroups()
}

const goBack = () => {
  // Go back to previous page or GNewViewer
  if (graphId.value) {
    router.push(`/gnew-viewer?graphId=${graphId.value}`)
  } else {
    router.back()
  }
}

const goToChat = () => {
  // Navigate to chat/groups page (assuming it exists)
  router.push('/groups') // Adjust path as needed
}

// Lifecycle
onMounted(() => {
  if (!graphId.value) {
    error.value = 'No graph specified to share'
    loading.value = false
    return
  }

  loadGroups()
})
</script>

<style scoped>
.share-to-hallo-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.share-header {
  text-align: center;
  margin-bottom: 30px;
}

.share-header h2 {
  color: #007bff;
  margin-bottom: 10px;
}

.share-header p {
  color: #6c757d;
  font-size: 1.1rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 50px 20px;
}

.graph-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid #dee2e6;
}

.graph-info .graph-title {
  font-size: 1.3rem;
  font-weight: bold;
  margin-bottom: 10px;
  color: #495057;
}

.graph-stats {
  margin-bottom: 10px;
}

.graph-stats .badge {
  margin-right: 10px;
}

.share-url {
  font-size: 0.9rem;
}

.message-section {
  margin-bottom: 30px;
}

.message-section h4 {
  margin-bottom: 15px;
  color: #495057;
}

.groups-section {
  margin-bottom: 30px;
}

.groups-section h4 {
  margin-bottom: 15px;
  color: #495057;
}

.no-groups {
  text-align: center;
  padding: 30px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.groups-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  transition: background-color 0.2s;
}

.group-item:last-child {
  border-bottom: none;
}

.group-item:hover {
  background-color: #f8f9fa;
}

.group-item.selected {
  background-color: #e3f2fd;
  border-color: #007bff;
}

.group-info {
  flex: 1;
}

.group-name {
  font-weight: 600;
  margin-bottom: 5px;
  color: #495057;
}

.group-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: #6c757d;
}

.group-role {
  font-style: italic;
}

.group-select {
  margin-left: 15px;
}

.share-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
}

.share-actions .btn {
  min-width: 150px;
}

@media (max-width: 768px) {
  .share-to-hallo-container {
    padding: 15px;
  }

  .share-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .group-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-select {
    margin-left: 0;
    margin-top: 10px;
    align-self: flex-end;
  }
}
</style>
