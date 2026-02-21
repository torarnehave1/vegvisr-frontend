<template>
  <div class="gnew-agent-run-node">
    <!-- Header -->
    <div class="run-header">
      <div class="run-title-wrap">
        <h3 v-if="node.label" class="run-title">{{ node.label }}</h3>
        <div class="run-type-badge">Agent Run</div>
        <div class="run-status-badge" :class="runData.success ? 'status-success' : 'status-error'">
          {{ runData.success ? 'Completed' : 'Failed' }}
        </div>
      </div>
      <div class="run-controls">
        <div class="run-node-id" v-if="node.id">
          <code class="node-id-value">{{ node.id }}</code>
          <button @click="copyNodeId" class="btn-copy-id">{{ idCopied ? 'OK' : 'Copy' }}</button>
        </div>
        <template v-if="showControls">
          <button @click="exportRun" class="btn-control">Export</button>
          <button @click="deleteNode" class="btn-control btn-delete">Delete</button>
        </template>
      </div>
    </div>

    <!-- Run Summary -->
    <div class="run-summary">
      <div class="summary-stat">
        <span class="stat-number">{{ runData.turns || 0 }}</span>
        <span class="stat-label">Turns</span>
      </div>
      <div class="summary-stat">
        <span class="stat-number">{{ toolCallCount }}</span>
        <span class="stat-label">Tool Calls</span>
      </div>
      <div class="summary-stat">
        <span class="stat-number">{{ successCount }}</span>
        <span class="stat-label">Succeeded</span>
      </div>
      <div class="summary-stat">
        <span class="stat-number">{{ errorCount }}</span>
        <span class="stat-label">Errors</span>
      </div>
      <div v-if="duration" class="summary-stat">
        <span class="stat-number">{{ duration }}</span>
        <span class="stat-label">Duration</span>
      </div>
    </div>

    <!-- Execution Timeline -->
    <div class="execution-timeline">
      <div class="timeline-header" @click="showTimeline = !showTimeline" style="cursor: pointer">
        <span class="timeline-title">Execution Timeline</span>
        <span class="timeline-toggle">{{ showTimeline ? 'Hide' : 'Show' }}</span>
      </div>

      <div v-if="showTimeline" class="timeline-entries">
        <div
          v-for="(entry, index) in executionLog"
          :key="index"
          class="timeline-entry"
          :class="'entry-' + entry.type"
        >
          <div class="entry-connector">
            <div class="connector-dot" :class="'dot-' + entry.type"></div>
            <div v-if="index < executionLog.length - 1" class="connector-line"></div>
          </div>

          <div class="entry-content">
            <!-- Agent Thinking -->
            <div v-if="entry.type === 'agent_thinking'" class="entry-thinking">
              <span class="entry-turn">Turn {{ entry.turn }}</span>
              <span class="entry-label">Agent thinking...</span>
              <span class="entry-time">{{ formatTime(entry.timestamp) }}</span>
            </div>

            <!-- Tool Calls -->
            <div v-else-if="entry.type === 'tool_calls'" class="entry-tools">
              <span class="entry-turn">Turn {{ entry.turn }}</span>
              <div class="tool-calls-list">
                <div v-for="(tool, ti) in entry.tools || []" :key="ti" class="tool-call-item">
                  <span class="tool-call-name">{{ tool.name }}</span>
                  <code v-if="tool.input" class="tool-call-input" @click="toggleToolInput(index, ti)">
                    {{ expandedTools[`${index}-${ti}`] ? JSON.stringify(tool.input, null, 2) : truncateInput(tool.input) }}
                  </code>
                </div>
              </div>
            </div>

            <!-- Tool Result -->
            <div v-else-if="entry.type === 'tool_result'" class="entry-result">
              <div class="result-header">
                <span class="result-tool">{{ entry.tool }}</span>
                <span class="result-status" :class="entry.success ? 'result-ok' : 'result-err'">
                  {{ entry.success ? 'OK' : 'Error' }}
                </span>
              </div>
              <code v-if="entry.result" class="result-data" @click="toggleResult(index)">
                {{ expandedResults[index] ? JSON.stringify(entry.result, null, 2) : truncateResult(entry.result) }}
              </code>
            </div>

            <!-- Tool Error -->
            <div v-else-if="entry.type === 'tool_error'" class="entry-error">
              <span class="error-tool">{{ entry.tool }}</span>
              <span class="error-message">{{ entry.error }}</span>
            </div>

            <!-- Agent Complete -->
            <div v-else-if="entry.type === 'agent_complete'" class="entry-complete">
              <span class="entry-turn">Turn {{ entry.turn }}</span>
              <span class="complete-label">Agent finished</span>
              <div v-if="entry.response" class="complete-response">
                {{ entry.response.length > 300 ? entry.response.substring(0, 300) + '...' : entry.response }}
              </div>
            </div>

            <!-- Error -->
            <div v-else-if="entry.type === 'error'" class="entry-error">
              <span class="entry-turn">Turn {{ entry.turn }}</span>
              <span class="error-message">{{ entry.error }}</span>
            </div>

            <!-- Max Turns -->
            <div v-else-if="entry.type === 'max_turns_reached'" class="entry-max-turns">
              Max turns reached (20)
            </div>

            <!-- Other -->
            <div v-else class="entry-other">
              <span class="entry-type-label">{{ entry.type }}</span>
              <span v-if="entry.timestamp" class="entry-time">{{ formatTime(entry.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Response (final text output) -->
    <div v-if="finalResponse" class="final-response-section">
      <div class="response-header">
        <span class="response-label">Agent Response</span>
      </div>
      <div class="response-content">
        <pre>{{ finalResponse }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  isPreview: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
  graphData: { type: Object, default: () => ({ nodes: [], edges: [] }) },
  graphId: { type: String, default: '' }
})

const emit = defineEmits(['node-updated', 'node-deleted'])

// State
const idCopied = ref(false)
const showTimeline = ref(true)
const expandedTools = reactive({})
const expandedResults = reactive({})

// Parse run data from node.info
const runData = computed(() => {
  try {
    if (typeof props.node.info === 'string' && props.node.info.trim()) {
      return JSON.parse(props.node.info)
    }
    if (typeof props.node.info === 'object' && props.node.info) {
      return props.node.info
    }
  } catch { /* ignore */ }
  return { success: false, turns: 0, executionLog: [] }
})

const executionLog = computed(() => runData.value.executionLog || [])

const toolCallCount = computed(() => {
  return executionLog.value.filter(e => e.type === 'tool_calls').reduce((sum, e) => sum + (e.tools?.length || 0), 0)
})

const successCount = computed(() => {
  return executionLog.value.filter(e => e.type === 'tool_result' && e.success).length
})

const errorCount = computed(() => {
  return executionLog.value.filter(e => e.type === 'tool_error' || (e.type === 'tool_result' && !e.success) || e.type === 'error').length
})

const duration = computed(() => {
  const entries = executionLog.value.filter(e => e.timestamp)
  if (entries.length < 2) return null
  const start = new Date(entries[0].timestamp)
  const end = new Date(entries[entries.length - 1].timestamp)
  const ms = end - start
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
})

const finalResponse = computed(() => {
  const complete = executionLog.value.find(e => e.type === 'agent_complete')
  return complete?.response || null
})

// Helpers
function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function truncateInput(input) {
  const str = JSON.stringify(input)
  return str.length > 80 ? str.substring(0, 80) + '...' : str
}

function truncateResult(result) {
  const str = JSON.stringify(result)
  return str.length > 100 ? str.substring(0, 100) + '...' : str
}

function toggleToolInput(entryIndex, toolIndex) {
  const key = `${entryIndex}-${toolIndex}`
  expandedTools[key] = !expandedTools[key]
}

function toggleResult(index) {
  expandedResults[index] = !expandedResults[index]
}

function copyNodeId() {
  navigator.clipboard.writeText(props.node.id).then(() => {
    idCopied.value = true
    setTimeout(() => { idCopied.value = false }, 2000)
  })
}

function deleteNode() {
  if (!props.showControls) return
  if (confirm('Delete this agent run node?')) {
    emit('node-deleted', props.node.id)
  }
}

function exportRun() {
  const content = typeof props.node.info === 'string' ? props.node.info : JSON.stringify(runData.value, null, 2)
  const filename = (props.node.label || 'agent-run').replace(/\s+/g, '-') + '.json'
  const el = document.createElement('a')
  el.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(content))
  el.setAttribute('download', filename)
  el.style.display = 'none'
  document.body.appendChild(el)
  el.click()
  document.body.removeChild(el)
}
</script>

<style scoped>
.gnew-agent-run-node {
  margin-bottom: 20px;
}

/* Header */
.run-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 8px;
}

