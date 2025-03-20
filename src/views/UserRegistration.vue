<template>
  <div class="user-registration">
    <h1>User Registration</h1>
    <form @submit.prevent="registerUser">
      <div>
        <label for="email">Email:</label>
        <input type="email" v-model="email" required />
      </div>
      <button type="submit">Register</button>
    </form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      email: '',
    }
  },
  methods: {
    async registerUser() {
      try {
        const response = await fetch('/sve2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: this.email }),
        })
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        const data = await response.json()
        console.log('User registered:', data)
      } catch (error) {
        console.error('There was a problem with the registration:', error)
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
</style>
