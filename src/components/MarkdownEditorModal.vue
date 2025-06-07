<template>
  <div v-if="isOpen" class="markdown-editor-modal">
    <div class="modal-content">
      <h3>Edit Info (Markdown)</h3>
      <!-- Editor toolbar -->
      <div class="d-flex align-items-center gap-2">
        <button @click="insertSectionMarkdown" title="Insert Section" class="btn btn-link p-0">
          <span class="material-icons">format_color_fill</span>
        </button>
        <button @click="insertQuoteMarkdown" title="Insert Quote" class="btn btn-link p-0">
          <span class="material-icons">format_quote</span>
        </button>
        <button @click="insertWNoteMarkdown" title="Insert Work Note" class="btn btn-link p-0">
          <span class="material-icons">note</span>
        </button>
        <button
          @click="insertHeaderImageMarkdown"
          title="Insert Header Image"
          class="btn btn-link p-0"
        >
          <span class="material-icons">image</span>
        </button>
        <button
          @click="insertRightsideImageMarkdown"
          title="Insert Rightside Image"
          class="btn btn-link p-0"
        >
          <span class="material-icons">image</span>
        </button>
        <button
          @click="insertLeftsideImageMarkdown"
          title="Insert Leftside Image"
          class="btn btn-link p-0"
        >
          <span class="material-icons">image</span>
        </button>
        <button @click="insertFancyMarkdown" title="Insert Fancy" class="btn btn-link p-0">
          <span class="material-icons">format_paint</span>
        </button>
        <button
          @click="insertYoutubeVideoMarkdown"
          title="Insert Youtube Video"
          class="btn btn-link p-0"
        >
          <span class="material-icons">video_library</span>
        </button>
        <!-- AI Assist button -->
        <button
          v-if="canUseAI"
          @click="openAIAssist"
          title="AI Assist"
          class="btn btn-link p-0"
          style="
            background: #6f42c1;
            color: #fff;
            border-radius: 4px;
            border: none;
            padding: 5px 10px;
          "
        >
          <span class="material-icons">smart_toy</span>
        </button>
      </div>
      <textarea
        ref="markdownEditorTextarea"
        v-model="content"
        class="form-control"
        rows="10"
      ></textarea>
      <div class="modal-actions">
        <button @click="saveChanges" class="btn btn-primary">Save</button>
        <button @click="close" class="btn btn-secondary">Cancel</button>
        <button v-if="canSaveToMystmkra" @click="saveToMystmkra" class="btn btn-info">
          Save to Mystmkra.io
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  initialContent: {
    type: String,
    default: '',
  },
  userRole: {
    type: String,
    default: '',
  },
  isLoggedIn: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'save', 'save-to-mystmkra', 'open-ai-assist'])

const content = ref(props.initialContent)
const markdownEditorTextarea = ref(null)

const canUseAI = computed(() => {
  return props.isLoggedIn && ['Admin', 'Editor', 'Superadmin'].includes(props.userRole)
})

const canSaveToMystmkra = computed(() => {
  return props.isLoggedIn && ['Admin', 'Superadmin'].includes(props.userRole)
})

const insertAtCursor = (text) => {
  const textarea = markdownEditorTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = content.value.substring(0, start)
  const after = content.value.substring(end)
  content.value = before + text + after

  // Move cursor after inserted text
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = start + text.length
    textarea.focus()
  })
}

const insertSectionMarkdown = () => {
  const textarea = markdownEditorTextarea.value
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = content.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const sectionMarkdown = `[SECTION | background-color: 'lightyellow'; color: 'black']\n${selectedText}\n[END SECTION]`
    insertAtCursor(sectionMarkdown)
  } else {
    const sectionMarkdown =
      "[SECTION | background-color: 'lightblue'; color: 'black']\n\nYour content here\n\n[END SECTION]"
    insertAtCursor(sectionMarkdown)
  }
}

const insertQuoteMarkdown = () => {
  const textarea = markdownEditorTextarea.value
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = content.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const quoteMarkdown = `[QUOTE | Cited='Author']\n${selectedText}\n[END QUOTE]`
    insertAtCursor(quoteMarkdown)
  } else {
    const quoteMarkdown = "[QUOTE | Cited='Author']\n\nYour quote here\n\n[END QUOTE]"
    insertAtCursor(quoteMarkdown)
  }
}

const insertWNoteMarkdown = () => {
  const textarea = markdownEditorTextarea.value
  if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
    const selectedText = content.value.substring(textarea.selectionStart, textarea.selectionEnd)
    const wNoteMarkdown = `[WNOTE | Cited='Author']\n${selectedText}\n[END WNOTE]`
    insertAtCursor(wNoteMarkdown)
  } else {
    const wNoteMarkdown = "[WNOTE | Cited='Author']\n\nYour work note here\n\n[END WNOTE]"
    insertAtCursor(wNoteMarkdown)
  }
}

const insertHeaderImageMarkdown = () => {
  const headerImageMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/HEADERIMG.png)`
  insertAtCursor(headerImageMarkdown)
}

const insertRightsideImageMarkdown = () => {
  const rightsideImageMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`
  insertAtCursor(rightsideImageMarkdown)
}

const insertLeftsideImageMarkdown = () => {
  const leftsideImageMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](https://vegvisr.imgix.net/SIDEIMG.png)`
  insertAtCursor(leftsideImageMarkdown)
}

const insertFancyMarkdown = () => {
  const fancyMarkdown = `[FANCY | font-size: 4.5em; color: lightblue; background-image: url('https://vegvisr.imgix.net/FANCYIMG.png'); text-align: center]\nYour fancy content here\n[END FANCY]`
  insertAtCursor(fancyMarkdown)
}

const insertYoutubeVideoMarkdown = () => {
  const videoUrl = prompt('Please enter the YouTube video URL:')
  if (videoUrl) {
    const videoIdMatch =
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/) ||
      videoUrl.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : null

    if (videoId) {
      const youtubeMarkdown = `![YOUTUBE src=https://www.youtube.com/embed/${videoId}][END YOUTUBE]`
      insertAtCursor(youtubeMarkdown)
    } else {
      alert('Invalid YouTube URL. Please try again.')
    }
  }
}

const openAIAssist = () => {
  emit('open-ai-assist')
}

const saveChanges = () => {
  emit('save', content.value)
}

const saveToMystmkra = () => {
  emit('save-to-mystmkra', content.value)
}

const close = () => {
  content.value = props.initialContent
  emit('close')
}
</script>

<style scoped>
.markdown-editor-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

textarea {
  margin-top: 15px;
  font-family: monospace;
}
</style>
