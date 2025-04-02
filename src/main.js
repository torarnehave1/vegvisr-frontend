import './assets/main.css'
import 'bootstrap/dist/css/bootstrap.min.css' // Import Bootstrap CSS
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store' // Import Vuex store

const app = createApp(App)

app.use(router)
app.use(store) // Register Vuex store

app.mount('#app')
