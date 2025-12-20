<template>
  <div class="case-study-builder">
    <!-- Header -->
    <header class="builder-header">
      <div class="header-content">
        <h1>
          <span class="header-icon">📊</span>
          Case Study Builder
        </h1>
        <p class="header-subtitle">Bygg visuelle case studies med Proff-data, nyheter og egendefinert innhold</p>
      </div>
      <div class="header-actions">
        <button @click="resetBuilder" class="btn btn-outline">
          🔄 Nullstill
        </button>
        <button @click="generateCaseStudy" class="btn btn-primary" :disabled="!canGenerate">
          ✨ Generer Case Study
        </button>
      </div>
    </header>

    <div class="builder-layout">
      <!-- Left Panel: Search & Add -->
      <aside class="search-panel">
        <div class="panel-section">
          <h3>🔍 Søk i Proff</h3>
          <div class="search-box">
            <input
              v-model="searchQuery"
              @keyup.enter="searchProff"
              type="text"
              placeholder="Søk etter person eller bedrift..."
              class="search-input"
            />
            <button @click="searchProff" class="search-btn" :disabled="isSearching">
              {{ isSearching ? '⏳' : '🔍' }}
            </button>
          </div>

          <!-- Search Type Toggle -->
          <div class="search-type-toggle">
            <button
              @click="searchType = 'person'"
              :class="{ active: searchType === 'person' }"
            >
              👤 Person
            </button>
            <button
              @click="searchType = 'company'"
              :class="{ active: searchType === 'company' }"
            >
              🏢 Bedrift
            </button>
          </div>

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="search-results">
            <h4>Resultater ({{ searchResults.length }})</h4>
            <div
              v-for="result in searchResults"
              :key="result.id"
              class="search-result-item"
              @click="addToSelection(result)"
            >
              <span class="result-icon">{{ result.type === 'person' ? '👤' : '🏢' }}</span>
              <div class="result-info">
                <span class="result-name">{{ result.name }}</span>
                <span class="result-detail">{{ result.detail }}</span>
              </div>
              <button class="add-btn">+</button>
            </div>
          </div>

          <!-- No Results -->
          <div v-else-if="hasSearched && !isSearching" class="no-results">
            <p>Ingen resultater funnet for "{{ lastSearchQuery }}"</p>
          </div>
        </div>

        <!-- News Search -->
        <div class="panel-section">
          <h3>📰 Legg til nyheter</h3>
          <div class="search-box">
            <input
              v-model="newsQuery"
              @keyup.enter="searchNews"
              type="text"
              placeholder="Søkeord for nyheter..."
              class="search-input"
            />
            <button @click="searchNews" class="search-btn" :disabled="isSearchingNews">
              {{ isSearchingNews ? '⏳' : '📰' }}
            </button>
          </div>

          <!-- News Sources -->
          <div class="news-sources">
            <label v-for="source in availableSources" :key="source.id" class="source-checkbox">
              <input type="checkbox" v-model="selectedSources" :value="source.id" />
              <span>{{ source.name }}</span>
            </label>
          </div>

          <!-- News Results -->
          <div v-if="newsResults.length > 0" class="news-results">
            <div
              v-for="(article, idx) in newsResults.slice(0, 5)"
              :key="idx"
              class="news-item"
              @click="addNewsToSelection(article)"
            >
              <span class="news-source">{{ article.source }}</span>
              <span class="news-title">{{ truncate(article.title, 60) }}</span>
              <button class="add-btn">+</button>
            </div>
          </div>
        </div>

        <!-- Custom Content -->
        <div class="panel-section">
          <h3>✏️ Egendefinert innhold</h3>
          <div class="custom-content-form">
            <select v-model="customContentType" class="custom-type-select">
              <option value="note">📝 Notat</option>
              <option value="link">🔗 Ekstern lenke</option>
              <option value="quote">💬 Sitat</option>
              <option value="highlight">⭐ Fremhevet punkt</option>
            </select>
            <textarea
              v-model="customContentText"
              placeholder="Skriv inn innhold..."
              class="custom-textarea"
              rows="3"
            ></textarea>
            <input
              v-if="customContentType === 'link'"
              v-model="customContentUrl"
              type="url"
              placeholder="https://..."
              class="custom-url-input"
            />
            <button @click="addCustomContent" class="btn btn-secondary btn-sm">
              Legg til
            </button>
          </div>
        </div>
      </aside>

      <!-- Center: Selected Items -->
      <main class="selection-panel">
        <div class="panel-header">
          <h2>📋 Valgt innhold</h2>
          <span class="item-count">{{ totalSelectedItems }} elementer</span>
        </div>

        <!-- Case Study Title -->
        <div class="case-title-section">
          <label>Case Study Tittel</label>
          <input
            v-model="caseTitle"
            type="text"
            placeholder="F.eks. 'Christine Myrseth - Naturvernleder'"
            class="title-input"
          />
        </div>

        <!-- Selected Persons -->
        <div v-if="selectedPersons.length > 0" class="selection-group">
          <h3>👤 Personer ({{ selectedPersons.length }})</h3>
          <div class="sortable-list">
            <div
              v-for="(element, index) in selectedPersons"
              :key="element.id"
              class="selected-item person-item"
            >
              <span class="drag-handle">⋮⋮</span>
              <div class="item-content">
                <strong>{{ element.name }}</strong>
                <span class="item-detail">{{ element.detail }}</span>

                <!-- Adjustable Settings -->
                <div class="item-settings">
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showRoles" />
                    Vis roller
                  </label>
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showConnections" />
                    Vis forbindelser
                  </label>
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showNetwork" />
                    Generer nettverkskart
                  </label>
                </div>
              </div>
              <div class="item-actions">
                <button v-if="index > 0" @click="moveItem('persons', index, -1)" class="move-btn" title="Flytt opp">↑</button>
                <button v-if="index < selectedPersons.length - 1" @click="moveItem('persons', index, 1)" class="move-btn" title="Flytt ned">↓</button>
                <button @click="removeItem('persons', index)" class="remove-btn">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Companies -->
        <div v-if="selectedCompanies.length > 0" class="selection-group">
          <h3>🏢 Bedrifter ({{ selectedCompanies.length }})</h3>
          <div class="sortable-list">
            <div
              v-for="(element, index) in selectedCompanies"
              :key="element.id"
              class="selected-item company-item"
            >
              <span class="drag-handle">⋮⋮</span>
              <div class="item-content">
                <strong>{{ element.name }}</strong>
                <span class="item-detail">Org.nr: {{ element.orgNumber }}</span>

                <div class="item-settings">
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showFinancials" />
                    Vis økonomi
                  </label>
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showBoard" />
                    Vis styre
                  </label>
                  <label class="setting-checkbox">
                    <input type="checkbox" v-model="element.showAddress" />
                    Vis adresse
                  </label>
                </div>
              </div>
              <div class="item-actions">
                <button v-if="index > 0" @click="moveItem('companies', index, -1)" class="move-btn" title="Flytt opp">↑</button>
                <button v-if="index < selectedCompanies.length - 1" @click="moveItem('companies', index, 1)" class="move-btn" title="Flytt ned">↓</button>
                <button @click="removeItem('companies', index)" class="remove-btn">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected News -->
        <div v-if="selectedNews.length > 0" class="selection-group">
          <h3>📰 Nyheter ({{ selectedNews.length }})</h3>
          <div class="sortable-list">
            <div
              v-for="(element, index) in selectedNews"
              :key="element.id"
              class="selected-item news-item-selected"
            >
              <span class="drag-handle">⋮⋮</span>
              <div class="item-content">
                <strong>{{ truncate(element.title, 50) }}</strong>
                <span class="item-detail">{{ element.source }} - {{ formatDate(element.pubDate) }}</span>
              </div>
              <div class="item-actions">
                <button v-if="index > 0" @click="moveItem('news', index, -1)" class="move-btn" title="Flytt opp">↑</button>
                <button v-if="index < selectedNews.length - 1" @click="moveItem('news', index, 1)" class="move-btn" title="Flytt ned">↓</button>
                <button @click="removeItem('news', index)" class="remove-btn">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Content -->
        <div v-if="customContents.length > 0" class="selection-group">
          <h3>✏️ Egendefinert ({{ customContents.length }})</h3>
          <div class="sortable-list">
            <div
              v-for="(element, index) in customContents"
              :key="element.id"
              class="selected-item custom-item"
            >
              <span class="drag-handle">⋮⋮</span>
              <div class="item-content">
                <span class="custom-type-badge">{{ getCustomTypeIcon(element.type) }}</span>
                <span class="custom-text">{{ truncate(element.text, 60) }}</span>
              </div>
              <div class="item-actions">
                <button v-if="index > 0" @click="moveItem('custom', index, -1)" class="move-btn" title="Flytt opp">↑</button>
                <button v-if="index < customContents.length - 1" @click="moveItem('custom', index, 1)" class="move-btn" title="Flytt ned">↓</button>
                <button @click="removeItem('custom', index)" class="remove-btn">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="totalSelectedItems === 0" class="empty-selection">
          <span class="empty-icon">📭</span>
          <p>Ingen elementer valgt ennå</p>
          <p class="empty-hint">Bruk søkefeltet til venstre for å legge til personer, bedrifter eller nyheter</p>
        </div>
      </main>

      <!-- Right Panel: Preview -->
      <aside class="preview-panel">
        <div class="panel-header">
          <h2>👁️ Forhåndsvisning</h2>
          <div class="preview-actions">
            <button @click="previewMode = 'cards'" :class="{ active: previewMode === 'cards' }">
              📇 Kort
            </button>
            <button @click="previewMode = 'list'" :class="{ active: previewMode === 'list' }">
              📋 Liste
            </button>
          </div>
        </div>

        <div class="preview-content">
          <!-- Title Preview -->
          <div v-if="caseTitle" class="preview-title">
            <h3>{{ caseTitle }}</h3>
          </div>

          <!-- Cards Preview -->
          <div v-if="previewMode === 'cards'" class="preview-cards">
            <!-- Person Cards -->
            <div
              v-for="person in selectedPersons"
              :key="'p-' + person.id"
              class="preview-card person-card"
            >
              <div class="card-avatar">{{ getInitials(person.name) }}</div>
              <div class="card-info">
                <h4>{{ person.name }}</h4>
                <p v-if="person.showRoles">{{ person.rolesCount || 0 }} roller</p>
                <p v-if="person.showConnections">{{ person.connectionsCount || 0 }} forbindelser</p>
              </div>
            </div>

            <!-- Company Cards -->
            <div
              v-for="company in selectedCompanies"
              :key="'c-' + company.id"
              class="preview-card company-card"
            >
              <div class="card-icon">🏢</div>
              <div class="card-info">
                <h4>{{ company.name }}</h4>
                <p>{{ company.industry || 'Ukjent bransje' }}</p>
              </div>
            </div>

            <!-- News Preview -->
            <div v-if="selectedNews.length > 0" class="preview-card news-card">
              <div class="card-icon">📰</div>
              <div class="card-info">
                <h4>Nyhetsstrøm</h4>
                <p>{{ selectedNews.length }} artikler</p>
              </div>
            </div>
          </div>

          <!-- Node Structure Preview -->
          <div class="node-structure">
            <h4>Noder som vil genereres:</h4>
            <ul class="node-list">
              <li v-if="caseTitle">
                <span class="node-type">title</span>
                Case Study tittel
              </li>
              <li v-for="person in selectedPersons" :key="'node-p-' + person.id">
                <span class="node-type">person-profile</span>
                {{ person.name }}
              </li>
              <li v-for="person in selectedPersons.filter(p => p.showNetwork)" :key="'node-n-' + person.id">
                <span class="node-type">network</span>
                Nettverk: {{ person.name }}
              </li>
              <li v-for="company in selectedCompanies" :key="'node-c-' + company.id">
                <span class="node-type">company-card</span>
                {{ company.name }}
              </li>
              <li v-if="selectedNews.length > 0">
                <span class="node-type">news-feed</span>
                Nyhetsstrøm ({{ selectedNews.length }})
              </li>
              <li v-for="custom in customContents" :key="'node-x-' + custom.id">
                <span class="node-type">fulltext</span>
                {{ getCustomTypeIcon(custom.type) }} {{ truncate(custom.text, 30) }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Generation Options -->
        <div class="generation-options">
          <h4>Genereringsvalg</h4>
          <label class="option-checkbox">
            <input type="checkbox" v-model="generateOptions.createNewGraph" />
            Opprett ny graf
          </label>
          <label class="option-checkbox">
            <input type="checkbox" v-model="generateOptions.addToCurrentGraph" />
            Legg til i gjeldende graf
          </label>
          <label class="option-checkbox">
            <input type="checkbox" v-model="generateOptions.includeAIAnalysis" />
            Inkluder AI-analyse
          </label>
        </div>
      </aside>
    </div>

    <!-- Generation Modal -->
    <div v-if="showGeneratingModal" class="generating-modal-overlay">
      <div class="generating-modal">
        <div class="generating-spinner"></div>
        <h3>Genererer Case Study...</h3>
        <p>{{ generatingStatus }}</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: generatingProgress + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// State
const searchQuery = ref('')
const searchType = ref('person')
const searchResults = ref([])
const isSearching = ref(false)
const hasSearched = ref(false)
const lastSearchQuery = ref('')

const newsQuery = ref('')
const newsResults = ref([])
const isSearchingNews = ref(false)
const selectedSources = ref(['sabima', 'naturvern', 'bellona'])
const availableSources = [
  { id: 'sabima', name: 'SABIMA' },
  { id: 'naturvern', name: 'Naturvernforbundet' },
  { id: 'bellona', name: 'Bellona' },
  { id: 'nrk', name: 'NRK' },
  { id: 'vg', name: 'VG' },
]

// Selected items
const caseTitle = ref('')
const selectedPersons = ref([])
const selectedCompanies = ref([])
const selectedNews = ref([])
const customContents = ref([])

// Custom content form
const customContentType = ref('note')
const customContentText = ref('')
const customContentUrl = ref('')

// Preview
const previewMode = ref('cards')

// Generation
const generateOptions = ref({
  createNewGraph: true,
  addToCurrentGraph: false,
  includeAIAnalysis: true
})
const showGeneratingModal = ref(false)
const generatingStatus = ref('')
const generatingProgress = ref(0)

// Computed
const totalSelectedItems = computed(() => {
  return selectedPersons.value.length +
         selectedCompanies.value.length +
         selectedNews.value.length +
         customContents.value.length
})

const canGenerate = computed(() => {
  return totalSelectedItems.value > 0 && caseTitle.value.trim()
})

// Methods
const searchProff = async () => {
  if (!searchQuery.value.trim()) return

  isSearching.value = true
  hasSearched.value = false
  lastSearchQuery.value = searchQuery.value
  searchResults.value = []

  try {
    const endpoint = searchType.value === 'person'
      ? `https://proff.vegvisr.org/person/search?query=${encodeURIComponent(searchQuery.value)}`
      : `https://proff.vegvisr.org/company/search?query=${encodeURIComponent(searchQuery.value)}`

    const response = await fetch(endpoint)
    const data = await response.json()

    if (data.success) {
      if (searchType.value === 'person' && data.persons) {
        searchResults.value = data.persons.map(p => ({
          type: 'person',
          id: p.personId,
          personId: p.personId,
          name: p.name,
          detail: `${p.location?.municipality || 'Ukjent'} • ${p.age || '?'} år`,
          age: p.age,
          gender: p.gender,
          location: p.location,
          rolesCount: p.numberOfRoles || 0,
          connectionsCount: p.numberOfConnections || 0,
          showRoles: true,
          showConnections: true,
          showNetwork: false
        }))
      } else if (searchType.value === 'company' && data.companies) {
        searchResults.value = data.companies.map(c => ({
          type: 'company',
          id: c.organisationNumber,
          orgNumber: c.organisationNumber,
          name: c.name,
          detail: c.naceDescription || 'Ukjent bransje',
          industry: c.naceDescription,
          employees: c.employees,
          showFinancials: true,
          showBoard: true,
          showAddress: true
        }))
      }
    }
  } catch (error) {
    console.error('Search error:', error)
  } finally {
    isSearching.value = false
    hasSearched.value = true
  }
}

const searchNews = async () => {
  if (!newsQuery.value.trim()) return

  isSearchingNews.value = true
  newsResults.value = []

  try {
    const sources = selectedSources.value.join(',')
    const response = await fetch(
      `https://sources-worker.torarnehave.workers.dev/search?query=${encodeURIComponent(newsQuery.value)}&sources=${sources}&days=90`
    )
    const data = await response.json()

    if (data.results) {
      newsResults.value = data.results.map((r, idx) => ({
        id: `news-${idx}-${Date.now()}`,
        title: r.title,
        description: r.description,
        link: r.link,
        pubDate: r.pubDate,
        source: r.source,
        sourceName: r.sourceName,
        sourceColor: r.sourceColor
      }))
    }
  } catch (error) {
    console.error('News search error:', error)
  } finally {
    isSearchingNews.value = false
  }
}

const addToSelection = (result) => {
  if (result.type === 'person') {
    if (!selectedPersons.value.find(p => p.id === result.id)) {
      selectedPersons.value.push({ ...result })
    }
  } else {
    if (!selectedCompanies.value.find(c => c.id === result.id)) {
      selectedCompanies.value.push({ ...result })
    }
  }
}

const addNewsToSelection = (article) => {
  if (!selectedNews.value.find(n => n.link === article.link)) {
    selectedNews.value.push({ ...article })
  }
}

const addCustomContent = () => {
  if (!customContentText.value.trim()) return

  customContents.value.push({
    id: `custom-${Date.now()}`,
    type: customContentType.value,
    text: customContentText.value,
    url: customContentUrl.value || null
  })

  customContentText.value = ''
  customContentUrl.value = ''
}

const removeItem = (type, index) => {
  switch (type) {
    case 'persons':
      selectedPersons.value.splice(index, 1)
      break
    case 'companies':
      selectedCompanies.value.splice(index, 1)
      break
    case 'news':
      selectedNews.value.splice(index, 1)
      break
    case 'custom':
      customContents.value.splice(index, 1)
      break
  }
}

const moveItem = (type, index, direction) => {
  let array
  switch (type) {
    case 'persons':
      array = selectedPersons.value
      break
    case 'companies':
      array = selectedCompanies.value
      break
    case 'news':
      array = selectedNews.value
      break
    case 'custom':
      array = customContents.value
      break
    default:
      return
  }

  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= array.length) return

  const item = array.splice(index, 1)[0]
  array.splice(newIndex, 0, item)
}

