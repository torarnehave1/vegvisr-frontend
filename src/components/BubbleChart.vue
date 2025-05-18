<template>
  <div class="bubblechart-container" v-if="bubbles.length">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="bubblechart-svg"
    >
      <!-- Grid lines -->
      <g class="bubblechart-grid">
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
      <g class="bubblechart-axes">
        <line
          :x1="yAxisX"
          :x2="yAxisX"
          :y1="margin.top"
          :y2="height - margin.bottom"
          stroke="#888"
          stroke-width="2"
        />
        <line
          :y1="xAxisY"
          :y2="xAxisY"
          :x1="margin.left"
          :x2="width - margin.right"
          stroke="#888"
          stroke-width="2"
        />
      </g>
      <!-- Y Axis Ticks & Labels -->
      <g class="bubblechart-y-ticks">
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
      <g class="bubblechart-x-ticks">
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
      <!-- Bubbles -->
      <g>
        <circle
          v-for="(b, i) in bubbles"
          :key="'bubble-' + i"
          :cx="xScale(b.x)"
          :cy="yScale(b.y)"
          :r="sizeScale(b.size)"
          :fill="b.color || defaultColors[i % defaultColors.length]"
          fill-opacity="0.5"
          stroke="#444"
          stroke-width="1.5"
        />
        <text
          v-for="(b, i) in bubbles"
          :key="'label-' + i"
          :x="xScale(b.x)"
          :y="yScale(b.y) + 4"
          text-anchor="middle"
          font-size="13"
          fill="#222"
          font-weight="bold"
          pointer-events="none"
        >
          {{ b.label }}
        </text>
      </g>
      <!-- Y Axis Label -->
      <text
        v-if="yAxisLabel"
        :x="margin.left - 48"
        :y="margin.top + (height - margin.top - margin.bottom) / 2"
        text-anchor="middle"
        font-size="15"
        fill="#444"
        :transform="`rotate(-90, ${margin.left - 48}, ${margin.top + (height - margin.top - margin.bottom) / 2})`"
        class="bubblechart-axis-label"
      >
        {{ yAxisLabel }}
      </text>
      <!-- X Axis Label -->
      <text
        v-if="xAxisLabel"
        :x="margin.left + (width - margin.left - margin.right) / 2"
        :y="height - 8"
        text-anchor="middle"
        font-size="15"
        fill="#444"
        class="bubblechart-axis-label"
      >
        {{ xAxisLabel }}
      </text>
    </svg>
  </div>
  <div v-else class="bubblechart-empty">No bubble data.</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: [String, Array], required: true },
  xLabel: { type: String, default: '' },
  yLabel: { type: String, default: '' },
})

const width = 600
const height = 340
const margin = { top: 32, right: 32, bottom: 60, left: 70 }

const parsedData = computed(() => {
  let d = props.data
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d)
    } catch {
      return []
    }
  }
  if (d && typeof d === 'object' && !Array.isArray(d) && d.data) {
    return d.data
  }
  return Array.isArray(d) ? d : []
})

const bubbles = computed(() => parsedData.value)
const xValues = computed(() => bubbles.value.map((b) => b.x))
const yValues = computed(() => bubbles.value.map((b) => b.y))
const sizeValues = computed(() => bubbles.value.map((b) => b.size))
const xMin = computed(() => Math.min(...xValues.value))
const xMax = computed(() => Math.max(...xValues.value))
const yMin = computed(() => Math.min(...yValues.value))
const yMax = computed(() => Math.max(...yValues.value))
const sizeMin = computed(() => Math.min(...sizeValues.value))
const sizeMax = computed(() => Math.max(...sizeValues.value))

// Find max absolute value for symmetric domain
const maxAbsX = computed(() => Math.max(Math.abs(xMin.value), Math.abs(xMax.value)))
const maxAbsY = computed(() => Math.max(Math.abs(yMin.value), Math.abs(yMax.value)))

// Calculate max bubble radius for padding
const maxBubbleRadius = computed(() => {
  if (sizeMax.value === sizeMin.value) return 24
  return 12 + ((sizeMax.value - sizeMin.value) / (sizeMax.value - sizeMin.value)) * 28
})

// Calculate padding in data units
const xRange = computed(() => (maxAbsX.value > 0 ? maxAbsX.value : 1))
const yRange = computed(() => (maxAbsY.value > 0 ? maxAbsY.value : 1))
const xPad = computed(
  () => (maxBubbleRadius.value / (width - margin.left - margin.right)) * xRange.value,
)
const yPad = computed(
  () => (maxBubbleRadius.value / (height - margin.top - margin.bottom)) * yRange.value,
)

// Symmetric domain for axes always centered
const xDomain = computed(() => {
  const max = xRange.value + xPad.value
  return [-max, max]
})
const yDomain = computed(() => {
  const max = yRange.value + yPad.value
  return [-max, max]
})

function xScale(x) {
  return (
    margin.left +
    ((x - xDomain.value[0]) / (xDomain.value[1] - xDomain.value[0])) *
      (width - margin.left - margin.right)
  )
}
function yScale(y) {
  return (
    height -
    margin.bottom -
    ((y - yDomain.value[0]) / (yDomain.value[1] - yDomain.value[0])) *
      (height - margin.top - margin.bottom)
  )
}

// Centered axes positions
const xAxisY = computed(() => yScale(0))
const yAxisX = computed(() => xScale(0))

// Generate ticks for symmetric domain
function getTicks(min, max, count) {
  if (!isFinite(min) || !isFinite(max)) return []
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 100) / 100)
}
const xTicks = computed(() => getTicks(xDomain.value[0], xDomain.value[1], 7))
const yTicks = computed(() => getTicks(yDomain.value[0], yDomain.value[1], 6))

const defaultColors = ['#4a90e2', '#e94e77', '#f9d423', '#6ac174', '#8c54ff', '#ff8c42', '#00b8a9']

// Extract axis labels from info object if present, fallback to props
const xAxisLabel = computed(() => {
  let d = props.data
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d)
    } catch {
      return props.xLabel
    }
  }
  if (d && typeof d === 'object' && !Array.isArray(d) && d.xLabel) {
    return d.xLabel
  }
  return props.xLabel
})
const yAxisLabel = computed(() => {
  let d = props.data
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d)
    } catch {
      return props.yLabel
    }
  }
  if (d && typeof d === 'object' && !Array.isArray(d) && d.yLabel) {
    return d.yLabel
  }
  return props.yLabel
})

function sizeScale(size) {
  // Map size to radius between 12 and 40
  if (sizeMax.value === sizeMin.value) return 24
  return 12 + ((size - sizeMin.value) / (sizeMax.value - sizeMin.value)) * 28
}
</script>

<style scoped>
.bubblechart-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bubblechart-svg {
  display: block;
  margin: 0 auto 16px auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.bubblechart-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
.bubblechart-axis-label {
  font-family: inherit;
  font-weight: 500;
  fill: #444;
}
</style>
