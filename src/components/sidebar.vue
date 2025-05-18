<template>
  <div
    class="SideBarComponent bg-light border-end"
    :class="{
      collapsed: sidebarCollapsed,
      'bg-dark': theme === 'dark',
      'text-white': theme === 'dark',
    }"
  >
    <div v-if="!sidebarCollapsed">
      <!-- Tabs -->
      <ul class="nav nav-tabs" :class="{ 'nav-tabs-dark': theme === 'dark' }">
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'form', 'text-white': theme === 'dark' }"
            @click="setActiveTab('form')"
          >
            New Graph
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'json', 'text-white': theme === 'dark' }"
            @click="setActiveTab('json')"
          >
            Version
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'node-info', 'text-white': theme === 'dark' }"
            @click="setActiveTab('node-info')"
          >
            Info
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'templates', 'text-white': theme === 'dark' }"
            @click="setActiveTab('templates')"
          >
            Templates
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'work-notes', 'text-white': theme === 'dark' }"
            @click="setActiveTab('work-notes')"
          >
            Work Notes
          </button>
        </li>
      </ul>
      <div class="tab-content p-3">
        <!-- Create New Graph Form -->
        <div v-if="activeTab === 'form'" class="form-section">
          <h3>Create New Knowledge Graph</h3>
          <form @submit.prevent="onSaveGraph">
            <div class="mb-3">
              <label for="graphTitle" class="form-label">Title:</label>
              <input
                id="graphTitle"
                :value="graphMetadata.title"
                @input="updateMetadata('title', $event.target.value)"
                type="text"
                class="form-control"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                required
              />
            </div>
            <div class="mb-3">
              <label for="graphDescription" class="form-label">Description:</label>
              <textarea
                id="graphDescription"
                :value="graphMetadata.description"
                @input="updateMetadata('description', $event.target.value)"
                class="form-control"
                rows="4"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              ></textarea>
            </div>
            <div class="mb-3">
              <label for="graphCreatedBy" class="form-label">Created By:</label>
              <input
                id="graphCreatedBy"
                :value="graphMetadata.createdBy"
                @input="updateMetadata('createdBy', $event.target.value)"
                type="text"
                class="form-control"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                required
              />
            </div>
            <button type="submit" class="btn btn-primary">Create Knowledge Graph</button>
          </form>
        </div>
        <!-- Graph History -->
        <div v-if="activeTab === 'json'" class="form-section">
          <h3>Development Story</h3>
          <div
            id="historyList"
            tabindex="0"
            @keydown="onHistoryKeydown"
            class="list-group"
            :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
            style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
          >
            <button
              v-for="(history, index) in graphHistory"
              :key="index"
              @click="onHistoryItemClick(index)"
              :class="[
                'list-group-item',
                'list-group-item-action',
                {
                  active: index === selectedHistoryIndex,
                  'bg-dark': theme === 'dark',
                  'text-white': theme === 'dark',
                },
              ]"
              style="cursor: pointer"
              :aria-selected="index === selectedHistoryIndex"
              role="option"
            >
              Version {{ history.version }} - {{ history.timestamp }}
            </button>
            <p v-if="graphHistory.length === 0" class="list-group-item text-center">
              No history found for the current graph ID.
            </p>
          </div>
        </div>
        <!-- Node Info Tab -->
        <div v-if="activeTab === 'node-info'" class="form-section">
          <h3>Node Information</h3>
          <div v-if="selectedElement">
            <h4>{{ selectedElement.label }}</h4>
            <textarea
              v-if="selectedElement.info"
              readonly
              class="form-control mb-3"
              style="height: 150px; font-family: monospace; white-space: pre-wrap"
              :value="selectedElement.info"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
            ></textarea>
            <p v-else class="text-muted">No additional information available.</p>
            <!-- Bibliographic References -->
            <div v-if="selectedElement.bibl && selectedElement.bibl.length" class="mt-3">
              <h5>Bibliographic References:</h5>
              <ul class="list-unstyled">
                <li v-for="(reference, index) in selectedElement.bibl" :key="index">
                  {{ reference }}
                </li>
              </ul>
            </div>
          </div>
          <div v-else>
            <p class="text-muted">Select a node or connection to see details.</p>
          </div>
        </div>
        <!-- Templates Tab -->
        <div v-if="activeTab === 'templates'" class="form-section">
          <h3>Graph Templates</h3>
          <p>Select a template to quickly create a new graph:</p>
          <div v-if="localTemplates.length > 0">
            <div
              id="templateList"
              tabindex="0"
              class="list-group"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
            >
              <div
                v-for="(template, index) in localTemplates"
                :key="template.id || index"
                class="d-flex align-items-center list-group-item list-group-item-action"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                style="cursor: pointer; justify-content: space-between"
              >
                <span @click="onApplyTemplate(template)" style="flex: 1">{{ template.name }}</span>
                <button
                  class="btn btn-link btn-sm text-danger"
                  @click.stop="deleteTemplate(template)"
                  title="Delete template"
                  style="font-size: 1.2em; padding: 0 0.5em"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
          <p v-else class="text-muted">No templates available.</p>
        </div>
        <!-- Work Notes Tab -->
        <div v-if="activeTab === 'work-notes'" class="form-section">
          <h3>Work Notes</h3>
          <div v-if="workNotes.length > 0">
            <div
              id="workNotesList"
              tabindex="0"
              class="list-group"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
            >
              <button
                v-for="(note, index) in workNotes"
                :key="index"
                class="list-group-item list-group-item-action"
                :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
                style="cursor: pointer"
                @click="onWorkNoteClick(note)"
              >
                {{ note.name }}
              </button>
            </div>
          </div>
          <div v-else>
            <p class="text-muted text-center">No work notes available for this graph.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, watch } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const workNotes = ref([])
