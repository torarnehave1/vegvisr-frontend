// Simplified script to add subscription template
// Check what parameters the API actually expects

async function checkTemplateAPI() {
  // First, let's see what the current templates look like
  try {
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates')
    const data = await response.json()

    console.log('🔍 Current template structure:')
    if (data.results && data.results.length > 0) {
      const sample = data.results[0]
      console.log('Sample template keys:', Object.keys(sample))
      console.log('Sample template:', sample)
    }
  } catch (err) {
    console.error('Error fetching templates:', err)
  }

  // Try a simpler template structure
  const simpleTemplate = {
    name: 'Auto-Graph Subscription Node',
    nodes: '[{"id":"subscription-auto-node","label":"Subscribe to Graph Updates","color":"#6c757d","type":"subscription","info":"{\\"auto_subscribe_to_graph\\":true,\\"allow_user_choice\\":false,\\"title\\":\\"Get All Updates\\",\\"description\\":\\"Subscribe to all content in this graph\\"}","bibl":[],"imageWidth":"100%","imageHeight":"100%","visible":true,"path":null}]'
  }

  try {
    console.log('\n🚀 Trying simple template structure...')
    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simpleTemplate)
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Success! Template added:', result)
    } else {
      const errorText = await response.text()
      console.error('❌ Failed:', response.status, errorText)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkTemplateAPI()
