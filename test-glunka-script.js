// Quick test script to create a map node with the Glunka KML file
// Run this in your browser console when in GNewViewer

const testGlunkaMap = () => {
  // Create a test map node
  const mapNode = {
    id: 'test-glunka-map-' + Date.now(),
    type: 'map',
    label: 'Glunka Trail with Images',
    path: 'https://klm.vegvisr.org/Glunka%20(1).kml',
    mapId: 'efe3a8a8c093a07cf97c4b3c',
    imageHeight: '600px',
    imageWidth: '100%',
    x: 100,
    y: 100,
    info: 'Trail map of Glunka with images. Click on the "Start og Slutt" marker to see the photo!',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  console.log('🗺️ Creating test Glunka map node:', mapNode)
  
  // If you're in GNewViewer, you can add this node to your graph
  // The exact method depends on your graph management system
  return mapNode
}

// Expected behavior when you click on the "Start og Slutt" marker:
console.log(`
🎯 EXPECTED TEST RESULTS:

1. Map loads showing Glunka trail
2. "Start og Slutt" marker appears at coordinates: 11.904, 63.563
3. When you click the marker, info window opens with:
   ✅ Title: "Start og Slutt"
   ✅ Image from Google Earth (should be visible)
   ✅ Image size: max 300x200px with rounded corners
   ✅ Error handling if image fails to load

🔍 KML IMAGE DETAILS:
• Source: gx:Carousel > gx:Image > gx:imageUrl
• URL: https://earth.usercontent.google.com/hostedimage/...
• Size replacement: {size} → 800

🧪 TO TEST:
1. Create map node with path: https://klm.vegvisr.org/Glunka%20(1).kml
2. Click on markers to verify image display
3. Check browser console for any errors
`)

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testGlunkaMap }
} else if (typeof window !== 'undefined') {
  window.testGlunkaMap = testGlunkaMap
}