const resetBuilder = () => {
  if (confirm('Er du sikker på at du vil nullstille? Alt valgt innhold vil fjernes.')) {
    caseTitle.value = ''
    selectedPersons.value = []
    selectedCompanies.value = []
    selectedNews.value = []
    customContents.value = []
    searchResults.value = []
    newsResults.value = []
  }
}

const generateCaseStudy = async () => {
  if (!canGenerate.value) return

  showGeneratingModal.value = true
  generatingProgress.value = 0
  generatingStatus.value = 'Forbereder data...'

  try {
    const nodes = []
    let order = 1

    // Title node
    generatingStatus.value = 'Oppretter tittelnode...'
    generatingProgress.value = 10
    nodes.push({
      id: `cs-title-${Date.now()}`,
      type: 'title',
      label: caseTitle.value,
      info: caseTitle.value,
      order: order++,
      visible: true
    })

    // Person nodes
    for (const person of selectedPersons.value) {
      generatingStatus.value = `Henter data for ${person.name}...`
      generatingProgress.value = 20 + (30 * nodes.length / (selectedPersons.value.length + selectedCompanies.value.length))

      // Fetch full person data
      let personData = person
      try {
        const response = await fetch(`https://proff.vegvisr.org/person/${person.personId}`)
        const data = await response.json()
        if (data.success && data.person) {
          personData = { ...person, ...data.person }
        }
      } catch (e) {
        console.warn('Could not fetch person details:', e)
      }

      nodes.push({
        id: `cs-person-${person.id}-${Date.now()}`,
        type: 'person-profile',
        label: person.name,
        data: {
          personId: person.personId,
          name: person.name,
          age: personData.age,
          gender: personData.gender,
          location: personData.location,
          roles: personData.roles || [],
          connections: personData.connections || [],
          industryConnections: personData.industryConnections || [],
          showRoles: person.showRoles,
          showConnections: person.showConnections
        },
        order: order++,
        visible: true
      })

      // Network node if requested
      if (person.showNetwork) {
        nodes.push({
          id: `cs-network-${person.id}-${Date.now()}`,
          type: 'network',
          label: `Nettverk: ${person.name}`,
          data: {
            title: `${person.name} - Nettverkskart`,
            centerPerson: {
              id: person.personId,
              name: person.name,
              type: 'person'
            },
            paths: [],
            connections: personData.connections || []
          },
          order: order++,
          visible: true
        })
      }
    }

    // Company nodes
    for (const company of selectedCompanies.value) {
      generatingStatus.value = `Henter data for ${company.name}...`
      generatingProgress.value = 50 + (20 * nodes.length / (selectedPersons.value.length + selectedCompanies.value.length))

      let companyData = company
      try {
        const response = await fetch(`https://proff.vegvisr.org/company/${company.orgNumber}`)
        const data = await response.json()
        if (data.success && data.company) {
          companyData = { ...company, ...data.company }
        }
      } catch (e) {
        console.warn('Could not fetch company details:', e)
      }

      nodes.push({
        id: `cs-company-${company.id}-${Date.now()}`,
        type: 'company-card',
        label: company.name,
        data: {
          organisationNumber: company.orgNumber,
          name: company.name,
          naceDescription: companyData.naceDescription,
          employees: companyData.employees,
          foundedYear: companyData.foundedYear,
          address: companyData.address,
          boardMembers: companyData.boardMembers || [],
          financials: companyData.financials || {},
          showFinancials: company.showFinancials,
          showBoard: company.showBoard,
          showAddress: company.showAddress
        },
        order: order++,
        visible: true
      })
    }

    // News feed node
    if (selectedNews.value.length > 0) {
      generatingStatus.value = 'Oppretter nyhetsstrøm...'
      generatingProgress.value = 80

      nodes.push({
        id: `cs-news-${Date.now()}`,
        type: 'news-feed',
        label: 'Relaterte nyheter',
        data: {
          title: 'Relaterte nyheter',
          subtitle: newsQuery.value || 'Case Study nyheter',
          results: selectedNews.value.map(n => ({
            title: n.title,
            description: n.description,
            link: n.link,
            pubDate: n.pubDate,
            source: n.source,
            sourceName: n.sourceName,
            sourceColor: n.sourceColor || '#6c757d'
          })),
          lastUpdated: new Date().toISOString()
        },
        order: order++,
        visible: true
      })
    }

    // Custom content nodes
    for (const custom of customContents.value) {
      generatingStatus.value = 'Legger til egendefinert innhold...'
      generatingProgress.value = 90

      let info = custom.text
      if (custom.type === 'link' && custom.url) {
        info = `[${custom.text}](${custom.url})`
      } else if (custom.type === 'quote') {
        info = `> ${custom.text}`
      } else if (custom.type === 'highlight') {
        info = `⭐ **${custom.text}**`
      }

      nodes.push({
        id: `cs-custom-${custom.id}`,
        type: 'fulltext',
        label: custom.type === 'note' ? 'Notat' : custom.type === 'quote' ? 'Sitat' : custom.type === 'link' ? 'Lenke' : 'Fremhevet',
        info: info,
        order: order++,
        visible: true
      })
    }

    generatingStatus.value = 'Ferdigstiller...'
    generatingProgress.value = 100

    // Store the generated case study
    const caseStudy = {
      title: caseTitle.value,
      nodes: nodes,
      edges: [],
      metadata: {
        createdAt: new Date().toISOString(),
        type: 'case-study',
        personsCount: selectedPersons.value.length,
        companiesCount: selectedCompanies.value.length,
        newsCount: selectedNews.value.length
      }
    }

    // Save to localStorage for now (can be saved to D1 later)
    localStorage.setItem('vegvisr-case-study-draft', JSON.stringify(caseStudy))

    setTimeout(() => {
      showGeneratingModal.value = false

      // Navigate to graph viewer with the case study
      if (generateOptions.value.createNewGraph) {
        router.push({
          name: 'GraphCanvas',
          query: { loadCaseStudy: 'true' }
        })
      }
    }, 500)

  } catch (error) {
    console.error('Generation error:', error)
    generatingStatus.value = 'Feil ved generering: ' + error.message
  }
}

