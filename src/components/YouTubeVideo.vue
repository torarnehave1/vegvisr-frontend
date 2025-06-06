<template>
  <div class="youtube-section">
    <h3 class="youtube-title">{{ title }}</h3>
    <div class="youtube-container">
      <iframe
        :src="embedUrl"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
        class="youtube-iframe"
      ></iframe>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: 'Untitled Video',
  },
})

const embedUrl = computed(() => {
  let url = props.src.trim()

  if (url.includes('youtube.com/embed/')) {
    return url.split('?')[0]
  } else if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0]
    return `https://www.youtube.com/embed/${videoId}`
  } else if (url.includes('youtube.com/watch?v=')) {
    const videoId = url.split('watch?v=')[1].split('&')[0]
    return `https://www.youtube.com/embed/${videoId}`
  }

  return url
})
</script>

<style scoped>
.youtube-section {
  margin: 20px 0;
  text-align: center;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.youtube-title {
  margin: 0 0 15px;
  font-size: 1.25rem;
  color: #333;
  font-weight: bold;
}

.youtube-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
  height: 0;
  overflow: hidden;
  border-radius: 8px;
}

.youtube-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
