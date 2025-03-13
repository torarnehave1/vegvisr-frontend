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
        const response = await fetch('https://dev.vegvisr.org')

        if (!response.ok) {
          throw new Error('Network response was not ok')
        }

        const jsonData = await response.json()
        this.data = jsonData // Store the fetched data
      } catch (error) {
        this.error =
          error.message === 'Failed to fetch' ? 'Network error: Failed to fetch' : error.message // Capture any errors
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
