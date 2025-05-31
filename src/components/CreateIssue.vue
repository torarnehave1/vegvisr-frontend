<template>
  <div class="create-issue">
    <div class="card">
      <div class="card-header">
        <h3>Create New Issue</h3>
      </div>
      <div class="card-body">
        <form @submit.prevent="handleSubmit">
          <!-- Title Input -->
          <div class="mb-3">
            <label for="title" class="form-label">Title</label>
            <input
              type="text"
              class="form-control"
              id="title"
              v-model="form.title"
              required
              placeholder="Enter a descriptive title"
            />
          </div>

          <!-- Body Input -->
          <div class="mb-3">
            <label for="body" class="form-label">Description</label>
            <div class="d-flex align-items-center gap-2">
              <textarea
                class="form-control"
                id="body"
                v-model="form.body"
                rows="6"
                required
                placeholder="Describe your issue, feature request, or bug report in detail"
              ></textarea>
              <button
                type="button"
                class="btn btn-outline-secondary"
                :disabled="grokLoading || !form.title"
                @click="generateDescription"
                title="Suggest description with AI"
              >
                <span
                  v-if="grokLoading"
                  class="spinner-border spinner-border-sm"
                  role="status"
                ></span>
                <span v-else class="bi bi-magic"></span>
              </button>
            </div>
            <div v-if="grokError" class="text-danger mt-1">{{ grokError }}</div>
          </div>

          <!-- Labels Selection -->
          <div class="mb-3">
            <label class="form-label">Labels</label>
            <div class="d-flex flex-wrap gap-2">
              <div v-for="label in availableLabels" :key="label" class="form-check">
                <input
                  class="form-check-input"
                  type="checkbox"
                  :value="label"
                  :id="'label-' + label"
                  v-model="form.labels"
                />
                <label class="form-check-label" :for="'label-' + label">
                  {{ label }}
                </label>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="d-flex justify-content-end">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span
                v-if="loading"
                class="spinner-border spinner-border-sm me-2"
                role="status"
              ></span>
              {{ loading ? 'Creating...' : 'Create Issue' }}
            </button>
          </div>
        </form>

        <!-- Success Message -->
        <div v-if="success" class="alert alert-success mt-3" role="alert">
          Issue created successfully!
        </div>

        <!-- Error Message -->
        <div v-if="error" class="alert alert-danger mt-3" role="alert">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const emit = defineEmits(['issue-created'])

const form = reactive({
  title: '',
  body: '',
  labels: [],
})

const loading = ref(false)
const success = ref(false)
const error = ref(null)

const grokLoading = ref(false)
const grokError = ref(null)

const availableLabels = [
  'bug',
  'enhancement',
  'feature',
  'documentation',
  'question',
  'help wanted',
]

const generateDescription = async () => {
  if (!form.title) return
  grokLoading.value = true
  grokError.value = null
  try {
    const response = await fetch('https://api.vegvisr.org/grok-issue-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, labels: form.labels }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to generate description')
    }
    const data = await response.json()
    form.body = data.description
  } catch (err) {
    grokError.value = err.message
  } finally {
    grokLoading.value = false
  }
}

const handleSubmit = async () => {
  try {
    loading.value = true
    error.value = null
    success.value = false

    const response = await fetch('https://test.vegvisr.org/github/create-issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create issue')
    }

    // Reset form and show success message
    form.title = ''
    form.body = ''
    form.labels = []
    success.value = true

    // Emit the issue-created event
    emit('issue-created')

    // Hide success message after 3 seconds
    setTimeout(() => {
      success.value = false
    }, 3000)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.create-issue {
  max-width: 800px;
  margin: 0 auto;
}

.form-check {
  margin-right: 1rem;
}

.form-check-input:checked {
  background-color: #0d6efd;
  border-color: #0d6efd;
}
</style>
