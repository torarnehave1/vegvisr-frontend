<template>
  <div class="map-test-container">
    <h2>KML Map Test Page</h2>
    <div class="overlay" v-if="loading || error">
      <div v-if="loading" class="loading">Loading map...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
    <div ref="mapRef" class="map" style="width: 100%; height: 600px"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'

const mapRef = ref(null)
const loading = ref(true)
const error = ref(null)
const path = 'https://klm.vegvisr.org/Vegvisr.org.kml' // Hardcoded path for testing

onMounted(async () => {
  try {
    const response = await fetch(
      `https://api.vegvisr.org/getGoogleApiKey?key=${import.meta.env.VITE_API_ACCESS_KEY}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Google API key')
    }
    const data = await response.json()
    const apiKey = data.apiKey

    const loader = new Loader({
      apiKey: apiKey,
      version: 'weekly',
      libraries: ['places'],
    })

    await loader.importLibrary('maps')
    await nextTick()

    if (!mapRef.value) {
      throw new Error('Map container not found in DOM')
    }

    const map = new google.maps.Map(mapRef.value, {
      center: { lat: 37.94100018383558, lng: 27.34237557534141 },
      zoom: 15,
    })

    const kmlLayer = new google.maps.KmlLayer({
      url: path, // Use path variable
      map: map,
      preserveViewport: true,
      suppressInfoWindows: true,
    })

    kmlLayer.addListener('status_changed', () => {
      const status = kmlLayer.getStatus()
      console.log('KML Layer Status:', status)
      if (status !== 'OK') {
        error.value = `Failed to load KML: ${status}`
        console.error('KML Error:', status)
      }
      loading.value = false
    })

    const infoWindow = new google.maps.InfoWindow({
      maxWidth: 300,
    })

    kmlLayer.addListener('click', (kmlEvent) => {
      const placeName = kmlEvent.featureData.name
      const content = `
        <div class="custom-info-window">
          <h3>${placeName}</h3>
          <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.parentElement.parentElement.style.display='none';">×</button>
        </div>
      `
      infoWindow.setContent(content)
      infoWindow.setPosition(kmlEvent.latLng)
      infoWindow.open(map)
    })
  } catch (err) {
    error.value = `Error loading map: ${err.message}`
    console.error(err)
    loading.value = false
  }
})
</script>

<style scoped>
.map-test-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

h2 {
  text-align: center;
  margin-bottom: 20px;
}

.map {
  border-radius: 8px;
  overflow: hidden;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading,
.error {
  text-align: center;
  font-size: 1.2rem;
  margin: 20px 0;
}

.error {
  color: red;
}

.custom-info-window {
  position: relative;
  padding: 10px;
  font-family: Arial, sans-serif;
}

.custom-info-window h3 {
  margin: 0 20px 10px 0;
  font-size: 16px;
  color: #333;
}

.custom-info-window .close-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  padding: 2px 6px;
}

.custom-info-window .close-btn:hover {
  color: #000;
}
</style>
