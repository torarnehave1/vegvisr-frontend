// Debug script to check node types in GraphViewer
// Add this to browser console when viewing the slideshow node

console.log('🔍 Debugging GraphViewer Node Types')

// Check if we can access Vue components
if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('✅ Vue DevTools available')
} else {
  console.log('⚠️ Vue DevTools not available')
}

// Function to check current graph data
const checkGraphData = () => {
  // Try to find the GraphViewer component data
  const graphViewerElements = document.querySelectorAll('[data-v-*]')

  console.log('📊 Found elements:', graphViewerElements.length)

  // Look for slideshow nodes specifically
  const slideshowElements = document.querySelectorAll('*[class*="slideshow"]')
  console.log('🎞️ Slideshow elements found:', slideshowElements.length)

  // Check if there are any elements with slideshow type
  const allElements = document.querySelectorAll('*')
  let slideshowTypeFound = false

  allElements.forEach((el) => {
    if (el.textContent && el.textContent.includes('slideshow')) {
      console.log('📝 Element with slideshow text:', el)
      slideshowTypeFound = true
    }
  })

  if (!slideshowTypeFound) {
    console.log('❌ No slideshow type references found in DOM')
  }

  // Check for button elements
  const buttons = document.querySelectorAll('button')
  console.log('🔘 Total buttons found:', buttons.length)

  const slideshowButtons = document.querySelectorAll('button[class*="slideshow"], .btn-slideshow')
  console.log('🎬 Slideshow buttons found:', slideshowButtons.length)
}

// Function to manually check node data from API
const checkNodeData = async () => {
  try {
    // Get current graph ID from URL or storage
    const graphId =
      new URLSearchParams(window.location.search).get('id') ||
      localStorage.getItem('currentGraphId')

    if (!graphId) {
      console.log('❌ No graph ID found')
      return
    }

    console.log('📈 Checking graph:', graphId)

    const response = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`)
    const data = await response.json()

    console.log('📦 Graph data:', data)

    // Check for slideshow nodes
    const slideshowNodes = data.nodes.filter((node) => node.type === 'slideshow')
    console.log('🎞️ Slideshow nodes found:', slideshowNodes)

    if (slideshowNodes.length === 0) {
      console.log('⚠️ No nodes with type "slideshow" found')
      console.log('🔍 Available node types:', [...new Set(data.nodes.map((n) => n.type))])
    }
  } catch (error) {
    console.error('❌ Error checking node data:', error)
  }
}

// Run both checks
checkGraphData()
checkNodeData()

console.log('🎯 Debug complete. Check the output above for issues.')
