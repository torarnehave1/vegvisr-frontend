import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import UserRegistration from '../views/UserRegistration.vue'
import LoginView from '../views/LoginView.vue'
import SoundStudioView from '../views/SoundStudioView.vue' // Example protected view
import EmbedLayout from '../views/EmbedLayout.vue'
import DefaultLayout from '../layouts/DefaultLayout.vue' // Import DefaultLayout
import BlogView from '../views/BlogView.vue' // Import BlogView
import { useStore } from '@/store' // Import the Vuex store

const store = useStore() // Access the Vuex store

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
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
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
    // This is a catch-all route in case the user enters a route that doesn't exist
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },

    {
      path: '/book',
      name: 'Book',
      component: () => import('../views/BookView.vue'),
      props: (route) => ({ theme: route.query.theme || 'light' }), // Pass theme as a prop
    },

    {
      path: '/user',
      name: 'User',
      component: () => import('../views/UserDashboard.vue'),
      meta: { requiresAuth: true }, // Mark this route as requiring authentication
    },
    {
      path: '/register',
      name: 'UserRegistration',
      component: UserRegistration,
      props: (route) => ({ embed: route.query?.embed === 'true' }), // Safely access route.query
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      }, // Dynamically set the layout
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
      name: 'Soudstudio',
      meta: { requiresAuth: true }, // Mark this route as requiring authentication
      component: SoundStudioView,
      props: (route) => ({ theme: route.query.theme || 'light' }), // Pass theme as a prop
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
      props: (route) => ({ theme: route.query.theme || 'light' }), // Pass theme as a prop
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      }, // Dynamically set the layout
    },
    {
      path: '/blog',
      name: 'Blog',
      component: BlogView, // Add BlogView route
    },
    // Redirect to the 404 page if no other routes are matched
  ],
})

// Navigation guard to check for JWT in Local Storage
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('jwt-vegvisr.org') // Retrieve the JWT from Local Storage
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
