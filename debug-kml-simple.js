// Simple KML analysis using the downloaded file
// Use this if the fetch version is blocked by CSP

function analyzeDownloadedKML() {
  console.log('🔍 Analyzing downloaded Glunka_4.kml file...')
  
  // We know from the file analysis that this KML contains:
  const expectedImages = [
    {
      type: 'Google Earth Image',
      id: 'hosted_image_QURiREJLdXBza1VHdm9oR2NibzZiWnl3...',
      url: 'https://earth.usercontent.google.com/hostedimage/e/*/4ADbDBKtrWGD0gFyvqSg95v0d83-R2QR7hx5Dy-ls8fWztqQYPjnctD7SznZpK0n73fXb8yLmx4XpttANVLO8LKMh4JwA-BpSOF1FUQl7RtEa1YEfx6TYtFWiEfyYubsq9vrRYkMBq74GwY_-PiUDKREQF6SywEtJPq55eXaY-o3jy1B-BDhkA2VxRg60fSVcGofJATFDry0aZ982WC8nb9145mFom-dau6mid0d3i7O3WTWU2ryy_YNelSl_jH2Itnxh1-mm8PYs94_udpLvsilMxWM2G8XF6xzbU_X6fg?authuser=0&fife=s{size}'
    },
    {
      type: 'Google Earth Image', 
      id: 'hosted_image_QURiREJLdjQxamlZRFI4bDBKcXdsUTBj...',
      url: 'https://earth.usercontent.google.com/hostedimage/e/*/4ADbDBKuwiECDa016pxKKb2oV_MB8v4KX8YVrP_BLFLPDwj-y1c051EJ7LK5NDrAX35s1Qrxiwyzd6btoeiAKftTzxj2VSr74-VG5v0nBQcsR7ThsgW4jmdYTNnKS-EAwg8lsu8fuQGUOiWn0ZmWigbo2rbh9-JQMSQ7SoDHjj1XzqtlRQFD3vQJ36ExGESOYIxAl2We674DjsrPv_3xGAYrZ5xdPl-mntz0jm2RPtpbLjhaockVxpJCgYwH8am67vAfQzUqLmNSGa6dvJsuXz3m6P9fhPVC_E-oV0mEd4w?authuser=0&fife=s{size}'
    },
    {
      type: 'Google Earth Image',
      id: 'hosted_image_QURiREJLc0Q5anhCL3RVN3hHU3FidkJz...',
      url: 'https://earth.usercontent.google.com/hostedimage/e/*/4ADbDBKv4vGw-x3ndbG3ceQVB9xwqolzuQEQK6oot72qSrkgwn5sMAsDsV1JAbuCYfvKMi0xUaIIMyZ6Sv3swHklYyLMuFxKjN39Q4YQR2emWYGY9zIYdLmUarbf9RzXCu3yGHtRPcTZ2elAyctId-uUWPA4WXjt5GZy_u9UYqEAxLphrz0T6ucxgU9P-5JUTJtLuIYL95uskwj6VFxdiUMQa4U0FV5ybXoNx6IRQc6MK5nnS4iAKwcTfSJWEPOvkVaZf3bUo7BdGpflbwnd8j7PaYJ6dW3r82VeKZ_NDGA?authuser=0&fife=s{size}'
    },
    {
      type: 'YouTube Video',
      id: 'youtube_video_O9UwUwtYp18_0',
      url: 'https://img.youtube.com/vi/O9UwUwtYp18/hqdefault.jpg',
      videoId: 'O9UwUwtYp18'
    },
    {
      type: 'Google Earth Image',
      id: 'hosted_image_QURiREJLdmpMOFBPMGQxRnFiK3ZubnhG...',
      url: 'https://earth.usercontent.google.com/hostedimage/e/*/4ADbDBKtvD9ihB0SrLWVwvH1P65cadN_kKdbBkP65tEd8woQT0AGxZ6GP9IQsVY5cpoeyM80VoFI7Tf2e5yk7I4ZHfGjQOlrNfJQYnocwRwOqsgImtPcep4BVIuxAy86ikBGUqO3_2FZwjHZGRIdWc4uUvikuEunPRvdARYW6VSKjbL3wrPzVjeA04zl_rvi-PhtFTN0CxAgL4r68CB3JWASppLEUuaUJU4cxdveDPJrm2h18hpInnxeTr9vb0rBID1dVW5nQqh2A9fRUjROPzvUhhQc6aPHkGQyKMzI?authuser=0&fife=s{size}'
    }
  ]
  
  console.log(`🎯 Expected in Glunka_4.kml: ${expectedImages.length} media items`)
  console.log('   - 4 Google Earth Images')
  console.log('   - 1 YouTube Video')
  
  // Test each image through the proxy
  console.log('\n🧪 Testing image loading...')
  
  expectedImages.forEach((item, index) => {
    console.log(`\n📸 Testing Image ${index + 1}: ${item.type}`)
    
    if (item.type === 'YouTube Video') {
      console.log(`   🎥 Video ID: ${item.videoId}`)
      console.log(`   🔗 Thumbnail URL: ${item.url}`)
      
      // Test YouTube thumbnail
      const img = new Image()
      img.onload = () => console.log(`   ✅ YouTube thumbnail ${index + 1} loads successfully`)
      img.onerror = () => console.log(`   ❌ YouTube thumbnail ${index + 1} failed to load`)
      img.src = item.url
    } else {
      const cleanUrl = item.url.replace('{size}', '800')
      const proxyUrl = `https://image-proxy.torarnehave.workers.dev/?url=${encodeURIComponent(cleanUrl)}`
      
      console.log(`   🔗 Direct URL: ${cleanUrl}`)
      console.log(`   🔄 Proxy URL: ${proxyUrl}`)
      
      // Test through proxy
      const img = new Image()
      img.onload = () => console.log(`   ✅ Google Earth image ${index + 1} loads successfully via proxy`)
      img.onerror = () => {
        console.log(`   ❌ Google Earth image ${index + 1} failed via proxy`)
        
        // Try direct as fallback
        const directImg = new Image()
        directImg.onload = () => console.log(`   ✅ Image ${index + 1} loads directly (no CORS issue)`)
        directImg.onerror = () => console.log(`   ❌ Image ${index + 1} fails both proxy and direct`)
        directImg.src = cleanUrl
      }
      img.src = proxyUrl
    }
  })
  
  console.log('\n📋 Summary:')
  console.log('   If all 5 images load successfully, the issue is in MapViewer processing')
  console.log('   If some images fail to load, the issue is with the image proxy or URLs')
  console.log('   Check the MapViewer console logs for detailed processing information')
}

