// Quick test to verify KML accessibility and structure
// Run this in browser console on your production site

async function testGlunkaKML() {
  const kmlUrl = 'https://klm.vegvisr.org/Glunka%20(1).kml'

  console.log('🧪 Testing Glunka KML access...')

  try {
    // Test 1: Fetch the KML
    console.log('📡 Fetching KML from:', kmlUrl)
    const response = await fetch(kmlUrl)

    if (!response.ok) {
      console.error('❌ KML fetch failed:', response.status, response.statusText)
      return
    }

    console.log('✅ KML fetched successfully')

    // Test 2: Parse the XML
    const kmlText = await response.text()
    console.log('📄 KML size:', kmlText.length, 'characters')

    const parser = new DOMParser()
    const kmlDoc = parser.parseFromString(kmlText, 'application/xml')

    // Test 3: Check for parse errors
    const parseError = kmlDoc.querySelector('parsererror')
    if (parseError) {
      console.error('❌ XML parsing error:', parseError.textContent)
      return
    }

    console.log('✅ KML parsed successfully')

    // Test 4: Find placemarks
    const placemarks = kmlDoc.getElementsByTagName('Placemark')
    console.log('📍 Found', placemarks.length, 'placemarks')

    // Test 5: Look for "Start og Slutt" specifically
    let targetPlacemark = null
    for (let i = 0; i < placemarks.length; i++) {
      const name = placemarks[i].getElementsByTagName('name')[0]?.textContent
      console.log(`🏷️ Placemark ${i + 1}:`, name)

      if (name === 'Start og Slutt') {
        targetPlacemark = placemarks[i]
        console.log('🎯 Found target placemark: Start og Slutt')
        break
      }
    }

    // Test 6: Check for images in target placemark
    if (targetPlacemark) {
      const carousel = targetPlacemark.getElementsByTagName('gx:Carousel')[0] ||
                      targetPlacemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]

      console.log('📦 Target placemark has carousel:', !!carousel)

      if (carousel) {
        const gxImage = carousel.getElementsByTagName('gx:Image')[0] ||
                       carousel.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Image')[0]

        console.log('🖼️ Carousel has gx:Image:', !!gxImage)

        if (gxImage) {
          const imageUrl = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent ||
                          gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent

          console.log('🔗 Image URL found:', !!imageUrl)
          if (imageUrl) {
            console.log('📸 Image URL:', imageUrl.substring(0, 100) + '...')

            // Test 7: Try to load the image
            const img = new Image()
            img.onload = () => console.log('✅ Image loads successfully')
            img.onerror = () => console.log('❌ Image failed to load')
            img.src = imageUrl.replace('{size}', '800')
          }
        }
      }
    } else {
      console.log('❌ "Start og Slutt" placemark not found')
    }

  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

// Run the test
testGlunkaKML()

console.log(`
🧪 KML TEST INSTRUCTIONS:
1. Copy and paste this entire script into your browser console
2. Press Enter to run the test
3. Watch the console output to identify any issues
4. The test will tell you exactly where the problem is

Expected success indicators:
✅ KML fetched successfully
✅ KML parsed successfully
📍 Found [number] placemarks
🎯 Found target placemark: Start og Slutt
📦 Target placemark has carousel: true
🖼️ Carousel has gx:Image: true
🔗 Image URL found: true
✅ Image loads successfully
`)
