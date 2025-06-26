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
      roles: ['user', 'admin', 'superadmin'],
    },
    {
      id: 'graph-canvas',
      label: '🎨 Canvas',
      path: '/graph-canvas',
      icon: '',
      requiresAuth: false,
      roles: ['user', 'admin', 'superadmin'],
    },
    {
      id: 'graph-portfolio',
      label: 'Portfolio',
      path: '/graph-portfolio',
      icon: '',
      requiresAuth: false,
      roles: ['user', 'admin', 'superadmin'],
    },
    {
      id: 'graph-viewer',
      label: 'Viewer',
      path: '/graph-viewer',
      icon: '',
      requiresAuth: false,
      roles: ['user', 'admin', 'superadmin'],
    },
    {
      id: 'user-dashboard',
      label: 'Dashboard',
      path: '/user',
      icon: '',
      requiresAuth: false,
      roles: ['user', 'admin', 'superadmin'],
    },
    {
      id: 'github-issues',
      label: 'Roadmap',
      path: '/github-issues',
      icon: '🗺️',
      requiresAuth: false,
      roles: ['user', 'admin', 'superadmin'],
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
      path: '/gnew',
      icon: '',
      requiresAuth: false,
      roles: ['Superadmin'], // Only Superadmin can see GNew
    },
  ]

  // Process menu items based on configuration
  const visibleMenuItems = computed(() => {
    let items = [...defaultMenuItems]

    // Apply role-based filtering first - be more permissive for admin roles
    const userRole = userStore.role || 'user'
    console.log('Filtering menu items for role:', userRole)

    items = items.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true

      // Superadmin and admin can see everything
      if (userRole === 'Superadmin' || userRole === 'admin') {
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
    const menuConfig = menuConfigRef?.value || menuConfigRef
    if (menuConfig && menuConfig.enabled === true) {
      console.log('Applying custom menu configuration:', menuConfig)
      // If visibleItems is specified, only show those items
      if (menuConfig.visibleItems && menuConfig.visibleItems.length > 0) {
        items = items.filter((item) => menuConfig.visibleItems.includes(item.id))
        console.log(
          'Filtered menu items to visible items:',
          items.map((i) => i.id),
        )
      }
      // Convert visibleItems to hiddenItems logic for backward compatibility
      else if (menuConfig.hiddenItems && menuConfig.hiddenItems.length > 0) {
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
