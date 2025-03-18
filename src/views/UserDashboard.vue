<template>
  <div
    :class="[
      'container mt-5',
      { 'bg-dark': data.settings.theme === 'dark', 'text-white': data.settings.theme === 'dark' },
    ]"
  >
    <h1 class="text-center">User Dashboard</h1>

    <!-- Profile Section -->
    <div
      class="card my-4"
      :class="{
        'bg-dark': data.settings.theme === 'dark',
        'text-white': data.settings.theme === 'dark',
      }"
    >
      <div class="card-body">
        <h2 class="card-title">Profile Settings</h2>
        <div class="mb-3">
          <label class="form-label">Username:</label>
          <input type="text" class="form-control" v-model="data.profile.username" />
        </div>
        <div class="mb-3">
          <label class="form-label">Email:</label>
          <input type="email" class="form-control" v-model="data.profile.email" />
        </div>
        <div class="mb-3">
          <label class="form-label">Bio:</label>
          <textarea class="form-control" v-model="data.profile.bio"></textarea>
        </div>
        <!-- Profile Image Upload -->
        <div class="mb-3">
          <label class="form-label">Profile Image:</label>
          <input type="file" class="form-control" @change="onFileChange" />
        </div>
        <!-- Display Profile Image -->
        <div v-if="profileImage" class="mb-3 text-center">
          <img
            :src="profileImage"
            alt="Profile Image"
            class="rounded-circle"
            style="width: 150px; height: 150px; object-fit: cover"
          />
        </div>
      </div>
    </div>

    <!-- Settings Section -->
    <div
      class="card my-4"
      :class="{
        'bg-dark': data.settings.theme === 'dark',
        'text-white': data.settings.theme === 'dark',
      }"
    >
      <div class="card-body">
        <h2 class="card-title">Preferences</h2>
        <div class="form-check mb-3">
          <input
            type="checkbox"
            class="form-check-input"
            id="darkMode"
            v-model="data.settings.darkMode"
          />
          <label class="form-check-label" for="darkMode">Dark Mode</label>
        </div>
        <div class="form-check mb-3">
          <input
            type="checkbox"
            class="form-check-input"
            id="notifications"
            v-model="data.settings.notifications"
          />
          <label class="form-check-label" for="notifications">Notification Emails</label>
        </div>
        <div class="mb-3">
          <label class="form-label">Theme:</label>
          <select class="form-select" v-model="data.settings.theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <!-- Single Save Button for Everything -->
        <button class="btn btn-primary w-100" @click="saveAllData">Save All Data</button>
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
      profileImage: '', // Move profileImage outside of data
      userId: 'tah12have', // Hardcoded for testing; typically comes from auth
      selectedFile: null, // Add selectedFile to handle file input
    }
  },
  mounted() {
    this.fetchUserData()
  },
  methods: {
    async fetchUserData() {
      try {
        const response = await fetch(`https://test.vegvisr.org/userdata?user_id=${this.userId}`)
        const result = await response.json()
        if (result.profileimage) {
          this.profileImage = result.profileimage // Update profileImage
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    },
    onFileChange(event) {
      this.selectedFile = event.target.files[0]
    },
    async saveAllData() {
      try {
        if (this.selectedFile) {
          const formData = new FormData()
          formData.append('file', this.selectedFile)
          formData.append('user_id', this.userId)

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
          user_id: this.userId,
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
          alert('User data updated successfully!')
        } else {
          alert('Error updating user data')
        }
      } catch (error) {
        console.error('Error saving user data:', error)
        alert(`Error saving user data: ${error.message}`)
      }
    },
  },
}
</script>

<style scoped>
/* No custom styles needed as Bootstrap is used */
</style>
