<template>
  <Teleport to="body">
    <div class="tutorial-overlay" v-if="currentStepData?.target">
      <!-- Spotlight Mask -->
      <svg class="spotlight-mask" v-if="spotlightRect">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              :x="spotlightRect.x - padding"
              :y="spotlightRect.y - padding"
              :width="spotlightRect.width + padding * 2"
              :height="spotlightRect.height + padding * 2"
              :rx="borderRadius"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      <!-- Spotlight Border -->
      <div
        v-if="spotlightRect"
        class="spotlight-border"
        :class="{ 'pulse-animation': currentStepData?.highlight }"
        :style="spotlightStyle"
      ></div>

      <!-- Pointer Arrow -->
      <div
        v-if="spotlightRect && currentStepData?.pointer"
        class="pointer-arrow"
        :class="pointerDirection"
        :style="pointerStyle"
      >
        <div class="arrow"></div>
      </div>

      <!-- Click Indicator -->
      <div
        v-if="spotlightRect && currentStepData?.clickTarget"
        class="click-indicator"
        :style="clickIndicatorStyle"
      >
        <div class="click-ripple"></div>
        <div class="click-ripple delay-1"></div>
        <div class="click-ripple delay-2"></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTeacherStore } from '../../stores/teacherStore'

const teacherStore = useTeacherStore()

const spotlightRect = ref(null)
const padding = 8
const borderRadius = 8

const currentStepData = computed(() => teacherStore.currentStepData)

const spotlightStyle = computed(() => {
  if (!spotlightRect.value) return {}
  return {
    left: `${spotlightRect.value.x - padding}px`,
    top: `${spotlightRect.value.y - padding}px`,
    width: `${spotlightRect.value.width + padding * 2}px`,
    height: `${spotlightRect.value.height + padding * 2}px`,
    borderRadius: `${borderRadius}px`
  }
})

const pointerDirection = computed(() => {
  return currentStepData.value?.pointerDirection || 'bottom'
})

const pointerStyle = computed(() => {
  if (!spotlightRect.value) return {}
  const rect = spotlightRect.value
  const direction = pointerDirection.value

  let x, y
  switch (direction) {
    case 'top':
      x = rect.x + rect.width / 2
      y = rect.y - padding - 20
      break
    case 'bottom':
      x = rect.x + rect.width / 2
      y = rect.y + rect.height + padding + 20
      break
    case 'left':
      x = rect.x - padding - 20
      y = rect.y + rect.height / 2
      break
    case 'right':
      x = rect.x + rect.width + padding + 20
      y = rect.y + rect.height / 2
      break
    default:
      x = rect.x + rect.width / 2
      y = rect.y + rect.height + padding + 20
  }

  return {
    left: `${x}px`,
    top: `${y}px`
  }
})

const clickIndicatorStyle = computed(() => {
  if (!spotlightRect.value) return {}
  const rect = spotlightRect.value
  return {
    left: `${rect.x + rect.width / 2}px`,
    top: `${rect.y + rect.height / 2}px`
  }
})

function updateSpotlight() {
  const target = currentStepData.value?.target
  if (!target) {
    spotlightRect.value = null
    return
  }

  // Handle special selectors that aren't valid CSS
  let element = null
  
  try {
    // Try standard CSS selector first
    if (!target.includes(':has-text(')) {
      element = document.querySelector(target)
    } else {
      // Handle Playwright-style :has-text() selector
      // Extract the text to match
      const textMatch = target.match(/:has-text\(['"]?([^'"]+)['"]?\)/)
      if (textMatch) {
        const searchText = textMatch[1]
        const baseSelector = target.replace(/:has-text\([^)]+\)/, '')
        
        // Find all matching base elements and filter by text
        const candidates = document.querySelectorAll(baseSelector || '*')
        for (const el of candidates) {
          if (el.textContent?.includes(searchText)) {
            element = el
            break
          }
        }
      }
    }
  } catch (e) {
    console.warn('Invalid selector:', target, e.message)
    spotlightRect.value = null
    return
  }
  
  if (element) {
    const rect = element.getBoundingClientRect()
    spotlightRect.value = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    }
  } else {
    spotlightRect.value = null
  }
}

// Watch for step changes
watch(currentStepData, () => {
  // Small delay to let DOM update
  setTimeout(updateSpotlight, 100)
})

// Handle window resize
let resizeTimeout = null
function handleResize() {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(updateSpotlight, 100)
}

// Handle scroll
function handleScroll() {
  updateSpotlight()
}

onMounted(() => {
  updateSpotlight()
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<style scoped>
.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none;
}

.spotlight-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.spotlight-border {
  position: absolute;
  border: 2px solid var(--teacher-primary, #6366f1);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
  transition: all 0.3s ease;
}

.spotlight-border.pulse-animation {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.1);
  }
}

/* Pointer Arrow */
.pointer-arrow {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: bounce-pointer 1s ease-in-out infinite;
}

.pointer-arrow .arrow {
  width: 0;
  height: 0;
  border-style: solid;
}

.pointer-arrow.bottom .arrow {
  border-width: 0 10px 16px 10px;
  border-color: transparent transparent var(--teacher-primary, #6366f1) transparent;
}

.pointer-arrow.top .arrow {
  border-width: 16px 10px 0 10px;
  border-color: var(--teacher-primary, #6366f1) transparent transparent transparent;
}

.pointer-arrow.left .arrow {
  border-width: 10px 16px 10px 0;
  border-color: transparent var(--teacher-primary, #6366f1) transparent transparent;
}

.pointer-arrow.right .arrow {
  border-width: 10px 0 10px 16px;
  border-color: transparent transparent transparent var(--teacher-primary, #6366f1);
}

@keyframes bounce-pointer {
  0%, 100% {
    transform: translate(-50%, -50%);
  }
  50% {
    transform: translate(-50%, calc(-50% - 8px));
  }
}

.pointer-arrow.left,
.pointer-arrow.right {
  animation: bounce-pointer-horizontal 1s ease-in-out infinite;
}

@keyframes bounce-pointer-horizontal {
  0%, 100% {
    transform: translate(-50%, -50%);
  }
  50% {
    transform: translate(calc(-50% - 8px), -50%);
  }
}

/* Click Indicator */
.click-indicator {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
}

.click-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--teacher-primary, #6366f1);
  transform: translate(-50%, -50%);
  animation: ripple 1.5s ease-out infinite;
}

.click-ripple.delay-1 {
  animation-delay: 0.5s;
}

.click-ripple.delay-2 {
  animation-delay: 1s;
}

@keyframes ripple {
  0% {
    width: 20px;
    height: 20px;
    opacity: 1;
  }
  100% {
    width: 60px;
    height: 60px;
    opacity: 0;
  }
}
</style>
