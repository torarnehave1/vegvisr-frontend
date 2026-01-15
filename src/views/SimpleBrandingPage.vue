<template>
  <div class="simple-branding-page">
    <div class="container py-4">
      <h1>Brand Settings</h1>
      <p class="text-muted">Configure your domain branding. Changes save directly to KV storage.</p>

      <!-- DEV MODE TOGGLE -->
      <div class="alert alert-warning mb-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" v-model="devMode" id="devModeCheck">
          <label class="form-check-label" for="devModeCheck">
            <strong>DEV MODE</strong> - Bypass login, use test email
          </label>
        </div>
        <div v-if="devMode" class="mt-2">
          <input v-model="testEmail" type="text" class="form-control form-control-sm" placeholder="Test email for owner field" />
          <small>Using: {{ effectiveEmail }}</small>
        </div>
      </div>

      <!-- Status Messages -->
      <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
        {{ message }}
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border" role="status"></div>
        <p class="mt-2">Loading...</p>
      </div>

      <!-- Main Form -->
      <div v-else class="card">
        <div class="card-body">
          <!-- Domain -->
          <div class="mb-3">
            <label class="form-label fw-bold">Domain *</label>
            <input
              v-model="form.domain"
              type="text"
              class="form-control"
              placeholder="example.com"
              :disabled="isEditing"
            />
            <small class="text-muted">Your website domain (cannot be changed after creation)</small>
          </div>

          <!-- Logo URL -->
          <div class="mb-3">
            <label class="form-label fw-bold">Logo URL</label>
            <div class="input-group">
              <input
                v-model="form.logo"
                type="text"
                class="form-control"
                placeholder="https://example.com/logo.png"
              />
              <button
                class="btn btn-outline-secondary"
                type="button"
                @click="openImageSelector('logo')"
                title="Select or upload logo"
              >
                Select
              </button>
            </div>
            <div v-if="form.logo" class="mt-2">
              <img :src="form.logo" alt="Logo preview" style="max-height: 60px;" @error="logoError = true" />
            </div>
          </div>

          <!-- Mobile App Logo -->
          <div class="mb-3">
            <label class="form-label fw-bold">Mobile App Logo URL</label>
            <div class="input-group">
              <input
                v-model="form.mobileAppLogo"
                type="text"
                class="form-control"
                placeholder="https://example.com/mobile-logo.png"
              />
              <button
                class="btn btn-outline-secondary"
                type="button"
                @click="openImageSelector('mobile')"
                title="Select or upload mobile logo"
              >
                Select
              </button>
            </div>
            <small class="text-muted">Special logo for mobile app (shown with "Powered by Vegvisr")</small>
            <div v-if="form.mobileAppLogo" class="mt-2">
              <img :src="form.mobileAppLogo" alt="Mobile logo preview" style="max-height: 60px;" />
            </div>
          </div>

          <!-- Mobile App Title -->
          <div class="mb-3">
            <label class="form-label fw-bold">Mobile App Title</label>
            <input
              v-model="form.mobileAppTitle"
              type="text"
              class="form-control"
              placeholder="Your Brand Name"
            />
            <small class="text-muted">Replaces "HALLO VEGVISR" in the mobile app (leave empty for default)</small>
          </div>

          <!-- Slogan -->
          <div class="mb-3">
            <label class="form-label fw-bold">Slogan / Tagline</label>
            <input
              v-model="form.slogan"
              type="text"
              class="form-control"
              placeholder="Your brand tagline"
            />
            <small class="text-muted">Displayed below the title in mobile app</small>
          </div>

          <!-- Content Filter -->
          <div class="mb-3">
            <label class="form-label fw-bold">Content Filter</label>
            <select v-model="form.contentFilter" class="form-select">
              <option value="none">None - Show all content</option>
              <option value="custom">Custom - Filter by categories</option>
            </select>
          </div>

          <!-- Categories (if custom filter) -->
          <div v-if="form.contentFilter === 'custom'" class="mb-3">
            <label class="form-label fw-bold">Categories</label>
            <input
              v-model="categoriesInput"
              type="text"
              class="form-control"
              placeholder="CATEGORY1, CATEGORY2"
            />
            <small class="text-muted">Comma-separated list of content categories</small>
          </div>

          <!-- Front Page Graph ID -->
          <div class="mb-3">
            <label class="form-label fw-bold">Front Page Graph ID</label>
            <input
              v-model="form.mySiteFrontPage"
              type="text"
              class="form-control"
              placeholder="graph_123456789"
            />
            <small class="text-muted">Knowledge graph to show as front page</small>
          </div>

          <!-- Debug: Show what will be saved -->
          <div class="mb-4 p-3 bg-warning border rounded">
            <h6 class="mb-2">PAYLOAD TO SAVE:</h6>
            <textarea
              readonly
              class="form-control"
              style="font-family: monospace; font-size: 11px; height: 150px;"
              :value="JSON.stringify(getKVPayload(), null, 2)"
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="d-flex gap-2 mb-4">
            <button
              @click="saveBranding"
              class="btn btn-primary btn-lg"
              :disabled="isSaving || !form.domain"
            >
              <span v-if="isSaving">Saving...</span>
              <span v-else>SAVE TO KV</span>
            </button>
            <button @click="loadBranding" class="btn btn-secondary btn-lg" :disabled="!form.domain">
              LOAD FROM KV
            </button>
          </div>

          <!-- KV READ RESULT - Always visible, copyable -->
          <div class="p-3 bg-info text-dark border rounded">
            <h6 class="mb-2">KV READ RESULT (click Load to populate):</h6>
            <textarea
              readonly
              class="form-control"
              style="font-family: monospace; font-size: 11px; height: 200px; background: white;"
              :value="kvReadResult"
              placeholder="Click 'LOAD FROM KV' to see what is stored..."
            ></textarea>
            <div class="mt-2">
              <strong>Slogan in KV:</strong> <code>{{ kvSlogan }}</code><br>
              <strong>MobileAppLogo in KV:</strong> <code>{{ kvMobileAppLogo }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Phone Mappings Section -->
      <div v-if="form.domain" class="card mt-4">
        <div class="card-header">
          <h5 class="mb-0">Phone Mappings</h5>
        </div>
        <div class="card-body">
          <p class="text-muted">Link phone numbers to this domain for mobile app branding.</p>

          <!-- Add Phone -->
          <div class="input-group mb-3">
            <input
              v-model="newPhone"
              type="text"
              class="form-control"
              placeholder="+1234567890"
            />
            <button @click="addPhone" class="btn btn-success" :disabled="!newPhone">
              Add Phone
            </button>
          </div>

          <!-- Phone List -->
          <div v-if="phones.length > 0">
            <div v-for="phone in phones" :key="phone" class="d-flex justify-content-between align-items-center p-2 border-bottom">
              <span>{{ phone }}</span>
              <button @click="removePhone(phone)" class="btn btn-sm btn-outline-danger">Remove</button>
            </div>
          </div>
          <div v-else class="text-muted">No phone mappings yet.</div>
        </div>
      </div>

      <!-- Quick Domain Selector -->
      <div class="card mt-4">
        <div class="card-header">
          <h5 class="mb-0">Your Domains</h5>
        </div>
        <div class="card-body">
          <div v-if="userDomains.length > 0" class="list-group">
            <button
              v-for="d in userDomains"
              :key="d"
              @click="selectDomain(d)"
              :class="['list-group-item', 'list-group-item-action', form.domain === d ? 'active' : '']"
            >
              {{ d }}
            </button>
          </div>
          <div v-else class="text-muted">No domains found. Enter a domain above to create one.</div>
        </div>
      </div>
    </div>

    <ImageSelector
      :is-open="isImageSelectorOpen"
      :current-image-url="imageSelectorData.url"
      :current-image-alt="imageSelectorData.alt"
      :image-type="imageSelectorData.type"
      :image-context="imageSelectorData.context"
      :node-content="imageSelectorData.nodeContent"
      :graph-context="imageSelectorData.graphContext"
      @close="closeImageSelector"
      @image-replaced="handleImageReplaced"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { API_CONFIG } from '@/config/api'
import ImageSelector from '@/components/ImageSelector.vue'

const userStore = useUserStore()
const BASE_URL = API_CONFIG.baseUrl

// State
const isLoading = ref(false)
const isSaving = ref(false)
const message = ref('')
const messageType = ref('success')
const isEditing = ref(false)
const logoError = ref(false)
const userDomains = ref([])
const phones = ref([])
const newPhone = ref('')
const isImageSelectorOpen = ref(false)
const imageSelectorTarget = ref('logo')

// KV Read Result - for display
const kvReadResult = ref('')
const kvSlogan = ref('(not loaded)')
const kvMobileAppLogo = ref('(not loaded)')

// DEV MODE - bypass login
const devMode = ref(true) // Default ON for local dev
const testEmail = ref('torarnehave@gmail.com')
const effectiveEmail = computed(() => devMode.value ? testEmail.value : userStore.email)

// Form data - flat structure matching what we send to KV
const form = ref({
  domain: '',
  logo: '',
  mobileAppLogo: '',
  mobileAppTitle: '',
  slogan: '',
  contentFilter: 'none',
  selectedCategories: [],
  mySiteFrontPage: ''
})

// Categories as comma-separated string for easy editing
const categoriesInput = computed({
  get: () => form.value.selectedCategories.join(', '),
  set: (val) => {
    form.value.selectedCategories = val.split(',').map(s => s.trim()).filter(Boolean)
  }
})

// Build the exact payload that goes to KV
function getKVPayload() {
  return {
    domain: form.value.domain,
    owner: effectiveEmail.value,
    branding: {
      myLogo: form.value.logo || '',
      mobileAppLogo: form.value.mobileAppLogo || '',
      mobileAppTitle: form.value.mobileAppTitle || '',
      slogan: form.value.slogan || '',
      contentFilter: form.value.contentFilter,
      selectedCategories: form.value.selectedCategories || [],
      mySiteFrontPage: form.value.mySiteFrontPage || '',
      site_title: getDomainTitle(form.value.domain)
    },
    contentFilter: {
      metaAreas: form.value.selectedCategories || []
    }
  }
}

function getDomainTitle(domain) {
  if (!domain) return 'Your Brand'
  const parts = domain.split('.')
  const main = parts[0] === 'www' ? parts[1] : parts[0]
  return main.charAt(0).toUpperCase() + main.slice(1)
}

function showMessage(msg, type = 'success') {
  message.value = msg
  messageType.value = type
  setTimeout(() => { message.value = '' }, 5000)
}

const imageSelectorData = computed(() => {
  const target = imageSelectorTarget.value
  const isMobile = target === 'mobile'
  const url = isMobile ? form.value.mobileAppLogo : form.value.logo
  const label = isMobile ? 'Mobile App Logo' : 'Logo'

  return {
    url: url || '',
    alt: label,
    type: isMobile ? 'mobile-logo' : 'logo',
    context: 'branding',
    nodeContent: '',
    graphContext: { type: 'logo' },
  }
})

function openImageSelector(target) {
  imageSelectorTarget.value = target
  isImageSelectorOpen.value = true
}

function closeImageSelector() {
  isImageSelectorOpen.value = false
}

function handleImageReplaced(payload) {
  const newUrl = payload?.newUrl ? String(payload.newUrl) : ''
  if (imageSelectorTarget.value === 'mobile') {
    form.value.mobileAppLogo = newUrl
  } else {
    form.value.logo = newUrl
  }
  closeImageSelector()
}

// Load branding from KV
async function loadBranding() {
  if (!form.value.domain) return

  isLoading.value = true
  try {
    const url = `${BASE_URL}/site-config/${form.value.domain}`
    console.log('Loading from:', url)

    const response = await fetch(url)
    const data = await response.json()

    // ALWAYS show what KV returned - copyable
    kvReadResult.value = JSON.stringify(data, null, 2)
    kvSlogan.value = data.branding?.slogan || '(empty)'
    kvMobileAppLogo.value = data.branding?.mobileAppLogo || '(empty)'

    if (response.ok) {
      console.log('Loaded KV data:', data)

      // Map KV format to form format
      form.value.logo = data.branding?.myLogo || ''
      form.value.mobileAppLogo = data.branding?.mobileAppLogo || ''
      form.value.mobileAppTitle = data.branding?.mobileAppTitle || ''
      form.value.slogan = data.branding?.slogan || ''
      form.value.contentFilter = data.branding?.contentFilter || 'none'
      form.value.selectedCategories = data.branding?.selectedCategories || []
      form.value.mySiteFrontPage = data.branding?.mySiteFrontPage || ''

      isEditing.value = true
      showMessage('Loaded from KV - see result below')
    } else if (response.status === 404) {
      kvReadResult.value = JSON.stringify({ error: 'Not found', status: 404 }, null, 2)
      showMessage('Domain not found in KV', 'danger')
      isEditing.value = false
    } else {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    console.error('Load error:', error)
    kvReadResult.value = JSON.stringify({ error: error.message }, null, 2)
    showMessage(`Failed to load: ${error.message}`, 'danger')
  } finally {
    isLoading.value = false
  }
}

// Save branding to KV
async function saveBranding() {
  if (!form.value.domain) {
    showMessage('Domain is required', 'danger')
    return
  }

  isSaving.value = true
  try {
    const payload = getKVPayload()
    console.log('Saving to KV:', JSON.stringify(payload, null, 2))

    const url = `${BASE_URL}/site-config`
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await response.json()
    console.log('Save response:', result)

    if (response.ok && result.success) {
      showMessage(`SAVED! Now click LOAD FROM KV to verify.`)
      isEditing.value = true

      // Auto-reload to show what's actually in KV
      setTimeout(() => loadBranding(), 500)
    } else {
      throw new Error(result.error || 'Save failed')
    }
  } catch (error) {
    console.error('Save error:', error)
    showMessage(`Failed to save: ${error.message}`, 'danger')
  } finally {
    isSaving.value = false
  }
}

// Load user's domains
async function loadUserDomains() {
  const email = effectiveEmail.value
  if (!email) return

  try {
    const url = `${BASE_URL}/domains/list?email=${encodeURIComponent(email)}`
    const response = await fetch(url)

    if (response.ok) {
      const data = await response.json()
      if (data.success && data.domains) {
        userDomains.value = data.domains.map(d => d.domain)
      }
    }
  } catch (error) {
    console.error('Failed to load domains:', error)
  }

  // Always include core Vegvisr domains for branding management.
  const coreDomains = ['vegvisr.org', 'www.vegvisr.org']
  coreDomains.forEach((domain) => {
    if (!userDomains.value.includes(domain)) {
      userDomains.value.push(domain)
    }
  })
}

// Select a domain from the list
function selectDomain(domain) {
  form.value.domain = domain
  loadBranding()
  loadPhones()
}

// Phone mapping functions
async function loadPhones() {
  if (!form.value.domain) return

  try {
    const url = `${BASE_URL}/phone-mappings?domain=${encodeURIComponent(form.value.domain)}`
    const response = await fetch(url)

    if (response.ok) {
      const data = await response.json()
      phones.value = data.mappings?.map(m => m.phone) || []
    }
  } catch (error) {
    console.error('Failed to load phones:', error)
  }
}

async function addPhone() {
  if (!newPhone.value || !form.value.domain) return

  try {
    const url = `${BASE_URL}/phone-mapping`
    const response = await fetch(url, {
      method: 'PUT',  // Worker expects PUT, not POST
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: newPhone.value,
        domain: form.value.domain,
        ownerEmail: effectiveEmail.value  // Required by worker
      })
    })

    const result = await response.json()
    if (response.ok && result.success) {
      phones.value.push(result.phone || newPhone.value)
      newPhone.value = ''
      showMessage('Phone added')
      loadPhones() // Refresh list
    } else {
      showMessage(`Failed: ${result.error || 'Unknown error'}`, 'danger')
    }
  } catch (error) {
    showMessage(`Failed to add phone: ${error.message}`, 'danger')
  }
}

async function removePhone(phone) {
  try {
    const url = `${BASE_URL}/phone-mapping/${encodeURIComponent(phone)}`
    const response = await fetch(url, { method: 'DELETE' })

    if (response.ok) {
      phones.value = phones.value.filter(p => p !== phone)
      showMessage('Phone removed')
    }
  } catch (error) {
    showMessage(`Failed to remove phone: ${error.message}`, 'danger')
  }
}

// Initialize
onMounted(() => {
  loadUserDomains()
})
</script>

<style scoped>
.simple-branding-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

pre {
  background: white;
  padding: 10px;
  border-radius: 4px;
  margin: 0;
}
</style>
