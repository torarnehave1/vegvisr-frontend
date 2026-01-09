import { defineStore } from 'pinia'
import { apiUrls } from '@/config/api'

export const useDomainStore = defineStore('domain', {
  state: () => ({
    // Domain configurations
    domains: [],

    // Change tracking
    newDomains: new Set(), // Domain names that are new
    updatedDomains: new Set(), // Domain names that have been modified
    deletedDomains: new Set(), // Domain names that have been deleted

    // Original state for comparison
    originalDomains: new Map(), // key: domain name, value: original config

    // Loading states
    isLoading: false,
    isSaving: false,

    // Last save timestamp
    lastSaved: null,
  }),

  getters: {
    // Get all domains
    allDomains: (state) => state.domains,

    // Get domains that need to be saved
    domainsToSave: (state) => {
      return state.domains.filter(domain =>
        state.newDomains.has(domain.domain) || state.updatedDomains.has(domain.domain)
      )
    },

    // Check if there are unsaved changes
    hasUnsavedChanges: (state) => {
      return state.newDomains.size > 0 || state.updatedDomains.size > 0 || state.deletedDomains.size > 0
    },

    // Get change counts
    changeStats: (state) => ({
      new: state.newDomains.size,
      updated: state.updatedDomains.size,
      deleted: state.deletedDomains.size,
      total: state.newDomains.size + state.updatedDomains.size + state.deletedDomains.size
    }),

    // Get change summary for UI
    changeSummary: (state) => {
      const stats = {
        new: state.newDomains.size,
        updated: state.updatedDomains.size,
        deleted: state.deletedDomains.size
      }

      const parts = []
      if (stats.new > 0) parts.push(`${stats.new} new`)
      if (stats.updated > 0) parts.push(`${stats.updated} updated`)
      if (stats.deleted > 0) parts.push(`${stats.deleted} deleted`)

      return parts.length > 0 ? parts.join(', ') : 'No changes'
    }
  },

  actions: {
    // Initialize domains from user profile and KV
    async loadDomains(userEmail) {
      this.isLoading = true
      try {
        console.log('Loading domains for user:', userEmail)

        // Step 1: Try to get domain list from user profile first
        let domainList = []
        try {
          const response = await fetch(apiUrls.getUserData(userEmail))
          if (response.ok) {
            const userData = await response.json()

            // Extract domain list from profile
            if (userData.data?.domainConfigs?.length > 0) {
              domainList = userData.data.domainConfigs.map(config => config.domain).filter(Boolean)
              console.log('Found domains in user profile:', domainList.length)
            } else if (userData.data?.branding?.mySite) {
              domainList = [userData.data.branding.mySite]
              console.log('Found legacy domain in profile:', domainList[0])
            }
          }
        } catch (profileError) {
          console.warn('Error fetching user profile:', profileError)
        }

        // Step 2: If no domains in profile, fetch directly from KV by owner
        if (domainList.length === 0) {
          console.log('No domains in user profile, fetching directly from KV...')
          try {
            const kvListResponse = await fetch(apiUrls.listUserDomains(userEmail))
            if (kvListResponse.ok) {
              const kvListData = await kvListResponse.json()
              if (kvListData.success && kvListData.domains?.length > 0) {
                // Convert KV configs to modal format directly
                const domainConfigs = kvListData.domains.map(siteConfig =>
                  this.convertKVToModalFormat(siteConfig)
                )
                console.log('Loaded', domainConfigs.length, 'domains directly from KV')
                this.setDomains(domainConfigs)
                this.markAllAsSaved()
                return domainConfigs
              }
            }
          } catch (kvListError) {
            console.warn('Error fetching domains from KV:', kvListError)
          }
        }

        // Step 3: Fetch detailed configs from KV for each domain in profile
        const domainConfigs = []
        for (const domain of domainList) {
          try {
            const kvResponse = await fetch(apiUrls.getSiteConfig(domain))
            if (kvResponse.ok) {
              const siteConfig = await kvResponse.json()
              const modalConfig = this.convertKVToModalFormat(siteConfig)
              domainConfigs.push(modalConfig)
            } else {
              // Create fallback config
              domainConfigs.push({
                domain,
                logo: '',
                contentFilter: 'none',
                selectedCategories: [],
                mySiteFrontPage: '',
                menuConfig: { enabled: false, visibleItems: [] }
              })
            }
          } catch (error) {
            console.warn(`Error loading domain ${domain}:`, error)
          }
        }

        // Step 4: Set domains and create baseline
        this.setDomains(domainConfigs)
        this.markAllAsSaved() // Mark as baseline since we just loaded from server

        console.log('Loaded domains:', domainConfigs.length)
        return domainConfigs
      } catch (error) {
        console.error('Error loading domains:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // Set domains and establish baseline for change tracking
    setDomains(domains) {
      this.domains = [...domains]

      // Create original state map for change detection
      this.originalDomains.clear()
      domains.forEach(domain => {
        this.originalDomains.set(domain.domain, this.deepClone(domain))
      })
    },

    // Add a new domain
    addDomain(domainConfig) {
      console.log('Adding new domain:', domainConfig.domain)

      // Add to domains array
      this.domains.push({ ...domainConfig })

      // Mark as new
      this.newDomains.add(domainConfig.domain)

      // Remove from updated if it was there (shouldn't happen, but safety)
      this.updatedDomains.delete(domainConfig.domain)
    },

    // Update an existing domain
    updateDomain(domainName, newConfig) {
      console.log('Updating domain:', domainName)

      const index = this.domains.findIndex(d => d.domain === domainName)
      if (index === -1) {
        console.warn('Domain not found for update:', domainName)
        return
      }

      // Update the domain
      this.domains[index] = { ...newConfig }

      // Track change (only if not already new)
      if (!this.newDomains.has(domainName)) {
        // Check if actually changed from original
        const original = this.originalDomains.get(domainName)
        if (original && !this.deepEqual(original, newConfig)) {
          this.updatedDomains.add(domainName)
        } else {
          this.updatedDomains.delete(domainName)
        }
      }
    },

    // Remove a domain
    removeDomain(domainName) {
      console.log('Removing domain:', domainName)

      // Remove from domains array
      const index = this.domains.findIndex(d => d.domain === domainName)
      if (index !== -1) {
        this.domains.splice(index, 1)
      }

      // Track deletion
      if (this.newDomains.has(domainName)) {
        // If it was new, just remove from new (no need to delete from server)
        this.newDomains.delete(domainName)
      } else {
        // If it existed on server, mark for deletion
        this.deletedDomains.add(domainName)
      }

      // Remove from updated
      this.updatedDomains.delete(domainName)
    },

    // Save only changed domains
    async saveChanges(userEmail) {
      if (!this.hasUnsavedChanges) {
        console.log('No changes to save')
        return { success: true, message: 'No changes to save' }
      }

      this.isSaving = true
      const results = {
        success: true,
        saved: [],
        errors: [],
        stats: { ...this.changeStats }
      }

      try {
        console.log('Saving changes:', this.changeSummary)

        // 1. Save new and updated domains to KV
        const domainsToSave = this.domainsToSave
        for (const domain of domainsToSave) {
          try {
            const kvConfig = this.convertModalToKVFormat(domain, userEmail)

            const response = await fetch(apiUrls.saveSiteConfig(), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(kvConfig)
            })

            if (!response.ok) {
              throw new Error(`Failed to save ${domain.domain}: ${response.status}`)
            }

            results.saved.push(domain.domain)
            console.log('Saved domain to KV:', domain.domain)
          } catch (error) {
            results.errors.push({ domain: domain.domain, error: error.message })
            results.success = false
          }
        }

        // 2. Delete removed domains (if any)
        for (const domainName of this.deletedDomains) {
          try {
            // Call delete API here if needed
            console.log('Would delete domain:', domainName)
            // For now, just log - actual deletion handled by removeDomain UI
          } catch (error) {
            results.errors.push({ domain: domainName, error: error.message })
          }
        }

        // 3. Update user profile with current domain list
        await this.updateUserProfile(userEmail)

        // 4. Mark all as saved if successful
        if (results.success) {
          this.markAllAsSaved()
        }

        this.lastSaved = new Date().toISOString()

        return results
      } catch (error) {
        console.error('Error saving changes:', error)
        results.success = false
        results.errors.push({ domain: 'general', error: error.message })
        return results
      } finally {
        this.isSaving = false
      }
    },

    // Update user profile with current domain list
    async updateUserProfile(userEmail) {
      try {
        // Get current user data
        const currentResponse = await fetch(apiUrls.getUserData(userEmail))
        let currentData = {}
        if (currentResponse.ok) {
          currentData = await currentResponse.json()
        }

        const payload = {
          email: userEmail,
          bio: currentData.bio || '',
          profileimage: currentData.profileimage || '',
          data: {
            ...currentData.data,
            domainConfigs: this.domains,
            branding: this.domains.length > 0 ? {
              mySite: this.domains[0].domain,
              myLogo: this.domains[0].logo,
              mySiteFrontPage: this.domains[0].mySiteFrontPage || ''
            } : {}
          }
        }

        const response = await fetch(apiUrls.updateUserData(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error('Failed to update user profile')
        }

        console.log('User profile updated with domain list')
      } catch (error) {
        console.error('Error updating user profile:', error)
        throw error
      }
    },

    // Mark all current changes as saved
    markAllAsSaved() {
      // Clear change tracking
      this.newDomains.clear()
      this.updatedDomains.clear()
      this.deletedDomains.clear()

      // Update original state
      this.originalDomains.clear()
      this.domains.forEach(domain => {
        this.originalDomains.set(domain.domain, this.deepClone(domain))
      })

      console.log('All changes marked as saved')
    },

    // Utility: Convert modal format to KV format
    convertModalToKVFormat(domainConfig, userEmail) {
      return {
        domain: domainConfig.domain,
        owner: userEmail,
        branding: {
          myLogo: domainConfig.logo || '',
          mobileAppLogo: domainConfig.mobileAppLogo || '',
          slogan: domainConfig.slogan || '',
          contentFilter: domainConfig.contentFilter,
          selectedCategories: domainConfig.selectedCategories || [],
          mySiteFrontPage: domainConfig.mySiteFrontPage || '',
          site_title: this.getDomainTitle(domainConfig.domain),
          menuConfig: domainConfig.menuConfig || { templateData: null }
        },
        contentFilter: {
          metaAreas: domainConfig.selectedCategories || []
        }
      }
    },

    // Utility: Convert KV format to modal format
    convertKVToModalFormat(siteConfig) {
      return {
        domain: siteConfig.domain,
        logo: siteConfig.branding?.myLogo || '',
        mobileAppLogo: siteConfig.branding?.mobileAppLogo || '',
        slogan: siteConfig.branding?.slogan || '',
        contentFilter: siteConfig.branding?.contentFilter || 'none',
        selectedCategories: siteConfig.branding?.selectedCategories || [],
        mySiteFrontPage: siteConfig.branding?.mySiteFrontPage || '',
        menuConfig: siteConfig.menuConfig || { enabled: false, visibleItems: [] }
      }
    },

    // Utility: Get domain title
    getDomainTitle(domain) {
      if (!domain) return 'Your Brand'
      const parts = domain.split('.')
      if (parts.length === 2 || (parts.length === 3 && parts[0] === 'www')) {
        const mainPart = parts.length === 2 ? parts[0] : parts[1]
        return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
      }
      const subdomain = parts[0]
      return subdomain !== 'www'
        ? subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
        : parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    },

    // Utility: Deep clone object
    deepClone(obj) {
      return JSON.parse(JSON.stringify(obj))
    },

    // Utility: Deep equality check
    deepEqual(obj1, obj2) {
      return JSON.stringify(obj1) === JSON.stringify(obj2)
    }
  }
})
