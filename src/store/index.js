import { createStore } from 'vuex'

const store = createStore({
  state: {
    user: JSON.parse(localStorage.getItem('user')) || { email: null, role: null }, // Restore state
    jwt: localStorage.getItem('jwt') || null, // Add JWT to state
    loggedIn: false, // Add a loggedIn flag to track authentication state
    currentBlogId: null, // Add currentBlogId to store the current blog ID
  },
  mutations: {
    setUser(state, user) {
      state.user.email = user.email
      state.user.role = user.role
      state.loggedIn = true
      localStorage.setItem('user', JSON.stringify(state.user)) // Persist user state in localStorage
    },
    setJwt(state, jwt) {
      if (!jwt) {
        console.error('Attempted to set an undefined or null JWT token')
        return
      }
      state.jwt = jwt // Set the JWT in state
      localStorage.setItem('jwt', jwt) // Persist JWT in localStorage
      console.log('JWT token set in Vuex store and localStorage:', jwt) // Debugging log
    },
    setCurrentBlogId(state, blogId) {
      state.currentBlogId = blogId // Set the current blog ID
    },
    logout(state) {
      state.user = { email: null, role: null }
      state.loggedIn = false
      localStorage.removeItem('user') // Clear user state from localStorage
    },
    setLoggedIn(state, status) {
      state.loggedIn = status // Explicitly set loggedIn state
    },
  },
})

// Export the store instance
export default store

// Export a useStore function for accessing the store
export function useStore() {
  return store
}
