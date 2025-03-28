<template>
  <div class="protected-container">
    <h1>Protected View</h1>
    <p>You have access to this view because you are authenticated.</p>
  </div>
</template>

<script setup>
// No special logic needed for this example
</script>

<style>
.protected-container {
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}
</style>
