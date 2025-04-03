<template>
  <div class="container my-5">
    <!-- Title Section: full width, centered -->
    <div class="row mb-4">
      <div class="col-12 text-center">
        <h1>User Dashboard</h1>
      </div>
    </div>

    <!-- Main Content Row: Profile and Settings -->
    <div class="row">
      <!-- Profile Section -->
      <div class="col-md-4 text-center">
        <img
          :src="profileImage"
          alt="Profile Image"
          class="img-fluid rounded-circle mb-3"
          style="max-width: 150px"
        />

        <h4>{{ data.profile.email || email }}</h4>
        <p>{{ data.profile.bio || 'No bio available' }}</p>
        <p><strong>Role:</strong> {{ userRole || 'N/A' }}</p>
      </div>

      <!-- Settings Section -->
      <div class="col-md-8">
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

export default {
  data() {
    return {
      data: {
        profile: {
          user_id: '', // Ensure user_id is initialized
          email: '',
          bio: '',
        },
        settings: {
          darkMode: false,
          notifications: true,
          theme: 'light',
        },
      },
      profileImage: '', // Default profile image
      email: localStorage.getItem('UserEmail') || '', // Fetch email from localStorage
      selectedFile: null, // Add selectedFile to handle file input
    }
  },
  computed: {
    maskedUserId() {
      const userId = this.data.profile.user_id || 'xxx-xxxx-xxx-xxx'
      if (userId.length > 8) {
        return `${userId.slice(0, 4)}...${userId.slice(-4)}`
      }
      return userId
    },
  },
  setup() {
    const store = useStore()

    return {
      userRole: store.state.user.role, // Access role from Vuex store
    }
  },
  mounted() {
    if (this.email) {
      this.fetchUserData()
    }
  },
  methods: {
    async fetchUserData() {
      try {
        const response = await fetch(`https://dashboard.vegvisr.org/userdata?email=${this.email}`)
        if (!response.ok) {
          console.error(`Failed to fetch user data. HTTP status: ${response.status}`)
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()

        // Update profile and settings with data from the API
        this.data = {
          profile: {
            user_id: result.user_id || this.data.profile.user_id,
            email: result.email || this.data.profile.email,
            bio: this.data.profile.bio,
          },
          settings: result.data?.settings || this.data.settings,
        }

        // Handle null profile image
        this.profileImage =
          result.profileimage ||
          'https://5d9b2060ef095c777711a8649c24914e.r2.cloudflarestorage.com/images/logo.svg'

        this.applyTheme() // Apply theme after fetching user data
      } catch (error) {
        if (error.name === 'TypeError') {
          console.error('Network error or invalid API endpoint:', error.message)
        } else {
          console.error('Error fetching user data:', error.message)
        }
        console.error('Stack trace:', error.stack)
        alert('Failed to fetch user data. Please check your network connection or try again later.')
        this.applyTheme() // Ensure theme is applied even if fetching fails
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
          data: this.data,
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
      const userId = this.data.profile.user_id || 'xxx-xxxx-xxx-xxx'
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
