<template>
  <div class="meta-area-sidebar">
    <h5 class="mb-3">Meta Area</h5>
    <ul class="list-group">
      <li
        class="list-group-item"
        :class="{ active: selected === null }"
        @click="$emit('select', null)"
      >
        All
      </li>
      <li
        v-for="area in metaAreas"
        :key="area"
        class="list-group-item"
        :class="{ active: selected === area }"
        @click="$emit('select', area)"
      >
        {{ area }}
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  metaAreas: Array,
  selected: String,
})
defineEmits(['select'])
</script>

<style scoped>
.meta-area-sidebar {
  min-width: 200px;
  max-width: 250px;
  padding: 1rem 0.5rem;
  border-right: 1px solid #eee;
  background: #fafbfc;
}
.list-group-item.active {
  background: #007bff;
  color: #fff;
  cursor: default;
}
.list-group-item {
  cursor: pointer;
}
</style>
