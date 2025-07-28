<template>
  <div class="gnew-email-template-node" :class="[nodeTypeClass, { 'node-preview': isPreview }]">
    <!-- Node Header with Controls -->
    <div v-if="showControls && !isPreview" class="node-header">
      <div class="node-title">
        <span class="node-icon">📧</span>
        <span class="node-label">{{ nodeData.templateName || 'Email Template' }}</span>
      </div>
      <div class="node-controls">
        <button 
          @click="toggleAIGenerator" 
          class="btn btn-sm btn-outline-info" 
          :class="{ active: showAIGenerator }"
          title="AI Template Generator"
        >
          🤖 AI
        </button>
        <button @click="toggleExpanded" class="btn btn-sm btn-outline-primary" :title="isExpanded ? 'Collapse' : 'Expand'">
          {{ isExpanded ? '🔽' : '▶️' }}
        </button>
        <button @click="editNode" class="btn btn-sm btn-outline-secondary" title="Edit Node">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Delete Node">
          🗑️
        </button>
      </div>
    </div>

    <!-- Email Template Builder (Expanded View) -->
    <div v-if="isExpanded || isPreview" class="email-template-content">
      
      <!-- AI Generator Panel -->
      <div v-if="showAIGenerator" class="ai-generator-section">
        <h5 class="ai-title">🤖 AI Email Template Generator</h5>
        
        <div class="ai-prompt-section">
          <label class="config-label">Describe your email template:</label>
          <textarea 
            v-model="aiPrompt" 
            class="form-control ai-prompt-textarea"
            rows="3"
            placeholder="e.g., Create a professional project update email template for weekly team updates with progress, goals, and blockers sections"
          ></textarea>
        </div>

        <div class="ai-options-section">
          <div class="ai-option-row">
            <label class="config-label">Email Type:</label>
            <select v-model="aiEmailType" class="form-control form-control-sm">
              <option value="">Select type...</option>
              <option value="invitation">Invitation</option>
              <option value="notification">Notification</option>
              <option value="welcome">Welcome</option>
              <option value="update">Project Update</option>
              <option value="reminder">Reminder</option>
              <option value="announcement">Announcement</option>
              <option value="follow-up">Follow-up</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div class="ai-option-row">
            <label class="config-label">Tone:</label>
            <select v-model="aiTone" class="form-control form-control-sm">
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div class="ai-option-row">
            <label class="config-label">Include Variables:</label>
            <input 
              v-model="aiVariables" 
              class="form-control form-control-sm"
              placeholder="e.g., recipientName, projectName, deadline"
            />
          </div>
        </div>

        <div class="ai-actions">
          <button 
            @click="generateEmailTemplate" 
            :disabled="isGenerating || !aiPrompt.trim()"
            class="btn btn-primary"
          >
            <span v-if="isGenerating">⏳ Generating...</span>
            <span v-else>✨ Generate Template</span>
          </button>
          
          <button @click="clearAIForm" class="btn btn-outline-secondary">
            🗑️ Clear
          </button>
        </div>

        <div v-if="aiStatusMessage" class="ai-status-message" :class="`status-${aiStatusType}`">
          {{ aiStatusMessage }}
        </div>
      </div>
      
      <!-- Template Configuration -->
      <div class="template-config-section">
        <div class="config-row">
          <label class="config-label">Template Name:</label>
          <input 
            v-model="nodeData.templateName" 
            @input="updateNode"
            class="form-control form-control-sm"
            placeholder="e.g., Chat Invitation Template"
          />
        </div>
        
        <div class="config-row">
          <label class="config-label">Subject Line:</label>
          <input 
            v-model="nodeData.subject" 
            @input="updateNode"
            class="form-control form-control-sm"
            placeholder="e.g., You're invited to join {roomName}"
          />
        </div>
        
        <div class="config-row">
          <label class="config-label">Recipients:</label>
          <input 
            v-model="nodeData.recipients" 
            @input="updateNode"
            class="form-control form-control-sm"
            placeholder="e.g., {inviteeEmail} or specific@email.com"
          />
        </div>
      </div>

      <!-- Email Body Editor -->
      <div class="email-body-section">
        <label class="config-label">Email Body:</label>
        <textarea 
          v-model="nodeData.body" 
          @input="updateNode"
          class="form-control email-body-textarea"
          rows="8"
          placeholder="Write your email template here. Use {variableName} for dynamic content."
        ></textarea>
      </div>

      <!-- Variables Manager -->
      <div class="variables-section">
        <div class="variables-header">
          <label class="config-label">Template Variables:</label>
          <button @click="addVariable" class="btn btn-sm btn-success">+ Add Variable</button>
        </div>
        
        <div class="variables-list">
          <div 
            v-for="(variable, index) in variablesList" 
            :key="index"
            class="variable-item"
          >
            <input 
              v-model="variable.key" 
              @input="updateVariables"
              placeholder="variableName"
              class="form-control form-control-sm variable-key"
            />
            <span class="variable-separator">=</span>
            <input 
              v-model="variable.value" 
              @input="updateVariables"
              placeholder="Default value"
              class="form-control form-control-sm variable-value"
            />
            <button @click="removeVariable(index)" class="btn btn-sm btn-outline-danger">×</button>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <div class="preview-section">
        <h5 class="preview-title">📧 Email Preview</h5>
        <div class="email-preview">
          <div class="preview-header">
            <div class="preview-field">
              <strong>To:</strong> {{ renderedRecipients }}
            </div>
            <div class="preview-field">
              <strong>Subject:</strong> {{ renderedSubject }}
            </div>
          </div>
          <div class="preview-body" v-html="renderedBody"></div>
        </div>
      </div>

      <!-- Actions -->
      <div class="email-actions">
        <button 
          @click="sendTestEmail" 
          :disabled="isSending || !isValidTemplate"
          class="btn btn-primary"
        >
          <span v-if="isSending">⏳ Sending...</span>
          <span v-else>📤 Send Test Email</span>
        </button>
        
        <button 
          @click="saveAsTemplate" 
          :disabled="!isValidTemplate"
          class="btn btn-success"
        >
          💾 Save as Template
        </button>
        
        <button 
          @click="copyToClipboard" 
          class="btn btn-outline-secondary"
        >
          📋 Copy Template JSON
        </button>
      </div>

      <!-- Status Messages -->
      <div v-if="statusMessage" class="status-message" :class="`status-${statusType}`">
        {{ statusMessage }}
      </div>
    </div>

    <!-- Collapsed View -->
    <div v-else class="email-template-summary">
      <div class="summary-content">
        <div class="summary-title">{{ nodeData.templateName || 'Email Template' }}</div>
        <div class="summary-details">
          <span class="summary-item">📧 {{ nodeData.subject || 'No subject' }}</span>
          <span class="summary-item">👥 {{ Object.keys(nodeData.variables || {}).length }} variables</span>
        </div>
      </div>
    </div>

    <!-- Node Type Badge -->
    <div v-if="showControls" class="node-type-badge">
      Email Template
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

