<template>
  <div class="proxy-test">
    <h1>Reverse Proxy Test Page</h1>
    <div class="content">
      <p>This is a test page to verify reverse proxy functionality.</p>
      <p>Current domain: {{ currentDomain }}</p>
      <p>Current path: {{ currentPath }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProxyTest',
  data() {
    return {
      currentDomain: window.location.hostname,
      currentPath: window.location.pathname,
    }
  },
}
</script>

<style scoped>
.proxy-test {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #2c3e50;
  margin-bottom: 2rem;
}

.content {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

p {
  margin: 0.5rem 0;
  color: #34495e;
}
</style>
