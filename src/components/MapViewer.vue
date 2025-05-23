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

async function handleMapRightClick(latLng, map) {
  if (!window.confirm('Do you want to add a marker here?')) return
  const name = window.prompt('Enter marker name:')
  if (!name) return
  const description = window.prompt('Enter marker description:') || ''

  // Prepare the payload for the API
  const payload = {
    name,
    description,
    longitude: latLng.lng(),
    latitude: latLng.lat(),
  }

  try {
    const response = await fetch('https://api.vegvisr.org/updatekml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_API_ACCESS_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    const result = await response.json()
    if (result.success) {
      // Add marker to map immediately
      const marker = new window.google.maps.Marker({
        position: latLng,
        map: map,
        title: name,
        visible: true,
      })
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<h3>${name}</h3><p>${description}</p>`,
      })
      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })
      alert('Marker added!')
    } else {
      alert('Failed to add marker: ' + (result.message || 'Unknown error'))
    }
  } catch (err) {
    alert('Error adding marker: ' + err.message)
  }
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

    // Add right-click context menu for adding markers
    map.addListener('rightclick', (event) => {
      handleMapRightClick(event.latLng, map)
    })

    // --- Fetch and parse KML, create markers manually ---
    if (props.path) {
      try {
        const response = await fetch(props.path)
        if (!response.ok) throw new Error('Failed to fetch KML')
        const kmlText = await response.text()
        const parser = new window.DOMParser()
        const kmlDoc = parser.parseFromString(kmlText, 'application/xml')
        const placemarks = kmlDoc.getElementsByTagName('Placemark')
        for (let i = 0; i < placemarks.length; i++) {
          const placemark = placemarks[i]
          const name = placemark.getElementsByTagName('name')[0]?.textContent || ''
          const description = placemark.getElementsByTagName('description')[0]?.textContent || ''
          const coords = placemark.getElementsByTagName('coordinates')[0]?.textContent.trim()
          if (!coords) continue
          const [lng, lat] = coords.split(',').map(Number)
          if (isNaN(lat) || isNaN(lng)) continue

          // Create marker
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: name,
            visible: true,
          })

          // Info window
          const infoWindow = new google.maps.InfoWindow({
            content: `<h3>${name}</h3><p>${description}</p>`,
          })
          marker.addListener('click', () => {
            infoWindow.open(map, marker)
          })
        }
        loading.value = false
      } catch (err) {
        error.value = `Error loading KML: ${err.message}`
        loading.value = false
      }
    } else {
      loading.value = false
    }

    // Add marker for autocomplete
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
  left: 50%;
  transform: translateX(-50%);
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
