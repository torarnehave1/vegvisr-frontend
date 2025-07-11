<template>
  <div class="gnew-node-renderer">
    <component
      :is="nodeComponent"
      :node="node"
      :isPreview="isPreview"
      :showControls="showControls"
      @node-updated="handleNodeUpdated"
      @node-deleted="handleNodeDeleted"
      @node-created="handleNodeCreated"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import GNewDefaultNode from './GNewNodes/GNewDefaultNode.vue'
import GNewImageNode from './GNewNodes/GNewImageNode.vue'
import GNewVideoNode from './GNewNodes/GNewVideoNode.vue'
import GNewAudioNode from './GNewNodes/GNewAudioNode.vue'
import GNewTitleNode from './GNewNodes/GNewTitleNode.vue'
import GNewImageQuoteNode from './GNewNodes/GNewImageQuoteNode.vue'
import GNewButtonRowNode from './GNewNodes/GNewButtonRowNode.vue'
import GNewActionTestNode from './GNewNodes/GNewActionTestNode.vue'
import GNewStripeButtonNode from './GNewNodes/GNewStripeButtonNode.vue'
// Phase 3.2 Chart Components
import GNewChartNode from './GNewNodes/GNewChartNode.vue'
import GNewPieChartNode from './GNewNodes/GNewPieChartNode.vue'
import GNewLineChartNode from './GNewNodes/GNewLineChartNode.vue'
import GNewTimelineNode from './GNewNodes/GNewTimelineNode.vue'
import GNewBubbleChartNode from './GNewNodes/GNewBubbleChartNode.vue'
import GNewSWOTNode from './GNewNodes/GNewSWOTNode.vue'
import GNewWhisperNode from './GNewNodes/GNewWhisperNode.vue'
import GNewImageAnalysisNode from './GNewNodes/GNewImageAnalysisNode.vue'

// Props
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
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

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
  // Image analysis
  'image-analysis': GNewImageAnalysisNode,
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
