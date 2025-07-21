<template>
  <div class="node-comment-section" v-if="isVisible">
    <div class="comment-header">
      <h4>💬 Professional Discussion ({{ comments.length }} comments)</h4>
      <div class="comment-info">
        <span class="allowed-types">Comments enabled for: {{ allowedTypesText }}</span>
      </div>
    </div>

    <div v-if="!isCommentable" class="comment-disabled">
      <p>Comments are not enabled for this type of content or this insight.</p>
      <small>Creator has set engagement level to limit discussions.</small>
    </div>

    <div v-else>
      <!-- Add Comment Form -->
      <div class="add-comment-form" v-if="userStore.user_id">
        <textarea
          v-model="newComment"
          placeholder="Add professional comment..."
          rows="3"
          maxlength="1000"
          @keydown.ctrl.enter="submitComment"
        ></textarea>
        <div class="comment-actions">
          <small class="char-count">{{ newComment.length }}/1000</small>
          <button
            @click="submitComment"
            :disabled="!newComment.trim() || isSubmitting"
            class="btn-submit"
          >
            {{ isSubmitting ? 'Adding...' : 'Add Comment' }}
          </button>
        </div>
      </div>

      <!-- Comments List -->
      <div class="comments-list" v-if="comments.length > 0">
        <div v-for="comment in topLevelComments" :key="comment.id" class="comment-thread">
          <CommentItem
            :comment="comment"
            :graph-id="graphId"
            :node-id="nodeId"
            :node-type="nodeType"
            @reply="handleReply"
            @edit="handleEdit"
            @delete="handleDelete"
          />

          <!-- Nested Replies -->
          <div v-if="comment.replies && comment.replies.length > 0" class="replies">
            <CommentItem
              v-for="reply in comment.replies"
              :key="reply.id"
              :comment="reply"
              :graph-id="graphId"
              :node-id="nodeId"
              :node-type="nodeType"
              :is-reply="true"
              @reply="handleReply"
              @edit="handleEdit"
              @delete="handleDelete"
            />
          </div>
        </div>
      </div>

      <div v-else-if="isCommentable" class="no-comments">
        <p>No comments yet. Be the first to start the professional discussion!</p>
      </div>
    </div>

    <!-- Reply Modal -->
    <div v-if="showReplyModal" class="modal-overlay" @click="closeReplyModal">
      <div class="reply-modal" @click.stop>
        <h3>Reply to Comment</h3>
        <div class="original-comment">
          <strong>{{ replyingTo?.user_id }}:</strong>
          <p>{{ replyingTo?.comment_text }}</p>
        </div>
        <textarea
          v-model="replyText"
          placeholder="Write your professional reply..."
          rows="4"
          maxlength="1000"
        ></textarea>
        <div class="modal-actions">
          <button @click="closeReplyModal" class="btn-cancel">Cancel</button>
          <button
            @click="submitReply"
            :disabled="!replyText.trim() || isSubmitting"
            class="btn-submit"
          >
            {{ isSubmitting ? 'Replying...' : 'Reply' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'
import CommentItem from './CommentItem.vue'

const props = defineProps({
  graphId: {
    type: String,
    required: true,
  },
  nodeId: {
    type: String,
    required: true,
  },
  nodeType: {
    type: String,
    required: true,
  },
})

const userStore = useUserStore()

// Reactive state
const comments = ref([])
const newComment = ref('')
const isCommentable = ref(false)
const isLoading = ref(false)
const isSubmitting = ref(false)
const allowedTypes = ref([])
const engagementLevel = ref('hybrid')
const showReplyModal = ref(false)
const replyText = ref('')
const replyingTo = ref(null)

// Computed properties
const isVisible = computed(() => {
  return (
    allowedTypes.value.some((type) => type.node_type === props.nodeType) ||
    comments.value.length > 0
  )
})

const allowedTypesText = computed(() => {
  return allowedTypes.value
    .filter((type) => type.enabled)
    .map((type) => type.display_name)
    .join(', ')
})

const topLevelComments = computed(() => {
  const commentsMap = new Map()
  const rootComments = []

  // First pass: create all comments
  comments.value.forEach((comment) => {
    commentsMap.set(comment.id, { ...comment, replies: [] })
  })

  // Second pass: organize into threads
  comments.value.forEach((comment) => {
    if (comment.parent_comment_id) {
      const parent = commentsMap.get(comment.parent_comment_id)
      if (parent) {
        parent.replies.push(commentsMap.get(comment.id))
      }
    } else {
      rootComments.push(commentsMap.get(comment.id))
    }
  })

  return rootComments
})

// Methods
const checkCommentability = async () => {
  try {
    // Check if node type supports comments
    const typesResponse = await fetch(
      'https://social-worker.torarnehave.workers.dev/commentable-types',
    )
    const { types } = await typesResponse.json()
    allowedTypes.value = types || []

    const nodeTypeSupported = types.some((t) => t.node_type === props.nodeType && t.enabled)

    if (!nodeTypeSupported) {
      isCommentable.value = false
      return
    }

    // Check creator's engagement level for this graph
    const settingsResponse = await fetch(
      `https://social-worker.torarnehave.workers.dev/graph-social-settings?graphId=${props.graphId}`,
    )
    const { engagementLevel: level } = await settingsResponse.json()
    engagementLevel.value = level

    // Comments only allowed if creator set 'hybrid' level
    isCommentable.value = level === 'hybrid'

    if (isCommentable.value) {
      await fetchComments()
    }
  } catch (error) {
    console.error('Error checking commentability:', error)
    isCommentable.value = false
  }
}

const fetchComments = async () => {
  try {
    isLoading.value = true
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/node-comments?graphId=${props.graphId}&nodeId=${props.nodeId}`,
    )
    const data = await response.json()
    comments.value = data.comments || []
  } catch (error) {
    console.error('Error fetching comments:', error)
    comments.value = []
  } finally {
    isLoading.value = false
  }
}

const submitComment = async () => {
  if (!newComment.value.trim()) return

  try {
    isSubmitting.value = true
    const response = await fetch('https://social-worker.torarnehave.workers.dev/add-node-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        nodeId: props.nodeId,
        nodeType: props.nodeType,
        userId: userStore.user_id,
        commentText: newComment.value.trim(),
      }),
    })

    if (response.ok) {
      newComment.value = ''
      await fetchComments()
      showSuccessMessage('Comment added successfully!')
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add comment')
    }
  } catch (error) {
    console.error('Error adding comment:', error)
    showErrorMessage(error.message || 'Failed to add comment')
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (comment) => {
  replyingTo.value = comment
  replyText.value = ''
  showReplyModal.value = true
}

const submitReply = async () => {
  if (!replyText.value.trim()) return

  try {
    isSubmitting.value = true
    const response = await fetch('https://social-worker.torarnehave.workers.dev/add-node-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: props.graphId,
        nodeId: props.nodeId,
        nodeType: props.nodeType,
        userId: userStore.user_id,
        commentText: replyText.value.trim(),
        parentId: replyingTo.value.id,
      }),
    })

    if (response.ok) {
      closeReplyModal()
      await fetchComments()
      showSuccessMessage('Reply added successfully!')
    } else {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add reply')
    }
  } catch (error) {
    console.error('Error adding reply:', error)
    showErrorMessage(error.message || 'Failed to add reply')
  } finally {
    isSubmitting.value = false
  }
}

const closeReplyModal = () => {
  showReplyModal.value = false
  replyingTo.value = null
  replyText.value = ''
}

const handleEdit = async (commentId, newText) => {
  try {
    const response = await fetch(
      'https://social-worker.torarnehave.workers.dev/edit-node-comment',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          userId: userStore.user_id,
          commentText: newText,
        }),
      },
    )

    if (response.ok) {
      await fetchComments()
      showSuccessMessage('Comment updated successfully!')
    } else {
      throw new Error('Failed to update comment')
    }
  } catch (error) {
    console.error('Error updating comment:', error)
    showErrorMessage('Failed to update comment')
  }
}

const handleDelete = async (commentId) => {
  if (!confirm('Are you sure you want to delete this comment?')) return

  try {
    const response = await fetch(
      `https://social-worker.torarnehave.workers.dev/delete-node-comment?commentId=${commentId}&userId=${userStore.user_id}`,
      { method: 'DELETE' },
    )

    if (response.ok) {
      await fetchComments()
      showSuccessMessage('Comment deleted successfully!')
    } else {
      throw new Error('Failed to delete comment')
    }
  } catch (error) {
    console.error('Error deleting comment:', error)
    showErrorMessage('Failed to delete comment')
  }
}

const showSuccessMessage = (message) => {
  console.log('Success:', message)
}

const showErrorMessage = (message) => {
  console.error('Error:', message)
}

// Watch for prop changes
watch(
  [() => props.graphId, () => props.nodeId, () => props.nodeType],
  () => {
    checkCommentability()
  },
  { immediate: false },
)

// Lifecycle
onMounted(() => {
  checkCommentability()
})
</script>

<style scoped>
.node-comment-section {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.comment-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.comment-header h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.comment-info {
  font-size: 12px;
  color: #6c757d;
}

.allowed-types {
  font-weight: 500;
}

.comment-disabled {
  text-align: center;
  padding: 24px;
  color: #6c757d;
}

.comment-disabled p {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.comment-disabled small {
  font-size: 14px;
}

.add-comment-form {
  margin-bottom: 20px;
}

.add-comment-form textarea {
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}

.comment-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.char-count {
  color: #6c757d;
  font-size: 12px;
}

.btn-submit {
  background: #0066cc;
  color: white;
  border: 1px solid #0066cc;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.btn-submit:hover:not(:disabled) {
  background: #0056b3;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comments-list {
  space-y: 16px;
}

.comment-thread {
  margin-bottom: 16px;
}

.replies {
  margin-left: 32px;
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid #e9ecef;
}

.no-comments {
  text-align: center;
  padding: 32px;
  color: #6c757d;
}

.no-comments p {
  margin: 0;
  font-size: 16px;
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

.reply-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.reply-modal h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.original-comment {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.original-comment strong {
  color: #495057;
}

.original-comment p {
  margin: 4px 0 0 0;
  color: #6c757d;
}

.reply-modal textarea {
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

.btn-cancel {
  background: white;
  color: #6c757d;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel:hover {
  background: #f8f9fa;
}
</style>
