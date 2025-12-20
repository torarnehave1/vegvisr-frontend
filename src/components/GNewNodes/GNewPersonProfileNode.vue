<template>
  <div class="gnew-person-profile-node">
    <!-- Profile Card -->
    <div class="profile-card" :class="{ 'compact': isCompact }">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="profile-avatar" :style="avatarStyle">
          <span v-if="!profileImage" class="avatar-initials">{{ initials }}</span>
          <img v-else :src="profileImage" :alt="personName" class="avatar-image" />
        </div>
        <div class="profile-info">
          <h3 class="person-name">{{ personName }}</h3>
          <div class="person-meta">
            <span v-if="personAge" class="meta-item age">
              <span class="meta-icon">🎂</span> {{ personAge }} år
            </span>
            <span v-if="personGender" class="meta-item gender">
              <span class="meta-icon">{{ genderIcon }}</span> {{ genderLabel }}
            </span>
            <span v-if="personLocation" class="meta-item location">
              <span class="meta-icon">📍</span> {{ personLocation }}
            </span>
          </div>
        </div>
      </div>

      <!-- Roles Section -->
      <div v-if="roles.length > 0" class="roles-section">
        <h4 class="section-title">
          <span class="section-icon">💼</span> Roller ({{ roles.length }})
        </h4>
        <div class="roles-grid">
          <div v-for="(role, index) in displayedRoles" :key="index" class="role-card">
            <div class="role-icon" :style="{ backgroundColor: getRoleColor(role.roleName) }">
              {{ getRoleIcon(role.roleName) }}
            </div>
            <div class="role-details">
              <span class="role-name">{{ role.roleName }}</span>
              <span class="company-name">{{ role.companyName }}</span>
              <span v-if="role.organisationNumber" class="org-number">
                Org.nr: {{ role.organisationNumber }}
              </span>
            </div>
          </div>
        </div>
        <button 
          v-if="roles.length > 3 && !showAllRoles" 
          @click="showAllRoles = true"
          class="show-more-btn"
        >
          Vis alle {{ roles.length }} roller →
        </button>
      </div>

      <!-- Connections Section -->
      <div v-if="connections.length > 0" class="connections-section">
        <h4 class="section-title">
          <span class="section-icon">🔗</span> Forbindelser ({{ connections.length }})
        </h4>
        <div class="connections-list">
          <div 
            v-for="(conn, index) in displayedConnections" 
            :key="index" 
            class="connection-item"
            @click="emitConnectionClick(conn)"
          >
            <span class="connection-avatar" :class="conn.gender === 'K' ? 'female' : 'male'">
              {{ conn.gender === 'K' ? '👩' : '👨' }}
            </span>
            <span class="connection-name">{{ conn.name }}</span>
            <span class="connection-count" :title="`${conn.numberOfConnections} felles forbindelse(r)`">
              {{ conn.numberOfConnections }}
            </span>
          </div>
        </div>
        <button 
          v-if="connections.length > 5 && !showAllConnections" 
          @click="showAllConnections = true"
          class="show-more-btn"
        >
          Vis alle {{ connections.length }} forbindelser →
        </button>
      </div>

      <!-- Industry Connections -->
      <div v-if="industryConnections.length > 0" class="industry-section">
        <h4 class="section-title">
          <span class="section-icon">🏭</span> Bransjer
        </h4>
        <div class="industry-tags">
          <span v-for="(industry, index) in industryConnections" :key="index" class="industry-tag">
            {{ industry.name }}
          </span>
        </div>
      </div>

      <!-- Social Links Section (for FB, LinkedIn etc) -->
      <div v-if="socialLinks.length > 0" class="social-section">
        <h4 class="section-title">
          <span class="section-icon">🌐</span> Sosiale medier
        </h4>
        <div class="social-links">
          <a 
            v-for="(link, index) in socialLinks" 
            :key="index"
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="social-link"
            :title="link.platform"
          >
            <span class="social-icon">{{ getSocialIcon(link.platform) }}</span>
            {{ link.label || link.platform }}
          </a>
        </div>
      </div>

      <!-- Custom Notes/Insights -->
      <div v-if="insights" class="insights-section">
        <h4 class="section-title">
          <span class="section-icon">💡</span> Innsikt
        </h4>
        <div class="insights-content" v-html="renderedInsights"></div>
      </div>

      <!-- Node Controls (Admin only) -->
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
const showAllRoles = ref(false)
const showAllConnections = ref(false)

