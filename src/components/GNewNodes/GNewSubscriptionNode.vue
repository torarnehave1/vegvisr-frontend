<template>
  <div class="subscription-node">
    <div class="subscription-header">
      <h3 class="node-title">
        <span class="icon">📬</span>
        {{ nodeData.title || 'Subscribe to Updates' }}
      </h3>
      <div class="node-badge">SUBSCRIPTION</div>
    </div>

    <div class="subscription-content">
      <div class="subscription-description">
        <p>
          {{
            nodeData.description ||
            "Subscribe to receive notifications about new content in your areas of interest. You'll need to verify your email address to activate your subscription."
          }}
        </p>

        <!-- Email Instructions -->
        <div class="email-instructions mt-2 p-3 bg-light rounded">
          <h6 class="text-primary mb-2">📧 Verification Required</h6>
          <div class="text-muted small">
            After subscribing, you'll receive an email with a verification link.
            <ul class="mt-1 mb-0">
              <li>Click the link to activate your subscription</li>
              <li>This also creates your account for accessing subscriber features</li>
              <li>The email comes from <strong>vegvisr.org@gmail.com</strong></li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Subscription Form -->
      <div class="subscription-form" v-if="!isSubscribed">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="formData.email"
            type="email"
            placeholder="Enter your email"
            class="form-control"
            :class="{ 'is-invalid': errors.email }"
            @input="clearError('email')"
          />
          <div v-if="errors.email" class="invalid-feedback">{{ errors.email }}</div>
        </div>

        <div class="form-group">
          <label for="subscription-type">Subscribe to</label>
          <select
            id="subscription-type"
            v-model="formData.subscription_type"
            class="form-control"
            :class="{ 'is-invalid': errors.subscription_type }"
            @change="onSubscriptionTypeChange"
          >
            <option value="">Select subscription type</option>
            <option value="category">Category</option>
            <option value="meta_area">Meta Area</option>
          </select>
          <div v-if="errors.subscription_type" class="invalid-feedback">
            {{ errors.subscription_type }}
          </div>
        </div>

        <!-- Category Input with Autocomplete -->
        <div class="form-group" v-if="formData.subscription_type === 'category'">
          <label for="category-input">Category</label>
          <div class="autocomplete-container">
            <input
              id="category-input"
              v-model="formData.target_input"
              type="text"
              placeholder="Type category name..."
              class="form-control"
              :class="{ 'is-invalid': errors.target_id }"
              @input="onCategoryInput"
              @focus="showCategorySuggestions = true"
              @blur="hideSuggestions"
              autocomplete="off"
            />
            <div
              v-if="showCategorySuggestions && filteredCategories.length > 0"
              class="suggestions-dropdown"
            >
              <div
                v-for="category in filteredCategories"
                :key="category"
                class="suggestion-item"
                @mousedown="selectCategory(category)"
              >
                {{ category }}
              </div>
            </div>
          </div>
          <div class="suggestion-hint">
            <small class="text-muted">Start typing to see available categories...</small>
          </div>
          <div v-if="errors.target_id" class="invalid-feedback">{{ errors.target_id }}</div>
        </div>

        <!-- Meta Area Input with Autocomplete -->
        <div class="form-group" v-if="formData.subscription_type === 'meta_area'">
          <label for="meta-area-input">Meta Area</label>
          <div class="autocomplete-container">
            <input
              id="meta-area-input"
              v-model="formData.target_input"
              type="text"
              placeholder="Type meta area name..."
              class="form-control"
              :class="{ 'is-invalid': errors.target_id }"
              @input="onMetaAreaInput"
              @focus="showMetaAreaSuggestions = true"
              @blur="hideSuggestions"
              autocomplete="off"
            />
            <div
              v-if="showMetaAreaSuggestions && filteredMetaAreas.length > 0"
              class="suggestions-dropdown"
            >
              <div
                v-for="metaArea in filteredMetaAreas"
                :key="metaArea"
                class="suggestion-item"
                @mousedown="selectMetaArea(metaArea)"
              >
                {{ metaArea }}
              </div>
            </div>
          </div>
          <div class="suggestion-hint">
            <small class="text-muted">Start typing to see available meta areas...</small>
          </div>
          <div v-if="errors.target_id" class="invalid-feedback">{{ errors.target_id }}</div>
        </div>

        <!-- Subscribe Button -->
        <button
          @click="subscribe"
          :disabled="isLoading || !canSubscribe"
          class="btn btn-primary btn-subscribe"
        >
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
          <span class="btn-icon">{{ isLoading ? '⏳' : '📧' }}</span>
          {{ isLoading ? 'Creating Subscription...' : 'Subscribe' }}
        </button>
      </div>

      <!-- Success State -->
      <div class="subscription-success" v-else>
        <div class="success-icon">✅</div>
        <h4>Successfully Subscribed!</h4>
        <p>
          You're now subscribed to updates for:
          <strong>{{ currentSubscription?.target_title }}</strong>
        </p>
        <button @click="unsubscribe" class="btn btn-outline-secondary btn-sm">
          <span class="btn-icon">🚫</span>
          Unsubscribe
        </button>
      </div>

      <!-- Error Display -->
      <div v-if="errorMessage" class="alert alert-danger mt-3">
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="alert alert-success mt-3">
        <div class="success-content">
          {{ successMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { usePortfolioStore } from '@/stores/portfolioStore'

export default {
  name: 'GNewSubscriptionNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    graphData: {
      type: Object,
      default: () => ({}),
    },
    showControls: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const userStore = useUserStore()
    const portfolioStore = usePortfolioStore()

    // Reactive state
    const formData = ref({
      email: '',
      subscription_type: '',
      target_input: '',
      target_id: '',
      target_title: '',
    })

    const errors = ref({})
    const isLoading = ref(false)
    const errorMessage = ref('')
    const successMessage = ref('')
    const isSubscribed = ref(false)
    const currentSubscription = ref(null)

    // Autocomplete data
    const showCategorySuggestions = ref(false)
    const showMetaAreaSuggestions = ref(false)
    const filteredCategories = ref([])
    const filteredMetaAreas = ref([])

    // Node data
    const nodeData = computed(() => props.node.data || {})

    // Get categories and meta areas from portfolio store (same pattern as BrandingModal)
    const availableCategories = computed(() => {
      return portfolioStore.allMetaAreas || []
    })

    const availableMetaAreas = computed(() => {
      return portfolioStore.allMetaAreas || []
    })

    // Validation
    const canSubscribe = computed(() => {
      return (
        formData.value.email &&
        formData.value.subscription_type &&
        formData.value.target_input.trim() &&
        !isLoading.value
      )
    })

    // Methods
    const clearError = (field) => {
      if (errors.value[field]) {
        delete errors.value[field]
        errors.value = { ...errors.value }
      }
    }

    const validateForm = () => {
      const newErrors = {}

      if (!formData.value.email) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.email)) {
        newErrors.email = 'Please enter a valid email address'
      }

      if (!formData.value.subscription_type) {
        newErrors.subscription_type = 'Please select a subscription type'
      }

      if (!formData.value.target_input.trim()) {
        newErrors.target_id = `Please enter a ${formData.value.subscription_type === 'category' ? 'category' : 'meta area'}`
      }

      errors.value = newErrors
      return Object.keys(newErrors).length === 0
    }

    const onSubscriptionTypeChange = () => {
      formData.value.target_input = ''
      formData.value.target_id = ''
      formData.value.target_title = ''
      // Meta areas are already loaded in portfolioStore, no need to refetch
    }

    const onCategoryInput = () => {
      const query = formData.value.target_input.toLowerCase()
      filteredCategories.value = availableCategories.value.filter((category) =>
        category.toLowerCase().includes(query),
      )
      showCategorySuggestions.value = true
      formData.value.target_id = formData.value.target_input
      formData.value.target_title = formData.value.target_input
    }

    const onMetaAreaInput = () => {
      const query = formData.value.target_input.toLowerCase()
      filteredMetaAreas.value = availableMetaAreas.value.filter((metaArea) =>
        metaArea.toLowerCase().includes(query),
      )
      showMetaAreaSuggestions.value = true
      formData.value.target_id = formData.value.target_input
      formData.value.target_title = formData.value.target_input
    }

    const selectCategory = (category) => {
      formData.value.target_input = category
      formData.value.target_id = category
      formData.value.target_title = category
      showCategorySuggestions.value = false
      clearError('target_id')
    }

    const selectMetaArea = (metaArea) => {
      formData.value.target_input = metaArea
      formData.value.target_id = metaArea
      formData.value.target_title = metaArea
      showMetaAreaSuggestions.value = false
      clearError('target_id')
    }

    const hideSuggestions = () => {
      // Delay to allow click events on suggestions
      setTimeout(() => {
        showCategorySuggestions.value = false
        showMetaAreaSuggestions.value = false
      }, 200)
    }

    // Fetch ALL knowledge graphs from the system to get all available meta areas
    // Same logic as BrandingModal.vue fetchMetaAreas() method
    const fetchMetaAreas = async () => {
      try {
        console.log('Fetching all meta areas from system-wide graphs...')

        // Call the knowledge graph worker directly without hostname filtering
        // This will return all graphs from all users in the system
        const response = await fetch('https://knowledge.vegvisr.org/getknowgraphs', {
          headers: {
            // Don't send x-original-hostname to avoid content filtering
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          console.log('Fetched system-wide graphs for meta areas:', data.results?.length || 0)

          if (data.results) {
            // Fetch complete data for each graph to get meta areas
            const metaAreasSet = new Set()

            for (const graph of data.results) {
              try {
                const graphResponse = await fetch(
                  `https://knowledge.vegvisr.org/getknowgraph?id=${graph.id}`,
                )
                if (graphResponse.ok) {
                  const graphData = await graphResponse.json()
                  const metaAreaString = graphData.metadata?.metaArea || ''

                  if (metaAreaString) {
                    // Parse meta areas and add to set
                    const metaAreas = metaAreaString
                      .split('#')
                      .map((area) => area.trim())
                      .filter((area) => area.length > 0)

                    metaAreas.forEach((area) => metaAreasSet.add(area))
                  }
                }
              } catch (error) {
                console.warn(`Error fetching graph ${graph.id}:`, error)
              }
            }

            // Convert set to array and update the store
            const allMetaAreas = Array.from(metaAreasSet).sort()
            console.log('All system meta areas found:', allMetaAreas)

            // Update portfolio store with all meta areas (same as BrandingModal)
            portfolioStore.setAllMetaAreas(allMetaAreas)

            // Initialize filtered lists
            filteredCategories.value = allMetaAreas
            filteredMetaAreas.value = allMetaAreas
          }
        } else {
          console.error('Failed to fetch system graphs:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching system meta areas:', error)
        errorMessage.value = 'Failed to load available options'
      }
    }

    const subscribe = async () => {
      if (!validateForm()) return

      isLoading.value = true
      errorMessage.value = ''
      successMessage.value = ''

      // Show progress messages
      successMessage.value = '📝 Creating your subscription...'

      try {
        // Store subscription preference in user config meta field
        const subscriptionData = {
          email: formData.value.email,
          subscription_type: formData.value.subscription_type,
          target_id: formData.value.target_id,
          target_title: formData.value.target_title,
          subscribed_at: new Date().toISOString(),
        }

        // TODO: Call API to store in user config table meta field
        const response = await fetch(
          'https://subscription-worker.torarnehave.workers.dev/subscribe',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userStore.token}`,
            },
            body: JSON.stringify(subscriptionData),
          },
        )

        const data = await response.json()

        if (data.success) {
          isSubscribed.value = true
          currentSubscription.value = {
            target_title: formData.value.target_title,
            unsubscribe_token: data.unsubscribe_token,
          }

          // Enhanced messaging based on user status
          if (data.user_status === 'new_subscriber') {
            successMessage.value = `🎉 Subscription Created Successfully!

📬 IMPORTANT: Please check your email to complete your subscription.
   • We sent a verification email to ${formData.value.email}
   • Click the verification link to activate your subscription
   • Check your spam folder if you don't see it

✅ You're subscribed to: ${formData.value.target_title}
📧 Verification email sent from: vegvisr.org@gmail.com

Note: Your subscription will be active after email verification.`
          } else {
            successMessage.value = `🎉 Successfully subscribed to ${formData.value.target_title}!
📬 You'll receive updates at your verified email: ${formData.value.email}
✅ Subscription is now active in your profile.`
          }
        } else {
          errorMessage.value = data.error || 'Failed to subscribe. Please try again.'
        }
      } catch (error) {
        console.error('Subscription error:', error)
        errorMessage.value = 'Network error. Please check your connection and try again.'
      } finally {
        isLoading.value = false
      }
    }

    const unsubscribe = async () => {
      if (!currentSubscription.value) return

      isLoading.value = true
      errorMessage.value = ''

      try {
        const response = await fetch(
          'https://subscription-worker.torarnehave.workers.dev/unsubscribe',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userStore.token}`,
            },
            body: JSON.stringify({
              email: formData.value.email,
              unsubscribe_token: currentSubscription.value.unsubscribe_token,
            }),
          },
        )

        const data = await response.json()

        if (data.success) {
          isSubscribed.value = false
          currentSubscription.value = null
          successMessage.value = 'Successfully unsubscribed.'
        } else {
          errorMessage.value = data.error || 'Failed to unsubscribe. Please try again.'
        }
      } catch (error) {
        console.error('Unsubscribe error:', error)
        errorMessage.value = 'Network error. Please try again.'
      } finally {
        isLoading.value = false
      }
    }

    // Initialize
    onMounted(() => {
      // Pre-fill user email if logged in
      if (userStore.loggedIn && userStore.email) {
        formData.value.email = userStore.email
      }

      // Fetch meta areas (same pattern as BrandingModal)
      fetchMetaAreas()
    })

    return {
      formData,
      errors,
      isLoading,
      errorMessage,
      successMessage,
      isSubscribed,
      currentSubscription,
      nodeData,
      canSubscribe,
      availableCategories,
      availableMetaAreas,
      showCategorySuggestions,
      showMetaAreaSuggestions,
      filteredCategories,
      filteredMetaAreas,
      clearError,
      validateForm,
      onSubscriptionTypeChange,
      onCategoryInput,
      onMetaAreaInput,
      selectCategory,
      selectMetaArea,
      hideSuggestions,
      fetchMetaAreas,
      subscribe,
      unsubscribe,
    }
  },
}
</script>

