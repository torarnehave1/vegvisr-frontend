<template>
  <div class="gnew-person-network-canvas">
    <div class="network-canvas-card">
      <!-- Header -->
      <div class="canvas-header">
        <h3 class="canvas-title">
          <span class="title-icon">🕸️</span>
          {{ personName }} sitt nettverk
        </h3>
        <div class="header-meta">
          <span class="connections-count">{{ connections.length }} forbindelser</span>
          <span class="gender-distribution">
            {{ femaleCount }} K / {{ maleCount }} M
          </span>
        </div>
      </div>

      <!-- SVG Network Visualization -->
      <div class="network-visualization" ref="canvasContainer">
        <svg
          ref="svgCanvas"
          :width="canvasWidth"
          :height="canvasHeight"
          :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
          class="network-svg"
        >
          <!-- Connection lines -->
          <g class="connections-layer">
            <line
              v-for="(conn, index) in connectionLines"
              :key="'line-' + index"
              :x1="centerX"
              :y1="centerY"
              :x2="conn.x"
              :y2="conn.y"
              class="connection-line"
              :class="{ highlighted: hoveredConnection === index }"
            />
          </g>

          <!-- Central person node -->
          <g
            class="central-node"
            :transform="`translate(${centerX}, ${centerY})`"
            @click="handleCentralPersonClick"
          >
            <circle
              r="50"
              class="central-circle"
              :class="centralPersonGender === 'K' ? 'female' : 'male'"
            />
            <text class="central-initials" dy="8">{{ centralInitials }}</text>
            <text class="central-label" dy="70">{{ truncateName(personName, 20) }}</text>
          </g>

          <!-- Connection nodes -->
          <g
            v-for="(conn, index) in positionedConnections"
            :key="'node-' + index"
            class="connection-node"
            :transform="`translate(${conn.x}, ${conn.y})`"
            @click="handleConnectionClick(conn, $event)"
            @mouseenter="hoveredConnection = index"
            @mouseleave="hoveredConnection = null"
          >
            <circle
              :r="getNodeRadius(conn)"
              class="node-circle"
              :class="[
                conn.gender === 'K' ? 'female' : 'male',
                { highlighted: hoveredConnection === index }
              ]"
            />
            <text class="node-initials" dy="5">{{ getInitials(conn.name) }}</text>
            <text class="node-label" :dy="getNodeRadius(conn) + 16">
              {{ truncateName(conn.name, 15) }}
            </text>
            <text
              v-if="conn.numberOfConnections"
              class="node-count"
              :dy="-getNodeRadius(conn) - 8"
            >
              {{ conn.numberOfConnections }}
            </text>
          </g>
        </svg>
      </div>

      <!-- Legend and Stats -->
      <div class="canvas-legend">
        <div class="legend-item">
          <span class="legend-dot female"></span>
          <span>Kvinner ({{ femaleCount }})</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot male"></span>
          <span>Menn ({{ maleCount }})</span>
        </div>
        <div class="legend-item">
          <span class="legend-info">Sirkelstørrelse = antall forbindelser</span>
        </div>
      </div>

      <!-- Roles Summary (if central person has roles) -->
      <div v-if="centralPersonRoles.length > 0" class="roles-summary">
        <h4 class="section-title">
          <span class="section-icon">💼</span> Kjente roller
        </h4>
        <div class="roles-list">
          <div v-for="(role, index) in centralPersonRoles.slice(0, 5)" :key="index" class="role-item">
            <span class="role-name">{{ role.roleName }}</span>
            <span class="role-company">{{ role.companyName }}</span>
          </div>
          <div v-if="centralPersonRoles.length > 5" class="roles-more">
            + {{ centralPersonRoles.length - 5 }} flere roller
          </div>
        </div>
      </div>

      <!-- Node Controls -->
      <div v-if="showControls && !isPreview" class="node-controls">
        <button @click="expandAllConnections" class="btn btn-sm btn-outline-primary" title="Utvid alle forbindelser til canvas">
          🔄 Utvid alle
        </button>
        <button @click="editNode" class="btn btn-sm btn-outline-secondary" title="Rediger">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Slett">
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  showControls: {
    type: Boolean,
    default: true
  },
  graphId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Refs
