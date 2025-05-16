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
    <div v-if="apiKey" class="map-container">
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
const defaultCenter = '37.94100018383558,27.34237557534141'
const currentUrl = ref(window.location.href)

// Initialize map and components
const initMap = async () => {
  try {
    console.log('Starting map initialization...')

    // Check for existing API loader
    let apiLoader = document.querySelector('gmpx-api-loader')
    if (!apiLoader) {
      console.log('Creating new API loader...')
      apiLoader = document.createElement('gmpx-api-loader')
      apiLoader.setAttribute('key', apiKey.value)
      apiLoader.setAttribute('solution-channel', 'GMP_GE_mapsandplacesautocomplete_v2')
      apiLoader.setAttribute('map-id', props.mapId)

      // Add error handler for API loader
      apiLoader.addEventListener('error', (event) => {
        console.error('API Loader error:', event)
        if (event.detail?.error?.includes('RefererNotAllowedMapError')) {
          error.value =
            'RefererNotAllowedMapError: The current domain is not authorized to use this API key.'
        }
      })

      document.body.appendChild(apiLoader)
    } else {
      console.log('Using existing API loader')
    }

    console.log('Waiting for API loader...')
    await customElements.whenDefined('gmpx-api-loader')
    console.log('API loader defined')

    // Clear existing map element content
    const mapElementContainer = document.getElementById('map-element')
    mapElementContainer.innerHTML = ''

    // Create map element first
    const mapElement = document.createElement('gmp-map')
    mapElement.style.width = '100%'
    mapElement.style.height = '600px'
    mapElement.setAttribute('center', defaultCenter)
    mapElement.setAttribute('zoom', '15')
    mapElement.setAttribute('map-id', props.mapId)
    document.getElementById('map-element').appendChild(mapElement)
    mapRef.value = mapElement

    console.log('Waiting for map element to be defined...')
    await customElements.whenDefined('gmp-map')
    console.log('Map element defined')

    // Wait for the map to be ready
    console.log('Waiting for map to be ready...')
    await new Promise((resolve) => {
      const checkMap = () => {
        if (mapElement.innerMap) {
          console.log('Map is ready')
          resolve()
        } else {
          setTimeout(checkMap, 100)
        }
      }
      checkMap()
    })

    // Create place picker after map is ready
    console.log('Creating place picker...')
    await customElements.whenDefined('gmpx-place-picker')

    const pickerContainer = document.createElement('div')
    pickerContainer.className = 'place-picker-container'
    pickerContainer.setAttribute('slot', 'control-block-start-inline-start')

    const placePicker = document.createElement('gmpx-place-picker')
    placePicker.setAttribute('placeholder', 'Search for a place')
    placePicker.addEventListener('gmpx-placechange', onPlaceChanged)
    pickerContainer.appendChild(placePicker)

    // Create marker
    console.log('Creating marker...')
    await customElements.whenDefined('gmp-advanced-marker')

    const marker = document.createElement('gmp-advanced-marker')
    markerRef.value = marker

    // Append elements to map
    mapElement.appendChild(pickerContainer)
    mapElement.appendChild(marker)

    // Set map options
    const map = mapRef.value
    if (map && map.innerMap) {
      map.innerMap.setOptions({
        mapTypeControl: false,
      })

      // Add KML Layer once Google Maps is loaded
      if (window.google && window.google.maps) {
        console.log('Adding KML layer...')
        const kmlLayer = new window.google.maps.KmlLayer({
          url: props.path,
          map: map.innerMap,
          preserveViewport: true,
          suppressInfoWindows: true,
        })

        // Handle KML layer status
        kmlLayer.addListener('status_changed', () => {
          const status = kmlLayer.getStatus()
          console.log('KML Layer Status:', status)
          if (status !== 'OK') {
            error.value = `Failed to load KML: ${status}`
            console.error('KML Error:', status)
          }
          loading.value = false
        })

        // Create info window for KML features
        const infoWindow = new window.google.maps.InfoWindow({
          maxWidth: 300,
        })

        // Add click listener for KML features
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
          infoWindow.open(map.innerMap)
        })
      } else {
        console.error('Google Maps not loaded')
        loading.value = false
      }
    } else {
      throw new Error('Map not initialized properly')
    }
  } catch (err) {
    error.value = `Error initializing map: ${err.message}`
    console.error('Map initialization error:', err)
    loading.value = false
  }
}

// Handle place changes
const onPlaceChanged = (event) => {
  const place = event.target.value
  const map = mapRef.value
  const marker = markerRef.value

  if (!place.location) {
    console.warn('No location details available for:', place.name)
    if (marker) marker.position = null
    return
  }

  if (place.viewport) {
    map.innerMap.fitBounds(place.viewport)
  } else {
    map.center = place.location
    map.zoom = 17
  }

  if (marker) marker.position = place.location

  // Emit the place change event
  emit('place-changed', place)
}

// Fetch API key and initialize
onMounted(async () => {
  try {
    console.log('Fetching API key...')
    // Get API key
    const response = await fetch(
      `https://api.vegvisr.org/getGoogleApiKey?key=${import.meta.env.VITE_API_ACCESS_KEY}`,
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Google API key')
    }
    const data = await response.json()
    apiKey.value = data.apiKey
    console.log('API key received')

    // Load Google Maps Extended Component Library
    console.log('Loading Google Maps library...')
    const script = document.createElement('script')
    script.type = 'module'
    script.src =
      'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.11/index.min.js'

    // Wait for script to load before initializing
    await new Promise((resolve, reject) => {
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

    console.log('Google Maps library loaded')
    await initMap()
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

.map-container {
  width: 100%;
  height: 600px;
  border-radius: 8px;
  overflow: hidden;
}

#map-element {
  width: 100%;
  height: 100%;
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

.place-picker-container {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: 300px;
  padding: 10px;
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
