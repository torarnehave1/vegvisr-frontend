import { createRouter, createWebHistory } from 'vue-router'
import OpenAIView from '@/views/OpenAIView.vue' // Updated import path

const openaiRouter = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/openai',
      name: 'openai',
      component: OpenAIView,
    },
  ],
})

export default openaiRouter
