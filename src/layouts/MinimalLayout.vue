<template>
  <div class="minimal-layout">
    <slot />
  </div>
</template>

<script setup>
// Minimal layout - no navigation, no header, just content
</script>

<style scoped>
.minimal-layout {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}
</style>
