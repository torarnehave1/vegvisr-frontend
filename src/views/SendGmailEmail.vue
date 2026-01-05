<template>
  <div class="page">
    <div class="card">
      <h1>Send Email via Gmail</h1>
      <p class="muted">
        Uses the slowyou.io relay. Provide your Gmail address and app password (app-specific password
        recommended) to send a message.
      </p>

      <div v-if="sharedGraphId" class="share-panel">
        <div class="share-panel-header">
          <h2>Shared Knowledge Graph</h2>
          <span v-if="sharedGraphLoading" class="badge info">Checking SEO slug</span>
          <span v-else-if="sharedGraphReady" class="badge success">SEO slug ready</span>
          <span v-else-if="sharedGraphError" class="badge danger">SEO slug missing</span>
        </div>
        <p class="share-panel-subtitle">
          Email sharing requires an existing SEO slug for this graph.
        </p>
        <div class="share-panel-grid">
          <div>
            <span class="label">Graph Title</span>
            <div class="value">{{ sharedGraphTitle || 'Untitled Graph' }}</div>
          </div>
          <div>
            <span class="label">Graph ID</span>
            <div class="value mono">{{ sharedGraphId }}</div>
          </div>
          <div>
            <span class="label">SEO Slug</span>
            <div class="value mono">{{ sharedGraphSlug || 'Generating…' }}</div>
          </div>
          <div>
            <span class="label">SEO Link</span>
            <div class="value">
              <a v-if="sharedGraphUrl" :href="sharedGraphUrl" target="_blank" rel="noreferrer">
                {{ sharedGraphUrl }}
              </a>
              <span v-else>Preparing…</span>
            </div>
          </div>
        </div>
        <p v-if="sharedGraphMessage" class="status info">{{ sharedGraphMessage }}</p>
        <p v-if="sharedGraphError" class="status error">{{ sharedGraphError }}</p>
      </div>

      <form @submit.prevent="sendEmail">
        <div class="field">
          <label for="senderEmail">Your primary Gmail (auth user)</label>
          <input
            id="senderEmail"
            v-model="form.authEmail"
            type="email"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label for="appPassword">Gmail app password</label>
          <input
            id="appPassword"
            v-model="form.appPassword"
            type="password"
            autocomplete="current-password"
            :required="savePassword"
          />
          <div class="save-row">
            <label class="checkbox">
              <input type="checkbox" v-model="savePassword" />
              Save this app password to my account (encrypted)
            </label>
          </div>
          <p class="hint">Use a Google App Password, not your main password.</p>
        </div>

        <div class="field">
          <label for="fromEmail">From address (alias)</label>
          <div class="from-row">
            <select id="fromEmail" v-model="form.fromEmail">
              <option :value="form.authEmail">{{ form.authEmail }} (primary)</option>
              <option v-for="alias in aliases" :key="alias" :value="alias">{{ alias }}</option>
            </select>
            <button type="button" class="ghost" @click="addAlias">Add alias</button>
          </div>
          <div class="alias-input" v-if="showAliasInput">
            <input
              v-model="newAlias"
              type="email"
              placeholder="alias@example.com"
              autocomplete="off"
            />
            <button type="button" class="primary" @click="saveAlias" :disabled="aliasSaving">
              {{ aliasSaving ? 'Saving...' : 'Save alias' }}
            </button>
            <button type="button" class="ghost" @click="cancelAlias" :disabled="aliasSaving">Cancel</button>
          </div>
          <div class="alias-chips" v-if="aliases.length">
            <span class="chip" v-for="alias in aliases" :key="alias">
              {{ alias }}
              <button type="button" @click="removeAlias(alias)" :disabled="aliasSaving">×</button>
            </span>
          </div>
          <p class="hint">Aliases must be verified in Gmail “Send mail as”.</p>
        </div>

        <div class="field">
          <label for="toEmail">Recipient</label>
          <input id="toEmail" v-model="form.toEmail" type="email" required />
        </div>

        <div class="field">
          <label for="subject">Subject</label>
          <input id="subject" v-model="form.subject" type="text" required />
        </div>

        <div class="field">
          <label for="html">Message (HTML)</label>
          <textarea id="html" v-model="form.html" rows="8" required></textarea>
        </div>

        <button class="primary" type="submit" :disabled="loading">
          <span v-if="loading">Sending...</span>
          <span v-else>Send Email</span>
        </button>
      </form>

      <p v-if="error" class="status error">{{ error }}</p>
      <p v-if="success" class="status success">{{ success }}</p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const route = useRoute()

