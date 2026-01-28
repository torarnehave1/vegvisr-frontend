<template>
  <div class="user-registration" :class="{ embedded: isEmbedded }">
    <div class="user-reg-heading" v-if="isEmbedded">User Registration</div>
    <form v-if="!emailExists" @submit.prevent="registerUser">
      <div>
        <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
      </div>
      <div>
        <label for="email">Email:</label>
        <input type="email" v-model="email" required />
      </div>
      <button type="submit">Register</button>
    </form>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <button v-if="emailExists && !isEmbedded" @click="resetRegistration" type="button">
      Reset my registration process
    </button>
  </div>
</template>

<script>
import { useUserStore } from '@/stores/userStore'

const MAIN_WORKER_BASE = 'https://vegvisr-frontend.torarnehave.workers.dev'

export default {
  name: 'UserRegistration',
  data() {
    return {
      email: '',
      successMessage: '',
      errorMessage: '',
      emailExists: false,
      isEmbedded: false, // Track if the component is embedded
    }
  },
  created() {
    // Detect if the component is embedded via query parameter
    this.isEmbedded = this.$route.query.embed === 'true'

    // Pre-fill the email field if provided in the query parameters
    if (this.$route.query.email) {
      this.email = this.$route.query.email
    }
  },
  methods: {
    async registerUser() {
      this.successMessage = ''
      this.errorMessage = '' // Clear error message before submission
      try {
        const response = await fetch(
          `${MAIN_WORKER_BASE}/sve2?email=${encodeURIComponent(this.email)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )

        const data = await response.json()
        console.log('User registration response:', data)

        const message = data?.message || data?.body?.message

        if (message === 'User with this email already exists.') {
          this.errorMessage = 'User with this email already exists.'
          this.emailExists = true // Set emailExists to true
        } else {
          if (data?.emailVerificationToken || data?.body?.emailVerificationToken) {
            const userStore = useUserStore()
            userStore.setEmailVerificationToken(data?.emailVerificationToken || data?.body?.emailVerificationToken)
          }
          this.successMessage =
            'IMPORTANT: Please check your email to finalize your registration. Remember to check your SPAM folder as well. The email will be sent from vegvisr.org@gmail.com. NOTE: To log in from a different device, you must click the registration link on that device again.'
          this.emailExists = false // Ensure emailExists is false for new registrations
        }

        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight)
      } catch (error) {
        console.error('There was a problem with the registration:', error)
        this.errorMessage = 'There was a problem with the registration. Please try again later.'
        this.emailExists = false // Reset emailExists on error

        window.scrollTo(0, document.body.scrollHeight)
      }
    },
    async resendVerificationLink() {
      this.successMessage = ''
      this.errorMessage = '' // Clear messages before submission
      try {
        const response = await fetch(`${MAIN_WORKER_BASE}/resend-verification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: this.email }),
        })

        const data = await response.json()
        console.log('Resend verification response:', data)

        if (response.ok) {
          this.successMessage = 'Verification email resent successfully. Please check your inbox.'
        } else {
          this.errorMessage = data.error || 'Failed to resend verification email.'
        }

        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight)
      } catch (error) {
        console.error('Error resending verification email:', error)
        this.errorMessage =
          'There was a problem resending the verification email. Please try again later.'

        window.scrollTo(0, document.body.scrollHeight)
      }
    },
    async resetRegistration() {
      this.successMessage = ''
      this.errorMessage = ''
      try {
        const response = await fetch(`${MAIN_WORKER_BASE}/reset-registration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: this.email }),
        })

        const data = await response.json()
        console.log('Reset registration response:', data)

        if (response.ok) {
          this.successMessage = 'Registration process reset successfully. You can register again.'
          this.emailExists = false
          this.email = '' // Clear the email field
        } else {
          this.errorMessage = data.error || 'Failed to reset registration process.'
        }

        window.scrollTo(0, document.body.scrollHeight)
      } catch (error) {
        console.error('Error resetting registration:', error)
        this.errorMessage =
          'There was a problem resetting the registration. Please try again later.'
        window.scrollTo(0, document.body.scrollHeight)
      }
    },
  },
}
</script>

<style scoped>
/* User Registration Component Styles */
.user-reg-heading {
  font-size: 1.5em;
  text-align: center;
  margin-bottom: 1em;
}
.registration-heading {
  font-size: 1.5em;
  text-align: center;
  margin-bottom: 1em;
}
.user-registration {
  max-width: 400px;
  margin: 0 auto;
  margin-top: 10%;
  padding: 1em;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.user-registration.embedded {
  margin-top: 0; /* Remove top margin for embedded mode */
  border: none; /* Remove border for embedded mode */
}

.user-registration h1 {
  text-align: center;
}

.user-registration form {
  display: flex;
  flex-direction: column;
}

.user-registration label {
  margin-bottom: 0.5em;
}

.user-registration input {
  margin-bottom: 1em;
  padding: 0.5em;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.user-registration button {
  padding: 0.5em;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
}

.user-registration button:hover {
  background-color: #0056b3;
}

.success-message {
  margin-top: 1em;
  color: green;
  text-align: center;
}

.error-message {
  margin-top: 1em;
  color: red;
  text-align: center;
}
</style>
