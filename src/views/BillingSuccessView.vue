<template>
  <div class="billing-result">
    <div class="billing-card">
      <div class="billing-icon billing-icon--ok" aria-hidden="true">✓</div>
      <h1 class="billing-title">Thank you</h1>
      <p class="billing-text">
        Your payment went through. Stripe is sending a receipt to your email address.
      </p>
      <p v-if="reference" class="billing-reference">
        Reference: <code>{{ reference }}</code>
      </p>
      <router-link to="/" class="billing-button">Back to Vegvisr</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Stripe appends ?session_id={CHECKOUT_SESSION_ID} only when the worker's
// CHECKOUT_SUCCESS_URL carries that template. Absent is normal — the webhook,
// not this page, is the record of payment. Shown truncated as a support handle.
const reference = computed(() => {
  const id = route.query.session_id
  return typeof id === 'string' && id ? `${id.slice(0, 20)}…` : ''
})
</script>

<style scoped>
.billing-result {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem 1rem;
}

.billing-card {
  max-width: 480px;
  width: 100%;
  text-align: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.billing-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 1.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  line-height: 1;
}

.billing-icon--ok {
  background: #e7f6ec;
  color: #1a7f43;
}

.billing-title {
  margin: 0 0 0.75rem;
  font-size: 1.6rem;
  font-weight: 600;
  color: #111827;
}

.billing-text {
  margin: 0 0 1.5rem;
  color: #4b5563;
  line-height: 1.6;
}

.billing-reference {
  margin: -0.75rem 0 1.5rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.billing-reference code {
  background: #f3f4f6;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.billing-button {
  display: inline-block;
  padding: 0.6rem 1.4rem;
  background: #635bff;
  color: #ffffff;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
}

.billing-button:hover {
  background: #524ae6;
  color: #ffffff;
}
</style>
