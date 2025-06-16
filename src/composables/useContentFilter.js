import { computed, ref, onMounted } from 'vue'
import { apiUrls } from '@/config/api'

export function useContentFilter() {
  const siteConfig = ref(null)
  const loading = ref(false)
  const detectedHostname = ref(null)

  // Function to detect the original hostname from proxy headers or window location
  const detectHostname = async () => {
    // First try to get the original hostname from a HEAD request to see response headers
    try {
      const response = await fetch(window.location.href, { method: 'HEAD' })
      const originalHostname = response.headers.get('x-original-hostname')
      if (originalHostname) {
        console.log('[ContentFilter] Detected original hostname from proxy:', originalHostname)
        detectedHostname.value = originalHostname
        return originalHostname
      }
    } catch (error) {
      console.log('[ContentFilter] Could not detect original hostname from headers:', error)
    }

    // Fallback to window location hostname
    const hostname = typeof window !== 'undefined' ? window.location.hostname : null
    console.log('[ContentFilter] Using window location hostname:', hostname)
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
      console.log('[ContentFilter] Fetching site configuration for domain:', domain)
      const response = await fetch(apiUrls.getSiteConfig(domain))
      if (response.ok) {
        const config = await response.json()
        siteConfig.value = config
        console.log('[ContentFilter] Loaded site configuration for', domain, config)
      } else if (response.status === 404) {
        // No custom configuration found, use defaults
        siteConfig.value = null
        console.log('[ContentFilter] No site configuration found for', domain)
      } else {
        console.error('[ContentFilter] Error fetching site configuration:', response.status)
      }
    } catch (error) {
      console.error('[ContentFilter] Error fetching site configuration:', error)
      siteConfig.value = null
    } finally {
      loading.value = false
    }
  }

  // Check if current domain has custom configuration
  const isCustomDomain = computed(() => {
    return siteConfig.value && siteConfig.value.domain === currentDomain.value
  })

  // Get content filter meta areas for the current domain
  const contentFilterMetaAreas = computed(() => {
    if (isCustomDomain.value && siteConfig.value?.contentFilter?.metaAreas) {
      const metaAreas = siteConfig.value.contentFilter.metaAreas
      console.log('[ContentFilter] Using KV-based meta area filter:', metaAreas)
      return metaAreas
    }

    console.log('[ContentFilter] No content filter found, showing all content')
    return null
  })

  // Function to filter graphs based on meta areas
  const filterGraphsByMetaAreas = (graphs) => {
    if (!contentFilterMetaAreas.value || !Array.isArray(contentFilterMetaAreas.value)) {
      console.log('[ContentFilter] No filtering applied, returning all graphs')
      return graphs
    }

    const allowedMetaAreas = contentFilterMetaAreas.value.map((area) => area.toUpperCase())
    console.log('[ContentFilter] Filtering graphs by meta areas:', allowedMetaAreas)

    const filteredGraphs = graphs.filter((graph) => {
      const metaAreas = getMetaAreas(graph.metadata?.metaArea || '')
      const hasMetaArea = metaAreas.some((area) => allowedMetaAreas.includes(area.toUpperCase()))
      console.log(
        `[ContentFilter] Graph ${graph.id} meta areas:`,
        metaAreas,
        'has allowed:',
        hasMetaArea,
      )
      return hasMetaArea
    })

    console.log(
      `[ContentFilter] Filtered ${filteredGraphs.length} graphs from ${graphs.length} total`,
    )
    return filteredGraphs
  }

  // Helper to parse meta areas from string
  const getMetaAreas = (metaAreaString) => {
    if (!metaAreaString) return []
    return metaAreaString
      .split('#')
      .map((area) => area.trim())
      .filter((area) => area.length > 0)
  }

  // Initialize hostname detection and fetch site config
  const initialize = async () => {
    const hostname = await detectHostname()
    if (hostname) {
      await fetchSiteConfig(hostname)
    }
  }

  // Auto-initialize when component mounts
  onMounted(() => {
    initialize()
  })

  return {
    currentDomain,
    isCustomDomain,
    contentFilterMetaAreas,
    siteConfig,
    loading,
    filterGraphsByMetaAreas,
    fetchSiteConfig,
    initialize,
  }
}
