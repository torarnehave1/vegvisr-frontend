<template>
  <div class="gnew-component-node">
    <!-- Header: label + type badge + verify badge -->
    <div class="cn-header">
      <h3 class="cn-title">{{ node.label }}</h3>
      <span class="cn-badge" :class="`cn-badge--${typeKey}`">{{ typeLabel }}</span>
      <span class="cn-verify" :class="`cn-verify--${verifyClass}`" :title="verify && verify.method ? verify.method : ''">
        {{ verifyLabel }}
      </span>
    </div>

    <p v-if="description" class="cn-desc">{{ description }}</p>

    <!-- Verification -->
    <div v-if="verify" class="cn-section">
      <div class="cn-section-title">Verification</div>
      <div class="cn-kv"><span>verdict</span><b>{{ verify.verdict || 'UNVERIFIED' }}</b></div>
      <div v-if="verify.verifiedDate" class="cn-kv"><span>date</span><b>{{ verify.verifiedDate }}</b></div>
      <div v-if="verify.method" class="cn-kv cn-kv--wrap"><span>method</span><b>{{ verify.method }}</b></div>
    </div>

    <!-- Slots (layouts) -->
    <div v-if="slotList.length" class="cn-section">
      <div class="cn-section-title">Slots</div>
      <div class="cn-chips"><span v-for="s in slotList" :key="s" class="cn-chip">{{ s }}</span></div>
    </div>

    <!-- Props (components) -->
    <div v-if="hasProps" class="cn-section">
      <div class="cn-section-title">Props</div>
      <pre class="cn-json">{{ propsJson }}</pre>
    </div>
    <div v-else-if="typeKey === 'component'" class="cn-section cn-muted">
      No props defined — self-contained, inserted intact.
    </div>

    <!-- Full schema (collapsed) -->
    <details class="cn-details">
      <summary>Schema (JSON)</summary>
      <pre class="cn-json">{{ schemaJson }}</pre>
    </details>

    <!-- Implementation (collapsed) -->
    <details class="cn-details">
      <summary>Implementation — {{ implChars.toLocaleString() }} chars</summary>
      <div v-if="impl" class="cn-impl-actions">
        <button class="cn-btn" @click="copyImpl">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
      </div>
      <pre v-if="impl" class="cn-code">{{ impl }}</pre>
      <div v-else class="cn-muted">No impl stored.</div>
    </details>

    <!-- Reuse hint -->
    <div class="cn-reuse">
      <span>Reuse:</span>
      <code v-if="typeKey === 'layout'">apply_layout('{{ node.label }}')</code>
      <code v-else>fill_slot_with_component(slot, '{{ node.label }}')</code>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

// A registry node of type `component` or `layout` carries its real definition in
// node.metadata (schema / impl / verify) — which GNewDefaultNode ignores, showing only
// label + info text. This renderer surfaces that definition so the schema/impl/verify are
// actually viewable.
const props = defineProps({
  node: { type: Object, required: true },
  graphData: { type: Object, default: () => ({}) },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: false },
  graphId: { type: String, default: '' },
})

const meta = computed(() => props.node.metadata || {})
const schema = computed(() => meta.value.schema || {})
const verify = computed(() => meta.value.verify || null)
const impl = computed(() => meta.value.impl || '')

const typeKey = computed(() => props.node.type || 'component')
const typeLabel = computed(() => (props.node.type || 'component').toUpperCase())
const description = computed(() => schema.value.description || props.node.info || '')

const slotList = computed(() => (Array.isArray(schema.value.slots) ? schema.value.slots : []))
const propsObj = computed(() => schema.value.props || {})
const hasProps = computed(() => propsObj.value && Object.keys(propsObj.value).length > 0)
const propsJson = computed(() => JSON.stringify(propsObj.value, null, 2))
const schemaJson = computed(() => JSON.stringify(schema.value, null, 2))
const implChars = computed(() => impl.value.length)

const verifyLabel = computed(() => verify.value?.verdict || 'UNVERIFIED')
const verifyClass = computed(() =>
  (verify.value?.verdict || 'unverified').toLowerCase().startsWith('pass') ? 'pass' : 'unverified',
)

const copied = ref(false)
function copyImpl() {
  try {
    navigator.clipboard.writeText(impl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (e) {
    /* clipboard unavailable */
  }
}
</script>

<style scoped>
.gnew-component-node {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 18px;
  background: #fff;
  font-family: system-ui, -apple-system, sans-serif;
}
.cn-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cn-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #111827;
}
.cn-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  background: #3b82f6;
}
.cn-badge--layout {
  background: #8b5cf6;
}
.cn-verify {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.cn-verify--pass {
  background: #dcfce7;
  color: #166534;
}
.cn-verify--unverified {
  background: #f3f4f6;
  color: #6b7280;
}
.cn-desc {
  margin: 10px 0 6px;
  color: #374151;
  font-size: 0.92rem;
}
.cn-section {
  margin-top: 12px;
}
.cn-section-title {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
  font-weight: 700;
  margin-bottom: 4px;
}
.cn-kv {
  display: flex;
  gap: 8px;
  font-size: 0.85rem;
  padding: 1px 0;
}
.cn-kv > span {
  color: #6b7280;
  min-width: 60px;
}
.cn-kv > b {
  color: #111827;
  font-weight: 600;
}
.cn-kv--wrap > b {
  font-weight: 400;
  color: #374151;
}
.cn-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cn-chip {
  background: #eef2ff;
  color: #4338ca;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.8rem;
  font-weight: 600;
}
.cn-muted {
  color: #9ca3af;
  font-size: 0.85rem;
  font-style: italic;
}
.cn-details {
  margin-top: 12px;
  border-top: 1px solid #f3f4f6;
  padding-top: 8px;
}
.cn-details > summary {
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2563eb;
  user-select: none;
}
.cn-json,
.cn-code {
  margin: 8px 0 0;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 340px;
  overflow-y: auto;
  white-space: pre;
}
.cn-json {
  max-height: 220px;
}
.cn-impl-actions {
  margin-top: 8px;
}
.cn-btn {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  cursor: pointer;
  color: #374151;
}
.cn-btn:hover {
  background: #f3f4f6;
}
.cn-reuse {
  margin-top: 14px;
  font-size: 0.82rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cn-reuse > code {
  background: #f3f4f6;
  color: #b91c1c;
  padding: 2px 8px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}
</style>
