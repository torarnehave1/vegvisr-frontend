<template>
  <div class="gnew-newsfeed-node">
    <div class="newsfeed-card">
      <!-- Feed Header -->
      <div class="feed-header">
        <div class="header-content">
          <h3 class="feed-title">
            <span class="title-icon">📰</span>
            {{ title }}
          </h3>
          <p v-if="subtitle" class="feed-subtitle">{{ subtitle }}</p>
        </div>
        <div class="header-actions">
          <button 
            v-if="canRefresh" 
            @click="refreshFeed" 
            class="refresh-btn"
            :class="{ 'loading': isRefreshing }"
            title="Oppdater"
          >
            🔄
          </button>
          <span class="article-count">{{ articles.length }} artikler</span>
        </div>
      </div>

      <!-- Source Filters -->
      <div v-if="availableSources.length > 1" class="source-filters">
        <button 
          v-for="source in availableSources" 
          :key="source.id"
          @click="toggleSourceFilter(source.id)"
          class="source-filter-btn"
          :class="{ 'active': !filteredSources.includes(source.id) }"
          :style="{ '--source-color': source.color }"
        >
          <span class="source-logo" v-html="source.logo"></span>
          <span class="source-name">{{ source.shortName }}</span>
        </button>
      </div>

      <!-- Articles List -->
      <div class="articles-container">
        <article 
          v-for="(article, index) in displayedArticles" 
          :key="index"
          class="article-card"
        >
          <!-- Article Source Badge -->
          <div class="article-source" :style="{ backgroundColor: article.sourceColor }">
            <span class="source-logo-small" v-if="article.sourceLogo" v-html="article.sourceLogo"></span>
            <span class="source-name">{{ article.sourceShortName || article.sourceName }}</span>
          </div>

          <!-- Article Content -->
          <div class="article-content">
            <a :href="article.link" target="_blank" rel="noopener" class="article-title-link">
              <h4 class="article-title">{{ article.title }}</h4>
            </a>
            <p v-if="article.description" class="article-description">
              {{ truncateText(article.description, 200) }}
            </p>
            <div class="article-meta">
              <span v-if="article.pubDate" class="meta-date">
                📅 {{ formatDate(article.pubDate) }}
              </span>
              <span v-if="article.category" class="meta-category">
                🏷️ {{ article.category }}
              </span>
              <span v-if="article.relevance" class="meta-relevance" :class="getRelevanceClass(article.relevance)">
                {{ formatRelevance(article.relevance) }}
              </span>
            </div>
          </div>

          <!-- Article Actions -->
          <div class="article-actions">
            <a :href="article.link" target="_blank" class="action-btn read-more">
              Les mer →
            </a>
            <button @click="addToGraph(article)" class="action-btn add-to-graph" title="Legg til i graf">
              📊
            </button>
          </div>
        </article>

        <!-- Empty State -->
        <div v-if="displayedArticles.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <p>Ingen artikler funnet</p>
          <p class="empty-hint" v-if="filteredSources.length > 0">
            Prøv å fjerne noen filtre
          </p>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="hasMore" class="load-more">
        <button @click="loadMore" class="load-more-btn">
          Vis flere artikler ({{ remainingCount }})
        </button>
      </div>

      <!-- Feed Footer -->
      <div class="feed-footer">
        <div class="footer-sources">
          <span class="footer-label">Kilder:</span>
          <div class="source-logos">
            <span 
              v-for="source in uniqueSources" 
              :key="source.id"
              class="footer-source"
              :title="source.name"
              v-html="source.logo"
            ></span>
          </div>
        </div>
        <span v-if="lastUpdated" class="last-updated">
          Oppdatert: {{ formatDate(lastUpdated) }}
        </span>
      </div>

      <!-- Node Controls -->
      <div v-if="showControls && !isPreview" class="node-controls">
        <button @click="editNode" class="btn btn-sm btn-outline-primary" title="Rediger">
          ✏️
        </button>
        <button @click="deleteNode" class="btn btn-sm btn-outline-danger" title="Slett">
          🗑️
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  graphData: {
    type: Object,
    default: () => ({ nodes: [], edges: [] })
  },
  isPreview: {
    type: Boolean,
    default: false
  },
  showControls: {
    type: Boolean,
    default: true
  },
  graphId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['node-updated', 'node-deleted', 'node-created'])