.run-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.run-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: #4ade80;
}

.run-type-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #4ade80;
  text-transform: uppercase;
}

.run-status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-success {
  background: rgba(74, 222, 128, 0.2);
  color: rgba(74, 222, 128, 0.9);
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.status-error {
  background: rgba(248, 113, 113, 0.2);
  color: rgba(248, 113, 113, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.run-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.run-node-id {
  display: flex;
  align-items: center;
  gap: 4px;
}

.node-id-value {
  font-size: 0.7rem;
  color: rgba(74, 222, 128, 0.7);
  background: rgba(34, 197, 94, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-copy-id {
  background: none;
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.7rem;
  cursor: pointer;
  color: rgba(74, 222, 128, 0.7);
}

.btn-control {
  background: rgba(55, 65, 81, 0.5);
  border: 1px solid rgba(107, 114, 128, 0.3);
  padding: 6px 12px;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s;
}

.btn-control:hover {
  background: rgba(55, 65, 81, 0.8);
}

.btn-control.btn-delete {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
  color: rgba(248, 113, 113, 0.9);
}

/* Summary */
.run-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 8px;
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4ade80;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  margin-top: 4px;
}

/* Timeline */
.execution-timeline {
  background: rgba(55, 65, 81, 0.2);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.05);
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
}

.timeline-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.timeline-toggle {
  font-size: 0.8rem;
  color: rgba(74, 222, 128, 0.7);
}

.timeline-entries {
  padding: 16px;
}

/* Timeline Entry */
.timeline-entry {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.entry-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
  flex-shrink: 0;
}

.connector-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-agent_thinking { background: rgba(96, 165, 250, 0.6); }
.dot-tool_calls { background: rgba(251, 191, 36, 0.6); }
.dot-tool_result { background: rgba(74, 222, 128, 0.6); }
.dot-tool_error { background: rgba(248, 113, 113, 0.6); }
.dot-agent_complete { background: rgba(74, 222, 128, 0.9); }
.dot-error { background: rgba(248, 113, 113, 0.9); }
.dot-max_turns_reached { background: rgba(251, 191, 36, 0.9); }

.connector-line {
  width: 2px;
  flex: 1;
  background: rgba(107, 114, 128, 0.3);
  min-height: 8px;
}

.entry-content {
  flex: 1;
  padding-bottom: 12px;
}

/* Entry types */
.entry-thinking {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry-turn {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.entry-label {
  font-size: 0.8rem;
  color: rgba(96, 165, 250, 0.7);
}

.entry-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
  margin-left: auto;
}

/* Tool calls */
.entry-tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-calls-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tool-call-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 6px;
}

.tool-call-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(251, 191, 36, 0.9);
  white-space: nowrap;
}

.tool-call-input {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  white-space: pre-wrap;
  word-break: break-all;
}

.tool-call-input:hover {
  color: rgba(255, 255, 255, 0.8);
}

/* Tool result */
.entry-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-tool {
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.result-status {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.result-ok {
  background: rgba(74, 222, 128, 0.2);
  color: rgba(74, 222, 128, 0.9);
}

.result-err {
  background: rgba(248, 113, 113, 0.2);
  color: rgba(248, 113, 113, 0.9);
}

.result-data {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.15);
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-data:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* Error entry */
.entry-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 6px;
}

.error-tool {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(248, 113, 113, 0.9);
}

.error-message {
  font-size: 0.8rem;
  color: rgba(248, 113, 113, 0.7);
}

/* Complete entry */
.entry-complete {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.complete-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(74, 222, 128, 0.9);
}

.complete-response {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  line-height: 1.5;
}

/* Max turns */
.entry-max-turns {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(251, 191, 36, 0.9);
  padding: 6px 10px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 6px;
}

/* Other */
.entry-other {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry-type-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

/* Final Response */
.final-response-section {
  background: rgba(55, 65, 81, 0.3);
  border: 1px solid rgba(107, 114, 128, 0.3);
  border-radius: 10px;
  overflow: hidden;
}

.response-header {
  padding: 10px 14px;
  background: rgba(74, 222, 128, 0.05);
  border-bottom: 1px solid rgba(107, 114, 128, 0.2);
}

.response-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.response-content {
  padding: 12px 14px;
  max-height: 300px;
  overflow: auto;
}

.response-content pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
