<template>
  <div class="gnew-node-renderer">
    <component
      :is="nodeComponent"
      :node="node"
      :isPreview="isPreview"
      :showControls="showControls"
      @node-updated="handleNodeUpdated"
      @node-deleted="handleNodeDeleted"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import GNewDefaultNode from './GNewNodes/GNewDefaultNode.vue'
import GNewImageNode from './GNewNodes/GNewImageNode.vue'
import GNewVideoNode from './GNewNodes/GNewVideoNode.vue'
import GNewTitleNode from './GNewNodes/GNewTitleNode.vue'

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
const emit = defineEmits(['node-updated', 'node-deleted'])

// Dynamic component mapping
const nodeComponents = {
  default: GNewDefaultNode,
  'markdown-image': GNewImageNode,
  background: GNewImageNode,
  'portfolio-image': GNewImageNode,
  'youtube-video': GNewVideoNode,
  title: GNewTitleNode,
  // Chart types (will be added in Phase 3.2)
  chart: GNewDefaultNode,
  piechart: GNewDefaultNode,
  linechart: GNewDefaultNode,
  timeline: GNewDefaultNode,
  bubblechart: GNewDefaultNode,
  swot: GNewDefaultNode,
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
</script>

<style scoped>
.gnew-node-renderer {
  margin-bottom: 20px;
}
</style>
