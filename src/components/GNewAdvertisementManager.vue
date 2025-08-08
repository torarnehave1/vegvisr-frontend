<template>
  <div class="advertisement-manager-node">
    <div class="node-header">
      <h5 class="node-title">
        <i class="fas fa-ad"></i>
        Advertisement Manager
      </h5>
      <div class="node-actions">
        <button @click="toggleExpanded" class="btn-expand">
          <i :class="isExpanded ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
      </div>
    </div>

    <div v-if="isExpanded" class="manager-content">
      <!-- Campaign Overview -->
      <div class="campaign-overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ campaignStats.totalCampaigns }}</div>
            <div class="stat-label">Active Campaigns</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ campaignStats.totalImpressions.toLocaleString() }}</div>
            <div class="stat-label">Total Impressions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ (campaignStats.averageCTR * 100).toFixed(2) }}%</div>
            <div class="stat-label">Average CTR</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${{ campaignStats.totalRevenue.toLocaleString() }}</div>
            <div class="stat-label">Total Revenue</div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button @click="createNewCampaign" class="btn btn-primary">
          <i class="fas fa-plus"></i>
          Create Campaign
        </button>
        <button @click="analyzePerformance" class="btn btn-info">
          <i class="fas fa-chart-line"></i>
          Analyze Performance
        </button>
        <button @click="optimizeCampaigns" class="btn btn-success">
          <i class="fas fa-magic"></i>
          AI Optimize
        </button>
        <button @click="viewReports" class="btn btn-secondary">
          <i class="fas fa-file-alt"></i>
          Reports
        </button>
      </div>

      <!-- Active Campaigns List -->
      <div class="campaigns-section">
        <h6 class="section-title">Active Campaigns</h6>
        <div class="campaigns-list">
          <div
            v-for="campaign in activeCampaigns"
            :key="campaign.id"
            class="campaign-item"
            @click="selectCampaign(campaign)"
          >
            <div class="campaign-header">
              <span class="campaign-name">{{ campaign.name }}</span>
              <span class="campaign-status" :class="campaign.status">{{ campaign.status }}</span>
            </div>
            <div class="campaign-metrics">
              <span class="metric">
                <i class="fas fa-eye"></i>
                {{ campaign.impressions.toLocaleString() }}
              </span>
              <span class="metric">
                <i class="fas fa-mouse-pointer"></i>
                {{ (campaign.ctr * 100).toFixed(2) }}%
              </span>
              <span class="metric">
                <i class="fas fa-dollar-sign"></i>
                {{ campaign.revenue.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Campaign Creation Modal -->
      <div v-if="showCreateModal" class="modal-overlay" @click="closeModal">
        <div class="campaign-create-modal" @click.stop>
          <div class="modal-header">
            <h5>Create New Advertisement Campaign</h5>
            <button @click="closeModal" class="btn-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-content">
            <form @submit.prevent="submitCampaign">
              <div class="form-group">
                <label>Campaign Name</label>
                <input
                  v-model="newCampaign.name"
                  type="text"
                  class="form-control"
                  placeholder="Enter campaign name"
                  required
                />
              </div>

              <div class="form-group">
                <label>Campaign Type</label>
                <select v-model="newCampaign.type" class="form-control" required>
                  <option value="">Select campaign type</option>
                  <option value="banner">Banner Advertisement</option>
                  <option value="native">Native Content</option>
                  <option value="video">Video Advertisement</option>
                  <option value="interactive">Interactive Content</option>
                </select>
              </div>

              <div class="form-group">
                <label>Target Audience</label>
                <textarea
                  v-model="newCampaign.targetAudience"
                  class="form-control"
                  placeholder="Describe your target audience..."
                  rows="3"
                ></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Budget ($)</label>
                  <input
                    v-model="newCampaign.budget"
                    type="number"
                    class="form-control"
                    placeholder="0"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div class="form-group">
                  <label>Duration (days)</label>
                  <input
                    v-model="newCampaign.duration"
                    type="number"
                    class="form-control"
                    placeholder="30"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Advertisement Content</label>
                <textarea
                  v-model="newCampaign.content"
                  class="form-control"
                  placeholder="Enter your advertisement content..."
                  rows="4"
                  required
                ></textarea>
              </div>

              <div class="ai-suggestions" v-if="aiSuggestions.length > 0">
                <h6>AI Recommendations</h6>
                <div class="suggestions-list">
                  <div
                    v-for="suggestion in aiSuggestions"
                    :key="suggestion.id"
                    class="suggestion-item"
                  >
                    <i class="fas fa-lightbulb"></i>
                    {{ suggestion.text }}
                  </div>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" @click="closeModal" class="btn btn-secondary">Cancel</button>
                <button type="button" @click="getAISuggestions" class="btn btn-info">
                  <i class="fas fa-magic"></i>
                  AI Suggestions
                </button>
                <button type="submit" class="btn btn-primary">
                  <i class="fas fa-rocket"></i>
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Performance Analysis Modal -->
      <div v-if="showAnalysisModal" class="modal-overlay" @click="closeModal">
        <div class="analysis-modal" @click.stop>
          <div class="modal-header">
            <h5>Performance Analysis</h5>
            <button @click="closeModal" class="btn-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-content">
            <div class="analysis-content">
              <div class="time-range-selector">
                <button
                  v-for="range in timeRanges"
                  :key="range.value"
                  @click="selectedTimeRange = range.value"
                  :class="[
                    'btn',
                    selectedTimeRange === range.value ? 'btn-primary' : 'btn-outline-primary',
                  ]"
                >
                  {{ range.label }}
                </button>
              </div>

              <div class="performance-charts">
                <div class="chart-container">
                  <h6>Campaign Performance Trends</h6>
                  <div class="chart-placeholder">📈 Performance chart would be rendered here</div>
                </div>

                <div class="insights-section">
                  <h6>AI Insights</h6>
                  <div class="insights-list">
                    <div
                      v-for="insight in performanceInsights"
                      :key="insight.id"
                      class="insight-item"
                    >
                      <i :class="insight.icon"></i>
                      <span>{{ insight.text }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'

// Component props
const props = defineProps({
  nodeData: {
    type: Object,
    default: () => ({}),
  },
})

// Reactive state
const isExpanded = ref(true)
const showCreateModal = ref(false)
const showAnalysisModal = ref(false)
const selectedTimeRange = ref('7d')

// Campaign statistics
const campaignStats = reactive({
  totalCampaigns: 5,
  totalImpressions: 125000,
  averageCTR: 0.025,
  totalRevenue: 8500,
})

// Active campaigns data
const activeCampaigns = ref([
  {
    id: 'camp_001',
    name: 'AI Knowledge Graph Promotion',
    status: 'active',
    impressions: 45000,
    ctr: 0.028,
    revenue: 3200,
  },
  {
    id: 'camp_002',
    name: 'Professional Network Expansion',
    status: 'active',
    impressions: 38000,
    ctr: 0.022,
    revenue: 2800,
  },
  {
    id: 'camp_003',
    name: 'Educational Content Series',
    status: 'paused',
    impressions: 42000,
    ctr: 0.025,
    revenue: 2500,
  },
])

// New campaign form data
const newCampaign = reactive({
  name: '',
  type: '',
  targetAudience: '',
  budget: 0,
  duration: 30,
  content: '',
})

// AI suggestions
const aiSuggestions = ref([])

// Time range options
const timeRanges = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
]

// Performance insights
const performanceInsights = ref([
  {
    id: 1,
    icon: 'fas fa-arrow-up text-success',
    text: 'CTR increased by 15% this week',
  },
  {
    id: 2,
    icon: 'fas fa-clock text-warning',
    text: 'Best performance between 2-4 PM',
  },
  {
    id: 3,
    icon: 'fas fa-users text-info',
    text: 'Tech professionals show highest engagement',
  },
])

// Methods
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const createNewCampaign = () => {
  showCreateModal.value = true
}

const analyzePerformance = () => {
  showAnalysisModal.value = true
}

const optimizeCampaigns = async () => {
  console.log('🔄 Running AI optimization...')

  // Simulate AI optimization process
  const optimizationResults = await simulateAIOptimization()

  console.log('✅ AI optimization complete:', optimizationResults)

  // Update campaign stats with optimized values
  campaignStats.averageCTR += 0.003
  campaignStats.totalRevenue += 500
}

const viewReports = () => {
  console.log('📊 Opening detailed reports...')
  // In real implementation, would navigate to reports page
}

const selectCampaign = (campaign) => {
  console.log('📋 Selected campaign:', campaign.name)
  // In real implementation, would show campaign details
}

const closeModal = () => {
  showCreateModal.value = false
  showAnalysisModal.value = false
}

const submitCampaign = async () => {
  console.log('🚀 Creating new campaign:', newCampaign)

  try {
    // Simulate campaign creation
    const campaignId = await createCampaign(newCampaign)

    // Add to active campaigns list
    activeCampaigns.value.unshift({
      id: campaignId,
      name: newCampaign.name,
      status: 'active',
      impressions: 0,
      ctr: 0,
      revenue: 0,
    })

    // Update stats
    campaignStats.totalCampaigns++

    // Reset form and close modal
    Object.assign(newCampaign, {
      name: '',
      type: '',
      targetAudience: '',
      budget: 0,
      duration: 30,
      content: '',
    })

    closeModal()

    console.log('✅ Campaign created successfully!')
  } catch (error) {
    console.error('❌ Failed to create campaign:', error)
  }
}

const getAISuggestions = async () => {
  console.log('🧠 Getting AI suggestions...')

  try {
    // Simulate AI analysis
    const suggestions = await generateAISuggestions(newCampaign)
    aiSuggestions.value = suggestions

    console.log('✅ AI suggestions generated:', suggestions)
  } catch (error) {
    console.error('❌ Failed to get AI suggestions:', error)
  }
}

// Simulated API functions
const simulateAIOptimization = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        optimizedCampaigns: 3,
        expectedIncrease: '12%',
        recommendations: [
          'Increase bid during peak hours',
          'Refine targeting for mobile users',
          'Test new call-to-action variants',
        ],
      })
    }, 2000)
  })
}