const form = reactive({
  authEmail: userStore.email || '',
  fromEmail: userStore.email || '',
  appPassword: '',
  toEmail: '',
  subject: '',
  html: '<p>Hello from Vegvisr!</p>',
})

const loading = ref(false)
const error = ref('')
const success = ref('')
const aliasSaving = ref(false)
const showAliasInput = ref(false)
const newAlias = ref('')
const aliases = ref([])
const userData = ref(null)
const savePassword = ref(false)
const sharedGraphId = ref('')
const sharedGraphTitle = ref('')
const sharedGraphSlug = ref('')
const sharedGraphUrl = ref('')
const sharedGraphMessage = ref('')
const sharedGraphError = ref('')
const sharedGraphLoading = ref(false)
const sharedGraphReady = ref(false)

const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'https://dashboard.vegvisr.org'

onMounted(() => {
  loadUserData()
  initializeSharedGraph()
})

async function loadUserData() {
  if (!userStore.email) return
  try {
    const res = await fetch(`${dashboardBase}/userdata?email=${encodeURIComponent(userStore.email)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load user data')
    userData.value = data
    const storedAliases = data.data?.settings?.emailAliases || []
    aliases.value = Array.isArray(storedAliases) ? storedAliases : []
    if (!form.fromEmail && form.authEmail) form.fromEmail = form.authEmail
  } catch (err) {
    console.error('loadUserData error', err)
  }
}

function addAlias() {
  showAliasInput.value = true
  newAlias.value = ''
}

function cancelAlias() {
  showAliasInput.value = false
  newAlias.value = ''
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function saveAlias() {
  if (!newAlias.value || !validateEmail(newAlias.value)) {
    error.value = 'Enter a valid alias email.'
    return
  }
  const cleaned = newAlias.value.trim().toLowerCase()
  if (aliases.value.includes(cleaned)) {
    error.value = 'Alias already added.'
    return
  }
  error.value = ''
  aliasSaving.value = true
  try {
    const updated = [...aliases.value, cleaned]
    await persistAliases(updated)
    aliases.value = updated
    form.fromEmail = cleaned
    success.value = 'Alias saved.'
    showAliasInput.value = false
    newAlias.value = ''
  } catch (err) {
    console.error('saveAlias error', err)
    error.value = err.message || 'Failed to save alias'
  } finally {
    aliasSaving.value = false
  }
}

async function removeAlias(alias) {
  aliasSaving.value = true
  try {
    const updated = aliases.value.filter((a) => a !== alias)
    await persistAliases(updated)
    aliases.value = updated
    if (form.fromEmail === alias) {
      form.fromEmail = form.authEmail
    }
  } catch (err) {
    console.error('removeAlias error', err)
    error.value = err.message || 'Failed to update aliases'
  } finally {
    aliasSaving.value = false
  }
}

async function persistAliases(updatedAliases) {
  if (!userStore.email) throw new Error('User email missing')
  const current = userData.value?.data || {}
  const merged = {
    ...current,
    settings: {
      ...(current.settings || {}),
      emailAliases: updatedAliases,
    },
  }
  const payload = {
    email: userStore.email,
    data: merged,
    profileimage: userData.value?.profileimage || '',
  }
  const res = await fetch(`${dashboardBase}/userdata`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok || result.error) {
    throw new Error(result.error || 'Failed to save aliases')
  }
  userData.value = { ...(userData.value || {}), data: merged }
}

function getQueryValue(key) {
  const value = route.query[key]
  if (Array.isArray(value)) return value[0]
  return typeof value === 'string' ? value : ''
}

function toSeoSlug(text, fallback) {
  const base = (text || fallback || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return base || fallback || ''
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripTrailingUrl(value) {
  return value.replace(/\n?\s*https?:\/\/\S+\s*$/i, '').trim()
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>')
}

async function fetchGraph(graphId) {
  const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${encodeURIComponent(graphId)}`)
  if (!response.ok) {
    throw new Error(`Failed to load graph ${graphId} (${response.status})`)
  }
  const data = await response.json()
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      throw new Error('Invalid graph payload')
    }
  }
  return data
}

