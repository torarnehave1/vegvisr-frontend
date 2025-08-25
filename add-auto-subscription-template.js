// Script to add Auto-Graph Subscription Template to D1 Database
// This creates a template in the graphTemplates table with auto-graph subscription enabled

async function addAutoSubscriptionTemplate() {
  const template = {
    id: `subscription_auto_graph_${Date.now()}`,
    name: 'Auto-Graph Subscription Node',
    category: 'subscription',
    nodes: JSON.stringify([
      {
        id: 'subscription-auto-node',
        label: 'Subscribe to Graph Updates',
        color: '#6c757d',
        type: 'subscription',
        info: JSON.stringify({
          auto_subscribe_to_graph: true,
          allow_user_choice: false,
          title: 'Get All Updates from This Graph',
          description: 'Subscribe to receive notifications about all new content added to this knowledge graph. No need to choose specific areas - you\'ll get everything!'
        }),
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null
      }
    ]),
    edges: JSON.stringify([]),
    ai_instructions: 'Create a subscription node that automatically subscribes users to all meta areas and categories present in the current knowledge graph'
  }

  try {
    console.log('🚀 Adding Auto-Graph Subscription Template...')
    console.log('Template data:', template)

    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(template)
    })

    if (response.ok) {
      const result = await response.json()
      console.log('✅ Auto-Graph Subscription Template added successfully!')
      console.log('Result:', result)
      console.log('\n📋 Template Details:')
      console.log('- Name:', template.name)
      console.log('- ID:', template.id)
      console.log('- Type: subscription with auto_subscribe_to_graph: true')
      console.log('- This template will show a simplified interface')
      console.log('- Users will be subscribed to all areas in the current graph')
    } else {
      const errorText = await response.text()
      console.error('❌ Failed to add template:', response.status, errorText)
      
      console.log('\n📋 Manual Database Insertion Required:')
      console.log('Table: graphTemplates')
      console.log('SQL:')
      console.log(`INSERT INTO graphTemplates (id, name, category, nodes, edges, ai_instructions) VALUES (
        '${template.id}',
        '${template.name}',
        '${template.category}',
        '${template.nodes}',
        '${template.edges}',
        '${template.ai_instructions}'
      );`)
    }
  } catch (error) {
    console.error('❌ Error adding template:', error)
    console.log('\n📋 Manual Database Insertion Required:')
    console.log('Table: graphTemplates')
    console.log('Data:', template)
  }
}

// Also create a traditional subscription template for comparison
async function addTraditionalSubscriptionTemplate() {
  const template = {
    id: `subscription_traditional_${Date.now()}`,
    name: 'Traditional Subscription Node',
    category: 'subscription', 
    nodes: JSON.stringify([
      {
        id: 'subscription-traditional-node',
        label: 'Subscribe to Updates',
        color: '#6c757d',
        type: 'subscription',
        info: JSON.stringify({
          auto_subscribe_to_graph: false,
          allow_user_choice: true,
          title: 'Subscribe to Specific Updates',
          description: 'Choose exactly what you want to subscribe to - categories or meta areas.'
        }),
        bibl: [],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        path: null
      }
    ]),
    edges: JSON.stringify([]),
    ai_instructions: 'Create a subscription node with traditional category/meta area selection interface'
  }

  try {
    console.log('\n🚀 Adding Traditional Subscription Template...')
    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(template)
    })

    if (response.ok) {
      console.log('✅ Traditional Subscription Template added successfully!')
    } else {
      console.error('❌ Failed to add traditional template')
    }
  } catch (error) {
    console.error('❌ Error adding traditional template:', error)
  }
}

// Run both functions
async function addBothTemplates() {
  await addAutoSubscriptionTemplate()
  await addTraditionalSubscriptionTemplate()
  
  console.log('\n🎉 Done! You now have two subscription template options:')
  console.log('1. Auto-Graph Subscription Node - Simplified, subscribes to everything in the graph')
  console.log('2. Traditional Subscription Node - Manual selection of categories/meta areas')
}

// Run the functions
addBothTemplates()

// Export for potential use
export { addAutoSubscriptionTemplate, addTraditionalSubscriptionTemplate }
