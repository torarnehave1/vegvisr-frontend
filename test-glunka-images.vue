<template>
  <div class="glunka-test-container">
    <h1>🗺️ Glunka KML Image Test</h1>

    <div class="test-info">
      <h3>📋 Test Instructions:</h3>
      <ol>
        <li>The map below loads your Glunka KML file with images</li>
        <li>Click on the "Start og Slutt" marker to see the image</li>
        <li>The image should display in the info window popup</li>
        <li>Images are extracted from gx:Carousel/gx:Image elements in the KML</li>
      </ol>
    </div>

    <div class="kml-details">
      <h3>🔍 KML File Details:</h3>
      <p><strong>URL:</strong> {{ kmlUrl }}</p>
      <p><strong>Expected Image Placemark:</strong> "Start og Slutt"</p>
      <p><strong>Coordinates:</strong> 11.90439410756417, 63.56290150585642</p>
    </div>

    <div class="map-container">
      <MapViewer
        :path="kmlUrl"
        :map-id="mapId"
        :height="mapHeight"
        @place-changed="onPlaceChanged"
      />
    </div>

    <div class="implementation-notes">
      <h3>⚙️ Implementation Notes:</h3>
      <ul>
        <li>✅ Enhanced MapViewer to extract gx:Carousel/gx:Image from KML</li>
        <li>✅ Replaces {size} placeholder with 800px for Google Earth images</li>
        <li>✅ Styled images with max-width: 300px, max-height: 200px</li>
        <li>✅ Error handling for broken images (onload/onerror events)</li>
        <li>✅ Works for Points, LineStrings, and Polygons</li>
        <li>✅ Enhanced info windows with proper image formatting</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MapViewer from './src/components/MapViewer.vue'

// Test configuration
const kmlUrl = ref('https://klm.vegvisr.org/Glunka%20(1).kml')
const mapId = ref('efe3a8a8c093a07cf97c4b3c')
const mapHeight = ref('600px')

const onPlaceChanged = (placeData) => {
  console.log('📍 Place changed:', placeData)
}

// Log test information
console.log(`
🗺️ GLUNKA KML IMAGE TEST INITIALIZED

Testing enhanced MapViewer with:
• KML URL: ${kmlUrl.value}
• Expected image placemark: "Start og Slutt"
• Image extraction from gx:Carousel/gx:Image elements
• Google Earth hosted image support

Click on markers to test image display!
`)
</script>

<style scoped>
.glunka-test-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
  color: #2c3e50;
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 3px solid #3498db;
  padding-bottom: 10px;
}

.test-info, .kml-details, .implementation-notes {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.test-info {
  border-left: 4px solid #28a745;
}

.kml-details {
  border-left: 4px solid #17a2b8;
}

.implementation-notes {
  border-left: 4px solid #6f42c1;
}

.test-info h3, .kml-details h3, .implementation-notes h3 {
  margin-top: 0;
  color: #495057;
}

.map-container {
  margin: 30px 0;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

ol, ul {
  padding-left: 20px;
}

li {
  margin: 8px 0;
  line-height: 1.5;
}

p {
  margin: 8px 0;
  line-height: 1.6;
}

code {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9em;
}
</style>
