import { computed, ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { apiUrls } from '@/config/api'

export function useBranding() {
  const userStore = useUserStore()
  const siteConfig = ref(null)
  const loading = ref(false)
  const detectedHostname = ref(null)
  const mainLogo = ref(null)

  // Function to detect the original hostname from proxy headers or window location
  const detectHostname = async () => {
    // First try to get the original hostname from a HEAD request to see response headers
    try {
      if (typeof window !== 'undefined' && window.location?.href) {
        const response = await fetch(window.location.href, { method: 'HEAD' })
        const originalHostname = response.headers.get('x-original-hostname')
        if (originalHostname) {
          console.log('Detected original hostname from proxy:', originalHostname)
          detectedHostname.value = originalHostname
          return originalHostname
        }
      }
    } catch (error) {
      console.log('Could not detect original hostname from headers:', error)
    }

    // Fallback to window location hostname
    const hostname =
      typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost'
    console.log('Using window location hostname:', hostname)
    detectedHostname.value = hostname
    return hostname
  }

  // Detect current domain (original hostname from proxy or window location)
  const currentDomain = computed(() => {
    return detectedHostname.value
  })

  // Fetch site configuration from KV
  const fetchSiteConfig = async (domain) => {
    if (!domain || loading.value) return

    loading.value = true
    try {
      console.log('Fetching site configuration for domain:', domain)
      const response = await fetch(apiUrls.getSiteConfig(domain))
      if (response.ok) {
        const config = await response.json()
        siteConfig.value = config
        console.log('Loaded site configuration for', domain, config)
      } else if (response.status === 404) {
        // No custom configuration found, use defaults
        siteConfig.value = null
        console.log('No site configuration found for', domain)
      } else {
        console.error('Error fetching site configuration:', response.status)
      }
    } catch (error) {
      console.error('Error fetching site configuration:', error)
      siteConfig.value = null
    } finally {
      loading.value = false
    }
  }

  // Check if current domain has custom configuration
  const isCustomDomain = computed(() => {
    return siteConfig.value && siteConfig.value.domain === currentDomain.value
  })

  // Fetch main logo from worker
  const fetchMainLogo = async () => {
    if (mainLogo.value) return // Already fetched

    try {
      const response = await fetch(apiUrls.getMainLogo())
      if (response.ok) {
        const data = await response.json()
        mainLogo.value = data.logoUrl
        console.log('Fetched main logo from worker:', mainLogo.value)
      } else {
        console.error('Failed to fetch main logo:', response.status)
        mainLogo.value = 'https://vegvisr.imgix.net/vegvisr-logo.png' // fallback
      }
    } catch (error) {
      console.error('Error fetching main logo:', error)
      mainLogo.value = 'https://vegvisr.imgix.net/vegvisr-logo.png' // fallback
    }
  }

  // Get the appropriate logo
  const currentLogo = computed(() => {
    // First check KV site configuration
    if (isCustomDomain.value && siteConfig.value?.branding?.myLogo) {
      console.log('Using logo from KV site config:', siteConfig.value.branding.myLogo)
      return siteConfig.value.branding.myLogo
    }

    // Fallback to user store (for logged-in users)
    if (userStore.branding?.myLogo && userStore.branding?.mySite === currentDomain.value) {
      console.log('Using logo from user store:', userStore.branding.myLogo)
      return userStore.branding.myLogo
    }

    // Default logo from worker or fallback
    console.log('Using main logo from worker:', mainLogo.value)
    return mainLogo.value || 'https://vegvisr.imgix.net/vegvisr-logo.png'
  })

  // Get the appropriate site title
  const currentSiteTitle = computed(() => {
    // First check KV site configuration for custom title
    if (isCustomDomain.value && siteConfig.value?.branding?.siteTitle) {
      return siteConfig.value.branding.siteTitle
    }

    // If no custom title, generate from domain
    if (isCustomDomain.value && siteConfig.value?.branding?.mySite) {
      const domain = siteConfig.value.branding.mySite
      // Generic conversion for domains - with null check
      if (domain && typeof domain === 'string' && domain.includes('.')) {
        const subdomain = domain.split('.')[0]
        return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
      }
      return 'Custom Site'
    }

    // Fallback to user store
    if (userStore.branding?.siteTitle) {
      return userStore.branding.siteTitle
    }

    // Generate from user store domain if available
    if (userStore.branding?.mySite === currentDomain.value) {
      const domain = userStore.branding.mySite
      if (domain && typeof domain === 'string' && domain.includes('.')) {
        const subdomain = domain.split('.')[0]
        return subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
      }
      return 'Custom Site'
    }

    return 'Vegvisr'
  })

  // Get domain-specific theme/styling
  const currentTheme = computed(() => {
    // Check KV site configuration for custom theme
    if (isCustomDomain.value && siteConfig.value?.branding?.theme) {
      return siteConfig.value.branding.theme
    }

    // Fallback to user store theme
    if (userStore.branding?.theme) {
      return userStore.branding.theme
    }

    // Default Vegvisr theme
    return {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      accentColor: '#28a745',
    }
  })

  // Get the appropriate front page
  const currentFrontPage = computed(() => {
    let frontPage = ''
    if (isCustomDomain.value && siteConfig.value?.branding?.mySiteFrontPage) {
      frontPage = siteConfig.value.branding.mySiteFrontPage
      console.log('Using custom front page from KV site config:', frontPage)
    } else if (
      userStore.branding?.mySiteFrontPage &&
      userStore.branding?.mySite === currentDomain.value
    ) {
      frontPage = userStore.branding.mySiteFrontPage
      console.log('Using custom front page from user store:', frontPage)
    } else {
      console.log('Using default front page')
      return '/' // Default landing page
    }

    // Normalize front page path if it's just a Graph ID
    if (frontPage && !frontPage.includes('/') && !frontPage.includes('?')) {
      frontPage = `/graph-viewer?graphId=${frontPage}&template=Frontpage`
      console.log('Normalized front page path to:', frontPage)
    }
    return frontPage
  })

  // Initialize hostname detection and fetch site config
  const initialize = async () => {
    try {
      // Always fetch main logo first
      await fetchMainLogo()

      const hostname = await detectHostname()
      if (hostname && hostname !== 'localhost') {
        await fetchSiteConfig(hostname)
      } else {
        console.log('Skipping site config fetch for localhost or invalid hostname')
      }
    } catch (error) {
      console.error('Error during branding initialization:', error)
      // Set safe defaults
      detectedHostname.value = 'localhost'
      siteConfig.value = null
    }
  }

  // Auto-initialize when component mounts
  onMounted(() => {
    initialize()
  })

  return {
    currentDomain,
    isCustomDomain,
    currentLogo,
    currentSiteTitle,
    currentTheme,
    siteConfig,
    loading,
    fetchSiteConfig,
    initialize,
    currentFrontPage,
  }
}