const canvasContainer = ref(null)
const svgCanvas = ref(null)
const hoveredConnection = ref(null)

// Canvas dimensions
const canvasWidth = ref(600)
const canvasHeight = ref(500)
const centerX = computed(() => canvasWidth.value / 2)
const centerY = computed(() => canvasHeight.value / 2)

// Parse node data
const nodeData = computed(() => {
  // Try parsing from node.info
  if (props.node.info) {
    try {
      const parsed = JSON.parse(props.node.info)
      if (parsed && typeof parsed === 'object') {
        // Check for proffData wrapper
        if (parsed.proffData) {
          return parsed.proffData
        }
        return parsed
      }
    } catch (e) {
      // Not JSON
    }
  }
  // Try node.data
  if (props.node.data && typeof props.node.data === 'object') {
    return props.node.data
  }
  return props.node
})

// Computed properties
const personName = computed(() => {
  return nodeData.value.name || nodeData.value.person?.name || props.node.label || 'Ukjent person'
})

const centralPersonGender = computed(() => {
  return nodeData.value.gender || nodeData.value.person?.gender || 'M'
})

const centralPersonRoles = computed(() => {
  return nodeData.value.roles || nodeData.value.person?.roles || []
})

const connections = computed(() => {
  const conn = nodeData.value.connections || nodeData.value.person?.connections || []
  // Filter out non-array values
  if (!Array.isArray(conn)) return []
  return conn
})

const centralInitials = computed(() => {
  const name = personName.value
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
})

const femaleCount = computed(() => connections.value.filter(c => c.gender === 'K').length)
const maleCount = computed(() => connections.value.filter(c => c.gender !== 'K').length)

// Calculate positions for connections in a radial layout
const positionedConnections = computed(() => {
  const conns = connections.value
  const count = conns.length
  if (count === 0) return []

  const radius = Math.min(canvasWidth.value, canvasHeight.value) * 0.35
  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2 // Start from top

  return conns.map((conn, index) => {
    const angle = startAngle + (index * angleStep)
    return {
      ...conn,
      x: centerX.value + radius * Math.cos(angle),
      y: centerY.value + radius * Math.sin(angle),
      angle
    }
  })
})

// Connection lines coordinates
const connectionLines = computed(() => {
  return positionedConnections.value.map(conn => ({
    x: conn.x,
    y: conn.y
  }))
})

// Helper functions
const getInitials = (name) => {
  if (!name) return '??'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const truncateName = (name, maxLength) => {
  if (!name) return ''
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength - 2) + '...'
}

const getNodeRadius = (conn) => {
  // Scale radius based on number of connections (if available)
  const baseRadius = 28
  const maxRadius = 40
  const minRadius = 22

  if (!conn.numberOfConnections) return baseRadius

  // Find max connections for scaling
  const maxConns = Math.max(...connections.value.map(c => c.numberOfConnections || 0))
  if (maxConns === 0) return baseRadius

  const scale = conn.numberOfConnections / maxConns
  return minRadius + (maxRadius - minRadius) * scale
}

// Event handlers
const handleCentralPersonClick = () => {
  emit('node-created', {
    type: 'person-profile',
    label: personName.value,
    data: {
      personId: nodeData.value.personId || nodeData.value.person?.personId,
      name: personName.value,
      gender: centralPersonGender.value,
      roles: centralPersonRoles.value,
      connections: connections.value
    }
  })
}

const handleConnectionClick = (conn, event) => {
  event.stopPropagation()
  emit('node-created', {
    type: 'person-profile',
    label: conn.name,
    data: {
      personId: conn.personId,
      name: conn.name,
      gender: conn.gender,
      numberOfConnections: conn.numberOfConnections
    }
  })
}

const expandAllConnections = () => {
  // Emit event to create all connection nodes
  emit('node-updated', {
    ...props.node,
    _action: 'expand-network',
    _expandParams: {
      centralPerson: {
        personId: nodeData.value.personId || nodeData.value.person?.personId,
        name: personName.value,
        gender: centralPersonGender.value
      },
      connections: connections.value
    }
  })
}

