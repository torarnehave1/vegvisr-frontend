<template>
  <div class="hamburger-menu">
    <!-- Hamburger Button -->
    <button
      class="hamburger-button"
      @click="toggleMenu"
      :class="{ active: isOpen }"
      aria-label="Toggle menu"
    >
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>

    <!-- Menu overlay is handled by GNewViewer mobile menu -->
  </div>
</template>

<script setup>
import { ref, defineEmits, defineProps, onMounted } from 'vue'

// Props
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

// Emits
const emit = defineEmits(['toggle', 'menu-item-clicked'])

// Debug logging
onMounted(() => {
  console.log('🍔 HamburgerMenu component mounted!')
  console.log('🍔 Initial isOpen state:', props.isOpen)
})

// Methods
const toggleMenu = () => {
  console.log('🍔 HamburgerMenu: toggleMenu called')
  emit('toggle')
}
</script>

<style scoped>
/* Hamburger Button */
.hamburger-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 40px;
  height: 35px;
  position: relative;
  z-index: 1001;
  margin-right: 10px;
  transition: all 0.2s ease;
}

.hamburger-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.hamburger-line {
  width: 100%;
  height: 3px;
  background-color: white;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.hamburger-button.active .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(6px, 6px);
}

.hamburger-button.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.hamburger-button.active .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(6px, -6px);
}

/* Menu overlay styles removed - handled by GNewViewer mobile menu */

/* Mobile Responsive */
@media (max-width: 768px) {
  .menu-content {
    width: 250px;
  }

  .menu-header h3 {
    font-size: 1.3rem;
  }

  .menu-text {
    font-size: 0.9rem;
  }
}
</style>
