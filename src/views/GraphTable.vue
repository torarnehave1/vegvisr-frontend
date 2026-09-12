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
          <th>Published Site</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="graph in sortedGraphs" :key="graph.id">
          <td>{{ graph.metadata?.title || 'Untitled Graph' }}</td>
          <td>{{ graph.metadata?.createdBy || 'Unknown' }}</td>
          <td>{{ getNodeCount(graph) }}</td>
          <td>{{ formatDate(graph.metadata?.updatedAt) }}</td>
          <td class="published-domains">
            <a
              v-for="domain in getPublishedDomains(graph)"
              :key="domain"
              :href="`https://${domain}`"
              target="_blank"
              rel="noopener"
              :title="`Open https://${domain}`"
            >
              {{ domain }}
            </a>
            <span v-if="!getPublishedDomains(graph).length" class="text-muted">—</span>
          </td>
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

function getPublishedDomains(graph) {
  return Array.isArray(graph?.publishedDomains) ? graph.publishedDomains : []
}

function getNodeCount(graph) {
  if (Number.isFinite(graph?.nodeCount)) return graph.nodeCount
  return Array.isArray(graph?.nodes) ? graph.nodes.length : 0
}

// `graphs` arrives already filtered by GraphPortfolio (search query, meta area,
// owner). Re-filtering here on title/createdBy/id only threw away every row for
// searches the portfolio understands but this narrow filter did not — domains,
// #metaArea, :has-seo, node labels. Sort only.
const sortedGraphs = computed(() => {
  const filtered = props.graphs
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
.graph-table td.published-domains {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
}

.graph-table td.published-domains a {
  color: #0d9488;
  text-decoration: none;
}

.graph-table td.published-domains a:hover {
  text-decoration: underline;
}

.graph-table tr:last-child td {
  border-bottom: none;
}
.btn {
  font-size: 0.95em;
  padding: 5px 14px;
}
</style>
