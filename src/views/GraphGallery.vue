<template>
  <div class="gallery-grid">
    <div v-for="graph in graphs" :key="graph.id" class="gallery-card">
      <img
        v-if="graph.image && !graph.image.includes('placeholder.com')"
        :src="graph.image"
        alt="Graph Image"
        class="gallery-image"
      />
      <h3 class="gallery-title">{{ graph.title }}</h3>
      <div class="gallery-btn-group">
        <button class="gallery-view-btn" @click="$emit('view-graph', graph)">View Graph</button>
        <button class="gallery-edit-btn" @click="$emit('edit-graph', graph)">Edit Graph</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Props: graphs (array of {id, title, image})
defineProps({
  graphs: {
    type: Array,
    required: true,
  },
})
</script>

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  padding: 24px;
}
.gallery-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 12px 16px 12px;
  transition: box-shadow 0.2s;
}
.gallery-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
.gallery-image {
  width: 100%;
  max-width: 180px;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 12px;
  background: #f0f0f0;
}
.gallery-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #222;
  margin: 0 0 10px 0;
  text-align: center;
}
.gallery-btn-group {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.gallery-view-btn,
.gallery-edit-btn {
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 7px 14px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.gallery-edit-btn {
  background: #6c757d;
}
.gallery-view-btn:hover {
  background: #0056b3;
}
.gallery-edit-btn:hover {
  background: #495057;
}
</style>
