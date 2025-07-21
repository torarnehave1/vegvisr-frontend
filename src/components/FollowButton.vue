<template>
  <div class="follow-button-container">
    <button
      @click="handleFollowToggle"
      :disabled="isLoading || !canFollow"
      :class="['follow-btn', followButtonClass]"
    >
      <span class="icon">{{ followIcon }}</span>
      <span class="label">{{ followLabel }}</span>
    </button>

    <div v-if="showStats" class="connection-stats">
      <span class="stat">
        <strong>{{ followerCount }}</strong> followers
      </span>
      <span class="stat">
        <strong>{{ followingCount }}</strong> following
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  targetUserId: {
    type: String,
    required: true,
  },
  showStats: {
    type: Boolean,
    default: false,
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['follow-changed'])

const userStore = useUserStore()

// Reactive state
const isFollowing = ref(false)
const isLoading = ref(false)
const followerCount = ref(0)
const followingCount = ref(0)

// Computed properties
const canFollow = computed(() => {
  return userStore.user_id && userStore.user_id !== props.targetUserId
})

const followIcon = computed(() => {
  if (isLoading.value) return '⏳'
  return isFollowing.value ? '✓' : '+'
})

const followLabel = computed(() => {
  if (isLoading.value) return 'Loading...'
  if (props.compact) return ''
  return isFollowing.value ? 'Following' : 'Follow'
})

const followButtonClass = computed(() => {
  return {
    following: isFollowing.value,
    loading: isLoading.value,
    compact: props.compact,
    'cannot-follow': !canFollow.value,
  }
})

// Methods
const handleFollowToggle = async () => {
  if (!canFollow.value || isLoading.value) return

  try {
    isLoading.value = true
    const action = isFollowing.value ? 'unfollow' : 'follow'

    const response = await fetch('https://social.vegvisr.org/follow-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        followerId: userStore.user_id,
        followingId: props.targetUserId,
        action: action,
      }),
    })

    if (response.ok) {
      const previousState = isFollowing.value
      isFollowing.value = !isFollowing.value

      // Update follower count
      if (props.showStats) {
        followerCount.value += isFollowing.value ? 1 : -1
      }

      // Emit follow state change
      emit('follow-changed', {
        targetUserId: props.targetUserId,
        isFollowing: isFollowing.value,
        previousState,
      })

      showSuccessMessage(isFollowing.value ? 'Now following user' : 'Unfollowed user')
    } else {
      throw new Error('Failed to update follow status')
    }
  } catch (error) {
    console.error('Error toggling follow:', error)
    showErrorMessage('Failed to update follow status')
  } finally {
    isLoading.value = false
  }
}

const checkFollowStatus = async () => {
  if (!canFollow.value) return

  try {
    const response = await fetch(
      `https://social.vegvisr.org/connection-status?followerId=${userStore.user_id}&followingId=${props.targetUserId}`,
    )

    if (response.ok) {
      const data = await response.json()
      isFollowing.value = data.isFollowing
    }
  } catch (error) {
    console.error('Error checking follow status:', error)
  }
}

const fetchConnectionStats = async () => {
  if (!props.showStats) return

  try {
    const response = await fetch(
      `https://social.vegvisr.org/user-connections?userId=${props.targetUserId}`,
    )

    if (response.ok) {
      const data = await response.json()
      followerCount.value = data.followerCount || 0
      followingCount.value = data.followingCount || 0
    }
  } catch (error) {
    console.error('Error fetching connection stats:', error)
  }
}

const showSuccessMessage = (message) => {
  console.log('Success:', message)
}

const showErrorMessage = (message) => {
  console.error('Error:', message)
}

// Watch for user login state changes
watch(
  () => userStore.user_id,
  (newUserId) => {
    if (newUserId) {
      checkFollowStatus()
      fetchConnectionStats()
    }
  },
)

// Watch for target user changes
watch(
  () => props.targetUserId,
  () => {
    checkFollowStatus()
    fetchConnectionStats()
  },
)

// Lifecycle
onMounted(() => {
  if (userStore.user_id) {
    checkFollowStatus()
    fetchConnectionStats()
  }
})
</script>

<style scoped>
.follow-button-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.follow-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #0066cc;
  border-radius: 20px;
  background: white;
  color: #0066cc;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 100px;
  justify-content: center;
}

.follow-btn.compact {
  min-width: 36px;
  padding: 6px 8px;
  border-radius: 50%;
}

.follow-btn:hover:not(:disabled) {
  background: #e7f3ff;
  border-color: #0056b3;
}

.follow-btn.following {
  background: #0066cc;
  color: white;
}

.follow-btn.following:hover:not(:disabled) {
  background: #dc3545;
  border-color: #dc3545;
}

.follow-btn.following:hover:not(:disabled) .label {
  display: none;
}

.follow-btn.following:hover:not(:disabled)::after {
  content: 'Unfollow';
  color: white;
}

.follow-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.follow-btn.cannot-follow {
  display: none;
}

.icon {
  font-size: 14px;
}

.label {
  font-weight: 500;
}

.connection-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6c757d;
}

.stat {
  display: flex;
  align-items: center;
  gap: 2px;
}

.stat strong {
  color: #495057;
  font-weight: 600;
}

/* Professional styling variants */
.follow-btn.professional {
  border-radius: 4px;
  padding: 10px 20px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-size: 12px;
}

@media (max-width: 768px) {
  .follow-btn:not(.compact) .label {
    display: none;
  }

  .follow-btn:not(.compact) {
    min-width: 36px;
    padding: 8px;
    border-radius: 50%;
  }

  .connection-stats {
    font-size: 11px;
    gap: 12px;
  }
}

/* Loading state animation */
.follow-btn.loading {
  position: relative;
}

.follow-btn.loading::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.follow-btn.loading .icon,
.follow-btn.loading .label {
  opacity: 0;
}
</style>
