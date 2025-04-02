import { createStore } from 'vuex'

const store = createStore({
  state: {
    user: {
      email: null,
      role: null,
    },
  },
  mutations: {
    setUser(state, user) {
      state.user.email = user.email
      state.user.role = user.role
    },
  },
})

// Export the store instance
export default store

// Export a useStore function for accessing the store
export function useStore() {
  return store
}
