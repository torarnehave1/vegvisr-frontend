<template>
  <div class="markdown-editor">
    <div class="mode-toggle">
      <button :class="{ active: mode === 'edit' }" @click="setMode('edit')">Edit</button>
      <button :class="{ active: mode === 'preview' }" @click="setMode('preview')">Preview</button>
    </div>

    <!-- Edit Mode -->
    <div v-if="mode === 'edit'">
      <textarea v-model="markdown" placeholder="Enter your markdown here..."></textarea>
    </div>

    <!-- Preview Mode -->
    <div v-else class="preview" v-html="renderedMarkdown"></div>

    <button class="save-button" @click="saveContent">Save</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { marked } from 'marked' // Ensure you have installed marked (npm install marked)

const mode = ref('edit')
const markdown = ref('')

// Render markdown to HTML using the marked library
const renderedMarkdown = computed(() => {
  return marked.parse(markdown.value)
})

// Toggle between "edit" and "preview" modes
function setMode(newMode) {
  mode.value = newMode
}

// Placeholder function for saving content
function saveContent() {
  // Later, you can replace this with an API call to your Cloudflare Worker endpoint
  console.log('Saving content:', markdown.value)
}
</script>

<style scoped>
.markdown-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.mode-toggle {
  margin-bottom: 1rem;
}

.mode-toggle button {
  padding: 0.5rem 1rem;
  margin-right: 0.5rem;
  border: 1px solid #007bff;
  background-color: white;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.mode-toggle button.active,
.mode-toggle button:hover {
  background-color: #007bff;
  color: white;
}

textarea {
  width: 100%;
  height: 300px;
  padding: 1rem;
  font-size: 1rem;
  font-family: monospace;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
}

.preview {
  border: 1px solid #ccc;
  padding: 1rem;
  min-height: 300px;
  background-color: #f9f9f9;
}

.save-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #28a745;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.save-button:hover {
  background-color: #218838;
}
</style>
