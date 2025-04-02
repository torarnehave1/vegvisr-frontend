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

export default store
