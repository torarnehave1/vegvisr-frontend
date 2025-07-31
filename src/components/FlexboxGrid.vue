<template>
  <div class="flexbox-grid">
    <div v-for="(image, index) in images" :key="index" class="grid-item">
      <img :src="image.src" :alt="image.alt" />
      
      <!-- Add image buttons if user is Superadmin -->
      <div 
        v-if="userStore.loggedIn && userStore.role === 'Superadmin'" 
        class="image-button-container"
      >
        <button 
          class="btn btn-sm btn-outline-primary change-image-btn"
          :data-image-url="image.src"
          :data-image-alt="image.alt"
          :data-image-type="'FLEXBOX-GRID'"
          :data-image-context="`FLEXBOX-GRID image ${index + 1}`"
          :data-node-id="props.nodeId"
          :data-node-content="props.nodeContent"
          title="Change this image"
        >
          Change Image
        </button>
        <button 
          class="btn btn-sm btn-outline-secondary google-photos-btn"
          :data-image-url="image.src"
          :data-image-alt="image.alt"
          :data-image-type="'FLEXBOX-GRID'"
          :data-image-context="`FLEXBOX-GRID image ${index + 1}`"
          :data-node-id="props.nodeId"
          :data-node-content="props.nodeContent"
          title="Search Google Images"
        >
          Google Image
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
  nodeId: {
    type: String,
    required: true,
  },
  nodeContent: {
    type: String,
    required: true,
  },
})

const userStore = useUserStore()

const images = computed(() => {
  const imageRegex = /!\[([^\]]*?)\]\(([^)]+)\)/g
  const matches = [...props.content.matchAll(imageRegex)]
  return matches.map((match) => ({
    alt: match[1],
    src: match[2],
  }))
})
</script>

<style scoped>
.flexbox-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 1000px;
  margin: 25px auto;
  padding: 20px;
  justify-items: center;
  align-items: start;
  background-color: #f0f8ff; /* Light blue for debugging */
  border: 2px solid #007bff; /* Blue border for debugging */
}

.grid-item {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background-color: white;
}

.grid-item img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
}

.image-button-container {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.change-image-btn,
.google-photos-btn {
  font-size: 0.8rem;
  padding: 4px 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .flexbox-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 15px;
  }
}

@media (max-width: 480px) {
  .flexbox-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px;
  }
}
</style>
