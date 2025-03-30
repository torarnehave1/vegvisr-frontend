<template>
  <div class="markdown-editor" :class="{ embedded: isEmbedded }">
    <div v-if="!isEmbedded" class="mode-toggle">
      <button :class="{ active: mode === 'edit' }" @click="setMode('edit')">Edit</button>
      <button :class="{ active: mode === 'preview' }" @click="setMode('preview')">Preview</button>
    </div>

    <!-- Edit Mode -->
    <div v-if="mode === 'edit'">
      <textarea v-model="markdown" placeholder="Enter your markdown here..."></textarea>
    </div>

    <!-- Preview Mode -->
    <div v-else class="preview" v-html="renderedMarkdown"></div>

    <button v-if="!isEmbedded" class="save-button" @click="saveContent">Save</button>
    <div v-if="shareableLink" class="info">
      Shareable Link: <a :href="shareableLink" target="_blank">{{ shareableLink }}</a>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked' // Ensure you have installed marked (npm install marked)

const route = useRoute()
const isEmbedded = ref(false)

const mode = ref('edit')
const markdown = ref('')
const shareableLink = ref('')

// Check if the embed query parameter is set to true
isEmbedded.value = route.query.embed === 'true'

// Render markdown to HTML using the marked library
const renderedMarkdown = computed(() => {
  return marked.parse(markdown.value)
})

// Toggle between "edit" and "preview" modes
function setMode(newMode) {
  mode.value = newMode
}

// Save markdown content and display shareable link
async function saveContent() {
  try {
    const response = await fetch('https:/api.vegvisr.org/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ markdown: markdown.value }),
    })

    if (!response.ok) {
      throw new Error('Failed to save content')
    }

    const data = await response.json()
    shareableLink.value = data.link
  } catch (error) {
    console.error('Error saving content:', error)
    alert('Failed to save content. Please try again.')
  }
}
</script>

<style scoped>
.markdown-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.markdown-editor.embedded {
  margin: 0;
  padding: 0;
  border: none;
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

.info {
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.info a {
  color: #007bff;
  text-decoration: none;
}

.info a:hover {
  text-decoration: underline;
}
</style>
