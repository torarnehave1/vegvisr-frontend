<template>
  <div v-if="isOpen" class="menu-overlay" @click="closeMenu">
    <div class="menu-content" @click.stop>
      <div class="menu-header">
        <h5>{{ menuTitle }}</h5>
        <button class="btn-close" @click="closeMenu" aria-label="Close"></button>
      </div>

      <div class="menu-items">
        <div
          v-for="item in filteredMenuItems"
          :key="item.id"
          class="menu-item"
          @click="handleMenuItemClick(item)"
        >
          <span class="item-icon">{{ item.icon }}</span>
          <span class="item-label">{{ item.label }}</span>
          <span v-if="item.requiresRole" class="item-badge">
            {{ item.requiresRole.join(', ') }}
          </span>
        </div>
      </div>

      <div v-if="filteredMenuItems.length === 0" class="menu-empty">
        <p>No menu items available</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  menuTitle: {
    type: String,
    default: 'Menu',
  },
  menuItems: {
    type: Array,
    default: () => [],
  },
})

// Emits (same pattern as HamburgerMenu)
const emit = defineEmits(['close', 'menu-item-clicked'])

// Store
const userStore = useUserStore()

// Computed - Filter menu items based on user role
const filteredMenuItems = computed(() => {
  return props.menuItems.filter((item) => {
    // If no role requirements, show to everyone
    if (!item.requiresRole || item.requiresRole.length === 0) {
      return true
    }

    // Check if user has required role
    const userRole = userStore.role || 'user'

    // Superadmin can see everything
    if (userRole === 'Superadmin') {
      return true
    }

    // Admin can see admin and user items
    if (userRole === 'Admin' || userRole === 'admin') {
      return (
        item.requiresRole.includes('Admin') ||
        item.requiresRole.includes('admin') ||
        item.requiresRole.includes('user')
      )
    }

    // Regular users can only see user items
    return item.requiresRole.includes('user')
  })
})

// Methods (same pattern as existing code)
const closeMenu = () => {
  console.log('🍔 GraphMenuOverlay: closeMenu called')
  emit('close')
}

const handleMenuItemClick = (item) => {
  console.log('🍔 GraphMenuOverlay: menu item clicked:', item)
  emit('menu-item-clicked', item)
  closeMenu()
}
</script>

<style scoped>
/* Same styling patterns as GNewViewer mobile menu */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.menu-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: menuSlideIn 0.3s ease-out;
}

@keyframes menuSlideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 12px;
}

.menu-header h5 {
  margin: 0;
  color: #333;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #333;
}

.btn-close::before {
  content: '×';
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  border: 1px solid transparent;
}

.menu-item:hover {
  background-color: #f5f5f5;
  border-color: #e0e0e0;
}

.item-icon {
  font-size: 1.2rem;
  width: 24px;
  text-align: center;
}

.item-label {
  flex: 1;
  color: #333;
  font-weight: 500;
}

.item-badge {
  background-color: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.menu-empty {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.menu-empty p {
  margin: 0;
  font-style: italic;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .menu-content {
    background: #2d2d2d;
    color: white;
  }

  .menu-header h5 {
    color: white;
  }

  .menu-header {
    border-bottom-color: #444;
  }

  .btn-close {
    color: #ccc;
  }

  .btn-close:hover {
    color: white;
  }

  .menu-item:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  .item-label {
    color: white;
  }

  .menu-empty {
    color: #ccc;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .menu-content {
    width: 95%;
    max-height: 85vh;
    padding: 20px;
  }

  .menu-header h5 {
    font-size: 1.2rem;
  }

  .menu-item {
    padding: 14px 16px;
  }

  .item-icon {
    font-size: 1.1rem;
  }

  .item-label {
    font-size: 0.95rem;
  }
}
</style>
