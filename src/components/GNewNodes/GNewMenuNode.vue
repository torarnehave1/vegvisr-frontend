<template>
  <div class="gnew-menu-node">
    <!-- Node Controls -->
    <div v-if="showControls && !isPreview" class="node-controls">
      <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Edit Menu">
        <i class="fas fa-edit"></i> Edit Menu
      </button>
      <button @click="deleteNode" class="btn btn-sm btn-outline-danger ms-2" title="Delete Node">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- ADMIN MODE: Show full menu interface for users with controls -->
    <div v-if="showControls" class="menu-container">
      <div class="menu-header">
        <h4 class="menu-title">{{ node.label || 'Menu' }}</h4>
        <div class="menu-info">
          <span class="menu-level-badge" :class="menuLevelClass">
            {{ (menuData.menuLevel || 'graph') === 'graph' ? 'GRAPH MENU' : 'TOP MENU' }}
          </span>
          <span class="menu-items-count"> {{ (menuData.items || []).length }} items </span>
        </div>
      </div>

      <div class="menu-preview" v-if="!isPreview">
        <p class="menu-description">
          {{ menuData.description || 'No description' }}
        </p>
        <div class="menu-items-preview">
          <div v-for="item in previewItems" :key="item.id" class="preview-item">
            <span class="preview-icon">{{ item.icon }}</span>
            <span class="preview-label">{{ item.label }}</span>
            <span v-if="item.requiresRole" class="preview-badge">{{
              item.requiresRole.join(', ')
            }}</span>
          </div>
        </div>
      </div>

      <!-- Interactive Menu -->
      <div class="menu-interactive">
        <GraphMenuButton
          :isOpen="showMenu"
          :menuIcon="menuStyle.icon || '☰'"
          :menuLabel="'Open ' + (node.label || 'Menu')"
          :buttonStyle="menuStyle.buttonStyle || 'hamburger'"
          @toggle="toggleMenu"
        />

        <GraphMenuOverlay
          :isOpen="showMenu"
          :menuTitle="node.label || 'Menu'"
          :menuItems="menuData.items || []"
          @close="closeMenu"
          @menu-item-clicked="handleMenuItemClick"
        />
      </div>
    </div>

    <!-- PUBLIC MODE: Show only hamburger menu for non-logged-in users -->
    <div v-else class="public-menu-container">
      <GraphMenuButton
        :isOpen="showMenu"
        :menuIcon="menuStyle.icon || '☰'"
        :menuLabel="'Open Menu'"
        :buttonStyle="menuStyle.buttonStyle || 'hamburger'"
        @toggle="toggleMenu"
      />

      <GraphMenuOverlay
        :isOpen="showMenu"
        :menuTitle="'Menu'"
        :menuItems="menuData.items || []"
        @close="closeMenu"
        @menu-item-clicked="handleMenuItemClick"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useGraphTemplateStore } from '@/stores/graphTemplateStore'
import GraphMenuButton from '@/components/GraphMenuButton.vue'
import GraphMenuOverlay from '@/components/GraphMenuOverlay.vue'

// Props (same pattern as other GNew nodes)
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
})

// Emits (same pattern as other GNew nodes)
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created', 'template-requested'])

// Dependencies
const router = useRouter()
const graphStore = useKnowledgeGraphStore()
const templateStore = useGraphTemplateStore()

// State
const showMenu = ref(false)

// Computed properties
const menuData = computed(() => {
  try {
    return JSON.parse(props.node.info || '{}')
  } catch {
    return {
      items: [],
      style: {},
      menuLevel: 'graph',
      description: '',
    }
  }
})

const menuStyle = computed(() => {
  return menuData.value.style || {}
})

const menuLevelClass = computed(() => {
  return {
    'level-graph': menuData.value.menuLevel === 'graph',
    'level-top': menuData.value.menuLevel === 'top',
  }
})

const previewItems = computed(() => {
  const items = menuData.value.items || []
  return items // Show all items in preview, not just first 3
})

// Methods (same pattern as HamburgerMenu)
const toggleMenu = () => {
  console.log('🍔 GNewMenuNode: toggleMenu called')
  showMenu.value = !showMenu.value
}

const closeMenu = () => {
  console.log('🍔 GNewMenuNode: closeMenu called')
  showMenu.value = false
}

const handleMenuItemClick = (item) => {
  console.log('🍔 GNewMenuNode: menu item clicked:', item)

  switch (item.type) {
    case 'graph-link':
      navigateToGraph(item.graphId)
      break
    case 'template-selector':
      insertTemplateNode(item.nodeType)
      break
    case 'route':
      navigateToRoute(item.path)
      break
    case 'external':
      openExternalLink(item.url)
      break
    default:
      console.warn('Unknown menu item type:', item.type)
  }
}

