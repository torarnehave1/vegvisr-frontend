<template>
  <div
    class="markdown-editor"
    :class="{ embedded: isEmbedded }"
    @contextmenu.prevent="showContextMenu($event)"
    @click="closeContextMenu"
  >
    <div v-if="!isEmbedded" class="mode-toggle">
      <button :class="{ active: mode === 'edit' }" @click="setMode('edit')">Edit</button>
      <button :class="{ active: mode === 'preview' }" @click="setMode('preview')">Preview</button>
    </div>

    <!-- Edit Mode -->
    <div v-if="mode === 'edit'">
      <textarea
        ref="textarea"
        v-model="markdown"
        placeholder="Enter your markdown here..."
        @click="closeContextMenu"
      ></textarea>
    </div>

    <!-- Preview Mode -->
    <div v-else class="preview" v-html="renderedMarkdown"></div>

    <button v-if="!isEmbedded" class="save-button" @click="saveContent">Save</button>
    <div v-if="shareableLink" class="info">
      Shareable Link: <a :href="shareableLink" target="_blank">{{ shareableLink }}</a>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <button @click="addSnippet">Add Snippet</button>
      <div class="submenu">
        <button @click="loadSnippetKeys">Insert Snippet</button>
        <div class="submenu-items" v-if="snippetKeys.length > 0">
          <button v-for="key in snippetKeys" :key="key" @click="insertSnippet(key)">
            {{ key }}
          </button>
        </div>
      </div>
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
const contextMenu = ref({ visible: false, x: 0, y: 0, selectedText: '' })
const snippetKeys = ref([])
const textareaRef = ref(null)

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
    const response = await fetch('https://api.vegvisr.org/save', {
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

// Show context menu
function showContextMenu(event) {
  const selection = window.getSelection()
  const selectedText = selection.toString()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    selectedText: selectedText,
  }
}

// Close context menu
function closeContextMenu() {
  contextMenu.value.visible = false
}

// Add snippet to KV namespace
async function addSnippet() {
  const textarea = textareaRef.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const snippetContent = markdown.value.slice(start, end)

  if (!snippetContent) {
    alert('No text selected to add as a snippet.')
    return
  }

  const snippetId = prompt('Enter a unique ID for the snippet:')
  if (!snippetId) {
    alert('Snippet ID is required.')
    return
  }

  try {
    const response = await fetch('https://api.vegvisr.org/snippetadd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: snippetId, content: snippetContent }),
    })

    if (!response.ok) {
      throw new Error('Failed to add snippet')
    }

    alert('Snippet added successfully.')
  } catch (error) {
    console.error('Error adding snippet:', error)
    alert('Failed to add snippet. Please try again.')
  } finally {
    closeContextMenu()
  }
}

// Load snippet keys from KV namespace
async function loadSnippetKeys() {
  try {
    const response = await fetch('https://api.vegvisr.org/snippetlist', {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to load snippet keys')
    }

    const data = await response.json()
    snippetKeys.value = data.keys.map((key) => key.name)
  } catch (error) {
    console.error('Error loading snippet keys:', error)
    alert('Failed to load snippet keys. Please try again.')
  }
}

// Insert snippet into textarea
async function insertSnippet(key) {
  try {
    const response = await fetch(`https://api.vegvisr.org/snippets/${key}`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch snippet content')
    }

    const data = await response.json()
    const snippetContent = data.content

    const textarea = textareaRef.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const before = markdown.value.slice(0, start)
    const after = markdown.value.slice(end)
    markdown.value = before + snippetContent + after
  } catch (error) {
    console.error('Error inserting snippet:', error)
    alert('Failed to insert snippet. Please try again.')
  } finally {
    closeContextMenu()
  }
}
</script>

<style scoped>
.markdown-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
  position: relative;
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

.context-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.context-menu button {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}

.context-menu button:hover {
  background-color: #f1f1f1;
}

.submenu {
  position: relative;
}

.submenu-items {
  display: none;
  position: absolute;
  top: 0;
  left: 100%;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.submenu:hover .submenu-items {
  display: block;
}

.submenu-items button {
  padding: 0.5rem 1rem;
  width: 100%;
}

.submenu-items button:hover {
  background-color: #f1f1f1;
}
</style>
