// Manual template creation with exact structure match
async function addSubscriptionTemplate() {
  // Create template with exact same structure as existing ones
  const template = {
    name: 'Auto-Graph Subscription',
    nodes: JSON.stringify([{
      id: "auto_subscription_node", 
      label: "Subscribe to All Graph Updates",
      color: "#6c757d",
      type: "subscription", 
      info: JSON.stringify({
        auto_subscribe_to_graph: true,
        allow_user_choice: false,
        title: "Get All Updates from This Graph",
        description: "Subscribe to receive notifications about all new content added to this knowledge graph. You'll automatically be subscribed to all areas and categories."
      }),
      bibl: [],
      imageWidth: "100%", 
      imageHeight: "100%",
      visible: true,
      path: null
    }]),
    edges: "[]",
    category: "subscription"
  }

  try {
    console.log('🚀 Adding Auto-Graph Subscription Template...')
    console.log('Template:', template)
    
    const response = await fetch('https://knowledge.vegvisr.org/addTemplate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(template)
    })

    const responseText = await response.text()
    console.log('Response status:', response.status)
    console.log('Response:', responseText)

    if (response.ok) {
      console.log('✅ Template added successfully!')
    } else {
      console.log('❌ Failed to add template')
      console.log('\n📋 Manual SQL for database:')
      console.log(`INSERT INTO graphTemplates (name, nodes, edges, category) VALUES (`)
      console.log(`  '${template.name}',`)
      console.log(`  '${template.nodes}',`)
      console.log(`  '${template.edges}',`)
      console.log(`  '${template.category}'`)
      console.log(`);`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

addSubscriptionTemplate()