// Parse node data - supports both direct data and JSON in info field
const parsedInfo = computed(() => {
  // Try to parse from node.info if it's JSON
  if (props.node.info) {
    try {
      const parsed = JSON.parse(props.node.info)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch (e) {
      // Not JSON, return null
    }
  }
  return null
})

// Get the actual person data (check for proffData nested structure)
const nodeData = computed(() => {
  // Check for new structure with proffData
  if (parsedInfo.value?.proffData) {
    return parsedInfo.value.proffData
  }
  // Try to parse from node.data (legacy structured)
  if (props.node.data && typeof props.node.data === 'object') {
    return props.node.data
  }
  // Direct parsed JSON without proffData wrapper
  if (parsedInfo.value) {
    return parsedInfo.value
  }
  // Fallback to node properties
  return props.node
})

// AI response text (if available)
const aiResponse = computed(() => parsedInfo.value?.aiResponse || '')

// Computed properties
const personName = computed(() => nodeData.value.name || props.node.label || 'Ukjent person')
const personAge = computed(() => nodeData.value.age || nodeData.value.alder)
const personGender = computed(() => nodeData.value.gender || nodeData.value.kjønn)
const personId = computed(() => nodeData.value.personId)
const personLocation = computed(() => {
  const loc = nodeData.value.location
  if (!loc) return null
  if (typeof loc === 'string') return loc
  return [loc.municipality, loc.county].filter(Boolean).join(', ')
})

const profileImage = computed(() => nodeData.value.image || nodeData.value.profileImage)
const isCompact = computed(() => props.node.compact === true || nodeData.value.compact === true)

const roles = computed(() => nodeData.value.roles || [])
const connections = computed(() => {
  const conn = nodeData.value.connections
  // connections can be a number or array
  if (typeof conn === 'number') return []
  return conn || []
})
const industryConnections = computed(() => nodeData.value.industryConnections || [])
const socialLinks = computed(() => nodeData.value.socialLinks || [])
const insights = computed(() => {
  // Use AI response if available
  if (aiResponse.value) {
    return aiResponse.value
  }
  // If info is not JSON, use it as insights
  if (props.node.info && typeof props.node.info === 'string') {
    try {
      JSON.parse(props.node.info)
      return nodeData.value.insights
    } catch (e) {
      return props.node.info
    }
  }
  return nodeData.value.insights
})

const displayedRoles = computed(() => {
  return showAllRoles.value ? roles.value : roles.value.slice(0, 3)
})

const displayedConnections = computed(() => {
  return showAllConnections.value ? connections.value : connections.value.slice(0, 5)
})

const initials = computed(() => {
  const name = personName.value
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
})

const genderIcon = computed(() => personGender.value === 'K' ? '♀️' : '♂️')
const genderLabel = computed(() => personGender.value === 'K' ? 'Kvinne' : 'Mann')

const proffLink = computed(() => {
  if (!personId.value) return '#'
  return `https://www.proff.no/rolle/-/-/-/${personId.value}`
})

const avatarStyle = computed(() => {
  const colors = ['#3498db', '#9b59b6', '#e74c3c', '#27ae60', '#f39c12', '#1abc9c']
  const hash = personName.value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const color = colors[hash % colors.length]
  return { backgroundColor: color }
})

const renderedInsights = computed(() => {
  if (!insights.value) return ''
  return marked(insights.value)
})

// Helper functions
const getRoleIcon = (roleName) => {
  const roleIcons = {
    'Daglig leder': '👔',
    'Styrets leder': '👑',
    'Styremedlem': '📋',
    'Varamedlem': '📌',
    'Innehaver': '🏠',
    'Kontaktperson': '📞',
    'Signatur': '✍️',
    'Prokura': '📝'
  }
  return roleIcons[roleName] || '💼'
}

const getRoleColor = (roleName) => {
  const roleColors = {
    'Daglig leder': '#3498db',
    'Styrets leder': '#9b59b6',
    'Styremedlem': '#27ae60',
    'Varamedlem': '#95a5a6',
    'Innehaver': '#e74c3c',
    'Kontaktperson': '#f39c12',
    'Signatur': '#1abc9c',
    'Prokura': '#34495e'
  }
  return roleColors[roleName] || '#7f8c8d'
}

const getSocialIcon = (platform) => {
  const icons = {
    'facebook': '📘',
    'linkedin': '💼',
    'twitter': '🐦',
    'instagram': '📷',
    'youtube': '📺',
    'website': '🌐'
  }
  return icons[platform?.toLowerCase()] || '🔗'
}

const emitConnectionClick = (connection) => {
  // Emit event to potentially create a new node or navigate
  emit('node-created', {
    type: 'person-profile',
    label: connection.name,
    data: {
      personId: connection.personId,
      name: connection.name,
      gender: connection.gender
    }
  })
}

// Node actions
const editNode = () => {
  // Trigger edit modal in parent
  emit('node-updated', { ...props.node, _action: 'edit' })
}

const deleteNode = () => {
  if (confirm('Er du sikker på at du vil slette denne noden?')) {
    emit('node-deleted', props.node.id)
  }
}
</script>

<style scoped>
.gnew-person-profile-node {
  margin: 16px 0;
}

.profile-card {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  border: 1px solid #e9ecef;
}

.profile-card.compact {
  padding: 12px;
}

.profile-header {
  display: flex;
  gap: 20px;
  padding: 24px;
  background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
  color: white;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  border: 3px solid rgba(255,255,255,0.3);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-initials {
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.profile-info {
  flex: 1;
}

.person-name {
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.person-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 0.9rem;
  opacity: 0.9;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-icon {
  font-size: 1rem;
}

.person-id {
  margin-top: 12px;
}

.proff-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.15);
  border-radius: 20px;
  color: white;
  text-decoration: none;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.proff-link:hover {
  background: rgba(255,255,255,0.25);
}

.proff-logo {
  width: 60px;
  height: auto;
  filter: brightness(0) invert(1);
}

/* Sections */
.roles-section,
.connections-section,
.industry-section,
.social-section,
.insights-section {
  padding: 20px 24px;
  border-top: 1px solid #e9ecef;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
}

.section-icon {
  font-size: 1.2rem;
}

/* Roles Grid */
.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.role-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.role-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.role-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.role-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.role-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.9rem;
}

.company-name {
  color: #4a5568;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-number {
  font-size: 0.75rem;
  color: #718096;
  font-family: monospace;
}

/* Connections List */
.connections-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connection-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8f9fa;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.connection-item:hover {
  background: #e9ecef;
}

.connection-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.connection-avatar.female {
  background: #fce7f3;
}

.connection-avatar.male {
  background: #dbeafe;
}

.connection-name {
  flex: 1;
  font-weight: 500;
  color: #2d3748;
}

.connection-count {
  background: #3182ce;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Industry Tags */
.industry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.industry-tag {
  padding: 6px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
}

/* Social Links */
.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.social-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #4a5568;
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.2s, color 0.2s;
}

.social-link:hover {
  background: #3182ce;
  color: white;
}

.social-icon {
  font-size: 1.1rem;
}

/* Insights */
.insights-content {
  color: #4a5568;
  line-height: 1.6;
}

.insights-content :deep(p) {
  margin-bottom: 12px;
}

.insights-content :deep(ul),
.insights-content :deep(ol) {
  padding-left: 20px;
  margin-bottom: 12px;
}

/* Show More Button */
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

/* Node Controls */
.node-controls {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

/* Responsive */
@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .person-meta {
    justify-content: center;
  }
  
  .roles-grid {
    grid-template-columns: 1fr;
  }
}
</style>