async function saveSlugToGraphMetadata(graphId, graphData, slug) {
  const updatedMetadata = {
    ...graphData.metadata,
    seoSlug: slug,
    publicationState: 'published',
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const updatedGraphData = {
    ...graphData,
    metadata: updatedMetadata,
  }

  const response = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: graphId,
      graphData: updatedGraphData,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update graph metadata: ${response.status}`)
  }

  return updatedGraphData
}

function applySharedContent(rawContent, shareUrl, title) {
  const cleanedContent = rawContent ? stripTrailingUrl(rawContent) : ''
  const messageText = cleanedContent || `Check out this knowledge graph: ${title}`
  const textPayload = `${messageText}\n\n${shareUrl}`
  form.subject = `Knowledge Graph: ${title}`
  form.html = textToHtml(textPayload)
}

async function initializeSharedGraph() {
  const graphId = getQueryValue('graphId')
  const rawContent = getQueryValue('content')
  const rawUrl = getQueryValue('url')

  if (!graphId) {
    if (rawContent) {
      form.html = textToHtml(rawContent)
    } else if (rawUrl) {
      form.html = textToHtml(`Check out this knowledge graph:\n\n${rawUrl}`)
    }
    return
  }

  sharedGraphId.value = graphId
  sharedGraphLoading.value = true
  sharedGraphError.value = ''
  sharedGraphMessage.value = 'Checking for an SEO slug on this graph...'

  try {
    const graphData = await fetchGraph(graphId)
    sharedGraphTitle.value = graphData.metadata?.title || graphData.title || 'Untitled Graph'

    const seoSlug = graphData.metadata?.seoSlug
    if (!seoSlug) {
      sharedGraphError.value = 'SEO slug missing. Generate an SEO page before emailing.'
      return
    }

    sharedGraphMessage.value = 'SEO slug found.'

    sharedGraphSlug.value = seoSlug
    // Use current domain dynamically (universi.no, vegvisr.org, etc.)
    sharedGraphUrl.value = `${window.location.origin}/graph/${seoSlug}`
    sharedGraphReady.value = true
    applySharedContent(rawContent, sharedGraphUrl.value, sharedGraphTitle.value)
  } catch (err) {
    console.error('initializeSharedGraph error', err)
    sharedGraphError.value = err.message || 'Failed to check SEO slug'
  } finally {
    sharedGraphLoading.value = false
  }
}

async function sendEmail() {
  error.value = ''
  success.value = ''

  if (sharedGraphId.value && !sharedGraphReady.value) {
    error.value = sharedGraphError.value || 'SEO slug missing. Generate an SEO page first.'
    return
  }

  if (!form.authEmail || !form.fromEmail || !form.toEmail || !form.subject || !form.html) {
    error.value = 'All fields are required.'
    return
  }

  if (savePassword.value && !form.appPassword) {
    error.value = 'Provide the app password to save it.'
    return
  }

  loading.value = true
  try {
    const response = await fetch(`${dashboardBase}/send-gmail-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authEmail: form.authEmail,
        senderEmail: form.authEmail,
        fromEmail: form.fromEmail,
        appPassword: form.appPassword,
        savePassword: savePassword.value,
        email: userStore.email,
        toEmail: form.toEmail,
        subject: form.subject,
        html: form.html,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data.success) {
      error.value = data.error || `Failed with status ${response.status}`
      return
    }

    success.value = 'Email sent successfully.'
    if (savePassword.value && form.appPassword) {
      form.appPassword = ''
      savePassword.value = false
    }
  } catch (err) {
    console.error('sendEmail error', err)
    error.value = err.message || 'Unexpected error'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.card {
  width: min(960px, 100%);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
}

h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.muted {
  color: #6b7280;
  margin-bottom: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

label {
  font-weight: 600;
  color: #111827;
}

input,
textarea {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.1s ease;
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary:not(:disabled):hover {
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.status {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 600;
}

.status.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecdd3;
}

.status.success {
  background: #ecfdf3;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status.info {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.hint {
  color: #6b7280;
  font-size: 12px;
  margin: 0;
}

.from-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

select {
  min-width: 260px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
}

.ghost {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
}

.alias-input {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.alias-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  font-size: 13px;
}

.chip button {
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
}

.share-panel {
  border: 1px solid #e0e7ff;
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.share-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.share-panel h2 {
  margin: 0;
  font-size: 18px;
}

.share-panel-subtitle {
  margin: 6px 0 16px;
  color: #475569;
}

.share-panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.value {
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.value.mono {
  font-family: 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.badge.info {
  background: #e0f2fe;
  color: #0369a1;
}

.badge.success {
  background: #dcfce7;
  color: #15803d;
}

.badge.danger {
  background: #fee2e2;
  color: #b91c1c;
}
</style>
