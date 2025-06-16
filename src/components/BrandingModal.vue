<template>
  <div v-if="isOpen" class="branding-modal-overlay">
    <div class="branding-modal">
      <div class="modal-header">
        <h2>🎨 Custom Domain Branding Setup</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <div class="modal-content">
        <!-- Step Indicator -->
        <div class="step-indicator">
          <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
            <div class="step-number">1</div>
            <div class="step-label">Domain & Logo</div>
          </div>
          <div class="step-divider"></div>
          <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
            <div class="step-number">2</div>
            <div class="step-label">Preview</div>
          </div>
          <div class="step-divider"></div>
          <div class="step" :class="{ active: currentStep === 3 }">
            <div class="step-number">3</div>
            <div class="step-label">Deployment</div>
          </div>
        </div>

        <!-- Step 1: Domain & Logo Configuration -->
        <div v-if="currentStep === 1" class="step-content">
          <h3>Configure Your Custom Domain</h3>
          <p class="step-description">
            Set up your custom domain and branding to create a personalized experience for your
            users.
          </p>

          <div class="form-group">
            <label for="customDomain" class="form-label">
              <strong>Custom Domain:</strong>
            </label>
            <input
              id="customDomain"
              v-model="formData.domain"
              type="text"
              class="form-control"
              placeholder="e.g., mybrand.example.com"
              @input="validateDomain"
            />
            <div class="form-text">
              Enter your custom domain name. This should be a subdomain you control.
            </div>
            <div v-if="domainError" class="error-message">{{ domainError }}</div>
          </div>

          <div class="form-group">
            <label for="customLogo" class="form-label">
              <strong>Logo URL:</strong>
            </label>
            <input
              id="customLogo"
              v-model="formData.logo"
              type="url"
              class="form-control"
              placeholder="https://example.com/logo.png"
              @input="validateLogo"
            />
            <div class="form-text">
              URL to your logo image. Recommended size: 200x80px or similar aspect ratio.
            </div>
            <div v-if="logoError" class="error-message">{{ logoError }}</div>
          </div>

          <!-- Logo Preview -->
          <div v-if="formData.logo && !logoError" class="logo-preview">
            <label class="form-label"><strong>Logo Preview:</strong></label>
            <div class="preview-container">
              <img
                :src="formData.logo"
                alt="Logo Preview"
                class="logo-preview-img"
                @error="handleLogoError"
                @load="handleLogoLoad"
              />
            </div>
          </div>

          <!-- Content Filtering Options -->
          <div class="form-group">
            <label class="form-label">
              <strong>Content Filtering:</strong>
            </label>
            <div class="filter-options">
              <div class="filter-option">
                <input
                  id="filterNone"
                  v-model="formData.contentFilter"
                  type="radio"
                  value="none"
                  class="form-check-input"
                />
                <label for="filterNone" class="form-check-label">
                  No filtering - Show all content
                </label>
              </div>
              <div class="filter-option">
                <input
                  id="filterNorse"
                  v-model="formData.contentFilter"
                  type="radio"
                  value="norse"
                  class="form-check-input"
                />
                <label for="filterNorse" class="form-check-label">
                  Norse Mythology only (like sweet.norsegong.com)
                </label>
              </div>
              <div class="filter-option">
                <input
                  id="filterCustom"
                  v-model="formData.contentFilter"
                  type="radio"
                  value="custom"
                  class="form-check-input"
                />
                <label for="filterCustom" class="form-check-label">
                  Custom filtering (contact support)
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Preview -->
        <div v-if="currentStep === 2" class="step-content">
          <h3>Preview Your Branding</h3>
          <p class="step-description">See how your custom domain will look to users.</p>

          <div class="preview-section">
            <div class="browser-mockup">
              <div class="browser-bar">
                <div class="browser-buttons">
                  <span class="browser-button red"></span>
                  <span class="browser-button yellow"></span>
                  <span class="browser-button green"></span>
                </div>
                <div class="browser-url">{{ formData.domain || 'your-domain.com' }}</div>
              </div>
              <div class="browser-content">
                <header class="mockup-header">
                  <img v-if="formData.logo" :src="formData.logo" alt="Logo" class="mockup-logo" />
                  <div v-else class="mockup-logo-placeholder">Your Logo</div>
                  <h1 class="mockup-title">{{ getDomainTitle() }}</h1>
                </header>
                <div class="mockup-content">
                  <div class="mockup-nav">Knowledge Graphs | Dashboard | Profile</div>
                  <div class="mockup-graph">
                    <div class="mockup-node">Sample Knowledge Graph</div>
                    <div class="mockup-node">Custom Branded Content</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="preview-details">
            <h4>Configuration Summary:</h4>
            <ul>
              <li><strong>Domain:</strong> {{ formData.domain || 'Not set' }}</li>
              <li><strong>Logo:</strong> {{ formData.logo ? 'Configured' : 'Not set' }}</li>
              <li>
                <strong>Content Filter:</strong>
                {{
                  formData.contentFilter === 'none'
                    ? 'All content'
                    : formData.contentFilter === 'norse'
                      ? 'Norse Mythology only'
                      : 'Custom filtering'
                }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Step 3: Deployment Instructions -->
        <div v-if="currentStep === 3" class="step-content">
          <h3>Deployment Instructions</h3>
          <p class="step-description">Follow these steps to deploy your custom domain.</p>

          <div class="deployment-steps">
            <div class="deployment-step">
              <div class="step-number-small">1</div>
              <div class="step-content-small">
                <h4>Update Your DNS</h4>
                <p>Create a CNAME record pointing your domain to Cloudflare Workers:</p>
                <div class="code-block">
                  <code>
                    Type: CNAME<br />
                    Name: {{ getDomainSubdomain() }}<br />
                    Value: your-worker.your-subdomain.workers.dev
                  </code>
                </div>
              </div>
            </div>

            <div class="deployment-step">
              <div class="step-number-small">2</div>
              <div class="step-content-small">
                <h4>Deploy Proxy Worker</h4>
                <p>Copy and deploy this worker script to your Cloudflare Workers:</p>
                <div class="code-block">
                  <code>{{ generateWorkerCode() }}</code>
                  <button @click="copyWorkerCode" class="copy-btn">Copy Code</button>
                </div>
              </div>
            </div>

            <div class="deployment-step">
              <div class="step-number-small">3</div>
              <div class="step-content-small">
                <h4>Test Your Domain</h4>
                <p>After deployment, test your custom domain:</p>
                <ul>
                  <li>Visit {{ formData.domain || 'your-domain.com' }}</li>
                  <li>Verify your logo and branding appear</li>
                  <li>Test knowledge graph functionality</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="deployment-notice">
            <div class="notice-icon">💡</div>
            <div class="notice-content">
              <strong>Need Help?</strong> Contact support for assistance with DNS configuration or
              worker deployment.
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button v-if="currentStep > 1" @click="previousStep" class="btn btn-secondary">
          Previous
        </button>
        <button
          v-if="currentStep < 3"
          @click="nextStep"
          :disabled="!canProceed()"
          class="btn btn-primary"
        >
          Next
        </button>
        <button v-if="currentStep === 3" @click="saveBranding" class="btn btn-success">
          Save & Deploy
        </button>
        <button @click="closeModal" class="btn btn-outline-secondary">
          {{ currentStep === 3 ? 'Close' : 'Cancel' }}
        </button>
      </div>

      <!-- Loading Overlay -->
      <div v-if="isSaving" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p>Saving your branding configuration...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore'
import { apiUrls } from '@/config/api'

export default {
  name: 'BrandingModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'saved'],
  data() {
    return {
      currentStep: 1,
      isSaving: false,
      formData: {
        domain: '',
        logo: '',
        contentFilter: 'none',
      },
      domainError: '',
      logoError: '',
      logoLoaded: false,
    }
  },
  setup() {
    const userStore = useUserStore()
    return { userStore }
  },
  mounted() {
    this.loadExistingBranding()
  },
  methods: {
    async loadExistingBranding() {
      if (this.userStore.branding) {
        this.formData.domain = this.userStore.branding.mySite || ''
        this.formData.logo = this.userStore.branding.myLogo || ''
        // Determine content filter based on domain
        if (this.formData.domain === 'sweet.norsegong.com') {
          this.formData.contentFilter = 'norse'
        }
      }
    },
    validateDomain() {
      this.domainError = ''
      if (this.formData.domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/
        if (!domainRegex.test(this.formData.domain)) {
          this.domainError = 'Please enter a valid domain name'
        }
      }
    },
    validateLogo() {
      this.logoError = ''
      if (this.formData.logo) {
        try {
          new URL(this.formData.logo)
        } catch {
          this.logoError = 'Please enter a valid URL'
        }
      }
    },
    handleLogoError() {
      this.logoError = 'Unable to load image from this URL'
      this.logoLoaded = false
    },
    handleLogoLoad() {
      this.logoError = ''
      this.logoLoaded = true
    },
    getDomainTitle() {
      if (!this.formData.domain) return 'Your Brand'
      if (this.formData.domain === 'sweet.norsegong.com') return 'Sweet NorseGong'
      const parts = this.formData.domain.split('.')
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    },
    getDomainSubdomain() {
      if (!this.formData.domain) return 'your-subdomain'
      return this.formData.domain.split('.')[0]
    },
    generateWorkerCode() {
      return `export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const hostname = url.hostname

    let targetUrl
    if (
      url.pathname.startsWith('/getknowgraphs') ||
      url.pathname.startsWith('/getknowgraph') ||
      url.pathname.startsWith('/saveknowgraph') ||
      url.pathname.startsWith('/updateknowgraph') ||
      url.pathname.startsWith('/deleteknowgraph') ||
      url.pathname.startsWith('/saveGraphWithHistory')
    ) {
      targetUrl = 'https://knowledge-graph-worker.torarnehave.workers.dev' + url.pathname + url.search
    } else if (
      url.pathname.startsWith('/mystmkrasave') ||
      url.pathname.startsWith('/generate-header-image') ||
      url.pathname.startsWith('/grok-ask') ||
      url.pathname.startsWith('/grok-elaborate') ||
      url.pathname.startsWith('/apply-style-template')
    ) {
      targetUrl = 'https://api.vegvisr.org' + url.pathname + url.search
    } else {
      targetUrl = 'https://www.vegvisr.org' + url.pathname + url.search
    }

    const headers = new Headers(request.headers)
    headers.set('x-original-hostname', hostname)

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow',
    })

    return new Response(response.body, response)
  },
}`
    },
    async copyWorkerCode() {
      try {
        await navigator.clipboard.writeText(this.generateWorkerCode())
        this.$emit('saved', 'Worker code copied to clipboard!')
      } catch (error) {
        console.error('Failed to copy worker code:', error)
      }
    },
    canProceed() {
      if (this.currentStep === 1) {
        return (
          this.formData.domain && !this.domainError && (this.formData.logo ? !this.logoError : true)
        )
      }
      return true
    },
    nextStep() {
      if (this.canProceed() && this.currentStep < 3) {
        this.currentStep++
      }
    },
    previousStep() {
      if (this.currentStep > 1) {
        this.currentStep--
      }
    },
    async saveBranding() {
      this.isSaving = true

      try {
        const brandingData = {
          mySite: this.formData.domain,
          myLogo: this.formData.logo,
        }

        // Determine content filter
        let metaAreas = []
        if (this.formData.contentFilter === 'norse') {
          metaAreas = ['NORSEGONG', 'NORSEMYTHOLOGY']
        }

        const payload = {
          email: this.userStore.email,
          bio: '', // Preserve existing bio
          profileimage: '', // Preserve existing profile image
          data: {
            profile: {
              user_id: this.userStore.user_id,
              email: this.userStore.email,
              mystmkraUserId: this.userStore.mystmkraUserId || '',
            },
            settings: this.userStore.settings || { notifications: true, theme: 'light' },
            branding: brandingData,
          },
        }

        const response = await fetch(apiUrls.updateUserData(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          throw new Error('Failed to save branding configuration')
        }

        // Update user store
        this.userStore.setBranding(brandingData)

        this.$emit('saved', 'Branding configuration saved successfully!')
        this.closeModal()
      } catch (error) {
        console.error('Error saving branding:', error)
        this.$emit('saved', `Error: ${error.message}`)
      } finally {
        this.isSaving = false
      }
    },
    closeModal() {
      this.currentStep = 1
      this.$emit('close')
    },
  },
}
</script>

<style scoped>
.branding-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.branding-modal {
  background: #fff;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 30px 20px;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.modal-content {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e9ecef;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: #007bff;
  color: white;
}

.step.completed .step-number {
  background: #28a745;
  color: white;
}

.step-label {
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 500;
}

.step.active .step-label {
  color: #007bff;
  font-weight: 600;
}

.step.completed .step-label {
  color: #28a745;
}

.step-divider {
  width: 80px;
  height: 2px;
  background: #e9ecef;
  margin: 0 20px 20px;
}

.step-content h3 {
  color: #333;
  margin-bottom: 12px;
  font-size: 1.3rem;
}

.step-description {
  color: #666;
  margin-bottom: 30px;
  font-size: 1rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 25px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-size: 0.95rem;
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-text {
  margin-top: 6px;
  font-size: 0.85rem;
  color: #6c757d;
}

.error-message {
  margin-top: 6px;
  color: #dc3545;
  font-size: 0.85rem;
  font-weight: 500;
}

.logo-preview {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.logo-preview-img {
  max-width: 200px;
  max-height: 80px;
  object-fit: contain;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-check-input {
  margin: 0;
}

.form-check-label {
  margin: 0;
  cursor: pointer;
  font-size: 0.95rem;
}

.browser-mockup {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.browser-bar {
  background: #f5f5f5;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #ddd;
}

.browser-buttons {
  display: flex;
  gap: 6px;
}

.browser-button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.browser-button.red {
  background: #ff5f56;
}
.browser-button.yellow {
  background: #ffbd2e;
}
.browser-button.green {
  background: #27ca3f;
}

.browser-url {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 0.85rem;
  color: #666;
  flex: 1;
}

.browser-content {
  padding: 20px;
}

.mockup-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.mockup-logo {
  width: 50px;
  height: 20px;
  object-fit: contain;
}

.mockup-logo-placeholder {
  width: 50px;
  height: 20px;
  background: #e9ecef;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  color: #6c757d;
}

.mockup-title {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.mockup-nav {
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #495057;
  margin-bottom: 15px;
}

.mockup-graph {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.mockup-node {
  background: #007bff;
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
}

.preview-details {
  margin-top: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-details h4 {
  margin-bottom: 15px;
  color: #333;
}

.preview-details ul {
  margin: 0;
  padding-left: 20px;
}

.preview-details li {
  margin-bottom: 8px;
  color: #555;
}

.deployment-steps {
  margin-bottom: 30px;
}

.deployment-step {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.step-number-small {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content-small {
  flex: 1;
}

.step-content-small h4 {
  margin-bottom: 10px;
  color: #333;
}

.step-content-small p {
  margin-bottom: 15px;
  color: #666;
  line-height: 1.5;
}

.code-block {
  background: #2d3748;
  color: #e2e8f0;
  padding: 15px;
  border-radius: 6px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  position: relative;
  overflow-x: auto;
  margin-bottom: 15px;
}

.copy-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #4a5568;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.copy-btn:hover {
  background: #2d3748;
}

.deployment-notice {
  display: flex;
  gap: 15px;
  padding: 20px;
  background: #e7f3ff;
  border-left: 4px solid #007bff;
  border-radius: 6px;
}

.notice-icon {
  font-size: 1.5rem;
}

.notice-content {
  color: #004085;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 30px;
  border-top: 2px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.95rem;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #1e7e34;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .branding-modal {
    width: 95%;
    max-height: 95vh;
  }

  .modal-header,
  .modal-content,
  .modal-footer {
    padding: 20px;
  }

  .step-indicator {
    flex-direction: column;
    gap: 10px;
  }

  .step-divider {
    width: 2px;
    height: 30px;
    margin: 10px 0;
  }

  .deployment-step {
    flex-direction: column;
    gap: 15px;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