<style scoped>
.subscription-node {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px solid #6c757d;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.subscription-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.subscription-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.node-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon {
  font-size: 1.5rem;
}

.node-badge {
  background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subscription-content {
  margin-top: 1rem;
}

.subscription-description {
  margin-bottom: 1.5rem;
  color: #666;
  line-height: 1.6;
}

.subscription-form {
  max-width: 400px;
}

.form-group {
  margin-bottom: 1rem;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-control.is-invalid {
  border-color: #dc3545;
}

.invalid-feedback {
  display: block;
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.autocomplete-container {
  position: relative;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f8f9fa;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-hint {
  margin-top: 0.25rem;
}

.btn-subscribe {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.btn-subscribe:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.btn-subscribe:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.subscription-success {
  text-align: center;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.subscription-success h4 {
  color: #28a745;
  margin-bottom: 1rem;
}

.subscription-success p {
  margin-bottom: 1rem;
  color: #666;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.alert-success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.alert-danger {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

.btn-icon {
  font-size: 1rem;
}

/* Enhanced messaging styles */
.email-instructions {
  border-left: 4px solid #007bff;
}

.email-instructions h6 {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.email-instructions ul {
  padding-left: 1.2rem;
}

.success-content {
  white-space: pre-line;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.4;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .subscription-node {
    padding: 1rem;
  }

  .subscription-header {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .node-title {
    font-size: 1.1rem;
  }

  .subscription-form {
    max-width: 100%;
  }
}
</style>
