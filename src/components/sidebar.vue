<!-- src/components/Sidebar.vue -->
<template>
  <div
    class="col-md-3 sidebar bg-light border-end"
    :class="{
      collapsed: sidebarCollapsed,
      'bg-dark': theme === 'dark',
      'text-white': theme === 'dark',
    }"
  >
    <div v-if="!sidebarCollapsed">
      <!-- Tabs for Form, JSON Editor, and Node Info -->
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
      </ul>
      <div
        class="tab-content p-3"
        :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
      >
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
          <div v-if="fetchedTemplates.length > 0">
            <div
              id="templateList"
              tabindex="0"
              class="list-group"
              :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }"
              style="max-height: 600px; overflow-y: auto; border: 1px solid #ddd; padding: 5px"
            >
              <button
                v-for="(template, index) in fetchedTemplates"
                :key="index"
                @click="onApplyTemplate(template)"
                :class="[
                  'list-group-item',
                  'list-group-item-action',
                  { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' },
                ]"
                style="cursor: pointer"
              >
                {{ template.name }}
              </button>
            </div>
          </div>
          <p v-else class="text-muted">No templates available.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

defineProps({
  sidebarCollapsed: Boolean,
  theme: String,
  activeTab: String,
  graphMetadata: Object,
  graphHistory: Array,
  selectedHistoryIndex: Number,
  selectedElement: Object,
  fetchedTemplates: Array,
})

const emit = defineEmits([
  'update:activeTab',
  'save-graph',
  'history-keydown',
  'history-item-click',
  'apply-template',
  'update:graphMetadata',
])

const setActiveTab = (tab) => {
  emit('update:activeTab', tab)
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

const updateMetadata = (key, value) => {
  emit('update:graphMetadata', { ...graphMetadata, [key]: value })
}
</script>

<style scoped>
.sidebar {
  transition: width 0.3s;
  width: 25%;
  overflow-y: auto;
  padding: 20px;
}

.sidebar.collapsed {
  width: 0;
  padding: 0;
  overflow: auto;
}

.form-section {
  background: transparent;
}

.nav-tabs .nav-link {
  border-radius: 0;
}

.nav-tabs .nav-link.active {
  background: #fff;
  border-bottom: 2px solid #007bff;
}

.nav-tabs-dark {
  background-color: #343a40;
  border-color: #454d55;
}

.nav-tabs-dark .nav-link {
  color: #adb5bd;
}

.nav-tabs-dark .nav-link.active {
  background-color: #495057;
  color: #fff;
}

.list-group-item-action:hover {
  background-color: #e9ecef;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    z-index: 1000;
    height: 100%;
    width: 80%;
    left: 0;
    transform: translateX(-100%);
  }

  .sidebar.collapsed {
    transform: translateX(0);
  }
}
</style>
