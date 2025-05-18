<template>
  <div class="swot-container">
    <div class="swot-grid">
      <div class="swot-cell swot-strengths">
        <div class="swot-title">Strengths</div>
        <ul v-if="strengths.length">
          <li v-for="(item, i) in strengths" :key="'s-' + i">{{ item.label || item }}</li>
        </ul>
        <div v-else class="swot-empty">No strengths listed.</div>
      </div>
      <div class="swot-cell swot-weaknesses">
        <div class="swot-title">Weaknesses</div>
        <ul v-if="weaknesses.length">
          <li v-for="(item, i) in weaknesses" :key="'w-' + i">{{ item.label || item }}</li>
        </ul>
        <div v-else class="swot-empty">No weaknesses listed.</div>
      </div>
      <div class="swot-cell swot-opportunities">
        <div class="swot-title">Opportunities</div>
        <ul v-if="opportunities.length">
          <li v-for="(item, i) in opportunities" :key="'o-' + i">{{ item.label || item }}</li>
        </ul>
        <div v-else class="swot-empty">No opportunities listed.</div>
      </div>
      <div class="swot-cell swot-threats">
        <div class="swot-title">Threats</div>
        <ul v-if="threats.length">
          <li v-for="(item, i) in threats" :key="'t-' + i">{{ item.label || item }}</li>
        </ul>
        <div v-else class="swot-empty">No threats listed.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: [String, Object], required: true },
})

const parsed = computed(() => {
  if (typeof props.data === 'string') {
    try {
      return JSON.parse(props.data)
    } catch {
      return {}
    }
  }
  return props.data || {}
})

const strengths = computed(() => parsed.value.strengths || [])
const weaknesses = computed(() => parsed.value.weaknesses || [])
const opportunities = computed(() => parsed.value.opportunities || [])
const threats = computed(() => parsed.value.threats || [])
</script>

<style scoped>
.swot-container {
  width: 100%;
  background: #f9f9f9;
  border-radius: 12px;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.swot-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/images/swot.png');
  background-size: cover;
  background-position: center;
  opacity: 0.18;
  z-index: 0;
  pointer-events: none;
}
.swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 18px;
  width: 100%;
  max-width: 700px;
  position: relative;
  z-index: 1;
}
.swot-cell {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 18px 16px 16px 16px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}
.swot-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 10px;
  letter-spacing: 1px;
}
.swot-strengths {
  border-top: 4px solid #6ac174;
}
.swot-weaknesses {
  border-top: 4px solid #e94e77;
}
.swot-opportunities {
  border-top: 4px solid #4a90e2;
}
.swot-threats {
  border-top: 4px solid #f9d423;
}
.swot-empty {
  color: #aaa;
  font-style: italic;
  margin-top: 8px;
}
ul {
  padding-left: 18px;
  margin: 0;
}
li {
  margin-bottom: 6px;
  font-size: 1rem;
  color: #333;
}
</style>
