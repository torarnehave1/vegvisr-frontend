// Test slideshow node creation
// This tests the slideshow integration in GraphViewer

const testSlideshowNode = {
  id: 'test_slideshow_1',
  label: 'Test Slideshow Presentation',
  type: 'slideshow',
  color: '#e6f3ff',
  info: `# Slide 1: Welcome to Vegvisr
This is a test slideshow to demonstrate the new slideshow functionality.

---

# Slide 2: Features
The slideshow system includes:

- **Markdown Support**: Full markdown rendering
- **Multiple Themes**: Dark, light, and custom themes
- **Navigation**: Keyboard and mouse navigation
- **Responsive Design**: Works on all devices

---

# Slide 3: Integration
Access slideshows directly from the GraphViewer:

1. Create a slideshow node
2. Click "Show Slideshow" button
3. Opens in new window
4. Full presentation mode

---

# Slide 4: Thank You
This concludes our test slideshow!

**Questions?** Contact the development team.`,
  visible: true,
  bibl: ['Source: Vegvisr Slideshow Test System'],
}

// Function to add this test node to a graph for testing
const addTestSlideshowToGraph = async (graphId) => {
  try {
    const response = await fetch('https://knowledge.vegvisr.org/addNode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId: graphId,
        node: testSlideshowNode,
      }),
    })

    if (response.ok) {
      console.log('Test slideshow node added successfully!')
      return await response.json()
    } else {
      console.error('Failed to add test slideshow node')
    }
  } catch (error) {
    console.error('Error adding test slideshow node:', error)
  }
}

// Export for use in browser console or testing
if (typeof window !== 'undefined') {
  window.addTestSlideshowToGraph = addTestSlideshowToGraph
  window.testSlideshowNode = testSlideshowNode
}

console.log('Test slideshow node created:', testSlideshowNode)
