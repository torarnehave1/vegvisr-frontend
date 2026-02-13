import { computed, ref } from 'vue'

export function useGraphPasswordGate({ userStore, router, getApiEndpoint }) {
  const showPasswordModal = ref(false)
  const passwordInput = ref('')
  const passwordError = ref('')
  const passwordLoading = ref(false)
  const isPasswordVerified = ref(false)

  const canBypassGraphPassword = computed(
    () => userStore.loggedIn && userStore.role === 'Superadmin',
  )

  const getPasswordSessionKey = (graphId) => `graph_password_verified_${graphId}`

  const clearPasswordInputState = () => {
    passwordInput.value = ''
    passwordError.value = ''
    passwordLoading.value = false
  }

  const markGraphPasswordVerified = (graphId, reason = 'password') => {
    if (!graphId) return

    isPasswordVerified.value = true
    showPasswordModal.value = false
    clearPasswordInputState()

    sessionStorage.setItem(getPasswordSessionKey(graphId), 'true')
    console.log(`🔓 Graph access verified for ${graphId} (${reason})`)
  }

  const hasValidSessionForGraph = (graphId) =>
    sessionStorage.getItem(getPasswordSessionKey(graphId)) === 'true'

  const promptSuperadminBypass = () => {
    if (!canBypassGraphPassword.value) return false

    return window.confirm(
      'This graph is password protected.\n\nYou are signed in as Superadmin. Do you want to bypass password verification?\n\nChoose Cancel to enter the graph password instead.',
    )
  }

  const handleSuperadminBypass = (graphId) => {
    if (!graphId || !canBypassGraphPassword.value) return false
    markGraphPasswordVerified(graphId, 'superadmin-bypass')
    return true
  }

  const ensureGraphAccess = (graphId, isPasswordProtected) => {
    if (!isPasswordProtected || isPasswordVerified.value) return true

    if (hasValidSessionForGraph(graphId)) {
      isPasswordVerified.value = true
      return true
    }

    if (promptSuperadminBypass()) {
      return handleSuperadminBypass(graphId)
    }

    showPasswordModal.value = true
    return false
  }

  const verifyPasswordForGraph = async (graphId) => {
    if (!graphId) {
      passwordError.value = 'Missing graph ID'
      return false
    }

    if (!passwordInput.value.trim()) {
      passwordError.value = 'Please enter a password'
      return false
    }

    passwordLoading.value = true
    passwordError.value = ''

    try {
      const apiUrl = getApiEndpoint(
        `https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`,
      )
      const response = await fetch(apiUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch graph data')
      }

      const data = await response.json()
      const storedPasswordHash = data.metadata?.passwordHash

      if (!storedPasswordHash) {
        passwordError.value = 'This graph is not password protected'
        return false
      }

      // Demo implementation uses base64 hash parity with the editor node.
      const enteredPasswordHash = btoa(passwordInput.value)
      if (enteredPasswordHash === storedPasswordHash) {
        markGraphPasswordVerified(graphId, 'password')
        return true
      }

      passwordError.value = 'Incorrect password'
      return false
    } catch (error) {
      console.error('Password verification error:', error)
      passwordError.value = 'Failed to verify password. Please try again.'
      return false
    } finally {
      passwordLoading.value = false
    }
  }

  const closePasswordModal = () => {
    showPasswordModal.value = false
    clearPasswordInputState()
    router.push('/')
  }

  const resetPasswordVerification = () => {
    isPasswordVerified.value = false
    showPasswordModal.value = false
    clearPasswordInputState()
  }

  return {
    showPasswordModal,
    passwordInput,
    passwordError,
    passwordLoading,
    isPasswordVerified,
    canBypassGraphPassword,
    ensureGraphAccess,
    verifyPasswordForGraph,
    closePasswordModal,
    handleSuperadminBypass,
    resetPasswordVerification,
  }
}
