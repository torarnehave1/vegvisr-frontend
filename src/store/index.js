import { createStore } from 'vuex'

const store = createStore({
  state: {
    user: JSON.parse(localStorage.getItem('user')) || { email: null, role: null }, // Restore state
    currentBlogId: null, // Add currentBlogId to store the current blog ID
  },
  mutations: {
    setUser(state, user) {
      state.user.email = user.email
      state.user.role = user.role
      localStorage.setItem('user', JSON.stringify(state.user)) // Persist state
    },
    setCurrentBlogId(state, blogId) {
      state.currentBlogId = blogId // Set the current blog ID
    },
  },
})

// Export the store instance
export default store

// Export a useStore function for accessing the store
export function useStore() {
  return store
}
