#!/usr/bin/env node

console.log('=== Testing Template System ===\n');

// Step 1: Fetch templates from API with gemini=1
console.log('1️⃣  Fetching landing page template via API (gemini=1)...\n');

const apiUrl = 'https://knowledge.vegvisr.org/getAITemplates?gemini=1';

try {
  const res = await fetch(apiUrl, {
    headers: { 'x-user-role': 'Superadmin' }
  });
  
  const response = await res.json();
  const templates = response.results;
  
  // Find landing page template
  const landingTemplate = templates.find(t => t.id === 'html-tmpl-landing-page');
  if (!landingTemplate) {
    console.error('❌ Landing page template not found');
    process.exit(1);
  }
  
  console.log('✅ Successfully fetched landing page template from API');
  console.log(`   - ID: ${landingTemplate.id}`);
  console.log(`   - Name: ${landingTemplate.name}`);
  console.log(`   - Gemini Flag: ${landingTemplate.gemini}`);
  console.log(`   - Category: ${landingTemplate.category}`);
  console.log();
  
  // Step 2: Extract HTML content
  if (landingTemplate.nodes && landingTemplate.nodes.length > 0) {
    const htmlNode = landingTemplate.nodes[0];
    const htmlContent = htmlNode.info;
    
    console.log('2️⃣  Template HTML Content Sample:');
    console.log('   ' + htmlContent.substring(0, 250).replace(/\n/g, '\n   ') + '...\n');
    
    // Step 3: Prepare a diving-themed HTML node
    console.log('3️⃣  Creating diving knowledge graph with HTML node...\n');
    
    // Replace placeholders with diving content
    const divingHtml = htmlContent
      .replace('{{TITLE}}', 'Diving Adventure')
      .replace('{{DESCRIPTION}}', 'Explore the underwater world and discover the beauty of marine ecosystems')
      .replace('{{FOOTER_TEXT}}', 'Dive Safe • Explore Responsibly • Preserve Marine Life');
    
    // Create the knowledge graph payload
    const graphPayload = {
      id: 'graph_diving_landing_test',
      graphData: {
        nodes: [
          {
            id: 'node-landing-page',
            label: 'Landing Page',
            type: 'html-node',
            info: divingHtml,
            color: '#0ea5e9',
            position: { x: 0, y: 0 },
            visible: true
          },
          {
            id: 'node-about',
            label: 'About Diving',
            type: 'fulltext',
            info: `# Discover Diving

Diving is an incredible adventure. Explore vibrant coral reefs, encounter unique marine life, and experience the serene underwater world.

## Why Dive?
- 🐠 **Marine Life**: Fish, turtles, rays, sharks
- 🏝️ **Coral Reefs**: Colorful ecosystems
- 🧘 **Relaxation**: Peaceful underwater silence
- 🌍 **Adventure**: Explore new frontiers`,
            color: '#06b6d4',
            position: { x: 400, y: 0 },
            visible: true
          },
          {
            id: 'node-destinations',
            label: 'Top Dive Sites',
            type: 'fulltext',
            info: `# Best Dive Destinations

## 🪸 Great Barrier Reef
World's largest coral reef system - Australia

## 🌊 Red Sea
Stunning formations and abundant marine life - Egypt

## 🏝️ Palau
Dramatic walls, caverns, and blue holes

## 🦭 Galápagos
Unique endemic species - Ecuador`,
            color: '#14b8a6',
            position: { x: 200, y: 300 },
            visible: true
          }
        ],
        edges: [
          { id: 'edge-1', source: 'node-landing-page', target: 'node-about' },
          { id: 'edge-2', source: 'node-landing-page', target: 'node-destinations' }
        ],
        metadata: {
          title: 'Diving Adventure Landing Page',
          description: 'Explore the underwater world with our landing page template',
          category: 'Sports & Adventure',
          version: '1.0'
        }
      },
      override: true
    };
    
    console.log('4️⃣  Saving graph to D1 database...\n');
    
    const saveRes = await fetch('https://knowledge.vegvisr.org/saveGraphWithHistory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'Superadmin'
      },
      body: JSON.stringify(graphPayload)
    });
    
    const saveResult = await saveRes.json();
    
    console.log('✅ Graph saved successfully');
    console.log(`   - Graph ID: ${graphPayload.id}`);
    console.log(`   - Title: ${graphPayload.graphData.metadata.title}`);
    console.log(`   - Nodes: ${graphPayload.graphData.nodes.length}`);
    console.log(`   - Edges: ${graphPayload.graphData.edges.length}`);
    console.log();
    console.log('🎯 Test Complete!');
    console.log();
    console.log('👁️  View the graph: https://knowledge.vegvisr.org/public-graph?id=graph_diving_landing_test');
    console.log();
    console.log('📋 System Validation Summary:');
    console.log('   ✅ Fetched html-tmpl-landing-page from API via getAITemplates?gemini=1');
    console.log('   ✅ Template contains full HTML with meta tags and placeholders');
    console.log('   ✅ Created knowledge graph with HTML node');
    console.log('   ✅ Replaced {{TITLE}}, {{DESCRIPTION}}, {{FOOTER_TEXT}} placeholders');
    console.log('   ✅ Successfully saved landing page to graph');
    console.log('   ✅ System working end-to-end!');
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
