<template>
  <div class="gnew-node-renderer">
    <!-- Streamlined Reorder Controls (Admin Only) -->
    <GNewNodeControlBar
      v-if="showControls && nodeComponent"
      :node-type="node.type || 'default'"
      :position="nodePosition"
      :total="totalNodes"
      :is-first="nodePosition === 1"
      :is-last="nodePosition === totalNodes"
      :node-content="node.info || ''"
      @format-node="$emit('format-node', node)"
      @quick-format="$emit('quick-format', node, $event)"
      @copy-node="$emit('copy-node', node)"
      @move-up="$emit('move-up', node)"
      @move-down="$emit('move-down', node)"
      @open-reorder="$emit('open-reorder')"
    />

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
</template>

<script setup>
import { computed } from 'vue'
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
import GNewAdvertisementManagerNode from './GNewNodes/GNewAdvertisementManagerNode.vue'

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
  // Map node
  map: GNewMapNode,
  // Slideshow node
  slideshow: GNewSlideshowNode,
  // Advertisement Manager node
  advertisement_manager: GNewAdvertisementManagerNode,
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
</script>

<style scoped>
.gnew-node-renderer {
  margin-bottom: 20px;
}
</style>