const editNode = () => {
  emit('node-updated', { ...props.node, _action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Er du sikker på at du vil slette dette nettverkskartet?')) {
    emit('node-deleted', props.node.id)
  }
}

// Responsive resize
const updateCanvasSize = () => {
  if (canvasContainer.value) {
    const rect = canvasContainer.value.getBoundingClientRect()
    canvasWidth.value = Math.max(400, Math.min(rect.width, 800))
    canvasHeight.value = Math.max(400, Math.min(canvasWidth.value * 0.83, 600))
  }
}

onMounted(() => {
  updateCanvasSize()
  window.addEventListener('resize', updateCanvasSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
})
</script>

<style scoped>
.gnew-person-network-canvas {
  margin: 16px 0;
}

.network-canvas-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

/* Header */
.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%);
  color: white;
}

.canvas-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.5rem;
}

.header-meta {
  display: flex;
  gap: 16px;
  align-items: center;
}

.connections-count {
  padding: 6px 14px;
  background: rgba(255,255,255,0.2);
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.gender-distribution {
  font-size: 0.85rem;
  opacity: 0.9;
}

/* Network Visualization */
.network-visualization {
  padding: 20px;
  background: #f8fafc;
  min-height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.network-svg {
  display: block;
}

/* Connection lines */
.connection-line {
  stroke: #cbd5e1;
  stroke-width: 2;
  transition: stroke 0.2s, stroke-width 0.2s;
}

.connection-line.highlighted {
  stroke: #7c3aed;
  stroke-width: 3;
}

/* Central node */
.central-node {
  cursor: pointer;
}

.central-circle {
  fill: #f1f5f9;
  stroke-width: 4;
  transition: transform 0.2s;
}

.central-circle.female {
  stroke: #ec4899;
  fill: #fce7f3;
}

.central-circle.male {
  stroke: #3b82f6;
  fill: #dbeafe;
}

.central-node:hover .central-circle {
  transform: scale(1.1);
}

.central-initials {
  font-size: 22px;
  font-weight: 700;
  fill: #1e293b;
  text-anchor: middle;
  pointer-events: none;
}

.central-label {
  font-size: 13px;
  font-weight: 600;
  fill: #334155;
  text-anchor: middle;
  pointer-events: none;
}

/* Connection nodes */
.connection-node {
  cursor: pointer;
}

.node-circle {
  fill: #f1f5f9;
  stroke-width: 3;
  transition: transform 0.2s, stroke-width 0.2s;
}

.node-circle.female {
  stroke: #ec4899;
  fill: #fce7f3;
}

.node-circle.male {
  stroke: #3b82f6;
  fill: #dbeafe;
}

.node-circle.highlighted {
  stroke-width: 4;
  transform: scale(1.15);
}

.connection-node:hover .node-circle {
  transform: scale(1.15);
}

.node-initials {
  font-size: 12px;
  font-weight: 600;
  fill: #1e293b;
  text-anchor: middle;
  pointer-events: none;
}

.node-label {
  font-size: 10px;
  fill: #475569;
  text-anchor: middle;
  pointer-events: none;
}

.node-count {
  font-size: 10px;
  font-weight: 700;
  fill: #7c3aed;
  text-anchor: middle;
  pointer-events: none;
}

/* Legend */
.canvas-legend {
  display: flex;
  gap: 20px;
  padding: 12px 24px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  justify-content: center;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #64748b;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.legend-dot.female {
  background: #fce7f3;
  border: 2px solid #ec4899;
}

.legend-dot.male {
  background: #dbeafe;
  border: 2px solid #3b82f6;
}

.legend-info {
  font-style: italic;
  color: #94a3b8;
}

/* Roles Summary */
.roles-summary {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
}

.section-icon {
  font-size: 1rem;
}

.roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 0.85rem;
}

.role-name {
  font-weight: 600;
  color: #334155;
}

.role-company {
  color: #64748b;
  font-size: 0.8rem;
}

.roles-more {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #e2e8f0;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #64748b;
  font-style: italic;
}

/* Controls */
.node-controls {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

/* Responsive */
@media (max-width: 768px) {
  .canvas-header {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .header-meta {
    flex-wrap: wrap;
    justify-content: center;
  }

  .canvas-legend {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
