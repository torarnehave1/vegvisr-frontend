<template>
  <div class="graph-table-container">
    <table class="graph-table">
      <thead>
        <tr>
          <th @click="setSort('title')">
            Title
            <span v-if="localSortBy === 'title'">
              {{ localSortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </th>
          <th @click="setSort('createdBy')">
            Created By
            <span v-if="localSortBy === 'createdBy'">
              {{ localSortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </th>
          <th @click="setSort('nodes')">
            Node Count
            <span v-if="localSortBy === 'nodes'">
              {{ localSortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </th>
          <th @click="setSort('updatedAt')">
            Last Updated
            <span v-if="localSortBy === 'updatedAt'">
              {{ localSortDirection === 'asc' ? '▲' : '▼' }}
            </span>
          </th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="graph in sortedGraphs" :key="graph.id">
          <td>{{ graph.metadata?.title || 'Untitled Graph' }}</td>
          <td>{{ graph.metadata?.createdBy || 'Unknown' }}</td>
          <td>{{ getNodeCount(graph) }}</td>
          <td>{{ formatDate(graph.metadata?.updatedAt) }}</td>
          <td>
            <button class="btn btn-primary btn-sm" @click="$emit('view-graph', graph)">View</button>
            <button
              v-if="userStore.role === 'Admin' || userStore.role === 'Superadmin'"
              class="btn btn-secondary btn-sm ms-2"
              @click="$emit('edit-graph', graph)"
            >
              Edit
            </button>
            <button
              v-if="userStore.role === 'Admin' || userStore.role === 'Superadmin'"
              class="btn btn-danger btn-sm ms-2"
              @click="$emit('delete-graph', graph)"
            >
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useUserStore } from '@/stores/userStore'

const props = defineProps({
  graphs: {
    type: Array,
    required: true,
  },
  isViewOnly: {
    type: Boolean,
    default: false,
  },
})

const portfolioStore = usePortfolioStore()
const userStore = useUserStore()
const localSortBy = ref('updatedAt')
const localSortDirection = ref('desc')

function setSort(column) {
  if (localSortBy.value === column) {
    localSortDirection.value = localSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    localSortBy.value = column
    // Keep "Last Updated" newest-first by default; others start ascending.
    localSortDirection.value = column === 'updatedAt' ? 'desc' : 'asc'
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function getNodeCount(graph) {
  if (Number.isFinite(graph?.nodeCount)) return graph.nodeCount
  return Array.isArray(graph?.nodes) ? graph.nodes.length : 0
}

const sortedGraphs = computed(() => {
  let filtered = props.graphs
  // Apply search filter
  if (portfolioStore.searchQuery) {
    const query = portfolioStore.searchQuery.toLowerCase()
    filtered = filtered.filter((graph) => {
      const title = graph.metadata?.title?.toLowerCase() || ''
      const createdBy = graph.metadata?.createdBy?.toLowerCase() || ''
      return (
        title.includes(query) ||
        createdBy.includes(query) ||
        graph.id?.toLowerCase().includes(query)
      )
    })
  }
  // Sort
  const dir = localSortDirection.value === 'desc' ? -1 : 1
  return filtered.slice().sort((a, b) => {
    let cmp = 0
    switch (localSortBy.value) {
      case 'title':
        cmp = (a.metadata?.title || '').localeCompare(b.metadata?.title || '')
        break
      case 'createdBy':
        cmp = (a.metadata?.createdBy || '').localeCompare(b.metadata?.createdBy || '')
        break
      case 'nodes':
        cmp = getNodeCount(b) - getNodeCount(a)
        break
      case 'updatedAt':
        cmp = new Date(b.metadata?.updatedAt || 0) - new Date(a.metadata?.updatedAt || 0)
        break
      default:
        cmp = 0
    }
    return cmp * dir
  })
})
</script>

<style scoped>
.graph-table-container {
  padding: 24px;
  overflow-x: auto;
}
.graph-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  font-size: 1rem;
}
.graph-table th,
.graph-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  text-align: left;
}
.graph-table th {
  background: #f8f9fa;
  cursor: pointer;
  user-select: none;
}
.graph-table th span {
  font-size: 0.9em;
  color: #007bff;
  margin-left: 4px;
}
.graph-table tr:last-child td {
  border-bottom: none;
}
.btn {
  font-size: 0.95em;
  padding: 5px 14px;
}
</style>
