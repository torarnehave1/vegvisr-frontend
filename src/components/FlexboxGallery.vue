<template>
  <div class="flexbox-gallery">
    <div v-for="(image, index) in images" :key="index" class="gallery-item">
      <img :src="image.src" :alt="image.alt" class="gallery-image" />

      <!-- Add image buttons if user is Superadmin -->
      <div
        v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
        class="image-button-container"
      >
        <button
          class="btn btn-sm btn-outline-primary change-image-btn"
          :data-image-url="image.src"
          :data-image-alt="image.alt"
          :data-image-type="'FLEXBOX-GALLERY'"
          :data-image-context="`FLEXBOX-GALLERY image ${index + 1}`"
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
          :data-image-type="'FLEXBOX-GALLERY'"
          :data-image-context="`FLEXBOX-GALLERY image ${index + 1}`"
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
.flexbox-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  align-items: flex-start;
  max-width: 1000px;
  margin: 25px auto;
  padding: 20px;
}

.gallery-item {
  flex: 0 0 auto;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  background: white;
}

.gallery-item:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.gallery-image {
  width: 250px;
  height: 200px;
  object-fit: cover;
  display: block;
  border-radius: 12px;
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

/* Responsive design */
@media (max-width: 1024px) {
  .gallery-image {
    width: 220px;
    height: 180px;
  }

  .flexbox-gallery {
    gap: 15px;
    padding: 15px;
  }
}

@media (max-width: 768px) {
  .gallery-image {
    width: 180px;
    height: 150px;
  }

  .flexbox-gallery {
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .gallery-image {
    width: calc(50vw - 30px);
    height: calc(40vw - 24px);
    min-width: 120px;
    min-height: 100px;
  }

  .flexbox-gallery {
    gap: 10px;
    padding: 10px;
  }
}
</style>
