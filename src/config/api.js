// API Configuration for different environments
const isDevelopment = false // Force production mode to use production APIs

export const API_CONFIG = {
  // Base URL for API calls
  baseUrl: isDevelopment
    ? 'http://127.0.0.1:8787' // Local main-worker in development
    : 'https://vegvisr-frontend.torarnehave.workers.dev', // Production main worker URL

  // Knowledge graph worker URL (separate from main worker)
  knowledgeWorkerUrl: 'https://knowledge-graph-worker.torarnehave.workers.dev',

  // Specific endpoints
  endpoints: {
    getKnowledgeGraphs: '/getknowgraphs',
    getKnowledgeGraph: '/getknowgraph',
    saveKnowledgeGraph: '/saveknowgraph',
    updateKnowledgeGraph: '/updateknowgraph',
    deleteKnowledgeGraph: '/deleteknowgraph',
    // User management endpoints
    getUserData: '/userdata',
    updateUserData: '/userdata',
    uploadFile: '/upload',
    // Site configuration endpoints
    saveSiteConfig: '/site-config',
    getSiteConfig: '/site-config',
    // Main logo endpoint
    getMainLogo: '/main-logo',
  },
}

// Helper function to build full API URLs
export function getApiUrl(endpoint, params = {}, useKnowledgeWorker = false) {
  const baseUrl = useKnowledgeWorker ? API_CONFIG.knowledgeWorkerUrl : API_CONFIG.baseUrl
  const endpointPath = API_CONFIG.endpoints[endpoint] || endpoint

  let url = baseUrl + endpointPath

  // Add query parameters if provided
  if (Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params)
    url += '?' + searchParams.toString()
  }

  return url
}

// Convenience functions for common API calls
export const apiUrls = {
  // Knowledge graph endpoints (use knowledge worker)
  getKnowledgeGraphs: () => getApiUrl('getKnowledgeGraphs', {}, true),
  getKnowledgeGraph: (id) => getApiUrl('getKnowledgeGraph', { id }, true),
  saveKnowledgeGraph: () => getApiUrl('saveKnowledgeGraph', {}, true),
  updateKnowledgeGraph: () => getApiUrl('updateKnowledgeGraph', {}, true),
  deleteKnowledgeGraph: () => getApiUrl('deleteKnowledgeGraph', {}, true),

  // User management endpoints (use main worker)
  getUserData: (email) => getApiUrl('getUserData', { email }),
  updateUserData: () => getApiUrl('updateUserData'),
  uploadFile: () => getApiUrl('uploadFile'),

  // Site configuration endpoints (use main worker)
  saveSiteConfig: () => getApiUrl('saveSiteConfig'),
  getSiteConfig: (domain) => getApiUrl('getSiteConfig') + `/${domain}`,

  // Main logo endpoint (use main worker)
  getMainLogo: () => getApiUrl('getMainLogo'),
}
