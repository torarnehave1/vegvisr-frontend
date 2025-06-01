<template>
  <div class="github-issues">
    <div class="container mt-4">
      <h2>GitHub Vegvisr.org Roadmap</h2>

      <p>
        This is a list of our fun playfull features and issues that are currently being worked on or
        are planned for the future. jiipoo!
      </p>

      <!-- Loading State -->
      <div v-if="loading" class="text-center">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="alert alert-danger" role="alert">
        {{ error }}
      </div>

      <!-- Issues List -->
      <div v-else class="row">
        <div class="col-md-4">
          <!-- Sort Controls -->
          <div class="mb-3">
            <label for="sortSelect" class="form-label">Sort by:</label>
            <select id="sortSelect" class="form-select" v-model="sortBy">
              <option value="priority">Priority</option>
              <option value="date">Date</option>
              <option value="number">Issue Number</option>
              <option value="title">Title</option>
            </select>
          </div>

          <div class="list-group">
            <button
              v-for="issue in sortedIssues"
              :key="issue.id"
              class="list-group-item list-group-item-action"
              :class="{ active: selectedIssue?.id === issue.id }"
              @click="selectedIssue = issue"
            >
              <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1">{{ issue.title }}</h5>
                <small>#{{ issue.number }}</small>
              </div>
              <p class="mb-1 text-muted">
                {{ new Date(issue.created_at).toLocaleDateString() }}
              </p>
              <div class="d-flex gap-2">
                <span
                  v-for="label in issue.labels"
                  :key="label.id"
                  class="badge"
                  :style="{ backgroundColor: '#' + label.color }"
                >
                  {{ label.name }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Issue Details -->
        <div class="col-md-8">
          <div v-if="selectedIssue" class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h3 class="mb-0">{{ selectedIssue.title }}</h3>
              <a
                :href="selectedIssue.html_url"
                target="_blank"
                class="btn btn-outline-primary btn-sm"
              >
                View on GitHub
              </a>
            </div>
            <div class="card-body">
              <div class="mb-3">
                <span class="badge bg-secondary me-2">#{{ selectedIssue.number }}</span>
                <span
                  class="badge"
                  :class="selectedIssue.state === 'open' ? 'bg-success' : 'bg-danger'"
                >
                  {{ selectedIssue.state }}
                </span>
                <span class="ms-2 text-muted">
                  Opened by {{ selectedIssue.user.login }} on
                  {{ new Date(selectedIssue.created_at).toLocaleDateString() }}
                </span>
              </div>
              <div class="markdown-body" v-html="renderedBody"></div>
            </div>
          </div>
          <div v-else class="text-center text-muted">Select an item to view details</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { marked } from 'marked'

const issues = ref([])
const loading = ref(true)
const error = ref(null)
const selectedIssue = ref(null)
const sortBy = ref('priority')

const renderedBody = computed(() => {
  if (!selectedIssue.value?.body) return ''
  return marked(selectedIssue.value.body)
})

const hasPriority = (issue) => {
  return issue.labels.some((label) => label.name === 'priority')
}

const sortedIssues = computed(() => {
  const issuesArray = [...issues.value]

  switch (sortBy.value) {
    case 'priority':
      return issuesArray.sort((a, b) => {
        const aHasPriority = hasPriority(a)
        const bHasPriority = hasPriority(b)
        if (aHasPriority === bHasPriority) {
          return new Date(b.created_at) - new Date(a.created_at) // Secondary sort by date
        }
        return bHasPriority - aHasPriority
      })
    case 'date':
      return issuesArray.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'number':
      return issuesArray.sort((a, b) => b.number - a.number)
    case 'title':
      return issuesArray.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return issuesArray
  }
})

const fetchIssues = async () => {
  try {
    loading.value = true
    error.value = null
    const response = await fetch('https://test.vegvisr.org/github/issues')
    if (!response.ok) {
      throw new Error('Failed to fetch issues')
    }
    issues.value = await response.json()
    return issues.value
  } catch (err) {
    error.value = err.message
    throw err
  } finally {
    loading.value = false
  }
}

onMounted(fetchIssues)

// Expose the fetchIssues method to parent components
defineExpose({
  fetchIssues,
})
</script>

<style scoped>
.github-issues {
  min-height: 100vh;
  background-color: #f8f9fa;
}

.markdown-body {
  padding: 1rem;
  background-color: white;
  border-radius: 0.25rem;
}

.list-group-item {
  cursor: pointer;
  transition: background-color 0.2s;
}

.list-group-item:hover {
  background-color: #f8f9fa;
}

.list-group-item.active {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.badge {
  font-size: 0.8rem;
  padding: 0.35em 0.65em;
}
</style>
