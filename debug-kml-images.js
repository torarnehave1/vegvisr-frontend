// Debug script to check KML image parsing
// Run this in browser console to debug the KML image issue

async function debugKMLImages() {
  const kmlUrl = 'https://klm.vegvisr.org/1756667918863_Glunka_4.kml'
  
  console.log('🧪 Debugging KML Images for Glunka_4.kml...')
  console.log(`📥 Fetching: ${kmlUrl}`)
  
  try {
    const response = await fetch(kmlUrl)
    const kmlText = await response.text()
    console.log(`📊 KML size: ${kmlText.length} characters`)
    
    const parser = new DOMParser()
    const kmlDoc = parser.parseFromString(kmlText, 'application/xml')
    
    // Check for parse errors
    const parseErrors = kmlDoc.getElementsByTagName('parsererror')
    if (parseErrors.length > 0) {
      console.error('❌ KML parse error:', parseErrors[0].textContent)
      return
    }
    
    console.log('✅ KML parsed successfully')
    
    const placemarks = kmlDoc.getElementsByTagName('Placemark')
    console.log(`📍 Total placemarks: ${placemarks.length}`)
    
    // Find the placemark with the carousel (should be the first one in this KML)
    for (let i = 0; i < placemarks.length; i++) {
      const placemark = placemarks[i]
      const name = placemark.getElementsByTagName('name')[0]?.textContent
      
      console.log(`🏷️ Placemark ${i + 1}: "${name}"`)
      
      const carousel = placemark.getElementsByTagName('gx:Carousel')[0] || 
                      placemark.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Carousel')[0]
      
      if (carousel) {
        console.log(`📦 ✅ Carousel found in "${name}"`)
        
        // Test both methods to get gx:Image elements
        const gxImages1 = carousel.getElementsByTagName('gx:Image')
        const gxImages2 = carousel.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Image')
        
        console.log(`🖼️ Method 1 (getElementsByTagName): ${gxImages1.length} images`)
        console.log(`🖼️ Method 2 (getElementsByTagNameNS): ${gxImages2.length} images`)
        
        // Combine both methods and remove duplicates
        const allImages = [...gxImages1, ...gxImages2]
        const uniqueImages = allImages.filter((img, index, arr) => 
          arr.findIndex(i => i.isSameNode(img)) === index
        )
        
        console.log(`🖼️ Total unique images: ${uniqueImages.length}`)
        console.log(`🎯 Expected: 5 images (4 Google Earth + 1 YouTube)`)
        
        if (uniqueImages.length !== 5) {
          console.warn(`⚠️ Expected 5 images but found ${uniqueImages.length}`)
        }
        
        for (let j = 0; j < uniqueImages.length; j++) {
          const gxImage = uniqueImages[j]
          const imageUrl1 = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent
          const imageUrl2 = gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent
          const imageUrl = imageUrl1 || imageUrl2
          
          console.log(`\n📸 Image ${j + 1}:`)
          
          if (imageUrl) {
            const cleanImageUrl = imageUrl.replace('{size}', '800')
            const isYouTube = cleanImageUrl.includes('youtube.com') || cleanImageUrl.includes('youtu.be') || cleanImageUrl.includes('ytimg')
            
            console.log(`   🔗 URL: ${cleanImageUrl}`)
            console.log(`   📷 Type: ${isYouTube ? 'YouTube Video' : 'Google Earth Image'}`)
            console.log(`   🔧 Method: ${imageUrl1 ? 'getElementsByTagName' : 'getElementsByTagNameNS'}`)
            
            if (isYouTube) {
              // Extract YouTube video ID
              const videoIdMatch = cleanImageUrl.match(/vi\/([^/]+)/)
              const videoId = videoIdMatch ? videoIdMatch[1] : 'Unknown'
              console.log(`   🎥 Video ID: ${videoId}`)
              
              // Test YouTube thumbnail loading
              const testImg = new Image()
              testImg.onload = () => console.log(`   ✅ YouTube thumbnail ${j + 1} loads successfully`)
              testImg.onerror = () => console.log(`   ❌ YouTube thumbnail ${j + 1} failed to load`)
              testImg.src = cleanImageUrl
            } else {
              // Test Google Earth image through proxy
              const proxyUrl = `https://image-proxy.torarnehave.workers.dev/?url=${encodeURIComponent(cleanImageUrl)}`
              console.log(`   🔄 Proxy: ${proxyUrl}`)
              
              const testImg = new Image()
              testImg.onload = () => console.log(`   ✅ Google Earth image ${j + 1} loads successfully via proxy`)
              testImg.onerror = () => console.log(`   ❌ Google Earth image ${j + 1} failed to load via proxy`)
              testImg.src = proxyUrl
            }
          } else {
            console.log(`   ❌ No imageUrl found`)
          }
        }
        
        // Test MapViewer processing logic
        console.log(`\n🧪 Testing MapViewer processing logic...`)
        const imageElements = []
        
        for (let k = 0; k < uniqueImages.length; k++) {
          const gxImage = uniqueImages[k]
          const imageUrl = gxImage.getElementsByTagName('gx:imageUrl')[0]?.textContent || 
                         gxImage.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'imageUrl')[0]?.textContent

          if (imageUrl) {
            const cleanImageUrl = imageUrl.replace('{size}', '800')
            
            if (cleanImageUrl.includes('youtube.com') || cleanImageUrl.includes('youtu.be') || cleanImageUrl.includes('ytimg')) {
              const videoIdMatch = cleanImageUrl.match(/vi\/([^/]+)/)
              if (videoIdMatch) {
                console.log(`   🎥 Would create YouTube element ${k + 1}`)
                imageElements.push('YouTube Video')
              }
            } else {
              console.log(`   📷 Would create Google Earth image element ${k + 1}`)
              imageElements.push('Google Earth Image')
            }
          }
        }
        
        console.log(`\n📊 MapViewer would create ${imageElements.length} elements:`)
        imageElements.forEach((element, index) => {
          console.log(`   ${index + 1}. ${element}`)
        })
        
        if (imageElements.length === 5) {
          console.log(`✅ SUCCESS: All 5 expected elements would be created!`)
        } else {
          console.log(`❌ PROBLEM: Expected 5 elements, would create ${imageElements.length}`)
        }
        
        return // Found the carousel, no need to check other placemarks
      }
    }
    
    console.log('❌ No carousel found in any placemark')
    
  } catch (error) {
    console.error('💥 Debug failed:', error)
  }
}

// Run the debug
debugKMLImages()

console.log(`
🧪 KML IMAGE DEBUG INSTRUCTIONS:
1. Open browser console
2. Paste this entire script
3. Press Enter to run
4. Check the console output to see:
   - How many images are detected
   - Which detection method works
   - If images load successfully
   - Any error messages

💡 If fetch is blocked by CSP, use the alternative method:
   - Load your actual map page with KML
   - Use the enhanced MapViewer console logging instead
`)
