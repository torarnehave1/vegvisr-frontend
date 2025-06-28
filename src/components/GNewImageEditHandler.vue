<template>
  <!-- Image Edit Handler - Manages image editing events modularly -->
  <div class="gnew-image-edit-handler">
    <!-- Image Selector Modal -->
    <ImageSelector
      v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
      :is-open="isImageSelectorOpen"
      :image-data="currentImageData"
      :graph-context="{ type: 'image-replacement' }"
      @close="closeImageSelector"
      @image-replaced="handleImageReplaced"
    />

    <!-- Google Photos Selector Modal -->
    <GooglePhotosSelector
      v-if="userStore.loggedIn && userStore.role === 'Superadmin'"
      :is-open="isGooglePhotosSelectorOpen"
      :google-photos-data="currentGooglePhotosData"
      @close="closeGooglePhotosSelector"
      @photo-selected="handleGooglePhotoSelected"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import ImageSelector from '@/components/ImageSelector.vue'
import GooglePhotosSelector from '@/components/GooglePhotosSelector.vue'

// Props
const props = defineProps({
  graphData: {
    type: Object,
    required: true,
  },
  apiEndpoint: {
    type: Function,
    required: true,
  },
})

// Emits
const emit = defineEmits(['status-message', 'graph-updated'])

// Store access
const userStore = useUserStore()
const knowledgeGraphStore = useKnowledgeGraphStore()

