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
        <p>{{ nodeData.description || 'Stay updated with new content and insights!' }}</p>
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
            <option value="graph">This Knowledge Graph</option>
            <option value="category">All graphs in this Category</option>
            <option value="meta_area">All graphs in this Meta Area</option>
          </select>
          <div v-if="errors.subscription_type" class="invalid-feedback">
            {{ errors.subscription_type }}
          </div>
        </div>

        <!-- Target Selection -->
        <div class="form-group" v-if="formData.subscription_type">
          <label for="target">{{ getTargetLabel() }}</label>
          <select
            id="target"
            v-model="formData.target_id"
            class="form-control"
            :class="{ 'is-invalid': errors.target_id }"
            @change="onTargetChange"
          >
            <option value="">{{ getTargetPlaceholder() }}</option>
            <option v-for="option in targetOptions" :key="option.id" :value="option.id">
              {{ option.title }}
            </option>
          </select>
          <div v-if="errors.target_id" class="invalid-feedback">{{ errors.target_id }}</div>
        </div>

        <!-- Subscribe Button -->
        <button
          @click="subscribe"
          :disabled="isLoading || !canSubscribe"
          class="btn btn-primary btn-subscribe"
        >
          <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
          <span class="btn-icon">📧</span>
          {{ isLoading ? 'Subscribing...' : 'Subscribe' }}
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
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

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
    const graphStore = useKnowledgeGraphStore()

    // Reactive state
    const formData = ref({
      email: '',
      subscription_type: '',
      target_id: '',
      target_title: '',
    })

    const errors = ref({})
    const isLoading = ref(false)
    const errorMessage = ref('')
    const successMessage = ref('')
    const isSubscribed = ref(false)
    const currentSubscription = ref(null)
    const targetOptions = ref([])

    // Node data
    const nodeData = computed(() => props.node.data || {})

    // Validation
    const canSubscribe = computed(() => {
      return (
        formData.value.email &&
        formData.value.subscription_type &&
        formData.value.target_id &&
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

      if (!formData.value.target_id) {
        newErrors.target_id = 'Please select a target'
      }

      errors.value = newErrors
      return Object.keys(newErrors).length === 0
    }

    const getTargetLabel = () => {
      switch (formData.value.subscription_type) {
        case 'graph':
          return 'Knowledge Graph'
        case 'category':
          return 'Category'
        case 'meta_area':
          return 'Meta Area'
        default:
          return 'Target'
      }
    }

    const getTargetPlaceholder = () => {
      switch (formData.value.subscription_type) {
        case 'graph':
          return 'Select a knowledge graph'
        case 'category':
          return 'Select a category'
        case 'meta_area':
          return 'Select a meta area'
        default:
          return 'Select target'
      }
    }

    const onSubscriptionTypeChange = async () => {
      formData.value.target_id = ''
      formData.value.target_title = ''
      await loadTargetOptions()
    }

    const onTargetChange = () => {
      const selectedOption = targetOptions.value.find((opt) => opt.id === formData.value.target_id)
      if (selectedOption) {
        formData.value.target_title = selectedOption.title
      }
    }

    const loadTargetOptions = async () => {
      try {
        targetOptions.value = []

        if (formData.value.subscription_type === 'graph') {
          // Load available graphs
          const graphs = graphStore.graphs || []
          targetOptions.value = graphs.map((graph) => ({
            id: graph.id,
            title: graph.metadata?.title || `Graph ${graph.id}`,
          }))

          // Add current graph if not in list
          if (props.graphData?.metadata?.id) {
            const currentExists = targetOptions.value.find(
              (opt) => opt.id === props.graphData.metadata.id,
            )
            if (!currentExists) {
              targetOptions.value.unshift({
                id: props.graphData.metadata.id,
                title: props.graphData.metadata.title || 'Current Graph',
              })
            }
          }
        } else if (formData.value.subscription_type === 'category') {
          // Load available categories
          const categories = new Set()
          const graphs = graphStore.graphs || []

          graphs.forEach((graph) => {
            if (graph.metadata?.categories) {
              graph.metadata.categories.forEach((cat) => categories.add(cat))
            }
          })

          targetOptions.value = Array.from(categories).map((cat) => ({
            id: cat,
            title: cat,
          }))
        } else if (formData.value.subscription_type === 'meta_area') {
          // Load available meta areas
          const metaAreas = new Set()
          const graphs = graphStore.graphs || []

          graphs.forEach((graph) => {
            if (graph.metadata?.metaAreas) {
              graph.metadata.metaAreas.forEach((area) => metaAreas.add(area))
            }
          })

          targetOptions.value = Array.from(metaAreas).map((area) => ({
            id: area,
            title: area,
          }))
        }
      } catch (error) {
        console.error('Error loading target options:', error)
        errorMessage.value = 'Failed to load options. Please try again.'
      }
    }

    const subscribe = async () => {
      if (!validateForm()) return

      isLoading.value = true
      errorMessage.value = ''
      successMessage.value = ''

      try {
        const response = await fetch(
          'https://subscription-worker.torarnehave.workers.dev/subscribe',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.value.email,
              subscription_type: formData.value.subscription_type,
              target_id: formData.value.target_id,
              target_title: formData.value.target_title,
            }),
          },
        )

        const data = await response.json()

        if (data.success) {
          isSubscribed.value = true
          currentSubscription.value = {
            target_title: formData.value.target_title,
            unsubscribe_token: data.unsubscribe_token,
          }
          successMessage.value = 'Successfully subscribed! You will receive updates via email.'
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
      // Auto-fill current graph if available
      if (props.graphData?.metadata?.id) {
        formData.value.subscription_type = 'graph'
        formData.value.target_id = props.graphData.metadata.id
        formData.value.target_title = props.graphData.metadata.title || 'Current Graph'
      }
    })

    return {
      formData,
      errors,
      isLoading,
      errorMessage,
      successMessage,
      isSubscribed,
      currentSubscription,
      targetOptions,
      nodeData,
      canSubscribe,
      clearError,
      validateForm,
      getTargetLabel,
      getTargetPlaceholder,
      onSubscriptionTypeChange,
      onTargetChange,
      loadTargetOptions,
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
