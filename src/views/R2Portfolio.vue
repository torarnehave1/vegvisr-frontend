<template>
  <div class="portfolio-grid">
    <div v-for="img in images" :key="img.key" class="portfolio-card">
      <img :src="img.url" :alt="img.key" class="portfolio-thumb" />
      <div class="portfolio-caption">{{ img.key }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const images = ref([])

onMounted(async () => {
  const res = await fetch('https://api.vegvisr.org/list-r2-images')
  const data = await res.json()
  images.value = data.images
})
</script>

<style scoped>
.portfolio-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: flex-start;
}
.portfolio-card {
  width: 180px;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.portfolio-thumb {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
}
.portfolio-caption {
  font-size: 0.9em;
  padding: 8px;
  text-align: center;
  word-break: break-all;
}
</style>
