<template>
  <div>
    <div class="hero">
      <img
        src="https://cdn.midjourney.com/9a31e3f1-fef6-42b1-8adf-fa23b84f2ccf/0_3.png"
        alt="Hero Image"
      />
    </div>
    <h1>Phonetics, Energy & Ritual in the Vegvisr Framework</h1>
    <p>
      Explore the vibrational essence of sacred phonetics and how sound influences energy and ritual
      practices.
    </p>
    <p>
      By registering, you join a community dedicated to exploring the deeper connections between
      sound, energy, and sacred practices. Vegvisr.org values your insights and presence as we
      co-create an evolving framework of wisdom and ritual.
    </p>
    <UserRegistration />
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
.hero {
  text-align: center;
  margin-bottom: 20px;
}

.hero img {
  max-width: 100%;
  height: auto;
}
</style>
