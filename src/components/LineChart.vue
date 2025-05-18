<template>
  <div class="linechart-container" v-if="lines.length && lines[0].points.length">
    <svg :viewBox="`0 0 ${width} ${height}`" :width="width" :height="height" class="linechart-svg">
      <!-- Grid lines -->
      <g class="linechart-grid">
        <line
          v-for="(y, i) in yTicks"
          :key="'ygrid-' + i"
          :x1="margin.left"
          :x2="width - margin.right"
          :y1="yScale(y)"
          :y2="yScale(y)"
          stroke="#eee"
        />
        <line
          v-for="(x, i) in xTicks"
          :key="'xgrid-' + i"
          :y1="margin.top"
          :y2="height - margin.bottom"
          :x1="xScale(x)"
          :x2="xScale(x)"
          stroke="#eee"
        />
      </g>
      <!-- Axes -->
      <g class="linechart-axes">
        <!-- Y Axis -->
        <line
          :x1="margin.left"
          :x2="margin.left"
          :y1="margin.top"
          :y2="height - margin.bottom"
          stroke="#888"
          stroke-width="2"
        />
        <!-- X Axis -->
        <line
          :y1="height - margin.bottom"
          :y2="height - margin.bottom"
          :x1="margin.left"
          :x2="width - margin.right"
          stroke="#888"
          stroke-width="2"
        />
      </g>
      <!-- Y Axis Ticks & Labels -->
      <g class="linechart-y-ticks">
        <g v-for="(y, i) in yTicks" :key="'ytick-' + i">
          <text
            :x="margin.left - 8"
            :y="yScale(y) + 4"
            text-anchor="end"
            font-size="12"
            fill="#666"
          >
            {{ y }}
          </text>
        </g>
      </g>
      <!-- X Axis Ticks & Labels -->
      <g class="linechart-x-ticks">
        <g v-for="(x, i) in xTicks" :key="'xtick-' + i">
          <text
            :x="xScale(x)"
            :y="height - margin.bottom + 18"
            text-anchor="middle"
            font-size="12"
            fill="#666"
          >
            {{ x }}
          </text>
        </g>
      </g>
      <!-- Lines and Points -->
      <g v-for="(line, i) in lines" :key="'line-' + i">
        <polyline
          :points="line.points.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(' ')"
          :stroke="line.color"
          fill="none"
          stroke-width="2.5"
        />
        <circle
          v-for="(p, j) in line.points"
          :key="'pt-' + i + '-' + j"
          :cx="xScale(p.x)"
          :cy="yScale(p.y)"
          r="4"
          :fill="line.color"
          stroke="#fff"
          stroke-width="1.5"
        />
      </g>
    </svg>
    <!-- Legend (if multiple lines) -->
    <div v-if="lines.length > 1" class="linechart-legend">
      <div v-for="(line, i) in lines" :key="'legend-' + i" class="linechart-legend-item">
        <span class="linechart-legend-color" :style="{ background: line.color }"></span>
        <span class="linechart-legend-label">{{ line.label }}</span>
      </div>
    </div>
  </div>
  <div v-else class="linechart-empty">No chart data.</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: [String, Array], required: true },
})

// Chart dimensions
const width = 600
const height = 320
const margin = { top: 32, right: 32, bottom: 48, left: 48 }

// Parse data
const parsedData = computed(() => {
  try {
    return Array.isArray(props.data) ? props.data : JSON.parse(props.data)
  } catch {
    return []
  }
})

// Support both single and multi-line data
// Single line: [{ x, y, color? }, ...]
// Multi line: [{ label, color?, points: [{ x, y }] }, ...]
const lines = computed(() => {
  const d = parsedData.value
  if (!Array.isArray(d) || d.length === 0) return []
  if (d[0] && Array.isArray(d[0].points)) {
    // Multi-line
    return d.map((l, i) => ({
      label: l.label || `Line ${i + 1}`,
      color: l.color || defaultColors[i % defaultColors.length],
      points: l.points,
    }))
  } else {
    // Single line
    return [
      {
        label: 'Line',
        color: defaultColors[0],
        points: d,
      },
    ]
  }
})

const allPoints = computed(() => lines.value.flatMap((l) => l.points))

// Axis domains
const xValues = computed(() => allPoints.value.map((p) => p.x))
const yValues = computed(() => allPoints.value.map((p) => p.y))
const xMin = computed(() => Math.min(...xValues.value))
const xMax = computed(() => Math.max(...xValues.value))
const yMin = computed(() => Math.min(...yValues.value))
const yMax = computed(() => Math.max(...yValues.value))

// Ticks
function getTicks(min, max, count) {
  if (!isFinite(min) || !isFinite(max)) return []
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 100) / 100)
}
const xTicks = computed(() => getTicks(xMin.value, xMax.value, 7))
const yTicks = computed(() => getTicks(yMin.value, yMax.value, 6))

// Scales
function xScale(x) {
  if (xMax.value === xMin.value) return margin.left
  return (
    margin.left +
    ((x - xMin.value) / (xMax.value - xMin.value)) * (width - margin.left - margin.right)
  )
}
function yScale(y) {
  if (yMax.value === yMin.value) return height - margin.bottom
  return (
    height -
    margin.bottom -
    ((y - yMin.value) / (yMax.value - yMin.value)) * (height - margin.top - margin.bottom)
  )
}

// Default color palette
const defaultColors = ['#4a90e2', '#e94e77', '#f9d423', '#6ac174', '#8c54ff', '#ff8c42', '#00b8a9']
</script>

<style scoped>
.linechart-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.linechart-svg {
  display: block;
  margin: 0 auto 16px auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.linechart-legend {
  display: flex;
  flex-direction: row;
  gap: 16px;
  margin-top: 8px;
}
.linechart-legend-item {
  display: flex;
  align-items: center;
  font-size: 1rem;
}
.linechart-legend-color {
  width: 18px;
  height: 6px;
  border-radius: 3px;
  margin-right: 8px;
  display: inline-block;
}
.linechart-legend-label {
  color: #333;
}
.linechart-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
</style>
