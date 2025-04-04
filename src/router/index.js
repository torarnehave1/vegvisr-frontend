import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import UserRegistration from '../views/UserRegistration.vue'
import LoginView from '../views/LoginView.vue'
import SoundStudioView from '../views/SoundStudioView.vue'
import EmbedLayout from '../views/EmbedLayout.vue'
import DefaultLayout from '../layouts/DefaultLayout.vue'
import BlogView from '../views/BlogView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('../views/TestView.vue'),
    },
    {
      path: '/openAI',
      name: 'openAI',
      component: () => import('../views/OAiView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
    {
      path: '/book',
      name: 'Book',
      component: () => import('../views/BookView.vue'),
      props: (route) => ({ theme: route.query.theme || 'light' }),
    },
    {
      path: '/user',
      name: 'User',
      component: () => import('../views/UserDashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/register',
      name: 'UserRegistration',
      component: UserRegistration,
      props: (route) => ({ embed: route.query?.embed === 'true' }),
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      },
    },
    {
      path: '/lpage',
      name: 'LandingPage',
      component: () => import('../views/LandingPageView.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      component: LoginView,
    },
    {
      path: '/soundstudio',
      name: 'Soundstudio',
      meta: { requiresAuth: true },
      component: SoundStudioView,
      props: (route) => ({ theme: route.query.theme || 'light' }),
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      },
    },
    {
      path: '/editor',
      name: 'EditorView',
      meta: { requiresAuth: true },
      component: () => import('../views/EditorView.vue'),
      props: (route) => ({ theme: route.query.theme || 'light' }),
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      },
    },
    {
      path: '/blog',
      name: 'Blog',
      component: BlogView,
    },
  ],
})

// Navigation guard to check for JWT in Local Storage
router.beforeEach(async (to, from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('jwt-vegvisr.org') // Retrieve the JWT from Local Storage
    const { useStore } = await import('@/store') // Dynamically import the store
    const store = useStore() // Access the Vuex store
    const userEmail = store.state.user?.email // Retrieve the UserEmail from Vuex store
    if (token && userEmail) {
      // Token and UserEmail exist, allow access
      next()
    } else {
      // Token or UserEmail is missing, redirect to login
      next({ path: '/login' })
    }
  } else {
    // Route does not require authentication, allow access
    next()
  }
})

export default router
