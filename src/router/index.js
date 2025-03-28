import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import UserRegistration from '../views/UserRegistration.vue'
import LoginView from '../views/LoginView.vue'
import ProtectedView from '../views/ProtectedView.vue' // Example protected view

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
      path: '/protected',
      name: 'Protected',
      component: ProtectedView,
      meta: { requiresAuth: true }, // Mark this route as requiring authentication
    },
    // Redirect to the 404 page if no other routes are matched
  ],
})

// Navigation guard to check for JWT in Local Storage
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('jwt-vegvisr.org') // Retrieve the JWT from Local Storage
    const userEmail = localStorage.getItem('UserEmail') // Retrieve the UserEmail from Local Storage
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
