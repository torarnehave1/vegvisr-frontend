<template>
  <div class="piechart-container" v-if="slices.length">
    <svg viewBox="0 0 200 200" width="200" height="200" class="piechart-svg">
      <g>
        <template v-for="(slice, i) in slices" :key="i">
          <path
            :d="describeArc(100, 100, 90, slice.startAngle, slice.endAngle)"
            :fill="slice.color"
            stroke="#fff"
            stroke-width="2"
          />
        </template>
      </g>
    </svg>
    <div class="piechart-legend">
      <div v-for="(slice, i) in slices" :key="i" class="piechart-legend-item">
        <span class="piechart-legend-color" :style="{ background: slice.color }"></span>
        <span class="piechart-legend-label">{{ slice.label }} ({{ slice.value }})</span>
      </div>
    </div>
  </div>
  <div v-else class="piechart-empty">No chart data.</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: [String, Array], required: true },
})

const bars = computed(() => {
  try {
    return Array.isArray(props.data) ? props.data : JSON.parse(props.data)
  } catch {
    return []
  }
})

const total = computed(() => bars.value.reduce((sum, b) => sum + b.value, 0))

const slices = computed(() => {
  let angle = 0
  return bars.value.map((b) => {
    const startAngle = angle
    const angleDelta = total.value ? (b.value / total.value) * 360 : 0
    angle += angleDelta
    return {
      ...b,
      startAngle,
      endAngle: angle,
    }
  })
})

// SVG arc helper
function polarToCartesian(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180.0
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ')
}
</script>

<style scoped>
.piechart-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.piechart-svg {
  display: block;
  margin: 0 auto 16px auto;
}
.piechart-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.piechart-legend-item {
  display: flex;
  align-items: center;
  font-size: 1rem;
}
.piechart-legend-color {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  margin-right: 8px;
  display: inline-block;
}
.piechart-legend-label {
  color: #333;
}
.piechart-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
</style>
