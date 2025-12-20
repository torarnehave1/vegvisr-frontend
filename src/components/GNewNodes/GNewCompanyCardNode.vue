<template>
  <div class="gnew-company-card-node">
    <div class="company-card" :class="{ 'compact': isCompact, 'highlight': isHighlighted }">
      <!-- Company Header -->
      <div class="company-header">
        <div class="company-logo" :style="logoStyle">
          <span v-if="!companyLogo" class="logo-initials">{{ companyInitials }}</span>
          <img v-else :src="companyLogo" :alt="companyName" class="logo-image" />
        </div>
        <div class="company-info">
          <h3 class="company-name">{{ companyName }}</h3>
          <div class="company-org-nr">
            <span class="org-label">Org.nr:</span>
            <span class="org-number">{{ formattedOrgNr }}</span>
          </div>
          <div v-if="companyStatus" class="company-status" :class="statusClass">
            {{ companyStatus }}
          </div>
        </div>
        <a :href="proffLink" target="_blank" rel="noopener" class="proff-badge" title="Se på Proff.no">
          <img src="@/assets/proff.svg" alt="Proff" class="proff-logo-small" />
        </a>
      </div>

      <!-- Quick Stats -->
      <div class="company-stats">
        <div v-if="employees" class="stat-item">
          <span class="stat-icon">👥</span>
          <span class="stat-value">{{ employees }}</span>
          <span class="stat-label">ansatte</span>
        </div>
        <div v-if="founded" class="stat-item">
          <span class="stat-icon">📅</span>
          <span class="stat-value">{{ founded }}</span>
          <span class="stat-label">etablert</span>
        </div>
        <div v-if="industry" class="stat-item industry-stat">
          <span class="stat-icon">🏭</span>
          <span class="stat-value">{{ industry }}</span>
        </div>
      </div>

      <!-- Financial Summary (if available) -->
      <div v-if="hasFinancials" class="financial-section">
        <h4 class="section-title">
          <span class="section-icon">📊</span> Økonomi {{ latestYear }}
        </h4>
        <div class="financial-grid">
          <div class="financial-item" v-if="revenue">
            <span class="financial-label">Omsetning</span>
            <span class="financial-value">{{ formatCurrency(revenue) }}</span>
            <span v-if="revenueChange" class="financial-change" :class="revenueChange > 0 ? 'positive' : 'negative'">
              {{ revenueChange > 0 ? '↑' : '↓' }} {{ Math.abs(revenueChange) }}%
            </span>
          </div>
          <div class="financial-item" v-if="result">
            <span class="financial-label">Resultat</span>
            <span class="financial-value" :class="result >= 0 ? 'positive' : 'negative'">
              {{ formatCurrency(result) }}
            </span>
          </div>
          <div class="financial-item" v-if="ebitda">
            <span class="financial-label">EBITDA</span>
            <span class="financial-value">{{ formatCurrency(ebitda) }}</span>
          </div>
        </div>
      </div>

      <!-- Address Section -->
      <div v-if="address" class="address-section">
        <h4 class="section-title">
          <span class="section-icon">📍</span> Adresse
        </h4>
        <div class="address-content">
          <p v-if="address.addressLine" class="address-line">{{ address.addressLine }}</p>
          <p v-if="address.zipCode || address.postPlace" class="address-line">
            {{ address.zipCode }} {{ address.postPlace }}
          </p>
        </div>
        <a v-if="mapLink" :href="mapLink" target="_blank" class="map-link">
          🗺️ Vis på kart
        </a>
      </div>

      <!-- Board Members Preview -->
      <div v-if="boardMembers.length > 0" class="board-section">
        <h4 class="section-title">
          <span class="section-icon">👔</span> Styre ({{ boardMembers.length }})
        </h4>
        <div class="board-members">
          <div
            v-for="(member, index) in displayedBoardMembers"
            :key="index"
            class="board-member"
            @click="emitMemberClick(member)"
          >
            <span class="member-avatar" :class="member.gender === 'K' ? 'female' : 'male'">
              {{ member.gender === 'K' ? '👩' : '👨' }}
            </span>
            <div class="member-info">
              <span class="member-name">{{ member.name }}</span>
              <span class="member-role">{{ member.role }}</span>
            </div>
          </div>
        </div>
        <button
          v-if="boardMembers.length > 4 && !showAllBoard"
          @click="showAllBoard = true"
          class="show-more-btn"
        >
          Vis alle {{ boardMembers.length }} styremedlemmer →
        </button>
      </div>

      <!-- Links Section -->
      <div v-if="hasLinks" class="links-section">
        <a v-if="website" :href="website" target="_blank" class="company-link website">
          🌐 {{ websiteDisplay }}
        </a>
        <a v-if="email" :href="'mailto:' + email" class="company-link email">
          ✉️ {{ email }}
        </a>
        <a v-if="phone" :href="'tel:' + phone" class="company-link phone">
          📞 {{ phone }}
        </a>
      </div>

      <!-- Description/Notes -->
      <div v-if="description" class="description-section">
        <div class="description-content" v-html="renderedDescription"></div>
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
import { marked } from 'marked'

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
const showAllBoard = ref(false)

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

