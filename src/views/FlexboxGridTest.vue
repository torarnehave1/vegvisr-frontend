<template>
  <div class="flexbox-grid-test">
    <h1>FLEXBOX-GRID Test Page</h1>

    <div class="test-section">
      <h2>Test 1: Simple Grid with 6 Images</h2>
      <div class="test-grid">
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=1" alt="Test Image 1" />
        </div>
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=2" alt="Test Image 2" />
        </div>
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=3" alt="Test Image 3" />
        </div>
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=4" alt="Test Image 4" />
        </div>
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=5" alt="Test Image 5" />
        </div>
        <div class="grid-item">
          <img src="https://picsum.photos/200/150?random=6" alt="Test Image 6" />
        </div>
      </div>
    </div>

    <div class="test-section">
      <h2>Test 2: Processed FLEXBOX-GRID Content</h2>
      <!-- BYPASS v-html - create grid directly -->
      <div class="DIRECT-GRID-TEST">
        <div v-for="(imageUrl, index) in processedImages" :key="index" class="DIRECT-GRID-ITEM">
          <img :src="imageUrl" :alt="`Direct Image ${index + 1}`" />
        </div>
      </div>

      <!-- Original v-html version for comparison -->
      <h3>Original v-html version (broken):</h3>
      <div v-html="processedFlexboxGrid"></div>
    </div>

    <div class="test-section">
      <h2>Test 3: Debug Information</h2>
      <div class="debug-info">
        <h3>Image Matches Found:</h3>
        <pre>{{ JSON.stringify(debugInfo.imageMatches, null, 2) }}</pre>

        <h3>Filtered Images:</h3>
        <pre>{{ JSON.stringify(debugInfo.filteredImages, null, 2) }}</pre>

        <h3>Grid Items HTML:</h3>
        <pre>{{ debugInfo.gridItems }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>Test 4: Original Test Content</h2>
      <div class="test-content">
        <textarea
          v-model="testContent"
          rows="10"
          cols="80"
          placeholder="Paste your FLEXBOX-GRID content here"
        ></textarea>
        <br />
        <button @click="processTestContent">Process Content</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const testContent = ref(`[FLEXBOX-GRID]
![Test Image 1](https://picsum.photos/200/150?random=1)
![Test Image 2](https://picsum.photos/200/150?random=2)
![Test Image 3](https://picsum.photos/200/150?random=3)
![Test Image 4](https://picsum.photos/200/150?random=4)
![Test Image 5](https://picsum.photos/200/150?random=5)
![Test Image 6](https://picsum.photos/200/150?random=6)
[END FLEXBOX]`)

const debugInfo = ref({
  imageMatches: [],
  filteredImages: [],
  gridItems: '',
})

const processFlexboxGrid = (content) => {
  console.log('=== SUPER SIMPLE FLEXBOX-GRID Debug ===')
  console.log('Input content:', content)

  const cleanContent = content.trim()

  // SUPER SIMPLE: Just find ALL images with one regex
  const allImageMatches = cleanContent.match(/!\[([^\]]*?)\]\(([^)]+)\)/g) || []
  console.log('Found ALL images:', allImageMatches)

  // Process each image into grid items
  const gridItems = allImageMatches
    .map((imgMatch, index) => {
      const parts = imgMatch.match(/!\[([^\]]*?)\]\(([^)]+)\)/)
      if (parts) {
        const [, altText, url] = parts
        const imgHtml = `<img src="${url}" alt="${altText}" style="width: 100%; height: auto; display: block;">`
        console.log(`Grid item ${index + 1}:`, imgHtml)
        return `<div class="processed-grid-item">${imgHtml}</div>`
      }
      return ''
    })
    .filter((item) => item.length > 0)
    .join('')

  console.log('All grid items:', gridItems)

  // Store debug info
  debugInfo.value = {
    imageMatches: allImageMatches,
    filteredImages: allImageMatches,
    gridItems: gridItems,
  }

  const result = `<div class="processed-flexbox-grid FORCE-GRID-LAYOUT">${gridItems}</div>`

  console.log('SUPER SIMPLE Final result:', result)
  console.log('SUPER SIMPLE Number of grid items:', allImageMatches.length)
  console.log('SUPER SIMPLE Grid items HTML length:', gridItems.length)
  return result
}

