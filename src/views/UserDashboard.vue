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
        const result = await response.json()
        if (result.profileimage) {
          this.profileImage = result.profileimage // Update profileImage
        }
        this.data = {
          ...this.data,
          ...result.data,
          settings: result.data?.settings || this.data.settings, // Ensure settings has default values
        }
        this.applyTheme() // Apply theme after fetching user data
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Ensure the page loads even if fetching user data fails
        this.applyTheme()
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
            'Content-Type': this.profileImage.endsWith('.svg')
              ? 'image/svg+xml'
              : 'application/json',
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
