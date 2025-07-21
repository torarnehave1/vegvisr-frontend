<template>
  <div :class="['comment-item', { 'is-reply': isReply }]">
    <div class="comment-content">
      <div class="comment-header">
        <div class="user-info">
          <strong class="username">{{ comment.user_id }}</strong>
          <span class="timestamp">{{ formattedTime }}</span>
        </div>
        <div class="comment-actions" v-if="canManageComment">
          <button @click="toggleActions" class="actions-toggle">⋯</button>
          <div v-if="showActions" class="action-menu">
            <button @click="startEdit" class="action-btn">Edit</button>
            <button @click="deleteComment" class="action-btn delete">Delete</button>
          </div>
        </div>
      </div>

      <div v-if="!isEditing" class="comment-text">
        {{ comment.comment_text }}
      </div>

      <!-- Edit Form -->
      <div v-else class="edit-form">
        <textarea v-model="editText" rows="3" maxlength="1000" class="edit-textarea"></textarea>
        <div class="edit-actions">
          <button @click="cancelEdit" class="btn-cancel">Cancel</button>
          <button
            @click="saveEdit"
            :disabled="!editText.trim() || editText === comment.comment_text"
            class="btn-save"
          >
            Save
          </button>
        </div>
      </div>

      <div class="comment-footer" v-if="!isEditing">
        <button @click="replyToComment" class="reply-btn">💬 Reply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  comment: {
    type: Object,
    required: true,
  },
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
  isReply: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['reply', 'edit', 'delete'])

const userStore = useUserStore()

// Reactive state
const isEditing = ref(false)
const editText = ref('')
const showActions = ref(false)

// Computed properties
const canManageComment = computed(() => {
  return userStore.user_id === props.comment.user_id
})

const formattedTime = computed(() => {
  const date = new Date(props.comment.created_at)
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
})

// Methods
const toggleActions = () => {
  showActions.value = !showActions.value
}

const startEdit = () => {
  editText.value = props.comment.comment_text
  isEditing.value = true
  showActions.value = false
}

const cancelEdit = () => {
  isEditing.value = false
  editText.value = ''
}

const saveEdit = () => {
  if (!editText.value.trim() || editText.value === props.comment.comment_text) return

  emit('edit', props.comment.id, editText.value.trim())
  isEditing.value = false
  editText.value = ''
}

const deleteComment = () => {
  emit('delete', props.comment.id)
  showActions.value = false
}

const replyToComment = () => {
  emit('reply', props.comment)
}

// Close actions menu when clicking outside
const handleClickOutside = (event) => {
  if (!event.target.closest('.comment-actions')) {
    showActions.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.comment-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.comment-item.is-reply {
  background: #f8f9fa;
  border-color: #dee2e6;
  margin-bottom: 8px;
}

.comment-content {
  width: 100%;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.username {
  color: #495057;
  font-size: 14px;
  font-weight: 600;
}

.timestamp {
  color: #6c757d;
  font-size: 12px;
}

.comment-actions {
  position: relative;
}

.actions-toggle {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 16px;
}

.actions-toggle:hover {
  background: #f8f9fa;
  color: #495057;
}

.action-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 80px;
}

.action-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #495057;
}

.action-btn:hover {
  background: #f8f9fa;
}

.action-btn.delete {
  color: #dc3545;
}

.action-btn.delete:hover {
  background: #f8d7da;
}

.comment-text {
  color: #495057;
  line-height: 1.5;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.edit-form {
  margin-bottom: 12px;
}

.edit-textarea {
  width: 100%;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.btn-cancel,
.btn-save {
  padding: 6px 12px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-cancel {
  background: white;
  color: #6c757d;
}

.btn-cancel:hover {
  background: #f8f9fa;
}

.btn-save {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.btn-save:hover:not(:disabled) {
  background: #0056b3;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.comment-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #f1f3f4;
}

.reply-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.reply-btn:hover {
  background: #f8f9fa;
  color: #495057;
}
</style>