const graphStore = useKnowledgeGraphStore()

// Local copy of fetchedTemplates for mutation
const localTemplates = ref([])

const {
  sidebarCollapsed,
  theme,
  activeTab,
  graphMetadata,
  graphHistory,
  selectedHistoryIndex,
  selectedElement,
  fetchedTemplates,
  selectedGraphId,
} = defineProps({
  sidebarCollapsed: Boolean,
  theme: String,
  activeTab: String,
  graphMetadata: Object,
  graphHistory: Array,
  selectedHistoryIndex: Number,
  selectedElement: Object,
  fetchedTemplates: Array,
  selectedGraphId: String,
})

const emit = defineEmits([
  'update:activeTab',
  'save-graph',
  'history-keydown',
  'history-item-click',
  'apply-template',
  'update:graphMetadata',
  'add-work-note',
])

// Watch for changes in fetchedTemplates prop and update localTemplates
watch(
  () => fetchedTemplates,
  (newTemplates) => {
    localTemplates.value = Array.isArray(newTemplates) ? [...newTemplates] : []
  },
  { immediate: true },
)

const setActiveTab = (tab) => {
  emit('update:activeTab', tab)
}

const updateMetadata = (field, value) => {
  emit('update:graphMetadata', { [field]: value })
}

const onSaveGraph = () => {
  emit('save-graph')
}

const onHistoryKeydown = (event) => {
  emit('history-keydown', event)
}

const onHistoryItemClick = (index) => {
  emit('history-item-click', index)
}

const onApplyTemplate = (template) => {
  emit('apply-template', template)
}

const onWorkNoteClick = (note) => {
  console.log('Work note selected:', note) // Log the selected work note

  // Emit the selected work note to the parent component
  emit('add-work-note', note)
}

const fetchWorkNotes = async (graphId) => {
  if (!graphId) {
    workNotes.value = []
    console.warn('No graph ID provided for fetching work notes.')
    return
  }
  try {
    console.log('Fetching work notes for graph ID:', graphId)
    const response = await fetch(
      `https://knowledge.vegvisr.org/getGraphWorkNotes?graphId=${graphId}`,
    )
    if (response.ok) {
      const data = await response.json()
      console.log('API Response:', data)
      if (data.results?.results && Array.isArray(data.results.results)) {
        workNotes.value = data.results.results.map((note) => ({
          id: note.id,
          name: note.note.split(':')[0],
          content: note.note.split(':').slice(1).join(':').trim(),
        }))
        console.log('Mapped Work Notes:', workNotes.value)
      } else {
        console.warn('No results found in API response.')
        workNotes.value = []
      }
    } else {
      console.error('Failed to fetch work notes:', response.statusText)
      workNotes.value = []
    }
  } catch (error) {
    console.error('Error fetching work notes:', error)
    workNotes.value = []
  }
}

const deleteTemplate = async (template) => {
  if (!template.id) {
    alert('Template ID is missing.')
    return
  }
  if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
    return
  }
  try {
    const response = await fetch('https://knowledge.vegvisr.org/deleteTemplate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id }),
    })
    if (response.ok) {
      // Remove from local list
      const idx = localTemplates.value.findIndex((t) => t.id === template.id)
      if (idx !== -1) localTemplates.value.splice(idx, 1)
    } else {
      const error = await response.json()
      alert(`Error deleting template: ${error.error}`)
    }
  } catch (error) {
    alert('An error occurred while deleting the template.')
    console.error(error)
  }
}

onMounted(() => {
  const graphId = selectedGraphId || graphStore.currentGraphId
  fetchWorkNotes(graphId)
})

watch(
  [() => selectedGraphId, () => graphStore.currentGraphId],
  ([newSelectedGraphId, newGraphId]) => {
    const graphId = newSelectedGraphId || newGraphId
    fetchWorkNotes(graphId)
  },
)

defineExpose({
  fetchWorkNotes, // Expose fetchWorkNotes method to parent components
})
</script>
<style scoped>
.SideBarComponent {
  transition: width 0.3s;
  width: 25%;
  overflow-y: auto;
  padding: 20px;
}

.SideBarComponent.collapsed {
  width: 0;
  padding: 0;
  overflow: hidden;
}
</style>
