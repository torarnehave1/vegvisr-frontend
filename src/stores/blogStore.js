import { defineStore } from 'pinia'

export const useBlogStore = defineStore('blog', {
  state: () => ({
    currentBlogId: null,
    markdown: '',
    isVisible: true,
    shareableLink: '',
    blogPosts: [],
  }),
  actions: {
    async saveBlog(email) {
      try {
        const payload = {
          id: this.currentBlogId,
          markdown: this.markdown,
          isVisible: this.isVisible,
          email,
        }

        const response = await fetch('https://api.vegvisr.org/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to save blog: ${errorText}`)
        }

        const data = await response.json()
        this.currentBlogId = data.link.split('/').pop()
        this.shareableLink = data.link
      } catch (error) {
        console.error('Error saving blog:', error)
        throw error
      }
    },
    async fetchBlogPosts(showHidden = false) {
      console.log('Fetching blog posts. Hidden posts:', showHidden)
      try {
        const endpoint = showHidden
          ? 'https://api.vegvisr.org/blog-posts?hidden=true'
          : 'https://api.vegvisr.org/blog-posts'
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error('Failed to fetch blog posts')
        }
        this.blogPosts = await response.json()
        console.log('Fetched blog posts:', this.blogPosts)
      } catch (error) {
        console.error('Error fetching blog posts:', error)
      }
    },
    async toggleVisibility() {
      this.isVisible = !this.isVisible
      await this.fetchBlogPosts(!this.isVisible)
    },
    clearBlog() {
      this.currentBlogId = null
      this.markdown = ''
      this.isVisible = true
      this.shareableLink = ''
    },
  },
})
