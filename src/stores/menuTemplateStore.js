import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from './userStore'

export const useMenuTemplateStore = defineStore('menuTemplate', () => {
  const menuTemplates = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const userStore = useUserStore()

  // Fetch menu templates from the menu-worker (following GraphTemplateStore pattern)
  async function fetchMenuTemplates(
    level = null,
    domain = null,
    category = null,
    access_level = null,
  ) {
    isLoading.value = true
    error.value = null

    console.log('🔄 MenuTemplateStore: Starting fetchMenuTemplates with params:', {
      level,
      domain,
      category,
      access_level,
    })

    try {
      const params = new URLSearchParams()
      if (level) params.append('level', level)
      if (domain) params.append('domain', domain)
      if (category) params.append('category', category)
      if (access_level) params.append('access_level', access_level)

      const url = `https://menu-worker.torarnehave.workers.dev/getMenuTemplates?${params}`
      console.log('🌐 MenuTemplateStore: Fetching from URL:', url)

      const response = await fetch(url, {
        headers: {
          'X-API-Token': userStore.emailVerificationToken,
          Accept: 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
      })

      console.log('📡 MenuTemplateStore: Response status:', response.status)
      console.log(
        '📡 MenuTemplateStore: Response headers:',
        Object.fromEntries(response.headers.entries()),
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ MenuTemplateStore: Error response:', errorText)
        throw new Error(`Failed to load menu templates: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('📊 MenuTemplateStore: Raw response data:', data)

      if (!data.results) {
        console.error('❌ MenuTemplateStore: Invalid response format - missing results array')
        throw new Error('Invalid response format')
      }

      menuTemplates.value = data.results
      console.log('✅ MenuTemplateStore: Menu templates loaded:', menuTemplates.value.length)
      console.log(
        '📋 MenuTemplateStore: Template details:',
        menuTemplates.value.map((t) => ({
          id: t.id,
          name: t.name,
          menu_level: t.menu_level,
          category: t.category,
          templateId: t.templateId,
          templateName: t.templateName,
        })),
      )

      // Check if we have the expected template
      const soundWombTemplate = menuTemplates.value.find(
        (t) =>
          (t.name && t.name.toLowerCase().includes('sound')) ||
          (t.templateName && t.templateName.toLowerCase().includes('sound')),
      )

      if (soundWombTemplate) {
        console.log('🎯 MenuTemplateStore: Found SoundWomb template:', soundWombTemplate)
      } else {
        console.log('⚠️  MenuTemplateStore: SoundWomb template not found in results')
      }
    } catch (err) {
      error.value = err.message
      console.error('❌ MenuTemplateStore: Error fetching menu templates:', err)
      console.error('❌ MenuTemplateStore: Error stack:', err.stack)
    } finally {
      isLoading.value = false
    }
  }

  // Save menu template (following GraphTemplateStore pattern)
  async function saveMenuTemplate(template) {
    try {
      const response = await fetch('https://menu-worker.torarnehave.workers.dev/saveMenuTemplate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': userStore.emailVerificationToken,
        },
        body: JSON.stringify(template),
      })

      if (!response.ok) {
        throw new Error(`Failed to save menu template: ${response.status}`)
      }

      const result = await response.json()

      // Update local store
      const existingIndex = menuTemplates.value.findIndex((t) => t.id === template.id)
      if (existingIndex !== -1) {
        menuTemplates.value[existingIndex] = template
      } else {
        menuTemplates.value.push(template)
      }

      console.log('Menu template saved:', result.id)
      return result
    } catch (err) {
      error.value = err.message
      console.error('Error saving menu template:', err)
      throw err
    }
  }

  // Delete menu template
  async function deleteMenuTemplate(id) {
    try {
      const response = await fetch(
        `https://menu-worker.torarnehave.workers.dev/deleteMenuTemplate?id=${id}`,
        {
          method: 'DELETE',
          headers: {
            'X-API-Token': userStore.emailVerificationToken,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to delete menu template: ${response.status}`)
      }

      // Remove from local store
      const index = menuTemplates.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        menuTemplates.value.splice(index, 1)
      }

      console.log('Menu template deleted:', id)
      return true
    } catch (err) {
      error.value = err.message
      console.error('Error deleting menu template:', err)
      throw err
    }
  }

  // Update menu template
  async function updateMenuTemplate(template) {
    try {
      const response = await fetch(
        'https://menu-worker.torarnehave.workers.dev/updateMenuTemplate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': userStore.emailVerificationToken,
          },
          body: JSON.stringify(template),
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to update menu template: ${response.status}`)
      }

      const result = await response.json()

      // Update local store
      const existingIndex = menuTemplates.value.findIndex((t) => t.id === template.id)
      if (existingIndex !== -1) {
        menuTemplates.value[existingIndex] = template
      }

      console.log('Menu template updated:', result.id)
      return result
    } catch (err) {
      error.value = err.message
      console.error('Error updating menu template:', err)
      throw err
    }
  }

  // Get menu templates by domain (for branding integration)
  async function getMenuTemplatesByDomain(domain) {
    try {
      const response = await fetch(
        `https://menu-worker.torarnehave.workers.dev/getMenuByDomain?domain=${domain}`,
        {
          headers: {
            'X-API-Token': userStore.emailVerificationToken,
            Accept: 'application/json',
          },
          mode: 'cors',
          credentials: 'include',
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to load menu templates for domain: ${response.status}`)
      }

      const data = await response.json()
      console.log('Menu templates for domain:', domain, data.menuTemplates?.length || 0)
      return data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching menu templates by domain:', err)
      throw err
    }
  }

  // Get menu template by ID
  async function getMenuTemplateById(id) {
    try {
      const response = await fetch(
        `https://menu-worker.torarnehave.workers.dev/getMenuById?id=${id}`,
        {
          headers: {
            'X-API-Token': userStore.emailVerificationToken,
            Accept: 'application/json',
          },
          mode: 'cors',
          credentials: 'include',
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to load menu template: ${response.status}`)
      }

      const data = await response.json()
      console.log('Menu template loaded:', data.result?.id)
      return data.result
    } catch (err) {
      error.value = err.message
      console.error('Error fetching menu template by ID:', err)
      throw err
    }
  }

  // Get template by ID from local store (following GraphTemplateStore pattern)
  function getTemplateById(id) {
    return menuTemplates.value.find((t) => t.id === id)
  }

  // Filter templates by category
  function getTemplatesByCategory(category) {
    return menuTemplates.value.filter((t) => t.category === category)
  }

  // Filter templates by menu level
  function getTemplatesByLevel(level) {
    return menuTemplates.value.filter((t) => t.menu_level === level)
  }

  // Filter templates by access level
  function getTemplatesByAccessLevel(accessLevel) {
    return menuTemplates.value.filter((t) => t.access_level === accessLevel)
  }

  // Search templates
  function searchTemplates(query) {
    if (!query.trim()) return menuTemplates.value

    const lowerQuery = query.toLowerCase()
    return menuTemplates.value.filter(
      (template) =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.menu_data.description?.toLowerCase().includes(lowerQuery) ||
        template.category.toLowerCase().includes(lowerQuery) ||
        template.menu_level.toLowerCase().includes(lowerQuery),
    )
  }

  // Get available categories
  function getCategories() {
    const categories = [...new Set(menuTemplates.value.map((t) => t.category))]
    return categories.sort()
  }

  // Get available menu levels
  function getMenuLevels() {
    const levels = [...new Set(menuTemplates.value.map((t) => t.menu_level))]
    return levels.sort()
  }

  // Create menu node from template (helper function)
  function createMenuNodeFromTemplate(templateId, customPosition = null) {
    const template = getTemplateById(templateId)
    if (!template) {
      console.warn(`Menu template not found: ${templateId}`)
      return null
    }

    // Template now contains actual graph node structure - just use it directly
    const newNode = {
      ...template, // Template is already a graph node structure
      id: `menu_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate new unique ID
      position: customPosition || template.position || { x: 100, y: 100 },
    }

    return newNode
  }

  // Clear store
  function clearStore() {
    menuTemplates.value = []
    error.value = null
  }

  return {
    menuTemplates,
    isLoading,
    error,
    fetchMenuTemplates,
    saveMenuTemplate,
    deleteMenuTemplate,
    updateMenuTemplate,
    getMenuTemplatesByDomain,
    getMenuTemplateById,
    getTemplateById,
    getTemplatesByCategory,
    getTemplatesByLevel,
    getTemplatesByAccessLevel,
    searchTemplates,
    getCategories,
    getMenuLevels,
    createMenuNodeFromTemplate,
    clearStore,
  }
})
