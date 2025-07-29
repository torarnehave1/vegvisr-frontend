// Script to add FLEXBOX-GRID Template to Vegvisr Database
// This creates a working grid template that can be inserted from the templates sidebar

async function addFlexboxGridTemplate() {
  const templateData = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'FLEXBOX-GRID Template',
    nodes: JSON.stringify([
      {
        id: 'flexbox-grid-001',
        label: 'Image Grid Layout (3x2)',
        color: '#e8f5e8',
        type: 'fulltext',
        info: '[FLEXBOX-GRID]\n![Grid Image 1|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=1)\n![Grid Image 2|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=2)\n![Grid Image 3|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=3)\n![Grid Image 4|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=4)\n![Grid Image 5|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=5)\n![Grid Image 6|width: 200px; height: 150px; object-fit: cover; border-radius: 8px](https://picsum.photos/200/150?random=6)\n[END FLEXBOX]',
        bibl: [
          'Template: FLEXBOX-GRID Layout',
          'Use: Image galleries and portfolios',
          'Format: 3-column grid, 2 rows',
        ],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null,
      },
    ]),
    edges: JSON.stringify([]),
    category: 'Layout Templates',
  }

  try {
    console.log('Adding FLEXBOX-GRID template to database...')
    console.log('Template data:', templateData)

    // Check if we have a createTemplate endpoint
    const response = await fetch('https://knowledge.vegvisr.org/createTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(templateData),
    })

    if (!response.ok) {
      // If createTemplate doesn't exist, try a different approach
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('Template created successfully:', result)

    // Verify the template was added
    const verifyResponse = await fetch('https://knowledge.vegvisr.org/getTemplates')
    const templates = await verifyResponse.json()
    const addedTemplate = templates.results.find((t) => t.name === 'FLEXBOX-GRID Template')

    if (addedTemplate) {
      console.log('Verification successful: Template found in database')
      console.log('Template ID:', addedTemplate.id)
    } else {
      console.log('Verification failed: Template not found in database')
    }
  } catch (error) {
    console.error('Error adding template:', error)

    // Alternative: Try direct SQL insertion (if endpoint supports it)
    console.log('Trying alternative SQL approach...')

    const sqlQuery = `
      INSERT INTO GraphTemplate (id, name, nodes, edges, category)
      VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'FLEXBOX-GRID Template',
        '${templateData.nodes}',
        '${templateData.edges}',
        'Layout Templates'
      );
    `

    console.log('SQL Query to execute:')
    console.log(sqlQuery)

    // Log template data for manual insertion
    console.log('\nManual template data for database insertion:')
    console.log('ID:', templateData.id)
    console.log('Name:', templateData.name)
    console.log('Nodes:', templateData.nodes)
    console.log('Edges:', templateData.edges)
    console.log('Category:', templateData.category)
  }
}

// Run the script
addFlexboxGridTemplate()

// Export for use in other scripts
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // eslint-disable-next-line no-undef
  module.exports = { addFlexboxGridTemplate }
}
