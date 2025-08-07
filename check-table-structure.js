// Check graphTemplates table structure
import https from 'https'

const checkTableStructure = () => {
  const postData = JSON.stringify({
    sql: 'PRAGMA table_info(graphTemplates);',
  })

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

  const req = https.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
      try {
        const result = JSON.parse(data)
        console.log('📋 GraphTemplates Table Structure:')
        if (result.results) {
          result.results.forEach((col) => {
            console.log(
              `  ${col.name}: ${col.type} ${col.notnull ? '(NOT NULL)' : ''} ${col.pk ? '(PRIMARY KEY)' : ''}`,
            )
          })
        }
      } catch (error) {
        console.error('Error parsing response:', error)
      }
    })
  })

  req.on('error', (error) => {
    console.error('Request error:', error)
  })

  req.write(postData)
  req.end()
}

checkTableStructure()
