<template>
  <div class="container-fluid mt-4">
    <div class="row">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2>🎭 Conversation Analysis</h2>
          <router-link to="/norwegian-transcription-test" class="btn btn-outline-secondary">
            ← Back to Transcription Page
          </router-link>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3">Loading recording...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="alert alert-danger">
          {{ error }}
          <router-link to="/norwegian-transcription" class="btn btn-sm btn-outline-danger ms-3">
            Go to Portfolio
          </router-link>
        </div>

        <!-- Main content -->
        <div v-else-if="recording">
          <!-- Recording Info Card -->
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">📁 Recording Information</h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-6">
                  <p><strong>Filename:</strong> {{ recording.filename }}</p>
                  <p><strong>Duration:</strong> {{ formatDuration(recording.duration) }}</p>
                  <p><strong>Created:</strong> {{ formatDate(recording.timestamp) }}</p>
                </div>
                <div class="col-md-6">
                  <p>
                    <strong>Speakers:</strong>
                    <span class="badge bg-success ms-2">
                      🎤 {{ recording.diarization.segments.length }} segments
                    </span>
                  </p>
                  <p><strong>Transcription:</strong> {{ recording.transcriptionText.length }} characters</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Context Input -->
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">🔍 Analysis Context (Optional)</h5>
            </div>
            <div class="card-body">
              <!-- Template Selection -->
              <div class="mb-3">
                <label for="templateSelect" class="form-label">Load Saved Template:</label>
                <div class="d-flex gap-2">
                  <select
                    id="templateSelect"
                    v-model="selectedTemplateId"
                    class="form-select"
                    @change="loadTemplate"
                    :disabled="analyzing"
                  >
                    <option value="">-- Select a template --</option>
                    <option
                      v-for="template in contextTemplates"
                      :key="template.id"
                      :value="template.id"
                    >
                      {{ template.name }}
                    </option>
                  </select>
                  <button
                    v-if="selectedTemplateId"
                    class="btn btn-outline-danger"
                    @click="deleteTemplate"
                    :disabled="analyzing"
                    title="Delete selected template"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Context Textarea -->
              <label for="contextInput" class="form-label">
                Provide additional context to help the AI understand the conversation better:
              </label>
              <textarea
                id="contextInput"
                v-model="context"
                class="form-control mb-2"
                rows="3"
                placeholder="E.g., 'Therapy session', 'Business meeting', 'Interview', etc."
                :disabled="analyzing"
              ></textarea>

              <!-- Save Template Button -->
              <button
                v-if="context.trim()"
                class="btn btn-sm btn-outline-primary"
                @click="showSaveTemplateModal = true"
                :disabled="analyzing"
              >
                💾 Save as Template
              </button>
            </div>
          </div>

          <!-- Save Template Modal -->
          <div v-if="showSaveTemplateModal" class="modal d-block" style="background: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title">Save Context Template</h5>
                  <button type="button" class="btn-close" @click="showSaveTemplateModal = false"></button>
                </div>
                <div class="modal-body">
                  <label for="templateName" class="form-label">Template Name:</label>
                  <input
                    id="templateName"
                    v-model="newTemplateName"
                    type="text"
                    class="form-control"
                    placeholder="E.g., 'Mentor Session', 'Team Meeting'"
                  />
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" @click="showSaveTemplateModal = false">
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    @click="saveTemplate"
                    :disabled="!newTemplateName.trim()"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Model Selection -->
          <div class="card mb-4">
            <div class="card-header">
              <h5 class="mb-0">🤖 AI Model Selection</h5>
            </div>
            <div class="card-body">
              <label for="modelSelection" class="form-label">Choose AI Model:</label>
              <select id="modelSelection" v-model="selectedModel" class="form-select" :disabled="analyzing">
                <option value="cloudflare">🔥 Cloudflare Workers AI (Fast & Free)</option>
                <option value="claude">🧠 Claude AI (Advanced Reasoning)</option>
                <option value="grok">🤔 Grok AI (Philosophical Insights)</option>
                <option value="gemini">⚡ Google Gemini (Fast Responses)</option>
                <option value="gpt4">🧩 GPT-4 (Structured Reasoning)</option>
                <option value="gpt5">🚀 GPT-5 (Next Generation AI)</option>
              </select>
              <small class="form-text text-muted mt-2 d-block">
                <strong>Cloudflare</strong> is free. Other models require API keys configured in the backend.
              </small>
            </div>
          </div>

          <!-- Analyze Button -->
          <div class="text-center mb-4">
            <button
              class="btn btn-primary btn-lg"
              @click="analyzeConversation"
              :disabled="analyzing"
            >
              <span v-if="analyzing" class="spinner-border spinner-border-sm me-2"></span>
              {{ analyzing ? 'Analyzing...' : '🤖 Analyze Conversation' }}
            </button>
          </div>

          <!-- Analysis Results -->
          <div v-if="analysis" class="analysis-results">
            <!-- Summary Card -->
            <div class="card mb-4">
              <div class="card-header bg-primary text-white">
                <h5 class="mb-0">📝 Summary</h5>
              </div>
              <div class="card-body">
                <p class="lead">{{ analysis.summary }}</p>
              </div>
            </div>

            <!-- Key Themes -->
            <div class="card mb-4">
              <div class="card-header bg-info text-white">
                <h5 class="mb-0">💡 Key Themes</h5>
              </div>
              <div class="card-body">
                <!-- Handle array of theme objects with tema/detaljer -->
                <div v-if="Array.isArray(analysis.keyThemes) && analysis.keyThemes.length > 0">
                  <div
                    v-for="(theme, index) in analysis.keyThemes"
                    :key="index"
                    class="theme-item mb-3 p-3 border rounded"
                  >
                    <!-- Grok format: tema + beskrivelse -->
                    <template v-if="typeof theme === 'object' && (theme.tema || theme.name)">
                      <h6 class="text-info mb-2">{{ theme.tema || theme.name }}</h6>
                      <p v-if="theme.beskrivelse || theme.detaljer || theme.details || theme.description" class="mb-0 text-muted">
                        {{ theme.beskrivelse || theme.detaljer || theme.details || theme.description }}
                      </p>
                    </template>
                    <!-- Simple string theme -->
                    <h6 v-else class="text-info mb-0">{{ theme }}</h6>
                  </div>
                </div>
                <!-- Fallback for simple array of strings -->
                <div v-else class="d-flex flex-wrap gap-2">
                  <span class="badge bg-secondary">No themes available</span>
                </div>
              </div>
            </div>

            <!-- Speaker Roles -->
            <div class="card mb-4">
              <div class="card-header bg-success text-white">
                <h5 class="mb-0">🎤 Speaker Roles</h5>
              </div>
              <div class="card-body">
                <!-- Handle object with speaker keys -->
                <div v-if="typeof analysis.speakerRoles === 'object' && Object.keys(analysis.speakerRoles).length > 0">
                  <div class="row">
                    <template
                      v-for="(roleData, speaker) in analysis.speakerRoles"
                      :key="speaker"
                    >
                      <div
                        v-if="speaker !== 'dynamikk'"
                        class="col-md-6 mb-3"
                      >
                        <div class="speaker-role-card p-3 border rounded">
                          <h6 class="text-primary">{{ speaker }}</h6>
                          <!-- Handle string description (Norwegian format) -->
                          <p v-if="typeof roleData === 'string'" class="mb-0">{{ roleData }}</p>
                          <!-- Handle Grok format with rolle + beskrivelse -->
                          <div v-else-if="roleData.rolle || roleData.role">
                            <p class="mb-1"><strong>{{ roleData.rolle || roleData.role }}</strong></p>
                            <p v-if="roleData.beskrivelse || roleData.description" class="mb-0 text-muted">
                              {{ roleData.beskrivelse || roleData.description }}
                            </p>
                          </div>
                          <!-- Handle object with characteristics (English format) -->
                          <div v-else>
                            <p v-if="roleData.characteristics" class="mb-0">
                              {{ roleData.characteristics }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                  <!-- Display dynamikk section separately if present -->
                  <div v-if="analysis.speakerRoles.dynamikk" class="mt-3 p-3 bg-light rounded">
                    <h6 class="text-success mb-2">🔄 Dynamikk</h6>
                    <p class="mb-0">{{ analysis.speakerRoles.dynamikk.beskrivelse || analysis.speakerRoles.dynamikk.description || analysis.speakerRoles.dynamikk }}</p>
                  </div>
                </div>
                <div v-else>
                  <span class="badge bg-secondary">No speaker roles available</span>
                </div>
              </div>
            </div>

            <!-- Key Moments -->
            <div class="card mb-4">
              <div class="card-header bg-warning text-dark">
                <h5 class="mb-0">⭐ Key Moments</h5>
              </div>
              <div class="card-body">
                <div v-if="analysis.keyMoments && analysis.keyMoments.length > 0" class="timeline">
                  <div
                    v-for="(moment, index) in analysis.keyMoments"
                    :key="index"
                    class="timeline-item mb-3 p-3 border-start border-3 border-warning"
                  >
                    <!-- Grok format: tidspunkt + beskrivelse -->
                    <div v-if="moment.tidspunkt || moment.timestamp">
                      <div class="mb-2">
                        <span class="badge bg-warning text-dark">
                          {{ moment.tidspunkt || formatTimestamp(moment.timestamp) }}
                        </span>
                      </div>
                      <p class="mb-0">{{ moment.beskrivelse || moment.description || moment }}</p>
                    </div>
                    <!-- Legacy format with speaker -->
                    <div v-else class="d-flex align-items-start">
                      <div class="flex-grow-1">
                        <strong v-if="moment.speaker">{{ moment.speaker }}</strong>
                        <div v-if="moment.beskrivelse">
                          <p class="mb-1"><strong>{{ moment.beskrivelse }}</strong></p>
                          <p v-if="moment.betydning" class="mb-0 text-muted">
                            <em>Significance:</em> {{ moment.betydning }}
                          </p>
                        </div>
                        <p v-else class="mb-0">{{ moment.description || moment }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else>
                  <span class="badge bg-secondary">No key moments available</span>
                </div>
              </div>
            </div>

            <!-- Action Items -->
            <div v-if="analysis.actionItems && analysis.actionItems.length > 0" class="card mb-4">
              <div class="card-header bg-danger text-white">
                <h5 class="mb-0">✅ Action Items</h5>
              </div>
              <div class="card-body">
                <ul class="list-group list-group-flush">
                  <li
                    v-for="(item, index) in analysis.actionItems"
                    :key="index"
                    class="list-group-item"
                  >
                    <!-- Handle string items -->
                    <template v-if="typeof item === 'string'">
                      {{ item }}
                    </template>
                    <!-- Grok format: punkt/handlingspunkt + beskrivelse -->
                    <template v-else-if="typeof item === 'object'">
                      <!-- Regular action item -->
                      <div v-if="item.punkt || item.handlingspunkt">
                        <strong class="text-primary d-block mb-2">
                          {{ item.punkt || item.handlingspunkt }}
                        </strong>
                        <p v-if="item.beskrivelse" class="mb-0 text-muted">
                          {{ item.beskrivelse }}
                        </p>
                      </div>
                      <!-- Konklusjon format (should be filtered out) -->
                      <div v-else-if="item.konklusjon">
                        <div class="alert alert-info mb-0">
                          <strong>Konklusjon:</strong> {{ item.konklusjon.beskrivelse || item.konklusjon }}
                        </div>
                      </div>
                      <!-- Fallback for other object formats -->
                      <div v-else>
                        {{ item.action || item.description || JSON.stringify(item) }}
                      </div>
                    </template>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Conclusion (Grok-specific) -->
            <div v-if="analysis.conclusion" class="card mb-4">
              <div class="card-header bg-dark text-white">
                <h5 class="mb-0">🎯 Konklusjon</h5>
              </div>
              <div class="card-body">
                <!-- Handle object with heading + beskrivelse -->
                <div v-if="typeof analysis.conclusion === 'object' && analysis.conclusion.heading">
                  <h6 class="text-dark mb-2">{{ analysis.conclusion.heading }}</h6>
                  <p class="mb-0">{{ analysis.conclusion.beskrivelse || analysis.conclusion.description }}</p>
                </div>
                <!-- Handle simple object with just beskrivelse -->
                <div v-else-if="typeof analysis.conclusion === 'object'">
                  <p class="mb-0">{{ analysis.conclusion.beskrivelse || analysis.conclusion.description || JSON.stringify(analysis.conclusion) }}</p>
                </div>
                <!-- Handle string -->
                <p v-else class="mb-0">{{ analysis.conclusion }}</p>
              </div>
            </div>

            <!-- Dynamic Extra Fields (Keywords, Hashtags, etc.) -->
            <div v-if="analysis.extraFields && Object.keys(analysis.extraFields).length > 0" class="card mb-4">
              <div class="card-header bg-primary text-white">
                <h5 class="mb-0">🎯 Additional Insights</h5>
              </div>
              <div class="card-body">
                <div
                  v-for="(value, key) in analysis.extraFields"
                  :key="key"
                  class="extra-field-section mb-3"
                >
                  <!-- Display field name (convert underscore/camelCase to readable) -->
                  <h6 class="text-primary text-capitalize">
                    {{ formatFieldName(key) }}
                  </h6>

                  <!-- Array of strings (keywords, hashtags) -->
                  <div v-if="Array.isArray(value) && value.length > 0 && typeof value[0] === 'string'"
                       class="d-flex flex-wrap gap-2 mb-2">
                    <span
                      v-for="(item, idx) in value"
                      :key="idx"
                      class="badge"
                      :class="key.includes('hashtag') ? 'bg-info' : 'bg-secondary'"
                    >
                      {{ item }}
                    </span>
                  </div>

                  <!-- Array of objects -->
                  <div v-else-if="Array.isArray(value) && value.length > 0" class="list-group">
                    <div
                      v-for="(item, idx) in value"
                      :key="idx"
                      class="list-group-item"
                    >
                      <pre class="mb-0">{{ JSON.stringify(item, null, 2) }}</pre>
                    </div>
                  </div>

                  <!-- Object -->
                  <div v-else-if="typeof value === 'object'" class="bg-light p-3 rounded">
                    <pre class="mb-0">{{ JSON.stringify(value, null, 2) }}</pre>
                  </div>

                  <!-- String -->
                  <p v-else class="mb-0">{{ value }}</p>
                </div>
              </div>
            </div>

            <!-- Save Options -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">💾 Save Analysis</h5>
              </div>
              <div class="card-body">
                <div class="d-flex gap-3">
                  <button
                    class="btn btn-success"
                    @click="saveToRecording"
                    :disabled="saving"
                  >
                    <span v-if="saving === 'recording'" class="spinner-border spinner-border-sm me-2"></span>
                    Save to Audio Portfolio
                  </button>
                  <button
                    class="btn btn-outline-primary"
                    @click="saveToKnowledgeGraph"
                    :disabled="saving"
                  >
                    <span v-if="saving === 'graph'" class="spinner-border spinner-border-sm me-2"></span>
                    Save as Knowledge Graph
                  </button>
                </div>
                <div v-if="saveSuccess" class="alert alert-success mt-3 mb-0">
                  {{ saveSuccess }}
                </div>
                <div v-if="saveError" class="alert alert-danger mt-3 mb-0">
                  {{ saveError }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Knowledge Graph Selection Modal -->
    <div v-if="showSelectionModal" class="modal d-block" style="background: rgba(0,0,0,0.5); z-index: 1050;">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">📊 Select Content for Knowledge Graph</h5>
            <button type="button" class="btn-close" @click="showSelectionModal = false"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-3">
              Choose which sections and subsections to include in your knowledge graph.
              Click the arrows to expand sections.
            </p>

            <!-- Global Select All / Deselect All -->
            <div class="mb-3">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="toggleAllSections"
              >
                {{ allSelected ? '☐ Deselect All' : '☑ Select All' }}
              </button>
            </div>

            <div class="selection-tree">
              <!-- Summary -->
              <div class="tree-item mb-3">
                <label class="d-flex align-items-center">
                  <input type="checkbox" v-model="selections.summary.include" class="form-check-input me-2" />
                  <strong>📝 Oppsummering</strong>
                </label>
              </div>

              <!-- Key Themes -->
              <div v-if="analysis.keyThemes && analysis.keyThemes.length > 0" class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('themes')" class="expand-icon me-2">
                    {{ expanded.themes ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.themes.includeAll"
                      @change="toggleAll('themes')"
                      :indeterminate="isIndeterminate('themes')"
                      class="form-check-input me-2"
                    />
                    <strong>💡 Hovedtemaer ({{ analysis.keyThemes.length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.themes" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(theme, index) in analysis.keyThemes"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-start">
                      <input type="checkbox" v-model="selections.themes.items[index]" class="form-check-input me-2 mt-1" />
                      <span>
                        <strong v-if="typeof theme === 'object' && (theme.tema || theme.name)">
                          {{ theme.tema || theme.name }}
                        </strong>
                        <span v-else>{{ theme }}</span>
                        <small v-if="typeof theme === 'object' && (theme.beskrivelse || theme.detaljer)"
                               class="d-block text-muted">
                          {{ (theme.beskrivelse || theme.detaljer || '').substring(0, 80) }}...
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Speaker Roles -->
              <div v-if="analysis.speakerRoles && Object.keys(analysis.speakerRoles).filter(k => k !== 'dynamikk').length > 0"
                   class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('speakers')" class="expand-icon me-2">
                    {{ expanded.speakers ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.speakers.includeAll"
                      @change="toggleAll('speakers')"
                      :indeterminate="isIndeterminate('speakers')"
                      class="form-check-input me-2"
                    />
                    <strong>🎤 Roller i samtalen ({{ Object.keys(analysis.speakerRoles).filter(k => k !== 'dynamikk').length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.speakers" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(speaker, index) in Object.keys(analysis.speakerRoles).filter(k => k !== 'dynamikk')"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-start">
                      <input type="checkbox" v-model="selections.speakers.items[index]" class="form-check-input me-2 mt-1" />
                      <span>
                        <strong>{{ speaker }}</strong>
                        <small v-if="typeof analysis.speakerRoles[speaker] === 'string'" class="d-block text-muted">
                          {{ analysis.speakerRoles[speaker].substring(0, 60) }}...
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Key Moments -->
              <div v-if="analysis.keyMoments && analysis.keyMoments.length > 0" class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('moments')" class="expand-icon me-2">
                    {{ expanded.moments ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.moments.includeAll"
                      @change="toggleAll('moments')"
                      :indeterminate="isIndeterminate('moments')"
                      class="form-check-input me-2"
                    />
                    <strong>⭐ Viktige Øyeblikk ({{ analysis.keyMoments.length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.moments" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(moment, index) in analysis.keyMoments"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-start">
                      <input type="checkbox" v-model="selections.moments.items[index]" class="form-check-input me-2 mt-1" />
                      <span>
                        <span v-if="moment.tidspunkt || moment.timestamp" class="badge bg-warning text-dark me-2">
                          {{ moment.tidspunkt || formatTimestamp(moment.timestamp) }}
                        </span>
                        <span>{{ (moment.beskrivelse || moment.description || moment).substring(0, 60) }}...</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Action Items -->
              <div v-if="analysis.actionItems && analysis.actionItems.length > 0" class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('actions')" class="expand-icon me-2">
                    {{ expanded.actions ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.actions.includeAll"
                      @change="toggleAll('actions')"
                      :indeterminate="isIndeterminate('actions')"
                      class="form-check-input me-2"
                    />
                    <strong>✅ Handlingspunkter ({{ analysis.actionItems.length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.actions" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(item, index) in analysis.actionItems"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-start">
                      <input type="checkbox" v-model="selections.actions.items[index]" class="form-check-input me-2 mt-1" />
                      <span>
                        <span v-if="typeof item === 'string'">{{ item.substring(0, 60) }}...</span>
                        <span v-else-if="item.punkt || item.handlingspunkt">
                          {{ (item.punkt || item.handlingspunkt).substring(0, 60) }}...
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Keywords -->
              <div v-if="analysis.extraFields && (analysis.extraFields['nøkkelord_for_ordsky'] || analysis.extraFields['keywords'])"
                   class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('keywords')" class="expand-icon me-2">
                    {{ expanded.keywords ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.keywords.includeAll"
                      @change="toggleAll('keywords')"
                      :indeterminate="isIndeterminate('keywords')"
                      class="form-check-input me-2"
                    />
                    <strong>🏷️ Nøkkelord ({{ (analysis.extraFields['nøkkelord_for_ordsky'] || analysis.extraFields['keywords'] || []).length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.keywords" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(keyword, index) in (analysis.extraFields['nøkkelord_for_ordsky'] || analysis.extraFields['keywords'] || [])"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-center">
                      <input type="checkbox" v-model="selections.keywords.items[index]" class="form-check-input me-2" />
                      <span class="badge bg-secondary">{{ keyword }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Hashtags -->
              <div v-if="analysis.extraFields && (analysis.extraFields['hashtag_sammendrag'] || analysis.extraFields['hashtags'])"
                   class="tree-item mb-3">
                <div class="d-flex align-items-center">
                  <span @click="toggleExpand('hashtags')" class="expand-icon me-2">
                    {{ expanded.hashtags ? '▼' : '▶' }}
                  </span>
                  <label class="d-flex align-items-center mb-0">
                    <input
                      type="checkbox"
                      v-model="selections.hashtags.includeAll"
                      @change="toggleAll('hashtags')"
                      :indeterminate="isIndeterminate('hashtags')"
                      class="form-check-input me-2"
                    />
                    <strong>#️⃣ Hashtags ({{ (analysis.extraFields['hashtag_sammendrag'] || analysis.extraFields['hashtags'] || []).length }} tilgjengelig)</strong>
                  </label>
                </div>

                <div v-if="expanded.hashtags" class="tree-children ms-4 mt-2">
                  <div
                    v-for="(hashtag, index) in (analysis.extraFields['hashtag_sammendrag'] || analysis.extraFields['hashtags'] || [])"
                    :key="index"
                    class="tree-child mb-2"
                  >
                    <label class="d-flex align-items-center">
                      <input type="checkbox" v-model="selections.hashtags.items[index]" class="form-check-input me-2" />
                      <span class="badge bg-info">{{ hashtag }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer d-flex justify-content-between align-items-center">
            <div>
              <div class="form-check">
                <input
                  type="checkbox"
                  v-model="autoProcessAfterNavigation"
                  class="form-check-input"
                  id="autoProcessCheck"
                />
                <label class="form-check-label" for="autoProcessCheck">
                  Auto-process (for Transcript Processor)
                </label>
              </div>
              <div class="form-check mt-2">
                <input
                  type="checkbox"
                  v-model="includeDiarizedText"
                  class="form-check-input"
                  id="includeDiarizedCheck"
                />
                <label class="form-check-label" for="includeDiarizedCheck">
                  Include full diarized conversation text
                </label>
              </div>

              <!-- Theme Extraction Button -->
              <div class="mt-3">
                <button
                  type="button"
                  class="btn btn-outline-warning btn-sm w-100"
                  @click="showThemeExtractionModal = true"
                  title="Extract specific theme from conversation"
                >
                  <i class="fas fa-search-plus me-1"></i> Extract Theme from Conversation
                </button>
              </div>
            </div>
            <div>
              <button type="button" class="btn btn-secondary me-2" @click="showSelectionModal = false">
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-success me-2"
                @click="createGraphDirectly"
                :disabled="!hasSelection()"
                title="Create graph immediately from selected sections"
              >
                <i class="fas fa-bolt me-1"></i> Create Graph Directly
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="sendToTranscriptProcessor"
                :disabled="!hasSelection()"
                title="Send to Transcript Processor for AI enhancement"
              >
                <i class="fas fa-magic me-1"></i> Send to Processor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Theme Extraction Modal -->
  <div v-if="showThemeExtractionModal" class="modal-backdrop fade show" @click="showThemeExtractionModal = false"></div>
  <div v-if="showThemeExtractionModal" class="modal fade show d-block" tabindex="-1">
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header bg-warning text-dark">
          <h5 class="modal-title">
            <i class="fas fa-search-plus me-2"></i>Extract Theme from Conversation
          </h5>
          <button type="button" class="btn-close" @click="showThemeExtractionModal = false"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="themeInput" class="form-label fw-bold">Theme / Topic</label>
            <input
              type="text"
              class="form-control"
              id="themeInput"
              v-model="themeToExtract"
              placeholder="e.g., perspektiv, kjærlighet, meditasjon, tankefrihet"
              @keyup.enter="extractTheme"
            />
            <small class="form-text text-muted">
              Enter a word or phrase that represents the theme you want to analyze in the conversation
            </small>
          </div>

          <div class="form-check mb-3">
            <input
              type="checkbox"
              v-model="useGrokForTheme"
              class="form-check-input"
              id="useGrokThemeCheck"
            />
            <label class="form-check-label" for="useGrokThemeCheck">
              <strong>Use Grok AI for enhanced analysis</strong> (preserves actual conversation wording)
            </label>
          </div>

          <!-- Preview of found segments -->
          <div v-if="themePreviewSegments.length > 0" class="alert alert-info">
            <strong><i class="fas fa-info-circle me-1"></i>Preview:</strong> Found {{ themePreviewSegments.length }} segments containing "{{themeToExtract}}"
          </div>

          <!-- Processing indicator -->
          <div v-if="isExtractingTheme" class="text-center py-4">
            <div class="spinner-border text-warning" role="status"></div>
            <p class="mt-2">{{ useGrokForTheme ? 'Analyzing theme with Grok AI...' : 'Extracting theme...' }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="showThemeExtractionModal = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-warning"
            @click="extractTheme"
            :disabled="!themeToExtract || isExtractingTheme"
          >
            <i class="fas fa-search-plus me-1"></i> Extract Theme
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { alignDiarizationWithTextAdvanced, formatAlignedSegmentsAsMarkdown } from '@/utils/alignDiarizationWithText'
import { findThemeSegments, createSimpleThemeNode, prepareThemeAnalysisRequest, formatGrokThemeNode } from '@/utils/extractConversationTheme'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const error = ref(null)
const recording = ref(null)

// Theme extraction state
const showThemeExtractionModal = ref(false)
const themeToExtract = ref('')
const useGrokForTheme = ref(true)
const isExtractingTheme = ref(false)
const themePreviewSegments = ref([])

// Watch theme input for live preview
watch(themeToExtract, async (newTheme) => {
  if (newTheme && recording.value && recording.value.diarization) {
    // Generate aligned segments for preview
    const transcript = recording.value.norwegianTranscription?.improved_text || recording.value.transcriptionText
    if (transcript) {
      const alignedSegments = alignDiarizationWithTextAdvanced(
        recording.value.diarization.segments,
        transcript,
        recording.value.diarization.speakerLabels || {}
      )
      themePreviewSegments.value = findThemeSegments(alignedSegments, newTheme)
    }
  } else {
    themePreviewSegments.value = []
  }
})
const context = ref('')
const selectedModel = ref('cloudflare') // Default to cloudflare provider
const analyzing = ref(false)
const analysis = ref(null)
const saving = ref(null)
const saveSuccess = ref(null)
const saveError = ref(null)

// Context templates
const contextTemplates = ref([])
const selectedTemplateId = ref('')
const showSaveTemplateModal = ref(false)
const newTemplateName = ref('')

onMounted(async () => {
  const recordingId = route.query.recordingId
  if (!recordingId) {
    error.value = 'No recording ID provided. Please select a recording from the portfolio.'
    loading.value = false
    return
  }

  try {
    // Fetch recording from audio-portfolio-worker
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/list-recordings?userEmail=${encodeURIComponent(userStore.email)}`
    )

    if (!response.ok) {
      throw new Error('Failed to load recordings')
    }

    const data = await response.json()
    const recordings = data.recordings || []

    console.log('Looking for recordingId:', recordingId)
    console.log('Available recordings:', recordings.map(r => ({ id: r.recordingId, name: r.displayName || r.fileName })))

    // Find the recording by ID
    const found = recordings.find(r => r.recordingId === recordingId)

    if (!found) {
      error.value = `Recording not found: ${recordingId}`
      loading.value = false
      return
    }

    // Validate required data
    if (!found.transcriptionText) {
      error.value = 'This recording does not have a transcription.'
      loading.value = false
      return
    }

    if (!found.diarization || !found.diarization.segments || found.diarization.segments.length === 0) {
      error.value = 'This recording does not have speaker diarization data.'
      loading.value = false
      return
    }

    recording.value = found

    // Check if there's already a saved analysis
    if (found.conversationAnalysis && found.conversationAnalysis.analysis) {
      console.log('📋 Loading saved analysis:', found.conversationAnalysis)
      analysis.value = found.conversationAnalysis.analysis
      if (found.conversationAnalysis.context) {
        context.value = found.conversationAnalysis.context
      }
    }

    // Load context templates
    await loadContextTemplates()

    loading.value = false
  } catch (err) {
    error.value = `Error loading recording: ${err.message}`
    loading.value = false
  }
})

async function analyzeConversation() {
  analyzing.value = true
  analysis.value = null
  saveSuccess.value = null
  saveError.value = null

  try {
    // Map provider names to actual API endpoints (same as action_test)
    const endpointMap = {
      cloudflare: 'https://knowledge.vegvisr.org/generate-worker-ai',
      grok: 'https://api.vegvisr.org/groktest',
      claude: 'https://api.vegvisr.org/claude-test',
      gemini: 'https://api.vegvisr.org/gemini-test',
      gpt4: 'https://api.vegvisr.org/gpt-4-test',
      gpt5: 'https://api.vegvisr.org/gpt-5-test'
    }

    const endpoint = endpointMap[selectedModel.value] || endpointMap.cloudflare

    // Get speaker labels if available (for anonymity/regulations)
    const speakerLabels = recording.value.diarization?.speakerLabels ||
                         recording.value.speakerLabels || {}

    // Build the conversation text with speaker timeline
    const conversationTimeline = recording.value.diarization.segments.map(segment => {
      const startTime = Math.floor(segment.start)
      const minutes = Math.floor(startTime / 60)
      const seconds = startTime % 60
      const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`

      // Use speaker label if available, otherwise use speaker ID
      const speakerName = speakerLabels[segment.speaker] || segment.speaker

      return `[${timeLabel}] ${speakerName}: [speaking for ${Math.floor(segment.end - segment.start)}s]`
    }).join('\n')

    // Build speaker label mapping for context
    let speakerContext = ''
    if (Object.keys(speakerLabels).length > 0) {
      speakerContext = `\n\nTALERIDENTIFISERING (for anonymitet/personvern):\n`
      Object.entries(speakerLabels).forEach(([speakerId, label]) => {
        speakerContext += `- ${speakerId} = ${label}\n`
      })
      speakerContext += `\nVIKTIG: Bruk alltid talernavnene (${Object.values(speakerLabels).join(', ')}) i analysen, IKKE ${Object.keys(speakerLabels).join(', ')}.\n`
    }

    // Build the prompt for AI (same format as action_test expects)
    let prompt = `Analyser denne norske samtalen:\n\n`
    prompt += `TRANSKRIBERING:\n${recording.value.transcriptionText}\n\n`
    prompt += `HØYTALERTIDSLINJEN:\n${conversationTimeline}\n`

    if (speakerContext) {
      prompt += speakerContext
    }

    if (context.value.trim()) {
      prompt += `\nKONTEKST: ${context.value.trim()}\n`
    }

    prompt += `Vennligst gi en strukturert analyse med:\n`
    prompt += `1. Sammendrag av samtalen\n`
    prompt += `2. Hovedtemaer som diskuteres\n`
    prompt += `3. Roller i samtalen og dynamikk\n`
    prompt += `4. Viktige øyeblikk eller vendepunkter\n`
    prompt += `5. Handlingspunkter eller konklusjoner\n\n`
    prompt += `Svar på norsk med JSON format.`

    // Call the existing action_test endpoint
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        returnType: 'fulltext'
      })
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const result = await response.json()

    console.log('🔍 API Response:', result)

    // action_test endpoints return {info: "...", bibl: [...]}
    // We just need the text from result.info
    const analysisText = result.info || result.text || JSON.stringify(result)

    console.log('📝 Analysis text:', analysisText)

    if (!analysisText || analysisText === 'undefined' || analysisText === '{}') {
      throw new Error('Empty response from AI model. The API may not have generated content.')
    }

    // Try to parse as JSON for structured display
    try {
      // Strip markdown code fences if present (Gemini adds ```json ... ```)
      let cleanedText = analysisText.trim()
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '')
        console.log('🧹 Stripped JSON code fences')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '')
        console.log('🧹 Stripped code fences')
      }

      const parsedData = JSON.parse(cleanedText)

      console.log('🔍 Parsed JSON keys:', Object.keys(parsedData))
      console.log('🔍 Full parsed data:', parsedData)

      // Handle Grok's nested "analyse" structure
      const data = parsedData.analyse || parsedData

      // Extract action items and conclusion from Grok's nested structure
      let actionItems = []
      let conclusion = null

      if (data['5_handlingspunkter_eller_konklusjoner']) {
        const handlingsData = data['5_handlingspunkter_eller_konklusjoner']

        // Extract punkter array
        let rawItems = handlingsData.punkter || []

        // Separate action items from conclusion
        actionItems = []
        rawItems.forEach(item => {
          if (typeof item === 'object') {
            // Check if this item is a conclusion (has konklusjon field)
            if (item.konklusjon) {
              // Extract as conclusion
              conclusion = {
                heading: item.konklusjon,
                beskrivelse: item.beskrivelse
              }
            } else if (item.punkt || item.handlingspunkt) {
              // Regular action item
              actionItems.push(item)
            }
          } else if (typeof item === 'string') {
            // String items go to action items
            actionItems.push(item)
          }
        })

        // Also check for conclusion at top level of handlingsData
        if (!conclusion && handlingsData.konklusjon) {
          conclusion = handlingsData.konklusjon
        }
      } else {
        actionItems = data.handlingspunkter_eller_konklusjoner ||
                     data.actionItems || data.action_items || data.actions ||
                     data.conclusions || []
      }

      // Map core fields (Norwegian → English)
      analysis.value = {
        summary: data.sammendrag || data.summary ||
                data['1_sammendrag_av_samtalen']?.beskrivelse || '',
        keyThemes: data.hovedtemaer || data.keyThemes || data.themes ||
                  data['2_hovedtemaer_som_diskuteres']?.temaer ||
                  data['2_hovedtemaer_som_diskuteres'] || [],
        speakerRoles: data.hoyttalerroller_og_dynamikk || data.høyttalerroller_og_dynamikk ||
                     data.speakerRoles || data.speaker_roles || data.rolle ||
                     data['3_høyttalerroller_og_dynamikk']?.roller ||
                     data['3_høyttalerroller_og_dynamikk'] || {},
        keyMoments: data.viktige_oyeblikk || data.viktige_øyeblikk ||
                   data.keyMoments || data.key_moments || data.moments ||
                   data['4_viktige_øyeblikk_eller_vendepunkter']?.øyeblikk ||
                   data['4_viktige_øyeblikk_eller_vendepunkter'] || [],
        actionItems: actionItems,
        conclusion: conclusion, // Add conclusion field
        // Capture ALL extra fields dynamically (keywords, hashtags, etc.)
        extraFields: {}
      }

      // Add any extra fields that weren't mapped above
      const knownFields = ['sammendrag', 'summary', 'hovedtemaer', 'keyThemes', 'themes',
                          'hoyttalerroller_og_dynamikk', 'høyttalerroller_og_dynamikk',
                          'speakerRoles', 'speaker_roles', 'rolle',
                          'viktige_oyeblikk', 'viktige_øyeblikk', 'keyMoments', 'key_moments', 'moments',
                          'handlingspunkter_eller_konklusjoner', 'actionItems', 'action_items',
                          'actions', 'conclusions',
                          '1_sammendrag_av_samtalen', '2_hovedtemaer_som_diskuteres',
                          '3_høyttalerroller_og_dynamikk', '4_viktige_øyeblikk_eller_vendepunkter',
                          '5_handlingspunkter_eller_konklusjoner']

      // Capture extra fields from parent level (for fields like keywords, hashtags)
      Object.keys(parsedData).forEach(key => {
        if (!knownFields.includes(key) && key !== 'analyse') {
          // Handle nested keywords structure
          if (key === 'nøkkelord_for_ordsky_og_hashtags' && typeof parsedData[key] === 'object') {
            // Expand nested structure into separate fields
            if (parsedData[key].nøkkelord) {
              analysis.value.extraFields['nøkkelord_for_ordsky'] = parsedData[key].nøkkelord
            }
            if (parsedData[key].hashtags) {
              analysis.value.extraFields['hashtag_sammendrag'] = parsedData[key].hashtags
            }
          } else {
            analysis.value.extraFields[key] = parsedData[key]
          }
        }
      })

      console.log('✅ Parsed analysis:', analysis.value)
      console.log('📊 Speaker roles type:', typeof analysis.value.speakerRoles)
      console.log('📊 Speaker roles keys:', Object.keys(analysis.value.speakerRoles || {}))
      console.log('📊 Key moments length:', analysis.value.keyMoments?.length)
      console.log('🎁 Extra fields:', Object.keys(analysis.value.extraFields))
      console.log('✅ Action items count:', analysis.value.actionItems?.length)
      console.log('🎯 Conclusion:', analysis.value.conclusion)
    } catch (e) {
      console.error('❌ JSON parse error:', e)
      // If not JSON, create a simple structure with the text
      analysis.value = {
        summary: analysisText,
        keyThemes: [],
        speakerRoles: {},
        keyMoments: [],
        actionItems: []
      }
    }
  } catch (err) {
    error.value = `Analysis error: ${err.message}`
  } finally {
    analyzing.value = false
  }
}

async function saveToRecording() {
  saving.value = 'recording'
  saveSuccess.value = null
  saveError.value = null

  try {
    const url = new URL('https://audio-portfolio-worker.torarnehave.workers.dev/update-recording')
    url.searchParams.set('userEmail', userStore.email)
    url.searchParams.set('recordingId', recording.value.recordingId)

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationAnalysis: {
          analysis: analysis.value,
          context: context.value.trim() || null,
          analyzedAt: new Date().toISOString()
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save analysis')
    }

    saveSuccess.value = 'Analysis saved to recording successfully!'
  } catch (err) {
    saveError.value = `Save error: ${err.message}`
  } finally {
    saving.value = null
  }
}

// Knowledge Graph Selection Modal
const showSelectionModal = ref(false)
const autoProcessAfterNavigation = ref(false) // New: checkbox state for auto-processing
const includeDiarizedText = ref(false) // New: checkbox to include diarized conversation text
const expanded = ref({
  themes: false,
  speakers: false,
  moments: false,
  actions: false,
  keywords: false,
  hashtags: false
})

const selections = ref({
  summary: { include: true },
  themes: { includeAll: false, items: [] },
  speakers: { includeAll: false, items: [] },
  moments: { includeAll: false, items: [] },
  actions: { includeAll: false, items: [] },
  keywords: { includeAll: false, items: [] },
  hashtags: { includeAll: false, items: [] }
})

function initializeSelections() {
  if (!analysis.value) return

  // Initialize themes
  const themes = analysis.value.keyThemes || []
  selections.value.themes.items = new Array(themes.length).fill(false)

  // Initialize speakers
  const speakers = Object.keys(analysis.value.speakerRoles || {}).filter(k => k !== 'dynamikk')
  selections.value.speakers.items = new Array(speakers.length).fill(false)

  // Initialize moments
  const moments = analysis.value.keyMoments || []
  selections.value.moments.items = new Array(moments.length).fill(false)

  // Initialize actions
  const actions = analysis.value.actionItems || []
  selections.value.actions.items = new Array(actions.length).fill(false)

  // Initialize keywords
  const keywords = analysis.value.extraFields?.['nøkkelord_for_ordsky'] ||
                   analysis.value.extraFields?.['keywords'] || []
  selections.value.keywords.items = new Array(keywords.length).fill(false)

  // Initialize hashtags
  const hashtags = analysis.value.extraFields?.['hashtag_sammendrag'] ||
                   analysis.value.extraFields?.['hashtags'] || []
  selections.value.hashtags.items = new Array(hashtags.length).fill(false)
}

function toggleExpand(section) {
  expanded.value[section] = !expanded.value[section]
}

function toggleAll(section) {
  const includeAll = selections.value[section].includeAll
  selections.value[section].items = selections.value[section].items.map(() => includeAll)
}

function isIndeterminate(section) {
  const items = selections.value[section].items
  const selectedCount = items.filter(item => item).length
  return selectedCount > 0 && selectedCount < items.length
}

// Computed property to check if all sections are selected
const allSelected = computed(() => {
  if (!selections.value.summary.include) return false
  if (!selections.value.themes.items.every(item => item)) return false
  if (!selections.value.speakers.items.every(item => item)) return false
  if (!selections.value.moments.items.every(item => item)) return false
  if (!selections.value.actions.items.every(item => item)) return false
  if (!selections.value.keywords.items.every(item => item)) return false
  if (!selections.value.hashtags.items.every(item => item)) return false
  return true
})

// Toggle all sections on/off
function toggleAllSections() {
  const selectAll = !allSelected.value

  // Toggle summary
  selections.value.summary.include = selectAll

  // Toggle all themes
  selections.value.themes.includeAll = selectAll
  selections.value.themes.items = selections.value.themes.items.map(() => selectAll)

  // Toggle all speakers
  selections.value.speakers.includeAll = selectAll
  selections.value.speakers.items = selections.value.speakers.items.map(() => selectAll)

  // Toggle all moments
  selections.value.moments.includeAll = selectAll
  selections.value.moments.items = selections.value.moments.items.map(() => selectAll)

  // Toggle all actions
  selections.value.actions.includeAll = selectAll
  selections.value.actions.items = selections.value.actions.items.map(() => selectAll)

  // Toggle all keywords
  selections.value.keywords.includeAll = selectAll
  selections.value.keywords.items = selections.value.keywords.items.map(() => selectAll)

  // Toggle all hashtags
  selections.value.hashtags.includeAll = selectAll
  selections.value.hashtags.items = selections.value.hashtags.items.map(() => selectAll)
}

function hasSelection() {
  if (selections.value.summary.include) return true
  if (selections.value.themes.items.some(item => item)) return true
  if (selections.value.speakers.items.some(item => item)) return true
  if (selections.value.moments.items.some(item => item)) return true
  if (selections.value.actions.items.some(item => item)) return true
  if (selections.value.keywords.items.some(item => item)) return true
  if (selections.value.hashtags.items.some(item => item)) return true
  return false
}

async function saveToKnowledgeGraph() {
  saving.value = 'graph'
  saveSuccess.value = null
  saveError.value = null

  try {
    // Initialize selections and show modal
    initializeSelections()
    showSelectionModal.value = true
    saving.value = null
  } catch (err) {
    saveError.value = `Error: ${err.message}`
    saving.value = null
  }
}

// Send selected content to Transcript Processor for AI processing
async function sendToTranscriptProcessor() {
  if (!hasSelection()) {
    saveError.value = 'Please select at least one section'
    return
  }

  showSelectionModal.value = false
  saving.value = 'transcript'

  try {
    // Build markdown text from selections
    const text = buildMarkdownFromSelections()

    // Store in sessionStorage and navigate
    sessionStorage.setItem('prefill_transcript', text)

    // Set auto_process flag based on checkbox
    if (autoProcessAfterNavigation.value) {
      sessionStorage.setItem('auto_process', 'true')
    }

    // Navigate to transcript processor using Vue Router
    await router.push({
      path: '/transcript-processor',
      query: { prefill: 'true' }
    })

  } catch (err) {
    saveError.value = `Error: ${err.message}`
    saving.value = null
  }
}

// Create knowledge graph directly from selected sections (no AI)
async function createGraphDirectly() {
  if (!hasSelection()) {
    saveError.value = 'Please select at least one section'
    return
  }

  showSelectionModal.value = false
  saving.value = 'graph'

  try {
    const nodes = []
    let nodeIndex = 0

    // Summary node
    if (selections.value.summary.include && analysis.value.summary) {
      nodes.push({
        id: `analysis_summary_${Date.now()}`,
        label: '📝 Oppsummering',
        color: '#e3f2fd',
        type: 'fulltext',
        info: `## Oppsummering\n\n${analysis.value.summary}`,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Themes node (all themes in ONE node)
    const selectedThemes = (analysis.value.keyThemes || []).filter((_, index) =>
      selections.value.themes.items[index]
    )
    if (selectedThemes.length > 0) {
      let content = `## Hovedtemaer\n\n`
      selectedThemes.forEach((theme, idx) => {
        if (typeof theme === 'object' && (theme.tema || theme.name)) {
          content += `### ${idx + 1}. ${theme.tema || theme.name}\n\n`
          const desc = theme.beskrivelse || theme.detaljer || theme.details || theme.description
          if (desc) content += `${desc}\n\n`
        } else if (typeof theme === 'string') {
          content += `### ${idx + 1}. ${theme}\n\n`
        }
      })

      nodes.push({
        id: `analysis_themes_${Date.now()}`,
        label: `🎯 Hovedtemaer (${selectedThemes.length})`,
        color: '#fff3e0',
        type: 'fulltext',
        info: content,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Speakers node (all speakers in ONE node)
    const speakerKeys = Object.keys(analysis.value.speakerRoles || {}).filter(k => k !== 'dynamikk')
    const selectedSpeakers = speakerKeys.filter((_, index) =>
      selections.value.speakers.items[index]
    )
    if (selectedSpeakers.length > 0) {
      let content = `## Roller i samtalen\n\n`
      selectedSpeakers.forEach((speaker, idx) => {
        const roleData = analysis.value.speakerRoles[speaker]
        content += `### ${idx + 1}. ${speaker}\n\n`

        if (typeof roleData === 'string') {
          content += `${roleData}\n\n`
        } else if (roleData.rolle || roleData.role) {
          content += `**Rolle:** ${roleData.rolle || roleData.role}\n\n`
          const desc = roleData.beskrivelse || roleData.description
          if (desc) content += `${desc}\n\n`
        }
      })

      nodes.push({
        id: `analysis_speakers_${Date.now()}`,
        label: `🎤 Roller i samtalen (${selectedSpeakers.length})`,
        color: '#f3e5f5',
        type: 'fulltext',
        info: content,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Moments node (all moments in ONE node)
    const selectedMoments = (analysis.value.keyMoments || []).filter((_, index) =>
      selections.value.moments.items[index]
    )
    if (selectedMoments.length > 0) {
      let content = `## Viktige Øyeblikk\n\n`
      selectedMoments.forEach((moment, idx) => {
        if (moment.tidspunkt || moment.timestamp) {
          const time = moment.tidspunkt || formatTimestamp(moment.timestamp)
          content += `### ${idx + 1}. [${time}]\n\n${moment.beskrivelse || moment.description || moment}\n\n`
        } else if (typeof moment === 'string') {
          content += `### ${idx + 1}. ${moment}\n\n`
        }
      })

      nodes.push({
        id: `analysis_moments_${Date.now()}`,
        label: `⏱️ Viktige Øyeblikk (${selectedMoments.length})`,
        color: '#e8f5e9',
        type: 'fulltext',
        info: content,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Action items node
    const selectedActions = (analysis.value.actionItems || []).filter((_, index) =>
      selections.value.actions.items[index]
    )
    if (selectedActions.length > 0) {
      let content = `## Handlingspunkter\n\n`
      selectedActions.forEach((item, idx) => {
        if (typeof item === 'string') {
          content += `${idx + 1}. ${item}\n`
        } else if (item.punkt || item.handlingspunkt) {
          content += `${idx + 1}. **${item.punkt || item.handlingspunkt}**\n`
          if (item.beskrivelse) {
            content += `   ${item.beskrivelse}\n`
          }
        }
      })

      nodes.push({
        id: `analysis_actions_${Date.now()}`,
        label: '✅ Handlingspunkter',
        color: '#fce4ec',
        type: 'fulltext',
        info: content,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Keywords & Hashtags node
    const keywords = analysis.value.extraFields?.['nøkkelord_for_ordsky'] ||
                     analysis.value.extraFields?.['keywords'] || []
    const selectedKeywords = keywords.filter((_, index) =>
      selections.value.keywords.items[index]
    )
    const hashtags = analysis.value.extraFields?.['hashtag_sammendrag'] ||
                     analysis.value.extraFields?.['hashtags'] || []
    const selectedHashtags = hashtags.filter((_, index) =>
      selections.value.hashtags.items[index]
    )

    if (selectedKeywords.length > 0 || selectedHashtags.length > 0) {
      let content = ''
      if (selectedKeywords.length > 0) {
        content += `## Nøkkelord\n\n${selectedKeywords.join(', ')}\n\n`
      }
      if (selectedHashtags.length > 0) {
        content += `## Hashtags\n\n${selectedHashtags.join(' ')}`
      }

      nodes.push({
        id: `analysis_tags_${Date.now()}`,
        label: '🏷️ Nøkkelord & Tags',
        color: '#fff9c4',
        type: 'fulltext',
        info: content,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Diarized conversation text (optional)
    if (includeDiarizedText.value && recording.value) {
      const speakerLabels = recording.value.diarization?.speakerLabels || {}

      let conversationText = '## Full Conversation with Timeline\n\n'

      // Use advanced alignment if diarization segments and transcript are available
      if (recording.value.diarization &&
          recording.value.diarization.segments &&
          recording.value.transcriptionText) {

        // Align diarization with actual text
        const alignedSegments = alignDiarizationWithTextAdvanced(
          recording.value.diarization.segments,
          recording.value.norwegianTranscription?.improved_text || recording.value.transcriptionText,
          speakerLabels
        )

        // Format as markdown with text per segment
        conversationText = formatAlignedSegmentsAsMarkdown(alignedSegments)

      } else {
        // Fallback: show timeline only + full transcript
        if (recording.value.diarization && recording.value.diarization.segments) {
          conversationText += '### Speaker Timeline\n\n'

          recording.value.diarization.segments.forEach((segment) => {
            const startTime = Math.floor(segment.start)
            const endTime = Math.floor(segment.end)
            const minutes = Math.floor(startTime / 60)
            const seconds = startTime % 60
            const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
            const duration = Math.floor(endTime - startTime)

            const speakerLabel = speakerLabels[segment.speaker] || segment.speaker

            conversationText += `- **[${timeLabel}]** ${speakerLabel} (${duration}s)\n`
          })

          conversationText += '\n'
        }

        // Add full transcript text
        conversationText += '### Full Transcript\n\n'

        const transcriptText = recording.value.norwegianTranscription?.improved_text ||
                               recording.value.transcriptionText ||
                               'No transcript text available'

        conversationText += transcriptText
      }

      nodes.push({
        id: `diarized_conversation_${Date.now()}`,
        label: '🗣️ Full Conversation & Timeline',
        color: '#e1f5fe',
        type: 'fulltext',
        info: conversationText,
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
        position: { x: 100, y: 100 + (nodeIndex++ * 250) }
      })
    }

    // Create metadata
    const today = new Date()
    const dateStr = today.toLocaleDateString('no-NO')
    const timeStr = today.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })

    const graphData = {
      nodes: nodes,
      edges: [],
      metadata: {
        title: `💬 Samtaleanalyse ${dateStr}`,
        description: `Kunnskapsgraf fra samtaleanalyse ${dateStr} kl. ${timeStr}. Inneholder ${nodes.length} utvalgte seksjoner.`,
        createdBy: userStore.email || 'Anonymous',
        source: 'Conversation Analysis',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }

    // Generate unique graph ID
    const graphId = `conversation_analysis_${Date.now()}`

    console.log('💾 Saving graph with', nodes.length, 'nodes...')

    // Save to backend
    const response = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken
      },
      body: JSON.stringify({
        id: graphId,
        graphData,
        override: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Save failed:', response.status, errorText)
      throw new Error(`Failed to save graph: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Graph saved successfully:', result)

    saveSuccess.value = 'Knowledge graph created successfully!'
    saving.value = null

    // Navigate to GNew viewer (correct route)
    console.log('🚀 Navigating to /gnew-viewer?graphId=' + graphId)
    await router.push(`/gnew-viewer?graphId=${graphId}`)

  } catch (err) {
    console.error('❌ Error creating graph:', err)
    saveError.value = `Error creating graph: ${err.message}`
    saving.value = null
  }
}

// Extract Theme from Conversation
async function extractTheme() {
  if (!themeToExtract.value || !recording.value) {
    alert('Please enter a theme to extract')
    return
  }

  isExtractingTheme.value = true

  try {
    // Get aligned segments
    const transcript = recording.value.norwegianTranscription?.improved_text || recording.value.transcriptionText
    const alignedSegments = alignDiarizationWithTextAdvanced(
      recording.value.diarization.segments,
      transcript,
      recording.value.diarization.speakerLabels || {}
    )

    // Find theme-related segments
    const themeSegments = findThemeSegments(alignedSegments, themeToExtract.value)

    if (themeSegments.length === 0) {
      alert(`No segments found containing "${themeToExtract.value}"`)
      isExtractingTheme.value = false
      return
    }

    let themeNode = null

    if (useGrokForTheme.value) {
      // Use Grok for enhanced analysis
      console.log('🤖 Using Grok for theme analysis...')

      const requestData = prepareThemeAnalysisRequest(
        themeSegments,
        themeToExtract.value,
        transcript,
        'norwegian'
      )

      const response = await fetch('https://api.vegvisr.org/analyze-conversation-theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const grokResponse = await response.json()
      themeNode = formatGrokThemeNode(grokResponse, themeToExtract.value)

    } else {
      // Simple local extraction
      themeNode = createSimpleThemeNode(themeSegments, themeToExtract.value)
    }

    if (!themeNode) {
      throw new Error('Failed to create theme node')
    }

    // Add position
    themeNode.position = { x: 100, y: 100 }

    // Create a graph with just this theme node
    const graphData = {
      nodes: [themeNode],
      edges: [],
      metadata: {
        title: `🎯 Tema: ${themeToExtract.value}`,
        description: `Temauttrekk fra samtale: ${recording.value.id}`,
        createdBy: userStore.email || 'Anonymous',
        createdAt: new Date().toISOString()
      }
    }

    const graphId = `theme_${themeToExtract.value.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`

    // Save to backend
    const saveResponse = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': userStore.emailVerificationToken
      },
      body: JSON.stringify({
        id: graphId,
        graphData,
        override: true
      })
    })

    if (!saveResponse.ok) {
      throw new Error(`Failed to save: ${saveResponse.status}`)
    }

    console.log('✅ Theme graph created successfully')

    // Close modal and navigate
    showThemeExtractionModal.value = false
    await router.push(`/gnew-viewer?graphId=${graphId}`)

  } catch (error) {
    console.error('❌ Error extracting theme:', error)
    alert(`Error extracting theme: ${error.message}`)
  } finally {
    isExtractingTheme.value = false
  }
}

// Helper function to build markdown from selections
function buildMarkdownFromSelections() {
  let text = "# SAMTALEANALYSE\n\n"

    // Summary
    if (selections.value.summary.include && analysis.value.summary) {
      text += `## Oppsummering\n\n${analysis.value.summary}\n\n`
    }

    // Themes
    const selectedThemes = (analysis.value.keyThemes || []).filter((_, index) =>
      selections.value.themes.items[index]
    )
    if (selectedThemes.length > 0) {
      text += `## Hovedtemaer\n\n`
      selectedThemes.forEach(theme => {
        if (typeof theme === 'object' && (theme.tema || theme.name)) {
          text += `### ${theme.tema || theme.name}\n\n`
          const desc = theme.beskrivelse || theme.detaljer || theme.details || theme.description
          if (desc) {
            text += `${desc}\n\n`
          }
        } else if (typeof theme === 'string') {
          text += `- ${theme}\n`
        }
      })
      text += '\n'
    }

    // Speakers
    const speakerKeys = Object.keys(analysis.value.speakerRoles || {}).filter(k => k !== 'dynamikk')
    const selectedSpeakers = speakerKeys.filter((_, index) =>
      selections.value.speakers.items[index]
    )
    if (selectedSpeakers.length > 0) {
      text += `## Roller i samtalen\n\n`
      selectedSpeakers.forEach(speaker => {
        const roleData = analysis.value.speakerRoles[speaker]
        text += `### ${speaker}\n\n`
        if (typeof roleData === 'string') {
          text += `${roleData}\n\n`
        } else if (roleData.rolle || roleData.role) {
          text += `**Rolle:** ${roleData.rolle || roleData.role}\n\n`
          const desc = roleData.beskrivelse || roleData.description
          if (desc) {
            text += `${desc}\n\n`
          }
        }
      })
    }

    // Key Moments
    const selectedMoments = (analysis.value.keyMoments || []).filter((_, index) =>
      selections.value.moments.items[index]
    )
    if (selectedMoments.length > 0) {
      text += `## Viktige Øyeblikk\n\n`
      selectedMoments.forEach((moment, idx) => {
        if (moment.tidspunkt || moment.timestamp) {
          const time = moment.tidspunkt || formatTimestamp(moment.timestamp)
          text += `**${idx + 1}. [${time}]** - ${moment.beskrivelse || moment.description || moment}\n\n`
        } else if (typeof moment === 'string') {
          text += `**${idx + 1}.** ${moment}\n\n`
        }
      })
    }

    // Action Items
    const selectedActions = (analysis.value.actionItems || []).filter((_, index) =>
      selections.value.actions.items[index]
    )
    if (selectedActions.length > 0) {
      text += `## Handlingspunkter\n\n`
      selectedActions.forEach((item, idx) => {
        if (typeof item === 'string') {
          text += `${idx + 1}. ${item}\n`
        } else if (item.punkt || item.handlingspunkt) {
          text += `${idx + 1}. **${item.punkt || item.handlingspunkt}**\n`
          if (item.beskrivelse) {
            text += `   ${item.beskrivelse}\n`
          }
        }
      })
      text += '\n'
    }

    // Keywords
    const keywords = analysis.value.extraFields?.['nøkkelord_for_ordsky'] ||
                     analysis.value.extraFields?.['keywords'] || []
    const selectedKeywords = keywords.filter((_, index) =>
      selections.value.keywords.items[index]
    )
    if (selectedKeywords.length > 0) {
      text += `## Nøkkelord\n\n${selectedKeywords.join(', ')}\n\n`
    }

    // Hashtags
    const hashtags = analysis.value.extraFields?.['hashtag_sammendrag'] ||
                     analysis.value.extraFields?.['hashtags'] || []
    const selectedHashtags = hashtags.filter((_, index) =>
      selections.value.hashtags.items[index]
    )
    if (selectedHashtags.length > 0) {
      text += `## Hashtags\n\n${selectedHashtags.join(' ')}\n\n`
    }

    return text
  }

  function formatDuration(seconds) {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatFieldName(fieldName) {
  // Convert camelCase, snake_case, or kebab-case to readable text
  return fieldName
    .replace(/([A-Z])/g, ' $1') // camelCase → spaces
    .replace(/_/g, ' ') // snake_case → spaces
    .replace(/-/g, ' ') // kebab-case → spaces
    .replace(/\b\w/g, char => char.toUpperCase()) // capitalize words
    .trim()
}

// Context Template Functions
async function loadContextTemplates() {
  try {
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/context-templates?userEmail=${encodeURIComponent(userStore.email)}`
    )

    if (response.ok) {
      const data = await response.json()
      contextTemplates.value = data.templates || []
    }
  } catch (err) {
    console.error('Failed to load context templates:', err)
  }
}

async function saveTemplate() {
  if (!newTemplateName.value.trim() || !context.value.trim()) return

  try {
    const response = await fetch(
      'https://audio-portfolio-worker.torarnehave.workers.dev/context-templates',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: userStore.email,
          name: newTemplateName.value.trim(),
          context: context.value.trim()
        })
      }
    )

    if (response.ok) {
      const data = await response.json()
      contextTemplates.value = data.allTemplates.templates
      showSaveTemplateModal.value = false
      newTemplateName.value = ''
      saveSuccess.value = 'Template saved successfully!'
      setTimeout(() => saveSuccess.value = null, 3000)
    }
  } catch (err) {
    saveError.value = `Failed to save template: ${err.message}`
  }
}

function loadTemplate() {
  const template = contextTemplates.value.find(t => t.id === selectedTemplateId.value)
  if (template) {
    context.value = template.context

    // Update last used timestamp
    fetch('https://audio-portfolio-worker.torarnehave.workers.dev/context-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: userStore.email,
        templateId: template.id
      })
    }).catch(err => console.error('Failed to update template timestamp:', err))
  }
}

async function deleteTemplate() {
  if (!selectedTemplateId.value || !confirm('Delete this template?')) return

  try {
    const response = await fetch(
      `https://audio-portfolio-worker.torarnehave.workers.dev/context-templates?userEmail=${encodeURIComponent(userStore.email)}&templateId=${selectedTemplateId.value}`,
      { method: 'DELETE' }
    )

    if (response.ok) {
      const data = await response.json()
      contextTemplates.value = data.allTemplates.templates
      selectedTemplateId.value = ''
      context.value = ''
      saveSuccess.value = 'Template deleted successfully!'
      setTimeout(() => saveSuccess.value = null, 3000)
    }
  } catch (err) {
    saveError.value = `Failed to delete template: ${err.message}`
  }
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.analysis-results {
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.speaker-role-card {
  background-color: #f8f9fa;
  transition: transform 0.2s, box-shadow 0.2s;
}

.speaker-role-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.timeline-item {
  background-color: #fffef8;
  transition: background-color 0.2s;
}

.timeline-item:hover {
  background-color: #fff9e6;
}

.extra-field-section {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.extra-field-section h6 {
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.extra-field-section .badge {
  font-size: 0.9rem;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  cursor: default;
  transition: transform 0.2s;
}

.extra-field-section .badge:hover {
  transform: translateY(-2px);
}

.extra-field-section pre {
  background: white;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  font-size: 0.85rem;
  max-height: 300px;
  overflow-y: auto;
}

.timestamp-badge {
  min-width: 70px;
}

/* Knowledge Graph Selection Modal Styles */
.selection-tree {
  padding: 1rem 0;
}

.tree-item {
  padding: 0.5rem;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.tree-item:hover {
  background-color: #f8f9fa;
}

.expand-icon {
  display: inline-block;
  width: 24px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  color: #0d6efd;
  transition: transform 0.2s;
}

.expand-icon:hover {
  transform: scale(1.2);
}

.tree-children {
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  border-left: 2px solid #e9ecef;
  padding-top: 0.5rem;
}

.tree-child {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.tree-child:hover {
  background-color: #f1f3f5;
}

.tree-child label {
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 0;
  width: 100%;
}

.form-check-input {
  cursor: pointer;
}

.modal-dialog-scrollable .modal-body {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>
