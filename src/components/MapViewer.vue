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
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  path: { type: String, required: true },
  mapId: { type: String, default: 'efe3a8a8c093a07cf97c4b3c' },
  height: { type: String, default: '600px' },
})

const emit = defineEmits(['place-changed'])

const mapRef = ref(null)
const markerRef = ref(null)
const kmlMarkers = ref([]) // Track KML markers for cleanup
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

// Function to clear existing KML markers
function clearKmlMarkers() {
  console.log('🧹 Clearing', kmlMarkers.value.length, 'existing markers')
  kmlMarkers.value.forEach((marker) => {
    marker.setMap(null)
  })
  kmlMarkers.value = []
  console.log('✅ Markers cleared')
}

// Function to load KML data and create markers
async function loadKmlData(path, map) {
  if (!path || !map) return

  // Clear existing KML markers
  clearKmlMarkers()

  // Array to collect all points for bounds calculation
  const allPoints = []

  try {
    console.log('🗺️ Loading KML from:', path)
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error(`Failed to fetch KML: ${response.status} ${response.statusText}`)
    }
    const kmlText = await response.text()
    console.log('📄 KML content loaded, length:', kmlText.length)

    const parser = new window.DOMParser()
    const kmlDoc = parser.parseFromString(kmlText, 'application/xml')

    // Check for XML parsing errors
    const parseError = kmlDoc.querySelector('parsererror')
    if (parseError) {
      throw new Error(`KML parsing error: ${parseError.textContent}`)
    }

    const placemarks = kmlDoc.getElementsByTagName('Placemark')

    console.log('🗺️ Found', placemarks.length, 'placemarks in KML')
    
    // Log first placemark details for debugging
    if (placemarks.length > 0) {
      const firstPlacemark = placemarks[0]
      const firstName = firstPlacemark.getElementsByTagName('name')[0]?.textContent || 'No name'
      console.log('🏷️ First placemark name:', firstName)
      
      // Check if it has carousel/image
      const hasCarousel = firstPlacemark.getElementsByTagName('gx:Carousel')[0] || firstPlacemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]
      console.log('📦 First placemark has carousel:', !!hasCarousel)
    }

    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i]
      const name = placemark.getElementsByTagName('name')[0]?.textContent || ''
      const description = placemark.getElementsByTagName('description')[0]?.textContent || ''

      // Handle different geometry types
      const point = placemark.getElementsByTagName('Point')[0]
      const lineString = placemark.getElementsByTagName('LineString')[0]
      const polygon = placemark.getElementsByTagName('Polygon')[0]

      if (point) {
        // Handle Point geometry (markers)
        const coords = point.getElementsByTagName('coordinates')[0]?.textContent.trim()
        if (!coords) continue
        const [lng, lat] = coords.split(',').map(Number)
        if (isNaN(lat) || isNaN(lng)) continue

        allPoints.push({ lat, lng })

        // Create marker
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: map,
          title: name,
          visible: true,
          // Add a distinctive icon for uploaded KML markers
          icon: {
            url:
              'data:image/svg+xml;charset=UTF-8,' +
              encodeURIComponent(`
              <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="8" fill="#ff4444" stroke="#ffffff" stroke-width="2"/>
                <circle cx="10" cy="10" r="4" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(20, 20),
            anchor: new window.google.maps.Point(10, 10),
          },
        })

        // Add to tracking array
        kmlMarkers.value.push(marker)

        // Extract image from KML if it exists
        let imageContent = ''
        console.log('🔍 Checking placemark for images:', name)
        const carousel = placemark.getElementsByTagName('gx:Carousel')[0] || placemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]
        console.log('📦 Found carousel:', !!carousel)
        if (carousel) {
          const gxImage = carousel.getElementsByTagName('gx:Image')[0] || carousel.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Image')[0]
          console.log('🖼️ Found gx:Image:', !!gxImage)
          if (gxImage) {
            const imageUrl = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent || gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent
            console.log('🔗 Found imageUrl:', imageUrl)
            if (imageUrl) {
              // Clean up the image URL (remove size placeholder if it exists)
              const cleanImageUrl = imageUrl.replace('{size}', '800')
              console.log('✨ Clean imageUrl:', cleanImageUrl)
              
              // Use Cloudflare Worker to proxy the image and bypass CORS
              const proxyImageUrl = `https://image-proxy.torarnehave.workers.dev/?url=${encodeURIComponent(cleanImageUrl)}`
              
              imageContent = `<div style="text-align: center; margin: 10px 0;">
                <img src="${proxyImageUrl}" alt="${name}" style="max-width: 300px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
                     onload="console.log('✅ Image loaded successfully via Cloudflare proxy'); this.style.opacity='1';" 
                     onerror="console.log('❌ Image failed to load via proxy'); this.style.display='none'; this.nextElementSibling.style.display='block';" 
                     style="opacity: 0; transition: opacity 0.3s ease;">
                <div style="display: none; padding: 15px; background: #e3f2fd; border-radius: 8px; border: 2px solid #2196F3; max-width: 280px; margin: 0 auto;">
                  <div style="font-size: 1.8em; margin-bottom: 8px;">🏔️</div>
                  <div style="color: #1976D2; font-weight: bold; margin-bottom: 5px;">Google Earth Image</div>
                  <div style="color: #666; font-size: 0.85em;">Image temporarily unavailable</div>
                </div>
              </div>`
            }
          }
        }

        // Info window for markers with enhanced content including images
        const infoContent = `
          <div style="max-width: 320px;">
            <h3 style="margin: 0 0 8px 0; color: #333;">${name}</h3>
            ${imageContent}
            ${description ? `<p style="margin: 8px 0 0 0; color: #666;">${description}</p>` : ''}
          </div>
        `

        const infoWindow = new window.google.maps.InfoWindow({
          content: infoContent,
          maxWidth: 350,
        })
        marker.addListener('click', () => {
          infoWindow.open(map, marker)
        })
      } else if (lineString) {
        // Handle LineString geometry (paths)
        const coords = lineString.getElementsByTagName('coordinates')[0]?.textContent.trim()
        if (!coords) continue

        const path = coords
          .split(/\s+/)
          .map((coord) => {
            const [lng, lat] = coord.split(',').map(Number)
            return { lat, lng }
          })
          .filter((point) => !isNaN(point.lat) && !isNaN(point.lng))

        if (path.length < 2) continue

        // Add all path points for bounds calculation
        allPoints.push(...path)

        console.log('🛤️ Creating path with', path.length, 'points')

        // Create polyline
        const polyline = new window.google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 1.0,
          strokeWeight: 3,
          map: map,
        })

        // Add to tracking array (we'll track all map objects)
        kmlMarkers.value.push({ setMap: (m) => polyline.setMap(m) })

        // Extract image from KML if it exists
        let imageContent = ''
        const carousel = placemark.getElementsByTagName('gx:Carousel')[0] || placemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]
        if (carousel) {
          const gxImage = carousel.getElementsByTagName('gx:Image')[0] || carousel.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Image')[0]
          if (gxImage) {
            const imageUrl = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent || gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent
            if (imageUrl) {
              const cleanImageUrl = imageUrl.replace('{size}', '800')
              imageContent = `<div style="text-align: center; margin: 10px 0;">
                <img src="${cleanImageUrl}" alt="${name || 'Path'}" style="max-width: 300px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onload="this.style.display='block'" onerror="this.style.display='none'">
              </div>`
            }
          }
        }

        // Info window for paths (click on path) with enhanced content
        if (name || description || imageContent) {
          const infoContent = `
            <div style="max-width: 320px;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${name || 'Path'}</h3>
              ${imageContent}
              ${description ? `<p style="margin: 8px 0 0 0; color: #666;">${description}</p>` : ''}
            </div>
          `
          polyline.addListener('click', (event) => {
            const infoWindow = new window.google.maps.InfoWindow({
              content: infoContent,
              position: event.latLng,
              maxWidth: 350,
            })
            infoWindow.open(map)
          })
        }
      } else if (polygon) {
        // Handle Polygon geometry (areas)
        const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0]
        if (!outerBoundary) continue

        const linearRing = outerBoundary.getElementsByTagName('LinearRing')[0]
        if (!linearRing) continue

        const coords = linearRing.getElementsByTagName('coordinates')[0]?.textContent.trim()
        if (!coords) continue

        const path = coords
          .split(/\s+/)
          .map((coord) => {
            const [lng, lat] = coord.split(',').map(Number)
            return { lat, lng }
          })
          .filter((point) => !isNaN(point.lat) && !isNaN(point.lng))

        if (path.length < 3) continue

        // Add all polygon points for bounds calculation
        allPoints.push(...path)

        console.log('🏞️ Creating polygon with', path.length, 'points')

        // Create polygon
        const polygonShape = new window.google.maps.Polygon({
          paths: path,
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          map: map,
        })

        // Add to tracking array
        kmlMarkers.value.push({ setMap: (m) => polygonShape.setMap(m) })

        // Extract image from KML if it exists
        let imageContent = ''
        const carousel = placemark.getElementsByTagName('gx:Carousel')[0] || placemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]
        if (carousel) {
          const gxImage = carousel.getElementsByTagName('gx:Image')[0] || carousel.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Image')[0]
          if (gxImage) {
            const imageUrl = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent || gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent
            if (imageUrl) {
              const cleanImageUrl = imageUrl.replace('{size}', '800')
              imageContent = `<div style="text-align: center; margin: 10px 0;">
                <img src="${cleanImageUrl}" alt="${name || 'Area'}" style="max-width: 300px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onload="this.style.display='block'" onerror="this.style.display='none'">
              </div>`
            }
          }
        }

        // Info window for polygons with enhanced content
        if (name || description || imageContent) {
          const infoContent = `
            <div style="max-width: 320px;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${name || 'Area'}</h3>
              ${imageContent}
              ${description ? `<p style="margin: 8px 0 0 0; color: #666;">${description}</p>` : ''}
            </div>
          `
          polygonShape.addListener('click', (event) => {
            const infoWindow = new window.google.maps.InfoWindow({
              content: infoContent,
              position: event.latLng,
              maxWidth: 350,
            })
            infoWindow.open(map)
          })
        }
      }
    }

    console.log('✅ KML loaded successfully with', kmlMarkers.value.length, 'elements')

    // Center map on all KML elements if any exist
    if (allPoints.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      allPoints.forEach((point) => {
        bounds.extend(point)
      })
      map.fitBounds(bounds)
      console.log('🎯 Map centered on', allPoints.length, 'points from KML')
    }

    error.value = null
  } catch (err) {
    console.error('❌ Error loading KML:', err)
    error.value = `Error loading KML: ${err.message}`
  }
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
    console.log('🗺️ Initializing map with API key:', apiKey.value ? '✅ Present' : '❌ Missing')
    console.log('🗺️ Map ID:', props.mapId)
    console.log('🗺️ KML Path:', props.path)

    // Load Google Maps JS API with Places
    await loadGoogleMapsApi(apiKey.value)
    const google = window.google
    console.log('✅ Google Maps API loaded successfully')

    // Create map
    const mapElementContainer = document.getElementById('map-element')
    if (!mapElementContainer) {
      throw new Error('Map element container not found')
    }

    mapElementContainer.innerHTML = ''
    const mapDiv = document.createElement('div')
    mapDiv.style.width = '100%'
    mapDiv.style.height = props.height
    mapElementContainer.appendChild(mapDiv)

    console.log('🗺️ Creating Google Map...')
    const map = new google.maps.Map(mapDiv, {
      center: { lat: 37.94100018383558, lng: 27.34237557534141 },
      zoom: 15,
      mapId: props.mapId,
      mapTypeControl: false,
    })
    mapRef.value = map
    console.log('✅ Google Map created successfully')

    // Add right-click context menu for adding markers
    map.addListener('rightclick', (event) => {
      handleMapRightClick(event.latLng, map)
    })

    // Load initial KML data
    await loadKmlData(props.path, map)
    loading.value = false

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
    console.error('❌ Map initialization failed:', err)
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

// Watch for path changes and reload KML
watch(
  () => props.path,
  async (newPath, oldPath) => {
    if (newPath !== oldPath && mapRef.value) {
      console.log('🗺️ Path changed from', oldPath, 'to', newPath)
      loading.value = true
      await loadKmlData(newPath, mapRef.value)
      loading.value = false
    }
  },
)
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
  min-height: 400px;
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
