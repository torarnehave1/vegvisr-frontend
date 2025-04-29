<!-- src/components/TopBar.vue -->
<template>
  <div class="top-bar sticky-top bg-light p-3 border-bottom">
    <div class="container-fluid">
      <div class="row align-items-center">
        <!-- Sidebar Toggle Button -->
        <div class="col-auto">
          <button class="btn btn-outline-secondary" @click="$emit('toggle-sidebar')">
            <span class="material-icons"> menu </span>
          </button>
        </div>
        <!-- Graph Selector -->
        <div class="col-md-4 col-sm-12">
          <label for="graphDropdown" class="form-label">
            <strong>Select Knowledge Graph:</strong>
          </label>
          <select
            id="graphDropdown"
            :value="selectedGraphId"
            @change="$emit('update:selectedGraphId', $event.target.value)"
            class="form-select"
          >
            <option value="" disabled>Select a graph</option>
            <option v-for="graph in knowledgeGraphs" :key="graph.id" :value="graph.id">
              {{ graph.title }}
            </option>
          </select>
        </div>
        <!-- Current Graph ID -->
        <div class="col-md-4 col-sm-12 text-center">
          <p class="mb-0">
            <strong>Current Graph ID:</strong>
            <span>{{ currentGraphId || 'Not saved yet' }}</span>
          </p>
        </div>
        <!-- Validation Errors -->
        <div class="col-md-4 col-sm-12">
          <div v-if="validationErrors.length" class="alert alert-danger mb-0" role="alert">
            <strong>Graph Validation Errors:</strong>
            <ul class="mb-0">
              <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

defineProps({
  selectedGraphId: String,
  knowledgeGraphs: Array,
  currentGraphId: String,
  validationErrors: Array,
})

defineEmits(['update:selectedGraphId', 'toggle-sidebar'])
</script>

<style scoped>
.top-bar {
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
