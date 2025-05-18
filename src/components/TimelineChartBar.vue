<template>
  <div class="timelinechartbar-container" v-if="bars.length">
    <div class="timelinechartbar-grid" :style="gridStyle">
      <div v-for="(bar, i) in bars" :key="i" class="timelinechartbar-bar" :style="barStyle(bar)">
        <span class="timelinechartbar-label">{{ bar.label }}</span>
      </div>
    </div>
    <div class="timelinechartbar-axis">
      <span v-for="year in axisYears" :key="year" class="timelinechartbar-tick">
        {{ year }}
      </span>
    </div>
  </div>
  <div v-else class="timelinechartbar-empty">No timeline data.</div>
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
  position: 'relative',
  height: `${bars.value.length * 40}px`,
  width: '100%',
  background: '#f9f9f9',
  borderRadius: '8px',
  marginBottom: '8px',
}))

const barStyle = (bar) => {
  const left = ((bar.start - minYear.value) / totalYears.value) * 100
  const width = ((bar.end - bar.start + 1) / totalYears.value) * 100
  return {
    position: 'absolute',
    top: `${bars.value.indexOf(bar) * 40 + 8}px`,
    left: `${left}%`,
    width: `${width}%`,
    height: '24px',
    background: bar.color || '#888',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '12px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  }
}
</script>

<style scoped>
.timelinechartbar-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
}
.timelinechartbar-grid {
  position: relative;
  min-height: 60px;
  margin-bottom: 16px;
}
.timelinechartbar-bar {
  position: absolute;
  height: 24px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.timelinechartbar-label {
  z-index: 2;
  position: relative;
  padding-left: 4px;
}
.timelinechartbar-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
  color: #333;
  margin-top: 8px;
}
.timelinechartbar-tick {
  min-width: 40px;
  text-align: center;
}
.timelinechartbar-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
</style>
