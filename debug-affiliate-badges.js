// Debug script to check if affiliate badges should be showing
console.log('🔍 Debugging affiliate badge visibility...')

// Function to check current graphs in portfolio
function debugAffiliateBadges() {
  // Check if we're on the portfolio page
  if (!window.location.pathname.includes('portfolio')) {
    console.log('❌ Not on portfolio page. Navigate to portfolio first.')
    return
  }

  console.log('📊 Checking for graphs with affiliate metadata...')

  // Get all graph elements
  const graphElements = document.querySelectorAll('[data-graph-id]')
  console.log(`Found ${graphElements.length} graph elements on page`)

  // Check our test graphs specifically
  const testGraphs = ['graph_1744927233341', 'graph_1744994708985']

  testGraphs.forEach((graphId) => {
    console.log(`\\n🔍 Checking ${graphId}:`)

    // Find the element
    const element = document.querySelector(`[data-graph-id="${graphId}"]`)
    if (!element) {
      console.log(`   ❌ Graph element not found on page`)
      return
    }

    console.log(`   ✅ Graph element found`)

    // Check for affiliate badge
    const affiliateBadge = element.querySelector('.badge.bg-affiliate')
    if (affiliateBadge) {
      console.log(`   🎉 AFFILIATE BADGE FOUND: "${affiliateBadge.textContent.trim()}"`)
    } else {
      console.log(`   ❌ No affiliate badge found`)
    }

    // Check all badges in this graph
    const allBadges = element.querySelectorAll('.badge')
    console.log(`   📋 All badges found (${allBadges.length}):`)
    allBadges.forEach((badge, index) => {
      console.log(`     ${index + 1}. "${badge.textContent.trim()}" (class: ${badge.className})`)
    })
  })

  console.log('\\n🔧 Manual test - try calling hasAffiliate function:')
  console.log('You can test in console: hasAffiliate("graph_1744927233341")')
}

// Run the debug
debugAffiliateBadges()

// Also provide instructions
console.log('\\n📝 Instructions:')
console.log('1. Open this in browser console on the GraphPortfolio page')
console.log('2. If no badges found, try hard refresh (Ctrl+F5)')
console.log('3. Check if graphs are visible (not filtered out)')
console.log('4. Verify you are in "Detailed View" mode')
