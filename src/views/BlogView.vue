<template>
  <div class="blog-view">
    <h1>Blog</h1>
    <div class="search-bar">
      <input v-model="searchQuery" placeholder="Search blog posts..." />
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
        <button @click.stop="openInEditor(post.id)" class="open-button">Open</button>
        <button @click="deletePost(post.id)" class="delete-button">Delete</button>
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

const posts = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const postsPerPage = 9

const router = useRouter()

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

// Fetch blog posts from the KV store
async function fetchPosts() {
  try {
    const response = await fetch('https://api.vegvisr.org/blog-posts') // Replace with your API endpoint
    if (!response.ok) throw new Error('Failed to fetch posts')
    posts.value = await response.json()
  } catch (error) {
    console.error('Error fetching posts:', error)
  }
}

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

// Navigate to the full post view
function viewPost(id) {
  window.open(`https://api.vegvisr.org/view/${id}`, '_blank') // Open in a new tab or window
}

// Open the blog post in the editor view
async function openInEditor(id) {
  try {
    const response = await fetch(`https://api.vegvisr.org/view/${id}`)
    if (!response.ok) throw new Error('Failed to fetch post content')
    const content = await response.text()
    console.log('Opening post in editor with content:', content) // Debugging log
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

onMounted(() => {
  applyTheme(props.theme) // Apply the initial theme
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
  grid-template-columns: repeat(3, 1fr); /* Set to 3 columns */
  grid-auto-rows: 1fr; /* Ensure rows are of equal height */
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
</style>