// Helpers
const truncate = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

const getCustomTypeIcon = (type) => {
  switch (type) {
    case 'note': return '📝'
    case 'link': return '🔗'
    case 'quote': return '💬'
    case 'highlight': return '⭐'
    default: return '📄'
  }
}

// Load draft on mount
onMounted(() => {
  const draft = localStorage.getItem('vegvisr-case-study-builder-state')
  if (draft) {
    try {
      const state = JSON.parse(draft)
      caseTitle.value = state.caseTitle || ''
      selectedPersons.value = state.selectedPersons || []
      selectedCompanies.value = state.selectedCompanies || []
      selectedNews.value = state.selectedNews || []
      customContents.value = state.customContents || []
    } catch (e) {
      console.warn('Could not restore draft:', e)
    }
  }
})
</script>

<style scoped>
.case-study-builder {
  min-height: 100vh;
  background: #f7fafc;
}

/* Header */
.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
  color: white;
}

.header-content h1 {
  margin: 0;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 1.8rem;
}

.header-subtitle {
  margin: 8px 0 0 0;
  opacity: 0.8;
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #48bb78;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #38a169;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: transparent;
  border: 2px solid white;
  color: white;
}

.btn-outline:hover {
  background: rgba(255,255,255,0.1);
}

.btn-secondary {
  background: #4a5568;
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

/* Layout */
.builder-layout {
  display: grid;
  grid-template-columns: 320px 1fr 320px;
  gap: 20px;
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

/* Panels */
.search-panel,
.selection-panel,
.preview-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  overflow: hidden;
}

.panel-section {
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-section h3 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  color: #2d3748;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f7fafc;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.item-count {
  background: #3182ce;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
}

/* Search */
.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
}

