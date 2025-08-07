// Wrangler-style script to check table structure and insert slideshow template
const fs = require('fs')

// Check table structure first
const checkTableStructure = () => {
  console.log('📋 Checking graphTemplates table structure...')

  const postData = JSON.stringify({
    sql: 'PRAGMA table_info(graphTemplates);',
  })

  const https = require('https')
  const options = {
    hostname: 'knowledge.vegvisr.org',
    port: 443,
    path: '/executeSQL',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log('Table structure:')
          if (result.results) {
            result.results.forEach((col) => {
              console.log(`  ${col.name}: ${col.type}`)
            })
          }
          resolve(result)
        } catch (error) {
          console.error('Error parsing response:', error)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('Request error:', error)
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}

// Execute the slideshow template SQL
const executeSlideshowSQL = () => {
  console.log('📝 Inserting slideshow template...')

  const sql = `INSERT INTO graphTemplates (name, nodes, edges, category) VALUES (
    'SlideShow Node Template',
    '[{
        "id": "slideshow_default",
        "label": "New Slideshow",
        "color": "#e6f3ff",
        "type": "slideshow",
        "info": "# Slide 1: Welcome\\nThis is the first slide of your presentation.\\n\\n---\\n\\n# Slide 2: Main Content\\nAdd your main content here.\\n\\n- Point 1\\n- Point 2\\n- Point 3\\n\\n---\\n\\n# Slide 3: Conclusion\\nThank you for viewing this slideshow!",
        "bibl": ["Source: Created with Vegvisr Slideshow System"],
        "imageWidth": "auto",
        "imageHeight": "auto",
        "visible": true
    }]',
    '[]',
    'Presentation'
);`

  const postData = JSON.stringify({ sql })

  const https = require('https')
  const options = {
    hostname: 'knowledge.vegvisr.org',
    port: 443,
    path: '/executeSQL',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log('✅ Slideshow template inserted successfully!')
          console.log('Result:', result)
          resolve(result)
        } catch (error) {
          console.error('Error parsing response:', error)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('Request error:', error)
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}

// Main execution
const main = async () => {
  try {
    await checkTableStructure()
    console.log('\n' + '='.repeat(50) + '\n')
    await executeSlideshowSQL()
  } catch (error) {
    console.error('Error:', error)
  }
}

main()
