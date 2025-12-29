/**
 * Composable for managing chat sessions linked to knowledge graphs.
 * Provides functions to fetch session count and delete sessions.
 */

const CHAT_HISTORY_BASE_URL = 'https://api.vegvisr.org/chat-history'

/**
 * Fetch the chat session count for a specific graph.
 * @param {string} graphId - The graph ID
 * @param {object} userStore - The user store with user_id, email, role
 * @returns {Promise<number>} - The session count
 */
export async function fetchChatSessionCount(graphId, userStore) {
  if (!graphId || !userStore?.user_id) {
    return 0
  }

  try {
    const response = await fetch(`${CHAT_HISTORY_BASE_URL}/session-counts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userStore.user_id,
        'x-user-email': userStore.email || 'anonymous@vegvisr.org',
        'x-user-role': userStore.role || 'User',
      },
      body: JSON.stringify({ graphIds: [graphId] }),
    })

    if (response.ok) {
      const data = await response.json()
      return data.counts?.[graphId] || 0
    }
  } catch (err) {
    console.error('Failed to fetch chat session count:', err)
  }
  return 0
}

/**
 * Delete all chat sessions for a specific graph.
 * Called when a graph is deleted.
 * @param {string} graphId - The graph ID
 * @param {object} userStore - The user store with user_id, email, role
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteChatSessionsByGraph(graphId, userStore) {
  if (!graphId || !userStore?.user_id) {
    return false
  }

  try {
    const response = await fetch(`${CHAT_HISTORY_BASE_URL}/sessions-by-graph/${graphId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userStore.user_id,
        'x-user-email': userStore.email || 'anonymous@vegvisr.org',
        'x-user-role': userStore.role || 'User',
      },
    })

    if (response.ok) {
      console.log(`✅ Deleted chat sessions for graph ${graphId}`)
      return true
    } else {
      console.error(`Failed to delete chat sessions for graph ${graphId}:`, response.status)
    }
  } catch (err) {
    console.error('Error deleting chat sessions:', err)
  }
  return false
}

/**
 * Update graph metadata with the latest chat session count before saving.
 * This should be called before any graph save operation.
 * @param {object} graphData - The graph data object with metadata
 * @param {string} graphId - The graph ID
 * @param {object} userStore - The user store
 * @returns {Promise<object>} - The updated graph data
 */
export async function updateGraphWithChatSessionCount(graphData, graphId, userStore) {
  const count = await fetchChatSessionCount(graphId, userStore)

  if (graphData.metadata) {
    graphData.metadata.chatSessionCount = count
  }

  return graphData
}
