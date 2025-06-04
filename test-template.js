// Test script to fetch PortfolioImage template
async function fetchPortfolioImageTemplate() {
  try {
    // Fetch all templates with CORS headers
    const response = await fetch('https://knowledge.vegvisr.org/getTemplates', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Origin: window.location.origin,
      },
      mode: 'cors',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const templates = await response.json()
    console.log('All templates:', templates) // Debug log to see all templates

    // Find the PortfolioImage template
    const portfolioTemplate = templates.find((template) => template.name === 'PortfolioImage')

    if (!portfolioTemplate) {
      console.log(
        'PortfolioImage template not found. Available templates:',
        templates.map((t) => t.name).join(', '),
      )
      return
    }

    // Display the template data
    console.log('Template ID:', portfolioTemplate.id)
    console.log('Template Name:', portfolioTemplate.name)
    console.log('\nNodes:')
    console.log(JSON.stringify(portfolioTemplate.nodes, null, 2))
    console.log('\nEdges:')
    console.log(JSON.stringify(portfolioTemplate.edges, null, 2))
  } catch (error) {
    console.error('Error fetching template:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
  }
}

// Run the test
fetchPortfolioImageTemplate()
