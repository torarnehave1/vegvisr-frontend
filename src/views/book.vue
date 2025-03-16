<template>
  <div :class="['book-view', { 'bg-dark': theme === 'dark', 'text-white': theme === 'dark' }]">
    <div class="cover-container">
      <img src="src/assets/bookcover.svg" alt="Hagala Book Cover" class="book-cover" />
    </div>

    <div class="text-container">
      <h1>Hagala: The Ancient Sound Code Behind the Vegvísir Mystery</h1>
      <textarea v-model="introText" class="intro-textarea"></textarea>
      <button @click="saveIntroText" class="btn btn-primary">Save</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import axios from 'axios'

export default {
  name: 'BookView',
  props: {
    theme: {
      type: String,
      default: 'light',
    },
  },
  setup() {
    const introText = ref('')

    const loadIntroText = async () => {
      try {
        const response = await axios.get('/json/book.json')
        introText.value = response.data.introText
      } catch (error) {
        console.error('Error loading intro text:', error)
      }
    }

    const saveIntroText = async () => {
      try {
        await axios.put('/json/book.json', { introText: introText.value })
        alert('Intro text saved successfully!')
      } catch (error) {
        console.error('Error saving intro text:', error)
      }
    }

    loadIntroText()

    return {
      introText,
      saveIntroText,
    }
  },
}
</script>

<style>
.book-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
  background-color: #f8f8f8;
}

.bg-dark {
  background-color: #343a40 !important;
}

.text-white {
  color: #fff !important;
}

.cover-container {
  margin-bottom: 20px;
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: #e0e0e0; /* Added background color for visibility */
  padding: 20px;
}

.book-cover {
  max-width: 300px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.text-container {
  max-width: 600px;
}

h1 {
  color: #c9adad;
  font-size: 28px;
  margin-bottom: 15px;
}

.intro-textarea {
  width: 100%;
  height: 150px;
  font-size: 18px;
  line-height: 1.6;
  color: #333;
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
}

.btn {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
</style>
