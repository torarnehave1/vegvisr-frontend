import { createStore } from 'vuex'

export default createStore({
  state: {
    user: {
      email: null,
      role: null,
    },
  },
  mutations: {
    setUser(state, userData) {
      state.user.email = userData.email
      state.user.role = userData.role
    },
    clearUser(state) {
      state.user.email = null
      state.user.role = null
    },
  },
  actions: {
    async fetchUser({ commit }, email) {
      try {
        const response = await fetch(`https://dashboard.vegvisr.org/userdata?email=${email}`)
        if (!response.ok) {
          throw new Error('Failed to fetch user data')
        }
        const userData = await response.json()
        if (userData) {
          commit('setUser', { email: userData.email, role: userData.role }) // Assuming role is directly in the response
        } else {
          console.warn('User data not found for email:', email)
          commit('clearUser')
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        commit('clearUser')
      }
    },
  },
  getters: {
    userEmail: (state) => state.user.email,
    userRole: (state) => state.user.role,
    isLoggedIn: (state) => !!state.user.email,
  },
})