// Basic info
const companyName = computed(() => nodeData.value.name || props.node.label || 'Ukjent selskap')
const organisationNumber = computed(() => nodeData.value.organisationNumber || nodeData.value.orgNr)
const companyLogo = computed(() => nodeData.value.logo || nodeData.value.image)
const companyStatus = computed(() => nodeData.value.status) // e.g., "Aktivt", "Under avvikling"
const isCompact = computed(() => props.node.compact === true)
const isHighlighted = computed(() => props.node.highlight === true)

const formattedOrgNr = computed(() => {
  const orgNr = organisationNumber.value
  if (!orgNr) return '-'
  const str = String(orgNr)
  // Format as XXX XXX XXX
  if (str.length === 9) {
    return `${str.slice(0,3)} ${str.slice(3,6)} ${str.slice(6,9)}`
  }
  return str
})

const companyInitials = computed(() => {
  const name = companyName.value
  const words = name.split(' ').filter(w => w.length > 0 && w[0].match(/[A-ZÆØÅ]/i))
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
})

const statusClass = computed(() => {
  const status = companyStatus.value?.toLowerCase()
  if (status?.includes('aktiv')) return 'active'
  if (status?.includes('avvikl') || status?.includes('oppløs')) return 'dissolved'
  if (status?.includes('konkurs')) return 'bankrupt'
  return ''
})

const logoStyle = computed(() => {
  const colors = ['#2c5282', '#276749', '#9c4221', '#744210', '#5a67d8', '#b83280']
  const hash = companyName.value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  return { backgroundColor: color }
})

// Stats
const employees = computed(() => nodeData.value.numberOfEmployees || nodeData.value.employees)
const founded = computed(() => nodeData.value.foundedYear || nodeData.value.founded || nodeData.value.registrationDate?.slice(0,4))
const industry = computed(() => nodeData.value.industry || nodeData.value.industryDescription)

// Financials
const financials = computed(() => nodeData.value.financials || nodeData.value.financial || {})
const hasFinancials = computed(() => revenue.value || result.value || ebitda.value)
const latestYear = computed(() => financials.value.year || new Date().getFullYear() - 1)
const revenue = computed(() => financials.value.revenue || financials.value.omsetning)
const result = computed(() => financials.value.result || financials.value.årsresultat || financials.value.annualResult)
const ebitda = computed(() => financials.value.ebitda || financials.value.EBITDA)
const revenueChange = computed(() => financials.value.revenueChange || financials.value.revenueGrowth)

// Address
const address = computed(() => nodeData.value.address || nodeData.value.visitorAddress || nodeData.value.postalAddress)
const mapLink = computed(() => {
  if (!address.value) return null
  const query = [address.value.addressLine, address.value.zipCode, address.value.postPlace]
    .filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
})

// Board members
const boardMembers = computed(() => nodeData.value.boardMembers || nodeData.value.board || [])
const displayedBoardMembers = computed(() => {
  return showAllBoard.value ? boardMembers.value : boardMembers.value.slice(0, 4)
})

// Links
const website = computed(() => nodeData.value.homePage || nodeData.value.website)
const websiteDisplay = computed(() => {
  if (!website.value) return ''
  return website.value.replace(/^https?:\/\//, '').replace(/\/$/, '')
})
const email = computed(() => nodeData.value.email)
const phone = computed(() => nodeData.value.phone || nodeData.value.telephone)
const hasLinks = computed(() => website.value || email.value || phone.value)

// Description
const description = computed(() => {
  if (props.node.info && typeof props.node.info === 'string') {
    try {
      JSON.parse(props.node.info)
      return nodeData.value.description
    } catch (e) {
      return props.node.info
    }
  }
  return nodeData.value.description
})

const renderedDescription = computed(() => {
  if (!description.value) return ''
  return marked(description.value)
})

const proffLink = computed(() => {
  if (!organisationNumber.value) return 'https://www.proff.no'
  return `https://www.proff.no/selskap/-/-/${organisationNumber.value}`
})

// Helpers
const formatCurrency = (value) => {
  if (!value && value !== 0) return '-'
  const num = Number(value)
  if (isNaN(num)) return value

  // Format in millions/thousands
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(1)} MNOK`
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(0)} TNOK`
  }
  return `${num.toLocaleString('nb-NO')} NOK`
}

