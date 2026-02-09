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
    setAuthCookie(token) {
      if (typeof document === 'undefined' || !token) return
      const isVegvisr = window.location.hostname.endsWith('vegvisr.org')
      const domain = isVegvisr ? '; Domain=.vegvisr.org' : ''
      const maxAge = 60 * 60 * 24 * 30
      document.cookie = `vegvisr_token=${encodeURIComponent(
        token,
      )}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${domain}`
    },
    clearAuthCookie() {
      if (typeof document === 'undefined') return
      const isVegvisr = window.location.hostname.endsWith('vegvisr.org')
      const domain = isVegvisr ? '; Domain=.vegvisr.org' : ''
      document.cookie = `vegvisr_token=; Path=/; Max-Age=0; SameSite=Lax; Secure${domain}`
    },
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
      if (user.emailVerificationToken) {
        this.setAuthCookie(user.emailVerificationToken)
      }

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
      this.setAuthCookie(token)
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
      this.clearAuthCookie()

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

        // Fetch additional data from config table (including phone)
        await this.fetchUserDataFromConfig()

        return true
      } catch (err) {
        console.error('❌ fetchSession error:', err)
        this.logout()
        return false
      }
    },
    isLocalhost() {
      if (typeof window === 'undefined') return false
      const hostname = window.location.hostname
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('localhost:')
    },

    async autoLoginLocalhost() {
      if (!this.isLocalhost()) return false

      console.log('🏠 Localhost detected - auto-logging in as Superadmin for development')

      try {
        // First check if user data exists in localStorage from a previous session
        const storedUser = JSON.parse(localStorage.getItem('user'))

        if (storedUser && storedUser.emailVerificationToken) {
          console.log('✅ Found existing user data in localStorage - using that')
          this.setUser(storedUser)
        } else {
          // Fallback to hardcoded values if localStorage is empty
          console.log('⚠️ No user data in localStorage - using development defaults')
          const localhostUser = {
            email: 'torarnehave@gmail.com',
            role: 'Superadmin',
            user_id: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
            oauth_id: 'ca3d9d93-3b02-4e49-a4ee-43552ec4ca2b',
            emailVerificationToken: 'b1ca2967e8165ec02fdf039d9e916af4005f7388',
            phone: '+4790914095',
            phoneVerifiedAt: 1768170059,
            profileimage: 'https://profile.vegvisr.org/torarnehave@gmail.com-1743500107976.png',
            branding: { mySite: null, myLogo: null },
          }
          this.setUser(localhostUser)
        }

        // Set session verification flag so router guard allows access
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('email_session_verified', '1')
            console.log('✅ Session verification flag set')
          }
        } catch {
          // ignore storage errors
        }

        console.log('✅ Localhost auto-login complete - Full Superadmin access enabled')
        console.log('🔑 Using emailVerificationToken for X-API-Token header:', this.emailVerificationToken)
        return true
      } catch (error) {
        console.error('❌ Failed to auto-login on localhost:', error)
        return false
      }
    },

    async loadUserFromStorage() {
      console.log('🔄 loadUserFromStorage called')

      // Check for localhost auto-login first
      if (this.isLocalhost()) {
        const isAutoLoggedIn = await this.autoLoginLocalhost()
        if (isAutoLoggedIn) {
          return true
        }
      }

      const storedUser = JSON.parse(localStorage.getItem('user'))
      console.log('📦 Raw localStorage data:', storedUser)
      const cookieToken = (() => {
        if (typeof document === 'undefined') return null
        const raw = document.cookie.split(';').map((part) => part.trim())
        for (const part of raw) {
          if (part.startsWith('vegvisr_token=')) {
            return decodeURIComponent(part.split('=').slice(1).join('='))
          }
        }
        return null
      })()

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
        if (this.emailVerificationToken) {
          this.setAuthCookie(this.emailVerificationToken)
        }
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('email_session_verified', '1')
          }
        } catch {
          // ignore storage errors
        }

        console.log('✅ Loaded user from storage:', this.email, 'ID:', this.user_id)
        console.log('🔍 Store state after loading:', {
          loggedIn: this.loggedIn,
          email: this.email,
          user_id: this.user_id,
          oauth_id: this.oauth_id,
          role: this.role,
        })

        // Fetch additional data from config table (including phone)
        await this.fetchUserDataFromConfig()

        // If role is still missing, fetch it directly from /get-role
        if (!this.role && this.email) {
          try {
            console.log('🔐 Role missing after config fetch; calling /get-role directly...')
            const roleRes = await fetch(
              `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(this.email)}`,
            )
            if (roleRes.ok) {
              const roleData = await roleRes.json()
              if (roleData?.role) {
                this.role = roleData.role
                storedUser.role = roleData.role
                localStorage.setItem('user', JSON.stringify(storedUser))
                console.log('✅ Role fetched from /get-role:', this.role)
              }
            }
          } catch (error) {
            console.warn('Role fetch via /get-role failed:', error)
          }
        }

        // Fallback: try fetching role from token if still missing
        if (!this.role && cookieToken) {
          try {
            console.log('🔐 Role still missing; trying token lookup...')
            const response = await fetch(apiUrls.getUserDataByToken(), {
              headers: { Authorization: `Bearer ${cookieToken}` },
            })
            if (response.ok) {
              const user = await response.json()
              if (user?.role) {
                this.role = user.role
                storedUser.role = user.role
                localStorage.setItem('user', JSON.stringify(storedUser))
              }
              if (user?.emailVerificationToken) {
                this.emailVerificationToken = user.emailVerificationToken
                storedUser.emailVerificationToken = user.emailVerificationToken
                localStorage.setItem('user', JSON.stringify(storedUser))
              }
            }
          } catch (error) {
            console.warn('Role fetch via token failed:', error)
          }
        }
        return true
      }

      if (cookieToken) {
        try {
          console.log('🔐 Found vegvisr_token cookie, fetching user data...')
          const response = await fetch(apiUrls.getUserDataByToken(), {
            headers: { Authorization: `Bearer ${cookieToken}` },
          })
          if (response.ok) {
            const user = await response.json()
            if (user?.email) {
              this.setUser(user)
              try {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('email_session_verified', '1')
                }
              } catch {
                // ignore storage errors
              }
              return true
            }
          } else {
            console.warn('❌ Token lookup failed:', response.status)
          }
        } catch (error) {
          console.error('❌ Token lookup error:', error)
        }
      }

      console.log('❌ No user data in localStorage')
      this.email = null
      this.role = null
      this.user_id = null
      this.oauth_id = null
      this.emailVerificationToken = null
      this.mystmkraUserId = null
      this.branding = { mySite: null, myLogo: null }
      this.loggedIn = false
      return false
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

    async fetchUserDataFromConfig() {
      if (!this.email) {
        console.log('❌ No user email, cannot fetch user data from config')
        return null
      }

      try {
        console.log('🔄 Fetching user data from config table for:', this.email)

        const response = await fetch(apiUrls.getUserData(this.email))
        if (!response.ok) {
          console.error('❌ Failed to fetch user data:', response.status)
          return null
        }

        const userData = await response.json()

        // /userdata returns: { email, user_id, ..., phone, phoneVerifiedAt, data: {...} }
        // Keep compatibility with any older shape that might put fields inside data.
        const payload = userData?.data && typeof userData.data === 'object' ? userData.data : {}
        console.log('✅ Fetched user data from config:', userData)

        const resolvedPhone = userData?.phone ?? payload?.phone ?? payload?.profile?.phone ?? null
        const resolvedPhoneVerifiedAt =
          userData?.phoneVerifiedAt ??
          userData?.phone_verified_at ??
          payload?.phoneVerifiedAt ??
          payload?.phone_verified_at ??
          payload?.profile?.phoneVerifiedAt ??
          null
        // Prefer the role already in the store (from localStorage / login) over the config table
        const resolvedRole = this.role || userData?.role || payload?.role || null

        // Update the userStore with the fetched data
        if (resolvedPhone) {
          this.phone = resolvedPhone
          console.log('📱 Updated phone in userStore:', this.phone)
        }
        if (resolvedPhoneVerifiedAt) {
          this.phoneVerifiedAt = resolvedPhoneVerifiedAt
        }
        if (resolvedRole) {
          this.role = resolvedRole
        }
        if (userData?.user_id || payload?.user_id) {
          this.user_id = userData?.user_id || payload?.user_id
        }
        if (userData?.emailVerificationToken || payload?.emailVerificationToken) {
          this.emailVerificationToken = userData?.emailVerificationToken || payload?.emailVerificationToken
        }

        // Update localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
        storedUser.phone = this.phone
        storedUser.phoneVerifiedAt = this.phoneVerifiedAt
        storedUser.role = this.role
        storedUser.user_id = this.user_id
        storedUser.emailVerificationToken = this.emailVerificationToken
        localStorage.setItem('user', JSON.stringify(storedUser))

        return { ...payload, ...userData }
      } catch (error) {
        console.error('❌ Error fetching user data from config:', error)
        return null
      }
    },
  },
})
