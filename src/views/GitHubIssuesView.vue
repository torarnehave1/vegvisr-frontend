<template>
  <div class="github-issues-view">
    <div class="container">
      <div class="row mb-4">
        <div class="col">
          <h1>Roadmap</h1>
        </div>
        <div class="col-auto">
          <button class="btn btn-primary" @click="showCreateForm = !showCreateForm">
            <span class="material-icons">{{ showCreateForm ? 'close' : 'add' }}</span>
            {{ showCreateForm ? 'Cancel' : 'Create New Issue' }}
          </button>
        </div>
      </div>

      <!-- Create Issue Form -->
      <div v-if="showCreateForm" class="mb-4">
        <CreateIssue @issue-created="handleIssueCreated" />
      </div>

      <!-- Issues List -->
      <GitHubIssues ref="issuesList" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import GitHubIssues from '@/components/GitHubIssues.vue'
import CreateIssue from '@/components/CreateIssue.vue'

const showCreateForm = ref(false)
const issuesList = ref(null)

const handleIssueCreated = async () => {
  showCreateForm.value = false
  // Refresh the issues list
  if (issuesList.value) {
    await issuesList.value.fetchIssues()
  }
}
</script>

<style scoped>
.github-issues-view {
  padding: 1rem;
}
</style>
