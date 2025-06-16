import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

export function useBranding() {
  const userStore = useUserStore()

  // Detect current domain
  const currentDomain = computed(() => {
    if (typeof window !== 'undefined') {
      return window.location.hostname
    }
    return null
  })

  // Check if current domain matches user's custom site
  const isCustomDomain = computed(() => {
    return userStore.branding?.mySite && currentDomain.value === userStore.branding.mySite
  })

  // Get the appropriate logo
  const currentLogo = computed(() => {
    if (isCustomDomain.value && userStore.branding?.myLogo) {
      return userStore.branding.myLogo
    }
    // Default Vegvisr logo
    return '/assets/vegvisr-logo.png'
  })

  // Get the appropriate site title
  const currentSiteTitle = computed(() => {
    if (isCustomDomain.value) {
      // Convert domain to title (e.g., sweet.norsegong.com -> Sweet NorseGong)
      const domain = userStore.branding.mySite
      if (domain === 'sweet.norsegong.com') {
        return 'Sweet NorseGong'
      }
      // Generic conversion for other domains
      return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
    }
    return 'Vegvisr'
  })

  // Get domain-specific theme/styling
  const currentTheme = computed(() => {
    if (isCustomDomain.value) {
      const domain = userStore.branding.mySite
      if (domain === 'sweet.norsegong.com') {
        return {
          primaryColor: '#8B4513', // Norse brown
          secondaryColor: '#DAA520', // Gold
          accentColor: '#2F4F4F', // Dark slate gray
        }
      }
    }
    // Default Vegvisr theme
    return {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      accentColor: '#28a745',
    }
  })

  return {
    currentDomain,
    isCustomDomain,
    currentLogo,
    currentSiteTitle,
    currentTheme,
  }
}
