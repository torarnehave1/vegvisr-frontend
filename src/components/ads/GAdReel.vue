<template>
  <div
    class="ad-reel"
    role="region"
    :aria-label="ariaLabel"
    @keydown.left.prevent="() => handleUserInteraction(goPrev)"
    @keydown.right.prevent="() => handleUserInteraction(goNext)"
    @mouseenter="props.pauseOnHover && stopAutoPlay()"
    @mouseleave="props.pauseOnHover && startAutoPlay()"
    tabindex="0"
  >
    <div class="reel-viewport">
      <!-- Container that slides left/right -->
      <div class="reel-container" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <div
          v-for="(slide, index) in slides"
          :key="`slide-${index}-${slide?.substring(0, 50) || 'empty'}`"
          class="reel-slide"
        >
          <slot :slide="slide">
            <!-- Fallback: render raw text if no slot provided -->
            <div class="reel-default-slide">{{ slide }}</div>
          </slot>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="reel-controls" aria-hidden="false">
      <button
        v-if="arrows"
        type="button"
        class="reel-arrow left"
        @click="() => handleUserInteraction(goPrev)"
        :aria-label="`Previous slide (${currentIndex + 1} of ${slides.length})`"
      >
        ‹
      </button>
      <button
        v-if="arrows"
        type="button"
        class="reel-arrow right"
        @click="() => handleUserInteraction(goNext)"
        :aria-label="`Next slide (${currentIndex + 1} of ${slides.length})`"
      >
        ›
      </button>

      <ul v-if="indicators && slides.length > 1" class="reel-indicators" role="tablist">
        <li v-for="(s, i) in slides" :key="i" role="presentation">
          <button
            type="button"
            class="reel-dot"
            :class="{ active: i === currentIndex }"
            :aria-selected="i === currentIndex"
            role="tab"
            :aria-label="`${labelPrefix} ${i + 1} of ${slides.length}`"
            @click="() => handleUserInteraction(() => goTo(i))"
          />
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  slides: { type: Array, required: true },
  startIndex: { type: Number, default: 0 },
  indicators: { type: Boolean, default: true },
  arrows: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  labelPrefix: { type: String, default: 'Slide' },
  ariaLabel: { type: String, default: 'Advertisement carousel' },
  autoPlay: { type: Boolean, default: true },
  autoPlayInterval: { type: Number, default: 4000 }, // 4 seconds
  pauseOnHover: { type: Boolean, default: true },
})

const emit = defineEmits(['slideChange'])

const currentIndex = ref(Math.min(Math.max(props.startIndex || 0, 0), props.slides.length - 1))

watch(
  () => props.startIndex,
  (val) => {
    const idx = Math.min(Math.max(val || 0, 0), props.slides.length - 1)
    if (idx !== currentIndex.value) {
      currentIndex.value = idx
      emit('slideChange', idx)
    }
  },
)

// Watch for slides changes to reset the current index if needed
watch(
  () => props.slides,
  (newSlides) => {
    // If current index is out of bounds, reset to 0
    if (currentIndex.value >= newSlides.length) {
      currentIndex.value = 0
      emit('slideChange', 0)
    }
  },
  { deep: true },
)

const goTo = (i) => {
  const clamped = Math.min(Math.max(i, 0), props.slides.length - 1)
  if (clamped !== currentIndex.value) {
    currentIndex.value = clamped
    emit('slideChange', clamped)
  }
}

const goPrev = () => {
  if (currentIndex.value > 0) return goTo(currentIndex.value - 1)
  if (props.loop) return goTo(props.slides.length - 1)
}

const goNext = () => {
  if (currentIndex.value < props.slides.length - 1) return goTo(currentIndex.value + 1)
  if (props.loop) return goTo(0)
}

// Auto-play functionality
let autoPlayTimer = null

const startAutoPlay = () => {
  if (props.autoPlay && props.slides.length > 1) {
    autoPlayTimer = setInterval(() => {
      goNext()
    }, props.autoPlayInterval)
  }
}

const stopAutoPlay = () => {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

const restartAutoPlay = () => {
  stopAutoPlay()
  startAutoPlay()
}

// Start auto-play when component mounts
onMounted(() => {
  if (props.autoPlay) {
    startAutoPlay()
  }
})

// Clean up timer when component unmounts
onUnmounted(() => {
  stopAutoPlay()
})

// Restart auto-play when user interacts (so it doesn't feel broken)
const handleUserInteraction = (action) => {
  if (props.autoPlay) {
    stopAutoPlay()
    action()
    // Restart after a short delay to give user time to interact further
    setTimeout(startAutoPlay, 1000)
  } else {
    action()
  }
}
</script>

<style scoped>
.ad-reel {
  position: relative;
  outline: none;
}
.reel-viewport {
  position: relative;
  width: 100%;
  overflow: hidden; /* Hide slides that are not visible */
}

.reel-container {
  display: flex;
  width: 100%;
  transition: transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Smooth easing */
}

.reel-slide {
  width: 100%;
  flex-shrink: 0; /* Prevent slides from shrinking */
  position: relative;
  backface-visibility: hidden; /* Optimize for smoother animations */
}
.reel-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.reel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  cursor: pointer;
}
.reel-arrow.left {
  left: 8px;
}
.reel-arrow.right {
  right: 8px;
}

.reel-indicators {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  margin: 0;
}
.reel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #cfd8dc;
  cursor: pointer;
}
.reel-dot.active {
  background: #1976d2;
}
</style>
