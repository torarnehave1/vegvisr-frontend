<template>
  <div class="gnew-node-renderer">
    <!-- Streamlined Reorder Conimport GNewEmailManagerNode from './GNewNodes/GNewEmailManagerNode.vue'
import GNewMapNode from './GNewNodes/GNewMapNode.vue'
import GNewSlideshowNode from './GNewNodes/GNewSlideshowNode.vue'
import GNewAdvertisementManagerNode from './GNewNodes/GNewAdManagerNode.vue'
import GNewEmailManagerNode from './GNewNodes/GNewEmailManagerNode.vue'
import GNewPasswordProtectionNode from './GNewNodes/GNewPasswordProtectionNode.vue'
import GNewMermaidNode from './GNewNodes/GNewMermaidNode.vue'(Admin Only) -->
    <GNewNodeControlBar
      v-if="showControls && nodeComponent"
      :node-type="node.type || 'default'"
      :position="nodePosition"
      :total="totalNodes"
      :is-first="nodePosition === 1"
      :is-last="nodePosition === totalNodes"
      :node-content="node.info || ''"
      :is-collapsed="isContentCollapsed"
      @format-node="$emit('format-node', node)"
      @quick-format="$emit('quick-format', node, $event)"
      @copy-node="$emit('copy-node', node)"
      @duplicate-node="$emit('duplicate-node', node)"
      @move-up="$emit('move-up', node)"
      @move-down="$emit('move-down', node)"
      @open-reorder="$emit('open-reorder')"
      @toggle-content="toggleNodeContent"
    />

    <!-- Node Content (collapsible) -->
    <div v-show="!isContentCollapsed" class="node-content-container">
      <component
        v-if="nodeComponent"
        :is="nodeComponent"
        :node="node"
        :graphData="graphData"
        :isPreview="isPreview"
        :showControls="showControls"
        :graphId="graphId"
        @node-updated="handleNodeUpdated"
        @node-deleted="handleNodeDeleted"
        @node-created="handleNodeCreated"
      />
    </div>

    <!-- Collapsed State Indicator -->
    <div v-if="isContentCollapsed" class="collapsed-indicator">
      <div class="indicator-content">
        <span class="indicator-icon">📄</span>
        <span class="indicator-text">{{ getCollapsedPreview() }}</span>
        <small class="indicator-type">{{ node.type || 'default' }}</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'

// Import GNewNodeControlBar for streamlined reordering (GNewViewer specific)
import GNewNodeControlBar from './GNewNodeControlBar.vue'

// Import all node components
import GNewDefaultNode from './GNewNodes/GNewDefaultNode.vue'
import GNewImageNode from './GNewNodes/GNewImageNode.vue'
import GNewVideoNode from './GNewNodes/GNewVideoNode.vue'
import GNewAudioNode from './GNewNodes/GNewAudioNode.vue'
import GNewTitleNode from './GNewNodes/GNewTitleNode.vue'
import GNewImageQuoteNode from './GNewNodes/GNewImageQuoteNode.vue'
import GNewButtonRowNode from './GNewNodes/GNewButtonRowNode.vue'
import GNewActionTestNode from './GNewNodes/GNewActionTestNode.vue'
import GNewStripeButtonNode from './GNewNodes/GNewStripeButtonNode.vue'
import GNewChartNode from './GNewNodes/GNewChartNode.vue'
import GNewPieChartNode from './GNewNodes/GNewPieChartNode.vue'
import GNewLineChartNode from './GNewNodes/GNewLineChartNode.vue'
import GNewTimelineNode from './GNewNodes/GNewTimelineNode.vue'
import GNewBubbleChartNode from './GNewNodes/GNewBubbleChartNode.vue'
import GNewSWOTNode from './GNewNodes/GNewSWOTNode.vue'
import GNewWhisperNode from './GNewNodes/GNewWhisperNode.vue'
import GNewImageAnalysisNode from './GNewNodes/GNewImageAnalysisNode.vue'
import GNewAudioPortfolioSelectorNode from './GNewNodes/GNewAudioPortfolioSelectorNode.vue'
import GNewMenuNode from './GNewNodes/GNewMenuNode.vue'
import GNewMenuCreatorNode from './GNewNodes/GNewMenuCreatorNode.vue'
import GNewLearnScriptNode from './GNewNodes/GNewLearnScriptNode.vue'
import GNewSubscriptionNode from './GNewNodes/GNewSubscriptionNode.vue'
import GNewEmailTemplateNode from './GNewNodes/GNewEmailTemplateNode.vue'
import GNewMapNode from './GNewNodes/GNewMapNode.vue'
import GNewSlideshowNode from './GNewNodes/GNewSlideshowNode.vue'
import GNewAdvertisementManagerNode from './GNewNodes/GNewAdManagerNode.vue'
import GNewEmailManagerNode from './GNewNodes/GNewEmailManagerNode.vue'
import GNewPasswordProtectionNode from './GNewNodes/GNewPasswordProtectionNode.vue'
import GNewMermaidNode from './GNewNodes/GNewMermaidNode.vue'