// Props
const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  showControls: {
    type: Boolean,
    default: true
  },
  isPreview: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// Reactive state
const isExpanded = ref(true)
const isSending = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

// AI Generator state
const showAIGenerator = ref(false)
const isGenerating = ref(false)
const aiPrompt = ref('')
const aiEmailType = ref('')
const aiTone = ref('professional')
const aiVariables = ref('')
const aiStatusMessage = ref('')
const aiStatusType = ref('info')

// Parse node data
const nodeData = ref({
  templateName: '',
  subject: '',
  body: '',
  recipients: '',
  variables: {},
  ...parseNodeInfo(props.node.info)
})

// Variables as list for easier editing
const variablesList = ref([])

// Computed properties
const nodeTypeClass = computed(() => `gnew-node-${props.node.type}`)

const isValidTemplate = computed(() => {
  return nodeData.value.templateName && 
         nodeData.value.subject && 
         nodeData.value.body &&
         nodeData.value.recipients
})

const renderedSubject = computed(() => {
  return renderTemplate(nodeData.value.subject, nodeData.value.variables)
})

const renderedBody = computed(() => {
  const rendered = renderTemplate(nodeData.value.body, nodeData.value.variables)
  // Convert line breaks to HTML
  return rendered.replace(/\n/g, '<br>')
})

