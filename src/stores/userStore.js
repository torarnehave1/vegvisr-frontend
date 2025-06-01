import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: null,
    role: null,
    user_id: null,
    emailVerificationToken: null,
    loggedIn: false,
  }),
  actions: {
    setUser(user) {
      this.email = user.email
      this.role = user.role
      this.user_id = user.user_id
      this.emailVerificationToken = user.emailVerificationToken
      this.loggedIn = true
      localStorage.setItem(
        'user',
        JSON.stringify({
          email: user.email,
          role: user.role,
          user_id: user.user_id,
          emailVerificationToken: user.emailVerificationToken,
        }),
      )
    },
    setUserId(user_id) {
      this.user_id = user_id
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.user_id = user_id
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    setEmailVerificationToken(token) {
      this.emailVerificationToken = token
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
      storedUser.emailVerificationToken = token
      localStorage.setItem('user', JSON.stringify(storedUser))
    },
    logout() {
      this.email = null
      this.role = null
      this.user_id = null
      this.emailVerificationToken = null
      this.loggedIn = false
      localStorage.removeItem('user')
    },
    loadUserFromStorage() {
      const storedUser = JSON.parse(localStorage.getItem('user'))
      if (storedUser && storedUser.email) {
        this.email = storedUser.email
        this.role = storedUser.role
        this.user_id = storedUser.user_id
        this.emailVerificationToken = storedUser.emailVerificationToken
        this.loggedIn = true
      } else {
        this.email = null
        this.role = null
        this.user_id = null
        this.emailVerificationToken = null
        this.loggedIn = false
      }
    },
  },
})
