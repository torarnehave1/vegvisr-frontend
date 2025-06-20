<template>
  <div v-if="isStoreReady" class="container my-5">
    <!-- Title Section: full width, centered -->
    <div class="row mb-4">
      <div class="col-12 text-center">
        <h1>User Dashboard</h1>
      </div>
    </div>

    <!-- Main Content Row: Profile and Settings -->
    <div class="row">
      <!-- Profile Section -->
      <div class="col-md-7 text-center">
        <img
          :src="profileImage"
          alt="Profile Image"
          class="img-fluid rounded-circle mb-3"
          style="max-width: 150px"
        />
        <p><strong>Role:</strong> {{ userRole || 'N/A' }}</p>

        <h4>{{ email }}</h4>
        <div class="mb-3">
          <label for="bioInput" class="form-label"><strong>Your Biography:</strong></label>
          <div v-if="!editingBio && bio">
            <div v-html="renderedBio" class="text-start"></div>
            <button class="btn btn-outline-secondary btn-sm mt-2" @click="editingBio = true">
              Edit Bio
            </button>
          </div>
          <div v-else>
            <textarea
              id="bioInput"
              class="form-control"
              v-model="bio"
              rows="4"
              placeholder="E.g. I am a software developer passionate about open source and hiking."
            ></textarea>
            <div class="form-text text-start">
              Tip: Write a short biography about yourself, your interests, or your background.
              <br />
              <span class="text-muted">Markdown is supported!</span>
            </div>
            <button class="btn btn-primary btn-sm mt-2" @click="saveBio">Save</button>
            <button v-if="bio" class="btn btn-link btn-sm mt-2" @click="cancelEditBio">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Settings Section -->
      <div class="col-md-5">
        <div class="form-check form-switch mt-3">
          <input
            class="form-check-input"
            type="checkbox"
            id="notificationToggle"
            v-model="data.settings.notifications"
          />
          <label class="form-check-label" for="notificationToggle">
            Notifications: {{ data.settings.notifications ? 'On' : 'Off' }}
          </label>
        </div>

        <div class="mt-3">
          <label for="themeSelect" class="form-label"><strong>Theme:</strong></label>
          <select
            id="themeSelect"
            class="form-select"
            v-model="data.settings.theme"
            @change="applyTheme"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <!-- File Upload -->
        <div class="mt-4">
          <label for="fileInput" class="form-label">Upload Profile Image</label>
          <input type="file" id="fileInput" class="form-control" @change="onFileChange" />
        </div>

        <!-- Mystmkra Reference (moved here) -->
        <div class="mb-3 mt-4">
          <label for="mystmkraCommentLike" class="form-label"
            ><strong>Mystmkra Reference:</strong></label
          >
          <input
            type="text"
            id="mystmkraCommentLike"
            name="mystmkraCommentLike"
            class="form-control"
            v-model="newMystmkraUserId"
            placeholder="Enter your Mystmkra reference"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          />
          <div class="form-text text-start">This is your Mystmkra.io user ID for integration.</div>
          <button
            v-if="newMystmkraUserId"
            class="btn btn-primary btn-sm mt-2"
            @click="saveMystmkraUserId"
          >
            Save
          </button>
          <div v-if="mystmkraUserId" class="d-flex align-items-center mt-2">
            <span class="me-2">{{ maskedMystmkraUserId }}</span>
            <button class="btn btn-outline-secondary btn-sm" @click="copyMystmkraUserId">
              Copy
            </button>
          </div>
        </div>

        <!-- Custom Domain Branding Section - Temporarily Available to All Users -->
        <div class="mt-4">
          <div
            class="branding-card"
            style="
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 1.5rem;
              color: white;
              position: relative;
              overflow: hidden;
            "
          >
            <div
              class="branding-pattern"
              style="
                position: absolute;
                top: 0;
                right: 0;
                width: 100px;
                height: 100px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30px, -30px);
              "
            ></div>
            <div class="branding-content" style="position: relative; z-index: 2">
              <h5 class="mb-3 d-flex align-items-center">
                🎨 <span class="ms-2">Custom Domain Branding</span>
              </h5>
              <p class="mb-3" style="opacity: 0.9; line-height: 1.5">
                Create fully branded experiences with your own domains. Set up custom logos, domain
                routing, and content filtering for each domain.
              </p>

              <!-- Multi-Domain Status -->
              <div class="branding-status mb-3">
                <div v-if="domainConfigs.length > 0" class="domain-list">
                  <div class="d-flex flex-wrap gap-2">
                    <span
                      v-for="config in domainConfigs"
                      :key="config.domain"
                      class="badge bg-success d-flex align-items-center"
                      style="
                        background: rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(10px);
                      "
                    >
                      ✓ {{ config.domain }}
                      <small
                        class="ms-1"
                        v-if="config.selectedCategories && config.selectedCategories.length > 0"
                      >
                        ({{ config.selectedCategories.length }} filters)
                      </small>
                    </span>
                  </div>
                  <small class="text-light mt-2 d-block" style="opacity: 0.8">
                    {{ domainConfigs.length }} custom domain{{
                      domainConfigs.length !== 1 ? 's' : ''
                    }}
                    configured
                  </small>
                </div>

                <!-- Legacy single domain display (for backward compatibility) -->
                <div v-else-if="mySite" class="legacy-domain">
                  <span
                    class="badge bg-success"
                    style="background: rgba(255, 255, 255, 0.2) !important"
                  >
                    ✓ {{ mySite }} (Legacy)
                  </span>
                  <small class="text-light mt-2 d-block" style="opacity: 0.8">
                    Legacy single domain configuration
                  </small>
                </div>

                <!-- No domains configured -->
                <div v-else class="no-domains">
                  <span
                    class="badge bg-warning"
                    style="background: rgba(255, 193, 7, 0.3) !important"
                  >
                    ⚠ No domains configured
                  </span>
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  @click="openBrandingModal"
                  class="btn btn-light btn-sm"
                  style="font-weight: 600"
                >
                  <i class="fas fa-cog me-1"></i>
                  {{ domainConfigs.length > 0 ? 'Manage Domains' : 'Setup Branding' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- User Secret Section -->
        <div class="user-id-section alert alert-info mt-5">
          <p>Current User Secret:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">
              {{ maskedUserId }}
            </p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyUserId">Copy</button>
          </div>
        </div>

        <!-- Application Token Section -->
        <div
          class="mt-4"
          style="background: #fff9db; border-radius: 8px; padding: 1rem; border: 1px solid #ffe066"
        >
          <p>Application Token:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">{{ maskedAppToken }}</p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyAppToken">Copy</button>
          </div>
        </div>

        <!-- Mystmkra User ID Secret Section -->
        <div
          class="mt-4 mystmkra-secret-section"
          style="background: #e6f7ff; border-radius: 8px; padding: 1rem; border: 1px solid #91d5ff"
        >
          <p>Mystmkra User ID:</p>
          <div class="d-flex align-items-center">
            <p class="mb-0 me-3">{{ maskedMystmkraUserId }}</p>
            <button class="btn btn-outline-secondary btn-sm" @click="copyMystmkraUserId">
              Copy
            </button>
          </div>
        </div>

        <!-- Save Button -->
        <button class="btn btn-primary mt-3" @click="saveAllData">Save Changes</button>
      </div>
    </div>

    <div v-if="isSaving" class="saving-message-animated">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      {{ saveMessage }}
    </div>

    <!-- Branding Modal -->
    <BrandingModal
      :isOpen="showBrandingModal"
      :existingDomainConfigs="domainConfigs"
      @close="closeBrandingModal"
      @saved="handleBrandingSaved"
    />
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore' // Import Pinia store
import { marked } from 'marked' // Import marked.js
import { useRouter } from 'vue-router' // Import router
import { apiUrls } from '@/config/api' // Import API configuration
import BrandingModal from '@/components/BrandingModal.vue' // Import branding modal

export default {
  components: {
    BrandingModal,
  },
  data() {
    return {
      bio: '',
      data: {
        settings: {
          darkMode: false,
          notifications: true,
          theme: 'light',
        },
      },
      profileImage: '',
      selectedFile: null,
      isStoreReady: false,
      emailVerificationToken: '',
      editingBio: false,
      isSaving: false,
      saveMessage: '',
      mystmkraUserId: '',
      editingMystmkraUserId: false,
      newMystmkraUserId: '',
      mySite: '', // Legacy - kept for backward compatibility
      myLogo: '', // Legacy - kept for backward compatibility
      logoError: false,
      showBrandingModal: false,
      domainConfigs: [], // New: Array of domain configurations
    }
  },
  computed: {
    renderedBio() {
      return marked(this.bio || '') // Convert bio Markdown to HTML
    },
    maskedUserId() {
      const userId = this.userStore.user_id || 'xxx-xxxx-xxx-xxx'
      if (userId.length > 8) {
        return `${userId.slice(0, 4)}...${userId.slice(-4)}`
      }
      return userId
    },
    email() {
      return this.userStore.email || null // Fetch email from Vuex store
    },
    userRole() {
      return this.userStore.role || null // Fetch role from Vuex store
    },
    maskedAppToken() {
      const token = this.emailVerificationToken || 'xxxxxxxxxxxxxxxxxxxx'
      if (token.length > 8) {
        return `${token.slice(0, 4)}...${token.slice(-4)}`
      }
      return token
    },
    maskedMystmkraUserId() {
      const id = this.mystmkraUserId || ''
      if (id.length > 8) {
        return `${id.slice(0, 4)}...${id.slice(-4)}`
      }
      return id
    },
    isAdminOrSuperadmin() {
      const role = this.userStore.role || ''
      return role === 'admin' || role === 'superadmin'
    },
  },
  setup() {
    const userStore = useUserStore() // Use Pinia store
    const router = useRouter() // Use router

    return {
      userStore,
      router,
    }
  },
  mounted() {
    // Check if user is logged in
    if (!this.userStore.loggedIn) {
      console.log('User not logged in, redirecting to login')
      this.router.push('/login')
      return
    }
    this.waitForStore()
    this.fetchUserData() // Fetch user data on mount
    this.newMystmkraUserId = ''
  },
  watch: {
    // Watch for changes in loggedIn state
    'userStore.loggedIn': {
      handler(newValue) {
        if (!newValue) {
          console.log('User logged out, redirecting to login')
          this.router.push('/login')
        }
      },
      immediate: true,
    },
  },
  methods: {
    async waitForStore() {
      const timeout = 5000 // Maximum wait time in milliseconds
      const startTime = Date.now()

      const checkInterval = setInterval(() => {
        if (this.email && this.userRole) {
          this.isStoreReady = true
          console.log('Store is ready: Email:', this.email, 'Role:', this.userRole)
          clearInterval(checkInterval)
        } else if (Date.now() - startTime > timeout) {
          console.error('Timeout waiting for store to initialize')
          clearInterval(checkInterval)
        } else {
          console.warn(
            'Waiting for store to initialize: Email:',
            this.email,
            'Role:',
            this.userRole,
          )
        }
      }, 100) // Check every 100ms
    },
    async fetchUserData() {
      try {
        const response = await fetch(apiUrls.getUserData(this.email))
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        console.log('Raw user data response:', result) // Debug log
        if (result) {
          console.log('Bio from response:', result.bio) // Debug log
          this.bio = result.bio || ''
          console.log('Bio after assignment:', this.bio) // Debug log
          this.profileImage = result.profileimage || ''
          if (result.emailVerificationToken) {
            this.emailVerificationToken = result.emailVerificationToken
          }
          // Store the user_id in the store
          if (result.user_id) {
            this.userStore.setUserId(result.user_id)
          }
          // Load settings from meta if it exists
          if (result.data && result.data.settings) {
            this.data.settings = {
              darkMode: result.data.settings.darkMode || false,
              notifications: result.data.settings.notifications || true,
              theme: result.data.settings.theme || 'light',
            }
            if (this.data.settings.theme) {
              this.applyTheme()
            }
          }
          // Extract mystmkraUserId from meta data structure
          if (result.data && result.data.profile && result.data.profile.mystmkraUserId) {
            this.mystmkraUserId = result.data.profile.mystmkraUserId
            this.userStore.setMystmkraUserId(this.mystmkraUserId)
            console.log('Set mystmkraUserId in store (fetch):', this.mystmkraUserId)
            this.newMystmkraUserId = ''
          } else {
            this.mystmkraUserId = ''
            this.userStore.setMystmkraUserId('')
            console.log('No mystmkraUserId found in fetched data, set to empty string in store.')
            this.newMystmkraUserId = ''
          }

          // Extract site branding data
          if (
            result.data &&
            result.data.domainConfigs &&
            Array.isArray(result.data.domainConfigs)
          ) {
            // New multi-domain structure
            this.domainConfigs = result.data.domainConfigs
            console.log('Loaded domain configs:', this.domainConfigs)
          } else if (result.data && result.data.branding) {
            // Legacy single domain structure - convert to new format
            this.mySite = result.data.branding.mySite || ''
            this.myLogo = result.data.branding.myLogo || ''

            // If we have legacy branding data, create a single domain config for backward compatibility
            if (this.mySite) {
              this.domainConfigs = [
                {
                  domain: this.mySite,
                  logo: this.myLogo,
                  contentFilter: 'none', // Default for legacy
                  selectedCategories: [],
                },
              ]
              console.log('Converted legacy branding to domain config:', this.domainConfigs)
            }
          } else {
            this.mySite = ''
            this.myLogo = ''
            this.domainConfigs = []
          }
        } else {
          console.warn('No user data found')
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    },
    async onFileChange(event) {
      this.selectedFile = event.target.files[0]
    },
    async saveAllData() {
      try {
        this.isSaving = true
        this.saveMessage = 'Saving your settings...'
        if (this.selectedFile) {
          const formData = new FormData()
          formData.append('file', this.selectedFile)
          formData.append('email', this.email)

          const uploadResponse = await fetch(apiUrls.uploadFile(), {
            method: 'POST',
            body: formData,
          })

          if (!uploadResponse.ok) {
            throw new Error(`HTTP error! status: ${uploadResponse.status}`)
          }

          const uploadResult = await uploadResponse.json()
          if (uploadResult.success) {
            this.profileImage = uploadResult.fileUrl // Update profileImage
          } else {
            alert('Error uploading profile image')
            return
          }
        }

        // Always use the mystmkraUserId from the input/store
        const payload = {
          email: this.email,
          bio: this.bio, // Only top-level bio
          profileimage: this.profileImage,
          data: {
            profile: {
              user_id: this.userStore.user_id,
              email: this.email,
              mystmkraUserId: this.mystmkraUserId,
            },
            settings: {
              darkMode: this.data.settings.darkMode,
              notifications: this.data.settings.notifications,
              theme: this.data.settings.theme,
            },
            branding: {
              mySite: this.mySite,
              myLogo: this.myLogo,
            },
            domainConfigs: this.domainConfigs, // New multi-domain structure
          },
          mystmkraUserId: this.mystmkraUserId, // Also send as top-level for backend robustness
        }
        console.log('Saving mystmkraUserId:', this.mystmkraUserId)
        console.log('Sending PUT /userdata request:', JSON.stringify(payload, null, 2))
        const response = await fetch(apiUrls.updateUserData(), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        if (result.success) {
          this.saveMessage = 'Settings saved!'
          this.userStore.setMystmkraUserId(this.mystmkraUserId)
          this.editingMystmkraUserId = false
          console.log('Set mystmkraUserId in store (save):', this.mystmkraUserId)
          setTimeout(() => {
            this.isSaving = false
            this.saveMessage = ''
          }, 1500)
        } else {
          this.saveMessage = 'Error updating user data'
          setTimeout(() => {
            this.isSaving = false
            this.saveMessage = ''
          }, 2000)
        }
      } catch (error) {
        this.saveMessage = `Error saving user data: ${error.message}`
        setTimeout(() => {
          this.isSaving = false
          this.saveMessage = ''
        }, 2000)
      }
    },
    applyTheme() {
      if (this.data.settings?.theme === 'dark') {
        document.body.classList.add('bg-dark', 'text-white')
      } else {
        document.body.classList.remove('bg-dark', 'text-white')
      }
    },
    copyUserId() {
      const userId = this.userStore.user_id || 'xxx-xxxx-xxx-xxx'
      navigator.clipboard.writeText(userId).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'User ID copied to clipboard!'
          document.body.appendChild(infoElement)

          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy User ID:', err)
        },
      )
    },
    copyAppToken() {
      navigator.clipboard.writeText(this.emailVerificationToken).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'Application Token copied to clipboard!'
          document.body.appendChild(infoElement)
          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy Application Token:', err)
        },
      )
    },
    copyMystmkraUserId() {
      navigator.clipboard.writeText(this.mystmkraUserId).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'Mystmkra User ID copied to clipboard!'
          document.body.appendChild(infoElement)
          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy Mystmkra User ID:', err)
        },
      )
    },
    async saveBio() {
      this.isSaving = true
      this.saveMessage = 'Saving your biography...'
      await this.saveAllData()
      this.editingBio = false
      this.saveMessage = 'Biography saved!'
      setTimeout(() => {
        this.isSaving = false
        this.saveMessage = ''
      }, 1500)
    },
    cancelEditBio() {
      this.editingBio = false
    },
    saveMystmkraUserId() {
      if (this.newMystmkraUserId) {
        this.mystmkraUserId = this.newMystmkraUserId
        this.userStore.setMystmkraUserId(this.newMystmkraUserId)
        this.newMystmkraUserId = ''
        // Optionally, call saveAllData() here if you want to persist immediately
      }
    },
    openBrandingModal() {
      this.showBrandingModal = true
    },
    closeBrandingModal() {
      this.showBrandingModal = false
    },
    handleBrandingSaved(message, updatedDomainConfigs) {
      this.saveMessage = message
      this.isSaving = true

      // Update domain configs if provided by the modal
      if (updatedDomainConfigs) {
        this.domainConfigs = updatedDomainConfigs
        console.log('Updated domain configs from modal:', this.domainConfigs)
      }

      // Refresh user data to show updated branding status
      this.fetchUserData()

      setTimeout(() => {
        this.isSaving = false
        this.saveMessage = ''
      }, 2000)
    },
  },
}
</script>

<style scoped>
.saving-message-animated {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2000;
  background: #fffbe6;
  color: #856404;
  border: 1px solid #ffe066;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  animation: fadeIn 0.3s;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mystmkra-secret-section {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 8px;
  padding: 1rem;
}
</style>
