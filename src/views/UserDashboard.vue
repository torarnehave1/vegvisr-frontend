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

        <h4>{{ email }}</h4>
        <div v-html="renderedBio"></div>
        <!-- Render bio as HTML -->
        <p><strong>Role:</strong> {{ userRole || 'N/A' }}</p>
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

        <!-- Save Button -->
        <button class="btn btn-primary mt-3" @click="saveAllData">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<script>
import { useStore } from '@/store'
import { marked } from 'marked' // Import marked.js

export default {
  data() {
    return {
      bio: '', // Add bio field
      data: {
        settings: {
          darkMode: false,
          notifications: true,
          theme: 'light',
        },
      },
      profileImage: '', // Default profile image
      selectedFile: null, // Add selectedFile to handle file input
      isStoreReady: false, // Track if the Vuex store is ready
    }
  },
  computed: {
    renderedBio() {
      return marked(this.bio || '') // Convert bio Markdown to HTML
    },
    maskedUserId() {
      const userId = this.store.state.user?.user_id || 'xxx-xxxx-xxx-xxx'
      if (userId.length > 8) {
        return `${userId.slice(0, 4)}...${userId.slice(-4)}`
      }
      return userId
    },
    email() {
      return this.store.state.user?.email || null // Fetch email from Vuex store
    },
    userRole() {
      return this.store.state.user?.role || null // Fetch role from Vuex store
    },
  },
  setup() {
    const store = useStore()

    return {
      store,
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
        const response = await fetch(`https://dashboard.vegvisr.org/userdata?email=${this.email}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()
        if (result) {
          console.log('Fetched user data:', result)
          this.bio = result.bio || '' // Assign bio field
          this.profileImage = result.profileimage || ''
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
        if (this.selectedFile) {
          const formData = new FormData()
          formData.append('file', this.selectedFile)
          formData.append('email', this.email)

          const uploadResponse = await fetch('https://dashboard.vegvisr.org/upload', {
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

        const payload = {
          email: this.email,
          bio: this.bio, // Include bio in payload
          profileimage: this.profileImage, // Include profileImage in payload
        }
        console.log('Sending PUT /userdata request:', JSON.stringify(payload, null, 2))
        const response = await fetch('https://dashboard.vegvisr.org/userdata', {
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
          // Scroll to the top of the page after saving
          window.scrollTo({ top: 0, behavior: 'smooth' })
          // Refresh the page after saving
          location.reload()
        } else {
          alert('Error updating user data')
        }
      } catch (error) {
        console.error('Error saving user data:', error)
        alert(`Error saving user data: ${error.message}`)
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
      const userId = this.store.state.user?.user_id || 'xxx-xxxx-xxx-xxx'
      navigator.clipboard.writeText(userId).then(
        () => {
          const infoElement = document.createElement('div')
          infoElement.className = 'alert alert-success position-fixed top-0 end-0 m-3'
          infoElement.style.zIndex = '1050'
          infoElement.textContent = 'User Secret copied to clipboard!'
          document.body.appendChild(infoElement)

          setTimeout(() => {
            document.body.removeChild(infoElement)
          }, 2000)
        },
        (err) => {
          console.error('Failed to copy User Secret:', err)
        },
      )
    },
  },
}
</script>

<style scoped>
/* Optional custom styling */
</style>