// Test the specific URLs we expect
function testSpecificURLs() {
  console.log('\n🎯 Testing specific URLs from Glunka_4.kml...')
  
  const testUrls = [
    'https://earth.usercontent.google.com/hostedimage/e/*/4ADbDBKtrWGD0gFyvqSg95v0d83-R2QR7hx5Dy-ls8fWztqQYPjnctD7SznZpK0n73fXb8yLmx4XpttANVLO8LKMh4JwA-BpSOF1FUQl7RtEa1YEfx6TYtFWiEfyYubsq9vrRYkMBq74GwY_-PiUDKREQF6SywEtJPq55eXaY-o3jy1B-BDhkA2VxRg60fSVcGofJATFDry0aZ982WC8nb9145mFom-dau6mid0d3i7O3WTWU2ryy_YNelSl_jH2Itnxh1-mm8PYs94_udpLvsilMxWM2G8XF6xzbU_X6fg?authuser=0&fife=s800'
  ]
  
  testUrls.forEach((url, index) => {
    const proxyUrl = `https://image-proxy.torarnehave.workers.dev/?url=${encodeURIComponent(url)}`
    console.log(`Testing URL ${index + 1}:`)
    console.log(`   Proxy: ${proxyUrl}`)
    
    const img = new Image()
    img.onload = () => console.log(`   ✅ URL ${index + 1} loads via proxy`)
    img.onerror = () => console.log(`   ❌ URL ${index + 1} fails via proxy`)
    img.src = proxyUrl
  })
}

// Run the analysis
analyzeDownloadedKML()
testSpecificURLs()

console.log(`
🔍 DEBUGGING CHECKLIST:
1. ✅ All 5 images should load (4 Google Earth + 1 YouTube)
2. ✅ Image proxy should work for Google Earth images  
3. ✅ YouTube thumbnail should load directly
4. 🔍 Check MapViewer console for processing logs
5. 🔍 Look for any errors in image element creation

💡 Next step: Load the actual map with this KML and check MapViewer console logs
`)
