<template>
  <div>
    <h1>API Data</h1>
    <button @click="fetchData">Fetch Data</button>

    <div v-if="loading">Loading...</div>
    <div v-if="error" class="error">
      <p>Error fetching data: {{ error }}</p>
    </div>
    <div v-if="data">
      <pre>{{ data }}</pre>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data() {
    return {
      data: null,
      loading: false,
      error: null,
    }
  },
  methods: {
    async fetchData() {
      this.loading = true
      this.error = null // Reset the error before each fetch

      try {
        const response = await axios.get('https://dev.vegvisr.org')

        this.data = response.data // Store the fetched data
      } catch (error) {
        console.error('Error details:', error) // Log the error details
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.error = `Server responded with status ${error.response.status}: ${error.response.data}`
        } else if (error.request) {
          // The request was made but no response was received
          this.error = 'No response received from the server'
        } else {
          // Something happened in setting up the request that triggered an Error
          this.error = `Error in setting up request: ${error.message}`
        }
      } finally {
        this.loading = false // Hide loading spinner when done
      }
    },
  },
}
</script>

<style scoped>
.error {
  color: red;
}
</style>