const processedImages = computed(() => {
  const match = testContent.value.match(/\[FLEXBOX-GRID\]([\s\S]*?)\[END\s+FLEXBOX\]/gs)
  if (match && match[0]) {
    const content = match[0].replace(/\[FLEXBOX-GRID\]/, '').replace(/\[END\s+FLEXBOX\]/, '')
    const cleanContent = content.trim()
    const allImageMatches = cleanContent.match(/!\[([^\]]*?)\]\(([^)]+)\)/g) || []

    return allImageMatches
      .map((imgMatch) => {
        const parts = imgMatch.match(/!\[([^\]]*?)\]\(([^)]+)\)/)
        return parts ? parts[2] : '' // Return the URL
      })
      .filter((url) => url.length > 0)
  }
  return []
})

const processedFlexboxGrid = computed(() => {
  const match = testContent.value.match(/\[FLEXBOX-GRID\]([\s\S]*?)\[END\s+FLEXBOX\]/gs)
  if (match && match[0]) {
    const content = match[0].replace(/\[FLEXBOX-GRID\]/, '').replace(/\[END\s+FLEXBOX\]/, '')
    return processFlexboxGrid(content)
  }
  return '<p>No FLEXBOX-GRID content found</p>'
})

const processTestContent = () => {
  // Force recomputation
  const temp = testContent.value
  testContent.value = ''
  testContent.value = temp
}
</script>

<style scoped>
.flexbox-grid-test {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.test-section {
  margin: 40px 0;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.test-section h2 {
  color: #333;
  margin-bottom: 20px;
}

.debug-info {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
}

.debug-info h3 {
  margin: 10px 0;
  color: #666;
}

.debug-info pre {
  background: white;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
}

.test-content textarea {
  width: 100%;
  font-family: monospace;
  margin-bottom: 10px;
}

.test-content button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-content button:hover {
  background: #0056b3;
}

.test-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 1000px;
  margin: 25px auto;
  justify-items: center;
  border: 2px solid red;
  padding: 20px;
}

.test-grid .grid-item {
  border: 1px solid blue;
  width: 100%;
}

.test-grid .grid-item img {
  width: 100%;
  height: auto;
  display: block;
}

.grid-item img {
  width: 100%;
  height: auto;
  display: block;
}

/* CSS for the processed FLEXBOX-GRID - OVERRIDE EVERYTHING */
.processed-flexbox-grid {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 20px !important;
  max-width: 1000px !important;
  margin: 25px auto !important;
  justify-items: center !important;
  border: 2px solid orange !important;
  padding: 20px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  /* Override any bootstrap/framework styles */
  flex-direction: unset !important;
  flex-wrap: unset !important;
  align-items: unset !important;
  justify-content: unset !important;
}

.processed-grid-item {
  border: 1px solid green !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  /* Override any bootstrap/framework styles */
  flex: unset !important;
  flex-basis: unset !important;
  flex-grow: unset !important;
  flex-shrink: unset !important;
  display: block !important;
}

.processed-grid-item img {
  width: 100% !important;
  height: auto !important;
  display: block !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* DEBUG: Force grid layout with extreme overrides */
.FORCE-GRID-LAYOUT {
  display: grid !important;
  grid-template-columns: 1fr 1fr 1fr !important;
  grid-template-rows: auto auto !important;
  background-color: yellow !important;
  min-height: 400px !important;
}

.FORCE-GRID-LAYOUT > * {
  background-color: lightblue !important;
  border: 3px solid red !important;
  padding: 10px !important;
}

/* DIRECT GRID - NO v-html interference */
.DIRECT-GRID-TEST {
  display: grid !important;
  grid-template-columns: 1fr 1fr 1fr !important;
  grid-template-rows: auto auto !important;
  gap: 20px !important;
  background-color: lime !important;
  border: 5px solid purple !important;
  padding: 20px !important;
  margin: 20px 0 !important;
}

.DIRECT-GRID-ITEM {
  background-color: pink !important;
  border: 3px solid blue !important;
  padding: 10px !important;
}

.DIRECT-GRID-ITEM img {
  width: 100% !important;
  height: auto !important;
  display: block !important;
}
</style>
