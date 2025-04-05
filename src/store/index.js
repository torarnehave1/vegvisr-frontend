import { createStore } from 'vuex'

const store = createStore({
  state: {
    user: JSON.parse(localStorage.getItem('user')) || { email: null, role: null }, // Restore state
    jwt: localStorage.getItem('jwt') || null, // Add JWT to state
    currentBlogId: null, // Add currentBlogId to store the current blog ID
  },
  mutations: {
    setUser(state, user) {
      state.user.email = user.email
      state.user.role = user.role
      localStorage.setItem('user', JSON.stringify(state.user)) // Persist state
    },
    setJwt(state, jwt) {
      state.jwt = jwt // Set the JWT in state
      localStorage.setItem('jwt', jwt) // Persist JWT in localStorage
      console.log('JWT token set in Vuex store and localStorage:', jwt) // Debugging log
    },
    setCurrentBlogId(state, blogId) {
      state.currentBlogId = blogId // Set the current blog ID
    },
    logout(state) {
      state.user = { email: null, role: null } // Reset user state

      console.log('User logged out. Vuex store cleared, but JWT remains in localStorage.') // Debugging log
    },
  },
})

// Export the store instance
export default store

// Export a useStore function for accessing the store
export function useStore() {
  return store
}