// Reactive state for modals
const isImageSelectorOpen = ref(false)
const currentImageData = ref({
  url: '',
  alt: '',
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

const isGooglePhotosSelectorOpen = ref(false)
const currentGooglePhotosData = ref({
  url: '',
  alt: '',
  type: '',
  context: '',
  nodeId: '',
  nodeContent: '',
})

// Image Selector Functions
const openImageSelector = (imageData) => {
  if (!userStore.loggedIn || userStore.role !== 'Superadmin') {
    console.log('Image editing access denied - requires Superadmin role')
    return
  }

  console.log('=== GNew Image Edit: Opening Image Selector ===')
  console.log('Image data:', imageData)

  currentImageData.value = {
    url: imageData.url,
    alt: imageData.alt || '',
    type: imageData.type || 'Unknown',
    context: imageData.context || 'No context provided',
    nodeId: imageData.nodeId,
    nodeContent: imageData.nodeContent || '',
  }
  isImageSelectorOpen.value = true
}

const closeImageSelector = () => {
  isImageSelectorOpen.value = false
  currentImageData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

// Google Photos Selector Functions
const openGooglePhotosSelector = (googlePhotosData) => {
  if (!userStore.loggedIn || userStore.role !== 'Superadmin') {
    console.log('Google Photos access denied - requires Superadmin role')
    return
  }

  console.log('=== GNew Image Edit: Opening Google Photos Selector ===')
  console.log('Google Photos data:', googlePhotosData)

  currentGooglePhotosData.value = {
    url: googlePhotosData.url || '',
    alt: googlePhotosData.alt || '',
    type: googlePhotosData.type || 'Unknown',
    context: googlePhotosData.context || 'No context provided',
    nodeId: googlePhotosData.nodeId,
    nodeContent: googlePhotosData.nodeContent || '',
  }
  isGooglePhotosSelectorOpen.value = true
}

const closeGooglePhotosSelector = () => {
  isGooglePhotosSelectorOpen.value = false
  currentGooglePhotosData.value = {
    url: '',
    alt: '',
    type: '',
    context: '',
    nodeId: '',
    nodeContent: '',
  }
}

// Helper function to escape special regex characters
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Image replacement handler
const handleImageReplaced = async (replacementData) => {
  console.log('=== GNew Image Edit: Image Replaced ===')
  console.log('Replacement data:', replacementData)

  try {
    // Find the node to update
    const nodeToUpdate = props.graphData.nodes.find(
      (node) => node.id === currentImageData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for image replacement')
    }

    let updatedContent = nodeToUpdate.info || ''
    const oldUrl = replacementData.oldUrl
    const newUrl = replacementData.newUrl

    // Replace the image URL in the node's info content
    updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), newUrl)

    // Update the node
    nodeToUpdate.info = updatedContent

    const updatedGraphData = {
      ...props.graphData,
      nodes: props.graphData.nodes.map((node) =>
        node.id === nodeToUpdate.id ? { ...node, info: updatedContent } : node,
      ),
    }

    // Save to backend
    const response = await fetch(
      props.apiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with updated image.')
    }

    await response.json()

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Emit events to parent
    emit('status-message', {
      type: 'success',
      message: `Image replaced successfully! New image by ${replacementData.photographer || 'Unknown'}`,
    })

    emit('graph-updated', updatedGraphData)

    // Reattach listeners after content update
    nextTick(() => {
      attachImageChangeListeners()
    })

    console.log('GNew Image Edit: Image update saved successfully')
  } catch (error) {
    console.error('GNew Image Edit: Error updating image:', error)
    emit('status-message', {
      type: 'error',
      message: 'Failed to update the image. Please try again.',
    })
  }
}

// Google Photo selection handler
const handleGooglePhotoSelected = async (selectionData) => {
  console.log('=== GNew Image Edit: Google Photo Selected ===')
  console.log('Selection data:', selectionData)

  try {
    // Find the node to update
    const nodeToUpdate = props.graphData.nodes.find(
      (node) => node.id === currentGooglePhotosData.value.nodeId,
    )
    if (!nodeToUpdate) {
      throw new Error('Node not found for Google photo replacement')
    }

    const photo = selectionData.photo
    let photoMarkdown = ''
    const imageUrl = photo.permanentUrl || photo.url

    // Create markdown for the selected Google photo
    switch (selectionData.imageType) {
      case 'Header':
        photoMarkdown = `![Header|height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Leftside':
        photoMarkdown = `![Leftside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      case 'Rightside':
        photoMarkdown = `![Rightside-1|width: 200px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
        break
      default:
        photoMarkdown = `![Image|width: 300px; height: 200px; object-fit: 'cover'; object-position: 'center'](${imageUrl})`
    }

    let updatedContent = nodeToUpdate.info || ''
    const oldUrl = currentGooglePhotosData.value.url

    if (oldUrl && updatedContent.includes(oldUrl)) {
      updatedContent = updatedContent.replace(new RegExp(escapeRegExp(oldUrl), 'g'), imageUrl)
    } else {
      if (updatedContent.trim()) {
        updatedContent += '\n\n' + photoMarkdown
      } else {
        updatedContent = photoMarkdown
      }
    }

    // Update the node
    nodeToUpdate.info = updatedContent

    const updatedGraphData = {
      ...props.graphData,
      nodes: props.graphData.nodes.map((node) =>
        node.id === nodeToUpdate.id ? { ...node, info: updatedContent } : node,
      ),
    }

    // Save to backend
    const response = await fetch(
      props.apiEndpoint('https://knowledge.vegvisr.org/saveGraphWithHistory'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeGraphStore.currentGraphId,
          graphData: updatedGraphData,
          override: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error('Failed to save the graph with Google photo.')
    }

    await response.json()

    // Update store
    knowledgeGraphStore.updateGraphFromJson(updatedGraphData)

    // Emit events to parent
    emit('status-message', {
      type: 'success',
      message: 'Google Photo added successfully from your Google Photos!',
    })

    emit('graph-updated', updatedGraphData)

    // Reattach listeners after content update
    nextTick(() => {
      attachImageChangeListeners()
    })

    closeGooglePhotosSelector()
  } catch (error) {
    console.error('GNew Image Edit: Error adding Google photo:', error)
    emit('status-message', {
      type: 'error',
      message: 'Failed to add the Google photo. Please try again.',
    })
  }
}

// Event listener attachment for image edit buttons
const attachImageChangeListeners = () => {
  console.log('=== GNew Image Edit: Attaching Change Image Button Listeners ===')

  // Change image button listeners
  const changeImageButtons = document.querySelectorAll('.change-image-btn')
  console.log('Found change image buttons:', changeImageButtons.length)
  changeImageButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const btn = event.target
      const imageData = {
        url: btn.getAttribute('data-image-url'),
        alt: btn.getAttribute('data-image-alt'),
        type: btn.getAttribute('data-image-type'),
        context: btn.getAttribute('data-image-context'),
        nodeId: btn.getAttribute('data-node-id'),
        nodeContent: btn.getAttribute('data-node-content'),
      }
      openImageSelector(imageData)
    })
  })

  // Google Photos button listeners
  const googlePhotosButtons = document.querySelectorAll('.google-photos-btn')
  console.log('Found Google Photos buttons:', googlePhotosButtons.length)
  googlePhotosButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const btn = event.target
      const googlePhotosData = {
        url: btn.getAttribute('data-image-url'),
        alt: btn.getAttribute('data-image-alt'),
        type: btn.getAttribute('data-image-type'),
        context: btn.getAttribute('data-image-context'),
        nodeId: btn.getAttribute('data-node-id'),
        nodeContent: btn.getAttribute('data-node-content'),
      }
      openGooglePhotosSelector(googlePhotosData)
    })
  })

  console.log(
    'GNew Image Edit: Change image and Google Photos button listeners attached successfully',
  )
}

// Expose the attach function for external use
defineExpose({
  attachImageChangeListeners,
})

// Lifecycle hooks
onMounted(() => {
  console.log('GNew Image Edit Handler mounted, attaching listeners...')
  nextTick(() => {
    attachImageChangeListeners()
  })
})

onUnmounted(() => {
  console.log('GNew Image Edit Handler unmounted')
})
</script>

<style scoped>
.gnew-image-edit-handler {
  /* This component only handles modals and events - no visual styling needed */
}
</style>
