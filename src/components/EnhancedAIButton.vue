<template>
  <div class="enhanced-ai-button-container">
    <!-- Enhanced AI Node Button -->
    <button
      @click="openModal"
      class="btn btn-warning enhanced-ai-btn"
      :disabled="disabled"
    >
      <span class="btn-icon">🤖</span>
      <span class="btn-text">{{ buttonText }}</span>
    </button>

    <!-- Enhanced AI Node Modal (lazy loaded) -->
    <EnhancedAINodeModal
      v-if="isModalOpen"
      :isOpen="isModalOpen"
      @close="closeModal"
      @node-created="handleNodeCreated"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Lazy import the modal component
import EnhancedAINodeModal from '@/components/EnhancedAINodeModal.vue'

// Component name for debugging
defineOptions({
  name: 'EnhancedAIButton',
})

// Props
const props = defineProps({
  buttonText: {
    type: String,
    default: 'Enhanced AI Node',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  requiresAuth: {
    type: Boolean,
    default: true,
  },
  minRole: {
    type: String,
    default: 'User', // User, Editor, Admin, Superadmin
  },
})

// Emits
const emit = defineEmits(['node-created'])

// Stores
const userStore = useUserStore()

// State
const isModalOpen = ref(false)

// Role hierarchy for permission checking
const roleHierarchy = {
  'User': 0,
  'Editor': 1,
  'Admin': 2,
  'Superadmin': 3
}

// Computed properties
const hasPermission = () => {
  if (!props.requiresAuth) return true
  if (!userStore.loggedIn) return false

  const userRoleLevel = roleHierarchy[userStore.role] || -1
  const requiredRoleLevel = roleHierarchy[props.minRole] || 0

  return userRoleLevel >= requiredRoleLevel
}

// Methods
const openModal = () => {
  if (!hasPermission()) {
    console.warn('User does not have permission to access Enhanced AI Node')
    return
  }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const handleNodeCreated = (nodeData) => {
  // Pass the event up to parent component
  emit('node-created', nodeData)
  closeModal()
}
</script>

<style scoped>
.enhanced-ai-button-container {
  display: inline-block;
}

.enhanced-ai-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  font-weight: 500;
}

.enhanced-ai-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  border-color: #e67e22;
}

.enhanced-ai-btn:active {
  transform: translateY(0);
}

.enhanced-ai-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-icon {
  font-size: 1.1em;
  line-height: 1;
}

.btn-text {
  white-space: nowrap;
}

/* Responsive design */
@media (max-width: 576px) {
  .btn-text {
    display: none;
  }

  .enhanced-ai-btn {
    padding: 0.375rem 0.75rem;
  }

  .btn-icon {
    font-size: 1.2em;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .enhanced-ai-btn {
    background-color: #e67e22;
    border-color: #d35400;
    color: white;
  }

  .enhanced-ai-btn:hover {
    background-color: #d35400;
    border-color: #c0392b;
  }
}
</style>
