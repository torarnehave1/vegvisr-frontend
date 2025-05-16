<template>
  <div class="map-test-container">
    <div class="overlay" v-if="loading || error">
      <div v-if="loading" class="loading">Loading map...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
    <!-- Search Box using PlaceAutocompleteElement -->
    <gmp-place-autocomplete
      ref="searchBoxRef"
      class="search-box"
      placeholder="Search for a place"
    ></gmp-place-autocomplete>
    <div ref="mapRef" class="map" style="width: 100%; height: 600px"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Loader } from '@googlemaps/js-api-loader'

// Define props
defineProps({
  path: { type: String, required: true },
})

defineEmits(['gmp-place-changed'])

const mapRef = ref(null)
const searchBoxRef = ref(null)
const loading = ref(true)
const error = ref(null)

// Variables to store map and kmlLayer for use in listeners
let map = null
let kmlLayer = null

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

    map = new google.maps.Map(mapRef.value, {
      center: { lat: 37.94100018383558, lng: 27.34237557534141 },
      zoom: 15,
    })

    kmlLayer = new google.maps.KmlLayer({
      url: props.path,
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

    // Configure PlaceAutocompleteElement
    const autocomplete = searchBoxRef.value
    console.log('Autocomplete element initialized:', autocomplete)

    // Ensure autocomplete is properly initialized
    if (!autocomplete) {
      throw new Error('Autocomplete element not found')
    }

    // Attach the correct event listener for gmp-place-autocomplete
    autocomplete.addEventListener('place_changed', () => {
      console.log('place_changed event triggered')
      handlePlaceChanged()
    })

    // Bias the autocomplete results towards the map's current viewport
    map.addListener('bounds_changed', () => {
      if (autocomplete) {
        autocomplete.bounds = map.getBounds()
      }
    })

    // Handle place_changed event
    const handlePlaceChanged = async () => {
      console.log('place_changed event fired')
      const place = autocomplete.getPlace()

      if (!place || !place.geometry || !place.geometry.location) {
        console.log('Fetching place details...')
        const placeId = place?.place_id
        if (!placeId) {
          error.value = 'No place selected or place ID unavailable'
          return
        }

        // Fetch place details using PlacesService
        const fetchedPlace = await new Promise((resolve, reject) => {
          const request = { placeId, fields: ['geometry', 'name'] }
          const service = new google.maps.places.PlacesService(map)
          service.getDetails(request, (result, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
              resolve(result)
            } else {
              reject(`Failed to fetch place details: ${status}`)
            }
          })
        }).catch((err) => {
          console.error(err)
          error.value = err
          return null
        })

        if (!fetchedPlace || !fetchedPlace.geometry || !fetchedPlace.geometry.location) {
          error.value = 'Selected place contains no geometry'
          return
        }

        // Update place with fetched details
        place.geometry = fetchedPlace.geometry
        place.name = fetchedPlace.name
      }

      console.log('Selected place:', place)

      // Alert the selected place's name
      alert(`You selected: ${place.name || 'Unknown Place'}`)

      // Center the map on the selected place
      map.setCenter(place.geometry.location)
      map.setZoom(15)

      // Optionally, add a marker at the selected place
      new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name,
      })

      // Adjust map bounds if a viewport is available
      const bounds = new google.maps.LatLngBounds()
      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport)
      } else {
        bounds.extend(place.geometry.location)
      }
      map.fitBounds(bounds)
    }

    // Add keydown listener to handle Enter key
    searchBoxRef.value.addEventListener('keydown', (event) => {
      console.log('Keydown event:', event.key)
      if (event.key === 'Enter') {
        event.preventDefault() // Prevent default form submission behavior
        event.stopPropagation() // Prevent event bubbling
        console.log('Enter key pressed')
        handlePlaceChanged() // Trigger the place_changed logic
      }
    })
  } catch (err) {
    error.value = `Error loading map: ${err.message}`
    console.error(err)
    loading.value = false
  }
})

// Define infoWindow and click listener at the top level
const infoWindow = ref(null)

onMounted(() => {
  if (map) {
    infoWindow.value = new google.maps.InfoWindow({
      maxWidth: 300,
    })

    if (kmlLayer) {
      kmlLayer.addListener('click', (kmlEvent) => {
        const placeName = kmlEvent.featureData.name
        const content = `
          <div class="custom-info-window">
            <h3>${placeName}</h3>
            <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.parentElement.parentElement.style.display='none';">×</button>
          </div>
        `
        infoWindow.value.setContent(content)
        infoWindow.value.setPosition(kmlEvent.latLng)
        infoWindow.value.open(map)
      })
    }
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

.search-box {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  width: 300px;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
</style>
