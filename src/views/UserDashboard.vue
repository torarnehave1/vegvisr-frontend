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
        <div class="mb-3">
          <label for="mystmkraUserId" class="form-label"><strong>Mystmkra User ID:</strong></label>
          <input
            id="mystmkraUserId"
            class="form-control"
            v-model="mystmkraUserId"
            placeholder="Enter your Mystmkra User ID"
          />
          <div class="form-text text-start">This is your Mystmkra.io user ID for integration.</div>
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
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore' // Import Pinia store
import { marked } from 'marked' // Import marked.js

export default {
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
  },
  setup() {
    const userStore = useUserStore() // Use Pinia store

    return {
      userStore,
    }
  },
  mounted() {
    this.waitForStore()
    this.fetchUserData() // Fetch user data on mount
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
        const response = await fetch(`https://test.vegvisr.org/userdata?email=${this.email}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        if (result) {
          console.log('Fetched user data:', result)
          this.bio = result.bio || ''
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
          } else {
            this.mystmkraUserId = ''
            this.userStore.setMystmkraUserId('')
            console.log('No mystmkraUserId found in fetched data, set to empty string in store.')
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

          const uploadResponse = await fetch('https://test.vegvisr.org/upload', {
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
          },
          mystmkraUserId: this.mystmkraUserId, // Also send as top-level for backend robustness
        }
        console.log('Saving mystmkraUserId:', this.mystmkraUserId)
        console.log('Sending PUT /userdata request:', JSON.stringify(payload, null, 2))
        const response = await fetch('https://test.vegvisr.org/userdata', {
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