// Store access
const userStore = useUserStore()

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] }),
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  showControls: {
    type: Boolean,
    default: true,
  },
  graphId: {
    type: String,
    default: '',
  },
})

// Emits
const emit = defineEmits([
  'node-updated',
  'node-deleted',
  'node-created',
  'format-node',
  'quick-format',
  'copy-node',
  'move-up',
  'move-down',
  'open-reorder',
])

// Computed properties for reordering
const sortedNodes = computed(() => {
  if (!props.graphData.nodes || props.graphData.nodes.length === 0) {
    return []
  }
  return props.graphData.nodes
    .filter((node) => node.visible !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
})

const nodePosition = computed(() => {
  const index = sortedNodes.value.findIndex((n) => n.id === props.node.id)
  return index + 1
})

const totalNodes = computed(() => {
  return sortedNodes.value.length
})

// Dynamic component mapping
const nodeComponents = {
  default: GNewDefaultNode,
  'markdown-image': GNewImageNode,
  background: GNewImageNode,
  'portfolio-image': GNewImageNode,
  'youtube-video': GNewVideoNode,
  audio: GNewAudioNode,
  title: GNewTitleNode,
  imagequote: GNewImageQuoteNode,
  button_row: GNewButtonRowNode,
  // AI Action node
  action_test: GNewActionTestNode,
  // Stripe Button (NEW)
  'stripe-button': GNewStripeButtonNode,
  // Chart types (Phase 3.2 ✅ COMPLETE)
  chart: GNewChartNode,
  piechart: GNewPieChartNode,
  linechart: GNewLineChartNode,
  timeline: GNewTimelineNode,
  bubblechart: GNewBubbleChartNode,
  swot: GNewSWOTNode,
  // Audio transcription
  'audio-transcription': GNewWhisperNode,
  // Audio portfolio selector
  'audio-portfolio-selector': GNewAudioPortfolioSelectorNode,
  // Image analysis
  'image-analysis': GNewImageAnalysisNode,
  // Menu node
  menu: GNewMenuNode,
  // Menu creator node
  menu_creator: GNewMenuCreatorNode,
  // Learning script generator node
  'learn-script': GNewLearnScriptNode,
  // Subscription node
  subscription: GNewSubscriptionNode,
  // Email template node
  'email-template': GNewEmailTemplateNode,
  // Email manager node
  'email-manager': GNewEmailManagerNode,
  // Map node
  map: GNewMapNode,
  // Slideshow node
  slideshow: GNewSlideshowNode,
  // Advertisement Manager node
  advertisement_manager: GNewAdvertisementManagerNode,
  // Password Protection node
  'password-protection': GNewPasswordProtectionNode,
  // Mermaid diagram node
  'mermaid-diagram': GNewMermaidNode,
  // Text types
  fulltext: GNewDefaultNode,
  worknote: GNewDefaultNode,
  info: GNewDefaultNode,
  // Special types
  REG: GNewDefaultNode,
}

// Compute which component to use
const nodeComponent = computed(() => {
  const nodeType = props.node.type || 'default'

  // Hide audio-transcription nodes for non-Admin/Superadmin users
  if (nodeType === 'audio-transcription') {
    if (!userStore.loggedIn || !['Admin', 'Superadmin'].includes(userStore.role)) {
      console.log('🚫 Audio transcription node hidden - requires Admin/Superadmin role')
      return null
    }
  }

  // Hide advertisement manager for non-Superadmin users
  if (nodeType === 'advertisement_manager') {
    if (!userStore.loggedIn || userStore.role !== 'Superadmin') {
      console.log('🚫 Advertisement manager node hidden - requires Superadmin role')
      return null
    }
  }

  // Hide email manager for non-Admin users
  if (nodeType === 'email-manager') {
    if (!userStore.loggedIn || !['Admin', 'Superadmin'].includes(userStore.role)) {
      console.log('🚫 Email manager node hidden - requires Admin/Superadmin role')
      return null
    }
  }

  // Hide password protection nodes for unauthorized users
  if (nodeType === 'password-protection') {
    if (!userStore.loggedIn) {
      console.log('🚫 Password protection node hidden - user not logged in')
      return null
    }

    // Allow Superadmin to see all password protection nodes
    if (userStore.role === 'Superadmin') {
      console.log('✅ Password protection node visible - user is Superadmin')
    } else {
      // Check if user is the graph owner
      const graphOwner = props.graphData?.metadata?.createdBy
      const userEmail = userStore.email || userStore.user?.email

      if (!graphOwner || !userEmail || graphOwner !== userEmail) {
        console.log('🚫 Password protection node hidden - user is not graph owner', {
          graphOwner,
          userEmail,
          match: graphOwner === userEmail
        })
        return null
      }
      console.log('✅ Password protection node visible - user is graph owner')
    }
  }

  return nodeComponents[nodeType] || nodeComponents['default']
})

// Event handlers
const handleNodeUpdated = (updatedNode) => {
  emit('node-updated', updatedNode)
}

const handleNodeDeleted = (nodeId) => {
  emit('node-deleted', nodeId)
}

const handleNodeCreated = (newNode) => {
  emit('node-created', newNode)
}

// Node content collapse state management
const isContentCollapsed = ref(false)

// Load collapse state from localStorage on mount
onMounted(() => {
  const savedState = localStorage.getItem(`gnew-node-collapsed-${props.node.id}`)
  if (savedState !== null) {
    isContentCollapsed.value = JSON.parse(savedState)
  }
})

// Toggle node content visibility
const toggleNodeContent = () => {
  isContentCollapsed.value = !isContentCollapsed.value
  // Save state to localStorage per node
  localStorage.setItem(`gnew-node-collapsed-${props.node.id}`, JSON.stringify(isContentCollapsed.value))
}

// Get collapsed preview text
const getCollapsedPreview = () => {
  const label = props.node.label || 'Untitled'
  const info = props.node.info || ''

  // Show first 100 characters of content as preview
  const preview = info.substring(0, 100)
  return preview ? `${label}: ${preview}${info.length > 100 ? '...' : ''}` : label
}
</script>

<style scoped>
.gnew-node-renderer {
  margin-bottom: 20px;
}

.node-content-container {
  transition: all 0.3s ease;
}

.collapsed-indicator {
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  border-radius: 6px;
  margin-top: 8px;
  opacity: 0.8;
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6c757d;
}

.indicator-icon {
  font-size: 1.2rem;
}

.indicator-text {
  flex: 1;
  font-size: 0.9rem;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.indicator-type {
  background: #6c757d;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

@media (max-width: 768px) {
  .indicator-text {
    max-width: 200px;
  }
}
</style>
