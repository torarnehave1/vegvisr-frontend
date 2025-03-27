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
    <button v-if="emailExists" @click="resendVerificationLink" type="button">
      Resend Verification Link
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
            'Please check your email to complete your registration. Also, check your SPAM folder. The email is sent from vegvisr.org@gmail.com.'
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
  },
}
</script>

<style scoped>
.user-registration {
  max-width: 400px;
  margin: 0 auto;
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