const createCampaign = async (campaignData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const campaignId = `camp_${Date.now()}`
      resolve(campaignId)
    }, 1000)
  })
}

const generateAISuggestions = async (campaignData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const suggestions = [
        {
          id: 1,
          text: 'Consider targeting users interested in data visualization and analytics',
        },
        {
          id: 2,
          text: 'Add emotional trigger words like "revolutionary" or "breakthrough"',
        },
        {
          id: 3,
          text: 'Include social proof elements to increase credibility',
        },
      ]
      resolve(suggestions)
    }, 1500)
  })
}

// Lifecycle
onMounted(() => {
  console.log('🎯 Advertisement Manager node initialized')
})
</script>

<style scoped>
.advertisement-manager-node {
  background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%);
  border: 2px solid #4caf50;
  border-radius: 12px;
  padding: 20px;
  min-width: 400px;
  max-width: 600px;
  box-shadow: 0 4px 20px rgba(76, 175, 80, 0.1);
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.node-title {
  margin: 0;
  color: #2e7d32;
  font-weight: 600;
}

.node-title i {
  color: #4caf50;
  margin-right: 8px;
}

.btn-expand {
  background: none;
  border: none;
  color: #4caf50;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
}

.manager-content {
  animation: fadeIn 0.3s ease-in-out;
}

