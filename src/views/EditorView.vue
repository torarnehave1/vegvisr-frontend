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
        ref="textareaRef"
        v-model="markdown"
        placeholder="Enter your markdown here..."
        @click="closeContextMenu"
      ></textarea>
      <!-- File Upload Form -->
      <form @submit.prevent="uploadImage" class="upload-form">
        <input type="file" ref="fileInput" accept="image/*" />
        <button type="submit">Upload Image</button>
      </form>
    </div>

    <!-- Preview Mode -->
    <div v-else class="preview" v-html="renderedMarkdown"></div>

    <button v-if="!isEmbedded" class="save-button" @click="saveContent">Save</button>
    <button v-if="!isEmbedded" class="reset-button" @click="clearContent">New</button>
    <div v-if="shareableLink" class="info">
      Shareable Link: <span v-if="store.state.currentBlogId">{{ shareableLink }}</span>
      <span v-else>New</span>
    </div>

    <div class="visibility-toggle">
      <label>
        <input type="checkbox" v-model="isVisible" />
        Visible in Blog Listing
      </label>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
    >
      <div v-if="snippetKeys.length > 0">
        <button v-for="key in snippetKeys" :key="key" @click="insertSnippet(key)">
          Insert Snippet: {{ key }}
        </button>
      </div>
      <div v-else>
        <p>No snippets available</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked' // Ensure you have installed marked (npm install marked)
import { useUserStore } from '@/stores/userStore'
import { useBlogStore } from '@/stores/blogStore'

const route = useRoute()
const userStore = useUserStore() // Access the Pinia store
const blogStore = useBlogStore() // Access the Pinia blog store
const isEmbedded = ref(false)
const email = ref(userStore.email) // Declare email as a ref variable

const mode = ref('edit')
const markdown = computed(() => blogStore.markdown)
const isVisible = computed(() => blogStore.isVisible)
const shareableLink = computed(() => blogStore.shareableLink)
const contextMenu = ref({ visible: false, x: 0, y: 0, selectedText: '' })
const snippetKeys = ref([])
const textareaRef = ref(null)
const cursorPosition = ref(0) // Track the cursor position
const pendingSnippet = ref(null) // Temporary variable to store the snippet
const fileInput = ref(null) // Reference to the file input
const theme = ref('light') // Declare theme as a ref variable

// Check if the embed query parameter is set to true
isEmbedded.value = route.query.embed === 'true'

// Render markdown to HTML using the marked library
const renderedMarkdown = computed(() => {
  return marked.parse(markdown.value)
})

// Set the content from query parameters if available
onMounted(() => {
  const content = route.query.content
  if (content) {
    console.log('Setting content in editor:', content) // Debugging log
    markdown.value = content
  } else {
    console.warn('No content provided in query parameters.') // Debugging log
  }
})

onMounted(() => {
  const queryEmail = route.query.email
  const queryToken = route.query.token

  if (queryEmail) {
    email.value = queryEmail
  }

  if (queryToken) {
    localStorage.setItem('jwt', queryToken)
    console.log('JWT token stored in Local Storage:', queryToken)
  } else if (queryEmail) {
    fetch('https://api.vegvisr.org/set-jwt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: queryEmail }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch JWT token')
        }
        return response.json()
      })
      .then((data) => {
        if (data.jwt) {
          localStorage.setItem('jwt', data.jwt)
          console.log('JWT token fetched and stored in Local Storage:', data.jwt)
          alert('Your session has been reset. Please try logging in again.')
        }
      })
      .catch((error) => {
        console.error('Error fetching JWT token:', error)
      })
  }

  theme.value = localStorage.getItem('theme') || 'light'
})

// Toggle between "edit" and "preview" modes
function setMode(newMode) {
  mode.value = newMode

  // If switching to "edit" mode and a snippet is pending, insert it
  if (newMode === 'edit' && pendingSnippet.value) {
    const textarea = textareaRef.value
    if (textarea) {
      insertSnippetIntoTextarea(pendingSnippet.value, textarea)
      markdown.value = textarea.value // Update markdown value
      pendingSnippet.value = null // Clear the pending snippet
    }
  }
}

// Save markdown content and display shareable link
async function saveContent() {
  try {
    const email = userStore.email // Get the current user's email from the user store
    if (!email) {
      throw new Error('User email is missing. Please log in.')
    }

    if (blogStore.currentBlogId) {
      const overwrite = confirm(
        'This document already exists. Do you want to overwrite it? Click Cancel to save as a new document.',
      )
      if (!overwrite) {
        blogStore.currentBlogId = null // Clear the currentBlogId to save as a new document
      }
    }

    await blogStore.saveBlog(email) // Use blogStore's saveBlog action

    // Display a success message
    const messageElement = document.createElement('div')
    messageElement.textContent = 'Content saved successfully.'
    messageElement.style.position = 'fixed'
    messageElement.style.bottom = '20px'
    messageElement.style.right = '20px'
    messageElement.style.backgroundColor = '#28a745'
    messageElement.style.color = 'white'
    messageElement.style.padding = '10px 20px'
    messageElement.style.borderRadius = '5px'
    messageElement.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'
    document.body.appendChild(messageElement)

    setTimeout(() => {
      document.body.removeChild(messageElement)
    }, 3000)
  } catch (error) {
    console.error('Error saving content:', error)
    alert('Failed to save content. Please try again.')
  }
}