// Events
const emitMemberClick = (member) => {
  emit('node-created', {
    type: 'person-profile',
    label: member.name,
    data: {
      personId: member.personId,
      name: member.name,
      gender: member.gender,
      roles: [{ roleName: member.role, companyName: companyName.value, organisationNumber: organisationNumber.value }]
    }
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
.gnew-company-card-node {
  margin: 16px 0;
}

.company-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e2e8f0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.company-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.company-card.highlight {
  border-color: #3182ce;
  box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.2);
}

.company-header {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
  border-bottom: 1px solid #e2e8f0;
  align-items: flex-start;
}

.company-logo {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.logo-initials {
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.company-info {
  flex: 1;
  min-width: 0;
}

.company-name {
  margin: 0 0 4px 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  line-height: 1.3;
}

.company-org-nr {
  font-size: 0.85rem;
  color: #718096;
  font-family: 'SF Mono', Monaco, monospace;
}

.org-label {
  color: #a0aec0;
  margin-right: 4px;
}

.company-status {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.company-status.active {
  background: #c6f6d5;
  color: #22543d;
}

.company-status.dissolved {
  background: #fed7d7;
  color: #742a2a;
}

.company-status.bankrupt {
  background: #1a202c;
  color: white;
}

.proff-badge {
  flex-shrink: 0;
  padding: 6px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.proff-badge:hover {
  transform: scale(1.05);
}

.proff-logo-small {
  width: 50px;
  height: auto;
  display: block;
}

/* Stats */
.company-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 20px;
  background: #f7fafc;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.stat-icon {
  font-size: 1rem;
}

.stat-value {
  font-weight: 600;
  color: #2d3748;
}

.stat-label {
  color: #718096;
  font-size: 0.85rem;
}

.industry-stat {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.industry-stat .stat-value {
  color: white;
}

/* Financial Section */
.financial-section {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
}

.section-icon {
  font-size: 1rem;
}

.financial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.financial-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f7fafc;
  border-radius: 10px;
}

.financial-label {
  font-size: 0.75rem;
  color: #718096;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.financial-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #2d3748;
}

.financial-value.positive {
  color: #276749;
}

.financial-value.negative {
  color: #c53030;
}

.financial-change {
  font-size: 0.8rem;
  font-weight: 600;
  margin-top: 4px;
}

.financial-change.positive {
  color: #38a169;
}

.financial-change.negative {
  color: #e53e3e;
}

/* Address Section */
.address-section {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.address-content {
  color: #4a5568;
  font-size: 0.9rem;
  line-height: 1.5;
}

.address-line {
  margin: 0;
}

.map-link {
  display: inline-block;
  margin-top: 10px;
  color: #3182ce;
  text-decoration: none;
  font-size: 0.85rem;
}

.map-link:hover {
  text-decoration: underline;
}

/* Board Section */
.board-section {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.board-members {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.board-member {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #f7fafc;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.board-member:hover {
  background: #edf2f7;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.member-avatar.female {
  background: #fce7f3;
}

.member-avatar.male {
  background: #dbeafe;
}

.member-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-role {
  font-size: 0.8rem;
  color: #718096;
}

/* Links Section */
.links-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.company-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f7fafc;
  border-radius: 8px;
  color: #4a5568;
  text-decoration: none;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.company-link:hover {
  background: #3182ce;
  color: white;
}

/* Description */
.description-section {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.description-content {
  color: #4a5568;
  line-height: 1.6;
  font-size: 0.9rem;
}

/* Controls & Common */
.show-more-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  color: #4a5568;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.show-more-btn:hover {
  background: #f7fafc;
  border-color: #3182ce;
  color: #3182ce;
}

.node-controls {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f7fafc;
}

@media (max-width: 640px) {
  .company-header {
    flex-wrap: wrap;
  }

  .proff-badge {
    order: -1;
    margin-left: auto;
  }

  .financial-grid {
    grid-template-columns: 1fr 1fr;
  }

  .board-members {
    grid-template-columns: 1fr;
  }
}
</style>
