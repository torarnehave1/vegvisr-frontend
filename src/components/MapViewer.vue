// MapViewer.vue version 1.19 (restored original UI) // This is the stable version using the Google
example code and classic autocomplete logic, with the search box floating over the map in the
corner.

<template>
  <div class="map-test-container">
    <div v-if="loading || error" class="overlay">
      <div v-if="loading" class="loading">Loading map...</div>
      <div v-if="error" class="error">
        {{ error }}
        <div v-if="error.includes('RefererNotAllowedMapError')" class="error-help">
          <p>
            This error occurs because the current domain is not authorized to use the Google Maps
            API key.
          </p>
          <p>Please authorize this URL in your Google Cloud Console:</p>
          <code>{{ currentUrl }}</code>
        </div>
      </div>
    </div>
    <div v-if="apiKey" class="map-container" style="position: relative">
      <div class="place-picker-container">
        <input
          id="autocomplete-input"
          type="text"
          placeholder="Search for a place"
          style="width: 100%"
        />
      </div>
      <div id="map-element"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  path: { type: String, required: true },
  mapId: { type: String, default: 'efe3a8a8c093a07cf97c4b3c' },
})

const emit = defineEmits(['place-changed'])

const mapRef = ref(null)
const markerRef = ref(null)
const loading = ref(true)
const error = ref(null)
const apiKey = ref(null)
const currentUrl = ref(window.location.href)

// Helper to load Google Maps JS API with Places library
function loadGoogleMapsApi(key) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve(window.google)
      return
    }
    const scriptId = 'google-maps-script'
    if (document.getElementById(scriptId)) {
      document.getElementById(scriptId).addEventListener('load', () => resolve(window.google))
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.onload = () => resolve(window.google)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Initialize map and components
const initMap = async () => {
  try {
    // Load Google Maps JS API with Places
    await loadGoogleMapsApi(apiKey.value)
    const google = window.google

    // Create map
    const mapElementContainer = document.getElementById('map-element')
    mapElementContainer.innerHTML = ''
    const mapDiv = document.createElement('div')
    mapDiv.style.width = '100%'
    mapDiv.style.height = '600px'
    mapElementContainer.appendChild(mapDiv)
    const map = new google.maps.Map(mapDiv, {
      center: { lat: 37.94100018383558, lng: 27.34237557534141 },
      zoom: 15,
      mapId: props.mapId,
      mapTypeControl: false,
    })
    mapRef.value = map

    // Add KML Layer
    if (props.path) {
      const kmlLayer = new google.maps.KmlLayer({
        url: props.path,
        map: map,
        preserveViewport: true,
        suppressInfoWindows: true,
      })
      kmlLayer.addListener('status_changed', () => {
        const status = kmlLayer.getStatus()
        if (status !== 'OK') {
          error.value = `Failed to load KML: ${status}`
        }
        loading.value = false
      })
      // Info window for KML features
      const infoWindow = new google.maps.InfoWindow({ maxWidth: 300 })
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
    } else {
      loading.value = false
    }

    // Add marker
    const marker = new google.maps.Marker({
      map: map,
      position: map.getCenter(),
      visible: false,
    })
    markerRef.value = marker

    // --- Native Google Maps Places Autocomplete ---
    const input = document.getElementById('autocomplete-input')
    if (input) {
      const autocomplete = new google.maps.places.Autocomplete(input)
      autocomplete.bindTo('bounds', map)
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.geometry || !place.geometry.location) {
          marker.setVisible(false)
          return
        }
        map.panTo(place.geometry.location)
        map.setZoom(17)
        marker.setPosition(place.geometry.location)
        marker.setVisible(true)
        emit('place-changed', {
          name: place.name,
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
          place_id: place.place_id,
          address: place.formatted_address,
        })
      })
    }
    // ---
  } catch (err) {
    error.value = `Error initializing map: ${err.message}`
    loading.value = false
  }
}

onMounted(async () => {
  try {
    // Get API key
    const response = await fetch(
      `https://api.vegvisr.org/getGoogleApiKey?key=${import.meta.env.VITE_API_ACCESS_KEY}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Google API key')
    }
    const data = await response.json()
    apiKey.value = data.apiKey
    await initMap()
  } catch (err) {
    error.value = `Error loading map: ${err.message}`
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

.map-container {
  width: 100%;
  height: 600px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

#map-element {
  width: 100%;
  height: 100%;
}

.place-picker-container {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
  width: 300px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
}

.place-picker-container input[type='text'] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
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

.error-help {
  margin-top: 10px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
  color: #333;
  font-size: 0.9rem;
}

.error-help p {
  margin: 5px 0;
}

.error-help code {
  display: block;
  padding: 8px;
  margin: 8px 0;
  background-color: #e9ecef;
  border-radius: 4px;
  font-family: monospace;
  word-break: break-all;
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