.search-input:focus {
  border-color: #3182ce;
  outline: none;
}

.search-btn {
  padding: 10px 16px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.search-btn:hover:not(:disabled) {
  background: #2c5282;
}

.search-type-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-type-toggle button {
  flex: 1;
  padding: 8px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.search-type-toggle button.active {
  border-color: #3182ce;
  background: #ebf8ff;
  color: #3182ce;
}

/* Search Results */
.search-results,
.news-results {
  max-height: 300px;
  overflow-y: auto;
}

.search-results h4 {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #718096;
}

.search-result-item,
.news-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.search-result-item:hover,
.news-item:hover {
  background: #edf2f7;
  transform: translateX(4px);
}

.result-icon {
  font-size: 1.5rem;
}

.result-info {
  flex: 1;
}

.result-name {
  display: block;
  font-weight: 600;
  color: #2d3748;
}

.result-detail {
  font-size: 0.8rem;
  color: #718096;
}

.add-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #48bb78;
  background: white;
  color: #48bb78;
  font-size: 1.2rem;
  cursor: pointer;
}

.add-btn:hover {
  background: #48bb78;
  color: white;
}

/* News */
.news-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.source-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.news-source {
  font-size: 0.7rem;
  background: #4a5568;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
}

.news-title {
  flex: 1;
  font-size: 0.85rem;
}

/* Custom Content */
.custom-content-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.custom-type-select,
.custom-textarea,
.custom-url-input {
  padding: 10px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
}

.custom-textarea {
  resize: vertical;
}

/* Selection Panel */
.case-title-section {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.case-title-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #4a5568;
}

.title-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.title-input:focus {
  border-color: #3182ce;
  outline: none;
}

.selection-group {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.selection-group h3 {
  margin: 0 0 12px 0;
  font-size: 0.95rem;
  color: #4a5568;
}

.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selected-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.drag-handle {
  cursor: grab;
  color: #a0aec0;
  font-size: 1.2rem;
  padding: 4px;
}

.item-content {
  flex: 1;
}

.item-content strong {
  display: block;
  margin-bottom: 4px;
}

.item-detail {
  font-size: 0.8rem;
  color: #718096;
}

.item-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.setting-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: #fed7d7;
  color: #c53030;
  cursor: pointer;
}

.remove-btn:hover {
  background: #fc8181;
  color: white;
}

/* Empty States */
.empty-selection,
.no-results {
  padding: 40px 20px;
  text-align: center;
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

/* Preview Panel */
.preview-actions {
  display: flex;
  gap: 4px;
}

.preview-actions button {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.preview-actions button.active {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
}

.preview-content {
  padding: 16px 20px;
}

.preview-title h3 {
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #3182ce;
}

.preview-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.preview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 8px;
  border-left: 4px solid #3182ce;
}

.preview-card.person-card {
  border-left-color: #48bb78;
}

.preview-card.company-card {
  border-left-color: #ed8936;
}

.preview-card.news-card {
  border-left-color: #9f7aea;
}

.card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #48bb78;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.card-icon {
  font-size: 1.5rem;
}

.card-info h4 {
  margin: 0;
  font-size: 0.9rem;
}

.card-info p {
  margin: 4px 0 0 0;
  font-size: 0.8rem;
  color: #718096;
}

/* Node Structure */
.node-structure {
  background: #f7fafc;
  border-radius: 8px;
  padding: 16px;
}

.node-structure h4 {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #4a5568;
}

.node-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.node-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
  font-size: 0.85rem;
}

.node-list li:last-child {
  border-bottom: none;
}

.node-type {
  background: #2d3748;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: monospace;
}

/* Generation Options */
.generation-options {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

.generation-options h4 {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #4a5568;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

/* Modal */
.generating-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.generating-modal {
  background: white;
  padding: 40px;
  border-radius: 16px;
  text-align: center;
  max-width: 400px;
}

.generating-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top-color: #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.generating-modal h3 {
  margin: 0 0 12px 0;
}

.generating-modal p {
  color: #718096;
  margin: 0 0 20px 0;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3182ce, #48bb78);
  transition: width 0.3s;
}

/* Responsive */
@media (max-width: 1200px) {
  .builder-layout {
    grid-template-columns: 1fr;
  }

  .search-panel,
  .preview-panel {
    order: 2;
  }

  .selection-panel {
    order: 1;
  }
}
</style>
