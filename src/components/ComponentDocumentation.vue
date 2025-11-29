<template>
  <div class="component-documentation">
    <!-- Header -->
    <div class="doc-header">
      <div class="doc-title">
        <h2>{{ documentation.component.name }}</h2>
        <span class="doc-version">v{{ documentation.component.version }}</span>
      </div>
      <div class="doc-actions">
        <button @click="$emit('refresh')" class="btn-refresh" title="Refresh documentation">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Description -->
    <div class="doc-section">
      <h3>📖 Description</h3>
      <p class="doc-description">{{ documentation.component.description }}</p>
      <div class="doc-meta">
        <span class="meta-item">🏷️ Category: {{ documentation.component.category }}</span>
        <span class="meta-item">🤖 AI Generated: {{ formatDate(documentation.lastAIGeneration) }}</span>
      </div>
    </div>

    <!-- Usage Examples -->
    <div class="doc-section">
      <h3>💡 Usage Examples</h3>
      <div class="usage-examples">
        <div class="usage-example">
          <h4>Basic HTML</h4>
          <pre class="code-block"><code>{{ documentation.usage.basic }}</code></pre>
          <button @click="copyToClipboard(documentation.usage.basic)" class="btn-copy">📋 Copy</button>
        </div>
        <div class="usage-example">
          <h4>JavaScript Integration</h4>
          <pre class="code-block"><code>{{ documentation.usage.javascript }}</code></pre>
          <button @click="copyToClipboard(documentation.usage.javascript)" class="btn-copy">📋 Copy</button>
        </div>
      </div>
    </div>

    <!-- Attributes -->
    <div class="doc-section" v-if="Object.keys(documentation.attributes).length > 0">
      <h3>⚙️ Attributes</h3>
      <div class="attributes-grid">
        <div
          v-for="(attr, name) in documentation.attributes"
          :key="name"
          class="attribute-card">
          <div class="attribute-header">
            <code class="attribute-name">{{ name }}</code>
            <span class="attribute-type">{{ attr.type }}</span>
          </div>
          <p class="attribute-description">{{ attr.description }}</p>
          <div class="attribute-meta">
            <span v-if="attr.required" class="meta-required">Required</span>
            <span v-if="attr.default !== undefined" class="meta-default">
              Default: <code>{{ attr.default }}</code>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Events -->
    <div class="doc-section" v-if="Object.keys(documentation.events).length > 0">
      <h3>📡 Events</h3>
      <div class="events-list">
        <div
          v-for="(event, name) in documentation.events"
          :key="name"
          class="event-item">
          <div class="event-header">
            <code class="event-name">{{ name }}</code>
          </div>
          <p class="event-description">{{ event.description }}</p>
          <div v-if="event.detail" class="event-detail">
            <strong>Detail:</strong>
            <pre class="detail-code">{{ JSON.stringify(event.detail, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Methods -->
    <div class="doc-section" v-if="Object.keys(documentation.methods).length > 0">
      <h3>🔧 Methods</h3>
      <div class="methods-list">
        <div
          v-for="(method, name) in documentation.methods"
          :key="name"
          class="method-item">
          <div class="method-header">
            <code class="method-name">{{ method.signature }}</code>
          </div>
          <p class="method-description">{{ method.description }}</p>
          <div v-if="method.parameters && Object.keys(method.parameters).length > 0" class="method-params">
            <strong>Parameters:</strong>
            <ul>
              <li v-for="(desc, param) in method.parameters" :key="param">
                <code>{{ param }}</code>: {{ desc }}
              </li>
            </ul>
          </div>
          <div v-if="method.returns" class="method-returns">
            <strong>Returns:</strong> {{ method.returns }}
          </div>
        </div>
      </div>
    </div>

    <!-- Dependencies -->
    <div class="doc-section" v-if="documentation.dependencies && documentation.dependencies.length > 0">
      <h3>📦 Dependencies</h3>
      <div class="dependencies-list">
        <div
          v-for="dep in documentation.dependencies"
          :key="dep"
          class="dependency-item">
          <code>{{ dep }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineEmits } from 'vue'

// Props
defineProps({
  component: {
    type: Object,
    required: true
  },
  documentation: {
    type: Object,
    required: true
  }
})

// Emits
defineEmits(['refresh'])

// Methods
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString()
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    // Could add a toast notification here
    console.log('Copied to clipboard:', text)
  } catch (error) {
    console.error('Failed to copy:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}
</script>

<style scoped>
.component-documentation {
  max-width: 100%;
}

/* Header */
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.doc-title h2 {
  margin: 0 0 8px 0;
  color: #1e293b;
  font-size: 2rem;
}

.doc-version {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.doc-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-refresh:hover {
  background: #e2e8f0;
  color: #334155;
}

/* Sections */
.doc-section {
  margin-bottom: 40px;
}

.doc-section h3 {
  color: #1e293b;
  font-size: 1.5rem;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.doc-description {
  color: #475569;
  line-height: 1.6;
  font-size: 1.1rem;
  margin-bottom: 15px;
}

.doc-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.meta-item {
  color: #64748b;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Usage Examples */
.usage-examples {
  display: grid;
  gap: 20px;
}

.usage-example {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.usage-example h4 {
  margin: 0 0 15px 0;
  color: #334155;
  font-size: 1.1rem;
}

.code-block {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 10px;
}

.btn-copy {
  background: #667eea;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-copy:hover {
  background: #5a67d8;
}

/* Attributes */
.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.attribute-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.attribute-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.attribute-name {
  background: #1e293b;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
}

.attribute-type {
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.attribute-description {
  color: #475569;
  margin: 8px 0;
  line-height: 1.5;
}

.attribute-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-required {
  background: #dc2626;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.meta-default {
  color: #64748b;
  font-size: 0.875rem;
}

.meta-default code {
  background: #f1f5f9;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.8rem;
}

/* Events */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.event-header {
  margin-bottom: 8px;
}

.event-name {
  background: #10b981;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
}

.event-description {
  color: #475569;
  margin: 8px 0;
  line-height: 1.5;
}

.event-detail {
  margin-top: 12px;
}

.detail-code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  margin-top: 8px;
}

/* Methods */
.methods-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.method-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.method-header {
  margin-bottom: 8px;
}

.method-name {
  background: #7c3aed;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

.method-description {
  color: #475569;
  margin: 8px 0;
  line-height: 1.5;
}

.method-params {
  margin-top: 12px;
}

.method-params ul {
  margin: 8px 0;
  padding-left: 20px;
}

.method-params li {
  color: #475569;
  margin-bottom: 4px;
  line-height: 1.4;
}

.method-params code {
  background: #f1f5f9;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.8rem;
}

.method-returns {
  margin-top: 8px;
  color: #64748b;
  font-size: 0.875rem;
}

/* Dependencies */
.dependencies-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dependency-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

.dependency-item code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.875rem;
  word-break: break-all;
}

/* Responsive */
@media (max-width: 768px) {
  .doc-header {
    flex-direction: column;
    gap: 15px;
  }

  .attributes-grid {
    grid-template-columns: 1fr;
  }

  .usage-examples {
    grid-template-columns: 1fr;
  }

  .doc-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>