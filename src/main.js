import './assets/main.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Attach Bootstrap to window for global access
if (typeof window !== 'undefined') {
  window.bootstrap = bootstrap
  console.log('✅ Bootstrap attached to window')
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { Loader } from '@googlemaps/js-api-loader'

// Create app and Pinia instances
const app = createApp(App)
const pinia = createPinia()

// Use plugins
app.use(pinia)
app.use(router)

// Fetch API key and initialize Google Maps API
fetch(`https://api.vegvisr.org/getGoogleApiKey?key=${import.meta.env.VITE_API_ACCESS_KEY}`)
  .then((response) => response.json())
  .then((data) => {
    const loader = new Loader({
      apiKey: data.apiKey,
      version: 'weekly',
      libraries: ['places'],
    })

    // Use importLibrary instead of load to avoid deprecation warning
    loader
      .importLibrary('maps')
      .then(() => {
        app.mount('#app')
      })
      .catch((error) => {
        console.error('Failed to load Google Maps API:', error)
        app.mount('#app') // Mount anyway to avoid blank page
      })
  })
  .catch((error) => {
    console.error('Failed to load Google API key:', error)
    app.mount('#app')
  })
