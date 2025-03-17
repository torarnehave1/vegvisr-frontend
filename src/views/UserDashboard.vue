<template>
  <div :class="['container mt-5', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]">
    <h1 class="text-center">User Dashboard</h1>

    <div class="card my-4" :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }">
      <div class="card-body">
        <h2 class="card-title">Profile Settings</h2>
        <div class="mb-3">
          <label class="form-label">Username:</label>
          <input type="text" class="form-control" v-model="user.username" />
        </div>
        <div class="mb-3">
          <label class="form-label">Email:</label>
          <input type="email" class="form-control" v-model="user.email" />
        </div>
        <div class="mb-3">
          <label class="form-label">Bio:</label>
          <textarea class="form-control" v-model="user.bio"></textarea>
        </div>
        <button class="btn btn-primary w-100" @click="saveProfile">Save Profile</button>
      </div>
    </div>

    <div class="card my-4" :class="{ 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }">
      <div class="card-body">
        <h2 class="card-title">Preferences</h2>
        <div class="form-check mb-3">
          <input
            type="checkbox"
            class="form-check-input"
            id="darkMode"
            v-model="settings.darkMode"
          />
          <label class="form-check-label" for="darkMode">Dark Mode</label>
        </div>
        <div class="form-check mb-3">
          <input
            type="checkbox"
            class="form-check-input"
            id="notifications"
            v-model="settings.notifications"
          />
          <label class="form-check-label" for="notifications">Notification Emails</label>
        </div>
        <button class="btn btn-primary w-100" @click="saveSettings">Save Settings</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    theme: {
      type: String,
      default: 'light',
    },
  },
  data() {
    return {
      user: {
        username: '',
        email: '',
        bio: '',
      },
      settings: {
        darkMode: false,
        notifications: true,
      },
      userId: 'tah12have', // Hardcoded user_id for testing
    }
  },
  mounted() {
    this.fetchSettings()
  },
  methods: {
    saveProfile() {
      console.log('Profile saved', this.user)
      alert('Profile updated successfully!')
    },
    async fetchSettings() {
      try {
        const response = await fetch(`https://test.vegvisr.org/config?user_id=${this.userId}`)
        const data = await response.json()
        if (data.settings) {
          data.settings.forEach((setting) => {
            this.settings[setting.setting_key] = setting.setting_value
          })
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }
    },
    async saveSettings() {
      try {
        const response = await fetch('https://test.vegvisr.org/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: this.userId,
            settings: Object.keys(this.settings).map((key) => ({
              setting_key: key,
              setting_value: this.settings[key],
            })),
          }),
        })
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (data.success) {
          alert('Settings updated successfully!')
        } else {
          alert('Error updating settings')
        }
      } catch (error) {
        console.error('Error saving settings:', error)
        alert(`Error saving settings: ${error.message}`)
      }
    },
  },
}
</script>

<style scoped>
/* No custom styles needed as Bootstrap is used */
</style>
