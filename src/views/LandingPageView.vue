<template>
  <div class="container my-5">
    <div class="row align-items-center">
      <!-- Left Column: Image -->
      <div class="col-md-6 text-center mb-4 mb-md-0">
        <h1 class="display-5 fw-bold">Phonetics, Energy & Ritual in the Vegvisr Framework</h1>
        <img
          src="https://cdn.midjourney.com/9a31e3f1-fef6-42b1-8adf-fa23b84f2ccf/0_3.png"
          alt="Hero Image"
          class="img-fluid rounded shadow"
        />
      </div>

      <!-- Right Column: Content -->
      <div class="col-md-6">
        <p class="lead">
          Explore the vibrational essence of sacred phonetics and how sound influences energy and
          ritual practices.
        </p>
        <p>
          By registering, you join a community dedicated to exploring the deeper connections between
          sound, energy, and sacred practices. Vegvisr.org values your insights and presence as we
          co-create an evolving framework of wisdom and ritual.
        </p>

        <!-- Registration Component -->
        <UserRegistration />
      </div>
    </div>
  </div>
</template>

<script>
import UserRegistration from './UserRegistration.vue' // Adjust the path as needed

export default {
  components: {
    UserRegistration,
  },
}
</script>

<style scoped>
/* Optional custom styling */
</style>