// State
const isRefreshing = ref(false)
const displayLimit = ref(5)
const filteredSources = ref([])

// Parse node data
const nodeData = computed(() => {
  if (props.node.data && typeof props.node.data === 'object') {
    return props.node.data
  }
  if (props.node.info) {
    try {
      const parsed = JSON.parse(props.node.info)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch (e) {
      // Not JSON
    }
  }
  return props.node
})

// Computed
const title = computed(() => nodeData.value.title || props.node.label || 'Nyhetsstrøm')
const subtitle = computed(() => nodeData.value.subtitle || nodeData.value.query)
const canRefresh = computed(() => nodeData.value.refreshable !== false)
const lastUpdated = computed(() => nodeData.value.lastUpdated || nodeData.value.timestamp)

const articles = computed(() => {
  const results = nodeData.value.results || nodeData.value.articles || []
  return results.map(article => ({
    ...article,
    sourceColor: article.sourceColor || '#6c757d',
    sourceShortName: article.sourceShortName || article.source?.toUpperCase()?.slice(0, 3)
  }))
})

const availableSources = computed(() => {
  const sourceMap = new Map()
  articles.value.forEach(article => {
    if (article.source && !sourceMap.has(article.source)) {
      sourceMap.set(article.source, {
        id: article.source,
        name: article.sourceName || article.source,
        shortName: article.sourceShortName || article.source.slice(0, 3).toUpperCase(),
        color: article.sourceColor || '#6c757d',
        logo: article.sourceLogo || ''
      })
    }
  })
  return Array.from(sourceMap.values())
})

const uniqueSources = computed(() => availableSources.value)

const filteredArticles = computed(() => {
  if (filteredSources.value.length === 0) {
    return articles.value
  }
  return articles.value.filter(a => !filteredSources.value.includes(a.source))
})

const displayedArticles = computed(() => {
  return filteredArticles.value.slice(0, displayLimit.value)
})

const hasMore = computed(() => filteredArticles.value.length > displayLimit.value)
const remainingCount = computed(() => filteredArticles.value.length - displayLimit.value)

// Methods
const truncateText = (text, maxLength) => {
  if (!text) return ''
  // Decode HTML entities first
  const decoded = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  
  if (decoded.length <= maxLength) return decoded
  return decoded.slice(0, maxLength).trim() + '...'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffHours < 1) return 'Nå'
    if (diffHours < 24) return `${diffHours}t siden`
    if (diffDays < 7) return `${diffDays}d siden`
    
    return date.toLocaleDateString('nb-NO', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  } catch (e) {
    return dateStr
  }
}

const formatRelevance = (relevance) => {
  if (!relevance && relevance !== 0) return ''
  const percent = Math.round(relevance * 100)
  return `${percent}% treff`
}

const getRelevanceClass = (relevance) => {
  if (!relevance) return ''
  if (relevance >= 0.7) return 'high'
  if (relevance >= 0.4) return 'medium'
  return 'low'
}

const toggleSourceFilter = (sourceId) => {
  const index = filteredSources.value.indexOf(sourceId)
  if (index === -1) {
    filteredSources.value.push(sourceId)
  } else {
    filteredSources.value.splice(index, 1)
  }
}

const loadMore = () => {
  displayLimit.value += 5
}

const refreshFeed = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  
  // Emit event for parent to handle refresh
  emit('node-updated', { 
    ...props.node, 
    _action: 'refresh-feed',
    _refreshParams: {
      query: nodeData.value.query,
      sources: nodeData.value.sources
    }
  })
  
  // Reset after animation
  setTimeout(() => {
    isRefreshing.value = false
  }, 1000)
}

