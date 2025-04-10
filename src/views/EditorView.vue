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
import { ref, computed, nextTick, onMounted, watch } from 'vue'
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
const markdown = ref(blogStore.markdown)
const isVisible = computed(() => blogStore.isVisible)
const shareableLink = computed(() => blogStore.shareableLink)
const contextMenu = ref({ visible: false, x: 0, y: 0, selectedText: '' })
const snippetKeys = ref([])() => blogStore.isVisible)
const textareaRef = ref(null)d(() => blogStore.shareableLink)
const cursorPosition = ref(0) // Track the cursor positionctedText: '' })
const pendingSnippet = ref(null) // Temporary variable to store the snippet
const fileInput = ref(null) // Reference to the file input
const theme = ref('light') // Declare theme as a ref variable
const pendingSnippet = ref(null) // Temporary variable to store the snippet
watch(markdown, (newValue) => { input
  blogStore.markdown = newValuea ref variable
})
e
onMounted(() => {'true'
  markdown.value = blogStore.markdown
}) Render markdown to HTML using the marked library
const renderedMarkdown = computed(() => {
// Check if the embed query parameter is set to true
isEmbedded.value = route.query.embed === 'true'

// Render markdown to HTML using the marked librarynt from query parameters if available
const renderedMarkdown = computed(() => {
  return marked.parse(markdown.value)y.content
})ent) {

// Set the content from query parameters if available markdown.value = content
onMounted(() => {} else {
  const content = route.query.content    console.warn('No content provided in query parameters.') // Debugging log
  if (content) {
    console.log('Setting content in editor:', content) // Debugging log
    markdown.value = content
  } else {onMounted(() => {
    console.warn('No content provided in query parameters.') // Debugging log= route.query.email
  }uery.token
})
  if (queryEmail) {
onMounted(() => {ueryEmail
  const queryEmail = route.query.email
  const queryToken = route.query.token

  if (queryEmail) {
    email.value = queryEmailtoken stored in Local Storage:', queryToken)
  }ryEmail) {
, {
  if (queryToken) {thod: 'POST',
    localStorage.setItem('jwt', queryToken)
    console.log('JWT token stored in Local Storage:', queryToken)  'Content-Type': 'application/json',
  } else if (queryEmail) {
    fetch('https://api.vegvisr.org/set-jwt', {{ email: queryEmail }),
      method: 'POST',
      headers: {en((response) => {
        'Content-Type': 'application/json',
      },  throw new Error('Failed to fetch JWT token')
      body: JSON.stringify({ email: queryEmail }),
    }).json()
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch JWT token')
        } localStorage.setItem('jwt', data.jwt)
        return response.json()  console.log('JWT token fetched and stored in Local Storage:', data.jwt)
      })sion has been reset. Please try logging in again.')
      .then((data) => {
        if (data.jwt) {
          localStorage.setItem('jwt', data.jwt)   .catch((error) => {
          console.log('JWT token fetched and stored in Local Storage:', data.jwt)        console.error('Error fetching JWT token:', error)
          alert('Your session has been reset. Please try logging in again.')
        }}
      })
      .catch((error) => {) || 'light'
        console.error('Error fetching JWT token:', error)
      })
  }// Toggle between "edit" and "preview" modes

  theme.value = localStorage.getItem('theme') || 'light'
})
o "edit" mode and a snippet is pending, insert it
// Toggle between "edit" and "preview" modes
function setMode(newMode) {
  mode.value = newMode
 insertSnippetIntoTextarea(pendingSnippet.value, textarea)
  // If switching to "edit" mode and a snippet is pending, insert it   markdown.value = textarea.value // Update markdown value
  if (newMode === 'edit' && pendingSnippet.value) {     pendingSnippet.value = null // Clear the pending snippet
    const textarea = textareaRef.value    }
    if (textarea) {
      insertSnippetIntoTextarea(pendingSnippet.value, textarea)
      markdown.value = textarea.value // Update markdown value
      pendingSnippet.value = null // Clear the pending snippet
    }veContent() {
  }
}onst email = userStore.email // Get the current user's email from the user store
    if (!email) {
// Save markdown content and display shareable linkis missing. Please log in.')
async function saveContent() {
  try {
    const email = userStore.email // Get the current user's email from the user store(blogStore.currentBlogId) {
    if (!email) { confirm(
      throw new Error('User email is missing. Please log in.') a new document.',
    }
 if (!overwrite) {
    if (blogStore.currentBlogId) {        blogStore.currentBlogId = null // Clear the currentBlogId to save as a new document
      const overwrite = confirm(
        'This document already exists. Do you want to overwrite it? Click Cancel to save as a new document.',    }
      )
      if (!overwrite) {aveBlog action
        blogStore.currentBlogId = null // Clear the currentBlogId to save as a new document
      }
    }teElement('div')
nt saved successfully.'
    await blogStore.saveBlog(email) // Use blogStore's saveBlog action

    // Display a success message
    const messageElement = document.createElement('div')28a745'
    messageElement.textContent = 'Content saved successfully.'
    messageElement.style.position = 'fixed''
    messageElement.style.bottom = '20px'    messageElement.style.borderRadius = '5px'
    messageElement.style.right = '20px'le.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'
    messageElement.style.backgroundColor = '#28a745'
    messageElement.style.color = 'white'
    messageElement.style.padding = '10px 20px'> {
    messageElement.style.borderRadius = '5px'
    messageElement.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'
    document.body.appendChild(messageElement) catch (error) {
   console.error('Error saving content:', error)
    setTimeout(() => {    alert('Failed to save content. Please try again.')
      document.body.removeChild(messageElement)
    }, 3000)
  } catch (error) {
    console.error('Error saving content:', error)// Show context menu and load snippet keys
    alert('Failed to save content. Please try again.')
  }: mode.value:', mode.value) // Debugging statement
}
e the editor is in "Edit" mode
// Show context menu and load snippet keysf (mode.value !== 'edit') {
async function showContextMenu(event) {    console.warn('showContextMenu: Not in Edit mode.') // Debugging statement
  console.log('showContextMenu: mode.value:', mode.value) // Debugging statement

  // Ensure the editor is in "Edit" mode
  if (mode.value !== 'edit') {DOM to update before accessing textareaRef
    console.warn('showContextMenu: Not in Edit mode.') // Debugging statement
    return
  }
 console.warn('showContextMenu: Textarea is not available. Retrying...') // Debugging statement
  // Wait for the DOM to update before accessing textareaRef    await new Promise((resolve) => setTimeout(resolve, 50)) // Wait 50ms
  await nextTick()
  let textarea = textareaRef.value  }
  if (!textarea) {
    console.warn('showContextMenu: Textarea is not available. Retrying...') // Debugging statementging statement
    await new Promise((resolve) => setTimeout(resolve, 50)) // Wait 50ms
    textarea = textareaRef.valuearea) {
  }
e.log('showContextMenu: cursorPosition:', cursorPosition.value) // Debugging statement
  console.log('showContextMenu: textareaRef.value after retry:', textarea) // Debugging statement else {
    console.error('showContextMenu: Textarea is still not available after retry.') // Debugging statement
  if (textarea) {
    cursorPosition.value = textarea.selectionStart || 0 // Save the cursor position
    console.log('showContextMenu: cursorPosition:', cursorPosition.value) // Debugging statement
  } else {ys when the context menu is opened
    console.error('showContextMenu: Textarea is still not available after retry.') // Debugging statement{
    return    const response = await fetch('https://api.vegvisr.org/snippetlist', {
  }

  // Load snippet keys when the context menu is opened
  try {    if (!response.ok) {
    const response = await fetch('https://api.vegvisr.org/snippetlist', {snippet keys')
      method: 'GET',
    })
ait response.json()
    if (!response.ok) {)
      throw new Error('Failed to load snippet keys')s.value) // Debugging statement
    } catch (error) {
    console.error('Error loading snippet keys:', error)
    const data = await response.json()ad snippet keys. Please try again.')
    snippetKeys.value = data.keys.map((key) => key.name)
    console.log('showContextMenu: snippetKeys:', snippetKeys.value) // Debugging statement
  } catch (error) { {
    console.error('Error loading snippet keys:', error) visible: true,
    alert('Failed to load snippet keys. Please try again.')
  }   y: event.clientY,
  }
  contextMenu.value = {ntextMenu: contextMenu:', contextMenu.value) // Debugging statement
    visible: true,
    x: event.clientX,
    y: event.clientY,/ Close context menu
  }function closeContextMenu() {
  console.log('showContextMenu: contextMenu:', contextMenu.value) // Debugging statementfalse
}

// Close context menu
function closeContextMenu() {
  contextMenu.value.visible = false
}  const start = textarea.selectionStart
electionEnd
// Add snippet to KV namespacet, end)
async function addSnippet() {
  const textarea = textareaRef.valuef (!snippetContent) {
  const start = textarea.selectionStart    alert('No text selected to add as a snippet.')
  const end = textarea.selectionEnd
  const snippetContent = markdown.value.slice(start, end)

  if (!snippetContent) {ippetId = prompt('Enter a unique ID for the snippet:')
    alert('No text selected to add as a snippet.')f (!snippetId) {
    return    alert('Snippet ID is required.')
  }urn

  const snippetId = prompt('Enter a unique ID for the snippet:')
  if (!snippetId) {
    alert('Snippet ID is required.')pi.vegvisr.org/snippetadd', {
    returnthod: 'POST',
  }
  'Content-Type': 'application/json',
  try {      },
    const response = await fetch('https://api.vegvisr.org/snippetadd', {ify({ id: snippetId, content: snippetContent }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',    if (!response.ok) {
      },ppet')
      body: JSON.stringify({ id: snippetId, content: snippetContent }),
    })

    if (!response.ok) {ror) {
      throw new Error('Failed to add snippet')or adding snippet:', error)
    } alert('Failed to add snippet. Please try again.')
 } finally {
    alert('Snippet added successfully.')    closeContextMenu()
  } catch (error) {
    console.error('Error adding snippet:', error)
    alert('Failed to add snippet. Please try again.')
  } finally {the textarea
    closeContextMenu()nippetContent, textarea) {
  }  const start = textarea.selectionStart
}

// Function to insert snippet into the textarea
function insertSnippetIntoTextarea(snippetContent, textarea) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentText = textarea.value textarea.value = before + snippetContent + after
  textarea.selectionStart = textarea.selectionEnd = start + snippetContent.length
  const before = currentText.substring(0, start)
  const after = currentText.substring(end)

  textarea.value = before + snippetContent + afterrt snippet into textarea
  textarea.selectionStart = textarea.selectionEnd = start + snippetContent.length
  textarea.focus()tSnippet: key:', key) // Debugging statement
}{
    const response = await fetch(`https://api.vegvisr.org/snippets/${key}`, {
// Insert snippet into textarea
async function insertSnippet(key) {
  console.log('insertSnippet: key:', key) // Debugging statement
  try {    if (!response.ok) {
    const response = await fetch(`https://api.vegvisr.org/snippets/${key}`, { snippet content')
      method: 'GET',
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error('Failed to fetch snippet content')tatement
    }

    const data = await response.json()ment
    const snippetContent = data.content.value !== 'edit') {
    console.log('insertSnippet: snippetContent:', snippetContent) // Debugging statement alert('Textarea is not available. The snippet will be inserted when you switch to Edit mode.')
      pendingSnippet.value = snippetContent // Store the snippet temporarily
    // Ensure the textarea is available and the mode is 'edit'
    console.log('insertSnippet: mode.value:', mode.value) // Debugging statement
    if (mode.value !== 'edit') {
      alert('Textarea is not available. The snippet will be inserted when you switch to Edit mode.') // Ensure DOM updates before accessing textareaRef
      pendingSnippet.value = snippetContent // Store the snippet temporarily
      returnlog('insertSnippet: textareaRef.value:', textarea) // Debugging statement
    }f (!textarea) {
      alert('Textarea element is not available.')
    await nextTick() // Ensure DOM updates before accessing textareaRef
    const textarea = textareaRef.value
    console.log('insertSnippet: textareaRef.value:', textarea) // Debugging statement
    if (!textarea) {
      alert('Textarea element is not available.')etContent, textarea)
      return
    }arkdown value to reflect the new content in the textarea

    // Use the provided logic to insert the snippet into the textareawn.value) // Debugging statement
    insertSnippetIntoTextarea(snippetContent, textarea)ror) {
or inserting snippet:', error)
    // Update the markdown value to reflect the new content in the textarea alert('Failed to insert snippet. Please try again.')
    markdown.value = textarea.value } finally {
    console.log('insertSnippet: markdown.value:', markdown.value) // Debugging statement    closeContextMenu()
  } catch (error) {
    console.error('Error inserting snippet:', error)
    alert('Failed to insert snippet. Please try again.')
  } finally {e and insert markdown into textarea
    closeContextMenu()
  }le = fileInput.value?.files[0]
}f (!file) {
    alert('Please select an image to upload.')
// Upload image and insert markdown into textarea
async function uploadImage() {
  const file = fileInput.value?.files[0]
  if (!file) {ate file type
    alert('Please select an image to upload.')f (!file.type.startsWith('image/')) {
    return    alert('Only image files are allowed.')
  }

  // Validate file type
  if (!file.type.startsWith('image/')) { formData = new FormData()
    alert('Only image files are allowed.')
    returnpe', 'image')
  }
nst response = await fetch('https://api.vegvisr.org/upload', {
  const formData = new FormData()      method: 'POST',
  formData.append('file', file)
  formData.append('type', 'image')
  try {
    const response = await fetch('https://api.vegvisr.org/upload', {    if (!response.ok) {
      method: 'POST',d image')
      body: formData,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error('Failed to upload image')    const markdownImage = `![Image](${imageUrl})`
    }
sfully:', imageUrl)
    const data = await response.json()
    const imageUrl = data.urlea
    const markdownImage = `![Image](${imageUrl})`
area) {
    console.log('Image uploaded successfully:', imageUrl)xtarea)
 markdown.value = textarea.value // Update markdown value
    // Insert the markdown for the image into the textarea
    const textarea = textareaRef.value
    if (textarea) {
      insertSnippetIntoTextarea(markdownImage, textarea) catch (error) {
      markdown.value = textarea.value // Update markdown value   console.error('Error uploading image:', error)
    } else {    alert('Failed to upload image. Please try again.')
      console.error('Textarea is not available.')
    }
  } catch (error) {
    console.error('Error uploading image:', error)
    alert('Failed to upload image. Please try again.')unction clearContent() {
  }re.clearBlog()
}  console.log('Content reset. Blog ID set to null, and shareable link cleared.')

// Clear the content of the textarea and reset the blog ID
function clearContent() {
  blogStore.clearBlog()
  console.log('Content reset. Blog ID set to null, and shareable link cleared.') {
}
</script> margin: 0 auto;
  padding: 1rem;
<style scoped>
.markdown-editor {
  max-width: 800px;
  margin: 0 auto;r.embedded {
  padding: 1rem; margin: 0;
  position: relative;  padding: 0;
};

.markdown-editor.embedded {
  margin: 0;.mode-toggle {
  padding: 0;;
  border: none;
}

.mode-toggle {
  margin-bottom: 1rem;5rem;
}007bff;

.mode-toggle button { cursor: pointer;
  padding: 0.5rem 1rem;  border-radius: 4px;
  margin-right: 0.5rem;lor 0.2s;
  border: 1px solid #007bff;
  background-color: white;
  cursor: pointer;tton.active,
  border-radius: 4px;mode-toggle button:hover {
  transition: background-color 0.2s;  background-color: #007bff;
}hite;

.mode-toggle button.active,
.mode-toggle button:hover {
  background-color: #007bff;
  color: white;
}

textarea {space;
  width: 100%; border: 1px solid #ccc;
  height: 300px;  border-radius: 4px;
  padding: 1rem;vertical;
  font-size: 1rem;
  font-family: monospace;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical; padding: 1rem;
}  min-height: 300px;
olor: #f9f9f9;
.preview {
  border: 1px solid #ccc;
  padding: 1rem;
  min-height: 300px;
  background-color: #f9f9f9;
}
px;
.save-button {
  margin-top: 1rem; color: white;
  padding: 0.5rem 1rem;  cursor: pointer;
  border: none;ound-color 0.2s;
  border-radius: 4px;
  background-color: #28a745;
  color: white;.save-button:hover {
  cursor: pointer;lor: #218838;
  transition: background-color 0.2s;
}

.save-button:hover {rem;
  background-color: #218838;;
}

.reset-button {px;
  margin-top: 1rem;ow to indicate a reset action */
  margin-left: 0.5rem; color: black;
  padding: 0.5rem 1rem;  cursor: pointer;
  border: none;und-color 0.2s;
  border-radius: 4px;
  background-color: #ffc107; /* Yellow to indicate a reset action */
  color: black;.reset-button:hover {
  cursor: pointer;round-color: #e0a800;
  transition: background-color 0.2s;
}

.reset-button:hover {
  background-color: #e0a800;
} background-color: #e9ecef;
  border: 1px solid #ced4da;
.info {radius: 4px;
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #e9ecef;info a {
  border: 1px solid #ced4da;  color: #007bff;
  border-radius: 4px;on: none;
}

.info a {.info a:hover {
  color: #007bff;on: underline;
  text-decoration: none;
}

.info a:hover {
  text-decoration: underline;
}lid #ccc;
 border-radius: 4px;
.context-menu {  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);k;
  z-index: 1000;
}rem;

.context-menu button { background: none;
  display: block;  text-align: left;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;.context-menu button:hover {
  text-align: left;nd-color: #f1f1f1;
  cursor: pointer;
}
.submenu {
.context-menu button:hover {tive;
  background-color: #f1f1f1;
}
items {
.submenu {ne;
  position: relative;
}

.submenu-items {
  display: none;lid #ccc;
  position: absolute; border-radius: 4px;
  top: 0;  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  left: 100%;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;.submenu:hover .submenu-items {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}
submenu-items button {
.submenu:hover .submenu-items {  padding: 0.5rem 1rem;
  display: block;
}

.submenu-items button {.submenu-items button:hover {
  padding: 0.5rem 1rem;olor: #f1f1f1;
  width: 100%;
}

.submenu-items button:hover { margin-top: 1rem;
  background-color: #f1f1f1;  display: flex;
}

.upload-form {
  margin-top: 1rem;.upload-form input[type='file'] {
  display: flex;
  gap: 0.5rem;
}

.upload-form input[type='file'] {
  flex: 1;
}px;

.upload-form button { color: white;
  padding: 0.5rem 1rem;  cursor: pointer;
  border: none;lor 0.2s;
  border-radius: 4px;
  background-color: #007bff;
  color: white;.upload-form button:hover {
  cursor: pointer;#0056b3;
  transition: background-color 0.2s;
}
visibility-toggle {
.upload-form button:hover {  margin-top: 1rem;
  background-color: #0056b3;
}

.visibility-toggle {ggle label {
  margin-top: 1rem; display: flex;
  font-size: 1rem;  align-items: center;
}

.visibility-toggle label {
  display: flex;visibility-toggle input[type='checkbox'] {
  align-items: center; 16px;
  gap: 0.5rem;  height: 16px;








</style>}  height: 16px;  width: 16px;.visibility-toggle input[type='checkbox'] {}}
</style>
