<template>
  <div class="graph-menu-button">
    <button
      class="menu-button"
      @click="toggleMenu"
      :class="{ active: isOpen }"
      aria-label="Toggle menu"
    >
      <span v-if="buttonStyle === 'hamburger'" class="hamburger-lines">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </span>
      <span v-else class="menu-content">
        <span class="menu-icon">{{ menuIcon }}</span>
        <span class="menu-label">{{ menuLabel }}</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, onMounted } from 'vue'

// Props (same pattern as HamburgerMenu)
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  menuIcon: {
    type: String,
    default: '☰',
  },
  menuLabel: {
    type: String,
    default: 'Menu',
  },
  buttonStyle: {
    type: String,
    default: 'hamburger', // 'hamburger', 'button', 'link', 'icon'
  },
})

// Emits (same pattern as HamburgerMenu)
const emit = defineEmits(['toggle'])

// Debug logging (same pattern as HamburgerMenu)
onMounted(() => {
  console.log('🍔 GraphMenuButton component mounted!')
  console.log('🍔 Initial isOpen state:', props.isOpen)
  console.log('🍔 Button style:', props.buttonStyle)
})

// Methods (same pattern as HamburgerMenu)
const toggleMenu = () => {
  console.log('🍔 GraphMenuButton: toggleMenu called')
  emit('toggle')
}
</script>

<style scoped>
/* Same styling patterns as HamburgerMenu */
.menu-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  padding: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1001;
}

.menu-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.hamburger-lines {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  width: 24px;
  height: 18px;
}

.hamburger-line {
  width: 100%;
  height: 3px;
  background-color: white;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.menu-button.active .hamburger-line:nth-child(1) {
  transform: rotate(45deg) translate(6px, 6px);
}

.menu-button.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.menu-button.active .hamburger-line:nth-child(3) {
  transform: rotate(-45deg) translate(6px, -6px);
}

.menu-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
}

.menu-icon {
  font-size: 1.2rem;
}

.menu-label {
  font-size: 0.9rem;
  font-weight: 500;
}

/* Button style variants */
.menu-button.button-style {
  background: #007bff;
  border: 1px solid #0056b3;
  color: white;
}

.menu-button.button-style:hover {
  background: #0056b3;
  border-color: #004085;
}

.menu-button.link-style {
  background: transparent;
  border: none;
  color: #007bff;
}

.menu-button.link-style:hover {
  color: #0056b3;
  text-decoration: underline;
}

.menu-button.icon-style {
  background: transparent;
  border: none;
  color: #333;
  padding: 4px;
}

.menu-button.icon-style:hover {
  color: #007bff;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .menu-button {
    padding: 6px;
  }

  .hamburger-lines {
    width: 20px;
    height: 15px;
  }

  .menu-label {
    font-size: 0.8rem;
  }
}
</style>
