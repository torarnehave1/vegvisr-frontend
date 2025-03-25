<template>
  <div class="container my-5">
    <h1 class="mb-4">User Dashboard</h1>
    <div class="row">
      <!-- Profile Section -->
      <div class="col-md-4 text-center">
        <img
          :src="profileImage"
          alt="Profile Image"
          class="img-fluid rounded-circle mb-3"
          style="max-width: 150px"
        />
        <h3>{{ data.profile.username || 'Guest' }}</h3>
        <p>{{ data.profile.email || email }}</p>
        <p>{{ data.profile.bio || 'No bio available' }}</p>
      </div>

      <!-- Settings Section -->
      <div class="col-md-8">
        <h4>Settings</h4>
        <p><strong>Dark Mode:</strong> {{ data.settings.darkMode ? 'Enabled' : 'Disabled' }}</p>
        <p><strong>Notifications:</strong> {{ data.settings.notifications ? 'On' : 'Off' }}</p>
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

        <!-- Save Button -->
        <button class="btn btn-primary mt-3" @click="saveAllData">Save Changes</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      data: {
        profile: {
          username: '',
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
      email: 'torarnehave@gmail.com', // Hardcoded email for testing
      selectedFile: null, // Add selectedFile to handle file input
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
        const response = await fetch(`https://test.vegvisr.org/userdata?email=${this.email}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const result = await response.json()

        // Handle empty data object
        this.data = {
          profile: result.data?.profile || this.data.profile,
          settings: result.data?.settings || this.data.settings,
        }

        // Handle null profile image
        this.profileImage =
          result.profileimage ||
          'https://5d9b2060ef095c777711a8649c24914e.r2.cloudflarestorage.com/images/logo.svg'

        this.applyTheme() // Apply theme after fetching user data
      } catch (error) {
        console.error('Error fetching user data:', error)
        alert('Failed to fetch user data. Please try again later.')
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

        const payload = {
          email: this.email,
          data: this.data,
          profileimage: this.profileImage, // Include profileImage in payload
        }
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
  },
}
</script>

<style scoped>
/* Optional custom styling */
</style>
