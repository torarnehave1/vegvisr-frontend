<template>
  <div class="timeline-container" v-if="bars.length">
    <div class="timeline-grid" :style="gridStyle">
      <div
        v-for="(bar, index) in bars"
        :key="bar.id || index"
        class="timeline-bar"
        :style="barStyle(bar)"
      >
        <span class="timeline-label">{{ bar.label }}</span>
      </div>
      <div class="timeline-axis">
        <span v-for="year in axisYears" :key="year" class="timeline-tick">
          {{ year }}
        </span>
      </div>
    </div>
  </div>
  <div v-else class="timeline-empty">No timeline data.</div>
  <div v-if="bars.length" class="timeline-era-label">
    <small
      >Negative years are <b>BCE</b> (Before Common Era), positive years are <b>CE</b> (Common
      Era)</small
    >
  </div>
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

const minYear = computed(() => Math.min(...bars.value.map((b) => b.start)))
const maxYear = computed(() => Math.max(...bars.value.map((b) => b.end)))
const totalYears = computed(() => maxYear.value - minYear.value + 1)

const axisYears = computed(() => {
  const step = Math.ceil(totalYears.value / 10)
  return Array.from({ length: 11 }, (_, i) => minYear.value + i * step)
})

const gridStyle = computed(() => ({
  display: 'grid',
  gridTemplateRows: `repeat(${bars.value.length}, 40px) 30px`,
  gridTemplateColumns: `repeat(${totalYears.value}, 1fr)`,
}))

const barStyle = (bar) => {
  const start = bar.start - minYear.value
  const span = bar.end - bar.start + 1
  return {
    gridRow: `${bars.value.indexOf(bar) + 1}`,
    gridColumn: `${start + 1} / span ${span}`,
    background: bar.color || '#888',
    borderRadius: '8px',
    margin: '2px 0',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '8px',
    color: '#fff',
    fontWeight: 'bold',
  }
}
</script>

<style scoped>
.timeline-container {
  width: 100%;
  overflow-x: auto;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
}
.timeline-grid {
  position: relative;
}
.timeline-bar {
  height: 36px;
  font-size: 1rem;
}
.timeline-label {
  z-index: 2;
  position: relative;
}
.timeline-axis {
  grid-row: -1;
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #333;
  margin-top: 8px;
}
.timeline-tick {
  min-width: 40px;
  text-align: center;
}
.timeline-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
.timeline-era-label {
  text-align: center;
  color: #888;
  margin-top: 8px;
  font-size: 0.95em;
}
</style>