const renderedRecipients = computed(() => {
  return renderTemplate(nodeData.value.recipients, nodeData.value.variables)
})

// Methods
function parseNodeInfo(info) {
  try {
    if (typeof info === 'string') {
      return JSON.parse(info)
    }
    return info || {}
  } catch (error) {
    console.error('Error parsing node info:', error)
    return {}
  }
}

function renderTemplate(template, variables) {
  if (!template) return ''
  
  let rendered = template
  for (const [key, value] of Object.entries(variables || {})) {
    const placeholder = `{${key}}`
    rendered = rendered.replace(new RegExp(placeholder, 'g'), value || `{${key}}`)
  }
  return rendered
}

function updateNode() {
  const updatedNode = {
    ...props.node,
    info: JSON.stringify(nodeData.value),
    label: nodeData.value.templateName || 'Email Template'
  }
  emit('node-updated', updatedNode)
}

function updateVariables() {
  // Convert variables list back to object
  const variablesObj = {}
  variablesList.value.forEach(variable => {
    if (variable.key) {
      variablesObj[variable.key] = variable.value || ''
    }
  })
  nodeData.value.variables = variablesObj
  updateNode()
}

function addVariable() {
  variablesList.value.push({ key: '', value: '' })
}

function removeVariable(index) {
  variablesList.value.splice(index, 1)
  updateVariables()
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function editNode() {
  emit('node-updated', { ...props.node, action: 'edit' })
}

function deleteNode() {
  if (confirm('Are you sure you want to delete this email template?')) {
    emit('node-deleted', props.node.id)
  }
}

async function sendTestEmail() {
  if (!isValidTemplate.value) {
    showStatus('Please fill in all required fields', 'error')
    return
  }

  isSending.value = true
  
  try {
    // Use the enhanced slowyou.io endpoint
    const response = await fetch('https://slowyou.io/api/send-vegvisr-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: renderedRecipients.value,
        subject: renderedSubject.value,
        template: renderedBody.value,
        callbackUrl: window.location.origin
      })
    })

    if (response.ok) {
      showStatus('Test email sent successfully!', 'success')
    } else {
      const errorData = await response.text()
      showStatus(`Failed to send test email: ${errorData}`, 'error')
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    showStatus('Error sending test email: ' + error.message, 'error')
  } finally {
    isSending.value = false
  }
}

async function saveAsTemplate() {
  if (!isValidTemplate.value) {
    showStatus('Please fill in all required fields', 'error')
    return
  }

  try {
    const templateData = {
      name: nodeData.value.templateName,
      nodes: [
        {
          id: `email-template-${Date.now()}`,
          type: 'email-template',
          label: nodeData.value.templateName,
          color: '#4CAF50',
          info: JSON.stringify(nodeData.value),
          bibl: [],
          imageWidth: '100%',
          imageHeight: '100%',
          visible: true,
          path: null
        }
      ],
      edges: []
    }

    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    })

    if (response.ok) {
      showStatus('Template saved successfully!', 'success')
    } else {
      const errorData = await response.text()
      showStatus(`Failed to save template: ${errorData}`, 'error')
    }
  } catch (error) {
    console.error('Error saving template:', error)
    showStatus('Error saving template: ' + error.message, 'error')
  }
}

function copyToClipboard() {
  const templateJSON = JSON.stringify({
    templateName: nodeData.value.templateName,
    subject: nodeData.value.subject,
    body: nodeData.value.body,
    recipients: nodeData.value.recipients,
    variables: nodeData.value.variables
  }, null, 2)

  navigator.clipboard.writeText(templateJSON).then(() => {
    showStatus('Template JSON copied to clipboard!', 'success')
  }).catch(error => {
    console.error('Error copying to clipboard:', error)
    showStatus('Failed to copy to clipboard', 'error')
  })
}

