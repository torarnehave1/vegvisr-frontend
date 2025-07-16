import { computed } from 'vue'
import { useUserStore } from '@/stores/userStore'

export function useMenuConfig(menuConfigRef = null) {
  const userStore = useUserStore()

  // Default menu items structure
  const defaultMenuItems = [
    {
      id: 'graph-editor',
      label: 'Editor',
      path: '/graph-editor',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'graph-canvas',
      label: '🎨 Canvas',
      path: '/graph-canvas',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'graph-portfolio',
      label: 'Portfolio',
      path: '/graph-portfolio',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'graph-viewer',
      label: 'Viewer',
      path: '/graph-viewer',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'search',
      label: '🔍 Search',
      path: '/search',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'user-dashboard',
      label: 'Dashboard',
      path: '/user',
      icon: '',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'github-issues',
      label: 'Roadmap',
      path: '/github-issues',
      icon: '🗺️',
      requiresAuth: false,
      roles: ['User', 'Admin', 'Superadmin'],
    },
    {
      id: 'sandbox',
      label: '🔧 Sandbox',
      path: '/sandbox',
      icon: '',
      requiresAuth: false,
      roles: ['Superadmin'], // Only Superadmin can see sandbox
    },
    {
      id: 'gnew',
      label: '🧪 GNew Viewer',
      path: '/gnew-viewer',
      icon: '',
      requiresAuth: false,
      roles: ['Superadmin'], // Only Superadmin can see GNew
    },
  ]

  // Process menu items based on configuration
  const visibleMenuItems = computed(() => {
    let items = []

    // Check if we have a custom menu configuration
    const menuConfig = menuConfigRef?.value || menuConfigRef

    // PRIORITY 1: Use selected template from menu configuration
    if (menuConfig && menuConfig.enabled && menuConfig.templateData) {
      console.log('Using template data from menu configuration:', menuConfig.templateData)

      // Use items from the selected template
      if (menuConfig.templateData.items && Array.isArray(menuConfig.templateData.items)) {
        items = menuConfig.templateData.items.map((item) => ({
          id: item.id,
          label: item.label,
          path: item.path || item.url || '/',
          icon: item.icon || '',
          requiresAuth: item.requiresAuth || false,
          roles: item.requiresRole
            ? Array.isArray(item.requiresRole)
              ? item.requiresRole
              : [item.requiresRole]
            : ['User', 'Admin', 'Superadmin'],
          type: item.type || 'route',
          graphId: item.graphId || '',
          url: item.url || '',
        }))
      }
    }

    // PRIORITY 2: Use default menu items with visibility filtering
    if (items.length === 0) {
      items = [...defaultMenuItems]
      console.log('Using default menu items with visibility filtering')
    }

    // Apply role-based filtering
    const userRole = userStore.role || 'User'
    console.log('Filtering menu items for role:', userRole)

    items = items.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true

      // Superadmin and Admin can see everything
      if (userRole === 'Superadmin' || userRole === 'Admin') {
        return true
      }

      // Otherwise check if role is in the allowed roles
      return item.roles.includes(userRole)
    })

    console.log(
      'After role filtering, showing items:',
      items.map((i) => i.label),
    )

    // Apply domain-specific menu configuration ONLY if explicitly provided and enabled
    if (menuConfig && menuConfig.enabled === true) {
      console.log('Applying custom menu configuration:', menuConfig)

      // If no template was used, apply visibility filtering to default items
      if (
        !menuConfig.templateData &&
        menuConfig.visibleItems &&
        menuConfig.visibleItems.length > 0
      ) {
        items = items.filter((item) => menuConfig.visibleItems.includes(item.id))
        console.log(
          'Filtered menu items to visible items:',
          items.map((i) => i.id),
        )
      }
      // Convert visibleItems to hiddenItems logic for backward compatibility
      else if (
        !menuConfig.templateData &&
        menuConfig.hiddenItems &&
        menuConfig.hiddenItems.length > 0
      ) {
        items = items.filter((item) => !menuConfig.hiddenItems.includes(item.id))
        console.log(
          'Filtered menu items by hidden items:',
          items.map((i) => i.id),
        )
      }
    } else {
      console.log(
        'Using default menu items (no custom config):',
        items.map((i) => i.label),
      )
    }

    return items
  })

  // Get list of all available menu items for configuration UI
  const availableMenuItems = computed(() => {
    return defaultMenuItems.map((item) => ({
      id: item.id,
      label: item.label,
      path: item.path,
      roles: item.roles,
    }))
  })

  return {
    visibleMenuItems,
    availableMenuItems,
    defaultMenuItems,
  }
}
