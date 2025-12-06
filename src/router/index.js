import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore' // Import the Pinia store
import HomeView from '../views/HomeView.vue'
import UserRegistration from '../views/UserRegistration.vue'
import LoginView from '../views/LoginView.vue'
import SoundStudioView from '../views/SoundStudioView.vue'
import EmbedLayout from '../views/EmbedLayout.vue'
import DefaultLayout from '../layouts/DefaultLayout.vue'
import BlogView from '../views/BlogView.vue'
import GraphAdmin from '@/views/GraphAdmin.vue' // Ensure the path is correct
import GraphViewer from '@/views/GraphViewer.vue' // Import the GraphViewer component
import GraphPortfolio from '@/views/GraphPortfolio.vue'
import AudioPortfolio from '@/views/AudioPortfolio.vue'
import GitHubIssuesView from '@/views/GitHubIssuesView.vue'
import R2Portfolio from '../views/R2Portfolio.vue'
import ProxyTest from '../views/ProxyTest.vue'
import SandboxWorkspace from '../components/SandboxWorkspace.vue'
import GnewAdmin from '@/views/GnewAdmin.vue' // Import the new GnewAdmin component
import GNewViewer from '@/views/GNewViewer.vue' // Direct import to avoid chunking issues
import SMSShare from '@/views/SMSShare.vue' // SMS Share page
import CanvasDemo from '@/views/CanvasDemo.vue' // Canvas Drawing Demo

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'frontpage',
      component: () => import('../views/FrontPage.vue'),
    },
    {
      path: '/home',
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
      component: () => import('../views/FrontPage.vue'),
    },
    {
      path: '/flexbox-test',
      name: 'flexbox-test',
      component: () => import('../views/FlexboxGridTest.vue'),
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
    {
      path: '/maptest',
      name: 'MapTest',
      component: () => import('../components/MapViewer.vue'),
      props: (route) => ({ theme: route.query.theme || 'light' }),
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      },
    },

    {
      path: '/graph-editor',
      name: 'GraphEditor',
      component: GnewAdmin,
      meta: {
        requiresAuth: true,
        layout: null, // Clean layout for focused admin interface
      },
    },
    {
      path: '/graph',
      name: 'GraphAdmin',
      component: GraphAdmin,
      meta: { layout: null }, // Ensure no default layout is applied
    },
    {
      path: '/graph-canvas',
      name: 'GraphCanvas',
      component: () => import('../views/GraphCanvas.vue'),
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
    {
      path: '/graph-viewer',
      name: 'GraphViewer',
      component: GraphViewer,
      props: (route) => ({ graphId: route.query.graphId || '' }), // Pass graphId as a prop
    },
    {
      path: '/gnew-admin',
      name: 'GnewAdmin',
      component: GnewAdmin,
      meta: {
        requiresAuth: true,
        layout: null, // Clean layout for focused admin interface
      },
    },
    {
      path: '/graph-portfolio',
      name: 'graph-portfolio',
      component: GraphPortfolio,
    },
    {
      path: '/audio-portfolio',
      name: 'audio-portfolio',
      component: AudioPortfolio,
    },
    {
      path: '/professional-feed',
      name: 'professional-feed',
      component: () => import('../components/ProfessionalFeed.vue'),
      meta: { requiresAuth: true, layout: null },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue'),
    },
    {
      path: '/xchat',
      name: 'xchat',
      component: () => import('../views/SiteChatView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/chat/:domain',
      name: 'domain-chat',
      component: () => import('../views/SiteChatView.vue'),
      props: (route) => ({ domain: route.params.domain }),
      meta: { requiresAuth: false },
    },
    {
      path: '/github-issues',
      name: 'github-issues',
      component: GitHubIssuesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/r2-portfolio',
      name: 'R2Portfolio',
      component: R2Portfolio,
    },
    {
      path: '/proxy-test',
      name: 'proxy-test',
      component: ProxyTest,
      meta: { layout: null }, // No layout for clean testing
    },
    {
      path: '/whisper-test',
      name: 'whisper-test',
      component: () => import('../views/WhisperTestView.vue'),
      meta: { layout: null }, // No layout for clean testing
    },
    {
      path: '/norwegian-transcription-test',
      name: 'norwegian-transcription-test',
      component: () => import('../views/NorwegianTranscriptionTest.vue'),
      meta: {
        layout: null, // No layout for clean testing
        requiresAuth: true,
        requiresSuperadmin: true,
      },
    },
    {
      path: '/conversation-analysis',
      name: 'conversation-analysis',
      component: () => import('../views/ConversationAnalysisView.vue'),
      meta: {
        layout: null,
        requiresAuth: true,
        requiresSuperadmin: true,
      },
    },
    {
      path: '/sandbox',
      name: 'sandbox',
      component: SandboxWorkspace,
      meta: {
        requiresAuth: true,
        requiresSuperadmin: true,
        layout: null,
      },
    },
    {
      path: '/gnew',
      name: 'gnew',
      component: GNewViewer,
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
    {
      path: '/gnew-viewer',
      name: 'gnew-viewer',
      component: GNewViewer,
      props: (route) => ({ graphId: route.query.graphId || '' }), // Pass graphId as a prop
      meta: {
        layout: null,
      },
    },
    {
      path: '/sms-share',
      name: 'sms-share',
      component: SMSShare,
      meta: {
        layout: null, // No layout for clean SMS sharing page
      },
    },
    {
      path: '/canvas-demo',
      name: 'canvas-demo',
      component: CanvasDemo,
      meta: {
        layout: null, // No layout for clean canvas demo
      },
    },
    {
      path: '/test-invitation',
      name: 'test-invitation',
      component: () => import('../views/TestInvitationView.vue'),
      meta: {
        requiresAuth: true, // Require authentication for testing
        layout: null, // No layout for clean testing
      },
    },
    {
      path: '/affiliate',
      name: 'affiliate',
      component: () => import('../components/AffiliateDashboard.vue'),
      meta: {
        requiresAuth: true, // Require authentication for affiliate dashboard
      },
    },
    {
      path: '/affiliate/info',
      name: 'affiliate-info',
      component: () => import('../views/AffiliateInfoView.vue'),
    },
    {
      path: '/affiliate/register',
      name: 'affiliate-register',
      component: () => import('../components/AffiliateRegistration.vue'),
      props: (route) => ({
        invitationToken: route.query.token,
        embed: route.query?.embed === 'true',
      }),
      beforeEnter: (to, from, next) => {
        to.meta.layout = to.query?.embed === 'true' ? EmbedLayout : DefaultLayout
        next()
      },
    },
    {
      path: '/affiliate-accept',
      name: 'affiliate-accept',
      component: () => import('../components/AffiliateAcceptance.vue'),
      props: (route) => ({
        token: route.query.token,
      }),
    },
    {
      path: '/affiliate-register',
      name: 'affiliate-register-token',
      component: () => import('../components/AffiliateAcceptance.vue'),
      props: (route) => ({
        token: route.query.token,
      }),
    },
    {
      path: '/branding',
      name: 'branding',
      component: () => import('../views/BrandingPage.vue'),
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: '/transcript-processor',
      name: 'transcript-processor',
      component: () => import('../views/TranscriptProcessorView.vue'),
      meta: {
        requiresAuth: true,
        layout: null, // Clean layout for focused workflow
      },
    },
    {
      path: '/seo-admin',
      name: 'seo-admin',
      component: () => import('../views/SEOAdmin.vue'),
      meta: {
        requiresAuth: true,
        requiresSuperadmin: true, // Only superadmins can access
        layout: null,
      },
    },
    {
      path: '/youtube-worker-test',
      name: 'youtube-worker-test',
      component: () => import('../views/YouTubeWorkerTest.vue'),
      meta: {
        requiresAuth: true,
        requiresSuperadmin: true, // Only superadmins can access worker testing
        layout: null,
      },
    },
    {
      path: '/template-manager',
      name: 'template-manager',
      component: () => import('../views/TemplateManager.vue'),
      meta: {
        requiresAuth: true,
        requiresSuperadmin: true, // Only superadmins can manage templates
        layout: null,
      },
    },
    {
      path: '/app-builder',
      name: 'app-builder',
      component: () => import('../views/AppBuilder.vue'),
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
    {
      path: '/component-manager/:componentName?',
      name: 'component-manager',
      component: () => import('../views/ComponentManagerView.vue'),
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
    {
      path: '/component-docs/:componentName/:version?',
      name: 'component-docs',
      component: () => import('../views/ComponentDocsView.vue'),
      meta: {
        requiresAuth: false,
        layout: null,
      },
    },
    {
      path: '/ai-chat',
      name: 'ai-chat',
      component: () => import('../views/AIChatView.vue'),
      meta: {
        requiresAuth: false,
        layout: null,
      },
    },
    {
      path: '/app-history',
      name: 'app-history',
      component: () => import('../views/AppHistoryView.vue'),
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
    {
      path: '/api-library',
      name: 'api-library',
      component: () => import('../views/APILibrary.vue'),
      meta: {
        requiresAuth: true,
        layout: null,
      },
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  console.log(`[Router] Navigating to: ${to.path}`)

  const userStore = useUserStore() // Access the Pinia store

  // If store hasn't been loaded yet, load it first
  if (!userStore.loggedIn && !userStore.email) {
    console.log('[Router] Store not loaded, loading from localStorage...')
    userStore.loadUserFromStorage()

    // Wait a bit for the store to update
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('[Router] Current user store state:', {
    loggedIn: userStore.loggedIn,
    email: userStore.email,
    user_id: userStore.user_id,
    role: userStore.role,
    phoneVerifiedAt: userStore.phoneVerifiedAt,
  })

  if (to.meta.requiresAuth) {
    if (userStore.loggedIn) {
      const sessionOtp = typeof window !== 'undefined' && sessionStorage.getItem('phone_session_verified') === '1'
      if (!sessionOtp) {
        console.warn('[Router] Phone OTP not validated this session. Redirecting to login.')
        return next({ path: '/login', query: { requirePhone: '1', email: userStore.email || '' } })
      }

      // Check for Superadmin requirement (allow Admin and Superadmin)
      if (to.meta.requiresSuperadmin && userStore.role !== 'Superadmin' && userStore.role !== 'Admin') {
        console.warn('[Router] User is not Admin or Superadmin. Access denied.')
        next({ path: '/user' }) // Redirect to user dashboard
        return
      }
      console.log('[Router] User is authenticated. Proceeding.')
      next()
    } else {
      console.warn('[Router] User is not authenticated. Redirecting to login.')
      console.log(
        '[Router] Auth check failed - loggedIn:',
        userStore.loggedIn,
        'email:',
        userStore.email,
      )
      next({ path: '/login' })
    }
  } else {
    next()
  }
})

export default router