// Show context menu and load snippet keys
async function showContextMenu(event) {
  console.log('showContextMenu: mode.value:', mode.value) // Debugging statement

  // Ensure the editor is in "Edit" mode
  if (mode.value !== 'edit') {
    console.warn('showContextMenu: Not in Edit mode.') // Debugging statement
    return
  }

  // Wait for the DOM to update before accessing textareaRef
  await nextTick()
  let textarea = textareaRef.value
  if (!textarea) {
    console.warn('showContextMenu: Textarea is not available. Retrying...') // Debugging statement
    await new Promise((resolve) => setTimeout(resolve, 50)) // Wait 50ms
    textarea = textareaRef.value
  }

  console.log('showContextMenu: textareaRef.value after retry:', textarea) // Debugging statement

  if (textarea) {
    cursorPosition.value = textarea.selectionStart || 0 // Save the cursor position
    console.log('showContextMenu: cursorPosition:', cursorPosition.value) // Debugging statement
  } else {
    console.error('showContextMenu: Textarea is still not available after retry.') // Debugging statement
    return
  }

  // Load snippet keys when the context menu is opened
  try {
    const response = await fetch('https://api.vegvisr.org/snippetlist', {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to load snippet keys')
    }

    const data = await response.json()
    snippetKeys.value = data.keys.map((key) => key.name)
    console.log('showContextMenu: snippetKeys:', snippetKeys.value) // Debugging statement
  } catch (error) {
    console.error('Error loading snippet keys:', error)
    alert('Failed to load snippet keys. Please try again.')
  }

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
  }
  console.log('showContextMenu: contextMenu:', contextMenu.value) // Debugging statement
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

// Function to insert snippet into the textarea
function insertSnippetIntoTextarea(snippetContent, textarea) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentText = textarea.value

  const before = currentText.substring(0, start)
  const after = currentText.substring(end)

  textarea.value = before + snippetContent + after
  textarea.selectionStart = textarea.selectionEnd = start + snippetContent.length
  textarea.focus()
}

// Insert snippet into textarea
async function insertSnippet(key) {
  console.log('insertSnippet: key:', key) // Debugging statement
  try {
    const response = await fetch(`https://api.vegvisr.org/snippets/${key}`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch snippet content')
    }

    const data = await response.json()
    const snippetContent = data.content
    console.log('insertSnippet: snippetContent:', snippetContent) // Debugging statement

    // Ensure the textarea is available and the mode is 'edit'
    console.log('insertSnippet: mode.value:', mode.value) // Debugging statement
    if (mode.value !== 'edit') {
      alert('Textarea is not available. The snippet will be inserted when you switch to Edit mode.')
      pendingSnippet.value = snippetContent // Store the snippet temporarily
      return
    }

    await nextTick() // Ensure DOM updates before accessing textareaRef
    const textarea = textareaRef.value
    console.log('insertSnippet: textareaRef.value:', textarea) // Debugging statement
    if (!textarea) {
      alert('Textarea element is not available.')
      return
    }

    // Use the provided logic to insert the snippet into the textarea
    insertSnippetIntoTextarea(snippetContent, textarea)

    // Update the markdown value to reflect the new content in the textarea
    markdown.value = textarea.value
    console.log('insertSnippet: markdown.value:', markdown.value) // Debugging statement
  } catch (error) {
    console.error('Error inserting snippet:', error)
    alert('Failed to insert snippet. Please try again.')
  } finally {
    closeContextMenu()
  }
}

// Upload image and insert markdown into textarea
async function uploadImage() {
  const file = fileInput.value?.files[0]
  if (!file) {
    alert('Please select an image to upload.')
    return
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Only image files are allowed.')
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'image')
  try {
    const response = await fetch('https://api.vegvisr.org/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const data = await response.json()
    const imageUrl = data.url
    const markdownImage = `![Image](${imageUrl})`

    console.log('Image uploaded successfully:', imageUrl)

    // Insert the markdown for the image into the textarea
    const textarea = textareaRef.value
    if (textarea) {
      insertSnippetIntoTextarea(markdownImage, textarea)
      markdown.value = textarea.value // Update markdown value
    } else {
      console.error('Textarea is not available.')
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    alert('Failed to upload image. Please try again.')
  }
}

// Clear the content of the textarea and reset the blog ID
function clearContent() {
  blogStore.clearBlog()
  console.log('Content reset. Blog ID set to null, and shareable link cleared.')
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

.reset-button {
  margin-top: 1rem;
  margin-left: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #ffc107; /* Yellow to indicate a reset action */
  color: black;
  cursor: pointer;
  transition: background-color 0.2s;
}

.reset-button:hover {
  background-color: #e0a800;
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

.upload-form {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}

.upload-form input[type='file'] {
  flex: 1;
}

.upload-form button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.upload-form button:hover {
  background-color: #0056b3;
}

.visibility-toggle {
  margin-top: 1rem;
  font-size: 1rem;
}

.visibility-toggle label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.visibility-toggle input[type='checkbox'] {
  width: 16px;
  height: 16px;
}
</style>
