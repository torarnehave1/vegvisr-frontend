<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-container">
    <!-- Top Menu (Header) -->
    <header class="top-menu">
      <nav class="top-nav">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/test">Test</RouterLink>
        <RouterLink to="/openAi">OpenAI</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </header>

    <div class="main-layout">
      <!-- Sidebar (Hidden on About Page) -->
      <aside class="sidebar">
        <nav>
          <RouterLink to="/dashboard">Dashboard</RouterLink>
          <RouterLink to="/profile">Profile</RouterLink>
          <RouterLink to="/settings">Settings</RouterLink>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style></style>