function showStatus(message, type = 'info') {
  statusMessage.value = message
  statusType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 5000)
}

// AI Generator Functions
function toggleAIGenerator() {
  showAIGenerator.value = !showAIGenerator.value
  if (!showAIGenerator.value) {
    clearAIForm()
  }
}

function clearAIForm() {
  aiPrompt.value = ''
  aiEmailType.value = ''
  aiTone.value = 'professional'
  aiVariables.value = ''
  aiStatusMessage.value = ''
}

function showAIStatus(message, type = 'info') {
  aiStatusMessage.value = message
  aiStatusType.value = type
  setTimeout(() => {
    aiStatusMessage.value = ''
  }, 5000)
}

async function generateEmailTemplate() {
  if (!aiPrompt.value.trim()) {
    showAIStatus('Please describe your email template', 'error')
    return
  }

  isGenerating.value = true
  showAIStatus('Generating email template with AI...', 'info')

  try {
    // Construct the AI prompt
    const fullPrompt = `Create an email template with the following requirements:
    
Description: ${aiPrompt.value}
Email Type: ${aiEmailType.value || 'General'}
Tone: ${aiTone.value}
${aiVariables.value ? `Include these variables: ${aiVariables.value}` : ''}

Please generate a JSON response with this exact structure:
{
  "templateName": "Descriptive name for the template",
  "subject": "Email subject line with {variableName} placeholders",
  "body": "Email body content with {variableName} placeholders",
  "recipients": "{recipientEmail}",
  "variables": {
    "variableName1": "Default value 1",
    "variableName2": "Default value 2"
  }
}

Make the email professional, well-structured, and include appropriate variable placeholders. Use curly braces for variables like {variableName}.`

    // Call the AI API (using your existing OpenAI integration)
    const response = await fetch('https://api.vegvisr.org/generateEmailTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        emailType: aiEmailType.value,
        tone: aiTone.value
      })
    })

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`)
    }

    const aiResult = await response.json()
    
    // Parse the AI response
    let generatedTemplate
    try {
      generatedTemplate = typeof aiResult.template === 'string' 
        ? JSON.parse(aiResult.template) 
        : aiResult.template
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      throw new Error('Invalid AI response format')
    }

    // Apply the generated template to the current node
    if (generatedTemplate) {
      nodeData.value = {
        ...nodeData.value,
        ...generatedTemplate
      }

      // Update variables list
      if (generatedTemplate.variables) {
        variablesList.value = Object.entries(generatedTemplate.variables).map(([key, value]) => ({
          key,
          value
        }))
      }

      updateNode()
      showAIStatus('Email template generated successfully!', 'success')
    }

  } catch (error) {
    console.error('Error generating email template:', error)
    showAIStatus(`Failed to generate template: ${error.message}`, 'error')
  } finally {
    isGenerating.value = false
  }
}

// Initialize variables list from node data
function initializeVariablesList() {
  variablesList.value = Object.entries(nodeData.value.variables || {}).map(([key, value]) => ({
    key,
    value
  }))
}

// Lifecycle
onMounted(() => {
  initializeVariablesList()
})

// Watch for changes in node prop
watch(() => props.node.info, (newInfo) => {
  nodeData.value = {
    templateName: '',
    subject: '',
    body: '',
    recipients: '',
    variables: {},
    ...parseNodeInfo(newInfo)
  }
  initializeVariablesList()
}, { immediate: true })
</script>

<style scoped>
.gnew-email-template-node {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #4CAF50;
  border-radius: 12px;
  padding: 16px;
  margin: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  max-width: 800px;
}

.gnew-email-template-node:hover {
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.node-preview {
  border: 1px solid #ddd;
  box-shadow: none;
}

/* Node Header */
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #dee2e6;
}

.node-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-icon {
  font-size: 1.2rem;
}

.node-label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}

.node-controls {
  display: flex;
  gap: 4px;
}

/* Configuration Section */
.template-config-section {
  margin-bottom: 20px;
}

.config-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.config-label {
  min-width: 120px;
  font-weight: 600;
  color: #495057;
  margin: 0;
}

.form-control {
  flex: 1;
}

/* Email Body Section */
.email-body-section {
  margin-bottom: 20px;
}

.email-body-textarea {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  resize: vertical;
  min-height: 120px;
}

/* Variables Section */
.variables-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.variables-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.variables-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.variable-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.variable-key {
  flex: 1;
}

.variable-separator {
  font-weight: bold;
  color: #6c757d;
}

.variable-value {
  flex: 2;
}

/* Preview Section */
.preview-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.preview-title {
  margin-bottom: 12px;
  color: #495057;
  font-size: 1rem;
}

.email-preview {
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.preview-header {
  background: #f8f9fa;
  padding: 12px;
  border-bottom: 1px solid #ddd;
}

.preview-field {
  margin-bottom: 4px;
  font-size: 0.9rem;
}

.preview-body {
  padding: 16px;
  background: white;
  font-family: Arial, sans-serif;
  line-height: 1.6;
  color: #333;
}

/* Actions */
.email-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.btn {
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Status Messages */
.status-message {
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-weight: 500;
}

.status-success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.status-error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.status-info {
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  color: #0c5460;
}

/* Collapsed View */
.email-template-summary {
  padding: 12px;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1rem;
}

.summary-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-item {
  font-size: 0.85rem;
  color: #6c757d;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
}

/* Node Type Badge */
.node-type-badge {
  position: absolute;
  top: -8px;
  right: 8px;
  background: #4CAF50;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Responsive Design */
@media (max-width: 768px) {
  .config-row {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .config-label {
    min-width: auto;
  }
  
  .email-actions {
    flex-direction: column;
  }
  
  .variable-item {
    flex-wrap: wrap;
  }
  
  .summary-details {
    flex-direction: column;
    gap: 4px;
  }
}

/* AI Generator Styles */
.ai-generator-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
}

.ai-title {
  color: white;
  margin-bottom: 16px;
  font-weight: 600;
  text-align: center;
}

.ai-prompt-section {
  margin-bottom: 16px;
}

.ai-prompt-textarea {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 8px;
  padding: 12px;
  resize: vertical;
}

.ai-prompt-textarea::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.ai-prompt-textarea:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

.ai-options-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-option-row {
  display: flex;
  flex-direction: column;
}

.ai-option-row .config-label {
  color: white;
  margin-bottom: 4px;
  font-size: 0.9rem;
  font-weight: 500;
}

.ai-option-row .form-control {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 6px;
}

.ai-option-row .form-control:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.5);
  outline: none;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
}

.ai-option-row .form-control option {
  background: #333;
  color: white;
}

.ai-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.ai-actions .btn {
  min-width: 140px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.ai-actions .btn-primary {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
}

.ai-actions .btn-primary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.ai-actions .btn-outline-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
}

.ai-actions .btn-outline-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.6);
}

.ai-status-message {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-weight: 500;
}

.ai-status-message.status-info {
  background: rgba(13, 202, 240, 0.2);
  border: 1px solid rgba(13, 202, 240, 0.4);
  color: #0dcaf0;
}

.ai-status-message.status-success {
  background: rgba(25, 135, 84, 0.2);
  border: 1px solid rgba(25, 135, 84, 0.4);
  color: #198754;
}

.ai-status-message.status-error {
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid rgba(220, 53, 69, 0.4);
  color: #dc3545;
}

.node-controls .btn.active {
  background: #0d6efd;
  border-color: #0d6efd;
  color: white;
}

/* Responsive AI Styles */
@media (max-width: 768px) {
  .ai-options-section {
    grid-template-columns: 1fr;
  }
  
  .ai-actions {
    flex-direction: column;
  }
  
  .ai-actions .btn {
    min-width: auto;
  }
}
</style>
