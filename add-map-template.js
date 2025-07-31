// Script to add Map Template to D1 Database
// This creates a template in the graphTemplates table for map nodes

async function addMapTemplateToDatabase() {
  const mapTemplate = {
    id: `map-template-${Date.now()}`,
    name: 'Map Node Template',
    category: 'Visual Elements',
    nodes: JSON.stringify([
      {
        id: 'map_node_sample',
        label: 'Interactive Map',
        type: 'map',
        color: '#e8f5e9',
        info: 'This map displays geographic information with KML overlays. Click and explore the interactive features.',
        bibl: [
          'Template: Map Node',
          'Use: Geographic visualization',
          'Format: KML overlay support',
        ],
        imageWidth: '100%',
        imageHeight: '400px',
        visible: true,
        path: 'https://klm.vegvisr.org/Vegvisr.org.kml', // Default sample KML
        mapId: 'efe3a8a8c093a07cf97c4b3c', // Google Maps style ID
        position: { x: 100, y: 100 },
      },
    ]),
    edges: JSON.stringify([]), // No edges for single node template
    ai_instructions: JSON.stringify({
      purpose: 'Geographic visualization and mapping',
      usage: 'Use for displaying locations, routes, or geographic data',
      features: [
        'Interactive Google Maps integration',
        'KML file overlay support',
        'Right-click to add markers',
        'File upload for custom KML files',
        'Responsive map container',
      ],
      configuration: {
        path: 'URL to KML file for overlays',
        mapId: 'Google Maps style ID',
        imageWidth: 'Container width (100%, 800px, etc.)',
        imageHeight: 'Container height (400px, 50vh, etc.)',
      },
    }),
  }

  try {
    console.log('Adding Map Template to database...')
    console.log('Template data:', mapTemplate)

    // For manual database insertion, here's the SQL:
    const sqlQuery = `
      INSERT INTO graphTemplates (
        id,
        name,
        nodes,
        edges,
        category,
        ai_instructions
      )
      VALUES (
        '${mapTemplate.id}',
        '${mapTemplate.name}',
        '${mapTemplate.nodes}',
        '${mapTemplate.edges}',
        '${mapTemplate.category}',
        '${mapTemplate.ai_instructions}'
      );
    `

    console.log('SQL Query to execute:')
    console.log(sqlQuery)

    // If we have an endpoint to create templates:
    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: mapTemplate.name,
        node: JSON.parse(mapTemplate.nodes)[0], // Single node template
        category: mapTemplate.category,
        ai_instructions: JSON.parse(mapTemplate.ai_instructions),
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Map template added successfully to database:', result)
    } else {
      console.log('❌ API endpoint not available, use manual SQL insertion')
      console.log('\nManual template data for database insertion:')
      console.log('ID:', mapTemplate.id)
      console.log('Name:', mapTemplate.name)
      console.log('Category:', mapTemplate.category)
      console.log('Nodes:', mapTemplate.nodes)
      console.log('Edges:', mapTemplate.edges)
      console.log('AI Instructions:', mapTemplate.ai_instructions)
    }
  } catch (error) {
    console.error('Error adding template:', error)
    console.log('\n📋 Manual Database Insertion Required:')
    console.log('Table: graphTemplates')
    console.log('Data:', mapTemplate)
  }
}

// Run the function
addMapTemplateToDatabase()

// Export for potential use
export { addMapTemplateToDatabase }
