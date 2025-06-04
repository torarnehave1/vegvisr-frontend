// Node.js script to fetch PortfolioImage template and insert into KnowledgeGraph
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'

async function insertPortfolioImage(graphId) {
  try {
    // First fetch the current graph
    const graphResponse = await fetch(`https://knowledge.vegvisr.org/getknowgraph?id=${graphId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!graphResponse.ok) {
      throw new Error(`Failed to fetch graph: ${graphResponse.status}`)
    }

    const graphData = await graphResponse.json()

    // Create the new portfolio image node
    const portfolioNode = {
      id: uuidv4(),
      label: 'My Portfolio Image',
      color: 'white',
      type: 'portfolio-image',
      info: null,
      bibl: [],
      imageWidth: '100%',
      imageHeight: '100%',
      visible: true,
      path: 'https://vegvisr.imgix.net/tilopa01.jpg',
    }

    // Add the new node to the graph
    graphData.nodes.push(portfolioNode)

    // Update the graph with the new node
    const updateResponse = await fetch('https://knowledge.vegvisr.org/updateknowgraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: graphId,
        graphData: graphData,
      }),
    })

    if (!updateResponse.ok) {
      throw new Error(`Failed to update graph: ${updateResponse.status}`)
    }

    console.log('Successfully inserted portfolio image node into graph:', graphId)
    console.log('New node ID:', portfolioNode.id)
  } catch (error) {
    console.error('Error inserting portfolio image:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
  }
}

// Example usage:
// Replace 'your-graph-id' with the actual graph ID
insertPortfolioImage('your-graph-id')
