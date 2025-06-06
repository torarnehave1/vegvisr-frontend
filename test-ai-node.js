const testAINodeGeneration = async () => {
  try {
    const response = await fetch('https://api.vegvisr.org/ai-generate-node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userRequest: "Create a worknote about the Vegvísir symbol's historical significance",
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Error:', error)
      return
    }

    const data = await response.json()
    console.log('Generated Node:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

testAINodeGeneration()
