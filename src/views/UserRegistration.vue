<template>
  <div class="user-registration">
    <h1>User Registration</h1>
    <form v-if="!emailExists" @submit.prevent="registerUser">
      <div>
        <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

        <!-- Display error message -->
      </div>
      <p></p>
      <div>
        <label for="email">Email:</label>
        <input type="email" v-model="email" required />
      </div>
      <button type="submit">Register</button>
    </form>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    <button v-if="emailExists" @click="resetRegistration" type="button">
      Reset my registration process
    </button>
  </div>
</template>

<script>
export default {
  name: 'UserRegistration',
  data() {
    return {
      email: '',
      successMessage: '',
      errorMessage: '',
      emailExists: false, // Track if the email exists in the database
      resetAvailable: false, // Track if reset action should be offered
    }
  },
  created() {
    // Pre-fill the email field if provided in the query parameters
    if (this.$route && this.$route.query && this.$route.query.email) {
      this.email = this.$route.query.email
    }
  },
  methods: {
    async registerUser() {
      this.successMessage = ''
      this.errorMessage = '' // Clear error message before submission
      try {
        const response = await fetch(
          `https://test.vegvisr.org/sve2?email=${encodeURIComponent(this.email)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )

        const data = await response.json()
        console.log('User registration response:', data)

        if (data.message === 'User with this email already exists.') {
          this.errorMessage = 'User with this email already exists.'
          this.emailExists = true // Set emailExists to true
        } else {
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
        const response = await fetch('https://test.vegvisr.org/resend-verification', {
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
        const response = await fetch('https://test.vegvisr.org/reset-registration', {
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
.user-registration {
  max-width: 400px;
  margin: 0 auto;
  margin-top: 10%;
  padding: 1em;
  border: 1px solid #ccc;
  border-radius: 4px;
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
