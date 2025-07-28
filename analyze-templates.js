// Quick test to analyze existing graphTemplates structure
fetch('https://knowledge.vegvisr.org/getTemplates')
  .then(response => response.json())
  .then(data => {
    console.log('🔍 GraphTemplates Analysis:')
    console.log('Total templates:', data.results ? data.results.length : data.length)
    
    // Get first few templates to analyze structure
    const templates = data.results || data
    const samples = templates.slice(0, 5)
    
    console.log('\n📊 Sample Templates:')
    samples.forEach((template, index) => {
      console.log(`\n--- Template ${index + 1}: ${template.name} ---`)
      console.log('ID:', template.id)
      console.log('Category:', template.category)
      console.log('Nodes structure:')
      
      try {
        const nodes = JSON.parse(template.nodes)
        console.log('  Number of nodes:', nodes.length)
        if (nodes[0]) {
          console.log('  First node type:', nodes[0].type)
          console.log('  First node id:', nodes[0].id)
          console.log('  Info field type:', typeof nodes[0].info)
          if (typeof nodes[0].info === 'string' && nodes[0].info.startsWith('{')) {
            console.log('  Info contains JSON string ✓')
          } else {
            console.log('  Info contains plain text ✓')
          }
        }
      } catch (e) {
        console.log('  Error parsing nodes:', e.message)
      }
    })
    
    // Find menu creator specifically
    const menuCreator = templates.find(t => t.name && t.name.includes('Menu'))
    if (menuCreator) {
      console.log('\n🍔 Menu Creator Template Found:')
      console.log('Name:', menuCreator.name)
      const nodes = JSON.parse(menuCreator.nodes)
      console.log('Node info field:', nodes[0].info)
    }
  })
  .catch(error => console.error('❌ Error:', error))
