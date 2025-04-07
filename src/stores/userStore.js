import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: null,
    role: null,
    loggedIn: false,
  }),
  actions: {
    setUser(user) {
      this.email = user.email
      this.role = user.role
      this.loggedIn = true
      localStorage.setItem('user', JSON.stringify({ email: user.email, role: user.role }))
    },
    logout() {
      this.email = null
      this.role = null
      this.loggedIn = false
      localStorage.removeItem('user')
    },
    loadUserFromStorage() {
      const storedUser = JSON.parse(localStorage.getItem('user'))
      if (storedUser && storedUser.email) {
        this.email = storedUser.email
        this.role = storedUser.role
        this.loggedIn = true
      } else {
        this.email = null
        this.role = null
        this.loggedIn = false
      }
    },
  },
})
