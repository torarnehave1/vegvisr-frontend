<template>
  <div class="barchart-container" v-if="bars.length">
    <div class="barchart-bar" v-for="(bar, i) in bars" :key="bar.id || i">
      <span class="barchart-label">{{ bar.label }}</span>
      <div class="barchart-bar-inner" :style="barStyle(bar)">
        <span class="barchart-value">{{ bar.value }}</span>
      </div>
    </div>
  </div>
  <div v-else class="barchart-empty">No chart data.</div>
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

const maxValue = computed(() => Math.max(...bars.value.map((b) => b.value)))

const barStyle = (bar) => ({
  width: maxValue.value ? `${(bar.value / maxValue.value) * 100}%` : '0%',
  background: bar.color || '#4a90e2',
})
</script>

<style scoped>
.barchart-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
}
.barchart-bar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.barchart-label {
  min-width: 100px;
  font-weight: bold;
  color: #333;
  margin-right: 12px;
}
.barchart-bar-inner {
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  color: #fff;
  font-weight: bold;
  font-size: 1rem;
  transition: width 0.4s;
  background: #4a90e2;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.barchart-value {
  margin-left: 8px;
}
.barchart-empty {
  color: #888;
  font-style: italic;
  padding: 16px;
}
</style>
