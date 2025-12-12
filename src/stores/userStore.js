import { defineStore } from 'pinia'
import { apiUrls } from '@/config/api'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: null,
    role: null,
    user_id: null,
    oauth_id: null,
    emailVerificationToken: null,
    phone: null,
    phoneVerifiedAt: null,
    profileimage: null,
    loggedIn: false,
    mystmkraUserId: null,
    googlePhotosConnected: false,
    googlePhotosCredentials: null,
    branding: {
      mySite: null,
      myLogo: null,
    },
    loginUrl: 'https://auth.vegvisr.org/auth/openauth/login',
    logoutUrl: 'https://auth.vegvisr.org/auth/openauth/logout',
  }),
  actions: {
    setUser(user) {
      console.log('🔧 setUser called with:', user)

      this.email = user.email
      this.role = user.role
      this.user_id = user.user_id
        // Store OpenAuth id separately; also mirror into user_id for compatibility
            this.oauth_id = user.oauth_id || user.user_id || null
            if (!this.user_id && this.oauth_id) this.user_id = this.oauth_id
      this.emailVerificationToken = user.emailVerificationToken
      this.phone = user.phone || null
      this.phoneVerifiedAt = user.phoneVerifiedAt || null
      this.profileimage = user.profileimage || null
      this.mystmkraUserId = user.mystmkraUserId || null
      this.branding = user.branding || { mySite: null, myLogo: null }
      this.loggedIn = true

      const userData = {
        email: user.email,
        role: user.role,
        user_id: user.user_id,
        oauth_id: user.oauth_id || user.user_id || null,
        emailVerificationToken: user.emailVerificationToken,
        phone: user.phone || null,
        phoneVerifiedAt: user.phoneVerifiedAt || null,
        profileimage: user.profileimage || null,
        mystmkraUserId: user.mystmkraUserId || null,
        branding: user.branding || { mySite: null, myLogo: null },
      }

      localStorage.setItem('user', JSON.stringify(userData))
      console.log('💾 User data saved to localStorage:', userData)
      console.log('🔍 Current store state:', {
        loggedIn: this.loggedIn,
        email: this.email,
        user_id: this.user_id,
        role: this.role,
      })
    },
    setUserId(user_id) {
      this.user_id = user_id
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.user_id = user_id
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    setOauthId(oauth_id) {
      this.oauth_id = oauth_id
      if (!this.user_id) this.user_id = oauth_id
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.oauth_id = oauth_id
      if (!storedUser.user_id) storedUser.user_id = oauth_id
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    setMystmkraUserId(mystmkraUserId) {
      this.mystmkraUserId = mystmkraUserId
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.mystmkraUserId = mystmkraUserId
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    setBranding(branding) {
      this.branding = branding
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.branding = branding
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    setEmailVerificationToken(token) {
      this.emailVerificationToken = token
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.emailVerificationToken = token
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    async logout() {
      try {
        await fetch(this.logoutUrl, { method: 'GET', credentials: 'include' })
      } catch (err) {
        console.warn('Logout request failed (continuing local logout):', err)
      }
      this.email = null
      this.role = null
      this.user_id = null
      this.oauth_id = null
      this.emailVerificationToken = null
      this.phone = null
      this.phoneVerifiedAt = null
      this.profileimage = null
      this.mystmkraUserId = null
      this.branding = { mySite: null, myLogo: null }
      this.loggedIn = false
      this.googlePhotosConnected = false
      this.googlePhotosCredentials = null
      localStorage.removeItem('user')
        sessionStorage.removeItem('phone_session_verified')

      // Clear all password verification sessions for security
      this.clearPasswordSessions()
    },

    // Clear all password verification sessions
    clearPasswordSessions() {
      // Find and remove all graph password verification sessions
      const keysToRemove = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('graph_password_verified_')) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => {
        sessionStorage.removeItem(key)
        console.log('🔒 Cleared password session:', key)
      })

      if (keysToRemove.length > 0) {
        console.log(`🔒 Security: Cleared ${keysToRemove.length} password verification sessions`)
      }
    },

    // Google Photos Integration
    async checkGooglePhotosConnection() {
      if (!this.email) {
        console.log('❌ No user email, cannot check Google Photos connection')
        return false
      }

      try {
        console.log('🔄 Checking Google Photos connection for:', this.email)

        const response = await fetch('https://auth.vegvisr.org/picker/get-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_email: this.email }),
        })

        const result = await response.json()

        if (result.success) {
          console.log('✅ Found Google Photos credentials in KV storage')
          this.googlePhotosCredentials = {
            api_key: result.api_key,
            access_token: result.access_token,
            client_id: result.client_id,
          }
          this.googlePhotosConnected = true
          return true
        } else {
          console.log('❌ No Google Photos credentials found:', result.error)
          this.googlePhotosConnected = false
          this.googlePhotosCredentials = null
          return false
        }
      } catch (error) {
        console.error('❌ Error checking Google Photos connection:', error)
        this.googlePhotosConnected = false
        this.googlePhotosCredentials = null
        return false
      }
    },

    async connectGooglePhotos() {
      if (!this.email) {
        throw new Error('User must be logged in to connect Google Photos')
      }

      console.log('🔄 Starting Google Photos OAuth for user:', this.email)

      // Check if already connected first
      const isConnected = await this.checkGooglePhotosConnection()
      if (isConnected) {
        console.log('✅ Already connected to Google Photos')
        return this.googlePhotosCredentials
      }

      // Start OAuth flow
      window.location.href = 'https://auth.vegvisr.org/picker/auth'
    },

    handleGooglePhotosOAuthReturn() {
      const urlParams = new URLSearchParams(window.location.search)
      const pickerSuccess = urlParams.get('picker_auth_success')
      const pickerError = urlParams.get('picker_auth_error')
      const returnedUserEmail = urlParams.get('user_email')

      // Handle OAuth error
      if (pickerError) {
        console.error('❌ Google Photos OAuth Error:', pickerError)
        this.googlePhotosConnected = false
        this.googlePhotosCredentials = null

        // Clean up URL parameters
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('picker_auth_error')
        window.history.replaceState({}, document.title, cleanUrl.toString())
        return false
      }

      // Handle OAuth success
      if (pickerSuccess === 'true' && returnedUserEmail) {
        console.log('🔄 Detected Google Photos OAuth success, checking credentials...')

        // Clean up URL parameters
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('picker_auth_success')
        cleanUrl.searchParams.delete('user_email')
        window.history.replaceState({}, document.title, cleanUrl.toString())

        // Check connection (will auto-populate credentials if found)
        this.checkGooglePhotosConnection()
        return true
      }

      return false
    },

    disconnectGooglePhotos() {
      this.googlePhotosConnected = false
      this.googlePhotosCredentials = null
      console.log('🔌 Disconnected from Google Photos (credentials remain in KV storage)')
    },
    async fetchSession() {
      try {
        const res = await fetch('https://auth.vegvisr.org/auth/openauth/session', {
          credentials: 'include',
        })

        if (!res.ok) {
          this.logout()
          return false
        }

        const data = await res.json()
        if (!data.success || !data.subject) {
          this.logout()
          return false
        }

        const subject = data.subject
        const user = {
          email: subject.email || null,
          role: subject.role || null,
          user_id: subject.id || null,
          oauth_id: subject.id || null,
          emailVerificationToken: null,
          mystmkraUserId: null,
          branding: subject.branding || { mySite: null, myLogo: null },
        }
        this.setUser(user)
        return true
      } catch (err) {
        console.error('❌ fetchSession error:', err)
        this.logout()
        return false
      }
    },
    loadUserFromStorage() {
      console.log('🔄 loadUserFromStorage called')
      const storedUser = JSON.parse(localStorage.getItem('user'))
      console.log('📦 Raw localStorage data:', storedUser)

      if (storedUser && storedUser.email) {
        this.email = storedUser.email
        this.role = storedUser.role
        this.user_id = storedUser.user_id
        this.oauth_id = storedUser.oauth_id || storedUser.user_id || null
        this.emailVerificationToken = storedUser.emailVerificationToken
        this.phone = storedUser.phone || null
        this.phoneVerifiedAt = storedUser.phoneVerifiedAt || null
        this.profileimage = storedUser.profileimage || null
        this.mystmkraUserId = storedUser.mystmkraUserId || null
        this.branding = storedUser.branding || { mySite: null, myLogo: null }
        this.loggedIn = true

        console.log('✅ Loaded user from storage:', this.email, 'ID:', this.user_id)
        console.log('🔍 Store state after loading:', {
          loggedIn: this.loggedIn,
          email: this.email,
          user_id: this.user_id,
          oauth_id: this.oauth_id,
          role: this.role,
        })
      } else {
        console.log('❌ No user data in localStorage')
        this.email = null
        this.role = null
        this.user_id = null
        this.oauth_id = null
        this.emailVerificationToken = null
        this.mystmkraUserId = null
        this.branding = { mySite: null, myLogo: null }
        this.loggedIn = false
      }
    },

    setProfileImage(url) {
      this.profileimage = url
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.profileimage = url
      localStorage.setItem('user', JSON.stringify(storedUser))
    },

    async hydrateProfileImageFromConfig() {
      if (this.profileimage || !this.email) return null
      try {
        const response = await fetch(apiUrls.getUserData(this.email))
        if (!response.ok) return null
        const data = await response.json()
        if (data?.profileimage) {
          this.setProfileImage(data.profileimage)
          return data.profileimage
        }
      } catch (error) {
        console.warn('hydrateProfileImageFromConfig failed:', error)
      }
      return null
    },
  },
})
