// Test cases for expand description
const testCases = [
  {
    description: 'Add dark mode support to the application',
    labels: ['enhancement', 'feature'],
  },
  {
    description: 'Fix login page not working on mobile devices',
    labels: ['bug', 'priority'],
  },
  {
    description: 'Update documentation for API endpoints',
    labels: ['documentation'],
  },
]

async function testExpandDescription() {
  for (const test of testCases) {
    console.log('\nTesting with description:', test.description)
    console.log('Labels:', test.labels)

    try {
      const response = await fetch('https://api.vegvisr.org/grok-issue-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: test.description,
          labels: test.labels,
          mode: 'expand_description',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error:', error)
        continue
      }

      const result = await response.json()
      console.log('\nExpanded description:')
      console.log(result.description)
      console.log('\n' + '-'.repeat(80))
    } catch (error) {
      console.error('Failed to test:', error)
    }
  }
}

testExpandDescription()