const addToGraph = (article) => {
  emit('node-created', {
    type: 'fulltext',
    label: article.title,
    info: `**${article.title}**\n\n${article.description || ''}\n\n[Les mer](${article.link})\n\n---\n*Kilde: ${article.sourceName} - ${formatDate(article.pubDate)}*`
  })
}

const editNode = () => {
  emit('node-updated', { ...props.node, _action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Er du sikker på at du vil slette denne noden?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-newsfeed-node {
  margin: 16px 0;
}

.newsfeed-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

/* Header */
.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  color: white;
}

.header-content {
  flex: 1;
}

.feed-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.3rem;
}

.feed-subtitle {
  margin: 8px 0 0 0;
  opacity: 0.8;
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: rgba(255,255,255,0.25);
}

.refresh-btn.loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.article-count {
  padding: 4px 12px;
  background: rgba(255,255,255,0.15);
  border-radius: 12px;
  font-size: 0.8rem;
}

/* Source Filters */
.source-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 24px;
  background: #f7fafc;
  border-bottom: 1px solid #e2e8f0;
}

.source-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 2px solid transparent;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
  opacity: 0.5;
}

.source-filter-btn.active {
  opacity: 1;
  border-color: var(--source-color, #3182ce);
  background: color-mix(in srgb, var(--source-color, #3182ce) 10%, white);
}

.source-filter-btn:hover {
  opacity: 1;
}

.source-logo {
  width: 20px;
  height: 20px;
}

.source-logo :deep(svg) {
  width: 100%;
  height: 100%;
}

/* Articles */
.articles-container {
  padding: 16px 24px;
}

.article-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  margin-bottom: 12px;
  background: #f7fafc;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.article-card:hover {
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--source-color, #3182ce);
}

.article-card:last-child {
  margin-bottom: 0;
}

.article-source {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  align-self: flex-start;
}

.source-logo-small {
  width: 16px;
  height: 16px;
}

.source-logo-small :deep(svg) {
  width: 100%;
  height: 100%;
}

.article-content {
  flex: 1;
}

.article-title-link {
  text-decoration: none;
}

.article-title {
  margin: 0 0 8px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  line-height: 1.4;
  transition: color 0.2s;
}

.article-title-link:hover .article-title {
  color: #3182ce;
}

.article-description {
  margin: 0 0 10px 0;
  color: #4a5568;
  font-size: 0.9rem;
  line-height: 1.5;
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.8rem;
  color: #718096;
}

.meta-relevance {
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.meta-relevance.high {
  background: #c6f6d5;
  color: #22543d;
}

.meta-relevance.medium {
  background: #fefcbf;
  color: #744210;
}

.meta-relevance.low {
  background: #fed7d7;
  color: #742a2a;
}

.article-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.read-more {
  background: #3182ce;
  color: white;
}

.read-more:hover {
  background: #2c5282;
}

.add-to-graph {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
}

.add-to-graph:hover {
  background: #edf2f7;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #718096;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 0.85rem;
  color: #a0aec0;
}

/* Load More */
.load-more {
  padding: 16px 24px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.load-more-btn {
  padding: 10px 24px;
  background: white;
  border: 2px solid #3182ce;
  border-radius: 8px;
  color: #3182ce;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover {
  background: #3182ce;
  color: white;
}

/* Footer */
.feed-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #f7fafc;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #718096;
}

.footer-sources {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-logos {
  display: flex;
  gap: 6px;
}

.footer-source {
  width: 24px;
  height: 24px;
}

.footer-source :deep(svg) {
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

/* Controls */
.node-controls {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

/* Responsive */
@media (max-width: 640px) {
  .feed-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .article-meta {
    flex-direction: column;
    gap: 6px;
  }
  
  .feed-footer {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
}
</style>