const navigateToGraph = async (graphId) => {
  try {
    console.log('🍔 Navigating to graph:', graphId)
    // Set the graph ID in the store
    graphStore.setCurrentGraphId(graphId)
    // Navigate to the modern GnewViewer
    router.push({ name: 'gnew-viewer', query: { graphId: graphId } })
  } catch (error) {
    console.error('Failed to navigate to graph:', error)
    // Could show a toast notification here
  }
}

const insertTemplateNode = async (nodeType) => {
  console.log('🍔 Inserting template node:', nodeType)

  try {
    // Fetch template from database
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')

    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.status}`)
    }

    const data = await response.json()

    if (data.results && Array.isArray(data.results)) {
      // Find template by nodeType
      const template = data.results.find((t) => {
        // Check if any node in the template matches the nodeType
        try {
          const nodes = JSON.parse(t.nodes || '[]')
          return nodes.some((node) => node.type === nodeType)
        } catch {
          return false
        }
      })

      if (template) {
        // Generate UUID for new node
        const generateUUID = () => {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0
            const v = c == 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })
        }

        // Create node from template
        const templateNodes = JSON.parse(template.nodes || '[]')
        const templateNode =
          templateNodes.find((node) => node.type === nodeType) || templateNodes[0]

        const nodeData = {
          id: generateUUID(),
          label: templateNode.label || template.name || 'New Node',
          color: templateNode.color || '#f9f9f9',
          type: templateNode.type || nodeType,
          info: templateNode.info || '',
          bibl: Array.isArray(templateNode.bibl) ? templateNode.bibl : [],
          imageWidth: templateNode.imageWidth || '100%',
          imageHeight: templateNode.imageHeight || '100%',
          visible: templateNode.visible !== false,
          path: templateNode.path || null,
        }

        console.log('🍔 Created node from template:', nodeData)

        // Emit the node to be added to the graph
        emit('node-created', nodeData)

        // Close the menu after successful insertion
        closeMenu()
      } else {
        console.error('🍔 Template not found for nodeType:', nodeType)
        alert(`Template not found for node type: ${nodeType}`)
      }
    } else {
      throw new Error('Invalid response format: missing results array')
    }
  } catch (error) {
    console.error('🍔 Error inserting template node:', error)
    alert('Failed to insert template node: ' + error.message)
  }
}

const openTemplateSelector = () => {
  console.log('🍔 Opening template selector')
  emit('template-requested')
}

const navigateToRoute = (path) => {
  console.log('🍔 Navigating to route:', path)
  router.push(path)
}

const openExternalLink = (url) => {
  console.log('🍔 Opening external link:', url)
  window.open(url, '_blank')
}

const editNode = () => {
  console.log('🍔 Edit menu node:', props.node.id)
  emit('node-updated', { ...props.node, action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Are you sure you want to delete this menu?')) {
    console.log('🍔 Delete menu node:', props.node.id)
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-menu-node {
  background: #ffffff;
  border: 2px solid #e7f3ff;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1rem 0;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.1);
  transition: all 0.3s ease;
}

.gnew-menu-node:hover {
  border-color: #007bff;
  box-shadow: 0 4px 16px rgba(0, 123, 255, 0.15);
}

.node-controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
  gap: 0.5rem;
}

.menu-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.menu-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.menu-title {
  color: #333;
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
}

.menu-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.menu-level-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.menu-level-badge.level-graph {
  background-color: #28a745;
  color: white;
}

.menu-level-badge.level-top {
  background-color: #007bff;
  color: white;
}

.menu-items-count {
  color: #666;
  font-size: 0.8rem;
}

.menu-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.menu-description {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  font-style: italic;
}

.menu-items-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-icon {
  width: 20px;
  text-align: center;
  font-size: 1rem;
}

.preview-label {
  flex: 1;
  color: #333;
  font-size: 0.9rem;
}

.preview-badge {
  background-color: #ffc107;
  color: #333;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 500;
}

.menu-interactive {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

/* Node type styling */
.gnew-menu-node .menu-interactive {
  border-color: #007bff;
  background: linear-gradient(135deg, #e7f3ff 0%, #f8f9fa 100%);
}

/* Public menu container - grey background for visibility */
.public-menu-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Override the gnew-menu-node styles for public mode */
.gnew-menu-node:has(.public-menu-container) {
  background: #ffffff;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 0.5rem;
  margin: 0.5rem 0;
  border-radius: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .gnew-menu-node {
    padding: 1rem;
  }

  .menu-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .menu-info {
    flex-direction: row;
    align-items: center;
  }

  .menu-title {
    font-size: 1.1rem;
  }

  .menu-preview {
    padding: 0.75rem;
  }

  .preview-item {
    padding: 0.4rem 0;
  }

  .public-menu-container {
    padding: 0.5rem;
  }
}
</style>
