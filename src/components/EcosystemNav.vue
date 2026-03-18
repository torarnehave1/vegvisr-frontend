<template>
  <div class="ecosystem-nav">
    <a
      v-for="app in apps"
      :key="app.key"
      :href="app.url"
      class="ecosystem-pill"
      :class="{ active: app.key === activeKey }"
    >
      <img
        v-if="iconMap[app.key]"
        :src="iconMap[app.key]"
        :alt="app.label"
        class="ecosystem-icon"
      />
      <span v-else class="ecosystem-letter">{{ app.label.charAt(0) }}</span>
      <span class="ecosystem-label">{{ app.label }}</span>
    </a>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Import icons directly so Vite resolves them
import photosIcon from 'vegvisr-ui-kit/assets/photos-icon.png'
import chatIcon from 'vegvisr-ui-kit/assets/chat-icon.png'
import aichatIcon from 'vegvisr-ui-kit/assets/aichat-icon.png'

const iconMap = {
  photos: photosIcon,
  chat: chatIcon,
  aichat: aichatIcon,
  contacts: 'https://favicons.vegvisr.org/favicons/1773834325586-1-1773834331342-32x32.png',
}

const apps = [
  { key: 'aichat', label: 'AI Chat', url: 'https://aichat.vegvisr.org' },
  { key: 'chat', label: 'Chat', url: 'https://chat.vegvisr.org' },
  { key: 'photos', label: 'Photos', url: 'https://photos.vegvisr.org' },
  { key: 'contacts', label: 'Contacts', url: 'https://contacts.vegvisr.org' },
  { key: 'connect', label: 'Connect', url: 'https://connect.vegvisr.org' },
  { key: 'vemail', label: 'Email', url: 'https://vemail.vegvisr.org' },
  { key: 'legacy', label: 'Legacy', url: 'https://www.vegvisr.org/user' },
]

const activeKey = computed(() => {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (!host.endsWith('vegvisr.org')) return null
  const [subdomain] = host.split('.')
  // www.vegvisr.org maps to 'legacy'
  if (subdomain === 'www' || host === 'vegvisr.org') return 'legacy'
  return subdomain || null
})
</script>

<style scoped>
.ecosystem-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0f172a;
}

.ecosystem-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  text-decoration: none;
  transition: background 0.2s;
}

.ecosystem-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
}

.ecosystem-pill.active {
  border-color: rgba(56, 189, 248, 0.6);
  background: rgba(14, 165, 233, 0.2);
  color: #fff;
}

.ecosystem-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: contain;
}

.ecosystem-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-size: 10px;
}

.ecosystem-label {
  font-size: 10px;
}
</style>
