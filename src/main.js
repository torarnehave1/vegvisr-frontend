import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import testrouter from './router/testrouter'

const app = createApp(App)

app.use(router)
app.use('/test', testrouter)

app.mount('#app')
