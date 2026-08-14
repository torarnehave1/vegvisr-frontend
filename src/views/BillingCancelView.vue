<template>
  <div class="billing-result">
    <div class="billing-card">
      <div class="billing-icon billing-icon--neutral" aria-hidden="true">←</div>
      <h1 class="billing-title">Checkout cancelled</h1>
      <p class="billing-text">
        No payment was taken and nothing was charged. You can start again whenever you like.
      </p>
      <router-link to="/" class="billing-button">Back to Vegvisr</router-link>
    </div>
  </div>
</template>

<script setup></script>

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

.billing-icon--neutral {
  background: #f3f4f6;
  color: #4b5563;
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