.campaign-overview {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2e7d32;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn i {
  margin-right: 5px;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-info {
  background: #2196f3;
  color: white;
}

.btn-info:hover {
  background: #1976d2;
}

.btn-success {
  background: #ff9800;
  color: white;
}

.btn-success:hover {
  background: #f57c00;
}

.btn-secondary {
  background: #757575;
  color: white;
}

.btn-secondary:hover {
  background: #616161;
}

.campaigns-section {
  margin-top: 20px;
}

.section-title {
  color: #2e7d32;
  margin-bottom: 15px;
  font-weight: 600;
}

.campaigns-list {
  space-y: 10px;
}

.campaign-item {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 10px;
}

.campaign-item:hover {
  border-color: #4caf50;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.1);
}

.campaign-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.campaign-name {
  font-weight: 600;
  color: #333;
}

.campaign-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 500;
}

.campaign-status.active {
  background: #e8f5e9;
  color: #2e7d32;
}

.campaign-status.paused {
  background: #fff3e0;
  color: #f57c00;
}

.campaign-metrics {
  display: flex;
  gap: 20px;
}

.metric {
  font-size: 14px;
  color: #666;
}

.metric i {
  color: #4caf50;
  margin-right: 5px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.campaign-create-modal,
.analysis-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h5 {
  margin: 0;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
}

.modal-content {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.ai-suggestions {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.ai-suggestions h6 {
  color: #2e7d32;
  margin-bottom: 10px;
}

.suggestions-list {
  space-y: 8px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  font-size: 14px;
  color: #555;
}

.suggestion-item i {
  color: #ff9800;
  margin-right: 8px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.time-range-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.btn-outline-primary {
  background: white;
  color: #4caf50;
  border: 1px solid #4caf50;
}

.btn-outline-primary:hover {
  background: #4caf50;
  color: white;
}

.performance-charts {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.chart-container {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #666;
}

.insights-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.insights-list {
  space-y: 12px;
}

.insight-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  font-size: 14px;
}

.insight-item i {
  margin-right: 10px;
  width: 20px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .advertisement-manager-node {
    min-width: 300px;
    max-width: 100%;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .action-buttons {
    grid-template-columns: repeat(2, 1fr);
  }

  .performance-charts {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
