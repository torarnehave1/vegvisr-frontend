<template>
  <div class="blog-view">
    <h1>Blog</h1>
    <div class="search-bar">
      <input v-model="searchQuery" placeholder="Search blog posts..." />
    </div>
    <div v-if="isAdminOrSuperadmin" class="toggle-visibility">
      <button @click="toggleHiddenPosts">
        {{ showHiddenPosts ? 'Show Visible Blog Posts' : 'Show Hidden Blog Posts' }}
      </button>
    </div>
    <div class="blog-cards">
      <div
        v-for="post in filteredPosts"
        :key="post.id"
        class="blog-card"
        @click="viewPost(post.id)"
      >
        <img v-if="post.image" :src="post.image" alt="Post Image" />
        <h2>{{ post.title }}</h2>
        <p>{{ post.snippet }}</p>
        <div v-if="isLoggedIn" class="button-group">
          <button @click.stop="openInEditor(post.id)" class="open-button">Edit</button>
          <button
            @click.stop="toggleVisibility(post.id, showHiddenPosts)"
            class="toggle-visibility-button"
          >
            {{ showHiddenPosts ? 'Show' : 'Hide' }}
          </button>
          <button @click="deletePost(post.id)" class="delete-button">Delete</button>
        </div>
      </div>
    </div>
    <div class="pagination">
      <button :disabled="currentPage === 1" @click="changePage(currentPage - 1)">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const posts = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const postsPerPage = 9
const showHiddenPosts = ref(false) // Toggle for showing hidden posts

const router = useRouter()
const userStore = useUserStore() // Access the Pinia store

// Props
const props = defineProps({
  theme: {
    type: String,
    default: 'light',
  },
})

// Watch for theme changes and apply them
watch(
  () => props.theme,
  (newTheme) => {
    applyTheme(newTheme)
  },
  { immediate: true },
)

// Apply the theme to the body
function applyTheme(newTheme) {
  if (newTheme === 'dark') {
    document.body.classList.add('bg-dark', 'text-white')
  } else {
    document.body.classList.remove('bg-dark', 'text-white')
  }
}

// Check if the user is an Admin or Superadmin
const isAdminOrSuperadmin = computed(() => {
  return userStore.role === 'Admin' || userStore.role === 'Superadmin'
})

// Check if the user is logged in
const isLoggedIn = computed(() => {
  return !!userStore.email // Assuming email indicates login status
})

// Fetch blog posts or search results from the KV store
async function fetchPosts() {
  try {
    const endpoint = searchQuery.value
      ? `https://api.vegvisr.org/search?query=${encodeURIComponent(searchQuery.value)}`
      : showHiddenPosts.value
        ? 'https://api.vegvisr.org/hidden-blog-posts'
        : 'https://api.vegvisr.org/blog-posts'

    const response = await fetch(endpoint)
    if (!response.ok) throw new Error('Failed to fetch posts')
    posts.value = await response.json()
  } catch (error) {
    console.error('Error fetching posts:', error)
  }
}

// Watch for changes in the search query and refetch posts
watch(searchQuery, () => {
  fetchPosts()
})

// Filter posts based on the search query
const filteredPosts = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return posts.value
    .filter((post) => post.title.toLowerCase().includes(query))
    .slice((currentPage.value - 1) * postsPerPage, currentPage.value * postsPerPage)
})

// Calculate total pages
const totalPages = computed(() => Math.ceil(posts.value.length / postsPerPage))

// Change the current page
function changePage(page) {
  currentPage.value = page
}

// Open the blog post view without exposing the email address
function viewPost(id) {
  console.log('Opening post with ID:', id)
  const key = id.split(':')[1] ? id.split(':')[0] : id // Extract the key part (first section) from the ID
  window.open(`https://api.vegvisr.org/view/${key}`, '_blank')
}

// Open the blog post in the editor view
async function openInEditor(id) {
  try {
    const response = await fetch(`https://api.vegvisr.org/view/${id}?raw=true`)
    if (!response.ok) throw new Error('Failed to fetch post content')
    const content = await response.text()
    console.log('Opening post in editor with content:', content)

    userStore.setCurrentBlogId(id) // Use Pinia store action

    console.log('id', id)

    router.push({ name: 'EditorView', query: { content } })
  } catch (error) {
    console.error('Error opening post in editor:', error)
    alert('Failed to open post in editor. Please try again.')
  }
}

// Delete a blog post
async function deletePost(id) {
  if (confirm('Are you sure you want to delete this post?')) {
    try {
      const response = await fetch(`https://api.vegvisr.org/blogpostdelete/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete post')
      posts.value = posts.value.filter((post) => post.id !== id)
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }
}

// Toggle visibility of a blog post (hide or show)
async function toggleVisibility(id, isCurrentlyHidden) {
  const action = isCurrentlyHidden ? 'show' : 'hide'
  if (confirm(`Are you sure you want to ${action} this post?`)) {
    try {
      const response = await fetch('https://api.vegvisr.org/hid_vis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, isVisible: isCurrentlyHidden }), // Toggle visibility
      })
      if (!response.ok) throw new Error(`Failed to ${action} post`)

      // Refresh the blog post list after toggling visibility
      await fetchPosts()
    } catch (error) {
      console.error(`Error trying to ${action} post:`, error)
    }
  }
}

// Toggle between showing visible and hidden posts
function toggleHiddenPosts() {
  showHiddenPosts.value = !showHiddenPosts.value
  fetchPosts()
}

onMounted(() => {
  applyTheme(props.theme)
  fetchPosts()
})
</script>

<style scoped>
.blog-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.search-bar {
  margin-bottom: 1rem;
}

.search-bar input {
  width: 100%;
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.blog-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
  gap: 1rem;
}

.blog-card {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 1rem;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.blog-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.blog-card img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.blog-card h2 {
  font-size: 1.25rem;
  margin: 0.5rem 0;
}

.blog-card p {
  font-size: 0.9rem;
  color: #555;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.pagination button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.pagination button:hover:not(:disabled) {
  background-color: #0056b3;
}

.delete-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #dc3545;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-button:hover {
  background-color: #c82333;
}

.open-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.open-button:hover {
  background-color: #0056b3;
}

.toggle-visibility {
  margin-bottom: 1rem;
}

.toggle-visibility button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-visibility button:hover {
  background-color: #0056b3;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.hide-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #ffc107;
  color: black;
  cursor: pointer;
  transition: background-color 0.2s;
}

.hide-button:hover {
  background-color: #e0a800;
}

.toggle-visibility-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: #ffc107; /* Yellow for toggle action */
  color: black;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-visibility-button:hover {
  background-color: #e0a800;
}
</style>
